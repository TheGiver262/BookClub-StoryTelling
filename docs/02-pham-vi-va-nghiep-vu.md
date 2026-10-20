# Phạm vi sản phẩm và mô hình nghiệp vụ v0.11

Ngày 18/10/2026. Đây là bản khám phá để phỏng vấn; mọi quy tắc ghi “đề xuất” cần được chủ sản phẩm xác nhận trước khi triển khai phụ thuộc.

## 1. Mục tiêu và ranh giới

Website phục vụ hoạt động CLB sách, dùng được từ Internet trên điện thoại và laptop. Khu công khai giúp tìm sách, đọc review và biết lịch/sự kiện. Khu nội bộ giúp vận hành, đối soát và truy trách nhiệm theo quyền.

Đã xác nhận: bản đưa vào dùng đầu tiên phải có đủ cả chín nhóm chức năng. Trong quá trình xây dựng vẫn ưu tiên chứng minh mượn–trả và tiền chính xác trước. Không phát hành bản thiếu module để thay thế phạm vi đã yêu cầu.

Chỉ phục vụ CLB Sách Bách Khoa. Tương lai có thể bán các bản triển khai riêng cho CLB khác; chưa cần kiến trúc nhiều CLB chung dữ liệu. Dùng điện thoại và laptop với mạng hiện ổn định.

Quy mô đã nêu: vài nghìn sách, dưới 5.000; chưa tách rõ số đầu sách và số bản vật lý. Hai kho chính ở thư viện trường và văn phòng Hội Sinh viên. Mỗi buổi dưới 100 lượt mượn/trả cộng lại, tối đa 3–5 người ghi đồng thời. Dữ liệu cũ gồm sổ giấy và Excel; tổng số thành viên chưa có con số.

Không mặc định bổ sung: đọc ebook, bán hàng trực tuyến, thanh toán tự động, AI chấm tuyển, nhận diện khuôn mặt, app native, mạng xã hội hoặc ghi âm phỏng vấn.

## 2. Yêu cầu và tiêu chí chức năng

| Mã | Nhóm | Yêu cầu đã ghi nhận | Cách chứng minh cơ bản |
|---|---|---|---|
| FR-01 | Sách, mượn–trả | Nhiều kho; tên, thể loại nhiều giá trị, tác giả, NXB, giá, ngày nhập, review; đang mượn/trong kho/mất; cọc; gia hạn; phạt; nhắc gọi | Theo dõi được từng bản sách, từng khoản cọc; giao dịch và tiền không bị nhân đôi |
| FR-02 | Thành viên | Đang hoạt động/cựu thành viên, lịch sử ban/chức vụ, trường/năm/khóa, điện thoại/bài viết tuyển | Cựu ra CLB/tốt nghiệp vẫn đăng nhập nhưng chỉ xem; tài khoản bị khóa là trạng thái riêng |
| FR-03 | Trực sách | Nhập Excel lịch học; tự đề xuất phân ca và phân/chỉnh tay; người chính/hỗ trợ, vai trò, đúng giờ và công bố lịch | Không xếp trùng lịch cứng theo khoảng cần có mặt; báo ca thiếu người, ghi nhận đi muộn/vắng; lịch được quản lý chốt và báo CLB |
| FR-04 | Tuyển thành viên | Tự đồng bộ đơn Google Form, nhiều nguyện vọng; phỏng vấn/chấm riêng, tổng kết hội đồng, bài viết chấm riêng/chung, điểm được sửa; tiêu chí theo năm | Đơn không trùng, nguyện vọng tách ban phân bổ; điểm có nguồn/phiên bản/lịch sử sửa; công bố không lộ hồ sơ riêng |
| FR-05 | Quỹ và hoạt động | Thu–chi/ngân sách, hội phí khoảng 100k một lần; bán sách mới theo lô riêng với chiết khấu, công nợ, cọc nhà sách, trả hàng dư/giữ bán tiếp | Đối soát chứng từ/hàng/tiền; tách cọc CLB phải hoàn bạn đọc với cọc CLB đặt nhà sách; không tự thu hội phí lại theo năm |
| FR-06 | Sự kiện | Địa điểm, ngân sách, khách/thành viên, phân công và chi phí thực tế | Theo dõi kế hoạch, người phụ trách, việc còn thiếu và quyết toán |
| FR-07 | Thống kê | Dashboard, báo cáo tuần/tháng/quý/năm và xuất cả Excel/PDF | Cùng bộ lọc cho cùng kết quả; số tổng/file xuất truy ngược được từng giao dịch |
| FR-08 | Nhật ký | Ai, lúc nào, thao tác gì; thống kê xem sách/review | Audit nội bộ truy vết được; analytics công khai không thu thừa dữ liệu cá nhân |
| FR-09 | Người dùng/quyền | Khách Google hoặc email/mật khẩu; nội bộ username/mật khẩu được cấp; cựu chỉ xem hoạt động, không PII nhạy cảm/tiền/xuất file; nội dung khách chờ duyệt | API kiểm loại tài khoản/trạng thái/phương thức đăng nhập; danh tính khách không cấp quyền nội bộ; giới hạn cựu áp dụng cả API/file/phiên cũ |

## 3. Thuật ngữ và nguồn dữ liệu chuẩn

| Khái niệm | Ý nghĩa và nguồn chuẩn đề xuất |
|---|---|
| Đầu sách/ấn bản | Thông tin thư mục chung; khác lần xuất bản/NXB có thể cần ấn bản riêng |
| Bản sách cho mượn | Một cuốn sách cũ có mã riêng; vị trí/tình trạng/giá có thể khác bản cùng tên; thiếu giá vẫn lưu đúng là chưa biết |
| Lô sách bán | Sách mới nhận từ nhà sách để bán; giá bìa, điều kiện chiết khấu, lượng nhận/bán/trả/giữ và quyết toán riêng với kho mượn |
| Kho/vị trí | Nơi giữ sách; bàn trong trường có thể là vị trí tạm thuộc buổi trực |
| Người mượn | Hồ sơ nghiệp vụ, không bắt buộc có tài khoản đăng nhập |
| Thành viên CLB | Người hoạt động trong tổ chức; có thể đồng thời là người mượn |
| Tài khoản | Danh tính đăng nhập; không đồng nhất với người mượn hay thành viên |
| Phiếu mượn/dòng mượn | Mỗi phiếu tối đa hai bản; từng dòng có cọc, liên kết trả/chuyển tiếp và lịch sử của bản sách |
| Nghĩa vụ cọc | Khoản còn phải hoàn, tính từ các bút toán và phân bổ cọc đã ghi sổ |
| Chứng từ/bút toán | Nguồn chuẩn của thu–chi, cọc, phạt và điều chỉnh; dashboard chỉ tổng hợp |
| Ca trực | Khoảng thời gian, vị trí và phân công người |
| Phiên quầy tiền | Một hộp tiền chung trong buổi, người trực chính kiểm/xác nhận đầu và cuối; không đổi người giữ giữa buổi |
| Quỹ nghiệp vụ | Quỹ mượn–trả thường xuyên và quỹ hoạt động khác được tách riêng; không đồng nhất quỹ với phương thức tiền mặt/chuyển khoản |
| Review | Bài nội dung đã nháp/duyệt/xuất bản; chưa đồng nhất với bình luận của khách |
| Hồ sơ tuyển | Đơn và phỏng vấn theo một đợt, có phiên bản rubric và quyết định |

