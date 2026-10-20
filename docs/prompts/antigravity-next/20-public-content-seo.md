# Chặng 20 — Nội dung công khai, kiểm duyệt và URL sách/review

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 03, 06, 19 cho activity.

**Findings liên quan:** R10 (review success giả), R13 (public PII).

**Files/responsibility:** Tạo src/modules/content/, routes sách/review/publication/moderation; sửa PublicPortal.tsx và các page Astro phù hợp; tests/integration/content-policy.test.ts và UI smoke.

## Thực hiện

- [ ] Guest có phiên hợp lệ mới submit; lưu author identity/book/version/pending và trả kết quả thật. Không chỉ bật success state.

- [ ] Member duyệt mới public; sửa nội dung đã duyệt tạo version chờ duyệt, không lộ trước. Sanitize/link validation và giới hạn chống spam.

- [ ] Chi tiết sách/review có URL và metadata HTML riêng, dùng được khi share/back/refresh; public không có người mượn/ghi chú riêng.

- [ ] Preview/staging noindex nhưng không dùng nó thay authorization. Không giới hạn Google khách ở sis.hust.edu.vn khi chưa có chính sách đó.

- [ ] Giữ theme/design.md và làm đúng luồng. Nêu rõ dữ liệu demo, nguồn ảnh và số liệu.

## Gate phải chứng minh

Anon submit bị chặn; bài pending không public; bản sửa chưa duyệt không XSS hoặc leak; direct URL refresh đúng; Google trùng email liên hệ không có quyền nội bộ; HTML SEO không chứa PII riêng.

## Đầu ra

Public/content local có API/Auth và URL đúng; bỏ luồng submit báo thành công giả.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

