import test from 'node:test';
import assert from 'node:assert';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  getMembersHeadcount,
  getMemberAffiliations,
  addMemberAffiliation,
  collectMembershipDues,
} from '../../src/server/members/service.ts';
import { DEPARTMENTS, DEPARTMENT_ROLES } from '../../src/server/members/types.ts';
import { ACCOUNT_CODES, FUND_IDS } from '../../src/server/finance/types.ts';

function createMockEnvironment() {
  const db = new MockCashDbQueryable();

  // Tạo 3 thành viên thử nghiệm
  db.members.push({
    id: 'mem-1',
    username: 'nguyenvana',
    full_name: 'Nguyễn Văn A',
    email: 'a@ysbk.internal',
    phone: '0901111111',
    student_id: '20230001',
    department: DEPARTMENTS.HAU_CAN,
    role: DEPARTMENT_ROLES.TRUONG_BAN,
    status: 'ACTIVE',
    school_year: 'K68',
    has_paid_fee: false,
    joined_at: '2023-09-01T00:00:00Z',
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2023-09-01T00:00:00Z',
  });

  db.members.push({
    id: 'mem-2',
    username: 'tranthib',
    full_name: 'Trần Thị B',
    email: 'b@ysbk.internal',
    phone: '0902222222',
    student_id: '20230002',
    department: DEPARTMENTS.NOI_DUNG,
    role: DEPARTMENT_ROLES.THANH_VIEN,
    status: 'ACTIVE',
    school_year: 'K68',
    has_paid_fee: true,
    joined_at: '2023-09-01T00:00:00Z',
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2023-09-01T00:00:00Z',
  });

  db.members.push({
    id: 'mem-3',
    username: 'lequangc',
    full_name: 'Lê Quang C',
    email: 'c@ysbk.internal',
    phone: '0903333333',
    student_id: '20240003',
    department: DEPARTMENTS.TTDN,
    role: DEPARTMENT_ROLES.THANH_VIEN,
    status: 'ACTIVE',
    school_year: 'K69',
    has_paid_fee: false,
    joined_at: '2024-09-01T00:00:00Z',
    created_at: '2024-09-01T00:00:00Z',
    updated_at: '2024-09-01T00:00:00Z',
  });

  // Thêm phân ban ban đầu
  db.memberAffiliations.push({
    id: 'aff-1',
    member_id: 'mem-1',
    department: DEPARTMENTS.HAU_CAN,
    role: DEPARTMENT_ROLES.TRUONG_BAN,
    term_year: '2024-2025',
    start_date: '2024-09-01',
    end_date: null,
    is_current: true,
    created_at: '2024-09-01T00:00:00Z',
  });

  db.memberAffiliations.push({
    id: 'aff-2',
    member_id: 'mem-2',
    department: DEPARTMENTS.NOI_DUNG,
    role: DEPARTMENT_ROLES.THANH_VIEN,
    term_year: '2024-2025',
    start_date: '2024-09-01',
    end_date: null,
    is_current: true,
    created_at: '2024-09-01T00:00:00Z',
  });

  db.memberAffiliations.push({
    id: 'aff-3',
    member_id: 'mem-3',
    department: DEPARTMENTS.TTDN,
    role: DEPARTMENT_ROLES.THANH_VIEN,
    term_year: '2024-2025',
    start_date: '2024-09-01',
    end_date: null,
    is_current: true,
    created_at: '2024-09-01T00:00:00Z',
  });

  return db;
}

test('Chặng 13: Thống kê Distinct Headcount khi chưa có kiêm nhiệm', async () => {
  const db = createMockEnvironment();
  const summary = await getMembersHeadcount(db);

  assert.strictEqual(summary.totalDistinctMembers, 3);
  assert.strictEqual(summary.departments.BAN_HAU_CAN, 1);
  assert.strictEqual(summary.departments.BAN_NOI_DUNG, 1);
  assert.strictEqual(summary.departments.BAN_TTDN, 1);
  assert.strictEqual(summary.departments.BAN_CHU_NHIEM, 0);
  assert.strictEqual(summary.multiDepartmentMemberCount, 0);
});

