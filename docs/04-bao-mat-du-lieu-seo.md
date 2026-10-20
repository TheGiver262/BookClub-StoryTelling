# Bảo mật, dữ liệu cá nhân và SEO v0.11

Ngày 18/10/2026. Đây là yêu cầu thiết kế và cổng nghiệm thu, chưa phải báo cáo kiểm thử hệ thống đã tồn tại. Ưu tiên bảo mật không đồng nghĩa có thể hứa “không bao giờ bị hack hoặc DDoS”.

## 1. Dữ liệu và bề mặt tấn công

| Vùng | Dữ liệu | Chính sách đề xuất |
|---|---|---|
| Công khai | Sách, review đã duyệt, sự kiện, kết quả tuyển được cho phép công bố | Chỉ xuất trường nằm trong danh sách cho phép; không suy ngược ai mượn |
| Nội bộ nghiệp vụ | Thành viên, lịch học/làm, điện thoại, phân ca | Mọi thành viên đang hoạt động quản lý; khách không được truy cập |
| Nội bộ nhạy cảm | Hồ sơ tuyển, bài viết, phỏng vấn, rubric/điểm, sổ tiền | Mọi thành viên đang hoạt động quản lý theo lựa chọn của chủ sản phẩm; ghi audit phù hợp |
| Quản trị | Tài khoản, loại tài khoản, nhật ký toàn hệ thống | Chỉ admin quản lý tài khoản và xem nhật ký toàn hệ thống |
| Truy cập cựu thành viên | Hoạt động CLB theo danh sách trường cho phép | Tài khoản nội bộ còn đăng nhập, chỉ đọc hoạt động; chặn PII nhạy cảm/hồ sơ tuyển/người mượn, mọi tài chính/số tài khoản và Excel/PDF; không tự nâng quyền |
| Bí mật hệ thống | Credentials DB, khóa dịch vụ, backup, session | Không vào browser, git, ảnh chụp, log hoặc file xuất thông thường |

Tác nhân cần xét: khách lạm dụng, tài khoản thành viên bị chiếm, thành viên cố ý vượt quyền, admin thao tác sai, bot vét dữ liệu, dependency độc hại và người truy cập backup. Đoán UUID hay biết URL không được tạo quyền.

## 2. Danh tính và quyền

