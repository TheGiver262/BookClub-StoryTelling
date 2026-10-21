# Phỏng vấn và sổ quyết định

## Quyết định bổ sung 20–21/10/2026

Các mã D01–D61 bên dưới giữ nguyên để truy vết. Bổ sung hiện hành, không đánh lại mã cũ:

| Mã | Trạng thái | Nội dung |
|---|---|---|
| S21-01 | Đã chốt | Công khai/nội bộ tách quyền; landing cuốn sách; `/sach/` sáu tab, 50 đầu sách/trang. |
| S21-02 | Đã chốt | Đặt không tài khoản/OTP, CAPTCHA, một quyển/đơn, giữ hết buổi trực đã chọn. |
| S21-03 | Đã chốt | Ba đơn/IP/24 giờ; hủy/hết hạn/trả không hoàn IP. Ba suất giữ/mượn chưa trả/SĐT; trả một mở một suất. |
| S21-04 | Đã chốt | Bản giữ không giao được: cảnh báo nội bộ, gọi/xử lý thủ công; chưa email/SMS. |
| S21-05 | Đã chốt | Local Docker trước, beta Supabase + Cloudflare Free sau; chưa deploy. |
| S21-06 | Đã chốt | Chỉ ADMIN xuất bản sách/ảnh/tóm tắt/lịch/nghỉ/sự kiện/tuyển. |
| S21-07 | Đã chốt | CTV một tháng lịch, quyền MEMBER; quản lý đánh giá đạt mới công nhận, chỉ quản lý xóa mềm CTV; thành viên chính thức rời chuyển cựu. |
| S21-08 | Đã chốt | Tên đầy đủ Hà Nội, thành lập 16/09/2013, slogan “Mở sách, đọc tương lai”; màu giữ nguyên, UI mềm vintage áp dụng công khai và nội bộ. |
| S21-09 | Đang thảo luận | “Sách của tôi”, tài khoản bạn đọc tùy chọn, khôi phục/email, đổi sách nguyên tử và xem lại chính sách IP. Chưa phê duyệt implementation. |

[Tóm tắt hiện hành](CURRENT-STATE.md), [chi tiết nghiệp vụ giữ chỗ](technical/public-reservation-design.md), [CTV/publishing](technical/public-portal-publishing.md), [nguồn nghiên cứu UX](technical/public-reservation-ux-research-2026-10-21.md). Tài khoản khách cho review đã bàn trước không tự cấp quyền quản lý toàn bộ đơn theo SĐT.

Ngày 18/10/2026. Nguồn xác nhận: câu trả lời trực tiếp của chủ sản phẩm trong chat. Tài liệu ghi quy tắc mới nhất; diễn giải chưa chắc chắn được đánh dấu rõ. Không yêu cầu gửi dữ liệu người thật trong chat để khảo sát.

## 1. Quyết định đã xác nhận