test('Chặng 13: Hỗ trợ 1 thành viên kiêm nhiệm 2 ban mà không đếm trùng tổng headcount', async () => {
  const db = createMockEnvironment();

  // Cho mem-1 kiêm nhiệm thêm Ban Chủ Nhiệm (BCN)
  await addMemberAffiliation(
    db,
    {
      memberId: 'mem-1',
      department: DEPARTMENTS.BCN,
      role: DEPARTMENT_ROLES.PHO_CHU_NHIEM,
      termYear: '2024-2025',
      startDate: '2024-10-01',
    },
    'mem-admin-01'
  );

  const summary = await getMembersHeadcount(db);
  // Tổng số người CLB vẫn là 3 (DISTINCT member_id)
  assert.strictEqual(summary.totalDistinctMembers, 3);
  // Hậu Cần = 1, BCN = 1
  assert.strictEqual(summary.departments.BAN_HAU_CAN, 1);
  assert.strictEqual(summary.departments.BAN_CHU_NHIEM, 1);
  // Số người kiêm nhiệm = 1
  assert.strictEqual(summary.multiDepartmentMemberCount, 1);
});

test('Chặng 13: Bảo toàn lịch sử chức vụ khi chuyển vai trò trong cùng ban', async () => {
  const db = createMockEnvironment();

  // mem-3 được thăng chức lên TRUONG_BAN ban TTDN, kết thúc vai trò THANH_VIEN cũ
  const newAff = await addMemberAffiliation(
    db,
    {
      memberId: 'mem-3',
      department: DEPARTMENTS.TTDN,
      role: DEPARTMENT_ROLES.TRUONG_BAN,
      termYear: '2024-2025',
      startDate: '2024-10-15',
      endPreviousForDept: true,
    },
    'mem-admin-01'
  );

  assert.strictEqual(newAff.role, DEPARTMENT_ROLES.TRUONG_BAN);
  assert.strictEqual(newAff.isCurrent, true);

  const history = await getMemberAffiliations(db, 'mem-3');
  assert.strictEqual(history.length, 2);

  const oldAff = history.find((a) => a.id === 'aff-3');
  assert.strictEqual(oldAff?.isCurrent, false);
  assert.strictEqual(oldAff?.endDate, '2024-10-15');
});

test('Chặng 13: Thu hội phí tiền mặt thành công, cập nhật has_paid_fee và tăng float ca trực', async () => {
  const db = createMockEnvironment();

  // Mở 1 ca trực tiền mặt
  db.cashSessions.push({
    id: 'sess-today',
    session_date: '2026-10-19',
    opened_by: 'mem-admin-01',
    opened_at: '2026-10-19T08:00:00.000Z',
    opening_cash: '500000',
    expected_closing_cash: '500000',
    actual_closing_cash: null,
    is_closed: false,
  });

  const receipt = await collectMembershipDues(
    db,
    {
      memberId: 'mem-1',
      amount: 100000,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'sess-today',
      termLabel: 'Hội phí kết nạp K68',
    },
    'mem-admin-01'
  );

  assert.strictEqual(receipt.amount, 100000);
  assert.strictEqual(receipt.memberId, 'mem-1');
  assert.strictEqual(receipt.paymentMethod, 'CASH');

  // Member đã được đánh dấu has_paid_fee = true
  const updatedMember = db.members.find((m) => m.id === 'mem-1');
  assert.strictEqual(updatedMember?.has_paid_fee, true);

  // P22-05: Két tiền ca trực LOAN KHÔNG được tăng, giữ nguyên 500k để tránh lệch ledger
  const sessionAfter = db.cashSessions.find((s) => s.id === 'sess-today');
  assert.strictEqual(Number(sessionAfter?.expected_closing_cash), 500000);

  // Bút toán kép: Có TK 511-FEE (Doanh thu hội phí), Nợ TK 111-CASH (Hộp quầy), Quỹ Hoạt Động
  const duesJournal = db.journalEntries.find((j: any) => j.entry_code.startsWith('JE-DUES-'));
  assert.ok(duesJournal, 'Phải tìm thấy bút toán JE-DUES-');
  assert.strictEqual(duesJournal.fund_id, FUND_IDS.OPERATION);
  assert.strictEqual(duesJournal.debit_account, ACCOUNT_CODES.CASH_DRAWER);
  assert.strictEqual(duesJournal.credit_account, ACCOUNT_CODES.MEMBER_FEE);
  assert.strictEqual(Number(duesJournal.amount), 100000);
});

