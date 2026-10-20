# Chặng 09 — Sửa carryover08, trả một phần và chuyển tiếp không mất lịch sử/cọc

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## 1. Đọc thêm và phạm vi

Đọc `docs/reviews/2026-10-19-stage08-followup.md`, review06 theo yêu cầu kiểm carryover, review07/prompt08 khi cần truy vết; code/schema/OpenAPI/finance/calendar/Audit/tests hiện tại. Bằng chứng `.review-artifacts/stage08-counterexamples.mjs` là SQL double/direct handler, không PG server. Giữ report reviewer nguyên như snapshot, không sửa report để tự đóng finding.

**Phụ thuộc:**08, R02/R09/R10 và carryover06/07/08 liên quan. Dùng `src/server/` hiện có, thêm carry-forward nhỏ trong circulation và shared rules khi cần; không tạo cây src/modules song song, hệ tiền thứ hai, ORM/microservices hoặc viết lại UI. Reuse ledger/deposit/refund intent/idempotency/audit/transaction boundary sau khi sửa bất biến, không copy engine08 để làm engine09.

Làm theo thứ tự: sửa lỗi chặn tiền/tồn sách → hoàn thiện trạng thái/contract/tests còn thiếu → partial/carry-forward. Không coi08 đã đạt gate vì80 unit pass. Có thể hoàn thiện domain/tests độc lập khi runtime thiếu, nhưng chỉ PG thật mới đóng gate transaction/constraints/concurrency. Không bật HTTP tiền thật hoặc fallback RAM/mock khi DB/Auth chưa sẵn sàng. Giữ22 chặng; không triển khai renewal10/lost11/UI12 trong task này.

## 2. Sửa carryover trước

### 2.1 S08-01/02 — xác nhận tiền và danh sách sách chính xác

- confirm refund bắt buộc `paymentConfirmed === true`, strict boolean/object/body bounds; omitted/null/false/0/string đều400 trước mutation, không default true. OpenAPI có requestBody/session/confirmation đúng. Amount/method/source lấy từ intent đã chốt, không body tùy ý; actor từ live Auth.
- Chuẩn hóa một selector trả sách, tên returnedCopyBarcodes trong OpenAPI phải được hỗ trợ hoặc sửa contract có kiểm tương thích. Reject duplicate sau normalize, mixed selector/alias conflict, rỗng/thiếu selector, mã sai/không thuộc phiếu. Không lọc im lặng phần tử lỗi hoặc nhận toàn bộ vì field bị bỏ qua.
- FULL là đúng tập sách thực trả; PARTIAL09 là đúng một dòng trong phiếu2dòng hợp lệ. UPDATE đúng item được xác nhận, không cập nhật lost/đã chuyển tiếp/không mang trả. Test[A,A] không làm B AVAILABLE; contract field[A] không âm thầm trả B; omitted confirm không post journal.

### 2.2 S08-03/05 — nhận sách, quyết định phạt và tiền là các trạng thái riêng

- Nhận sách phải lưu được dù tiền phạt cần thu riêng chưa nhận hoặc cọc chưa hoàn. Lưu decision/chờ thu/đã thu/miễn và refund pending/paid/forfeited; không post thu ảo hoặc rollback nhận sách thực vì thiếu xác nhận fine.
- Fine payment có phương thức/amount/reference/xác nhận riêng, độc lập refundMethod; hỗ trợ CASH fine+BANK refund và ngược lại. Stable source cho lần thu, idempotency+business uniqueness chống thu hai lần. Không dựng công nợ tổng quát ngoài nhu cầu.
- Persist settlement decision tối thiểu: gợi ý/chốt/lý do/policy/cutoff/ngày nhận/actor, phạt thực thu hoặc giữ, cọc pending/paid/transfer, source IDs; GET đọc lại không tính phạt thêm do tiền chậm. Cached response/audit không thay bảng nguồn nếu GET không thể phục hồi nghiệp vụ.
- Đổi field `depositRefunded` hoặc mô tả/DTO rõ khi mới pending: số được hoàn khác số đã chi. GET/biên nhận sau reload phải giữ mức miễn/giảm, fine thu sau cập nhật trạng thái đúng nhưng không sửa decision cũ âm thầm.
- Chuẩn hóa PG DATE thành YYYY-MM-DD tại boundary; test parser pg thật và timezone UTC+7. Không String(Date) rồi split('-'), không toISOString làm lệch ngày địa phương. GET settlement với DATE driver thật không được500.

### 2.3 S08-04/06 — một engine tiền, một nguồn số dư

