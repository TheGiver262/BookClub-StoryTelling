-- =====================================================================
-- Migration 03: Chặng 11 - Lost Book & Document Correction
-- Hệ thống Quản lý Câu lạc bộ Yêu Sách Bách Khoa Hà Nội
-- Ngày tạo: 19/10/2026. Múi giờ: Asia/Ho_Chi_Minh
-- =====================================================================

-- 1. Nâng cấp ENUMS: Thêm giá trị 'LOST' cho enum loan_status
DO $$ BEGIN
    ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'LOST';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Nâng cấp bảng loan_items (FR-01, FR-07 - Báo mất sách)
ALTER TABLE loan_items ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ NULL;
ALTER TABLE loan_items ADD COLUMN IF NOT EXISTS lost_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_items_lost 
ON loan_items(is_lost) 
WHERE is_lost = TRUE;

-- 3. Nâng cấp bảng loan_settlements: Cho phép settlement_type = 'LOST'
DO $$ BEGIN
    ALTER TABLE loan_settlements DROP CONSTRAINT IF EXISTS loan_settlements_settlement_type_check;
    ALTER TABLE loan_settlements ADD CONSTRAINT loan_settlements_settlement_type_check 
        CHECK (settlement_type IN ('FULL', 'PARTIAL', 'LOST'));
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- 4. S10-07: Backfill chuẩn xác dữ liệu phạt chờ thu (fine pending) từ Stage 09/10
-- Đối với các dòng chưa thu đủ phạt (fine_final > fine_collected) và không bị cấn trừ cọc (deposit_forfeited = 0)
UPDATE loan_settlements
SET 
    fine_pending_amount = (fine_final - fine_collected),
    fine_status = CASE 
        WHEN (fine_final - fine_collected) > 0 THEN 'PENDING'
        WHEN fine_final = 0 AND fine_suggested > 0 THEN 'WAIVED'
        ELSE 'COLLECTED'
    END
WHERE fine_status = 'COLLECTED' 
  AND fine_pending_amount = 0 
  AND fine_final > fine_collected 
  AND deposit_forfeited = 0;

-- 5. Nâng cấp chỉ mục hỗ trợ truy vết đảo bút toán (Document Correction / Reversal)
CREATE INDEX IF NOT EXISTS idx_journal_entries_reversal_of 
ON journal_entries(reversal_of_entry_id) 
WHERE reversal_of_entry_id IS NOT NULL;