| Mã | Quyết định | Ảnh hưởng |
|---|---|---|
| D01 | Chỉ CLB Sách Bách Khoa; sau này có thể bán bản riêng cho CLB khác | Không xây multi-tenant hiện tại; giữ khả năng cấu hình/triển khai tách biệt |
| D02 | Bản đưa vào dùng đầu phải đầy đủ cả chín nhóm chức năng | Chia mốc xây/UAT; không phát hành bản thiếu module |
| D03 | Điện thoại và laptop, mạng ổn định | Web responsive; chưa yêu cầu ghi tiền offline |
| D04 | Phần mềm miễn phí cho CLB; chi phí DB/server phát sinh do CLB chi trả | Thử gói miễn phí, có cảnh báo/đề xuất chi phí trước khi nâng |
| D05 | Tối đa hai quyển trên một phiếu | Validation phía máy chủ; chưa có giới hạn tổng qua nhiều phiếu |
| D06 | Cọc từng quyển, bội 50k gần nhất, mốc giữa lên, tối thiểu 50k; 230k cọc 250k | Thay quy tắc làm tròn lên trong mô tả ban đầu |
| D07 | Trả một phần thì tất toán phiếu cũ, lập phiếu mới cho sách chưa trả | Cần liên kết chuyển tiếp và phân biệt trả vật lý với chuyển giấy tờ |
| D08 | Phiếu chuyển tiếp bắt đầu lại 14 ngày, số lần gia hạn về 0 | Theo dõi cả vòng phiếu mới và thời gian giữ vật lý xuyên phiếu |
| D09 | Mất sách mất cọc, không thu vượt cọc theo ví dụ đã làm rõ | Xử lý cùng bản sách, phân bổ cọc và chứng từ |
| D10 | Phạt thấp hơn cọc: hoàn cọc và thu phạt riêng; phạt đạt/vượt cọc: giữ cọc, không thu thêm | So với cọc, không so giá sách; cần ca kiểm thử đúng bằng cọc |
| D11 | Phạt 1k/ngày trên cả phiếu, hai cuốn quá hạn ba ngày chỉ 3k | Không nhân khoản phạt theo số dòng sách |
| D12 | Hạn đến hết ngày, trực thứ Ba/thứ Năm; nghỉ lễ/Tết thì dời tới buổi trực thực tế kế tiếp | Lịch định kỳ có ngoại lệ, hạn gốc/hạn hiệu lực; không phạt phần dời do lịch nghỉ |
| D13 | Tiền phạt có thể giảm/miễn về 0 vì lý do đặc biệt | Lưu mức gợi ý, mức chốt, lý do và người thực hiện; cọc/tiền thực tế vẫn đối soát chính xác |
| D14 | Vài nghìn sách dưới 5.000; hai kho ở thư viện và văn phòng Hội Sinh viên; dưới 100 lượt/buổi; 3–5 người ghi cùng lúc | Cơ sở kiểm thử tải; chưa rõ tách số đầu/bản và tổng thành viên |
| D15 | Bốn ban: Hậu cần, Nội dung, Truyền thông đối ngoại, Ban chủ nhiệm | Ban chủ nhiệm gồm chủ nhiệm, phó chủ nhiệm, trưởng/phó các ban chức năng; không đếm trùng một người |
| D16 | Mọi thành viên quản lý mọi mục nghiệp vụ; admin quản lý thêm tài khoản và nhật ký toàn hệ thống | Thay đề xuất chia quyền theo nhiệm vụ; ban/chức vụ không tự thành vai trò quyền |
| D17 | Dữ liệu cũ ở sổ giấy và Excel | Đối chiếu hai nguồn, chống nhập trùng; cần chốt phạm vi chuyển lịch sử |
| D18 | Thời hạn mượn 14 ngày như mô tả ban đầu | Đã giải quyết khác biệt với ví dụ “tuần sau”; hạn đến hết ngày sau hai tuần |
| D19 | Phiếu hai cuốn cọc 50k + 100k, phạt 60k thì hoàn 150k và thu riêng 60k | Phạt trên cả phiếu; không áp trần cọc của một cuốn cho trường hợp này |
| D20 | Khi trả một phần và lập phiếu mới, chốt ngay tiền phạt phiếu cũ | Không chuyển phạt cũ sang để thu lần nữa trên phiếu mới |
| D21 | Nhận cọc, hoàn cọc và thu phạt bằng tiền mặt hoặc chuyển khoản qua tài khoản riêng của CLB | Tách đối soát hộp tiền và ngân hàng; chưa mặc định đồng bộ ngân hàng |
| D22 | Cọc mượn–trả tách riêng quỹ hoạt động khác; cả hai đều được theo dõi riêng | Quỹ nghiệp vụ và nơi giữ tiền là hai chiều độc lập; không tự bù/chuyển giữa quỹ |
| D23 | Tiền mặt mượn–trả sau buổi được để trong tủ sách khóa lại cho buổi sau | Số cuối buổi chuyển sang buổi sau, cất tiền không phải chi hoặc doanh thu mới |
| D24 | Người trực chính kiểm/xác nhận đầu và cuối; bàn sách dùng chung một hộp tiền, không đổi người giữ giữa buổi | Nhiều người ghi chung một phiên quầy; không nhân số dư đầu theo số người nhập |
| D25 | Tiền mặt/chuyển khoản có thể thay cho nhau khi nhận và hoàn; thành viên bắt buộc kiểm app ngân hàng | Lưu độc lập phương thức thu/chi và xác nhận thực tế; không sửa giao dịch cũ để ép cùng phương thức |
| D26 | Có thể đặt mã QR gắn loa ở bàn hỗ trợ nhận tiền | Thiết bị hỗ trợ dự kiến, chưa là yêu cầu web đồng bộ hoặc tự xác nhận ngân hàng |
| D27 | Buổi trực 14:00–17:00 tại một địa điểm với nhiều bàn ghép | Một buổi/địa điểm, không tạo nhiều điểm trực từ số bàn |
| D28 | Tối thiểu hai người trực chính; 3–5 hỗ trợ phải có mặt đầu/cuối, không bắt buộc ở giữa | Xếp lịch theo khoảng có mặt của từng vai trò; thời lượng đầu/cuối và điều kiện người chính bổ sung ở D30–D31 |
| D29 | Quản lý tổng hợp Excel lịch học rồi upload; phần mềm tự đề xuất phân ca và hỗ trợ phân/chỉnh tay; lịch chốt báo CLB | Import/kiểm dữ liệu, đề xuất, chỉnh tay và công bố đều trong bản đầu; mẫu Excel còn mở, kênh báo chốt ở D43 |
| D30 | Cả người chính và hỗ trợ có mặt ít nhất 15 phút đầu/cuối để chuẩn bị/thu dọn; hai người chính cùng đủ 14:00–17:00 | Tạm quy đổi đầu 13:45–14:00, cuối 17:00–17:15; mốc thu dọn là diễn giải cần khớp khi khóa lịch |
| D31 | Thành viên mới làm hỗ trợ để đào tạo trước, sau đó mới làm chính | Trạng thái đủ điều kiện áp dụng cả đề xuất lẫn chỉnh tay; không tự đủ chỉ vì đã hỗ trợ một lần |
| D32 | Hậu cần thu thập/phân loại lịch các trường, giao một file tổng hợp cùng mẫu đơn giản/đầy đủ | Website không tổng hợp nhiều mẫu; hợp đồng cột khóa khi có mẫu tổng hợp |
| D33 | Giữ Google Form, ứng viên được đăng ký nhiều ban rồi sắp xếp ban phù hợp sau | Một hồ sơ có nhiều nguyện vọng; tách nguyện vọng và ban phân bổ |
| D34 | Người được phân phỏng vấn chính tham gia chấm; đã có tiêu chí và thay đổi theo từng năm | Giữ người chấm và phiên bản tiêu chí theo đợt; công thức tổng hợp cụ thể cần rubric |
| D35 | Đơn Google Form mới phải tự xuất hiện trên web sau khi gửi | Đồng bộ tự động là yêu cầu bản đầu, có chống trùng/retry/đối soát; trễ cần đo/chốt |
| D36 | Chấm riêng trước, hội đồng tổng kết sau; bài viết chấm cả riêng/chung, điểm được sửa | Lưu nguồn đánh giá và lịch sử sửa, không đóng băng điểm trái yêu cầu hoặc ghi đè mất nguồn |
| D37 | Hội phí hoạt động khoảng 100k/thành viên, đóng một lần duy nhất | Ghi thực thu và chống tự thu lại theo năm/đổi ban |
| D38 | Khách xem không cần tài khoản; đăng ký miễn phí để đánh giá/nhận xét/cảm nhận, quản lý duyệt mới công khai | Tài khoản khách và thành viên CLB tách biệt; không tự công bố bài/đánh giá chưa duyệt |
| D39 | Tiền bán sách theo từng cuốn, có đủ giá nhập và giá bán | Cần chi tiết bán/hàng/tiền, không chỉ tổng thu; kho/lô bán tách kho mượn đã được chốt ở D44 |
| D40 | Lịch xem trên website và thông báo lên nhóm Facebook; báo cáo cả Excel/PDF | Hai định dạng cùng nguồn; cách người phụ trách đăng nhóm đã chốt ở D43 |
| D41 | Chủ sản phẩm cung cấp tài liệu “Quy tắc ứng xử với bạn đọc” | Đã đọc qua Drive; [đối chiếu nguồn cũ](07-doi-chieu-tai-lieu-clb.md) riêng, không tự áp quy tắc cọc/ví cá nhân khác chat |
| D42 | Sách không có giá mặc định cọc 50k | Thay yêu cầu ước lượng ban đầu; giá vẫn chưa biết, không gán giá bìa giả |
| D43 | Website soạn sẵn nội dung/link để người phụ trách đăng Facebook | Không cần tự đăng/API; tạo nội dung và xác nhận đã đăng là hai trạng thái |
| D44 | Sách mượn là sách cũ, không bán; sách bán mới hoàn toàn theo lô riêng | Tồn/giao dịch bán tách sách mượn, có thể dùng chung thư mục nhưng không nguồn lượng |
| D45 | Ví dụ giá bìa 100k, chiết khấu nhập 35%, bán 20% | Giá nhập 65k, bán 80k, chênh lệch gộp 15k trước chi phí khác; lưu điều kiện theo lô/dòng |
| D46 | Cuối đợt trả sách dư nhà sách, nhận lại cọc hoặc giữ lại bán lâu dài; không đặt trước | Theo dõi trả hàng/giữ lại và tiền cọc/quyết toán riêng, không coi trả vật lý là đã hoàn tiền |
| D47 | Hoạt động bán có ghi nợ | Chỉ CLB nợ nhà sách, nhận trước/cọc nhỏ hoặc không cọc; ví dụ quyết toán đã chốt ở D56 |
| D48 | Nhận sách trước, không cọc hoặc cọc nhỏ; cuối đợt trả dư và thanh toán; tiền xử lý theo số cuốn trả | Tách hàng trả, giảm số phải thanh toán và tiền hoàn thật; không đếm hai lần, áp ví dụ D56 |
| D49 | Khách không được mua nợ; đã bán không đổi/hoàn tiền; chỉ trả hàng dư về nhà sách | Không thêm công nợ khách hoặc chức năng đổi trả sau mua; đảo chứng từ ghi sai là quy trình khác |
| D50 | Khách Google hoặc email/mật khẩu; thành viên dùng tài khoản mật khẩu được quản lý cấp riêng | Không cho Google/đăng ký khách tự thành tài khoản nội bộ; username riêng được chốt ở D54 |
| D51 | Chủ sản phẩm đứng tên hạ tầng, giữ backup và nhận cảnh báo | Không tự chuyển theo ban chủ nhiệm; cần quy trình recovery/đầu mối dự phòng |
| D52 | Cựu thành viên gồm người ra CLB/tốt nghiệp, vẫn đăng nhập tài khoản thành viên nhưng chỉ xem | Tách khỏi tài khoản bị khóa; mất mutation ở API/phiên đang mở, không xếp ca mới; phạm vi đọc/xuất chốt ở D55 |
| D53 | Cung cấp bảng “KẾ HOẠCH TUYỂN GEN 9” | Đã đọc metadata và ba vùng đầu; [ghi phạm vi tham khảo](07-doi-chieu-tai-lieu-clb.md), không suy rubric đầy đủ hoặc dùng lịch 2021 làm lịch mới |
| D54 | Nội bộ dùng tên đăng nhập riêng + mật khẩu, không dùng email làm tên đăng nhập | Admin cấp; chứng minh managed Auth/ánh xạ định danh và cách ly khách Google trước chọn stack |
| D55 | Cựu chỉ xem hoạt động CLB; không PII nhạy cảm như địa chỉ/điện thoại, tài chính/số tài khoản và không xuất Excel/PDF | API đọc hoạt động dùng whitelist trường; chặn bảng nghiệp vụ/file nhạy cảm, áp dụng cả phiên đang mở |
| D56 | Lô 100 giá nhập 65k, bán 60/trả 40 thì thanh toán 3,9 triệu; không cọc không nhận hoàn 2,6 triệu. Nếu cọc 1 triệu, hoàn cọc riêng rồi thanh toán riêng 3,9 triệu | Hai dòng tiền thực tế riêng, không thanh toán ròng 2,9 triệu hoặc ghi khoản hoàn không tồn tại |
| D57 | Gia hạn trong hạn cộng thêm 14 ngày vào hạn trả hiện tại; hạn 14/10 gia hạn sớm hay đúng hạn đều sang 28/10 | Không làm mất ngày đọc còn lại; ngày mượn ra hạn đầu tính đúng cộng 14 theo D61 |
| D58 | Quá hạn vẫn được gia hạn sau khi chốt phạt; hạn mới tính từ ngày gia hạn | Không thu lại phạt đã tất toán; giới hạn ba lần không tự reset khi vẫn cùng phiếu |
| D59 | Phiếu cọc 150k, phạt đạt 150k, trả cuốn cọc 50k/giữ cuốn cọc 100k: giữ 150k phạt và thu mới 100k cọc | Không chuyển lại khoản cọc đã bị dùng hết; thu tiền thực mới 100k, không ghi nhận thu lại 150k cũ |
| D60 | Mục tiêu khoảng một tháng cho MVP; chủ sản phẩm tự phát triển/bảo trì, AI code chính; chọn stack theo độ phù hợp/hiệu năng | Giữ yêu cầu đủ chín nhóm của D02; lịch 30 ngày là mục tiêu có cổng chất lượng, không mặc định AI bảo đảm hoàn thành hoặc bỏ kiểm thử |
| D61 | Cộng đúng 14 ngày lịch: mượn 1/10 → hạn 15/10; gia hạn trong hạn → 29/10 | Thay ví dụ nhầm 1/10 → 14/10; hạn đến hết ngày Việt Nam, sau đó áp điều chỉnh lịch nghỉ |

