# Antigravity — Sửa tiếp sau review đợt P22/S12 ngày 20/10/2026

Tiếp tục trong `F:\Codex Project\YSBK`. Hãy **sửa implementation, caller, migration và tests**, không chỉ trả lời kế hoạch. Làm tuần tự các nhóm bên dưới, tự kiểm tra sau mỗi checkpoint rồi tiếp tục; không chờ tôi giao lại từng nhóm. Giữ các sửa đúng của lượt trước. Đây là lượt sửa của phạm vi22chặng hiện có.

## 1. Đầu vào và quy tắc

Đọc AGENTS.md áp dụng, README/design, rồi:

- `docs/reviews/2026-10-20-post22-repair-followup.md` — nguồn review mới nhất, RF-01…11 và ma trận toàn bộ P22/S12.
- `docs/technical/post22-repair-handoff.md` — đối chiếu claim với code, sửa trạng thái quá rộng.
- `docs/prompts/antigravity-next/repair-post22-review.md`, review19/10 và tài liệu nghiệp vụ/quyền/finance được dẫn; không hỏi lại quyết định đã chốt.
- `.review-artifacts/repair-review-20261020-probes.mjs/.json` — counterexamples có mô tả rõ source/function/adapter/schema-guard/interleaving model. Các model không phải bằng chứng PG thật.

Phạm vi và cách làm:

1. Xác minh hiện trạng trước sửa; review là snapshot, không làm lại phần đã sửa đúng sau đó. Bảo toàn chỉnh sửa người dùng, review và artifact cũ. Không chỉnh probe/review cũ cho xanh; chuyển case thành regression riêng trong suite hiện hành.
2. Giữ stack/cấu trúc đang có, reuse helpers finance/auth/transaction/idempotency. Không thêm module song song/framework/microservice. Sửa ở root cause với đầy đủ caller/DTO/route/schema/fixture; không castany/fallback mock để che contract sai.
3. Thêm regression gây lỗi trước sửa logic tiền/quyền/state/parser. Test đi tới đúng lớp bị lỗi: router bug phải có adapter→router test; SQL phải soát canonical schema và chạy PG khi có; mock helper không được chấp nhận bảng/cột/ORDER BY sai rồi gọi đó là DB proof.
4. Không subagent, git init/commit/push/deploy, tạo cloud resource, global config/security changes, dữ liệu/tiền thật hay gửi thông báo/provider thật. Có thể chạy local server và DB disposable dùng dữ liệu tổng hợp với guard hiện có; không bypass guard TEST_DATABASE_URL, sandbox hoặc Work browser settings.
5. Thiếu runtime/credential: ghi gate BLOCKED, tiếp tục phần code độc lập. Không dùng mock/build/unit thay PG/Workers/browser/provider/restore. Không kết thúc sớm chỉ vì một gate blocked nếu còn sửa local được phép.
6. Đầu lượt cập nhật handoff hiện có: RF-01…11 liên kết ID P22/S12 gốc, trigger, root cause, file/test, trạng thái và bước tiếp. Giữ mức độ finding gốc, không tự đổi P1 thànhP2 hoặc đổi mô tả để đóng. Sau mỗi checkpoint cập nhật và tự tiếp tục. Khi hết context, đọc handoff và tiếp tục chỗ dở.

Giữ nghiệp vụ trong prompt lượt trước:2cuốn/phiếu, đúng14ngày lịch, gia hạn3lần, cọc theo mốc50k gần nhất/tối thiểu50k/không giá50k; phạt1k/ngày toàn phiếu cap tổng cọc, giảm/miễn có lý do. Trả một phần phân biệt physical return/carry/lost, phiếu mới reset hạn/renew. Quỹ LOAN khác OPERATION; không tự ghi tiền đã chuyển. Khách mua không nợ; cọc nhà sách hoàn riêng với trả tiền sách. Giữ quyền admin/member/alumni/guest và thiết kế đã duyệt.

## 2. Nhóm I — Làm cho quote và hàng chờ thật sự chạy được (RF-01)

