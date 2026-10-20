/**
 * YSBK Recruitment Types & DTOs (Chặng 16)
 * Quản lý đơn ứng tuyển Google Form, ánh xạ câu hỏi, nhiều nguyện vọng,
 * đối soát checkpoint và bảo vệ PII.
 */

export const RECRUITMENT_DEPARTMENTS = [
  'BAN_HAU_CAN',
  'BAN_NOI_DUNG',
  'BAN_TTDN',
  'BAN_CHU_NHIEM',
] as const;
export type RecruitmentDepartment = typeof RECRUITMENT_DEPARTMENTS[number];

export const SYNC_STATUSES = [
  'SYNCED',
  'PENDING_RECONCILIATION',
  'CONFLICT',
  'ERROR',
] as const;
export type SyncStatus = typeof SYNC_STATUSES[number];

export const RECRUITMENT_QUESTION_KEYS = [
  'FULL_NAME',
  'STUDENT_ID',
  'EMAIL',
  'PHONE',
  'ASPIRATION_1',
  'ASPIRATION_2',
  'WHY_JOIN',
  'ESSAY_CONTENT',
  'CV_LINK',
  'CUSTOM',
] as const;
export type RecruitmentQuestionKey = typeof RECRUITMENT_QUESTION_KEYS[number];

export interface RecruitmentFormDto {
  id: string;
  title: string;
  termSemester: string;
  formUrl?: string | null;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentQuestionDto {
  id: string;
  formId: string;
  questionIndex: number;
  questionKey: RecruitmentQuestionKey;
  questionLabel: string;
  isRequired: boolean;
  fieldMapping: string;
}

/**
 * Payload gửi từ Google Apps Script webhook
 */
export interface GoogleFormWebhookPayload {
  formId: string;
  responseId: string;
  timestamp: string | number; // ISO string hoặc epoch milliseconds
  answers: Record<string, string | string[]>;
  applicantName?: string;
  applicantStudentId?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  aspiration1?: string;
  aspiration2?: string;
  whyJoin?: string;
  essayContent?: string;
  cvLink?: string;
}

/**
 * DTO Chi tiết đầy đủ cho ban tuyển sinh nội bộ
 */
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
  syncStatus: SyncStatus;
  lastObservedAt: string;
  syncError?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO Công khai đã che giấu PII (cho Guest / Public view)
 */
export interface RecruitmentResponsePublicDto {
  id: string;
  formId: string;
  maskedName: string;
  maskedStudentId?: string | null;
  maskedEmail: string;
  aspiration1: string;
  aspiration2?: string | null;
  submissionDate: string;
  syncStatus: SyncStatus;
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
