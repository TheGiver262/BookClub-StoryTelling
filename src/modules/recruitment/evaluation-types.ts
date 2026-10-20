/**
 * YSBK Recruitment Evaluation & Decision Types (Chặng 17)
 * Rubric phiên bản, phỏng vấn độc lập/hội đồng, sửa điểm có lý do & phiên bản,
 * quyết định phân ban, chuyển member idempotent và công bố public an toàn (R07 & R13).
 */

export const RUBRIC_FORMULA_TYPES = [
  'UNSPECIFIED',
  'WEIGHTED_SUM',
  'AVERAGE_CRITERIA',
] as const;
export type RubricFormulaType = typeof RUBRIC_FORMULA_TYPES[number];

export const RUBRIC_SECTIONS = [
  'INTERVIEW',
  'ESSAY',
  'COMMITTEE',
] as const;
export type RubricSection = typeof RUBRIC_SECTIONS[number];

export const EVALUATION_TYPES = [
  'INDIVIDUAL',
  'COMMITTEE',
] as const;
export type EvaluationType = typeof EVALUATION_TYPES[number];

export const EVALUATION_STATUSES = [
  'DRAFT',
  'COMPLETED',
] as const;
export type EvaluationStatus = typeof EVALUATION_STATUSES[number];

export const RECRUITMENT_DECISION_TYPES = [
  'PASSED',
  'FAILED',
  'RESERVE',
] as const;
export type RecruitmentDecisionType = typeof RECRUITMENT_DECISION_TYPES[number];

export interface RecruitmentRubricDto {
  id: string;
  campaignId: string;
  version: number;
  title: string;
  formulaType: RubricFormulaType;
  isActive: boolean;
  criteria?: RecruitmentRubricCriterionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentRubricCriterionDto {
  id: string;
  rubricId: string;
  code: string;
  name: string;
  description?: string | null;
  section: RubricSection;
  minScore: number;
  maxScore: number;
  weight: number;
  sortOrder: number;
}

export interface RecruitmentInterviewDto {
  id: string;
  responseId: string;
  scheduledTime?: string | null;
  locationOrLink?: string | null;
  assignedInterviewerIds: string[];
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ABSENT';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentEvaluationDto {
  id: string;
  responseId: string;
  evaluatorId: string;
  rubricId?: string | null;
  evaluationType: EvaluationType;
  rawScores: Record<string, number>;
  totalScore?: number | null;
  formulaStatus: 'CALCULATED' | 'UNSPECIFIED_FORMULA';
  interviewNotes?: string | null;
  status: EvaluationStatus;
  decision?: RecruitmentDecisionType | 'PENDING' | null;
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
  decision: RecruitmentDecisionType;
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

export interface CreateRubricParams {
  id?: string;
  campaignId: string;
  title: string;
  formulaType?: RubricFormulaType;
  criteria: Array<{
    code: string;
    name: string;
    description?: string;
    section?: RubricSection;
    minScore?: number;
    maxScore?: number;
    weight?: number;
    sortOrder?: number;
  }>;
}

export interface SubmitEvaluationParams {
  id?: string;
  responseId: string;
  rubricId: string;
  evaluationType?: EvaluationType;
  rawScores: Record<string, number>;
  interviewNotes?: string;
  status?: EvaluationStatus;
  decision?: RecruitmentDecisionType | 'PENDING';
}

export interface EditEvaluationParams {
  evaluationId: string;
  rawScores?: Record<string, number>;
  interviewNotes?: string;
  decision?: RecruitmentDecisionType | 'PENDING';
  reason: string;
  expectedVersion: number;
}

export interface FinalizeDecisionParams {
  responseId: string;
  decision: RecruitmentDecisionType;
  assignedDepartment: string;
  committeeNotes?: string;
}
