# Roadmap tới bản dùng đầu đủ chức năng

## Cập nhật roadmap 21/10/2026

Thứ tự hiện tại: hoàn chỉnh/review local → chốt các câu hỏi UX đặt sách → cập nhật kế hoạch/contract nếu có quyết định mới → nghiệm thu beta cloud. Chưa tự deploy từ kế hoạch D1–D30.

[Bộ UI](mockups/stitch-ui-2026-10-21/HANDOFF.md) có 14 mẫu đại diện và ma trận đủ module; [kế hoạch triển khai](superpowers/plans/2026-10-21-ysbk-soft-ui.md) gồm sáu bước. Workspace đã có thay đổi UI và ảnh QA sau concept; phải review trạng thái thực tế, không tích lại từ đầu. Chưa nâng mọi checkbox thành hoàn thành chỉ từ ảnh.

Nghiệm thu bổ sung: publishing chỉ ADMIN; CTV một tháng/đánh giá/xóa mềm; tra cứu bằng quyền đơn; một quyển/đơn; quota và hết hạn cuối ca. Tài khoản bạn đọc/đổi sách/điều chỉnh IP chưa được chốt nên chưa là ca tính năng bắt buộc. [Session handoff](SESSION-HANDOFF.md) ghi bằng chứng và gate còn mở.

Ngày 18/10/2026. **Đã xác nhận: bản đưa vào sử dụng đầu tiên phải đủ cả chín nhóm chức năng.** Các mốc dưới đây giúp xây và kiểm tra tuần tự, không thay thế yêu cầu bằng một bản chỉ mượn–trả.

Đã có quy mô sơ bộ: vài nghìn sách dưới 5.000, hai kho, dưới 100 lượt mượn/trả mỗi buổi và tối đa 3–5 người ghi đồng thời; dữ liệu cũ giấy/Excel. Chủ sản phẩm đặt mục tiêu khoảng một tháng cho MVP, tự phát triển/bảo trì với AI code chính và yêu cầu chọn stack theo độ phù hợp/hiệu năng. Chưa có ngày bắt đầu hoặc số giờ làm mỗi tuần, nên dùng ngày D1–D30 tương đối. Một tháng là mục tiêu lịch, không phải số ngày công hoặc cam kết AI sẽ hoàn thành. Vẫn giữ yêu cầu đủ chín nhóm chức năng của D02.

## 1. Mốc và cổng hoàn thành

| Mốc | Công việc | Đầu ra/cổng nghiệm thu | Vị trí trong mục tiêu 30 ngày |
|---|---|---|---|
| M0 — Khóa nghiệp vụ | Quy tắc tiền/ngày/quyền; mẫu lịch/rubric/báo cáo | Q33 đã giải quyết; PRD và tiêu chí nghiệm thu có đầu vào | D1; phần phỏng vấn đã làm là đầu vào có sẵn |
| M1 — Chọn dùng sẵn/tự xây | Đối chiếu Koha/Dolibarr với các luồng cọc/chuyển tiếp/tuyển/phân ca, license và hosting | Biên bản fit-gap; không gọi là chạy thử nếu chỉ đọc tài liệu | D1, giới hạn 0,5–1 ngày; nếu ứng viên có triển vọng thật phải thử thêm và tính lại lịch |
| M2 — Chứng minh nền kỹ thuật và UI | Username/password tách khách, phạm vi cựu; transaction/runtime; Excel/PDF và luồng UI mẫu | Auth, tranh chấp SQL và tác vụ nặng có bằng chứng; chốt stack/UI trước nhân rộng | D2–D3; nếu không đạt thì sửa nền và lập lại lịch |
| M3 — Lõi sách và tiền | Sách/bản/kho/đưa ra bàn; mượn/trả/chuyển tiếp/gia hạn/phạt; cọc/kiểm tiền/hai quỹ/audit | Chạy đúng ca tiền và đồng thời trên PostgreSQL, thao tác được trên điện thoại/laptop | D4–D10 |
| M4 — Thành viên và trực | Hồ sơ/ban/chức vụ/cựu; đào tạo trực chính; Excel lịch, đề xuất/chỉnh tay/công bố/điểm danh | Kiểm ràng buộc đủ người và lịch bận; không xếp cựu; giữ lịch sử | D11–D14 |
| M5 — Tuyển | Sync Form, nguyện vọng, chấm riêng/chung, rubric, hội đồng/kết quả | Chống trùng/đối soát, đo trễ, lịch sử điểm và chuyển thành viên | D15–D17 |
| M6 — Hoạt động/sự kiện/khu công khai | Hội phí; lô bán/công nợ/cọc/trả dư; nhiệm vụ/ngân sách/khách tham gia; sách/review/kiểm duyệt/Facebook | Hàng/tiền khớp, quyền đúng, nội dung duyệt; không thu trùng liên module | D18–D21 |
| M7 — Báo cáo | Dashboard, tuần/tháng/quý/năm, Excel/PDF, audit tra cứu, analytics | Cùng snapshot, khớp tiền và đủ FR-01…09; file đúng quyền/chữ Việt | D22–D24 |
| M8 — Kiểm thử và vận hành | Kiểm liên module/thiết bị/bảo mật/tải; đối soát nhập dữ liệu, restore, hướng dẫn | Không còn lỗi chặn tiền/quyền/PII; backup phục hồi được; runbook có người nhận | D25–D30, kiểm từng phần đã làm từ D2 |
| M9 — Dùng thử đủ chức năng | Chạy song song sổ đối chiếu; ghi số liệu và sửa lỗi | 2–4 buổi trực khớp sổ và mô phỏng đủ chu kỳ; đủ cổng mới dùng dữ liệu thật | Trong D25–D30 nếu M8 đạt và lịch trực cho phép; phần chưa đủ phải kéo dài sau D30 |

