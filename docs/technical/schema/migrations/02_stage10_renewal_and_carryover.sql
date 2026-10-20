-- =====================================================================
-- Migration 02: Chặng 10 - Loan Renewal, Due Date Calendar & Carryover Fixes
-- Hệ thống Quản lý Câu lạc bộ Yêu Sách Bách Khoa Hà Nội
-- Ngày tạo: 19/10/2026. Múi giờ: Asia/Ho_Chi_Minh
-- =====================================================================

-- 1. Nâng cấp ENUMS (S09-02)
DO $$ BEGIN
    ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'PENDING_DEPOSIT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE deposit_status ADD VALUE IF NOT EXISTS 'PENDING_COLLECTION';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Nâng cấp loan_items (S09-01, S09-05)
ALTER TABLE loan_items ADD COLUMN IF NOT EXISTS carried_forward_at TIMESTAMPTZ NULL;
ALTER TABLE loan_items ADD COLUMN IF NOT EXISTS successor_item_id UUID NULL REFERENCES loan_items(id);

-- Cập nhật Partial Unique Index để hỗ trợ dòng sách chuyển tiếp
DROP INDEX IF EXISTS idx_unique_active_copy_loan;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_copy_loan 
ON loan_items (copy_id) 
WHERE returned_at IS NULL AND is_lost = FALSE AND carried_forward_at IS NULL;

-- 3. Nâng cấp loan_receipts (S09-07)
ALTER TABLE loan_receipts ADD COLUMN IF NOT EXISTS preceding_receipt_id UUID NULL REFERENCES loan_receipts(id);

-- 4. Tạo hoặc nâng cấp loan_settlements (S08-05, S09-03)
CREATE TABLE IF NOT EXISTS loan_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES loan_receipts(id) ON DELETE RESTRICT,
    settlement_type VARCHAR(20) NOT NULL CHECK (settlement_type IN ('FULL', 'PARTIAL')),
    return_date DATE NOT NULL,
    overdue_days INT NOT NULL DEFAULT 0,
    fine_suggested BIGINT NOT NULL DEFAULT 0,
    fine_final BIGINT NOT NULL DEFAULT 0,
    fine_reason TEXT NULL,
    fine_collected BIGINT NOT NULL DEFAULT 0,
    fine_pending_amount BIGINT NOT NULL DEFAULT 0,
    fine_status VARCHAR(20) NOT NULL DEFAULT 'COLLECTED' CHECK (fine_status IN ('COLLECTED', 'PENDING', 'WAIVED')),
    fine_payment_method VARCHAR(20) NULL,
    total_deposit BIGINT NOT NULL DEFAULT 0,
    deposit_refunded BIGINT NOT NULL DEFAULT 0,
    deposit_forfeited BIGINT NOT NULL DEFAULT 0,
    deposit_transferred BIGINT NOT NULL DEFAULT 0,
    new_deposit_collected BIGINT NOT NULL DEFAULT 0,
    successor_receipt_id UUID NULL REFERENCES loan_receipts(id),
    cash_session_id VARCHAR(35) NULL,
    settled_by UUID NOT NULL REFERENCES members(id),
    settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loan_settlements ADD COLUMN IF NOT EXISTS fine_pending_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE loan_settlements ADD COLUMN IF NOT EXISTS fine_status VARCHAR(20) NOT NULL DEFAULT 'COLLECTED';

CREATE INDEX IF NOT EXISTS idx_loan_settlements_receipt ON loan_settlements(receipt_id);
CREATE INDEX IF NOT EXISTS idx_loan_settlements_successor ON loan_settlements(successor_receipt_id);

-- 5. Nâng cấp deposit_allocations (S09-07)
ALTER TABLE deposit_allocations ADD COLUMN IF NOT EXISTS transferred_from_allocation_id UUID NULL REFERENCES deposit_allocations(id);

-- 6. Tạo calendar_holidays (S08-08, Chặng 10)
CREATE TABLE IF NOT EXISTS calendar_holidays (
    holiday_date DATE PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tạo bảng loan_renewals (Chặng 10)
CREATE TABLE IF NOT EXISTS loan_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES loan_receipts(id) ON DELETE RESTRICT,
    renewal_sequence SMALLINT NOT NULL CHECK (renewal_sequence BETWEEN 1 AND 3),
    renewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renewed_by UUID NOT NULL REFERENCES members(id),
    previous_due_date DATE NOT NULL,
    new_due_date DATE NOT NULL,
    original_new_due_date DATE NOT NULL,
    adjustment_reason TEXT NULL,
    is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
    overdue_days INT NOT NULL DEFAULT 0,
    fine_suggested BIGINT NOT NULL DEFAULT 0,
    fine_final BIGINT NOT NULL DEFAULT 0,
    fine_reason TEXT NULL,
    fine_collected BIGINT NOT NULL DEFAULT 0,
    fine_pending_amount BIGINT NOT NULL DEFAULT 0,
    fine_status VARCHAR(20) NOT NULL DEFAULT 'COLLECTED' CHECK (fine_status IN ('COLLECTED', 'PENDING', 'WAIVED')),
    fine_payment_method VARCHAR(20) NULL,
    cash_session_id VARCHAR(35) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_receipt_renewal_sequence UNIQUE (receipt_id, renewal_sequence)
);

CREATE INDEX IF NOT EXISTS idx_loan_renewals_receipt ON loan_renewals(receipt_id);
