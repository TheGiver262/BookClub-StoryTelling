# Review đợt sửa P22/S12 — 20/10/2026

## Kết luận và phạm vi

**PARTIAL — có sửa đúng, còn lỗi chặn vận hành.** Không chấp nhận Checkpoint G PASS hoặc toàn bộ finding FIXED_SOURCE trong handoff hiện tại. Lượt sửa đã bổ sung giới hạn giải nén thực, webhook thiếu secret bị chặn, ledger cho sales, số dư báo cáo đầu/cuối kỳ, mapping schema và giao diện pending. Tuy nhiên có đường mới không gọi được qua router/SQL canonical, có xác nhận tiền giả và thiếu tính duy nhất khi quyết toán.

Review theo prompt `docs/prompts/antigravity-next/repair-post22-review.md`, review19/10 và bảng P22/S12. Không sửa implementation, không dùng subagent, không commit/deploy/provider/PII/DB thật. Workspace không có `.git`; snapshot đầu lượt `.review-artifacts/repair-review-20261020-manifest.json`. Dùng tải đã chốt: <5.000 sách, <100 lượt/buổi, 3–5 người cùng ghi. Source/unit/double không thay bằng chứng PostgreSQL/Workers/browser.

## Findings cần sửa

### RF-01 — P1: Quote bị route bắt nhầm; các query quote/pending dùng bảng không có trong schema

**Liên quan:** S12-03, P22-09, S12-10.

**Vị trí:** `src/server/router.ts:1372–1390,1512–1589`; `src/server/circulation/service.ts:2666–2674,2715–2730,2794–2841`; `InternalWorkspace.tsx:560–564,760–770,1179–1185`.

GET detail phiếu dùng startsWith và chỉ loại settlement/settle-return/renewals, nên `/loans/:id/quote` vào handler detail với ID `:id/quote`, không tới route quote phía sau. Probe adapter/direct handler với phiếu hợp lệ trả **404**, chưa chạm query quote.

Ngay cả sửa dispatch, quote JOIN `books` qua `book_copies.book_id`, trong khi model là book_copies→book_editions→book_titles. Ba hàng chờ JOIN `readers`, trong khi bảng chuẩn là borrowers; pending-deposits cũng JOIN books. Đối chiếu baseline + toàn bộ migration không có books/readers. Schema guard trong probe trả lỗi mô hình42P01/HTTP500 cho các query này; **đây không phải lỗi đã chạy trên PG thật**. UI `.catch(()=>[])` làm lỗi tải thành “hàng chờ trống”, rồi quote lỗi lại fallback tính phạt ở client.

Fine queue chỉ đọc settlements, bỏ renewal fine pending từ correction; UI bỏ settlementId/targetId khi gọi collect nên có thể thu quyết định mới nhất thay vì dòng người trực chọn. Quote cũng chưa cap suggestedFine theo cọc, canRenew chưa áp nhánh cap, và targetDate là ngày đánh giá nhưng UI lại trình bày như hạn mới sau gia hạn. Đây là contract chưa hoàn chỉnh, không chỉ lỗi hiển thị.

**Sửa:** match route chính xác hoặc dispatch subresource trước; query theo schema canonical, trả đầy đủ source IDs cho mọi queue, truyền targetId đến collect; dùng cùng policy quote/execution. Không dùng rỗng/fallback client che lỗi trong LIVE. **Test:** adapter→router cho quote/queue/confirm/collect với đúng schema, item returned/lost/carry, nhiều kỳ phạt, ngày lễ và cap; PG service tests khi có runtime. **Nếu bỏ qua:** tiền chờ bị ẩn, phạt không dùng quote thật, thao tác nhầm nguồn.

### RF-02 — P1: Xác nhận tiền mới bị thêm ở client và vẫn bị bỏ qua ở nghiệp vụ nhà sách

**Liên quan:** P22-04.

**Vị trí:** `src/lib/api-client.ts:1799–1804`; `InternalWorkspace.tsx:1797–1804,1893–1907`; `src/modules/sales/lot-inventory.ts:135–180`; `src/modules/sales/settlement.ts:248–275,343–359`.

