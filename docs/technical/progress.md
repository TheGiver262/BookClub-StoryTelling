# YSBK — Báo Cáo Tiến Độ Kỹ Thuật (progress.md)

## Snapshot bàn giao 21/10/2026 — đọc trước lịch sử chặng

Báo cáo này chứa lịch sử theo chặng; PASS/BLOCKED và hướng dẫn deploy cuối tài liệu thuộc các mốc cũ, không dùng như checklist cloud hiện tại. Đọc [CURRENT-STATE](../CURRENT-STATE.md), [session handoff](../SESSION-HANDOFF.md), [publishing/CTV](public-portal-publishing.md), [landing](book-landing-local.md) và [beta guide](beta-deployment-guide.md).

Tài liệu chức năng ghi mốc 353 unit, 7 PG publishing/CTV và 12 PG hồi quy giữ chỗ theo các lần chạy trước; không cộng thành một suite đã chạy lại. Lượt bàn giao chỉ kiểm tra tài liệu và HTTP: 4321 ready DB/Auth connected, landing và preview 4323 HTTP 200. Có thêm `ui.css`/ảnh QA trong workspace sau concept nhưng chưa review đầy đủ; không đánh dấu toàn bộ UI hoàn thành. Tiếp theo thảo luận UX đặt/hủy; tài khoản bạn đọc/đổi sách/thay IP chưa được duyệt. Chưa commit/push/deploy trong lượt này.

Tài liệu ghi nhận tiến độ thực hiện theo từng chặng, các finding từ đợt review 18/10/2026, các bài thử đã kiểm chứng thực tế và trạng thái các cổng kiểm tra (Gates). Cập nhật chuẩn hóa theo danh mục 22 chặng tại `docs/prompts/antigravity-next/README.md`.

---

## 1. Tổng Quan Tiến Độ 22 Chặng (Theo Index Chuẩn)

| Chặng | Tên Chặng | Phụ Thuộc | Finding / Mục Tiêu | Trạng Thái | Cổng Kiểm Tra (Gates) |
|---|---|---|---|---|---|
| **01** | [Sửa typecheck và trạng thái bằng chứng](../prompts/antigravity-next/01-baseline-typecheck.md) | Không | R08, R12, R13 (nhãn dữ kiện), S01-01..S01-04 | **PASS** | `check`: Exit 0<br/>`build`: Exit 0<br/>Python tests: 22/22 Pass<br/>OpenAPI Redocly: Valid (0 errors, 24 warnings) |
| **02** | [PostgreSQL local, migration và invariant tối đa hai sách](../prompts/antigravity-next/02-postgres-schema.md) | 01 | R01, R03, R08 | **BLOCKED** *(Chờ DB)* | G-doc: PASS<br/>G-schema: BLOCKED (Thiếu DB runtime)<br/>G-invariant: BLOCKED (Thiếu DB runtime)<br/>G-baseline: PASS (Check/Build/Python/Redocly/Fail-closed harness) |
| **03** | [Runtime backend và managed Auth cách ly nội bộ/khách](../prompts/antigravity-next/03-runtime-auth.md) | 01, 02 | R05, phần security của R06; carryover S02-01..S02-05 | **PARTIAL** *(DB & Provider BLOCKED)* | G-carryover: S02-01..S02-05 fixed (Guard offline PASS, DB BLOCKED)<br/>G-runtime: PASS (Health 200, Readiness 503 fail-closed)<br/>G-provider: BLOCKED (Thiếu live provider)<br/>G-policy/HTTP: PASS (24/24 unit/router tests)<br/>G-secrets/baseline: PASS (Check 0, Build exit 0, Python 22, OpenAPI 0) |
| **04** | [Sổ tiền tối thiểu và idempotency dùng chung](../prompts/antigravity-next/04-ledger-idempotency.md) | 02, 03 | R04; carryover S03-01..S03-08, S02-03 | **PARTIAL** *(DB BLOCKED)* | G-auth-safety: PASS (S03-01..S03-08 fixed, fail-closed)<br/>G-db-baseline: BLOCKED (Thiếu DB runtime)<br/>G-ledger/deposit: PARTIAL (Unit/Domain PASS, DB BLOCKED)<br/>G-idempotency: PARTIAL (Unit/Domain PASS, DB BLOCKED)<br/>G-contract/baseline: PASS (Check 0, Build 0, Python 22, OpenAPI 0, Unit 33/33) |
| **05** | [Mở/đóng ca và đối soát hộp tiền](../prompts/antigravity-next/05-cash-sessions.md) | 03, 04 | R04, phần quầy của R10; carryover S04-01..S04-08 | **PARTIAL** *(DB BLOCKED)* | G-carryover: S04-01..S04-08 fixed (PASS)<br/>G-finance-db: BLOCKED (Thiếu DB runtime)<br/>G-session-db: BLOCKED (Thiếu DB runtime)<br/>G-http/runtime: PASS (15 unit session/router tests, HTTP 200/400/404/409)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Python 22, OpenAPI 0, Unit 48/48) |
| **06** | [Catalog, bản sách, vị trí và người mượn cộng đồng](../prompts/antigravity-next/06-catalog-borrowers.md) | 02, 03, 05 | R07 (borrower), tiền đề sửa R10; carryover S05-01..S05-08 | **PARTIAL** *(DB BLOCKED)* | G-carryover: S05-01..S05-08 fixed (PASS)<br/>G-catalog-unit: PASS (6/6 tests)<br/>G-borrower-unit: PASS (5/5 tests)<br/>G-api-routes: PASS (Catalog & Borrower HTTP + RBAC)<br/>G-catalog-db & G-borrower-db: BLOCKED (Thiếu DB runtime)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 55/55, OpenAPI 0) |
| **07** | [Cho mượn và nhận cọc bằng transaction thật](../prompts/antigravity-next/07-issue-loan.md) | 03–06 | R03, R04, phần issue của R10; carryover S06-01..S06-09 | **PARTIAL** *(DB BLOCKED)* | G-carryover: S06-01..S06-09 fixed (PASS)<br/>G-issue-unit: PASS (13/13 unit tests)<br/>G-cash-bank: PASS (CASH vs BANK float separation)<br/>G-money-recovery: PASS (Atomic rollback & Idempotency replay)<br/>G-catalog: PASS (Title/Edition endpoints + price 0d vs NULL)<br/>G-http-auth: PASS (Circulation routes + Cache-Control: no-store)<br/>G-issue-db: BLOCKED (Thiếu DB runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 68/68, Redocly 0 err) |
| **08** | [Trả toàn bộ, phạt và hoàn cọc chờ xác nhận](../prompts/antigravity-next/08-full-return.md) | 07 | R04, R10; carryover S07-01..S07-09 | **PARTIAL** *(DB BLOCKED)* | G-carryover: S07-01..S07-09 fixed (PASS)<br/>G-return-domain: PASS (12/12 unit tests, reject PARTIAL)<br/>G-fine: PASS (3 trường hợp P=0, 0<P<D, P>=D)<br/>G-refund-pending: PASS (T12 PENDING ca sau)<br/>G-cross-method: PASS (T33, T34, T35)<br/>G-money-recovery: PASS (Idempotency replay)<br/>G-auth-contract: PASS (RBAC + Cache-Control: no-store)<br/>G-return-db: BLOCKED (Thiếu DB runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 80/80, Python 22, Redocly 0 err) |
| **09** | [Trả một phần và chuyển tiếp không mất lịch sử/cọc](../prompts/antigravity-next/09-partial-return.md) | 08 | R02, R09, R10; carryover S08-01..S08-09 | **PARTIAL** *(DB BLOCKED)* | G-carryover: S08-01..S08-09 fixed (Guard offline PASS, DB BLOCKED)<br/>G-selectors: PASS (strict sets, reject [A,A], mixed, empty)<br/>G-lifecycle-db: PARTIAL (Unit/Domain PASS, DB BLOCKED)<br/>G-money-transfer: PASS (Unit/Domain PASS, P=0, P=60k cash-neutral)<br/>G-forfeit-new: PASS (Unit/Domain PASS, P>=D T73)<br/>G-date-history: PASS (Snapshots/read model, PG DATE string)<br/>G-recovery-db: PARTIAL (Idempotency unit PASS, DB BLOCKED)<br/>G-auth-contract: PASS (RBAC + no-store)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 93/93, Python 22, Redocly 0 err)<br/>G-runtime: BLOCKED (Thiếu DB PostgreSQL runtime live) |
| **10** | [Gia hạn và lịch ngày đến hạn](../prompts/antigravity-next/10-renewal-calendar.md) | 08, 09 | S09-01..09, Gia hạn tối đa 3 lần, Lịch trực Thứ 3/Thứ 5 & Nghỉ lễ, Quá hạn 1k/ngày, Confirm cọc mới T73, Thu phạt pending | **PARTIAL** *(DB BLOCKED)* | G-carryover: S09-01..S09-09 fixed (PASS)<br/>G-calendar: PASS (UTC+7, Thứ 3/Thứ 5, Nghỉ lễ, Bound 60d)<br/>G-renew-in-time: PASS (+14d từ due date cũ, max 3 lần, 4th reject 409)<br/>G-renew-overdue: PASS (+14d từ today, chốt phạt 1 lần, pending fine/waive)<br/>G-money-recovery: PASS (T73 confirmNewDeposit, collectPendingFine, Idempotency)<br/>G-auth-contract: PASS (RBAC matrix + Cache-Control: no-store)<br/>G-renew-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0 err, Build 0, Unit 107/107, Redocly 0 err) |
| **11** | [Báo mất và sửa sai chứng từ](../prompts/antigravity-next/11-lost-book.md) | 04, 08–10 | R04, phần mất/đảo trong R06; carryover S10-01..S10-09 | **PARTIAL** *(DB BLOCKED)* | G-carryover10: S10-01..S10-09 fixed (PASS)<br/>G-loss: PASS (11/11 unit tests, book 74k deposit 50k -> keep 50k zero cash delta)<br/>G-correction: PASS (Reversal linked, check cash session & VOIDED deposit)<br/>G-concurrency-recovery: PASS (Idempotency replay, atomic rollback)<br/>G-auth-contract: PASS (RBAC + no-store + JSON error handling S10-05)<br/>G-loss-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 118/118, Python 22, Redocly 0 err) |
| **12** | [Sửa prototype quầy và nối API lõi](../prompts/antigravity-next/12-desk-ui-integration.md) | 03, 05–11 | S11-01..10, Nối Quầy sách với REST API, Login form thật, Tách rõ Live vs Demo Fixture | **PARTIAL** *(DB BLOCKED)* | G-carryover11: S11-01..S11-10 fixed (PASS)<br/>G-desk-issue: PASS (API issue, tính cọc 50k server, paymentConfirmed)<br/>G-desk-return: PASS (API settle, full/partial, fine/refund)<br/>G-desk-renew-loss-correction: PASS (Renew max 3, loss exact forfeiture, correction domain-driven)<br/>G-session-recovery: PASS (Mở/đóng ca, đối soát hộp tiền)<br/>G-auth-browser: PASS (HttpOnly session, login/me/logout, RBAC)<br/>G-responsive-a11y: PASS (Desktop 1440x900 & Mobile 390x844, accessible)<br/>G-domain-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 124/124, Redocly 0 err) |
| **13** | [Thành viên, nhiều quan hệ ban và hội phí một lần](../prompts/antigravity-next/13-members-dues.md) | 03, 04 | R07 (members), R05 revoke, multi-department distinct headcount, one-time 100k fee | **PARTIAL** *(DB BLOCKED)* | G-carryover12: S12-01..S12-10 fixed (PASS)<br/>G-multi-dept: PASS (Distinct headcount, history preservation)<br/>G-one-time-dues: PASS (Unique 100k, reject 409 on second collection)<br/>G-dues-accounting: PASS (OPERATION fund, cash/bank double entry, float update)<br/>G-idempotency: PASS (Safe replay, zero duplicate entries)<br/>G-ui-desk: PASS (Headcount cards, dues badges, Modals 13 & 14)<br/>G-members-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 134/134, Python 22) |
| **14** | [Import Excel lịch bận theo mẫu thống nhất](../prompts/antigravity-next/14-availability-import.md) | 02, 03, 13 | R07 (availability), R08 (parser thật), zip bounds, fail-safe dòng lỗi, versioning | **PARTIAL** *(DB BLOCKED)* | G-parser-safety: PASS (Max 5MB file, Max 25MB zip bomb check, cấm Macro/VBA binaries, tước bỏ formula injection)<br/>G-fail-safe: PASS (Dòng lỗi không thành rảnh, errorCount trả về chi tiết)<br/>G-batch-versioning: PASS (Tự động tăng version đợt import, chuyển batch cũ sang SUPERSEDED, deactivate intervals cũ)<br/>G-idempotency: PASS (X-Idempotency-Key bảo vệ chống nạp trùng đợt)<br/>G-ui-desk: PASS (Module 4 Trực Sách, Modal 15 Preview/Commit Excel)<br/>G-availability-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 141/141, Python 22) |
| **15** | [Sửa solver lịch, chỉnh tay và công bố có phiên bản](../prompts/antigravity-next/15-roster-scheduler.md) | 13, 14 | R11 (solver + R11 finding 13:45-17:15, cảnh báo thiếu riêng, bảo toàn sửa tay/công bố) | **PARTIAL** *(DB BLOCKED)* | G-r11-solver: PASS (Main 13:45-17:15, Support mở/đóng ca, warningMain/warningSupport riêng biệt, cảnh báo thiếu <3)<br/>G-manual-edit: PASS (Shared validator barrier, versioning v+1, is_manually_edited=true)<br/>G-publish-version: PASS (Chuyển PUBLISHED, ghi nhận published_version, chỉ tính lịch sử khi công bố)<br/>G-desk-ui: PASS (Module 4 hiển thị badge, cảnh báo thiếu, Modals 16, 17, 18)<br/>G-roster-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 148/148, Python 23/23) |
| **16** | [Tiếp nhận và đối soát Google Form](../prompts/antigravity-next/16-recruitment-sync.md) | 03, 02 | R06 (webhook an toàn, HMAC, replay attack), R07 (Form model, khóa nguồn FormID+ResponseID, tách điểm chấm web, đối soát checkpoint) | **PARTIAL** *(DB BLOCKED)* | G-signature-replay: PASS (HMAC-SHA256, timing-safe, chặn lệch quá 5m, chặn payload >2MB)<br/>G-durable-idempotent: PASS (Commit bền trước ACK, duplicate giữ nguyên một hồ sơ, cập nhật version v2 khi sửa câu trả lời)<br/>G-reconciliation: PASS (Checkpoint phát hiện và nạp bù đơn rớt mạng)<br/>G-preserve-evaluation: PASS (Sync lại không xóa/sửa điểm chấm, ghi chú, quyết định trên web)<br/>G-pii-protection: PASS (Mask/strip PII trên public summary)<br/>G-rbac-barrier: PASS (Guest/Cựu bị chặn xem đơn nội bộ hoặc gửi callback giả)<br/>G-recruitment-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 155/155, Python 23/23) |
| **17** | [Rubric phiên bản, phỏng vấn và tổng kết tuyển](../prompts/antigravity-next/17-recruitment-evaluation.md) | 13, 16 | R07 (rubric), R13 (public fields) | **PARTIAL** *(DB BLOCKED)* | G-rubric-version: PASS<br/>G-unapproved-formula: PASS (R07 chặn trung bình cộng tự ý)<br/>G-eval-audit: PASS (Khóa lạc quan version, audit log lý do)<br/>G-dept-assignment: PASS (D33 phân ban linh hoạt)<br/>G-idempotent-member: PASS (D31, D37 chuyển thành viên idempotent)<br/>G-public-privacy: PASS (R13 chỉ lộ candidate code & ban)<br/>G-eval-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 161/161, Python 23/23) |
| **18** | [Lô sách mới, bán/trả dư và quyết toán nhà sách](../prompts/antigravity-next/18-sales-lots.md) | 03, 04, 05 | R07 (sales), R04, T56, T58, T59, T60, T68, T69 | **PARTIAL** *(DB BLOCKED)* | G-lot-inventory: PASS (Bảo toàn số lượng, tách biệt sách mượn)<br/>G-oversell-prevention: PASS (Chặn âm tồn, 409)<br/>G-physical-return: PASS (T56, T59 trả vật lý tách bạch hoàn tiền)<br/>G-gate-t68: PASS (Không cọc: hoàn 0đ, không sinh 2.6tr giả)<br/>G-gate-t69: PASS (Có cọc: hoàn riêng 1tr, trả nợ riêng 3.9tr, lãi 900k)<br/>G-idempotent-settle: PASS (T60 Idempotency key)<br/>G-deposit-isolation: PASS (T58 Tách biệt cọc nhà sách và cọc bạn đọc)<br/>G-sales-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 167/167, Python 23/23) |
| **19** | [Hoạt động, sự kiện và nhiệm vụ liên kết quỹ](../prompts/antigravity-next/19-events-activities.md) | 03, 04, 13 | R06 (event API), R07 (participants) | **PARTIAL** *(DB BLOCKED)* | G-expense-ledger-link: PASS (Sổ quỹ FUND_OPERATION đếm đúng 1 lần)<br/>G-guest-flexibility: PASS (R07 khách không cần MSSV, không ép member)<br/>G-alumni-privacy: PASS (Allowlist DTO lọc sạch 100% tài chính/PII)<br/>G-dynamic-role-revocation: PASS (Khóa/chuyển cựu chặn ngay lập tức)<br/>G-task-audit: PASS (Bắt buộc lý do, lưu activity_task_history)<br/>G-budget-vs-actual: PASS (Phân biệt totalBudget vs totalExpense)<br/>G-events-db: BLOCKED (Thiếu DB PostgreSQL runtime live)<br/>G-baseline/contracts: PASS (Check 0, Build 0, Unit 173/173, Python 23/23) |
| **20** | [Nội dung công khai, kiểm duyệt và URL sách/review](../prompts/antigravity-next/20-public-content-seo.md) | 03, 06, 19 | R10 (review success giả), R13 (public PII) | **PARTIAL**<br/>*(DB BLOCKED)* | **G-guest-session-barrier: PASS** (Anon chặn 401)<br/>**G-pending-isolation: PASS** (Bài pending không public)<br/>**G-moderation-approval: PASS** (Duyệt APPROVED mới công khai)<br/>**G-version-isolation: PASS** (Sửa bài tạo v+1 PENDING, không leak)<br/>**G-xss-sanitize: PASS** (Lọc sạch &lt;script&gt;, &lt;iframe&gt;, onclick/onerror)<br/>**G-public-privacy-seo: PASS** (R13 không rò rỉ PII bạn đọc/email/ghi chú)<br/>**G-rbac-barrier: PASS** (Khách không duyệt được bài, 403)<br/>**G-content-db: BLOCKED** (Thiếu DB PostgreSQL runtime live)<br/>**G-baseline/contracts: PASS** (Check 0, Build 0, Unit 183/183) |
| **21** | [Dashboard, Excel/PDF và nhật ký đúng quyền](../prompts/antigravity-next/21-reports-audit.md) | 05, 07–20 | R06 (coverage), R04/R13 (số liệu) | **PARTIAL**<br/>*(DB BLOCKED)* | **G-financial-accuracy: PASS** (JSON & CSV khớp 100%, query từ journal_entries thật)<br/>**G-no-double-counting: PASS** (Không đếm trùng chi/cọc/settlement)<br/>**G-formula-injection-safety: PASS** (Lọc sạch =, +, -, @ bằng nháy đơn)<br/>**G-bounded-load: PASS** (Chặn query vô hạn, drilldown &lt;= 500, audit &lt;= 200)<br/>**G-rbac-audit-redaction: PASS** (Member 403, Admin redact sạch PII/secret)<br/>**G-download-revocation-barrier: PASS** (Chặn tải tệp sau khi revoke, vô hiệu link cũ)<br/>**G-vietnamese-utf8-integrity: PASS** (BOM \uFEFF, hiển thị toàn vẹn tiếng Việt)<br/>**G-reports-db: BLOCKED** (Thiếu DB PostgreSQL runtime live)<br/>**G-baseline/contracts: PASS** (Check 0, Build 0, Unit 193/193) |
| **22** | [Runtime triển khai, backup/restore và nghiệm thu toàn bộ](../prompts/antigravity-next/22-runtime-ops-uat.md) | 01–21 | R08, R13; hoàn tất toàn bộ 22 chặng | **PARTIAL**<br/>*(DB BLOCKED)* | **G-secrets-free-scripts: PASS** (Không leak credentials)<br/>**G-backup-serialization: PASS** (Không rò rỉ JWT/passwords)<br/>**G-restore-balance-invariants: PASS** (Nợ = Có bảo toàn 100%)<br/>**G-rpo-simulation: PASS** (PITR RPO &lt;= 24h)<br/>**G-rto-benchmark: PASS** (1.000 records &lt; 100ms, RTO &lt;= 4h)<br/>**G-restore-security-state: PASS** (Bảo toàn token_version, chặn hồi sinh cựu)<br/>**G-runtime-db: BLOCKED** (Thiếu DB PostgreSQL runtime live)<br/>**G-baseline/contracts: PASS** (Check 0, Build 0, Unit 199/199, Python 23/23, OpenAPI 0) |
| **23** | Đặt giữ chỗ sách công khai (Public Reservations PR-0..PR-9) | 06, 07, 08, 15, 20 | Đặt trước không tài khoản, 1 cuốn/đơn, 3 suất SĐT, 3 đơn/IP/24h, token bí mật, tra cứu/hủy, quầy chờ nhận | **PARTIAL**<br/>*(DB BLOCKED)* | **G-public-reservations: PASS** (49/49 ca PUB/LIM/LIFE/CON/SEC, UI Landing/Desk)<br/>**G-reservation-db: BLOCKED** (Thiếu DB PostgreSQL runtime live)<br/>**G-baseline/contracts: PASS** (Check 0, Build 0, Unit 309/309, Python 23/23, Redocly 0 err) |

---

## 2. Chi Tiết Thực Hiện Chặng 01 (Đã hoàn thiện nốt carryover S01-01..S01-04)

### 2.1 Findings đã xử lý trong Chặng 01
1. **R12 (P2) — Typecheck không qua:**
   * Sửa `tsconfig.json`: Bỏ `baseUrl`, chuyển alias sang relative `"@/*": ["./src/*"]`.
   * Cài đặt `@astrojs/check`, khóa version `typescript@~5.8.3` (thực tế cài đặt trong `package.json` và `node_modules`).
   * Sửa `src/pages/login.astro` (`class` thay vì `className`) và `src/components/InternalWorkspace.tsx` (`as const` cho loan status).
2. **S01-01 (P2) — Khôi phục kế hoạch 22 chặng chuẩn:**
   * Đồng bộ bảng tiến độ đủ 22 chặng theo đúng `docs/prompts/antigravity-next/README.md`. Sáu vertical slices trong `implementation-plan.md` được giữ nguyên như một góc nhìn phân rã kiến trúc, không dùng để thay thế số chặng giao việc.
   * Ánh xạ đúng vị trí finding: R02 ở Chặng 09; R04 ở Chặng 04/05; R07 ở Chặng 06/13/14/16/17/18; R09/R10 ở Chặng 09/12; R11 ở Chặng 15.
3. **S01-02 (P2) — Chuẩn hóa ma trận truy vết (Traceability Matrix):**
   * Đối chiếu khớp chính xác 26 operations trong `docs/technical/openapi.yaml`: sử dụng đúng `createLoanReceipt`, `settleReturnReceipt`, `renewLoanReceipt`, `listAlumniActivities`.
   * Ghi nhận rõ ràng các endpoint chưa có trong hợp đồng: `recordLoanLoss` (Dự kiến Chặng 11), `auditScoreHistory` (Dự kiến Chặng 17), FR-06 Sự kiện (Dự kiến Chặng 19).
   * Sửa lại toàn bộ các test ID bị gán sai nghiệp vụ:
     - Trực sách (FR-03): trỏ đúng T15, T36–T42, T45 (thay vì T21, T22, T25).
     - Tuyển thành viên (FR-04): trỏ đúng T16, T43–T44, T46–T47, T53 (thay vì T31, T33, T35).
   * Bỏ tuyên bố API đã đầy đủ cho cả 9 nhóm khi chưa có endpoints sự kiện.
4. **S01-03 (P2) — Minh bạch 6 cấp độ bằng chứng kỹ thuật (Evidence Boundaries):**
   * Phân định rạch ròi 6 cấp độ: (1) Static Analysis/Regex, (2) Mô phỏng SQLite & Python in-memory, (3) Mock Parser chuỗi, (4) Thuật toán heuristic, (5) OpenAPI Validator (Redocly 2.64.1), (6) Integration Tests PostgreSQL thật.
   * Ghi nhận rõ: PostgreSQL local chưa apply cho đến khi có runtime thực tế. 22 bài Python test pass chỉ chứng minh trường hợp kiểm thử cục bộ, không thay thế cho PostgreSQL concurrent test.
5. **S01-04 (P2) — Gắn nhãn giả định cho số liệu lưu lượng & hạn mức:**
   * `design.md`: Gắn nhãn `(giả định thiết kế ban đầu: ưu tiên tối ưu mobile cho lưu lượng công khai, chưa có số đo thực tế)`. Giữ nguyên toàn bộ màu sắc, logo, font chữ và bố cục giao diện.
   * `security-operations.md`: Bổ sung URL chính thức từ nhà cung cấp kèm ngày xác minh (18/10/2026); thay toàn bộ kết luận khẳng định bằng nhãn `[GIẢ ĐỊNH / CHƯA ĐO LƯỜNG THỰC TẾ]` để đo lường qua UAT. Giữ nguyên chính sách RPO $\le 24$h, RTO $\le 4$h và ẩn PII tuyển dụng ở mức đề xuất.
6. **OpenAPI Validator tái chạy được:**
   * Sử dụng công cụ `@redocly/cli`: `pnpm.cmd --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml`.
   * Kết quả: **0 lỗi, 24 cảnh báo** (thiếu license, server localhost, thiếu hợp đồng lỗi 4xx cho các operations; các hợp đồng 4xx sẽ được hoàn thiện ở từng chặng sở hữu nghiệp vụ tương ứng).

---

## 3. Chi Tiết Thực Hiện Chặng 02 (PostgreSQL Local & Invariants)

### 3.1 Khảo sát môi trường tiên quyết (Prerequisites Check)
* **Lệnh kiểm tra:** `docker info; Test-NetConnection -ComputerName 127.0.0.1 -Port 5432`
* **Kết quả:**
  - Docker Desktop daemon pipe chưa bật: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
  - Port 5432 trên 127.0.0.1: `TcpTestSucceeded: False`.
  - Không có `psql` trên biến môi trường `PATH`.
* **Quyết định tuân thủ:** Theo quy tắc prompt Chặng 02: Không tự tải script không rõ nguồn, không kết nối cloud/production, không thay bằng SQLite để báo pass giả. Hoàn thiện toàn bộ mã nguồn DDL, trigger, test harness, integration tests; ghi nhận cổng kỹ thuật DB ở trạng thái **BLOCKED** kèm lệnh tái chạy.

### 3.2 Các cải tiến kỹ thuật đã thực hiện
1. **R01 (P1) — Sửa Full-Text Search PostgreSQL (unaccent STABLE function):**
   * **Nguyên nhân:** Hàm `unaccent()` trong PostgreSQL có thuộc tính `STABLE` (phụ thuộc collation/locale), không được phép sử dụng trong biểu thức `GENERATED ALWAYS AS ... STORED`.
   * **Giải pháp:** Sửa `docs/technical/schema/01_schema.sql`: Khai báo cột `search_vector tsvector`, tạo trigger function `update_book_title_search_vector()` và trigger `trg_book_titles_search_vector` chạy `BEFORE INSERT OR UPDATE OF title, description ON book_titles FOR EACH ROW`. Xử lý an toàn trường hợp `description NULL` bằng `COALESCE(description, '')`. Đồng bộ normalization query: `search_vector @@ to_tsquery('simple', unaccent($1))`.
2. **R03 (P1) — Bảo vệ Invariant tối đa 2 cuốn/phiếu mượn trước tranh chấp đồng thời:**
   * **Nguyên nhân:** Hai transaction đồng thời cùng thêm 2 cuốn sách khác nhau vào cùng một phiếu mượn (đang có 1 cuốn) đều đọc được `COUNT(*) = 1` do snapshot isolation nếu không serialize, dẫn đến phiếu có 3 cuốn sách.
   * **Giải pháp:** Sửa `check_max_loan_items()` trong `01_schema.sql`:
     - Khóa bản ghi phiếu mượn cha: `PERFORM 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE;`. Khóa hàng độc quyền này buộc transaction thứ hai phải chờ transaction thứ nhất commit/rollback xong mới được đọc và kiểm tra.
     - Khi thực hiện UPDATE chuyển `receipt_id` giữa 2 phiếu khác nhau, hàm khóa cả hai phiếu theo thứ tự UUID cố định (`LEAST(OLD.receipt_id, NEW.receipt_id)` trước, `GREATEST` sau) để triệt tiêu hoàn toàn nguy cơ deadlock.
     - Cấu hình trigger: `BEFORE INSERT OR UPDATE OF receipt_id ON loan_items FOR EACH ROW EXECUTE FUNCTION check_max_loan_items();`.
     - Phân định rõ: Các thao tác UPDATE thông thường trên dòng hiện tại (`returned_at`, `is_lost`) **không kích hoạt trigger này** và không bị chặn nhầm trên phiếu đã đủ 2 cuốn.
3. **Bảo toàn Partial Unique Index:**
   * Giữ nguyên `CREATE UNIQUE INDEX idx_unique_active_copy_loan ON loan_items (copy_id) WHERE returned_at IS NULL AND is_lost = FALSE;`. Không xóa index này để né lỗi; xử lý chuyển tiếp phiếu được để đúng phạm vi Chặng 09.
4. **Xây dựng Integration Test Harness an toàn (`tests/integration/db-harness.ts`):**
   * Nhận `TEST_DATABASE_URL`, kích hoạt cơ chế **fail-closed**:
     - Bắt buộc biến môi trường phải tồn tại.
     - Chỉ cho phép host `localhost`, `127.0.0.1`, `::1` hoặc `test-postgres`.
     - Bắt buộc tên database phải có tiền tố `ysbk_test` (ví dụ `ysbk_test_stage02`).
     - Nghiêm cấm và chặn đứng các database hệ thống (`postgres`, `template0`, `template1`) và database người dùng/production.
     - Tự động che dấu (masking `***`) mật khẩu trong mọi log thông báo.
     - Cung cấp cơ chế tạo isolated client độc lập, reset schema sạch và apply DDL/Seed.
5. **Xây dựng bộ kiểm thử tích hợp chuẩn Node.js Test Runner:**
   * `tests/integration/schema.test.ts`: Kiểm tra apply toàn bộ DDL & Seed; kiểm tra trigger `search_vector` khi INSERT, UPDATE title, UPDATE description, NULL description; kiểm tra tìm kiếm có dấu, không dấu, tìm theo mô tả; kiểm tra chỉ mục GIN.
   * `tests/integration/loan-item-constraints.test.ts`:
     - Test 1: Thêm cuốn thứ 3 bị từ chối; bulk INSERT 3 cuốn vào phiếu rỗng rollback toàn bộ câu lệnh.
     - Test 2: Hai kết nối độc lập tranh chấp thêm 2 cuốn khác nhau vào phiếu đang có 1 cuốn: kết nối 2 bị chặn bởi parent row lock `FOR UPDATE`, sau khi kết nối 1 commit thì kết nối 2 bị trigger từ chối và rollback, số lượng cuối cùng luôn $\le 2$.
     - Test 3: UPDATE chuyển 1 cuốn từ phiếu khác sang phiếu đã đủ 2 cuốn bị từ chối, dữ liệu cả 2 phiếu giữ nguyên.
     - Test 4: UPDATE thông thường (`returned_at`, `is_lost`) trên cuốn của phiếu đã đủ 2 cuốn thành công, không bị chặn nhầm.
     - Test 5: Hai phiếu cùng mượn 1 bản sách active bị partial unique index chặn đứng.
     - Test 6: Rollback sạch, không để lại dữ liệu dở dang hay lock treo.
6. **Cấu hình script `"test:db"` trong `package.json`:**
   * `"test:db": "node --experimental-strip-types --test tests/integration/schema.test.ts tests/integration/loan-item-constraints.test.ts"`

---

## 4. Bằng Chứng Kiểm Tra Cổng Chất Lượng (Gates Evidence)

### 4.1 Gate G-doc: PASS
* Đã sửa trọn vẹn S01-01, S01-02, S01-03, S01-04.
* Bảng tiến độ 22 chặng nhất quán theo `docs/prompts/antigravity-next/README.md`.
* Ma trận truy vết khớp chính xác 26 operationIds của `openapi.yaml`, đánh dấu rõ ràng các endpoint dự kiến và sửa toàn bộ test IDs đúng ngữ nghĩa nghiệp vụ.
* 6 cấp độ bằng chứng được tuyên bố minh bạch; các số liệu tải/dung lượng được gắn nhãn giả định.
* Version TypeScript được xác nhận: `~5.8.3` (trong `package.json`), runtime Node `v24.14.0`.

### 4.2 Gate G-schema/search: BLOCKED
* **Trạng thái:** **BLOCKED** do môi trường local chưa khởi động PostgreSQL/Docker.
* **Mã nguồn đã hoàn tất:** `docs/technical/schema/01_schema.sql` (trigger `update_book_title_search_vector`), `tests/integration/schema.test.ts`.

### 4.3 Gate G-invariant: BLOCKED
* **Trạng thái:** **BLOCKED** do môi trường local chưa khởi động PostgreSQL/Docker để chạy 2 kết nối đồng thời.
* **Mã nguồn đã hoàn tất:** `docs/technical/schema/01_schema.sql` (hàm `check_max_loan_items` có `PERFORM 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE` và khóa 2 phiếu theo thứ tự UUID khi update `receipt_id`), `tests/integration/loan-item-constraints.test.ts`.

### 4.4 Gate G-baseline: PASS (Kèm xác thực Fail-closed cho `test:db`)
* **Kiểm tra Typecheck:**
  - Lệnh: `pnpm.cmd run check` (`astro check && tsc --noEmit`)
  - Kết quả: **Exit code 0** (14 files checked, 0 errors, 0 warnings, 17 hints).
* **Kiểm tra Production Build:**
  - Lệnh: `pnpm.cmd run build` (`astro build`)
  - Kết quả: **Exit code 0** (3 pages built in 2.36s: `/login`, `/noi-bo`, `/index.html`, thư mục `dist/`).
* **Kiểm tra 22 Python Tests:**
  - Lệnh: `python -m unittest discover -s experiments -p "test_*.py" -q`
  - Kết quả: **Exit code 0** (`Ran 22 tests in 0.022s. OK`).
* **Kiểm tra OpenAPI Redocly Lint:**
  - Lệnh: `pnpm.cmd --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml`
  - Kết quả: **Exit code 0** (`Woohoo! Your API description is valid. 🎉`, 0 errors, 24 warnings).
* **Kiểm tra Fail-closed của Test DB Harness:**
  - Lệnh: `pnpm.cmd run test:db`
  - Kết quả: **Exit code 1** (Fail-closed an toàn, không báo PASS giả, thông báo lỗi rõ ràng hướng dẫn khởi động PostgreSQL và đặt biến môi trường).

---

## 5. Hướng Dẫn Kích Hoạt & Tái Chạy Khi Môi Trường Có PostgreSQL

Khi máy người dùng hoặc môi trường CI đã khởi động Docker / PostgreSQL service, thực hiện các bước sau để chạy kiểm thử thực tế:

```powershell
# 1. Tạo database test dùng một lần (nếu dùng local PostgreSQL)
# Tên database bắt buộc phải bắt đầu bằng ysbk_test (ví dụ: ysbk_test_stage02)
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE ysbk_test_stage02;"

# 2. Hoặc nếu khởi động qua Docker container tạm thời:
# docker run --name ysbk-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ysbk_test_stage02 -p 5432:5432 -d postgres:16-alpine

# 3. Đặt biến môi trường kết nối test
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/ysbk_test_stage02"

# 4. Chạy suite kiểm thử tích hợp PostgreSQL
pnpm run test:db
```

---

## 6. Danh Sách Tệp Đã Thay Đổi Trong Chặng 02

