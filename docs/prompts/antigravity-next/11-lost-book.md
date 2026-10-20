# Chặng 11 — Sửa carryover10, báo mất và sửa sai chứng từ

> Prompt cập nhật sau review10; sửa carryover trước loss/correction, dừng tại11.

## A. Đọc, phạm vi và nguồn chuẩn

Bạn là Antigravity, làm trực tiếp tại `F:\Codex Project\YSBK`. Đọc AGENTS.md áp dụng, README.md, `docs/reviews/2026-10-19-stage10-followup.md`, review09 và bảng carryover các chặng trước; sau đó đọc source/tests/schema/migrations/OpenAPI/progress hiện tại. Review là snapshot: kiểm code mới, giữ sửa đã đúng, không hoàn nguyên chỉ để giống report.

Đọc docs02/05/06/08 và prompt10 để giữ quyết định đã chốt. Chỉ làm11: sửa lỗi nền liên quan, triển khai loss/correction và tự kiểm. Không subagent, commit/push/deploy, cloud project mới, PII/tiền thật, gửi thông báo hoặc tự chạy12. Không hỏi lại các bước local thường lệ đã được giao.

- Phụ thuộc04/05/07–10. Reuse `src/server/circulation/service.ts`, `rules.ts`, `types.ts`, router, finance/deposits/ledger/cash-sessions, DB transaction, shared idempotency/audit. Không tạo `src/modules` song song hoặc đổi stack/UI để né sửa backend.
- Books/hold/deposit/journal/audit/cached response cùng transaction đúng client. PostgreSQL là nguồn chuẩn; mock/SQLite/regex không thay constraints/locks/migrations/app-role grants.
- Đọc callers trước đổi shared contracts. Code/test/fixture/migration/types/DTO/OpenAPI/diagram phải khớp lát đã làm; không nhận UI12 hoặc module sau đã xong vì có source dự kiến.
- PG test disposable có guard target trước migration/seed/reset, không DB thật. Thiếu PG/provider/Workers thì tiếp tục phần độc lập và ghi PARTIAL/BLOCKED cùng lệnh tái chạy.

## B. Sửa carryover10 trước khi dùng nền tiền cho báo mất

### B1. S10-01, S10-07 — schema và upgrade có dữ liệu

- Renew và confirm-deposit ghi `loan_receipts.updated_at` chưa có. Bỏ UPDATE cột không cần hoặc thêm baseline+forward migration nhất quán; sửa nhỏ nhất đủ dùng, không chỉ nới mock.
- Migration02 default pending0/COLLECTED làm mất dấu fine09 chưa thu. Backfill theo quyết định/tiền đã thu/forfeit và nguồn; phân biệt unpaid/paid/waived/forfeited. Legacy thiếu căn cứ phải được liệt kê xử lý, không đoán fine_final-collected thành nợ cho mọi row.
- Giữ sửa đóng old logical hold trước new INSERT và enum pending. Migration giữ columns/FK/unique/max2/tiền/lịch sử; không xóa constraint để pass, không fake returned_at cho carry/lost.
- Test fresh và upgrade từ schema08/09 có dữ liệu giả, không chỉ current baseline rồi migration. Kiểm row counts/journal/hold/allocation/settlement và hành vi sau upgrade; runner thứ tự/transaction boundary/rerun rõ.

### B2. S10-02, S10-04 — collection source, trạng thái và phiên trực

- Phạt5k thu2k→3k phải có hai collection hợp lệ; entry_code không trùng hằng `JE-FINE-${receipt}-COLLECT`. Mỗi thực thu có ID/nguồn cụ thể, decision/kỳ phạt/amount/method/session/actor/time và stable action; không random code để che double charge.
- DTO trả amount thực thu, remaining/status thật; lần1 còn3k phải PENDING. Receipt có nhiều renewal fines và settlement không được chọn “PENDING mới nhất” thay nguồn caller đang xác nhận. Same action retry/new key không tự chuyển sang kỳ phạt khác.
- Thu cọc/phạt BANK cũng resolve/lock buổi khi có tiền, reject buổi chỉ định đóng/missing theo contract. BANK không tăng hộp CASH; gia hạn trong hạn không thu tiền không phải mở ca vô ích. Test renew/confirm-deposit/collect-fine và close race.
- Fine decision snapshot bất biến; collection/waive/correction có nguồn liên kết và lịch sử riêng, không rewrite quyết định cũ để giả nhận tiền. Pending phải đọc lại/hoàn tất/hủy có lý do, chống thu từ terminal receipt.

