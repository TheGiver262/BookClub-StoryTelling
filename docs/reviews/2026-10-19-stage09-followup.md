# Review chặng 09 — 19/10/2026

## Kết luận và phạm vi

**PARTIAL — chưa nghiệm thu partial/carry-forward trên PostgreSQL hoặc tiền thật.** Source09 sửa strict refund confirmation, return selectors, thêm settlement read model/PG DATE parser/calendar và guards managed source. Nhưng luồng PARTIAL INSERT dòng mới trước khi đóng old hold nên vi phạm unique index ngay trong cùng transaction. Nhánh pending còn ghi enum không tồn tại và thiếu finalize; tiền phạt pending chưa có đường thu sau. Không thể đóng R02/R09 hoặc gọi carryover đã sửa triệt để.

Đối chiếu prompt09 và lỗi06/07/08 liên quan, ưu tiên phần thay đổi theo snapshot08. Snapshot đầu lượt `.review-artifacts/stage09-review-manifest.json` gồm92 file; workspace không có Git metadata nên không gắn với commit. Tải tham chiếu dưới5.000 sách, dưới100 lượt/buổi,3–5 người nhập. Không sửa implementation, không commit/deploy/DB thật/PII thật. Không có Go thuộc phạm vi. UI không đổi nên không lặp browser review cũ.

## Findings cần sửa

### S09-01 — P1: Mọi PARTIAL hợp lệ bị unique active-copy chặn khi tạo dòng kế tiếp

**Vị trí:** `src/server/circulation/service.ts:813–841`; `docs/technical/schema/01_schema.sql:188–192`; unit SQL double loan_items INSERT.

INSERT loan_items mới cho kept copy diễn ra ở bước4; đến bước5 mới UPDATE old.carried_forward_at. Tại INSERT, dòng cũ vẫn returned_atNULL,is_lostFALSE,carried_forward_atNULL, dòng mới cũng vậy: cùng copy có hai dòng thuộc predicate unique. PostgreSQL kiểm uniqueness ngay tại statement, transaction không tự trì hoãn index này tới COMMIT. Thêm carried_forward_at vào predicate chưa đủ nếu thứ tự thao tác vẫn sai.

**Bằng chứng:** trace SQL/use case và DDL; SQL double bổ sung đúng predicate hiện có từ chối INSERT với23505, route trả500 và rollback về receipt cũ. Không gọi đó là execution PG thật. Double gốc không thi hành unique nên13 test partial vẫn pass.

**Sửa:** đóng logical hold cũ bằng carried_forward_at trước INSERT mới trong cùng transaction, rồi liên kết successor_item_id sau khi dòng mới tồn tại (hoặc preallocate ID với cơ chế FK hợp lệ). Không fake returned_at, xóa unique index hoặc disable constraints. Commit cuối chỉ một active hold và copy luôn BORROWED; fault giữa các bước rollback về hold cũ.

**Hồi quy:** PG thật cho P0/P60/P>=D, hai connection cùng copy, fault sau đóng hold/sau INSERT/sau link, chỉ một successor. Fresh schema và upgrade schema đều kiểm. Bỏ qua thì tính năng chính09 chưa dùng được dù unit xanh.

### S09-02 — P1: Pending cọc mới không hợp schema và không có đường hoàn tất

**Vị trí:** `service.ts:920–937`; enums loan_status/deposit_status trong schema; `circulation/types.ts:8`; router/use cases.

Code INSERT status PENDING_COLLECTION vào deposit_allocations rồi UPDATE receipt PENDING_DEPOSIT. DDL enum deposit_status không có PENDING_COLLECTION, loan_status không có PENDING_DEPOSIT; TS receipt status cũng chưa có. Sau khi sửa S09-01, nhánh T73 chưa nhận cọc sẽ tiếp tục lỗi22P02. Không có route/use case xác nhận thu mới để chuyển pending→HELD/ACTIVE; repeat settle phiếu cũ bị chặn PARTIAL_SETTLED và issue mới sẽ bị copy đang giữ chặn. Chỉ lưu pending label chưa hoàn thiện nghiệp vụ.

**Bằng chứng:** enum được đọc từ DDL hiện tại; adapter mô hình hóa enum check từ chối PENDING_COLLECTION. Chưa execution PG server. Trong mock gốc, enum tùy ý được chấp nhận nên test pending xanh.