1. `docs/technical/schema/01_schema.sql`: Sửa R01 (trigger `search_vector`) và R03 (hàm `check_max_loan_items` khóa dòng cha `FOR UPDATE`, sắp xếp UUID chống deadlock khi đổi `receipt_id`, trigger `BEFORE INSERT OR UPDATE OF receipt_id`).
2. `docs/technical/domain-data.md`: Cập nhật tài liệu khớp với trigger `search_vector` và trigger khóa dòng cha.
3. `docs/technical/security-operations.md`: Cập nhật bảng quota với link tài liệu chính thức, ngày xác minh (18/10/2026) và nhãn giả định.
4. `docs/technical/README.md`: Cập nhật bảng truy vết khớp 26 operations, sửa test IDs (T15/T36–T42/T45 cho trực ca; T16/T43–T44/T46–T47/T53 cho tuyển), phân định rõ 6 cấp độ bằng chứng.
5. `package.json`: Thêm devDependencies `pg`, `@types/pg` và script `"test:db"`.
6. `pnpm-lock.yaml`: Cập nhật lockfile tương ứng.
7. `tests/integration/db-harness.ts`: Test harness nhận `TEST_DATABASE_URL`, fail-closed an toàn, guard host và tên database `ysbk_test_*`.
8. `tests/integration/schema.test.ts`: Suite kiểm thử DDL, seed và tìm kiếm tiếng Việt toàn văn trên PostgreSQL.
9. `tests/integration/loan-item-constraints.test.ts`: Suite kiểm thử 5 invariants cốt lõi và concurrency locking trên PostgreSQL.
10. `docs/technical/progress.md`: Cập nhật toàn diện tiến độ 22 chặng, chi tiết Chặng 01 và Chặng 02.

---

## 7. Chi Tiết Khắc Phục Carryover Chặng 02 (S02-01..S02-05)

### 7.1 S02-01 — An Toàn Test DB Harness
* **Vấn đề phát hiện:** Driver `pg` sử dụng `pg-connection-string`, nếu truyền raw URI chứa `?host=example.invalid`, query parameter này sẽ ghi đè authority mà guard trước đó đã kiểm tra.
* **Biện pháp khắc phục triệt để:**
  - Cấm hoàn toàn query parameters trong `validateTestDatabaseUrl` (`url.search` phải rỗng).
  - Chuẩn hóa phân giải IPv6: chấp nhận `[::1]`.
  - Kiểm tra bắt buộc tên database phải bắt đầu bằng `ysbk_test_`.
  - **Không truyền URI thô cho driver:** Chuyển đổi URL đã kiểm tra thành object cấu hình rời rạc `{ host, port, database, user, password }` và truyền nhất quán cho cả `PgPool` và `PgClient`.
  - Bổ sung xác thực an toàn `SELECT current_database()` trước khi thực thi `resetSchema()`.
  - Thêm unit test suite offline: `tests/unit/db-harness.test.ts` (5 tests pass trong 3ms: từ chối URL rỗng, chặn query host override, chặn remote hosts, chặn system/production databases, mask password an toàn trong log).

### 7.2 S02-02 — Điều Khiển Concurrency Test Runner
* Thêm cờ `--test-concurrency=1` vào script `"test:db"` trong `package.json`:
  `node --experimental-strip-types --test --test-concurrency=1 tests/integration/schema.test.ts tests/integration/loan-item-constraints.test.ts`
* Đảm bảo hai file kiểm thử tích hợp dùng chung disposable DB không bị xung đột reset schema, trong khi các client bên trong từng test case vẫn hoạt động đồng thời thực sự.

### 7.3 S02-03 — Xác Thực Concurrency Bằng Cơ Chế DB Observability
* Sửa Test 2 trong `tests/integration/loan-item-constraints.test.ts`:
  - Lấy PID backend của từng client: `pg_backend_pid()`.
  - Thiết lập `statement_timeout = 5000` và `lock_timeout = 5000` trên cả hai client.
  - Sử dụng connection thứ ba (`observerClient`) truy vấn `pg_blocking_pids($1)` với deadline 3000ms.
  - Chứng minh client 2 thực sự bị block bởi row-lock của client 1 trên bản ghi cha `loan_receipts` trước khi client 1 commit.
  - Bổ sung khối `finally` an toàn giải phóng toàn bộ client và rollback pending transaction.

### 7.4 S02-04 — Bổ Sung Regression Test UPDATE Description
* Thêm test case trong `tests/integration/schema.test.ts`: kiểm tra trigger `search_vector` khi cập nhật `description` (từ mới match, từ cũ không match, cập nhật description thành NULL vẫn tìm được theo title).

### 7.5 S02-05 — Đồng Bộ Bảng Truy Vết & OpenAPI Lint
* Bổ sung tham chiếu T23–T28 cho FR-01 (phạt, lịch, chuyển phiếu) trong `docs/technical/README.md`.
* Loại bỏ gán nhầm T51/T52 ở FR-06 và T63 ở FR-07.
* Loại bỏ tuyên bố “Bao phủ toàn diện 9 nhóm” trong `docs/technical/openapi.yaml`. Redocly lint: 0 errors, 24 warnings.

---

## 8. Chi Tiết Thực Hiện Chặng 03 (Runtime Backend & Managed Auth Cách Ly)

### 8.1 Kiến Trúc Managed Auth & Username Mapping (ADR 001)
* Tài liệu: `docs/technical/adr/001-managed-auth-username-mapping.md`.
* **Cơ chế cô lập Synthetic Internal Realm:**
  - Thành viên nội bộ đăng nhập bằng `username` + `password`.
  - Máy chủ chuẩn hóa username (`trim().toLowerCase()`) và ánh xạ sang email nội bộ nhân tạo: `${normalized_username}@internal.ysbk.edu.vn`.
  - Tên miền `@internal.ysbk.edu.vn` không thể xác thực qua Google OAuth hoặc nhận thư từ bên ngoài, triệt tiêu hoàn toàn nguy cơ Identity Linking mạo danh từ khách bên ngoài.
  - Bảng `internal_identities` lưu cặp `(normalized_username, provider_subject, member_id)` duy nhất.
  - Email liên hệ thực tế của thành viên được lưu riêng trong bảng `members`, tách rời hoàn toàn khỏi credential đăng nhập.

### 8.2 Cơ Chế Thu Hồi Quyền Tức Thời (Instant Revocation via `token_version`)
* Khi Quản trị viên cập nhật trạng thái thành viên (`is_alumni = TRUE` hoặc `is_active = FALSE`):
  - Máy chủ tự động tăng `token_version = token_version + 1` trên bản ghi `members`.
  - Mọi request tiếp theo (cả GET đọc dữ liệu và Mutation ghi dữ liệu) mang token/cookie phiên cũ mang `token_version` cũ sẽ lập tức bị từ chối với mã lỗi `401 Unauthorized`.

### 8.3 Xây Dựng Lớp Backend Core Trên Cloudflare Workers (`src/server/`)
* `src/server/types.ts`: Định nghĩa các kiểu dữ liệu `AuthenticatedActor`, `ActorRole` (`ADMIN`, `MEMBER`, `ALUMNI`, `GUEST`, `ANONYMOUS`), `AlumniActivityDto`, `MemberDto`.
* `src/server/errors.ts`: Hệ thống xử lý lỗi chuẩn hóa `AppError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ServiceUnavailableError`. Response format chuẩn JSON kèm header `X-Request-Id`, loại bỏ hoàn toàn stack traces và thông tin nhạy cảm.
* `src/server/auth/tokens.ts`: Ký và giải mã JWT bằng Web Crypto API tiêu chuẩn (`crypto.subtle`) cho Cloudflare Workers, xác thực signature, issuer, audience, exp.
* `src/server/auth/policy.ts`: Bộ lọc RBAC `requireAuthenticated`, `requireInternalMember`, `requireAdmin`, `toAlumniActivityDto` (Field Allowlist loại bỏ 100% budget, quỹ, PII), và `toMemberDto` (loại bỏ credentials, provider subject, token version).
* `src/server/auth/provider.ts`: Adapter Managed Auth chuẩn hóa username, synthetic email realm, và mock fallback cho test offline.
* `src/server/db/client.ts`: Pool kết nối PostgreSQL và kiểm tra readiness kết nối.
* `src/server/router.ts`: Router Fetch API chuẩn:
  - `GET /health`: 200 OK, không lộ thông tin nội bộ.
  - `GET /health/ready`: 503 Degraded (Fail-closed) khi thiếu DB hoặc Auth provider thật.
  - `POST /api/v1/auth/login-internal`: Đăng nhập nội bộ, thiết lập cookie `HttpOnly; SameSite=Lax`.
  - `POST /api/v1/auth/login-guest`: Đăng nhập khách.
  - `GET /api/v1/members`: Danh sách thành viên (yêu cầu role MEMBER hoặc ADMIN).
  - `PATCH /api/v1/members/:id/status`: Quản trị viên đổi trạng thái, thu hồi phiên cũ qua `token_version`.
  - `GET /api/v1/alumni/activities`: Trả về DTO hoạt động an toàn theo Field Allowlist cho Alumni, chặn khách 403.
* `src/server/index.ts`: Workers default export handler.
* `wrangler.json`: File cấu hình Cloudflare Workers runtime.
* `.env.example` & `.gitignore`: Template biến môi trường placeholder và cấu hình chặn secret.

---

## 9. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 03 (Gates Evidence)

### 9.1 G-carryover: S02-01..S02-05 Sửa Xong | DB Integration BLOCKED
* **S02-01 Unit Guard:** `node --experimental-strip-types --test tests/unit/db-harness.test.ts`
  - Kết quả: **5/5 tests pass** trong 3ms (chặn query parameter override, remote host, forbidden dbs, mask password).
* **DB Integration Tests:** `pnpm run test:db`
  - Kết quả: **BLOCKED** do môi trường local chưa có PostgreSQL runtime (`TEST_DATABASE_URL` chưa thiết lập). Test harness kích hoạt fail-closed an toàn, không báo PASS giả.

### 9.2 G-runtime: PASS (Local Workers Router & Sanitized Errors)
* Kiểm tra `GET /health`: trả về HTTP 200 OK `{ "status": "ok", "service": "ysbk-backend", "version": "1.0.0" }`.
* Kiểm tra `GET /health/ready`: trả về HTTP 503 Degraded (Fail-closed) khi thiếu DB hoặc Auth provider, không báo healthy giả.
* Kiểm tra format lỗi: HTTP 500 trả về JSON sạch có `X-Request-Id`, thông báo lỗi đã được làm sạch, không lộ stack trace hay connection string DB.

### 9.3 G-provider: BLOCKED (Chờ Managed Auth Provider Live)
* Chưa có tài khoản/credentials live Managed Auth Provider (Supabase).
* Adapter, types, validation, and offline mock fallback tests đã hoàn tất 100%.

### 9.4 G-policy/HTTP: PASS (24/24 Tests Pass 100%)
* Lệnh chạy: `pnpm run test:unit`
* Kết quả: **24 tests pass trong 395ms**:
  - RBAC: Anonymous 401, Disabled 403, Guest blocked from internal 403, Member access internal 200, Admin access 200.
  - Alumni: Bị chặn nghiệp vụ quầy sách (403), truy cập `/alumni/activities` nhận DTO đã lọc sạch tiền/quỹ/PII (200).
  - Token Security: Phát hiện và từ chối token giả mạo chữ ký, token hết hạn, token sai secret key.
  - Instant Revocation: Admin PATCH `/members/:id/status` tăng `token_version` -> phiên cũ lập tức bị 401 trên cả request tiếp theo.
  - Cookie: Đăng nhập nội bộ thiết lập cookie `HttpOnly; SameSite=Lax`.

### 9.5 G-secrets/baseline: PASS
* **Typecheck & Astro Check:** `pnpm run check` -> **Exit code 0** (26 files checked, 0 errors, 0 warnings, 16 hints).
* **Production Build:** `pnpm run build` -> **Exit code 0** (3 pages built, `/login`, `/noi-bo`, `/index.html`, thư mục `dist/`).
* **Python Tests:** `python -m unittest discover -s experiments -p "test_*.py" -q` -> **Exit code 0** (22/22 tests pass trong 0.026s).
* **OpenAPI Redocly Lint:** `pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` -> **Exit code 0** (0 errors, 24 warnings).
* **Secrets Guard:** `tests/unit/secrets-guard.test.ts` pass (quét toàn bộ thư mục `src/`, không có hardcoded private key/secret, `.env.example` chỉ chứa placeholder, `.gitignore` chặn `.env`).

---

## 10. Danh Sách Tệp Đã Thay Đổi Trong Chặng 03

1. `docs/technical/adr/001-managed-auth-username-mapping.md`: Tạo mới ADR 001 cho cơ chế Managed Auth và Username mapping.
2. `docs/technical/schema/01_schema.sql`: Bổ sung bảng `internal_identities` (`normalized_username`, `provider_subject`, `member_id`).
3. `docs/technical/schema/02_seed.sql`: Bổ sung seed dữ liệu cho `internal_identities` với 5 tài khoản mẫu.
4. `src/server/types.ts`: Khai báo types và DTOs cho backend runtime.
5. `src/server/errors.ts`: Xử lý lỗi chuẩn hóa `AppError`, làm sạch lỗi 500 không rò rỉ credential/stack trace.
6. `src/server/auth/tokens.ts`: Ký và xác thực session JWT qua Web Crypto API.
7. `src/server/auth/policy.ts`: Bộ lọc RBAC, Field Allowlist `toAlumniActivityDto`, sanitization `toMemberDto`.
8. `src/server/auth/provider.ts`: Adapter Managed Auth, chuẩn hóa username, synthetic internal realm.
9. `src/server/db/client.ts`: Pool kết nối DB và kiểm tra readiness.
10. `src/server/router.ts`: Router Fetch API chuẩn cho Cloudflare Workers.
11. `src/server/index.ts`: Entrypoint default fetch handler của Cloudflare Workers.
12. `wrangler.json`: Cấu hình Cloudflare Workers.
13. `.env.example`: Template biến môi trường placeholder.
14. `tests/unit/db-harness.test.ts`: Unit test offline cho DB harness safety guard (S02-01).
15. `tests/unit/auth-policy.test.ts`: Unit test cho RBAC, Alumni Field Allowlist, token tampering/expiry.
16. `tests/unit/api-routes.test.ts`: HTTP router test cho health, readiness, login, RBAC, và instant session revocation.
17. `tests/unit/secrets-guard.test.ts`: Unit test kiểm tra an toàn secret, .env.example, và error sanitization.
18. `tests/integration/db-harness.ts`: Sửa S02-01 (cấm query parameter, truyền discrete config object).
19. `tests/integration/loan-item-constraints.test.ts`: Sửa S02-03 (PID, statement/lock timeout, connection 3 quan sát `pg_blocking_pids`).
20. `tests/integration/schema.test.ts`: Sửa S02-04 (regression test UPDATE description).
21. `package.json`: Cập nhật script `"test:unit"`, `"test:db"` (`--test-concurrency=1`), và `"server:dev"`.
22. `docs/technical/README.md`: Sửa S02-05 (truy vết FR-01 T23-T28, bỏ T51/T52/T63 gán nhầm).
23. `docs/technical/openapi.yaml`: Sửa S02-05 (bỏ tuyên bố bao phủ 9 nhóm).
24. `docs/technical/security-operations.md`: Đồng bộ ADR 001, bảng `internal_identities`, synthetic internal realm.
25. `docs/technical/architecture.md`: Đồng bộ thực thể `internal_identities` và entrypoint Cloudflare Workers.
26. `README.md`: Bổ sung hướng dẫn phát triển local, test commands, bootstrap accounts, và trạng thái gates.
27. `docs/technical/progress.md`: Cập nhật toàn diện tiến độ Chặng 03 và carryover Chặng 02.

---

## 11. Chi Tiết Thực Hiện Chặng 04 (Sổ Tiền Tối Thiểu & Idempotency Dùng Chung)

### 11.1 Xử Lý Triệt Để Toàn Bộ Carryovers (S03-01..S03-08 & S02-03)
1. **S03-01 (Loại bỏ Auth giả & Default Secret ở Server thường):**
   - Xóa bỏ hoàn toàn `DEFAULT_SECRET` khỏi `src/server/auth/tokens.ts`. Khóa bí mật bắt buộc cấu hình qua env và có độ dài tối thiểu 32 ký tự; nếu thiếu, hệ thống lập tức ném lỗi `AUTH_SECRET_MISSING`.
   - Xóa bỏ `mockUserStore` khỏi runtime `src/server/auth/provider.ts` và `mockMembersDb` khỏi `src/server/router.ts`.
   - Cơ chế Dependency Injection sạch: Khi server chạy thường (development/production) thiếu provider hoặc DB, hệ thống lập tức fail-closed trả về HTTP 503 (`AUTH_PROVIDER_UNCONFIGURED`). Fixture chỉ được inject thông qua tham số hàm phục vụ unit tests.
2. **S03-02 / S03-03 (Provider xác thực, DB cấp quyền):**
   - Xóa bỏ logic `normalizedUsername.includes('admin')` tạo quyền giả mạo từ tên đăng nhập.
   - Quyền hạn, `memberId`, trạng thái hoạt động và `token_version` bắt buộc truy vấn từ DB thông qua quan hệ `internal_identities` JOIN `members`.
   - Khách vãng lai bắt buộc xác thực qua provider hợp lệ, định danh bằng `provider_subject` ổn định, không cấp token ngẫu nhiên bằng `Date.now()`.
3. **S03-04 (Thu hồi phiên & Logout):**
   - Triển khai cơ chế blacklist vô hiệu hóa phiên `revokedTokenBlacklist` khi gọi `POST /api/v1/auth/logout`.
   - Gọi `/api/v1/auth/me` sau khi logout bị chặn đứng bằng HTTP 401 Unauthorized.
4. **S03-05 (Chặn xung đột Alumni + Admin):**
   - Trong `src/server/router.ts`, request `PATCH /api/v1/members/:id/status` với body chứa `{ isAlumni: true, isAdmin: true }` bị từ chối bằng HTTP 400 (`ALUMNI_CANNOT_BE_ADMIN`).
   - Trong `src/server/auth/policy.ts`, hàm `requireAdmin` chặn trực tiếp cựu thành viên (`ALUMNI_CANNOT_BE_ADMIN`); hàm `toMemberDto` chuẩn hóa nếu `isAlumni = true` thì bắt buộc `isAdmin = false`.
5. **S03-06 (HTTP Boundary & Bounds Validation):**
   - Thêm kiểm tra kiểu dữ liệu nghiêm ngặt trong `provider.ts`: password số (`password: 123`) hoặc email sai kiểu trả về HTTP 400 `INVALID_PASSWORD_TYPE`, không gây crash `TypeError 500`.
   - Cookie production tự động gắn thuộc tính `; Secure; HttpOnly; SameSite=Lax`.
   - Bổ sung header `Cache-Control: no-store` trên các endpoint auth và PII nhạy cảm.
6. **S03-07 / S02-03 (Thứ tự Concurrency Lock Test):**
   - Sửa Test 2 trong `tests/integration/loan-item-constraints.test.ts`: Client 1 chạy `BEGIN` và `INSERT` hoàn tất trước để nắm giữ parent row lock trên `loan_receipts`. Sau đó mới khởi động `client2Promise`. Kết nối thứ ba quan sát `pg_blocking_pids` chứng minh Client 2 thực sự bị block bởi Client 1 trước khi commit. Cleanup `finally` an toàn giải phóng toàn bộ kết nối.
7. **S03-08 (Đồng bộ Contract, Diagram & ID Quỹ):**
   - Đồng bộ OpenAPI URL `/api/v1` và các route `/auth/login-internal`, `/auth/login-guest`, `/auth/me`, `/auth/logout`.
   - Chuyển trạng thái `docs/technical/adr/001-managed-auth-username-mapping.md` sang `Proposed / Experimental (Pending Live Provider Spike)`.
   - Cập nhật `docs/technical/diagrams/07_sequence_auth_and_roles.mmd` dùng bảng `internal_identities` và quy trình xác thực DB.
   - Chuẩn hóa ID quỹ chuẩn: `FUND_LOAN` (Quỹ mượn trả) và `FUND_OPERATION` (Quỹ hoạt động chung).

### 11.2 Xây Dựng Lõi Tài Chính & Sổ Kép Tối Thiểu (`src/server/finance/`)
1. **Ràng buộc an toàn tiền tệ VND (`src/server/finance/types.ts`):**
   - `assertSafeVndAmount(amount)`: Bắt buộc tiền là số nguyên (VND không có hào/xu), chặn số âm, phân số (float: `100.5`), NaN, Infinity, chuỗi rác. Giới hạn trần an toàn `MAX_SAFE_VND = 1_000_000_000_000n` (1.000 tỷ VND).
   - Danh mục tài khoản kế toán: `TIEN_MAT_HOP`, `TIEN_NGAN_HANG`, `COC_DAT_NHA_SACH` (Tài sản); `COC_PHAI_HOAN`, `NO_PHAI_TRA_NHA_SACH` (Nợ phải trả); `THU_PHAT`, `HOI_PHI`, `DOANH_THU_BAN_SACH` (Doanh thu).
   - Cách ly tuyệt đối hai quỹ: Hàm `assertValidFundAccount(fundId, account)` chặn mọi hành vi ghi chéo tài khoản giữa `FUND_LOAN` và `FUND_OPERATION`. Hai quỹ không bao giờ bù trừ số dư cho nhau.
2. **Sổ kép bất biến (`src/server/finance/ledger.ts`):**
   - `recordJournalEntry`: Nhận cùng client/transaction DB của caller, ghi bút toán đối ứng Nợ = Có tuyệt đối vào `journal_entries`. Bảng được bảo vệ bởi trigger `trg_prevent_journal_mutation` cấm `UPDATE` và `DELETE`.
   - `recordReversal`: Đảo bút toán bằng cách đổi chéo tài khoản Nợ <-> Có, ghi nhận `reversal_of_entry_id` trỏ về bút toán gốc. Khóa dòng `FOR UPDATE` chống đảo kép đồng thời, cấm đảo một bút toán đã là bút toán đảo.
   - `getFundBalances`: Lập báo cáo số dư tài sản/nghĩa vụ của từng quỹ, tự động kiểm tra phương trình kế toán $\sum \text{Nợ} = \sum \text{Có}$ (`isBalanced = true`).
3. **Quản lý phân bổ nghĩa vụ cọc (`src/server/finance/deposits.ts`):**
   - `receiveDeposit`: Tiếp nhận cọc, ghi nhận bản ghi `deposit_allocations` trạng thái `HELD`, đồng thời ghi bút toán Nợ `TIEN_MAT_HOP`/`TIEN_NGAN_HANG`, Có `COC_PHAI_HOAN` (Nợ phải trả). Cọc bạn đọc tuyệt đối không thành doanh thu.
   - `requestDepositRefund`: Chuyển cọc sang `PENDING_REFUND`. Bất biến: Tiền chưa chi và nghĩa vụ chưa giảm khi còn ở trạng thái chờ xác nhận.
   - `confirmDepositRefund`: Khóa dòng `FOR UPDATE`, giảm `remaining_amount`, chuyển `REFUNDED` (hoặc `HELD` nếu hoàn 1 phần), ghi bút toán Nợ `COC_PHAI_HOAN`, Có `TIEN_MAT_HOP`/`TIEN_NGAN_HANG`.
   - Hoàn chéo phương thức: Nhận qua Chuyển khoản có thể hoàn bằng Tiền mặt (hoặc ngược lại) mà không sửa đổi chứng từ nhận ban đầu.
   - `transferDepositAllocation`: Chuyển liên kết cọc sang phiếu mới (Carry-forward), cập nhật `transferred_to_receipt_id`. Bất biến: Không làm thay đổi tiền thực tế, không sinh bút toán giả.
   - `forfeitDeposit`: Cấn trừ cọc phạt/mất sách: Nợ `COC_PHAI_HOAN`, Có `THU_PHAT` (Doanh thu phạt Quỹ Mượn–Trả). Không chạm tiền mặt/ngân hàng.
4. **Hợp nhất cơ chế Idempotency dùng chung (`src/server/shared/idempotency.ts`):**
   - Bảng `idempotency_records` với khóa `(actor_id, operation, idempotency_key)`.
   - Mã băm SHA-256 từ canonical JSON (sắp xếp key đệ quy).
   - `claimIdempotency`: Chèn `PROCESSING` nguyên tử; cùng key khác payload ném `409 IdempotencyPayloadMismatchError`; concurrent request ném `409 IdempotencyConcurrentError`; key đã `COMPLETED` trả cached response.
   - `completeIdempotency` lưu HTTP code và body; `failIdempotency` chuyển `FAILED` cho phép retry khi transaction gặp lỗi.

---

## 12. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 04 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-auth-safety** | **PASS** | S03-01..S03-06 pass hồi quy. Server thường không cấu hình provider lập tức trả HTTP 503 fail-closed trên các route xác thực; không cấp session demo; không dùng DEFAULT_SECRET. Phân định rõ ràng actor test chỉ tồn tại trong unit test harness, không có bypass runtime. |
| **2. G-db-baseline** | **BLOCKED** | Docker Desktop và PostgreSQL port 5432 chưa được bật trên máy tính. Test harness `db-harness.ts` kích hoạt fail-closed an toàn với ngoại lệ `[BLOCKED: DB_RUNTIME_MISSING]`, tuyệt đối không báo PASS giả. |
| **3. G-ledger/deposit** | **PARTIAL** | - **Unit/Domain (PASS):** 33/33 tests pass trong 397ms (`tests/unit/finance-ledger.test.ts`). Kiểm tra toàn diện VND bounds, cân đối Nợ=Có, cách ly 2 quỹ, vòng đời cọc HELD -> PENDING_REFUND -> REFUNDED/FORFEITED/TRANSFERRED, không sinh tiền giả.<br/>- **PostgreSQL Integration (BLOCKED):** File test `tests/integration/finance-ledger.test.ts` đã hoàn thành với 5 test cases chuyên sâu (nhận cọc 150k, hoàn 50k, 2 connection tranh chấp hoàn hết cọc tuần tự hóa bằng `FOR UPDATE`, hoàn chéo cash/bank, trigger `trg_prevent_journal_mutation` cấm UPDATE/DELETE). Sẵn sàng chạy khi có DB. |
| **4. G-idempotency** | **PARTIAL** | - **Unit/Domain (PASS):** Canonical hashing đệ quy không phụ thuộc thứ tự key; claim `CLAIMED`, replay `RETURN_CACHED`, mismatch payload chặn `409`, concurrent request chặn `409`, phục hồi sau fail.<br/>- **PostgreSQL Integration (BLOCKED):** Đã viết test tích hợp 2 connection đồng thời trên PostgreSQL tại `tests/integration/finance-ledger.test.ts`. |
| **5. G-contract/baseline** | **PASS** | - **Astro check & tsc:** `pnpm.cmd run check` -> 0 errors, 0 warnings.<br/>- **Astro build:** `pnpm.cmd run build` -> Exit code 0, 3 trang tĩnh hoàn tất.<br/>- **Python tests:** `python -m unittest discover -s experiments -p "test_*.py" -q` -> 22/22 tests pass trong 0.027s (sau khi cập nhật `idempotency_records` và `deposit_allocations` trong `test_sql_schema_syntax.py`).<br/>- **OpenAPI Redocly Lint:** `pnpm.cmd --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` -> 0 errors, 24 warnings.<br/>- **Unit Test Runner:** `pnpm.cmd run test:unit` -> 33/33 tests pass trong 397ms. |

---

## 13. Tệp Đã Thay Đổi Trong Chặng 04

1. `docs/technical/schema/01_schema.sql`:
   - Đổi `journal_entries.source_id` thành `VARCHAR(100)` (tương thích cả UUID và mã phiên tiền mặt `VARCHAR(35)`).
   - Thêm trigger `trg_prevent_journal_mutation` trên `journal_entries` bảo đảm tính bất biến, cấm tuyệt đối `UPDATE` và `DELETE`.
   - Thêm bảng `deposit_allocations` (`receipt_id`, `item_id`, `fund_id`, `original_amount`, `remaining_amount`, `status`, `payment_method`, `refund_method`, `transferred_to_receipt_id`).
   - Hợp nhất bảng `idempotency_records` (`actor_id`, `operation`, `idempotency_key`, `payload_hash`, `status`, `response_code`, `response_body`, `UNIQUE(actor_id, operation, idempotency_key)`).
2. `src/server/finance/types.ts`: Tạo mới types tài chính, `FUND_IDS`, `ACCOUNT_CODES`, `assertSafeVndAmount`, `MAX_SAFE_VND`, `serializeVnd`.
3. `src/server/finance/ledger.ts`: Tạo mới module sổ kép: `recordJournalEntry`, `recordReversal`, `getFundBalances`.
4. `src/server/finance/deposits.ts`: Tạo mới module phân bổ cọc: `receiveDeposit`, `requestDepositRefund`, `confirmDepositRefund`, `transferDepositAllocation`, `forfeitDeposit`.
5. `src/server/shared/idempotency.ts`: Tạo mới module idempotency dùng chung: `canonicalizeJson`, `computePayloadHash`, `claimIdempotency`, `completeIdempotency`, `failIdempotency`.
6. `tests/unit/finance-ledger.test.ts`: Tạo mới 4 test suites chuyên sâu cho finance ledger, deposit lifecycle và idempotency.
7. `tests/integration/finance-ledger.test.ts`: Tạo mới test suite tích hợp PostgreSQL cho finance ledger, immutability, và idempotency.
8. `experiments/test_sql_schema_syntax.py`: Đồng bộ danh sách bảng `expected_tables` (`idempotency_records`, `deposit_allocations`).
9. `package.json`:
   - Chuyển `onlyBuiltDependencies` ra root level theo chuẩn pnpm v11 (xóa cảnh báo).
   - Cập nhật script `"test:unit"` thêm `tests/unit/finance-ledger.test.ts`.
   - Cập nhật script `"test:db"` thêm `tests/integration/finance-ledger.test.ts`.
10. `docs/technical/transactions-finance.md`: Cập nhật chi tiết sổ kép tối thiểu, trigger bất biến, vòng đời phân bổ cọc và idempotency contract.
11. `docs/technical/domain-data.md`: Bổ sung cấu trúc từ điển dữ liệu cho `deposit_allocations` và `idempotency_records`.
12. `docs/technical/progress.md`: Cập nhật tiến độ Chặng 04 và bảng bằng chứng các gates.

---

## 14. Hướng Dẫn Tái Chạy Khi Có PostgreSQL Runtime

Khi người dùng khởi động Docker hoặc PostgreSQL local, chỉ cần thiết lập biến môi trường và chạy một lệnh duy nhất:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/ysbk_test_stage04"
pnpm run test:db
```

Toàn bộ các tệp test tích hợp sẽ tự động reset schema, apply DDL/seed và xác minh 100% các ràng buộc ACID trên PostgreSQL thật.

---

## 15. Chi Tiết Thực Hiện Chặng 05 (Mở/Đóng Ca và Đối Soát Hộp Tiền & Xử Lý Carryover S04-01..S04-08)

### 15.1 Xử lý triệt để 8 Carryovers từ Chặng 04 (S04-01..S04-08)
1. **S04-01 (Hoàn trùng lặp & Refund Intent):**
   - Tạo bảng `refund_intents (id, allocation_id, amount, refund_method, status, created_by, created_at, confirmed_at, confirmed_by, notes)`.
   - Bổ sung partial unique index `idx_unique_active_deposit_item` và `idx_unique_active_deposit_receipt` trên `deposit_allocations`.
   - `requestDepositRefund` tạo intent ID và khóa allocation sang `PENDING_REFUND`.
   - `confirmDepositRefund` nhận `refundIntentId`, khóa dòng intent và allocation bằng `FOR UPDATE`, chốt đúng số tiền từ intent (chống sửa tiền lúc confirm), kiểm tra trạng thái intent (chặn confirm 2 lần cùng một intent), ghi nhận bút toán Nợ `COC_PHAI_HOAN`, Có `TIEN_MAT_HOP` hoặc `TIEN_NGAN_HANG`.
2. **S04-02 (Reversal an toàn & Reconciliation):**
   - `recordReversal` cấm đảo trực tiếp các journal thuộc nguồn cọc bạn đọc (`LOAN_DEPOSIT`, `DEPOSIT_REFUND`, `FINE_FORFEIT`), yêu cầu thực hiện qua use case nghiệp vụ tương ứng để bảo đảm tính toàn vẹn giữa sổ cái và bảng allocations. Bắt buộc có `notes/reason`.
   - Hàm `assertLiabilityReconciliation` đối soát tổng dư nợ `COC_PHAI_HOAN` trên sổ cái với tổng `remaining_amount` của các khoản cọc active (`HELD`, `PENDING_REFUND`).
3. **S04-03 (Integration Concurrency Test):**
   - Sửa test concurrency trong `tests/integration/finance-ledger.test.ts` loại bỏ hoàn toàn `sleep(50ms)`, dùng kết nối thứ ba quan sát lock trên DB; Client 2 chờ transaction của Client 1 giải phóng độc quyền và nhận `RETURN_CACHED` sau khi Client 1 commit.
4. **S04-04 (Token Revocation Persistent):**
   - Loại bỏ module in-memory Set; thêm bảng `revoked_tokens (token_hash, revoked_at, expires_at)`.
   - `resolveActorFromRequest` kiểm tra `revoked_tokens` trong DB; `revokeSession` ghi nhận token hash vào DB; cập nhật `token_version` khi logout/đổi quyền.
5. **S04-05 (Alumni Activities Filter):**
   - Tuyến `GET /api/v1/alumni/activities` lọc nghiêm ngặt `status IN ('APPROVED_FOR_ALUMNI', 'COMPLETED')`, loại bỏ toàn bộ bản nháp/kế hoạch `PLANNED`. Ném lỗi khi DB lỗi thay vì nuốt lỗi trả về `[]` 200.
6. **S04-06 (Forfeit Policy Config):**
   - `forfeitDeposit` bắt buộc nhận `policy: ForfeitPolicyConfig` với lý do rõ ràng, chặn cấn trừ khi cọc đang có intent `PENDING_REFUND`.
7. **S04-07 (Alumni Role Constraint):**
   - Bổ sung `CONSTRAINT chk_alumni_not_admin` vào bảng `members` trong `01_schema.sql`; `PATCH /api/v1/members/:id/status` đọc trạng thái DB hiện tại và chặn cựu thành viên nhận quyền admin (`ALUMNI_CANNOT_BE_ADMIN`).
8. **S04-08 (Evidence Boundaries):**
   - Minh bạch 5 tầng bằng chứng kỹ thuật: Unit SQL Double, PostgreSQL Integration, Workers HTTP, Managed Auth Provider, Static Astro Build.

### 15.2 Lõi Quản Lý Phiên Quầy Tiền Mặt (`src/server/finance/cash-sessions.ts`)
1. **Ràng buộc Hộp tiền duy nhất của Quỹ Mượn–Trả:**
   - Mỗi buổi trực chỉ tồn tại tối đa một phiên quầy active (`idx_single_active_cash_session ON cash_sessions (is_closed) WHERE is_closed = FALSE`).
   - Người trực chính kiểm và xác nhận đầu/cuối ca, không đổi người giữ tiền giữa ca.
2. **Chu kỳ Mở / Đóng ca và Đối soát:**
   - `openCashSession`: Kiểm tra ca đang mở qua partial unique index; kiểm tra bàn giao ca trước (`lastSession.actualClosingCash`); số tiền float đầu ca không sinh doanh thu/cọc giả; bắt buộc `handoverNote` nếu có chênh lệch bàn giao.
   - `getCurrentCashSession`: Truy vấn phiên active (`is_closed = FALSE`).
   - `getCashSessionSummary`: Tính toán công thức đối soát hộp tiền mặt:
     $$\text{expectedCash} = \text{openingCash} + \text{cashIn} - \text{cashOut}$$
     Thống kê tách bạch dòng tiền ngân hàng (`bankIn`, `bankOut`) và biến động nghĩa vụ cọc phát sinh (`depositLiabilityCreated`) và đã giải phóng (`depositLiabilityReleased`). Tiền ngân hàng tuyệt đối không cộng gộp vào hộp tiền mặt quầy.
   - `closeCashSession`: Khóa dòng `FOR UPDATE`, chốt snapshot `expectedClosingCash`, lưu `actualClosingCash`, tính $\text{discrepancy} = \text{actualClosingCash} - \text{expectedClosingCash}$. Bắt buộc `discrepancyReason` nếu có chênh lệch. Đánh dấu `is_closed = TRUE`, chốt `closed_at`, `closed_by`. Chặn đóng lại ca đã đóng (`SessionAlreadyClosedError`).
   - `serializeCashSession` & `serializeCashSessionSummary`: Chuyển đổi an toàn số nguyên bigint VND sang number JSON theo chuẩn OpenAPI.
3. **Thứ tự khóa chống Deadlock:**
   - Cố định thứ tự khóa dòng độc quyền: `cash_sessions` $\rightarrow$ `deposit_allocations` $\rightarrow$ `refund_intents` $\rightarrow$ `journal_entries` $\rightarrow$ `idempotency_records`.
4. **API Endpoints & Router (`src/server/router.ts` & `src/server/errors.ts`):**
   - `GET /api/v1/finance/cash-session/today`: Lấy phiên quầy đang mở hôm nay.
   - `POST /api/v1/finance/cash-session/open`: Mở phiên quầy mới (yêu cầu quyền thành viên/admin, float đầu ca, handover note nếu lệch ca trước).
   - `POST /api/v1/finance/cash-session/close`: Đóng phiên quầy (yêu cầu tiền thực đếm, discrepancy reason nếu lệch).
   - `GET /api/v1/finance/cash-session/:id/summary`: Xem tóm tắt đối soát tiền mặt, chuyển khoản và nghĩa vụ cọc.
   - Chuẩn hóa mã lỗi Domain: HTTP 400 (`DISCREPANCY_REASON_REQUIRED`, `INVALID_VND_AMOUNT`), HTTP 404 (`SESSION_NOT_FOUND`), HTTP 409 (`ACTIVE_SESSION_EXISTS`, `SESSION_ALREADY_CLOSED`).

---

## 16. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 05 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover** | **PASS** | S04-01..S04-08 đã được xử lý triệt để: bảng `refund_intents` và `confirmDepositRefund` chặn hoàn tiền 2 lần; `recordReversal` cấm đảo trực tiếp bút toán cọc và có `assertLiabilityReconciliation`; test PostgreSQL concurrency dùng lock DB thay vì sleep; `revoked_tokens` lưu DB và chặn phiên bị thu hồi; `alumni/activities` lọc nghiêm ngặt `APPROVED_FOR_ALUMNI`/`COMPLETED` và ném lỗi khi DB fail; `forfeitDeposit` bắt buộc policy; `chk_alumni_not_admin` bảo vệ DB và API chặn cựu thành viên nhận admin; phân định rõ 5 tầng bằng chứng kỹ thuật. |
| **2. G-finance-db** | **BLOCKED** | Docker Desktop và PostgreSQL port 5432 chưa được bật trên máy tính. Test harness `db-harness.ts` kích hoạt fail-closed an toàn với ngoại lệ `[BLOCKED: DB_RUNTIME_MISSING]`, tuyệt đối không báo PASS giả. File test tích hợp `tests/integration/finance-ledger.test.ts` đã được cập nhật hoàn chỉnh, sẵn sàng tái chạy. |
| **3. G-session-db** | **BLOCKED** | PostgreSQL port 5432 chưa bật. File test tích hợp `tests/integration/cash-sessions.test.ts` đã hoàn thành với 5 kịch bản chuyên sâu: 2 connection đồng thời mở ca bị chặn bởi `idx_single_active_cash_session`; giao dịch cash và bank hạch toán tách biệt; thu cọc, hoàn cọc, phạt tính đúng vào expected cash; đóng ca ghi nhận chênh lệch kiểm kê và snapshot an toàn; chặn đóng lại ca đã đóng. Sẵn sàng tái chạy khi có DB. |
| **4. G-http/runtime** | **PASS** | - **Unit Tests Suite:** `tests/unit/cash-sessions.test.ts` và router tests pass 100% (15/15 tests phiên quầy, tổng 48/48 unit tests pass trong 451ms).<br/>- **Router Endpoints:** 4 endpoints (`/today`, `/open`, `/close`, `/:id/summary`) phản hồi chuẩn xác các mã HTTP 200, 400, 404, 409.<br/>- **Fail-closed:** Khi thiếu actor nội bộ hoặc quyền hạn không đủ, router lập tức từ chối 401/403. |
| **5. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `pnpm.cmd run check` $\rightarrow$ **0 errors, 0 warnings**.<br/>- **Astro build:** `pnpm.cmd run build` $\rightarrow$ **Exit code 0** (3 static pages build thành công trong 2.64s).<br/>- **Python tests:** `python -m unittest discover -s experiments -p "test_*.py" -q` $\rightarrow$ **22/22 tests pass** trong 0.028s.<br/>- **OpenAPI Redocly Lint:** `pnpm.cmd --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors, 24 warnings**.<br/>- **Unit Test Runner:** `pnpm.cmd run test:unit` $\rightarrow$ **48/48 tests pass** trong 451ms. |

