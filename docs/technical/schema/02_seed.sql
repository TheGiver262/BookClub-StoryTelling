-- =====================================================================
-- YSBK PostgreSQL Seed Data v1.0
-- Dữ liệu giả định phục vụ kiểm chứng kỹ thuật local (Mock Testing Seed)
-- =====================================================================

-- 1. SEED FUNDS
INSERT INTO funds (id, name, description) VALUES
('FUND_LOAN', 'Quỹ Hoạt Động Mượn – Trả', 'Quản lý tiền cọc bạn đọc, tiền phạt quá hạn và tiền mặt bàn trực'),
('FUND_OPERATION', 'Quỹ Hoạt Động Chung CLB', 'Quản lý hội phí thành viên, tiền bán sách mới, tài trợ sự kiện')
ON CONFLICT (id) DO NOTHING;

-- 2. SEED MEMBERS (4 Ban)
INSERT INTO members (id, full_name, username, gen, team, role_title, school_year, phone, is_eligible_main_duty, has_paid_fee, is_alumni, is_admin, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'Đặng Quốc Dũng', 'dung.bcn', 'Gen 8', 'BAN_CHU_NHIEM', 'Chủ nhiệm CLB', 'K65 - Viện Cơ khí', '0971112233', TRUE, TRUE, FALSE, TRUE, TRUE),
('00000000-0000-0000-0000-000000000002', 'Nguyễn Thị Ánh', 'anh.haucan', 'Gen 8', 'HAU_CAN', 'Trưởng ban Hậu cần', 'K66 - Viện KT&QL', '0982223344', TRUE, TRUE, FALSE, FALSE, TRUE),
('00000000-0000-0000-0000-000000000003', 'Phạm Hoàng Nam', 'nam.noidung', 'Gen 9', 'NOI_DUNG', 'Thành viên', 'K67 - Trường CNTT&TT', '0963334455', TRUE, TRUE, FALSE, FALSE, TRUE),
('00000000-0000-0000-0000-000000000004', 'Vũ Minh Anh', 'minhanh.ttdn', 'Gen 9', 'TRUYEN_THONG_DOI_NGOAI', 'Thành viên mới (Đang hỗ trợ)', 'K68 - Trường Ngoại ngữ', '0944445566', FALSE, TRUE, FALSE, FALSE, TRUE),
('00000000-0000-0000-0000-000000000005', 'Trần Đức Thắng', 'thang.cuu', 'Gen 7', 'HAU_CAN', 'Cựu Trưởng ban Hậu cần', 'K64 - Đã tốt nghiệp', '0915556677', FALSE, TRUE, TRUE, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed internal_identities (ADR 001)
INSERT INTO internal_identities (member_id, username, normalized_username, provider_subject) VALUES
('00000000-0000-0000-0000-000000000001', 'dung.bcn', 'dung.bcn', 'prov_sub_dung_bcn_001'),
('00000000-0000-0000-0000-000000000002', 'anh.haucan', 'anh.haucan', 'prov_sub_anh_haucan_002'),
('00000000-0000-0000-0000-000000000003', 'nam.noidung', 'nam.noidung', 'prov_sub_nam_noidung_003'),
('00000000-0000-0000-0000-000000000004', 'minhanh.ttdn', 'minhanh.ttdn', 'prov_sub_minhanh_ttdn_004'),
('00000000-0000-0000-0000-000000000005', 'thang.cuu', 'thang.cuu', 'prov_sub_thang_cuu_005')
ON CONFLICT (member_id) DO NOTHING;

-- 3. SEED CATEGORIES & AUTHORS
INSERT INTO categories (id, name) VALUES
('10000000-0000-0000-0000-000000000001', 'Kỹ năng sống'),
('10000000-0000-0000-0000-000000000002', 'Tư duy'),
('10000000-0000-0000-0000-000000000003', 'Công nghệ'),
('10000000-0000-0000-0000-000000000004', 'Văn hóa Bách Khoa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO authors (id, name) VALUES
('20000000-0000-0000-0000-000000000001', 'Dale Carnegie'),
('20000000-0000-0000-0000-000000000002', 'Rosie Nguyễn'),
('20000000-0000-0000-0000-000000000003', 'Robert C. Martin'),
('20000000-0000-0000-0000-000000000004', 'CLB Yêu Sách Bách Khoa')
ON CONFLICT (id) DO NOTHING;

-- 4. SEED BOOK TITLES & EDITIONS & COPIES (Các mốc giá kiểm thử)
-- Sách 1: Giá 74k -> cọc 50k
INSERT INTO book_titles (id, title, description) VALUES
('30000000-0000-0000-0000-000000000001', 'Đắc Nhân Tâm', 'Nghệ thuật thu phục lòng người trong cuộc sống và công việc.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_editions (id, title_id, publisher, publish_year, isbn) VALUES
('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'NXB First News', 2021, '9786045890011')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_copies (id, edition_id, barcode, location, status, cover_price) VALUES
('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'BK-00101', 'BAN_TRUC_TAM', 'AVAILABLE', 74000),
('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'BK-00102', 'KHO_THU_VIEN', 'BORROWED', 74000)
ON CONFLICT (id) DO NOTHING;

-- Sách 2: Giá 75k -> cọc 100k
INSERT INTO book_titles (id, title, description) VALUES
('30000000-0000-0000-0000-000000000002', 'Tuổi Trẻ Đáng Giá Bao Nhiêu?', 'Cuốn sách chia sẻ về hành trình rèn luyện bản thân.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_editions (id, title_id, publisher, publish_year, isbn) VALUES
('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'NXB Hội Nhà Văn', 2020, '9786045890022')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_copies (id, edition_id, barcode, location, status, cover_price) VALUES
('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'BK-00201', 'BAN_TRUC_TAM', 'AVAILABLE', 75000),
('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'BK-00202', 'KHO_HOI_SINH_VIEN', 'AVAILABLE', 75000)
ON CONFLICT (id) DO NOTHING;

-- Sách 3: Giá 230k -> cọc 250k
INSERT INTO book_titles (id, title, description) VALUES
('30000000-0000-0000-0000-000000000003', 'Clean Code — Mã Sạch', 'Cẩm nang cho kỹ sư phần mềm chuyên nghiệp.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_editions (id, title_id, publisher, publish_year, isbn) VALUES
('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'NXB KH&KT', 2019, '9786045890033')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_copies (id, edition_id, barcode, location, status, cover_price) VALUES
('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000003', 'BK-00301', 'KHO_THU_VIEN', 'BORROWED', 230000)
ON CONFLICT (id) DO NOTHING;

-- Sách 4: Không có giá (NULL) -> cọc mặc định 50k
INSERT INTO book_titles (id, title, description) VALUES
('30000000-0000-0000-0000-000000000004', 'Tuyển Tập Văn Hóa Bách Khoa (Cũ)', 'Tài liệu lưu hành nội bộ sinh viên Bách Khoa.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_editions (id, title_id, publisher, publish_year) VALUES
('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'Nội bộ CLB', 2015)
ON CONFLICT (id) DO NOTHING;

INSERT INTO book_copies (id, edition_id, barcode, location, status, cover_price) VALUES
('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000004', 'BK-00401', 'BAN_TRUC_TAM', 'AVAILABLE', NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. SEED BORROWERS
INSERT INTO borrowers (id, full_name, student_id, school, phone, email) VALUES
('60000000-0000-0000-0000-000000000001', 'Trần Minh Quân', '20224567', 'ĐHBK Hà Nội (CNTT)', '0987654321', 'quan.tm224567@sis.hust.edu.vn'),
('60000000-0000-0000-0000-000000000002', 'Lê Thu Hương', '20231234', 'ĐHBK Hà Nội (Cơ khí)', '0912345678', 'huong.lt231234@sis.hust.edu.vn')
ON CONFLICT (id) DO NOTHING;

-- 6. SEED CASH SESSIONS (Ca đóng hôm trước để phục vụ bàn giao, không để ca mở chặn test)
INSERT INTO cash_sessions (id, session_date, opened_by, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, is_closed, closed_at, closed_by) VALUES
('CS-20261017', '2026-10-17', '00000000-0000-0000-0000-000000000002', 350000, 350000, 350000, 0, TRUE, '2026-10-17 17:00:00+07', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 7. SEED BOOKSTORE LOT (Ví dụ đã xác nhận: nhận 100, bán 60, trả 40, cọc 1M hoàn riêng, thanh toán 3.9M riêng)
INSERT INTO bookstore_lots (
  id, lot_name, supplier, received_date, book_title, cover_price, discount_rate, unit_cost, 
  selling_price, received_quantity, sold_quantity, returned_quantity, deposit_paid_to_supplier, 
  deposit_refund_received, settlement_paid, is_settled
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  'Đợt Bán Sách Chào Tân Sinh Viên K69',
  'Nhà Sách Nhã Nam',
  '2026-10-01',
  'Combo Kỹ Năng Sống Bách Khoa',
  100000,
  0.35,
  65000,
  80000,
  100,
  60,
  40,
  1000000,
  1000000,
  3900000,
  TRUE
) ON CONFLICT (id) DO NOTHING;
