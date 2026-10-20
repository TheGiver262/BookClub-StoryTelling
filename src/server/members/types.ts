/**
 * YSBK Core Members & Dues Types (Chặng 13: Members, Department Affiliations & One-time Dues)
 */

export const DEPARTMENTS = {
  HAU_CAN: 'BAN_HAU_CAN',
  NOI_DUNG: 'BAN_NOI_DUNG',
  TTDN: 'BAN_TTDN',
  BCN: 'BAN_CHU_NHIEM',
} as const;

export type Department = typeof DEPARTMENTS[keyof typeof DEPARTMENTS];

export const DEPARTMENT_ROLES = {
  TRUONG_BAN: 'TRUONG_BAN',
  PHO_BAN: 'PHO_BAN',
  THANH_VIEN: 'THANH_VIEN',
  CHU_NHIEM: 'CHU_NHIEM',
  PHO_CHU_NHIEM: 'PHO_CHU_NHIEM',
  UY_VIEN_BCN: 'UY_VIEN_BCN',
} as const;

export type DepartmentRole = typeof DEPARTMENT_ROLES[keyof typeof DEPARTMENT_ROLES];

export interface MemberAffiliation {
  id: string;
  memberId: string;
  department: Department;
  role: DepartmentRole;
  termYear: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface AddAffiliationParams {
  memberId: string;
  department: Department;
  role: DepartmentRole;
  termYear: string;
  startDate?: string;
  notes?: string;
  endPreviousForDept?: boolean;
}

export interface MembershipDuesReceipt {
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

export interface CollectDuesParams {
  memberId: string;
  amount?: number | bigint;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paymentConfirmed: boolean;
  cashSessionId?: string | null;
  termLabel?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface MemberHeadcountSummary {
  totalDistinctMembers: number;
  totalActiveMembers: number;
  totalAlumniMembers: number;
  departments: {
    [DEPARTMENTS.HAU_CAN]: number;
    [DEPARTMENTS.NOI_DUNG]: number;
    [DEPARTMENTS.TTDN]: number;
    [DEPARTMENTS.BCN]: number;
  };
  multiDepartmentMemberCount: number;
}
