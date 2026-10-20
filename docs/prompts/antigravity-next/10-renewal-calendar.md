# Chặng 10 — Sửa carryover09, gia hạn và lịch ngày đến hạn

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## 1. Đọc thêm, phạm vi và thứ tự

Đọc `docs/reviews/2026-10-19-stage09-followup.md`, bảng lỗi còn mở06/07/08 trong report, prompt09 và source/schema/tests/OpenAPI hiện tại. Report là snapshot, kiểm lại trước sửa; không sửa report reviewer để tự đóng finding. `.review-artifacts/stage09-counterexamples.mjs` dùng SQL double và adapter mô hình DDL, không PG server.

**Phụ thuộc:**08/09 vì cùng circulation/finance helpers hiện tại; calendar domain độc lập vẫn làm được khi môi trường thiếu. Sửa carryover chặn lifecycle/money/schema trước, rồi renewal/calendar. Không gọi stage09 hoàn chỉnh từ93 unit pass. Giữ22 mã chặng; không làm lost11/UI12 hoặc thay branding/design.md.

**Trách nhiệm:** dùng `src/server/circulation/`, finance/shared/db/Auth/catalog/borrowers hiện có; tách renewal/calendar helper theo trách nhiệm khi cần, không tạo cây src/modules song song, ORM/microservice hoặc engine tiền thứ ba. Scope gồm callers/validation/schema-migration/DTO/OpenAPI/tests/fixtures/read models/diagram thực bị đổi. Giữ file/lịch sử người dùng. Không reset DB thật để tránh migration; không fallback RAM/mock cho tiền runtime.

## 2. Sửa carryover09

### 2.1 S09-01, S09-05 — active hold và migration đúng PostgreSQL

- Partial hiện INSERT new loan_item trước UPDATE old.carried_forward_at nên unique index tức thời chặn. Đóng logical hold cũ bằng carried_forward_at trước INSERT mới trong cùng transaction, rồi link successor_item_id khi row mới tồn tại hoặc preallocate ID với FK hợp lệ. Không fake returned_at, xóa index/disable constraints hoặc nghĩ cùng transaction tự trì hoãn unique check.
- Khi commit: copy giữ luôn BORROWED và đúng1active hold, copy trả AVAILABLE đúng bản. Fault sau đóng old hold/insert/link/transfer/audit/cache rollback về trạng thái hợp lệ; hai actors chỉ một successor/settlement.
- Migration ALTER thêm carried fields/FK, thay index predicate cũ đúng và backfill có bằng chứng. CREATE TABLE/INDEX IF NOT EXISTS không upgrade table/index cùng tên đã có. Định nghĩa xử lý dữ liệu legacy mơ hồ, reject thay vì đoán; giữ journal/receipt/allocations.
- Test fresh schema và upgrade từ schema08 có dữ liệu giả, PG thật; giữ max2trigger và mọi FK/uniqueness. Không thêm dữ liệu fake hoặc sửa test mong bỏ constraints để pass.

### 2.2 S09-02, S09-03 — pending có đường hoàn tất

- PENDING_COLLECTION/PENDING_DEPOSIT đang dùng trong code nhưng không có enum/type. Chốt lifecycle tối thiểu, migration/schema/types/DTO/OpenAPI đồng bộ. Nếu chọn bỏ trạng thái thì phải có nguồn tương đương giữ được khoản chờ thu, không silently chuyển ACTIVE/HELD trước khi nhận tiền.
- Hoàn thiện confirm thu cọc mới T73 bằng stable collection intent/source, amount/quote, method, actor/time/session và key riêng. Pending giữ copy/hold, không liability hay cash inflow giả; tiền nhận thật mới tăng liability/cash đúng1lần, old forfeit150 không ghi lại. Nhận A trước/thu mới100k ca sau vẫn truy được đầy đủ; mốc hạn/pending owner/cancel reason rõ.
- Hoàn thiện thu phạt pending sau nhận sách hoặc quyết định late renewal: GET trả số/status phải thu, API confirm riêng có nguồn/amount/method/session/audit/idempotency. Không yêu cầu settle phiếu RETURNED/PARTIAL_SETTLED lần nữa chỉ để thu.
- Decision phạt đã chốt bất biến; tiền thực có chứng từ trạng thái riêng. Miễn/giảm/sửa quyết định có reason/version/source audit, không DELETE journal hoặc tự thu lại khoảng phạt cũ. Không dựng hệ công nợ tổng quát ngoài các khoản này.
- Test pending→reload→confirm ca sau, BANK/CASH, missing strict true, amount thiếu/thừa/quote đổi, two actors/keys, lost response, fault mọi bước. Xác định rõ hủy/thu sai nguồn, không để state kẹt vĩnh viễn.

