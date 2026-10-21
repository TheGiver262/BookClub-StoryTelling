# YSBK — Mô Hình Domain, Từ Điển Dữ Liệu & Toàn Vẹn PostgreSQL (domain-data.md)

## Bổ sung domain và dữ liệu 21/10/2026

Giữ riêng bạn đọc, tài khoản khách, hồ sơ thành viên và danh tính nội bộ. Một đơn giữ chỗ gồm một bản sách và một ca nhận; tối đa hai cuốn/phiếu mượn không đổi. [Thiết kế giữ chỗ](public-reservation-design.md) điều phối HELD/FULFILLED/CANCELLED/EXPIRED và hạn mức.

[Publishing/CTV](public-portal-publishing.md) mô tả migration 19–20, nội dung công khai/media và cờ CTV/mốc thử thách/đánh giá/xóa mềm. Chưa thêm bảng hoặc cột cho tài khoản bạn đọc hay đổi sách từ [đề xuất UX](public-reservation-ux-research-2026-10-21.md). Lịch sử chứng từ/khóa ngoại phải được giữ; không gộp danh tính chỉ vì trùng SĐT. [Trạng thái hiện hành](../CURRENT-STATE.md).

Tài liệu từ điển dữ liệu, quan hệ bảng, ràng buộc toàn vẹn và chiến lược đánh index cho website YSBK.  
Ngày lập: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.

---

## 1. Thuật Ngữ Nghiệp Vụ & Phân Biệt Thực Thể Cốt Lõi

Để tránh sai lầm trong mô hình hóa và code, hệ thống phân định tuyệt đối các khái niệm sau:

1. **Đầu sách (`book_titles`) ≠ Ấn bản (`book_editions`) ≠ Bản sách vật lý (`book_copies`):**
   * *Đầu sách:* Tác phẩm văn học/khoa học (vd: "Đắc Nhân Tâm").
   * *Ấn bản:* Lần xuất bản cụ thể, NXB, năm xuất bản, có hoặc không có ISBN.
   * *Bản sách:* Cuốn sách vật lý cụ thể có dán mã vạch riêng (barcode: `BK-00101`), vị trí thực tế tại kho hoặc bàn trực, có giá bìa riêng hoặc chưa có giá.
2. **Tài khoản đăng nhập (`auth_users`) ≠ Thành viên CLB (`members`) ≠ Bạn đọc (`borrowers`):**
   * *Bạn đọc:* Sinh viên đến bàn mượn sách, không bắt buộc có tài khoản web.
   * *Thành viên:* Người trong tổ chức CLB, có ban/chức vụ và lịch sử hoạt động.
   * *Tài khoản:* Danh tính định danh kỹ thuật trên hệ thống xác thực.
3. **Quỹ nghiệp vụ (`funds`) ≠ Nơi giữ tiền / Phương thức (`money_locations`):**
   * *Quỹ 1 (Mượn–Trả)* và *Quỹ 2 (Hoạt động)* là 2 thực thể kế toán độc lập.
   * *Hộp tiền mặt quầy* và *Tài khoản ngân hàng CLB* là phương tiện cất giữ/thanh toán.
4. **Cọc bạn đọc (`reader_deposit`) ≠ Cọc nhà sách (`supplier_deposit`):**
   * Cọc bạn đọc là khoản nợ phải trả (nghĩa vụ của CLB với bạn đọc).
   * Cọc nhà sách là khoản phải thu (quyền đòi lại cọc của CLB đối với nhà sách).

---

## 2. Từ Điển Dữ Liệu Chi Tiết (Data Dictionary)

### 2.1 Nhóm Sách & Kho (Catalog & Inventory)

#### Bảng `book_titles` (Đầu sách thư mục)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh duy nhất đầu sách |
| `title` | `VARCHAR(255)` | NOT NULL | Tên tác phẩm |
| `original_title` | `VARCHAR(255)` | NULL | Tên gốc (nếu là sách dịch) |
| `description` | `TEXT` | NULL | Tóm tắt nội dung |
| `search_vector` | `tsvector` | NULL | Cột index tìm kiếm tiếng Việt không dấu |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm tạo |

#### Bảng `book_editions` (Ấn bản xuất bản)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh ấn bản |
| `title_id` | `UUID` | FK -> `book_titles(id)` ON DELETE RESTRICT | Thuộc đầu sách nào |
| `publisher` | `VARCHAR(150)` | NOT NULL | Nhà xuất bản |
| `publish_year` | `SMALLINT` | CHECK (`publish_year > 1900`) | Năm xuất bản |
| `isbn` | `VARCHAR(20)` | NULL | Mã ISBN (không bắt buộc) |
| `cover_image_url`| `TEXT` | NULL | Đường dẫn ảnh bìa |

