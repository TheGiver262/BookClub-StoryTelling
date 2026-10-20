# Review chặng 07 — 19/10/2026

## Kết luận và phạm vi

Chặng07 có lát cho mượn thực: rule, service, route, journal/allocation/audit/idempotency; router issue và tạo title/edition đã dùng transaction wrapper. Một số carryover06 được sửa đúng. **Verdict: PARTIAL; chưa nghiệm thu tiền hoặc đóng S06-01..09.** Còn lỗi ở caller transaction cũ, phân biệt PG Client, lựa chọn bản sách, xác nhận số tiền, đối soát BANK và chứng từ lịch sử; DB tests còn lỗi trước cả khi kiểm concurrency.

Đối chiếu prompt07, review06 và snapshot `.review-artifacts/stage06-review-manifest.json`. Snapshot đầu review07: `.review-artifacts/stage07-review-manifest.json` (86 file). Workspace không có Git metadata; không gắn kết luận với commit. Tải tham chiếu dưới5.000 sách, dưới100 lượt/buổi,3–5 người nhập. Lượt này không sửa implementation, không commit/deploy/DB thật/PII thật. Không có Go thuộc phạm vi. UI không đổi nên không lặp browser review cũ.

## Findings phải sửa trước khi nghiệm thu

### S07-01 — P1: Transaction mới chỉ bao một số route; mở/đóng ca và audit metadata vẫn commit rời

**Vị trí:** `src/server/router.ts:559–675`, routes copy/borrower; `catalog/service.ts:350–576`; `borrowers/service.ts` mutations.

withTransaction chỉ được gọi tại create title, create edition và issue. Open/close vẫn truyền Pool, claim/mutation/result commit riêng như06; copy/borrower update/archive vẫn lock ngắn theo câu và mutation trước audit. Vì vậy không thể đóng S06-01/S06-03 toàn bộ chỉ vì issue đã có wrapper.

**Phản ví dụ direct handler/SQL double:** ép INSERT audit lỗi khi archive copy; HTTP500 nhưng copy đã ARCHIVED. Không có transaction ở caller để rollback. Rủi ro close-vs-writer và cached-result lỗi của report06 vẫn còn với session routes; issue giữ session lock không đủ nếu close không giữ khóa tới chốt.

**Sửa:** thống nhất transaction owner ở use case/caller, một PG client và một commit cho mutation+audit+idempotency. Session lock phải giữ ở cả close và writer. Không chỉ bọc thêm BEGIN trên Pool. Kiểm tất cả caller mới/cũ dùng shared helpers, không bọc chồng làm inner commit outer transaction.

**Hồi quy:** fault ở journal/allocation/audit/cached response; không mutation một mình sau500; hai connection close tranh issue/refund/reversal; audit failure rollback metadata. Đường ảnh hưởng: session, catalog, borrower, quyền/revoke nếu sửa trong scope, return08. Bỏ qua tiếp tục mất đối soát khi DB lỗi hoặc nhiều người thao tác.

### S07-02 — P2: withTransaction coi PG Client đã kết nối là Pool

**Vị trí:** `src/server/db/client.ts:53–93`; callers `tests/integration/issue-loan.test.ts`.

Phân nhánh bằng typeof db.connect==='function'. PG Client và PoolClient cũng có connect, nên helper gọi connect lần nữa trên client đã checkout. Driver đang cài chặn bằng “Client has already been connected. You cannot reuse a client.”; callback không chạy. Các test mới dùng withTransaction(client,...) đi đúng nhánh lỗi này. Nhánh query-only cũng BEGIN/COMMIT vô điều kiện, không thực sự tái sử dụng transaction đang có như comment.

**Tái hiện:** dùng class pg.Client đang cài, đặt trạng thái connected giả lập rồi gọi helper; driver từ chối trước socket, callbackRan=false. Đây là kiểm branch/driver local, không execution PG server.

