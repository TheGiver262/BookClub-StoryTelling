# Prompt Antigravity — Sửa review sau chặng 22 và các carryover S12

Bạn là Antigravity, tiếp tục làm việc trong `F:\Codex Project\YSBK`.

Hãy **thực hiện sửa code, migration, UI, tests và tài liệu**, không chỉ đưa kế hoạch hoặc cập nhật checklist. Mục tiêu là sửa toàn bộ P22-01…12 và phần còn mở của S12-01…10, giữ các phần đã đúng. Làm tuần tự các đợt dưới đây, tự kiểm tra sau mỗi đợt rồi tiếp tục, không chờ tôi giao lại từng bước. Đây là đợt sửa của 22 chặng hiện có, không tạo “chặng 23” hay làm lại từ đầu.

## 1. Đầu vào, phạm vi và cách làm

Đọc theo thứ tự:

1. AGENTS.md áp dụng, README.md, design.md.
2. `docs/reviews/2026-10-19-post22-followup.md` — review chính, chứa P22-01…12, bảng S12 và bằng chứng.
3. `docs/reviews/2026-10-19-stage12-followup.md` và phần carryover S11/older được dẫn trong đó.
4. `docs/02-pham-vi-va-nghiep-vu.md`, `docs/06-phong-van-va-quyet-dinh.md`, `docs/08-ma-tran-quyen-va-dang-nhap.md`, tài liệu transactions/finance/security và code/schema/tests hiện tại.
5. `.review-artifacts/post22-counterexamples.mjs`, `.json`, các log liên quan và `post22-review-manifest.json` để hiểu counterexample. Đây là bằng chứng review, không phải suite được phép sửa cho xanh.

Review là snapshot; phải xác minh lại code trước sửa. Nếu finding đã được sửa đúng sau snapshot, giữ sửa đó, thêm/kiểm regression và ghi rõ bằng chứng. Không làm lại phần đã đạt chỉ để đổi kiến trúc.

Quy tắc thực hiện:

- Giữ Astro/React/TypeScript và kiến trúc backend hiện có; dùng lại finance/auth/transaction/idempotency helpers. Không tạo cây module song song, framework mới, microservices, multi-tenant hay SaaS billing.
- Tìm tất cả caller, DTO, route, schema, fixture và test chịu ảnh hưởng trước khi sửa helper chung. Sửa root cause và các đầu nối, không vá riêng UI bằng `as any`, fallback mock hoặc nuốt lỗi.
- Với logic tiền, quyền, parser, migration và state: thêm regression thể hiện lỗi trước, sửa, rồi kiểm cả nhánh thành công/lỗi/rollback. Không giữ test đang assert hành vi sai chỉ vì từng pass.
- Không sửa/xóa review, manifest, log hay probe cũ để làm mất bằng chứng. Đưa regression sau sửa vào suite phù hợp; probe cũ có thể thất bại vì nó cố chứng minh lỗi cũ, không dùng điều đó để kết luận sửa sai.
- Bảo toàn chỉnh sửa người dùng. Workspace có thể không có Git: kiểm tra thực tế; dùng snapshot/hash nếu cần, không tự git init. Không commit/push/deploy, tạo cloud resource, đổi global config, dùng PII/tiền thật, import dữ liệu thật hay gửi thông báo ra ngoài.
- Không subagent. Có thể chạy local server và DB disposable bằng công cụ sẵn có, với dữ liệu tổng hợp và guard DB hiện có. Không dùng production/staging có dữ liệu thật làm test target; không vô hiệu hóa auth, grant, sandbox hay browser settings để đạt xanh.
- Thiếu DB/provider/browser/secret: chẩn đoán và thử giải pháp local an toàn trong quyền hiện có; ghi gate BLOCKED và tiếp tục phần độc lập. Không hỏi lại nghiệp vụ đã chốt. Chỉ hỏi nếu còn quyết định thật sự chưa có câu trả lời và chặn tính đúng của tiền/quyền; để nhánh đó chưa hoạt động trong khi chờ.
- Dependency mới chỉ thêm khi cần cho yêu cầu thực tế và không có giải pháp phù hợp đã có; kiểm runtime Workers, license và lockfile. Không tự viết parser định dạng phức tạp không an toàn để tránh một dependency cần thiết.