test('Regression P22-05: Mở két LOAN 200k, thu hội phí 100k: két LOAN và summary vẫn 200k; OPERATION tăng 100k', async () => {
  const db = createMockEnvironment();

  db.cashSessions.push({
    id: 'sess-loan-200k',
    session_date: '2026-10-19',
    opened_by: 'mem-admin-01',
    opened_at: '2026-10-19T08:00:00.000Z',
    opening_cash: '200000',
    expected_closing_cash: '200000',
    actual_closing_cash: null,
    is_closed: false,
  });

  const receipt = await collectMembershipDues(
    db,
    {
      memberId: 'mem-1',
      amount: 100000,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'sess-loan-200k',
      termLabel: 'Khóa K68 - Năm 2026',
    },
    'mem-admin-01'
  );

  assert.strictEqual(receipt.amount, 100000);

  // 1. Két LOAN vẫn giữ nguyên 200k
  const session = db.cashSessions.find((s) => s.id === 'sess-loan-200k');
  assert.strictEqual(Number(session?.expected_closing_cash), 200000);

  // 2. Quỹ OPERATION tăng 100k qua journal entry
  const opEntries = db.journalEntries.filter((j: any) => j.fund_id === FUND_IDS.OPERATION);
  assert.strictEqual(opEntries.length, 1);
  assert.strictEqual(Number(opEntries[0].amount), 100000);
  assert.strictEqual(opEntries[0].debit_account, ACCOUNT_CODES.CASH_DRAWER);
  assert.strictEqual(opEntries[0].credit_account, ACCOUNT_CODES.MEMBER_FEE);
});

test('Chặng 13: Từ chối thu hội phí lần 2 với HTTP 409 DUPLICATE_MEMBERSHIP_FEE_COLLECTION', async () => {
  const db = createMockEnvironment();

  // mem-2 đã có has_paid_fee = true
  await assert.rejects(
    async () => {
      await collectMembershipDues(
        db,
        {
          memberId: 'mem-2',
          amount: 100000,
          paymentMethod: 'BANK_TRANSFER',
          paymentConfirmed: true,
        },
        'mem-admin-01'
      );
    },
    (err: any) => {
      assert.strictEqual(err.statusCode || err.status, 409);
      assert.strictEqual(err.errorCode || err.code, 'DUPLICATE_MEMBERSHIP_FEE_COLLECTION');
      return true;
    }
  );
});

test('Chặng 13: Từ chối thu hội phí khi chưa xác nhận kiểm đếm tiền thực tế', async () => {
  const db = createMockEnvironment();

  await assert.rejects(
    async () => {
      await collectMembershipDues(
        db,
        {
          memberId: 'mem-3',
          amount: 100000,
          paymentMethod: 'CASH',
          paymentConfirmed: false,
        },
        'mem-admin-01'
      );
    },
    (err: any) => {
      assert.strictEqual(err.statusCode || err.status, 400);
      assert.strictEqual(err.errorCode || err.code, 'PAYMENT_CONFIRMATION_REQUIRED');
      return true;
    }
  );
});

test('Chặng 13: Tái phát idempotency trả về biên nhận ban đầu mà không sinh thêm bút toán', async () => {
  const db = createMockEnvironment();
  const idempotencyKey = 'idem-dues-test-key-01';

  const res1 = await collectMembershipDues(
    db,
    {
      memberId: 'mem-3',
      amount: 100000,
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
      idempotencyKey,
    },
    'mem-admin-01'
  );

  const journalCountBefore = db.journalEntries.length;

  // Gọi lại với cùng key
  const res2 = await collectMembershipDues(
    db,
    {
      memberId: 'mem-3',
      amount: 100000,
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
      idempotencyKey,
    },
    'mem-admin-01'
  );

  assert.strictEqual(res2.id, res1.id);
  assert.strictEqual(db.journalEntries.length, journalCountBefore);
});
