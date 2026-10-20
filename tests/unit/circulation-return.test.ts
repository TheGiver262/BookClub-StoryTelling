import test from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  issueLoanReceipt,
  settleReturnReceipt,
  confirmRefund,
} from '../../src/server/circulation/service.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import type { AuthenticatedActor, Env } from '../../src/server/types.ts';
import { ACCOUNT_CODES } from '../../src/server/finance/types.ts';

const TEST_SECRET = 'unit_test_jwt_secret_min_32_characters_long_12345';
const TEST_ENV: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: TEST_SECRET,
};

const createFixtures = (db: MockCashDbQueryable = new MockCashDbQueryable()) => ({
  membersDb: {
    '00000000-0000-0000-0000-000000000001': {
      id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Nguyễn Tiến Dũng',
      username: 'member.test',
      team: 'BAN_CHU_NHIEM',
      is_eligible_main_duty: true,
      has_paid_fee: true,
      is_alumni: false,
      is_admin: true,
      is_active: true,
      token_version: 1,
    },
    '00000000-0000-0000-0000-000000000002': {
      id: '00000000-0000-0000-0000-000000000002',
      full_name: 'Nguyễn Thị Ánh',
      username: 'thanhvien.chuan',
      team: 'HAU_CAN',
      is_eligible_main_duty: true,
      has_paid_fee: true,
      is_alumni: false,
      is_admin: false,
      is_active: true,
      token_version: 1,
    },
    '00000000-0000-0000-0000-000000000005': {
      id: '00000000-0000-0000-0000-000000000005',
      full_name: 'Trần Văn Thắng',
      username: 'cuu.thanhvien',
      team: 'HAU_CAN',
      is_eligible_main_duty: false,
      has_paid_fee: true,
      is_alumni: true,
      is_admin: false,
      is_active: true,
      token_version: 1,
    },
  },
  revokedTokenHashes: new Set<string>(),
  queryable: db,
});

function seedDbWithBaseData(db: MockCashDbQueryable) {
  // 1. Session đang mở hôm nay
  db.cashSessions.push({
    id: 'CS-20261019-01',
    session_date: '2026-10-19',
    opened_by: '00000000-0000-0000-0000-000000000001',
    opened_at: new Date().toISOString(),
    opening_cash: '500000',
    expected_closing_cash: '500000',
    actual_closing_cash: null,
    discrepancy: null,
    discrepancy_reason: null,
    is_closed: false,
    closed_at: null,
    closed_by: null,
    handed_over_from_session_id: null,
  });

  // 2. Borrower hoạt động
  db.borrowers.push({
    id: 'bor-001',
    full_name: 'Nguyễn Văn An',
    phone: '0988776655',
    student_id: '20220001',
    school: 'ĐHBK Hà Nội',
    is_archived: false,
  });

  // 3. Title & Edition
  db.bookTitles.push({
    id: 'title-01',
    title: 'Giải Tích 1',
  });
  db.bookEditions.push({
    id: 'ed-01',
    title_id: 'title-01',
    publisher: 'NXB Bách Khoa',
  });

  // 4. Bản sách
  db.bookCopies.push(
    {
      id: 'copy-01',
      edition_id: 'ed-01',
      barcode: 'BK-50K-01',
      location: 'KỆ-A1',
      status: 'AVAILABLE',
      cover_price: '50000',
    },
    {
      id: 'copy-02',
      edition_id: 'ed-01',
      barcode: 'BK-75K-01',
      location: 'KỆ-A2',
      status: 'AVAILABLE',
      cover_price: '75000',
    },
    {
      id: 'copy-03',
      edition_id: 'ed-01',
      barcode: 'BK-150K-01',
      location: 'KỆ-A3',
      status: 'AVAILABLE',
      cover_price: '150000',
    }
  );
}

test('G-return-domain 1: Full return 1 book and 2 books; updates inventory and receipt status', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn: BK-50K-01 (cọc 50k) và BK-75K-01 (cọc 100k) -> tổng cọc 150k
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01', 'BK-75K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 150000,
    },
    actorId
  );
  assert.equal(loan.items.length, 2);
  assert.equal(loan.totalDeposit, 150000);

  // Tất toán trả toàn bộ (Full Return)
  const settleResult = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01', 'BK-75K-01'],
      paymentConfirmed: true,
      refundMethod: 'CASH',
    },
    actorId
  );

  assert.equal(settleResult.status, 'RETURNED');
  assert.equal(settleResult.returnedItemsCount, 2);
  assert.equal(settleResult.depositRefunded, 150000);
  assert.equal(settleResult.depositForfeited, 0);
  assert.equal(settleResult.refundIntents.length, 2);

  // Kiểm tra trạng thái sách chuyển về AVAILABLE
  const c1 = db.bookCopies.find((c) => c.barcode === 'BK-50K-01');
  const c2 = db.bookCopies.find((c) => c.barcode === 'BK-75K-01');
  assert.equal(c1?.status, 'AVAILABLE');
  assert.equal(c2?.status, 'AVAILABLE');

  // Kiểm tra receipt status
  const r = db.loanReceipts.find((lr) => lr.id === loan.id);
  assert.equal(r?.status, 'RETURNED');
});