### 2.3 S09-04, S09-06 — allocation coverage và tiền khả dụng

- Trước partial/renewal/phạt, assert allocation source coverage cho receipt/items, state/remaining/mapping hợp lệ. Không `if (allocKept)` rồi bỏ qua tạo successor không cọc; NULL/multiple/legacy ambiguity phải migrate có căn cứ hoặc từ chối trước bước final. Không đoán theo amount và không chỉ dựa reconciliation tổng quỹ.
- Một source cash available/cutoff dưới cùng session lock. `min(session field,journal)` chưa hợp nhất source và có thể chặn refund được cấp đủ tiền qua shared receive helper. Chọn ledger hoặc materialized field được mọi writer update atomic đúng1lần; caller không cộng/trừ thêm lần nữa.
- Giữ actual cash count/snapshot close khác expected balance. Mismatch phải hiện cần đối soát, không min im lặng rồi gọi khớp100%. BANK có buổi để truy vết nhưng không cộng hộp CASH; không lấy quỹ hoạt động bù âm thầm.
- Test receive/refund/fine/reversal cũ+mới, sufficient/insufficient cash, partial intent, duplicate/stale intent, mapping receipt-levelNULL, transfer/no fake cash và close race. Managed source guards đã sửa thì giữ; mọi nguồn mới phải nằm trong cùng guard/correction contract.

### 2.4 S09-07, S09-08 — lineage, snapshot và xác nhận tiền mới

- Receipt/item DTO có predecessor/successor, logical hold chuyển tiếp, physical returned riêng. GET successor truy nguồn cọc nhận gốc qua allocation lineage để có lịch sử ca nhận/ca chuyển/ca hoàn; không thêm journal CASH/BANK giả chỉ để lookup ra session.
- Giữ snapshot giá nullable/căn cứ cọc/policy/hạn gốc-hiệu lực/reason/version cần thiết; GET phân biệt historical/current, sửa catalog không thay chứng từ. Settlement snapshot09 đã có và PG DATE string parser đã sửa thì reuse, không dựng read model thứ hai.
- Mỗi khoản mới: amount/quote và xác nhận riêng, không optional bypass hoặc suy `newDepositConfirmed` từ paymentConfirmed chung của hành động khác. Server vẫn tính tiền chuẩn, client amount chỉ đối chiếu; mismatch conflict trước journal, không tự thu thêm.
- Gate quỹ phạt/giữ cọc còn BLOCKED theo docs06 nếu chưa có quyết định mới. Không tự gọi FUND_LOAN/FUND_OPERATION đã được phê duyệt; fixture policy explicit, phần độc lập tiếp tục. Các policy chưa chốt không được âm thầm chọn để nghiệm thu tiền.

### 2.5 S09-09 và carryover trước — chứng cứ đúng cấp

- Sửa fixtures opening/handover/date thực: không force-close thiếu actual snapshot rồi mở cùng ngày; chênh opening với seed cần lý do/fixture trung lập. Giữ correction vị trí/cọc đã sửa, không áp lại report lỗi cũ đã hết.
- Unit mock phải fail khi vi phạm hành vi đang kiểm hoặc ghi giới hạn rõ; PG tests thực thi unique/enums/DATE/FK/upgrade, hai connection overlap có assertion blocking/deadline/cleanup. Thêm fault sau mutation/audit/cached response, lost response; test thuận lợi tuần tự không là recovery/concurrency proof.
- Rà validation object/type/UUID/safe amounts/page-offset/body-size/Origin/CSRF/rate-limit và managed provider/application-role grants từ03. Catalog metadata associations/date nhập/review còn thiếu thì hoàn thiện trong phạm vi hoặc ghi đúng phần chưa làm, không tự đóng R07 từ một endpoint create.
- Transaction owner Pool/Client/PoolClient phải rõ; __in_tx chỉ nhận diện transaction do helper tạo. Không COMMIT outer raw BEGIN rồi tuyên bố hỗ trợ arbitrary client transaction. Giữ transaction wrappers create/update/archive/session đã thêm đúng.
- Cập nhật source/render diagram partial09 không còn DỰ KIẾN khi flow đã thực hiện; API contract actual/pending/finalize/chain nhất quán. Gate source/unit/direct handler/PG/app-role/Workers/provider riêng; không nhãn G-*-db PASS từ unit.

