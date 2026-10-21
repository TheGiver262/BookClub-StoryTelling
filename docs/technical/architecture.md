# YSBK — Thiết Kế Kiến Trúc Phần Mềm & Phân Rã Module (architecture.md)

## Bổ sung kiến trúc hiện hành 21/10/2026

Stack ưu tiên đã chốt Supabase + Cloudflare Free cho beta, local Docker trước. [Publishing/CTV](public-portal-publishing.md) bổ sung quản trị nội dung và vòng đời nhân sự, không tạo vai trò nội bộ mới từ khách. Cổng `/sach/` chung sáu tab, landing `/` và nội bộ theo session.

Tài khoản bạn đọc cho quản lý giữ chỗ đang [nghiên cứu](public-reservation-ux-research-2026-10-21.md), chưa là một bounded context/API mới được duyệt. Không gắn quyền/lịch sử theo email hoặc SĐT tự khai. [Trạng thái hiện hành](../CURRENT-STATE.md) ưu tiên mô tả stack còn đề xuất ở snapshot cũ.

Tài liệu đặc tả kiến trúc mức hệ thống, ranh giới module nghiệp vụ, công nghệ đề xuất và các quyết định kỹ thuật cốt lõi.  
Ngày lập: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.

---

## 1. Tổng Quan Kiến Trúc (Architectural Overview)

Hệ thống YSBK được thiết kế theo mô hình **Modular Monolith** triển khai trên kiến trúc Serverless Edge:
* **Frontend:** Ứng dụng Astro (SSR + Static Pages cho phần công khai SEO cao) tích hợp React Islands cho các bảng tương tác mật độ cao và khu vực nội bộ.
* **Backend API Gateway & App Engine:** Cloudflare Workers (TypeScript) đóng vai trò trung tâm xử lý nghiệp vụ, kiểm tra xác thực, phân quyền RBAC và thực thi các use case nghiệp vụ.
* **Primary Source of Truth (Database):** PostgreSQL 16 trên Supabase, vận hành bằng mô hình quan hệ chặt chẽ, hỗ trợ giao dịch ACID, khóa dòng (Row-level Locks) và toàn vẹn dữ liệu chứng từ.
* **Identity Management:** Managed Identity kết hợp Server-Side Username Mapping, ngăn chặn hoàn toàn việc leo thang đặc quyền từ tài khoản khách sang nội bộ.

```
+-----------------------------------------------------------------------+
|                             Trình Duyệt                               |
|        [Khách Vãng Lai]       [Bạn Đọc Đăng Ký]      [Thành Viên/Admin] |
+------------------------------------+----------------------------------+
                                     | HTTPS / TLS 1.3
                                     v
+-----------------------------------------------------------------------+
|                 Cloudflare CDN / Edge Network (WAF)                   |
|   - Static Assets Cache (Bìa sách, CSS, JS, Logo CLB)                 |
|   - Rate Limiting chống spam đơn tuyển & bình luận                    |
+------------------------------------+----------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------+
|             Backend Application Layer (Cloudflare Workers)            |
|  +--------------------+---------------------+----------------------+  |
|  |   Identity/Auth    |  Catalog/Inventory  |  Circulation Engine  |  |
|  +--------------------+---------------------+----------------------+  |
|  |  Finance & 2 Funds |  Duty & Rostering   |  Recruitment Drive   |  |
|  +--------------------+---------------------+----------------------+  |
|  |  Events & Budget   |  Content Moderation |  Reporting & Audit   |  |
|  +--------------------+---------------------+----------------------+  |
+------------------------------------+----------------------------------+
                                     | Connection Pooler (Hyperdrive/PgBouncer)
                                     v
+-----------------------------------------------------------------------+
|              Data Persistence Layer (PostgreSQL 16)                   |
|   - ACID Transactions (BEGIN ... COMMIT / ROLLBACK)                   |
|   - Row Locks: SELECT ... FOR UPDATE (Tránh mượn đè 1 cuốn)           |
|   - Double-entry Journal (Bút toán kép Nợ/Có cân bằng)                |
|   - Unaccent Full-Text Search (Tìm kiếm tiếng Việt không dấu)        |
+-----------------------------------------------------------------------+
```

---

## 2. Phân Rã Module Nghiệp Vụ & Ranh Giới Trách Nhiệm (Bounded Contexts)

