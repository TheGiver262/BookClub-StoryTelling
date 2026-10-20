/**
 * YSBK Recruitment Form Ingestion Module (Chặng 16)
 * Tiếp nhận webhook từ Google Form / Apps Script.
 * Xác thực HMAC-SHA256 / Shared Secret, chống Replay Attack (5 phút),
 * giới hạn kích thước payload, commit bền trước ACK, chống trùng lặp response_id,
 * bảo toàn 100% điểm phỏng vấn/quyết định đã chấm trên web.
 */

import crypto from 'node:crypto';
import type { Queryable } from '../../server/finance/types.ts';
import { recordAuditLog } from '../../server/shared/audit.ts';
import { BadRequestError, UnauthorizedError } from '../../server/errors.ts';
import type {
  GoogleFormWebhookPayload,
  RecruitmentResponseDetailDto,
  RecruitmentDepartment,
} from './recruitment-types.ts';

export const MAX_WEBHOOK_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 phút chống Replay Attack

export interface VerifyWebhookParams {
  rawBody: string;
  signatureHeader?: string | null;
  secretHeader?: string | null;
  timestampHeader?: string | null;
  configuredSecret?: string;
  serverNowMs?: number;
}

/**
 * 1. Xác thực an toàn Webhook (HMAC-SHA256, Shared Secret, Replay Protection)
 * Fail-closed tuyệt đối: Nếu thiếu cấu hình RECRUITMENT_WEBHOOK_SECRET, từ chối mọi yêu cầu (P22-01).
 */
export function verifyWebhookSecurity(params: VerifyWebhookParams): void {
  const {
    rawBody,
    signatureHeader,
    secretHeader,
    timestampHeader,
    serverNowMs = Date.now(),
  } = params;

  const configuredSecret = (params.configuredSecret ?? process.env.RECRUITMENT_WEBHOOK_SECRET ?? '').trim();
  if (!configuredSecret) {
    throw new UnauthorizedError(
      'Máy chủ chưa cấu hình RECRUITMENT_WEBHOOK_SECRET. Mọi yêu cầu webhook bị từ chối do lỗi cấu hình bảo mật.',
      'WEBHOOK_SECRET_UNCONFIGURED'
    );
  }

  // 1.1 Kiểm tra kích thước payload
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_PAYLOAD_BYTES) {
    throw new BadRequestError('Payload vượt quá kích thước cho phép (Max 2MB)', 'PAYLOAD_TOO_LARGE');
  }

  // 1.2 Chống Replay Attack bằng Timestamp
  if (!timestampHeader) {
    throw new UnauthorizedError('Thiếu header X-Timestamp để xác thực thời gian yêu cầu', 'MISSING_TIMESTAMP');
  }

  const reqTimeMs = Number(timestampHeader);
  if (isNaN(reqTimeMs)) {
    throw new UnauthorizedError('Định dạng header X-Timestamp không hợp lệ', 'INVALID_TIMESTAMP');
  }

  const skew = Math.abs(serverNowMs - reqTimeMs);
  if (skew > MAX_CLOCK_SKEW_MS) {
    throw new UnauthorizedError(
      `Độ lệch thời gian yêu cầu (${Math.round(skew / 1000)}s) vượt quá ngưỡng an toàn cho phép (5 phút). Nghi vấn Replay Attack.`,
      'REPLAY_ATTACK_DETECTED'
    );
  }

  // 1.3 Xác thực Chữ ký HMAC hoặc Shared Secret
  let isValid = false;

  // Cách A: Chữ ký HMAC-SHA256 (Khuyến nghị bảo mật cao nhất)
  if (signatureHeader) {
    const expectedSignature = crypto
      .createHmac('sha256', configuredSecret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest('hex');

    if (
      signatureHeader.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))
    ) {
      isValid = true;
    }
  }

  // Cách B: Shared Secret Token (khi Apps Script cấu hình token tĩnh)
  if (!isValid && secretHeader) {
    if (
      secretHeader.length === configuredSecret.length &&
      crypto.timingSafeEqual(Buffer.from(secretHeader), Buffer.from(configuredSecret))
    ) {
      isValid = true;
    }
  }

  if (!isValid) {
    throw new UnauthorizedError('Chữ ký hoặc Secret Webhook không chính xác', 'INVALID_WEBHOOK_SIGNATURE');
  }
}

