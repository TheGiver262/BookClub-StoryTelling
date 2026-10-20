# V8 · màu bìa, slogan cong, gáy sách, điều hướng và viền logo

Xem tại http://localhost:4322/?v=8. Mockup độc lập, chưa tích hợp web chính, chưa commit/push/deploy.

## Thay đổi

- Title phối đỏ đất `#9b4d36` cho “Yêu Sách”, xanh đậm `#365e4b` cho “Bách Khoa”, vàng nâu `#9a6928` cho “Hà Nội”, giữ nền kem và minh họa cỏ.
- Slogan viết tay đặt trong vùng giữa title và đường cỏ, uốn bằng SVG `textPath`. Tiếp tục dùng Dancing Script cục bộ có bộ glyph tiếng Việt đã kiểm tra. Path của bìa clone có ID riêng để không trùng tham chiếu với mẫu bìa ẩn.
- Bỏ hoàn toàn dòng “Một cuốn sách. Một câu chuyện của chúng mình.”, đồng thời bỏ tham chiếu DOM của dòng này khỏi vòng render.
- Tăng độ dày gáy, khối trang và mép bìa dưới bằng các phần tử có sẵn, màu vật liệu và bóng sáng. Đây là mô phỏng bằng CSS.
- Dãy số chương được định vị tại 50% chiều ngang của thanh đáy đối xứng và dịch nửa chiều rộng của chính nó. Nút trái/phải tách khỏi thanh đáy, đặt ở hai mép viewport, giữa chiều cao. Vùng sách có khoảng chừa cho nút bấm, không đặt nút lên nội dung trang.
- Logo CLB chuyển từ PNG/mask sang `assets/club-logo-v8.svg`: bốn path vector, fill `#819079`, nền rỗng, không nhúng bitmap hoặc dùng PNG mask. Các đường cong được dựng lại theo hình phục hồi trước, không phải tệp vector nhận diện chính thức; vẫn cần đối chiếu bản gốc nếu dùng cho xuất bản.
- Cặp logo chân bìa dùng `assets/partner-logos-clean-v8.svg`: giữ bitmap gốc phục hồi ở V7, nhúng trong SVG và lọc alpha rất nhạt để giảm nhiễu viền. Cặp logo này chưa chuyển thành vector đường nét; các chi tiết nhỏ vẫn giới hạn bởi ảnh nguồn.

## Kiểm tra

- **19/19** kiểm tra nội dung/markup/timeline/nếp gấp đạt. Bao gồm tham chiếu path slogan khi clone, không trùng ID; nhãn cũ không còn; nút lật và dãy số chương ở vùng riêng; logo CLB có path SVG và không nhúng ảnh.
- **49 đường dẫn HTTP** đạt, đúng MIME/cache, đường riêng/API không được phục vụ. HTML V8 và hai SVG được phục vụ khớp tệp đã lưu. HTML không có thẻ lồng sai/thiếu đóng. Không có lỗi trong log server khi kiểm tra.
- Đã render riêng hai SVG để kiểm tra viền trên nền kem; logo CLB render được ở cỡ hiển thị nhỏ. Đã kiểm tra lớp alpha rất nhạt của cặp logo được loại bỏ qua bộ lọc.
- Chưa xác nhận bố cục bìa, vị trí điều hướng hoặc độ mượt trong trình duyệt qua công cụ. Render SVG riêng, unit và HTTP không thay thế kiểm tra giao diện thật.
