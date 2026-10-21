# Prompt giao Antigravity: khảo sát nhận diện → design.md → UI YSBK

## Thiết kế thay thế đã duyệt 21/10/2026

Đây là prompt khám phá ban đầu. Bộ nguồn mới là [Stitch HANDOFF](../mockups/stitch-ui-2026-10-21/HANDOFF.md), [prompt UI](../mockups/stitch-ui-2026-10-21/ANTIGRAVITY-PROMPT.md) và [session handoff](../SESSION-HANDOFF.md). Không tạo lại nhận diện hoặc thay landing cuốn sách đã duyệt; kiểm tra UI source/QA đang có trước khi thực hiện phần còn thiếu. Ý tưởng tài khoản/đổi sách/IP chưa được chốt.

Sao chép toàn bộ phần dưới vào Antigravity đang mở workspace `F:\Codex Project\YSBK`. Đây là giao việc thiết kế và UI prototype; chưa giao xây toàn bộ backend hoặc triển khai thật.

---

Bạn là Antigravity, phụ trách thiết kế sản phẩm và triển khai UI cho website quản lý CLB Yêu Sách Bách Khoa Hà Nội (YSBK). Hãy thực hiện công việc, tạo tài liệu và giao diện chạy được để review; không dừng ở tư vấn hoặc đưa ra vài hình ý tưởng.

## 1. Mục tiêu và phạm vi lượt này

Thực hiện theo thứ tự:

1. Đọc bối cảnh và đặc tả trong workspace.
2. Lên mạng khảo sát đúng YSBK: tên, logo, màu chủ đạo, cách dùng chữ và ngôn ngữ hình ảnh.
3. Tổng hợp mọi quyết định thiết kế vào một file `design.md` ở gốc dự án.
4. Dựng UI prototype theo đúng `design.md`, có responsive và tương tác, dùng dữ liệu giả.
5. Tự mở trình duyệt kiểm tra, sửa lỗi, bàn giao bằng chứng và các điểm chưa xác nhận.

Sản phẩm cuối dự kiến một tháng, một người phát triển có AI hỗ trợ, đủ chín nhóm chức năng. Lượt này làm nền thiết kế/UI để dùng tiếp khi xây nghiệp vụ. Không tự thu hẹp thành landing page; cũng không tự xây hệ thống production, Auth/ngân hàng/Google Form thật trong lượt UI.

Tuân thủ AGENTS.md áp dụng cho workspace. Giữ chỉnh sửa có sẵn, không tự commit/push/deploy, mua dịch vụ, tạo tài khoản, đăng Facebook hoặc gửi dữ liệu sang công cụ thiết kế bên ngoài. Không tự dùng subagent nếu chưa được người dùng cho phép. Không yêu cầu duyệt từng bước nhỏ; hoàn thành mẫu cụ thể và báo các quyết định cần review.

## 2. Đọc đầu vào trước khi thiết kế

Đọc `README.md` và các tài liệu sau; nếu có khác biệt, quyết định mới nhất đã xác nhận trong sổ phỏng vấn ưu tiên hơn nguồn web lịch sử:

- `docs/02-pham-vi-va-nghiep-vu.md`: phạm vi FR-01…09 và quy tắc tiền/ngày.
- `docs/03-kien-truc-va-ha-tang.md`: hướng Astro + React, Workers, PostgreSQL/Supabase; lựa chọn Auth còn cần thử.
- `docs/04-bao-mat-du-lieu-seo.md`: ranh giới dữ liệu, SEO và bảo mật.
- `docs/05-roadmap-va-nghiem-thu.md`: D1–D30 và các ca nghiệm thu dự kiến.
- `docs/06-phong-van-va-quyet-dinh.md`: quyết định đã chốt và điều còn mở.
- `docs/07-doi-chieu-tai-lieu-clb.md`: tránh mang quy tắc nguồn cũ vào thiết kế.
- `docs/08-ma-tran-quyen-va-dang-nhap.md`: khách/thành viên/cựu/admin.
- `docs/09-khao-sat-nhan-dien-ysbk.md`: khảo sát nhận diện ban đầu và giới hạn bằng chứng.

Tham khảo WarePro theo cách đọc, không chỉnh sửa project tham chiếu:

- `F:\Codex Project\ProductManagement_Antigravity\QuanLyHangHoa\MainWindow.xaml`
- `F:\Codex Project\ProductManagement_Antigravity\QuanLyHangHoa\Views\DashboardView.xaml`

Học bố cục điều hướng, bảng nghiệp vụ, KPI và đường từ số tổng đến chi tiết. Chuyển thành trải nghiệm web/điện thoại; không bê nguyên kích thước WPF hay giao diện desktop. Nếu file không truy cập được, ghi rõ; không tự nhận đã chạy WarePro hoặc nhìn thấy UI runtime từ việc đọc XAML.

## 3. Khảo sát thương hiệu trên Internet

Nguồn khởi đầu, cần kiểm chứng lại:

- Fanpage: https://www.facebook.com/CLBYeuSachBachKhoaHaNoi/
- Nguồn HUST dẫn fanpage: https://hust.edu.vn/uploads/sys/quality-assurance/2019/04/ee-2-1-1-student-guide-book.399978.17764.pdf
- Website tham khảo: https://clbyeusachbkhn.weebly.com/
- Hoạt động trên nguồn HUST: https://hust.edu.vn/vi/news/hop-tac-doi-ngoai-truyen-thong/hun-duc-pham-chat-nguoi-bach-khoa-tu-van-hoa-doc-655865.html

Ưu tiên tài nguyên do CLB công bố và nguồn trường/Hội Sinh viên dẫn trực tiếp. Tìm logo/avatar, cover và khoảng 3–5 ấn phẩm đại diện nếu truy cập được; không cần tải hàng loạt. Xác minh đúng CLB Hà Nội, không nhầm logo HUST với logo YSBK, CLB sách trường khác hoặc kết quả trùng chữ viết tắt.

Lập bảng nguồn trong `design.md`: URL, tên nguồn, ngày xem, điều quan sát được, file/ảnh tham chiếu, độ tin cậy và giới hạn. Phân biệt ba loại: nhận diện có nguồn; mã màu lấy mẫu từ asset; quyết định UI do bạn đề xuất. Không gọi màu lấy bằng eyedropper là mã màu chính thức nếu không có guideline.

Ở lần khảo sát trước, công cụ đọc Facebook trả trang chặn tạm thời; website Weebly không đủ bằng chứng nhận diện mới nhất. Không mặc định đã có logo hoặc bảng màu xác thực. Không vượt chặn, dùng token/cookie ngoài quyền hay đoán asset rồi coi là thật. Nếu vẫn thiếu nguồn: tiếp tục layout/prototype bằng palette tạm được ghi rõ, để token thay được, liệt kê asset cần bổ sung; không tuyên bố thương hiệu đã hoàn tất. Chỉ hỏi người dùng khi thiếu thông tin thật sự chặn việc còn lại.

## 4. Logo, font và hướng hình ảnh

Giữ tính nguyên bản của logo CLB: không vẽ lại bằng AI, đổi biểu tượng hoặc tự thay bằng icon cuốn sách chung. “Logo đẹp” ở đây là dùng asset rõ nét, đúng tỷ lệ, khoảng thở, nền phù hợp và bố trí đẹp với tên CLB. Nếu không có logo xác thực, dùng tên chữ tạm rõ ràng và ghi trạng thái thiếu asset; không tạo biểu tượng giả rồi gắn nhãn chính thức.

Ưu tiên SVG gốc nếu có nguồn và an toàn; nếu chỉ có PNG, dùng đúng độ phân giải, không kéo méo. Không nhúng script từ SVG không đáng tin. Lưu nguồn và quyền sử dụng/giấy phép đã biết, không suy công khai đồng nghĩa tự do sử dụng. Với hình người thật, không tự lấy ảnh cá nhân làm dữ liệu hồ sơ mẫu.

Hướng thẩm mỹ: cộng đồng sinh viên yêu sách, ấm áp, có chất biên tập, tươi sáng và chỉn chu. Khu công khai có nhịp điệu hình ảnh/bìa sách/tiêu đề; khu quản trị tập trung số liệu, bảng và tốc độ thao tác. Dùng chung nhận diện nhưng không ép hai khu cùng mật độ hoặc kích thước chữ.

Chọn tối đa hai họ font, đủ dấu tiếng Việt. Ứng viên để thử:

- Be Vietnam Pro cho navigation, form, bảng, số liệu và thao tác quản trị.
- Lora cho tiêu đề công khai/bài review, nếu phối hợp đẹp và tải hợp lý.