- Chọn nguồn chuẩn cash available dưới cùng session lock: opening+ledger hoặc materialized balance được mọi writer duy trì atomic có invariant. Không để confirmRefund mới đọc field trong khi finance.confirmDepositRefund/reversal chỉ ghi journal. Snapshot close/tiền thực đếm tách expected, không sửa thực đếm để ép khớp.
- Hợp nhất/reuse refund use case cần thiết: pending intent, allocation state/remaining, amount/method/source/lineage phải kiểm chính xác; full/partial intent có hợp đồng rõ. Không đặt remaining=0 cho intent chỉ hoàn một phần; không dựa tổng quỹ để chứng minh đúng mỗi allocation.
- Danh mục managed source chuẩn dùng chung; LOAN_DEPOSIT_REFUND/LOAN_FINE_FORFEIT không được lọt direct reversal chỉ vì khác DEPOSIT_REFUND/FINE_FORFEIT. Chặn trước ghi hoặc cung cấp source reversal phối hợp allocation/intent/decision/journal/audit; không public bypass boolean.
- Không tạo thêm pending intent cho allocation đang có ý định khác mà không amend/cancel có audit. Sau forfeit/transfer không để intent cũ còn có thể được confirm sai; source uniqueness/locks chặn hai key/actor.
- Test composition helper cũ/mới: opening100k, BANK cọc50k+100k, hoàn CASH50k qua helper A rồi đòi hoàn100k qua B phải giữ pending vì chỉ còn50k. Direct đảo nguồn08 bị chặn; partial intent/retry/fault không lệch allocation/liability/cash. BANK liên kết ca nhưng không cộng hộp CASH.

### 2.4 S08-07/08 — transaction, snapshot, calendar và policy chưa chốt

- Bọc cả create copy/create borrower cùng audit trong transaction; update/archive/session đã bọc thì giữ. Transaction owner rõ Pool/Client/PoolClient; không reconnect/release/COMMIT hộ outer raw BEGIN. Nếu chỉ hỗ trợ transaction do helper tạo, type/entry contract phải cấm cách gọi sai; không suy có outer transaction chỉ từ cờ riêng rồi hứa hỗ trợ mọi Client. Không thêm savepoint framework nếu không cần.
- Khóa theo thứ tự chung cho partial/full/confirm/issue/reverse/close/transfer; truy vết callers, không chỉ sửa comment. Session và nhiều ID lock ổn định; không còn engine giữ allocation/intent rồi mới khóa ca ngược thứ tự.
- confirmedAmount/quote phải bắt buộc đủ ràng buộc khi thu cọc mới, không optional bypass bằng boolean. Giá/cọc đổi giữa preview và confirm phải conflict trước journal; server tính giá, không tin client quyết định cọc.
- Persist giá bìa nullable/căn cứ/policy và metadata snapshot cần giữ; sửa catalog không đổi chứng từ. Calendar holiday source phải thực sự được truyền/đọc trong issue/partial, lưu hạn gốc/hiệu lực/lý do/version, ca đúng buổi/ngày. Chỉ có hàm nhận holidays=[] chưa là tích hợp nghỉ lễ.
- Quỹ nhận phạt/giữ cọc vẫn là policy mở trong docs06: kiểm quyết định mới; nếu chưa có thì cấu hình explicit cho fixture/domain, ghi gate phân quỹ vận hành BLOCKED, tiếp tục phần độc lập. Không tự hardcode quỹ này hoặc kia rồi báo đã phê duyệt; progress và code phải nhất quán. Không hỏi lại quy tắc tiền đã chốt.

### 2.5 S08-09 và carryover06 — kiểm chứng đúng môi trường

- Sửa return fixture location KE_01 thành giá trị enum đúng, không thêm enum chỉ để hợp test.75k cọc100k,150k cọc150k, tổng250k; không125k hoặc50k cho cuốn75k. Handover/opening có actual/reason đúng, từng test độc lập buổi/date/unique, không force-close bỏ snapshot rồi tự nhận fixtures sẵn sàng.
- Sửa bind positions trong SQL double UPDATE refund_intents theo query thực; mock không thi hành đủ constraint/DATE/grants nên không thay PG integration. Test source use case/route thật, fault sau từng INSERT/UPDATE/audit/cache, lost response, hai connections overlap có blocking assert/deadline/cleanup.
- Hoàn thiện các mục06 còn thiếu đúng phạm vi: catalog metadata update/associations/date nhập thực/review state, validation object/type/UUID/safe-money/page-size/offset, archive OVERDUE/dòng/cọc. PARTIAL_SETTLED lịch sử đã hết nghĩa vụ không bị chặn archive vĩnh viễn chỉ vì label.
- Buổi unique bằng constraint DB đúng định danh; source predecessor/custodian có audit/transaction. Source check trước INSERT không thay uniqueness PG. Migrations tiến tới nếu baseline đã apply; không chỉ sửa CREATE TABLE IF NOT EXISTS.
- Giữ source/unit/direct-handler/PG/application-role/Workers/provider riêng. G-carryover theo từng S06/S07/S08, không “triệt để100%” từ test count. Không gọi missing PostgreSQL là bằng chứng mọi fixture/ACID test đã đúng.