Hệ thống được chia thành 10 module độc lập về trách nhiệm, giao tiếp thông qua Interface / Service Contracts:

```
                  +--------------------------------+
                  |         Identity / Access      |
                  +---------------+----------------+
                                  |
                                  v
+------------------+     +------------------+     +------------------+
| Catalog/Inventory|<----+   Circulation    +---->|     Finance      |
|  (Đầu sách, bản  |     | (Phiếu mượn, cọc,|     |  (2 Sổ Quỹ, hộp  |
|   sách, 2 kho)   |     |  trả, gia hạn)   |     |   tiền, bán lô)  |
+------------------+     +------------------+     +------------------+
                                  ^                        ^
                                  |                        |
+------------------+     +--------+---------+     +--------+---------+
|     Members      |     |       Duty       |     |   Events/Sales   |
| (Hồ sơ, 4 ban,   +---->|  (Xếp ca Excel,  |     | (Sự kiện, dự     |
|  hội phí, cựu)   |     |   điểm danh bàn) |     |  toán, lô sách)  |
+--------+---------+     +------------------+     +------------------+
         |
         v
+------------------+     +------------------+     +------------------+
|   Recruitment    |     |     Content      |     | Reporting/Audit  |
| (Google Form,    |     | (Review bạn đọc, |     | (Thống kê, xuất  |
|  chấm phỏng vấn) |     |  hàng chờ duyệt) |     |  Excel/PDF, log) |
+------------------+     +------------------+     +------------------+
```

### 2.1 Chi tiết các module:

| Module | Trách nhiệm chính | Dữ liệu làm chủ (Entity) | Quy tắc phụ thuộc & Giao tiếp |
|---|---|---|---|
| **Identity/Access** | Xác thực, phiên, phân quyền RBAC (Khách, TV hoạt động, Cựu, Admin) theo ADR 001 | `internal_identities`, `members` (token_version) | Module độc lập (`src/server/`); kiểm tra phiên và phân quyền RBAC tại Cloudflare Workers router. |
| **Catalog/Inventory**| Quản lý đầu sách, tác giả, thể loại, tình trạng bản sách, 2 kho vật lý + bàn tạm | `book_titles`, `book_editions`, `book_copies` | Cung cấp trạng thái khả dụng cho Circulation; không trực tiếp sửa tiền cọc. |
| **Circulation** | Lập phiếu mượn (max 2 cuốn), nhận cọc, trả sách, gia hạn, chuyển tiếp, báo mất | `loan_receipts`, `loan_items`, `penalties` | **Điều phối Transaction:** Khi phát sinh thu/hoàn tiền, gọi Interface của `Finance` trong cùng một DB transaction. |
| **Finance** | Quản lý 2 quỹ độc lập (Mượn-trả & Hoạt động), phiên quầy tiền mặt, bút toán sổ kép | `funds`, `cash_sessions`, `journal_entries` | Cung cấp API ghi bút toán Nợ/Có. Không phụ thuộc ngược vào Circulation. |
| **Members** | Danh sách thành viên 4 ban, chức vụ theo thời gian, chứng nhận đủ điều kiện trực chính | `members`, `member_roles_history` | Cung cấp danh sách nhân sự đủ điều kiện cho module Duty; quản trị cựu thành viên. |
| **Duty** | Nhận Excel lịch học, thuật toán tự đề xuất ca (2 chính + 3-5 hỗ trợ), công bố & Facebook | `duty_shifts`, `duty_assignments`, `duty_availabilities` | Kiểm tra điều kiện trực chính từ `Members`; không tự tạo tài khoản mới. |
| **Recruitment** | Tiếp nhận webhook Form, chấm điểm riêng phỏng vấn, họp hội đồng, audit sửa điểm | `recruitment_drives`, `candidates`, `rubric_scores` | Lưu lịch sử chấm điểm; trúng tuyển chuyển sang `Members` một lần duy nhất. |
| **Events/Sales** | Quản lý sự kiện, dự toán; nhận lô sách mới, theo dõi bán thu ngay, đối chiếu nhà sách | `events`, `bookstore_lots` | Khi thanh toán nhà sách hoặc chi sự kiện, gọi `Finance` ghi sổ chi phí Quỹ 2. |
| **Content** | Tiếp nhận đánh giá/review từ khách có tài khoản, hàng chờ duyệt, công bố ra public | `book_reviews`, `reader_comments` | Khách gửi cần tài khoản miễn phí; duyệt xong mới hiển thị ra `Catalog`. |
| **Reporting/Audit** | Dashboard KPI tổng hợp, sinh báo cáo tuần/kỳ học, lưu nhật ký thao tác toàn hệ thống | `system_audit_logs`, `report_snapshots` | Đọc dữ liệu từ các module; lọc hoàn toàn trường nhạy cảm khi Cựu TV truy cập. |

