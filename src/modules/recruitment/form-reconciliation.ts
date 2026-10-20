/**
 * YSBK Form Reconciliation Module (Chặng 16)
 * Đối soát đơn ứng tuyển, kiểm tra checkpoint, bù các đơn bị thất lạc/rớt mạng,
 * và cung cấp danh sách hồ sơ tuyển sinh cho nội bộ và công chúng (an toàn PII).
 */

import type { Queryable } from '../../server/finance/types.ts';
import { recordAuditLog } from '../../server/shared/audit.ts';
import { ingestFormResponse } from './ingest-form.ts';
import { toPublicApplicantView } from './pii-masker.ts';
import type {
  GoogleFormWebhookPayload,
  RecruitmentResponseDetailDto,
  RecruitmentResponsePublicDto,
  ReconciliationResultDto,
} from './recruitment-types.ts';

/**
 * 1. Chạy Đối Soát Checkpoint Bù Đơn Thiếu (Reconciliation)
 */
export async function reconcileFormResponses(
  db: Queryable,
  formId: string,
  observedPayloads: GoogleFormWebhookPayload[],
  actorId?: string
): Promise<ReconciliationResultDto> {
  // Kiểm tra form tồn tại
  const formRes = await db.query<any>(
    `SELECT * FROM recruitment_forms WHERE id = $1`,
    [formId]
  );
  if (formRes.rows.length === 0) {
    // Nếu chưa có trong DB, tự động khởi tạo form mặc định
    await db.query(
      `INSERT INTO recruitment_forms (id, title, term_semester, is_active, version, created_at, updated_at)
       VALUES ($1, $2, '2026.1', true, 1, NOW(), NOW())`,
      [formId, `Đơn Tuyển Thành Viên ${formId}`]
    );
  }

  // Lấy danh sách response_id đã có trong DB
  const existingRes = await db.query<any>(
    `SELECT response_id FROM recruitment_form_responses WHERE form_id = $1`,
    [formId]
  );
  const existingSet = new Set<string>(existingRes.rows.map((r) => r.response_id));

  let syncedCount = 0;
  let missingBackfilledCount = 0;
  const missingResponseIds: string[] = [];

  for (const item of observedPayloads) {
    if (existingSet.has(item.responseId)) {
      syncedCount++;
    } else {
      // Đơn bị thiếu trong hệ thống -> Tự động nạp bù (Backfill)
      await ingestFormResponse(db, item);
      missingBackfilledCount++;
      missingResponseIds.push(item.responseId);
      existingSet.add(item.responseId);
    }
  }

  const checkpointId = `CHK_${formId}_${Date.now()}`;
  const totalObserved = observedPayloads.length;
  const status = 'SUCCESS';

  await db.query(
    `INSERT INTO recruitment_reconciliation_checkpoints (
      id, form_id, last_synced_at, total_responses_observed, missing_responses_count, status, details, created_at
    ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, NOW())`,
    [
      checkpointId,
      formId,
      totalObserved,
      missingBackfilledCount,
      status,
      JSON.stringify({ missingResponseIds, backfilledAt: new Date().toISOString() }),
    ]
  );

  await recordAuditLog(db, {
    actorId: actorId || null,
    action: 'RECRUITMENT_RECONCILE',
    targetResource: 'recruitment_reconciliation_checkpoints',
    targetId: checkpointId,
    details: {
      formId,
      totalObserved,
      syncedCount,
      missingBackfilledCount,
      missingResponseIds,
    },
  });

  return {
    formId,
    totalObserved,
    syncedCount,
    missingBackfilledCount,
    discrepancyCount: 0,
    checkpointId,
    status,
    details: { missingResponseIds },
  };
}

/**
 * 2. Lấy danh sách hồ sơ ứng tuyển nội bộ (Chỉ cho Thành viên / Admin)
 */
export async function listRecruitmentResponses(
  db: Queryable,
  options?: {
    formId?: string;
    aspiration?: string;
    search?: string;
  }
): Promise<RecruitmentResponseDetailDto[]> {
  let sql = `SELECT * FROM recruitment_form_responses WHERE 1=1`;
  const params: any[] = [];

  if (options?.formId) {
    params.push(options.formId);
    sql += ` AND form_id = $${params.length}`;
  }

  if (options?.aspiration) {
    params.push(options.aspiration);
    sql += ` AND (aspiration_1 = $${params.length} OR aspiration_2 = $${params.length})`;
  }

  if (options?.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    sql += ` AND (LOWER(applicant_name) LIKE $${params.length} OR LOWER(applicant_email) LIKE $${params.length} OR applicant_student_id LIKE $${params.length})`;
  }

  sql += ` ORDER BY submission_timestamp DESC`;

  const res = await db.query<any>(sql, params);
  return res.rows.map((row) => ({
    id: row.id,
    formId: row.form_id,
    responseId: row.response_id,
    submissionTimestamp: row.submission_timestamp,
    applicantName: row.applicant_name,
    applicantStudentId: row.applicant_student_id,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone,
    aspiration1: row.aspiration_1,
    aspiration2: row.aspiration_2,
    whyJoin: row.why_join,
    essayContent: row.essay_content,
    cvLink: row.cv_link,
    rawAnswers: typeof row.raw_answers === 'string' ? JSON.parse(row.raw_answers) : row.raw_answers,
    syncStatus: row.sync_status,
    lastObservedAt: row.last_observed_at,
    syncError: row.sync_error,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * 3. Lấy báo cáo thống kê công khai (Đã lược bỏ/che giấu toàn bộ PII cho Guest/Public)
 */
export async function getPublicRecruitmentSummary(
  db: Queryable,
  formId?: string
): Promise<{
  totalApplicants: number;
  byAspiration1: Record<string, number>;
  byAspiration2: Record<string, number>;
  publicList: RecruitmentResponsePublicDto[];
}> {
  const allDetails = await listRecruitmentResponses(db, { formId });
  
  const byAspiration1: Record<string, number> = {};
  const byAspiration2: Record<string, number> = {};

  for (const d of allDetails) {
    byAspiration1[d.aspiration1] = (byAspiration1[d.aspiration1] || 0) + 1;
    if (d.aspiration2) {
      byAspiration2[d.aspiration2] = (byAspiration2[d.aspiration2] || 0) + 1;
    }
  }

  const publicList = allDetails.map(toPublicApplicantView);

  return {
    totalApplicants: allDetails.length,
    byAspiration1,
    byAspiration2,
    publicList,
  };
}
