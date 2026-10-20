# ADR 001: Kiến Trúc Xác Thực Managed Auth & Ánh Xạ Tài Khoản Nội Bộ (Username Mapping)

* **Trạng thái:** Đề xuất / Thử nghiệm (Proposed / Experimental — Chờ kiểm chứng trên Managed Provider Live)
* **Ngày quyết định:** 18/10/2026
* **Tác giả:** Antigravity (Kỹ sư Hệ thống YSBK)
* **Phạm vi:** Chặng 03/04 (Runtime backend & managed Auth cách ly nội bộ/khách) — Finding R05 & R06

---

## 1. Bối Cảnh & Vấn Đề (Context & Problem Statement)

Theo quy định tại [02-pham-vi-va-nghiep-vu.md](../../02-pham-vi-va-nghiep-vu.md) và [08-ma-tran-quyen-va-dang-nhap.md](../../08-ma-tran-quyen-va-dang-nhap.md):
1. **Thành viên nội bộ CLB:** Được Ban Quản trị (Admin) cấp trực tiếp tài khoản định danh bằng **Username riêng** (ví dụ `dung.bcn`, `anh.haucan`) và mật khẩu khởi tạo. Thành viên không dùng email cá nhân để đăng nhập vào không gian quản trị.
2. **Khách bạn đọc:** Tự đăng ký tài khoản bằng **Email cá nhân** hoặc đăng nhập qua **Google OAuth**.
3. **Nguy cơ bảo mật (R05):** Các dịch vụ Managed Auth phổ biến (như Supabase Auth / GoTrue) mặc định sử dụng `email` hoặc `phone` làm khóa định danh chính, và tự động kích hoạt tính năng liên kết danh tính (Automatic Identity Linking) nếu một tài khoản Google có cùng địa chỉ email với tài khoản mật khẩu đã tồn tại ([Supabase Identity Linking Doc](https://supabase.com/docs/guides/auth/auth-identity-linking)).
4. Nếu liên kết email thành viên nội bộ trực tiếp vào Managed Auth hoặc gán quyền thông qua `user_metadata` / header, một kẻ tấn công hoặc khách vãng lai dùng tài khoản Google có cùng email có thể chiếm quyền điều khiển tài khoản nội bộ (Account Takeover), hoặc bypass quyền hạn client-side.

---

## 2. Các Lựa Chọn Kiến Trúc Được Cân Nhắc (Options Considered)

### Phương án A: Tự xây dựng hệ thống Auth riêng (Custom Auth: tự hash Bcrypt + tự cấp JWT)
* **Ưu điểm:** Hoàn toàn chủ động trường `username`, không phụ thuộc provider ngoài.
* **Nhược điểm:** Vi phạm nguyên tắc bảo mật và yêu cầu cốt lõi của dự án ("không tự hash mật khẩu trong ứng dụng, dùng Managed Auth Provider"); tăng rủi ro bảo mật lưu trữ hash mật khẩu, thiếu tính năng rate limit bruteforce và quản lý refresh token tiêu chuẩn.
* **Đánh giá:** **BỊ LOẠI**.

### Phương án B: Ép thành viên nội bộ đăng nhập bằng email thay vì username
* **Ưu điểm:** Khớp tự nhiên với API gốc của Supabase Auth (`signInWithPassword({ email, password })`).
* **Nhược điểm:** Phá vỡ nghiệp vụ đã khóa tại tài liệu [08-ma-tran-quyen-va-dang-nhap.md](../../08-ma-tran-quyen-va-dang-nhap.md) ("thành viên nội bộ đăng nhập bằng username được cấp"); làm lộ email cá nhân của thành viên tại bàn trực sách; dễ bị nhầm lẫn và tấn công identity linking từ tài khoản Google của sinh viên.
* **Đánh giá:** **BỊ LOẠI**.

### Phương án C (ĐƯỢC CHỌN): Server-side Username Mapping với Non-routable Internal Realm & Phân Quyền Nguồn Chuẩn Database

---

## 3. Quyết Định Chi Tiết (Decision Details - Phương Án C)

### 3.1 Cấu Trúc Ánh Xạ Danh Tính Phía Server (`internal_identities`)
Hệ thống tạo bảng quan hệ chuyên biệt trong PostgreSQL để ánh xạ danh tính nội bộ:

```sql
CREATE TABLE IF NOT EXISTS internal_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL UNIQUE,
    normalized_username VARCHAR(50) NOT NULL UNIQUE,
    provider_subject VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_internal_identities_normalized ON internal_identities(normalized_username);
```

### 3.2 Cơ Chế Cách Ly Tuyệt Đối Với Khách (Identity Isolation Boundary)
1. **Tạo tài khoản nội bộ (Admin Provisioning):**
   * Chỉ có Quản trị viên (Admin) mới có quyền cấp tài khoản nội bộ. Không tồn tại endpoint công khai cho phép tự đăng ký (Public Self-registration) tài khoản nội bộ.
   * Để Managed Auth lưu trữ mật khẩu an toàn theo chuẩn Bcrypt/Argon2 mà không bị xung đột với email công khai của bạn đọc, server sinh ra một định danh email nội bộ cô lập (Synthetic Internal Realm):
     `auth_email = ${normalized_username}@internal.ysbk.edu.vn`
   * Địa chỉ email liên hệ thực tế của thành viên (`members.email`) được lưu tách biệt trong bảng `members` phục vụ nhận thông báo CLB, tuyệt đối **không** dùng làm username/email đăng nhập trong Auth provider.
2. **Quy trình đăng nhập nội bộ (`POST /api/v1/auth/login-internal`):**
   * Client gửi `{ username, password }`.
   * Server chuẩn hóa username: `normalized = username.trim().toLowerCase()`.
   * Server kiểm tra sự tồn tại trong `internal_identities` và kiểm tra trạng thái thành viên:
     `SELECT m.id, m.is_active, m.is_alumni FROM members m JOIN internal_identities i ON m.id = i.member_id WHERE i.normalized_username = $1`.
   * Nếu tài khoản bị khóa (`is_active = FALSE`), từ chối ngay lập tức với lỗi `401 Unauthorized` (Account Disabled).
   * Server gọi Managed Auth Provider xác thực với `auth_email` và `password`.
   * Provider trả về JWT/session; Server tạo phiên làm việc bảo mật `HttpOnly, Secure, SameSite=Lax` cookie hoặc Authorization token.
3. **Chống Identity Linking tự động:**
   * Do `auth_email` sử dụng domain nội bộ không tồn tại trên internet (`@internal.ysbk.edu.vn`), không ai có thể tạo tài khoản Google với đuôi này để chiếm quyền thông qua cơ chế OAuth linking.
   * Kể cả khi thành viên dùng email cá nhân đăng ký tài khoản khách mượn sách, tài khoản khách đó chỉ có quyền `GUEST` và không bao giờ liên kết với `internal_identities`.

### 3.3 Phân Quyền Động Phía Server (Dynamic Server-Side RBAC)
* **Nguồn quyền duy nhất:** Quyền của actor **luôn được truy vấn từ bảng `members` trong cơ sở dữ liệu** hoặc token đã ký chứa `member_id` được đối soát với `token_version` hiện tại.
* **Tuyệt đối không đọc role từ:**
  - Header client gửi (`X-Role`, `X-User-Role`).
  - Request body hoặc query string.
  - Trường `user_metadata` của Supabase Auth (vì người dùng có thể tự sửa đổi thông qua client SDK nếu RLS không khóa).
* **Cơ chế thu hồi tức thì (Instant Revocation):**
  - Bảng `members` sở hữu cột `token_version INT NOT NULL DEFAULT 1`.
  - Khi Admin đổi trạng thái thành viên (`ACTIVE -> ALUMNI` hoặc `is_active = FALSE`), hệ thống tự động tăng `token_version = token_version + 1` trong cùng transaction.
  - Middleware xác thực tại mọi request kiểm tra `token.token_version === member.token_version`. Nếu lệch, phiên cũ lập tức bị vô hiệu hóa trên cả request đọc lẫn ghi.

### 3.4 Biên Dữ Liệu An Toàn Cho Cựu Thành Viên (Alumni Boundary)
* Cựu thành viên (`is_alumni = TRUE` hoặc role `ALUMNI`) chỉ được phép gọi duy nhất endpoint `/api/v1/alumni/activities`.
* Dữ liệu trả về tuân thủ Allowlist nghiêm ngặt: `{ id, title, description, activityDate, location }`.
* Chặn hoàn toàn: Chi phí, số dư quỹ, số tài khoản ngân hàng, danh sách chi tiết người tham dự, thông tin liên lạc cá nhân (PII), và toàn bộ các chức năng tạo/sửa/xóa hoặc xuất file Excel/PDF.

---

## 4. Hậu Quả & Đánh Đổi (Consequences & Trade-offs)

* **Ưu điểm:**
  - Thiết kế đáp ứng mô hình đăng nhập username cho nội bộ và email/Google cho khách.
  - Tận dụng hạ tầng quản lý mật khẩu của Managed Auth mà không tự lưu trữ hash mật khẩu thô trong ứng dụng.
  - Thiết kế nhằm ngăn chặn nguy cơ OAuth email collision và identity usurpation thông qua synthetic internal realm.
  - Thu hồi quyền tức thời khi đổi nhiệm kỳ hoặc khóa tài khoản thông qua `token_version`.
* **Nhược điểm / Chi phí:**
  - Khi tạo tài khoản nội bộ, server phải thực hiện 2 bước trong transaction/workflow: (1) Tạo user trong Managed Auth provider, (2) Tạo bản ghi trong `members` và `internal_identities`. Cần cơ chế dọn dẹp (cleanup/compensation) nếu bước 2 thất bại.
