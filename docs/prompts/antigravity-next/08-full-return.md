# Chặng 08 — Sửa carryover07, trả toàn bộ, phạt và hoàn cọc chờ xác nhận

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## 1. Đọc thêm và khóa phạm vi

Đọc `docs/reviews/2026-10-19-stage07-followup.md`, prompt07, progress và code/DDL/tests/OpenAPI liên quan. Review06 khi cần truy vết. Bằng chứng `.review-artifacts/stage07-counterexamples.mjs` là SQL double/direct handler và driver guard, không thay PG server. Giữ report reviewer như snapshot, không sửa report để tự đóng finding.

**Phụ thuộc:**07, R04/R10 và các carryover tiền/quyền/catalog liên quan. Dùng `src/server/` hiện có: circulation, finance, db/shared/Auth/catalog/borrowers; thêm full-return/fine-policy tại vị trí tương ứng nhỏ nhất, không tạo src/modules song song. Tận dụng refund_intents/deposit_allocations/journal/idempotency/audit đang có, không viết một hệ tiền mới hoặc thêm ORM/microservices.

Chỉ full return ở08: không triển khai partial-return09, renewal10, lost11, UI overhaul12 hoặc bán sách18. Xử lý tất cả bản đang giữ của phiếu; request một phần phải từ chối rõ, không tự đóng phiếu và bỏ cuốn còn giữ. Giữ design.md và22 chặng. Domain/test độc lập vẫn làm được khi thiếu PG/provider/Workers; không chạy RAM/mock làm fallback cho giao dịch thật hoặc báo PASS gate chưa chạy.

## 2. Sửa carryover07 trước phần liên quan

### 2.1 S07-01/02 — transaction owner và PG Client

- Sửa withTransaction theo hợp đồng sở hữu rõ: Pool checkout đúng một client, BEGIN/COMMIT hoặc ROLLBACK/release; đã có transaction client thì tái dùng không reconnect/release/COMMIT hộ outer transaction. Không phân biệt Pool bằng chỉ `.connect` vì pg.Client cũng có method này. Chọn API đơn giản, typed; fail rõ khi gọi sai, không callback tùy ý nếu db không hợp lệ. Nested transaction chỉ hỗ trợ khi thật sự cần, không thêm framework.
- Áp transaction vào open/close session, copy/borrower mutations và phần quyền/revoke bị đụng; hiện chỉ issue/create title/edition được bọc. Mutation+audit+cached result cùng commit; không failIdempotency autocommit để che dữ liệu đã commit trước lỗi.
- Thống nhất lock order cho mọi caller, không chỉ ghi comment. Session trước receipt/allocation/intent/copy theo thứ tự đã chốt; nhiều ID sort ổn định. Trace issue, receive, request/confirm refund, reverse và close: không giữ allocation/intent rồi mới lock session trong writer ngược hướng với return/close.
- PG test Pool/Client/PoolClient ownership, callback/BEGIN/COMMIT failure, rollback/release; close tranh issue/refund/reversal; audit/cached result lỗi rollback mọi mutation. Không dùng snapshot mock làm chứng minh PG.

### 2.2 S07-03/04 — danh sách sách và tiền đã xác nhận

- Input issue dùng một selector chuẩn; reject mixed copyIds/barcodes hoặc alias conflict, không bỏ nhánh. Reject null/number/empty từng phần tử, không filter im lặng rồi ghi một phần. Resolve thành ID, chống trùng sau normalize, số bản thực1–2; kiểm row count sau lock.
- Ràng buộc paymentConfirmed với amount người trực thực kiểm hoặc quote version/tổng đã chốt. Server vẫn tính cọc từ copy đã khóa; nếu giá/quote đổi50k→100k, trả conflict để đối chiếu lại trước ghi thu, không tự nâng cọc sau xác nhận cũ. Client không được quyết định giá/cọc/hạn.
- Lưu lần thu cấp phiếu với phương thức/amount/actor/thời điểm/reference tối thiểu và phân bổ theo dòng; không ghi cả tổng lẫn từng dòng thành thu đôi. Không coi QR/loa/ảnh khách là kiểm app. Lỗi DB phải hướng lấy lại kết quả/đối soát theo key, không thu lại lần hai.
- Test mixed selectors, phần tử sai, duplicate aliases/ID+barcode cùng bản, giá đổi giữa preview–confirm, amount sai/thiếu/thừa và retry sau commit mất response.

