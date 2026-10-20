/**
 * YSBK Unit Test Suite: Recruitment Google Form Sync & Reconciliation (Chặng 16)
 * Kiểm chứng toàn bộ các Gates yêu cầu:
 * - Giả chữ ký HMAC / Secret sai bị chặn (401)
 * - Replay attack lệch quá 5 phút bị chặn (401)
 * - Duplicate cùng response_id vẫn một hồ sơ duy nhất
 * - Đối soát checkpoint bù đơn thất lạc
 * - Sync lại sau khi chấm không bao giờ mất điểm/ghi chú/quyết định
 * - Response công khai không lộ PII
 * - RBAC barrier: Guest/Cựu không thể xem hồ sơ nội bộ hoặc gọi callback giả
 */

import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  verifyWebhookSecurity,
  ingestFormResponse,
} from '../../src/modules/recruitment/ingest-form.ts';
import {
  reconcileFormResponses,
  getPublicRecruitmentSummary,
} from '../../src/modules/recruitment/form-reconciliation.ts';
import {
  maskEmail,
  maskPhone,
  maskStudentId,
  maskFullName,
} from '../../src/modules/recruitment/pii-masker.ts';
import { handleRequest } from '../../src/server/router.ts';

const TEST_WEBHOOK_SECRET = 'unit_test_webhook_secret_key_32_chars';

