/**
 * YSBK Public Reservation Service
 * Lõi nghiệp vụ đặt giữ chỗ công khai, tính tồn khả dụng, hai hạn mức nguyên tử,
 * bàn giao tại quầy, và quét hết hạn ca trực.
 * Tuân thủ thiết kế: docs/technical/public-reservation-design.md
 * Đã sửa toàn diện theo findings PRF-02, PRF-03, PRF-04, PRF-05, PRF-06, PRF-08, PRF-09.
 */

import type { Queryable } from '../finance/types.ts';
import type { AuthenticatedActor } from '../types.ts';
import { AppError, BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../errors.ts';
import {
  normalizePhone,
  hashIpAddress,
  generateReservationLookupToken,
  deriveReservationLookupToken,
  hashLookupToken,
  generateReservationCode,
  calculateIpRollingQuota,
  calculatePhoneQuota,
  ROLLING_WINDOW_MS,
} from './rules.ts';
import type {
  ReservationStatus,
  CreateReservationInput,
  ReservationRequestContext,
  PublicReservationDto,
  StaffReservationDto,
  CreateReservationResult,
  FulfillReservationInput,
  FulfillReservationResult,
  ExpireReservationsResult,
  PublicReservationBookDto,
  PublicPickupScheduleDto,
  ReservationFilter,
} from './types.ts';
import { calculateDeposit } from '../catalog/rules.ts';
import { issueLoanReceipt } from '../circulation/service.ts';
import { computePayloadHash } from '../shared/idempotency.ts';
import { recordAuditLog } from '../shared/audit.ts';

export class ReservationError extends AppError {
  constructor(message: string, code = 'RESERVATION_ERROR', httpStatus = 400) {
    super(message, httpStatus, code);
    this.name = 'ReservationError';
  }
}

export class ReservationNotFoundError extends NotFoundError {
  constructor(message = 'Không tìm thấy thông tin đơn đặt giữ chỗ.') {
    super(message, 'RESERVATION_NOT_FOUND');
    this.name = 'ReservationNotFoundError';
  }
}

export class ReservationQuotaExceededError extends AppError {
  public nextAvailableAt?: Date;

  constructor(message: string, code = 'QUOTA_EXCEEDED', nextAvailableAt?: Date) {
    super(message, 429, code);
    this.name = 'ReservationQuotaExceededError';
    this.nextAvailableAt = nextAvailableAt;
  }
}

/**
 * Chuyển đổi hàng database sang PublicReservationDto an toàn
 */
function toPublicReservationDto(row: any): PublicReservationDto {
  const safeCreated = row.created_at ? new Date(row.created_at) : new Date();
  const safeExpires = row.expires_at ? new Date(row.expires_at) : new Date();
  let shiftDateStr = '2026-10-20';
  const rawDate = row.schedule_date || row.shift_date;
  if (typeof rawDate === 'string') {
    shiftDateStr = rawDate.split('T')[0];
  } else if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    shiftDateStr = rawDate.toISOString().split('T')[0];
  }

  return {
    id: row.id,
    code: row.code,
    status: row.status as ReservationStatus,
    titleId: row.title_id,
    bookTitle: row.book_title || row.title || 'Sách',
    authorName: row.author_name || row.author || undefined,
    copyBarcode: undefined,
    scheduleId: row.schedule_id,
    shiftDate: shiftDateStr,
    shiftTime: row.shift_time || row.time_range || '14:00 - 17:00',
    pickupLocation: row.pickup_location || row.location || 'Bàn trực thư viện',
    expiresAt: !isNaN(safeExpires.getTime()) ? safeExpires.toISOString() : new Date().toISOString(),
    estimatedDeposit: Number(row.estimated_deposit || 50000),
    createdAt: !isNaN(safeCreated.getTime()) ? safeCreated.toISOString() : new Date().toISOString(),
  };
}

/**
 * Phân giải thời điểm kết thúc ca trực theo múi giờ Việt Nam (UTC+7) (PRF-03)
 * Phân tích chính xác giờ kết thúc phục vụ từ chuỗi ca trực (ví dụ "14:00 - 17:00 (Thu dọn đến 17:15)")
 * Lấy mốc kết thúc 17:00, không lấy giờ thu dọn.
 */
export function resolveShiftEndTime(scheduleDate: any, shiftTime: string, explicitEndTime?: string): Date {
  const dateStr = scheduleDate instanceof Date && !isNaN(scheduleDate.getTime())
    ? scheduleDate.toISOString().slice(0, 10) : String(scheduleDate || '').slice(0, 10);
  const range = String(shiftTime || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  const time = explicitEndTime ? String(explicitEndTime).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/) : range?.[2].match(/^(\d{1,2}):(\d{2})$/);
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr ||
      !time || Number(time[1]) > 23 || Number(time[2]) > 59) {
    throw new BadRequestError('Ngày hoặc giờ kết thúc ca trực không hợp lệ.', 'INVALID_SCHEDULE_TIME');
  }
  if (range) {
    const [startHour, startMinute] = range[1].split(':').map(Number);
    if (startHour > 23 || startMinute > 59 || startHour * 60 + startMinute >= Number(time[1]) * 60 + Number(time[2])) {
      throw new BadRequestError('Khoảng giờ ca trực không hợp lệ.', 'INVALID_SCHEDULE_TIME');
    }
  }
  return new Date(`${dateStr}T${time[1].padStart(2, '0')}:${time[2]}:00+07:00`);
}
/**
 * 1. Đặt giữ chỗ sách công khai (Create Public Reservation)
 * - 1 quyển / đơn; không cần login/OTP.
 * - Khóa 2 namespace hạn mức nguyên tử theo thứ tự cố định (IP -> Phone).
 * - Kiểm tra 2 hạn mức độc lập: 3 suất/SĐT và 3 đơn/IP/24h trượt.
 * - Chọn và khóa bản sách khả dụng (loại trừ các bản đang HELD).
 * - Sinh mã tra cứu và token bí mật bảo vệ quyền riêng tư.
 */