**Sửa:** API transaction rõ ownership: helper sở hữu Pool/checkout hoặc caller cung cấp transaction client đã có; không suy bằng một method chung. Không reconnect/release client người gọi sở hữu, không inner COMMIT làm xong outer transaction. Chỉ thêm savepoint khi có yêu cầu nested thực, không viết transaction framework.

**Hồi quy:** Pool checkout/release đúng một lần; raw connected Client/PoolClient theo contract rõ; callback failure rollback; BEGIN/COMMIT failure; nested-call policy. Chạy PG thật để chốt semantics.

### S07-03 — P2: Input mixed IDs/barcodes bị bỏ bớt, phần tử sai bị loại âm thầm

**Vị trí:** `circulation/rules.ts:104–141`; `circulation/service.ts:91–134`.

Validator cộng số phần tử của cả hai selector, nhưng service ưu tiên copyIds, bỏ toàn bộ barcodes. Các phần tử không phải string/rỗng được map thành'' rồi filter, nên array3 phần tử có2 phần tử sai trở thành loan1 cuốn thành công. Đây là partial success âm thầm khi người trực cần giao đúng danh sách.

**Double:** barcode COPY-A + ID copy-b được chấp nhận nhưng chỉ phát COPY-B; ['COPY-A',null,''] thành phiếu1 dòng. Cả hai nằm ngoài các test 0/3/trùng hiện có.

**Sửa:** chọn đúng một selector và reject đồng thời nhiều selector/alias khác nhau; hoặc resolve tất cả thành cùng danh sách ID rồi validate toàn bộ. Reject từng phần tử sai trước DB; chống trùng sau resolve/normalize. Barcode branch cần kiểm lại số row sau lock trước khi ghi. **Test:** mixed/alias conflict, null/number/empty, barcode+ID cùng copy, duplicate normalized, cả request rollback khi bất kỳ phần tử sai. Không tự giao thiếu sách.

### S07-04 — P1: Xác nhận tiền chỉ là boolean, không ràng buộc số tiền vừa kiểm với giá đang ghi sổ

**Vị trí:** `circulation/rules.ts:97–102`; `circulation/service.ts:150–230`; IssueLoanParams/OpenAPI.

Server tính cọc sau lock đúng, nhưng paymentConfirmed=true không mang số tiền người trực thực nhận hoặc phiên bản báo giá. Giá có thể đổi từ lúc xem đến lúc thu/xác nhận. Server ghi số mới và nghĩa vụ mới mà không phát hiện khoản thực thu theo báo giá cũ.

**Double mô hình thao tác:** xem COPY-A giá74k, cọc50k; trước request xác nhận một người khác đổi giá75k; gửi paymentConfirmed=true; hệ thống ghi thu100k, không có confirmed amount/quote version để so khớp50k vừa thu. Điều này không chứng minh tiền thực ngoài đời đã thiếu; nó chứng minh thiếu guard ngăn tình huống đó.

**Sửa:** ràng buộc xác nhận với tổng tiền thực kiểm/quote version, server vẫn là nguồn tính cọc. Giá/cọc thay đổi thì trả conflict yêu cầu đối chiếu lại, không tin client quyết định giá hoặc tự thu thêm. Lưu nguồn thu cấp phiếu, phương thức, amount, actor/thời điểm/reference tối thiểu và phân bổ theo dòng; không vừa ghi tổng vừa từng dòng thành thu đôi. Lỗi DB không đảo tiền ngoài đời: recovery theo key, không yêu cầu thu lần hai.

**Hồi quy:** quote50k→100k trước commit bị chặn trước journal; amount thiếu/thừa/sai kiểu; BANK chưa kiểm app không post; retry/mất response không nhận hai lần. Đây là ưu tiên vì yêu cầu quan trọng nhất là sổ khớp thực thu/chi.

### S07-05 — P2: Nhận cọc BANK mất liên kết ca, báo cáo ca thiếu thu ngân hàng

**Vị trí:** `circulation/service.ts:218–230,333–366`; `finance/cash-sessions.ts` bank aggregates.