Điểm triển khai đề xuất cho D07: phiếu mới vẫn có theo quy trình CLB, nhưng chỉ cuốn thực trả mới ghi nhận trở về kho; cọc của cuốn tiếp tục giữ được chuyển liên kết, không tạo thu–chi tiền mặt giả. Cần xác nhận thao tác thực tế nếu CLB thực sự giao nhận lại tiền khi đổi phiếu.

## 2. Tình trạng câu hỏi và vòng đang hỏi

| Mã | Câu hỏi | Vì sao cần | Trạng thái |
|---|---|---|---|
| Q01 | Hai cuốn cùng quá hạn ba ngày phạt tổng 3k hay 6k? | Chốt đơn vị phạt | Đã trả lời: 3k/phiếu |
| Q02 | Hạn hết ngày hay đúng giờ; lịch nghỉ ảnh hưởng thế nào? | Tránh tính sai ngày và tranh chấp | Đã rõ hết ngày và dời hạn vì lễ/Tết; một số ngoại lệ hủy buổi còn cần chốt |
| Q03 | Số đầu/bản/kho/thành viên/ban, lượt mỗi buổi và người cùng ghi? | Thiết kế nhập nhanh, benchmark và ước lượng | Đã có quy mô sơ bộ/kho/ban/lượt/đồng thời; còn tổng thành viên và tách đầu/bản |
| Q04 | Dữ liệu cũ là giấy/Excel/Google Sheets? | Lập kế hoạch nhập và đối soát số dư/cọc | Đã trả lời: sổ giấy và Excel |
| Q05 | Quyền theo nhiệm vụ hay mọi thành viên quản lý mọi mục? | Chốt ma trận quyền | Đã trả lời: mọi thành viên quản lý nghiệp vụ; admin quản lý thêm tài khoản/nhật ký |
| Q06 | Thời hạn đầu 14 ngày hay 7 ngày như ví dụ thứ Ba tuần sau? | Tránh tự thay quy tắc hạn và gia hạn/chuyển tiếp | Đã trả lời: 14 ngày |
| Q07 | Phiếu cọc 50k + 100k, phạt gợi ý 60k thì xử lý tiền thế nào? | Chốt ví dụ phạt chung trên hai khoản cọc | Đã trả lời: hoàn 150k, thu 60k |
| Q08 | Khi trả một cuốn rồi chuyển tiếp cuốn còn giữ, phạt phiếu cũ chốt ngay hay chuyển theo? | Tránh mất/thu trùng khoản phạt và chuyển sai cọc | Đã trả lời: chốt ngay phiếu cũ |
| Q09 | Nhận cọc, hoàn cọc, thu phạt bằng tiền mặt/chuyển khoản; tài khoản CLB hay cá nhân? | Tách số dư quầy và tài khoản, xác nhận tiền thực tế | Đã trả lời: cả hai, tài khoản riêng CLB |
| Q10 | Ai giữ cọc giữa các buổi; giữ chung hay riêng quỹ hoạt động? | Chốt nguồn tiền, trách nhiệm và bàn giao | Đã trả lời: tiền cất trong tủ khóa; tách quỹ mượn–trả với quỹ hoạt động |
| Q11 | Ai kiểm đầu/cuối; 3–5 người dùng chung hộp tiền hay giữ riêng; có đổi người giữ giữa buổi? | Thiết kế phiên quầy, đối soát và tránh đếm trùng tiền đầu ca | Đã trả lời: người trực chính, một hộp chung, không đổi người giữ giữa buổi |
| Q12 | Xác nhận chuyển khoản bằng người kiểm app/mã giao dịch hay bắt buộc tự động; có hoàn khác phương thức lúc cọc không? | Chốt tích hợp và dòng tiền thực tế | Đã trả lời: kiểm app bắt buộc, được hoàn khác phương thức; QR/loa có thể hỗ trợ, chưa yêu cầu đồng bộ web |
| Q13 | Giờ trực, số bàn, số người chính/hỗ trợ tối thiểu và điều kiện người trực chính? | Xác định cấu trúc ca và ràng buộc xếp lịch | Đã rõ 14:00–17:00/một điểm/hai người chính/3–5 hỗ trợ đầu–cuối; điều kiện người chính chuyển Q15 |
| Q14 | Thành viên đăng ký ca rảnh, nộp lịch bận để xếp hay hỗ trợ cả hai? | Chốt luồng đăng ký/gợi ý/duyệt ca | Đã trả lời: tổng hợp Excel lịch học, tự đề xuất và phân/chỉnh tay; lịch chốt báo CLB |
| Q15 | Giờ chuẩn bị/thu dọn; hai người chính đủ ba giờ; người mới cần hướng dẫn? | Khóa khoảng bắt buộc và điều kiện xếp vai trò | Đã trả lời: ít nhất 15 phút đầu/cuối cho cả hai vai trò, hai chính cùng đủ 14–17, người mới đào tạo qua hỗ trợ trước; mốc thu dọn tạm quy đổi ghi ở D30 |
| Q16 | Nguồn/cấu trúc Excel lịch học và lịch bận? | Thiết kế phạm vi import | Đã rõ chỉ nhận một mẫu tổng hợp đầy đủ do hậu cần chuẩn bị; chi tiết cột khóa lúc có mẫu, không yêu cầu website gộp từng trường |
| Q17 | Nguồn đơn, số nguyện vọng, người chấm, rubric hiện có? | Chốt workflow tuyển | Đã trả lời: giữ Form, nhiều ban, người phỏng vấn chính chấm, tiêu chí thay đổi mỗi năm |
| Q18 | Sync Form hay import; chấm riêng hay phiếu hội đồng? | Chốt tích hợp và mô hình đánh giá | Đã trả lời: tự đồng bộ, chấm riêng rồi hội đồng tổng kết; bài viết chấm riêng/chung, điểm được sửa |
| Q19 | Nguồn thu/chi, sự kiện; tài khoản khách; bán sách theo cuốn hay tổng? | Chốt phạm vi quỹ/sự kiện và bán sách | Đã rõ hội phí một lần, bán từng cuốn/giá nhập–bán, tài khoản nội dung khách miễn phí/chờ duyệt; danh sách sự kiện/nguồn chi còn thiếu |
| Q20 | Kênh báo lịch và định dạng báo cáo? | Chốt thông báo/đầu ra | Đã trả lời: website và nhóm Facebook, cả Excel/PDF; cách đăng và mẫu/chỉ số đang bổ sung |
| Q21 | Sách không có giá mặc định cọc 50k hay ước lượng? | Chốt khác biệt nguồn | Đã trả lời: mặc định cọc 50k |
| Q22 | Facebook dùng nội dung soạn sẵn để người phụ trách đăng hay tự đăng? | Chốt phương án | Đã trả lời: người phụ trách đăng nội dung/link soạn sẵn |
| Q23 | Kho/lô bán và quy tắc giá/công nợ/đặt trước/hoàn hàng? | Chốt ranh giới hàng và chứng từ | Đã rõ sách mới/lô bán riêng, chiết khấu nhập/bán, có nợ, không đặt trước, trả dư/giữ tiếp và cọc nhà sách; dòng tiền/loại nợ chuyển Q24–Q25 |
| Q24 | Dòng tiền nhận lô/cọc/thanh toán và hoàn khi trả dư? | Khóa thỏa thuận/quyết toán | Đã rõ nhận trước, không cọc/cọc nhỏ, cuối đợt trả dư/thanh toán, hoàn theo số cuốn; ví dụ giảm nợ/đối trừ chuyển Q29 |
| Q25 | Phía công nợ và đổi trả? | Khóa loại nợ/phạm vi | Đã trả lời: chỉ CLB nợ nhà sách; khách không nợ và không đổi/hoàn sau mua |
| Q26 | Đăng nhập khách/nội bộ, trường công bố tuyển và người giữ hạ tầng? | Khóa danh tính/riêng tư/vận hành | Đã rõ khách cả hai, nội bộ mật khẩu được cấp, chủ sản phẩm giữ hạ tầng/backup/cảnh báo; trường công bố tuyển chưa trả lời |
| Q27 | Nội bộ dùng tên đăng nhập riêng + mật khẩu hay email được cấp + mật khẩu? | Chọn Auth/namespace định danh tách khách | Đã trả lời: tên đăng nhập riêng + mật khẩu |
| Q28 | Cựu đọc toàn bộ nghiệp vụ kể cả PII/quỹ/điểm hay có giới hạn; có xuất Excel/PDF không? | Khóa read scope và xuất dữ liệu | Đã trả lời: chỉ hoạt động CLB; không PII nhạy cảm/tiền/số tài khoản, không xuất Excel/PDF |
| Q29 | Không cọc: bán 60/trả 40 từ lô 100 giá nhập 65k thì trả 3,9 triệu, không nhận 2,6 triệu tiền thật; cọc 1 triệu đối trừ hay hoàn riêng? | Khóa ví dụ quyết toán tránh hoàn tiền/giảm nợ trùng | Đã trả lời: đúng 3,9 triệu, không hoàn 2,6 triệu; cọc 1 triệu hoàn riêng rồi thanh toán riêng |
| Q30 | Gia hạn từ hạn hiện tại hay ngày yêu cầu; có gia hạn khi quá hạn và xử lý phạt cũ thế nào? | Khóa phép tính ngày và nghĩa vụ phạt | Đã trả lời: trong hạn cộng hạn cũ; quá hạn chốt phạt rồi tính từ ngày gia hạn; cách đếm hạn đầu chuyển Q33 |
| Q31 | Phiếu cọc 150k, phạt đạt 150k, trả cuốn cọc 50k và giữ cuốn cọc 100k thì thu cọc mới hay giảm phạt? | Không tạo cọc chuyển tiếp sau khi đã dùng hết cọc cũ | Đã trả lời: giữ 150k phạt, thu mới 100k cọc cho phiếu mới |
| Q32 | Hạn bắt đầu dùng thử, người phát triển/bảo trì và công nghệ quen? | Chọn stack có thể bảo trì và lịch thực tế | Đã trả lời: mục tiêu một tháng, tự làm với AI code chính, chọn stack theo phù hợp/hiệu năng |
| Q33 | Hạn đầu mượn 1/10 là 15/10 theo cộng đúng 14 ngày hay 14/10 khi đếm ngày mượn là ngày thứ nhất? | Giải quyết lệch một ngày giữa ví dụ mới và quy tắc cùng thứ sau hai tuần | Đã trả lời: cộng đúng 14 ngày lịch, hạn 15/10 rồi gia hạn 29/10 |

