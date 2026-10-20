/**
 * YSBK Duty Availability Types (Chặng 14: Import Excel lịch bận theo mẫu thống nhất)
 */

export const DAYS_OF_WEEK = {
  THU_HAI: 'THU_HAI',
  THU_BA: 'THU_BA',
  THU_TU: 'THU_TU',
  THU_NAM: 'THU_NAM',
  THU_SAU: 'THU_SAU',
  THU_BAY: 'THU_BAY',
  CHU_NHAT: 'CHU_NHAT',
} as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[keyof typeof DAYS_OF_WEEK];

export const BUSY_TYPES = {
  HOC_CHINH_KHOA: 'HOC_CHINH_KHOA',
  THI: 'THI',
  CONG_VIEC_KHAC: 'CONG_VIEC_KHAC',
  BAN_CO_DINH: 'BAN_CO_DINH',
} as const;

export type BusyType = typeof BUSY_TYPES[keyof typeof BUSY_TYPES];

export interface ParsedAvailabilityRow {
  rowNumber: number;
  rawMemberIdentifier: string;
  rawDayOfWeek: string;
  rawStartTime: string;
  rawEndTime: string;
  rawBusyType?: string;
  rawNotes?: string;
  resolvedMemberId?: string;
  resolvedMemberName?: string;
  normalizedDayOfWeek?: DayOfWeek;
  normalizedStartTime?: string; // 'HH:mm'
  normalizedEndTime?: string;   // 'HH:mm'
  normalizedBusyType?: BusyType;
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface AvailabilityPreviewResult {
  fileName: string;
  fileSizeBytes: number;
  fileHash: string;
  termSemester: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ParsedAvailabilityRow[];
  isReadyToCommit: boolean;
  unrecognizedMembersCount: number;
}

export interface CommitAvailabilityParams {
  batchName: string;
  fileName: string;
  fileHash: string;
  fileSizeBytes: number;
  termSemester: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  validRows: Array<{
    memberId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    busyType: BusyType;
    notes?: string;
  }>;
  idempotencyKey?: string;
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
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  busyType: BusyType;
  effectiveStartDate: string;
  effectiveEndDate: string;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}
