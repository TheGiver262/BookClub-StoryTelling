# Chặng 04 — Sổ tiền tối thiểu và idempotency dùng chung

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-stage03-followup.md, review gốc docs/reviews/2026-10-18-antigravity-review.md, index 22 chặng docs/prompts/antigravity-next/README.md và đặc tả docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md, docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và implementation hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 02 cho PostgreSQL; 03 cho actor/policy HTTP. Hiện DB/provider vẫn BLOCKED, Auth còn bypass S03-01..S03-05. Sửa các lỗi này trước khi tin cậy actor hoặc mở API tiền. Có thể tiếp tục lõi finance với trusted actor chỉ ở test nếu Auth live còn thiếu; không nối HTTP vào mock/username/token role để báo hoàn thành.

**Findings liên quan:** R04; carryover S03-01..S03-08 và S02-03 còn PARTIAL. R01/R03 chỉ đóng sau bằng chứng PostgreSQL thật.

**Files/responsibility:** Tận dụng cấu trúc backend mới `src/server/`: sửa auth/provider.ts, auth/tokens.ts, auth/policy.ts, router.ts, db/client.ts theo carryover; đặt lõi finance tại `src/server/finance/ledger.ts`, `deposits.ts` và shared/idempotency.ts hoặc cấu trúc tương đương nhỏ nhất. Không tạo thêm một cây src/modules trùng trách nhiệm. SQL/migration/seed theo trạng thái baseline thực; tests unit/integration phù hợp; package/lock/config khi cần. Đồng bộ transactions-finance, domain-data, OpenAPI, ADR/Auth diagram liên quan và progress theo phạm vi đổi.

## 0. Sửa carryover và kiểm hồi quy trước

### 0.1 S03-01 — Không còn đường Auth giả ở server thường

- [ ] Bỏ mockUserStore/mockMembersDb/SAMPLE_ACTIVITIES khỏi entry chạy thường; chuyển fixture sang test, inject rõ vào test harness, không có bypass header/query hoặc env mở mock ở server thường. Các tên tài khoản trong seed chỉ là dữ liệu giả, không tạo credential usable.
- [ ] Bỏ DEFAULT_SECRET và việc tự ký token để thay managed provider. Thiếu provider/DB/session config phải fail closed, cả development server thường lẫn production; health có thể 200 nhưng login/protected routes không được cấp/quản trị bằng demo. Không hard-code khóa thay thế mới. Dùng provider verification/session có nguồn chuẩn; nếu JWT còn tồn tại, dùng cơ chế chuẩn và bắt buộc signature/algorithm/issuer/audience/expiry/type hợp lệ.
- [ ] Regression trước sửa: production mode thiếu config không đăng nhập demo, token ký bằng khóa cũ hoặc subject không có mapping không đọc members/admin được. Không lưu token/password thật vào report hoặc log. Artifact stage03-auth-repro.mjs là bằng chứng trước sửa, không sửa report cũ; bổ sung regression với kỳ vọng an toàn trong tests.

### 0.2 S03-02/S03-03 — Provider xác thực, DB cấp quyền

- [ ] Xóa hoàn toàn logic username.includes('admin')/tên demo tạo role. Provider subject và issuer/realm phải khớp internal_identities đã được admin cấp; quyền/trạng thái/memberId/version lấy từ DB. Không mapping hoặc không truy cập được nguồn quyền thì chặn; không bỏ qua kiểm khi memberId thiếu/không tồn tại. Email/Google profile/user_metadata/body/header không tạo quyền.
- [ ] Email/password khách phải được provider verify, Google/OAuth theo flow chính thức có kiểm token/state/PKCE phù hợp. Email đơn lẻ, token rác hoặc provider thiếu không được cấp phiên GUEST. Dùng subject ổn định, không Date.now. Không cho credential khách quản trị credential nội bộ, kể cả cùng email liên hệ.
- [ ] Provision/reset admin và direct provider signup/link/change email/add/reset password vẫn là spike chưa hoàn tất của 03: tiếp tục đúng đặc tả 08, không coi alias domain là security boundary. Không tự tạo cloud project hoặc phát sinh phí. Nếu chưa có provider/Google config, ghi gate riêng BLOCKED; không dùng fetch stub hoặc JWT tự ký làm bằng chứng provider thật.

### 0.3 S03-04/S03-05 — Trạng thái, session và revoke có nguồn chuẩn

