# Review chặng 10 — 19/10/2026

## Kết luận và phạm vi

**PARTIAL — sửa các lỗi tiền, lịch và schema dưới đây trước nghiệm thu.** Chặng10 thêm gia hạn/lịch sử, lịch nghỉ, xác nhận cọc T73 và thu phạt chờ thu; đã sửa thứ tự active hold của partial, thêm enum pending và chặn mapping cọc bị thiếu. Nhưng cả renew và confirm-deposit ghi cột không tồn tại; thu phạt nhiều đợt trùng mã journal; lịch nghỉ mới không được áp vào phiếu đang mượn. Không đóng cả S09-01..09 bằng nhãn “triệt để”.

Đối chiếu prompt10, review09 và các lỗi cũ liên quan. Không có `.git`; dùng manifest09 và snapshot đầu review10 `.review-artifacts/stage10-review-manifest.json` (116 file), không gắn kết luận với commit. Tải dự kiến dưới5.000 sách, dưới100 lượt/buổi,3–5 người ghi. Không sửa implementation, commit/deploy, DB hoặc PII thật; không có Go trong phạm vi. UI source không đổi nên không lặp kiểm UI để nhận backend đã nghiệm thu.

## Lỗi bắt buộc sửa

### S10-01 — P1: Renew và confirm-deposit cập nhật cột loan_receipts.updated_at không tồn tại

**Vị trí:** `src/server/circulation/service.ts:1631–1635,1871–1874`; `docs/technical/schema/01_schema.sql:161–173`; migration02.

**Vấn đề:** cả hai use case UPDATE updated_at=NOW(), nhưng loan_receipts chỉ có created_at; migration không ALTER thêm updated_at. Với schema được giao, PostgreSQL sẽ trả42703. Gia hạn không có tiền cũng lỗi; confirm cọc đã UPDATE allocation/INSERT journal trước đó rồi phải rollback, không thể kích hoạt pending receipt.

**Bằng chứng:** đối chiếu DDL/migration và SQL adapter áp điều kiện cột hiện có: renew handler500/count rollback0; confirm-deposit42703/receipt còn PENDING_DEPOSIT. Đây là mô hình kiểm DDL, chưa phải chạy PG server. Mock gốc chỉ nhận diện các đoạn SQL nên107 kết quả xanh không bắt lỗi.

**Sửa:** bỏ cập nhật cột thừa nếu không cần, hoặc thêm cột bằng baseline và migration tiến tới nhất quán. Không chỉ nới mock. **Hồi quy:** fresh và upgrade DB thật cho renew/confirm, fault sau journal trước đổi receipt, chứng minh money/hold/cache/audit rollback cùng transaction. Nếu bỏ qua, hai chức năng chính10 chưa chạy trên schema thật.

### S10-02 — P1: Thu phạt nhiều đợt trùng entry_code, response báo đã thu hết khi còn thiếu

**Vị trí:** `service.ts:1952–2083`; schema journal_entries.entry_code UNIQUE tại330.

**Vấn đề:** API cho amount nhỏ hơn pending, nhưng mọi lần dùng `JE-FINE-${receipt_number}-COLLECT`. Khoản phạt5k thu2k trước thì DB còn3k/statusPENDING, response lại fineStatusCOLLECTED. Thu3k tiếp theo đụng unique23505 và rollback. Nhiều kỳ phạt renewal trên cùng phiếu cũng dùng chung mã. API chỉ nhận receiptId rồi tìm khoản PENDING mới nhất, không chọn nguồn cụ thể: retry với key khác có thể trỏ sang kỳ phạt khác sau khi kỳ trước đã thu xong.

**Bằng chứng:** double + adapter unique entry_code: lần1 responseCOLLECTED nhưng pending3000; lần2 bị23505, pending vẫn3000. Các kiểm sau lỗi S10-01 được cô lập bằng mock cho phép cột để xét hành vi độc lập.

**Sửa:** mỗi lần thực thu có collection ID/mã nguồn riêng liên kết decision/kỳ phạt cụ thể, amount và remaining/status thật; stable business intent để key mới không tự đổi mục tiêu. Không random mã journal đơn thuần rồi mất chống thu trùng, không bỏ unique hoặc tự gộp mọi kỳ nợ. **Hồi quy:**5k→2k→3k, hai kỳ renewal + settlement, hai actors/keys, retry/lost response, amount mismatch và cùng key khác source; journal/liability/summary đúng một lần.

