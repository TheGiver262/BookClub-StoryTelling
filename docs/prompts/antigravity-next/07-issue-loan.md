# Chặng 07 — Sửa carryover06, cho mượn và nhận cọc bằng transaction thật

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## 1. Đọc thêm và khóa phạm vi

Đọc `docs/reviews/2026-10-18-stage06-followup.md` và prompt06 để biết phần chưa làm, report05 khi cần truy vết; schema, finance/Auth/catalog/borrower/idempotency hiện tại và caller/test của chúng. Snapshot review không thay code hiện tại. `.review-artifacts/stage06-counterexamples.mjs` tái hiện logic bằng SQL double/direct handler, không phải test PG đã pass. Không sửa report reviewer để tự đóng finding.

**Phụ thuộc:**03–06, R03/R04 và issue của R10; sửa carryover S06-01..09 trong phạm vi liên quan trước phần issue. Tái dùng `src/server/` hiện có: finance/shared/db/Auth/catalog/borrowers; thêm use case circulation nhỏ và route/tests. Không tạo cây src/modules song song, transaction framework mới, ORM, microservice hoặc thêm dependency cho vài validation.

Mục tiêu07 là backend lập phiếu thật, không triển khai trả/gia hạn/mất/bán sách ở08–11/18, không viết lại quầy/UI12 hoặc đổi design.md. Giữ22 chặng. Có thể hoàn thiện domain/test khi PG/provider thiếu, nhưng HTTP nhạy cảm phải fail-closed và giữ PARTIAL/BLOCKED, không tiếp tục bằng RAM/mock ngoài test.

## 2. Sửa carryover06

### 2.1 S06-01 — transaction thật và idempotency nguyên tử

- Dùng một PG client checkout cho toàn use case, BEGIN/COMMIT hoặc ROLLBACK/release. Không truyền Pool vào helper nhiều bước rồi xem SELECT FOR UPDATE là khóa xuyên hành động. Chốt ranh giới rõ để caller không vô tình dùng autocommit.
- Thứ tự khóa dùng chung cho session→nguồn nghiệp vụ/borrower/copy/receipt/allocation/intent theo thiết kế hiện tại; sắp thứ tự ổn định cho nhiều ID. Kiểm mọi caller để tránh receive/confirm khóa allocation trước rồi lock session trong writer, trong khi close/issue đảo ngược thứ tự. Idempotency được claim trong cùng transaction; actor/op/key/payload có ràng buộc, không tạo PROCESSING riêng mà thiếu recovery.
- Session, phiếu/dòng, snapshot, copy status, allocation/journal, audit và cached response cùng commit. Lỗi ở completeIdempotency/audit phải rollback cả nguồn; không dùng failIdempotency autocommit để che mutation đã commit.
- Khóa ca trước kiểm open/quỹ và giữ tới commit cho writer; summary/close nhất quán. Chứng minh close-vs-receive/refund/reversal trên PG thật; snapshot ca đóng bất biến.
- Áp cho mutation catalog/borrower nhiều bước cùng archive-vs-issue và member/status/revoke nếu đổi phần đó; không nhân bản helper transaction ở mỗi module.

### 2.2 S06-02 — đảo nguồn cọc đúng ca, không đoán legacy

- ReverseDepositParams nhận ca đích cần thiết và truyền xuống recordReversal. Không đổi ca cũ đã đóng thành null rồi làm writer CASH thất bại. Không cập nhật VOIDED ngoài transaction phối hợp.
- Giữ mapping allocation.id mới. Legacy receipt+amount+LIMIT1 vẫn mơ hồ khi hai cuốn cùng cọc; backfill theo bằng chứng hoặc từ chối cần xử lý rõ, không đoán theo amount/thứ tự row.
- Hồi quy: phiếu50k+100k đảo100k đúng100k; nguồn cũ ở ca đóng được sửa bằng chứng từ ở ca mới hợp lệ; hai legacy dòng50k không chọn tùy ý; lỗi/retry/concurrent không đổi allocation một mình. Lưu reason/actor/link và giữ snapshot ca trước.

### 2.3 S06-03 — audit ngay tại thời điểm mutation

- Bỏ actor bị bỏ quên. Tái dùng system_audit_logs cho catalog/borrower/session/issue và phần quyền sửa trong scope, cùng transaction mutation. Stage21 cung cấp xem/báo cáo, không thể ghi lại actor của dữ liệu đã thay đổi từ trước.
- Ghi actor/action/resource/ID và thay đổi cần thiết; không lưu raw token/password/PII toàn bộ vào details/log/error. Quyền đọc log vẫn admin.
- Test audit đúng actor, audit thất bại rollback dữ liệu, guest/alumni không truy log. Không thêm một hệ log song song.

