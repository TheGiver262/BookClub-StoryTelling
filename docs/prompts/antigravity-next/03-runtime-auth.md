# Chặng 03 — Runtime backend và managed Auth cách ly nội bộ/khách

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-stage02-followup.md, review gốc docs/reviews/2026-10-18-antigravity-review.md và index 22 chặng docs/prompts/antigravity-next/README.md. Đặc tả chuẩn: docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và implementation hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 01, 02. Chặng 02 hiện BLOCKED vì chưa có PostgreSQL runtime và còn S02-01..S02-05. Không coi “đã viết test” là đã hoàn thành phụ thuộc. Sửa carryover ở mục 0 trước; sau đó tiến hành phần runtime/Auth có đủ đầu vào. Nếu DB/provider vẫn thiếu, tiếp tục phần độc lập nhưng để các gate tích hợp BLOCKED, không báo hoàn tất toàn chặng.

**Findings liên quan:** R05, phần security của R06; carryover S02-01..S02-05, trong đó S02-05 là phần còn lại của S01-02.

**Files/responsibility:** Tận dụng project Astro/React/TypeScript hiện có. Tạo backend entry theo runtime Workers đã chọn, lớp identity/policy/DB tối thiểu (ví dụ src/modules/identity/, src/middlewares/auth.ts, src/db/client.ts nếu phù hợp cấu trúc thực); migration mapping cần thiết; test HTTP/Auth/provider có tên/lệnh rõ. Sửa tests/integration/db-harness.ts và hai test DB hiện có cho carryover. Package/lock/runtime config/.env.example chỉ thay khi cần, không chứa secret. Đồng bộ OpenAPI, security-operations, architecture/ADR liên quan, progress và nguồn/render diagram 07 khi đổi luồng. Không sửa cả bộ diagram hoặc viết lại UI.

## 0. Sửa và kiểm lại carryover trước

### 0.1 S02-01 — An toàn test DB

- [ ] Guard và driver phải dùng cùng cấu hình đã kiểm. Tái hiện offline bằng URL giả `postgresql://review:dummy@127.0.0.1:5432/ysbk_test_review?host=example.invalid`: hiện guard nhận local nhưng pg nhận host khác. Không được mở kết nối với URL này để thử lỗi.
- [ ] Cách sửa nhỏ: từ chối query parameters không cần cho local hoặc chỉ cho một allowlist thật sự cần; không truyền URI gốc chưa kiểm trở lại driver. Dùng nhất quán cho Pool và isolated Client. Kiểm host/port/database hiệu lực, IPv6 và namespace test `ysbk_test_...`; xác nhận DB/môi trường test do task sở hữu trước reset. Không coi prefix một mình là bằng chứng được phép xóa mọi DB cùng tên.
- [ ] Thêm unit test guard không cần PostgreSQL: URL thiếu/sai, host remote, query host/port override, DB thường/hệ thống bị chặn trước connect/reset; URL hợp lệ được chấp nhận. Test lỗi/log không lộ password cả authority và query. Không giữ connection string trong log hoặc bàn giao. Artifact stage02-guard-repro.mjs là bằng chứng bug trước sửa; sau sửa phải có regression test đúng kỳ vọng từ chối, không sửa report cũ để xóa bằng chứng.

### 0.2 S02-02/S02-03/S02-04 — Test DB phải đáng tin

