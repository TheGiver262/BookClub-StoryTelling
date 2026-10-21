/**
 * YSBK Typed API Client Adapter
 * Kết nối giao diện quầy sách (Desk UI) và phân hệ xác thực nội bộ với REST API server.
 * Tuân thủ bảo mật HttpOnly cookie, Idempotency-Key, and Fail-Closed error handling.
 */

export interface ReaderProfile {id:string;email:string;fullName:string;phone:string|null;}

export interface AuthenticatedActor {
  isCollaborator?: boolean;
  userId: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'MEMBER' | 'GUEST';
  isAlumni: boolean;
  isActive: boolean;
  memberId?: string;
}

export interface CashSessionDto {
  id: string;
  sessionDate: string;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  expectedClosingCash: number;
  actualClosingCash: number | null;
  discrepancy: number | null;
  discrepancyReason: string | null;
  isClosed: boolean;
  closedAt: string | null;
  closedBy: string | null;
  handedOverFromSessionId: string | null;
}

export interface CashSessionSummaryDto {
  sessionId: string;
  sessionDate: string;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  expectedClosingCash: number;
  actualClosingCash: number | null;
  discrepancy: number | null;
  discrepancyReason: string | null;
  isClosed: boolean;
  closedAt: string | null;
  totalCashIn: number;
  totalCashOut: number;
  netCashMovement: number;
  totalBankIn: number;
  totalBankOut: number;
  depositCollectedCash: number;
  depositRefundedCash: number;
  finesCollectedCash: number;
  finesCollectedBank: number;
  pendingRefundsCount: number;
  pendingRefundsAmount: number;
}