### B3. S10-03 — lịch nghỉ áp dụng cho active loans

- Add holiday hiện chỉ upsert bảng, không dời active due_date. Sửa01/10→15/10; thêm nghỉ15/10→hạn20/10, trả19/10 không phạt. Issue/GET/renew/return dùng cùng hạn hiệu lực.
- Lưu hạn gốc/căn cứ/hiệu lực/reason/version; điều chỉnh active loans có audit/concurrency khi đổi lịch, không cộng dồn14 ngày vì đổi holiday, không rewrite settlement đóng hoặc phạt hồi tố.
- Giữ ngày Việt Nam/DATE string, cộng đúng14ngày; T3/T5/hết ngày; invalid date reject; hết bound60ngày lỗi rõ. T3 đến hạn→T5 trả vẫn2k, không loại mọi ngày không trực khỏi phạt.
- Hủy đột xuất/kỳ thi/ngày nghỉ xen giữa khoảng overdue chưa chốt thì ghi policy gate riêng, không âm thầm quyết định hoặc gọi provider ngoài khi chưa cần.

### B4. S10-05, S10-06, S10-08 — boundary, action và quyết định tiền

- JSON lỗi không fallback `{}` thành lệnh gia hạn. Parse object trước spread/claim/mutation; malformed/null/array/string/type/UUID sai trả400. Safe integer VND/bounds/length theo schema; không để coercion unsafe làm tiền chuẩn hoặc PG500 thay validation.
- Action ID/expected version tối thiểu để cùng ý định key khác không tiêu thêm lượt/thu thêm tiền; giữ path trong payload hash và live quyền trước replay. Hai ý định gia hạn thật vẫn serialize đúng hạn/count/max3, không đổi receipt để né cap.
- Gia hạn khi fine pending hoặc P>=D tiếp tục giữ sách chưa có policy đủ. Không tự tăng lượt/hạn, thu đủ P vượt D, lấy T73 partial áp sang renewal hoặc thu cọc mới. Ghi gate và tiếp tục nhánh đã rõ: trong hạn/miễn có lý do/confirmed fine dưới cọc. Test không phải quyết định chủ sản phẩm.
- Snapshot giá nullable/căn cứ cọc/policy/hạn phải persist/read thực, không chỉ field optional. Catalog đổi không rewrite lịch sử; deposit_snapshot đã đúng thì giữ. Khoản thu mới có amount/quote/source/xác nhận riêng; thiếu/sai/stale quote conflict trước journal, client không tự đặt cọc.
- Giữ strict refund true, selector duplicate/mixed và flag cọc mới riêng; bỏ suy xác nhận khoản phạt khác từ flag chung nếu có thể ghi tiền đã thu sai.

### B5. S10-09 — cash, lineage, fixtures và gate cũ

- Shared receive/refund/reversal đã update field và ví dụ receive50k→refund50k nay pass: giữ sửa. Nhưng confirmRefund vẫn min(field,journal), mỗi caller tự update cash. Chốt một nguồn hoặc materialized invariant do shared writer quản lý atomic đúng1lần; cash mismatch phải cần đối soát, không min im lặng/caller double-update. Actual count khác expected balance.
- Allocation coverage xét state/remaining/source/item mapping trước quyết định tiền, không chỉ row tồn tại. Ambiguous NULL/multiple/pending/partial-source reject hoặc migrate có căn cứ. Trace nhiều cấp qua shared transfer/carry, không thêm journal nhận giả để có session.
- Hoàn tất/hủy pending deposit khi sách trả/báo mất cần lifecycle rõ; không nhận thêm cọc cho terminal receipt hoặc để dangling collection không xử lý được.
- Fixtures seed350k/open500k hoặc1triệu cần discrepancyReason ở open; reason UPDATE close không thay reason bàn giao. Test sau không mở lại cùng ngày trái guard; dùng fixture trung lập hoặc ngày/buổi riêng hợp contract, không bỏ guard.
- PG hai connections có overlap/blocking assertions/deadline/cleanup, fault sau mutation/journal/audit/cache, lost response và upgrade. Hai test tuần tự/mock snapshot không là PG concurrency/recovery PASS.
- Auth03/provider/app-role/Origin/CSRF/body/rate và catalog06 metadata/date nhập/review còn mở: sửa trust boundary dùng cho11, phần ngoài lát ghi PARTIAL/BLOCKED; không kéo06/13–22 vào11 hoặc đóng bằng lời “triệt để”.

