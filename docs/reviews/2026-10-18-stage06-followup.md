# Review chặng 06 — 18/10/2026

## Kết luận

Chặng06 thêm catalog/borrower services, routes, DTO, rule và tests thực; đã sửa một số đường lỗi05. **Verdict: PARTIAL; sửa S06-01 trước khi nghiệm thu cho mượn/tiền.** Không xác nhận “S05-01..08 đã sửa dứt điểm”. HTTP vẫn thiếu transaction; catalog còn thiếu quản lý đầu sách/ấn bản và có lỗi dữ liệu/validation/audit.

Phạm vi: prompt06 và phần đổi so snapshot `.review-artifacts/stage05-review-manifest.json`; snapshot đầu review hiện tại `.review-artifacts/stage06-review-manifest.json` (79 file). Workspace không có Git metadata nên không gắn kết luận với commit. Giả định tải đã chốt: dưới5.000 sách, dưới100 lượt/buổi, 3–5 người nhập. Không sửa implementation, không dùng dữ liệu thật/cloud. Không có Go trong phần review. Bằng chứng SQL double/direct handler không phải PostgreSQL/Workers.

## Phải sửa

### S06-01 — P1: Transaction chưa tồn tại tại caller; khóa và idempotency không bảo đảm nguyên tử

**Vị trí:** `src/server/router.ts:561–666`; `src/server/finance/ledger.ts:113–140`; `deposits.ts:162–197`; routes catalog/borrower và các helper FOR UPDATE liên quan.

Đã thêm guard session ở writer, nhưng router vẫn truyền Pool trực tiếp, không connect/BEGIN/COMMIT. FOR UPDATE chỉ bảo vệ câu SELECT trong autocommit, không giữ tới INSERT/UPDATE tiếp theo. claimIdempotency, mutation và completeIdempotency cũng là các commit riêng. Chỉ thêm SELECT FOR UPDATE vào helper không giải quyết được hợp đồng caller.

**Phản ví dụ offline:** chèn lịch câu lệnh: writer kiểm ca open → close chốt200k → writer INSERT50k; snapshot vẫn200k, summary250k. Đây là mô hình interleaving mà autocommit cho phép, chưa execution race trên PG. Ca nhận vào session đã đóng bị từ chối nhưng nếu caller không transaction thì allocation đã INSERT trước đó còn HELD, journal không có. Fault injection tại completeIdempotency sau open: request500, ca đã tồn tại, retry cùng key409; không replay được biên nhận đã có.

**Sửa nhỏ nhất:** một transaction trên cùng client tại use case; helpers không nhận Pool cho thao tác cần nguyên tử mà không có guard/contract. Session lock trước allocation/intent/copy theo thứ tự chung. Side effect, allocation, journal, audit, idempotency result cùng commit; rollback lỗi thật, không mark FAILED rời sau mutation đã commit. Read summary/close dùng cutoff nhất quán. Áp cùng cơ chế cho metadata/archive nhiều bước, không tự viết một framework transaction mới.

**Hồi quy:** PG hai connection quan sát blocking/deadline, close tranh receive/refund/reversal, fault giữa từng bước và cached-result write. Retry sau mất response đúng biên nhận, một hiệu lực; không orphan allocation/journal. Đường ảnh hưởng: session, deposit, issue07, metadata/archive, member status và logout khi cần atomic. Bỏ qua sẽ tiếp tục lệch sổ khi nhiều người nhập hoặc DB lỗi giữa chừng.

### S06-02 — P2: Use case đảo cọc không nhận được ca đích; dữ liệu cũ vẫn chọn theo amount

**Vị trí:** `deposits.ts:591–659`; `ledger.ts:233–260`; ReverseDepositParams.

Nguồn mới đã liên kết allocation.id, VOIDED và reconciliation được thêm đúng hướng. Nhưng reverseDepositAllocation không có/không truyền targetCashSessionId xuống recordReversal. Cọc CASH thuộc ca cũ đã đóng sẽ bị recordReversal đổi session thành null rồi writer từ chối CASH_SESSION_REQUIRED, dù đang có ca mới hợp lệ. Trong caller không transaction, allocation đã chuyển VOIDED trước lỗi. **Double tái hiện:** truyền ca mới vẫn lỗi, allocation VOIDED còn journal gốc.

Fallback dữ liệu cũ vẫn LIMIT1 theo receipt+amount. Hai cuốn cùng cọc50k không phân biệt nguồn; có thể chọn journal đã đảo hoặc dòng khác. Reconciliation tổng không chứng minh đúng nguồn; lỗi không được biến thành rollback nếu caller không transaction.

