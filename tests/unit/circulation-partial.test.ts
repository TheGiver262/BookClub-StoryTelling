import test from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  issueLoanReceipt,
  settleReturnReceipt,
  confirmRefund,
  getLoanReceiptById,
  getLoanSettlementDetail,
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
      location: 'BAN_TRUC_TAM',
      status: 'AVAILABLE',
      cover_price: '50000', // Cọc 50.000đ
    },
    {
      id: 'copy-02',
      edition_id: 'ed-01',
      barcode: 'BK-75K-01',
      location: 'BAN_TRUC_TAM',
      status: 'AVAILABLE',
      cover_price: '75000', // Cọc 100.000đ
    },
    {
      id: 'copy-03',
      edition_id: 'ed-01',
      barcode: 'BK-150K-01',
      location: 'BAN_TRUC_TAM',
      status: 'AVAILABLE',
      cover_price: '150000', // Cọc 150.000đ
    }
  );
}

// ---------------------------------------------------------------------------
// 1. GATE G-SELECTORS: Strict selector validation & guards for PARTIAL return
// ---------------------------------------------------------------------------
test('G-selectors 1: Reject duplicate barcodes in partial return input', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

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

  // Gửi mảng có mã vạch trùng lặp: ['BK-50K-01', 'BK-50K-01']
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: ['BK-50K-01', 'BK-50K-01'],
          paymentConfirmed: true,
        },
        actorId
      ),
    /trùng lặp/
  );
});

test('G-selectors 2: Reject alias conflict between returnedCopyBarcodes and returnedBarcodes', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

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

  // Truyền cả returnedCopyBarcodes và returnedBarcodes với giá trị khác nhau
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: ['BK-50K-01'],
          returnedBarcodes: ['BK-75K-01'],
          paymentConfirmed: true,
        } as any,
        actorId
      ),
    /Xung đột giữa returnedCopyBarcodes và returnedBarcodes/
  );
});

test('G-selectors 3: Reject partial return with 0 copies or 2 copies (must return exactly 1, keep 1)', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

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

  // Trả 0 cuốn (danh sách rỗng) -> Bị chặn
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: [],
          paymentConfirmed: true,
        },
        actorId
      ),
    /không được để rỗng/
  );

  // Trả cả 2 cuốn trong chế độ PARTIAL -> Bắt buộc dùng FULL
  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: ['BK-50K-01', 'BK-75K-01'],
          paymentConfirmed: true,
        },
        actorId
      ),
    /Trả một phần \(PARTIAL\) bắt buộc phải trả đúng 1 cuốn và giữ lại đúng 1 cuốn/
  );
});

test('G-selectors 4: Reject partial return on receipt with only 1 borrowed book', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const loanSingle = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    actorId
  );

  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loanSingle.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: ['BK-50K-01'],
          paymentConfirmed: true,
        },
        actorId
      ),
    /Trả một phần \(PARTIAL\) chỉ áp dụng cho phiếu đang mượn đúng 2 cuốn sách/
  );
});

test('G-selectors 5: Reject barcode not belonging to the loan receipt', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

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

  await assert.rejects(
    () =>
      settleReturnReceipt(
        db,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: ['BK-150K-01'], // Cuốn này không thuộc phiếu
          paymentConfirmed: true,
        },
        actorId
      ),
    /Mã vạch 'BK-150K-01' không thuộc danh sách sách đang mượn của phiếu này/
  );
});