Không lưu số tổng “số sách đang mượn”, “tiền quỹ” ở nhiều nơi rồi cho sửa độc lập. Cache/tổng hợp phải có nguồn chuẩn và đường cập nhật duy nhất.

Tác giả, thể loại liên kết nhiều–nhiều nếu dữ liệu thực tế cần. Ngày nhập và giá của bản sách cần phân biệt với ngày tạo bản ghi. ISBN không thay thế mã bản sách và không bắt buộc với sách không có ISBN.

## 4. Quy tắc mượn, hạn và phạt

Đã xác nhận lại: thời hạn đầu 14 ngày, tối đa ba lần gia hạn, mỗi lần 14 ngày. Tối đa hai quyển trên mỗi phiếu; phạt 1.000 VND/ngày trên cả phiếu cho tất cả sách trong phiếu, không nhân theo số sách. Chưa đặt giới hạn tổng sách một người đang giữ qua nhiều phiếu vì chưa có quy tắc đó.

Đã xác nhận cọc theo từng quyển, mức gần nhất theo bội 50.000 VND, mốc giữa làm tròn lên, tối thiểu 50.000 VND. Không có trần 200.000 VND. Với giá hợp lệ không âm, công thức là `max(50000, floor((gia + 25000) / 50000) * 50000)`. Nếu không có giá thì mặc định cọc 50.000 VND, giữ giá là chưa biết; không bắt buộc ước lượng hoặc gán giá giả 0/50.000.

| Giá sách VND | Cọc VND |
|---|---|
| 20.000 | 50.000 |
| 51.000 | 50.000 |
| 74.000 | 50.000 |
| 75.000 | 100.000 |
| 100.000 | 100.000 |
| 151.000 | 150.000 |
| 230.000 | 250.000 |
| Không có giá | 50.000, nguồn tính cọc là mặc định sách không giá |

Hạn đến hết ngày tại Việt Nam. CLB trực thứ Ba và thứ Năm hằng tuần; nếu buổi trực đến hạn trùng lịch nghỉ lễ/Tết thì tự dời hạn tới buổi trực thực tế gần nhất tiếp theo, không phạt khoảng dời do CLB nghỉ. Ví dụ đã xác nhận: trả đúng ngày thứ Ba đến hạn không phạt, tới thứ Năm phạt gợi ý 2k. Hai cuốn cùng quá hạn ba ngày chỉ tính 3k cho phiếu.

Thiết kế lịch đề xuất: lưu lịch trực định kỳ và ngoại lệ nghỉ/hủy/dời; lưu hạn gốc, hạn hiệu lực sau điều chỉnh và lý do thay đổi. Không tạo phiếu gia hạn do CLB nghỉ rồi trừ số lần gia hạn của người mượn. Trường hợp hủy buổi ngoài lễ/Tết và kỳ thi cần chốt cùng quy tắc lịch.

Phạt phục vụ nhắc nhở cộng đồng; cho thành viên giảm hoặc miễn về 0 khi có lý do. Đề xuất lưu riêng mức hệ thống gợi ý, mức chốt, lý do và người thực hiện; chỉ mức thực thu mới vào sổ tiền. Không coi phạt gợi ý là đã thu, không âm thầm xóa tiền phạt đã thực thu khi sửa quyết định sau đó.

Gia hạn đã chốt theo hai nhánh:

- Chưa quá hạn, kể cả đúng ngày đến hạn: cộng thêm 14 ngày vào hạn trả hiện tại, không tính từ ngày yêu cầu sớm. Ví dụ hạn hiện tại là 14/10 thì gia hạn ngày 5/10 hay 14/10 đều cho hạn mới 28/10, trước điều chỉnh lịch nghỉ.
- Đã quá hạn: quyết toán phạt của khoảng quá hạn cũ trước, rồi được gia hạn thêm 14 ngày tính từ ngày gia hạn. Ghi mốc phạt đã quyết toán để không thu lại cùng khoảng ngày. Đây vẫn là gia hạn của phiếu hiện tại, không tự đặt số lần gia hạn về 0; giới hạn ba lần giữ nguyên. Chỉ phiếu chuyển tiếp do trả một phần mới reset theo quy tắc đã chốt.

Q33 đã chốt cộng đúng 14 ngày lịch, không đếm ngày mượn là ngày thứ nhất: mượn 1/10 → hạn 15/10; gia hạn trong hạn → 29/10 trước điều chỉnh lịch nghỉ. Quy tắc này thay ví dụ nhầm 1/10 → 14/10 trong lời giải thích trước. Ví dụ riêng “hạn hiện tại 14/10 → gia hạn 28/10” vẫn đúng khi 14/10 thực sự là hạn đã có của phiếu. Tất cả mốc tính theo ngày Việt Nam, hạn đến hết ngày hiệu lực.

Ngoại lệ lịch còn cần xác nhận:

- Ngày không trực thông thường, hủy buổi đột xuất và nghỉ lễ xen giữa một khoảng đã quá hạn ảnh hưởng số ngày tính phạt thế nào? Ví dụ thứ Ba đến hạn tới thứ Năm là 2k đã rõ, chưa thay thế đầy đủ mọi ngoại lệ.

Hạn đầu cộng đúng 14 ngày và cả ba lần gia hạn đều trong hạn thì một vòng phiếu có 14 + 3 × 14 = 56 ngày trước điều chỉnh lịch nghỉ. Gia hạn sau quá hạn tính từ ngày xử lý nên không được mô tả 56 ngày là trần giữ vật lý tuyệt đối. Trả một phần và lập phiếu chuyển tiếp bắt đầu lại 14 ngày, số lần gia hạn về 0; hệ thống truy được lịch sử xuyên phiếu.

