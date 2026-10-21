# Tham khảo UX đặt, quản lý và hủy giữ chỗ

Ngày đối chiếu: 21/10/2026. Phạm vi: nghiên cứu tài liệu công khai của nhà cung cấp/thư viện; chưa thử giao dịch trên các dịch vụ, chưa sửa code hoặc thay thế thiết kế đã chốt.

## 1. Câu hỏi cần giải quyết

YSBK cho khách đặt một quyển/đơn, nhận vào buổi trực và quản lý từng đơn bằng liên kết bí mật. Chưa dùng OTP, chưa gửi email/SMS. Hạn mức đã chốt: ba đơn tạo thành công/IP/24 giờ; ba suất giữ hoặc mượn chưa trả/SĐT; hủy không hoàn lượt IP.

Cần phân biệt ba việc: được đặt nhanh; có nơi tìm lại các đơn; chứng minh quyền xem/hủy đúng đơn. Không có tài khoản vẫn có thể giải quyết hai việc đầu trong một trình duyệt, nhưng không tự có cách khôi phục quyền trên thiết bị khác.

## 2. Ví dụ có nguồn chính thức

### A. Koha: tài khoản bạn đọc và danh sách giữ chỗ tập trung

Trong OPAC của Koha, đặt giữ chỗ thông thường yêu cầu đăng nhập và thư viện bật chức năng tương ứng. Sau xác nhận, bạn đọc được đưa về tài khoản, nhìn thấy các sách đang giữ. Tab Holds cho hủy; hủy sách đã sẵn sàng nhận phụ thuộc chính sách. Một số cấu hình cho đổi thư viện nhận hoặc tạm dừng giữ chỗ. Đây là đặt sách thư viện, không phải luồng khách đặt phòng.

Koha còn hỗ trợ tự đăng ký nếu thư viện cho phép. Tài liệu khuyên nhóm tự đăng ký có quyền lưu thông tối thiểu, ví dụ đặt một vài sách nhưng chưa được nhận mượn, trước khi xác minh tại thư viện. Không đồng nhất tài khoản công khai với quyền nhân viên.