---

## 3. Lựa Chọn Công Nghệ & Phân Tích Đánh Đổi (Tech Stack Trade-offs)

### 3.1 Đánh giá Kiến trúc Đề Xuất (Astro + Workers + Supabase)

| Thành phần | Lợi thế vượt trội | Nhược điểm & Rủi ro kỹ thuật | Biện pháp kiểm soát & Giải pháp thiết kế |
|---|---|---|---|
| **Astro 7 (Frontend)** | Tốc độ tải trang cực nhanh, tối ưu SEO vượt trội cho danh mục sách công khai, nhúng React islands mượt mà. | Hai mô hình render (SSR vs Island) cần chia sẻ state qua Store/URL. | Sử dụng Nanostores hoặc LocalStorage adapter để đồng bộ trạng thái giữa các đảo React. |
| **Cloudflare Workers** | Chạy tại Edge phân tán, hạn mức miễn phí 100.000 requests/ngày, bảo vệ DDoS tự nhiên. | Giới hạn thời gian CPU 10ms/request ở gói Free (cần phân biệt rõ thời gian tính toán CPU với thời gian chờ mạng tới Database vùng xa), không hỗ trợ runtime Node.js native đầy đủ. | Tách các tác vụ nặng (sinh PDF/Excel lớn) thành tác vụ phân đoạn hoặc thực hiện qua background queue; sử dụng thư viện nhẹ phù hợp runtime V8. |
| **Supabase PostgreSQL** | PostgreSQL chuẩn mực ACID, hỗ trợ JSONB, RLS, Extension unaccent, pg_trgm cho tìm kiếm tiếng Việt. | Giới hạn 500MB database storage ở gói Free; kết nối đồng thời từ serverless edge dễ gây quá tải connection pool nếu kết nối trực tiếp (Direct Connection). | Bắt buộc kết nối qua Connection Pooler (Transaction Mode, port 6543) hoặc Cloudflare Hyperdrive để gom và tái sử dụng kết nối. |
| **Managed Auth** | Tiết kiệm thời gian tự viết thuật toán mã hóa mật khẩu, session và JWT. | Supabase Auth mặc định định danh bằng Email, dễ bị xung đột khi khách và thành viên trùng email. | **Kiến trúc Server-Side Username Mapping:** Thành viên nội bộ dùng username riêng được map sang danh tính nội bộ cố định; tắt tính năng public signup nội bộ. |

---

## 4. Kiểm Soát Đồng Thời & Ranh Giới Giao Dịch (Concurrency & Transaction Strategy)

1. **Ngăn chặn mượn trùng một bản sách:**
   * Sử dụng lệnh khóa dòng:
     ```sql
     SELECT id, status FROM book_copies WHERE barcode = $1 FOR UPDATE;
     ```
   * Nếu `status != 'AVAILABLE'`, use case lập tức trả về mã lỗi `409 Conflict: Sách đang được mượn bởi bạn đọc khác`.
2. **Khóa chống gửi đúp (Idempotency Key):**
   * Mọi request ghi tài chính (`POST /api/v1/circulation/loans`, `POST /api/v1/circulation/returns`) bắt buộc chứa Header `X-Idempotency-Key: <UUID>`.
   * Bảng `idempotency_records` lưu kết quả xử lý trong 24 giờ. Nếu gặp cùng key, trả ngay kết quả cũ mà không thực thi lại bút toán.
3. **Transaction Boundary:**
   * Toàn bộ việc ghi dòng mượn + chuyển trạng thái bản sách + tạo bút toán cọc + lưu audit log nằm trọn vẹn trong một khối `BEGIN ... COMMIT`. Nếu bất kỳ bước nào lỗi, toàn bộ giao dịch tự động `ROLLBACK`.
