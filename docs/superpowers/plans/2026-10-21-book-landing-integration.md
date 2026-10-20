# Đưa cuốn sách vào web local

Phạm vi đã duyệt: landing cuốn sách, phần hướng dẫn tiếp sau chương 10, trang tra cứu riêng và giao diện đồng bộ cả công khai/nội bộ. Chưa deploy, commit hoặc push.

Đã thực hiện trên local. Kết quả và giới hạn kiểm chứng: [book-landing-local.md](../../technical/book-landing-local.md).

1. Giữ các bản mockup cũ; chuyển bản được duyệt thành component Astro và tài nguyên `/book/`.
2. Tách bìa cứng khỏi thuật toán lật giấy: bìa nhô ba cạnh, bản lề sát gáy, có ruột giấy và bìa sau. Rút gọn lời giới thiệu. Nút trái về bìa trực tiếp từ mọi tiến độ đọc chương đầu. Điều hướng bằng nút có nhịp chậm, có thể ngắt bằng cuộn/touch/phím.
3. Trang kết dùng cùng chỉ mục với các trang khác; hiện lần lượt chữ trái → ảnh trái toàn trang → chữ phải → ảnh phải toàn trang. Cuộn hết sách ra phần hướng dẫn bình thường.
4. Trang `/sach/` chỉ có tra cứu, đặt và tra đơn, 50 đầu sách/trang; tìm tên/tác giả, lọc thể loại và còn sách. Dùng lại CAPTCHA, hạn mức, token tra đơn và cập nhật tồn. Giữ lối vào nội dung cộng đồng/tuyển thành viên riêng, bảo toàn liên kết cũ.
5. Đồng bộ token màu, serif/sans và logo ở đăng nhập, chi tiết sách, nội bộ; không đổi quyền hay nghiệp vụ.
6. Chạy kiểm thử timeline/chuyển trang/markup, hợp đồng danh mục và PostgreSQL dành riêng test khi local sẵn sàng; Astro/TypeScript/build; HTTP trang chủ, tài nguyên, danh mục, login và nội bộ. Mở localhost bằng công cụ ứng dụng. Ghi rõ phần UI chưa quan sát được nếu Browser Use vẫn bị tắt ở lớp công cụ.

Tham khảo cấu tạo: [Lulu – Anatomy of a Hardcover](https://help.lulu.com/en/support/solutions/articles/64000308572-creating-your-hardcover-casewrap-cover): overhang ba cạnh, không ở cạnh gáy; hinge giữa board và spine. Chỉ dùng làm tham khảo hình học, không sao chép ảnh vào sản phẩm.
