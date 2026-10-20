# Review sau chặng 22 — 19/10/2026

## Kết luận

**PARTIAL; chưa đủ điều kiện nghiệm thu hoặc dùng với tiền/dữ liệu thật.** Antigravity đã thêm nhiều domain service, route, migration và UI cho chặng 13–22. Tuy nhiên, còn lỗi xác thực webhook, giới hạn giải nén, hợp đồng API, schema, sổ tiền và phục hồi. Tuyên bố “100% hoàn tất” trong progress chưa đúng với trạng thái code và bằng chứng hiện có.

Review tập trung thay đổi sau review12, các caller liên quan và S12-01..10. Không sửa implementation, cấu hình hay prompt; không commit/deploy, không gọi provider/DB thật. Workspace không có `.git`; snapshot trước review gồm **169 file**, lưu tại `.review-artifacts/post22-review-manifest.json`. Kết quả dưới đây tách rõ source, unit/double và runtime. Đây không phải kiểm thử xâm nhập hay chứng nhận toàn hệ thống an toàn.

## Findings mới

### P22-01 — P1: Thiếu cấu hình webhook vẫn xác thực bằng khóa công khai trong source

**Vị trí:** `src/modules/recruitment/ingest-form.ts:21,35–98`; `src/server/router.ts:2096–2137`.

Route nhận Google Form là public. Khi thiếu `RECRUITMENT_WEBHOOK_SECRET`, verifier dùng `DEFAULT_WEBHOOK_SECRET` cố định trong source và chấp nhận header shared secret tương ứng. Người biết source có thể vượt bước xác thực và gửi đơn giả vào pipeline ingest của môi trường thiếu cấu hình.

**Bằng chứng:** probe gọi chính verifier, bỏ env secret và dùng khóa mặc định cùng timestamp hiện tại: được chấp nhận. Không gửi request ra ngoài. Chưa chứng minh đọc dữ liệu hoặc thực thi mã từ lỗi này.

**Sửa:** thiếu/empty secret phải từ chối xử lý do lỗi cấu hình; bỏ secret mặc định. Dùng HMAC gắn timestamp và raw body; nếu giữ token tĩnh thì chỉ dùng secret được cấu hình rõ. **Regression:** thiếu/empty/sai secret, chữ ký sai, body đổi, timestamp cũ, secret đúng; route không ghi DB khi xác thực thất bại. Kiểm tra cả Apps Script và runbook cấu hình.

### P22-02 — P1: Giới hạn XLSX tin kích thước do người tải lên khai báo

**Vị trí:** `src/server/duty/availability-parser.ts:50–94`.

Giới hạn 25 MiB cộng trường `uncompressedSize` trong ZIP local header. `inflateRawSync` không giới hạn output và không đối chiếu kích thước thực. Một thành viên có quyền upload có thể đưa stream nén rất nhỏ nhưng giải nén rất lớn, tiêu tốn bộ nhớ/CPU của backend.

**Bằng chứng:** ZIP giả lập 26.564 byte khai output 1 byte, thực giải nén **27.262.976 byte (26 MiB)**, vẫn được chấp nhận. Probe cố ý giới hạn 26 MiB; không thử tải gây cạn tài nguyên. Đây là bề mặt upload nội bộ, không kết luận anonymous khai thác được.

**Sửa:** áp giới hạn output ngay trong giải nén, kiểm kích thước thực từng entry và tổng, kiểm bounds/ZIP format trước parse XML; không chỉ kiểm sau khi đã cấp phát toàn bộ. **Regression:** header khai nhỏ, entry lớn, nhiều entry vượt tổng, file hỏng và XLSX hợp lệ từ mẫu CLB; kiểm cả preview lẫn commit.

### P22-03 — P1: API client bóc `data` hai lần, các màn mới nhận undefined và sai kết quả sau commit

**Vị trí:** `src/lib/api-client.ts:791–821,1297–1309,1584–1630,1633–1662,1705–1723,1748–1772`; router sales `2531–2554`; `InternalWorkspace.tsx:1540–1558`.

