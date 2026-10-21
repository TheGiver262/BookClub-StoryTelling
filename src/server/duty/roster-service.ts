/**
 * YSBK Duty Roster Service (Chặng 15)
 * Tạo nháp đề xuất (DRAFT), Chỉnh sửa tay (MANUAL EDIT), Công bố có phiên bản (PUBLISHED),
 * Điểm danh vai trò, không làm mất sửa tay hoặc đổi âm thầm lịch đã công bố.
 */

import type { Queryable } from '../finance/types.ts';
import { randomUUID } from 'node:crypto';
import { recordAuditLog } from '../shared/audit.ts';
import { BadRequestError, NotFoundError } from '../errors.ts';
import {
  type DutyScheduleDto,
  type DutyAssigneeDto,
  type DutyMemberCandidate,
  type MemberBusyWindow,
  type GenerateDraftSchedulesParams,
  type ManualEditScheduleParams,
  type UpdateAttendanceParams,
  SCHEDULE_STATUSES,
  DUTY_TYPES,
  ASSIGNED_ROLES,
  POLICY_LABELS,
} from './roster-types.ts';
import {
  solveShiftSchedule,
  validateShiftAssignment,
  assignSpecificRoles,
  composeFacebookPostContent,
} from './scheduler.ts';

/**
 * Lấy danh sách ứng viên thành viên kèm số ca trực lịch sử đã công bố
 */
export async function getMemberCandidates(db: Queryable): Promise<DutyMemberCandidate[]> {
  const res = await db.query<any>(
    `SELECT m.id, m.full_name, m.username,
            COALESCE(m.is_alumni, false) as is_alumni,
            COALESCE(m.is_eligible_main_duty, false) as is_eligible_main,
            COALESCE(m.is_active, true) as is_active,
            COALESCE(sh.main_count, 0) as main_count,
            COALESCE(sh.support_count, 0) as support_count
     FROM members m
     LEFT JOIN (
       SELECT dsa.member_id,
              COUNT(CASE WHEN dsa.duty_type = 'MAIN' THEN 1 END) as main_count,
              COUNT(CASE WHEN dsa.duty_type = 'SUPPORT' THEN 1 END) as support_count
       FROM duty_schedule_assignees dsa
       JOIN duty_schedules ds ON ds.id = dsa.schedule_id
       WHERE ds.status = 'PUBLISHED'
       GROUP BY dsa.member_id
     ) sh ON sh.member_id = m.id
     ORDER BY m.id ASC`
  );

  return res.rows.map((r: any) => ({
    id: r.id,
    fullName: r.full_name,
    username: r.username,
    studentId: null,
    isActive: Boolean(r.is_active),
    isAlumni: Boolean(r.is_alumni),
    isEligibleMain: Boolean(r.is_eligible_main),
    assignedMainShiftsCount: parseInt(r.main_count, 10) || 0,
    assignedSupportShiftsCount: parseInt(r.support_count, 10) || 0,
  }));
}

/**
 * Lấy danh sách khoảng bận của thành viên trong kỳ học
 */
export async function getActiveBusyIntervals(
  db: Queryable,
  termSemester: string,
  dayOfWeek?: string
): Promise<MemberBusyWindow[]> {
  let query = `
    SELECT mbi.member_id, mbi.day_of_week, mbi.start_time, mbi.end_time, mbi.busy_type
    FROM member_busy_intervals mbi
    JOIN duty_availability_batches dab ON dab.id = mbi.batch_id
    WHERE dab.term_semester = $1 AND mbi.is_active = TRUE
  `;
  const params: any[] = [termSemester];
  if (dayOfWeek) {
    query += ` AND mbi.day_of_week = $2`;
    params.push(dayOfWeek);
  }

  const res = await db.query<any>(query, params);
  return res.rows.map((r: any) => ({
    memberId: r.member_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    busyType: r.busy_type,
  }));
}

