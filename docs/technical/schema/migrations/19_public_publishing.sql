-- Nội dung do quản lý cập nhật, không phụ thuộc chỉnh source giao diện.
CREATE TABLE IF NOT EXISTS public_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  content BYTEA NOT NULL CHECK (octet_length(content) <= 184320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS club_public_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