#### Bảng `book_copies` (Bản sách vật lý cho mượn)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh bản sách |
| `edition_id` | `UUID` | FK -> `book_editions(id)` ON DELETE RESTRICT | Thuộc ấn bản nào |
| `barcode` | `VARCHAR(50)` | UNIQUE, NOT NULL | Mã vạch dán trên gáy sách (vd: `BK-00101`) |
| `location` | `VARCHAR(50)` | CHECK (`location IN ('KHO_THU_VIEN', 'KHO_HOI_SINH_VIEN', 'BAN_TRUC_TAM')`) | Vị trí hiện tại |
| `status` | `VARCHAR(30)` | CHECK (`status IN ('AVAILABLE', 'BORROWED', 'LOST', 'MAINTENANCE')`) | Trạng thái vật lý |
| `cover_price` | `BIGINT` | NULL, CHECK (`cover_price >= 0`) | Giá bìa (NULL đại diện cho "Chưa có giá") |
| `condition_note` | `TEXT` | NULL | Ghi chú tình trạng rách/cũ |

---

### 2.2 Nhóm Mượn–Trả & Cọc (Circulation & Loans)

#### Bảng `borrowers` (Hồ sơ bạn đọc mượn sách)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh bạn đọc |
| `full_name` | `VARCHAR(150)` | NOT NULL | Họ và tên sinh viên |
| `student_id` | `VARCHAR(20)` | NOT NULL | Mã số sinh viên (MSSV Bách Khoa) |
| `school` | `VARCHAR(150)` | NOT NULL | Viện / Trường đào tạo (CNTT, Cơ khí...) |
| `phone` | `VARCHAR(20)` | NOT NULL | Số điện thoại liên hệ (PII bảo mật) |
| `email` | `VARCHAR(150)` | NULL | Email liên lạc |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Ngày tạo hồ sơ |

#### Bảng `loan_receipts` (Phiếu mượn bàn sách)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh phiếu |
| `receipt_number` | `VARCHAR(30)` | UNIQUE, NOT NULL | Số phiếu in (vd: `YSBK-PM-20261018-001`) |
| `borrower_id` | `UUID` | FK -> `borrowers(id)` ON DELETE RESTRICT | Bạn đọc đứng tên mượn |
| `borrow_date` | `DATE` | NOT NULL | Ngày mượn (`Asia/Ho_Chi_Minh`) |
| `due_date` | `DATE` | NOT NULL | Hạn trả (đúng 14 ngày lịch sau ngày mượn) |
| `renew_count` | `SMALLINT` | DEFAULT 0, CHECK (`renew_count BETWEEN 0 AND 3`) | Số lần đã gia hạn (tối đa 3 lần) |
| `status` | `VARCHAR(30)` | CHECK (`status IN ('ACTIVE', 'RETURNED', 'OVERDUE', 'PARTIAL_SETTLED')`) | Trạng thái phiếu |
| `preceding_receipt_id`| `UUID` | NULL, FK -> `loan_receipts(id)` | Khóa ngoại trỏ về phiếu cũ nếu là phiếu chuyển tiếp |
| `created_by` | `UUID` | FK -> `members(id)` | Thành viên trực bàn lập phiếu |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm tạo |

#### Bảng `loan_items` (Chi tiết từng cuốn trong phiếu — Tối đa 2 dòng/phiếu)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh dòng |
| `receipt_id` | `UUID` | FK -> `loan_receipts(id)` ON DELETE CASCADE | Thuộc phiếu nào |
| `copy_id` | `UUID` | FK -> `book_copies(id)` ON DELETE RESTRICT | Bản sách vật lý |
| `deposit_snapshot` | `BIGINT` | NOT NULL, CHECK (`deposit_snapshot >= 50000`) | Snapshot tiền cọc từng cuốn tại thời điểm lập phiếu |
| `returned_at` | `TIMESTAMPTZ` | NULL | Thời điểm mang trả thực tế |
| `is_lost` | `BOOLEAN` | DEFAULT `FALSE` | Đánh dấu sách bị mất |

---

### 2.3 Nhóm Tài Chính & Hai Quỹ (Finance & Accounting)

#### Bảng `funds` (Danh mục Quỹ CLB)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `VARCHAR(30)` | PK (vd: `'FUND_LOAN'`, `'FUND_OPERATION'`) | Mã quỹ |
| `name` | `VARCHAR(100)` | NOT NULL | Tên quỹ (Quỹ Mượn-Trả / Quỹ Hoạt Động) |
| `description` | `TEXT` | NULL | Mục đích sử dụng |

