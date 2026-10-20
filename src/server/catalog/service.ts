/**
 * Catalog Service - YSBK
 * Triển khai nghiệp vụ tra cứu đầu sách, ấn bản, bản vật lý
 */

import type { Queryable } from '../finance/types.ts';
import {
  type PublicBookSummaryDto,
  type PublicBookDetailDto,
  type PublicEditionDto,
  type InternalBookCopyDto,
  type ListBookCopiesParams,
  type SearchBooksParams,
  type CreateBookCopyParams,
  type UpdateBookCopyParams,
  type CreateBookTitleParams,
  type CreateBookEditionParams,
  type CopyLocation,
  type CopyStatus,
} from './types.ts';
import {
  CatalogError,
  calculateDeposit,
  validateBarcode,
  assertCanUpdateCopy,
} from './rules.ts';
import { recordAuditLog } from '../shared/audit.ts';

export class BookNotFoundError extends CatalogError {
  constructor(message = 'Không tìm thấy đầu sách.') {
    super(message, 'BOOK_NOT_FOUND', 404);
    this.name = 'BookNotFoundError';
  }
}

export class CopyNotFoundError extends CatalogError {
  constructor(message = 'Không tìm thấy bản sách.') {
    super(message, 'COPY_NOT_FOUND', 404);
    this.name = 'CopyNotFoundError';
  }
}

export class DuplicateBarcodeError extends CatalogError {
  constructor(message = 'Mã vạch (barcode) này đã tồn tại trong hệ thống.') {
    super(message, 'DUPLICATE_BARCODE', 409);
    this.name = 'DuplicateBarcodeError';
  }
}

/**
 * 1. Tìm kiếm sách công khai (Public Catalog Search)
 * - Hỗ trợ tiếng Việt có dấu và không dấu (qua unaccent).
 * - Sử dụng subquery để nối n-n tác giả và thể loại, tránh nhân đôi số bản ghi sách.
 * - Phân trang kiểm soát chặt chẽ: tối đa 100 kết quả mỗi trang.
 * - Danh sách cột sắp xếp trong allowlist (chống SQL injection).
 */