### 2.3 S07-05/06 — BANK và chứng từ bất biến

- Journal BANK liên kết buổi/session cho báo cáo và truy vết; BANK tăng bankIn, không tăng cashIn/expected cash. GET receipt đọc lại session/payment/confirm từ nguồn persist, không hardcode null hoặc mặc định CASH khi nguồn thiếu. Trường hợp legacy phải đánh dấu thiếu dữ liệu rõ, không dựng lịch sử giả.
- Persist snapshot tối thiểu: giá bìa nullable, căn cứ cọc known/default, policy version, metadata chứng từ cần giữ. Deposit snapshot đã đúng thì giữ nguyên. GET/replay phân biệt thông tin lúc giao dịch với thông tin hiện tại; không để đổi catalog làm đổi chứng từ cũ. Không copy PII không cần thiết; định nghĩa mục đích snapshot borrower tối thiểu.
- DATE contract nhất quán YYYY-MM-DD với driver PG; dùng serializer tiền có giới hạn an toàn. Test issue→đổi giá/title/policy/borrower→GET/replay; BANK50k cho session.bankIn50k/cashIn0; đọc receipt giữ session/confirmation thật.

### 2.4 S07-07 — lịch hạn dùng chung trước khi tính phạt

- Reuse hàm ngày Việt Nam/+14 đã có, bổ sung lịch trực thứBa/thứNăm và ngoại lệ nghỉ lễ/Tết từ nguồn chuẩn. Lưu hạn gốc, hạn hiệu lực, căn cứ/version; không hardcode giả định mọi ngày đều có buổi hoặc lịch lễ chưa kiểm. Stage10 làm gia hạn đầy đủ,08 vẫn phải tính phạt đúng trên hạn hiệu lực.
- Ca đang mở phải đúng buổi/ngày hợp lệ, không tự lấy ca open tuần trước để ghi tiền hôm nay. Ca qua ngày/ngoại lệ cần contract rõ, không âm thầm backdate.
- Test01/10→15/10, biên UTC+7/tháng2/năm, buổi15/10 bị nghỉ giả định→buổi hợp lệ kế, nghỉ liên tiếp; không tăng renew_count do CLB nghỉ. Policy hủy đột xuất/ngày không trực chưa chốt phải ghi rõ thay vì đoán để pass.

### 2.5 S07-08/09 và phần06 chưa đủ

- Sửa fixture không dùng borrower_type không tồn tại; không thêm field nghiệp vụ chỉ để test chạy. Từng test có ngày/ca/closing/handover độc lập; opening500k vs seed350k cần giải trình hoặc fixture đúng nguồn. Không để guard mới phá các test mở ca cùng ngày cũ.
- DB tests gọi đúng transaction owner. Archive-vs-issue dùng hai connection overlap, idempotency claim/mutation/complete chung transaction, rollback fault sau ghi từng bảng; mã sách sai trước ghi không chứng minh rollback sau side effect. Có assertion quan sát blocking, deadline/statement timeout/cleanup, không dùng Promise.all đơn thuần làm proof.
- Validation object/type/allowlist/UUID/enum/length/safe integer/body-size tại biên; fullname123/null/array, tiền boolean/fraction/rác/unsafe và malformed path phải400 trước DB. Router không nuốt0/NaN query thành default. Map expected PG unique/FK/conflict, không lộ SQL/PII.
- Đồng bộ alias bankConfirmedByMember/default paymentMethod với code hoặc bỏ alias/default khỏi contract có ghi nhận tương thích; không để tài liệu hứa khác handler. OpenAPI/DTO/envelope/status/date/session phải kiểm bằng response thật, không chỉ lint.
- Hoàn thiện catalog carryover nhỏ còn thiếu: cập nhật metadata title/edition/associations, ngày nhập thực/review state theo nguồn chuẩn, archive/history. Không mở full CMS/SEO. Public cọc edition chỉ tham khảo/range khi copies khác giá; issue theo bản thật.
- Archive borrower xét nghĩa vụ/dòng còn mở; OVERDUE được bảo vệ, nhưng PARTIAL_SETTLED lịch sử đã hết sách/cọc không bị chặn vĩnh viễn vì nhãn terminal cũ. Có PG race với issue/return. Không tự đặt giới hạn tổng2cuốn/người hoặc cấm người quá hạn mượn mới ngoài policy đã chốt.
- Buổi unique bằng ràng buộc DB đúng định danh buổi, không chỉ SELECT trước INSERT; predecessor/custodian đúng nguồn bàn giao, audit/transaction/override hợp lệ rõ. Migration tiến tới nếu DB đã apply; không gọi CREATE TABLE IF NOT EXISTS là upgrade đã xong.
- Gate source/unit/direct-handler/PG/application-role/Workers/provider riêng; bỏ “triệt để100%”, “không thể deadlock” chưa chứng minh; giữ đúng IDs finding, S06-04 là giá sách0 chứ không phải mở ca0. Không lấy68 pass làm đã đóng mọi gate.