### S10-03 — P1: Thêm lịch nghỉ không dời hạn phiếu đang mượn, vẫn phạt vào ngày CLB nghỉ

**Vị trí:** `service.ts:2107–2137,680–684,1553–1569`; receipt schema/read DTO.

**Vấn đề:** addCalendarHoliday chỉ upsert holiday và audit. Due_date của phiếu hiện hữu không đổi; return/renew tính overdue từ due_date lưu sẵn, không áp lịch mới trước xác định phạt. Trường hợp thêm lịch nghỉ sau ngày mượn đã được prompt10 yêu cầu xử lý. Chưa có version lịch, hạn gốc/căn cứ điều chỉnh trên receipt hay workflow cập nhật active deadlines.

**Bằng chứng:** phiếu mượn01/10 hạn15/10; thêm nghỉ15/10 thì helper tính hạn20/10, GET vẫn15/10. Trả19/10 gợi ý4k dù chưa đến buổi trực được dời. SQL double, không PG runtime.

**Sửa:** dùng chung quyết định hạn gốc/hiệu lực và phiên bản lịch; áp lịch mới cho active loans có audit/concurrency contract, không viết lại settlement đã đóng hoặc phạt hồi tố. Không cộng14 từ ngày gọi chỉ để “sửa” hạn do nghỉ. **Hồi quy:** issue→thêm nghỉ trước hạn→GET/renew/return, hai lần đổi lịch không cộng dồn sai, calendar-vs-renew/return, VN midnight; không loại mọi ngày không trực khỏi ngày phạt (T3→T5 vẫn2k).

### S10-04 — P2: Thu tiền BANK ở các endpoint mới bỏ qua phiên trực, kể cả phiên chỉ định đã đóng

**Vị trí:** `service.ts:1488–1513,1774–1798,1916–1940`; journal writers phía sau.

**Vấn đề:** chỉ CASH mới đọc/lock cashSessionId. BANK có thể ghi nhận với sessionNULL, bỏ qua cả sessionId caller cung cấp. Điều này lùi sửa07 về truy vết cả hai phương thức theo buổi; thu ngân hàng không tăng hộp tiền nhưng vẫn phải thuộc buổi/nguồn hợp lệ.

**Bằng chứng:** overdue5ngày, BANK confirmed với session đã đóng vẫn thu5k, journal.cash_session_idNULL. Điều kiện ledger chỉ bắt session bắt buộc cho CASH nên không cứu được caller mới.

**Sửa:** khi có tiền, resolve/lock buổi phù hợp cho CASH và BANK, reject buổi chỉ định đóng/không tồn tại; không bắt mở ca cho gia hạn trong hạn không có thu tiền nếu không cần. **Hồi quy:** cả renew/confirm-deposit/collect-fine, BANK/CASH, ca đóng/missing/explicit/wrong-date theo contract và close race; BANK có nguồn ca, cash delta0.

### S10-05 — P2: JSON lỗi bị biến thành yêu cầu gia hạn hợp lệ; chưa phân biệt retry với hành động mới

**Vị trí:** `src/server/router.ts:1288–1298,1365–1375,1416–1426`; `rules.ts:583–699`.

**Vấn đề:** request.json().catch(()=>({})) rồi spread body làm mất lỗi parse/type gốc; renew không cần field bắt buộc ngoài path nên body `{` vẫn tăng lượt. Array/null cũng bị biến thành object trước validator. Chỉ key HTTP chặn retry cùng key; chưa có stable action/expected version để phân biệt cùng ý định với yêu cầu gia hạn tiếp khi key đổi như prompt10 yêu cầu. Không kết luận mọi hai lần gia hạn sớm là sai: hai ý định hợp lệ vẫn được phép, thiếu contract nhận diện.

**Bằng chứng:** ba request body `{` với ba key trả200/200/200, tiêu đủ3lượt trong mock/direct handler. Sau sửa S10-01, lỗi validation này vẫn độc lập. Các validators tiền dùng Number.isInteger thay vì safe integer và coercion/stringify rộng; ID chỉ non-empty, các UUID sai có thể rơi xuống PG.

**Sửa:** parse/validate JSON object ở HTTP boundary trước spread/claim/mutation, malformed/type sai trả400; giữ path trong payload hash (đã làm đúng). Thêm action ID/version tối thiểu theo pattern hiện có, không dựng framework mới. Safe integer VND, UUID/type/length/bounds theo schema; server giữ quyền tính tiền/ngày. **Hồi quy:** malformed/null/array/string/invalidUUID/oversize/unsafe amounts, cùng action khác key không mất lượt; hai action thật serialize và vẫn cap3; source/key mismatch409 trước ghi.