Đề xuất dùng ngày nghiệp vụ theo `Asia/Ho_Chi_Minh`, lưu timestamp kỹ thuật theo UTC. Phạt ngày lịch không tính bằng cách chia mili giây tùy tiện. Cần ví dụ kiểm thử cho mượn trước nửa đêm, trả đúng hạn và sau hạn một ngày.

Sách không có giá: mặc định cọc 50.000 VND theo xác nhận mới nhất, thay đề xuất ước lượng theo độ dày. Lưu căn cứ tính cọc “mặc định sách không giá”, không giả định giá bìa là 50.000. Nếu bổ sung giá sau này, không âm thầm đổi tiền cọc của phiếu đã lập.

Giá, quy tắc cọc, quy tắc phạt và phiên bản chính sách được chụp lại vào giao dịch. Sửa giá sách hoặc chính sách sau này không tự sửa lịch sử đang tranh chấp.

## 5. Luồng nghiệp vụ quan trọng

### 5.1 Mở buổi và đưa sách ra bàn

Chọn buổi, địa điểm, người trực chính và quầy tiền chung. Người trực chính đếm/xác nhận tiền đầu buổi theo mệnh giá; phân biệt số thực đếm với số sổ sách và đối chiếu số cuối buổi trước. Tiền để lại trong tủ không biến thành khoản thu mới khi mở ca. Cả 3–5 người ghi giao dịch dùng cùng phiên quầy; không tạo 3–5 số dư tiền đầu ca cho cùng hộp tiền.

Chọn các bản sách mang từ kho ra bàn, lập danh sách bàn giao và xác nhận nhận. Cuối buổi đối chiếu sách còn tại bàn, sách đã cho mượn và sách mang về. Một bản không được đồng thời xuất hiện là sẵn sàng ở cả kho và bàn.

### 5.2 Cho mượn

Tìm/tạo người mượn bằng thông tin tối thiểu; không công khai tìm bằng số điện thoại. Chọn từng bản, kiểm tra khả dụng, tính cọc và hạn phía máy chủ. Người trực xác nhận đã nhận tiền và giao sách.

Đã xác nhận nhận cọc, hoàn cọc và thu phạt bằng tiền mặt hoặc chuyển khoản qua tài khoản riêng của CLB; được nhận bằng phương thức này và hoàn bằng phương thức kia. Mỗi khoản thực thu/hoàn lưu riêng phương thức, nguồn tiền, người ghi và người/thông tin xác nhận. Phương thức lúc mượn không ép phương thức lúc hoàn.

Thành viên bắt buộc kiểm tra tài khoản/giao dịch thực tế qua app ngân hàng trước và sau khi nhận tiền, xác nhận theo tiền thực vào/ra. Chưa yêu cầu website tự nhận dữ liệu ngân hàng. Có thể đặt QR kèm loa tại bàn để hỗ trợ nhận tiền; không coi mã QR, ảnh chụp của khách hoặc tiếng loa là bằng chứng thay thế việc kiểm app. Phần mềm chỉ ghi nhận đã thu/hoàn sau bước xác nhận tiền thực tế; lệnh chuyển đang chờ/xử lý lỗi không tự thành khoản đã hoàn.

Ví dụ: nhận cọc 100k qua ngân hàng rồi hoàn 100k tiền mặt. Ngân hàng tăng 100k ở lần nhận; hộp tiền giảm 100k ở lần hoàn; nghĩa vụ cọc về 0. Không sửa giao dịch nhận ban đầu thành tiền mặt để làm cho hai phương thức giống nhau. Nếu hộp tiền không đủ, không ghi khoản chi đã xảy ra hoặc tự lấy quỹ hoạt động bù; cách xử lý thực tế phải được người trực xác nhận.

Một transaction hoàn tất dòng mượn, trạng thái bản sách, phân bổ cọc, bút toán và audit. Dùng khóa/idempotency để hai người không cho mượn cùng một bản hoặc ghi hai lần khi bấm lại. Tiền mặt ngoài đời cần con người xác nhận; transaction DB không chứng minh tiền đã được giao tay.

### 5.3 Trả, trả một phần và hoàn cọc

Xác định đúng người/phiếu/bản; ghi thời điểm nhận và tình trạng sách. Tính phạt theo chính sách đã chốt; hiển thị cọc được giải phóng, phạt, tiền cần hoàn hoặc cần thu thêm.

Đã xác nhận cách vận hành mong muốn: khi trả một phần, ghi tất toán phiếu cũ và lập phiếu mới cho các cuốn chưa mang trả. Đề xuất biểu diễn đây là phiếu chuyển tiếp có liên kết: phân biệt cuốn thực trả với cuốn tiếp tục giữ, chuyển khoản cọc tương ứng, không tạo giao dịch tiền mặt hoặc biến động kho giả. Giao diện vẫn có phiếu mới theo cách CLB quen dùng.

Đã chốt: phiếu chuyển tiếp bắt đầu lại 14 ngày và số lần gia hạn về 0; tiền phạt của cả phiếu cũ được quyết toán ngay khi trả một phần, không chuyển sang phiếu mới. Chỉ hoàn thực tế phần cọc được giải phóng; cọc chưa bị xử lý của cuốn chuyển tiếp vẫn là nghĩa vụ phải hoàn. Nhận sách và trả tiền có thể không cùng thời điểm: nếu chưa trả được tiền, lưu “chờ hoàn”, không đánh dấu đã hoàn. Mỗi khoản chi thực tế có trạng thái, người xác nhận và nguồn tiền.

Ví dụ chuyển tiếp đề xuất để kiểm chứng quy trình thực tế: phiếu hai cuốn cọc 50k + 100k, phạt 60k, khách trả cuốn cọc 50k và tiếp tục giữ cuốn cọc 100k. Quyết toán 60k phạt của phiếu cũ; khoản cọc 100k được chuyển liên kết sang phiếu mới, còn 50k được hoàn nếu không có xử lý khác. Không phát sinh thu/hoàn giả 100k. Nếu CLB thực sự trao lại toàn bộ tiền rồi nhận lại cọc cuốn tiếp tục giữ, phải ghi đúng các dòng tiền thực tế đó.