`requestJson` đã trả `body.data`. Nhiều caller mới tiếp tục `return res.data`, nên trả `undefined` dù HTTP thành công. Các response nhiều phần như `{data: sale, updatedItem}` cũng bị helper bỏ sibling; `sellBook` lại khai kết quả `{sale, updatedItem}`. UI đọc `res.sale.quantity` sau khi server đã ghi giao dịch, phát sinh lỗi và không reload đúng.

**Bằng chứng adapter → router trong process + SQL double:** một lô tồn tại nhưng `apiClient.listLots()` trả undefined; `sellBook` đã ghi sale 80k nhưng kết quả là sale phẳng, không có `res.sale`. Không phải bằng chứng browser/cookie/PG.

**Sửa:** thống nhất một envelope contract tại helper và từng caller; giữ metadata/sibling cần dùng. Soát toàn bộ methods mới, đặc biệt lịch trực, tuyển dụng, sales, events, content và reporting; không sửa riêng một màn bằng cast. **Regression:** adapter → handler với response thật cho list/detail/create/update và multi-part response; kiểm UI không báo thất bại sau commit, không retry tạo giao dịch thứ hai.

### P22-04 — P1: Bán sách/quyết toán nhà sách chưa ghi vào ledger chung và tự coi tiền đã nhận

**Vị trí:** `src/modules/sales/lot-inventory.ts:347–442`; `src/modules/sales/settlement.ts:220–329`; router sales `2531–2679`.

Sale luôn INSERT `payment_status='PAID'`, giảm tồn, không yêu cầu xác nhận thực nhận và không tạo journal entry. Nếu có cash session, chỉ cộng field kỳ vọng với điều kiện ca chưa đóng; không kiểm row count hoặc khóa/xác nhận ca. Supplier payment cũng ghi `confirmed_at=NOW()` và cập nhật số đã trả/đã nhận hoàn, không hạch toán qua ledger. Báo cáo tổng hợp chỉ đọc journal nên bỏ các dòng tiền này.

**Bằng chứng:** sale tiền mặt 80k, dùng session đã đóng, không truyền confirmation vẫn trả PAID và tồn 100→99; journal count=0 trong double. Source supplier flow không gọi ledger. Chưa chạy SQL thật.

**Sửa:** dùng finance service hiện có và quỹ hoạt động cho thu bán/giá vốn/nợ nhà sách/cọc nhà sách; receipt, stock, thực thu/chi và journal phải atomic theo đúng nghiệp vụ. Không cộng vào két mượn–trả. Bổ sung confirmation, action idempotency và source uniqueness cho sale/payment; kiểm integer/safe VND tại boundary. **Regression:** 100 nhận, 60 bán, 40 trả; 4,8tr thu và 3,9tr trả; cọc 1tr hoàn riêng; chưa nhận/chưa trả, ca đóng, rollback và retry cùng ý định. Đối soát cả sổ phụ lẫn báo cáo chung.

### P22-05 — P1: Thu hội phí làm field két mượn–trả lệch ledger

**Vị trí:** `src/server/members/service.ts:262–317`; `src/server/finance/cash-sessions.ts:367–390`.

Hội phí được ghi đúng quỹ OPERATION và không gắn cash session LOAN, nhưng sau đó vẫn tăng `cash_sessions.expected_closing_cash` của két mượn–trả. Summary/đóng ca lại tính opening + journal của FUND_LOAN. Hai nguồn cho hai số khác nhau; trái yêu cầu hai quỹ để riêng.

**Bằng chứng:** mở két 200k, thu hội phí 100k → field két 300k, summary theo ledger vẫn 200k. Unit hiện tại còn assert két tăng 100k, nên kiểm thử đang giữ hành vi sai.

**Sửa:** thu và đối soát tiền hội phí ở quỹ hoạt động, bỏ tác động lên session LOAN; nếu hỗ trợ nhiều két thì phải định danh quỹ/két thực tế rõ, không dùng một field cho cả hai. **Regression:** cọc/hoàn cọc/hội phí trong cùng ngày không lẫn quỹ; kiểm summary, close-session và report sau reload. Soát các caller nhận tiền hoạt động khác.

### P22-06 — P1: Migration review sách không nâng cấp bảng đã tồn tại

**Vị trí:** `docs/technical/schema/01_schema.sql:501–511`; `docs/technical/schema/migrations/12_stage20_public_content_seo.sql:13–35`; `src/modules/content/service.ts:77,317`.