/**
 * 1. Tạo bản nháp lịch trực cho kỳ học (Generate Draft Schedules)
 * Tự động tìm các ngày Thứ Ba và Thứ Năm trong khoảng thời gian, bỏ qua ngày nghỉ lễ.
 * Không làm mất sửa đổi tay (is_manually_edited) hoặc âm thầm đổi lịch đã công bố (PUBLISHED).
 */
export async function generateDraftSchedules(
  db: Queryable,
  params: GenerateDraftSchedulesParams,
  actorId: string
): Promise<{ createdCount: number; preservedCount: number; schedules: DutyScheduleDto[] }> {
  const { termSemester, startDate, endDate, forceOverwriteManual } = params;

  // Lấy danh sách ngày nghỉ lễ
  const holidaysRes = await db.query<any>(
    `SELECT holiday_date FROM calendar_holidays`
  );
  const holidaySet = new Set<string>(
    holidaysRes.rows.map((r: any) => {
      const d = r.holiday_date;
      return typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);
    })
  );

  // Lấy các ứng viên và khoảng bận
  const candidates = await getMemberCandidates(db);
  const busyWindows = await getActiveBusyIntervals(db, termSemester);

  const start = new Date(startDate);
  const end = new Date(endDate);

  let createdCount = 0;
  let preservedCount = 0;
  const resultSchedules: DutyScheduleDto[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeekNum = d.getDay(); // 2: Tuesday, 4: Thursday
    if (dayOfWeekNum !== 2 && dayOfWeekNum !== 4) {
      continue;
    }

    const dateStr = d.toISOString().substring(0, 10);
    if (holidaySet.has(dateStr)) {
      continue; // Bỏ qua ngày nghỉ lễ
    }

    const dayOfWeekEnum = dayOfWeekNum === 2 ? 'THU_BA' : 'THU_NAM';

    // Kiểm tra lịch hiện có
    const existingRes = await db.query<any>(
      `SELECT id, status, is_manually_edited, version, published_version
       FROM duty_schedules
       WHERE schedule_date = $1`,
      [dateStr]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      // Nếu đã công bố hoặc đã chỉnh sửa tay và không ép buộc ghi đè -> BẢO TOÀN NGUYÊN VẸN
      if ((existing.status === SCHEDULE_STATUSES.PUBLISHED || existing.is_manually_edited) && !forceOverwriteManual) {
        preservedCount++;
        const schedDto = await getScheduleById(db, existing.id);
        if (schedDto) resultSchedules.push(schedDto);
        continue;
      }
    }

    // Lọc các khoảng bận cho ngày này
    const busyForDay = busyWindows.filter((w) => w.dayOfWeek === dayOfWeekEnum);

    // Chạy thuật toán Solver
    const solution = solveShiftSchedule(candidates, busyForDay);

    // Gán 4 vai trò cụ thể
    const assignedRoles = assignSpecificRoles(
      solution.mainDuty.map((m) => ({ memberId: m.id })),
      solution.supportDuty.map((s) => ({ memberId: s.id }))
    );

    // Soạn nội dung Facebook
    const fbContent = composeFacebookPostContent({
      scheduleDate: dateStr,
      dayOfWeek: dayOfWeekEnum,
      mains: solution.mainDuty.map((m) => {
        const ar = assignedRoles.find((r) => r.memberId === m.id);
        return { fullName: m.fullName, role: ar ? ar.assignedRole : ASSIGNED_ROLES.CIRCULATION_LOG };
      }),
      supports: solution.supportDuty.map((s) => {
        const ar = assignedRoles.find((r) => r.memberId === s.id);
        return { fullName: s.fullName, role: ar ? ar.assignedRole : ASSIGNED_ROLES.LOGISTICS_SETUP };
      }),
    });

    const scheduleId = existingRes.rows.length > 0
      ? existingRes.rows[0].id
      : `sched-${dateStr}-${Math.random().toString(36).substring(2, 7)}`;

    const currentVersion = existingRes.rows.length > 0 ? (existingRes.rows[0].version || 1) : 1;

    // Lưu vào duty_schedules (DRAFT, version 1)
    await db.query(
      `INSERT INTO duty_schedules (
         id, term_semester, schedule_date, day_of_week, shift_time, location,
         status, version, warning_main, warning_support, is_manually_edited,
         facebook_post_content, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, NOW(), NOW())
       ON CONFLICT (schedule_date, version) DO UPDATE SET
         term_semester = EXCLUDED.term_semester,
         day_of_week = EXCLUDED.day_of_week,
         shift_time = EXCLUDED.shift_time,
         location = EXCLUDED.location,
         status = 'DRAFT',
         warning_main = EXCLUDED.warning_main,
         warning_support = EXCLUDED.warning_support,
         is_manually_edited = FALSE,
         facebook_post_content = EXCLUDED.facebook_post_content,
         updated_at = NOW()`,
      [
        scheduleId,
        termSemester,
        dateStr,
        dayOfWeekEnum,
        POLICY_LABELS.SHIFT_TIME_FULL,
        POLICY_LABELS.LOCATION_DEFAULT,
        SCHEDULE_STATUSES.DRAFT,
        currentVersion,
        solution.warningMain,
        solution.warningSupport,
        fbContent,
      ]
    );

    // Xóa các phân công cũ nếu có và ghi lại
    await db.query(`DELETE FROM duty_schedule_assignees WHERE schedule_id = $1`, [scheduleId]);

    for (const ar of assignedRoles) {
      const assigneeId = `dsa-${randomUUID()}`;
      await db.query(
        `INSERT INTO duty_schedule_assignees (
           id, schedule_id, member_id, duty_type, assigned_role, attendance_status, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', NOW())`,
        [assigneeId, scheduleId, ar.memberId, ar.dutyType, ar.assignedRole]
      );
    }

    createdCount++;
    const schedDto = await getScheduleById(db, scheduleId);
    if (schedDto) resultSchedules.push(schedDto);
  }

  await recordAuditLog(db, {
    actorId,
    action: 'DUTY_SCHEDULE_GENERATE_DRAFT',
    targetResource: 'duty_schedules',
    targetId: termSemester,
    details: {
      actorRole: 'MANAGER',
      description: `Tạo dự thảo lịch trực kỳ ${termSemester}: ${createdCount} ca mới, bảo toàn ${preservedCount} ca.`,
    },
  });

  return { createdCount, preservedCount, schedules: resultSchedules };
}