### 2.4 S06-04/05/06 — giá0, archive và validation

- createBookCopy giữ0n khác null, sửa điều kiện truthy; kiểm create→read/update NULL/0/74k trên PG. Đổi metadata không đổi snapshot phiếu đã lập.
- Archive borrower xét sách/nghĩa vụ chưa kết thúc, bao gồm OVERDUE và các trạng thái/dòng liên quan, không chỉ status ACTIVE. Khóa phối hợp với issue để không vừa archive vừa cho mượn. Không cấm archive chỉ vì có lịch sử cũ đã hoàn tất.
- Validate JSON object-only/field allowlist/type/range/length trước trim/BigInt/query; không tin cast any. Invalid fullname số, coverPrice boolean/fraction/unsafe, null/array body, location/UUID/date lạ phải400 trước mutation. Các unique/FK race dự kiến trả lỗi domain phù hợp, không lộ SQL/PII.
- Page/limit là số nguyên finite an toàn; bounded query/author/category, max page size100 hoặc nhỏ hơn nhất quán; tránh overflow offset, sort allowlist và tiebreaker ổn định. Test Infinity,2.5,âm/huge/query dài. Không gọi clamping là validation đầy đủ.

### 2.5 S06-07 — hoàn thiện catalog tối thiểu trước khi cho mượn

- Cho member/admin quản lý title, edition, tác giả/thể loại và association nhiều-nhiều qua API; tạo sách mới không cần INSERT SQL thủ công. Hai copy cùng edition khác giá/vị trí, barcode unique, ISBN optional; snapshot/stock/history không bị cascade xóa.
- Có ngày nhập thực phù hợp sách nhập cũ và trạng thái review theo nguồn chuẩn, không thay ngày nhập bằng ngày tạo record nếu dữ liệu khác. Không triển khai full CMS/SEO/review moderation20.
- Test chuỗi từ title mới→authors/categories→edition→hai copy→sửa metadata→public search/detail. Public projection không rò borrower/phone/note/audit; copy CRUD không đổi loan/lost status. Lô sách mới bán vẫn tách catalog sách cũ cho mượn.
- Public standardDeposit từ LIMIT1 copy không là giá chuẩn của mọi bản khác giá: mô tả tham khảo/range rõ, còn issue tính theo copy thực chọn. Không chuyển đơn giá public thành nguồn tiền chuẩn.

### 2.6 S06-08/09 — buổi, hợp đồng và test thật

- Buổi có định danh server/unique theo buổi; ID khác không mở lại lần hai sau close. Predecessor là ca bàn giao chuẩn; client chỉ ca khác/đang mở phải bị từ chối. Opening thực và lý do chênh được lưu; không tạo thu giả. Người trực chính/custodian xác nhận đúng yêu cầu, không tự siết toàn bộ quyền quản lý của thành viên theo ban.
- Fixture không seed ca open phá test một winner. Test closed writer phải gọi writer thật, không tự throw. Hai connection có quan sát blocking được assert, timeout/deadline/cleanup; SQL double không thay constraints/MVCC/grants.
- OpenAPI khớp close sessionId/header/envelope/summary/status và các route mới; contract test response handler thực. No-store cho dữ liệu tiền/PII, body-size/Origin/CSRF/rate-limit theo Auth cookie/Bearer hiện tại. Không bật production money khi Auth/runtime gate còn mở.
- Progress ghi đúng từng S05 và S06, không gán nhầm finding hoặc gọi “triệt để/100% ACID” khi chưa chứng minh. Source/unit/direct-handler/PG/application-role/Workers/provider tách riêng. Giữ lỗi cụ thể đã sửa (logout503, COMPLETED bị loại, delta khác remaining), không hoàn nguyên chúng để khớp report cũ.

## 3. Triển khai lát cho mượn

### 3.1 Contract và quyền

