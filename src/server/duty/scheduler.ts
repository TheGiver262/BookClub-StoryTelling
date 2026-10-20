/**
 * YSBK Shift Scheduler & Validator (Chặng 15: R11 Fixed)
 * R11: Main phải đủ đào tạo, active, không phải cựu, rảnh cả 14–17 lẫn mở/đóng ca (13:45–17:15).
 * Dưới 3 helper bắt buộc phải có warning riêng.
 * Validator dùng chung cho cả Auto-solver lẫn Manual-edit.
 */

import {
  type DutyMemberCandidate,
  type MemberBusyWindow,
  type ShiftValidationResult,
  type AssignedRole,
  ASSIGNED_ROLES,
  POLICY_LABELS,
} from './roster-types.ts';

// Khung giờ trực chuẩn (phút từ 00:00)
export const TIME_BOUNDS = {
  // Khoảng chuẩn bị trước ca
  OPENING_START: 13 * 60 + 45, // 13:45
  OPENING_END: 14 * 60 + 15,   // 14:15
  // Khoảng phục vụ bạn đọc chính
  CORE_START: 14 * 60,         // 14:00
  CORE_END: 17 * 60,           // 17:00
  // Khoảng thu dọn kết ca (17:00 - 17:15 [GIẢ ĐỊNH / CHƯA CHỐT POLICY])
  CLOSING_START: 16 * 60 + 45, // 16:45
  CLOSING_END: 17 * 60 + 15,   // 17:15
  // Khoảng toàn bộ ca trực chính bắt buộc phải rảnh
  MAIN_MANDATORY_START: 13 * 60 + 45, // 13:45
  MAIN_MANDATORY_END: 17 * 60 + 15,   // 17:15
};