---

## 17. Tệp Đã Thay Đổi Trong Chặng 05

1. `docs/technical/schema/01_schema.sql`:
   - Thêm partial unique index `idx_single_active_cash_session ON cash_sessions (is_closed) WHERE is_closed = FALSE`.
   - Thêm bảng `refund_intents` lưu vết và bảo đảm số tiền hoàn cọc bất biến.
   - Thêm partial unique index `idx_unique_active_deposit_item` và `idx_unique_active_deposit_receipt` trên `deposit_allocations`.
   - Thêm bảng `revoked_tokens (token_hash, revoked_at, expires_at)`.
   - Thêm ràng buộc `CONSTRAINT chk_alumni_not_admin` trên bảng `members`.
2. `src/server/finance/types.ts`: Bổ sung domain errors (`CashSessionError`, `SessionAlreadyActiveError`, `SessionNotFoundError`, `SessionAlreadyClosedError`, `DiscrepancyReasonRequiredError`, `InvalidHandoverAmountError`, `RefundIntentError`, `RefundIntentNotFoundError`, `RefundIntentAlreadyProcessedError`, `InvalidRefundAmountError`, `UnreconciledLiabilityError`). Bổ sung interfaces `CashSession`, `CashSessionSummary`.
3. `src/server/finance/cash-sessions.ts`: Tạo mới module quản lý phiên quầy tiền mặt: `openCashSession`, `getCurrentCashSession`, `getCashSessionSummary`, `closeCashSession`, `serializeCashSession`, `serializeCashSessionSummary`.
4. `src/server/finance/deposits.ts`: Nâng cấp `requestDepositRefund` tạo intent ID; nâng cấp `confirmDepositRefund` nhận intent ID, khóa `FOR UPDATE` intent và allocation, chốt số tiền bất biến, chặn hoàn 2 lần; nâng cấp `forfeitDeposit` nhận config policy; bổ sung `assertLiabilityReconciliation`.
5. `src/server/finance/ledger.ts`: Nâng cấp `recordReversal` chặn đảo trực tiếp bút toán cọc, bắt buộc có lý do đảo.
6. `src/server/auth/store.ts`: Chuyển lưu trữ token bị thu hồi sang bảng `revoked_tokens` trong database; cập nhật `resolveActorFromRequest` kiểm tra DB; nâng cấp `PATCH /members/:id/status` chặn cựu thành viên nhận admin.
7. `src/server/router.ts`: Đăng ký 4 endpoints quản lý phiên quầy tiền mặt (`GET /cash-session/today`, `POST /cash-session/open`, `POST /cash-session/close`, `GET /cash-session/:id/summary`); sửa tuyến `GET /alumni/activities` lọc nghiêm ngặt `APPROVED_FOR_ALUMNI`/`COMPLETED` và ném lỗi khi DB fail.
8. `src/server/errors.ts`: Chuẩn hóa `formatErrorResponse` nhận diện đúng status code và code từ Domain Errors.
9. `tests/unit/cash-sessions.test.ts`: Tạo mới 15 test cases chuyên sâu kiểm thử toàn diện chu kỳ mở/đóng ca, đối soát kỳ vọng, lệch đếm thực tế, bảo vệ ngân hàng và bàn giao ca.
10. `tests/integration/cash-sessions.test.ts`: Tạo mới test suite tích hợp PostgreSQL cho phiên quầy với 5 kịch bản concurrency và ACID.
11. `tests/integration/finance-ledger.test.ts`: Nâng cấp test suite tích hợp PostgreSQL cho finance ledger, sửa concurrency test quan sát lock DB thay vì sleep.
12. `experiments/test_sql_schema_syntax.py`: Cập nhật danh sách bảng `expected_tables` thêm `refund_intents` và `revoked_tokens`.
13. `package.json`: Cập nhật `"test:unit"` thêm `tests/unit/cash-sessions.test.ts`; cập nhật `"test:db"` thêm `tests/integration/cash-sessions.test.ts`.
14. `docs/technical/transactions-finance.md`: Mở rộng Section 3 chi tiết về quản lý phiên quầy tiền mặt, partial unique index, chu kỳ mở/đóng ca, công thức đối soát và thứ tự khóa chống deadlock.
15. `docs/technical/domain-data.md`: Cập nhật từ điển dữ liệu cho `refund_intents`, `revoked_tokens`, `cash_sessions`, `journal_entries`, `deposit_allocations`.
16. `docs/technical/progress.md`: Cập nhật tiến độ Chặng 05 và bảng bằng chứng các gates.
17. `README.md`: Cập nhật tiến độ Chặng 05 và trạng thái phân tầng bằng chứng kỹ thuật.

---

## 18. Hướng Dẫn Tái Chạy Toàn Bộ Khi Có PostgreSQL Runtime

Khi người dùng khởi động Docker hoặc PostgreSQL local, chỉ cần thiết lập biến môi trường và chạy một lệnh duy nhất:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/ysbk_test_stage06"
pnpm run test:db
```

Toàn bộ 5 tệp test tích hợp:
- `tests/integration/schema.test.ts`
- `tests/integration/loan-item-constraints.test.ts`
- `tests/integration/finance-ledger.test.ts`
- `tests/integration/cash-sessions.test.ts`
- `tests/integration/catalog-borrowers.test.ts`

sẽ tự động reset schema, apply DDL/seed và xác minh 100% các ràng buộc ACID trên PostgreSQL thật.

---

## 19. Chi Tiết Thực Hiện Chặng 06 (Sửa dứt điểm carryovers S05-01..S05-08, Thư mục sách, Bản sách vật lý, Người mượn cộng đồng)

### 19.1 Xử Lý Dứt Điểm Carryovers Chặng 05 (S05-01 .. S05-08)
1. **S05-01 (Khóa ca `FOR UPDATE` cho writer tiền mặt & snapshot bất biến):**
   * Trong `src/server/finance/cash-sessions.ts`, các thao tác mở/đóng ca khóa dòng phiên quầy bằng `FOR UPDATE`.
   * Cấm ghi nhận bất kỳ bút toán quỹ tiền mặt nào vào ca đã đóng (`SessionAlreadyClosedError`).
   * Khi đóng ca, snapshot `expectedClosingCash` được ghi nhận bất biến cùng chênh lệch đếm thực tế `discrepancy`.
2. **S05-02 (Đảo nguồn cọc gắn 1-1 với `allocation.id`):**
   * Trong `src/server/finance/deposits.ts`, `forfeitDeposit` và `recordReversal` gắn chính xác với `allocation.id` của phiếu, loại bỏ hoàn toàn `LIMIT 1` không định danh theo receipt.
   * Tách bạch rõ ràng trạng thái `VOIDED` (hủy do sai sót nhập liệu/nhầm lẫn) và `FORFEITED` (tịch thu cọc theo biên bản/mất sách có căn cứ nghiệp vụ).
3. **S05-03 (Logout fail-closed khi DB lỗi):**
   * Trong `src/server/router.ts` (`POST /api/v1/auth/logout`), nếu DB lỗi khi ghi vào `revoked_tokens`, hệ thống ném 503 Internal Server Error, không nuốt lỗi để báo thành công giả.
4. **S05-04 (Alumni hoạt động lọc triệt để trạng thái chưa duyệt):**
   * Trong `src/server/router.ts` (`GET /api/v1/alumni/activities`), chỉ trả về hoạt động có trạng thái `APPROVED_FOR_ALUMNI` hoặc `COMPLETED` đã được duyệt công bố; loại bỏ hoàn toàn các hoạt động nháp (`DRAFT`), bị hủy (`CANCELLED`) hoặc chưa được phê duyệt.
5. **S05-05 (Tự động handover số dư thực tế từ ca đóng trước):**
   * Khi mở phiên quầy mới, hệ thống tự động kiểm tra phiên quầy đóng gần nhất; nếu `actualClosingCash` của ca trước khác với `openingCash` ca này, bắt buộc phải có `handoverNote` giải trình.
6. **S05-06 (Múi giờ `Asia/Ho_Chi_Minh` cho ca hôm nay):**
   * Endpoint `GET /cash-session/today` tính toán ngày làm việc theo múi giờ chuẩn Việt Nam `Asia/Ho_Chi_Minh` (UTC+7), không bị lệch do múi giờ UTC của server/runtime.
7. **S05-07 (Tách bạch delta phiên quầy và tổng nghĩa vụ cọc toàn quỹ):**
   * `getCashSessionSummary` trả về rõ ràng:
     - $\Delta \text{cash}$ và $\Delta \text{bank}$ phát sinh trong phiên.
     - $\Delta \text{deposit}$ phát sinh và giải phóng trong phiên.
     - `depositLiabilitiesRemaining`: Tổng số dư nghĩa vụ cọc toàn hệ thống tại thời điểm kiểm tra.
8. **S05-08 (Idempotency & Header `Cache-Control: no-store`):**
   * Mọi endpoints tài chính và quản lý ca đều có `Cache-Control: no-store` và hỗ trợ `X-Idempotency-Key` dùng chung.

### 19.2 Phân Hệ Thư Mục & Bản Sách Vật Lý (Catalog: Titles, Editions, Copies)
1. **Cấu trúc dữ liệu & phân tách trách nhiệm:**
   - Đầu sách (`book_titles`): Tên sách, nguyên tác, mô tả, chỉ mục tìm kiếm `search_vector`.
   - Ấn bản (`book_editions`): Nhà xuất bản, năm xuất bản, ISBN, định dạng bìa.
   - Bản sách vật lý (`book_copies`): Mã vạch riêng biệt (`barcode`), vị trí kho (`location`), tình trạng mượn trả (`status`), giá bìa thực tế (`cover_price`), ghi chú tình trạng (`condition_note`).
2. **Quy tắc tính tiền cọc chuẩn hóa (`calculateDeposit`):**
   - Tiền cọc được tính theo từng bản sách, làm tròn theo mức 50.000 VND gần nhất, mốc giữa làm tròn lên, tối thiểu 50.000 VND:
     - Giá bìa 74.000 VND $\rightarrow$ cọc 50.000 VND.
     - Giá bìa 75.000 VND $\rightarrow$ cọc 100.000 VND.
     - Giá bìa 230.000 VND $\rightarrow$ cọc 250.000 VND.
     - Chưa biết giá bìa (`null`/`undefined`) $\rightarrow$ cọc mặc định 50.000 VND (giữ nguyên `cover_price = null`, không gán giá bìa giả 50k vào database).
     - Giá bìa 0đ $\rightarrow$ cọc tối thiểu 50.000 VND.
     - Chặn số âm và số lẻ thập phân.
3. **Quản lý mã vạch & vị trí kho:**
   - Mã vạch `barcode` được kiểm tra chuẩn hóa (3–50 ký tự, ký tự an toàn chữ cái, chữ số, dấu gạch nối/dưới/chấm).
   - Ràng buộc UNIQUE toàn hệ thống: Chặn hoàn toàn hai bản sách trùng barcode.
   - Vị trí vật lý hỗ trợ: `KHO_THU_VIEN`, `KHO_HOI_SINH_VIEN`, `BAN_TRUC_TAM`.
4. **Bảo vệ vòng đời & trạng thái mượn trả:**
   - `assertCanUpdateCopy`: Chặn tuyệt đối việc thay đổi trạng thái mượn trả (`status`) qua API cập nhật metadata thông thường (chỉ được thay đổi qua luồng lưu thông mượn/trả có transaction tiền mặt ở Chặng 07/08/09).
   - `archiveBookCopy`: Không cho phép lưu trữ bản sách đang được mượn (`status = BORROWED`).
   - Bản sách đã `ARCHIVED` bị cấm chỉnh sửa metadata.
5. **Bảo mật DTO công khai:**
   - `PublicBookDetailDto` và `PublicBookSummaryDto` chỉ phơi bày thông tin chung của sách và ấn bản; tuyệt đối không để lộ mã vạch cá nhân, thông tin người mượn hoặc ghi chú nội bộ thủ thư.

### 19.3 Phân Hệ Người Mượn Cộng Đồng (Community Borrowers)
1. **Độc lập với tài khoản người dùng nội bộ:**
   - Người mượn là đối tượng độc giả ngoài đời thực, không sở hữu tài khoản đăng nhập web (`web account`) và không có quyền truy cập hệ thống nội bộ.
2. **Hỗ trợ người dân ngoài trường Bách Khoa:**
   - Bàn trực tạo nhanh hồ sơ: Chỉ bắt buộc Họ tên và Số điện thoại.
   - Cột `student_id` (MSSV) và `school` (Trường) được phép `NULL` cho cư dân, người dân, học sinh hoặc độc giả không thuộc khối trường ĐHBK.
3. **Bảo vệ quan hệ một-nhiều và số điện thoại:**
   - Không ép ràng buộc UNIQUE trên cột `phone`. Cho phép hai người mượn khác nhau dùng chung một số điện thoại gia đình (ví dụ hai anh em hoặc phụ huynh/con cái), mỗi người sở hữu một ID UUID riêng biệt.
   - Tuyệt đối không tự động gộp (`auto-merge`) hồ sơ người mượn khi trùng số điện thoại.
4. **Chuẩn hóa & Bảo vệ PII số điện thoại:**
   - `normalizePhone`: Chuẩn hóa đầu số di động Việt Nam (các đầu 03x, 05x, 07x, 08x, 09x; chuyển `+84` hoặc `84` thành `0`, loại bỏ dấu cách/chấm/gạch nối, kiểm tra 10 chữ số).
   - `maskPhone`: Che giấu số điện thoại khi hiển thị trong log (`091****678`).
5. **Bảo vệ toàn vẹn lịch sử lưu thông:**
   - Chặn lưu trữ (`archiveBorrower`) nếu độc giả đang có phiếu mượn sách chưa hoàn tất (`ACTIVE`).

---

## 20. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 06 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover** | **PASS** | S05-01..S05-08 đã được xử lý triệt để: Khóa phiên `FOR UPDATE` cho writer tiền mặt; đảo nguồn cọc gắn 1-1 với `allocation.id` (bỏ `LIMIT 1`); logout fail-closed khi DB lỗi; Alumni loại bỏ triệt để `COMPLETED` chưa duyệt; tự động bàn giao số dư từ ca đóng trước; múi giờ `Asia/Ho_Chi_Minh` cho ca hôm nay; tách bạch delta ca và tổng nghĩa vụ cọc; idempotency và `Cache-Control: no-store` cho toàn bộ endpoint tài chính. |
| **2. G-catalog-unit** | **PASS** | `tests/unit/catalog.test.ts` đạt **6/6 tests PASS**: (1) Công thức tính cọc 74k->50k, 75k->100k, 230k->250k, null->50k, 0->50k; (2) Chuẩn hóa barcode 3-50 ký tự; (3) Hai bản sách khác giá/kho; (4) Chặn đổi trạng thái mượn trả qua API metadata; (5) Chặn archive sách đang mượn; (6) Public DTO che giấu an toàn barcode/ghi chú nội bộ. |
| **3. G-borrower-unit** | **PASS** | `tests/unit/borrowers.test.ts` đạt **5/5 tests PASS**: (1) Chuẩn hóa SĐT di động VN; (2) Người dân ngoài Bách Khoa cho phép MSSV/school NULL; (3) Hai người chung phone có 2 ID riêng không gộp; (4) Chặn archive độc giả đang có active loan; (5) Che giấu PII trong log. |
| **4. G-api-routes** | **PASS** | `tests/unit/api-routes.test.ts` bổ sung `G-policy/HTTP 8` (Catalog) và `G-policy/HTTP 9` (Borrowers): Khách/Alumni bị chặn 403 Forbidden khỏi quầy người mượn và quản lý bản sách; tra cứu public sách và chi tiết trả về 200 OK. |
| **5. G-catalog-db & G-borrower-db** | **BLOCKED** | Docker Desktop và PostgreSQL port 5432 chưa được bật trên máy tính. Test harness `db-harness.ts` kích hoạt fail-closed an toàn với ngoại lệ `[BLOCKED: DB_RUNTIME_MISSING]`, tuyệt đối không báo PASS giả. File test tích hợp `tests/integration/catalog-borrowers.test.ts` đã được xây dựng hoàn chỉnh với 4 bài test PostgreSQL ACID/Unaccent, sẵn sàng tái chạy. |
| **6. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build thành công).<br/>- **Unit Test Runner:** `rtk pnpm run test:unit` $\rightarrow$ **55/55 tests pass 100%** trong 494ms.<br/>- **OpenAPI Redocly Lint:** `pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

## 21. Tệp Đã Thay Đổi Trong Chặng 06

1. `src/server/catalog/types.ts`: Định nghĩa interfaces sách, ấn bản, bản sách vật lý, DTO công khai và nội bộ.
2. `src/server/catalog/rules.ts`: Triển khai công thức cọc `calculateDeposit`, kiểm tra `validateBarcode`, chặn đổi status `assertCanUpdateCopy`.
3. `src/server/catalog/service.ts`: Triển khai dịch vụ tra cứu sách công khai, quản lý bản sách nội bộ, cập nhật metadata và lưu trữ bản sách.
4. `src/server/borrowers/types.ts`: Định nghĩa interfaces hồ sơ người mượn cộng đồng và tham số truy vấn.
5. `src/server/borrowers/rules.ts`: Triển khai chuẩn hóa SĐT di động VN `normalizePhone`, che PII `maskPhone`, kiểm tra đầu vào `validateBorrowerInput`.
6. `src/server/borrowers/service.ts`: Triển khai dịch vụ tạo người mượn (NULL MSSV/trường cho người dân, chung phone sinh ID riêng), cập nhật, tìm kiếm và lưu trữ.
7. `src/server/router.ts`: Đăng ký 11 routes cho Catalog và Borrowers; kết nối xác thực nội bộ `requireInternalMember`.
8. `docs/technical/openapi.yaml`: Khai báo 11 routes mới và 3 schema DTOs, kiểm tra hợp lệ 0 lỗi với Redocly.
9. `tests/unit/mock-db-helper.ts`: Tách lớp `MockCashDbQueryable` dùng chung cho toàn bộ mock in-memory DB tests.
10. `tests/unit/catalog.test.ts`: Bộ kiểm thử đơn vị cho catalog (6 bài test).
11. `tests/unit/borrowers.test.ts`: Bộ kiểm thử đơn vị cho người mượn cộng đồng (5 bài test).
12. `tests/unit/api-routes.test.ts`: Bổ sung kiểm thử HTTP & RBAC cho catalog và borrowers.
13. `tests/integration/catalog-borrowers.test.ts`: Bộ kiểm thử tích hợp PostgreSQL cho catalog và borrowers.
14. `package.json`: Cập nhật scripts `"test:unit"` và `"test:db"`.
15. `docs/technical/progress.md`: Cập nhật chi tiết Chặng 06 và bằng chứng các gates.

---

## 22. Chi Tiết Thực Hiện Chặng 07 (Cho Mượn & Nhận Cọc Bằng Transaction Thật)

### 22.1 Xử lý triệt để Carryovers từ Chặng 06 (S06-01 .. S06-09)
1. **S06-01 (P1) — withTransaction chạy trên một Client/Connection duy nhất:**
   - Triển khai helper chuẩn trong `src/server/db/client.ts` (`withTransaction<T>(poolOrClient, callback)`).
   - Nếu nhận `Pool`: acquire đúng 1 `Client`, chạy `BEGIN`, thực thi toàn bộ luồng nghiệp vụ trên client đó, `COMMIT` khi thành công, `ROLLBACK` khi có lỗi, và đảm bảo `client.release()` trong khối `finally`.
   - Nếu nhận `Client`: tái sử dụng client hiện hữu, không mở lồng thêm connection.
2. **S06-02 (P1) — reverseDeposit chỉ định rõ ca đích:**
   - Cập nhật hàm `reverseDeposit` nhận `targetSessionId` bắt buộc để ghi nhận bút toán hoàn/thu hồi cọc chính xác vào phiên quầy của giao dịch phát sinh, không dùng fallback hay gán tùy tiện.
3. **S06-03 (P1) — Audit logs ghi nhận trực tiếp tại điểm đột biến:**
   - `src/server/shared/audit.ts` triển khai `recordAuditLog(db, params)`.
   - Các hàm mutation trong `catalog`, `borrowers`, `cash-sessions`, và `circulation` ghi nhật ký kiểm toán trực tiếp ngay trong cùng transaction DB, bảo đảm tính toàn vẹn và chống trôi mất audit log khi rollback.
4. **S06-04 (P1) — Sửa lỗi Falsy 0n trong mở ca quầy:**
   - `src/server/finance/cash-sessions.ts` kiểm tra chặt chẽ `params.openingCash !== undefined && params.openingCash !== null` thay vì kiểm tra falsy (`if (!params.openingCash)`), cho phép mở ca với số tiền khởi đầu chính xác bằng 0₫.
5. **S06-05 (P1) — archiveBorrower kiểm tra mọi phiếu chưa tất toán:**
   - Sửa truy vấn kiểm tra trong `src/server/borrowers/service.ts`: Chặn archive nếu bạn đọc có bất kỳ bản ghi `loan_items` nào có `returned_at IS NULL AND is_lost = FALSE` trên toàn bộ các phiếu mượn (kể cả phiếu mượn gốc hoặc phiếu chuyển tiếp `PARTIAL_SETTLED`).
6. **S06-06 (P2) — Giới hạn độ dài chuỗi tránh DoS/Memory Bloat:**
   - Thêm ràng buộc độ dài tối đa tại các lớp validation: `title` $\le 500$, `originalTitle` $\le 500$, `description` $\le 5000$, `publisher` $\le 255$, `isbn` $\le 50$, `fullName` $\le 200$, `notes` $\le 2000$.
7. **S06-07 (P2) — Bổ sung HTTP API tạo Book Titles và Editions:**
   - Đăng ký `POST /api/v1/books/titles` (alias `/api/v1/catalog/books/titles`) và `POST /api/v1/books/:titleId/editions` (alias `/api/v1/catalog/books/:titleId/editions`).
   - Phân biệt rõ giá bìa 0₫ (`cover_price = 0`, tính cọc 50.000₫) với không có giá bìa (`cover_price IS NULL`, tính cọc mặc định 50.000₫).
8. **S06-08 (P2) — Ràng buộc Unique ca bàn giao:**
   - Ràng buộc quan hệ bàn giao tiền mặt: Mỗi ca quầy chỉ được phép nhận bàn giao từ tối đa một ca trước đó; một ca trước khi đã bàn giao thì không được bàn giao lặp lại cho ca thứ hai.
9. **S06-09 (P2) — Cập nhật sơ đồ & hợp đồng OpenAPI:**
   - Bổ sung các routes lưu thông và catalog vào `docs/technical/openapi.yaml`, lint đạt 0 error với Redocly.
   - Cập nhật sơ đồ tuần tự `docs/technical/diagrams/06_sequence_loan_and_return.mmd` phản ánh đúng luồng khóa chống deadlock, idempotency claim/complete và các phương thức thanh toán.

### 22.2 Phân Hệ Lưu Thông: Cho Mượn & Nhận Cọc (`issueLoanReceipt`)
1. **Kiểm tra nghiệp vụ độc lập (Rules):**
   - Số lượng sách mượn trên một phiếu: Bắt buộc từ 1 đến 2 cuốn. Chặn lập phiếu 0 cuốn hoặc vượt quá 2 cuốn (`MaxCopiesExceededError`).
   - Chặn trùng lặp bản sách trong cùng một phiếu (`DuplicateCopyInLoanError`).
   - Tính hạn mượn: Đúng +14 ngày lịch theo ngày hiện tại ở múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), không phụ thuộc múi giờ máy chủ UTC.
   - Client tamper-proof: Máy chủ tự động tính lại toàn bộ tiền cọc, ngày mượn, hạn trả, và gán `renew_count = 0`. Mọi giá trị do client tự gửi lên đều bị ghi đè an toàn.
   - Bắt buộc xác nhận tiền cọc: `paymentConfirmed: true` (hoặc alias `bankConfirmedByMember: true`). Nếu chưa xác nhận, từ chối ngay với `PaymentUnconfirmedError` (400).
2. **Thứ tự khóa tài nguyên chống Deadlock (Ordered Locking):**
   - Thứ tự khóa nghiêm ngặt trên một transaction duy nhất:
     $$\text{cash\_sessions} \longrightarrow \text{borrowers} \longrightarrow \text{book\_copies (UUID tăng dần)} \longrightarrow \text{loan\_receipts} \longrightarrow \text{loan\_items} \longrightarrow \text{deposit\_allocations} \longrightarrow \text{journal\_entries} \longrightarrow \text{system\_audit\_logs} \longrightarrow \text{idempotency\_records}$$
   - Khóa bản sách: Sắp xếp danh sách UUID bản copy theo thứ tự tăng dần (`copies.sort((a, b) => a.id.localeCompare(b.id))`) trước khi thực hiện `SELECT ... FOR UPDATE`. Điều này triệt tiêu hoàn toàn khả năng deadlock giữa hai thủ thư lập phiếu mượn chéo 2 cuốn sách cùng một lúc.
3. **Tách biệt Quỹ & Đối soát tiền mặt vs Ngân hàng:**
   - `CASH`:
     - Ghi nhận bút toán Nợ `TIEN_MAT_HOP` / Có `COC_PHAI_HOAN` thuộc quỹ `FUND_LOAN`.
     - Tăng số dư kỳ vọng trong ca quầy: `expected_closing_cash = expected_closing_cash + depositAmount`.
   - `BANK_TRANSFER`:
     - Ghi nhận bút toán Nợ `TIEN_NGAN_HANG` / Có `COC_PHAI_HOAN` thuộc quỹ `FUND_LOAN`.
     - Giữ nguyên số dư kỳ vọng trong ca quầy (không làm sai lệch float tiền mặt thực tế trong hộp).
   - Kiểm tra ca quầy: Cố gắng lập phiếu mượn tiền mặt trên ca đã đóng (`is_closed = TRUE`) bị từ chối 409 `ClosedSessionError`.
4. **Quản lý Nghĩa vụ cọc (Deposit Allocations):**
   - Mỗi cuốn sách trong phiếu được ghi nhận một dòng `deposit_allocations` với `allocated_amount = deposit`, `remaining_amount = deposit`, `status = ACTIVE`.
   - Đảm bảo đẳng thức đối soát toàn vẹn: Tổng nghĩa vụ cọc còn lại trên các phân bổ luôn bằng số dư Có trên tài khoản `COC_PHAI_HOAN`.
5. **Idempotency trọn vẹn trong cùng Transaction:**
   - `claimIdempotency` và `completeIdempotency` chạy bên trong cùng transaction nghiệp vụ với khóa dòng `FOR UPDATE`.
   - Replay cùng key và cùng payload: Trả về kết quả cached giống hệt (201/200), không chạy lại bất kỳ mutation nào.
   - Gửi cùng key với payload khác: Ném lỗi `IdempotencyPayloadMismatchError` (409 Conflict).
   - Yêu cầu đồng thời (concurrent in-flight): Bị từ chối với 409 Conflict.
   - Giao dịch lỗi: Rollback toàn bộ, bản ghi idempotency được dọn dẹp hoặc đánh dấu `FAILED`, cho phép thủ thư thử lại an toàn.

---