## 3. Full return: nhận sách và chốt nghĩa vụ

### 3.1 API và quyền

- Tái dùng route contract hiện tại `POST /api/v1/circulation/loans/{id}/settle-return` cho FULL; từ chối PARTIAL tại08, để09 làm. Không tạo hai route gần giống cùng một nghiệp vụ. Có GET chi tiết tình trạng nhận sách/phạt/refund intents và route xác nhận hoàn theo stable intent ID; tên cụ thể đồng bộ OpenAPI.
- Chỉ active member/admin. Actor lấy từ Auth live state, không body. Guest/alumni/disabled/revoked không đọc tiền/borrower, mutate hoặc replay cached result. DB/provider thiếu fail-closed, dữ liệu nhạy cảm no-store; Origin/CSRF/rate-limit/body-size theo cookie/Bearer thật.
- Mutation money/settlement yêu cầu idempotency key, stable source settlement/intent và payload binding. Cùng key/actor/payload trả cùng kết quả, khác payload409; source/action unique bảo vệ cả hai key khác nhau. Quyền live được kiểm trước replay, không đọc cached từ key trần.
- Input chỉ phiếu, bản thực trả, tình trạng phù hợp, quyết định phạt/lý do, phương thức hoàn dự kiến. Không nhận borrower ID/cọc/status tùy ý để ghi đè nguồn; server đọc đúng receipt/items/allocations/snapshot và kiểm toàn bộ bản đang giữ. Mất/hỏng ngoài policy chưa chốt không tự tịch thu hoặc dựng quy trình11.

### 3.2 Phạt theo phiếu, tách gợi ý với thực chốt

- Tính ngày theo Asia/Ho_Chi_Minh tới hết ngày hạn hiệu lực; trả đúng ngày không phạt, quá3 ngày phiếu2cuốn chỉ3k. Không nhân theo số item. Gợi ý1.000đ/ngày; các khoảng nghỉ do CLB đã được dời hạn không tính phạt lại.
- Lưu policy version/cutoff/ngày tính/phạt gợi ý, mức chốt, lý do miễn/giảm/điều chỉnh và actor. Giảm về0 được nhưng phải có lý do. Reject âm/fraction/unsafe và field kiểu sai; không tin số form là số phải thu.
- `D` là tổng nghĩa vụ cọc có thể xử lý của phiếu tại settlement, không lấy riêng cuốn nhỏ nhất; `P` là phạt đã chốt sau miễn/giảm:
  - P=0: giải phóng/hoàn đủ D; không journal thu0.
  - 0<P<D: hoàn đủ D và thu P riêng khi tiền thực được xác nhận. Không tự trừ P khỏi cọc/net hai dòng nếu chưa có giao dịch thực như vậy.
  - P>=D: giữ đúng D làm phạt, không hoàn và không thu thêm P−D. Giữ cọc là chuyển nghĩa vụ sang nguồn thu theo policy, không tăng CASH/BANK lần nữa.
- Ví dụ bắt buộc: D50k/P49k → refund50k và collect49k; P50/60/80k → giữ50k, không collect thêm. D150k/P60k → refund150k và collect60k riêng. Lưu phạt gợi ý/chốt và thực thu qua giữ cọc minh bạch, không báo đã thu P lớn hơn D.
- Không dùng tiền quỹ hoạt động bù cọc âm thầm. Quỹ nhận phạt/giữ cọc chưa chốt trong docs06: kiểm có quyết định mới chưa; nếu chưa, không tự chọn FUND_OPERATION hoặc FUND_LOAN để nghiệm thu. Cô lập policy explicit trong fixture, ghi gate phân quỹ BLOCKED và tiếp tục phần độc lập; hỏi đúng policy khi thực sự cần vận hành, không áp policy test thành quyết định CLB.

