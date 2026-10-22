# Nhập danh mục và duyệt sách — 22/10/2026

## Luồng dùng trong CLB

Vào nội bộ → **Nhập sách & gửi duyệt**. Thành viên và CTV chuẩn bị nội dung; Quản lý hoặc ADMIN duyệt/công khai. Quyền xuất bản không cấp thêm quyền quản trị tài khoản.

1. Kéo file hoặc chọn `.xlsx` dưới 5 MB. Xem sheet, số dòng hợp lệ và lỗi/cảnh báo từng dòng.
2. **Xác nhận nhập các dòng hợp lệ thành nháp**. Chưa ghi vào kho công khai. Nhập lại cùng file bị chặn bằng SHA-256; mã bản đã có trong kho/nháp cũng bị báo trùng.
3. Tìm bản nháp, bấm mở để sửa tên, tác giả, thể loại, NXB, tóm tắt, ảnh và giá/tình trạng từng bản. **Lưu nháp** để làm tiếp sau.
4. **Lưu và gửi duyệt**. Bản chờ duyệt không sửa trực tiếp; người tạo hoặc người duyệt có thể **Rút về nháp để sửa**.
5. Quản lý/ADMIN **Duyệt và công khai**, hoặc **Yêu cầu chỉnh sửa** kèm lý do. Công khai cập nhật sách, bản vật lý và audit trong cùng giao dịch; lỗi thì hoàn tác cả lần duyệt.
6. Sửa sách đã công khai bằng ô **Sửa sách đã công khai** để tạo bản sửa. Nội dung cũ tiếp tục hiển thị cho đến khi bản sửa được duyệt. Phiên bản cũ không ghi đè được bản mới.

Các bản nháp là danh sách làm việc chung của nội bộ. Mỗi lần ghi kiểm tra phiên bản; hai người mở cùng bản, người lưu sau phải tải lại nếu nội dung đã đổi. Lưu nháp trước khi chuyển mục hoặc đóng trang.

## File Excel

Cột tối thiểu: **Mã sách**, **Tên sách**. Hỗ trợ cả tên cột trong file gốc như `Tên sách (gốc)`, `Tác giả (gốc)`, `Thể loại gợi ý`, `Tình trạng mượn`. Giá bìa/NXB có thể trống. Khi chưa biết giá, giữ NULL; cọc vẫn theo chính sách hiện hành.

Ưu tiên sheet **DANH MỤC GỘP**, không nhập lại các sheet tổng hợp khác. Nhóm bản theo tên sách + tác giả sau chuẩn hóa khoảng trắng/hoa thường; không tự ghép các tác giả/tên viết sai. Vì vậy số nhóm nháp có thể khác số đầu sách trên sheet thống kê của file gốc.

Chỉ giá trị `Sẵn sàng`, `Còn`, `AVAILABLE` mở đặt sau khi duyệt. Đang mượn/chưa rõ/mâu thuẫn hoặc tình trạng trống chuyển sang **Chờ đối chiếu / chưa cho đặt**, giữ ghi chú nguồn. Không tự dựng phiếu mượn hoặc người mượn. Mã bản tối đa 50 ký tự chữ/số/`.`/`_`/`-`, giữ số 0 đầu khi Excel lưu dạng chữ. Các ô nhập liệu có công thức phải chuyển thành giá trị trước khi nhập.

Giới hạn hiện tại: 2.500 dòng, 100 cột, 100 bản/đầu sách trong một lần sửa; file XLSX được kiểm tra dung lượng giải nén và macro. Ảnh dùng helper có sẵn: PNG/JPEG/WebP, resize/nén trước khi gửi; không tải ảnh từ URL trong Excel tự động.

## Vai trò và tài khoản

- Nội bộ: MEMBER, MANAGER, ADMIN, COLLABORATOR. Google chỉ tạo tài khoản bạn đọc riêng.
- Tài khoản cũ gắn `is_alumni` bị khóa và tăng token version. Giữ cờ/khóa ngoại để đọc lịch sử; không còn role hoạt động hoặc cổng UI cho cựu thành viên.
- Chỉ ADMIN quản trị vai trò/tài khoản. Quản lý và ADMIN duyệt sách/review, xuất bản bài viết.
- Số lượng đặt 1–3 bản tùy tồn/hạn mức hiện hành; mỗi bản có đơn/mã riêng. Nếu thiếu tồn hoặc quota, hoàn tác cả lần đặt. UI không cấp/nhập mã bí mật đơn; bạn đọc dùng **Sách của tôi**.