- [ ] Hai file DB hiện cùng drop schema public. Khi dùng chung disposable DB, chọn cách nhỏ nhất: `--test-concurrency=1` ở runner file. Hai client bên trong test concurrency vẫn phải hoạt động đồng thời; không thêm mutex ứng dụng tuần tự hóa chúng.
- [ ] Test R03 lấy PID hai client, xác nhận client 2 đã gửi INSERT và đang bị client 1 chặn bằng `pg_blocking_pids`/quan sát DB tương đương. Poll có deadline; sleep 150ms và `finished=false` không là bằng chứng. Ghi isolation level thực được hỗ trợ; không khẳng định an toàn cho mọi isolation/deadlock pattern khi chưa kiểm.
- [ ] Đặt test timeout và statement/lock timeout phù hợp, cleanup rollback/pending promises/clients trên mọi đường lỗi. Kiểm lỗi giữa luồng không làm suite treo. connectionTimeoutMillis không thay timeout câu query.
- [ ] Thêm regression UPDATE description: từ mới match, từ cũ mất, chuyển NULL vẫn tìm theo title. Chạy nguyên DDL/seed, search, third/bulk insert, move receipt, normal update, active-copy uniqueness và rollback trên PostgreSQL disposable. Không sửa ràng buộc để chiều test hoặc xóa partial unique index; R02 vẫn thuộc 09.
- [ ] Reviewer chưa chạy được Docker/psql. Kiểm lại môi trường, dùng runtime local hợp lệ nếu sẵn; không reset DB thật, tự tạo cloud project hoặc thay bằng SQLite. `pnpm run test:db` phải exit 0 trên DB thật mới đóng DB gates. Nếu gặp Windows spawn EPERM, phân biệt sandbox với lỗi code; có thể chạy từng file trực tiếp để chẩn đoán nhưng phải ghi lệnh thực và chưa coi script chính đã pass. Không tắt process isolation rồi giữ hai root hooks dùng chung DB mà chưa kiểm lifecycle.

### 0.3 S02-05 — Truy vết và trạng thái

- [ ] Sửa ngữ nghĩa bảng technical README: FR-06 không dùng T51/T52 như bằng chứng quản lý sự kiện, FR-07 không dùng T63 làm ca báo cáo; bổ sung tham chiếu T23–T28 cho phần phạt/lịch/chuyển phiếu phù hợp. Giữ nội dung T cũ; phần thiếu case riêng ghi thiếu. Đối chiếu các hàng còn lại với T01–T74.
- [ ] Bỏ câu “Bao phủ toàn diện 9 nhóm” trong OpenAPI khi còn endpoint dự kiến. Lưu rõ proposed/contract implemented/runtime verified. Giữ index 22 chặng. Tách baseline check/build PASS khỏi DB gates còn BLOCKED; không dùng fail-closed thiếu env làm bằng chứng DDL đúng. Không quay lại sửa màu/logo/font.

## Thực hiện

- [ ] Chọn một backend trong project, tận dụng stack hiện có. Dựng entry chạy thật trên runtime Workers local tương ứng (ví dụ Wrangler nếu phù hợp version thực), không chỉ Node mock server hoặc dist static. Health không lộ chi tiết hệ thống; readiness báo chưa sẵn khi DB/provider bắt buộc không truy cập được. Lỗi có request ID, không stack/secret/PII. Ghi lệnh start và HTTP smoke; chưa triển khai cloud.

- [ ] Chứng minh driver/kết nối DB hoạt động trên runtime được chọn: pooling/TLS, transaction, binding/env phía server. pg hiện có trong devDependencies phục vụ test Node không tự chứng minh Workers dùng được. Application DB role ít quyền, không owner/superuser/service-role cho truy vấn nghiệp vụ thường. Tránh mở Data API/RPC/raw table cho khách vượt qua middleware; nếu bật Supabase Data API thì RLS/grants phải được kiểm trực tiếp. Test/reset role tách application role.

- [ ] Viết ADR ngắn cho đường username + managed Auth trước khi triển khai. Supabase password gắn email/phone; username mapping và cờ INTERNAL không tự tạo cách ly. Nguồn chính thức cần đọc lại theo version/cấu hình sử dụng: https://supabase.com/docs/guides/auth/passwords và https://supabase.com/docs/guides/auth/auth-identity-linking. Chọn phương án đáp ứng toàn bộ biên dưới và kiểm bằng provider thật; không tự hash mật khẩu hoặc tự ký JWT để thay provider. Không đổi yêu cầu username thành email đăng nhập cho nội bộ. Nếu chọn session cookie phía server, ghi luồng cấp/kiểm/revoke và đồng bộ OpenAPI, không bắt giữ một JWT contract cũ chỉ để giống tài liệu.