- [ ] Chuyển status/version/revocation từ object nhớ sang DB/session store. Đổi trạng thái và audit cùng transaction; tránh role cache/token cũ mở lại quyền. Login mới của alumni đọc được hoạt động đúng allowlist; khóa là trạng thái riêng. Revoke phải hiệu lực với GET/mutation trên server instances, không chỉ object của một test.
- [ ] Logout phải vô hiệu phiên được cấp theo hợp đồng cookie/bearer/refresh, không chỉ xóa cookie rồi token cũ vẫn gọi /me được. Không cần tự phát minh giao thức session mới; dùng cơ chế provider/server session phù hợp đã có thể chứng minh.
- [ ] Payload alumni+admin phải bị chặn hoặc normalize với hợp đồng rõ; bất biến domain/DB không cho alumni giữ admin, requireAdmin cũng chặn alumni/disabled. Test payload `{isAlumni:true,isAdmin:true}` và token có cờ mâu thuẫn. Không lấy role ưu tiên ADMIN để bỏ qua cựu.
- [ ] Hồi quy: phiên cũ bị chặn, phiên alumni mới hợp lệ để xem hoạt động; bị khóa không login/refresh; logout/revoke không replay; subject bị xóa mapping không được giữ quyền. Test fake actor chỉ ở unit/domain, không server bypass.

### 0.4 S03-06/S03-07 — HTTP boundary và DB concurrency test

- [ ] Validate body/types/bounds trước provider/DB: password số hoặc email sai kiểu trả 400, không TypeError 500; có body limit. Cookie production Secure/HttpOnly/SameSite, ngoại lệ HTTP chỉ local dev rõ; CSRF/Origin cho cookie mutations, cache no-store cho auth/PII, rate limit phù hợp runtime. Ignore .dev.vars nếu dùng, không log credentials. Không gọi secret regex scan hoặc counter in-memory là nghiệm thu bảo mật/cloud DDoS.
- [ ] Sửa test R03: BEGIN/INSERT client1 hoàn tất và giữ khóa trước khi khởi động promise client2; sau đó quan sát pg_blocking_pids thật, có deadline. Toàn bộ setup/cleanup trong try/finally, test/query/observer timeouts và rollback/settle connections đầy đủ. Giữ runner file `--test-concurrency=1` và test hai DB connections thực, không JS mutex tuần tự hóa.
- [ ] Chạy PostgreSQL local disposable nếu đã có runtime hợp lệ; guard hiện đã chặn URI query override, giữ các bảo vệ đó. Không dùng DB thật/cloud hoặc reset DB chỉ vì trùng prefix mà chưa xác nhận tài nguyên do task sở hữu. Docker/psql chưa sẵn thì DB gates BLOCKED; không thay SQLite.

### 0.5 S03-08 — Đồng bộ contract và mức bằng chứng

- [ ] Thống nhất base path/routes OpenAPI và handler (hiện `/v1/auth/internal/login` khác `/api/v1/auth/login-internal`), login guest body/session/errors, me/logout/status. Test contract trên handler và HTTP runtime khi sẵn. Planned endpoint không được ghi implemented.
- [ ] ADR Auth chuyển Proposed/Experimental đến khi spike đạt; bỏ “miễn nhiễm/100%” từ alias chưa kiểm. Diagram07 phải dùng mapping/flows thực và đánh dấu provision chưa có nếu còn thiếu. Không phát lại toàn bộ diagram không liên quan.
- [ ] Progress/README tách unit/router, Workers HTTP, DB và provider. 24 unit tests pass không đóng G-runtime/provider/DB. Reviewer gặp spawn EPERM ở launcher, không phải lỗi Auth đã sửa hoặc bằng chứng runtime chạy. `pnpm.onlyBuiltDependencies` hiện bị pnpm bỏ qua: nếu cần build scripts, dùng config project đúng version, không sửa global. Giữ 22 chặng và report review cũ.
- [ ] Đồng bộ ID quỹ: seed đang dùng FUND_LOAN/FUND_OPERATION; progress lại giao FUND_LOAN_DEPOSIT. Giữ tên chuẩn hiện có trừ khi migration có lý do, không tạo quỹ thứ ba vì lệch tên. Chính sách quỹ nhận phạt/mất chưa được CLB chốt phải mang nhãn chưa chốt.

## Thực hiện