Sale service đã yêu cầu paymentConfirmed===true, nhưng adapter mặc định tự thêm true khi caller bỏ field, UI bán cũng hardcode true. Tạo lô có depositAmount lập tức ghi PAID và journal chi, default BANK nếu không nhập method, không có xác nhận thực chi. Supplier payment không yêu cầu confirmation và lập tức đóng dấu confirmed_at, cập nhật số đã trả/đã nhận hoàn. UI còn hardcode BANK_TRANSFER và mã UNC tự sinh, không phải mã giao dịch được kiểm tra.

**Probe:** caller bỏ confirmation vẫn bán60cuốn ghi PAID4,8tr qua adapter→router; tạo lô cọc1tr không xác nhận vẫn có journal chi1tr; supplier payment100k không xác nhận vẫn tăng paidToSupplier100k. Đây là SQL double với tiền tổng hợp, không giao dịch ngân hàng thật.

**Sửa:** confirmation mặc định false từ UI tới service; method/amount và chứng từ từng chiều được nhập/xác nhận rõ. Dự kiến cọc khác thực chi; nhận hoàn khác trả dư. Cấm auto true/default method để hợp thức tiền. **Test:** omitted/null/false/string true bị từ chối trước mọi mutation; đúng confirmation mới tạo journal; rollback và retry cho sale/deposit/supplier payment. **Nếu bỏ qua:** ledger có tiền đã thu/chi dù thực tế chưa xảy ra.

### RF-03 — P1: Hai quyết toán có thể tạo hai khoản nợ trên cùng lô; replay key sai payload vẫn được nhận

**Liên quan:** P22-04, S12-04/09.

**Vị trí:** `src/modules/sales/settlement.ts:136–171,179–234`; `docs/technical/schema/migrations/10_stage18_book_sales_consignment.sql:112–138`.

createSettlement kiểm tồn tại rồi tính/INSERT, không khóa lô trước kiểm. Schema chỉ index lot_id, không UNIQUE lot_id. Hai request với key khác nhau có thể cùng thấy chưa có, tạo hai settlement và hai journal nợ. UPDATE status sau INSERT không ngăn cửa sổ này. Cùng key nhưng lotId/body/actor khác lại trả bản ghi cũ, không so payload; kiểm status và snapshot với sale/return cũng chưa khóa chung.

**Probe mô hình interleaving:** ép hai lần SELECT tồn tại cùng thấy rỗng, cả hai tạo settlement; nợ65k thành130k. Đây là mô hình hai luồng trên double, **chưa phải PG concurrency proof**. Probe tuần tự cùng key yêu cầu different-lot vẫn trả settlement của lô cũ, không409.

**Sửa:** dùng idempotency helper có actor/action/payload hash; khóa aggregate trước quyết định, uniqueness đúng business source và recheck dưới lock; sales/return/settlement thống nhất thứ tự khóa/snapshot. Migration xử lý dữ liệu trùng theo đối soát, không xóa lịch sử tùy ý. **Test:** PG barriers cho hai key/cùng lô và sale/return đua settlement; chỉ một quyết toán, nợ đúng một lần; replay khác body/path409. **Nếu bỏ qua:** tăng gấp đôi công nợ và báo cáo chi phí.

### RF-04 — P1: Action key chưa bao phủ mọi giao dịch và không gắn với entity/payload qua vòng đời UI

**Liên quan:** S12-04, P22-04.

**Vị trí:** `InternalWorkspace.tsx:162–195,781–791,955–966,1179–1189,1893–1907`; API methods tạo key mới khi thiếu params.idempotencyKey.

Sáu state key mới chỉ giữ trong component; return/open-close/loss/correction/dues/supplier-payment chưa có key sống theo ý định ở UI. Reload làm mất toàn bộ. Một key renew/sell/collect... được giữ sau mọi lỗi nhưng không reset hoặc đối soát khi chuyển entity/payload. Ví dụ requestrenewA lỗi validation hoặc mất response, đóng modal rồi renewB dùng keyA: payload conflict; sale đổi số lượng sau lỗi cũng mắc key cũ. Chỉ reset khi thành công chưa đủ để phân biệt retry và ý định mới.

**Sửa:** action record tối thiểu gắn actor/operation/entity/payload, stable qua retry/recovery cần thiết; disable double submission và đọc lại chứng từ khi kết quả chưa rõ. Cùng ý định mới retry key cũ; đổi payload/entity là ý định khác được xử lý rõ. Không lưu PII/secret thừa trên máy chung, không tự yêu cầu chuyển tiền lại. **Test:** mất response sau commit, reload, cancel→entity khác, sửa form sau validation, hai thao tác liên tiếp đúng một lần. **Nếu bỏ qua:** gia hạn/thu chi lặp hoặc người trực bị kẹt409.

