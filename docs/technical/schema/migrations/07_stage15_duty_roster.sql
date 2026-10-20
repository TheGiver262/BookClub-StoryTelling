-- ============================================================================
-- Migration 07: Duty Roster, Versioned Publishing & Attendance (Chặng 15)
-- Quản lý lịch trực bàn sách Thứ 3 / Thứ 5, phân công Trực chính & Hỗ trợ,
-- Phiên bản DRAFT / PUBLISHED, không mất sửa tay, ghi nhận 4 vai trò cụ thể
-- ============================================================================

CREATE TABLE IF NOT EXISTS duty_schedules (
    id VARCHAR(50) PRIMARY KEY,
    term_semester VARCHAR(20) NOT NULL,
    schedule_date DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('THU_BA', 'THU_NAM')),
    shift_time VARCHAR(100) NOT NULL DEFAULT '14:00 - 17:00 (Thu dọn 17:00 - 17:15 [GIẢ ĐỊNH / CHƯA CHỐT POLICY])',
    location VARCHAR(200) NOT NULL DEFAULT 'Sảnh Thư viện Tạ Quang Bửu',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED')),
    version INT NOT NULL DEFAULT 1,
    published_version INT NULL,
    published_at TIMESTAMPTZ NULL,
    published_by VARCHAR(50) NULL,
    warning_main TEXT NULL,
    warning_support TEXT NULL,
    is_manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
    facebook_post_content TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_duty_schedule_date_version UNIQUE (schedule_date, version)
);

CREATE TABLE IF NOT EXISTS duty_schedule_assignees (
    id VARCHAR(50) PRIMARY KEY,
    schedule_id VARCHAR(50) NOT NULL REFERENCES duty_schedules(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id),
    duty_type VARCHAR(20) NOT NULL CHECK (duty_type IN ('MAIN', 'SUPPORT')),
    assigned_role VARCHAR(30) NOT NULL DEFAULT 'LOGISTICS_SETUP' CHECK (
        assigned_role IN ('BOOK_INTRO', 'CIRCULATION_LOG', 'CASH_DRAWER', 'LOGISTICS_SETUP')
    ),
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (
        attendance_status IN ('SCHEDULED', 'PRESENT', 'ABSENT', 'SUBSTITUTED')
    ),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_schedule_member UNIQUE (schedule_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_duty_schedules_term_status ON duty_schedules (term_semester, status);
CREATE INDEX IF NOT EXISTS idx_duty_schedules_date ON duty_schedules (schedule_date);
CREATE INDEX IF NOT EXISTS idx_duty_schedule_assignees_member ON duty_schedule_assignees (member_id);
CREATE INDEX IF NOT EXISTS idx_duty_schedule_assignees_sched ON duty_schedule_assignees (schedule_id);