## 3. Quy tắc PARTIAL và chuyển tiếp

### 3.1 Contract, quyền và chọn đúng sách

- Tái dùng `POST /api/v1/circulation/loans/{id}/settle-return`, dispatch FULL/PARTIAL rõ, cùng validation/base engine. Active member/admin, live Auth trước mutation và cached replay; guest/alumni/disabled/revoked không đọc phiếu/PII/tiền. Body/path/size/Origin/rate-limit theo cookie/Bearer thật, response nhạy cảm no-store.
- PARTIAL chỉ khi phiếu hợp lệ có2dòng còn giữ và thực trả đúng1, giữ đúng1. Trả0 dùng gia hạn ở10, trả2 dùng FULL; reject barcode/ID trùng/lạ/không thuộc phiếu/đã trả/đã chuyển/LOST ngoài scope. Không tự tạo phiếu rỗng hoặc phiếu mới chỉ có dòng đã trả.
- Idempotency key bắt buộc, hash gồm path receipt ID và normalized payload đúng actor/op; source settlement/carry-action unique chặn cùng ý định bằng key khác. Không coi mỗi lần key khác là một giao dịch mới hợp lệ trên phiếu đã chuyển tiếp.
- Không tạo borrower/account mới khi chuyển; giữ đúng chủ phiếu và liên kết lịch sử. Chưa có giới hạn tổng sách/người; không tự thêm “tối đa2 mọi phiếu” hoặc cấm người quá hạn mượn khi policy chưa chốt.

### 3.2 Vòng đời dòng sách: kết thúc chuyển tiếp khác trả vật lý

- Mô hình hóa terminal reason/state/timestamp cần thiết cho dòng cũ: RETURNED khác CARRIED_FORWARD khác LOST. returned_at chỉ khi nhận sách thật, không gán thời điểm chuyển tiếp để vượt unique index. Copy giữ tiếp luôn BORROWED; copy thực trả thành AVAILABLE tại vị trí nhận đúng, có audit/hand-over nếu cần.
- Receipt cũ chốt PARTIAL_SETTLED với settlement ID; receipt mới preceding_receipt_id=phiếu cũ, có1dòng đúng copy còn giữ; old/new item có link không mơ hồ, không vòng lặp. Giữ chronology và truy toàn chuỗi vật lý/cọc.
- Unique active-copy predicate phản ánh dòng chưa kết thúc quyền giữ, kể cả chuyển tiếp. Kết thúc old logical hold rồi tạo new logical hold trong cùng transaction; không thời điểm commit nào cho copy không có hold hoặc2hold. Không xóa unique index/disable trigger/chấp nhận fake returned_at. Trigger tối đa2 vẫn đúng với INSERT/update/migration.
- Rà mọi query predicate hiện dùng returned_at IS NULL AND is_lost=FALSE: issue, archive borrower/copy, returned counts, reports/list/detail, active uniqueness, schema/tests/diagrams và full return/confirm liên quan. Chỉ query nghiệp vụ có lý do mới xét dòng cũ, không tính double count qua chuỗi.
- Migration tiến tới/backfill dữ liệu cũ có evidence, ambiguous legacy fail rõ để xử lý, không dựng fake physical return. Test trước/sau constraint trong PG; schema draft/upgrade phân biệt.

### 3.3 Ngày và phạt phiếu cũ

- Chốt phạt cả phiếu cũ ngay tại mốc nhận1cuốn,1.000đ/ngày cho toàn phiếu, không nhân2; miễn/giảm có lý do. Quyết định cũ không chuyển sang phiếu mới hoặc bị thu lại khi confirm ở ca sau.
- Phiếu mới bắt đầu ngày chuyển tiếp+14 ngày lịch Việt Nam, renew_count=0, hạn hiệu lực theo lịch nghỉ chuẩn. Không coi chuyển tiếp là gia hạn lần4 của phiếu cũ; giữ renew history cũ để audit. Sửa giá/policy catalog sau lần đầu không âm thầm đổi số cọc đang chuyển; chỉ thu mới theo policy snapshot đã chốt của nghiệp vụ tương ứng.
- Mức phạt, cọc, refund/fine payment/hold source, version/reason/actor/time phải persist. GET chain/settlement/receipt đọc lại ổn định, không tính thêm phạt phiếu cũ sau mốc partial vì còn pending money.