### S10-06 — P1: Tự mở nhánh gia hạn chưa chốt policy và thu phạt vượt cọc

**Vị trí:** `service.ts:1580–1623`; `tests/unit/circulation-renew.test.ts:395–450`; prompt10 mục3.3.

**Vấn đề:** prompt10 đã giữ gate cho gia hạn khi tiền phạt còn pending và khi P>=D nhưng tiếp tục giữ sách. Implementation tự cho tăng hạn/count với finePending và thu toàn bộ fineFinal khi confirmed, không đọc cọc hay xử lý cap/forfeit. Phiếu cọc50k quá60ngày thu60k tiền phạt và vẫn giữ nguyên cọc. Quy tắc phỏng vấn không thu vượt cọc; cách tiếp tục giữ cùng receipt sau forfeit chưa được xác nhận, không được tự chọn “thu đủ P”. Test mới khẳng định pending renewal là policy thay cho quyết định chủ sản phẩm.

**Bằng chứng:** mock renew cọc50k, quá60ngày, confirmed true→thu60k/count1. Chưa có quyết định mới trong tài liệu đóng gate; hardcode FUND_LOAN cũng không phê duyệt được nơi ghi nhận tiền phạt.

**Sửa:** ghi policy gate rõ cho nhánh chưa chốt, không thu tiền hoặc tăng lượt/hạn ở nhánh đó; tiếp tục các nhánh đã rõ như trong hạn, miễn có lý do, thu phạt dưới cọc đã xác nhận. Không tự áp T73 partial sang renewal hoặc thu thêm cọc. Khi có quyết định mới mới mở nhánh với test cap/source/watermark. **Hồi quy:** P<D/P=D/P>D, pending/waived/confirmed và return sau renewal không thu lại kỳ đã chốt.

### S10-07 — P1: Migration gán COLLECTED/0 cho khoản phạt09 chưa thu

**Vị trí:** `docs/technical/schema/migrations/02_stage10_renewal_and_carryover.sql:59–60`; `tests/integration/db-harness.ts:206–214`.

**Vấn đề:** DB09 có fine_final/fine_collected nhưng chưa có fine_pending_amount/fine_status. Migration thêm cột default0/COLLECTED cho mọi row, không backfill. Một settlement09 fine_final3k, fine_collected0, deposit_forfeited0 sau upgrade sẽ mang pending0/statusCOLLECTED; collectPendingFine tìm PENDING nên không thu được. Không được backfill đơn giản fine_final-collected cho mọi row vì forfeited phải xét tiền đã giữ và policy.

**Bằng chứng:** phép biến đổi trực tiếp từ DDL defaults và predicate collection; chưa chạy migration trên PG. Test mới chỉ apply current baseline rồi migration, không tạo dữ liệu từ schema09/08 trước upgrade, nên không kiểm sự kiện này.

**Sửa:** migration/backfill có căn cứ cho unpaid/waived/direct-collected/forfeited, đối soát ambiguous legacy và giữ gate cần xử lý; không suy sinh khoản phải thu giả cho cọc đã forfeit. Runner cần thứ tự/boundary rõ, kiểm dữ liệu trước thay index và trạng thái khi chạy lại. **Hồi quy:** disposable DB09 có các khoản pending/thu đủ/giữ cọc → upgrade → đọc/thu tiếp đúng, row counts/journal/history giữ nguyên; fresh cũng chạy được.

### S10-08 — P2: Snapshot và đối chiếu tiền mới từ07/09 vẫn chưa được triển khai

**Vị trí:** `service.ts:194–201,360–405,1833–1858`; `types.ts` DTO/params; receipt/item schema.

**Vấn đề:** GET coverPrice vẫn JOIN giá catalog hiện tại; depositBasis/policyVersion/originalDueDate chỉ là field optional, chưa lưu/đọc snapshot nghiệp vụ đầy đủ. confirmedAmount issue vẫn optional; confirmNewDeposit chỉ strict true và lấy original_amount DB, không đối chiếu amount/quote tiền thành viên thực kiểm. Partial newDepositConfirmed giờ tách flag là sửa đúng, nhưng finePaymentConfirmed vẫn fallback paymentConfirmed chung.

