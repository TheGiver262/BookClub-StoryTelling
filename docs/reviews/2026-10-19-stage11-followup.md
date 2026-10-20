# Review chặng 11 — 19/10/2026

## Kết luận và phạm vi

**PARTIAL — chưa nghiệm thu mất sách/sửa sai hoặc cho quầy dùng tiền thật.** Chặng11 thêm reportBookLoss/createDocumentCorrection, sửa cột updated_at, parsing JSON ở các endpoint mới, BANK session và áp holiday vào active loans. Tuy nhiên correction mở đường bypass managed sources, tự ghi tiền thực khi chưa xác nhận; mã thu phạt vượt chiều dài cột; mapping mất sách và luồng trả sau mất còn sai. Cần sửa S11-01..10 trước hoặc cùng lát nối UI12.

Đối chiếu prompt11, review10 và nguồn liên quan các chặng trước. Workspace không có `.git`, không gắn với commit; manifest đầu review11 `.review-artifacts/stage11-review-manifest.json` gồm120 file, so thay đổi với manifest10. Tải tham chiếu dưới5.000 sách, dưới100 lượt/buổi,3–5 người ghi. Không sửa implementation, commit/deploy/DB/PII thật; không Go thuộc phạm vi. UI source không đổi, các lỗi UI cũ được đối chiếu source, không nhận đã kiểm browser lại.

## Lỗi cần sửa trước nghiệm thu

### S11-01 — P1: Correction bypass mọi managed source, đảo journal mà không phục hồi nguồn nghiệp vụ

**Vị trí:** `src/server/finance/ledger.ts:518–548`; `src/server/router.ts:1562–1591`.

**Vấn đề:** route nhận arbitrary originalEntryId; createDocumentCorrection luôn gọi recordReversal với allowDirectSourceReversal=true. Chỉ LOAN_DEPOSIT/LOAN_DEPOSIT_NEW được kiểm allocation HELD rồi VOIDED; không đồng bộ copy/receipt hoặc kiểm nguồn phụ thuộc đầy đủ. Refund/forfeit/fine/carry sources còn lại đều qua bypass, không phục hồi allocation/intent/settlement/collection. Guard managedSources cũ vẫn tồn tại nhưng route mới vô hiệu hóa mục đích của guard.

**Bằng chứng:** double: reverse confirmed refund khiến allocationREFUNDED/intentCONFIRMED giữ nguyên nhưng liability journal tăng; assertLiabilityReconciliation thất bại. Reverse loss forfeit cũng giữ copyLOST/receiptLOST/allocationFORFEITED nhưng liability tăng và lệch. Reverse deposit HELD để receiptACTIVE/copyBORROWED trong khi cọcVOIDED. Lỗi domain được cô lập bằng mock; reversal mã loss còn bị giới hạn cột S11-03 trên DB thật.

**Sửa:** correction theo loại chứng từ nguồn, reject managed source chưa có workflow phù hợp; internal bypass chỉ được dùng sau khi lock/validate/điều chỉnh nguồn cùng transaction. Không thêm endpoint đảo journal tùy ý. **Test:** receive/refund/forfeit/fine/carry/renewal có nguồn và dependency trước/sau, reconciliation và hold đúng; conflict khi nguồn sau đã commit, hai actors/retry/fault. Bỏ qua sẽ có Nợ=Có nhưng nghĩa vụ/cọc/sách sai.

### S11-02 — P1: Sửa sai chưa xác nhận tiền thực vẫn ghi thu/chi và cập nhật hộp tiền

**Vị trí:** `ledger.ts:402–407,453–516,540–548`; DocumentCorrectionParams và OpenAPI correction body.

**Vấn đề:** chỉ cần originalEntryId/reason là đảo cả cash/bank; không amount/quote/paymentConfirmed, không intent pending. Kiểm đủ cash không chứng minh tiền đã giao khách. BANK correction còn bỏ session mặc dù source có buổi, ghi ngược ngân hàng không xác nhận app. Không thể suy “sửa sai” luôn đồng nghĩa đã thực chuyển tiền.

**Bằng chứng:** direct handler MEMBER gửi correction khoản cọc50k thiếu confirmation trả200, expected cash250k→200k, receipt vẫnACTIVE/copyBORROWED. Không có network/ngân hàng thực xảy ra trong test.