export async function searchBooks(
  db: Queryable,
  params: SearchBooksParams = {}
): Promise<{ items: PublicBookSummaryDto[]; total: number; page: number; limit: number }> {
  let page = 1;
  if (params.page !== undefined && params.page !== null) {
    const p = Number(params.page);
    if (!Number.isFinite(p) || !Number.isInteger(p) || p < 1) {
      throw new CatalogError('Tham số page phải là số nguyên dương.', 'INVALID_PAGE', 400);
    }
    page = p;
  }

  let limit = 20;
  if (params.limit !== undefined && params.limit !== null) {
    const l = Number(params.limit);
    if (!Number.isFinite(l) || !Number.isInteger(l) || l < 1 || l > 100) {
      throw new CatalogError('Tham số limit phải là số nguyên từ 1 đến 100.', 'INVALID_LIMIT', 400);
    }
    limit = l;
  }
  const offset = (page - 1) * limit;

  const rawQuery = (params.query || '').trim();
  if (rawQuery.length > 200) {
    throw new CatalogError('Từ khóa tìm kiếm không được vượt quá 200 ký tự.', 'QUERY_TOO_LONG', 400);
  }
  const rawAuthor = (params.author || '').trim();
  if (rawAuthor.length > 100) {
    throw new CatalogError('Tên tác giả tìm kiếm không được vượt quá 100 ký tự.', 'AUTHOR_QUERY_TOO_LONG', 400);
  }
  const rawCategory = (params.category || '').trim();
  if (rawCategory.length > 100) {
    throw new CatalogError('Thể loại tìm kiếm không được vượt quá 100 ký tự.', 'CATEGORY_QUERY_TOO_LONG', 400);
  }

  // Whitelist sort columns
  const sortCol = params.sortBy === 'created_at' ? 'bt.created_at' : 'bt.title';
  const sortDir = params.sortOrder === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = ['1=1'];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (rawQuery) {
    conditions.push(`(
      unaccent(lower(bt.title)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%') OR
      unaccent(lower(COALESCE(bt.original_title, ''))) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%') OR
      EXISTS (
        SELECT 1 FROM book_title_authors bta
        JOIN authors a ON a.id = bta.author_id
        WHERE bta.title_id = bt.id AND unaccent(lower(a.name)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%')
      )
    )`);
    queryParams.push(rawQuery);
    paramIdx++;
  }

  if (rawAuthor) {
    conditions.push(`EXISTS (
      SELECT 1 FROM book_title_authors bta
      JOIN authors a ON a.id = bta.author_id
      WHERE bta.title_id = bt.id AND unaccent(lower(a.name)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%')
    )`);
    queryParams.push(rawAuthor);
    paramIdx++;
  }

  if (rawCategory) {
    conditions.push(`EXISTS (
      SELECT 1 FROM book_title_categories btc
      JOIN categories c ON c.id = btc.category_id
      WHERE btc.title_id = bt.id AND unaccent(lower(c.name)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%')
    )`);
    queryParams.push(rawCategory);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // 1. Đếm tổng số kết quả
  const countSql = `SELECT COUNT(*) AS total FROM book_titles bt WHERE ${whereClause}`;
  const countRes = await db.query<{ total: string }>(countSql, queryParams);
  const total = Number(countRes.rows[0]?.total || 0);

  // 2. Lấy dữ liệu phân trang
  const selectSql = `
    SELECT
      bt.id,
      bt.title,
      bt.original_title,
      bt.description,
      COALESCE(
        (SELECT JSON_AGG(a.name ORDER BY a.name)
         FROM book_title_authors bta
         JOIN authors a ON a.id = bta.author_id
         WHERE bta.title_id = bt.id),
        '[]'::json
      ) AS authors,
      COALESCE(
        (SELECT JSON_AGG(c.name ORDER BY c.name)
         FROM book_title_categories btc
         JOIN categories c ON c.id = btc.category_id
         WHERE btc.title_id = bt.id),
        '[]'::json
      ) AS categories,
      COALESCE(
        (SELECT COUNT(*) FROM book_copies bc
         JOIN book_editions be ON be.id = bc.edition_id
         WHERE be.title_id = bt.id AND bc.status = 'AVAILABLE'
           AND NOT EXISTS (
             SELECT 1 FROM reservations r WHERE r.copy_id = bc.id AND r.status = 'HELD' AND r.expires_at > NOW()
           )),
        0
      ) AS available_copies_count,
      COALESCE(
        (SELECT COUNT(*) FROM book_copies bc
         JOIN book_editions be ON be.id = bc.edition_id
         WHERE be.title_id = bt.id AND bc.status != 'ARCHIVED'),
        0
      ) AS total_copies_count
    FROM book_titles bt
    WHERE ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const rowsRes = await db.query<any>(selectSql, [...queryParams, limit, offset]);

  const items: PublicBookSummaryDto[] = rowsRes.rows.map((r) => ({
    id: r.id,
    title: r.title,
    originalTitle: r.original_title || null,
    description: r.description || null,
    authors: Array.isArray(r.authors) ? r.authors : (typeof r.authors === 'string' ? JSON.parse(r.authors) : []),
    categories: Array.isArray(r.categories) ? r.categories : (typeof r.categories === 'string' ? JSON.parse(r.categories) : []),
    availableCopiesCount: Number(r.available_copies_count),
    totalCopiesCount: Number(r.total_copies_count),
  }));

  return { items, total, page, limit };
}

/**
 * 2. Xem chi tiết đầu sách công khai (Public Book Detail)
 * Allowlist chỉ thông tin mô tả, tác giả, thể loại, và các ấn bản.
 * Không để lộ mã vạch nội bộ, người mượn, cọc cá nhân.
 */
export async function getBookById(db: Queryable, titleId: string): Promise<PublicBookDetailDto | null> {
  const titleSql = `
    SELECT
      bt.id,
      bt.title,
      bt.original_title,
      bt.description,
      COALESCE(
        (SELECT JSON_AGG(a.name ORDER BY a.name)
         FROM book_title_authors bta
         JOIN authors a ON a.id = bta.author_id
         WHERE bta.title_id = bt.id),
        '[]'::json
      ) AS authors,
      COALESCE(
        (SELECT JSON_AGG(c.name ORDER BY c.name)
         FROM book_title_categories btc
         JOIN categories c ON c.id = btc.category_id
         WHERE btc.title_id = bt.id),
        '[]'::json
      ) AS categories,
      COALESCE(
        (SELECT COUNT(*) FROM book_copies bc
         JOIN book_editions be ON be.id = bc.edition_id
         WHERE be.title_id = bt.id AND bc.status = 'AVAILABLE'
           AND NOT EXISTS (
             SELECT 1 FROM reservations r WHERE r.copy_id = bc.id AND r.status = 'HELD' AND r.expires_at > NOW()
           )),
        0
      ) AS available_copies_count,
      COALESCE(
        (SELECT COUNT(*) FROM book_copies bc
         JOIN book_editions be ON be.id = bc.edition_id
         WHERE be.title_id = bt.id AND bc.status != 'ARCHIVED'),
        0
      ) AS total_copies_count
    FROM book_titles bt
    WHERE bt.id = $1
  `;

  const titleRes = await db.query<any>(titleSql, [titleId]);
  if (titleRes.rows.length === 0) {
    return null;
  }
  const t = titleRes.rows[0];

  // Lấy các ấn bản
  const editionsSql = `
    SELECT
      be.id,
      be.publisher,
      be.publish_year,
      be.isbn,
      be.cover_image_url,
      COALESCE(
        (SELECT COUNT(*) FROM book_copies bc 
         WHERE bc.edition_id = be.id AND bc.status = 'AVAILABLE'
           AND NOT EXISTS (
             SELECT 1 FROM reservations r WHERE r.copy_id = bc.id AND r.status = 'HELD' AND r.expires_at > NOW()
           )),
        0
      ) AS available_copies_count,
      COALESCE(
        (SELECT COUNT(*) FROM book_copies bc WHERE bc.edition_id = be.id AND bc.status != 'ARCHIVED'),
        0
      ) AS total_copies_count,
      (SELECT bc.cover_price FROM book_copies bc WHERE bc.edition_id = be.id AND bc.cover_price IS NOT NULL LIMIT 1) AS sample_cover_price
    FROM book_editions be
    WHERE be.title_id = $1
    ORDER BY be.publish_year DESC NULLS LAST, be.created_at ASC
  `;

  const editionsRes = await db.query<any>(editionsSql, [titleId]);

  const editions = editionsRes.rows.map((e) => {
    const samplePrice = e.sample_cover_price !== null && e.sample_cover_price !== undefined
      ? BigInt(e.sample_cover_price)
      : null;
    const stdDeposit = Number(calculateDeposit(samplePrice));

    return {
      id: e.id,
      publisher: e.publisher,
      publishYear: e.publish_year ? Number(e.publish_year) : null,
      isbn: e.isbn || null,
      coverImageUrl: e.cover_image_url || null,
      availableCopiesCount: Number(e.available_copies_count),
      totalCopiesCount: Number(e.total_copies_count),
      standardDeposit: stdDeposit,
    };
  });

  return {
    id: t.id,
    title: t.title,
    originalTitle: t.original_title || null,
    description: t.description || null,
    authors: Array.isArray(t.authors) ? t.authors : (typeof t.authors === 'string' ? JSON.parse(t.authors) : []),
    categories: Array.isArray(t.categories) ? t.categories : (typeof t.categories === 'string' ? JSON.parse(t.categories) : []),
    availableCopiesCount: Number(t.available_copies_count),
    totalCopiesCount: Number(t.total_copies_count),
    editions,
  };
}

/**
 * 3. Tra cứu thông tin bản sách vật lý theo barcode (Dành riêng cho Bàn trực / Internal)
 */
export async function getBookCopyByBarcode(db: Queryable, barcode: string): Promise<InternalBookCopyDto | null> {
  const cleanBarcode = validateBarcode(barcode);
  const sql = `
    SELECT
      bc.id,
      bc.edition_id,
      bc.barcode,
      bc.location,
      bc.status,
      bc.cover_price,
      bc.condition_note,
      bc.created_at,
      be.title_id,
      be.publisher,
      bt.title AS title_name
    FROM book_copies bc
    JOIN book_editions be ON be.id = bc.edition_id
    JOIN book_titles bt ON bt.id = be.title_id
    WHERE bc.barcode = $1
  `;

  const res = await db.query<any>(sql, [cleanBarcode]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  const priceBigInt = row.cover_price !== null && row.cover_price !== undefined ? BigInt(row.cover_price) : null;
  const calculatedDeposit = Number(calculateDeposit(priceBigInt));

  return {
    id: row.id,
    editionId: row.edition_id,
    titleId: row.title_id,
    titleName: row.title_name,
    publisher: row.publisher,
    barcode: row.barcode,
    location: row.location as CopyLocation,
    status: row.status as CopyStatus,
    coverPrice: priceBigInt !== null ? Number(priceBigInt) : null,
    calculatedDeposit,
    conditionNote: row.condition_note || null,
    createdAt: row.created_at,
  };
}

/**
 * 4. Thêm mới bản sách vật lý (Internal: Member/Admin)
 */
export async function createBookCopy(
  db: Queryable,
  params: CreateBookCopyParams,
  actorId: string = '00000000-0000-0000-0000-000000000000'
): Promise<InternalBookCopyDto> {
  const barcode = validateBarcode(params.barcode);

  // Kiểm tra edition có tồn tại
  const edRes = await db.query<{ id: string; title_id: string; publisher: string }>(
    `SELECT id, title_id, publisher FROM book_editions WHERE id = $1`,
    [params.editionId]
  );
  if (edRes.rows.length === 0) {
    throw new CatalogError(`Ấn bản (Edition) ID '${params.editionId}' không tồn tại.`, 'EDITION_NOT_FOUND', 404);
  }

  // Kiểm tra barcode trùng lặp
  const dupRes = await db.query<any>(`SELECT id FROM book_copies WHERE barcode = $1`, [barcode]);
  if (dupRes.rows.length > 0) {
    throw new DuplicateBarcodeError(`Mã vạch '${barcode}' đã tồn tại.`);
  }

  let coverPriceBigInt: bigint | null = null;
  if (params.coverPrice !== null && params.coverPrice !== undefined) {
    if (
      typeof params.coverPrice === 'boolean' ||
      (typeof params.coverPrice === 'number' && (!Number.isFinite(params.coverPrice) || !Number.isInteger(params.coverPrice)))
    ) {
      throw new CatalogError('Giá bìa phải là số nguyên hợp lệ.', 'INVALID_COVER_PRICE', 400);
    }
    const raw = BigInt(params.coverPrice);
    if (raw < 0n) throw new CatalogError('Giá bìa không được là số âm.', 'NEGATIVE_COVER_PRICE', 400);
    coverPriceBigInt = raw;
  }

  const location: CopyLocation = params.location || 'KHO_THU_VIEN';
  const status: CopyStatus = 'AVAILABLE';
  const conditionNote = (params.conditionNote || '').trim() || null;

  // S06-04: Fix coverPriceBigInt !== null để không biến 0n thành null
  const insRes = await db.query<any>(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price, condition_note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, edition_id, barcode, location, status, cover_price, condition_note, created_at`,
    [params.editionId, barcode, location, status, coverPriceBigInt !== null ? coverPriceBigInt.toString() : null, conditionNote]
  );

  const copy = insRes.rows[0];
  const titleRes = await db.query<{ title: string }>(
    `SELECT title FROM book_titles WHERE id = $1`,
    [edRes.rows[0].title_id]
  );

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId,
    action: 'CREATE_BOOK_COPY',
    targetResource: 'BOOK_COPY',
    targetId: copy.id,
    details: {
      barcode: copy.barcode,
      editionId: copy.edition_id,
      location,
      coverPrice: coverPriceBigInt !== null ? Number(coverPriceBigInt) : null,
    },
  });

  return {
    id: copy.id,
    editionId: copy.edition_id,
    titleId: edRes.rows[0].title_id,
    titleName: titleRes.rows[0]?.title || '',
    publisher: edRes.rows[0].publisher,
    barcode: copy.barcode,
    location: copy.location as CopyLocation,
    status: copy.status as CopyStatus,
    coverPrice: coverPriceBigInt !== null ? Number(coverPriceBigInt) : null,
    calculatedDeposit: Number(calculateDeposit(coverPriceBigInt)),
    conditionNote: copy.condition_note || null,
    createdAt: copy.created_at,
  };
}

