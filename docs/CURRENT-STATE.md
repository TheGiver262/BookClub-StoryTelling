# Trạng thái landing preview — 23/10/2026

Đây là nhánh landing độc lập `codex/landing-preview`, tách từ main `6bba6ebb30946b172fccba08984f038478af2a21` và các thay đổi landing chưa commit tại workspace gốc. Mã web-app, schema, backend, Docker, tài khoản, dữ liệu và tài liệu nghiệp vụ ứng dụng đã bỏ khỏi cây file nhánh này; lịch sử Git vẫn có nguồn gốc từ repository YSBK.

## Giao diện cần giữ

Cuốn sách 10 chương/20 trang; bìa và bìa phụ, slogan “Mở sách, đọc tương lai”; hai ảnh chương cuối phủ kín trang với chữ overlay; “Đọc tương lai” đỏ đất nung. Điện thoại dọc xoay nội dung 90°, mobile dùng inner scroll; desktop giữ window scrolling. Giữ reduced motion, bàn phím, nút điều hướng và hành vi nhạc như preview hiện tại. Font tự host.

## Bằng chứng và giới hạn

Handoff nguồn ghi site `ysbk-preview`, deploy `6ada2e83943262d0fb4099ed` ready; 408 unit/23 test mục tiêu thuộc lần triển khai trước, không phải kết quả mới của nhánh này. Kiểm tra tách nhánh được ghi riêng trong [verification](BRANCH-SPLIT-VERIFICATION.md) sau khi chạy.

Chưa có bằng chứng điện thoại vật lý, Safari/iOS thật hoặc vuốt bằng ngón tay. Không đổi thiết kế mobile hoặc áp dụng định hướng thương mại vào preview nếu chưa có yêu cầu. Không triển khai Netlify trong lượt tách nhánh.