**Sửa:** chốt trạng thái tối thiểu và migration/schema/types/contracts nhất quán; finalize khoản cọc mới với stable collection intent/source, amount/confirmation/actor/session và idempotency riêng. Pending giữ đúng physical hold/copyBORROWED, không ghi liability hoặc thu tiền đã xảy ra. Nhận sách A trước vẫn lưu được; xác định mốc hạn/carry của B rõ khi chờ. Hủy/sửa pending có audit, không xóa lịch sử.

**Test:** T73 pending→thu100k ca sau→một liability100k/thu100k, old forfeit150 không ghi lại; retry/two keys/two actors/fault; không tạo phiếu rỗng/hold rỗng. Không thêm enum đơn thuần rồi gọi lifecycle hoàn chỉnh.

### S09-03 — P2: Phạt chờ thu có số hiển thị lúc trả nhưng chưa có nghiệp vụ thu sau

**Vị trí:** `service.ts:750–760,1022–1066,1110,1357–1393`; router handlers.

Nhận sách giờ không bị rollback nếu chưa thu phạt — sửa tốt S08-03. Response có finePending, settlement lưu fine_final và fine_collected, nhưng GET không trả trạng thái/số cần thu riêng và không có source/route xác nhận thu khoản này sau. Không thể settle lại phiếu đã RETURNED/PARTIAL_SETTLED để thu. Stage10 gia hạn quá hạn cần chốt khoản phạt cũ một lần, không thể tái dùng một pending chỉ tồn tại ở response.

**Double:** full return phạt3k chưa thu vẫn RETURNED, finePending3k trong response; GET chỉ fineCollected0, không finePending/collection status. Không khẳng định số chênh không thể tính: thiếu đường thao tác nguồn để thực thu có kiểm chứng, actor/key/session/recovery.

**Sửa:** ý định/nguồn thu phạt tối thiểu có trạng thái pending/collected/waived, đọc lại và confirm riêng theo tiền thực, method độc lập refund. Không sửa snapshot quyết định cũ để giả đã thu; append/chứng từ liên kết, idempotency/uniqueness. **Test:** nhận sách→reload→thu phạt ở ca sau, BANK/CASH, mất response, two actors chỉ một receipt thu; miễn/điều chỉnh có lý do và quyền đúng, không thu lại khoảng phạt đã chốt.

### S09-04 — P2: Mapping cọc thiếu thì vẫn tạo successor không có allocation

**Vị trí:** `service.ts:844–845,942–999`; schema deposit_allocations.item_id nullable; shared receiveDeposit supports receipt-level source.

allocReturned/allocKept dùng find(item_id), sau đó if có thì xử lý, không có thì bỏ qua. DB vẫn cho allocation receipt-level item_idNULL hoặc nguồn chưa được backfill. Partial có thể commit old PARTIAL_SETTLED/new ACTIVE với hold mới nhưng không chuyển cọc B. Global reconciliation vẫn pass vì liability còn ở allocation phiếu cũ; nó không chứng minh mapping phiếu/dòng đúng.

**Double fixture hợp schema:** B có cọc100k receipt-levelNULL; partialP0 tạo successor, depositTransferred0, new allocations0, old còn HELD100k. Đó là tình huống legacy/mapping nguồn cần fail rõ hoặc phân bổ có căn cứ, không kết luận dữ liệu thực đã lỗi.

**Sửa:** assert allocation coverage/state/amount cho từng dòng trước mutation, hoặc migration/source allocation mapping rõ; ambiguous legacy bị từ chối trước nhận/chuyển tiền với hướng xử lý. Không đoán mapping theo amount, không tạo successor ACTIVE đủ cọc giả. **Test:** missing/NULL/multiple/PENDING_REFUND/transferred allocation, copied deposit snapshot khác remaining; toàn bộ bước final rollback nếu không phân bổ được, old money/hold không mất.

### S09-05 — P2: Chỉ sửa baseline CREATE không nâng được DB đã chạy các chặng trước

**Vị trí:** schema loan_items/index/enum và migration inventory.

carried_forward_at/successor_item_id chỉ thêm trong CREATE TABLE IF NOT EXISTS. DB08 đã có loan_items sẽ không được thêm cột. Index cùng tên CREATE UNIQUE INDEX IF NOT EXISTS cũng không thay predicate cũ; sau khi sửa thứ tự S09-01, old index vẫn xem dòng carried-forward chưa returned là active và chặn dòng mới. Chưa có migration tiến tới cho các thay đổi09; chỉ reset schema fresh không chứng minh upgrade.

