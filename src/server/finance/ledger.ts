/**
 * YSBK Core Finance: Double-Entry Ledger (Sổ Kép Tối Thiểu)
 * Đảm bảo tính bất biến, cân bằng Nợ = Có tuyệt đối, và cách ly hoàn toàn 2 Quỹ độc lập.
 */

import {
  type FundId,
  type AccountCode,
  type JournalEntry,
  type Queryable,
  type DocumentCorrectionParams,
  type DocumentCorrectionResult,
  FUND_IDS,
  ACCOUNT_CODES,
  assertSafeVndAmount,
  assertValidFundAccount,
} from './types.ts';
import { assertAndLockActiveCashSession } from './cash-sessions.ts';
import { recordAuditLog } from '../shared/audit.ts';

export class LedgerError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus = 400) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface RecordJournalEntryParams {
  entryCode: string;
  fundId: FundId;
  sourceType: string;
  sourceId: string;
  debitAccount: AccountCode | string;
  creditAccount: AccountCode | string;
  amount: bigint | number | string;
  createdBy: string;
  reversalOfEntryId?: string | null;
  cashSessionId?: string | null;
  notes?: string | null;
  allowDirectSourceReversal?: boolean;
}

export interface RecordReversalParams {
  originalEntryId: string;
  reversalEntryCode: string;
  reason: string;
  createdBy: string;
  allowDirectSourceReversal?: boolean;
  targetCashSessionId?: string | null;
}

export interface AccountBalance {
  account: string;
  totalDebit: bigint;
  totalCredit: bigint;
  netBalance: bigint;
}

export interface FundBalanceReport {
  fundId: FundId;
  accounts: Record<string, AccountBalance>;
  totalDebit: bigint;
  totalCredit: bigint;
  isBalanced: boolean;
}

/**
 * Ghi một bút toán sổ kép bất biến vào bảng journal_entries.
 * Caller bắt buộc truyền cùng transaction/client để đảm bảo ACID.
 */
