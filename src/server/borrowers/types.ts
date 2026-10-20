/**
 * Borrowers Module Types - YSBK
 * Quản lý Người mượn cộng đồng (Sinh viên Bách Khoa và Người dân bên ngoài)
 */

export interface Borrower {
  id: string;
  full_name: string;
  student_id: string | null;
  school: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface BorrowerDto {
  id: string;
  fullName: string;
  studentId: string | null;
  school: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface CreateBorrowerParams {
  fullName: string;
  phone: string;
  studentId?: string | null;
  school?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface UpdateBorrowerParams {
  fullName?: string;
  phone?: string;
  studentId?: string | null;
  school?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface SearchBorrowersParams {
  query?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
}
