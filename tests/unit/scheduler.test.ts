import test from 'node:test';
import assert from 'node:assert';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  type DutyMemberCandidate,
  type MemberBusyWindow,
  ASSIGNED_ROLES,
  SCHEDULE_STATUSES,
  DUTY_TYPES,
} from '../../src/server/duty/roster-types.ts';
import {
  isMemberEligibleForMain,
  isMemberEligibleForSupport,
  solveShiftSchedule,
  assignSpecificRoles,
  composeFacebookPostContent,
} from '../../src/server/duty/scheduler.ts';
import {
  generateDraftSchedules,
  manualEditSchedule,
  publishSchedule,
  updateAttendance,
  getScheduleById,
} from '../../src/server/duty/roster-service.ts';

function createMockCandidates(): DutyMemberCandidate[] {
  return [
    {
      id: 'mem-main-1',
      fullName: 'Nguyễn Văn An',
      username: 'an.nv',
      studentId: '20230001',
      isActive: true,
      isAlumni: false,
      isEligibleMain: true,
      assignedMainShiftsCount: 0,
      assignedSupportShiftsCount: 0,
    },
    {
      id: 'mem-main-2',
      fullName: 'Trần Thị Bình',
      username: 'binh.tt',
      studentId: '20230002',
      isActive: true,
      isAlumni: false,
      isEligibleMain: true,
      assignedMainShiftsCount: 0,
      assignedSupportShiftsCount: 0,
    },
    {
      id: 'mem-main-3',
      fullName: 'Lê Văn Cường',
      username: 'cuong.lv',
      studentId: '20230003',
      isActive: true,
      isAlumni: false,
      isEligibleMain: true,
      assignedMainShiftsCount: 1, // Đã trực 1 ca chính
      assignedSupportShiftsCount: 0,
    },
    {
      id: 'mem-sup-1',
      fullName: 'Phạm Thị Dung',
      username: 'dung.pt',
      studentId: '20230004',
      isActive: true,
      isAlumni: false,
      isEligibleMain: false, // Chưa đủ điều kiện trực chính
      assignedMainShiftsCount: 0,
      assignedSupportShiftsCount: 0,
    },
    {
      id: 'mem-sup-2',
      fullName: 'Hoàng Văn Em',
      username: 'em.hv',
      studentId: '20230005',
      isActive: true,
      isAlumni: false,
      isEligibleMain: false,
      assignedMainShiftsCount: 0,
      assignedSupportShiftsCount: 0,
    },
    {
      id: 'mem-sup-3',
      fullName: 'Vũ Thị Giang',
      username: 'giang.vt',
      studentId: '20230006',
      isActive: true,
      isAlumni: false,
      isEligibleMain: false,
      assignedMainShiftsCount: 0,
      assignedSupportShiftsCount: 0,
    },
    {
      id: 'mem-alumni',
      fullName: 'Cựu Thành Viên K60',
      username: 'cuu.k60',
      studentId: '20150001',
      isActive: true,
      isAlumni: true, // Cựu thành viên
      isEligibleMain: true,
      assignedMainShiftsCount: 0,
      assignedSupportShiftsCount: 0,
    },
  ];
}

test('Chặng 15 - R11 Gate 1: Main rảnh 14:00-17:00 nhưng bận đầu hoặc cuối ca bị loại', () => {
  const candidates = createMockCandidates();
  const m1 = candidates.find((c) => c.id === 'mem-main-1')!;
  const m2 = candidates.find((c) => c.id === 'mem-main-2')!;

  // M1 bận lúc chuẩn bị (13:30 - 14:00)
  const busyM1: MemberBusyWindow[] = [
    { memberId: 'mem-main-1', dayOfWeek: 'THU_BA', startTime: '13:30', endTime: '14:00', busyType: 'HOC' },
  ];
  // M2 bận lúc thu dọn (17:00 - 17:30)
  const busyM2: MemberBusyWindow[] = [
    { memberId: 'mem-main-2', dayOfWeek: 'THU_BA', startTime: '17:00', endTime: '17:30', busyType: 'HOC' },
  ];

  const res1 = isMemberEligibleForMain(m1, busyM1);
  assert.strictEqual(res1.eligible, false);
  assert.match(res1.reason || '', /vướng lịch bận/);

  const res2 = isMemberEligibleForMain(m2, busyM2);
  assert.strictEqual(res2.eligible, false);
  assert.match(res2.reason || '', /vướng lịch bận/);
});

