# Review chặng 08 — 19/10/2026

## Kết luận và phạm vi

**PARTIAL — chưa nghiệm thu tiền/tồn sách.** Chặng08 có full return, phạt theo phiếu, pending refund và confirm riêng; một số transaction caller đã được sửa. Nhưng confirm thiếu xác nhận vẫn chi, input trùng/field khác contract có thể đánh dấu sách chưa mang trả thành AVAILABLE, tiền phạt chưa tách nghiệp vụ, số dư hộp có hai nguồn lệch nhau. Không thể xác nhận đã đóng toàn bộ carryover06/07.

Review ưu tiên lỗi còn mở từ06 theo yêu cầu, đồng thời trace các lỗi07 ảnh hưởng return08. Đối chiếu prompt08 và snapshot07; snapshot đầu lượt `.review-artifacts/stage08-review-manifest.json` gồm89 file. Workspace không có Git metadata, không gắn kết luận với commit. Giả định tải dưới5.000 sách, dưới100 lượt/buổi,3–5 người nhập. Không sửa implementation, không commit/deploy/DB thật/PII thật. Không có Go thuộc phạm vi; UI không đổi nên không lặp browser review.

## Findings phải sửa

### S08-01 — P1: Bỏ trường xác nhận vẫn được ghi đã hoàn cọc

**Vị trí:** `src/server/circulation/service.ts:799–815`; router confirm1222–1233; OpenAPI confirm1201.

confirmRefund chỉ từ chối `paymentConfirmed === false`. Undefined/null/string/0 đều qua nhánh, trong khi yêu cầu bắt buộc thành viên xác nhận đã giao tiền hoặc kiểm app. Route không bổ sung guard; OpenAPI confirm không có requestBody cho confirmation/session. **Direct handler:** POST confirm với body{} và key hợp lệ trả200, allocation REFUNDED và một journal hoàn tiền được ghi. Không có bằng chứng trao tiền ngoài đời từ request này.

**Sửa:** nhận strict true, type/shape validation tại biên; tiền/phương thức/nguồn chi lấy từ intent đã chốt, actor live từ Auth, ca thực chi đúng ngày. Không default confirmation thành true để test cũ pass. **Hồi quy:** omitted/null/false/0/string đều400, không mutation; true mới chi; BANK chưa kiểm app vẫn pending; retry/multi-actor cùng intent chỉ một hiệu lực. Bỏ qua sẽ xóa nghĩa vụ phải hoàn dù người trực chưa xác nhận tiền thực.

### S08-02 — P1: Danh sách trả trùng hoặc tên field theo OpenAPI có thể trả giả cuốn còn giữ

**Vị trí:** `circulation/rules.ts:validateSettleReturnInput`; `service.ts:548–578,731–740`; OpenAPI settle-return896.

Service kiểm từng mã thuộc tập đang giữ và độ dài array, không unique/set equality. Phiếu A+B gửi[A,A] đủ length2, rồi update toàn bộ unreturnedItems, kể cả B. OpenAPI dùng returnedCopyBarcodes nhưng validator chỉ đọc returnedBarcodes/copyBarcodes/barcodes; field được tài liệu hóa bị bỏ qua, không có selector thì mặc nhiên nhận tất cả. Array rỗng/mixed selectors/returnType ngoài FULL cũng chưa có hợp đồng chặt.

**Double/direct handler:** [COPY-A,COPY-A] trả2 cuốn, B thành AVAILABLE; request theo OpenAPI returnedCopyBarcodes:[COPY-A] cho phiếu2cuốn cũng200 và B thành AVAILABLE. Không khẳng định B thực tế còn ngoài đời; phần mềm không bảo đảm danh sách được xác nhận đúng.

**Sửa:** chuẩn hóa một selector có allowlist/alias rõ, reject trùng/mixed/rỗng/field không hợp lệ; FULL là tập chính xác các dòng thực nhận, PARTIAL09 là tập con hợp lệ. Không suy “không thấy field” thành “đã nhận đủ”. UPDATE đúng dòng được xác nhận, không cập nhật is_lost/đã chuyển tiếp ngoài scope. **Hồi quy:** duplicate, alias contract, null/empty, mã lạ, receipt2 trả1 phải reject08;09 không được tạo dòng rỗng hay đánh dấu cuốn giữ đã trả vật lý.

