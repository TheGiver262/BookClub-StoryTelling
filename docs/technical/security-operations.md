# YSBK — Thiết Kế Bảo Mật, Quản Trị Danh Tính & Vận Hành Hạ Tầng (security-operations.md)

## Cập nhật danh tính và vận hành 21/10/2026

Giữ cơ chế token riêng cho quyền xem/hủy đơn khách, server-side guards, no-store và audit không chứa bí mật. Không đổi public signup hoặc cấp quyền nội bộ theo tài khoản bạn đọc chưa được duyệt. [Publishing/CTV](public-portal-publishing.md) bổ sung ADMIN-only, xóa mềm và thu hồi phiên.

IP chung/NAT và khôi phục quyền khách là rủi ro được nêu trong [nghiên cứu UX](public-reservation-ux-research-2026-10-21.md); chưa đổi hạn mức. Chỉ dùng [beta guide](beta-deployment-guide.md) cho checklist hiện hành, giữ backup trước migration, test DB riêng, chủ sản phẩm sở hữu hạ tầng. Nguồn giá/quota và các guard dự kiến trong snapshot cũ phải đối chiếu runtime trước khi coi đã triển khai. [Session handoff](../SESSION-HANDOFF.md).

Tài liệu đặc tả kiến trúc bảo mật, ma trận phân quyền, mô hình đe dọa (Threat Model), chính sách sao lưu và giới hạn hạn ngạch hạ tầng.  
Ngày lập: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.

---

## 1. Kiến Trúc Quản Trị Danh Tính & Cách Ly Auth (Identity Architecture & ADR 001)

Hệ thống có hai luồng danh tính hoàn toàn tách biệt:

```
[Luồng 1: Bạn Đọc & Khách Công Khai]
Google OAuth / Email + Mật Khẩu
        |
        v
Supabase Auth (Public Realm: email cá nhân thực) ---> Role: GUEST
        |
        +---> Chỉ gửi review vào hàng chờ duyệt, xem danh mục sách; không có quyền nội bộ.

--------------------------------------------------------------------------------

[Luồng 2: Thành Viên & Quản Trị CLB]
Admin cấp Username nội bộ + Mật Khẩu ban đầu
        |
        v
Managed Auth Synthetic Realm: `${normalized_username}@internal.ysbk.edu.vn`
        |
        v
Bảng ánh xạ `internal_identities` (`normalized_username`, `provider_subject`, `member_id`)
        |
        v
Kiểm tra Role & Trạng thái tại Server (đối chiếu `token_version` trên `members`):
  - MEMBER: Quản lý toàn bộ 9 nhóm nghiệp vụ
  - ALUMNI: Chỉ xem hoạt động an toàn (Server Field Allowlist)
  - ADMIN: Quản trị tài khoản, cấp lại mật khẩu, sửa trạng thái TV & xem Audit Log
```

### 1.1 Cơ chế bảo vệ chống leo thang đặc quyền qua Identity Linking (ADR 001)
* **Vấn đề tiềm ẩn trên Supabase Auth:** Nếu tài khoản nội bộ sử dụng email cá nhân ngoài đời của thành viên (vd: `nam@gmail.com`), một kẻ tấn công bên ngoài có thể đăng ký tài khoản khách hoặc đăng nhập bằng Google với cùng email `nam@gmail.com`. Supabase Auth mặc định sẽ tự động liên kết (Account Linking) khiến tài khoản khách chiếm đoạt luôn phiên nội bộ.
* **Giải pháp cô lập kiến trúc (Synthetic Internal Realm):**
  1. Tài khoản nội bộ được Admin provision với email nội bộ nhân tạo: `${normalized_username}@internal.ysbk.edu.vn`. Tên miền nội bộ này không thể xác thực qua Google OAuth hoặc nhận thư từ bên ngoài.
  2. Email liên hệ thực tế của thành viên được lưu riêng biệt trong bảng `members` phục vụ công tác liên lạc nội bộ, hoàn toàn tách rời khỏi credential đăng nhập của nhà cung cấp Auth.
  3. Bảng `internal_identities` lưu ánh xạ duy nhất giữa `normalized_username`, `provider_subject` (UUID từ Supabase Auth), và `member_id`.
  4. Máy chủ cấp phiên làm việc an toàn (Session Cookie `HttpOnly; SameSite=Lax; Secure` cho môi trường production, kèm tùy chọn Bearer token cho API client).
  5. Khi giải mã phiên, máy chủ kiểm tra đối chiếu trực tiếp `token_version` với bảng `members`. Bất kỳ thay đổi quyền/khóa tài khoản nào đều kích hoạt tăng `token_version`, thu hồi tức thì toàn bộ phiên cũ trên cả truy vấn đọc và ghi.