Ngay đầu lượt tạo `docs/technical/post22-repair-handoff.md`: bảng P22/S12 giữ nguyên ID, trạng thái, root cause, file/test liên quan, checkpoint hiện tại và bước tiếp theo. Tài liệu này là trạng thái tiếp tục qua các lần hết context. Không đổi tên mô tả finding cũ để đánh dấu RESOLVED.

## 2. Các quy tắc nghiệp vụ phải giữ

- Một CLB; tối đa 2 cuốn trên mỗi phiếu. Mượn cộng đúng 14 ngày lịch. Gia hạn tối đa 3 lần, mỗi lần 14 ngày; gia hạn trong hạn cộng từ hạn hiện tại, quá hạn phải chốt phạt rồi tính từ ngày gia hạn.
- Cọc từng quyển: làm tròn mốc 50k gần nhất, đúng điểm giữa làm tròn lên, tối thiểu 50k; không có giá mặc định 50k. Ví dụ 74k→50k, 75k→100k, 230k→250k. Không tự đổi chính sách về làm tròn lên toàn bộ.
- Phạt 1k/ngày cho toàn phiếu, cap bằng tổng cọc phiếu; có thể giảm/miễn với lý do. Phạt nhỏ hơn cọc: hoàn cọc và thu phạt riêng. Phạt đạt/vượt cọc: giữ cọc theo quyết định, không thu vượt cọc. Ngày hạn theo VN, hết ngày; lịch trực/ngày lễ điều chỉnh theo policy đã chốt.
- Trả một phần: giữ lịch sử phiếu cũ, chốt phạt, tạo phiếu mới cho sách còn giữ với hạn và số lần gia hạn tính lại. Phân biệt trả vật lý, chuyển tiếp và mất; không giả `returned_at` cho sách chưa nhận. Trường hợp dùng hết 150k cọc để phạt và còn giữ sách cọc100k: phải nhận 100k cọc mới thật trước khi kích hoạt đúng trạng thái.
- Nhận sách, quyết định phạt, thu phạt, hoàn cọc và nhận cọc mới là các trạng thái riêng. Không coi thao tác trên web là bằng chứng tiền đã chuyển. CASH/BANK có thể khác nhau giữa thu và hoàn; từng chiều có amount/method/confirmation riêng.
- Quỹ cọc mượn–trả tách quỹ hoạt động. Hội phí khoảng100k chỉ thu một lần suốt thời gian thành viên. Hộp tiền quầy dùng chung; người trực chính kiểm đầu/cuối buổi.
- Sách bán là lô mới riêng, không lấy sách cho mượn để bán. Khách không nợ, không hoàn hàng đã mua. CLB có thể nợ nhà sách; trả dư là hoàn hàng cho nhà sách. Ví dụ nhận100 giá nhập65k, bán60 giá80k, trả40: thu4,8tr, trả nhà sách3,9tr, lãi gộp900k. Nếu cọc1tr, nhận hoàn cọc1tr và trả3,9tr là hai giao dịch riêng.
- Thành viên đang hoạt động quản lý nghiệp vụ; admin quản lý tài khoản/nhật ký toàn hệ thống. Cựu thành viên chỉ xem hoạt động được phép, không PII/tiền/tài khoản ngân hàng/export. Nội bộ dùng username/password do quản lý cấp; Google guest không được nâng quyền nội bộ chỉ vì trùng email.
- Giữ Google Form và đồng bộ; review khách phải đăng nhập và chờ duyệt. Phân ca chính đủ13:45–17:15; hỗ trợ đủ đầu/cuối buổi; người mới chưa đào tạo chỉ hỗ trợ. Không đổi design/theme hoặc workflow đã duyệt nếu không cần sửa lỗi.