export async function createReservation(
  db: Queryable,
  input: CreateReservationInput,
  context: ReservationRequestContext
): Promise<CreateReservationResult> {
  // 1. Kiểm tra tính hợp lệ cơ bản của dữ liệu
  if (!input.titleId || typeof input.titleId !== 'string') {
    throw new BadRequestError('Vui lòng chọn đầu sách muốn đặt.', 'MISSING_TITLE_ID');
  }
  if (!input.scheduleId || typeof input.scheduleId !== 'string') {
    throw new BadRequestError('Vui lòng chọn ca trực nhận sách.', 'MISSING_SCHEDULE_ID');
  }
  if (!input.fullName || typeof input.fullName !== 'string' || input.fullName.trim().length === 0) {
    throw new BadRequestError('Họ và tên người nhận không được để trống.', 'MISSING_FULL_NAME');
  }
  if (!context.captchaToken || typeof context.captchaToken !== 'string') {
    throw new BadRequestError('Vui lòng hoàn thành xác minh CAPTCHA trước khi đặt sách.', 'CAPTCHA_REQUIRED');
  }
  for (const [field, max] of [['fullName', 128], ['studentId', 50], ['university', 128], ['email', 128]] as const) {
    const value = input[field];
    if (value != null && (typeof value !== 'string' || value.trim().length > max)) {
      throw new BadRequestError(`Trường ${field} không hợp lệ (tối đa ${max} ký tự).`, 'INVALID_RESERVATION_FIELD');
    }
  }

  // Chuẩn hóa SĐT và băm IP
  const normalizedPhone = normalizePhone(input.phone);
  const ipHash = hashIpAddress(context.clientIp, context.secret);
  const canonicalPayload = {
    titleId: input.titleId, scheduleId: input.scheduleId, fullName: input.fullName.trim(), phone: normalizedPhone,
    studentId: input.studentId?.trim() || null, university: input.university?.trim() || null, email: input.email?.trim() || null,
  };
  const payloadHash = computePayloadHash(canonicalPayload);
  if (context.idempotencyKey) {
    if (context.idempotencyKey.length > 128) throw new BadRequestError('Khóa thao tác quá dài.', 'INVALID_IDEMPOTENCY_KEY');
    await db.query(`INSERT INTO reservation_quota_locks (lock_namespace) VALUES ($1)
      ON CONFLICT (lock_namespace) DO UPDATE SET locked_at = clock_timestamp()`,
    [`intent:${computePayloadHash(context.idempotencyKey)}`]);
  }

  // 2. Xử lý Idempotency Replay nếu có idempotencyKey (PRF-09)
  if (context.idempotencyKey) {
    const existingRes = await db.query<any>(
      `SELECT r.*, bt.title AS book_title, bc.barcode AS copy_barcode,
              (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
               FROM book_title_authors bta 
               JOIN authors a ON a.id = bta.author_id 
               WHERE bta.title_id = bt.id) AS author_name
       FROM reservations r
       JOIN book_titles bt ON r.title_id = bt.id
       JOIN book_copies bc ON r.copy_id = bc.id
       WHERE r.idempotency_key = $1`,
      [context.idempotencyKey]
    );

    if (existingRes.rows && existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      // Kiểm tra toàn diện tính nhất quán của canonical payload (PRF-09)
      const isConsistent =
        existing.title_id === input.titleId &&
        existing.phone === normalizedPhone &&
        existing.schedule_id === input.scheduleId &&
        existing.full_name.trim() === input.fullName.trim() &&
        (existing.payload_hash ? existing.payload_hash === payloadHash :
          (existing.student_id || null) === canonicalPayload.studentId &&
          (existing.university || null) === canonicalPayload.university &&
          (existing.email || null) === canonicalPayload.email);

      if (!isConsistent) {
        throw new ConflictError(
          `Idempotency key '${context.idempotencyKey}' đã được sử dụng trước đó cho một yêu cầu đặt sách với thông tin khác.`,
          'IDEMPOTENCY_PAYLOAD_MISMATCH'
        );
      }

      // Replay an toàn khôi phục quyền tra cứu hợp lệ mà không lưu token thô
      const derivedToken = deriveReservationLookupToken(context.idempotencyKey, normalizedPhone, context.secret);
      if (existing.token_hash && existing.token_hash !== derivedToken.tokenHash) throw new ReservationError('Khóa tra cứu đã thay đổi; cần hỗ trợ tại bàn trực.', 'LOOKUP_KEY_CHANGED', 503);
      return {
        reservation: toPublicReservationDto(existing),
        lookupToken: derivedToken.token,
        isReplay: true,
      };
    }
  }

  await db.query('SELECT id FROM duty_schedules WHERE id = $1 FOR SHARE', [input.scheduleId]);
  // 3. Khóa Namespace Hạn mức nguyên tử theo thứ tự cố định chống deadlock (PRF-04)
  const quotaNamespaces = [`ip:${ipHash}`, `phone:${normalizedPhone}`].sort();
  for (const ns of quotaNamespaces) {
    await db.query(
      `INSERT INTO reservation_quota_locks (lock_namespace) 
       VALUES ($1) 
       ON CONFLICT (lock_namespace) DO UPDATE SET locked_at = NOW()`,
      [ns]
    );
  }

  // Thời điểm server quyết định sau khi đã có khóa
  const now = context.now || new Date();

  // 4. Kiểm tra Hạn mức IP trong 24 giờ trượt
  const rollingCutoff = new Date(now.getTime() - ROLLING_WINDOW_MS);
  const ipRecordsRes = await db.query<{ created_at: string }>(
    `SELECT created_at FROM reservations 
     WHERE ip_hash = $1 AND created_at > $2`,
    [ipHash, rollingCutoff.toISOString()]
  );

  const ipQuota = calculateIpRollingQuota(
    ipRecordsRes.rows.map((r) => r.created_at),
    now
  );

  if (ipQuota.isBlocked) {
    const nextMsg = ipQuota.nextAvailableAt
      ? ` Vui lòng thử lại sau ${ipQuota.nextAvailableAt.toISOString()}.`
      : '';
    throw new ReservationQuotaExceededError(
      `Địa chỉ mạng của bạn đã đạt giới hạn tối đa 3 đơn đặt trong 24 giờ.${nextMsg}`,
      'IP_QUOTA_EXCEEDED',
      ipQuota.nextAvailableAt
    );
  }

  // 5. Kiểm tra Hạn mức SĐT (PRF-06: Đầy đủ các nghĩa vụ chưa kết thúc, không bỏ sót OVERDUE hay PENDING_DEPOSIT)
  const activeHoldsRes = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM reservations 
     WHERE phone = $1 AND status = 'HELD' AND expires_at > $2`,
    [normalizedPhone, now.toISOString()]
  );
  const activeHoldsCount = Number(activeHoldsRes.rows[0]?.count || 0);

  const activeLoansRes = await db.query<{ unreturned_count: string }>(
    `SELECT COUNT(DISTINCT li.copy_id) AS unreturned_count
     FROM loan_items li
     JOIN loan_receipts lr ON li.receipt_id = lr.id
     JOIN borrowers b ON lr.borrower_id = b.id
     WHERE b.phone = $1 
       AND li.returned_at IS NULL 
       AND li.carried_forward_at IS NULL
`,
    [normalizedPhone]
  );
  const activeLoansCount = Number(activeLoansRes.rows[0]?.unreturned_count || 0);

  const phoneQuota = calculatePhoneQuota(activeHoldsCount, activeLoansCount);
  if (phoneQuota.isBlocked) {
    throw new ReservationQuotaExceededError(
      `Số điện thoại ${normalizedPhone} đã sử dụng hết hạn mức 3 suất (hiện đang giữ ${activeHoldsCount} cuốn và đang mượn ${activeLoansCount} cuốn chưa hoàn thành nghĩa vụ).`,
      'PHONE_QUOTA_EXCEEDED'
    );
  }

  // 6. Kiểm tra Ca trực (Schedule) theo canonical schema duty_schedules (PRF-03)
  const schedRes = await db.query<any>(
    `SELECT id, schedule_date, shift_time, location, status
     FROM duty_schedules
     WHERE id = $1 FOR SHARE`,
    [input.scheduleId]
  );

  if (!schedRes.rows || schedRes.rows.length === 0) {
    throw new BadRequestError('Ca trực được chọn không tồn tại.', 'SCHEDULE_NOT_FOUND');
  }
  const sched = schedRes.rows[0];
  const schedDateVal = sched.schedule_date || sched.shift_date;
  const schedTimeVal = sched.shift_time || sched.time_range;
  const isAvailable = sched.status === 'PUBLISHED' || sched.is_published === true;
  if (!isAvailable || sched.status === 'CANCELLED') {
    throw new BadRequestError('Ca trực này hiện không nhận đơn đặt giữ chỗ.', 'SCHEDULE_NOT_AVAILABLE');
  }

  const shiftEnd = resolveShiftEndTime(schedDateVal, schedTimeVal, sched.end_time);
  if (now.getTime() >= shiftEnd.getTime()) {
    throw new BadRequestError('Ca trực đã kết thúc, không thể đặt giữ chỗ.', 'SCHEDULE_EXPIRED');
  }

  await db.query(`UPDATE reservations SET status = 'EXPIRED', updated_at = clock_timestamp()
    WHERE status = 'HELD' AND expires_at <= $1 AND title_id = $2`, [now.toISOString(), input.titleId]);

  // 7. Chọn và khóa bản sách khả dụng (Available Copy) (PRF-03 canonical schema)
  const copyRes = await db.query<any>(
    `SELECT bc.id, bc.barcode, bc.cover_price, bt.id AS title_id, bt.title,
            (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
             FROM book_title_authors bta 
             JOIN authors a ON a.id = bta.author_id 
             WHERE bta.title_id = bt.id) AS author_name
     FROM book_copies bc
     JOIN book_editions be ON be.id = bc.edition_id
     JOIN book_titles bt ON bt.id = be.title_id
     WHERE bt.id = $1 
       AND bc.status = 'AVAILABLE'
       AND bc.id NOT IN (
         SELECT copy_id FROM reservations 
         WHERE status = 'HELD' AND expires_at > $2
       )
       AND bc.id NOT IN (
         SELECT copy_id FROM loan_items 
         WHERE returned_at IS NULL AND carried_forward_at IS NULL
       )
     ORDER BY bc.barcode ASC
     LIMIT 1
     FOR UPDATE OF bc SKIP LOCKED`,
    [input.titleId, now.toISOString()]
  );

  if (!copyRes.rows || copyRes.rows.length === 0) {
    throw new ConflictError(
      'Hiện không còn bản sách nào sẵn sàng để đặt giữ chỗ cho đầu sách này.',
      'BOOK_NOT_AVAILABLE'
    );
  }
  const selectedCopy = copyRes.rows[0];
  if ((context.now || new Date()).getTime() >= shiftEnd.getTime()) throw new ConflictError('Ca trực đã kết thúc.', 'SCHEDULE_EXPIRED');

  // Tính tiền cọc chuẩn quy tắc 50k / 100k
  const calculatedDeposit = Number(calculateDeposit(selectedCopy.cover_price == null ? null : BigInt(selectedCopy.cover_price)));

  // 8. Tạo mã đơn và token tra cứu bảo mật
  let token: string;
  let tokenHash: string;
  if (context.idempotencyKey) {
    const derived = deriveReservationLookupToken(context.idempotencyKey, normalizedPhone, context.secret);
    token = derived.token;
    tokenHash = derived.tokenHash;
  } else {
    const generated = generateReservationLookupToken();
    token = generated.token;
    tokenHash = generated.tokenHash;
  }
  const code = generateReservationCode(now);

  const schedDateStr = typeof schedDateVal === 'string'
    ? schedDateVal.split('T')[0]
    : (schedDateVal instanceof Date && !isNaN(schedDateVal.getTime())
        ? schedDateVal.toISOString().split('T')[0]
        : '2026-10-20');

  const insertRes = await db.query<any>(
    `INSERT INTO reservations (
      code, title_id, copy_id, schedule_id, full_name, phone, student_id, university, email,
      ip_hash, token_hash, idempotency_key, status, shift_date, shift_time, pickup_location,
      expires_at, estimated_deposit, created_at, updated_at, payload_hash
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, 'HELD', $13, $14, $15,
      $16, $17, $18, $18, $19
    ) RETURNING id`,
    [
      code,
      selectedCopy.title_id,
      selectedCopy.id,
      sched.id,
      input.fullName.trim(),
      normalizedPhone,
      input.studentId ? input.studentId.trim() : null,
      input.university ? input.university.trim() : null,
      input.email ? input.email.trim() : null,
      ipHash,
      tokenHash,
      context.idempotencyKey || null,
      schedDateStr,
      schedTimeVal || '14:00 - 17:00',
      sched.location || 'Bàn trực sảnh B',
      shiftEnd.toISOString(),
      calculatedDeposit,
      now.toISOString(),
      payloadHash,
    ]
  );

  const reservationDto: PublicReservationDto = {
    id: insertRes.rows[0].id,
    code,
    status: 'HELD',
    titleId: selectedCopy.title_id,
    bookTitle: selectedCopy.title,
    authorName: selectedCopy.author_name || undefined,
    copyBarcode: undefined, // Ẩn barcode với khách công khai
    scheduleId: sched.id,
    shiftDate: schedDateStr,
    shiftTime: sched.shift_time || '14:00 - 17:00',
    pickupLocation: sched.location || 'Bàn trực sảnh B',
    expiresAt: shiftEnd.toISOString(),
    estimatedDeposit: calculatedDeposit,
    createdAt: now.toISOString(),
  };

  return {
    reservation: reservationDto,
    lookupToken: token,
    isReplay: false,
  };
}

/**
 * 2. Tra cứu chi tiết đơn bằng token bí mật riêng (PRF-03 canonical schema)
 */
export async function getReservationByToken(db: Queryable, token: string): Promise<PublicReservationDto> {
  const tokenHash = hashLookupToken(token);
  const res = await db.query<any>(
    `SELECT r.*, bt.title AS book_title, bc.barcode AS copy_barcode,
            (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
             FROM book_title_authors bta 
             JOIN authors a ON a.id = bta.author_id 
             WHERE bta.title_id = bt.id) AS author_name
     FROM reservations r
     JOIN book_titles bt ON r.title_id = bt.id
     JOIN book_copies bc ON r.copy_id = bc.id
     WHERE r.token_hash = $1`,
    [tokenHash]
  );

  if (!res.rows || res.rows.length === 0) {
    throw new ReservationNotFoundError('Mã tra cứu không tồn tại hoặc không khớp với đơn đặt.');
  }

  const row = res.rows[0];
  // Kiểm tra hết hạn hiệu lực: nếu HELD mà expires_at <= NOW() -> tự động coi là EXPIRED
  if (row.status === 'HELD' && new Date(row.expires_at).getTime() <= Date.now()) {
    row.status = 'EXPIRED';
  }

  return toPublicReservationDto(row);
}

/**
 * 3. Hủy đơn giữ chỗ (khách dùng token hoặc thành viên trực hủy) (PRF-03, PRF-04)
 */
export async function cancelReservation(
  db: Queryable,
  selector: { id?: string; token?: string },
  actor?: AuthenticatedActor | null,
  reason?: string
): Promise<PublicReservationDto> {
  let res: any;

  if (selector.token) {
    const tokenHash = hashLookupToken(selector.token);
    res = await db.query<any>(
      `SELECT r.*, bt.title AS book_title, bc.barcode AS copy_barcode,
              (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
               FROM book_title_authors bta 
               JOIN authors a ON a.id = bta.author_id 
               WHERE bta.title_id = bt.id) AS author_name
       FROM reservations r
       JOIN book_titles bt ON r.title_id = bt.id
       JOIN book_copies bc ON r.copy_id = bc.id
       WHERE r.token_hash = $1
       FOR UPDATE OF r`,
      [tokenHash]
    );
  } else if (selector.id) {
    if (!actor || (!actor.isActive || actor.isAlumni || actor.role === 'GUEST')) {
      throw new ForbiddenError('Yêu cầu quyền thành viên trực để hủy đơn.', 'FORBIDDEN');
    }
    res = await db.query<any>(
      `SELECT r.*, bt.title AS book_title, bc.barcode AS copy_barcode,
              (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
               FROM book_title_authors bta 
               JOIN authors a ON a.id = bta.author_id 
               WHERE bta.title_id = bt.id) AS author_name
       FROM reservations r
       JOIN book_titles bt ON r.title_id = bt.id
       JOIN book_copies bc ON r.copy_id = bc.id
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [selector.id]
    );
  } else {
    throw new BadRequestError('Thiếu thông tin nhận diện đơn cần hủy.', 'INVALID_SELECTOR');
  }

  if (!res.rows || res.rows.length === 0) {
    throw new ReservationNotFoundError('Không tìm thấy đơn cần hủy.');
  }

  const reservation = res.rows[0];
  if (reservation.status !== 'HELD') {
    throw new ConflictError(
      `Chỉ có thể hủy đơn đang ở trạng thái Chờ nhận (HELD). Trạng thái hiện tại: ${reservation.status}.`,
      'CANNOT_CANCEL_RESERVATION'
    );
  }

  const cancelReason = reason?.trim() || (selector.token ? 'Khách chủ động hủy qua trang tra cứu' : 'Thành viên trực hủy');
  const now = new Date();

  await db.query(
    `UPDATE reservations
     SET status = 'CANCELLED',
         cancelled_at = $1,
         cancelled_by = $2,
         cancellation_reason = $3,
         updated_at = $1
     WHERE id = $4 AND status = 'HELD'`,
    [now.toISOString(), actor?.memberId || actor?.userId || null, cancelReason, reservation.id]
  );

  reservation.status = 'CANCELLED';
  reservation.cancellation_reason = cancelReason;
  reservation.cancelled_at = now.toISOString();

  return toPublicReservationDto(reservation);
}

