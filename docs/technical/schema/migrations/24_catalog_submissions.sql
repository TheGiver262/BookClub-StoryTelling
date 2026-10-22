ALTER TABLE book_titles ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE catalog_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  imported_by UUID NOT NULL REFERENCES members(id),
  row_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE catalog_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES catalog_import_batches(id),
  title_id UUID REFERENCES book_titles(id),
  base_version INTEGER,
  payload JSONB NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','REJECTED','PUBLISHED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES members(id),
  updated_by UUID NOT NULL REFERENCES members(id),
  moderated_by UUID REFERENCES members(id),
  moderation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX catalog_submissions_status_idx ON catalog_submissions(status,updated_at DESC);
