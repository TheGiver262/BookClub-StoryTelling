# Ma trận quyền và đăng nhập v0.11

Ngày 18/10/2026. Nguồn: quyết định D16, D38, D50–D55 trong [sổ phỏng vấn](06-phong-van-va-quyet-dinh.md). Đây là đặc tả dự thảo, chưa có ứng dụng hoặc bài thử Auth đã chạy.

## 1. Danh tính và trạng thái

Ba loại người dùng: khách, thành viên CLB và admin. Khách có thể chưa đăng nhập hoặc có tài khoản. Cựu là trạng thái của thành viên; khóa tài khoản là trạng thái bảo mật riêng. Ban/chức vụ, người phụ trách trực hoặc người chấm phỏng vấn không tự tạo quyền phần mềm.

| Đối tượng | Đăng nhập | Quyền tổng quát |
|---|---|---|
| Khách chưa có phiên | Không cần | Xem nội dung công khai đã duyệt |
| Khách có tài khoản | Google hoặc email/mật khẩu | Như khách; gửi đánh giá/nhận xét/cảm nhận vào hàng chờ duyệt |
| Thành viên đang hoạt động | Tên đăng nhập riêng + mật khẩu, admin cấp | Quản lý toàn bộ nghiệp vụ, không phân quyền theo ban |
| Cựu thành viên | Vẫn tên đăng nhập riêng + mật khẩu được cấp | Chỉ xem hoạt động CLB; không dữ liệu nhạy cảm/tiền/xuất file hoặc ghi nghiệp vụ |
| Admin | Luồng nội bộ được cấp, bảo vệ MFA theo kế hoạch bảo mật | Quản lý nghiệp vụ, tài khoản và nhật ký toàn hệ thống |
| Tài khoản bị khóa | Không được dùng quyền tài khoản dù còn phiên cũ | Không đọc/ghi qua phiên bị khóa; truy cập công khai ẩn danh vẫn theo quy tắc công khai |

Không dùng email, tên hiển thị hoặc provider do trình duyệt gửi để tự cấp quyền. Email liên hệ có thể giống nhau giữa hồ sơ thành viên và khách, nhưng không tự hợp nhất credential. “Tên đăng nhập riêng” không kéo theo việc tự viết cơ chế lưu mật khẩu.

## 2. Ma trận hành động

“Quản lý” gồm xem/thêm/sửa/ngừng sử dụng theo quy tắc chứng từ; không được xóa phá lịch sử. “Hoạt động giới hạn” là tập trường ở mục 3, không phải quyền đọc bảng nghiệp vụ gốc. Quyền của khách đăng ký chỉ phát sinh sau phiên hợp lệ.

| Chức năng/dữ liệu | Khách ẩn danh | Khách đăng ký | Thành viên hoạt động | Cựu | Admin |
|---|---|---|---|---|---|
| Sách, review đã duyệt, trạng thái khả dụng công khai | Xem | Xem | Xem/quản lý | Xem công khai | Xem/quản lý |
| Gửi đánh giá/nhận xét/cảm nhận | Không | Gửi chờ duyệt | Quản lý nội dung | Không ghi qua tài khoản cựu | Quản lý nội dung |
| Duyệt nội dung, sửa metadata/tồn sách | Không | Không | Quản lý | Không | Quản lý |
| Phiếu mượn, người mượn, cọc/phạt, nhắc trả | Không | Không | Quản lý | Không | Quản lý |
| Hồ sơ thành viên, số điện thoại, lịch bận cá nhân | Không | Không | Quản lý | Không | Quản lý |
| Lịch trực, phân công và điểm danh nghiệp vụ | Không, trừ phần được công bố | Không, trừ phần được công bố | Quản lý | Chỉ thông tin hoạt động được phép | Quản lý |
| Đơn tuyển, phỏng vấn, bài viết/điểm/nhận xét nội bộ | Không | Không | Quản lý | Không | Quản lý |
| Kết quả tuyển đã duyệt công khai | Xem trường được duyệt | Xem trường được duyệt | Quản lý/công bố | Xem công khai | Quản lý/công bố |
| Kế hoạch/nội dung hoạt động và sự kiện | Xem phần công khai | Xem phần công khai | Quản lý | Hoạt động giới hạn | Quản lý |
| Quỹ, hội phí, dự toán/chi phí, bán lô, nợ/cọc nhà sách, ngân hàng | Không | Không | Quản lý | Không | Quản lý |
| Dashboard/báo cáo nghiệp vụ và thống kê nhạy cảm | Không | Không | Xem/tạo | Không; chỉ màn hình hoạt động giới hạn | Xem/tạo |
| Xuất Excel/PDF hoặc tải file xuất nội bộ | Không | Không | Có, theo dữ liệu được phép | Không | Có |
| Import sách/lịch/đơn hoặc tác vụ ghi nền | Không | Không | Có theo nghiệp vụ | Không | Có |
| Tài khoản, cấp/reset/khóa, vai trò admin | Không | Không | Không | Không | Quản lý |
| Nhật ký toàn hệ thống | Không | Không | Không | Không | Xem/tra cứu; không xóa dấu vết |