- [ ] Trước code, đọc R04 và SQL finance hiện tại; viết ngắn các invariant và sơ đồ dữ liệu phần đổi. Mô hình tối thiểu: fund, account/nơi giữ tiền (cash/bank), khoản nhận cọc đã xác nhận, allocation tới phiếu/dòng sách, nghĩa vụ còn giữ/chờ hoàn/đã hoàn/đã giữ hoặc chuyển liên kết, journal/source/audit. Tên/ID source phải tương thích thực tế: cash_session VARCHAR không được ép UUID. Hai quỹ độc lập; cọc bạn đọc là nghĩa vụ, cọc trả nhà sách là tài sản phải thu, không chung một balance.

- [ ] Giữ thiết kế sổ nhỏ đủ dùng: cặp debit/credit hiện có có thể giữ nếu đủ invariant, không xây ERP/chart of accounts tổng quát. Account thuộc loại/fund hợp lệ, journal amount dương và cân, tham chiếu source rõ. Tiền mặt/ngân hàng khác nhau; transfer chỉ đổi nơi giữ, không thành thu nhập. Chưa kiểm ngân hàng thì chưa ghi confirmed cashflow; QR/loa/ảnh không tự xác nhận. Status draft/pending tách posted.

- [ ] Hợp nhất hai bảng idempotency đang khác scope thành một contract: actor server-trusted + operation ổn định + key + canonical payload hash, trạng thái/kết quả và quy tắc retry. Chọn một header HTTP chuẩn theo OpenAPI hiện có X-Idempotency-Key nếu có HTTP; core không phụ thuộc route string tùy ý. Cùng key khác payload bị từ chối bằng lỗi có contract rõ; retry sau commit/mất response trả lại cùng chứng từ, không ghi lần hai.

- [ ] Claim key/result và transaction nghiệp vụ commit/rollback nhất quán; unique/locks ở PostgreSQL, không Map trong process. Hai request cùng key không được cùng thực thi. Key ở transaction rollback không để trạng thái PROCESSING vĩnh viễn; nếu dùng trạng thái pending dài hạn phải có recovery được kiểm, không tự timeout rồi làm lại nghiệp vụ đã commit. Replay kiểm quyền hiện tại trước khi trả response; alumni/khóa không nhận lại PII/tiền từ cache idempotency. Không lưu secret trong payload/response/log.

- [ ] Khóa nghĩa vụ khi hoàn/giữ/chuyển; không hoàn vượt số còn được hoàn và không giữ/chuyển cùng một phần cọc hai lần. Có business uniqueness cho source/action/allocation, chống nhân đôi dù key khác. Allocation và journal cùng transaction. Posted journal không UPDATE/DELETE được bằng application role; quyền ghi qua đường kiểm soát, không dùng owner/superuser để kết luận runtime quyền đúng. Đảo/điều chỉnh có linked source, lý do/người thực hiện; retry hoặc hai reversal đồng thời không đảo quá phần cho phép.

- [ ] Cọc pending refund vẫn còn nghĩa vụ cho đến khi tiền đã trả thực được xác nhận. Thu bằng bank có thể hoàn cash hoặc ngược lại; không sửa phương thức nhận cũ. Chuyển liên kết cọc giữa phiếu chỉ chuyển ownership/allocation, không phát sinh cash/bank giả. Chưa triển khai use case trả/gia hạn/chuyển phiếu toàn bộ; expose primitive nhỏ để các chặng 07–11 dùng sau.

- [ ] VND nguyên ở DB và TypeScript có bounds/serialization rõ. Dùng bigint hoặc số nguyên an toàn với giới hạn kiểm được, không Number(bigint) tùy ý; JSON không mất chính xác. Chặn âm/phân số/NaN/quá giới hạn. Tổng tiền tính từ source/allocation được server đọc, không tin client đưa balance. Không hard-code quỹ nhận phạt/mất như policy đã chốt; thiếu policy cần thiết thì không post khoản đó, vẫn hoàn thiện phần độc lập.

- [ ] Interface ledger/deposit/idempotency nhận cùng PostgreSQL transaction/client của caller, không tự mở transaction rời hoặc commit khi caller chưa xong. Lỗi sau bước journal/allocation/audit bất kỳ rollback toàn bộ. Không microservice/queue cho giao dịch nội bộ; không xây payment gateway hoặc đồng bộ ngân hàng.

