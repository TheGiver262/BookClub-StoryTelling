-- Migration 06: Stage 14 - Duty Availability Import, Batches & Busy Intervals
-- Bảng duty_availability_batches: Lưu các đợt import lịch bận của thành viên
CREATE TABLE IF NOT EXISTS duty_availability_batches (
    id VARCHAR(36) PRIMARY KEY,
    batch_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 chống trùng lặp nội dung
    file_size_bytes BIGINT NOT NULL,
    term_semester VARCHAR(32) NOT NULL, -- Ví dụ: '2025.1' hoặc 'HK1 2025-2026'
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'COMMITTED', -- 'PREVIEWED', 'COMMITTED', 'SUPERSEDED'
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    imported_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tra cứu batch theo kỳ học và version
CREATE INDEX IF NOT EXISTS idx_duty_avail_batches_term_ver 
ON duty_availability_batches(term_semester, version DESC);

-- Bảng member_busy_intervals: Lưu các khoảng giờ bận đã chuẩn hóa
CREATE TABLE IF NOT EXISTS member_busy_intervals (
    id VARCHAR(36) PRIMARY KEY,
    batch_id VARCHAR(36) NOT NULL REFERENCES duty_availability_batches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    day_of_week VARCHAR(16) NOT NULL, -- 'THU_HAI', 'THU_BA', 'THU_TU', 'THU_NAM', 'THU_SAU', 'THU_BAY', 'CHU_NHAT'
    start_time TIME NOT NULL, -- Ví dụ: '08:00:00'
    end_time TIME NOT NULL,   -- Ví dụ: '11:30:00'
    busy_type VARCHAR(32) NOT NULL DEFAULT 'HOC_CHINH_KHOA', -- 'HOC_CHINH_KHOA', 'THI', 'CONG_VIEC_KHAC', 'BAN_CO_DINH'
    effective_start_date DATE NOT NULL,
    effective_end_date DATE NOT NULL,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_busy_time_range CHECK (end_time > start_time),
    CONSTRAINT chk_busy_date_range CHECK (effective_end_date >= effective_start_date)
);

-- Index tra cứu lịch bận của thành viên theo thứ và khoảng ngày
CREATE INDEX IF NOT EXISTS idx_member_busy_intervals_lookup
ON member_busy_intervals(member_id, day_of_week, is_active, effective_start_date, effective_end_date);