---

## 2. Kiểm Soát Quyền Cựu Thành Viên (Alumni Boundary Enforcement)

Theo quyết định nghiệp vụ đã chốt: Cựu thành viên vẫn giữ tài khoản đăng nhập nội bộ nhưng **chỉ được xem thông tin hoạt động CLB**. Tuyệt đối không được xem dữ liệu cá nhân nhạy cảm, số tiền/tài khoản và không được xuất file.

### 2.1 Ranh giới trường dữ liệu an toàn (Server Field Allowlist)
Máy chủ áp dụng DTO riêng biệt (`AlumniActivityResponseDto`), tuyệt đối không gửi toàn bộ entity DB về trình duyệt rồi ẩn cột ở client:

```typescript
// DTO Cho Phép Dành Riêng Cho Cựu Thành Viên
export interface AlumniActivityDto {
  id: string;
  title: string;
  category: 'EVENT' | 'DUTY_ROSTER' | 'INTERNAL_NEWS';
  publicDescription: string;
  eventDate: string;
  location: string;
  status: string;
  // TUYỆT ĐỐI KHÔNG CÓ CÁC TRƯỜNG DƯỚI ĐÂY:
  // - budgets, actualExpenses (Chi phí tài chính)
  // - bankAccounts, qrCodes (Số tài khoản)
  // - borrowerPhone, candidateScores (PII & Điểm tuyển)
  // - detailedAssigneesWithPhone (SĐT thành viên trực)
}
```

### 2.2 Thu hồi quyền tức thì khi chuyển trạng thái Cựu hoặc Khóa tài khoản
* Mỗi tài khoản có cột `token_version INT DEFAULT 1`.
* Khi Admin thực hiện thao tác: `UPDATE members SET is_alumni = TRUE` hoặc `is_active = FALSE`:
  - Hệ thống tự động tăng `token_version = token_version + 1`.
  - Toàn bộ phiên đang mở ở các thiết bị cũ lập tức bị từ chối truy cập ở request tiếp theo (HTTP 401 Unauthorized), buộc người dùng phải đăng nhập lại để nhận quyền mới đã bị giới hạn.

---

## 3. Mô Hình Đe Dọa & Biện Pháp Kiểm Soát (Threat Model OWASP)