**Sửa:** tách quyết định correction khỏi thực thu/chi. Nếu có tiền phải có source/amount/method/ca/strict confirmation; chưa thực hiện giữ pending, GET/retry/cancel được. Correction bookkeeping không có tiền phải giữ đúng cash/bank thực và căn cứ, không tự chế journal đối ứng không hợp lệ. **Test:** missing/null/false/string flags, amount stale, CASH/BANK, ca sau/đóng, đủ/thiếu cash, lost response; chưa confirm không giảm/tăng tiền. Đây là điều kiện bắt buộc trước UI “sửa sai”.

### S11-03 — P1: Mã thu phạt dài48 vượt VARCHAR(40); mất lần hai trùng mã, mã đảo cũng quá dài

**Vị trí:** `service.ts:2126–2139,2415–2419`; `ledger.ts:540–544`; schema journal_entries.entry_code tại330.

**Vấn đề:** receipt chuẩn21ký tự, mã `JE-FINE-{receipt}-{target8}-COLLECT-1` dài48, DB từ chối22001 ngay lần thu đầu. Loss dùng một mã `JE-FORFEIT-{receipt}-LOST` cho cả phiếu, mất A rồi mất B đụng23505. Prefix REV- cho loss code37 thành41 cũng vượt cột40. Sequence COUNT đã chữa trùng code cũ ở mock nhưng chưa đáp ứng schema thật.

**Bằng chứng:** adapters lấy VARCHAR40/UNIQUE từ DDL: collection48→22001/pending vẫn5k sau rollback; reverse loss41→22001; mất cuốn thứ hai→23505/cuốn B vẫnBORROWED. Không gọi đó là thực thi PG.

**Sửa:** mã có bound và ID/source event thực phân biệt từng collection/loss/correction; giữ uniqueness và retry cùng business intent. Không cắt chuỗi tùy ý gây collision, không chỉ đổi random code rồi mất chống thu trùng. Nếu đổi schema phải có migration/contracts. **Test:** mã receipt thật, UUID nguồn thật, nhiều đợt5k→2k→3k, hai lần mất cùng phiếu, reversal nguồn dài tối đa, PG length/unique và rollback/lost response.

### S11-04 — P1: Báo mất lấy cả cọc receipt-level và tiêu trạng thái không hợp lệ

**Vị trí:** `service.ts:2365–2408`.

**Vấn đề:** query lấy allocation item_id thuộc sách mất OR item_idNULL, không kiểm coverage/phân bổ rõ. Mất A có thể giữ cả cọc chung của A+B. Tổng chỉ tính HELD/PENDING_REFUND nhưng UPDATE FORFEITED mọi allocation lấy ra, kể cả pending collection/voided/transferred/refunded; refund intent pending không được cancel/lock. Không assert reconciliation cuối loss hoặc kiểm mapping trước inventory mutations.

**Bằng chứng:** fixture hợp schema có cọc chung150k receipt-level, A snapshot50k/B100k. Mất A→forfeit150k, B vẫnBORROWED nhưng không còn cọcHELD. Không kết luận dữ liệu thật hiện có cấu trúc này: đây là legacy/source mapping được schema/helper cho phép, cần reject hoặc phân bổ có căn cứ.

**Sửa:** coverage/state/remaining/source mapping chính xác cho từng item; ambiguous receipt-level reject trước mutation hoặc migration có căn cứ, không đoán theo amount. Pending refund chưa chi cần source transition/cancel đồng bộ; tiền đã hoàn/cọc chưa nhận không thể forfeit. **Test:** NULL/missing/multiple/pending/refunded/transferred/partial amounts, một mất/một giữ, refund-vs-loss, global và từng nguồn khớp. Forfeit chỉ tiền thuộc bản mất, zero cash delta.

### S11-05 — P2: Trả cuốn còn lại sau mất ghi returned_at cho cả cuốn mất

**Vị trí:** `service.ts:588–592,817–825`; reportBookLoss và receipt/item read DTO.

**Vấn đề:** FULL chọn unreturnedItems đã loại is_lost, nhưng UPDATE loan_items theo cả receipt chỉ lọc returned_atNULL/carried_forward_atNULL, không lọc is_lost hoặc đúng item IDs đã nhận. Vì thế sau mất A/trả B, A vừa LOST vừa có returned_at dù không nhận lại sách.

**Bằng chứng:** double mất A rồi FULL trả B: A.is_lost=true, A.returned_at có timestamp, book copyA vẫnLOST. GET có thể biểu diễn cả isReturned và isLost. Đây là regression ở caller cũ khi thêm trạng thái mất, không phải policy tìm lại sách.

