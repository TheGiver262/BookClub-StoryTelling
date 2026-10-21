# Cổng bạn đọc, quản lý nội dung và cộng tác viên

## Liên kết trạng thái và UX tiếp theo

[Session handoff 21/10](../SESSION-HANDOFF.md) và [trạng thái hiện hành](../CURRENT-STATE.md) tổng hợp quyết định toàn dự án. Workspace hiện có thay đổi UI mềm và ảnh QA sau bộ concept; bằng chứng publishing/CTV bên dưới thuộc đợt kiểm thử được ghi, chưa phải xác nhận mọi diff UI mới.

Tài khoản bạn đọc, “Sách của tôi”, đổi sách và thay IP mới là [đề xuất nghiên cứu](public-reservation-ux-research-2026-10-21.md). Không mở signup provider, gắn đơn theo SĐT hoặc nới quyền MEMBER/CTV khi chưa có quyết định. ADMIN publishing và vòng đời một tháng vẫn giữ nguyên.

Ngày chốt: 21/10/2026. Phạm vi triển khai và kiểm chứng: local, cổng 4321. Chưa deploy cloud.

## Giao diện công khai

- Cuốn sách ở `/`: bìa phụ cùng thiết kế nhưng nhạt màu rõ rệt trên giấy; bỏ dòng địa danh/ngày thành lập ở cả hai bìa. Ngày thành lập trong chương giới thiệu vẫn giữ. Hai logo cuối bìa được tách khoảng cách, dùng lại tài nguyên gốc.
- Sau sách có hướng dẫn mượn và các liên kết đến tủ sách, đặt trước, tra đơn, lịch trực/sự kiện, review và tuyển thành viên. Các liên kết tái sử dụng cùng tab `ysbk-public`.
- `/sach/` là cổng bạn đọc tổng hợp đủ sáu tab. `/cong-dong` chuyển đến đây và giữ query/hash. Không tự đẩy người đang xem tủ sách sang nội bộ dù có session.
- Danh mục 50 đầu sách/trang, tìm/lọc và xem cả đầu sách hết bản. Modal sách lấy mô tả từ database; khi thiếu mô tả sẽ thông báo CLB đang bổ sung, không tự bịa nội dung.
- Ẩn lời giải thích IP/hạn mức khỏi giao diện công khai. Các kiểm tra IP/SĐT/CAPTCHA ở server vẫn giữ nguyên; lỗi hạn mức hiển thị thông báo hỗ trợ đơn giản.

## Quản lý nội dung

Vào **Không gian nội bộ → Quản Trị & Nội Dung** bằng tài khoản quản lý (`ADMIN`). Thành viên và cộng tác viên không được gọi các API ghi nội dung, kể cả tự dựng request.

1. **Sách & ảnh bìa:** thêm/sửa tên, tác giả, thể loại, nhà xuất bản, mô tả; tải ảnh trực tiếp từ máy; nhập giá bìa và mã riêng cho từng bản thêm vào kho. Để trống mã bản khi chỉ sửa thông tin. Toàn bộ sách/ấn bản/bản sách/ảnh/audit được lưu trong một transaction; lỗi mã trùng rollback toàn bộ. Không thay trạng thái các bản đang giữ hoặc mượn.
2. **Lịch trực / nghỉ:** chọn ca hiện có hoặc thêm ca thứ Ba/thứ Năm, chọn giờ/địa điểm và lưu nháp/mở nhận đặt/nghỉ. Khi có đơn giữ chỗ, đổi ngày/giờ/địa điểm hoặc hủy bị chặn, yêu cầu quản lý liên hệ và xử lý đơn trước. Ngày nghỉ được lưu vào lịch nghỉ hiện có, dừng ca liên quan và dùng quy tắc tính lại hạn trả hiện có. Không công bố lại ca vào ngày nghỉ qua API phân công cũ.
3. **Sự kiện:** tạo/sửa thông tin và bật/tắt hiển thị công khai, tái sử dụng module sự kiện hiện có. Chi phí/nhiệm vụ/người tham gia nội bộ tiếp tục nằm trong module nghiệp vụ.
4. **Tuyển thành viên:** cập nhật tên đợt, nội dung hướng dẫn, ảnh và liên kết đăng ký HTTPS. Nháp không công khai; đang nhận đơn có nút đăng ký; đóng đơn giữ thông báo và kết quả đã duyệt. Phần tiếp nhận Google Form/chấm/phê duyệt hiện có được giữ.

Ảnh PNG/JPEG/WebP được thu nhỏ trong trình duyệt trước khi gửi, tối đa 180 KiB sau nén. Server kiểm tra giới hạn và chữ ký định dạng; không nhận SVG/HTML. Local/beta lưu ảnh nén trong `public_media`, đọc qua URL bất biến với MIME và `nosniff`. Khi media đạt 100 MB, cần chuyển sang object storage trước khi nhập tiếp thư viện ảnh lớn; vài nghìn ảnh chưa được thử dung lượng/tải thực tế. Không yêu cầu thêm dịch vụ cloud để thử local.