/**
 * 4. Bàn giao sách tại quầy và thu cọc (Fulfill Reservation) (PRF-05, PRF-08)
 * - Chuyển giao đơn sang phiếu mượn 1 cuốn trong cùng transaction nguyên tử.
 * - Khóa đơn, kiểm tra hạn giữ chỗ, chọn/tạo hồ sơ bạn đọc theo SĐT và tên.
 * - Gọi issueLoanReceipt với reservationId để guard không chặn nhầm.
 * - Kiểm tra depositPaymentConfirmed === true nghiêm ngặt.
 */
export async function fulfillReservation(
  db: Queryable,
  reservationId: string,
  input: FulfillReservationInput,
  actor: AuthenticatedActor,
  nowOverride?: Date
): Promise<FulfillReservationResult> {
  if (!actor || !actor.isActive || actor.isAlumni || !['MEMBER', 'ADMIN'].includes(actor.role)) {
    throw new ForbiddenError('Chỉ thành viên trực mới có quyền bàn giao sách.', 'FORBIDDEN');
  }

  // PRF-08: Ràng buộc xác nhận tiền cọc nghiêm ngặt
  if (input.depositPaymentConfirmed !== true) {
    throw new BadRequestError(
      'Yêu cầu xác nhận thu tiền đặt cọc (depositPaymentConfirmed phải là true).',
      'DEPOSIT_CONFIRMATION_REQUIRED'
    );
  }

  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'BANK_TRANSFER') {
    throw new BadRequestError(
      'Phương thức thanh toán cọc không hợp lệ. Chỉ chấp nhận CASH hoặc BANK_TRANSFER.',
      'INVALID_PAYMENT_METHOD'
    );
  }

  // Follow circulation's cash-session lock order before locking reservations.
  await db.query('SELECT id FROM cash_sessions WHERE is_closed = FALSE FOR UPDATE');
  const preview = await db.query<any>('SELECT phone, schedule_id FROM reservations WHERE id = $1', [reservationId]);
  if (preview.rows[0]) {
    await db.query('SELECT id FROM duty_schedules WHERE id = $1 FOR SHARE', [preview.rows[0].schedule_id]);
    await db.query(`INSERT INTO reservation_quota_locks (lock_namespace) VALUES ($1)
      ON CONFLICT (lock_namespace) DO UPDATE SET locked_at = clock_timestamp()`, [`phone:${preview.rows[0].phone}`]);
  }
  // 1. Khóa đơn đặt FOR UPDATE
  const resLookup = await db.query<any>(
    `SELECT r.*, bt.title AS book_title, bc.barcode AS copy_barcode,
            (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
             FROM book_title_authors bta 
             JOIN authors a ON a.id = bta.author_id 
             WHERE bta.title_id = bt.id) AS author_name
     FROM reservations r
     JOIN book_titles bt ON r.title_id = bt.id
     JOIN book_copies bc ON r.copy_id = bc.id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [reservationId]
  );

  if (!resLookup.rows || resLookup.rows.length === 0) {
    throw new ReservationNotFoundError('Không tìm thấy đơn đặt sách cần bàn giao.');
  }

  const reservation = resLookup.rows[0];
  if (reservation.status !== 'HELD') {
    throw new ConflictError(
      `Đơn đặt không ở trạng thái Chờ nhận (HELD) để bàn giao. Trạng thái hiện tại: ${reservation.status}.`,
      'RESERVATION_NOT_HELD'
    );
  }

  const now = nowOverride || new Date();
  if (now.getTime() >= new Date(reservation.expires_at).getTime()) {
    // Đơn đã quá hạn -> tự động cập nhật EXPIRED
    await db.query(
      `UPDATE reservations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND status = 'HELD'`,
      [reservation.id]
    );
    throw new ConflictError(
      'Đơn đặt đã quá hạn nhận sách, không thể thực hiện giao sách.',
      'RESERVATION_EXPIRED'
    );
  }

  const pickupDate = typeof reservation.shift_date === 'string' ? reservation.shift_date.slice(0, 10) : reservation.shift_date.toISOString().slice(0, 10);
  const start = String(reservation.shift_time).match(/(\d{1,2}:\d{2})\s*-/)?.[1];
  if (!start || now < new Date(`${pickupDate}T${start.padStart(5, '0')}:00+07:00`)) {
    throw new ConflictError('Chưa đến buổi trực nhận sách đã chọn.', 'PICKUP_NOT_STARTED');
  }

  // 2. Tìm hoặc tạo hồ sơ bạn đọc khớp chính xác (PRF-03, PRF-05)
  let borrowerId = input.borrowerId;
  if (!borrowerId) {
    const bRes = await db.query<any>(
      `SELECT id, full_name, phone, student_id 
       FROM borrowers 
       WHERE phone = $1 AND is_archived = FALSE`,
      [reservation.phone]
    );

    if (bRes.rows && bRes.rows.length > 0) {
      // Đối chiếu đúng người khi có nhiều hồ sơ cùng SĐT:
      // Ưu tiên khớp tên (case-insensitive, trimmed) hoặc khớp student_id
      let matched: any = null;
      {
        const targetName = reservation.full_name.trim().toLowerCase();
        matched = bRes.rows.find((b: any) => {
          const bName = (b.full_name || b.name || '').trim().toLowerCase();
          const nameMatch = bName === targetName;
          const studentMatch = reservation.student_id && b.student_id && b.student_id.trim() === reservation.student_id.trim();
          return nameMatch || studentMatch;
        });
      }

      if (matched) {
        borrowerId = matched.id;
      } else {
        // Nếu cùng số nhưng khác tên hoàn toàn -> tạo hồ sơ mới cho người nhận này
        const createBRes = await db.query<any>(
          `INSERT INTO borrowers (full_name, phone, student_id, email, is_archived)
           VALUES ($1, $2, $3, $4, FALSE)
           RETURNING id`,
          [
            reservation.full_name.trim(),
            reservation.phone,
            reservation.student_id ? reservation.student_id.trim() : null,
            reservation.email ? reservation.email.trim() : null,
          ]
        );
        borrowerId = createBRes.rows[0]?.id;
      }
    } else {
      // Tự động tạo hồ sơ bạn đọc từ thông tin đơn đặt
      const createBRes = await db.query<any>(
        `INSERT INTO borrowers (full_name, phone, student_id, email, is_archived)
         VALUES ($1, $2, $3, $4, FALSE)
         RETURNING id`,
        [
          reservation.full_name.trim(),
          reservation.phone,
          reservation.student_id ? reservation.student_id.trim() : null,
          reservation.email ? reservation.email.trim() : null,
        ]
      );
      borrowerId = createBRes.rows[0].id;
    }
  }

  if (!borrowerId) {
    throw new BadRequestError('Không thể xác định hoặc tạo mới hồ sơ bạn đọc để lập phiếu mượn.', 'BORROWER_REQUIRED');
  }

  const borrowerCheck = await db.query<any>('SELECT id, full_name, phone, is_archived FROM borrowers WHERE id = $1 FOR UPDATE', [borrowerId]);
  const borrower = borrowerCheck.rows[0];
  if (!borrower || borrower.is_archived || normalizePhone(borrower.phone) !== reservation.phone ||
      (borrower.full_name || '').trim().toLowerCase() !== reservation.full_name.trim().toLowerCase()) {
    throw new ConflictError('Hồ sơ bạn đọc không khớp tên và SĐT của đơn đặt.', 'BORROWER_RESERVATION_MISMATCH');
  }

  // 3. Thực hiện lập phiếu mượn 1 cuốn qua issueLoanReceipt (PRF-05: truyền reservationId)
  const loanReceipt = await issueLoanReceipt(
    db,
    {
      borrowerId,
      copyIds: [reservation.copy_id],
      paymentMethod: input.paymentMethod,
      confirmedAmount: reservation.estimated_deposit,
      paymentConfirmed: true,
      reservationId: reservation.id, // PRF-05: Truyền liên kết đơn đặt đã xác minh
      notes: input.notes || `Giao từ đơn đặt trước mã ${reservation.code}`,
    },
    actor.memberId || actor.userId
  );

  if ((nowOverride || new Date()).getTime() >= new Date(reservation.expires_at).getTime()) {
    throw new ConflictError('Đơn đặt đã quá hạn nhận sách.', 'RESERVATION_EXPIRED');
  }

  // 4. Cập nhật trạng thái đơn đặt sang BORROWED trong cùng transaction (PRF-04)
  await db.query(
    `UPDATE reservations
     SET status = 'BORROWED',
         fulfilled_receipt_id = $1,
         fulfilled_at = $2,
         fulfilled_by = $3,
         updated_at = $2
     WHERE id = $4 AND status = 'HELD'`,
    [loanReceipt.id, now.toISOString(), actor.memberId || actor.userId, reservation.id]
  );

  reservation.status = 'BORROWED';
  reservation.fulfilled_receipt_id = loanReceipt.id;
  reservation.fulfilled_at = now.toISOString();

  return {
    reservation: toPublicReservationDto(reservation),
    loanReceipt,
  };
}

/**
 * 5. Tác vụ quét và kết thúc các đơn quá hạn (Batch Expire Reservations) (PRF-04)
 */
export async function expireReservations(
  db: Queryable,
  now = new Date(),
  limit = 100
): Promise<ExpireReservationsResult> {
  const expiredRes = await db.query<{ id: string }>(
    `SELECT id FROM reservations
     WHERE status = 'HELD' AND expires_at <= $1
     ORDER BY expires_at ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [now.toISOString(), limit]
  );

  if (!expiredRes.rows || expiredRes.rows.length === 0) {
    return { expiredCount: 0, expiredIds: [] };
  }

  const expiredIds = expiredRes.rows.map((r) => r.id);
  await db.query(
    `UPDATE reservations
     SET status = 'EXPIRED', updated_at = NOW()
     WHERE id = ANY($1) AND status = 'HELD'`,
    [expiredIds]
  );

  return {
    expiredCount: expiredIds.length,
    expiredIds,
  };
}

