# Mockup landing: Cuốn sách điều khiển bằng cuộn

**Đã đưa vào bản chính local ngày 21/10/2026:** [mở web tại cổng 4321](http://localhost:4321/?public=1). Bản chạy nằm ở `src/components/BookLanding.astro` và `public/book/`; [chi tiết tích hợp và kiểm chứng](../../technical/book-landing-local.md). Cổng 4322 cùng các ghi chú V1–V8 dưới đây là lịch sử mockup.

**Hiện tại: V8** — [xem mockup](http://localhost:4322/?v=8). Phối màu title, slogan cong, độ dày bìa, điều hướng giữa/hai mép và sửa viền logo. [Thay đổi, kiểm tra và giới hạn](REVIEW-V8.md). Các ghi chú dưới đây là lịch sử các bản trước.

**Hiện tại: V7** — [xem mockup](http://localhost:4322/?v=7). Tên bìa đầy đủ Hà Nội, slogan chữ viết tay có font Việt cục bộ, hai logo ở chân bìa, chữ nhỏ lớn hơn, ảnh con người 2+2 và trang kết có minh họa. [Chi tiết và kiểm tra](REVIEW-V7.md). Các mục bên dưới ghi lại lịch sử bản thử.

**Mới nhất: logo V6** — [xem mockup](http://localhost:4322/?v=6). Logo phục hồi theo ảnh bảng CLB, nền trong suốt, bỏ khung xanh cũ. [Chi tiết và giới hạn](REVIEW-V6.md). Nội dung V5 và minh họa bìa V4 giữ nguyên.

**Hiện tại: nội dung V5, bìa V4** — [xem mockup](http://localhost:4322/?v=5). Đã nhận đủ 13 ảnh đính kèm, bỏ tặng giáo trình, đổi giao lưu CLB thành Ngày Sách Việt Nam. [Ánh xạ ảnh và kiểm tra V5](REVIEW-V5.md). Các ghi chú V3/V4 bên dưới là lịch sử bản thử.

Bìa mới 21/10/2026: [xem bản bìa V4](http://localhost:4322/?v=4), minh họa đơn giản theo ba ảnh tham khảo. [Prompt và tệp ảnh](cover-minimal-v4.prompt.md). Nội dung/cuộn vẫn dùng V3; ảnh thành viên mới đang chờ truy cập Facebook.

**Bản 03 (lịch sử)** — xem tại **http://localhost:4322/?v=3**. Chi tiết thay đổi, nguồn ảnh, màu logo và phần chưa kiểm tra ở [REVIEW-V3.md](REVIEW-V3.md). Bản 02 giữ tại `/book-v2.html`; phần mô tả bên dưới là tài liệu của bản 02.

Bản 02 ngày 20/10/2026: sách lớn nằm giữa màn hình, ban đầu đóng bìa. Cuộn để mở, hiện từng đoạn chữ, rồi lật sang chương kế tiếp. Dừng cuộn thì giấy dừng; cuộn ngược thì quay lại. Chỉ dùng để duyệt bố cục, nội dung và cảm giác tương tác. Chưa tích hợp vào Astro, web tại cổng 4321, API hoặc database. Giữ bản cũ tại `editorial-v1.html`.

## Xem thử

Chạy từ thư mục gốc dự án (bản 02 dùng ES module nên cần HTTP):

```powershell
node docs/mockups/open-book/serve.mjs
```

Sau đó vào **http://localhost:4322**. Máy chủ chỉ lắng nghe trên `127.0.0.1` và chỉ phục vụ trang mockup, hai module JavaScript, bản V1 cùng bốn ảnh bên dưới. Dừng bằng Ctrl+C nếu chạy trong terminal. Mỗi lần tải mới bắt đầu từ bìa đóng.

Ảnh được lưu kèm, không phụ thuộc URL ảnh CDN Facebook có thời hạn. Font Lora / Be Vietnam Pro tải từ Google Fonts; khi offline dùng font hệ thống thay thế.

## Luồng xem

1. Bìa navy đóng, tên “Câu lạc bộ / Yêu Sách Bách Khoa”, chỉ dẫn cuộn góc trên bên phải.
2. Cuộn mở bìa từ phải qua trái. Sách mở chiếm phần thân màn hình, bên trái có ảnh, bên phải có nội dung.
3. Chương I giới thiệu CLB, ngày thành lập **16/09/2013** do người dùng xác nhận. Các đoạn chữ hiện dần theo vị trí cuộn.
4. Hết phần đọc mới bước vào đoạn lật trang. Góc lật phụ thuộc trực tiếp vị trí cuộn; không tự hoàn tất khi dừng giữa chừng. Cuộn nhanh có thể đi qua nhiều chương; cuộn ngược phục hồi đúng vị trí cũ.
5. Sáu chương: giới thiệu, tinh thần đọc/kết nối, chia sẻ, thành viên, kỷ niệm, lời mời đọc sách.
6. Mũi tên phải mở sách hoặc sang chương tiếp và hiện đủ chữ; mũi tên trái về chương trước, từ chương đầu quay về bìa. Có nút chọn từng chương và phím trái/phải.
7. Lối vào tủ sách dẫn tới phần minh họa trong bản V1, không gọi API, không tạo đơn thật.

Giữ cuộn dọc tự nhiên, không chặn wheel/touch. Tôn trọng `prefers-reduced-motion` bằng chuyển cảnh đơn giản, giữ nút điều hướng. Khi trang hẹp, phần chữ dài dịch trong khung theo tiến độ đọc để đoạn cuối không bị cắt. Resize giữ vị trí tương đối trong câu chuyện. Khi tắt JavaScript, có liên kết về bản V1 để đọc. Không có API, persistence, thư viện mới hay WebGL; lật giấy bằng các lớp HTML/CSS. Chưa đo hiệu năng hay kiểm tra trực quan trên thiết bị thật.

## Tham chiếu và lựa chọn kỹ thuật

- [react-scroll-parallax](https://github.com/jscottsmith/react-scroll-parallax): tham khảo cách ánh xạ tiến độ cuộn sang transform/opacity.
- [lax.js](https://github.com/alexfoxy/lax.js): tham khảo scroll driver; repo hiện archived, chưa thêm làm dependency.
- Video người dùng gửi: [b7a_Y1Ja6js](https://www.youtube.com/watch?v=b7a_Y1Ja6js), [LiVawUdrH4Y](https://www.youtube.com/watch?v=LiVawUdrH4Y). Công cụ chưa phát được hai video; bản 02 dựa trên mô tả chi tiết của người dùng, chưa xác nhận giống từng khung hình.

`book-timeline.mjs` tách phép tính các giai đoạn để kiểm tra độc lập. `book.mjs` chỉ dựng nội dung, đồng bộ vị trí cuộn và lớp giấy. Không thay đổi dependencies hoặc mã ứng dụng.

```powershell
node --test --test-isolation=none docs/mockups/open-book/book-timeline.test.mjs
```

Các kiểm tra: đóng/mở bìa, hiện hết chữ rồi lật, giữ nửa trang, cuộn ngược/nhảy nhanh, biên đầu/cuối, điều hướng nút, thứ tự hiện chữ. Đây là kiểm tra logic, không thay cho kiểm tra hiển thị và thao tác trong trình duyệt.

Kết quả ngày 20/10/2026: 6/6 kiểm tra timeline đạt, cú pháp JS đạt; trang, hai module, bản V1 và bốn ảnh trả HTTP 200 đúng MIME. Các đường dẫn ngoài danh sách phục vụ bị từ chối. Công cụ trình duyệt hiện báo local browser bị tắt nên chưa kiểm tra trực quan, đo FPS hoặc quay video. Không suy ra chất lượng chuyển động từ các kiểm tra logic này.

## Nguồn ảnh

Chỉ dùng ảnh đã quan sát trong thư viện ảnh công khai của [fanpage CLB Yêu Sách Bách Khoa Hà Nội](https://www.facebook.com/CLBYeuSachBachKhoaHaNoi/photos). Không dùng ảnh trên website cũ. Các ảnh thuộc bộ ảnh có khung “12TH ANNIVERSARY”; không gán ngày, tên talkshow hoặc nội dung phát biểu chưa xác minh.

| Tệp | Ảnh gốc Facebook | Vị trí |
| --- | --- | --- |
| `assets/community.jpg` | [Ảnh 1117986873782799](https://www.facebook.com/photo.php?fbid=1117986873782799) | Giới thiệu và kỷ niệm |
| `assets/together.jpg` | [Ảnh 1117986860449467](https://www.facebook.com/photo.php?fbid=1117986860449467) | Thành viên |
| `assets/conversation.jpg` | [Ảnh 1117986797116140](https://www.facebook.com/photo.php?fbid=1117986797116140) | Kết nối và lời mời |
| `assets/talkshow.jpg` | [Ảnh 1117986737116146](https://www.facebook.com/photo.php?fbid=1117986737116146) | Khoảnh khắc chia sẻ |

Giữ nguyên các tệp ảnh tải về; bố cục chỉ dùng CSS để đặt khung. Tên tệp `talkshow.jpg` dùng cho vị trí thiết kế, không xác nhận đây là một talkshow riêng. Nội dung các chương là bản biên tập mẫu; chưa có danh sách thành tích, sự kiện hay nhân sự được xác minh để trình bày như dữ kiện chính thức. Bìa chữ và wordmark là cách trình bày thử, chưa thay nhận diện của CLB.

## Phạm vi duyệt

- Nhịp cuộn, khoảng trắng, cỡ chữ và màu giấy.
- Cảm giác sách mở, cách đặt ảnh và dấu trang.
- Mức độ dễ điều khiển bằng cuộn/nút, dừng nửa trang và quay lại.
- Bố cục điện thoại so với máy tính.

Chưa triển khai dữ liệu sách thật, đặt chỗ, CAPTCHA thật, đăng nhập hoặc tích hợp web. Không commit/push/deploy bản mockup này.
