# Trạng thái landing preview — 23/10/2026

## Đã deploy bản nén/cache — 23/10/2026

Site https://ysbk-preview.netlify.app/, deploy `6adb3814b04e68f24b099c2a`, dashboard xác nhận production published. Chỉ upload ZIP 78 file output đã gate từ codex/landing-preview; không repository, backup, credential hay DB. 39 test pre-deploy đạt. Live: 76 tài nguyên khớp SHA256, 12 đường ứng dụng/API/file nhạy cảm mẫu 404; CSP giữ nguyên. Ảnh/font/nhạc/CSS cache `public,max-age=31536000,immutable`, HTML/module `public,max-age=0,must-revalidate` đã kiểm HTTP thật. Nhạc mới 126,64 giây phát sau click; phone dọc có canvas ngang 844×390, hai ảnh cuối tải đủ và phủ kín trang; laptop 1366×677 đạt, console không ghi lỗi/cảnh báo trong lần thử.

Nguồn code chưa commit/push; main/template giữ nguyên. Đây là một production deploy theo yêu cầu người dùng (15 credit theo biểu phí); không tạo thêm deploy để thử. Kết quả kiểm HTTP ở workspace chính .review-artifacts/credit-netlify-live.json và screenshot credit-deployed-phone.png, không upload các bằng chứng này. Đoạn “chưa deploy” trong mục tối ưu phía dưới là snapshot trước khi được yêu cầu deploy; trạng thái mới ở đây thay thế.


## Tối ưu media/cache — 23/10/2026, chưa deploy

Chỉ sửa codex/landing-preview, main/template giữ nguyên. Đọc [README tối ưu](../README.md) trước khi tiếp tục. Media 29.040.388 → 6.507.347 byte, giảm 77,6%; 29 ảnh WebP, một JPEG giữ nguyên, MP3 128 kbps/126,64 giây và ảnh nhúng logo nhỏ hơn. Tất cả ảnh giữ nguyên kích thước; nguồn gốc có trong Git và bản đối chiếu .review-artifacts/media-originals (không upload).

Preload nhạc none nhưng giữ tự thử phát sau click/phím/chạm/cuộn đầu; scroll capture bắt cả inner container mobile, wheel được hỗ trợ. Autoplay bị browser từ chối thì giữ cơ hội thử lại bằng tương tác tiếp theo. Build đổi tên media/font/CSS theo SHA256 và cập nhật mọi URL; cache assets 1 năm immutable, HTML/module revalidate. Hash CSS tính sau khi đổi URL media. Giữ nguyên CSP, gate, nút disabled và landing-only.

39 unit/artifact đạt; build 1 trang/78 file qua gate, Astro/tsc 0 lỗi/cảnh báo/hint. Browser local kiểm 10 chương ở laptop 1366×677 và phone 390×844, ảnh/khung đạt; click/phím phát MP3 mới, preload trước tương tác chưa tải nhạc. Chưa máy thật/Safari hoặc kiểm cache HTTP trên Netlify; chưa deploy/commit/push. Server QA tạm 4321 được dừng sau kiểm tra; lúc bắt đầu không có server 4321. Không thay DB/ứng dụng main.

Các lần cập nhật tiếp theo ưu tiên local; nếu cần chia sẻ dùng draft/preview, không production cho từng sửa nhỏ. Preview vẫn tính requests/bandwidth. Không upload gốc repo, log hay backup media; chỉ output đã gate. Runbook triển khai phía dưới là lịch sử của bản live trước tối ưu này.


Đây là nhánh landing độc lập `codex/landing-preview`, tách từ main `6bba6ebb30946b172fccba08984f038478af2a21` và các thay đổi landing chưa commit tại workspace gốc. Mã web-app, schema, backend, Docker, tài khoản, dữ liệu và tài liệu nghiệp vụ ứng dụng đã bỏ khỏi cây file nhánh này; lịch sử Git vẫn có nguồn gốc từ repository YSBK.

## Giao diện cần giữ

Cuốn sách 10 chương/20 trang; bìa và bìa phụ, slogan “Mở sách, đọc tương lai”; hai ảnh chương cuối phủ kín trang với chữ overlay; “Đọc tương lai” đỏ đất nung. Điện thoại dọc xoay nội dung 90°, mobile dùng inner scroll; desktop giữ window scrolling. Giữ reduced motion, bàn phím, nút điều hướng và hành vi nhạc như preview hiện tại. Font tự host.

## Bằng chứng và giới hạn

Handoff nguồn ghi site `ysbk-preview`, deploy `6ada2e83943262d0fb4099ed` ready; 408 unit/23 test mục tiêu thuộc lần triển khai trước, không phải kết quả mới của nhánh này. Kiểm tra tách nhánh được ghi riêng trong [verification](BRANCH-SPLIT-VERIFICATION.md) sau khi chạy.

Chưa có bằng chứng điện thoại vật lý, Safari/iOS thật hoặc vuốt bằng ngón tay. Không đổi thiết kế mobile hoặc áp dụng định hướng thương mại vào preview nếu chưa có yêu cầu. Không triển khai Netlify trong lượt tách nhánh.
