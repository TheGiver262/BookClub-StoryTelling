import React, { useState, useEffect, useCallback, useRef } from 'react';
import { startAvailabilityRefresh } from '../lib/availability-refresh';
import PublishingManager from './PublishingManager';
import MembershipManager from './MembershipManager';
import ClubReviewComposer from './ClubReviewComposer';
import { 
  LayoutDashboard, BookOpen, Users, Calendar, 
  Wallet, Award, BarChart3, Settings, ShieldAlert,
  ChevronLeft, ChevronRight, Plus, RotateCcw, AlertTriangle,
  CheckCircle2, CheckCircle, Clock, Phone, FileSpreadsheet, FileText, Download,
  Lock, RefreshCw, X, AlertCircle, Copy, LogOut, Receipt, UserPlus, Star,
  ShoppingBag, Store, PackageCheck, MessageSquare
} from 'lucide-react';
import { 
  INITIAL_BOOKS, INITIAL_BORROWERS, INITIAL_LOANS, INITIAL_CASH_SESSION,
  INITIAL_MEMBERS, INITIAL_DUTY_SHIFTS, calculateDeposit, formatVND,
  type LoanReceipt
} from '../data/mockData';
import { 
  apiClient, actionKeyRegistry, type AuthenticatedActor, type CashSessionDto,
  type CashSessionSummaryDto,
  type LoanReceiptDto, type BorrowerDto,
  type BookCopyDto, type AlumniActivityDto,
  type MemberDto, type MemberAffiliationDto,
  type MemberHeadcountSummaryDto,
  type AvailabilityPreviewResultDto,
  type DutyScheduleDto,
  type RecruitmentResponseDetailDto,
  type RecruitmentRubricDto,
  type RecruitmentEvaluationDto,
  type RecruitmentEvaluationHistoryDto,
  type RecruitmentDecisionDto,
  type BookSupplierDto,
  type ConsignmentLotDto,
  type ConsignmentLotItemDto,
  type ConsignmentSettlementDto,
  type SupplierPaymentDto,
  type ActivityDto,
  type ActivityTaskDto,
  type ActivityTaskHistoryDto,
  type ActivityDetailDto,
  type BookReviewDto,
  type PublicPostDto,
  type FinancialSummaryReportDto,
  type FinancialDrilldownItemDto,
  type AuditLogItemDto,
  type AnalyticsSummaryDto,
  type LoanQuoteDto,
  type PendingRefundDto,
  type PendingDepositDto,
  type PendingFineDto,
  type CirculationSummaryReportDto
} from '../lib/api-client';

type Role = 'ADMIN' | 'ACTIVE_MEMBER' | 'ALUMNI' | 'GUEST';
type WorkspaceMode = 'LIVE' | 'DEMO';