Ngoại lệ đã xác nhận: tổng cọc phiếu cũ 150k, phạt đạt 150k, trả cuốn cọc 50k và tiếp tục giữ cuốn cọc 100k. Giữ đủ 150k cũ làm phạt rồi thu mới 100k cọc cho phiếu mới. Không hoàn 50k, không chuyển tiếp 100k cũ vì toàn bộ cọc cũ đã dùng hết. Nghĩa vụ cọc cũ giảm 150k, khoản phạt được tất toán bằng giữ cọc; nghĩa vụ cọc mới tăng đúng 100k sau xác nhận nhận tiền. Tiền mặt/ngân hàng thực tăng 100k theo phương thức thu mới, không tăng 250k: giữ cọc cũ không phải một lần thu tiền mới. Cuốn tiếp tục giữ không nhập kho giả. Nếu chưa nhận được cọc mới thì giữ thao tác ở trạng thái chưa hoàn tất, không ghi đã thu hoặc cho cuốn đó thành sách sẵn có.

Sai sót được sửa bằng giao dịch đảo/điều chỉnh có liên kết và lý do. Không xóa phiếu đã phát sinh tiền, kể cả admin.

### 5.4 Gia hạn và nhắc trả

Ghi mỗi lần gia hạn, hạn trước/sau và người xử lý. Hai yêu cầu gia hạn đồng thời vẫn không vượt ba lần. Danh sách gần hạn có số điện thoại chỉ dành cho người có quyền; lưu đã gọi, chưa liên lạc được và ghi chú cần thiết. Chưa tự tích hợp SMS/Zalo hoặc gọi điện tự động.

### 5.5 Mất/hỏng và xử lý tranh chấp

Đã xác nhận: mất sách thì mất tiền cọc. Phần mềm cần hành động xác nhận mất và xử lý cọc có người chịu trách nhiệm; không chỉ đổi trạng thái sách rồi âm thầm mất dấu nghĩa vụ tiền. Quy tắc sách hỏng, tìm lại sau khi đã xử lý hoặc hủy quyết định còn mở. Ảnh hưởng đến người mượn, bản sách và sổ tiền phải nhất quán.

### 5.6 Đóng ca và bàn giao

Số tiền mặt dự kiến = tiền mặt đầu ca + tổng thu tiền mặt thực tế − tổng chi tiền mặt thực tế trong ca. Chuyển khoản không trộn vào hộp tiền mặt; có bảng đối soát riêng khoản nhận/hoàn qua tài khoản CLB. Người trực chính kiểm/xác nhận cuối buổi, ghi số thực đếm, chênh lệch và giải trình nếu có. Mỗi người nhập giao dịch vẫn có tài khoản và audit riêng; người giữ tiền và người bấm nhập không mặc định là cùng một người.

Đã xác nhận dùng chung một hộp tiền, không đổi người giữ tiền giữa buổi; không xây luồng bàn giao người giữ trong ca ở phạm vi hiện tại. Cuối buổi tiền mặt mượn–trả để trong tủ sách khóa lại để buổi sau sử dụng. Lưu số tiền chốt và trách nhiệm cất/nhận; việc cất hộp tiền không phải chi phí hoặc chi trả khách. Buổi sau mở quầy bằng số dư chuyển tiếp, đếm lại và ghi nhận chênh lệch nếu có.

Ca đã đóng không nhận giao dịch thường. Sửa sau đóng qua điều chỉnh, lưu thời điểm thực ghi và ngày nghiệp vụ. Người trực chính xác nhận đầu/cuối như quy trình đã chọn; không tự thêm yêu cầu hai người cùng duyệt hoặc giới hạn nghiệp vụ cho một thủ quỹ riêng. Bàn giao giữa các buổi và đối chiếu tiền là quy trình trách nhiệm, không thay mô hình quyền chung của thành viên.

Đối soát trọng tâm do chủ sản phẩm xác nhận: từng khoản cọc nhận/hoàn phải khớp phiếu và bản sách, tiền đầu/cuối buổi phải khớp tiền thực tế. Báo cáo buổi phải có cọc đầu buổi còn phải hoàn, cọc mới nhận, cọc đã hoàn, cọc chuyển tiếp, cọc đã xử lý vì mất/phạt và cọc cuối buổi còn phải hoàn. Cọc chuyển tiếp chỉ đổi liên kết, không tăng tổng nghĩa vụ hoặc tiền thực nhận.

Không dùng một công thức “số sách mượn hôm nay × mức cọc” để giải thích tiền quầy: còn có sách trả từ phiếu cũ, cọc mỗi quyển khác nhau, thu phạt, bàn giao và khoản quỹ khác. Hệ thống tách từng nguồn, cho đối chiếu và phát hiện chênh lệch; không sửa số thực đếm cho bằng số dự kiến.

## 6. Sổ tiền: thiết kế tối thiểu nhưng chặt chẽ

Đề xuất sổ kép nội bộ nhỏ, không xây nguyên hệ thống kế toán doanh nghiệp. Nhóm tài khoản tối thiểu: tiền mặt/chuyển khoản, cọc phải hoàn, thu phạt/đóng góp, chi hoạt động; công nợ phát sinh bổ sung theo nghiệp vụ đã xác nhận. Mỗi chứng từ có tổng Nợ = tổng Có và liên kết phiếu nguồn.

Đã xác nhận quỹ mượn–trả là hoạt động thường xuyên hằng tuần và tách riêng quỹ CLB dành cho các hoạt động khác. Cả hai được quản lý trên website nhưng có sổ/số dư/báo cáo riêng. Không dùng quỹ hoạt động để tự bù thiếu hộp cọc, không gộp hai quỹ thành số tiền có thể chi tự do.

Thiết kế tối thiểu có hai chiều độc lập: quỹ nghiệp vụ (mượn–trả hoặc hoạt động khác) và nơi/phương thức giữ tiền (hộp tiền mặt hoặc tài khoản ngân hàng CLB). Một tài khoản CLB không tự chứng minh chỉ chứa một quỹ; cách phân bổ số dư ngân hàng cần xác nhận khi chuyển dữ liệu. Không suy ra cần mở thêm tài khoản ngân hàng từ yêu cầu tách sổ.

Tiền phạt và khoản cọc giữ lại được ghi đúng nguồn phiếu. Việc khoản thu đó được giữ trong quỹ mượn–trả hay chuyển sang quỹ hoạt động khác còn cần chốt; không tự tạo chuyển quỹ. Bất kỳ chuyển quỹ thực tế nào cũng phải có liên kết hai phía, không tính thêm doanh thu một lần nữa.

Cọc nhà sách trong hoạt động bán là khoản CLB giao cho bên khác và còn quyền được hoàn; theo quy trình đã chốt, hoàn cọc riêng rồi thanh toán tiền sách riêng. Cọc bạn đọc là tiền CLB đang giữ và còn phải hoàn. Dùng hai nguồn/chứng từ/đối tác và số dư riêng, không bù hai loại cọc hoặc hiển thị chung như một nghĩa vụ. Nhận lại cọc nhà sách không tự thành doanh thu bán hàng.