/**
 * 6. Danh mục sách có thể đặt công khai (PRF-03 canonical schema)
 */
export async function listPublicReservationBooks(
  db: Queryable,
  params?: { search?: string; category?: string; page?: number; limit?: number; includeUnavailable?: boolean; onlyAvailable?: boolean }
): Promise<{ items: PublicReservationBookDto[]; total: number; page: number; limit: number; categories?: string[] }> {
  const page = Number.isSafeInteger(params?.page) && params!.page! > 0 ? params!.page! : 1;
  const limit = Number.isSafeInteger(params?.limit) && params!.limit! > 0 ? Math.min(100, params!.limit!) : 20;
  const search = params?.search?.trim() || '';
  const category = params?.category?.trim() || '';
  const available = `WITH matching_copies AS (
    SELECT bt.id AS title_id, bt.title, bc.barcode, bc.cover_price, be.cover_image_url,
      COALESCE(bc.status = 'AVAILABLE'
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.copy_id = bc.id AND r.status = 'HELD' AND r.expires_at > clock_timestamp())
      AND NOT EXISTS (SELECT 1 FROM loan_items li WHERE li.copy_id = bc.id AND li.returned_at IS NULL AND li.carried_forward_at IS NULL), FALSE) AS is_available
    FROM book_titles bt LEFT JOIN book_editions be ON be.title_id = bt.id
    LEFT JOIN book_copies bc ON bc.edition_id = be.id
    WHERE ($1 = '' OR bt.id::text = $1 OR unaccent(lower(bt.title)) ILIKE '%' || unaccent(lower($1)) || '%'
        OR EXISTS (SELECT 1 FROM book_title_authors bta JOIN authors a ON a.id = bta.author_id
          WHERE bta.title_id = bt.id AND unaccent(lower(a.name)) ILIKE '%' || unaccent(lower($1)) || '%'))
      AND ($2 = '' OR EXISTS (SELECT 1 FROM book_title_categories btc JOIN categories c ON c.id = btc.category_id WHERE btc.title_id = bt.id AND c.name = $2))
  ), available AS (SELECT * FROM matching_copies ${params?.includeUnavailable && !params?.onlyAvailable ? '' : 'WHERE is_available'})`;
  const count = await db.query<{ total: string }>(`${available} SELECT COUNT(DISTINCT title_id) AS total FROM available`, [search, category]);
  const rows = await db.query<any>(`${available}, chosen AS (
    SELECT DISTINCT ON (title_id) *, COUNT(*) FILTER (WHERE is_available) OVER (PARTITION BY title_id) AS available_copies_count
    FROM available ORDER BY title_id, is_available DESC, barcode NULLS LAST
  ) SELECT chosen.*,
    (SELECT string_agg(a.name, ', ' ORDER BY a.name) FROM book_title_authors bta JOIN authors a ON a.id = bta.author_id WHERE bta.title_id = chosen.title_id) AS author,
    (SELECT string_agg(c.name, ', ' ORDER BY c.name) FROM book_title_categories btc JOIN categories c ON c.id = btc.category_id WHERE btc.title_id = chosen.title_id) AS category
    FROM chosen ORDER BY title, title_id LIMIT $3 OFFSET $4`, [search, category, limit, (page - 1) * limit]);
  const categories = params?.includeUnavailable
    ? (await db.query<{ name: string }>('SELECT DISTINCT c.name FROM categories c JOIN book_title_categories btc ON btc.category_id = c.id ORDER BY c.name')).rows.map(row => row.name)
    : undefined;
  return {
    items: rows.rows.map(r => ({ titleId: r.title_id, title: r.title, author: r.author || '', category: r.category || '',
      coverPrice: r.cover_price == null ? null : Number(r.cover_price),
      coverImageUrl: r.cover_image_url || undefined, standardDeposit: Number(calculateDeposit(r.cover_price == null ? null : BigInt(r.cover_price))),
      availableCopiesCount: Number(r.available_copies_count) })),
    total: Number(count.rows[0]?.total || 0), page, limit, categories,
  };
}

