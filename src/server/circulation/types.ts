/**
 * YSBK Circulation Module Types (Chặng 07: Cho mượn & Nhận cọc)
 */

import { AppError } from '../errors.ts';
import type { PaymentMethod } from '../finance/types.ts';

export type LoanReceiptStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'PARTIAL_SETTLED' | 'CANCELLED' | 'PENDING_DEPOSIT' | 'LOST';

export class CirculationError extends AppError {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus = 400) {
    super(message, httpStatus, code);
    this.name = 'CirculationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class CopyNotAvailableError extends CirculationError {
  constructor(message = 'Bản sách không khả dụng để cho mượn.') {
    super(message, 'COPY_NOT_AVAILABLE', 409);
    this.name = 'CopyNotAvailableError';
  }
}

export class DuplicateCopyInLoanError extends CirculationError {
  constructor(message = 'Phiếu mượn không thể chứa các bản sách trùng nhau.') {
    super(message, 'DUPLICATE_COPY_IN_LOAN', 400);
    this.name = 'DuplicateCopyInLoanError';
  }
}

export class MaxCopiesExceededError extends CirculationError {
  constructor(message = 'Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách.') {
    super(message, 'MAX_COPIES_EXCEEDED', 400);
    this.name = 'MaxCopiesExceededError';
  }
}

export class PaymentUnconfirmedError extends CirculationError {
  constructor(message = 'Thành viên phải xác nhận đã nhận tiền mặt hoặc kiểm tra app ngân hàng trước khi lập phiếu.') {
    super(message, 'PAYMENT_UNCONFIRMED', 400);
    this.name = 'PaymentUnconfirmedError';
  }
}

export class BorrowerNotEligibleError extends CirculationError {
  constructor(message = 'Hồ sơ người mượn không đủ điều kiện lập phiếu.') {
    super(message, 'BORROWER_NOT_ELIGIBLE', 400);
    this.name = 'BorrowerNotEligibleError';
  }
}

export class LoanReceiptNotFoundError extends CirculationError {
  constructor(message = 'Không tìm thấy phiếu mượn.') {
    super(message, 'LOAN_RECEIPT_NOT_FOUND', 404);
    this.name = 'LoanReceiptNotFoundError';
  }
}

export class LoanAlreadyReturnedError extends CirculationError {
  constructor(message = 'Phiếu mượn đã được tất toán trả sách trước đó.') {
    super(message, 'LOAN_ALREADY_RETURNED', 409);
    this.name = 'LoanAlreadyReturnedError';
  }
}

export class ClosedSessionError extends CirculationError {
  constructor(message = 'Phiên quầy tiền mặt đã đóng, không thể tiếp nhận thêm giao dịch.') {
    super(message, 'SESSION_CLOSED', 409);
    this.name = 'ClosedSessionError';
  }
}

export class FineReasonRequiredError extends CirculationError {
  constructor(message = 'Bắt buộc cung cấp lý do điều chỉnh khi mức phạt khác mức phạt gợi ý.') {
    super(message, 'FINE_REASON_REQUIRED', 400);
    this.name = 'FineReasonRequiredError';
  }
}

export class DepositAmountMismatchError extends CirculationError {
  constructor(message = 'Số tiền cọc xác nhận không khớp với số tiền thực tế tính bởi hệ thống.') {
    super(message, 'DEPOSIT_AMOUNT_MISMATCH', 409);
    this.name = 'DepositAmountMismatchError';
  }
}

export class RefundConfirmationRequiredError extends CirculationError {
  constructor(message = 'Bắt buộc xác nhận tiền thực đã giao tận tay hoặc qua app ngân hàng (paymentConfirmed: true).') {
    super(message, 'REFUND_CONFIRMATION_REQUIRED', 400);
    this.name = 'RefundConfirmationRequiredError';
  }
}

export class MaxRenewalsExceededError extends CirculationError {
  constructor(message = 'Phiếu mượn đã đạt giới hạn gia hạn tối đa (3 lần).') {
    super(message, 'MAX_RENEWALS_EXCEEDED', 409);
    this.name = 'MaxRenewalsExceededError';
  }
}

export class InvalidLoanStatusForRenewalError extends CirculationError {
  constructor(message = 'Chỉ có thể gia hạn phiếu mượn đang hoạt động hoặc quá hạn.') {
    super(message, 'INVALID_LOAN_STATUS_FOR_RENEWAL', 409);
    this.name = 'InvalidLoanStatusForRenewalError';
  }
}

export class NoValidDutyShiftFoundError extends CirculationError {
  constructor(message = 'Không tìm thấy buổi trực hợp lệ trong khoảng giới hạn 60 ngày.') {
    super(message, 'NO_VALID_DUTY_SHIFT_FOUND', 400);
    this.name = 'NoValidDutyShiftFoundError';
  }
}