**Sửa:** source reversal nhận ca đích hợp lệ/actor/reason, khóa theo thứ tự chung và truyền xuống writer. Với legacy, backfill mapping có bằng chứng hoặc từ chối trường hợp mơ hồ; không đoán theo amount. Chỉ cập nhật VOIDED khi toàn use case commit. **Test:** đảo cuốn100k trong phiếu50k+100k đúng100k (đã tái kiểm pass offline); đảo CASH ca cũ tại ca mới; legacy hai dòng cùng giá; rollback/retry/concurrent. Giữ snapshot ca cũ.

### S06-03 — P2: Mutation catalog/borrower bỏ actor, không ghi nhật ký

**Vị trí:** `catalog/service.ts:321,387,458`; `borrowers/service.ts:116,143,196`; router các caller tương ứng.

Các hàm nhận `_actorId` rồi không dùng; không INSERT system_audit_logs, không có middleware DB/audit tương ứng. Thành viên sửa giá/kho/ghi chú, tạo/sửa/archive hồ sơ đều không truy được ai thực hiện trong nhật ký. **Double trace:** tạo rồi archive borrower thành công,0 câu audit.

**Sửa:** tái dùng bảng audit hiện có, actor/action/resource/ID và phần thay đổi cần thiết trong transaction mutation; không lưu password/token/PII toàn bộ vào details. **Test:** sửa giá/vị trí và borrower tạo được audit đúng actor; audit thất bại rollback mutation; chỉ admin xem log. Không đợi stage21 mới ghi sự kiện đã mất:21 là xem/tổng hợp nhật ký. Bỏ qua làm mất khả năng quy trách nhiệm đã yêu cầu.

### S06-04 — P2: Giá0 bị ghi thành NULL

**Vị trí:** `catalog/service.ts:342–358`.

INSERT dùng `coverPriceBigInt ? ... : null`;0n là falsy. Response tạo trả0 nhưng DB nhận NULL, lần đọc sau mất giá đã biết. **Double:** createResponse0, storedNULL, rereadNULL.

**Sửa:** kiểm khác null rõ ràng; validate trước convert. **Test:** create→read trên PG cho NULL,0,74k; update0/NULL; snapshot phiếu không đổi khi catalog đổi. Cọc cả0/NULL đều50k không có nghĩa dữ liệu hai trường hợp giống nhau.

### S06-05 — P2: Archive người mượn bỏ sót phiếu quá hạn

**Vị trí:** `borrowers/service.ts:196–229`; enum loan_status trong schema; test borrowers4.

Guard chỉ kiểm status='ACTIVE'. Schema còn OVERDUE và PARTIAL_SETTLED, nhưng phiếu quá hạn vẫn có sách chưa trả. **Double:** borrower có OVERDUE được archive thành công. Test hiện chỉ đổi ACTIVE→RETURNED nên không bắt lỗi.

**Sửa:** căn cứ dòng sách/ nghĩa vụ thực chưa giải quyết và trạng thái hợp lệ, không chỉ một nhãn; phối hợp lock với issue07 để tránh archive và mượn mới cùng lúc. Không đặt cấm vĩnh viễn vì từng có lịch sử. **Test:** ACTIVE, OVERDUE, phiếu chuyển tiếp/partial, không còn dòng đang giữ, nghĩa vụ còn chờ hoàn nếu policy áp dụng, race archive-vs-issue. Nếu bỏ qua, có thể ẩn người còn giữ sách khỏi tra cứu mặc định.

### S06-06 — P2: Validation HTTP dựa vào type TypeScript; input sai tới DB hoặc thành500

**Vị trí:** `catalog/service.ts:56–60,342–351,412–427`; `borrowers/rules.ts:69–110`; `borrowers/service.ts:50–54`; router request-body/path/query parsing.

Body được cast any, không kiểm shape/type trước trim/BigInt. **Direct handler:** coverPrice74000.5→500; fullName123→500. BigInt còn có thể nhận boolean/chuỗi mà contract là giá nguyên. Pagination chỉ Math.max/min: page=Infinity,limit=2.5 được chuyển thẳng thành OFFSET Infinity/LIMIT2.5; query/author/category chưa có length bound. ID/location/field lengths chưa kiểm hết ở biên, lỗi FK/enum/unique race thành500 thay domain400/409.

