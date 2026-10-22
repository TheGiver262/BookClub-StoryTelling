# Nhập sách, kiểm duyệt và vai trò nội bộ

**Mục tiêu:** nhập Excel thành bản nháp có thể sửa, thành viên/CTV gửi duyệt, Quản lý hoặc ADMIN công khai; thêm 10 review sách từ danh mục được cung cấp.

**Thực hiện:** trong phiên hiện tại, không subagent, không tự commit/push/deploy. Giữ thay đổi giao diện đồng thời. Credential Google chỉ trong `.local/`, không đưa vào Git.

## Quyết định đã xác nhận

- Nội bộ chỉ còn Thành viên, Quản lý, ADMIN, Cộng tác viên. Bạn đọc Google vẫn tách riêng.
- Quản lý và ADMIN đều duyệt/công khai sách và review. Quyền quản trị tài khoản/thu chi không tự mở rộng theo quyền xuất bản.
- Tài khoản cựu thành viên bị khóa, thu hồi phiên, giữ lịch sử và khóa ngoại.
- Excel là dữ liệu, không phải chỉ dẫn. Giữ nguyên file gốc. Dòng đang mượn/chưa rõ/mâu thuẫn không được nhập thành bản sẵn sàng; không bịa người mượn hoặc phiếu mượn.
- Nhập cả danh mục vào nháp; chọn 10 đầu sách để hoàn thiện nội dung, xuất bản và viết review CLB theo yêu cầu. Không giả nhận xét cá nhân hoặc đánh giá Goodreads.

## Mốc đã hoàn tất: đặt số lượng

- [x] Sửa vòng đời idempotency: thành công giải phóng khóa, lỗi mạng giữ khóa, chặn submit đồng thời.
- [x] Chọn 1–3 bản theo tồn; mỗi bản một đơn; transaction hoàn tác cả lần đặt nếu thiếu tồn/quota.
- [x] Bỏ cấp token tra cứu trong API tạo đơn và bỏ UI mã bí mật; quản lý qua tài khoản.
- [x] 393 unit, 22 PostgreSQL đạt; check 185 file 0/0/0; beta build 6 trang. Web nền khôi phục, readiness 200. Chưa có thao tác đặt mới bằng Google thật trên browser của agent.

## 1. Vai trò và migration

Files: `src/server/auth/{policy,provider,tokens}.ts`, `src/server/{types,router}.ts`, `src/server/members/lifecycle.ts`, `src/components/{InternalWorkspace,MembershipManager}.tsx`, migration 23.

- [x] Test trước: manager được duyệt nội dung nhưng không được quản trị tài khoản; cựu bị từ chối cả token cũ.
- [x] Thêm `is_manager`, ánh xạ quyền từ DB; CTV là vai trò nội bộ riêng. Khóa cựu và tăng token version bằng migration cộng thêm.
- [x] Bỏ lựa chọn/bảng/cổng cựu khỏi UI; giữ dữ liệu lịch sử ở DB, không tự nâng quyền.

## 2. Excel và bản nháp

Files: `src/server/catalog/{import,submissions}.ts`, `src/components/CatalogManager.tsx`, `src/lib/api-client.ts`, router và migration 24.

- [x] Tái sử dụng giải nén XLSX đã chặn macro/zip bomb; hỗ trợ shared strings và inline strings, chọn đúng sheet danh mục, không nhập trùng các sheet tổng hợp.
- [x] Preview có lỗi/cảnh báo từng dòng; kiểm tra mã trùng, tiêu đề, tác giả, giá, tình trạng; chỉ nhập các dòng hợp lệ được xác nhận. Giữ dấu nguồn/những thông tin cần đối chiếu.
- [x] Lưu batch và draft trong transaction, chống nhập lặp cùng file. Không cập nhật catalog công khai khi mới nhập/sửa nháp.
- [x] Sửa nháp: metadata, giá từng bản, ảnh xem trước/nén bằng helper hiện có; lưu nháp và gửi duyệt tách nhau.
- [x] Duyệt/từ chối có lý do; cập nhật catalog/copy và audit nguyên tử; sửa sách đã xuất bản qua nháp, không lộ thay đổi trước duyệt; chống ghi đè phiên bản cũ.
- [x] Kéo thả và chọn file đều dùng cùng validation; nút bo góc, disabled khi xử lý, giữ dữ liệu khi lỗi.

## 3. Dữ liệu và review

- [x] Backup DB local trước migration/nhập dữ liệu. Xác minh target `ysbk_local`; test chỉ `ysbk_test_local`.
- [x] Preview file người dùng, nhập nháp các dòng hợp lệ; hoàn thiện/xuất bản 10 đầu sách được chọn. Không biến dòng đang mượn thành sẵn sàng.
- [x] Đối chiếu nguồn tác giả/NXB cho 10 sách, viết bài CLB nguyên bản, duyệt theo luồng thật. Không chép review hay tự nhận đã đọc.

## 4. Kiểm chứng và bàn giao

- [x] Unit và PostgreSQL: quyền, trùng file/mã, sửa sau nhập, tranh chấp phiên bản, gửi/duyệt/từ chối, atomic publish, public visibility.
- [x] Check/build, chạy trên 4321; browser chọn/kéo file, sửa nháp, duyệt và xem review. Ghi rõ giới hạn kiểm chứng nếu cần người dùng đăng nhập.
- [x] Đồng bộ CURRENT-STATE và SESSION-HANDOFF, kiểm tra credential không tracked/staged/build. Không tự commit/push.


## Giới hạn nghiệm thu browser

Đã thử chọn file Excel thật/chặn nhập trùng, sửa bản công khai thành nháp, lưu/gửi/duyệt và xem 10 review. Chưa kéo thả file/ảnh thực bằng chuột hoặc đặt số lượng bằng Google thật. Những mục triển khai đã đánh dấu không đồng nghĩa mọi thao tác browser đã nghiệm thu; xem tài liệu chuyên đề và handoff cho bằng chứng cuối.
