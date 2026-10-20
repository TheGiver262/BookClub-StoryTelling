# Chặng 05 — Mở/đóng ca và đối soát hộp tiền

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-stage04-followup.md, review gốc docs/reviews/2026-10-18-antigravity-review.md, index 22 chặng docs/prompts/antigravity-next/README.md và đặc tả docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md, docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và implementation hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 03, 04. Chặng04 hiện PARTIAL; PostgreSQL/provider chưa được nghiệm thu. Sửa carryover trước phần phụ thuộc. Không coi 33 unit tests hoặc fail-closed thiếu env là DB/Auth đã xong. Có thể làm domain/tests/contract độc lập khi runtime thiếu, nhưng không mở API tiền cho actor giả hoặc đóng gate tích hợp bằng mock.

**Findings liên quan:** R04, phần quầy của R10; carryover S04-01..S04-08 và phần chưa đạt của S03. Review hiện có phản ví dụ ở domain/handler; chưa có bằng chứng mất tiền hoặc bị khai thác production.

**Files/responsibility:** Tận dụng `src/server/finance/`, tạo cash-sessions.ts ở đây và routes theo router hiện có; dùng cùng ledger/deposits/shared/idempotency và DB transaction của caller. Sửa các file Auth/policy/SQL/test thuộc carryover, không tạo một cây src/modules trùng với src/server. Migration/baseline/seed theo trạng thái thực; tests/integration/cash-sessions.test.ts và các test finance/Auth liên quan; package script phải include test mới. Đồng bộ OpenAPI/domain-data/transactions-finance/progress và nguồn/render diagram phần quầy bị đổi; không viết lại UI hoặc toàn bộ sơ đồ.

## 0. Sửa carryover trước

### 0.1 S04-01 — Chứng từ nhận/hoàn có định danh nghiệp vụ

- [ ] Viết regression cho cùng receipt/item nhận cọc hai lần bằng entryCode/key khác; một ý định hoàn50k được confirm hai lần thành100k; yêu cầu50k nhưng confirm100k. Artifact `.review-artifacts/stage04-counterexamples.mjs` dùng SQL double của test để ghi bằng chứng trước sửa; không sửa review cũ hoặc gọi artifact đó là test PostgreSQL.
- [ ] Thêm ID nguồn/ý định nhận-hoàn ổn định và business uniqueness phù hợp, lưu amount/method/status. Confirm theo ID đã chốt, không theo amount/method mới tự do. Retry khác idempotency key vẫn chỉ một hiệu lực cho cùng ý định; hai ý định hợp lệ khác nhau vẫn được thực hiện khi còn nghĩa vụ. Không unique(receipt_id) đơn giản vì nhiều bản sách/allocation là hợp lệ.
- [ ] Row locks và constraint bảo vệ cùng source/action/allocation; amount cần server tính/đối chiếu từ nguồn, không tin tổng client. Pending refund giữ nguyên tiền và nghĩa vụ cho đến confirmed; thay/hủy ý định có audit. Tiền mặt thiếu thì giữ chờ hoặc đổi phương thức theo xác nhận, không ghi chi giả.

### 0.2 S04-02/S04-06 — Đảo source, đối soát nghĩa vụ và policy

- [ ] Chặn đảo journal nghiệp vụ nhận/hoàn cọc trực tiếp nếu không thể cập nhật source; hoặc thực hiện use case đảo source cập nhật allocation/intent/journal/audit cùng transaction. Sau đảo không được allocation150k nhưng ledger liability0. Nợ=Có là kiểm cân journal, không chứng minh nghĩa vụ đúng; có query/assert đối chiếu tổng allocation và COC_PHAI_HOAN.
- [ ] Lưu reason/actor/link gốc cho reversal/forfeit/transfer và các thay đổi tiền quan trọng. Không chỉ kiểm reason rồi bỏ. Reversal có constraint chống đảo lặp/đảo quá mức, kiểm hai connection.
- [ ] Forfeit chưa có policy quỹ nhận phạt/mất đã chốt thì không post. Policy trong test ghi rõ giả định test, không biến FUND_LOAN/THU_PHAT thành quyết định CLB. Xác định state được phép; không tiêu phần đang có ý định hoàn mà chưa giải quyết ý định đó. Giữ nguyên quy tắc phạt/cọc đã chốt, không mở rộng bán hàng hay toàn bộ trả sách.

### 0.3 S04-03 — Idempotency và test phải phù hợp PostgreSQL