Đây là đề xuất, không phải font CLB đã xác nhận. Có thể chọn cặp khác nếu giải thích rõ; phải kiểm tra font thực, giấy phép và glyph tiếng Việt. Nguồn metadata: https://github.com/google/fonts/blob/main/ofl/bevietnampro/METADATA.pb và https://github.com/google/fonts/blob/main/ofl/lora/METADATA.pb.

Thử chuỗi: “Yêu Sách Bách Khoa — Mở sách đọc tương lai”, “Nguyễn Thị Ánh — Đặng Quốc Dũng”, “Tiền cọc 150.000 ₫ · Hoàn 100.000 ₫”. Không dùng chữ Unicode cách điệu thay font. Dùng số thẳng cột cho tiền nếu font hỗ trợ, chọn độ đậm/line-height không cắt dấu.

Không chọn palette SaaS mặc định trước nghiên cứu. Không phủ gradient, hiệu ứng kính hoặc đồ trang trí lên bảng tiền. Chỉ thêm hiệu ứng có mục đích, ưu tiên nét chữ, khoảng trắng và phân cấp thông tin. Light theme trước, chưa cần dark theme.

## 5. File design.md bắt buộc có gì

Tạo đúng `design.md` ở gốc. Đây là nguồn chuẩn của thiết kế; không tạo nhiều guideline cạnh tranh. Các tài liệu nghiệp vụ vẫn là nguồn chuẩn quy tắc sản phẩm, `design.md` dẫn tới chúng và ghi cách thể hiện trên UI.

Nội dung phải cụ thể để người khác code theo, gồm:

1. Mục tiêu, đối tượng, nguyên tắc và tình trạng xác thực thương hiệu.
2. Bảng nguồn khảo sát; logo/asset và quy tắc sử dụng, khoảng thở/kích thước tối thiểu phù hợp asset.
3. Palette có giá trị HEX cụ thể, tên semantic token và vai trò: brand primary/hover/pressed/soft, accent, nền/surface, chữ/muted, border/focus, success/warning/danger/info. Đánh dấu màu tạm nếu chưa xác thực. Tách màu thương hiệu khỏi màu trạng thái nghiệp vụ.
4. Typography: font, nguồn/license, weight, scale/line-height, fallback, tiếng Việt, cách hiển thị tiền/ngày; cách tải font và tránh đổi bố cục khi tải.
5. Spacing scale, grid/container, breakpoint theo nhu cầu nội dung, radius, border, shadow, icon và chuyển động; có giá trị token cụ thể thay vì chỉ ghi “thoáng, đẹp”.
6. Hai layout công khai/nội bộ, sidebar/header/mobile navigation, mật độ bảng và CTA chính.
7. Component và đủ trạng thái: button, input/select/search/filter, table/pagination, badge, card/KPI, tabs, dialog/drawer, form error, toast, empty/loading/error, stale data và chưa rõ kết quả lưu.
8. Sitemap/màn hình theo FR-01…09 và quyền. Chỉ rõ trường nào công khai, nội bộ, nhạy cảm, cựu được đọc.
9. Quy tắc UI nghiệp vụ: tiền cọc/phạt, hai quỹ, thu/hoàn khác phương thức, chuyển phiếu, chấm điểm có lịch sử, lịch nháp/công bố; không tự viết chính sách mới.
10. Responsive, bàn phím, focus, tương phản, nội dung tiếng Việt và SEO khu công khai.
11. Bảng ánh xạ token → CSS variable/component; nguyên tắc không hard-code màu rải rác. Tên component/đường dẫn khớp code thực sau khi dựng.
12. Checklist nghiệm thu, điều còn tạm và changelog ngắn khi sửa quyết định.

Chốt một hướng thiết kế tốt nhất để triển khai. Có thể thử nội bộ vài phương án, không yêu cầu người dùng chọn liên tiếp nhiều moodboard trước khi có mẫu cụ thể.

## 6. Màn hình prototype cần có