### S08-03 — P1: Chưa thu phạt thì không ghi được đã nhận sách; phương thức thu phạt bị ép theo hoàn cọc

**Vị trí:** `service.ts:696–728`; SettleReturnParams và rules refundMethod.

Nhánh0<P<D ném FINE_PAYMENT_UNCONFIRMED nếu tiền phạt chưa xác nhận, rollback luôn returned_at và inventory. Người trực đã nhận sách vẫn bị hệ thống giữ BORROWED, trái yêu cầu nhận sách độc lập tiền. Không có trạng thái khoản phạt chờ thu hoặc use case xác nhận thu sau. Debit của phạt lấy refundMethod, nên muốn thu phạt CASH và hoàn cọc BANK không biểu diễn đúng.

**Double:** phạt1k chưa nhận tiền → lỗi và copy vẫn BORROWED. Gửi refundMethod BANK và finePaymentMethod CASH → journal phạt debit TIEN_NGAN_HANG vì finePaymentMethod bị bỏ qua. Field finePaymentMethod chưa được hỗ trợ, không phải contract đã có; đây là nhu cầu phương thức độc lập chưa triển khai.

**Sửa:** nhận sách/decision/chờ thu phạt/chờ hoàn là các trạng thái phân biệt; fine payment có phương thức, amount thực xác nhận và ý định nguồn riêng. Chưa thu thì không post thu ảo và không rollback việc nhận sách thực. **Test:** nhận sách trước/thu sau không tăng phạt sau mốc nhận; CASH fine/BANK refund và chiều ngược lại; retry/confirm hai actor; fine waive0 có lý do. Không dựng hệ công nợ tổng quát ngoài nhu cầu.

### S08-04 — P1: Kiểm đủ tiền dùng field khác nguồn journal, có thể chấp nhận chi vượt hộp

**Vị trí:** `service.ts:874–891`; `finance/deposits.ts:confirmDepositRefund`; `finance/ledger.ts:recordJournalEntry/recordReversal`; session summary.

confirmRefund mới đọc expected_closing_cash và tự trừ field; helper finance cũ/recordJournalEntry/reversal vẫn chỉ ghi journal, không duy trì field này. Summary lại tính opening+journal. Hai nguồn cho cùng số dư có thể lệch; global liability reconciliation không kiểm đủ CASH.

**Double dùng hai helper hiện có:** opening100k; hai khoản BANK cọc50k+100k; hoàn CASH50k qua finance.confirmDepositRefund → journal cash còn50k, field vẫn100k; confirmRefund mới cho chi100k → journal cash−50k, liability vẫn khớp. Đây là path composition mức service, chưa có HTTP route cho helper cũ, không là proof production bị chi âm.

**Sửa:** một nguồn chuẩn cho tiền khả dụng dưới cùng session lock; nếu materialize field thì mọi writer/reversal phải cập nhật atomic và có invariant/đối soát DB. Không vá riêng endpoint08 rồi để shared helpers lệch. Phân biệt expected/opening/snapshot close; không âm thầm sửa tiền thực đếm. **Test:** cả hai đường refund, receive/reversal/fine, CASH/BANK, thiếu tiền phải giữ pending/no journal; competing refunds không vượt tổng tiền thật; close snapshot khớp nguồn chuẩn.

### S08-05 — P2: Quyết định tất toán chỉ có ở response/audit; GET tính lại theo hôm nay và lỗi với PG DATE

**Vị trí:** `service.ts:743–789,965–1011`; schema loan_receipts/items; getLoanReceiptById.

Không có settlement row/field lưu mức phạt chốt, lý do, thời điểm nhận, trạng thái thu, số cọc chờ hoàn/đã giữ để GET tái dựng. Thông tin phần này nằm response cached/audit, nhưng GET không đọc lại nó; dùng ngày hiện tại tính gợi ý dù sách đã trả. `depositRefunded` trả số đã tạo pending intent, dễ bị hiểu là tiền đã chi. PG DATE parser trả Date, còn GET dùng String(Date) đưa vào parser YYYY-MM-DD → NaN/BigInt error.

