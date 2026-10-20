/**
 * YSBK Circulation & Finance Module Unit Tests - Chặng 11:
 * Báo mất sách (Lost Book), Tịch thu cọc (Deposit Forfeiture), Sửa sai chứng từ (Document Correction / Reversal)
 * & Hồi quy Carryover Chặng 10 (S10-01 .. S10-08).
 */

import test from 'node:test';
import assert from 'node:assert';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  issueLoanReceipt,
  settleReturnReceipt,
  renewLoanReceipt,
  collectPendingFine,
  addCalendarHoliday,
  reportBookLoss,
} from '../../src/server/circulation/service.ts';
import {
  createDocumentCorrection,
  recordJournalEntry,
} from '../../src/server/finance/ledger.ts';
import {
  FUND_IDS,
  ACCOUNT_CODES,
} from '../../src/server/finance/types.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import type { Env } from '../../src/server/types.ts';

const TEST_SECRET = 'unit_test_jwt_secret_min_32_characters_long_12345';
process.env.JWT_SECRET = TEST_SECRET;

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: TEST_SECRET,
};

function createMockEnvironment(todayYmd = '2026-10-15') {
  const db = new MockCashDbQueryable();

  // Active Cash Session
  db.cashSessions.push({
    id: 'CS-SESSION-TEST-01',
    session_date: todayYmd,
    opened_by: 'mem-admin-01',
    opened_at: `${todayYmd}T08:00:00.000Z`,
    opening_cash: '500000',
    expected_closing_cash: '500000',
    actual_closing_cash: null,
    is_closed: false,
  });

  // Borrower
  db.borrowers.push({
    id: 'bor-01',
    full_name: 'Nguyễn Văn Đọc',
    phone: '0912345678',
    student_id: '20230001',
    school: 'ĐHBK Hà Nội',
    is_archived: false,
  });

  // Book Edition & Titles
  db.bookTitles.push({ id: 'bt-01', title: 'Hệ Điều Hành & Hệ Phân Tán' });
  db.bookEditions.push({ id: 'ed-01', title_id: 'bt-01', publisher: 'NXB Bách Khoa', publish_year: 2025 });

  // Book Copies: cp-01 (cover price 74k -> deposit 50k), cp-02 (cover price 150k -> deposit 150k)
  db.bookCopies.push({
    id: 'cp-01',
    edition_id: 'ed-01',
    barcode: 'BC-LOST-01',
    copy_number: 1,
    cover_price: '74000',
    location: 'BAN_TRUC_TAM',
    status: 'AVAILABLE',
  });

  db.bookCopies.push({
    id: 'cp-02',
    edition_id: 'ed-01',
    barcode: 'BC-LOST-02',
    copy_number: 2,
    cover_price: '150000',
    location: 'BAN_TRUC_TAM',
    status: 'AVAILABLE',
  });

  return db;
}

function createTestInjection(db: MockCashDbQueryable) {
  return {
    queryable: db,
    membersDb: {
      'mem-01': {
        id: 'mem-01',
        username: 'member01',
        is_admin: false,
        is_alumni: false,
        is_active: true,
        token_version: 1,
      },
      'mem-admin-01': {
        id: 'mem-admin-01',
        username: 'admin01',
        is_admin: true,
        is_alumni: false,
        is_active: true,
        token_version: 1,
      },
    },
  };
}

// =========================================================================
// 1. GATE G-loss: Báo mất sách & Tịch thu cọc (Lost Book & Forfeiture)
// =========================================================================

