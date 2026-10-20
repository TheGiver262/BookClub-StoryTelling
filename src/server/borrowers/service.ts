/**
 * Borrower Service - YSBK
 * Triển khai nghiệp vụ người mượn cộng đồng độc lập
 */

import type { Queryable } from '../finance/types.ts';
import type {
  BorrowerDto,
  CreateBorrowerParams,
  UpdateBorrowerParams,
  SearchBorrowersParams,
} from './types.ts';
import {
  BorrowerError,
  normalizePhone,
  validateBorrowerInput,
} from './rules.ts';
import { recordAuditLog } from '../shared/audit.ts';

export class BorrowerNotFoundError extends BorrowerError {
  constructor(message = 'Không tìm thấy hồ sơ người mượn.') {
    super(message, 'BORROWER_NOT_FOUND', 404);
    this.name = 'BorrowerNotFoundError';
  }
}

export { BorrowerError };

function mapBorrowerRow(r: any): BorrowerDto {
  return {
    id: r.id,
    fullName: r.full_name,
    studentId: r.student_id || null,
    school: r.school || null,
    phone: r.phone,
    email: r.email || null,
    notes: r.notes || null,
    isArchived: Boolean(r.is_archived),
    createdAt: r.created_at,
  };
}

/**
 * 1. Tìm kiếm danh sách người mượn (Chỉ dành cho Thành viên bàn trực & Admin)
 * - Tra cứu theo Số điện thoại, Mã số sinh viên, hoặc Họ tên (tiếng Việt có dấu/không dấu).
 * - Cho phép lọc bỏ hồ sơ đã lưu trữ (is_archived).
 * - Phân trang kiểm soát tối đa 100 kết quả mỗi trang.
 */
