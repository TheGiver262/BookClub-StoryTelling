import test from 'node:test';
import assert from 'node:assert';
import {
  FUND_IDS,
  ACCOUNT_CODES,
} from '../../src/server/finance/types.ts';
import {
  recordJournalEntry,
  assertLiabilityReconciliation,
} from '../../src/server/finance/ledger.ts';
import {
  receiveDeposit,
  requestDepositRefund,
  confirmDepositRefund,
  forfeitDeposit,
} from '../../src/server/finance/deposits.ts';
import {
  openCashSession,
  getCurrentCashSession,
  getCashSessionSummary,
  closeCashSession,
  ActiveSessionExistsError,
  SessionAlreadyClosedError,
  DiscrepancyReasonRequiredError,
} from '../../src/server/finance/cash-sessions.ts';

import { MockCashDbQueryable } from './mock-db-helper.ts';

test('G-session 1: Opening session, opening float, and single active session constraint', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  // 1. Mở phiên quầy thành công với opening float 200k
  const session = await openCashSession(db, {
    sessionId: 'CS-20261018-01',
    sessionDate: '2026-10-18',
    openedBy: actorId,
    openingCash: 200000,
  });

  assert.strictEqual(session.id, 'CS-20261018-01');
  assert.strictEqual(session.opening_cash, 200000n);
  assert.strictEqual(session.expected_closing_cash, 200000n);
  assert.strictEqual(session.is_closed, false);

  // Invariant: Lần đầu mở ca xác lập opening float KHÔNG ghi nhận thành doanh thu hay thu cọc trên sổ cái!
  assert.strictEqual(db.journalEntries.length, 0);

  // 2. Thử mở ca thứ hai khi ca cũ chưa đóng -> Bị từ chối bởi ActiveSessionExistsError
  await assert.rejects(
    () =>
      openCashSession(db, {
        sessionId: 'CS-20261018-02',
        sessionDate: '2026-10-18',
        openedBy: actorId,
        openingCash: 300000,
      }),
    (err: any) => err instanceof ActiveSessionExistsError
  );

  // 3. Tra cứu ca đang mở
  const current = await getCurrentCashSession(db);
  assert.ok(current);
  assert.strictEqual(current.id, 'CS-20261018-01');
});

test('G-session 2: Opening 200k, Cash In 50k, Bank In 100k -> expected cash 250k, bank separated', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const sessionId = 'CS-20261018-01';

  await openCashSession(db, {
    sessionId,
    sessionDate: '2026-10-18',
    openedBy: actorId,
    openingCash: 200000,
  });

  // 1. Nhận cọc 50k TIỀN MẶT
  await receiveDeposit(db, {
    receiptId: 'rec-001',
    itemId: 'item-001',
    amount: 50000,
    paymentMethod: 'CASH',
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-DEP-CASH-50K',
  });

  // 2. Nhận cọc 100k CHUYỂN KHOẢN (Bank)
  await receiveDeposit(db, {
    receiptId: 'rec-002',
    itemId: 'item-002',
    amount: 100000,
    paymentMethod: 'BANK_TRANSFER',
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-DEP-BANK-100K',
  });

  // 3. Tổng kết ca:
  const summary = await getCashSessionSummary(db, sessionId);
  assert.strictEqual(summary.session.opening_cash, 200000n);
  assert.strictEqual(summary.cashIn, 50000n);
  assert.strictEqual(summary.cashOut, 0n);
  assert.strictEqual(summary.expectedCash, 250000n); // 200k + 50k

  // Bank flow được báo cáo riêng biệt, KHÔNG cộng vào hộp tiền mặt quầy
  assert.strictEqual(summary.bankIn, 100000n);
  assert.strictEqual(summary.depositLiabilitiesCreated, 150000n);

  // 4. Đối soát sổ cái nghĩa vụ
  const reconcil = await assertLiabilityReconciliation(db);
  assert.strictEqual(reconcil.isReconciled, true);
  assert.strictEqual(reconcil.totalAllocations, 150000n);
  assert.strictEqual(reconcil.ledgerLiabilityBalance, 150000n);
});