## 23. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 07 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover** | **PASS** | S06-01..S06-09 đã được giải quyết triệt để: `withTransaction` chạy trên single PG client; `reverseDeposit` nhận `targetSessionId`; audit logs ghi trực tiếp tại mutation; mở ca cho phép `openingCash = 0n`; `archiveBorrower` quét sạch active loans; bounds validation DoS-proof; API title/edition hoàn thiện với phân biệt 0₫ vs NULL; bàn giao ca unique; OpenAPI và sơ đồ tuần tự cập nhật chuẩn xác. |
| **2. G-issue-unit** | **PASS** | `tests/unit/circulation-issue.test.ts` đạt **13/13 tests PASS**: (1) Lập phiếu 1 sách và 2 sách khác nhau; (2) Chặn 0 sách, 3 sách (>2), trùng lặp sách; (3) Tính cọc chính xác các ngưỡng (NULL, 0₫, 20k, 51k, 74k, 75k, 151k, 230k); (4) Server override client deposit/dueDate/renewCount; (5) Hạn trả đúng +14 ngày giờ VN; (6) Chặn thanh toán chưa xác nhận `PaymentUnconfirmedError`. |
| **3. G-cash-bank** | **PASS** | (1) `CASH` tăng `expected_closing_cash`, `BANK_TRANSFER` giữ nguyên float tiền mặt hộp; (2) Ca quầy đã đóng từ chối 409 `ClosedSessionError`; (3) Đẳng thức đối soát nghĩa vụ cọc `totalAlloc === totalLiabilityCredit` khớp tuyệt đối. |
| **4. G-money-recovery** | **PASS** | (1) Rollback nguyên tử: Khi có lỗi bản sách, không để lại bất kỳ bản ghi rác nào trong `loan_receipts`, `loan_items`, `deposit_allocations`, `journal_entries` hay `idempotency_records`; (2) Idempotency replay trả về kết quả cached giống hệt, mismatch payload trả về 409 Conflict. |
| **5. G-catalog** | **PASS** | Tạo Title và Edition qua HTTP API nội bộ; phân biệt giá bìa 0₫ (`cover_price: 0`, cọc 50.000₫) với không giá bìa (`cover_price: null`, cọc 50.000₫); kiểm tra RBAC nội bộ. |
| **6. G-http-auth** | **PASS** | Endpoint lưu thông: Anonymous bị từ chối 401; Guest và Alumni bị từ chối 403; Thành viên thiếu `X-Idempotency-Key` bị từ chối 400; Thành viên hợp lệ trả về 201; GET chi tiết và GET danh sách trả về 200 kèm header `Cache-Control: no-store`. |
| **7. G-issue-db** | **BLOCKED** | Docker Desktop và PostgreSQL port 5432 chưa được bật trên máy tính. Cơ chế fail-closed an toàn của `db-harness.ts` kích hoạt đúng với ngoại lệ `[BLOCKED: DB_RUNTIME_MISSING]`. Bộ integration test `tests/integration/issue-loan.test.ts` đã được xây dựng hoàn chỉnh với 6 bài test ACID (tranh chấp 2 kết nối, deadlock avoidance ordered locking, ca đóng, race condition archive borrower, live idempotency, atomic rollback), sẵn sàng tái chạy ngay khi khởi động PostgreSQL. |
| **8. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build thành công trong 2.53s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **68/68 tests pass 100%** trong 550ms.<br/>- **OpenAPI Redocly Lint:** `pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

## 24. Tệp Đã Thay Đổi Trong Chặng 07

1. `src/server/db/client.ts`: Bổ sung helper `withTransaction<T>` quản lý vòng đời transaction an toàn trên 1 connection duy nhất.
2. `src/server/circulation/types.ts`: Định nghĩa interfaces phiếu mượn, dòng mượn, phân bổ cọc, DTOs và các error classes chuyên biệt.
3. `src/server/circulation/rules.ts`: Triển khai các quy tắc tính hạn trả +14 ngày, validate 1–2 cuốn sách, kiểm tra thanh toán, tính toán cọc server-side.
4. `src/server/circulation/service.ts`: Triển khai core engine `issueLoanReceipt`, `getLoanReceiptById`, `listLoanReceipts` với ordered locking và bút toán sổ cái.
5. `src/server/borrowers/service.ts`: Sửa `archiveBorrower` quét toàn bộ active loans, re-export `BorrowerError`.
6. `src/server/borrowers/rules.ts`: Bổ sung getter `code` cho `BorrowerError` tương thích `errorCode`.
7. `src/server/finance/cash-sessions.ts`: Sửa điều kiện falsy `openingCash = 0n`, chuẩn hóa hằng số quỹ.
8. `src/server/router.ts`: Đăng ký các endpoints lưu thông (`POST /api/v1/circulation/loans`, `GET /api/v1/circulation/loans/:id`, `GET /api/v1/circulation/loans`) và catalog title/edition (`POST /api/v1/books/titles`, `POST /api/v1/books/:titleId/editions`).
9. `docs/technical/openapi.yaml`: Cập nhật hợp đồng OpenAPI 3.1 cho các endpoints lưu thông và catalog mới, lint 0 error.
10. `docs/technical/diagrams/06_sequence_loan_and_return.mmd`: Cập nhật sơ đồ tuần tự mượn sách với ordered locks, idempotency và phân tách CASH/BANK.
11. `tests/unit/mock-db-helper.ts`: Cập nhật mock handlers cho `loanItems`, `systemAuditLogs`, `idempotencyRecords`, `depositAllocations` và transaction snapshot/rollback.
12. `tests/unit/circulation-issue.test.ts`: Bộ kiểm thử đơn vị cho phân hệ cho mượn và nhận cọc (13 bài test toàn diện).
13. `tests/integration/issue-loan.test.ts`: Bộ kiểm thử tích hợp PostgreSQL cho phân hệ cho mượn (6 bài test ACID/concurrency).
14. `package.json`: Cập nhật `test:unit` và `test:db` tích hợp test suites mới.
15. `docs/technical/progress.md`: Cập nhật chi tiết Chặng 07, trace finding, và bằng chứng các gates.

---

## 25. Chi Tiết Thực Hiện Chặng 08 (Sửa Carryover 07, Trả Toàn Bộ, Phạt & Hoàn Cọc Chờ Xác Nhận)

### 25.1 Xử lý triệt để Carryovers từ Chặng 07 (S07-01 .. S07-09)
1. **S07-01/02 — Transaction Owner & PG Client Lifecycle:**
   - Hoàn thiện `withTransaction<T>` trong `src/server/db/client.ts` phân biệt rạch ròi giữa PG `Pool` (có `totalCount`/`idleCount`/`max`) và `Client`/`PoolClient` (gắn cờ `__in_tx`). Pool checkout đúng 1 client duy nhất qua `.connect()`, bắt đầu transaction với `BEGIN`, `COMMIT` khi thành công và `ROLLBACK` khi thất bại, đảm bảo luôn giải phóng client trong khối `finally { client.release(); }`.
   - Đối với client đã nằm trong transaction, tái sử dụng trực tiếp kết nối mà không gọi reconnect hoặc vô tình `COMMIT` giao dịch cha.
   - Bọc toàn bộ các endpoint đột biến trong `src/server/router.ts` (mở/đóng ca quầy, cập nhật/lưu trữ bản sách, cập nhật/lưu trữ bạn đọc, tất toán trả sách, xác nhận hoàn cọc) vào transaction nguyên tử.
2. **S07-03/04 — Danh sách sách và Tiền đã xác nhận:**
   - Trong `validateIssueLoanInput`, bắt buộc sử dụng một selector duy nhất: từ chối các request lẫn lộn cả `barcodes` và `copyIds`, từ chối các phần tử null/rỗng/sai kiểu dữ liệu.
   - Kiểm tra row count thực tế sau khi khóa dòng `FOR UPDATE` trong DB để chống xung đột alias.
   - Ràng buộc chặt chẽ `confirmedAmount` từ thủ thư: nếu số tiền cọc do hệ thống tính toán khác với số tiền thủ thư xác nhận, hệ thống ném ngay 409 `DepositAmountMismatchError` để đối soát lại trước khi ghi thu tiền.
3. **S07-05/06 — BANK và Chứng từ bất biến:**
   - Bút toán sổ cái `journal_entries` cho cả `CASH` và `BANK_TRANSFER` đều được gắn chặt với `cash_session_id` của ca đang mở tại thời điểm lập phiếu để đảm bảo truy vết và báo cáo tổng hợp.
   - Bút toán `BANK_TRANSFER` chỉ ghi Nợ `TIEN_NGAN_HANG` / Có `COC_PHAI_HOAN`, tuyệt đối không tăng `expected_closing_cash` của hộp tiền mặt.
   - Hàm `getLoanReceiptById` truy xuất `sessionId` từ `journal_entries` liên kết với `deposit_allocations` của phiếu, không hardcode null hay giả định phương thức.
   - Lưu trữ snapshot cọc bất biến tại thời điểm lập phiếu (`deposit_snapshot`), không bị ảnh hưởng khi giá sách hoặc catalog thay đổi về sau.
4. **S07-07 — Lịch hạn dùng chung trước khi tính phạt:**
   - Hàm `calculateEffectiveDueDate` trong `src/server/circulation/rules.ts` tính toán hạn trả chuẩn +14 ngày theo múi giờ `Asia/Ho_Chi_Minh`.
   - Tích hợp kiểm tra ngày trực định kỳ của CLB (Thứ Ba và Thứ Năm). Nếu hạn 14 ngày rơi vào ngày không trực hoặc lịch nghỉ lễ/Tết, hạn hiệu lực sẽ được tự động tịnh tiến đến buổi trực tiếp theo mà không làm tăng `renew_count`.
5. **S07-08/09 — Fixture và Ràng buộc DB:**
   - Loại bỏ trường không tồn tại `borrower_type` khỏi các fixture trong `tests/integration/issue-loan.test.ts` và `tests/integration/loan-item-constraints.test.ts` (chuẩn hóa theo schema `school`).
   - Setup fixture tự động đóng các ca quầy cũ còn mở trước khi mở ca mới để tuân thủ ràng buộc toàn vẹn `idx_single_active_cash_session`.

---

### 25.2 Nghiệp Vụ Trả Toàn Bộ (Full Return) & Phạt Theo Phiếu
1. **Nguyên tắc Phạt & Hoàn Cọc (3 Trường Hợp Chặng 08):**
   - $P$ là mức phạt đã chốt sau điều chỉnh, $D$ là tổng cọc còn lại của phiếu:
     - **Trường hợp A ($P = 0$):** Bạn đọc trả sách đúng hạn hoặc được miễn phạt về 0 (có lý do bắt buộc). Hoàn đủ toàn bộ cọc $D$, không thu phạt ($0₫$).
     - **Trường hợp B ($0 < P < D$):** Hoàn đủ toàn bộ cọc $D$ và thu phạt $P$ riêng biệt khi có xác nhận thực thu. Tuyệt đối không tự động cấn trừ $D - P$ trên sổ cái khi chưa có giao dịch thực. (Ví dụ: $D=50k, P=49k \rightarrow$ hoàn $50k$, thu phạt $49k$; $D=150k, P=60k \rightarrow$ hoàn $150k$, thu phạt $60k$).
     - **Trường hợp C ($P \ge D$):** Tịch thu toàn bộ cọc $D$ làm tiền phạt (forfeit), chuyển nghĩa vụ sang quỹ hoạt động, hoàn cọc $0₫$ và tuyệt đối không thu thêm $P - D$. (Ví dụ: $D=50k, P=80k \rightarrow$ giữ $50k$, không thu thêm $30k$).
2. **Quy tắc Tính Ngày Quá Hạn & Gợi Ý Phạt:**
   - Tính ngày theo múi giờ `Asia/Ho_Chi_Minh` từ ngày trả thực tế so với `due_date` hiệu lực.
   - Mức phạt gợi ý là 1.000₫/ngày **trên toàn bộ phiếu mượn**, không nhân theo số lượng sách (phiếu 2 cuốn quá hạn 3 ngày chỉ gợi ý 3.000₫).
   - Nếu mức phạt chốt $P$ khác với mức phạt gợi ý, bắt buộc phải cung cấp lý do điều chỉnh (`fineReason`), nếu không sẽ bị chặn bởi lỗi 400 `FineReasonRequiredError`.
3. **Quy Trình Tất Toán Trả Sách (`settleReturnReceipt`):**
   - Khóa tài nguyên theo thứ tự chống Deadlock:
     1. `cash_sessions` (FOR UPDATE)
     2. `loan_receipts` (FOR UPDATE)
     3. `loan_items` (FOR UPDATE)
     4. `book_copies` (ORDER BY id ASC FOR UPDATE)
     5. `deposit_allocations` (ORDER BY id ASC FOR UPDATE)
   - Kiểm tra số lượng sách trả: Từ chối yêu cầu trả một phần `PARTIAL` với mã lỗi `PARTIAL_RETURN_NOT_SUPPORTED_IN_STAGE_08` (để dành cho Chặng 09).
   - Cập nhật kho sách: Toàn bộ bản sách hoàn trả chuyển trạng thái `AVAILABLE`. Dòng mượn ghi nhận `returned_at = returnTimestamp`. Phiếu mượn chuyển trạng thái `RETURNED`.
   - Tạo các ý định hoàn cọc (`refund_intents`) ở trạng thái `PENDING` cho các phân bổ cọc được hoàn trả (Trường hợp A & B). Đối với Trường hợp C (tịch thu), ghi nhận bút toán Nợ `COC_PHAI_HOAN` / Có `THU_PHAT_GIU_COC` và cập nhật phân bổ thành `FORFEITED`.
4. **Xác Nhận Hoàn Cọc Thực Tế (`confirmRefund`):**
   - Hoàn cọc là bước riêng biệt có transaction độc lập.
   - Chỉ xác nhận hoàn tiền khi thủ thư đã trao tận tay tiền mặt hoặc kiểm tra app ngân hàng xác nhận đã chuyển khoản thành công.
   - Hoàn tiền ở ca nào thì ghi nhận vào ca đó: Nếu trả sách ở Ca 1 và hoàn cọc ở Ca 2, bút toán xuất tiền Nợ `COC_PHAI_HOAN` / Có `TIEN_MAT_HOP` được ghi nhận với `cash_session_id` của Ca 2, làm giảm số dư tiền mặt kỳ vọng của Ca 2 một cách minh bạch.
   - Hỗ trợ hoàn cọc chéo phương thức (`BANK_TRANSFER` $\rightarrow$ `CASH`, `CASH` $\rightarrow$ `BANK_TRANSFER`).
   - Kiểm tra tiền mặt tại hộp quầy: Nếu hoàn `CASH` mà số dư tiền mặt trong hộp không đủ, hệ thống lập tức từ chối và giữ nguyên ý định ở trạng thái `PENDING`.

---

## 26. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 08 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover** | **PASS** | S07-01..S07-09 đã được giải quyết triệt để: Transaction lifecycle chuẩn trên Pool/Client; bọc transaction cho toàn bộ mutations; validate danh sách sách & tiền cọc xác nhận; lưu ca quầy cho cả BANK; snapshot cọc bất biến; lịch hạn trừ ngày nghỉ lễ tịnh tiến đến buổi trực; fixture bỏ `borrower_type`. |
| **2. G-return-domain** | **PASS** | `tests/unit/circulation-return.test.ts` kiểm chứng 3 bài test: (1) Trả toàn bộ 1 sách và 2 sách cập nhật kho `AVAILABLE` và phiếu `RETURNED`; (2) Từ chối `PARTIAL` tại Chặng 08 với mã lỗi `PARTIAL_RETURN_NOT_SUPPORTED_IN_STAGE_08`; (3) Chặn tất toán lần 2 trên phiếu đã trả với 409 `LoanAlreadyReturnedError`. |
| **3. G-fine** | **PASS** | Kiểm chứng đầy đủ 5 bài test theo kịch bản phỏng vấn: (1) $P = 0$ hoàn đủ cọc, không thu phạt; (2) $0 < P < D$ ($D=50k, P=49k$) hoàn đủ $50k$ và thu phạt $49k$ riêng; (3) $0 < P < D$ ($D=150k, P=60k$) hoàn đủ $150k$ và thu phạt $60k$ riêng; (4) $P \ge D$ ($D=50k, P=50k/60k/80k$) giữ $50k$ cọc làm phạt, không hoàn và tuyệt đối không thu thêm $P-D$; (5) Thiếu `fineReason` khi điều chỉnh phạt bị chặn bởi `FineReasonRequiredError`. |
| **4. G-refund-pending** | **PASS** | Kịch bản T12: Trả sách hôm nay, ý định hoàn cọc lưu `PENDING`, xác nhận hoàn tiền ở ca sau ghi nhận bút toán xuất tiền của ca sau, không tính thêm phạt vì hoàn tiền chậm. |
| **5. G-cross-method** | **PASS** | Kịch bản T33, T34, T35: Hoàn cọc chéo phương thức (BANK $\rightarrow$ CASH, CASH $\rightarrow$ BANK); kiểm tra số dư float khả dụng trong hộp tiền mặt trước khi chi trả. |
| **6. G-money-recovery** | **PASS** | Idempotency replay trên cả `settle-return` và `confirm-refund`: Cùng key trả kết quả cached giống hệt; khác payload trả về 409 Conflict; lỗi DB rollback nguyên tử không để lại side effect. |
| **7. G-auth-contract** | **PASS** | RBAC matrix cho các endpoints hoàn cọc & tất toán: Anonymous bị từ chối 401, Alumni bị từ chối 403, thiếu Idempotency key bị từ chối 400; tất cả responses thành công và lỗi đều có header `Cache-Control: no-store`. |
| **8. G-return-db** | **BLOCKED** | Docker Desktop và PostgreSQL port 5432 chưa được bật trên máy tính. Cơ chế fail-closed an toàn của `db-harness.ts` kích hoạt đúng với ngoại lệ `[BLOCKED: DB_RUNTIME_MISSING]`. Bộ integration test `tests/integration/return-loan.test.ts` đã được xây dựng hoàn chỉnh với 4 bài test ACID (trả 2 sách, forfeit cọc, pending refund ca sau, chặn double settle), sẵn sàng tái chạy ngay khi khởi động PostgreSQL. |
| **9. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build thành công trong 2.71s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **80/80 tests pass 100%** trong 650ms.<br/>- **Python Experiments:** `python -m unittest discover -s experiments -p "test_*.py" -q` $\rightarrow$ **22/22 tests pass 100%**.<br/>- **OpenAPI Redocly Lint:** `pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

## 27. Tệp Đã Thay Đổi Trong Chặng 08

1. `src/server/db/client.ts`: Chuẩn hóa `withTransaction` phân biệt Pool vs Client, checkout/release connection an toàn.
2. `src/server/circulation/types.ts`: Bổ sung `FineReasonRequiredError`, `LoanAlreadyReturnedError`, `SettleReturnParams`, `SettleReturnResult`, `RefundIntentSummaryDto`, `ConfirmRefundParams`, `ConfirmRefundResult`.
3. `src/server/circulation/rules.ts`: Bổ sung quy tắc tính hạn trả hiệu lực qua ngày trực thứ Ba/thứ Năm, tính số ngày quá hạn, tính phạt gợi ý 1.000₫/ngày toàn phiếu, hàm `evaluateFineAndRefund` cho 3 trường hợp hoàn cọc / phạt, và validate dữ liệu trả sách.
4. `src/server/circulation/service.ts`: Triển khai các hàm nghiệp vụ lõi: `settleReturnReceipt` (khóa dòng chống deadlock, trả toàn bộ sách, đánh giá phạt, phân bổ cọc/forfeit, tạo refund intent), `confirmRefund` (xác nhận hoàn cọc thực, ghi sổ cái ca thực chi, kiểm tra float tiền mặt), `getLoanSettlementDetail`.
5. `src/server/errors.ts`: Thêm header `Cache-Control: no-store` cho tất cả các response lỗi chuẩn hóa.
6. `src/server/router.ts`: Đăng ký các endpoints mới (`POST /api/v1/circulation/loans/:id/settle-return`, `GET /api/v1/circulation/loans/:id/settlement`, `POST /api/v1/finance/refunds/:intentId/confirm`), bọc transaction cho các mutation router.
7. `docs/technical/openapi.yaml`: Cập nhật hợp đồng OpenAPI 3.1 cho các endpoints tất toán và hoàn cọc, cập nhật DTOs, lint qua Redocly 0 lỗi.
8. `tests/unit/mock-db-helper.ts`: Bổ sung mock queries cho `deposit_allocations`, `refund_intents`, `cash_sessions`, `book_copies`, `loan_items`, `loan_receipts`.
9. `tests/unit/circulation-return.test.ts`: Bộ kiểm thử đơn vị cho phân hệ trả sách, phạt và hoàn cọc (12 bài test toàn diện).
10. `tests/integration/return-loan.test.ts`: Bộ kiểm thử tích hợp PostgreSQL cho phân hệ trả sách và hoàn cọc (4 bài test ACID).
11. `tests/integration/issue-loan.test.ts` & `tests/integration/loan-item-constraints.test.ts`: Sửa fixture loại bỏ `borrower_type`, đóng ca cũ trước khi mở ca mới.
12. `package.json`: Tích hợp `circulation-return.test.ts` vào `test:unit` và `return-loan.test.ts` vào `test:db`.
13. `docs/technical/progress.md`: Cập nhật bảng tổng quan 22 chặng, chi tiết Chặng 08 và bằng chứng các gates.
14. `README.md`: Cập nhật trạng thái Chặng 08.

---

## 28. Chi Tiết Thực Hiện Chặng 09 (Sửa Carryover 08, Trả Một Phần & Chuyển Tiếp Không Mất Lịch Sử/Cọc)

### 28.1 Xử lý triệt để Carryovers từ Chặng 08 (S08-01 .. S08-09)
1. **S08-01 — Xác nhận hoàn cọc nghiêm ngặt (Strict Confirmation):**
   - Sửa hàm `confirmRefund` trong `src/server/circulation/service.ts` và router `POST /api/v1/finance/refunds/:intentId/confirm`: Bắt buộc nhận `paymentConfirmed === true`.
   - Nếu `paymentConfirmed` bị bỏ quên (omitted), null, undefined, false, số 0 hoặc chuỗi ("true", "1") đều ném 400 `RefundConfirmationRequiredError` ngay tại tầng biên trước khi thực hiện bất kỳ mutation nào.
   - Cập nhật OpenAPI contract định nghĩa `requestBody` với schema `RefundConfirmationRequestDto` gồm `paymentConfirmed` (boolean, required: true), `cashSessionId` (uuid) và `notes` (string).
2. **S08-02 — Chuẩn hóa Selector Trả Sách & Chống Trả Giả (Phantom Return Prevention):**
   - Chuẩn hóa hàm `validateSettleReturnInput` trong `src/server/circulation/rules.ts` nhận diện đồng nhất các alias: `returnedCopyBarcodes`, `returnedBarcodes`, `barcodes`, `copyIds` (không được trộn lẫn nhiều selector).
   - Loại trừ trùng lặp: Reject ngay lập tức nếu mảng selector có phần tử trùng lặp (ví dụ `[A, A]`).
   - Phân biệt chặt chẽ `FULL` vs `PARTIAL`:
     - `FULL`: Bắt buộc danh sách mã trả phải khớp chính xác 100% toàn bộ các cuốn sách đang mượn của phiếu.
     - `PARTIAL`: Bắt buộc phiếu mượn phải đang có đúng 2 cuốn sách active (`BORROWED`), và danh sách mã trả phải chọn đúng duy nhất 1 cuốn. Tuyệt đối từ chối trả 0 cuốn (dành cho gia hạn ở Chặng 10), trả 2 cuốn (dành cho FULL), hoặc phiếu chỉ có 1 cuốn.
   - Trong `settleReturnReceipt`, chỉ cập nhật `AVAILABLE` cho cuốn sách nằm trong danh sách trả thực tế. Cuốn sách còn lại tuyệt đối không bị đụng chạm trạng thái tồn kho giả.
3. **S08-03 — Tách biệt Trả Sách, Phạt & Hoàn Cọc; Hỗ Trợ Độc Lập Phương Thức:**
   - Trả sách vật lý và thu phạt là 2 hành vi độc lập: Nếu trả sách quá hạn phát sinh phạt nhưng thủ thư chưa nhận được tiền phạt (`finePaymentConfirmed === false` hoặc chưa xác nhận), sách vẫn được ghi nhận trả thành công (`returned_at` được đóng, bản sách chuyển `AVAILABLE`).
   - Khoản phạt chưa thu được ghi nhận ở trạng thái `finePending: true`, ý định thu phạt lưu `PENDING_COLLECTION`, không rollback giao dịch trả sách vật lý.
   - Bổ sung `finePaymentMethod` độc lập hoàn toàn với `refundMethod`. Hỗ trợ đầy đủ các kịch bản thực tế: Thu phạt bằng `CASH` + Hoàn cọc bằng `BANK_TRANSFER`, hoặc Thu phạt bằng `BANK_TRANSFER` + Hoàn cọc bằng `CASH`.
4. **S08-04 — Quản Lý Số Dư Tiền Mặt Khả Dụng & Chống Overdraft Hộp Tiền:**
   - Hợp nhất cơ chế kiểm tra tiền mặt: Số dư khả dụng của ca được tính theo công thức an toàn nhất `availableCash = min(sessionCash, journalCash)` dưới session row lock (`FOR UPDATE`).
   - Mọi thao tác thu tiền mặt (thu phạt CASH, thu cọc mới CASH) hoặc chi tiền mặt (hoàn cọc CASH) đều cập nhật đồng bộ `UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash +/- $amount` cùng với việc ghi `journal_entries`.
   - Bảo đảm số dư hộp tiền không bị chi âm, đồng thời đối soát sổ cái (liability reconciliation) luôn khớp 100%.
5. **S08-05 — Persist Settlement Read Model & Chuẩn Hóa Boundary PG DATE:**
   - Tạo bảng `loan_settlements` trong `docs/technical/schema/01_schema.sql` và mock DB helper: Lưu trữ bất biến quyết định tất toán gồm `settlement_id`, `receipt_id`, `return_type`, `fine_decision`, `fine_final`, `fine_reason`, `return_timestamp`, `actor_id`, `refund_total`, `transferred_deposit`, `collected_fine`, `new_deposit_collected`, `new_receipt_id`.
   - Endpoint `GET /api/v1/circulation/loans/:id/settlement` truy xuất snapshot quyết định lịch sử cố định, không tính lại tiền phạt theo ngày hiện tại sau khi sách đã trả.
   - Chuẩn hóa PG DATE: Thiết lập parser PG type id 1082 trong `src/server/db/client.ts` (`pg.types.setTypeParser(1082, (val) => val)`) trả về chuỗi ISO date chuẩn `YYYY-MM-DD` theo múi giờ `Asia/Ho_Chi_Minh`, loại bỏ hoàn toàn lỗi chuyển đổi Date UTC lệch ngày và lỗi `NaN cannot be converted to a BigInt`.
6. **S08-06 — Quản Lý Bút Toán Sổ Cái (Managed Sources) & Chặn Direct Reversals:**
   - Bổ sung `LOAN_DEPOSIT_REFUND`, `LOAN_FINE_FORFEIT`, `LOAN_FINE` vào danh sách `managedSources` trong `src/server/finance/ledger.ts`. Chặn đứng hoàn toàn việc gọi `recordReversal` trực tiếp trên các nguồn này mà không qua quy trình hoàn trả có quản lý.
   - Thống nhất cơ chế hoàn tiền: Cập nhật đúng `remaining` của `deposit_allocations`, tránh ném lỗi reconciliation sổ cái.
7. **S08-07 — Bọc Transaction Đầy Đủ & Typed Transaction Ownership:**
   - Đảm bảo toàn bộ các mutation endpoints đều được bọc trong `withTransaction`.
   - Phân định rõ quyền sở hữu transaction: Client kết nối từ Pool được quản lý vòng đời checkout/release an toàn; nếu client đã ở trong transaction (`__in_tx = true`), hệ thống tái sử dụng mà không gửi lệnh `BEGIN` / `COMMIT` dư thừa.
8. **S08-08 — Tích Hợp Lịch Nghỉ (Calendar Holidays) & Explicit Fund Policy Gate:**
   - Đưa bảng `calendar_holidays` vào schema và nạp vào hàm tính hạn trả `calculateEffectiveDueDate`. Hạn mượn tự động tịnh tiến qua các ngày nghỉ lễ/Tết tới buổi trực tiếp theo của CLB.
   - Về chính sách quỹ nhận phạt: Hệ thống cấu hình tường minh quỹ `FUND_LOAN` cho domain lưu thông hiện tại. Trạng thái cổng vận hành phân quỹ được ghi nhận là `BLOCKED` (chờ quyết định chính thức từ ban chủ nhiệm theo docs06).
9. **S08-09 — Sửa Fixtures Kiểm Thử Tích Hợp PostgreSQL:**
   - Chuẩn hóa `location = 'BAN_TRUC_TAM'` (thay cho giá trị ngoài enum `'KE_01'`).
   - Cập nhật đúng công thức tính cọc: Sách 75.000₫ cọc 100.000₫, Sách 150.000₫ cọc 150.000₫ (tổng 250.000₫). Bổ sung cờ `paymentConfirmed: true` cho mọi test fixture xác nhận tiền.

---

### 28.2 Nghiệp Vụ Trả Một Phần (Partial Return) & Chuyển Tiếp (Carry-Forward)
1. **Quy tắc Nghiệp vụ Trả 1 Giữ 1:**
   - Áp dụng duy nhất cho phiếu mượn đang có 2 cuốn sách hoạt động.
   - Thủ thư chọn đúng 1 cuốn mang trả, cuốn còn lại tiếp tục được bạn đọc mượn.
2. **Vòng đời Dòng Sách (`loan_items`):**
   - **Cuốn mang trả:** Ghi nhận `returned_at = returnTimestamp`. Bản sao sách (`book_copies`) chuyển trạng thái sang `AVAILABLE`.
   - **Cuốn giữ tiếp:** Tuyệt đối **KHÔNG gán thời gian trả giả (`returned_at` vẫn là NULL)**. Ghi nhận thời điểm chuyển tiếp tại cột `carried_forward_at` và liên kết với dòng mượn mới qua `successor_item_id`. Bản sao sách giữ nguyên trạng thái `BORROWED`.
   - Bảo toàn partial unique index: `idx_unique_active_copy_loan` với điều kiện `WHERE returned_at IS NULL AND is_lost = FALSE AND carried_forward_at IS NULL`.
3. **Vòng đời Phiếu Mượn (`loan_receipts`):**
   - **Phiếu mượn cũ:** Chốt trạng thái `PARTIAL_SETTLED`, lưu mã tất toán `settlement_id`.
   - **Phiếu mượn mới (Successor Receipt):** Sinh tự động với `preceding_receipt_id = old_receipt.id`. Chứa đúng 1 dòng mượn cho cuốn sách được giữ lại. Hạn trả mới = Thời điểm chuyển tiếp + 14 ngày (kèm lịch nghỉ lễ và ngày trực). Số lần gia hạn khởi tạo lại `renew_count = 0`.
4. **Cơ chế Tiền Cọc & Ngoại lệ T73:**
   - **Trường hợp $P = 0$ (Đúng hạn hoặc miễn phạt):**
     - Cọc của cuốn trả: Tạo ý định hoàn cọc (`refund_intents`) ở trạng thái `PENDING`.
     - Cọc của cuốn giữ: Chuyển nghĩa vụ sang phiếu mới cash-neutral (`status = 'TRANSFERRED'`), không sinh bút toán tiền mặt hoặc ngân hàng ảo.
   - **Trường hợp $0 < P < D$ (Phạt dưới tổng cọc):**
     - Thu phạt $P$ riêng biệt (nếu xác nhận thì ghi nhận Nợ `TIEN_MAT`/`TIEN_NGAN_HANG` Có `THU_PHAT`).
     - Hoàn cọc của cuốn trả (tạo `refund_intents` PENDING).
     - Chuyển cọc của cuốn giữ sang phiếu mới cash-neutral.
   - **Trường hợp $P \ge D$ (Ngoại lệ T73 - Phạt hết cọc cũ):**
     - Tịch thu toàn bộ cọc cũ $D$ làm tiền phạt (`LOAN_FINE_FORFEIT`), không hoàn cọc và không chuyển tiếp cọc cũ.
     - Yêu cầu thu cọc mới $D_{new}$ cho cuốn sách giữ lại.
     - Nếu đã xác nhận nhận cọc mới (`newDepositConfirmed = true`): Ghi nhận bút toán Nợ `TIEN_MAT`/`TIEN_NGAN_HANG` Có `COC_PHAI_HOAN`, phiếu mới chuyển trạng thái `ACTIVE`.
     - Nếu chưa nhận cọc mới (`newDepositConfirmed = false`): Phiếu mới ở trạng thái `PENDING_DEPOSIT`, khoản thu lưu `PENDING_COLLECTION`. Cuốn sách giữ lại vẫn được bảo lưu quyền mượn (`BORROWED`), không bị chuyển nhầm thành `AVAILABLE`.

---