## 3. Các vòng tiếp theo

Không hỏi tất cả cùng lúc. Mỗi vòng ưu tiên vài câu có thể làm thay đổi thiết kế; cập nhật tài liệu ngay khi có câu trả lời.

### Vòng mượn–trả và tiền

- Có cho một người có nhiều phiếu đang mở không? Thành viên CLB mượn viết review có cọc/phạt như khách không?
- Đã chốt gia hạn trong hạn cộng hạn cũ; quá hạn chốt phạt rồi tính từ ngày gia hạn; cộng đúng 14 ngày lịch. Còn ai yêu cầu/duyệt và quy trình nhắc liên quan.
- Đã chốt phạt phiếu cũ ngay khi chuyển tiếp; nếu giữ hết 150k để phạt thì thu mới 100k cọc cuốn còn giữ. Còn xác nhận thao tác tiền ở trường hợp cọc chưa bị dùng: thực sự hoàn/thu lại hay chỉ chuyển sổ, không tạo dòng tiền giả.
- Sách hỏng, tìm lại sách đã mất và người nhận hoàn thay có quy trình nào? Đã xác nhận có thể miễn phạt; cần quy ước ghi lý do và sửa quyết định sau khi đã thu.
- Đã chốt sách không giá cọc mặc định 50k; không cần thiết kế quy trình ước lượng theo độ dày.
- Đã rõ phương thức thanh toán, hoàn khác phương thức, kiểm app ngân hàng và cách kiểm đầu/cuối. Còn xử lý thiếu/thừa, trả tiền ở ca khác, phân bổ số dư ngân hàng giữa hai quỹ và quỹ nhận tiền phạt/giữ cọc.
- Bao lâu trước hạn gọi nhắc; ai gọi, gọi lại khi không liên lạc được; có cần ghi lịch sử lời hẹn?