## C. Báo mất: nghiệp vụ và ranh giới chưa chốt

### C1. Source và trạng thái

- Endpoint canonical báo mất, reuse path OpenAPI nếu có; receipt + selected item/copy IDs, reason bắt buộc, action/idempotency/source/version. Server đọc allocation/hold/current receipt, không nhận status/amount/quỹ/actor tùy ý từ body.
- Active member/admin theo quyền đã chốt; guest/alumni/disabled/revoked không mutation/replay/PII/tài chính. Không tự chia quyền theo ban hoặc biến toàn bộ correction thành admin-only khi chưa có yêu cầu; admin vẫn quản tài khoản và nhật ký toàn hệ thống.
- Chỉ xử lý copy đang giữ trên receipt hiện tại, chưa return/lost/carry. Ghi book copy LOST, loan item is_lost và source/reason/actor/time; returned_at vẫnNULL vì không nhận sách vật lý. Receipt cũ đã carry không được mất cùng copy lần nữa.
- Terminal/settlement type thể hiện tất toán vì mất theo schema/DTO, không giả physical RETURNED chỉ để reuse full-return. Commit chỉ một inventory state, không active hold trùng; terminal receipt không renew/settle lại. Nếu còn item giữ, trạng thái phải biểu đạt đúng phần còn lại.

### C2. Giữ cọc đúng nguồn, không thu vượt

- Sách giá74k cọc50k báo mất chỉ giữ50k đã nhận, không thu thêm24k/phạt vượt cọc. Dùng allocation bản mất, không giá catalog mới hoặc toàn bộ cọc cuốn khác cho một cuốn mất.
- Forfeit giảm nghĩa vụ hoàn và chuyển nguồn đã nhận theo policy được chốt; không thu CASH/BANK mới, không tăng hộp tiền. Reuse forfeitDeposit và policy guard, không hardcode FUND_LOAN rồi nhận đã phê duyệt. Quỹ thụ hưởng chưa chốt giữ gate, test bằng fixture explicit.
- Cọc đã hoàn/forfeit/transfer hoặc pending refund không được tiêu lần hai. Refund chưa chi muốn chuyển sang mất cần source transition/cancel cùng TX/audit; không auto rút lại tiền đã hoàn ngoài đời. Pending collection chưa nhận tiền không phải cọc có thể forfeit.
- Hai cuốn mất một/giữ một hoặc mất một/trả một, phạt chung phiếu trước/sau renewal: chỉ triển khai nhánh có quyết định rõ. Không tự reset hạn/lượt, thu cọc mới, nhân đôi phạt, hoặc miễn nợ theo suy đoán. Ghi câu hỏi/policy chặn đúng nhánh, tiếp tục single-book loss/all-loss hoặc phần đã rõ; không hỏi lại cap50k.
- Tìm lại sách, hỏng sách và hoàn tiền vì tìm thấy chưa chốt thì không auto LOST→AVAILABLE/hoàn cọc hoặc dựng workflow ngầm. Correction lỗi nhập khác với sách thật sự tìm lại.

## D. Sửa sai chứng từ có nguồn

- Kiểm callers/managed-source guards trước thêm correction. Không mở route arbitrary recordReversal(journal ID), không cho body allowDirectSourceReversal bỏ guard.
- Correction định danh original source/reason/action/version, ghi chứng từ đảo/điều chỉnh liên kết. Posted journal không UPDATE/DELETE; receipt/item/allocation/refund/collection/renewal history/audit đồng bộ, không chỉ Nợ=Có.
- Phân biệt sai dữ liệu chưa có tiền thực và đã có tiền thực. Đảo journal không tự chuyển tiền ngân hàng hoặc thu lại tiền đã giao khách. Khoản thực thu/hoàn mới tạo intent, confirm amount/method/session; chưa xác nhận giữ pending, không báo tiền đã thu/chi giả.
- Ca sau không backdate biến động snapshot ca đóng. Cash payout đủ tiền theo nguồn chuẩn dưới lock; BANK không đổi CASH. Hai correction cùng nguồn không đảo kép; reversal-of-reversal/correction tiếp có contract theo cơ chế hiện có, không dựng engine kế toán tổng quát.
- Source đã carry/renew/collect/refund/mất/trả tiếp phải kiểm dependency/version. Không mở hold cũ hoặc hoàn cọc đã chuyển/chi khi nguồn sau commit; conflict và hướng xử lý nguồn liên quan, không cascade sửa lịch sử im lặng.