#### Bảng `cash_sessions` (Phiên quầy tiền mặt buổi trực)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `VARCHAR(30)` | PK (vd: `'CS-20261018'`) | Mã phiên quầy theo ngày |
| `session_date` | `DATE` | NOT NULL | Ngày trực quầy |
| `opened_by` | `UUID` | FK -> `members(id)` | Người trực chính mở ca |
| `opening_cash` | `BIGINT` | NOT NULL, CHECK (`opening_cash >= 0`) | Tiền mặt kiểm đếm đầu ca |
| `expected_closing_cash` | `BIGINT` | NOT NULL | Tiền mặt dự kiến theo sổ sách |
| `actual_closing_cash` | `BIGINT` | NULL | Tiền mặt thực tế đếm cuối ca |
| `discrepancy` | `BIGINT` | NULL | Chênh lệch (Thực đếm - Dự kiến) |
| `discrepancy_reason` | `TEXT` | NULL | Bắt buộc giải trình nếu chênh lệch |
| `is_closed` | `BOOLEAN` | DEFAULT `FALSE` | Trạng thái đã đóng ca hay chưa |
| `closed_at` | `TIMESTAMPTZ` | NULL | Thời điểm đóng ca |
| `closed_by` | `UUID` | NULL, FK -> `members(id)` | Thành viên chốt đóng ca |
| `handed_over_from_session_id` | `VARCHAR(50)` | NULL, FK -> `cash_sessions(id)` | Ca trước đó thực hiện bàn giao |
| UNIQUE | `(is_closed) WHERE is_closed = FALSE` | Partial Unique Index | Đảm bảo mỗi thời điểm chỉ có tối đa 1 ca mở |

#### Bảng `journal_entries` (Bút toán sổ kép kế toán nội bộ)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh bút toán |
| `entry_code` | `VARCHAR(40)` | UNIQUE, NOT NULL | Mã chứng từ (vd: `'BT-20261018-0001'`) |
| `fund_id` | `VARCHAR(30)` | FK -> `funds(id)` | Thuộc Quỹ 1 hay Quỹ 2 |
| `source_type` | `VARCHAR(50)` | CHECK (`source_type IN ('LOAN_DEPOSIT', 'DEPOSIT_REFUND', 'FINE_COLLECTION', 'MEMBER_FEE', 'LOT_PAYMENT', 'LOT_DEPOSIT_REFUND')`) | Nguồn nghiệp vụ |
| `source_id` | `VARCHAR(100)` | NOT NULL | ID của phiếu hoặc chứng từ nguồn (tương thích UUID và mã phiên tiền mặt) |
| `debit_account` | `VARCHAR(50)` | NOT NULL | Tài khoản Nợ (vd: `'TIEN_MAT_HOP'`, `'TIEN_NGAN_HANG'`) |
| `credit_account` | `VARCHAR(50)` | NOT NULL | Tài khoản Có (vd: `'COC_PHAI_HOAN'`, `'THU_PHAT'`) |
| `amount` | `BIGINT` | NOT NULL, CHECK (`amount > 0`) | Số tiền nguyên VND (Nợ = Có = amount) |
| `reversal_of_entry_id` | `UUID` | NULL, FK -> `journal_entries(id)` | Khóa ngoại liên kết bút toán gốc nếu là bút toán đảo |
| `cash_session_id` | `VARCHAR(50)` | NULL, FK -> `cash_sessions(id)` | Liên kết phiên quầy tiền mặt bàn trực |
| `notes` | `TEXT` | NULL | Lý do điều chỉnh, đảo sổ hoặc giải trình giao dịch |
| `created_by` | `UUID` | FK -> `members(id)` | Thành viên thực hiện |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm ghi sổ (Bất biến, cấm UPDATE/DELETE qua trigger) |