test('G-session 3: Cash In 100k, Cash Out 100k, Fine 3k with configured policy -> expected cash 203k', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const sessionId = 'CS-20261018-01';

  await openCashSession(db, {
    sessionId,
    sessionDate: '2026-10-18',
    openedBy: actorId,
    openingCash: 200000,
  });

  // 1. Thu cọc 100k tiền mặt
  const alloc = await receiveDeposit(db, {
    receiptId: 'rec-003',
    itemId: 'item-003',
    amount: 100000,
    paymentMethod: 'CASH',
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-DEP-100K',
  });

  // 2. Yêu cầu hoàn 100k tiền mặt (tạo intent)
  const reqRes = await requestDepositRefund(db, {
    allocationId: alloc.id,
    refundAmount: 100000,
    refundMethod: 'CASH',
    requestedBy: actorId,
  });

  // 3. Xác nhận hoàn 100k tiền mặt theo intent
  await confirmDepositRefund(db, {
    refundIntentId: reqRes.intent.id,
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-REF-100K',
  });

  // 4. Thu riêng tiền phạt 3k tiền mặt vào Quỹ Mượn-Trả (với policy test chỉ định rõ)
  await recordJournalEntry(db, {
    entryCode: 'BT-FINE-3K',
    fundId: FUND_IDS.LOAN,
    sourceType: 'FINE_COLLECTION',
    sourceId: 'rec-003',
    debitAccount: ACCOUNT_CODES.CASH_DRAWER,
    creditAccount: ACCOUNT_CODES.FINE_REVENUE,
    amount: 3000,
    cashSessionId: sessionId,
    notes: 'Phạt quá hạn 3 ngày (1k/ngày)',
    createdBy: actorId,
  });

  // Tổng kết ca: 200k + 100k (cọc) - 100k (hoàn cọc) + 3k (thu phạt) = 203.000 ₫
  const summary = await getCashSessionSummary(db, sessionId);
  assert.strictEqual(summary.cashIn, 103000n);
  assert.strictEqual(summary.cashOut, 100000n);
  assert.strictEqual(summary.expectedCash, 203000n);

  // Đối soát nghĩa vụ cọc: Đã hoàn hết 100k nên nghĩa vụ cọc = 0
  const reconcil = await assertLiabilityReconciliation(db);
  assert.strictEqual(reconcil.isReconciled, true);
  assert.strictEqual(reconcil.totalAllocations, 0n);
  assert.strictEqual(reconcil.ledgerLiabilityBalance, 0n);
});

test('G-session 4: S04-01 regression: Duplicate deposit rejected; intent double confirmation blocked', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const sessionId = 'CS-20261018-01';

  await openCashSession(db, {
    sessionId,
    sessionDate: '2026-10-18',
    openedBy: actorId,
    openingCash: 200000,
  });

  // 1. Nhận cọc lần 1 cho cuốn sách item-001 trên receipt-001
  const alloc = await receiveDeposit(db, {
    receiptId: 'receipt-001',
    itemId: 'item-001',
    amount: 150000,
    paymentMethod: 'CASH',
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-DEP-ORIGINAL',
  });

  // S04-01: Gửi lại cùng receipt/item với entryCode khác bị từ chối
  await assert.rejects(
    () =>
      receiveDeposit(db, {
        receiptId: 'receipt-001',
        itemId: 'item-001',
        amount: 150000,
        paymentMethod: 'CASH',
        cashSessionId: sessionId,
        createdBy: actorId,
        entryCode: 'BT-DEP-DUPLICATE',
      }),
    /đã có một khoản tiền cọc đang hoạt động/
  );

  // 2. Yêu cầu hoàn 50k (Intent 1)
  const refundReq = await requestDepositRefund(db, {
    allocationId: alloc.id,
    refundAmount: 50000,
    refundMethod: 'CASH',
    requestedBy: actorId,
  });

  // S04-01: Không cho tạo thêm intent mới khi intent cũ đang PENDING
  await assert.rejects(
    () =>
      requestDepositRefund(db, {
        allocationId: alloc.id,
        refundAmount: 50000,
        refundMethod: 'CASH',
        requestedBy: actorId,
      }),
    /đang ở trạng thái 'PENDING_REFUND'|đã có một yêu cầu hoàn đang chờ xác nhận/
  );

  // 3. Xác nhận hoàn intent 1 lần đầu -> Thành công
  await confirmDepositRefund(db, {
    refundIntentId: refundReq.intent.id,
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-CONFIRM-1',
  });

  // S04-01: Xác nhận lại đúng intent đó lần 2 với entryCode khác -> Bắt buộc bị từ chối, không trừ cọc lần 2!
  await assert.rejects(
    () =>
      confirmDepositRefund(db, {
        refundIntentId: refundReq.intent.id,
        cashSessionId: sessionId,
        createdBy: actorId,
        entryCode: 'BT-CONFIRM-2',
      }),
    /đã được xác nhận chi trả trước đó/
  );

  // Nghĩa vụ còn lại chính xác là 100k (không bị trừ thành 50k!)
  const checkAlloc = db.depositAllocations.find((a) => a.id === alloc.id);
  assert.strictEqual(BigInt(checkAlloc.remaining_amount), 100000n);
});