| Khu | Màn hình và nội dung chính |
|---|---|
| Công khai | Trang chủ có tìm sách/giới thiệu/lịch hoạt động; danh mục có tìm/lọc/phân trang; chi tiết sách có trạng thái và review; danh sách/chi tiết review; hoạt động/sự kiện; kết quả tuyển chỉ trường được phép công bố |
| Đăng nhập | Khách Google hoặc email/mật khẩu; nội bộ username/mật khẩu riêng; lỗi/khóa tài khoản; trong prototype phải ghi rõ đây là mô phỏng, không gọi Auth thật |
| Quầy sách | Mở buổi/kiểm tiền; tìm người và bản sách; phiếu tối đa hai cuốn; nhận cọc; trả toàn bộ/một phần; gia hạn; mất sách; danh sách gọi nhắc; đóng buổi/đối soát |
| Kho | Danh mục/ấn bản/bản sách, hai kho/vị trí bàn tạm, thể loại nhiều giá trị, giá chưa biết, trạng thái và review; form thêm/sửa và preview import |
| Thành viên | Danh sách/lọc, hồ sơ/ban/chức vụ/trường/năm/khóa, lịch sử hoạt động/cựu, đủ điều kiện trực chính; không gắn vai trò admin từ chức vụ CLB |
| Trực sách | Preview Excel tổng hợp, xung đột/lỗi, lịch tự đề xuất và chỉnh tay, cảnh báo thiếu người; phân công chính/hỗ trợ, điểm danh; công bố và sao chép bài Facebook |
| Tuyển | Đợt tuyển, trạng thái sync Form, danh sách/nguyện vọng, hồ sơ/phỏng vấn; rubric; chấm riêng/chung; lịch sử sửa điểm, tổng kết hội đồng và kết quả |
| Quỹ/hoạt động | Hai quỹ riêng, thu/chi/hội phí một lần, chi tiết chứng từ; hàng bán theo lô, bán thu ngay, nợ nhà sách/trả dư/giữ tiếp/cọc và quyết toán |
| Sự kiện | Danh sách/chi tiết, thời gian/địa điểm, khách và thành viên tham gia, dự toán/chi thực tế, checklist/nhiệm vụ/người phụ trách |
| Báo cáo | Dashboard và trang báo cáo riêng; kỳ tuần/tháng/quý/năm, bộ lọc, biểu đồ gắn câu hỏi nghiệp vụ, drill-down; preview Excel/PDF phải được ghi rõ mô phỏng nếu chưa sinh file |
| Nội dung | Hàng chờ bình luận/đánh giá/cảm nhận, xem trước, duyệt/từ chối và trạng thái bài |
| Admin/cựu | Admin quản lý tài khoản/nhật ký toàn hệ thống; cựu có màn hình chỉ xem hoạt động đã lọc trường, không biến thành dashboard nghiệp vụ đầy đủ chỉ ẩn nút |

Không cần làm mọi biến thể thành trang riêng nếu dialog/drawer hợp lý. Mọi route chính phải có nội dung hữu ích và trạng thái; không để phần lớn menu dẫn đến “Coming soon”. Dựng trước ba mẫu đại diện: trang tìm/chi tiết sách công khai, quầy mượn–trả/đối soát, dashboard nội bộ; kiểm token/bố cục rồi mở rộng theo cùng bộ component, không làm ba hệ UI riêng.

## 7. Quy tắc nghiệp vụ bắt buộc thể hiện đúng

Đọc tài liệu đầy đủ; danh sách dưới là các điểm dễ làm UI sai:

- Cọc từng cuốn, gần nhất theo bội 50k, mốc giữa lên, tối thiểu 50k, không trần 200k; 74k → 50k, 75k → 100k, 230k → 250k; không giá → cọc 50k nhưng giá vẫn là “Chưa có giá”. Tối đa hai cuốn/phiếu.
- Mượn cộng đúng 14 ngày lịch: 1/10 → 15/10. Trong hạn gia hạn cộng hạn hiện tại; sau quá hạn chốt phạt rồi tính từ ngày gia hạn; tối đa ba lượt cùng phiếu. Lịch nghỉ dời hạn theo đặc tả; không tự tính phạt trên khoảng CLB đã dời hạn.
- Phạt 1k/ngày cho cả phiếu, không nhân số cuốn; hiển thị mức gợi ý/mức chốt/lý do giảm miễn và tiền thực tế riêng.
- Cọc 150k, phạt 60k: hoàn 150k, thu phạt 60k riêng khi tất toán toàn bộ. Trả một phần lập phiếu chuyển tiếp, hạn/lượt gia hạn reset; cọc còn nguyên chuyển liên kết, không tạo thu/hoàn giả. Nếu cọc cũ 150k đã bị giữ hết để phạt và giữ cuốn cọc 100k, phải thu mới 100k; không chuyển cọc đã dùng hết.
- Quỹ mượn–trả và quỹ hoạt động tách riêng; một hộp tiền mỗi buổi, nhiều người nhập nhưng mỗi người một tài khoản. Tiền mặt, ngân hàng, nghĩa vụ cọc và khoản thu nhập không đồng nhất. Có số dự kiến/thực đếm/chênh lệch/lý do, không tự sửa số để ép khớp.
- Nhận/hoàn khác phương thức được phép. Chuyển khoản cần thành viên kiểm app; không đánh dấu đã nhận từ ảnh chụp, QR hoặc loa. UI phân biệt “đang chờ xác nhận” và “đã xác nhận”.
- Sách mượn cũ không bán; lô bán mới tách riêng. Lô 100 giá nhập 65k, bán 60/trả 40: thanh toán 3,9 triệu. Có cọc nhà sách 1 triệu thì nhận hoàn riêng 1 triệu và trả riêng 3,9 triệu; không gộp thành khoản chi ròng 2,9 triệu. Không công nợ khách, không đặt trước/đổi trả khách.
- Trực thứ Ba/thứ Năm 14–17h, hai người chính cùng đủ ca, 3–5 hỗ trợ đầu/cuối; có 15 phút chuẩn bị/thu dọn. Mốc 13:45–14:00/17:00–17:15 hiện là diễn giải tạm được ghi trong tài liệu, không tự xưng đã chốt giờ thu dọn. Người mới hỗ trợ trước; không xếp cựu hoặc người bận để tạo lịch nhìn như đủ.
- Giữ Google Form và yêu cầu tự sync; nhiều nguyện vọng tách ban phân bổ; chấm riêng/chung, sửa điểm có lịch sử. Prototype mô phỏng sync có trạng thái, không tuyên bố đã tích hợp.
- Khách muốn gửi nội dung phải có tài khoản; nội dung chờ duyệt. Thành viên hoạt động quản lý mọi nghiệp vụ; admin thêm tài khoản/audit. Cựu chỉ hoạt động, không PII nhạy cảm/tiền/số tài khoản/xuất file/ghi. Thiết kế UI đúng quyền không thay thế authorization backend.

## 8. Cách triển khai UI và giới hạn kỹ thuật

Kiểm tra code có sẵn rồi dùng cấu trúc hiện có; workspace có thể mới chỉ có tài liệu. Nếu chưa có frontend, khởi tạo phần prototype tối thiểu theo hướng Astro + React + TypeScript, component dùng chung và token CSS. Giữ mô hình một ứng dụng, không thêm backend khác/monorepo nhiều dịch vụ chỉ để vẽ UI. Dùng thư viện component đang có hoặc một lựa chọn phù hợp, không chồng nhiều UI kit. Chỉ thêm dependency có nhu cầu rõ.

Dùng mock adapter/data tách rõ khỏi component, dữ liệu giả đồng bộ giữa danh sách/chi tiết/tổng; nút chính thực hiện tương tác mock có kết quả, validation và thông báo. Không dùng endpoint công khai chứa mẫu dữ liệu người thật. Không tạo Supabase project, migrations production hoặc auth giả rồi quảng cáo là bảo mật đã hoàn thành. Chế độ xem vai trò chỉ là công cụ demo local, không phải cách cấp quyền sản phẩm.

Tình huống thiếu mạng hoặc chưa rõ kết quả lưu cần thông báo dễ hiểu, không khuyến khích nhập lại tiền khi chưa biết giao dịch trước đã thành công. Tiền VND hiển thị nhất quán, dấu phân cách rõ; số âm và hoàn/thu có nhãn, không chỉ dựa màu. Không đưa chi tiết stack/database vào luồng người dùng trừ nhãn môi trường demo cần thiết.

Khu công khai: cấu trúc heading/HTML rõ, URL và metadata theo trang, mô tả sách/review có nội dung thật sự phù hợp; không bịa số thành viên/lượt mượn hoặc lời chứng thực. Dữ liệu demo nhận diện rõ và không có thông tin cá nhân thật. Preview/staging không để công cụ tìm kiếm index bằng cấu hình phù hợp; chỉ noindex/robots không phải bảo vệ dữ liệu riêng. Trang quản trị không đưa dữ liệu nhạy cảm vào HTML/public cache/metadata/sitemap.

