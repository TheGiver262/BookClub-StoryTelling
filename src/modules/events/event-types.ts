/**
-- =====================================================================
-- TYPES & DTOS FOR EVENTS & ACTIVITIES (CHẶNG 19 - FR-06)
-- =====================================================================
*/

export type ActivityType =
  | 'WORKSHOP'
  | 'BOOK_FAIR'
  | 'TALKSHOW'
  | 'INTERNAL_MEETING'
  | 'VOLUNTEER'
  | 'OTHER';

export type ActivityStatus =
  | 'PLANNING'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type ParticipantType = 'MEMBER' | 'GUEST';
export type ParticipantRole = 'ATTENDEE' | 'SPEAKER' | 'ORGANIZER' | 'VOLUNTEER';
export type ParticipantStatus = 'REGISTERED' | 'ATTENDED' | 'CANCELLED';

export type BudgetCategory =
  | 'VENUE'
  | 'LOGISTICS'
  | 'PRINTING'
  | 'REFRESHMENTS'
  | 'GIFTS'
  | 'SPEAKER_HONORARIUM'
  | 'OTHER';

export type EventPaymentMethod = 'CASH' | 'BANK';

export interface Activity {
  id: string;
  title: string;
  description: string;
  eventType: ActivityType;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  budget: number;
  status: ActivityStatus;
  isApprovedForPublic: boolean;
  isApprovedForAlumni: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTask {
  id: string;
  activityId: string;
  title: string;
  description?: string | null;
  assigneeMemberId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTaskHistory {
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

export interface ActivityParticipant {
  id: string;
  activityId: string;
  participantType: ParticipantType;
  memberId?: string | null;
  memberName?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  role: ParticipantRole;
  status: ParticipantStatus;
  checkInTime?: string | null;
  createdAt: string;
}

export interface ActivityBudgetItem {
  id: string;
  activityId: string;
  category: BudgetCategory;
  description: string;
  estimatedAmount: number;
  createdAt: string;
}

export interface ActivityExpense {
  id: string;
  activityId: string;
  budgetItemId?: string | null;
  description: string;
  actualAmount: number;
  expenseDate: string;
  payerMemberId: string;
  payerName?: string;
  paymentMethod: EventPaymentMethod;
  receiptRef?: string | null;
  journalEntryId?: string | null;
  createdBy: string;
  createdAt: string;
}

/**
 * Allowlist DTO for Alumni (Cựu thành viên)
 * Tuyệt đối không chứa tài chính, chi phí, ngân hàng, liên hệ cá nhân nhạy cảm
 */
export interface SafeAlumniActivityDto {
  id: string;
  title: string;
  description: string;
  activityDate: string;
  location: string;
  status: ActivityStatus;
}

/**
 * Allowlist DTO for Public (Công chúng / Khách vãng lai)
 */
export interface SafePublicActivityDto {
  id: string;
  title: string;
  description: string;
  eventType: ActivityType;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
}

/**
 * Full Detail DTO for Internal Active Members & Admins
 */
export interface ActivityDetailDto {
  activity: Activity;
  tasks: ActivityTask[];
  participants: ActivityParticipant[];
  budgetItems: ActivityBudgetItem[];
  expenses: ActivityExpense[];
  financialSummary: {
    totalBudget: number;
    totalExpense: number;
    budgetVariance: number;
  };
}

// Request Bodies
export interface CreateActivityRequest {
  title: string;
  description?: string;
  eventType?: ActivityType;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  budget?: number;
  isApprovedForPublic?: boolean;
  isApprovedForAlumni?: boolean;
}

export interface UpdateActivityRequest {
  title?: string;
  description?: string;
  eventType?: ActivityType;
  eventDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  budget?: number;
  status?: ActivityStatus;
  isApprovedForPublic?: boolean;
  isApprovedForAlumni?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  assigneeMemberId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  assigneeMemberId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  reason: string; // Bắt buộc lý do để ghi audit log
}

export interface AddParticipantRequest {
  participantType: ParticipantType;
  memberId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  role?: ParticipantRole;
}

export interface UpdateParticipantRequest {
  role?: ParticipantRole;
  status?: ParticipantStatus;
  checkInTime?: string | null;
}

export interface CreateBudgetItemRequest {
  category: BudgetCategory;
  description: string;
  estimatedAmount: number;
}

export interface RecordExpenseRequest {
  budgetItemId?: string;
  description: string;
  actualAmount: number;
  expenseDate: string;
  payerMemberId: string;
  paymentMethod: EventPaymentMethod;
  receiptRef?: string;
}
