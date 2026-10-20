/**
 * YSBK Core Finance Types & Bounds
 * Quy chuẩn sổ kép tối thiểu, ID 2 quỹ độc lập, danh mục tài khoản, và ràng buộc an toàn tiền VND.
 */

export const FUND_IDS = {
  LOAN: 'FUND_LOAN',
  OPERATION: 'FUND_OPERATION',
} as const;

export type FundId = typeof FUND_IDS[keyof typeof FUND_IDS];

export const ACCOUNT_CODES = {
  // Tài sản / Nơi giữ tiền (Assets)
  CASH_DRAWER: 'TIEN_MAT_HOP',
  BANK_MAIN: 'TIEN_NGAN_HANG',
  BOOKSTORE_DEPOSIT_RECEIVABLE: 'COC_DAT_NHA_SACH',

  // Nợ phải trả / Nghĩa vụ (Liabilities)
  DEPOSIT_LIABILITY: 'COC_PHAI_HOAN',
  BOOKSTORE_PAYABLE: 'NO_PHAI_TRA_NHA_SACH',

  // Thu nhập / Doanh thu (Revenues)
  FINE_REVENUE: 'THU_PHAT',
  MEMBER_FEE: 'HOI_PHI',
  BOOK_SALES_REVENUE: 'DOANH_THU_BAN_SACH',

  // Chi phí hoạt động / Sự kiện (Expenses)
  ACTIVITY_EXPENSE: 'CHI_HOAT_DONG_SU_KIEN',
} as const;

export type AccountCode = typeof ACCOUNT_CODES[keyof typeof ACCOUNT_CODES];

/**
 * Ma trận tài khoản hợp lệ cho từng quỹ.
 * Hai quỹ tuyệt đối độc lập; cọc bạn đọc là nghĩa vụ Quỹ Mượn–Trả, cọc nhà sách là tài sản Quỹ Hoạt Động.
 */
export const ALLOWED_FUND_ACCOUNTS: Record<FundId, readonly AccountCode[]> = {
  [FUND_IDS.LOAN]: [
    ACCOUNT_CODES.CASH_DRAWER,
    ACCOUNT_CODES.BANK_MAIN,
    ACCOUNT_CODES.DEPOSIT_LIABILITY,
    ACCOUNT_CODES.FINE_REVENUE,
  ],
  [FUND_IDS.OPERATION]: [
    ACCOUNT_CODES.CASH_DRAWER,
    ACCOUNT_CODES.BANK_MAIN,
    ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE,
    ACCOUNT_CODES.BOOKSTORE_PAYABLE,
    ACCOUNT_CODES.MEMBER_FEE,
    ACCOUNT_CODES.BOOK_SALES_REVENUE,
    ACCOUNT_CODES.ACTIVITY_EXPENSE,
  ],
};

export function assertValidFundAccount(fundId: FundId, account: string): void {
  const allowed = ALLOWED_FUND_ACCOUNTS[fundId];
  if (!allowed || !allowed.includes(account as AccountCode)) {
    throw new Error(
      `[FINANCE_INVALID_ACCOUNT] Tài khoản '${account}' không thuộc danh mục hợp lệ của quỹ '${fundId}'.`
    );
  }
}

/** Giới hạn tiền VND an toàn: 1.000 tỷ VND (vượt xa mọi giao dịch CLB, tránh tràn số) */
export const MAX_SAFE_VND = 1_000_000_000_000n;

/**
 * Kiểm tra và chuẩn hóa số tiền VND thành bigint an toàn.
 * Chặn: số âm, phân số (float), NaN, Infinity, chuỗi rác, vượt giới hạn.
 */