export default function InternalWorkspace() {
  const demoAllowed=import.meta.env.PUBLIC_DEMO_CONTENT==='true';
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (demoAllowed && p.get('mode') === 'demo') return 'DEMO';
    }
    return 'LIVE';
  });
  const [currentRole, setCurrentRole] = useState<Role>('ACTIVE_MEMBER');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarRef=useRef<HTMLElement>(null),sidebarTriggerRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(window.matchMedia('(max-width: 767px)').matches) setIsSidebarCollapsed(true);},[]);
  useEffect(()=>{
    if(isSidebarCollapsed||!window.matchMedia('(max-width: 767px)').matches||!sidebarRef.current) return;
    sidebarRef.current.querySelector('button')?.focus();
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape') setIsSidebarCollapsed(true);};
    window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('keydown',escape);sidebarTriggerRef.current?.focus();};
  },[isSidebarCollapsed]);

  // RF-06: Request versioning to abort/drop stale in-flight requests on mode/actor change
  const activeRequestVersionRef = useRef<number>(0);

  // Auth & Actor state (Live API)
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active module
  const [activeModule, setActiveModule] = useState<
    'dashboard' | 'quay-sach' | 'ban-sach' | 'kho-sach' | 'thanh-vien' | 
    'truc-sach' | 'tuyen' | 'tai-chinh' | 'su-kien' | 
    'kiem-duyet' | 'bao-cao' | 'admin' | 'cuu'
  >('quay-sach');

  // Live Data State
  const [liveLoans, setLiveLoans] = useState<LoanReceiptDto[]>([]);
  const [liveSession, setLiveSession] = useState<CashSessionDto | null>(null);
  const [liveBorrowers, setLiveBorrowers] = useState<BorrowerDto[]>([]);
  const [liveCopies, setLiveCopies] = useState<BookCopyDto[]>([]);
  const [liveActivities, setLiveActivities] = useState<AlumniActivityDto[]>([]);

  // Demo Fallback State (Explicit Fixture Mode)
  const [demoLoans, setDemoLoans] = useState<LoanReceipt[]>(INITIAL_LOANS);
  const demoBooks = INITIAL_BOOKS;
  const demoCashSession = INITIAL_CASH_SESSION;

  // Modals
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState<{ isOpen: boolean; type: 'EXCEL' | 'PDF'; title: string }>({
    isOpen: false,
    type: 'EXCEL',
    title: '',
  });
  const [showFbPostModal, setShowFbPostModal] = useState(false);
  const [fbPostCopied, setFbPostCopied] = useState(false);

  // Selected Loan for Return
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<LoanReceiptDto | null>(null);
  const [returnType, setReturnType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [returnedBarcodes, setReturnedBarcodes] = useState<string[]>([]);
  const [waiveFineReason, setWaiveFineReason] = useState('');
  const [customFineAmount, setCustomFineAmount] = useState<number | null>(null);
  const [refundMethod, setRefundMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [returnPaymentConfirmed, setReturnPaymentConfirmed] = useState<boolean>(false);
  const [returnFinePaymentMethod, setReturnFinePaymentMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [returnFinePaymentConfirmed, setReturnFinePaymentConfirmed] = useState<boolean>(false);

  // Selected Loan for Renewal
  const [selectedLoanForRenew, setSelectedLoanForRenew] = useState<LoanReceiptDto | null>(null);
  const [renewFineAmount, setRenewFineAmount] = useState<number>(0);
  const [renewFineReason, setRenewFineReason] = useState<string>('');
  const [renewFinePaymentMethod, setRenewFinePaymentMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [renewPaymentConfirmed, setRenewPaymentConfirmed] = useState<boolean>(false);

  // Selected Loan for Loss Report
  const [selectedLoanForLoss, setSelectedLoanForLoss] = useState<LoanReceiptDto | null>(null);
  const [lossSelectedBarcode, setLossSelectedBarcode] = useState<string>('');
  const [lossReason, setLossReason] = useState<string>('');

  // Cash Session Form & Summary State
  const [openingCashInput, setOpeningCashInput] = useState<number>(500000);
  const [openDiscrepancyReason, setOpenDiscrepancyReason] = useState<string>('');
  const [actualClosingCashInput, setActualClosingCashInput] = useState<number>(500000);
  const [closeDiscrepancyReason, setCloseDiscrepancyReason] = useState<string>('');
  const [showSessionSummaryModal, setShowSessionSummaryModal] = useState<boolean>(false);
  const [sessionSummaryData, setSessionSummaryData] = useState<CashSessionSummaryDto | null>(null);

  // T73 New Deposit Modal
  const [showConfirmDepositModal, setShowConfirmDepositModal] = useState<{ isOpen: boolean; loan: LoanReceiptDto | null }>({
    isOpen: false,
    loan: null,
  });
  const [depositMethodT73, setDepositMethodT73] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [depositConfirmedT73, setDepositConfirmedT73] = useState<boolean>(false);

  // Pending Fine Modal
  const [showPendingFineModal, setShowPendingFineModal] = useState<{
    isOpen: boolean;
    loan: LoanReceiptDto | null;
    amount: number;
    targetId?: string;
  }>({
    isOpen: false,
    loan: null,
    amount: 0,
  });
  const [pendingFineMethod, setPendingFineMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [pendingFineConfirmed, setPendingFineConfirmed] = useState<boolean>(false);

  // Document Correction State
  const [correctionEntryId, setCorrectionEntryId] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionPaymentConfirmed, setCorrectionPaymentConfirmed] = useState<boolean>(false);

  // New Loan Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>('');
  const [selectedBarcode1, setSelectedBarcode1] = useState<string>('');
  const [selectedBarcode2, setSelectedBarcode2] = useState<string>('');
  const [barcodeSearchInput, setBarcodeSearchInput] = useState<string>('');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState<boolean>(false);

  // Stable Action Idempotency Keys across retries & entities (S12-04, RF-04)
  const getActionKey = (
    operation: string,
    entityId: string,
    payload: unknown
  ): string => {
    return actionKeyRegistry.getOrCreateKey(
      operation,
      entityId,
      payload,
      actor?.memberId || actor?.userId || 'ANON'
    );
  };

  // Desk SubTab & Pending Queues (S12-03 & PR-7)
  const [deskSubTab, setDeskSubTab] = useState<'LOANS' | 'PENDING_REFUNDS' | 'PENDING_DEPOSITS' | 'PENDING_FINES' | 'RESERVATIONS'>('LOANS');
  const [livePendingRefunds, setLivePendingRefunds] = useState<PendingRefundDto[]>([]);
  const [livePendingDeposits, setLivePendingDeposits] = useState<PendingDepositDto[]>([]);
  const [livePendingFines, setLivePendingFines] = useState<PendingFineDto[]>([]);
  const [pendingQueuesError, setPendingQueuesError] = useState<string | null>(null);

  // Reservations State (PR-7)
  const [staffReservations, setStaffReservations] = useState<any[]>([]);
  const [reservationAttentionCount, setReservationAttentionCount] = useState(0);
  const [reservationPage, setReservationPage] = useState(1);
  const [reservationTotal, setReservationTotal] = useState(0);
  const reservationRequestRef = useRef(0);
  const [demoReservations, setDemoReservations] = useState<any[]>([
    {
      id: 'res-demo-01',
      code: 'BK-RES-DEMO1',
      status: 'HELD',
      titleId: 'b-01',
      bookTitle: 'Đắc Nhân Tâm',
      authorName: 'Dale Carnegie',
      copyBarcode: 'CP-01-01',
      scheduleId: 'sched-sample-1',
      shiftDate: new Date().toISOString().substring(0, 10),
      shiftTime: '17:30 - 19:30',
      pickupLocation: 'Bàn trực sảnh Thư viện Tạ Quang Bửu',
      fullName: 'Hoàng Văn Thắng',
      phone: '0987654321',
      studentId: '20230001',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      estimatedDeposit: 50000,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'res-demo-02',
      code: 'BK-RES-DEMO2',
      status: 'HELD',
      titleId: 'b-02',
      bookTitle: 'Nhà Giả Kim',
      authorName: 'Paulo Coelho',
      copyBarcode: 'CP-02-01',
      scheduleId: 'sched-sample-1',
      shiftDate: new Date().toISOString().substring(0, 10),
      shiftTime: '17:30 - 19:30',
      pickupLocation: 'Bàn trực sảnh Thư viện Tạ Quang Bửu',
      fullName: 'Trần Thị Mai',
      phone: '0912345678',
      studentId: '20225566',
      expiresAt: new Date(Date.now() + 5400000).toISOString(),
      estimatedDeposit: 50000,
      createdAt: new Date(Date.now() - 900000).toISOString(),
    },
  ]);
  const [reservationFilterStatus, setReservationFilterStatus] = useState<string>('HELD');
  const [reservationSearchQuery, setReservationSearchQuery] = useState<string>('');
  const [isLoadingReservations, setIsLoadingReservations] = useState<boolean>(false);
  const [selectedReservationForFulfill, setSelectedReservationForFulfill] = useState<any | null>(null);
  const [fulfillPaymentMethod, setFulfillPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [fulfillPaymentConfirmed, setFulfillPaymentConfirmed] = useState<boolean>(false);
  const [fulfillNotes, setFulfillNotes] = useState<string>('');
  const [isFulfilling, setIsFulfilling] = useState<boolean>(false);
  const [selectedReservationForCancel, setSelectedReservationForCancel] = useState<any | null>(null);
  const [cancelStaffReason, setCancelStaffReason] = useState<string>('');
  const [isStaffCancelling, setIsStaffCancelling] = useState<boolean>(false);

  // Server Quotes (S12-03)
  const [returnQuote, setReturnQuote] = useState<LoanQuoteDto | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);
  const [renewQuote, setRenewQuote] = useState<LoanQuoteDto | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Settlement Details Modal (S12-03)
  const [showLoanSettlementModal, setShowLoanSettlementModal] = useState<boolean>(false);
  const [settlementDetailData, setSettlementDetailData] = useState<any | null>(null);

  // Confirm Refund Modal (S12-03)
  const [showConfirmRefundModal, setShowConfirmRefundModal] = useState<boolean>(false);
  const [selectedRefundForConfirm, setSelectedRefundForConfirm] = useState<PendingRefundDto | null>(null);
  const [confirmRefundMethod, setConfirmRefundMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [confirmRefundPaymentConfirmed, setConfirmRefundPaymentConfirmed] = useState<boolean>(false);


  // Members & Headcount State (Chặng 13)
  const [liveMembers, setLiveMembers] = useState<MemberDto[]>([]);
  const [memberHeadcount, setMemberHeadcount] = useState<MemberHeadcountSummaryDto | null>(null);
  const [selectedMemberForAffiliations, setSelectedMemberForAffiliations] = useState<MemberDto | null>(null);
  const [memberAffiliationsList, setMemberAffiliationsList] = useState<MemberAffiliationDto[]>([]);
  const [showAffiliationsModal, setShowAffiliationsModal] = useState<boolean>(false);
  const [selectedMemberForDues, setSelectedMemberForDues] = useState<MemberDto | null>(null);
  const [showCollectDuesModal, setShowCollectDuesModal] = useState<boolean>(false);
  const [duesPaymentMethod, setDuesPaymentMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [duesPaymentConfirmed, setDuesPaymentConfirmed] = useState<boolean>(false);
  const [duesAmountInput, setDuesAmountInput] = useState<number>(100000);
  const [duesTermLabel, setDuesTermLabel] = useState<string>('Hội phí một lần (Kỳ tuyển K69)');

  // Availability Import State (Chặng 14)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState<boolean>(false);
  const [availabilityFileName, setAvailabilityFileName] = useState<string>('');
  const [availabilityBase64, setAvailabilityBase64] = useState<string | null>(null);
  const [availabilityTermSemester, setAvailabilityTermSemester] = useState<string>('2026.1');
  const [availabilityPreviewData, setAvailabilityPreviewData] = useState<AvailabilityPreviewResultDto | null>(null);
  const [isPreviewingAvailability, setIsPreviewingAvailability] = useState<boolean>(false);
  const [isCommittingAvailability, setIsCommittingAvailability] = useState<boolean>(false);

  // Duty Roster State (Chặng 15)
  const [liveSchedules, setLiveSchedules] = useState<DutyScheduleDto[]>([]);
  const [showGenerateScheduleModal, setShowGenerateScheduleModal] = useState<boolean>(false);
  const [draftTermSemester, setDraftTermSemester] = useState<string>('2026.1');
  const [draftStartDate, setDraftStartDate] = useState<string>('2026-10-20');
  const [draftEndDate, setDraftEndDate] = useState<string>('2026-11-20');
  const [draftForceOverwrite, setDraftForceOverwrite] = useState<boolean>(false);
  const [isGeneratingSchedules, setIsGeneratingSchedules] = useState<boolean>(false);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<DutyScheduleDto | null>(null);
  const [showManualEditModal, setShowManualEditModal] = useState<boolean>(false);
  const [editAssigneesList, setEditAssigneesList] = useState<Array<{ memberId: string; dutyType: 'MAIN' | 'SUPPORT'; assignedRole: any; notes?: string }>>([]);
  const [isSavingManualEdit, setIsSavingManualEdit] = useState<boolean>(false);
  const [facebookModalContent, setFacebookModalContent] = useState<string>('');
  const [showFacebookViewModal, setShowFacebookViewModal] = useState<boolean>(false);

  // Recruitment Form & Responses State (Chặng 16)
  const [liveRecruitmentResponses, setLiveRecruitmentResponses] = useState<RecruitmentResponseDetailDto[]>([]);
  const [selectedResponseForDetail, setSelectedResponseForDetail] = useState<RecruitmentResponseDetailDto | null>(null);
  const [showResponseDetailModal, setShowResponseDetailModal] = useState<boolean>(false);
  const [showReconcileModal, setShowReconcileModal] = useState<boolean>(false);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [reconcileFormId, setReconcileFormId] = useState<string>('FORM_GEN_10_2026');
  const [reconcileJsonInput, setReconcileJsonInput] = useState<string>('[]');

  // Recruitment Evaluation & Decisions State (Chặng 17)
  const [showEvaluationModal, setShowEvaluationModal] = useState<boolean>(false);
  const [selectedResponseForEval, setSelectedResponseForEval] = useState<RecruitmentResponseDetailDto | null>(null);
  const [currentRubric, setCurrentRubric] = useState<RecruitmentRubricDto | null>(null);
  const [evalScores, setEvalScores] = useState<Record<string, number>>({});
  const [evalNotes, setEvalNotes] = useState<string>('');
  const [evalDecision, setEvalDecision] = useState<'PASSED' | 'FAILED' | 'RESERVE' | 'PENDING'>('PENDING');
  const [evalEditReason, setEvalEditReason] = useState<string>('');
  const [evalListForResponse, setEvalListForResponse] = useState<RecruitmentEvaluationDto[]>([]);
  const [isSubmittingEval, setIsSubmittingEval] = useState<boolean>(false);
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null);
  const [editingEvalExpectedVersion, setEditingEvalExpectedVersion] = useState<number>(1);
  const [showHistoryForEvalId, setShowHistoryForEvalId] = useState<string | null>(null);
  const [evalHistoryList, setEvalHistoryList] = useState<RecruitmentEvaluationHistoryDto[]>([]);

  // Decision & Member Conversion State (Chặng 17)
  const [showDecisionModal, setShowDecisionModal] = useState<boolean>(false);
  const [selectedResponseForDecision, setSelectedResponseForDecision] = useState<RecruitmentResponseDetailDto | null>(null);
  const [committeeDecisionChoice, setCommitteeDecisionChoice] = useState<'PASSED' | 'FAILED' | 'RESERVE'>('PASSED');
  const [assignedDeptChoice, setAssignedDeptChoice] = useState<string>('BAN_HAU_CAN');
  const [committeeNotesInput, setCommitteeNotesInput] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [decisionRecord, setDecisionRecord] = useState<RecruitmentDecisionDto | null>(null);
  const [isConvertingMember, setIsConvertingMember] = useState<boolean>(false);
  const [convertedMemberId, setConvertedMemberId] = useState<string | null>(null);

  // Stage 18: Bookstore Consignment & Sales State
  const [liveSuppliers, setLiveSuppliers] = useState<BookSupplierDto[]>([]);
  const [liveLots, setLiveLots] = useState<ConsignmentLotDto[]>([]);
  const [selectedLotForAction, setSelectedLotForAction] = useState<ConsignmentLotDto | null>(null);
  const [selectedLotItemForSale, setSelectedLotItemForSale] = useState<ConsignmentLotItemDto | null>(null);

  // Modals Stage 18
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState<boolean>(false);
  const [showCreateLotModal, setShowCreateLotModal] = useState<boolean>(false);
  const [showSellBookModal, setShowSellBookModal] = useState<boolean>(false);
  const [showReturnBooksModal, setShowReturnBooksModal] = useState<boolean>(false);
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);

  // Form states Stage 18
  const [newSupplierCode, setNewSupplierCode] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierContact, setNewSupplierContact] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');

  const [newLotBatchCode, setNewLotBatchCode] = useState<string>('');
  const [newLotSupplierId, setNewLotSupplierId] = useState<string>('');
  const [newLotCampaign, setNewLotCampaign] = useState<string>('');
  const [newLotDeposit, setNewLotDeposit] = useState<number>(0);
  const [newLotBookTitle, setNewLotBookTitle] = useState<string>('');
  const [newLotCoverPrice, setNewLotCoverPrice] = useState<number>(80000);
  const [newLotDiscount, setNewLotDiscount] = useState<number>(18.75);
  const [newLotRetailPrice, setNewLotRetailPrice] = useState<number>(80000);
  const [newLotQuantity, setNewLotQuantity] = useState<number>(100);

  const [saleQuantityInput, setSaleQuantityInput] = useState<number>(1);
  const [salePaymentMethod, setSalePaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [saleCustomerName, setSaleCustomerName] = useState<string>('');

  const [returnQuantityInput, setReturnQuantityInput] = useState<number>(0);
  const [returnRecipientName, setReturnRecipientName] = useState<string>('');
  const [returnProofNotes, setReturnProofNotes] = useState<string>('');

  const [activeSettlement, setActiveSettlement] = useState<ConsignmentSettlementDto | null>(null);
  const [settlementPreview, setSettlementPreview] = useState<any>(null);
  const [settlementPayments, setSettlementPayments] = useState<SupplierPaymentDto[]>([]);

  // Confirmation states Stage 18 (RF-02)
  const [salePaymentConfirmed, setSalePaymentConfirmed] = useState<boolean>(false);
  const [newLotDepositConfirmed, setNewLotDepositConfirmed] = useState<boolean>(false);
  const [newLotDepositPaymentMethod, setNewLotDepositPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');

  // Supplier Payment Modal Stage 18 (RF-02)
  const [showSupplierPaymentModal, setShowSupplierPaymentModal] = useState<boolean>(false);
  const [supplierPaymentType, setSupplierPaymentType] = useState<'PAY_SUPPLIER_PAYABLE' | 'RECEIVE_DEPOSIT_REFUND'>('PAY_SUPPLIER_PAYABLE');
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState<number>(0);
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [supplierPaymentRefDoc, setSupplierPaymentRefDoc] = useState<string>('');
  const [supplierPaymentConfirmed, setSupplierPaymentConfirmed] = useState<boolean>(false);
  const [supplierPaymentNotes, setSupplierPaymentNotes] = useState<string>('');

  // Stage 19: Events & Activities State
  const [liveEvents, setLiveEvents] = useState<ActivityDto[]>([]);
  const [selectedEventDetail, setSelectedEventDetail] = useState<ActivityDetailDto | null>(null);
  const [taskHistoryList, setTaskHistoryList] = useState<ActivityTaskHistoryDto[]>([]);

  // Modals for Stage 19
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<ActivityTaskDto | null>(null);
  const [isTaskHistoryModalOpen, setIsTaskHistoryModalOpen] = useState(false);
  const [isNewParticipantModalOpen, setIsNewParticipantModalOpen] = useState(false);
  const [isNewBudgetItemModalOpen, setIsNewBudgetItemModalOpen] = useState(false);
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);

  // Form states for Stage 19
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventType, setNewEventType] = useState<'WORKSHOP' | 'BOOK_FAIR' | 'TALKSHOW' | 'INTERNAL_MEETING' | 'VOLUNTEER' | 'OTHER'>('WORKSHOP');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventLocation, setNewEventLocation] = useState('Phòng CLB Sách YSBK');
  const [newEventBudget, setNewEventBudget] = useState(0);
  const [newEventApprovedPublic, setNewEventApprovedPublic] = useState(false);
  const [newEventApprovedAlumni, setNewEventApprovedAlumni] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');

  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'>('TODO');
  const [editTaskReason, setEditTaskReason] = useState('');

  const [newParticipantType, setNewParticipantType] = useState<'MEMBER' | 'GUEST'>('GUEST');
  const [newParticipantMemberId, setNewParticipantMemberId] = useState('');
  const [newParticipantGuestName, setNewParticipantGuestName] = useState('');
  const [newParticipantGuestEmail, setNewParticipantGuestEmail] = useState('');
  const [newParticipantGuestPhone, setNewParticipantGuestPhone] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState<'ATTENDEE' | 'SPEAKER' | 'ORGANIZER' | 'VOLUNTEER'>('ATTENDEE');

  const [newBudgetCategory, setNewBudgetCategory] = useState<'VENUE' | 'LOGISTICS' | 'PRINTING' | 'REFRESHMENTS' | 'GIFTS' | 'SPEAKER_HONORARIUM' | 'OTHER'>('REFRESHMENTS');
  const [newBudgetDesc, setNewBudgetDesc] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState(500000);

  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState(200000);
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [newExpensePayer, setNewExpensePayer] = useState('');
  const [newExpenseMethod, setNewExpenseMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [newExpenseRef, setNewExpenseRef] = useState('');

  // Stage 20: Content & Review Moderation State
  const [moderationReviews, setModerationReviews] = useState<BookReviewDto[]>([]);
  const [moderationPosts, setModerationPosts] = useState<PublicPostDto[]>([]);
  const [moderationTab, setModerationTab] = useState<'REVIEWS' | 'POSTS'>('REVIEWS');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('PENDING');
  const [selectedReviewForModerate, setSelectedReviewForModerate] = useState<BookReviewDto | null>(null);
  const [showModerateReviewModal, setShowModerateReviewModal] = useState<boolean>(false);
  const [moderationDecision, setModerationDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [moderationNoteInput, setModerationNoteInput] = useState<string>('');
  const [showCreatePostModal, setShowCreatePostModal] = useState<boolean>(false);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostSlug, setNewPostSlug] = useState<string>('');
  const [newPostSummary, setNewPostSummary] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostCategory, setNewPostCategory] = useState<'NEWS' | 'REVIEW' | 'EVENT_RECAP' | 'NOTICE' | 'GUIDE'>('NEWS');

  // Stage 21: Reporting & Audit State
  const [reportPeriod, setReportPeriod] = useState<'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL'>('MONTH');
  const [financialReportData, setFinancialReportData] = useState<FinancialSummaryReportDto | null>(null);
  const [drilldownItems, setDrilldownItems] = useState<FinancialDrilldownItemDto[]>([]);
  const [drilldownTotalCount, setDrilldownTotalCount] = useState<number>(0);
  const [circulationReportData, setCirculationReportData] = useState<CirculationSummaryReportDto | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [auditLogsData, setAuditLogsData] = useState<AuditLogItemDto[]>([]);
  const [auditLogsTotalCount, setAuditLogsTotalCount] = useState<number>(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummaryDto | null>(null);

  // Responsive sidebar collapse and query mode init
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true);
      }
      const p = new URLSearchParams(window.location.search);
      if (demoAllowed && p.get('mode') === 'demo') {
        setWorkspaceMode('DEMO');
      }
    }
  }, []);

  // S12-10: Global Escape key listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewLoanModal(false);
        setShowReturnModal(false);
        setShowRenewModal(false);
        setShowLossModal(false);
        setShowOpenSessionModal(false);
        setShowCloseSessionModal(false);
        setShowCorrectionModal(false);
        setShowFbPostModal(false);
        setShowExportModal({ isOpen: false, type: 'EXCEL', title: '' });
        setShowConfirmDepositModal({ isOpen: false, loan: null });
        setShowPendingFineModal({ isOpen: false, loan: null, amount: 0 });
        setShowSessionSummaryModal(false);
        setShowCollectDuesModal(false);
        setShowAffiliationsModal(false);
        setShowAvailabilityModal(false);
        setShowGenerateScheduleModal(false);
        setShowManualEditModal(false);
        setShowFacebookViewModal(false);
        setShowResponseDetailModal(false);
        setShowReconcileModal(false);
        setShowEvaluationModal(false);
        setShowDecisionModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Live Data from Backend API
  const loadLiveData = useCallback(async () => {
    const requestVersion = ++activeRequestVersionRef.current;
    try {
      setAuthLoading(true);
      setApiError(null);

      // 1. Resolve Actor
      const me = await apiClient.getMe();
      if (requestVersion !== activeRequestVersionRef.current) return;
      setActor(me);
      setAuthError(null);

      const resolvedRole: Role = me.role === 'ADMIN' ? 'ADMIN' : (me.isAlumni ? 'ALUMNI' : 'ACTIVE_MEMBER');
      setCurrentRole(resolvedRole);

      // If Alumni, restrict to safe activities view only
      if (me.isAlumni) {
        const acts = await apiClient.getAlumniActivities();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveActivities(acts);
        setActiveModule('cuu');
        setAuthLoading(false);
        return;
      }

      // 2. Fetch Cash Session Today
      try {
        const sess = await apiClient.getTodaySession();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveSession(sess);
        setActualClosingCashInput(sess.expectedClosingCash);
      } catch (err: any) {
        if (requestVersion === activeRequestVersionRef.current) {
          if (err.code === 'NO_ACTIVE_SESSION' || err.status === 404) {
            setLiveSession(null);
          } else {
            console.warn('Lỗi kiểm tra phiên quầy:', err.message);
          }
        }
      }

      // 3. Fetch Loans
      const loansData = await apiClient.listLoans();
      if (requestVersion !== activeRequestVersionRef.current) return;
      const loansList = Array.isArray(loansData) ? loansData : (loansData as any).items || [];
      setLiveLoans(loansList);

      // 4. Fetch Borrowers
      const borrowersData = await apiClient.searchBorrowers();
      if (requestVersion !== activeRequestVersionRef.current) return;
      setLiveBorrowers(borrowersData);
      if (borrowersData.length > 0 && !selectedBorrowerId) {
        setSelectedBorrowerId(borrowersData[0].id);
      }

      // 5. Fetch Books & Available Copies từ catalog thật (S12-01, RF-05)
      let loadedCopies: BookCopyDto[] = [];
      try {
        const copiesRes = await apiClient.listBookCopies({ limit: 100 });
        loadedCopies = Array.isArray(copiesRes) ? copiesRes : (copiesRes as any).items || [];
      } catch (err: any) {
        console.warn('Lỗi lấy bản sao sách từ catalog:', err.message);
        if (requestVersion === activeRequestVersionRef.current) {
          setApiError(`Không thể tải bản sao sách từ catalog: ${err.message}`);
        }
      }

      if (requestVersion !== activeRequestVersionRef.current) return;
      // RF-05: Tuyệt đối không fallback suy tồn kho từ lịch sử mượn
      setLiveCopies(loadedCopies);
      const avList = loadedCopies.filter(c => c.status === 'AVAILABLE');
      if (avList.length > 0 && !selectedBarcode1) {
        setSelectedBarcode1(avList[0].barcode);
      }

      // 6. Fetch Members & Headcount (Chặng 13)
      try {
        const mems = await apiClient.getMembers();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveMembers(mems);
        const hc = await apiClient.getMembersHeadcount();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setMemberHeadcount(hc);
      } catch (err: any) {
        console.warn('Lỗi lấy danh sách thành viên/headcount:', err.message);
      }

      // 7. Fetch Duty Schedules (Chặng 15)
      try {
        const scheds = await apiClient.getDutySchedules('2026.1');
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveSchedules(scheds);
      } catch (err: any) {
        console.warn('Lỗi lấy danh sách lịch trực:', err.message);
      }

      // 8. Fetch Recruitment Responses (Chặng 16)
      try {
        const recruits = await apiClient.listRecruitmentResponses({ formId: 'FORM_GEN_10_2026' });
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveRecruitmentResponses(recruits);
      } catch (err: any) {
        console.warn('Lỗi lấy danh sách hồ sơ tuyển dụng:', err.message);
      }

      // 9. Fetch Bookstore Consignment Lots & Suppliers (Stage 18)
      try {
        const sups = await apiClient.getSuppliers();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveSuppliers(sups);
        const lots = await apiClient.listLots();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveLots(lots);
      } catch (err: any) {
        console.warn('Lỗi lấy danh sách lô sách ký gửi:', err.message);
      }

      // 10. Fetch Events & Activities (Stage 19)
      try {
        const evts = await apiClient.listEvents();
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLiveEvents(evts);
      } catch (err: any) {
        console.warn('Lỗi lấy danh sách sự kiện:', err.message);
      }

      // 11. Fetch Pending Circulation Queues (S12-03)
      try {
        const [pRefunds, pDeposits, pFines] = await Promise.all([
          apiClient.listPendingRefunds(),
          apiClient.listPendingDeposits(),
          apiClient.listPendingFines(),
        ]);
        if (requestVersion !== activeRequestVersionRef.current) return;
        setLivePendingRefunds(pRefunds);
        setLivePendingDeposits(pDeposits);
        setLivePendingFines(pFines);
        setPendingQueuesError(null);
      } catch (err: any) {
        console.warn('Lỗi lấy danh sách hàng chờ xử lý:', err.message);
        if (requestVersion === activeRequestVersionRef.current) {
          setPendingQueuesError(err.message || 'Lỗi khi tải danh sách hàng chờ xử lý từ máy chủ.');
        }
      }
    } catch (err: any) {
      if (requestVersion !== activeRequestVersionRef.current) return;
      console.error('Lỗi khi tải dữ liệu từ máy chủ API:', err);
      if (err.status === 401 || err.status === 403) {
        clearLiveSensitiveData();
        setAuthError('Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setApiError(err.message || 'Không thể kết nối đến máy chủ API.');
      }
    } finally {
      if (requestVersion === activeRequestVersionRef.current) {
        setAuthLoading(false);
      }
    }
  }, [selectedBorrowerId, selectedBarcode1]);

  const clearLiveSensitiveData = useCallback(() => {
    // RF-06: Huỷ bỏ toàn bộ pending response và xóa sạch mọi state nhạy cảm
    activeRequestVersionRef.current += 1;
    setAuthLoading(false);
    actionKeyRegistry.clearAll();

    setActor(null);
    setLiveSession(null);
    setLiveLoans([]);
    setLiveBorrowers([]);
    setLiveCopies([]);
    setLiveMembers([]);
    setMemberHeadcount(null);
    setLiveSchedules([]);
    setLiveRecruitmentResponses([]);
    setLiveSuppliers([]);
    setLiveLots([]);
    setLiveEvents([]);
    setLivePendingRefunds([]);
    setLivePendingDeposits([]);
    setLivePendingFines([]);
    setStaffReservations([]);
    setReservationAttentionCount(0);
    setReservationTotal(0);
    setReservationPage(1);
    setSelectedReservationForFulfill(null);
    setSelectedReservationForCancel(null);
    setReservationSearchQuery('');
    setSelectedLoanForReturn(null);
    setSelectedLoanForRenew(null);
    setSelectedLoanForLoss(null);
    setSelectedLotForAction(null);
    setSelectedLotItemForSale(null);
    setSelectedEventDetail(null);
    setSelectedRefundForConfirm(null);
    setReturnQuote(null);
    setRenewQuote(null);
    setQuoteError(null);
    setPendingQueuesError(null);
    setShowPendingFineModal({ isOpen: false, loan: null, amount: 0 });
    setSettlementDetailData(null);

    // RF-06: Hồ sơ tuyển dụng, đánh giá, rubric, quyết định, bài đăng và audit/analytics
    setEvalListForResponse([]);
    setCurrentRubric(null);
    setSelectedResponseForEval(null);
    setSelectedResponseForDecision(null);
    setSelectedResponseForDetail(null);
    setDecisionRecord(null);
    setConvertedMemberId(null);
    setEvalHistoryList([]);
    setReconcileResult(null);
    setAuditLogsData([]);
    setAnalyticsData(null);
    setModerationReviews([]);
    setModerationPosts([]);
  }, []);

  useEffect(() => {
    if (workspaceMode === 'LIVE') {
      loadLiveData();
    } else {
      clearLiveSensitiveData();
      setAuthLoading(false);
      setAuthError(null);
      setApiError(null);
    }
  }, [workspaceMode, loadLiveData, clearLiveSensitiveData]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // Ignored
    }
    clearLiveSensitiveData();
    window.location.href = '/login';
  };

  // RF-05: Tìm / Quét trực tiếp bản sao sách từ máy chủ bằng mã vạch
  const handleSearchCopyByBarcode = async () => {
    const code = barcodeSearchInput.trim();
    if (!code) return;
    try {
      setIsSearchingBarcode(true);
      const copy = await apiClient.getBookCopyByBarcode(code);
      if (copy) {
        setLiveCopies((prev) => {
          if (prev.some((c) => c.barcode === copy.barcode)) return prev;
          return [copy, ...prev];
        });
        if (!selectedBarcode1) {
          setSelectedBarcode1(copy.barcode);
        } else if (!selectedBarcode2 && copy.barcode !== selectedBarcode1) {
          setSelectedBarcode2(copy.barcode);
        }
        setBarcodeSearchInput('');
      }
    } catch (err: any) {
      alert(`Không tìm thấy bản sao với mã vạch '${code}': ${err.message || 'Lỗi kết nối'}`);
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  // Helper deposit calculation for live selections
  const selectedCopy1 = liveCopies.find(c => c.barcode === selectedBarcode1);
  const selectedCopy2 = liveCopies.find(c => c.barcode === selectedBarcode2);
  const dep1 = selectedCopy1 ? calculateDeposit(selectedCopy1.coverPrice) : 0;
  const dep2 = selectedCopy2 && selectedBarcode2 ? calculateDeposit(selectedCopy2.coverPrice) : 0;
  const totalNewDeposit = dep1 + dep2;

  // Active role controls
  const isAlumni = currentRole === 'ALUMNI';
  const isAdmin = currentRole === 'ADMIN';

  // ═════════════════════════════════════════════════════════════════════════
  // HANDLERS FOR CIRCULATION & DESK OPERATIONS
  // ═════════════════════════════════════════════════════════════════════════

  // 1. Lập phiếu mượn mới
  const handleExecuteIssueLoan = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedBorrowerId || !selectedBarcode1) {
      alert('Vui lòng chọn bạn đọc và ít nhất 1 cuốn sách sẵn sàng.');
      return;
    }
    if (!isPaymentConfirmed) {
      alert('Bắt buộc xác nhận đã nhận đủ tiền cọc thực tế (tiền mặt hoặc app ngân hàng).');
      return;
    }

    if (workspaceMode === 'DEMO') {
      // Demo in-memory mutation
      const borrower = INITIAL_BORROWERS.find(b => b.id === selectedBorrowerId) || INITIAL_BORROWERS[0];
      const items: any[] = [];
      const b1 = demoBooks.flatMap(b => b.copies).find(c => c.barcode === selectedBarcode1);
      const b1P = demoBooks.find(b => b.copies.some(c => c.barcode === selectedBarcode1));
      if (b1 && b1P) items.push({ barcode: b1.barcode, bookTitle: b1P.title, depositSnapshot: dep1 });
      if (selectedBarcode2) {
        const b2 = demoBooks.flatMap(b => b.copies).find(c => c.barcode === selectedBarcode2);
        const b2P = demoBooks.find(b => b.copies.some(c => c.barcode === selectedBarcode2));
        if (b2 && b2P) items.push({ barcode: b2.barcode, bookTitle: b2P.title, depositSnapshot: dep2 });
      }

      const newReceipt: LoanReceipt = {
        id: `ln-${Date.now()}`,
        receiptNumber: `YSBK-PM-${Date.now().toString().slice(-6)}`,
        borrower,
        borrowDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
        dueDate: '2026-11-01',
        items,
        renewCount: 0,
        status: 'ACTIVE',
        notes: `Demo: Thu cọc bằng ${paymentMethod === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản'}`,
      };
      setDemoLoans([newReceipt, ...demoLoans]);
      setShowNewLoanModal(false);
      return;
    }

    // LIVE API MUTATION
    try {
      setIsSubmitting(true);
      setApiError(null);
      const barcodes = [selectedBarcode1];
      if (selectedBarcode2) barcodes.push(selectedBarcode2);

      const issuePayload = {
        borrowerId: selectedBorrowerId,
        barcodes,
        paymentMethod: (paymentMethod === 'TIEN_MAT' ? 'CASH' : 'BANK_TRANSFER') as 'CASH' | 'BANK_TRANSFER',
        paymentConfirmed: true,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('ISSUE', 'NEW', issuePayload);
      await apiClient.issueLoan({
        ...issuePayload,
        idempotencyKey: key,
      });

      setApiSuccess('Lập phiếu mượn sách thành công.');
      actionKeyRegistry.clearKey('ISSUE', 'NEW');
      await loadLiveData();
      setShowNewLoanModal(false);
      setSelectedBarcode2('');
      setIsPaymentConfirmed(false);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lập phiếu mượn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Trả sách & Tất toán (Full / Partial)
  const handleExecuteReturn = async () => {
    if (!selectedLoanForReturn) return;

    if (workspaceMode === 'DEMO') {
      if (returnType === 'FULL') {
        setDemoLoans(demoLoans.map(l => l.id === selectedLoanForReturn.id ? { ...l, status: 'RETURNED' as const } : l));
      } else {
        const keptItems = selectedLoanForReturn.items.filter(item => !returnedBarcodes.includes(item.barcode));
        const newReceipt: LoanReceipt = {
          id: `ln-${Date.now()}`,
          receiptNumber: `YSBK-PM-${Date.now().toString().slice(-6)}`,
          borrower: {
            id: selectedLoanForReturn.borrowerId,
            fullName: selectedLoanForReturn.borrowerName,
            phone: selectedLoanForReturn.borrowerPhone,
            studentId: selectedLoanForReturn.borrowerStudentId || '',
            school: selectedLoanForReturn.borrowerSchool || '',
            email: '',
          },
          borrowDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
          dueDate: '2026-11-01',
          items: keptItems.map(it => ({ barcode: it.barcode, bookTitle: it.title, depositSnapshot: it.depositSnapshot })),
          renewCount: 0,
          status: 'ACTIVE',
          precedingReceiptId: selectedLoanForReturn.id,
          notes: `Phiếu chuyển tiếp từ ${selectedLoanForReturn.receiptNumber}.`,
        };
        setDemoLoans([newReceipt, ...demoLoans.map(l => l.id === selectedLoanForReturn.id ? { ...l, status: 'PARTIAL_SETTLED' as const } : l)]);
      }
      setShowReturnModal(false);
      setSelectedLoanForReturn(null);
      return;
    }

    // LIVE API MUTATION
    try {
      setIsSubmitting(true);
      setApiError(null);

      let fineAmount = 0;
      if (customFineAmount !== null) {
        fineAmount = customFineAmount;
      } else if (returnQuote) {
        fineAmount = returnQuote.suggestedFine;
      } else {
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        const isOverdue = selectedLoanForReturn.dueDate < todayStr;
        if (isOverdue) {
          const overdueDays = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(selectedLoanForReturn.dueDate).getTime()) / (1000 * 3600 * 24)));
          fineAmount = overdueDays * 1000;
        }
      }

      // S12-02: Bắt buộc gửi danh sách mã vạch sách thực tế trả vật lý cho cả FULL và PARTIAL
      const physicalReturnBarcodes = returnType === 'PARTIAL'
        ? returnedBarcodes
        : selectedLoanForReturn.items
            .filter((it: any) => !it.isLost && !it.isReturned && !it.returnedAt && !it.carriedForwardAt)
            .map((it: any) => it.barcode);

      const returnPayload = {
        returnType,
        returnedBarcodes: physicalReturnBarcodes,
        refundMethod: (refundMethod === 'TIEN_MAT' ? 'CASH' : 'BANK_TRANSFER') as 'CASH' | 'BANK_TRANSFER',
        paymentConfirmed: returnPaymentConfirmed,
        cashSessionId: liveSession?.id,
        fineAmount: fineAmount > 0 ? fineAmount : 0,
        fineReason: waiveFineReason || undefined,
        finePaymentMethod: (returnFinePaymentMethod === 'CHUYEN_KHOAN' ? 'BANK_TRANSFER' : 'CASH') as 'CASH' | 'BANK_TRANSFER',
        finePaymentConfirmed: fineAmount > 0 ? returnFinePaymentConfirmed : undefined,
      };
      const key = getActionKey('RETURN', selectedLoanForReturn.id, returnPayload);

      await apiClient.settleReturn(selectedLoanForReturn.id, {
        ...returnPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Tất toán trả sách thành công.');
      actionKeyRegistry.clearKey('RETURN', selectedLoanForReturn.id);
      await loadLiveData();
      setShowReturnModal(false);
      setSelectedLoanForReturn(null);
      setReturnQuote(null);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tất toán trả sách.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở modal Trả sách & lấy Quote từ server (S12-03)
  const handleOpenReturnModal = async (loan: LoanReceiptDto) => {
    setSelectedLoanForReturn(loan);
    const activeItems = (loan.items || []).filter((it: any) => !it.returnedAt && !it.isLost);
    setReturnedBarcodes(activeItems.map((i: any) => i.barcode));
    setReturnType(activeItems.length > 1 ? 'PARTIAL' : 'FULL');
    setCustomFineAmount(null);
    setWaiveFineReason('');
    setReturnPaymentConfirmed(false);
    setReturnFinePaymentConfirmed(false);
    setReturnQuote(null);
    setQuoteError(null);
    setShowReturnModal(true);
    if (workspaceMode === 'LIVE') {
      try {
        setIsFetchingQuote(true);
        const q = await apiClient.quoteLoanAction(loan.id, 'RETURN');
        setReturnQuote(q);
        setCustomFineAmount(q.effectiveFine !== undefined ? q.effectiveFine : q.suggestedFine);
      } catch (err: any) {
        console.warn('Lỗi lấy quote trả sách từ máy chủ:', err.message);
        setQuoteError(err.message || 'Lỗi khi tải báo giá trả sách từ máy chủ.');
      } finally {
        setIsFetchingQuote(false);
      }
    }
  };

  // Mở modal Gia hạn sách & lấy Quote từ server (S12-03)
  const handleOpenRenewModal = async (loan: LoanReceiptDto) => {
    setSelectedLoanForRenew(loan);
    setRenewFineReason('');
    setRenewPaymentConfirmed(false);
    setRenewQuote(null);
    setQuoteError(null);
    setShowRenewModal(true);
    if (workspaceMode === 'LIVE') {
      try {
        setIsFetchingQuote(true);
        const q = await apiClient.quoteLoanAction(loan.id, 'RENEW');
        setRenewQuote(q);
        setRenewFineAmount(q.effectiveFine !== undefined ? q.effectiveFine : q.suggestedFine);
      } catch (err: any) {
        console.warn('Lỗi lấy quote gia hạn từ máy chủ:', err.message);
        setQuoteError(err.message || 'Lỗi khi tải báo giá gia hạn từ máy chủ.');
        setRenewFineAmount(0);
      } finally {
        setIsFetchingQuote(false);
      }
    }
  };

  // Xem chi tiết quyết toán của phiếu mượn (S12-03)
  const handleViewSettlementDetail = async (loanId: string) => {
    try {
      setIsSubmitting(true);
      setApiError(null);
      const detail = await apiClient.getLoanSettlement(loanId);
      setSettlementDetailData(detail);
      setShowLoanSettlementModal(true);
    } catch (err: any) {
      setApiError(err.message || 'Không thể tải chi tiết quyết toán của phiếu mượn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xác nhận chi tiền hoàn cọc (S12-03)
  const handleExecuteConfirmRefund = async () => {
    if (!selectedRefundForConfirm) return;
    if (!confirmRefundPaymentConfirmed) {
      alert('Bắt buộc đánh dấu xác nhận đã chi tiền thực tế cho bạn đọc (tiền mặt hoặc app ngân hàng).');
      return;
    }

    if (workspaceMode === 'DEMO') {
      setLivePendingRefunds(livePendingRefunds.filter(r => r.id !== selectedRefundForConfirm.id));
      setApiSuccess('Demo: Xác nhận hoàn cọc thành công.');
      setShowConfirmRefundModal(false);
      setSelectedRefundForConfirm(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);
      const refundPayload = {
        refundMethod: confirmRefundMethod,
        paymentConfirmed: true,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('CONFIRM_REFUND', selectedRefundForConfirm.id, refundPayload);
      await apiClient.confirmRefund(selectedRefundForConfirm.id, {
        ...refundPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Xác nhận hoàn cọc thành công. Phiếu chi đã được ghi vào sổ cái.');
      actionKeyRegistry.clearKey('CONFIRM_REFUND', selectedRefundForConfirm.id);
      setShowConfirmRefundModal(false);
      setSelectedRefundForConfirm(null);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi xác nhận hoàn cọc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hủy ý định hoàn cọc (S12-03)
  const handleExecuteCancelRefund = async (intentId: string) => {
    const reason = prompt('Nhập lý do hủy ý định hoàn cọc:');
    if (reason === null) return;

    if (workspaceMode === 'DEMO') {
      setLivePendingRefunds(livePendingRefunds.filter(r => r.id !== intentId));
      setApiSuccess('Demo: Hủy ý định hoàn cọc thành công.');
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);
      await apiClient.cancelRefund(intentId, { reason: reason || 'Hủy tại quầy' });
      setApiSuccess('Hủy ý định hoàn cọc thành công.');
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi hủy ý định hoàn cọc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PR-7: Quản lý đơn giữ chỗ tại quầy bàn trực
  const fetchStaffReservations = async () => {
    const version = activeRequestVersionRef.current;
    const requestId = ++reservationRequestRef.current;
    setIsLoadingReservations(true);
    try {
      if (workspaceMode === 'LIVE') {
        const res = await apiClient.listStaffReservations({
          status: reservationFilterStatus === 'ALL' ? undefined : (reservationFilterStatus as any),
          search: reservationSearchQuery.trim() || undefined,
          page: reservationPage, limit: 50,
        });
        if (version !== activeRequestVersionRef.current || requestId !== reservationRequestRef.current) return;
        setStaffReservations(res.items || []);
        setReservationAttentionCount(res.attentionCount);
        setReservationTotal(res.total);
        if (reservationPage > Math.max(1, Math.ceil(res.total / 50))) setReservationPage(1);
      } else {
        // DEMO Mode
        let filtered = demoReservations;
        if (reservationFilterStatus !== 'ALL') {
          filtered = filtered.filter((r: any) => r.status === reservationFilterStatus);
        }
        if (reservationSearchQuery.trim()) {
          const q = reservationSearchQuery.trim().toLowerCase();
          filtered = filtered.filter((r: any) => 
            r.code?.toLowerCase().includes(q) ||
            r.fullName?.toLowerCase().includes(q) ||
            r.phone?.includes(q) ||
            r.bookTitle?.toLowerCase().includes(q)
          );
        }
        setStaffReservations(filtered);
        setReservationAttentionCount(0);
        setReservationTotal(filtered.length);
      }
    } catch (err: any) {
      if (version === activeRequestVersionRef.current && requestId === reservationRequestRef.current) { setStaffReservations([]); setReservationAttentionCount(0); setApiError(err.message || 'Không tải được đơn đặt.'); }
    } finally {
      if (version === activeRequestVersionRef.current && requestId === reservationRequestRef.current) setIsLoadingReservations(false);
    }
  };

  useEffect(() => {
    if (activeModule !== 'quay-sach' || deskSubTab !== 'RESERVATIONS') return;
    const task = window.setTimeout(() => void fetchStaffReservations(), 250);
    const stop = workspaceMode === 'LIVE' ? startAvailabilityRefresh(fetchStaffReservations) : () => {};
    return () => { window.clearTimeout(task); stop(); reservationRequestRef.current++; };
  }, [activeModule, deskSubTab, workspaceMode, reservationFilterStatus, reservationSearchQuery, reservationPage]);

  const handleExecuteFulfillReservation = async () => {
    const version = activeRequestVersionRef.current;
    if (!selectedReservationForFulfill) return;
    if (!fulfillPaymentConfirmed) {
      setApiError('Bắt buộc đánh dấu đã thu tiền cọc thực tế để bàn giao sách.');
      return;
    }

    setIsFulfilling(true);
    setApiError(null);

    const payload = {
      paymentMethod: fulfillPaymentMethod,
      depositPaymentConfirmed: fulfillPaymentConfirmed,
      notes: fulfillNotes.trim() || undefined,
    };

    if (workspaceMode === 'DEMO') {
      setDemoReservations(demoReservations.map((r: any) => 
        r.id === selectedReservationForFulfill.id 
          ? { ...r, status: 'BORROWED' }
          : r
      ));
      setStaffReservations(staffReservations.map((r: any) => 
        r.id === selectedReservationForFulfill.id 
          ? { ...r, status: 'BORROWED' }
          : r
      ));
      setApiSuccess(`Demo: Đã bàn giao sách cho bạn đọc ${selectedReservationForFulfill.fullName || selectedReservationForFulfill.borrowerName || 'khách'} và thu cọc ${formatVND(selectedReservationForFulfill.estimatedDeposit)}.`);
      setSelectedReservationForFulfill(null);
      setIsFulfilling(false);
      return;
    }

    try {
      const key = getActionKey('FULFILL_RESERVATION', selectedReservationForFulfill.id, payload);
      await apiClient.fulfillStaffReservation(selectedReservationForFulfill.id, payload, key);
      if (version !== activeRequestVersionRef.current) return;
      actionKeyRegistry.clearKey('FULFILL_RESERVATION', selectedReservationForFulfill.id);
      setApiSuccess(`Đã lập phiếu mượn và bàn giao sách thành công cho đơn ${selectedReservationForFulfill.code}.`);
      setSelectedReservationForFulfill(null);
      await fetchStaffReservations();
      await loadLiveData();
    } catch (err: any) {
      if (version === activeRequestVersionRef.current) setApiError(err.message || 'Lỗi khi bàn giao sách cho bạn đọc.');
    } finally {
      if (version === activeRequestVersionRef.current) setIsFulfilling(false);
    }
  };

  const handleExecuteCancelStaffReservation = async () => {
    const version = activeRequestVersionRef.current;
    if (!selectedReservationForCancel) return;
    setIsStaffCancelling(true);
    setApiError(null);

    const reason = cancelStaffReason.trim() || 'Hủy tại quầy trực theo yêu cầu bạn đọc';

    if (workspaceMode === 'DEMO') {
      setDemoReservations(demoReservations.map((r: any) => 
        r.id === selectedReservationForCancel.id 
          ? { ...r, status: 'CANCELLED' }
          : r
      ));
      setStaffReservations(staffReservations.map((r: any) => 
        r.id === selectedReservationForCancel.id 
          ? { ...r, status: 'CANCELLED' }
          : r
      ));
      setApiSuccess(`Demo: Đã hủy đơn đặt giữ chỗ ${selectedReservationForCancel.code}.`);
      setSelectedReservationForCancel(null);
      setIsStaffCancelling(false);
      return;
    }

    try {
      await apiClient.cancelStaffReservation(selectedReservationForCancel.id, reason);
      if (version !== activeRequestVersionRef.current) return;
      setApiSuccess(`Đã hủy đơn đặt giữ chỗ ${selectedReservationForCancel.code} và giải phóng bản sách.`);
      setSelectedReservationForCancel(null);
      await fetchStaffReservations();
      await loadLiveData();
    } catch (err: any) {
      if (version === activeRequestVersionRef.current) setApiError(err.message || 'Lỗi khi hủy đơn đặt giữ chỗ.');
    } finally {
      if (version === activeRequestVersionRef.current) setIsStaffCancelling(false);
    }
  };

  // 3. Gia hạn phiếu mượn
  const handleExecuteRenew = async () => {
    if (!selectedLoanForRenew) return;

    if (workspaceMode === 'DEMO') {
      setDemoLoans(
        demoLoans.map((l) =>
          l.id === selectedLoanForRenew.id
            ? { ...l, renewCount: (l.renewCount || 0) + 1, dueDate: '2026-11-15' }
            : l
        )
      );
      setApiSuccess('Demo: Gia hạn phiếu mượn thành công (+14 ngày).');
      setShowRenewModal(false);
      setSelectedLoanForRenew(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const renewPayload = {
        fineAmount: renewFineAmount,
        fineReason: renewFineReason || undefined,
        finePaymentMethod: (renewFinePaymentMethod === 'CHUYEN_KHOAN' ? 'BANK_TRANSFER' : 'CASH') as 'CASH' | 'BANK_TRANSFER',
        finePaymentConfirmed: renewFineAmount > 0 ? renewPaymentConfirmed : undefined,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('RENEW', selectedLoanForRenew.id, renewPayload);

      await apiClient.renewLoan(selectedLoanForRenew.id, {
        ...renewPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Gia hạn phiếu mượn thành công (+14 ngày).');
      actionKeyRegistry.clearKey('RENEW', selectedLoanForRenew.id);
      await loadLiveData();
      setShowRenewModal(false);
      setSelectedLoanForRenew(null);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi gia hạn phiếu mượn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Báo mất sách
  const handleExecuteReportLoss = async () => {
    if (!selectedLoanForLoss || !lossSelectedBarcode) {
      alert('Vui lòng chọn cuốn sách bị mất.');
      return;
    }
    if (!lossReason.trim()) {
      alert('Bắt buộc nhập lý do báo mất sách.');
      return;
    }

    if (workspaceMode === 'DEMO') {
      setDemoLoans(
        demoLoans.map((l) =>
          l.id === selectedLoanForLoss.id
            ? {
                ...l,
                status: 'LOST' as const,
                items: l.items.map((it: any) =>
                  it.barcode === lossSelectedBarcode ? { ...it, isLost: true } : it
                ),
              }
            : l
        )
      );
      setApiSuccess('Demo: Báo mất sách và tịch thu cọc thành công.');
      setShowLossModal(false);
      setSelectedLoanForLoss(null);
      setLossReason('');
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const lossPayload = {
        barcodes: [lossSelectedBarcode],
        reason: lossReason,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('LOSS', selectedLoanForLoss.id, lossPayload);
      await apiClient.reportBookLoss(selectedLoanForLoss.id, {
        ...lossPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Báo mất sách và tịch thu cọc thành công.');
      actionKeyRegistry.clearKey('LOSS', selectedLoanForLoss.id);
      await loadLiveData();
      setShowLossModal(false);
      setSelectedLoanForLoss(null);
      setLossReason('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi báo mất sách.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Mở ca quầy tiền mặt
  const handleExecuteOpenSession = async () => {
    if (workspaceMode === 'DEMO') {
      setApiSuccess('Demo: Mở ca quầy tiền mặt thành công.');
      setShowOpenSessionModal(false);
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const openPayload = {
        sessionDate: todayStr,
        openingCash: openingCashInput,
        discrepancyReason: openDiscrepancyReason || undefined,
      };
      const key = getActionKey('OPEN_CS', todayStr, openPayload);
      await apiClient.openSession({
        ...openPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Mở ca quầy tiền mặt thành công.');
      actionKeyRegistry.clearKey('OPEN_CS', todayStr);
      await loadLiveData();
      setShowOpenSessionModal(false);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi mở ca quầy tiền mặt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Đóng ca quầy tiền mặt
  const handleExecuteCloseSession = async () => {
    if (workspaceMode === 'DEMO') {
      setApiSuccess('Demo: Đóng ca quầy tiền mặt thành công.');
      setShowCloseSessionModal(false);
      return;
    }

    if (!liveSession) return;
    try {
      setIsSubmitting(true);
      setApiError(null);

      const closePayload = {
        sessionId: liveSession.id,
        actualClosingCash: actualClosingCashInput,
        discrepancyReason: closeDiscrepancyReason || undefined,
      };
      const key = getActionKey('CLOSE_CS', liveSession.id, closePayload);
      await apiClient.closeSession({
        ...closePayload,
        idempotencyKey: key,
      });

      setApiSuccess('Đóng ca quầy tiền mặt thành công.');
      actionKeyRegistry.clearKey('CLOSE_CS', liveSession.id);
      await loadLiveData();
      setShowCloseSessionModal(false);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi đóng ca quầy tiền mặt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Sửa sai chứng từ sổ cái
  const handleExecuteCorrection = async () => {
    if (!correctionEntryId.trim() || !correctionReason.trim()) {
      alert('Vui lòng nhập mã chứng từ gốc và lý do sửa sai.');
      return;
    }

    if (workspaceMode === 'DEMO') {
      setApiSuccess('Demo: Tạo bút toán sửa sai chứng từ thành công.');
      setShowCorrectionModal(false);
      setCorrectionEntryId('');
      setCorrectionReason('');
      setCorrectionPaymentConfirmed(false);
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const corrPayload = {
        originalEntryId: correctionEntryId.trim(),
        reason: correctionReason.trim(),
        paymentConfirmed: correctionPaymentConfirmed,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('CORRECTION', correctionEntryId.trim(), corrPayload);
      await apiClient.createDocumentCorrection({
        ...corrPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Tạo bút toán sửa sai chứng từ thành công.');
      actionKeyRegistry.clearKey('CORRECTION', correctionEntryId.trim());
      await loadLiveData();
      setShowCorrectionModal(false);
      setCorrectionEntryId('');
      setCorrectionReason('');
      setCorrectionPaymentConfirmed(false);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi sửa sai chứng từ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. Thu cọc mới cho phiếu chuyển tiếp PENDING_DEPOSIT (T73)
  const handleExecuteConfirmNewDeposit = async () => {
    if (!showConfirmDepositModal.loan) return;
    if (workspaceMode === 'DEMO') {
      setDemoLoans(
        demoLoans.map((l) =>
          l.id === showConfirmDepositModal.loan?.id ? { ...l, status: 'ACTIVE' as const } : l
        )
      );
      setApiSuccess('Demo: Đã thu cọc mới T73 thành công.');
      setShowConfirmDepositModal({ isOpen: false, loan: null });
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const depPayload = {
        paymentMethod: (depositMethodT73 === 'TIEN_MAT' ? 'CASH' : 'BANK_TRANSFER') as 'CASH' | 'BANK_TRANSFER',
        paymentConfirmed: depositConfirmedT73,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('CONFIRM_DEP', showConfirmDepositModal.loan.id, depPayload);
      await apiClient.confirmNewDeposit(showConfirmDepositModal.loan.id, {
        ...depPayload,
        idempotencyKey: key,
      });

      setApiSuccess('Thu tiền cọc mới T73 thành công, phiếu mượn đã kích hoạt ACTIVE.');
      actionKeyRegistry.clearKey('CONFIRM_DEP', showConfirmDepositModal.loan.id);
      await loadLiveData();
      setShowConfirmDepositModal({ isOpen: false, loan: null });
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi thu tiền cọc mới T73.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 9. Thu tiền phạt chờ thu (Pending Fine Collection)
  const handleExecuteCollectPendingFine = async () => {
    if (!showPendingFineModal.loan) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess('Demo: Đã thu tiền phạt chờ thu thành công.');
      setShowPendingFineModal({ isOpen: false, loan: null, amount: 0 });
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const collectFinePayload = {
        targetId: showPendingFineModal.targetId,
        amount: showPendingFineModal.amount,
        paymentMethod: (pendingFineMethod === 'TIEN_MAT' ? 'CASH' : 'BANK_TRANSFER') as 'CASH' | 'BANK_TRANSFER',
        paymentConfirmed: pendingFineConfirmed,
        cashSessionId: liveSession?.id,
      };
      const key = getActionKey('COLLECT_FINE', `${showPendingFineModal.loan.id}_${showPendingFineModal.targetId || 'ANY'}`, collectFinePayload);
      await apiClient.collectPendingFine(showPendingFineModal.loan.id, {
        ...collectFinePayload,
        idempotencyKey: key,
      });

      setApiSuccess('Thu tiền phạt chờ thu thành công.');
      actionKeyRegistry.clearKey('COLLECT_FINE', `${showPendingFineModal.loan.id}_${showPendingFineModal.targetId || 'ANY'}`);
      await loadLiveData();
      setShowPendingFineModal({ isOpen: false, loan: null, amount: 0 });
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi thu tiền phạt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 10. Xem đối soát ca trực (Cash Session Summary)
  const handleViewSessionSummary = async () => {
    if (!liveSession) return;
    try {
      setIsSubmitting(true);
      setApiError(null);
      const summary = await apiClient.getSessionSummary(liveSession.id);
      setSessionSummaryData(summary);
      setShowSessionSummaryModal(true);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lấy thông tin đối soát ca trực.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 11. Thu hội phí thành viên một lần (Chặng 13)
  const handleOpenCollectDuesModal = (member: MemberDto) => {
    setSelectedMemberForDues(member);
    setDuesAmountInput(100000);
    setDuesPaymentConfirmed(false);
    setDuesPaymentMethod('TIEN_MAT');
    setShowCollectDuesModal(true);
  };

  const handleExecuteCollectDues = async () => {
    if (!selectedMemberForDues) return;
    if (!duesPaymentConfirmed) {
      alert('Vui lòng xác nhận đã kiểm tra nhận tiền thực tế (tiền mặt trong két hoặc app ngân hàng).');
      return;
    }
    if (workspaceMode === 'DEMO') {
      setLiveMembers(prev => prev.map(m => m.id === selectedMemberForDues.id ? { ...m, hasPaidFee: true } : m));
      setApiSuccess(`Demo: Đã thu hội phí 100k cho thành viên ${selectedMemberForDues.fullName}.`);
      setShowCollectDuesModal(false);
      return;
    }
    try {
      setIsSubmitting(true);
      setApiError(null);

      const duesPayload = {
        amount: duesAmountInput,
        paymentMethod: (duesPaymentMethod === 'TIEN_MAT' ? 'CASH' : 'BANK_TRANSFER') as 'CASH' | 'BANK_TRANSFER',
        paymentConfirmed: duesPaymentConfirmed,
        cashSessionId: liveSession?.id,
        termLabel: duesTermLabel,
      };
      const key = getActionKey('DUES', selectedMemberForDues.id, duesPayload);

      await apiClient.collectMemberDues(selectedMemberForDues.id, {
        ...duesPayload,
        idempotencyKey: key,
      });
      setApiSuccess(`Thu hội phí 100k thành công cho ${selectedMemberForDues.fullName}.`);
      actionKeyRegistry.clearKey('DUES', selectedMemberForDues.id);
      await loadLiveData();
      setShowCollectDuesModal(false);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi thu hội phí thành viên.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 12. Xem lịch sử phân ban & chức vụ thành viên (Chặng 13)
  const handleOpenAffiliationsModal = async (member: MemberDto) => {
    setSelectedMemberForAffiliations(member);
    setShowAffiliationsModal(true);
    if (workspaceMode === 'DEMO') {
      setMemberAffiliationsList([
        {
          id: `aff-${member.id}-1`,
          memberId: member.id,
          department: (member.department as any) || 'HAU_CAN',
          role: (member.role as any) || 'TRUONG_BAN',
          termYear: '2025-2026',
          startDate: '2025-09-01',
          endDate: null,
          isCurrent: true,
          createdAt: new Date().toISOString(),
        }
      ]);
      return;
    }
    try {
      setIsSubmitting(true);
      const affs = await apiClient.getMemberAffiliations(member.id);
      setMemberAffiliationsList(affs);
    } catch (err: any) {
      setApiError(err.message || 'Không thể tải lịch sử phân ban.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 13. Xử lý tải lên và phân tích xem trước Lịch bận Excel (Chặng 14)
  const handleAvailabilityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvailabilityFileName(file.name);
    setAvailabilityPreviewData(null);
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || res;
      setAvailabilityBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAvailabilityPreview = async () => {
    if (!availabilityBase64) {
      alert('Vui lòng chọn tệp .xlsx trước khi phân tích.');
      return;
    }
    setIsPreviewingAvailability(true);
    setApiError(null);
    try {
      if (workspaceMode === 'DEMO') {
        setAvailabilityPreviewData({
          fileName: availabilityFileName || 'lich_ban_demo.xlsx',
          fileSizeBytes: 10240,
          fileHash: 'demo-hash',
          termSemester: availabilityTermSemester,
          effectiveStartDate: '2026-02-01',
          effectiveEndDate: '2026-06-30',
          totalRows: 2,
          validCount: 2,
          errorCount: 0,
          unrecognizedMembersCount: 0,
          isReadyToCommit: true,
          rows: [
            {
              rowNumber: 2,
              rawMemberIdentifier: '20230001',
              rawDayOfWeek: 'Thứ Ba',
              rawStartTime: '14:00',
              rawEndTime: '17:00',
              rawBusyType: 'Học chính khóa',
              resolvedMemberId: 'mem-01',
              resolvedMemberName: 'Nguyễn Văn A',
              normalizedDayOfWeek: 'THU_BA',
              normalizedStartTime: '14:00',
              normalizedEndTime: '17:00',
              normalizedBusyType: 'HOC_CHINH_KHOA',
              isValid: true,
            },
            {
              rowNumber: 3,
              rawMemberIdentifier: '20230002',
              rawDayOfWeek: 'Thứ Năm',
              rawStartTime: '14:00',
              rawEndTime: '17:00',
              rawBusyType: 'Thi',
              resolvedMemberId: 'mem-02',
              resolvedMemberName: 'Trần Thị B',
              normalizedDayOfWeek: 'THU_NAM',
              normalizedStartTime: '14:00',
              normalizedEndTime: '17:00',
              normalizedBusyType: 'THI',
              isValid: true,
            }
          ]
        });
        return;
      }
      const preview = await apiClient.previewAvailability({
        fileBase64: availabilityBase64,
        fileName: availabilityFileName || 'lich_ban.xlsx',
        termSemester: availabilityTermSemester,
      });
      setAvailabilityPreviewData(preview);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi phân tích tệp Excel lịch bận.');
    } finally {
      setIsPreviewingAvailability(false);
    }
  };

  const handleCommitAvailability = async () => {
    if (!availabilityPreviewData) return;
    setIsCommittingAvailability(true);
    setApiError(null);
    try {
      if (workspaceMode === 'DEMO') {
        setApiSuccess(`Demo: Đã lưu thành công lịch bận đợt ${availabilityTermSemester} v1 (2 khoảng bận).`);
        setAvailabilityPreviewData(null);
        setAvailabilityBase64(null);
        setShowAvailabilityModal(false);
        return;
      }

      const validRowsToCommit = availabilityPreviewData.rows
        .filter((r) => r.isValid && r.resolvedMemberId && r.normalizedDayOfWeek && r.normalizedStartTime && r.normalizedEndTime)
        .map((r) => ({
          memberId: r.resolvedMemberId!,
          dayOfWeek: r.normalizedDayOfWeek!,
          startTime: r.normalizedStartTime!,
          endTime: r.normalizedEndTime!,
          busyType: r.normalizedBusyType || 'HOC_CHINH_KHOA',
          notes: r.rawNotes,
        }));

      const res = await apiClient.commitAvailability({
        fileName: availabilityPreviewData.fileName,
        fileHash: availabilityPreviewData.fileHash,
        fileSizeBytes: availabilityPreviewData.fileSizeBytes,
        termSemester: availabilityPreviewData.termSemester,
        effectiveStartDate: availabilityPreviewData.effectiveStartDate,
        effectiveEndDate: availabilityPreviewData.effectiveEndDate,
        validRows: validRowsToCommit,
      });

      setApiSuccess(`Đã lưu thành công lịch bận đợt ${res.data.termSemester} v${res.data.version} (${res.intervalsCount} khoảng bận được ghi nhận).`);
      setAvailabilityPreviewData(null);
      setAvailabilityBase64(null);
      setShowAvailabilityModal(false);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lưu lịch bận.');
    } finally {
      setIsCommittingAvailability(false);
    }
  };

  // 14. Tạo dự thảo lịch trực mới bằng solver (Chặng 15)
  const handleGenerateDraftSchedules = async () => {
    setIsGeneratingSchedules(true);
    setApiError(null);
    try {
      if (workspaceMode === 'DEMO') {
        setApiSuccess(`Demo: Đã tạo thành công dự thảo lịch trực kỳ ${draftTermSemester} (2 ca mẫu).`);
        setShowGenerateScheduleModal(false);
        return;
      }
      const res = await apiClient.generateDraftSchedules({
        termSemester: draftTermSemester,
        startDate: draftStartDate,
        endDate: draftEndDate,
        forceOverwriteManual: draftForceOverwrite,
      });
      setApiSuccess(`Đã tạo thành công ${res.createdCount} ca trực dự thảo (bảo toàn ${res.preservedCount} ca đã sửa tay).`);
      setShowGenerateScheduleModal(false);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tạo dự thảo lịch trực.');
    } finally {
      setIsGeneratingSchedules(false);
    }
  };

  // 15. Chỉnh sửa tay ca trực (Chặng 15)
  const handleOpenManualEditModal = (sched: DutyScheduleDto) => {
    setSelectedScheduleForEdit(sched);
    setEditAssigneesList(
      sched.assignees.map((a) => ({
        memberId: a.memberId,
        dutyType: a.dutyType,
        assignedRole: a.assignedRole,
        notes: a.notes || undefined,
      }))
    );
    setShowManualEditModal(true);
  };

  const handleSaveManualEdit = async () => {
    if (!selectedScheduleForEdit) return;
    setIsSavingManualEdit(true);
    setApiError(null);
    try {
      if (workspaceMode === 'DEMO') {
        setLiveSchedules((prev) =>
          prev.map((s) => (s.id === selectedScheduleForEdit.id ? { ...s, isManuallyEdited: true, version: s.version + 1 } : s))
        );
        setApiSuccess(`Demo: Đã lưu chỉnh sửa tay cho ca ${selectedScheduleForEdit.scheduleDate}.`);
        setShowManualEditModal(false);
        return;
      }
      const updated = await apiClient.manualEditDutySchedule(selectedScheduleForEdit.id, {
        assignees: editAssigneesList,
      });
      setApiSuccess(`Đã cập nhật chỉnh sửa tay ca trực ngày ${updated.scheduleDate} (v${updated.version}).`);
      setShowManualEditModal(false);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lưu chỉnh sửa tay ca trực.');
    } finally {
      setIsSavingManualEdit(false);
    }
  };

  // 16. Công bố chính thức ca trực (Chặng 15)
  const handlePublishSchedule = async (scheduleId: string) => {
    if (!confirm('Bạn có chắc chắn muốn công bố chính thức ca trực này? (Lịch sử ca trực của thành viên sẽ được ghi nhận bền vững)')) {
      return;
    }
    setApiError(null);
    try {
      if (workspaceMode === 'DEMO') {
        setLiveSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, status: 'PUBLISHED', publishedVersion: s.version } : s))
        );
        setApiSuccess('Demo: Đã công bố chính thức ca trực thành công.');
        return;
      }
      const pub = await apiClient.publishDutySchedule(scheduleId);
      setApiSuccess(`Đã công bố chính thức ca trực ngày ${pub.scheduleDate} tại phiên bản v${pub.version}.`);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi công bố ca trực.');
    }
  };

  // 17. Xem nội dung bài đăng Facebook (Chặng 15)
  const handleOpenFacebookViewModal = (content: string) => {
    setFacebookModalContent(content);
    setShowFacebookViewModal(true);
  };

  // 18. Mở xem chi tiết hồ sơ ứng viên (Chặng 16)
  const handleOpenApplicantDetail = (resp: RecruitmentResponseDetailDto) => {
    setSelectedResponseForDetail(resp);
    setShowResponseDetailModal(true);
  };

  // 19. Chạy đối soát bù đơn thiếu Google Form / Sheets (Chặng 16)
  const handleRunReconciliation = async () => {
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã chạy đối soát mô phỏng thành công (không lưu CSDL).');
      return;
    }

    setIsReconciling(true);
    setApiError(null);
    try {
      let payloads: any[] = [];
      try {
        payloads = JSON.parse(reconcileJsonInput);
      } catch {
        throw new Error('Dữ liệu JSON danh sách đơn đối soát không đúng định dạng mảng JSON.');
      }
      if (!Array.isArray(payloads)) {
        throw new Error('Dữ liệu JSON đối soát phải là một mảng [] các phản hồi đơn.');
      }
      const res = await apiClient.reconcileRecruitmentResponses({
        formId: reconcileFormId,
        observedPayloads: payloads,
      });
      setReconcileResult(res);
      setApiSuccess(`Đối soát thành công! Tổng quan sát: ${res.totalObserved}, nạp bù: ${res.missingBackfilledCount} đơn.`);
      const updatedList = await apiClient.listRecruitmentResponses({ formId: reconcileFormId });
      setLiveRecruitmentResponses(updatedList);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi chạy đối soát đơn tuyển dụng.');
    } finally {
      setIsReconciling(false);
    }
  };

  // 20. Mở Modal Chấm Điểm Phỏng Vấn & Bài Viết (Chặng 17)
  const handleOpenEvaluationModal = async (resp: RecruitmentResponseDetailDto) => {
    setSelectedResponseForEval(resp);
    setEvalScores({});
    setEvalNotes('');
    setEvalDecision('PENDING');
    setEditingEvalId(null);
    setEditingEvalExpectedVersion(1);
    setEvalEditReason('');
    setShowHistoryForEvalId(null);
    setEvalHistoryList([]);
    setShowEvaluationModal(true);

    if (workspaceMode === 'DEMO') {
      setCurrentRubric({
        id: 'DEMO_RUBRIC_GEN10',
        campaignId: 'CAMPAIGN_GEN_10',
        version: 1,
        title: 'Rubric Phỏng Vấn Demo',
        formulaType: 'WEIGHTED_SUM',
        isActive: true,
        createdAt: '2026-10-20T00:00:00.000Z',
        updatedAt: '2026-10-20T00:00:00.000Z',
        criteria: [
          { id: 'crit-att', rubricId: 'DEMO_RUBRIC_GEN10', code: 'ATTITUDE', name: 'Thái độ & Nhiệt huyết', minScore: 0, maxScore: 10, weight: 2.0, section: 'INTERVIEW', sortOrder: 1 },
          { id: 'crit-exp', rubricId: 'DEMO_RUBRIC_GEN10', code: 'EXPERIENCE', name: 'Kỹ năng & Kinh nghiệm', minScore: 0, maxScore: 10, weight: 1.5, section: 'INTERVIEW', sortOrder: 2 },
          { id: 'crit-ess', rubricId: 'DEMO_RUBRIC_GEN10', code: 'ESSAY', name: 'Bài viết cảm nhận', minScore: 0, maxScore: 10, weight: 1.0, section: 'ESSAY', sortOrder: 3 },
        ],
      });
      setEvalListForResponse([]);
      return;
    }

    try {
      try {
        const rubric = await apiClient.getRubric('RUBRIC_CAMPAIGN_GEN_10_V1');
        setCurrentRubric(rubric);
      } catch (rErr: any) {
        console.warn('Không thể tải rubric từ máy chủ:', rErr.message);
        setApiError(`Không thể tải tiêu chí chấm điểm từ máy chủ: ${rErr.message}`);
      }

      const evals = await apiClient.getResponseEvaluations(resp.id);
      setEvalListForResponse(evals);
    } catch (err: any) {
      console.warn('Lỗi khi tải danh sách đánh giá:', err.message);
    }
  };

  // 21. Lưu điểm đánh giá (Submit mới hoặc Edit có lý do/version)
  const handleSubmitEvaluation = async () => {
    if (!selectedResponseForEval || !currentRubric) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã ghi nhận điểm chấm độc lập mô phỏng.');
      setShowEvaluationModal(false);
      return;
    }

    setIsSubmittingEval(true);
    setApiError(null);

    try {
      if (editingEvalId) {
        if (!evalEditReason.trim()) {
          alert('Bắt buộc phải nhập lý do khi sửa đổi điểm đánh giá.');
          setIsSubmittingEval(false);
          return;
        }
        const res = await apiClient.editEvaluation(editingEvalId, {
          rawScores: evalScores,
          interviewNotes: evalNotes,
          decision: evalDecision,
          reason: evalEditReason.trim(),
          expectedVersion: editingEvalExpectedVersion,
        });
        setApiSuccess(`Đã cập nhật điểm đánh giá (phiên bản v${res.evaluation.version}).`);
        setEditingEvalId(null);
        setEvalEditReason('');
      } else {
        const res = await apiClient.submitEvaluation({
          responseId: selectedResponseForEval.id,
          rubricId: currentRubric.id,
          rawScores: evalScores,
          interviewNotes: evalNotes,
          decision: evalDecision,
        });
        setApiSuccess(`Đã ghi nhận điểm chấm độc lập thành công! Điểm: ${res.totalScore ?? 'Chưa xác định'}.`);
      }

      const evals = await apiClient.getResponseEvaluations(selectedResponseForEval.id);
      setEvalListForResponse(evals);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lưu điểm đánh giá.');
    } finally {
      setIsSubmittingEval(false);
    }
  };

  // 22. Xem lịch sử sửa điểm
  const handleViewEvalHistory = async (evalId: string) => {
    setShowHistoryForEvalId(evalId);
    try {
      const history = await apiClient.getEvaluationHistory(evalId);
      setEvalHistoryList(history);
    } catch (err: any) {
      console.warn('Lỗi tải lịch sử sửa điểm:', err.message);
    }
  };

  // 23. Mở Modal Tổng Kết Hội Đồng & Quyết Định
  const handleOpenDecisionModal = (resp: RecruitmentResponseDetailDto) => {
    setSelectedResponseForDecision(resp);
    setCommitteeDecisionChoice('PASSED');
    setAssignedDeptChoice(resp.aspiration1 || 'BAN_HAU_CAN');
    setCommitteeNotesInput('');
    setDecisionRecord(null);
    setConvertedMemberId(null);
    setShowDecisionModal(true);
  };

  // 24. Chốt Quyết Định Hội Đồng
  const handleFinalizeDecision = async () => {
    if (!selectedResponseForDecision) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã ban hành quyết định tuyển dụng mô phỏng.');
      setShowDecisionModal(false);
      return;
    }

    setIsSubmittingDecision(true);
    setApiError(null);

    try {
      const dec = await apiClient.finalizeDecision({
        responseId: selectedResponseForDecision.id,
        decision: committeeDecisionChoice,
        assignedDepartment: assignedDeptChoice,
        committeeNotes: committeeNotesInput,
      });
      setDecisionRecord(dec);
      setApiSuccess(`Đã ban hành quyết định tuyển dụng: ${dec.decision} (Phân ban ${dec.assignedDepartment}).`);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi chốt quyết định tuyển dụng.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // 25. Chuyển Đổi Thành Viên Idempotent (Retry-Safe)
  const handleConvertMember = async () => {
    if (!selectedResponseForDecision) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã mô phỏng chuyển đổi thành viên.');
      return;
    }

    setIsConvertingMember(true);
    setApiError(null);

    try {
      const result = await apiClient.convertApplicantToMember(selectedResponseForDecision.id);
      setConvertedMemberId(result.member.id);
      if (result.isAlreadyConverted) {
        setApiSuccess(`Ứng viên đã được chuyển thành viên trước đó (Mã: ${result.member.id}). Không tạo thành viên trùng lặp.`);
      } else {
        setApiSuccess(`Đã tiếp nhận ứng viên trúng tuyển thành cộng tác viên thử thách 1 tháng! Mã: ${result.member.id}, Tên: ${result.member.fullName}.`);
      }
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi chuyển đổi thành viên.');
    } finally {
      setIsConvertingMember(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // HANDLERS FOR STAGE 18: BOOK SALES & CONSIGNMENT
  // ═════════════════════════════════════════════════════════════════════════

  const handleCreateSupplier = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newSupplierCode || !newSupplierName) {
      alert('Vui lòng nhập mã và tên nhà sách.');
      return;
    }
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã tạo đối tác nhà sách: ${newSupplierName}`);
      setShowCreateSupplierModal(false);
      return;
    }
    try {
      setIsSubmitting(true);
      const sup = await apiClient.createSupplier({
        code: newSupplierCode,
        name: newSupplierName,
        contactPerson: newSupplierContact,
        phone: newSupplierPhone,
      });
      setApiSuccess(`Đã tạo đối tác nhà sách: ${sup.name} (${sup.code})`);
      setShowCreateSupplierModal(false);
      setNewSupplierCode('');
      setNewSupplierName('');
      setNewSupplierContact('');
      setNewSupplierPhone('');
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tạo nhà sách.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLot = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newLotBatchCode || !newLotSupplierId || !newLotCampaign || !newLotBookTitle) {
      alert('Vui lòng nhập đầy đủ thông tin lô và đầu sách.');
      return;
    }
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã tiếp nhận lô sách mới: ${newLotBatchCode}`);
      setShowCreateLotModal(false);
      return;
    }
    try {
      setIsSubmitting(true);
      const lot = await apiClient.createLot({
        batchCode: newLotBatchCode,
        supplierId: newLotSupplierId,
        campaignName: newLotCampaign,
        receivedDate: new Date().toISOString().split('T')[0],
        depositAmount: Number(newLotDeposit) || 0,
        depositPaymentConfirmed: Number(newLotDeposit) > 0 ? newLotDepositConfirmed : false,
        depositPaymentMethod: Number(newLotDeposit) > 0 && newLotDepositConfirmed ? newLotDepositPaymentMethod : undefined,
        items: [
          {
            bookTitle: newLotBookTitle,
            coverPrice: Number(newLotCoverPrice),
            importDiscountPercent: Number(newLotDiscount),
            retailPrice: Number(newLotRetailPrice),
            initialQuantity: Number(newLotQuantity),
          },
        ],
      });
      setApiSuccess(`Đã tiếp nhận lô sách mới: ${lot.batchCode} (${lot.campaignName})`);
      setShowCreateLotModal(false);
      setNewLotBatchCode('');
      setNewLotCampaign('');
      setNewLotDeposit(0);
      setNewLotDepositConfirmed(false);
      setNewLotBookTitle('');
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tiếp nhận lô sách.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSellModal = (lot: ConsignmentLotDto, item: ConsignmentLotItemDto) => {
    setSelectedLotForAction(lot);
    setSelectedLotItemForSale(item);
    setSaleQuantityInput(1);
    setSaleCustomerName('');
    setSalePaymentMethod('CASH');
    setSalePaymentConfirmed(false);
    setShowSellBookModal(true);
  };

  const handleExecuteSellBook = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedLotForAction || !selectedLotItemForSale) return;
    if (saleQuantityInput <= 0 || saleQuantityInput > selectedLotItemForSale.availableQuantity) {
      alert(`Số lượng bán phải từ 1 đến ${selectedLotItemForSale.availableQuantity}.`);
      return;
    }
    if (!salePaymentConfirmed) {
      alert('Bắt buộc xác nhận đã nhận đủ tiền thực tế từ khách mua sách (không cho nợ).');
      return;
    }
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Bán thành công ${saleQuantityInput} cuốn '${selectedLotItemForSale.bookTitle}'.`);
      setShowSellBookModal(false);
      return;
    }
    try {
      setIsSubmitting(true);
      const sellPayload = {
        lotItemId: selectedLotItemForSale.id,
        quantity: Number(saleQuantityInput),
        paymentMethod: salePaymentMethod,
        customerName: saleCustomerName,
        paymentConfirmed: true,
      };
      const key = getActionKey('SELL', selectedLotItemForSale.id, sellPayload);
      const res = await apiClient.sellBook(selectedLotForAction.id, {
        ...sellPayload,
        idempotencyKey: key,
      });
      const saleObj = res.sale || (res as any);
      setApiSuccess(`Bán thành công ${saleObj.quantity || saleQuantityInput} cuốn '${selectedLotItemForSale.bookTitle}', tổng thu ${formatVND(saleObj.totalAmount || 0)} (${saleObj.paymentMethod || salePaymentMethod}).`);
      actionKeyRegistry.clearKey('SELL', selectedLotItemForSale.id);
      setShowSellBookModal(false);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi ghi nhận bán sách.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenConsignmentReturnModal = (lot: ConsignmentLotDto, item: ConsignmentLotItemDto) => {
    setSelectedLotForAction(lot);
    setSelectedLotItemForSale(item);
    setReturnQuantityInput(item.availableQuantity);
    setReturnRecipientName('');
    setReturnProofNotes('');
    setShowReturnBooksModal(true);
  };

  const handleExecuteReturnBooks = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedLotForAction || !selectedLotItemForSale) return;
    if (returnQuantityInput <= 0 || returnQuantityInput > selectedLotItemForSale.availableQuantity) {
      alert(`Số lượng trả phải từ 1 đến ${selectedLotItemForSale.availableQuantity}.`);
      return;
    }
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Trả sách thành công ${returnQuantityInput} cuốn về nhà sách.`);
      setShowReturnBooksModal(false);
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await apiClient.returnBooks(selectedLotForAction.id, {
        lotItemId: selectedLotItemForSale.id,
        returnedQuantity: Number(returnQuantityInput),
        returnDate: new Date().toISOString().split('T')[0],
        recipientName: returnRecipientName,
        proofNotes: returnProofNotes,
      });
      const retObj = res.returnReceipt || (res as any);
      setApiSuccess(`Đã ghi nhận trả ${retObj.returnedQuantity || returnQuantityInput} cuốn dư về nhà sách (Mã: ${retObj.returnCode || 'YSBK-RET'}). Không tự động hoàn tiền.`);
      setShowReturnBooksModal(false);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi trả sách dư.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSettlementModal = async (lot: ConsignmentLotDto) => {
    setSelectedLotForAction(lot);
    try {
      const res = await apiClient.getLotSettlement(lot.id);
      setActiveSettlement(res.settlement || null);
      setSettlementPayments(res.payments || []);
      setSettlementPreview(res.preview || null);
      setShowSettlementModal(true);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lấy thông tin quyết toán.');
    }
  };

  const handleExecuteCreateSettlement = async () => {
    if (!selectedLotForAction) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã lập chứng từ quyết toán thử nghiệm.');
      return;
    }
    try {
      setIsSubmitting(true);
      const settlePayload = {
        lotId: selectedLotForAction.id,
        notes: `Quyết toán chính thức đợt ${selectedLotForAction.batchCode}`,
      };
      const key = getActionKey('SETTLEMENT', selectedLotForAction.id, settlePayload);
      const settle = await apiClient.createLotSettlement(selectedLotForAction.id, {
        notes: settlePayload.notes,
        idempotencyKey: key,
      });
      actionKeyRegistry.clearKey('SETTLEMENT', selectedLotForAction.id);
      setActiveSettlement(settle);
      setApiSuccess(`Lập quyết toán thành công cho lô ${selectedLotForAction.batchCode}! Phải trả: ${formatVND(settle.payableToSupplier)}, Cọc hoàn kỳ vọng: ${formatVND(settle.depositRefundExpected)}.`);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lập quyết toán.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSupplierPaymentModal = (type: 'PAY_SUPPLIER_PAYABLE' | 'RECEIVE_DEPOSIT_REFUND', amount: number) => {
    setSupplierPaymentType(type);
    setSupplierPaymentAmount(amount);
    setSupplierPaymentMethod('BANK_TRANSFER');
    setSupplierPaymentRefDoc('');
    setSupplierPaymentConfirmed(false);
    setSupplierPaymentNotes(type === 'PAY_SUPPLIER_PAYABLE' ? 'Thanh toán tiền sách bán cho nhà sách' : 'Nhận hoàn cọc từ nhà sách');
    setShowSupplierPaymentModal(true);
  };

  const handleExecuteSupplierPayment = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!activeSettlement) return;
    if (!supplierPaymentRefDoc.trim()) {
      alert('Vui lòng nhập mã chứng từ/tham chiếu thực tế (UNC, mã GD ngân hàng hoặc số phiếu chi).');
      return;
    }
    if (!supplierPaymentConfirmed) {
      alert('Vui lòng xác nhận giao dịch tiền thực tế đã hoàn tất.');
      return;
    }
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Ghi nhận giao dịch thành công: ${supplierPaymentType === 'PAY_SUPPLIER_PAYABLE' ? 'Thanh toán nhà sách' : 'Nhận hoàn cọc'} ${formatVND(supplierPaymentAmount)}.`);
      setShowSupplierPaymentModal(false);
      return;
    }
    try {
      setIsSubmitting(true);
      const suppPayPayload = {
        paymentType: supplierPaymentType,
        amount: supplierPaymentAmount,
        paymentMethod: supplierPaymentMethod,
        paymentConfirmed: true,
        referenceDoc: supplierPaymentRefDoc.trim(),
        notes: supplierPaymentNotes.trim() || undefined,
      };
      const key = getActionKey('SUPPLIER_PAYMENT', activeSettlement.id, suppPayPayload);
      const res = await apiClient.recordSupplierPayment(activeSettlement.id, {
        ...suppPayPayload,
        idempotencyKey: key,
      });
      actionKeyRegistry.clearKey('SUPPLIER_PAYMENT', activeSettlement.id);
      setActiveSettlement(res.settlement);
      setSettlementPayments(prev => [...prev, res.payment]);
      setApiSuccess(`Ghi nhận giao dịch thành công: ${supplierPaymentType === 'PAY_SUPPLIER_PAYABLE' ? 'Thanh toán nhà sách' : 'Nhận hoàn cọc'} ${formatVND(supplierPaymentAmount)}.`);
      setShowSupplierPaymentModal(false);
      await loadLiveData();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi ghi nhận thanh toán.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // HANDLERS FOR STAGE 19: EVENTS & ACTIVITIES (FR-06)
  const handleOpenEventDetailModal = async (eventId: string) => {
    try {
      setIsSubmitting(true);
      const detail = await apiClient.getEventDetail(eventId);
      setSelectedEventDetail(detail);
      setIsEventDetailModalOpen(true);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tải chi tiết sự kiện.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteCreateEvent = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã tạo thành công sự kiện: "${newEventTitle}"!`);
      setIsNewEventModalOpen(false);
      setNewEventTitle('');
      setNewEventDesc('');
      return;
    }
    try {
      setIsSubmitting(true);
      const created = await apiClient.createEvent({
        title: newEventTitle,
        description: newEventDesc,
        eventType: newEventType,
        eventDate: newEventDate,
        location: newEventLocation,
        budget: newEventBudget,
        isApprovedForPublic: newEventApprovedPublic,
        isApprovedForAlumni: newEventApprovedAlumni,
      });
      setLiveEvents(prev => [created, ...prev]);
      setApiSuccess(`Đã tạo thành công sự kiện: "${created.title}"!`);
      setIsNewEventModalOpen(false);
      setNewEventTitle('');
      setNewEventDesc('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tạo sự kiện mới.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteCreateTask = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedEventDetail) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã thêm nhiệm vụ: "${newTaskTitle}"!`);
      setIsNewTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      return;
    }
    try {
      setIsSubmitting(true);
      const task = await apiClient.createEventTask(selectedEventDetail.activity.id, {
        title: newTaskTitle,
        description: newTaskDesc,
        assigneeMemberId: newTaskAssignee || null,
        dueDate: newTaskDue || null,
        priority: newTaskPriority,
      });
      setSelectedEventDetail(prev => prev ? { ...prev, tasks: [...prev.tasks, task] } : null);
      setApiSuccess(`Đã thêm nhiệm vụ: "${task.title}"!`);
      setIsNewTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi thêm nhiệm vụ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteUpdateTask = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedEventDetail || !selectedTaskForEdit) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã cập nhật nhiệm vụ thử nghiệm!');
      setIsEditTaskModalOpen(false);
      setEditTaskReason('');
      return;
    }
    try {
      setIsSubmitting(true);
      const updated = await apiClient.updateEventTask(selectedEventDetail.activity.id, selectedTaskForEdit.id, {
        title: editTaskTitle || undefined,
        status: editTaskStatus,
        reason: editTaskReason,
      });
      setSelectedEventDetail(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t => t.id === updated.id ? updated : t),
      } : null);
      setApiSuccess(`Đã cập nhật nhiệm vụ kèm nhật ký kiểm toán!`);
      setIsEditTaskModalOpen(false);
      setEditTaskReason('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi cập nhật nhiệm vụ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTaskHistoryModal = async (taskId: string) => {
    if (!selectedEventDetail) return;
    try {
      setIsSubmitting(true);
      const hist = await apiClient.getEventTaskHistory(selectedEventDetail.activity.id, taskId);
      setTaskHistoryList(hist);
      setIsTaskHistoryModalOpen(true);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tải lịch sử sửa nhiệm vụ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteAddParticipant = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedEventDetail) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã thêm ${newParticipantType === 'MEMBER' ? 'thành viên' : 'khách ngoài (R07)'} vào sự kiện!`);
      setIsNewParticipantModalOpen(false);
      setNewParticipantGuestName('');
      return;
    }
    try {
      setIsSubmitting(true);
      const part = await apiClient.addEventParticipant(selectedEventDetail.activity.id, {
        participantType: newParticipantType,
        memberId: newParticipantType === 'MEMBER' ? newParticipantMemberId : undefined,
        guestName: newParticipantType === 'GUEST' ? newParticipantGuestName : undefined,
        guestEmail: newParticipantGuestEmail || undefined,
        guestPhone: newParticipantGuestPhone || undefined,
        role: newParticipantRole,
      });
      setSelectedEventDetail(prev => prev ? { ...prev, participants: [...prev.participants, part] } : null);
      setApiSuccess(`Đã thêm ${newParticipantType === 'MEMBER' ? 'thành viên' : 'khách ngoài (R07)'} vào sự kiện!`);
      setIsNewParticipantModalOpen(false);
      setNewParticipantGuestName('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi thêm người tham gia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteCreateBudgetItem = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedEventDetail) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã thêm khoản dự toán: ${formatVND(newBudgetAmount)}!`);
      setIsNewBudgetItemModalOpen(false);
      setNewBudgetDesc('');
      return;
    }
    try {
      setIsSubmitting(true);
      const b = await apiClient.createEventBudgetItem(selectedEventDetail.activity.id, {
        category: newBudgetCategory,
        description: newBudgetDesc,
        estimatedAmount: newBudgetAmount,
      });
      setSelectedEventDetail(prev => {
        if (!prev) return null;
        const newBudgetItems = [...prev.budgetItems, b];
        const totalBudget = newBudgetItems.reduce((acc, curr) => acc + curr.estimatedAmount, 0);
        return {
          ...prev,
          budgetItems: newBudgetItems,
          financialSummary: {
            ...prev.financialSummary,
            totalBudget,
            budgetVariance: totalBudget - prev.financialSummary.totalExpense,
          },
        };
      });
      setApiSuccess(`Đã thêm khoản dự toán: ${formatVND(b.estimatedAmount)}!`);
      setIsNewBudgetItemModalOpen(false);
      setNewBudgetDesc('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi lập dự toán.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteRecordExpense = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedEventDetail) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã ghi nhận chi phí thực tế ${formatVND(newExpenseAmount)}!`);
      setIsNewExpenseModalOpen(false);
      setNewExpenseDesc('');
      return;
    }
    try {
      setIsSubmitting(true);
      const exp = await apiClient.recordEventExpense(selectedEventDetail.activity.id, {
        description: newExpenseDesc,
        actualAmount: newExpenseAmount,
        expenseDate: newExpenseDate,
        payerMemberId: newExpensePayer || (actor?.memberId || actor?.userId || ''),
        paymentMethod: newExpenseMethod,
        receiptRef: newExpenseRef || undefined,
      });
      setSelectedEventDetail(prev => {
        if (!prev) return null;
        const newExpenses = [...prev.expenses, exp];
        const totalExpense = newExpenses.reduce((acc, curr) => acc + curr.actualAmount, 0);
        return {
          ...prev,
          expenses: newExpenses,
          financialSummary: {
            ...prev.financialSummary,
            totalExpense,
            budgetVariance: prev.financialSummary.totalBudget - totalExpense,
          },
        };
      });
      setApiSuccess(`Đã ghi nhận chi phí thực tế ${formatVND(exp.actualAmount)} liên kết sổ quỹ kép FUND_OPERATION!`);
      setIsNewExpenseModalOpen(false);
      setNewExpenseDesc('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi ghi nhận chi phí.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 20 Moderation Handlers
  const loadModerationReviews = async (statusFilter?: string) => {
    try {
      const res = await apiClient.getReviewsForModeration({
        status: statusFilter !== undefined ? statusFilter : (reviewStatusFilter || undefined),
      });
      setModerationReviews(res);
    } catch (err: any) {
      console.warn('Could not load moderation reviews:', err);
    }
  };

  const loadModerationPosts = async () => {
    try {
      const res = await apiClient.getPublicPosts();
      setModerationPosts(res as any);
    } catch (err: any) {
      console.warn('Could not load moderation posts:', err);
    }
  };

  const handleExecuteModerateReview = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedReviewForModerate) return;
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã cập nhật kiểm duyệt đánh giá: "${selectedReviewForModerate.authorName}" -> ${moderationDecision}!`);
      setShowModerateReviewModal(false);
      setSelectedReviewForModerate(null);
      setModerationNoteInput('');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await apiClient.moderateBookReview(selectedReviewForModerate.id, {
        decision: moderationDecision,
        moderationNote: moderationNoteInput || undefined,
      });
      setModerationReviews(prev => prev.map(r => r.id === res.id ? res : r));
      setApiSuccess(`Đã cập nhật kiểm duyệt đánh giá: "${res.authorName}" -> ${res.status}!`);
      setShowModerateReviewModal(false);
      setSelectedReviewForModerate(null);
      setModerationNoteInput('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi kiểm duyệt đánh giá.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteCreatePost = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (workspaceMode === 'DEMO') {
      setApiSuccess(`[DEMO] Đã tạo bản nháp bài viết: "${newPostTitle}"!`);
      setShowCreatePostModal(false);
      setNewPostTitle('');
      setNewPostSlug('');
      setNewPostSummary('');
      setNewPostContent('');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await apiClient.createPublicPost({
        title: newPostTitle,
        slug: newPostSlug || undefined,
        summary: newPostSummary,
        content: newPostContent,
        category: newPostCategory,
      });
      setModerationPosts(prev => [res, ...prev]);
      setApiSuccess(`Đã tạo bản nháp bài viết: "${res.title}"!`);
      setShowCreatePostModal(false);
      setNewPostTitle('');
      setNewPostSlug('');
      setNewPostSummary('');
      setNewPostContent('');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tạo bài viết.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecutePublishPost = async (postId: string) => {
    if (workspaceMode === 'DEMO') {
      setApiSuccess('[DEMO] Đã xuất bản bài viết lên cổng thông tin công khai!');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await apiClient.publishPublicPost(postId);
      setModerationPosts(prev => prev.map(p => p.id === postId ? res : p));
      setApiSuccess(`Đã xuất bản bài viết: "${res.title}" lên cổng thông tin công khai!`);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi xuất bản bài viết.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 21 Reporting & Audit Handlers
  const loadReportsData = async (periodOverride?: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL') => {
    try {
      const period = periodOverride || reportPeriod;
      const [fin, drill, circ] = await Promise.all([
        apiClient.getFinancialSummary({ period }),
        apiClient.getFinancialDrilldown({ period, limit: 50 }),
        apiClient.getCirculationSummary(),
      ]);
      setFinancialReportData(fin);
      setDrilldownItems(drill.items);
      setDrilldownTotalCount(drill.totalCount);
      setCirculationReportData(circ);
    } catch (err: any) {
      console.warn('Could not load reports data:', err);
    }
  };

  const loadAuditData = async () => {
    if (!isAdmin) return;
    try {
      const [logs, analytics] = await Promise.all([
        apiClient.getSystemAuditLogs({ limit: 50 }),
        apiClient.getAnalyticsSummary(),
      ]);
      setAuditLogsData(logs.items);
      setAuditLogsTotalCount(logs.totalCount);
      setAnalyticsData(analytics);
    } catch (err: any) {
      console.warn('Could not load audit data:', err);
    }
  };

  const handleDownloadCsvExport = async (
    reportType: 'FINANCIAL_SUMMARY' | 'CIRCULATION',
    format: 'CSV' | 'XML_EXCEL' | 'HTML' = 'CSV'
  ) => {
    if (workspaceMode === 'DEMO') {
      alert('Chế độ xem trước (DEMO) không tạo ticket xuất dữ liệu thực tế.');
      return;
    }
    try {
      setIsExporting(true);
      const ticket = await apiClient.createExportTicket(reportType, { period: reportPeriod }, format);
      const downloadUrl = apiClient.getExportDownloadUrl(ticket.ticket);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.setAttribute('download', '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setApiSuccess('Tải tệp báo cáo thành công.');
    } catch (err: any) {
      setApiError(err.message || 'Lỗi khi tải tệp báo cáo.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (activeModule === 'bao-cao') {
      loadReportsData();
    } else if (activeModule === 'admin') {
      loadAuditData();
    }
  }, [activeModule, reportPeriod]);

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER BLOCKS
  // ═════════════════════════════════════════════════════════════════════════

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F5EC] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#365E4B] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold font-serif text-[#35483C]">Đang xác thực phiên làm việc nội bộ YSBK...</p>
        <p className="text-xs text-[#64705C] mt-1">Đang kiểm tra cookie HttpOnly an toàn từ máy chủ</p>
      </div>
    );
  }

  // Not Authenticated in Live Mode
  if (workspaceMode === 'LIVE' && authError) {
    return (
      <div className="min-h-screen bg-[#F8F5EC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#FFFDF5] rounded-[22px] shadow-soft-modal border border-[#DCDED0] p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-[#F7E7DB] text-[#9B4D36] rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif font-bold text-[#35483C]">Yêu Cầu Xác Thực Nội Bộ</h2>
          <p className="text-xs text-[#64705C] leading-relaxed">{authError}</p>
          <div className="pt-2 flex flex-col gap-2">
            <a 
              href="/login" 
              className="w-full py-2.5 rounded-[14px] bg-[#365E4B] text-white text-xs font-bold hover:bg-[#294C3A] transition shadow-soft-btn"
            >
              Đến Trang Đăng Nhập (/login)
            </a>
            <button 
              hidden={!demoAllowed}
              onClick={() => { if(demoAllowed) setWorkspaceMode('DEMO'); }}
              className="w-full py-2.5 rounded-[14px] border border-[#A87A4C] bg-[#F4EAD2] text-[#A87A4C] text-xs font-bold hover:bg-[#EBDDBB] transition shadow-soft-btn"
            >
              Xem Thử Nghiệm Giao Diện (Fixture Demo)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ysbk-workspace min-h-screen bg-[#F8F5EC] flex flex-col font-sans text-[#35483C]">
      
      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODE BANNER (LIVE API vs FIXTURE DEMO)                    */}
      {/* ═════════════════════════════════════════════════════════ */}
      {workspaceMode === 'DEMO' ? (
        <div className="bg-[#F7E7DB] text-[#813C2A] px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between border-b border-[#9B4D36]/30 gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#9B4D36]" />
            <span>⚠️ CHẾ ĐỘ THỬ NGHIỆM GIAO DIỆN (FIXTURE DEMO) — Đang dùng dữ liệu mẫu cục bộ, KHÔNG kết nối cơ sở dữ liệu thật.</span>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="/?public=1" 
              className="px-3 py-1 bg-[#813C2A] text-white rounded-[10px] text-[11px] hover:bg-[#60281A] transition font-semibold shadow-xs"
            >
              Về Cổng Thông Tin
            </a>
            <button 
              onClick={() => setWorkspaceMode('LIVE')} 
              className="px-3 py-1 bg-ysbk-primary text-white rounded-[10px] text-[11px] hover:bg-[#294C3A] transition font-semibold shadow-xs"
            >
              Chuyển Sang Chế Độ Live API
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#E8EDDF] text-[#294C3A] px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-[#DCDED0] gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-ysbk-primary animate-pulse" />
            <span className="font-bold text-ysbk-primary">CHẾ ĐỘ LIVE API:</span>
            <span>
              Người dùng: <strong>{actor?.fullName || actor?.username || 'Thành viên'}</strong> · Quyền: <strong className="text-ysbk-primary">{actor?.role}</strong>
              {actor?.isCollaborator && <span className="text-[#64705C] ml-1">(Cộng tác viên)</span>}
              {actor?.isAlumni && <span className="text-[#813C2A] ml-1">(Cựu TV - Giới hạn xem)</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="/?public=1" 
              className="text-[11px] text-[#365E4B] hover:text-[#294C3A] font-semibold underline"
            >
              Về Cổng Thông Tin
            </a>
            <button 
              hidden={!demoAllowed}
              onClick={() => { if(demoAllowed) setWorkspaceMode('DEMO'); }}
              className="text-[11px] text-[#365E4B] hover:text-[#294C3A] font-semibold underline"
            >
              Xem Demo Fixture
            </button>
            <button 
              onClick={handleLogout}
              className="text-[11px] text-rose-700 hover:text-rose-900 underline flex items-center gap-1 font-semibold"
            >
              <LogOut className="w-3 h-3" />
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* API Feedback Alerts */}
      {apiError && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{apiError}</span>
          </div>
          <button onClick={() => setApiError(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {apiSuccess && (
        <div className="bg-[#E8EDDF] border-b border-[#365E4B]/20 text-[#294C3A] px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ysbk-primary shrink-0" />
            <span>{apiSuccess}</span>
          </div>
          <button onClick={() => setApiSuccess(null)} className="text-[#64705C] hover:text-[#35483C]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        
        {/* ═════════════════════════════════════════════════════════ */}
        {/* SIDEBAR NAVIGATION (Chuẩn 240px / Góc bo mềm)             */}
        {/* ═════════════════════════════════════════════════════════ */}
        {!isSidebarCollapsed&&<button className="workspace-drawer-backdrop fixed inset-0 z-40 bg-[#233127]/40 md:hidden" aria-label="Đóng menu nội bộ" onClick={()=>setIsSidebarCollapsed(true)}/>}
        <aside ref={sidebarRef} id="workspace-navigation" aria-label="Điều hướng nội bộ" className={`fixed inset-y-0 left-0 z-50 bg-[#FFFDF5] border-r border-[#DCDED0] flex flex-col transition-all duration-300 md:relative md:inset-auto md:z-auto ${isSidebarCollapsed ? 'w-0 hidden md:flex md:w-16' : 'w-[240px] shrink-0'}`}>
          <div className="h-16 px-4 border-b border-[#DCDED0] flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2.5">
                <img src="/book/assets/club-logo-v8.svg" alt="YSBK" className="h-8 w-auto" />
                <div className="flex flex-col">
                  <span className="font-serif font-bold text-sm text-[#35483C] leading-tight">YSBK Hà Nội</span>
                  <span className="text-[10px] text-[#64705C] leading-tight">Bàn Làm Việc Nội Bộ</span>
                </div>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-[10px] text-[#64705C] hover:text-[#35483C] hover:bg-[#E8EDDF]/40 mx-auto transition"
              title={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-xs" onClick={event=>{if((event.target as HTMLElement).closest('button')&&window.matchMedia('(max-width: 767px)').matches) setIsSidebarCollapsed(true);}}>
            {isAlumni ? (
              <div className="space-y-2">
                <div className="p-3 bg-[#F7E7DB]/60 rounded-[14px] border border-[#9B4D36]/20 text-[#813C2A] text-[11px] leading-relaxed">
                  <span className="font-bold">Chế độ Cựu Thành Viên:</span>
                  <p className="mt-1">Bạn có quyền xem thông tin hoạt động công khai. Toàn bộ thông tin tài chính, bạn đọc và nghiệp vụ quầy bị khóa theo ma trận quyền.</p>
                </div>
                <button
                  onClick={() => setActiveModule('cuu')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] bg-ysbk-terracotta text-white font-semibold shadow-soft-btn transition"
                >
                  <Award className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Bản Tin Cựu TV</span>}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setActiveModule('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'dashboard' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Tổng Quan (KPI)</span>}
                </button>

                {!isSidebarCollapsed && <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#64705C]">Bàn Sách & Quầy</div>}
                
                <button
                  onClick={() => setActiveModule('quay-sach')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'quay-sach' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0 text-ysbk-terracotta" />
                  {!isSidebarCollapsed && <span>Quầy Mượn – Trả</span>}
                </button>

                <button
                  onClick={() => setActiveModule('ban-sach')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'ban-sach' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0 text-ysbk-gold" />
                  {!isSidebarCollapsed && <span>Sách Mới & Ký Gửi</span>}
                </button>

                <button
                  onClick={() => setActiveModule('kho-sach')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'kho-sach' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Kho Sách (2 Kho)</span>}
                </button>

                {!isSidebarCollapsed && <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#64705C]">Tổ Chức & Nhân Sự</div>}

                <button
                  onClick={() => setActiveModule('thanh-vien')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'thanh-vien' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Hồ Sơ Thành Viên</span>}
                </button>

                <button
                  onClick={() => setActiveModule('truc-sach')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'truc-sach' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Lịch Trực Bàn Sách</span>}
                </button>

                <button
                  onClick={() => setActiveModule('tuyen')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'tuyen' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0 text-indigo-600" />
                  {!isSidebarCollapsed && <span>Tuyển Thành Viên (Google Form)</span>}
                </button>

                <button
                  onClick={() => setActiveModule('su-kien')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'su-kien' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <Award className="w-4 h-4 shrink-0 text-amber-500" />
                  {!isSidebarCollapsed && <span>Sự Kiện & Hoạt Động</span>}
                </button>

                <button
                  onClick={() => {
                    setActiveModule('kiem-duyet');
                    loadModerationReviews();
                    loadModerationPosts();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'kiem-duyet' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 text-sky-500" />
                  {!isSidebarCollapsed && <span>Kiểm Duyệt Review & Bài Viết</span>}
                </button>

                {!isSidebarCollapsed && <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#64705C]">Tài Chính & Báo Cáo</div>}

                <button
                  onClick={() => setActiveModule('tai-chinh')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'tai-chinh' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <Wallet className="w-4 h-4 shrink-0 text-emerald-700" />
                  {!isSidebarCollapsed && <span>Sổ Quỹ & Ca Trực</span>}
                </button>

                <button
                  onClick={() => setActiveModule('bao-cao')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                    activeModule === 'bao-cao' ? 'bg-ysbk-primary text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Báo Cáo & Đối Soát</span>}
                </button>

                {isAdmin && (
                  <>
                    {!isSidebarCollapsed && <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-rose-600">Hệ Thống (Admin)</div>}
                    <button
                      onClick={() => setActiveModule('admin')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition ${
                        activeModule === 'admin' ? 'bg-ysbk-terracotta text-white font-semibold shadow-soft-btn' : 'text-[#35483C] hover:bg-[#E8EDDF]/40'
                      }`}
                    >
                      <Settings className="w-4 h-4 shrink-0 text-rose-300" />
                      {!isSidebarCollapsed && <span>Quản Trị & Nội Dung</span>}
                    </button>
                  </>
                )}
              </>
            )}
          </nav>
        </aside>

        {/* ═════════════════════════════════════════════════════════ */}
        {/* WORKSPACE MAIN BODY                                      */}
        {/* ═════════════════════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col overflow-y-auto pb-20 md:pb-6">
          
          {/* Top Operational Status Header */}
          <div className="bg-[#FFFDF5] border-b border-[#DCDED0] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs">
              <button 
                ref={sidebarTriggerRef}
                aria-expanded={!isSidebarCollapsed}
                aria-controls="workspace-navigation"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="md:hidden p-2 rounded-[10px] bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0] shrink-0 transition"
                title="Mở/Đóng menu"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#64705C] hidden sm:inline">Trực quầy:</span>
              <span className="font-bold text-[#35483C] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-ysbk-terracotta shrink-0" />
                Thứ Ba, Thứ Năm (14:00 – 17:00, Sảnh TV Tạ Quang Bửu)
              </span>
              <span className="text-[#DCDED0] hidden sm:inline">|</span>
              
              {/* Cash Session Status */}
              {workspaceMode === 'LIVE' ? (
                liveSession && !liveSession.isClosed ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-[#35483C]">
                      Phiên đang mở ({formatVND(liveSession.expectedClosingCash)}) · Phụ trách: <strong>{liveSession.openedBy}</strong>
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[#813C2A] font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Hôm nay chưa mở ca quầy tiền mặt</span>
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${demoCashSession.isClosed ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="font-medium text-[#35483C]">
                    {demoCashSession.isClosed ? 'Đã đóng ca (Demo)' : `Quầy mở (Demo: ${formatVND(demoCashSession.expectedClosingCash)})`}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isAlumni && (
                <>
                  {workspaceMode === 'LIVE' ? (
                    liveSession && !liveSession.isClosed ? (
                      <button
                        onClick={() => setShowCloseSessionModal(true)}
                        className="px-3.5 py-2 rounded-[12px] text-xs font-semibold bg-[#F7E7DB] hover:bg-[#F0D5C3] text-[#813C2A] border border-[#9B4D36]/30 transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Kiểm Kê & Đóng Ca Quầy
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowOpenSessionModal(true)}
                        className="px-3.5 py-2 rounded-[12px] text-xs font-bold bg-ysbk-primary hover:bg-[#294C3A] text-white shadow-soft-btn transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Mở Ca Quầy Hôm Nay
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => setShowCloseSessionModal(true)}
                      className="px-3.5 py-2 rounded-[12px] text-xs font-semibold bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] transition"
                    >
                      Kiểm & Đóng Ca Quầy (Demo)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            
            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 1: BÀN SÁCH & MƯỢN TRẢ                             */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'quay-sach' && (
              <div className="space-y-6">
                
                {/* Metric Summary Cards */}
                {(() => {
                  const currentLoans = workspaceMode === 'LIVE' ? liveLoans : demoLoans;
                  const activeCount = currentLoans.filter(l => l.status === 'ACTIVE').length;
                  const overdueCount = currentLoans.filter(l => {
                    const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
                    return l.status === 'ACTIVE' && l.dueDate < todayStr;
                  }).length;
                  const totalDeposit = currentLoans.reduce((sum, l: any) => {
                    if (l.status === 'ACTIVE') {
                      if (l.items && Array.isArray(l.items)) {
                        return sum + l.items.reduce((s: number, it: any) => s + (it.depositSnapshot || 0), 0);
                      }
                      if (l.totalDepositAmount) {
                        return sum + Number(l.totalDepositAmount || 0);
                      }
                    }
                    return sum;
                  }, 0);
                  const cashInDrawer = workspaceMode === 'LIVE'
                    ? (liveSession ? liveSession.expectedClosingCash : 0)
                    : demoCashSession.expectedClosingCash;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#64705C]">Phiếu Đang Mượn</div>
                          <div className="font-serif text-2xl font-bold text-[#35483C] tnum mt-1">{activeCount}</div>
                          <div className="text-[11px] text-ysbk-primary font-medium mt-1">Đang trong hạn 14 ngày</div>
                        </div>
                        <div className="w-11 h-11 rounded-[14px] bg-[#E8EDDF] text-ysbk-primary flex items-center justify-center">
                          <BookOpen className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#64705C]">Phiếu Quá Hạn Phạt</div>
                          <div className="font-serif text-2xl font-bold text-rose-600 tnum mt-1">{overdueCount}</div>
                          <div className="text-[11px] text-rose-600 font-medium mt-1">1.000 ₫/ngày cả phiếu</div>
                        </div>
                        <div className="w-11 h-11 rounded-[14px] bg-rose-50 text-rose-600 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#64705C]">Tiền Cọc Đang Giữ</div>
                          <div className="font-serif text-2xl font-bold text-ysbk-primary tnum mt-1">{formatVND(totalDeposit)}</div>
                          <div className="text-[11px] text-[#64705C] font-medium mt-1">Nghĩa vụ hoàn lại bạn đọc</div>
                        </div>
                        <div className="w-11 h-11 rounded-[14px] bg-[#E8EDDF] text-ysbk-primary flex items-center justify-center">
                          <Wallet className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#64705C]">Tiền Mặt Hộp Quầy</div>
                          <div className="font-serif text-2xl font-bold text-emerald-700 tnum mt-1">{formatVND(cashInDrawer)}</div>
                          <div className="text-[11px] text-[#64705C] font-medium mt-1">
                            {liveSession ? `Đầu ca: ${formatVND(liveSession.openingCash)}` : 'Chưa mở ca hôm nay'}
                          </div>
                        </div>
                        <div className="w-11 h-11 rounded-[14px] bg-emerald-50 text-emerald-700 flex items-center justify-center">
                          <RotateCcw className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Desk Sub-Tabs (S12-03) */}
                <div className="flex flex-wrap items-center gap-2 border-b border-[#DCDED0] pb-2">
                  <button
                    onClick={() => setDeskSubTab('LOANS')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-[12px] transition flex items-center gap-1.5 ${
                      deskSubTab === 'LOANS'
                        ? 'bg-ysbk-primary text-white shadow-soft-btn'
                        : 'bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Phiếu Mượn Hiện Hành
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/30 text-current font-bold">
                      {workspaceMode === 'LIVE' ? liveLoans.length : demoLoans.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setDeskSubTab('PENDING_REFUNDS')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-[12px] transition flex items-center gap-1.5 ${
                      deskSubTab === 'PENDING_REFUNDS'
                        ? 'bg-ysbk-primary text-white shadow-soft-btn'
                        : 'bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0]'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5 text-ysbk-gold" />
                    Hoàn Cọc Chờ Chi (Refunds)
                    {livePendingRefunds.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                        {livePendingRefunds.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setDeskSubTab('PENDING_DEPOSITS')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-[12px] transition flex items-center gap-1.5 ${
                      deskSubTab === 'PENDING_DEPOSITS'
                        ? 'bg-ysbk-primary text-white shadow-soft-btn'
                        : 'bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0]'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-ysbk-primary" />
                    Cọc Mới Chờ Thu (T73)
                    {livePendingDeposits.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                        {livePendingDeposits.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setDeskSubTab('PENDING_FINES')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-[12px] transition flex items-center gap-1.5 ${
                      deskSubTab === 'PENDING_FINES'
                        ? 'bg-ysbk-primary text-white shadow-soft-btn'
                        : 'bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0]'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    Phạt Quá Hạn Chờ Thu
                    {livePendingFines.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                        {livePendingFines.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setDeskSubTab('RESERVATIONS');
                      fetchStaffReservations();
                    }}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-[12px] transition flex items-center gap-1.5 ${
                      deskSubTab === 'RESERVATIONS'
                        ? 'bg-ysbk-primary text-white shadow-soft-btn'
                        : 'bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-ysbk-primary" />
                    Đơn Giữ Chỗ Chờ Nhận
                    {staffReservations.filter((r: any) => r.status === 'HELD').length > 0 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-bold">
                        {staffReservations.filter((r: any) => r.status === 'HELD').length}
                      </span>
                    )}
                  </button>
                </div>

                {pendingQueuesError && deskSubTab !== 'LOANS' && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-[14px] text-xs flex items-center justify-between shadow-xs">
                    <span>⚠️ Lỗi tải dữ liệu hàng chờ từ máy chủ: {pendingQueuesError}</span>
                    <button
                      onClick={loadLiveData}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[10px] text-xs font-bold transition"
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                {deskSubTab === 'LOANS' && (
                  <>
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif font-bold text-lg text-[#35483C]">Danh Sách Phiếu Mượn Bàn Trực</h3>
                        <span className="text-xs text-[#64705C]">Tối đa 2 cuốn/phiếu · Hạn 14 ngày</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {liveSession && (
                          <button 
                            onClick={handleViewSessionSummary}
                            className="px-3.5 py-2 text-xs font-semibold rounded-[14px] border border-[#365E4B]/30 bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#294C3A] flex items-center gap-1.5 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-ysbk-primary" />
                            Đối Soát Ca Trực
                          </button>
                        )}
                        <button 
                          onClick={() => setShowCorrectionModal(true)}
                          className="px-3.5 py-2 text-xs font-semibold rounded-[14px] border border-[#DCDED0] hover:bg-[#E8EDDF]/40 text-[#35483C] flex items-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#64705C]" />
                          Sửa Sai Chứng Từ Sổ Cái
                        </button>
                        <button 
                          onClick={() => setShowNewLoanModal(true)}
                          className="px-4 py-2 text-xs font-bold rounded-[14px] bg-ysbk-primary hover:bg-[#294C3A] text-white shadow-soft-btn flex items-center gap-2 transition min-h-[38px]"
                        >
                          <Plus className="w-4 h-4" />
                          Lập Phiếu Mượn Mới (Max 2 Cuốn)
                        </button>
                      </div>
                    </div>

                    {/* Loans List: Desktop Table + Mobile Cards */}
                    {(() => {
                      const list = workspaceMode === 'LIVE' ? liveLoans : demoLoans;
                      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());

                      if (list.length === 0) {
                        return (
                          <div className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] p-8 text-center text-[#64705C] shadow-soft-card">
                            Chưa có phiếu mượn nào được ghi nhận.
                          </div>
                        );
                      }

                      return (
                        <>
                          {/* Desktop Table View */}
                          <div className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] overflow-hidden shadow-soft-card hidden md:block">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-[#F8F5EC] border-b border-[#DCDED0] text-[#64705C] font-semibold uppercase">
                                  <tr>
                                    <th className="py-3 px-4">Số Phiếu</th>
                                    <th className="py-3 px-4">Người Mượn (SV)</th>
                                    <th className="py-3 px-4 min-w-[280px]">Sách & Tiền Cọc Từng Cuốn</th>
                                    <th className="py-3 px-4">Hạn Trả (14 ngày)</th>
                                    <th className="py-3 px-4">Gia Hạn</th>
                                    <th className="py-3 px-4">Trạng Thái</th>
                                    <th className="py-3 px-4 text-right">Thao Tác Quầy</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#DCDED0]/60">
                                  {list.map((loan: any) => {
                                    const isOverdue = loan.status === 'ACTIVE' && loan.dueDate < todayStr;
                                    const borrowerName = loan.borrowerName || loan.borrower?.fullName || 'Bạn đọc';
                                    const borrowerStudentId = loan.borrowerStudentId || loan.borrower?.studentId || '';
                                    const borrowerPhone = loan.borrowerPhone || loan.borrower?.phone || '';
                                    const items = loan.items || [];
                                    const totalDep = items.reduce((s: number, it: any) => s + (it.depositSnapshot || 0), 0);

                                    return (
                                      <tr key={loan.id} className="hover:bg-[#F8F5EC]/80 transition">
                                        <td className="py-3.5 px-4 font-mono font-bold text-ysbk-primary">
                                          {loan.receiptNumber}
                                          {loan.precedingReceiptId && (
                                            <div className="text-[10px] text-amber-700 font-sans">
                                              ↳ Phiếu chuyển tiếp
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                          <div className="font-bold text-[#35483C]">{borrowerName}</div>
                                          <div className="text-[11px] text-[#64705C]">
                                            MSSV: {borrowerStudentId} {borrowerPhone ? `· SĐT: ${borrowerPhone}` : ''}
                                          </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                          <div className="space-y-1.5">
                                            {items.map((it: any) => (
                                              <div key={it.barcode} className="flex items-center justify-between gap-3 text-[11px]">
                                                <span className="font-medium text-[#35483C]">
                                                  · {it.title || it.bookTitle}
                                                  {it.isLost && <span className="text-rose-600 ml-1 font-bold">(Đã mất)</span>}
                                                  {it.returnedAt && <span className="text-[#64705C] ml-1">(Đã trả)</span>}
                                                </span>
                                                <span className="font-mono text-[#64705C] tnum">Cọc: {formatVND(it.depositSnapshot)}</span>
                                              </div>
                                            ))}
                                            <div className="text-[11px] font-bold text-ysbk-primary border-t border-[#DCDED0] pt-1">
                                              Tổng cọc: {formatVND(totalDep)}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                          <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-[#35483C]'}`}>
                                            {loan.dueDate}
                                          </div>
                                          <div className="text-[10px] text-[#64705C]">Mượn: {loan.borrowDate}</div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                          <span className="font-semibold text-[#35483C]">{loan.renewCount}/3 lần</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                          {loan.status === 'ACTIVE' && !isOverdue && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDDF] text-[#294C3A] border border-[#365E4B]/20">
                                              Đang mượn
                                            </span>
                                          )}
                                          {loan.status === 'ACTIVE' && isOverdue && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F7E7DB] text-[#813C2A] border border-[#9B4D36]/20">
                                              Quá hạn (Phạt 1k/ngày)
                                            </span>
                                          )}
                                          {loan.status === 'RETURNED' && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F8F5EC] text-[#64705C] border border-[#DCDED0]">
                                              Đã tất toán
                                            </span>
                                          )}
                                          {loan.status === 'PARTIAL_SETTLED' && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDDF] text-[#365E4B] border border-[#365E4B]/20">
                                              Đã chuyển tiếp
                                            </span>
                                          )}
                                          {loan.status === 'PENDING_DEPOSIT' && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4EAD2] text-[#785420] border border-[#A87A4C]/20">
                                              Chờ nộp cọc mới
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                          {loan.status === 'ACTIVE' && (
                                            <div className="flex items-center justify-end gap-1.5">
                                              <button
                                                onClick={() => handleOpenReturnModal(loan)}
                                                className="px-3 py-1.5 rounded-[10px] text-xs font-bold bg-ysbk-primary text-white hover:bg-[#294C3A] transition shadow-xs"
                                              >
                                                Trả / Chuyển
                                              </button>
                                              <button
                                                onClick={() => handleOpenRenewModal(loan)}
                                                className="px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] transition"
                                              >
                                                Gia hạn
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setSelectedLoanForLoss(loan);
                                                  const activeItems = items.filter((it: any) => !it.returnedAt && !it.isLost);
                                                  if (activeItems.length > 0) {
                                                    setLossSelectedBarcode(activeItems[0].barcode);
                                                  }
                                                  setShowLossModal(true);
                                                }}
                                                className="px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                                              >
                                                Mất sách
                                              </button>
                                            </div>
                                          )}
                                          {loan.status === 'PENDING_DEPOSIT' && (
                                            <div className="flex items-center justify-end gap-1.5">
                                              <button
                                                onClick={() => {
                                                  setShowConfirmDepositModal({ isOpen: true, loan });
                                                  setDepositConfirmedT73(false);
                                                }}
                                                className="px-3 py-1.5 rounded-[10px] text-xs font-bold bg-ysbk-terracotta text-white hover:bg-[#813C2A] transition shadow-xs"
                                              >
                                                Thu cọc mới T73
                                              </button>
                                            </div>
                                          )}
                                          {(loan.status === 'RETURNED' || loan.status === 'PARTIAL_SETTLED') && (
                                            <div className="flex items-center justify-end gap-1.5">
                                              <button
                                                onClick={() => handleViewSettlementDetail(loan.id)}
                                                className="px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] transition"
                                              >
                                                Xem Quyết Toán
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Mobile Ticket Cards View */}
                          <div className="md:hidden space-y-4">
                            {list.map((loan: any) => {
                              const isOverdue = loan.status === 'ACTIVE' && loan.dueDate < todayStr;
                              const borrowerName = loan.borrowerName || loan.borrower?.fullName || 'Bạn đọc';
                              const borrowerStudentId = loan.borrowerStudentId || loan.borrower?.studentId || '';
                              const borrowerPhone = loan.borrowerPhone || loan.borrower?.phone || '';
                              const items = loan.items || [];
                              const totalDep = items.reduce((s: number, it: any) => s + (it.depositSnapshot || 0), 0);

                              return (
                                <div key={loan.id} className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] p-5 shadow-soft-card space-y-3">
                                  <div className="flex items-center justify-between pb-3 border-b border-[#DCDED0]">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-sm text-ysbk-primary">{loan.receiptNumber}</span>
                                        {loan.parentLoanId && (
                                          <span className="text-[10px] text-ysbk-primary font-medium bg-[#E8EDDF] px-2 py-0.5 rounded-full">
                                            ↳ Chuyển tiếp
                                          </span>
                                        )}
                                      </div>
                                      <div className="font-semibold text-sm text-[#35483C]">{borrowerName}</div>
                                      <div className="text-[11px] text-[#64705C]">MSSV: {borrowerStudentId} {borrowerPhone ? `· SĐT: ${borrowerPhone}` : ''}</div>
                                    </div>
                                    <div className="text-right">
                                      {loan.status === 'ACTIVE' && !isOverdue && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDDF] text-[#294C3A] border border-[#365E4B]/20">
                                          Đang mượn
                                        </span>
                                      )}
                                      {loan.status === 'ACTIVE' && isOverdue && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F7E7DB] text-[#813C2A] border border-[#9B4D36]/20">
                                          Quá hạn (Phạt 1k/ngày)
                                        </span>
                                      )}
                                      {loan.status === 'RETURNED' && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F8F5EC] text-[#64705C] border border-[#DCDED0]">
                                          Đã tất toán
                                        </span>
                                      )}
                                      {loan.status === 'PARTIAL_SETTLED' && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDDF] text-[#365E4B] border border-[#365E4B]/20">
                                          Đã chuyển tiếp
                                        </span>
                                      )}
                                      {loan.status === 'PENDING_DEPOSIT' && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4EAD2] text-[#785420] border border-[#A87A4C]/20">
                                          Chờ nộp cọc mới
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 text-xs">
                                    <div className="text-[11px] font-semibold text-[#64705C]">Sách mượn:</div>
                                    {items.map((it: any) => (
                                      <div key={it.barcode} className="flex items-center justify-between gap-2 text-xs py-0.5">
                                        <span className="font-medium text-[#35483C]">
                                          · {it.title || it.bookTitle}
                                          {it.isLost && <span className="text-rose-600 ml-1 font-bold">(Đã mất)</span>}
                                          {it.returnedAt && <span className="text-[#64705C] ml-1">(Đã trả)</span>}
                                        </span>
                                        <span className="font-mono text-[#64705C] shrink-0 tnum">Cọc: {formatVND(it.depositSnapshot)}</span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between font-bold text-xs pt-1 border-t border-[#DCDED0] text-ysbk-primary">
                                      <span>Tổng tiền cọc:</span>
                                      <span className="font-mono tnum">{formatVND(totalDep)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs pt-1 text-[#64705C]">
                                      <span>Hạn trả:</span>
                                      <span className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-[#35483C]'}`}>
                                        {loan.dueDate} (Mượn: {loan.borrowDate} · Gia hạn: {loan.renewCount}/3)
                                      </span>
                                    </div>
                                  </div>

                                  {/* Mobile Actions 1-Touch */}
                                  <div className="pt-2 border-t border-[#DCDED0] flex flex-wrap gap-2">
                                    {loan.status === 'ACTIVE' && (
                                      <>
                                        <button
                                          onClick={() => handleOpenReturnModal(loan)}
                                          className="flex-1 min-h-[42px] py-2 px-3 rounded-[12px] text-xs font-bold bg-ysbk-primary text-white hover:bg-[#294C3A] transition text-center shadow-xs"
                                        >
                                          Trả / Chuyển
                                        </button>
                                        <button
                                          onClick={() => handleOpenRenewModal(loan)}
                                          className="min-h-[42px] py-2 px-3 rounded-[12px] text-xs font-semibold bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0] transition text-center"
                                        >
                                          Gia hạn
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedLoanForLoss(loan);
                                            const activeItems = items.filter((it: any) => !it.returnedAt && !it.isLost);
                                            if (activeItems.length > 0) setLossSelectedBarcode(activeItems[0].barcode);
                                            setShowLossModal(true);
                                          }}
                                          className="min-h-[42px] py-2 px-3 rounded-[12px] text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 transition text-center"
                                        >
                                          Mất sách
                                        </button>
                                      </>
                                    )}
                                    {loan.status === 'PENDING_DEPOSIT' && (
                                      <button
                                        onClick={() => {
                                          setShowConfirmDepositModal({ isOpen: true, loan });
                                          setDepositConfirmedT73(false);
                                        }}
                                        className="w-full min-h-[42px] py-2 px-3 rounded-[12px] text-xs font-bold bg-ysbk-terracotta text-white transition text-center"
                                      >
                                        Thu cọc mới T73
                                      </button>
                                    )}
                                    {(loan.status === 'RETURNED' || loan.status === 'PARTIAL_SETTLED') && (
                                      <button
                                        onClick={() => handleViewSettlementDetail(loan.id)}
                                        className="w-full min-h-[42px] py-2 px-3 rounded-[12px] text-xs font-semibold bg-[#E8EDDF] text-[#35483C] transition text-center"
                                      >
                                        Xem Quyết Toán
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

                {deskSubTab === 'PENDING_REFUNDS' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50/50">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-amber-600" />
                          Hàng Chờ Hoàn Cọc Chờ Xác Nhận (Refund Intents PENDING)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Bạn đọc đã trả sách vật lý thành công. Thủ thư cần kiểm tra số dư hộp tiền/app ngân hàng trước khi xác nhận hoàn cọc.
                        </p>
                      </div>
                      <button
                        onClick={loadLiveData}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Làm mới
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                          <tr>
                            <th className="py-3 px-4">Mã Ý Định</th>
                            <th className="py-3 px-4">Số Phiếu Mượn</th>
                            <th className="py-3 px-4">Bạn Đọc</th>
                            <th className="py-3 px-4">Tiền Hoàn Cọc</th>
                            <th className="py-3 px-4">Phương Thức</th>
                            <th className="py-3 px-4">Ngày Tạo</th>
                            <th className="py-3 px-4 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {livePendingRefunds.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400">
                                Không có ý định hoàn cọc nào đang chờ xử lý.
                              </td>
                            </tr>
                          ) : (
                            livePendingRefunds.map((refund) => (
                              <tr key={refund.id} className="hover:bg-slate-50/80 transition">
                                <td className="py-3 px-4 font-mono font-medium text-slate-600">
                                  {refund.id.slice(0, 13)}...
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-brand-navy">
                                  {refund.receiptNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">{refund.borrowerName}</div>
                                  <div className="text-[11px] text-slate-400">MSSV: {refund.borrowerStudentId}</div>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-sm">
                                  {formatVND(refund.amount)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    refund.refundMethod === 'CASH' || refund.refundMethod === 'TIEN_MAT'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}>
                                    {refund.refundMethod === 'CASH' || refund.refundMethod === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {refund.createdAt ? new Date(refund.createdAt).toLocaleString('vi-VN') : '—'}
                                </td>
                                <td className="py-3 px-4 text-right space-x-1.5">
                                  <button
                                    onClick={() => handleViewSettlementDetail(refund.receiptId)}
                                    className="px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                  >
                                    Xem Quyết Toán
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedRefundForConfirm(refund);
                                      setConfirmRefundMethod(refund.refundMethod === 'CHUYEN_KHOAN' || refund.refundMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH');
                                      setConfirmRefundPaymentConfirmed(false);
                                      setShowConfirmRefundModal(true);
                                    }}
                                    className="px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                                  >
                                    Xác Nhận Chi Hoàn
                                  </button>
                                  <button
                                    onClick={() => handleExecuteCancelRefund(refund.id)}
                                    className="px-2.5 py-1.5 rounded text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                                  >
                                    Hủy
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {deskSubTab === 'PENDING_DEPOSITS' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50/50">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-blue-600" />
                          Hàng Chờ Nộp Cọc Mới Cho Sách Giữ Lại (T73 Pending Deposit)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Phiếu mượn chuyển tiếp khi trả 1 phần mà toàn bộ cọc cũ bị giữ lại làm phạt. Cần thu đủ cọc mới để kích hoạt phiếu.
                        </p>
                      </div>
                      <button
                        onClick={loadLiveData}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Làm mới
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                          <tr>
                            <th className="py-3 px-4">Số Phiếu Mới</th>
                            <th className="py-3 px-4">Bạn Đọc</th>
                            <th className="py-3 px-4">Cuốn Sách Giữ Lại</th>
                            <th className="py-3 px-4">Tiền Cọc Cần Nộp</th>
                            <th className="py-3 px-4">Hạn Mượn Mới</th>
                            <th className="py-3 px-4 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {livePendingDeposits.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                Không có phiếu mượn nào đang chờ nộp cọc mới.
                              </td>
                            </tr>
                          ) : (
                            livePendingDeposits.map((item) => (
                              <tr key={item.receiptId} className="hover:bg-slate-50/80 transition">
                                <td className="py-3 px-4 font-mono font-bold text-brand-navy">
                                  {item.receiptNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">{item.borrowerName}</div>
                                  <div className="text-[11px] text-slate-400">MSSV: {item.borrowerStudentId}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-slate-800">{item.title}</span>
                                  <span className="font-mono text-slate-500 ml-1.5">({item.barcode})</span>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-brand-navy text-sm">
                                  {formatVND(item.requiredDeposit)}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600">
                                  {item.dueDate}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setShowConfirmDepositModal({
                                        isOpen: true,
                                        loan: {
                                          id: item.receiptId,
                                          receiptNumber: item.receiptNumber,
                                          borrowerName: item.borrowerName,
                                          borrowerStudentId: item.borrowerStudentId,
                                          totalDepositAmount: item.requiredDeposit,
                                          totalDeposit: item.requiredDeposit,
                                        } as any,
                                      });
                                      setDepositConfirmedT73(false);
                                    }}
                                    className="px-3 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
                                  >
                                    Thu Cọc Mới T73
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {deskSubTab === 'PENDING_FINES' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-rose-50/50">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          Hàng Chờ Thu Tiền Phạt Quá Hạn (Pending Fines)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Các khoản phạt phát sinh khi trả sách hoặc gia hạn chưa hoàn tất nộp tiền.
                        </p>
                      </div>
                      <button
                        onClick={loadLiveData}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Làm mới
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                          <tr>
                            <th className="py-3 px-4">Số Phiếu Mượn</th>
                            <th className="py-3 px-4">Bạn Đọc</th>
                            <th className="py-3 px-4">Tiền Phạt Còn Nợ</th>
                            <th className="py-3 px-4">Lý Do Nợ / Điều Chỉnh</th>
                            <th className="py-3 px-4">Ngày Quyết Toán</th>
                            <th className="py-3 px-4 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {livePendingFines.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                Không có khoản phạt nào đang nợ.
                              </td>
                            </tr>
                          ) : (
                            livePendingFines.map((fine) => (
                              <tr key={fine.settlementId} className="hover:bg-slate-50/80 transition">
                                <td className="py-3 px-4 font-mono font-bold text-brand-navy">
                                  {fine.receiptNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">{fine.borrowerName}</div>
                                  <div className="text-[11px] text-slate-400">MSSV: {fine.borrowerStudentId}</div>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-rose-700 text-sm">
                                  {formatVND(fine.pendingAmount)}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {fine.fineReason || 'Nợ phạt quá hạn'}
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {fine.settledAt ? new Date(fine.settledAt).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setShowPendingFineModal({
                                        isOpen: true,
                                        targetId: fine.targetId || fine.settlementId,
                                        loan: {
                                          id: fine.receiptId,
                                          receiptNumber: fine.receiptNumber,
                                          borrowerName: fine.borrowerName,
                                        } as any,
                                        amount: fine.pendingAmount,
                                      });
                                      setPendingFineConfirmed(false);
                                    }}
                                    className="px-3 py-1.5 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
                                  >
                                    Thu Tiền Phạt
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUBTAB 5: ĐƠN GIỮ CHỖ CHỜ NHẬN (PR-7) */}
                {deskSubTab === 'RESERVATIONS' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 bg-emerald-50/50">
                      <div>
                        <h3 className="font-bold text-sm text-brand-navy flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-600" />
                          Hàng Chờ Đơn Đặt Giữ Chỗ Sách (Công Khai)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Bạn đọc đặt trước công khai, đến quầy nhận sách trong thời gian ca trực.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <select
                          value={reservationFilterStatus}
                          onChange={(e) => {
                            setReservationFilterStatus(e.target.value);
                            setReservationPage(1);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                        >
                          <option value="HELD">Đang giữ chỗ (HELD)</option>
                          <option value="BORROWED">Đã bàn giao (BORROWED)</option>
                          <option value="RETURNED">Đã trả (RETURNED)</option>
                          <option value="EXPIRED">Hết hạn (EXPIRED)</option>
                          <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                          <option value="ALL">-- Tất cả trạng thái --</option>
                        </select>

                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            value={reservationSearchQuery}
                            onChange={(e) => { setReservationSearchQuery(e.target.value); setReservationPage(1); }}
                            placeholder="Mã đơn / SĐT / Tên..."
                            className="w-40 sm:w-48 pl-3 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <button
                          onClick={fetchStaffReservations}
                          disabled={isLoadingReservations}
                          className="px-3 py-1.5 bg-brand-navy hover:bg-brand-navy-hover text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isLoadingReservations ? 'animate-spin' : ''}`} />
                          Làm mới
                        </button>
                      </div>
                    </div>

                    {reservationAttentionCount > 0 && <div role="alert" className="p-4 bg-rose-50 text-rose-800 text-sm border-b border-rose-200">
                      Có {reservationAttentionCount} đơn trong bộ lọc không thể giao bản sách đang giữ. Gọi tên/SĐT trong danh sách để xác nhận hướng xử lý, sau đó hủy đơn nếu cần. Hệ thống không tự hủy hoặc gửi tin nhắn.
                    </div>}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                          <tr>
                            <th className="py-3 px-4">Mã Đơn</th>
                            <th className="py-3 px-4">Tác Phẩm & Mã Vạch</th>
                            <th className="py-3 px-4">Bạn Đọc Nhận</th>
                            <th className="py-3 px-4">Ca Trực Hẹn</th>
                            <th className="py-3 px-4">Hạn Giữ Chỗ</th>
                            <th className="py-3 px-4">Tiền Cọc</th>
                            <th className="py-3 px-4">Trạng Thái</th>
                            <th className="py-3 px-4 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {staffReservations.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400">
                                {isLoadingReservations ? 'Đang tải danh sách...' : 'Không có đơn đặt giữ chỗ nào phù hợp điều kiện lọc.'}
                              </td>
                            </tr>
                          ) : (
                            staffReservations.map((res: any) => {
                              const isHeld = res.status === 'HELD';
                              return (
                                <tr key={res.id} className="hover:bg-slate-50/80 transition">
                                  <td className="py-3 px-4 font-mono font-bold text-brand-navy">
                                    {res.code}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900">{res.bookTitle}</div>
                                    {res.fulfillmentIssue && <p className="text-rose-700 font-semibold mt-1">Sách không thể giao — cần gọi bạn đọc</p>}
                                    <div className="text-[11px] text-slate-500">
                                      {res.authorName || ''} · Mã vạch: <span className="font-mono font-semibold">{res.copyBarcode || 'Chưa gán'}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-800">{res.fullName || res.borrowerName || 'Khách vãng lai'}</div>
                                    <div className="text-[11px] font-mono text-slate-500">{res.phone}</div>
                                    {res.studentId && <div className="text-[10px] text-slate-400">MSSV: {res.studentId}</div>}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700">
                                    <div>{res.shiftDate}</div>
                                    <div className="text-[11px] text-slate-400">{res.shiftTime}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-rose-600">
                                      {res.expiresAt ? new Date(res.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {res.expiresAt ? new Date(res.expiresAt).toLocaleDateString('vi-VN') : ''}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-bold font-mono text-emerald-700 text-sm">
                                    {formatVND(res.estimatedDeposit)}
                                  </td>
                                  <td className="py-3 px-4">
                                    {res.status === 'HELD' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        Chờ nhận
                                      </span>
                                    )}
                                    {res.status === 'BORROWED' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                        Đã nhận sách
                                      </span>
                                    )}
                                    {res.status === 'RETURNED' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                                        Đã trả sách
                                      </span>
                                    )}
                                    {res.status === 'EXPIRED' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">
                                        Hết hạn
                                      </span>
                                    )}
                                    {res.status === 'CANCELLED' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                                        Đã hủy
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {isHeld ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => {
                                            setSelectedReservationForFulfill(res);
                                            setFulfillPaymentMethod('CASH');
                                            setFulfillPaymentConfirmed(false);
                                            setFulfillNotes('');
                                          }}
                                          disabled={Boolean(res.fulfillmentIssue)}
                                          className="px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm flex items-center gap-1"
                                        >
                                          <CheckCircle className="w-3.5 h-3.5" />
                                          Giao Sách & Thu Cọc
                                        </button>
                                        {workspaceMode === 'LIVE' && !res.fulfillmentIssue && <button className="px-2 py-1.5 rounded text-xs font-semibold text-rose-700 bg-rose-50"
                                          onClick={async () => {
                                            const reason = window.prompt('Lý do không thể giao cuốn này (mất/hỏng...). Bản sách sẽ chuyển chờ xử lý; đơn chưa bị hủy. Không nhập thông tin cá nhân.');
                                            if (!reason?.trim()) return;
                                            try { await apiClient.reportStaffReservationIssue(res.id, reason.trim()); await fetchStaffReservations(); }
                                            catch (err: any) { setApiError(err.message || 'Không báo được sự cố.'); }
                                          }}>Báo sự cố</button>}
                                        <button
                                          onClick={() => {
                                            setSelectedReservationForCancel(res);
                                            setCancelStaffReason('');
                                          }}
                                          className="px-2 py-1.5 rounded text-xs font-semibold bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition"
                                        >
                                          Hủy
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {workspaceMode === 'LIVE' && <div className="p-4 flex items-center justify-between text-xs text-slate-600">
                      <span>{reservationTotal} đơn · Trang {reservationPage} / {Math.max(1, Math.ceil(reservationTotal / 50))}</span>
                      <div className="flex gap-3">
                        <button disabled={reservationPage === 1} onClick={() => setReservationPage(p => p - 1)} className="disabled:opacity-40">Trang trước</button>
                        <button disabled={reservationPage * 50 >= reservationTotal} onClick={() => setReservationPage(p => p + 1)} className="disabled:opacity-40">Trang sau</button>
                      </div>
                    </div>}
                  </div>
                )}


                {/* Calling Reminder List */}
                {workspaceMode === 'DEMO' && <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-brand-red" />
                      Danh Sách Gọi Nhắc Bạn Đọc Gần Hạn / Quá Hạn
                    </h4>
                    <span className="text-xs text-slate-500">Chỉ hiển thị cho thành viên có quyền</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-800">Lê Thu Hương (MSSV: 20231234)</span>
                        <span className="text-slate-500 ml-2">— Cuốn: Clean Code (Hạn trả: 14 ngày)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-700">0912345678</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Nhắc hẹn trả sách
                        </span>
                      </div>
                    </div>
                  </div>
                </div>}
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 2: KHO SÁCH (2 Kho + Bàn trực)                     */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'kho-sach' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C]">Quản Lý Bản Sách & Vị Trí Kho</h3>
                    <p className="text-xs text-[#64705C] mt-0.5">Hai kho chính: Thư viện Tạ Quang Bửu & Văn phòng Hội Sinh viên + Bàn trực tạm</p>
                  </div>
                  <button 
                    onClick={() => setShowExportModal({ isOpen: true, type: 'EXCEL', title: 'Nhập Sách Mới Từ Excel' })}
                    className="px-3.5 py-2 text-xs font-semibold rounded-[14px] border border-[#DCDED0] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    Preview Import Excel
                  </button>
                </div>

                <div className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] overflow-hidden shadow-soft-card">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F5EC] border-b border-[#DCDED0] text-[#64705C] font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-4">Mã Bản Sách</th>
                        <th className="py-3 px-4 min-w-[220px]">Tên Đầu Sách</th>
                        <th className="py-3 px-4">Vị Trí Hiện Tại</th>
                        <th className="py-3 px-4">Giá Bìa Snapshot</th>
                        <th className="py-3 px-4">Mức Cọc Tự Động</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCDED0]/60">
                      {liveCopies.map((copy) => (
                        <tr key={copy.barcode} className="hover:bg-[#F8F5EC]/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-ysbk-primary">{copy.barcode}</td>
                          <td className="py-3.5 px-4 font-semibold text-[#35483C]">{copy.title || 'Đầu sách'}</td>
                          <td className="py-3.5 px-4">
                            {copy.location === 'BAN_TRUC_TAM' && <span className="font-medium text-blue-700">Bàn trực sảnh Thư viện TQB</span>}
                            {copy.location === 'KHO_THU_VIEN' && <span className="text-[#35483C]">Kho Thư viện Tạ Quang Bửu</span>}
                            {copy.location === 'KHO_HOI_SINH_VIEN' && <span className="text-[#35483C]">Kho VP Hội Sinh viên</span>}
                          </td>
                          <td className="py-3.5 px-4 font-mono tnum">
                            {copy.coverPrice ? formatVND(copy.coverPrice) : <span className="text-[#64705C] italic">Chưa có giá</span>}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-ysbk-primary tnum">
                            {formatVND(calculateDeposit(copy.coverPrice))}
                          </td>
                          <td className="py-3.5 px-4">
                            {copy.status === 'AVAILABLE' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDDF] text-[#294C3A]">
                                Sẵn sàng
                              </span>
                            )}
                            {copy.status === 'BORROWED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4EAD2] text-[#785420]">
                                Đang mượn
                              </span>
                            )}
                            {copy.status === 'LOST' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                                Đã mất
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 3: THÀNH VIÊN                                      */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'thanh-vien' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C]">Quản Lý Nhân Sự & Hội Phí 4 Ban (Chặng 13)</h3>
                    <p className="text-xs text-[#64705C] mt-0.5">Mỗi thành viên có thể kiêm nhiệm nhiều ban. Hội phí 100k thu duy nhất 1 lần khi kết nạp.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-[12px] bg-[#E8EDDF] text-[#294C3A] text-xs font-semibold">
                      Tổng thực tế (Distinct): {memberHeadcount ? memberHeadcount.totalDistinctMembers : (liveMembers.length || INITIAL_MEMBERS.length)} bạn
                    </span>
                  </div>
                </div>

                {/* Headcount Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-[11px] text-[#64705C] font-semibold uppercase">Tổng Thành Viên</div>
                    <div className="font-serif text-2xl font-bold text-ysbk-primary mt-1">
                      {memberHeadcount ? memberHeadcount.totalDistinctMembers : (liveMembers.length || INITIAL_MEMBERS.length)}
                    </div>
                    <div className="text-[10px] text-[#64705C] mt-0.5">Không đếm trùng</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-[11px] text-blue-700 font-semibold uppercase">Ban Hậu Cần</div>
                    <div className="font-serif text-2xl font-bold text-blue-800 mt-1">
                      {memberHeadcount ? memberHeadcount.departments.BAN_HAU_CAN : 2}
                    </div>
                    <div className="text-[10px] text-blue-600 mt-0.5">Kho sách & ca trực</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-[11px] text-emerald-700 font-semibold uppercase">Ban Nội Dung</div>
                    <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">
                      {memberHeadcount ? memberHeadcount.departments.BAN_NOI_DUNG : 1}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">Review & Tọa đàm</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-[11px] text-purple-700 font-semibold uppercase">Ban TT & ĐN</div>
                    <div className="font-serif text-2xl font-bold text-purple-800 mt-1">
                      {memberHeadcount ? memberHeadcount.departments.BAN_TTDN : 1}
                    </div>
                    <div className="text-[10px] text-purple-600 mt-0.5">Fanpage & Tài trợ</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-[11px] text-[#813C2A] font-semibold uppercase">Ban Chủ Nhiệm</div>
                    <div className="font-serif text-2xl font-bold text-[#813C2A] mt-1">
                      {memberHeadcount ? memberHeadcount.departments.BAN_CHU_NHIEM : 1}
                    </div>
                    <div className="text-[10px] text-[#813C2A]/80 mt-0.5">Điều hành chung</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-[11px] text-amber-700 font-semibold uppercase">Kiêm Nhiệm</div>
                    <div className="font-serif text-2xl font-bold text-amber-800 mt-1">
                      {memberHeadcount ? memberHeadcount.multiDepartmentMemberCount : 0}
                    </div>
                    <div className="text-[10px] text-amber-600 mt-0.5">Thuộc ≥ 2 ban</div>
                  </div>
                </div>

                {/* Member Directory */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(liveMembers.length > 0 ? liveMembers : INITIAL_MEMBERS.map((m, idx) => ({
                    id: m.id,
                    username: m.username,
                    fullName: m.fullName,
                    email: `${m.username}@ysbk.internal`,
                    phone: '090123456' + idx,
                    studentId: `202${idx}000${idx}`,
                    department: (m.team === 'HẬU CẦN' ? 'BAN_HAU_CAN' : m.team === 'NỘI DUNG' ? 'BAN_NOI_DUNG' : (m.team as string).includes('TRUYỀN THÔNG') ? 'BAN_TTDN' : 'BAN_CHU_NHIEM') as any,
                    role: (m.roleTitle.includes('Trưởng') ? 'TRUONG_BAN' : m.roleTitle.includes('Chủ nhiệm') ? 'CHU_NHIEM' : 'THANH_VIEN') as any,
                    status: 'ACTIVE' as const,
                    schoolYear: m.schoolYear,
                    hasPaidFee: idx % 2 === 0,
                    joinedAt: '2025-09-01',
                    createdAt: '2025-09-01',
                    updatedAt: '2025-09-01',
                  }))).map((m: any) => {
                    const deptLabel = 
                      (m.department === 'BAN_HAU_CAN' || m.department === 'HAU_CAN') ? 'Hậu Cần' :
                      (m.department === 'BAN_NOI_DUNG' || m.department === 'NOI_DUNG') ? 'Nội Dung' :
                      (m.department === 'BAN_TTDN' || m.department === 'TTDN') ? 'TT & Đối Ngoại' : 'Ban Chủ Nhiệm';
                    const deptBadgeColor = 
                      (m.department === 'BAN_HAU_CAN' || m.department === 'HAU_CAN') ? 'bg-blue-100 text-blue-800' :
                      (m.department === 'BAN_NOI_DUNG' || m.department === 'NOI_DUNG') ? 'bg-emerald-100 text-emerald-800' :
                      (m.department === 'BAN_TTDN' || m.department === 'TTDN') ? 'bg-purple-100 text-purple-800' : 'bg-[#F7E7DB] text-[#813C2A]';

                    const roleLabel =
                      m.role === 'CHU_NHIEM' ? 'Chủ Nhiệm' :
                      m.role === 'PHO_CHU_NHIEM' ? 'Phó Chủ Nhiệm' :
                      m.role === 'TRUONG_BAN' ? 'Trưởng Ban' :
                      m.role === 'PHO_BAN' ? 'Phó Ban' : 'Thành Viên';

                    return (
                      <div key={m.id} className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card space-y-3 text-xs flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="font-bold text-sm text-[#35483C]">{m.fullName}</div>
                              <div className="text-[#64705C] text-[11px]">
                                @{m.username} {m.studentId ? `· MSSV: ${m.studentId}` : ''} {m.schoolYear ? `· ${m.schoolYear}` : ''}
                              </div>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${deptBadgeColor}`}>
                              {deptLabel}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#DCDED0]">
                            <span className="text-[#64705C] font-medium">Chức vụ: <strong>{roleLabel}</strong></span>
                            {m.hasPaidFee ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8EDDF] text-[#294C3A] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Đã nộp 100k
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7E7DB] text-[#813C2A] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Chưa nộp hội phí
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCDED0]">
                          <button
                            type="button"
                            onClick={() => handleOpenAffiliationsModal(m)}
                            className="px-3 py-1.5 rounded-[12px] text-xs font-semibold bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] transition"
                          >
                            Lịch sử Ban
                          </button>
                          {!m.hasPaidFee && (
                            <button
                              type="button"
                              onClick={() => handleOpenCollectDuesModal(m)}
                              className="px-3 py-1.5 rounded-[12px] text-xs font-bold bg-ysbk-terracotta text-white hover:bg-[#813C2A] transition shadow-xs"
                            >
                              Thu Hội Phí 100k
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 4: LỊCH TRỰC                                       */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'truc-sach' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C]">Lịch Trực Bàn Sách Chiều Thứ Ba & Thứ Năm</h3>
                    <p className="text-xs text-[#64705C] mt-0.5">Khung giờ đón bạn đọc: 14:00 – 17:00 tại Sảnh Thư viện Tạ Quang Bửu (Thu dọn 17:00 - 17:15 [GIẢ ĐỊNH / CHƯA CHỐT POLICY])</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowGenerateScheduleModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-[14px] bg-ysbk-primary hover:bg-[#294C3A] text-white shadow-soft-btn flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Tạo Dự Thảo Lịch
                    </button>
                    <button 
                      onClick={() => setShowAvailabilityModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-[14px] border border-[#DCDED0] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] flex items-center gap-1.5 transition"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      Import Lịch Bận (Excel)
                    </button>
                    <button 
                      onClick={() => setShowFbPostModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-[14px] bg-ysbk-terracotta hover:bg-[#813C2A] text-white shadow-soft-btn flex items-center gap-1.5 transition"
                    >
                      <Copy className="w-4 h-4" />
                      Lấy Mẫu Đăng Facebook
                    </button>
                  </div>
                </div>

                {liveSchedules.length === 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#F4EAD2]/50 border border-[#A87A4C]/30 rounded-[16px] text-xs text-[#785420] flex items-center justify-between">
                      <div>
                        <strong>Chưa có lịch trực trong cơ sở dữ liệu:</strong> Đang hiển thị lịch mẫu (Demo fixtures).
                        Bấm <strong>"Tạo Dự Thảo Lịch"</strong> để chạy solver thuật toán xếp lịch tự động.
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {INITIAL_DUTY_SHIFTS.map((shift) => (
                        <div key={shift.id} className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card space-y-3 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-[#DCDED0]">
                            <span className="font-serif font-bold text-base text-[#35483C]">{shift.date} ({shift.dayOfWeek})</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8EDDF] text-[#294C3A]">
                              {shift.status}
                            </span>
                          </div>
                          <div className="space-y-1 text-[#64705C]">
                            <div>⏰ Thời gian: <span className="text-[#35483C]">{shift.mainTime}</span></div>
                            <div>📍 Địa điểm: <span className="text-[#35483C]">{shift.location}</span></div>
                            <div>👤 Trực chính: <strong className="text-[#35483C]">{shift.mainAssignees.join(', ')}</strong></div>
                            <div>👥 Hỗ trợ: <span className="text-[#35483C]">{shift.supportAssignees.join(', ')}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {liveSchedules.map((shift) => {
                      const dayLabel = shift.dayOfWeek === 'THU_BA' ? 'Thứ Ba' : 'Thứ Năm';
                      const mains = shift.assignees.filter((a) => a.dutyType === 'MAIN');
                      const supports = shift.assignees.filter((a) => a.dutyType === 'SUPPORT');
                      const roleMap: Record<string, string> = {
                        CASH_DRAWER: 'Kiểm tiền két',
                        CIRCULATION_LOG: 'Ghi sổ mượn trả',
                        BOOK_INTRO: 'Giới thiệu sách',
                        LOGISTICS_SETUP: 'Chuẩn bị & bàn giao',
                      };

                      return (
                        <div key={shift.id} className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card space-y-3 text-xs flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start pb-2 border-b border-[#DCDED0] gap-2">
                              <div>
                                <span className="font-serif font-bold text-base text-[#35483C]">{shift.scheduleDate} ({dayLabel})</span>
                                <div className="text-[10px] text-[#64705C] mt-0.5">
                                  Phiên bản: v{shift.version} {shift.publishedVersion ? `(Công bố: v${shift.publishedVersion})` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {shift.isManuallyEdited && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                                    Đã sửa tay
                                  </span>
                                )}
                                {shift.status === 'PUBLISHED' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8EDDF] text-[#294C3A] flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Đã công bố
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4EAD2] text-[#785420] flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Dự thảo
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Cảnh báo thiếu nhân sự riêng biệt (R11) */}
                            {shift.warningMain && (
                              <div className="p-2.5 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                {shift.warningMain}
                              </div>
                            )}
                            {shift.warningSupport && (
                              <div className="p-2.5 rounded-[12px] bg-[#F7E7DB] border border-[#9B4D36]/20 text-[#813C2A] text-[11px] font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-ysbk-terracotta shrink-0" />
                                {shift.warningSupport}
                              </div>
                            )}

                            <div className="space-y-1.5 text-[#64705C] pt-1">
                              <div>⏰ Thời gian: <span className="text-[#35483C] font-medium">{shift.shiftTime}</span></div>
                              <div>📍 Địa điểm: <span className="text-[#35483C] font-medium">{shift.location}</span></div>
                              <div>
                                👤 Trực chính ({mains.length}/2):
                                <div className="mt-1 space-y-1 pl-2 border-l-2 border-[#DCDED0]">
                                  {mains.length === 0 ? (
                                    <span className="text-rose-600 italic">Chưa có người trực chính đủ điều kiện!</span>
                                  ) : (
                                    mains.map((m) => (
                                      <div key={m.id} className="text-[#35483C]">
                                        <strong>{m.memberName || m.memberId}</strong>
                                        <span className="ml-1 text-[11px] text-[#64705C] font-normal">
                                          ({roleMap[m.assignedRole] || m.assignedRole})
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div>
                                👥 Hỗ trợ ({supports.length}/3-5):
                                <div className="mt-1 space-y-1 pl-2 border-l-2 border-[#DCDED0]">
                                  {supports.length === 0 ? (
                                    <span className="text-amber-700 italic">Chưa có người trực hỗ trợ!</span>
                                  ) : (
                                    supports.map((s) => (
                                      <div key={s.id} className="text-[#35483C]">
                                        {s.memberName || s.memberId}
                                        <span className="ml-1 text-[11px] text-[#64705C]">
                                          ({roleMap[s.assignedRole] || s.assignedRole})
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-1.5 pt-3 border-t border-[#DCDED0]">
                            {shift.facebookPostContent && (
                              <button
                                type="button"
                                onClick={() => handleOpenFacebookViewModal(shift.facebookPostContent!)}
                                className="px-2.5 py-1.5 rounded-[10px] text-[11px] font-semibold bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] flex items-center gap-1 transition"
                              >
                                <Copy className="w-3 h-3" /> Mẫu FB
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenManualEditModal(shift)}
                              className="px-3 py-1.5 rounded-[10px] text-[11px] font-semibold bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] border border-[#DCDED0] transition"
                            >
                              Chỉnh sửa tay
                            </button>
                            {shift.status === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => handlePublishSchedule(shift.id)}
                                className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold bg-ysbk-primary hover:bg-[#294C3A] text-white transition shadow-xs flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" /> Công bố
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 5: TUYỂN THÀNH VIÊN (CHẶNG 16)                      */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'tuyen' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C]">Tiếp Nhận & Đối Soát Đơn Tuyển Thành Viên (Chặng 16)</h3>
                    <p className="text-xs text-[#64705C] mt-0.5">
                      Tự động tiếp nhận webhook Google Form (HMAC-SHA256), khóa nguồn FormID + ResponseID, phân tách dữ liệu nguồn với điểm chấm.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowReconcileModal(true)}
                      className="px-4 py-2 text-xs font-semibold rounded-[14px] bg-ysbk-primary hover:bg-[#294C3A] text-white shadow-soft-btn flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Đối Soát Bù Đơn (Reconcile)
                    </button>
                  </div>
                </div>

                {/* Thống kê đơn theo ban */}
                {(() => {
                  const total = liveRecruitmentResponses.length;
                  const hcCount = liveRecruitmentResponses.filter(r => r.aspiration1 === 'BAN_HAU_CAN').length;
                  const ndCount = liveRecruitmentResponses.filter(r => r.aspiration1 === 'BAN_NOI_DUNG').length;
                  const ttCount = liveRecruitmentResponses.filter(r => r.aspiration1 === 'BAN_TTDN').length;
                  const bcnCount = liveRecruitmentResponses.filter(r => r.aspiration1 === 'BAN_CHU_NHIEM').length;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-[11px] text-[#64705C] font-semibold uppercase">Tổng Đơn Đã Nhận</div>
                        <div className="font-serif text-2xl font-bold text-ysbk-primary mt-1">{total}</div>
                        <div className="text-[10px] text-[#64705C] mt-0.5">Đã commit bền</div>
                      </div>
                      <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-[11px] text-blue-700 font-semibold uppercase">Ban Hậu Cần (NV1)</div>
                        <div className="font-serif text-2xl font-bold text-blue-800 mt-1">{hcCount}</div>
                        <div className="text-[10px] text-blue-600 mt-0.5">Kho & bàn trực</div>
                      </div>
                      <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-[11px] text-emerald-700 font-semibold uppercase">Ban Nội Dung (NV1)</div>
                        <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">{ndCount}</div>
                        <div className="text-[10px] text-emerald-600 mt-0.5">Viết bài & tọa đàm</div>
                      </div>
                      <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-[11px] text-purple-700 font-semibold uppercase">Ban TT & ĐN (NV1)</div>
                        <div className="font-serif text-2xl font-bold text-purple-800 mt-1">{ttCount}</div>
                        <div className="text-[10px] text-purple-600 mt-0.5">Fanpage & tài trợ</div>
                      </div>
                      <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-[11px] text-[#813C2A] font-semibold uppercase">Ban Chủ Nhiệm (NV1)</div>
                        <div className="font-serif text-2xl font-bold text-[#813C2A] mt-1">{bcnCount}</div>
                        <div className="text-[10px] text-[#813C2A]/80 mt-0.5">Điều hành chung</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Danh sách đơn ứng tuyển */}
                <div className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] shadow-soft-card overflow-hidden text-xs">
                  <div className="p-4 border-b border-[#DCDED0] flex items-center justify-between bg-[#F8F5EC]">
                    <span className="font-serif font-bold text-sm text-[#35483C]">
                      Danh Sách Hồ Sơ Ứng Tuyển ({liveRecruitmentResponses.length} đơn)
                    </span>
                    <span className="text-[11px] text-[#64705C]">
                      Chỉ hiển thị cho thành viên nội bộ; dữ liệu công khai được bảo vệ PII
                    </span>
                  </div>

                  {liveRecruitmentResponses.length === 0 ? (
                    <div className="p-8 text-center text-[#64705C] space-y-2">
                      <UserPlus className="w-8 h-8 mx-auto text-[#64705C]/60" />
                      <p>Chưa có đơn ứng tuyển nào được đồng bộ vào hệ thống.</p>
                      <p className="text-[11px]">Bấm nút <strong>"Đối Soát Bù Đơn (Reconcile)"</strong> để nạp các đơn từ Google Form / Sheets.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#F8F5EC] text-[#64705C] font-semibold border-b border-[#DCDED0]">
                          <tr>
                            <th className="py-3 px-4">Họ và Tên</th>
                            <th className="py-3 px-4">Liên Hệ (Email / SĐT)</th>
                            <th className="py-3 px-4">Nguyện Vọng</th>
                            <th className="py-3 px-4">Thời Gian Nộp</th>
                            <th className="py-3 px-4">Trạng Thái</th>
                            <th className="py-3 px-4 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCDED0]/60">
                          {liveRecruitmentResponses.map((r) => {
                            const aspirationLabel = (asp: string) => {
                              if (asp === 'BAN_HAU_CAN') return 'Hậu Cần';
                              if (asp === 'BAN_NOI_DUNG') return 'Nội Dung';
                              if (asp === 'BAN_TTDN') return 'TT & ĐN';
                              if (asp === 'BAN_CHU_NHIEM') return 'Chủ Nhiệm';
                              return asp;
                            };

                            return (
                              <tr key={r.id} className="hover:bg-[#F8F5EC]/70 transition">
                                <td className="py-3 px-4 font-semibold text-[#35483C]">
                                  <div>{r.applicantName}</div>
                                  <div className="text-[10px] text-[#64705C] font-mono">
                                    {r.applicantStudentId ? `MSSV: ${r.applicantStudentId}` : `ID: ${r.responseId.slice(-8)}`}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-mono text-[#35483C]">{r.applicantEmail}</div>
                                  <div className="text-[#64705C] text-[11px]">{r.applicantPhone || '—'}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-wrap gap-1">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                      NV1: {aspirationLabel(r.aspiration1)}
                                    </span>
                                    {r.aspiration2 && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E8EDDF] text-[#35483C]">
                                        NV2: {aspirationLabel(r.aspiration2)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-[#64705C] font-mono text-[11px]">
                                  {new Date(r.submissionTimestamp).toLocaleString('vi-VN')}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8EDDF] text-[#294C3A] flex items-center gap-1 w-fit">
                                    <CheckCircle className="w-3 h-3" /> Đã đồng bộ
                                  </span>
                                  {r.version > 1 && (
                                    <span className="text-[10px] text-purple-600 ml-1">v{r.version}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenApplicantDetail(r)}
                                      className="px-2.5 py-1 rounded-[10px] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] font-semibold text-[11px] transition"
                                    >
                                      Xem Đơn
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(r)}
                                      className="px-2.5 py-1 rounded-[10px] bg-ysbk-primary text-white font-semibold text-[11px] hover:bg-[#294C3A] transition shadow-xs"
                                    >
                                      Chấm Điểm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDecisionModal(r)}
                                      className="px-2.5 py-1 rounded-[10px] bg-ysbk-terracotta text-white font-semibold text-[11px] hover:bg-[#813C2A] transition shadow-xs"
                                    >
                                      Hội Đồng
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 6: BÁN SÁCH MỚI & KÝ GỬI NHÀ SÁCH (CHẶNG 18)        */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'ban-sach' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C] flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-ysbk-gold" />
                      Quầy Sách Mới & Ký Gửi Nhà Sách (Chặng 18)
                    </h3>
                    <p className="text-xs text-[#64705C] mt-0.5">
                      Sách mới nhận theo lô từ nhà sách, bán tại quầy thu đủ tiền, trả sách dư vật lý và quyết toán nợ riêng biệt với hoàn cọc.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreateSupplierModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-[14px] border border-[#DCDED0] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] shadow-xs flex items-center gap-1.5 transition"
                    >
                      <Store className="w-4 h-4 text-[#64705C]" />
                      Thêm Nhà Sách
                    </button>
                    <button
                      onClick={() => setShowCreateLotModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-[14px] bg-ysbk-terracotta hover:bg-[#813C2A] text-white shadow-soft-btn flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Nhập Lô Sách Mới
                    </button>
                  </div>
                </div>

                {/* Thống kê tổng hợp bán sách */}
                {(() => {
                  let totalRevenue = 0;
                  let totalPayable = 0;
                  let totalDeposits = 0;

                  for (const lot of liveLots) {
                    totalDeposits += lot.depositAmount;
                    if (lot.items) {
                      for (const item of lot.items) {
                        totalRevenue += item.soldQuantity * item.retailPrice;
                        totalPayable += item.soldQuantity * item.importPrice;
                      }
                    }
                  }
                  const grossProfit = totalRevenue - totalPayable;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-xs font-semibold text-[#64705C]">Tổng Doanh Thu Bán Sách</div>
                        <div className="font-serif text-2xl font-bold text-emerald-700 tnum mt-1">{formatVND(totalRevenue)}</div>
                        <div className="text-[11px] text-[#64705C] font-medium mt-1">Đã thu đủ từ khách mua lẻ</div>
                      </div>

                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-xs font-semibold text-[#64705C]">Tiền Nợ Nhà Sách (Giá Vốn)</div>
                        <div className="font-serif text-2xl font-bold text-rose-600 tnum mt-1">{formatVND(totalPayable)}</div>
                        <div className="text-[11px] text-[#64705C] font-medium mt-1">Chỉ CLB nợ, thanh toán riêng</div>
                      </div>

                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-xs font-semibold text-[#64705C]">Chênh Lệch Gộp Dự Kiến</div>
                        <div className="font-serif text-2xl font-bold text-ysbk-primary tnum mt-1">{formatVND(grossProfit)}</div>
                        <div className="text-[11px] text-[#64705C] font-medium mt-1">Doanh thu trừ nợ nhà sách</div>
                      </div>

                      <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                        <div className="text-xs font-semibold text-[#64705C]">Cọc Nhà Sách Đã Chi</div>
                        <div className="font-serif text-2xl font-bold text-indigo-700 tnum mt-1">{formatVND(totalDeposits)}</div>
                        <div className="text-[11px] text-[#64705C] font-medium mt-1">Tách biệt hoàn toàn cọc bạn đọc</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Danh sách các lô sách ký gửi */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif font-bold text-base text-[#35483C]">Danh Sách Lô Sách Ký Gửi ({liveLots.length})</h4>
                    <span className="text-xs text-[#64705C]">Không lấy sách cho mượn để bán · Invariant: Nhận = Bán + Trả + Giữ + Khả dụng</span>
                  </div>

                  {liveLots.length === 0 ? (
                    <div className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] p-8 text-center text-[#64705C] shadow-soft-card">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-[#64705C]/60" />
                      <p className="text-xs">Chưa có lô sách ký gửi nào. Bấm "Nhập Lô Sách Mới" để tạo đợt nhận hàng.</p>
                    </div>
                  ) : (
                    liveLots.map((lot) => (
                      <div key={lot.id} className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] shadow-soft-card overflow-hidden text-xs">
                        <div className="p-4 bg-[#F8F5EC] border-b border-[#DCDED0] flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-[#35483C] text-sm bg-white border border-[#DCDED0] px-3 py-1 rounded-[10px] shadow-xs">
                              {lot.batchCode}
                            </span>
                            <div>
                              <div className="font-bold text-[#35483C] text-sm">{lot.campaignName}</div>
                              <div className="text-[11px] text-[#64705C]">
                                Nhà sách: <span className="font-semibold text-[#35483C]">{lot.supplierName || 'Đối tác'}</span> · Ngày nhận: {lot.receivedDate}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                              lot.status === 'SETTLED' ? 'bg-[#F8F5EC] text-[#64705C] border border-[#DCDED0]' : 'bg-[#E8EDDF] text-[#294C3A]'
                            }`}>
                              {lot.status === 'SETTLED' ? 'Đã Quyết Toán' : 'Đang Bán'}
                            </span>
                            {lot.depositAmount > 0 && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                Cọc: {formatVND(lot.depositAmount)} ({lot.depositStatus})
                              </span>
                            )}
                            <button
                              onClick={() => handleOpenSettlementModal(lot)}
                              className="px-3.5 py-1.5 rounded-[12px] bg-ysbk-primary hover:bg-[#294C3A] text-white font-semibold transition flex items-center gap-1 shadow-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Quyết Toán Lô
                            </button>
                          </div>
                        </div>

                        {/* Chi tiết từng dòng sách trong lô */}
                        <div className="p-4 overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#DCDED0] text-[11px] font-bold text-[#64705C] uppercase">
                                <th className="pb-2">Đầu Sách</th>
                                <th className="pb-2">Giá Bìa / CK Nhập</th>
                                <th className="pb-2">Giá Nhập / Giá Bán</th>
                                <th className="pb-2 text-center">Ban Đầu</th>
                                <th className="pb-2 text-center text-emerald-700">Đã Bán</th>
                                <th className="pb-2 text-center text-rose-700">Đã Trả</th>
                                <th className="pb-2 text-center text-amber-700">Giữ Lại</th>
                                <th className="pb-2 text-center font-bold text-ysbk-primary">Khả Dụng</th>
                                <th className="pb-2 text-right">Thao Tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#DCDED0]/60">
                              {(lot.items || []).map((item) => (
                                <tr key={item.id} className="hover:bg-[#F8F5EC]/70 transition">
                                  <td className="py-2.5 font-semibold text-[#35483C]">
                                    {item.bookTitle}
                                    {item.isbn && <span className="block text-[10px] text-[#64705C] font-mono">{item.isbn}</span>}
                                  </td>
                                  <td className="py-2.5">
                                    <div className="font-mono text-[#35483C]">{formatVND(item.coverPrice)}</div>
                                    <div className="text-[10px] text-[#64705C]">CK: {item.importDiscountPercent}%</div>
                                  </td>
                                  <td className="py-2.5">
                                    <div className="font-mono font-medium text-rose-700">Nhập: {formatVND(item.importPrice)}</div>
                                    <div className="font-mono font-medium text-emerald-700">Bán: {formatVND(item.retailPrice)}</div>
                                  </td>
                                  <td className="py-2.5 text-center font-mono font-bold text-[#35483C]">{item.initialQuantity}</td>
                                  <td className="py-2.5 text-center font-mono font-bold text-emerald-700">{item.soldQuantity}</td>
                                  <td className="py-2.5 text-center font-mono font-bold text-rose-700">{item.returnedQuantity}</td>
                                  <td className="py-2.5 text-center font-mono font-bold text-amber-700">{item.retainedQuantity}</td>
                                  <td className="py-2.5 text-center font-mono font-extrabold text-ysbk-primary bg-[#E8EDDF]/40 rounded-[6px]">
                                    {item.availableQuantity}
                                  </td>
                                  <td className="py-2.5 text-right space-x-1">
                                    {lot.status !== 'SETTLED' && item.availableQuantity > 0 && (
                                      <>
                                        <button
                                          onClick={() => handleOpenSellModal(lot, item)}
                                          className="px-2.5 py-1 rounded-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition"
                                        >
                                          Bán Sách
                                        </button>
                                        <button
                                          onClick={() => handleOpenConsignmentReturnModal(lot, item)}
                                          className="px-2.5 py-1 rounded-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition"
                                        >
                                          Trả Dư
                                        </button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE: SỰ KIỆN & HOẠT ĐỘNG (CHẶNG 19 - FR-06)            */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'su-kien' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C] flex items-center gap-2">
                      <Award className="w-5 h-5 text-ysbk-gold" />
                      Hoạt Động, Sự Kiện & Nhiệm Vụ Liên Kết Quỹ (Chặng 19)
                    </h3>
                    <p className="text-xs text-[#64705C] mt-0.5">
                      Quản lý kế hoạch, nhiệm vụ (audit log), người tham gia (thành viên hoặc khách ngoài không ép MSSV), dự toán và chi thực tế liên kết sổ quỹ đúng một lần.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsNewEventModalOpen(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-[14px] bg-ysbk-primary hover:bg-[#294C3A] text-white shadow-soft-btn flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Sự Kiện Mới
                  </button>
                </div>

                {/* Danh sách các sự kiện */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveEvents.length === 0 ? (
                    <div className="col-span-full bg-[#FFFDF5] p-8 rounded-[22px] border border-[#DCDED0] text-center text-[#64705C] text-sm shadow-soft-card">
                      Chưa có sự kiện nào. Hãy nhấn "Tạo Sự Kiện Mới" để bắt đầu lên kế hoạch!
                    </div>
                  ) : (
                    liveEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card hover:border-[#365E4B]/40 transition flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4EAD2] text-[#785420] border border-[#A87A4C]/20">
                              {evt.eventType}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              evt.status === 'COMPLETED' ? 'bg-[#E8EDDF] text-[#294C3A]' :
                              evt.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                              evt.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-800' :
                              evt.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-[#F8F5EC] text-[#64705C]'
                            }`}>
                              {evt.status}
                            </span>
                          </div>
                          <h4 className="font-serif font-bold text-[#35483C] text-base hover:text-ysbk-primary transition">
                            {evt.title}
                          </h4>
                          <p className="text-xs text-[#64705C] line-clamp-2">{evt.description || 'Chưa có mô tả chi tiết.'}</p>
                          <div className="text-xs text-[#64705C] space-y-1 pt-2 border-t border-[#DCDED0]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#64705C]" />
                              <span>{evt.eventDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Wallet className="w-3.5 h-3.5 text-[#64705C]" />
                              <span>Dự toán: <strong className="text-[#35483C]">{formatVND(evt.budget)}</strong></span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2 text-[10px]">
                            {evt.isApprovedForPublic && (
                              <span className="px-2 py-0.5 rounded-full bg-[#E8EDDF] text-[#294C3A] font-semibold border border-[#365E4B]/20">
                                Công khai (Public)
                              </span>
                            )}
                            {evt.isApprovedForAlumni && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                                Cựu (Alumni Allowlist)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 mt-3 border-t border-[#DCDED0] flex justify-end">
                          <button
                            onClick={() => handleOpenEventDetailModal(evt.id)}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-[12px] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] transition"
                          >
                            Xem Chi Tiết & Nhiệm Vụ &rarr;
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 7: TÀI CHÍNH & CA TRỰC                             */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'tai-chinh' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex items-center justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C]">Sổ Quỹ & Ca Trực Tiền Mặt Bàn Sách</h3>
                    <p className="text-xs text-[#64705C] mt-0.5">Cách ly độc lập 2 quỹ: Quỹ Cọc Mượn Sách & Quỹ Hoạt Động CLB</p>
                  </div>
                  {liveSession && !liveSession.isClosed && (
                    <button 
                      onClick={() => setShowCloseSessionModal(true)}
                      className="px-4 py-2 text-xs font-semibold rounded-[14px] bg-rose-600 hover:bg-rose-700 text-white shadow-soft-btn flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Kiểm Kê & Đóng Ca Quầy
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-xs text-[#64705C] font-semibold">Tiền Mặt Quầy Dự Kiến</div>
                    <div className="font-serif text-2xl font-bold text-emerald-700 tnum mt-1">
                      {liveSession ? formatVND(liveSession.expectedClosingCash) : '0 ₫'}
                    </div>
                    <div className="text-[11px] text-[#64705C] mt-1">Hộp tiền mượn-trả bàn trực</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-xs text-[#64705C] font-semibold">Tiền Mặt Đầu Ca</div>
                    <div className="font-serif text-2xl font-bold text-ysbk-primary tnum mt-1">
                      {liveSession ? formatVND(liveSession.openingCash) : '0 ₫'}
                    </div>
                    <div className="text-[11px] text-[#64705C] mt-1">Bàn giao từ ca trước cất tủ</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-xs text-[#64705C] font-semibold">Trạng Thái Ca Hôm Nay</div>
                    <div className="font-serif text-2xl font-bold text-[#35483C] mt-1">
                      {liveSession ? (liveSession.isClosed ? 'Đã đóng ca' : 'Đang mở') : 'Chưa mở ca'}
                    </div>
                    <div className="text-[11px] text-[#64705C] mt-1">
                      {liveSession ? `Mã: ${liveSession.id}` : 'Bấm Mở Ca để bắt đầu'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 9: BÁO CÁO & XUẤT FILE                             */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'bao-cao' && (
              <div className="space-y-6">
                {/* Header & Controls */}
                <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#35483C]">Báo Cáo Hoạt Động & Xuất Dữ Liệu</h3>
                    <p className="text-xs text-[#64705C] mt-0.5">Đối soát tài chính hai quỹ độc lập, drill-down bút toán sổ kép và lưu thông sách</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Period Filter */}
                    <div className="inline-flex rounded-[12px] border border-[#DCDED0] bg-[#F8F5EC] p-1 text-xs">
                      {(['WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setReportPeriod(p);
                            loadReportsData(p);
                          }}
                          className={`px-3 py-1.5 font-medium rounded-[10px] transition ${
                            reportPeriod === p
                              ? 'bg-[#365E4B] text-white font-bold shadow-xs'
                              : 'text-[#64705C] hover:text-[#35483C]'
                          }`}
                        >
                          {p === 'WEEK' ? 'Tuần' : p === 'MONTH' ? 'Tháng' : p === 'QUARTER' ? 'Quý' : p === 'YEAR' ? 'Năm' : 'Toàn bộ'}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => handleDownloadCsvExport('FINANCIAL_SUMMARY')}
                      disabled={isExporting}
                      className="px-3.5 py-2 text-xs font-bold rounded-[14px] bg-[#365E4B] hover:bg-[#294C3A] text-white shadow-soft-btn flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {isExporting ? 'Đang xuất...' : 'Xuất CSV Tài Chính'}
                    </button>

                    <button 
                      onClick={() => handleDownloadCsvExport('CIRCULATION')}
                      disabled={isExporting}
                      className="px-3.5 py-2 text-xs font-bold rounded-[14px] bg-[#FFFDF5] border border-[#DCDED0] text-[#35483C] hover:bg-[#F8F5EC] shadow-soft-btn flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" />
                      Xuất CSV Lưu Thông
                    </button>
                  </div>
                </div>

                {/* KPI Cards: Financial Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-xs text-[#64705C] font-medium">Tiền Mặt Hộp Quỹ</div>
                    <div className="text-xl font-bold font-serif text-[#35483C] mt-1">
                      {financialReportData ? formatVND(financialReportData.cashDrawerBalance) : '0 ₫'}
                    </div>
                    <div className="text-[11px] text-[#8C9685] mt-1">Tài khoản TIEN_MAT_HOP</div>
                  </div>

                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                    <div className="text-xs text-[#64705C] font-medium">Tiền Tài Khoản Ngân Hàng</div>
                    <div className="text-xl font-bold font-serif text-[#35483C] mt-1">
                      {financialReportData ? formatVND(financialReportData.bankMainBalance) : '0 ₫'}
                    </div>
                    <div className="text-[11px] text-[#8C9685] mt-1">Tài khoản TIEN_NGAN_HANG</div>
                  </div>

                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#E5D7B7] shadow-soft-card bg-[#FDF9F0]/60">
                    <div className="text-xs text-[#8C6D23] font-medium">Cọc Bạn Đọc Đang Giữ</div>
                    <div className="text-xl font-bold font-serif text-[#7A5B15] mt-1">
                      {financialReportData ? formatVND(financialReportData.depositLiability) : '0 ₫'}
                    </div>
                    <div className="text-[11px] text-[#A68A3E] mt-1">Nghĩa vụ nợ COC_PHAI_HOAN</div>
                  </div>

                  <div className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#C2D6C8] shadow-soft-card bg-[#F0F6F2]/60">
                    <div className="text-xs text-[#2D5A40] font-medium">Kết Quả Ròng (Lãi/Lỗ)</div>
                    <div className="text-xl font-bold font-serif text-[#1E432E] mt-1">
                      {financialReportData ? formatVND(financialReportData.netIncome) : '0 ₫'}
                    </div>
                    <div className="text-[11px] text-[#4A725B] mt-1">
                      Doanh thu - Chi phí hoạt động
                    </div>
                  </div>
                </div>

                {/* Additional KPI Cards: Circulation */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  <div className="bg-[#FFFDF5] p-3.5 rounded-[16px] border border-[#DCDED0] text-center shadow-xs">
                    <div className="text-[11px] text-[#64705C]">Lượt Mượn</div>
                    <div className="text-lg font-bold font-serif text-[#35483C] mt-0.5">{circulationReportData?.totalLoansIssued || 0}</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-3.5 rounded-[16px] border border-[#DCDED0] text-center shadow-xs">
                    <div className="text-[11px] text-[#64705C]">Lượt Trả</div>
                    <div className="text-lg font-bold font-serif text-[#365E4B] mt-0.5">{circulationReportData?.totalLoansReturned || 0}</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-3.5 rounded-[16px] border border-[#DCDED0] text-center shadow-xs">
                    <div className="text-[11px] text-[#64705C]">Gia Hạn</div>
                    <div className="text-lg font-bold font-serif text-[#2F5270] mt-0.5">{circulationReportData?.totalLoansRenewed || 0}</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-3.5 rounded-[16px] border border-[#DCDED0] text-center shadow-xs">
                    <div className="text-[11px] text-[#64705C]">Báo Mất</div>
                    <div className="text-lg font-bold font-serif text-[#9B4D36] mt-0.5">{circulationReportData?.totalBooksLost || 0}</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-3.5 rounded-[16px] border border-[#DCDED0] text-center shadow-xs">
                    <div className="text-[11px] text-[#64705C]">Đang Mượn</div>
                    <div className="text-lg font-bold font-serif text-[#A87A4C] mt-0.5">{circulationReportData?.totalActiveLoans || 0}</div>
                  </div>
                  <div className="bg-[#FFFDF5] p-3.5 rounded-[16px] border border-[#DCDED0] text-center shadow-xs">
                    <div className="text-[11px] text-[#64705C]">Quá Hạn</div>
                    <div className="text-lg font-bold font-serif text-[#813C2A] mt-0.5">{circulationReportData?.totalOverdueLoans || 0}</div>
                  </div>
                </div>

                {/* Drill-down Journal Entries Table */}
                <div className="bg-[#FFFDF5] rounded-[22px] border border-[#DCDED0] shadow-soft-card overflow-hidden">
                  <div className="p-4 border-b border-[#DCDED0] flex items-center justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#35483C]">Chứng Từ Sổ Kép Phát Sinh (Drill-Down)</h4>
                      <p className="text-xs text-[#64705C]">Toàn bộ bút toán bất biến cân bằng Nợ = Có từ bảng journal_entries ({drilldownTotalCount} bút toán)</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8F5EC] text-[#64705C] font-medium sticky top-0 border-b border-[#DCDED0]">
                        <tr>
                          <th className="py-2.5 px-3">Mã Bút Toán</th>
                          <th className="py-2.5 px-3">Quỹ</th>
                          <th className="py-2.5 px-3">Nghiệp Vụ</th>
                          <th className="py-2.5 px-3">Tài Khoản Nợ</th>
                          <th className="py-2.5 px-3">Tài Khoản Có</th>
                          <th className="py-2.5 px-3 text-right">Số Tiền (VND)</th>
                          <th className="py-2.5 px-3">Người Tạo</th>
                          <th className="py-2.5 px-3">Thời Gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFECE4] font-mono">
                        {drilldownItems.length > 0 ? (
                          drilldownItems.map((item) => (
                            <tr key={item.id} className="hover:bg-[#F8F5EC]/60 transition">
                              <td className="py-2.5 px-3 font-semibold text-[#35483C]">{item.entryCode}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.fundId === 'FUND_LOAN' ? 'bg-[#E8EDDF] text-[#365E4B]' : 'bg-[#F7E7DB] text-[#9B4D36]'
                                }`}>
                                  {item.fundId === 'FUND_LOAN' ? 'MƯỢN TRẢ' : 'HOẠT ĐỘNG'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[#64705C]">{item.sourceType}</td>
                              <td className="py-2.5 px-3 text-[#365E4B] font-medium">{item.debitAccount}</td>
                              <td className="py-2.5 px-3 text-[#9B4D36] font-medium">{item.creditAccount}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#35483C]">{formatVND(item.amount)}</td>
                              <td className="py-2.5 px-3 text-[#64705C] font-sans">{item.createdBy}</td>
                              <td className="py-2.5 px-3 text-[#8C9685] font-sans text-[11px]">{item.createdAt.slice(0, 16).replace('T', ' ')}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-[#8C9685] font-sans">
                              Chưa có bút toán nào phát sinh trong kỳ đã chọn.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 10: ADMIN QUẢN TRỊ                                 */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'admin' && isAdmin && (
              <div className="space-y-6">
                {workspaceMode !== 'DEMO' && <PublishingManager />}
                {workspaceMode !== 'DEMO' && <MembershipManager />}
                {/* Analytics Summary */}
                {analyticsData && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card text-center">
                      <div className="text-[11px] text-[#64705C] font-medium">Đầu Sách Đã Đăng</div>
                      <div className="text-xl font-bold font-serif text-[#365E4B] mt-1">{analyticsData.totalBooksCataloged}</div>
                    </div>
                    <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card text-center">
                      <div className="text-[11px] text-[#64705C] font-medium">Bản Sao Lưu Thông</div>
                      <div className="text-xl font-bold font-serif text-[#2F5270] mt-1">{analyticsData.totalCopiesInCirculation}</div>
                    </div>
                    <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card text-center">
                      <div className="text-[11px] text-[#64705C] font-medium">Thành Viên Hoạt Động</div>
                      <div className="text-xl font-bold font-serif text-[#365E4B] mt-1">{analyticsData.totalActiveMembers}</div>
                    </div>
                    <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card text-center">
                      <div className="text-[11px] text-[#64705C] font-medium">Review Đã Duyệt</div>
                      <div className="text-xl font-bold font-serif text-[#A87A4C] mt-1">{analyticsData.totalReviewsPublished}</div>
                    </div>
                    <div className="bg-[#FFFDF5] p-4 rounded-[22px] border border-[#DCDED0] shadow-soft-card text-center">
                      <div className="text-[11px] text-[#64705C] font-medium">Bài Viết Tin Tức</div>
                      <div className="text-xl font-bold font-serif text-[#9B4D36] mt-1">{analyticsData.totalPublicPosts}</div>
                    </div>
                  </div>
                )}

                {/* Audit Logs Table */}
                <div className="bg-[#FFFDF5] rounded-[22px] border border-[#EAC4BC] shadow-soft-card overflow-hidden">
                  <div className="p-4 border-b border-[#F5D8D2] flex items-center justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-base text-[#9B4D36] flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Nhật Ký Kiểm Toán Hệ Thống (System Audit Logs)
                      </h3>
                      <p className="text-xs text-[#64705C]">Chỉ Quản trị viên (Admin) được truy cập. Mọi thông tin nhạy cảm đã được che chắn tự động.</p>
                    </div>
                    <div className="text-xs text-[#8C9685] font-mono">
                      {auditLogsTotalCount} bản ghi
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#FDF6F4] text-[#64705C] font-medium sticky top-0 border-b border-[#F5D8D2]">
                        <tr>
                          <th className="py-2.5 px-3">Thời Gian</th>
                          <th className="py-2.5 px-3">Người Thao Tác</th>
                          <th className="py-2.5 px-3">Hành Động</th>
                          <th className="py-2.5 px-3">Tài Nguyên</th>
                          <th className="py-2.5 px-3">Mã Mục Tiêu</th>
                          <th className="py-2.5 px-3">Chi Tiết (Sanitized)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5E6E3] font-mono text-[11px]">
                        {auditLogsData.length > 0 ? (
                          auditLogsData.map((log) => (
                            <tr key={log.id} className="hover:bg-[#FDF6F4]/50 transition">
                              <td className="py-2 px-3 text-[#8C9685] whitespace-nowrap">{log.createdAt.slice(0, 19).replace('T', ' ')}</td>
                              <td className="py-2 px-3 font-semibold text-[#35483C]">{log.actorId || 'HỆ THỐNG'}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8EDDF] text-[#365E4B]">
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[#2F5270]">{log.targetResource}</td>
                              <td className="py-2 px-3 text-[#64705C]">{log.targetId || '-'}</td>
                              <td className="py-2 px-3 max-w-xs truncate text-[#8C9685]" title={JSON.stringify(log.details)}>
                                {log.details ? JSON.stringify(log.details) : '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-[#8C9685] font-sans">
                              Chưa có bản ghi nhật ký kiểm toán nào trong hệ thống.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════ */}
            {/* MODULE 11: CỰU THÀNH VIÊN                                 */}
            {/* ═════════════════════════════════════════════════════════ */}
            {activeModule === 'cuu' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#DCDED0]">
                    <Award className="w-6 h-6 text-[#9B4D36]" />
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#35483C]">Bản Tin Hoạt Động Cựu Thành Viên</h3>
                      <p className="text-xs text-[#64705C]">Nơi kết nối và cập nhật những bước tiến mới của CLB Sách Bách Khoa</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {liveActivities.length > 0 ? (
                      liveActivities.map((act) => (
                        <div key={act.id} className="p-4 bg-[#F8F5EC] rounded-[18px] border border-[#DCDED0] text-xs">
                          <span className="font-bold text-[#9B4D36] uppercase text-[10px] bg-[#F7E7DB] px-2 py-0.5 rounded-full inline-block mb-1">{act.status}</span>
                          <h4 className="font-serif font-bold text-sm text-[#35483C] mt-1">{act.title}</h4>
                          <p className="text-[#64705C] mt-1">{act.description}</p>
                          <div className="text-[11px] text-[#8C9685] mt-2">
                            Thời gian: {act.activityDate} · Địa điểm: {act.location}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-[#F8F5EC] rounded-[18px] text-xs text-[#8C9685]">
                        Chưa có sự kiện nào được công bố cho Cựu Thành Viên.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DASHBOARD MODULE */}
            {activeModule === 'dashboard' && (
              <div className="space-y-6">
                <div className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-soft-card">
                  <h3 className="font-serif font-bold text-lg text-[#35483C] mb-4">Bảng Chỉ Huy Nghiệp Vụ YSBK</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 bg-[#F8F5EC] rounded-[18px] border border-[#DCDED0]">
                      <div className="text-xs text-[#64705C]">Tổng đầu sách:</div>
                      <div className="text-2xl font-bold font-serif text-[#35483C] tnum mt-1">{liveCopies.length}</div>
                    </div>
                    <div className="p-5 bg-[#F8F5EC] rounded-[18px] border border-[#DCDED0]">
                      <div className="text-xs text-[#64705C]">Phiếu mượn đang phục vụ:</div>
                      <div className="text-2xl font-bold font-serif text-[#365E4B] tnum mt-1">{liveLoans.length}</div>
                    </div>
                    <div className="p-5 bg-[#F8F5EC] rounded-[18px] border border-[#DCDED0]">
                      <div className="text-xs text-[#64705C]">Hồ sơ bạn đọc:</div>
                      <div className="text-2xl font-bold font-serif text-[#35483C] tnum mt-1">{liveBorrowers.length}</div>
                    </div>
                    <div className="p-5 bg-[#F8F5EC] rounded-[18px] border border-[#DCDED0]">
                      <div className="text-xs text-[#64705C]">Tiền mặt quầy hiện tại:</div>
                      <div className="text-2xl font-bold font-serif text-[#365E4B] tnum mt-1">
                        {liveSession ? formatVND(liveSession.expectedClosingCash) : '0 ₫'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* MODULE 8: KIỂM DUYỆT BÀI VIẾT & REVIEW (FR-08)             */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {activeModule === 'kiem-duyet' && (
              <div className="space-y-6">
                {/* Module Header */}
                <div className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold font-serif text-[#35483C] flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-[#365E4B]" />
                      <span>Kiểm Duyệt Nội Dung & Bài Viết Công Khai</span>
                    </h2>
                    <p className="text-xs text-[#64705C] mt-1">
                      Phê duyệt cảm nhận sách của bạn đọc và quản lý các bài viết thông báo/tin tức xuất bản ra Cổng thông tin (FR-08).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        loadModerationReviews();
                        loadModerationPosts();
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-[14px] bg-[#F8F5EC] hover:bg-[#E8EDDF] text-[#35483C] border border-[#DCDED0] transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tải lại</span>
                    </button>
                    {moderationTab === 'POSTS' && (
                      <button
                        onClick={() => setShowCreatePostModal(true)}
                        className="px-4 py-2 text-xs font-bold rounded-[14px] bg-[#365E4B] hover:bg-[#294C3A] text-white shadow-soft-btn transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Viết Bài Mới</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-tabs: Reviews vs Posts */}
                <div className="inline-flex rounded-[12px] bg-[#F8F5EC] p-1 border border-[#DCDED0] text-xs font-semibold">
                  <button
                    onClick={() => {
                      setModerationTab('REVIEWS');
                      loadModerationReviews();
                    }}
                    className={`px-3.5 py-1.5 rounded-[10px] transition ${
                      moderationTab === 'REVIEWS'
                        ? 'bg-[#FFFDF5] text-[#365E4B] font-bold shadow-xs'
                        : 'text-[#64705C] hover:text-[#35483C]'
                    }`}
                  >
                    Đánh Giá Sách Bạn Đọc ({moderationReviews.filter(r => r.status === 'PENDING').length} chờ duyệt)
                  </button>
                  <button
                    onClick={() => {
                      setModerationTab('POSTS');
                      loadModerationPosts();
                    }}
                    className={`px-3.5 py-1.5 rounded-[10px] transition ${
                      moderationTab === 'POSTS'
                        ? 'bg-[#FFFDF5] text-[#365E4B] font-bold shadow-xs'
                        : 'text-[#64705C] hover:text-[#35483C]'
                    }`}
                  >
                    Bài Viết & Tin Tức ({moderationPosts.length})
                  </button>
                </div>

                {/* SUBTAB 1: REVIEWS */}
                {moderationTab === 'REVIEWS' && (
                  <div className="space-y-4">
                    <ClubReviewComposer onSubmitted={()=>void loadModerationReviews()}/>
                    {!isAdmin&&<p className="ui-card p-4 text-sm">Chỉ quản trị viên được duyệt hoặc từ chối review.</p>}
                    {/* Filter bar */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-[#64705C] font-medium">Lọc theo trạng thái:</span>
                      {['PENDING', 'APPROVED', 'REJECTED', ''].map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            setReviewStatusFilter(st);
                            loadModerationReviews(st);
                          }}
                          className={`px-3 py-1 rounded-full font-semibold transition text-xs ${
                            reviewStatusFilter === st
                              ? 'bg-[#365E4B] text-white shadow-xs'
                              : 'bg-[#FFFDF5] border border-[#DCDED0] text-[#64705C] hover:bg-[#F8F5EC]'
                          }`}
                        >
                          {st === 'PENDING' ? 'Chờ duyệt' : st === 'APPROVED' ? 'Đã duyệt' : st === 'REJECTED' ? 'Đã từ chối' : 'Tất cả'}
                        </button>
                      ))}
                    </div>

                    {/* Reviews List */}
                    {moderationReviews.length === 0 ? (
                      <div className="bg-[#FFFDF5] p-8 rounded-[22px] border border-[#DCDED0] text-center text-[#8C9685] text-xs">
                        Không có đánh giá nào phù hợp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {moderationReviews.map((rev) => (
                          <div key={rev.id} className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#35483C]">{rev.authorName}</span>
                                {rev.authorEmail && (
                                  <span className="text-[#8C9685] text-[11px]">({rev.authorEmail})</span>
                                )}
                                <span className="text-[#DCDED0]">·</span>
                                <span className="font-mono text-[11px] text-[#365E4B] font-medium">Mã sách: {rev.bookId}</span>
                                <span className="text-[#DCDED0]">·</span>
                                <span className="text-[11px] text-[#8C9685]">Phiên bản: v{rev.version}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#A87A4C] font-bold flex items-center">
                                  {rev.rating} ★
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  rev.status === 'APPROVED' ? 'bg-[#E8EDDF] text-[#365E4B]' :
                                  rev.status === 'REJECTED' ? 'bg-[#F7E7DB] text-[#9B4D36]' :
                                  'bg-[#FDF9F0] text-[#A87A4C]'
                                }`}>
                                  {rev.status === 'APPROVED' ? 'ĐÃ DUYỆT' : rev.status === 'REJECTED' ? 'ĐÃ TỪ CHỐI' : 'CHỜ DUYỆT'}
                                </span>
                              </div>
                            </div>

                            {/* Review Content */}
                            <div className="p-3.5 bg-[#F8F5EC] rounded-[14px] text-xs text-[#35483C] leading-relaxed font-serif italic border border-[#E5E2D6]">
                              "{rev.content}"
                            </div>

                            {/* Pending Content if edited */}
                            {rev.pendingContent && (
                              <div className="p-3.5 bg-[#FFF9ED] border border-[#F0DFB8] rounded-[14px] text-xs text-[#7A5B15]">
                                <div className="font-bold mb-1 flex items-center gap-1 text-[11px] text-[#8C6D23]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Bản sửa mới chờ duyệt (Đang cách ly khỏi cổng công khai):</span>
                                </div>
                                <p className="font-serif italic">"{rev.pendingContent}"</p>
                                {rev.pendingRating && (
                                  <div className="text-[11px] mt-1 text-[#8C6D23] font-semibold">
                                    Đánh giá sao mới: {rev.pendingRating} ★
                                  </div>
                                )}
                              </div>
                            )}

                            {rev.moderationNote && (
                              <div className="text-[11px] text-[#64705C] italic">
                                Ghi chú kiểm duyệt: {rev.moderationNote}
                              </div>
                            )}

                            {/* Actions for Member */}
                            <div className="flex items-center justify-between pt-2 border-t border-[#EFECE4] text-xs">
                              <span className="text-[11px] text-[#8C9685]">
                                Gửi lúc: {rev.createdAt.slice(0, 16).replace('T', ' ')}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={!isAdmin}
                                  onClick={() => {
                                    setSelectedReviewForModerate(rev);
                                    setModerationDecision('APPROVED');
                                    setShowModerateReviewModal(true);
                                  }}
                                  className="px-3.5 py-1.5 rounded-[14px] bg-[#365E4B] hover:bg-[#294C3A] text-white font-bold transition text-xs shadow-soft-btn"
                                >
                                  Phê Duyệt
                                </button>
                                <button
                                  disabled={!isAdmin}
                                  onClick={() => {
                                    setSelectedReviewForModerate(rev);
                                    setModerationDecision('REJECTED');
                                    setShowModerateReviewModal(true);
                                  }}
                                  className="px-3.5 py-1.5 rounded-[14px] bg-[#9B4D36] hover:bg-[#813C2A] text-white font-bold transition text-xs shadow-soft-btn"
                                >
                                  Từ Chối
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: POSTS */}
                {moderationTab === 'POSTS' && (
                  <div className="space-y-4">
                    {moderationPosts.length === 0 ? (
                      <div className="bg-[#FFFDF5] p-8 rounded-[22px] border border-[#DCDED0] text-center text-[#8C9685] text-xs">
                        Chưa có bài viết nào. Hãy bấm "Viết Bài Mới" để xuất bản tin tức hoặc bài giới thiệu sách!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {moderationPosts.map((post) => (
                          <div key={post.id} className="bg-[#FFFDF5] p-5 rounded-[22px] border border-[#DCDED0] shadow-soft-card flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8EDDF] text-[#365E4B]">
                                  {post.category}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  post.status === 'PUBLISHED' ? 'bg-[#E8EDDF] text-[#365E4B]' : 'bg-[#F8F5EC] text-[#64705C]'
                                }`}>
                                  {post.status === 'PUBLISHED' ? 'ĐÃ XUẤT BẢN' : 'BẢN NHÁP'}
                                </span>
                              </div>
                              <h3 className="font-serif font-bold text-[#35483C] text-base line-clamp-2">{post.title}</h3>
                              <p className="font-mono text-[10px] text-[#8C9685] mt-0.5">/posts/{post.slug}</p>
                              <p className="text-xs text-[#64705C] mt-2 line-clamp-3 leading-relaxed">{post.summary}</p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[#EFECE4] flex items-center justify-between text-xs">
                              <span className="text-[11px] text-[#8C9685]">Tác giả: {post.authorDisplayName}</span>
                              {post.status !== 'PUBLISHED' && (
                                <button
                                  onClick={() => handleExecutePublishPost(post.id)}
                                  className="px-3.5 py-1.5 rounded-[14px] bg-[#365E4B] hover:bg-[#294C3A] text-white font-bold text-xs transition shadow-soft-btn"
                                >
                                  Xuất Bản Công Khai
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 1: LẬP PHIẾU MƯỢN MỚI (Tối đa 2 cuốn)               */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showNewLoanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-xl w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-red" />
                Lập Phiếu Mượn Bàn Sách (Tối Đa 2 Cuốn)
              </h3>
              <button onClick={() => setShowNewLoanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteIssueLoan} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chọn bạn đọc (Sinh viên):</label>
                <select 
                  value={selectedBorrowerId}
                  onChange={(e) => setSelectedBorrowerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-navy focus:outline-none"
                >
                  {liveBorrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} (MSSV: {b.studentId || 'Chưa có'} - {b.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* RF-05: Tìm hoặc quét mã vạch trực tiếp từ máy chủ cho sách ngoài 100 bản đầu */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Quét mã vạch hoặc nhập mã sách (vd: BC-001)..."
                  value={barcodeSearchInput}
                  onChange={(e) => setBarcodeSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchCopyByBarcode();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleSearchCopyByBarcode}
                  disabled={isSearchingBarcode || !barcodeSearchInput.trim()}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 disabled:opacity-50"
                >
                  {isSearchingBarcode ? 'Đang tìm...' : 'Tìm / Quét'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cuốn thứ 1 (Bắt buộc):</label>
                  <select 
                    value={selectedBarcode1}
                    onChange={(e) => setSelectedBarcode1(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    {liveCopies.filter(c => c.status === 'AVAILABLE').map(c => (
                      <option key={c.barcode} value={c.barcode}>
                        {c.barcode} - {c.title}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Cọc tính: <strong className="text-brand-navy">{formatVND(dep1)}</strong>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cuốn thứ 2 (Tùy chọn):</label>
                  <select 
                    value={selectedBarcode2}
                    onChange={(e) => setSelectedBarcode2(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">-- Không mượn thêm cuốn 2 --</option>
                    {liveCopies.filter(c => c.status === 'AVAILABLE' && c.barcode !== selectedBarcode1).map(c => (
                      <option key={c.barcode} value={c.barcode}>
                        {c.barcode} - {c.title}
                      </option>
                    ))}
                  </select>
                  {selectedBarcode2 && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Cọc tính: <strong className="text-brand-navy">{formatVND(dep2)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit & Payment Methods */}
              <div className="p-4 bg-brand-navy-soft rounded-xl border border-indigo-200">
                <div className="flex items-center justify-between text-sm font-bold text-brand-navy mb-2">
                  <span>Tổng tiền cọc phải thu:</span>
                  <span className="text-base font-mono tnum">{formatVND(totalNewDeposit)}</span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div>· Hạn mượn chuẩn: <strong>14 ngày lịch</strong> (tính theo ngày mở phiếu).</div>
                  <div>· Mức cọc: Tối thiểu 50.000₫, làm tròn lên bội 50.000₫ theo giá bìa.</div>
                </div>

                <div className="mt-3 pt-3 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="payMethod" 
                        checked={paymentMethod === 'TIEN_MAT'}
                        onChange={() => setPaymentMethod('TIEN_MAT')}
                      />
                      <span className="font-medium text-slate-800">Tiền mặt</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="payMethod" 
                        checked={paymentMethod === 'CHUYEN_KHOAN'}
                        onChange={() => setPaymentMethod('CHUYEN_KHOAN')}
                      />
                      <span className="font-medium text-slate-800">Chuyển khoản QR</span>
                    </label>
                  </div>

                  <label className="flex items-center gap-1.5 text-xs text-brand-navy font-bold">
                    <input 
                      type="checkbox" 
                      required 
                      checked={isPaymentConfirmed}
                      onChange={(e) => setIsPaymentConfirmed(e.target.checked)}
                    />
                    <span>Đã nhận đủ tiền thực tế</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xuất phiếu...' : 'Xác Nhận & Xuất Phiếu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 2: TRẢ SÁCH / PHIẾU CHUYỂN TIẾP                      */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showReturnModal && selectedLoanForReturn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-xl w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy">
                Xử Lý Trả Sách: {selectedLoanForReturn.receiptNumber}
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg flex justify-between">
                <div>
                  <div className="font-bold text-slate-900">{selectedLoanForReturn.borrowerName}</div>
                  <div className="text-slate-500">
                    Hạn: {selectedLoanForReturn.dueDate}
                    {returnQuote?.effectiveDueDate && returnQuote.effectiveDueDate !== selectedLoanForReturn.dueDate && (
                      <span className="text-emerald-700 font-semibold ml-1">
                        (Hiệu lực bù nghỉ lễ: {returnQuote.effectiveDueDate})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400">Trạng thái:</div>
                  <div className={`font-bold ${((returnQuote ? returnQuote.isOverdue : selectedLoanForReturn.dueDate < new Intl.DateTimeFormat('en-CA').format(new Date()))) ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isFetchingQuote ? (
                      <span className="text-slate-400 animate-pulse">Đang định giá từ máy chủ...</span>
                    ) : returnQuote ? (
                      returnQuote.isOverdue ? `Quá hạn ${returnQuote.overdueDays} ngày (1k/ngày cả phiếu)` : 'Trong hạn'
                    ) : (
                      selectedLoanForReturn.dueDate < new Intl.DateTimeFormat('en-CA').format(new Date()) ? 'Quá hạn phạt (1k/ngày cả phiếu)' : 'Trong hạn'
                    )}
                  </div>
                </div>
              </div>

              {/* Return Mode Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Hình thức xử lý trả sách:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnType('FULL');
                      setReturnedBarcodes(selectedLoanForReturn.items.filter(i => !i.returnedAt && !i.isLost).map(i => i.barcode));
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      returnType === 'FULL' ? 'border-brand-navy bg-brand-navy-soft text-brand-navy font-bold' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>1. Trả toàn bộ sách</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">Tất toán phiếu, hoàn cọc và thu phạt riêng biệt.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReturnType('PARTIAL');
                      const active = selectedLoanForReturn.items.filter(i => !i.returnedAt && !i.isLost);
                      if (active.length > 0) setReturnedBarcodes([active[0].barcode]);
                    }}
                    disabled={selectedLoanForReturn.items.filter(i => !i.returnedAt && !i.isLost).length < 2}
                    className={`p-3 rounded-xl border text-left transition ${
                      returnType === 'PARTIAL' ? 'border-brand-navy bg-brand-navy-soft text-brand-navy font-bold' : 'border-slate-200 hover:bg-slate-50'
                    } ${selectedLoanForReturn.items.filter(i => !i.returnedAt && !i.isLost).length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div>2. Trả 1 cuốn, giữ 1 cuốn</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">Lập phiếu chuyển tiếp, reset 14 ngày & 3 lần gia hạn.</div>
                  </button>
                </div>
              </div>

              {/* Items to return selection */}
              {returnType === 'PARTIAL' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-900">Chọn đúng 1 cuốn thực trả tại quầy (Cuốn còn lại sẽ chuyển phiếu mới):</div>
                  {selectedLoanForReturn.items.filter(i => !i.returnedAt && !i.isLost).map((item) => (
                    <label key={item.barcode} className="flex items-center gap-2 text-slate-800 cursor-pointer">
                      <input 
                        type="radio"
                        name="partialReturnBarcode"
                        checked={returnedBarcodes.includes(item.barcode)}
                        onChange={() => setReturnedBarcodes([item.barcode])}
                      />
                      <span>{item.barcode} — {item.title} (Cọc: {formatVND(item.depositSnapshot)})</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Fine and Refund Settlement Explanation */}
              <div className="p-4 bg-slate-100 rounded-xl space-y-2 border border-slate-200">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Hoàn lại tiền cọc phần đã trả:</span>
                  <span className="font-mono text-emerald-700 tnum">
                    {formatVND(
                      selectedLoanForReturn.items
                        .filter(it => returnedBarcodes.includes(it.barcode))
                        .reduce((sum, it) => sum + it.depositSnapshot, 0)
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Hình thức hoàn cọc:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="refundMethod" 
                      checked={refundMethod === 'TIEN_MAT'}
                      onChange={() => setRefundMethod('TIEN_MAT')}
                    />
                    <span>Tiền mặt</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer ml-2">
                    <input 
                      type="radio" 
                      name="refundMethod" 
                      checked={refundMethod === 'CHUYEN_KHOAN'}
                      onChange={() => setRefundMethod('CHUYEN_KHOAN')}
                    />
                    <span>Chuyển khoản</span>
                  </label>
                </div>

                <label className="flex items-center gap-2 pt-2 border-t border-slate-200 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={returnPaymentConfirmed}
                    onChange={(e) => setReturnPaymentConfirmed(e.target.checked)}
                    className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Xác nhận đã chi tiền hoàn cọc thực tế cho bạn đọc
                  </span>
                </label>

                {workspaceMode === 'LIVE' && quoteError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
                    <span>⚠️ Lỗi tải báo giá từ máy chủ: {quoteError}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenReturnModal(selectedLoanForReturn)}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                {(() => {
                  if (workspaceMode === 'LIVE' && !returnQuote) return null;
                  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
                  const isOverdue = returnQuote ? returnQuote.isOverdue : (selectedLoanForReturn.dueDate < todayStr);
                  if (!isOverdue) return null;
                  const overdueDays = returnQuote ? returnQuote.overdueDays : 0;
                  const defaultCalculatedFine = returnQuote ? (returnQuote.effectiveFine !== undefined ? returnQuote.effectiveFine : returnQuote.suggestedFine) : 0;

                  return (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex justify-between font-bold text-rose-700">
                        <span>Tiền phạt gợi ý quá hạn ({overdueDays} ngày × 1k/ngày cả phiếu):</span>
                        <span className="font-mono tnum">{formatVND(defaultCalculatedFine)}</span>
                      </div>
                      {returnQuote?.effectiveDueDate && returnQuote.effectiveDueDate !== selectedLoanForReturn.dueDate && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
                          * Đã áp dụng lịch nghỉ lễ/đóng cửa quầy: hạn tính phạt dời từ {selectedLoanForReturn.dueDate} sang {returnQuote.effectiveDueDate}.
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-slate-600 font-semibold shrink-0">Thực thu phạt:</label>
                        <input 
                          type="number"
                          value={customFineAmount !== null ? customFineAmount : defaultCalculatedFine}
                          onChange={(e) => setCustomFineAmount(Number(e.target.value))}
                          className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-right font-mono"
                        />
                        <span className="text-slate-500">₫</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-semibold text-slate-700">Hình thức thu phạt:</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input 
                            type="radio" 
                            name="returnFineMethod" 
                            checked={returnFinePaymentMethod === 'TIEN_MAT'}
                            onChange={() => setReturnFinePaymentMethod('TIEN_MAT')}
                          />
                          <span>Tiền mặt</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2">
                          <input 
                            type="radio" 
                            name="returnFineMethod" 
                            checked={returnFinePaymentMethod === 'CHUYEN_KHOAN'}
                            onChange={() => setReturnFinePaymentMethod('CHUYEN_KHOAN')}
                          />
                          <span>Chuyển khoản</span>
                        </label>
                      </div>

                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={returnFinePaymentConfirmed}
                          onChange={(e) => setReturnFinePaymentConfirmed(e.target.checked)}
                          className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                        />
                        <span className="text-xs text-slate-700 font-medium">
                          Xác nhận đã thực nhận đủ tiền phạt (hộp tiền hoặc app ngân hàng)
                        </span>
                      </label>

                      <input 
                        type="text"
                        placeholder="Bắt buộc nhập lý do nếu giảm hoặc miễn phạt về 0..."
                        value={waiveFineReason}
                        onChange={(e) => setWaiveFineReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs mt-1"
                      />
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting || (workspaceMode === 'LIVE' && (isFetchingQuote || !!quoteError || !returnQuote))}
                  onClick={handleExecuteReturn}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang quyết toán...' : 'Xác Nhận & Tất Toán'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 3: GIA HẠN PHIẾU MƯỢN (+14 NGÀY)                     */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showRenewModal && selectedLoanForRenew && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-brand-navy" />
                Gia Hạn Phiếu Mượn: {selectedLoanForRenew.receiptNumber}
              </h3>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                <div>Người mượn: <strong>{selectedLoanForRenew.borrowerName}</strong></div>
                <div>Hạn trả hiện tại: <strong>{selectedLoanForRenew.dueDate}</strong></div>
                {renewQuote?.projectedDueDate && (
                  <div className="text-emerald-700 font-semibold">
                    Hạn mới dự kiến sau gia hạn: <strong>{renewQuote.projectedDueDate}</strong>
                    <span className="text-[11px] text-slate-500 font-normal ml-1">
                      (Đánh giá tại ngày {renewQuote.targetDate})
                    </span>
                  </div>
                )}
                <div>Số lần đã gia hạn: <strong>{selectedLoanForRenew.renewCount}/3 lần</strong></div>
              </div>

              {workspaceMode === 'LIVE' && quoteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
                  <span>⚠️ Lỗi tải báo giá gia hạn: {quoteError}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenRenewModal(selectedLoanForRenew)}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {workspaceMode === 'LIVE' && renewQuote && !renewQuote.canRenew && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                  ⚠️ Không thể gia hạn phiếu này theo quy định CLB (trạng thái phiếu không hợp lệ hoặc tiền phạt vượt quá tổng cọc).
                </div>
              )}

              {selectedLoanForRenew.renewCount >= 3 ? (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 font-bold">
                  ⚠️ Phiếu này đã đạt giới hạn tối đa 3 lần gia hạn. Bạn đọc bắt buộc phải mang sách đến quầy trả.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 rounded-lg text-indigo-900 leading-relaxed">
                    Mỗi lần gia hạn sẽ kéo dài thêm <strong>14 ngày lịch</strong> (tự động dời nếu trùng ngày nghỉ lễ theo lịch CLB).
                  </div>

                  {((renewQuote ? renewQuote.isOverdue : selectedLoanForRenew.dueDate < new Intl.DateTimeFormat('en-CA').format(new Date()))) && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                      <div className="font-bold text-amber-900">
                        Phiếu đang quá hạn {renewQuote ? `(${renewQuote.overdueDays} ngày)` : ''}. Vui lòng thu phạt:
                      </div>
                      {renewQuote && (
                        <div className="text-[11px] text-amber-800">
                          Mức phạt gợi ý từ server: <strong className="font-mono">{formatVND(renewQuote.suggestedFine)}</strong>
                          {renewQuote.effectiveDueDate !== selectedLoanForRenew.dueDate && (
                            <span className="block text-emerald-800 font-medium">
                              * Hạn hiệu lực bù ngày nghỉ lễ: {renewQuote.effectiveDueDate}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="text-slate-700 font-semibold">Tiền phạt thu:</label>
                        <input 
                          type="number"
                          value={renewFineAmount}
                          onChange={(e) => setRenewFineAmount(Number(e.target.value))}
                          className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-right font-mono"
                        />
                        <span>₫</span>
                      </div>
                      <input 
                        type="text"
                        placeholder="Lý do điều chỉnh / miễn giảm tiền phạt..."
                        value={renewFineReason}
                        onChange={(e) => setRenewFineReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-semibold text-slate-700">Hình thức thu:</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input 
                            type="radio" 
                            name="renewFineMethod" 
                            checked={renewFinePaymentMethod === 'TIEN_MAT'}
                            onChange={() => setRenewFinePaymentMethod('TIEN_MAT')}
                          />
                          <span>Tiền mặt</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2">
                          <input 
                            type="radio" 
                            name="renewFineMethod" 
                            checked={renewFinePaymentMethod === 'CHUYEN_KHOAN'}
                            onChange={() => setRenewFinePaymentMethod('CHUYEN_KHOAN')}
                          />
                          <span>Chuyển khoản</span>
                        </label>
                      </div>

                      <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer pt-1">
                        <input 
                          type="checkbox" 
                          checked={renewPaymentConfirmed}
                          onChange={(e) => setRenewPaymentConfirmed(e.target.checked)}
                          className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                        />
                        <span>Đã thu đủ tiền phạt thực tế (hộp quầy hoặc app ngân hàng)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Đóng
                </button>
                {selectedLoanForRenew.renewCount < 3 && (
                  <button 
                    type="button"
                    disabled={isSubmitting || (workspaceMode === 'LIVE' && (isFetchingQuote || !!quoteError || !renewQuote || !renewQuote.canRenew))}
                    onClick={handleExecuteRenew}
                    className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang gia hạn...' : 'Xác Nhận Gia Hạn (+14 Ngày)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 2.1: XÁC NHẬN CHI TIỀN HOÀN CỌC (S12-03)          */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showConfirmRefundModal && selectedRefundForConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Xác Nhận Chi Tiền Hoàn Cọc
              </h3>
              <button
                onClick={() => {
                  setShowConfirmRefundModal(false);
                  setSelectedRefundForConfirm(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã phiếu mượn:</span>
                  <span className="font-mono font-bold text-brand-navy">{selectedRefundForConfirm.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bạn đọc:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRefundForConfirm.borrowerName} (MSSV: {selectedRefundForConfirm.borrowerStudentId})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã Intent hoàn cọc:</span>
                  <span className="font-mono text-slate-600">{selectedRefundForConfirm.id}</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <div className="text-xs text-emerald-800 font-semibold mb-1">Số tiền hoàn cọc thực chi:</div>
                <div className="font-mono text-2xl font-bold text-emerald-700 tnum">
                  {formatVND(selectedRefundForConfirm.amount)}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Hình thức chi trả tiền hoàn:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmRefundMethod('CASH')}
                    className={`p-3 rounded-xl border text-left transition ${
                      confirmRefundMethod === 'CASH'
                        ? 'border-brand-navy bg-brand-navy-soft text-brand-navy font-bold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>1. Tiền mặt</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Xuất tiền từ két quầy ({liveSession ? `Ca ngày ${liveSession.sessionDate}` : 'Chưa có ca'})
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmRefundMethod('BANK_TRANSFER')}
                    className={`p-3 rounded-xl border text-left transition ${
                      confirmRefundMethod === 'BANK_TRANSFER'
                        ? 'border-brand-navy bg-brand-navy-soft text-brand-navy font-bold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>2. Chuyển khoản</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Chuyển qua app ngân hàng / QR của bạn đọc
                    </div>
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmRefundPaymentConfirmed}
                  onChange={(e) => setConfirmRefundPaymentConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-xs text-amber-950 font-medium leading-relaxed">
                  Tôi xác nhận <strong>ĐÃ CHI TIỀN THỰC TẾ {formatVND(selectedRefundForConfirm.amount)}</strong> cho bạn đọc (trao tiền mặt hoặc chuyển khoản ngân hàng thành công).
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmRefundModal(false);
                    setSelectedRefundForConfirm(null);
                  }}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !confirmRefundPaymentConfirmed}
                  onClick={handleExecuteConfirmRefund}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xác nhận...' : 'Xác Nhận Đã Chi Hoàn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 2.3: BÀN GIAO SÁCH & THU CỌC ĐƠN ĐẶT TRƯỚC (PR-7)   */}
      {/* ═════════════════════════════════════════════════════════ */}
      {selectedReservationForFulfill && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Bàn Giao Sách & Thu Tiền Cọc Đơn {selectedReservationForFulfill.code}
              </h3>
              <button
                onClick={() => setSelectedReservationForFulfill(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tựa sách:</span>
                  <span className="font-bold text-slate-800">{selectedReservationForFulfill.bookTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã vạch cuốn sách:</span>
                  <span className="font-mono font-semibold text-slate-700">{selectedReservationForFulfill.copyBarcode || 'Chưa gán'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bạn đọc nhận:</span>
                  <span className="font-semibold text-slate-800">{selectedReservationForFulfill.fullName || selectedReservationForFulfill.borrowerName || 'Khách vãng lai'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số điện thoại:</span>
                  <span className="font-mono text-slate-700">{selectedReservationForFulfill.phone}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-medium">Tiền cọc cần thu:</span>
                  <span className="font-bold text-emerald-700 text-sm font-mono">{formatVND(selectedReservationForFulfill.estimatedDeposit)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phương thức thu tiền cọc:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFulfillPaymentMethod('CASH')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      fulfillPaymentMethod === 'CASH'
                        ? 'border-brand-navy bg-brand-navy-soft text-brand-navy'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tiền mặt (Hộp quầy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillPaymentMethod('BANK_TRANSFER')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      fulfillPaymentMethod === 'BANK_TRANSFER'
                        ? 'border-brand-navy bg-brand-navy-soft text-brand-navy'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Chuyển khoản QR
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú bàn giao:
                </label>
                <input
                  type="text"
                  value={fulfillNotes}
                  onChange={(e) => setFulfillNotes(e.target.value)}
                  placeholder="Ghi chú thêm nếu có..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Payment Confirmation Guard */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fulfillPaymentConfirmed}
                  onChange={(e) => setFulfillPaymentConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-xs text-amber-950 font-medium leading-relaxed">
                  Tôi xác nhận <strong>ĐÃ THU ĐỦ {formatVND(selectedReservationForFulfill.estimatedDeposit)} TIỀN CỌC THẬT</strong> từ bạn đọc trước khi giao sách.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReservationForFulfill(null)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isFulfilling || !fulfillPaymentConfirmed}
                  onClick={handleExecuteFulfillReservation}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isFulfilling ? 'Đang lập phiếu...' : 'Xác Nhận Thu Cọc & Giao Sách'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 2.4: HỦY ĐƠN ĐẶT GIỮ CHỖ (PR-7)                     */}
      {/* ═════════════════════════════════════════════════════════ */}
      {selectedReservationForCancel && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Hủy Đơn Đặt Giữ Chỗ: {selectedReservationForCancel.code}
              </h3>
              <button
                onClick={() => setSelectedReservationForCancel(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Sau khi hủy, bản sách sẽ được chuyển về trạng thái Sẵn Sàng (AVAILABLE) để bạn đọc khác mượn.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do hủy đơn:
                </label>
                <input
                  type="text"
                  value={cancelStaffReason}
                  onChange={(e) => setCancelStaffReason(e.target.value)}
                  placeholder="Ví dụ: Bạn đọc gọi điện xin hủy, quá hạn hẹn..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReservationForCancel(null)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isStaffCancelling}
                  onClick={handleExecuteCancelStaffReservation}
                  className="px-4 py-2 rounded-md bg-rose-600 text-white font-bold hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {isStaffCancelling ? 'Đang hủy...' : 'Đồng Ý Hủy Đơn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 2.2: CHI TIẾT QUYẾT TOÁN PHIẾU MƯỢN (S12-03)       */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showLoanSettlementModal && settlementDetailData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-2xl w-full p-6 shadow-soft-modal border border-[#DCDED0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-navy" />
                Chi Tiết Quyết Toán Phiếu Mượn: {settlementDetailData.receipt?.receiptNumber}
              </h3>
              <button
                onClick={() => {
                  setShowLoanSettlementModal(false);
                  setSettlementDetailData(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Tóm tắt bạn đọc & phiếu */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">Bạn đọc: </span>
                  <span className="font-bold text-slate-800">
                    {settlementDetailData.receipt?.borrowerName} ({settlementDetailData.receipt?.borrowerStudentId})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Trạng thái phiếu: </span>
                  <span className="font-bold text-brand-navy">{settlementDetailData.receipt?.status}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ngày mượn: </span>
                  <span className="font-semibold text-slate-700">{settlementDetailData.receipt?.borrowDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Hạn trả: </span>
                  <span className="font-semibold text-slate-700">{settlementDetailData.receipt?.dueDate}</span>
                </div>
              </div>

              {/* Thông tin quyết toán nếu đã chốt */}
              {settlementDetailData.settlementId ? (
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                  <div className="font-bold text-indigo-950">Bản Ghi Quyết Toán #{settlementDetailData.settlementId.slice(0, 8)}:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Loại quyết toán:</div>
                      <div className="font-bold text-slate-800">{settlementDetailData.settlementType}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Ngày trả thực tế:</div>
                      <div className="font-bold text-slate-800">{settlementDetailData.returnDate || '—'}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Số ngày quá hạn:</div>
                      <div className="font-bold text-rose-600">{settlementDetailData.overdueDays} ngày</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Phạt đề xuất:</div>
                      <div className="font-mono font-bold text-slate-800">{formatVND(settlementDetailData.suggestedFine || settlementDetailData.fineSuggested || 0)}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Phạt thực thu:</div>
                      <div className="font-mono font-bold text-emerald-700">{formatVND(settlementDetailData.fineCollected || settlementDetailData.fineFinal || 0)}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Trạng thái phạt:</div>
                      <div className="font-bold text-slate-800">{settlementDetailData.fineStatus || 'Đã tất toán'}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Tổng cọc ban đầu:</div>
                      <div className="font-mono font-bold text-slate-800">{formatVND(settlementDetailData.totalDeposit || 0)}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Cọc đã hoàn:</div>
                      <div className="font-mono font-bold text-emerald-700">{formatVND(settlementDetailData.depositRefunded || 0)}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-indigo-50">
                      <div className="text-slate-400">Cọc tịch thu / chuyển tiếp:</div>
                      <div className="font-mono font-bold text-rose-600">
                        {formatVND(Number(settlementDetailData.depositForfeited || 0) + Number(settlementDetailData.depositTransferred || 0))}
                      </div>
                    </div>
                  </div>
                  {settlementDetailData.fineReason && (
                    <div className="text-[11px] text-slate-600 italic pt-1">
                      Lý do miễn giảm / điều chỉnh phạt: "{settlementDetailData.fineReason}"
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                  Phiếu này chưa chốt quyết toán chính thức. Phạt dự kiến hiện tại: <strong>{formatVND(settlementDetailData.suggestedFine || 0)}</strong> ({settlementDetailData.overdueDays || 0} ngày quá hạn).
                </div>
              )}

              {/* Danh sách Refund Intents */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Lịch Sử Ý Định Hoàn Cọc (Refund Intents):</h4>
                {(!settlementDetailData.refundIntents || settlementDetailData.refundIntents.length === 0) ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-400 text-center">
                    Chưa có ý định hoàn cọc nào cho phiếu mượn này.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Mã Intent</th>
                          <th className="py-2 px-3 font-semibold">Số tiền</th>
                          <th className="py-2 px-3 font-semibold">Phương thức</th>
                          <th className="py-2 px-3 font-semibold">Trạng thái</th>
                          <th className="py-2 px-3 font-semibold">Xác nhận lúc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {settlementDetailData.refundIntents.map((intent: any) => (
                          <tr key={intent.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono text-slate-600">{intent.id.slice(0, 10)}...</td>
                            <td className="py-2 px-3 font-mono font-bold text-emerald-700">{formatVND(intent.amount)}</td>
                            <td className="py-2 px-3">{intent.refundMethod === 'CASH' || intent.refundMethod === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                intent.status === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : intent.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {intent.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {intent.confirmedAt ? new Date(intent.confirmedAt).toLocaleString('vi-VN') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Danh sách sách trong phiếu */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Danh Sách Ấn Phẩm Trong Phiếu:</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Barcode</th>
                        <th className="py-2 px-3 font-semibold">Tựa sách</th>
                        <th className="py-2 px-3 font-semibold text-right">Tiền cọc</th>
                        <th className="py-2 px-3 font-semibold text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(settlementDetailData.receipt?.items || []).map((item: any) => (
                        <tr key={item.barcode} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-slate-600">{item.barcode}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{item.title}</td>
                          <td className="py-2 px-3 font-mono text-right text-emerald-700">{formatVND(item.depositSnapshot)}</td>
                          <td className="py-2 px-3 text-right">
                            {item.isLost ? (
                              <span className="text-rose-600 font-bold">Báo mất</span>
                            ) : item.returnedAt ? (
                              <span className="text-emerald-600 font-semibold">Đã trả ({new Intl.DateTimeFormat('en-CA').format(new Date(item.returnedAt))})</span>
                            ) : (
                              <span className="text-amber-600 font-semibold">Đang mượn</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoanSettlementModal(false);
                    setSettlementDetailData(null);
                  }}
                  className="px-4 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 4: BÁO MẤT SÁCH & TỊCH THU TIỀN CỌC                */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showLossModal && selectedLoanForLoss && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Báo Mất Sách: {selectedLoanForLoss.receiptNumber}
              </h3>
              <button onClick={() => setShowLossModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-lg text-rose-900 border border-rose-200 leading-relaxed">
                <strong>Quy tắc tịch thu cọc:</strong> Chỉ tịch thu số tiền cọc tương ứng của đúng cuốn sách báo mất để hạch toán vào Quỹ Hoạt Động (Doanh thu phạt/đền bù). Tiền cọc của cuốn còn lại (nếu có) được bảo toàn.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chọn cuốn sách bị mất:</label>
                <select 
                  value={lossSelectedBarcode}
                  onChange={(e) => setLossSelectedBarcode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  {selectedLoanForLoss.items.filter(i => !i.returnedAt && !i.isLost).map((it) => (
                    <option key={it.barcode} value={it.barcode}>
                      {it.barcode} — {it.title} (Cọc: {formatVND(it.depositSnapshot)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do báo mất (Bắt buộc):</label>
                <textarea 
                  rows={2}
                  required
                  placeholder="Ghi rõ lý do làm mất, thời điểm và biên bản nếu có..."
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteReportLoss}
                  className="px-4 py-2 rounded-md bg-rose-600 text-white font-bold hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Báo Mất & Tịch Thu Cọc'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 5: MỞ CA QUẦY TIỀN MẶT HÔM NAY                      */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showOpenSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy">Mở Ca Quầy Tiền Mặt Bàn Trực</h3>
              <button onClick={() => setShowOpenSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tiền mặt thực nhận đầu ca (VND):</label>
                <input 
                  type="number"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Tiền mặt cất tủ có khóa từ ca trực trước bàn giao lại.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giải trình chênh lệch đầu ca (nếu có):</label>
                <textarea 
                  rows={2}
                  placeholder="Ghi rõ lý do nếu số tiền thực nhận khác với số kết chuyển..."
                  value={openDiscrepancyReason}
                  onChange={(e) => setOpenDiscrepancyReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowOpenSessionModal(false)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteOpenSession}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang mở ca...' : 'Xác Nhận Mở Ca Quầy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 6: BIÊN BẢN ĐÓNG CA & KIỂM TIỀN MẶT                */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showCloseSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy">Biên Bản Kiểm Kê & Đóng Ca Quầy Tiền</h3>
              <button onClick={() => setShowCloseSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Người mở ca:</span>
                  <strong className="text-slate-800">{liveSession?.openedBy || demoCashSession.openedBy}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiền mặt đầu ca:</span>
                  <strong className="font-mono text-slate-800 tnum">
                    {formatVND(liveSession?.openingCash ?? demoCashSession.openingCash)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số tiền mặt dự kiến theo sổ sách:</span>
                  <strong className="font-mono text-brand-navy font-bold tnum">
                    {formatVND(liveSession?.expectedClosingCash ?? demoCashSession.expectedClosingCash)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tiền mặt thực đếm cuối ca:</label>
                <input 
                  type="number"
                  value={actualClosingCashInput}
                  onChange={(e) => setActualClosingCashInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
                />
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Chênh lệch:</span>
                  <strong className={
                    actualClosingCashInput === (liveSession?.expectedClosingCash ?? demoCashSession.expectedClosingCash)
                      ? 'text-emerald-600 font-mono'
                      : 'text-rose-600 font-mono font-bold'
                  }>
                    {formatVND(actualClosingCashInput - (liveSession?.expectedClosingCash ?? demoCashSession.expectedClosingCash))}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giải trình chênh lệch (nếu có):</label>
                <textarea 
                  rows={2}
                  placeholder="Bắt buộc ghi rõ lý do nếu số thực đếm khác số sổ sách..."
                  value={closeDiscrepancyReason}
                  onChange={(e) => setCloseDiscrepancyReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCloseSessionModal(false)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Đóng
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteCloseSession}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang đóng ca...' : 'Xác Nhận Đóng Ca & Khóa Tủ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 7: SỬA SAI CHỨNG TỪ SỔ CÁI                           */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-brand-navy" />
                Sửa Sai Chứng Từ Sổ Kép (Reversal)
              </h3>
              <button onClick={() => setShowCorrectionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg text-amber-900 border border-amber-200 leading-relaxed">
                <strong>Nguyên tắc bất biến:</strong> Hệ thống không xóa dữ liệu cũ. Sửa sai sẽ tạo một bút toán đảo (Reversal) hoán đổi tài khoản Nợ/Có của đúng chứng từ nguồn hợp lệ.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã ID bút toán gốc cần đảo:</label>
                <input 
                  type="text"
                  required
                  placeholder="Ví dụ: JE-..."
                  value={correctionEntryId}
                  onChange={(e) => setCorrectionEntryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do sửa sai chứng từ (Bắt buộc):</label>
                <textarea 
                  rows={2}
                  required
                  placeholder="Ghi rõ lý do lập sai, số tiền điều chỉnh..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <label className="flex items-center gap-1.5 font-bold text-slate-800">
                <input 
                  type="checkbox" 
                  checked={correctionPaymentConfirmed}
                  onChange={(e) => setCorrectionPaymentConfirmed(e.target.checked)}
                />
                <span>Đã xác nhận hoàn/thu tiền thực tế (Bắt buộc nếu đảo tiền mặt/ngân hàng)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteCorrection}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo bút toán đảo...' : 'Xác Nhận Tạo Bút Toán Đảo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 8: SAO CHÉP MẪU BÀI ĐĂNG FACEBOOK                   */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showFbPostModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Copy className="w-4 h-4 text-brand-red" />
                Mẫu Bài Đăng Nhóm Facebook CLB
              </h3>
              <button onClick={() => setShowFbPostModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-slate-500">
                Nội dung thông báo lịch trực bàn sách tuần này:
              </p>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-slate-800 leading-relaxed whitespace-pre-wrap select-all">
{`📢 THÔNG BÁO LỊCH TRỰC BÀN SÁCH TUẦN NÀY (CLB YÊU SÁCH BÁCH KHOA)

Chào cả nhà, lịch trực bàn sách tuần này đã được chốt như sau:
📍 Địa điểm: Sảnh Thư viện Tạ Quang Bửu, ĐHBK Hà Nội.
⏰ Khung giờ đón bạn đọc: 14:00 – 17:00

🗓 Chiều Thứ Ba & Thứ Năm hàng tuần
🔗 Xem chi tiết và tra cứu sách tại website CLB.`}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => setShowFbPostModal(false)}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Đóng
                </button>
                <button 
                  onClick={() => {
                    setFbPostCopied(true);
                    setTimeout(() => setFbPostCopied(false), 2000);
                  }}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {fbPostCopied ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép toàn bộ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 9: THÔNG BÁO MÔ PHỎNG XUẤT FILE                     */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showExportModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-brand-navy flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                Mô Phỏng Xuất Dữ Liệu {showExportModal.type}
              </h3>
              <button onClick={() => setShowExportModal({ isOpen: false, type: 'EXCEL', title: '' })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-slate-700 font-semibold">{showExportModal.title}</p>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 leading-relaxed">
                <span className="font-bold">Lưu ý về phạm vi UI Prototype:</span> Chức năng tải file đang ở trạng thái mô phỏng giao diện. Dữ liệu thực tế sẽ được sinh từ endpoint API của backend trong giai đoạn tiếp theo.
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setShowExportModal({ isOpen: false, type: 'EXCEL', title: '' })}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 10: THU TIỀN CỌC MỚI T73 (Phiếu PENDING_DEPOSIT)     */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showConfirmDepositModal.isOpen && showConfirmDepositModal.loan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                Thu Tiền Cọc Mới T73: {showConfirmDepositModal.loan.receiptNumber}
              </h3>
              <button 
                onClick={() => setShowConfirmDepositModal({ isOpen: false, loan: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                <div className="font-bold">{showConfirmDepositModal.loan.borrowerName}</div>
                <div className="text-[11px] text-amber-800">
                  Phiếu chuyển tiếp từ {showConfirmDepositModal.loan.precedingReceiptId || 'kỳ trước'} cần bổ sung tiền cọc mới để kích hoạt mượn.
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl font-bold">
                <span className="text-slate-700">Tiền cọc cần thu:</span>
                <span className="text-base text-brand-navy font-mono tnum">
                  {formatVND(showConfirmDepositModal.loan.totalDepositAmount || showConfirmDepositModal.loan.totalDeposit || 0)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phương thức thu tiền cọc:</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="t73Method" 
                      checked={depositMethodT73 === 'TIEN_MAT'}
                      onChange={() => setDepositMethodT73('TIEN_MAT')}
                    />
                    <span>Tiền mặt (hộp quầy)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="t73Method" 
                      checked={depositMethodT73 === 'CHUYEN_KHOAN'}
                      onChange={() => setDepositMethodT73('CHUYEN_KHOAN')}
                    />
                    <span>Chuyển khoản QR</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input 
                  type="checkbox" 
                  checked={depositConfirmedT73}
                  onChange={(e) => setDepositConfirmedT73(e.target.checked)}
                  className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span>Xác nhận đã thực thu đủ tiền cọc mới vào hộp quầy / tài khoản</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowConfirmDepositModal({ isOpen: false, loan: null })}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting || !depositConfirmedT73}
                  onClick={handleExecuteConfirmNewDeposit}
                  className="px-4 py-2 rounded-md bg-amber-600 text-white font-bold hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang kích hoạt...' : 'Xác Nhận & Kích Hoạt Phiếu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 11: THU TIỀN PHẠT CHỜ THU                           */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showPendingFineModal.isOpen && showPendingFineModal.loan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                Thu Tiền Phạt Chờ Thu: {showPendingFineModal.loan.receiptNumber}
              </h3>
              <button 
                onClick={() => setShowPendingFineModal({ isOpen: false, loan: null, amount: 0 })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="font-bold text-slate-900">{showPendingFineModal.loan.borrowerName}</div>
                <div className="text-[11px] text-slate-500">
                  Thu khoản phạt quá hạn phát sinh chưa nộp trong đợt quyết toán trước.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tiền phạt cần thu (₫):</label>
                <input 
                  type="number"
                  min={1000}
                  step={1000}
                  value={showPendingFineModal.amount}
                  onChange={(e) => setShowPendingFineModal({ ...showPendingFineModal, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-base font-bold text-rose-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phương thức thu phạt:</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="pfMethod" 
                      checked={pendingFineMethod === 'TIEN_MAT'}
                      onChange={() => setPendingFineMethod('TIEN_MAT')}
                    />
                    <span>Tiền mặt</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="pfMethod" 
                      checked={pendingFineMethod === 'CHUYEN_KHOAN'}
                      onChange={() => setPendingFineMethod('CHUYEN_KHOAN')}
                    />
                    <span>Chuyển khoản QR</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input 
                  type="checkbox" 
                  checked={pendingFineConfirmed}
                  onChange={(e) => setPendingFineConfirmed(e.target.checked)}
                  className="rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span>Xác nhận đã thực nhận đủ số tiền phạt vào quỹ</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowPendingFineModal({ isOpen: false, loan: null, amount: 0 })}
                  className="px-3.5 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting || !pendingFineConfirmed || showPendingFineModal.amount <= 0}
                  onClick={handleExecuteCollectPendingFine}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold hover:bg-brand-navy-hover transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang ghi nhận...' : 'Xác Nhận Thu Phạt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 12: BÁO CÁO ĐỐI SOÁT CA TRỰC TIỀN MẶT               */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showSessionSummaryModal && sessionSummaryData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal border border-[#DCDED0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Đối Soát Ca Trực: {sessionSummaryData.sessionDate}
              </h3>
              <button 
                onClick={() => setShowSessionSummaryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">Mã phiên:</span>
                  <div className="font-mono font-bold text-slate-800">{sessionSummaryData.sessionId}</div>
                </div>
                <div>
                  <span className="text-slate-500">Trạng thái:</span>
                  <div>
                    {sessionSummaryData.isClosed ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700">Đã đóng</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Đang hoạt động</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Tiền đầu ca:</span>
                  <div className="font-mono font-bold text-slate-900">{formatVND(sessionSummaryData.openingCash)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Tiền kỳ vọng hiện tại:</span>
                  <div className="font-mono font-bold text-emerald-700">{formatVND(sessionSummaryData.expectedClosingCash)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-700">Tổng hợp dòng tiền (Cash & Bank):</div>
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tổng thu tiền mặt:</span>
                    <span className="font-mono font-semibold text-emerald-600">+{formatVND(sessionSummaryData.totalCashIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tổng chi tiền mặt:</span>
                    <span className="font-mono font-semibold text-rose-600">-{formatVND(sessionSummaryData.totalCashOut)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                    <span>Biến động ròng tiền mặt:</span>
                    <span className="font-mono">{formatVND(sessionSummaryData.netCashMovement)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-700">Chi tiết phân bổ nghiệp vụ:</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">Tiền cọc đã thu (TM):</div>
                    <div className="font-mono font-bold">{formatVND(sessionSummaryData.depositCollectedCash)}</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">Tiền cọc đã hoàn (TM):</div>
                    <div className="font-mono font-bold">{formatVND(sessionSummaryData.depositRefundedCash)}</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">Tiền phạt đã thu (TM):</div>
                    <div className="font-mono font-bold">{formatVND(sessionSummaryData.finesCollectedCash)}</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">Tiền phạt đã thu (CK):</div>
                    <div className="font-mono font-bold">{formatVND(sessionSummaryData.finesCollectedBank)}</div>
                  </div>
                </div>
              </div>

              {sessionSummaryData.pendingRefundsCount > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Cần chú ý hoàn cọc ({sessionSummaryData.pendingRefundsCount} món)
                  </div>
                  <div className="text-[11px] mt-0.5">
                    Tổng tiền cọc chờ hoàn: <strong>{formatVND(sessionSummaryData.pendingRefundsAmount)}</strong>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowSessionSummaryModal(false)}
                  className="px-4 py-2 rounded-md bg-brand-navy text-white font-bold"
                >
                  Đóng Báo Cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 13: THU HỘI PHÍ THÀNH VIÊN 100K MỘT LẦN (CHẶNG 13)        */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {showCollectDuesModal && selectedMemberForDues && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-red" />
                Thu Hội Phí Thành Viên (100k)
              </h3>
              <button
                type="button"
                onClick={() => setShowCollectDuesModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>Thành viên: <strong className="text-slate-900">{selectedMemberForDues.fullName}</strong></div>
              <div>Tài khoản: <span className="font-mono text-slate-700">@{selectedMemberForDues.username}</span> {selectedMemberForDues.studentId ? `· MSSV: ${selectedMemberForDues.studentId}` : ''}</div>
              <div className="text-amber-700 font-semibold pt-1">
                ⚠️ Hội phí thu 1 lần duy nhất trong toàn bộ quãng đời thành viên CLB. Không thu lại ở các năm học sau.
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tiền hội phí:</label>
                <div className="text-xl font-bold font-mono text-brand-navy bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {formatVND(duesAmountInput)}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phương thức thanh toán:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuesPaymentMethod('TIEN_MAT')}
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition ${
                      duesPaymentMethod === 'TIEN_MAT'
                        ? 'border-brand-navy bg-brand-navy/10 text-brand-navy'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Tiền Mặt (Hộp Quầy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuesPaymentMethod('CHUYEN_KHOAN')}
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition ${
                      duesPaymentMethod === 'CHUYEN_KHOAN'
                        ? 'border-brand-navy bg-brand-navy/10 text-brand-navy'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Chuyển Khoản (TK CLB)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diễn giải kỳ thu:</label>
                <input
                  type="text"
                  value={duesTermLabel}
                  onChange={(e) => setDuesTermLabel(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <label className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={duesPaymentConfirmed}
                  onChange={(e) => setDuesPaymentConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-amber-900 font-semibold leading-tight">
                  Tôi xác nhận đã kiểm tra và nhận đủ 100,000 ₫ thực tế (đã bỏ két tiền quầy hoặc có biến động số dư ngân hàng).
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCollectDuesModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={!duesPaymentConfirmed || isSubmitting}
                onClick={handleExecuteCollectDues}
                className="px-4 py-2 rounded-lg bg-brand-red text-white text-xs font-bold hover:bg-brand-red-hover transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Đang hạch toán...' : 'Xác Nhận Thu Hội Phí 100k'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 14: LỊCH SỬ PHÂN BAN & CHỨC VỤ (CHẶNG 13)                  */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {showAffiliationsModal && selectedMemberForAffiliations && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-navy" />
                Lịch Sử Phân Ban: {selectedMemberForAffiliations.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setShowAffiliationsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Thành viên có thể kiêm nhiệm nhiều ban đồng thời trong cùng một nhiệm kỳ hoặc chuyển đổi vai trò theo thời gian.
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {memberAffiliationsList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Chưa có ghi nhận phân ban chi tiết.
                  </div>
                ) : (
                  memberAffiliationsList.map((aff) => {
                    const deptLabel =
                      aff.department === 'BAN_HAU_CAN' ? 'Ban Hậu Cần' :
                      aff.department === 'BAN_NOI_DUNG' ? 'Ban Nội Dung' :
                      aff.department === 'BAN_TTDN' ? 'Ban TT & Đối Ngoại' : 'Ban Chủ Nhiệm';

                    const roleLabel =
                      aff.role === 'CHU_NHIEM' ? 'Chủ Nhiệm' :
                      aff.role === 'PHO_CHU_NHIEM' ? 'Phó Chủ Nhiệm' :
                      aff.role === 'TRUONG_BAN' ? 'Trưởng Ban' :
                      aff.role === 'PHO_BAN' ? 'Phó Ban' : 'Thành Viên';

                    return (
                      <div key={aff.id} className="p-3 bg-white hover:bg-slate-50 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{deptLabel}</div>
                          <div className="text-[11px] text-slate-500">
                            Chức vụ: <span className="font-medium text-slate-700">{roleLabel}</span> · Nhiệm kỳ: {aff.termYear}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Từ {aff.startDate} {aff.endDate ? `đến ${aff.endDate}` : 'đến nay'}
                          </div>
                        </div>
                        <div>
                          {aff.isCurrent ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Đang phụ trách
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              Đã hoàn thành
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAffiliationsModal(false)}
                className="px-4 py-2 rounded-lg bg-brand-navy text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 15: IMPORT & XEM TRƯỚC LỊCH BẬN EXCEL (CHẶNG 14)     */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-3xl w-full p-6 shadow-soft-modal space-y-4 max-h-[90vh] flex flex-col border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Nhập Lịch Bận Thành Viên Từ Excel (.xlsx)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAvailabilityModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Quy định định dạng & An toàn dữ liệu (R08)
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Hệ thống kiểm tra byte bounds nghiêm ngặt (Max 5MB file, Max 25MB uncompressed, Max 2.500 dòng), tự động chặn tệp Macro/VBA.
                  Các tiền tố công thức Excel (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">=, +, -, @</code>) được vô hiệu hóa triệt để.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Kỳ học áp dụng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={availabilityTermSemester}
                    onChange={(e) => setAvailabilityTermSemester(e.target.value)}
                    placeholder="Ví dụ: 2026.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Chọn tệp bảng tính (.xlsx) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleAvailabilityFileChange}
                    className="w-full text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                  {availabilityFileName && (
                    <div className="text-[11px] text-slate-500 mt-1">Đã chọn: {availabilityFileName}</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRunAvailabilityPreview}
                  disabled={!availabilityBase64 || isPreviewingAvailability}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {isPreviewingAvailability ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang phân tích bảng tính...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      Phân Tích Xem Trước (Preview)
                    </>
                  )}
                </button>
              </div>

              {/* Preview Result Presentation */}
              {availabilityPreviewData && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <div className="text-slate-500 text-[10px] font-semibold uppercase">Tổng số dòng</div>
                      <div className="text-lg font-bold text-slate-800">{availabilityPreviewData.totalRows}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <div className="text-emerald-700 text-[10px] font-semibold uppercase">Hợp lệ</div>
                      <div className="text-lg font-bold text-emerald-800">{availabilityPreviewData.validCount}</div>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <div className="text-rose-700 text-[10px] font-semibold uppercase">Bị lỗi</div>
                      <div className="text-lg font-bold text-rose-800">{availabilityPreviewData.errorCount}</div>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                      <div className="text-indigo-700 text-[10px] font-semibold uppercase">Thành viên</div>
                      <div className="text-lg font-bold text-indigo-800">
                        {new Set(availabilityPreviewData.rows.map(r => r.rawMemberIdentifier)).size}
                      </div>
                    </div>
                  </div>

                  {availabilityPreviewData.errorCount > 0 ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Quy tắc Fail-safe:</strong> Có {availabilityPreviewData.errorCount} dòng bị lỗi định dạng hoặc không nhận diện được thành viên.
                        Hệ thống sẽ <u>chỉ lưu các dòng hợp lệ</u>, và các khoảng giờ chưa rõ ràng sẽ không được coi là rảnh khi xếp ca trực.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>Tất cả dữ liệu đều hợp lệ và sẵn sàng lưu vào hệ thống.</div>
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Dòng</th>
                          <th className="py-2 px-3">Thành viên</th>
                          <th className="py-2 px-3">Thứ</th>
                          <th className="py-2 px-3">Khung giờ</th>
                          <th className="py-2 px-3">Loại bận</th>
                          <th className="py-2 px-3 text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {availabilityPreviewData.rows.map((r, idx) => (
                          <tr key={idx} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/60'}>
                            <td className="py-1.5 px-3 font-mono text-slate-500">#{r.rowNumber}</td>
                            <td className="py-1.5 px-3">
                              <span className="font-semibold text-slate-800">
                                {r.resolvedMemberName || r.rawMemberIdentifier}
                              </span>
                              {r.resolvedMemberName && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {r.rawMemberIdentifier}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-slate-700">
                              {r.normalizedDayOfWeek || r.rawDayOfWeek}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-slate-700">
                              {r.normalizedStartTime && r.normalizedEndTime 
                                ? `${r.normalizedStartTime} - ${r.normalizedEndTime}`
                                : `${r.rawStartTime} - ${r.rawEndTime}`}
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              {r.normalizedBusyType || r.rawBusyType || 'BẬN_CỐ_ĐỊNH'}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              {r.isValid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Hợp lệ
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800" title={r.errorMessage}>
                                  Lỗi: {r.errorCode || 'INVALID'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAvailabilityModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleCommitAvailability}
                disabled={
                  !availabilityPreviewData || 
                  availabilityPreviewData.validCount === 0 || 
                  isCommittingAvailability
                }
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
              >
                {isCommittingAvailability ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang lưu vào cơ sở dữ liệu...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Xác Nhận Lưu Lịch Bận (Commit)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 16: TẠO DỰ THẢO LỊCH TRỰC MỚI (CHẶNG 15)            */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showGenerateScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal space-y-4 text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Tạo Dự Thảo Lịch Trực Bằng Solver (Thứ 3 & Thứ 5)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
              <div className="font-bold">Quy tắc xếp ca tự động (R11):</div>
              <p className="text-[11px] leading-relaxed text-blue-800">
                • Trực chính (2 người): Phải qua đào tạo, active, không phải cựu, rảnh toàn bộ 13:45 – 17:15.<br/>
                • Trực hỗ trợ (3-5 người): Chỉ cần rảnh lúc mở ca (13:45-14:15) hoặc đóng ca (16:45-17:15).<br/>
                • Tự động bỏ qua các ngày nghỉ lễ trong lịch CLB. Không tự ý ghi đè ca đã sửa tay.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Kỳ học áp dụng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={draftTermSemester}
                  onChange={(e) => setDraftTermSemester(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={draftEndDate}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftForceOverwrite}
                    onChange={(e) => setDraftForceOverwrite(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-red focus:ring-brand-red"
                  />
                  <span>Ghi đè cả các ca đã chỉnh sửa tay trước đó</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenerateScheduleModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleGenerateDraftSchedules}
                disabled={isGeneratingSchedules}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5"
              >
                {isGeneratingSchedules ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang giải thuật toán...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Chạy Thuật Toán Xếp Lịch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 17: CHỈNH SỬA TAY PHÂN CÔNG CA TRỰC (CHẶNG 15)       */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showManualEditModal && selectedScheduleForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-2xl w-full p-6 shadow-soft-modal space-y-4 max-h-[90vh] flex flex-col text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Chỉnh Sửa Phân Công: {selectedScheduleForEdit.scheduleDate} ({selectedScheduleForEdit.dayOfWeek === 'THU_BA' ? 'Thứ Ba' : 'Thứ Năm'})
                </h3>
                <div className="text-[11px] text-slate-500">
                  Lưu chỉnh sửa tay sẽ tự động kiểm tra Shared Validator và tăng phiên bản lên v{selectedScheduleForEdit.version + 1}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">Danh Sách Phân Công ({editAssigneesList.length} người)</span>
                <button
                  type="button"
                  onClick={() => {
                    if (liveMembers.length === 0) return;
                    setEditAssigneesList((prev) => [
                      ...prev,
                      {
                        memberId: liveMembers[0].id,
                        dutyType: 'SUPPORT',
                        assignedRole: 'LOGISTICS_SETUP',
                      },
                    ]);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm người
                </button>
              </div>

              <div className="space-y-2">
                {editAssigneesList.map((assignee, idx) => {
                  return (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1 min-w-[180px]">
                        <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Thành viên</label>
                        <select
                          value={assignee.memberId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditAssigneesList((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, memberId: val } : it))
                            );
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                        >
                          {liveMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName} (@{m.username})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Loại ca</label>
                        <select
                          value={assignee.dutyType}
                          onChange={(e) => {
                            const val = e.target.value as 'MAIN' | 'SUPPORT';
                            setEditAssigneesList((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, dutyType: val } : it))
                            );
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold"
                        >
                          <option value="MAIN">Trực chính</option>
                          <option value="SUPPORT">Hỗ trợ</option>
                        </select>
                      </div>

                      <div className="w-40">
                        <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Vai trò cụ thể</label>
                        <select
                          value={assignee.assignedRole}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setEditAssigneesList((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, assignedRole: val } : it))
                            );
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="CASH_DRAWER">Kiểm két tiền</option>
                          <option value="CIRCULATION_LOG">Ghi sổ mượn trả</option>
                          <option value="LOGISTICS_SETUP">Chuẩn bị & bàn giao</option>
                          <option value="BOOK_INTRO">Giới thiệu sách</option>
                        </select>
                      </div>

                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setEditAssigneesList((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="px-2 py-1.5 text-rose-600 hover:bg-rose-100 rounded"
                          title="Xóa phân công này"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowManualEditModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveManualEdit}
                disabled={isSavingManualEdit}
                className="px-5 py-2 rounded-lg bg-brand-navy hover:bg-brand-navy-light text-white font-bold transition flex items-center gap-1.5"
              >
                {isSavingManualEdit ? 'Đang lưu...' : 'Lưu Chỉnh Sửa Tay (Manual Edit)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 18: XEM MẪU BÀI ĐĂNG FACEBOOK (CHẶNG 15)             */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showFacebookViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal space-y-4 text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Nội Dung Mẫu Đăng Facebook (Đã Soạn Sẵn)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFacebookViewModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">
                Chỉ tạo mẫu văn bản xem trước, hệ thống không kết nối hoặc gửi trực tiếp tới Facebook API thật.
              </p>
              <textarea
                readOnly
                value={facebookModalContent}
                rows={12}
                className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFacebookViewModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(facebookModalContent);
                  alert('Đã sao chép nội dung vào Clipboard!');
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4" /> Sao Chép Văn Bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 19: XEM CHI TIẾT HỒ SƠ ỨNG VIÊN (CHẶNG 16)          */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showResponseDetailModal && selectedResponseForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-2xl w-full p-6 shadow-soft-modal space-y-4 max-h-[90vh] flex flex-col text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Hồ Sơ Ứng Tuyển: {selectedResponseForDetail.applicantName}
                </h3>
                <div className="text-[11px] text-slate-500">
                  ID: {selectedResponseForDetail.responseId} · Phiên bản: v{selectedResponseForDetail.version}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResponseDetailModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Email:</span>
                  <span className="font-mono">{selectedResponseForDetail.applicantEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Số điện thoại:</span>
                  <span>{selectedResponseForDetail.applicantPhone || 'Chưa cung cấp'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">MSSV:</span>
                  <span>{selectedResponseForDetail.applicantStudentId || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Thời gian nộp:</span>
                  <span>{new Date(selectedResponseForDetail.submissionTimestamp).toLocaleString('vi-VN')}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <div className="font-bold text-blue-900">Nguyện Vọng Đăng Ký:</div>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold text-[11px]">
                    NV1: {selectedResponseForDetail.aspiration1}
                  </span>
                  {selectedResponseForDetail.aspiration2 && (
                    <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                      NV2: {selectedResponseForDetail.aspiration2}
                    </span>
                  )}
                </div>
              </div>

              {selectedResponseForDetail.whyJoin && (
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">Lý do muốn tham gia CLB Sách:</div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedResponseForDetail.whyJoin}
                  </div>
                </div>
              )}

              {selectedResponseForDetail.essayContent && (
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">Bài viết / Cảm nhận cuốn sách yêu thích:</div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedResponseForDetail.essayContent}
                  </div>
                </div>
              )}

              {selectedResponseForDetail.cvLink && (
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">Link CV / Portfolio:</div>
                  <a
                    href={selectedResponseForDetail.cvLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline font-mono break-all"
                  >
                    {selectedResponseForDetail.cvLink}
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResponseDetailModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 20: ĐỐI SOÁT BÙ ĐƠN THIẾU GOOGLE FORM (CHẶNG 16)      */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-xl w-full p-6 shadow-soft-modal space-y-4 max-h-[90vh] flex flex-col text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Đối Soát Checkpoint Bù Đơn Thiếu Google Form / Sheets
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReconcileModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                <div className="font-bold">Quy tắc đối soát bảo toàn (R06, R07):</div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Hệ thống so sánh danh sách <code>responseId</code> từ Google Sheets/Form với CSDL YSBK, tự động bù các đơn bị rớt mạng.
                  <strong> Tuyệt đối không xóa hoặc ghi đè</strong> điểm phỏng vấn, ghi chú, quyết định đã chấm trên website.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mã biểu mẫu (Form ID):</label>
                <input
                  type="text"
                  value={reconcileFormId}
                  onChange={(e) => setReconcileFormId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Dữ liệu phản hồi quan sát được (Mảng JSON):
                </label>
                <textarea
                  rows={8}
                  value={reconcileJsonInput}
                  onChange={(e) => setReconcileJsonInput(e.target.value)}
                  placeholder='[{"formId":"FORM_GEN_10_2026","responseId":"RESP_001","timestamp":"2026-10-15T10:00:00Z","answers":{"Họ và tên":"Nguyễn Văn A","Email":"a@example.com","Nguyện vọng 1":"Hậu Cần"}}]'
                  className="w-full p-2.5 font-mono text-[11px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>

              {reconcileResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Kết Quả Đối Soát Gần Nhất:
                  </div>
                  <div className="text-[11px] grid grid-cols-3 gap-2 pt-1 text-slate-700">
                    <div>Tổng quan sát: <strong>{reconcileResult.totalObserved}</strong></div>
                    <div>Đã có sẵn: <strong>{reconcileResult.syncedCount}</strong></div>
                    <div>Nạp bù mới: <strong className="text-emerald-700">{reconcileResult.missingBackfilledCount}</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReconcileModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleRunReconciliation}
                disabled={isReconciling}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5"
              >
                {isReconciling ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang đối soát...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Chạy Đối Soát Checkpoint
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 21: CHẤM ĐIỂM PHỎNG VẤN & BÀI VIẾT THEO RUBRIC (CHẶNG 17) */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showEvaluationModal && selectedResponseForEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-2xl w-full p-6 shadow-soft-modal space-y-4 max-h-[90vh] flex flex-col text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Phiếu Đánh Giá & Chấm Điểm Tuyển Thành Viên (Chặng 17)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ứng viên: <strong className="text-slate-800">{selectedResponseForEval.applicantName}</strong> · NV1: <strong className="text-blue-700">{selectedResponseForEval.aspiration1}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEvaluationModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {currentRubric && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-800 flex justify-between items-center">
                    <span>{currentRubric.title} (v{currentRubric.version})</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-700">
                      Công thức: {currentRubric.formulaType}
                    </span>
                  </div>
                  {currentRubric.formulaType === 'UNSPECIFIED' && (
                    <p className="text-[11px] text-amber-700">
                      ⚠️ Rubric này chưa xác định công thức tổng hợp chính thức. Điểm tổng hợp chưa tự tính (không tự chọn trung bình cộng theo R07).
                    </p>
                  )}
                </div>
              )}

              {/* Form chấm điểm theo từng tiêu chí */}
              {currentRubric?.criteria && currentRubric.criteria.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-800 text-xs">Điểm Theo Từng Tiêu Chí:</div>
                  <div className="space-y-2">
                    {currentRubric.criteria.map((crit) => (
                      <div key={crit.code} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{crit.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">
                              {crit.section}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Thang {crit.minScore}–{crit.maxScore}, trọng số {crit.weight}x)
                            </span>
                          </div>
                          {crit.description && <div className="text-[11px] text-slate-500">{crit.description}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={crit.minScore}
                            max={crit.maxScore}
                            step="0.5"
                            value={evalScores[crit.code] ?? ''}
                            onChange={(e) => setEvalScores({ ...evalScores, [crit.code]: Number(e.target.value) })}
                            className="w-16 px-2 py-1 text-center font-bold font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                            placeholder="0"
                          />
                          <span className="text-slate-400 font-mono">/ {crit.maxScore}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ghi chú nhận xét phỏng vấn */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-semibold">Ghi chú & Nhận xét phỏng vấn / bài viết:</label>
                <textarea
                  rows={3}
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  placeholder="Nhận xét điểm mạnh, điểm cần phát triển, thái độ, mức độ phù hợp với CLB..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>

              {/* Đề xuất sơ bộ */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-semibold">Đề xuất sơ bộ của người phỏng vấn:</label>
                <select
                  value={evalDecision}
                  onChange={(e) => setEvalDecision(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  <option value="PENDING">Chưa chốt đề xuất (PENDING)</option>
                  <option value="PASSED">Đạt yêu cầu (PASSED)</option>
                  <option value="RESERVE">Dự bị (RESERVE)</option>
                  <option value="FAILED">Không đạt (FAILED)</option>
                </select>
              </div>

              {/* Nếu đang sửa: Bắt buộc nhập lý do */}
              {editingEvalId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="font-bold text-amber-900 flex justify-between">
                    <span>Đang sửa đổi bản ghi đánh giá (v{editingEvalExpectedVersion})</span>
                    <button
                      type="button"
                      onClick={() => { setEditingEvalId(null); setEvalEditReason(''); }}
                      className="text-amber-700 underline text-[10px]"
                    >
                      Hủy chế độ sửa
                    </button>
                  </div>
                  <label className="block text-[11px] text-amber-800 font-semibold">
                    Lý do sửa đổi điểm đánh giá (Bắt buộc theo quy tắc Audit R07):
                  </label>
                  <input
                    type="text"
                    value={evalEditReason}
                    onChange={(e) => setEvalEditReason(e.target.value)}
                    placeholder="e.g. Hội ý lại sau bài viết, điều chỉnh điểm tiêu chí kỹ năng..."
                    className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Danh sách các phiếu đánh giá độc lập đã nộp cho ứng viên này */}
              {evalListForResponse.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="font-bold text-slate-800 text-xs">
                    Phiếu Chấm Độc Lập Từ Các Người Phỏng Vấn ({evalListForResponse.length}):
                  </div>
                  <div className="space-y-2">
                    {evalListForResponse.map((ev) => (
                      <div key={ev.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
                        <div className="flex justify-between items-center font-bold">
                          <span>Người chấm: {ev.evaluatorId} (v{ev.version})</span>
                          <span className="font-mono text-emerald-700">
                            Điểm: {ev.totalScore !== null ? `${ev.totalScore} đ` : 'Chưa tổng hợp'}
                          </span>
                        </div>
                        {ev.interviewNotes && <div className="text-[11px] text-slate-600 italic">"{ev.interviewNotes}"</div>}
                        <div className="flex gap-2 pt-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvalId(ev.id);
                              setEditingEvalExpectedVersion(ev.version);
                              setEvalScores(ev.rawScores || {});
                              setEvalNotes(ev.interviewNotes || '');
                              setEvalDecision((ev.decision as any) || 'PENDING');
                            }}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            Sửa Điểm Này
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => handleViewEvalHistory(ev.id)}
                            className="text-slate-500 hover:underline"
                          >
                            Xem Lịch Sử Audit Sửa Đổi
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bảng lịch sử sửa đổi Audit nếu đang mở */}
              {showHistoryForEvalId && (
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl space-y-2">
                  <div className="font-bold text-slate-800 text-xs flex justify-between">
                    <span>Nhật Ký Audit Lịch Sử Sửa Đổi ({showHistoryForEvalId}):</span>
                    <button
                      type="button"
                      onClick={() => setShowHistoryForEvalId(null)}
                      className="text-slate-500 text-[10px] hover:underline"
                    >
                      Đóng
                    </button>
                  </div>
                  {evalHistoryList.length > 0 ? (
                    <div className="space-y-1.5">
                      {evalHistoryList.map((h) => (
                        <div key={h.id} className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] space-y-0.5">
                          <div className="font-bold text-slate-800 flex justify-between">
                            <span>Người sửa: {h.modifiedBy} · v{h.previousVersion} → v{h.newVersion}</span>
                            <span className="font-mono text-slate-400">{new Date(h.modifiedAt).toLocaleString('vi-VN')}</span>
                          </div>
                          <div className="text-slate-700">Lý do: <em>{h.reason}</em></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">Chưa có lần chỉnh sửa nào (Bản ghi nguyên bản v1).</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEvaluationModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSubmitEvaluation}
                disabled={isSubmittingEval}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5"
              >
                {isSubmittingEval ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4" />
                    {editingEvalId ? 'Lưu Sửa Đổi Kèm Lý Do' : 'Lưu Phiếu Đánh Giá'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 22: TỔNG KẾT HỘI ĐỒNG & CHUYỂN THÀNH VIÊN (CHẶNG 17)  */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showDecisionModal && selectedResponseForDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-xl w-full p-6 shadow-soft-modal space-y-4 max-h-[90vh] flex flex-col text-xs border border-[#DCDED0]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  Hội Đồng Tuyển Dụng Tổng Kết & Ban Hành Quyết Định (Chặng 17)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ứng viên: <strong className="text-slate-800">{selectedResponseForDecision.applicantName}</strong> (Mã đơn: {selectedResponseForDecision.responseId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDecisionModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1 text-purple-900">
                <div className="font-bold">Quy tắc Hội đồng & Phân ban (D33, D36):</div>
                <p className="text-[11px] leading-relaxed text-purple-800">
                  Hội đồng họp tổng kết sau khi có đầy đủ điểm phỏng vấn độc lập. Ban được tuyển có thể khác với nguyện vọng 1 và 2 đã đăng ký trong form.
                </p>
              </div>

              {/* Chọn Quyết định */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-semibold">Quyết định của Hội đồng:</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer font-bold transition ${
                    committeeDecisionChoice === 'PASSED' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="commDecision"
                      checked={committeeDecisionChoice === 'PASSED'}
                      onChange={() => setCommitteeDecisionChoice('PASSED')}
                    />
                    <span>TRÚNG TUYỂN (PASSED)</span>
                  </label>
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer font-bold transition ${
                    committeeDecisionChoice === 'RESERVE' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="commDecision"
                      checked={committeeDecisionChoice === 'RESERVE'}
                      onChange={() => setCommitteeDecisionChoice('RESERVE')}
                    />
                    <span>DỰ BỊ (RESERVE)</span>
                  </label>
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer font-bold transition ${
                    committeeDecisionChoice === 'FAILED' ? 'bg-rose-50 border-rose-500 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="commDecision"
                      checked={committeeDecisionChoice === 'FAILED'}
                      onChange={() => setCommitteeDecisionChoice('FAILED')}
                    />
                    <span>KHÔNG ĐẠT (FAILED)</span>
                  </label>
                </div>
              </div>

              {/* Phân ban phân công */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-semibold">
                  Ban Phân Bổ (Có thể khác NV1: {selectedResponseForDecision.aspiration1}):
                </label>
                <select
                  value={assignedDeptChoice}
                  onChange={(e) => setAssignedDeptChoice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="BAN_HAU_CAN">Ban Hậu Cần</option>
                  <option value="BAN_NOI_DUNG">Ban Nội Dung</option>
                  <option value="BAN_TTDN">Ban Truyền Thông & Đối Ngoại</option>
                  <option value="BAN_CHU_NHIEM">Ban Chủ Nhiệm</option>
                </select>
              </div>

              {/* Ghi chú hội đồng */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-semibold">Biên bản / Ghi chú quyết định của Hội đồng:</label>
                <textarea
                  rows={3}
                  value={committeeNotesInput}
                  onChange={(e) => setCommitteeNotesInput(e.target.value)}
                  placeholder="Ghi nhận thảo luận của Hội đồng, lý do xếp ban, điều kiện thực tập..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {/* Nút lưu quyết định */}
              <div className="flex justify-between items-center">
                {decisionRecord ? (
                  <div className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                    Đã lưu quyết định: {decisionRecord.decision} ({decisionRecord.assignedDepartment})
                  </div>
                ) : <div />}
                <button
                  type="button"
                  onClick={handleFinalizeDecision}
                  disabled={isSubmittingDecision}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" />
                  Ban Hành Quyết Định Hội Đồng
                </button>
              </div>

              {/* Vùng chuyển đổi thành viên (Chỉ khi PASSED) */}
              {committeeDecisionChoice === 'PASSED' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-900 pt-3">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    Tiếp nhận ứng viên trúng tuyển thành cộng tác viên
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Ứng viên bắt đầu là <strong>cộng tác viên thử thách 1 tháng</strong>. Sau thời gian này, quản lý đánh giá và công nhận thành viên tại Quản Trị & Nội Dung.
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleConvertMember}
                      disabled={isConvertingMember}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      {isConvertingMember ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang chuyển đổi...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Tiếp Nhận Cộng Tác Viên
                        </>
                      )}
                    </button>
                    {convertedMemberId && (
                      <span className="font-bold font-mono text-emerald-800 text-[11px] bg-emerald-100 px-2.5 py-1 rounded-lg">
                        Mã TV: {convertedMemberId}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDecisionModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 23: TẠO NHÀ SÁCH & NHẬP LÔ SÁCH KÝ GỬI (CHẶNG 18)       */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {showCreateSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full shadow-soft-modal border border-[#DCDED0] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-500" />
                Thêm Đối Tác Nhà Sách / Nhà Cung Cấp
              </h3>
              <button onClick={() => setShowCreateSupplierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mã Nhà Sách (Viết hoa, không dấu) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: NHA_NAM, KIM_DONG, FAHASA"
                  value={newSupplierCode}
                  onChange={(e) => setNewSupplierCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tên Nhà Sách / NXB *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Công ty CP Văn Hóa và Truyền Thông Nhã Nam"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Người Liên Hệ</label>
                  <input
                    type="text"
                    placeholder="Tên đại diện"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    placeholder="09..."
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateSupplierModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-brand-navy hover:bg-brand-navy-hover text-white font-bold transition"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Tạo Nhà Sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateLotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full shadow-soft-modal border border-[#DCDED0] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                Nhập Lô Sách Ký Gửi Mới (Chặng 18)
              </h3>
              <button onClick={() => setShowCreateLotModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLot} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mã Lô Sách *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: LOT-2026-001"
                    value={newLotBatchCode}
                    onChange={(e) => setNewLotBatchCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nhà Sách Đối Tác *</label>
                  <select
                    required
                    value={newLotSupplierId}
                    onChange={(e) => setNewLotSupplierId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn Nhà Sách --</option>
                    {liveSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tên Đợt / Chiến Dịch Bán *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Hội Sách Mùa Thu 2026, Chào Tân Sinh Viên K69"
                  value={newLotCampaign}
                  onChange={(e) => setNewLotCampaign(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tiền Cọc Nhà Sách (Nếu có thỏa thuận cọc)</label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="0 nếu không cọc, hoặc ví dụ 1,000,000"
                  value={newLotDeposit}
                  onChange={(e) => setNewLotDeposit(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
                <span className="text-[10px] text-slate-400">Tách biệt hoàn toàn với tiền cọc bạn đọc. Không cọc = 0 ₫.</span>
              </div>

              {newLotDeposit > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="font-bold text-amber-900 text-xs uppercase">Xác Nhận Thực Chi Cọc (RF-02)</div>
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={newLotDepositConfirmed}
                      onChange={(e) => setNewLotDepositConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Xác nhận đã thực chi cọc {formatVND(newLotDeposit)} ngay khi tạo lô (để ghi PAID và bút toán chi Quỹ Hoạt Động). Nếu chưa chi, bỏ chọn để ghi nhận dự kiến.</span>
                  </label>
                  {newLotDepositConfirmed && (
                    <div>
                      <label className="font-semibold text-amber-900 block mb-1">Phương Thức Thực Chi *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewLotDepositPaymentMethod('BANK_TRANSFER')}
                          className={`p-2 rounded-lg border font-bold text-center text-xs transition ${
                            newLotDepositPaymentMethod === 'BANK_TRANSFER' ? 'border-amber-600 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          Chuyển Khoản (BANK)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewLotDepositPaymentMethod('CASH')}
                          className={`p-2 rounded-lg border font-bold text-center text-xs transition ${
                            newLotDepositPaymentMethod === 'CASH' ? 'border-amber-600 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          Tiền Mặt (CASH)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 text-[11px] uppercase">Thông Tin Đầu Sách Nhập Theo Lô</div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tên Sách Mới *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Tuổi trẻ đáng giá bao nhiêu"
                    value={newLotBookTitle}
                    onChange={(e) => setNewLotBookTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Giá Bìa (Niêm Yết)</label>
                    <input
                      type="number"
                      min="0"
                      value={newLotCoverPrice}
                      onChange={(e) => setNewLotCoverPrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Chiết Khấu Nhập (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newLotDiscount}
                      onChange={(e) => setNewLotDiscount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Giá Bán Tại Quầy</label>
                    <input
                      type="number"
                      min="0"
                      value={newLotRetailPrice}
                      onChange={(e) => setNewLotRetailPrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Số Lượng Nhận Ban Đầu *</label>
                    <input
                      type="number"
                      min="1"
                      value={newLotQuantity}
                      onChange={(e) => setNewLotQuantity(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-1">
                  Giá nhập sau CK: <span className="font-bold text-rose-700">{formatVND(Math.round(newLotCoverPrice * (1 - newLotDiscount / 100)))}</span> · Lãi gộp mỗi cuốn: <span className="font-bold text-emerald-700">{formatVND(newLotRetailPrice - Math.round(newLotCoverPrice * (1 - newLotDiscount / 100)))}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateLotModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Xác Nhận Nhập Lô'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 24: BÁN SÁCH TẠI QUẦY (CHẶNG 18)                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {showSellBookModal && selectedLotItemForSale && selectedLotForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full shadow-soft-modal border border-[#DCDED0] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                Bán Sách Mới Tại Quầy
              </h3>
              <button onClick={() => setShowSellBookModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-slate-900 text-sm">{selectedLotItemForSale.bookTitle}</div>
              <div className="text-slate-500">Thuộc lô: <span className="font-mono font-bold text-slate-700">{selectedLotForAction.batchCode}</span> ({selectedLotForAction.campaignName})</div>
              <div className="flex justify-between items-center pt-1 font-mono">
                <span className="text-slate-600">Đơn giá bán: <strong className="text-emerald-700">{formatVND(selectedLotItemForSale.retailPrice)}</strong></span>
                <span className="text-slate-600">Khả dụng: <strong className="text-brand-navy">{selectedLotItemForSale.availableQuantity} cuốn</strong></span>
              </div>
            </div>

            <form onSubmit={handleExecuteSellBook} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Số Lượng Bán (Tối đa {selectedLotItemForSale.availableQuantity}) *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedLotItemForSale.availableQuantity}
                  value={saleQuantityInput}
                  onChange={(e) => setSaleQuantityInput(Math.min(selectedLotItemForSale.availableQuantity, Math.max(1, Number(e.target.value))))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Hình Thức Thanh Toán (Thu Đủ Ngay) *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSalePaymentMethod('CASH')}
                    className={`p-2.5 rounded-lg border font-bold text-center transition ${
                      salePaymentMethod === 'CASH' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Tiền Mặt (CASH)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalePaymentMethod('BANK_TRANSFER')}
                    className={`p-2.5 rounded-lg border font-bold text-center transition ${
                      salePaymentMethod === 'BANK_TRANSFER' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Chuyển Khoản (BANK)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tên Khách Mua (Không bắt buộc)</label>
                <input
                  type="text"
                  placeholder="Họ tên hoặc MSSV bạn đọc"
                  value={saleCustomerName}
                  onChange={(e) => setSaleCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-bold text-emerald-900">
                <span>TỔNG TIỀN PHẢI THU:</span>
                <span className="text-base font-mono">{formatVND(saleQuantityInput * selectedLotItemForSale.retailPrice)}</span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <label className="flex items-start gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={salePaymentConfirmed}
                    onChange={(e) => setSalePaymentConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Tôi xác nhận đã nhận đủ tiền thực tế ({formatVND(saleQuantityInput * selectedLotItemForSale.retailPrice)}) từ khách mua sách qua {salePaymentMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}. Tuyệt đối không cho nợ (RF-02).</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSellBookModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !salePaymentConfirmed}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Đã Thu Tiền & Bán'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 25: TRẢ SÁCH DƯ VẬT LÝ VỀ NHÀ SÁCH (T56, T59)           */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {showReturnBooksModal && selectedLotItemForSale && selectedLotForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full shadow-soft-modal border border-[#DCDED0] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-rose-600" />
                Trả Sách Dư Vật Lý Về Nhà Sách
              </h3>
              <button onClick={() => setShowReturnBooksModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
              <div className="font-bold">{selectedLotItemForSale.bookTitle}</div>
              <div>Thuộc lô: {selectedLotForAction.batchCode} · Nhà sách: {selectedLotForAction.supplierName || 'Đối tác'}</div>
              <div>Số lượng khả dụng có thể trả: <strong>{selectedLotItemForSale.availableQuantity} cuốn</strong></div>
              <p className="text-[10px] text-rose-700 mt-1 italic font-medium">
                ⚠️ Quy tắc T56 & T59: Trả hàng vật lý chỉ ghi nhận số lượng trả, tuyệt đối không tự động xác nhận hoàn tiền ngân hàng/tiền mặt.
              </p>
            </div>

            <form onSubmit={handleExecuteReturnBooks} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Số Lượng Trả Về *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedLotItemForSale.availableQuantity}
                  value={returnQuantityInput}
                  onChange={(e) => setReturnQuantityInput(Math.min(selectedLotItemForSale.availableQuantity, Math.max(1, Number(e.target.value))))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Người Đại Diện Nhà Sách Nhận Bàn Giao</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đại diện NXB Nhã Nam"
                  value={returnRecipientName}
                  onChange={(e) => setReturnRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Số Biên Bản / Ghi Chú Chứng Từ</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Biên bản bàn giao số 102/BBBG"
                  value={returnProofNotes}
                  onChange={(e) => setReturnProofNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReturnBooksModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Đã Trả Hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 26: QUYẾT TOÁN NHÀ SÁCH & THANH TOÁN / HOÀN CỌC (T68, T69) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {showSettlementModal && selectedLotForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-xl w-full shadow-soft-modal border border-[#DCDED0] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Quyết Toán Lô Sách Ký Gửi ({selectedLotForAction.batchCode})
              </h3>
              <button onClick={() => setShowSettlementModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bảng so khớp số lượng bảo toàn invariant */}
            {(() => {
              const preview = activeSettlement || settlementPreview;
              if (!preview) {
                return <div className="text-xs text-slate-400">Đang tải số liệu quyết toán...</div>;
              }

              return (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Sách Đã Bán</div>
                      <div className="text-lg font-bold font-mono text-emerald-700">{preview.totalSoldBooks}</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Sách Đã Trả Dư</div>
                      <div className="text-lg font-bold font-mono text-rose-700">{preview.totalReturnedBooks}</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Giữ Lại Bán Tiếp</div>
                      <div className="text-lg font-bold font-mono text-amber-700">{preview.totalRetainedBooks}</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Tình Trạng</div>
                      <div className="text-xs font-bold text-slate-700 mt-1">
                        {activeSettlement ? 'Đã Quyết Toán' : 'Bản Xem Trước'}
                      </div>
                    </div>
                  </div>

                  {/* Tính toán tiền theo chuẩn T68 / T69 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Tổng doanh thu bán sách:</span>
                      <span className="font-bold font-mono text-emerald-800">{formatVND(preview.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Tiền nợ nhà sách (Giá vốn sách đã bán):</span>
                      <span className="font-bold font-mono text-rose-800">{formatVND(preview.payableToSupplier)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-1">
                      <span className="text-slate-700 font-bold">Chênh lệch gộp (Lãi trước chi phí):</span>
                      <span className="font-bold font-mono text-brand-navy">{formatVND(preview.grossProfit)}</span>
                    </div>

                    <div className="border-t border-slate-200 pt-2 mt-2 space-y-1 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tiền cọc CLB đã chi:</span>
                        <span className="font-mono font-medium">{formatVND(preview.depositPaid)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Cọc kỳ vọng nhà sách hoàn trả:</span>
                        <span className="font-mono font-bold text-indigo-700">{formatVND(preview.depositRefundExpected)}</span>
                      </div>
                      {preview.depositPaid === 0 && (
                        <p className="text-[10px] text-slate-400 italic">
                          (Quy tắc T68: Lô không cọc thì không sinh khoản tiền hoàn nào; chỉ thanh toán tiền sách đã bán).
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Nếu chưa lập quyết toán chính thức */}
                  {!activeSettlement ? (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={handleExecuteCreateSettlement}
                        disabled={isSubmitting}
                        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm"
                      >
                        {isSubmitting ? 'Đang lập...' : 'Chốt Lập Chứng Từ Quyết Toán Chính Thức'}
                      </button>
                    </div>
                  ) : (
                    /* Khi đã có quyết toán chính thức */
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Khối thanh toán nợ tiền sách */}
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                          <div className="font-bold text-rose-900 text-xs uppercase">Thanh Toán Tiền Sách Bán</div>
                          <div className="text-[11px] text-slate-600">
                            Đã trả: <strong className="font-mono">{formatVND(activeSettlement.paidToSupplier)}</strong> / {formatVND(activeSettlement.payableToSupplier)}
                          </div>
                          <div className="text-[10px] font-bold text-rose-800">
                            Trạng thái: {activeSettlement.paymentStatus}
                          </div>
                          {activeSettlement.paidToSupplier < activeSettlement.payableToSupplier && (
                            <button
                              type="button"
                              onClick={() => handleOpenSupplierPaymentModal('PAY_SUPPLIER_PAYABLE', activeSettlement.payableToSupplier - activeSettlement.paidToSupplier)}
                              disabled={isSubmitting}
                              className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition shadow-xs"
                            >
                              Trả Nốt {formatVND(activeSettlement.payableToSupplier - activeSettlement.paidToSupplier)}
                            </button>
                          )}
                        </div>

                        {/* Khối nhận hoàn cọc */}
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                          <div className="font-bold text-indigo-900 text-xs uppercase">Nhận Hoàn Cọc Nhà Sách</div>
                          <div className="text-[11px] text-slate-600">
                            Đã nhận: <strong className="font-mono">{formatVND(activeSettlement.depositRefundReceived)}</strong> / {formatVND(activeSettlement.depositRefundExpected)}
                          </div>
                          <div className="text-[10px] font-bold text-indigo-800">
                            Trạng thái: {activeSettlement.depositRefundStatus}
                          </div>
                          {activeSettlement.depositRefundExpected > 0 && activeSettlement.depositRefundReceived < activeSettlement.depositRefundExpected && (
                            <button
                              type="button"
                              onClick={() => handleOpenSupplierPaymentModal('RECEIVE_DEPOSIT_REFUND', activeSettlement.depositRefundExpected - activeSettlement.depositRefundReceived)}
                              disabled={isSubmitting}
                              className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition shadow-xs"
                            >
                              Nhận Hoàn {formatVND(activeSettlement.depositRefundExpected - activeSettlement.depositRefundReceived)}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lịch sử các dòng thanh toán thực tế */}
                      {settlementPayments.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="font-bold text-slate-700 text-[11px]">Lịch Sử Giao Dịch Xác Nhận ({settlementPayments.length}):</div>
                          <div className="space-y-1">
                            {settlementPayments.map((p) => (
                              <div key={p.id} className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-[11px]">
                                <div>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-2 ${
                                    p.paymentType === 'PAY_SUPPLIER_PAYABLE' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {p.paymentType === 'PAY_SUPPLIER_PAYABLE' ? 'CHI TRẢ NỢ' : 'THU HOÀN CỌC'}
                                  </span>
                                  <span className="font-mono text-slate-500">{p.paymentCode}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-900">{formatVND(p.amount)} ({p.paymentMethod})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 26b: XÁC NHẬN THANH TOÁN TIỀN NHÀ SÁCH / HOÀN CỌC (RF-02) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {showSupplierPaymentModal && activeSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-md w-full shadow-soft-modal border border-[#DCDED0] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                {supplierPaymentType === 'PAY_SUPPLIER_PAYABLE' ? 'Thanh Toán Tiền Sách Cho Nhà Sách' : 'Nhận Hoàn Lại Tiền Cọc Từ Nhà Sách'}
              </h3>
              <button onClick={() => setShowSupplierPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSupplierPayment} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="text-slate-500">Mã quyết toán: <strong className="font-mono text-slate-800">{activeSettlement.settlementCode}</strong></div>
                <div className="text-slate-500">Số tiền giao dịch: <strong className="font-mono text-indigo-700 text-sm">{formatVND(supplierPaymentAmount)}</strong></div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Phương Thức Thanh Toán Thực Tế *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierPaymentMethod('BANK_TRANSFER')}
                    className={`p-2.5 rounded-lg border font-bold text-center transition ${
                      supplierPaymentMethod === 'BANK_TRANSFER' ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Chuyển Khoản (BANK)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierPaymentMethod('CASH')}
                    className={`p-2.5 rounded-lg border font-bold text-center transition ${
                      supplierPaymentMethod === 'CASH' ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Tiền Mặt (CASH)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mã Chứng Từ / Tham Chiếu Giao Dịch Thực Tế *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Mã GD UNC Vietcombank, FT2409..., hoặc Số phiếu chi PC-001"
                  value={supplierPaymentRefDoc}
                  onChange={(e) => setSupplierPaymentRefDoc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
                <span className="text-[10px] text-slate-400">Bắt buộc nhập mã tham chiếu giao dịch thực tế, không dùng mã tự sinh.</span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ghi Chú Giao Dịch</label>
                <input
                  type="text"
                  value={supplierPaymentNotes}
                  onChange={(e) => setSupplierPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="flex items-start gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={supplierPaymentConfirmed}
                    onChange={(e) => setSupplierPaymentConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Tôi xác nhận giao dịch tiền thực tế ({formatVND(supplierPaymentAmount)}) đã hoàn tất qua ngân hàng hoặc tiền mặt (RF-02).</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplierPaymentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !supplierPaymentConfirmed || !supplierPaymentRefDoc.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Thực Hiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 27: TẠO SỰ KIỆN MỚI                                         */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Tạo Hoạt Động / Sự Kiện Mới
              </h3>
              <button onClick={() => setIsNewEventModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tiêu đề hoạt động / sự kiện *</label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Ví dụ: Tọa đàm 'Văn hóa đọc thời đại số'"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại hoạt động</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="WORKSHOP">Workshop</option>
                    <option value="TALKSHOW">Tọa đàm / Talkshow</option>
                    <option value="BOOK_FAIR">Hội sách / Bán sách</option>
                    <option value="INTERNAL_MEETING">Họp nội bộ</option>
                    <option value="VOLUNTEER">Tình nguyện</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày diễn ra *</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa điểm</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dự toán ngân sách ban đầu (VNĐ)</label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={newEventBudget}
                  onChange={(e) => setNewEventBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  rows={3}
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  placeholder="Mục đích, thành phần tham gia, nội dung chính..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEventApprovedPublic}
                    onChange={(e) => setNewEventApprovedPublic(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-slate-800">Phê duyệt hiển thị công chúng (Public DTO)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEventApprovedAlumni}
                    onChange={(e) => setNewEventApprovedAlumni(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">Phê duyệt hiển thị Cựu thành viên (Alumni Allowlist)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-bold transition"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Sự Kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 28: CHI TIẾT SỰ KIỆN, NHIỆM VỤ, NGƯỜI THAM GIA, KẾ TOÁN     */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isEventDetailModalOpen && selectedEventDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {selectedEventDetail.activity.eventType}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {selectedEventDetail.activity.status}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-brand-navy mt-1">
                  {selectedEventDetail.activity.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedEventDetail.activity.eventDate} | {selectedEventDetail.activity.location || 'Chưa rõ địa điểm'}
                </p>
              </div>
              <button onClick={() => setIsEventDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thống kê tài chính sự kiện (Single Count) */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Tổng Dự Toán</div>
                <div className="text-sm font-mono font-bold text-slate-900">{formatVND(selectedEventDetail.financialSummary.totalBudget)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Chi Thực Tế (Sổ Quỹ)</div>
                <div className="text-sm font-mono font-bold text-rose-700">{formatVND(selectedEventDetail.financialSummary.totalExpense)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Chênh Lệch Dự Toán</div>
                <div className={`text-sm font-mono font-bold ${selectedEventDetail.financialSummary.budgetVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatVND(selectedEventDetail.financialSummary.budgetVariance)}
                </div>
              </div>
            </div>

            {/* Section 1: Phân công nhiệm vụ (Audit Log) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wide text-brand-navy flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Nhiệm Vụ Phân Công ({selectedEventDetail.tasks.length})
                </h4>
                <button
                  onClick={() => setIsNewTaskModalOpen(true)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-brand-navy text-white hover:bg-slate-800 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm Việc
                </button>
              </div>

              {selectedEventDetail.tasks.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg text-slate-400 text-xs text-center">Chưa có nhiệm vụ nào.</div>
              ) : (
                <div className="divide-y border rounded-lg text-xs">
                  {selectedEventDetail.tasks.map((t) => (
                    <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            t.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                            t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.status}
                          </span>
                          <span className="font-bold text-slate-900">{t.title}</span>
                          <span className="text-[10px] px-1 bg-amber-50 text-amber-700 rounded font-semibold border border-amber-200">
                            {t.priority}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Phụ trách: {t.assigneeName || 'Chưa gán'} | Hạn: {t.dueDate || 'Không hạn'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedTaskForEdit(t);
                            setEditTaskTitle(t.title);
                            setEditTaskStatus(t.status);
                            setEditTaskReason('');
                            setIsEditTaskModalOpen(true);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-[11px] text-slate-700"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleOpenTaskHistoryModal(t.id)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded font-semibold text-[11px] text-indigo-700"
                        >
                          Lịch Sử
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Người tham gia (R07: Member hoặc Guest không ép MSSV) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wide text-brand-navy flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Người Tham Gia ({selectedEventDetail.participants.length})
                </h4>
                <button
                  onClick={() => setIsNewParticipantModalOpen(true)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm Người Tham Gia
                </button>
              </div>

              {selectedEventDetail.participants.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg text-slate-400 text-xs text-center">Chưa có người tham gia đăng ký.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedEventDetail.participants.map((p) => (
                    <div key={p.id} className="p-2.5 border rounded-lg flex items-center justify-between bg-slate-50/50">
                      <div>
                        <div className="font-bold text-slate-900">
                          {p.participantType === 'MEMBER' ? p.memberName : p.guestName}
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            p.participantType === 'MEMBER' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.participantType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Vai trò: {p.role} | {p.guestEmail || p.guestPhone || 'Không có liên hệ riêng'}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'ATTENDED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Dự toán & Chi phí thực tế (Liên kết Quỹ) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              {/* Dự toán */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase text-slate-700">Dự Toán Ước Tính</h4>
                  <button
                    onClick={() => setIsNewBudgetItemModalOpen(true)}
                    className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    + Dự Toán
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  {selectedEventDetail.budgetItems.map((b) => (
                    <div key={b.id} className="p-2 bg-slate-50 rounded flex justify-between items-center border">
                      <div>
                        <span className="font-bold text-slate-800">{b.category}:</span> {b.description}
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatVND(b.estimatedAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chi phí thực tế */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase text-rose-700">Chi Thực Tế (Sổ Kép)</h4>
                  <button
                    onClick={() => setIsNewExpenseModalOpen(true)}
                    className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold"
                  >
                    + Ghi Chi Phí
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  {selectedEventDetail.expenses.map((e) => (
                    <div key={e.id} className="p-2 bg-rose-50/50 rounded flex justify-between items-center border border-rose-100">
                      <div>
                        <div className="font-bold text-rose-900">{e.description}</div>
                        <div className="text-[10px] text-slate-500">
                          {e.expenseDate} | Người chi: {e.payerName || 'Thành viên'} ({e.paymentMethod})
                        </div>
                      </div>
                      <span className="font-mono font-bold text-rose-700">{formatVND(e.actualAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setIsEventDetailModalOpen(false)}
                className="px-4 py-2 rounded-lg border text-slate-600 font-semibold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 29: THÊM NHIỆM VỤ                                           */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-brand-navy border-b pb-2">Thêm Nhiệm Vụ Mới</h3>
            <form onSubmit={handleExecuteCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên nhiệm vụ *</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Ví dụ: Thiết kế standee, liên hệ diễn giả..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả</label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ưu tiên</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hạn xong</label>
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Người phụ trách</label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">-- Chưa gán người phụ trách --</option>
                  {liveMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.username})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-brand-navy hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Lưu Nhiệm Vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 30: SỬA NHIỆM VỤ (BẮT BUỘC NHẬP LÝ DO - AUDIT LOG)         */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isEditTaskModalOpen && selectedTaskForEdit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-brand-navy border-b pb-2">
              Sửa Nhiệm Vụ (Kèm Nhật Ký Kiểm Toán)
            </h3>
            <form onSubmit={handleExecuteUpdateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên nhiệm vụ</label>
                <input
                  type="text"
                  value={editTaskTitle}
                  onChange={(e) => setEditTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trạng thái</label>
                <select
                  value={editTaskStatus}
                  onChange={(e) => setEditTaskStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="TODO">Cần làm (TODO)</option>
                  <option value="IN_PROGRESS">Đang làm (IN_PROGRESS)</option>
                  <option value="DONE">Hoàn thành (DONE)</option>
                  <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-rose-700 mb-1">Lý do thay đổi * (Bắt buộc theo quy định kiểm toán)</label>
                <input
                  type="text"
                  required
                  value={editTaskReason}
                  onChange={(e) => setEditTaskReason(e.target.value)}
                  placeholder="Ví dụ: Hoàn tất nghiệm thu thiết kế, gia hạn thời gian..."
                  className="w-full px-3 py-2 border border-rose-300 rounded-lg focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditTaskModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editTaskReason.trim()}
                  className="px-3 py-1.5 bg-brand-navy hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Lưu & Ghi Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 31: XEM LỊCH SỬ AUDIT LOG CỦA NHIỆM VỤ                       */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isTaskHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-brand-navy">Nhật Ký Kiểm Toán Nhiệm Vụ</h3>
              <button onClick={() => setIsTaskHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {taskHistoryList.length === 0 ? (
              <div className="p-4 bg-slate-50 text-slate-400 text-xs text-center rounded-lg">
                Chưa có ghi nhận chỉnh sửa nào.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {taskHistoryList.map((h) => (
                  <div key={h.id} className="p-3 border rounded-lg bg-slate-50 space-y-1">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Trường: {h.fieldName}</span>
                      <span className="text-[10px] text-slate-400">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="text-slate-600">
                      Từ: <span className="font-mono line-through text-rose-600">{h.oldValue || '(trống)'}</span> &rarr; Sang: <span className="font-mono text-emerald-600 font-semibold">{h.newValue || '(trống)'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 italic">
                      Lý do: "{h.reason}" | Người sửa: {h.changedByName || 'Thành viên'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setIsTaskHistoryModalOpen(false)}
                className="px-4 py-1.5 border rounded-lg text-slate-600 font-semibold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 32: THÊM NGƯỜI THAM GIA (MEMBER HOẶC GUEST R07)             */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isNewParticipantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-brand-navy border-b pb-2">Thêm Người Tham Gia</h3>
            <form onSubmit={handleExecuteAddParticipant} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Đối tượng tham gia</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="pType"
                      checked={newParticipantType === 'GUEST'}
                      onChange={() => setNewParticipantType('GUEST')}
                    />
                    <span className="font-bold text-amber-800">Khách ngoài (R07 - Không cần MSSV)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="pType"
                      checked={newParticipantType === 'MEMBER'}
                      onChange={() => setNewParticipantType('MEMBER')}
                    />
                    <span className="font-bold text-indigo-800">Thành viên CLB</span>
                  </label>
                </div>
              </div>

              {newParticipantType === 'GUEST' ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Họ và tên khách *</label>
                    <input
                      type="text"
                      required
                      value={newParticipantGuestName}
                      onChange={(e) => setNewParticipantGuestName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email liên hệ (Tùy chọn)</label>
                    <input
                      type="email"
                      value={newParticipantGuestEmail}
                      onChange={(e) => setNewParticipantGuestEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số điện thoại (Tùy chọn)</label>
                    <input
                      type="tel"
                      value={newParticipantGuestPhone}
                      onChange={(e) => setNewParticipantGuestPhone(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chọn thành viên CLB *</label>
                  <select
                    required
                    value={newParticipantMemberId}
                    onChange={(e) => setNewParticipantMemberId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">-- Chọn thành viên --</option>
                    {liveMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.fullName} ({m.username})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vai trò trong sự kiện</label>
                <select
                  value={newParticipantRole}
                  onChange={(e) => setNewParticipantRole(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="ATTENDEE">Người tham dự (ATTENDEE)</option>
                  <option value="SPEAKER">Diễn giả (SPEAKER)</option>
                  <option value="ORGANIZER">Ban tổ chức (ORGANIZER)</option>
                  <option value="VOLUNTEER">Tình nguyện viên (VOLUNTEER)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewParticipantModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-brand-navy hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Thêm Người Tham Gia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 33: THÊM DỰ TOÁN KẾ HOẠCH                                   */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isNewBudgetItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-brand-navy border-b pb-2">Lập Khoản Dự Toán Ước Tính</h3>
            <form onSubmit={handleExecuteCreateBudgetItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hạng mục</label>
                <select
                  value={newBudgetCategory}
                  onChange={(e) => setNewBudgetCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="REFRESHMENTS">Tiệc trà / Bánh nước</option>
                  <option value="PRINTING">In ấn / Standee / Tài liệu</option>
                  <option value="VENUE">Địa điểm / Hội trường</option>
                  <option value="LOGISTICS">Hậu cần / Âm thanh</option>
                  <option value="GIFTS">Quà tặng / Kỷ niệm chương</option>
                  <option value="SPEAKER_HONORARIUM">Bồi dưỡng diễn giả</option>
                  <option value="OTHER">Hạng mục khác</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả chi tiết *</label>
                <input
                  type="text"
                  required
                  value={newBudgetDesc}
                  onChange={(e) => setNewBudgetDesc(e.target.value)}
                  placeholder="Ví dụ: Bánh ngọt và nước suối cho 50 người"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tiền dự toán (VNĐ) *</label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  required
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewBudgetItemModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-brand-navy hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Lưu Dự Toán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* MODAL 34: GHI NHẬN CHI PHÍ THỰC TẾ LIÊN KẾT SỔ QUÝ (SINGLE COUNT) */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isNewExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-brand-navy border-b pb-2">
              Ghi Nhận Chi Phí Thực Tế (Sổ Kép CLB)
            </h3>
            <p className="text-[11px] text-slate-500">
              Chi phí sẽ được ghi nhận vào Quỹ Hoạt Động (FUND_OPERATION) đếm đúng một lần duy nhất.
            </p>
            <form onSubmit={handleExecuteRecordExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả khoản chi *</label>
                <input
                  type="text"
                  required
                  value={newExpenseDesc}
                  onChange={(e) => setNewExpenseDesc(e.target.value)}
                  placeholder="Ví dụ: Thanh toán hóa đơn bánh ngọt tiệc trà"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số tiền chi (VNĐ) *</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-mono font-bold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày chi *</label>
                  <input
                    type="date"
                    required
                    value={newExpenseDate}
                    onChange={(e) => setNewExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hình thức chi</label>
                  <select
                    value={newExpenseMethod}
                    onChange={(e) => setNewExpenseMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="CASH">Tiền mặt (Hộp quỹ)</option>
                    <option value="BANK">Chuyển khoản (Ngân hàng)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã hóa đơn / Chứng từ</label>
                  <input
                    type="text"
                    value={newExpenseRef}
                    onChange={(e) => setNewExpenseRef(e.target.value)}
                    placeholder="HD-0123..."
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Người đại diện chi tiền</label>
                <select
                  value={newExpensePayer}
                  onChange={(e) => setNewExpensePayer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">-- Mặc định (Tài khoản hiện tại) --</option>
                  {liveMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
                >
                  Ghi Sổ Quỹ & Hoàn Tất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 35: XỬ LÝ KIỂM DUYỆT ĐÁNH GIÁ SÁCH (FR-08)           */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showModerateReviewModal && selectedReviewForModerate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-lg w-full p-6 shadow-soft-modal border border-[#DCDED0]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-500" />
                <span>Quyết Định Kiểm Duyệt Đánh Giá</span>
              </h3>
              <button
                onClick={() => {
                  setShowModerateReviewModal(false);
                  setSelectedReviewForModerate(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteModerateReview} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800">
                  {selectedReviewForModerate.authorName} ({selectedReviewForModerate.rating} ★)
                </div>
                <p className="font-serif italic text-slate-600">
                  "{selectedReviewForModerate.pendingContent || selectedReviewForModerate.content}"
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hành động phê duyệt:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModerationDecision('APPROVED')}
                    className={`p-2.5 rounded-lg border text-center font-bold transition ${
                      moderationDecision === 'APPROVED'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Phê Duyệt Công Khai
                  </button>
                  <button
                    type="button"
                    onClick={() => setModerationDecision('REJECTED')}
                    className={`p-2.5 rounded-lg border text-center font-bold transition ${
                      moderationDecision === 'REJECTED'
                        ? 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Từ Chối / Ẩn Bài
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ghi chú kiểm duyệt (Lý do nếu từ chối):
                </label>
                <textarea
                  rows={3}
                  value={moderationNoteInput}
                  onChange={(e) => setModerationNoteInput(e.target.value)}
                  placeholder="Ghi rõ lý do nếu từ chối hoặc nhắc nhở tác giả..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-navy focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModerateReviewModal(false);
                    setSelectedReviewForModerate(null);
                  }}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-1.5 text-white rounded-lg font-bold transition ${
                    moderationDecision === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Quyết Định'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL 36: TẠO BÀI VIẾT / TIN TỨC MỚI (FR-08)              */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showCreatePostModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] rounded-[24px] ui-modal max-w-xl w-full p-6 shadow-soft-modal border border-[#DCDED0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-navy" />
                <span>Viết Bài Mới Cho Cổng Thông Tin</span>
              </h3>
              <button
                onClick={() => setShowCreatePostModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCreatePost} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tiêu đề bài viết *</label>
                <input
                  type="text"
                  required
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="Ví dụ: Giới thiệu cuốn sách Clean Code cho dân IT Bách Khoa"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-navy focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slug URL (Tùy chọn)</label>
                  <input
                    type="text"
                    value={newPostSlug}
                    onChange={(e) => setNewPostSlug(e.target.value)}
                    placeholder="clean-code-bach-khoa"
                    className="w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chuyên mục *</label>
                  <select
                    value={newPostCategory}
                    onChange={(e) => setNewPostCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="NEWS">Tin tức CLB</option>
                    <option value="REVIEW">Góc cảm nhận sách</option>
                    <option value="EVENT_RECAP">Tổng kết sự kiện</option>
                    <option value="NOTICE">Thông báo bạn đọc</option>
                    <option value="GUIDE">Hướng dẫn mượn trả</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tóm tắt ngắn (Summary) *</label>
                <textarea
                  rows={2}
                  required
                  value={newPostSummary}
                  onChange={(e) => setNewPostSummary(e.target.value)}
                  placeholder="Mô tả tóm tắt ngắn 1-2 câu hiển thị ở danh mục bài viết..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nội dung chi tiết *</label>
                <textarea
                  rows={6}
                  required
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Nội dung bài viết (Tự động lọc mã độc XSS và bảo vệ quyền riêng tư)..."
                  className="w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:ring-brand-navy focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreatePostModal(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-brand-navy hover:bg-brand-navy-hover text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Lưu Bản Nháp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {!isAlumni && (
        <nav aria-label="Điều hướng nhanh di động" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF5]/95 backdrop-blur-md border-t border-[#DCDED0] flex items-center justify-around py-2 px-1 shadow-soft-modal text-[10px]">
          <button 
            type="button" 
            onClick={() => setActiveModule('dashboard')} 
            className={`flex flex-col items-center gap-1 p-1.5 rounded-[10px] transition ${activeModule === 'dashboard' ? 'text-ysbk-primary font-bold' : 'text-[#64705C]'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Tổng quan</span>
          </button>
          <button 
            type="button" 
            onClick={() => setActiveModule('quay-sach')} 
            className={`flex flex-col items-center gap-1 p-1.5 rounded-[10px] transition ${activeModule === 'quay-sach' ? 'text-ysbk-primary font-bold' : 'text-[#64705C]'}`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Quầy sách</span>
          </button>
          <button 
            type="button" 
            onClick={() => setActiveModule('ban-sach')} 
            className={`flex flex-col items-center gap-1 p-1.5 rounded-[10px] transition ${activeModule === 'ban-sach' ? 'text-ysbk-primary font-bold' : 'text-[#64705C]'}`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Sách mới</span>
          </button>
          <button 
            type="button" 
            onClick={() => setActiveModule('tai-chinh')} 
            className={`flex flex-col items-center gap-1 p-1.5 rounded-[10px] transition ${activeModule === 'tai-chinh' ? 'text-ysbk-primary font-bold' : 'text-[#64705C]'}`}
          >
            <Wallet className="w-5 h-5" />
            <span>Sổ quỹ</span>
          </button>
          <button 
            type="button" 
            onClick={() => setIsSidebarCollapsed(false)} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-[10px] text-[#64705C] hover:text-[#35483C] transition"
          >
            <Settings className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </nav>
      )}

    </div>
  );
}