// ---------------------------------------------------------------------------
// 2. GATE G-LIFECYCLE-DB: 2 books -> return 1, keep 1 lifecycle & invariants
// ---------------------------------------------------------------------------
test('G-lifecycle 1: 2 books -> return 1, keep 1: returned copy AVAILABLE, kept copy BORROWED, old receipt PARTIAL_SETTLED, new receipt ACTIVE', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn: BK-50K-01 (cọc 50k) và BK-75K-01 (cọc 100k)
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

  // Trả đúng 1 cuốn: BK-50K-01, giữ lại BK-75K-01
  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'PARTIAL',
      returnedCopyBarcodes: ['BK-50K-01'],
      refundMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // 1. Phiếu cũ chốt trạng thái PARTIAL_SETTLED
  assert.equal(settleRes.status, 'PARTIAL_SETTLED');
  assert.ok(settleRes.newReceiptId);
  const oldReceipt = db.loanReceipts.find((r) => r.id === loan.id)!;
  assert.equal(oldReceipt.status, 'PARTIAL_SETTLED');

  // 2. Cuốn trả (BK-50K-01 / copy-01):
  // - book_copies.status chuyển sang AVAILABLE
  const copy01 = db.bookCopies.find((c) => c.barcode === 'BK-50K-01')!;
  assert.equal(copy01.status, 'AVAILABLE');

  // - loan_items cũ của cuốn trả có returned_at thật
  const itemReturned = db.loanItems.find((li) => li.receipt_id === loan.id && li.copy_id === copy01.id)!;
  assert.ok(itemReturned.returned_at);
  assert.equal(itemReturned.carried_forward_at, null);

  // 3. Cuốn giữ lại (BK-75K-01 / copy-02):
  // - book_copies.status GIỮ NGUYÊN BORROWED!
  const copy02 = db.bookCopies.find((c) => c.barcode === 'BK-75K-01')!;
  assert.equal(copy02.status, 'BORROWED');

  // - loan_items cũ của cuốn giữ: carried_forward_at được ghi nhận, successor_item_id liên kết, returned_at TUYỆT ĐỐI NULL!
  const itemKeptOld = db.loanItems.find((li) => li.receipt_id === loan.id && li.copy_id === copy02.id)!;
  assert.ok(itemKeptOld.carried_forward_at);
  assert.ok(itemKeptOld.successor_item_id);
  assert.equal(itemKeptOld.returned_at, null); // KHÔNG ĐƯỢC fake returned_at!

  // 4. Phiếu mượn mới sinh tự động:
  const newReceipt = db.loanReceipts.find((r) => r.id === settleRes.newReceiptId)!;
  assert.ok(newReceipt);
  assert.equal(newReceipt.borrower_id, 'bor-001');
  assert.equal(newReceipt.status, 'ACTIVE');
  assert.equal(newReceipt.renew_count, 0);
  assert.equal(newReceipt.preceding_receipt_id, loan.id);

  // - Dòng sách mới trên phiếu mới cho cuốn giữ lại
  const itemKeptNew = db.loanItems.find((li) => li.receipt_id === newReceipt.id && li.copy_id === copy02.id)!;
  assert.ok(itemKeptNew);
  assert.equal(itemKeptOld.successor_item_id, itemKeptNew.id);
  assert.equal(itemKeptNew.returned_at, null);
  assert.equal(itemKeptNew.carried_forward_at, null);

  // 5. Invariant: Duy nhất 1 active hold cho copy-02, 0 active hold cho copy-01
  const activeHoldsCopy01 = db.loanItems.filter(
    (li) => li.copy_id === copy01.id && !li.returned_at && !li.is_lost && !li.carried_forward_at
  );
  assert.equal(activeHoldsCopy01.length, 0);

  const activeHoldsCopy02 = db.loanItems.filter(
    (li) => li.copy_id === copy02.id && !li.returned_at && !li.is_lost && !li.carried_forward_at
  );
  assert.equal(activeHoldsCopy02.length, 1);
  assert.equal(activeHoldsCopy02[0].receipt_id, newReceipt.id);
});