## 4. Tiền cọc chuyển tiếp và ngoại lệ đã chốt

Gọi D là tổng cọc còn dùng được của phiếu cũ, P là phạt chốt. Không lấy trần theo riêng cuốn rẻ nhất khi phạt tính cả phiếu. Tách số phải thu/hoàn với tiền thực đã xác nhận; pending không tạo CASH/BANK.

### 4.1 Cọc chưa bị dùng hết: chuyển nghĩa vụ, không thu/hoàn giả

- Ví dụ cọc A50k+B100k; trả A, giữ B, P0: cọc A50k giải phóng thành refund pending/chi khi xác nhận; cọc B100k chuyển allocation sang phiếu/dòng mới cash-neutral. Không journal CASH/BANK vào/ra100k vì B vẫn đang giữ và tiền chưa trao lại.
- Với cùng phiếu P60k<D150k: chốt/thu phạt60k riêng, giải phóng50k của A, chuyển100k của B. Không áp trần50k riêng A, không tự khấu trừ60k vào khoản100k chuyển. Khi đã thu CASH60k và hoàn CASH50k thật, tiền hộp tăng ròng10k; trước khi hoàn thì không ghi giảm50k. Nếu các phương thức khác nhau, tách đúng cash/bank thực.
- Source allocation chuyển có amount/link/actor rõ và trạng thái đúng; old source remaining giảm100k, new source remaining tăng100k, tổng global liability không đổi do transfer. Không ghi transfer thành doanh thu/chi phí và không đếm lại cọc đã nhận như thu mới.
- Refund A và fine có thể pending/confirm ca sau theo08 đã sửa; không làm mất khoản phải hoàn hoặc thu lại phạt cũ. Sửa phương thức trước chi bằng amend/cancel có audit, không edit confirmed intent.

### 4.2 P>=D: giữ cọc cũ và nhận cọc mới thực sự

- Ngoại lệ đã chốt: A50k+B100k, P đạt150k, trả A/giữ B. Giữ đủ150k cũ làm phạt, không hoàn50k, không chuyển100k cũ; thu mới100k cho B sau xác nhận tiền. Không thu thêm P−D.
- Forfeit giảm liability cũ150k và ghi nguồn thu theo policy đã chốt, không tăng CASH/BANK. Thu mới chỉ tăng tiền thực100k và nghĩa vụ mới100k. Không biến thành thu250k hoặc vừa chuyển100k cũ vừa nhận100k mới.
- Chưa nhận100k mới thì có trạng thái pending collection/carry action rõ; không ghi cọc HELD/thu đã xác nhận hoặc phiếu ACTIVE giả đủ cọc. Sách B vẫn bị giữ quyền mượn, không AVAILABLE hoặc mất active hold; việc A đã nhận thật vẫn lưu được. Thiết kế bước pending→finalize phù hợp trạng thái hiện tại và guard retry/concurrent, không require người trực thu lại150k.
- Hợp đồng pending xác định rõ owner receipt/item trong lúc chờ và mốc hạn mới/settlement. Không tạo phiếu rỗng; khi finalize đúng nguồn thì một receipt/dòng mới, old/new links đúng. Hủy/sửa pending có reason/audit và không tự xóa lịch sử hoặc mở copy cho người khác.

### 4.3 Bất biến tiền và nguồn

- Một engine refund/forfeit/transfer/receive dùng chung; amount VND nguyên/bounded, tổng allocation khớp ledger liability. Transfer không tạo asset movement; refund actual giảm một lần; thu mới có source ổn định và confirmation amount/quote đủ.
- Session theo lúc tiền thực thu/chi, BANK vẫn có buổi nhưng không vào hộp CASH; close/summary nhất quán. Ca cũ đã đóng không bị backdate. Thiếu tiền hoàn giữ pending, không lấy quỹ hoạt động bù âm thầm.
- Chặn direct reversal managed source mới; sửa nghiệp vụ qua source có allocation/intent/settlement/audit và biên nhận mới, không sửa/delete journal bất biến. Không mở full correction/lost module11 ngoài phần cần giữ invariant.

## 5. Transaction và recovery

