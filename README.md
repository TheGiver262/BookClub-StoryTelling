# YSBK — landing preview độc lập

Nhánh `codex/landing-preview` lưu giao diện đang dùng để nhận góp ý tại https://ysbk-preview.netlify.app/. Chỉ có landing cuốn sách; không chứa mã nguồn web-app quản lý, database, đăng nhập, API hay cấu hình backend.

## Tối ưu credit — 23/10/2026

Đã nén media trên nhánh này và deploy 23/10/2026: 29 ảnh sang WebP giữ nguyên kích thước, 1 JPEG giữ nguyên vì WebP lớn hơn, ảnh nhúng trong SVG logo cũng được nén. Ảnh/logo/nhạc từ 29.040.388 xuống 6.507.347 byte (giảm 77,6%); MP3 128 kbps còn 2.027.145 byte, giữ thời lượng 126,64 giây. Không thêm dependency build.

Nhạc preload none, vẫn tự thử phát sau click, phím, chạm hoặc cuộn đầu tiên. Nếu browser chặn autoplay khi cuộn, giữ listener để thử lại khi click/phím/chạm tiếp theo. Mobile bắt được scroll ở inner container. Không thể vượt chính sách autoplay của browser.

Build thêm SHA256 vào tên ảnh/font/nhạc/CSS; cache browser 1 năm immutable cho tài nguyên có hash. HTML/module revalidate; CSS được hash sau khi thay URL media để tránh giữ đường dẫn cũ. Không nới CSP hoặc mở nút ứng dụng.

Mặc định phát triển/QA local; cần góp ý dùng draft/preview deploy, không --prod. Preview vẫn tiêu băng thông/requests khi xem. Chỉ production deploy sau khi gom thay đổi và có yêu cầu rõ ràng; mỗi lần hiện tính 15 credit. Không dùng AI Agent/compute trên Netlify cho landing này. Đã deploy các tối ưu; chưa commit/push.

Kiểm chứng: 39 unit/artifact đạt, build 1 trang/78 file qua security gate, Astro/tsc không lỗi/cảnh báo/hint. Browser đủ 10 chương tại 1366×677 và 390×844: ảnh tải đầy đủ, các khối đầu trang/chữ cuối/số trang trong khung; nhạc chưa tải trước tương tác, click/phím phát được. Cache header đã kiểm tra trên Netlify: media/font/CSS public,max-age=31536000,immutable; HTML/module public,max-age=0,must-revalidate. Bằng chứng trong .review-artifacts bị Git bỏ qua.

## Bắt đầu

Yêu cầu Node.js 24 và pnpm 11.21.0. Chạy `pnpm install --frozen-lockfile`, `pnpm run test:unit`, `pnpm run build`, `pnpm run test:landing` và `pnpm run check`. Lệnh build xuất `dist-landing/`. Không chạy thêm dev server khi cổng 4321 của ứng dụng chính đang hoạt động.

## Ba phạm vi riêng

- `main`: hệ thống quản lý sách đầy đủ, tại workspace gốc; không merge nhánh landing vào main.
- `codex/landing-preview`: giữ nhận diện YSBK, 10 chương và mobile xoay nội dung như bản đã duyệt.
- `codex/landing-template`: nhánh phát triển sản phẩm thương mại từ preview; không tự deploy lên site CLB.

Xem [trạng thái](docs/CURRENT-STATE.md), [handoff](docs/SESSION-HANDOFF.md), [vận hành preview](docs/technical/landing-netlify-preview.md) và [quy trình tách nhánh](docs/superpowers/plans/2026-10-23-landing-branch-split.md).

Nhánh này chưa phải gói template được cấp phép bán lại. Ảnh CLB, logo, nhạc và tài nguyên bên thứ ba phải được rà quyền trước khi phân phối thương mại. Không upload toàn repository lên hosting; chỉ dùng output đã qua gate. Tạo nhánh/commit không làm thay đổi site Netlify.

Deploy mới nhất: `6adb3814b04e68f24b099c2a`, dashboard xác nhận published tại https://ysbk-preview.netlify.app/. Upload ZIP chỉ chứa 78 file output đã gate (7.731.287 byte trước ZIP). 39 test đạt trước deploy; sau deploy 76 tài nguyên khớp SHA256, 12 đường bảo vệ mẫu 404, nhạc phát sau click, ảnh hai trang cuối phủ trang trên laptop/phone. Không dùng Agent Runner/functions/DB, không thay main/template.
