# Chặng 02 — PostgreSQL local, migration và invariant tối đa hai sách

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-stage01-followup.md, review gốc docs/reviews/2026-10-18-antigravity-review.md, index docs/prompts/antigravity-next/README.md và đặc tả docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md, docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 01.

**Findings liên quan:** R01, R03, R08; sửa nốt S01-01..S01-04 trước phần DB.

**Files/responsibility:** Sửa docs/technical/schema/01_schema.sql và seed liên quan; tạo tests/integration/schema.test.ts, tests/integration/loan-item-constraints.test.ts và test DB harness nhỏ nhất; sửa package.json/lock khi cần cho lệnh test:db. Tái dùng helper/runner nếu đã có. Đồng bộ domain-data, nguồn/render diagram bị ảnh hưởng. Sửa tài liệu carryover ở progress, technical README, security-operations và nhãn giả định trong design.md; giữ nguyên nhận diện/giao diện.

## 0. Sửa nốt tài liệu chặng 01

- [ ] S01-01: khôi phục progress đủ 22 mã/tên/link theo index. Sáu slice trong implementation-plan là góc nhìn kiến trúc riêng, không thay số chặng giao việc. R02 ở 09, UI integration ở 12, scheduler ở 15; map các finding nhiều lát đúng index. Chặng 01 chỉ đóng phần tài liệu sau khi đã sửa và kiểm lại.
- [ ] S01-02: đối chiếu từng hàng traceability với operationId thật và nội dung T01–T74. Dùng createLoanReceipt, settleReturnReceipt, renewLoanReceipt, listAlumniActivities khi đúng chức năng. recordLoanLoss/auditScoreHistory chưa có hợp đồng thì ghi dự kiến/chưa có; không bịa endpoint đã implement. Sửa cả các test ID tồn tại nhưng sai nghiệp vụ. Bỏ tuyên bố API đã đủ cả 9 nhóm khi coverage chưa có.
- [ ] S01-03: ghi đúng cấp bằng chứng. Regex không xác nhận cú pháp DDL; Python mutex/SQLite không kiểm PostgreSQL concurrent; parse chuỗi không là import Excel thật; test scheduler đang pass không xóa phản ví dụ R11. Ghi PostgreSQL local chưa apply cho đến khi có kết quả thực dưới đây.
- [ ] S01-04: traffic >70%, request/dung lượng và kết luận free tier đủ dùng phải mang nhãn giả định/chưa đo. Quota có URL chính thức/ngày xác minh; không tự đổi policy PII, RPO/RTO thành quyết định đã chốt. Không đổi màu/font/layout để xử lý nhãn tài liệu.
- [ ] Ghi version/lệnh OpenAPI validator tái chạy được, ưu tiên dùng công cụ đang có. Reviewer đã chạy Redocly 2.64.1: 0 lỗi, 24 warning. Không bịa license/server để xóa warning; liệt kê warning còn mở và lát sở hữu error contracts.

## Thực hiện

- [ ] Kiểm prerequisite. Reviewer chưa chạy được Docker daemon và không thấy psql trên PATH. Dùng PostgreSQL local dùng một lần, ghi version thực. Có thể dùng test container hoặc instance local hợp lệ; không tự tải/chạy script không rõ nguồn, không kết nối cloud/production. Nếu chưa có runtime thì hoàn thiện phần độc lập, ghi gate DB BLOCKED và cách chạy lại; không thay bằng SQLite hoặc báo hoàn tất.

- [ ] Harness nhận TEST_DATABASE_URL, fail closed nếu thiếu hoặc không nhận diện được DB test. Chỉ cho reset DB disposable do task sở hữu: host local/test container đã xác định, tên ví dụ ysbk_test_*; không reset tên mặc định postgres/template hoặc schema DB người dùng. Không in password/connection string. Dọn đúng tài nguyên test đã tạo; không xóa thư mục/volume rộng để lấy môi trường sạch.

- [ ] Viết test tái hiện trước sửa rồi apply nguyên DDL/seed trên DB sạch, không tạo schema rút gọn riêng trong test. Bắt lỗi unaccent trong generated column. Dùng trigger search-vector hợp lệ hoặc cơ chế index khác có căn cứ; không gán IMMUTABLE giả cho unaccent để né lỗi. Kiểm search khi INSERT, UPDATE title/description, description NULL, có dấu/không dấu; kiểm định nghĩa GIN index và query dùng cùng normalization. Không khẳng định planner dùng index trên seed rất nhỏ nếu chưa có EXPLAIN thích hợp.