- Dùng nhà cung cấp Auth; không tự viết lưu/kiểm mật khẩu. Tài khoản nội bộ do admin cấp, dùng tên đăng nhập riêng + mật khẩu; khách có Google/email/mật khẩu nhưng không tự thành thành viên. Username có chuẩn hóa/unique và chống dò tài khoản; email liên hệ không tự liên kết danh tính khách với nội bộ. Luồng cấp/reset phải có kiểm soát, không gửi mật khẩu vào log; chi tiết chuẩn hóa và recovery cần chứng minh ở prototype.
- Đề xuất MFA cho toàn bộ tài khoản nội bộ vì mọi thành viên có quyền với tiền và hồ sơ cá nhân; bắt buộc bảo vệ admin và tài khoản dashboard nhà cung cấp bằng MFA/phương án recovery trước dùng thật. Cách áp dụng MFA cho thành viên cần chốt theo trải nghiệm trực sách.
- Mỗi người một tài khoản; không dùng chung “tài khoản bàn sách” nếu cần quy trách nhiệm. Đổi người thao tác có đăng nhập/bàn giao tương ứng.
- Deny by default cho khách ở API nội bộ và cho tài khoản bị khóa. Kiểm quyền theo loại tài khoản, trạng thái thành viên, phương thức xác thực và đối tượng; cựu thành viên vẫn đăng nhập/đọc trong phạm vi được chốt nhưng bị chặn mọi mutation nghiệp vụ. Không thêm điều kiện ban/hội đồng để chặn nghiệp vụ của thành viên đang hoạt động.
- Mọi thành viên đang hoạt động quản lý các mục nghiệp vụ, gồm tiền, điện thoại, tuyển và báo cáo/xuất dữ liệu; ghi audit việc xem/xuất nhạy cảm khi phù hợp. Chỉ admin quản lý tài khoản/loại tài khoản và xem nhật ký toàn hệ thống. Phân công người phụ trách là thông tin trách nhiệm, không tạo thêm tầng quyền chưa được yêu cầu.
- Chuyển cựu phải mất quyền ghi, quyền đọc PII nhạy cảm/tài chính và quyền xuất file ngay ở API dù phiên còn mở; không tự khóa tài khoản vì tốt nghiệp. Khóa do quản trị/sự cố là trạng thái riêng, áp dụng với phiên hiện tại theo chính sách thu hồi. Cựu không thể tự đổi lại hoạt động, sửa điểm, ghi tiền, duyệt bài, chạy import hoặc nhờ API chạy tác vụ ghi. Luồng đăng xuất/đổi mật khẩu của chính tài khoản được xử lý theo Auth, tách sửa dữ liệu CLB.
- Cựu chỉ đọc hoạt động CLB bằng danh sách trường phía máy chủ; không gửi bảng đầy đủ rồi giấu cột. Loại số tiền/số tài khoản/chứng từ, địa chỉ/điện thoại, lịch bận cá nhân và hồ sơ tuyển/người mượn khỏi cả payload, file đính kèm, biểu đồ, tìm kiếm và cache. Export/download kiểm quyền hiện tại; URL ký sẵn còn hiệu lực không được trở thành đường vòng sau chuyển cựu, nên file nhạy cảm đi qua endpoint kiểm quyền hoặc cơ chế thu hồi tương đương đã thử. Không thể thu hồi bản người dùng đã tải khi trước đó có quyền.
- Không cấp quyền nội bộ chỉ từ email hoặc role nếu phiên đăng nhập bằng Google khách. Kiểm thử liên kết danh tính/trùng email/đổi provider phía máy chủ; không xem hai trang đăng nhập hoặc trường `provider` client gửi là hàng rào bảo mật. [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) là điều cần kiểm tra trong prototype, chưa có bằng chứng bài thử đã pass.
- Cookie session dùng Secure/HttpOnly khi phù hợp, SameSite và kiểm tra CSRF/Origin cho mutation; luồng OAuth có state/PKCE theo SDK chính thức. Không tự chế mã hóa/session.

Tham chiếu: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Kiểm quyền phía máy chủ và kiểm thử đường gọi trực tiếp là yêu cầu của dự án.

## 3. Bảo vệ giao dịch, dữ liệu và nội dung