**Double:** phiếu quá hạn3 ngày được miễn0, settle trả fineFinal0; GET không có fineFinal/settledAt, chỉ gợi ý3k. Dùng DATE parser của package pg đang cài cho due_date rồi gọi GET detail → lỗi “NaN cannot be converted to a BigInt”. Route settlement đã có exclusion khỏi generic GET nên không báo lỗi shadowing; lỗi là dữ liệu/serializer bên trong.

**Sửa:** persist settlement/source decision tối thiểu, actor/time/policy/cutoff và tiền pending/collected/forfeited; GET trả snapshot quyết định và không tăng phạt sau nhận. Chuẩn hóa DATE tại DB boundary, không chuyển ngày địa phương thành ngày UTC lệch1; field response phân biệt refundDue/pending/paid hoặc mô tả rõ. **Test:** waive0/fine49k/forfeit50k đọc lại sau reload/ngày khác; PG Date và YYYY-MM-DD cùng kết quả, UTC+7; pending→confirmed cập nhật đúng nguồn mà snapshot cũ không đổi.

### S08-06 — P1: Refund/forfeit mới đi ngoài guard nguồn nghiệp vụ của ledger

**Vị trí:** `service.ts:650–657,898–907`; `finance/ledger.ts:211–218`; `finance/deposits.ts` refund use cases.

ledger chặn direct reversal của LOAN_DEPOSIT,DEPOSIT_REFUND,FINE_FORFEIT. Return08 tạo LOAN_DEPOSIT_REFUND và LOAN_FINE_FORFEIT, nên helper recordReversal cho đảo trực tiếp hai nguồn mới mà không phục hồi allocation/intent. **Double:** forfeit50k rồi direct reversal được nhận; allocation vẫn FORFEITED, reconciliation thất bại. Chưa có route generic reversal trong runtime, nhưng shared helper đang vi phạm bất biến mà report04 từng yêu cầu chặn.

confirmRefund mới còn tự đặt remaining=0 cho mọi intent, không kiểm remaining/status hợp lệ như helper cũ; intent hoàn một phần mà finance helper hỗ trợ sẽ làm số dư allocation sai rồi reconciliation ném lỗi. Hai engine hoàn khác nhau cùng bảng/ledger không thống nhất contract/lock/order/cash guard. PENDING allocations có thể bị tạo thêm ý định khi settle; chưa có source settlement uniqueness đảm bảo lineage đúng.

**Sửa:** dùng cùng engine use case refund/forfeit hoặc danh mục source chuẩn dùng chung, deny direct reversal mọi nguồn managed; source reversal phục hồi đầy đủ hoặc bị từ chối trước mutation. Validate pending intent/allocation/remaining/method và partial/full semantics; không dựa tổng quỹ để chứng minh đúng từng allocation. **Test:** direct đảo nguồn08 bị chặn, duplicate/pending/stale intent, partial intent, amend method có audit, retry hai key/actor; rollback/reconcile/cash all match. Không thêm API bypass boolean.

### S08-07 — P2: Transaction carryover06 chưa đóng hết và ownership raw BEGIN chưa rõ

**Vị trí:** router create copy khoảng780/create borrower khoảng906; `db/client.ts:99–112`; audit helper/callers.

Open/close, update/archive copy/borrower đã bọc transaction — sửa đúng. Create copy và create borrower vẫn gọi service trực tiếp với Pool, mutation và audit commit rời. Lỗi audit sau INSERT vẫn có thể tạo dữ liệu dù response500. Không gọi “mọi mutation đã bọc”. Helper đã không reconnect pg.Client nữa và hỗ trợ nested do chính nó đánh dấu; raw client đã BEGIN ngoài helper không có __in_tx, bị BEGIN/COMMIT thêm. **Queryable trace:** BEGIN→BEGIN→COMMIT, commit cả outer; chưa có caller runtime hiện ghép raw BEGIN+helper, nên phần này là contract limitation cần làm rõ, không báo production bug đã xảy ra.

**Sửa/test:** áp transaction đủ các mutation đang có; ownership typed rõ, không ngầm đoán transaction tồn tại từ cờ riêng nếu API cho nhận client bất kỳ. Chỉ hỗ trợ entry contract cần dùng; test Pool/Client/PoolClient/callback/audit/commit failures, không release/commit hộ owner ngoài. Ghi limitation nếu cấm raw outer thay vì dựng savepoints không cần thiết.