**Sửa:** update đúng tập dòng trả vật lý đã xác nhận, giữ lost/carry lịch sử; trạng thái receipt tổng hợp phần đã trả/mất phải có semantics rõ, không giả tìm lại. **Test:** mất1→trả1 và thứ tự ngược theo nhánh policy đã chốt, GET/reload/summary, lost item returned_atNULL; không ảnh hưởng full return hai cuốn bình thường.

### S11-06 — P2: Selector mất không đối chiếu toàn bộ yêu cầu, mixed alias có thể mất hai cuốn

**Vị trí:** `rules.ts:763–815`; `service.ts:2326–2362`.

**Vấn đề:** copyIds/barcodes cùng được nhận và OR khi tìm item; thiếu reject unknown/duplicate/mixed/type. Chỉ cần một item khớp là commit, bỏ qua selector còn lại. Quy tắc selector trả sách đã sửa từ08 chưa được reuse cho loss.

**Bằng chứng:** yêu cầu COPY-A và NOT-IN-RECEIPT vẫn thành công mấtA; IDsA kèm barcodeB sẽ chọn cảA+B theo OR, không báo conflict. Repro đầu đã chạy, case mixed suy trực tiếp từ nhánh OR hiện tại.

**Sửa:** chuẩn hóa đúng một selector, yêu cầu exact set nằm trong receipt/current holds, reject duplicate/unknown/mixed/empty/type sai trước mutation; validation IDs/bounds theo contract. **Test:** các tập0/1/2, valid+unknown, alias conflict, whitespace/invalidUUID; lỗi không để lại mất/cọc/journal/audit/claim đã hoàn thành.

### S11-07 — P2: Lock order renew/loss/correction ngược với return/collection

**Vị trí:** renew `service.ts:1541–1547,1651–1657`; return `531–561`; loss `2290–2318,2365–2373,2415–2423`; correction `ledger.ts:417–461`.

**Vấn đề:** renew khóa receipt trước session; return khóa session trước receipt. Hai giao dịch cùng phiếu/cùng ca có thể mỗi bên giữ một lock rồi chờ bên kia. Loss cũng receipt/item/allocation trước recordJournalEntry khóa session khi được gửi; correction journal trước session rồi nguồn. Runtime chưa có flow retry phân loại40P01; UI chưa có trạng thái kết quả chưa rõ.

**Bằng chứng:** suy luận lịch khóa từ code: T1 renew giữ receipt, T2 return giữ session, T1 chờ session, T2 chờ receipt. Chưa chạy PostgreSQL overlap; không khẳng định đã quan sát deadlock thật hoặc mất atomicity (PG sẽ hủy một transaction).

**Sửa:** một lock order cho caller tiền/receipt/item/allocation/intent/journal, đọc sơ bộ rồi recheck version sau lock nếu cần. Không giữ lock khi gọi provider/ngân hàng; retry có bound chỉ khi chắc transaction rollback và giữ source/action/key. **Test:** PG hai connection có barriers/observer/deadline/cleanup cho renew-vs-return/loss/refund/collection/correction/close, không dùng sleep hay Promise.all tuần tự làm proof.

### S11-08 — P1: Gate phạt bằng cọc và quỹ thụ hưởng vẫn bị tự mở

**Vị trí:** `service.ts:1630–1669,2415–2425`; docs06 quyết định/gate, prompt11 B4/C2.

**Vấn đề:** guard dùng P>D, còn P=D confirmed vẫn thu P riêng và giữ nguyên cọc rồi tăng hạn/count. Policy chưa chốt là P>=D khi tiếp tục giữ sách. Report loss hardcode FUND_LOAN/FINE_REVENUE thay guard policy nguồn thụ hưởng đã có trong shared forfeitDeposit. Nhánh một mất/một giữ cũng được coi đã chốt dù prompt yêu cầu ghi gate nếu chưa đủ quyết định.

**Bằng chứng:** double cọc50k/overdue50ngày→thu50k, cònHELD50k và renew thành công. Branch P>D và yêu cầu fine mới chưa trả đã được chặn tốt hơn10, nhưng không đóng nhánh biên bằng. Không thấy quyết định mới phê duyệt quỹ trong tài liệu; progress tự ghi “theo quyết định đã xác nhận” không thay câu trả lời chủ sản phẩm.

**Sửa:** giữ gate cho P>=D/pending renewal/mixed loss/quỹ còn mở; chặn đúng nhánh trước tiền/hạn/lượt, tiếp tục phần đã rõ. Không tự áp T73 partial sang renewal hoặc suy “miễn/được giữ” toàn bộ. **Test:** P<D/P=D/P>D, waive/confirmed/pending, policy thiếu/đã cấu hình explicit; policy test không là phê duyệt vận hành.