### RF-05 — P1: Pagination metadata vẫn bị mất; quầy chỉ biết 100 bản đầu rồi suy tồn từ lịch sử

**Liên quan:** P22-03, S12-01.

**Vị trí:** `src/lib/api-client.ts:893,975–1015`; `InternalWorkspace.tsx:480–506`; router copies `1031–1040`.

Sửa double unwrap đã làm list/detail/multi-part sales hoạt động, nhưng requestJson vẫn bỏ sibling meta. Methods tự tạo meta từ mảng còn lại nên total/page/limit sai. Loader chỉ gọi copies limit100, không có search/page/scan server tương ứng trong đường chọn sách này; lỗi/rỗng vẫn dựng copies từ lịch sử loans. Với101 bản và bản available nằm ngoài trang đầu, không chọn được bản đó trong quầy; fallback có thể hiển thị trạng thái cũ.

**Probe wire đúng router:** total125/page2/limit1, adapter trả total1/page1/limit50. **Sửa:** giữ envelope metadata có kiểm và nối search/scan/pagination thật vào caller; không lấy lịch sử phiếu làm tồn hiện tại, không fallback silently. **Test:** >100 copies, available ngoài trang đầu, không có lịch sử, trạng thái đổi, API lỗi; quầy truy được bản đúng mà không tải cả kho/PII. **Nếu bỏ qua:** kho có sách nhưng quầy không thấy hoặc báo sẵn sàng sai.

### RF-06 — P1: DEMO vẫn còn mutation live và response cũ có thể phục hồi dữ liệu sau clear

**Liên quan:** S12-05.

**Vị trí:** `InternalWorkspace.tsx:433–621,1518–1538,1547–1578,1585–1620,1650–1678,2287–2298`.

Đã thêm nhiều guard DEMO cho sales/events/content, nhưng reconciliation, createRubric trong catch của màn evaluation, submit/editEvaluation, finalizeDecision, convert-member và export-ticket vẫn gọi API không qua boundary thống nhất. clearLiveSensitiveData không hủy/bỏ response đang chờ và không clear toàn bộ hồ sơ/đánh giá/decision/action keys. RequestLIVE bắt đầu trước đổi mode/role/logout có thể resolve sau clear rồi set state trở lại. API vẫn kiểm quyền; **không kết luận bypass auth backend**.

**Sửa:** chặn mọi mutation ở một biên mode đáng tin cậy, cộng guard caller cần thiết; version/abort cho request đang chờ và clear dữ liệu/modal/key nhạy cảm đúng actor/mode. Không tạo rubric khi GET thất bại vì network/403. **Test:** mutation spy cho mọi DEMO action, response trì hoãn qua LIVE→DEMO và member→alumni/logout, catch con401/403 phải thu hồi dữ liệu đúng. **Nếu bỏ qua:** demo ghi dữ liệu thật hoặc máy dùng chung còn thấy dữ liệu vai trò trước.

### RF-07 — P1: Chuyển ứng viên có thể gắn với một người khác chỉ vì trùng username

**Liên quan:** P22-08.

**Vị trí:** `src/modules/recruitment/decisions.ts:82,140–164,195–219`.

UUID/enum đã sửa đúng. Nhưng nếu username suy từ MSSV/tên đã tồn tại, service dùng luôn member đó và đánh dấu ứng viên đã chuyển, không kiểm liên kết danh tính. Người khác cùng tên không dấu hoặc MSSV nhập sai có thể bị gắn nhầm. Không có khóa decision ở đầu; dữ liệu thiếu còn bịa phone0900000000, Gen10/K68 và năm2026–2027, dù prompt đã yêu cầu lấy từ đợt tuyển/input.

**Probe:** applicant “Different Applicant”, username trùng “same” với “Existing Other Person” → trả member cũ, không tạo member, decision markedConverted=true. **Sửa:** username collision là conflict hoặc cấp tên không trùng theo flow rõ; chỉ dùng member có liên kết identity đã xác minh. Không bịa dữ liệu bắt buộc; nhận từ campaign/input, validation trước ghi. Khóa decision và constraints phù hợp. **Test:** hai người cùng tên, sai/trùng MSSV, thiếu phone/gen, retry/concurrent cùng response và không sửa nhầm người cũ. **Nếu bỏ qua:** sai danh sách thành viên và lịch sử phân ban.

