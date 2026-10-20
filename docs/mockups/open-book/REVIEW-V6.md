# V6 · logo trong suốt, rõ nét

Xem tại http://localhost:4322/?v=6. Chỉ thay logo bìa trong mockup; nội dung V5 và minh họa bìa V4 giữ nguyên.

- Phục hồi biểu tượng theo ảnh bảng CLB mới người dùng gửi: bán nguyệt, trang lật bên trái, các đường trang sách và đường chân ngang. Đây là bản phục hồi từ ảnh chụp, chưa phải vector gốc, không cam kết đường cong trùng tuyệt đối bản thiết kế gốc.
- Tệp `assets/logo-restored-v6.png`, 1774×887, RGBA; ngoài logo và phần rỗng giữa các nét có alpha trong suốt thật. [Prompt và phương thức](logo-restored-v6.prompt.md).
- Thay ảnh crop poster 50×30 bằng hình phục hồi độ phân giải cao. Bỏ nền xanh nhạt, bo góc và bóng của khung logo cũ.
- HTML giữ tên truy cập qua `role="img"` và `aria-label`. CSS dùng alpha PNG làm mask, tô `var(--brand)` = `#819079` để màu hiển thị đồng nhất, không dùng màu loang trong ảnh chụp.
- Không chỉnh ảnh thành viên/sự kiện, không tích hợp web chính hoặc commit/push.

Kiểm tra alpha bằng đọc PNG: vùng ngoài/trang lật/khoảng giữa trang sách có alpha 0; phần thân và đường chân có alpha trên 240. Không suy ra bố cục/độ mượt trình duyệt từ việc kiểm tra PNG hoặc HTTP.

Kết quả: **14/14** kiểm tra nội dung/timeline/nếp gấp/logo đạt; **43** đường dẫn HTTP đạt. PNG phục vụ qua HTTP khớp tệp đã lưu; HTML giữ nhãn truy cập, CSS dùng asset mới và không còn nền `#d4dff1`. Bìa V4 và bản V2 vẫn trỏ đúng asset/module của chúng. Chưa xác nhận trực quan trong trình duyệt qua công cụ.
