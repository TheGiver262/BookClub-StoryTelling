# YSBK — Kế Hoạch Triển Khai Backend Theo Lát Chức Năng (implementation-plan.md)

## Điều phối kế hoạch 21/10/2026

Các lát cắt bên dưới là kế hoạch gốc, không là lệnh làm lại code đã có. Đọc [session handoff](../SESSION-HANDOFF.md), [trạng thái hiện hành](../CURRENT-STATE.md), [kế hoạch UI mới](../superpowers/plans/2026-10-21-ysbk-soft-ui.md) và [publishing/CTV](public-portal-publishing.md). Workspace đã có thay đổi UI sau concept; kiểm tra diff/QA trước khi tiếp tục.

Công việc tiếp theo người dùng yêu cầu là chuyển chat để thảo luận UX đặt/hủy. Không tự triển khai tài khoản/đổi sách/IP từ nghiên cứu; nếu được duyệt sau đó mới cập nhật plan/API/test. Chưa commit/push/deploy hoặc reset dữ liệu.

Kế hoạch xây dựng backend chi tiết theo phương pháp **Vertical Slices (Lát cắt chức năng dọc)**, ma trận phụ thuộc, các cổng nghiệm thu kỹ thuật và lộ trình D1–D30.  
Ngày lập: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.

---

## 1. Nguyên Tắc Lập Trình & Phân Chia Lát Cắt (Vertical Slice Architecture)

Mỗi lát cắt (Slice) bao gồm đầy đủ các tầng từ:
`DB Migration -> Repository / SQL Queries -> Use Case Logic / Transaction -> API Endpoint Handler -> Integration Tests`.

Tuyệt đối không xây dựng theo lớp nằm ngang (như viết toàn bộ Repository cho cả 9 module nhưng không chạy được bất kỳ use case nào). Sau mỗi lát cắt, hệ thống phải có tính năng chạy được thực tế và kiểm thử tự động.

---

## 2. Chi Tiết 6 Lát Cắt Kỹ Thuật (Vertical Slices)

```
[Slice 1: Nền Tảng DB & Auth] 
       |
       v
[Slice 2: Danh Mục & Kho Bản Sách]
       |
       v
[Slice 3: Quầy Mượn–Trả, Cọc/Phạt & Sổ Kép] <--- Lõi nghiệp vụ quan trọng nhất
       |
       v
[Slice 4: Thành Viên, Lịch Học & Xếp Ca Trực]
       |
       v
[Slice 5: Tuyển Dụng Form Sync & Kiểm Duyệt Review]
       |
       v
[Slice 6: Hai Sổ Quỹ, Bán Sách Lô, Sự Kiện & Báo Cáo]
```

### 2.1 Slice 1: Nền Tảng Cơ Sở Dữ Liệu, Auth Mapping & Audit Logging
* **Mục tiêu:** Khởi tạo hạ tầng dữ liệu sạch, cơ chế xác thực username nội bộ và hệ thống ghi log kiểm toán.
* **Tệp mã nguồn dự kiến:**
  - `src/db/client.ts`: Quản lý kết nối PostgreSQL qua Connection Pooler.
  - `src/db/migrations/001_initial_schema.sql`: Bộ bảng cốt lõi.
  - `src/modules/identity/auth.service.ts`: Xử lý login, xác thực qua Managed Auth Provider (không tự hash mật khẩu trong ứng dụng), map username sang danh tính managed.
  - `src/middlewares/auth.middleware.ts`: Kiểm tra role, claim và `token_version`.
  - `src/modules/audit/audit.service.ts`: Ghi nhận thao tác actor vào `system_audit_logs`.
* **Tiêu chí nghiệm thu (Gate D3):**
  - Chạy migration thành công trên PostgreSQL local sạch.
  - Đăng nhập username nội bộ thành công, cấp JWT hợp lệ.
  - Đăng nhập Google của khách không thể gọi được các API có tiền tố `/api/v1/internal/*`.

---