Baseline đã tạo `book_reviews(title_id,reader_name,moderation_reason,...)`. Migration12 dùng `CREATE TABLE IF NOT EXISTS book_reviews(book_id,author_name,...version...)`, nên không đổi bảng cũ. Index trên `book_id` sau đó tham chiếu cột không tồn tại. Service mới cũng dùng schema mới. Cài baseline rồi migration12 như integration fixture sẽ không ra schema mà service cần.

**Bằng chứng:** đối chiếu DDL và `tests/integration/content-policy.test.ts:9–20`; chưa thực thi PG nên không gán lỗi SQL runtime đã quan sát.

**Sửa:** migration nâng cấp/rename/backfill có bảo toàn dữ liệu và ràng buộc, cùng một schema canonical; không drop dữ liệu để qua test. **Regression:** DB trống cài đúng thứ tự, DB baseline có review cũ nâng cấp, chạy lại migration an toàn, submit/edit/moderate/public-read bằng service thật trên PG.

### P22-07 — P1: Query xếp lịch dùng các cột không có trong bảng members

**Vị trí:** `src/server/duty/roster-service.ts:33–60,488`; baseline `01_schema.sql:112–128`.

Query dùng `m.student_id`, `m.status`, `m.is_eligible_main`. Schema members dùng `is_active`, `is_eligible_main_duty` và không có student_id. Các migration mới không thêm các cột này. Query ứng viên để sinh lịch và query detail phân công vì thế không khớp DB. Mock lại cung cấp các field ngoài schema, che lỗi. Default `COALESCE(...,true)` còn đi ngược yêu cầu người mới chưa đủ điều kiện trực chính.

**Sửa:** map đúng model members hiện có; thông tin chưa có phải bổ sung bằng migration được xác định rõ, quyền trực chính mặc định false. **Regression:** gọi generate/list/detail/publish với seed canonical, thành viên mới chỉ support, inactive/alumni không được xếp, đủ người 13:45–17:15 và đúng khoảng hỗ trợ. Integration test chỉ tạo bảng/phân công thủ công chưa kiểm được query này.

### P22-08 — P1: Chuyển ứng viên trúng tuyển sang thành viên vi phạm schema canonical

**Vị trí:** `src/modules/recruitment/decisions.ts:145–188`; baseline members `112–128`; migration05 affiliation `8–18`.

Tạo `memberId='mem-gen10-...'` rồi dùng với `members.id UUID`, nên ngay query kiểm tra id đã không hợp kiểu. INSERT còn ghi `updated_at` chưa có, bỏ `gen NOT NULL`; affiliation id cũng là chuỗi không phải UUID. Trường `team` cần map đúng enum canonical; không thể chỉ đổi ID rồi coi luồng đã sửa xong.

**Sửa:** UUID và mapping/validation dùng model thành viên hiện có; nhập đủ gen/phone/team theo policy đã có, không hardcode gen10/K68/năm2026. Giữ quyết định và tạo member/affiliation atomic, chống concurrent conversion. **Regression:** convert ứng viên có/không MSSV, các ban, DB thực, retry/concurrent cùng đơn, existing username, dữ liệu thiếu; không sinh hai member hay affiliation dở dang.

### P22-09 — P1: Báo cáo lưu thông truy sai cột và sai loại settlement

**Vị trí:** `src/modules/reporting/reporting-service.ts:296–333`; baseline `01_schema.sql:161–241`.

Query dùng `loan_receipts.issued_at`, `loan_items.return_status`, `loan_items.due_date`, đều không có. Hạn trả nằm ở receipt; trạng thái item biểu diễn bằng returned/lost/carried fields. Query trả sách dùng `settlement_type='RETURN'`, trong khi schema chỉ cho FULL/PARTIAL/LOST. Vì vậy endpoint không hoạt động đúng trên schema hiện tại; kể cả sửa cột đầu tiên vẫn còn nhiều lỗi phía sau.

**Sửa:** query từ đúng receipt/item/settlement, định nghĩa rõ đếm phiếu hay bản sách, không tính carry-forward thành trả vật lý và không tính mất vào trả. **Regression:** issue/full/partial/loss/renew/multiple lineage, ngày nghỉ và ngày biên trên PG; JSON/export cùng số. Hiện chỉ xác nhận lỗi qua source/DDL, PG gate vẫn blocked.