### 3.3 Nhận sách độc lập trả tiền

- Nhận đủ sách thật thì ghi returned_at/status AVAILABLE đúng bản, receipt phản ánh sách đã trả. Không sửa dòng cuốn không được mang đến hoặc tạo fake receive để đóng phiếu. Có audit actor/thời điểm; không tính thêm phạt sau mốc đã thực nhận đủ sách chỉ vì chờ hoàn tiền.
- Tạo settlement với quyết định phạt và các refund_intents cho allocation được giải phóng, stable source liên kết. Pending refund vẫn là nghĩa vụ phải hoàn, không giảm liability/ghi CASH/BANK out khi mới request. Nếu đã dùng cọc để phạt thì không tạo intent hoàn phần đó.
- `RETURNED` không đồng nghĩa đã thanh toán mọi khoản: DTO phân biệt sách đã nhận, phạt chốt/chờ thu/đã thu/miễn và cọc chờ hoàn/đã hoàn/đã giữ. Nếu khoản phạt thu riêng chưa thực nhận, lưu trạng thái/nghĩa vụ phù hợp, không post receipt tiền ảo hoặc bỏ mất khoản cần đối soát. Không dựng hệ công nợ tổng quát ngoài nhu cầu này.
- Nhận sách, settlement/intent/forfeit, inventory, audit, cached response trong một transaction đúng phần thực đã xảy ra; thu phạt/hoàn tiền chưa xác nhận là thao tác sau có transaction riêng. Chọn cơ chế post các phần đã xác nhận cùng lúc rõ ràng, không require tất cả tiền trả ngay mới lưu nhận sách.
- Retry/double-submit/two actors settle cùng phiếu: một settlement có hiệu lực; không thêm returned_at/history/forfeit/refund intent lần hai. Receipt đã settle không được reset về ACTIVE qua metadata hoặc bị trả lại lần nữa.

## 4. Xác nhận hoàn cọc và thu phạt thật

- Dùng refund intent ID lưu amount/method/nguồn từ bước request; confirm không cho body thay amount/method/borrower tùy ý. Nếu cần đổi phương thức trước khi chi, có amend/cancel-and-replace kiểm trạng thái/reason/audit/stable lineage, không sửa ý định đã chi. Pending không tự hủy khi đóng ca hoặc refresh.
- Khi thực giao tiền mặt/kiểm app ngân hàng xác nhận đã chuyển thành công mới confirm. Phương thức hoàn độc lập phương thức thu: BANK→CASH và CASH→BANK đều được, giữ nguyên lịch sử nhận cọc ban đầu. QR/loa/ảnh khách/lệnh pending không thành chi đã xác nhận.
- Hoàn ở ca sau ghi cash_session/buổi chi thực, không backdate về ca nhận hoặc ca trả sách đã đóng. CASH đủ nguồn khả dụng của hộp, không cho chi âm/giả; thiếu tiền giữ pending và ghi hướng xử lý, không tự lấy quỹ khác bù. BANK báo cáo ở buổi chi thực nhưng không giảm hộp tiền mặt; tài khoản quỹ có nguồn rõ.
- Confirm transaction giữ khóa session/receipt/allocation/intent theo thứ tự thống nhất; kiểm trạng thái pending/remaining, post journal đúng số tiền, update allocation/intent, audit và cached result cùng commit. Không vừa giảm remaining khi request vừa giảm lần nữa khi confirm. Không post negative amount hoặc dùng reversal để biểu diễn refund thường.
- Cùng intent confirm với hai key/actor hoặc lost response: tối đa một khoản chi; replay cùng key trả biên nhận cũ; lần xác nhận khác key sau confirmed trả trạng thái đã xử lý/conflict theo contract, tuyệt đối không chuyển thêm tiền. Dòng audit/journal/source xác định được người thực hiện lần đầu.
- Thu phạt riêng cũng có ý định/chứng từ nguồn ổn định và xác nhận thực thu; refund/forfeit/thu phạt không được dùng cùng allocation/ý định hai lần. Fine decision đã đóng cần sửa bằng quy trình có reason/audit, không DELETE journal cũ; không triển khai full reversal tất cả nghiệp vụ11 ở08.

