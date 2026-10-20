"""
YSBK Technical PoC Test Suite: Shift Scheduler, Availability Constraints, and Fairness
Kiểm chứng thuật toán đề xuất phân ca trực bàn:
- 2 trực chính (đủ điều kiện, rảnh toàn thời gian 14:00 - 17:00)
- 3-5 trực hỗ trợ (rảnh lúc mở 14:00-14:30 và đóng 16:30-17:00, có thể bận giữa ca)
- Cựu thành viên không được xếp ca
- Công bằng mềm (Fairness) chia đều số ca trực chính và ca hỗ trợ giữa các thành viên
- Bắt lỗi và cảnh báo khi thiếu người trực chính
"""

import unittest
from typing import List, Dict, Optional

class Member:
    def __init__(self, id: str, name: str, is_active: bool, is_alumni: bool, is_eligible_main: bool):
        self.id = id
        self.name = name
        self.is_active = is_active
        self.is_alumni = is_alumni
        self.is_eligible_main = is_eligible_main
        self.assigned_main_shifts = 0
        self.assigned_support_shifts = 0

    @property
    def total_shifts(self) -> int:
        return self.assigned_main_shifts + self.assigned_support_shifts

class Availability:
    def __init__(self, member_id: str, day_of_week: str, free_full_14_17: bool, free_opening_and_closing: bool):
        self.member_id = member_id
        self.day_of_week = day_of_week  # 'TUE', 'THU'
        self.free_full_14_17 = free_full_14_17
        self.free_opening_and_closing = free_opening_and_closing

class ShiftProposalResult:
    def __init__(self, day: str):
        self.day = day
        self.main_duty: List[Member] = []
        self.support_duty: List[Member] = []
        self.warning: Optional[str] = None

class DutyScheduler:
    def __init__(self, members: Dict[str, Member], availabilities: List[Availability]):
        self.members = members
        self.availabilities = availabilities

    def propose_schedule_for_day(self, day: str) -> ShiftProposalResult:
        result = ShiftProposalResult(day)
        
        # 1. Lọc danh sách thành viên hợp lệ (Active, KHÔNG PHẢI cựu)
        valid_members = {
            m_id: m for m_id, m in self.members.items() 
            if m.is_active and not m.is_alumni
        }

        # 2. Tìm ứng viên trực chính: Đủ điều kiện + Rảnh toàn bộ 14:00 - 17:00 VÀ rảnh cả đầu/cuối ca (R11)
        avail_day = {a.member_id: a for a in self.availabilities if a.day_of_week == day}
        
        eligible_main = [
            m for m in valid_members.values()
            if m.is_eligible_main and avail_day.get(m.id) and avail_day[m.id].free_full_14_17 and avail_day[m.id].free_opening_and_closing
        ]
        
        # Sắp xếp ưu tiên: người có ít ca trực chính hơn đứng trước, sau đó tới tổng số ca (Soft fairness)
        eligible_main.sort(key=lambda m: (m.assigned_main_shifts, m.total_shifts))
        
        warnings = []
        if len(eligible_main) < 2:
            warnings.append(f"Thiếu người trực chính cho ngày {day}: chỉ có {len(eligible_main)}/2 người đủ điều kiện!")
            result.main_duty = eligible_main
        else:
            result.main_duty = eligible_main[:2]

        for m in result.main_duty:
            m.assigned_main_shifts += 1

        chosen_ids = {m.id for m in result.main_duty}

        # 3. Tìm ứng viên trực hỗ trợ: Rảnh mở (14h) & đóng (16h30)
        eligible_support = [
            m for m in valid_members.values()
            if m.id not in chosen_ids and avail_day.get(m.id) and avail_day[m.id].free_opening_and_closing
        ]
        
        # Sắp xếp theo tổng số ca trực (Fairness)
        eligible_support.sort(key=lambda m: (m.total_shifts, m.assigned_support_shifts))
        
        # Chọn từ 3 đến 5 người. Dưới 3 người bắt buộc phải cảnh báo thiếu (R11)
        if len(eligible_support) < 3:
            warnings.append(f"Thiếu người trực hỗ trợ cho ngày {day}: chỉ có {len(eligible_support)}/3 người (dưới mức tối thiểu 3 người)!")
            result.support_duty = eligible_support
        else:
            needed = min(5, len(eligible_support))
            result.support_duty = eligible_support[:needed]
        
        for m in result.support_duty:
            m.assigned_support_shifts += 1

        if warnings:
            result.warning = "; ".join(warnings)

        return result