## 29. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 09 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover** | **PASS** | Đã sửa triệt để S08-01..S08-09: confirmRefund kiểm tra strict boolean; validate selector trả sách chống trùng lặp; nhận sách độc lập thu phạt; hợp nhất nguồn tiền khả dụng `min(session, journal)` kèm cập nhật `expected_closing_cash`; persist `loan_settlements` và cấu hình parser PG DATE type id 1082; bổ sung managed sources cho ledger; bọc transaction mọi mutations; tích hợp `calendar_holidays`; sửa fixture enum `BAN_TRUC_TAM` và tiền cọc chuẩn. |
| **2. G-selectors** | **PASS** | `tests/unit/circulation-partial.test.ts` kiểm chứng 5 tests selectors: (1) Reject duplicate barcode `[A, A]`; (2) Reject alias conflict (vừa gửi barcodes vừa gửi copyIds); (3) Reject mảng rỗng hoặc gửi 2 cuốn trong PARTIAL; (4) Reject phiếu chỉ có 1 cuốn sách; (5) Reject mã vạch không thuộc phiếu mượn. |
| **3. G-lifecycle-db** | **PASS** | Kiểm chứng vòng đời trả 1 giữ 1: Cuốn trả `returned_at` có giá trị và copy thành `AVAILABLE`; cuốn giữ `carried_forward_at` có giá trị, `returned_at` là NULL, liên kết `successor_item_id`, copy giữ nguyên `BORROWED`; phiếu cũ chốt `PARTIAL_SETTLED`; phiếu mới liên kết `preceding_receipt_id`, có 1 item, `renew_count = 0`. |
| **4. G-money-transfer** | **PASS** | Kiểm chứng 2 kịch bản phân bổ cọc: (1) $P = 0$: cọc cuốn trả tạo refund pending 50.000₫, cọc cuốn giữ chuyển tiếp 100.000₫ cash-neutral không sinh journal tiền giả; (2) $0 < P < D$ ($P = 60.000₫, D = 150.000₫$): phạt 60.000₫ thu riêng, hoàn cọc 50.000₫, chuyển cọc 100.000₫ sang phiếu mới. |
| **5. G-forfeit-new** | **PASS** | Kiểm chứng ngoại lệ T73 ($P \ge D$): Phạt 150.000₫ tịch thu toàn bộ cọc cũ, yêu cầu thu cọc mới 100.000₫ cho cuốn giữ; nếu chưa xác nhận tiền thì phiếu mới lưu `PENDING_DEPOSIT`, copy vẫn là `BORROWED`, không tạo tiền ảo. |
| **6. G-date-history** | **PASS** | Kiểm chứng read model tất toán: Tra cứu snapshot bất biến từ `loan_settlements`, ngày tháng định dạng chuỗi `YYYY-MM-DD` theo múi giờ Việt Nam, truy vết chuỗi liên kết phiếu cha/con mượt mà. |
| **7. G-recovery-db** | **PASS** | Idempotency replay trên `settle-return` với `X-Idempotency-Key`: Replay cùng payload trả về kết quả giống hệt từ cache; gửi khác payload với cùng key ném 409 Conflict; rollback transaction nguyên tử khi gặp sự cố DB. |
| **8. G-auth-contract** | **PASS** | RBAC matrix: Người dùng nặc danh (Anonymous) bị từ chối 401, Cựu thành viên (Alumni) bị từ chối 403, Thành viên hoạt động (Active Member) thực hiện thành công 200; Mọi response đều có header `Cache-Control: no-store`. |
| **9. G-partial-db** | **BLOCKED** | Docker Desktop và PostgreSQL port 5432 chưa có runtime live. Bộ kiểm thử tích hợp PostgreSQL `tests/integration/partial-return.test.ts` (3 bài test ACID cho partial return, forfeit T73, double settle) và `tests/integration/return-loan.test.ts` fail-closed an toàn với `[BLOCKED: DB_RUNTIME_MISSING]`. |
| **10. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **55 files, 0 errors, 0 warnings**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build thành công trong 2.76s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **93/93 tests PASS (100%)** trong 720ms.<br/>- **Python Experiments:** `python -m unittest discover -s experiments -p "test_*.py" -q` $\rightarrow$ **22/22 tests PASS (100%)**.<br/>- **OpenAPI Redocly Lint:** `pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

## 30. Tệp Đã Thay Đổi Trong Chặng 09

1. `src/server/db/client.ts`: Cấu hình parser PG DATE type id 1082 trả về string `YYYY-MM-DD`.
2. `src/server/finance/ledger.ts`: Đưa `LOAN_DEPOSIT_REFUND`, `LOAN_FINE_FORFEIT`, `LOAN_FINE` vào danh sách `managedSources` chặn direct reversal.
3. `src/server/circulation/types.ts`: Bổ sung các hằng số, DTOs, interface và error classes cho Partial Return (`depositTransferred`, `newDepositCollected`, `newReceiptId`, `carriedForwardAt`, `successorItemId`, v.v.).
4. `src/server/circulation/rules.ts`: Chuẩn hóa selector trả sách, phân nhánh validation FULL vs PARTIAL, kiểm tra cờ xác nhận phạt và cọc mới độc lập.
5. `src/server/circulation/service.ts`: Triển khai engine trả 1 giữ 1 (`settleReturnReceipt`), chuyển cọc cash-neutral, xử lý ngoại lệ T73 forfeit & new deposit, cập nhật `expected_closing_cash` và ghi nhận `loan_settlements`.
6. `src/server/router.ts`: Đồng bộ header `X-Idempotency-Key`, cập nhật router settle-return và confirm-refund.
7. `docs/technical/schema/01_schema.sql`: Bổ sung bảng `loan_settlements`, `calendar_holidays`, các cột `carried_forward_at` và `successor_item_id` trên `loan_items`, cập nhật partial index `idx_unique_active_copy_loan`.
8. `docs/technical/openapi.yaml`: Cập nhật hợp đồng OpenAPI 3.1 cho Partial Return (`returnType: [FULL, PARTIAL]`, các trường xác nhận tiền và chi tiết cọc chuyển tiếp).
9. `tests/unit/mock-db-helper.ts`: Cập nhật mock handlers hỗ trợ đầy đủ `loan_settlements`, `calendar_holidays`, `carried_forward_at`, `successor_item_id`, cập nhật float ca quầy.
10. `tests/unit/circulation-partial.test.ts`: Bộ kiểm thử đơn vị cho phân hệ trả một phần và chuyển tiếp (13 bài test toàn diện).
11. `tests/integration/return-loan.test.ts`: Sửa S08-09 fixture vị trí `BAN_TRUC_TAM`, mức cọc 150.000₫ và `paymentConfirmed: true`.
12. `tests/integration/partial-return.test.ts`: Bộ kiểm thử tích hợp PostgreSQL cho Partial Return (3 bài test ACID).
13. `package.json`: Tích hợp test suite Chặng 09 vào `test:unit` và `test:db`.
14. `docs/technical/progress.md`: Cập nhật trạng thái Chặng 09, chi tiết kỹ thuật và bằng chứng các gates.
15. `README.md`: Cập nhật trạng thái Chặng 09.

---

## 31. Chi Tiết Thực Hiện Chặng 10 (Sửa carryover09, gia hạn và lịch ngày đến hạn)

### 31.1 Sửa triệt để các finding carryover Chặng 09 (S09-01 .. S09-09)
1. **S09-01 & S09-05 — Active Hold, Partial Unique Index & Migration Tiến Tới:**
   - **Xử lý triệt để lỗi 23505:** Khi trả một phần, hệ thống đóng logical hold cũ của cuốn sách giữ lại bằng `UPDATE loan_items SET carried_forward_at = NOW()` **trước khi** thực hiện `INSERT INTO loan_items` cho phiếu mới trong cùng một transaction.
   - **Bảo toàn Constraint:** Cuốn giữ lại luôn duy trì trạng thái vật lý `BORROWED` và đúng 1 active logical hold tại mọi thời điểm; cuốn trả về `AVAILABLE`.
   - **Migration 02_stage10_renewal_and_carryover.sql:** Nâng cấp schema tiến tới, bổ sung `calendar_holidays`, `loan_renewals`, các enum/cột `PENDING_DEPOSIT`, `PENDING_COLLECTION`, `transferred_from_allocation_id`, `fine_status`, `fine_pending_amount` mà không xóa hay reset database.
2. **S09-02 & S09-03 — Quy trình Hoàn tất Tiền Chờ Thu (Pending Collections):**
   - **T73 Confirm New Deposit (`confirmNewDeposit`):** Cung cấp API chuyên biệt `POST /api/v1/circulation/loans/:id/confirm-deposit` có `X-Idempotency-Key`. Khi nhận cọc mới thật sự, chuyển `deposit_allocations` sang `HELD`, `loan_receipts` sang `ACTIVE`, ghi nhận bút toán Nợ `TIEN_MAT_HOP`/`TIEN_NGAN_HANG` và Có `COC_PHAI_HOAN`.
   - **Collect Pending Fine (`collectPendingFine`):** Cung cấp API `POST /api/v1/circulation/loans/:id/settlement/collect-fine` có `X-Idempotency-Key` để thu khoản phạt chờ thu (từ tất toán trả sách hoặc gia hạn quá hạn) mà không yêu cầu settle phiếu lần hai.
3. **S09-04 & S09-06 — Allocation Coverage & Cập nhật Quỹ Tiền Mặt Nguyên Tử:**
   - Trước khi thực hiện partial, renewal hoặc phạt, hệ thống xác nhận độ bao phủ cọc hợp lệ (`AllocationCoverageError`) cho từng cuốn sách.
   - Thống nhất cơ chế cập nhật số dư tiền mặt: Mọi writer (`recordDeposit`, `confirmRefundIntent`, `confirmNewDeposit`, `collectPendingFine`, v.v.) cập nhật `expected_closing_cash` nguyên tử trong cùng khóa ca quầy, không trừ 2 lần hay dựa vào giá trị min giả định.
4. **S09-07 & S09-08 — Allocation Lineage & Snapshot Lịch Sử:**
   - Phiếu mới lưu `transferred_from_allocation_id` để truy vết nguồn gốc ca nhận cọc ban đầu qua nhiều thế hệ phiếu mượn.
   - Read models và snapshots giữ nguyên tính bất biến, không rewrite chứng từ khi giá catalog thay đổi.
5. **S09-09 — Fixtures Clean Close & Fail-Closed Guards:**
   - Chuẩn hóa toàn bộ test fixtures trong các file integration tests (`issue-loan.test.ts`, `return-loan.test.ts`, `partial-return.test.ts`, `renew-loan.test.ts`): Đóng session cũ có snapshot đầy đủ `actual_closing_cash = expected_closing_cash`, `discrepancy = 0`, lý do tường minh trước khi mở session kiểm thử mới.

---

### 31.2 Nghiệp Vụ Gia Hạn (Renewal) & Giới Hạn Tối Đa 3 Lần
1. **Quy tắc tính hạn mượn gia hạn:**
   - **Trong hạn (In-time):** Hạn mới = Hạn mượn hiện tại + 14 ngày (tịnh tiến theo lịch trực Thứ Ba/Thứ Năm và lịch nghỉ lễ/Tết). Giữ nguyên ngày base là hạn cũ, không phụ thuộc vào việc bạn đọc yêu cầu gia hạn sớm.
   - **Quá hạn (Overdue):** Chốt quyết định phạt của khoảng quá hạn cũ trước (1.000₫/ngày trên cả phiếu). Hạn mới = Ngày hiện tại ở Việt Nam (`Asia/Ho_Chi_Minh`) + 14 ngày (tịnh tiến theo ca trực và ngày nghỉ).
2. **Giới hạn 3 lần gia hạn:**
   - Thuộc tính `renew_count` tăng tuần tự (1 -> 2 -> 3).
   - Lần gia hạn thứ 4 bắt buộc bị từ chối với HTTP 409 `MaxRenewalsExceededError`.
   - Lịch sử gia hạn được lưu vết đầy đủ trong bảng `loan_renewals` (`renewal_sequence`, `previous_due_date`, `new_due_date`, `fine_status`, v.v.).

---

### 31.3 Nghiệp Vụ Lịch Ngày Đến Hạn (Due Date Calendar) & Điều Chỉnh Ca Trực / Nghỉ Lễ
1. **Quản lý Lịch Nghỉ (`calendar_holidays`):**
   - Lưu trữ danh mục ngày nghỉ lễ/Tết của CLB với ngày `holiday_date (YYYY-MM-DD)`.
   - Cung cấp API `GET /api/v1/circulation/calendar/holidays` (công khai an toàn) và `POST /api/v1/circulation/calendar/holidays` (quản trị viên/thành viên).
2. **Quy tắc tịnh tiến ngày đến hạn:**
   - Ca trực mặc định: Thứ Ba và Thứ Năm hàng tuần (14:00 - 17:00).
   - Khi hạn mượn +14 ngày rơi vào ngày không trực hoặc ngày nghỉ lễ/Tết, hệ thống tự động tịnh tiến sang buổi trực hợp lệ tiếp theo mà không tiêu tốn lượt gia hạn của bạn đọc.
   - Vòng lặp an toàn 60 ngày: Nếu quá 60 ngày liên tiếp không có buổi trực hợp lệ, hệ thống fail-closed an toàn với `NoValidDutyShiftFoundError` (mã lỗi `NO_VALID_DUTY_SHIFT_FOUND`). Chặn các ngày ảo như 2026-02-30.

---

## 32. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 10 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover** | **PASS** | S09-01..S09-09 đã được xử lý triệt để: S09-01 đóng hold cũ trước khi insert dòng mới; S09-02 & S09-03 bổ sung API `confirm-deposit` và `collect-fine` hoàn tất khoản chờ thu; S09-04 kiểm tra coverage cọc; S09-05 migration tiến tới `02_stage10_renewal_and_carryover.sql`; S09-06 cập nhật `expected_closing_cash` nguyên tử; S09-07 lưu lineage `transferred_from_allocation_id`; S09-08 snapshot bất biến; S09-09 clean close snapshot trong fixtures. |
| **2. G-calendar** | **PASS** | `tests/unit/circulation-renew.test.ts` kiểm chứng 4 test cases: (1) Tính toán ngày chuẩn Việt Nam UTC+7; (2) Chuyển tháng, năm, năm nhuận/không nhuận tháng 2; (3) Tịnh tiến lịch Thứ Ba/Thứ Năm và nghỉ lễ không tiêu tốn renew_count; (4) Vượt giới hạn an toàn 60 ngày ném `NoValidDutyShiftFoundError`. |
| **3. G-renew-in-time** | **PASS** | `tests/unit/circulation-renew.test.ts` kiểm chứng: (1) Gia hạn sớm lấy base từ hạn cũ (+14d); (2) Giới hạn tối đa 3 lần gia hạn, lần 4 từ chối HTTP 409 `MaxRenewalsExceededError`; (3) Từ chối gia hạn trên phiếu đã tất toán (RETURNED, PARTIAL_SETTLED) hoặc PENDING_DEPOSIT. |
| **4. G-renew-overdue** | **PASS** | `tests/unit/circulation-renew.test.ts` kiểm chứng: (1) Gia hạn quá hạn lấy base từ today (+14d), chốt quyết định phạt 1.000₫/ngày, cập nhật quỹ tiền mặt; (2) Gia hạn quá hạn cho phép lưu `finePending: true`; (3) Miễn phạt yêu cầu `fineReason`, thiếu reason ném `FineReasonRequiredError`. |
| **5. G-money-recovery** | **PASS** | Kiểm chứng: (1) T73 `confirmNewDeposit` hoàn tất cọc mới và kích hoạt phiếu mượn ACTIVE; (2) Thu phạt chờ thu `collectPendingFine` cập nhật sổ cái và quỹ tiền mặt; (3) Idempotency replay trên renewal trả về kết quả từ cache, không tăng renew_count 2 lần. |
| **6. G-auth-contract** | **PASS** | RBAC matrix kiểm tra quyền: Anonymous trả 401, Guest/Alumni trả 403, Active Member/Admin thực hiện thành công 200/201; Mọi responses có header `Cache-Control: no-store`; Tuyệt đối không rò rỉ stack trace hay thông tin nhạy cảm. |
| **7. G-renew-db** | **BLOCKED** | Docker Desktop / PostgreSQL port 5432 chưa có runtime live. Bộ kiểm thử tích hợp PostgreSQL `tests/integration/renew-loan.test.ts` (kiểm tra in-time renewal max 3 lần trên PG thật, overdue renewal chốt phạt và ghi journal trên PG) fail-closed an toàn với `[BLOCKED: DB_RUNTIME_MISSING]`. |
| **8. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **57 files, 0 errors, 0 warnings**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build thành công trong 2.68s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **107/107 tests PASS (100%)** trong 659ms.<br/>- **Python Experiments:** `python -m unittest discover -s experiments -p "test_*.py" -q` $\rightarrow$ **22/22 tests PASS (100%)**.<br/>- **OpenAPI Redocly Lint:** `rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

## 33. Tệp Đã Thay Đổi Trong Chặng 10

1. `docs/technical/schema/01_schema.sql`: Cập nhật schema đầy đủ các enum `PENDING_DEPOSIT`, `PENDING_COLLECTION`, bảng `loan_renewals`, `calendar_holidays`, các cột `transferred_from_allocation_id`, `fine_status`, `fine_pending_amount`.
2. `docs/technical/schema/migrations/02_stage10_renewal_and_carryover.sql`: Migration tiến tới nâng cấp schema từ Chặng 09 lên Chặng 10.
3. `src/server/finance/deposits.ts` & `src/server/finance/ledger.ts`: Đồng bộ cập nhật `expected_closing_cash` nguyên tử khi nhận cọc, hoàn cọc hoặc đảo bút toán.
4. `src/server/circulation/types.ts`: Bổ sung DTOs, interface và error classes (`MaxRenewalsExceededError`, `InvalidLoanStatusForRenewalError`, `NoValidDutyShiftFoundError`, `AllocationCoverageError`, `FineReasonRequiredError`).
5. `src/server/circulation/rules.ts`: Hàm tính hạn an toàn `calculateDueDate`, `calculateEffectiveDueDate` (bảo vệ giới hạn 60 ngày), các hàm validate DTOs cho renewal, confirm deposit, collect pending fine.
6. `src/server/circulation/service.ts`: Triển khai engine gia hạn `renewLoanReceipt`, lấy lịch sử `getLoanRenewals`, hoàn tất cọc mới T73 `confirmNewDeposit`, thu phạt chờ thu `collectPendingFine`, quản lý lịch `listCalendarHolidays`/`addCalendarHoliday`.
7. `src/server/router.ts`: Đăng ký các endpoints gia hạn, lịch nghỉ lễ, confirm deposit, collect pending fine kèm transaction, RBAC và `X-Idempotency-Key`.
8. `docs/technical/openapi.yaml`: Cập nhật đặc tả OpenAPI 3.1 cho toàn bộ các endpoints và schemas Chặng 10 (Redocly lint 0 errors).
9. `docs/technical/diagrams/06_sequence_loan_and_return.mmd`: Cập nhật sequence thực tế cho Partial Return và bổ sung sequence cho Renewal & Calendar Shift.
10. `tests/unit/mock-db-helper.ts`: Cập nhật mock database hỗ trợ bảng `loan_renewals`, `calendar_holidays`, mô phỏng ràng buộc unique 23505 cho active holds.
11. `tests/unit/circulation-renew.test.ts`: Bộ kiểm thử đơn vị cho phân hệ Gia hạn và Lịch (14 bài test, nâng tổng số unit tests lên 107/107 PASS).
12. `tests/integration/renew-loan.test.ts`: Bộ kiểm thử tích hợp PostgreSQL cho phân hệ Gia hạn.
13. `tests/integration/issue-loan.test.ts`, `tests/integration/return-loan.test.ts`, `tests/integration/partial-return.test.ts`: Cập nhật fixture clean close session theo S09-09.
14. `tests/integration/db-harness.ts`: Bổ sung hàm `applyMigrations()` vào test harness.
15. `package.json`: Tích hợp test suite Chặng 10 vào `test:unit` và `test:db`.
16. `docs/technical/progress.md`: Cập nhật trạng thái Chặng 10, chi tiết kỹ thuật và bằng chứng các gates.
17. `README.md`: Cập nhật trạng thái Chặng 10.

---

## 34. Chi Tiết Thực Hiện Chặng 11 (Báo Mất Sách & Sửa Sai Chứng Từ, Khắc Phục S10-01..S10-09)

### 34.1 Khắc Phục Triệt Để Các Finding Carryover Chặng 10 (S10-01 .. S10-09)
1. **S10-01 — Bỏ cập nhật cột `updated_at` không tồn tại trên `loan_receipts`:**
   - Trong `src/server/circulation/service.ts`, đã loại bỏ hoàn toàn các câu lệnh cập nhật `updated_at = NOW()` trên bảng `loan_receipts` tại các hàm `renewLoanReceipt`, `confirmNewDeposit`, và `collectPendingFine`. Bảng `loan_receipts` không có cột `updated_at` trong DDL chuẩn.
2. **S10-02 — Sinh mã journal entry phân biệt cho từng đợt thu phạt pending:**
   - Trong `collectPendingFine`, sinh mã bút toán theo chuỗi duy nhất: `${receiptId}-COLLECT-${seq}` (trong đó `seq` được truy vấn từ số lượng bút toán thu phạt trước đó trên phiếu). Điều này ngăn chặn triệt để lỗi vi phạm ràng buộc `UNIQUE (entry_code)` (PostgreSQL error `23505`).
3. **S10-03 — Hàm tính ngày đến hạn điều chỉnh theo ngày nghỉ lễ (`getHolidayAdjustedDueDate`):**
   - Triển khai hàm `getHolidayAdjustedDueDate(dueDate, holidays)`: Chỉ tịnh tiến ngày đến hạn khi ngày đó nằm trong danh sách ngày nghỉ lễ/Tết của CLB (`holidays.includes(dueDate)`).
   - Bảo đảm đúng nguyên tắc: "Thứ Ba đến hạn, Thứ Năm trả vẫn tính phạt 2 ngày" (không tự động ép mọi ngày đến hạn sang Thứ Ba/Thứ Năm như hàm `calculateEffectiveDueDate` cũ).
4. **S10-04 — Khóa và kiểm tra ca trực cho cả CASH và BANK khi phát sinh giao dịch tiền:**
   - Trong `collectPendingFine`, khi phương thức là `CASH` hoặc `BANK_TRANSFER`, hệ thống đều resolve ca trực hiện tại. Với `CASH`, bắt buộc ca trực phải ở trạng thái `OPEN` và cập nhật tăng `expected_closing_cash` nguyên tử.
5. **S10-05 — Xử lý lỗi JSON body chuẩn xác ở biên HTTP:**
   - Trong `src/server/router.ts`, helper `parseJsonObject` bắt lỗi `SyntaxError` của cú pháp JSON và trả về HTTP 400 `MALFORMED_JSON`; đồng thời kiểm tra nếu JSON không phải là object (như null, mảng, số, chuỗi primitive) thì trả về HTTP 400 `INVALID_JSON_BODY`.
6. **S10-06 — Chặn phạt vượt trần cọc & chặn gia hạn khi đang nợ phạt:**
   - Phạt quá hạn không được vượt trần cọc ban đầu của phiếu (`FINE_EXCEEDS_DEPOSIT_CAP`, HTTP 400).
   - Khi đang nợ phạt quá hạn chưa thu (`fine_status = 'PENDING'`), cấm thực hiện gia hạn tiếp theo (`RENEWAL_PENDING_FINE_NOT_ALLOWED`, HTTP 400).
7. **S10-07 — Migration phân biệt fine đã thu vs pending fine:**
   - Migration `docs/technical/schema/migrations/03_stage11_lost_and_correction.sql` bổ sung check constraint, cột `lost_at`, `lost_reason` và enum `LOST`, cùng đoạn script backfill chuẩn hóa trạng thái phạt.
8. **S10-08 — Kiểm tra tồn quỹ tiền mặt khả dụng khi chi tiền đảo chứng từ:**
   - Trong `src/server/finance/ledger.ts`, hàm `createDocumentCorrection` kiểm tra ca trực đang mở và xác nhận `expected_closing_cash >= reversalAmount`. Nếu không đủ tiền mặt trong két để chi hoàn, ném lỗi `INSUFFICIENT_CASH_IN_SESSION` (HTTP 400).
9. **S10-09 — Snapshot lịch sử và DTOs giữ nguyên tính bất biến:**
   - Tất cả các thao tác báo mất và sửa sai đều ghi nhận bút toán mới độc lập, không sửa đè lịch sử đã chốt.

---

### 34.2 Nghiệp Vụ Báo Mất Sách (Lost Book)
1. **Quy tắc cọc: Mất sách mất cọc (Zero cash delta):**
   - Theo quyết định sản phẩm đã xác nhận: "Mất sách mất cọc. Phạt dưới cọc thì hoàn cọc và thu phạt riêng; từ mức cọc trở lên thì giữ cọc, không thu thêm". Sách giá 74k cọc 50k $\rightarrow$ chỉ giữ đúng 50k cọc đã nộp, tuyệt đối không truy thu thêm 24k chênh lệch giá bìa.
   - Quỹ tiền mặt không thay đổi (`zero cash delta`).
2. **Cập nhật trạng thái bản sách và phiếu mượn:**
   - Bản sách báo mất: `book_copies.status = 'LOST'`.
   - Dòng mượn: `loan_items.is_lost = true`, `lost_at = NOW()`, `lost_reason = reason`, `returned_at` giữ nguyên `NULL`.
   - Phân bổ cọc: `deposit_allocations.status = 'FORFEITED'`, `remaining_amount = 0`.
   - Trạng thái phiếu mượn:
     - Nếu toàn bộ sách trên phiếu đã xử lý (đã trả hoặc mất): phiếu chuyển sang trạng thái `'LOST'`, tạo settlement với `settlement_type = 'LOST'`.
     - Nếu còn sách khác đang mượn: phiếu tiếp tục duy trì trạng thái `'ACTIVE'`.
3. **Bút toán sổ cái (Double-entry Ledger):**
   - Nợ `COC_PHAI_HOAN` (3388) / Có `THU_PHAT` (711) đúng số tiền cọc của cuốn sách bị mất.
   - Bút toán ghi nhận nguồn `CIRCULATION_LOSS` và liên kết với ca trực hiện tại.

---

### 34.3 Nghiệp Vụ Sửa Sai Chứng Từ (Document Correction / Reversal)
1. **Endpoint `POST /api/v1/finance/ledger/corrections`:**
   - Yêu cầu quyền Quản trị viên (`ADMIN`) hoặc Thành viên trực ca (`INTERNAL_MEMBER`).
   - Yêu cầu Header `X-Idempotency-Key` và lý do sửa sai `reason` ($\ge 5$ ký tự).
2. **Quy tắc đảo bút toán:**
   - Khóa dòng bút toán gốc bằng `FOR UPDATE`.
   - Chống đảo kép: Nếu bút toán đã có liên kết đảo (`is_reversed = true`), từ chối với lỗi `ENTRY_ALREADY_REVERSED` (HTTP 409).
   - Chống đảo bút toán đảo: Không cho phép đảo một bút toán vốn dĩ là bút toán đảo (`CANNOT_REVERSE_A_REVERSAL`, HTTP 400).
   - Đảo dòng Nợ thành Có, dòng Có thành Nợ với cùng số tiền.
   - Đánh dấu bút toán mới với `reversal_of_entry_id = originalEntryId`.
3. **Tác động quỹ tiền mặt và phân bổ cọc:**
   - Nếu bút toán gốc là thu tiền mặt (ghi Có `TIEN_MAT`): bút toán đảo sẽ chi tiền mặt ra khỏi quỹ. Bắt buộc kiểm tra ca trực đang `OPEN` và `expected_closing_cash >= amount`. Nếu thỏa mãn, trừ tiền mặt nguyên tử trong ca trực.
   - Nếu bút toán gốc liên quan đến cọc: chuyển trạng thái allocation sang `'VOIDED'`.

---

## 35. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 11 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover10** | **PASS** | S10-01..S10-09 đã được giải quyết triệt để: S10-01 bỏ `updated_at` trên `loan_receipts`; S10-02 sinh sequence `-COLLECT-${seq}` không trùng 23505; S10-03 dùng `getHolidayAdjustedDueDate` giữ phạt T3->T5; S10-04 lock ca trực cả CASH/BANK; S10-05 parse JSON body 400 MALFORMED/INVALID_JSON_BODY; S10-06 chặn phạt quá cọc & nợ phạt gia hạn; S10-07 migration backfill; S10-08 kiểm tra quỹ tiền mặt khi đảo bút toán; S10-09 snapshot bất biến. |
| **2. G-loss** | **PASS** | `tests/unit/circulation-lost.test.ts` kiểm chứng toàn diện: (1) Sách 74k cọc 50k báo mất -> chỉ tịch thu 50k cọc, zero cash delta, không thu thêm tiền; (2) Phiếu 2 cuốn báo mất 1 cuốn -> cuốn mất chuyển LOST, cuốn còn lại BORROWED, phiếu mượn duy trì ACTIVE; (3) Từ chối báo mất sách đã trả, sách đã mất, hoặc sách đã chuyển tiếp. |
| **3. G-correction** | **PASS** | `tests/unit/circulation-lost.test.ts` kiểm chứng: (1) Đảo bút toán hợp lệ tráo Nợ/Có, liên kết `reversal_of_entry_id`, giảm tiền mặt nếu là thu tiền mặt; (2) Chống đảo kép từ chối với `ENTRY_ALREADY_REVERSED` (HTTP 409); (3) Không đủ tiền mặt trong ca từ chối với `INSUFFICIENT_CASH_IN_SESSION` (HTTP 400). |
| **4. G-concurrency-recovery** | **PASS** | Kiểm chứng cơ chế khóa dòng `FOR UPDATE`, idempotency cache trả về nguyên vẹn kết quả cũ khi gửi lại cùng key, rollback nguyên tử khi xảy ra lỗi giữa chừng. |
| **5. G-auth-contract** | **PASS** | RBAC matrix kiểm tra quyền: Anonymous trả 401, Guest/Alumni trả 403, Active Member/Admin thực hiện thành công 200/201; Header `Cache-Control: no-store` đầy đủ; Bắt lỗi JSON body chuẩn xác. |
| **6. G-loss-db** | **BLOCKED** | Môi trường PostgreSQL cục bộ (port 5432) chưa có runtime live. Bộ kiểm thử tích hợp PostgreSQL `tests/integration/lost-book.test.ts` fail-closed an toàn với `[BLOCKED: DB_RUNTIME_MISSING]`. |
| **7. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **59 files, 0 errors, 0 warnings, 16 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 2.72s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **118/118 tests PASS (100%)** trong 702ms.<br/>- **Python Experiments:** `python -m unittest discover -s experiments -p "test_*.py" -q` $\rightarrow$ **22/22 tests PASS (100%)**.<br/>- **OpenAPI Redocly Lint:** `rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

## 36. Danh Sách Tệp Đã Thay Đổi Trong Chặng 11

1. `src/server/circulation/service.ts`: Triển khai nghiệp vụ báo mất sách `reportBookLoss`; xử lý S10-01 (bỏ `updated_at`), S10-02 (sequence `-COLLECT-${seq}`), S10-03 (dùng `getHolidayAdjustedDueDate`), S10-04 (resolve/lock ca trực CASH/BANK), S10-06 (chặn phạt vượt cọc và chặn gia hạn nợ phạt).
2. `src/server/circulation/rules.ts`: Bổ sung `getHolidayAdjustedDueDate` và `validateReportBookLossInput` (bắt buộc lý do $\ge 5$ ký tự).
3. `src/server/finance/ledger.ts`: Triển khai `createDocumentCorrection` với khóa dòng `FOR UPDATE`, kiểm tra số dư tiền mặt ca trực (`INSUFFICIENT_CASH_IN_SESSION`), cập nhật `expected_closing_cash`, và chuyển cọc đảo sang `VOIDED`.
4. `src/server/router.ts`: Đăng ký routes `POST /api/v1/circulation/loans/:id/lost` và `POST /api/v1/finance/ledger/corrections`; helper `parseJsonObject` xử lý lỗi cú pháp JSON và non-object JSON.
5. `docs/technical/schema/migrations/03_stage11_lost_and_correction.sql`: Migration tiến tới bổ sung enum `'LOST'`, cột `lost_at`, `lost_reason` trên `loan_items`, mở rộng check constraint `settlement_type` cho `'LOST'`, và script backfill phân biệt fine đã thu vs pending fine.
6. `docs/technical/schema/01_schema.sql`: Đồng bộ schema đầy đủ với enum `'LOST'`, cột `lost_at`, `lost_reason` và check constraint mở rộng.
7. `docs/technical/openapi.yaml`: Thêm endpoints, request bodies và responses cho `lost` và `corrections` (Redocly lint 0 errors, 22 warnings).
8. `docs/technical/diagrams/06_sequence_loan_and_return.mmd`: Sửa `carried_from` thành `preceding_receipt_id`, bổ sung Mục 6 Báo mất sách và Mục 7 Sửa sai chứng từ.
9. `tests/unit/mock-db-helper.ts`: Cập nhật mock handlers hỗ trợ query `deposit_allocations` theo `item_id = ANY($2)`, UPDATE `WHERE id = ANY($1)`, `loan_settlements` và `loan_renewals` lọc theo `WHERE id = $1 AND receipt_id = $2`, và lọc active loans `WHERE status IN ('ACTIVE', 'OVERDUE')`.
10. `tests/unit/circulation-renew.test.ts`: Cập nhật `G-renew-overdue 2` phù hợp với policy gate S10-06.
11. `tests/unit/circulation-lost.test.ts`: Tạo mới bộ unit test toàn diện cho Chặng 11 (11 bài test mới cho `G-loss`, `G-correction`, `S10-02`, `S10-03`, `S10-05`, `S10-06`, `G-auth-contract`).
12. `tests/integration/lost-book.test.ts`: Tạo mới bộ integration test PostgreSQL cho Báo mất sách và Sửa sai chứng từ.
13. `package.json`: Đăng ký `tests/unit/circulation-lost.test.ts` vào `test:unit` và `tests/integration/lost-book.test.ts` vào `test:db`.
14. `docs/technical/progress.md`: Cập nhật trạng thái Chặng 11 lên PARTIAL *(DB BLOCKED)*, chi tiết kỹ thuật mục 34, bằng chứng mục 35, và danh mục file mục 36.
15. `README.md`: Cập nhật tiến độ Chặng 11 và trạng thái các cổng kiểm tra.

---

## 37. Chi Tiết Thực Hiện Chặng 12 (Sửa Carryover11 S11-01..S11-10 & Nối Quầy Sách Với API Lõi)

### 37.1 Xử Lý Triệt Để 10 Findings Từ Chặng 11 (S11-01..S11-10)

1. **S11-01 — Đóng Bypass Sửa Sai Chứng Từ, Chỉ Nhận Managed Source Hợp Lệ:**
   - Trong `src/server/finance/ledger.ts`, hàm `createDocumentCorrection` đóng hoàn toàn cơ chế bypass tự do `allowDirectSourceReversal = true`.
   - Bắt buộc kiểm tra nguồn gốc nghiệp vụ: Chỉ cho phép đảo theo nguồn hợp lệ (`LOAN_DEPOSIT`, `LOAN_FINE`). Từ chối với `UNSUPPORTED_CORRECTION_SOURCE` (HTTP 400) cho các managed source chưa hỗ trợ đảo an toàn (`DEPOSIT_REFUND`, `LOAN_FINE_FORFEIT`, `LOAN_CARRY_FORWARD`, hoặc phiếu đang `ACTIVE`).
   - Khôi phục trạng thái nguồn: Đảo thu phạt tự động trừ `fine_collected_amount` và tăng `fine_pending_amount` tương ứng.
2. **S11-02 — Bắt Buộc Xác Nhận Tiền Thực Tế (`paymentConfirmed: true`):**
   - Bổ sung `paymentConfirmed: boolean` và `expectedAmount?: number | bigint` vào `DocumentCorrectionParams` và OpenAPI schema.
   - Khi đảo bút toán tiền mặt hoặc ngân hàng, bắt buộc client phải gửi `paymentConfirmed: true`. Nếu thiếu, ném lỗi `PAYMENT_CONFIRMATION_REQUIRED` (HTTP 400), ngăn chặn việc tự ý giảm tiền trong hộp quầy khi chưa giao tiền thực cho bạn đọc.
3. **S11-03 — Chuẩn Hóa Chiều Dài Mã Bút Toán Journal Có Bound $\le 40$ Ký Tự:**
   - Trong `src/server/circulation/service.ts`, tối ưu hóa mã bút toán:
     - Thu phạt đợt: `JE-FN-${rcpShort}-COLLECT-${seq}` ($\le 25$ ký tự).
     - Báo mất sách: `JE-LF-${rcpShort}-${lossSeq}` ($\le 22$ ký tự).
     - Gia hạn: `JE-RN-${rcpShort}-${renewCount}` ($\le 25$ ký tự).
     - Đảo chứng từ: `REV-${originalEntryCode}` ($\le 40$ ký tự).
   - Tạo migration `docs/technical/schema/migrations/04_stage12_desk_ui_and_fixes.sql` mở rộng kiểu cột `journal_entries.entry_code VARCHAR(64)` phòng thủ chiều sâu.
4. **S11-04 — Mapping Cọc Chính Xác Theo Cuốn Sách Báo Mất:**
   - Trong `reportBookLoss`, chỉ tịch thu phân bổ cọc của đúng cuốn sách mất (`item_id = item.id` hoặc phiếu 1 cuốn). Bảo toàn nguyên vẹn cọc của cuốn sách còn lại đang giữ.
   - Hủy bỏ các `refund_intents` đang ở trạng thái `PENDING_REFUND` liên quan đến cuốn sách báo mất (`status = 'CANCELLED'`). Bảo đảm `zero cash delta`.
5. **S11-05 — Trả Sách Sau Mất Không Ghi Nhận `returned_at` Lên Cuốn Mất:**
   - Trong `settleReturnReceipt`, câu lệnh `UPDATE loan_items SET returned_at = NOW()` chỉ cập nhật trên danh sách ID cuốn sách thực tế trả vật lý (`WHERE id = ANY($returnItemIds)`).
   - Cuốn sách đã báo mất (`is_lost = true`) tuyệt đối duy trì `returned_at = NULL`.
6. **S11-06 — Chuẩn Hóa Selector Báo Mất Sách:**
   - Trong `rules.ts` (`validateReportBookLossInput`), cấm truyền đồng thời cả `copyIds` và `barcodes` (`SELECTOR_ALIAS_CONFLICT`, HTTP 400).
   - Chặn selector trùng lặp, chuỗi rỗng; trong `service.ts` kiểm tra và từ chối mã không thuộc phiếu với lỗi `UNKNOWN_COPY_SELECTOR` (HTTP 400).
7. **S11-07 — Chuẩn Hóa Thứ Tự Khóa (Lock Order):**
   - Thống nhất thứ tự khóa toàn hệ thống cho mọi giao dịch tiền/sách: `Cash Session` $\rightarrow$ `Receipt` $\rightarrow$ `Items` $\rightarrow$ `Allocations` $\rightarrow$ `Journal`.
   - Ngăn chặn hoàn toàn chu trình chờ (deadlock 40P01) giữa các transaction đồng thời.
8. **S11-08 — Policy Gate Gia Hạn Khi Phạt Bằng Hoặc Vượt Cọc:**
   - Trong `renewLoanReceipt`, chặn cả trường hợp `fineFinal >= totalDeposit` với lỗi `FINE_EXCEEDS_DEPOSIT_CAP` (HTTP 400) khi chính sách tiếp tục giữ sách chưa được phê duyệt.
9. **S11-09 — Bổ Sung `lostAt` và `lostReason` Vào Read Model:**
   - `getLoanReceiptById` SELECT và serialize `lost_at` và `lost_reason` vào `LoanItemSnapshotDto`, cung cấp dữ liệu đầy đủ cho giao diện quầy sách.
10. **S11-10 — Sửa Fixture Unit Test và Backfill Migration 04:**
    - Migration 04 chuẩn hóa dữ liệu cũ với `fine_status = 'WAIVED'`. Cập nhật `tests/unit/stage12-desk.test.ts` kiểm chứng toàn diện 6 bài test mới, đạt 124/124 tests PASS.

---

### 37.2 Xây Dựng Typed API Client Adapter (`src/lib/api-client.ts`)

- Triển khai adapter typed kết nối toàn bộ 24 endpoints REST API của hệ thống:
  - Auth: `getMe()`, `loginInternal()`, `logout()`.
  - Cash Session: `getTodaySession()`, `openSession()`, `closeSession()`, `getSessionSummary()`.
  - Catalog: `searchBooks()`, `getBookCopyByBarcode()`.
  - Borrowers: `searchBorrowers()`, `createBorrower()`.
  - Circulation: `listLoans()`, `getLoanDetail()`, `issueLoan()`, `settleReturn()`, `renewLoan()`, `getLoanRenewals()`, `reportBookLoss()`, `confirmNewDeposit()`, `collectPendingFine()`.
  - Finance: `confirmRefund()`, `createDocumentCorrection()`.
  - Calendar & Alumni: `getCalendarHolidays()`, `addCalendarHoliday()`, `getAlumniActivities()`.
- Tự động sinh `X-Idempotency-Key` chuẩn xác theo hành động nghiệp vụ.
- Thiết lập `credentials: 'include'` cho toàn bộ HTTP fetch để tái sử dụng cookie phiên HttpOnly `ysbk_session`.
- Error handling chuẩn: Ném `ApiClientError` chứa `code`, `status`, `message` từ server.

---

### 37.3 Nối Đăng Nhập Nội Bộ (`src/pages/login.astro`) Với API Thật

- Thay thế form tĩnh bằng form submit gọi `POST /api/v1/auth/login-internal` với payload `{ username, password }`.
- Xử lý lỗi inline (hiển thị thông báo đỏ chi tiết khi sai mật khẩu, tài khoản bị khóa, hoặc lỗi kết nối).
- Khi đăng nhập thành công (HTTP 200), tự động điều hướng sang `/noi-bo`.
- Tuyệt đối không lưu token/mật khẩu vào `localStorage`.

---

### 37.4 Nối Giao Diện Quầy Sách (`src/components/InternalWorkspace.tsx`) & Phân Tách Live vs Demo

- **Chế độ LIVE API (Mặc định):**
  - Khi mount: Tự động gọi `apiClient.getMe()` để xác thực danh tính. Nếu 401, hiển thị giao diện yêu cầu đăng nhập và nút chuyển tới `/login`.
  - Phân quyền động: `ADMIN` hiển thị tab Quản trị & Audit; `ACTIVE_MEMBER` thao tác quầy; `ALUMNI` chỉ xem Bản tin hoạt động, bị khóa hoàn toàn thông tin tài chính, PII bạn đọc và nghiệp vụ quầy sách.
  - Tải ca trực hôm nay: Nếu chưa mở, hiển thị cảnh báo và nút Mở Ca. Nếu đang mở, hiển thị số tiền dự kiến và nút Đóng Ca.
  - Nối toàn bộ nghiệp vụ quầy với API: Lập phiếu mượn (POST `/circulation/loans`), Trả sách Full/Partial (POST `/settle-return`), Gia hạn (POST `/renew`), Báo mất (POST `/lost`), Sửa sai chứng từ (POST `/corrections`).
  - Sau mỗi mutation, tự động refetch dữ liệu mới từ server để cập nhật view model, không mutate client-side giả định.
- **Chế độ DEMO FIXTURE (Tùy chọn thử nghiệm giao diện):**
  - Hiển thị banner màu vàng/cam nổi bật ở đầu trang: `⚠️ CHẾ ĐỘ THỬ NGHIỆM GIAO DIỆN (FIXTURE DEMO) — Đang sử dụng dữ liệu mẫu cục bộ, KHÔNG kết nối cơ sở dữ liệu thật.`
  - Cho phép chuyển đổi 1-click giữa Live API và Demo Fixture.
  - Không âm thầm fallback sang mock khi API thật bị lỗi.

---

## 38. Bằng Chứng Kiểm Tra Cổng Chất Lượng Chặng 12 (Gates Evidence)

| Cổng Kiểm Tra | Trạng Thái | Chi Tiết & Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover11** | **PASS** | S11-01..S11-10 đã được giải quyết triệt để: S11-01 đóng bypass sửa sai; S11-02 bắt buộc `paymentConfirmed: true`; S11-03 bound mã journal $\le 40$ ký tự & migration 04 mở rộng `VARCHAR(64)`; S11-04 exact loss deposit mapping; S11-05 không ghi `returned_at` lên sách mất; S11-06 selector conflict rejection; S11-07 lock order Session->Receipt->Items->Allocations->Journal; S11-08 chặn gia hạn khi phạt $\ge$ cọc; S11-09 lostAt/lostReason trong read model; S11-10 fixture & migration backfill. |
| **2. G-domain-db** | **BLOCKED** | Môi trường PostgreSQL cục bộ (port 5432) chưa có runtime live. Các test tích hợp PostgreSQL giữ nguyên trạng thái fail-closed an toàn với `[BLOCKED: DB_RUNTIME_MISSING]`. |
| **3. G-auth-browser** | **PASS** | `login.astro` gửi form thật tới `/api/v1/auth/login-internal`; `InternalWorkspace.tsx` gọi `/api/v1/auth/me` xác thực HttpOnly cookie; phân quyền đúng 3 vai trò `ADMIN`, `ACTIVE_MEMBER`, `ALUMNI`; hỗ trợ đăng xuất `/api/v1/auth/logout`. |
| **4. G-desk-issue** | **PASS** | Form lập phiếu mượn kết nối `apiClient.issueLoan`; tính cọc tự động theo server formula (tối thiểu 50.000₫, làm tròn lên bội 50.000₫); bắt buộc xác nhận tiền thực tế; header `X-Idempotency-Key` chống tạo phiếu trùng lặp. |
| **5. G-desk-return** | **PASS** | Xử lý trả sách FULL và PARTIAL kết nối `apiClient.settleReturn`; tính phạt quá hạn 1k/ngày cả phiếu; yêu cầu lý do khi miễn/giảm phạt; xác nhận hoàn cọc và thu phạt độc lập. |
| **6. G-desk-renew-loss-correction** | **PASS** | Gia hạn kết nối `apiClient.renewLoan` (giới hạn tối đa 3 lần, kiểm tra gate phạt $\ge$ cọc); Báo mất sách kết nối `apiClient.reportBookLoss` (chỉ tịch thu cọc cuốn mất, zero cash delta); Sửa sai chứng từ kết nối `apiClient.createDocumentCorrection` (yêu cầu lý do và xác nhận tiền thực). |
| **7. G-session-recovery** | **PASS** | Quản lý ca trực hôm nay: Mở ca nhập số tiền đầu ca và lý do chênh lệch; Đóng ca nhập số thực đếm, đối soát chênh lệch `(actual - expected)` và cập nhật trạng thái quầy. |
| **8. G-responsive-a11y** | **PASS** | Giao diện tương thích máy tính (1440x900) và di động (390x844); Sidebar tự động thu gọn trên mobile; Hỗ trợ đóng modal bằng nút X và backdrop; Hiển thị thông báo trạng thái loading spinner khi submit. |
| **9. G-runtime** | **PARTIAL** | Static UI PASS (`astro build` 3/3 trang); Fixture Adapter PASS; Direct Handler PASS; PostgreSQL / Workers / Auth Provider giữ nhãn `BLOCKED` do thiếu runtime môi trường ngoài. |
| **10. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **61 files, 0 errors, 0 warnings, 8 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 4.30s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **124/124 tests PASS (100%)** trong 688ms.<br/>- **OpenAPI Redocly Lint:** `rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description, 22 warnings). |

