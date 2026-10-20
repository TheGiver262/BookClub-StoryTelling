# Review chặng 04 — 18/10/2026

## Kết luận và phạm vi

Chặng 04 có implementation thực: ledger, deposit allocations, idempotency, SQL và tests mới; các bypass demo/default secret và quyền theo username đã được sửa trong source. **Trạng thái vẫn PARTIAL, chưa nghiệm thu lõi tiền hoặc Auth tích hợp.** Có phản ví dụ về hoàn trùng, đảo journal lệch nghĩa vụ, logout theo instance và nội dung alumni chưa duyệt; PostgreSQL/provider chưa chạy.

Review theo prompt 04 và tám finding chặng03. Workspace không có `.git`; đối chiếu `.review-artifacts/stage03-review-manifest.json` và ghi snapshot đầu lượt tại `.review-artifacts/stage04-review-manifest.json` (64 file). Không sửa implementation. Phạm vi tải: dưới 5.000 sách, dưới 100 lượt/buổi, 3–5 người cùng nhập. Không coi lỗi local là bằng chứng production đã bị khai thác.

## Findings cần sửa

### S04-01 — P1: Chưa có định danh nghiệp vụ chống nhận/hoàn cọc trùng

**Vị trí:** `src/server/finance/deposits.ts:92–135`, `:141–188`, `:199–268`; `schema/01_schema.sql:285–301`.

`receiveDeposit` tạo allocation mới mỗi lần, chỉ entry_code của journal là unique; cùng receipt/item với entry_code khác vẫn nhận thêm cọc. `requestDepositRefund` kiểm refundAmount nhưng không lưu số tiền/ID yêu cầu hoàn. `confirmDepositRefund` lại nhận amount/method tự do, cho phép cả trạng thái HELD. Sau một lần hoàn một phần trạng thái quay về HELD, gửi lại cùng ý định với entry_code mới tiếp tục trừ cọc.

**Phản ví dụ offline, dùng SQL double sẵn có của test:** cọc150k, yêu cầu hoàn50k, xác nhận50k hai lần bằng hai entry_code khác nhau: cả hai được nhận, nghĩa vụ chỉ còn50k. Yêu cầu50k nhưng xác nhận100k cũng được nhận. Nhận cùng receipt/item150k hai lần tạo hai allocation và cash journal300k. DDL không có business uniqueness cho các ý định này, nên không có constraint tương ứng để bù cho logic thiếu. Chưa chạy các ca này trên PostgreSQL.

**Sửa:** định danh chứng từ nhận/ý định hoàn bằng ID nghiệp vụ ổn định; lưu số tiền, phương thức, trạng thái và nguồn. Confirm nhận ID ý định, xác nhận đúng nội dung đã chốt và chỉ một lần; nếu cần đổi thì có bước chỉnh/hủy có audit. Unique/locks chống trùng cùng source/action dù idempotency key khác. Không đặt unique(receipt_id) đơn giản vì còn nhiều dòng sách và chuyển cọc hợp lệ.

**Hồi quy:** cùng ý định hoàn50k retry bằng hai key vẫn chỉ chi50k; hai lần hoàn khác nhau có ID riêng vẫn hợp lệ khi còn nghĩa vụ; confirm sai amount/method bị chặn; cùng source nhận cọc không được ghi đôi. Kiểm cùng transaction và hai connection trên DB thật. Nếu bỏ qua, retry hoặc hai người nhập có thể ghi thu/hoàn lần hai mà không vượt trần allocation nên test “không âm” vẫn pass.

### S04-02 — P1: Đảo journal nghiệp vụ làm lệch allocation; lý do không được lưu

**Vị trí:** `src/server/finance/ledger.ts:145–201`; `deposits.ts` và SQL journal/allocation.

`recordReversal` đảo journal nhưng không biết hay cập nhật nghĩa vụ nguồn. Sau receiveDeposit150k rồi đảo journal nhận cọc, allocation vẫn HELD150k trong khi ledger liability về0; `getFundBalances().isBalanced` vẫn true vì mỗi dòng luôn cộng cùng amount vào tổng Nợ và Có. Reversal nhận reason nhưng chỉ kiểm không rỗng rồi bỏ, không ghi journal/audit. Đảo journal hoàn cọc cũng có nguy cơ cùng loại: tiền/nghĩa vụ và trạng thái nguồn không được phục hồi tương ứng.

**Sửa nhỏ nhất:** chặn đảo trực tiếp các journal có source nghiệp vụ cần phối hợp, hoặc cung cấp use case đảo source cập nhật allocation/intent/journal/audit trong cùng transaction. Reversal helper không được được hiểu là quyết toán toàn bộ chứng từ. Lưu lý do/người thực hiện/liên kết gốc; unique cho reversal phù hợp và không đảo vượt mức. Thêm đối soát allocation với account liability; Nợ=Có không thay bất biến đó.

