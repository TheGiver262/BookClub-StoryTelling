/**
 * YSBK Unit Tests - Reservation Rules & Quota Matrix (LIM-01...LIM-13)
 * Tuân thủ thiết kế: docs/technical/public-reservation-design.md
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  normalizePhone,
  normalizeIpAddress,
  hashIpAddress,
  calculateIpRollingQuota,
  calculatePhoneQuota,
} from '../../src/server/reservations/rules.ts';

test('LIM-01: Một SĐT đặt 3 đơn từ các IP khác nhau -> Đơn thứ tư bị chặn theo SĐT', () => {
  // 3 đơn đang HELD từ 3 IP khác nhau
  const phoneQuota = calculatePhoneQuota(3, 0);
  assert.equal(phoneQuota.usedCount, 3);
  assert.equal(phoneQuota.remainingCount, 0);
  assert.equal(phoneQuota.isBlocked, true, 'Đơn thứ tư của cùng SĐT phải bị chặn');
});

test('LIM-02: Nhiều SĐT tạo tổng 3 đơn từ một IP -> Đơn thứ tư bị chặn theo IP', () => {
  const now = new Date('2026-10-20T14:00:00Z');
  const timestamps = [
    new Date('2026-10-20T08:00:00Z'), // Đơn 1 (SĐT A)
    new Date('2026-10-20T10:00:00Z'), // Đơn 2 (SĐT B)
    new Date('2026-10-20T12:00:00Z'), // Đơn 3 (SĐT C)
  ];
  const ipQuota = calculateIpRollingQuota(timestamps, now);
  assert.equal(ipQuota.usedCount, 3);
  assert.equal(ipQuota.remainingCount, 0);
  assert.equal(ipQuota.isBlocked, true, 'Đơn thứ tư từ cùng IP phải bị chặn dù SĐT khác nhau');
});

test('LIM-03: Cùng SĐT với 0, +84, 84 và ký tự phân cách hợp lệ quy về cùng một hạn mức', () => {
  const p1 = normalizePhone('0912345678');
  const p2 = normalizePhone('+84912345678');
  const p3 = normalizePhone('84912345678');
  const p4 = normalizePhone('0912.345.678');
  const p5 = normalizePhone('0912-345-678');
  const p6 = normalizePhone('(0912) 345 678');

  assert.equal(p1, '0912345678');
  assert.equal(p2, '0912345678');
  assert.equal(p3, '0912345678');
  assert.equal(p4, '0912345678');
  assert.equal(p5, '0912345678');
  assert.equal(p6, '0912345678');
});

test('LIM-04: Hai hồ sơ bạn đọc chung SĐT cộng chung suất, không tách riêng', () => {
  // Hồ sơ 1 mượn 2 cuốn, hồ sơ 2 mượn 1 cuốn
  const quota = calculatePhoneQuota(0, 2 + 1);
  assert.equal(quota.usedCount, 3);
  assert.equal(quota.isBlocked, true, 'Tổng số sách chưa trả qua các hồ sơ cùng SĐT là 3 -> Bị chặn');
});

test('LIM-05: Xóa cookie, đổi trình duyệt, đổi IP không khôi phục suất của cùng SĐT', () => {
  // Trạng thái lưu trên server: SĐT đang có 2 HELD + 1 BORROWED
  const quota = calculatePhoneQuota(2, 1);
  assert.equal(quota.usedCount, 3);
  assert.equal(quota.remainingCount, 0);
  assert.equal(quota.isBlocked, true);
});

test('LIM-06: Nhận 3 sách đã giữ -> Vẫn 3 suất, không thành 0 hoặc 6', () => {
  // Trước khi nhận: 3 HELD, 0 BORROWED -> 3 suất
  const before = calculatePhoneQuota(3, 0);
  assert.equal(before.usedCount, 3);

  // Sau khi nhận bàn giao: 0 HELD, 3 BORROWED -> Vẫn 3 suất
  const after = calculatePhoneQuota(0, 3);
  assert.equal(after.usedCount, 3);
  assert.equal(after.remainingCount, 0);
  assert.equal(after.isBlocked, true);
});

test('LIM-07: Trả 1 trong 3 sách -> Còn 2 suất dùng, được đặt thêm 1', () => {
  // Trả 1 cuốn: 0 HELD, 2 BORROWED -> 2 suất dùng, 1 suất còn lại
  const quota = calculatePhoneQuota(0, 2);
  assert.equal(quota.usedCount, 2);
  assert.equal(quota.remainingCount, 1);
  assert.equal(quota.isBlocked, false);
});

test('LIM-08: Trả 1 sách ngay sau khi IP đã tạo đủ 3 đơn/24 giờ -> SĐT có suất nhưng đơn mới vẫn bị chặn theo IP', () => {
  const now = new Date('2026-10-20T15:00:00Z');
  // IP đã tạo 3 đơn lúc 09:00, 10:00, 11:00
  const ipTimestamps = [
    new Date('2026-10-20T09:00:00Z'),
    new Date('2026-10-20T10:00:00Z'),
    new Date('2026-10-20T11:00:00Z'),
  ];
  // Khách trả 1 sách lúc 15:00 -> SĐT còn 2 suất
  const phoneQuota = calculatePhoneQuota(0, 2);
  assert.equal(phoneQuota.isBlocked, false, 'SĐT còn 1 suất');

  // Nhưng IP vẫn có 3 đơn trong cửa sổ 24h
  const ipQuota = calculateIpRollingQuota(ipTimestamps, now);
  assert.equal(ipQuota.isBlocked, true, 'IP vẫn đủ 3 đơn trong 24h -> Chặn đơn mới');
});

test('LIM-09: Hủy hoặc hết hạn đơn trong cửa sổ 24 giờ -> Mở suất SĐT nhưng không mở lượt IP', () => {
  const now = new Date('2026-10-20T16:00:00Z');
  const ipTimestamps = [
    new Date('2026-10-20T13:00:00Z'), // Đơn này bị HỦY lúc 15:00
    new Date('2026-10-20T14:00:00Z'), // Đơn này bị HẾT HẠN lúc 15:30
    new Date('2026-10-20T15:00:00Z'), // Đơn đang HELD
  ];
  // SĐT đã được mở lại 2 suất (chỉ còn 1 HELD)
  const phoneQuota = calculatePhoneQuota(1, 0);
  assert.equal(phoneQuota.remainingCount, 2, 'SĐT có 2 suất trống');

  // Lượt IP vẫn tính cả 3 đơn đã tạo thành công trong 24h (không xóa lịch sử IP khi hủy/hết hạn)
  const ipQuota = calculateIpRollingQuota(ipTimestamps, now);
  assert.equal(ipQuota.isBlocked, true, 'Lượt IP không được hoàn lại khi hủy hoặc hết hạn');
});

test('LIM-10: Cửa sổ 24 giờ trượt: mốc 02:00, 03:00, 04:00; xét ranh giới ms và qua 0h', () => {
  // Tạo lúc 02:00:00Z, 03:00:00Z, 04:00:00Z ngày 20/10
  const timestamps = [
    new Date('2026-10-20T02:00:00.000Z'),
    new Date('2026-10-20T03:00:00.000Z'),
    new Date('2026-10-20T04:00:00.000Z'),
  ];

  // 1. Xét lúc 00:01:00Z ngày 21/10 (đã qua 0h ngày mới): KHÔNG reset, vẫn tính đủ 3 đơn
  const afterMidnight = calculateIpRollingQuota(timestamps, new Date('2026-10-21T00:01:00.000Z'));
  assert.equal(afterMidnight.isBlocked, true, 'Qua 0h không reset bộ đếm');

  // 2. Xét lúc 01:59:59.999Z ngày 21/10 (còn thiếu 1ms nữa mới đủ 24h của đơn đầu tiên): VẪN CHẶN
  const justBeforeBoundary = calculateIpRollingQuota(timestamps, new Date('2026-10-21T01:59:59.999Z'));
  assert.equal(justBeforeBoundary.usedCount, 3);
  assert.equal(justBeforeBoundary.isBlocked, true, '01:59:59.999Z vẫn chặn');

  // 3. Xét lúc đúng 02:00:00.000Z ngày 21/10: Đơn đầu tiên vừa đủ 24h -> Rơi ra khỏi cửa sổ -> Mở đúng 1 lượt!
  const atBoundary = calculateIpRollingQuota(timestamps, new Date('2026-10-21T02:00:00.000Z'));
  assert.equal(atBoundary.usedCount, 2, 'Đơn đầu ra khỏi cửa sổ (tMs <= now - 24h)');
  assert.equal(atBoundary.remainingCount, 1);
  assert.equal(atBoundary.isBlocked, false, 'Mở đúng 1 lượt');
});

test('LIM-11: Chuẩn hóa IP và băm HMAC có version', () => {
  const ip1 = normalizeIpAddress('127.0.0.1');
  const ip2 = normalizeIpAddress('::ffff:127.0.0.1');
  const ip3 = normalizeIpAddress(' [127.0.0.1] ');
  const ip4 = normalizeIpAddress('::1');

  assert.equal(ip1, '127.0.0.1');
  assert.equal(ip2, '127.0.0.1');
  assert.equal(ip3, '127.0.0.1');
  assert.equal(ip4, '127.0.0.1');

  const hash1 = hashIpAddress('127.0.0.1', 'synthetic-ip-secret-for-unit-tests-2026');
  const hash2 = hashIpAddress('::ffff:127.0.0.1', 'synthetic-ip-secret-for-unit-tests-2026');
  assert.equal(hash1, hash2, 'Biểu diễn tương đương của IP phải sinh ra cùng hash');
  assert.ok(hash1.startsWith('v1:'), 'Hash phải có version prefix');
});

test('LIM-12: Sẵn có >= 3 sách chưa trả (gồm mượn tại quầy) -> Không cho đặt mới', () => {
  const quota = calculatePhoneQuota(0, 4);
  assert.equal(quota.usedCount, 4);
  assert.equal(quota.remainingCount, 0);
  assert.equal(quota.isBlocked, true);
});

test('LIM-13: Gia hạn / chuyển tiếp phiếu: cùng bản sách không bị cộng đôi suất', () => {
  // Phiếu cũ PARTIAL_SETTLED và phiếu mới ACTIVE trên cùng 1 cuốn chỉ tính 1 nghĩa vụ
  const uniqueUnreturnedBookCopies = 1; // Đếm theo số bản sách vật lý chưa trả
  const quota = calculatePhoneQuota(1, uniqueUnreturnedBookCopies);
  assert.equal(quota.usedCount, 2);
  assert.equal(quota.remainingCount, 1);
  assert.equal(quota.isBlocked, false);
});
