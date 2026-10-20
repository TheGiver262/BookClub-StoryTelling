# YSBK — Bộ Sơ Đồ Kiến Trúc & Thiết Kế Kỹ Thuật (diagrams/)

Bộ sơ đồ kiến trúc hoàn chỉnh trả lời toàn bộ các câu hỏi về luồng nghiệp vụ, cơ sở dữ liệu, giao dịch tiền, xác thực và phân quyền của hệ thống YSBK.  
Ngày hoàn thành: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.  
Định dạng: Mermaid Source (`.mmd`), tương thích 100% với trình render Mermaid chuẩn của GitHub, VSCode và Antigravity.

---

## Danh Mục 10 Sơ Đồ Kiến Trúc

| STT | Sơ Đồ Mermaid (.mmd) | Bản Render SVG | Bản Render PNG | Loại Sơ Đồ | Nội Dung & Câu Hỏi Kiến Trúc Trả Lời |
|---|---|---|---|---|---|
| **01** | [01_system_context.mmd](01_system_context.mmd) | [SVG](01_system_context.svg) | [PNG](01_system_context.png) | System Context (C4-L1) | Ranh giới hệ thống: Ai dùng chức năng gì (Khách, Bạn đọc, Thành viên, Cựu TV, Admin)? Các dịch vụ ngoài: Google Form, Ngân hàng thủ công, Cloudflare. |
| **02** | [02_c4_containers.mmd](02_c4_containers.mmd) | [SVG](02_c4_containers.svg) | [PNG](02_c4_containers.png) | C4 Container & Modules | Vị trí Browser, Astro SSR, Cloudflare Workers, PostgreSQL Supabase; luồng gọi giữa các module và ranh giới bảo mật. |
| **03** | [03_erd_full.mmd](03_erd_full.mmd) | [SVG](03_erd_full.svg) | [PNG](03_erd_full.png) | Entity-Relationship (ERD) | Toàn bộ 15 thực thể cơ sở dữ liệu của 9 nhóm nghiệp vụ FR-01..09, khóa chính, khóa ngoại và quan hệ cardinality. |
| **04** | [04_erd_circulation_finance.mmd](04_erd_circulation_finance.mmd) | [SVG](04_erd_circulation_finance.svg) | [PNG](04_erd_circulation_finance.png) | Zoomed ERD: Mượn & Quỹ | Bản phóng đại chi tiết trái tim tài chính: Phiếu mượn, dòng mượn, cọc snapshot, phiên quầy tiền mặt và bút toán sổ kép Nợ/Có của 2 quỹ. |
| **05** | [05_state_machines.mmd](05_state_machines.mmd) | [SVG](05_state_machines.svg) | [PNG](05_state_machines.png) | State Diagram | Máy trạng thái: Bản sách (`AVAILABLE` -> `BORROWED` -> `LOST`), Phiếu mượn (`ACTIVE` -> `OVERDUE` -> `PARTIAL_SETTLED`), và Vòng đời thành viên vs Cựu vs Khóa. |
| **06** | [06_sequence_loan_and_return.mmd](06_sequence_loan_and_return.mmd) | [SVG](06_sequence_loan_and_return.svg) | [PNG](06_sequence_loan_and_return.png) | Sequence Diagram | Giao dịch lõi mượn sách, trả hết, và trả 1 cuốn giữ 1 cuốn (phiếu chuyển tiếp, chuyển liên kết cọc, xử lý cọc bị phạt cấn trừ hết phải thu mới 100k). |
| **07** | [07_sequence_auth_and_roles.mmd](07_sequence_auth_and_roles.mmd) | [SVG](07_sequence_auth_and_roles.svg) | [PNG](07_sequence_auth_and_roles.png) | Sequence Diagram | Quy trình phân quyền danh tính: Đăng nhập username nội bộ, cách ly tài khoản Google của khách, và thu hồi quyền tức thì qua `token_version` khi đổi cựu. |
| **08** | [08_sequence_bookstore_lot.mmd](08_sequence_bookstore_lot.mmd) | [SVG](08_sequence_bookstore_lot.svg) | [PNG](08_sequence_bookstore_lot.png) | Sequence Diagram | Quyết toán lô sách bán mới: Nhận 100 cuốn 65k, bán 60, trả 40; hoàn cọc 1M riêng và thanh toán 3.9M riêng (không gộp thành khoản chi ròng 2.9M). |
| **09** | [09_dfd_security_boundaries.mmd](09_dfd_security_boundaries.mmd) | [SVG](09_dfd_security_boundaries.svg) | [PNG](09_dfd_security_boundaries.png) | Data Flow / Security | Luồng dữ liệu đi qua các ranh giới tin cậy (Trust Boundaries): Dữ liệu công khai, Dữ liệu cá nhân PII, Tiền tệ/Sổ cái, và Mã bảo mật Admin. |
| **10** | [10_deployment_operations.mmd](10_deployment_operations.mmd) | [SVG](10_deployment_operations.svg) | [PNG](10_deployment_operations.png) | Deployment & Ops | Mô hình hạ tầng vật lý: Edge Workers, Supabase Pooling qua PgBouncer, đường Backup tự động hằng ngày và cơ chế cảnh báo của chủ sản phẩm. |

---

### Phương Pháp Render & Kiểm Thử Trực Quan
Toàn bộ 10 sơ đồ đã được tự động biên dịch sang vector SVG và ảnh bitmap PNG độ nét cao (2x DPI) bằng script `scripts/render-diagrams.mjs` thông qua Puppeteer và Chrome Headless. 100% cú pháp Mermaid chuẩn xác, không có lỗi render, nhãn chữ rõ ràng và tương phản màu sắc tuân thủ bảng mã màu nhận diện thương hiệu `design.md`.