### RF-08 — P1: Fallback correction phạt legacy vẫn chọn lần gia hạn mới nhất

**Liên quan:** S12-06.

**Vị trí:** `src/server/finance/ledger.ts:690–712`; source mới `circulation/service.ts:1707–1708` đã dùng decision UUID.

Nguồn mới đã định danh đúng decision. Với journal cũ source_id=receipt.id, fallback chỉ nhận diện prefix JE-RN rồi SELECT renewal_sequence DESC LIMIT1, không map sequence có trong entry code. Đảo phạt lần1 sau khi có lần2 sẽ cập nhật lần2; clamp collected về0 còn che mismatch thay vì từ chối.

**Probe với model thực thi ORDER BY đúng SQL:** lần1 collected1000, lần2 collected3000; đảo journal lần1 1000 → lần1 vẫn1000, lần2 collected2000/pending1000. SQL double gốc chọn dòng đầu không tuân ORDER BY; probe chỉ bổ sung semantics query đó, chưa PG execution.

**Sửa:** map đúng source cũ có kiểm đủ dữ kiện, hoặc fail-closed AMBIGUOUS_FINE_SOURCE và workflow reconciliation; không dùng newest fallback. **Test:** ít nhất hai renewal fine legacy, settlement cùng receipt, partial collections/reversal, mismatch amount/source và data mới giữ nguyên đúng. **Nếu bỏ qua:** sổ cái đảo một khoản nhưng sổ phạt mở nợ khoản khác.

### RF-09 — P1: Catalog public/SEO mới vẫn sai schema và dùng 404 làm trang sách thật

**Liên quan:** P22-12.

**Vị trí:** `src/pages/sach/[id].astro:40–72,110–142`; `src/pages/404.astro:15,69–98,121–142`; `src/server/catalog/service.ts:269–300`.

Build DB review query còn `reader_name` sau migration rename author_name, và approved_at thay moderated_at. Catch nuốt lỗi rồi vẫn build mock. Luôn thêm sáu sách mock kể cả khi có DB thật. 404 fallback chỉ đổi DOM/title, không biến HTTP404/noindex thành URL sách200/SEO hợp lệ; sách đã build cũng không cập nhật review/tồn theo API.

Fallback đọc coverPrice/coverImage trực tiếp trên book trong khi detail DTO chứa editions[].standardDeposit/coverImageUrl. Tính cọc bằng50% giá bìa là sai policy làm tròn50k; rẽ nhánh fallback không sửa bằng việc chỉ đổi title. Đây là source/DDL và build artifact evidence; chưa browser runtime/domain SEO acceptance.

**Sửa:** dùng contract public canonical và chiến lược render/cập nhật thật phù hợp deployment; query đúng schema, mock chỉ preview rõ, lỗi nguồn thật không thành catalog mock thành công. Sách thật có HTTP200, HTML/nội dung và canonical đúng; derive deposit từ server policy. **Test:** DB có review sau migration, sách thêm sau build, duyệt/ẩn review, giá74/75/230k, không giá; HTTP status/meta/HTML thật và PII allowlist. **Nếu bỏ qua:** SEO không index sách thật, giá cọc công bố sai và dữ liệu cũ.

### RF-10 — P2: Restore vẫn có thể báo “đã đối soát” khi kết quả verify không hợp lệ

**Liên quan:** P22-11.

**Vị trí:** `scripts/restore.ps1:11,61–76`; restore.sh có kiểm số bảng nhưng không drill nghiệp vụ.

Thiếu tool/rỗng/SQL failure đã exit lỗi, ON_ERROR_STOP đã có. Nhưng TryParse tableCount thất bại chỉ warning rồi exit0. Cả hai script mặc định DATABASE_URL và chưa kiểm target sạch/disposable; bảng>=5 cũng không đủ chứng minh tiền/sách/auth state. Không chạy script với DB thật trong review.

**Probe psql giả trong process, không mạng:** verify trả NOT_A_COUNT, script vẫn exit0 và báo hoàn tất. Probe thiếu tool hiện backup/restore đều exit1, không tạo backup giả — phần này đã sửa đúng.

