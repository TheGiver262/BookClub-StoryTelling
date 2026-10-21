# YSBK — Tài Liệu Thiết Kế Hệ Thống & Backend v1.0

**Cập nhật chat tiếp nối 21/10:** [tài khoản bạn đọc bắt buộc và cổng nội bộ](reader-accounts-local-and-access.md) đã có implementation local, thay quyết định không đăng nhập/tài khoản tùy chọn cho đơn mới. Google-only, phiên một trình duyệt, subdomain nội bộ + Access đã chọn; provider/domain chưa có, chưa cloud. Review [Antigravity](../reviews/2026-10-21-antigravity-review.md) vẫn còn hai findings UI ngoài phạm vi tài khoản.

## Cập nhật trạng thái kỹ thuật 21/10/2026

Đọc [session handoff](../SESSION-HANDOFF.md) và [trạng thái hiện hành](../CURRENT-STATE.md). Các nhãn “chưa triển khai”, “chưa có PostgreSQL” và số operation/test trong snapshot 18/10 phía dưới không là trạng thái hiện tại.

Local đã có giữ chỗ, landing sách, cổng chung, publishing và vòng đời CTV; xem tài liệu chuyên đề để biết đúng bằng chứng. Có 14 mẫu [UI Stitch](../mockups/stitch-ui-2026-10-21/HANDOFF.md) và [kế hoạch UI](../superpowers/plans/2026-10-21-ysbk-soft-ui.md). Workspace đã có source UI/ảnh QA sau concept nhưng chưa review toàn bộ trong lượt bàn giao.

[Nghiên cứu UX đặt/hủy](public-reservation-ux-research-2026-10-21.md) đang mở lại thảo luận, chưa thay luật ba đơn/IP/24 giờ hoặc thêm tài khoản/đổi sách. Local readiness 200 DB/Auth connected lúc bàn giao; chưa deploy beta cloud. Review/log theo chặng giữ nguyên để truy vết.

Tài liệu thiết kế kỹ thuật, kiến trúc phần mềm, cơ sở dữ liệu và hợp đồng API cho Website Quản Lý CLB Yêu Sách Bách Khoa Hà Nội (YSBK).  
Ngày hoàn thành: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.  
Tác giả: Antigravity (Kiến trúc sư hệ thống & Kỹ sư Backend).

---

## 1. Mục Lục Bộ Tài Liệu Kỹ Thuật

| Tài liệu | Nội dung chính | Cấp độ bằng chứng / Trạng thái |
|---|---|---|
| [public-portal-publishing.md](public-portal-publishing.md) | Cổng bạn đọc chung, quản lý sách/ảnh/lịch/sự kiện/tuyển và CTV thử thách 1 tháng | Triển khai local; chưa deploy cloud |
| [book-landing-local.md](book-landing-local.md) | Landing cuốn sách bản chính, tủ sách 50 cuốn/trang, theme công khai/nội bộ và kiểm chứng | Đã tích hợp local 4321; chưa deploy |
| [local-development.md](local-development.md) | Docker local, cổng 4321, tài khoản, volume bền vững, kiểm thử và checklist trước beta | Ưu tiên hiện tại; chưa triển khai beta |
| [beta-deployment-guide.md](beta-deployment-guide.md) | Dashboard Supabase, Hyperdrive, Workers, Turnstile; gói Free, tải thứ Ba/thứ Năm và chi phí chat | Hướng dẫn cấu hình; chưa deploy cloud |
| [beta-verification.md](beta-verification.md) | Thay đổi beta, kết quả kiểm thử local và gate cloud còn mở | Xem bằng chứng theo từng môi trường |
| [architecture.md](architecture.md) | Kiến trúc tổng thể C4, phân rã module, Cloudflare Workers + Supabase PostgreSQL, trade-offs | Thiết kế kiến trúc đề xuất |
| [domain-data.md](domain-data.md) | Mô hình domain, từ điển dữ liệu, toàn vẹn ràng buộc, index & tìm kiếm tiếng Việt | Thiết kế thực thể & DDL đề xuất |
| [transactions-finance.md](transactions-finance.md) | Giao dịch tài chính lõi: mượn, trả/chuyển tiếp, 2 quỹ, cọc/phạt, bán lô, khóa & idempotency | Thiết kế giao dịch & Bút toán |
| [security-operations.md](security-operations.md) | Mô hình danh tính, cách ly Auth, kiểm soát quyền Cựu TV, Threat model, Backup & Quota | Thiết kế bảo mật & Spike danh tính |
| [public-reservation-design.md](public-reservation-design.md) | Cổng công khai/nội bộ, đặt 1 quyển/đơn không đăng nhập, CAPTCHA, 3 suất/SĐT, 3 đơn/IP/24 giờ, hết hạn cuối buổi trực và ca kiểm thử | Nghiệp vụ chốt 20/10; có local, xem bàn giao hiện hành |
| [Kế hoạch đặt sách và kiểm chứng sửa lỗi cũ](../superpowers/plans/2026-10-20-public-reservation.md) | PR-0…PR-9, file map, contract, kiểm thử 49 ca và gate DB/Workers/browser/provider | Kế hoạch gốc 20/10; xem handoff trước khi tiếp tục |
| [implementation-plan.md](implementation-plan.md) | Lát chức năng (Vertical Slices), ma trận phụ thuộc, kế hoạch test và tiến độ D1–D30 | Kế hoạch triển khai đề xuất |
| [openapi.yaml](openapi.yaml) | Hợp đồng API OpenAPI 3.1.0 (26 operations; đã validate 0 lỗi bằng Redocly 2.64.1; các endpoint Event/Loss/Score Audit dự kiến bổ sung ở các chặng sau) | Hợp đồng API (0 errors, 24 warnings) |
| [schema/](schema/) | PostgreSQL DDL (`01_schema.sql`), Seed data (`02_seed.sql`), script kiểm tra toàn vẹn | Có schema/migration và bằng chứng PostgreSQL local; cloud chưa nghiệm thu |
| [diagrams/](diagrams/) | Bộ 10 sơ đồ Mermaid chi tiết: C4, ERD, State machines, Sequence, DFD, Deployment | 10 Sơ đồ (Đã render SVG & PNG) |
| [experiments/](../../experiments/) | Bài thử kỹ thuật local PoC: giao dịch cọc/phạt/chuyển tiếp, thuật toán xếp ca, parser Excel | PoC Local (SQLite/Python simulation; chưa phải PostgreSQL/Auth thật) |