Nguồn: [Koha — Placing holds](https://koha-community.org/manual/latest/en/html/opac.html#placing-holds), [OPAC self-registration](https://koha-community.org/manual/latest/en/html/opac.html#opac-self-registration), [Your account](https://koha-community.org/manual/latest/en/html/opac.html#your-account).

Bài học áp dụng: danh tính dùng lặp lại phù hợp với một nơi tổng hợp sách đang giữ, đang mượn và lịch sử; đăng ký trực tuyến chưa đồng nghĩa đã xác minh danh tính thực.

### B. LibCal tại University of Illinois: liên kết hủy trong email

Trang đặt phòng học Main Library hướng dẫn chọn giờ bắt đầu/kết thúc và hủy bằng liên kết trong email xác nhận nếu không đến được. Đây là ví dụ thư viện vận hành đặt chỗ có thời điểm đến và tài nguyên hữu hạn. Trang này chứng minh cơ chế quay lại qua email; không đủ để kết luận toàn bộ hệ thống không yêu cầu xác thực trường.

Nguồn: [University of Illinois — Main Library room booking](https://libcal.library.illinois.edu/reserve/theorangeroom).

Bài học áp dụng: liên kết quản lý riêng là cách có thật; hộp thư giúp người dùng tìm lại nó. YSBK hiện chưa có kênh gửi nên thiếu phần đó.

### C. Acuity: đặt không cần tài khoản, quản lý bằng trang xác nhận, tài khoản tùy chọn

Khách chọn lịch, nhập thông tin, nhận trang xác nhận và email. Nút Change/Cancel appointment trong email đưa khách trở lại trang xác nhận để sửa lịch hoặc hủy. Sửa lịch cập nhật lần đặt hiện tại; khách chỉ đổi ngày/giờ, không tự đổi loại cuộc hẹn hoặc lịch cung cấp dịch vụ.

Tài khoản khách là tùy chọn: Acuity không bắt khách đăng ký hoặc đăng nhập để đặt. Người đăng ký xem các cuộc hẹn thuộc tài khoản và có thể được điền sẵn thông tin. Tài liệu phân biệt tài khoản khách với hồ sơ khách do đơn vị quản lý; có hồ sơ không có nghĩa người đó có thông tin đăng nhập.

Nguồn: [Acuity — How clients book appointments](https://help.acuityscheduling.com/hc/en-us/articles/16676869573645-How-clients-book-appointments), [Confirmation page](https://help.acuityscheduling.com/hc/en-us/articles/16676898629133-Customize-the-confirmation-page), [Using client accounts](https://help.acuityscheduling.com/hc/en-us/articles/16676924729997-Using-client-accounts-with-your-business).

Bài học áp dụng: đặt nhanh và có tài khoản không loại trừ nhau; tài khoản phục vụ quản lý lâu dài. Đổi lịch cuộc hẹn không phải bằng chứng rằng các dịch vụ đều cho đổi tài nguyên/cuốn sách trong cùng đơn.

## 3. Vì sao luồng hiện tại có thể gây khó dùng

Đây là nhận định thiết kế dựa trên phạm vi YSBK, chưa phải kết quả thử nghiệm người dùng:

1. Người đọc nghĩ theo “sách của tôi”, trong khi giao diện bắt nhớ nhiều mã cho nhiều đơn.
2. Liên kết bí mật có quyền quản lý nhưng chỉ xuất hiện sau khi đặt; không có tài khoản hoặc kênh gửi để tìm lại.
3. Chỉ đổi ý chọn sách cũng phải hủy rồi đặt lại. Hủy mở suất SĐT nhưng không mở lượt IP, nên vẫn có thể bị từ chối.
4. Tên “token” phản ánh kỹ thuật, không diễn đạt mục đích cho bạn đọc.
5. IP không đại diện duy nhất cho một người: nhiều người sau NAT có thể cùng IP. Hạn mức ba đơn cho cả IP có khả năng chặn các sinh viên khác cùng mạng.

Cloudflare có tài liệu riêng về nhận diện khách sau NAT và khả năng chặn nhầm khi nhiều khách dùng chung bộ đếm. Đây là căn cứ cho rủi ro, không phải bằng chứng Wi-Fi trường hiện tại có chung một IP, và không phải đề xuất tự động mua gói Cloudflare khác.

Nguồn: [Cloudflare — Notes about rate limiting characteristics](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/#notes-about-rate-limiting-characteristics).

## 4. Hướng phù hợp cho YSBK — đề xuất, chưa được duyệt triển khai

### 4.1. Đổi từ “tra từng mã” sang “Sách của tôi”

- Mục công khai “Sách của tôi” liệt kê các đơn mà phiên khách/tài khoản hiện tại có quyền truy cập, với bìa sách, buổi nhận, trạng thái, hạn nhận và thao tác hợp lệ.
- Không tìm tất cả đơn bằng SĐT, không nhận đơn cũ chỉ vì tài khoản mới khai cùng SĐT.
- Hồ sơ bạn đọc trong hệ thống nội bộ không tự trở thành tài khoản đăng nhập.
- Mỗi đơn vẫn đúng một quyển; danh sách tổng hợp không đổi mô hình đơn hoặc hạn mức.

### 4.2. Hai cách giải quyết đường quay lại

**Không đổi quyết định chưa email/OTP:** đặt khách, phiên khách có giới hạn trên trình duyệt hiện tại, tùy chọn lưu liên kết riêng và xóa quyền nhớ trên thiết bị dùng chung. Không hứa hẹn khôi phục hoặc đồng bộ thiết bị. Mất phiên/liên kết thì hỗ trợ thủ công. Cookie/phiên chỉ cấp quyền đã được cấp khi đặt, không cấp quyền từ số điện thoại tự khai.

**Cho quản lý lâu dài thuận tiện hơn:** tài khoản bạn đọc tùy chọn, đăng ký/đăng nhập để có danh sách qua nhiều thiết bị, lưu phiên phù hợp. Khách vẫn được đặt. Cần chốt kênh khôi phục tài khoản trước khi triển khai; nếu chưa email/OTP thì quản lý hỗ trợ có quy trình, không coi SĐT tự khai là bằng chứng. Chỉ liên kết đơn khách khi có liên kết bí mật hợp lệ hoặc xác minh được duyệt.

Có thể học Acuity ở mô hình tài khoản tùy chọn. Không sao chép phần email của họ trong khi vẫn khẳng định YSBK không gửi email. Nếu chấp nhận email xác nhận giao dịch sau này, liên kết quản lý trong email là lựa chọn khác, không nhất thiết phải có tài khoản.

### 4.3. Chọn nhầm sách

Nút “Đổi sách” trên đơn Chờ nhận là một đề xuất dành riêng cho YSBK, không phải chuẩn được mọi nguồn bên trên xác nhận. Nếu chọn hướng này: giữ được bản mới và nhả bản cũ trong một giao dịch; thất bại giữ nguyên sách cũ; không reset hạn nhận hoặc tạo lượt IP mới; lưu lịch sử và chống đổi liên tục. Đơn đã nhận phải theo quy trình trả.

Nếu tiếp tục hủy rồi đặt lại, phải chấp nhận việc người đã hết lượt IP không đặt cuốn thay thế được ngay. Tài khoản không tự giải quyết mâu thuẫn hạn mức này.

### 4.4. Tách hạn mức nghiệp vụ và chống lạm dụng

Đề xuất xem lại việc dùng ba đơn/IP/24 giờ làm hạn mức nghiệp vụ chính, vì tệp sinh viên có thể dùng chung mạng. Hạn mức bạn đọc và giới hạn tốc độ chống spam có mục đích khác nhau. Chưa đủ dữ liệu để chọn ngưỡng IP mới; beta nên đo số IP dùng bởi nhiều bạn đọc, số lần bị từ chối và số lần hủy/đổi.

Chưa xác minh SĐT thì ba suất/SĐT vẫn là hạn mức theo số tự khai, không thể bảo đảm ba suất/một người thật. Tài khoản chưa xác minh cũng không khắc phục điều đó.

**Quy tắc ba đơn/IP/24 giờ hiện vẫn giữ nguyên cho đến khi có quyết định mới.** Báo cáo này không sửa tài liệu quy tắc đã duyệt hoặc code.

## 5. Quyết định cần chốt trước khi lập kế hoạch mới

1. Giữ đặt khách với khả năng tìm lại giới hạn theo thiết bị hay bổ sung tài khoản bạn đọc tùy chọn ngay từ beta?
2. Có cho gửi email xác nhận giao dịch/khôi phục hay vẫn hỗ trợ thủ công? Không mặc định đổi quyết định chưa email/SMS/OTP.
3. Có cho đổi sách trong đơn Chờ nhận hay tiếp tục hủy rồi tạo mới?
4. Giữ hạn mức IP hiện tại hay đổi thành cơ chế chống lạm dụng khác sau đo lường?

## 6. Giới hạn của kết quả nghiên cứu

- Đã đọc tài liệu chính thức; chưa tạo tài khoản, đặt hoặc hủy thật trên các dịch vụ.
- Không tìm thấy trong các nguồn đã đọc mô hình trùng toàn bộ điều kiện YSBK: sách vật lý, nhận thứ Ba/Năm, không tài khoản/email/OTP và ba đơn/IP/24 giờ bất kể hủy.
- Không suy ra các hệ thống không có tính năng chỉ vì tài liệu không đề cập.
- Các bước UX và hướng kỹ thuật của YSBK ở phần 3–5 là đề xuất, không phải chức năng đã triển khai.