- Dùng `POST /api/v1/circulation/loans` theo OpenAPI hiện có, sửa contract cho đủ field thực thay vì thêm route gần giống. Có GET biên nhận theo ID và list nội bộ tối thiểu bounded nếu cần phục vụ tra cứu/recovery; guest/alumni không đọc phiếu/borrower/cọc bằng list/direct-ID/replay.
- Chỉ active member/admin; actor lấy từ Auth, không từ body. Không dùng username để suy quyền. Live state/token version/revocation phải kiểm; provider/DB không sẵn sàng trả lỗi sanitized, không fixture fallback runtime.
- Request: borrower ID,1–2 barcode/ID bản khác nhau, session ID/buổi do server xác minh, phương thức tiền và xác nhận thực nhận; X-Idempotency-Key bắt buộc. Chọn một contract payment-method chuẩn, map enum tiếng Việt hiện có tới CASH/BANK_TRANSFER tại biên nếu cần, không để hai enum trôi tự do giữa code/docs.
- Client không quyết định deposit/dueDate/renewCount/createdBy/status; reject hoặc bỏ qua có quy tắc rõ các field đó và test. Tổng client chỉ là đối chiếu, server tính từ copy đã khóa. Không tự đặt giới hạn hai cuốn trên toàn bộ người mượn: giới hạn đã chốt là hai cuốn mỗi phiếu.

### 3.2 Validate và tiền thực nhận

- Borrower tồn tại/chưa archived; copy tồn tại và AVAILABLE, không lost/archived/borrowed. Quy định vị trí đủ điều kiện cho giao sách theo mô hình đã có, không giả vờ sách ở kho đã ra bàn. Bản có loan_item chưa trả/is_lost không thể được mượn lại chỉ vì metadata status lệch; giữ DB constraint phòng thủ.
- 1–2 bản khác nhau sau normalize; thiếu/trùng/ba bản/malformed ID bị400, tranh bản đã mượn409, lỗi không tồn tại đúng404. Kiểm whole request trước ghi; cùng edition nhưng hai copy khác nhau vẫn hợp lệ.
- Cọc từng copy: `max(50000, floor((price+25000)/50000)*50000)`, NULL mặc định50k,0 vẫn0 trong metadata.20/51/74/75/151/230k tương ứng50/50/50/100/150/250k. Tổng là tổng từng cuốn; không làm tròn tổng lần nữa, không trần200k.
- Thành viên xác nhận đã nhận tiền mặt hoặc đã kiểm app tài khoản riêng CLB với chuyển khoản. QR/loa không thay xác nhận. Chưa xác nhận thì không tạo khoản thu/phiếu có hiệu lực; không giả tự động xác minh ngân hàng. Lưu phương thức, amount thực xác nhận, actor/thời điểm/reference phù hợp, không lưu ảnh/tài khoản/PII thừa. Nhận chính xác cọc và tiền thừa trả khách nếu có phải có contract rõ, không ghi toàn bộ tờ tiền đưa thành cọc.
- Không thiết kế một payment intent cho mỗi dòng khiến một chuyển khoản trả hai cuốn bị coi trùng; định danh lần thu cấp phiếu và phân bổ theo từng dòng, ledger không cộng cả tổng lẫn từng dòng lần nữa. Business uniqueness ngoài idempotency key chặn retry nguồn đã nhận.
- Lỗi DB không đảo ngược tiền mặt/chuyển khoản ngoài đời: response lỗi hướng đối soát/lấy lại kết quả theo key, không hướng người trực thu tiền lần hai. Không tự gọi hoàn tiền qua ngân hàng.

### 3.3 Ngày và snapshots

- Ngày mượn theo Asia/Ho_Chi_Minh tại server; hạn gốc cộng đúng14 ngày lịch:01/10→15/10, tới hết ngày; renew_count=0. Không cộng14×24h trên timestamp rồi để DST/UTC quyết định ngày.
- Hạn hiệu lực theo lịch trực thứBa/thứNăm và ngoại lệ nghỉ lễ/Tết đã chốt. Tái dùng calendar nhỏ/source lịch đã có; test bằng ngày nghỉ giả định, không hardcode lịch lễ toàn quốc chưa kiểm. Lưu hạn gốc/hạn hiệu lực/lý do/version. Stage10 làm gia hạn/lịch đầy đủ;07 vẫn không được trả hạn sai trong trường hợp nghỉ đã biết. Nếu thiếu policy/data thật, ghi giới hạn/gate còn mở thay vì silently giả định không nghỉ.
- Snapshot từng dòng: giá bìa nullable, căn cứ cọc (known-price/default-no-price), cọc, phiên bản policy, bản sách/ấn bản liên quan; snapshot người mượn tối thiểu cần cho chứng từ nếu thiết kế yêu cầu, tránh sao chép PII tùy tiện. Sửa giá/catalog sau đó không đổi chứng từ cũ.

### 3.4 Một transaction và kết quả

