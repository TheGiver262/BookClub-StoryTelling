# Bộ concept UI YSBK — Thư viện ký ức

## Trạng thái sau khi xuất bộ concept

[Session handoff](../../SESSION-HANDOFF.md) và [trạng thái hiện hành](../../CURRENT-STATE.md) tổng hợp toàn dự án. Bộ này có **14 mẫu**; các đoạn tám màn hình phía dưới ghi mốc xuất ban đầu. Workspace hiện đã có `src/styles/ui.css` được import vào global và ảnh `docs/mockups/qa-evidence-2026-10-21/`, nên “chưa tích hợp” chỉ đúng lúc xuất concept, không dùng làm kết luận hiện tại. Chưa review toàn bộ diff UI mới trong lượt bàn giao.

Luồng tài khoản bạn đọc/đổi sách/thay IP đang thảo luận, không phải phạm vi mới được duyệt cho mẫu hoặc prompt này. Không tự sửa backend theo HTML thô Stitch.

Ngày: 21/10/2026. Công cụ tạo thiết kế: Google Stitch.

- Project: https://stitch.withgoogle.com/projects/18002116813589247564
- Design system: assets/14145913114696790624
- Phạm vi: concept PC và điện thoại; chưa tích hợp giao diện vào ứng dụng.
- Bảng màu lấy từ tailwind.config.mjs và src/styles/global.css hiện tại. Không đổi bộ nhận diện đã chốt.

## Hướng thiết kế
Thư viện ký ức kết hợp thẻ mục lục, phiếu mượn và bố cục tạp chí sinh viên. Nền sạch, ít trang trí, đường kẻ mảnh. Tránh làm giao diện thành đồ cổ tối hoặc gây khó đọc.

| Thành phần | Hướng đề xuất |
| --- | --- |
| Nút chính | Xanh #365E4B, chữ ivory, bo 14px, viền mảnh và bóng tản nhẹ; nhấn xuống 1px |
| Nút phụ | Nền ivory, viền xanh; liên kết có gạch chân |
| Thẻ và biểu mẫu | Phiếu giấy bo 22px, ít khung lồng nhau, nhóm trường rõ |
| Tab | Vách ngăn mục lục, tránh toàn bộ tab dạng viên thuốc |
| Shading | Phẳng / giấy xếp lớp / hộp nổi; bóng nhẹ, không phủ màu xám lên toàn trang |
| Chữ | Thử Newsreader cho tiêu đề; Be Vietnam Pro cho nội dung, số liệu và thao tác |
| PC | Tìm kiếm và bộ lọc cùng tủ sách; quầy quản lý dùng bảng có hành động rõ |
| Điện thoại | Bộ lọc riêng, chi tiết xếp dọc, bảng đổi thành phiếu, vùng chạm 48px |

## Bộ màn hình
1. Tủ sách — PC.
2. Tủ sách — điện thoại.
3. Chi tiết sách và giữ chỗ — PC.
4. Phiếu giữ chỗ — điện thoại.
5. Quầy mượn–trả — PC.
6. Sổ trực — điện thoại.
7. Bản tin câu lạc bộ — PC.
8. Bộ thành phần UI và các trạng thái.
9. Đăng nhập nội bộ — PC.
10. Tra cứu phiếu giữ chỗ — điện thoại.
11. Quản trị nội dung — PC.
12. Thành viên & CTV — PC.
13. Quỹ, tiền cọc & báo cáo — PC.
14. Lịch trực & công việc — điện thoại.

Các màn hình dùng nội dung minh họa. Số lượng sách, bản sách, thông tin người đọc và thời gian hiển thị không phải dữ liệu đang hoạt động của CLB. Logo/ảnh minh họa trong bản tạo không thay thế tài sản nhận diện chính thức.

## Giữ nguyên các quyết định sản phẩm
- Landing cuốn sách đã duyệt vẫn là điểm mở đầu.
- Một khu công khai, sáu mục; không tách thêm nhiều trang đích độc lập.
- Xem và đặt giữ chỗ không cần tài khoản; không công khai giải thích kỹ thuật IP/hạn mức.
- Đơn chỉ giữ một cuốn đến cuối buổi trực đã chọn. Không có mua hàng, giao hàng hay thanh toán trực tuyến.
- Khu nội bộ có cùng nhận diện nhưng ưu tiên rõ số liệu và thao tác mượn–trả.
- Không thay đổi quyền quản lý, vòng đời cộng tác viên/thành viên hoặc quy trình tài chính.

## Trước khi tích hợp
Đánh giá concept được chọn trên nội dung thật; kiểm tra dấu tiếng Việt, độ tương phản, tiêu điểm bàn phím, vùng chạm, màn hình nhỏ và bảng dài. Hiệu ứng, trạng thái tải/lỗi, phân trang và API phải được kiểm thử khi triển khai; bản concept tĩnh không xác nhận các chức năng đó.

## Bản xuất để xem
Mở http://127.0.0.1:4323/ để chuyển giữa tám màn hình. Các HTML được xuất từ Stitch rồi biên tập tại local: chuẩn hóa mã màu theo bảng đã chốt, sửa các quy định tự sinh, nới bảng quản lý và tăng nhãn nhỏ. Bản local là bản dùng để đánh giá; project Stitch lưu nguồn khám phá thiết kế.

Đã xem bằng trình duyệt: tủ sách PC, tủ sách trong khung 390px, bảng quầy mượn–trả sau khi nới bố cục, và bảng thành phần UI. Đây là kiểm tra concept, chưa phải kiểm thử tương tác ứng dụng hay kiểm định WCAG đầy đủ.

Kiểm tra xuất bản local: index và cả 8 màn hình trả HTTP 200; kiểm tra tĩnh 8/8 HTML có nội dung tiếng Việt và không có mã hex ngoài bảng màu đã khóa. Các kết quả này không thay cho kiểm tra chức năng hoặc tương phản toàn diện.

## Điều chỉnh theo phản hồi: bớt vuông vắn
Tám bản xem dùng chung soft-ui.css: nút và ô nhập bo 14px, thẻ bo 22px, tab bo hai góc trên 15px; chip trạng thái bo tròn. Bóng lệch cứng đổi sang bóng mềm. Bìa sách giữ góc nhỏ để còn dáng sách thật. Bảng màu và website chính giữ nguyên.

Stitch đã tạo thêm ba bản góc mềm cho tủ sách PC, tủ sách điện thoại và bảng thành phần; nguồn gốc lưu tại stitch-soft-source/. Bản xem local đồng bộ hình dáng cho cả tám màn hình. Kiểm tra lượt này: 8/8 HTML dùng soft-ui.css; 10/10 tài nguyên trang xem trả HTTP 200; đã xem bảng thành phần PC và bố cục điện thoại 390px trong trình duyệt.

## Gói bàn giao hoàn chỉnh
Đọc HANDOFF.md để xem đặc tả thống nhất và bảng bao phủ toàn bộ module; sao chép ANTIGRAVITY-PROMPT.md để giao việc. Trang index có 14 mẫu đại diện; các màn hình nghiệp vụ còn lại được ánh xạ rõ sang cấu trúc PC/mobile và trạng thái tương ứng trong HANDOFF, không phải 14 module mới. Kế hoạch triển khai ở docs/superpowers/plans/2026-10-21-ysbk-soft-ui.md tính từ gốc repo. Chưa thay giao diện ứng dụng, commit/push hay deploy.
