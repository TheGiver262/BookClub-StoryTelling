# Chặng 06 — Sửa carryover05, catalog và người mượn cộng đồng

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Đọc thêm và phạm vi

Đọc `docs/reviews/2026-10-18-stage05-followup.md` trước sửa; report04 khi cần truy vết, schema/OpenAPI/transaction-finance và code liên quan hiện tại. Không sửa report reviewer để tự đóng finding. Bằng chứng phản ví dụ ở `.review-artifacts/stage05-counterexamples.mjs` và JSON, chỉ là SQL double/direct handler, không thay PostgreSQL.

**Phụ thuộc catalog:**02/03. Carryover05 là điều kiện đóng gate tiền/quyền liên quan; không biến toàn bộ catalog thành phụ thuộc cứng vào provider còn thiếu. Có thể làm domain/test độc lập khi runtime thiếu; HTTP nhạy cảm vẫn fail-closed. Không đổi stack, thêm ORM, event bus hoặc service/helper trùng.

**Trách nhiệm:** sửa `src/server/finance/`, Auth/router, test/fixture và hợp đồng bị ảnh hưởng; sau đó thêm catalog/borrower theo cấu trúc `src/server/` hiện có, schema/migration, routes/OpenAPI, tests unit/integration tương ứng. Không cần tạo thêm cây `src/modules/`. Trace caller, test, fixture, schema và contract trước sửa helper chung. Không tự làm07–22, import Excel tổng quát, quy trình bán sách hoặc giao diện mới.

## A. Sửa carryover trước

### A1 — S05-01: transaction và khóa chung hộp tiền

- Checkout một PG client; BEGIN/use case/COMMIT hoặc ROLLBACK/release. Session, allocation, intent, journal, idempotency result và audit của một hành động dùng cùng client. Không BEGIN trên Pool rồi gửi query khác qua Pool.
- Thứ tự lock dùng chung: khóa session trước chuyển động tiền thuộc hộp đó, kiểm open/đúng quỹ. Nhận/hoàn/đảo/phạt đi qua cùng guard, không chỉ close. CASH của hộp mượn–trả bắt buộc có session hợp lệ; BANK có ngữ nghĩa buổi rõ nhưng không đổi cash expected; FUND_OPERATION không tự cộng vào hộp FUND_LOAN.
- Snapshot close bất biến. Sửa sai nguồn ở ca đã đóng bằng nghiệp vụ tại ca hợp lệ, không backdate reversal làm đổi ca cũ. Đọc summary tại cùng cutoff, không coi nhiều aggregate rời là một snapshot.
- Nếu nghiệp vụ cần bổ sung tiền, ghi điều chuyển có nguồn/lý do, không tạo doanh thu ảo. Kiểm đủ tiền theo nghiệp vụ thực, không âm thầm cho chi sai hộp.
- PG hai connection kiểm close tranh receive/refund/reversal, rollback giữa chừng và đọc lại ca đóng. Mock không chứng minh khóa. Không công bố HTTP tiền sẵn sàng khi gate Auth/PG còn chặn.

### A2 — S05-02: đảo đúng nguồn cọc

- Liên kết allocation/source line với journal nhận chính xác; bỏ LIMIT1 theo receipt cho nghiệp vụ đảo. Không đoán theo amount vì hai cuốn có thể cùng giá.
- Đảo nguồn/allocation/journal/audit cùng transaction, kiểm trạng thái và reconciliation; reason/actor/link đọc lại được. Không cho public input bật allowDirectSourceReversal tùy ý.
- Phân biệt sửa sai với tịch thu, giữ lịch sử. Test phiếu50k+100k đảo100k đúng100k, retry/concurrent chỉ một hiệu lực; nguồn đã hoàn/chuyển không được đảo sai. Journal ca cũ không làm đổi snapshot đã chốt.

### A3 — S05-03/04 và S04-07: thu hồi phiên, quyền alumni

- Logout không trả thành công thu hồi server khi DB lỗi. Có thể xóa cookie local nhưng phải phản ánh lỗi sanitized/retry đúng. Xác minh token trước lưu; revocation/token-version/audit có transaction phù hợp; không lưu/log raw token; expiry theo token và cách dọn hết hạn.
- Test DB lỗi tại từng bước, phục hồi/retry, token cũ bị từ chối ở instance khác, token giả không tạo revocation tùy ý. Ghi riêng provider/runtime thật với mock handler.
- COMPLETED không là duyệt alumni. Chỉ trả bản nội dung an toàn đã được duyệt rõ; trạng thái tiến độ độc lập quyền xem. Test list/direct-ID với COMPLETED chưa duyệt, draft, approved và DB lỗi; PII/quỹ/bank/export vẫn bị cấm. Sửa nội dung sau duyệt phải theo chính sách duyệt lại/version.
- Kiểm chuyển admin thành alumni: thống nhất tự bỏ admin khi chuyển hoặc yêu cầu payload rõ; không để nhánh tự bỏ quyền bị chặn trước. Explicit alumni+admin bị từ chối, DB CHECK bảo vệ; trạng thái/token invalidation/audit atomic. Thành viên active vẫn quản lý các mục theo quyết định người dùng, không tự thêm phân quyền theo ban.

