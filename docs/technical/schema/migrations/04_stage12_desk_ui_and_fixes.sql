-- =====================================================================
-- Migration 04: Chặng 12 - Desk UI Integration & Financial Bounds Safety
-- Hệ thống Quản lý Câu lạc bộ Yêu Sách Bách Khoa Hà Nội
-- Ngày tạo: 19/10/2026. Múi giờ: Asia/Ho_Chi_Minh
-- =====================================================================

-- 1. Nâng cấp chiều dài entry_code lên VARCHAR(64) để phòng thủ chiều sâu (S11-03)
ALTER TABLE journal_entries ALTER COLUMN entry_code TYPE VARCHAR(64);

-- 2. Chỉ mục hỗ trợ tìm kiếm nhanh theo mã bút toán
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_code ON journal_entries(entry_code);

-- 3. S11-10: Chuẩn hóa trạng thái WAIVED cho các khoản phạt cũ được miễn toàn bộ (fine_final = 0 AND fine_suggested > 0)
UPDATE loan_settlements
SET 
    fine_status = 'WAIVED',
    fine_pending_amount = 0
WHERE fine_status != 'WAIVED'
  AND fine_final = 0 
  AND fine_suggested > 0;

-- 4. Bổ sung chỉ mục hỗ trợ tra cứu lịch sử chuyển tiếp và báo mất
CREATE INDEX IF NOT EXISTS idx_loan_items_lost_at ON loan_items(lost_at) WHERE lost_at IS NOT NULL;