## 3. Đợt A — Chặn lỗi bảo mật và vận hành giả thành công

Sửa **P22-01, P22-02 và phần fail-closed của P22-11** trước.

### A1. Webhook

- Bỏ khóa mặc định trong source. Thiếu/empty secret phải trả lỗi cấu hình rõ, không chấp nhận request và không ghi DB.
- Xác minh HMAC trên timestamp + raw body; kiểm thời gian, kích thước và header không hợp lệ an toàn. Nếu giữ shared token vì tương thích, chỉ dùng secret cấu hình thật, không có fallback public.
- Đồng bộ Apps Script, test fixture và runbook. Không hardcode secret thật hoặc log secret/signature/body chứa PII.
- Test qua route: thiếu/empty/sai/đúng secret, body bị đổi, timestamp hết hạn, header bất thường và request trùng; invalid auth không chạm mutation. Secret hợp lệ không thay business dedupe.

### A2. XLSX

- Giới hạn ngay khi giải nén, dùng kích thước thực, chặn cả một entry lẫn tổng entry vượt giới hạn. Kiểm bounds/header/entry count/format trước parse XML; không cấp phát hết rồi mới kiểm.
- Kiểm XLSX thật và các ZIP layout hợp lệ cần hỗ trợ; không chỉ dùng fixture tự tạo thuận lợi. Giữ chặn macro và giới hạn số dòng/file hiện có.
- Regression bounded: input nhỏ khai output1byte nhưng thực trên25MiB, nhiều entry vượt tổng, file hỏng/truncated/size không khớp, file hợp lệ. Không stress gây cạn RAM hoặc tấn công endpoint thật.

### A3. Backup/restore

- Thiếu pg_dump/psql, dump hỏng/rỗng, SQL error hoặc verify failure phải exit khác0; bỏ nhánh tạo backup mô phỏng/báo phục hồi thành công giả.
- Restore dừng theo lỗi SQL bằng ON_ERROR_STOP và kiểm cả bước verify. Kiểm target trước thao tác; drill chỉ dùng DB disposable rõ ràng, không tự fallback sang DATABASE_URL có dữ liệu thật.
- Cả PowerShell và Bash có hành vi tương đương. Không tuyên bố loại sạch password hashes/credentials khỏi dump nếu chưa có cơ chế thật; dữ liệu cần phục hồi phải được bảo vệ bằng kiểm soát truy cập/lưu trữ phù hợp.
- Unit serialize/filter JSON chỉ là unit; không gọi đó là PITR/RPO/RTO. Drill thực làm ở đợt G.

Checkpoint A: các counterexample tương ứng bị chặn bởi regression mới; record exit/error và trạng thái runtime còn thiếu. Sau đó tự tiếp tục B.

## 4. Đợt B — Sửa contract API, loader và biên LIVE/DEMO

Sửa **P22-03, S12-01, S12-04, S12-05**; giữ sửa đúng của S12-02/07/08.