## 3. Gia hạn: hợp đồng nghiệp vụ đã chốt

### 3.1 Quyền, input và source

- Tái dùng route dự kiến `POST /api/v1/circulation/loans/{id}/renew` trong OpenAPI, bổ sung GET lịch sử renewal qua receipt/route nhỏ nếu cần. Một implementation canonical, không fake return/issue loan mới để gia hạn.
- Active member/admin theo policy đã chốt, live actor/token state từ Auth. Guest/alumni/disabled/revoked bị chặn mutation/replay và dữ liệu borrower/tiền; no-store, body bounds/Origin theo cơ chế cookie/Bearer thật. Chưa triển khai khách tự gia hạn vì chưa chốt ai yêu cầu/duyệt.
- ID phiếu/path, key bắt buộc và reason/ghi chú cần thiết; client không quyết định dueDate/borrowDate/renewCount/status/amount/actor. Server đọc version/deadline/active physical hold/pending collection; validate full request trước ghi. Field sai/UUID/body null/array phải400, không parse thành500 hoặc default im lặng.
- Chỉ gia hạn phiếu hiện tại còn sách đang giữ, chưa RETURNED/PARTIAL_SETTLED/CANCELLED/LOST terminal. Phiếu cũ đã carry không gia hạn được; successor là phiếu hiện tại với renew_count riêng đã reset0. PENDING_DEPOSIT có policy/status rõ, không xem tự động ACTIVE đủ điều kiện; không dùng renewal để bỏ pending nguồn.
- Renewal history/fine period có nguồn/kiểu nghiệp vụ phù hợp; không ghi FULL/PARTIAL vào loan_settlements hoặc đổi receipt RETURNED chỉ để tái dùng helper trả sách. Reuse phép tính/collection engine, giữ ranh giới quyết định gia hạn khác nhận sách vật lý.

### 3.2 Tối đa3lần, +14ngày lịch Việt Nam

- Gia hạn trên cùng receipt không reset renew_count. Tối đa3lần thực có hiệu lực; lần4 từ chối. Không đổi sang successor/new receipt chỉ để né lượt. Physical loan/copy status không đổi, không tạo returned_at hoặc thu cọc mới trong gia hạn thông thường.
- Trong hạn, gồm cả đúng ngày đến hết ngày Việt Nam: hạn mới cộng14 ngày vào hạn hiện tại, không tính từ ngày yêu cầu sớm. Ví dụ mượn01/10→15/10; gia hạn ngày05/10 hoặc15/10 đều→29/10 trước điều chỉnh nghỉ. Hạn đang có hiệu lực sau điều chỉnh lịch phải được lưu và dùng làm căn cứ rõ theo policy đã chốt, không đổi base mỗi lần theo ý client.
- Quá hạn: chốt quyết định phạt của khoảng quá hạn cũ trước, hạn mới cộng14 ngày từ ngày gia hạn ở Việt Nam. Ví dụ20/10→03/11 trước điều chỉnh lịch. Vẫn tăng1lượt trong tối đa3, không reset dù quá hạn; chỉ carry-forward do partial mới reset.
- DATE strings YYYY-MM-DD, tính calendar days, hôm nay lấy Asia/Ho_Chi_Minh; không so timestampUTC với ngày địa phương gây thêm1ngày phạt, không tính13ngày do đếm ngày mượn là ngày1.
- Không khẳng định56ngày là trần giữ vật lý tuyệt đối: late renewal/dời nghỉ/carry có quy tắc riêng. Không tự thêm policy “quá hạn không được gia hạn” trái người dùng đã cho phép sau chốt phạt.

### 3.3 Phạt quá hạn và watermark tránh thu lại