### S08-08 — P2: Calendar, snapshot, xác nhận amount và policy quỹ còn bị tự coi là xong

**Vị trí:** issue service173–190, get receipt338–388; effectiveDueDate rules; forfeit/fine service; docs06 policy mở.

confirmedAmount đã có nhưng optional; bỏ field vẫn qua luồng boolean nên S07-04 chưa được khóa. Giá bìa/policy/căn cứ snapshot vẫn không được persist (DDL không đổi), GET còn join metadata hiện tại. calculateEffectiveDueDate có tham số holidays nhưng issue không truyền hoặc đọc nguồn lịch nghỉ, không lưu originalDueDate/reason/version; ca open không kiểm ngày. Phạt08 dựa due_date này nên nghỉ lễ thực chưa được áp dụng.

Policy quỹ nhận phạt/giữ cọc vẫn là câu hỏi mở trong docs06; service tự hardcode FUND_LOAN/FINE_REVENUE, progress lại nói chuyển sang quỹ hoạt động. Không có quyết định người dùng mới trong hội thoại để khóa policy đó. Không được đổi quỹ âm thầm hoặc coi fixture là phê duyệt nghiệp vụ.

**Sửa/test:** confirmed amount/quote ràng buộc thực; source lịch ngoại lệ và snapshot date/price/policy tối thiểu, DATE serializer; quỹ policy explicit, chưa chốt thì gate vận hành BLOCKED và tiếp tục phần độc lập. Không bắt user quyết định lại các quy tắc đã chốt. Kiểm quote drift, holiday thực cấu hình, metadata đổi, ngày ca không hợp lệ, ledger phân quỹ đúng policy được chọn.

### S08-09 — P2: Tests PG không khớp schema/cọc; coverage không đủ cho nhãn PASS

**Vị trí:** `tests/integration/return-loan.test.ts:setupReturnTestData và các test`; issue/cash fixtures; progress25/26; OpenAPI/rules validation.

Return fixture dùng location='KE_01' ngoài enum KHO_THU_VIEN/KHO_HOI_SINH_VIEN/BAN_TRUC_TAM. Copy75k cọc100k và150k cọc150k, nhưng test xác nhận tổng125k (comment50+75) và cọc cuốn75k là50k; guard amount sẽ từ chối sau khi sửa enum. Opening1triệu khác seed350k thiếu giải trình; force-close test trước chỉ set is_closed/closed_at, không actual, rồi mở cùng ngày xung đột guard. Bộ mới4 test tuần tự, không có true PG confirm/settle races, fault sau audit/cache, mất response. Không thể gọi tests hoàn chỉnh/sẵn sàng vì thiếu runtime che những lỗi fixture.

Unit dùng ID/method/source mô phỏng, không thi hành đủ enum/FK/DATE; mapping UPDATE refund_intents của SQL double vẫn lệch bind vị trí với confirm mới. Test full/selectors không có duplicate/field theo OpenAPI; confirm thiếu flag lại được dùng như thuận lợi ở integration. Mức80 pass không chứng minh mọi boundary đúng. Validation cũ từ06 như fullName123/body null/UUID/safe money/catalog CRUD/date nhập/review metadata vẫn chưa đủ. Title/edition/borrower/catalog files không đổi trong08 nên không đóng carryover chỉ bằng report mới.

**Sửa:** fixture trung lập đúng schema/policy/amount, unique buổi và predecessor có actual/reason; không force-close không snapshot chỉ để qua. PG test production use case hai connection có blocking assert/deadline/cleanup, app-role grants, fault/retry. Contract tests dùng fields/body/docs thật và parser PG, sửa SQL double binds nếu tiếp tục dùng. Tách source/unit/handler/PG/Workers/provider, bỏ “triệt để100%/ACID hoàn chỉnh”. Không thêm enum/cột/đổi công thức cọc để hợp fixture sai.

## Đối chiếu lỗi còn mở từ chặng06

