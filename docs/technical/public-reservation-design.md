# Thiết kế cổng công khai và đặt sách không cần đăng nhập

**Chính sách mới sau chat tiếp nối 21/10:** đơn mới bắt buộc tài khoản bạn đọc Google, một phiên trình duyệt hiện hành; xem [thiết kế tài khoản](reader-accounts-design-2026-10-21.md) và [vận hành](reader-accounts-local-and-access.md). Tiêu đề/đoạn không đăng nhập phía dưới là thiết kế lịch sử đã bị thay thế ở điểm xác thực. Một quyển/đơn, CAPTCHA, quota IP/SĐT, cọc và các transaction giữ nguyên. Token đơn cũ vẫn hợp lệ; đơn mới yêu cầu đúng chủ tài khoản.

## Cập nhật trạng thái 21/10/2026

Quy tắc tại mục 1 vẫn là quyết định hiện hành. Bản đặt giữ chỗ đã có implementation và bằng chứng local ở [bàn giao](public-reservation-handoff.md), [landing](book-landing-local.md) và [publishing](public-portal-publishing.md); nhãn chưa triển khai trong bản thiết kế ban đầu không còn mô tả trạng thái source.

Đang thảo luận lại [UX đặt/hủy](public-reservation-ux-research-2026-10-21.md). “Sách của tôi”, tài khoản tùy chọn, đổi sách, khôi phục bằng email và sửa hạn mức IP **chưa chốt**, không ghi thành API/schema hoặc hành vi bắt buộc. Hủy vẫn không hoàn lượt IP; không tự nới guard. [Session handoff](../SESSION-HANDOFF.md).