#### Bảng `deposit_allocations` (Phân bổ & Nghĩa vụ tiền cọc bạn đọc)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh khoản phân bổ cọc |
| `receipt_id` | `UUID` | FK -> `loan_receipts(id)` ON DELETE RESTRICT | Phiếu mượn gắn với khoản cọc |
| `item_id` | `UUID` | NULL, FK -> `loan_items(id)` ON DELETE RESTRICT | Bản sách cụ thể nếu phân bổ theo cuốn |
| `fund_id` | `VARCHAR(30)` | FK -> `funds(id)`, DEFAULT `'FUND_LOAN'` | Quỹ sở hữu nghĩa vụ (Luôn là FUND_LOAN) |
| `original_amount` | `BIGINT` | NOT NULL, CHECK (`original_amount > 0`) | Số tiền cọc thu ban đầu |
| `remaining_amount` | `BIGINT` | NOT NULL, CHECK (`remaining_amount >= 0`) | Số dư cọc còn lại chưa hoàn |
| `status` | `deposit_status` | NOT NULL, DEFAULT `'HELD'` | Trạng thái (`HELD`, `PENDING_REFUND`, `REFUNDED`, `FORFEITED`, `TRANSFERRED`) |
| `payment_method` | `VARCHAR(20)` | CHECK (`payment_method IN ('CASH', 'BANK_TRANSFER')`) | Phương thức đã thu cọc |
| `refund_method` | `VARCHAR(20)` | NULL, CHECK (`refund_method IN ('CASH', 'BANK_TRANSFER')`) | Phương thức hoàn cọc thực tế |
| `transferred_to_receipt_id` | `UUID` | NULL, FK -> `loan_receipts(id)` | Phiếu mới nếu đã chuyển liên kết (Carry-forward) |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm cập nhật cuối |
| UNIQUE INDEX | `(receipt_id, item_id) WHERE status IN ('HELD', 'PENDING_REFUND')` | Partial Unique Index | S04-01: Chặn nhận cọc trùng cho cùng cuốn sách |
| UNIQUE INDEX | `(receipt_id) WHERE item_id IS NULL AND status IN ('HELD', 'PENDING_REFUND')` | Partial Unique Index | S04-01: Chặn nhận cọc trùng cho cùng phiếu mượn |

#### Bảng `refund_intents` (Ý định & Xác nhận hoàn cọc có định danh - S04-01)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh duy nhất ý định hoàn cọc |
| `allocation_id` | `UUID` | FK -> `deposit_allocations(id)` ON DELETE RESTRICT | Khoản cọc nguồn đề xuất hoàn |
| `amount` | `BIGINT` | NOT NULL, CHECK (`amount > 0`) | Số tiền đã chốt đề xuất hoàn |
| `refund_method` | `VARCHAR(20)` | NOT NULL, CHECK (`refund_method IN ('CASH', 'BANK_TRANSFER')`) | Phương thức chi hoàn chốt theo ý định |
| `status` | `VARCHAR(20)` | NOT NULL, CHECK (`status IN ('PENDING', 'CONFIRMED', 'CANCELLED')`) | Trạng thái (`PENDING` -> `CONFIRMED` / `CANCELLED`) |
| `requested_by` | `UUID` | FK -> `members(id)` | Thành viên lập yêu cầu hoàn |
| `confirmed_by` | `UUID` | NULL, FK -> `members(id)` | Thành viên/thủ quỹ xác nhận thực chi |
| `confirmed_at` | `TIMESTAMPTZ` | NULL | Thời điểm xác nhận chi trả |
| `cash_session_id` | `VARCHAR(50)` | NULL, FK -> `cash_sessions(id)` | Ca quầy chi trả nếu hoàn bằng tiền mặt |
| `journal_entry_id` | `UUID` | NULL, FK -> `journal_entries(id)` | Bút toán sổ cái ghi nhận giảm tiền và nghĩa vụ |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm tạo yêu cầu |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm cập nhật cuối |