- Chốt một quy ước envelope và unwrap trong helper. Kiểm toàn bộ API methods, không chỉ sales. Danh sách, pagination/meta, detail và response nhiều phần phải giữ được dữ liệu mà caller dùng; payload không hợp lệ phải báo lỗi rõ, không fallback thành dữ liệu rỗng/mock.
- Adapter→handler regression cho duty/recruitment/evaluation/sales/events/content/reports, và quầy cũ. Sales sau commit phải có kết quả đúng cho UI đọc, cập nhật tồn/readback, không báo thất bại chỉ vì sai envelope.
- Loader sách phải tìm/scan/fetch copy từ catalog thật, giữ phân trang/filter; sách chưa từng mượn vẫn mượn được. Không suy tồn từ loan history, không load toàn bộ PII/sách để lọc client. Phân biệt AVAILABLE/BORROWED/LOST/CARRIED_FORWARD đúng model.
- Mỗi ý định mutation có action/key/payload ổn định qua double-click, timeout và recovery cần thiết sau reload. Cùng ý định retry dùng lại key; ý định mới dùng key mới. Không cache PII/secret thừa trên máy dùng chung. Kết quả chưa rõ phải tra chứng từ/kết quả theo quyền trước khi yêu cầu thao tác tiền lại.
- Test mất response sau commit: renew chỉ tăng1lần; sale/payment/collect/refund không ghi hai lần. Key trùng nhưng payload/path khác bị từ chối theo contract; cached response vẫn kiểm quyền hiện hành.
- DEMO cách ly toàn bộ mutation, gồm reconciliation/evaluation/sales/events/content/export, không chỉ các handler cũ. LIVE→DEMO không dùng lại live session/entity để ghi thật. Test spy chứng minh không có live mutation trong DEMO.
- Logout/401/403/đổi role/mode phải clear dữ liệu nhạy cảm liên quan và hủy/bỏ response cũ; catch con không giữ dữ liệu nhạy cảm như thể còn hợp lệ. Không map guest thành active member. API server vẫn là nơi quyết định quyền.

Checkpoint B: bảng methods/callers đã kiểm, adapter tests và mode/role tests; không coi generic TypeScript cast là validation JSON. Tiếp tục C.

## 5. Đợt C — Sửa schema và service theo một model canonical

Sửa **P22-06, P22-07, P22-08, P22-09**.

- Inventory baseline, mọi migration, seed và test harness. Xác định một đường cài mới và một đường nâng cấp có dữ liệu; không chạy tùy ý một migration riêng rồi tuyên bố toàn chuỗi đúng.
- `book_reviews`: nâng cấp/rename/backfill từ title_id/reader_name/... sang contract chọn cuối cùng, giữ review cũ và moderation state. `CREATE TABLE IF NOT EXISTS` không thay migration nâng cấp bảng hiện hữu. Kiểm index/FK/nullability và chạy lại an toàn theo cơ chế migration.
- Roster: query đúng members canonical, gồm is_active/is_alumni/is_eligible_main_duty; chưa đào tạo mặc định không trực chính. Student ID nếu thật sự cần phải có field/migration/model rõ, không để mock có cột mà DB không có. Kiểm generate/list/detail/manual-edit/publish/attendance và lịch bận.
- Conversion: dùng UUID đúng kiểu cho member/affiliation, đầy đủ trường bắt buộc, map đúng enum team/role. Dữ liệu gen/năm/ban đến từ đợt tuyển hoặc input được validate, không hardcode gen10/K68/2026; thiếu thông tin bắt buộc phải yêu cầu bổ sung rõ. Transaction + constraints chống hai request đồng thời chuyển cùng đơn hoặc cùng username.
- Circulation report: dùng đúng created/borrow date, receipt due date và item state. Định nghĩa rõ chỉ số đếm phiếu hay bản; FULL/PARTIAL/LOST đúng enum, carry-forward không thành trả vật lý. Giữ history nhiều thế hệ.
- Integration phải gọi service/handler thật, không chỉ kiểm bảng tồn tại/INSERT thủ công. Bổ sung migration upgrade test có dữ liệu cũ, fresh install, seed, retry và concurrent conversion.
- Không nới schema/constraint/auth để vừa với mock sai; sửa fixture bám model thật. Không drop dữ liệu người dùng, ghi đè lịch sử tài chính hoặc sửa migration cũ theo cách làm mất đường nâng cấp.

Checkpoint C: schema–query–DTO thống nhất, kết quả fresh/upgrade test rõ. Thiếu PostgreSQL giữ gate BLOCKED, hoàn thiện SQL/tests và tiếp tục phần độc lập D.