function createHmacSignature(rawBody: string, timestamp: string, secret: string = TEST_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

test('Chặng 16 - Gate 1: Giả chữ ký HMAC hoặc secret sai bị chặn với HTTP 401', () => {
  const payload = {
    formId: 'FORM_GEN_10',
    responseId: 'RESP_001',
    timestamp: Date.now(),
    answers: { 'Họ tên': 'Nguyễn Văn A', 'Email': 'a@gmail.com' },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = Date.now().toString();

  // Chữ ký sai lệch
  assert.throws(
    () => {
      verifyWebhookSecurity({
        rawBody,
        timestampHeader: timestamp,
        signatureHeader: 'fake_invalid_hmac_signature_hex_code_1234567890abcdef',
        configuredSecret: TEST_WEBHOOK_SECRET,
      });
    },
    (err: any) => err.errorCode === 'INVALID_WEBHOOK_SIGNATURE'
  );

  // Secret token sai
  assert.throws(
    () => {
      verifyWebhookSecurity({
        rawBody,
        timestampHeader: timestamp,
        secretHeader: 'wrong_secret_token',
        configuredSecret: TEST_WEBHOOK_SECRET,
      });
    },
    (err: any) => err.errorCode === 'INVALID_WEBHOOK_SIGNATURE'
  );

  // Không có chữ ký lẫn secret
  assert.throws(
    () => {
      verifyWebhookSecurity({
        rawBody,
        timestampHeader: timestamp,
        configuredSecret: TEST_WEBHOOK_SECRET,
      });
    },
    (err: any) => err.errorCode === 'INVALID_WEBHOOK_SIGNATURE'
  );

  // Chữ ký đúng -> PASS
  const validSig = createHmacSignature(rawBody, timestamp, TEST_WEBHOOK_SECRET);
  assert.doesNotThrow(() => {
    verifyWebhookSecurity({
      rawBody,
      timestampHeader: timestamp,
      signatureHeader: validSig,
      configuredSecret: TEST_WEBHOOK_SECRET,
    });
  });
});

test('Chặng 16 - Gate 2: Replay Attack (lệch quá 5 phút) bị từ chối', () => {
  const payload = { formId: 'FORM_GEN_10', responseId: 'RESP_002', timestamp: Date.now(), answers: {} };
  const rawBody = JSON.stringify(payload);
  const nowMs = 1776500000000; // Mốc cố định

  // 1. Quá 5 phút trong quá khứ (6 phút trước = 360.000 ms)
  const oldTimestamp = (nowMs - 360000).toString();
  const sigOld = createHmacSignature(rawBody, oldTimestamp, TEST_WEBHOOK_SECRET);
  assert.throws(
    () => {
      verifyWebhookSecurity({
        rawBody,
        timestampHeader: oldTimestamp,
        signatureHeader: sigOld,
        configuredSecret: TEST_WEBHOOK_SECRET,
        serverNowMs: nowMs,
      });
    },
    (err: any) => err.errorCode === 'REPLAY_ATTACK_DETECTED'
  );

  // 2. Lệch quá 5 phút trong tương lai (6 phút tới)
  const futureTimestamp = (nowMs + 360000).toString();
  const sigFuture = createHmacSignature(rawBody, futureTimestamp, TEST_WEBHOOK_SECRET);
  assert.throws(
    () => {
      verifyWebhookSecurity({
        rawBody,
        timestampHeader: futureTimestamp,
        signatureHeader: sigFuture,
        configuredSecret: TEST_WEBHOOK_SECRET,
        serverNowMs: nowMs,
      });
    },
    (err: any) => err.errorCode === 'REPLAY_ATTACK_DETECTED'
  );

  // 3. Trong ngưỡng 4 phút -> Hợp lệ
  const validTimestamp = (nowMs - 240000).toString();
  const sigValid = createHmacSignature(rawBody, validTimestamp, TEST_WEBHOOK_SECRET);
  assert.doesNotThrow(() => {
    verifyWebhookSecurity({
      rawBody,
      timestampHeader: validTimestamp,
      signatureHeader: sigValid,
      configuredSecret: TEST_WEBHOOK_SECRET,
      serverNowMs: nowMs,
    });
  });
});

test('Chặng 16 - Gate 3: Duplicate và mất response vẫn giữ một hồ sơ duy nhất (Idempotency)', async () => {
  const db = new MockCashDbQueryable();
  const payload = {
    formId: 'FORM_GEN_10',
    responseId: 'RESP_UNIQUE_100',
    timestamp: new Date().toISOString(),
    answers: {
      'Họ và tên': 'Trần Văn Bình',
      'MSSV': '20231234',
      'Email': 'binh.tv@sis.hust.edu.vn',
      'Số điện thoại': '0912345678',
      'Nguyện vọng 1': 'Ban Hậu Cần',
      'Nguyện vọng 2': 'Ban Nội Dung',
      'Lý do tham gia': 'Yêu thích đọc sách và muốn gắn bó cùng CLB',
    },
  };

  // Lần 1: Nhận đơn mới
  const res1 = await ingestFormResponse(db, payload as any);
  assert.strictEqual(res1.isDuplicate, false);
  assert.strictEqual(res1.isUpdated, false);
  assert.strictEqual(res1.response.version, 1);
  assert.strictEqual(res1.response.aspiration1, 'BAN_HAU_CAN');
  assert.strictEqual(res1.response.aspiration2, 'BAN_NOI_DUNG');
  assert.strictEqual(db.recruitmentFormResponses.length, 1);

  // Lần 2: Webhook gửi lại cùng payload (Duplicate / Network retry)
  const res2 = await ingestFormResponse(db, payload as any);
  assert.strictEqual(res2.isDuplicate, true);
  assert.strictEqual(res2.isUpdated, false);
  assert.strictEqual(res2.response.version, 1);
  assert.strictEqual(db.recruitmentFormResponses.length, 1, 'Không được tạo thêm bản ghi trùng lặp');

  // Lần 3: Ứng viên đổi câu trả lời trên Google Form (ví dụ đổi nguyện vọng 2 sang TT&ĐN)
  const modifiedPayload = {
    ...payload,
    answers: {
      ...payload.answers,
      'Nguyện vọng 2': 'Ban Truyền Thông Đối Ngoại',
    },
  };
  const res3 = await ingestFormResponse(db, modifiedPayload as any);
  assert.strictEqual(res3.isDuplicate, false);
  assert.strictEqual(res3.isUpdated, true);
  assert.strictEqual(res3.response.version, 2, 'Phiên bản phải tăng lên v2');
  assert.strictEqual(res3.response.aspiration2, 'BAN_TTDN');
  assert.strictEqual(db.recruitmentFormResponses.length, 1, 'Vẫn giữ đúng 1 hồ sơ duy nhất');
});

test('Chặng 16 - Gate 4: Đối soát checkpoint phát hiện và bù đơn thiếu (Reconciliation Backfill)', async () => {
  const db = new MockCashDbQueryable();
  const formId = 'FORM_GEN_10';

  // Giả lập 3 đơn gửi trên Form
  const payload1 = {
    formId,
    responseId: 'RESP_SYNC_01',
    timestamp: new Date().toISOString(),
    answers: { 'Họ và tên': 'Ứng viên Một', 'Email': 'one@example.com', 'Nguyện vọng 1': 'Hậu Cần' },
  };
  const payload2 = {
    formId,
    responseId: 'RESP_SYNC_02',
    timestamp: new Date().toISOString(),
    answers: { 'Họ và tên': 'Ứng viên Hai', 'Email': 'two@example.com', 'Nguyện vọng 1': 'Nội Dung' },
  };
  const payload3 = {
    formId,
    responseId: 'RESP_SYNC_03',
    timestamp: new Date().toISOString(),
    answers: { 'Họ và tên': 'Ứng viên Ba (Rớt mạng)', 'Email': 'three@example.com', 'Nguyện vọng 1': 'TT&ĐN' },
  };

  // Đơn 1 và 2 đã gửi webhook thành công
  await ingestFormResponse(db, payload1 as any);
  await ingestFormResponse(db, payload2 as any);
  assert.strictEqual(db.recruitmentFormResponses.length, 2);

  // Đơn 3 bị rớt mạng nên chưa có trong DB YSBK
  // Khi chạy đối soát từ Google Sheets xuất về cả 3 đơn:
  const reconcileRes = await reconcileFormResponses(db, formId, [payload1, payload2, payload3] as any, 'admin-user');

  assert.strictEqual(reconcileRes.totalObserved, 3);
  assert.strictEqual(reconcileRes.syncedCount, 2);
  assert.strictEqual(reconcileRes.missingBackfilledCount, 1, 'Phải phát hiện và nạp bù đúng 1 đơn thiếu');
  assert.deepStrictEqual(reconcileRes.details?.missingResponseIds, ['RESP_SYNC_03']);

  // DB sau khi đối soát phải có đủ 3 đơn
  assert.strictEqual(db.recruitmentFormResponses.length, 3);
  assert.strictEqual(db.recruitmentReconciliationCheckpoints.length, 1);
});

test('Chặng 16 - Gate 5: Sync lại sau khi chấm không bao giờ mất điểm hoặc quyết định', async () => {
  const db = new MockCashDbQueryable();
  const payload = {
    formId: 'FORM_GEN_10',
    responseId: 'RESP_EVAL_TEST',
    timestamp: new Date().toISOString(),
    answers: { 'Họ và tên': 'Lê Hoàng Nam', 'Email': 'nam.lh@example.com', 'Nguyện vọng 1': 'Hậu Cần' },
  };

  // 1. Ingest đơn lần đầu
  const { response } = await ingestFormResponse(db, payload as any);

  // 2. Ban phỏng vấn chấm điểm và ghi nhận quyết định trên Web (recruitment_evaluations)
  db.recruitmentEvaluations.push({
    id: 'EVAL_001',
    response_id: response.id,
    evaluator_id: 'member-interviewer-01',
    evaluation_type: 'INDIVIDUAL',
    score_breakdown: { communication: 9, passion: 8.5, experience: 8 },
    total_score: 8.5,
    interview_notes: 'Ứng viên năng nổ, tác phong cẩn thận, phù hợp ban Hậu Cần.',
    status: 'COMPLETED',
    decision: 'PASSED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert.strictEqual(db.recruitmentEvaluations.length, 1);

  // 3. Webhook hoặc Reconcile gửi lại đơn (ví dụ cập nhật số điện thoại)
  const updatedPayload = {
    ...payload,
    answers: {
      ...payload.answers,
      'Số điện thoại': '0988776655',
    },
  };
  await ingestFormResponse(db, updatedPayload as any);

  // 4. Kiểm tra: Bảng recruitment_evaluations TUYỆT ĐỐI không bị xóa hoặc thay đổi!
  const evals = await db.query('SELECT * FROM recruitment_evaluations WHERE response_id = $1', [response.id]);
  assert.strictEqual(evals.rows.length, 1);
  assert.strictEqual(evals.rows[0].total_score, 8.5);
  assert.strictEqual(evals.rows[0].decision, 'PASSED');
  assert.strictEqual(evals.rows[0].interview_notes, 'Ứng viên năng nổ, tác phong cẩn thận, phù hợp ban Hậu Cần.');
});

test('Chặng 16 - Gate 6: Public summary view che giấu/lược bỏ PII', async () => {
  const db = new MockCashDbQueryable();
  await ingestFormResponse(db, {
    formId: 'FORM_GEN_10',
    responseId: 'RESP_PII_01',
    timestamp: '2026-10-15T09:00:00Z',
    answers: {
      'Họ và tên': 'Nguyễn Hoàng Long',
      'MSSV': '20235678',
      'Email': 'long.nh235678@sis.hust.edu.vn',
      'Số điện thoại': '0901234567',
      'Nguyện vọng 1': 'Ban Nội Dung',
    },
  } as any);

  const summary = await getPublicRecruitmentSummary(db, 'FORM_GEN_10');
  assert.strictEqual(summary.totalApplicants, 1);
  assert.strictEqual(summary.byAspiration1['BAN_NOI_DUNG'], 1);

  const pubItem = summary.publicList[0];
  // Kiểm tra PII đã được che
  assert.strictEqual(pubItem.maskedEmail, 'lo***8@sis.hust.edu.vn');
  assert.strictEqual(pubItem.maskedStudentId, '2023****');
  assert.strictEqual(pubItem.maskedName, 'Nguyễn H* L*');
  // Không chứa phone hoặc CV link
  assert.strictEqual((pubItem as any).applicantPhone, undefined);
  assert.strictEqual((pubItem as any).cvLink, undefined);

  // Test riêng hàm mask
  assert.strictEqual(maskEmail('test@gmail.com'), 'te***t@gmail.com');
  assert.strictEqual(maskPhone('0912345678'), '091****678');
  assert.strictEqual(maskStudentId('20241111'), '2024****');
  assert.strictEqual(maskFullName('Trần Bảo Anh'), 'Trần B* A*');
});

test('Chặng 16 - Gate 7: HTTP Role Barrier & Chặn Unauthorized Guest', async () => {
  const db = new MockCashDbQueryable();
  const fixtures = { queryable: db };

  // 1. Guest cố gọi GET /api/v1/recruitment/responses (Không có token) -> Bị chặn 401
  const reqGuest = new Request('http://localhost/api/v1/recruitment/responses', {
    method: 'GET',
  });
  const resGuest = await handleRequest(reqGuest, {} as any, fixtures);
  assert.strictEqual(resGuest.status, 401);

  // 2. Webhook gọi không có chữ ký -> Bị chặn 401
  const reqWebhookNoSig = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId: 'FORM_GEN_10', responseId: 'RESP_001' }),
  });
  const resWebhookNoSig = await handleRequest(reqWebhookNoSig, {} as any, fixtures);
  assert.strictEqual(resWebhookNoSig.status, 401);

  // 3. Webhook gửi đúng chữ ký và timestamp -> Thành công 201
  const payload = {
    formId: 'FORM_GEN_10',
    responseId: 'RESP_HTTP_SUCCESS',
    timestamp: Date.now(),
    answers: {
      'Họ và tên': 'Phạm Thị Mai',
      'Email': 'mai.pt@example.com',
      'Nguyện vọng 1': 'Ban Hậu Cần',
    },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = createHmacSignature(rawBody, timestamp, TEST_WEBHOOK_SECRET);

  const reqWebhookValid = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-YSBK-Signature': signature,
    },
    body: rawBody,
  });
  const resWebhookValid = await handleRequest(
    reqWebhookValid,
    { RECRUITMENT_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET } as any,
    fixtures
  );
  assert.strictEqual(resWebhookValid.status, 201);
  const data = await resWebhookValid.json();
  assert.strictEqual(data.data.applicantName, 'Phạm Thị Mai');
});