test('G-loss 1: Book price 74k with deposit 50k reported lost -> only forfeits 50k, 0 cash delta, no extra charge', async () => {
  const db = createMockEnvironment();

  // Mượn cuốn sách 74k (tiền cọc theo bảng là 50k)
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const initialDrawer = BigInt(db.cashSessions[0].expected_closing_cash);

  // Báo mất cuốn sách
  const lossRes = await reportBookLoss(
    db,
    {
      receiptId: loan.id,
      barcodes: ['BC-LOST-01'],
      reason: 'Đánh rơi sách trên xe buýt',
    },
    'mem-admin-01'
  );

  // Chỉ tịch thu đúng 50k cọc đã nộp, tuyệt đối KHÔNG thu thêm 24k chênh lệch giá bìa
  assert.strictEqual(lossRes.forfeitedDeposit, 50000);
  assert.strictEqual(lossRes.receiptStatus, 'LOST');
  assert.strictEqual(lossRes.settlementType, 'LOST');

  // Hộp tiền mặt không đổi (zero cash delta)
  const finalDrawer = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.strictEqual(finalDrawer, initialDrawer);

  // Bản sách chuyển status = 'LOST'
  const copy = db.bookCopies.find((c) => c.barcode === 'BC-LOST-01');
  assert.strictEqual(copy?.status, 'LOST');

  // Dòng mượn loan_items: is_lost = true, returned_at = null
  const item = db.loanItems.find((li) => li.receipt_id === loan.id);
  assert.strictEqual(item?.is_lost, true);
  assert.strictEqual(item?.returned_at, null);
  assert.strictEqual(item?.lost_reason, 'Đánh rơi sách trên xe buýt');

  // Bảng phân bổ cọc deposit_allocations chuyển status = 'FORFEITED', remaining = 0
  const alloc = db.depositAllocations.find((a) => a.receipt_id === loan.id);
  assert.strictEqual(alloc?.status, 'FORFEITED');
  assert.strictEqual(alloc?.remaining_amount, '0');

  // Bút toán sổ cái: Nợ COC_PHAI_HOAN (DEPOSIT_LIABILITY) / Có THU_PHAT (FINE_REVENUE) 50k
  const je = db.journalEntries.find((e) => e.source_type === 'LOAN_FINE_FORFEIT' && e.source_id === loan.id);
  assert.ok(je);
  assert.strictEqual(je?.debit_account, ACCOUNT_CODES.DEPOSIT_LIABILITY);
  assert.strictEqual(je?.credit_account, ACCOUNT_CODES.FINE_REVENUE);
  assert.strictEqual(BigInt(je?.amount), 50000n);
});

test('G-loss 2: 2-book loan with 1 reported lost -> lost copy LOST, kept copy BORROWED, receipt remains ACTIVE', async () => {
  const db = createMockEnvironment();

  // Mượn 2 cuốn: cp-01 (cọc 50k) và cp-02 (cọc 150k) -> tổng cọc 200k
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01', 'BC-LOST-02'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 200000,
    },
    'mem-admin-01'
  );

  // Báo mất chỉ 1 cuốn BC-LOST-01
  const lossRes = await reportBookLoss(
    db,
    {
      receiptId: loan.id,
      barcodes: ['BC-LOST-01'],
      reason: 'Bị rơi mất cuốn Hệ Điều Hành',
    },
    'mem-admin-01'
  );

  // Chỉ tịch thu 50k cọc của cuốn mất
  assert.strictEqual(lossRes.forfeitedDeposit, 50000);
  // Phiếu vẫn còn cuốn BC-LOST-02 đang mượn -> receiptStatus giữ ACTIVE
  assert.strictEqual(lossRes.receiptStatus, 'ACTIVE');
  assert.strictEqual(lossRes.settlementType, null);

  // Cuốn mất chuyển 'LOST', cuốn giữ vẫn 'BORROWED'
  const copy1 = db.bookCopies.find((c) => c.barcode === 'BC-LOST-01');
  const copy2 = db.bookCopies.find((c) => c.barcode === 'BC-LOST-02');
  assert.strictEqual(copy1?.status, 'LOST');
  assert.strictEqual(copy2?.status, 'BORROWED');

  // Allocation của cuốn 2 vẫn HELD 150k
  const alloc2 = db.depositAllocations.find((a) => a.receipt_id === loan.id && a.item_id === db.loanItems[1].id);
  assert.strictEqual(alloc2?.status, 'HELD');
  assert.strictEqual(alloc2?.remaining_amount, '150000');
});

test('G-loss 3: Rejections: already returned, already lost, carried forward, invalid inputs', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  // 1. Lý do quá ngắn (< 5 ký tự)
  await assert.rejects(
    async () => {
      await reportBookLoss(db, { receiptId: loan.id, barcodes: ['BC-LOST-01'], reason: 'mất' }, 'mem-admin-01');
    },
    (err: any) => err.code === 'MISSING_LOSS_REASON' || err.statusCode === 400
  );

  // 2. Không truyền barcode hoặc copyId
  await assert.rejects(
    async () => {
      await reportBookLoss(db, { receiptId: loan.id, reason: 'Mất sách khi đi học' }, 'mem-admin-01');
    },
    (err: any) => err.code === 'MISSING_BOOK_IDENTIFIERS' || err.statusCode === 400
  );

  // 3. Trả sách trước rồi mới báo mất -> COPY_ALREADY_RETURNED (409)
  await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BC-LOST-01'],
      fineReason: 'Trả đúng hạn',
    },
    'mem-admin-01'
  );

  await assert.rejects(
    async () => {
      await reportBookLoss(db, { receiptId: loan.id, barcodes: ['BC-LOST-01'], reason: 'Báo mất sau khi đã trả' }, 'mem-admin-01');
    },
    (err: any) => err.code === 'COPY_ALREADY_RETURNED' || err.statusCode === 409
  );
});

