CREATE TABLE reader_bookmarks (
  reader_account_id UUID NOT NULL REFERENCES reader_accounts(id),
  title_id UUID NOT NULL REFERENCES book_titles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reader_account_id, title_id)
);
ALTER TABLE book_reviews ADD COLUMN is_club_review BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE book_reviews r SET is_club_review=TRUE
WHERE EXISTS (SELECT 1 FROM members m WHERE m.id=r.author_id);