### 2.2 Slice 2: Danh Mục Đầu Sách & Quản Trị Kho Vật Lý (Catalog & Inventory)
* **Mục tiêu:** Quản trị thư mục sách, ấn bản, bản sách vật lý tại 2 kho và bàn trực tạm; hỗ trợ tìm kiếm tiếng Việt không dấu.
* **Tệp mã nguồn dự kiến:**
  - `src/modules/catalog/catalog.service.ts`: CRUD đầu sách, ấn bản, barcode bản sách.
  - `src/modules/catalog/catalog.controller.ts`: Endpoint tra cứu công khai và nội bộ.
  - `src/modules/catalog/search.service.ts`: Tìm kiếm Full-Text Search qua `unaccent` và `tsvector`.
* **Tiêu chí nghiệm thu (Gate D7):**
  - Quét mã vạch trả về thông tin bản sách và tiền cọc snapshot tự động trong `< 10ms`.
  - Tìm kiếm sách không dấu (vd: "dac nhan tam") trả về chính xác bản ghi "Đắc Nhân Tâm".

---

### 2.3 Slice 3: Bàn Sách, Mượn–Trả, Cọc/Phạt & Bút Toán Sổ Kép (Circulation Core)
* **Mục tiêu:** Hiện thực hóa trái tim nghiệp vụ CLB: Cho mượn (max 2 cuốn), trả hết, trả một phần lập phiếu chuyển tiếp, gia hạn, báo mất và đối soát hộp tiền ca trực.
* **Tệp mã nguồn dự kiến:**
  - `src/modules/circulation/loan.usecase.ts`: Giao dịch mượn sách có khóa dòng `FOR UPDATE`.
  - `src/modules/circulation/return.usecase.ts`: Giao dịch trả toàn bộ / trả một phần chuyển cọc.
  - `src/modules/circulation/renew.usecase.ts`: Gia hạn trong hạn vs quá hạn chốt phạt.
  - `src/modules/finance/cash-session.service.ts`: Mở ca, đếm tiền đầu/cuối ca, đối soát chênh lệch.
  - `src/modules/finance/journal.service.ts`: Ghi nhận bút toán Nợ/Có cân đối vào `FUND_LOAN`.
* **Tiêu chí nghiệm thu (Gate D12):**
  - Vượt qua 100% các bài test giao dịch: Cọc tự động theo bội 50k; sách không giá cọc 50k; phạt 1k/ngày cả phiếu.
  - Nhánh trả 1 cuốn giữ 1 cuốn: Tạo phiếu chuyển tiếp đúng hạn 14 ngày, reset số lần gia hạn về 0, chuyển liên kết cọc không tạo thu/hoàn tiền giả.
  - Trường hợp phạt cấn trừ hết cọc: Bắt buộc thu cọc mới 100k, tiền mặt tăng đúng 100k.

---

### 2.4 Slice 4: Quản Trị Thành Viên, Lịch Học & Xếp Ca Trực (Members & Duty)
* **Mục tiêu:** Quản trị hồ sơ 4 ban, chứng nhận điều kiện trực chính, parser file Excel lịch học tổng hợp và thuật toán đề xuất ca trực.
* **Tệp mã nguồn dự kiến:**
  - `src/modules/members/members.service.ts`: Danh sách thành viên, cập nhật chức vụ, chuyển cựu.
  - `src/modules/duty/duty-import.service.ts`: Parse file Excel tổng hợp lịch học của ban Hậu cần.
  - `src/modules/duty/duty-scheduler.service.ts`: Thuật toán heuristics đề xuất phân ca: 2 chính (14-17h) + 3-5 hỗ trợ (13:45-14:00 & 17:00-17:15).
  - `src/modules/duty/duty.controller.ts`: Công bố lịch, sinh mẫu văn bản đăng nhóm Facebook.
* **Tiêu chí nghiệm thu (Gate D18):**
  - Thuật toán xếp lịch không bao giờ xếp thành viên mới chưa qua đào tạo làm trực chính.
  - Không xếp người có lịch học trùng khung giờ trực; cảnh báo rõ ràng khi ca thiếu người.

---

### 2.5 Slice 5: Tuyển Dụng Form Sync & Kiểm Duyệt Review (Recruitment & Content)
* **Mục tiêu:** Webhook tiếp nhận đơn Google Form tự động, chấm điểm phỏng vấn độc lập + hội đồng tổng kết, audit sửa điểm và hàng chờ duyệt review sách.
* **Tệp mã nguồn dự kiến:**
  - `src/modules/recruitment/form-webhook.service.ts`: Tiếp nhận đơn mới, chống trùng lặp theo `response_id`.
  - `src/modules/recruitment/scoring.service.ts`: Chấm điểm cá nhân, tổng kết điểm hội đồng, ghi vết sửa điểm.
  - `src/modules/content/moderation.service.ts`: Hàng chờ duyệt cảm nhận của bạn đọc.
