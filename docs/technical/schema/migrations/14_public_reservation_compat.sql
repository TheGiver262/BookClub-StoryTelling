-- ============================================================================
-- MIGRATION 14: TƯƠNG THÍCH CANONICAL SCHEMA CHO PUBLIC RESERVATIONS (PRF-02)
-- ============================================================================
-- 1. Sửa reservations.schedule_id từ UUID sang VARCHAR(50) để khớp duty_schedules(id).
-- 2. Mở rộng reservations.ip_hash từ VARCHAR(64) sang VARCHAR(128) để chứa versioned HMAC hash an toàn.
-- ============================================================================

DO $$
BEGIN
    -- 1. Cập nhật kiểu cột schedule_id sang VARCHAR(50) nếu đang là UUID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reservations' 
          AND column_name = 'schedule_id' 
          AND data_type = 'uuid'
    ) THEN
        -- Tạm thời gỡ bỏ foreign key constraint cũ nếu có
        ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_schedule_id_fkey;
        
        -- Chuyển kiểu cột sang VARCHAR(50)
        ALTER TABLE reservations ALTER COLUMN schedule_id TYPE VARCHAR(50) USING schedule_id::text;
        
        -- Tạo lại foreign key trỏ sang duty_schedules(id)
        ALTER TABLE reservations ADD CONSTRAINT reservations_schedule_id_fkey 
            FOREIGN KEY (schedule_id) REFERENCES duty_schedules(id);
    END IF;

    -- 2. Mở rộng độ dài cột ip_hash sang VARCHAR(128) nếu đang <= 64 ký tự
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reservations' 
          AND column_name = 'ip_hash' 
          AND character_maximum_length < 128
    ) THEN
        ALTER TABLE reservations ALTER COLUMN ip_hash TYPE VARCHAR(128);
    END IF;
END $$;