**Sửa:** validation nhỏ ở trust boundary, object-only/allowlist/type/range/length, integer finite an toàn cho tiền và pagination; null giữ nghĩa riêng; UUID/path/date/enum đúng contract. Map lỗi PG dự kiến sang domain, không để lộ SQL/PII. Không thêm dependency chỉ cho vài rule nếu đã có helper thích hợp. **Test:** null/array/string body, tên số, giá boolean/fraction/unsafe, malformed ID, enum lạ, trùng barcode concurrent, page âm/lẻ/Infinity/huge/query dài; từ chối trước DB. Không gọi input invalid là lỗi hệ thống.

### S06-07 — P2: Catalog chỉ thêm được bản của ấn bản đã có; chưa quản lý metadata yêu cầu

**Vị trí:** exports `catalog/service.ts`, routes `router.ts:687–873`, schema book_titles/editions/copies.

Chỉ có search/detail/copy CRUD. Không có use case/route tạo hoặc sửa title, edition, author/category associations, quản lý review metadata/ngày nhập riêng theo yêu cầu06. Muốn thêm cuốn hoàn toàn mới phải INSERT SQL/seed rồi mới tạo copy. **Direct handler POST /catalog/books trả404**, integration test cũng tự INSERT title/edition. created_at của record không tự thay được ngày nhập thực khi nhập sách cũ.

**Sửa:** hoàn thiện thao tác catalog tối thiểu trong cùng pattern, actor/audit/transaction và FK, không xây CMS mới. Nhập ngày thực phù hợp; state review dùng nguồn chuẩn đã chốt, không triển khai full SEO/moderation20. **Test:** từ DB không có đầu sách mới, member tạo title+nhiều tác giả/thể loại→edition→hai copy→sửa metadata→tìm public; không cần SQL thủ công. Giữ archive/history, public allowlist và tách sách bán. Giá cọc public theo edition cần ghi rõ là tham khảo hoặc range; LIMIT1 sample không là giá chuẩn cho mọi copy khác giá.

### S06-08 — P2: Vẫn mở được hai ca cùng buổi và có thể lưu sai nguồn bàn giao

**Vị trí:** `cash-sessions.ts:187–249`; schema cash_sessions indexes.

Kiểm ID tồn tại chỉ lặp lại PK, không unique buổi. **Double:** đóng một ca rồi mở ID khác cùng ngày vẫn được. Tự lấy ca gần nhất đã có, nhưng client gửi handedOverFromSessionId khác thì vẫn lưu field đó trong khi kiểm opening theo ca gần nhất. FK chỉ chứng minh ID tồn tại, không chứng minh đúng nguồn/đã đóng.

**Sửa:** server định danh buổi, uniqueness theo buổi; predecessor phải là nguồn chuẩn, reject client cố chỉ khác, buổi đầu và sửa sai có contract rõ. Người trực chính/custodian xác nhận chưa được thể hiện đầy đủ. **Test:** same-day khác ID/key, concurrent, predecessor cũ/đang mở/sai, handover chênh cần lý do. /today đã lọc ngày Việt Nam đúng hướng; chưa có runtime clock-boundary proof.

### S06-09 — P2: Gate “dứt điểm” và “DB tests sẵn sàng” vẫn chưa có bằng chứng

**Vị trí:** progress19/20; `tests/integration/cash-sessions.test.ts:29–35,63–110,245–289`; seed107–108; OpenAPI close765–792; tests unit/mock-db-helper.

Cash test fixture vẫn seed sẵn một ca open nên test năm open kỳ vọng một winner sẽ không đạt. Test cấm ghi ca đóng vẫn tự SELECT rồi tự throw, không gọi writer. Concurrency finance observer chưa assert đã thấy blocking/deadline; tests mới04 chỉ kiểm catalog/borrower thuận lợi, không có PG archive/validation/audit/HTTP tiền hồi quy. Helper mới tách đăng ký test là sửa tốt, nhưng nó không thi hành filter/pagination/SQL constraints đầy đủ; pass không kiểm được những phần đó.

OpenAPI đã thêm open/summary nhưng close vẫn thiếu sessionId, idempotency header và response envelope/summary chưa khớp route; description route mới/operation count chưa cập nhật. Bản19 còn gán nhầm nội dung S05-06/07 và vẫn ghi COMPLETED đã duyệt trong khi source chỉ còn APPROVED_FOR_ALUMNI. Gate tổng hợp PASS che phần chưa làm/kiểm.

**Sửa:** fixture trung lập; test production entry point, fail trước fix, true PG overlap/fault/permissions; contract test schema đối với response thật. Tách unit/direct handler/PG/application-role/Workers/provider, bỏ nhãn carryover “triệt để” và “100% ACID” không chứng minh. 24 warnings lint không phải24 lỗi code; vấn đề chính là parity/bằng chứng.

