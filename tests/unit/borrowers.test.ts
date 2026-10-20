import test from 'node:test';
import assert from 'node:assert';
import {
  normalizePhone,
  maskPhone,
} from '../../src/server/borrowers/rules.ts';
import {
  createBorrower,
  archiveBorrower,
} from '../../src/server/borrowers/service.ts';
import { MockCashDbQueryable } from './mock-db-helper.ts';

test('G-borrower 1: Phone normalization and validation for Vietnam mobile networks', () => {
  // 1. Chuẩn hóa các định dạng hiển thị thông thường
  assert.strictEqual(normalizePhone('0912345678'), '0912345678');
  assert.strictEqual(normalizePhone('091 234 5678'), '0912345678');
  assert.strictEqual(normalizePhone('091-234-5678'), '0912345678');
  assert.strictEqual(normalizePhone('091.234.5678'), '0912345678');
  assert.strictEqual(normalizePhone('(091) 234-5678'), '0912345678');

  // 2. Định dạng quốc tế +84 / 84
  assert.strictEqual(normalizePhone('+84912345678'), '0912345678');
  assert.strictEqual(normalizePhone('84912345678'), '0912345678');
  assert.strictEqual(normalizePhone('+84 38 123 4567'), '0381234567');

  // 3. Số không đúng định dạng di động Việt Nam bị từ chối
  assert.throws(() => normalizePhone(''), /không được để trống/);
  assert.throws(() => normalizePhone('123456'), /không đúng định dạng di động Việt Nam/);
  assert.throws(() => normalizePhone('0123456789'), /không đúng định dạng di động Việt Nam/); // Đầu số bàn cũ 012
  assert.throws(() => normalizePhone('02438691234'), /không đúng định dạng di động Việt Nam/); // Số cố định Hà Nội 11 số
});

test('G-borrower 2: Community member without student ID or school (NULL values allowed)', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Người dân sống gần trường ĐHBK mượn sách: Không có MSSV, không có trường
  const citizen = await createBorrower(
    db,
    {
      fullName: 'Bác Nguyễn Văn Dân',
      phone: '0988112233',
      studentId: null,
      school: null,
      notes: 'Người dân ngõ 30 Tạ Quang Bửu',
    },
    actorId
  );

  assert.strictEqual(citizen.fullName, 'Bác Nguyễn Văn Dân');
  assert.strictEqual(citizen.phone, '0988112233');
  assert.strictEqual(citizen.studentId, null);
  assert.strictEqual(citizen.school, null);
  assert.strictEqual(citizen.notes, 'Người dân ngõ 30 Tạ Quang Bửu');
  assert.strictEqual(citizen.isArchived, false);
});

test('G-borrower 3: Two distinct borrowers sharing phone number have distinct IDs (No auto-merge)', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Hai phụ huynh hoặc hai anh em mượn sách dùng chung một số điện thoại gia đình
  const brother1 = await createBorrower(
    db,
    {
      fullName: 'Trần Văn Anh',
      phone: '0912999888',
      studentId: '20201111',
      school: 'Đại học Bách Khoa Hà Nội',
    },
    actorId
  );

  const brother2 = await createBorrower(
    db,
    {
      fullName: 'Trần Văn Em',
      phone: '0912999888', // Chung số điện thoại
      studentId: null,
      school: 'THPT Thăng Long',
    },
    actorId
  );

  // Invariant: Tuyệt đối không auto-merge gộp người dùng, mỗi người một ID UUID riêng
  assert.notStrictEqual(brother1.id, brother2.id);
  assert.strictEqual(brother1.fullName, 'Trần Văn Anh');
  assert.strictEqual(brother2.fullName, 'Trần Văn Em');
  assert.strictEqual(brother1.phone, brother2.phone);
});

test('G-borrower 4: Active loans block borrower archive', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  const borrower = await createBorrower(
    db,
    {
      fullName: 'Lê Thị Thu',
      phone: '0977665544',
      studentId: '20212222',
      school: 'ĐHBK Hà Nội',
    },
    actorId
  );

  // Giả lập borrower đang có phiếu mượn ACTIVE
  db.loanReceipts.push({
    id: 'loan-receipt-001',
    borrower_id: borrower.id,
    status: 'ACTIVE',
  });

  // 1. Thử lưu trữ khi đang có sách mượn -> Bị từ chối
  await assert.rejects(
    () => archiveBorrower(db, borrower.id, actorId),
    /Không thể lưu trữ hồ sơ người mượn đang có phiếu mượn sách chưa hoàn tất/
  );

  // 2. Khi phiếu mượn đã hoàn tất (RETURNED) -> Lưu trữ thành công
  db.loanReceipts[0].status = 'RETURNED';
  const archived = await archiveBorrower(db, borrower.id, actorId);
  assert.strictEqual(archived.isArchived, true);
});

test('G-borrower 5: Phone masking protects PII in logs', () => {
  assert.strictEqual(maskPhone('0912345678'), '091****678');
  assert.strictEqual(maskPhone('0388999111'), '038****111');
  assert.strictEqual(maskPhone('123'), '***');
});
