BEGIN;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64);
ALTER TABLE reservations ALTER COLUMN shift_time TYPE VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_idempotency_key ON reservations(idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE duty_schedules ALTER COLUMN shift_time SET DEFAULT '14:00 - 17:00';
ALTER TABLE duty_schedules ALTER COLUMN location SET DEFAULT 'Sảnh Thư viện Tạ Quang Bửu';
-- Invalid legacy identifiers or duplicate assignments abort the migration for manual repair.
ALTER TABLE duty_schedule_assignees ALTER COLUMN member_id TYPE UUID USING member_id::uuid;
ALTER TABLE duty_schedule_assignees ALTER COLUMN assigned_role SET DEFAULT 'LOGISTICS_SETUP';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'duty_schedule_assignees'::regclass AND contype = 'f' AND confrelid = 'members'::regclass) THEN
    ALTER TABLE duty_schedule_assignees ADD CONSTRAINT duty_assignee_member_fk FOREIGN KEY (member_id) REFERENCES members(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'duty_schedule_assignees'::regclass AND conname = 'uq_schedule_member') THEN
    ALTER TABLE duty_schedule_assignees ADD CONSTRAINT uq_schedule_member UNIQUE (schedule_id, member_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'duty_schedule_assignees'::regclass AND conname = 'duty_schedule_assignees_duty_type_check') THEN
    ALTER TABLE duty_schedule_assignees ADD CONSTRAINT duty_schedule_assignees_duty_type_check CHECK (duty_type IN ('MAIN', 'SUPPORT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'duty_schedules'::regclass AND conname = 'duty_schedules_day_of_week_check') THEN
    ALTER TABLE duty_schedules ADD CONSTRAINT duty_schedules_day_of_week_check CHECK (day_of_week IN ('THU_BA', 'THU_NAM'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS consumed_export_tickets (
    ticket_id VARCHAR(64) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);
COMMIT;
