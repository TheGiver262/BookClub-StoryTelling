# Chặng 13 — Thành viên, nhiều quan hệ ban và hội phí một lần

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 03, 04.

**Findings liên quan:** R07 (members), R05 revoke.

**Files/responsibility:** Tạo src/modules/members/, migration member affiliations/history, routes/member DTO; tests/integration/members-dues.test.ts; nối riêng màn hình thành viên.

## Thực hiện

- [ ] Một người có thể là trưởng Hậu cần và thuộc Ban chủ nhiệm qua quan hệ có thời gian; headcount không đếm trùng. Tách trường/năm/khóa và lịch sử chức vụ.

- [ ] Membership active/alumni riêng với khóa tài khoản. Chuyển cựu thu hồi theo03; không xóa chứng từ hoặc tự khóa vì tốt nghiệp.

- [ ] Hội phí khoảng100k một lần, có số thực thu và biên nhận; không chỉ gạt has_paid_fee hoặc thu lại năm sau. Ghi qua finance dùng chung.

- [ ] Guest/alumni không đọc danh bạ PII. Chỉ admin quản lý credential; quyền nghiệp vụ của thành viên không tự tạo quyền admin.

## Gate phải chứng minh

Hai quan hệ ban vẫn là một người; đổi chức không mất lịch sử; cựu còn đọc hoạt động an toàn; sang năm không tự thu hội phí; receipt retry không thu trùng.

## Đầu ra

Member/dues slice dùng được local, không mở rộng thành HR/LMS tổng quát.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