/**
 * 2. Chỉnh sửa tay phân công ca trực (Manual Edit)
 * Áp dụng CÙNG validator với Auto-solver, tăng version, đánh dấu is_manually_edited = true.
 */
export async function manualEditSchedule(
  db: Queryable,
  scheduleId: string,
  params: ManualEditScheduleParams,
  actorId: string
): Promise<DutyScheduleDto> {
  const schedRes = await db.query<any>(
    `SELECT * FROM duty_schedules WHERE id = $1 FOR UPDATE`,
    [scheduleId]
  );
  if (schedRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy ca trực với mã ${scheduleId}`, 'SCHEDULE_NOT_FOUND');
  }
  const sched = schedRes.rows[0];
  if (sched.status === SCHEDULE_STATUSES.CANCELLED) {
    throw new BadRequestError('Không thể chỉnh sửa ca trực đã bị hủy', 'SCHEDULE_CANCELLED');
  }

  // LIFE-09: Chặn âm thầm đổi giờ ca trực khi đang có đơn đặt chờ nhận
  if ((params.shiftTime && params.shiftTime !== sched.shift_time) || (params.location && params.location !== sched.location)) {
    const resCheck = await db.query<any>(
      `SELECT COUNT(*) AS count FROM reservations WHERE schedule_id = $1 AND status = 'HELD'`,
      [scheduleId]
    );
    if (resCheck.rows && Number(resCheck.rows[0]?.count || 0) > 0) {
      throw new BadRequestError(
        'Không thể thay đổi giờ hoặc địa điểm ca trực khi đang có đơn đặt sách chờ nhận. Vui lòng xử lý hoặc hủy các đơn đặt trước.',
        'CANNOT_MODIFY_SCHEDULE_WITH_ACTIVE_RESERVATIONS'
      );
    }
  }

  const candidates = await getMemberCandidates(db);
  const busyWindows = await getActiveBusyIntervals(db, sched.term_semester, sched.day_of_week);

  const mainCandidates: DutyMemberCandidate[] = [];
  const supportCandidates: DutyMemberCandidate[] = [];

  for (const a of params.assignees) {
    const cand = candidates.find((c) => c.id === a.memberId);
    if (!cand) {
      throw new BadRequestError(`Thành viên với mã ${a.memberId} không tồn tại`, 'MEMBER_NOT_FOUND');
    }
    if (a.dutyType === DUTY_TYPES.MAIN) {
      mainCandidates.push(cand);
    } else {
      supportCandidates.push(cand);
    }
  }

  // Chạy Shared Validator
  const validation = validateShiftAssignment(mainCandidates, supportCandidates, busyWindows);
  if (!validation.isValid) {
    throw new BadRequestError(
      `Phân công không hợp lệ: ${validation.errors.join('; ')}`,
      'INVALID_SHIFT_ASSIGNMENT'
    );
  }

  const newVersion = (sched.version || 1) + 1;
  const shiftTime = params.shiftTime || sched.shift_time;
  const location = params.location || sched.location;

  // Soạn lại nội dung Facebook
  const dateStr = typeof sched.schedule_date === 'string'
    ? sched.schedule_date.substring(0, 10)
    : new Date(sched.schedule_date).toISOString().substring(0, 10);

  const fbContent = composeFacebookPostContent({
    scheduleDate: dateStr,
    dayOfWeek: sched.day_of_week,
    shiftTime,
    location,
    mains: params.assignees
      .filter((a) => a.dutyType === DUTY_TYPES.MAIN)
      .map((a) => {
        const c = candidates.find((cand) => cand.id === a.memberId);
        return { fullName: c ? c.fullName : a.memberId, role: a.assignedRole };
      }),
    supports: params.assignees
      .filter((a) => a.dutyType === DUTY_TYPES.SUPPORT)
      .map((a) => {
        const c = candidates.find((cand) => cand.id === a.memberId);
        return { fullName: c ? c.fullName : a.memberId, role: a.assignedRole };
      }),
  });

  await db.query(
    `UPDATE duty_schedules
     SET version = $1,
         shift_time = $2,
         location = $3,
         warning_main = $4,
         warning_support = $5,
         is_manually_edited = TRUE,
         facebook_post_content = $6,
         updated_at = NOW()
     WHERE id = $7`,
    [
      newVersion,
      shiftTime,
      location,
      validation.warningMain || null,
      validation.warningSupport || null,
      fbContent,
      scheduleId,
    ]
  );

  // Cập nhật assignees
  await db.query(`DELETE FROM duty_schedule_assignees WHERE schedule_id = $1`, [scheduleId]);

  for (const a of params.assignees) {
    const assigneeId = `dsa-${randomUUID()}`;
    await db.query(
      `INSERT INTO duty_schedule_assignees (
         id, schedule_id, member_id, duty_type, assigned_role, attendance_status, notes, created_at
       ) VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', $6, NOW())`,
      [assigneeId, scheduleId, a.memberId, a.dutyType, a.assignedRole, a.notes || null]
    );
  }

  await recordAuditLog(db, {
    actorId,
    action: 'DUTY_SCHEDULE_MANUAL_EDIT',
    targetResource: 'duty_schedules',
    targetId: scheduleId,
    details: {
      actorRole: 'MANAGER',
      description: `Chỉnh sửa tay ca trực ngày ${dateStr} lên phiên bản v${newVersion}.`,
    },
  });

  const updated = await getScheduleById(db, scheduleId);
  return updated!;
}

