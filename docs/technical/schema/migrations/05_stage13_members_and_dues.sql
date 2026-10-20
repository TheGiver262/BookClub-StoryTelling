-- =============================================================================
-- Migration 05: Stage 13 - Members, Multi-department Affiliations & One-time Dues
-- =============================================================================

-- 1. Bảng quan hệ ban và lịch sử chức vụ theo thời gian (FR-02, FR-09)
-- Cho phép 1 người thuộc nhiều ban đồng thời (ví dụ: Trưởng Hậu Cần + BCN).
-- Headcount khi đếm tổng không bao giờ trùng người nhờ COUNT(DISTINCT member_id).
CREATE TABLE IF NOT EXISTS member_affiliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL, -- 'BAN_HAU_CAN', 'BAN_NOI_DUNG', 'BAN_TTDN', 'BAN_CHU_NHIEM'
    role VARCHAR(50) NOT NULL,       -- 'TRUONG_BAN', 'PHO_BAN', 'THANH_VIEN', 'CHU_NHIEM', 'PHO_CHU_NHIEM', 'UY_VIEN_BCN'
    term_year VARCHAR(20) NOT NULL,  -- '2024-2025', '2025-2026'
    start_date DATE NOT NULL,
    end_date DATE NULL,              -- NULL nếu đang đương nhiệm
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_affiliations_member ON member_affiliations(member_id);
CREATE INDEX IF NOT EXISTS idx_member_affiliations_dept ON member_affiliations(department);
CREATE INDEX IF NOT EXISTS idx_member_affiliations_current ON member_affiliations(is_current);

-- 2. Bảng biên nhận thu hội phí một lần (FR-02, FR-04, FR-09)
-- Hội phí thành viên khoảng 100.000₫ thực thu MỘT LẦN DUY NHẤT trong đời hoạt động tại CLB.
-- Không tự động thu lại vào năm sau. Khóa bằng UNIQUE constraint (member_id).
CREATE TABLE IF NOT EXISTS membership_dues_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount NUMERIC(15,0) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
    payment_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    cash_session_id VARCHAR(50) REFERENCES cash_sessions(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    collected_by UUID NOT NULL REFERENCES members(id),
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    term_label VARCHAR(100) NOT NULL, -- e.g. 'Khóa K69 - Năm học 2024-2025'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_member_one_time_dues UNIQUE (member_id)
);

CREATE INDEX IF NOT EXISTS idx_dues_receipts_member ON membership_dues_receipts(member_id);
CREATE INDEX IF NOT EXISTS idx_dues_receipts_number ON membership_dues_receipts(receipt_number);
