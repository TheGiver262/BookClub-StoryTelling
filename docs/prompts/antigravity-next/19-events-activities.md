# Chặng 19 — Hoạt động, sự kiện và nhiệm vụ liên kết quỹ

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 03, 04, 13.

**Findings liên quan:** R06 (event API), R07 (participants).

**Files/responsibility:** Tạo src/modules/events/, schema events/tasks/participants/budgets/expense source, tests/integration/events.test.ts; bổ sung OpenAPI/DTO cựu và nối UI.

## Thực hiện

- [ ] Kế hoạch/nhiệm vụ/người phụ trách/hạn/địa điểm; người tham gia gồm thành viên hoặc khách, không ép khách thành member.

- [ ] Budget khác chi thực tế; chỉ ghi finance một lần, event liên kết chứng từ. Hội phí ở13 không thu lại.

- [ ] Public/alumni dùng activity DTO allowlist; ảnh/file/nội dung tự do cũng có thể chứa tiền hoặc PII và cần duyệt. Không gửi đủ entity rồi giấu cột.

- [ ] Không thêm vé/đăng ký online/sức chứa hoặc quy tắc hai người duyệt chi chưa được giao; ghi đề xuất nếu thật sự cần.

## Gate phải chứng minh

Một expense xem event/finance/report vẫn đếm một lần; guest không cần MSSV; alumni không nhận tiền/contact/file riêng; thay role chặn request mới; sửa nhiệm vụ có audit.

## Đầu ra

Event domain/API cụ thể và traceability FR06 đúng, thay trang tĩnh.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