Đăng xuất, đổi mật khẩu và các bước bảo vệ chính tài khoản được xử lý qua Auth, không bị hiểu thành quyền sửa hồ sơ CLB. Chưa chốt khách tự sửa/xóa bài hoặc yêu cầu xóa tài khoản; không suy thành quyền đọc/xóa nội dung của người khác. Cựu muốn dùng tính năng cộng đồng có thể có danh tính khách độc lập; không dùng cách đó để mở quyền ghi nội bộ.

## 3. Phạm vi hoạt động dành cho cựu

Đã chốt: chỉ xem hoạt động CLB, không thông tin cá nhân nhạy cảm, mọi vấn đề tiền/số tài khoản, không Excel/PDF. Để triển khai được, đề xuất bản đầu chỉ trả các trường an toàn sau; mẫu màn hình cần chủ sản phẩm đối chiếu trước M2:

- Tên, mô tả đã duyệt, thời gian, địa điểm hoạt động/sự kiện; trạng thái và kết quả mô tả không chứa thông tin nhạy cảm.
- Lịch buổi trực đã công bố, mô tả nhiệm vụ chung; chưa mở danh sách hồ sơ thành viên, lịch bận, nhận xét điểm danh hoặc số điện thoại liên hệ.
- Tin nội bộ dành cho cựu đã được duyệt và ảnh/file đã xác nhận không chứa thông tin cá nhân nhạy cảm hoặc tài chính. Không tự kế thừa mọi file từ sự kiện gốc.

Chưa chốt có hiển thị tên người phụ trách trên màn hình cựu hay không; tạm dùng vai trò/đầu mối chung. Không tự suy “hoạt động” bao gồm toàn bộ phân công cá nhân hoặc thông tin tuyển chưa công bố. Không thêm module mạng xã hội cho cựu.

Các trường bị loại gồm số tiền, biểu đồ thu chi, chiết khấu/giá nhập lô, công nợ, số tài khoản/QR thanh toán, chứng từ, địa chỉ/điện thoại/email cá nhân, hồ sơ ứng viên/người mượn, lịch bận và ghi chú nhạy cảm. Nhắc tới địa chỉ là giới hạn quyền, không phải yêu cầu thu thêm địa chỉ.

API phải dựng tập dữ liệu hoạt động riêng bằng danh sách trường cho phép; không trả bản ghi đầy đủ rồi ẩn cột ở trình duyệt. Nội dung tự do/ảnh/file vẫn có thể chứa số tài khoản hoặc điện thoại dù schema không có cột đó, nên phải duyệt nội dung dành cho cựu trước khi đưa vào tập này. Mặc định chưa phân loại thì không hiển thị.

## 4. Chuyển trạng thái, file và phiên