Issue có activeSessionId cho cả CASH/BANK nhưng truyền cashSessionId:null khi BANK. Summary thống kê bankIn theo session ID nên không thấy khoản này. GET receipt cũng hardcode sessionId:null; không có persisted receipt/payment header giữ liên kết và thông tin xác nhận riêng.

**Double:** BANK50k được journal ghi, nhưng journalSessionNULL và summary.bankIn0. Tiền mặt không tăng là đúng; bỏ khoản BANK khỏi báo cáo buổi là sai.

**Sửa:** gắn buổi cho chuyển động BANK phục vụ báo cáo và truy vết; không cộng vào hộp CASH. Lưu nguồn payment/session và đọc lại đúng; không suy từ allocation LIMIT1 rồi mặc định CASH khi thiếu dữ liệu. **Test:** issue BANK50k, bankIn50k/cashIn0/expected cash giữ nguyên; đọc lại session/payment confirm đúng; return khác phương thức/ca khác truy đủ cả hai buổi. Đừng sửa giao dịch BANK thành CASH để ép số.

### S07-06 — P2: Biên nhận đọc lại dùng metadata hiện tại thay snapshot

**Vị trí:** `circulation/service.ts:186–193,307–368`; `schema/01_schema.sql` loan_receipts/items.

deposit_snapshot đã được lưu đúng, nhưng giá bìa/căn cứ/policy version không được persist. GET join giá/title/publisher/borrower hiện tại; sau sửa catalog thì chứng từ lịch sử thay đổi. Response lúc issue có giá nhưng DB chỉ giữ deposit_snapshot, không đủ tạo lại nội dung ban đầu.

**Double:** cùng receipt, coverPrice lúc đầu74k; sửa copy thành230k và đổi title/borrower name thì GET đổi theo; depositSnapshot vẫn50k. Không gọi đây là cọc cũ tự đổi; lỗi là thiếu snapshot chứng từ/căn cứ và không phân biệt thông tin hiện tại với lúc giao dịch.

**Sửa:** persist snapshot tối thiểu đã yêu cầu: giá nullable, căn cứ cọc, policy version và metadata chứng từ cần giữ; borrower PII chỉ snapshot có mục đích/thời hạn rõ, không copy mọi field. DTO phân biệt historical/current khi cần; ngày DATE serialize YYYY-MM-DD nhất quán với PG. **Test:** issue→sửa giá/chính sách/title/borrower→GET/replay giữ nội dung lịch sử đúng; nguồn cũ thiếu snapshot thể hiện legacy rõ, không backfill giả.

### S07-07 — P2: Hạn trả chưa áp dụng lịch trực/ngoại lệ đã chốt

**Vị trí:** `circulation/rules.ts:52–66`; `circulation/service.ts:164–166`; loan schema.

calculateDueDate chỉ +14 ngày, không đọc lịch trực/ngày hủy/nghỉ và không lưu hạn gốc/hiệu lực/lý do/version. +14 theo ngày Việt Nam là phần đúng; prompt07 yêu cầu xử lý cả ngoại lệ đã biết, không chờ stage10 mới làm đúng.

**Ví dụ cấu hình kiểm thử, không khẳng định ngày lễ thật:** mượn01/10→hạn gốc15/10; nếu buổi15/10 bị hủy/nghỉ thì hạn hiệu lực phải dời tới buổi hợp lệ tiếp theo. Hiện không có input/source ngoại lệ trong hàm/use case. Phiếu mượn từ buổi open cũ cũng không kiểm session_date với ngày thực.

**Sửa:** calendar dùng chung cho issue/return08/renewal10: ngày địa phương, lịch định kỳ và ngoại lệ từ nguồn chuẩn, lưu căn cứ hạn hiệu lực; không trừ lượt gia hạn do CLB nghỉ. Ngoại lệ chưa chốt giữ policy/gate rõ, không hardcode bỏ qua. **Test:**+14 qua tháng/năm/tháng2, biên UTC+7, buổi đến hạn nghỉ liên tiếp, ca không đúng ngày. Tránh phạt sai khi return08 dùng due_date này.