| Mối đe dọa (Threat) | Điểm rủi ro cụ thể tại YSBK | Biện pháp kiểm soát kiến trúc | Bài kiểm thử chứng minh (Test Case) |
|---|---|---|---|
| **Chiếm quyền tài khoản nội bộ** | Thử mật khẩu ngẫu nhiên hoặc mạo danh username | Rate limiting theo IP/Username trên Cloudflare WAF; khóa tài khoản sau 5 lần gõ sai; bắt buộc mật khẩu >= 10 ký tự. | Test brute-force login trả về `429 Too Many Requests`. |
| **BOLA (Broken Object Level Auth)** | Cựu TV đổi ID trên URL để đọc phiếu mượn của bạn đọc | Mọi endpoint `/api/v1/circulation/*` kiểm tra role `ACTIVE_MEMBER` ngay tại máy chủ. Nếu role là `ALUMNI`, trả về `403 Forbidden`. | Gửi request mượn sách bằng JWT của cựu TV -> nhận `403`. |
| **Lộ dữ liệu cá nhân (PII Leak)** | Xuất file hoặc xem danh sách tuyển sinh viên | Tách riêng DTO công khai / nội bộ. Dữ liệu công bố kết quả tuyển (đang chờ CLB chốt danh sách trường: đề xuất mặc định chỉ hiển thị Họ tên và Ban trúng tuyển, ẩn hoàn toàn MSSV, SĐT, Email, điểm số và bài viết; ứng viên tự tra cứu riêng theo mã hồ sơ). Tuyệt đối không public PII nhạy cảm. | Kiểm tra payload response công bố tuyển không chứa trường `phone`, `studentId`, hay `score`. |
| **SQL Injection** | Tìm kiếm sách tiếng Việt, lọc thể loại | 100% câu truy vấn dùng Parameterized Queries (`$1, $2...`) qua thư viện `pg` hoặc Kysely; không nối chuỗi thô. | Thử query `title = "' OR 1=1 --"` -> trả kết quả rỗng an toàn. |
| **Stored XSS** | Bạn đọc chèn mã độc `<script>` vào ô gửi review | Sử dụng thư viện `sanitize-html` để làm sạch nội dung review trước khi lưu DB; React tự động escape HTML khi render. | Gửi review chứa `<img src=x onerror=alert(1)>` -> mã bị vô hiệu hóa. |
| **Formula Injection (CSV/Excel)** | Ứng viên điền tên `=cmd|'/C calc'!A0` vào Form | Khi xuất dữ liệu ra file Excel/CSV, tự động thêm dấu nháy đơn `'` phía trước các ký tự nguy hiểm (`=, +, -, @`). | Kiểm tra file Excel xuất ra không tự động chạy macro hoặc lệnh shell. |
| **Cạn kiệt Quota / DDoS** | Khách hoặc bot spam gửi hàng nghìn đơn tuyển hoặc review | Bật Cloudflare Under Attack Mode và WAF Rate Limiting: Giới hạn tối đa 10 request/phút đối với các endpoint ghi công khai. | Chạy spike test 100 req/s từ 1 IP -> 90 req bị chặn bởi Cloudflare. |

---

## 4. Vận Hành Hạ Tầng, Giới Hạn Quota & Kế Hoạch Backup/Restore

### 4.1 Bảng Phân Tích Giới Hạn Gói Miễn Phí (Free Tier Quota & Nguồn Dữ Kiện)