1. Admin chuyển thành viên sang cựu; lưu người/thời điểm/lý do và lịch sử tư cách. Không xóa tài khoản hay người thực hiện trên chứng từ cũ.
2. Mọi request mới kiểm quyền hiện tại từ máy chủ, không chỉ tin role trong token cũ. Xóa/invalidate cache quyền liên quan; chặn tác vụ ghi, đọc nhạy cảm và xuất/download dù phiên đã mở trước đó.
3. Nếu người đó còn quyền admin, phải thu hồi đặc quyền khi chuyển cựu để không vô hiệu hóa chế độ chỉ xem. Trạng thái cựu không được bị một role cũ mở lại toàn bộ quyền. Chủ sở hữu hạ tầng là trách nhiệm riêng, không tự thay đổi theo thao tác này.
4. File xuất nhạy cảm không là URL public. Download kiểm quyền hiện tại; kiểm cả liên kết đã cấp, tác vụ export đang chờ và bản cache. Tác vụ nền kiểm lại quyền trước thực hiện/phát hành kết quả. Với giao dịch đang chạy, kiểm trạng thái/quyền trong ranh giới transaction để xử lý tranh chấp thu hồi quyền nhất quán.
5. Khóa tài khoản thu hồi quyền riêng. Cựu còn được đăng nhập và đọc phần hoạt động; không bị khóa chỉ vì tốt nghiệp.

Không thể thu hồi dữ liệu người dùng đã nhìn thấy/tải hợp lệ trước khi bị thu quyền. Vì thành viên đang hoạt động có quyền rộng theo lựa chọn sản phẩm, MFA, tài khoản riêng, audit và xử lý khi lộ dữ liệu vẫn cần thiết.

## 5. Cổng chọn Auth ở M2

Yêu cầu username đã chốt; giải pháp kỹ thuật chưa chốt. Supabase password gắn email/phone và tự liên kết OAuth cùng email; [tài liệu password](https://supabase.com/docs/guides/auth/passwords) và [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) cho biết hành vi nền tảng, không chứng minh thiết kế nội bộ an toàn.

Thử trước một lớp ánh xạ username phía máy chủ sang identity managed được cấp riêng, tách định danh kỹ thuật khỏi email liên hệ thật. Dùng API admin phía máy chủ để provision, quản lý uniqueness/chuẩn hóa username; nhà cung cấp lưu/kiểm mật khẩu. Không cho public signup, đổi email, reset hoặc liên kết OAuth chiếm identity này. Cách thực hiện và cơ chế bảo vệ mọi endpoint của nhà cung cấp phải được kiểm chứng; không dựa vào việc giấu alias.

| Bài thử | Bằng chứng cần thu |
|---|---|
| Admin cấp username, trùng chữ hoa/thường, cấp lại/reset và đổi mật khẩu | Quy tắc chuẩn hóa, unique, lỗi rõ, chỉ người có quyền thực hiện; không log secret |
| Google/email khách giống email liên hệ thành viên | Hai danh tính vẫn độc lập, khách không vào API nội bộ |
| Khách thêm/reset password hoặc gọi trực tiếp endpoint liên kết/đổi email | Không nhận hoặc thay credential nội bộ; kiểm cả API nhà cung cấp ngoài Cloudflare |
| Thành viên đổi cựu/khóa khi phiên cũ còn mở | Kết quả đúng ma trận qua request trực tiếp, cache, file và tác vụ nền |
| Cookie/OAuth/CSRF/rate limit/MFA/recovery | Kiểm trên runtime dự kiến; người dùng thật có thể thao tác và khôi phục theo quy trình |

Nếu bài thử không đạt, thay lựa chọn Auth để giữ yêu cầu username và cách ly danh tính, không tự triển khai thuật toán mật khẩu hoặc nới quyền. Chỉ sau bằng chứng này mới khóa ADR nhà cung cấp. Các ca T14, T18, T26, T61–T63, T67, T70 trong [bộ nghiệm thu](05-roadmap-va-nghiem-thu.md) là điểm kiểm liên quan.