## Dữ liệu local đã nhập

Nguồn: file `Danh_muc_sach_CLB_YSBK_tong_hop_bo_sung.xlsx` người dùng cung cấp, giữ nguyên bản gốc trong Downloads. Nhập **794 bản thành 743 nhóm nháp**, 0 dòng lỗi. Batch `81858194-f012-43d9-881e-414278f858e6`.

Đã duyệt 10 nhóm/17 bản: Nếu biết trăm năm là hữu hạn; Giông tố; Thương nhớ mười hai; Cho tôi xin một vé đi tuổi thơ; Số đỏ; Tôi thấy hoa vàng trên cỏ xanh; Mắt biếc; Dế Mèn phiêu lưu ký; Hoàng Tử Bé; Nhà giả kim. Còn **733 nhóm/777 bản** của batch ở nháp để CLB bổ sung và đối chiếu. Không tự công khai toàn bộ danh mục.

Đã thêm 10 review CLB nguyên bản, gửi PENDING rồi duyệt APPROVED qua service; có nhãn CLB/ghim và hiển thị trên `/sach/?tab=review`. Điểm sao là đánh giá biên tập cho bài CLB, không phải điểm Goodreads. Nội dung và nguồn đối chiếu nằm ở [catalog-starter-reviews.json](../../scripts/data/catalog-starter-reviews.json). Chưa bổ sung ảnh bìa riêng cho 10 sách; dùng ảnh dự phòng hiện có cho đến khi CLB upload.

Sau kiểm tra UI có thêm một bản sửa Nhà giả kim đã duyệt ngoài batch gốc; không thêm đầu sách/copy trùng. Tổng tủ sách công khai local: **14 đầu**, gồm 10 đầu mới và 4 đầu local có sẵn.

## Bằng chứng và giới hạn

- Trước migration/nhập: backup local `.local/ysbk/backups/before-catalog-2026-10-22T08-44-03-858Z.dump`, 252.396 byte, `pg_restore --list` hợp lệ. Migration 23/24 cộng thêm; đã kiểm tra quyền `ysbk_app` và cập nhật schema fingerprint. Không reset `ysbk_local`.
- Unit: 399 ca đạt. PostgreSQL đã qua 40 ca liên quan (39 ca ban đầu và thêm hồi quy metadata khi có đơn giữ chỗ); kiểm thử chỉ dùng `ysbk_test_local`. Check 193 file: 0 lỗi/cảnh báo, 1 hint `isLink` chưa dùng trong landing đang được sửa đồng thời; không chỉnh phần đó. Beta build 6 trang đạt.
- Browser thật: đăng nhập ADMIN local; chọn file gốc để xem preview/chặn mã trùng; mở bản sửa Nhà giả kim, lưu, gửi duyệt, công khai. API trước duyệt giữ mô tả cũ, sau duyệt trả mô tả mới. Đã sửa và kiểm tra trường hợp chỉ đổi tóm tắt khi có đơn giữ chỗ: cho lưu nội dung, vẫn chặn đổi giá cọc của bản đang giữ. Đã thấy đủ 10 review trên public UI. Kiểm tra mobile 390px: tên file xuống dòng, không tràn ngang; mở nháp tự cuộn tới vùng sửa.
- Chưa nghiệm thu thao tác kéo file bằng chuột, upload/nén ảnh mới, hoặc đặt số lượng bằng Google thật trong lượt này. Các nhánh nghiệp vụ được kiểm tra ở service/HTTP/PostgreSQL không thay thế những thao tác browser còn thiếu.
- Cloudflare Access/tên miền/cloud chưa cấu hình; đây là dữ liệu và kiểm chứng local. Credential Google ở `.local/`, không commit/push. HTTP cuối lượt: readiness 200, DB/Auth connected, public 14 sách/10 review, API nháp không đăng nhập trả 401. Chưa thử đóng hoàn toàn Codex để xác minh tuổi thọ tiến trình web. Không commit/push/deploy trong lượt này.
