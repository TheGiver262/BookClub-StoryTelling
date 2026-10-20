import test from 'node:test';
import assert from 'node:assert';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import { reportBookLoss, settleReturnReceipt, renewLoanReceipt, issueLoanReceipt, collectPendingFine } from '../../src/server/circulation/service.ts';
import { createDocumentCorrection, recordJournalEntry } from '../../src/server/finance/ledger.ts';
import { serializeCashSession } from '../../src/server/finance/cash-sessions.ts';
import { FUND_IDS, ACCOUNT_CODES } from '../../src/server/finance/types.ts';

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

test('S11-01: Document correction rejects unsupported managed sources', async () => {
  const db = createMockEnvironment();

  // Tạo bút toán hoàn cọc (DEPOSIT_REFUND)
  const refundEntry = await recordJournalEntry(db, {
    entryCode: 'JE-TEST-REFUND-01',
    fundId: FUND_IDS.LOAN,
    sourceType: 'DEPOSIT_REFUND',
    sourceId: 'ref-intent-01',
    debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    creditAccount: ACCOUNT_CODES.CASH_DRAWER,
    amount: 50000n,
    cashSessionId: 'CS-SESSION-TEST-01',
    createdBy: 'mem-admin-01',
  });

  // Cố gắng đảo trực tiếp bút toán hoàn cọc mà không qua quy trình thu lại tiền
  await assert.rejects(
    async () => {
      await createDocumentCorrection(
        db,
        {
          originalEntryId: refundEntry.id,
          reason: 'Cố ý đảo bút toán hoàn cọc đã chi tiền',
          paymentConfirmed: true,
          cashSessionId: 'CS-SESSION-TEST-01',
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'UNSUPPORTED_CORRECTION_SOURCE' && (err.httpStatus === 400 || err.statusCode === 400)
  );
});

test('S11-02: Document correction requires paymentConfirmed: true for cash disbursement', async () => {
  const db = createMockEnvironment();

  const cashEntry = await recordJournalEntry(db, {
    entryCode: 'JE-TEST-CASH-IN',
    fundId: FUND_IDS.LOAN,
    sourceType: 'TEST_MANUAL',
    sourceId: 'src-01',
    debitAccount: ACCOUNT_CODES.CASH_DRAWER,
    creditAccount: ACCOUNT_CODES.FINE_REVENUE,
    amount: 15000n,
    cashSessionId: 'CS-SESSION-TEST-01',
    createdBy: 'mem-admin-01',
  });

  // Không truyền paymentConfirmed -> Bị từ chối
  await assert.rejects(
    async () => {
      await createDocumentCorrection(
        db,
        {
          originalEntryId: cashEntry.id,
          reason: 'Đảo bút toán thu tiền mặt nhưng chưa xác nhận giao tiền',
          cashSessionId: 'CS-SESSION-TEST-01',
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'PAYMENT_CONFIRMATION_REQUIRED' && (err.httpStatus === 400 || err.statusCode === 400)
  );

  // Có paymentConfirmed: true -> Thành công
  const res = await createDocumentCorrection(
    db,
    {
      originalEntryId: cashEntry.id,
      reason: 'Đã hoàn tiền mặt thực tế cho bạn đọc',
      paymentConfirmed: true,
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );
  assert.ok(res.reversalEntryId);
});

test('S11-03: Generated journal entry codes are strictly <= 40 characters', async () => {
  const db = createMockEnvironment();
  const actorId = 'mem-admin-01';

  // Lập phiếu mượn 2 cuốn
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01', 'BC-LOST-02'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Báo mất cuốn 1
  const loss1 = await reportBookLoss(
    db,
    {
      receiptId: loan.id,
      barcodes: ['BC-LOST-01'],
      reason: 'Bị đánh rơi trên giảng đường D3',
    },
    actorId
  );

  const jeLoss = db.journalEntries.find((e) => e.id === loss1.journalEntryId);
  assert.ok(jeLoss);
  assert.ok(jeLoss.entry_code.length <= 40, `Loss entry code length ${jeLoss.entry_code.length} must be <= 40`);

  // Đảo bút toán loss (thử nghiệm chiều dài reversal code)
  const revLoss = await recordJournalEntry(db, {
    entryCode: 'REV-' + jeLoss.entry_code,
    fundId: FUND_IDS.LOAN,
    sourceType: 'TEST_REV',
    sourceId: 'src-rev',
    debitAccount: ACCOUNT_CODES.FINE_REVENUE,
    creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    amount: BigInt(jeLoss.amount),
    createdBy: actorId,
  });
  assert.ok(revLoss.entry_code.length <= 40, `Reversal code length ${revLoss.entry_code.length} must be <= 40`);
});

test('S11-05: Return of remaining book after loss does NOT update returned_at on lost book', async () => {
  const db = createMockEnvironment();
  const actorId = 'mem-admin-01';

  // Lập phiếu 2 cuốn: BC-LOST-01 và BC-LOST-02
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01', 'BC-LOST-02'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Báo mất BC-LOST-01
  await reportBookLoss(
    db,
    {
      receiptId: loan.id,
      barcodes: ['BC-LOST-01'],
      reason: 'Báo mất cuốn BC-LOST-01',
    },
    actorId
  );

  // Trả cuốn còn lại BC-LOST-02 bằng FULL return
  await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'FULL',
      returnedBarcodes: ['BC-LOST-02'],
      refundMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Kiểm tra: cuốn BC-LOST-01 phải có is_lost = true và returned_at PHẢI LÀ NULL
  const lostItem = db.loanItems.find((li) => li.copy_id === 'cp-01');
  const returnedItem = db.loanItems.find((li) => li.copy_id === 'cp-02');

  assert.ok(lostItem);
  assert.strictEqual(lostItem.is_lost, true);
  assert.strictEqual(lostItem.returned_at, null, 'Cuốn báo mất tuyệt đối không được ghi returned_at khi trả cuốn còn lại!');

  assert.ok(returnedItem);
  assert.strictEqual(returnedItem.is_lost, false);
  assert.ok(returnedItem.returned_at !== null, 'Cuốn trả vật lý phải có returned_at');
});

test('S11-06: Loss selector rejects alias conflicts and unknown selectors', async () => {
  const db = createMockEnvironment();
  const actorId = 'mem-admin-01';

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // 1. Alias conflict: Truyền cả copyIds và barcodes
  await assert.rejects(
    async () => {
      await reportBookLoss(
        db,
        {
          receiptId: loan.id,
          copyIds: ['cp-01'],
          barcodes: ['BC-LOST-01'],
          reason: 'Truyền cả hai selector',
        },
        actorId
      );
    },
    (err: any) => err.code === 'SELECTOR_ALIAS_CONFLICT' && err.statusCode === 400
  );

  // 2. Unknown barcode not in receipt
  await assert.rejects(
    async () => {
      await reportBookLoss(
        db,
        {
          receiptId: loan.id,
          barcodes: ['BK-UNKNOWN-999'],
          reason: 'Mã vạch không tồn tại',
        },
        actorId
      );
    },
    (err: any) => err.code === 'UNKNOWN_COPY_SELECTOR' && err.statusCode === 400
  );
});

test('S11-08: Overdue renewal with fine >= deposit cap is blocked', async () => {
  const db = createMockEnvironment();
  const actorId = 'mem-admin-01';

  // Lập phiếu 1 cuốn cọc 50k
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  // Giả lập phiếu quá hạn 50 ngày (phạt gợi ý 50.000₫ = cọc 50.000₫)
  const receipt = db.loanReceipts.find((r) => r.id === loan.id);
  if (receipt) {
    receipt.due_date = '2026-08-01'; // Quá hạn nhiều ngày
  }

  // Cố gắng gia hạn với mức phạt = 50.000₫ (bằng đúng cọc)
  await assert.rejects(
    async () => {
      await renewLoanReceipt(
        db,
        {
          receiptId: loan.id,
          fineAmount: 50000n,
          fineReason: 'Lý do điều chỉnh tiền phạt quá hạn',
          finePaymentConfirmed: true,
          finePaymentMethod: 'CASH',
          cashSessionId: 'CS-SESSION-TEST-01',
        },
        actorId
      );
    },
    (err: any) => err.code === 'FINE_EXCEEDS_DEPOSIT_CAP' && (err.httpStatus === 400 || err.statusCode === 400)
  );
});

test('S12-01: Serializer outputs both camelCase and snake_case for full client compatibility', () => {
  const session = {
    id: 'CS-20261019-01',
    session_date: '2026-10-19',
    opened_by: 'user-01',
    opened_at: '2026-10-19T08:00:00Z',
    opening_cash: '500000',
    expected_closing_cash: '650000',
    actual_closing_cash: null,
    discrepancy_reason: null,
    is_closed: false,
    closed_at: null,
    closed_by: null,
    handed_over_from_session_id: null,
  };
  const dto = serializeCashSession(session as any);
  assert.strictEqual(dto.sessionDate, '2026-10-19');
  assert.strictEqual(dto.session_date, '2026-10-19');
  assert.strictEqual(dto.expectedClosingCash, 650000);
  assert.strictEqual(dto.expected_closing_cash, 650000);
  assert.strictEqual(dto.isClosed, false);
  assert.strictEqual(dto.is_closed, false);
});

test('S12-07: collectPendingFine generates distinct entry codes containing targetShort for multiple sources on same receipt', async () => {
  const db = createMockEnvironment();
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      sessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );

  db.loanSettlements.push({
    id: 'settle-source-01',
    receipt_id: loan.id,
    fine_collected: '0',
    fine_pending_amount: '5000',
    fine_status: 'PENDING',
  });

  db.loanSettlements.push({
    id: 'settle-source-02',
    receipt_id: loan.id,
    fine_collected: '0',
    fine_pending_amount: '3000',
    fine_status: 'PENDING',
  });

  const col1 = await collectPendingFine(
    db,
    {
      receiptId: loan.id,
      targetId: 'settle-source-01',
      amount: 2000n,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );

  const col2 = await collectPendingFine(
    db,
    {
      receiptId: loan.id,
      targetId: 'settle-source-02',
      amount: 1000n,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );

  const je1 = db.journalEntries.find((e) => e.id === col1.journalEntryId);
  const je2 = db.journalEntries.find((e) => e.id === col2.journalEntryId);
  assert.ok(je1 && je2);
  assert.notStrictEqual(je1.entry_code, je2.entry_code);
  assert.strictEqual(je1.entry_code.length <= 40, true);
  assert.strictEqual(je2.entry_code.length <= 40, true);
});

test('S12-08: reportBookLoss rejects when item lacks deposit allocation coverage', async () => {
  const db = createMockEnvironment();
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01', 'BC-LOST-02'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      sessionId: 'CS-SESSION-TEST-01',
    },
    'mem-admin-01'
  );

  // Xóa allocations của cuốn thứ 2 để tạo tình huống thiếu coverage
  db.depositAllocations = db.depositAllocations.filter((a) => a.item_id === loan.items[0].id);

  await assert.rejects(
    async () => {
      await reportBookLoss(
        db,
        {
          receiptId: loan.id,
          barcodes: ['BC-LOST-02'],
          reason: 'Mất cuốn thứ 2 không có allocation tương ứng',
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'MISSING_DEPOSIT_ALLOCATION' && err.statusCode === 400
  );
});

test('Regression S12-06 (Mandatory 5): Renewal fine rồi return fine trên cùng receipt; đảo từng nguồn chính xác, không chạm quyết định khác', async () => {
  const db = createMockEnvironment();
  const actorId = 'mem-admin-01';

  // 1. Phát hành phiếu mượn 1 cuốn BC-LOST-01 (cọc 50k, hạn cũ 2026-10-01)
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-LOST-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      sessionId: 'CS-SESSION-TEST-01',
    },
    actorId
  );

  // Đặt due_date về quá khứ để gia hạn bị phạt
  const receiptRow = db.loanReceipts.find((r) => r.id === loan.id);
  assert.ok(receiptRow);
  receiptRow.due_date = '2026-10-01';

  // 2. Gia hạn quá hạn lần 1 -> Thu phạt gia hạn 10.000₫
  const renewRes = await renewLoanReceipt(
    db,
    {
      receiptId: loan.id,
      fineAmount: 10000n,
      fineReason: 'Quá hạn 14 ngày khi gia hạn',
      finePaymentConfirmed: true,
      finePaymentMethod: 'CASH',
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    actorId
  );
  assert.strictEqual(renewRes.fineCollected, true);

  const renewalRow = db.loanRenewals.find((r) => r.receipt_id === loan.id);
  assert.ok(renewalRow);
  assert.strictEqual(BigInt(renewalRow.fine_collected), 10000n);
  assert.strictEqual(renewalRow.fine_status, 'COLLECTED');

  const renewalFineJe = db.journalEntries.find(
    (je) => je.source_type === 'LOAN_FINE' && je.source_id === renewalRow.id
  );
  assert.ok(renewalFineJe, 'Bút toán phạt gia hạn phải có source_id trỏ chính xác vào loan_renewals.id');

  // Đặt due_date mới về quá khứ tiếp để trả sách bị phạt
  receiptRow.due_date = '2026-10-10';

  // 3. Trả sách tất toán FULL -> Thu phạt trả sách 15.000₫
  const returnRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'FULL',
      returnedBarcodes: ['BC-LOST-01'],
      refundMethod: 'CASH',
      fineAmount: 15000n,
      fineReason: 'Quá hạn 5 ngày khi trả sách',
      finePaymentConfirmed: true,
      finePaymentMethod: 'CASH',
      cashSessionId: 'CS-SESSION-TEST-01',
    },
    actorId
  );
  assert.strictEqual(returnRes.directFineCollected, 15000);

  const settlementRow = db.loanSettlements.find((s) => s.receipt_id === loan.id);
  assert.ok(settlementRow);
  assert.strictEqual(BigInt(settlementRow.fine_collected), 15000n);
  assert.strictEqual(settlementRow.fine_status, 'COLLECTED');

  const settlementFineJe = db.journalEntries.find(
    (je) => je.source_type === 'LOAN_FINE' && je.source_id === settlementRow.id
  );
  assert.ok(settlementFineJe, 'Bút toán phạt trả sách phải có source_id trỏ chính xác vào loan_settlements.id');
  assert.notStrictEqual(renewalFineJe.id, settlementFineJe.id);

  // 4. Đảo sửa sai bút toán phạt gia hạn 10k
  const revRenew = await createDocumentCorrection(
    db,
    {
      originalEntryId: renewalFineJe.id,
      reason: 'Miễn tiền phạt gia hạn theo chính sách khuyến đọc',
      cashSessionId: 'CS-SESSION-TEST-01',
      paymentConfirmed: true,
    },
    actorId
  );
  assert.ok(revRenew.reversalEntryId);

  // Kiểm tra: loan_renewals phải cập nhật sang PENDING, fine_collected = 0
  assert.strictEqual(BigInt(renewalRow.fine_collected), 0n);
  assert.strictEqual(BigInt(renewalRow.fine_pending_amount), 10000n);
  assert.strictEqual(renewalRow.fine_status, 'PENDING');

  // Quyết định trả sách trong loan_settlements PHẢI NGUYÊN VẸN, không bị chạm tới!
  assert.strictEqual(BigInt(settlementRow.fine_collected), 15000n, 'Phạt tất toán không được bị ảnh hưởng khi đảo phạt gia hạn');
  assert.strictEqual(settlementRow.fine_status, 'COLLECTED');

  // 5. Đảo tiếp bút toán phạt trả sách 15k
  const revSettle = await createDocumentCorrection(
    db,
    {
      originalEntryId: settlementFineJe.id,
      reason: 'Miễn tiền phạt trả sách theo đơn bảo lưu',
      cashSessionId: 'CS-SESSION-TEST-01',
      paymentConfirmed: true,
    },
    actorId
  );
  assert.ok(revSettle.reversalEntryId);

  // Kiểm tra: loan_settlements cập nhật sang PENDING, fine_collected = 0
  assert.strictEqual(BigInt(settlementRow.fine_collected), 0n);
  assert.strictEqual(BigInt(settlementRow.fine_pending_amount), 15000n);
  assert.strictEqual(settlementRow.fine_status, 'PENDING');

  // Chứng từ gốc bất biến, chứng từ đảo ghi nhận đầy đủ
  assert.strictEqual(BigInt(renewalFineJe.amount), 10000n);
  assert.strictEqual(BigInt(settlementFineJe.amount), 15000n);
});