export class AllocationCoverageError extends CirculationError {
  constructor(message = 'Không tìm thấy phân bổ cọc hợp lệ cho từng cuốn sách trong phiếu mượn.') {
    super(message, 'ALLOCATION_COVERAGE_MISSING', 409);
    this.name = 'AllocationCoverageError';
  }
}

export interface IssueLoanParams {
  borrowerId: string;
  copyBarcodes?: string[];
  barcodes?: string[];
  copyIds?: string[];
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  paymentConfirmed: boolean;
  bankConfirmedByMember?: boolean;
  confirmedAmount?: number;
  sessionId?: string | null;
  notes?: string | null;
  reservationId?: string | null;
}

export interface LoanItemSnapshotDto {
  id: string;
  copyId: string;
  barcode: string;
  title: string;
  publisher: string;
  coverPrice: number | null;
  depositSnapshot: number;
  depositBasis?: string;
  policyVersion?: string;
  isReturned: boolean;
  isLost: boolean;
  lostAt?: string | null;
  lostReason?: string | null;
  carriedForwardAt?: string | null;
  successorItemId?: string | null;
}

export interface LoanReceiptDto {
  id: string;
  receiptNumber: string;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowDate: string;
  dueDate: string;
  originalDueDate?: string;
  renewCount: number;
  status: LoanReceiptStatus;
  precedingReceiptId?: string | null;
  items: LoanItemSnapshotDto[];
  totalDeposit: number;
  paymentMethod: PaymentMethod;
  confirmedBy: string;
  sessionId: string | null;
  fineSuggested?: number;
  fineFinal?: number;
  fineReason?: string | null;
  settledAt?: string | null;
  settledBy?: string | null;
  createdAt: string;
  notes?: string | null;
}

export interface SettleReturnParams {
  receiptId: string;
  returnedBarcodes?: string[];
  returnedCopyBarcodes?: string[];
  returnedCopyIds?: string[];
  copyBarcodes?: string[];
  barcodes?: string[];
  copyIds?: string[];
  returnType?: 'FULL' | 'PARTIAL';
  fineAmount?: number | bigint;
  fineReason?: string;
  refundMethod?: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  finePaymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  finePaymentConfirmed?: boolean;
  newDepositConfirmed?: boolean;
  newDepositPaymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  cashSessionId?: string | null;
  paymentConfirmed?: boolean;
  bankConfirmedByMember?: boolean;
  notes?: string | null;
}

export interface RefundIntentSummaryDto {
  id: string;
  allocationId: string;
  amount: number;
  refundMethod: PaymentMethod;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  cashSessionId?: string | null;
}

export interface SettleReturnResult {
  receiptId: string;
  receiptNumber: string;
  status: LoanReceiptStatus;
  returnDate: string;
  overdueDays: number;
  fineSuggested: number;
  fineFinal: number;
  fineReason: string | null;
  totalDeposit: number;
  depositRefunded: number;
  depositForfeited: number;
  directFineCollected: number;
  finePending?: number;
  fineStatus?: 'COLLECTED' | 'PENDING' | 'WAIVED';
  depositTransferred?: number;
  newDepositCollected?: number;
  newReceiptId?: string;
  newReceiptNumber?: string;
  successorReceiptId?: string;
  refundIntents: RefundIntentSummaryDto[];
  returnedItemsCount: number;
  message: string;
}

export interface LoanSettlementDto {
  id: string;
  receiptId: string;
  settlementType: 'FULL' | 'PARTIAL';
  returnDate: string;
  overdueDays: number;
  fineSuggested: number;
  fineFinal: number;
  fineReason: string | null;
  fineCollected: number;
  finePendingAmount: number;
  fineStatus: 'COLLECTED' | 'PENDING' | 'WAIVED';
  finePaymentMethod: PaymentMethod | null;
  totalDeposit: number;
  depositRefunded: number;
  depositForfeited: number;
  depositTransferred: number;
  newDepositCollected: number;
  successorReceiptId: string | null;
  cashSessionId: string | null;
  settledBy: string;
  settledAt: string;
}

export interface ConfirmRefundParams {
  refundIntentId: string;
  cashSessionId?: string | null;
  paymentConfirmed?: boolean;
}

export interface ConfirmRefundResult {
  refundIntentId: string;
  allocationId: string;
  amount: number;
  refundMethod: PaymentMethod;
  status: 'CONFIRMED';
  confirmedBy: string;
  confirmedAt: string;
  cashSessionId: string | null;
  journalEntryId: string;
  message: string;
}