/**
 * 7. Danh sách ca trực nhận sách công khai (PRF-03 canonical schema duty_schedules)
 */
export async function listPublicPickupSchedules(db: Queryable): Promise<PublicPickupScheduleDto[]> {
  const res = await db.query<any>(
    `SELECT id, schedule_date, shift_time, location, status
     FROM duty_schedules
     WHERE status = 'PUBLISHED'
       AND schedule_date >= (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
     ORDER BY schedule_date ASC, shift_time ASC`
  );

  const now = new Date();
  return res.rows
    .map((r) => {
      const shiftEnd = resolveShiftEndTime(r.schedule_date, r.shift_time);
      const isAvailable = shiftEnd.getTime() > now.getTime();
      const dateStr = typeof r.schedule_date === 'string'
        ? r.schedule_date.split('T')[0]
        : new Date(r.schedule_date).toISOString().split('T')[0];

      return {
        id: r.id,
        date: dateStr,
        timeRange: r.shift_time || '14:00 - 17:00',
        endTime: shiftEnd.toISOString(),
        location: r.location || 'Bàn trực thư viện',
        isAvailableForReservation: isAvailable,
      };
    })
    .filter((s) => s.isAvailableForReservation);
}

/**
 * 8. Danh sách đơn chờ nhận cho thành viên tại quầy trực (PRF-03 canonical schema)
 */
