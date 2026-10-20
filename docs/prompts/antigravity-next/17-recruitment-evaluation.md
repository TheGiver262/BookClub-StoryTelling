# Chặng 17 — Rubric phiên bản, phỏng vấn và tổng kết tuyển

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 13, 16.

**Findings liên quan:** R07 (rubric), R13 (public fields).

**Files/responsibility:** Tạo src/modules/recruitment/evaluation.ts, decisions.ts; schema rubric/criteria/grades/history/interviews; tests/integration/recruitment-evaluation.test.ts; nối UI chấm.

## Thực hiện

- [ ] Rubric theo campaign/version, tiêu chí/thang điểm/trọng số lấy từ mẫu; thiếu công thức thì chưa tự tổng hợp, không tự chọn trung bình cộng.

- [ ] Lưu phỏng vấn, câu hỏi/trả lời/bài viết và phân công. Chấm riêng/chung giữ nguồn; sửa có trước/sau/người/giờ/lý do và phát hiện xung đột sửa.

- [ ] Hội đồng tổng kết sau; quyết định/phân ban khác nguyện vọng; chuyển trúng tuyển thành member đúng một lần.

- [ ] Kết quả public chỉ trường được duyệt. MSSV/họ tên/ban chưa được xác nhận là policy thì không tự xuất raw candidate.

## Gate phải chứng minh

Rubric năm sau không đổi điểm cũ; hai người chấm/sửa không mất nguồn; lý do/audit đủ; sync giữ evaluation; convert retry không tạo hai member; guest/alumni không đọc điểm.

## Đầu ra

Mô phỏng trọn đợt tuyển bằng dữ liệu giả, không thêm AI grading hoặc ghi âm.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