test('G-return-domain 2: Rejects partial return in Stage 08 with explicit code and message', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01', 'BK-75K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Chỉ gửi trả 1 cuốn BK-50K-01
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnedBarcodes: ['BK-50K-01'],
          paymentConfirmed: true,
        },
        actorId
      ),
    /Chặng 08 chỉ hỗ trợ trả toàn bộ phiếu \(Full Return\)/
  );

  // Gửi mã vạch không thuộc phiếu mượn
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnedBarcodes: ['BK-150K-01'],
          paymentConfirmed: true,
        },
        actorId
      ),
    /không thuộc danh sách sách đang mượn/
  );
});

test('G-return-domain 3: Double settle on already RETURNED receipt is rejected with 409 conflict', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Lần 1: Tất toán thành công
  await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01'],
      paymentConfirmed: true,
    },
    actorId
  );

  // Lần 2: Tất toán lại cùng phiếu đã trả -> 409 conflict
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnedBarcodes: ['BK-50K-01'],
          paymentConfirmed: true,
        },
        actorId
      ),
    /đã ở trạng thái RETURNED, không thể tất toán lại/
  );
});

test('G-fine 1: Case P = 0 (On-time return) -> full deposit refund intent, zero fine collected', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  const res = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01'],
      paymentConfirmed: true,
      refundMethod: 'CASH',
    },
    actorId
  );

  assert.equal(res.overdueDays, 0);
  assert.equal(res.fineSuggested, 0);
  assert.equal(res.fineFinal, 0);
  assert.equal(res.depositRefunded, 50000);
  assert.equal(res.depositForfeited, 0);
  assert.equal(res.directFineCollected, 0);
  assert.equal(res.refundIntents.length, 1);
  assert.equal(res.refundIntents[0].amount, 50000);
  assert.equal(res.refundIntents[0].status, 'PENDING');
});

test('G-fine 2: Case 0 < P < D (D = 50k, P = 49k) -> refund 50k and collect fine 49k separately', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Giả lập phiếu quá hạn: Client chốt phạt 49.000₫ kèm lý do điều chỉnh hợp lệ
  const res = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01'],
      fineAmount: 49000,
      fineReason: 'Quá hạn 49 ngày theo thỏa thuận với bạn đọc',
      paymentConfirmed: true,
      refundMethod: 'CASH',
    },
    actorId
  );

  assert.equal(res.fineFinal, 49000);
  assert.equal(res.depositRefunded, 50000); // Hoàn đủ cọc 50k
  assert.equal(res.directFineCollected, 49000); // Thu phạt riêng 49k
  assert.equal(res.depositForfeited, 0);
  assert.equal(res.refundIntents.length, 1);
  assert.equal(res.refundIntents[0].amount, 50000);

  // Sổ cái có bút toán thu phạt riêng: Nợ TIEN_MAT_HOP 49k / Có THU_PHAT 49k
  const fineEntry = db.journalEntries.find((e) => e.credit_account === ACCOUNT_CODES.FINE_REVENUE);
  assert.ok(fineEntry);
  assert.equal(fineEntry.amount, '49000');
  assert.equal(fineEntry.debit_account, ACCOUNT_CODES.CASH_DRAWER);
});

test('G-fine 3: Case 0 < P < D (D = 150k, P = 60k) -> refund 150k and collect fine 60k separately', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn cọc 50k + 100k = 150k
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01', 'BK-75K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  const res = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01', 'BK-75K-01'],
      fineAmount: 60000,
      fineReason: 'Quá hạn 60 ngày trên toàn phiếu',
      paymentConfirmed: true,
      refundMethod: 'CASH',
    },
    actorId
  );

  assert.equal(res.fineFinal, 60000);
  assert.equal(res.depositRefunded, 150000); // Hoàn đủ 150k
  assert.equal(res.directFineCollected, 60000); // Thu phạt 60k riêng
  assert.equal(res.depositForfeited, 0);
  assert.equal(res.refundIntents.length, 2);
  const totalIntentAmount = res.refundIntents.reduce((sum, it) => sum + it.amount, 0);
  assert.equal(totalIntentAmount, 150000);
});