- [ ] Sửa test ở finance-ledger.test.ts đang await client2 claim cùng key trước khi client1 commit: unique conflict với row chưa commit sẽ chờ, không tự có lỗi409 như mock Map. Chốt contract đợi/replay sau commit hoặc try-lock/conflict có cơ chế DB đúng. Không tách commit PROCESSING để né test mà thiếu recovery.
- [ ] Client1 claim và giữ transaction, launch client2 background, quan sát blocking/overlap, complete+commit client1 rồi await client2; test/query/lock timeout và cleanup hữu hạn. Test hoàn cọc đồng thời bỏ sleep50ms làm bằng chứng, dùng quan sát DB như test loan đã có. Không JS mutex tuần tự hóa hai phép ghi.
- [ ] Ghép finance mutation + journal/allocation/audit + idempotency result cùng transaction. Test mất response sau commit, lỗi sau từng bước, rollback/retry, cùng key khác payload, khác actor/operation và hai key cùng business source. Replay phải kiểm quyền hiện tại trước khi trả response nhạy cảm. Không dùng PROCESSING/FAILED ghi ngoài transaction để che nghiệp vụ đã commit.
- [ ] Tạo/kiểm application role ít quyền, tách test/reset owner. Kiểm permissions thật, business constraints, reversal/transfer/forfeit và đối soát allocation trên PostgreSQL. Queryable có thể giữ nhỏ; không thêm framework transaction nếu một outer use case/client chung đã đủ. Không chỉ import hàm trong test rồi ghi đã kiểm.

### 0.4 S04-04/S04-05/S04-07 — Auth và ranh giới cựu còn mở

- [ ] Bỏ module Set blacklist làm nguồn revoke; dùng provider/session/DB state chia sẻ, có expiry/cleanup. Logout/replay phải bị chặn ở hai instance/restart và với refresh theo contract. Verify/bound input, không lưu raw token rác vô hạn. Không đưa lại mock/default signing secret vào runtime; DI fixture chỉ ở test.
- [ ] Alumni chỉ nhận tập hoạt động/nội dung được duyệt dành cho cựu. Query mọi activities rồi bỏ cột budget chưa đủ vì description/title/file có thể chứa PII/tiền. Mặc định unclassified/draft không trả; lưu approved safe projection/flag hoặc cơ chế nhỏ tương đương, không regex đoán dữ liệu nhạy cảm. DB lỗi trả lỗi phù hợp, không danh sách rỗng200 che lỗi. Chưa cần xây cả events19 để sửa ranh giới đọc này.
- [ ] Bảo vệ trạng thái cuối alumni/admin ở DB/domain: alumni hiện có nhận PATCH chỉ isAdmin=true cũng phải bị chặn; thêm CHECK/điều kiện update phù hợp, status/version/audit cùng transaction. DTO ép cờ không thay DB constraint. requireAdmin tiếp tục chặn alumni/disabled.
- [ ] Hoàn thiện phần S03 còn thiếu: body limit/schema bounds, Origin/CSRF cho cookie mutations, rate limit theo runtime, session/token verification chuẩn; thiếu subject provider không sinh guest_Date.now. Google/provider chưa chạy ghi BLOCKED. Giữ username nội bộ được admin cấp, credential khách tách biệt; không suy quyền từ tên/email/user_metadata.

### 0.5 S04-08 — Trạng thái và bằng chứng đúng cấp

- [ ] Progress/README phân biệt source, unit SQL double, PostgreSQL, Workers HTTP và provider. 33 là tổng unit tests, trong đó finance hiện có4 top-level test; không ghi 33 finance integration hoặc “100% ACID”. G-auth-safety không PASS toàn bộ khi còn carryover đã tái hiện.
- [ ] Chạy prerequisite lại. Dùng PostgreSQL disposable local hợp lệ nếu sẵn, giữ guard host/namespace/current_database và chỉ reset tài nguyên test do task sở hữu. Không DB thật/cloud project mới, không thay SQLite. Nếu runtime vẫn thiếu: hoàn thiện phần độc lập, ghi gate BLOCKED và một lệnh chạy tiếp, không tự đánh dấu đủ điều kiện dùng tiền.
- [ ] Đồng bộ source/contract/diagram đúng phần thay đổi, giữ 22 chặng và snapshot review cũ. Không coi static frontend build hoặc test gọi trực tiếp handleRequest là Workers HTTP/provider pass.

## Thực hiện