export interface RenewLoanParams {
  receiptId: string;
  cashSessionId?: string | null;
  fineAmount?: number | bigint;
  fineReason?: string;
  finePaymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  finePaymentConfirmed?: boolean;
  notes?: string | null;
}

export interface RenewLoanResult {
  receiptId: string;
  receiptNumber: string;
  renewalSequence: number;
  previousDueDate: string;
  newDueDate: string;
  originalNewDueDate: string;
  adjustmentReason?: string;
  renewCount: number;
  isOverdue: boolean;
  overdueDays: number;
  fineSuggested: number;
  fineFinal: number;
  fineCollected: boolean;
  finePending: boolean;
  fineStatus: 'COLLECTED' | 'PENDING' | 'WAIVED';
  renewedAt: string;
  renewedBy: string;
  message: string;
}

export interface LoanRenewalDto {
  id: string;
  receiptId: string;
  renewalSequence: number;
  renewedAt: string;
  renewedBy: string;
  previousDueDate: string;
  newDueDate: string;
  originalNewDueDate: string;
  adjustmentReason: string | null;
  isOverdue: boolean;
  overdueDays: number;
  fineSuggested: number;
  fineFinal: number;
  fineReason: string | null;
  fineCollected: number;
  finePendingAmount: number;
  fineStatus: 'COLLECTED' | 'PENDING' | 'WAIVED';
  finePaymentMethod: PaymentMethod | null;
  cashSessionId: string | null;
  notes: string | null;
}

export interface ConfirmNewDepositParams {
  receiptId: string;
  cashSessionId?: string | null;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  paymentConfirmed: boolean;
  notes?: string | null;
}

export interface ConfirmNewDepositResult {
  receiptId: string;
  receiptNumber: string;
  status: LoanReceiptStatus;
  depositAmount: number;
  paymentMethod: PaymentMethod;
  cashSessionId: string | null;
  journalEntryId: string;
  message: string;
}

export interface CollectPendingFineParams {
  receiptId: string;
  targetId?: string;
  sourceId?: string;
  cashSessionId?: string | null;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  paymentConfirmed: boolean;
  amount?: number | bigint;
  notes?: string | null;
}

export interface CollectPendingFineResult {
  receiptId: string;
  settlementId: string;
  fineCollected: number;
  finePendingAmount: number;
  paymentMethod: PaymentMethod;
  fineStatus: 'COLLECTED' | 'PENDING';
  cashSessionId: string | null;
  journalEntryId: string;
  message: string;
}

export interface ReportBookLossParams {
  receiptId: string;
  copyIds?: string[];
  barcodes?: string[];
  reason: string;
  cashSessionId?: string | null;
  actionId?: string;
  notes?: string | null;
}

export interface ReportBookLossResult {
  receiptId: string;
  receiptNumber: string;
  lostCopyIds: string[];
  forfeitedDeposit: number;
  receiptStatus: LoanReceiptStatus | 'LOST';
  settlementType?: 'LOST' | null;
  journalEntryId?: string | null;
  message: string;
}

export interface QuoteLoanActionParams {
  receiptId: string;
  action: 'RETURN' | 'RENEW';
  targetDate?: string;
}

export interface QuoteLoanActionResult {
  receiptId: string;
  receiptNumber: string;
  action: 'RETURN' | 'RENEW';
  borrowDate: string;
  rawDueDate: string;
  effectiveDueDate: string;
  targetDate: string;
  projectedDueDate: string;
  isOverdue: boolean;
  overdueDays: number;
  suggestedFine: number;
  effectiveFine: number;
  totalDeposit: number;
  canRenew: boolean;
  renewCount: number;
  items: Array<{
    barcode: string;
    title: string;
    depositSnapshot: number;
    returnedAt: string | null;
    isLost: boolean;
  }>;
}

export interface PendingRefundItemDto {
  id: string;
  allocationId: string;
  receiptId: string;
  receiptNumber: string;
  borrowerName: string;
  borrowerStudentId: string;
  amount: number;
  refundMethod: PaymentMethod;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  requestedBy: string;
}

export interface PendingDepositItemDto {
  receiptId: string;
  receiptNumber: string;
  borrowerName: string;
  borrowerStudentId: string;
  requiredDeposit: number;
  paymentMethod: PaymentMethod;
  barcode: string;
  title: string;
  borrowDate: string;
  dueDate: string;
  createdAt: string;
}

export interface PendingFineItemDto {
  targetId: string;
  settlementId?: string;
  sourceType: 'SETTLEMENT' | 'RENEWAL';
  receiptId: string;
  receiptNumber: string;
  borrowerName: string;
  borrowerStudentId: string;
  pendingAmount: number;
  fineReason: string | null;
  settledAt: string;
}