// ---------------------------------------------------------------------------
// 3. GATE G-MONEY-TRANSFER: Case P = 0 & Case 0 < P < D
// ---------------------------------------------------------------------------
test('G-money-transfer 1: Case P = 0 -> refund intent 50k, transfer 100k cash-neutral, zero journal movement for transfer', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn: 50k + 100k = 150k cọc tiền mặt
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

  const cashDrawerBefore = BigInt(db.cashSessions[0].expected_closing_cash);
  const journalCountBefore = db.journalEntries.length;

  // Trả 1 cuốn BK-50K-01 (cọc 50k), giữ BK-75K-01 (cọc 100k)
  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'PARTIAL',
      returnedCopyBarcodes: ['BK-50K-01'],
      refundMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  assert.equal(settleRes.depositRefunded, 50000);
  assert.equal(settleRes.depositTransferred, 100000);
  assert.equal(settleRes.fineFinal, 0);

  // 1. Chuyển cọc 100k là CASH-NEUTRAL: Tuyệt đối KHÔNG phát sinh bút toán sổ cái cho khoản chuyển!
  const journalEntriesAfterSettle = db.journalEntries.slice(journalCountBefore);
  // Không có bút toán tiền mặt thu hay chi
  const cashMovements = journalEntriesAfterSettle.filter(
    (je) => je.debit_account === ACCOUNT_CODES.CASH_DRAWER || je.credit_account === ACCOUNT_CODES.CASH_DRAWER
  );
  assert.equal(cashMovements.length, 0);

  // Hộp tiền không thay đổi trước khi hoàn cọc thực tế
  const cashDrawerMid = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.equal(cashDrawerMid, cashDrawerBefore);

  // 2. Kiểm tra trạng thái phân bổ cọc (deposit_allocations)
  const allocsOld = db.depositAllocations.filter((a) => a.receipt_id === loan.id);
  const allocReturned = allocsOld.find((a) => a.original_amount === '50000')!;
  const allocKept = allocsOld.find((a) => a.original_amount === '100000')!;

  assert.equal(allocReturned.status, 'PENDING_REFUND');
  assert.equal(allocKept.status, 'TRANSFERRED');
  assert.equal(allocKept.remaining_amount, '0');
  assert.equal(allocKept.transferred_to_receipt_id, settleRes.newReceiptId);

  // Phân bổ mới trên phiếu mới có status HELD, remaining 100k
  const allocsNew = db.depositAllocations.filter((a) => a.receipt_id === settleRes.newReceiptId);
  assert.equal(allocsNew.length, 1);
  assert.equal(allocsNew[0].status, 'HELD');
  assert.equal(allocsNew[0].remaining_amount, '100000');

  // 3. Xác nhận hoàn cọc 50k: tiền mặt giảm đúng 50k
  const intentId = settleRes.refundIntents[0].id;
  await confirmRefund(
    db,
    {
      refundIntentId: intentId,
      paymentConfirmed: true,
    },
    actorId
  );

  const cashDrawerAfter = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.equal(cashDrawerBefore - cashDrawerAfter, 50000n);
});

test('G-money-transfer 2: Case 0 < P < D (D = 150k, P = 60k) -> collect fine 60k separately, refund 50k, transfer 100k', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn: 50k + 100k = 150k cọc tiền mặt
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

  const initialCash = BigInt(db.cashSessions[0].expected_closing_cash);

  // Trả 1 cuốn BK-50K-01, quá hạn có phạt 60k
  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'PARTIAL',
      returnedCopyBarcodes: ['BK-50K-01'],
      refundMethod: 'CASH',
      fineAmount: 60000n,
      fineReason: 'Quá hạn 60 ngày theo biên bản',
      finePaymentMethod: 'CASH',
      finePaymentConfirmed: true, // Thu phạt 60k tiền mặt trực tiếp
      paymentConfirmed: true,
    },
    actorId
  );

  assert.equal(settleRes.fineFinal, 60000);
  assert.equal(settleRes.directFineCollected, 60000);
  assert.equal(settleRes.depositRefunded, 50000);
  assert.equal(settleRes.depositTransferred, 100000);
  assert.equal(settleRes.depositForfeited, 0);

  // Sau khi thu phạt 60k, tiền mặt tăng 60k
  const cashAfterFine = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.equal(cashAfterFine - initialCash, 60000n);

  // Xác nhận hoàn cọc 50k: tiền mặt giảm 50k
  const intentId = settleRes.refundIntents[0].id;
  await confirmRefund(
    db,
    {
      refundIntentId: intentId,
      paymentConfirmed: true,
    },
    actorId
  );

  const cashAfterRefund = BigInt(db.cashSessions[0].expected_closing_cash);
  // Hiệu ứng ròng: +60k - 50k = +10k
  assert.equal(cashAfterRefund - initialCash, 10000n);
});

