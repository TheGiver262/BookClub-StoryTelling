# Review chặng 03 — 18/10/2026

## Kết luận và phạm vi

Chặng 03 tạo Workers entry, router, policy helpers, adapter Auth, mapping SQL và 24 unit tests. Carryover chặng 02 đã được sửa phần lớn trong source. Tuy nhiên **chưa nghiệm thu Auth và chưa an toàn để gắn API tiền**: server thường còn mock credentials, khóa ký mặc định, suy quyền từ username và cấp phiên khách chưa xác thực. Trạng thái phù hợp là PARTIAL; DB/provider/Workers integration chưa được reviewer xác minh.

Review follow-up theo prompt 03 và snapshot `.review-artifacts/stage02-review-manifest.json`. Không có `.git`; snapshot đầu lượt này là `.review-artifacts/stage03-review-manifest.json` (57 file). Không sửa implementation. Chỉ tạo bằng chứng local, báo cáo, prompt 04 và chỉ dẫn README/index. Quy mô đánh giá: dưới 5.000 sách, dưới 100 lượt/buổi, 3–5 người nhập đồng thời.

## Cần sửa trước khi mở API tài chính

### S03-01 — P1: Server thường có sẵn đường đăng nhập demo và khóa ký mặc định

**Vị trí:** `src/server/auth/provider.ts:62–108`, `:163–185`; `src/server/auth/tokens.ts:22`, `:56–59`, `:91–94`; `router.ts:94–109`.

Thiếu provider config sẽ tự chuyển sang bảng username/mật khẩu demo, kể cả `NODE_ENV=production`. Thiếu JWT secret thì sign/verify dùng khóa cố định trong source. Repro direct handler xác nhận đăng nhập demo nhận ADMIN; một token ADMIN ký bằng khóa mặc định, không có memberId/mapping, vẫn đọc `/api/v1/members` với HTTP 200 ở production mode. Đây là bypass của server entry thường, không phải test fixture được inject riêng.

**Sửa:** xóa default secret và mock fallback khỏi đường chạy thường; thiếu provider/session config thì fail closed. Fixture credentials và fake signer chỉ nằm trong test, không được bật qua header/query hoặc env dễ mang sang server thường. Không tự ký JWT để thay provider chưa được kiểm chứng; chọn provider verification hoặc session server-side có nguồn danh tính thật. Nếu còn JWT thì dùng thư viện/provider chuẩn, bắt buộc kiểm các claim/type/expiry, không chỉ TypeScript interface; không có khóa dự phòng.

**Hồi quy:** cấu hình thiếu hoặc production/dev server thường không đăng nhập được demo, không chấp nhận token từ khóa cũ; test fixture vẫn chạy bằng dependency injection riêng. Không đưa password/token thực vào report/log. Nếu bỏ qua, cấu hình thiếu có thể mở quyền quản trị thay vì khóa ứng dụng.

### S03-02 — P1: Nhánh provider suy quyền ADMIN từ username, bỏ qua mapping/trạng thái DB

**Vị trí:** `src/server/auth/provider.ts:141–160`; `router.ts:97–109`; `schema/01_schema.sql:132–142`.

Sau HTTP 200 từ provider, code gán ADMIN khi username chứa `admin` hoặc bằng tên demo, không SELECT `internal_identities`/`members`. Actor không có memberId, luôn active, không alumni, version 1. Resolver bỏ qua kiểm quyền hiện tại khi không tìm được member trong mock store. Với provider response giả có subject chưa được cấp, username `review_admin` nhận ADMIN và đọc member list 200. Provider đã được stub chỉ để đi qua nhánh này; chưa tuyên bố đây là thử nghiệm Supabase live hay chứng minh public signup đang mở.

**Sửa:** provider subject phải khớp mapping nội bộ đã được admin cấp và issuer/realm được chọn; lấy memberId/quyền/trạng thái/version từ DB. Không có mapping, bị khóa, sai kiểu credential hoặc DB không truy cập được thì từ chối/fail closed; không tin username/email/user_metadata/token role làm quyền hiện tại. Kiểm cả GET và mutation. Tài khoản có chữ admin trong tên không tạo đặc quyền.

**Hồi quy:** provider success cho subject chưa được cấp bị chặn; member username chứa admin vẫn là member; alumni/disabled nhận đúng trạng thái; phiên cũ bị chặn sau thay quyền qua DB. Provision/reset và direct provider linking/reset cần bằng chứng provider riêng. Nếu bỏ qua, credential provider bất kỳ được nhánh này nhận có thể thành quyền nội bộ không được cấp.

