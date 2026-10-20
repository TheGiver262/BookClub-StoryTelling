"""
YSBK Technical PoC Test Suite: Schedule Availability Parser & Input Validation
Kiểm chứng kỹ thuật bộ parser lịch bận của Ban Hậu Cần:
- Quy tắc an toàn: Dòng parse lỗi hoặc dữ liệu bất thường KHÔNG BAO GIỜ tự động mặc định thành "rảnh"
- Kiểm tra tiếng Việt có dấu, chuẩn hóa ngày Thứ Ba / Thứ Năm
- Đo lường hiệu năng xử lý (CPU/latency) cho quy mô CLB
"""

import time
import unittest
from typing import Dict, List, Any, Optional

class ScheduleParser:
    VALID_DAYS = {"THU_BA", "THU_NAM", "TUE", "THU", "THỨ 3", "THỨ 5", "THỨ BA", "THỨ NĂM"}

    @classmethod
    def normalize_day(cls, day_str: str) -> Optional[str]:
        if not day_str:
            return None
        cleaned = day_str.strip().upper()
        if cleaned in {"THU_BA", "TUE", "THỨ 3", "THỨ BA"}:
            return "TUE"
        if cleaned in {"THU_NAM", "THU", "THỨ 5", "THỨ NĂM"}:
            return "THU"
        return None

    @classmethod
    def parse_time_slot_string(cls, busy_slots_str: str) -> Dict[str, bool]:
        """
        busy_slots_str: chuỗi tiết học hoặc giờ bận, ví dụ: '14h-16h', 'Tiết 7-9 (12h30-15h)', 'Rảnh', 'Bận cả chiều'
        Trả về:
          free_full_14_17: bool
          free_opening_and_closing: bool
          has_parse_error: bool
        """
        if busy_slots_str is None:
            # QUY TẮC AN TOÀN: Thiếu dữ liệu thì COI LÀ BẬN (Không được thành rảnh)
            return {"free_full": False, "free_open_close": False, "has_error": True, "reason": "Dữ liệu trống"}

        val = busy_slots_str.strip().lower()
        if not val:
            return {"free_full": False, "free_open_close": False, "has_error": True, "reason": "Chuỗi rỗng"}

        # TH1: Rảnh hoàn toàn
        if val in {"rảnh", "ranh", "rảnh cả chiều", "free", "không bận", "ok"}:
            return {"free_full": True, "free_open_close": True, "has_error": False}

        # TH2: Bận hoàn toàn
        if val in {"bận", "ban", "bận cả chiều", "busy", "học cả chiều"}:
            return {"free_full": False, "free_open_close": False, "has_error": False}

        # TH3: Bận giữa ca (ví dụ bận từ 14h30 - 16h30, rảnh đầu và cuối ca)
        if "bận giữa" in val or "học 14h30-16h30" in val or "tiết 9-10" in val:
            return {"free_full": False, "free_open_close": True, "has_error": False}

        # TH4: Bận đầu ca (ví dụ học 12h30 - 15h00)
        if "bận đầu" in val or "học đến 15h" in val or "tiết 7-9" in val:
            return {"free_full": False, "free_open_close": False, "has_error": False}

        # TH5: Dòng định dạng lạ / lỗi cú pháp -> CẢNH BÁO LỖI, COI LÀ BẬN
        return {
            "free_full": False, 
            "free_open_close": False, 
            "has_error": True, 
            "reason": f"Định dạng tiết học không hợp lệ: '{busy_slots_str}'"
        }

    @classmethod
    def process_matrix_row(cls, row: Dict[str, Any]) -> Dict[str, Any]:
        """Xử lý một dòng bản ghi từ file Excel tổng hợp của Hậu cần."""
        member_id = row.get("member_id")
        raw_day = row.get("day")
        busy_info = row.get("busy_info")

        day_norm = cls.normalize_day(raw_day)
        if not day_norm:
            return {
                "member_id": member_id,
                "status": "REJECTED",
                "error": f"Ngày '{raw_day}' không thuộc ngày trực bàn CLB (chỉ nhận Thứ Ba / Thứ Năm)"
            }

        slot_eval = cls.parse_time_slot_string(busy_info)
        return {
            "member_id": member_id,
            "day": day_norm,
            "status": "ERROR" if slot_eval["has_error"] else "VALID",
            "free_full": slot_eval["free_full"],
            "free_open_close": slot_eval["free_open_close"],
            "error": slot_eval.get("reason")
        }

