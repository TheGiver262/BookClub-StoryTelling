/**
 * YSBK Duty Availability Service (Chặng 14: Import Excel lịch bận theo mẫu thống nhất)
 * Quản lý preview an toàn, versioning batches, và commit khoảng giờ bận có kiểu.
 */

import type { Queryable } from '../finance/types.ts';
import { recordAuditLog } from '../shared/audit.ts';
import { claimIdempotency, completeIdempotency, computePayloadHash } from '../shared/idempotency.ts';
import { BadRequestError } from '../errors.ts';
import { 
  parseAvailabilityXlsxBuffer, 
  type MemberLookup 
} from './availability-parser.ts';
import { 
  type AvailabilityPreviewResult, 
  type CommitAvailabilityParams, 
  type AvailabilityBatchDto, 
  type MemberBusyIntervalDto 
} from './availability-types.ts';

/**
 * 1. Xem trước (Preview) tệp Excel lịch bận mà không làm thay đổi dữ liệu
 */
export async function previewAvailabilityFile(
  db: Queryable,
  fileBuffer: Buffer,
  fileName: string,
  options?: { termSemester?: string; effectiveStartDate?: string; effectiveEndDate?: string }
): Promise<AvailabilityPreviewResult> {
  // Lấy danh bạ thành viên hiện tại để khớp danh tính
  const mRes = await db.query<any>(
    `SELECT id, full_name, username FROM members WHERE is_active = TRUE`
  );

  const members: MemberLookup[] = (mRes.rows || []).map((m: any) => ({
    id: m.id,
    fullName: m.full_name,
    username: m.username,
    studentId: null,
  }));

  return parseAvailabilityXlsxBuffer(fileBuffer, members, fileName, options);
}

/**
 * 2. Xác nhận lưu (Commit) đợt import lịch bận có phiên bản (Versioning)
 * Đảm bảo: Dòng lỗi không thành rảnh, chống trùng intervals, import lại không nhân bản dữ liệu.
 */
export async function commitAvailabilityBatch(
  db: Queryable,
  params: CommitAvailabilityParams,
  actorId: string
): Promise<{ batch: AvailabilityBatchDto; intervalsCount: number }> {
  if (!params.termSemester || !params.termSemester.trim()) {
    throw new BadRequestError('Bắt buộc chỉ định kỳ học áp dụng (termSemester).', 'MISSING_TERM_SEMESTER');
  }

  if (!params.validRows || params.validRows.length === 0) {
    throw new BadRequestError('Không có dòng dữ liệu hợp lệ nào để lưu vào hệ thống.', 'NO_VALID_ROWS_TO_COMMIT');
  }

  const termSemester = params.termSemester.trim();
  const effectiveStartDate = params.effectiveStartDate || new Intl.DateTimeFormat('en-CA').format(new Date());
  const effectiveEndDate = params.effectiveEndDate || new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0];

  // Idempotency: Kiểm tra chống double-commit
  let payloadHash: string | null = null;
  if (params.idempotencyKey) {
    payloadHash = computePayloadHash({
      termSemester,
      fileHash: params.fileHash,
      validRowsCount: params.validRows.length,
      effectiveStartDate,
      effectiveEndDate,
    });

    const claim = await claimIdempotency(
      db,
      actorId,
      'COMMIT_AVAILABILITY_BATCH',
      params.idempotencyKey,
      payloadHash
    );

    if (claim.action === 'RETURN_CACHED') {
      return claim.responseBody as { batch: AvailabilityBatchDto; intervalsCount: number };
    }
  }

  // 1. Xác định version tiếp theo cho kỳ học (termSemester)
  const verRes = await db.query<any>(
    `SELECT COALESCE(MAX(version), 0) AS max_ver FROM duty_availability_batches WHERE term_semester = $1`,
    [termSemester]
  );
  const nextVersion = Number(verRes.rows[0]?.max_ver || 0) + 1;

  // 2. Chuyển trạng thái các batch cũ của cùng kỳ học thành SUPERSEDED
  await db.query(
    `UPDATE duty_availability_batches
     SET status = 'SUPERSEDED'
     WHERE term_semester = $1 AND status = 'COMMITTED'`,
    [termSemester]
  );

  // 3. Vô hiệu hóa (is_active = FALSE) các khoảng giờ bận cũ để tránh nhân bản dữ liệu (duplicate intervals)
  await db.query(
    `UPDATE member_busy_intervals
     SET is_active = FALSE
     WHERE batch_id IN (
       SELECT id FROM duty_availability_batches WHERE term_semester = $1 AND status = 'SUPERSEDED'
     )`,
    [termSemester]
  );

  // 4. Tạo bản ghi batch mới
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const batchName = params.batchName || `Lịch bận ${termSemester} (Đợt ${nextVersion})`;

  const insBatchRes = await db.query<any>(
    `INSERT INTO duty_availability_batches (
       id, batch_name, file_name, file_hash, file_size_bytes,
       term_semester, version, status, total_rows, valid_rows,
       error_rows, imported_by, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMMITTED', $8, $9, $10, $11, NOW())
     RETURNING id, batch_name, file_name, file_hash, file_size_bytes,
               term_semester, version, status, total_rows, valid_rows,
               error_rows, imported_by, created_at`,
    [
      batchId,
      batchName,
      params.fileName,
      params.fileHash,
      params.fileSizeBytes.toString(),
      termSemester,
      nextVersion,
      params.validRows.length,
      params.validRows.length,
      0,
      actorId,
    ]
  );
  const batchRow = insBatchRes.rows[0];

  // 5. Chèn các khoảng giờ bận hợp lệ (member_busy_intervals)
  for (let i = 0; i < params.validRows.length; i++) {
    const r = params.validRows[i];
    const intervalId = `intv-${batchId}-${i + 1}`;
    await db.query(
      `INSERT INTO member_busy_intervals (
         id, batch_id, member_id, day_of_week, start_time, end_time,
         busy_type, effective_start_date, effective_end_date, notes, is_active, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())`,
      [
        intervalId,
        batchId,
        r.memberId,
        r.dayOfWeek,
        r.startTime,
        r.endTime,
        r.busyType,
        effectiveStartDate,
        effectiveEndDate,
        r.notes || null,
      ]
    );
  }

  // 6. Ghi nhật ký kiểm toán (System Audit Log)
  await recordAuditLog(db, {
    actorId,
    action: 'COMMIT_AVAILABILITY_BATCH',
    targetResource: 'DUTY_AVAILABILITY_BATCH',
    targetId: batchId,
    details: {
      batchName,
      termSemester,
      version: nextVersion,
      validRowsCount: params.validRows.length,
      fileHash: params.fileHash,
    },
  });

  const result = {
    batch: {
      id: batchRow.id,
      batchName: batchRow.batch_name,
      fileName: batchRow.file_name,
      fileHash: batchRow.file_hash,
      fileSizeBytes: Number(batchRow.file_size_bytes),
      termSemester: batchRow.term_semester,
      version: batchRow.version,
      status: batchRow.status,
      totalRows: batchRow.total_rows,
      validRows: batchRow.valid_rows,
      errorRows: batchRow.error_rows,
      importedBy: batchRow.imported_by,
      createdAt: typeof batchRow.created_at === 'string' ? batchRow.created_at : new Date(batchRow.created_at).toISOString(),
    },
    intervalsCount: params.validRows.length,
  };

  if (params.idempotencyKey && payloadHash) {
    await completeIdempotency(
      db,
      actorId,
      'COMMIT_AVAILABILITY_BATCH',
      params.idempotencyKey,
      200,
      result
    );
  }

  return result;
}