### S03-03 — P1: Đăng nhập khách cấp phiên từ email/token bất kỳ

**Vị trí:** `src/server/auth/provider.ts:188–211`; `router.ts:180–194`.

`loginGuestUser` không kiểm mật khẩu, không verify Google token, không gọi managed provider. Chỉ gửi email giả, không password/token vẫn nhận 200 và phiên GUEST; token tùy ý cũng đi qua. Role GUEST không giải quyết việc giả mạo danh tính khách. Các chức năng bình luận/đánh giá sau này sẽ nhận actor chưa được xác thực nếu dùng tiếp adapter này.

**Sửa:** xác thực email/password hoặc OAuth qua provider thật, lấy subject ổn định đã verify; không có credential hợp lệ thì không cấp phiên. Thiếu provider phải 503/fail closed, không cấp guest token thay thế. Không dùng Date.now làm định danh tài khoản đã đăng nhập.

**Hồi quy:** email đơn lẻ, sai/thiếu password, token rác/hết hạn/sai audience/issuer bị chặn; flow Google thiếu cấu hình ghi BLOCKED, không fake thành công. Kiểm cùng email liên hệ nội bộ vẫn là identity khách độc lập khi đã verify.

### S03-04 — P1: Thu hồi quyền dùng hai kho nhớ khác nhau; logout chưa vô hiệu phiên

**Vị trí:** `router.ts:34–110`, `:208–217`, `:224–256`; `auth/provider.ts:62–108`, `:164–185`.

Status API chỉ sửa `mockMembersDb` của một isolate; login lại đọc `mockUserStore` riêng. Repro: chuyển member sang alumni 200, login mới 200 nhưng token mới gọi `/auth/me` bị 401 vì login vẫn cấp version cũ. Khởi động lại/chạy isolate khác cũng không giữ trạng thái revoke đã sửa. Nhánh provider không có memberId nên còn bỏ qua kiểm này. `/logout` chỉ xóa cookie; cùng bearer token gọi `/auth/me` sau logout vẫn 200.

**Sửa:** dùng DB/session store làm nguồn chuẩn cho identity, status và revocation; đổi trạng thái/version/audit trong transaction. Login mới đọc trạng thái mới; alumni vẫn đăng nhập và chỉ xem activity, khóa là trạng thái riêng. Logout/revoke phải có hợp đồng rõ cho cookie/bearer/refresh đang được cấp và vô hiệu phiên tương ứng phía server/provider. Không dùng in-memory map cho quyền hoặc state giao dịch serverless.

**Hồi quy:** phiên cũ bị từ chối trên GET/mutation sau thay trạng thái, phiên alumni mới đọc activity được; khóa rồi không đăng nhập/refresh được; logout rồi token/refresh cũ không mở lại phiên theo hợp đồng. Thử request trên hai instance cùng DB nếu runtime hỗ trợ, không lấy một object mutation trong unit test làm bằng chứng thu hồi toàn hệ thống.

### S03-05 — P2: Payload có thể giữ đồng thời alumni và admin

**Vị trí:** `router.ts:244–250`; `auth/policy.ts:53–61`.

PATCH `{isAlumni:true,isAdmin:true}` xóa admin trong nhánh đầu rồi gán lại admin ở nhánh sau. Resolver ưu tiên is_admin thành role ADMIN; `requireAdmin` không loại alumni. Repro với admin đang có quyền: API lưu cả hai cờ true; một session hợp lệ do test helper ký cho account đó gọi tiếp mutation admin nhận 200. Test helper dùng secret giả đã biết ở môi trường test; không coi bước đó là bypass chữ ký độc lập.

**Sửa:** cấm trạng thái mâu thuẫn ở validation/domain/DB theo mô hình đã chọn; chuyển alumni luôn thu hồi admin. `requireAdmin` kiểm active và không alumni như lớp phòng vệ. Không chỉ đổi thứ tự hai câu if rồi để đường cập nhật khác tạo trạng thái sai.

**Hồi quy:** payload mâu thuẫn bị từ chối hoặc normalize có hợp đồng rõ; không bao giờ lưu alumni+admin; session có các cờ mâu thuẫn không qua admin policy. Bổ sung audit và test cùng transaction sau khi DB sẵn.

### S03-06 — P2: Cookie production và request validation chưa đạt biên đã giao

**Vị trí:** `router.ts:159–174`, `:181–182`, `:242`; `auth/provider.ts:117–119`.