- Một transaction đúng client cho bước final đã xác nhận: idempotency claim, session/receipt/item/copy/allocation locks theo thứ tự chung, quyết định settlement, old hold close/new hold insert, transfer/refund intent/forfeit/thu mới đã xác nhận, audit và cached result. Lock many IDs ổn định; receipt/borrower/copy ordering phải tương thích issue/full/confirm/reverse/archive/close.
- Nhận sách thực và tiền pending có thể là hai transaction nghiệp vụ, nhưng mỗi bước có source/states/version và boundary rõ. DB rollback không đảo tiền ngoài đời; lost response lấy lại biên nhận theo key/source, không hướng thu/hoàn lần hai.
- Lỗi sau old hold close, sau new item, sau allocation transfer, sau journal/audit/cache phải rollback sạch bước final; không commit orphan receipt/hold/cọc. Retry cùng key trả cùng IDs/link/amount; key khác không tạo chain nhánh cho cùng carry action. Quyền live kiểm trước replay.
- Hai actor cùng partial chỉ một successor; partial-vs-FULL/confirm/issue samecopy/close phải có một thứ tự hợp lệ, không lost update/chi đôi/đứt hold. Test deadlock/timeout/retry đúng contract, không nuốt mọi PG error thành409.

## 6. Gate nghiệm thu

| Gate | Bằng chứng bắt buộc |
|---|---|
| G-carryover | Từng S08-01..09, S06/S07 còn mở, test/source/lệnh/kết quả và blocker |
| G-selectors | FULL/PARTIAL strict sets, reject0/2ởPARTIAL/duplicate/mixed/alias/rỗng/lạ; không phantom return |
| G-lifecycle-db | Hai cuốn→trả1/giữ1, một successor/hold, no fake returned_at/no empty receipt, constraints thật trước/sau migration |
| G-money-transfer | P0 vàP60/D150: refund50,carry100,phạt riêng; chưa chi không journal refund; cash-neutral100, no double liability |
| G-forfeit-new | T73: giữ150 và nhận mới100 sau xác nhận; tiền thực+100, liability mới100; pending không fake source/AVAILABLE |
| G-date-history | Mới+14/renew0/lịch nghỉ/VN, phiếu cũ chốt phạt một lần; chuỗi GET/reload giữ snapshots/decision/links |
| G-recovery-db | Fault mọi bước mutation/audit/cache, lost response, same/different key nguồn; một biên nhận/hiệu lực |
| G-concurrency-db | Hai connection overlap có observer assertion/deadline/cleanup cho partial-vs-partial/FULL/confirm/issue/close |
| G-auth-contract | Roles/live revoke/replay/list/detail/PII/no-store/input bounds/Origin, OpenAPI và PG DATE DTO thực |
| G-runtime | PG application-role grants/direct handler/Workers/provider tách; mock/build không thay gate tiền |

Đối chiếu R02/R09 và T73/T74 trong docs05; đó là kịch bản yêu cầu, chưa là tests đã chạy. PG disposable local có guard; kiểm target trước reset/migrate, không PII/cloud/production. Chạy hồi quy issue/full-return/refund/session/ledger/idempotency/Auth/catalog/borrower đã đụng, check/build/OpenAPI lint+parity; Python nếu schema/model tham chiếu đổi. Chỉ lặp broad suite khi có thay đổi/failure/rủi ro mới.

## 7. Bàn giao và dừng

- Implementation/migration/schema/tests/fixtures/OpenAPI theo scope; sửa ERD/state/sequence và render theo lifecycle/carry/pending tiền mới, không chỉ đổi diagram mà đánh dấu feature xong.
- Progress/README: từng finding/gate PASS/PARTIAL/BLOCKED, files/lệnh/exit/môi trường thực, policy còn mở và đầu vào10. Không đổi tên/đóng finding theo suy đoán hoặc report mới thay bằng chứng DB. R09 UI chỉ đóng khi có runtime UI đã nối, không từ backend unit.
- Request/response và SQL trước/sau bằng dữ liệu giả: P0/carry100/refund50; P60 thu riêng; P150 giữ150+thu mới100; pending→finalize ở ca sau; retry/lỗi giữa bước. GET chain không rò PII/quỹ cho guest/alumni, không export ngoài scope.
- Không viết lại quầy12 hoặc branding. Nếu sửa UI trong phạm vi được yêu cầu thì phải kiểm laptop/mobile thực, không lấy static build làm runtime proof. Dừng tại09, không tự10/commit/push/deploy/chuyển tiền thật. Thiếu runtime vẫn bàn giao PARTIAL có lệnh tái chạy và phần hoàn thành độc lập.

