# Chặng 14 — Import Excel lịch bận theo mẫu thống nhất

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 02, 03, 13.

**Findings liên quan:** R07 (availability), R08 (parser thật).

**Files/responsibility:** Tạo src/modules/duty/import-availability.ts, schema import batches/intervals/versions, fixture .xlsx giả, tests/integration/availability-import.test.ts; nối preview import.

## Thực hiện

- [ ] Chốt hợp đồng mẫu tổng hợp từ đặc tả/mẫu hiện có. Thiếu mẫu thì dùng bản đề xuất có nhãn, không tự xây bộ gom lịch từng trường.

- [ ] Đọc .xlsx thật với giới hạn bytes/dữ liệu giải nén/sheet/dòng; không thực thi formula, macro hoặc external link. Cột người/ngày hoặc tuần/giờ bắt đầu-kết thúc đủ rõ.

- [ ] Preview lỗi trước commit; thiếu/lỗi không thành rảnh. Giữ nguồn, chống trùng và version; import lại không nhân dữ liệu hoặc đổi lịch đã công bố.

- [ ] Dùng khoảng giờ có kiểu và ngày hiệu lực, thay phân loại vài keyword/tiết học trong PoC. Không thêm OCR hoặc parser từng trường.

- [ ] File lịch và dữ liệu cá nhân private; không vào bucket công khai hoặc HTML public.

## Gate phải chứng minh

Fixture XLSX thật hợp lệ và sai cấu trúc; giới hạn giải nén; người không nhận diện được, giờ/tuần mơ hồ; retry không nhân dữ liệu; dòng lỗi không thành rảnh.

## Đầu ra

Lịch bận có kiểu/version và preview thật; không gọi 1.000 dictionary rows là kiểm chứng Excel.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

