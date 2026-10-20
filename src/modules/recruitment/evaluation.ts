import { BadRequestError, NotFoundError, ConflictError } from '../../server/errors.ts';
import type { Queryable } from '../../server/finance/types.ts';
import type {
  CreateRubricParams,
  EditEvaluationParams,
  RecruitmentEvaluationDto,
  RecruitmentEvaluationHistoryDto,
  RecruitmentRubricCriterionDto,
  RecruitmentRubricDto,
  SubmitEvaluationParams,
} from './evaluation-types.ts';

/**
 * Tạo Rubric theo Campaign và Version (R07)
 * Tự động tăng version nếu cùng campaignId. Rubric năm mới không thay đổi điểm hay cấu trúc cũ.
 */
export async function createRubric(
  db: Queryable,
  params: CreateRubricParams,
  _actorId?: string
): Promise<RecruitmentRubricDto> {
  if (!params.campaignId || !params.title || !Array.isArray(params.criteria) || params.criteria.length === 0) {
    throw new BadRequestError('Dữ liệu rubric không hợp lệ (cần campaignId, title, criteria).', 'INVALID_RUBRIC_DATA');
  }

  // 1. Xác định version tiếp theo của campaign
  const versionRes = await db.query<{ max_ver: number | null }>(
    'SELECT MAX(version) as max_ver FROM recruitment_rubrics WHERE campaign_id = $1',
    [params.campaignId]
  );
  const nextVersion = (versionRes.rows[0]?.max_ver || 0) + 1;
  const rubricId = params.id || `RUBRIC_${params.campaignId}_V${nextVersion}`;
  const formulaType = params.formulaType || 'UNSPECIFIED';

  // 2. Insert Rubric
  const rubricRes = await db.query(
    `INSERT INTO recruitment_rubrics (id, campaign_id, version, title, formula_type, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
     RETURNING *`,
    [rubricId, params.campaignId, nextVersion, params.title, formulaType]
  );
  const rawRubric = rubricRes.rows[0];

  // 3. Insert Criteria
  const criteriaList: RecruitmentRubricCriterionDto[] = [];
  for (let i = 0; i < params.criteria.length; i++) {
    const c = params.criteria[i];
    const critId = `CRIT_${rubricId}_${c.code}`;
    const minScore = c.minScore ?? 0;
    const maxScore = c.maxScore ?? 10;
    const weight = c.weight ?? 1.0;
    const sortOrder = c.sortOrder ?? i + 1;
    const section = c.section ?? 'INTERVIEW';

    await db.query(
      `INSERT INTO recruitment_rubric_criteria (id, rubric_id, code, name, description, section, min_score, max_score, weight, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [critId, rubricId, c.code, c.name, c.description || null, section, minScore, maxScore, weight, sortOrder]
    );

    criteriaList.push({
      id: critId,
      rubricId,
      code: c.code,
      name: c.name,
      description: c.description || null,
      section,
      minScore,
      maxScore,
      weight,
      sortOrder,
    });
  }

  return {
    id: rawRubric.id,
    campaignId: rawRubric.campaign_id,
    version: rawRubric.version,
    title: rawRubric.title,
    formulaType: rawRubric.formula_type,
    isActive: Boolean(rawRubric.is_active),
    criteria: criteriaList,
    createdAt: rawRubric.created_at,
    updatedAt: rawRubric.updated_at,
  };
}

/**
 * Lấy Rubric kèm danh sách tiêu chí
 */
export async function getRubricById(db: Queryable, rubricId: string): Promise<RecruitmentRubricDto> {
  const res = await db.query('SELECT * FROM recruitment_rubrics WHERE id = $1', [rubricId]);
  if (!res.rows || res.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy Rubric với ID '${rubricId}'.`, 'RUBRIC_NOT_FOUND');
  }
  const raw = res.rows[0];

  const critRes = await db.query<any>(
    'SELECT * FROM recruitment_rubric_criteria WHERE rubric_id = $1 ORDER BY sort_order ASC',
    [rubricId]
  );

  const criteria: RecruitmentRubricCriterionDto[] = critRes.rows.map((c) => ({
    id: c.id,
    rubricId: c.rubric_id,
    code: c.code,
    name: c.name,
    description: c.description,
    section: c.section,
    minScore: Number(c.min_score),
    maxScore: Number(c.max_score),
    weight: Number(c.weight),
    sortOrder: Number(c.sort_order),
  }));

  return {
    id: raw.id,
    campaignId: raw.campaign_id,
    version: Number(raw.version),
    title: raw.title,
    formulaType: raw.formula_type,
    isActive: Boolean(raw.is_active),
    criteria,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Tính điểm theo công thức rubric (R07)
 * QUY TẮC CỐT LÕI:
 * "thiếu công thức thì chưa tự tổng hợp, không tự chọn trung bình cộng."
 * Nếu rubric có formula_type = 'UNSPECIFIED', không tự ý tính tổng/trung bình, trả về totalScore: null.
 */
export function calculateEvaluationScore(
  rubric: RecruitmentRubricDto,
  rawScores: Record<string, number>
): { totalScore: number | null; formulaStatus: 'CALCULATED' | 'UNSPECIFIED_FORMULA' } {
  if (rubric.formulaType === 'UNSPECIFIED') {
    return {
      totalScore: null,
      formulaStatus: 'UNSPECIFIED_FORMULA',
    };
  }

  const criteria = rubric.criteria || [];
  if (criteria.length === 0) {
    return { totalScore: null, formulaStatus: 'UNSPECIFIED_FORMULA' };
  }

  if (rubric.formulaType === 'WEIGHTED_SUM') {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const crit of criteria) {
      const score = rawScores[crit.code] ?? 0;
      // Validate bounds
      if (score < crit.minScore || score > crit.maxScore) {
        throw new BadRequestError(
          `Điểm tiêu chí '${crit.name}' (${score}) vượt ngoài thang điểm [${crit.minScore}, ${crit.maxScore}].`,
          'SCORE_OUT_OF_BOUNDS'
        );
      }
      totalWeightedScore += score * crit.weight;
      totalWeight += crit.weight;
    }

    const calculated = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) / 100 : 0;
    return {
      totalScore: calculated,
      formulaStatus: 'CALCULATED',
    };
  }

  if (rubric.formulaType === 'AVERAGE_CRITERIA') {
    let sum = 0;
    let count = 0;

    for (const crit of criteria) {
      const score = rawScores[crit.code] ?? 0;
      if (score < crit.minScore || score > crit.maxScore) {
        throw new BadRequestError(
          `Điểm tiêu chí '${crit.name}' (${score}) vượt ngoài thang điểm [${crit.minScore}, ${crit.maxScore}].`,
          'SCORE_OUT_OF_BOUNDS'
        );
      }
      sum += score;
      count++;
    }

    const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
    return {
      totalScore: avg,
      formulaStatus: 'CALCULATED',
    };
  }

  return { totalScore: null, formulaStatus: 'UNSPECIFIED_FORMULA' };
}

