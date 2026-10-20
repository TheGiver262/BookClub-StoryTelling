/**
 * YSBK Public Reservation System - Business Rules & Quota Calculations
 * Tuân thủ thiết kế: docs/technical/public-reservation-design.md
 */

import * as crypto from 'node:crypto';
import { isIP } from 'node:net';
import { normalizePhone } from '../borrowers/rules.ts';
import { BadRequestError } from '../errors.ts';

export { normalizePhone };

export const MAX_RESERVATIONS_PER_PHONE = 3;
export const MAX_RESERVATIONS_PER_IP_24H = 3;
export const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export class ReservationRuleError extends BadRequestError {
  constructor(message: string, code = 'RESERVATION_RULE_ERROR') {
    super(message, code);
    this.name = 'ReservationRuleError';
  }
}

/**
 * Chuẩn hóa địa chỉ IP:
 * - Hỗ trợ IPv4, IPv6, IPv4-mapped IPv6 (::ffff:192.168.1.1 -> 192.168.1.1)
 * - Loại bỏ khoảng trắng và ngoặc vuông bao quanh IPv6
 */
export function normalizeIpAddress(rawIp: string): string {
  let ip = typeof rawIp === 'string' ? rawIp.trim().toLowerCase() : '';
  // Bỏ ngoặc vuông [::1] -> ::1
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }
  if (!isIP(ip)) throw new ReservationRuleError('Địa chỉ IP không hợp lệ.', 'INVALID_CLIENT_IP');
  if (isIP(ip) === 6) ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = ip.match(/^::ffff:([\da-f]+):([\da-f]+)$/);
  if (mapped) ip = [parseInt(mapped[1], 16) >>> 8, parseInt(mapped[1], 16) & 255, parseInt(mapped[2], 16) >>> 8, parseInt(mapped[2], 16) & 255].join('.');
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip.toLowerCase();
}

/**
 * Băm địa chỉ IP bằng HMAC-SHA256 với version prefix
 * Đảm bảo tính riêng tư của IP và an toàn khi xoay khóa bí mật
 */
export function hashIpAddress(clientIp: string, secret?: string, keyVersion = 'v1'): string {
  const normalized = normalizeIpAddress(clientIp);
  const key = reservationSecret(secret);
  const hmac = crypto.createHmac('sha256', key).update(normalized).digest('hex');
  return `${keyVersion}:${hmac}`;
}

/**
 * Sinh token tra cứu bí mật cho khách và mã băm SHA-256 để lưu trữ an toàn trong DB
 */
export function generateReservationLookupToken(): { token: string; tokenHash: string } {
  const randomBytes = crypto.randomBytes(32);
  const token = `rsv_tok_${randomBytes.toString('base64url')}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/**
 * Dẫn xuất token tra cứu tất định an toàn khi có Idempotency Key (PRF-09)
 * Giúp client khôi phục cùng quyền tra cứu khi replay mà không cần lưu token thô
 */
export function deriveReservationLookupToken(
  idempotencyKey: string,
  phone: string,
  secret?: string
): { token: string; tokenHash: string } {
  const key = reservationSecret(secret);
  const derived = crypto.createHmac('sha256', key).update(`lookup:${phone}:${idempotencyKey}`).digest('base64url');
  const token = `rsv_tok_${derived}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function reservationSecret(secret?: string): string {
  const key = secret || (typeof process !== 'undefined' ? process.env.RESERVATION_IP_SECRET || process.env.JWT_SECRET : undefined);
  if (!key || key.length < 32) throw new ReservationRuleError('RESERVATION_IP_SECRET chưa được cấu hình (tối thiểu 32 ký tự).', 'RESERVATION_SECRET_MISSING');
  return key;
}

/**
 * Băm token tra cứu để đối chiếu với DB
 */
export function hashLookupToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new ReservationRuleError('Token tra cứu không hợp lệ.', 'INVALID_TOKEN');
  }
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Sinh mã đơn đặt chỗ thân thiện với người dùng (VD: RSV-20261020-A8F2)
 */
export function generateReservationCode(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RSV-${y}${m}${d}-${randomSuffix}`;
}

/**
 * Tính toán hạn mức IP theo cửa sổ trượt 24 giờ:
 * Cửa sổ xét: (now - 24h, now] -> Chỉ các đơn có created_at > now - 24h mới được tính
 */
export function calculateIpRollingQuota(
  createdTimestamps: (Date | string | number)[],
  now = new Date()
): {
  usedCount: number;
  remainingCount: number;
  isBlocked: boolean;
  nextAvailableAt?: Date;
} {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const cutoffMs = nowMs - ROLLING_WINDOW_MS;

  // Lọc các đơn còn nằm trong cửa sổ 24 giờ trượt
  const validTimes: number[] = [];
  for (const t of createdTimestamps) {
    const tMs = t instanceof Date ? t.getTime() : new Date(t).getTime();
    if (tMs > cutoffMs && tMs <= nowMs) {
      validTimes.push(tMs);
    }
  }

  validTimes.sort((a, b) => a - b);
  const usedCount = validTimes.length;
  const remainingCount = Math.max(0, MAX_RESERVATIONS_PER_IP_24H - usedCount);
  const isBlocked = usedCount >= MAX_RESERVATIONS_PER_IP_24H;

  let nextAvailableAt: Date | undefined;
  if (isBlocked && validTimes.length > 0) {
    // Thời điểm đơn cũ nhất trong cửa sổ rơi ra ngoài 24 giờ
    nextAvailableAt = new Date(validTimes[0] + ROLLING_WINDOW_MS);
  }

  return {
    usedCount,
    remainingCount,
    isBlocked,
    nextAvailableAt,
  };
}

/**
 * Tính toán hạn mức theo Số điện thoại:
 * Tối đa 3 suất = số sách đang HELD + số sách đã giao chưa trả (BORROWED)
 */
export function calculatePhoneQuota(
  activeHoldsCount: number,
  activeUnreturnedLoansCount: number
): {
  usedCount: number;
  remainingCount: number;
  isBlocked: boolean;
} {
  const usedCount = Math.max(0, activeHoldsCount) + Math.max(0, activeUnreturnedLoansCount);
  const remainingCount = Math.max(0, MAX_RESERVATIONS_PER_PHONE - usedCount);
  const isBlocked = usedCount >= MAX_RESERVATIONS_PER_PHONE;

  return {
    usedCount,
    remainingCount,
    isBlocked,
  };
}