/**
 * 5. Cập nhật metadata bản sách vật lý (Internal: Member/Admin)
 * Chặn thay đổi status qua API metadata.
 */
export async function updateBookCopy(
  db: Queryable,
  copyId: string,
  params: UpdateBookCopyParams,
  actorId: string
): Promise<InternalBookCopyDto> {
  // Khóa bản ghi FOR UPDATE
  const selRes = await db.query<any>(
    `SELECT bc.id, bc.edition_id, bc.barcode, bc.location, bc.status, bc.cover_price, bc.condition_note, bc.created_at,
            be.title_id, be.publisher, bt.title AS title_name
     FROM book_copies bc
     JOIN book_editions be ON be.id = bc.edition_id
     JOIN book_titles bt ON bt.id = be.title_id
     WHERE bc.id = $1
     FOR UPDATE`,
    [copyId]
  );

  if (selRes.rows.length === 0) {
    throw new CopyNotFoundError(`Không tìm thấy bản sách ID '${copyId}'.`);
  }

  const current = selRes.rows[0];
  assertCanUpdateCopy(current.status as CopyStatus, params);
  if (params.location !== undefined || params.coverPrice !== undefined) {
    await assertCopyNotReserved(db, copyId);
  }

  const newLocation: CopyLocation = params.location !== undefined ? params.location : current.location;
  let newCoverPrice: bigint | null = current.cover_price !== null ? BigInt(current.cover_price) : null;
  if (params.coverPrice !== undefined) {
    if (params.coverPrice === null) {
      newCoverPrice = null;
    } else {
      if (
        typeof params.coverPrice === 'boolean' ||
        (typeof params.coverPrice === 'number' && (!Number.isFinite(params.coverPrice) || !Number.isInteger(params.coverPrice)))
      ) {
        throw new CatalogError('Giá bìa phải là số nguyên hợp lệ.', 'INVALID_COVER_PRICE', 400);
      }
      const raw = BigInt(params.coverPrice);
      if (raw < 0n) throw new CatalogError('Giá bìa không được là số âm.', 'NEGATIVE_COVER_PRICE', 400);
      newCoverPrice = raw;
    }
  }

  const newConditionNote = params.conditionNote !== undefined
    ? ((params.conditionNote || '').trim() || null)
    : current.condition_note;

  await db.query(
    `UPDATE book_copies
     SET location = $2,
         cover_price = $3,
         condition_note = $4
     WHERE id = $1`,
    [copyId, newLocation, newCoverPrice !== null ? newCoverPrice.toString() : null, newConditionNote]
  );

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId,
    action: 'UPDATE_BOOK_COPY',
    targetResource: 'BOOK_COPY',
    targetId: copyId,
    details: {
      location: newLocation,
      coverPrice: newCoverPrice !== null ? Number(newCoverPrice) : null,
      conditionNote: newConditionNote,
    },
  });

  return {
    id: current.id,
    editionId: current.edition_id,
    titleId: current.title_id,
    titleName: current.title_name,
    publisher: current.publisher,
    barcode: current.barcode,
    location: newLocation,
    status: current.status as CopyStatus,
    coverPrice: newCoverPrice !== null ? Number(newCoverPrice) : null,
    calculatedDeposit: Number(calculateDeposit(newCoverPrice)),
    conditionNote: newConditionNote,
    createdAt: current.created_at,
  };
}