test('G-fine 4: Case P >= D (D = 50k, P = 50k/60k/80k) -> Forfeit full deposit 50k, no refund, NO extra charge', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Giả lập mức phạt vượt cọc: P = 80.000₫ trong khi D = 50.000₫
  const res = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01'],
      fineAmount: 80000,
      fineReason: 'Quá hạn 80 ngày vượt số tiền cọc',
      paymentConfirmed: true,
    },
    actorId
  );

  // Giữ đúng D = 50k làm phạt, không hoàn cọc và không thu thêm 30k
  assert.equal(res.fineFinal, 80000);
  assert.equal(res.totalDeposit, 50000);
  assert.equal(res.depositForfeited, 50000);
  assert.equal(res.depositRefunded, 0);
  assert.equal(res.directFineCollected, 0); // Tuyệt đối không thu thêm 30k
  assert.equal(res.refundIntents.length, 0); // Không tạo refund intent

  // Bút toán sổ cái: Nợ COC_PHAI_HOAN 50k / Có THU_PHAT 50k (không tăng CASH/BANK!)
  const forfeitEntry = db.journalEntries.find((e) => e.source_type === 'LOAN_FINE_FORFEIT');
  assert.ok(forfeitEntry);
  assert.equal(forfeitEntry.amount, '50000');
  assert.equal(forfeitEntry.debit_account, ACCOUNT_CODES.DEPOSIT_LIABILITY);
  assert.equal(forfeitEntry.credit_account, ACCOUNT_CODES.FINE_REVENUE);
});

test('G-fine 5: Missing fineReason when fine differs from suggested fine throws FineReasonRequiredError', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Không quá hạn (suggested = 0), nhưng truyền fineAmount = 20000 mà không có fineReason
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnedBarcodes: ['BK-50K-01'],
          fineAmount: 20000,
          paymentConfirmed: true,
        },
        actorId
      ),
    /Bắt buộc cung cấp lý do điều chỉnh khi mức phạt khác mức phạt gợi ý/
  );
});

test('G-refund-pending: T12 - Return books today, refund pending confirmed in later session', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Ca 1: Cho mượn và nhận cọc 50k
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Ca 1: Trả sách, cọc ở trạng thái PENDING
  const returnRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BK-50K-01'],
      paymentConfirmed: true,
      refundMethod: 'CASH',
    },
    actorId
  );
  assert.equal(returnRes.refundIntents[0].status, 'PENDING');
  const intentId = returnRes.refundIntents[0].id;

  // Đóng ca 1
  const s1 = db.cashSessions.find((s) => s.id === 'CS-20261019-01')!;
  s1.is_closed = true;
  s1.closed_at = new Date().toISOString();

  // Mở ca 2 vào ngày tiếp theo
  db.cashSessions.push({
    id: 'CS-20261020-01',
    session_date: '2026-10-20',
    opened_by: actorId,
    opened_at: new Date().toISOString(),
    opening_cash: '600000',
    expected_closing_cash: '600000',
    actual_closing_cash: null,
    discrepancy: null,
    discrepancy_reason: null,
    is_closed: false,
    closed_at: null,
    closed_by: null,
    handed_over_from_session_id: 'CS-20261019-01',
  });

  // Ca 2: Xác nhận hoàn tiền cọc 50k
  const confirmRes = await confirmRefund(
    db,
    {
      refundIntentId: intentId,
      paymentConfirmed: true,
    },
    actorId
  );

  assert.equal(confirmRes.status, 'CONFIRMED');
  assert.equal(confirmRes.amount, 50000);
  assert.equal(confirmRes.cashSessionId, 'CS-20261020-01'); // Ghi nhận ca thực chi ca 2!

  // Tiền mặt ca 2 giảm đúng 50k: 600k -> 550k
  const s2 = db.cashSessions.find((s) => s.id === 'CS-20261020-01')!;
  assert.equal(s2.expected_closing_cash, '550000');

  // Sổ cái hoàn cọc được ghi nhận tại ca 2
  const refundEntry = db.journalEntries.find((e) => e.source_id === intentId);
  assert.ok(refundEntry);
  assert.equal(refundEntry.cash_session_id, 'CS-20261020-01');
  assert.equal(refundEntry.debit_account, ACCOUNT_CODES.DEPOSIT_LIABILITY);
  assert.equal(refundEntry.credit_account, ACCOUNT_CODES.CASH_DRAWER);
});