**Bằng chứng:** mượn giá50k, đổi catalog999k, GET phiếu cũ trả coverPrice999k. Không nói deposit_snapshot đã đổi: cọc snapshot vẫn được giữ. Mã xác nhận cọc chưa có amount trong input/validator. Snapshot quyết toán và renewal history đã có không thay price/policy/calendar snapshot còn thiếu.

**Sửa:** lưu và trả các căn cứ lịch sử tối thiểu cần đối soát; phân biệt metadata hiện tại. Khoản tiền mới cần amount/quote/source/xác nhận riêng, mismatch conflict trước journal; không tự tính client amount làm chuẩn. **Hồi quy:** catalog/policy đổi sau lập phiếu, nullable/0 giá, thiếu/sai amount/quote, replay; không overwrite chứng từ cũ.

### S10-09 — P2: Carryover/runtime vẫn mở; nhãn PASS vượt bằng chứng và fixtures vẫn chưa chạy qua

**Vị trí:** progress31–33/README; `tests/integration/renew-loan.test.ts:27–93`; fixtures issue/return/partial; cash source/lineage helpers.

**Vấn đề:** G-carryover PASS và “snapshot bất biến/hợp nhất nguồn tiền” chưa đúng. Mới2 renewal PG tests tuần tự, không có hai connection lượt cuối/renew-vs-return/calendar/close, fault/lost response hay upgrade dữ liệu cũ. Các fixture đã ghi actual khi force-close là tốt nhưng seed ca đóng350k, opening500k/1triệu vẫn thiếu discrepancyReason khi open; các test sau mở cùng ngày vẫn bị SESSION_DATE_ALREADY_EXISTS. Do DB missing, chưa chạy tới các lỗi fixture và S10-01.

**Carryover còn cụ thể:** confirmRefund vẫn dùng min(field,journal) tại1293; recordJournalEntry chưa thống nhất cập nhật cash, các caller tự update. Ví dụ receive→refund cũ đã được sửa và chạy lại pass, không lặp báo lỗi đó còn nguyên. GET lineage dùng LEFT JOIN một cấp tại385–387, chưa chứng minh nhiều cấp/ca nguồn khác nhau; shared transferDeposit chưa ghi transferred_from_allocation_id. Coverage partial chỉ kiểm tồn tại hai allocation sau vài mutation (rollback nếu caller TX), chưa xác nhận coverage/remaining cho renew/fine hoặc reject amount thiếu so snapshot. Pending deposit sau trả lại sách chưa có cancel workflow; không được tự thu cọc từ terminal receipt. Các gate03/05/06/07 dưới đây chưa đóng.

**Sửa/test:** báo từng gate source/unit/direct-handler/PG/app-role/Workers/provider riêng; sửa fixture theo contract thật, không bỏ guard buổi/bàn giao. PG current+upgrade, assertions overlap/deadline/cleanup và fault/recovery; mock phải kiểm cột/unique quan trọng hoặc nêu giới hạn. Diagram06 có cập nhật source renewal/partial nhưng tên carried_from khác preceding_receipt_id; SVG hiện chưa có loan_renewals nên chưa khớp source. Đồng bộ source/render/contract, không gọi vẽ sơ đồ là runtime proof. Không tự đóng các lỗi khác chỉ vì unit tăng từ93 lên107.

## Đối chiếu S09 và các chặng trước

| Finding09 | Kết quả tại10 |
|---|---|
| S09-01 active hold | Đã sửa UPDATE old carried_forward_at trước INSERT new item; mock cũng thêm unique hold. Giữ sửa; PG lifecycle/concurrency còn BLOCKED |
| S09-02 pending enums/finalize | Enum/types đã đồng bộ, có confirm-deposit. Chưa hoàn tất do S10-01/04/08 và cancel/recovery pending |
| S09-03 thu phạt pending | Có API/read finePendingAmount/fineStatus ở settlement/history; chưa hoàn tất S10-02/07, thiếu miễn/điều chỉnh pending có nguồn rõ |
| S09-04 allocation mapping | Partial missing mapping giờ ném AllocationCoverageError, rollback nếu cùng TX; chưa đủ state/amount/renew/fine coverage, legacy ambiguity còn gate |
| S09-05 migration | Có migration tiến tới columns/index/enums; chưa đủ S10-01/07 và chưa test upgrade PG |
| S09-06 cash source | Shared receive/refund/reversal đã update field; counterexample receive50k→refund50k nay pass. min vẫn còn và mọi writer/caller chưa thành một nguồn chuẩn |
| S09-07 lineage | DTO đã trả precedingReceiptId/carriedForwardAt/successorItemId; allocation có transferred_from và lookup một cấp. Không đóng nhiều cấp/shared transfer/ca nhận–chuyển–hoàn đầy đủ |
| S09-08 amount/snapshots/calendar/policy | Flag cọc mới tách riêng, lịch helper bounds/invalid dates tốt hơn. Snapshot/amount/calendar active/policy còn S10-03/06/08 |
| S09-09 tests/gates | Actual snapshot close đã thêm; fixtures bàn giao/ngày, PG upgrade/concurrency/recovery và nhãn PASS vẫn S10-09 |