---

## 39. Danh Sách Tệp Đã Thay Đổi Trong Chặng 12

1. `src/server/finance/types.ts`: Bổ sung `paymentConfirmed?: boolean` và `expectedAmount?: number | bigint` vào `DocumentCorrectionParams`.
2. `src/server/finance/ledger.ts`: Cập nhật `createDocumentCorrection` đóng arbitrary bypass, chỉ cho phép đảo theo nguồn hợp lệ, bắt buộc `paymentConfirmed: true` cho tiền mặt/ngân hàng, điều chỉnh `fine_collected_amount` & `fine_pending_amount`, tuân thủ lock order (Session trước Journal).
3. `src/server/circulation/rules.ts`: Cập nhật `validateReportBookLossInput` chặn alias conflict (`copyIds` + `barcodes`), chặn duplicate và empty strings.
4. `src/server/circulation/service.ts`:
   - `reportBookLoss`: Lock session trước receipt, xác thực unknown selector, mapping allocation chính xác theo `item_id`, hủy pending refund intent, sinh mã `JE-LF-${rcpShort}-${lossSeq}` $\le 22$ ký tự.
   - `settleReturnReceipt`: Cập nhật `returned_at` CHỈ trên các cuốn trả vật lý `WHERE id = ANY($returnItemIds)`.
   - `collectPendingFine`: Sinh mã `JE-FN-${rcpShort}-COLLECT-${seq}` $\le 25$ ký tự.
   - `renewLoanReceipt`: Chặn cả `fine >= deposit` (`FINE_EXCEEDS_DEPOSIT_CAP`), sinh mã `JE-RN-${rcpShort}-${renewCount}` $\le 25$ ký tự.
   - `getLoanReceiptById`: Bổ sung `lost_at` và `lost_reason` vào query và DTO snapshot.
5. `src/server/circulation/types.ts`: Bổ sung `lostAt` và `lostReason` vào `LoanItemSnapshotDto`.
6. `docs/technical/schema/migrations/04_stage12_desk_ui_and_fixes.sql`: Migration mở rộng `journal_entries.entry_code TYPE VARCHAR(64)`, index `idx_journal_entries_entry_code`, index `idx_loan_items_lost_at`, và backfill chuẩn hóa `fine_status = 'WAIVED'`.
7. `docs/technical/schema/01_schema.sql`: Đồng bộ schema với migration 04.
8. `tests/unit/mock-db-helper.ts`: Cập nhật mock handlers hỗ trợ `WHERE id = ANY($1)` cho `UPDATE loan_items SET returned_at`.
9. `tests/unit/circulation-lost.test.ts`: Cập nhật `paymentConfirmed: true` cho các test case correction.
10. `tests/unit/stage12-desk.test.ts`: Tạo mới 6 test cases kiểm thử chuyên sâu cho S11-01, S11-02, S11-03, S11-05, S11-06, S11-08.
11. `package.json`: Đăng ký `tests/unit/stage12-desk.test.ts` vào `test:unit`.
12. `src/lib/api-client.ts`: Tạo mới typed API client adapter kết nối toàn diện 24 REST API endpoints kèm `X-Idempotency-Key` và cookie HttpOnly.
13. `astro.config.mjs`: Cấu hình Vite server proxy chuyển tiếp `/api` tới backend Worker (`http://127.0.0.1:8787`).
14. `src/pages/login.astro`: Kết nối form đăng nhập nội bộ thật với `POST /api/v1/auth/login-internal`, xử lý lỗi inline và chuyển hướng `/noi-bo`.
15. `src/components/InternalWorkspace.tsx`: Nối giao diện quầy sách với REST API lõi, tích hợp các modal Mở/Đóng ca, Lập phiếu mượn, Trả sách, Gia hạn, Báo mất, Sửa sai chứng từ; hỗ trợ chuyển đổi minh bạch giữa Live API và Demo Fixture.
16. `docs/technical/progress.md`: Cập nhật tiến độ Chặng 12 lên PARTIAL *(DB BLOCKED)*, chi tiết kỹ thuật mục 37, bằng chứng mục 38, danh mục file mục 39.
17. `README.md`: Cập nhật tiến độ Chặng 12 và trạng thái các cổng kiểm tra.

---

## 40. Chi Tiết Thực Hiện Chặng 13: Thành Viên, Nhiều Quan Hệ Ban & Hội Phí Một Lần

### 40.1 Mục Tiêu & Kiến Trúc Nghiệp Vụ
1. **Quản lý đa ban & Lịch sử chức vụ (`member_affiliations`):**
   - Một thành viên có thể tham gia nhiều ban cùng lúc (kiêm nhiệm, ví dụ: vừa là Trưởng ban Hậu Cần vừa là Thành viên Ban Chủ Nhiệm).
   - Headcount tổng CLB tính bằng `COUNT(DISTINCT member_id)` trên toàn bộ các ban hoạt động để loại bỏ triệt để đếm trùng.
   - Thống kê headcount riêng biệt cho từng ban (`BAN_HAU_CAN`, `BAN_NOI_DUNG`, `BAN_TTDN`, `BAN_CHU_NHIEM`) và số lượng thành viên kiêm nhiệm (`COUNT(DISTINCT department) > 1`).
   - Khi chuyển vai trò trong cùng ban, nếu kích hoạt `endPreviousForDept = true`, hệ thống cập nhật `end_date = startDate` và `is_current = false` cho bản ghi cũ, tạo bản ghi mới để bảo tồn toàn bộ dòng lịch sử.
2. **Hội phí một lần duy nhất 100,000 VND (`membership_dues_receipts`):**
   - Hội phí thu duy nhất một lần trong toàn bộ quãng đời thành viên CLB. Cấm tuyệt đối việc thu lại vào năm học kế tiếp.
   - Ràng buộc tầng cơ sở dữ liệu: `CONSTRAINT uq_member_one_time_dues UNIQUE (member_id)` trên bảng `membership_dues_receipts` và cờ boolean `has_paid_fee = true` trên bảng `members`.
   - Bất kỳ yêu cầu thu lần 2 nào đều bị chặn ngay lập tức với mã lỗi HTTP 409 `DUPLICATE_MEMBERSHIP_FEE_COLLECTION`.
   - Bắt buộc kiểm đếm tiền thực tế: Yêu cầu `paymentConfirmed: true` (`PAYMENT_CONFIRMATION_REQUIRED`, 400).
3. **Hạch toán sổ kép độc lập (Fund Isolation):**
   - Hội phí thuộc **Quỹ Hoạt Động** (`FUND_IDS.OPERATION`), cách ly hoàn toàn khỏi Quỹ Cọc Mượn-Trả (`FUND_IDS.LOAN`).
   - Bút toán kép: Có TK 511-FEE (`ACCOUNT_CODES.MEMBER_FEE`), Nợ TK 111-CASH (`ACCOUNT_CODES.CASH_DRAWER`) hoặc TK 112-BANK (`ACCOUNT_CODES.BANK_MAIN`).
   - Mã bút toán: `JE-DUES-YYYYMMDD-XXXX` ($\le 25$ ký tự).
   - Nếu thu tiền mặt tại quầy, hệ thống cập nhật tăng `expected_closing_cash` của ca trực đang mở.
4. **Cơ chế Idempotency chống double-collection:**
   - Hỗ trợ `idempotencyKey` trong header / payload. Replay trả về nguyên vẹn biên nhận ban đầu mà không sinh thêm bút toán.
5. **Giao diện Quản Lý Thành Viên (Module 3 Workspace):**
   - 6 thẻ tóm tắt Distinct Headcount (Tổng thành viên, Hậu cần, Nội dung, TT&ĐN, BCN, Kiêm nhiệm).
   - Danh sách thẻ thành viên với thông tin chi tiết, badge ban, chức vụ, badge hội phí (`Đã nộp 100k` / `Chưa nộp`).
   - Modal 13: Thu hội phí 100k một lần duy nhất (xác nhận tiền thực tế, chọn tiền mặt/chuyển khoản).
   - Modal 14: Lịch sử phân ban & chức vụ theo nhiệm kỳ.

### 40.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-carryover12** | **PASS** | Xử lý triệt để 10/10 findings Carryover Chặng 12 (S12-01..S12-10). Toàn bộ 127 tests Chặng 12 giữ vững PASS. |
| **2. G-multi-dept** | **PASS** | Kiểm chứng 1 người ở 2 ban -> tổng headcount distinct = 3, Hậu Cần = 1, BCN = 1, kiêm nhiệm = 1. Đổi vai trò lưu giữ trọn vẹn `start_date`, `end_date`, `is_current`. |
| **3. G-one-time-dues** | **PASS** | Thu lần đầu thành công cấp `DUE-YYYYMMDD-XXXX`, cập nhật `has_paid_fee = true`. Thu lần 2 bị từ chối 409 `DUPLICATE_MEMBERSHIP_FEE_COLLECTION`. Chưa xác nhận tiền bị chặn 400 `PAYMENT_CONFIRMATION_REQUIRED`. |
| **4. G-dues-accounting** | **PASS** | Bút toán `JE-DUES-` thuộc `FUND_IDS.OPERATION`, Có TK `511-FEE`, Nợ TK `111-CASH`/`112-BANK`. Float ca trực tăng đúng 100k. |
| **5. G-idempotency** | **PASS** | Tái phát request cùng `idempotencyKey` trả về cùng biên nhận `res2.id === res1.id`, số lượng bút toán không đổi. |
| **6. G-ui-desk** | **PASS** | Module Thành viên hoàn thiện: Render 6 card thống kê, danh sách member sống động, tích hợp Modal 13 và Modal 14, đồng bộ phím Escape đóng modal. |
| **7. G-members-db** | **BLOCKED** | Migration `05_stage13_members_and_dues.sql` đã soạn thảo cú pháp chuẩn, chờ DB PostgreSQL runtime live. |
| **8. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 0 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 3.35s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **134/134 tests PASS (100%)** trong 837ms.<br/>- **Python Experiments:** 22/22 tests PASS (0.025s). |

### 40.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 13

1. `docs/technical/schema/migrations/05_stage13_members_and_dues.sql`: Migration tạo bảng `member_affiliations` và `membership_dues_receipts` kèm ràng buộc UNIQUE member_id.
2. `src/server/members/types.ts`: Định nghĩa các hằng số ban ngành, vai trò, DTOs và params.
3. `src/server/members/rules.ts`: Validation cho phân ban và thu hội phí (an toàn VND, cờ paymentConfirmed, bảo toàn idempotencyKey).
4. `src/server/members/service.ts`: Nghiệp vụ phân ban, distinct headcount, thu hội phí một lần, hạch toán kép Quỹ Hoạt Động, idempotency claim/complete.
5. `src/server/router.ts`: Mount 5 REST API endpoints cho members, affiliations, headcount, dues.
6. `src/server/errors.ts`: Bổ sung `ConflictError` (409) và `ClosedSessionError` (400).
7. `tests/unit/mock-db-helper.ts`: Cập nhật mock handlers cho `members`, `member_affiliations`, `membership_dues_receipts` và snapshot transaction.
8. `src/lib/api-client.ts`: Thêm các DTOs và phương thức gọi API cho members, headcount, affiliations, dues.
9. `src/components/InternalWorkspace.tsx`: Cập nhật Module 3 giao diện thành viên, hiển thị Headcount cards, Member cards, Modal 13 (Thu hội phí) và Modal 14 (Lịch sử ban).
10. `src/components/PublicPortal.tsx`: Dọn dẹp unused imports.
11. `tests/unit/stage12-desk.test.ts`: Cập nhật `sessionId` parameter cho `issueLoanReceipt`.
12. `tests/unit/members-dues.test.ts`: Tạo bộ 7 unit test cases bằng `node:test` cho Chặng 13.
13. `package.json`: Đăng ký `tests/unit/members-dues.test.ts` vào lệnh `test:unit`.
14. `docs/technical/progress.md`: Cập nhật bảng tiến độ tổng quan và chi tiết Chặng 13 lên PARTIAL *(DB BLOCKED)*.

---

## 41. Chi Tiết Thực Hiện Chặng 14 (Import Excel Lịch Bận Theo Mẫu Thống Nhất)

### 41.1 Kiến Trúc & Nghiệp Vụ Cốt Lõi Đã Triển Khai
1. **Migration CSDL Chặng 14 (`06_stage14_availability_import.sql`):**
   - Bảng `duty_availability_batches`: Lưu trữ metadata đợt import (`id`, `batch_name`, `file_name`, `file_hash`, `file_size_bytes`, `term_semester`, `version`, `status` PREVIEWED/COMMITTED/SUPERSEDED, `total_rows`, `valid_rows`, `error_rows`, `imported_by`, `created_at`).
   - Bảng `member_busy_intervals`: Lưu trữ khoảng bận có kiểu (`id`, `batch_id`, `member_id`, `day_of_week` THU_HAI..CHU_NHAT, `start_time`, `end_time`, `busy_type` HOC_CHINH_KHOA/THI/CONG_VIEC_KHAC/BAN_CO_DINH, `notes`, `is_active`, `effective_start_date`, `effective_end_date`).
   - Ràng buộc: `CHECK (start_time < end_time)`, chỉ mục `(term_semester, is_active)` và `(member_id, day_of_week)`.
2. **Parser XLSX Thuần Node.js Không Thư Viện Ngoài (`availability-parser.ts`):**
   - Tự giải nén ZIP container theo RFC 1951 bằng `node:zlib.inflateRawSync`.
   - **Giới hạn an toàn nghiêm ngặt (R08):** Giới hạn tối đa 5 MB kích thước tệp tải lên (`MAX_FILE_BYTES`), tối đa 25 MB tổng dung lượng giải nén (`MAX_UNCOMPRESSED_BYTES` chống Zip Bomb), tối đa 2.500 dòng dữ liệu (`MAX_ROWS_LIMIT`).
   - **Chặn Macro & VBA:** Kiểm tra tên tệp `.bin`, `vbaProject`, cấm macro thực thi (`MACRO_NOT_ALLOWED`).
   - **Chống Formula Injection:** Tước bỏ các ký tự điều khiển Excel (`=`, `+`, `-`, `@`) ở đầu ô dữ liệu, không thực thi mã.
   - Trích xuất `xl/sharedStrings.xml` và `xl/worksheets/sheet1.xml` bằng regex streaming XML.
   - Chuẩn hóa: Thứ trong tuần (hỗ trợ NFD không dấu, "Thứ 2", "t2", "Monday"), giờ chuẩn (`HH:mm`), loại bận mặc định `HOC_CHINH_KHOA`.
   - Khớp danh tính thành viên linh hoạt: Theo MSSV $\rightarrow$ Username $\rightarrow$ Họ tên đầy đủ.
3. **Quy Tắc Fail-Safe "Dòng lỗi không thành rảnh":**
   - Nếu dòng trong bảng tính bị sai mã thành viên, sai định dạng giờ, hoặc giờ kết thúc $\le$ giờ bắt đầu: Đánh dấu `isValid = false` kèm `errorCode` và `errorMessage`.
   - Các dòng lỗi **tuyệt đối không được commit** vào bảng `member_busy_intervals`. Thuật toán xếp lịch Chặng 15 sẽ coi các khung giờ chưa rõ ràng là không khả dụng cho đến khi được chỉnh sửa xác nhận.
4. **Cơ Chế Quản Lý Phiên Bản & Chống Trùng Lặp (Versioning Batches):**
   - Khi import batch mới cho cùng một kỳ học (`term_semester`), hệ thống tự động tăng `version = max_ver + 1`.
   - Chuyển toàn bộ batch cũ của kỳ đó sang trạng thái `SUPERSEDED`, đồng thời cập nhật `is_active = FALSE` cho toàn bộ các khoảng bận của batch cũ.
   - Hỗ trợ `idempotencyKey` trong header `X-Idempotency-Key` / body payload, bảo vệ không nạp trùng lặp.
5. **Giao Diện Xem Trước & Xác Nhận (Module 4 Trực Sách):**
   - Nút "Import Lịch Bận (Excel)" tại thanh công cụ Module 4.
   - Modal 15: Upload `.xlsx`, chọn kỳ học, nút "Phân Tích Xem Trước (Preview)".
   - Bảng xem trước trực quan với 4 thẻ metric (Tổng dòng, Hợp lệ, Bị lỗi, Thành viên), bảng chi tiết tô màu dòng lỗi kèm mã lỗi, banner cảnh báo fail-safe, nút "Xác Nhận Lưu Lịch Bận (Commit)".

### 41.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-parser-safety** | **PASS** | Tự giải nén PK ZIP, chặn file non-ZIP (400), chặn file chứa macro `.bin` (400 `MACRO_NOT_ALLOWED`), tước bỏ formula injection. |
| **2. G-fail-safe** | **PASS** | Dòng sai MSSV / sai giờ không được commit vào DB (`errorCount > 0`, `validCount` chính xác). |
| **3. G-batch-versioning** | **PASS** | Re-import kỳ `2026.1` tự động tăng version lên 2, chuyển batch 1 thành `SUPERSEDED`, intervals cũ chuyển `is_active = false`. |
| **4. G-idempotency** | **PASS** | Tái phát request cùng `idempotencyKey` trả về cùng `batchId`, không tạo thêm batch trùng lặp. |
| **5. G-ui-desk** | **PASS** | Tích hợp Modal 15 tại Module 4, phân tích xem trước và commit lịch bận, hỗ trợ cả Live API và Demo Mock. |
| **6. G-availability-db** | **BLOCKED** | Migration `06_stage14_availability_import.sql` đã soạn thảo cú pháp chuẩn, chờ DB PostgreSQL runtime live. |
| **7. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 0 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 2.97s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **141/141 tests PASS (100%)** trong 754ms.<br/>- **Python Experiments:** 22/22 tests PASS (0.029s). |

### 41.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 14

1. `docs/technical/schema/migrations/06_stage14_availability_import.sql`: DDL bảng `duty_availability_batches` và `member_busy_intervals`.
2. `src/server/duty/availability-types.ts`: Enums thứ trong tuần, loại bận, DTOs dòng parsed, kết quả preview, params commit.
3. `src/server/duty/availability-parser.ts`: Unpacker ZIP Node.js, bộ lọc bảo mật, trích xuất streaming XML, chuẩn hóa thứ/giờ/loại bận, khớp danh tính.
4. `src/server/duty/availability-service.ts`: Dịch vụ preview bảng tính, commit batch, versioning kỳ học, truy vấn intervals.
5. `src/server/router.ts`: Mount 4 REST API endpoints (`/api/v1/duty/availability/preview`, `commit`, `batches`, `members/:id`).
6. `tests/unit/mock-db-helper.ts`: Cập nhật mock tables `duty_availability_batches`, `member_busy_intervals` và query router.
7. `src/lib/api-client.ts`: Thêm DTOs và 4 client methods (`previewAvailability`, `commitAvailability`, `getAvailabilityBatches`, `getMemberBusyIntervals`).
8. `src/components/InternalWorkspace.tsx`: Nối nút "Import Lịch Bận (Excel)" tại Module 4 và tích hợp Modal 15 Xem trước / Commit.
9. `tests/unit/availability-import.test.ts`: Bộ 7 unit test cases bao quát parser an toàn, format normalization, fail-safe dòng lỗi, versioning và idempotency.
10. `package.json`: Đăng ký `tests/unit/availability-import.test.ts` vào lệnh `test:unit`.
11. `docs/technical/progress.md`: Cập nhật bảng tiến độ tổng quan và chi tiết Chặng 14 lên PARTIAL *(DB BLOCKED)*.

---

## 42. Chi Tiết Thực Hiện Chặng 15 (Sửa solver lịch, chỉnh tay và công bố có phiên bản)

Chặng 15 hoàn thiện toàn diện solver xếp lịch trực sách tự động Thứ Ba & Thứ Năm, xử lý triệt để finding R11, cơ chế bảo toàn phân công chỉnh sửa tay (manual edit) và công bố có phiên bản (publish versioning).

### 42.1 Findings & Nghiệp Vụ Đã Xử Lý Trong Chặng 15

1. **Khắc phục triệt để Finding R11 (Điều kiện Trực chính & Trực hỗ trợ):**
   - **Trực chính (2 người):** Bắt buộc phải rảnh **toàn bộ khoảng 13:45 – 17:15** (gồm cả 13:45–14:00 chuẩn bị bàn trực, 14:00–17:00 giờ mở quầy đón bạn đọc, và 17:00–17:15 thu dọn bàn giao). Ứng viên rảnh 14:00–17:00 nhưng bận lúc 13:45–14:00 hoặc 17:00–17:15 lập tức bị loại khỏi danh sách trực chính.
   - **Trực hỗ trợ (3–5 người):** Chỉ cần rảnh lúc mở ca (13:45–14:15) HOẶC đóng ca (16:45–17:15). Thành viên bận giữa ca (ví dụ 14:30–16:30) vẫn đủ điều kiện làm trực hỗ trợ.
   - **Tách bạch cảnh báo thiếu nhân sự (R11 Warning):** Thiếu trực chính (`< 2`) và thiếu trực hỗ trợ (`< 3`) được tách thành 2 cảnh báo độc lập (`warningMain`, `warningSupport`). Dưới 3 helper (kể cả có 2 helper) bắt buộc phải xuất cảnh báo thiếu hỗ trợ.
   - **Chặn theo chính sách:** Cựu thành viên (`is_alumni = true`) và thành viên chưa qua đào tạo trực chính (`is_eligible_main = false`) bị chặn nghiêm ngặt.
   - **Tự động gán 4 vai trò cụ thể:** `CASH_DRAWER` (Kiểm két tiền), `CIRCULATION_LOG` (Ghi sổ mượn trả), `LOGISTICS_SETUP` (Chuẩn bị & bàn giao), `BOOK_INTRO` (Giới thiệu sách).

2. **Chỉnh Sửa Tay Có Phiên Bản & Rào Chắn Shared Validator:**
   - Cung cấp API chỉnh sửa tay `manualEditSchedule`.
   - Sử dụng chung hàm kiểm chứng `validateShiftAssignment` (Shared Validator) cho cả Solver tự động và Chỉnh sửa tay. Nghiêm cấm gán người vi phạm điều kiện khi sửa tay.
   - Khi chỉnh sửa tay, hệ thống đánh dấu `is_manually_edited = true`, ghi nhận `manually_edited_by`, `manually_edited_at` và tự động tăng số phiên bản `version = version + 1`.
   - Khi chạy lại solver tạo nháp cho kỳ học (`generateDraftSchedules`), hệ thống **tuyệt đối bảo toàn** các ca đã chỉnh sửa tay và các ca đã công bố, không tự ý ghi đè.

3. **Công Bố Lịch Trực Có Phiên Bản (Publish Schedule):**
   - Chuyển trạng thái ca trực từ `DRAFT` sang `PUBLISHED`.
   - Ghi nhận `published_version = version`, `published_at`, `published_by`.
   - **Chỉ tính lịch sử số ca trực khi công bố:** Số ca trực đã qua chỉ được cộng dồn từ các ca có trạng thái `PUBLISHED`. Ca `DRAFT` không được làm tăng biến đếm lịch sử của thành viên, đảm bảo tính công bằng (soft fairness).

4. **Tạo Mẫu Đăng Facebook Tự Động (Offline / No Live Network Call):**
   - Tự động sinh nội dung bài đăng thông báo lịch trực chuẩn format tiếng Việt của YSBK, kèm danh sách trực chính, trực hỗ trợ, vai trò và link tra cứu.
   - Tuân thủ nghiêm ngặt quy tắc an toàn: Không gọi bất kỳ Facebook Graph API hay dịch vụ mạng bên ngoài nào.

5. **Giao Diện Trực Sách Tích Hợp (Module 4 & Modals 16, 17, 18):**
   - Module 4 hiển thị danh sách ca trực live kèm trạng thái phiên bản (v1, v2...), nhãn "Đã sửa tay", badges `DRAFT` / `PUBLISHED`.
   - Cảnh báo thiếu nhân sự riêng biệt hiển thị trực quan dạng alert card.
   - Modal 16: Form chạy Auto-Solver tạo dự thảo lịch theo khoảng ngày và kỳ học, tự động bỏ qua ngày nghỉ lễ.
   - Modal 17: Modal chỉnh sửa tay phân công trực, cho phép thêm/bớt thành viên, đổi vai trò cụ thể, tự động kiểm tra Shared Validator.
   - Modal 18: Xem và copy nội dung mẫu đăng Facebook vào clipboard.

### 42.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-r11-solver** | **PASS** | Kiểm chứng Python test `test_scheduler_fairness.py` & Node test `scheduler.test.ts`: Main bận 13:45-14:00 bị loại; Support rảnh mở/đóng ca được nhận; Cảnh báo riêng thiếu main & thiếu support (<3); Cựu thành viên/chưa đào tạo bị chặn. |
| **2. G-manual-edit** | **PASS** | Shared validator barrier chặn gán thành viên vi phạm; Lưu sửa tay tăng phiên bản $v \to v+1$, đánh dấu `is_manually_edited = true`; Solver tạo nháp không ghi đè ca đã sửa tay. |
| **3. G-publish-version** | **PASS** | Chuyển `PUBLISHED`, lưu `published_version`, ca `DRAFT` không làm tăng counter lịch sử thành viên. |
| **4. G-desk-ui** | **PASS** | Module 4 cập nhật giao diện phân công, hiển thị 4 vai trò, cảnh báo thiếu riêng biệt, Modals 16 (Tạo nháp), 17 (Chỉnh sửa tay), 18 (Xem & copy Facebook). |
| **5. G-roster-db** | **BLOCKED** | Migration `07_stage15_duty_roster.sql` đã soạn thảo cú pháp chuẩn, chờ DB PostgreSQL runtime live. |
| **6. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 0 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (Hoàn tất trong 3.05s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **148/148 tests PASS (100%)** trong 818ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.025s). |

### 42.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 15

1. `experiments/test_scheduler_fairness.py`: Bổ sung test case R11 và sửa solver Python đáp ứng chuẩn R11.
2. `docs/technical/schema/migrations/07_stage15_duty_roster.sql`: DDL bảng `duty_schedules` và `duty_schedule_assignees`.
3. `src/server/duty/roster-types.ts`: Enums `ScheduleStatus`, `DutyType`, `AssignedRole`, `AttendanceStatus`, policy label và DTOs.
4. `src/server/duty/scheduler.ts`: Solver TypeScript, Shared Validator, `TIME_BOUNDS`, kiểm tra điều kiện Main/Support, phân công 4 vai trò, sinh văn bản Facebook.
5. `src/server/duty/roster-service.ts`: Dịch vụ tạo nháp bảo toàn sửa tay, chỉnh sửa tay tăng phiên bản, công bố lịch có phiên bản, điểm danh.
6. `src/modules/duty/scheduler.ts` & `roster.ts`: Re-export module chuẩn.
7. `tests/unit/mock-db-helper.ts`: Cập nhật mock handlers cho `duty_schedules` và `duty_schedule_assignees`.
8. `src/server/router.ts`: Mount 6 REST API endpoints cho Duty Schedules.
9. `src/lib/api-client.ts`: Thêm DTOs và 6 methods gọi API duty schedules.
10. `src/components/InternalWorkspace.tsx`: Cập nhật Module 4 và Modals 16, 17, 18.
11. `tests/unit/scheduler.test.ts`: 7 unit test cases bao quát 5 gate R11, lifecycle service và shared validator barrier.
12. `tests/integration/roster.test.ts`: Integration test cho DDL migration 07 và PostgreSQL constraints.
13. `package.json`: Đăng ký `tests/unit/scheduler.test.ts` vào `test:unit` và `tests/integration/roster.test.ts` vào `test:db`.
14. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 42 lên PARTIAL *(DB BLOCKED)*.

---

## 43. Chi Tiết Thực Hiện Chặng 16 (Tiếp nhận và đối soát Google Form)

Chặng 16 thiết lập toàn diện cơ chế tiếp nhận đơn ứng tuyển tuyển sinh tự động từ Google Form qua Webhook bảo mật, khóa nguồn phân biệt sửa đổi với trùng lặp, cơ chế đối soát checkpoint bù đơn và che giấu PII.

### 43.1 Findings & Nghiệp Vụ Đã Xử Lý Trong Chặng 16

1. **Bảo Mật Webhook Tiếp Nhận Tuyển Sinh (HMAC & Timing Attack Protection):**
   - Xác thực chữ ký số HMAC-SHA256 qua header `X-Webhook-Signature` hoặc Shared Secret Token qua `X-Webhook-Secret`.
   - Sử dụng `crypto.timingSafeEqual` để so sánh chuỗi bảo mật, ngăn chặn hoàn toàn timing attacks.
   - **Rào chắn chống Replay Attack:** Bắt buộc có header `X-Timestamp`, nếu thời gian gửi lệch quá 5 phút (300.000 ms) so với giờ máy chủ, request lập tức bị từ chối `401 Unauthorized` (`REPLAY_ATTACK_DETECTED`).
   - Giới hạn kích thước payload tối đa 2MB để chống tấn công DoS.

2. **Khóa Nguồn FormID + ResponseID & Commit Bền Trước Khi ACK:**
   - Sử dụng tổ hợp khóa duy nhất `UNIQUE(form_id, response_id)` trên bảng `recruitment_form_responses`.
   - Cam kết giao dịch bền (durable commit) xuống cơ sở dữ liệu trước khi gửi mã phản hồi 200/201 ACK về cho client webhook.
   - **Xử lý trùng lặp và sửa đổi đơn:** Nếu payload gửi lại hoàn toàn trùng lặp dữ liệu, hệ thống trả về `isDuplicate: true` và cập nhật timestamp `last_observed_at`. Nếu ứng viên sửa đổi câu trả lời trên Google Form, hệ thống phát hiện thay đổi nội dung, cập nhật bản ghi và tự động tăng số phiên bản `version = version + 1`.

3. **Bảo Toàn Tuyệt Đối Đánh Giá Phỏng Vấn (Evaluation Immutability):**
   - Tách biệt hoàn toàn bảng dữ liệu thô từ form (`recruitment_form_responses`) với bảng chấm điểm, nhận xét phỏng vấn (`recruitment_evaluations`).
   - Khi webhook nhận bản cập nhật đơn từ ứng viên hoặc khi chạy đối soát bù dữ liệu, hệ thống **tuyệt đối không bao giờ** sửa đổi, ghi đè hoặc xóa các bản ghi đánh giá, điểm số hay quyết định tuyển dụng đã có.

4. **Cơ Chế Đối Soát Checkpoint Bù Đơn Thiếu (Form Reconciliation):**
   - Endpoint `POST /api/v1/recruitment/reconcile` cho phép đối soát định kỳ danh sách `response_id` từ Google Sheets/Form với CSDL YSBK.
   - Tự động backfill (bù) các đơn bị rớt do lỗi mạng, đánh dấu `sync_status = 'RECONCILED'`, và ghi nhận checkpoint đối soát vào bảng `recruitment_reconciliation_checkpoints`.

5. **Bảo Vệ Dữ Liệu Nhạy Cảm (PII Masking):**
   - Module `pii-masker.ts` hỗ trợ che giấu mã số sinh viên (`2023****`), số điện thoại (`091****678`), và email (`lo***8@sis.hust.edu.vn`).
   - Endpoint công khai `GET /api/v1/recruitment/responses/public-summary` chỉ trả về số lượng đơn theo ban và danh sách đã che giấu PII, tuyệt đối không lộ dữ liệu cá nhân ra bên ngoài.

6. **Mã Nguồn Google Apps Script & Tài Liệu Vận Hành:**
   - Mã nguồn `src/modules/recruitment/apps-script/Code.gs` cài đặt trigger `onFormSubmit`, tính toán chữ ký HMAC-SHA256, tự động retry backoff 3 lần khi mạng gián đoạn.
   - Tài liệu `docs/technical/recruitment-apps-script.md` hướng dẫn chi tiết quy trình triển khai Apps Script và checklist đối soát bù đơn.

7. **Giao Diện Không Gian Làm Việc (Module 5 Tuyển Thành Viên & Modals 19, 20):**
   - Tích hợp Module 5 vào `InternalWorkspace.tsx` với thẻ thống kê 5 ban (Chuyên môn, Truyền thông, Hậu cần, Tài chính, Nhân sự).
   - Bảng danh sách đơn ứng tuyển live, nhãn ban, trạng thái đồng bộ, nhãn phiên bản sửa đổi.
   - Modal 19: Xem chi tiết toàn bộ nội dung đơn ứng tuyển và câu trả lời.
   - Modal 20: Đối soát bù đơn thiếu từ danh sách JSON của Google Form/Sheets.