test('G-cross-method: T33, T34, T35 - Cross-method refund & insufficient float safeguard', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // T33: Nhận cọc BANK -> Hoàn cọc CASH
  const loanBank = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
    },
    actorId
  );

  const returnBankToCash = await settleReturnReceipt(
    db,
    {
      receiptId: loanBank.id,
      returnedBarcodes: ['BK-50K-01'],
      refundMethod: 'CASH', // Yêu cầu hoàn tiền mặt
      paymentConfirmed: true,
    },
    actorId
  );
  const intent1 = returnBankToCash.refundIntents[0].id;

  const currentCashBefore = BigInt(db.cashSessions[0].expected_closing_cash);
  await confirmRefund(db, { refundIntentId: intent1, paymentConfirmed: true }, actorId);
  const currentCashAfter = BigInt(db.cashSessions[0].expected_closing_cash);
  // Hoàn tiền mặt nên expected_closing_cash của hộp tiền giảm 50k
  assert.equal(currentCashBefore - currentCashAfter, 50000n);

  // T34: Nhận cọc CASH -> Hoàn cọc BANK
  const loanCash = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  const returnCashToBank = await settleReturnReceipt(
    db,
    {
      receiptId: loanCash.id,
      returnedBarcodes: ['BK-50K-01'],
      refundMethod: 'BANK_TRANSFER', // Yêu cầu hoàn chuyển khoản
      paymentConfirmed: true,
    },
    actorId
  );
  const intent2 = returnCashToBank.refundIntents[0].id;

  const cashBeforeBankRefund = BigInt(db.cashSessions[0].expected_closing_cash);
  await confirmRefund(db, { refundIntentId: intent2, paymentConfirmed: true }, actorId);
  const cashAfterBankRefund = BigInt(db.cashSessions[0].expected_closing_cash);
  // Hoàn BANK nên hộp tiền mặt giữ nguyên!
  assert.equal(cashBeforeBankRefund, cashAfterBankRefund);

  // T35: Hộp tiền mặt không đủ tiền -> từ chối hoàn CASH, giữ pending (Fail closed)
  db.cashSessions[0].expected_closing_cash = '20000'; // Hộp chỉ còn 20k

  const loanSmall = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'BANK_TRANSFER', // Mượn bằng BANK_TRANSFER để không tăng expected_closing_cash của hộp!
      paymentConfirmed: true,
    },
    actorId
  );
  const returnSmall = await settleReturnReceipt(
    db,
    {
      receiptId: loanSmall.id,
      returnedBarcodes: ['BK-50K-01'],
      refundMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );
  const intent3 = returnSmall.refundIntents[0].id;

  // Cố xác nhận hoàn 50k tiền mặt khi hộp chỉ có 20k -> throw INSUFFICIENT_CASH_DRAWER
  await assert.rejects(
    () => confirmRefund(db, { refundIntentId: intent3, paymentConfirmed: true }, actorId),
    /không đủ tiền mặt khả dụng/
  );
  // Intent vẫn ở trạng thái PENDING an toàn
  const intentRecord = db.refundIntents.find((i) => i.id === intent3);
  assert.equal(intentRecord?.status, 'PENDING');
});

