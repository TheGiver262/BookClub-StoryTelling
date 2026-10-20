# Landing cuốn sách — bản chính local

Ngày 21/10/2026. Đã tích hợp vào web tại **http://localhost:4321/?public=1**. `public=1` cho thành viên xem landing mà không bị session chuyển sang nội bộ. Trang `/` bình thường vẫn đưa thành viên có session hợp lệ thẳng đến `/noi-bo`.

## Các trang

- `/`: bìa cứng → bìa phụ không đánh số → 10 chương/20 trang nội dung. Bìa phụ có trang trái trắng và trang phải in lại thiết kế bìa trên giấy, không mang bản lề/bóng bìa cứng. Bìa cứng mở qua bản lề, nhô khỏi ruột giấy ở ba cạnh. Giấy bên trong giữ hiệu ứng lật cong từ góc dưới phải.
- Cuộn hết chương 10: thoát vùng sticky và tiếp tục đến `#cach-muon`, với ba bước mượn và hạn mức đã chốt.
- `/sach/`: tab riêng từ landing, chỉ có tra cứu, đặt giữ chỗ, tra/hủy đơn. 50 đầu sách/trang; tìm tên/tác giả không dấu, thể loại từ database, lọc bản còn khả dụng. Danh mục đầy đủ có cả sách hết bản hoặc chưa có bản; các sách đó không được đặt.
- `/cong-dong`: giữ các chức năng hoạt động, review, tuyển thành viên cũ trong theme mới. Liên kết `/?tab=...`, `?sach=...`, `#token=...` cũ được chuyển đến trang tương ứng; token vẫn nằm trong hash, không gửi lên máy chủ khi điều hướng.
- Login, chi tiết sách/404 và toàn bộ khu nội bộ dùng chung màu xanh rêu, đất nung, giấy kem; serif Lora/sans Be Vietnam Pro. Giữ màu cảnh báo nghiệp vụ. Logo CLB dùng SVG, chữ viết tay ở bìa/trang kết dùng Dancing Script có đủ dấu Việt.

## Tương tác

- Bìa mở 1.600ms, lật giấy 1.400ms cho một lần hoàn chỉnh. Phần hiện chữ thường 700ms, chương kết 2.400ms. Khi chọn chương xa, đi qua từng trang; có thể cuộn/chạm/nhấn phím để ngắt ngay. Chế độ giảm chuyển động chuyển ngay đến đích.
- Nút trái ở trang giới thiệu về bìa phụ từ mọi mức đọc; bấm tiếp sẽ đóng bìa cứng. Điểm dừng được hiệu chỉnh sai số một pixel của `scrollY`, tránh rơi nhầm sang trạng thái đang lật và làm nút trái chỉ quay lại chính trang đó. Hàng chọn chương giữ nguyên 01–10, chương 01 đi thẳng đến giới thiệu.
- Slogan thống nhất “Mở sách, đọc tương lai” trên bìa, bìa phụ, chương kết và các trang hiện tại. Giới thiệu được mở rộng về lý do hình thành, cộng đồng bạn đọc, hoạt động và các thế hệ thành viên; màn hình hẹp dùng nội dung gọn để vừa trang. Ngày thành lập giữ 16.09.2013.
- Trang cuối: chữ “Mở sách” → tranh trái phủ toàn trang → “Đọc tương lai” ở góc dưới phải → tranh phải phủ toàn trang. Hai trang dùng cùng chỉ mục/số trang với các chương còn lại.
- Vùng sticky dùng `overflow: clip`, tránh trình duyệt tạo thêm vùng cuộn bên trong khi focus nút chọn chương. Chỉ có một trục cuộn chính.
- Danh mục giữ cơ chế refresh hiện có: 30 giây thứ Ba/thứ Năm, 60 giây các ngày khác, khi quay lại tab và sau thay đổi giữ chỗ. Backend vẫn kiểm tra tồn/nguyên tử lúc đặt; danh mục là ảnh chụp tại thời điểm tải, không hứa thay cho giao dịch giữ chỗ.