- Reuse engine fine decision/collection vừa sửa;1k/ngày trên cả phiếu, không nhân số sách. Gợi ý/chốt/miễn/giảm có reason/actor/policy/cutoff, tiền thực thu riêng source/method/session/amount confirmation. Dời do CLB nghỉ không tính lại thành tiền phạt.
- Lưu kỳ phạt đã chốt bằng mốc/version/period/source cụ thể: retry hoặc return sau renewal không tính/thu lại ngày đã quyết toán. Gia hạn lần2 dùng hạn đang có, không tính lại từ borrowDate của lần đầu. Decision có thể chốt nhưng tiền còn pending; DTO phải phân biệt chốt và đã thu.
- Việc có được hoàn tất gia hạn khi phạt còn pending tiền, hoặc P>=D nhưng tiếp tục giữ cùng receipt, chưa được chốt đủ trong các câu trả lời. Kiểm có quyết định mới trước khi implement; không tự áp ngoại lệ T73 của partial thành renewal để thu cọc mới/giữ cọc lần nữa. Ghi policy/gate còn mở đúng nhánh, tiếp tục in-time/waived/confirmed fine branches độc lập. Không hỏi lại các quy tắc +14/3lần/cọc đã xác nhận.
- Không âm thầm tăng tiền phạt trong lúc confirmation đang pending hoặc double-charge do hai requests; cutoff/quote phải ổn định theo workflow. Nếu policy cần pending renewal trước final, định nghĩa expires/revalidate/actor/status rõ, không tăng renew_count trước khi bước được coi có hiệu lực.

## 4. Calendar dùng chung cho issue, return, carry và renew

- Reuse `calendar_holidays`/calculateEffectiveDueDate/date helpers. Mặc định trực thứBa/thứNăm14–17h; deadline hết ngày hiệu lực, không lấy giờ17h làm mốc phạt tự phát. Holiday/Tết trùng buổi đến hạn dời tới buổi thực tế tiếp theo; không tiêu lượt gia hạn hoặc tạo receipt gia hạn chỉ vì CLB nghỉ.
- Lưu hạn gốc cho chu kỳ, hạn hiệu lực, base dùng để cộng, calendar/policy version và lý do đổi; renewal history lưu old/new values. Khi lịch đổi sau khi lập phiếu, có áp dụng/recompute active deadlines có audit/version và ảnh hưởng phạt rõ; không rewrite settlement/journal đóng hoặc làm người mượn bị phạt hồi tố do đổi lịch.
- Có thao tác nội bộ quản lý lịch ngoại lệ tối thiểu đúng role active member/admin, audit khi đổi; alumni/guest chỉ dữ liệu lịch an toàn nếu có route công khai, không PII/quỹ. Không thêm tích hợp holiday ngoài/đọc web/calendar provider tự động khi chưa cần; test dùng ngày nghỉ cấu hình giả rõ nguồn.
- Exception dài liên tiếp/cancel/reschedule không được safety-loop60ngày rồi trả một ngày vẫn không trực. Khi không tìm được buổi hợp lệ trong bound phải trả trạng thái lỗi/policy cần xử lý, không hẹn sai. Reject ngày vô lý như30/02/format sai thay vì Date tự normalize.
- Ngoại lệ hủy đột xuất/kỳ thi và ngày nghỉ xen giữa khoảng đã quá hạn còn policy mở trong docs02/06; giữ riêng khỏi quy tắc holiday trùng due đã chốt. Không tự bỏ tất cả ngày không trực khỏi số ngày phạt: ví dụ thứBa đến hạn, thứNăm trả là2k đã xác nhận. Test tất cả nhánh đã chốt và ghi gate cho nhánh chưa có quyết định.

## 5. Transaction, concurrency và replay