/**
 * Ghi nhận đánh giá / chấm điểm độc lập (Chấm riêng trước, giữ nguồn người chấm)
 */
export async function submitEvaluation(
  db: Queryable,
  params: SubmitEvaluationParams,
  evaluatorId: string
): Promise<RecruitmentEvaluationDto> {
  // 1. Kiểm tra đơn ứng tuyển tồn tại
  const respCheck = await db.query('SELECT id FROM recruitment_form_responses WHERE id = $1', [params.responseId]);
  if (!respCheck.rows || respCheck.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy đơn ứng tuyển '${params.responseId}'.`, 'RESPONSE_NOT_FOUND');
  }

  // 2. Lấy Rubric
  const rubric = await getRubricById(db, params.rubricId);

  // 3. Tính điểm theo công thức
  const { totalScore, formulaStatus } = calculateEvaluationScore(rubric, params.rawScores);

  const evalId = params.id || `EVAL_${params.responseId}_${evaluatorId}_${Date.now()}`;
  const evalType = params.evaluationType || 'INDIVIDUAL';
  const status = params.status || 'COMPLETED';
  const decision = params.decision || 'PENDING';

  // 4. Insert evaluation
  const res = await db.query(
    `INSERT INTO recruitment_evaluations (
       id, response_id, evaluator_id, rubric_id, evaluation_type,
       raw_scores, total_score, formula_status, interview_notes,
       status, decision, version, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, NOW(), NOW())
     RETURNING *`,
    [
      evalId,
      params.responseId,
      evaluatorId,
      rubric.id,
      evalType,
      JSON.stringify(params.rawScores),
      totalScore,
      formulaStatus,
      params.interviewNotes || null,
      status,
      decision,
    ]
  );

  const raw = res.rows[0];
  return {
    id: raw.id,
    responseId: raw.response_id,
    evaluatorId: raw.evaluator_id,
    rubricId: raw.rubric_id,
    evaluationType: raw.evaluation_type,
    rawScores: typeof raw.raw_scores === 'string' ? JSON.parse(raw.raw_scores) : raw.raw_scores,
    totalScore: raw.total_score != null ? Number(raw.total_score) : null,
    formulaStatus: raw.formula_status,
    interviewNotes: raw.interview_notes,
    status: raw.status,
    decision: raw.decision,
    version: Number(raw.version || 1),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Chỉnh sửa điểm đánh giá có lý do, lưu audit history và phát hiện xung đột sửa (Concurrency Lock)
 */
export async function editEvaluation(
  db: Queryable,
  params: EditEvaluationParams,
  modifierId: string
): Promise<{ evaluation: RecruitmentEvaluationDto; history: RecruitmentEvaluationHistoryDto }> {
  // 1. Kiểm tra bắt buộc có lý do
  if (!params.reason || params.reason.trim().length === 0) {
    throw new BadRequestError('Bắt buộc phải nhập lý do khi sửa đổi điểm đánh giá.', 'REASON_REQUIRED');
  }

  // 2. Đọc bản ghi hiện tại
  const currentRes = await db.query('SELECT * FROM recruitment_evaluations WHERE id = $1', [params.evaluationId]);
  if (!currentRes.rows || currentRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy bản ghi đánh giá '${params.evaluationId}'.`, 'EVALUATION_NOT_FOUND');
  }
  const current = currentRes.rows[0];
  const currentVersion = Number(current.version || 1);

  // 3. Phát hiện xung đột phiên bản (Optimistic Concurrency Control)
  if (params.expectedVersion !== currentVersion) {
    throw new ConflictError(
      `Xung đột sửa đổi: Bản ghi đã được cập nhật bởi thành viên khác (phiên bản hiện tại là v${currentVersion}, phiên bản dự kiến là v${params.expectedVersion}).`,
      'CONCURRENT_MODIFICATION_DETECTED'
    );
  }

  // 4. Lấy Rubric để tính lại điểm nếu có cập nhật rawScores
  const rubricId = current.rubric_id;
  const newRawScores = params.rawScores || (typeof current.raw_scores === 'string' ? JSON.parse(current.raw_scores) : current.raw_scores);
  let totalScore = current.total_score != null ? Number(current.total_score) : null;
  let formulaStatus = current.formula_status;

  if (params.rawScores && rubricId) {
    const rubric = await getRubricById(db, rubricId);
    const calculated = calculateEvaluationScore(rubric, newRawScores);
    totalScore = calculated.totalScore;
    formulaStatus = calculated.formulaStatus;
  }

  const newNotes = params.interviewNotes !== undefined ? params.interviewNotes : current.interview_notes;
  const newDecision = params.decision !== undefined ? params.decision : current.decision;
  const nextVersion = currentVersion + 1;

  // 5. Lưu audit log vào recruitment_evaluation_history
  const previousState = {
    rawScores: typeof current.raw_scores === 'string' ? JSON.parse(current.raw_scores) : current.raw_scores,
    totalScore: current.total_score != null ? Number(current.total_score) : null,
    formulaStatus: current.formula_status,
    interviewNotes: current.interview_notes,
    decision: current.decision,
    version: currentVersion,
  };

  const newState = {
    rawScores: newRawScores,
    totalScore,
    formulaStatus,
    interviewNotes: newNotes,
    decision: newDecision,
    version: nextVersion,
  };

  const historyId = `HIST_${params.evaluationId}_V${nextVersion}_${Date.now()}`;
  await db.query(
    `INSERT INTO recruitment_evaluation_history (
       id, evaluation_id, modified_by, modified_at, reason,
       previous_state, new_state, previous_version, new_version, created_at
     )
     VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, NOW())`,
    [
      historyId,
      params.evaluationId,
      modifierId,
      params.reason.trim(),
      JSON.stringify(previousState),
      JSON.stringify(newState),
      currentVersion,
      nextVersion,
    ]
  );

  // 6. Cập nhật bản ghi chính
  const updateRes = await db.query(
    `UPDATE recruitment_evaluations
     SET raw_scores = $1,
         total_score = $2,
         formula_status = $3,
         interview_notes = $4,
         decision = $5,
         version = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      JSON.stringify(newRawScores),
      totalScore,
      formulaStatus,
      newNotes,
      newDecision,
      nextVersion,
      params.evaluationId,
    ]
  );

  const updatedRaw = updateRes.rows[0];
  const evalDto: RecruitmentEvaluationDto = {
    id: updatedRaw.id,
    responseId: updatedRaw.response_id,
    evaluatorId: updatedRaw.evaluator_id,
    rubricId: updatedRaw.rubric_id,
    evaluationType: updatedRaw.evaluation_type,
    rawScores: typeof updatedRaw.raw_scores === 'string' ? JSON.parse(updatedRaw.raw_scores) : updatedRaw.raw_scores,
    totalScore: updatedRaw.total_score != null ? Number(updatedRaw.total_score) : null,
    formulaStatus: updatedRaw.formula_status,
    interviewNotes: updatedRaw.interview_notes,
    status: updatedRaw.status,
    decision: updatedRaw.decision,
    version: Number(updatedRaw.version),
    createdAt: updatedRaw.created_at,
    updatedAt: updatedRaw.updated_at,
  };

  const histDto: RecruitmentEvaluationHistoryDto = {
    id: historyId,
    evaluationId: params.evaluationId,
    modifiedBy: modifierId,
    modifiedAt: new Date().toISOString(),
    reason: params.reason.trim(),
    previousState,
    newState,
    previousVersion: currentVersion,
    newVersion: nextVersion,
  };

  return { evaluation: evalDto, history: histDto };
}

/**
 * Lấy danh sách toàn bộ các đánh giá phỏng vấn của một ứng viên (Chấm riêng + Hội đồng)
 */
export async function getEvaluationsByResponseId(
  db: Queryable,
  responseId: string
): Promise<RecruitmentEvaluationDto[]> {
  const res = await db.query<any>(
    'SELECT * FROM recruitment_evaluations WHERE response_id = $1 ORDER BY created_at ASC',
    [responseId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    responseId: r.response_id,
    evaluatorId: r.evaluator_id,
    rubricId: r.rubric_id,
    evaluationType: r.evaluation_type,
    rawScores: typeof r.raw_scores === 'string' ? JSON.parse(r.raw_scores) : r.raw_scores,
    totalScore: r.total_score != null ? Number(r.total_score) : null,
    formulaStatus: r.formula_status,
    interviewNotes: r.interview_notes,
    status: r.status,
    decision: r.decision,
    version: Number(r.version || 1),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Lấy lịch sử sửa đổi của một bản ghi đánh giá
 */
export async function getEvaluationHistory(
  db: Queryable,
  evaluationId: string
): Promise<RecruitmentEvaluationHistoryDto[]> {
  const res = await db.query<any>(
    'SELECT * FROM recruitment_evaluation_history WHERE evaluation_id = $1 ORDER BY previous_version ASC',
    [evaluationId]
  );

  return res.rows.map((h) => ({
    id: h.id,
    evaluationId: h.evaluation_id,
    modifiedBy: h.modified_by,
    modifiedAt: h.modified_at,
    reason: h.reason,
    previousState: typeof h.previous_state === 'string' ? JSON.parse(h.previous_state) : h.previous_state,
    newState: typeof h.new_state === 'string' ? JSON.parse(h.new_state) : h.new_state,
    previousVersion: Number(h.previous_version),
    newVersion: Number(h.new_version),
  }));
}
