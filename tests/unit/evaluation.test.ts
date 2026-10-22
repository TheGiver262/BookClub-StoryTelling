import test from 'node:test';
import assert from 'node:assert';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  createRubric,
  getRubricById,
  calculateEvaluationScore,
  submitEvaluation,
  editEvaluation,
  getEvaluationsByResponseId,
  getEvaluationHistory,
} from '../../src/modules/recruitment/evaluation.ts';
import {
  finalizeDecision,
  convertPassedApplicantToMember,
  approvePublicAnnouncement,
  getPublicApprovedResults,
} from '../../src/modules/recruitment/decisions.ts';
import { ingestFormResponse } from '../../src/modules/recruitment/ingest-form.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

const JWT_SECRET = 'test_jwt_secret_32_characters_long_min!';

// Helper khởi tạo môi trường DB test
function createTestContext() {
  const db = new MockCashDbQueryable();
  // Khởi tạo form và ứng viên mẫu
  db.recruitmentForms.push({
    id: 'FORM_GEN_10',
    title: 'Đơn Tuyển Thành Viên Gen 10',
    term_semester: '2026.1',
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.recruitmentFormResponses.push({
    id: 'RESP_001',
    form_id: 'FORM_GEN_10',
    response_id: 'GOOGLE_RESP_001',
    submission_timestamp: new Date().toISOString(),
    applicant_name: 'Nguyễn Văn An',
    applicant_student_id: '20231234',
    applicant_email: 'an.nv231234@sis.hust.edu.vn',
    applicant_phone: '0912345678',
    aspiration_1: 'BAN_HAU_CAN',
    aspiration_2: 'BAN_NOI_DUNG',
    why_join: 'Yêu thích sách và các hoạt động cộng đồng',
    essay_content: 'Cuốn sách Thay Đổi Cuộc Đời Tôi...',
    cv_link: 'https://drive.google.com/cv-an.pdf',
    raw_answers: {},
    sync_status: 'SYNCED',
    last_observed_at: new Date().toISOString(),
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return db;
}

test('Gate 1: Rubric versioning & Công thức tổng hợp (R07)', async () => {
  const db = createTestContext();

  // 1. Tạo Rubric Gen 10 version 1 với công thức WEIGHTED_SUM
  const rubricGen10 = await createRubric(
    db,
    {
      campaignId: 'CAMPAIGN_GEN_10',
      title: 'Rubric Tuyển Thành Viên Gen 10',
      formulaType: 'WEIGHTED_SUM',
      criteria: [
        { code: 'ATTITUDE', name: 'Thái độ', minScore: 0, maxScore: 10, weight: 2.0, section: 'INTERVIEW' },
        { code: 'EXPERIENCE', name: 'Kỹ năng', minScore: 0, maxScore: 10, weight: 1.0, section: 'INTERVIEW' },
      ],
    },
    'admin-1'
  );

  assert.strictEqual(rubricGen10.version, 1);
  assert.strictEqual(rubricGen10.formulaType, 'WEIGHTED_SUM');
  assert.strictEqual(rubricGen10.criteria?.length, 2);

  // 2. Chấm điểm theo rubric Gen 10: Thái độ 8 (w=2), Kỹ năng 5 (w=1) -> (8*2 + 5*1)/3 = 21/3 = 7.0
  const scoreResult1 = calculateEvaluationScore(rubricGen10, { ATTITUDE: 8, EXPERIENCE: 5 });
  assert.strictEqual(scoreResult1.formulaStatus, 'CALCULATED');
  assert.strictEqual(scoreResult1.totalScore, 7);

  // 3. Tạo Rubric cho năm sau (Gen 11) hoặc version 2 với tiêu chí khác
  const rubricGen11 = await createRubric(
    db,
    {
      campaignId: 'CAMPAIGN_GEN_11',
      title: 'Rubric Tuyển Thành Viên Gen 11',
      formulaType: 'UNSPECIFIED', // Chưa xác định công thức
      criteria: [
        { code: 'TEAMWORK', name: 'Làm việc nhóm', minScore: 0, maxScore: 10, weight: 1.0, section: 'INTERVIEW' },
      ],
    },
    'admin-1'
  );

  // Rubric Gen 10 cũ không bị thay đổi
  const rubricGen10Reload = await getRubricById(db, rubricGen10.id);
  assert.strictEqual(rubricGen10Reload.criteria?.length, 2);

  // 4. Kiểm tra quy tắc R07: "thiếu công thức thì chưa tự tổng hợp, không tự chọn trung bình cộng"
  const scoreResultUnspecified = calculateEvaluationScore(rubricGen11, { TEAMWORK: 9 });
  assert.strictEqual(scoreResultUnspecified.totalScore, null, 'Không được tự ý tính trung bình khi formula_type là UNSPECIFIED');
  assert.strictEqual(scoreResultUnspecified.formulaStatus, 'UNSPECIFIED_FORMULA');
});

test('Gate 2: Hai người chấm độc lập không mất nguồn (chấm riêng độc lập)', async () => {
  const db = createTestContext();

  const rubric = await createRubric(
    db,
    {
      campaignId: 'CAMPAIGN_GEN_10',
      title: 'Rubric Gen 10',
      formulaType: 'WEIGHTED_SUM',
      criteria: [
        { code: 'ATTITUDE', name: 'Thái độ', minScore: 0, maxScore: 10, weight: 1.0, section: 'INTERVIEW' },
      ],
    },
    'admin-1'
  );

  // Người chấm A (interviewer_A) chấm
  await submitEvaluation(
    db,
    {
      responseId: 'RESP_001',
      rubricId: rubric.id,
      rawScores: { ATTITUDE: 9 },
      interviewNotes: 'Rất nhiệt huyết, giao tiếp lưu loát.',
      decision: 'PASSED',
    },
    'interviewer_A'
  );

  // Người chấm B (interviewer_B) chấm độc lập cho cùng ứng viên
  await submitEvaluation(
    db,
    {
      responseId: 'RESP_001',
      rubricId: rubric.id,
      rawScores: { ATTITUDE: 6 },
      interviewNotes: 'Cần quan sát thêm về khả năng sắp xếp thời gian.',
      decision: 'RESERVE',
    },
    'interviewer_B'
  );

  // Cả 2 phiếu chấm đều tồn tại độc lập, không ghi đè nguồn của nhau
  const allEvals = await getEvaluationsByResponseId(db, 'RESP_001');
  assert.strictEqual(allEvals.length, 2, 'Cả hai người chấm độc lập phải có phiếu riêng');

  const foundA = allEvals.find((e) => e.evaluatorId === 'interviewer_A');
  const foundB = allEvals.find((e) => e.evaluatorId === 'interviewer_B');
  assert.ok(foundA);
  assert.ok(foundB);
  assert.strictEqual(foundA.rawScores.ATTITUDE, 9);
  assert.strictEqual(foundB.rawScores.ATTITUDE, 6);
  assert.strictEqual(foundA.interviewNotes, 'Rất nhiệt huyết, giao tiếp lưu loát.');
  assert.strictEqual(foundB.interviewNotes, 'Cần quan sát thêm về khả năng sắp xếp thời gian.');
});

test('Gate 3: Sửa điểm có trước, sau, người, giờ, lý do và phát hiện xung đột version (Optimistic Lock)', async () => {
  const db = createTestContext();

  const rubric = await createRubric(
    db,
    {
      campaignId: 'CAMPAIGN_GEN_10',
      title: 'Rubric Gen 10',
      formulaType: 'WEIGHTED_SUM',
      criteria: [
        { code: 'ATTITUDE', name: 'Thái độ', minScore: 0, maxScore: 10, weight: 1.0, section: 'INTERVIEW' },
      ],
    },
    'admin-1'
  );

  const initialEval = await submitEvaluation(
    db,
    {
      responseId: 'RESP_001',
      rubricId: rubric.id,
      rawScores: { ATTITUDE: 7 },
      interviewNotes: 'Ban đầu chấm 7 điểm',
    },
    'interviewer_A'
  );

  // 1. Thử sửa mà không có lý do -> Bị từ chối
  await assert.rejects(
    editEvaluation(
      db,
      {
        evaluationId: initialEval.id,
        rawScores: { ATTITUDE: 8 },
        reason: '   ', // Lý do trống
        expectedVersion: 1,
      },
      'interviewer_A'
    ),
    (err: any) => err.errorCode === 'REASON_REQUIRED' || /lý do/i.test(err.message)
  );

  // 2. Sửa điểm hợp lệ kèm lý do
  const editResult = await editEvaluation(
    db,
    {
      evaluationId: initialEval.id,
      rawScores: { ATTITUDE: 9 },
      interviewNotes: 'Xem lại phần trả lời bài viết nên cộng thêm điểm thái độ',
      reason: 'Hội ý lại sau khi đọc bài cảm nhận sách của ứng viên',
      expectedVersion: 1,
    },
    'lead_evaluator'
  );

  assert.strictEqual(editResult.evaluation.version, 2, 'Phiên bản phải tăng lên v2');
  assert.strictEqual(editResult.evaluation.rawScores.ATTITUDE, 9);
  assert.strictEqual(editResult.history.modifiedBy, 'lead_evaluator');
  assert.strictEqual(editResult.history.reason, 'Hội ý lại sau khi đọc bài cảm nhận sách của ứng viên');
  assert.strictEqual(editResult.history.previousVersion, 1);
  assert.strictEqual(editResult.history.newVersion, 2);

  // 3. Phát hiện xung đột phiên bản: Cố sửa lại dựa trên version 1 cũ -> Bị từ chối 409 Conflict
  await assert.rejects(
    editEvaluation(
      db,
      {
        evaluationId: initialEval.id,
        rawScores: { ATTITUDE: 10 },
        reason: 'Sửa lần hai',
        expectedVersion: 1, // Lỗi: DB hiện đang là v2
      },
      'interviewer_B'
    ),
    (err: any) => err.errorCode === 'CONCURRENT_MODIFICATION_DETECTED' || /xung đột/i.test(err.message)
  );

  // 4. Kiểm tra lịch sử audit lưu trong database
  const history = await getEvaluationHistory(db, initialEval.id);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].previousVersion, 1);
  assert.strictEqual(history[0].newVersion, 2);
});

test('Gate 4: Sync giữ evaluation (nhận form mới hoặc reconcile không làm mất điểm)', async () => {
  const db = createTestContext();

  const rubric = await createRubric(
    db,
    {
      campaignId: 'CAMPAIGN_GEN_10',
      title: 'Rubric Gen 10',
      criteria: [{ code: 'SKILL', name: 'Kỹ năng', weight: 1.0, section: 'INTERVIEW' }],
    },
    'admin-1'
  );

  // Đã chấm điểm cho RESP_001
  await submitEvaluation(
    db,
    {
      responseId: 'RESP_001',
      rubricId: rubric.id,
      rawScores: { SKILL: 8.5 },
      interviewNotes: 'Điểm phỏng vấn quý giá không được phép bị mất khi sync lại',
    },
    'interviewer_A'
  );

  // Webhook gửi bản cập nhật mới (ứng viên sửa form)
  await ingestFormResponse(db, {
    formId: 'FORM_GEN_10',
    responseId: 'GOOGLE_RESP_001',
    timestamp: new Date().toISOString(),
    answers: {
      'Họ và tên': 'Nguyễn Văn An (Đã Cập Nhật SĐT)',
      'Email': 'an.nv231234@sis.hust.edu.vn',
      'Số điện thoại': '0988888888',
    },
    applicantName: 'Nguyễn Văn An (Đã Cập Nhật SĐT)',
    applicantEmail: 'an.nv231234@sis.hust.edu.vn',
    applicantPhone: '0988888888',
  });

  // Kiểm tra bảng recruitment_evaluations: Điểm chấm vẫn nguyên vẹn 100%
  const evals = await getEvaluationsByResponseId(db, 'RESP_001');
  assert.strictEqual(evals.length, 1);
  assert.strictEqual(evals[0].rawScores.SKILL, 8.5);
  assert.strictEqual(evals[0].interviewNotes, 'Điểm phỏng vấn quý giá không được phép bị mất khi sync lại');
});

test('Gate 5: Convert retry không tạo hai member (Idempotent Conversion)', async () => {
  const db = createTestContext();

  // 1. Hội đồng ban hành quyết định trúng tuyển, phân ban khác nguyện vọng
  // Nguyện vọng 1 là BAN_HAU_CAN, nhưng Hội đồng xếp vào BAN_TTDN
  const decision = await finalizeDecision(
    db,
    {
      responseId: 'RESP_001',
      decision: 'PASSED',
      assignedDepartment: 'BAN_TTDN',
      committeeNotes: 'Thấy ứng viên có năng khiếu viết bài nên xếp vào Ban TT & ĐN.',
    },
    'president-1'
  );

  assert.strictEqual(decision.decision, 'PASSED');
  assert.strictEqual(decision.assignedDepartment, 'BAN_TTDN');
  assert.strictEqual(decision.isConvertedToMember, false);

  // 2. Chuyển ứng viên trúng tuyển sang thành viên CLB lần 1
  const convertResult1 = await convertPassedApplicantToMember(db, 'RESP_001', 'admin-1');
  assert.strictEqual(convertResult1.isAlreadyConverted, false);
  assert.ok(convertResult1.member.id);
  assert.match(convertResult1.member.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Member ID phải là UUID chuẩn (P22-08)');
  assert.strictEqual(convertResult1.member.team, 'TRUYEN_THONG_DOI_NGOAI', 'Map đúng canonical team enum');
  assert.strictEqual(convertResult1.member.isEligibleMainDuty, false, 'Người mới chưa đủ điều kiện trực chính (D31)');
  assert.strictEqual(convertResult1.member.hasPaidFee, false, 'Chưa thu hội phí (D37)');
  assert.strictEqual(convertResult1.decision.isConvertedToMember, true);

  const initialMemberCount = db.members.length;

  // 3. Retry gọi lại lần 2 (Mạng chập chờn hoặc người dùng bấm đúp)
  const convertResult2 = await convertPassedApplicantToMember(db, 'RESP_001', 'admin-1');
  assert.strictEqual(convertResult2.isAlreadyConverted, true, 'Phải báo là đã chuyển đổi trước đó');
  assert.strictEqual(convertResult2.member.id, convertResult1.member.id, 'Phải trả về cùng một memberId');
  assert.strictEqual(db.members.length, initialMemberCount, 'Tuyệt đối không được tạo ra hai member');
});

test('Gate 6: RBAC: Guest/Alumni không đọc điểm (403), Public results chỉ trả về các trường được duyệt', async () => {
  const db = createTestContext();

  // 1. Phê duyệt một kết quả tuyển sinh ra công chúng
  await approvePublicAnnouncement(
    db,
    {
      campaignId: 'CAMPAIGN_GEN_10',
      responseId: 'RESP_001',
      candidateCode: 'YSBK-CAND-0892',
      passedDepartment: 'BAN_TTDN',
    },
    'admin-1'
  );

  // 2. Khách công khai tra cứu kết quả
  const publicResults = await getPublicApprovedResults(db, 'CAMPAIGN_GEN_10');
  assert.strictEqual(publicResults.length, 1);
  assert.strictEqual(publicResults[0].candidateCode, 'YSBK-CAND-0892');
  assert.strictEqual(publicResults[0].passedDepartment, 'BAN_TTDN');

  // Đảm bảo không lộ raw candidate PII (MSSV, real name, email, phone)
  const jsonString = JSON.stringify(publicResults);
  assert.ok(!jsonString.includes('20231234'), 'Không được lộ MSSV trong kết quả public');
  assert.ok(!jsonString.includes('Nguyễn Văn An'), 'Không được lộ họ tên thật trong kết quả public');
  assert.ok(!jsonString.includes('0912345678'), 'Không được lộ SĐT trong kết quả public');

  // 3. RBAC qua Router: Guest có token JWT hợp lệ nhưng bị chặn 403 khi gọi endpoint đọc điểm
  const guestActor: AuthenticatedActor = {
    userId: 'usr_guest',
    email: 'reader@gmail.com',
    role: 'GUEST',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const guestToken = await signSessionToken(guestActor, JWT_SECRET, 3600);

  const guestRequest = new Request('http://localhost/api/v1/recruitment/responses/RESP_001/evaluations', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${guestToken}` },
  });

  const guestResponse = await handleRequest(guestRequest, { JWT_SECRET } as any, {
    queryable: db,
  });

  assert.strictEqual(guestResponse.status, 403, 'Guest phải bị chặn 403 không được đọc bảng điểm');
  const guestBody = await guestResponse.json();
  assert.strictEqual(guestBody.error.code, 'GUEST_ACCESS_DENIED');

  // 4. RBAC qua Router: Alumni có token JWT hợp lệ cũng bị chặn 403 không được đọc/sửa bảng điểm
  const alumniActor: AuthenticatedActor = {
    userId: 'usr_alumni',
    memberId: 'mem_005',
    username: 'thang.cuu',
    role: 'ALUMNI',
    team: 'BAN_HAU_CAN',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };
  const alumniToken = await signSessionToken(alumniActor, JWT_SECRET, 3600);

  const alumniRequest = new Request('http://localhost/api/v1/recruitment/responses/RESP_001/evaluations', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${alumniToken}` },
  });

  const alumniResponse = await handleRequest(alumniRequest, { JWT_SECRET } as any, {
    queryable: db,
    membersDb: {
      'mem_005': {
        id: 'mem_005',
        is_active: true,
        is_alumni: true,
        is_admin: false,
        token_version: 1,
      },
    },
  });

  assert.strictEqual(alumniResponse.status, 403, 'Alumni phải bị chặn 403 không được đọc điểm');
  const alumniBody = await alumniResponse.json();
  assert.strictEqual(alumniBody.error.code, 'ACCOUNT_DISABLED');
});