Ví dụ theo quy trình đã xác nhận: khi phạt thấp hơn cọc, hoàn cọc và thu phạt riêng. Phần mềm ghi được hai chiều tiền thực tế, không ép người trực chỉ giao phần chênh lệch:

| Hành động | Nợ | Có | Hệ quả |
|---|---|---|---|
| Nhận cọc 100.000 | Tiền mặt 100.000 | Cọc phải hoàn 100.000 | Quỹ khả dụng chưa tăng |
| Hoàn cọc 100.000 | Cọc phải hoàn 100.000 | Tiền mặt 100.000 | Hết nghĩa vụ cọc của phần đã trả |
| Thu phạt 3.000 | Tiền mặt 3.000 | Thu phạt 3.000 | Ghi khoản thu thực tế riêng |
| Phạt đạt/vượt cọc 50.000; giữ cọc | Cọc phải hoàn 50.000 | Thu phạt 50.000 | Không thu thêm, không ghi hoàn tiền giả |
| Trả sách, chưa có tiền hoàn, chưa khấu trừ gì | Chưa ghi chi giả | Giữ nghĩa vụ hoàn tương ứng | Sách có thể đã trả nhưng tiền còn phải hoàn |

Ví dụ phải tách nghĩa vụ cọc với số dư ngăn tiền: đầu ca có 200.000 tiền CLB, nhận cọc 100.000, sau đó hoàn 100.000 và thu phạt 3.000. Cuối ca dự kiến có 203.000; thu nhập của chuỗi này là 3.000, không phải 100.000.

Tiền lưu bằng số nguyên VND, kiểm tra giới hạn và không dùng số thực để tính tiền. Khóa khoản phân bổ cọc khi hoàn; tổng đã hoàn/đã xử lý không vượt cọc thực nhận. Không dùng số hoàn âm.

Quy tắc phạt: so với **tiền cọc**, không so với giá bìa. Phạt ngày tính một lần trên cả phiếu. Đã xác nhận phiếu hai cuốn cọc 50k + 100k, phạt 60k: hoàn 150k và thu riêng 60k; không chặn khoản phạt ở cọc 50k của một cuốn. Với phiếu một cuốn giá 74k, cọc 50k: phạt gợi ý 60k hoặc 80k đều chỉ giữ tối đa 50k; mất sách cũng giữ 50k. Mọi khoản phạt vẫn có thể giảm/miễn có lý do.

Diễn giải thống nhất từ các ví dụ đã xác nhận: dùng tổng cọc còn hiệu lực của phiếu làm trần xử lý phạt; thấp hơn trần thì hoàn cọc và thu phạt riêng khi tất toán toàn bộ, đạt/vượt trần thì giữ cọc và không thu thêm phạt. Khi trả một phần, phần cọc còn nguyên có thể chuyển liên kết; nếu phạt đã dùng hết 150k của phiếu cũ thì thu mới 100k cho cuốn tiếp tục giữ theo ví dụ trên. Mọi miễn/giảm vẫn phải có lý do và ghi đúng tiền thực tế.

Thống kê phải tách: tiền đang giữ, cọc còn phải hoàn, công nợ, thu–chi hoạt động và quỹ khả dụng. Chuyển tiền giữa hai quỹ không tính thành thu nhập mới. Tài sản ròng/quỹ khả dụng còn phụ thuộc các nghĩa vụ khác; không lấy tổng tiền trừ cọc rồi luôn coi là tiền có thể chi.

## 7. Thành viên, trực, tuyển và sự kiện

Thành viên: ban và chức vụ có ngày bắt đầu/kết thúc; không ghi đè làm mất lịch sử. Năm học thay đổi theo thời gian; khóa và trường cần danh mục phù hợp. Người đã ra CLB/tốt nghiệp chuyển cựu thành viên, giữ hồ sơ/tài khoản nội bộ ở chế độ chỉ xem. Không xóa chứng từ, người thực hiện hoặc audit cũ. Tài khoản bị khóa do quản trị/bảo mật là trạng thái riêng, không tự áp cho mọi cựu thành viên.

Cựu thành viên không được xếp vào ca mới hoặc sửa dữ liệu, tự đổi lại trạng thái hoạt động, tự cấp quyền, chấm/sửa điểm, duyệt nội dung, ghi tiền hoặc thực hiện giao dịch qua API. Chuyển trạng thái phải có hiệu lực với phiên đang mở, không chờ người dùng đăng xuất rồi mới mất quyền ghi. Đã chốt chỉ xem hoạt động CLB; không xem thông tin cá nhân nhạy cảm như địa chỉ/điện thoại, tài chính/số tài khoản và không xuất Excel/PDF. Hồ sơ tuyển, người mượn và sổ tiền không thuộc phạm vi hoạt động được đọc. Dùng danh sách trường cho phép phía máy chủ, không tải dữ liệu đầy đủ rồi ẩn cột trên UI. [Ma trận quyền](08-ma-tran-quyen-va-dang-nhap.md) ghi ranh giới cụ thể.

Bốn ban đã xác nhận: Hậu cần, Nội dung, Truyền thông đối ngoại và Ban chủ nhiệm. Mỗi ban chức năng có trưởng ban, phó ban và thành viên. Ban chủ nhiệm gồm chủ nhiệm CLB, phó chủ nhiệm và trưởng/phó các ban chức năng. Một người có thể vừa giữ chức vụ tại ban chức năng vừa thuộc Ban chủ nhiệm; danh sách/tổng số thành viên không được đếm thành hai người. Không đồng nhất Ban chủ nhiệm với vai trò admin của phần mềm nếu chưa có quy tắc cấp tài khoản đó.

Trực sách đã xác nhận: thứ Ba và thứ Năm, 14:00–17:00 tại một địa điểm; nhiều bàn để sách ghép lại không phải nhiều điểm trực độc lập. Mỗi ca tối thiểu hai người trực chính và 3–5 người hỗ trợ theo nhu cầu. Hai người chính phải cùng có mặt đủ 14:00–17:00. Cả người chính và hỗ trợ phải tham gia ít nhất 15 phút đầu/cuối cho chuẩn bị/thu dọn; hỗ trợ không bắt buộc ở giữa buổi.