- Một transaction đúng client cho finalize renewal: claim(actor,operation,key,payload gồm path receipt ID), lock session khi có tiền, receipt/renewal source/fine/active hold theo lock order chung; kiểm lại trạng thái/version/lượt/deadline sau lock; ghi decision/payment đã xác nhận/history/new due/count/audit/cached response cùng commit. Không giữ lock trong lúc gọi provider/ngân hàng ngoài.
- Có stable renewal action/business ID/version để retry bằng key khác của cùng ý định không tiêu thêm lượt. Hai ý định gia hạn khác nhau có thể là hai lượt hợp lệ trong giới hạn; chốt contract để phân biệt double-click với yêu cầu tiếp, không lấy khoảng thời gian/sleep làm khóa nghiệp vụ.
- Cùng key/payload/actor replay cùng renewal ID/count/deadlines và biên nhận tiền; cùng key payload/path khác409, actor khác không xem cached result. Quyền live kiểm trước replay. Không DELETE idempotency chỉ để cho retry thu lại tiền.
- Hai connection từ renew_count2 tranh lượt cuối: chỉ có một lượt3, request khác theo contract conflict/re-read hoặc bị cap, không count4/lost update. Hai renew từcount0 với hai hành động riêng phải serialize đọc hạn sau commit trước, không cùng tính trên hạn cũ rồi mất14ngày hoặc đếm2 chỉ tăng hạn1lần.
- Renewal-vs-return/partial/lost placeholder/confirm-fine/calendar-update/close: không gia hạn phiếu đã tất toán, không ghi tiền vào ca đóng, không trộn calendar version/fine cutoff. Đường chưa triển khai11 chỉ có guard trạng thái hợp lệ, không viết full lost module.
- Fault sau fine journal/renewal row/due update/count/audit/cache rollback bước final; lost response sau commit lấy lại cùng kết quả. DB rollback không đảo tiền ngoài đời, recovery hướng đối soát theo source/key, không thu lần hai.

## 6. Gate nghiệm thu

| Gate | Bằng chứng cần có |
|---|---|
| G-carryover | Từng S09-01..09 và S06/07/08 còn mở; source/test/lệnh/môi trường/kết quả và blocker |
| G-partial-db | Fresh+upgrade, unique không chặn case đúng, pending enum/finalize, source coverage và không fake physical return |
| G-calendar | Có dấu mốc VN/UTC+7, qua tháng/năm/tháng2/năm nhuận, ngày không hợp lệ, nghỉ liên tiếp/reschedule/bound exhausted |
| G-renew-in-time |01/10→15/10→29/10; yêu cầu sớm và đúng ngày đều base hạn cũ;3lần/lần4; copy/loan receipt không fake return |
| G-renew-overdue |20/10→03/11, quyết định phạt một lần/waive reason/confirmed collection, cutoff không thu lại khi return sau; policy chưa chốt ghi riêng |
| G-renew-db | Hai connection lượt cuối, hai actions riêng/one retry, renew-vs-return/partial/close/calendar; observer assertion/deadline/cleanup |
| G-money-recovery | Fault từng mutation/audit/cache, pending→confirm, lost response, key/path mismatch, một khoản thu/liability/cash khớp |
| G-auth-contract | Actual HTTP/DTO/OpenAPI/date/money/roles/revoked/replay/no-store/bounds, không chỉ YAML lint |
| G-runtime | PG application-role grants, direct handler, Workers HTTP, provider tách; chỉ PG thật đóng invariant/locks gates |

Đối chiếu T71/T72/T74 và các test tiền/holiday trong docs05; đó là kịch bản yêu cầu chứ chưa phải test đã chạy. PG disposable local có guard target trước reset/migrate; không cloud/production/PII thật. Chạy hồi quy issue/full/partial/refund/fine/session/ledger/idempotency/Auth/catalog/borrower vì shared helpers đổi; check/build/OpenAPI lint+parity, Python nếu model/schema được tham chiếu đổi. Chỉ broad lặp khi có thay đổi/failure/rủi ro mới.

## 7. Bàn giao và dừng

- Code/migration/schema/tests/fixture/OpenAPI đúng scope; history renewal/fine/calendar và read DTO đủ, không prototype state làm nguồn tiền. ERD/state/sequence source+render phần thay đổi phải khớp code đã thực hiện, không đánh dấu module11/12 xong vì vẽ sơ đồ.
- Progress/README: từng finding/gate PASS/PARTIAL/BLOCKED, files đổi/lệnh/exit/môi trường, policy chưa chốt, input11. Giữ report09 nguyên, không đổi tên hoặc đóng finding bằng comment mới. G-*-db không PASS từ unit/doubles.
- Bàn giao request/response và SQL trước/sau giả: in-time, đúng ngày, late fine chốt, holiday adjustment, concurrent lượt cuối, replay/lost response, pending collections từ09 hoàn tất. Tài liệu vận hành nêu rõ endpoint có handler và những phần chưa chạy.
- Dừng tại10, không tự lost11/UI12/commit/push/deploy/chuyển tiền thật. Thiếu PG/provider/Workers vẫn hoàn thiện phần độc lập, ghi PARTIAL/BLOCKED và lệnh tái chạy. Cuối lượt tóm tắt đã sửa/còn gì/đã kiểm/rủi ro/bước tiếp.

