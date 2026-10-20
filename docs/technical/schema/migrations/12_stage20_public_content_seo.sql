-- ============================================================================
-- MIGRATION 12 (Stage 20): NỘI DUNG CÔNG KHAI, KIỂM DUYỆT VÀ REVIEW SÁCH (FR-08)
-- ============================================================================
-- Thiết kế theo chuẩn PostgreSQL 3NF:
-- 1. book_reviews: Quản lý đánh giá/cảm nhận sách từ bạn đọc/khách/thành viên.
--    - Nếu chưa tồn tại: tạo mới đầy đủ theo schema canonical.
--    - Nếu đã tồn tại từ baseline 01_schema.sql: nâng cấp, rename, bổ sung cột và backfill bảo toàn dữ liệu (P22-06).
-- 2. public_posts: Quản lý bài viết tin tức, góc cảm nhận, thông báo CLB công khai.
-- ============================================================================

-- Bảng 1: Đánh giá và cảm nhận sách (Book Reviews)
CREATE TABLE IF NOT EXISTS book_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES book_titles(id) ON DELETE CASCADE,
    author_id UUID NULL,
    author_name VARCHAR(150) NOT NULL,
    author_email VARCHAR(150) NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    moderated_by UUID NULL REFERENCES members(id),
    moderated_at TIMESTAMPTZ NULL,
    moderation_note TEXT NULL,
    version INT NOT NULL DEFAULT 1,
    pending_content TEXT NULL,
    pending_rating SMALLINT NULL CHECK (pending_rating IS NULL OR (pending_rating BETWEEN 1 AND 5)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nâng cấp và đồng bộ nếu bảng book_reviews đã được tạo từ baseline 01_schema.sql (P22-06)
DO $$
BEGIN
    -- 1. Đổi tên cột title_id -> book_id nếu cần
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'title_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'book_id'
    ) THEN
        ALTER TABLE book_reviews RENAME COLUMN title_id TO book_id;
    END IF;

    -- 2. Đổi tên cột reader_name -> author_name nếu cần
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'reader_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'author_name'
    ) THEN
        ALTER TABLE book_reviews RENAME COLUMN reader_name TO author_name;
    END IF;

    -- 3. Đổi tên cột moderation_reason -> moderation_note nếu cần
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'moderation_reason'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'moderation_note'
    ) THEN
        ALTER TABLE book_reviews RENAME COLUMN moderation_reason TO moderation_note;
    END IF;

    -- 4. Bổ sung các cột mới nếu thiếu
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'author_id'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN author_id UUID NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'author_email'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN author_email VARCHAR(150) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'moderated_at'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN moderated_at TIMESTAMPTZ NULL;
        UPDATE book_reviews SET moderated_at = created_at WHERE moderated_by IS NOT NULL AND moderated_at IS NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'version'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN version INT NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'pending_content'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN pending_content TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'pending_rating'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN pending_rating SMALLINT NULL CHECK (pending_rating IS NULL OR (pending_rating BETWEEN 1 AND 5));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'book_reviews' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE book_reviews ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        UPDATE book_reviews SET updated_at = created_at WHERE updated_at IS NULL;
    END IF;
END $$;

-- Chỉ mục tối ưu cho truy vấn public và kiểm duyệt
CREATE INDEX IF NOT EXISTS idx_book_reviews_book_status ON book_reviews(book_id, status);
CREATE INDEX IF NOT EXISTS idx_book_reviews_status_created ON book_reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_reviews_author ON book_reviews(author_id);

-- Bảng 2: Bài viết, tin tức và cảm nhận công khai (Public Posts / Publications)
CREATE TABLE IF NOT EXISTS public_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('NEWS', 'REVIEW', 'EVENT_RECAP', 'NOTICE', 'GUIDE')),
    cover_image_url VARCHAR(500) NULL,
    author_id UUID NOT NULL REFERENCES members(id),
    author_display_name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED')),
    moderated_by UUID NULL REFERENCES members(id),
    moderated_at TIMESTAMPTZ NULL,
    published_at TIMESTAMPTZ NULL,
    meta_description VARCHAR(300) NULL,
    view_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ mục tối ưu cho SEO Slug và phân trang theo thời gian công bố
CREATE INDEX IF NOT EXISTS idx_public_posts_slug ON public_posts(slug);
CREATE INDEX IF NOT EXISTS idx_public_posts_status_published ON public_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_posts_category ON public_posts(category, status);
