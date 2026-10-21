/**
 * Content & Moderation Service - YSBK (FR-08)
 * Thực hiện logic kiểm duyệt, bảo vệ quyền riêng tư PII, chống spam, chống XSS và xử lý đa phiên bản review.
 */

import type { Queryable } from '../../server/finance/types.ts';
import type { AuthenticatedActor } from '../../server/types.ts';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../server/errors.ts';
import { requireAuthenticated, requireInternalMember, requireAdmin } from '../../server/auth/policy.ts';
import type {
  BookReview,
  PublicPost,
  SafePublicReviewDto,
  SafePublicPostDto,
  SubmitReviewDto,
  EditReviewDto,
  ModerateReviewDto,
  CreatePostDto,
} from './content-types.ts';
import { sanitizeContent, generateSlug } from './sanitizer.ts';

/**
 * 1. Gửi đánh giá sách (Guest có phiên hợp lệ hoặc Member)
 * Yêu cầu:
 * - Bắt buộc có phiên xác thực (401 nếu Anon).
 * - Lưu bản ghi với status = 'PENDING', version = 1.
 * - Trả kết quả thật từ CSDL, không dùng fake success.
 */
export async function submitBookReview(
  db: Queryable,
  actor: AuthenticatedActor | null | undefined,
  dto: SubmitReviewDto
): Promise<BookReview> {
  const current = requireAuthenticated(actor);

  if (!dto.bookId || typeof dto.bookId !== 'string') {
    throw new BadRequestError('Mã sách (bookId) là bắt buộc.', 'INVALID_BOOK_ID');
  }

  // Kiểm tra sách tồn tại
  const bookCheck = await db.query(
    `SELECT id, title FROM book_titles WHERE id = $1`,
    [dto.bookId]
  );
  if (bookCheck.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy đầu sách với mã '${dto.bookId}'.`, 'BOOK_NOT_FOUND');
  }

  // Validate rating 1..5
  const rating = Number(dto.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError('Đánh giá sao phải là số nguyên từ 1 đến 5.', 'INVALID_RATING');
  }

  // Validate authorName
  const authorName = (dto.authorName || current.username || '').trim();
  if (authorName.length < 2 || authorName.length > 150) {
    throw new BadRequestError('Tên người đánh giá phải từ 2 đến 150 ký tự.', 'INVALID_AUTHOR_NAME');
  }

  // Validate & sanitize content
  const sanitizedContent = sanitizeContent(dto.content || '');
  if (sanitizedContent.length < 10) {
    throw new BadRequestError('Nội dung đánh giá quá ngắn (tối thiểu 10 ký tự).', 'CONTENT_TOO_SHORT');
  }
  if (sanitizedContent.length > 3000) {
    throw new BadRequestError('Nội dung đánh giá vượt quá giới hạn 3000 ký tự.', 'CONTENT_TOO_LONG');
  }

  const sanitizedAuthorName = sanitizeContent(authorName);

  const res = await db.query(
    `INSERT INTO book_reviews (
      book_id, author_id, author_name, author_email, rating, content, status, version, created_at, updated_at, is_club_review
    ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 1, NOW(), NOW(), $7)
    RETURNING id, book_id, author_id, author_name, author_email, rating, content, status, version, created_at, updated_at`,
    [
      dto.bookId,
      current.memberId || current.userId || null,
      sanitizedAuthorName,
      dto.authorEmail || null,
      rating,
      sanitizedContent,
      !current.isAlumni && ['ADMIN','MEMBER'].includes(current.role),
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    bookId: row.book_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    rating: row.rating,
    content: row.content,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 2. Sửa đánh giá đã gửi
 * Nếu đã APPROVED: nâng version, lưu pending_content, chuyển status = 'PENDING' để chờ duyệt lại.
 * Bản đang public không bị lộ bản sửa cho đến khi được duyệt.
 */
export async function editBookReview(
  db: Queryable,
  actor: AuthenticatedActor | null | undefined,
  reviewId: string,
  dto: EditReviewDto
): Promise<BookReview> {
  const current = requireAuthenticated(actor);

  const revRes = await db.query(
    `SELECT * FROM book_reviews WHERE id = $1`,
    [reviewId]
  );
  if (revRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy đánh giá với mã '${reviewId}'.`, 'REVIEW_NOT_FOUND');
  }

  const rev = revRes.rows[0];

  // Chỉ author hoặc Thành viên nội bộ mới được sửa
  const currentActorId = current.memberId || current.userId;
  const isAuthor = rev.author_id && rev.author_id === currentActorId;
  const isInternal = current.role === 'MEMBER' || current.role === 'ADMIN';
  if (!isAuthor && !isInternal) {
    throw new ForbiddenError('Bạn không có quyền chỉnh sửa đánh giá này.', 'PERMISSION_DENIED');
  }

  const rating = Number(dto.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError('Đánh giá sao phải là số nguyên từ 1 đến 5.', 'INVALID_RATING');
  }

  const sanitizedContent = sanitizeContent(dto.content || '');
  if (sanitizedContent.length < 10 || sanitizedContent.length > 3000) {
    throw new BadRequestError('Nội dung đánh giá phải từ 10 đến 3000 ký tự.', 'INVALID_CONTENT_LENGTH');
  }

  if (rev.status === 'APPROVED') {
    // Đã duyệt -> tạo version mới, lưu vào pending_content để không leak bản sửa
    const updated = await db.query(
      `UPDATE book_reviews
       SET version = version + 1,
           pending_content = $1,
           pending_rating = $2,
           status = 'PENDING',
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [sanitizedContent, rating, reviewId]
    );
    const row = updated.rows[0];
    return {
      id: row.id,
      bookId: row.book_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorEmail: row.author_email,
      rating: row.rating,
      content: row.content,
      status: row.status,
      version: row.version,
      pendingContent: row.pending_content,
      pendingRating: row.pending_rating,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } else {
    // Chưa duyệt -> cập nhật thẳng
    const updated = await db.query(
      `UPDATE book_reviews
       SET content = $1,
           rating = $2,
           status = 'PENDING',
           pending_content = NULL,
           pending_rating = NULL,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [sanitizedContent, rating, reviewId]
    );
    const row = updated.rows[0];
    return {
      id: row.id,
      bookId: row.book_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorEmail: row.author_email,
      rating: row.rating,
      content: row.content,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * 3. Kiểm duyệt đánh giá (Chỉ Thành viên nội bộ CLB)
 */
export async function moderateBookReview(
  db: Queryable,
  actor: AuthenticatedActor,
  reviewId: string,
  dto: ModerateReviewDto
): Promise<BookReview> {
  const member = requireAdmin(actor);

  if (!dto.decision || (dto.decision !== 'APPROVED' && dto.decision !== 'REJECTED')) {
    throw new BadRequestError("Quyết định kiểm duyệt phải là 'APPROVED' hoặc 'REJECTED'.", 'INVALID_DECISION');
  }

  const revRes = await db.query(
    `SELECT * FROM book_reviews WHERE id = $1`,
    [reviewId]
  );
  if (revRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy đánh giá với mã '${reviewId}'.`, 'REVIEW_NOT_FOUND');
  }

  const rev = revRes.rows[0];
  const moderationNote = dto.moderationNote ? sanitizeContent(dto.moderationNote) : null;

  if (dto.decision === 'APPROVED') {
    // Nếu có pending_content từ bản sửa, áp dụng vào content chính thức
    const newContent = rev.pending_content || rev.content;
    const newRating = rev.pending_rating || rev.rating;

    const res = await db.query(
      `UPDATE book_reviews
       SET content = $1,
           rating = $2,
           status = 'APPROVED',
           pending_content = NULL,
           pending_rating = NULL,
           moderated_by = $3,
           moderated_at = NOW(),
           moderation_note = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [newContent, newRating, member.memberId || member.userId, moderationNote, reviewId]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      bookId: row.book_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorEmail: row.author_email,
      rating: row.rating,
      content: row.content,
      status: row.status,
      version: row.version,
      pendingContent: row.pending_content ?? null,
      pendingRating: row.pending_rating ?? null,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at,
      moderationNote: row.moderation_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } else {
    // REJECTED
    const res = await db.query(
      `UPDATE book_reviews
       SET status = 'REJECTED',
           moderated_by = $1,
           moderated_at = NOW(),
           moderation_note = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [member.memberId || member.userId, moderationNote, reviewId]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      bookId: row.book_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorEmail: row.author_email,
      rating: row.rating,
      content: row.content,
      status: row.status,
      version: row.version,
      pendingContent: row.pending_content ?? null,
      pendingRating: row.pending_rating ?? null,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at,
      moderationNote: row.moderation_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * 4. Lấy danh sách đánh giá công khai (Chỉ APPROVED, loại bỏ 100% PII)
 */
export async function getPublicReviews(
  db: Queryable,
  bookId?: string,
  page=1
): Promise<SafePublicReviewDto[]> {
  if(!Number.isSafeInteger(page)||page<1||page>1000000) throw new BadRequestError('Trang đánh giá không hợp lệ.','INVALID_PAGE');
  let query = `
    SELECT id, book_id, author_name, rating, content, version, moderated_at, created_at, is_club_review
    FROM book_reviews
    WHERE status = 'APPROVED'
  `;
  const params: any[] = [];

  if (bookId) {
    params.push(bookId);
    query += ` AND book_id = $1`;
  }

  params.push((page-1)*50);
  query += ` ORDER BY is_club_review DESC, created_at DESC, id DESC LIMIT 50 OFFSET $${params.length}`;

  const res = await db.query(query, params);

  return res.rows.map((row: any) => ({
    isClubReview: !!row.is_club_review,
    id: row.id,
    bookId: row.book_id,
    readerName: row.author_name,
    rating: row.rating,
    content: row.content,
    version: row.version,
    approvedAt: row.moderated_at,
    createdAt: row.created_at,
  }));
}

/**
 * 5. Lấy danh sách đánh giá cho Ban Kiểm Duyệt (Nội bộ)
 */
export async function getReviewsForModeration(
  db: Queryable,
  actor: AuthenticatedActor,
  filter?: { status?: string; bookId?: string }
): Promise<BookReview[]> {
  requireInternalMember(actor);

  let query = `SELECT * FROM book_reviews WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (filter?.status) {
    params.push(filter.status);
    query += ` AND status = $${idx++}`;
  }
  if (filter?.bookId) {
    params.push(filter.bookId);
    query += ` AND book_id = $${idx++}`;
  }

  query += ` ORDER BY created_at DESC LIMIT 100`;

  const res = await db.query(query, params);
  return res.rows.map((row: any) => ({
    id: row.id,
    bookId: row.book_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    rating: row.rating,
    content: row.content,
    status: row.status,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    moderationNote: row.moderation_note,
    version: row.version,
    pendingContent: row.pending_content,
    pendingRating: row.pending_rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * 6. Tạo bài viết công khai (Thành viên nội bộ)
 */
export async function createPublicPost(
  db: Queryable,
  actor: AuthenticatedActor,
  dto: CreatePostDto
): Promise<PublicPost> {
  const member = requireInternalMember(actor);

  if (!dto.title || dto.title.trim().length < 5) {
    throw new BadRequestError('Tiêu đề bài viết tối thiểu 5 ký tự.', 'INVALID_TITLE');
  }

  const slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.title);
  if (!slug) {
    throw new BadRequestError('Slug bài viết không hợp lệ.', 'INVALID_SLUG');
  }

  // Check slug uniqueness
  const existing = await db.query(`SELECT id FROM public_posts WHERE slug = $1`, [slug]);
  if (existing.rows.length > 0) {
    throw new BadRequestError(`Slug '${slug}' đã được sử dụng.`, 'SLUG_ALREADY_EXISTS');
  }

  const sanitizedContent = sanitizeContent(dto.content || '');
  const sanitizedSummary = sanitizeContent(dto.summary || '');
  const authorDisplayName = member.username || 'Thành viên CLB';

  const res = await db.query(
    `INSERT INTO public_posts (
      title, slug, summary, content, category, cover_image_url, author_id, author_display_name,
      status, meta_description, view_count, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9, 0, NOW(), NOW())
    RETURNING *`,
    [
      dto.title.trim(),
      slug,
      sanitizedSummary,
      sanitizedContent,
      dto.category || 'NEWS',
      dto.coverImageUrl || null,
      member.memberId || member.userId,
      authorDisplayName,
      dto.metaDescription || sanitizedSummary.substring(0, 160),
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    status: row.status,
    metaDescription: row.meta_description,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 7. Xuất bản bài viết công khai (Thành viên nội bộ)
 */
export async function publishPublicPost(
  db: Queryable,
  actor: AuthenticatedActor,
  postId: string
): Promise<PublicPost> {
  const member = requireInternalMember(actor);

  const check = await db.query(`SELECT * FROM public_posts WHERE id = $1`, [postId]);
  if (check.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy bài viết '${postId}'.`, 'POST_NOT_FOUND');
  }

  const res = await db.query(
    `UPDATE public_posts
     SET status = 'PUBLISHED',
         moderated_by = $1,
         moderated_at = NOW(),
         published_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [member.memberId || member.userId, postId]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    status: row.status,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    publishedAt: row.published_at,
    metaDescription: row.meta_description,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 8. Lấy danh sách bài viết công khai (Chỉ PUBLISHED)
 */
export async function getPublicPosts(
  db: Queryable,
  category?: string
): Promise<SafePublicPostDto[]> {
  let query = `
    SELECT id, title, slug, summary, content, category, cover_image_url,
           author_display_name, published_at, meta_description, created_at
    FROM public_posts
    WHERE status = 'PUBLISHED'
  `;
  const params: any[] = [];

  if (category && category !== 'TẤT CẢ') {
    params.push(category);
    query += ` AND category = $1`;
  }

  query += ` ORDER BY published_at DESC LIMIT 30`;

  const res = await db.query(query, params);
  return res.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    authorDisplayName: row.author_display_name,
    publishedAt: row.published_at,
    metaDescription: row.meta_description,
    createdAt: row.created_at,
  }));
}

/**
 * 9. Lấy chi tiết bài viết công khai theo Slug
 */
export async function getPublicPostBySlug(
  db: Queryable,
  slug: string
): Promise<SafePublicPostDto> {
  const res = await db.query(
    `SELECT id, title, slug, summary, content, category, cover_image_url,
            author_display_name, published_at, meta_description, created_at
     FROM public_posts
     WHERE slug = $1 AND status = 'PUBLISHED'`,
    [slug]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy bài viết với slug '${slug}'.`, 'POST_NOT_FOUND');
  }

  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    authorDisplayName: row.author_display_name,
    publishedAt: row.published_at,
    metaDescription: row.meta_description,
    createdAt: row.created_at,
  };
}
