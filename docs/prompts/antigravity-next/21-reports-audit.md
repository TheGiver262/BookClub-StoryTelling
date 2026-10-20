# Chặng 21 — Dashboard, Excel/PDF và nhật ký đúng quyền

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 05, 07–20 theo dữ liệu báo cáo.

**Findings liên quan:** R06 (coverage), R04/R13 (số liệu).

**Files/responsibility:** Tạo src/modules/reporting/, src/modules/audit/queries.ts, private export/download handlers; tests/integration/reports.test.ts, exports-access.test.ts; nối UI báo cáo/admin.

## Thực hiện

- [ ] Bộ báo cáo cơ bản đủ tuần/tháng/quý/năm; HTML/Excel/PDF chung snapshot/filter/nguồn. Tách cash/bank/cọc/nợ/doanh thu, drill-down về chứng từ, không dùng tổng mock.

- [ ] Xuất file thật có tiếng Việt/phân trang và xử lý formula injection. Giới hạn thời gian/số dòng/concurrency; đo CPU/bộ nhớ trước chọn async/runtime.

- [ ] File private, tải theo quyền hiện tại; cựu không tạo/tải, gồm link cũ và job còn chờ sau revoke. Không phát URL public lâu dài.

- [ ] Global audit chỉ admin; redact secret/PII phù hợp. Analytics lượt xem sách/review tổng hợp, không thu thừa.

## Gate phải chứng minh

Hai định dạng cùng kỳ/filter/snapshot khớp tổng; không đếm trùng chi/cọc/settlement. Fixture công thức độc hại an toàn; test download sau revoke; load bounded; render file kiểm chữ Việt và layout.

## Đầu ra

File/báo cáo thật khớp journal; không dùng modal preview để báo đã xuất.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