// =========================================================================
// 2. GATE G-correction: Sửa sai chứng từ (Document Correction / Reversal)
// =========================================================================

test('G-correction 1: Reverse valid journal entry: swaps debit/credit, sets reversal_of_entry_id, decreases float if cash', async () => {
  const db = createMockEnvironment();

  // Ghi một bút toán thu tiền phạt 10.000₫ bằng tiền mặt
  const origEntry = await recordJournalEntry(db, {
    entryCode: 'JE-TEST-FINE-01',
    fundId: FUND_IDS.LOAN,
    sourceType: 'TEST_FINE',
    sourceId: 'src-01',
    debitAccount: ACCOUNT_CODES.CASH_DRAWER,
    creditAccount: ACCOUNT_CODES.FINE_REVENUE,
    amount: 10000n,
    cashSessionId: 'CS-SESSION-TEST-01',
    createdBy: 'mem-admin-01',
    notes: 'Thu phạt nhầm người',
  });

  const floatBefore = BigInt(db.cashSessions[0].expected_closing_cash);

  // Sửa sai chứng từ: Đảo bút toán
  const correction = await createDocumentCorrection(
    db,
    {
      originalEntryId: origEntry.id,
      reason: 'Nhập nhầm mã sinh viên khi thu phạt, hoàn tiền mặt cho bạn',
      cashSessionId: 'CS-SESSION-TEST-01',
      paymentConfirmed: true,
    },
    'mem-admin-01'
  );

  assert.strictEqual(correction.originalEntryId, origEntry.id);
  assert.strictEqual(correction.amount, 10000);
  assert.strictEqual(correction.reversalEntryCode, `REV-${origEntry.entry_code}`);

  // Bút toán đảo trong sổ cái có tài khoản đảo ngược (Nợ THU_PHAT / Có TIEN_MAT_HOP)
  const revEntry = db.journalEntries.find((e) => e.id === correction.reversalEntryId);
  assert.ok(revEntry);
  assert.strictEqual(revEntry?.debit_account, ACCOUNT_CODES.FINE_REVENUE);
  assert.strictEqual(revEntry?.credit_account, ACCOUNT_CODES.CASH_DRAWER);
  assert.strictEqual(revEntry?.reversal_of_entry_id, origEntry.id);

  // Vì bút toán đảo chi tiền mặt ra khỏi hộp, số dư expected_closing_cash giảm 10.000₫
  const floatAfter = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.strictEqual(floatAfter, floatBefore - 10000n);
});