### Vòng thành viên và trực sách

- Bốn ban và thành phần Ban chủ nhiệm đã rõ; cựu chỉ xem hoạt động, không PII nhạy cảm/tiền/xuất file. Còn tổng thành viên, số phó theo ban, nhiệm kỳ/thử việc/tạm nghỉ và việc thuộc nhiều ban chức năng.
- “Năm mấy” tính tự động theo khóa hay tự cập nhật do nghỉ/bảo lưu? Có thành viên ngoài trường/đã tốt nghiệp không?
- Đã rõ hai người chính cùng đủ 14–17, cả hai vai trò có 15 phút đầu/cuối và người mới đào tạo qua hỗ trợ. Còn mốc thu dọn chính xác, vai trò ai có thể kiêm nhiệm, ai trong hai người chính phụ trách kiểm tiền và ai xác nhận hoàn tất đào tạo.
- Đã rõ website nhận một Excel tổng hợp đầy đủ, không làm khâu gom mẫu trường; hợp đồng cột chốt lúc có mẫu. Còn thay đổi học kỳ và xử lý cập nhật sau công bố.
- Đã rõ import Excel/tự đề xuất/chỉnh tay/công bố, xem lịch web và người phụ trách đăng nội dung soạn sẵn lên Facebook. Còn tiêu chí công bằng, ưu tiên người mới/cũ và đổi ca.
- Xác nhận có mặt bằng trưởng ca, mã ca hay phương thức nào? Thế nào là muộn, vắng, thiếu người và người thay?