- [ ] Thiết kế một cash session cho một hộp tiền tại một địa điểm/buổi của CLB. Thành viên nhập bằng tài khoản riêng, không tạo balance đầu buổi cho từng người. Dùng ngày nghiệp vụ Asia/Ho_Chi_Minh, lịch trực thường thứBa/thứNăm14–17h nhưng không hard-code ngày test/current date. Ràng buộc DB chống nhiều ca cho cùng hộp/buổi; chưa hỗ trợ nhiều CLB/nhiều quầy đồng thời.

- [ ] Người trực chính xác nhận đầu/cuối, lưu người/thời gian chịu trách nhiệm và actor từng giao dịch. Không biến ban/chức vụ thành RBAC mới. Nếu scheduler15 chưa có lịch công bố, dùng khai báo người chịu trách nhiệm ca được kiểm hợp lệ, không làm lại module xếp ca hoặc tự yêu cầu hai chữ ký. Admin override nghiệp vụ nếu cần phải có lý do/audit, không chuyển quyền hạ tầng.

- [ ] Mở ca lưu số tiền thực đếm và nguồn bàn giao ca trước. Lần đầu xác lập opening float không được gọi doanh thu/thu cọc mới; các buổi sau cất tủ/lấy ra chỉ bàn giao cùng tiền, không tạo thu/chi mới. Số actual opening khác số bàn giao phải có discrepancy/reason, không ép khớp bằng sửa dữ liệu cũ. Không cộng thêm opening float vào số dư lũy kế lần nữa.

- [ ] Liên kết mỗi cash movement đã xác nhận của FUND_LOAN với session, source/intent và journal04. Tăng/giảm tiền mặt chỉ từ thực thu/chi cash confirmed; bank tách riêng, QR/loa/ảnh chưa xác nhận không thành tiền. Pending refund không là cash out; chuyển allocation không có cash movement. Không tạo sổ tiền thứ hai không đối soát được với ledger.

- [ ] expectedClosingCash = actualOpeningCash + tổng cash in confirmed − tổng cash out confirmed trong ca. Bank flow và tổng nghĩa vụ cọc được báo cáo riêng; không cộng bank vào hộp. Chỉ số cọc còn phải hoàn đối chiếu allocation với liability journal. Chặn double-count movement qua join nhiều dòng sách/journal hoặc hai người cùng xác nhận.

- [ ] Đóng ca lưu expected tại snapshot, actualClosingCash thực đếm, discrepancy = actual − expected, lý do khi lệch, actor/thời gian. Không tự thay actual bằng expected, không lấy quỹ hoạt động bù, không sửa journal hoặc tạo income/expense để che lệch. Điều chỉnh sau đóng là chứng từ có liên kết/audit theo contract rõ, không UPDATE âm thầm số đã xác nhận. Tách việc ghi chênh lệch khỏi quyết định xử lý trách nhiệm.

- [ ] Lock session trong cùng transaction khi ghi cash movement và khi đóng. Tất cả đường ghi cash, gồm receive/refund/confirm cash04, phải dùng cùng quy tắc khóa/state; kiểm route một mình không đủ. Chốt thứ tự khóa session/allocation/journal/idempotency nhất quán để tránh deadlock. Close cạnh tranh movement phải có thứ tự rõ: movement commit trước thì vào snapshot; close commit trước thì movement mới bị chặn/được xử lý ở ca hợp lệ sau, không rơi ngoài số tổng.

- [ ] Ca đã đóng không nhận tiền mới qua request retry/key khác/backdated input. Replay chứng từ đã commit chỉ trả kết quả cũ sau kiểm quyền, không ghi lại hoặc sửa closing snapshot. Hoàn chờ từ ca cũ thực trả ở ca sau: giữ liên kết nguồn cũ nhưng cash out thuộc ca thực trả, chỉ một lần. Bank ngoài ca cần contract rõ và không giả thành cash; không sửa phương thức nhận cọc cũ.

- [ ] API mở/lấy hiện tại/chi tiết/tổng kết/đóng có validation, policy, idempotency, errors và receipt đúng implementation. Member hoạt động được làm nghiệp vụ theo quyền đã chốt; xác nhận tiền theo trách nhiệm trực chính. Guest/alumni/disabled bị chặn ở API và replay/download liên quan. Chỉ nối HTTP tiền khi Auth/provider/DB đạt gate tương ứng; khi thiếu provider vẫn có thể test domain qua actor test riêng, không mở bypass trong entry thường.