test('Chặng 15 - R11 Gate 2: Cảnh báo riêng thiếu main và dưới 3 helper bắt buộc có warning', () => {
  const candidates = createMockCandidates();
  // Chỉ có 1 người trực chính rảnh và chỉ có 2 người hỗ trợ
  const busy: MemberBusyWindow[] = [
    { memberId: 'mem-main-1', dayOfWeek: 'THU_BA', startTime: '13:00', endTime: '18:00', busyType: 'HOC' },
    { memberId: 'mem-main-2', dayOfWeek: 'THU_BA', startTime: '13:00', endTime: '18:00', busyType: 'HOC' },
    { memberId: 'mem-sup-3', dayOfWeek: 'THU_BA', startTime: '13:00', endTime: '18:00', busyType: 'HOC' },
  ];

  const solution = solveShiftSchedule(candidates, busy);

  // Chỉ còn mem-main-3 làm main
  assert.strictEqual(solution.mainDuty.length, 1);
  assert.strictEqual(solution.mainDuty[0].id, 'mem-main-3');
  assert.notStrictEqual(solution.warningMain, null);
  assert.match(solution.warningMain || '', /Thiếu người trực chính/);

  // Chỉ còn 2 helper (mem-sup-1, mem-sup-2)
  assert.strictEqual(solution.supportDuty.length, 2);
  assert.notStrictEqual(solution.warningSupport, null);
  assert.match(solution.warningSupport || '', /Thiếu người trực hỗ trợ/);
  assert.match(solution.warningSupport || '', /dưới mức tối thiểu 3 người/);
});

test('Chặng 15 - R11 Gate 3: Người bận giữa ca (14:30 - 16:30) vẫn đủ điều kiện làm trực hỗ trợ', () => {
  const candidates = createMockCandidates();
  const sup1 = candidates.find((c) => c.id === 'mem-sup-1')!;

  // sup1 bận giữa ca từ 14:30 đến 16:30 nhưng rảnh mở (13:45 - 14:15) và đóng (16:45 - 17:15)
  const busyBetween: MemberBusyWindow[] = [
    { memberId: 'mem-sup-1', dayOfWeek: 'THU_BA', startTime: '14:30', endTime: '16:30', busyType: 'TIET_HOC' },
  ];

  const res = isMemberEligibleForSupport(sup1, busyBetween);
  assert.strictEqual(res.eligible, true, 'Người bận giữa ca vẫn phải đủ điều kiện trực hỗ trợ!');

  // Nếu bận cả mở lẫn đóng ca -> Bị loại
  const busyBothEnds: MemberBusyWindow[] = [
    { memberId: 'mem-sup-1', dayOfWeek: 'THU_BA', startTime: '13:30', endTime: '14:30', busyType: 'TIET_HOC' },
    { memberId: 'mem-sup-1', dayOfWeek: 'THU_BA', startTime: '16:30', endTime: '17:30', busyType: 'TIET_HOC' },
  ];
  const resBoth = isMemberEligibleForSupport(sup1, busyBothEnds);
  assert.strictEqual(resBoth.eligible, false, 'Bận cả đầu và cuối ca phải bị loại khỏi hỗ trợ');
});

test('Chặng 15 - R11 Gate 4: Cựu thành viên và người chưa qua đào tạo bị chặn theo chính sách', () => {
  const candidates = createMockCandidates();
  const alumni = candidates.find((c) => c.id === 'mem-alumni')!;
  const untrained = candidates.find((c) => c.id === 'mem-sup-1')!;

  // Cựu thành viên không được trực chính và không được trực hỗ trợ
  assert.strictEqual(isMemberEligibleForMain(alumni, []).eligible, false);
  assert.strictEqual(isMemberEligibleForSupport(alumni, []).eligible, false);

  // Người chưa qua đào tạo không được trực chính
  assert.strictEqual(isMemberEligibleForMain(untrained, []).eligible, false);
  // Nhưng được trực hỗ trợ
  assert.strictEqual(isMemberEligibleForSupport(untrained, []).eligible, true);
});