### Vòng tuyển thành viên

- Đã rõ tự đồng bộ Form/nhiều nguyện vọng, chấm riêng rồi hội đồng tổng kết, điểm bài viết riêng/chung được sửa, rubric theo năm. Còn thang điểm/trọng số/công thức thực tế và xử lý bất đồng; phân công chấm không tự chia lại quyền nghiệp vụ đã chọn.
- Phỏng vấn có lịch/phòng/hội đồng, bài viết tại chỗ và câu hỏi ngẫu nhiên không? Lưu văn bản hay file, không mặc định ghi âm.
- Ai duyệt/công bố kết quả, hiện họ tên đầy đủ hay mã ứng viên; giữ danh sách cũ bao lâu?
- Ứng viên rớt và hồ sơ phỏng vấn giữ bao lâu; chuyển trúng tuyển sang thành viên có giai đoạn thử việc không?

### Vòng hoạt động, sự kiện và báo cáo

- “Hoạt động” là kế hoạch năm hay mọi đầu việc? Đã rõ hội phí một lần và bán sách; có ví dụ đêm sách/bán sách, còn nguồn tài trợ/thu khác, khoản chi và kế hoạch sự kiện cụ thể.
- Có dự toán/duyệt chi trước, hoàn ứng và chứng từ kèm không; ai duyệt, mức nào cần hai người?
- Chưa yêu cầu đăng ký sự kiện trên web; cần ví dụ sự kiện, người tham gia, ngân sách/nhiệm vụ và check-in nếu có.
- Đã rõ lô mới tách sách mượn, nhận trước/cọc nhỏ/cuối đợt trả dư và thanh toán, chỉ nợ nhà sách, khách trả ngay và không đổi/hoàn; không đặt trước. D56 chốt ví dụ 3,9 triệu và hoàn cọc riêng; còn nghĩa vụ với hàng giữ lại. Không mặc định mở thương mại điện tử.
- Đã rõ xuất cả Excel/PDF; còn mẫu/chỉ số báo cáo, ngày bắt đầu tuần/năm tài chính và người nhận.
- Dashboard mỗi ban cần quyết định gì; “minh bạch” là trong CLB hay báo cáo tổng hợp công khai?