## Vòng đời nhân sự đã chốt

- Ứng viên trúng tuyển sau thao tác tiếp nhận là **cộng tác viên**, bắt đầu thử thách **1 tháng lịch** theo ngày Việt Nam. Ví dụ 21/10 → 21/11; PostgreSQL xử lý ngày cuối tháng. CTV không trở thành thành viên tự động khi hết thời gian.
- CTV có quyền nghiệp vụ như thành viên (`MEMBER`) và cờ nhân sự `isCollaborator` riêng. Các điều kiện năng lực trực chính hiện có vẫn áp dụng. CTV không có quyền quản lý nội dung.
- Sau đủ tháng, quản lý ghi nhận xét, xác nhận đánh giá đạt rồi công nhận thành viên chính thức. Server kiểm tra mốc thời gian và đánh giá; không chỉ khóa nút ở UI.
- Chỉ quản lý được **xóa tài khoản CTV**, phải nhập lại username. Đây là xóa mềm: chặn đăng nhập, tăng `token_version`, giữ hồ sơ và khóa ngoại lịch sử. Không xóa chứng từ hoặc dữ liệu mượn/trả. Không mở lại tài khoản đã xóa bằng API đổi trạng thái chung.
- Thành viên chính thức rời CLB được chuyển thành **cựu thành viên**; không dùng chức năng xóa CTV. Các quyền hạn chế của cựu thành viên giữ nguyên. Khóa tài khoản vì bảo mật vẫn là thao tác riêng.
- Mọi thay đổi vòng đời khóa bản ghi nhân sự, ghi audit và thu hồi phiên cũ. Không tự thao tác trên tài khoản quản lý đang đăng nhập.
- Việc cấp username/mật khẩu qua Auth provider vẫn theo quy trình cấp tài khoản hiện có; tiếp nhận ứng viên không tự phát sinh mật khẩu hay gửi thông tin ra ngoài.

## Dữ liệu và kiểm thử

API bổ sung: `GET /api/v1/public/media/{id}`, `GET /api/v1/public/recruitment-notice`, `GET /api/v1/admin/publishing`, `POST /api/v1/admin/publishing/{books|schedules|recruitment}`, `POST /api/v1/members/{id}/membership`. Ba hành động vòng đời là `PROMOTE`, `DELETE_COLLABORATOR`, `RETIRE`; server kiểm tra quyền quản lý cho cả ba.

Migration cộng thêm: `19_public_publishing.sql`, `20_collaborator_lifecycle.sql`. Đã sao lưu trước khi áp dụng vào `ysbk_local`; không reset database. Bộ test tích hợp chỉ dùng `ysbk_test_local`.

Kiểm thử bắt buộc:

- Ảnh sai MIME/chữ ký/quá lớn, thành viên/cựu/CTV/khách truy cập API quản lý.
- Nhập sách có mô tả/ảnh/bản vật lý; lỗi rollback; sửa nội dung giữ tồn hiện có; phân trang/lọc và modal đọc đúng dữ liệu.
- Lịch mới/sửa/nghỉ; không đổi lịch có đơn; không công bố vào ngày nghỉ; đặt/giao/trả và hạn mức cũ không hồi quy.
- Tuyển nháp/mở/đóng, liên kết hợp lệ, tiếp nhận ứng viên thành CTV một tháng, retry không tạo trùng.
- Chặn công nhận sớm/không đạt; cho công nhận đủ tháng/đạt; thu hồi phiên; CTV xóa đúng username; chặn xóa thành viên chính thức; chuyển cựu; chặn mở lại CTV đã xóa.
- Browser: nhập sách và upload ảnh thật qua form, đối chiếu ảnh/tóm tắt bên công khai, đủ tab, redirect liên kết cũ, hiển thị ngày thử thách và nút bị khóa khi chưa đủ tháng. Dữ liệu QA được dọn; audit được giữ.

Log/bằng chứng được giữ tại `.local/ysbk/`: `publishing-all-unit.log`, `publishing-check.log`, `publishing-regression-pg.log`, `collaborator-pg.log`, `publishing-start.log`, `verification/landing/`. Kết quả từng lần chạy nằm trong log; không coi build là chứng minh nghiệp vụ cloud hoặc tải đồng thời.

Kết quả local cuối đợt: 353/353 unit; Astro/TypeScript 0 lỗi, 0 warning, 0 hint; 7/7 test PostgreSQL chức năng mới/vòng đời CTV; 12 test hồi quy đặt sách đã đạt trong lần chạy riêng trước đó (chung log 16/16 với 4 test nội dung trước khi mở rộng CTV). Build 6 trang, HTTP 34 đường dẫn đúng MIME, danh mục 50/trang và tệp tài khoản local bị chặn 404. Đã thử upload ảnh, lưu sách và đọc mô tả bằng browser; dữ liệu QA được dọn, tài khoản admin kiểm thử đã đăng xuất.