Đây là phân bổ thời gian mục tiêu rất gấp cho một người, chưa có đo năng suất để coi là ước lượng khả thi. Các khoảng ngày công ở bản trước được thay bằng lịch mục tiêu này, không nén chúng bằng một hệ số tăng tốc AI giả định. Nếu chọn dùng sẵn, tính lại phần custom/nâng cấp/kiểm thử trước khi giữ mốc D30. Mỗi ngày gồm xây, kiểm và sửa của phần đó; không dồn toàn bộ kiểm thử sang cuối tháng.

### 1.1 Phạm vi MVP trong một tháng

Đủ cả chín nhóm nhưng dùng form/bảng/lịch/bộ lọc thống nhất và một bộ mẫu báo cáo cơ bản có đủ kỳ tuần/tháng/quý/năm. Có tự đề xuất phân ca, sync Form thật, chấm riêng/chung và công nợ lô bán; không dùng thao tác tay thay các chức năng đã yêu cầu. Báo cáo và thuật toán dùng dữ liệu/mẫu thống nhất, chưa làm trình thiết kế báo cáo hoặc solver lịch tổng quát.

Trì hoãn phần chưa được yêu cầu bắt buộc: camera quét mã, đồ họa dashboard phức tạp, thông báo tự động Facebook/ngân hàng, app điện thoại riêng, tùy biến nhiều CLB và nhập toàn bộ sổ cũ. Mượn để review, bình luận chờ duyệt, phân công chuẩn bị sự kiện và đối soát hai quỹ vẫn nằm trong bản đầu. Không giảm kiểm tiền, authorization/audit, backup/restore, riêng tư hoặc xử lý đồng thời để vừa ngày.

| Điểm kiểm | Cần thấy | Khi lệch |
|---|---|---|
| Cuối D3 | Username/Auth cách ly khách; SQL transaction; đường chạy miễn phí và mẫu UI có bằng chứng | Sửa nền hoặc đổi lựa chọn, cập nhật lịch ngay |
| Cuối D10 | Mượn/trả/cọc/kiểm ca chạy được, số tiền khớp, không lỗi tranh chấp đã biết | Dời ngày dùng thật; không lấy tuần kiểm thử bù để che lỗi tiền |
| Cuối D17 | Lịch tự đề xuất và tuyển sync/chấm chạy với mẫu thật đã bỏ PII | Chốt lại đầu vào/khối lượng; không bỏ tích hợp khỏi phạm vi |
| Cuối D24 | Đủ luồng chín nhóm và file báo cáo, bắt đầu đóng băng thêm tính năng | Nếu còn thiếu chức năng chính, D30 là demo nội bộ chứ chưa là bản dùng đầy đủ |
| D30 | Qua cổng M8 và có đủ bằng chứng trực/UAT theo lịch | Tiếp tục hoàn thiện phần thiếu, báo mốc mới; không gọi bản chưa đủ là sản phẩm hoàn tất |