### Vòng khu công khai, bảo mật và vận hành

- Đã rõ khách Google/email, nội bộ username/mật khẩu được cấp; cựu chỉ xem hoạt động, không nhạy cảm/tiền/xuất file; chủ sản phẩm giữ hạ tầng/backup/cảnh báo. Còn trường công bố trúng tuyển, cách xác minh “đã đọc” nếu cần và quy định lưu dữ liệu.
- Review nằm trên fanpage, web hay cả hai; ai có quyền biên tập/xuất bản và sử dụng ảnh/nội dung?
- Có người mượn/ứng viên chưa thành niên không; ai xử lý yêu cầu sửa/xóa dữ liệu và thông báo quyền riêng tư?
- Chủ sản phẩm đã đứng tên hạ tầng/giữ backup/nhận cảnh báo. Còn recovery/MFA, người dự phòng và quy trình thay nhiệm kỳ ở tài khoản web.
- CLB chấp nhận mất tối đa bao nhiêu giao dịch khi sự cố, và ngừng hoạt động tối đa bao lâu? Ai giữ backup độc lập?
- Đã rõ mục tiêu một tháng và chủ sản phẩm tự làm với AI; còn ngày bắt đầu, thời gian thực có thể dành mỗi tuần và ngân sách hạ tầng khi cần nâng. Không dùng mức quen công nghệ làm điều kiện loại stack thay yêu cầu chọn theo độ phù hợp.