- Claim key/payload/actor; khóa session/borrower/copy theo thứ tự thống nhất với carryover; đọc/kiểm lại trạng thái sau lock. Số phiếu unique server-side, không MAX+1 không khóa; lỗi trùng số có recovery có giới hạn.
- Ghi receipt và1–2 loan_items/snapshot; update copy BORROWED; nhận cọc allocation theo từng dòng và journal source chuẩn; audit; cached response. Tất cả một client/transaction, không gọi provider/ngân hàng bên trong khi giữ lock.
- CASH tăng TIEN_MAT_HOP và nghĩa vụ cọc; BANK tăng tài khoản ngân hàng và nghĩa vụ cọc, không đổi expected cash hộp. Không đưa cọc thành doanh thu. Tự đối soát invariant cần thiết trước commit; không coi tổng Nợ=Có là đủ chứng minh allocation khớp liability.
- Giữ trigger max2 và partial unique active copy đúng, không bypass/disable để test pass. Khóa1–2 copy theo thứ tự ID ổn định, test request đảo thứ tự không deadlock vô hạn.
- Response201 có biên nhận: ID/số phiếu, ngày/hạn, từng bản/snapshot cọc, tổng thực nhận/phương thức/người xác nhận, session và các ID nguồn cần recovery; DTO nội bộ/no-store. Retry cùng key/payload/actor trả cùng ID/số phiếu/kết quả theo contract. Cùng key khác payload409; actor khác không đọc cached kết quả người trước. Không replay tùy ý chỉ từ key mà bỏ quyền live.

## 4. Gate bắt buộc

| Gate | Chứng minh |
|---|---|
| G-carryover | Từng S06-01..09 với source/test/lệnh/kết quả; S05 phần còn mở tách rõ |
| G-catalog | Tạo title/edition/copy bằng API,0 khác NULL, archive OVERDUE guard, metadata/audit/validation và public DTO |
| G-issue-unit |1/2 bản, reject0/3/trùng, cọc các mốc/NULL/0, client tamper, ngày+14/VN/ngoại lệ, payment unconfirmed |
| G-issue-db | Hai connection cùng copy khác key chỉ một loan/cọc; hai request đảo thứ tự copy; archive-vs-issue; issue-vs-close; constraints thật |
| G-money-recovery | Fault sau receipt/items/copy/allocation/journal/audit/cached response đều rollback; mất response sau commit replay một biên nhận; không thu lần hai |
| G-cash-bank | Cùng tổng cọc CASH tăng hộp, BANK không tăng hộp; allocation=liability; ca đóng không ghi; ca/bàn giao nhất quán |
| G-http-auth | Member/admin thành công; guest/alumni/disabled/revoked bị chặn list/detail/mutation/replay; malformed/oversized/no-store/Origin đúng contract |
| G-runtime | PG/application-role grants, direct handler, Workers HTTP, managed provider ghi riêng; không lấy static build làm backend proof |

Chạy hồi quy finance/session/Auth/catalog/borrower vì07 dùng helper chung, check/build, OpenAPI lint + parity và Python nếu schema/model liên quan đổi. Không broad lặp khi không có thay đổi/rủi ro mới. PG chỉ disposable local có guard; kiểm target trước migration/reset. Kiểm baseline/upgrade nếu DB đã apply, không chỉ sửa CREATE TABLE IF NOT EXISTS rồi nói migration xong. Không thay deps/config để lách lỗi môi trường.

## 5. Bàn giao và dừng

- Code/tests/fixture/migration/OpenAPI trong scope. Cập nhật `docs/technical/diagrams/06_sequence_loan_and_return.mmd` và render liên quan khi flow đổi; sửa phần issue, không tự thiết kế lại phần return chưa làm. Sequence phải thể hiện tiền được xác nhận, locks/transaction, audit, cached result và nhánh lỗi thật.
- Progress/README: từng finding/gate PASS/PARTIAL/BLOCKED, files đổi, lệnh/exit/môi trường, test thực thi với giới hạn, policy/data chưa có và đầu vào08. Không ghi “dứt điểm” vì chỉ thêm comment/FOR UPDATE. Không sửa report06 để che finding.
- Request/response mẫu dữ liệu giả, cách chạy PG/test/Workers khi đủ điều kiện; liệt kê đúng endpoint có handler và endpoint dự kiến. Không dùng prototype quầy làm nguồn tiền chuẩn.
- Dừng tại07, chưa triển khai trả08 hoặc commit/deploy. Nếu runtime còn thiếu, bàn giao PARTIAL kèm phần hoàn thành độc lập, không thay bằng demo thành công giả. Cuối lượt tóm tắt sửa gì/còn gì/kiểm gì/rủi ro/bước tiếp.