- SQL dùng tham số; input có schema, giới hạn dài/kích thước/số dòng/phạm vi ngày. Không nhận tổng tiền/quyền/người thực hiện từ client làm sự thật.
- Với chuyển khoản CLB, lưu tham chiếu và kết quả xác nhận cần thiết; giữ số tài khoản/chi tiết đối soát trong khu nội bộ. Không lưu mật khẩu app ngân hàng hoặc OTP. Cách tự động nhận giao dịch và quyền thực hiện lệnh hoàn tiền ngân hàng cần thiết kế riêng nếu được yêu cầu; hiện chưa có tích hợp đó.
- Theo quy trình đã xác nhận, thành viên kiểm giao dịch thực tế trong app ngân hàng trước khi ghi đã thu/hoàn. QR và loa hỗ trợ thao tác; ảnh chụp/âm thanh không thay thế bước kiểm tài khoản. API ghi nhận người xác nhận và phương thức thực tế, kể cả hoàn khác phương thức lúc nhận.
- Kết nối DB TLS và tài khoản ít quyền. Tắt Data API không dùng; kiểm tra grants, RLS và hàm khi có expose dữ liệu. Không dùng service secret trong browser.
- Bản ghi tiền đã post chỉ được đảo/điều chỉnh có lý do và người có quyền. Admin có đầy đủ chức năng quản trị nhưng không xóa dấu vết.
- Review/bình luận không cho HTML tùy ý; sanitize nội dung rich text và liên kết, chặn script/URL nguy hiểm, có kiểm duyệt và báo cáo lạm dụng.
- Khách phải đăng ký miễn phí để gửi đánh giá/nhận xét/cảm nhận; đăng ký không tạo quyền thành viên CLB. Nội dung chờ duyệt không xuất hiện qua API công khai, điểm đánh giá tổng hợp, sitemap, cache hoặc bản xuất công khai. Sửa bản đã duyệt cần kiểm soát phiên bản để không đưa nội dung mới chưa được duyệt lên web.
- Callback đồng bộ Form dùng xác thực nguồn/chữ ký riêng, chống replay/ghi trùng, kiểm schema/kích thước và không nhận quyền/người chấm từ payload. Tách secret tích hợp khỏi khóa quản trị; Form/trigger thuộc tài khoản CLB có bàn giao. Đơn/bài viết của ứng viên vẫn là dữ liệu đầu vào cần kiểm soát dù sự kiện tới từ Google.
- Sửa điểm tuyển phải giữ điểm cá nhân/chung, trước/sau, người sửa, thời điểm và lý do; quyền sửa không cho phép xóa lịch sử. Đồng bộ lại Form không đổi hoặc xóa điểm. Tài khoản ứng viên/khách không đọc được đánh giá nội bộ.
- File giới hạn kiểu/kích thước, kiểm tra nội dung thực, tên ngẫu nhiên, private bucket cho hồ sơ; không cho thực thi. Bản đầu tránh upload không cần thiết. Không phục vụ SVG/HTML không đáng tin như nội dung cùng origin.
- Import có preview/validation/chống trùng; CSV/Excel xuất phải xử lý công thức độc hại từ tên/nội dung bắt đầu bằng `=`, `+`, `-`, `@` theo định dạng đích.
- Excel lịch học là đầu vào không đáng tin: giới hạn kích thước cả file và dữ liệu giải nén, sheet/dòng, không chạy macro/công thức/liên kết ngoài; nhận diện thành viên và phạm vi tuần/ngày rõ ràng. Parse lỗi không được tự biến thành “rảnh”; file nguồn và lịch cá nhân nằm trong khu nội bộ, không đưa vào public storage hoặc bản build SEO.
- CSP, chống nhúng trái phép, HTTPS, Referrer Policy và các header phù hợp; không đưa thư viện theo dõi vào mọi trang quản trị.
- Theo dõi dependency và security advisory, khóa phiên bản, quét secrets; có lịch cập nhật và người xử lý. Không xem “build thành công” là chứng minh bảo mật.

## 4. Chống DDoS, vét dữ liệu và cạn ngân sách

