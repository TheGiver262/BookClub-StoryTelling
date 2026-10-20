-- =====================================================================
-- YSBK PostgreSQL Database Schema v1.0
-- Hệ thống Quản lý Câu lạc bộ Yêu Sách Bách Khoa Hà Nội
-- Ngày lập: 18/10/2026. Múi giờ: Asia/Ho_Chi_Minh
-- =====================================================================

-- 1. KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE copy_status AS ENUM ('AVAILABLE', 'BORROWED', 'LOST', 'MAINTENANCE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE copy_location AS ENUM ('KHO_THU_VIEN', 'KHO_HOI_SINH_VIEN', 'BAN_TRUC_TAM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'PARTIAL_SETTLED', 'PENDING_DEPOSIT', 'LOST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_team AS ENUM ('HAU_CAN', 'NOI_DUNG', 'TRUYEN_THONG_DOI_NGOAI', 'BAN_CHU_NHIEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. BẢNG THƯ MỤC SÁCH & KHO (FR-01)
CREATE TABLE IF NOT EXISTS book_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    original_title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tự động sinh search_vector cho tìm kiếm tiếng Việt không dấu qua trigger (R01 fix: unaccent là hàm STABLE)
ALTER TABLE book_titles ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_book_title_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('simple', unaccent(NEW.title || ' ' || COALESCE(NEW.description, '')));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_book_titles_search_vector ON book_titles;
CREATE TRIGGER trg_book_titles_search_vector
BEFORE INSERT OR UPDATE OF title, description ON book_titles
FOR EACH ROW EXECUTE FUNCTION update_book_title_search_vector();

CREATE INDEX IF NOT EXISTS idx_book_titles_search_vector ON book_titles USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_book_titles_trgm ON book_titles USING GIN(title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_title_authors (
    title_id UUID NOT NULL REFERENCES book_titles(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, author_id)
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_title_categories (
    title_id UUID NOT NULL REFERENCES book_titles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, category_id)
);

CREATE TABLE IF NOT EXISTS book_editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id UUID NOT NULL REFERENCES book_titles(id) ON DELETE RESTRICT,
    publisher VARCHAR(150) NOT NULL,
    publish_year SMALLINT CHECK (publish_year > 1900),
    isbn VARCHAR(20),
    cover_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES book_editions(id) ON DELETE RESTRICT,
    barcode VARCHAR(50) NOT NULL UNIQUE,
    location copy_location NOT NULL DEFAULT 'KHO_THU_VIEN',
    status copy_status NOT NULL DEFAULT 'AVAILABLE',
    cover_price BIGINT NULL CHECK (cover_price IS NULL OR cover_price >= 0),
    condition_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_copies_barcode ON book_copies(barcode);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);

-- 4. BẢNG THÀNH VIÊN & PHÂN QUYỀN (FR-02, FR-09)
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    gen VARCHAR(20) NOT NULL,
    team member_team NOT NULL,
    role_title VARCHAR(100) NOT NULL,
    school_year VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_eligible_main_duty BOOLEAN NOT NULL DEFAULT FALSE,
    has_paid_fee BOOLEAN NOT NULL DEFAULT FALSE,
    is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alumni_not_admin CHECK (NOT (is_alumni = TRUE AND is_admin = TRUE))
);

CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);

CREATE TABLE IF NOT EXISTS internal_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL UNIQUE,
    normalized_username VARCHAR(50) NOT NULL UNIQUE,
    provider_subject VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_identities_normalized ON internal_identities(normalized_username);

-- 5. BẢNG MƯỢN TRẢ & CỌC (FR-01)
CREATE TABLE IF NOT EXISTS borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    student_id VARCHAR(50) NULL,
    school VARCHAR(150) NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    notes TEXT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrowers_phone ON borrowers(phone);
CREATE INDEX IF NOT EXISTS idx_borrowers_student_id ON borrowers(student_id);