test('P22-01 Regression: Webhook unconfigured / empty secret fails closed and prevents DB mutation', async () => {
  const db = new MockCashDbQueryable();
  const fixtures = { queryable: db };
  const payload = {
    formId: 'FORM_GEN_10',
    responseId: 'RESP_UNCONFIGURED_PROBE',
    timestamp: Date.now(),
    answers: { 'Họ và tên': 'Attacker Name' },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = createHmacSignature(rawBody, timestamp, 'some_secret');

  // 1. Env không có RECRUITMENT_WEBHOOK_SECRET -> Bị chặn 401 WEBHOOK_SECRET_UNCONFIGURED
  const reqNoEnv = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-YSBK-Signature': signature,
    },
    body: rawBody,
  });
  const resNoEnv = await handleRequest(reqNoEnv, {} as any, fixtures);
  assert.strictEqual(resNoEnv.status, 401);
  const jsonNoEnv = await resNoEnv.json();
  assert.strictEqual(jsonNoEnv.error.code, 'WEBHOOK_SECRET_UNCONFIGURED');
  // Tuyệt đối không ghi bản ghi nào vào DB
  assert.strictEqual(db.recruitmentFormResponses.length, 0);

  // 2. Env có secret nhưng rỗng "" -> Bị chặn 401 WEBHOOK_SECRET_UNCONFIGURED
  const reqEmptyEnv = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-YSBK-Signature': signature,
    },
    body: rawBody,
  });
  const resEmptyEnv = await handleRequest(reqEmptyEnv, { RECRUITMENT_WEBHOOK_SECRET: '   ' } as any, fixtures);
  assert.strictEqual(resEmptyEnv.status, 401);
  const jsonEmpty = await resEmptyEnv.json();
  assert.strictEqual(jsonEmpty.error.code, 'WEBHOOK_SECRET_UNCONFIGURED');
  assert.strictEqual(db.recruitmentFormResponses.length, 0);

  // 3. Body bị thay đổi sau khi ký -> Bị chặn 401 INVALID_WEBHOOK_SIGNATURE
  const tamperedBody = JSON.stringify({ ...payload, answers: { 'Họ và tên': 'Tampered Name' } });
  const reqTampered = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-YSBK-Signature': signature, // Ký trên rawBody cũ
    },
    body: tamperedBody,
  });
  const resTampered = await handleRequest(
    reqTampered,
    { RECRUITMENT_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET } as any,
    fixtures
  );
  assert.strictEqual(resTampered.status, 401);
  assert.strictEqual(db.recruitmentFormResponses.length, 0);

  // 4. Timestamp không hợp lệ (NaN) -> 401 INVALID_TIMESTAMP
  const reqBadTimestamp = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': 'not-a-timestamp',
      'X-YSBK-Signature': signature,
    },
    body: rawBody,
  });
  const resBadTimestamp = await handleRequest(
    reqBadTimestamp,
    { RECRUITMENT_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET } as any,
    fixtures
  );
  assert.strictEqual(resBadTimestamp.status, 401);
  assert.strictEqual(db.recruitmentFormResponses.length, 0);

  // 5. Payload vượt quá 2MB -> 400 PAYLOAD_TOO_LARGE
  const bigBody = 'x'.repeat(2 * 1024 * 1024 + 10);
  const reqBig = new Request('http://localhost/api/v1/recruitment/webhook/google-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-YSBK-Signature': signature,
    },
    body: bigBody,
  });
  const resBig = await handleRequest(
    reqBig,
    { RECRUITMENT_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET } as any,
    fixtures
  );
  assert.strictEqual(resBig.status, 400);
  const jsonBig = await resBig.json();
  assert.strictEqual(jsonBig.error.code, 'PAYLOAD_TOO_LARGE');
  assert.strictEqual(db.recruitmentFormResponses.length, 0);
});
