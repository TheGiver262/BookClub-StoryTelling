# Chặng 01 — Sửa typecheck và trạng thái bằng chứng

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** Không có.

**Findings liên quan:** R08, R12, R13 (nhãn dữ kiện).

**Files/responsibility:** Sửa tsconfig.json, package.json, docs/technical/README.md, docs/technical/implementation-plan.md; tạo docs/technical/progress.md. Không sửa logic tiền.

## Thực hiện

- [ ] Chạy lại build/typecheck và 22 test hiện có; ghi lỗi trước khi sửa. Không lấy dist hoặc screenshot cũ làm bằng chứng runtime mới.

- [ ] Bỏ cấu hình baseUrl không còn hợp lệ với compiler đang cài; sửa alias paths tương đối và kiểm resolver. Thiết lập lệnh check gồm TypeScript/Astro nếu thiếu công cụ, không tắt strict hoặc exclude file để pass.

- [ ] Sửa các diagnostic thật phát sinh, phạm vi nhỏ. Sửa 7 response thiếu description trong OpenAPI và chọn validator có thể tái chạy; chưa bịa endpoint đã implement.

- [ ] Đổi trạng thái tài liệu thành thiết kế/prototype/verified theo bằng chứng. Nêu SQLite/regex/mutex không phải PostgreSQL; xóa tham chiếu T75 không tồn tại và sửa traceability đang trỏ sai.

- [ ] Chuyển traffic/latency/dung lượng, RPO/RTO, trường công bố tuyển chưa chốt thành dữ kiện có nguồn hoặc đề xuất. Không tự sửa chính sách sản phẩm.

## Gate phải chứng minh

pnpm run check phải chạy non-interactive và exit 0; pnpm run build exit 0; python -m unittest discover -s experiments -p 'test_*.py' -v vẫn chạy. Validator OpenAPI không lỗi cấu trúc hiện có. Ghi rõ chưa có backend/DB/Auth production.

## Đầu ra

Baseline tái chạy được, trạng thái trung thực, progress ghi R08/R12 đã xử lý theo phạm vi; không tuyên bố hết lỗi backend.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