| Nguồn cũ | Phần còn mở liên quan |
|---|---|
|02 schema/invariants | PG fresh/upgrade/max2/unique/concurrency chưa nghiệm thu; không suy từ regex/model DDL |
|03 Auth/security | Managed provider/token lifecycle/multi-instance, app-role grants, Origin/CSRF/body limits/rate limits và Workers HTTP chưa nghiệm thu; RBAC direct handler là bằng chứng riêng |
|04 journal/idempotency | Managed-source guards giữ đúng; số dư cash, collection source/intent, correction và PG rollback/lost response còn mở |
|05 cash session | Buổi/custodian/handover/close race còn gate; fixture và min không thay invariant thực |
|06 catalog/borrower | Giá0 và transaction wrappers giữ sửa; title/edition/author/category/date nhập/review metadata/validation chưa hoàn thiện. Borrower/copy carry predicate đã cải thiện, không hoàn nguyên |
|07 issue/receipt | BANK source ở issue giữ sửa; amount optional và lịch sử giá/policy chưa đóng |
|08 full return | Strict refund/selectors/managed reversal/settlement DATE giữ sửa; fine pending/cash/PG còn như bảng09 |
|UI R09/R10 | UI chưa đổi và chưa nối backend; chặng12 vẫn cần runtime test quầy, không đóng bằng unit backend |

Không kéo toàn bộ chức năng13–22 vào11. Lỗi03/06 nằm ngoài lát báo mất có thể tiếp tục ghi PARTIAL/BLOCKED theo đúng phạm vi; lỗi tiền/schema dùng chung phải sửa trước khi tái dùng cho mất/đảo.

## Kiểm tra thực hiện

| Kiểm tra | Kết quả mới | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;57 files;0 errors,0 warnings,16 hints;tsc pass | Không kiểm SQL runtime |
| `rtk pnpm run build --outDir .review-artifacts/stage10-build` | Exit0;3 static pages,2.74s | Không Workers/API runtime |
|12 unit files, `--test-isolation=none` | Exit0;107 pass,0 fail,605.54ms | SQL doubles/direct handlers; có wrapper file không khai báo test |
| Python unittest discover | Exit0;22 pass,0.027s | PoC/regex, không PostgreSQL |
| Redocly2.64.1 lint | Exit0;0 errors,22 warnings | Chưa semantic parity |
|9 integration files, isolation none/concurrency1 | Exit1;39 before-hook DB_RUNTIME_MISSING,0 pass | Không assertion nghiệp vụ PG chạy |
| Docker/PATH/env | Docker daemon pipe missing; postgres/psql không PATH; TEST_DATABASE_URL absent | Không dùng DB/cloud thật để lách gate |
| Wrangler local8796 | Exit1;launcher spawn EPERM | Chưa Workers HTTP |
| Counterexamples10 | Exit0 | SQL doubles/direct handler + DDL adapters;0 network,0 real DB write |

Counterexamples tại `.review-artifacts/stage10-counterexamples.mjs` và `.json`. Adapter cột/unique mô hình hóa ràng buộc thật từ DDL, không phải PG execution. Các lỗi phía sau S10-01 được kiểm độc lập bằng SQL double gốc cho phép cột để tránh lỗi đầu che lỗi khác. UI không đổi; Auth provider/app-role grants/production/UAT không chạy.

## Bàn giao

Prompt [11 — Báo mất và sửa sai chứng từ](../prompts/antigravity-next/11-lost-book.md) sửa S10-01..09 liên quan trước, rồi thêm loss/correction dựa trên nguồn nghiệp vụ hiện có. Giữ22 chặng; dừng tại11, không tự chạy UI12 hoặc deploy. Policy chưa chốt phải giữ gate riêng; không dùng test mới như quyết định nghiệp vụ.
