# Handoff — landing preview độc lập, 23/10/2026

## Đã deploy bản nén/cache — 23/10/2026

Site https://ysbk-preview.netlify.app/, deploy `6adb3814b04e68f24b099c2a`, dashboard xác nhận production published. Chỉ upload ZIP 78 file output đã gate từ codex/landing-preview; không repository, backup, credential hay DB. 39 test pre-deploy đạt. Live: 76 tài nguyên khớp SHA256, 12 đường ứng dụng/API/file nhạy cảm mẫu 404; CSP giữ nguyên. Ảnh/font/nhạc/CSS cache `public,max-age=31536000,immutable`, HTML/module `public,max-age=0,must-revalidate` đã kiểm HTTP thật. Nhạc mới 126,64 giây phát sau click; phone dọc có canvas ngang 844×390, hai ảnh cuối tải đủ và phủ kín trang; laptop 1366×677 đạt, console không ghi lỗi/cảnh báo trong lần thử.

Nguồn code chưa commit/push; main/template giữ nguyên. Đây là một production deploy theo yêu cầu người dùng (15 credit theo biểu phí); không tạo thêm deploy để thử. Kết quả kiểm HTTP ở workspace chính .review-artifacts/credit-netlify-live.json và screenshot credit-deployed-phone.png, không upload các bằng chứng này. Đoạn “chưa deploy” trong mục tối ưu phía dưới là snapshot trước khi được yêu cầu deploy; trạng thái mới ở đây thay thế.


## Tối ưu media/cache — 23/10/2026, chưa deploy

Chỉ sửa codex/landing-preview, main/template giữ nguyên. Đọc [README tối ưu](../README.md) trước khi tiếp tục. Media 29.040.388 → 6.507.347 byte, giảm 77,6%; 29 ảnh WebP, một JPEG giữ nguyên, MP3 128 kbps/126,64 giây và ảnh nhúng logo nhỏ hơn. Tất cả ảnh giữ nguyên kích thước; nguồn gốc có trong Git và bản đối chiếu .review-artifacts/media-originals (không upload).

Preload nhạc none nhưng giữ tự thử phát sau click/phím/chạm/cuộn đầu; scroll capture bắt cả inner container mobile, wheel được hỗ trợ. Autoplay bị browser từ chối thì giữ cơ hội thử lại bằng tương tác tiếp theo. Build đổi tên media/font/CSS theo SHA256 và cập nhật mọi URL; cache assets 1 năm immutable, HTML/module revalidate. Hash CSS tính sau khi đổi URL media. Giữ nguyên CSP, gate, nút disabled và landing-only.

39 unit/artifact đạt; build 1 trang/78 file qua gate, Astro/tsc 0 lỗi/cảnh báo/hint. Browser local kiểm 10 chương ở laptop 1366×677 và phone 390×844, ảnh/khung đạt; click/phím phát MP3 mới, preload trước tương tác chưa tải nhạc. Chưa máy thật/Safari hoặc kiểm cache HTTP trên Netlify; chưa deploy/commit/push. Server QA tạm 4321 được dừng sau kiểm tra; lúc bắt đầu không có server 4321. Không thay DB/ứng dụng main.

Các lần cập nhật tiếp theo ưu tiên local; nếu cần chia sẻ dùng draft/preview, không production cho từng sửa nhỏ. Preview vẫn tính requests/bandwidth. Không upload gốc repo, log hay backup media; chỉ output đã gate. Runbook triển khai phía dưới là lịch sử của bản live trước tối ưu này.


Đọc [CURRENT-STATE](CURRENT-STATE.md), [verification](BRANCH-SPLIT-VERIFICATION.md) và [runbook](technical/landing-netlify-preview.md).

Nhánh này chỉ duy trì giao diện preview CLB đã duyệt. Nhánh main chứa ứng dụng đầy đủ; nhánh `codex/landing-template` chứa kế hoạch thương mại. Không merge toàn nhánh, không lấy tài liệu app đã bỏ làm hợp đồng cho landing. Shared CSS được giữ để giảm thay đổi hình ảnh khi tách; không kèm React, database hay route ứng dụng.

Nếu cập nhật preview: sửa ở nhánh này, chạy unit/build/artifact/check, kiểm tra browser rồi chỉ deploy output khi người dùng yêu cầu. Giữ site cũ, không tự kết nối Git CD. Không sao chép credential, dữ liệu local, Excel hay dump vào branch.

Prompt tiếp nối: “Tiếp tục codex/landing-preview. Đọc docs/SESSION-HANDOFF.md và CURRENT-STATE.md. Giữ hình ảnh/mobile đã duyệt. Chỉ sửa landing; không chạm main hay ứng dụng quản lý. Xác minh branch, runtime, kiểm thử và phạm vi deploy trước thao tác.”