Ngày chốt nghiệp vụ: 20/10/2026. Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`.

Trạng thái: đã chốt các quy tắc tại mục 1 và đã có implementation local. Tài liệu này mô tả thiết kế; hợp đồng API/schema và bằng chứng thực thi đọc cùng bàn giao triển khai. Các đề xuất UX mới chưa được duyệt không thay thiết kế này.

## 1. Phạm vi và các quyết định đã chốt

| Nội dung | Quyết định |
|---|---|
| Cổng công khai | Khách xem giới thiệu CLB, hoạt động đã công bố, lịch trực và danh mục sách; đặt sách không cần đăng nhập. |
| Cổng nội bộ | Chỉ tài khoản thành viên do CLB cấp được truy cập chức năng nội bộ, theo quyền hiện có. |
| Phiên thành viên | Phiên hợp lệ cho phép vào thẳng khu nội bộ khi quay lại website, không bắt đi qua landing. |
| Xác nhận đặt | Điền đủ thông tin bắt buộc và vượt CAPTCHA. Có thể dùng Cloudflare Turnstile; chưa dùng OTP. |
| Một đơn đặt | Đúng 1 bản sách vật lý, gắn với 1 buổi trực nhận sách. |
| Giới hạn IP | Tối đa 3 đơn tạo thành công trong 24 giờ gần nhất, cộng tất cả SĐT dùng IP đó. |
| Giới hạn SĐT | Tối đa 3 suất đang sử dụng, cộng tất cả IP và buổi trực. |
| Một suất SĐT | Một sách đang được giữ chỗ hoặc đã giao nhưng chưa được ghi nhận trả. |
| Hạn giữ | Đến thời điểm kết thúc buổi trực đã chọn. Chưa nhận thì đơn hết hạn và sách được mở lại. |
| Nhận sách | Khách đến bàn trực, đọc họ tên và SĐT; thành viên kiểm tra và xác nhận giao sách. |
| Trả sách | Mỗi quyển được thành viên ghi nhận trả thành công mở lại 1 suất SĐT. |
| Hoàn lượt IP | Trả sách, hủy hoặc hết hạn đơn không hoàn lượt IP trong cửa sổ 24 giờ. |
| Điều kiện đặt lại | Đồng thời còn suất SĐT, còn lượt IP, có sách khả dụng, có buổi trực hợp lệ và CAPTCHA hợp lệ. |

Phạm vi ở lần lập thiết kế ban đầu ngày 20/10/2026 là chỉ ghi tài liệu. Không sửa ứng dụng, migration, hợp đồng OpenAPI, cấu hình nhà cung cấp, dữ liệu hoặc môi trường triển khai. Không thêm tài khoản bạn đọc, mật khẩu bạn đọc hoặc OTP. Các cơ chế guest login hiện có của chức năng khác không được tự động mở vào khu nội bộ hoặc thay đổi bởi thiết kế này.

## 2. Cách tính hạn mức

### 2.1. Hạn mức theo SĐT

Số suất đang dùng bằng số bản sách được giữ bởi đơn còn hiệu lực cộng số bản sách đã giao nhưng chưa trả. Một bản chỉ được tính một lần khi chuyển từ đơn đặt sang phiếu mượn.

Số suất còn lại bằng 3 trừ số suất đang dùng. Nếu dữ liệu có sẵn đã vượt 3 suất, số suất có thể đặt mới là 0; không hủy lịch sử hoặc thu hồi sách tự động.

| Tình trạng | Suất đang dùng | Được đặt thêm theo SĐT |
|---|---:|---:|
| Chưa có sách giữ/mượn | 0 | 3 |
| Giữ chỗ 3 quyển | 3 | 0 |
| Đã nhận cả 3 quyển | 3 | 0 |
| Trả 1 trong 3 quyển | 2 | 1 |
| Trả thêm 1 quyển | 1 | 2 |
| Trả hết | 0 | 3 |

Chuẩn hóa SĐT tại server bằng quy tắc hiện có. Cách viết đầu số `+84`, `84`, `0` và ký tự phân cách hợp lệ phải quy về cùng một số. Đổi thiết bị, xóa cookie, đổi IP hoặc viết lại họ tên không tạo hạn mức mới cho cùng SĐT.

Một SĐT có thể thuộc nhiều hồ sơ bạn đọc trong hệ thống hiện tại. Cộng hạn mức theo SĐT chuẩn hóa, không gộp hoặc xóa các hồ sơ chỉ vì trùng số.

### 2.2. Hạn mức theo IP

Tại thời điểm xét đơn mới, đếm các đơn tạo thành công trong khoảng lớn hơn thời điểm hiện tại trừ 24 giờ, đến thời điểm hiện tại. Đơn vừa đủ 24 giờ không còn nằm trong cửa sổ. Thời gian quyết định lấy từ server.

- Có 0, 1 hoặc 2 đơn trong cửa sổ: có thể tạo thêm nếu đủ các điều kiện khác.
- Có từ 3 đơn trở lên: từ chối tạo mới.
- Không đặt lại bộ đếm lúc 0 giờ hoặc khi hết buổi trực.
- Chỉ giao dịch tạo đơn đã thành công mới tính lượt. Lỗi CAPTCHA, lỗi nhập liệu, hết sách hoặc rollback không tính lượt.
- Gửi lại cùng một yêu cầu đã thành công chỉ trả về đơn cũ, không cộng lượt.
- Đơn đã hủy, hết hạn hoặc đã trả vẫn được tính nếu thời điểm tạo còn trong 24 giờ.

Ví dụ: IP tạo đơn lúc 09:00, 10:00 và 11:00 ngày 20/10/2026. Trả 1 quyển lúc 15:00 mở 1 suất SĐT nhưng không mở lượt IP. Lúc 09:00 ngày 21/10/2026, đơn đầu ra khỏi cửa sổ; IP có thể tạo thêm 1 đơn nếu các điều kiện khác cho phép.

Hai SĐT khác nhau dùng chung một IP vẫn chia sẻ 3 lượt IP. Cùng SĐT dùng IP khác vẫn chia sẻ 3 suất SĐT. Không tính riêng theo cặp IP và SĐT.

## 3. Luồng người dùng

### 3.1. Khách vào cổng công khai

Trang `/` hiển thị giới thiệu CLB, hoạt động được phép công khai, lịch trực, thẻ đặt sách và thẻ đăng nhập thành viên. Không hiển thị danh sách người đặt, SĐT, phiếu mượn, dữ liệu quỹ hoặc ghi chú nội bộ.

Khách tra sách và xem tình trạng khả dụng thực tế. Một bản đã có người giữ chỗ không còn khả dụng cho khách khác dù sách vẫn nằm trong kho. Khi còn nhiều bản của cùng đầu sách, server chọn và giữ một bản phù hợp với địa điểm nhận.

Chỉ cho chọn buổi trực đã công bố, chưa kết thúc và còn nhận đặt. Không hứa giao một bản sách tại địa điểm mà CLB chưa bảo đảm có sách. Lịch trình bày cho khách chỉ cần ngày, giờ và địa điểm; không cần danh sách hoặc thông tin liên hệ người trực.

### 3.2. Điền và xác nhận đơn

1. Chọn 1 quyển sách và buổi trực nhận sách.
2. Điền họ tên và SĐT. MSSV, trường và email theo chính sách bạn đọc hiện có; không mặc định bắt người ngoài trường có MSSV.
3. Xem lại sách, ngày giờ, địa điểm nhận, thời điểm hết hạn giữ và tiền cọc dự kiến.
4. Hoàn thành CAPTCHA rồi bấm "Xác nhận đặt sách".
5. Server kiểm tra dữ liệu, CAPTCHA, IP tin cậy, hai hạn mức, ca trực và bản sách. Kiểm tra lại các điều kiện thay đổi được ngay trong giao dịch tạo đơn.
6. Tạo đơn và giữ đúng một bản sách; ghi nhận thời điểm tạo, thời điểm hết hạn và khóa nhận diện IP.
7. Trả mã đặt chỗ, thông tin nhận sách và quyền xem đơn đó cho khách.

Không tạo phiếu mượn hoặc ghi thu cọc ở bước đặt chỗ. Thời hạn mượn chỉ bắt đầu khi giao sách tại bàn trực. Giao diện phải phân biệt "Đã giữ chỗ" với "Đã nhận sách".

Mẫu thông báo thành công:

> Đã giữ 1 quyển "[Tên sách]" đến hết buổi trực [ngày, giờ]. Nhận tại [địa điểm]. Đọc họ tên và SĐT cho thành viên trực. Mã đặt chỗ: [mã đơn]. Đây là xác nhận giữ chỗ, chưa phải phiếu mượn.

### 3.3. Xem lại đơn khi không có tài khoản

Server là nơi lưu lịch sử và tính hạn mức. Cookie hoặc bộ nhớ trình duyệt chỉ giúp khách mở lại đơn thuận tiện; xóa chúng không khôi phục lượt đặt.

Đề xuất cấp đường dẫn riêng có token bí mật khó đoán cho từng đơn. Mã đơn hiển thị tại quầy không tự nó cấp quyền truy cập dữ liệu. Token chỉ được xem hoặc hủy đúng đơn liên quan, không cho xem lịch sử theo SĐT hoặc thao tác nội bộ. Lưu dạng băm token ở server; không đưa token vào log hoặc dữ liệu công khai, không để trang tra cứu rò đường dẫn sang bên thứ ba.

Không cho nhập SĐT bất kỳ rồi xem toàn bộ đơn hoặc thông tin người đó. Thiếu token thì phản hồi công khai không tiết lộ hồ sơ, lịch sử hoặc số lượng sách chi tiết. Mất đường dẫn có thể nhờ bàn trực hỗ trợ sau khi đối chiếu; chưa có luồng khôi phục tự động bằng OTP.

Token xem đơn không bắt buộc cho lần đặt tiếp theo hoặc khi nhận sách tại quầy. Nhập lại SĐT là đủ để server kiểm tra hạn mức, nhưng không chứng minh quyền sở hữu số đó.

### 3.4. Thành viên giao sách

1. Thành viên đăng nhập, mở danh sách "Đơn đặt chờ nhận" của buổi trực.
2. Khách đọc họ tên và SĐT; thành viên tra đơn, đối chiếu thông tin và bản sách. Mã đặt chỗ hỗ trợ tìm kiếm nếu cần.
3. Chọn đúng hồ sơ bạn đọc hoặc tạo hồ sơ theo quy trình hiện có; không chọn tùy tiện một hồ sơ cùng SĐT.
4. Kiểm tra đơn còn hiệu lực, đúng ca và bản sách chưa được giao hoặc chuyển trạng thái khác.
5. Thực hiện quy trình lập phiếu, xác nhận cọc và giao sách hiện có. Chỉ ghi nhận đã nhận khi giao dịch bàn giao thành công.
6. Liên kết đơn với đúng dòng sách trên phiếu mượn, chuyển trạng thái sang đang mượn. Hạn mức SĐT giữ nguyên.

Chuyển quyền giữ sách sang phiếu mượn phải nguyên tử: không có khoảng trống cho người khác lấy bản sách hoặc đặt thêm bằng suất vừa được nhả tạm. Giao dịch thất bại giữ nguyên trạng thái trước đó, không sinh phiếu, thu cọc hoặc giao sách trùng khi thử lại.

### 3.5. Trả sách và đặt tiếp

1. Thành viên nhận lại sách vật lý và xác nhận đúng dòng sách được trả.
2. Giao dịch trả sách ghi nhận thành công thì dòng sách đó không còn chiếm suất SĐT; đơn liên quan chuyển sang đã trả.
3. Khách vào landing, chọn sách mới, nhập cùng SĐT và hoàn thành CAPTCHA.
4. Server tính lại hạn mức. Còn suất SĐT nhưng đủ 3 lượt IP/24 giờ thì vẫn từ chối, kèm thời điểm IP có thể thử lại.

Khách không tự bấm "đã trả" để mở suất. Trả từng quyển mở từng suất; thử lại cùng thao tác trả không mở thêm. Thông tin hoàn cọc và xử lý phạt tuân theo nghiệp vụ hiện có, không được dùng trạng thái hoàn tiền thay cho bằng chứng đã trả sách.

## 4. Trạng thái đơn và thời điểm giải phóng sách

Các tên mã dưới đây là đề xuất cho triển khai; giao diện dùng nhãn tiếng Việt.

| Mã đề xuất | Nhãn | Ý nghĩa | Chiếm suất SĐT |
|---|---|---|---|
| `HELD` | Chờ nhận | Đơn còn hạn, một bản sách được giữ cho khách. | Có |
| `BORROWED` | Đang mượn | Đã bàn giao; liên kết với dòng sách chưa trả. | Có, không cộng thêm lần thứ hai |
| `RETURNED` | Đã trả | Thành viên đã ghi nhận trả bản sách. | Không |
| `CANCELLED` | Đã hủy | Hủy trước khi nhận, do khách hoặc thành viên có quyền; lưu lý do. | Không |
| `EXPIRED` | Hết hạn nhận | Đến giờ kết thúc buổi trực mà chưa giao sách. | Không |

Chuyển trạng thái hợp lệ:

- Tạo đơn thành công vào `HELD`.
- `HELD` sang `BORROWED` khi giao sách thành công trước hạn.
- `HELD` sang `CANCELLED` khi hủy hợp lệ; khách dùng token riêng, thành viên dùng quyền nội bộ.
- `HELD` sang `EXPIRED` khi đến hạn mà chưa nhận.
- `BORROWED` sang `RETURNED` khi trả sách được ghi nhận.

Không hủy hoặc làm hết hạn đơn đã giao để nhả sách đang mượn. Đơn kết thúc không tự hồi sinh; muốn đặt lại phải tạo đơn mới và xét hai hạn mức. Tất cả trạng thái vẫn giữ lịch sử tạo đơn để tính IP nếu chưa đủ 24 giờ.

Quá hạn mượn, mất sách, bảo trì sách và xử lý cọc vẫn thuộc mô hình mượn/trả hoặc bản sách hiện có. Sách chưa trả không được tự mở suất vì chuyển sang quá hạn hoặc báo mất. Trường hợp mất cần kết thúc nghĩa vụ theo quy trình CLB trước khi giải phóng suất; tiêu chí kết thúc cụ thể cần xác định khi tích hợp nghiệp vụ mất sách, không suy ra từ việc thu tiền hoặc sửa nhãn đơn.

## 5. Hết hạn giữ và thay đổi lịch trực

Mỗi đơn lưu `expires_at` cụ thể, tương ứng giờ kết thúc buổi trực đã chọn. Hiển thị theo giờ Việt Nam, lưu thời điểm kỹ thuật nhất quán ở server. Không lấy giờ thu dọn hoặc thao tác đóng ca tiền mặt làm hạn giữ.

- Khi thời điểm hiện tại bằng hoặc sau `expires_at`, đơn chưa giao không được nhận tiếp hoặc tiếp tục giữ tồn.
- Có tác vụ hết hạn định kỳ và kiểm tra hết hạn ngay trong đường đọc tồn, tạo đơn và giao sách. Tác vụ chạy muộn không được làm tồn bị giữ quá hạn.
- Đơn hết hạn giải phóng bản sách và suất SĐT, không xóa lượt IP còn trong 24 giờ.
- Hủy buổi trực thì hủy các đơn chưa nhận, lưu lý do, mở lại tồn và suất SĐT. Đơn đã giao không thay đổi.
- Không âm thầm chuyển đơn sang buổi khác hoặc kéo dài hạn khi sửa lịch đã có đơn. Chi tiết ca khách đã xác nhận cần được lưu lại. Thay đổi ảnh hưởng việc nhận sách phải qua thao tác nội bộ rõ ràng; bản đầu có thể hủy đơn chờ nhận và hỗ trợ khách đặt lại.
- Chưa có cam kết tự động gửi SMS hoặc email nhắc lịch/thay đổi ca. Trạng thái và thông báo lý do trên đường dẫn đơn phải đúng; liên hệ chủ động do CLB xử lý theo quy trình vận hành.

## 6. Ranh giới bảo mật và CAPTCHA

### 6.1. Không dùng OTP trong phiên bản này

SĐT là khóa cộng hạn mức theo thông tin khai báo, chưa phải danh tính được xác minh. CAPTCHA hạn chế tự động hóa, không chứng minh khách sở hữu SĐT. Rủi ro khai số giả, dùng số của người khác hoặc chiếm suất SĐT vẫn tồn tại và được chấp nhận ở giai đoạn này.

Không dùng việc biết SĐT làm quyền xem lịch sử, sửa hồ sơ, xác nhận trả, cấp quyền thành viên hoặc khôi phục tài khoản. Không tự chuyển đơn của SĐT này sang SĐT khác để vượt hạn mức. Sửa thông tin liên hệ hoặc xử lý nhầm hồ sơ phải là thao tác có quyền, có dấu vết và kiểm tra lại tác động lên suất.

### 6.2. CAPTCHA và Cloudflare Turnstile

Cloudflare Turnstile là lựa chọn CAPTCHA đề xuất; quyết định đã chốt là phải có kiểm tra CAPTCHA, chưa bắt buộc một nhà cung cấp cụ thể. Nếu chọn Turnstile, xác minh token tại server bằng Siteverify trước khi tạo đơn, kiểm tra phạm vi website/action phù hợp với cấu hình. Không chỉ kiểm tra ô xác nhận ở frontend.

Token thiếu, sai, hết hạn hoặc dùng lại không tạo đơn mới. Lỗi kết nối nhà cung cấp không được tự bỏ qua CAPTCHA. Một yêu cầu thử lại đã tạo đơn thành công trước đó được trả kết quả cũ sau khi xác minh đúng yêu cầu, không xác nhận token lần nữa để tạo đơn trùng. Cần chống gửi dồn cả ở bước kiểm tra CAPTCHA để tránh lạm dụng dịch vụ.

Tham chiếu nhà cung cấp: [Cloudflare Turnstile - xác minh token phía server](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Khóa thật, hostname và cấu hình triển khai chưa nằm trong tài liệu này.

### 6.3. IP, dữ liệu cá nhân và quyền nội bộ

Lấy IP từ kết nối hoặc header do proxy đã xác thực cung cấp. Không tin IP trong body hay header do khách tùy ý gửi. Chuẩn hóa cùng một địa chỉ IPv4/IPv6 trước khi tạo khóa đếm; không mặc định gộp cả một dải IPv6 thành một IP.

Đề xuất lưu khóa IP bằng HMAC với bí mật phía server, kèm thời điểm tạo để phục vụ giới hạn. Không dùng bộ đếm chỉ tồn tại trong bộ nhớ một Worker; mọi instance phải nhìn cùng trạng thái hạn mức. Chính sách lưu dữ liệu và đổi khóa phải bảo toàn cửa sổ 24 giờ đang xét, không tự xóa lượt đang hiệu lực.

IP dùng chung ở trường hoặc ký túc xá chia sẻ 3 lượt; đổi mạng có thể đổi IP. Đây là giới hạn đã chốt, không phải bằng chứng một IP tương ứng một người. Không tự thêm ngoại lệ cho mạng dùng chung hoặc cho phép bỏ chặn trên giao diện.

Dữ liệu đơn chỉ trả cho người có token đơn hoặc thành viên có quyền. Nhật ký không ghi CAPTCHA token, token tra cứu hay bí mật dịch vụ. Các trang và phản hồi có thông tin cá nhân không được cache công khai.

## 7. Khu nội bộ và phiên thành viên

Tận dụng hai trang hiện có: `/` cho công khai và `/noi-bo` cho nghiệp vụ. Không cần tách thành hai hệ thống triển khai để đạt yêu cầu phân quyền.

Khi vào website, server hoặc luồng khởi tạo kiểm tra phiên thực tế. Thành viên có phiên hợp lệ được chuyển thẳng vào khu nội bộ; vẫn có lối xem trang công khai. Phiên hết hạn, bị thu hồi hoặc tài khoản bị khóa phải quay về đăng nhập, không chỉ dựa vào cờ lưu trên trình duyệt.

Thẻ đăng nhập chỉ phục vụ tài khoản thành viên do CLB cấp. Các quyền thao tác theo vai trò hiện có được giữ lại; tài khoản khách không mở chức năng nội bộ, tài khoản cựu thành viên không tự được cấp quyền giao/trả sách.

Giữ phiên bằng cơ chế cookie bảo mật và vòng đời phiên của hệ thống xác thực. Thời hạn ghi nhớ cụ thể cần xác định khi triển khai, không hiểu là phiên tồn tại vô hạn. Không lưu mật khẩu để tự đăng nhập lại. Phải kiểm tra quyền tại API kể cả khi khách mở trực tiếp `/noi-bo` hoặc tự gửi request.

## 8. Dữ liệu và các điểm tích hợp đề xuất

| Nhóm | Dữ liệu hoặc yêu cầu tối thiểu |
|---|---|
| Đơn đặt | ID, mã đơn, họ tên, SĐT chuẩn hóa, thông tin bạn đọc cần thiết, bản sách, trạng thái, thời điểm tạo/cập nhật, thời điểm hết hạn. |
| Buổi nhận | Liên kết ca trực và phiên bản công bố; lưu ngày, giờ kết thúc, địa điểm đã xác nhận. |
| Giới hạn IP | Khóa IP, thời điểm tạo đơn thành công; vẫn truy được sau hủy, hết hạn hoặc trả trong cửa sổ 24 giờ. |
| Quyền tra cứu | Băm token bí mật theo đơn, phạm vi xem/hủy; không dùng mã tăng dần làm quyền truy cập. |
| Chống tạo trùng | Khóa thao tác và dấu nhận diện nội dung yêu cầu; thử lại cùng ý định trả cùng đơn, đổi payload không được nhận kết quả của đơn khác. |
| Bàn giao | Liên kết hồ sơ bạn đọc và đúng dòng phiếu mượn, người giao, thời điểm giao. |
| Kết thúc | Người/thao tác trả hoặc hủy, thời điểm kết thúc và lý do nếu có. |

Các nguyên tắc tích hợp:

1. Tận dụng chuẩn hóa SĐT, hồ sơ bạn đọc, danh mục bản sách, ca trực, xác thực, audit và nghiệp vụ mượn/trả hiện có. Không tự tạo tài khoản khi khách đặt sách.
2. Giữ chỗ là lớp nghiệp vụ riêng. Bản sách còn trong kho nhưng không khả dụng nếu có giữ chỗ còn hạn; không dùng trạng thái `BORROWED` để giả lập đã giao.
3. Tất cả đường đọc tồn, đặt online, giao tại quầy và thay đổi tình trạng bản sách phải xét giữ chỗ. Không cho đường lập phiếu thủ công lấy bản đã giữ cho người khác.
4. Tạo đơn phải bảo đảm nguyên tử các điều kiện: ca còn hợp lệ, IP còn lượt, SĐT còn suất và bản sách còn khả dụng. Khóa/kiểm soát đồng thời phải có hiệu lực qua nhiều request và nhiều instance, kể cả khi IP hoặc SĐT chưa có bản ghi trước đó.
5. Giao, hủy, hết hạn và trả cùng đơn không được cùng giải phóng hoặc tiêu thụ một suất nhiều lần. Khi tích hợp giao dịch hiện có, xác định một thứ tự khóa chung để tránh deadlock; không đặt thứ tự khóa mới tùy tiện.
6. Dòng sách trên phiếu chuyển tiếp hoặc gia hạn chỉ tính một nghĩa vụ chưa trả. Phiếu cũ và phiếu kế tiếp không được cộng hai suất cho cùng bản sách.
7. Đề xuất tính cả sách mượn trực tiếp và lịch sử chưa trả có sẵn vào hạn mức SĐT để không vượt 3 bằng cách kết hợp các kênh. Đây là chi tiết tích hợp cần rà soát dữ liệu trước triển khai, không tự hủy các khoản mượn đang tồn tại.
8. Giới hạn cũ tối đa 2 cuốn trên một phiếu mượn không đồng nghĩa với giới hạn tổng 3 suất. Cách tích hợp tối thiểu là mỗi đơn online khi nhận tạo một phiếu 1 cuốn; chưa thay đổi quy tắc phiếu thủ công hoặc gộp 3 đơn thành phiếu 3 cuốn.

Nguồn đối chiếu trong dự án: [cổng công khai](../../src/pages/index.astro), [khu nội bộ](../../src/pages/noi-bo.astro), [hồ sơ bạn đọc](../../src/server/borrowers/service.ts), [chuẩn hóa SĐT](../../src/server/borrowers/rules.ts), [trạng thái bản sách](../../src/server/catalog/types.ts), [quy tắc phiếu mượn](../../src/server/circulation/rules.ts), [nghiệp vụ mượn/trả](../../src/server/circulation/service.ts), [ca trực](../../src/server/duty/roster-types.ts). Đây là đối chiếu source, chưa chứng minh luồng đặt chỗ đã hoạt động.

## 9. Trường hợp cần kiểm thử khi triển khai

Toàn bộ ca dưới đây là kế hoạch kiểm thử, chưa có kết quả thực thi cho tính năng này.

### 9.1. Luồng công khai và tạo đơn

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| PUB-01 | Khách chưa có tài khoản vào landing | Xem nội dung công khai, tìm sách, xem ca và đặt được; không bắt đăng nhập/OTP. |
| PUB-02 | Thiếu tên, SĐT sai hoặc thiếu thông tin bắt buộc | Không tạo đơn, không giữ sách, không tính lượt. |
| PUB-03 | Gửi yêu cầu đặt 0 hoặc nhiều hơn 1 bản | Server từ chối; không dựa vào giới hạn frontend. |
| PUB-04 | Đặt hợp lệ | Có 1 đơn, giữ đúng 1 bản, có mã và thông tin nhận; chưa có phiếu mượn hoặc thu cọc. |
| PUB-05 | Bản cuối đã được người khác lấy sau khi mở form | Từ chối an toàn, không trừ hạn mức và cập nhật khả dụng. |
| PUB-06 | Ca nháp, ca hủy, ca đã kết thúc hoặc không bảo đảm địa điểm sách | Không nhận đơn cho ca/bản đó. |
| PUB-07 | Lỗi mạng sau khi server đã tạo đơn; bấm lại hoặc reload | Trả đúng đơn cũ khi thử lại cùng thao tác, không tạo/trừ lượt trùng. |
| PUB-08 | Dùng khóa thao tác cũ với nội dung khác | Không trả nhầm đơn hoặc âm thầm tạo thêm bằng cùng khóa. |

### 9.2. Hai hạn mức độc lập

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| LIM-01 | Một SĐT đặt 3 đơn từ các IP khác nhau | Đơn thứ tư bị chặn theo SĐT. |
| LIM-02 | Nhiều SĐT tạo tổng 3 đơn từ một IP | Đơn thứ tư bị chặn theo IP. |
| LIM-03 | Cùng SĐT với `0`, `+84`, `84` và ký tự phân cách hợp lệ | Cộng chung một hạn mức. |
| LIM-04 | Hai hồ sơ bạn đọc chung SĐT | Cộng chung suất nhưng không tự gộp hồ sơ. |
| LIM-05 | Xóa cookie, đổi trình duyệt, đổi IP | Không khôi phục suất của cùng SĐT; lịch sử vẫn ở server. |
| LIM-06 | Nhận 3 sách đã giữ | Vẫn 3 suất, không thành 0 hoặc 6. |
| LIM-07 | Trả 1 trong 3 sách | Còn 2 suất dùng; đặt thêm được nếu IP còn lượt. |
| LIM-08 | Trả 1 sách ngay sau khi IP đã tạo đủ 3 đơn/24 giờ | SĐT có suất nhưng đơn mới vẫn bị chặn theo IP. |
| LIM-09 | Hủy hoặc hết hạn đơn trong cửa sổ 24 giờ | Mở suất SĐT và tồn, không mở lượt IP. |
| LIM-10 | Trước, đúng và sau mốc đơn đủ 24 giờ; qua 0 giờ | Chỉ đúng mốc 24 giờ đơn mới ra khỏi cửa sổ; không reset theo ngày. |
| LIM-11 | Cùng IP dưới các biểu diễn địa chỉ tương đương; giả header IP | Chuẩn hóa nhất quán; header không tin cậy không đổi khóa đếm. |
| LIM-12 | Sẵn có 3 hoặc nhiều hơn 3 sách chưa trả, gồm mượn tại quầy | Không cho tạo mới, không tự hủy dữ liệu cũ. |
| LIM-13 | Gia hạn/chuyển tiếp phiếu; sách quá hạn hoặc báo mất chưa xử lý | Không cộng đôi cùng bản; không tự giải phóng sách chưa trả. |

### 9.3. Giao, trả, hủy và hết hạn

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| LIFE-01 | Thành viên giao đơn hợp lệ trước hạn | Liên kết đúng hồ sơ/dòng sách, ghi nhận mượn và cọc theo quy trình; giữ nguyên suất. |
| LIFE-02 | Giao/cọc thất bại hoặc thử lại sau thành công | Không đánh dấu đã nhận giả, không tạo phiếu hoặc bút toán trùng. |
| LIFE-03 | Đúng giờ kết thúc ca, đơn chưa nhận | Hết hạn, không giao tiếp; mở lại tồn và suất SĐT. |
| LIFE-04 | Tác vụ hết hạn chậm hoặc chạy lại | Tồn và suất vẫn đúng tại thời điểm truy cập; không giải phóng hai lần. |
| LIFE-05 | Khách hủy bằng token hợp lệ trước khi nhận | Đơn bị hủy, nhả tồn/suất; không xóa lịch sử IP. |
| LIFE-06 | Hủy hoặc hết hạn một đơn đã giao | Bị chặn, không nhả sách đang mượn. |
| LIFE-07 | Trả từng bản, thử lại cùng thao tác trả | Mỗi bản thực trả mở đúng 1 suất, không mở lặp. |
| LIFE-08 | Hủy ca có cả đơn chờ nhận và đơn đã giao | Chỉ kết thúc các đơn chờ nhận; không sửa phiếu đã mượn. |
| LIFE-09 | Sửa giờ/địa điểm ca đã có đơn | Không âm thầm kéo dài hạn hoặc đổi cam kết; xử lý rõ theo mục 5. |
| LIFE-10 | Trả thành công nhưng hoàn cọc còn chờ xử lý | Suất phản ánh đã trả sách; không giả xác nhận hoàn tiền. |
| LIFE-11 | Chọn nhầm hồ sơ cùng SĐT hoặc sửa SĐT trên hồ sơ | Không chuyển quyền xem đơn, gộp người hoặc tạo suất ngoài ý muốn; có kiểm tra/audit. |

### 9.4. Đồng thời và tính bền vững

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| CON-01 | Hai request tranh bản cuối | Chỉ 1 đơn thành công. |
| CON-02 | Hai request tranh suất thứ ba của SĐT | Chỉ 1 đơn thành công; tính cả request từ IP khác nhau. |
| CON-03 | Hai SĐT tranh lượt thứ ba của IP | Chỉ 1 đơn thành công. |
| CON-04 | Các request đầu tiên đồng thời với IP/SĐT chưa có bản ghi | Không vượt hạn mức do chưa có hàng để khóa. |
| CON-05 | Giao, hủy và hết hạn chạy đồng thời | Một chuyển trạng thái hợp lệ thắng, tồn/suất không bị giải phóng nhầm. |
| CON-06 | Lập phiếu thủ công hoặc đổi tình trạng bản đang được giữ | Không lấy bản của đơn khác hoặc bỏ qua giữ chỗ. |
| CON-07 | Rollback sau khi đã khóa/quản lý suất | Không để đơn, tồn, suất hoặc cọc dở dang. |
| CON-08 | Nhiều Worker/instance, khởi động lại hoặc đổi khóa IP | Giới hạn vẫn thống nhất và bảo toàn cửa sổ 24 giờ. |

### 9.5. CAPTCHA, dữ liệu và phiên thành viên

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| SEC-01 | CAPTCHA thiếu, giả, hết hạn, dùng lại hoặc sai phạm vi website/action | Không tạo đơn mới hoặc tính lượt. |
| SEC-02 | Nhà cung cấp CAPTCHA lỗi hoặc không phản hồi | Không bỏ qua xác minh; cho thử lại an toàn. |
| SEC-03 | Biết mã đơn hoặc SĐT nhưng không có token | Không xem được PII, lịch sử hoặc hủy đơn người khác. |
| SEC-04 | Token một đơn được dùng để truy cập đơn khác | Bị từ chối; token không cấp quyền nội bộ. |
| SEC-05 | Kiểm tra log, cache và trang công khai | Không lộ token/bí mật, danh sách người đặt hoặc thông tin nội bộ. |
| SEC-06 | Dùng SĐT giả nhưng đúng định dạng, vượt CAPTCHA | Không coi là đã xác minh chủ SĐT; ghi nhận đây là giới hạn chấp nhận của bản chưa OTP. |
| SEC-07 | Thành viên có phiên hợp lệ quay lại website | Đi thẳng khu nội bộ; vẫn xem được trang công khai khi chọn. |
| SEC-08 | Phiên hết hạn/thu hồi, tài khoản bị khóa hoặc khách gọi API trực tiếp | Không mở chức năng nội bộ; yêu cầu đăng nhập hoặc từ chối đúng quyền. |
| SEC-09 | Cựu thành viên hoặc thành viên không có quyền giao/trả | Không nhận thêm quyền chỉ vì đã đăng nhập. |

## 10. Điều kiện chuyển sang triển khai

Thiết kế này đã đủ quy tắc nghiệp vụ cho việc lập kế hoạch thực hiện. Trước khi viết tính năng cần xác định cách tích hợp với dữ liệu/phiếu mượn có sẵn, cách kết thúc nghĩa vụ mất sách, thời hạn phiên thành viên và cấu hình CAPTCHA. Những chi tiết đó không được làm thay đổi mức 1 quyển/đơn, 3 suất/SĐT hoặc 3 đơn/IP/24 giờ đã chốt.

Khi triển khai, cần kiểm thử logic, API, giao diện khách/thành viên và giao dịch đồng thời trên PostgreSQL thật. Kết quả source/unit không thay thế bằng chứng DB, Worker, nhà cung cấp CAPTCHA hoặc phiên đăng nhập thực tế. Không suy ra đã triển khai hoặc đã nghiệm thu từ việc có tài liệu này.
