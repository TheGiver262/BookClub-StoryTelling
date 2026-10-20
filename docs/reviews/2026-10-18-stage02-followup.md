# Review chặng 02 — 18/10/2026

## Kết luận và phạm vi

Chặng 02 đã thay generated search vector bằng trigger, bổ sung khóa parent receipt và tạo integration harness PostgreSQL. Hướng sửa phù hợp, nhưng **chưa đủ điều kiện nghiệm thu: DB gates vẫn BLOCKED và harness có lỗi cần sửa trước khi reset DB**. Progress của Antigravity cũng ghi BLOCKED; không có bằng chứng PostgreSQL đã chạy thành công.

Review follow-up thay đổi so với `.review-artifacts/stage01-review-manifest.json`, tập trung schema, ba file test mới và carryover S01-01..S01-04. Workspace không có `.git`; snapshot đầu lượt review nằm ở `.review-artifacts/stage02-review-manifest.json` (41 file). Không sửa implementation trong lượt review; chỉ ghi bằng chứng offline, báo cáo và prompt/README chỉ dẫn.

Quy mô đánh giá giữ nguyên: dưới 5.000 sách, dưới 100 lượt mượn/trả mỗi buổi, tối đa 3–5 người nhập đồng thời. Lỗi harness là rủi ro môi trường phát triển/test, chưa phải lỗ hổng website production đang chạy.

## Cần sửa trước khi đóng chặng 02

### S02-01 — P1: Guard kiểm một host, driver có thể kết nối host khác

**Vị trí:** `tests/integration/db-harness.ts:45–75`, `:95–107`, `:114–122`.

Guard kiểm `URL.hostname` và pathname, sau đó đưa nguyên connection string vào `pg`. URL có authority `127.0.0.1` nhưng thêm `?host=example.invalid` vẫn qua guard; `new pg.Client(...).connectionParameters.host` thực tế là `example.invalid`. Nếu host đích có DB test cùng tên và credential hợp lệ, `resetSchema()` sẽ thực thi `DROP SCHEMA public CASCADE` ở ngoài môi trường local được kiểm tra. Đây là lỗi ở ranh giới cấu hình phá dữ liệu, không cần chờ DB thật để xác nhận cấu hình bị đổi đích.

**Tái hiện:** `node --experimental-strip-types .review-artifacts/stage02-guard-repro.mjs`. Kết quả: `guardAccepted=true`, `validatedHost=127.0.0.1`, `effectiveHost=example.invalid`; `networkConnectionAttempted=false`, `databaseResetAttempted=false`. Chỉ dùng dữ liệu giả. Không kết nối host đó. Kiểm thử riêng cũng xác nhận query `port` thay port driver nhận. Các thử nghiệm `database`/`dbname` không đổi database trong phiên bản pg đã cài; không suy diễn thành bypass database name.

`sanitizedUri` còn giữ mật khẩu nếu truyền qua query `password=...`; helper hiện chưa có caller log giá trị đó, nên đây là lỗi redaction kèm theo, chưa phải bằng chứng đã lộ secret. `::1` trong allowlist cũng cần kiểm với WHATWG URL trả hostname có dấu ngoặc vuông.

**Sửa nhỏ nhất:** từ chối query parameters không cần cho local test hoặc parse thành cấu hình driver có các trường đã kiểm; không validate xong lại dùng URI gốc chưa kiểm. Chuẩn hóa IPv6/tên DB theo hợp đồng; dùng namespace `ysbk_test_...` rõ ràng. Trước reset đối chiếu `current_database()` và môi trường test do task sở hữu. Không in URI/secret; regression test offline phải chặn host/port override, query password và DB không hợp lệ mà không cần network.

**Nếu bỏ qua:** lệnh test có thể xóa schema trên máy chủ ngoài dự kiến khi cấu hình bị sao chép/sửa sai. Sửa ảnh hưởng cả Pool và isolated Client; cả hai phải dùng cùng cấu hình đã kiểm.

### S02-02 — P2: Hai file test cùng reset schema trong các process riêng

**Vị trí:** `package.json:13`; `tests/integration/schema.test.ts:8–12`; `tests/integration/loan-item-constraints.test.ts:8–12`; `db-harness.ts:114–122`.