/**
 * 6. Lưu trữ (Archive) bản sách vật lý
 * - Không cho archive cuốn sách đang ở trạng thái BORROWED.
 * - Đổi trạng thái sang ARCHIVED, giữ nguyên lịch sử giao dịch và phiếu mượn cũ.
 */
export async function archiveBookCopy(
  db: Queryable,
  copyId: string,
  actorId: string
): Promise<InternalBookCopyDto> {
  const selRes = await db.query<any>(
    `SELECT bc.id, bc.edition_id, bc.barcode, bc.location, bc.status, bc.cover_price, bc.condition_note, bc.created_at,
            be.title_id, be.publisher, bt.title AS title_name
     FROM book_copies bc
     JOIN book_editions be ON be.id = bc.edition_id
     JOIN book_titles bt ON bt.id = be.title_id
     WHERE bc.id = $1
     FOR UPDATE`,
    [copyId]
  );

  if (selRes.rows.length === 0) {
    throw new CopyNotFoundError(`Không tìm thấy bản sách ID '${copyId}'.`);
  }

  const current = selRes.rows[0];
  await assertCopyNotReserved(db, copyId);
  if (current.status === 'BORROWED') {
    throw new CatalogError('Không thể lưu trữ (archive) bản sách đang được mượn.', 'CANNOT_ARCHIVE_BORROWED_COPY', 400);
  }
  if (current.status === 'ARCHIVED') {
    throw new CatalogError('Bản sách này đã được lưu trữ trước đó.', 'COPY_ALREADY_ARCHIVED', 400);
  }

  await db.query(
    `UPDATE book_copies SET status = 'ARCHIVED' WHERE id = $1`,
    [copyId]
  );

  const priceBigInt = current.cover_price !== null ? BigInt(current.cover_price) : null;

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId,
    action: 'ARCHIVE_BOOK_COPY',
    targetResource: 'BOOK_COPY',
    targetId: copyId,
    details: {
      previousStatus: current.status,
      newStatus: 'ARCHIVED',
    },
  });

  return {
    id: current.id,
    editionId: current.edition_id,
    titleId: current.title_id,
    titleName: current.title_name,
    publisher: current.publisher,
    barcode: current.barcode,
    location: current.location as CopyLocation,
    status: 'ARCHIVED',
    coverPrice: priceBigInt !== null ? Number(priceBigInt) : null,
    calculatedDeposit: Number(calculateDeposit(priceBigInt)),
    conditionNote: current.condition_note,
    createdAt: current.created_at,
  };
}