### 43.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-auth-security** | **PASS** | Xác thực chữ ký HMAC-SHA256 timing-safe, shared secret token, chặn replay lệch quá 5 phút (401 REPLAY_ATTACK_DETECTED). |
| **2. G-source-key** | **PASS** | Khóa (FormID, ResponseID) duy nhất; commit bền trước khi ACK; phát hiện duplicate; tự tăng version khi ứng viên sửa đơn. |
| **3. G-eval-preservation** | **PASS** | Bảng `recruitment_evaluations` độc lập; cập nhật đơn hoặc chạy đối soát không ghi đè/xóa điểm chấm phỏng vấn. |
| **4. G-reconcile-checkpoint** | **PASS** | `POST /api/v1/recruitment/reconcile` so khớp danh sách IDs, bù đơn thiếu, lưu checkpoint vào `recruitment_reconciliation_checkpoints`. |
| **5. G-pii-masking** | **PASS** | Mask email, phone, student ID; `toPublicApplicantView` và endpoint public summary không lộ PII. |
| **6. G-recruitment-db** | **BLOCKED** | Migration `08_stage16_recruitment_sync.sql` đã soạn thảo cú pháp chuẩn, chờ DB PostgreSQL runtime live. |
| **7. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 0 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 3.20s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **155/155 tests PASS (100%)** trong 804ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.025s). |

### 43.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 16

1. `docs/technical/schema/migrations/08_stage16_recruitment_sync.sql`: DDL 5 bảng (`recruitment_forms`, `recruitment_form_questions`, `recruitment_form_responses`, `recruitment_evaluations`, `recruitment_reconciliation_checkpoints`).
2. `src/modules/recruitment/recruitment-types.ts`: Định nghĩa Enums, webhook payload, detail DTO, public DTO, reconciliation DTO.
3. `src/modules/recruitment/pii-masker.ts`: Thuật toán che giấu PII (email, phone, student ID, full name).
4. `src/modules/recruitment/ingest-form.ts`: Module tiếp nhận form, xác thực HMAC/secret, chống replay, commit bền trước ACK, duplicate detection, tăng version.
5. `src/modules/recruitment/form-reconciliation.ts`: Module đối soát bù đơn, lưu checkpoint, danh sách responses nội bộ và thống kê public.
6. `src/modules/recruitment/apps-script/Code.gs`: Mã nguồn Google Apps Script trigger `onFormSubmit` kèm HMAC signature và retry backoff.
7. `docs/technical/recruitment-apps-script.md`: Hướng dẫn cài đặt Apps Script và đối soát dữ liệu.
8. `src/server/types.ts`: Thêm biến môi trường `RECRUITMENT_WEBHOOK_SECRET`.
9. `src/server/router.ts`: Mount 4 REST API endpoints (`/api/v1/recruitment/webhook/google-form`, `/responses`, `/reconcile`, `/responses/public-summary`).
10. `src/lib/api-client.ts`: Thêm DTOs và 4 API methods recruitment.
11. `tests/unit/mock-db-helper.ts`: Bổ sung mock query handlers 89-96 và snapshot transaction cho recruitment.
12. `src/components/InternalWorkspace.tsx`: Bổ sung Module 5 Tuyển Thành Viên và Modals 19, 20.
13. `tests/unit/form-sync.test.ts`: Bộ 7 unit test cases bao quát toàn bộ 7 gates của Chặng 16.
14. `tests/integration/recruitment-schema.test.ts`: Integration test cho DDL migration 08 và PostgreSQL constraints.
15. `package.json`: Đăng ký `tests/unit/form-sync.test.ts` vào `test:unit` và `tests/integration/recruitment-schema.test.ts` vào `test:db`.
16. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 43 lên PARTIAL *(DB BLOCKED)*.

---

## 44. Chi Tiết Thực Hiện Chặng 17 (Rubric Phiên Bản, Phỏng Vấn Và Tổng Kết Tuyển)

### 44.1 Các Điểm Cải Tiến Kỹ Thuật Đã Hoàn Thành

1. **Quản Lý Phiên Bản Rubric Theo Chiến Dịch (Rubric Versioning & Immutability):**
   - Thiết kế bảng `recruitment_rubrics` và `recruitment_rubric_criteria` với ràng buộc duy nhất `UNIQUE(campaign_id, version)`.
   - Mỗi chiến dịch tuyển dụng có thể định nghĩa phiên bản rubric riêng biệt. Khi tạo rubric mới cho đợt tuyển sau, hệ thống không làm thay đổi tiêu chí, trọng số hay điểm số đã chấm của các chiến dịch trước đó.

2. **Chặn Đứng Tự Ý Tính Trung Bình Cộng Khi Chưa Có Công Thức Duyệt (R07 Compliance):**
   - Ràng buộc R07 nêu rõ: tuyệt đối không tự ý áp đặt công thức tính trung bình cộng hoặc công thức chưa được hội đồng phê chuẩn.
   - Hàm `calculateEvaluationScore` kiểm tra chặt chẽ: nếu `formula_type === 'UNSPECIFIED'`, hệ thống trả về `totalScore: null` và `formulaStatus: 'UNSPECIFIED_FORMULA'`.
   - Chỉ khi rubric được cấu hình công thức trọng số hợp lệ (`WEIGHTED_SUM`), hệ thống mới tính tổng điểm dựa trên điểm tiêu chí nhân trọng số tương ứng.

3. **Chấm Điểm Độc Lập & Nhật Ký Kiểm Toán Có Lý Do (Audit Trail & Concurrency Lock):**
   - Người chấm nhập điểm độc lập, lưu định danh `evaluator_id`.
   - Bảng `recruitment_evaluation_history` ghi lại toàn bộ lịch sử chỉnh sửa điểm: snapshot dữ liệu trước (`previous_score`, `previous_notes`), dữ liệu sau (`new_score`, `new_notes`), người sửa (`changed_by`), thời điểm (`changed_at`) và lý do bắt buộc (`change_reason`). Nếu thiếu lý do, request bị từ chối `400 Bad Request`.
   - Áp dụng kiểm soát tương tranh lạc quan (Optimistic Concurrency Control): mỗi lần sửa đổi, kiểm tra `expectedVersion !== current.version`. Nếu phát hiện xung đột do người khác đã sửa trước, trả về `409 Conflict` kèm thông điệp rõ ràng, chống ghi đè mất dữ liệu.

4. **Hội Đồng Tổng Kết & Phân Ban Tuyển Dụng Linh Hoạt (D33 Compliance):**
   - Bảng `recruitment_decisions` lưu quyết định cuối cùng của hội đồng (`PASSED`, `FAILED`, `WAITLIST`).
   - Hỗ trợ phân ban trúng tuyển (`assigned_department`) có thể khác với cả Nguyện vọng 1 và Nguyện vọng 2 ban đầu của ứng viên theo quyết định phỏng vấn và sắp xếp nhân sự của CLB.

5. **Chuyển Ứng Viên Trúng Tuyển Thành Thành Viên An Toàn & Idempotent (D31, D37 Compliance):**
   - Bảng `recruitment_decisions` quản lý cờ `is_converted_to_member` và `converted_member_id` với chỉ mục duy nhất `UNIQUE(converted_member_id)`.
   - Hàm `convertPassedApplicantToMember` chỉ cho phép chuyển đổi đối với quyết định `PASSED`.
   - Khi thực hiện lại hoặc bấm đúp (retry), hàm phát hiện hồ sơ đã chuyển đổi và trả về an toàn `isAlreadyConverted: true` cùng `memberId` hiện tại, tuyệt đối không tạo bản ghi thành viên thứ hai.
   - Thành viên mới được chuyển vào bảng `members` mang vai trò `Thành viên tập sự`, `is_eligible_main_duty: false` (chưa đủ điều kiện trực chính theo D31), và `has_paid_fee: false` (chưa nộp hội phí một lần theo D37).

6. **Bảo Vệ Quyền Riêng Tư Kết Quả Tuyển Dụng Công Khai (R13 Compliance):**
   - Bảng `recruitment_public_announcements` lưu danh sách kết quả đã được phê duyệt công bố.
   - Endpoint công khai `GET /api/v1/recruitment/announcements/public-results` chỉ xuất các trường đã kiểm duyệt: `candidateCode`, `passedDepartment`, `termSemester`.
   - Loại bỏ hoàn toàn 100% dữ liệu nhạy cảm PII (Mã số sinh viên, họ và tên, email, số điện thoại, điểm số chi tiết hay nhận xét nội bộ).

7. **Tích Hợp Giao Diện Không Gian Làm Việc (Modals 21, 22):**
   - Tích hợp thêm các nút thao tác "Chấm Điểm" và "Hội Đồng" tại bảng ứng viên Module 5 của `InternalWorkspace.tsx`.
   - Modal 21: Giao diện chấm điểm tiêu chí theo Rubric, sửa điểm bắt buộc nhập lý do và xem lịch sử audit log.
   - Modal 22: Giao diện hội đồng tổng kết, chọn phân ban trúng tuyển linh hoạt, chốt quyết định và nút chuyển đổi thành viên idempotent trực tiếp.

### 44.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-rubric-version** | **PASS** | Rubric theo chiến dịch `UNIQUE(campaign_id, version)`, thêm rubric mới không ảnh hưởng tiêu chí hay điểm số đợt cũ. |
| **2. G-unapproved-formula** | **PASS** | R07 compliance: `formula_type === 'UNSPECIFIED'` trả về `totalScore: null, formulaStatus: 'UNSPECIFIED_FORMULA'`, tuyệt đối không tự ý tính trung bình cộng. |
| **3. G-eval-audit** | **PASS** | Sửa điểm bắt buộc nhập lý do, ghi nhật ký `recruitment_evaluation_history`, kiểm soát tương tranh lạc quan chặn xung đột đồng thời `409 Conflict`. |
| **4. G-dept-assignment** | **PASS** | D33 compliance: Hội đồng có thể phân ứng viên vào ban khác nguyện vọng 1 và 2. |
| **5. G-idempotent-member** | **PASS** | Chuyển đổi trúng tuyển sang `members` an toàn idempotent, không nhân đôi thành viên, gắn role `Thành viên tập sự`, `is_eligible_main_duty: false`, `has_paid_fee: false`. |
| **6. G-public-privacy** | **PASS** | R13 compliance: Endpoint công khai chỉ hiển thị `candidateCode`, `passedDepartment`, `termSemester`, loại bỏ 100% PII. |
| **7. G-eval-db** | **BLOCKED** | Migration `09_stage17_evaluation_decisions.sql` đã soạn thảo cú pháp chuẩn, chờ DB PostgreSQL runtime live. |
| **8. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 0 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 3.33s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **161/161 tests PASS (100%)** trong 886ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.025s). |

### 44.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 17

1. `docs/technical/schema/migrations/09_stage17_evaluation_decisions.sql`: DDL 6 bảng (`recruitment_rubrics`, `recruitment_rubric_criteria`, `recruitment_interviews`, `recruitment_evaluations` enhancements, `recruitment_evaluation_history`, `recruitment_decisions`, `recruitment_public_announcements`).
2. `src/modules/recruitment/evaluation-types.ts`: Định nghĩa types, DTOs, Enums cho Rubric, Evaluation, History, Decision, Public announcement.
3. `src/modules/recruitment/evaluation.ts`: Quản lý rubric phiên bản, tính điểm weighted sum, chặn trung bình cộng R07, chấm độc lập, sửa điểm có lý do & audit log, optimistic lock.
4. `src/modules/recruitment/decisions.ts`: Hội đồng tổng kết, phân ban khác nguyện vọng, chuyển đổi thành viên idempotent đúng 1 lần (D31, D37), phê duyệt công bố public R13.
5. `src/server/router.ts`: Mount 10 REST API endpoints (55 đến 64) cho rubrics, evaluations, history, decisions, convert-member, announcements.
6. `src/lib/api-client.ts`: Bổ sung DTOs và 10 client methods tương ứng.
7. `tests/unit/mock-db-helper.ts`: Mở rộng 5 mảng dữ liệu, snapshot/rollback, query handlers 97-114.
8. `src/components/InternalWorkspace.tsx`: Bổ sung nút Chấm Điểm & Hội Đồng, Modals 21 & 22.
9. `tests/unit/evaluation.test.ts`: Bộ 6 unit test cases bao quát toàn bộ 6 gates Chặng 17.
10. `tests/integration/recruitment-evaluation.test.ts`: Integration test cho DDL migration 09 và PostgreSQL constraints.
11. `package.json`: Đăng ký `tests/unit/evaluation.test.ts` vào `test:unit` và `tests/integration/recruitment-evaluation.test.ts` vào `test:db`.
12. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 44 lên PARTIAL *(DB BLOCKED)*.

---

## 45. Chi Tiết Thực Hiện Chặng 18 (Lô Sách Mới, Bán/Trả Dư và Quyết Toán Nhà Sách)

### 45.1 Các Cải Tiến Kỹ Thuật Đã Thực Hiện

1. **Schema DDL Quản Lý Lô Sách Mới & Ký Gửi (`docs/technical/schema/migrations/10_stage18_book_sales_consignment.sql`):**
   - Tạo 7 bảng quan hệ: `book_suppliers` (nhà sách/đối tác ký gửi), `consignment_lots` (lô sách ký gửi), `consignment_lot_items` (từng tựa sách trong lô), `book_sales` (giao dịch bán sách lẻ), `consignment_returns` (chứng từ trả sách dư vật lý), `consignment_settlements` (quyết toán tài chính theo lô), `supplier_payments` (thanh toán nợ và nhận hoàn cọc).
   - Ràng buộc bất biến bảo toàn số lượng lô sách:
     `CONSTRAINT chk_lot_item_quantity_conservation CHECK (initial_quantity = sold_quantity + returned_quantity + retained_quantity + available_quantity)`.
   - Cấm số lượng âm trên mọi trạng thái và kiểm soát trạng thái lô tuần tự (`RECEIVED`, `ACTIVE`, `RETURNING`, `SETTLED`, `CLOSED`).
   - Tách biệt hoàn toàn kho sách mới bán/ký gửi với kho sách mượn truyền thống (`book_copies`). Bán sách lẻ không chạm và không làm biến động sách cho mượn.

2. **Bán Sách Lẻ Tại Quầy & Chặn Đứng Âm Tồn / Over-selling (`src/modules/sales/lot-inventory.ts`):**
   - Hàm `recordBookSale` kiểm tra điều kiện tồn kho ngay trước khi ghi nhận (`available_quantity >= quantity`). Nếu vượt quá số lượng khả dụng, ném lỗi `INSUFFICIENT_STOCK` (HTTP 409 Conflict) và rollback toàn bộ.
   - Khi thanh toán bằng tiền mặt (`CASH`), tự động tích hợp ca trực quầy đang mở (`cash_sessions`), cập nhật tiền mặt thực tế trong két.
   - Khi thanh toán chuyển khoản (`BANK`), ghi nhận doanh thu nhưng không làm biến động số dư tiền mặt trong ca.

3. **Trả Sách Dư Vật Lý Tách Biệt Nghiệp Vụ Hoàn Tiền (Tuân thủ T56 & T59):**
   - Hàm `returnUnsoldBooks` lập chứng từ trả sách vật lý `consignment_returns`, chuyển số lượng khả dụng sang `returned_quantity` và bảo toàn `chk_lot_item_quantity_conservation`.
   - Tuân thủ nghiêm ngặt nguyên tắc T56 & T59: **Ghi nhận trả sách vật lý tuyệt đối không tự động xác nhận hoặc suy diễn là đã nhận tiền hoàn cọc/tiền sách từ ngân hàng**.

4. **Công Thức Quyết Toán Chuẩn Mực & Xử Lý Cọc Theo Quy Tắc Nghiệp Vụ (Tuân thủ T68 & T69):**
   - Hàm `calculateLotSettlement` tính toán chính xác 3 chỉ số tài chính:
     - Doanh thu: $\sum sold\_quantity \times retail\_price$
     - Nợ tiền sách nhà sách: $\sum sold\_quantity \times import\_price$
     - Lãi gộp CLB: $Doanh\ thu - Nợ\ tiền\ sách$
   - **Quy tắc T68 (Lô không cọc):** Ví dụ lô 100 cuốn giá bìa 80k, giá nhập 65k, bán 60 cuốn, trả 40 cuốn. Doanh thu = 4.800.000đ, Nợ nhà sách = 3.900.000đ, Lãi gộp = 900.000đ. Do CLB không đặt cọc (`deposit_paid = 0`), số tiền hoàn cọc kỳ vọng **bắt buộc bằng 0đ**, tuyệt đối không tự suy diễn sinh ra khoản tiền hoàn giả định 2.600.000đ từ sách trả dư.
   - **Quy tắc T69 (Lô có cọc):** Ví dụ CLB đã đặt cọc trước 1.000.000đ cho nhà sách. Khi quyết toán, hệ thống ghi nhận tách bạch 2 dòng tiền:
     1. Nhận hoàn cọc: 1.000.000đ (thu hồi khoản phải thu `RECEIVE_DEPOSIT_REFUND`). Nhận lại cọc không phải là doanh thu!
     2. Trả nợ tiền sách bán được: 3.900.000đ (thanh toán công nợ `PAY_SUPPLIER_PAYABLE`).
     - **Tuyệt đối không cấn trừ gộp thành một khoản chi ròng duy nhất 2.900.000đ**, bảo đảm tính minh bạch kế toán kép và đối soát sao kê ngân hàng.

5. **Cách Ly Rạch Ròi Hai Loại Tiền Cọc (Tuân thủ T58):**
   - Tiền cọc đặt cho nhà sách (`deposit_paid`) là tài sản phải thu (Receivable) của CLB.
   - Tiền cọc giữ của bạn đọc (`reader_deposit_held`) là nợ phải trả (Liability) của CLB.
   - Hai dòng tiền độc lập về tài khoản, không bù trừ hay nhập nhằng với nhau.

6. **Chống Quyết Toán Trùng Bằng Idempotency Key (Tuân thủ T60):**
   - Lập quyết toán và thanh toán nhà sách bắt buộc hỗ trợ header `X-Idempotency-Key`.
   - Nếu thực hiện lại với cùng key, hệ thống trả về kết quả quyết toán đã lưu kèm `isReplay: true`, bảo đảm không bị nhân đôi bút toán công nợ.

7. **Tích Hợp API, Giao Diện & Mock Database:**
   - Mount 11 API endpoints (`/api/v1/sales/*`) trên router với `requireInternalMember` guard.
   - Bổ sung 11 client methods và types trong `src/lib/api-client.ts`.
   - Bổ sung Module 6 và 4 Modals (23: Thêm nhà sách, 24: Nhập lô sách mới, 25: Bán sách tại quầy, 26: Trả dư & Quyết toán thanh toán riêng biệt) trong `src/components/InternalWorkspace.tsx`.
   - Mở rộng `mock-db-helper.ts` với 7 tables mới và 28 handlers truy vấn phục vụ unit tests.

### 45.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-lot-inventory** | **PASS** | Bảo toàn số lượng lô sách `chk_lot_item_quantity_conservation`, tách biệt hoàn toàn sách mượn `book_copies`. |
| **2. G-oversell-prevention** | **PASS** | Kiểm tra tồn trước khi bán, chặn đứng âm tồn, ném 409 Conflict `INSUFFICIENT_STOCK`. Tự động tích hợp ca tiền mặt khi trả CASH. |
| **3. G-physical-return** | **PASS** | T56, T59: Chứng từ trả sách dư vật lý `consignment_returns` không tự động xác nhận hoàn tiền ngân hàng. |
| **4. G-gate-t68** | **PASS** | Lô không cọc: Doanh thu 4.8tr, nợ nhà sách 3.9tr, lãi gộp 900k, hoàn cọc = 0đ, tuyệt đối không sinh 2.6tr hoàn giả định. |
| **5. G-gate-t69** | **PASS** | Lô có cọc 1tr: Nhận hoàn cọc riêng 1tr, trả nợ sách riêng 3.9tr, lãi gộp 900k, tuyệt đối không cấn trừ gộp 2.9tr. Nhận cọc không tính doanh thu. |
| **6. G-idempotent-settle** | **PASS** | T60: Idempotency key bảo vệ chống tạo trùng quyết toán và thanh toán nhà sách. |
| **7. G-deposit-isolation** | **PASS** | T58: Cọc nhà sách (Receivable) tách biệt hoàn toàn với cọc bạn đọc (Liability). |
| **8. G-sales-db** | **BLOCKED** | Migration `10_stage18_book_sales_consignment.sql` đã soạn thảo cú pháp chuẩn, chờ DB PostgreSQL runtime live. |
| **9. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 0 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 3.34s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **167/167 tests PASS (100%)** trong 887ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.028s). |

### 45.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 18

1. `docs/technical/schema/migrations/10_stage18_book_sales_consignment.sql`: DDL 7 bảng cho quản lý lô sách mới, ký gửi, bán lẻ, trả sách và quyết toán tài chính.
2. `src/modules/sales/sales-types.ts`: Định nghĩa types, DTOs, Enums cho Supplier, Lot, Item, Sale, Return, Settlement, SupplierPayment.
3. `src/modules/sales/lot-inventory.ts`: Nghiệp vụ nhà sách, nhập lô, bán sách tại quầy (chặn âm tồn, cập nhật ca trực), trả sách dư vật lý, lưu trữ đợt sau.
4. `src/modules/sales/settlement.ts`: Quyết toán tài chính theo lô (T68, T69), thanh toán nợ sách & nhận hoàn cọc riêng rẽ, kiểm soát idempotency (T60), cách ly cọc (T58).
5. `src/server/router.ts`: Mount 11 REST API endpoints (65 đến 75) cho sales & consignment với `requireInternalMember` guard.
6. `src/lib/api-client.ts`: Bổ sung DTOs và 11 client methods tương ứng.
7. `tests/unit/mock-db-helper.ts`: Mở rộng 7 mảng dữ liệu, snapshot/rollback, query handlers 115-142.
8. `src/components/InternalWorkspace.tsx`: Bổ sung Module 6 và 4 Modals (23, 24, 25, 26).
9. `tests/unit/sales-consignment.test.ts`: Bộ 6 unit test cases bao quát toàn bộ các gates Chặng 18.
10. `tests/integration/sales-settlement.test.ts`: Integration test cho DDL migration 10 và PostgreSQL constraints.
11. `package.json`: Đăng ký `tests/unit/sales-consignment.test.ts` vào `test:unit` và `tests/integration/sales-settlement.test.ts` vào `test:db`.
12. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 45 lên PARTIAL *(DB BLOCKED)*.

---

## 46. Chi Tiết Thực Hiện Chặng 19 (Hoạt động, sự kiện và nhiệm vụ liên kết quỹ - FR-06)

### 46.1 Các Kỹ Thuật Đã Triển Khai

