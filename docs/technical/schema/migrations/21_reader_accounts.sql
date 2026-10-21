CREATE TABLE reader_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  session_hash VARCHAR(64),
  session_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((session_hash IS NULL) = (session_expires_at IS NULL))
);
CREATE UNIQUE INDEX reader_accounts_session_hash_idx ON reader_accounts(session_hash) WHERE session_hash IS NOT NULL;
ALTER TABLE reservations ADD COLUMN reader_account_id UUID REFERENCES reader_accounts(id);
CREATE INDEX reservations_reader_account_idx ON reservations(reader_account_id, created_at DESC);
