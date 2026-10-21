# Khảo sát phần mềm và khả năng tái sử dụng

## Cập nhật khảo sát 21/10/2026

Có thêm [nghiên cứu UX đặt, quản lý và hủy giữ chỗ](technical/public-reservation-ux-research-2026-10-21.md), dùng nguồn chính thức Koha, LibCal tại Illinois, Acuity và Cloudflare. So sánh mô hình tài khoản bạn đọc, liên kết email và tài khoản tùy chọn; chưa thử giao dịch thật trên các dịch vụ. Không biến đề xuất thành quyết định thay luồng YSBK. Xem [trạng thái hiện hành](CURRENT-STATE.md).

Ngày kiểm tra: 18/10/2026. Phạm vi: website chính thức, tài liệu và trang kho mã nguồn. Chưa cài demo, chạy giao dịch, kiểm tra tải, rà soát lỗ hổng hay khóa phiên bản/commit của ứng viên. Không sử dụng số sao GitHub làm bằng chứng chất lượng hoặc bảo mật.

## 1. Kết luận sơ bộ

Chưa xác minh được một sản phẩm có sẵn đáp ứng trọn vẹn cả chín nhóm yêu cầu. Đây là giới hạn của khảo sát này, không phải khẳng định thị trường không có sản phẩm phù hợp.

- Nếu ưu tiên đưa nghiệp vụ thư viện vào dùng nhanh: **Koha** đáng thử đầu tiên; **SLiMS** là phương án so sánh.
- Nếu ưu tiên quản trị CLB tổng thể: **Dolibarr** đáng thử đầu tiên; **CiviCRM** thích hợp để học về thành viên, sự kiện và tương tác.
- **ERPNext** có phạm vi ERP rộng, nhưng cần cân nhắc công vận hành và tương thích app bổ sung.
- Nếu tiền cọc, cách trực sách và trải nghiệm điện thoại là điều kiện cứng: ứng dụng riêng có thể phù hợp hơn. Chỉ chốt sau bài thử nghiệp vụ, không suy ra từ danh sách tính năng.

Mã nguồn miễn phí không đồng nghĩa hosting, cập nhật, sao lưu và bảo trì miễn phí. Các ứng viên truyền thống dưới đây cũng không thể đưa nguyên bộ lên Vercel/Workers chỉ bằng đổi cấu hình.

## 2. Các ứng viên