#### Bảng `revoked_tokens` (Danh sách token bị thu hồi phân tán - S04-04)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `token_hash` | `VARCHAR(64)` | PK | Mã băm SHA-256 của JWT session token bị thu hồi |
| `revoked_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm logout hoặc đổi mật khẩu |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Thời điểm hết hạn của token gốc (dùng cho TTL purge) |

#### Bảng `idempotency_records` (Hợp nhất Idempotency toàn hệ thống)
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / Ghi chú |
|---|---|---|---|
| `id` | `UUID` | PK, Default `gen_random_uuid()` | Định danh bản ghi |
| `actor_id` | `UUID` | FK -> `members(id)` | Thành viên thực hiện (server-trusted) |
| `operation` | `VARCHAR(64)` | NOT NULL | Tên thao tác nghiệp vụ |
| `idempotency_key` | `VARCHAR(128)` | NOT NULL | Khóa chống lặp (từ header X-Idempotency-Key) |
| `payload_hash` | `VARCHAR(64)` | NOT NULL | Mã băm SHA-256 từ canonical JSON payload |
| `status` | `VARCHAR(20)` | CHECK (`status IN ('PROCESSING', 'COMPLETED', 'FAILED')`) | Trạng thái xử lý đồng thời |
| `response_code` | `INT` | NULL | Mã HTTP response đã cache |
| `response_body` | `JSONB` | NULL | Dữ liệu phản hồi đã cache |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm khởi tạo |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Thời điểm cập nhật |
| UNIQUE | `(actor_id, operation, idempotency_key)` | Ràng buộc duy nhất cấp độ DB | Tuần tự hóa concurrency |

---

## 3. Ràng Buộc Toàn Vẹn Cốt Lõi (Database Constraints)

1. **Ràng buộc tối đa 2 cuốn mỗi phiếu (Bảo vệ Concurrency & Invariant ở mức DB):**
   * Được bảo vệ ở 2 tầng:
     - Tầng DB: Trigger `trg_check_max_loan_items` chạy `BEFORE INSERT OR UPDATE OF receipt_id ON loan_items`. Để ngăn chặn race condition khi 2 transaction đồng thời thêm sách vào cùng một phiếu, hàm thực hiện khóa bản ghi phiếu mượn cha:
       `PERFORM 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE;`
       (Nếu là thao tác UPDATE chuyển `receipt_id`, hàm khóa cả hai phiếu theo thứ tự UUID cố định để triệt tiêu nguy cơ deadlock). Sau đó hàm kiểm tra số lượng sách hiện có trên phiếu đích (`COUNT(*) >= 2`), nếu vượt quá sẽ `RAISE EXCEPTION 'Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách.'`. Các thao tác UPDATE thông thường trên các cột khác (`returned_at`, `is_lost`) không kích hoạt trigger này và không bị chặn nhầm.
     - Tầng Use Case: Validation kiểm tra mảng sách đầu vào có độ dài `<= 2`.
2. **Ràng buộc một bản sách chỉ có một lượt mượn đang hiệu lực:**
   * Chỉ mục Unique có điều kiện (Partial Unique Index):
     ```sql
     CREATE UNIQUE INDEX idx_unique_active_copy_loan 
     ON loan_items (copy_id) 
     WHERE returned_at IS NULL AND is_lost = FALSE;
     ```
   * Ràng buộc này đảm bảo ở mức độ Database Engine: Tuyệt đối không bao giờ có 2 người cùng mượn một bản sách tại một thời điểm, kể cả trong các điều kiện tải đồng thời cao.
3. **Ràng buộc cân đối bút toán sổ kép:**
   * Mỗi bản ghi `journal_entries` đại diện cho một cặp định khoản Nợ/Có đối ứng với số tiền `amount > 0`, đảm bảo tổng Nợ luôn bằng tổng Có tuyệt đối trong từng giao dịch.

---

## 4. Chiến Lược Đánh Index & Tìm Kiếm Tiếng Việt

1. **Chuẩn hóa tìm kiếm tiếng Việt không phụ thuộc dịch vụ ngoài:**
   * Kích hoạt PostgreSQL Extension `unaccent` và `pg_trgm`:
     ```sql
     CREATE EXTENSION IF NOT EXISTS unaccent;
     CREATE EXTENSION IF NOT EXISTS pg_trgm;
     ```
   * Do `unaccent` là hàm `STABLE` (không thể dùng trong generated column của PostgreSQL tiêu chuẩn), cột `search_vector` được duy trì tự động thông qua trigger đồng bộ trước khi ghi:
     ```sql
     ALTER TABLE book_titles ADD COLUMN IF NOT EXISTS search_vector tsvector;

     CREATE OR REPLACE FUNCTION update_book_title_search_vector()
     RETURNS TRIGGER AS $$
     BEGIN
         NEW.search_vector := to_tsvector('simple', unaccent(NEW.title || ' ' || COALESCE(NEW.description, '')));
         RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER trg_book_titles_search_vector
     BEFORE INSERT OR UPDATE OF title, description ON book_titles
     FOR EACH ROW EXECUTE FUNCTION update_book_title_search_vector();
     
     CREATE INDEX idx_book_titles_search_vector ON book_titles USING GIN(search_vector);
     ```
   * Hỗ trợ tìm kiếm mờ (Fuzzy Trigram Index) cho tên tác giả và tên sách gõ không dấu:
     ```sql
     CREATE INDEX idx_book_titles_trgm ON book_titles USING GIN (title gin_trgm_ops);
     ```
2. **Indices cho các truy vấn hiệu năng cao:**
   * `idx_loan_receipts_borrower`: Tra cứu lịch sử mượn theo bạn đọc (`borrower_id`).
   * `idx_loan_receipts_due_status`: Quét nhanh các phiếu quá hạn để gọi nhắc (`due_date, status`).
   * `idx_book_copies_barcode`: Quét mã vạch tại quầy trong `< 1ms` (`barcode`).
   * `idx_journal_fund_date`: Đối soát sổ quỹ theo ngày và loại quỹ (`fund_id, created_at`).