- [ ] Bảo vệ invariant tối đa 2 loan_items/phiếu ở DB. Có thể serialize trên parent receipt hoặc dùng cấu trúc ràng buộc tương đương; chứng minh theo isolation level thực. Xử lý INSERT, UPDATE chuyển receipt_id, bulk và thứ tự khóa ổn định nếu khóa hai parent. Không chặn nhầm UPDATE thường của dòng đã nằm trong phiếu đủ hai sách; không chỉ đếm trong UI hoặc đổi tên trigger.

- [ ] Thiết lập runner integration phù hợp TypeScript hiện có; dùng dependency nhỏ nhất cần thiết, không tạo framework test mới nếu đã có runner. Hai client phải là hai connection PostgreSQL độc lập. Dùng barrier/điều phối để tái hiện tranh chấp, cho transaction thứ hai thực sự chạm DB khi transaction đầu còn mở; không dùng mutex ứng dụng tuần tự hóa toàn bộ phép ghi, không chỉ Promise.all mà không chứng minh overlap. Có timeout và rollback khi lỗi để test không treo.

- [ ] Giữ partial unique active-copy; không xóa nó để né lỗi chuyển tiếp. Đồng bộ từ điển/index/ERD phần vừa sửa.

## Gate phải chứng minh

1. **G-doc:** sửa đủ S01-01..S01-04, 22 chặng nhất quán; mọi operation/test reference có ý nghĩa và mức bằng chứng đúng. Ghi version TypeScript theo package/installed thực, không giữ con số sai trong progress.
2. **G-schema/search:** nguyên DDL và seed apply vào PostgreSQL sạch; search insert/update/NULL/có dấu/không dấu đúng. Giữ extension, FK, index và seed cần thiết; ghi cách setup và lệnh tái chạy. Không tuyên bố migration production đã chạy.
3. **G-invariant:** các test thật sau phải pass:
   - Thêm dòng thứ ba bị từ chối; INSERT bulk ba dòng vào phiếu rỗng rollback toàn câu lệnh.
   - Phiếu đã có một dòng: hai transaction đồng thời thêm hai bản sách khác nhau; chỉ tối đa một lần thêm được commit, tổng cuối cùng không quá hai. Ghi lỗi/rollback hoặc retry dự kiến, không biến lỗi SQL thành success.
   - UPDATE chuyển một dòng từ phiếu khác sang phiếu đủ hai bị từ chối, dữ liệu hai phiếu vẫn đúng sau rollback.
   - UPDATE thuộc tính thông thường trên một dòng của phiếu đủ hai vẫn hợp lệ.
   - Hai phiếu tranh cùng một bản sách active vẫn bị partial unique index chặn. Không xóa index để né R02; R02 chuyển tiếp được xử lý ở chặng 09.
   - Sau lỗi/rollback, không còn dữ liệu dở dang hoặc connection/lock khiến lần chạy tiếp treo.
4. **G-baseline:** pnpm run test:db thực thi các test PostgreSQL trên, exit 0; thiếu DB không được skip rồi báo PASS. Chạy lại pnpm run check, build (có thể dùng outDir riêng trong .review-artifacts), 22 Python tests và OpenAPI lint sau các sửa đổi liên quan. Python vẫn là bằng chứng phụ, không thay test:db.

Mỗi gate ghi PASS/PARTIAL/BLOCKED riêng. Nếu DB chưa khởi động được thì G-doc có thể PASS, G-schema/G-invariant vẫn BLOCKED; không đánh dấu cả chặng hoàn tất.

## Đầu ra

SQL đã sửa + integration harness có guard + kết quả PostgreSQL thực nếu runtime sẵn. Ghi version DB/isolation level, lệnh tái chạy, số test, exit code, dữ liệu giả trước/sau hoặc assert chứng minh invariant; không lưu secret. Thiếu DB thì ghi blocker cụ thể, phần đã làm và một lệnh chạy tiếp khi môi trường sẵn. Giữ nguyên review snapshot trước đó; không sửa report để biến kết quả cũ thành pass mới.

Ngoài scope: Auth HTTP, ledger/cash session, chuyển tiếp phiếu, UI quầy và solver lịch. Chỉ ghi finding của chúng còn mở ở đúng chặng; không tranh thủ triển khai hoặc đóng chúng vì schema pass.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

