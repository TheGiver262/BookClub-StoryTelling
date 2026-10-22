# YSBK — landing preview độc lập

Nhánh `codex/landing-preview` lưu giao diện đang dùng để nhận góp ý tại https://ysbk-preview.netlify.app/. Chỉ có landing cuốn sách; không chứa mã nguồn web-app quản lý, database, đăng nhập, API hay cấu hình backend.

## Bắt đầu

Yêu cầu Node.js 24 và pnpm 11.21.0. Chạy `pnpm install --frozen-lockfile`, `pnpm run test:unit`, `pnpm run build`, `pnpm run test:landing` và `pnpm run check`. Lệnh build xuất `dist-landing/`. Không chạy thêm dev server khi cổng 4321 của ứng dụng chính đang hoạt động.

## Ba phạm vi riêng

- `main`: hệ thống quản lý sách đầy đủ, tại workspace gốc; không merge nhánh landing vào main.
- `codex/landing-preview`: giữ nhận diện YSBK, 10 chương và mobile xoay nội dung như bản đã duyệt.
- `codex/landing-template`: nhánh phát triển sản phẩm thương mại từ preview; không tự deploy lên site CLB.

Xem [trạng thái](docs/CURRENT-STATE.md), [handoff](docs/SESSION-HANDOFF.md), [vận hành preview](docs/technical/landing-netlify-preview.md) và [quy trình tách nhánh](docs/superpowers/plans/2026-10-23-landing-branch-split.md).

Nhánh này chưa phải gói template được cấp phép bán lại. Ảnh CLB, logo, nhạc và tài nguyên bên thứ ba phải được rà quyền trước khi phân phối thương mại. Không upload toàn repository lên hosting; chỉ dùng output đã qua gate. Tạo nhánh/commit không làm thay đổi site Netlify.