### P22-10 — P1: Báo cáo gọi phát sinh trong kỳ là số dư

**Vị trí:** `src/modules/reporting/reporting-service.ts:106–180`.

Query loại mọi journal trước startDate nhưng kết quả mang tên cashDrawerBalance/depositLiability/bookstorePayable... Đây là biến động trong kỳ, không phải số dư cuối kỳ. Trường hợp hoàn cọc nhận từ kỳ trước sẽ hiện nghĩa vụ cọc âm. Khoảng ngày cũng đang dùng `<= end+1 day`, có thể đếm lại giao dịch đúng biên ở kỳ kế tiếp; chưa xác định cutoff VN rõ ràng.

**Bằng chứng:** cọc đầu kỳ 50k, chỉ có hoàn 50k trong kỳ → báo cáo trả liability -50k thay vì số dư cuối kỳ 0. Probe dùng query double có đúng dòng phát sinh, không phải PG.

**Sửa:** tách opening/movement/closing; số dư cộng dồn tới cutoff, doanh thu/chi phí theo kỳ; dùng cận cuối loại trừ và ngày VN. **Regression:** khoản nhận trước kỳ hoàn trong kỳ, nợ nhà sách qua kỳ, không phát sinh nhưng có số dư, cuối tháng/năm, CSV/JSON/drilldown đối chiếu cùng ledger.

### P22-11 — P1: Backup/restore báo thành công khi không thực hiện; restore chưa dừng theo lỗi SQL

**Vị trí:** `scripts/backup.ps1:35–60,78–80`; `scripts/restore.ps1:33–54`; hai file `.sh` tương ứng.

Thiếu pg_dump thì backup ghi khung SQL mô phỏng rồi exit0. Thiếu psql thì restore chỉ in thông báo giả định rồi vẫn báo hoàn tất/đối soát. Khi có psql, lệnh restore không có `ON_ERROR_STOP=1` như progress tuyên bố; kiểm exit code không đủ để dừng mọi SQL error. Đối soát chỉ đếm bảng, không chứng minh số tiền/sách/trạng thái thu hồi phiên đã phục hồi.

**Bằng chứng chạy PowerShell local:** đã kiểm pg_dump/psql đều không có; dùng URL giả `invalid.invalid`, không kết nối DB. Backup exit0 tạo file **444 byte**, restore exit0 và báo hoàn tất. Log ở `.review-artifacts/post22-{backup,restore}-probe.log`.

**Sửa:** thiếu tool/failure phải exit khác0, không trộn mô phỏng vào lệnh vận hành. Restore dùng ON_ERROR_STOP, kiểm đích phục hồi phù hợp và kết quả verify; backup có kiểm toàn vẹn, lưu trữ được bảo vệ. Chạy drill trên DB disposable với data canonical và đối soát ledger, inventory, auth state. **Regression:** thiếu tool, SQL lỗi giữa file, dump rỗng/hỏng, lỗi verify, thành công thực. JSON serialize 1.000 dòng và lọc cutoff trong unit không chứng minh PITR/RPO/RTO. Runbook hiện còn trỏ `src/server/db/schema.sql` không tồn tại (`progress.md:1921`).

### P22-12 — P2: Trang SEO sách chỉ phát hành sáu cuốn mock

**Vị trí:** `src/pages/sach/[id].astro:2–17`; `astro.config.mjs`.

Static paths và nội dung/review lấy từ INITIAL_BOOKS/INITIAL_REVIEWS. Build chỉ tạo `/sach/b-01..b-06`; bản sách thật mới thêm bằng UUID không có trang tĩnh tương ứng. Duyệt review trong backend cũng không làm nội dung trang đổi. Không thể gọi đây là catalog public/SEO đã nối dữ liệu thật.

**Sửa:** một nguồn public-safe thật và chiến lược cập nhật hợp deployment: render runtime hoặc build/revalidate có dữ liệu thật; review chỉ dùng bản được duyệt. Preview mock phải nhận diện rõ và không được dùng làm nghiệm thu production. **Regression:** thêm sách thật → có URL truy cập được; duyệt/sửa/ẩn review → nội dung public đúng; không lộ email/PII; kiểm HTML đã render và staging noindex. Chưa nghiệm thu SEO trên domain/search engine thật.

