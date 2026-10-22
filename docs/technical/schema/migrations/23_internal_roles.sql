ALTER TABLE members ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE members SET is_active=FALSE,is_admin=FALSE,is_manager=FALSE,token_version=token_version+1
WHERE is_alumni AND (is_active OR is_admin OR is_manager);
ALTER TABLE members ADD CONSTRAINT retired_members_no_access CHECK (NOT is_alumni OR NOT is_active);
ALTER TABLE members ADD CONSTRAINT manager_role_valid CHECK (NOT is_manager OR (NOT is_admin AND NOT is_collaborator AND NOT is_alumni));