## 6. Đợt D — Sổ tiền đúng quỹ, đúng nguồn, đúng một lần

Sửa **P22-04, P22-05, P22-10, S12-06 và phần còn lại S12-09**.

- Dùng ledger/finance service hiện có cho toàn bộ dòng tiền; không cộng field két để thay journal. Xác định rõ thời điểm ghi nhận doanh thu, giá vốn/nợ nhà sách và cọc nhà sách để không đếm lặp lúc bán/quyết toán/thanh toán.
- Cọc bạn đọc ở quỹ LOAN; hội phí, bán sách và hoạt động ở OPERATION với tiền thực tế tách biệt. Thu hội phí không tăng két LOAN và không ép mở ca LOAN chỉ để ghi hội phí. Nếu cần account/session cho quỹ hoạt động, mở rộng tối thiểu theo cấu trúc hiện có.
- Sale chỉ hoàn tất khi đúng điều kiện thực thu; không cho khách mua nợ. Không PAID chỉ vì gọi API. Supplier payable và refund cọc có trạng thái/confirmation riêng; trả hàng vật lý không tự nhận hoàn tiền.
- Mỗi mutation receipt/stock/payment/ledger/audit/idempotency atomic. Validate integer VND/safe bounds, phương thức, trạng thái quỹ/két và số dư; rollback khi bước sau lỗi. Retry cùng ý định và key khác cùng source không tạo double payment hoặc double refund.
- Không backfill journal cho dữ liệu cũ bằng suy đoán PAID=đã nhận thật. Nếu có dữ liệu nghiệp vụ cũ, chuẩn bị reconciliation/migration có kiểm chứng; dữ liệu chưa xác minh giữ trạng thái cần đối soát, không gọi đó là số dư chuẩn.
- Correction tiền phạt phải tham chiếu đúng settlement/renewal decision và lần thu gốc. Không chọn “settlement mới nhất trên receipt” để đảo tiền của một renewal khác. Với nguồn cũ mơ hồ, có migration/reconciliation xác định được hoặc từ chối an toàn kèm hướng xử lý; không đoán.
- Một thứ tự lock nhất quán trên mọi đường explicit/implicit session, receipt, item/allocation, decision và journal. Các cash availability checks phải dùng nguồn canonical dưới lock, không tin field có thể lệch journal. Kiểm cả close-session so với thu/hoàn/correction.
- Report tách opening, movement và closing. Số dư cộng dồn tới cutoff; thu/chi theo kỳ. Mốc thời gian VN và khoảng cuối loại trừ, không đếm giao dịch đúng00:00 hai lần. JSON/export/drilldown dùng cùng định nghĩa và snapshot nhất quán khi cần.

Các regression tiền bắt buộc:

1. Mở két LOAN200k, thu hội phí100k: két LOAN và summary vẫn200k; OPERATION tăng100k.
2. Nhận100 cuốn, nhập65k, bán60 giá80k, trả40: thu4,8tr; nợ/phải trả3,9tr; lãi gộp900k; tồn/lô và ledger khớp. Cọc1tr hoàn riêng và thanh toán3,9tr riêng.
3. Thiếu confirmation, số âm/thập phân/vượt safe range, ca đóng, không đủ tiền, retry sau commit, hai người bán cuốn cuối, hai người trả cùng khoản nợ, lỗi giữa transaction: không ghi tiền/tồn sai hoặc ghi một phần.
4. Cọc50k nhận trước kỳ, hoàn50k trong kỳ: liability cuối kỳ0, không phải-50k. Không phát sinh nhưng có opening balance vẫn hiện đúng.
5. Renewal fine rồi return fine trên cùng receipt; đảo/thu lại từng nguồn chính xác, không chạm quyết định khác; giữ chứng từ bất biến và audit.
6. Giữ regression FULL selectors, mất một phần/coverage, pending refund cancel, carry-forward không giả trả sách, mã entry không trùng. Chạy PG barriers/observer cho các cuộc đua quan trọng khi có runtime.