## E. Transaction và hồi quy

- Auth/validate→withTransaction đúng client→claim(actor/operation/key/payload gồm path/source)→lock cùng order return/renew/refund/close→recheck state/version→inventory/item/receipt/allocation/intents/journal/audit/cache→commit. Không gọi provider ngoài khi giữ lock.
- Loss-vs-return/partial/renew/refund/confirm-deposit/correction cùng copy/nguồn chỉ một hành động tiêu hold/cọc. Lock receipt/item/copy/allocation/intent/session theo order chung, không đảo order callers cũ.
- Same key/payload replay source ID/kết quả cũ; payload/path khác409, live role trước replay. Same business action key khác không forfeit/refund/collect lần hai. Mất response sau commit tra nguồn, không thu lại.
- Fault sau copy/item/allocation/forfeit/refund intent/reversal/journal/audit/cache rollback toàn bộ DB; DB rollback không đảo tiền ngoài đời, recovery theo source/đối soát.
- Tests theo cấu trúc hiện có: unit rule/HTTP guard, integration PG constraints/locks/source/cash/upgrade. Mock bắt ít nhất cột/unique đang kiểm hoặc nêu giới hạn, không dùng mock pass thay invariant PG.

## F. Gate và bàn giao

| Gate | Bằng chứng cần có |
|---|---|
| G-carryover10 | Từng S10-01..09 + bảng S09/02–08: sửa gì, source/test/lệnh/môi trường/kết quả, phần mở |
| G-schema-upgrade | Fresh và schema08/09 có dữ liệu→migration→renew/confirm/collect/loss/correction; legacy fine không mất hoặc sinh nợ giả |
| G-collections |5k→2k→3k, nhiều kỳ phạt, source/action/amount/quote; pending→confirm/cancel; BANK/CASH/ca đóng; status/summary đúng |
| G-calendar | Holiday sau issue áp vào active deadlines có audit/version; GET/renew/return cùng căn cứ, không sửa snapshot đóng |
| G-loss |74k/cọc50k chỉ giữ50k, LOST khác returned/carry; không thu tiền mới, không dùng cọc đã tiêu/chưa nhận |
| G-correction | Source reversal có reason/history, không arbitrary bypass; không coi journal là tiền thực; đủ tiền/ca sau/dependency |
| G-concurrency-recovery | PG hai connections return-vs-loss/refund/renew/correction/close; faults/lost response/business retry không tiêu tiền/hold hai lần |
| G-auth-contract | HTTP guards/roles/revoked/replay/PII/no-store/object/UUID/money/bounds và OpenAPI semantic parity |
| G-runtime-policy | PG/app-role/Workers/provider và policy quỹ/mixed-loss/renew-pending/P>=D tách; không dùng test thay quyết định |

- Hồi quy ledger/deposits/sessions/issue/full/partial/refund/renew/collection/calendar/Auth/catalog/borrower vì shared contracts đổi; check/build/OpenAPI lint và Python nếu model/schema liên quan đổi. Broad tests chỉ lặp khi có đổi/failure/rủi ro mới. UI không đổi không tạo screenshot giả.
- Code/migration/tests/fixtures/types/API và source/render diagram phải khớp. Diagram06 source có renewal nhưng SVG chưa có loan_renewals; không nhận đã render đúng chỉ vì file tồn tại.
- Progress/README ghi PASS/PARTIAL/BLOCKED từng cấp. PG chưa qua setup là0 assertion nghiệp vụ; unit/direct handler không là Workers/provider UAT. Giữ review10 nguyên làm snapshot.
- Bàn giao request/response + SQL giả trước/sau: single loss/cap50k, correction trước/sau tiền thực, dependency conflict, pending collections, calendar adjustment và retry/race/fault; nêu endpoint có handler/phần chưa chạy.
- Tổng kết findings đóng/còn, files, lệnh/exit/result, policy chặn và input12. Dừng11; không tự lost-found/damaged/engine kế toán mới/UI12/commit/push/deploy/chuyển tiền thật.