## Đối chiếu các finding S12

| Finding | Trạng thái mới | Bằng chứng và phần còn lại |
|---|---|---|
| S12-01 DTO/catalog | PARTIAL | Đã thêm mapCashSession/mapLoanReceipt và serializer aliases. Loader `InternalWorkspace.tsx:440–460` gọi searchBooks rồi bỏ kết quả, lấy copies từ loan history; sách chưa từng mượn không xuất hiện, lost/carry bị suy ra BORROWED, dữ liệu trang đầu vẫn chưa đủ. Contract mới còn P22-03. |
| S12-02 FULL selector | FIXED_SOURCE | UI `680–695` gửi selector cho cả FULL/PARTIAL và loại returned/lost/carry. Chưa browser/PG proof, không gộp thành nghiệm thu toàn luồng. |
| S12-03 tiền/pending | PARTIAL | Checkbox mặc định false, method riêng, form cọc mới và thu phạt đã có. UI vẫn không gọi getLoanSettlement/confirmRefund; không có queue hoàn tất refund pending. Phạt return tự tính theo dueDate ở client `671–677`, chưa dùng quote điều chỉnh lịch nghỉ từ server. |
| S12-04 retry | OPEN | Methods cho phép truyền key nhưng UI không giữ/truyền key. Probe hai renew cùng payload vẫn sinh hai key và renew_count0→2. Chưa recovery sau mất response/reload. |
| S12-05 DEMO/auth | PARTIAL, có regression mới | Các handler quầy cũ đã có DEMO branch; outer401/403 clear một số state. Handler mới sales/events/evaluation vẫn gọi API không có mode guard, ví dụ sell `1540–1555`, createEvent `1667–1680`; chuyển LIVE→DEMO còn giữ live state. Các catch con vẫn nuốt lỗi rồi giữ state. Không gọi đây là bypass quyền server. |
| S12-06 correction fine | PARTIAL | Đã bỏ query cột fine ở loan_receipts, chuyển settlement/renewal. Nhưng journal thu phạt ban đầu vẫn source_id=receipt.id (`circulation/service.ts:789–790,1699–1700`), correction luôn tìm settlement mới nhất trước renewal (`ledger.ts:631–653`). Đảo tiền phạt renewal sau khi có settlement có thể cập nhật nhầm quyết định. Cần source decision chính xác và regression nhiều kỳ phạt; không đóng chỉ vì sửa được tên bảng. |
| S12-07 collection codes | FIXED_SOURCE/UNIT | Code thêm targetShort vào entryCode; unit nhiều target pass. PG uniqueness/concurrency vẫn chưa chạy. |
| S12-08 loss coverage | FIXED_SOURCE/UNIT | Đã kiểm từng lost item trước ghi; unit missing allocation pass. Không coi đây là proof PG atomicity/provider/money thật. |
| S12-09 locks và contract tiền | PARTIAL | Renew khóa session trước receipt; correction có peek rồi session→receipt→allocation→journal. Không báo lại thứ tự cũ còn nguyên. PG overlap chưa chạy; cash check correction vẫn tin field expected_closing_cash (`ledger.ts:581–594`), hiện đã có đường làm field lệch ở P22-05. Các snapshot/source/quote/carryover cũ chưa đủ bằng chứng để đóng toàn bộ. |
| S12-10 acceptance vượt proof | OPEN | Progress vẫn tuyên bố hoàn tất và các R01–R13 RESOLVED, trong khi code/probe/PG/Workers/UI còn các vấn đề trên. OpenAPI giữ nguyên SHA256 từ review12, thiếu các family sales/events/reports mới; lint pass chỉ kiểm tính hợp lệ tài liệu. |