**Sửa:** migration ALTER columns/FK và thay index có kiểm dữ liệu/transaction/locking phù hợp, enum/state theo quyết định lifecycle; xử lý dữ liệu cũ mơ hồ, bảo toàn receipts/journal/allocations. Không DROP schema/data thật để tránh viết migration. Ghi rõ baseline chưa apply hay đã apply; nếu mới chỉ draft, gate upgrade vẫn chưa đạt thay vì nhận đã hoàn tất.

**Test:** disposable DB từ snapshot schema08 có dữ liệu giả→upgrade09→partial/full/issue/active uniqueness; FK/row counts/ledger/history giữ nguyên; fresh schema cùng hành vi. Không dùng regex SQL làm PG evidence.

### S09-06 — P2: min(field,journal) chưa hợp nhất số dư và có thể từ chối hoàn đủ tiền

**Vị trí:** `service.ts:1208–1232`; `finance/deposits.ts` receive/refund; shared ledger writer.

Guard mới dùng min hai nguồn nên chặn được case overdraft trong report08, nhưng source field vẫn không được mọi shared writer cập nhật. min không tự sửa bất biến hoặc làm field thành actual cash. **Double:** opening0, receiveDeposit CASH50k qua shared helper, journal cash50k/field0; confirmRefund50k bị INSUFFICIENT_CASH_DRAWER dù journal đủ. Không có route HTTP receiveDeposit độc lập hiện tại; đây là service composition cần thống nhất trước khi10 tái dùng tiền/phạt.

**Sửa:** một nguồn cash available/cutoff chuẩn dưới cùng session lock; nếu materialize thì shared writer quản lý update đúng một lần, caller không tăng/trừ thêm gây double count. Sai lệch phải hiện rõ cần đối soát, không min im lặng rồi gọi “khớp100%”. **Test:** receive/refund/fine/reversal cả engine cũ/mới, BANK/CASH, source mismatch, close-vs-pay; đủ tiền được chi/thiếu giữ pending, summary/snapshot khớp.

### S09-07 — P2: API đọc phiếu chưa trả được chuỗi chuyển tiếp và nguồn cọc

**Vị trí:** `service.ts:322–420`; LoanReceiptDto/LoanItemSnapshotDto và get settlement.

getLoanReceiptById chưa SELECT/serialize preceding_receipt_id hoặc carried_forward_at/successor_item_id. GET old kept item có returned_atNULL nhưng không chỉ ra đã chuyển logical hold; GET successor thiếu predecessor. new allocation của carry không có LOAN_DEPOSIT journal nhận mới (đúng cash-neutral), nhưng lookup session chỉ tìm journal theo allocation mới nên trảNULL, không truy nguồn thu gốc. get settlement có successor ID là phần đúng nhưng không đủ cho cả chiều trace receipt/items/source.

**Double sau mock partial BANK:** transferred100k, successor GET.sessionNULL; predecessor/link trên DTO không có. Không đề xuất thêm CASH/BANK journal giả để có session.

**Sửa:** DTO trả lịch sử logical hold/current hold và predecessor/successor rõ; truy allocation lineage/source receipt/journal để phân biệt ca nhận gốc/ca chuyển/ca hoàn. Không biến transfer thành nhận cọc mới. **Test:** old→new→full return, chain nhiều bước hợp lệ, link không vòng, old item không hiển thị đang giữ thêm một bản, public/alumni không nhận borrower/tiền; source đọc lại không phụ thuộc cache response.

### S09-08 — P2: Các guard tiền/snapshot từ07 và chính sách cũ vẫn chưa đóng

**Vị trí:** `rules.ts:366–373,542–551`; `service.ts:173–192,877–916`; schema/current receipt read.

confirmedAmount khi issue vẫn optional; cọc mới T73 chỉ boolean, không amount/quote ràng buộc. newDepositConfirmed/finePaymentConfirmed nếu bị bỏ còn được suy từ paymentConfirmed chung. Cọc mới100k và thu phạt riêng là hành động khác, không được vô tình coi cùng flag cũ là xác nhận khoản tiền mới chưa đối chiếu. Snapshot giá bìa/căn cứ/policy/hạn gốc vẫn chưa persist dù settlement decision đã có; GET tiếp tục đọc metadata hiện tại. Calendar holidays giờ đã được nạp cho issue/partial — ghi nhận đúng, nhưng hạn gốc/lý do/version chưa lưu và chưa có quản lý lịch/điều chỉnh active loans đầy đủ.