test('Chặng 15 - R11 Gate 5: Gán đúng 4 vai trò cụ thể và soạn nội dung Facebook không gọi mạng thật', () => {
  const mains = [{ memberId: 'mem-main-1' }, { memberId: 'mem-main-2' }];
  const supports = [{ memberId: 'mem-sup-1' }, { memberId: 'mem-sup-2' }, { memberId: 'mem-sup-3' }];

  const roles = assignSpecificRoles(mains, supports);

  assert.strictEqual(roles[0].assignedRole, ASSIGNED_ROLES.CASH_DRAWER);
  assert.strictEqual(roles[1].assignedRole, ASSIGNED_ROLES.CIRCULATION_LOG);
  assert.strictEqual(roles[2].assignedRole, ASSIGNED_ROLES.LOGISTICS_SETUP);
  assert.strictEqual(roles[3].assignedRole, ASSIGNED_ROLES.BOOK_INTRO);

  const fbContent = composeFacebookPostContent({
    scheduleDate: '2026-10-20',
    dayOfWeek: 'THU_BA',
    mains: [
      { fullName: 'Nguyễn Văn An', role: ASSIGNED_ROLES.CASH_DRAWER },
      { fullName: 'Trần Thị Bình', role: ASSIGNED_ROLES.CIRCULATION_LOG },
    ],
    supports: [
      { fullName: 'Phạm Thị Dung', role: ASSIGNED_ROLES.LOGISTICS_SETUP },
      { fullName: 'Hoàng Văn Em', role: ASSIGNED_ROLES.BOOK_INTRO },
    ],
  });

  assert.match(fbContent, /\[YSBK\] LỊCH TRỰC BÀN SÁCH/);
  assert.match(fbContent, /Thứ Ba, ngày 2026-10-20/);
  assert.match(fbContent, /Kiểm tiền quầy & két/);
  assert.match(fbContent, /Ghi sổ mượn trả/);
  assert.match(fbContent, /https:\/\/ysbk\.club\/tra-cuu/);
});

