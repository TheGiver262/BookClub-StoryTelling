# Bản 03: từ tình yêu sách đến một cộng đồng

Tài liệu lịch sử. Nội dung hiện tại theo [REVIEW-V5.md](REVIEW-V5.md): đã nhận bộ ảnh mới trực tiếp từ người dùng và cập nhật danh mục hoạt động.

Ngày: 20/10/2026. Mockup riêng, chưa tích hợp vào ứng dụng, chưa commit/push/deploy.

Xem **http://localhost:4322/?v=3**. Bản 02 được giữ tại **http://localhost:4322/book-v2.html**; bản tạp chí đầu tiên tại `/editorial-v1.html`.

Cập nhật 21/10/2026: thay riêng minh họa bìa bằng bản V4 theo ba ảnh tham khảo mới của người dùng: ít chủ thể, mảng màu phẳng, người đọc trên cỏ và ba bông hoa. Tệp và prompt ở [cover-minimal-v4.prompt.md](cover-minimal-v4.prompt.md). Xem với `?v=4`; nội dung và cơ chế lật giữ V3. Chưa lấy được ảnh thành viên mới: gọi đúng tab Facebook được chia sẻ vẫn trả lỗi quyền trình duyệt bị tắt trong Work settings.

Kiểm tra lại sau thay bìa: **13/13** kiểm tra đạt; **29** đường dẫn HTTP đạt. Preload HTML và CSS đều trỏ ảnh V4, dữ liệu PNG phục vụ qua HTTP khớp tệp đã lưu. Chưa kiểm tra trực quan bìa trong trình duyệt vì giới hạn quyền công cụ.

## Thay đổi theo yêu cầu

- Thay cơ chế bản lề `rotateY` bằng gấp từ góc phải dưới: chia vùng giấy, phản chiếu mặt sau, nếp cong và bóng thay đổi theo vị trí cuộn. Không tự lật hết khi người dùng dừng; cuộn ngược đi qua cùng vị trí. Đây là mô phỏng giấy bằng các lớp 2D, không dùng WebGL.
- Chương có chữ xen kẽ ảnh trái/chữ phải rồi chữ trái/ảnh phải. Các trang tổng quan hoạt động chỉ có ảnh và tên. Mỗi hoạt động chi tiết có một trang chữ và một trang hai khung ảnh.
- 11 cặp trang: khởi đầu → con người → tổng quan bảy hoạt động → mượn miễn phí → Đêm Sách → sinh hoạt → giao lưu → tặng giáo trình → dã ngoại → tuyển thành viên → slogan lớn.
- Bìa mới dùng minh họa gốc, không dùng AI tái tạo ảnh hoạt động. Prompt và đường dẫn tại `cover-youth-v3.prompt.md`.
- Logo lấy nguyên vùng ảnh người dùng gửi bằng SVG viewport. Màu xanh lấy mẫu **#819079**, RGB **129, 144, 121**; cách đo nằm trong `logo-color.json`. Vì đầu vào là JPEG trong poster, đây là màu đo từ tham chiếu, chưa phải xác nhận mã từ một bộ nhận diện vector gốc.
- Ngày thành lập **16/09/2013** do người dùng xác nhận. Ảnh đầu là ảnh tư liệu trên website cũ, không chú thích đó là ảnh chụp chính ngày thành lập.

## Nguồn và độ khớp ảnh