- [ ] Mapping có uniqueness cho username chuẩn hóa và cặp issuer/provider subject; identity nội bộ do admin provision, giữ email liên hệ tách credential. Không suy quyền từ email, Google profile, username hoặc role/identity_type trong user_metadata/body/header do khách sửa được. Dùng nguồn tin cậy phía server. Provision lỗi giữa provider và DB phải có trạng thái/cleanup hoặc retry có kiểm soát, không để account nửa chừng có quyền. Không làm custom password store.

- [ ] Luồng tối thiểu: admin cấp/reset/khóa tài khoản nội bộ, nội bộ login username/password, lấy current actor, logout/revoke; khách email/password và Google login theo cơ chế provider hỗ trợ. Chuẩn hóa/unique username phía server. Không tạo public self-provision internal/admin. Nếu chưa có UI cho admin, dùng server command/bootstrap một lần ở local test có guard, không public bootstrap endpoint. Ghi rõ phần admin HTTP nào đã có hoặc chưa có; không coi direct SQL test là API admin đã xong.

- [ ] Chứng minh cách ly credential kể cả cùng email liên hệ: khách Google/email không chiếm hoặc quản trị credential nội bộ qua signup/link/change email/add/reset password và gọi thẳng API provider. Giấu alias kỹ thuật không phải security boundary. Auth claim phải kiểm chữ ký/issuer/audience/expiry theo provider thật; không chỉ decode. Nếu cách chọn không đạt, sửa phương án hẹp nhất có căn cứ và ghi ADR; không nới quyền hoặc thêm nhiều nền tảng để né spike chưa chạy.

- [ ] Policy dùng trạng thái hiện tại từ server cho cả đọc/ghi/download/tác vụ nền. Thành viên đang hoạt động quản lý nghiệp vụ bất kỳ ban; chỉ admin quản lý tài khoản/audit. Alumni chỉ activity DTO allowlist đã duyệt, không tiền/PII/file export/mutation; trạng thái khóa chặn riêng. Chuyển admin sang alumni đồng thời thu hồi admin; phiên/access/refresh cũ không mở lại đặc quyền. Khi revoke chạm transaction đang ghi, chốt quy tắc thứ tự/khóa và kiểm nhất quán, không chỉ tăng token_version trong tài liệu.

- [ ] Tạo đường HTTP tối thiểu đủ kiểm identity/policy: login/current actor, activity an toàn cho alumni, một tài nguyên nội bộ đọc DB thật và thao tác quản trị trạng thái/tài khoản trong phạm vi này. Không mở toàn bộ CRUD nghiệp vụ. Với export/download/background chưa triển khai, kiểm policy dùng chung và ghi đúng cấp bằng chứng, giữ integration gate tương ứng còn mở; không tạo route giả luôn trả 403/200 để báo đã kiểm file hoặc tác vụ nền.

- [ ] Bảo vệ phiên và trust boundary: cookie HttpOnly/Secure/SameSite phù hợp (ngoại lệ HTTP local chỉ dev), CSRF cho cookie mutations, OAuth state/PKCE/redirect allowlist theo provider, CORS hẹp, body limit/schema validation, generic login errors. Dùng cơ chế rate limit phù hợp runtime; local in-memory test không được gọi là chống spam/DDoS ở cloud. Không log credential/token, không nhúng admin/service secret vào client bundle; thêm env example chỉ tên/placeholder và ignore file secret. Admin MFA/recovery theo thiết kế phải có cấu hình/đường kiểm hoặc gate BLOCKED, không ghi “đã bật” từ config mẫu.

