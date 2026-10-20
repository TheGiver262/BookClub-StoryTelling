# Chặng 16 — Tiếp nhận và đối soát Google Form

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 03, 02.

**Findings liên quan:** R06 (webhook), R07 (Form model).

**Files/responsibility:** Tạo src/modules/recruitment/ingest-form.ts, form-reconciliation.ts, schema form/question/response versions, source Apps Script và hướng dẫn, tests/integration/form-sync.test.ts.

## Thực hiện

- [ ] Khóa nguồn FormID + responseID; ánh xạ câu hỏi có version, nhiều nguyện vọng và dữ liệu nguồn tách điểm chấm trên web.

- [ ] Callback xác thực chữ ký/secret, thời gian/replay, kích thước/schema; commit bền trước ACK; retry/backoff và đối soát checkpoint; trạng thái sync/lần cuối quan sát được.

- [ ] Sync lại không xóa điểm, ghi chú hoặc quyết định; ánh xạ lỗi phải cảnh báo, không ghi đè âm thầm. Guest không được tạo hồ sơ qua callback giả.

- [ ] Local dùng fixture có chữ ký và giả lập mất response sau commit. Trigger thật chỉ cấu hình khi có tài khoản được cấp đúng phạm vi; không tự tạo cloud project.

## Gate phải chứng minh

Giả chữ ký/replay bị chặn; duplicate và mất response vẫn một hồ sơ; đối soát bù phản hồi thiếu; sync sau chấm không mất điểm; response public không lộ PII.

## Đầu ra

Ingress/reconcile local chạy thật; chưa kết nối Form thì ghi gate ngoài hệ thống đang chờ.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