/**
 * 3. Công bố lịch trực có phiên bản (Publish Schedule)
 * Chuyển status DRAFT -> PUBLISHED, ghi nhận published_version, published_at, published_by.
 */
export async function publishSchedule(
  db: Queryable,
  scheduleId: string,
  actorId: string
): Promise<DutyScheduleDto> {
  const schedRes = await db.query<any>(
    `SELECT * FROM duty_schedules WHERE id = $1 FOR UPDATE`,
    [scheduleId]
  );
  if (schedRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy ca trực với mã ${scheduleId}`, 'SCHEDULE_NOT_FOUND');
  }
  const sched = schedRes.rows[0];

  const holiday = await db.query('SELECT holiday_date FROM calendar_holidays WHERE holiday_date=$1',[sched.schedule_date]);
  if (holiday.rows.length) throw new BadRequestError('Ngày này đã được đánh dấu nghỉ, không thể công bố buổi trực.', 'DUTY_ON_HOLIDAY');

  await db.query(
    `UPDATE duty_schedules
     SET status = 'PUBLISHED',
         published_version = version,
         published_at = NOW(),
         published_by = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [actorId, scheduleId]
  );

  await recordAuditLog(db, {
    actorId,
    action: 'DUTY_SCHEDULE_PUBLISH',
    targetResource: 'duty_schedules',
    targetId: scheduleId,
    details: {
      actorRole: 'MANAGER',
      description: `Công bố chính thức ca trực ${scheduleId} tại phiên bản v${sched.version}.`,
    },
  });

  const updated = await getScheduleById(db, scheduleId);
  return updated!;
}