Diễn giải thời gian làm mốc thiết kế, cần phản ánh đúng khi khóa lịch: chuẩn bị 13:45–14:00, thu dọn 17:00–17:15; người chính cần rảnh toàn khoảng 13:45–17:15, hỗ trợ cần rảnh hai khoảng đầu/cuối. Đây là cách quy đổi phát biểu “15 phút đầu/cuối”, chưa có xác nhận riêng rằng khâu thu dọn sau 17:00 thay vì bắt đầu trong 15 phút cuối giờ trực. Nếu quy trình thực tế khác, cập nhật mốc mà giữ nguyên yêu cầu 15 phút và hai người chính đủ 14:00–17:00.

Thành viên mới được xếp hỗ trợ để đào tạo trước. Chỉ người đã đủ điều kiện sau hướng dẫn mới được xếp trực chính. Đề xuất lưu trạng thái đủ điều kiện và người/thời điểm xác nhận; không xây thêm module khóa học hoặc tự đánh dấu đủ điều kiện chỉ vì đã hỗ trợ một lần. Cách xác nhận đào tạo và số người hỗ trợ cần chọn cụ thể trong khoảng 3–5 còn cần quy ước.

Luồng đã yêu cầu cho bản đầu: quản lý hậu cần thu thập/phân loại lịch học từ các trường khác mẫu rồi tổng hợp thành một mẫu Excel đơn giản, đầy đủ trước khi upload. Website chỉ tiếp nhận file tổng hợp đó; không có nhiệm vụ gộp file cá nhân, hiểu nhiều mẫu trường, OCR lịch học hoặc tự đổi tiết học của từng trường sang giờ. Hợp đồng cột/định dạng sẽ khóa khi có mẫu tổng hợp, vẫn cần dữ liệu xác định được người và các khoảng lịch có hiệu lực.

Phần mềm tự đề xuất phân ca và vẫn cho phân/chỉnh tay. Sau khi chốt, lịch được báo cho toàn CLB. Tự đăng ký ca rảnh chưa được xác nhận là luồng bắt buộc. Vai trò “quản lý xếp lịch” là nhiệm vụ tổ chức, không tự tạo loại tài khoản thứ tư hoặc bỏ quyền quản lý nghiệp vụ chung của thành viên.

Thiết kế xếp lịch đề xuất:

1. Nhận một mẫu Excel tổng hợp đã thống nhất với giới hạn dung lượng/số sheet/dòng; kiểm các cột bắt buộc và preview người–ngày–giờ–phạm vi hiệu lực có trong mẫu. Không xây bộ ánh xạ tùy ý cho nhiều mẫu trường. Dòng không đọc được, thiếu danh tính, trùng hoặc mơ hồ phải có lỗi, không tự coi thành “rảnh”. Không chạy macro hoặc công thức trong file.
2. Chuẩn hóa lịch học và các khoảng bận khác được xác nhận vào một nguồn lịch có hiệu lực theo học kỳ/tuần. Lưu phiên bản import; import lại không nhân đôi lịch hoặc âm thầm ghi đè toàn bộ.
3. Khai báo người chính/hỗ trợ và các khoảng phải có mặt gồm ít nhất 15 phút chuẩn bị/thu dọn. Với hỗ trợ, kiểm riêng hai khoảng đầu/cuối; người bận ở giữa vẫn có thể phù hợp. Người chính phải có mặt đủ 14:00–17:00 và hai khoảng đầu/cuối. Không tự dùng cả ca chính làm khoảng bắt buộc cho hỗ trợ.
4. Tách ràng buộc cứng (thành viên đang hoạt động, không bận/trùng khoảng bắt buộc, người chính đã qua hướng dẫn, đủ người) với ưu tiên mềm (phân đều, nguyện vọng). Cựu không được đề xuất cho ca mới dù còn dấu đủ điều kiện đào tạo. Chỉnh tay cũng kiểm ràng buộc; khi thiếu người, báo thiếu và lý do, không ép người không phù hợp vào ca để tạo lịch nhìn như đủ.
5. Sinh bản nháp, cho quản lý xem/chỉnh tay và chốt/công bố. Giữ sửa tay đã chốt khi tạo lại gợi ý; cách ghi đè phải rõ. Website soạn sẵn nội dung/link lịch để người phụ trách đăng Facebook; không tự gửi tin thật.

Tự đề xuất phân ca là chức năng cần có, không bị bỏ khỏi bản đầu chỉ vì có chỉnh tay. Thuật toán, tiêu chí công bằng và cách xử lý lịch không có nghiệm chỉ khóa sau khi có mẫu tổng hợp, số thành viên và mốc đầu/cuối thống nhất. Không hứa phần mềm bảo đảm người đến đúng giờ; cần xác nhận ca, check-in, cảnh báo thiếu và người thay thế.

Tuyển đã xác nhận: tiếp tục nhận đơn bằng Google Form. Ứng viên được đăng ký nhiều ban; nguyện vọng trên đơn tách khỏi ban được phân bổ sau khi đánh giá/tiếp nhận. Không ép một ứng viên thành nhiều hồ sơ chỉ vì chọn nhiều ban. Cách phân bổ một hay nhiều ban sau tuyển cần khớp mô hình tổ chức thực tế.

Những người được phân phỏng vấn chính tham gia chấm. Bộ tiêu chí đã có nhưng thay đổi theo năm; lưu theo đợt tuyển và phiên bản, không dùng bộ tiêu chí năm sau để âm thầm tính lại kết quả cũ. Lưu câu hỏi/câu trả lời, bài viết, tiêu chí/thang điểm/trọng số, nhận xét, người chấm và quyết định; quy tắc chấm riêng rồi hội đồng tổng kết được mô tả dưới đây.

Đã xác nhận cách chấm: người phỏng vấn chấm riêng trước; hội đồng tổng kết toàn bộ sau khi chấm riêng xong. Bài viết có phần chấm riêng và chấm chung; điểm có thể chỉnh sửa. Lưu rõ loại đánh giá (cá nhân/chung), nguồn bài/câu trả lời, người chấm, phiên bản tiêu chí, điểm trước/sau, lý do và thời điểm sửa. Không ghi đè điểm cá nhân bằng điểm chung làm mất nguồn gốc. Công thức tổng hợp/trọng số, thang điểm và người chốt quyết định cuối cần lấy từ rubric thực tế; chưa tự chọn trung bình cộng hoặc cộng hai loại điểm.