class TestDutyScheduler(unittest.TestCase):
    def setUp(self):
        # 8 thành viên hoạt động
        self.members = {
            "M1": Member("M1", "Nguyễn Văn An", is_active=True, is_alumni=False, is_eligible_main=True),
            "M2": Member("M2", "Trần Thị Bình", is_active=True, is_alumni=False, is_eligible_main=True),
            "M3": Member("M3", "Lê Văn Cường", is_active=True, is_alumni=False, is_eligible_main=True),
            "M4": Member("M4", "Phạm Thị Dung", is_active=True, is_alumni=False, is_eligible_main=False), # Chưa đủ đk trực chính
            "M5": Member("M5", "Hoàng Văn Em", is_active=True, is_alumni=False, is_eligible_main=False),
            "M6": Member("M6", "Vũ Thị Giang", is_active=True, is_alumni=False, is_eligible_main=False),
            "M7": Member("M7", "Đặng Văn Hùng", is_active=True, is_alumni=False, is_eligible_main=False),
            "M8": Member("M8", "Bùi Thị Lan", is_active=True, is_alumni=False, is_eligible_main=False),
            # Cựu thành viên (tuyệt đối không được xếp)
            "M_ALUMNI": Member("M_ALUMNI", "Anh Cựu K60", is_active=True, is_alumni=True, is_eligible_main=True),
        }

    def test_01_standard_shift_proposal(self):
        """Kiểm chứng đề xuất ca trực chuẩn Thứ Ba: 2 chính (14-17), 3-5 hỗ trợ."""
        availabilities = [
            # M1, M2, M3 rảnh full
            Availability("M1", "TUE", free_full_14_17=True, free_opening_and_closing=True),
            Availability("M2", "TUE", free_full_14_17=True, free_opening_and_closing=True),
            Availability("M3", "TUE", free_full_14_17=True, free_opening_and_closing=True),
            # M4, M5, M6, M7 rảnh mở và đóng
            Availability("M4", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            Availability("M5", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            Availability("M6", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            Availability("M7", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            # Cựu thành viên rảnh full
            Availability("M_ALUMNI", "TUE", free_full_14_17=True, free_opening_and_closing=True),
        ]

        scheduler = DutyScheduler(self.members, availabilities)
        proposal = scheduler.propose_schedule_for_day("TUE")

        # 1. Đúng 2 trực chính
        self.assertEqual(len(proposal.main_duty), 2)
        for m in proposal.main_duty:
            self.assertTrue(m.is_eligible_main, f"{m.name} phải đủ điều kiện trực chính!")
            self.assertFalse(m.is_alumni, "Cựu thành viên không được phép trực chính!")

        # 2. Từ 3 đến 5 hỗ trợ
        self.assertTrue(3 <= len(proposal.support_duty) <= 5)
        for m in proposal.support_duty:
            self.assertFalse(m.is_alumni, "Cựu thành viên không được phép trực hỗ trợ!")

        # 3. Không trùng lặp người giữa chính và hỗ trợ
        main_ids = {m.id for m in proposal.main_duty}
        support_ids = {m.id for m in proposal.support_duty}
        self.assertEqual(len(main_ids.intersection(support_ids)), 0)

    def test_02_fairness_distribution_across_multiple_days(self):
        """Kiểm chứng độ công bằng mềm (Fairness): luân phiên ca trực chính giữa M1, M2, M3 qua nhiều buổi."""
        # Giả lập lịch rảnh giống nhau cho cả Thứ Ba và Thứ Năm
        availabilities = []
        for day in ["TUE", "THU"]:
            for m_id in ["M1", "M2", "M3"]:
                availabilities.append(Availability(m_id, day, True, True))
            for m_id in ["M4", "M5", "M6", "M7", "M8"]:
                availabilities.append(Availability(m_id, day, False, True))

        scheduler = DutyScheduler(self.members, availabilities)
        
        # Xếp ca Thứ Ba: M1 và M2 được chọn làm trực chính (đều có assigned_main_shifts = 0 ban đầu)
        p_tue = scheduler.propose_schedule_for_day("TUE")
        tue_mains = {m.id for m in p_tue.main_duty}
        self.assertEqual(len(tue_mains), 2)

        # Xếp ca Thứ Năm
        p_thu = scheduler.propose_schedule_for_day("THU")
        thu_mains = {m.id for m in p_thu.main_duty}

        # Bất biến công bằng: M3 (chưa có ca trực chính nào) BẮT BUỘC phải được chọn làm trực chính vào Thứ Năm!
        self.assertIn("M3", thu_mains, "Thành viên M3 chưa trực chính ca nào phải được ưu tiên chọn trực chính Thứ Năm!")

    def test_03_warning_on_understaffed_shift(self):
        """Kiểm chứng phát hiện và cảnh báo khi không đủ 2 người trực chính."""
        # Chỉ có 1 người đủ điều kiện rảnh
        availabilities = [
            Availability("M1", "TUE", free_full_14_17=True, free_opening_and_closing=True),
            Availability("M4", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            Availability("M5", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            Availability("M6", "TUE", free_full_14_17=False, free_opening_and_closing=True),
        ]

        scheduler = DutyScheduler(self.members, availabilities)
        proposal = scheduler.propose_schedule_for_day("TUE")

        self.assertIsNotNone(proposal.warning)
        self.assertIn("Thiếu người trực chính", proposal.warning)
        self.assertEqual(len(proposal.main_duty), 1)

    def test_04_r11_repro_main_busy_at_bounds_and_two_support_warning(self):
        """R11 Repro:
        - Main rảnh 14-17 nhưng bận đầu/cuối (free_opening_and_closing=False) phải bị loại khỏi trực chính!
        - Chỉ có 2 helper rảnh (<3 helper) bắt buộc phải có warning thiếu trực hỗ trợ (không được warning=None)!
        """
        availabilities = [
            # M1, M2 rảnh 14-17 nhưng bận đầu/cuối -> KHÔNG ĐƯỢC CHỌN LÀM MAIN
            Availability("M1", "TUE", free_full_14_17=True, free_opening_and_closing=False),
            Availability("M2", "TUE", free_full_14_17=True, free_opening_and_closing=False),
            # Chỉ có 2 helper rảnh
            Availability("M4", "TUE", free_full_14_17=False, free_opening_and_closing=True),
            Availability("M5", "TUE", free_full_14_17=False, free_opening_and_closing=True),
        ]

        scheduler = DutyScheduler(self.members, availabilities)
        proposal = scheduler.propose_schedule_for_day("TUE")

        # M1 và M2 bị loại vì bận đầu/cuối -> len(proposal.main_duty) == 0
        self.assertEqual(len(proposal.main_duty), 0, "Main rảnh 14-17 nhưng bận đầu/cuối phải bị loại!")
        self.assertIsNotNone(proposal.warning)
        self.assertIn("Thiếu người trực chính", proposal.warning)
        # Chỉ có 2 helper rảnh -> bắt buộc phải cảnh báo thiếu trực hỗ trợ
        self.assertIn("hỗ trợ", proposal.warning)

if __name__ == "__main__":
    unittest.main()