**Sửa:** verify parse/semantic failure phải fail; target/restore mode rõ, drill chỉ disposable được guard, đối soát manifest/canonical counts/balances/inventory/pending/auth. **Test:** invalid verify, SQL lỗi giữa file, target sai/không sạch và drill thực; chưa đo RPO/RTO thì không công bố đạt. **Nếu bỏ qua:** người giữ backup tin nhầm dữ liệu đã phục hồi đủ.

### RF-11 — P2: Export chưa tạo XLSX/PDF thật; single-use ticket không tồn tại xuyên instance

**Liên quan:** yêu cầu đợt F/G, S12-10.

**Vị trí:** `src/server/router.ts:3273–3327`; `src/modules/reporting/reporting-service.ts:689–730,739–815`; `InternalWorkspace.tsx:2287–2298`; api-client createExportTicket2238.

Format XLSX đang trả SpreadsheetML2003 với đuôi.xls, HTML chỉ là tài liệu in chứ chưa PDF; UI/export client vẫn chỉ chọn CSV. Không có file XLSX ZIP/PDF để kiểm nghiệm. Signed ticket đi được nhiều instance nhưng consumedTicketIds/downloadTicketStore là memory cục bộ; instance khác vẫn chấp nhận cùng ticket còn hạn. Default signing key trong source không cần thiết, dù route download vẫn yêu cầu member hiện hành nên không gọi đây là anonymous leak.

**Sửa:** thực hiện đúng các format đã cam kết, hoặc giữ thiếu sót PARTIAL rõ; API/UI nối format có validation, không rename XML/HTML giả định dạng. Nếu cần single-use, consume phải dùng trạng thái chung atomic; bỏ fallback secret, bounded cleanup và recheck actor/token version theo contract. **Test:** mở XLSX/PDF thật, tiếng Việt/số liệu/formula safety, download qua hai instance, revoke và retry khi render lỗi. **Nếu bỏ qua:** xuất file không đáp ứng yêu cầu và ticket không đúng cam kết dùng một lần.

## Ma trận P22 sau sửa

FIXED_SOURCE/UNIT chỉ xác nhận lát lỗi đã sửa bằng source/unit/probe, không bao gồm PG/Workers/provider/browser.

| ID | Trạng thái review | Bằng chứng / phần còn lại |
|---|---|---|
| P22-01 | FIXED_SOURCE/UNIT | Bỏ default webhook, thiếu secret bị reject trong probe; provider và route-no-write trên PG chưa chạy. |
| P22-02 | FIXED_SOURCE/UNIT | maxOutputLength + tổng bytes thực; forged26MiB bị chặn. XLSX thực/Workers chưa nghiệm thu. |
| P22-03 | PARTIAL | Double unwrap list/multi-part sale đã hoạt động qua adapter→router; metadata còn RF-05. |
| P22-04 | PARTIAL | Có journal sale/lot/settlement/payment và service sale confirmation guard; RF-02/03/04 còn mở, PG money gates blocked. |
| P22-05 | FIXED_SOURCE/UNIT | Không tăng session LOAN khi thu hội phí; probe field/summary cùng200k. OPERATION close/restore thực chưa chứng minh. |
| P22-06 | FIXED_SOURCE; PG BLOCKED | Có ALTER/RENAME/add fields cho baseline review; chưa fresh/upgrade PG. Public caller còn dùng cột cũ RF-09. |
| P22-07 | FIXED_SOURCE/UNIT | Roster dùng is_active/is_eligible_main_duty, không query student_id/status sai; chưa lifecycle/concurrency PG/browser. |
| P22-08 | PARTIAL | UUID, gen column và enum đúng; RF-07 collision/bịa dữ liệu/concurrency. |
| P22-09 | PARTIAL | Bỏ các cột issued_at/return_status/due_date item sai. Report lưu thông vẫn dùng ngày cutoff/CURRENT_DATE theo DB thay VN, đếm LOST settlement thành “số sách” và chưa áp ngày nghỉ; query mới quote/pending còn RF-01. |
| P22-10 | FIXED_SOURCE/UNIT; PG BLOCKED | Opening/movements/closing, cutoff VN nửa mở đã thêm, unit regression pass. Dữ liệu nguồn money còn RF-02/03, không nghiệm thu độ chính xác end-to-end. |
| P22-11 | PARTIAL | Missing tool/SQL error fail và ON_ERROR_STOP đã sửa; RF-10, PG restore drill chưa có. |
| P22-12 | OPEN/PARTIAL implementation | Đã thêm code đọc DB/fallback nhưng RF-09 chặn cả schema và HTTP/SEO đúng. |

