-- Chỉ dành cho database ysbk_local vừa tạo. Không chạy trên beta/production.
BEGIN;
INSERT INTO book_titles (id, title, description) VALUES
 ('30000000-0000-0000-0000-000000000001', 'Đắc Nhân Tâm', 'Dữ liệu kiểm thử local.'),
 ('30000000-0000-0000-0000-000000000002', 'Tuổi Trẻ Đáng Giá Bao Nhiêu?', 'Dữ liệu kiểm thử local.'),
 ('30000000-0000-0000-0000-000000000003', 'Clean Code — Mã Sạch', 'Dữ liệu kiểm thử local.'),
 ('30000000-0000-0000-0000-000000000004', 'Tuyển Tập Văn Hóa Bách Khoa', 'Dữ liệu kiểm thử local.');
INSERT INTO authors (name) VALUES ('Dale Carnegie'), ('Rosie Nguyễn'), ('Robert C. Martin'), ('CLB Yêu Sách Bách Khoa');
INSERT INTO categories (name) VALUES ('Kỹ năng sống'), ('Tư duy'), ('Công nghệ'), ('Văn hóa Bách Khoa');
INSERT INTO book_title_authors (title_id, author_id)
SELECT bt.id, a.id FROM (VALUES
 ('Đắc Nhân Tâm', 'Dale Carnegie'), ('Tuổi Trẻ Đáng Giá Bao Nhiêu?', 'Rosie Nguyễn'),
 ('Clean Code — Mã Sạch', 'Robert C. Martin'), ('Tuyển Tập Văn Hóa Bách Khoa', 'CLB Yêu Sách Bách Khoa')
) AS seed(title, author) JOIN book_titles bt ON bt.title = seed.title JOIN authors a ON a.name = seed.author;
INSERT INTO book_title_categories (title_id, category_id)
SELECT bt.id, c.id FROM (VALUES
 ('Đắc Nhân Tâm', 'Kỹ năng sống'), ('Tuổi Trẻ Đáng Giá Bao Nhiêu?', 'Tư duy'),
 ('Clean Code — Mã Sạch', 'Công nghệ'), ('Tuyển Tập Văn Hóa Bách Khoa', 'Văn hóa Bách Khoa')
) AS seed(title, category) JOIN book_titles bt ON bt.title = seed.title JOIN categories c ON c.name = seed.category;
INSERT INTO book_editions (title_id, publisher, publish_year, cover_image_url)
SELECT id, 'Nhà xuất bản kiểm thử', 2026, '/assets/logo-ysbk.png' FROM book_titles;
INSERT INTO book_copies (edition_id, barcode, location, cover_price)
SELECT be.id, 'LOCAL-' || right(bt.id::text, 1) || '-' || n, 'KHO_THU_VIEN',
  CASE right(bt.id::text, 1) WHEN '1' THEN 74000 WHEN '2' THEN 75000 WHEN '3' THEN 230000 ELSE NULL END
FROM book_editions be JOIN book_titles bt ON bt.id = be.title_id CROSS JOIN generate_series(1, 3) n;
INSERT INTO duty_schedules (id, term_semester, schedule_date, day_of_week, shift_time, location, status, published_at)
SELECT 'local-' || day::date, 'LOCAL-TEST', day::date,
  CASE extract(isodow FROM day) WHEN 2 THEN 'THU_BA' ELSE 'THU_NAM' END,
  '00:00 - 23:59', 'Bàn trực kiểm thử local', 'PUBLISHED', now()
FROM generate_series((clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 28, interval '1 day') day
WHERE extract(isodow FROM day) IN (2, 4);
COMMIT;