**Sửa/test:** xác nhận khoản thu mới riêng gắn amount/source/quote, server tính cọc, thay giá thì conflict đối chiếu; snapshot tối thiểu và DTO tách lịch sử/hiện tại. Stage10 hoàn thiện lịch/version/hạn gốc/hiệu lực và grace rules đã chốt. Không tự quyết quỹ phạt/ngoại lệ còn mở; progress09 đã ghi gate phân quỹ BLOCKED là đúng, source FUND_LOAN chỉ policy thử khi chưa có quyết định vận hành. Không thu lại tiền vì DB lỗi/mất response.

### S09-09 — P2: Nhãn lifecycle/recovery DB PASS vượt test thực; fixtures còn chặn luồng

**Vị trí:** progress29/README; tests/integration/partial-return.test.ts và issue/return/cash fixtures; diagram06.

Partial mới3 test tuần tự, không overlap/fault/upgrade; helper mock không enforce unique/enums nên che S09-01/02. Progress gọi G-lifecycle-db/G-recovery-db PASS trong khi G-partial-db BLOCKED; unit không biến thành DB proof. Fixture opening1triệu khác seed350k không discrepancyReason; force-close test trước bỏ actual snapshot rồi mở cùng ngày vẫn xung đột guard. Return fixture giá50k+75k cọc150k đã sửa đúng, không còn báo lỗi125k/KE_01 cũ; còn lỗi buổi/handover. Issue/cash observer/deadline/fault gates từ các lượt trước chưa được đóng.

Diagram06 vẫn ghi partial là DỰ KIẾN chặng09, chưa phản ánh flow mới; nguồn/render chưa đồng bộ. OpenAPI có các field confirmation nhưng chưa mô tả/triển khai đủ pending states/finalize/chain. Catalog CRUD/date nhập/review metadata, body/type/UUID/Origin/rate-limit và provider/grants cũ không tự hoàn thành vì thêm93 kết quả unit.

**Sửa:** trung lập fixture đúng ngày/actual/reason, PG thật current+upgrade, constraints/enums, hai connection có blocking assertion/deadline/cleanup, fault sau từng mutation/audit/cache và lost response. Test read DTO thực, not only mock state arrays. Bảng gate source/unit/direct-handler/PG/application-role/Workers/provider riêng; PASS chỉ lệnh/môi trường/kết quả thật, tránh “triệt để/offline DB PASS”. Cập nhật diagram/render đúng phạm vi đã thực hiện.

## Đối chiếu carryover08

| Finding08 | Review09 |
|---|---|
| S08-01 omitted confirm | Đã sửa strict true ở service/router; direct-handler body{} nay400, không còn journal hoàn giả do bỏ flag |
| S08-02 duplicate/alias return | Đã sửa duplicate/mixed/required selector; [A,A] nay400; FULL/PARTIAL selection guard có. R02 vẫn bị S09-01 về DB lifecycle |
| S08-03 fine độc lập sách/method | Nhận sách khi chưa thu đã được lưu, fine method riêng; pending collection chưa hoàn chỉnh S09-03 |
| S08-04 cash hai nguồn | min chặn overdraft case cũ nhưng vẫn hai nguồn và false reject S09-06 |
| S08-05 settlement/DATE | Có loan_settlements và DATE1082 string parser, GET quyết định không tính lại theo hôm nay; ghi nhận source sửa. Price/calendar snapshots và fine collection status còn S09-03/08 |
| S08-06 direct reversal nguồn mới | Managed set đã thêm LOAN_DEPOSIT_REFUND/LOAN_FINE_FORFEIT/LOAN_FINE; giữ sửa. Refund/mapping/lineage còn cần thống nhất S09-04/06/07 |
| S08-07 transaction | Create copy/borrower đã bọc, các caller đã chỉ ra được sửa trong source. Raw BEGIN ngoài __in_tx vẫn là contract limitation, không có runtime caller mới chứng minh đang dùng; không báo lỗi reconnect cũ còn nguyên |
| S08-08 amount/calendar/policy | Calendar đã nối bảng; amount/snapshots chưa đủ S09-08; policy phân quỹ đã thừa nhận BLOCKED, không biến fixture thành phê duyệt |
| S08-09 tests/fixtures | Đã sửa enum vị trí/cọc return; fixture buổi/PG concurrency/migration và gate labeling còn S09-09 |

