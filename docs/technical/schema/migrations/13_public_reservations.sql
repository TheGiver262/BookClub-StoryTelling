-- ============================================================================
-- MIGRATION 13: CỔNG CÔNG KHAI VÀ ĐẶT SÁCH (PUBLIC RESERVATIONS)
-- ============================================================================
-- Thiết kế theo chuẩn PostgreSQL 3NF:
-- 1. reservation_quota_locks: Khóa hàng hạn mức namespace nguyên tử (IP/SĐT)
-- 2. reservations: Lưu trữ đơn đặt giữ chỗ sách công khai không cần tài khoản
-- 3. Ràng buộc toàn vẹn: 
--    - Tối đa 1 bản giữ chỗ active (HELD) trên mỗi bản sách vật lý
--    - Token tra cứu bảo mật dạng băm (SHA-256)
--    - Liên kết giao nhận với phiếu mượn (fulfilled_loan_id, fulfilled_receipt_id)
-- ============================================================================

-- Bảng 1: Khóa hàng hạn mức nguyên tử theo Namespace (IP / SĐT)
CREATE TABLE IF NOT EXISTS reservation_quota_locks (
    lock_namespace VARCHAR(128) PRIMARY KEY,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng 2: Đơn đặt sách công khai (Reservations)
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
    status VARCHAR(20) NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'BORROWED', 'RETURNED', 'CANCELLED', 'EXPIRED')),
    shift_date DATE NOT NULL,
    shift_time VARCHAR(50) NOT NULL,
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

-- Chỉ cho phép duy nhất một đơn HELD còn hiệu lực trên mỗi bản sách vật lý
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_reservation_copy 
ON reservations (copy_id) 
WHERE status = 'HELD';

-- Chỉ mục truy vấn hạn mức theo SĐT
CREATE INDEX IF NOT EXISTS idx_reservations_phone_status 
ON reservations (phone, status);

-- Chỉ mục truy vấn hạn mức theo IP trong cửa sổ 24 giờ trượt
CREATE INDEX IF NOT EXISTS idx_reservations_ip_created 
ON reservations (ip_hash, created_at);

-- Chỉ mục phục vụ danh sách quầy trực theo ca
CREATE INDEX IF NOT EXISTS idx_reservations_schedule_status 
ON reservations (schedule_id, status);

-- Chỉ mục phục vụ tác vụ quét hết hạn (Scheduler / Expiry batch)
CREATE INDEX IF NOT EXISTS idx_reservations_expires_held 
ON reservations (expires_at) 
WHERE status = 'HELD';

-- Chỉ mục duy nhất cho token tra cứu đơn của khách
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_token_hash 
ON reservations (token_hash);