- Sửa dispatch GET `/circulation/loans/:id/quote`: handler detail generic hiện bắt mất subresource. Dùng match chính xác hoặc thứ tự route rõ, kiểm mọi subresource tương tự. Không chỉ thêm unit gọi quoteLoanAction rồi coi route đạt.
- Sửa các query mới theo schema thực: borrowers, book_copies→book_editions→book_titles. Không có bảng books/readers hoặc book_copies.book_id; không tạo thêm các bảng trùng chỉ để query chạy.
- Pending refunds/deposits/fines phải đi được qua route và SQL canonical. Fine queue bao gồm cả nguồn settlement/renewal thực cần thu (kể cả sau correction), trả source type/id chính xác; UI truyền targetId của dòng chọn, không tự chọn quyết định mới nhất.
- Query quote/queues phải phân biệt returned/lost/carried-forward và không join nhân bản tiền cọc. Chuẩn hóa date/amount DTO đúng VND/VN.
- Quote RETURN/RENEW dùng cùng policy với execution: ngày nghỉ/hạn hiệu lực,1k/ngày cả phiếu,capcọc; suggested vs effective/payable/forfeit phải đặt tên rõ nếu cần tách. canRenew phải phản ánh điều kiện thực thi. targetDate là ngày đánh giá, không hiển thị như hạn gia hạn mới; trả trường deadline dự kiến đúng nghĩa.
- Quote chưa tải hoặc lỗi thì LIVE hiển thị lỗi/retry và không xác nhận quyết định tiền từ fallback phép tính client. Queue lỗi không biến thành[] “không có khoản chờ”. Server luôn revalidate under transaction, kể cả quote đã cũ.

Regression bắt buộc:

1. Phiếu hợp lệ: adapter→router quote200, route không vào loanId chứa `/quote`.
2. Ba queues đọc đúng seeded schema, empty hợp lệ khác lỗi tải; test qua service/route thật trên PG khi có.
3. Cùng receipt có nhiều nguồn phạt, chọn dòngA chỉ thuA; pending do correction không bị bỏ sót; lost/carry không thành returned.
4. Ngày lễ, đúng hạn, đổi ngày giữa quote/submit, miễn phạt có reason, phạt>=cọc và PENDING_DEPOSIT; quote và execution thống nhất.

## 3. Nhóm II — Xác nhận tiền, quyết toán một lần, danh tính thành viên (RF-02, RF-03, RF-07, RF-08)

### II-a. Xác nhận tiền xuyên suốt

- Bỏ `paymentConfirmed` mặc định true trong apiClient.sellBook và hardcode true ở form không có xác nhận thực thu.
- Tạo lô: nhập dự kiến cọc không tự thành PAID/journal chi. Có giao dịch thực chi riêng hoặc thao tác xác nhận tường minh với method/amount và kiểm đủ số dư nếu chi CASH. Không tự chọn BANK vì thiếu input.
- Supplier payment/refund: service bắt buộc confirmation===true trước mọi mutation; UI có phương thức, số tiền, xác nhận thực kiểm ngân hàng/tiền mặt và reference nhập theo thực tế. Không tự tạo mã UNC rồi coi là bằng chứng thanh toán.
- Dùng cùng transaction cho inventory/document/journal/audit/idempotency. Không dùng cash session LOAN để chứa tiền OPERATION; không hạ guard để vượt fixture cũ.
- Test omitted/null/false/0/stringtrue ở boundary, payment method sai, amount vượt phạm vi, rollback, retry sau commit; đúng xác nhận mới tạo tiền và trạng thái thật.

### II-b. Quyết toán và snapshot cạnh tranh

- createSettlement dùng idempotency helper chuẩn có actor/action/payload hash; cùng key khác lot/path/body phải409, không trả chứng từ lô khác.
- Khóa aggregate lô trước kiểm quyết toán/tính số liệu; unique business source cho một quyết toán của lô theo workflow hiện có. Nếu thực sự cần nhiều kỳ thì phải định danh kỳ đã có policy, không tự mở scope này để tránh UNIQUE.
- Sales/return/retain/settlement cùng thứ tự khóa và kiểm status dưới lock. Không cho tiền/tồn thay đổi sau snapshot quyết toán theo đường không được phép; không chỉ thêm UNIQUE rồi để snapshot race.
- Migration uniqueness phải bảo toàn dữ liệu: có preflight phát hiện trùng và hướng đối soát rõ, không tự xóa chứng từ/journal cũ. Lát chặn duplicate giữ fail-closed nếu chưa thể nâng cấp dữ liệu mơ hồ.
- Test PG concurrency khi runtime có: hai key quyết toán cùng lô chỉ một chứng từ/nợ; sale/return đua settlement không bỏ giao dịch hoặc ghi snapshot sai; lỗi journal rollback mọi thay đổi. Double interleaving chỉ là test bổ sung.

### II-c. Chuyển ứng viên

- Không liên kết applicant với member có sẵn chỉ bằng username/MSSV suy từ form. Username collision phải báo conflict hoặc xử lý cấp tên không trùng theo flow rõ; reuse member chỉ khi đã có liên kết identity được xác minh.
- Giữ UUID/enum đã sửa đúng. Lấy gen/school-year/term/phone từ campaign/input hợp lệ; bỏ số điện thoại giả0900000000, Gen10/K68 và năm2026–2027 mặc định. Dữ liệu bắt buộc thiếu phải bổ sung trước commit, không sáng tác thông tin.
- Khóa decision ngay trong transaction trước kiểm converted và đảm bảo constraints cùng nguồn. Test concurrent/retry cùng response, người trùng tên, MSSV sai/trùng, thiếu thông tin, existing member khác; không sửa/gắn nhầm người cũ.