- [ ] Dùng migration/baseline đúng trạng thái DB thực, test/reset role riêng và application grants ít quyền. Runner test:db phải include cash-sessions.test.ts cùng các regression04. Đồng bộ OpenAPI và diagram state/sequence quầy; chưa làm quầy UI12 hoặc toàn bộ circulation07–11.

## Gate phải chứng minh

Ghi từng gate PASS/PARTIAL/BLOCKED với lệnh/version/môi trường/exit thực:

1. **G-carryover:** S04-01..S04-08 có regression tương ứng. Auth default/demo bypass vẫn bị chặn, session revoke hai instance và alumni privacy đúng. DB/provider/Workers gate riêng chưa chạy thì không nhận đã hoàn thành.
2. **G-finance-db:** nguyên migration/seed04+05 và regression finance chạy PostgreSQL disposable. Partial refund retry khác key chỉ một hiệu lực, pending amount/method được khóa, reversal/allocation/liability khớp, policy/audit đúng; idempotency hai connection không treo và chỉ một side effect. Application role permissions được thử thật; lỗi giữa các bước rollback sạch.
3. **G-session-db:** test tối thiểu:
   - 5 request khác actor/key mở cùng buổi với opening200k: chỉ một session/số opening200k, không thành1triệu. Ràng buộc DB vẫn chặn khi bỏ qua UI.
   - Opening200k, nhận50k cash +100k bank: expected cash250k, bank+100k, nghĩa vụ cọc+150k. Chỉ posted/confirmed được cộng.
   - Opening200k, thu cọc100k, hoàn100k, thu phạt3k với policy test khai báo: cash203k, nghĩa vụ phần đã tất toán0; không gộp thu–hoàn giả. Policy CLB thật vẫn chưa tự chốt.
   - Nhận100k bank rồi hoàn100k cash từ hộp có float hợp lệ: bank+100k, cash−100k, nghĩa vụ0, giữ phương thức nhận gốc. Tiền mặt không đủ thì không xác nhận đã chi giả.
   - Hoàn pending ở caA, trả thực ở caB: một cash out ở B, nghĩa vụ không bị xóa sớm hoặc chi hai lần.
   - Hai connection confirm cùng cash movement/đóng ca: chỉ một hiệu lực; close retry cùng/key khác không đổi snapshot. Test có quan sát overlap, deadline và cleanup, không sleep làm bằng chứng.
   - Close cạnh tranh receive/refund: cả hai lịch commit được kiểm; không ghi movement vào ca đã đóng hoặc thiếu movement đã commit trong expected.
   - Expected203k, actual200k: lưu discrepancy−3k và lý do; không sửa journal, actual hoặc bù quỹ. Ca sau đếm200k dùng actual bàn giao, không ghi thêm200k doanh thu/thu cọc.
   - Ngày Việt Nam qua ngày UTC/tháng/năm vẫn xác định đúng ca; actor/current status được kiểm lại trước commit tiền.
4. **G-http/runtime:** health/readiness/ca API chạy HTTP thật trên Workers local/runtime đã chọn và DB test; no config fail closed. 401/403 theo đúng role/state, trách nhiệm xác nhận, CSRF/Origin/body bounds/cookies/cache đúng; phiên bị revoke không replay số liệu. Test gọi thẳng handleRequest chỉ ghi router unit evidence. Thiếu provider/Workers thì gate này BLOCKED, không dựng fake200.
5. **G-baseline/contracts:** check/build/unit/Python22/OpenAPI lint có version rõ, test scripts include file mới, diagram/README/progress đúng trạng thái thực. Không gọi số test hoặc build static là nghiệm thu tiền/100% ACID.

Nếu chưa có PostgreSQL, chỉ bàn giao code/test/contract với G-finance-db/G-session-db BLOCKED và hướng dẫn chạy một lệnh khi runtime sẵn. Không tự đánh dấu PASS hoặc chạy chặng06 để tránh phần còn thiếu.

## Đầu ra

Cash-session domain/API và DB thực ở mức đã chứng minh, cùng ledger04; contract cho các caller07–11 gồm session ID/state, transaction/lock ownership, source/movement/intent, VND serialization và errors/idempotency. Bàn giao riêng carryover đã sửa/chưa verify, gate Auth/DB/HTTP còn thiếu. UI hiện có chưa được coi đã nối. Nếu sửa carryover chiếm cả phiên, dừng PARTIAL tại mốc tự nhiên và ghi rõ phần05 còn lại; không tự chạy06 hoặc triển khai toàn bộ sản phẩm.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