// Call inside the caller's transaction: reporting an incident never cancels the reader's hold.
export async function reportReservationIssue(db: Queryable, reservationId: string, actor: AuthenticatedActor, reason: unknown): Promise<void> {
  if (!actor?.isActive || actor.isAlumni || !['MEMBER', 'ADMIN'].includes(actor.role)) {
    throw new ForbiddenError('Chỉ thành viên nội bộ mới được báo sự cố.', 'FORBIDDEN');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId)) {
    throw new BadRequestError('Mã định danh đơn không hợp lệ.', 'INVALID_RESERVATION_ID');
  }
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
    throw new BadRequestError('Nhập lý do sự cố từ 1 đến 1000 ký tự.', 'INVALID_INCIDENT_REASON');
  }
  const result = await db.query<any>(`SELECT r.copy_id, r.status, r.expires_at > clock_timestamp() AS is_current,
      bc.status AS copy_status FROM reservations r JOIN book_copies bc ON bc.id = r.copy_id
      WHERE r.id = $1 FOR UPDATE OF r, bc`, [reservationId]);
  const row = result.rows[0];
  if (!row) throw new ReservationNotFoundError();
  if (row.status !== 'HELD' || !row.is_current) throw new ConflictError('Chỉ báo sự cố cho đơn đang giữ chỗ còn hiệu lực.', 'RESERVATION_NOT_HELD');
  if (row.copy_status === 'MAINTENANCE') return;
  if (row.copy_status !== 'AVAILABLE') throw new ConflictError('Bản sách đã có trạng thái cần xử lý. Hãy kiểm tra cảnh báo hiện tại.', 'COPY_UNAVAILABLE');
  const loans = await db.query('SELECT id FROM loan_items WHERE copy_id = $1 AND returned_at IS NULL AND carried_forward_at IS NULL LIMIT 1', [row.copy_id]);
  if (loans.rows.length) throw new ConflictError('Bản sách đang có khoản mượn chưa trả; cần kiểm tra trước khi đổi trạng thái.', 'COPY_UNAVAILABLE');
  await db.query(`UPDATE book_copies SET status = 'MAINTENANCE', condition_note = concat_ws(E'\\n', NULLIF(condition_note, ''), $2::text) WHERE id = $1`,
    [row.copy_id, `Sự cố giữ chỗ: ${reason.trim()}`]);
  await recordAuditLog(db, { actorId: actor.memberId || actor.userId, action: 'RESERVATION_FULFILLMENT_ISSUE', targetResource: 'book_copies', targetId: row.copy_id,
    details: { reservationId, reason: reason.trim(), previousStatus: row.copy_status, status: 'MAINTENANCE' } });
}

