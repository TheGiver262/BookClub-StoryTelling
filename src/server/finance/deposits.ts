/**
 * YSBK Core Finance: Deposit Allocations & Liabilities (Quản lý Phân Bổ & Nghĩa Vụ Cọc)
 * Quản lý vòng đời tiền cọc bạn đọc thuộc Quỹ Mượn–Trả (FUND_LOAN):
 * HELD -> PENDING_REFUND -> REFUNDED | FORFEITED | TRANSFERRED.
 * Đồng bộ tuyệt đối giữa trạng thái nghĩa vụ cọc, ý định hoàn (Refund Intent), và bút toán sổ kép.
 */

import {
  type DepositAllocation,
  type DepositStatus,
  type PaymentMethod,
  type Queryable,
  type RefundIntent,
  type ForfeitPolicyConfig,
  FUND_IDS,
  ACCOUNT_CODES,
  assertSafeVndAmount,
} from './types.ts';
import { recordJournalEntry, recordReversal, assertLiabilityReconciliation } from './ledger.ts';

export class DepositError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus = 400) {
    super(message);
    this.name = 'DepositError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface ReceiveDepositParams {
  receiptId: string;
  itemId?: string | null;
  amount: bigint | number | string;
  paymentMethod: PaymentMethod;
  createdBy: string;
  entryCode: string;
  cashSessionId?: string | null;
}

export interface RequestRefundParams {
  allocationId: string;
  refundAmount: bigint | number | string;
  refundMethod: PaymentMethod;
  requestedBy: string;
}

export interface ConfirmRefundParams {
  refundIntentId: string;
  createdBy: string;
  entryCode: string;
  cashSessionId?: string | null;
}

export interface TransferDepositParams {
  sourceAllocationId: string;
  targetReceiptId: string;
  targetItemId?: string | null;
  transferAmount?: bigint | number | string;
  createdBy: string;
}

export interface ForfeitDepositParams {
  allocationId: string;
  forfeitAmount: bigint | number | string;
  policy: ForfeitPolicyConfig;
  createdBy: string;
  entryCode: string;
}

export interface ReverseDepositParams {
  allocationId: string;
  reversalEntryCode: string;
  reason: string;
  createdBy: string;
  targetCashSessionId?: string | null;
}