- [ ] Migration theo trạng thái thực: baseline draft chưa apply thì chỉnh có kiểm soát; nếu đã apply ở môi trường được phép thì migration forward, không reset để né migration. Seed chỉ dữ liệu giả và runtime role tối thiểu; test harness reset riêng. Lệnh test mới phải thực sự include ledger/deposits/idempotency integration files, không viết test rồi bỏ khỏi script.

## Gate phải chứng minh

Ghi PASS/PARTIAL/BLOCKED từng gate, không lấy check/build hoặc fail-closed thiếu env thay DB/Auth:

1. **G-auth-safety:** S03-01..S03-06 regression pass; server thường không nhận actor giả khi config thiếu. G-provider và G-runtime/DB riêng chỉ PASS khi chạy thật. Nếu chưa đủ, không mở HTTP finance; domain integration có thể dùng actor test ở test process, không server bypass.
2. **G-db-baseline:** apply nguyên DDL/migration/seed vào PostgreSQL disposable, search và invariant chặng02 pass; test R03 đã sửa thứ tự, có quan sát blocking thực và cleanup. Ghi version/isolation level, commands/exit.
3. **G-ledger/deposit:** dùng application role ít quyền và assert DB state:
   - Nhận cọc 150k tạo đúng cash/bank và nghĩa vụ 150k, không thành thu nhập; hai fund tách số dư.
   - Hoàn 50k trong 150k thì tiền giảm và nghĩa vụ còn 100k; hoàn pending chưa giảm tiền hoặc xóa nghĩa vụ sai; xác nhận trả chỉ có một hiệu lực.
   - Hai connection cùng hoàn hết một allocation: tối đa một hiệu lực, không âm/nghĩa vụ mất cân. Dùng hai key khác nhau để kiểm business invariant, không chỉ idempotency lock.
   - Nhận bank/hoàn cash và nhận cash/hoàn bank đổi đúng account, không thay chứng từ nhận cũ.
   - Chuyển allocation 100k không đổi tiền thực hoặc tổng nghĩa vụ; phần cọc đã tiêu hết không chuyển lại được. Chỉ kiểm primitive, không triển khai toàn chặng09.
   - Application role không sửa/xóa posted journal; reversal hợp lệ có source/lý do, retry/concurrent reversal không nhân đôi hoặc đảo vượt mức.
   - Cọc nhà sách và cọc bạn đọc không bù trừ; khoản nhận hoàn cọc nhà sách và thanh toán nợ vẫn là hai chứng từ riêng. Chưa triển khai toàn bộ sales18.
   - Các tổng allocation/nghĩa vụ khớp journal; lỗi chủ đích giữa luồng rollback journal/allocation/audit/result cùng nhau. Tiền âm/phân số/quá bounds bị chặn và serialization không mất chính xác.
4. **G-idempotency:** cùng actor/operation/key/payload trả cùng ID/result, cùng key khác payload bị chặn; hai connection cùng key chỉ một commit; mất response sau commit retry không nhân đôi; transaction lỗi retry được theo contract; khác actor/operation không va scope; hai key khác nhau vẫn không hoàn cùng source hai lần. Request đã revoke không replay response nhạy cảm. PostgreSQL thật, không SQLite/mutex JS.
5. **G-contract/baseline:** check/build, unit, 22 Python tests và OpenAPI lint đúng version; runner đã include các file integration mới. OpenAPI/diagram/README/progress đúng source/contract/runtime, ID quỹ và source thống nhất. Không tự đổi gates tích hợp thành PASS nếu test không chạy. Giữ 22 chặng.

Thiếu DB/provider thì hoàn thiện code/test/contract phần độc lập, ghi đúng blocker và một lệnh chạy tiếp. Không gọi finance đáng tin cậy hoặc chặng04 hoàn tất khi chưa chạy G-ledger/deposit/G-idempotency trên PostgreSQL thật.

## Đầu ra

Lõi finance nhỏ dùng chung cho circulation/sales/events sau này; migration, application grants và tests có thể tái chạy. Bàn giao contract các hàm, transaction ownership, account/fund/source IDs, idempotency semantics, tiền và lỗi; kèm bằng chứng/quyền/DB/HTTP riêng. Chưa làm màn hình quỹ, cash-session API đầy đủ (05), cho mượn/trả/gia hạn (07–11), sales18, hoặc thương mại điện tử. Nếu carryover chiếm cả phiên, dừng PARTIAL tại mốc tự nhiên, ghi phần finance04 còn lại; không tự nhảy 05.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