test('G-session 5: S04-06 regression: Forfeit requires explicit configured policy and blocks PENDING_REFUND', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  const alloc = await receiveDeposit(db, {
    receiptId: 'rec-005',
    itemId: 'item-005',
    amount: 150000,
    paymentMethod: 'BANK_TRANSFER',
    createdBy: actorId,
    entryCode: 'BT-DEP-FORFEIT-TEST',
  });

  // S04-06: Thiếu policy cấu hình bị chặn
  await assert.rejects(
    () =>
      forfeitDeposit(db, {
        allocationId: alloc.id,
        forfeitAmount: 50000,
        policy: null as any,
        createdBy: actorId,
        entryCode: 'BT-FORFEIT-NO-POLICY',
      }),
    /Chính sách quỹ thụ hưởng tiền phạt\/mất sách chưa được CLB chốt/
  );

  // Tạo yêu cầu hoàn cọc 50k
  await requestDepositRefund(db, {
    allocationId: alloc.id,
    refundAmount: 50000,
    refundMethod: 'BANK_TRANSFER',
    requestedBy: actorId,
  });

  // S04-06: Chặn cấn trừ khi cọc đang có yêu cầu hoàn PENDING_REFUND
  await assert.rejects(
    () =>
      forfeitDeposit(db, {
        allocationId: alloc.id,
        forfeitAmount: 50000,
        policy: {
          targetFundId: FUND_IDS.LOAN,
          targetAccount: ACCOUNT_CODES.FINE_REVENUE,
          reason: 'Phạt quá hạn',
          policyVersion: 'v1.0-test',
        },
        createdBy: actorId,
        entryCode: 'BT-FORFEIT-BLOCKED',
      }),
    /đang có yêu cầu hoàn chờ xác nhận/
  );
});

test('G-session 6: Closing session with discrepancy, mandatory reason, and handover to next session', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const sessionId = 'CS-20261018-01';

  await openCashSession(db, {
    sessionId,
    sessionDate: '2026-10-18',
    openedBy: actorId,
    openingCash: 200000,
  });

  // Thu cọc 50k cash -> expected = 250k
  await receiveDeposit(db, {
    receiptId: 'rec-006',
    itemId: 'item-006',
    amount: 50000,
    paymentMethod: 'CASH',
    cashSessionId: sessionId,
    createdBy: actorId,
    entryCode: 'BT-DEP-250K',
  });

  // 1. Thực đếm 245k (lệch -5k) mà không có lý do giải trình -> Bị chặn
  await assert.rejects(
    () =>
      closeCashSession(db, {
        sessionId,
        closedBy: actorId,
        actualClosingCash: 245000,
        discrepancyReason: '',
      }),
    (err: any) => err instanceof DiscrepancyReasonRequiredError
  );

  // 2. Đóng ca với lý do giải trình hợp lệ
  const closeSummary = await closeCashSession(db, {
    sessionId,
    closedBy: actorId,
    actualClosingCash: 245000,
    discrepancyReason: 'Thối nhầm 5.000 ₫ cho bạn đọc',
  });

  assert.strictEqual(closeSummary.session.is_closed, true);
  assert.strictEqual(closeSummary.expectedCash, 250000n);
  assert.strictEqual(closeSummary.actualCash, 245000n);
  assert.strictEqual(closeSummary.discrepancy, -5000n);
  assert.strictEqual(closeSummary.discrepancyReason, 'Thối nhầm 5.000 ₫ cho bạn đọc');

  // Invariant: Không sửa journal để ép khớp chênh lệch!
  const cashInTotal = closeSummary.cashIn;
  assert.strictEqual(cashInTotal, 50000n);

  // 3. Thử đóng lại ca đã đóng -> Bị chặn bởi SessionAlreadyClosedError
  await assert.rejects(
    () =>
      closeCashSession(db, {
        sessionId,
        closedBy: actorId,
        actualClosingCash: 245000,
        discrepancyReason: 'Thử đóng lần 2',
      }),
    (err: any) => err instanceof SessionAlreadyClosedError
  );

  // 4. Mở ca tiếp theo bàn giao từ ca trước (Handover)
  // Ca sau đếm đúng 245k bàn giao từ ca trước -> Thành công
  const nextSession = await openCashSession(db, {
    sessionId: 'CS-20261020-01',
    sessionDate: '2026-10-20',
    openedBy: actorId,
    openingCash: 245000,
    handedOverFromSessionId: sessionId,
  });
  assert.strictEqual(nextSession.opening_cash, 245000n);
  assert.strictEqual(nextSession.handed_over_from_session_id, sessionId);
});