function mapAllocationRow(row: any): DepositAllocation {
  return {
    id: row.id,
    receipt_id: row.receipt_id,
    item_id: row.item_id,
    fund_id: row.fund_id,
    original_amount: BigInt(row.original_amount),
    remaining_amount: BigInt(row.remaining_amount),
    status: row.status as DepositStatus,
    payment_method: row.payment_method as PaymentMethod,
    refund_method: row.refund_method as PaymentMethod | null,
    transferred_to_receipt_id: row.transferred_to_receipt_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapIntentRow(row: any): RefundIntent {
  return {
    id: row.id,
    allocation_id: row.allocation_id,
    amount: BigInt(row.amount),
    refund_method: row.refund_method as PaymentMethod,
    status: row.status as 'PENDING' | 'CONFIRMED' | 'CANCELLED',
    requested_by: row.requested_by,
    confirmed_by: row.confirmed_by,
    confirmed_at: row.confirmed_at,
    cash_session_id: row.cash_session_id,
    journal_entry_id: row.journal_entry_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * 1. Tiếp nhận khoản tiền cọc khi lập phiếu mượn (Use Case 1)
 * S04-01: Chặn nhận cọc trùng cho cùng phiếu / cuốn sách đang active.
 * Liên kết cash_session_id nếu thu bằng tiền mặt.
 */
export async function receiveDeposit(
  db: Queryable,
  params: ReceiveDepositParams
): Promise<DepositAllocation> {
  const {
    receiptId,
    itemId = null,
    amount,
    paymentMethod,
    createdBy,
    entryCode,
    cashSessionId = null,
  } = params;

  if (!receiptId || !createdBy || !entryCode || !paymentMethod) {
    throw new DepositError('Thiếu thông số bắt buộc để nhận tiền cọc.', 'MISSING_DEPOSIT_PARAMS');
  }

  if (paymentMethod !== 'CASH' && paymentMethod !== 'BANK_TRANSFER') {
    throw new DepositError(`Phương thức thanh toán '${paymentMethod}' không hợp lệ.`, 'INVALID_PAYMENT_METHOD');
  }

  // S05-01: Thu cọc bằng tiền mặt bắt buộc phải gắn với phiên quầy đang mở
  if (paymentMethod === 'CASH' && !cashSessionId) {
    throw new DepositError(
      'Thu cọc bằng tiền mặt bắt buộc phải gắn với phiên quầy đang mở.',
      'CASH_SESSION_REQUIRED',
      400
    );
  }

  const safeAmount = assertSafeVndAmount(amount);

  // S04-01: Chống nhận cọc trùng cho cùng cuốn sách / phiếu mượn đang active
  const existingCheck = await db.query<any>(
    `SELECT id FROM deposit_allocations
     WHERE receipt_id = $1 AND ((item_id IS NULL AND $2::uuid IS NULL) OR item_id = $2)
       AND status IN ('HELD', 'PENDING_REFUND')`,
    [receiptId, itemId]
  );

  if (existingCheck.rows && existingCheck.rows.length > 0) {
    throw new DepositError(
      'Phiếu mượn hoặc cuốn sách này đã có một khoản tiền cọc đang hoạt động.',
      'DUPLICATE_DEPOSIT_ALLOCATION'
    );
  }

  // 1. Chèn bản ghi phân bổ cọc
  const allocRes = await db.query<any>(
    `INSERT INTO deposit_allocations (
      receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method
    ) VALUES ($1, $2, $3, $4, $5, 'HELD', $6)
    RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [receiptId, itemId, FUND_IDS.LOAN, safeAmount.toString(), safeAmount.toString(), paymentMethod]
  );

  const allocation = mapAllocationRow(allocRes.rows[0]);

  // 2. Ghi bút toán sổ kép: Tăng tiền tài sản, Tăng nghĩa vụ cọc phải hoàn
  // S05-02: sourceId liên kết trực tiếp với allocation.id để định danh 1-1, chống nhầm lẫn khi phiếu có 2 cuốn
  const debitAccount =
    paymentMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;

  await recordJournalEntry(db, {
    entryCode,
    fundId: FUND_IDS.LOAN,
    sourceType: 'LOAN_DEPOSIT',
    sourceId: allocation.id,
    debitAccount,
    creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    amount: safeAmount,
    cashSessionId: cashSessionId || null,
    createdBy,
  });

  if (paymentMethod === 'CASH' && cashSessionId) {
    await db.query(
      `UPDATE cash_sessions
       SET expected_closing_cash = expected_closing_cash + $2
       WHERE id = $1`,
      [cashSessionId, safeAmount.toString()]
    );
  }

  return allocation;
}

/**
 * 2. Đề xuất hoàn cọc (S04-01: Tạo Refund Intent với ID, amount, method được lưu chuẩn)
 * Bất biến: Tiền chưa chi và nghĩa vụ chưa giảm khi còn ở trạng thái chờ xác nhận.
 */
export async function requestDepositRefund(
  db: Queryable,
  params: RequestRefundParams
): Promise<{ allocation: DepositAllocation; intent: RefundIntent }> {
  const { allocationId, refundAmount, refundMethod, requestedBy } = params;

  if (!allocationId || !refundMethod || !requestedBy) {
    throw new DepositError('Thiếu thông số yêu cầu hoàn cọc.', 'MISSING_REFUND_PARAMS');
  }

  const safeRefund = assertSafeVndAmount(refundAmount);

  // Khóa dòng allocation để chống race condition
  const selRes = await db.query<any>(
    `SELECT * FROM deposit_allocations WHERE id = $1 FOR UPDATE`,
    [allocationId]
  );

  const alloc = selRes.rows[0];
  if (!alloc) {
    throw new DepositError(`Không tìm thấy phân bổ cọc ID '${allocationId}'.`, 'ALLOCATION_NOT_FOUND', 404);
  }

  if (alloc.status !== 'HELD') {
    throw new DepositError(
      `Khoản cọc đang ở trạng thái '${alloc.status}', không thể yêu cầu hoàn trả.`,
      'INVALID_STATUS_FOR_REFUND'
    );
  }

  const remaining = BigInt(alloc.remaining_amount);
  if (safeRefund > remaining) {
    throw new DepositError(
      `Số tiền yêu cầu hoàn (${safeRefund.toString()} ₫) vượt quá số dư cọc còn lại (${remaining.toString()} ₫).`,
      'REFUND_EXCEEDS_REMAINING'
    );
  }

  // S04-01: Kiểm tra xem đã có ý định hoàn nào đang PENDING cho allocation này chưa
  const pendingIntent = await db.query<any>(
    `SELECT id FROM refund_intents WHERE allocation_id = $1 AND status = 'PENDING'`,
    [allocationId]
  );
  if (pendingIntent.rows && pendingIntent.rows.length > 0) {
    throw new DepositError(
      'Khoản cọc này đã có một yêu cầu hoàn đang chờ xác nhận.',
      'EXISTING_PENDING_REFUND_INTENT'
    );
  }

  // 1. Tạo bản ghi refund_intents với ID ổn định
  const intentRes = await db.query<any>(
    `INSERT INTO refund_intents (
      allocation_id, amount, refund_method, status, requested_by
    ) VALUES ($1, $2, $3, 'PENDING', $4)
    RETURNING id, allocation_id, amount, refund_method, status, requested_by, confirmed_by, confirmed_at, cash_session_id, journal_entry_id, created_at, updated_at`,
    [allocationId, safeRefund.toString(), refundMethod, requestedBy]
  );

  // 2. Chuyển trạng thái allocation sang PENDING_REFUND
  const updRes = await db.query<any>(
    `UPDATE deposit_allocations
     SET status = 'PENDING_REFUND',
         refund_method = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [allocationId, refundMethod]
  );

  return {
    allocation: mapAllocationRow(updRes.rows[0]),
    intent: mapIntentRow(intentRes.rows[0]),
  };
}

/**
 * 3. Xác nhận hoàn cọc thực tế (S04-01: Confirm theo ID ý định đã chốt)
 * - Khóa refund_intents FOR UPDATE: Chặn confirm 2 lần cùng một ý định.
 * - Khóa allocation FOR UPDATE.
 * - Giảm số dư nghĩa vụ cọc đúng bằng số tiền trong intent.
 * - Ghi bút toán sổ kép với cashSessionId (nếu hoàn bằng tiền mặt).
 */
export async function confirmDepositRefund(
  db: Queryable,
  params: ConfirmRefundParams
): Promise<{ allocation: DepositAllocation; intent: RefundIntent }> {
  const { refundIntentId, createdBy, entryCode, cashSessionId = null } = params;

  if (!refundIntentId || !createdBy || !entryCode) {
    throw new DepositError('Thiếu thông số xác nhận hoàn cọc.', 'MISSING_CONFIRM_PARAMS');
  }

  // 1. Khóa bản ghi ý định hoàn cọc FOR UPDATE
  const intentSel = await db.query<any>(
    `SELECT id, allocation_id, amount, refund_method, status, requested_by, confirmed_by, confirmed_at, cash_session_id, journal_entry_id, created_at, updated_at
     FROM refund_intents
     WHERE id = $1
     FOR UPDATE`,
    [refundIntentId]
  );

  const intentRow = intentSel.rows[0];
  if (!intentRow) {
    throw new DepositError(`Không tìm thấy yêu cầu hoàn cọc ID '${refundIntentId}'.`, 'REFUND_INTENT_NOT_FOUND', 404);
  }

  // S04-01: Chống confirm hai lần cho cùng một ý định hoàn
  if (intentRow.status === 'CONFIRMED') {
    throw new DepositError(
      `Yêu cầu hoàn cọc ID '${refundIntentId}' đã được xác nhận chi trả trước đó.`,
      'REFUND_INTENT_ALREADY_CONFIRMED'
    );
  }

  if (intentRow.status !== 'PENDING') {
    throw new DepositError(
      `Yêu cầu hoàn cọc đang ở trạng thái '${intentRow.status}', không thể xác nhận.`,
      'INVALID_REFUND_INTENT_STATUS'
    );
  }

  const safeRefund = BigInt(intentRow.amount);
  const refundMethod: PaymentMethod = intentRow.refund_method as PaymentMethod;

  // S05-01: Hoàn cọc bằng tiền mặt bắt buộc phải gắn với phiên quầy đang mở
  if (refundMethod === 'CASH' && !cashSessionId) {
    throw new DepositError(
      'Hoàn cọc bằng tiền mặt bắt buộc phải gắn với phiên quầy đang mở.',
      'CASH_SESSION_REQUIRED',
      400
    );
  }

  // 2. Khóa dòng phân bổ cọc
  const allocSel = await db.query<any>(
    `SELECT * FROM deposit_allocations WHERE id = $1 FOR UPDATE`,
    [intentRow.allocation_id]
  );

  const alloc = allocSel.rows[0];
  if (!alloc) {
    throw new DepositError(`Không tìm thấy phân bổ cọc ID '${intentRow.allocation_id}'.`, 'ALLOCATION_NOT_FOUND', 404);
  }

  const remaining = BigInt(alloc.remaining_amount);
  if (safeRefund > remaining) {
    throw new DepositError(
      `Số tiền hoàn (${safeRefund.toString()} ₫) vượt quá số dư cọc còn lại (${remaining.toString()} ₫).`,
      'REFUND_EXCEEDS_REMAINING'
    );
  }

  const newRemaining = remaining - safeRefund;
  const newStatus: DepositStatus = newRemaining === 0n ? 'REFUNDED' : 'HELD';

  // 3. Cập nhật phân bổ cọc
  const updAllocRes = await db.query<any>(
    `UPDATE deposit_allocations
     SET remaining_amount = $2,
         status = $3,
         refund_method = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [intentRow.allocation_id, newRemaining.toString(), newStatus, refundMethod]
  );

  // 4. Ghi bút toán sổ kép: Giảm nghĩa vụ cọc, Giảm tiền thực
  const creditAccount =
    refundMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;

  const journal = await recordJournalEntry(db, {
    entryCode,
    fundId: FUND_IDS.LOAN,
    sourceType: 'DEPOSIT_REFUND',
    sourceId: intentRow.id,
    debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    creditAccount,
    amount: safeRefund,
    cashSessionId: cashSessionId || null,
    createdBy,
  });

  // 5. Cập nhật trạng thái ý định hoàn sang CONFIRMED
  const updIntentRes = await db.query<any>(
    `UPDATE refund_intents
     SET status = 'CONFIRMED',
         confirmed_by = $2,
         confirmed_at = NOW(),
         cash_session_id = $3,
         journal_entry_id = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, allocation_id, amount, refund_method, status, requested_by, confirmed_by, confirmed_at, cash_session_id, journal_entry_id, created_at, updated_at`,
    [refundIntentId, createdBy, cashSessionId || null, journal.id]
  );

  if (refundMethod === 'CASH' && cashSessionId) {
    await db.query(
      `UPDATE cash_sessions
       SET expected_closing_cash = expected_closing_cash - $2
       WHERE id = $1`,
      [cashSessionId, safeRefund.toString()]
    );
  }

  return {
    allocation: mapAllocationRow(updAllocRes.rows[0]),
    intent: mapIntentRow(updIntentRes.rows[0]),
  };
}

/**
 * 4. Chuyển liên kết cọc sang phiếu mượn mới (Use Case 3 - Carry-forward)
 * Bất biến: Chuyển cọc chỉ thay đổi phiếu thụ hưởng nghĩa vụ, tuyệt đối KHÔNG phát sinh dòng tiền mặt/ngân hàng.
 */
export async function transferDepositAllocation(
  db: Queryable,
  params: TransferDepositParams
): Promise<{ sourceAllocation: DepositAllocation; targetAllocation: DepositAllocation }> {
  const {
    sourceAllocationId,
    targetReceiptId,
    targetItemId = null,
    transferAmount,
    createdBy,
  } = params;

  if (!sourceAllocationId || !targetReceiptId || !createdBy) {
    throw new DepositError('Thiếu thông số chuyển liên kết cọc.', 'MISSING_TRANSFER_PARAMS');
  }

  // Khóa bản ghi nguồn FOR UPDATE
  const selRes = await db.query<any>(
    `SELECT * FROM deposit_allocations WHERE id = $1 FOR UPDATE`,
    [sourceAllocationId]
  );

  const source = selRes.rows[0];
  if (!source) {
    throw new DepositError(`Không tìm thấy khoản cọc nguồn ID '${sourceAllocationId}'.`, 'ALLOCATION_NOT_FOUND', 404);
  }

  if (source.status !== 'HELD') {
    throw new DepositError(
      `Khoản cọc nguồn đang ở trạng thái '${source.status}', không thể chuyển liên kết.`,
      'INVALID_STATUS_FOR_TRANSFER'
    );
  }

  const currentRemaining = BigInt(source.remaining_amount);
  if (currentRemaining <= 0n) {
    throw new DepositError('Khoản cọc đã dùng hết, không còn số dư để chuyển.', 'DEPOSIT_EXHAUSTED');
  }

  const safeTransfer =
    transferAmount !== undefined ? assertSafeVndAmount(transferAmount) : currentRemaining;

  if (safeTransfer > currentRemaining) {
    throw new DepositError(
      `Số tiền chuyển (${safeTransfer.toString()} ₫) vượt quá số dư còn lại (${currentRemaining.toString()} ₫).`,
      'TRANSFER_EXCEEDS_REMAINING'
    );
  }

  const sourceNewRemaining = currentRemaining - safeTransfer;
  const sourceNewStatus: DepositStatus = sourceNewRemaining === 0n ? 'TRANSFERRED' : 'HELD';

  // 1. Cập nhật bản ghi nguồn
  const updSourceRes = await db.query<any>(
    `UPDATE deposit_allocations
     SET remaining_amount = $2,
         status = $3,
         transferred_to_receipt_id = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [sourceAllocationId, sourceNewRemaining.toString(), sourceNewStatus, targetReceiptId]
  );

  // 2. Tạo bản ghi phân bổ cọc mới cho phiếu đích
  const insertTargetRes = await db.query<any>(
    `INSERT INTO deposit_allocations (
      receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method
    ) VALUES ($1, $2, $3, $4, $5, 'HELD', $6)
    RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [
      targetReceiptId,
      targetItemId,
      FUND_IDS.LOAN,
      safeTransfer.toString(),
      safeTransfer.toString(),
      source.payment_method,
    ]
  );

  return {
    sourceAllocation: mapAllocationRow(updSourceRes.rows[0]),
    targetAllocation: mapAllocationRow(insertTargetRes.rows[0]),
  };
}

/**
 * 5. Giữ cọc để cấn trừ phạt quá hạn hoặc mất sách (Use Case 2 & 3 ngoại lệ)
 * S04-06: Bắt buộc truyền ForfeitPolicyConfig hợp lệ. Chặn cấn trừ nếu cọc đang PENDING_REFUND.
 */
export async function forfeitDeposit(
  db: Queryable,
  params: ForfeitDepositParams
): Promise<DepositAllocation> {
  const { allocationId, forfeitAmount, policy, createdBy, entryCode } = params;

  if (!allocationId || !createdBy || !entryCode) {
    throw new DepositError('Thiếu thông số cấn trừ cọc.', 'MISSING_FORFEIT_PARAMS');
  }

  // S04-06: Bắt buộc có cấu hình chính sách quỹ thụ hưởng đã được xác nhận
  if (!policy || !policy.targetFundId || !policy.targetAccount || !policy.reason) {
    throw new DepositError(
      'Chính sách quỹ thụ hưởng tiền phạt/mất sách chưa được CLB chốt. Bắt buộc truyền cấu hình chính sách hợp lệ.',
      'FORFEIT_POLICY_NOT_CONFIGURED'
    );
  }

  const safeForfeit = assertSafeVndAmount(forfeitAmount);

  // Khóa dòng allocation FOR UPDATE
  const selRes = await db.query<any>(
    `SELECT * FROM deposit_allocations WHERE id = $1 FOR UPDATE`,
    [allocationId]
  );

  const alloc = selRes.rows[0];
  if (!alloc) {
    throw new DepositError(`Không tìm thấy khoản cọc ID '${allocationId}'.`, 'ALLOCATION_NOT_FOUND', 404);
  }

  // S04-06: Chặn không được cấn trừ khoản cọc đang trong hàng chờ hoàn
  if (alloc.status === 'PENDING_REFUND') {
    throw new DepositError(
      'Khoản cọc đang có yêu cầu hoàn chờ xác nhận, không thể thực hiện cấn trừ.',
      'DEPOSIT_HAS_PENDING_REFUND'
    );
  }

  if (alloc.status !== 'HELD') {
    throw new DepositError(
      `Khoản cọc đang ở trạng thái '${alloc.status}', không thể cấn trừ.`,
      'INVALID_STATUS_FOR_FORFEIT'
    );
  }

  const remaining = BigInt(alloc.remaining_amount);
  if (safeForfeit > remaining) {
    throw new DepositError(
      `Số tiền cấn trừ (${safeForfeit.toString()} ₫) vượt quá số dư cọc còn lại (${remaining.toString()} ₫).`,
      'FORFEIT_EXCEEDS_REMAINING'
    );
  }

  const newRemaining = remaining - safeForfeit;
  const newStatus: DepositStatus = newRemaining === 0n ? 'FORFEITED' : 'HELD';

  const updRes = await db.query<any>(
    `UPDATE deposit_allocations
     SET remaining_amount = $2,
         status = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [allocationId, newRemaining.toString(), newStatus]
  );

  const updatedAlloc = mapAllocationRow(updRes.rows[0]);

  // Ghi bút toán: Nợ COC_PHAI_HOAN (giảm nghĩa vụ), Có tài khoản chỉ định theo policy, lưu reason
  await recordJournalEntry(db, {
    entryCode,
    fundId: policy.targetFundId,
    sourceType: 'FINE_FORFEIT',
    sourceId: alloc.receipt_id,
    debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    creditAccount: policy.targetAccount,
    amount: safeForfeit,
    notes: `[FORFEIT] ${policy.reason}${policy.policyVersion ? ` (${policy.policyVersion})` : ''}`,
    createdBy,
  });

  return updatedAlloc;
}

/**
 * 6. Đảo nghiệp vụ nhận cọc (S04-02: Đồng bộ cập nhật allocation nguồn và journal trong cùng transaction)
 */
export async function reverseDepositAllocation(
  db: Queryable,
  params: ReverseDepositParams
): Promise<{ allocation: DepositAllocation; reversalEntry: any }> {
  const { allocationId, reversalEntryCode, reason, createdBy } = params;

  if (!allocationId || !reversalEntryCode || !reason || !createdBy) {
    throw new DepositError('Thiếu thông số bắt buộc để đảo nhận cọc.', 'MISSING_REVERSE_PARAMS');
  }

  // Khóa allocation FOR UPDATE
  const selRes = await db.query<any>(
    `SELECT * FROM deposit_allocations WHERE id = $1 FOR UPDATE`,
    [allocationId]
  );

  const alloc = selRes.rows[0];
  if (!alloc) {
    throw new DepositError(`Không tìm thấy khoản cọc ID '${allocationId}'.`, 'ALLOCATION_NOT_FOUND', 404);
  }

  if (alloc.status !== 'HELD' || BigInt(alloc.remaining_amount) !== BigInt(alloc.original_amount)) {
    throw new DepositError(
      'Chỉ có thể đảo khoản cọc đang ở trạng thái HELD và chưa bị hoàn hay cấn trừ một phần.',
      'CANNOT_REVERSE_MODIFIED_DEPOSIT'
    );
  }

  // S05-02 & S06-02: Tìm chính xác bút toán nhận cọc gốc theo allocation.id (hoặc fallback receipt_id + amount nếu dữ liệu cũ)
  let origEntryRes = await db.query<any>(
    `SELECT id, amount, debit_account, credit_account, cash_session_id
     FROM journal_entries
     WHERE source_type = 'LOAN_DEPOSIT' AND source_id = $1`,
    [alloc.id]
  );

  if (!origEntryRes.rows || origEntryRes.rows.length === 0) {
    origEntryRes = await db.query<any>(
      `SELECT id, amount, debit_account, credit_account, cash_session_id
       FROM journal_entries
       WHERE source_type = 'LOAN_DEPOSIT' AND source_id = $1 AND amount = $2`,
      [alloc.receipt_id, alloc.original_amount.toString()]
    );

    // S06-02: Không tự ý chọn dòng bằng LIMIT 1 nếu tồn tại nhiều dòng cùng số tiền
    if (origEntryRes.rows && origEntryRes.rows.length > 1) {
      throw new DepositError(
        'Tồn tại nhiều bút toán cũ trùng số tiền cọc cho phiếu này, không thể tự động chọn để đảo.',
        'AMBIGUOUS_LEGACY_JOURNAL_ENTRIES',
        409
      );
    }
  }

  if (!origEntryRes.rows || origEntryRes.rows.length === 0) {
    throw new DepositError('Không tìm thấy bút toán nhận cọc gốc trên sổ cái.', 'ORIGINAL_JOURNAL_NOT_FOUND', 404);
  }

  // Cập nhật allocation sang VOIDED với remaining_amount = 0 (S05-02: phân biệt sửa sai VOIDED với tịch thu cọc FORFEITED)
  const updAlloc = await db.query<any>(
    `UPDATE deposit_allocations
     SET remaining_amount = 0,
         status = 'VOIDED',
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method, transferred_to_receipt_id, created_at, updated_at`,
    [allocationId]
  );

  // Đảo journal với allowDirectSourceReversal = true và truyền targetCashSessionId (S06-02)
  const reversalEntry = await recordReversal(db, {
    originalEntryId: origEntryRes.rows[0].id,
    reversalEntryCode,
    reason,
    createdBy,
    allowDirectSourceReversal: true,
    targetCashSessionId: params.targetCashSessionId,
  });

  // S05-02: Kiểm tra đối soát nghĩa vụ cọc ngay trong use case transaction để rollback nếu lệch
  await assertLiabilityReconciliation(db);

  return {
    allocation: mapAllocationRow(updAlloc.rows[0]),
    reversalEntry,
  };
}
