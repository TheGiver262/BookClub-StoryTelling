# Runbook landing Netlify độc lập

## Đã deploy bản nén/cache — 23/10/2026

Site https://ysbk-preview.netlify.app/, deploy `6adb3814b04e68f24b099c2a`, dashboard xác nhận production published. Chỉ upload ZIP 78 file output đã gate từ codex/landing-preview; không repository, backup, credential hay DB. 39 test pre-deploy đạt. Live: 76 tài nguyên khớp SHA256, 12 đường ứng dụng/API/file nhạy cảm mẫu 404; CSP giữ nguyên. Ảnh/font/nhạc/CSS cache `public,max-age=31536000,immutable`, HTML/module `public,max-age=0,must-revalidate` đã kiểm HTTP thật. Nhạc mới 126,64 giây phát sau click; phone dọc có canvas ngang 844×390, hai ảnh cuối tải đủ và phủ kín trang; laptop 1366×677 đạt, console không ghi lỗi/cảnh báo trong lần thử.

Nguồn code chưa commit/push; main/template giữ nguyên. Đây là một production deploy theo yêu cầu người dùng (15 credit theo biểu phí); không tạo thêm deploy để thử. Kết quả kiểm HTTP ở workspace chính .review-artifacts/credit-netlify-live.json và screenshot credit-deployed-phone.png, không upload các bằng chứng này. Đoạn “chưa deploy” trong mục tối ưu phía dưới là snapshot trước khi được yêu cầu deploy; trạng thái mới ở đây thay thế.


## Tối ưu media/cache — 23/10/2026, chưa deploy

Chỉ sửa codex/landing-preview, main/template giữ nguyên. Đọc [README tối ưu](../../README.md) trước khi tiếp tục. Media 29.040.388 → 6.507.347 byte, giảm 77,6%; 29 ảnh WebP, một JPEG giữ nguyên, MP3 128 kbps/126,64 giây và ảnh nhúng logo nhỏ hơn. Tất cả ảnh giữ nguyên kích thước; nguồn gốc có trong Git và bản đối chiếu .review-artifacts/media-originals (không upload).

Preload nhạc none nhưng giữ tự thử phát sau click/phím/chạm/cuộn đầu; scroll capture bắt cả inner container mobile, wheel được hỗ trợ. Autoplay bị browser từ chối thì giữ cơ hội thử lại bằng tương tác tiếp theo. Build đổi tên media/font/CSS theo SHA256 và cập nhật mọi URL; cache assets 1 năm immutable, HTML/module revalidate. Hash CSS tính sau khi đổi URL media. Giữ nguyên CSP, gate, nút disabled và landing-only.

39 unit/artifact đạt; build 1 trang/78 file qua gate, Astro/tsc 0 lỗi/cảnh báo/hint. Browser local kiểm 10 chương ở laptop 1366×677 và phone 390×844, ảnh/khung đạt; click/phím phát MP3 mới, preload trước tương tác chưa tải nhạc. Chưa máy thật/Safari hoặc kiểm cache HTTP trên Netlify; chưa deploy/commit/push. Server QA tạm 4321 được dừng sau kiểm tra; lúc bắt đầu không có server 4321. Không thay DB/ứng dụng main.

Các lần cập nhật tiếp theo ưu tiên local; nếu cần chia sẻ dùng draft/preview, không production cho từng sửa nhỏ. Preview vẫn tính requests/bandwidth. Không upload gốc repo, log hay backup media; chỉ output đã gate. Runbook triển khai phía dưới là lịch sử của bản live trước tối ưu này.


Ngày tách: 23/10/2026. Site hiện hành: https://ysbk-preview.netlify.app/; team `thegiver262`; site ID [REDACTED]. Deploy được ghi trong handoff nguồn: `6ada2e83943262d0fb4099ed`. Lượt tách nhánh không deploy.

1. Xác nhận đang ở `codex/landing-preview` và không có thay đổi ngoài phạm vi.
2. Chạy `pnpm run test:unit`, `pnpm run build`, `pnpm run test:landing`, `pnpm run check`.
3. Kiểm tra bìa, 10 chương, trang cuối, guide, các link disabled, nhạc opt-in, reduced motion, desktop và mobile xoay. Không ghi nhận test chạy cũ thành kết quả mới.
4. Chỉ khi được yêu cầu triển khai: upload `dist-landing` đã qua gate tới site nêu trên. Không upload repository hoặc kết nối Git CD mặc định.
5. Kiểm tra root 200, route app/API/file riêng tư 404, tài nguyên đúng hash và header bảo vệ. CSP giữ connect-src none, form-action none, font-src self và frame-ancestors none. Preview tiếp tục noindex/nofollow.

`astro.config.mjs` và lệnh build đều chỉ chọn entry landing. `LandingLink.astro` loại href/target ứng dụng trong HTML. Không có backend/function/DB trong nhánh này. Không nới CSP để kết nối ứng dụng. Nhánh thương mại dùng chính sách riêng đã được phê duyệt, không triển khai lên site CLB.

Build gốc trước tách có cảnh báo asset URL vì public assets được copy sau Astro; gate kiểm tra output cuối. Không suy ra file thiếu từ warning đó, và không bỏ gate. Kiểm tra máy thật/Safari vẫn cần bổ sung riêng.