### A4 — S05-05/06: buổi, bàn giao và số dư

- Server định danh buổi và unique theo buổi, không chỉ một ca open cùng thời điểm. Không cho đổi sessionId mở lần hai sau close mà không có nghiệp vụ sửa sai rõ.
- Buổi đầu nhập opening thực tế; về sau tự tìm nguồn bàn giao hợp lệ. Bỏ predecessor từ client không được bỏ kiểm. Opening khác actual ca trước cần lý do; không tự ghi thu bù. Ghi người trực chính xác nhận/custodian theo yêu cầu, không đổi người giữ giữa buổi.
- /today dùng ngày Asia/Ho_Chi_Minh đúng nghĩa hoặc đổi endpoint/contract rõ; test ca qua ngày và ngày không có buổi.
- Tách nghĩa vụ cọc đầu kỳ/tăng/giảm/cuối kỳ với delta của ca. Nhận150k ca trước, hoàn50k ca sau: số dư100k, delta−50k, không gọi−50k là remaining. Kiểm chuyển phiếu cash-neutral, forfeiture/reversal, CASH/BANK và đối soát ledger/allocation cùng cutoff. Serialize tổng bigint an toàn theo contract.

### A5 — S05-07/08: test, idempotency và bằng chứng

- Seed trung lập cho cash-session tests; không để ca mở sẵn phá test một winner. SQL double chuyển sang helper không đăng ký test; api-routes.test không import *.test.ts để dùng class.
- Test ca đóng cấm ghi phải gọi writer thật rồi assert lỗi/no mutation, không tự throw trong test. Race phải có hai connection overlap, assert đã thấy blocking, deadline/statement timeout và cleanup; không chỉ polling bỏ qua kết quả.
- Áp shared idempotency cho mở/đóng và money mutation trong transaction cùng side effect/result/audit. Cùng ý định/key retry trả kết quả đã chốt; khác payload conflict, khác actor không đọc cached result. Business uniqueness chặn cùng nguồn/key khác, kể cả retry sau terminal state.
- OpenAPI khớp open/today/close/summary, sessionId, body, envelope, error/status/security/idempotency. Bounds body/path/date/amount, no-store cho dữ liệu nhạy cảm; Origin/CSRF/rate-limit theo cơ chế cookie/Bearer thật, không chỉ gắn nhãn an toàn.
- Sửa progress: không gọi tám carryover triệt để fixed, không gọi unit direct handler là Workers HTTP/runtime; bỏ file không tồn tại và “100% ACID” chưa chứng minh. Đếm test độc lập, không tăng count do import lặp.
- Giữ bảng source/unit/PG/application-role grants/direct-handler/Workers HTTP/provider riêng. Gate chưa chạy ghi BLOCKED kèm lý do/lệnh tái chạy. Forfeit policy trong fixture không là quyết định phân quỹ mới của CLB; policy còn mở phải được ghi rõ.

## B. Catalog và từng bản sách

- Phân biệt đầu sách, ấn bản, bản vật lý. Tác giả/thể loại nhiều-nhiều; nhà xuất bản, ISBN tùy chọn, ngày nhập, trạng thái đã review và giá theo bản khi cần. Hai bản cùng ấn bản có thể khác giá/vị trí. ID ổn định, mã bản riêng không trùng; không dùng tên làm khóa.
- Kho/vị trí tách trạng thái mượn; hai kho chính là thư viện và văn phòng Hội SV. Bàn sách có thể là vị trí tạm nếu mô hình hỗ trợ, không đồng nhất đang ở bàn với đang được mượn. Di chuyển có lịch sử/actor khi cần, không biến bản đang mượn thành available.
- Giá chưa biết lưu NULL, cọc mặc định50k; không đánh đồng0 với NULL. Giá âm/số lẻ VND bị từ chối. Cọc là bội50k gần nhất, giữa làm lên, tối thiểu50k:74k→50k,75k→100k,230k→250k. Tái dùng một hàm chuẩn; đổi catalog không đổi snapshot giá/cọc của phiếu cũ.
- CRUD metadata không cho đổi loan status/lost/returned để vượt circulation transaction. Cho mượn/trả/mất ở07–11. Archive bản có lịch sử, không cascade xóa phiếu/cọc/journal; xóa bản chưa dùng chỉ khi policy/FK cho phép.
- Sách cũ cho mượn tách lô sách mới bán; không tạo route bán sách cho mượn. Review metadata phục vụ nội dung đã có, không triển khai full SEO/moderation stage20 ở đây.
- Public DTO allowlist chỉ metadata/nội dung đã duyệt và tình trạng công khai cần thiết. Không borrower/phone/ghi chú nội bộ/journal/cọc cá nhân/object DB nguyên trạng. List/detail/direct ID cùng policy; không rò qua nested relation/error.
- Search tên/tác giả/thể loại có dấu/không dấu, SQL parameterized; dùng index/schema02 đã kiểm, không generated column unaccent sai volatility. Validate query length/limit/cursor/sort; page size tối đa100 hoặc nhỏ hơn nhất quán. Join nhiều tác giả/thể loại không nhân đôi sách; count/pagination đúng. Không interpolate sort từ client.