### S11-09 — P2: Amount/snapshots/business intent và nguồn cash cũ chưa đóng

**Vị trí:** `service.ts:194–201,365–409,1274–1298,1875–1904`; rules validations; collect target optional; actionId trong correction chỉ audit.

**Vấn đề:** giá GET vẫn từ catalog hiện tại, policy/hạn gốc/version chưa persist đầy đủ. confirmedAmount issue optional, confirm-deposit không đối chiếu amount/quote; fine flag còn fallback chung. min(field,journal) vẫn hai nguồn; lineage một cấp và shared transfer chưa đầy đủ. targetId collection optional vẫn cho chọn khoản mới nhất, actionId loss/correction chưa là business uniqueness; HTTP key khác của cùng ý định không được nhận diện đầy đủ.

**Bằng chứng:** source các đoạn trên chưa đổi đúng trách nhiệm S10-08/09; review10 đã có counterexample đổi coverPrice50k→999k đọc lại giá999k, source JOIN hiện vẫn như vậy. Không lặp claim shared receive→refund cũ còn lỗi: case đó đã sửa. Cột lost_at/lost_reason đã thêm nhưng GET item không SELECT/serialize, nên UI12 chưa có read model đầy đủ cho thông tin mất/correction/pending.

**Sửa/test:** snapshot tối thiểu có dữ liệu thật và migration legacy; amount/quote/source riêng, safe integer; action/version ổn định và target collection rõ. Một nguồn cash hoặc invariant materialized chuẩn, trace nguồn cọc/ca và history nhiều cấp theo use case thực. GET/current state phục vụ reload/recovery, không lấy cache response làm sổ chuẩn. Không dựng abstraction/framework mới để sửa các contract này.

### S11-10 — P2: Gate PASS vượt bằng chứng, fixture và UI cũ còn mở

**Vị trí:** progress34–36/README; `tests/integration/lost-book.test.ts:20–25,92–100`; unit loss/collection; UI InternalWorkspace.

**Vấn đề:** G-carryover10/G-concurrency-recovery PASS nhưng chỉ có3 PG tests mới tuần tự, DB chưa tới nghiệp vụ, không race/fault/upgrade dữ liệu cũ. Unit fixture collection dùng settlement_typeRETURN không hợp CHECK FULL/PARTIAL/LOST, journal mock không enforce VARCHAR/unique. Fixture open500k sau seed closed350k không discrepancyReason; các test sau cùng ngày vẫn trúng guard ngày. Migration03 backfill unpaid không forfeit đã thêm đúng hướng, nhưng WAIVED branch trong CASE không đạt vì WHERE fine_final>fine_collected; legacy waived vẫn cần trạng thái đúng, không dùng fresh+all migrations thay upgrade09 có dữ liệu.

**UI carryover:** source không đổi: setLoans tạo phiếu PARTIAL0/2 sách, hardcode ngày, bỏ actualFineCollected/waiveFineReason và không cập nhật tồn/cash; role switch/demo data còn trong nội bộ, login chỉ điều hướng. Đây là R09/R10 cần làm ở12, không phải tính năng11 đã nối. Diagram06 source đã thêm loss/correction nhưng SVG vẫn chưa có loan_renewals/loss flow; file render tồn tại không là đồng bộ.

**Sửa:** gate tách source/unit/direct-handler/PG/app-role/Workers/provider/browser; actual commands/results và policy mở. Fixture đúng contract, fresh+upgrade09/10/11, constraints/length/unique, two connections/fault/lost response. UI12 test browser API/DB reload thực và adapter fixture có nhãn riêng, không phát claim đã dùng backend khi còn mock.

## Đối chiếu carryover chặng10