test('Chặng 15 - Service Lifecycle: Tạo nháp, Chỉnh sửa tay giữ phiên bản, và Công bố có phiên bản', async () => {
  const db = new MockCashDbQueryable();
  // Khởi tạo các thành viên
  const candidates = createMockCandidates();
  for (const c of candidates) {
    db.members.push({
      id: c.id,
      full_name: c.fullName,
      username: c.username,
      is_active: c.isActive,
      is_alumni: c.isAlumni,
      is_eligible_main_duty: c.isEligibleMain,
    });
  }

  // Thêm 1 batch lịch bận hợp lệ kỳ 2026.1
  db.dutyAvailabilityBatches.push({
    id: 'batch-01',
    term_semester: '2026.1',
    status: 'COMMITTED',
    created_at: new Date().toISOString(),
  });

  // 1. Tạo dự thảo (Generate Drafts) cho tuần từ 2026-10-19 đến 2026-10-25
  // Thứ Ba: 2026-10-20, Thứ Năm: 2026-10-22
  const genResult = await generateDraftSchedules(
    db,
    {
      termSemester: '2026.1',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
    },
    'staff-admin'
  );

  assert.strictEqual(genResult.createdCount, 2, 'Phải tạo 2 ca trực (Thứ 3 và Thứ 5)');
  assert.strictEqual(genResult.schedules.length, 2);
  const schedTue = genResult.schedules.find((s) => s.dayOfWeek === 'THU_BA')!;
  assert.strictEqual(schedTue.status, SCHEDULE_STATUSES.DRAFT);
  assert.strictEqual(schedTue.version, 1);
  assert.strictEqual(schedTue.isManuallyEdited, false);

  // 2. Chỉnh sửa tay ca trực Thứ Ba: đổi phân công
  const edited = await manualEditSchedule(
    db,
    schedTue.id,
    {
      assignees: [
        { memberId: 'mem-main-2', dutyType: DUTY_TYPES.MAIN, assignedRole: ASSIGNED_ROLES.CASH_DRAWER },
        { memberId: 'mem-main-3', dutyType: DUTY_TYPES.MAIN, assignedRole: ASSIGNED_ROLES.CIRCULATION_LOG },
        { memberId: 'mem-sup-1', dutyType: DUTY_TYPES.SUPPORT, assignedRole: ASSIGNED_ROLES.LOGISTICS_SETUP },
        { memberId: 'mem-sup-2', dutyType: DUTY_TYPES.SUPPORT, assignedRole: ASSIGNED_ROLES.BOOK_INTRO },
        { memberId: 'mem-sup-3', dutyType: DUTY_TYPES.SUPPORT, assignedRole: ASSIGNED_ROLES.LOGISTICS_SETUP },
      ],
      shiftTime: '14:00 - 17:00 (Thu dọn 17:00 - 17:15 [GIẢ ĐỊNH / CHƯA CHỐT POLICY])',
    },
    'manager-01'
  );

  assert.strictEqual(edited.isManuallyEdited, true, 'Phải được đánh dấu là sửa tay');
  assert.strictEqual(edited.version, 2, 'Phiên bản phải tăng lên 2');

  // 3. Chạy lại generateDraftSchedules không được ghi đè ca đã chỉnh sửa tay
  const regenResult = await generateDraftSchedules(
    db,
    {
      termSemester: '2026.1',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      forceOverwriteManual: false,
    },
    'staff-admin'
  );

  assert.strictEqual(regenResult.preservedCount, 1, 'Ca sửa tay phải được bảo toàn nguyên vẹn');
  const checkTue = await getScheduleById(db, schedTue.id);
  assert.strictEqual(checkTue?.version, 2, 'Phiên bản v2 và sửa tay vẫn phải giữ nguyên');

  // 4. Công bố lịch (Publish Schedule)
  const published = await publishSchedule(db, schedTue.id, 'manager-01');
  assert.strictEqual(published.status, SCHEDULE_STATUSES.PUBLISHED);
  assert.strictEqual(published.publishedVersion, 2);
  assert.notStrictEqual(published.publishedAt, null);
  assert.strictEqual(published.publishedBy, 'manager-01');

  // 5. Cập nhật điểm danh (Attendance)
  const attRes = await updateAttendance(
    db,
    schedTue.id,
    {
      memberId: 'mem-main-2',
      attendanceStatus: 'PRESENT',
      notes: 'Đến đúng giờ, hoàn thành kiểm két xuất sắc',
    },
    'leader-01'
  );

  assert.strictEqual(attRes.attendanceStatus, 'PRESENT');
  assert.match(attRes.notes || '', /hoàn thành kiểm két/);
});

test('Chặng 15 - Shared Validator Barrier: Từ chối phân công sai điều kiện khi chỉnh sửa tay', async () => {
  const db = new MockCashDbQueryable();
  const candidates = createMockCandidates();
  for (const c of candidates) {
    db.members.push({
      id: c.id,
      full_name: c.fullName,
      username: c.username,
      is_active: c.isActive,
      is_alumni: c.isAlumni,
      is_eligible_main_duty: c.isEligibleMain,
    });
  }

  // Tạo sẵn 1 ca trực
  db.dutySchedules.push({
    id: 'sched-test-01',
    term_semester: '2026.1',
    schedule_date: '2026-10-20',
    day_of_week: 'THU_BA',
    status: 'DRAFT',
    version: 1,
    is_manually_edited: false,
    created_at: new Date().toISOString(),
  });

  // Cố tình gán cựu thành viên làm trực chính -> Bị chặn 400
  await assert.rejects(
    async () => {
      await manualEditSchedule(
        db,
        'sched-test-01',
        {
          assignees: [
            { memberId: 'mem-alumni', dutyType: DUTY_TYPES.MAIN, assignedRole: ASSIGNED_ROLES.CASH_DRAWER },
          ],
        },
        'user-admin'
      );
    },
    {
      name: 'BadRequestError',
      message: /Cựu thành viên không được phân công/,
    }
  );

  // Cố tình gán người chưa đủ điều kiện làm trực chính -> Bị chặn 400
  await assert.rejects(
    async () => {
      await manualEditSchedule(
        db,
        'sched-test-01',
        {
          assignees: [
            { memberId: 'mem-sup-1', dutyType: DUTY_TYPES.MAIN, assignedRole: ASSIGNED_ROLES.CASH_DRAWER },
          ],
        },
        'user-admin'
      );
    },
    {
      name: 'BadRequestError',
      message: /chưa hoàn thành đào tạo/,
    }
  );
});