export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function isIntervalOverlapping(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Kiểm tra xem thành viên có bận trong khoảng thời gian [startMinutes, endMinutes] hay không
 */
export function isMemberBusyInRange(
  memberId: string,
  startMinutes: number,
  endMinutes: number,
  busyWindows: MemberBusyWindow[]
): boolean {
  for (const w of busyWindows) {
    if (w.memberId !== memberId) continue;
    const wStart = timeStringToMinutes(w.startTime);
    const wEnd = timeStringToMinutes(w.endTime);
    if (isIntervalOverlapping(startMinutes, endMinutes, wStart, wEnd)) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra điều kiện Trực chính (R11):
 * - Active, không phải cựu
 * - Đã qua đào tạo / đủ điều kiện trực chính (isEligibleMain)
 * - Rảnh TOÀN BỘ 13:45 - 17:15 (cả khoảng mở, giữa và thu dọn)
 */
export function isMemberEligibleForMain(
  member: DutyMemberCandidate,
  busyWindows: MemberBusyWindow[]
): { eligible: boolean; reason?: string } {
  if (!member.isActive) {
    return { eligible: false, reason: 'Thành viên đang không ở trạng thái hoạt động (inactive)' };
  }
  if (member.isAlumni) {
    return { eligible: false, reason: 'Cựu thành viên không được phân công trực bàn sách' };
  }
  if (!member.isEligibleMain) {
    return { eligible: false, reason: 'Thành viên chưa hoàn thành đào tạo kỹ năng trực chính' };
  }
  // R11: Phải rảnh toàn bộ 13:45 - 17:15 (cả khoảng phục vụ 14-17 và đầu/cuối ca)
  if (isMemberBusyInRange(member.id, TIME_BOUNDS.MAIN_MANDATORY_START, TIME_BOUNDS.MAIN_MANDATORY_END, busyWindows)) {
    return { eligible: false, reason: 'Thành viên bị vướng lịch bận trong khung giờ trực chính (13:45 - 17:15)' };
  }
  return { eligible: true };
}

/**
 * Kiểm tra điều kiện Trực hỗ trợ (R11):
 * - Active, không phải cựu
 * - Rảnh lúc mở ca (13:45 - 14:15) HOẶC rảnh lúc đóng ca (16:45 - 17:15)
 * - Có thể bận giữa ca (ví dụ 14:30 - 16:30) vẫn hợp lệ
 */
export function isMemberEligibleForSupport(
  member: DutyMemberCandidate,
  busyWindows: MemberBusyWindow[]
): { eligible: boolean; reason?: string } {
  if (!member.isActive) {
    return { eligible: false, reason: 'Thành viên không hoạt động' };
  }
  if (member.isAlumni) {
    return { eligible: false, reason: 'Cựu thành viên không được trực hỗ trợ' };
  }
  const busyOpening = isMemberBusyInRange(member.id, TIME_BOUNDS.OPENING_START, TIME_BOUNDS.OPENING_END, busyWindows);
  const busyClosing = isMemberBusyInRange(member.id, TIME_BOUNDS.CLOSING_START, TIME_BOUNDS.CLOSING_END, busyWindows);

  if (busyOpening && busyClosing) {
    return { eligible: false, reason: 'Thành viên bận cả lúc mở ca (13:45-14:15) và lúc đóng ca (16:45-17:15)' };
  }
  return { eligible: true };
}

/**
 * Bộ kiểm tra dùng chung (Shared Validator) cho cả Auto-solver và Manual Edit (R11)
 */
export function validateShiftAssignment(
  mainCandidates: DutyMemberCandidate[],
  supportCandidates: DutyMemberCandidate[],
  busyWindows: MemberBusyWindow[]
): ShiftValidationResult {
  const errors: string[] = [];

  // Kiểm tra trùng lặp giữa trực chính và hỗ trợ
  const mainIds = new Set(mainCandidates.map((m) => m.id));
  for (const s of supportCandidates) {
    if (mainIds.has(s.id)) {
      errors.push(`Thành viên ${s.fullName} (${s.id}) bị xếp trùng cả trực chính và trực hỗ trợ.`);
    }
  }

  // Kiểm tra điều kiện trực chính
  for (const m of mainCandidates) {
    const res = isMemberEligibleForMain(m, busyWindows);
    if (!res.eligible) {
      errors.push(`Trực chính ${m.fullName}: ${res.reason}`);
    }
  }

  // Kiểm tra điều kiện trực hỗ trợ
  for (const s of supportCandidates) {
    const res = isMemberEligibleForSupport(s, busyWindows);
    if (!res.eligible) {
      errors.push(`Trực hỗ trợ ${s.fullName}: ${res.reason}`);
    }
  }

  // Cảnh báo riêng biệt thiếu nhân sự (R11)
  let warningMain: string | null = null;
  if (mainCandidates.length < 2) {
    warningMain = `Thiếu người trực chính: chỉ có ${mainCandidates.length}/2 người đủ điều kiện!`;
  }

  let warningSupport: string | null = null;
  if (supportCandidates.length < 3) {
    warningSupport = `Thiếu người trực hỗ trợ: chỉ có ${supportCandidates.length}/3 người (dưới mức tối thiểu 3 người)!`;
  }

  return {
    isValid: errors.length === 0,
    mainDuty: mainCandidates,
    supportDuty: supportCandidates,
    warningMain,
    warningSupport,
    errors,
  };
}

/**
 * Thuật toán Auto-solver xếp lịch cho 1 ca trực (Thứ 3 hoặc Thứ 5)
 */
export function solveShiftSchedule(
  allMembers: DutyMemberCandidate[],
  busyWindowsForDay: MemberBusyWindow[]
): {
  mainDuty: DutyMemberCandidate[];
  supportDuty: DutyMemberCandidate[];
  warningMain: string | null;
  warningSupport: string | null;
} {
  // 1. Lọc và xếp hạng ứng viên Trực chính (Soft Fairness: ít ca trực chính hơn đứng trước)
  const eligibleMains: DutyMemberCandidate[] = [];
  for (const m of allMembers) {
    if (isMemberEligibleForMain(m, busyWindowsForDay).eligible) {
      eligibleMains.push(m);
    }
  }

  eligibleMains.sort((a, b) => {
    if (a.assignedMainShiftsCount !== b.assignedMainShiftsCount) {
      return a.assignedMainShiftsCount - b.assignedMainShiftsCount;
    }
    const totalA = a.assignedMainShiftsCount + a.assignedSupportShiftsCount;
    const totalB = b.assignedMainShiftsCount + b.assignedSupportShiftsCount;
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    return a.id.localeCompare(b.id);
  });

  const chosenMains = eligibleMains.slice(0, 2);
  const chosenMainIds = new Set(chosenMains.map((m) => m.id));

  // 2. Lọc và xếp hạng ứng viên Trực hỗ trợ (Soft Fairness: tổng số ca ít hơn đứng trước)
  const eligibleSupports: DutyMemberCandidate[] = [];
  for (const m of allMembers) {
    if (chosenMainIds.has(m.id)) continue;
    if (isMemberEligibleForSupport(m, busyWindowsForDay).eligible) {
      eligibleSupports.push(m);
    }
  }

  eligibleSupports.sort((a, b) => {
    const totalA = a.assignedMainShiftsCount + a.assignedSupportShiftsCount;
    const totalB = b.assignedMainShiftsCount + b.assignedSupportShiftsCount;
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    if (a.assignedSupportShiftsCount !== b.assignedSupportShiftsCount) {
      return a.assignedSupportShiftsCount - b.assignedSupportShiftsCount;
    }
    return a.id.localeCompare(b.id);
  });

  // Chọn từ 3 đến 5 hỗ trợ (nếu có < 3 thì lấy hết và cảnh báo)
  const chosenSupports = eligibleSupports.slice(0, Math.min(5, Math.max(0, eligibleSupports.length)));

  const validation = validateShiftAssignment(chosenMains, chosenSupports, busyWindowsForDay);

  return {
    mainDuty: chosenMains,
    supportDuty: chosenSupports,
    warningMain: validation.warningMain || null,
    warningSupport: validation.warningSupport || null,
  };
}

/**
 * Tự động gán 4 vai trò cụ thể cho ca trực:
 * 1. CASH_DRAWER: Kiểm tiền quầy két (Main 1)
 * 2. CIRCULATION_LOG: Ghi sổ mượn trả (Main 2)
 * 3. LOGISTICS_SETUP: Chuẩn bị bàn trực & bàn giao (Support 1 & Support 3+)
 * 4. BOOK_INTRO: Giới thiệu sách (Support 2)
 */
export function assignSpecificRoles(
  mains: Array<{ memberId: string }>,
  supports: Array<{ memberId: string }>
): Array<{ memberId: string; dutyType: 'MAIN' | 'SUPPORT'; assignedRole: AssignedRole }> {
  const result: Array<{ memberId: string; dutyType: 'MAIN' | 'SUPPORT'; assignedRole: AssignedRole }> = [];

  mains.forEach((m, idx) => {
    const role: AssignedRole = idx === 0 ? ASSIGNED_ROLES.CASH_DRAWER : ASSIGNED_ROLES.CIRCULATION_LOG;
    result.push({ memberId: m.memberId, dutyType: 'MAIN', assignedRole: role });
  });

  supports.forEach((s, idx) => {
    let role: AssignedRole = ASSIGNED_ROLES.LOGISTICS_SETUP;
    if (idx === 1) {
      role = ASSIGNED_ROLES.BOOK_INTRO;
    }
    result.push({ memberId: s.memberId, dutyType: 'SUPPORT', assignedRole: role });
  });

  return result;
}

/**
 * Soạn thảo nội dung mẫu đăng Facebook (chỉ sinh văn bản, không gọi API mạng thật)
 */
export function composeFacebookPostContent(params: {
  scheduleDate: string; // YYYY-MM-DD
  dayOfWeek: string;    // 'THU_BA' | 'THU_NAM'
  shiftTime?: string;
  location?: string;
  mains: Array<{ fullName: string; role: AssignedRole }>;
  supports: Array<{ fullName: string; role: AssignedRole }>;
}): string {
  const dayLabel = params.dayOfWeek === 'THU_BA' ? 'Thứ Ba' : 'Thứ Năm';
  const roleNameMap: Record<AssignedRole, string> = {
    [ASSIGNED_ROLES.CASH_DRAWER]: 'Kiểm tiền quầy & két',
    [ASSIGNED_ROLES.CIRCULATION_LOG]: 'Ghi sổ mượn trả',
    [ASSIGNED_ROLES.BOOK_INTRO]: 'Giới thiệu & tư vấn sách',
    [ASSIGNED_ROLES.LOGISTICS_SETUP]: 'Chuẩn bị bàn trực & bàn giao',
  };

  const mainsStr = params.mains
    .map((m) => `  • ${m.fullName} (${roleNameMap[m.role]})`)
    .join('\n');

  const supportsStr = params.supports
    .map((s) => `  • ${s.fullName} (${roleNameMap[s.role]})`)
    .join('\n');

  return `[YSBK] LỊCH TRỰC BÀN SÁCH - ${dayLabel}, ngày ${params.scheduleDate}

⏰ Thời gian: ${params.shiftTime || POLICY_LABELS.SHIFT_TIME_FULL}
📍 Địa điểm: ${params.location || POLICY_LABELS.LOCATION_DEFAULT}

👤 THÀNH VIÊN TRỰC CHÍNH:
${mainsStr || '  (Đang cập nhật)'}

👥 THÀNH VIÊN TRỰC HỖ TRỢ:
${supportsStr || '  (Đang cập nhật)'}

📚 Bạn đọc có nhu cầu mượn - trả sách, đặt cọc hoặc gia hạn sách xin mời ghé bàn trực của CLB Sách Bách Khoa trong khung giờ trên nhé!
🔗 Tra cứu danh mục sách online: https://ysbk.club/tra-cuu

#CLBSachBachKhoa #YSBK #LichTrucBanSach`;
}