async function assertCopyNotReserved(db: Queryable, copyId: string): Promise<void> {
  const held = await db.query(
    `SELECT id FROM reservations WHERE copy_id = $1 AND status = 'HELD' AND expires_at > clock_timestamp() LIMIT 1`,
    [copyId]
  );
  if (held.rows.length) throw new CatalogError('Bản sách đang được giữ chỗ; cần hủy đơn trước khi thay đổi kho, giá hoặc lưu trữ.', 'COPY_RESERVED', 409);
}

/**
 * 7. S06-07: Tạo mới đầu sách (Title) kèm danh sách tác giả & thể loại
 */
export async function createBookTitle(
  db: Queryable,
  params: CreateBookTitleParams,
  actorId: string
): Promise<PublicBookDetailDto> {
  if (!params.title || typeof params.title !== 'string' || params.title.trim().length === 0) {
    throw new CatalogError('Tên đầu sách không được để trống.', 'INVALID_TITLE', 400);
  }
  if (params.title.trim().length > 255) {
    throw new CatalogError('Tên đầu sách không được vượt quá 255 ký tự.', 'TITLE_TOO_LONG', 400);
  }

  const title = params.title.trim();
  const originalTitle = params.originalTitle?.trim() || null;
  const description = params.description?.trim() || null;

  const titleRes = await db.query<any>(
    `INSERT INTO book_titles (title, original_title, description)
     VALUES ($1, $2, $3)
     RETURNING id, title, original_title, description, created_at`,
    [title, originalTitle, description]
  );
  const titleRow = titleRes.rows[0];

  const authorsList: string[] = [];
  if (Array.isArray(params.authors)) {
    for (const authorName of params.authors) {
      const cleanName = (typeof authorName === 'string' ? authorName : '').trim();
      if (cleanName.length > 0) {
        const aRes = await db.query<any>(
          `INSERT INTO authors (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, name`,
          [cleanName]
        );
        const aId = aRes.rows[0].id;
        await db.query(
          `INSERT INTO book_title_authors (title_id, author_id)
           VALUES ($1, $2)
           ON CONFLICT (title_id, author_id) DO NOTHING`,
          [titleRow.id, aId]
        );
        authorsList.push(cleanName);
      }
    }
  }

  const categoriesList: string[] = [];
  if (Array.isArray(params.categories)) {
    for (const catName of params.categories) {
      const cleanCat = (typeof catName === 'string' ? catName : '').trim();
      if (cleanCat.length > 0) {
        const cRes = await db.query<any>(
          `INSERT INTO categories (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, name`,
          [cleanCat]
        );
        const cId = cRes.rows[0].id;
        await db.query(
          `INSERT INTO book_title_categories (title_id, category_id)
           VALUES ($1, $2)
           ON CONFLICT (title_id, category_id) DO NOTHING`,
          [titleRow.id, cId]
        );
        categoriesList.push(cleanCat);
      }
    }
  }

  await recordAuditLog(db, {
    actorId,
    action: 'CREATE_BOOK_TITLE',
    targetResource: 'BOOK_TITLE',
    targetId: titleRow.id,
    details: {
      title,
      authors: authorsList,
      categories: categoriesList,
    },
  });

  return {
    id: titleRow.id,
    title: titleRow.title,
    originalTitle: titleRow.original_title,
    description: titleRow.description,
    authors: authorsList,
    categories: categoriesList,
    availableCopiesCount: 0,
    totalCopiesCount: 0,
    editions: [],
  };
}