export async function searchBorrowers(
  db: Queryable,
  params: SearchBorrowersParams = {}
): Promise<{ items: BorrowerDto[]; total: number; page: number; limit: number }> {
  let page = 1;
  if (params.page !== undefined && params.page !== null) {
    const p = Number(params.page);
    if (!Number.isFinite(p) || !Number.isInteger(p) || p < 1) {
      throw new BorrowerError('Tham số page phải là số nguyên dương.', 'INVALID_PAGE', 400);
    }
    page = p;
  }

  let limit = 20;
  if (params.limit !== undefined && params.limit !== null) {
    const l = Number(params.limit);
    if (!Number.isFinite(l) || !Number.isInteger(l) || l < 1 || l > 100) {
      throw new BorrowerError('Tham số limit phải là số nguyên từ 1 đến 100.', 'INVALID_LIMIT', 400);
    }
    limit = l;
  }
  const offset = (page - 1) * limit;

  const rawQuery = (params.query || '').trim();
  if (rawQuery.length > 200) {
    throw new BorrowerError('Từ khóa tìm kiếm không được vượt quá 200 ký tự.', 'QUERY_TOO_LONG', 400);
  }
  const includeArchived = Boolean(params.includeArchived);

  const conditions: string[] = ['1=1'];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (!includeArchived) {
    conditions.push(`b.is_archived = FALSE`);
  }

  if (rawQuery) {
    // Tìm kiếm linh hoạt: khớp SĐT, MSSV hoặc Họ tên tiếng Việt
    conditions.push(`(
      b.phone ILIKE ('%' || $${paramIdx} || '%') OR
      b.student_id ILIKE ('%' || $${paramIdx} || '%') OR
      unaccent(lower(b.full_name)) ILIKE ('%' || unaccent(lower($${paramIdx})) || '%')
    )`);
    queryParams.push(rawQuery);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const countSql = `SELECT COUNT(*) AS total FROM borrowers b WHERE ${whereClause}`;
  const countRes = await db.query<{ total: string }>(countSql, queryParams);
  const total = Number(countRes.rows[0]?.total || 0);

  const selectSql = `
    SELECT b.id, b.full_name, b.student_id, b.school, b.phone, b.email, b.notes, b.is_archived, b.created_at
    FROM borrowers b
    WHERE ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const rowsRes = await db.query<any>(selectSql, [...queryParams, limit, offset]);
  const items = rowsRes.rows.map(mapBorrowerRow);

  return { items, total, page, limit };
}

/**
 * 2. Lấy chi tiết hồ sơ người mượn theo ID
 */
export async function getBorrowerById(db: Queryable, id: string): Promise<BorrowerDto | null> {
  const sql = `
    SELECT id, full_name, student_id, school, phone, email, notes, is_archived, created_at
    FROM borrowers
    WHERE id = $1
  `;
  const res = await db.query<any>(sql, [id]);
  if (res.rows.length === 0) return null;
  return mapBorrowerRow(res.rows[0]);
}

/**
 * 3. Tạo mới hồ sơ người mượn (Bàn trực tạo nhanh cho độc giả)
 * - Độc lập với tài khoản đăng nhập nội bộ (không tự tạo web account).
 * - Chỉ bắt buộc Họ tên và SĐT; MSSV và Trường để NULL đối với người dân ngoài Bách Khoa.
 * - Cho phép hai người dùng chung số điện thoại (ID độc lập, không ép UNIQUE phone làm gộp người).
 */
export async function createBorrower(
  db: Queryable,
  params: CreateBorrowerParams,
  actorId: string
): Promise<BorrowerDto> {
  validateBorrowerInput(params, true);

  const fullName = params.fullName.trim();
  const phone = normalizePhone(params.phone);
  const studentId = params.studentId?.trim() || null;
  const school = params.school?.trim() || null;
  const email = params.email?.trim() || null;
  const notes = params.notes?.trim() || null;

  const sql = `
    INSERT INTO borrowers (full_name, student_id, school, phone, email, notes, is_archived)
    VALUES ($1, $2, $3, $4, $5, $6, FALSE)
    RETURNING id, full_name, student_id, school, phone, email, notes, is_archived, created_at
  `;

  const res = await db.query<any>(sql, [fullName, studentId, school, phone, email, notes]);
  const created = mapBorrowerRow(res.rows[0]);

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId,
    action: 'CREATE_BORROWER',
    targetResource: 'BORROWER',
    targetId: created.id,
    details: {
      fullName: created.fullName,
      phone: created.phone,
      studentId: created.studentId,
      school: created.school,
    },
  });

  return created;
}

/**
 * 4. Cập nhật thông tin người mượn
 */
export async function updateBorrower(
  db: Queryable,
  id: string,
  params: UpdateBorrowerParams,
  actorId: string
): Promise<BorrowerDto> {
  validateBorrowerInput(params, false);

  const selRes = await db.query<any>(
    `SELECT id, full_name, student_id, school, phone, email, notes, is_archived, created_at
     FROM borrowers
     WHERE id = $1
     FOR UPDATE`,
    [id]
  );

  if (selRes.rows.length === 0) {
    throw new BorrowerNotFoundError(`Không tìm thấy hồ sơ người mượn ID '${id}'.`);
  }

  const current = selRes.rows[0];
  if (current.is_archived) {
    throw new BorrowerError('Hồ sơ người mượn đã bị lưu trữ, không thể chỉnh sửa.', 'BORROWER_ARCHIVED', 400);
  }

  const newFullName = params.fullName !== undefined ? params.fullName.trim() : current.full_name;
  const newPhone = params.phone !== undefined ? normalizePhone(params.phone) : current.phone;
  if (newPhone !== current.phone) {
    const outstanding = await db.query(`SELECT 1 FROM loan_receipts lr JOIN loan_items li ON li.receipt_id = lr.id
      WHERE lr.borrower_id = $1 AND li.returned_at IS NULL AND li.carried_forward_at IS NULL LIMIT 1`, [id]);
    if (outstanding.rows.length) throw new BorrowerError('Không thể đổi SĐT khi còn nghĩa vụ sách chưa kết thúc.', 'PHONE_CHANGE_WITH_OPEN_LOAN', 409);
  }
  const newStudentId = params.studentId !== undefined ? (params.studentId?.trim() || null) : current.student_id;
  const newSchool = params.school !== undefined ? (params.school?.trim() || null) : current.school;
  const newEmail = params.email !== undefined ? (params.email?.trim() || null) : current.email;
  const newNotes = params.notes !== undefined ? (params.notes?.trim() || null) : current.notes;

  const updRes = await db.query<any>(
    `UPDATE borrowers
     SET full_name = $2,
         student_id = $3,
         school = $4,
         phone = $5,
         email = $6,
         notes = $7
     WHERE id = $1
     RETURNING id, full_name, student_id, school, phone, email, notes, is_archived, created_at`,
    [id, newFullName, newStudentId, newSchool, newPhone, newEmail, newNotes]
  );

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId,
    action: 'UPDATE_BORROWER',
    targetResource: 'BORROWER',
    targetId: id,
    details: {
      fullName: newFullName,
      phone: newPhone,
      studentId: newStudentId,
      school: newSchool,
    },
  });

  return mapBorrowerRow(updRes.rows[0]);
}

/**
 * 5. Lưu trữ (Archive) hồ sơ người mượn
 * - S06-05: Kiểm tra nếu người mượn đang có sách mượn chưa trả hoặc nghĩa vụ cọc chưa tất toán thì cấm archive.
 * - Xét các trạng thái ACTIVE, OVERDUE, PARTIAL_SETTLED, các dòng loan_items chưa trả, và cọc HELD/PENDING_REFUND.
 */
export async function archiveBorrower(
  db: Queryable,
  id: string,
  actorId: string
): Promise<BorrowerDto> {
  const selRes = await db.query<any>(
    `SELECT id, full_name, student_id, school, phone, email, notes, is_archived, created_at
     FROM borrowers
     WHERE id = $1
     FOR UPDATE`,
    [id]
  );

  if (selRes.rows.length === 0) {
    throw new BorrowerNotFoundError(`Không tìm thấy hồ sơ người mượn ID '${id}'.`);
  }

  const current = selRes.rows[0];
  if (current.is_archived) {
    throw new BorrowerError('Hồ sơ người mượn này đã được lưu trữ trước đó.', 'BORROWER_ALREADY_ARCHIVED', 400);
  }

  // S06-05: Kiểm tra mọi phiếu mượn chưa tất toán, bao gồm ACTIVE, OVERDUE, PARTIAL_SETTLED, hoặc còn sách chưa trả
  const loanCheck = await db.query<any>(
    `SELECT lr.id, lr.status
     FROM loan_receipts lr
     WHERE lr.borrower_id = $1
       AND (
         lr.status IN ('ACTIVE', 'OVERDUE')
         OR EXISTS (
           SELECT 1 FROM loan_items li
           WHERE li.receipt_id = lr.id AND li.returned_at IS NULL AND li.is_lost = FALSE AND li.carried_forward_at IS NULL
         )
         OR EXISTS (
           SELECT 1 FROM deposit_allocations da
           WHERE da.receipt_id = lr.id AND da.status IN ('HELD', 'PENDING_REFUND')
         )
       )
     LIMIT 1`,
    [id]
  );
  if (loanCheck.rows.length > 0) {
    throw new BorrowerError(
      'Không thể lưu trữ hồ sơ người mượn đang có phiếu mượn sách chưa hoàn tất hoặc nghĩa vụ cọc chưa tất toán.',
      'BORROWER_HAS_ACTIVE_LOANS',
      400
    );
  }

  const updRes = await db.query<any>(
    `UPDATE borrowers SET is_archived = TRUE WHERE id = $1
     RETURNING id, full_name, student_id, school, phone, email, notes, is_archived, created_at`,
    [id]
  );

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId,
    action: 'ARCHIVE_BORROWER',
    targetResource: 'BORROWER',
    targetId: id,
    details: {
      fullName: current.full_name,
      isArchived: true,
    },
  });

  return mapBorrowerRow(updRes.rows[0]);
}