test('G-money-recovery: Idempotency replay on settle-return and confirm-refund', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const fixtures = createFixtures(db);

  // Đăng nhập làm member
  const adminActor: AuthenticatedActor = {
    userId: 'usr_admin',
    memberId: '00000000-0000-0000-0000-000000000001',
    username: 'member.test',
    email: 'admin@ysbk.vn',
    role: 'ADMIN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const token = await signSessionToken(adminActor, TEST_SECRET);

  // Lập phiếu mượn qua API
  const issueReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-ISSUE-100',
    },
    body: JSON.stringify({
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    }),
  });
  const issueRes = await handleRequest(issueReq, TEST_ENV, fixtures);
  assert.equal(issueRes.status, 201);
  const issueJson = (await issueRes.json()) as any;
  const loanId = issueJson.data.id;

  // 1. Settle return qua API với Idempotency Key
  const returnReq1 = new Request(`http://localhost/api/v1/circulation/loans/${loanId}/settle-return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-RETURN-100',
    },
    body: JSON.stringify({
      returnedBarcodes: ['BK-50K-01'],
      paymentConfirmed: true,
      refundMethod: 'CASH',
    }),
  });
  const returnRes1 = await handleRequest(returnReq1, TEST_ENV, fixtures);
  assert.equal(returnRes1.status, 200);
  const returnJson1 = (await returnRes1.json()) as any;
  assert.equal(returnJson1.data.status, 'RETURNED');
  const intentId = returnJson1.data.refundIntents[0].id;

  // Replay cùng idempotency key -> trả kết quả cached 200, không lỗi 409
  const returnReq2 = new Request(`http://localhost/api/v1/circulation/loans/${loanId}/settle-return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-RETURN-100',
    },
    body: JSON.stringify({
      returnedBarcodes: ['BK-50K-01'],
      paymentConfirmed: true,
      refundMethod: 'CASH',
    }),
  });
  const returnRes2 = await handleRequest(returnReq2, TEST_ENV, fixtures);
  assert.equal(returnRes2.status, 200);
  const returnJson2 = (await returnRes2.json()) as any;
  assert.equal(returnJson2.data.receiptId, loanId);

  // 2. Confirm refund qua API với Idempotency Key
  const confirmReq1 = new Request(`http://localhost/api/v1/finance/refunds/${intentId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-CONFIRM-100',
    },
    body: JSON.stringify({
      paymentConfirmed: true,
    }),
  });
  const confirmRes1 = await handleRequest(confirmReq1, TEST_ENV, fixtures);
  assert.equal(confirmRes1.status, 200);
  const confirmJson1 = (await confirmRes1.json()) as any;
  assert.equal(confirmJson1.data.status, 'CONFIRMED');

  // Replay cùng idempotency key -> trả kết quả cached 200
  const confirmReq2 = new Request(`http://localhost/api/v1/finance/refunds/${intentId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-CONFIRM-100',
    },
    body: JSON.stringify({
      paymentConfirmed: true,
    }),
  });
  const confirmRes2 = await handleRequest(confirmReq2, TEST_ENV, fixtures);
  assert.equal(confirmRes2.status, 200);

  // Khác idempotency key trên intent đã confirm -> trả lỗi 409 conflict
  const confirmReq3 = new Request(`http://localhost/api/v1/finance/refunds/${intentId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-CONFIRM-DIFFERENT',
    },
    body: JSON.stringify({
      paymentConfirmed: true,
    }),
  });
  const confirmRes3 = await handleRequest(confirmReq3, TEST_ENV, fixtures);
  assert.equal(confirmRes3.status, 409);
});

test('G-auth-contract: RBAC barriers and Cache-Control headers for return and refund endpoints', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const fixtures = createFixtures(db);

  // 1. Chưa đăng nhập (Anonymous) -> 401
  const anonReq = new Request('http://localhost/api/v1/circulation/loans/any-id/settle-return', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'IDEMP-001',
    },
    body: JSON.stringify({}),
  });
  const anonRes = await handleRequest(anonReq, TEST_ENV, fixtures);
  assert.equal(anonRes.status, 401);

  // 2. Cựu thành viên (Alumni) -> 403 Forbidden
  const alumniActor: AuthenticatedActor = {
    userId: 'usr_alumni',
    memberId: '00000000-0000-0000-0000-000000000005',
    username: 'cuu.thanhvien',
    email: 'alumni@ysbk.vn',
    role: 'MEMBER',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };
  const alumniToken = await signSessionToken(alumniActor, TEST_SECRET);
  const alumniReq = new Request('http://localhost/api/v1/circulation/loans/any-id/settle-return', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${alumniToken}`,
      'X-Idempotency-Key': 'IDEMP-002',
    },
    body: JSON.stringify({}),
  });
  const alumniRes = await handleRequest(alumniReq, TEST_ENV, fixtures);
  assert.equal(alumniRes.status, 403);

  // 3. Thiếu X-Idempotency-Key -> 400 Bad Request
  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'thanhvien.chuan',
    email: 'member@ysbk.vn',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);
  const noKeyReq = new Request('http://localhost/api/v1/circulation/loans/any-id/settle-return', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({}),
  });
  const noKeyRes = await handleRequest(noKeyReq, TEST_ENV, fixtures);
  assert.equal(noKeyRes.status, 400);

  // 4. Tra cứu chi tiết quyết toán GET /api/v1/circulation/loans/:id/settlement có Cache-Control: no-store
  const detailReq = new Request('http://localhost/api/v1/circulation/loans/non-existent/settlement', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${memberToken}`,
    },
  });
  const detailRes = await handleRequest(detailReq, TEST_ENV, fixtures);
  assert.equal(detailRes.headers.get('Cache-Control'), 'no-store');
});