### S07-08 — P2: DB fixtures/tests chưa sẵn sàng; các gate recovery/concurrency vượt bằng chứng

**Vị trí:** `tests/integration/issue-loan.test.ts:38–96,112–326`; cash-session tests; progress22/23; README.

Setup issue INSERT borrowers.borrower_type không có trong DDL. Sau sửa cột này vẫn vướng helper Client S07-02. Setup mở500k nhưng seed ca trước actual350k mà không có discrepancyReason, cũng sẽ bị guard từ chối. Các test mở ca lặp cùng ngày và không đóng/dọn ca từng test, xung đột guard mới. Suite cash tương tự: opening200k khác seed350k thiếu lý do, cùng ngày nhiều test. Chưa execution PG; đây là lỗi xác định từ source/DDL/fixture.

Test archive “race” là tạo loan xong mới archive trên cùng client, không hai transaction overlap. Test idempotency “concurrency” claim/complete/replay tuần tự, claim và complete ngoài transaction issue. Test rollback chỉ dùng mã sách không tồn tại trước mutation, không fault sau receipt/journal/audit/cached response. Promise.all không chứng minh hai connection đã tranh khóa; observer/deadline cần thiết. Unit SQL double pass không bù những gate này.

**Sửa:** fixture/schema nhất quán, từng test độc lập với ngày/ca/handovers rõ. Test route/use case transaction thật, app role, blocking assertion/deadline/cleanup; fault sau từng bước ghi, lost response và retry. Không thêm borrower_type vào domain chỉ để fixture cũ chạy. Ghi source/unit/direct-handler/PG/Workers/provider riêng; bỏ “triệt để100%”, “deadlock triệt tiêu hoàn toàn”, “ACID tests hoàn chỉnh” chưa chứng minh. Lỗi môi trường BLOCKED khác lỗi fixture cần sửa.

### S07-09 — P2: Validation và contract còn lệch, catalog carryover chỉ hoàn thành một phần

**Vị trí:** borrower rules, catalog create/update/title/edition; router body/path parsing; OpenAPI issue/session contracts.

**Direct handler:** fullName123 vẫn500; bankConfirmedByMember:true được OpenAPI gọi alias nhưng validator chỉ đọc paymentConfirmed, request trả400. OpenAPI paymentMethod default CASH nhưng code không default. UUID/enum/bounds/body-size/Origin/rate-limit gates chưa đủ; tiền unsafe/string rác, array/null body ở các mutation cũ vẫn cần kiểm. Pagination đã chặn finite/integer ở service nhưng router một số đường dùng Number(...)||default làm0/NaN bị nuốt, offset chưa safe-integer bound.

Title/edition create đã có và transaction, nhưng chưa có cập nhật metadata title/edition/association, ngày nhập thực/review state như06/07 yêu cầu; date unique chỉ SELECT trước INSERT, DDL chưa có UNIQUE(session_date/buổi), predecessor chỉ kiểm source nên không gọi DB uniqueness đã nghiệm thu. Progress còn gán S06-04 thành lỗi mở ca0 trong khi finding thực là giá sách0; test count không đóng các mục bị gán nhầm.

**Sửa/test:** một contract đúng thực tế, reject input sai400 trước DB, map expected PG conflict/FK đúng, schema/DTO/aliases thống nhất; sửa các mục06 còn thiếu và test HTTP đúng field/route/role. Contract test response thật gồm envelope/date/payment/session, không chỉ lint YAML. Không tự thêm policy “khách quá hạn cấm mượn” vì chưa được chốt chỉ để khớp description409 đang có.

## Đối chiếu chín finding06