Đăng nhập trong production mode vẫn đặt cookie thiếu Secure. Body `{username:'review_user',password:123}` gây `.trim()` TypeError và HTTP 500 thay vì lỗi validation 400. JSON được cast any, chưa có schema/body limit; chưa có Origin/CSRF validation cho cookie mutations hoặc rate limit ở entry. Direct handler chưa đủ để chứng minh một khai thác CSRF từ browser, nên không kết luận browser exploit đã tái hiện.

**Sửa:** request validation có bounds/type trước provider/DB, cookie Secure ở HTTPS/production, ngoại lệ HTTP chỉ local dev rõ ràng; Origin/CSRF và cache/no-store cho dữ liệu Auth/nhạy cảm theo session model được chọn. Bổ sung rate limit phù hợp runtime, không gọi counter unit/in-memory là chống DDoS cloud. Không log password/token. Ignore `.dev.vars` nếu dùng file secret chuẩn Wrangler; giữ env example chỉ placeholder.

**Hồi quy:** sai kiểu/oversize/malformed request trả lỗi client ổn định; cookie production có Secure/HttpOnly/SameSite; mutation từ Origin không được phép bị chặn. Secret scan hiện tại chỉ tìm vài pattern key, không phát hiện S03-01, nên không dùng nó như bằng chứng Auth không có bypass.

### S03-07 — P2: Test concurrency khởi động client 2 trước client 1, chưa cố định người giữ khóa

**Vị trí:** `tests/integration/loan-item-constraints.test.ts:152–185`.

Đã thêm pg_blocking_pids và SQL timeouts, nhưng `client2Promise` được gọi ngay trước `client1 BEGIN/INSERT`. Một lịch chạy hợp lệ là client 2 INSERT/COMMIT trước, hoặc giữ khóa làm client 1 chờ; assertion lại bắt buộc client 2 bị client 1 chặn. Test có thể fail dù trigger đúng. Đây là regression từ carryover S02-03; chưa tái hiện trên PostgreSQL vì runtime vẫn thiếu.

**Sửa nhỏ nhất:** BEGIN/INSERT client 1 xong, giữ transaction mở, rồi mới khởi động client 2 và quan sát PID chờ khóa. Đặt toàn bộ setup trong try/finally, có timeout test/observer và rollback/settle mọi promise; ghi isolation level thực. Không bỏ phép quan sát hoặc biến test thành tuần tự hoàn toàn.

**Hồi quy:** chạy DB test thật, lặp một số lần để kiểm ổn định; thử lỗi giữa luồng để chứng minh cleanup hữu hạn. Chưa có DB thì giữ S02-03 PARTIAL, không ghi fixed hoàn toàn.

### S03-08 — P2: Contract/diagram và cấp bằng chứng chưa khớp implementation

**Vị trí:** `docs/technical/openapi.yaml:14–25`, `:57–80`; `docs/technical/diagrams/07_sequence_auth_and_roles.mmd`; `docs/technical/adr/001-managed-auth-username-mapping.md`; progress mục 9.2/9.4 và README local gates.

OpenAPI dùng server `/v1` + `/auth/internal/login`; handler dùng `/api/v1/auth/login-internal`. Gửi theo contract vào handler hiện tại sẽ 404. Guest contract chỉ có provider/idToken, khác body handler và chưa biểu diễn email/password. Me/logout cũng chưa có contract. Diagram 07 vẫn dùng `auth_users_mapping` thay bảng mới `internal_identities`, luồng provision chưa có handler. Các artifact mô tả DB là nguồn quyền, trong khi server đang dùng mock.

24 unit tests gọi thẳng `handleRequest` bằng Node Request/Response; không phải 24 test HTTP trên workerd/provider/DB. Reviewer chạy lại 24 test pass nhưng gặp spawn EPERM khi khởi chạy Wrangler, nên chưa xác minh G-runtime trên Workers. ADR ghi Accepted, “miễn nhiễm hoàn toàn/đáp ứng 100%” dựa vào alias domain dù provider gates còn BLOCKED; alias không thay kiểm signup/link/change/reset trực tiếp đã giao.

**Sửa:** thống nhất route/session/body/error/security với handler đã có; planned endpoint ghi planned. Kiểm tra contract bằng HTTP thật khi runtime sẵn. ADR để Proposed/Experimental cho đến khi spike đạt; bỏ bảo đảm tuyệt đối. Cập nhật đúng mức source/unit/router/Workers/DB/provider, giữ review cũ nguyên trạng. Bảng chặng 02 còn G-baseline PASS bao gồm thiếu DB test phải tách rõ. Cảnh báo pnpm hiện tại cho biết `pnpm.onlyBuiltDependencies` bị bỏ qua; chuyển đúng cấu hình project của phiên bản đang dùng nếu cần build workerd/esbuild, không đổi global config.