* **Tiêu chí nghiệm thu (Gate D23):**
  - Điểm phỏng vấn cá nhân không bị ghi đè mất nguồn khi hội đồng tổng kết.
  - Lịch sử sửa điểm lưu đầy đủ người sửa, điểm cũ, điểm mới và lý do.
  - Cảm nhận của bạn đọc chỉ hiển thị ra ngoài trang công khai sau khi có cờ `APPROVED`.

---

### 2.6 Slice 6: Hai Sổ Quỹ, Bán Sách Mới, Sự Kiện & Báo Cáo Đối Soát (Finance & Reporting)
* **Mục tiêu:** Vận hành độc lập Quỹ 1 và Quỹ 2; quản lý lô sách mới bán thu tiền ngay, quyết toán hoàn cọc 1M riêng và trả nợ 3.9M riêng; xuất báo cáo đối soát tuần/học kỳ.
* **Tệp mã nguồn dự kiến:**
  - `src/modules/sales/bookstore-lot.service.ts`: Nhận lô, theo dõi lượng bán/trả dư, quyết toán nhà sách.
  - `src/modules/events/events.service.ts`: Kế hoạch sự kiện, dự toán và chi thực tế liên kết Quỹ 2.
  - `src/modules/reporting/report.service.ts`: Báo cáo đối soát cọc, sổ quỹ, luồng tiền.
  - `src/modules/reporting/export.service.ts`: Sinh file Excel và PDF báo cáo.
* **Tiêu chí nghiệm thu (Gate D28):**
  - Quyết toán lô sách mới ghi đúng 2 bút toán riêng biệt: Hoàn cọc 1M và Thanh toán 3.9M.
  - Phân quyền Cựu thành viên: Chặn hoàn toàn quyền gọi endpoint xuất file hoặc xem số dư 2 quỹ.

---

## 3. Lộ Trình Triển Khai 30 Ngày (D1 – D30)

| Mốc ngày | Trọng tâm công việc | Đầu ra bắt buộc | Cổng kiểm tra (Gate) |
|---|---|---|---|
| **D1 – D3** | Khởi tạo dự án, thiết lập DB PostgreSQL, bảng cơ sở và Managed Auth mapping | DDL script, migration tool, bài thử Auth username pass | **Gate D3: Auth & DB Pass** |
| **D4 – D7** | Xây dựng Slice 2 (Danh mục sách, ấn bản, mã vạch, 2 kho, tìm kiếm unaccent) | API Catalog, search tiếng Việt không dấu | **Gate D7: Catalog Search Pass** |
| **D8 – D12** | Xây dựng Slice 3 (Lõi mượn–trả, công thức cọc, phạt 1k/ngày, phiếu chuyển tiếp, quầy tiền) | Use cases mượn/trả/chuyển tiếp, sổ kép Quỹ 1, khóa dòng | **Gate D12: Circulation Core Pass** |
| **D13 – D18**| Xây dựng Slice 4 (Thành viên 4 ban, lịch học Excel, thuật toán xếp ca 2 chính + 3-5 hỗ trợ) | Module Members, Parser Excel, Heuristic Scheduler | **Gate D18: Duty Scheduler Pass** |
| **D19 – D23**| Xây dựng Slice 5 (Tuyển dụng Form webhook, chấm riêng/hội đồng, duyệt review) | Sync Form tự động, Rubric scoring, Content moderation | **Gate D23: Recruitment Pass** |
| **D24 – D28**| Xây dựng Slice 6 (Hai quỹ riêng, lô sách mới quyết toán riêng, sự kiện, báo cáo Excel/PDF) | Quỹ 1 & 2, Bút toán lô sách, Export service | **Gate D28: Finance & Export Pass** |
| **D29 – D30**| Tích hợp toàn diện Backend với UI Prototype, chạy bộ test chịu tải giả lập 5.000 cuốn | Báo cáo nghiệm thu cuối cùng, tài liệu bàn giao vận hành | **Gate D30: Final Acceptance** |