Cloudflare có lớp chống DDoS, nhưng WAF/rate-limit khác nhau theo gói và đường traffic. Chỉ tuyến thực sự qua Cloudflare chịu những rule đã cấu hình. [Cloudflare: security interoperability](https://developers.cloudflare.com/waf/feature-interoperability/).

Thiết kế nhiều lớp:

1. Cache nội dung công khai, ảnh nhỏ, phân trang và giới hạn tìm kiếm; trả lỗi sớm trước truy vấn tốn kém.
2. Giới hạn theo endpoint, tài khoản và IP; có mức riêng cho tìm kiếm, login, bình luận, import và export. IP chung của trường không được dùng như danh tính duy nhất.
3. Turnstile cho thao tác công khai dễ bị spam khi phù hợp; **xác minh token phía máy chủ**, không chỉ gắn widget. [Cloudflare: Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
4. Timeout và giới hạn concurrency/query/report; không cho truy vấn toàn bộ lịch sử qua endpoint công khai.
5. Bảo vệ riêng Auth/Storage/Data API hoặc SQL endpoint của nhà cung cấp. Không dùng CORS, ẩn key công khai, robots.txt hoặc URL khó đoán như hàng rào quyền.
6. Cảnh báo quota/chi phí; runbook chuyển public catalog sang nội dung cache, khóa tạm comment/export hoặc mutation khi cần, vẫn bảo toàn dữ liệu đã ghi.

Trước phát hành cần chứng minh rule có tác dụng bằng request hợp lệ, request spam và truy cập đường vòng. Không thử DDoS nhà cung cấp hoặc website thật; load test giới hạn trong môi trường được phép. Không hứa free tier có thể chịu mọi tấn công.

## 5. Nhật ký và analytics

Audit nghiệp vụ tối thiểu: ID người thực hiện do máy chủ xác định, thời điểm UTC, hành động, đối tượng, request ID, kết quả, lý do và phần thay đổi cần thiết. Ghi cùng transaction cho thao tác tiền/sách quan trọng; có snapshot lịch sử đủ để tái dựng quyết định nhưng che trường nhạy cảm. Chỉ admin truy cập màn hình/API nhật ký toàn hệ thống; mọi thành viên vẫn thực hiện nghiệp vụ và được ghi nhận vào audit.

Audit việc thêm/sửa/ngừng dùng sách, mượn/trả/chuyển tiếp/gia hạn/mất, thu/hoàn/phạt/điều chỉnh/đóng ca, đổi quyền, quyết định tuyển, xuất dữ liệu nhạy cảm và các lần truy cập bị từ chối đáng chú ý. Không ghi mật khẩu, token, toàn bộ nội dung đơn hoặc số điện thoại vào log lỗi.

Tài khoản ứng dụng không được sửa/xóa audit đã ghi. Điều đó không chống tuyệt đối admin database hoặc nhà cung cấp bị chiếm; backup và bản xuất độc lập giúp phát hiện/phục hồi. Nếu cần chống chối bỏ mạnh hơn phải xác định yêu cầu riêng, không hứa log “bất biến tuyệt đối”. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

Analytics công khai là luồng riêng: tổng lượt xem sách/review, tìm kiếm không kết quả, lượt quan tâm theo thể loại; lọc bot ở mức khả thi. Không mặc định theo dõi hồ sơ đọc của từng người. Giới hạn lưu sự kiện thô, tổng hợp theo ngày, không dùng fingerprint, không thu số điện thoại/câu tìm kiếm có dữ liệu nhạy cảm. Thời gian giữ log và analytics phải chốt trong phỏng vấn.

Nhật ký cho biết tài khoản đã làm gì; nếu tài khoản dùng chung hoặc bị chiếm, nó không tự chứng minh người thật nào cầm thiết bị. Quy trình tài khoản cá nhân, MFA và bàn giao là phần cần thiết để quy trách nhiệm.

## 6. Sao lưu và chống tống tiền

Đề xuất trước dùng thật:

- Backup tự động ngoài tài khoản vận hành, mã hóa và phân quyền độc lập; sao lưu DB, file và cấu hình cần phục hồi. Không đưa khóa giải mã vào cùng nơi với bản sao.
- Chủ sản phẩm đã nhận trách nhiệm đứng tên hạ tầng, giữ backup và nhận cảnh báo. Thay nhiệm kỳ ban chủ nhiệm chỉ thay phân công/tài khoản web theo quyết định, không tự chuyển tài khoản nhà cung cấp, khóa recovery hay bản sao dữ liệu. Cần có thông tin liên hệ/recovery và phương án người dự phòng do chủ sản phẩm quyết định.
- Chốt tần suất theo lượng giao dịch và mức mất dữ liệu chấp nhận được; tối thiểu có bản trước/sau buổi trực và hằng ngày có thay đổi. Mục tiêu RPO/RTO phải được CLB xác nhận, không giả định backup hằng ngày luôn đủ.
- Bản sao không chỉ ở cùng tài khoản mà admin web có thể xóa. Chốt người giữ, nơi giữ, thời gian lưu và cơ chế kiểm tra job thất bại.
- Khôi phục vào môi trường sạch trước ngày phát hành; đối soát số sách, phiếu mở, nghĩa vụ cọc và sổ tiền. Lặp lại theo lịch và sau thay đổi quy trình backup.
- Runbook sự cố: ngừng thao tác ghi nếu có nguy cơ dữ liệu sai; cô lập tài khoản, thu hồi khóa/session; giữ bằng chứng; xác định phạm vi; khôi phục bản sạch; đối soát giao dịch phát sinh sau backup; liên hệ người chịu trách nhiệm và xử lý thông báo theo nghĩa vụ thực tế.

Supabase khuyến nghị free project xuất DB và giữ bản sao ngoài hệ thống; backup DB cũng không thay thế sao lưu nội dung file Storage. [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups). Bản thử miễn phí chỉ được giữ dữ liệu thật khi cơ chế sao lưu/phục hồi tối thiểu đã chạy được.

## 7. Dữ liệu cá nhân và công bố

Đã xác nhận website phục vụ CLB; cần xác định ai chịu trách nhiệm vận hành và giải quyết yêu cầu dữ liệu. Chỉ thu tên/điện thoại và dữ liệu nghiệp vụ cần thiết; không tự thêm CCCD, ảnh giấy tờ hay địa chỉ nhà.

Cần chốt mục đích, căn cứ xử lý, thông báo quyền riêng tư, thời gian giữ hồ sơ người mượn/ứng viên/thành viên và cách sửa/xóa/ẩn danh. Tách thông tin cần giữ để đối soát khỏi thông tin không còn cần. Danh sách trúng tuyển công khai phải được duyệt trường hiển thị và phạm vi công bố; không đưa điện thoại, điểm phỏng vấn hay toàn bộ đơn lên web.

[Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://chinhphu.vn/?docid=214590&pageid=27160&typegroupid=3) có ngày hiệu lực 01/01/2026 theo Cổng Thông tin Chính phủ. Trước vận hành dữ liệu thật cần rà nghĩa vụ áp dụng, văn bản hướng dẫn hiện hành, tình huống người chưa thành niên và xử lý/lưu trữ dữ liệu qua nhà cung cấp nước ngoài. Tài liệu kỹ thuật này chưa xác nhận tuân thủ pháp luật và chưa thay thế việc đánh giá pháp lý theo mô hình vận hành thực tế.

## 8. SEO gắn với ranh giới dữ liệu

- Index trang giới thiệu, thư mục sách, trang chi tiết ấn bản, review và sự kiện đã công bố. Không xuất tên người mượn hoặc thông tin hồ sơ trong HTML, JSON, metadata, sitemap hay file build công khai.
- Nội dung chính có HTML render sẵn/phía máy chủ, liên kết thật, title/description riêng, canonical, sitemap và xử lý 404/redirect đúng. [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- Dùng dữ liệu có cấu trúc Book/Article/Event khi phù hợp nội dung hiển thị, không hứa được rich result. Review bên ngoài cần quyền sử dụng và quy tắc canonical nếu đăng trùng.
- Khu nội bộ bắt buộc auth/quyền; `noindex` và robots.txt chỉ hỗ trợ quản lý index, không bảo vệ dữ liệu. Trang nội bộ dùng cache private/no-store phù hợp; không có PII trong URL.
- Cache công khai không chứa cookie/session hoặc nội dung cá nhân. Kiểm thử hai tài khoản và truy cập ẩn danh để phát hiện rò dữ liệu qua cache.
- Theo dõi Search Console, lỗi crawl, trang được index, Core Web Vitals và nhu cầu tìm kiếm sau phát hành. Không hứa “lên top” theo một cấu hình kỹ thuật.

## 9. Cổng bảo mật trước dùng thật

Dùng [OWASP ASVS](https://owasp.org/projects/asvs) làm danh mục đối chiếu; khóa phiên bản và chọn yêu cầu áp dụng trong đặc tả kiểm thử. Chưa tuyên bố đạt toàn bộ một cấp ASVS hoặc được chứng nhận.

Điều kiện tối thiểu: không còn lỗi nghiêm trọng về quyền/PII/tiền; không lộ secrets; chứng minh đường API trực tiếp bị chặn đúng; thu hồi quyền và MFA chạy được; chống ghi trùng/đua dữ liệu; backup đã restore; public cache và search không lộ dữ liệu nội bộ; có người nhận cảnh báo và runbook. Kiểm thử tự động cần đi cùng review và kiểm tra thủ công trên runtime thực.