CREATE TABLE IF NOT EXISTS loan_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(35) NOT NULL UNIQUE,
    borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE RESTRICT,
    borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    renew_count SMALLINT NOT NULL DEFAULT 0 CHECK (renew_count BETWEEN 0 AND 3),
    status loan_status NOT NULL DEFAULT 'ACTIVE',
    preceding_receipt_id UUID NULL REFERENCES loan_receipts(id),
    created_by UUID NOT NULL REFERENCES members(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_receipts_borrower ON loan_receipts(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loan_receipts_due_status ON loan_receipts(due_date, status);

CREATE TABLE IF NOT EXISTS loan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES loan_receipts(id) ON DELETE CASCADE,
    copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
    deposit_snapshot BIGINT NOT NULL CHECK (deposit_snapshot >= 50000),
    returned_at TIMESTAMPTZ NULL,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    lost_at TIMESTAMPTZ NULL,
    lost_reason TEXT NULL,
    carried_forward_at TIMESTAMPTZ NULL,
    successor_item_id UUID NULL REFERENCES loan_items(id)
);

-- RÀNG BUỘC CỐT LÕI: Một bản sách vật lý chỉ được mượn 1 lần khi chưa trả hoặc chưa chuyển tiếp
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_copy_loan 
ON loan_items (copy_id) 
WHERE returned_at IS NULL AND is_lost = FALSE AND carried_forward_at IS NULL;

-- BẢNG LƯU TRỮ QUYẾT ĐỊNH QUYẾT TOÁN MƯỢN TRẢ (Chặng 09: Settlement Read Model)
CREATE TABLE IF NOT EXISTS loan_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES loan_receipts(id) ON DELETE RESTRICT,
    settlement_type VARCHAR(20) NOT NULL CHECK (settlement_type IN ('FULL', 'PARTIAL', 'LOST')),
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

CREATE INDEX IF NOT EXISTS idx_loan_settlements_receipt ON loan_settlements(receipt_id);
CREATE INDEX IF NOT EXISTS idx_loan_settlements_successor ON loan_settlements(successor_receipt_id);

-- BẢNG LỊCH SỬ GIA HẠN PHIẾU MƯỢN (Chặng 10: Loan Renewals History)
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

-- BẢNG DANH MỤC LỊCH NGHỈ LỄ & TẾT (Chặng 07/09: Calendar Integration)
CREATE TABLE IF NOT EXISTS calendar_holidays (
    holiday_date DATE PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger kiểm tra tối đa 2 cuốn mỗi phiếu (R03 fix: khóa dòng phiếu mượn cha FOR UPDATE để tuần tự hóa concurrency)
CREATE OR REPLACE FUNCTION check_max_loan_items() 
RETURNS TRIGGER AS $$
DECLARE
    v_item_count INT;
BEGIN
    -- Khóa bản ghi phiếu mượn cha FOR UPDATE để tuần tự hóa các transaction đồng thời trên cùng phiếu
    -- Nếu chuyển receipt_id (UPDATE), khóa cả 2 phiếu theo thứ tự UUID cố định để tránh deadlock
    IF TG_OP = 'UPDATE' AND OLD.receipt_id IS DISTINCT FROM NEW.receipt_id THEN
        IF OLD.receipt_id < NEW.receipt_id THEN
            PERFORM 1 FROM loan_receipts WHERE id = OLD.receipt_id FOR UPDATE;
            PERFORM 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE;
        ELSE
            PERFORM 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE;
            PERFORM 1 FROM loan_receipts WHERE id = OLD.receipt_id FOR UPDATE;
        END IF;
    ELSE
        PERFORM 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE;
    END IF;

    -- Kiểm tra số lượng sách hiện có trên phiếu đích (loại trừ bản ghi hiện tại nếu đang UPDATE trên cùng phiếu)
    SELECT COUNT(*) INTO v_item_count 
    FROM loan_items 
    WHERE receipt_id = NEW.receipt_id 
      AND (TG_OP = 'INSERT' OR id <> OLD.id);

    IF v_item_count >= 2 THEN
        RAISE EXCEPTION 'Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_max_loan_items ON loan_items;
CREATE TRIGGER trg_check_max_loan_items
BEFORE INSERT OR UPDATE OF receipt_id ON loan_items
FOR EACH ROW EXECUTE FUNCTION check_max_loan_items();

-- 6. BẢNG TÀI CHÍNH & HAI QUỸ (FR-05)
CREATE TABLE IF NOT EXISTS funds (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS cash_sessions (
    id VARCHAR(35) PRIMARY KEY,
    session_date DATE NOT NULL,
    opened_by UUID NOT NULL REFERENCES members(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opening_cash BIGINT NOT NULL CHECK (opening_cash >= 0),
    expected_closing_cash BIGINT NOT NULL DEFAULT 0,
    actual_closing_cash BIGINT NULL,
    discrepancy BIGINT NULL,
    discrepancy_reason TEXT,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closed_at TIMESTAMPTZ NULL,
    closed_by UUID NULL REFERENCES members(id),
    handed_over_from_session_id VARCHAR(35) NULL REFERENCES cash_sessions(id)
);

-- RÀNG BUỘC CỐT LÕI: Mỗi thời điểm chỉ có tối đa 1 phiên quầy tiền mặt đang mở trên toàn hệ thống
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_cash_session 
ON cash_sessions (is_closed) 
WHERE is_closed = FALSE;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_date ON cash_sessions(session_date);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_code VARCHAR(64) NOT NULL UNIQUE,
    fund_id VARCHAR(30) NOT NULL REFERENCES funds(id),
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100) NOT NULL,
    debit_account VARCHAR(50) NOT NULL,
    credit_account VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    reversal_of_entry_id UUID NULL REFERENCES journal_entries(id),
    cash_session_id VARCHAR(35) NULL REFERENCES cash_sessions(id),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_fund_date ON journal_entries(fund_id, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_cash_session ON journal_entries(cash_session_id);

-- Bút toán sổ cái là bất biến (Immutable): Nghiêm cấm UPDATE hoặc DELETE
CREATE OR REPLACE FUNCTION prevent_journal_mutation() 
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Bút toán sổ cái (journal_entries) là bất biến và không thể sửa hoặc xóa trực tiếp.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_journal_mutation ON journal_entries;
CREATE TRIGGER trg_prevent_journal_mutation
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();

-- BẢNG PHÂN BỔ VÀ NGHĨA VỤ TIỀN CỌC (DEPOSIT ALLOCATIONS & LIABILITIES)
DO $$ BEGIN
    CREATE TYPE deposit_status AS ENUM ('HELD', 'PENDING_REFUND', 'REFUNDED', 'FORFEITED', 'TRANSFERRED', 'VOIDED', 'PENDING_COLLECTION');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS deposit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES loan_receipts(id) ON DELETE RESTRICT,
    item_id UUID NULL REFERENCES loan_items(id) ON DELETE RESTRICT,
    fund_id VARCHAR(30) NOT NULL DEFAULT 'FUND_LOAN' REFERENCES funds(id),
    original_amount BIGINT NOT NULL CHECK (original_amount > 0),
    remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0),
    status deposit_status NOT NULL DEFAULT 'HELD',
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
    refund_method VARCHAR(20) NULL CHECK (refund_method IN ('CASH', 'BANK_TRANSFER')),
    transferred_to_receipt_id UUID NULL REFERENCES loan_receipts(id),
    transferred_from_allocation_id UUID NULL REFERENCES deposit_allocations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_alloc_receipt ON deposit_allocations(receipt_id);
CREATE INDEX IF NOT EXISTS idx_deposit_alloc_status ON deposit_allocations(status);

-- Ràng buộc chống nhận cọc trùng cho cùng cuốn sách / phiếu mượn đang active (S04-01)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_deposit_item 
ON deposit_allocations (receipt_id, item_id) 
WHERE status IN ('HELD', 'PENDING_REFUND') AND item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_deposit_receipt 
ON deposit_allocations (receipt_id) 
WHERE status IN ('HELD', 'PENDING_REFUND') AND item_id IS NULL;

-- BẢNG Ý ĐỊNH HOÀN CỌC (REFUND INTENTS - S04-01)
CREATE TABLE IF NOT EXISTS refund_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES deposit_allocations(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    refund_method VARCHAR(20) NOT NULL CHECK (refund_method IN ('CASH', 'BANK_TRANSFER')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    requested_by UUID NOT NULL REFERENCES members(id),
    confirmed_by UUID NULL REFERENCES members(id),
    confirmed_at TIMESTAMPTZ NULL,
    cash_session_id VARCHAR(35) NULL REFERENCES cash_sessions(id),
    journal_entry_id UUID NULL REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_intents_alloc ON refund_intents(allocation_id, status);

-- 7. BẢNG LÔ SÁCH BÁN MỚI (FR-05)
CREATE TABLE IF NOT EXISTS bookstore_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_name VARCHAR(150) NOT NULL,
    supplier VARCHAR(150) NOT NULL,
    received_date DATE NOT NULL,
    book_title VARCHAR(255) NOT NULL,
    cover_price BIGINT NOT NULL,
    discount_rate NUMERIC(4,2) NOT NULL,
    unit_cost BIGINT NOT NULL,
    selling_price BIGINT NOT NULL,
    received_quantity INT NOT NULL,
    sold_quantity INT NOT NULL DEFAULT 0,
    returned_quantity INT NOT NULL DEFAULT 0,
    deposit_paid_to_supplier BIGINT NOT NULL DEFAULT 0,
    deposit_refund_received BIGINT NOT NULL DEFAULT 0,
    settlement_paid BIGINT NOT NULL DEFAULT 0,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. BẢNG TRỰC SÁCH (FR-03)
CREATE TABLE IF NOT EXISTS duty_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week VARCHAR(20) NOT NULL,
    shift_date DATE NOT NULL,
    location VARCHAR(150) NOT NULL,
    prep_time VARCHAR(30) NOT NULL DEFAULT '13:45 - 14:00',
    main_time VARCHAR(30) NOT NULL DEFAULT '14:00 - 17:00',
    cleanup_time VARCHAR(30) NOT NULL DEFAULT '17:00 - 17:15',
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT_PROPOSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duty_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES duty_shifts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    role_in_shift VARCHAR(30) NOT NULL CHECK (role_in_shift IN ('MAIN_DUTY', 'SUPPORT')),
    attendance_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
);

-- Bảng phân ca trực có phiên bản (Chặng 15 / Migration 07)
CREATE TABLE IF NOT EXISTS duty_schedules (
    id VARCHAR(50) PRIMARY KEY,
    term_semester VARCHAR(20) NOT NULL,
    schedule_date DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('THU_BA', 'THU_NAM')),
    shift_time VARCHAR(100) NOT NULL DEFAULT '14:00 - 17:00',
    location VARCHAR(200) NOT NULL DEFAULT 'Sảnh Thư viện Tạ Quang Bửu',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version INT NOT NULL DEFAULT 1,
    published_version INT NULL,
    published_at TIMESTAMPTZ NULL,
    published_by VARCHAR(50) NULL,
    warning_main TEXT NULL,
    warning_support TEXT NULL,
    is_manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
    facebook_post_content TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duty_schedule_assignees (
    id VARCHAR(50) PRIMARY KEY,
    schedule_id VARCHAR(50) NOT NULL REFERENCES duty_schedules(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id),
    duty_type VARCHAR(20) NOT NULL CHECK (duty_type IN ('MAIN', 'SUPPORT')),
    assigned_role VARCHAR(30) NOT NULL DEFAULT 'LOGISTICS_SETUP',
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_schedule_member UNIQUE (schedule_id, member_id)
);

-- 9. BẢNG TUYỂN DỤNG (FR-04)
CREATE TABLE IF NOT EXISTS recruitment_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    gen VARCHAR(20) NOT NULL,
    rubric_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES recruitment_drives(id) ON DELETE RESTRICT,
    form_response_id VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    aspirations TEXT[] NOT NULL,
    interview_timeslot VARCHAR(100),
    council_score NUMERIC(4,2) NULL,
    assigned_team member_team NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES members(id),
    score NUMERIC(4,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES members(id),
    old_score NUMERIC(4,2) NOT NULL,
    new_score NUMERIC(4,2) NOT NULL,
    reason TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. BẢNG NỘI DUNG & KIỂM DUYỆT (FR-01)
CREATE TABLE IF NOT EXISTS book_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id UUID NOT NULL REFERENCES book_titles(id) ON DELETE CASCADE,
    reader_name VARCHAR(150) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    moderated_by UUID NULL REFERENCES members(id),
    moderation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. BẢNG HOẠT ĐỘNG & SỰ KIỆN (FR-07)
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    location VARCHAR(150),
    budget BIGINT DEFAULT 0,
    created_by UUID NOT NULL REFERENCES members(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    assigned_task TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(activity_id, member_id)
);

-- 12. BẢNG IDEMPOTENCY & AUDIT LOGS (FR-08)
CREATE TABLE IF NOT EXISTS idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES members(id),
    operation VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    response_code INT NULL,
    response_body JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (actor_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_records(actor_id, operation, idempotency_key);

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES members(id),
    action VARCHAR(100) NOT NULL,
    target_resource VARCHAR(100) NOT NULL,
    target_id VARCHAR(100),
    ip_address VARCHAR(50),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_date ON system_audit_logs(actor_id, created_at);

-- 13. BẢNG THU HỒI PHIÊN ĐĂNG NHẬP (SESSION REVOCATIONS - S04-04)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at);

-- 14. BẢNG KHÓA HẠN MỨC & ĐẶT SÁCH CÔNG KHAI (PUBLIC RESERVATIONS - MIGRATION 13)
CREATE TABLE IF NOT EXISTS reservation_quota_locks (
    lock_namespace VARCHAR(128) PRIMARY KEY,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    title_id UUID NOT NULL REFERENCES book_titles(id),
    copy_id UUID NOT NULL REFERENCES book_copies(id),
    schedule_id VARCHAR(50) NOT NULL REFERENCES duty_schedules(id),
    full_name VARCHAR(128) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    student_id VARCHAR(50) NULL,
    university VARCHAR(128) NULL,
    email VARCHAR(128) NULL,
    ip_hash VARCHAR(128) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    idempotency_key VARCHAR(128) NULL,
    payload_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'BORROWED', 'RETURNED', 'CANCELLED', 'EXPIRED')),
    shift_date DATE NOT NULL,
    shift_time VARCHAR(100) NOT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    estimated_deposit INT NOT NULL DEFAULT 50000,
    fulfilled_receipt_id UUID NULL REFERENCES loan_receipts(id),
    fulfilled_at TIMESTAMPTZ NULL,
    fulfilled_by UUID NULL REFERENCES members(id),
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID NULL,
    cancellation_reason TEXT NULL,
    returned_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_reservation_copy 
ON reservations (copy_id) 
WHERE status = 'HELD';

CREATE INDEX IF NOT EXISTS idx_reservations_phone_status 
ON reservations (phone, status);

CREATE INDEX IF NOT EXISTS idx_reservations_ip_created 
ON reservations (ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_reservations_schedule_status 
ON reservations (schedule_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_expires_held 
ON reservations (expires_at) 
WHERE status = 'HELD';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_token_hash 
ON reservations (token_hash);



CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_idempotency_key ON reservations(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS consumed_export_tickets (ticket_id VARCHAR(64) PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL);