/**
 * 4. Điểm danh và ghi nhận vai trò (Update Attendance)
 */
export async function updateAttendance(
  db: Queryable,
  scheduleId: string,
  params: UpdateAttendanceParams,
  actorId: string
): Promise<DutyAssigneeDto> {
  const res = await db.query<any>(
    `UPDATE duty_schedule_assignees
     SET attendance_status = $1,
         notes = COALESCE($2, notes)
     WHERE schedule_id = $3 AND member_id = $4
     RETURNING id, schedule_id, member_id, duty_type, assigned_role, attendance_status, notes, created_at`,
    [params.attendanceStatus, params.notes || null, scheduleId, params.memberId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy thành viên ${params.memberId} trong ca trực ${scheduleId}`, 'ASSIGNEE_NOT_FOUND');
  }

  await recordAuditLog(db, {
    actorId,
    action: 'DUTY_ATTENDANCE_UPDATE',
    targetResource: 'duty_schedule_assignees',
    targetId: `${scheduleId}:${params.memberId}`,
    details: {
      actorRole: 'STAFF',
      description: `Cập nhật điểm danh ${params.attendanceStatus} cho thành viên ${params.memberId}.`,
    },
  });

  const r = res.rows[0];
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    memberId: r.member_id,
    dutyType: r.duty_type,
    assignedRole: r.assigned_role,
    attendanceStatus: r.attendance_status,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/**
 * Lấy chi tiết 1 ca trực theo ID
 */
export async function getScheduleById(db: Queryable, scheduleId: string): Promise<DutyScheduleDto | null> {
  const schedRes = await db.query<any>(
    `SELECT * FROM duty_schedules WHERE id = $1`,
    [scheduleId]
  );
  if (schedRes.rows.length === 0) return null;
  const s = schedRes.rows[0];

  const assRes = await db.query<any>(
    `SELECT dsa.*, m.full_name as member_name
     FROM duty_schedule_assignees dsa
     JOIN members m ON m.id = dsa.member_id
     WHERE dsa.schedule_id = $1
     ORDER BY dsa.duty_type ASC, dsa.created_at ASC`,
    [scheduleId]
  );

  const assignees: DutyAssigneeDto[] = assRes.rows.map((r: any) => ({
    id: r.id,
    scheduleId: r.schedule_id,
    memberId: r.member_id,
    memberName: r.member_name,
    memberStudentId: null,
    dutyType: r.duty_type,
    assignedRole: r.assigned_role,
    attendanceStatus: r.attendance_status,
    notes: r.notes,
    createdAt: r.created_at,
  }));

  const dateStr = typeof s.schedule_date === 'string'
    ? s.schedule_date.substring(0, 10)
    : new Date(s.schedule_date).toISOString().substring(0, 10);

  return {
    id: s.id,
    termSemester: s.term_semester,
    scheduleDate: dateStr,
    dayOfWeek: s.day_of_week,
    shiftTime: s.shift_time,
    location: s.location,
    status: s.status,
    version: s.version,
    publishedVersion: s.published_version,
    publishedAt: s.published_at,
    publishedBy: s.published_by,
    warningMain: s.warning_main,
    warningSupport: s.warning_support,
    isManuallyEdited: Boolean(s.is_manually_edited),
    facebookPostContent: s.facebook_post_content,
    assignees,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

/**
 * Lấy danh sách ca trực theo kỳ học hoặc trạng thái
 */
export async function listSchedules(
  db: Queryable,
  termSemester?: string,
  status?: string
): Promise<DutyScheduleDto[]> {
  let query = `SELECT id FROM duty_schedules WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (termSemester) {
    query += ` AND term_semester = $${idx++}`;
    params.push(termSemester);
  }
  if (status) {
    query += ` AND status = $${idx++}`;
    params.push(status);
  }
  query += ` ORDER BY schedule_date ASC, version DESC`;

  const res = await db.query<any>(query, params);
  const list: DutyScheduleDto[] = [];
  for (const r of res.rows) {
    const s = await getScheduleById(db, r.id);
    if (s) list.push(s);
  }
  return list;
}

/**
 * Hủy ca trực và tự động hủy các đơn đặt giữ chỗ chưa nhận (LIFE-08)
 */
export async function cancelDutySchedule(
  db: Queryable,
  scheduleId: string,
  actorId: string,
  reason = 'Ca trực đã bị hủy'
): Promise<DutyScheduleDto> {
  const schedRes = await db.query<any>(
    `SELECT * FROM duty_schedules WHERE id = $1 FOR UPDATE`,
    [scheduleId]
  );
  if (schedRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy ca trực với mã ${scheduleId}`, 'SCHEDULE_NOT_FOUND');
  }
  const sched = schedRes.rows[0];
  if (sched.status === SCHEDULE_STATUSES.CANCELLED) {
    throw new BadRequestError('Ca trực này đã bị hủy trước đó.', 'SCHEDULE_ALREADY_CANCELLED');
  }

  // 1. Cập nhật trạng thái ca trực sang CANCELLED
  await db.query(
    `UPDATE duty_schedules SET status = $1, updated_at = NOW() WHERE id = $2`,
    [SCHEDULE_STATUSES.CANCELLED, scheduleId]
  );

  // 2. Tự động hủy toàn bộ các đơn đặt giữ chỗ CHƯA NHẬN (HELD) của ca này (LIFE-08)
  // Lưu ý: Tuyệt đối KHÔNG đụng đến các đơn BORROWED (sách đã bàn giao cho bạn đọc)
  await db.query(
    `UPDATE reservations 
     SET status = 'CANCELLED',
         cancelled_by = $1,
         cancelled_at = NOW(),
         cancellation_reason = $2,
         updated_at = NOW()
     WHERE schedule_id = $3 AND status = 'HELD'`,
    [actorId, reason, scheduleId]
  );

  const updated = await getScheduleById(db, scheduleId);
  return updated!;
}