### II-d. Correction legacy

- Giữ journal mới source_id=decisionUUID. Legacy source_id=receipt.id không được tìm renewal mới nhất hoặc settlement mới nhất theo prefix rồi đảo.
- Map nguồn cũ duy nhất từ chứng từ/sequence đủ bằng chứng, hoặc từ chối AMBIGUOUS_FINE_SOURCE kèm hướng reconciliation. Không clamp collected về0 để che reversal vượt amount thật.
- Regression: renewal1 thu1k, renewal2 thu3k, đảo journal1 chỉ đổi decision1; có thêm settlement, thu nhiều đợt, thiếu sequence, amount không khớp và source mới. SQL double phải tuân ORDER BY nếu test dựa vào nó; chạy PG khi có, ghi riêng mức bằng chứng.

Các số đối soát giữ nguyên: lô100, nhập65k, bán60 giá80k, trả40→thu4,8tr/nợ3,9tr/lãi gộp900k; cọc1tr nhận lại riêng. Két LOAN200k + hội phí100k vẫn200k, OPERATION tăng100k. Không cộng tiền giả vào sổ để làm report cân.

## 4. Nhóm III — Vòng đời action, phân trang và DEMO/auth (RF-04, RF-05, RF-06)

- Action/key/payload gắn actor, operation và entity. Bao phủ mọi mutation tiền/quầy: issue/return/renew/loss/open-close/correction/collect/refund/deposit/dues/sale/supplier-payment/settlement.
- Retry cùng ý định dùng key cũ, kết quả chưa rõ có readback/recovery; reload không biến thành ý định mới và không yêu cầu chuyển tiền lần nữa. Cancel→entity khác, đổi payload sau validation và thao tác mới được phân biệt rõ; không dùng một state key cho mọi renew/sell của cả component.
- Bảo vệ máy dùng chung: lưu recovery tối thiểu, không lưu PII/secret không cần; actor/logout/role/mode được kiểm lại trước replay/cached result.
- Metadata phải sống qua requestJson/adapter. Chốt envelope một lần, cập nhật mọi caller và multi-part response; không duplicate hàng loạt alias để che hợp đồng không rõ. Wire total125/page2/limit1 phải giữ nguyên trong adapter.
- Quầy nối search/scan/pagination server; bản available ngoài100 bản đầu hoặc chưa từng mượn vẫn tìm và mượn được. Bỏ fallback tồn kho từ history khi catalog lỗi/rỗng; lỗi thật có UI thông báo.
- DEMO boundary chặn toàn bộ mutation, đặc biệt reconciliation, create/edit rubric/evaluation, finalize/convert applicant và export ticket. Đừng chỉ gắn13guard rồi bỏ sót các handler khác.
- Request đang chờ phải bị abort hoặc bỏ kết quả khi mode/actor/role đổi. Clear mọi state/modal/action nhạy cảm; catch con401/403 không nuốt. GET rubric lỗi mạng/403 không được chuyển thành tự tạo rubric.
- Test deferred response qua LIVE→DEMO/logout/member→alumni, mutation spy cho toàn bộ DEMO actions; key lifecycle cancel/change/reload/lostresponse; >100copies với filter/search/page và metadata. Nếu browser bị tắt giữ gate BLOCKED, không gọi source guard là browser proof.

## 5. Nhóm IV — Public, export, phục hồi và báo cáo (RF-09, RF-10, RF-11; P22-09, P22-10; S12-10)

### IV-a. Public/SEO

- Dùng public-safe catalog/review contract canonical thay query/render shape tự nghĩ. Sau migration12 là author_name/moderated_at, không reader_name/approved_at.
- DB/source lỗi không silently build mock như thật. Mock chỉ preview được cấu hình rõ và noindex; không luôn trộn sáu mock book vào catalog production.
- Chọn cách render/cập nhật phù hợp stack/deployment đã chọn: sách thật có HTTP200/HTML/meta/canonical đúng; fallback404 đổi DOM không thay được trang sách200, noindex phải đúng môi trường. Không dựng kiến trúc mới lớn chỉ để lách bug.
- Dùng editions[].standardDeposit/coverImageUrl hoặc DTO public thống nhất. Bỏ công thức cọc50% ở404; cọc74k→50k,75k→100k,230k→250k,không giá50k theo policy server.
- Chứng minh sách thêm sau build có URL hợp lệ, duyệt/sửa/ẩn review cập nhật đúng cơ chế đã chọn, public không PII. Kiểm HTML/HTTP thật khi có runtime; không gọi build mock là SEO acceptance.

