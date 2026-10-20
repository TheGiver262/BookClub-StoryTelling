import test from 'node:test';
import assert from 'node:assert';
import {
  FUND_IDS,
  ACCOUNT_CODES,
  assertSafeVndAmount,
  serializeVnd,
  MAX_SAFE_VND,
  type Queryable,
} from '../../src/server/finance/types.ts';
import {
  recordJournalEntry,
  recordReversal,
  getFundBalances,
} from '../../src/server/finance/ledger.ts';
import {
  receiveDeposit,
  requestDepositRefund,
  confirmDepositRefund,
  transferDepositAllocation,
  forfeitDeposit,
} from '../../src/server/finance/deposits.ts';
import {
  canonicalizeJson,
  computePayloadHash,
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
  IdempotencyPayloadMismatchError,
  IdempotencyConcurrentError,
} from '../../src/server/shared/idempotency.ts';

/**
 * Mock DB Harness giả lập Queryable cho Unit Tests (không yêu cầu PostgreSQL live).
 */
class MockDbQueryable implements Queryable {
  public journalEntries: any[] = [];
  public depositAllocations: any[] = [];
  public refundIntents: any[] = [];
  public idempotencyRecords: any[] = [];
  public cashSessions: any[] = [];

  public async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // 0. cash_sessions SELECT
    if (cleanSql.includes('FROM cash_sessions WHERE id = $1')) {
      const session = this.cashSessions.find((s) => s.id === params[0]);
      return { rows: session ? [{ ...session } as unknown as T] : [], rowCount: session ? 1 : 0 };
    }

    // 1. journal_entries INSERT
    if (cleanSql.startsWith('INSERT INTO journal_entries')) {
      const entry = {
        id: `mock-entry-${this.journalEntries.length + 1}`,
        entry_code: params[0],
        fund_id: params[1],
        source_type: params[2],
        source_id: params[3],
        debit_account: params[4],
        credit_account: params[5],
        amount: params[6],
        reversal_of_entry_id: params[7],
        cash_session_id: params[8] || null,
        notes: params[9] || null,
        created_by: params[10],
        created_at: new Date().toISOString(),
      };
      this.journalEntries.push(entry);
      return { rows: [entry as unknown as T], rowCount: 1 };
    }

    // 2. journal_entries SELECT ... FOR UPDATE (for reversal)
    if (cleanSql.includes('FROM journal_entries WHERE id = $1') && cleanSql.includes('FOR UPDATE')) {
      const id = params[0];
      const entry = this.journalEntries.find((e) => e.id === id);
      return { rows: entry ? [{ ...entry } as unknown as T] : [], rowCount: entry ? 1 : 0 };
    }

    // 3. journal_entries SELECT reversal check
    if (cleanSql.startsWith('SELECT id, entry_code FROM journal_entries WHERE reversal_of_entry_id = $1')) {
      const id = params[0];
      const reversals = this.journalEntries.filter((e) => e.reversal_of_entry_id === id);
      return { rows: reversals as unknown as T[], rowCount: reversals.length };
    }

    // 4. journal_entries SELECT by fund_id (for balance report)
    if (cleanSql.startsWith('SELECT debit_account, credit_account, amount FROM journal_entries WHERE fund_id = $1')) {
      const fundId = params[0];
      const matching = this.journalEntries.filter((e) => e.fund_id === fundId);
      return { rows: matching as unknown as T[], rowCount: matching.length };
    }

    // 5. deposit_allocations check existing (S04-01 duplicate deposit check)
    if (cleanSql.startsWith('SELECT id FROM deposit_allocations WHERE receipt_id = $1')) {
      const [receiptId, itemId] = params;
      const exists = this.depositAllocations.find(
        (a) =>
          a.receipt_id === receiptId &&
          (itemId === null ? a.item_id === null : a.item_id === itemId) &&
          (a.status === 'HELD' || a.status === 'PENDING_REFUND')
      );
      return { rows: exists ? [exists as unknown as T] : [], rowCount: exists ? 1 : 0 };
    }