// ---------------------------------------------------------------------------
// 4. GATE G-FORFEIT-NEW (T73): Case P >= D
// ---------------------------------------------------------------------------
test('G-forfeit-new 1: Case P >= D (D = 150k, P = 150k) -> Forfeit full 150k old deposit, no refund, collect new deposit 100k confirmed', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn: 50k + 100k = 150k cọc tiền mặt
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

  const cashBefore = BigInt(db.cashSessions[0].expected_closing_cash);

  // Phạt 150k >= D = 150k. Trả BK-50K-01, giữ BK-75K-01. Thu cọc mới 100k tiền mặt đã xác nhận
  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'PARTIAL',
      returnedCopyBarcodes: ['BK-50K-01'],
      fineAmount: 150000n,
      fineReason: 'Quá hạn 150 ngày - giữ toàn bộ cọc cũ làm phạt theo T73',
      newDepositPaymentMethod: 'CASH',
      newDepositConfirmed: true,
      paymentConfirmed: true,
    },
    actorId
  );

  // 1. Kết quả chốt: Toàn bộ 150k cọc cũ bị tịch thu, không có tiền hoàn, không chuyển cọc cũ
  assert.equal(settleRes.depositForfeited, 150000);
  assert.equal(settleRes.depositRefunded, 0);
  assert.equal(settleRes.depositTransferred, 0);
  assert.equal(settleRes.refundIntents.length, 0);
  assert.equal(settleRes.newDepositCollected, 100000);

  // 2. Mọi phân bổ cọc cũ chuyển thành FORFEITED
  const allocsOld = db.depositAllocations.filter((a) => a.receipt_id === loan.id);
  assert.equal(allocsOld.every((a) => a.status === 'FORFEITED'), true);

  // 3. Tiền mặt hộp tăng đúng 100k do thu cọc mới
  const cashAfter = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.equal(cashAfter - cashBefore, 100000n);

  // 4. Phiếu mới ở trạng thái ACTIVE
  const newReceipt = db.loanReceipts.find((r) => r.id === settleRes.newReceiptId)!;
  assert.equal(newReceipt.status, 'ACTIVE');

  // Phân bổ cọc mới trên phiếu mới có status HELD, amount 100k
  const allocsNew = db.depositAllocations.filter((a) => a.receipt_id === newReceipt.id);
  assert.equal(allocsNew.length, 1);
  assert.equal(allocsNew[0].status, 'HELD');
  assert.equal(allocsNew[0].remaining_amount, '100000');
});

test('G-forfeit-new 2: Case P >= D with unconfirmed new deposit -> new receipt PENDING_DEPOSIT, kept book BORROWED, copy never AVAILABLE', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

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

  const cashBefore = BigInt(db.cashSessions[0].expected_closing_cash);

  // Phạt 150k >= D = 150k. Chưa thu cọc mới (newDepositConfirmed = false)
  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'PARTIAL',
      returnedCopyBarcodes: ['BK-50K-01'],
      fineAmount: 150000n,
      fineReason: 'Quá hạn nặng - giữ cọc cũ làm phạt, chờ thu cọc mới',
      newDepositPaymentMethod: 'CASH',
      newDepositConfirmed: false, // Chưa nhận tiền cọc mới
      paymentConfirmed: true,
    },
    actorId
  );

  assert.equal(settleRes.depositForfeited, 150000);
  assert.equal(settleRes.newDepositCollected, 0);

  // Tiền mặt không đổi vì chưa thu cọc mới
  const cashAfter = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.equal(cashAfter, cashBefore);

  // Cuốn giữ lại (BK-75K-01) TUYỆT ĐỐI KHÔNG ĐƯỢC trở thành AVAILABLE!
  const keptCopy = db.bookCopies.find((c) => c.barcode === 'BK-75K-01')!;
  assert.equal(keptCopy.status, 'BORROWED');

  // Phân bổ cọc mới ở trạng thái PENDING_COLLECTION
  const allocsNew = db.depositAllocations.filter((a) => a.receipt_id === settleRes.newReceiptId);
  assert.equal(allocsNew.length, 1);
  assert.equal(allocsNew[0].status, 'PENDING_COLLECTION');
  assert.equal(allocsNew[0].remaining_amount, '0');

  // Phiếu mượn mới ở trạng thái PENDING_DEPOSIT
  const newReceipt = db.loanReceipts.find((r) => r.id === settleRes.newReceiptId)!;
  assert.equal(newReceipt.status, 'PENDING_DEPOSIT');
});

// ---------------------------------------------------------------------------
// 5. GATE G-DATE-HISTORY: Read model & chain navigation
// ---------------------------------------------------------------------------
test('G-date-history: Settlement read model retains snapshot, GET receipt chain links old and new receipts', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

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

  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'PARTIAL',
      returnedCopyBarcodes: ['BK-50K-01'],
      fineAmount: 20000n,
      fineReason: 'Quá hạn 20 ngày',
      finePaymentMethod: 'CASH',
      finePaymentConfirmed: true,
      paymentConfirmed: true,
    },
    actorId
  );

  // Tra cứu chi tiết quyết toán của phiếu cũ
  const settlementDetail = await getLoanSettlementDetail(db, loan.id);
  assert.ok(settlementDetail);
  assert.equal(settlementDetail.settlementType, 'PARTIAL');
  assert.equal(settlementDetail.fineFinal, 20000);
  assert.equal(settlementDetail.fineCollected, 20000);
  assert.equal(settlementDetail.depositRefunded, 50000);
  assert.equal(settlementDetail.depositTransferred, 100000);
  assert.equal(settlementDetail.successorReceiptId, settleRes.newReceiptId);

  // Tra cứu phiếu mới: preceding_receipt_id liên kết phiếu cũ
  const newReceiptDetail = await getLoanReceiptById(db, settleRes.newReceiptId!);
  assert.ok(newReceiptDetail);
  assert.equal(newReceiptDetail.status, 'ACTIVE');
  assert.equal(newReceiptDetail.items.length, 1);
  assert.equal(newReceiptDetail.items[0].barcode, 'BK-75K-01');
});