**Hồi quy:** đảo nhận/hoàn làm cả nguồn và journal khớp hoặc bị từ chối trước ghi; retry/concurrent reversal chỉ một hiệu lực, reason đọc lại được. Lỗi giữa luồng rollback tất cả. Không xây ERP tổng quát hoặc cho sửa journal cũ.

### S04-03 — P2: Test idempotency đồng thời sẽ chờ nhau, không chứng minh được gate DB

**Vị trí:** `tests/integration/finance-ledger.test.ts:346–375`; `src/server/shared/idempotency.ts:112–138`.

Client1 INSERT key trong transaction chưa commit. Test sau đó await client2 claim cùng key và kỳ vọng IdempotencyConcurrentError; chỉ sau bước đó mới complete/commit client1. PostgreSQL unique check phải đợi transaction có row trùng kết thúc, nên client2 chờ client1 còn test giữ client1 để chờ client2. Không có statement/test timeout trong ca này, có thể treo. Đây là suy luận từ lịch câu lệnh và semantics PostgreSQL, chưa tái hiện trên DB local. [PostgreSQL16 — uniqueness checks](https://www.postgresql.org/docs/16/index-unique-checks.html).

Với thiết kế single transaction hiện có, nếu client1 complete+commit, client2 có thể đợi rồi trả cached result; không tự có PROCESSING409 từ row chưa commit. Mock Map nhìn thấy PROCESSING ngay không phản ánh MVCC. Test hoàn cọc đồng thời khác còn dùng sleep50ms, chưa có quan sát khóa và timeouts như test loan đã sửa.

**Sửa:** chốt contract đợi/replay sau commit hoặc NOWAIT/try-lock trả conflict, dùng cơ chế DB phù hợp thay vì ép test theo mock. Launch client2 ở background, xác nhận blocking, complete/commit client1 rồi await client2; tất cả có deadline/rollback/cleanup. Không commit PROCESSING riêng chỉ để thấy row mà không có recovery được kiểm. Test receive/refund+idempotency cùng transaction, mất response, rollback/retry và quyền replay; hiện tests DB chưa ghép các phần này.

**Hồi quy:** hai connection có cùng key thực sự overlap và chỉ một side effect; kết quả/timeout đúng contract; lỗi giữa journal/allocation/result/audit rollback sạch. Chạy bằng application role có quyền thực, không chỉ owner. Không đổi lỗi PostgreSQL timeout thành IdempotencyConcurrentError giả để pass.

### S04-04 — P1: Logout chỉ thu hồi token trong bộ nhớ một instance

**Vị trí:** `src/server/router.ts:14–33`, `:194–205`.

Default demo bị bỏ, nhưng revocation mới là `Set<string>` module-level. Repro với hai instance module độc lập, cùng secret/token GUEST: logout ở A, /me ở A401, /me ở B200. Không cần DB hoặc provider để tái hiện phạm vi bộ nhớ. Khi Worker restart hoặc request đến isolate khác, token đã logout vẫn dùng được. Endpoint cũng thêm chuỗi token chưa verify vào Set không giới hạn/TTL.

**Sửa:** dùng provider/session revocation bền vững/chia sẻ, hoặc session/token_version contract được DB kiểm phù hợp cho cả internal và guest; bỏ blacklist RAM làm nguồn chuẩn. Verify và giới hạn input, không lưu raw token vào tập vô hạn. Không đổi sang một Map khác hoặc counter memory.

**Hồi quy:** logout rồi replay ở hai instance/restart đều bị từ chối, kể cả refresh theo contract; expiry và cleanup hữu hạn. S03-04 chưa đóng dù test logout cùng instance pass.

### S04-05 — P1: Alumni nhận nội dung hoạt động chưa được duyệt

**Vị trí:** `src/server/router.ts:328–341`; `auth/policy.ts:toAlumniActivityDto`; `schema/01_schema.sql:401–410`.

Query lấy mọi activities không có điều kiện duyệt dành cho alumni. DTO bỏ budget/phone columns nhưng sao chép nguyên title/description/location. Một hoạt động PLANNED có thông tin điện thoại/ngân hàng trong description vẫn trả cho alumni. Repro bằng fixture chứa marker dữ liệu riêng tư trả200 và marker còn nguyên; DB query cũng không lọc trạng thái/approved projection. Đây là kiểm logic lọc và query, không đọc PII thật.

**Sửa:** tập nội dung alumni được duyệt/allowlist riêng; mặc định chưa phân loại không xuất hiện. Duyệt nội dung tự do/file, không chỉ bỏ tên cột hoặc regex xóa số điện thoại. Ghi phiên bản/projection an toàn nhỏ nhất; không mở rộng sang xây toàn module sự kiện. Lỗi DB không được nuốt thành danh sách rỗng200 khiến reviewer tưởng đã đọc đúng.

**Hồi quy:** draft/unclassified/private description không xuất hiện; nội dung approved an toàn được trả; raw entity/file/metadata không rò. Cựu vẫn đọc hoạt động được phép, không bị khóa toàn tài khoản.

### S04-06 — P2: Giữ cọc tự chọn quỹ phạt chưa chốt và làm mất lý do

**Vị trí:** `src/server/finance/deposits.ts:365–422`; `finance/types.ts:ALLOWED_FUND_ACCOUNTS`.

`forfeitDeposit` luôn post FUND_LOAN/THU_PHAT khi không có policy input/cấu hình, trong khi quỹ thụ hưởng phạt/mất vẫn là quyết định chưa chốt. Reason được nhận nhưng không lưu ở allocation/journal/audit. Repro gọi không có policy vẫn post thành công, marker reason không xuất hiện trong stored journal. Hàm cũng không kiểm state HELD/PENDING trước giữ cọc, nên chưa có hợp đồng rõ khi đã có ý định hoàn chờ xử lý.

**Sửa:** chưa có policy được xác nhận thì chặn post phần cần policy; giữ phép tính/domain độc lập. Nếu policy được cấu hình phải lưu nguồn/version và lý do/người thực hiện. Định nghĩa các trạng thái được phép, không âm thầm tiêu phần đang dành cho ý định hoàn. Không tự hỏi/chốt policy thay người dùng chỉ để gate xanh.

**Hồi quy:** policy thiếu không ghi tiền; policy test được chỉ định rõ mới post; reason/audit đọc lại được; forfeit cạnh tranh với refund/transfer không tiêu cùng phần cọc hai lần. Giữ nguyên quy tắc tiền cọc đã chốt.

### S04-07 — P2: Invariant alumni/admin mới được chặn ở fixture/payload, chưa ở đường DB đầy đủ

**Vị trí:** `src/server/router.ts:254–307`; `schema/01_schema.sql:members`.

Payload có cả isAlumni=true và isAdmin=true đã bị chặn; requireAdmin cũng chặn alumni. Tuy nhiên với một row hiện đã alumni, PATCH chỉ `{isAdmin:true}` đi đường SQL có $2=NULL: CASE WHEN $2=TRUE không chạy, ELSE gán is_admin=true. Không có CHECK bảo vệ trong members. Fixture branch có kiểm tình trạng member trước nên test hiện tại không bắt đường production này. DTO ép isAdmin=false che row sai; policy hiện chặn đặc quyền alumni nên chưa kết luận người đó đã được admin access như lỗi cũ.

**Sửa:** validate theo trạng thái cuối cùng trong transaction/update và đặt constraint phù hợp; không chỉ kiểm hai cờ đồng thời trong request. Cập nhật status/version/audit nguyên tử, validate fields/bounds. Không dùng kết quả DTO đã sửa cờ làm chứng cứ DB hợp lệ.

**Hồi quy DB:** alumni hiện có nhận patch admin-only bị từ chối; chuyển cựu thu admin; kích hoạt lại/admin đúng quy trình vẫn được. Kiểm concurrency và audit sau status change. S03-05 còn PARTIAL ở storage invariant.

### S04-08 — P2: Cấp bằng chứng đang cao hơn phần đã kiểm; chưa đủ điều kiện mở ca tiền

**Vị trí:** `docs/technical/progress.md`, bảng03/04 và mục12/14; README gates; tests/integration/finance-ledger.test.ts.

Progress ghi S03-01..S03-08 fixed và G-auth-safety PASS dù logout RAM, privacy và các carryover nêu trên còn mở. “33/33 tests finance” thực tế là tổng33 test của cả suite; finance có4 top-level test dùng SQL double. DB chưa kiểm reversal/transfer/forfeit, failure rollback+idempotency, application role/grants, replay sau revoke hoặc đối soát allocation tổng thể. Các import không được gọi không là test đã viết/chạy. Tuyên bố một lệnh xác minh “100% ACID” không có căn cứ, đặc biệt với S04-03.

**Sửa:** dùng bảng cấp source/unit/DB/HTTP/provider/runtime riêng, liệt kê ca chưa có và gate BLOCKED. Đường Auth tốt hơn trước nhưng chưa là Auth đã nghiệm thu. Hoàn thiện test đúng rủi ro trong prompt05 carryover, không tăng test count để thay bằng chứng; chạy permission assertions bằng application role riêng. Chưa có HTTP finance là giới hạn cần giữ cho tới khi Auth/DB đủ gate.

## Kiểm lại tám finding chặng03

| Finding | Kết quả follow-up |
|---|---|
| S03-01 demo/default key | Đã sửa hai bypass đã báo: không còn fallback store ở entry thường, secret bắt buộc. Session vẫn tự ký/verifier tự viết và provider spike chưa chạy; không gọi cả Auth đã hoàn tất |
| S03-02 quyền từ username | Đã bỏ includes(admin), có JOIN mapping/member ở login và trạng thái DB khi request; integration/provider còn BLOCKED |
| S03-03 guest chưa verify | Đã gọi provider, thiếu config fail closed. Cần bỏ fallback guest_Date.now khi provider response thiếu subject, kiểm rõ OAuth token flow; chưa có provider evidence |
| S03-04 revoke/logout | PARTIAL: trạng thái internal chuyển sang DB nhưng logout còn S04-04; transaction/audit và hai-instance gate chưa đạt |
| S03-05 alumni/admin | PARTIAL: chặn payload/caller policy, còn S04-07 ở DB state |
| S03-06 cookie/validation | Đã sửa password-number400, cookie productionSecure, một số no-store. Body limit/Origin/CSRF/rate-limit và file secret ignore vẫn chưa đủ; không báo đóng toàn bộ |
| S03-07 loan concurrency | Đã sửa thứ tự client1 giữ lock trước client2 và giữ pg_blocking_pids; DB runtime chưa chạy. Không áp kết luận đó cho finance test mới dùng sleep hoặc test idempotency sai lịch |
| S03-08 contract/evidence | Route/ADR/diagram07 đã cập nhật; phần gate/evidence còn S04-08, các mục03 cũ chưa đồng bộ |

## Kiểm tra chạy lại

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0; 32 file, 0 lỗi, 0 warning, 23 hint; tsc pass | Không kiểm invariant SQL/money |
| Astro build vào `.review-artifacts/stage04-build` | Exit0; 3 trang static | Không là Workers build/HTTP/Auth evidence |
| Node unit suite với `--test-isolation=none` | Exit0; 33/33 pass | Direct handler và SQL double, không PostgreSQL. Dùng cùng workaround sandbox Windows đã ghi ở review trước |
| Python unittest discover | Exit0; 22/22 pass | PoC/regex cũ đã cập nhật expected table names |
| Redocly2.64.1 lint | Exit0; 0 lỗi, 24 warning | Contract structure, không endpoint implementation |
| Node DB suite, ba file, `--test-isolation=none --test-concurrency=1` | Exit1; 15 test bị before-hook DB_RUNTIME_MISSING | Không có assertion PostgreSQL nào được nghiệm thu |
| Docker/PATH | Docker daemon pipe không chạy; không có psql/postgres trên PATH | DB/provider gates vẫn BLOCKED |
| `node --experimental-strip-types .review-artifacts/stage04-counterexamples.mjs` | Exit0; tái hiện các ca S04-01/02/04/05/06 | Tái dùng SQL double từ test hiện có + direct handler. Không gọi network/ghi DB thật |

Output phản ví dụ ở `.review-artifacts/stage04-counterexamples.json`. Source artefact ghi rõ cấp bằng chứng; không dùng mô phỏng làm pass PostgreSQL. S04-03/S04-07 là kết luận từ lịch SQL/constraint, chưa chạy DB. UI source không đổi; không lặp browser review cũ. Chưa chạy lại Workers smoke do launcher bị chặn ở các lượt trước và chưa có runtime evidence mới; không suy deploy từ build. Không có Go module thuộc phạm vi.

## Bàn giao

Giữ chặng04 PARTIAL; sửa S04-01..S04-08 trước phần liên quan trong chặng05. Có thể chuẩn bị cash-session domain/test nếu provider chưa sẵn; chỉ mở HTTP tiền khi Auth thực đã kiểm, PostgreSQL transactional gates đạt. Chưa đóng R04/R05 hoặc R01/R03 bằng unit pass. R02/R07/R09/R10/R11 và các module khác vẫn theo index22chặng.

**Prompt tiếp theo:** [05-cash-sessions.md](../prompts/antigravity-next/05-cash-sessions.md), gồm carryover và gate riêng cho một hộp tiền, đối soát, đóng ca cạnh tranh và HTTP authorization.

**Chưa kiểm:** PostgreSQL/provider/Google/Workers thực, mobile, ngân hàng, load/penetration và restore. Đây là review code/local evidence, chưa phải nghiệm thu dùng tiền hoặc dữ liệu thật.