- [ ] Trusted test actor chỉ inject trong unit/domain test; không có header/query/env bypass cho server thường hoặc production bundle. Test giả không thay gate provider. Không dùng role switch trong InternalWorkspace làm phiên người dùng thật; chỉ nối UI login tối thiểu khi backend login thực đã sẵn, giữ phần giao dịch mock được ghi nhãn.

- [ ] OpenAPI khớp handler thực: body email login có email/password hợp lệ; response/session và lỗi 400/401/403/429 đúng thực tế. Phân biệt lịch trực DTO công khai đã lọc với lịch/phân công nội bộ; không public `/duty/shifts` trả toàn bản ghi nhạy cảm. Form webhook thuộc 16, đánh dấu cần signature/replay protection, không mở receiver chưa bảo vệ trong chặng 03. Chỉ thêm hợp đồng có handler trong scope hoặc ghi rõ planned.

## Gate phải chứng minh

Ghi trạng thái từng gate độc lập, với lệnh/môi trường/version/test count/exit thực:

1. **G-carryover:** S02-01..S02-05 đã sửa, unit guard offline pass; PostgreSQL thật apply/seed/search/invariant pass mới đóng R01/R03. Khi thiếu runtime, giữ riêng DB BLOCKED và nêu phần đã làm.
2. **G-runtime:** backend local chạy trên Workers runtime đã chọn; gọi health/readiness và lỗi bằng HTTP thật. DB thiếu thì readiness 503, không fake healthy. Chứng minh binding/driver chạy được, không dùng frontend :4321/noi-bo hoặc build static thay chứng cứ API.
3. **G-provider:** provision, username/password verify, logout/revoke, guest email và OAuth/các đường linking/reset trực tiếp được kiểm với managed provider thật ở môi trường test được phép. Không tự tạo cloud project hoặc cần tài khoản trả phí. Có thể dùng provider local chính thức nếu sẵn; Google flow thiếu cấu hình ghi riêng BLOCKED. JWKS giả/test actor chỉ là unit test, không đóng gate này.
4. **G-policy/HTTP:** không có phiên nhận 401; guest bị chặn nội bộ; member quản lý nghiệp vụ nhưng bị chặn tài khoản/audit; admin được quản trị; alumni nhận DTO hoạt động không có tiền/PII, không mutation/export. Giả role/body/header, token sai chữ ký/issuer/audience/hết hạn và trùng email không mở quyền. Khi chuyển alumni/khóa, thử lại cùng phiên/refresh cũ; không chỉ đăng nhập mới rồi kiểm. GET lẫn mutation phải chặn sau revoke. Trường hợp file/tác vụ nền chưa có chỉ ghi unit/policy tested, integration pending.
5. **G-secrets/baseline:** check/build, 22 Python tests, DB suite và Auth tests đúng phạm vi; OpenAPI lint có version rõ (reviewer dùng 2.64.1), giải thích warning còn lại. Kiểm bundle/log với marker secret giả, không dump env/secret thật. Test:db/provider không được skip rồi báo toàn chặng PASS. Giữ source/render diagram đúng trạng thái thực.

Thiếu DB/provider credential không chặn việc sửa harness, tài liệu, request validation và policy unit tests. Tuy nhiên không được gọi DB/Auth/runtime chưa chạy là đã nghiệm thu. Nếu chặng quá lớn sau carryover, bàn giao PARTIAL tại mốc tự nhiên và nêu phần 03 còn lại; không tự đánh dấu sang chặng 04.

## Đầu ra

Skeleton backend chạy được ở mức đã chứng minh + đường Auth cụ thể + migration/mapping/policy/tests. README có lệnh local, biến môi trường dạng placeholder, cách bootstrap test và các gate còn thiếu. Progress giữ đủ 22 chặng, ghi riêng finding đã sửa bằng code/chưa verify runtime. Không sửa các report review cũ để thay lịch sử bằng chứng; không triển khai toàn bộ CRUD/ledger/cash session/phân ca trong chặng này.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