Đã yêu cầu tự đồng bộ đơn Form ngay sau khi gửi; import thủ công không thay thế chức năng đó. Cần ID nguồn theo Form/phản hồi, xác thực nguồn đẩy, chống trùng, retry và đối soát đơn bỏ sót; web hiển thị trạng thái/lần đồng bộ cuối. Danh sách đơn đang mở cần tự làm mới phù hợp, không chỉ nhận ở DB rồi bắt quản lý tải lại trang mới thấy đơn. Mục tiêu “ngay” là tự động sau khi gửi, còn ngưỡng trễ nghiệm thu phải đo/chốt qua prototype, không hứa đồng bộ không độ trễ. Đồng bộ lại dữ liệu đơn không được xóa đánh giá, ghi chú hoặc quyết định đã tạo trên web. Không mặc định ghi âm. Chuyển trúng tuyển thành thành viên một lần, giữ nguồn hồ sơ tuyển; phân công người chấm là nhiệm vụ vận hành, không tự hạn chế quyền quản lý chung của thành viên.

Quỹ hoạt động đã có nguồn hội phí khoảng 100.000 VND/thành viên, đóng một lần duy nhất. Lưu số phải đóng theo quy tắc được chốt và số tiền thực thu/ngày/phương thức/chứng từ; không tự đánh dấu đã đóng khi tạo thành viên hoặc tự thu lại theo năm/đổi ban. Mức “khoảng 100k” không phải lý do hard-code mọi giao dịch bằng 100k. Hoàn/miễn/điều chỉnh nếu có cần có quyết định và lịch sử.

Bán sách đã xác nhận: sách cho mượn là sách cũ, không đem bán; sách bán là sách mới hoàn toàn theo lô riêng của nhà sách. Theo dõi từng loại sách/cuốn bán và giá nhập/bán thực tế, không chỉ tổng thu buổi. Đề xuất quản lý hàng mới bằng đầu sách + lô + số lượng và đơn giá mỗi cuốn; chưa có yêu cầu gán serial riêng cho mọi cuốn mới. Hai nhóm có thể dùng chung thông tin thư mục nhưng tồn, giao dịch và nguồn tiền độc lập; không cho giao dịch bán trừ vào bản sách đang cho mượn.

Mỗi lô có nhà sách, đợt nhận, giá bìa, chiết khấu nhập, đơn giá sau chiết khấu, điều kiện thanh toán/cọc và cách quyết toán. Khi bán lưu chiết khấu bán và đơn giá thực tế của dòng bán. Cùng một đầu sách có thể có điều kiện theo lô/đợt khác; sửa giá/chiết khấu danh mục không đổi ngược chứng từ đã ghi. Không làm tròn giá bán theo quy tắc cọc 50k.

Ví dụ chủ sản phẩm đưa: giá bìa 100k, chiết khấu nhập 35% thì đơn giá nhập 65k; chiết khấu cho người mua 20% thì bán 80k; chênh lệch gộp 15k/cuốn trước vận chuyển/phí/chi khác. Phần mềm hiển thị giá bìa, giá sau chiết khấu và số tiền thực tế; không ghi giá bìa 100k như thể đã thu đủ 100k. Chưa tự diễn giải mọi thỏa thuận là mua đứt hay đại lý theo một mô hình pháp lý/kế toán duy nhất.

Đã chốt nhận sách trước, không cọc hoặc cọc một phần nhỏ; cuối đợt trả sách dư rồi thanh toán nhà sách. Chỉ CLB nợ nhà sách; không cho khách mua nợ. Không đặt trước, không có chính sách khách mua rồi đổi/hoàn tiền. Sách giữ lại bán lâu dài vẫn theo dõi theo lô và nghĩa vụ nhà sách; chưa tự kết luận phần giữ lại phải thanh toán ngay hay được tiếp tục nợ.

“Hoàn trả” là CLB trả hàng dư về nhà sách. Đã xác nhận: nhận 100 cuốn giá nhập 65k, bán 60 và trả 40 thì thanh toán 3.900.000 VND. Không cọc thì không có khoản tiền hoàn 2.600.000 VND; đó là giá trị 40 cuốn không phải thanh toán, không phải tiền thực nhận.

Nếu đã cọc nhà sách 1.000.000 VND, nhà sách hoàn cọc riêng 1.000.000 VND rồi CLB thanh toán riêng 3.900.000 VND. Hai giao dịch phải có xác nhận thực tế riêng, không ghi một khoản thanh toán ròng 2.900.000 VND thay thế. Nhận lại cọc không phải doanh thu; thanh toán không ghi chi phí hàng bán lần thứ hai. Nếu bán 60 cuốn với giá 80k, tiền bán là 4.800.000 VND và chênh lệch gộp trước chi phí khác là 900.000 VND. Quy tắc này không tự quyết nghĩa vụ đối với hàng giữ lại bán tiếp.

Luồng đề xuất: nhận lô; ghi cọc nhỏ nếu có và nghĩa vụ nhà sách theo thỏa thuận; bán và thu đủ tiền khách; kiểm kê cuối đợt; trả dư hoặc giữ bán tiếp; đối chiếu nhà sách/tiền đã cọc; quyết toán và thanh toán/nhận khoản hoàn thực tế. Chứng từ hàng và tiền liên kết, có thể ở thời điểm khác nhau; trả sách vật lý không tự chứng minh đã nhận tiền hoàn. Hàng giữ lại không tự thành hàng bán hoặc sách mượn. Công thức kiểm lượng cơ bản: nhận lô = đã bán + trả nhà sách + còn giữ; không đưa hàng đã trả vào lượng có thể bán. Đảo chứng từ ghi nhầm có audit là sửa sai dữ liệu, không tạo chức năng đổi trả khách trái phạm vi.

Sự kiện: một hoạt động có thể có nhiều sự kiện/đầu việc. Dự toán, chi thực tế và khoản tài trợ liên kết sổ tiền; tránh ghi chi ở cả module sự kiện và module quỹ thành hai khoản. Chưa yêu cầu khách đăng ký sự kiện trên web, chưa xây vé/đăng ký/sức chứa như chức năng bắt buộc. Câu trả lời về miễn phí/không giới hạn người được ghi cho truy cập và tài khoản nội dung công khai; không tự suy ra mọi sự kiện/bán sách đều miễn phí. Đã có ví dụ đêm sách và bán sách từ mô tả ban đầu; kế hoạch cụ thể, ngân sách/nhiệm vụ và nguồn chi thường gặp cần bổ sung. Tài liệu tham chiếu đã đọc là hướng dẫn ứng xử tại bàn sách.

Review: phân biệt thành viên mượn để viết, bài đang chuẩn bị và bài đã công bố. Cần xác nhận bài fanpage có bản trên website hay không; sao chép bài/ảnh cần quyền nội dung. Khách xem sách/nội dung không cần đăng ký; muốn đánh giá, nhận xét hoặc viết cảm nhận phải có tài khoản đăng ký miễn phí. Không đặt trần số tài khoản theo yêu cầu sản phẩm; rate limit chống spam vẫn cần phù hợp quota hạ tầng.