| Finding10 | Kết quả tại11 |
|---|---|
| S10-01 cột thiếu | Đã bỏ updated_at ở renew/confirm; giữ sửa source, PG còn BLOCKED |
| S10-02 collection | Có targetId optional, sequence, remaining/status đúng trong mock; code dài48 và optional-target/action còn S11-03/09 |
| S10-03 holiday active | Có active deadline UPDATE/audit và return/renew áp holiday; phản ví dụ15/10→20/10 đã pass. Base/version/snapshot/removal/concurrency vẫn chưa đủ, giữ phần chưa đóng |
| S10-04 BANK session | Reuse resolveAndLockSession ở renew/confirm/collect đã sửa; correction/loss source và lock order còn S11-02/07 |
| S10-05 body/action | parseJsonObject ở renew/confirm/collect/calendar/loss/correction chặn malformed/non-object; body khác vẫn fallback, UUID/safe amount/bounds/business action còn |
| S10-06 policy | Chặn P>D và fine mới không confirmed, giữ sửa; P=D và policy nguồn thụ hưởng vẫn S11-08. Không diễn giải lỗi mới thành đã kiểm mọi khoản nợ phạt cũ |
| S10-07 migration | Có backfill không-forfeit unpaid và enum/cột loss; chưa upgrade dữ liệu cũ/waived/ambiguous proof, còn S11-10 |
| S10-08 snapshots | Chưa sửa price/policy/date snapshot/amount quote; progress thay mô tả finding thành cash correction không đóng finding gốc |
| S10-09 gates/cash/lineage | Chưa đóng như S11-07/09/10; append journal không đồng nghĩa mọi read snapshot bất biến |

## Các chặng trước còn mở

| Nguồn | Trạng thái liên quan |
|---|---|
|02 schema/invariants | Max2/active holds/migrations/fresh-upgrade/concurrency chưa có PG proof; giữ active-hold order/enums đã sửa09/10 |
|03 Auth/security | Provider/token lifecycle/multi-instance, app-role grants, Origin/CSRF/body-size/rate/bounds và Workers chưa nghiệm thu; unit role không thay Auth runtime |
|04 money/idempotency | Managed guard cũ tốt nhưng correction bypass; source/collection/business dedupe/cash invariant còn S11-01/02/03/09 |
|05 cash sessions | Handover/date/custodian/close races và fixture source còn mở; không bù quỹ hoặc coi expected là actual |
|06 catalog/borrower | Giá0/TX/audit/carry predicate giữ sửa; metadata title/edition/associations/date nhập/review validation chưa đủ; không kéo toàn module vào12 |
|07 issue | BANK trace và selectors giữ sửa; optional amount/historical snapshots/PG issue proof chưa đóng |
|08–09 return/carry | Strict refund/selectors/settlement DATE/physical-vs-carry giữ sửa; mới thêm LOST cần caller full-return/correction/allocation phối hợp S11-01/04/05 |
|R09/R10 UI | Chưa đổi source;12 phải sửa và nối API thay setLoans/demo state, giữ design.md |

Review cũ là snapshot; bảng chỉ ghi trạng thái kiểm lại source/gate, không nhận toàn bộ module tương lai đã hoàn thành.

## Kiểm tra thực hiện

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;59 files;0 errors,0 warnings,16 hints;tsc pass | Không SQL/HTTP runtime |
| `rtk pnpm run build --outDir .review-artifacts/stage11-build` | Exit0;3 static pages,2.70s | Không Workers |
|13 unit files, isolation none | Exit0;118 pass,0 fail,670.84ms | Doubles/direct handlers; có wrapper không khai báo test |
| Python unittest discover | Exit0;22 pass,0.024s | PoC/regex |
| Redocly2.64.1 lint | Exit0;0 errors,22 warnings | Không semantic/runtime parity |
|10 DB files, isolation none/concurrency1 | Exit1;42 before-hook DB_RUNTIME_MISSING,0 pass | Không assertion nghiệp vụ PG |
| Docker/PATH/env | Daemon pipe missing; postgres/psql không PATH; TEST_DATABASE_URL absent | Không dùng DB/cloud thật |
| Wrangler local8796 | Exit1;launcher spawn EPERM | Chưa Workers HTTP |
| Counterexamples11 | Exit0 | Doubles/direct handlers + DDL length/unique adapters;0 network/real DB write |

Script/JSON tại `.review-artifacts/stage11-counterexamples.mjs` và `.json`. Adapter đọc giới hạn40 từ schema và mô hình hóa22001/23505; không PG execution. Lỗi domain sau giới hạn code được kiểm độc lập bằng mock gốc cho phép chuỗi dài để không che lỗi khác. Không kiểm live provider/ngân hàng/production/UAT/browser mới; source UI không đổi.

## Bàn giao

Prompt [12 — Quầy sách nối API lõi](../prompts/antigravity-next/12-desk-ui-integration.md) sửa S11-01..10 liên quan trước, rồi thay nguồn demo của quầy bằng API/auth/DB local và kiểm browser desktop/mobile. Giữ22 chặng, dừng12; policy/runtime chưa đạt ghi PARTIAL/BLOCKED, không tự deploy hoặc kéo module13 trở đi.