> [!IMPORTANT]
> **Phân Định Rõ Ràng Các Cấp Độ Bằng Chứng Kỹ Thuật (Evidence Boundaries):**
> 1. **Static Analysis & Regex:** `test_sql_schema_syntax.py` chỉ kiểm tra pattern chuỗi, không parse hay execute ngữ pháp PostgreSQL DDL; không thay thế việc apply DDL vào engine PostgreSQL thật.
> 2. **Mô phỏng SQLite & Python In-Memory:** `test_concurrency_idempotency.py`, `test_loan_transactions.py` dùng SQLite và `threading.Lock` tuần tự hóa trong tiến trình, không phản ánh và không kiểm chứng được isolation level, snapshot MVCC hay concurrency lock của PostgreSQL.
> 3. **Bộ phân tích cú pháp chuỗi (Mock Parser):** `test_excel_parser.py` chỉ xử lý mảng chuỗi/dictionary trong bộ nhớ, chưa phải bài thử đọc và giải mã file nhị phân Excel `.xlsx` thực tế.
> 4. **Thuật toán điều phối (Heuristic):** `test_scheduler_fairness.py` kiểm chứng phân bổ ca trên tập dữ liệu thử nghiệm nhưng chưa loại trừ được phản ví dụ R11.
> 5. **Kiểm tra hợp đồng API (OpenAPI Validator):** Đã validate cú pháp bằng Redocly CLI 2.64.1 (`pnpm dlx @redocly/cli lint docs/technical/openapi.yaml`: 0 errors, 24 warnings). Đây là kiểm tra hợp đồng giao tiếp, chưa chứng minh có backend HTTP runtime live phục vụ các endpoint này.
> 6. **Kiểm thử tích hợp PostgreSQL (Integration Tests):** Bộ test harness tại `tests/integration/` yêu cầu instance PostgreSQL test riêng biệt. Khi chưa có runtime (Docker daemon tắt, không có psql trên PATH), cổng DB được ghi nhận là **BLOCKED**, tuyệt đối không dùng SQLite thay thế hay báo PASS giả.

---

## 2. Bảng Truy Vết Nghiệp Vụ & Kỹ Thuật (Traceability Matrix)