// ---------------------------------------------------------------------------
// 6. GATE G-RECOVERY: Idempotency replay & conflict
// ---------------------------------------------------------------------------
test('G-recovery: Idempotency replay on partial return returns identical response; mismatch returns 409', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const fixtures = createFixtures(db);

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

  // Mượn 2 cuốn
  const issueRes = await handleRequest(
    new Request('http://localhost/api/v1/circulation/loans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': 'IDEMP-ISSUE-PARTIAL-01',
      },
      body: JSON.stringify({
        borrowerId: 'bor-001',
        barcodes: ['BK-50K-01', 'BK-75K-01'],
        paymentMethod: 'CASH',
        paymentConfirmed: true,
      }),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(issueRes.status, 201);
  const issueJson = (await issueRes.json()) as any;
  const loanId = issueJson.data.id;

  const idempotencyKey = 'idemp-partial-test-001';
  const returnPayload = {
    returnType: 'PARTIAL',
    returnedCopyBarcodes: ['BK-50K-01'],
    refundMethod: 'CASH',
    paymentConfirmed: true,
  };

  // Lần 1: Thành công
  const res1 = await handleRequest(
    new Request(`http://localhost/api/v1/circulation/loans/${loanId}/settle-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(returnPayload),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(res1.status, 200);
  const json1 = (await res1.json()) as any;
  assert.equal(json1.data.status, 'PARTIAL_SETTLED');
  assert.ok(json1.data.newReceiptId);

  // Lần 2: Replay cùng key & payload -> Trả về kết quả identical
  const res2 = await handleRequest(
    new Request(`http://localhost/api/v1/circulation/loans/${loanId}/settle-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(returnPayload),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(res2.status, 200);
  const json2 = (await res2.json()) as any;
  assert.equal(json2.data.newReceiptId, json1.data.newReceiptId);

  // Lần 3: Cùng key nhưng thay đổi payload (mismatch) -> 409 Conflict
  const res3 = await handleRequest(
    new Request(`http://localhost/api/v1/circulation/loans/${loanId}/settle-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        ...returnPayload,
        refundMethod: 'BANK_TRANSFER',
      }),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(res3.status, 409);
});

// ---------------------------------------------------------------------------
// 7. GATE G-AUTH-CONTRACT: RBAC barriers for partial return
// ---------------------------------------------------------------------------
test('G-auth-contract: RBAC barriers & Cache-Control: no-store for partial return', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const fixtures = createFixtures(db);

  // Token Member hợp lệ
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

  // Token Alumni (bị cấm)
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

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-50K-01', 'BK-75K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 150000,
    },
    memberActor.memberId!
  );

  const returnPayload = {
    returnType: 'PARTIAL',
    returnedCopyBarcodes: ['BK-50K-01'],
    paymentConfirmed: true,
  };

  // 1. Anonymous -> 401
  const anonRes = await handleRequest(
    new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/settle-return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(returnPayload),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(anonRes.status, 401);

  // 2. Alumni -> 403 Forbidden
  const alumniRes = await handleRequest(
    new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/settle-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alumniToken}`,
      },
      body: JSON.stringify(returnPayload),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(alumniRes.status, 403);

  // 3. Member -> 200 OK + Cache-Control: no-store
  const memberRes = await handleRequest(
    new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/settle-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
        'X-Idempotency-Key': 'IDEMP-SETTLE-PARTIAL-AUTH-01',
      },
      body: JSON.stringify(returnPayload),
    }),
    TEST_ENV,
    fixtures
  );
  assert.equal(memberRes.status, 200);
  assert.equal(memberRes.headers.get('Cache-Control'), 'no-store');
});