/**
 * 3. Lấy danh sách các đợt import lịch bận
 */
export async function listAvailabilityBatches(
  db: Queryable,
  termSemester?: string
): Promise<AvailabilityBatchDto[]> {
  let sql = `SELECT id, batch_name, file_name, file_hash, file_size_bytes,
                    term_semester, version, status, total_rows, valid_rows,
                    error_rows, imported_by, created_at
             FROM duty_availability_batches`;
  const params: any[] = [];
  if (termSemester) {
    sql += ` WHERE term_semester = $1`;
    params.push(termSemester);
  }
  sql += ` ORDER BY created_at DESC`;

  const res = await db.query<any>(sql, params);
  return (res.rows || []).map((r: any) => ({
    id: r.id,
    batchName: r.batch_name,
    fileName: r.file_name,
    fileHash: r.file_hash,
    fileSizeBytes: Number(r.file_size_bytes),
    termSemester: r.term_semester,
    version: r.version,
    status: r.status,
    totalRows: r.total_rows,
    validRows: r.valid_rows,
    errorRows: r.error_rows,
    importedBy: r.imported_by,
    createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
  }));
}

/**
 * 4. Lấy danh sách các khoảng giờ bận đang hoạt động của thành viên
 */
export async function getMemberBusyIntervals(
  db: Queryable,
  memberId: string
): Promise<MemberBusyIntervalDto[]> {
  const res = await db.query<any>(
    `SELECT mbi.id, mbi.batch_id, mbi.member_id, m.full_name as member_name,
            mbi.day_of_week, mbi.start_time, mbi.end_time, mbi.busy_type,
            mbi.effective_start_date, mbi.effective_end_date, mbi.notes,
            mbi.is_active, mbi.created_at
     FROM member_busy_intervals mbi
     JOIN members m ON m.id = mbi.member_id
     WHERE mbi.member_id = $1 AND mbi.is_active = TRUE
     ORDER BY mbi.day_of_week ASC, mbi.start_time ASC`,
    [memberId]
  );

  return (res.rows || []).map((r: any) => ({
    id: r.id,
    batchId: r.batch_id,
    memberId: r.member_id,
    memberName: r.member_name,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    busyType: r.busy_type,
    effectiveStartDate: typeof r.effective_start_date === 'string' ? r.effective_start_date : new Intl.DateTimeFormat('en-CA').format(new Date(r.effective_start_date)),
    effectiveEndDate: typeof r.effective_end_date === 'string' ? r.effective_end_date : new Intl.DateTimeFormat('en-CA').format(new Date(r.effective_end_date)),
    notes: r.notes || null,
    isActive: Boolean(r.is_active),
    createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
  }));
}