Đầu vào cần sẵn ở đầu mốc liên quan: mẫu Excel lịch tổng hợp (M4), Form và rubric/mẫu chấm (M5), kế hoạch sự kiện/lô bán và bộ báo cáo tối thiểu (M6–M7). Dữ liệu dùng thiết kế/prototype phải giả hoặc đã bỏ thông tin cá nhân. Quyền truy cập tài khoản thật và thời điểm triển khai được xử lý theo bước vận hành riêng, không tự tạo hạ tầng trong giai đoạn tài liệu.

Do tuyển và sự kiện không diễn ra hằng tuần, cần mô phỏng trọn một đợt tuyển và một sự kiện bằng dữ liệu giả trước phát hành; sau đó kiểm chứng ở đợt thật gần nhất. Không đợi một năm mới kiểm tra báo cáo năm: dùng bộ dữ liệu kiểm thử có kiểm soát.

## 2. Bộ tài liệu cần hoàn thiện sau phỏng vấn

| Tài liệu | Nội dung cần có | Khi khóa |
|---|---|---|
| PRD/phạm vi | Người dùng, FR-01…09, mục tiêu, ngoài phạm vi, dữ liệu công khai | M0 |
| Quy tắc nghiệp vụ | Cọc/phạt/ngày, phiếu chuyển tiếp, mất/hỏng, tiền/quỹ và ngoại lệ | M0 trước M3 |
| Domain và từ điển dữ liệu | Entity, quan hệ, nguồn chuẩn, trạng thái/chuyển, lưu giữ/ẩn danh | M2 |
| Ma trận quyền | [Bản hiện tại](08-ma-tran-quyen-va-dang-nhap.md): khách/thành viên/admin, cựu chỉ hoạt động, không PII nhạy cảm/tiền/xuất file; nội bộ username/mật khẩu được cấp | M0–M2 |
| Kiến trúc/ADR | Kết quả fit-gap, stack, pooling/API/auth, giới hạn, đường nâng cấp | M1–M2 |
| Thiết kế UX/UI | Sitemap, wireframe luồng thật, trạng thái lỗi/rỗng/đang lưu trên hai thiết bị | M2 và trước từng module |
| DB/API | Schema/constraints/index, transaction, idempotency, lỗi, migration | Trước module liên quan |
| Bảo mật và riêng tư | Threat model, kiểm soát áp dụng, thông báo dữ liệu, lưu giữ, phản ứng sự cố | Trước dữ liệu thật |
| Kế hoạch test/UAT | Tình huống, dữ liệu, kết quả mong đợi, bằng chứng và người ký nhận | Từ M0, hoàn thiện M8 |
| Vận hành | Tạo môi trường, backup/restore, quản lý secrets/quyền, quota, chi phí, rollback | M8 |
| Hướng dẫn sử dụng | Quầy sách, thành viên, tuyển, sự kiện, quỹ, báo cáo và xử lý sai sót | M8 |

Bộ v0.11 hiện là tài liệu đầu vào, chưa giả làm schema/API hoặc thiết kế cuối cùng. Cập nhật theo các câu trả lời đã xác nhận, không biến giả định thành yêu cầu ngầm. Lịch 30 ngày phải cập nhật từ bằng chứng ở các điểm kiểm. Không thêm đặt trước, nợ khách mua, đổi trả khách, giỏ hàng/checkout online hoặc chuyển sách mượn sang bán.

## 3. Các ca nghiệm thu quan trọng

Các ca dưới đây là đặc tả kiểm thử cần viết/chạy khi có phần mềm; **chưa có ca nào được tuyên bố đã pass trong bộ tài liệu này**.