Checkpoint D: bảng nghiệp vụ→journal→fund→source→idempotency→test và kết quả đối soát. Không lấy tổng Nợ=Có đơn thuần làm bằng chứng toàn bộ tiền đúng. Tiếp tục E.

## 7. Đợt E — Hoàn tất quầy và pending workflows

Sửa phần còn lại **S12-03/04/05**, nối các sửa backend vào UI thực.

- Có readback/detail và hàng chờ thao tác cho refund pending, fine pending, new deposit pending; gọi đúng nguồn/intents/decision. Confirm/cancel đúng quyền, phương thức và số tiền; refresh/reload/ca sau vẫn xử lý được.
- Quote tiền phạt/hạn/ngày VN/ngày nghỉ từ server; server revalidate quote/version khi thực thi. UI không tự quyết định phạt từ raw dueDate. Cho giảm/miễn có reason theo policy cộng đồng; không biến tiền phạt thành quy định mới khắt khe hơn.
- Return physical trước nhưng chưa hoàn cọc phải hiện đúng việc còn phải làm; không báo “đã hoàn tiền” khi mới tạo intent. T73 dùng hết cọc rồi nhận cọc mới phải có trạng thái chờ và thao tác nhận thật.
- Mỗi chiều tiền có checkbox mặc định false, amount/method rõ; sau commit hiển thị chứng từ/kết quả và dùng lại action key khi retry. Không nút success giả hoặc fallback INITIAL_* trong LIVE.
- Kiểm desktop/mobile và thao tác bàn trực bằng dữ liệu tổng hợp khi browser chạy được; dialog/focus/Escape/scroll, lỗi và loading phải dùng được. Nếu chỉ đọc source thì giữ browser gate chưa đạt.

## 8. Đợt F — Public data, export và tài liệu khớp implementation

Sửa **P22-12, S12-10** và các thiếu sót đã nêu trong review.

- `/sach/[id]` lấy sách thật từ nguồn public-safe; chọn cách render/cập nhật phù hợp deployment hiện có. Không chỉ build6id mock rồi coi là SEO catalog thật.
- Sách mới thêm có URL thật; approved review mới/sửa/ẩn được phản ánh đúng cơ chế cập nhật. Nội dung chưa duyệt không public; không lộ email, actor nội bộ, số điện thoại hay lịch sử mượn. Canonical/sitemap/robots theo cấu hình môi trường; staging noindex.
- Giữ phân quyền guest/member/admin/alumni ở API lẫn export/download; kiểm thu hồi quyền ngay lúc tải, không chỉ lúc cấp ticket. Tránh ticket/report chỉ tồn tại trong memory một process nếu deployment có nhiều Workers instance.
- Hoàn thiện xuất XLSX và PDF theo yêu cầu, giữ CSV nếu hữu ích; không gọi CSV là XLSX/PDF. File thật mở được, tiếng Việt đúng, dữ liệu khớp report, chống formula injection trong spreadsheet, kiểm HTML/PDF content an toàn và giới hạn tải.
- Đồng bộ OpenAPI với route/body/DTO/status/error mới; lint và contract tests là hai gate khác nhau. Cập nhật diagram/source, domain/transaction docs, runbook cài mới/nâng cấp/backup/restore theo file thật tồn tại.
- Sửa progress/README bỏ tuyên bố toàn bộ PASS/100%/RPO/RTO/PITR khi chưa có proof. Lịch sử claim cũ có thể giữ kèm đính chính rõ; bảng trạng thái hiện tại phải đúng, không chỉ append thêm một mục “hoàn tất”.

## 9. Đợt G — Kiểm chứng cuối và bàn giao thật

Chạy check phù hợp sau từng đợt; cuối lượt chạy baseline và các gate sau sửa, không lặp full suite vô ích:

- `pnpm run check`, `pnpm run build`, unit suite, Python experiments còn áp dụng, OpenAPI lint. Dùng RTK nếu có và không mất exit/evidence cần thiết.
- Chạy các adapter→handler regressions mới; phân biệt SQL double với PostgreSQL thật. Nếu cần chế độ Node không isolation vì môi trường, ghi đúng lệnh và giới hạn, không gọi kết quả đó là production runtime.
- PostgreSQL disposable: cài/nâng cấp schema, service/route integration, rollback, uniqueness, race, ledger, balance và grants/app role đúng scope. Không sửa guard TEST_DATABASE_URL để vào DB thật cho tiện.
- Workers local/dry-run: kiểm compatibility, DB adapter, auth và dependency mới; build frontend không thay gate này. Điều tra `spawn EPERM` trong quyền local, không tự nâng quyền/đổi global security. Không deploy.
- Browser: điều tra lỗi dev `module is not defined`, mở đúng checkout/server; xác minh public/detail/login và luồng chính desktop/mobile/role/mode. Không dùng screenshot cũ hoặc fixture browser thay live API proof. Không bypass cài đặt browser bị tắt.
- Google Form/provider: nếu chưa có môi trường/secret được cấp cho test thì ghi BLOCKED, có hướng dẫn thao tác chính xác; không tự cấu hình tài khoản hay gửi đơn/thông báo vào kênh thật.
- Backup/restore drill thực trên DB disposable: có dữ liệu tổng hợp đủ ledger, stock, pending states, review và auth state; dump→restore đích sạch→verify record/source/balance/inventory/token revocation, đo thời gian thật. RPO cần lịch backup/lần backup thành công được chứng minh; RTO đo recovery drill. Dump logic không tự là PITR.
- Tải mục tiêu: dưới5.000 sách, dưới100 lượt/buổi,3–5 người ghi; ưu tiên query/transaction/concurrency cần thiết. Không load-test dịch vụ public hay tài khoản free ngoài quyền cho phép.

Snapshot review trước có199unit và23Python pass,49DB results bị chặn setup, Workers spawn EPERM và browser chưa kiểm được. Đây là số lịch sử để tham chiếu; tự chạy lấy số hiện tại. Không cần giữ nguyên số test nếu regression mới làm tăng suite; không xóa test/gate để đạt pass.

## 10. Điều kiện kết thúc

Sau mỗi checkpoint cập nhật handoff: việc đã làm, file đổi, tests/lệnh/kết quả/log, finding còn mở, blocker và bước tiếp chính xác; tiếp tục đợt sau. Nếu hết context, đọc handoff và tiếp tục, không khởi động lại từ A.

Bàn giao cuối bằng tiếng Việt, gồm:

1. Tóm tắt hành vi đã sửa và danh sách file chính.
2. Bảng từng P22-01…12 và S12-01…10, giữ nguyên mô tả: `OPEN`, `PARTIAL`, `FIXED_SOURCE`, `VERIFIED` hoặc gate `BLOCKED`; bằng chứng cụ thể và phần còn thiếu cho mỗi dòng. VERIFIED chỉ dùng khi đạt các gate cần cho finding đó.
3. Tests/checks thực chạy, exit code, số pass/fail/blocked và đường dẫn log; tách source/unit/double/adapter/PG/Workers/provider/browser/restore.
4. Mọi lỗi còn lại, rủi ro, thao tác chỉ chủ hạ tầng mới làm được và lệnh/bước tiếp chính xác. Không đưa secret/PII vào handoff.

Hoàn tất khi sửa hết phần local được phép, kiểm tra phần liên quan và xử lý regression do thay đổi gây ra. Nếu còn thiếu runtime/credential thì kết luận PARTIAL với gate BLOCKED và bàn giao rõ; không tuyên bố toàn sản phẩm đã hoàn tất hoặc sẵn sàng tiền thật chỉ từ build/unit tests. Bắt đầu thực hiện ngay sau khi đọc đầu vào.