| Nội dung | Nguồn | Cách dùng |
| --- | --- | --- |
| Khởi đầu, mục đích, tự nguyện/phi lợi nhuận | [Website CLB](https://clbyeusachbkhn.weebly.com/) | Diễn đạt lại ngắn gọn; ảnh tập thể thời kỳ đầu |
| Đọc/chia sẻ, tủ sách, tặng giáo trình, ngoại khóa | [Hoạt động trên website CLB](https://clbyeusachbkhn.weebly.com/ho7840t-2727896ng.html), [gallery](https://clbyeusachbkhn.weebly.com/gallery.html) | Ảnh đặt theo nội dung thực tế đã xem; ghi ảnh tư liệu. Không dùng lịch trực thứ 2 trên website cũ |
| Đêm Sách, sinh hoạt, thành viên nhiều trường | [HUST, 12/04/2024](https://hust.edu.vn/vi/news/hoat-dong-chung/yeu-sach-nhu-sinh-vien-bach-khoa-655055.html) | Ảnh tập thể Đêm Sách đúng chú thích nguồn; hai khung toàn cảnh/cận cảnh từ cùng một ảnh, không giả là hai lần chụp |
| Giao lưu các CLB Hà Nội, giáo trình, dã ngoại | [Sở VH&TT Hà Nội, 10/11/2021](https://sovhtt.hanoi.gov.vn/cau-lac-bo-yeu-sach-bach-khoa-ha-noi-khoi-nguon-van-hoa-doc/) | Dùng các hoạt động đã được ghi nhận; không gán số liệu lịch sử thành số liệu hiện tại |
| Các gương mặt trong bộ ảnh 12 năm | [Fanpage CLB](https://www.facebook.com/CLBYeuSachBachKhoaHaNoi/) | Ảnh Facebook đã lấy ở bước trước; chưa xác nhận các bạn còn là thành viên đang hoạt động năm 2026 |
| Tuyển thành viên Gen 13 | Ảnh người dùng đính kèm | Đúng ảnh gian sách và hoạt động tuyển thành viên |
| Hình Artemis trên Facebook | Ảnh đại diện công khai lúc khảo sát | Minh họa nhận diện đợt tuyển; không thông báo đang mở đơn |
| Tủ sách / sách trên bàn | Ảnh người dùng đính kèm | Không gán nhầm là ảnh Đêm Sách hoặc sinh hoạt |

Các tệp `historical-meet.jpg` và `historical-collaboration.jpg` thực tế là lửa trại và ảnh nhóm ngoại khóa; tên tệp nội bộ không được dùng làm bằng chứng phân loại. `historical-outing.jpg` thực tế là ngày hội đọc sách. Đã xem ảnh và dùng đúng chú thích trong sách.

Trang tặng giáo trình dùng hai khung toàn cảnh/cận cảnh từ cùng ảnh tư liệu đúng hoạt động; không dùng ảnh bàn tiểu thuyết người dùng gửi để đại diện cho giáo trình. Vị trí này cũng nên được thay bằng ảnh chụp khác khi đọc được album mới.

## Còn cần ảnh để hoàn thiện nội dung

Người dùng yêu cầu thay bộ ảnh 12 năm bằng ảnh mới từ tháng 9 trở đi, bắt đầu từ [ảnh Facebook 1409434017971415](https://www.facebook.com/photo.php?fbid=1409434017971415&type=3). Chưa thay ảnh trong trang con người: các lần đọc công khai chỉ nhận trang chung/yêu cầu đăng nhập, không có ảnh gốc hoặc ngày đăng để xác minh. Đã thử chọn trực tiếp link trong Brave theo yêu cầu, nhưng công cụ vẫn trả `Local browser use is disabled in Work settings`. Cần truy cập được tab đó trước khi chọn thêm ảnh cùng thời kỳ; không lấy các URL tài nguyên giao diện làm ảnh hoạt động.

Công cụ trình duyệt đang báo local browser bị tắt. Đọc Facebook công khai chỉ nhận được ảnh đại diện, không có album hoạt động để chọn mới. Vì vậy chưa thay đủ tư liệu bằng ảnh Facebook mới nhất, chưa xác nhận đội hình hiện tại; chưa có ảnh riêng chứng minh một buổi giao lưu cụ thể với CLB đối tác. Bản thử dùng tư liệu có nguồn, không gán sai sự kiện hoặc dựng ảnh người thật. Khi có quyền đọc album, ưu tiên thay các vị trí này cùng ảnh Đêm Sách thứ hai.

## Kiểm tra

```powershell
node --test --test-isolation=none docs/mockups/open-book/book-timeline.test.mjs docs/mockups/open-book/page-curl.test.mjs docs/mockups/open-book/book-content.test.mjs
```

Kiểm tra timeline, phân vùng/nếp gấp qua ba tỷ lệ trang, cuộn ngược, toàn bộ chương, ảnh có nguồn, và màu/logo tham chiếu. Chưa kiểm tra trực quan CSS/độ mượt/FPS trên desktop hoặc điện thoại do quyền công cụ; không suy ra các kết quả đó từ unit test. Ảnh minh họa bìa đã được xem; ảnh tư liệu đã được xem riêng để tránh gắn sai tiêu đề.

Kết quả: **13/13** kiểm tra đạt, không bỏ qua. Kiểm tra HTTP riêng đạt **28** đường dẫn trang/module/ảnh, đúng MIME và cache; tệp riêng, test và đường API bị từ chối. HTML/CSS/module không cache để thấy sửa đổi; ảnh dùng cache riêng của trình duyệt một giờ để tránh tải lại khi đổi mặt giấy. Bản 02 trỏ đúng module riêng, không bị đổi hiệu ứng khi xem lại.
