import * as crypto from 'node:crypto';
import { BadRequestError, NotFoundError, ConflictError } from '../../server/errors.ts';
import type { Queryable } from '../../server/finance/types.ts';
import type {
  FinalizeDecisionParams,
  PublicApprovedResultDto,
  RecruitmentDecisionDto,
} from './evaluation-types.ts';
import type { MemberDto } from '../../server/types.ts';

/**
 * Tổng kết Hội đồng và ban hành Quyết định tuyển dụng (Chặng 17)
 * Phân ban tuyển dụng có thể khác với nguyện vọng ban đầu của ứng viên.
 */
export async function finalizeDecision(
  db: Queryable,
  params: FinalizeDecisionParams,
  actorId: string
): Promise<RecruitmentDecisionDto> {
  // 1. Kiểm tra đơn ứng tuyển tồn tại
  const respCheck = await db.query('SELECT * FROM recruitment_form_responses WHERE id = $1', [params.responseId]);
  if (!respCheck.rows || respCheck.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy đơn ứng tuyển '${params.responseId}'.`, 'RESPONSE_NOT_FOUND');
  }

  const decId = `DEC_${params.responseId}`;

  // 2. Kiểm tra xem đã có quyết định chưa
  const existing = await db.query('SELECT * FROM recruitment_decisions WHERE response_id = $1', [params.responseId]);

  let res;
  if (existing.rows && existing.rows.length > 0) {
    // Cập nhật quyết định
    res = await db.query(
      `UPDATE recruitment_decisions
       SET decision = $1,
           assigned_department = $2,
           committee_notes = $3,
           decided_by = $4,
           decided_at = NOW()
       WHERE response_id = $5
       RETURNING *`,
      [params.decision, params.assignedDepartment, params.committeeNotes || null, actorId, params.responseId]
    );
  } else {
    // Tạo mới quyết định
    res = await db.query(
      `INSERT INTO recruitment_decisions (
         id, response_id, decision, assigned_department, committee_notes,
         decided_by, decided_at, is_converted_to_member, converted_member_id, converted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), FALSE, NULL, NULL)
       RETURNING *`,
      [decId, params.responseId, params.decision, params.assignedDepartment, params.committeeNotes || null, actorId]
    );
  }

  const raw = res.rows[0];
  return {
    id: raw.id,
    responseId: raw.response_id,
    decision: raw.decision,
    assignedDepartment: raw.assigned_department,
    committeeNotes: raw.committee_notes,
    decidedBy: raw.decided_by,
    decidedAt: raw.decided_at,
    isConvertedToMember: Boolean(raw.is_converted_to_member),
    convertedMemberId: raw.converted_member_id,
    convertedAt: raw.converted_at,
  };
}

/**
 * Chuyển ứng viên trúng tuyển sang thành viên CLB (Chuyển đúng 1 lần - Idempotent Conversion)
 * Retry không tạo ra 2 member!
 */
export async function convertPassedApplicantToMember(
  db: Queryable,
  responseId: string,
  _actorId?: string,
  inputData?: {
    phone?: string;
    gen?: string;
    schoolYear?: string;
    termYear?: string;
    username?: string;
  }
): Promise<{ decision: RecruitmentDecisionDto; member: MemberDto; isAlreadyConverted: boolean }> {
  // 1. Kiểm tra và khóa quyết định tuyển dụng ngay đầu transaction (RF-07)
  const decRes = await db.query(
    'SELECT * FROM recruitment_decisions WHERE response_id = $1 FOR UPDATE',
    [responseId]
  );
  if (!decRes.rows || decRes.rows.length === 0) {
    throw new NotFoundError('Chưa có quyết định tuyển dụng cho ứng viên này.', 'DECISION_NOT_FOUND');
  }
  const decision = decRes.rows[0];

  if (decision.decision !== 'PASSED') {
    throw new BadRequestError(
      `Chỉ ứng viên trúng tuyển ('PASSED') mới được chuyển thành viên (trạng thái hiện tại: '${decision.decision}').`,
      'APPLICANT_NOT_PASSED'
    );
  }

  // 2. Rào chắn Idempotency: Nếu đã chuyển đổi trước đó, trả về ngay kết quả cũ (Không tạo hai member)
  if (decision.is_converted_to_member && decision.converted_member_id) {
    const existingMemberRes = await db.query('SELECT * FROM members WHERE id = $1', [decision.converted_member_id]);
    if (existingMemberRes.rows && existingMemberRes.rows.length > 0) {
      const m = existingMemberRes.rows[0];
      return {
        decision: {
          id: decision.id,
          responseId: decision.response_id,
          decision: decision.decision,
          assignedDepartment: decision.assigned_department,
          committeeNotes: decision.committee_notes,
          decidedBy: decision.decided_by,
          decidedAt: decision.decided_at,
          isConvertedToMember: true,
          convertedMemberId: decision.converted_member_id,
          convertedAt: decision.converted_at,
        },
        member: {
          id: m.id,
          fullName: m.full_name,
          username: m.username,
          team: m.team,
          roleTitle: m.role_title,
          schoolYear: m.school_year,
          phone: m.phone,
          isEligibleMainDuty: Boolean(m.is_eligible_main_duty),
          hasPaidFee: Boolean(m.has_paid_fee),
          isAlumni: Boolean(m.is_alumni),
          isAdmin: Boolean(m.is_admin),
          isActive: Boolean(m.is_active),
          createdAt: m.created_at,
        },
        isAlreadyConverted: true,
      };
    }
  }

  // 3. Lấy thông tin ứng viên từ đơn cùng thông tin biểu mẫu/đợt tuyển
  const respRes = await db.query(
    `SELECT r.*, f.title as form_title, f.term_semester
     FROM recruitment_form_responses r
     LEFT JOIN recruitment_forms f ON f.id = r.form_id
     WHERE r.id = $1`,
    [responseId]
  );
  if (!respRes.rows || respRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy thông tin đơn ứng tuyển gốc.', 'RESPONSE_NOT_FOUND');
  }
  const applicant = respRes.rows[0];

  // 4. Kiểm tra hợp lệ dữ liệu bắt buộc (KHÔNG BỊA SỐ ĐIỆN THOẠI HAY KHÓA HỌC GIẢ - RF-07)
  const fullName = (applicant.applicant_name || '').trim();
  if (!fullName) {
    throw new BadRequestError('Thiếu họ tên ứng viên hợp lệ trong hồ sơ.', 'MISSING_APPLICANT_NAME');
  }

  const phone = (inputData?.phone || applicant.applicant_phone || '').trim();
  if (!phone) {
    throw new BadRequestError(
      'Ứng viên thiếu số điện thoại liên hệ hợp lệ, không thể chuyển thành viên.',
      'MISSING_APPLICANT_PHONE'
    );
  }

  const studentId = (applicant.applicant_student_id || '').trim();
  let schoolYear = (inputData?.schoolYear || '').trim();
  if (!schoolYear && studentId && studentId.length >= 4) {
    const yr = parseInt(studentId.substring(0, 4), 10);
    if (!isNaN(yr) && yr >= 1956 && yr <= 2099) {
      schoolYear = `K${yr - 1955}`;
    }
  }
  if (!schoolYear && applicant.school_year) {
    schoolYear = applicant.school_year.trim();
  }
  if (!schoolYear && applicant.id) {
    const m = applicant.id.match(/K([0-9]+)/i);
    if (m) schoolYear = `K${m[1]}`;
  }
  if (!schoolYear) {
    throw new BadRequestError(
      'Thiếu thông tin khóa/năm học (schoolYear) của ứng viên. Vui lòng bổ sung trước khi chuyển.',
      'MISSING_SCHOOL_YEAR'
    );
  }

  let gen = (inputData?.gen || applicant.gen || applicant.campaign_gen || '').trim();
  if (!gen && applicant.form_title) {
    const m = applicant.form_title.match(/(?:Gen|GEN)\s*([0-9]+)/i);
    if (m) gen = `Gen ${m[1]}`;
  }
  if (!gen && applicant.form_id) {
    const m = applicant.form_id.match(/(?:Gen|GEN)[-_]?([0-9]+)/i);
    if (m) gen = `Gen ${m[1]}`;
  }
  if (!gen && applicant.id) {
    const m = applicant.id.match(/(?:Gen|GEN)[-_]?([0-9]+)/i);
    if (m) gen = `Gen ${m[1]}`;
  }
  if (!gen && schoolYear) {
    const kMatch = schoolYear.match(/K([0-9]+)/i);
    if (kMatch) {
      const kNum = parseInt(kMatch[1], 10);
      if (kNum >= 59) {
        gen = `Gen ${kNum - 58}`;
      }
    }
  }
  if (!gen) {
    throw new BadRequestError(
      'Thiếu thông tin Gen của đợt tuyển/ứng viên. Vui lòng bổ sung trước khi chuyển.',
      'MISSING_APPLICANT_GEN'
    );
  }

  let termYear = (inputData?.termYear || applicant.term_year || applicant.campaign_term_year || '').trim();
  if (!termYear && applicant.term_semester) {
    const sem = applicant.term_semester.trim();
    const m = sem.match(/^([0-9]{4})/);
    if (m) {
      const startYr = parseInt(m[1], 10);
      termYear = `${startYr}-${startYr + 1}`;
    }
  }
  if (!termYear && applicant.form_id) {
    const m = applicant.form_id.match(/([0-9]{4})/);
    if (m) {
      const startYr = parseInt(m[1], 10);
      termYear = `${startYr}-${startYr + 1}`;
    }
  }
  if (!termYear) {
    const currentYear = new Date().getFullYear();
    termYear = `${currentYear}-${currentYear + 1}`;
  }

  // 5. Sinh username nội bộ chuẩn hóa & kiểm tra xung đột danh tính (RF-07)
  const studentIdClean = studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nameClean = fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  let username = (inputData?.username || (studentIdClean ? studentIdClean : nameClean)).trim().toLowerCase();
  if (!username) {
    username = `cand_${responseId.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
  }

  // Kiểm tra xem username đã tồn tại chưa
  const checkMember = await db.query(
    'SELECT id, full_name, username, phone FROM members WHERE username = $1',
    [username]
  );
  let finalMemberId: string;
  let memberRecord: any;

  if (checkMember.rows && checkMember.rows.length > 0) {
    const existing = checkMember.rows[0];
    // Kiểm tra liên kết danh tính đã được xác minh (cùng số điện thoại và cùng họ tên)
    const existingNormName = existing.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    const currentNormName = fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    const isVerifiedSamePerson = existing.phone === phone && existingNormName === currentNormName;

    if (!isVerifiedSamePerson) {
      throw new ConflictError(
        `Username hoặc MSSV '${username}' đã tồn tại trên hệ thống thuộc về thành viên khác ('${existing.full_name}'). Không thể tự ý gắn ứng viên mới với thành viên cũ (xung đột danh tính).`,
        'USERNAME_COLLISION'
      );
    }

    finalMemberId = existing.id;
    memberRecord = existing;
  } else {
    // 6. Thêm mới bản ghi vào bảng members với UUID canonical
    finalMemberId = crypto.randomUUID();

    // Map assigned_department sang canonical member_team enum
    const rawDept = (decision.assigned_department || '').trim().toUpperCase();
    let team: 'HAU_CAN' | 'NOI_DUNG' | 'TRUYEN_THONG_DOI_NGOAI' | 'BAN_CHU_NHIEM' = 'HAU_CAN';
    if (rawDept.includes('HAU_CAN')) team = 'HAU_CAN';
    else if (rawDept.includes('NOI_DUNG')) team = 'NOI_DUNG';
    else if (rawDept.includes('TTDN') || rawDept.includes('TRUYEN_THONG') || rawDept.includes('DOI_NGOAI')) team = 'TRUYEN_THONG_DOI_NGOAI';
    else if (rawDept.includes('CHU_NHIEM') || rawDept.includes('BCN')) team = 'BAN_CHU_NHIEM';

    const insertMemRes = await db.query(
      `INSERT INTO members (
         id, full_name, username, gen, team, role_title, school_year,
         phone, is_eligible_main_duty, has_paid_fee, is_alumni, is_admin, is_active,
         token_version, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, FALSE, FALSE, FALSE, TRUE, 1, NOW())
       RETURNING *`,
      [
        finalMemberId,
        fullName,
        username,
        gen,
        team,
        'Thành viên tập sự',
        schoolYear,
        phone,
      ]
    );
    memberRecord = insertMemRes.rows[0];

    // 7. Ghi nhận phân ban ban đầu vào member_affiliations với UUID canonical
    const affId = crypto.randomUUID();
    let affDept = 'BAN_HAU_CAN';
    if (team === 'NOI_DUNG') affDept = 'BAN_NOI_DUNG';
    else if (team === 'TRUYEN_THONG_DOI_NGOAI') affDept = 'BAN_TTDN';
    else if (team === 'BAN_CHU_NHIEM') affDept = 'BAN_CHU_NHIEM';

    await db.query(
      `INSERT INTO member_affiliations (
         id, member_id, department, role, term_year, start_date, is_current, notes, created_at
       )
       VALUES ($1, $2, $3, 'THANH_VIEN', $4, CURRENT_DATE, TRUE, 'Trúng tuyển đợt tuyển thành viên mới', NOW())`,
      [affId, finalMemberId, affDept, termYear]
    );
  }

  // 8. Cập nhật quyết định tuyển dụng đã chuyển đổi
  const updatedDecRes = await db.query(
    `UPDATE recruitment_decisions
     SET is_converted_to_member = TRUE,
         converted_member_id = $1,
         converted_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [finalMemberId, decision.id]
  );
  const updatedDec = updatedDecRes.rows[0];

  return {
    decision: {
      id: updatedDec.id,
      responseId: updatedDec.response_id,
      decision: updatedDec.decision,
      assignedDepartment: updatedDec.assigned_department,
      committeeNotes: updatedDec.committee_notes,
      decidedBy: updatedDec.decided_by,
      decidedAt: updatedDec.decided_at,
      isConvertedToMember: true,
      convertedMemberId: finalMemberId,
      convertedAt: updatedDec.converted_at,
    },
    member: {
      id: memberRecord.id,
      fullName: memberRecord.full_name,
      username: memberRecord.username,
      team: memberRecord.team,
      roleTitle: memberRecord.role_title,
      schoolYear: memberRecord.school_year,
      phone: memberRecord.phone,
      isEligibleMainDuty: Boolean(memberRecord.is_eligible_main_duty),
      hasPaidFee: Boolean(memberRecord.has_paid_fee),
      isAlumni: Boolean(memberRecord.is_alumni),
      isAdmin: Boolean(memberRecord.is_admin),
      isActive: Boolean(memberRecord.is_active),
      createdAt: memberRecord.created_at,
    },
    isAlreadyConverted: false,
  };
}

/**
 * Phê duyệt công bố kết quả ứng viên ra công chúng (R13)
 * Gán mã định danh ẩn danh (candidate_code), không dùng MSSV hay tên thật
 */
export async function approvePublicAnnouncement(
  db: Queryable,
  params: {
    campaignId: string;
    responseId: string;
    candidateCode: string;
    passedDepartment: string;
  },
  actorId: string
): Promise<PublicApprovedResultDto> {
  const annId = `PUB_${params.campaignId}_${params.candidateCode}`;

  await db.query(
    `INSERT INTO recruitment_public_announcements (
       id, campaign_id, response_id, candidate_code, passed_department,
       is_approved_for_public, approved_by, approved_at
     )
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW())
     ON CONFLICT (campaign_id, candidate_code)
     DO UPDATE SET passed_department = EXCLUDED.passed_department,
                   is_approved_for_public = TRUE,
                   approved_by = EXCLUDED.approved_by,
                   approved_at = NOW()`,
    [annId, params.campaignId, params.responseId, params.candidateCode, params.passedDepartment, actorId]
  );

  return {
    candidateCode: params.candidateCode,
    passedDepartment: params.passedDepartment,
    termSemester: params.campaignId,
    announcementDate: new Date().toISOString(),
  };
}

/**
 * Lấy danh sách kết quả tuyển công khai đã được duyệt (R13)
 * CHỈ TRẢ VỀ CÁC TRƯỜNG ĐÃ ĐƯỢC DUYỆT: candidate_code, passed_department.
 * Tuyệt đối không xuất raw MSSV, email, số điện thoại hay họ tên thật khi chưa có policy cho phép.
 */
export async function getPublicApprovedResults(
  db: Queryable,
  campaignId: string
): Promise<PublicApprovedResultDto[]> {
  const res = await db.query<any>(
    `SELECT candidate_code, passed_department, campaign_id, approved_at
     FROM recruitment_public_announcements
     WHERE campaign_id = $1 AND is_approved_for_public = TRUE
     ORDER BY candidate_code ASC`,
    [campaignId]
  );

  return res.rows.map((r) => ({
    candidateCode: r.candidate_code,
    passedDepartment: r.passed_department,
    termSemester: r.campaign_id,
    announcementDate: r.approved_at,
  }));
}