/**
 * 8. S06-07: Tạo mới ấn bản (Edition) cho một đầu sách đã có
 */
export async function createBookEdition(
  db: Queryable,
  params: CreateBookEditionParams,
  actorId: string
): Promise<PublicEditionDto> {
  if (!params.titleId || typeof params.titleId !== 'string') {
    throw new CatalogError('Thiếu ID đầu sách.', 'MISSING_TITLE_ID', 400);
  }
  if (!params.publisher || typeof params.publisher !== 'string' || params.publisher.trim().length === 0) {
    throw new CatalogError('Nhà xuất bản không được để trống.', 'INVALID_PUBLISHER', 400);
  }

  const titleCheck = await db.query(`SELECT id FROM book_titles WHERE id = $1`, [params.titleId]);
  if (!titleCheck.rows || titleCheck.rows.length === 0) {
    throw new BookNotFoundError(`Không tìm thấy đầu sách ID '${params.titleId}'.`);
  }

  const publisher = params.publisher.trim();
  const publishYear = params.publishYear !== undefined && params.publishYear !== null
    ? Math.floor(Number(params.publishYear))
    : null;
  const isbn = params.isbn?.trim() || null;
  const coverImageUrl = params.coverImageUrl?.trim() || null;

  const insRes = await db.query<any>(
    `INSERT INTO book_editions (title_id, publisher, publish_year, isbn, cover_image_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title_id, publisher, publish_year, isbn, cover_image_url, created_at`,
    [params.titleId, publisher, publishYear, isbn, coverImageUrl]
  );
  const ed = insRes.rows[0];

  await recordAuditLog(db, {
    actorId,
    action: 'CREATE_BOOK_EDITION',
    targetResource: 'BOOK_EDITION',
    targetId: ed.id,
    details: {
      titleId: ed.title_id,
      publisher,
      publishYear,
      isbn,
    },
  });

  return {
    id: ed.id,
    publisher: ed.publisher,
    publishYear: ed.publish_year,
    isbn: ed.isbn,
    coverImageUrl: ed.cover_image_url,
    availableCopiesCount: 0,
    totalCopiesCount: 0,
    standardDeposit: 50000,
  };
}