## C. Người mượn cộng đồng

- Borrower độc lập tài khoản web/thành viên, không tự tạo account khi nhập phiếu. Chỉ bắt buộc họ tên/điện thoại; MSSV/trường/khóa/năm học optional, người dân được NULL, không ép dữ liệu giả. Không thu địa chỉ/CCCD hoặc PII mới.
- Normalize phone hợp lý, giữ giá trị hiển thị; không tự merge theo phone/email/tên. Hai người chung số vẫn phân biệt ID; không unique phone biến họ thành một. UI/API tìm kiếm nội bộ đủ phân biệt đúng người, tránh thu thêm PII.
- Guest/alumni không đọc borrower qua list/search/direct ID; active member/admin theo policy đã chốt. Không log phone/body vào telemetry/error. Audit actor/action/target đủ truy vết, tránh snapshot PII thừa; không mở export borrower ngoài scope.
- Archive/sửa thông tin không làm mất liên kết hoặc ghi đè snapshot cần thiết của phiếu lịch sử. Mutation có validation/transaction/actor/audit phù hợp; xử lý duplicate candidate rõ, không tự merge.

## D. Gate và kiểm tra

Check/build, unit đúng phạm vi; broad regression khi sửa helper tiền/Auth/DB chung. Python hiện có khi đổi model/schema được chúng tham chiếu. OpenAPI lint kèm đối chiếu route thực. PG disposable có guard, không reset target chưa xác minh; migration baseline/upgrade khi đã apply. Quyền DB kiểm bằng application role, owner pass không thay grant proof.

| Gate | Bằng chứng cần có |
|---|---|
| G-carryover | Từng S05-01..08 và S04 còn mở, đường dẫn/test/kết quả, không gom một PASS |
| G-money-db | Close cạnh tranh writer, đảo đúng dòng, hoàn ca chi thực, idempotency/rollback trên PG thật |
| G-auth | Logout lỗi/phục hồi/multi-instance, alumni approved-only, trạng thái/token invalidation; provider riêng |
| G-catalog | Hai bản khác giá/kho, nhiều tác giả/thể loại, NULL/biên cọc, archive/history, CRUD không đổi loan state |
| G-borrower | Người dân không MSSV/trường, chung phone hai ID, guest/alumni list/search/direct-ID bị từ chối |
| G-search-db | Có dấu/không dấu/dấu câu/input độc hại, pagination/count không lặp, index/plan PG phù hợp |
| G-contract-http | Route đúng OpenAPI/status/envelope, malformed/oversized input/cache/auth matrix; handler và Workers HTTP tách riêng |
| G-baseline | Check/build/test độc lập không đăng ký lặp; lệnh/exit code/môi trường thực |

Thiếu PG/provider/Workers vẫn hoàn thiện code/test độc lập, ghi PARTIAL/BLOCKED và cách tái chạy. Không gọi T01–T74 trong tài liệu là UAT đã chạy. Không nối state demo thành nguồn chuẩn tiền. Không đổi UI thì không làm lại screenshot; nếu đổi phải kiểm runtime desktop/mobile thực và giữ design.md.

## E. Bàn giao và điểm dừng

1. Implementation, migration/schema, test/fixture và OpenAPI đúng phần đổi. Diagram/ADR/domain/finance docs chỉ sửa contract thực thay đổi, không rewrite toàn bộ tài liệu.
2. Cập nhật progress: từng finding/gate, files đổi, lệnh/kết quả thực, môi trường/blocker, policy còn mở và đầu vào07. README phản ánh bằng chứng, report05 giữ nguyên như snapshot reviewer.
3. Bàn giao request/response mẫu dữ liệu giả cho catalog/borrower, quyền và giới hạn. Tách source/unit pass với PG/runtime chưa chạy.
4. Dừng tại06 để review, không tự làm07 hoặc commit/deploy. Không tuyên bố sẵn sàng tiền/PII thật khi gate còn mở. Cuối lượt tóm tắt đã sửa/còn gì/đã kiểm/rủi ro/bước tiếp theo.