export interface BorrowerDto {
  id: string;
  fullName: string;
  phone: string;
  studentId?: string | null;
  school?: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface BookCopyDto {
  id: string;
  barcode: string;
  copyNumber: number;
  coverPrice: number | null;
  location: string;
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'MAINTENANCE';
  title?: string;
  editionId?: string;
  calculatedDeposit?: number;
}

export interface LoanItemSnapshotDto {
  id: string;
  copyId: string;
  barcode: string;
  title: string;
  publisher?: string;
  coverPrice: number | null;
  depositSnapshot: number;
  isReturned: boolean;
  returnedAt: string | null;
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
  borrowerStudentId?: string | null;
  borrowerSchool?: string | null;
  borrowDate: string;
  dueDate: string;
  renewCount: number;
  status: 'ACTIVE' | 'RETURNED' | 'PARTIAL_SETTLED' | 'PENDING_DEPOSIT' | 'OVERDUE' | 'LOST' | 'CANCELLED';
  precedingReceiptId?: string | null;
  totalDeposit: number;
  totalDepositAmount: number;
  paymentMethod: string;
  items: LoanItemSnapshotDto[];
  confirmedBy?: string | null;
  sessionId?: string | null;
  fineSuggested?: number;
  fineFinal?: number;
  fineReason?: string | null;
  settledAt?: string | null;
  settledBy?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface LoanSettlementDto {
  id: string;
  loanReceiptId: string;
  settlementDate: string;
  settlementType: 'FULL' | 'PARTIAL' | 'LOST';
  overdueDays: number;
  suggestedFineAmount: number;
  fineFinalAmount: number;
  fineWaivedReason: string | null;
  fineStatus: 'COLLECTED' | 'PENDING' | 'WAIVED';
  fineCollectedAmount: number;
  finePendingAmount: number;
  carriedForwardReceiptId?: string | null;
  returnedItemBarcodes: string[];
}

export interface RenewalRecordDto {
  id: string;
  renewalDate: string;
  previousDueDate: string;
  newDueDate: string;
  fineAmount: number;
  fineStatus: string;
  fineWaivedReason?: string | null;
  renewNumber: number;
}

export interface CalendarHolidayDto {
  holidayDate: string;
  name: string;
  description: string | null;
}

export interface LoanQuoteDto {
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

export interface PendingRefundDto {
  id: string;
  allocationId: string;
  receiptId: string;
  receiptNumber: string;
  borrowerName: string;
  borrowerStudentId: string;
  amount: number;
  refundMethod: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  requestedBy: string;
}

export interface PendingDepositDto {
  receiptId: string;
  receiptNumber: string;
  borrowerName: string;
  borrowerStudentId: string;
  requiredDeposit: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  barcode: string;
  title: string;
  borrowDate: string;
  dueDate: string;
  createdAt: string;
}

export interface PendingFineDto {
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

export interface AlumniActivityDto {
  id: string;
  title: string;
  description: string;
  activityDate: string;
  location: string;
  status: string;
}

export interface MemberDto {
  isCollaborator?: boolean;
  probationStartedOn?: string | null;
  probationEndsOn?: string | null;
  collaboratorDeletedAt?: string | null;
  id: string;
  fullName: string;
  username: string;
  team: string;
  roleTitle: string;
  schoolYear: string;
  phone: string;
  studentId?: string;
  department?: string;
  role?: string;
  isEligibleMainDuty: boolean;
  hasPaidFee: boolean;
  isAlumni: boolean;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MemberAffiliationDto {
  id: string;
  memberId: string;
  department: 'BAN_HAU_CAN' | 'BAN_NOI_DUNG' | 'BAN_TTDN' | 'BAN_CHU_NHIEM';
  role: 'TRUONG_BAN' | 'PHO_BAN' | 'THANH_VIEN' | 'CHU_NHIEM' | 'PHO_CHU_NHIEM' | 'UY_VIEN_BCN';
  termYear: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface MemberHeadcountSummaryDto {
  totalDistinctMembers: number;
  totalActiveMembers: number;
  totalAlumniMembers: number;
  departments: {
    BAN_HAU_CAN: number;
    BAN_NOI_DUNG: number;
    BAN_TTDN: number;
    BAN_CHU_NHIEM: number;
  };
  multiDepartmentMemberCount: number;
}

export interface MembershipDuesReceiptDto {
  id: string;
  receiptNumber: string;
  memberId: string;
  memberName?: string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentConfirmed: boolean;
  cashSessionId?: string | null;
  journalEntryId?: string | null;
  collectedBy: string;
  collectedAt: string;
  termLabel: string;
  notes?: string | null;
}

export interface ParsedAvailabilityRowDto {
  rowNumber: number;
  rawMemberIdentifier: string;
  rawDayOfWeek: string;
  rawStartTime: string;
  rawEndTime: string;
  rawBusyType?: string;
  rawNotes?: string;
  resolvedMemberId?: string;
  resolvedMemberName?: string;
  normalizedDayOfWeek?: string;
  normalizedStartTime?: string;
  normalizedEndTime?: string;
  normalizedBusyType?: string;
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface AvailabilityPreviewResultDto {
  fileName: string;
  fileSizeBytes: number;
  fileHash: string;
  termSemester: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ParsedAvailabilityRowDto[];
  isReadyToCommit: boolean;
  unrecognizedMembersCount: number;
}

export interface AvailabilityBatchDto {
  id: string;
  batchName: string;
  fileName: string;
  fileHash: string;
  fileSizeBytes: number;
  termSemester: string;
  version: number;
  status: 'PREVIEWED' | 'COMMITTED' | 'SUPERSEDED';
  totalRows: number;
  validRows: number;
  errorRows: number;
  importedBy: string;
  createdAt: string;
}

export interface MemberBusyIntervalDto {
  id: string;
  batchId: string;
  memberId: string;
  memberName?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  busyType: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DutyAssigneeDto {
  id: string;
  scheduleId: string;
  memberId: string;
  memberName?: string;
  memberStudentId?: string | null;
  dutyType: 'MAIN' | 'SUPPORT';
  assignedRole: 'BOOK_INTRO' | 'CIRCULATION_LOG' | 'CASH_DRAWER' | 'LOGISTICS_SETUP';
  attendanceStatus: 'SCHEDULED' | 'PRESENT' | 'ABSENT' | 'SUBSTITUTED';
  notes?: string | null;
  createdAt: string;
}

export interface DutyScheduleDto {
  id: string;
  termSemester: string;
  scheduleDate: string;
  dayOfWeek: 'THU_BA' | 'THU_NAM';
  shiftTime: string;
  location: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
  version: number;
  publishedVersion?: number | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  warningMain?: string | null;
  warningSupport?: string | null;
  isManuallyEdited: boolean;
  facebookPostContent?: string | null;
  assignees: DutyAssigneeDto[];
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentResponseDetailDto {
  id: string;
  formId: string;
  responseId: string;
  submissionTimestamp: string;
  applicantName: string;
  applicantStudentId?: string | null;
  applicantEmail: string;
  applicantPhone?: string | null;
  aspiration1: string;
  aspiration2?: string | null;
  whyJoin?: string | null;
  essayContent?: string | null;
  cvLink?: string | null;
  rawAnswers: Record<string, unknown>;
  syncStatus: 'SYNCED' | 'PENDING_RECONCILIATION' | 'CONFLICT' | 'ERROR';
  lastObservedAt: string;
  syncError?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentResponsePublicDto {
  id: string;
  formId: string;
  maskedName: string;
  maskedStudentId?: string | null;
  maskedEmail: string;
  aspiration1: string;
  aspiration2?: string | null;
  submissionDate: string;
  syncStatus: 'SYNCED' | 'PENDING_RECONCILIATION' | 'CONFLICT' | 'ERROR';
}

export interface ReconciliationResultDto {
  formId: string;
  totalObserved: number;
  syncedCount: number;
  missingBackfilledCount: number;
  discrepancyCount: number;
  checkpointId: string;
  status: 'SUCCESS' | 'DISCREPANCY_DETECTED' | 'ERROR';
  details?: Record<string, unknown>;
}

export interface RecruitmentRubricCriterionDto {
  id: string;
  rubricId: string;
  code: string;
  name: string;
  description?: string | null;
  section: 'INTERVIEW' | 'ESSAY' | 'COMMITTEE';
  minScore: number;
  maxScore: number;
  weight: number;
  sortOrder: number;
}

export interface RecruitmentRubricDto {
  id: string;
  campaignId: string;
  version: number;
  title: string;
  formulaType: 'UNSPECIFIED' | 'WEIGHTED_SUM' | 'AVERAGE_CRITERIA';
  isActive: boolean;
  criteria?: RecruitmentRubricCriterionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentEvaluationDto {
  id: string;
  responseId: string;
  evaluatorId: string;
  rubricId?: string | null;
  evaluationType: 'INDIVIDUAL' | 'COMMITTEE';
  rawScores: Record<string, number>;
  totalScore?: number | null;
  formulaStatus: 'CALCULATED' | 'UNSPECIFIED_FORMULA';
  interviewNotes?: string | null;
  status: 'DRAFT' | 'COMPLETED';
  decision?: 'PASSED' | 'FAILED' | 'RESERVE' | 'PENDING' | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentEvaluationHistoryDto {
  id: string;
  evaluationId: string;
  modifiedBy: string;
  modifiedAt: string;
  reason: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  previousVersion: number;
  newVersion: number;
}

export interface RecruitmentDecisionDto {
  id: string;
  responseId: string;
  decision: 'PASSED' | 'FAILED' | 'RESERVE';
  assignedDepartment: string;
  committeeNotes?: string | null;
  decidedBy: string;
  decidedAt: string;
  isConvertedToMember: boolean;
  convertedMemberId?: string | null;
  convertedAt?: string | null;
}

export interface PublicApprovedResultDto {
  candidateCode: string;
  passedDepartment: string;
  termSemester: string;
  announcementDate: string;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function generateIdempotencyKey(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

export function canonicalizeJson(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val === 'bigint') {
    return val.toString();
  }
  if (typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalizeJson(item)).join(',') + ']';
  }

  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const propertyValue = obj[key];
    if (propertyValue !== undefined && typeof propertyValue !== 'function') {
      entries.push(`${JSON.stringify(key)}:${canonicalizeJson(propertyValue)}`);
    }
  }

  return '{' + entries.join(',') + '}';
}

export function hashPayload(payload: unknown): string {
  const str = canonicalizeJson(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export interface ActionRecord {
  key: string;
  operation: string;
  entityId: string;
  payloadHash: string;
  actorId?: string;
  createdAt: number;
}

export class ActionKeyRegistry {
  private records = new Map<string, ActionRecord>();
  private storageKey = 'ysbk_action_records_v1';

  constructor() {
    this.restoreFromStorage();
  }

  private getCompositeKey(operation: string, entityId: string): string {
    return `${operation}::${entityId || 'DEFAULT'}`;
  }

  private restoreFromStorage(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const rec of parsed) {
            if (rec && rec.operation && rec.key) {
              this.records.set(this.getCompositeKey(rec.operation, rec.entityId), rec);
            }
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const list = Array.from(this.records.values());
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch {
      // Ignore storage write errors
    }
  }

  getOrCreateKey(
    operation: string,
    entityId: string,
    payload: unknown,
    actorId?: string
  ): string {
    const compKey = this.getCompositeKey(operation, entityId);
    const pHash = hashPayload(payload);
    const existing = this.records.get(compKey);

    if (
      existing &&
      existing.payloadHash === pHash &&
      (!actorId || !existing.actorId || existing.actorId === actorId)
    ) {
      return existing.key;
    }

    const cleanOp = operation.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newKey = generateIdempotencyKey(cleanOp || 'ACT');
    const record: ActionRecord = {
      key: newKey,
      operation,
      entityId,
      payloadHash: pHash,
      actorId,
      createdAt: Date.now(),
    };
    this.records.set(compKey, record);
    this.persistToStorage();
    return newKey;
  }

  clearKey(operation: string, entityId: string): void {
    const compKey = this.getCompositeKey(operation, entityId);
    if (this.records.delete(compKey)) {
      this.persistToStorage();
    }
  }

  clearAll(): void {
    this.records.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(this.storageKey);
      } catch {
        // Ignore
      }
    }
  }

  getRecord(operation: string, entityId: string): ActionRecord | undefined {
    return this.records.get(this.getCompositeKey(operation, entityId));
  }
}

export const actionKeyRegistry = new ActionKeyRegistry();

export function mapCashSession(data: any): CashSessionDto {
  if (!data) return data;
  return {
    id: data.id,
    sessionDate: data.sessionDate || data.session_date,
    openedBy: data.openedBy || data.opened_by,
    openedAt: data.openedAt || data.opened_at,
    openingCash: Number(data.openingCash ?? data.opening_cash ?? 0),
    expectedClosingCash: Number(data.expectedClosingCash ?? data.expected_closing_cash ?? 0),
    actualClosingCash:
      data.actualClosingCash !== null && data.actualClosingCash !== undefined
        ? Number(data.actualClosingCash)
        : data.actual_closing_cash !== null && data.actual_closing_cash !== undefined
        ? Number(data.actual_closing_cash)
        : null,
    discrepancy:
      data.discrepancy !== null && data.discrepancy !== undefined
        ? Number(data.discrepancy)
        : null,
    discrepancyReason: data.discrepancyReason || data.discrepancy_reason || null,
    isClosed: Boolean(data.isClosed ?? data.is_closed),
    closedAt: data.closedAt || data.closed_at || null,
    closedBy: data.closedBy || data.closed_by || null,
    handedOverFromSessionId: data.handedOverFromSessionId || data.handed_over_from_session_id || null,
  };
}

export function mapLoanReceipt(data: any): LoanReceiptDto {
  if (!data) return data;
  const items: LoanItemSnapshotDto[] = Array.isArray(data.items)
    ? data.items.map((it: any) => ({
        id: it.id,
        copyId: it.copyId || it.copy_id,
        barcode: it.barcode,
        title: it.title,
        publisher: it.publisher,
        coverPrice:
          it.coverPrice !== undefined
            ? it.coverPrice
            : it.cover_price !== null && it.cover_price !== undefined
            ? Number(it.cover_price)
            : null,
        depositSnapshot: Number(it.depositSnapshot ?? it.deposit_snapshot ?? 0),
        isReturned: Boolean(it.isReturned ?? it.returned_at ?? it.returnedAt),
        returnedAt: it.returnedAt || it.returned_at || null,
        isLost: Boolean(it.isLost ?? it.is_lost),
        lostAt: it.lostAt || it.lost_at || null,
        lostReason: it.lostReason || it.lost_reason || null,
        carriedForwardAt: it.carriedForwardAt || it.carried_forward_at || null,
        successorItemId: it.successorItemId || it.successor_item_id || null,
      }))
    : [];

  const totalDeposit = Number(data.totalDeposit ?? data.totalDepositAmount ?? data.total_deposit ?? 0);

  return {
    id: data.id,
    receiptNumber: data.receiptNumber || data.receipt_number,
    borrowerId: data.borrowerId || data.borrower_id,
    borrowerName: data.borrowerName || data.borrower_name,
    borrowerPhone: data.borrowerPhone || data.borrower_phone,
    borrowerStudentId: data.borrowerStudentId || data.borrower_student_id || null,
    borrowerSchool: data.borrowerSchool || data.borrower_school || null,
    borrowDate: data.borrowDate || data.borrow_date,
    dueDate: data.dueDate || data.due_date,
    renewCount: Number(data.renewCount ?? data.renew_count ?? 0),
    status: data.status,
    precedingReceiptId: data.precedingReceiptId || data.preceding_receipt_id || null,
    totalDeposit,
    totalDepositAmount: totalDeposit,
    paymentMethod: data.paymentMethod || data.payment_method || 'CASH',
    items,
    confirmedBy: data.confirmedBy || data.created_by || null,
    sessionId: data.sessionId || data.cash_session_id || null,
    fineSuggested: data.fineSuggested !== undefined ? Number(data.fineSuggested) : undefined,
    fineFinal: data.fineFinal !== undefined ? Number(data.fineFinal) : undefined,
    fineReason: data.fineReason || null,
    settledAt: data.settledAt || data.settled_at || null,
    settledBy: data.settledBy || data.settled_by || null,
    notes: data.notes || null,
    createdAt: data.createdAt || data.created_at || null,
  };
}

export interface BookSupplierDto {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ConsignmentLotItemDto {
  id: string;
  lotId: string;
  titleId?: string | null;
  bookTitle: string;
  isbn?: string | null;
  coverPrice: number;
  importDiscountPercent: number;
  importPrice: number;
  retailPrice: number;
  initialQuantity: number;
  soldQuantity: number;
  returnedQuantity: number;
  retainedQuantity: number;
  availableQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignmentLotDto {
  id: string;
  batchCode: string;
  supplierId: string;
  supplierName?: string;
  campaignName: string;
  receivedDate: string;
  targetSettlementDate?: string | null;
  depositAmount: number;
  depositRefunded: number;
  depositStatus: 'NONE' | 'PAID' | 'PENDING_REFUND' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';
  status: 'ACTIVE' | 'CLOSED' | 'SETTLED';
  createdBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ConsignmentLotItemDto[];
}

export interface BookSaleDto {
  id: string;
  saleCode: string;
  lotItemId: string;
  cashSessionId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  quantity: number;
  unitPrice: number;
  saleDiscountPercent: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentStatus: 'PAID';
  createdBy: string;
  createdAt: string;
  bookTitle?: string;
}

export interface ConsignmentReturnDto {
  id: string;
  returnCode: string;
  lotId: string;
  lotItemId: string;
  returnedQuantity: number;
  returnDate: string;
  recipientName?: string | null;
  proofNotes?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ConsignmentSettlementDto {
  id: string;
  settlementCode: string;
  lotId: string;
  settlementDate: string;
  totalSoldBooks: number;
  totalReturnedBooks: number;
  totalRetainedBooks: number;
  totalRevenue: number;
  payableToSupplier: number;
  grossProfit: number;
  depositPaid: number;
  depositRefundExpected: number;
  paidToSupplier: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  depositRefundStatus: 'NONE' | 'PENDING' | 'RECEIVED';
  depositRefundReceived: number;
  idempotencyKey?: string | null;
  settledBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPaymentDto {
  id: string;
  paymentCode: string;
  settlementId: string;
  paymentType: 'PAY_SUPPLIER_PAYABLE' | 'RECEIVE_DEPOSIT_REFUND';
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  confirmedAt: string;
  confirmedBy: string;
  referenceDoc?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ActivityDto {
  id: string;
  title: string;
  description: string;
  eventType: 'WORKSHOP' | 'BOOK_FAIR' | 'TALKSHOW' | 'INTERNAL_MEETING' | 'VOLUNTEER' | 'OTHER';
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  budget: number;
  status: 'PLANNING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isApprovedForPublic: boolean;
  isApprovedForAlumni: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTaskDto {
  id: string;
  activityId: string;
  title: string;
  description?: string | null;
  assigneeMemberId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTaskHistoryDto {
  id: string;
  taskId: string;
  changedBy: string;
  changedByName?: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: string;
}

export interface ActivityParticipantDto {
  id: string;
  activityId: string;
  participantType: 'MEMBER' | 'GUEST';
  memberId?: string | null;
  memberName?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  role: 'ATTENDEE' | 'SPEAKER' | 'ORGANIZER' | 'VOLUNTEER';
  status: 'REGISTERED' | 'ATTENDED' | 'CANCELLED';
  checkInTime?: string | null;
  createdAt: string;
}

export interface ActivityBudgetItemDto {
  id: string;
  activityId: string;
  category: 'VENUE' | 'LOGISTICS' | 'PRINTING' | 'REFRESHMENTS' | 'GIFTS' | 'SPEAKER_HONORARIUM' | 'OTHER';
  description: string;
  estimatedAmount: number;
  createdAt: string;
}

export interface ActivityExpenseDto {
  id: string;
  activityId: string;
  budgetItemId?: string | null;
  description: string;
  actualAmount: number;
  expenseDate: string;
  payerMemberId: string;
  payerName?: string;
  paymentMethod: 'CASH' | 'BANK';
  receiptRef?: string | null;
  journalEntryId?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ActivityDetailDto {
  activity: ActivityDto;
  tasks: ActivityTaskDto[];
  participants: ActivityParticipantDto[];
  budgetItems: ActivityBudgetItemDto[];
  expenses: ActivityExpenseDto[];
  financialSummary: {
    totalBudget: number;
    totalExpense: number;
    budgetVariance: number;
  };
}

export interface SafeAlumniActivityDto {
  id: string;
  title: string;
  description: string;
  activityDate: string;
  location: string;
  status: string;
}

export interface SafePublicActivityDto {
  id: string;
  title: string;
  description: string;
  eventType: string;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
}

export function unwrapData<T>(raw: any): T {
  if (raw === null || raw === undefined) {
    return raw as T;
  }
  if (typeof raw === 'object' && 'data' in raw && raw.data !== undefined) {
    return raw.data as T;
  }
  return raw as T;
}

export async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  let data: any = null;
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const errorPayload = data && typeof data === 'object' && data.error ? data.error : null;
    const message = errorPayload?.message || (typeof data === 'string' ? data : res.statusText);
    const code = errorPayload?.code || `HTTP_${res.status}`;
    throw new ApiClientError(message, code, res.status, errorPayload?.details);
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.data !== undefined) {
      if (data.meta !== undefined) {
        if (Array.isArray(data.data)) {
          const arr = [...data.data] as any;
          arr.meta = data.meta;
          if (data.total !== undefined) arr.total = data.total;
          if (data.page !== undefined) arr.page = data.page;
          if (data.limit !== undefined) arr.limit = data.limit;
          return arr as T;
        }
        return { ...data.data, meta: data.meta } as T;
      }
      return data.data as T;
    }
  }

  return (data?.data !== undefined ? data.data : data) as T;
}

// =========================================================================
// API CLIENT IMPLEMENTATION
// =========================================================================

export const apiClient = {
  // 1. Auth & Me
  async getMe(): Promise<AuthenticatedActor> {
    return requestJson<AuthenticatedActor>('/api/v1/auth/me', { method: 'GET' });
  },

  async loginInternal(username: string, password: string): Promise<{ actor: AuthenticatedActor; token: string }> {
    return requestJson<{ actor: AuthenticatedActor; token: string }>('/api/v1/auth/login-internal', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async logout(): Promise<void> {
    await requestJson<void>('/api/v1/auth/logout', { method: 'POST' });
  },

  // 2. Cash Sessions
  async getTodaySession(): Promise<CashSessionDto> {
    const raw = await requestJson<any>('/api/v1/finance/cash-session/today', { method: 'GET' });
    return mapCashSession(raw);
  },

  async openSession(params: {
    sessionDate: string;
    openingCash: number;
    sessionId?: string;
    handedOverFromSessionId?: string;
    discrepancyReason?: string;
    idempotencyKey?: string;
  }): Promise<CashSessionDto> {
    const key = params.idempotencyKey || generateIdempotencyKey('OPEN-CS');
    const raw = await requestJson<any>('/api/v1/finance/cash-session/open', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
    return mapCashSession(raw);
  },

  async closeSession(params: {
    sessionId: string;
    actualClosingCash: number;
    discrepancyReason?: string;
    idempotencyKey?: string;
  }): Promise<CashSessionSummaryDto> {
    const key = params.idempotencyKey || generateIdempotencyKey('CLOSE-CS');
    return requestJson<CashSessionSummaryDto>('/api/v1/finance/cash-session/close', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async getSessionSummary(sessionId: string): Promise<CashSessionSummaryDto> {
    return requestJson<CashSessionSummaryDto>(`/api/v1/finance/cash-session/${encodeURIComponent(sessionId)}/summary`, {
      method: 'GET',
    });
  },

  // 3. Catalog & Copies
  async searchBooks(params?: {
    query?: string;
    author?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<any[] & { meta?: { total: number; page: number; limit: number } }> {
    const queryParams = new URLSearchParams();
    if (params?.query) queryParams.set('query', params.query);
    if (params?.author) queryParams.set('author', params.author);
    if (params?.category) queryParams.set('category', params.category);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    const qs = queryParams.toString();
    const res = await requestJson<any>(`/api/v1/catalog/books${qs ? `?${qs}` : ''}`, { method: 'GET' });
    const rawItems = Array.isArray(res) ? res : (res?.items || res?.data || []);
    const items = [...rawItems] as any;
    const serverMeta = res?.meta || (res && typeof res === 'object' && !Array.isArray(res) ? res.meta : undefined);
    items.meta = {
      total: serverMeta?.total ?? res?.total ?? rawItems.length,
      page: serverMeta?.page ?? res?.page ?? 1,
      limit: serverMeta?.limit ?? res?.limit ?? 20,
    };
    return items;
  },

  async listBookCopies(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<BookCopyDto[] & { meta?: { total: number; page: number; limit: number } }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    const qs = queryParams.toString();
    const res = await requestJson<any>(`/api/v1/catalog/books/copies${qs ? `?${qs}` : ''}`, { method: 'GET' });
    const rawItems = Array.isArray(res) ? res : (res?.items || res?.data || []);
    const items = rawItems.map((c: any) => ({
      id: c.id,
      barcode: c.barcode,
      copyNumber: Number(c.copyNumber || c.copy_number || 1),
      coverPrice: c.coverPrice !== undefined ? c.coverPrice : (c.cover_price !== null && c.cover_price !== undefined ? Number(c.cover_price) : null),
      location: c.location || 'KHO_THU_VIEN',
      status: c.status || 'AVAILABLE',
      title: c.title || c.titleName || c.title_name || '',
      editionId: c.editionId || c.edition_id,
      calculatedDeposit: c.calculatedDeposit !== undefined ? Number(c.calculatedDeposit) : undefined,
    })) as any;
    const serverMeta = res?.meta || (res && typeof res === 'object' && !Array.isArray(res) ? res.meta : undefined);
    items.meta = {
      total: serverMeta?.total ?? res?.total ?? rawItems.length,
      page: serverMeta?.page ?? res?.page ?? 1,
      limit: serverMeta?.limit ?? res?.limit ?? 50,
    };
    return items;
  },

  async getBookCopyByBarcode(barcode: string): Promise<BookCopyDto> {
    const raw = await requestJson<any>(`/api/v1/catalog/books/copies/${encodeURIComponent(barcode)}`, {
      method: 'GET',
    });
    return {
      id: raw.id,
      barcode: raw.barcode,
      copyNumber: raw.copyNumber || 1,
      coverPrice: raw.coverPrice !== undefined ? raw.coverPrice : (raw.cover_price ? Number(raw.cover_price) : null),
      location: raw.location,
      status: raw.status,
      title: raw.titleName || raw.title,
      editionId: raw.editionId || raw.edition_id,
      calculatedDeposit: raw.calculatedDeposit || (raw.coverPrice ? Math.max(50000, Math.ceil(Number(raw.coverPrice) / 50000) * 50000) : 50000),
    };
  },

  // 4. Borrowers
  async searchBorrowers(query?: string): Promise<BorrowerDto[]> {
    const qs = query ? `?query=${encodeURIComponent(query)}` : '';
    return requestJson<BorrowerDto[]>(`/api/v1/borrowers${qs}`, { method: 'GET' });
  },

  async createBorrower(params: {
    fullName: string;
    phone: string;
    studentId?: string;
    school?: string;
    email?: string;
  }): Promise<BorrowerDto> {
    return requestJson<BorrowerDto>('/api/v1/borrowers', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // 5. Circulation: Loans
  async listLoans(params?: {
    borrowerId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<LoanReceiptDto[] & { meta?: { total: number; page: number; limit: number } }> {
    const queryParams = new URLSearchParams();
    if (params?.borrowerId) queryParams.set('borrowerId', params.borrowerId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    const qs = queryParams.toString();
    const res = await requestJson<any>(`/api/v1/circulation/loans${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
    const rawItems = Array.isArray(res) ? res : (res?.items || res?.data || []);
    const items = rawItems.map(mapLoanReceipt) as any;
    const serverMeta = res?.meta || (res && typeof res === 'object' && !Array.isArray(res) ? res.meta : undefined);
    items.meta = {
      total: serverMeta?.total ?? res?.total ?? rawItems.length,
      page: serverMeta?.page ?? res?.page ?? 1,
      limit: serverMeta?.limit ?? res?.limit ?? 20,
    };
    return items;
  },

  async getLoanDetail(loanId: string): Promise<LoanReceiptDto> {
    const raw = await requestJson<any>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}`, {
      method: 'GET',
    });
    return mapLoanReceipt(raw);
  },

  async getLoanSettlement(loanId: string): Promise<LoanSettlementDto | null> {
    return requestJson<LoanSettlementDto | null>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/settlement`, {
      method: 'GET',
    });
  },

  async quoteLoanAction(
    loanId: string,
    action: 'RETURN' | 'RENEW',
    targetDate?: string
  ): Promise<LoanQuoteDto> {
    const q = new URLSearchParams({ action });
    if (targetDate) q.set('targetDate', targetDate);
    const res = await requestJson<LoanQuoteDto>(
      `/api/v1/circulation/loans/${encodeURIComponent(loanId)}/quote?${q.toString()}`,
      { method: 'GET' }
    );
    return unwrapData<LoanQuoteDto>(res);
  },

  async issueLoan(params: {
    borrowerId: string;
    barcodes: string[];
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    paymentConfirmed: boolean;
    cashSessionId?: string;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<LoanReceiptDto> {
    const key = params.idempotencyKey || generateIdempotencyKey('ISSUE');
    const raw = await requestJson<any>('/api/v1/circulation/loans', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
    return mapLoanReceipt(raw);
  },

  async settleReturn(
    loanId: string,
    params: {
      returnType: 'FULL' | 'PARTIAL';
      returnedBarcodes?: string[];
      refundMethod?: 'CASH' | 'BANK_TRANSFER';
      paymentConfirmed?: boolean;
      cashSessionId?: string;
      fineAmount?: number;
      fineReason?: string;
      finePaymentMethod?: 'CASH' | 'BANK_TRANSFER';
      finePaymentConfirmed?: boolean;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('RETURN');
    return requestJson<any>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/settle-return`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async renewLoan(
    loanId: string,
    params: {
      fineAmount?: number;
      fineReason?: string;
      finePaymentMethod?: 'CASH' | 'BANK_TRANSFER';
      finePaymentConfirmed?: boolean;
      cashSessionId?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('RENEW');
    return requestJson<any>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/renew`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async getLoanRenewals(loanId: string): Promise<RenewalRecordDto[]> {
    return requestJson<RenewalRecordDto[]>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/renewals`, {
      method: 'GET',
    });
  },

  async reportBookLoss(
    loanId: string,
    params: {
      barcodes?: string[];
      copyIds?: string[];
      reason: string;
      cashSessionId?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('LOSS');
    return requestJson<any>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/lost`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async confirmNewDeposit(
    loanId: string,
    params: {
      paymentMethod: 'CASH' | 'BANK_TRANSFER';
      paymentConfirmed: boolean;
      cashSessionId?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('CONFIRM-DEP');
    return requestJson<any>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/confirm-deposit`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async collectPendingFine(
    loanId: string,
    params: {
      amount: number;
      paymentMethod: 'CASH' | 'BANK_TRANSFER';
      paymentConfirmed: boolean;
      cashSessionId?: string;
      targetId?: string;
      fineReason?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('COLLECT-FINE');
    return requestJson<any>(`/api/v1/circulation/loans/${encodeURIComponent(loanId)}/settlement/collect-fine`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async confirmRefund(
    refundIntentId: string,
    params: {
      refundMethod: 'CASH' | 'BANK_TRANSFER';
      paymentConfirmed: boolean;
      cashSessionId?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('CONFIRM-REFUND');
    return requestJson<any>(`/api/v1/finance/refunds/${encodeURIComponent(refundIntentId)}/confirm`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async listPendingRefunds(): Promise<PendingRefundDto[]> {
    const res = await requestJson<PendingRefundDto[]>('/api/v1/circulation/pending-refunds', {
      method: 'GET',
    });
    return unwrapData<PendingRefundDto[]>(res) || [];
  },

  async cancelRefund(
    refundIntentId: string,
    params?: { reason?: string; idempotencyKey?: string }
  ): Promise<any> {
    const key = params?.idempotencyKey || generateIdempotencyKey('CANCEL-REFUND');
    const res = await requestJson<any>(
      `/api/v1/finance/refunds/${encodeURIComponent(refundIntentId)}/cancel`,
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': key },
        body: JSON.stringify(params || {}),
      }
    );
    return unwrapData<any>(res);
  },

  async listPendingDeposits(): Promise<PendingDepositDto[]> {
    const res = await requestJson<PendingDepositDto[]>('/api/v1/circulation/pending-deposits', {
      method: 'GET',
    });
    return unwrapData<PendingDepositDto[]>(res) || [];
  },

  async listPendingFines(): Promise<PendingFineDto[]> {
    const res = await requestJson<PendingFineDto[]>('/api/v1/circulation/pending-fines', {
      method: 'GET',
    });
    return unwrapData<PendingFineDto[]>(res) || [];
  },

  async createDocumentCorrection(params: {
    originalEntryId: string;
    reason: string;
    paymentConfirmed?: boolean;
    expectedAmount?: number;
    cashSessionId?: string;
    idempotencyKey?: string;
  }): Promise<any> {
    const key = params.idempotencyKey || generateIdempotencyKey('CORRECTION');
    return requestJson<any>('/api/v1/finance/ledger/corrections', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  // 6. Calendar & Holidays
  async getCalendarHolidays(): Promise<CalendarHolidayDto[]> {
    return requestJson<CalendarHolidayDto[]>('/api/v1/circulation/calendar/holidays', {
      method: 'GET',
    });
  },

  async addCalendarHoliday(params: {
    holidayDate: string;
    name: string;
    description?: string;
  }): Promise<CalendarHolidayDto> {
    return requestJson<CalendarHolidayDto>('/api/v1/circulation/calendar/holidays', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // 7. Alumni Activities
  async getAlumniActivities(): Promise<AlumniActivityDto[]> {
    return requestJson<AlumniActivityDto[]>('/api/v1/alumni/activities', {
      method: 'GET',
    });
  },

  // 8. Members, Affiliations & Dues (Chặng 13)
  async getMembers(): Promise<MemberDto[]> {
    return requestJson<MemberDto[]>('/api/v1/members', {
      method: 'GET',
    });
  },

  async getMembersHeadcount(): Promise<MemberHeadcountSummaryDto> {
    return requestJson<MemberHeadcountSummaryDto>('/api/v1/members/headcount', {
      method: 'GET',
    });
  },

  async getMemberAffiliations(memberId: string): Promise<MemberAffiliationDto[]> {
    return requestJson<MemberAffiliationDto[]>(`/api/v1/members/${encodeURIComponent(memberId)}/affiliations`, {
      method: 'GET',
    });
  },

  async addMemberAffiliation(memberId: string, params: {
    department: 'BAN_HAU_CAN' | 'BAN_NOI_DUNG' | 'BAN_TTDN' | 'BAN_CHU_NHIEM';
    role: 'TRUONG_BAN' | 'PHO_BAN' | 'THANH_VIEN' | 'CHU_NHIEM' | 'PHO_CHU_NHIEM' | 'UY_VIEN_BCN';
    termYear?: string;
    startDate?: string;
    notes?: string;
    endPreviousForDept?: boolean;
  }): Promise<MemberAffiliationDto> {
    return requestJson<MemberAffiliationDto>(`/api/v1/members/${encodeURIComponent(memberId)}/affiliations`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getMemberDues(memberId: string): Promise<MembershipDuesReceiptDto | null> {
    return requestJson<MembershipDuesReceiptDto | null>(`/api/v1/members/${encodeURIComponent(memberId)}/dues`, {
      method: 'GET',
    });
  },

  async collectMemberDues(memberId: string, params: {
    amount?: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    paymentConfirmed: boolean;
    cashSessionId?: string;
    termLabel?: string;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<MembershipDuesReceiptDto> {
    const key = params.idempotencyKey || generateIdempotencyKey('COLLECT-DUES');
    return requestJson<MembershipDuesReceiptDto>(`/api/v1/members/${encodeURIComponent(memberId)}/dues/collect`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify(params),
    });
  },

  async previewAvailability(params: {
    fileBase64: string;
    fileName?: string;
    termSemester?: string;
    effectiveStartDate?: string;
    effectiveEndDate?: string;
  }): Promise<AvailabilityPreviewResultDto> {
    return requestJson<AvailabilityPreviewResultDto>('/api/v1/duty/availability/preview', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async commitAvailability(params: {
    batchName?: string;
    fileName: string;
    fileHash: string;
    fileSizeBytes: number;
    termSemester: string;
    effectiveStartDate: string;
    effectiveEndDate: string;
    validRows: Array<{
      memberId: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      busyType: string;
      notes?: string;
    }>;
    idempotencyKey?: string;
  }): Promise<{ data: AvailabilityBatchDto; intervalsCount: number; message: string }> {
    const key = params.idempotencyKey || generateIdempotencyKey('COMMIT-AVAIL');
    return requestJson<{ data: AvailabilityBatchDto; intervalsCount: number; message: string }>(
      '/api/v1/duty/availability/commit',
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': key },
        body: JSON.stringify(params),
      }
    );
  },

  async getAvailabilityBatches(termSemester?: string): Promise<AvailabilityBatchDto[]> {
    const query = termSemester ? `?termSemester=${encodeURIComponent(termSemester)}` : '';
    return requestJson<AvailabilityBatchDto[]>(`/api/v1/duty/availability/batches${query}`, {
      method: 'GET',
    });
  },

  async getMemberBusyIntervals(memberId: string): Promise<MemberBusyIntervalDto[]> {
    return requestJson<MemberBusyIntervalDto[]>(`/api/v1/duty/availability/members/${encodeURIComponent(memberId)}`, {
      method: 'GET',
    });
  },

  async generateDraftSchedules(params: {
    termSemester: string;
    startDate: string;
    endDate: string;
    forceOverwriteManual?: boolean;
  }): Promise<{ createdCount: number; preservedCount: number; schedules: DutyScheduleDto[] }> {
    return requestJson<{ createdCount: number; preservedCount: number; schedules: DutyScheduleDto[] }>(
      '/api/v1/duty/schedules/generate',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  },

  async getDutySchedules(termSemester?: string, status?: string): Promise<DutyScheduleDto[]> {
    const params = new URLSearchParams();
    if (termSemester) params.set('termSemester', termSemester);
    if (status) params.set('status', status);
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/duty/schedules${q}`, {
      method: 'GET',
    });
    return unwrapData<DutyScheduleDto[]>(res) || [];
  },

  async getDutyScheduleById(scheduleId: string): Promise<DutyScheduleDto> {
    const res = await requestJson<any>(`/api/v1/duty/schedules/${encodeURIComponent(scheduleId)}`, {
      method: 'GET',
    });
    return unwrapData<DutyScheduleDto>(res);
  },

  async manualEditDutySchedule(
    scheduleId: string,
    params: {
      assignees: Array<{
        memberId: string;
        dutyType: 'MAIN' | 'SUPPORT';
        assignedRole: 'BOOK_INTRO' | 'CIRCULATION_LOG' | 'CASH_DRAWER' | 'LOGISTICS_SETUP';
        notes?: string;
      }>;
      shiftTime?: string;
      location?: string;
      notes?: string;
    }
  ): Promise<DutyScheduleDto> {
    const res = await requestJson<any>(
      `/api/v1/duty/schedules/${encodeURIComponent(scheduleId)}/manual-edit`,
      {
        method: 'PUT',
        body: JSON.stringify(params),
      }
    );
    return unwrapData<DutyScheduleDto>(res);
  },

  async publishDutySchedule(scheduleId: string): Promise<DutyScheduleDto> {
    const res = await requestJson<any>(
      `/api/v1/duty/schedules/${encodeURIComponent(scheduleId)}/publish`,
      {
        method: 'POST',
      }
    );
    return unwrapData<DutyScheduleDto>(res);
  },

  async updateDutyAttendance(
    scheduleId: string,
    params: {
      memberId: string;
      attendanceStatus: 'SCHEDULED' | 'PRESENT' | 'ABSENT' | 'SUBSTITUTED';
      notes?: string;
    }
  ): Promise<DutyAssigneeDto> {
    const res = await requestJson<any>(
      `/api/v1/duty/schedules/${encodeURIComponent(scheduleId)}/attendance`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return unwrapData<DutyAssigneeDto>(res);
  },

  // 10. Recruitment Form Ingest & Reconcile (Chặng 16)
  async sendRecruitmentWebhook(payload: Record<string, any>, headers?: Record<string, string>): Promise<any> {
    const rawBody = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      ...headers,
    };
    return requestJson<any>('/api/v1/recruitment/webhook/google-form', {
      method: 'POST',
      headers: defaultHeaders,
      body: rawBody,
    });
  },

  async listRecruitmentResponses(params?: {
    formId?: string;
    aspiration?: string;
    search?: string;
  }): Promise<RecruitmentResponseDetailDto[]> {
    const query = new URLSearchParams();
    if (params?.formId) query.set('formId', params.formId);
    if (params?.aspiration) query.set('aspiration', params.aspiration);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    const res = await requestJson<any>(
      `/api/v1/recruitment/responses${qs ? `?${qs}` : ''}`,
      { method: 'GET' }
    );
    return unwrapData<RecruitmentResponseDetailDto[]>(res) || [];
  },

  async reconcileRecruitmentResponses(params: {
    formId: string;
    observedPayloads: any[];
  }): Promise<ReconciliationResultDto> {
    const res = await requestJson<any>(
      '/api/v1/recruitment/reconcile',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return unwrapData<ReconciliationResultDto>(res);
  },

  async getPublicRecruitmentSummary(formId?: string): Promise<{
    totalApplicants: number;
    byAspiration1: Record<string, number>;
    byAspiration2: Record<string, number>;
    publicList: RecruitmentResponsePublicDto[];
  }> {
    const qs = formId ? `?formId=${encodeURIComponent(formId)}` : '';
    const res = await requestJson<any>(`/api/v1/recruitment/responses/public-summary${qs}`, {
      method: 'GET',
    });
    return unwrapData(res);
  },

  // 11. Recruitment Evaluation & Decisions (Chặng 17)
  async createRubric(params: {
    id?: string;
    campaignId: string;
    title: string;
    formulaType?: 'UNSPECIFIED' | 'WEIGHTED_SUM' | 'AVERAGE_CRITERIA';
    criteria: Array<{
      code: string;
      name: string;
      description?: string;
      section?: 'INTERVIEW' | 'ESSAY' | 'COMMITTEE';
      minScore?: number;
      maxScore?: number;
      weight?: number;
      sortOrder?: number;
    }>;
  }): Promise<RecruitmentRubricDto> {
    const res = await requestJson<any>('/api/v1/recruitment/rubrics', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<RecruitmentRubricDto>(res);
  },

  async getRubric(id: string): Promise<RecruitmentRubricDto> {
    const res = await requestJson<any>(`/api/v1/recruitment/rubrics/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    return unwrapData<RecruitmentRubricDto>(res);
  },

  async submitEvaluation(params: {
    id?: string;
    responseId: string;
    rubricId: string;
    evaluationType?: 'INDIVIDUAL' | 'COMMITTEE';
    rawScores: Record<string, number>;
    interviewNotes?: string;
    status?: 'DRAFT' | 'COMPLETED';
    decision?: 'PASSED' | 'FAILED' | 'RESERVE' | 'PENDING';
  }): Promise<RecruitmentEvaluationDto> {
    const res = await requestJson<any>('/api/v1/recruitment/evaluations', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<RecruitmentEvaluationDto>(res);
  },

  async editEvaluation(
    id: string,
    params: {
      rawScores?: Record<string, number>;
      interviewNotes?: string;
      decision?: 'PASSED' | 'FAILED' | 'RESERVE' | 'PENDING';
      reason: string;
      expectedVersion: number;
    }
  ): Promise<{ evaluation: RecruitmentEvaluationDto; history: RecruitmentEvaluationHistoryDto }> {
    const res = await requestJson<any>(
      `/api/v1/recruitment/evaluations/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(params),
      }
    );
    const unwrapped = unwrapData<any>(res);
    return {
      evaluation: unwrapped?.evaluation || unwrapped,
      history: unwrapped?.history || res?.history,
    };
  },

  async getResponseEvaluations(responseId: string): Promise<RecruitmentEvaluationDto[]> {
    const res = await requestJson<any>(
      `/api/v1/recruitment/responses/${encodeURIComponent(responseId)}/evaluations`,
      { method: 'GET' }
    );
    return unwrapData<RecruitmentEvaluationDto[]>(res) || [];
  },

  async getEvaluationHistory(evalId: string): Promise<RecruitmentEvaluationHistoryDto[]> {
    const res = await requestJson<any>(
      `/api/v1/recruitment/evaluations/${encodeURIComponent(evalId)}/history`,
      { method: 'GET' }
    );
    return unwrapData<RecruitmentEvaluationHistoryDto[]>(res) || [];
  },

  async finalizeDecision(params: {
    responseId: string;
    decision: 'PASSED' | 'FAILED' | 'RESERVE';
    assignedDepartment: string;
    committeeNotes?: string;
  }): Promise<RecruitmentDecisionDto> {
    const res = await requestJson<any>('/api/v1/recruitment/decisions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<RecruitmentDecisionDto>(res);
  },

  async convertApplicantToMember(
    responseId: string,
    params?: {
      phone?: string;
      gen?: string;
      schoolYear?: string;
      termYear?: string;
      username?: string;
    }
  ): Promise<{
    member: MemberDto;
    decision: RecruitmentDecisionDto;
    isAlreadyConverted: boolean;
  }> {
    const res = await requestJson<any>(`/api/v1/recruitment/decisions/${encodeURIComponent(responseId)}/convert-member`, {
      method: 'POST',
      body: params ? JSON.stringify(params) : undefined,
    });
    const unwrapped = unwrapData<any>(res);
    return {
      member: unwrapped?.member || res?.member,
      decision: unwrapped?.decision || res?.decision,
      isAlreadyConverted: Boolean(unwrapped?.isAlreadyConverted ?? res?.isAlreadyConverted),
    };
  },

  async approveAnnouncement(params: {
    campaignId: string;
    responseId: string;
    candidateCode: string;
    passedDepartment: string;
  }): Promise<PublicApprovedResultDto> {
    const res = await requestJson<any>('/api/v1/recruitment/announcements/approve', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<PublicApprovedResultDto>(res);
  },

  async getPublicApprovedResults(campaignId?: string): Promise<PublicApprovedResultDto[]> {
    const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
    const res = await requestJson<any>(
      `/api/v1/recruitment/announcements/public-results${qs}`,
      { method: 'GET' }
    );
    return unwrapData<PublicApprovedResultDto[]>(res) || [];
  },

  // 13. Bookstore Consignment & Sales (Stage 18)
  async createSupplier(params: {
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }): Promise<BookSupplierDto> {
    const res = await requestJson<any>('/api/v1/sales/suppliers', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<BookSupplierDto>(res);
  },

  async getSuppliers(): Promise<BookSupplierDto[]> {
    const res = await requestJson<any>('/api/v1/sales/suppliers', {
      method: 'GET',
    });
    return unwrapData<BookSupplierDto[]>(res) || [];
  },

  async createLot(params: {
    batchCode: string;
    supplierId: string;
    campaignName: string;
    receivedDate: string;
    targetSettlementDate?: string;
    depositAmount?: number;
    depositPaymentMethod?: 'CASH' | 'BANK_TRANSFER';
    depositPaymentConfirmed?: boolean;
    notes?: string;
    items: Array<{
      titleId?: string;
      bookTitle: string;
      isbn?: string;
      coverPrice: number;
      importDiscountPercent: number;
      importPrice?: number;
      retailPrice: number;
      initialQuantity: number;
    }>;
  }): Promise<ConsignmentLotDto> {
    const res = await requestJson<any>('/api/v1/sales/lots', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<ConsignmentLotDto>(res);
  },

  async listLots(supplierId?: string): Promise<ConsignmentLotDto[]> {
    const qs = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : '';
    const res = await requestJson<any>(`/api/v1/sales/lots${qs}`, {
      method: 'GET',
    });
    return unwrapData<ConsignmentLotDto[]>(res) || [];
  },

  async getLotDetails(lotId: string): Promise<ConsignmentLotDto> {
    const res = await requestJson<any>(`/api/v1/sales/lots/${lotId}`, {
      method: 'GET',
    });
    return unwrapData<ConsignmentLotDto>(res);
  },

  async sellBook(
    lotId: string,
    params: {
      lotItemId: string;
      cashSessionId?: string;
      customerName?: string;
      customerPhone?: string;
      quantity: number;
      saleDiscountPercent?: number;
      unitPrice?: number;
      paymentMethod: 'CASH' | 'BANK_TRANSFER';
      paymentConfirmed?: boolean;
      idempotencyKey?: string;
    }
  ): Promise<{ sale: BookSaleDto; updatedItem: ConsignmentLotItemDto }> {
    const key = params.idempotencyKey || generateIdempotencyKey('SELL');
    const bodyPayload = {
      ...params,
      paymentConfirmed: params.paymentConfirmed === true,
    };
    const res = await requestJson<any>(
      `/api/v1/sales/lots/${lotId}/sell`,
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': key },
        body: JSON.stringify(bodyPayload),
      }
    );
    const unwrapped = unwrapData<any>(res);
    return {
      sale: unwrapped?.sale || unwrapped,
      updatedItem: unwrapped?.updatedItem || res?.updatedItem,
    };
  },

  async returnBooks(
    lotId: string,
    params: {
      lotItemId: string;
      returnedQuantity: number;
      returnDate: string;
      recipientName?: string;
      proofNotes?: string;
    }
  ): Promise<{ returnReceipt: ConsignmentReturnDto; updatedItem: ConsignmentLotItemDto }> {
    const res = await requestJson<any>(
      `/api/v1/sales/lots/${lotId}/return-books`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    const unwrapped = unwrapData<any>(res);
    return {
      returnReceipt: unwrapped?.returnReceipt || unwrapped,
      updatedItem: unwrapped?.updatedItem || res?.updatedItem,
    };
  },

  async retainBooks(
    lotId: string,
    params: {
      lotItemId: string;
      retainedQuantity: number;
      notes?: string;
    }
  ): Promise<ConsignmentLotItemDto> {
    const res = await requestJson<any>(
      `/api/v1/sales/lots/${lotId}/retain-books`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return unwrapData<ConsignmentLotItemDto>(res);
  },

  async getLotSettlement(lotId: string): Promise<{
    settlement?: ConsignmentSettlementDto;
    payments?: SupplierPaymentDto[];
    preview?: any;
  }> {
    const res = await requestJson<any>(`/api/v1/sales/lots/${lotId}/settlement`, {
      method: 'GET',
    });
    const unwrapped = unwrapData<any>(res);
    return {
      settlement: unwrapped?.settlement || (unwrapped?.settlementCode ? unwrapped : undefined),
      payments: unwrapped?.payments || res?.payments,
      preview: unwrapped?.preview || res?.preview,
    };
  },

  async createLotSettlement(
    lotId: string,
    params?: {
      settlementDate?: string;
      notes?: string;
      idempotencyKey?: string;
    }
  ): Promise<ConsignmentSettlementDto> {
    const key = params?.idempotencyKey || generateIdempotencyKey('SETTLE-LOT');
    const res = await requestJson<any>(
      `/api/v1/sales/lots/${lotId}/settlements`,
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': key },
        body: JSON.stringify(params || {}),
      }
    );
    return unwrapData<ConsignmentSettlementDto>(res);
  },

  async recordSupplierPayment(
    settlementId: string,
    params: {
      paymentType: 'PAY_SUPPLIER_PAYABLE' | 'RECEIVE_DEPOSIT_REFUND';
      amount: number;
      paymentMethod: 'CASH' | 'BANK_TRANSFER';
      paymentConfirmed: boolean;
      referenceDoc?: string;
      notes?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ payment: SupplierPaymentDto; settlement: ConsignmentSettlementDto }> {
    const bodyPayload = {
      ...params,
      paymentConfirmed: params.paymentConfirmed === true,
    };
    const res = await requestJson<any>(
      `/api/v1/sales/settlements/${settlementId}/payments`,
      {
        method: 'POST',
        headers: params.idempotencyKey ? { 'X-Idempotency-Key': params.idempotencyKey } : undefined,
        body: JSON.stringify(bodyPayload),
      }
    );
    const unwrapped = unwrapData<any>(res);
    return {
      payment: unwrapped?.payment || unwrapped,
      settlement: unwrapped?.settlement || res?.settlement,
    };
  },

  // =====================================================================
  // EVENTS & ACTIVITIES (FR-06 / Chặng 19)
  // =====================================================================

  async listEvents(): Promise<ActivityDto[]> {
    const res = await requestJson<any>('/api/v1/events', {
      method: 'GET',
    });
    return unwrapData<ActivityDto[]>(res) || [];
  },

  async createEvent(params: {
    title: string;
    description?: string;
    eventType?: 'WORKSHOP' | 'BOOK_FAIR' | 'TALKSHOW' | 'INTERNAL_MEETING' | 'VOLUNTEER' | 'OTHER';
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    budget?: number;
    isApprovedForPublic?: boolean;
    isApprovedForAlumni?: boolean;
  }): Promise<ActivityDto> {
    const res = await requestJson<any>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityDto>(res);
  },

  async getEventDetail(id: string): Promise<ActivityDetailDto> {
    const res = await requestJson<any>(`/api/v1/events/${id}`, {
      method: 'GET',
    });
    return unwrapData<ActivityDetailDto>(res);
  },

  async updateEvent(
    id: string,
    params: {
      title?: string;
      description?: string;
      eventType?: 'WORKSHOP' | 'BOOK_FAIR' | 'TALKSHOW' | 'INTERNAL_MEETING' | 'VOLUNTEER' | 'OTHER';
      eventDate?: string;
      startTime?: string | null;
      endTime?: string | null;
      location?: string | null;
      budget?: number;
      status?: 'PLANNING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      isApprovedForPublic?: boolean;
      isApprovedForAlumni?: boolean;
    }
  ): Promise<ActivityDto> {
    const res = await requestJson<any>(`/api/v1/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityDto>(res);
  },

  async createEventTask(
    eventId: string,
    params: {
      title: string;
      description?: string;
      assigneeMemberId?: string | null;
      dueDate?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    }
  ): Promise<ActivityTaskDto> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityTaskDto>(res);
  },

  async updateEventTask(
    eventId: string,
    taskId: string,
    params: {
      title?: string;
      description?: string;
      assigneeMemberId?: string | null;
      dueDate?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
      reason: string;
    }
  ): Promise<ActivityTaskDto> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityTaskDto>(res);
  },

  async getEventTaskHistory(eventId: string, taskId: string): Promise<ActivityTaskHistoryDto[]> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/tasks/${taskId}/history`, {
      method: 'GET',
    });
    return unwrapData<ActivityTaskHistoryDto[]>(res) || [];
  },

  async addEventParticipant(
    eventId: string,
    params: {
      participantType: 'MEMBER' | 'GUEST';
      memberId?: string;
      guestName?: string;
      guestEmail?: string;
      guestPhone?: string;
      role?: 'ATTENDEE' | 'SPEAKER' | 'ORGANIZER' | 'VOLUNTEER';
    }
  ): Promise<ActivityParticipantDto> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/participants`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityParticipantDto>(res);
  },

  async updateEventParticipant(
    eventId: string,
    participantId: string,
    params: {
      role?: 'ATTENDEE' | 'SPEAKER' | 'ORGANIZER' | 'VOLUNTEER';
      status?: 'REGISTERED' | 'ATTENDED' | 'CANCELLED';
      checkInTime?: string | null;
    }
  ): Promise<ActivityParticipantDto> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/participants/${participantId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityParticipantDto>(res);
  },

  async createEventBudgetItem(
    eventId: string,
    params: {
      category: 'VENUE' | 'LOGISTICS' | 'PRINTING' | 'REFRESHMENTS' | 'GIFTS' | 'SPEAKER_HONORARIUM' | 'OTHER';
      description: string;
      estimatedAmount: number;
    }
  ): Promise<ActivityBudgetItemDto> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/budget-items`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityBudgetItemDto>(res);
  },

  async recordEventExpense(
    eventId: string,
    params: {
      budgetItemId?: string;
      description: string;
      actualAmount: number;
      expenseDate: string;
      payerMemberId: string;
      paymentMethod: 'CASH' | 'BANK';
      receiptRef?: string;
    }
  ): Promise<ActivityExpenseDto> {
    const res = await requestJson<any>(`/api/v1/events/${eventId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<ActivityExpenseDto>(res);
  },

  async listPublicActivities(): Promise<SafePublicActivityDto[]> {
    const res = await requestJson<any>('/api/v1/public/activities', {
      method: 'GET',
    });
    return unwrapData<SafePublicActivityDto[]>(res) || [];
  },

  async listAlumniActivities(): Promise<SafeAlumniActivityDto[]> {
    const res = await requestJson<any>('/api/v1/alumni/activities', {
      method: 'GET',
    });
    return unwrapData<SafeAlumniActivityDto[]>(res) || [];
  },

  // --- Content & Moderation (Stage 20 - FR-08) ---
  async getPublicReviews(bookId?: string,page=1): Promise<SafePublicReviewDto[]> {
    const url = (bookId ? `/api/v1/public/books/${encodeURIComponent(bookId)}/reviews` : '/api/v1/public/reviews')+`?page=${page}`;
    const res = await requestJson<any>(url, { method: 'GET' });
    return unwrapData<SafePublicReviewDto[]>(res) || [];
  },

  async submitBookReview(params: {
    bookId: string;
    authorName: string;
    rating: number;
    content: string;
    authorEmail?: string;
  }): Promise<{ data: BookReviewDto; message: string }> {
    const data=await requestJson<BookReviewDto>('/api/v1/content/reviews', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return {data,message:'Nhận xét đã được gửi và đang chờ quản trị viên duyệt.'};
  },

  async editBookReview(
    reviewId: string,
    params: { rating: number; content: string }
  ): Promise<BookReviewDto> {
    const res = await requestJson<any>(`/api/v1/content/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
    return unwrapData<BookReviewDto>(res);
  },

  async getReviewsForModeration(filter?: { status?: string; bookId?: string }): Promise<BookReviewDto[]> {
    const query = new URLSearchParams();
    if (filter?.status) query.set('status', filter.status);
    if (filter?.bookId) query.set('bookId', filter.bookId);
    const qs = query.toString();
    const res = await requestJson<any>(`/api/v1/moderation/reviews${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
    return unwrapData<BookReviewDto[]>(res) || [];
  },

  async moderateBookReview(
    reviewId: string,
    params: { decision: 'APPROVED' | 'REJECTED'; moderationNote?: string }
  ): Promise<BookReviewDto> {
    const res = await requestJson<any>(`/api/v1/moderation/reviews/${encodeURIComponent(reviewId)}/decision`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<BookReviewDto>(res);
  },

  async getPublicPosts(category?: string): Promise<SafePublicPostDto[]> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await requestJson<any>(`/api/v1/public/posts${qs}`, {
      method: 'GET',
    });
    return unwrapData<SafePublicPostDto[]>(res) || [];
  },

  async getPublicPostBySlug(slug: string): Promise<SafePublicPostDto> {
    const res = await requestJson<any>(`/api/v1/public/posts/${encodeURIComponent(slug)}`, {
      method: 'GET',
    });
    return unwrapData<SafePublicPostDto>(res);
  },

  async createPublicPost(params: {
    title: string;
    slug?: string;
    summary: string;
    content: string;
    category?: 'NEWS' | 'REVIEW' | 'EVENT_RECAP' | 'NOTICE' | 'GUIDE';
    coverImageUrl?: string;
    metaDescription?: string;
  }): Promise<PublicPostDto> {
    const res = await requestJson<any>('/api/v1/moderation/posts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return unwrapData<PublicPostDto>(res);
  },

  async publishPublicPost(postId: string): Promise<PublicPostDto> {
    const res = await requestJson<any>(`/api/v1/moderation/posts/${encodeURIComponent(postId)}/publish`, {
      method: 'POST',
    });
    return unwrapData<PublicPostDto>(res);
  },

  // 12. Reports & Audits
  async getFinancialSummary(filter?: { period?: string; startDate?: string; endDate?: string; fundId?: string }): Promise<FinancialSummaryReportDto> {
    const params = new URLSearchParams();
    if (filter?.period) params.set('period', filter.period);
    if (filter?.startDate) params.set('startDate', filter.startDate);
    if (filter?.endDate) params.set('endDate', filter.endDate);
    if (filter?.fundId) params.set('fundId', filter.fundId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/reports/financial/summary${qs}`, {
      method: 'GET',
    });
    return unwrapData<FinancialSummaryReportDto>(res);
  },

  async getFinancialDrilldown(filter?: { period?: string; startDate?: string; endDate?: string; fundId?: string; limit?: number; offset?: number }): Promise<FinancialDrilldownResultDto> {
    const params = new URLSearchParams();
    if (filter?.period) params.set('period', filter.period);
    if (filter?.startDate) params.set('startDate', filter.startDate);
    if (filter?.endDate) params.set('endDate', filter.endDate);
    if (filter?.fundId) params.set('fundId', filter.fundId);
    if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
    if (filter?.offset !== undefined) params.set('offset', String(filter.offset));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/reports/financial/drilldown${qs}`, {
      method: 'GET',
    });
    return unwrapData<FinancialDrilldownResultDto>(res);
  },

  async getCirculationSummary(filter?: { startDate?: string; endDate?: string }): Promise<CirculationSummaryReportDto> {
    const params = new URLSearchParams();
    if (filter?.startDate) params.set('startDate', filter.startDate);
    if (filter?.endDate) params.set('endDate', filter.endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/reports/circulation/summary${qs}`, {
      method: 'GET',
    });
    return unwrapData<CirculationSummaryReportDto>(res);
  },

  async createExportTicket(
    reportType: 'FINANCIAL_SUMMARY' | 'FINANCIAL_DRILLDOWN' | 'CIRCULATION',
    params?: Record<string, any>,
    format: 'CSV' | 'XML_EXCEL' | 'HTML' | 'XLSX' | 'PDF' = 'CSV'
  ): Promise<ExportTicketDto> {
    const res = await requestJson<any>('/api/v1/reports/export/ticket', {
      method: 'POST',
      body: JSON.stringify({ reportType, params, format }),
    });
    return unwrapData<ExportTicketDto>(res);
  },

  getExportDownloadUrl(ticket: string): string {
    return `/api/v1/reports/download/${encodeURIComponent(ticket)}`;
  },

  async getSystemAuditLogs(filter?: { actorId?: string; action?: string; targetResource?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<AuditLogResultDto> {
    const params = new URLSearchParams();
    if (filter?.actorId) params.set('actorId', filter.actorId);
    if (filter?.action) params.set('action', filter.action);
    if (filter?.targetResource) params.set('targetResource', filter.targetResource);
    if (filter?.startDate) params.set('startDate', filter.startDate);
    if (filter?.endDate) params.set('endDate', filter.endDate);
    if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
    if (filter?.offset !== undefined) params.set('offset', String(filter.offset));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/audit/logs${qs}`, {
      method: 'GET',
    });
    return unwrapData<AuditLogResultDto>(res);
  },

  async getAnalyticsSummary(): Promise<AnalyticsSummaryDto> {
    const res = await requestJson<any>('/api/v1/audit/analytics', {
      method: 'GET',
    });
    return unwrapData<AnalyticsSummaryDto>(res);
  },

  // 14. Public & Staff Book Reservations
  async getReaderAuthStatus():Promise<{googleEnabled:boolean}> {
    return unwrapData(await requestJson('/api/v1/readers/auth/status',{cache:'no-store'}));
  },
  async getReaderProfile():Promise<ReaderProfile> {
    return unwrapData(await requestJson('/api/v1/readers/me',{cache:'no-store'}));
  },
  async updateReaderProfile(input:{fullName:string;phone:string}):Promise<ReaderProfile> {
    return unwrapData(await requestJson('/api/v1/readers/me',{method:'PATCH',body:JSON.stringify(input)}));
  },
  async logoutReader():Promise<void> {
    await requestJson('/api/v1/readers/logout',{method:'POST'});
  },
  async listReaderReservations():Promise<import('../server/reservations/types').PublicReservationDto[]> {
    return unwrapData(await requestJson('/api/v1/readers/reservations',{cache:'no-store'}));
  },
  async listReaderBookmarks():Promise<{titleId:string;createdAt:string}[]> {
    return requestJson('/api/v1/readers/bookmarks',{cache:'no-store'});
  },
  async setReaderBookmark(titleId:string,bookmarked:boolean):Promise<{titleId:string;bookmarked:boolean}> {
    return requestJson('/api/v1/readers/bookmarks/'+encodeURIComponent(titleId),{method:bookmarked?'PUT':'DELETE'});
  },
  async cancelReaderReservation(id:string):Promise<import('../server/reservations/types').PublicReservationDto> {
    return unwrapData(await requestJson('/api/v1/readers/reservations/'+encodeURIComponent(id)+'/cancel',{method:'POST'}));
  },
  async getPublishingOverview(): Promise<any> {
    return unwrapData(await requestJson('/api/v1/admin/publishing',{method:'GET'}));
  },
  async changeMembership(id:string,input:Record<string,unknown>):Promise<MemberDto> {
    return unwrapData(await requestJson('/api/v1/members/'+encodeURIComponent(id)+'/membership',{method:'POST',body:JSON.stringify(input)}));
  },
  async savePublishing(section: 'books'|'schedules'|'recruitment', input: Record<string,unknown>): Promise<any> {
    return unwrapData(await requestJson('/api/v1/admin/publishing/'+section,{method:'POST',body:JSON.stringify(input)}));
  },
  async getPublicRecruitmentNotice(): Promise<any> {
    return unwrapData(await requestJson('/api/v1/public/recruitment-notice',{method:'GET',cache:'no-store'}));
  },
  async getPublicBook(id: string): Promise<any> {
    return unwrapData(await requestJson('/api/v1/books/'+encodeURIComponent(id),{method:'GET'}));
  },
  async listPublicReservationBooks(params?: { search?: string; category?: string; page?: number; limit?: number; includeUnavailable?: boolean; onlyAvailable?: boolean }): Promise<{ items: any[]; total: number; page: number; limit: number; categories?: string[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.includeUnavailable) query.set('includeUnavailable', 'true');
    if (params?.onlyAvailable) query.set('onlyAvailable', 'true');
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/public/reservation-books${qs}`, { method: 'GET', cache: 'no-store' });
    return {
      items: unwrapData<any[]>(res) || [],
      total: res?.meta?.total ?? (Array.isArray(res?.data) ? res.data.length : 0),
      page: res?.meta?.page ?? 1,
      limit: res?.meta?.limit ?? 20,
      categories: res?.meta?.categories,
    };
  },

  async listPublicPickupSchedules(): Promise<any[]> {
    const res = await requestJson<any>('/api/v1/public/pickup-schedules', { method: 'GET', cache: 'no-store' });
    return unwrapData<any[]>(res) || [];
  },

  async createPublicReservation(
    input: { titleId: string; scheduleId: string; fullName: string; phone: string; studentId?: string; university?: string; email?: string; captchaToken: string },
    idempotencyKey?: string
  ): Promise<{ reservation: any; lookupToken: string; isReplay?: boolean }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const res = await requestJson<any>('/api/v1/public/reservations', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return res;
  },

  async getPublicReservation(token: string): Promise<any> {
    const res = await requestJson<any>('/api/v1/public/reservation', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return unwrapData<any>(res);
  },

  async cancelPublicReservation(token: string, reason?: string): Promise<any> {
    const res = await requestJson<any>('/api/v1/public/reservation/cancel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    return unwrapData<any>(res);
  },

  async listStaffReservations(params?: { scheduleId?: string; status?: string; search?: string; page?: number; limit?: number }): Promise<{ items: any[]; total: number; page: number; limit: number; attentionCount: number }> {
    const query = new URLSearchParams();
    if (params?.scheduleId) query.set('scheduleId', params.scheduleId);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await requestJson<any>(`/api/v1/reservations${qs}`, { method: 'GET' });
    return {
      items: unwrapData<any[]>(res) || [],
      total: res?.meta?.total ?? (Array.isArray(res?.data) ? res.data.length : 0),
      page: res?.meta?.page ?? 1,
      limit: res?.meta?.limit ?? 50,
      attentionCount: res?.meta?.attentionCount ?? 0,
    };
  },

  async fulfillStaffReservation(reservationId: string, input: { borrowerId?: string; paymentMethod: 'CASH' | 'BANK_TRANSFER'; depositPaymentConfirmed: boolean; notes?: string }, idempotencyKey?: string): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await requestJson<any>(`/api/v1/reservations/${reservationId}/fulfill`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return res;
  },

  async cancelStaffReservation(reservationId: string, reason?: string): Promise<any> {
    const res = await requestJson<any>(`/api/v1/reservations/${reservationId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return unwrapData<any>(res);
  },

  async reportStaffReservationIssue(reservationId: string, reason: string): Promise<void> {
    await requestJson(`/api/v1/reservations/${reservationId}/issue`, { method: 'POST', body: JSON.stringify({ reason }) });
  },
};

export interface SafePublicReviewDto {
  isClubReview: boolean;
  id: string;
  bookId: string;
  readerName: string;
  rating: number;
  content: string;
  version: number;
  approvedAt: string | null;
  createdAt: string;
}

export interface BookReviewDto {
  id: string;
  bookId: string;
  authorId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  rating: number;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  moderationNote?: string | null;
  version: number;
  pendingContent?: string | null;
  pendingRating?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafePublicPostDto {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: 'NEWS' | 'REVIEW' | 'EVENT_RECAP' | 'NOTICE' | 'GUIDE';
  coverImageUrl?: string | null;
  authorDisplayName: string;
  publishedAt: string | null;
  metaDescription?: string | null;
  createdAt: string;
}

export interface PublicPostDto extends SafePublicPostDto {
  authorId: string;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
  viewCount: number;
  updatedAt: string;
}

export interface FinancialSummaryReportDto {
  filter: {
    period: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL' | 'CUSTOM';
    startDate: string;
    endDate: string;
    fundId?: string;
  };
  cashDrawerBalance: number;
  bankMainBalance: number;
  depositLiability: number;
  bookstoreReceivable: number;
  bookstorePayable: number;
  fineRevenue: number;
  membershipFeeRevenue: number;
  bookSalesRevenue: number;
  activityExpense: number;
  totalRevenue: number;
  netIncome: number;
  totalTransactions: number;
  generatedAt: string;
  generatedBy: string;
}

export interface FinancialDrilldownItemDto {
  id: string;
  entryCode: string;
  fundId: string;
  sourceType: string;
  sourceId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  createdBy: string;
  createdAt: string;
  notes: string | null;
}

export interface FinancialDrilldownResultDto {
  items: FinancialDrilldownItemDto[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface CirculationSummaryReportDto {
  filter: {
    startDate: string;
    endDate: string;
  };
  totalLoansIssued: number;
  totalLoansReturned: number;
  totalLoansRenewed: number;
  totalBooksLost: number;
  totalActiveLoans: number;
  totalOverdueLoans: number;
  generatedAt: string;
  generatedBy: string;
}

export interface ExportTicketDto {
  ticket: string;
  actorId: string;
  actorRole: string;
  tokenVersion: number;
  reportType: 'FINANCIAL_SUMMARY' | 'FINANCIAL_DRILLDOWN' | 'CIRCULATION';
  format: 'CSV' | 'JSON';
  params: Record<string, any>;
  createdAt: number;
  expiresAt: number;
}

export interface AuditLogItemDto {
  id: string;
  actorId: string | null;
  action: string;
  targetResource: string;
  targetId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogResultDto {
  items: AuditLogItemDto[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface AnalyticsSummaryDto {
  totalBooksCataloged: number;
  totalCopiesInCirculation: number;
  totalActiveMembers: number;
  totalReviewsPublished: number;
  totalPublicPosts: number;
  generatedAt: string;
}