Không đổi tên nội dung finding cũ để đóng: bảng R01–R13 cuối progress hiện dùng mô tả khác carryover ban đầu. Khi sửa phải giữ ID gốc, trigger, bằng chứng và gate còn thiếu.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả thực tế |
|---|---|
| `pnpm run check` qua RTK | exit0; 109 files; 0 errors, 0 warnings, 9 hints; tsc pass |
| Build ra `.review-artifacts/post22-build` | exit0; 9 static pages; 3,97s; không chứng minh API hoạt động |
| 24 unit files từ package script, Node `--test-isolation=none` | 199 pass, 0 fail; log `.review-artifacts/final-review-unit.log`; chế độ trong process, không gán là chính xác runtime production |
| Python experiments | 23 pass |
| Redocly2.64.1 lint | 0 errors, 22 warnings; `.review-artifacts/post22-openapi.log` |
| 17 integration files, isolation none, concurrency1 | 49 test results, 0 pass; tất cả bị chặn ở setup `DB_RUNTIME_MISSING` do thiếu TEST_DATABASE_URL; không phải 49 lỗi nghiệp vụ đã xác minh; `.review-artifacts/post22-db.log` |
| Tool DB local/Docker | Không tìm thấy psql/pg_dump/postgres; Docker không kết nối được daemon LinuxEngine |
| Wrangler dry-run, không deploy | `spawn EPERM`, exit1; chưa chứng minh Workers bundle/runtime |
| Probe review bổ sung | 7 nhóm counterexample được xác nhận; `.review-artifacts/post22-counterexamples.mjs/.json`; fake data, 0 external requests, 0 real DB writes |
| PowerShell backup/restore probe | Exit0 giả thành công khi thiếu tool; không kết nối DB |
| Browser hiện tại | Đã thử dev local4331 và mở bằng CUA; Astro báo `Failed to create the dev server app: module is not defined`, navigation timeout, không lấy được tab để kiểm tra. Đã dừng server do review tạo. Không xác nhận UI/mobile/login thực; không dùng trạng thái browser bị tắt ở review trước làm bằng chứng hiện tại. |

## Trạng thái chặng 13–22 và thứ tự sửa

| Nhóm | Trạng thái | Gate chính |
|---|---|---|
| 13 thành viên/hội phí | PARTIAL | P22-05, PG money/concurrency |
| 14 import lịch bận | PARTIAL | P22-02, parser với XLSX thật |
| 15 phân ca | PARTIAL | P22-03/07, PG và UI publish/readback |
| 16 Google Form | PARTIAL | P22-01/03, provider sync thực chưa thử |
| 17 chấm/tuyển/chuyển member | PARTIAL | P22-03/08, quyền/cạnh tranh/multi-rubric thực |
| 18 sales/nhà sách | PARTIAL | P22-03/04, ledger và actual payment |
| 19 hoạt động/sự kiện | PARTIAL | P22-03, DEMO boundary, PG/service transaction và UI chưa đủ proof |
| 20 content/SEO | PARTIAL | P22-06/12, public-safe runtime và moderation |
| 21 báo cáo/audit | PARTIAL | P22-03/09/10, export và app-role proof |
| 22 vận hành/restore | PARTIAL; runtime gates BLOCKED | P22-11; PostgreSQL, Workers, browser/provider/restore thực chưa nghiệm thu |

Đề nghị sửa theo dependency, không thêm một lượt tính năng mới:

1. Chặn P22-01/02 và backup giả thành công; giữ môi trường dữ liệu thật chưa kích hoạt.
2. Sửa envelope chung, loader bản sách, action retry, mode boundary và workflow refund pending; regression adapter→handler trước UI.
3. Chốt baseline + migration nâng cấp, sửa query roster/member conversion/report, kiểm một chuỗi migration canonical trên PG disposable.
4. Gom mọi dòng tiền về ledger đúng quỹ; đóng lệch hội phí/sales, correction source, opening/closing reports; chạy rollback/retry/concurrency tests.
5. Nối public pages với dữ liệu thật; hoàn thiện xuất XLSX và PDF như yêu cầu (hiện reporting mới có CSV); đồng bộ OpenAPI/diagram/runbook/progress.
6. Sau các sửa trên mới chạy Workers, browser desktop/mobile/role switch, provider Form, backup/restore drill và tải dự kiến. Các gate thiếu môi trường giữ BLOCKED; hoàn tất code độc lập được ghi riêng, không nâng thành PASS.

Không sửa source trong lượt review. Tài liệu này cùng script/log/snapshot review là các artifact mới; kết luận nghiệm thu phải được cập nhật lại sau khi các finding được sửa và kiểm chứng đúng lớp.