    // 6. deposit_allocations INSERT
    if (cleanSql.startsWith('INSERT INTO deposit_allocations')) {
      const alloc = {
        id: `mock-alloc-${this.depositAllocations.length + 1}`,
        receipt_id: params[0],
        item_id: params[1],
        fund_id: params[2],
        original_amount: params[3],
        remaining_amount: params[4],
        status: 'HELD',
        payment_method: params[5],
        refund_method: null,
        transferred_to_receipt_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.depositAllocations.push(alloc);
      return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
    }

    // 7. refund_intents pending check (S04-01)
    if (cleanSql.startsWith('SELECT id FROM refund_intents WHERE allocation_id = $1 AND status = \'PENDING\'')) {
      const intent = this.refundIntents.find((i) => i.allocation_id === params[0] && i.status === 'PENDING');
      return { rows: intent ? [intent as unknown as T] : [], rowCount: intent ? 1 : 0 };
    }

    // 8. refund_intents INSERT
    if (cleanSql.startsWith('INSERT INTO refund_intents')) {
      const intent = {
        id: `mock-intent-${this.refundIntents.length + 1}`,
        allocation_id: params[0],
        amount: params[1],
        refund_method: params[2],
        status: 'PENDING',
        requested_by: params[3],
        confirmed_by: null,
        confirmed_at: null,
        cash_session_id: null,
        journal_entry_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.refundIntents.push(intent);
      return { rows: [{ ...intent } as unknown as T], rowCount: 1 };
    }

    // 9. refund_intents SELECT by ID
    if (cleanSql.startsWith('SELECT id, allocation_id, amount, refund_method, status') && cleanSql.includes('FROM refund_intents WHERE id = $1')) {
      const intent = this.refundIntents.find((i) => i.id === params[0]);
      return { rows: intent ? [{ ...intent } as unknown as T] : [], rowCount: intent ? 1 : 0 };
    }

    // 10. refund_intents UPDATE (Confirm)
    if (cleanSql.startsWith('UPDATE refund_intents')) {
      const [id, confirmedBy, sessionId, journalId] = params;
      const intent = this.refundIntents.find((i) => i.id === id);
      if (intent) {
        intent.status = 'CONFIRMED';
        intent.confirmed_by = confirmedBy;
        intent.confirmed_at = new Date().toISOString();
        intent.cash_session_id = sessionId;
        intent.journal_entry_id = journalId;
        intent.updated_at = new Date().toISOString();
        return { rows: [{ ...intent } as unknown as T], rowCount: 1 };
      }
    }

    // 11. deposit_allocations SELECT ... FOR UPDATE
    if (cleanSql.startsWith('SELECT * FROM deposit_allocations WHERE id = $1')) {
      const id = params[0];
      const alloc = this.depositAllocations.find((a) => a.id === id);
      return { rows: alloc ? [{ ...alloc } as unknown as T] : [], rowCount: alloc ? 1 : 0 };
    }

    // 12. deposit_allocations UPDATE
    if (cleanSql.startsWith('UPDATE deposit_allocations')) {
      if (cleanSql.includes("status = 'PENDING_REFUND'")) {
        const [id, refMethod] = params;
        const alloc = this.depositAllocations.find((a) => a.id === id);
        if (alloc) {
          alloc.status = 'PENDING_REFUND';
          alloc.refund_method = refMethod;
          alloc.updated_at = new Date().toISOString();
          return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
        }
      } else if (cleanSql.includes('transferred_to_receipt_id = $4')) {
        const [id, rem, status, targetReceipt] = params;
        const alloc = this.depositAllocations.find((a) => a.id === id);
        if (alloc) {
          alloc.remaining_amount = rem;
          alloc.status = status;
          alloc.transferred_to_receipt_id = targetReceipt;
          alloc.updated_at = new Date().toISOString();
          return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
        }
      } else if (cleanSql.includes('refund_method = $4')) {
        const [id, rem, status, refMethod] = params;
        const alloc = this.depositAllocations.find((a) => a.id === id);
        if (alloc) {
          alloc.remaining_amount = rem;
          alloc.status = status;
          alloc.refund_method = refMethod;
          alloc.updated_at = new Date().toISOString();
          return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
        }
      } else {
        const [id, rem, status] = params;
        const alloc = this.depositAllocations.find((a) => a.id === id);
        if (alloc) {
          alloc.remaining_amount = rem;
          alloc.status = status;
          alloc.updated_at = new Date().toISOString();
          return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
        }
      }
    }

    // cash_sessions UPDATE expected_closing_cash
    if (cleanSql.includes('UPDATE cash_sessions')) {
      const [sessionId, amount] = params;
      const s = this.cashSessions.find((cs) => cs.id === sessionId);
      if (s) {
        if (cleanSql.includes('expected_closing_cash = expected_closing_cash + $2')) {
          s.expected_closing_cash = (BigInt(s.expected_closing_cash || 0) + BigInt(amount)).toString();
        } else if (cleanSql.includes('expected_closing_cash = expected_closing_cash - $2')) {
          s.expected_closing_cash = (BigInt(s.expected_closing_cash || 0) - BigInt(amount)).toString();
        }
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    // 13. idempotency_records INSERT ... ON CONFLICT DO NOTHING
    if (cleanSql.startsWith('INSERT INTO idempotency_records') && cleanSql.includes('ON CONFLICT')) {
      const [actorId, operation, key, hash] = params;
      const exists = this.idempotencyRecords.find(
        (r) => r.actor_id === actorId && r.operation === operation && r.idempotency_key === key
      );
      if (exists) {
        return { rows: [], rowCount: 0 };
      }
      const rec = {
        id: `mock-idem-${this.idempotencyRecords.length + 1}`,
        actor_id: actorId,
        operation,
        idempotency_key: key,
        payload_hash: hash,
        status: 'PROCESSING',
        response_code: null,
        response_body: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.idempotencyRecords.push(rec);
      return { rows: [rec as unknown as T], rowCount: 1 };
    }

    // 14. idempotency_records SELECT ... FOR UPDATE
    if (cleanSql.startsWith('SELECT status, payload_hash, response_code, response_body FROM idempotency_records')) {
      const [actorId, operation, key] = params;
      const rec = this.idempotencyRecords.find(
        (r) => r.actor_id === actorId && r.operation === operation && r.idempotency_key === key
      );
      return { rows: rec ? [{ ...rec } as unknown as T] : [], rowCount: rec ? 1 : 0 };
    }

    // 15. idempotency_records UPDATE (complete / fail)
    if (cleanSql.startsWith('UPDATE idempotency_records')) {
      if (cleanSql.includes("status = 'COMPLETED'")) {
        const [actorId, operation, key, code, body] = params;
        const rec = this.idempotencyRecords.find(
          (r) => r.actor_id === actorId && r.operation === operation && r.idempotency_key === key
        );
        if (rec) {
          rec.status = 'COMPLETED';
          rec.response_code = code;
          rec.response_body = typeof body === 'string' ? JSON.parse(body) : body;
          return { rows: [], rowCount: 1 };
        }
      }
      if (cleanSql.includes("status = 'FAILED'")) {
        const [actorId, operation, key] = params;
        const rec = this.idempotencyRecords.find(
          (r) => r.actor_id === actorId && r.operation === operation && r.idempotency_key === key
        );
        if (rec) {
          rec.status = 'FAILED';
          return { rows: [], rowCount: 1 };
        }
      }
      if (cleanSql.includes("status = 'PROCESSING'")) {
        const [actorId, operation, key] = params;
        const rec = this.idempotencyRecords.find(
          (r) => r.actor_id === actorId && r.operation === operation && r.idempotency_key === key
        );
        if (rec) {
          rec.status = 'PROCESSING';
          return { rows: [], rowCount: 1 };
        }
      }
    }

    throw new Error(`Unhandled mock SQL query: ${sql}`);
  }
}

test('G-finance 1: VND bounds and safe money assertions', () => {
  // Valid amounts
  assert.strictEqual(assertSafeVndAmount(50000), 50000n);
  assert.strictEqual(assertSafeVndAmount(150000n), 150000n);
  assert.strictEqual(assertSafeVndAmount('250000'), 250000n);
  assert.strictEqual(assertSafeVndAmount(0, { allowZero: true }), 0n);

  // Rejected invalid amounts
  assert.throws(() => assertSafeVndAmount(0), /phải lớn hơn 0/);
  assert.throws(() => assertSafeVndAmount(-50000), /phải lớn hơn 0/);
  assert.throws(() => assertSafeVndAmount(-10n, { allowZero: true }), /không được âm/);
  assert.throws(() => assertSafeVndAmount(100.5), /không chấp nhận phân số/);
  assert.throws(() => assertSafeVndAmount(NaN), /không chấp nhận NaN/);
  assert.throws(() => assertSafeVndAmount(Infinity), /không chấp nhận NaN/);
  assert.throws(() => assertSafeVndAmount('abc'), /không phải số nguyên/);
  assert.throws(() => assertSafeVndAmount(MAX_SAFE_VND + 1n), /vượt quá giới hạn an toàn/);

  // Safe serialization
  assert.strictEqual(serializeVnd(150000n), 150000);
});

test('G-finance 2: Double-entry ledger invariants and fund isolation', async () => {
  const db = new MockDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const cashSessionId = 'CS-MOCK-ACTIVE';
  db.cashSessions.push({
    id: cashSessionId,
    session_date: '2026-10-18',
    opened_by: actorId,
    opened_at: new Date().toISOString(),
    opening_cash: '0',
    expected_closing_cash: '0',
    actual_closing_cash: null,
    discrepancy: null,
    discrepancy_reason: null,
    is_closed: false,
    closed_at: null,
    closed_by: null,
    handed_over_from_session_id: null,
  });

  // 1. Create valid entry for FUND_LOAN
  const entry1 = await recordJournalEntry(db, {
    entryCode: 'BT-LOAN-001',
    fundId: FUND_IDS.LOAN,
    sourceType: 'LOAN_DEPOSIT',
    sourceId: 'rec-001',
    debitAccount: ACCOUNT_CODES.CASH_DRAWER,
    creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    amount: 150000,
    cashSessionId,
    createdBy: actorId,
  });
  assert.strictEqual(entry1.amount, 150000n);
  assert.strictEqual(entry1.fund_id, FUND_IDS.LOAN);

  // 2. Debit and credit cannot be same
  await assert.rejects(
    () =>
      recordJournalEntry(db, {
        entryCode: 'BT-INVALID-001',
        fundId: FUND_IDS.LOAN,
        sourceType: 'LOAN_DEPOSIT',
        sourceId: 'rec-001',
        debitAccount: ACCOUNT_CODES.CASH_DRAWER,
        creditAccount: ACCOUNT_CODES.CASH_DRAWER,
        amount: 50000,
        createdBy: actorId,
      }),
    /Tài khoản Nợ và Có không được trùng nhau/
  );

  // 3. Fund isolation: FUND_LOAN cannot use member fee (HOI_PHI)
  await assert.rejects(
    () =>
      recordJournalEntry(db, {
        entryCode: 'BT-CROSS-FUND-001',
        fundId: FUND_IDS.LOAN,
        sourceType: 'LOAN_DEPOSIT',
        sourceId: 'rec-001',
        debitAccount: ACCOUNT_CODES.CASH_DRAWER,
        creditAccount: ACCOUNT_CODES.MEMBER_FEE,
        amount: 50000,
        createdBy: actorId,
      }),
    /không thuộc danh mục hợp lệ của quỹ 'FUND_LOAN'/
  );

  // 4. FUND_OPERATION cannot use reader deposit liability (COC_PHAI_HOAN)
  await assert.rejects(
    () =>
      recordJournalEntry(db, {
        entryCode: 'BT-CROSS-FUND-002',
        fundId: FUND_IDS.OPERATION,
        sourceType: 'OPERATION_TEST',
        sourceId: 'op-001',
        debitAccount: ACCOUNT_CODES.CASH_DRAWER,
        creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
        amount: 50000,
        createdBy: actorId,
      }),
    /không thuộc danh mục hợp lệ của quỹ 'FUND_OPERATION'/
  );

  // 5. Balance report validates fundamental accounting equation (Total Debit = Total Credit)
  const balances = await getFundBalances(db, FUND_IDS.LOAN);
  assert.strictEqual(balances.isBalanced, true);
  assert.strictEqual(balances.totalDebit, 150000n);
  assert.strictEqual(balances.totalCredit, 150000n);
  assert.strictEqual(balances.accounts[ACCOUNT_CODES.CASH_DRAWER]?.netBalance, 150000n);
  assert.strictEqual(balances.accounts[ACCOUNT_CODES.DEPOSIT_LIABILITY]?.netBalance, 150000n);

  // 6a. S04-02 Invariant: Direct reversal of reader deposit entry is rejected to protect liability reconciliation
  await assert.rejects(
    () =>
      recordReversal(db, {
        originalEntryId: entry1.id,
        reversalEntryCode: 'BT-LOAN-REV-DIRECT',
        reason: 'Nhập sai số tiền cọc',
        createdBy: actorId,
      }),
    /phải được đảo thông qua quy trình đảo nguồn nghiệp vụ tương ứng/
  );

  // 6b. Tạo bút toán thu hội phí trên FUND_OPERATION để kiểm tra đảo sổ cái độc lập
  const entryOp = await recordJournalEntry(db, {
    entryCode: 'BT-OP-001',
    fundId: FUND_IDS.OPERATION,
    sourceType: 'MEMBER_FEE',
    sourceId: 'fee-001',
    debitAccount: ACCOUNT_CODES.CASH_DRAWER,
    creditAccount: ACCOUNT_CODES.MEMBER_FEE,
    amount: 50000,
    createdBy: actorId,
  });

  // 6c. Record Reversal swaps debit and credit
  const reversal = await recordReversal(db, {
    originalEntryId: entryOp.id,
    reversalEntryCode: 'BT-OP-REV-001',
    reason: 'Nhập sai thu hội phí',
    createdBy: actorId,
  });
  assert.strictEqual(reversal.debit_account, ACCOUNT_CODES.MEMBER_FEE);
  assert.strictEqual(reversal.credit_account, ACCOUNT_CODES.CASH_DRAWER);
  assert.strictEqual(reversal.amount, 50000n);
  assert.strictEqual(reversal.reversal_of_entry_id, entryOp.id);

  // 7. Cannot reverse the same entry twice
  await assert.rejects(
    () =>
      recordReversal(db, {
        originalEntryId: entryOp.id,
        reversalEntryCode: 'BT-OP-REV-002',
        reason: 'Thử đảo lần 2',
        createdBy: actorId,
      }),
    /đã được đảo trước đó/
  );

  // 8. Cannot reverse a reversal
  await assert.rejects(
    () =>
      recordReversal(db, {
        originalEntryId: reversal.id,
        reversalEntryCode: 'BT-OP-REV-003',
        reason: 'Thử đảo bút toán đảo',
        createdBy: actorId,
      }),
    /Không thể đảo một bút toán bản thân nó đã là bút toán đảo/
  );
});

test('G-finance 3: Deposit lifecycle, partial refund, cross-method, and carry-forward', async () => {
  const db = new MockDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const cashSessionId = 'CS-MOCK-ACTIVE';
  db.cashSessions.push({
    id: cashSessionId,
    session_date: '2026-10-18',
    opened_by: actorId,
    opened_at: new Date().toISOString(),
    opening_cash: '0',
    expected_closing_cash: '0',
    actual_closing_cash: null,
    discrepancy: null,
    discrepancy_reason: null,
    is_closed: false,
    closed_at: null,
    closed_by: null,
    handed_over_from_session_id: null,
  });

  // 1. Nhận cọc 150k bằng TIỀN MẶT
  const alloc = await receiveDeposit(db, {
    receiptId: 'receipt-100',
    amount: 150000,
    paymentMethod: 'CASH',
    cashSessionId,
    createdBy: actorId,
    entryCode: 'BT-DEP-001',
  });
  assert.strictEqual(alloc.original_amount, 150000n);
  assert.strictEqual(alloc.remaining_amount, 150000n);
  assert.strictEqual(alloc.status, 'HELD');
  assert.strictEqual(alloc.payment_method, 'CASH');

  // Kiểm tra bút toán nhận cọc: Nợ TIEN_MAT_HOP 150k, Có COC_PHAI_HOAN 150k (Không phải thu nhập!)
  const depEntry = db.journalEntries.find((e) => e.entry_code === 'BT-DEP-001');
  assert.ok(depEntry);
  assert.strictEqual(depEntry.debit_account, ACCOUNT_CODES.CASH_DRAWER);
  assert.strictEqual(depEntry.credit_account, ACCOUNT_CODES.DEPOSIT_LIABILITY);
  assert.strictEqual(depEntry.amount, '150000');

  // 2. Đề xuất hoàn cọc 50k (PENDING_REFUND)
  const reqRes = await requestDepositRefund(db, {
    allocationId: alloc.id,
    refundAmount: 50000,
    refundMethod: 'BANK_TRANSFER', // Nhận tiền mặt nhưng hoàn bằng chuyển khoản
    requestedBy: actorId,
  });
  const pendingAlloc = reqRes.allocation;
  const intent = reqRes.intent;
  assert.strictEqual(pendingAlloc.status, 'PENDING_REFUND');
  assert.strictEqual(pendingAlloc.refund_method, 'BANK_TRANSFER');
  // Invariant: Trạng thái PENDING_REFUND vẫn giữ nguyên remaining_amount (nghĩa vụ chưa giảm khi chưa chi thực tế)
  assert.strictEqual(pendingAlloc.remaining_amount, 150000n);

  // 3. Xác nhận hoàn cọc 50k theo ID ý định
  const confRes = await confirmDepositRefund(db, {
    refundIntentId: intent.id,
    createdBy: actorId,
    entryCode: 'BT-REFUND-001',
  });
  const refundedAlloc = confRes.allocation;
  assert.strictEqual(refundedAlloc.remaining_amount, 100000n);
  assert.strictEqual(refundedAlloc.status, 'HELD'); // Còn lại 100k nên quay lại HELD

  // Kiểm tra bút toán hoàn cọc: Nợ COC_PHAI_HOAN 50k, Có TIEN_NGAN_HANG 50k (Giảm tiền ngân hàng đúng method)
  const refEntry = db.journalEntries.find((e) => e.entry_code === 'BT-REFUND-001');
  assert.ok(refEntry);
  assert.strictEqual(refEntry.debit_account, ACCOUNT_CODES.DEPOSIT_LIABILITY);
  assert.strictEqual(refEntry.credit_account, ACCOUNT_CODES.BANK_MAIN);
  assert.strictEqual(refEntry.amount, '50000');

  // 4. Không thể yêu cầu hoàn vượt quá số dư còn lại (100k)
  await assert.rejects(
    () =>
      requestDepositRefund(db, {
        allocationId: alloc.id,
        refundAmount: 120000,
        refundMethod: 'CASH',
        requestedBy: actorId,
      }),
    /vượt quá số dư cọc còn lại/
  );

  // 5. Chuyển liên kết cọc 100k sang phiếu mới (Carry-forward - Use Case 3)
  const transferRes = await transferDepositAllocation(db, {
    sourceAllocationId: alloc.id,
    targetReceiptId: 'receipt-200',
    transferAmount: 100000,
    createdBy: actorId,
  });
  assert.strictEqual(transferRes.sourceAllocation.status, 'TRANSFERRED');
  assert.strictEqual(transferRes.sourceAllocation.remaining_amount, 0n);
  assert.strictEqual(transferRes.sourceAllocation.transferred_to_receipt_id, 'receipt-200');

  assert.strictEqual(transferRes.targetAllocation.receipt_id, 'receipt-200');
  assert.strictEqual(transferRes.targetAllocation.original_amount, 100000n);
  assert.strictEqual(transferRes.targetAllocation.remaining_amount, 100000n);
  assert.strictEqual(transferRes.targetAllocation.status, 'HELD');

  // Invariant: Chuyển cọc KHÔNG phát sinh thêm bất kỳ bút toán thu/chi tiền mặt hay ngân hàng nào!
  const journalCountAfterTransfer = db.journalEntries.length;
  assert.strictEqual(journalCountAfterTransfer, 2); // Chỉ có 2 bút toán: nhận cọc và hoàn 50k

  // 6. Khoản cọc đã tiêu hết (remaining = 0) không thể chuyển liên kết tiếp
  await assert.rejects(
    () =>
      transferDepositAllocation(db, {
        sourceAllocationId: alloc.id,
        targetReceiptId: 'receipt-300',
        createdBy: actorId,
      }),
    /Khoản cọc nguồn đang ở trạng thái 'TRANSFERRED'/
  );

  // 7. Cấn trừ cọc (forfeit) sang phạt (Use Case 2/3 ngoại lệ, tuân thủ S04-06 Forfeit Policy)
  const forfeitAlloc = await forfeitDeposit(db, {
    allocationId: transferRes.targetAllocation.id,
    forfeitAmount: 60000,
    policy: {
      targetFundId: FUND_IDS.LOAN,
      targetAccount: ACCOUNT_CODES.FINE_REVENUE,
      reason: 'Phạt quá hạn 60 ngày',
      policyVersion: 'v1.0-test',
    },
    createdBy: actorId,
    entryCode: 'BT-FORFEIT-001',
  });
  assert.strictEqual(forfeitAlloc.remaining_amount, 40000n);
  assert.strictEqual(forfeitAlloc.status, 'HELD');

  // Bút toán cấn trừ: Nợ COC_PHAI_HOAN 60k, Có THU_PHAT 60k (Không tác động tiền mặt / ngân hàng)
  const forfeitEntry = db.journalEntries.find((e) => e.entry_code === 'BT-FORFEIT-001');
  assert.ok(forfeitEntry);
  assert.strictEqual(forfeitEntry.debit_account, ACCOUNT_CODES.DEPOSIT_LIABILITY);
  assert.strictEqual(forfeitEntry.credit_account, ACCOUNT_CODES.FINE_REVENUE);
  assert.strictEqual(forfeitEntry.amount, '60000');
});

test('G-finance 4: Shared Idempotency canonical hashing and concurrency lifecycle', async () => {
  const db = new MockDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';
  const operation = 'finance.deposit.receive';
  const idempotencyKey = 'key-test-uuid-001';

  // 1. Canonical hashing: Objects with different key orders produce identical hash and canonical string
  const payload1 = { amount: 150000, receiptId: 'rec-001', method: 'CASH' };
  const payload2 = { method: 'CASH', receiptId: 'rec-001', amount: 150000 };
  assert.strictEqual(canonicalizeJson(payload1), canonicalizeJson(payload2));
  const hash1 = computePayloadHash(payload1);
  const hash2 = computePayloadHash(payload2);
  assert.strictEqual(hash1, hash2, 'Hash must be identical regardless of key order');

  // Different payload produces different hash
  const hashDifferent = computePayloadHash({ ...payload1, amount: 200000 });
  assert.notStrictEqual(hash1, hashDifferent);

  // 2. Fresh key is CLAIMED
  const claim1 = await claimIdempotency(db, actorId, operation, idempotencyKey, hash1);
  assert.strictEqual(claim1.action, 'CLAIMED');

  // 3. Concurrent request with same key while PROCESSING throws 409 Concurrent
  await assert.rejects(
    () => claimIdempotency(db, actorId, operation, idempotencyKey, hash1),
    (err: any) => err instanceof IdempotencyConcurrentError
  );

  // 4. Same key with different payload throws 409 Payload Mismatch
  await assert.rejects(
    () => claimIdempotency(db, actorId, operation, idempotencyKey, hashDifferent),
    (err: any) => err instanceof IdempotencyPayloadMismatchError
  );

  // 5. Complete idempotency with response
  await completeIdempotency(db, actorId, operation, idempotencyKey, 201, {
    receiptId: 'rec-001',
    depositAllocated: 150000,
  });

  // 6. Subsequent request with same key and same payload returns CACHED response without re-executing
  const replay = await claimIdempotency(db, actorId, operation, idempotencyKey, hash1);
  assert.strictEqual(replay.action, 'RETURN_CACHED');
  assert.strictEqual(replay.responseCode, 201);
  assert.deepStrictEqual(replay.responseBody, {
    receiptId: 'rec-001',
    depositAllocated: 150000,
  });

  // 7. Same key under different actor or different operation is treated independently
  const differentActorId = '00000000-0000-0000-0000-000000000002';
  const claimDiffActor = await claimIdempotency(db, differentActorId, operation, idempotencyKey, hash1);
  assert.strictEqual(claimDiffActor.action, 'CLAIMED');

  const claimDiffOp = await claimIdempotency(db, actorId, 'finance.deposit.refund', idempotencyKey, hash1);
  assert.strictEqual(claimDiffOp.action, 'CLAIMED');

  // 8. Transaction failure marks key FAILED and allows safe retry
  await failIdempotency(db, actorId, 'finance.deposit.refund', idempotencyKey);
  const retryClaim = await claimIdempotency(db, actorId, 'finance.deposit.refund', idempotencyKey, hash1);
  assert.strictEqual(retryClaim.action, 'CLAIMED');
});
