ALTER TABLE members ADD COLUMN IF NOT EXISTS is_collaborator BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS probation_started_on DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS probation_ends_on DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS probation_evaluation TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS collaborator_deleted_at TIMESTAMPTZ;
UPDATE members SET is_collaborator=TRUE,
  probation_started_on=(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  probation_ends_on=((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + INTERVAL '1 month')::date
WHERE role_title='Thành viên tập sự' AND NOT is_admin AND NOT is_alumni AND probation_started_on IS NULL;
ALTER TABLE members ADD CONSTRAINT collaborator_stage_valid CHECK (
  NOT is_collaborator OR (NOT is_admin AND NOT is_alumni AND probation_started_on IS NOT NULL AND probation_ends_on=(probation_started_on+INTERVAL '1 month')::date)
);
ALTER TABLE members ADD CONSTRAINT collaborator_deleted_no_access CHECK (collaborator_deleted_at IS NULL OR (is_collaborator AND NOT is_active));