class TestScheduleParser(unittest.TestCase):
    def test_01_parse_valid_vietnamese_inputs(self):
        """Kiểm chứng parse chuỗi tiếng Việt có dấu chuẩn xác."""
        self.assertEqual(ScheduleParser.normalize_day("Thứ Ba"), "TUE")
        self.assertEqual(ScheduleParser.normalize_day("Thứ 5"), "THU")
        self.assertEqual(ScheduleParser.normalize_day("thứ năm"), "THU")
        self.assertIsNone(ScheduleParser.normalize_day("Thứ Hai")) # Không phải ngày trực bàn

    def test_02_safety_rule_errors_do_not_become_free(self):
        """
        BẤT BIẾN AN TOÀN TUYỆT ĐỐI:
        Dòng dữ liệu lỗi, rác hoặc định dạng lạ KHÔNG ĐƯỢC tự động biến thành 'Rảnh'.
        Phải đánh dấu lỗi và mặc định là BẬN.
        """
        corrupted_inputs = ["???", "lịch chưa chốt", "null", "---", None, ""]
        for bad_input in corrupted_inputs:
            with self.subTest(bad_input=bad_input):
                res = ScheduleParser.parse_time_slot_string(bad_input)
                self.assertFalse(res["free_full"], f"Lỗi không được thành rảnh cho: {bad_input}")
                self.assertFalse(res["free_open_close"], f"Lỗi không được thành rảnh hỗ trợ cho: {bad_input}")
                self.assertTrue(res["has_error"], f"Phải báo lỗi cú pháp cho: {bad_input}")

    def test_03_partial_busy_middle_slot(self):
        """Kiểm chứng bận giữa ca (14h30-16h30): không đủ đk trực chính, nhưng đủ đk trực hỗ trợ."""
        res = ScheduleParser.parse_time_slot_string("Học 14h30-16h30 (bận giữa)")
        self.assertFalse(res["free_full"], "Bận giữa ca không được tính là rảnh full để trực chính!")
        self.assertTrue(res["free_open_close"], "Rảnh đầu và cuối ca phải đủ điều kiện trực hỗ trợ!")
        self.assertFalse(res["has_error"])

    def test_04_performance_and_throughput(self):
        """Đo lường thời gian thực thi (Latency) khi xử lý ma trận 1.000 dòng."""
        sample_rows = [
            {"member_id": f"TV_{i:04d}", "day": "Thứ Ba", "busy_info": "Rảnh"} if i % 3 == 0
            else {"member_id": f"TV_{i:04d}", "day": "Thứ Năm", "busy_info": "Học 14h30-16h30"} if i % 3 == 1
            else {"member_id": f"TV_{i:04d}", "day": "Thứ Ba", "busy_info": "Bận cả chiều"}
            for i in range(1000)
        ]

        t0 = time.perf_counter()
        results = [ScheduleParser.process_matrix_row(row) for row in sample_rows]
        elapsed_ms = (time.perf_counter() - t0) * 1000

        self.assertEqual(len(results), 1000)
        # Yêu cầu tốc độ: Xử lý 1.000 dòng trong dưới 50ms ở môi trường Python chuẩn
        self.assertLess(elapsed_ms, 50.0, f"Thời gian xử lý quá lâu: {elapsed_ms:.2f}ms")
        print(f"  [MEASUREMENT] Processed 1,000 schedule records in {elapsed_ms:.2f} ms ({len(results)/elapsed_ms*1000:.0f} rows/sec).")

if __name__ == "__main__":
    unittest.main()
