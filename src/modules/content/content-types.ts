/**
 * Content & Moderation Module Types - YSBK (FR-08)
 * Quản lý đánh giá sách, bài viết công khai, quy trình kiểm duyệt và DTO an toàn SEO.
 */

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PostStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
export type PostCategory = 'NEWS' | 'REVIEW' | 'EVENT_RECAP' | 'NOTICE' | 'GUIDE';

export interface BookReview {
  id: string;
  bookId: string;
  authorId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  rating: number; // 1 to 5
  content: string;
  status: ReviewStatus;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  moderationNote?: string | null;
  version: number;
  pendingContent?: string | null;
  pendingRating?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: PostCategory;
  coverImageUrl?: string | null;
  authorId: string;
  authorDisplayName: string;
  status: PostStatus;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  publishedAt?: string | null;
  metaDescription?: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public DTO: Allowlist chỉ chứa các trường an toàn cho bạn đọc và công cụ tìm kiếm.
 * Tuyệt đối KHÔNG chứa email cá nhân, ghi chú kiểm duyệt nội bộ hoặc IP của người gửi (R13).
 */
export interface SafePublicReviewDto {
  id: string;
  bookId: string;
  readerName: string;
  rating: number;
  content: string;
  version: number;
  approvedAt: string | null;
  createdAt: string;
}

export interface SafePublicPostDto {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: PostCategory;
  coverImageUrl?: string | null;
  authorDisplayName: string;
  publishedAt: string | null;
  metaDescription?: string | null;
  createdAt: string;
}

export interface SubmitReviewDto {
  bookId: string;
  authorName: string;
  rating: number;
  content: string;
  authorEmail?: string;
}

export interface EditReviewDto {
  rating: number;
  content: string;
}

export interface ModerateReviewDto {
  decision: 'APPROVED' | 'REJECTED';
  moderationNote?: string;
}

export interface CreatePostDto {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: PostCategory;
  coverImageUrl?: string;
  metaDescription?: string;
}

export interface UpdatePostDto {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  category?: PostCategory;
  coverImageUrl?: string;
  metaDescription?: string;
}