## Đối chiếu chặng05

| Finding05 | Kết quả review06 |
|---|---|
| S05-01 transaction/session | Guard writer hiện chặn thiếu/đóng ca và sai quỹ; transaction caller/lock lifetime còn S06-01 |
| S05-02 đảo đúng dòng | Nguồn mới allocation.id và VOIDED/reconcile đã có, tái kiểm đảo100k đúng100k; legacy/ca đích còn S06-02 |
| S05-03 logout DB failure | Đã sửa đúng nhánh nuốt lỗi: direct handler trả503. Xác minh token trước ghi, expiry, atomicity, provider/multi-instance chưa nghiệm thu |
| S05-04 COMPLETED leak | Lỗi cụ thể đã sửa: chỉ APPROVED_FOR_ALUMNI; direct handler COMPLETED trả danh sách rỗng. Bản nội dung an toàn/duyệt lại khi sửa vẫn cần giữ ở19/20 |
| S05-05 buổi/handover | Có tự tìm ca trước và lý do chênh; ngày Việt Nam ở/today; uniqueness/predecessor còn S06-08 |
| S05-06 nghĩa vụ còn lại | Đã tách delta và lấy tổng allocation toàn quỹ, không còn lấy delta làm remaining; cutoff/summary lịch sử/serialize an toàn còn chưa kiểm PG |
| S05-07 test | Đã tách helper, không còn đăng ký lặp do import cash test; fixture/tự throw/PG races còn S06-09 |
| S05-08 contract/evidence | Có idempotency/no-store ở session routes, nhưng atomicity S06-01 và contract/gates S06-09 còn mở |

S04-07 chuyển admin→alumni chỉ isAlumni:true đã được source sửa tự bỏ admin. Không tự đóng toàn bộ Auth03: provider, rate-limit/body-size/Origin/CSRF, token lifecycle, grants và runtime vẫn là gate riêng. Catalog search dùng unaccent(lower(...)) ILIKE, không dùng index search_vector/trgm nguyên title trực tiếp; chưa đo plan/latency để gọi optimized hoặc kết luận chậm ở tải thực.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả | Cấp bằng chứng |
|---|---|---|
| `rtk pnpm run check` | Exit0;45 file;0 error,0 warning,16 hint;tsc pass | Source/type |
| Astro build vào `.review-artifacts/stage06-build` | Exit0;3 trang static | Frontend build, không backend Workers |
|8 file unit với `--test-isolation=none` | Exit0;55 pass,0 fail | SQL doubles/direct handlers, có wrapper của file không khai báo test |
| Python unittest discover | Exit0;22 pass | PoC/regex |
| Redocly2.64.1 lint | Exit0;0 error,24 warnings | Cấu trúc OpenAPI, chưa parity |
|5 file DB tests, isolation none/concurrency1 | Exit1;24 test bị before-hook DB_RUNTIME_MISSING |0 assertion PG được nghiệm thu |
| Docker/PATH/env | Daemon pipe không có; psql/postgres không PATH; TEST_DATABASE_URL không cấu hình | Không có DB local để nghiệm thu |
| Wrangler local8796 | Exit1;launcher spawn EPERM | Không có Workers HTTP pass; không sửa source/dependency để né môi trường |
| Counterexamples06 | Exit0; JSON phản ví dụ và kiểm lại nhánh đã sửa |0 external network request,0 real DB write |

Script/JSON tại `.review-artifacts/stage06-counterexamples.mjs` và `.json`. Interleaving có điều khiển/fault injection là bằng chứng logic, không chứng minh MVCC/grants/lock timing PG. UI source không đổi so05 nên không lặp browser/mobile review. Không gọi prototype tài chính đang có là UI đã nối backend mới.

## Bàn giao

[Prompt07](../prompts/antigravity-next/07-issue-loan.md) gồm sửa S06-01..09 rồi triển khai lát cho mượn1–2 bản, xác nhận nhận tiền, cọc/snapshot/journal/audit/idempotency chung transaction. Giữ22 chặng, chưa tự làm08. Nếu PG/provider/Workers vẫn thiếu, hoàn thiện phần độc lập và giữ PARTIAL/BLOCKED; không bật chế độ tiền/dữ liệu thật.

**Chưa kiểm:** PostgreSQL thật, application-role grants, provider, Workers HTTP, mobile, ngân hàng, load/penetration/restore. Code và local evidence chưa là nghiệm thu vận hành.
