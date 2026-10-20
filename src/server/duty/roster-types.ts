/**
 * YSBK Duty Roster Types & Enums (Chặng 15)
 * Solver xếp lịch, chỉnh tay và công bố có phiên bản.
 */

export const SCHEDULE_STATUSES = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const;
export type ScheduleStatus = typeof SCHEDULE_STATUSES[keyof typeof SCHEDULE_STATUSES];

export const DUTY_TYPES = {
  MAIN: 'MAIN',
  SUPPORT: 'SUPPORT',
} as const;
export type DutyType = typeof DUTY_TYPES[keyof typeof DUTY_TYPES];

export const ASSIGNED_ROLES = {
  BOOK_INTRO: 'BOOK_INTRO',         // Giới thiệu sách
  CIRCULATION_LOG: 'CIRCULATION_LOG', // Ghi sổ mượn trả
  CASH_DRAWER: 'CASH_DRAWER',       // Kiểm tiền quầy két
  LOGISTICS_SETUP: 'LOGISTICS_SETUP', // Chuẩn bị bàn trực & bàn giao
} as const;
export type AssignedRole = typeof ASSIGNED_ROLES[keyof typeof ASSIGNED_ROLES];

export const ATTENDANCE_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  SUBSTITUTED: 'SUBSTITUTED',
} as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[keyof typeof ATTENDANCE_STATUSES];

export const POLICY_LABELS = {
  CLEANUP_TIME: '17:00 - 17:15 [GIẢ ĐỊNH / CHƯA CHỐT POLICY]',
  SHIFT_TIME_FULL: '14:00 - 17:00 (Thu dọn 17:00 - 17:15 [GIẢ ĐỊNH / CHƯA CHỐT POLICY])',
  LOCATION_DEFAULT: 'Sảnh Thư viện Tạ Quang Bửu',
} as const;

export interface DutyMemberCandidate {
  id: string;
  fullName: string;
  username: string;
  studentId?: string | null;
  isActive: boolean;
  isAlumni: boolean;
  isEligibleMain: boolean;
  assignedMainShiftsCount: number;
  assignedSupportShiftsCount: number;
}

export interface MemberBusyWindow {
  memberId: string;
  dayOfWeek: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  busyType: string;
}

export interface ShiftValidationResult {
  isValid: boolean;
  mainDuty: DutyMemberCandidate[];
  supportDuty: DutyMemberCandidate[];
  warningMain?: string | null;
  warningSupport?: string | null;
  errors: string[];
}

export interface DutyAssigneeDto {
  id: string;
  scheduleId: string;
  memberId: string;
  memberName?: string;
  memberStudentId?: string | null;
  dutyType: DutyType;
  assignedRole: AssignedRole;
  attendanceStatus: AttendanceStatus;
  notes?: string | null;
  createdAt: string;
}

export interface DutyScheduleDto {
  id: string;
  termSemester: string;
  scheduleDate: string; // YYYY-MM-DD
  dayOfWeek: 'THU_BA' | 'THU_NAM';
  shiftTime: string;
  location: string;
  status: ScheduleStatus;
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

export interface GenerateDraftSchedulesParams {
  termSemester: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  forceOverwriteManual?: boolean;
}

export interface ManualEditScheduleParams {
  assignees: Array<{
    memberId: string;
    dutyType: DutyType;
    assignedRole: AssignedRole;
    notes?: string;
  }>;
  shiftTime?: string;
  location?: string;
  notes?: string;
}

export interface UpdateAttendanceParams {
  memberId: string;
  attendanceStatus: AttendanceStatus;
  notes?: string;
}