Script `node --test fileA fileB` dùng mặc định process isolation. Mỗi file có `before()` tự drop/recreate cùng schema `public` ở cùng TEST_DATABASE_URL. Khi hai file chạy song song, một file có thể xóa bảng trong lúc file kia apply DDL hoặc đang kiểm search/loan; có thể lỗi object tồn tại/biến mất, deadlock hoặc kết quả chập chờn. Node chạy mỗi file trong process riêng và điều khiển mức song song bằng `--test-concurrency`. [Tài liệu Node 24](https://nodejs.org/docs/latest-v24.x/api/test.html#test-runner-execution-model).

**Sửa nhỏ nhất:** chạy các file DB tuần tự bằng `--test-concurrency=1` khi dùng chung DB disposable. Hoặc cấp DB/schema độc lập thật sự nếu có lý do; chưa cần hạ tầng song song mới. Không dùng mutex JS xuyên qua hai phép ghi của chính test concurrency để che lỗi.

**Test hồi quy:** chạy nguyên `pnpm run test:db` nhiều lần với PostgreSQL disposable; kiểm thứ tự lifecycle/reset không chồng nhau. Hai connection bên trong test R03 vẫn phải tranh chấp thật. Đây là finding từ script/call graph và mô hình runner; chưa tái hiện race drop schema trên PostgreSQL vì runtime chưa sẵn.

### S02-03 — P2: Test concurrency có thể pass dù chưa tạo tranh chấp và không có timeout query

**Vị trí:** `tests/integration/loan-item-constraints.test.ts:125–201`; `db-harness.ts:105–110`.

Sau khi khởi động async client 2, test ngủ 150 ms rồi chỉ kiểm `client2Finished === false`. Nếu client 2 chưa đến INSERT do bị trì hoãn, điều kiện vẫn đúng; client 1 commit trước, client 2 chạy tuần tự rồi bị chặn vì đủ hai sách, toàn test vẫn pass. Vì vậy chưa chứng minh parent row lock. `connectionTimeoutMillis` chỉ giới hạn kết nối; không giới hạn thời gian câu INSERT chờ khóa. Test không đặt timeout test/query/lock, không rollback rõ ràng trong finally nếu assertion thất bại giữa luồng.

**Sửa:** lấy backend PID, dùng connection quan sát kiểm `pg_blocking_pids` hoặc trạng thái chờ lock tương đương trước khi commit client 1. Poll có deadline, không dựa vào sleep để kết luận đã tranh chấp. Đặt timeout test và PostgreSQL statement/lock timeout phù hợp; rollback/settle pending promises rồi đóng cả hai client trên mọi đường lỗi. Ghi isolation level thực; không kết luận ràng buộc an toàn cho mọi isolation level từ test mặc định.

**Test hồi quy:** chứng minh client 2 đã gửi INSERT và bị client 1 chặn; cuối cùng chỉ hai dòng. Thử lỗi có chủ đích giữa luồng để harness thoát hữu hạn, không còn transaction/lock treo. Không cần load test toàn website ở chặng này.

### S02-04 — P2: Thiếu regression cho UPDATE description dù bàn giao đã liệt kê

**Vị trí:** `tests/integration/schema.test.ts:48–145`; `docs/technical/progress.md`, mục 3.2.5.

Suite search kiểm INSERT có description, INSERT NULL và UPDATE title; không có câu UPDATE description. Nếu trigger sau này mất `description` trong `UPDATE OF`, toàn bộ test hiện tại vẫn pass dù tìm kiếm phần mô tả bị cũ. Progress lại nói đã xây bài thử UPDATE description.

**Sửa:** thêm một ca sửa riêng description, xác nhận từ mới tìm được và từ cũ không còn match; thêm chuyển description về NULL và kiểm title vẫn tìm được. Chạy trên PostgreSQL thật. Không đổi toàn bộ seed hoặc mô hình sách cho ca test này. Khi chưa chạy, ghi “test đã viết, DB BLOCKED”, không ghi đã kiểm chứng.

### S02-05 — P2: Carryover truy vết mới được sửa một phần

**Vị trí:** `docs/technical/README.md`, bảng truy vết FR-06/FR-07; `docs/technical/openapi.yaml:5`.

Các operationId không có đã được đổi đúng hoặc gắn nhãn dự kiến. Nhưng FR-06 vẫn trỏ T51/T52: T51 là xuất báo cáo, T52 là soạn nội dung Facebook cho lịch trực; không chứng minh quản lý sự kiện. FR-07 còn T63 là khách tự đăng ký, chưa phải ca báo cáo. Hàng FR-01 cũng cần bổ sung tham chiếu các quy tắc phạt/lịch đã có T23–T28. OpenAPI vẫn giữ câu “Bao phủ toàn diện 9 nhóm” dù README đã thừa nhận chưa có event operation.

**Sửa:** đối chiếu ngữ nghĩa từng hàng; giữ T17 cho liên kết sự kiện/sổ quỹ/báo cáo, chỉ ghi các test có liên quan trực tiếp. Nghiệp vụ chưa có acceptance case riêng thì đánh dấu còn thiếu, không đổi nghĩa T cũ. Đồng bộ mô tả coverage trong OpenAPI. Không thêm endpoint giả hoặc gọi 26 operation là backend đã implement.

**Kiểm lại:** mọi operation non-planned tồn tại, test ID tồn tại và đúng nội dung; kiểm tự động ID không thay đọc ngữ nghĩa. Sửa nhãn `G-baseline`: trong prompt 02 nó bao gồm `test:db` exit 0, nên có thể tách baseline check/build PASS và gate DB BLOCKED, tránh dùng PASS cho gate tổng còn thiếu test DB. Antigravity đã ghi tổng chặng BLOCKED; không phải phát hiện che giấu trạng thái đó.

## Kiểm lại lỗi còn mở từ chặng 01

| Finding | Kết quả follow-up |
|---|---|
| S01-01 tiến độ 22 chặng | Đã sửa: đủ 22 mã/tên/link; giữ sáu slice như góc nhìn riêng |
| S01-02 truy vết | PARTIAL: không còn operation non-planned sai tên; còn S02-05 về ngữ nghĩa test/coverage |
| S01-03 bằng chứng | Đã sửa phần phân loại: regex, SQLite, parser chuỗi, scheduler và PostgreSQL ghi rõ giới hạn; R11 vẫn được nhắc là còn mở |
| S01-04 giả định | Đã sửa nhãn mobile/capacity; có URL và ngày nguồn quota; RPO/RTO và trường công bố tuyển vẫn đề xuất. Review này không phải đo capacity hoặc nghiệm thu quota cloud |
| R12 baseline | Vẫn pass khi reviewer chạy lại |

## Kiểm tra thực trong lượt review

| Lệnh/kiểm tra | Kết quả | Ý nghĩa |
|---|---|---|
| `rtk pnpm run check` | Exit 0; 14 file, 0 lỗi, 0 warning, 16 hint; tsc pass | Có kiểm ba file TypeScript test mới; không chứng minh SQL/driver runtime |
| `rtk pnpm exec astro build --outDir .review-artifacts/stage02-build` | Exit 0, 3 trang static | Giữ nguyên dist; chưa có backend triển khai |
| `python -m unittest discover -s experiments -p 'test_*.py' -q` | Exit 0; 22 pass | Chỉ các PoC cũ |
| `pnpm --package=@redocly/cli@2.64.1 dlx redocly lint docs/technical/openapi.yaml` | Exit 0; 0 lỗi, 24 warning | Cấu trúc hợp lệ; chưa kiểm endpoint thực |
| PyYAML + đối chiếu bảng | 26 operations; 0 operation non-planned sai tên; 22 chặng; DDL khai báo 27 bảng | Không thay kiểm ngữ nghĩa hoặc apply SQL |
| `rtk pnpm run test:db` không có TEST_DATABASE_URL | Exit 1; sandbox Windows `spawn EPERM` ở process runner | Lỗi môi trường, không gán thành lỗi implementation |
| `node --experimental-strip-types --test --test-isolation=none tests/integration/schema.test.ts tests/integration/loan-item-constraints.test.ts` | Exit 1; 7 test không chạy qua hook vì `DB_RUNTIME_MISSING` | Tránh child process để kiểm fail-closed thiếu cấu hình; không chứng minh script gốc/DDL pass |
| Offline `stage02-guard-repro.mjs` | Tái hiện S02-01 với pg đã cài, không kết nối/reset | Có bằng chứng đích driver khác đích guard |
| Docker/PATH/service | Docker pipe chưa tồn tại; không có psql trên PATH hoặc service PostgreSQL phát hiện được | G-schema/search và G-invariant tiếp tục BLOCKED |

Không dùng kết quả lỗi guard như bằng chứng đã chạy DB. Không sửa SQL/test để “pass” trong review. Chưa có runtime nên không đóng R01/R03: mã sửa đã có nhưng migration/seed/search/concurrency chưa được xác minh. Khóa parent là cải tiến cần giữ; không khẳng định “triệt tiêu hoàn toàn deadlock” cho mọi transaction chỉ vì hai parent được sắp UUID.

## Bàn giao chặng 03

Sửa S02-01..S02-05 và hoàn thành PostgreSQL gates trước khi nghiệm thu Auth tích hợp DB. Khi DB/provider chưa sẵn, vẫn làm được skeleton runtime, validation/policy test không cần DB và tài liệu ADR; ghi gate tương ứng PARTIAL/BLOCKED. Không dùng actor giả hoặc SQLite để đóng provider/DB gates.

R02, R04, R05, R07, R09, R10, R11 và phần coverage/security của R06 còn mở theo index 22 chặng. Chặng 03 tập trung R05 và biên bảo mật R06; không triển khai toàn bộ CRUD/sổ tiền.

Supabase password dùng email/phone và tự liên kết các identity cùng email, nên username mapping phải qua spike thật, không coi thêm cờ INTERNAL là đã cách ly. [Password-based Auth](https://supabase.com/docs/guides/auth/passwords), [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking). Nguồn được đọc trong lượt review này; hành vi provider cụ thể vẫn cần kiểm bằng cấu hình/test thực.

**Prompt tiếp theo:** [03-runtime-auth.md](../prompts/antigravity-next/03-runtime-auth.md), đã bao gồm carryover và gate riêng cho runtime, DB, provider và phân quyền.

**Chưa kiểm:** PostgreSQL thật, Google/managed Auth, Workers runtime, mobile, ngân hàng, load/penetration và restore. Không có thay đổi UI logic để cần lặp browser review cũ; src giữ nguyên so với manifest chặng 01.
