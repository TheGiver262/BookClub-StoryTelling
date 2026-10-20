-- =====================================================================
-- MIGRATION 11: CHẶNG 19 - HOẠT ĐỘNG, SỰ KIỆN VÀ NHIỆM VỤ LIÊN KẾT QUỸ
-- =====================================================================
-- Tuân thủ:
-- - R06: Event/Activity endpoints đầy đủ, audit trail sửa nhiệm vụ.
-- - R07: Khách tham gia không bắt buộc MSSV/khoa/trường, không ép thành member.
-- - T56, T58: Dự toán khác chi thực tế, chi thực tế liên kết sổ kép journal_entries (FUND_OPERATION) đếm một lần duy nhất.
-- - ADR 001 & FR-02: Cựu thành viên (ALUMNI) & Public chỉ xem theo Allowlist DTO đã duyệt.
-- =====================================================================

-- 1. Nâng cấp bảng activities
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    location VARCHAR(150),
    budget BIGINT DEFAULT 0,
    created_by UUID NOT NULL REFERENCES members(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) NOT NULL DEFAULT 'WORKSHOP';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_approved_for_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_approved_for_alumni BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_activities_event_date ON activities(event_date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_alumni ON activities(is_approved_for_alumni) WHERE is_approved_for_alumni = TRUE;
CREATE INDEX IF NOT EXISTS idx_activities_public ON activities(is_approved_for_public) WHERE is_approved_for_public = TRUE;

-- 2. Bảng activity_tasks (Nhiệm vụ phân công trong sự kiện)
CREATE TABLE IF NOT EXISTS activity_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assignee_member_id UUID NULL REFERENCES members(id) ON DELETE SET NULL,
    due_date DATE NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
    created_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_tasks_activity_id ON activity_tasks(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_tasks_assignee ON activity_tasks(assignee_member_id);

-- 3. Bảng activity_task_history (Audit log lịch sử sửa đổi nhiệm vụ)
CREATE TABLE IF NOT EXISTS activity_task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES activity_tasks(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES members(id),
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON activity_task_history(task_id);

-- 4. Cải tiến bảng activity_participants (Hỗ trợ cả Thành viên và Khách ngoài không ép member)
CREATE TABLE IF NOT EXISTS activity_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    member_id UUID NULL REFERENCES members(id) ON DELETE RESTRICT,
    assigned_task TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_participants ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS participant_type VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (participant_type IN ('MEMBER', 'GUEST'));
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150) NULL;
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS guest_email VARCHAR(150) NULL;
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(30) NULL;
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'ATTENDEE' CHECK (role IN ('ATTENDEE', 'SPEAKER', 'ORGANIZER', 'VOLUNTEER'));
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'ATTENDED', 'CANCELLED'));
ALTER TABLE activity_participants ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ NULL;

ALTER TABLE activity_participants DROP CONSTRAINT IF EXISTS chk_participant_identity;
ALTER TABLE activity_participants ADD CONSTRAINT chk_participant_identity CHECK (
    (participant_type = 'MEMBER' AND member_id IS NOT NULL) OR
    (participant_type = 'GUEST' AND guest_name IS NOT NULL AND member_id IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_activity_member ON activity_participants (activity_id, member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity_id ON activity_participants(activity_id);

-- 5. Bảng activity_budget_items (Dự toán chi phí kế hoạch)
CREATE TABLE IF NOT EXISTS activity_budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    estimated_amount BIGINT NOT NULL CHECK (estimated_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_activity_id ON activity_budget_items(activity_id);

-- 6. Bảng activity_expenses (Chi thực tế liên kết Sổ quỹ kép journal_entries)
CREATE TABLE IF NOT EXISTS activity_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    budget_item_id UUID NULL REFERENCES activity_budget_items(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    actual_amount BIGINT NOT NULL CHECK (actual_amount > 0),
    expense_date DATE NOT NULL,
    payer_member_id UUID NOT NULL REFERENCES members(id),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK')),
    receipt_ref VARCHAR(100) NULL,
    journal_entry_id UUID NULL REFERENCES journal_entries(id),
    created_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_activity_id ON activity_expenses(activity_id);
CREATE INDEX IF NOT EXISTS idx_expense_journal_id ON activity_expenses(journal_entry_id);
