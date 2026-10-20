# V7 · bìa đủ tên, chữ dễ đọc, ảnh con người và trang kết

Xem tại http://localhost:4322/?v=7. Mockup độc lập, chưa tích hợp web chính hoặc commit/push/deploy.

## Thay đổi

- Bìa ghi đủ “Câu lạc bộ / Yêu Sách / Bách Khoa Hà Nội”. Slogan nằm ngay dưới tiêu đề, không còn ở chân bìa.
- Slogan dùng Dancing Script lưu cục bộ trong `assets/dancing-script.ttf`, không phụ thuộc Google Fonts khi tải riêng font này. [Metadata Google Fonts](https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/METADATA.pb) xác nhận tập ký tự Vietnamese; giấy phép OFL lưu tại `dancing-script-OFL.txt`. Đọc bằng FreeType/Pillow kiểm tra 94 ký tự gồm slogan và các dấu tiếng Việt, không có glyph thiếu. Font nội dung Lora/Be Vietnam Pro giữ cấu hình tải/fallback hiện có.
- Dòng “Hà Nội · Từ 16.09.2013” lớn và đậm hơn, nằm trên nền kem ở chân bìa. Cặp logo Đại học Bách Khoa Hà Nội và Hội Sinh viên được tách/phục hồi từ poster đính kèm; đặt ở hàng cuối, trong vùng riêng dưới minh họa nhân vật. Logo CLB V6 giữ nguyên.
- Tăng cỡ chữ ở góc trang, nguồn tư liệu, hướng dẫn cuộn, mô tả ảnh, trạng thái đọc và số trang; có cỡ riêng cho màn hình hẹp/thấp. Không coi các media query là bằng chứng đã kiểm tra trực quan.
- Chương con người dùng hai mặt sách: ảnh 1–2 bên trái, ảnh 3–4 bên phải, mỗi bên hai khung lớn. Thay đoạn giới thiệu dài bằng lời dẫn ngắn để dành diện tích cho ảnh; không thêm chương, vẫn mười chương.
- Trang kết có hai minh họa gốc: sinh viên mở sách ở vế “Mở sách”; cuốn sách mở ra thế giới, mầm cây và trang giấy bay lên trời ở vế “Đọc tương lai”. Cùng bảng màu và nét vẽ đơn giản như bìa V4. [Prompt/tệp ảnh](illustrations-v7.prompt.md).

## Kiểm tra và giới hạn

- Unit/markup: bìa đủ tên, vị trí slogan, font và logo; renderer chia đúng 2+2 ảnh và đủ bốn ảnh không trùng; mỗi vế kết gắn đúng minh họa/alt; các kiểm tra nội dung/timeline/nếp gấp trước đó.
- HTML: kiểm tra lồng thẻ đóng/mở, không có thẻ dư hoặc thiếu.
- Font: kiểm tra bộ glyph tiếng Việt trước khi phục vụ qua HTTP. Server chỉ thêm `.ttf` vào danh sách asset cho phép, không mở quyền đọc tệp tùy ý.
- PNG logo đối tác là bản phục hồi từ ảnh chụp, chưa phải vector gốc. Minh họa đã xem riêng; chưa xác nhận bố cục và font đã được render trong trình duyệt vì công cụ vẫn trả `Local browser use is disabled in Work settings`.

Kết quả: **17/17** kiểm tra đạt, không bỏ qua; **47** đường dẫn HTTP đạt. HTML V7, font và ba PNG mới được phục vụ đúng MIME, khớp byte với tệp trong dự án. PNG logo đối tác có nền alpha; kiểm tra font đủ 94 ký tự nêu trên; HTML không có thẻ lồng sai/thiếu đóng. Log lỗi server trống lúc kiểm tra. Chưa kiểm tra trực quan bìa, cỡ chữ và bố cục responsive trong trình duyệt qua công cụ; các ảnh chụp người dùng gửi chỉ là bằng chứng của bản V6 trước chỉnh sửa.