## 5. Invariants và gate phải chứng minh

Trong mọi trường hợp: tổng nghĩa vụ allocation khớp ledger liability; request hoàn không giảm liability; confirm hoàn giảm đúng một lần; forfeit không tạo thêm tiền thực; cash expected=opening+thu CASH−chi CASH, BANK độc lập. Liên kết session/source/actor truy đủ, journal/snapshot cũ bất biến. Chốt summary tại cutoff nhất quán, tiền serialize an toàn; không chỉ check tổng Nợ=Có.

| Gate | Ca cần chứng minh |
|---|---|
| G-carryover | Từng S07-01..09, S06 còn mở; source/test/lệnh/kết quả, không PASS gom |
| G-return-domain | Full1/2cuốn, reject partial/không thuộc phiếu/đã trả/mất ngoài scope, hạn hiệu lực và phạt theo phiếu |
| G-fine | T09/T23/T25/T27; miễn0 có lý do; ngưỡng49/50/60/80 trên D50 và P60/D150; giữ cọc không thu mới |
| G-refund-pending | T12: trả sách hôm nay, tiền chờ hoàn ca sau, không tính phạt thêm vì tiền chậm; pending sống qua đóng ca/retry |
| G-cross-method | T33/T34/T35: BANK→CASH, CASH→BANK; chưa kiểm app không chi, bankIn/out đúng buổi, CASH chỉ đổi khi thực cash |
| G-recovery-db | Fault sau từng UPDATE/INSERT journal/allocation/intent/audit/cache rollback đúng; lost response replay; same intent hai key không chi đôi |
| G-concurrency-db | Hai actor settle/confirm, settle-vs-renew/issue path liên quan, confirm-vs-close/reversal; true PG overlap, observer assert/deadline/cleanup |
| G-auth-contract | HTTP roles/list/detail/replay, body/type/range/Origin/cache, OpenAPI parity với DB date/money DTO |
| G-runtime | PG application-role grants, direct handler, Workers HTTP, provider tách riêng; đủ gate mới gọi nghiệm thu tiền |

T09/T12/T23/T25/T27/T33–T35 là kịch bản yêu cầu trong docs05, không là test đã chạy. Thêm tests unit/domain và PG/HTTP đúng rủi ro; quan sát SQL trước/sau dùng dữ liệu giả. Fixture/migration baseline và upgrade có guard disposable local; không reset target chưa xác minh, không cloud/production/PII thật. Các policy còn mở ghi rõ.

Chạy regression issue/session/ledger/idempotency/Auth/catalog/borrower vì08 dùng chung; check/build, OpenAPI lint+contract test, Python khi schema/model tham chiếu đổi. Chỉ broad lặp khi có thay đổi/failure/rủi ro mới. List/detail có thể batch thay N+1 khi cần dùng lại, không mở dự án tối ưu ngoài scope.

## 6. Bàn giao và dừng

- Code/schema/migration/tests/fixture/OpenAPI đúng phần đổi; shared rules không trùng. Sửa sequence/state/ERD ở phần contract thật thay đổi và render tương ứng; không đánh dấu phần09/10/11 đã triển khai vì vẽ sơ đồ.
- Progress/README ghi từng finding/gate, files đổi, lệnh/exit/môi trường, source/unit/PG/HTTP/provider đã kiểm hoặc BLOCKED; policy quỹ phạt/lịch chưa chốt và đầu vào09. Không sửa report07 để tự đóng finding.
- Bàn giao request/response và SQL trước/sau giả cho: refund pending, confirm ca sau, hai phương thức chéo, D150/P60 và D50/P>=50. UI chỉ nối phạm vi cần thiết nếu đã được yêu cầu; giữ design.md, không biến demo state thành nguồn tiền. Nếu thay UI phải kiểm runtime laptop/mobile, không chỉ screenshot/build.
- Dừng tại08, không tự partial-return09, commit/push/deploy hoặc chuyển tiền thật. Thiếu runtime thì bàn giao PARTIAL/BLOCKED có cách tái chạy, không dùng mock thay nghiệm thu. Cuối lượt ghi đã sửa/còn gì/đã kiểm/rủi ro/bước tiếp.

