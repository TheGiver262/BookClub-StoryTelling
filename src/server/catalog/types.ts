/**
 * Catalog Module Types - YSBK
 * Quản lý Đầu sách (Titles), Ấn bản (Editions), Bản vật lý (Copies)
 */

export type CopyStatus = 'AVAILABLE' | 'BORROWED' | 'LOST' | 'MAINTENANCE' | 'ARCHIVED';
export type CopyLocation = 'KHO_THU_VIEN' | 'KHO_HOI_SINH_VIEN' | 'BAN_TRUC_TAM';

export interface Author {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface BookTitle {
  id: string;
  title: string;
  original_title: string | null;
  description: string | null;
  created_at: string;
}

export interface BookEdition {
  id: string;
  title_id: string;
  publisher: string;
  publish_year: number | null;
  isbn: string | null;
  cover_image_url: string | null;
  created_at: string;
}

export interface BookCopy {
  id: string;
  edition_id: string;
  barcode: string;
  location: CopyLocation;
  status: CopyStatus;
  cover_price: bigint | null;
  condition_note: string | null;
  created_at: string;
}

/**
 * Public DTO: Allowlist chỉ metadata & trạng thái công khai.
 * Tuyệt đối không rò rỉ borrower, ghi chú nội bộ, cọc cá nhân, journal entries.
 */
export interface PublicBookSummaryDto {
  id: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  authors: string[];
  categories: string[];
  availableCopiesCount: number;
  totalCopiesCount: number;
}

export interface PublicEditionDto {
  id: string;
  publisher: string;
  publishYear: number | null;
  isbn: string | null;
  coverImageUrl: string | null;
  availableCopiesCount: number;
  totalCopiesCount: number;
  standardDeposit: number; // Tiền cọc chuẩn tính theo giá bìa hoặc mặc định 50k
}

export interface PublicBookDetailDto extends PublicBookSummaryDto {
  editions: PublicEditionDto[];
}

/**
 * Internal DTO: Dành riêng cho Thành viên bàn trực và Quản trị viên
 */
export interface InternalBookCopyDto {
  id: string;
  editionId: string;
  titleId: string;
  titleName: string;
  publisher: string;
  barcode: string;
  location: CopyLocation;
  status: CopyStatus;
  coverPrice: number | null;
  calculatedDeposit: number;
  conditionNote: string | null;
  createdAt: string;
}

export interface ListBookCopiesParams {
  status?: CopyStatus | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SearchBooksParams {
  query?: string;
  author?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: 'title' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateBookCopyParams {
  editionId: string;
  barcode: string;
  location?: CopyLocation;
  coverPrice?: number | bigint | null;
  conditionNote?: string | null;
}

export interface UpdateBookCopyParams {
  location?: CopyLocation;
  coverPrice?: number | bigint | null;
  conditionNote?: string | null;
}

export interface CreateBookTitleParams {
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  authors?: string[];
  categories?: string[];
}

export interface CreateBookEditionParams {
  titleId: string;
  publisher: string;
  publishYear?: number | null;
  isbn?: string | null;
  coverImageUrl?: string | null;
}