Tham khảo hình học bìa: [Lulu – Anatomy of a Hardcover](https://help.lulu.com/en/support/solutions/articles/64000308572-creating-your-hardcover-casewrap-cover), phần overhang và hinge. Không chép ảnh tham khảo vào sản phẩm. Ảnh CLB, minh họa và hồ sơ nguồn giữ ở `docs/mockups/open-book/`; tài nguyên đang chạy ở `public/book/`. Các mockup tại cổng 4322 được giữ làm lịch sử, không phải trang chính.

## Kiểm chứng

- `pnpm run check`: Astro/TypeScript, 0 lỗi, 0 warning, 0 hint.
- `pnpm run test:unit`: **349/349**; gồm timeline, làm tròn pixel, đảo chiều, nhịp lật, ngắt cuộn ngoài animation, bốn bước hiện slogan, bìa phụ/trang trắng/ID SVG riêng, 20 trang nội dung và hình học giấy.
- PostgreSQL: **12/12** test trong `reservation-flow.test.ts`, chỉ dùng `ysbk_test_local`. Có 52 đầu sách để chứng minh phân trang 50+2, sách chưa có bản/hết bản, thể loại, tồn sau giữ/hủy; các hồi quy quota, tranh chấp bản cuối, hết hạn, giao/trả và cảnh báo sự cố. Fixture lịch test dùng ngày Việt Nam để không lệch ngày UTC sau 00:00. Không chạy lại toàn bộ suite tài chính/database.
- Build local: **6 trang**. `local:up` giữ database/volume hiện có và kiểm tra readiness; `local:smoke` đạt Auth thật cho admin/member, cookie/session/logout, no-store, thiếu CAPTCHA, tạo–tra–hủy bằng test Turnstile, không lộ SĐT công khai. Đơn synthetic của smoke đã dọn.
- HTTP: 34 trang/module/tài nguyên trả 200 đúng MIME; API danh mục trả limit=50 và thể loại thật, no-store; đường dẫn file tài khoản local bị chặn 404.
- Browser: desktop 1440×1000, điện thoại mô phỏng 390×844, panel 418×580; đã xem bìa/mở/lật, đo intro không tràn, quay về bìa, chọn chương, từng bước hiện tranh cuối, cuộn sang hướng dẫn, tìm không dấu, đặt từ danh mục, reload giữ sách đã chọn. Đã đăng nhập xem khu nội bộ, xác nhận `/` tự vào nội bộ và đăng xuất sau test.
- Bổ sung bìa phụ: đã kiểm tra bìa cứng → bìa phụ → giới thiệu và quay ngược bằng nút trái; phần giới thiệu đầy đủ vừa trang ở 1440×1000, bản gọn ở 390×844 và 418×580. Khung thấp chừa riêng khoảng nguồn tư liệu, không đè chữ/số trang. Ảnh `title-page-desktop.png`, `expanded-introduction-desktop.png`, `expanded-introduction-mobile.png`, `expanded-introduction-short-panel.png` trong thư mục bằng chứng. Lần chỉnh bìa phụ chạy lại unit/check/build/HTTP; sau căn CSS/copy cuối, build và 13 test landing tiếp tục đạt. PostgreSQL và smoke nghiệp vụ ở trên là kết quả đợt tích hợp trước, không chạy lại vì không đổi backend.
- Bằng chứng local được giữ trong `.local/ysbk/verification/landing/`, log `landing-unit.log`, `landing-pg.log`, `landing-smoke.log`, `landing-start.log`, `title-page-unit.log`, `title-page-start.log`. Không đưa tài khoản/cookie/token vào tài liệu.

Chưa deploy, commit/push, đo FPS, thử tải đồng thời hoặc kiểm thử thiết bị di động thật. Những kết quả local trên không thay cho nghiệm thu toàn bộ nghiệp vụ hoặc beta cloud.
