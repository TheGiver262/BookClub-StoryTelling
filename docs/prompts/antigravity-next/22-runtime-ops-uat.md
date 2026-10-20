# Chặng 22 — Runtime triển khai, backup/restore và nghiệm thu toàn bộ

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 01–21.

**Findings liên quan:** R08, R13; mọi finding còn mở.

**Files/responsibility:** Sửa cấu hình runtime/deploy đã chọn, docs/technical/security-operations.md, progress/traceability/diagrams, integration tests, runbook và script backup/restore local.

## Thực hiện

- [ ] Kiểm adapter Workers, pool/TLS, endpoint provider Auth/Storage/Data API. Đo CPU, wall time, query và p95 với5.000 bản giả/năm người ghi, không suy từ static build.

- [ ] Đối chiếu quota với nguồn chính thức hiện tại; sửa claim hai connections hoặc edge latency10ms. Traffic/chi phí có công thức/cảnh báo; chưa đo thì ghi unknown.

- [ ] Backup schema/data/file/Auth/quyền bằng cơ chế đúng; không đưa secret vào repo. Restore vào môi trường sạch và đối soát; chỉ nhận đã đạt RPO/RTO sau đo và thống nhất policy.

- [ ] Đồng bộ ERD/state/sequence/API/SQL rồi render kiểm hình. Bổ sung nhánh Form retry, hoàn chậm và đóng ca; traceability dùng ID thật.

- [ ] Chạy gate toàn hệ thống, không còn lỗi tiền/quyền/PII đã biết. UAT đủ chín FR, desktop/mobile và2–4 buổi trực đối soát theo điều kiện dùng thật. Không tự deploy hoặc nhập PII production trong chặng này.

## Gate phải chứng minh

Có bằng chứng check/build/OpenAPI/DB/API/browser/restore. Regression Auth/link/revoke/money/concurrency đạt; không còn finding chặn. Không gọi go-live hoàn tất khi chưa có deployment và UAT thật được phép.

## Đầu ra

Báo cáo readiness local/staging, runbook/rollback và gate còn chờ; triển khai thật là bước riêng được người dùng cho phép.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