| ID | Kịch bản | Kết quả bắt buộc |
|---|---|---|
| T01 | Giá 20k, 51k, 74k, 75k, 100k, 151k, 230k | Cọc lần lượt 50k, 50k, 50k, 100k, 100k, 150k, 250k |
| T02 | Sách mượn không có giá; giá âm/quá giới hạn; bổ sung hoặc sửa giá sau mượn | Không giá vẫn mượn với cọc mặc định 50k và giá chưa biết; giá sai bị chặn; giá bổ sung không tự đổi cọc phiếu cũ |
| T03 | Phiếu hai quyển; thử thêm quyển thứ ba | Hai quyển hợp lệ, quyển thứ ba bị từ chối ở máy chủ |
| T04 | Hai người cho mượn cùng bản, hoặc retry sau mất response | Chỉ một giao dịch hiệu lực, một khoản cọc và một bản sách đang mượn |
| T05 | Trả một trong hai; lập phiếu mới cho quyển còn giữ khi cọc tương ứng chưa bị dùng hết | Có liên kết phiếu, hạn mới theo quy tắc 14 ngày đã khóa và gia hạn về 0; quyết toán phạt phiếu cũ ngay, không thu lại ở phiếu mới; cọc còn nguyên chuyển liên kết không tạo thu/hoàn giả; cọc dùng hết theo T73 |
| T06 | Phiếu chuyển tiếp thất bại giữa chừng | Rollback toàn bộ; không mất cọc, không bỏ bản sách ở trạng thái có thể cho người khác mượn |
| T07 | Gia hạn lần 1–3, lần 4, hai yêu cầu đồng thời | Đúng hạn theo quy tắc chốt; không vượt ba lần trong một vòng phiếu |
| T08 | Mượn thứ Ba, cộng đúng 14 ngày nên hạn thứ Ba sau hai tuần; không có lịch nghỉ; trả đúng hạn hoặc thứ Năm sau đó | Đúng ngày thứ Ba không phạt; thứ Năm gợi ý 2k cho cả phiếu; hạn đến hết ngày Việt Nam |
| T09 | Phiếu một cuốn cọc 50k; phạt tính được 49k, 50k, 60k, 80k | 49k: hoàn 50k và thu 49k riêng; từ 50k: giữ 50k, không thu thêm |
| T10 | Sách giá 74k, cọc 50k bị mất | Giữ đúng 50k; bản sách và nghĩa vụ cọc được xử lý cùng chứng từ |
| T11 | Tiền đầu ca 200k; thu cọc 100k; hoàn 100k; thu phạt 3k | Tiền dự kiến 203k; thu nhập 3k; nghĩa vụ cọc về 0 cho phần đã tất toán |
| T12 | Trả sách nhưng chưa giao tiền hoàn; trả tiền ở ca sau | Còn nghĩa vụ hoàn, chỉ một lần chi thực tế, truy được hai ca |
| T13 | Đóng ca lệch tiền; điều chỉnh sau đóng; chuyển tiền mặt sang tài khoản | Ghi chênh lệch/lý do/người duyệt; không sửa âm thầm; chuyển quỹ không tăng thu nhập |
| T14 | Thành viên chuyển cựu, sau đó tài khoản bị khóa; phiên vẫn đang mở | Cựu còn đăng nhập chỉ xem hoạt động, mất quyền ghi/đọc PII nhạy cảm/tiền/xuất file ngay; khóa thì bị chặn riêng; audit giữ danh tính cũ |
| T15 | Lịch bận trùng ca, thiếu người chính/kỹ năng, check-in muộn | Không âm thầm xếp sai; hiện thiếu và cơ chế người thay thế |
| T16 | Đồng bộ đơn hai lần; hai người chấm; sửa rubric | Không nhân đôi hồ sơ; điểm có người/phiên bản; quyết định và công bố được duyệt |
| T17 | Chi sự kiện liên kết sổ quỹ; xuất báo cáo cùng kỳ | Chỉ ghi một lần; tổng dashboard, chi tiết và file xuất khớp |
| T18 | Khách gọi API nội bộ, đổi ID phiếu, xem điểm tuyển, truy file riêng/cache | Bị từ chối; không lộ PII qua nội dung, cache, sitemap hoặc log |
| T19 | XSS bình luận, công thức Excel, upload giả loại, spam login/tìm kiếm | Bị chặn/giới hạn phù hợp; dữ liệu hợp lệ và người cùng IP trường vẫn dùng được |
| T20 | Restore backup vào môi trường sạch | Sách/phiếu/cọc/sổ tiền/file/quyền được phục hồi và đối soát; có thời gian đo thực |
| T21 | Website thiếu mạng/mất response sau commit | Không báo giao dịch chưa rõ thành thất bại chắc chắn; tra lại biên nhận/idempotency trước khi nhập lại |
| T22 | Review khách, kiểm duyệt, kết quả tuyển công khai | Đúng quyền và nội dung đã duyệt, không tự lộ hồ sơ nội bộ |
| T23 | Phiếu có hai cuốn cùng quá hạn ba ngày | Phạt gợi ý tổng 3k, không phải 6k; không nhân theo số dòng sách |
| T24 | Ngày trực đến hạn nghỉ lễ/Tết, buổi trực thực tế tiếp theo vẫn còn mở | Dời hạn đến cuối ngày buổi thực tế kế tiếp; không phạt phần dời; không trừ lượt gia hạn |
| T25 | Phạt gợi ý 3k; thành viên miễn về 0 vì lý do đặc biệt | Lưu gợi ý, số chốt 0, lý do và người thực hiện; hoàn cọc đúng; không ghi thu phạt giả |
| T26 | Thành viên ban bất kỳ quản lý sách, quỹ, tuyển; thử đổi quyền tài khoản/xem audit toàn hệ thống | Nghiệp vụ được phép; API tài khoản và audit toàn hệ thống bị chặn. Admin thực hiện được các chức năng quản trị đó |
| T27 | Tất toán phiếu hai cuốn có cọc 50k + 100k, phạt 60k | Hoàn 150k, thu riêng 60k; không nhân phạt hai lần hoặc áp trần 50k của riêng một cuốn |
| T28 | Phiếu cũ quá hạn, trả một phần và chuyển tiếp; thử gửi lại yêu cầu thu phạt | Chốt phạt phiếu cũ một lần; phiếu mới bắt đầu vòng hạn/gia hạn mới, không mang khoản phạt cũ sang để thu trùng |
| T29 | Tiền mặt đầu buổi 200k; nhận cọc mới 50k tiền mặt và 100k chuyển khoản đã xác nhận | Tiền mặt dự kiến 250k; ngân hàng tăng 100k; cọc mới phải hoàn tăng 150k; không cộng chuyển khoản vào hộp tiền |
| T30 | Cuối buổi có 250k, cất trong tủ; buổi sau đếm đủ 250k, chưa giao dịch | Số tiền chuyển tiếp vẫn 250k; không ghi chi khi cất, không ghi thu mới khi mở buổi sau |
| T31 | Năm người cùng nhập trên một hộp tiền có số đầu buổi 200k | Chỉ một số dư đầu 200k, không thành 1 triệu; từng giao dịch có người nhập; người trực chính xác nhận đầu/cuối |
| T32 | Có số dư quỹ mượn–trả và quỹ hoạt động khác; hộp tiền mượn–trả thiếu so với dự kiến | Báo cáo tách hai quỹ; ghi chênh lệch thực tế, không tự lấy quỹ hoạt động bù hoặc sửa số thực đếm |
| T33 | Nhận cọc 100k chuyển khoản, sau đó hoàn đủ 100k tiền mặt | Ngân hàng tăng 100k khi nhận, hộp tiền giảm 100k khi hoàn; nghĩa vụ cọc về 0; không sửa phương thức thu cũ |
| T34 | Nhận cọc 100k tiền mặt, sau đó hoàn đủ 100k chuyển khoản đã kiểm app | Hộp tiền tăng 100k khi nhận, ngân hàng giảm 100k khi hoàn; nghĩa vụ cọc về 0, một khoản chi thực tế |
| T35 | Có QR/loa hoặc ảnh chụp của khách nhưng thành viên chưa kiểm được giao dịch trong app | Không tự xác nhận đã thu/hoàn từ tín hiệu đó; giữ trạng thái chưa xác nhận và không ghi tiền thực tế giả |
| T36 | Người hỗ trợ bận giữa buổi nhưng rảnh cả hai khoảng chuẩn bị/thu dọn đã cấu hình | Có thể được đề xuất hỗ trợ; người bận một khoảng bắt buộc không được xếp như đã đủ |
| T37 | Import Excel hai lần, thiếu/nhầm thành viên, giờ hoặc tuần hiệu lực mơ hồ | Preview lỗi và chống trùng; không coi dòng lỗi thành người rảnh, không tự ghi đè lịch đã xác nhận |
| T38 | Không có đủ hai người trực chính hợp lệ hoặc thiếu hỗ trợ ở đầu/cuối | Báo thiếu và lý do; không ép người bận, không cộng nhiều bàn ghép thành nhiều điểm trực |
| T39 | Tạo lại đề xuất sau chỉnh tay và sau khi công bố lịch | Có bản nháp/phiên bản, giữ hoặc hỏi rõ sửa tay cần thay; không âm thầm đổi lịch đã công bố; người quản lý kiểm/chốt trước công bố mới |
| T40 | Người chính rảnh 14:00–17:00 nhưng bận một khoảng chuẩn bị/thu dọn bắt buộc | Không coi là đáp ứng trọn ca; báo khoảng xung đột, kiểm cả hai vai trò theo lịch đầu/cuối đã thống nhất |
| T41 | Người mới chưa đủ điều kiện được thử xếp trực chính bằng đề xuất và chỉnh tay; sau đó hoàn tất hướng dẫn | Cả hai đường đều kiểm điều kiện; trước đó có thể làm hỗ trợ nếu rảnh, sau xác nhận đủ điều kiện mới có thể làm chính |
| T42 | Upload đúng mẫu tổng hợp hoặc file lịch riêng của một trường khác cấu trúc | Mẫu tổng hợp được kiểm/preview; mẫu ngoài hợp đồng báo lỗi, không tự xây luồng chuyển đổi từng trường |
| T43 | Một ứng viên chọn nhiều ban, sau tuyển được phân bổ ban phù hợp | Một hồ sơ/người trong đợt; giữ nguyện vọng gốc và kết quả phân bổ riêng, không nhân đôi ứng viên |
| T44 | Năm sau thay rubric/trọng số; xem lại kết quả năm trước | Hồ sơ/điểm cũ gắn phiên bản tiêu chí đã dùng, không tự đổi hoặc tính lại bằng rubric mới |
| T45 | Hai người chính được xếp nối ca thay vì cùng đủ 14:00–17:00 | Không coi là đủ hai người chính; yêu cầu hai người hợp lệ cùng có mặt toàn bộ giờ trực và các khoảng đầu/cuối |
| T46 | Gửi Form thật; callback bị gửi lại hoặc giả chữ ký; kết nối lỗi sau khi DB đã ghi | Đơn tự xuất hiện theo mục tiêu trễ được chốt; một hồ sơ/response; nguồn giả bị chặn, retry không nhân đôi và có đối soát thiếu |
| T47 | Chấm riêng, chấm bài viết chung rồi sửa điểm và tổng kết hội đồng | Lưu riêng nguồn điểm và lịch sử trước/sau/người/lý do; tổng hợp theo rubric đã chốt, không tự chọn công thức; không mất điểm cá nhân |
| T48 | Thành viên đã đóng hội phí một lần, sang năm mới/đổi ban; số thu thực tế khác 100k mặc định | Không tự sinh lần thu tiếp; số thực thu và chứng từ đúng; không đánh dấu đã thu chỉ vì có hồ sơ thành viên |
| T49 | Khách đăng ký/gửi bài, bài chưa duyệt hoặc sửa bài đã duyệt | Đăng ký miễn phí không tạo quyền nội bộ; bài mới chờ duyệt, không lộ/cộng vào đánh giá công khai trước duyệt theo quy trình phiên bản được chốt |
| T50 | Bán một cuốn có giá nhập/giá bán; gửi lại lệnh ghi bán | Lưu đúng chi tiết cuốn/giá, ghi tiền và giảm hàng một lần, không ghi vào cọc; dùng mô hình kho bán đã được chốt |
| T51 | Xuất cùng báo cáo/kỳ/bộ lọc sang Excel và PDF | Tổng/chi tiết cùng snapshot, chữ Việt và phân trang đúng, không lộ trường ngoài quyền hoặc file công khai lâu dài |
| T52 | Tạo/sao chép nội dung Facebook nhưng người phụ trách chưa xác nhận đã đăng | Lịch web vẫn có; không báo “đã gửi nhóm” chỉ vì nội dung được tạo, ghi trạng thái/người/link thực tế khi có; không cần tự đăng API |
| T53 | Đơn Form được cập nhật/đối soát lại sau khi đã có điểm riêng/chung và nhận xét | Cập nhật nguồn đơn theo phiên bản, giữ dữ liệu chấm/ghi chú/quyết định; lỗi ánh xạ câu hỏi được báo, không ghi đè âm thầm |
| T54 | Chọn một bản sách cũ trong kho mượn để ghi bán, hoặc dùng giao dịch bán làm đổi phiếu mượn | Bị chặn; hàng mới bán theo lô và bản sách mượn không dùng chung nguồn tồn/giao dịch |
| T55 | Giá bìa 100k, chiết khấu nhập 35%, chiết khấu bán 20%; sửa chính sách sau khi bán | Giá nhập 65k, bán 80k, chênh lệch gộp 15k trước chi phí khác; giữ snapshot giá cũ, không ghi đã thu 100k |
| T56 | Nhận lô 100 cuốn, bán 60, trả nhà sách 40 | Lượng khớp 100 = 60 + 40; hàng trả không còn khả dụng; không tự xác nhận tiền hoàn chỉ vì trả vật lý |
| T57 | Nhận lô 100, bán 60, trả 30, giữ 10 bán tiếp | Lượng khớp; 10 còn là hàng bán của lô, không tự thành doanh thu hoặc sách mượn; theo dõi nghĩa vụ quyết toán tương ứng |
| T58 | CLB có cọc nhà sách được hoàn và đồng thời đang giữ cọc bạn đọc | Hai đối tác/nguồn/số dư riêng; nhận lại cọc nhà sách không giảm cọc phải hoàn bạn đọc hoặc tự thành doanh thu bán |
| T59 | Đã xác nhận nhà sách nhận sách dư nhưng chưa hoàn cọc đã nhận | Ghi hàng đã trả và cọc chờ hoàn; không tăng tiền mặt/ngân hàng giả, không đánh dấu cọc đã hoàn vì đã giảm lượng phải thanh toán |
| T60 | Ghi khoản CLB nợ nhà sách rồi thanh toán | Truy về chứng từ/lô, số dư phải trả đúng; thanh toán không tạo thêm lần bán/nhập/xuất hàng hoặc doanh thu hai lần |
| T61 | Cựu gọi API import/sửa hồ sơ/tự kích hoạt/ghi tiền/chấm điểm/duyệt bài thay vì bấm UI | Mọi mutation nghiệp vụ bị chặn theo trạng thái hiện tại, không chỉ ẩn nút; chỉ đọc hoạt động, không PII nhạy cảm/tiền và không xuất Excel/PDF |
| T62 | Google khách trùng email nội bộ/đã liên kết; gọi API thành viên hoặc đổi/thêm/reset password rồi thử vào nội bộ | Không nhận quyền hoặc quản trị credential nội bộ từ identity khách; tài khoản được cấp và luồng xác thực độc lập được chứng minh, không chỉ chặn nút Google/user ID/email/cờ client |
| T63 | Khách tự đăng ký tài khoản mật khẩu rồi khai mình là thành viên | Không tạo tài khoản/quyền nội bộ; chỉ tài khoản được quản lý cấp theo quy trình mới có quyền tương ứng |
| T64 | Ghi bán cho khách chưa trả đủ hoặc chọn đổi/trả/hoàn sau khi mua | Không tạo giao dịch bán nợ/đổi trả khách; sửa chứng từ nhập nhầm nếu có là luồng đảo có audit, tách chính sách đổi trả |
| T65 | Cựu còn đủ dấu đào tạo nhưng được thử xếp vào ca mới tự động/chỉnh tay | Không được xếp; giữ lịch sử trực trước đó, chỉ thành viên đang hoạt động đủ điều kiện mới nhận ca mới |
| T66 | Thay nhiệm kỳ ban chủ nhiệm và quyền web | Không tự chuyển tài khoản hạ tầng, backup, recovery/cảnh báo khỏi chủ sản phẩm; trách nhiệm web và nhà cung cấp được bàn giao đúng phạm vi |
| T67 | Cựu mở dashboard hoạt động, đoán URL báo cáo/quỹ/hồ sơ, gọi export/download hoặc dùng phiên cũ | Chỉ nhận trường hoạt động được phép; không có số tiền/số tài khoản/PII nhạy cảm trong payload/cache/file; request tải mới bị chặn sau chuyển cựu, gồm file đã tạo trước đó |
| T68 | Lô 100 cuốn giá nhập 65k, không cọc; bán 60/trả nhà sách 40 | Trả 3,9 triệu; không ghi nhận hoàn 2,6 triệu, không nhân đôi giảm nợ/tiền; lượng khớp |
| T69 | Cùng lô trên, trước đó cọc nhà sách 1 triệu | Theo dõi khoản cọc đã chi; xác nhận nhận hoàn 1 triệu và thanh toán 3,9 triệu riêng; không thay bằng một khoản chi ròng 2,9 triệu; không ghi hoàn cọc là doanh thu |
| T70 | Admin cấp username/mật khẩu, đăng nhập/cấp lại mật khẩu, thử username trùng và danh tính khách trùng email liên hệ | Username riêng dùng được qua managed Auth đã chứng minh; chuẩn hóa/unique phía máy chủ; khách không đăng ký chiếm namespace hoặc reset/liên kết credential nội bộ; không log mật khẩu |
| T71 | Hạn hiện tại 14/10; gia hạn ngày 5/10 hoặc đúng ngày 14/10 | Hạn mới 28/10 trước điều chỉnh lịch nghỉ; dùng một lượt gia hạn, không tính từ ngày 5/10 làm mất ngày còn lại |
| T72 | Phiếu đã quá hạn; xử lý phạt rồi gia hạn ngày 20/10 | Chốt phạt cũ một lần, hạn mới 3/11 trước điều chỉnh lịch nghỉ; tăng một lượt trong giới hạn ba, không reset số lượt của cùng phiếu; retry không thu phạt lại |
| T73 | Cọc 150k đã dùng hết để phạt; trả cuốn cọc 50k/giữ cuốn cọc 100k và lập phiếu mới | Giữ 150k cũ, không hoàn 50k, nhận mới đúng 100k cọc; tiền thực tăng 100k, nghĩa vụ cọc mới 100k; không chuyển 100k cũ hoặc nhập kho cuốn còn giữ; chưa nhận tiền thì không ghi đã thu; gửi lại không nhân đôi |
| T74 | Mượn 1/10, gia hạn trong hạn, qua tháng/năm hoặc tháng 2; không có điều chỉnh nghỉ | 1/10 → 15/10 → 29/10; luôn cộng đúng 14 ngày lịch theo ngày Việt Nam, không cộng 13 ngày hoặc lấy số giờ từ timestamp để đếm ngày |

