# Chặng 15 — Sửa solver lịch, chỉnh tay và công bố có phiên bản

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 13, 14.

**Findings liên quan:** R11.

**Files/responsibility:** Tạo src/modules/duty/scheduler.ts, roster.ts, tests/unit/scheduler.test.ts và tests/integration/roster.test.ts; sửa PoC Python nếu giữ; nối màn hình trực.

## Thực hiện

- [ ] Main phải đủ đào tạo, đang hoạt động và rảnh cả14–17 lẫn chuẩn bị/thu dọn. Helper chỉ cần đầu/cuối. Khoảng thu dọn17–17:15 đang tạm phải giữ nhãn, không tự chốt policy.

- [ ] Cảnh báo riêng thiếu main/support; dưới ba helper không được báo đủ. Fairness mềm xếp sau điều kiện cứng; tạo nháp không tăng counter lịch sử như lịch đã chốt.

- [ ] Nháp, sửa tay và công bố có version; cùng validator áp dụng auto/manual. Tạo lại đề xuất không mất sửa tay hoặc âm thầm đổi lịch đã công bố.

- [ ] Soạn nội dung/link Facebook, không gửi. Lưu vai trò giới thiệu/ghi sổ/kiểm tiền/chuẩn bị và điểm danh theo ca.

## Gate phải chứng minh

Phản ví dụ main rảnh14–17 nhưng bận đầu/cuối bị loại; hai helper có warning; người bận giữa vẫn làm helper được; cựu/người mới/chưa rõ lịch/overlap; sửa tay và regenerate giữ ràng buộc.

## Đầu ra

Lịch có persistence, solver dùng chung validation với UI/API; test R11 phải fail trước sửa.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