Nội dung khách gửi ở trạng thái chờ quản lý duyệt, chưa xuất hiện công khai. Người quản lý nội dung thực hiện nhiệm vụ duyệt trong quyền nghiệp vụ thành viên đã chốt, không tạo loại tài khoản thứ tư. Lưu quyết định duyệt/từ chối, người thực hiện và thời điểm. Đề xuất sửa nội dung đã duyệt tạo phiên bản chờ duyệt lại, tránh dùng quyền sửa để đưa nội dung mới chưa được kiểm duyệt lên web. Cách đăng nhập và xác minh “đã đọc” còn mở.

Thông báo/báo cáo đã xác nhận: lịch trực xem trên website; website soạn sẵn nội dung/link để người phụ trách sao chép và đăng nhóm Facebook. Không cần chức năng tự đăng, giữ trạng thái tạo nội dung và xác nhận đã đăng riêng. Báo cáo xuất cả Excel và PDF, dùng cùng bộ lọc/kỳ và nguồn dữ liệu; các chỉ số/mẫu chi tiết cần chốt thêm.

## 8. Quyền và dữ liệu nhạy cảm

Giữ ba loại người dùng sản phẩm: khách, thành viên và admin. Cựu thành viên là trạng thái của thành viên với quyền chỉ xem. Thành viên đang hoạt động quản lý mọi mục nghiệp vụ, không chia theo ban/chức vụ. Admin quản lý thêm tài khoản và nhật ký toàn hệ thống.

Khách có thể đăng nhập Google hoặc email/mật khẩu. Tài khoản nội bộ do admin cấp, bắt buộc tên đăng nhập riêng + mật khẩu, kể cả cựu thành viên; email liên hệ không phải tên đăng nhập nội bộ. Không tự tạo quyền nội bộ từ đăng ký khách, trùng email hoặc đăng nhập Google; cần kiểm phương thức phiên đăng nhập và danh tính được cấp phía máy chủ, không chỉ tách hai trang login.

- Khách ẩn danh: nội dung đã xuất bản, trạng thái khả dụng ở mức công khai; không thấy người đang mượn.
- Người có tài khoản khách đăng ký miễn phí: gửi đánh giá/nhận xét/cảm nhận vào hàng chờ duyệt; không tự có quyền nội bộ.
- Thành viên đang hoạt động: quản lý sách, mượn–trả, tiền, thành viên, trực, tuyển, hoạt động/sự kiện, nội dung và báo cáo; dữ liệu nghiệp vụ gồm điện thoại/hồ sơ tuyển phục vụ các mục đó. Không tự cấp quyền admin, sửa loại tài khoản hoặc truy cập nhật ký toàn hệ thống.
- Cựu thành viên: giữ tài khoản nội bộ chỉ xem hoạt động CLB, không xem dữ liệu cá nhân nhạy cảm, hồ sơ tuyển/người mượn, tiền/số tài khoản; không xuất Excel/PDF, không thêm/sửa/xóa hoặc gọi chức năng ghi. Không coi cựu là khách chỉ vì không có quyền ghi, cũng không mặc định khóa tài khoản khi tốt nghiệp.
- Admin: có các quyền nghiệp vụ của thành viên, quản lý tài khoản/vai trò và xem nhật ký toàn hệ thống. Không được sửa âm thầm sổ đã ghi hoặc xóa dấu vết audit.

Phân công người trực/người phỏng vấn/người phụ trách quỹ vẫn được lưu để tổ chức và truy trách nhiệm, không trở thành rào cản quyền nghiệp vụ của thành viên đang hoạt động. API chặn khách truy cập nội bộ, cựu gọi chức năng ghi và thành viên thường gọi quản trị tài khoản/audit; tài khoản bị khóa bị chặn theo chính sách riêng. Quyền của thành viên hoạt động vẫn rộng như chủ sản phẩm chọn; không tự chuyển thành mô hình chia quyền theo ban.

Chủ sản phẩm đứng tên tài khoản hạ tầng, giữ backup và nhận cảnh báo. Đổi ban chủ nhiệm không tự chuyển quyền nhà cung cấp, backup hoặc khóa khôi phục cho ban mới. Người quản lý trong web và chủ tài khoản hạ tầng có trách nhiệm/phạm vi khác nhau; chi tiết recovery và người dự phòng cần quy trình vận hành.

Cần xác nhận “minh bạch” là minh bạch trong CLB hay công khai Internet. Đề xuất công khai báo cáo tổng hợp được duyệt; dữ liệu người mượn, số điện thoại, phiếu tiền và hồ sơ tuyển luôn riêng tư.

## 9. Dữ liệu ban đầu và điều kiện chốt đặc tả

Nguồn dữ liệu cũ đã xác nhận: sổ giấy và Excel. Cần đối chiếu khi cùng phiếu xuất hiện ở cả hai nguồn, tránh nhập hai lần. Kiểm kê số bản sách, số dư tiền và cọc đang giữ, phiếu chưa trả, thành viên đang hoạt động trước ngày chuyển đổi. Import có bản xem trước, validation, báo lỗi, chống trùng và báo cáo đối soát; không nhập “số dư đầu” rồi cộng lại lịch sử đã bao gồm số dư đó. Không mặc định OCR hoặc nhập lại toàn bộ sổ lịch sử; cần chọn phạm vi lịch sử và số dư mở đầu.

Đã chốt các luồng chính mượn–trả/quỹ/trực/tuyển/nội dung/báo cáo. Bán lô nhận trước, chỉ cọc nhỏ hoặc không cọc, cuối đợt trả dư/quyết toán; CLB nợ nhà sách, khách trả ngay và không đổi/hoàn. Hoàn cọc nhà sách và thanh toán là hai giao dịch riêng theo ví dụ đã xác nhận. Khách Google/email, nội bộ tên đăng nhập riêng + mật khẩu được cấp; cựu chỉ xem hoạt động, không dữ liệu nhạy cảm/tiền/xuất file; chủ sản phẩm giữ hạ tầng/backup/cảnh báo. Còn trường công bố tuyển, rubric/mẫu báo cáo, nghĩa vụ hàng giữ lại và ngoại lệ. [Nguồn CLB](07-doi-chieu-tai-lieu-clb.md) được đối chiếu theo phạm vi đã đọc, không thay quyết định mới. Đặc tả cần bổ sung từ điển dữ liệu, bảng trạng thái, API và ví dụ nghiệm thu sau khi chốt; ma trận quyền đã có bản dự thảo riêng.