/**
 * Tra cứu danh mục bản sao sách (Internal Book Copies List)
 * Dành cho kiểm kê bàn trực và màn hình quầy lưu thông mượn/trả.
 * Lấy trực tiếp từ catalog thật, hỗ trợ lọc theo status và tìm kiếm barcode/tiêu đề.
 */
export async function listBookCopies(
  db: Queryable,
  params: ListBookCopiesParams = {}
): Promise<{ items: InternalBookCopyDto[]; total: number; page: number; limit: number }> {
  let page = 1;
  if (params.page !== undefined && params.page !== null) {
    const p = Number(params.page);
    if (Number.isFinite(p) && Number.isInteger(p) && p >= 1) page = p;
  }
  let limit = 50;
  if (params.limit !== undefined && params.limit !== null) {
    const l = Number(params.limit);
    if (Number.isFinite(l) && Number.isInteger(l) && l >= 1 && l <= 200) limit = l;
  }
  const offset = (page - 1) * limit;

  const conditions: string[] = ["bc.status != 'ARCHIVED'"];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (params.status && params.status !== 'ALL') {
    conditions.push(`bc.status = $${paramIdx}`);
    queryParams.push(params.status);
    paramIdx++;
  }

  const rawSearch = (params.search || '').trim();
  if (rawSearch) {
    conditions.push(`(
      bc.barcode ILIKE ('%' || $${paramIdx} || '%') OR
      unaccent(lower(bt.title)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%')
    )`);
    queryParams.push(rawSearch);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const countSql = `
    SELECT COUNT(*) AS total
    FROM book_copies bc
    JOIN book_editions be ON be.id = bc.edition_id
    JOIN book_titles bt ON bt.id = be.title_id
    WHERE ${whereClause}
  `;
  const countRes = await db.query<{ total: string }>(countSql, queryParams);
  const total = Number(countRes.rows[0]?.total || 0);

  const selectSql = `
    SELECT
      bc.id,
      bc.edition_id,
      bc.barcode,
      bc.location,
      bc.status,
      bc.cover_price,
      bc.condition_note,
      bc.created_at,
      be.title_id,
      be.publisher,
      bt.title AS title_name
    FROM book_copies bc
    JOIN book_editions be ON be.id = bc.edition_id
    JOIN book_titles bt ON bt.id = be.title_id
    WHERE ${whereClause}
    ORDER BY bt.title ASC, bc.barcode ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const rowsRes = await db.query<any>(selectSql, [...queryParams, limit, offset]);

  const items: InternalBookCopyDto[] = rowsRes.rows.map((row) => {
    const priceBigInt = row.cover_price !== null && row.cover_price !== undefined ? BigInt(row.cover_price) : null;
    return {
      id: row.id,
      editionId: row.edition_id,
      titleId: row.title_id,
      titleName: row.title_name,
      publisher: row.publisher,
      barcode: row.barcode,
      location: row.location as CopyLocation,
      status: row.status as CopyStatus,
      coverPrice: priceBigInt !== null ? Number(priceBigInt) : null,
      calculatedDeposit: Number(calculateDeposit(priceBigInt)),
      conditionNote: row.condition_note,
      createdAt: row.created_at,
    };
  });

  return { items, total, page, limit };
}