/**
 * Chuẩn hóa tên ban từ form tự do sang Enum chuẩn
 */
export function normalizeDepartment(raw?: string | null): RecruitmentDepartment {
  if (!raw) return 'BAN_HAU_CAN';
  const clean = raw.toLowerCase().trim();
  if (clean.includes('nội dung') || clean.includes('noi dung')) return 'BAN_NOI_DUNG';
  if (clean.includes('truyền thông') || clean.includes('đối ngoại') || clean.includes('ttdn')) return 'BAN_TTDN';
  if (clean.includes('chủ nhiệm')) return 'BAN_CHU_NHIEM';
  return 'BAN_HAU_CAN'; // Mặc định Hậu cần
}

/**
 * 2. Tiếp nhận và Commit Bền Đơn Ứng Tuyển (Durable Ingest)
 */
export async function ingestFormResponse(
  db: Queryable,
  payload: GoogleFormWebhookPayload,
  securityCheckParams?: VerifyWebhookParams
): Promise<{ response: RecruitmentResponseDetailDto; isDuplicate: boolean; isUpdated: boolean }> {
  // Xác thực bảo mật nếu có tham số
  if (securityCheckParams) {
    verifyWebhookSecurity(securityCheckParams);
  }

  // Validate các trường bắt buộc
  if (!payload.formId || !payload.responseId) {
    throw new BadRequestError('Thiếu formId hoặc responseId định danh nguồn đơn', 'MISSING_SOURCE_KEY');
  }

  const applicantName = (payload.applicantName || payload.answers['Họ và tên'] || payload.answers['Họ tên'] || 'Ứng viên chưa rõ') as string;
  const applicantEmail = (payload.applicantEmail || payload.answers['Email'] || payload.answers['Địa chỉ email'] || '') as string;
  
  if (!applicantEmail || !applicantEmail.includes('@')) {
    throw new BadRequestError('Email ứng viên không hợp lệ hoặc bị thiếu', 'INVALID_APPLICANT_EMAIL');
  }

  const applicantPhone = (payload.applicantPhone || payload.answers['Số điện thoại'] || payload.answers['SĐT'] || null) as string | null;
  const applicantStudentId = (payload.applicantStudentId || payload.answers['MSSV'] || payload.answers['Mã số sinh viên'] || null) as string | null;
  
  const aspiration1Raw = (payload.aspiration1 || payload.answers['Nguyện vọng 1'] || payload.answers['Ban nguyện vọng 1'] || 'Hậu cần') as string;
  const aspiration2Raw = (payload.aspiration2 || payload.answers['Nguyện vọng 2'] || payload.answers['Ban nguyện vọng 2'] || null) as string | null;

  const aspiration1 = normalizeDepartment(aspiration1Raw);
  const aspiration2 = aspiration2Raw ? normalizeDepartment(aspiration2Raw) : null;

  const whyJoin = (payload.whyJoin || payload.answers['Lý do tham gia'] || payload.answers['Vì sao bạn chọn YSBK?'] || null) as string | null;
  const essayContent = (payload.essayContent || payload.answers['Bài viết cảm nhận'] || payload.answers['Bài viết'] || null) as string | null;
  const cvLink = (payload.cvLink || payload.answers['Link CV'] || payload.answers['CV'] || null) as string | null;

  const submissionTimestamp = payload.timestamp
    ? (typeof payload.timestamp === 'number' ? new Date(payload.timestamp).toISOString() : new Date(payload.timestamp).toISOString())
    : new Date().toISOString();

  // Kiểm tra khóa nguồn (form_id, response_id) đã tồn tại trong DB chưa
  const existingRes = await db.query<any>(
    `SELECT * FROM recruitment_form_responses WHERE form_id = $1 AND response_id = $2`,
    [payload.formId, payload.responseId]
  );

  let recordId: string;
  let isDuplicate = false;
  let isUpdated = false;
  let currentVersion = 1;

  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    recordId = existing.id;
    currentVersion = Number(existing.version || 1);

    // So sánh dữ liệu có thay đổi không
    const hasChanged =
      existing.applicant_name !== applicantName ||
      existing.applicant_email !== applicantEmail ||
      existing.aspiration_1 !== aspiration1 ||
      existing.aspiration_2 !== aspiration2 ||
      existing.why_join !== whyJoin ||
      existing.essay_content !== essayContent;

    if (!hasChanged) {
      // Đúng là duplicate hoàn toàn -> Idempotent ACK, cập nhật last_observed_at
      await db.query(
        `UPDATE recruitment_form_responses
         SET last_observed_at = NOW()
         WHERE id = $1`,
        [recordId]
      );
      isDuplicate = true;
    } else {
      // Ứng viên sửa đổi câu trả lời trên Form -> Cập nhật dữ liệu nguồn, tăng version
      currentVersion += 1;
      await db.query(
        `UPDATE recruitment_form_responses
         SET applicant_name = $1,
             applicant_student_id = $2,
             applicant_email = $3,
             applicant_phone = $4,
             aspiration_1 = $5,
             aspiration_2 = $6,
             why_join = $7,
             essay_content = $8,
             cv_link = $9,
             raw_answers = $10,
             version = $11,
             last_observed_at = NOW(),
             updated_at = NOW()
         WHERE id = $12`,
        [
          applicantName,
          applicantStudentId,
          applicantEmail,
          applicantPhone,
          aspiration1,
          aspiration2,
          whyJoin,
          essayContent,
          cvLink,
          JSON.stringify(payload.answers || {}),
          currentVersion,
          recordId,
        ]
      );
      isUpdated = true;
      // QUAN TRỌNG: TUYỆT ĐỐI KHÔNG XÓA recruitment_evaluations
    }
  } else {
    // Đơn mới hoàn toàn -> Commit bền vào DB
    recordId = `RESP_${payload.formId}_${payload.responseId.slice(-8)}`;
    await db.query(
      `INSERT INTO recruitment_form_responses (
        id, form_id, response_id, submission_timestamp,
        applicant_name, applicant_student_id, applicant_email, applicant_phone,
        aspiration_1, aspiration_2, why_join, essay_content, cv_link,
        raw_answers, sync_status, last_observed_at, version, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, 'SYNCED', NOW(), 1, NOW(), NOW()
      )`,
      [
        recordId,
        payload.formId,
        payload.responseId,
        submissionTimestamp,
        applicantName,
        applicantStudentId,
        applicantEmail,
        applicantPhone,
        aspiration1,
        aspiration2,
        whyJoin,
        essayContent,
        cvLink,
        JSON.stringify(payload.answers || {}),
      ]
    );
  }

  // Ghi nhật ký kiểm toán hệ thống
  await recordAuditLog(db, {
    action: isDuplicate ? 'RECRUITMENT_FORM_ACK_DUPLICATE' : (isUpdated ? 'RECRUITMENT_FORM_UPDATE' : 'RECRUITMENT_FORM_INGEST'),
    targetResource: 'recruitment_form_responses',
    targetId: recordId,
    details: {
      formId: payload.formId,
      responseId: payload.responseId,
      applicantEmail,
      isDuplicate,
      isUpdated,
      version: currentVersion,
    },
  });

  const finalRes = await db.query<any>(
    `SELECT * FROM recruitment_form_responses WHERE id = $1`,
    [recordId]
  );
  const row = finalRes.rows[0];

  const dto: RecruitmentResponseDetailDto = {
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
  };

  return { response: dto, isDuplicate, isUpdated };
}