## 9. Responsive, accessibility và chất lượng

Tự kiểm ít nhất các viewport 390px, 768px và 1440px; kiểm thêm 320px chống vỡ ngang. Số này là mốc kiểm tra, không ép breakpoint y hệt. Bảng nghiệp vụ rộng có vùng cuộn có chủ đích hoặc bản tóm tắt theo hàng; không thu mọi chữ nhỏ lại để vừa điện thoại. Form quầy sách dùng một tay được, nút/chỗ bấm đủ lớn, tổng tiền và CTA rõ; fixed/sticky không che input hoặc nội dung khi mở bàn phím.

Chữ thường đạt contrast tối thiểu 4,5:1, chữ lớn đủ điều kiện tối thiểu 3:1; tham chiếu https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html. Kiểm riêng focus, lỗi, badge và trạng thái disabled; không gọi toàn bộ UI đạt WCAG chỉ vì đo vài cặp màu. Trạng thái có chữ/icon, không chỉ màu. Có label, lỗi gắn trường, thứ tự Tab, focus nhìn được, dialog giữ/trả focus, thao tác được bằng bàn phím, hỗ trợ reduced motion.

Tối ưu ảnh/bìa, kích thước ổn định, lazy load phù hợp; font đủ tiếng Việt, giới hạn weight/preload cần thiết, tránh tải nhiều font. Chỉ rõ metric nào đo bằng công cụ, môi trường và giới hạn; không tuyên bố p95 nghiệp vụ hoặc chống DDoS từ Lighthouse/build. Không dùng hiệu ứng làm chậm quầy tiền.

## 10. Kiểm tra và bàn giao

Chạy build/typecheck/lint phù hợp phần đã tạo. Chạy smoke UI trong trình duyệt, không chỉ đọc source. Kiểm navigation, tìm/lọc sách, mở chi tiết, một luồng mượn/hoàn/chuyển phiếu, trạng thái lỗi/empty/loading, bàn phím và hai kích thước chính. Kiểm số mẫu khớp giữa các màn hình; rà khác biệt với `design.md`, sửa code hoặc tài liệu có lý do, không để chúng lệch nhau.

Không viết bộ test lớn cho CSS thuần. Logic mock có nhánh tiền/ngày/quyền cần self-check/test nhỏ có ý nghĩa; ghi rõ nó chỉ kiểm mô phỏng UI, không thay các ca PostgreSQL/Auth thật trong roadmap. Nút export/sync chưa thực hiện thật phải có nhãn và phản hồi đúng trạng thái; không giả báo thành công.

Đầu ra bắt buộc:

- `design.md` hoàn chỉnh, có nguồn, token cụ thể, trạng thái xác thực và quy tắc UI.
- UI prototype chạy local được, đủ nhóm màn hình đã giao, dùng token/component thống nhất; hướng dẫn chạy và phạm vi mô phỏng rõ.
- Asset/logo/font dùng trong prototype có nguồn; các giấy phép cần giữ được lưu cùng asset nếu có.
- Ảnh chụp desktop/mobile của ít nhất ba màn hình đại diện, nêu viewport và màn hình đã kiểm; lưu đường dẫn thật trong workspace, không ảnh AI thay screenshot runtime.
- Báo cáo ngắn: đã làm, tệp thay đổi, lệnh/check và kết quả, mức khớp `design.md`, nhận diện đã xác minh/chưa xác minh, các khoảng trống trước backend/production và bước tiếp theo.

Tiêu chí hoàn thành: có bằng chứng nghiên cứu đúng CLB; `design.md` đủ để tiếp tục code; prototype đẹp, đọc rõ, đúng nhận diện ở mức đã xác thực, hoạt động trên điện thoại/laptop; các luồng tiền/quyền không bị thể hiện sai; đã tự kiểm UI và nêu trung thực giới hạn. Chưa có logo/màu xác thực thì bàn giao bản tạm với giới hạn đó, không đánh dấu branding đã hoàn tất.

Bắt đầu bằng đọc workspace, khảo sát nguồn CLB và lập `design.md`; sau đó dựng, kiểm và hoàn thiện UI theo file đó.