## Các chặng trước còn mở

| Nguồn | Trạng thái liên quan hiện tại |
|---|---|
|02/R01/R03: schema/invariants | Fresh/upgrade/concurrency PG chưa chạy; R02 active-copy chuyển tiếp chưa đóng vì S09-01/05 |
|03/R05 và security R06 | Managed provider, multi-instance/token lifecycle, application-role grants, body-size/Origin/CSRF/rate-limit, Workers chưa nghiệm thu; RBAC unit không thay runtime |
|04/R04: journal/idempotency | Managed-source guards/intent có tiến triển; cash source, collection lifecycle/rollback thật còn mở; không nghiệm thu tiền từ Nợ=Có hoặc mock |
|05: cash session | Transaction wrappers source tốt hơn; DB unique buổi/custodian/actual handover/concurrency vẫn thiếu proof; min không thay cash invariant |
|06: catalog/borrower | Giá0 source đã giữ; create/update/archive có transaction/audit. Metadata title/edition/associations/date nhập/review và validation còn chưa đủ; borrower query đã bỏ PARTIAL_SETTLED blanket và xét carried_forward_at đúng hướng |
|07: issue/receipt | BANK session source và selectors được sửa; amount optional, price/policy/date snapshots và PG tests còn mở |
|R09/R10 UI prototype | UI source không đổi; chưa đóng lỗi UI bằng backend unit, stage12 vẫn cần runtime tích hợp. Calendar date/fine tiếp tục10 |

Review cũ là snapshot; bảng trên là trạng thái theo source hiện tại và gate chưa chạy, không lặp review toàn repo hoặc suy mọi module dự kiến đã hoàn thành.

## Kiểm tra thực hiện

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;55 file;0 error,0 warning,16 hint;tsc pass | Source/type |
| Astro build `.review-artifacts/stage09-build` | Exit0;3 trang static | Không backend Workers |
|11 unit files, isolation none | Exit0;93 pass,0 fail | SQL double/direct handler, có wrapper file không khai báo test |
| Python unittest discover | Exit0;22 pass | PoC/regex |
| Redocly2.64.1 lint | Exit0;0 error,23 warning | Chưa semantic parity |
|8 DB files, isolation none/concurrency1 | Exit1;37 test bị before-hook DB_RUNTIME_MISSING |0 assertion PG nghiệm thu |
| Docker/PATH/env | Daemon pipe unavailable; psql/postgres không PATH; TEST_DATABASE_URL không cấu hình | Không dùng cloud/DB thật |
| Wrangler local8796 | Exit1;launcher spawn EPERM | Chưa kiểm Workers HTTP |
| Counterexamples09 | Exit0; JSON source-level evidence |0 external request,0 real DB write |

Script/JSON tại `.review-artifacts/stage09-counterexamples.mjs` và `.json`. Adapter bổ sung unique predicate/enum đọc từ DDL để chứng minh code gốc không thỏa điều kiện, không gọi đó là PG execution. Các kiểm đọc/nguồn tiền khác dùng SQL double gốc để cô lập lỗi sau khi đi qua nhánh mà PG hiện sẽ chặn sớm. Fixture mappingNULL là dữ liệu giả hợp schema, không khẳng định DB thực đã có tình trạng này. Raw outer trace tiếp tục chỉ là giới hạn contract.

## Bàn giao

[Prompt10](../prompts/antigravity-next/10-renewal-calendar.md): sửa S09-01..09/carryover trước, rồi renewal/calendar với giới hạn3lần, +14ngày, late fine cutoff và retry không thu lại. Không fake trả/mượn để gia hạn hoặc dùng thêm chain để né giới hạn cùng phiếu. Giữ22 chặng, chưa tự làm11.

**Chưa kiểm:** PostgreSQL thật, provider, application-role grants, Workers HTTP, mobile, ngân hàng, load/penetration/restore. Implementation không đổi trong lượt review; chưa đủ dùng tiền/PII thật.
