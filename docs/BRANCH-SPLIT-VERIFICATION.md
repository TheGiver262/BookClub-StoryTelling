# Kiểm chứng tách nhánh preview — 23/10/2026

## Nguồn và phạm vi

Base main: `6bba6ebb30946b172fccba08984f038478af2a21`. Trước tách đã sao lưu 62 file dirty vào workspace gốc, kèm SHA256 và binary patch. Không dùng reset/clean/stash. Copy đúng landing mới nhất sang worktree managed và bỏ 487 file tracked thuộc phần ngoài phạm vi. Main không nhận commit của nhánh này.

Chủ sản phẩm chốt: main giữ mọi chỉnh sửa landing desktop/mobile/1366px và toàn bộ web-app; chỉ code/config/test khóa nút cùng build Netlify được chuyển khỏi main. Nhánh preview giữ trạng thái khóa nút như site đã duyệt. Việc xử lý working tree main được kiểm chứng riêng ở workspace gốc.

## Kiểm tra mới trong lượt tách

- Baseline main trước tách: 408/408 unit; bộ landing mục tiêu 26/26.
- Nhánh độc lập: 27/27 unit (gồm kiểm tra không còn backend/dependency ứng dụng), 4/4 artifact test.
- Build: một trang, 78 file qua gate; không có route/bundle/API/secret được gate phát hiện.
- Astro check và tsc: 5 file, 0 lỗi, 0 cảnh báo, 0 hint.
- pnpm frozen/offline install sau khi cài đủ cache: đạt; lockfile không còn dependency trực tiếp React, pg hoặc Wrangler.
- 75 file dưới `book/` giống SHA256 bản trước tách, gồm toàn bộ ảnh/font/nhạc và các module renderer.
- Browser Chrome headless, request interception phục vụ output thật, không mở server/cổng mới: cover và 10 chương trên 1366×768, 1920×1080, 390×844 và 844×390; tổng 44 trạng thái có nội dung, computed style và hình học DOM giống nhau. Không có pageerror.
- CSS build bớt 615 rule Tailwind của ứng dụng đã xóa, không thêm rule mới. Tên CSS/hash và HTML tham chiếu thay đổi theo bundle mới.
- Đọc lại Netlify bằng GET trong lượt này: 76/76 tài nguyên khớp snapshot gốc; root 200 và bốn route app/API mẫu 404. HTML có comment do Netlify thêm, nên không ghi nhận byte-identical với file build local.

## Giới hạn bằng chứng

Không tuyên bố ảnh screenshot giống từng pixel: raster ảnh và bóng của Chromium khác giữa một số lần capture dù asset, computed style và hình học trùng nhau. Số đo pixel được lưu riêng; kiểm chứng browser kết luận parity nội dung/style/hình học. Không sửa renderer/CSS để lấp khác biệt capture.

Build còn warning URL asset do copy public assets sau Astro như bản gốc; các file output cuối được gate/artifact kiểm tra. Không coi warning là mất file, cũng không ghi thành build không warning.

Diff whitespace kiểm tra phần mã/tài liệu; hai bản OFL của Lora/Newsreader có một khoảng trắng cuối dòng 21 từ file nguồn được giữ nguyên để không sửa nội dung giấy phép bên thứ ba.

Không chạy điện thoại vật lý/Safari, không kiểm tra FPS/tải, không vận hành database, không push hoặc deploy. Site Netlify vẫn là deploy cũ cho đến khi có yêu cầu triển khai riêng.

Bằng chứng thô được giữ local tại workspace gốc `.review-artifacts/landing-branch-split/`; không đưa ảnh/log cá nhân vào Git.

## Main sau khi gỡ khóa nút

Kiểm chứng sau tách: 404/404 unit đạt, build đủ 12 trang, check không lỗi/cảnh báo (2 hint có sẵn); browser tại local 4321 bấm Tủ sách mở đúng `/sach/`, desktop 1366×768 và phone 390×844 giữ đủ 10 chương/8 link hoạt động. 578 file ngoài phạm vi gỡ khóa nút và ghi chú tài liệu giống SHA256 trước thao tác. Main vẫn HEAD `6bba6ebb30946b172fccba08984f038478af2a21`, không có commit mới.