## Kiểm lại carryover chặng 02

| Finding | Kết quả |
|---|---|
| S02-01 guard đích DB | Đã sửa bypass đã báo: cấm query/hash, object driver đã kiểm, IPv6, prefix chặt, SELECT current_database trước reset. 5 unit guard pass; phần server DB chưa chạy |
| S02-02 reset schema song song | Đã sửa script `--test-concurrency=1`; chưa chạy suite DB thật |
| S02-03 quan sát concurrency/cleanup | PARTIAL: có PID/pg_blocking_pids/timeouts; còn S03-07 về thứ tự khởi động, timeout/cleanup đầy đủ và bằng chứng DB |
| S02-04 UPDATE description | Đã thêm regression từ mới/từ cũ/NULL; chưa chạy PostgreSQL |
| S02-05 truy vết/coverage | Đã sửa các tham chiếu bị báo và bỏ câu bao phủ đủ chín nhóm; còn lệch contract/evidence mới tại S03-08 |

## Kiểm tra chạy lại và bằng chứng

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit 0; 26 file, 0 lỗi, 0 warning, 16 hint; tsc pass | Không phát hiện lỗi logic xác thực |
| `rtk pnpm exec astro build --outDir .review-artifacts/stage03-build` | Exit 0; 3 trang static | Không build/nghiệm thu Workers backend |
| `rtk pnpm run test:unit` | Exit 1, spawn EPERM ở child process | Hạn chế sandbox Windows; không quy thành lỗi code |
| `node --experimental-strip-types --test --test-isolation=none tests/unit/db-harness.test.ts tests/unit/auth-policy.test.ts tests/unit/api-routes.test.ts tests/unit/secrets-guard.test.ts` | Exit 0; 24/24 pass | Lệnh thay đổi isolation để tránh spawn, test trực tiếp handler/fixtures |
| Python unittest discover | Exit 0; 22/22 pass | PoC cũ, không thay DB/HTTP/Auth |
| Redocly CLI 2.64.1 lint OpenAPI | Exit 0; 0 lỗi, 24 warning | Cấu trúc hợp lệ không chứng minh contract đúng handler |
| Node DB suite với `--test-isolation=none --test-concurrency=1` | Exit 1; 8 test không qua before hook vì DB_RUNTIME_MISSING | Không có SQL assertion nào được nghiệm thu |
| Docker/PATH | Docker daemon pipe chưa chạy; không có psql trên PATH | R01/R03 vẫn chưa xác minh runtime |
| Wrangler local port 8794 | Exit 1 spawn EPERM ở launcher, chưa có server được khởi động | Không có Workers HTTP smoke mới; không báo deploy/runtime pass |
| `node --experimental-strip-types .review-artifacts/stage03-auth-repro.mjs` | Exit 0; assert tái hiện S03-01..S03-06 | Chỉ direct handler, data/secret giả, provider response stub; không gọi network/DB thật |

Repro output lưu tại `.review-artifacts/stage03-auth-repro.json`; không lưu token/password trong output. Những ca phản ví dụ vẫn xảy ra dù 24 test gốc pass. Chưa có Go module thuộc phạm vi. UI source/logic không đổi so snapshot trước, không lặp browser review cũ.

## Bàn giao chặng 04

Sửa S03-01..S03-08 trước khi tin cậy Auth hoặc mở endpoint tiền. Khi provider/DB chưa sẵn, vẫn có thể làm lõi ledger/deposit/idempotency và test runner với actor test tin cậy chỉ ở test; không gắn HTTP tiền vào actor từ mock/username/token claims chưa đối soát. Giữ gates PARTIAL/BLOCKED theo bằng chứng.

R04 finance vẫn mở: schema chưa có allocation/nghĩa vụ cọc/chờ hoàn/ghi tiền thực; hai bảng idempotency vẫn khác scope; chưa có bất biến journal được kiểm bằng runtime role. R02/R07/R09/R10/R11 và các module khác theo 22 chặng, không đóng nhờ Auth unit test pass. R05 tiếp tục mở do các lỗi Auth ở trên.

**Prompt tiếp theo:** [04-ledger-idempotency.md](../prompts/antigravity-next/04-ledger-idempotency.md), gồm sửa carryover, phạm vi finance nhỏ và gate DB/HTTP riêng.

**Chưa kiểm:** PostgreSQL, managed provider/Google, Workers HTTP, mobile, ngân hàng, load/penetration, backup/restore và production. Không có bằng chứng website live đã bị khai thác; các bypass được tái hiện ở code handler local.