export async function recordJournalEntry(
  db: Queryable,
  params: RecordJournalEntryParams
): Promise<JournalEntry> {
  const {
    entryCode,
    fundId,
    sourceType,
    sourceId,
    debitAccount,
    creditAccount,
    amount,
    createdBy,
    reversalOfEntryId = null,
    cashSessionId = null,
    notes = null,
  } = params;

  if (!entryCode || !fundId || !sourceType || !sourceId || !createdBy) {
    throw new LedgerError('Thiếu thông số bắt buộc cho bút toán sổ cái.', 'MISSING_LEDGER_PARAMS');
  }

  // 1. Kiểm tra quỹ hợp lệ
  if (fundId !== FUND_IDS.LOAN && fundId !== FUND_IDS.OPERATION) {
    throw new LedgerError(`Mã quỹ '${fundId}' không hợp lệ.`, 'INVALID_FUND_ID');
  }

  // 2. Kiểm tra tài khoản Nợ và Có
  if (debitAccount === creditAccount) {
    throw new LedgerError(
      `Tài khoản Nợ và Có không được trùng nhau ('${debitAccount}').`,
      'DEBIT_CREDIT_SAME_ACCOUNT'
    );
  }

  assertValidFundAccount(fundId, debitAccount);
  assertValidFundAccount(fundId, creditAccount);

  // 3. S05-01: Kiểm tra và khóa phiên quầy tiền mặt
  if (cashSessionId) {
    if (fundId !== FUND_IDS.LOAN) {
      throw new LedgerError(
        'Phiên quầy tiền mặt bàn trực chỉ dành riêng cho Quỹ Mượn–Trả (FUND_LOAN).',
        'INVALID_FUND_CASH_SESSION',
        400
      );
    }
    await assertAndLockActiveCashSession(db, cashSessionId, fundId);
  } else if (
    (debitAccount === ACCOUNT_CODES.CASH_DRAWER || creditAccount === ACCOUNT_CODES.CASH_DRAWER) &&
    fundId === FUND_IDS.LOAN
  ) {
    throw new LedgerError(
      'Giao dịch tiền mặt hộp mượn–trả bắt buộc phải gắn với phiên quầy đang mở.',
      'CASH_SESSION_REQUIRED',
      400
    );
  }

  // 4. Kiểm tra số tiền VND nguyên an toàn (> 0)
  const safeAmount = assertSafeVndAmount(amount);

  // 4. Thực thi INSERT vào DB của caller
  const res = await db.query<any>(
    `INSERT INTO journal_entries (
      entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, reversal_of_entry_id, cash_session_id, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, reversal_of_entry_id, cash_session_id, notes, created_by, created_at`,
    [
      entryCode,
      fundId,
      sourceType,
      sourceId,
      debitAccount,
      creditAccount,
      safeAmount.toString(),
      reversalOfEntryId,
      cashSessionId,
      notes,
      createdBy,
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    entry_code: row.entry_code,
    fund_id: row.fund_id,
    source_type: row.source_type,
    source_id: row.source_id,
    debit_account: row.debit_account,
    credit_account: row.credit_account,
    amount: BigInt(row.amount),
    reversal_of_entry_id: row.reversal_of_entry_id,
    cash_session_id: row.cash_session_id,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

/**
 * Thực hiện bút toán đảo (Reversal Entry) cho một bút toán đã ghi nhận trước đó.
 * Kiểm tra: Bút toán gốc phải tồn tại, chưa bị đảo, và khóa dòng FOR UPDATE để chống đảo kép đồng thời.
 * S04-02: Chặn đảo trực tiếp journal có source nghiệp vụ cọc (LOAN_DEPOSIT, DEPOSIT_REFUND)
 * nếu không qua quy trình đảo nguồn nghiệp vụ phối hợp để bảo đảm toàn vẹn số dư nghĩa vụ.
 */
export async function recordReversal(
  db: Queryable,
  params: RecordReversalParams
): Promise<JournalEntry> {
  const { originalEntryId, reversalEntryCode, reason, createdBy, allowDirectSourceReversal = false } = params;

  if (!originalEntryId || !reversalEntryCode || !reason || !createdBy) {
    throw new LedgerError('Thiếu thông số bắt buộc để thực hiện bút toán đảo.', 'MISSING_REVERSAL_PARAMS');
  }

  // Khóa dòng bút toán gốc để kiểm tra tính toàn vẹn
  const origRes = await db.query<any>(
    `SELECT id, entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, reversal_of_entry_id, cash_session_id
     FROM journal_entries
     WHERE id = $1
     FOR UPDATE`,
    [originalEntryId]
  );

  const original = origRes.rows[0];
  if (!original) {
    throw new LedgerError(`Không tìm thấy bút toán gốc có ID '${originalEntryId}'.`, 'ORIGINAL_ENTRY_NOT_FOUND', 404);
  }

  if (original.reversal_of_entry_id) {
    throw new LedgerError(
      'Không thể đảo một bút toán bản thân nó đã là bút toán đảo.',
      'CANNOT_REVERSE_A_REVERSAL'
    );
  }

  // S04-02 & S08-06: Chặn đảo trực tiếp mọi nguồn nghiệp vụ cọc/hoàn/phạt/chuyển tiếp
  // Bắt buộc phải đảo thông qua quy trình đảo nguồn nghiệp vụ tương ứng để đồng bộ allocation và nghĩa vụ cọc.
  const managedSources = new Set([
    'LOAN_DEPOSIT',
    'DEPOSIT_REFUND',
    'FINE_FORFEIT',
    'LOAN_DEPOSIT_REFUND',
    'LOAN_FINE_FORFEIT',
    'LOAN_FINE',
    'LOAN_CARRY_FORWARD',
    'LOAN_DEPOSIT_NEW',
  ]);
  if (managedSources.has(original.source_type) && !allowDirectSourceReversal) {
    throw new LedgerError(
      `Bút toán '${original.entry_code}' thuộc nguồn '${original.source_type}' phải được đảo thông qua quy trình đảo nguồn nghiệp vụ tương ứng để đồng bộ allocation và nghĩa vụ cọc.`,
      'CANNOT_REVERSE_MANAGED_SOURCE'
    );
  }

  // Kiểm tra xem đã có bút toán nào đảo bút toán này trước đó chưa
  const existingReversal = await db.query<any>(
    `SELECT id, entry_code FROM journal_entries WHERE reversal_of_entry_id = $1`,
    [originalEntryId]
  );

  if (existingReversal.rows && existingReversal.rows.length > 0) {
    throw new LedgerError(
      `Bút toán '${original.entry_code}' đã được đảo trước đó bởi bút toán '${existingReversal.rows[0].entry_code}'.`,
      'ENTRY_ALREADY_REVERSED'
    );
  }

  // S05-01: Không backdate bút toán đảo vào phiên quầy đã đóng
  let effectiveCashSessionId: string | null =
    params.targetCashSessionId !== undefined ? params.targetCashSessionId : original.cash_session_id;

  if (effectiveCashSessionId) {
    const sessionCheck = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1`,
      [effectiveCashSessionId]
    );
    if (sessionCheck.rows && sessionCheck.rows[0]?.is_closed) {
      // Phiên cũ đã đóng: Bút toán đảo không được ghi đè vào phiên cũ làm biến động snapshot đã chốt
      effectiveCashSessionId = params.targetCashSessionId || null;
    }
  }

  // Tạo bút toán đảo: Đổi chéo Nợ <-> Có, lưu reason vào notes
  const revEntry = await recordJournalEntry(db, {
    entryCode: reversalEntryCode,
    fundId: original.fund_id as FundId,
    sourceType: `REVERSAL_${original.source_type}`,
    sourceId: original.source_id,
    debitAccount: original.credit_account,
    creditAccount: original.debit_account,
    amount: BigInt(original.amount),
    createdBy,
    reversalOfEntryId: original.id,
    cashSessionId: effectiveCashSessionId,
    notes: reason,
  });

  if (effectiveCashSessionId) {
    if (original.debit_account === ACCOUNT_CODES.CASH_DRAWER) {
      await db.query(
        `UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash - $2 WHERE id = $1`,
        [effectiveCashSessionId, original.amount.toString()]
      );
    } else if (original.credit_account === ACCOUNT_CODES.CASH_DRAWER) {
      await db.query(
        `UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + $2 WHERE id = $1`,
        [effectiveCashSessionId, original.amount.toString()]
      );
    }
  }

  return revEntry;
}

/**
 * Tính toán báo cáo số dư theo từng tài khoản của một quỹ cụ thể.
 * Xác nhận nguyên tắc bất biến: Tổng Nợ = Tổng Có.
 */
export async function getFundBalances(
  db: Queryable,
  fundId: FundId
): Promise<FundBalanceReport> {
  const res = await db.query<any>(
    `SELECT debit_account, credit_account, amount
     FROM journal_entries
     WHERE fund_id = $1`,
    [fundId]
  );

  const accounts: Record<string, { totalDebit: bigint; totalCredit: bigint }> = {};
  let totalDebit = 0n;
  let totalCredit = 0n;

  for (const row of res.rows) {
    const amt = BigInt(row.amount);
    totalDebit += amt;
    totalCredit += amt;

    const debitAcc = row.debit_account;
    const creditAcc = row.credit_account;

    if (!accounts[debitAcc]) accounts[debitAcc] = { totalDebit: 0n, totalCredit: 0n };
    if (!accounts[creditAcc]) accounts[creditAcc] = { totalDebit: 0n, totalCredit: 0n };

    accounts[debitAcc].totalDebit += amt;
    accounts[creditAcc].totalCredit += amt;
  }

  const accountBalances: Record<string, AccountBalance> = {};
  for (const [acc, data] of Object.entries(accounts)) {
    const isAsset =
      acc === ACCOUNT_CODES.CASH_DRAWER ||
      acc === ACCOUNT_CODES.BANK_MAIN ||
      acc === ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE;

    const net = isAsset
      ? data.totalDebit - data.totalCredit
      : data.totalCredit - data.totalDebit;

    accountBalances[acc] = {
      account: acc,
      totalDebit: data.totalDebit,
      totalCredit: data.totalCredit,
      netBalance: net,
    };
  }

  return {
    fundId,
    accounts: accountBalances,
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit,
  };
}

/**
 * S04-02: Đối soát toàn vẹn giữa tổng phân bổ nghĩa vụ cọc và số dư tài khoản COC_PHAI_HOAN trên sổ cái.
 * Invariant: Tổng remaining_amount của các cọc HELD + PENDING_REFUND phải khớp chính xác tuyệt đối
 * với số dư Có ròng của tài khoản COC_PHAI_HOAN (credit - debit) trong Quỹ Mượn-Trả.
 */
export async function assertLiabilityReconciliation(db: Queryable): Promise<{
  totalAllocations: bigint;
  ledgerLiabilityBalance: bigint;
  isReconciled: boolean;
}> {
  // 1. Tổng nghĩa vụ từ deposit_allocations
  const allocRes = await db.query<any>(
    `SELECT COALESCE(SUM(remaining_amount), 0) AS total_remaining
     FROM deposit_allocations
     WHERE fund_id = $1 AND status IN ('HELD', 'PENDING_REFUND')`,
    [FUND_IDS.LOAN]
  );
  const totalAllocations = BigInt(allocRes.rows[0]?.total_remaining || 0);

  // 2. Số dư tài khoản COC_PHAI_HOAN từ journal_entries
  const journalRes = await db.query<any>(
    `SELECT
       COALESCE(SUM(CASE WHEN credit_account = $2 THEN amount ELSE 0 END), 0) AS total_credit,
       COALESCE(SUM(CASE WHEN debit_account = $2 THEN amount ELSE 0 END), 0) AS total_debit
     FROM journal_entries
     WHERE fund_id = $1`,
    [FUND_IDS.LOAN, ACCOUNT_CODES.DEPOSIT_LIABILITY]
  );
  const totalCredit = BigInt(journalRes.rows[0]?.total_credit || 0);
  const totalDebit = BigInt(journalRes.rows[0]?.total_debit || 0);
  const ledgerLiabilityBalance = totalCredit - totalDebit;

  const isReconciled = totalAllocations === ledgerLiabilityBalance;
  if (!isReconciled) {
    throw new LedgerError(
      `[LIABILITY_MISMATCH] Tổng nghĩa vụ cọc phân bổ (${totalAllocations.toString()} ₫) lệch so với số dư sổ cái COC_PHAI_HOAN (${ledgerLiabilityBalance.toString()} ₫).`,
      'LIABILITY_RECONCILIATION_FAILED'
    );
  }

  return { totalAllocations, ledgerLiabilityBalance, isReconciled };
}

/**
 * Thực hiện sửa sai chứng từ kế toán sổ kép (Chặng 11: Correction / Reversal)
 * Định danh bút toán gốc, kiểm tra ràng buộc tiền thực / ca trực, chống đảo kép, và ghi chứng từ đảo.
 */
export async function createDocumentCorrection(
  db: Queryable,
  params: DocumentCorrectionParams,
  actorId: string
): Promise<DocumentCorrectionResult> {
  const { originalEntryId, reason, cashSessionId, actionId, paymentConfirmed, expectedAmount } = params;

  if (!originalEntryId || typeof originalEntryId !== 'string' || originalEntryId.trim().length === 0) {
    throw new LedgerError('Thiếu ID bút toán gốc cần sửa sai (originalEntryId).', 'MISSING_ORIGINAL_ENTRY_ID', 400);
  }
  const cleanReason = reason ? String(reason).trim() : '';
  if (!cleanReason || cleanReason.length < 5) {
    throw new LedgerError('Bắt buộc cung cấp lý do sửa sai chứng từ (ít nhất 5 ký tự).', 'MISSING_CORRECTION_REASON', 400);
  }

  // 1. Snapshot read để xác định tài nguyên cần khóa
  const peekRes = await db.query<any>(
    `SELECT id, entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, reversal_of_entry_id, cash_session_id
     FROM journal_entries
     WHERE id = $1`,
    [originalEntryId.trim()]
  );
  const peekEntry = peekRes.rows && peekRes.rows.length > 0 ? peekRes.rows[0] : null;
  if (!peekEntry) {
    throw new LedgerError(`Không tìm thấy bút toán gốc có ID '${originalEntryId}'.`, 'ORIGINAL_ENTRY_NOT_FOUND', 404);
  }

  // S11-02: Kiểm tra số tiền kỳ vọng nếu được cung cấp
  if (expectedAmount !== undefined && expectedAmount !== null) {
    if (BigInt(peekEntry.amount) !== BigInt(expectedAmount)) {
      throw new LedgerError(
        `Số tiền xác nhận (${expectedAmount}₫) không khớp với số tiền của bút toán gốc (${peekEntry.amount}₫).`,
        'AMOUNT_MISMATCH',
        400
      );
    }
  }

  // S11-02: Bắt buộc có xác nhận tiền thực tế khi đảo bút toán liên quan tiền mặt hoặc ngân hàng
  if (peekEntry.debit_account === ACCOUNT_CODES.CASH_DRAWER || peekEntry.credit_account === ACCOUNT_CODES.CASH_DRAWER) {
    if (paymentConfirmed !== true) {
      throw new LedgerError(
        'Sửa sai chứng từ tiền mặt bắt buộc phải có xác nhận giao dịch tiền thực tế (paymentConfirmed: true).',
        'PAYMENT_CONFIRMATION_REQUIRED',
        400
      );
    }
  }
  if (peekEntry.debit_account === ACCOUNT_CODES.BANK_MAIN || peekEntry.credit_account === ACCOUNT_CODES.BANK_MAIN) {
    if (paymentConfirmed !== true) {
      throw new LedgerError(
        'Sửa sai chứng từ ngân hàng bắt buộc phải có xác nhận đã kiểm tra tài khoản thực tế (paymentConfirmed: true).',
        'PAYMENT_CONFIRMATION_REQUIRED',
        400
      );
    }
  }

  // Chống đảo một bút toán bản thân nó đã là reversal
  if (peekEntry.reversal_of_entry_id) {
    throw new LedgerError(
      'Không thể sửa sai / đảo một bút toán bản thân nó đã là bút toán đảo.',
      'CANNOT_REVERSE_A_REVERSAL',
      400
    );
  }

  // Chống đảo kép: kiểm tra xem đã có bút toán nào đảo bút toán này chưa
  const existingRev = await db.query<any>(
    `SELECT id, entry_code FROM journal_entries WHERE reversal_of_entry_id = $1`,
    [peekEntry.id]
  );
  if (existingRev.rows && existingRev.rows.length > 0) {
    throw new LedgerError(
      `Bút toán '${peekEntry.entry_code}' đã được đảo trước đó bởi bút toán '${existingRev.rows[0].entry_code}'.`,
      'ENTRY_ALREADY_REVERSED',
      409
    );
  }

  // Xác định trước các ID cần khóa theo thứ tự chuẩn: Session -> Receipt -> Allocations -> Journal
  let targetSessionId = cashSessionId ? cashSessionId.trim() : peekEntry.cash_session_id;
  if (!targetSessionId && (peekEntry.debit_account === ACCOUNT_CODES.CASH_DRAWER || peekEntry.credit_account === ACCOUNT_CODES.CASH_DRAWER)) {
    const sFind = await db.query<any>(
      `SELECT id FROM cash_sessions WHERE is_closed = FALSE LIMIT 1`
    );
    if (sFind.rows && sFind.rows.length > 0) {
      targetSessionId = sFind.rows[0].id;
    }
  }

  let targetReceiptId: string | null = null;
  let targetAllocationId: string | null = null;
  if (peekEntry.source_type === 'LOAN_DEPOSIT' || peekEntry.source_type === 'LOAN_DEPOSIT_NEW') {
    targetAllocationId = peekEntry.source_id;
    const aFind = await db.query<any>(
      `SELECT receipt_id FROM deposit_allocations WHERE id = $1`,
      [targetAllocationId]
    );
    if (aFind.rows && aFind.rows.length > 0) {
      targetReceiptId = aFind.rows[0].receipt_id;
    }
  } else if (peekEntry.source_type === 'LOAN_FINE') {
    // Có thể source_id là receipt_id hoặc settlement_id hoặc renewal_id
    const rFind = await db.query<any>(
      `SELECT id FROM loan_receipts WHERE id = $1`,
      [peekEntry.source_id]
    );
    if (rFind.rows && rFind.rows.length > 0) {
      targetReceiptId = rFind.rows[0].id;
    } else {
      const sFind = await db.query<any>(
        `SELECT receipt_id FROM loan_settlements WHERE id = $1`,
        [peekEntry.source_id]
      );
      if (sFind.rows && sFind.rows.length > 0) {
        targetReceiptId = sFind.rows[0].receipt_id;
      } else {
        const rnFind = await db.query<any>(
          `SELECT receipt_id FROM loan_renewals WHERE id = $1`,
          [peekEntry.source_id]
        );
        if (rnFind.rows && rnFind.rows.length > 0) {
          targetReceiptId = rnFind.rows[0].receipt_id;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S12-09: THỨ TỰ KHÓA ĐỒNG THỜI CHUẨN: Session -> Receipt -> Allocations -> Journal
  // ═══════════════════════════════════════════════════════════════════════════
  let effectiveCashSessionId: string | null = null;
  if (targetSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed, expected_closing_cash FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [targetSessionId]
    );
    if (sRes.rows && sRes.rows.length > 0) {
      if (sRes.rows[0].is_closed) {
        throw new LedgerError('Phiên quầy chỉ định đã đóng, không thể sửa sai.', 'SESSION_CLOSED', 400);
      }
      effectiveCashSessionId = sRes.rows[0].id;
    } else if (cashSessionId) {
      throw new LedgerError(`Không tìm thấy phiên quầy ID '${cashSessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
  }

  if (targetReceiptId) {
    await db.query<any>(
      `SELECT id, status FROM loan_receipts WHERE id = $1 FOR UPDATE`,
      [targetReceiptId]
    );
  }

  if (targetAllocationId) {
    await db.query<any>(
      `SELECT id, status, remaining_amount, receipt_id FROM deposit_allocations WHERE id = $1 FOR UPDATE`,
      [targetAllocationId]
    );
  }

  // Khóa bút toán gốc FOR UPDATE
  const origRes = await db.query<any>(
    `SELECT id, entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, reversal_of_entry_id, cash_session_id
     FROM journal_entries
     WHERE id = $1
     FOR UPDATE`,
    [originalEntryId.trim()]
  );
  const original = origRes.rows[0];
  if (!original) {
    throw new LedgerError(`Không tìm thấy bút toán gốc có ID '${originalEntryId}'.`, 'ORIGINAL_ENTRY_NOT_FOUND', 404);
  }

  // S12-09: Kiểm tra số dư tiền mặt canonical nếu là giao dịch rút tiền mặt
  if (original.debit_account === ACCOUNT_CODES.CASH_DRAWER) {
    if (!effectiveCashSessionId) {
      throw new LedgerError('Bàn trực chưa có phiên quầy tiền mặt đang mở để chi tiền sửa sai.', 'CASH_SESSION_REQUIRED', 400);
    }
    const sRes = await db.query<any>(
      `SELECT opening_cash FROM cash_sessions WHERE id = $1`,
      [effectiveCashSessionId]
    );
    const openingCash = BigInt(sRes.rows[0]?.opening_cash || 0);

    const cashInRes = await db.query<any>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM journal_entries
       WHERE cash_session_id = $1 AND fund_id = $2 AND debit_account = $3`,
      [effectiveCashSessionId, FUND_IDS.LOAN, ACCOUNT_CODES.CASH_DRAWER]
    );
    const cashIn = BigInt(cashInRes.rows[0]?.total || 0);

    const cashOutRes = await db.query<any>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM journal_entries
       WHERE cash_session_id = $1 AND fund_id = $2 AND credit_account = $3`,
      [effectiveCashSessionId, FUND_IDS.LOAN, ACCOUNT_CODES.CASH_DRAWER]
    );
    const cashOut = BigInt(cashOutRes.rows[0]?.total || 0);

    const availableCash = openingCash + cashIn - cashOut;
    if (availableCash < BigInt(original.amount)) {
      throw new LedgerError(
        `Số dư tiền mặt khả dụng của ca trực (${availableCash.toString()}₫) không đủ để chi tiền sửa sai (${original.amount}₫).`,
        'INSUFFICIENT_CASH_IN_SESSION',
        400
      );
    }
  }

  // S11-01 & S12-06: Xử lý theo loại chứng từ nguồn
  if (original.source_type === 'LOAN_DEPOSIT' || original.source_type === 'LOAN_DEPOSIT_NEW') {
    const aCheck = await db.query<any>(
      `SELECT id, status, remaining_amount, receipt_id FROM deposit_allocations WHERE id = $1`,
      [original.source_id]
    );
    if (!aCheck.rows || aCheck.rows.length === 0) {
      throw new LedgerError('Không tìm thấy khoản phân bổ cọc nguồn liên kết với chứng từ.', 'ALLOCATION_NOT_FOUND', 404);
    }
    const alloc = aCheck.rows[0];
    if (alloc.status !== 'HELD') {
      throw new LedgerError(
        `Khoản cọc đã ở trạng thái '${alloc.status}', có nghiệp vụ phụ thuộc tiếp theo nên không thể đảo độc lập.`,
        'DEPENDENCY_CONFLICT',
        409
      );
    }

    const rCheck = await db.query<any>(
      `SELECT id, status FROM loan_receipts WHERE id = $1`,
      [alloc.receipt_id]
    );
    if (rCheck.rows && rCheck.rows.length > 0 && rCheck.rows[0].status === 'ACTIVE') {
      throw new LedgerError(
        'Phiếu mượn đang ACTIVE với sách đang lưu hành. Không thể đảo cọc khi bạn đọc chưa hoàn trả sách.',
        'LOAN_STILL_ACTIVE_CONFLICT',
        409
      );
    }

    await db.query(
      `UPDATE deposit_allocations SET status = 'VOIDED', remaining_amount = 0, updated_at = NOW() WHERE id = $1`,
      [original.source_id]
    );
  } else if (original.source_type === 'LOAN_FINE') {
    // S12-06: 1. Thử khớp chính xác theo ID quyết định (UUID canonical của settlement hoặc renewal)
    const stlById = await db.query<any>(
      `SELECT id, fine_collected, fine_pending_amount, fine_status FROM loan_settlements WHERE id = $1 FOR UPDATE`,
      [original.source_id]
    );
    if (stlById.rows && stlById.rows.length > 0) {
      const stl = stlById.rows[0];
      const curCollected = BigInt(stl.fine_collected || 0);
      const curPending = BigInt(stl.fine_pending_amount || 0);
      const revAmt = BigInt(original.amount);
      if (curCollected < revAmt) {
        throw new LedgerError(
          `Số tiền phạt tất toán đã thu (${curCollected}) nhỏ hơn số tiền cần đảo (${revAmt}). Không thể đảo bút toán vượt quá số đã thu.`,
          'FINE_REVERSAL_EXCEEDS_COLLECTED',
          400
        );
      }
      const newCollected = curCollected - revAmt;
      const newPending = curPending + revAmt;
      await db.query(
        `UPDATE loan_settlements
         SET fine_collected = $2,
             fine_pending_amount = $3,
             fine_status = 'PENDING'
         WHERE id = $1`,
        [stl.id, newCollected.toString(), newPending.toString()]
      );
    } else {
      const rnwById = await db.query<any>(
        `SELECT id, fine_collected, fine_pending_amount, fine_status FROM loan_renewals WHERE id = $1 FOR UPDATE`,
        [original.source_id]
      );
      if (rnwById.rows && rnwById.rows.length > 0) {
        const rnw = rnwById.rows[0];
        const curCollected = BigInt(rnw.fine_collected || 0);
        const curPending = BigInt(rnw.fine_pending_amount || 0);
        const revAmt = BigInt(original.amount);
        if (curCollected < revAmt) {
          throw new LedgerError(
            `Số tiền phạt gia hạn đã thu (${curCollected}) nhỏ hơn số tiền cần đảo (${revAmt}). Không thể đảo bút toán vượt quá số đã thu.`,
            'FINE_REVERSAL_EXCEEDS_COLLECTED',
            400
          );
        }
        const newCollected = curCollected - revAmt;
        const newPending = curPending + revAmt;
        await db.query(
          `UPDATE loan_renewals
           SET fine_collected = $2,
               fine_pending_amount = $3,
               fine_status = 'PENDING'
           WHERE id = $1`,
          [rnw.id, newCollected.toString(), newPending.toString()]
        );
      } else {
        // Fallback an toàn cho dữ liệu lịch sử (source_id = receipt.id - RF-08):
        const isRenewalCode = original.entry_code.startsWith('JE-RN-');
        const isSettlementCode = original.entry_code.startsWith('JE-FINE-') || original.entry_code.startsWith('JE-STL-');

        if (isRenewalCode) {
          // Bắt buộc trích xuất đúng renewal_sequence từ mã bút toán (ví dụ: JE-RN-...-1 hoặc JE-RN-...-2)
          const seqMatch = original.entry_code.match(/JE-RN-.*?-([0-9]+)$/);
          if (seqMatch) {
            const targetSeq = parseInt(seqMatch[1], 10);
            const rnw = await db.query<any>(
              `SELECT id, fine_collected, fine_pending_amount, fine_status, renewal_sequence
               FROM loan_renewals
               WHERE receipt_id = $1 AND renewal_sequence = $2
               FOR UPDATE`,
              [original.source_id, targetSeq]
            );
            if (rnw.rows && rnw.rows.length > 0) {
              const targetRnw = rnw.rows[0];
              const curCollected = BigInt(targetRnw.fine_collected || 0);
              const curPending = BigInt(targetRnw.fine_pending_amount || 0);
              const revAmt = BigInt(original.amount);
              if (curCollected < revAmt) {
                throw new LedgerError(
                  `Số tiền phạt gia hạn lần ${targetSeq} đã thu (${curCollected}) nhỏ hơn số tiền cần đảo (${revAmt}). Không thể đảo bút toán.`,
                  'FINE_REVERSAL_EXCEEDS_COLLECTED',
                  400
                );
              }
              const newCollected = curCollected - revAmt;
              const newPending = curPending + revAmt;
              await db.query(
                `UPDATE loan_renewals
                 SET fine_collected = $2,
                     fine_pending_amount = $3,
                     fine_status = 'PENDING'
                 WHERE id = $1`,
                [targetRnw.id, newCollected.toString(), newPending.toString()]
              );
            } else {
              throw new LedgerError(
                `Không tìm thấy quyết định phạt gia hạn lần ${targetSeq} cho phiếu '${original.source_id}'.`,
                'FINE_SOURCE_NOT_FOUND',
                400
              );
            }
          } else {
            // Không trích xuất được sequence: kiểm tra xem có duy nhất 1 lần gia hạn không
            const allRnws = await db.query<any>(
              `SELECT id, fine_collected, fine_pending_amount, fine_status, renewal_sequence
               FROM loan_renewals
               WHERE receipt_id = $1
               FOR UPDATE`,
              [original.source_id]
            );
            if (allRnws.rows && allRnws.rows.length === 1) {
              const targetRnw = allRnws.rows[0];
              const curCollected = BigInt(targetRnw.fine_collected || 0);
              const curPending = BigInt(targetRnw.fine_pending_amount || 0);
              const revAmt = BigInt(original.amount);
              if (curCollected < revAmt) {
                throw new LedgerError(
                  `Số tiền phạt gia hạn đã thu (${curCollected}) nhỏ hơn số tiền cần đảo (${revAmt}). Không thể đảo bút toán.`,
                  'FINE_REVERSAL_EXCEEDS_COLLECTED',
                  400
                );
              }
              const newCollected = curCollected - revAmt;
              const newPending = curPending + revAmt;
              await db.query(
                `UPDATE loan_renewals
                 SET fine_collected = $2,
                     fine_pending_amount = $3,
                     fine_status = 'PENDING'
                 WHERE id = $1`,
                [targetRnw.id, newCollected.toString(), newPending.toString()]
              );
            } else if (!allRnws.rows || allRnws.rows.length === 0) {
              throw new LedgerError(
                `Không tìm thấy quyết định phạt gia hạn cho phiếu '${original.source_id}'.`,
                'FINE_SOURCE_NOT_FOUND',
                400
              );
            } else {
              // Có nhiều lần gia hạn mà mã bút toán không có sequence: Từ chối fail-closed (RF-08)
              throw new LedgerError(
                `Phiếu '${original.source_id}' có ${allRnws.rows.length} lần gia hạn, không thể xác định duy nhất lần gia hạn từ mã '${original.entry_code}'. Cần đối soát thủ công (reconciliation).`,
                'AMBIGUOUS_FINE_SOURCE',
                400
              );
            }
          }
        } else if (isSettlementCode) {
          const stl = await db.query<any>(
            `SELECT id, fine_collected, fine_pending_amount, fine_status
             FROM loan_settlements
             WHERE receipt_id = $1
             FOR UPDATE`,
            [original.source_id]
          );
          if (stl.rows && stl.rows.length === 1) {
            const targetStl = stl.rows[0];
            const curCollected = BigInt(targetStl.fine_collected || 0);
            const curPending = BigInt(targetStl.fine_pending_amount || 0);
            const revAmt = BigInt(original.amount);
            if (curCollected < revAmt) {
              throw new LedgerError(
                `Số tiền phạt tất toán đã thu (${curCollected}) nhỏ hơn số tiền cần đảo (${revAmt}). Không thể đảo bút toán.`,
                'FINE_REVERSAL_EXCEEDS_COLLECTED',
                400
              );
            }
            const newCollected = curCollected - revAmt;
            const newPending = curPending + revAmt;
            await db.query(
              `UPDATE loan_settlements
               SET fine_collected = $2,
                   fine_pending_amount = $3,
                   fine_status = 'PENDING'
               WHERE id = $1`,
              [targetStl.id, newCollected.toString(), newPending.toString()]
            );
          } else if (stl.rows && stl.rows.length > 1) {
            throw new LedgerError(
              `Phiếu '${original.source_id}' có nhiều bản ghi tất toán (${stl.rows.length}), không thể xác định duy nhất nguồn phạt. Cần đối soát thủ công.`,
              'AMBIGUOUS_FINE_SOURCE',
              400
            );
          } else {
            throw new LedgerError(
              `Không tìm thấy quyết định phạt tất toán cho phiếu '${original.source_id}'.`,
              'FINE_SOURCE_NOT_FOUND',
              400
            );
          }
        } else {
          throw new LedgerError(
            `Không xác định được nguồn phạt duy nhất từ source_id '${original.source_id}' và entry_code '${original.entry_code}'.`,
            'AMBIGUOUS_FINE_SOURCE',
            400
          );
        }
      }
    }
  } else if (original.source_type === 'DEPOSIT_REFUND' || original.source_type === 'LOAN_DEPOSIT_REFUND') {
    throw new LedgerError(
      'Bút toán hoàn cọc đã xác nhận chi trả tiền (DEPOSIT_REFUND) không thể đảo tùy ý qua sửa sai sổ cái.',
      'UNSUPPORTED_CORRECTION_SOURCE',
      400
    );
  } else if (original.source_type === 'LOAN_FINE_FORFEIT' || original.source_type === 'FINE_FORFEIT') {
    throw new LedgerError(
      'Bút toán tịch thu cọc (LOAN_FINE_FORFEIT) chưa hỗ trợ đảo trực tiếp qua sửa sai sổ cái.',
      'UNSUPPORTED_CORRECTION_SOURCE',
      400
    );
  } else if (original.source_type === 'LOAN_CARRY_FORWARD') {
    throw new LedgerError(
      'Bút toán chuyển tiếp cọc không thể đảo độc lập.',
      'UNSUPPORTED_CORRECTION_SOURCE',
      400
    );
  }

  // 7. S11-03: Mã đảo có bound an toàn <= 40 ký tự
  const baseCode = original.entry_code.startsWith('REV-') ? original.entry_code.slice(4) : original.entry_code;
  const reversalEntryCode = ('REV-' + baseCode).length <= 40
    ? `REV-${baseCode}`
    : `REV-${original.id.replace(/-/g, '').slice(0, 32)}`;

  const revEntry = await recordReversal(db, {
    originalEntryId: original.id,
    reversalEntryCode,
    reason: cleanReason,
    createdBy: actorId,
    allowDirectSourceReversal: true,
    targetCashSessionId: effectiveCashSessionId,
  });

  // 7. Ghi audit log
  await recordAuditLog(db, {
    actorId,
    action: 'FINANCE_LEDGER_CORRECTION',
    targetResource: 'JOURNAL_ENTRY',
    targetId: revEntry.id,
    details: {
      originalEntryId: original.id,
      originalEntryCode: original.entry_code,
      reversalEntryId: revEntry.id,
      reversalEntryCode: revEntry.entry_code,
      amount: Number(original.amount),
      reason: cleanReason,
      actionId,
    },
  });

  return {
    reversalEntryId: revEntry.id,
    reversalEntryCode: revEntry.entry_code,
    originalEntryId: original.id,
    originalEntryCode: original.entry_code,
    amount: Number(original.amount),
    fundId: original.fund_id as any,
    reason: cleanReason,
    cashSessionId: effectiveCashSessionId,
    message: `Đã thực hiện bút toán đảo sửa sai '${revEntry.entry_code}' thành công cho chứng từ gốc '${original.entry_code}'.`,
  };
}