Test tiền/đồng thời chạy với PostgreSQL thật trong môi trường dùng một lần, không chỉ mock hoặc database khác. UI smoke chạy trên điện thoại/laptop và runtime triển khai; build/source không thay thế bằng chứng đó. Load test có giới hạn và không dùng dữ liệu thật.

## 4. Tiêu chí dùng thử và theo dõi

- Toàn bộ FR-01…09 có luồng thực hiện và test/UAT tương ứng; các tích hợp tùy chọn được chốt phạm vi, không tự bỏ chức năng chính.
- Không còn lỗi tiền, cấp quyền sai hoặc lộ PII đã biết. Mọi lệch kiểm tiền có chứng từ và giải trình, không phải yêu cầu ép số thực đếm bằng số dự kiến.
- Thành viên trực tự hoàn thành mượn/trả/đóng ca sau hướng dẫn; ghi thời gian thao tác, lỗi nhập và số lần cần trợ giúp.
- Theo dõi p50/p95, tỷ lệ lỗi, xung đột/retry, CPU, DB/Storage/egress, cache, dung lượng audit và tổng quota theo kỳ.
- Theo dõi số sách/bạn đọc/lượt mượn, quá hạn/gia hạn, tìm kiếm không kết quả, nhu cầu thể loại, đủ người/trễ ca, tuyển/sự kiện và thu–chi/cọc theo quyền.
- Có người phụ trách tài khoản hạ tầng, backup, cảnh báo và xử lý sự cố; có quy trình bàn giao khi khóa thành viên ra trường.

Nếu gói miễn phí không đáp ứng hiệu năng hoặc phục hồi tối thiểu, trình chi phí và căn cứ để CLB chọn nâng gói hoặc điều chỉnh vận hành. Không tự thay giới hạn bảo mật, không tự thu tiền người mượn hay mua gói trả phí.

## 5. Đích cuối và việc sau đó

Kết thúc bản đầu: CLB vận hành đủ chức năng, đối soát được, có tài liệu/bằng chứng, backup có thể khôi phục và số liệu thực tế. Sau đó sửa theo dữ liệu; chỉ thêm tối ưu/automation được CLB cần.

Việc bán bản riêng sau này là giai đoạn khác: quyền sở hữu mã/nội dung, license dependency, thương hiệu/domain, trách nhiệm dữ liệu, bộ cấu hình từng CLB, provisioning, cập nhật và hỗ trợ. Việc miễn phí cho CLB Sách Bách Khoa không tự giải quyết các điều kiện thương mại đó.
