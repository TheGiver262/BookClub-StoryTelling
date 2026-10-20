# Chặng 18 — Lô sách mới, bán/trả dư và quyết toán nhà sách

Bạn là Antigravity, làm trực tiếp trong workspace F:\Codex Project\YSBK. Đọc AGENTS.md áp dụng, README.md, docs/reviews/2026-10-18-antigravity-review.md, docs/02-pham-vi-va-nghiep-vu.md, docs/06-phong-van-va-quyet-dinh.md và docs/08-ma-tran-quyen-va-dang-nhap.md. Đọc progress và code hiện tại; review là snapshot, nếu người dùng đã sửa hãy kiểm lại thay vì hoàn nguyên.

Chỉ làm chặng này, giữ phần khác và nhận diện/design.md. Tự chạy kiểm tra/sửa lỗi thuộc chặng, không hỏi xác nhận từng lệnh local. Không subagent, commit/push/deploy, cloud project mới, dữ liệu thật hoặc side effect bên ngoài. Không dùng mock/SQLite thay gate PostgreSQL/managed Auth. Khi thiếu runtime/secret, ghi blocker, tiếp tục phần độc lập và không báo pass giả.

Files dưới là đường dẫn tương đối từ workspace, đề xuất nơi sở hữu trách nhiệm; tận dụng cấu trúc tương đương nếu chặng trước đã có, không tạo helper/service trùng. Chưa có backend thì tạo phần nhỏ cần cho lát này. Không xóa/rewrite toàn bộ SQL có sẵn: xác định nó là baseline draft chưa apply hay đã apply, dùng migration tiến tới đúng trạng thái khi cần. Thêm test hồi quy có trigger cụ thể trước sửa logic; tiền/quyền/concurrency cần kiểm thật.

## Scope

**Phụ thuộc:** 03, 04, 05.

**Findings liên quan:** R07 (sales), R04.

**Files/responsibility:** Tạo src/modules/sales/lot-inventory.ts, settlement.ts; schema supplier/lot lines/movements/payables/deposits; tests/integration/sales-settlement.test.ts; nối UI lô sách.

## Thực hiện

- [ ] Thay các tổng sửa tự do bằng nguồn nhập/bán/trả/giữ theo đầu sách và dòng lô; giữ snapshot giá nhập/bán/chiết khấu. Chặn tồn âm/concurrent sale và không lấy sách cho mượn để bán.

- [ ] Nhận trước, không cọc hoặc cọc nhỏ; chỉ CLB nợ nhà sách; khách trả đủ, không đặt trước hoặc đổi trả sau mua.

- [ ] Lô100 cuốn giá nhập65k, bán60/trả40: trả3,9 triệu. Không cọc thì không nhận hoàn2,6 triệu. Có cọc1 triệu thì hoàn riêng1 triệu và thanh toán riêng3,9 triệu, mỗi dòng xác nhận thực tế riêng.

- [ ] Trả hàng vật lý không tự xác nhận hoàn ngân hàng. Hàng giữ lại bán tiếp theo nghĩa vụ chưa chốt, không tự buộc trả ngay. Hàng/cọc/nợ/journal liên kết và chống trùng.

- [ ] Nếu cần chia tiểu mốc trong lượt, kiểm inventory trước settlement; không mở thương mại điện tử hoặc thay toàn bộ module finance.

## Gate phải chứng minh

100=60+40; giá nhập65k/bán80k cho chênh lệch gộp900k trước chi phí. Chặn bán trùng/quá tồn; hoàn cọc nhà sách không đụng cọc bạn đọc/doanh thu; key khác không trả nợ hai lần; chỉ tiền đã xác nhận mới đổi số thực tế.

## Đầu ra

Luồng lô/quyết toán khớp số với bằng chứng DB, không hard-code một lô mock.

## Bàn giao và điểm dừng

- Cập nhật docs/technical/progress.md: chặng, finding đã sửa/chưa sửa, tệp đổi, lệnh và kết quả thực, giả định/policy còn mở, đầu vào cho chặng sau.
- Chạy check/build và test đúng phạm vi; broad suite chỉ khi mới thay hợp đồng hoặc phát hiện rủi ro liên quan.
- Không ghi “hoàn tất” nếu gate chưa chạy; ghi PARTIAL/BLOCKED có lý do. Screenshot runtime nếu thay UI; nguồn diagram và render nếu sửa mô hình.
- Kết thúc tại chặng này để người dùng/reviewer xem kết quả; không tự chạy toàn bộ các prompt còn lại.