### IV-b. Export

- Nối format từ UI→API→generator→download. XLSX phải là XLSX thật, PDF phải là PDF thật; XML.xls/HTML print có thể giữ như format riêng nhưng không gọi là hoàn thành yêu cầu XLSX/PDF.
- Dùng thư viện phù hợp có sẵn hoặc dependency tối thiểu cần thiết, kiểm license/runtime và lockfile; không tự viết đầy đủ định dạng PDF/XLSX chỉ để tránh thư viện. Kiểm file mở được, tiếng Việt, số liệu, formula injection và giới hạn dữ liệu.
- Single-use ticket nếu giữ cam kết thì consume phải atomic trên trạng thái dùng chung, test hai instance; không dựa consumed Set trong memory. Bỏ signing secret mặc định trong source; xác thực actor/role/token version khi download, bounded cleanup và retry khi render lỗi. Không thay đổi policy thành link public.

### IV-c. Restore

- Giữ missing-tool/ON_ERROR_STOP fixes. Verify không parse được hoặc semantic check thất bại phải exit khác0, không warning rồi success. CảPowerShell/Bash kiểm target/mode rõ, drill dùng DB disposable guard; không tự fallback DATABASE_URL thật.
- Đối soát đủ schema/data/source counts/ledger balances/inventory/pending/auth state, không chỉ số bảng>=5. Script/test fake psql chỉ kiểm exit/error logic, không là recovery proof.
- Drill thật dump→restore DB sạch bằng dữ liệu tổng hợp; đo thời gian phục hồi và ghi kết quả. Không có runtime thì ghi BLOCKED và runbook chính xác, không công bố RPO/RTO/PITR đạt.

### IV-d. Reports và tài liệu

- Giữ opening/movement/closing đã sửa. Report lưu thông dùng cutoffVN nửa mở như finance, không CURRENT_DATE theo DB cho policy ngàyVN; áp ngày nghỉ và định nghĩa đếm phiếu/bản rõ. LOST settlement count không được gắn nhãn số sách nếu một settlement có nhiều cuốn.
- Test refund từ kỳtrước, công nợ qua kỳ, kỳkhông phát sinh nhưng có số dư, ngày cuối kỳ/00:00VN, partial/lost/carry, ngàynghỉ; JSON/export/drilldown khớp định nghĩa.
- Cập nhật OpenAPI/DTO/diagram/runbook và current status sau code; lint không thay contract tests. Giữ ID/mức độ finding gốc. Đính chính CheckpointG PASS/FIXED_SOURCE quá rộng trong handoff hiện tại, không chỉ append “xong” thêm lần nữa.

## 6. Kiểm chứng và đầu ra cuối

Sau checkpoint chạy focused tests và sửa regression của thay đổi. Cuối lượt chạy check/build/unit/Python/OpenAPI có liên quan, adapter→router, PG service/migration/concurrency/app-role khi có, Workers dry-run/local, browser desktop/mobile khi được phép, restore drill khi có runtime. Không deploy.

Baseline lịch sử review20/10:232unitpass,23Pythonpass,check113files0errors/9hints,build10staticpages,OpenAPI0errors/40warnings;49DB results dừng setup DB_RUNTIME_MISSING;Docker không daemon,Wrangler spawnEPERM,dev lỗi moduleisnotdefined và CUA bị Work settings tắt. **Tự xác minh lại hiện trạng**, không copy số cũ thành kết quả mới hoặc đổi tests để giữ số pass.

Nếu chưa chạy được một gate, chẩn đoán an toàn và ghi BLOCKED, hoàn tất phần không phụ thuộc rồi bàn giao. Không disable auth/constraint/browser/DB guards để xanh. Không cần xin phép lại để tiếp tục sửa code local trong scope này.

Bàn giao bằng tiếng Việt:

1. Hành vi đã sửa, file chính và thay đổi schema/migration cần chú ý.
2. Bảng RF-01…11, P22-01…12 và S12-01…10: root cause, trạng thái OPEN/PARTIAL/FIXED_SOURCE/VERIFIED, test/lệnh/log, phần chưa kiểm. VERIFIED chỉ dùng khi đủ bằng chứng cần cho finding.
3. Kết quả thực tế, exit codes, pass/fail/blocked; tách unit/double/adapter/PG/Workers/provider/browser/restore. Unit xanh không là nghiệm thu tiền thật.
4. Phần còn lại và bước tiếp chính xác. Tuyên bố tổng thể PARTIAL nếu còn bug chặn hoặc runtime gates chưa đạt; không gọi sản phẩm hoàn tất chỉ vì đã làm đủ checkpoint.

Bắt đầu sửa nhómI ngay sau đọc đầu vào, rồi tự tiếp tục đến hết phần được phép và có thể thực hiện.