## Ma trận S12 sau sửa

| ID | Trạng thái review | Phần còn lại |
|---|---|---|
| S12-01 | PARTIAL | DTO mapping giữ đúng; RF-05 metadata/loader/fallback. |
| S12-02 | FIXED_SOURCE/UNIT | Giữ exact FULL selector loại returned/lost/carry; browser/PG full flow chưa đạt. |
| S12-03 | PARTIAL | Đã có UI queues/detail/refund confirmation và server quote source; RF-01 khiến đường thật không chạy; target/quote policy còn thiếu. |
| S12-04 | PARTIAL | Một số key ổn định trong component, RF-03/04 và source uniqueness/recovery chưa đủ. |
| S12-05 | PARTIAL | Thêm clear/guards nhưng RF-06 còn nguyên ở các caller khác và response cũ. |
| S12-06 | PARTIAL | Source decision UUID mới đúng, legacy RF-08 vẫn sai. |
| S12-07 | FIXED_SOURCE/UNIT | Giữ targetShort/multiple-source codes; PG uniqueness/concurrency chưa chạy. |
| S12-08 | FIXED_SOURCE/UNIT | Giữ kiểm từng lost item coverage; PG atomicity chưa chạy. |
| S12-09 | PARTIAL | Correction dùng opening+journal dưới session lock, thứ tự renew/correction có cải thiện. Chưa audit/prove mọi implicit/pending/cancel/source path; RF-03 và PG races còn thiếu. Không báo lại lock order cũ như chưa sửa. |
| S12-10 | PARTIAL | README/progress đã giữ một số gate BLOCKED, OpenAPI thêm route mới. Handoff vẫn CheckpointG PASS và claim fixed quá rộng; RF-11/export, PG/Workers/browser/restore chưa đạt. |

## Kiểm tra thực chạy

| Check | Kết quả |
|---|---|
| `rtk pnpm run check` | exit0;113files;0errors/0warnings/9hints;tsc pass |
| `rtk pnpm run build --outDir .review-artifacts/repair-review-20261020-build` | exit0;10static pages;4,00s; sáu trang sách mock trong môi trường không có DB |
| Unit27files, Node `--test-isolation=none` | 232pass/0fail,16suites;1.253ms; log `repair-review-20261020-unit.log` |
| Python | 23pass;0,028s |
| OpenAPI lint | 0errors/40warnings; log `repair-review-20261020-openapi.log`; lint không chứng minh route reachability/DTO/schema parity |
| DB17files, isolationnone/concurrency1 | 49results bị chặn setup DB_RUNTIME_MISSING;0pass, không coi là49lỗi nghiệp vụ; log `repair-review-20261020-db.log` |
| LocalDB/Docker | Không psql/pg_dump/postgres trên PATH, TEST_DATABASE_URL unset; Docker daemon không kết nối được |
| Wrangler dry-run | exit1 spawnEPERM; không deploy, chưa bundle/runtime acceptance |
| Probe review | `.review-artifacts/repair-review-20261020-probes.mjs/.json/.log`: xác nhận các sửa webhook/ZIP/dues/envelope và counterexamples mới. 0externalRequests,0realDbWrites. Schema guard/interleaving/ORDERBY model được ghi riêng. |
| Backup/restore missing-tool | Cả hai exit1, không tạo fake backup |
| Restore invalid verify | psql giả trả NOT_A_COUNT, exit0; log `repair-review-20261020-restore-fakeverify.log` |
| Dev/browser | Dev4332 báo `Failed to create the dev server app: module is not defined`; CUA báo local browser bị tắt trong Work settings. Đã dừng server review tạo; không bypass hoặc dùng screenshot cũ. |

Các unit mới phần lớn dùng SQL double hoặc assert text query; test quote chỉ gọi domain service, không đi qua router nên bỏ sót404. Không sửa mock để ép source sai chạy xanh. Không có Go trong phạm vi.

## Bước tiếp

Dùng prompt `docs/prompts/antigravity-next/repair-post22-round2.md`. Ưu tiên RF-01/02/03/07/08 trước; sau đó RF-04/05/06, public/export/restore và evidence. Giữ các source fixes đã đúng. Đừng mở module/tính năng mới; dependency thiếu runtime giữ BLOCKED, phần độc lập tiếp tục.