export async function listStaffReservations(
  db: Queryable,
  filter: ReservationFilter
): Promise<{ items: StaffReservationDto[]; total: number; page: number; limit: number; attentionCount: number }> {
  const page = Number.isSafeInteger(filter.page) && filter.page! > 0 ? filter.page! : 1;
  const limit = Number.isSafeInteger(filter.limit) && filter.limit! > 0 ? Math.min(100, filter.limit!) : 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const values: any[] = [];
  let paramIdx = 1;

  if (filter.scheduleId) {
    conditions.push(`r.schedule_id = $${paramIdx}`);
    values.push(filter.scheduleId);
    paramIdx++;
  }

  if (filter.status) {
    conditions.push(`r.status = $${paramIdx}`);
    values.push(filter.status);
    paramIdx++;
  }

  if (filter.search && filter.search.trim().length > 0) {
    conditions.push(`(
      r.phone ILIKE ('%' || $${paramIdx} || '%')
      OR unaccent(lower(r.full_name)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%')
      OR r.code ILIKE ('%' || $${paramIdx} || '%')
    )`);
    values.push(filter.search.trim());
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const issueCondition = `r.status = 'HELD' AND r.expires_at > clock_timestamp() AND
    (bc.status <> 'AVAILABLE' OR EXISTS (SELECT 1 FROM loan_items li WHERE li.copy_id = r.copy_id AND li.returned_at IS NULL AND li.carried_forward_at IS NULL))`;

  const countRes = await db.query<{ total: string; attention_count: string }>(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE ${issueCondition}) AS attention_count
     FROM reservations r JOIN book_copies bc ON bc.id = r.copy_id WHERE ${whereClause}`,
    values
  );
  const total = Number(countRes.rows[0]?.total || 0);

  const selectSql = `
    SELECT r.*, bt.title AS book_title, bc.barcode AS copy_barcode,
           (${issueCondition}) AS requires_attention,
           (SELECT string_agg(a.name, ', ' ORDER BY a.name) 
            FROM book_title_authors bta 
            JOIN authors a ON a.id = bta.author_id 
            WHERE bta.title_id = bt.id) AS author_name
    FROM reservations r
    JOIN book_titles bt ON r.title_id = bt.id
    JOIN book_copies bc ON r.copy_id = bc.id
    WHERE ${whereClause}
    ORDER BY requires_attention DESC, r.created_at DESC, r.id
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const rowsRes = await db.query<any>(selectSql, values);

  const items: StaffReservationDto[] = rowsRes.rows.map(row => ({ ...toPublicReservationDto(row), fullName: row.full_name, phone: row.phone, copyBarcode: row.copy_barcode,
    fulfillmentIssue: row.requires_attention ? 'COPY_UNAVAILABLE' : null }));
  return { items, total, page, limit, attentionCount: Number(countRes.rows[0]?.attention_count || 0) };
}
