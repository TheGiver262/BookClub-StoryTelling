-- ═══════════════════════════════════════════════════════════════════════════════
-- YSBK Database Migration: 09_stage17_evaluation_decisions.sql
-- Chặng 17: Rubric phiên bản, phỏng vấn và tổng kết tuyển (Evaluation & Decisions)
-- Rubric theo version/năm học, tiêu chí/thang điểm/trọng số, chống tự tính trung bình
-- khi thiếu công thức, chấm riêng/chung giữ nguồn, audit lịch sử sửa điểm có lý do
-- và phát hiện xung đột, phân ban khác nguyện vọng, chuyển trúng tuyển sang member
-- idempotent đúng 1 lần, kết quả public chỉ xuất trường được duyệt (R07 & R13).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Bảng recruitment_rubrics: Định nghĩa rubric theo campaign & version
CREATE TABLE IF NOT EXISTS recruitment_rubrics (
    id VARCHAR(64) PRIMARY KEY,                         -- e.g. 'RUBRIC_GEN10_V1'
    campaign_id VARCHAR(64) NOT NULL,                   -- e.g. 'CAMPAIGN_GEN_10'
    version INTEGER NOT NULL DEFAULT 1,                 -- Phiên bản rubric
    title VARCHAR(255) NOT NULL,                        -- e.g. 'Rubric Phỏng Vấn & Đánh Giá Tuyển Thành Viên Gen 10'
    formula_type VARCHAR(64) NOT NULL DEFAULT 'UNSPECIFIED'
        CHECK (formula_type IN ('UNSPECIFIED', 'WEIGHTED_SUM', 'AVERAGE_CRITERIA')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rubric_campaign_version UNIQUE (campaign_id, version)
);

-- 2. Bảng recruitment_rubric_criteria: Tiêu chí, thang điểm, trọng số theo rubric
CREATE TABLE IF NOT EXISTS recruitment_rubric_criteria (
    id VARCHAR(64) PRIMARY KEY,                         -- e.g. 'CRIT_G10_ATTITUDE'
    rubric_id VARCHAR(64) NOT NULL REFERENCES recruitment_rubrics(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,                          -- 'ATTITUDE', 'EXPERIENCE', 'ESSAY_CREATIVITY'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    section VARCHAR(32) NOT NULL DEFAULT 'INTERVIEW'
        CHECK (section IN ('INTERVIEW', 'ESSAY', 'COMMITTEE')),
    min_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 10,
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rubric_criteria_code UNIQUE (rubric_id, code)
);

-- 3. Bảng recruitment_interviews: Lịch và phân công phỏng vấn
CREATE TABLE IF NOT EXISTS recruitment_interviews (
    id VARCHAR(64) PRIMARY KEY,                         -- e.g. 'INT_GEN10_001'
    response_id VARCHAR(64) NOT NULL REFERENCES recruitment_form_responses(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMPTZ,
    location_or_link VARCHAR(255),
    assigned_interviewer_ids TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABSENT')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bổ sung các cột mở rộng cho bảng recruitment_evaluations
ALTER TABLE recruitment_evaluations ADD COLUMN IF NOT EXISTS rubric_id VARCHAR(64) REFERENCES recruitment_rubrics(id);
ALTER TABLE recruitment_evaluations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recruitment_evaluations ADD COLUMN IF NOT EXISTS raw_scores JSONB;
ALTER TABLE recruitment_evaluations ADD COLUMN IF NOT EXISTS formula_status VARCHAR(64) DEFAULT 'CALCULATED';

-- 5. Bảng recruitment_evaluation_history: Nhật ký audit sửa điểm có lý do & phiên bản
CREATE TABLE IF NOT EXISTS recruitment_evaluation_history (
    id VARCHAR(64) PRIMARY KEY,
    evaluation_id VARCHAR(64) NOT NULL REFERENCES recruitment_evaluations(id) ON DELETE CASCADE,
    modified_by VARCHAR(64) NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    previous_state JSONB NOT NULL,
    new_state JSONB NOT NULL,
    previous_version INTEGER NOT NULL,
    new_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Bảng recruitment_decisions: Quyết định tuyển dụng của Hội đồng & Chuyển đổi thành viên
CREATE TABLE IF NOT EXISTS recruitment_decisions (
    id VARCHAR(64) PRIMARY KEY,                         -- e.g. 'DEC_GEN10_RESP001'
    response_id VARCHAR(64) NOT NULL REFERENCES recruitment_form_responses(id) ON DELETE CASCADE,
    decision VARCHAR(32) NOT NULL
        CHECK (decision IN ('PASSED', 'FAILED', 'RESERVE')),
    assigned_department VARCHAR(64) NOT NULL,           -- Có thể khác nguyện vọng 1 và 2
    committee_notes TEXT,
    decided_by VARCHAR(64) NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_converted_to_member BOOLEAN NOT NULL DEFAULT FALSE,
    converted_member_id UUID REFERENCES members(id),
    converted_at TIMESTAMPTZ,
    CONSTRAINT uq_recruitment_decision_response UNIQUE (response_id),
    CONSTRAINT uq_recruitment_converted_member UNIQUE (converted_member_id)
);

-- 7. Bảng recruitment_public_announcements: Công bố kết quả công khai an toàn (R13)
CREATE TABLE IF NOT EXISTS recruitment_public_announcements (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL REFERENCES recruitment_form_responses(id) ON DELETE CASCADE,
    candidate_code VARCHAR(64) NOT NULL,                -- Mã định danh ẩn danh, e.g. 'YSBK-CAND-01'
    passed_department VARCHAR(64) NOT NULL,
    is_approved_for_public BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_recruitment_public_code UNIQUE (campaign_id, candidate_code)
);

-- 8. Indexes phục vụ tra cứu
CREATE INDEX IF NOT EXISTS idx_recruitment_rubrics_campaign ON recruitment_rubrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_criteria_rubric ON recruitment_rubric_criteria(rubric_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_interviews_response ON recruitment_interviews(response_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_eval_history_eval_id ON recruitment_evaluation_history(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_decisions_decision ON recruitment_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_recruitment_public_announcements_campaign ON recruitment_public_announcements(campaign_id);