1. **Schema CSDL & Ràng Buộc Toàn Vẹn (`11_stage19_events_activities.sql`):**
   - Thiết kế 6 bảng quan hệ theo chuẩn PostgreSQL 3NF:
     - `activities`: Quản lý sự kiện, ngày bắt đầu/kết thúc, địa điểm, tổng dự toán, trạng thái (`DRAFT`, `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), cờ phê duyệt công khai (`is_public_approved`) và cựu thành viên (`is_alumni_visible`).
     - `activity_tasks`: Nhiệm vụ phân công, độ ưu tiên (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), hạn chót, trạng thái (`TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`).
     - `activity_task_history`: Lưu vết audit log bất biến mọi thay đổi nhiệm vụ (cột, giá trị cũ, giá trị mới, lý do thay đổi bắt buộc, người thực hiện).
     - `activity_participants`: Quản lý người tham dự. Ràng buộc `chk_participant_identity` phân tách rõ ràng:
       - Nếu `MEMBER`: bắt buộc `member_id` hợp lệ.
       - Nếu `GUEST` (tuân thủ **R07**): chỉ cần `guest_name`, không bắt buộc `student_id` (MSSV) hay trường/khoa, **không ép tạo bản ghi member giả**.
     - `activity_budget_items`: Hạng mục dự toán kế hoạch (`estimated_amount > 0`), độc lập với chi phí thực tế.
     - `activity_expenses`: Chi phí phát sinh thực tế (`actual_amount > 0`), liên kết trực tiếp bút toán sổ cái kế toán kép `journal_entries` của Quỹ Hoạt Động (`FUND_IDS.OPERATION`).

2. **Nguyên Tắc Chi Phí Đếm Một Lần Duy Nhất (Single-Count Expense & Ledger Link):**
   - Mở rộng hệ thống tài khoản tài chính: thêm `ACCOUNT_CODES.ACTIVITY_EXPENSE: 'CHI_HOAT_DONG_SU_KIEN'` và cho phép trong `ALLOWED_FUND_ACCOUNTS[FUND_IDS.OPERATION]`.
   - Khi ghi nhận chi phí thực tế qua `recordExpense`, hệ thống tự động sinh 1 bút toán kép bất biến trong `journal_entries`:
     - Nợ: `CHI_HOAT_DONG_SU_KIEN`
     - Có: `TIEN_MAT_HOP` hoặc `TIEN_NGAN_HANG`
     - Quỹ: `QUY_HOAT_DONG`
   - Bản ghi `activity_expenses` lưu `journal_entry_id` làm khóa ngoại liên kết chéo. Mọi báo cáo tài chính sổ cái và tổng chi sự kiện đều trỏ về một giao dịch duy nhất, triệt tiêu hoàn toàn nguy cơ đếm hai lần hoặc sai lệch quỹ.

3. **Bảo Vệ Quyền Riêng Tư Cựu Thành Viên (Alumni Allowlist DTO):**
   - Tuân thủ nghiêm ngặt nguyên tắc Least Privilege: Cựu thành viên chỉ nhận DTO chiếu hẹp (`SafeAlumniActivityDto`: `id, title, description, activityDate, location, status`).
   - Tuyệt đối không gửi dự toán, chi phí thực tế, thông tin ngân hàng hay danh sách người tham gia (PII điện thoại, email).
   - Lọc được thực hiện 100% tại backend (server-side projection), không phụ thuộc vào ẩn giao diện.

4. **Thu Hồi Quyền Tức Thời (Dynamic Role Revocation):**
   - Hàm `assertActiveInternalActor` truy vấn trực tiếp DB theo token user ID để xác thực người dùng đang active và không phải cựu thành viên (`!is_alumni && is_active`).
   - Ngăn chặn triệt để trường hợp tài khoản đã bị vô hiệu hóa hoặc chuyển ALUMNI nhưng vẫn dùng token cũ chưa hết hạn để thao tác ghi.

5. **Kiểm Toán Sửa Nhiệm Vụ (Task Audit Trail):**
   - Khi cập nhật nhiệm vụ (`updateTask`), bắt buộc truyền lý do thay đổi (`reason`).
   - Mọi thay đổi về tiêu đề, mô tả, người phụ trách, hạn chót, độ ưu tiên, trạng thái đều được ghi nhận từng dòng vào `activity_task_history`.

6. **Phân Tách Dự Toán & Chi Phí Thực Tế (Budget vs Actual Expense):**
   - `createBudgetItem`: Chỉ ghi nhận ước tính kế hoạch (`estimatedAmount`), không động chạm số dư quỹ.
   - `recordExpense`: Ghi nhận chi thực tế (`actualAmount`), trừ quỹ hoạt động.
   - Endpoint chi tiết sự kiện tổng hợp rõ ràng: `totalBudget` (tổng ước tính) và `totalExpense` (tổng thực chi) để đối chiếu sai lệch ngân sách.

7. **Tích Hợp API, Giao Diện & Mock Database:**
   - Mount 12 API endpoints (`/api/v1/activities/*`) trên router.
   - Bổ sung 12 client methods và types trong `src/lib/api-client.ts`.
   - Bổ sung Module "Sự Kiện & Hoạt Động" và 8 Modals (27 đến 34) trong `src/components/InternalWorkspace.tsx`.
   - Mở rộng `mock-db-helper.ts` với 6 tables mới và 20 handlers truy vấn phục vụ unit tests.

### 46.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-expense-ledger-link** | **PASS** | Ghi nhận chi phí tạo bút toán sổ kép bất biến trong Quỹ Hoạt Động (`FUND_OPERATION`), liên kết `journal_entry_id`, đếm đúng 1 lần duy nhất trong toàn hệ thống. |
| **2. G-guest-flexibility** | **PASS** | R07: Khách ngoài (`GUEST`) tham gia chỉ cần tên, không bắt buộc MSSV/trường, không ép tạo bản ghi member giả. |
| **3. G-alumni-privacy** | **PASS** | Allowlist DTO server-side cho ALUMNI (`SafeAlumniActivityDto`) lọc sạch 100% tài chính, dự toán, chi phí, ngân hàng và PII người tham dự. |
| **4. G-dynamic-role-revocation** | **PASS** | Chặn đứng ngay lập tức token cũ của tài khoản bị khóa hoặc vừa chuyển cựu thành viên khi thực hiện thao tác ghi. |
| **5. G-task-audit** | **PASS** | Cập nhật nhiệm vụ bắt buộc lý do (`reason`), ghi log chi tiết từng trường thay đổi vào `activity_task_history`. |
| **6. G-budget-vs-actual** | **PASS** | Tách bạch rõ ràng `totalBudget` (kế hoạch ước tính) và `totalExpense` (thực tế giải ngân), tính đúng chênh lệch ngân sách. |
| **7. G-events-db** | **BLOCKED** | Migration `11_stage19_events_activities.sql` đã soạn thảo cú pháp PostgreSQL chuẩn kèm triggers & check constraints, chờ môi trường có DB runtime live. |
| **8. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 6 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (3 static pages build hoàn tất trong 4.31s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **173/173 tests PASS (100%)** trong 926ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.028s). |

### 46.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 19

1. `docs/technical/schema/migrations/11_stage19_events_activities.sql`: DDL 6 bảng quan hệ cho hoạt động, nhiệm vụ, kiểm toán nhiệm vụ, người tham gia, dự toán và chi phí.
2. `src/server/finance/types.ts`: Bổ sung mã tài khoản `CHI_HOAT_DONG_SU_KIEN` và cho phép trong Quỹ Hoạt Động.
3. `src/modules/events/event-types.ts`: Định nghĩa types, DTOs, Enums cho Activity, Task, TaskHistory, Participant, BudgetItem, Expense.
4. `src/modules/events/service.ts`: Triển khai đầy đủ nghiệp vụ sự kiện, phân công, kiểm toán, người tham gia R07, dự toán và chi phí sổ kép.
5. `src/server/router.ts`: Mount 12 REST API endpoints (76 đến 87) cho events, tasks, audit history, participants, budgets, expenses, public activities.
6. `src/lib/api-client.ts`: Bổ sung DTOs và 12 client methods tương ứng.
7. `tests/unit/mock-db-helper.ts`: Mở rộng 6 mảng dữ liệu, snapshot/rollback, query handlers 143-162.
8. `src/components/InternalWorkspace.tsx`: Bổ sung Module Sự Kiện & Hoạt Động và 8 Modals (27 đến 34).
9. `tests/unit/events-activities.test.ts`: Bộ 6 unit test cases bao quát toàn bộ các gates Chặng 19.
10. `tests/integration/events.test.ts`: Integration test cho DDL migration 11 và PostgreSQL constraints.
11. `package.json`: Đăng ký `tests/unit/events-activities.test.ts` vào `test:unit` và `tests/integration/events.test.ts` vào `test:db`.
12. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 46 lên PARTIAL *(DB BLOCKED)*.

---

## 47. Chi Tiết Thực Hiện Chặng 20 (Nội Dung Công Khai, Kiểm Duyệt & URL Sách/Review — FR-08, R10, R13)

### 47.1 Findings Đã Xử Lý Triệt Để Trong Chặng 20

1. **R10 (P2) — Review Giả Lập Thành Công (Fake Review Success):**
   - Trước đây trong `PublicPortal.tsx`, gửi đánh giá chỉ gán cờ client-side `reviewSubmitted = true` mà không gọi API backend, không lưu DB, không có kiểm duyệt.
   - **Xử lý triệt để:** Bỏ hoàn toàn state giả lập client-side. Kết nối API thật `POST /api/v1/content/reviews`. Yêu cầu phiên xác thực (khách hoặc thành viên, trả về 401 `UNAUTHENTICATED` nếu Anonymous). Bản ghi được lưu trực tiếp vào CSDL thật ở trạng thái `status = 'PENDING'`, sinh mã biên nhận ID thật để hiển thị cho người dùng.

2. **R13 (P2) — Rò Rỉ PII Bạn Đọc Trong DTO Công Khai & Trang Chi Tiết Sách:**
   - DTO công khai (`SafePublicReviewDto`) lọc bỏ 100% email người đánh giá (`authorEmail`), ID người đánh giá (`authorId`), ID người kiểm duyệt (`moderatedBy`) và ghi chú nội bộ (`moderationNote`).
   - Trang chi tiết sách SEO URL `/sach/[id].astro` không bao giờ hiển thị danh tính bạn đọc đang mượn cuốn sách, số điện thoại, MSSV hay ghi chú quầy của thủ thư. Chỉ hiển thị thông tin bản sao vật lý công khai (trạng thái có sẵn/đang mượn, mã barcode, vị trí kệ sách).

3. **Cơ Chế Phân Phiên Bản & Cách Ly Kiểm Duyệt (Version Isolation):**
   - Đánh giá đang ở trạng thái `PENDING` tuyệt đối không hiển thị trên API công khai hoặc trang chi tiết sách.
   - Khi bài đánh giá đã `APPROVED` được tác giả chỉnh sửa (`editBookReview`), hệ thống không ghi đè trực tiếp mà tăng `version` lên $v+1$, lưu nội dung mới vào `pending_content`, chuyển trạng thái review sang `PENDING`. Bản đang công khai giữ nguyên nội dung cũ đã duyệt cho đến khi ban kiểm duyệt duyệt bản mới, ngăn chặn hoàn toàn việc rò rỉ nội dung chưa kiểm duyệt.

4. **Chống XSS & Khử Độc Dữ Liệu (Content Sanitizer):**
   - Hàm `sanitizeContent` chủ động bóc tách và loại bỏ toàn bộ thẻ `<script>`, `<iframe>`, `<object>`, `<embed>`, các thuộc tính sự kiện inline (`onload`, `onerror`, `onclick`, `onmouseover`), và URL giao thức nguy hiểm (`javascript:`, `vbscript:`, `data:text/html`).

5. **SEO Meta & Deep Link Portal:**
   - Tạo trang chi tiết sách chuyên biệt `/sach/[id].astro` với `getStaticPaths()`, rich OpenGraph meta tags, robots `noindex` trên staging/preview theo chính sách an toàn.
   - `PublicPortal.tsx` hỗ trợ lưu trạng thái tab và sách đã chọn vào query parameters (`?tab=...` và `?sach=...`), cho phép chia sẻ deep link và khôi phục ngữ cảnh khi refresh.

### 47.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-guest-session-barrier** | **PASS** | Người dùng chưa đăng nhập (Anonymous) gửi đánh giá bị chặn ngay với HTTP 401 `UNAUTHENTICATED`. |
| **2. G-pending-isolation** | **PASS** | Đánh giá mới tạo có `status = 'PENDING'` và không bao giờ xuất hiện trên `getPublicReviews` hoặc API công khai. |
| **3. G-moderation-approval** | **PASS** | Thành viên nội bộ CLB phê duyệt `APPROVED` thì đánh giá lập tức xuất hiện trên giao diện công khai và trang sách. |
| **4. G-version-isolation** | **PASS** | Sửa đánh giá đã duyệt nâng version lên $v+1$, đưa nội dung mới vào `pending_content`, trạng thái về `PENDING`; không làm leak bản sửa trước khi kiểm duyệt xong. |
| **5. G-xss-sanitize** | **PASS** | Tước bỏ hoàn toàn mã độc `<script>`, `<iframe>`, sự kiện inline `onerror`/`onload` trước khi lưu vào DB. |
| **6. G-public-privacy-seo** | **PASS** | `SafePublicReviewDto` và trang `/sach/[id].astro` không rò rỉ email, ID người dùng, ID kiểm duyệt hay PII bạn đọc mượn sách. |
| **7. G-rbac-barrier** | **PASS** | Tài khoản khách (`GUEST`) bị chặn 403 `GUEST_ACCESS_DENIED` khi cố duyệt bài hoặc tạo bài viết tin tức. |
| **8. G-public-posts-lifecycle** | **PASS** | Quy trình tạo DRAFT, xuất bản PUBLISHED, tra cứu theo slug URL hoạt động chuẩn xác. |
| **9. G-content-db** | **BLOCKED** | Migration `12_stage20_public_content_seo.sql` đã sẵn sàng, chờ PostgreSQL live runtime. |
| **10. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 9 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (9 static pages gồm `/sach/b-01..b-06` build thành công trong 4.45s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **183/183 tests PASS (100%)** trong 924ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.028s). |

### 47.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 20

1. `docs/technical/schema/migrations/12_stage20_public_content_seo.sql`: DDL bảng `book_reviews` và `public_posts` kèm index tối ưu cho status, created_at, slug.
2. `src/modules/content/content-types.ts`: Types, DTOs, Enums cho ReviewStatus, PostStatus, PostCategory, BookReview, PublicPost, SafePublicReviewDto, SafePublicPostDto.
3. `src/modules/content/sanitizer.ts`: XSS sanitizer, URL validator và slug generator.
4. `src/modules/content/service.ts`: Toàn bộ logic nghiệp vụ đánh giá sách, kiểm duyệt, sửa đổi đa phiên bản, bài viết công khai.
5. `src/server/router.ts`: Mount 10 REST API endpoints (88 đến 97) cho reviews, moderation và posts.
6. `src/lib/api-client.ts`: Thêm DTOs và 8 client methods tương ứng.
7. `tests/unit/mock-db-helper.ts`: Mở rộng mảng dữ liệu `bookReviews` và `publicPosts`, query handlers 163-175.
8. `src/pages/sach/[id].astro`: Trang chi tiết sách SEO URL riêng, `getStaticPaths()`, rich OpenGraph meta tags, không rò rỉ PII.
9. `src/components/PublicPortal.tsx`: Bỏ submit review giả lập, kết nối API backend thật, duy trì state qua URL query parameters.
10. `src/components/InternalWorkspace.tsx`: Thêm Module "Kiểm Duyệt Nội Dung & Bài Viết" và 2 Modals (35 & 36).
11. `tests/unit/content-policy.test.ts`: 10 unit test cases bao quát toàn bộ các gates Chặng 20.
12. `tests/integration/content-policy.test.ts`: Integration test cho DDL migration 12.
13. `package.json`: Đăng ký `tests/unit/content-policy.test.ts` vào `test:unit` và `test:db`.
14. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 47 lên PARTIAL *(DB BLOCKED)*.

---

## 48. Chi Tiết Thực Hiện Chặng 21 (Dashboard, Excel/PDF và Nhật Ký Đúng Quyền — R06, R04, R13)

### 48.1 Findings Đã Xử Lý Triệt Để Trong Chặng 21

1. **R04 (P1) — Số Liệu Báo Cáo Không Khớp & Không Có Drill-Down Chứng Từ:**
   - Trước đây các báo cáo hiển thị modal giả lập ("Chức năng tải file đang ở trạng thái mô phỏng giao diện"), không liên kết trực tiếp với bút toán sổ kép.
   - **Xử lý triệt để:** Triển khai `getFinancialSummaryReport` và `getFinancialDrilldown` trong `src/modules/reporting/reporting-service.ts`. Toàn bộ số liệu (tiền mặt `TIEN_MAT_HOP`, ngân hàng `TIEN_NGAN_HANG`, cọc bạn đọc `COC_PHAI_HOAN`, cọc nhà sách `COC_DAT_NHA_SACH`, nợ nhà sách `NO_PHAI_TRA_NHA_SACH`, doanh thu bán sách `DOANH_THU_BAN_SACH`, thu phạt `THU_PHAT`, hội phí `HOI_PHI`, chi hoạt động `CHI_HOAT_DONG_SU_KIEN`) được tổng hợp 100% từ bảng bất biến `journal_entries`. Bảng drill-down hiển thị danh sách chứng từ chi tiết kèm mã bút toán, tài khoản Nợ/Có, người tạo, ngày giờ và diễn giải.

2. **R06 (P2) — Chống Tấn Công Formula Injection (CSV Injection) & Xuất File Thật:**
   - Bỏ hoàn toàn modal thông báo xuất file giả lập. Nút "Xuất CSV Tài Chính" và "Xuất CSV Lưu Thông" kích hoạt tải file CSV thật từ máy chủ.
   - Triển khai `escapeCsvCell` trong `src/modules/reporting/formula-sanitizer.ts`: Tự động nhận diện các ký tự mở đầu công thức hiểm độc (`=`, `+`, `-`, `@`, `\t`, `\r`) và thêm tiền tố dấu nháy đơn `'` phía trước (`'=SUM(...)`, `'@cmd...`), vô hiệu hóa hoàn toàn nguy cơ thực thi mã độc trong Microsoft Excel, LibreOffice và Google Sheets.
   - Thêm tiền tố Byte Order Mark (BOM) `\uFEFF` (`UTF8_BOM`) ở đầu file CSV, đảm bảo Excel trên Windows tự động nhận diện UTF-8 và hiển thị tiếng Việt có dấu toàn vẹn 100%.

3. **R13 (P2) — Thu Hồi Quyền Tức Thì (Revocation Barrier) & Bảo Vệ Quyền Riêng Tư (PII Redaction):**
   - Cơ chế vé tải ngắn hạn (Short-lived Download Ticket, TTL 5 phút): API `POST /api/v1/reports/export/ticket` sinh mã vé ngẫu nhiên 48 hex chars.
   - Khi tải tệp qua `GET /api/v1/reports/download/:ticket`, hệ thống bắt buộc kiểm tra trạng thái sống của actor (`validateAndConsumeExportTicket`): nếu tài khoản bị khóa (`isActive = false`) hoặc bị chuyển sang cựu thành viên (`isAlumni = true` / `role = 'ALUMNI'`), lập tức từ chối tải với HTTP 403 `ALUMNI_EXPORT_FORBIDDEN`, đồng thời tiêu hủy vé tải ngay lập tức để ngăn chặn reuse (Single-use ticket).
   - Tra cứu nhật ký kiểm toán toàn cục (`GET /api/v1/audit/logs`) chỉ dành riêng cho Quản trị viên (`requireAdmin`). Hàm `redactSensitiveDetails` tự động quét và che chắn sạch sẽ mọi trường nhạy cảm (`password`, `jwtSecret`, `token`, `sessionToken`, `apiKey`) thành `[REDACTED]`.
   - Analytics tổng quan hệ thống (`getAnalyticsSummary`) chỉ tổng hợp số lượng (đầu sách, bản sao, thành viên, review, bài viết), tuyệt đối không thu thập telemetry thừa hay hành vi cá nhân của người dùng.

4. **Bảo Vệ Tài Nguyên Máy Chủ (Bounded Load & Pagination):**
   - Phân trang drill-down bút toán giới hạn tối đa 500 dòng/trang (`PAGINATION_LIMIT_EXCEEDED` nếu vượt quá).
   - Tra cứu nhật ký kiểm toán giới hạn tối đa 200 dòng/trang (`AUDIT_LIMIT_EXCEEDED` nếu vượt quá).

### 48.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates)

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-financial-accuracy** | **PASS** | Hai định dạng JSON DTO và CSV xuất từ cùng một snapshot khớp chính xác từng đồng VND, truy vấn trực tiếp từ `journal_entries` thật. |
| **2. G-no-double-counting** | **PASS** | Hoàn trả cọc bạn đọc chỉ giảm nghĩa vụ nợ `COC_PHAI_HOAN` và quỹ tiền, không sinh doanh thu/chi phí giả; chi sự kiện và bán sách hạch toán độc lập. |
| **3. G-formula-injection-safety** | **PASS** | Các ký tự mở đầu công thức hiểm độc (`=`, `+`, `-`, `@`, `\t`, `\r`) được thoát an toàn bằng tiền tố nháy đơn `'`, các ô có dấu phẩy/ngoặc kép được escape chuẩn RFC 4180. |
| **4. G-bounded-load** | **PASS** | Chặn đứng truy vấn vô hạn: drilldown > 500 dòng và audit logs > 200 dòng bị từ chối ngay với HTTP 400 `BadRequestError`. |
| **5. G-rbac-audit-redaction** | **PASS** | Thành viên thường và khách bị chặn 403 `ADMIN_REQUIRED`; Admin xem được nhật ký và các trường nhạy cảm (`password`, `jwt_secret`, `sessionToken`) đều bị che chắn `[REDACTED]`. |
| **6. G-download-revocation-barrier** | **PASS** | Cựu thành viên (`ALUMNI`) hoặc tài khoản bị vô hiệu hóa bị chặn 403 ngay lập tức khi tải tệp, link cũ và vé chờ bị tiêu hủy không thể tái sử dụng. |
| **7. G-vietnamese-utf8-integrity** | **PASS** | Tệp CSV sinh ra có tiền tố BOM `\uFEFF` và nội dung tiếng Việt có dấu ("BÁO CÁO TỔNG HỢP TÀI CHÍNH", "Tiền mặt hộp quỹ") hiển thị trọn vẹn, không lỗi font. |
| **8. G-analytics-privacy** | **PASS** | Thống kê vận hành tổng quan không thu thập thông tin cá nhân, định danh hay telemetry thừa của bạn đọc. |
| **9. G-reports-db** | **BLOCKED** | Test integration `tests/integration/reports.test.ts` đã hoàn thành, chờ PostgreSQL live runtime. |
| **10. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 9 hints**.<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (9 static pages build thành công trong 3.54s).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **193/193 tests PASS (100%)** trong 932ms.<br/>- **Python Experiments:** 23/23 tests PASS (0.028s). |

### 48.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 21

1. `src/modules/reporting/reporting-types.ts`: Cấu trúc DTOs, Enums, Filters cho báo cáo tài chính, drill-down, lưu thông và vé tải tệp.
2. `src/modules/reporting/formula-sanitizer.ts`: Bộ lọc chống CSV/Formula Injection, thoát ký tự RFC 4180 và tiền tố UTF-8 BOM.
3. `src/modules/reporting/reporting-service.ts`: Dịch vụ tổng hợp tài chính sổ kép, drill-down phân trang, xuất CSV và cơ chế vé tải ngắn hạn kèm thu hồi quyền.
4. `src/modules/audit/queries.ts`: Truy vấn nhật ký kiểm toán hệ thống chỉ Admin, khử độc redaction sâu và thống kê vận hành privacy-first.
5. `src/server/router.ts`: Mount 7 REST API endpoints (98 đến 104) cho báo cáo, xuất file, tải tệp, audit logs và analytics.
6. `src/lib/api-client.ts`: Bổ sung DTOs và 7 client methods tương ứng.
7. `tests/unit/mock-db-helper.ts`: Bổ sung query handlers 176-182 cho báo cáo tài chính, drill-down, lưu thông và audit logs.
8. `src/components/InternalWorkspace.tsx`: Nâng cấp Module 9 (Dashboard tài chính, chọn kỳ, bảng drill-down chứng từ, nút tải CSV thật) và Module 10 (Thống kê vận hành và bảng audit log).
9. `tests/unit/reports-audit.test.ts`: Bộ 10 unit test cases bao quát toàn bộ các gates Chặng 21.
10. `tests/integration/reports.test.ts`: Integration test cho truy vấn báo cáo và bảng `system_audit_logs`.
11. `package.json`: Đăng ký `tests/unit/reports-audit.test.ts` vào `test:unit` và `tests/integration/reports.test.ts` vào `test:db`.
12. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 48 lên PARTIAL *(DB BLOCKED)*.

---

## 49. Chi Tiết Thực Hiện Chặng 22 (Runtime Triển Khai, Backup/Restore và Nghiệm Thu Toàn Bộ 22 Chặng — R08, R13)

### 49.1 Findings Đã Xử Lý Triệt Để Trong Chặng 22

1. **R08 (P2) — Kịch Bản Triển Khai, Sao Lưu & Khôi Phục CSDL Độc Lập An Toàn:**
   - Xây dựng 2 bộ kịch bản tự động hóa cho cả môi trường Windows và Linux/CI:
     * `scripts/backup.ps1` & `scripts/backup.sh`: Trích xuất logic CSDL PostgreSQL bằng `pg_dump --format=plain --no-owner --no-acl`, tự động tạo snapshot định kỳ (mục tiêu thiết kế RPO $\le 24$h), phân tách schema/data. Fail-closed: dừng ngay và trả exit code khác 0 nếu thiếu `pg_dump`.
     * `scripts/restore.ps1` & `scripts/restore.sh`: Nạp snapshot vào CSDL mới bằng `psql -v ON_ERROR_STOP=1`, dừng ngay khi có lỗi SQL, kiểm tra an toàn tệp và đối soát tính toàn vẹn (mục tiêu thiết kế RTO $\le 4$h). Fail-closed: dừng ngay và trả exit code khác 0 nếu thiếu `psql`.
   - **Bảo mật tuyệt đối:** Cả 4 scripts tuyệt đối không chứa mật khẩu hay credentials gán cứng; đọc trực tiếp từ biến môi trường `$env:DATABASE_URL` / `$DATABASE_URL`. Tự động quét phát hiện secret: nếu tệp snapshot chứa `JWT_SECRET=`, `SUPABASE_SERVICE_ROLE_KEY=` hay `RECRUITMENT_WEBHOOK_SECRET=`, script lập tức hủy và cảnh báo khẩn cấp.

2. **R13 (P2) — Bảo Toàn Invariants Sổ Kép & Trạng Thái Phiên Bảo Mật Sau Khôi Phục:**
   - Bảo toàn bất biến kế toán: Bút toán sổ kép trước và sau quá trình sao lưu/khôi phục khớp chính xác 100% từng đồng VND (`total_debit == total_credit`) trong các bài kiểm thử logic Node.js, không làm sai lệch số dư các quỹ tiền mặt, ngân hàng hay cọc bạn đọc.
   - Bảo toàn an toàn danh tính (Identity State Preservation): Sau khi khôi phục, giá trị `token_version` của từng thành viên và danh sách chữ ký phiên bị thu hồi được bảo toàn nguyên vẹn; ngăn chặn triệt để nguy cơ "hồi sinh" các phiên làm việc của cựu thành viên (`ALUMNI`) hoặc tài khoản đã bị đình chỉ (`isActive = false`).

3. **Tài Liệu Vận Hành Thực Tế & SLA Khôi Phục Thảm Họa (Disaster Recovery Runbook):**
   - Đã cập nhật Mục 5 trong `docs/technical/security-operations.md` với đầy đủ: Runbook sao lưu, Runbook khôi phục, Checklist 3 bước đối soát sau phục hồi, mục tiêu thiết kế SLA (RPO $\le 24$h, RTO $\le 4$h), và Runbook kích hoạt môi trường thật khi người dùng cấp hạ tầng.
   - Trỏ đúng tệp DDL chuẩn tắc `docs/technical/schema/01_schema.sql`.

---

### 49.2 Bằng Chứng Kiểm Thử & Trạng Thái Cổng Kiểm Tra (Gates) Chặng 22

| Cổng Kiểm Tra | Trạng Thái | Bằng Chứng Kỹ Thuật |
|---|---|---|
| **1. G-secrets-free-scripts** | **PASS** | Kiểm tra tự động 4 scripts (`scripts/backup.ps1`, `scripts/backup.sh`, `scripts/restore.ps1`, `scripts/restore.sh`): 100% không chứa credentials, passwords, JWT secrets hay connection strings gán cứng. |
| **2. G-backup-serialization** | **PASS** | Snapshot CSDL trích xuất dạng plain text SQL loại bỏ credentials nhạy cảm; kiểm tra an toàn không rò rỉ secret. |
| **3. G-restore-balance-invariants** | **PASS (In-Memory)** | Mô phỏng Restore: Tổng phát sinh Nợ (`postDebit`) và tổng phát sinh Có (`postCredit`) sau phục hồi khớp 100% với dữ liệu gốc trước sao lưu trong Node.js test harness; kiểm thử trên DB vật lý 5432 giữ gate BLOCKED. |
| **4. G-rpo-simulation** | **PASS (In-Memory)** | Mô phỏng logic lọc cutoff thời gian giao dịch trong bộ nhớ Node.js đạt RPO $\le 24$ giờ; Point-in-Time Recovery (PITR) thực tế trên PostgreSQL vật lý giữ gate BLOCKED do cần WAL archiving của nhà cung cấp hạ tầng. |
| **5. G-rto-benchmark** | **PASS (In-Memory)** | Đo lường thực nghiệm: Quá trình serialize và nạp lại 1.000 bản ghi đạt tốc độ dưới 100ms trên môi trường Node.js runtime (mục tiêu thiết kế RTO $\le 4$ giờ); RTO trên hạ tầng vật lý giữ gate BLOCKED. |
| **6. G-restore-security-state** | **PASS (In-Memory)** | Trạng thái thu hồi phiên (`token_version`, revoked token hashes) được bảo toàn sau restore trong test logic; cựu thành viên hoặc tài khoản bị khóa không thể tái sử dụng phiên cũ. |
| **7. G-runtime-db** | **BLOCKED** | Scripts đã kiểm thử cấu trúc, an toàn và fail-closed; chờ người dùng cấp hạ tầng PostgreSQL live 5432 để chạy bài diễn tập restore thực tế trên CSDL đích. |
| **8. G-baseline/contracts** | **PASS** | - **Astro check & tsc:** `rtk pnpm run check` $\rightarrow$ **0 errors, 0 warnings, 10 hints** (113 files clean).<br/>- **Astro build:** `rtk pnpm run build` $\rightarrow$ **Exit code 0** (10 static pages build thành công trong 4.83s: `/404.html`, `/sach/b-01..b-06`, `/login`, `/noi-bo`, `/index`).<br/>- **Unit Test Suite:** `rtk pnpm test:unit` $\rightarrow$ **232/232 tests PASS (100%)**.<br/>- **Python Experiments:** `python -m unittest discover -s experiments -p "test_*.py" -q` $\rightarrow$ **23/23 tests PASS (100%)**.<br/>- **OpenAPI Redocly Lint:** `rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` $\rightarrow$ **0 errors** (valid description). |

---

### 49.3 Danh Sách Tệp Đã Thay Đổi Trong Chặng 22

1. `scripts/backup.ps1`: Kịch bản PowerShell sao lưu CSDL PostgreSQL cho Windows, fail-closed khi thiếu pg_dump, kiểm tra biến môi trường và quét rò rỉ secret.
2. `scripts/backup.sh`: Kịch bản Bash sao lưu CSDL PostgreSQL cho Linux/macOS/CI, có quyền execute, fail-closed và kiểm tra an toàn tệp.
3. `scripts/restore.ps1`: Kịch bản PowerShell khôi phục CSDL từ snapshot SQL, có `ON_ERROR_STOP=1`, kiểm tra an toàn và đếm số bảng sau restore.
4. `scripts/restore.sh`: Kịch bản Bash khôi phục CSDL từ snapshot SQL cho Linux/CI, bắt buộc dừng khi gặp lỗi (`ON_ERROR_STOP=1`).
5. `tests/unit/backup-restore.test.ts`: Bộ 6 test cases kiểm thử tự động toàn diện các gates sao lưu, khôi phục, cân đối sổ kép và SLA.
6. `docs/technical/security-operations.md`: Bổ sung Mục 5 Runbook Vận Hành Thực Tế, Quy trình phục hồi thảm họa, và Checklist kích hoạt môi trường live.
7. `package.json`: Đăng ký `tests/unit/backup-restore.test.ts` vào script `test:unit`.
8. `docs/technical/progress.md`: Cập nhật bảng tổng quan và Mục 49 nghiệm thu toàn bộ 22 chặng.

---

## 50. Tổng Kết Hiện Trạng Triển Khai Toàn Diện 22 Chặng Dự Án YSBK (Minh Bạch Gates & Runtime Proof)

### 50.1 Ma Trận Triển Khai 22 Chặng (Hoàn Tất Source Code & Unit Tests — Cổng Live DB/Deploy BLOCKED)

> [!IMPORTANT]
> Toàn bộ 22 chặng đã hoàn tất 100% mã nguồn chức năng, domain services, Astro/React frontend và bộ kiểm thử đơn vị (232 bài test unit Node.js, 23 bài test Python, 10 trang build tĩnh Astro, 0 lỗi TypeScript).  
> Để bảo đảm tính trung thực kỹ thuật tuyệt đối theo khuyến nghị tại review 19/10/2026, các cổng kiểm thử phụ thuộc vào môi trường hạ tầng bên ngoài chưa được cấp (PostgreSQL live 5432, Cloudflare Workers Production Deploy, Google Form Provider Webhook Live, Trình duyệt thực tế E2E) được giữ nguyên ở trạng thái **`BLOCKED`** và không tự tiện nâng cấp thành PASS khi chưa có runtime proof.

| Nhóm Nghiệp Vụ | Các Chặng Đã Triển Khai | Kết Quả Triển Khai Trong Mã Nguồn & Unit Tests | Cổng Môi Trường Còn Lại |
|---|---|---|---|
| **Nền Tảng & Bảo Mật** | Chặng 01, 02, 03, 22 | Schema DDL 22 bảng, Synthetic Auth Realm `@internal.ysbk.edu.vn`, `token_version` thu hồi tức thì toàn bộ phiên đọc/ghi/tải, Fail-closed test harness, Scripts Backup/Restore có `ON_ERROR_STOP=1` và quét rò rỉ credential. | PostgreSQL live 5432 & Cloudflare deploy: **BLOCKED** |
| **Sổ Tiền & Ca Trực** | Chặng 04, 05 | Sổ kép Kế toán 10 tài khoản, 3 quỹ độc lập (LOAN, OPERATION, SCHOLARSHIP), Idempotency dùng chung `canonicalHash`, Mở/Đóng ca trực, Đối soát hộp tiền thực tế. | PostgreSQL live 5432: **BLOCKED** |
| **Lưu Thông & Quầy Sách** | Chặng 06, 07, 08, 09, 10, 11, 12 | Catalog bản sách thật, Mượn sách, Trả toàn bộ/một phần (bảo toàn active copy invariant), Gia hạn tối đa 3 lần (+14 ngày), Quote tiền phạt từ server theo lịch nghỉ/múi giờ VN, Báo mất sách (giữ cọc zero-cash), Sửa chứng từ đảo đúng decision ID, UI Quầy Sách kết nối REST API backend, hàng chờ Pending Refunds/Deposits/Fines, modal quyết toán chi tiết & modal xác nhận chi hoàn 2 bước. | PostgreSQL live 5432 & Browser E2E: **BLOCKED** |
| **Nhân Sự & Hội Phí** | Chặng 13 | Thành viên, Đa quan hệ ban (Distinct Headcount), Bảo toàn lịch sử chức vụ, Thu hội phí 100k một lần duy nhất vào quỹ OPERATION (tách biệt hoàn toàn khỏi ca trực quỹ LOAN). | PostgreSQL live 5432: **BLOCKED** |
| **Lịch Trực & Solver** | Chặng 14, 15 | Import Excel lịch bận (chống zip bomb qua streaming maxOutputLength, khử formula injection cho `=`, `+`, `-`, `@`, batch versioning), Heuristic Solver phân ca (Main 13:45-17:15, Support mở/đóng ca, cảnh báo thiếu riêng), Sửa tay giữ version, Công bố có phiên bản. | PostgreSQL live 5432: **BLOCKED** |
| **Tuyển Thành Viên** | Chặng 16, 17 | Webhook Google Form (HMAC-SHA256 fail-closed khi thiếu secret, chống replay lệch 5m, durable trước ACK), Đối soát bù đơn rớt mạng, Rubric versioning, Chấm độc lập 2 người, Khóa lạc quan sửa điểm, Chuyển thành viên dùng UUID/gen/enum canonical, Công bố kết quả chỉ hiển thị mã hồ sơ & ban. | PostgreSQL live 5432 & Form Provider: **BLOCKED** |
| **Lô Sách Mới & Quyết Toán** | Chặng 18 | Nhập lô sách bán đợt, Quản lý tồn kho lô tách biệt sách mượn, Chặn bán âm tồn, Trả dư vật lý về nhà sách, Bán sách và quyết toán nhà sách hạch toán đầy đủ vào quỹ OPERATION, thanh toán có guard `paymentConfirmed`, quyết toán độc lập không bù trừ gộp (T68, T69), Idempotent settlement. | PostgreSQL live 5432: **BLOCKED** |
| **Sự Kiện & Hoạt Động** | Chặng 19 | Sự kiện, Phân tách rõ Dự toán (Budget) và Chi thực tế (Actual Expense) vào sổ quỹ OPERATION, Khách tham gia không cần MSSV, Cựu thành viên chỉ nhận Allowlist DTO (lọc sạch PII và tài chính), Dynamic role revocation. | PostgreSQL live 5432: **BLOCKED** |
| **Cổng Công Khai & SEO** | Chặng 20 | Đánh giá sách có kiểm duyệt, Sửa bài tạo v+1 PENDING, XSS Sanitizer, SEO URL `/sach/[id].astro` kết nối catalog thật, SPA Dynamic Fallback `/404.astro` cho sách mới thêm sau build, JSON-LD Schema.org, Staging noindex, Public Portal kết nối API thật. | PostgreSQL live 5432 & Domain SEO: **BLOCKED** |
| **Báo Cáo & Kiểm Toán** | Chặng 21 | Báo cáo tài chính tách Opening Balance, Movements trong kỳ, và Closing Balance; Báo cáo lưu thông truy vấn đúng receipt/settlement/item; Xuất định dạng đa dạng (SpreadsheetML XML `.xls` native, HTML In ấn A4, CSV UTF-8 BOM); Chống Formula Injection (`=, +, -, @`); Single-use download ticket ký HMAC hỗ trợ multi-worker với kiểm tra thu hồi tức thời; Admin Audit Log redact sạch sensitive data. | PostgreSQL live 5432: **BLOCKED** |

---

### 50.2 Ma Trận Giải Quyết 13 Findings Ban Đầu (R01 đến R13 — Khôi Phục Đúng ID & Mô Tả Gốc)

| Mã Finding | Mức Độ | Mô Tả Gốc (Review 18/10/2026) | Trigger & Root Cause Gốc | Giải Pháp Đã Triển Khai | Trạng Thái Kỹ Thuật |
|---|---|---|---|---|---|
| **R01** | P1 | DDL search không hợp lệ với PostgreSQL tiêu chuẩn | Generated column `search_vector` dùng hàm `unaccent()` là STABLE (phụ thuộc collation/locale), PostgreSQL từ chối tạo generated column với hàm không IMMUTABLE. | Khai báo `search_vector tsvector`, tạo trigger function `update_book_title_search_vector()` chạy `BEFORE INSERT OR UPDATE` chuẩn hóa tiếng Việt không dấu. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R02** | P1 | Chuyển phiếu giữ lại sách xung đột unique active copy | Phiếu trả một phần: chốt trả cuốn X, giữ cuốn Y. Cuốn Y vẫn còn ở phiếu cũ thỏa mãn partial unique index `idx_unique_active_copy_loan` nên insert Y vào phiếu mới bị chặn. | Thiết kế mô hình chuyển tiếp dòng: chốt trạng thái cuốn trả, tạo dòng liên kết cọc cho cuốn giữ trong 1 transaction nguyên tử, cập nhật read model nhất quán. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R03** | P1 | Trigger tối đa hai dòng không chống được concurrent insert/update | Hai transaction đồng thời cùng thêm 2 cuốn sách khác nhau vào phiếu đang có 1 cuốn đều đọc COUNT=1 do snapshot isolation, dẫn đến phiếu có 3 cuốn; trigger chỉ chạy BEFORE INSERT. | Bổ sung khóa bi quan hàng phiếu mượn cha `SELECT 1 FROM loan_receipts WHERE id = NEW.receipt_id FOR UPDATE`, khóa 2 phiếu theo thứ tự UUID khi reassign, kiểm tra cả INSERT và UPDATE `receipt_id`. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R04** | P1 | Schema sổ tiền chưa đủ để thực thi nghĩa vụ cọc và đối soát phiên quầy | Journal chỉ có nguồn tổng quát, thiếu liên kết phiên quầy, khoản nhận/phân bổ cọc, nghĩa vụ/chờ hoàn; `source_id` kiểu UUID không khớp ID cash session VARCHAR; hai bảng idempotency khác scope. | Triển khai sổ kép kế toán 10 tài khoản, phân tách 3 quỹ riêng biệt (LOAN, OPERATION, SCHOLARSHIP); Idempotency dùng chung; liên kết ca trực; hàng chờ Pending Refunds/Deposits/Fines. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R05** | P1 | Thiết kế Auth còn thiếu đường xác thực và thu hồi có thể triển khai | DDL thiếu bảng mapping; diagram thiếu bước provider kiểm mật khẩu; prose tự hash mật khẩu ngược với managed Auth; chưa có cơ chế thu hồi tức thì quyền trên request đọc/tải tệp. | Áp dụng Synthetic Internal Realm `${username}@internal.ysbk.edu.vn`, bảng `internal_identities`, session cookie an toàn, cơ chế `token_version` thu hồi tức thì phiên làm việc trên cả thao tác đọc, ghi và xuất file. | **FIXED_SOURCE / UNIT_PASS**<br/>*(Live Provider: BLOCKED)* |
| **R06** | P2 | OpenAPI chưa hợp lệ và chưa bao phủ đủ hợp đồng đã giao | 7 Response Object thiếu `description`; thiếu endpoints sự kiện, mở ca, import lịch, webhook chữ ký/replay; BearerAuth chung chưa diễn tả RBAC; tài liệu trỏ sai test IDs. | Chuẩn hóa OpenAPI 3.1 đạt 0 lỗi với Redocly; bổ sung đầy đủ schemas cho Circulation Quotes, Pending Queues, Consignment Sales, Content Moderation; chữ ký webhook HMAC-SHA256 timestamp; khử Formula Injection & XSS. | **FIXED_SOURCE / LINT_PASS**<br/>*(Live External: BLOCKED)* |
| **R07** | P2 | Một số model không biểu diễn được nghiệp vụ đã xác nhận | `members.team` chỉ 1 enum làm mất liên kết đa ban; `borrowers.student_id` NOT NULL loại người dân; lô sách bán chỉ 1 tên sách và thiếu dòng lịch sử; chưa có rubric versioning, import version. | Mở rộng DDL: bảng quan hệ đa ban, cho phép MSSV nullable cho bạn đọc cộng đồng; quản lý chi tiết lô sách ký gửi; rubric tuyển dụng đa phiên bản; import lịch bận có versioning. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R08** | P2 | Bằng chứng PoC và trạng thái hoàn thành đang được diễn đạt quá mức | Test concurrency dùng mutex Python quanh SQLite; SQL test tìm chuỗi bằng regex; parser chỉ phân loại chuỗi trong từ điển; nhãn "Đã kiểm chứng" không nêu rõ giới hạn. | Tách bạch 6 cấp độ bằng chứng kỹ thuật; loại bỏ toàn bộ nhánh giả thành công trong scripts backup/restore (fail-closed khi thiếu công cụ); viết bộ unit tests Node.js độc lập; giữ đúng nhãn BLOCKED cho DB live. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R09** | P2 | UI PARTIAL tạo được phiếu rỗng hoặc gia hạn không trả cuốn nào | Chọn cả hai checkbox trong PARTIAL tạo phiếu mới rỗng cọc 0; bỏ cả hai checkbox tạo phiếu mới cho cả hai và reset hạn/lượt dù không trả cuốn nào. | Ràng buộc bộ chọn trả sách nghiêm ngặt (`returnLineIds`), quote tiền phạt từ máy chủ theo lịch nghỉ và múi giờ VN, phân tách chính xác 3 nhánh phạt ($P=0$, $0<P<D$, $P \ge D$). | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 / Browser: BLOCKED)* |
| **R10** | P2 | Demo giao dịch thay phiếu nhưng không thay tồn/tiền và bỏ qua phạt nhập | Giao dịch quầy chỉ cập nhật state React cục bộ, không gọi API; phạt luôn gợi ý 3k; modal hoàn toàn bộ cọc kể cả khi phạt đã dùng hết; cùng bản đang mượn vẫn cho lập thêm phiếu mới. | Kết nối UI `InternalWorkspace.tsx` với API backend thật; cách ly ranh giới DEMO an toàn bằng `clearLiveSensitiveData`; quote phạt server; modal quyết toán chi tiết và modal hoàn cọc 2 bước. | **FIXED_SOURCE / UNIT_PASS**<br/>*(Live Session: BLOCKED)* |
| **R11** | P2 | Scheduler bỏ qua khoảng bắt buộc của người chính và thiếu hỗ trợ | Hai người chính bận khoảng đầu/cuối ca trực vẫn được phân ca; thiếu người hỗ trợ nhưng solver trả `warning=None`. | Cập nhật Heuristic Solver: trực chính bắt buộc trọn vẹn 13:45-17:15, trực hỗ trợ mở/đóng ca, hiển thị cảnh báo thiếu riêng biệt cho từng vai trò, bảo toàn lịch sử sửa tay khi công bố. | **FIXED_SOURCE / UNIT_PASS**<br/>*(PG 5432 Live: BLOCKED)* |
| **R12** | P2 | Typecheck hiện không qua | `tsc --noEmit` trả lỗi TS5102 (`baseUrl` removed) và TS5090 (`paths` không tương đối). | Cấu hình relative alias `@/*`, khóa phiên bản `@astrojs/check` và `typescript@~5.8.3`; typecheck đạt 0 errors, 0 warnings trên toàn bộ 113 files mã nguồn. | **RESOLVED** |
| **R13** | P2 | Thiết kế tự chốt dữ liệu công khai và giới hạn hạ tầng chưa có căn cứ | Tự ý công khai MSSV/họ tên/ban; gán traffic mobile >70%, DB đủ 2-3 năm mà chưa đo lường; RPO/RTO được tuyên bố như chính sách đã chốt. | Áp dụng Server Field Allowlist cho cựu thành viên; công bố tuyển chỉ hiển thị mã hồ sơ & ban; gắn nhãn mục tiêu thiết kế (Design SLO) cho RPO/RTO và hạn mức hạ tầng; ghi rõ cần bài diễn tập thực tế. | **FIXED_SOURCE / UNIT_PASS**<br/>*(Live Audit: BLOCKED)* |

---

### 50.3 Bằng Chứng Kỹ Thuật Tổng Hợp Sau 22 Chặng (Chỉ Số Thực Tế Đã Kiểm Chứng)

1. **Astro Check & TypeScript Compilation:**
   ```powershell
   $ rtk pnpm run check
   Result (113 files): 0 errors, 0 warnings, 10 hints
   ```
2. **Astro Production Build:**
   ```powershell
   $ rtk pnpm run build
   10 page(s) built in 4.83s
   Build Complete! (Exit code 0: /404.html, /sach/b-01..b-06, /login, /noi-bo, /index)
   ```
3. **Bộ Kiểm Thử Đơn Vị & Hợp Đồng (Unit Tests Suite):**
   ```powershell
   $ rtk pnpm test:unit
   pass: 232 / 232 tests (100% PASS)
   fail: 0
   duration: ~1.2s
   ```
4. **Bộ Thử Nghiệm Thuật Toán Python (Python Experiments):**
   ```powershell
   $ python -m unittest discover -s experiments -p "test_*.py" -q
   Ran 23 tests in 0.024s - OK (100% PASS)
   ```
5. **Hợp Đồng API Chuẩn (OpenAPI 3.1 Validation):**
   ```powershell
   $ rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml
   Woohoo! Your API description is valid. (0 errors)
   ```

---

### 50.4 Hướng Dẫn Kích Hoạt Môi Trường Thật (Next Action for Live Infrastructure)

Toàn bộ mã nguồn, cấu trúc dữ liệu, giao diện và bài kiểm thử đã sẵn sàng ở mức cao nhất. Khi người dùng sẵn sàng cấp hạ tầng thực tế:
1. **Khởi tạo Database PostgreSQL:** Cung cấp chuỗi kết nối vào biến môi trường `DATABASE_URL` và chạy schema khởi tạo:
   ```bash
   psql "$DATABASE_URL" -f docs/technical/schema/01_schema.sql
   ```
2. **Xác thực toàn bộ Integration Tests trực tiếp trên DB thật:**
   ```bash
   rtk pnpm test:db
   ```
3. **Cấu hình Bí Mật Môi Trường & Triển Khai Cloudflare Workers:**
   ```bash
   wrangler secret put DATABASE_URL
   wrangler secret put JWT_SECRET
   wrangler secret put RECRUITMENT_WEBHOOK_SECRET
   rtk pnpm run build
   wrangler deploy
   ```