| Ứng viên | Bằng chứng đã đọc | Điều có thể học hoặc tái sử dụng | Khoảng trống cần thử |
|---|---|---|---|
| [Koha](https://github.com/Koha-Community/Koha) | ILS, GPL-3.0-or-later; tài liệu circulation, cash management, patron clubs và kiểm duyệt bình luận | Phân biệt biểu ghi sách/bản sách, quy tắc mượn, quyền thủ thư, quầy tiền và hoàn tiền | Phân bổ cọc hoàn lại theo sách, đối soát buổi trực của CLB, tuyển hai vòng, lịch thành viên và kế toán quỹ |
| [SLiMS 9 Bulian](https://github.com/slims/slims9_bulian) | README nêu circulation, membership, collection management, stock taking; GPL-3.0; PHP và MySQL/MariaDB | Danh mục công khai, quản lý bản sách, kiểm kê và giao diện nghiệp vụ thư viện | Chưa xác minh sổ cọc, chốt ca, tài chính CLB, tuyển thành viên và phân ca |
| [Dolibarr](https://github.com/Dolibarr/dolibarr) | ERP/CRM web; GPL-3.0-or-later; quản lý tổ chức, kho, kế toán; có module membership | Cấu trúc module, chứng từ, quyền, quỹ và nhiệm vụ | Chưa xác minh luồng thư viện có gia hạn, cọc theo từng cuốn, review và tuyển hai vòng |
| [CiviCRM](https://github.com/civicrm/civicrm-core) | AGPL-3.0; contact, membership, contributions, events, reporting; có bản PHP standalone và tích hợp CMS | Hồ sơ thành viên, sự kiện, danh sách và báo cáo tổ chức | Chưa xác minh quản lý từng bản sách, tiền cọc và kiểm kê/chốt ca; thu đóng góp không tự chứng minh đủ kế toán thu–chi |
| [ERPNext](https://github.com/frappe/erpnext) | GPL-3.0, Frappe/Python/JavaScript, triển khai bằng stack Frappe hoặc Docker | Kế toán, kho, workflow, quyền và báo cáo | Cần custom nghiệp vụ sách/CLB. App Non Profit riêng đã archived; không coi là tính năng được hỗ trợ sẵn trong mọi bản ERPNext |
| [Frappe Library Management](https://github.com/frappe/library_management) | Kho nhỏ; `license.txt` chỉ ghi GNU GPL, chưa rõ phiên bản; tutorial Frappe mô tả Issue/Return và membership | Ví dụ xây DocType, validation và workflow | Dùng học cách tổ chức. Chưa đủ bằng chứng coi là sản phẩm hoàn chỉnh hoặc nền tảng an toàn cho tiền cọc |

Nguồn bổ trợ cho từng dòng:

- Koha: [circulation](https://koha-community.org/manual/25.11/en/html/circulation.html), [tools/cash management và patron clubs](https://koha-community.org/manual/25.11/en/html/tools.html), [cash register API nội bộ](https://perldoc.koha-community.org/Koha/Cash/Register.html). Tài liệu live có nội dung ghi cho phiên bản mới hơn nhánh URL; phải đối chiếu đúng release khi chạy thử. Cashup là ghi nhận thu gom/chốt quầy; chưa chứng minh quy trình đếm tiền đầu/cuối buổi giống CLB.
- SLiMS: [README và yêu cầu hệ thống](https://github.com/slims/slims9_bulian#readme).
- Dolibarr: [README](https://github.com/Dolibarr/dolibarr#readme), [module membership](https://wiki.dolibarr.org/index.php/Module_Foundations).
- CiviCRM: [tổng quan chức năng](https://civicrm.org/explore-civicrm), [báo cáo](https://docs.civicrm.org/user/en/latest/reporting/what-you-need-to-know/).
- ERPNext: [hướng dẫn Non Profit và cảnh báo tương thích](https://docs.frappe.io/erpnext/non-profit), [repo Non Profit archived ngày 31/07/2025](https://github.com/frappe/non_profit).
- Frappe: [tutorial Library Transaction](https://docs.frappe.io/framework/user/en/tutorial/types-of-doctype), [tệp license](https://github.com/frappe/library_management/blob/master/license.txt).

Không sao chép mã trước khi rà license của phiên bản và từng dependency. Nghĩa vụ khi sửa, phân phối hoặc cung cấp qua mạng cần được đánh giá theo đúng license; không diễn giải GPL và AGPL là cùng điều kiện.

## 3. Đối chiếu chín nhóm yêu cầu

`Có nền` = tài liệu xác nhận một phần chức năng liên quan, chưa bảo đảm phù hợp quy trình CLB. `Chưa rõ` = chưa có bằng chứng trong phạm vi khảo sát. Bảng không phải tỷ lệ đáp ứng.

| Nhu cầu | Koha | SLiMS | Dolibarr | CiviCRM | ERPNext |
|---|---|---|---|---|---|
| Mượn/trả và danh mục thư viện | Có nền | Có nền | Chưa rõ | Chưa rõ | Chưa rõ |
| Cọc hoàn lại, làm tròn, đối soát đúng quy tắc CLB | Chưa rõ | Chưa rõ | Chưa rõ | Chưa rõ | Chưa rõ |
| Thành viên CLB, ban, chức vụ và lịch sử nhiệm kỳ | Có nền hồ sơ/enrollment | Có nền bạn đọc | Có nền membership | Có nền membership | Cần custom/xác minh app |
| Phân ca theo lịch học/làm và nhiệm vụ trong ca | Chưa rõ | Chưa rõ | Chưa rõ | Chưa rõ | Chưa rõ |
| Tuyển đơn và phỏng vấn theo rubric | Chưa rõ | Chưa rõ | Chưa rõ | Chưa rõ | Chưa rõ |
| Quỹ, thu–chi, ngân sách hoạt động | Có nền quầy tiền | Chưa rõ | Có nền | Có nền đóng góp | Có nền kế toán |
| Sự kiện, người tham gia, phân công | Có nền patron clubs | Chưa rõ | Có nền agenda/tổ chức | Có nền sự kiện | Cần custom/xác minh |
| Dashboard/báo cáo phù hợp toàn CLB | Có nền thư viện | Chưa rõ phạm vi | Có nền | Có nền | Có nền |
| Audit, quyền, danh mục công khai/review | Có nền; cần rà chi tiết | Có nền danh mục; còn lại chưa rõ | Có nền quyền; còn lại cần rà | Có nền quyền; còn lại cần rà | Có nền quyền; còn lại cần rà |

Những ô “Có nền” vẫn cần kiểm tra quyền theo đối tượng, dữ liệu xuất ra, khả năng truy vết và phục hồi. Tên module không chứng minh các yêu cầu này.

## 4. Bài thử quyết định dùng sẵn hay tự xây

Giới hạn đề xuất: 3–5 ngày công cho một ứng viên thư viện và một ứng viên quản trị; có thể thu hẹp sau phỏng vấn. Chỉ dùng dữ liệu giả và môi trường riêng. Chưa thực hiện trong lượt khảo sát này.

1. Nhập hai bản cùng tên, nằm ở hai kho; chuyển một bản ra bàn trường.
2. Mượn nhiều cuốn với cọc theo chính sách được xác nhận; trả một cuốn trước.
3. Gia hạn ba lần; chặn lần bốn; tính phạt qua ranh giới ngày và ngày không trực.
4. Hai người cùng cho mượn một bản; bấm lại khi mạng chập chờn; không được ghi trùng.
5. Mở ca, thu cọc, hoàn cọc và thu phạt riêng khi dưới trần; giữ cọc khi phạt đạt trần; chuyển quỹ, đóng ca có chênh lệch.
6. Cho thành viên hoạt động quản lý nghiệp vụ; cựu chỉ xem hoạt động, không PII nhạy cảm/tiền/xuất file và mất quyền ghi ngay, tài khoản khóa bị chặn riêng; nội bộ username/mật khẩu được cấp; chặn khách Google vào quyền nội bộ, thành viên tự cấp admin hoặc xem audit toàn hệ thống.
7. Tạo đợt tuyển có đơn, phỏng vấn, rubric, quyết định và danh sách công khai an toàn.
8. Xuất dữ liệu đầy đủ; khôi phục bản sao trên môi trường sạch.

Đánh giá bằng thời gian thao tác trên thiết bị thực tế, số bước custom, khả năng nâng cấp, dữ liệu đúng và chi phí vận hành. Không chọn theo tổng số module. Nếu ứng viên vượt các ca tiền/quyền và chỉ cần custom nhỏ, ưu tiên dùng sẵn. Nếu phải sửa sâu lõi giao dịch hoặc ghép nhiều hệ thống có hai nguồn tiền, cân nhắc tự xây.

## 5. Tham khảo WarePro đã đọc tại máy

Đã đọc tài liệu hiện có và các đoạn XAML liên quan:

- `F:\Codex Project\ProductManagement_Antigravity\code-explained\01-overview\WAREPRO_PROJECT_DEEP_DIVE.md`.
- `F:\Codex Project\ProductManagement_Antigravity\code-explained\06-lessons\WAREPRO_REUSABLE_ENGINEERING_PLAYBOOK.md`.
- `F:\Codex Project\ProductManagement_Antigravity\QuanLyHangHoa\MainWindow.xaml`.
- `F:\Codex Project\ProductManagement_Antigravity\QuanLyHangHoa\Views\DashboardView.xaml`.

Điểm kế thừa: module rõ ràng; sidebar thu gọn; KPI mở được danh sách chi tiết; service kiểm tra quyền và giữ transaction; phân biệt tài sản cụ thể, tồn hiện tại và lịch sử biến động; không sửa tự do trạng thái giao dịch.

Điểm cần thiết kế lại cho web: điện thoại ngoài bàn sách, chạm một tay, nội dung công khai cho SEO, nhập nhanh và xử lý mạng lỗi. Chưa mở WarePro chạy thực tế hoặc xem ảnh giao diện, nên chưa kết luận về độ dễ dùng hay độ giống thị giác.

## 6. Giới hạn bằng chứng

GitHub API qua terminal gặp lỗi TLS; không bỏ kiểm tra chứng chỉ để vượt lỗi. Các thông tin trên dựa vào trang GitHub và tài liệu đọc qua công cụ web. Chưa xác nhận ngày commit mới nhất, CVE áp dụng, chuỗi dependency hoặc tình trạng bảo trì bằng kiểm thử. Trước khi chọn nền tảng phải khóa release, rà security advisory, license và thử nâng cấp.