## 4. Điều kiện chuyển từ khám phá sang thực hiện

Chủ sản phẩm thống nhất các quy tắc ảnh hưởng tiền/ngày/quyền, phạm vi đủ chín nhóm, luồng mẫu trên thiết bị, kết quả chọn nền tảng và nguồn lực. Sau đó khóa PRD/ma trận quyền/từ điển dữ liệu, viết schema/API và kế hoạch triển khai chi tiết. Chưa phát hành, nhập PII thật, mua gói hoặc commit/push trong giai đoạn khám phá hiện tại.

Q30–Q33 đã trả lời: quy tắc gia hạn, cọc dùng hết, mục tiêu một tháng và cách cộng 14 ngày được ghi ở D57–D61. Đầu vào tiếp theo là mẫu Excel tổng hợp, rubric thực tế và mẫu báo cáo trước module tương ứng. Trường công bố tuyển, thời hạn lưu hồ sơ và mục tiêu phục hồi phải chốt trước công khai/dữ liệu thật. Các chi tiết ít ảnh hưởng hơn tiếp tục làm rõ khi dựng luồng mẫu; không biến toàn bộ danh sách gợi ý thành nhiều vòng phỏng vấn bắt buộc trước khi tiến hành phần độc lập. Mục tiêu 30 ngày được lập lại trong roadmap; chưa là cam kết ngày phát hành.
