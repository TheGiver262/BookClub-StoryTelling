-- ═══════════════════════════════════════════════════════════════════════════════
-- YSBK Database Migration: 08_stage16_recruitment_sync.sql
-- Chặng 16: Tiếp nhận và đối soát Google Form (Recruitment Form Ingestion & Reconciliation)
-- Khóa nguồn FormID + responseID, ánh xạ câu hỏi theo version, nhiều nguyện vọng,
-- phân tách dữ liệu nguồn với điểm chấm/quyết định trên web, đối soát checkpoint.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Bảng recruitment_forms: Định nghĩa biểu mẫu tuyển dụng theo đợt/kỳ
CREATE TABLE IF NOT EXISTS recruitment_forms (
    id VARCHAR(64) PRIMARY KEY,                         -- e.g. 'FORM_GEN_10_2026'
    title VARCHAR(255) NOT NULL,                        -- e.g. 'Đơn Ứng Tuyển YSBK Gen 10 - Năm Học 2026-2027'
    term_semester VARCHAR(32) NOT NULL,                 -- e.g. '2026.1'
    form_url VARCHAR(512),                              -- Google Form URL
    version INTEGER NOT NULL DEFAULT 1,                 -- Phiên bản biểu mẫu
    is_active BOOLEAN NOT NULL DEFAULT TRUE,            -- Biểu mẫu đang mở nhận đơn
    webhook_secret_hash VARCHAR(128),                   -- SHA-256 hash của secret chia sẻ
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng recruitment_form_questions: Định nghĩa câu hỏi & ánh xạ trường theo version
CREATE TABLE IF NOT EXISTS recruitment_form_questions (
    id VARCHAR(64) PRIMARY KEY,
    form_id VARCHAR(64) NOT NULL REFERENCES recruitment_forms(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_key VARCHAR(64) NOT NULL,                  -- 'FULL_NAME', 'STUDENT_ID', 'EMAIL', 'PHONE', 'ASPIRATION_1', 'ASPIRATION_2', 'WHY_JOIN', 'ESSAY_CONTENT', 'CV_LINK'
    question_label TEXT NOT NULL,                       -- Nhãn câu hỏi thực tế trong Google Form
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    field_mapping VARCHAR(64) NOT NULL,                 -- Ánh xạ trường chuẩn hóa
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_form_question_key UNIQUE (form_id, question_key)
);

-- 3. Bảng recruitment_form_responses: Lưu trữ dữ liệu đơn ứng tuyển tiếp nhận từ Form
CREATE TABLE IF NOT EXISTS recruitment_form_responses (
    id VARCHAR(64) PRIMARY KEY,                         -- e.g. 'RESP_GEN10_ABC123'
    form_id VARCHAR(64) NOT NULL REFERENCES recruitment_forms(id) ON DELETE CASCADE,
    response_id VARCHAR(128) NOT NULL,                  -- Google Form Response ID (Khóa nguồn duy nhất)
    submission_timestamp TIMESTAMPTZ NOT NULL,          -- Thời điểm nộp đơn trên Google Form
    applicant_name VARCHAR(255) NOT NULL,               -- Họ và tên ứng viên
    applicant_student_id VARCHAR(32),                   -- MSSV (nếu là sinh viên ĐHBK/trường khác)
    applicant_email VARCHAR(255) NOT NULL,              -- Email liên hệ
    applicant_phone VARCHAR(32),                        -- Số điện thoại
    aspiration_1 VARCHAR(64) NOT NULL,                  -- Nguyện vọng 1 (BAN_HAU_CAN, BAN_NOI_DUNG, BAN_TTDN, BAN_CHU_NHIEM)
    aspiration_2 VARCHAR(64),                           -- Nguyện vọng 2 (nếu có, không bắt buộc)
    why_join TEXT,                                      -- Lý do muốn tham gia CLB Sách
    essay_content TEXT,                                 -- Nội dung bài viết/bài cảm nhận theo form
    cv_link VARCHAR(512),                               -- Link CV / Portfolio nếu có
    raw_answers JSONB NOT NULL,                         -- Snapshot toàn bộ câu trả lời gốc từ Google Form
    sync_status VARCHAR(32) NOT NULL DEFAULT 'SYNCED'   -- 'SYNCED', 'PENDING_RECONCILIATION', 'CONFLICT', 'ERROR'
        CHECK (sync_status IN ('SYNCED', 'PENDING_RECONCILIATION', 'CONFLICT', 'ERROR')),
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),-- Thời điểm quan sát/đồng bộ gần nhất
    sync_error TEXT,                                    -- Chi tiết lỗi nếu có khi ánh xạ/đồng bộ
    version INTEGER NOT NULL DEFAULT 1,                 -- Số lần cập nhật của response
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_recruitment_form_response UNIQUE (form_id, response_id)
);

-- 4. Bảng recruitment_evaluations: Lưu trữ điểm chấm phỏng vấn/quyết định trên Web (Tách biệt hoàn toàn với dữ liệu form)
CREATE TABLE IF NOT EXISTS recruitment_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    response_id VARCHAR(64) NOT NULL REFERENCES recruitment_form_responses(id) ON DELETE CASCADE,
    evaluator_id VARCHAR(64) NOT NULL,                  -- Thành viên phụ trách chấm
    evaluation_type VARCHAR(32) NOT NULL DEFAULT 'INDIVIDUAL'
        CHECK (evaluation_type IN ('INDIVIDUAL', 'COMMITTEE')),
    score_breakdown JSONB,                              -- Chi tiết điểm theo rubric (Chặng 17)
    total_score NUMERIC(5,2),                           -- Điểm tổng hợp
    interview_notes TEXT,                               -- Ghi chú phỏng vấn
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('DRAFT', 'COMPLETED')),
    decision VARCHAR(32)                                -- Quyết định tuyển dụng
        CHECK (decision IN ('PASSED', 'FAILED', 'RESERVE', 'PENDING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bảng recruitment_reconciliation_checkpoints: Đối soát đơn thiếu và kiểm tra tính toàn vẹn
CREATE TABLE IF NOT EXISTS recruitment_reconciliation_checkpoints (
    id VARCHAR(64) PRIMARY KEY,
    form_id VARCHAR(64) NOT NULL REFERENCES recruitment_forms(id) ON DELETE CASCADE,
    last_synced_at TIMESTAMPTZ NOT NULL,
    total_responses_observed INTEGER NOT NULL DEFAULT 0,
    missing_responses_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS'
        CHECK (status IN ('SUCCESS', 'DISCREPANCY_DETECTED', 'ERROR')),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes phục vụ tra cứu nhanh và bảo vệ dữ liệu
CREATE INDEX IF NOT EXISTS idx_recruitment_responses_form_id ON recruitment_form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_responses_email ON recruitment_form_responses(applicant_email);
CREATE INDEX IF NOT EXISTS idx_recruitment_responses_sync_status ON recruitment_form_responses(sync_status);
CREATE INDEX IF NOT EXISTS idx_recruitment_evaluations_response_id ON recruitment_evaluations(response_id);
