# Bản 05 · ảnh CLB do người dùng cung cấp

Ngày 21/10/2026. Xem tại http://localhost:4322/?v=5. Chỉ sửa mockup riêng; chưa tích hợp web chính, chưa commit/push/deploy. Giữ bìa minh họa V4 và cơ chế cuộn/lật hiện có.

## Nội dung đã cập nhật

- Thay bộ ảnh thành viên 12 năm bằng bốn ảnh mới người dùng xác nhận. Ảnh bánh kỷ niệm 13 tuổi được chú thích là dấu mốc, không gọi là ảnh chân dung thành viên.
- Bỏ mục tặng giáo trình khỏi trang tổng quan, trang chi tiết và điều hướng vì người dùng xác nhận hoạt động đã dừng.
- Thay giao lưu CLB bằng Ngày Sách Việt Nam, dùng đúng cặp ảnh gian sách và thảo luận sách giấy/sách điện tử. Không gán ngày chụp cho ảnh khi chưa có thông tin; ảnh gian sách có nhận diện sự kiện năm 2026.
- Còn 10 cặp trang: khởi đầu → con người → tổng quan sáu hoạt động → mượn sách → Đêm Sách → sinh hoạt hàng tuần → Ngày Sách Việt Nam → dã ngoại → tuyển thành viên → slogan.
- Tổng quan chia ba hoạt động mỗi bên. Trang con người có lưới bốn ảnh; ảnh chi tiết được hiển thị trọn khung để tránh cắt mặt và nội dung sự kiện.

## Ánh xạ ảnh đính kèm

| Số ảnh trong tin nhắn | Tệp trong assets | Vị trí / chú thích |
| --- | --- | --- |
| 1 | members-current-group.jpg | Tập thể thành viên hiện tại |
| 2 | members-current-friends.jpg | Nhóm bạn thành viên |
| 3 | members-anniversary-13.jpg | Bánh kỷ niệm 13 tuổi |
| 4 | members-current-campus.jpg | Thành viên tại cổng CLB |
| 5 | loans-book-table.jpg | Bàn sách cho mượn |
| 6 | book-night-group.jpg | Tập thể tại Đêm Sách |
| 7 | book-night-sharing.jpg | Khoảnh khắc tại buổi chia sẻ sách |
| 8 | outdoors-big-game.jpg | Big Game Gen 13; phân loại theo nội dung ảnh |
| 9 | outdoors-group.jpg | Dã ngoại; ảnh gốc 590×393, giữ nguyên độ phân giải |
| 10 | recruitment-artemis.jpg | Poster Artemis; chỉ minh họa đợt tuyển, không thông báo đang mở đơn |
| 11 | recruitment-interview.jpg | Phỏng vấn tuyển thành viên; phân loại theo nội dung ảnh |
| 12 | vietnam-book-day-talk.jpg | Thảo luận sách điện tử/sách giấy |
| 13 | vietnam-book-day-booth.jpg | Gian sách trong Ngày Sách và Văn hóa đọc Việt Nam 2026 |

Tất cả 13 ảnh được chép nguyên bản vào dự án, kiểm tra SHA-256 khớp tệp đính kèm. Không tái tạo người thật bằng AI, không chỉnh ảnh hay xóa nhận diện CLB. Thông tin hoạt động hiện tại theo xác nhận của người dùng; không phụ thuộc quyền đọc Facebook.

## Giới hạn còn lại

Chưa có cặp ảnh riêng của sinh hoạt hàng tuần trong bộ mới. Trang đó giữ `historical-reading.jpg` và `historical-trip.png`, có chú thích ảnh tư liệu. Ảnh lịch sử giới thiệu CLB và ảnh bàn sách người dùng gửi trước vẫn được dùng đúng mục đích. Các tệp cũ được giữ để bảo toàn bản thử trước, nhưng nội dung V5 không còn giới thiệu tặng giáo trình/giao lưu CLB.

Chưa kiểm tra trực quan bố cục/độ mượt trong trình duyệt vì công cụ Browser Use vẫn báo bị tắt trong Work settings ở lần kiểm tra gần nhất. Kiểm tra source và HTTP không thay thế việc duyệt trực quan.

## Kiểm tra

```powershell
node --test --test-isolation=none docs/mockups/open-book/book-content.test.mjs docs/mockups/open-book/page-curl.test.mjs docs/mockups/open-book/book-timeline.test.mjs
```

Kết quả nội dung/timeline/nếp gấp: **14/14 đạt**, không bỏ qua. Kiểm tra đối chiếu đủ 13 ảnh mới, vị trí theo hoạt động, sáu mục tổng quan và mười chương; không còn nội dung đã yêu cầu bỏ. HTTP đạt **42 đường dẫn**: đúng MIME/cache, bản V2 vẫn dùng module riêng, các đường dẫn riêng/API không được phục vụ. Cả 13 ảnh tải qua HTTP có SHA-256 khớp ảnh đính kèm; HTML/CSS vẫn dùng đúng bìa V4 và HTML hiển thị nhãn bản 05. Log lỗi server trống tại thời điểm kiểm tra.