export function assertSafeVndAmount(
  amount: unknown,
  options: { allowZero?: boolean } = {}
): bigint {
  if (amount === null || amount === undefined) {
    throw new Error('[FINANCE_INVALID_AMOUNT] Số tiền không được để trống.');
  }

  let val: bigint;

  if (typeof amount === 'bigint') {
    val = amount;
  } else if (typeof amount === 'number') {
    if (!Number.isFinite(amount) || Number.isNaN(amount)) {
      throw new Error('[FINANCE_INVALID_AMOUNT] Số tiền phải là số hợp lệ (không chấp nhận NaN/Infinity).');
    }
    if (!Number.isInteger(amount)) {
      throw new Error('[FINANCE_INVALID_AMOUNT] Tiền VND phải là số nguyên (không chấp nhận phân số).');
    }
    if (!Number.isSafeInteger(amount)) {
      throw new Error('[FINANCE_INVALID_AMOUNT] Số tiền vượt ngưỡng an toàn của JavaScript Number.');
    }
    val = BigInt(amount);
  } else if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`[FINANCE_INVALID_AMOUNT] Chuỗi số tiền '${amount}' không phải số nguyên hợp lệ.`);
    }
    val = BigInt(trimmed);
  } else {
    throw new Error('[FINANCE_INVALID_AMOUNT] Kiểu dữ liệu số tiền không được hỗ trợ.');
  }

  if (options.allowZero) {
    if (val < 0n) {
      throw new Error('[FINANCE_INVALID_AMOUNT] Số tiền không được âm.');
    }
  } else {
    if (val <= 0n) {
      throw new Error('[FINANCE_INVALID_AMOUNT] Số tiền phải lớn hơn 0.');
    }
  }

  if (val > MAX_SAFE_VND) {
    throw new Error(`[FINANCE_INVALID_AMOUNT] Số tiền vượt quá giới hạn an toàn tối đa (${MAX_SAFE_VND.toString()} VND).`);
  }

  return val;
}

/** Chuyển bigint VND sang number JavaScript an toàn cho JSON responses */
export function serializeVnd(val: bigint): number {
  if (val > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('[FINANCE_SERIALIZATION_OVERFLOW] Giá trị tiền vượt ngưỡng an toàn để biểu diễn JSON number.');
  }
  return Number(val);
}

export type DepositStatus = 'HELD' | 'PENDING_REFUND' | 'REFUNDED' | 'FORFEITED' | 'TRANSFERRED' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';

export interface DepositAllocation {
  id: string;
  receipt_id: string;
  item_id: string | null;
  fund_id: string;
  original_amount: bigint;
  remaining_amount: bigint;
  status: DepositStatus;
  payment_method: PaymentMethod;
  refund_method: PaymentMethod | null;
  transferred_to_receipt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundIntent {
  id: string;
  allocation_id: string;
  amount: bigint;
  refund_method: PaymentMethod;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  requested_by: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cash_session_id: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashSession {
  id: string;
  session_date: string;
  opened_by: string;
  opened_at: string;
  opening_cash: bigint;
  expected_closing_cash: bigint;
  actual_closing_cash: bigint | null;
  discrepancy: bigint | null;
  discrepancy_reason: string | null;
  is_closed: boolean;
  closed_at: string | null;
  closed_by: string | null;
  handed_over_from_session_id: string | null;
}

export interface CashSessionSummary {
  session: CashSession;
  cashIn: bigint;
  cashOut: bigint;
  expectedCash: bigint;
  actualCash: bigint | null;
  discrepancy: bigint | null;
  discrepancyReason: string | null;
  bankIn: bigint;
  bankOut: bigint;
  depositLiabilitiesCreated: bigint;
  depositLiabilitiesRefunded: bigint;
  depositLiabilitiesDelta: bigint;
  depositLiabilitiesRemaining: bigint;
}

export interface ForfeitPolicyConfig {
  targetFundId: FundId;
  targetAccount: AccountCode;
  reason: string;
  policyVersion?: string;
}

export interface JournalEntry {
  id: string;
  entry_code: string;
  fund_id: string;
  source_type: string;
  source_id: string;
  debit_account: string;
  credit_account: string;
  amount: bigint;
  reversal_of_entry_id: string | null;
  cash_session_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface Queryable {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface DocumentCorrectionParams {
  originalEntryId: string;
  reason: string;
  cashSessionId?: string | null;
  actionId?: string;
  paymentConfirmed?: boolean;
  expectedAmount?: number | bigint;
}

export interface DocumentCorrectionResult {
  reversalEntryId: string;
  reversalEntryCode: string;
  originalEntryId: string;
  originalEntryCode: string;
  amount: number;
  fundId: FundId;
  reason: string;
  cashSessionId?: string | null;
  message: string;
}