| Nhóm chức năng (FR) | Module Backend | Bảng Dữ Liệu Sở Hữu | OpenAPI Tag / OperationId | Quy Tắc Lõi & Bút Toán | Diagram Tham Chiếu | Nghiệm Thu (05-roadmap) |
|---|---|---|---|---|---|---|
| **FR-01: Sách & Mượn–Trả** | `circulation`, `catalog` | `book_titles`, `book_copies`, `loan_receipts`, `loan_items` | `listPublicBooks`, `getBookDetail`, `listLoans`, `createLoanReceipt`, `settleReturnReceipt`, `renewLoanReceipt`, `recordLoanLoss (Dự kiến Chặng 11)` | Max 2 cuốn/phiếu, cọc tự động `max(50k, round50k)`, hạn 14 ngày, phạt 1k/ngày cả phiếu | Diagram 03, 04, 05, 06 | T01–T10, T23–T28, T71–T74 |
| **FR-02: Thành Viên** | `members` | `members` | `listMembers`, `updateMemberStatus`, `listAlumniActivities` | 4 ban chức năng, cựu thành viên chỉ xem, hội phí 100k 1 lần | Diagram 02, 03, 07 | T14, T48, T61, T65 |
| **FR-03: Trực Sách** | `duty` | `duty_shifts`, `duty_assignments` | `listDutyShifts`, `proposeDutyShifts`, `publishDutyRoster` | 2 chính (14-17h) + 3-5 hỗ trợ (13:45-14:00 & 17:00-17:15), soạn link Facebook | Diagram 02, 05, 07 | T15, T36–T42, T45 |
| **FR-04: Tuyển TV** | `recruitment` | `recruitment_drives`, `candidates`, `candidate_scores`, `score_audit_logs` | `ingestFormWebhook`, `scoreCandidate`, `auditScoreHistory (Dự kiến Chặng 17)` | Sync tự động Form, chấm riêng trước + hội đồng sau, audit trail sửa điểm | Diagram 03, 07 | T16, T43–T44, T46–T47, T53 |
| **FR-05: Quỹ & Bán Sách** | `finance`, `sales` | `cash_sessions`, `funds`, `journal_entries`, `bookstore_lots` | `getCashSession`, `closeCashSession`, `settleBookstoreLot`, `getFundsSummary` | 2 quỹ tách biệt, cọc nhà sách 1M hoàn riêng + trả nợ 3.9M riêng | Diagram 04, 05, 08 | T11–T13, T29–T35, T50, T54–T60, T68–T69 |
| **FR-06: Sự Kiện** | `events` | `activities`, `activity_participants` | *(Chưa có OpenAPI operation — Dự kiến Chặng 19)* | Kế hoạch, dự toán & chi phí thực tế liên kết bút toán Quỹ 2 | Diagram 02, 03 | T17 (chi phí quỹ); quản lý sự kiện chưa có ca riêng trong T01–T74 |
| **FR-07: Báo Cáo** | `reporting` | Bảng tổng hợp & Views (`v_loan_summary`, `v_cash_daily` - đề xuất) | `getDashboardKpi`, `exportFinancialReport` | Báo cáo tuần/tháng/quý, xuất Excel/PDF, phân quyền cựu không tải | Diagram 01, 02 | T17, T51, T61 |
| **FR-08: Nhật Ký** | `audit` | `system_audit_logs`, `idempotency_keys` | `listAuditLogs` | Ai, lúc nào, thao tác gì, IP, không ghi token/mật khẩu, chỉ admin xem | Diagram 02, 09 | T67, T70 |
| **FR-09: Phân Quyền** | `identity` | Bảng mapping Managed Auth (thiết kế spike) | `loginInternal`, `loginGuest` | Khách Google/Email, Nội bộ Username+Mật khẩu, Cựu bị lọc trường an toàn | Diagram 07, 09 | T18, T19, T26, T61–T63, T65–T67, T70 |

---

## 3. Quyết Định Kiến Trúc Cốt Lõi (Architecture Decision Summary)

1. **Stack Công Nghệ:**
   - **Frontend:** Astro 7 + React 19 + TypeScript + Tailwind CSS (Đã kiểm chứng build static và tương tác tại `dist/`).
   - **Backend API:** Cloudflare Workers (TypeScript) / Serverless Edge Handler kết nối Supabase PostgreSQL thông qua kết nối có xác thực bảo mật và pooling (Session/Transaction pool).
   - **Cơ Sở Dữ Liệu:** PostgreSQL 16 (trên Supabase), sử dụng kiểu dữ liệu chuẩn `BIGINT` cho tiền tệ (VND nguyên), timestamp UTC kỹ thuật, ngày nghiệp vụ `DATE` tính theo múi giờ `Asia/Ho_Chi_Minh`.
2. **Quy Tắc Quản Trị Danh Tính (Identity Isolation):**
   - Tách biệt tuyệt đối giữa tài khoản Khách (Google / Email tự đăng ký) và tài khoản Nội bộ (Username riêng do Admin CLB cấp trực tiếp).
   - Tuyệt đối không cho phép tài khoản Google của khách tự liên kết (identity linking) để nhận quyền thành viên nội bộ.
3. **Phân Quyền Dành Cho Cựu Thành Viên (Alumni Data Boundary):**
   - Cựu thành viên được cấp quyền truy cập vào endpoint riêng (`/api/v1/alumni/activities`) với danh sách trường cho phép (Allowlist).
   - Tuyệt đối lọc từ phía Server: Ẩn toàn bộ số tiền, tài khoản ngân hàng, thông tin cá nhân bạn đọc/ứng viên, danh sách chi tiết điểm danh và chặn hoàn toàn tính năng xuất file Excel/PDF.