| Finding06 | Kết quả07 và phần còn mở |
|---|---|
| S06-01 transaction | Issue/create title/create edition đã bọc; session/copy/borrower chưa bọc, S07-01; helper S07-02 |
| S06-02 đảo cọc | Đã truyền targetCashSessionId, legacy nhiều row trả conflict; hướng sửa đúng. PG/rollback/ca đích chưa nghiệm thu; ownership dùng chung S07-01/02 |
| S06-03 audit | Đã có helper và ghi audit tại mutations; atomicity caller còn S07-01. Audit sanitization chưa nên coi là bảo vệ mọi input lồng/PII |
| S06-04 giá0 | Source INSERT đã kiểm khác null, giữ0; không phải lỗi openingCash0 như progress ghi. Unit/review source đúng hướng, PG chưa chạy |
| S06-05 archive OVERDUE | Query đã xét OVERDUE/dòng chưa trả/cọc còn giữ. Còn guard chặn PARTIAL_SETTLED lịch sử ngay cả khi không còn nghĩa vụ, phối hợp transaction chưa đủ |
| S06-06 validation | Có finite/integer/page/query bounds và reject boolean/fraction price; body/type/UUID/unsafe/range còn S07-09 |
| S06-07 catalog CRUD | Có create title/edition/associations; update/date nhập/review metadata còn thiếu; không đóng toàn bộ |
| S06-08 buổi/predecessor | Đã kiểm cùng ngày và predecessor gần nhất trong source; DDL uniqueness/custodian/transaction/race chưa chứng minh |
| S06-09 test/contracts | Seed không còn ca open, closed-writer test đã gọi writer thật — sửa đúng. Fixture mới, test cạnh tranh/recovery và parity còn S07-08/09 |

Auth provider/live revocation/grants/body-size/Origin/rate-limit từ03 vẫn là gate riêng, không tự pass vì issue RBAC unit pass. Tổng số query listLoanReceipts là2+3N cho N receipt, tối đa302 query/page100; chưa benchmark để kết luận độ trễ. Nên dùng truy vấn/batch hiện có khi hoàn thiện GET08, không mở refactor/performance project riêng.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;51 file;0 error,0 warning,16 hint;tsc pass | Source/type |
| Astro build vào `.review-artifacts/stage07-build` | Exit0;3 trang static | Không là Workers HTTP/backend |
|9 unit files, isolation none | Exit0;68 pass,0 fail | SQL doubles/direct handlers, có wrapper file không khai báo test |
| Python unittest discover | Exit0;22 pass | PoC/regex |
| Redocly2.64.1 lint | Exit0;0 error,24 warning | Chưa chứng minh contract parity |
|6 DB files, isolation none/concurrency1 | Exit1;30 test bị before-hook DB_RUNTIME_MISSING |0 assertion PG được nghiệm thu |
| Docker/PATH/env | Daemon pipe unavailable; psql/postgres không PATH; TEST_DATABASE_URL không cấu hình | Không tạo cloud hoặc dùng DB thật |
| Wrangler local8796 | Exit1;launcher spawn EPERM | Workers chưa kiểm được |
| Counterexamples07 | Exit0; phản ví dụ và nhánh driver guard |0 external request,0 real DB write |

Script/JSON ở `.review-artifacts/stage07-counterexamples.mjs` và `.json`. Connected flag của pg.Client được giả lập để kiểm reconnect branch, không là test DB server. Scenario quote drift giả định tiền thu theo preview cũ; không suy ra giao dịch tiền ngoài đời đã xảy ra. Calendar example là ngày nghỉ giả định, chưa có test runtime áp holiday. Không dùng local evidence làm tuyên bố production bị khai thác.

## Bàn giao

[Prompt08](../prompts/antigravity-next/08-full-return.md): sửa S07-01..09/carryover06 còn liên quan rồi full return, fine theo phiếu và refund pending/confirm đúng ca/phương thức. Chưa làm partial-return09. Catalog/domain độc lập vẫn tiến hành khi runtime thiếu; không dùng mock làm fallback tiền thật và không đóng gate tiền khi PG/provider/Workers chưa đạt.

**Chưa kiểm:** PostgreSQL thật, provider, application-role grants, Workers HTTP, mobile, ngân hàng, load/penetration/backup-restore. Implementation giữ nguyên trong lượt review; chưa đủ dùng tiền/PII thật.