| Finding06 | Kết quả review08 |
|---|---|
| S06-01 transaction | Đã bọc thêm session/update/archive; create copy/borrower còn S08-07, cash/reversal engine S08-04/06 |
| S06-02 đảo cọc ca đích/legacy |07 đã truyền targetCashSessionId và reject nhiều legacy row; giữ hướng sửa. PG/rollback/source invariants chưa nghiệm thu; nguồn08 mới còn S08-06 |
| S06-03 audit | Có audit tại mutation nhưng create không atomic; quyết định settlement chưa có read model riêng S08-05/07 |
| S06-04 giá0 | Source07 giữ0 khácNULL,08 không sửa lại. Test PG create→read chưa chạy, không gọi đã nghiệm thu DB |
| S06-05 archive OVERDUE | Query07 đã bảo vệ OVERDUE/dòng/cọc còn giữ; race/app-role chưa kiểm. PARTIAL_SETTLED terminal label cũ có thể chặn archive dù hết nghĩa vụ, cần xử lý cùng09 |
| S06-06 validation | Một số rule issue đã chặt hơn; confirm true guard, return selector, object/type/UUID/safe bounds còn S08-01/02/09 |
| S06-07 catalog CRUD | Có create title/edition từ07; edit associations/date nhập/review state vẫn chưa đủ, không có source đổi trong08 để đóng |
| S06-08 unique buổi/predecessor | Source có check ngày/predecessor, DDL chưa unique theo buổi; custodian/runtime/race chưa chứng minh |
| S06-09 tests/contracts/evidence | Seed closed và writer test tốt hơn; fixture08/input/DATE/grants/runtime còn S08-09; không đóng toàn bộ |

## Đối chiếu chặng07

S07-01 caller: cải thiện một phần, còn S08-07; S07-02 reconnect: đã sửa nhánh cụ thể, ownership raw/nested còn giới hạn; S07-03 issue selectors: đã reject mixed/invalid, nhưng return mới mắc tương tự S08-02; S07-04 amount: optional nên chưa đóng; S07-05 BANK: issue đã gắn ca và GET truy nguồn, PG chưa chạy; S07-06 price/policy snapshots vẫn thiếu; S07-07 calendar holidays chưa nối source; S07-08 fixture/test proof còn sai; S07-09 aliases/error cache có cải thiện, validation/catalog/contract chưa đủ. Auth03/provider/grants/rate-limit/Origin không tự pass từ RBAC unit08.

## Kiểm tra thực hiện

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;53 file;0 error,0 warning,16 hint;tsc pass | Source/type |
| Astro build `.review-artifacts/stage08-build` | Exit0;3 trang static | Không backend Workers |
|10 unit files, isolation none | Exit0;80 pass,0 fail | SQL double/direct handler, có wrapper file không khai báo test |
| Python unittest discover | Exit0;22 pass | PoC/regex |
| Redocly2.64.1 lint | Exit0;0 error,23 warnings | Chưa parity semantic/input |
|7 DB files, isolation none/concurrency1 | Exit1;34 test bị before-hook DB_RUNTIME_MISSING |0 assertion PG nghiệm thu |
| Docker/PATH/env | Daemon pipe unavailable; psql/postgres không PATH; TEST_DATABASE_URL không cấu hình | Không thao tác DB thật/cloud |
| Wrangler local8796 | Exit1;launcher spawn EPERM | Chưa kiểm Workers HTTP |
| Counterexamples08 | Exit0; JSON phản ví dụ |0 external request,0 real DB write |

Script/JSON: `.review-artifacts/stage08-counterexamples.mjs` và `.json`. PG DATE parser của dependency thật được dùng nhưng không có PG server. Cash overdraft tái hiện composition helper hiện có, không là UI exploit. Raw outer trace là contract scenario, không khẳng định caller runtime đã dùng. Generic GET đã loại /settlement nên route này tiếp cận được với string-date fixture; không gán lỗi shadowing sau khi đọc lại source.

## Bàn giao

[Prompt09](../prompts/antigravity-next/09-partial-return.md) gồm sửa S08-01..09 và carryover06/07 còn liên quan, sau đó partial-return/carry-forward. Không dùng returned_at giả để giải phóng unique active copy, không xóa unique index; ledger transfer không tạo CASH/BANK giả. Giữ22 chặng; runtime thiếu thì PARTIAL/BLOCKED, domain độc lập tiếp tục được.

**Chưa kiểm:** PostgreSQL thật, provider, application-role grants, Workers HTTP, mobile, ngân hàng, load/penetration/restore. Implementation không bị sửa trong lượt review; chưa đủ dùng tiền/PII thật.