| Dịch vụ | Hạn mức gói miễn phí hiện hành (Nguồn chính thức & Ngày xác minh) | Mức sử dụng dự kiến của YSBK (Ước tính tải) | Đánh giá & Ngưỡng nâng cấp |
|---|---|---|---|
| **Cloudflare Pages & Workers** | 100.000 requests/ngày; 10ms CPU time/request ([Cloudflare Limits](https://developers.cloudflare.com/workers/platform/limits/) — Xác minh 18/10/2026; phân biệt CPU time với network I/O wait) | Ước tính ~2.000 - 5.000 requests/buổi trực quầy; ngày thường < 1.000 | **[GIẢ ĐỊNH / CHƯA ĐO LƯỜNG THỰC TẾ]** Dự kiến có thể đáp ứng dựa trên tải ước lượng; cần theo dõi số đo thực tế khi chạy thử (UAT). Bắt buộc tách các tác vụ nặng (tạo báo cáo Excel lớn, PDF) để không vượt giới hạn 10ms CPU time của gói Free. |
| **Supabase PostgreSQL** | 500 MB database storage; tối đa 60 direct connections / 200 pooler client connections ([Supabase Pricing & Compute](https://supabase.com/docs/guides/platform/compute-add-ons) — Xác minh 18/10/2026) | Ước tính ban đầu: 5.000 bản sách + 20.000 lượt mượn chiếm ~45–60 MB (chưa tính phình to của GIN index và audit logs) | **[GIẢ ĐỊNH / CHƯA ĐO LƯỜNG THỰC TẾ]** Dự kiến đủ trong giai đoạn thử nghiệm ban đầu; cần theo dõi tốc độ tăng trưởng dung lượng thực tế. Bắt buộc kết nối qua Connection Pooler (Port 6543 / Transaction mode) để tránh cạn kiệt pool kết nối từ serverless edge. |
| **Supabase Storage** | 1 GB dung lượng file lưu trữ ([Supabase Storage](https://supabase.com/docs/guides/storage) — Xác minh 18/10/2026) | Ước tính ~100–200 MB ảnh bìa sách (nén WebP chuẩn 400x600) | **[GIẢ ĐỊNH / CHƯA ĐO LƯỜNG THỰC TẾ]** Dự kiến đủ dùng cho giai đoạn đầu; chưa đo kích thước kho ảnh thực tế. Cần chuyển hướng sang CDN ảnh ngoài nếu số lượng sách vượt 10.000 cuốn. |

### 4.2 Chính sách Sao lưu & Khôi phục (Backup & Disaster Recovery)
* **Quyền sở hữu tài khoản hạ tầng:** Chủ sản phẩm (Product Owner) đứng tên tài khoản Cloudflare, Supabase, nắm giữ Master Key, tài khoản backup và nhận cảnh báo trực tiếp về điện thoại/email cá nhân. **Tuyệt đối không chuyển quyền chủ sở hữu tài khoản cloud cho Ban Chủ Nhiệm khi thay đổi nhiệm kỳ CLB.**
* **RPO (Recovery Point Objective - Đề xuất kỹ thuật, chờ CLB phê duyệt):** $\le 24$ giờ (mức dữ liệu tối đa chấp nhận mất mát nếu thảm họa xảy ra).
* **RTO (Recovery Time Objective - Đề xuất kỹ thuật, chờ CLB phê duyệt):** $\le 4$ giờ (thời gian khôi phục toàn bộ website hoạt động trở lại).
* **Quy trình sao lưu tự động (Đề xuất):**
  1. Hằng ngày vào lúc 02:00 sáng (`Asia/Ho_Chi_Minh`), kịch bản tự động chạy lệnh `pg_dump` trích xuất schema và dữ liệu sạch.
  2. Tệp backup được mã hóa bằng khóa GPG và đẩy về lưu trữ độc lập ngoài tài khoản Supabase (vd: Cloudflare R2 Bucket hoặc Google Drive được bảo vệ 2 lớp).
  3. Định kỳ mỗi học kỳ (6 tháng/lần), thực hiện diễn tập khôi phục (Restore Drill) vào một database local để kiểm tra tính toàn vẹn của tệp backup.

---

## 5. Runbook Vận Hành Thực Tế & Kịch Bản Khôi Phục (Operational Runbook & Disaster Recovery)

### 5.1 Kịch bản Sao Lưu CSDL (Backup Runbook)
Hệ thống cung cấp sẵn các bộ kịch bản sao lưu tương thích cả Windows và Linux/macOS, bảo đảm không hardcode credentials và tự động quét an toàn tệp snapshot:

* **Trên môi trường Windows (PowerShell):**
  ```powershell
  # Đặt biến môi trường kết nối CSDL (không gõ mật khẩu trực tiếp vào terminal)
  $env:DATABASE_URL = "postgres://user:password@db.ysbk.edu.vn:5432/ysbk"
  
  # Thực thi kịch bản sao lưu
  .\scripts\backup.ps1 -OutputDir "./backups"
  ```
* **Trên môi trường Linux / macOS / Docker / CI (Bash):**
  ```bash
  export DATABASE_URL="postgres://user:password@db.ysbk.edu.vn:5432/ysbk"
  chmod +x ./scripts/backup.sh
  ./scripts/backup.sh ./backups
  ```
* **Cơ chế kiểm soát an toàn khi sao lưu:**
  - Script sử dụng tham số `--no-owner --no-acl` để snapshot độc lập hạ tầng, không bị dính quyền sở hữu cục bộ.
  - Tự động chạy quét bảo mật: Nếu tệp snapshot chứa các chuỗi nhạy cảm như `JWT_SECRET=`, `SUPABASE_SERVICE_ROLE_KEY=`, script lập tức cảnh báo và dừng khẩn cấp.

### 5.2 Kịch bản Phục Hồi CSDL Sau Thảm Họa (Disaster Recovery Runbook)
Khi cần khôi phục lại dữ liệu trên CSDL mới (Empty Database):

* **Trên môi trường Windows (PowerShell):**
  ```powershell
  $env:DATABASE_URL = "postgres://user:password@db-recovery.ysbk.edu.vn:5432/ysbk"
  .\scripts\restore.ps1 -BackupFile "./backups/ysbk_backup_20261019_100000.sql"
  ```
* **Trên môi trường Linux / macOS / Docker / CI (Bash):**
  ```bash
  export DATABASE_URL="postgres://user:password@db-recovery.ysbk.edu.vn:5432/ysbk"
  chmod +x ./scripts/restore.sh
  ./scripts/restore.sh ./backups/ysbk_backup_20261019_100000.sql
  ```

### 5.3 Đối Soát Tính Toàn Vẹn Sau Phục Hồi (Post-Restore Invariants)
Mỗi lần phục hồi CSDL bắt buộc thực hiện 3 bước kiểm tra đối soát bất biến nghiệp vụ:
1. **Kiểm tra Schema & Entity Count:** Xác nhận đầy đủ 22 bảng CSDL, toàn bộ indexes (B-Tree, GIN FTS) và triggers logic.
2. **Kiểm tra Cân Đối Sổ Kép Kế Toán (Double-Entry Balance):**
   ```sql
   SELECT 
       SUM(amount) AS total_debit,
       SUM(amount) AS total_credit,
       (SUM(amount) - SUM(amount)) AS diff
   FROM journal_entries;
   -- diff bắt buộc phải bằng đúng 0 (Nợ = Có)
   ```
3. **Bảo Toàn Trạng Thái Phiên & Thu Hồi Quyền (Security State Preservation):**
   - Giá trị `token_version` của từng thành viên được giữ nguyên vẹn.
   - Các tài khoản đã chuyển sang `ALUMNI` hoặc `is_active = FALSE` tuyệt đối không bị hồi sinh phiên cũ hoặc nhận lại quyền nội bộ.

### 5.4 Mục Tiêu SLA Phục Hồi (Recovery SLA - Mục Tiêu Thiết Kế)
* **RPO (Recovery Point Objective - Mục tiêu thiết kế):** Đề xuất $\le 24$ giờ (thực hiện snapshot logic định kỳ hằng ngày hoặc sau ca trực; cần thiết lập cron job tự động hóa có kiểm chứng).
  > [!NOTE] Lưu ý kỹ thuật về PITR: Bản sao lưu logic bằng `pg_dump` không tự động cung cấp khả năng Point-in-Time Recovery (PITR) liên tục từng giây. Để đạt PITR thực tế, cần cấu hình WAL archiving (ví dụ: pgBackRest, WAL-G hoặc tính năng PITR có phí của nhà cung cấp CSDL đám mây).
* **RTO (Recovery Time Objective - Mục tiêu thiết kế):** Đề xuất $\le 4$ giờ. Thử nghiệm in-memory serialize/restore 1.000 bản ghi trên Node.js runtime đạt < 100ms là phép đo kiểm chứng thuật toán xử lý dữ liệu, không thay thế cho bài diễn tập phục hồi thảm họa thực tế (Restore Drill) trên hạ tầng PostgreSQL vật lý có kết nối mạng và chỉ mục lớn.

### 5.5 Quy Trình Kích Hoạt Môi Trường Thật Khi Người Dùng Cấp Hạ Tầng (Live Activation Checklist)
Khi chủ dự án cấp cơ sở dữ liệu PostgreSQL 5432 và Cloudflare Workers runtime thật:
1. **Khởi tạo Schema DDL:**
   ```bash
   psql "$DATABASE_URL" -f docs/technical/schema/01_schema.sql
   ```
2. **Chạy Integration Tests Trực Tiếp:**
   ```bash
   rtk pnpm test:db
   ```
3. **Cấu hình Bí Mật Môi Trường (Cloudflare Secrets):**
   ```bash
   wrangler secret put DATABASE_URL
   wrangler secret put JWT_SECRET
   wrangler secret put RECRUITMENT_WEBHOOK_SECRET
   ```
4. **Deploy Ứng Dụng:**
   ```bash
   rtk pnpm run build
   wrangler deploy
   ```