test('G-correction 2: Double reversal rejected with ENTRY_ALREADY_REVERSED (409)', async () => {
  const db = createMockEnvironment();

  const origEntry = await recordJournalEntry(db, {
    entryCode: 'JE-TEST-REV-01',
    fundId: FUND_IDS.LOAN,
    sourceType: 'TEST_REV',
    sourceId: 'src-02',
    debitAccount: ACCOUNT_CODES.BANK_MAIN,
    creditAccount: ACCOUNT_CODES.FINE_REVENUE,
    amount: 50000n,
    createdBy: 'mem-admin-01',
  });

  // Đảo lần 1: Thành công
  await createDocumentCorrection(
    db,
    {
      originalEntryId: origEntry.id,
      reason: 'Đảo lần 1 hợp lệ do nhầm số tiền',
      paymentConfirmed: true,
    },
    'mem-admin-01'
  );

  // Đảo lần 2: Bị chặn với ENTRY_ALREADY_REVERSED (409)
  await assert.rejects(
    async () => {
      await createDocumentCorrection(
        db,
        {
          originalEntryId: origEntry.id,
          reason: 'Đảo lần 2 cố ý hoặc nhầm lẫn',
          paymentConfirmed: true,
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'ENTRY_ALREADY_REVERSED' || err.statusCode === 409
  );
});

test('G-correction 3: Insufficient cash in session blocks cash reversal with INSUFFICIENT_CASH_IN_SESSION (400)', async () => {
  const db = createMockEnvironment();

  // Đặt số dư tiền mặt ban đầu của ca trực là 5.000₫
  db.cashSessions[0].opening_cash = '5000';
  db.cashSessions[0].expected_closing_cash = '5000';

  const origEntry = await recordJournalEntry(db, {
    entryCode: 'JE-TEST-BIG-CASH',
    fundId: FUND_IDS.LOAN,
    sourceType: 'TEST_REV',
    sourceId: 'src-03',
    debitAccount: ACCOUNT_CODES.CASH_DRAWER,
    creditAccount: ACCOUNT_CODES.FINE_REVENUE,
    amount: 50000n,
    cashSessionId: 'CS-SESSION-TEST-01',
    createdBy: 'mem-admin-01',
  });

  // Trong ca đã chi tiền mặt 50k cho việc khác, khiến hộp tiền thực tế chỉ còn 5.000₫
  await recordJournalEntry(db, {
    entryCode: 'JE-TEST-OTHER-OUT',
    fundId: FUND_IDS.LOAN,
    sourceType: 'TEST_EXPENSE',
    sourceId: 'src-other',
    debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    creditAccount: ACCOUNT_CODES.CASH_DRAWER,
    amount: 50000n,
    cashSessionId: 'CS-SESSION-TEST-01',
    createdBy: 'mem-admin-01',
  });

  // Cố gắng đảo bút toán thu 50k (đòi chi 50k trong khi ca trực chỉ có 5k)
  await assert.rejects(
    async () => {
      await createDocumentCorrection(
        db,
        {
          originalEntryId: origEntry.id,
          reason: 'Đảo bút toán khi hộp tiền không đủ tiền hoàn',
          cashSessionId: 'CS-SESSION-TEST-01',
          paymentConfirmed: true,
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'INSUFFICIENT_CASH_IN_SESSION' || err.statusCode === 400
  );
});

// =========================================================================
// 3. GATE G-carryover10: Hồi quy S10-01 .. S10-08
// =========================================================================

test('S10-02: Multi-installment fine collection (5k -> 2k -> 3k) has distinct entry codes and correct pending amounts', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  // Tạo một settlement nợ phạt 5.000₫ (fine_final = 5k, fine_collected = 0, fine_pending_amount = 5k, fine_status = PENDING)
  db.loanSettlements.push({
    id: 'mock-settle-5k',
    receipt_id: loan.id,
    settlement_type: 'RETURN',
    return_date: '2026-10-15',
    overdue_days: 5,
    fine_suggested: '5000',
    fine_final: '5000',
    fine_reason: 'Quá hạn 5 ngày',
    fine_collected: '0',
    fine_pending_amount: '5000',
    fine_status: 'PENDING',
    fine_payment_method: null,
    total_deposit: '50000',
    deposit_refunded: '50000',
    deposit_forfeited: '0',
    deposit_transferred: '0',
    new_deposit_collected: '0',
    successor_receipt_id: null,
    cash_session_id: 'CS-SESSION-TEST-01',
    settled_by: 'mem-admin-01',
    settled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  // Đợt 1: Thu 2.000₫
  const col1 = await collectPendingFine(
    db,
    {
      receiptId: loan.id,
      targetId: 'mock-settle-5k',
      amount: 2000n,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );

  assert.strictEqual(col1.fineCollected, 2000);
  assert.strictEqual(col1.finePendingAmount, 3000);
  assert.strictEqual(col1.fineStatus, 'PENDING');

  const je1 = db.journalEntries.find((e) => e.id === col1.journalEntryId);
  assert.ok(je1);
  assert.strictEqual(je1.entry_code.includes('COLLECT-1'), true);

  // Đợt 2: Thu 3.000₫ còn lại
  const col2 = await collectPendingFine(
    db,
    {
      receiptId: loan.id,
      targetId: 'mock-settle-5k',
      amount: 3000n,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );

  assert.strictEqual(col2.fineCollected, 3000);
  assert.strictEqual(col2.finePendingAmount, 0);
  assert.strictEqual(col2.fineStatus, 'COLLECTED');

  const je2 = db.journalEntries.find((e) => e.id === col2.journalEntryId);
  assert.ok(je2);
  assert.strictEqual(je2.entry_code.includes('COLLECT-2'), true);

  // Hai mã bút toán journal phải khác nhau hoàn toàn (không trùng duplicate key 23505)
  assert.notStrictEqual(je1.entry_code, je2.entry_code);
});

test('S10-03: Calendar holiday shifts active loan due_date; returning on or before shifted date incurs no fine', async () => {
  const db = createMockEnvironment();

  // Mượn sách vào 2026-10-01, hạn gốc là 2026-10-15 (Thứ Năm)
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const receipt = db.loanReceipts.find((lr) => lr.id === loan.id);
  receipt.due_date = '2026-10-15';

  // Thêm ngày nghỉ lễ vào đúng ngày đến hạn 2026-10-15
  await addCalendarHoliday(
    db,
    {
      holidayDate: '2026-10-15',
      name: 'Nghỉ giải lao giữa kỳ',
      description: 'CLB nghỉ trực',
    },
    'mem-admin-01'
  );

  // Phiếu mượn đang active phải được tự động dời hạn sang buổi trực tiếp theo: 2026-10-20 (Thứ Ba)
  assert.strictEqual(receipt.due_date, '2026-10-20');
});

test('S10-05: HTTP Boundary rejects malformed JSON and non-object body with 400', async () => {
  const db = createMockEnvironment();
  const injection = createTestInjection(db);
  const token = await signSessionToken(
    {
      userId: 'usr-admin-01',
      memberId: 'mem-admin-01',
      username: 'admin',
      role: 'ADMIN',
      email: 'admin@ysbk.vn',
      isAlumni: false,
      isActive: true,
      tokenVersion: 1,
    },
    TEST_SECRET
  );

  // 1. Malformed JSON syntax -> 400 MALFORMED_JSON
  const req1 = new Request('http://localhost/api/v1/finance/ledger/corrections', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-ERR-01',
      'Content-Type': 'application/json',
    },
    body: '{"invalid_json":',
  });
  const res1 = await handleRequest(req1, TEST_ENV, injection);
  assert.strictEqual(res1.status, 400);
  const data1 = await res1.json();
  assert.strictEqual(data1.error.code, 'MALFORMED_JSON');

  // 2. Non-object JSON body (Array) -> 400 INVALID_JSON_BODY
  const req2 = new Request('http://localhost/api/v1/finance/ledger/corrections', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'IDEMP-ERR-02',
      'Content-Type': 'application/json',
    },
    body: '[1, 2, 3]',
  });
  const res2 = await handleRequest(req2, TEST_ENV, injection);
  assert.strictEqual(res2.status, 400);
  const data2 = await res2.json();
  assert.strictEqual(data2.error.code, 'INVALID_JSON_BODY');
});

test('S10-06: Renewal with fine exceeding deposit cap is rejected with FINE_EXCEEDS_DEPOSIT_CAP (400)', async () => {
  const db = createMockEnvironment();

  // Mượn sách cọc 50k
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const r = db.loanReceipts.find((lr) => lr.id === loan.id);
  // Quá hạn 60 ngày -> tiền phạt tính ra 60.000₫ (vượt quá 50.000₫ cọc)
  r.due_date = '2026-08-15';
  r.status = 'OVERDUE';

  await assert.rejects(
    async () => {
      await renewLoanReceipt(
        db,
        {
          receiptId: loan.id,
          finePaymentMethod: 'CASH',
          finePaymentConfirmed: true,
          fineAmount: 60000n,
          fineReason: 'Phạt 60 ngày',
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'FINE_EXCEEDS_DEPOSIT_CAP' || err.statusCode === 400
  );
});

// =========================================================================
// 4. GATE G-auth-contract: HTTP RBAC & Idempotency
// =========================================================================

test('G-auth-contract: HTTP role barriers & Cache-Control: no-store for lost book and correction', async () => {
  const db = createMockEnvironment();
  const injection = createTestInjection(db);

  // 1. Unauthenticated request to /lost -> 401
  const reqUnauth = new Request('http://localhost/api/v1/circulation/loans/loan-01/lost', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': 'IDEMP-UNAUTH-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Mất sách khi đi học', barcodes: ['BC-LOST-01'] }),
  });
  const resUnauth = await handleRequest(reqUnauth, TEST_ENV, injection);
  assert.strictEqual(resUnauth.status, 401);

  // 2. Member token -> 200 with Cache-Control: no-store
  const memberToken = await signSessionToken(
    {
      userId: 'usr-mem-01',
      memberId: 'mem-01',
      username: 'member1',
      role: 'MEMBER',
      team: 'HAU_CAN',
      isAlumni: false,
      isActive: true,
      tokenVersion: 1,
    },
    TEST_SECRET
  );

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-01'
  );

  const reqAuth = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/lost`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'X-Idempotency-Key': 'IDEMP-LOST-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Mất sách trên đường về quê', barcodes: ['BC-LOST-01'] }),
  });
  const resAuth = await handleRequest(reqAuth, TEST_ENV, injection);
  assert.strictEqual(resAuth.status, 200);
  assert.strictEqual(resAuth.headers.get('Cache-Control'), 'no-store');

  // 3. Idempotency replay with same key -> returns cached response (200)
  const reqReplay = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/lost`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'X-Idempotency-Key': 'IDEMP-LOST-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Mất sách trên đường về quê', barcodes: ['BC-LOST-01'] }),
  });
  const resReplay = await handleRequest(reqReplay, TEST_ENV, injection);
  assert.strictEqual(resReplay.status, 200);
});
