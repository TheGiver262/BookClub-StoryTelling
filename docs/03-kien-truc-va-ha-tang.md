# Kiến trúc và hạ tầng thử nghiệm v0.11

Ngày đối chiếu nguồn: 18/10/2026. Tất cả lựa chọn dưới đây là đề xuất; chưa đo hiệu năng và chưa tạo tài khoản/hạ tầng. Hạn mức, giá và điều khoản phải kiểm tra lại lúc triển khai.

## 1. Ràng buộc đã xác nhận

- Một bản phục vụ duy nhất CLB Sách Bách Khoa. Có thể bán bản triển khai riêng cho tổ chức khác sau này.
- Bản dùng đầu đủ cả chín nhóm nghiệp vụ; phù hợp điện thoại và laptop, mạng ổn định.
- Miễn phí phần mềm cho CLB; CLB trả chi phí hạ tầng phát sinh. Bắt đầu bằng gói miễn phí, theo dõi số liệu rồi quyết định nâng cấp.
- Dữ liệu người mượn, tuyển thành viên và tiền cần riêng tư, giao dịch phải nhất quán, có đường phục hồi.
- Quy mô ước lượng vài nghìn sách dưới 5.000, hai kho; dưới 100 lượt mượn/trả mỗi buổi; 3–5 người ghi đồng thời. Chưa tách rõ số đầu/bản và chưa có tổng thành viên.
- Mọi thành viên đang hoạt động quản lý nghiệp vụ; cựu thành viên chỉ xem hoạt động CLB, không xem PII nhạy cảm/tài chính/số tài khoản hoặc xuất Excel/PDF; tài khoản bị khóa là trạng thái khác. Admin quản lý thêm tài khoản/audit. Nội bộ dùng tên đăng nhập riêng + mật khẩu được cấp; Google/email cho khách không tự tạo quyền nội bộ.
- Hai quỹ mượn–trả/hoạt động khác tách riêng; hỗ trợ tiền mặt và tài khoản ngân hàng CLB, được hoàn khác phương thức. Nhiều người ghi chung một phiên hộp tiền, người trực chính kiểm/xác nhận đầu/cuối. Thành viên kiểm app ngân hàng; QR/loa có thể hỗ trợ, chưa yêu cầu đồng bộ ngân hàng vào web.
- Ca 14:00–17:00 thứ Ba/thứ Năm, một địa điểm; hai người chính cùng trực đủ ca và đã được đào tạo, 3–5 hỗ trợ. Cả hai vai trò có ít nhất 15 phút chuẩn bị/thu dọn đầu–cuối. Website nhận một mẫu Excel tổng hợp đã được hậu cần chuẩn bị, tự đề xuất phân ca và cho chỉnh tay/công bố; khâu gộp mẫu trường nằm ngoài phạm vi.
- Tuyển tự đồng bộ đơn Google Form, nhiều nguyện vọng ban; người phỏng vấn chấm riêng, hội đồng tổng kết; bài viết có điểm riêng/chung được sửa và có lịch sử; bộ tiêu chí version theo đợt/năm. Công thức cụ thể còn cần rubric.
- Hội phí một lần; hàng bán mới theo lô riêng với chiết khấu/cọc nhà sách/công nợ/trả hàng dư hoặc giữ bán tiếp; sách mượn cũ không bán. Khách đăng ký miễn phí để gửi nội dung chờ duyệt; báo cáo Excel/PDF; website soạn nội dung/link để người phụ trách đăng Facebook, không tự đăng.
- Hàng bán nhận trước, không cọc hoặc cọc nhỏ, cuối đợt trả dư và quyết toán; chỉ CLB nợ nhà sách, khách thanh toán ngay và không đổi/hoàn. Chủ sản phẩm đứng tên hạ tầng/giữ backup/nhận cảnh báo, không tự chuyển theo nhiệm kỳ CLB.
- Mục tiêu khoảng một tháng cho MVP đủ chín nhóm, chủ sản phẩm tự làm với AI code chính. Không chọn stack chỉ theo mức quen ngôn ngữ, cũng không coi AI là bằng chứng hiệu năng hoặc bảo mật. Dùng lịch D1–D30 có điểm kiểm trong roadmap.

Không triển khai multi-tenant dùng chung database, microservices, Kubernetes, tìm kiếm ngoài hoặc hệ thống message broker ở giai đoạn đầu. Khi bán bản riêng, cấu hình thương hiệu/tài khoản nằm ngoài mã nghiệp vụ; mỗi CLB có secrets, database và backup riêng. Không tạo cơ chế tùy biến vô hạn trước khi có khách hàng thứ hai.

## 2. So sánh hướng thực hiện

| Hướng | Lợi thế | Chi phí/rủi ro | Khi chọn |
|---|---|---|---|
| Mở rộng Koha hoặc Dolibarr | Có nhiều chức năng nghiệp vụ sẵn; giảm phần phải viết nếu bài thử phù hợp | Hosting truyền thống, học stack, custom và nâng cấp; không mặc định có tiền cọc/phiếu chuyển tiếp đúng yêu cầu | Bài thử ở tài liệu khảo sát chứng minh chỉ cần custom nhỏ |
| Ứng dụng riêng TypeScript, Astro + React, Cloudflare Workers, Supabase PostgreSQL/Auth | Một ứng dụng; trang công khai dựng HTML; React cho màn hình quản lý; dùng hạ tầng managed ở gói nhỏ | Phải xây nghiệp vụ; kiểm tra CPU Worker, driver, auth và transaction trên runtime thực | Hướng ưu tiên sơ bộ nếu dùng sẵn không vượt được bài thử |
| Next.js + Supabase, Vercel hoặc Workers | Hệ React thống nhất, hệ sinh thái phong phú, nhiều mẫu dashboard | Vercel Hobby có điều kiện cá nhân/phi thương mại; Workers dùng adapter và cần kiểm tra tương thích/CPU | Prototype chứng minh giảm công triển khai quản trị mà vẫn đạt SEO/runtime/quota |

Hướng triển khai ưu tiên sau phỏng vấn: một ứng dụng TypeScript dùng Astro + React, Cloudflare Workers, PostgreSQL trên Supabase và managed Auth đáp ứng username/cách ly danh tính. Giữ Supabase Auth là ứng viên cần chứng minh, không khóa nhà cung cấp Auth trước bài thử. M1 giới hạn 0,5–1 ngày đối chiếu Koha/Dolibarr với các luồng đặc thù; nếu không có bằng chứng giảm đáng kể công custom/vận hành thì đi theo ứng dụng riêng. Nếu ứng viên dùng sẵn thực sự có triển vọng, thử trên dữ liệu giả rồi cập nhật lịch, không gọi khảo sát tài liệu là demo đã pass.

ASP.NET Core + PostgreSQL vẫn là phương án thay thế nếu bài thử chứng minh lợi thế cụ thể; việc WarePro dùng C# không phải lý do mặc định chọn nó cho web. Chưa có căn cứ chỗ chạy backend miễn phí phù hợp. Kế thừa mô hình giao dịch/phân quyền/audit từ WarePro, không phụ thuộc ngôn ngữ desktop.

### Căn cứ chọn hướng ưu tiên

| Ưu tiên | Quyết định thiết kế | Cách kiểm chứng |
|---|---|---|
| Tiền và dữ liệu nhất quán | PostgreSQL, constraint/row lock/transaction, một nguồn sổ tiền | Kiểm với DB thật: cạnh tranh cùng sách/cọc, retry và mất response |
| Trang công khai nhanh và có SEO | Astro dựng HTML, cache nội dung đã công khai; React cho vùng tương tác quản trị | Đo HTML, LCP, JS tải xuống, cache và thời gian tìm kiếm từ Việt Nam |
| Ít công vận hành cho một người | Một codebase/ứng dụng, DB/Auth managed, cấu trúc module nghiệp vụ | Đếm thao tác triển khai/backup/restore; kiểm nâng cấp, quota và chi phí |
| Độ trễ nghiệp vụ | DB gần người dùng Việt Nam, ít round trip, query có index và pool đúng | Đo p50/p95/CPU/kết nối; không suy độ trễ thấp chỉ vì có edge |
| Bảo mật | API phía máy chủ, tài khoản ứng dụng ít quyền, danh tính tách biệt và whitelist cựu | Gọi trực tiếp API/file/endpoint nhà cung cấp bằng các vai trò và phiên cũ |

Đây là lập luận thiết kế, không phải bảng benchmark hoặc bằng chứng Astro nhanh nhất. Không đổi sang Go/Rust, thêm cache/queue hoặc microservices chỉ để nhắm thông lượng chưa có nhu cầu. Ưu tiên giảm truy vấn, payload và tác vụ dư trước; kết quả M2 có quyền thay đổi lựa chọn nếu không đạt runtime, quota hoặc cách ly Auth.

Nguồn triển khai: [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/), [Next.js trên Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/). Tài liệu adapter Astro hiện hướng sang Workers và đã bỏ hỗ trợ triển khai Pages cho adapter đó; không dùng tutorial cũ để chọn đích SSR. Website tĩnh là trường hợp khác.

## 3. Cấu trúc ứng dụng riêng đề xuất

Một codebase, một ứng dụng web, PostgreSQL là nguồn dữ liệu nghiệp vụ chuẩn. Module: sách/lưu thông, tổ chức/thành viên, trực, tuyển, quỹ, sự kiện, báo cáo, audit và quyền. Chia thư mục theo nghiệp vụ, không chia thành nhiều dịch vụ triển khai độc lập.

Luồng thao tác: giao diện gọi API cùng ứng dụng; máy chủ xác thực, kiểm quyền, validation và gọi use case; use case mở transaction PostgreSQL; commit dữ liệu cùng audit rồi trả biên nhận. Học cấu trúc này từ WarePro, không bê MVVM/WPF sang trình duyệt.

Phần công khai:

- Nội dung sách/review/giới thiệu có HTML render sẵn hoặc phía máy chủ, URL ổn định.
- Ảnh bìa tối ưu trước khi tải lên, phân trang, lazy load; không tự bật dịch vụ biến đổi ảnh có tính phí.
- Metadata sách và review có thể cache. Tình trạng sẵn có có thời điểm cập nhật; máy chủ luôn kiểm tra lại khi cho mượn.

Phần nội bộ:

- React cho form, bảng, lọc, lịch và giao dịch; không gửi toàn bộ dữ liệu cá nhân xuống trình duyệt để lọc.
- Điện thoại ưu tiên tìm/scan mã, mượn–trả, kiểm tiền; laptop thuận tiện import, phân ca, tuyển và báo cáo.
- Bản đầu cần nhập mã thủ công ổn định; barcode/QR và camera bổ sung sau khi xác nhận cách dán mã, thiết bị và trình duyệt.
- Dùng component có sẵn với bàn phím, focus, tương phản và nhãn lỗi; không viết thư viện UI riêng.

## 4. Ranh giới Supabase và API

Hướng ưu tiên bảo vệ dữ liệu nghiệp vụ: trình duyệt không đọc/ghi trực tiếp bảng sách nội bộ, người mượn, tuyển hoặc sổ tiền qua Data API. Worker kết nối PostgreSQL bằng tài khoản ứng dụng ít quyền, qua phương án pooling được kiểm chứng. Tài khoản migration riêng; không dùng `postgres`/quyền quản trị làm tài khoản chạy web.

Managed Auth là hướng ưu tiên, không tự xây lưu/kiểm mật khẩu. API xác minh token/session bằng phương thức chính thức, kiểm tra loại tài khoản, trạng thái thành viên/tài khoản và phương thức xác thực được phép từ nguồn đáng tin; không tin `user_id`, ban hoặc cờ “login nội bộ” từ client. Thành viên hoạt động có quyền nghiệp vụ; cựu chỉ đọc projection hoạt động đã lọc trường phía máy chủ, không có quyền tiền/PII nhạy cảm/xuất file và mất quyền ghi ngay cả khi đang mở phiên. Tài khoản bị khóa bị chặn riêng; admin quản lý tài khoản/audit.

Khách dùng Google hoặc email/mật khẩu; tài khoản nội bộ được admin cấp riêng và bắt buộc tên đăng nhập riêng + mật khẩu. Supabase hỗ trợ password gắn email/điện thoại, nên username tùy ý không phải tính năng native đã được chứng minh sẵn. Supabase còn có cơ chế tự liên kết danh tính cùng email. Phải prototype trường hợp khách Google trùng email liên hệ nội bộ, liên kết danh tính và phiên đang mở; không chỉ kiểm role theo user ID hoặc ẩn nút Google ở trang nội bộ. [Password auth](https://supabase.com/docs/guides/auth/passwords), [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

Yêu cầu chấp nhận trước khi chọn Auth: Google không thể tạo phiên có quyền nội bộ; quyền chỉ phát sinh sau luồng tài khoản mật khẩu được cấp và xác thực tin cậy phía máy chủ; cựu/khóa áp dụng theo trạng thái hiện tại. Không suy phương thức phiên từ email, tên hiển thị hoặc danh sách provider đã gắn; cách chứng minh từ session/token phải được kiểm thử theo SDK/runtime. Nếu yêu cầu tên đăng nhập riêng làm thay đổi phương án, so lại lựa chọn Auth thay vì tự chế mật khẩu hoặc cam kết Supabase phù hợp trước bài thử.

Tách quyền theo phương thức chưa đủ nếu nền Auth đã liên kết danh tính khách vào chính credential nội bộ: phải thử cả Google khách đổi/thêm/reset mật khẩu rồi đăng nhập lại bằng mật khẩu. Thiết kế định danh nội bộ phải giữ độc lập tài khoản do quản lý cấp với định danh khách, không tự hợp nhất qua email hoặc cho khách quản trị credential nội bộ. Chưa khẳng định một dự án Supabase bật đồng thời Google/password mặc định đã đạt yêu cầu.

Phương án nhỏ nhất cần thử trước: Worker ánh xạ username đã chuẩn hóa sang một identity mật khẩu do admin cấp, dùng định danh kỹ thuật riêng, tách email liên hệ thật và danh tính khách. Managed Auth vẫn lưu/kiểm mật khẩu; không tự hash ở ứng dụng. Việc dùng alias nội bộ, chặn đăng ký/đổi định danh trái phép, không liên kết OAuth, cấp/reset và thu hồi session phải qua bài thử, không coi alias khó đoán là bảo mật. Supabase có API tạo user phía máy chủ, nhưng điều đó chưa chứng minh toàn bộ phương án ánh xạ an toàn. [Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser). Nếu không đạt, chọn Auth hỗ trợ username và phân vùng danh tính thích hợp; không đổi yêu cầu người dùng sang email chỉ để vừa nhà cung cấp. [Ma trận và bài thử Auth](08-ma-tran-quyen-va-dang-nhap.md) là cổng M2.

Đăng ký/reset mật khẩu qua email cần kiểm dịch vụ SMTP và quota thật. Email mặc định của nhà cung cấp có giới hạn thử nghiệm; không mặc định đủ cho người dùng công khai. Phương án SMTP, thông tin recovery và cấp tài khoản nội bộ thuộc prototype/vận hành, chưa tạo tài khoản hoặc dịch vụ nào.

Tắt Data API nếu ứng dụng không dùng. Đồng thời không cấp quyền bảng riêng cho `anon`/`authenticated`; kiểm tra REST/GraphQL thật để chứng minh không có đường vòng. Nếu sau này cần expose bảng hoặc RPC, phải thiết kế grants/RLS và kiểm thử riêng. RLS không tự bảo vệ mọi hàm hoặc mọi truy cập đặc quyền. [Supabase: bảo vệ và tắt Data API](https://supabase.com/docs/guides/api/securing-your-api), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Auth và Storage vẫn có endpoint của nhà cung cấp trên Internet; không được nói Cloudflare phía website đã bảo vệ chúng. Private bucket, chính sách Auth/Storage và chống lạm dụng phía nhà cung cấp cần kiểm tra riêng. Nếu chưa cần file hồ sơ, lưu câu trả lời dạng văn bản để giảm bề mặt upload.

Với kết nối SQL: xác minh TLS; dùng query tham số; giới hạn pool và timeout. Supabase khuyến nghị transaction pooler cho serverless; chế độ đó có hạn chế prepared statements/session state cần cấu hình đúng. [Supabase: kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres). Có thể dùng Hyperdrive nếu bài đo chứng minh hữu ích; không chồng hai lớp pool/cache tùy tiện. [Cloudflare: Postgres.js](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/).

## 5. Giao dịch và dữ liệu

- Dùng transaction thật cho mượn/trả, chuyển tiếp phiếu, xử lý cọc/phạt và audit. Không mô phỏng transaction bằng chuỗi REST request độc lập.
- Unique constraint ngăn hai dòng mượn đang hiệu lực cho cùng bản sách. Khóa hàng/conditional update bảo vệ cọc, gia hạn, đóng ca và ghi sổ.
- Idempotency theo thao tác và người dùng, gắn hash nội dung: gửi lại cùng yêu cầu trả cùng kết quả; tái dùng khóa với nội dung khác phải bị từ chối.
- Tiền là số nguyên VND, kiểm tra khoảng giá trị; tổng hợp và làm tròn theo chính sách đã version.
- Hạn đầu cộng đúng 14 ngày lịch; gia hạn trong hạn cộng từ hạn hiện tại, quá hạn chốt phạt rồi cộng từ ngày gia hạn. Lưu sự kiện/mốc phạt đã tất toán và bộ đếm ba lần theo phiếu; không reset khi chỉ gia hạn hoặc thu lại cùng khoảng quá hạn.
- Dữ liệu đã có chứng từ chuyển sang ngừng sử dụng/ẩn thay vì xóa phá liên kết; yêu cầu xóa dữ liệu cá nhân cần ẩn danh có kiểm soát và chính sách lưu giữ.
- Email/đồng bộ bên ngoài không chạy như thể có cùng transaction DB. Bản đầu gọi nhắc thủ công; nếu thêm gửi tự động thì có hàng đợi/outbox bền và chống gửi trùng.
- Hoàn cọc ghi phương thức thực chi độc lập phương thức thu; không sửa lịch sử thu để ép hai bên giống nhau. Xác nhận từ người kiểm app ngân hàng là thao tác nghiệp vụ có audit, không phải tích hợp tự điều khiển app/ngân hàng.
- Sách không có giá là nhánh nghiệp vụ hợp lệ với cọc mặc định 50k và giá vẫn chưa biết. Không dùng validation bắt buộc giá hoặc một giá giả để che mất nhánh này.
- Lô sách bán có nguồn tồn/chứng từ riêng sách mượn; giao dịch bán, trả nhà sách và giữ lại liên kết lượng/giá/đối tác. Khoản CLB cọc nhà sách và khoản CLB giữ của bạn đọc là hai loại số dư đối ứng khác nhau, không dùng chung một trường `deposit_balance` rồi cộng/trừ lẫn.
- Lô 100 giá nhập 65k, bán 60/trả 40: phải trả 3,9 triệu; không cọc thì không nhận hoàn 2,6 triệu. Nếu cọc 1 triệu, ghi hoàn 1 triệu và thanh toán 3,9 triệu riêng, không gộp thành thanh toán ròng. Tiền thực nhận/chi và trạng thái quyết toán phải độc lập với xác nhận trả hàng vật lý.
- Cọc 150k cũ bị giữ hết làm phạt, trả cuốn cọc 50k/giữ cuốn cọc 100k: tất toán cọc cũ, thu mới 100k và tạo nghĩa vụ cọc mới. Giữ cọc không tăng tiền thực lần nữa; không chuyển tiếp khoản đã dùng hết hoặc nhập kho cuốn còn giữ. Cần xác nhận tiền và idempotency cho cả thao tác chuyển phiếu.

Thiết kế bảng chi tiết để sau khi chốt chính sách. Tối thiểu cần thư mục sách/bản, vị trí/biến động, người mượn, phiếu/dòng/liên kết chuyển tiếp, phân bổ cọc, chứng từ/bút toán, phiên quầy, thành viên/nhiệm kỳ/quyền, lịch bận/phân ca, hồ sơ tuyển/đánh giá, sự kiện/nhiệm vụ, review/bình luận và audit. Không tạo bảng trừu tượng tổng quát thay cho entity nghiệp vụ rõ ràng.

## 6. Gói miễn phí và chi phí phải theo dõi

| Dịch vụ | Hạn mức/điều kiện đáng chú ý tại ngày kiểm tra | Hệ quả thiết kế |
|---|---|---|
| Supabase Free | 500 MB database, 1 GB file, 5 GB egress, 50.000 MAU; có thể pause sau một tuần không hoạt động; không có automatic backups | Nén ảnh, tổng hợp analytics, theo dõi dung lượng; tự sao lưu; kiểm tra readiness trước ca |
| Cloudflare Workers Free | 100.000 request/ngày; 10 ms CPU/lần gọi | Cache/public static, API ngắn; đo CPU với auth/SSR/SQL thật. CPU không phải thời gian chờ mạng |
| Vercel Hobby | Chỉ cá nhân, phi thương mại theo tài liệu | Không mặc định chọn cho website tổ chức hoặc bản bán. Xác minh điều khoản hoặc chọn nền tảng/gói phù hợp |
| Domain, mail, SMS, backup ngoài hệ thống | Chưa xác nhận dịch vụ và chi phí | Không hứa toàn bộ vận hành luôn 0 đồng; SMS/gọi tự động chưa nằm trong tích hợp đầu |

Nguồn: [Supabase pricing](https://supabase.com/pricing), [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

“Unlimited API requests” không có nghĩa database, băng thông hay CPU vô hạn. MAU không phải số khách ẩn danh xem sách. Số request của trình duyệt cũng không đồng nhất số truy vấn database.

Không chờ vượt quota mới xử lý: cảnh báo đề xuất ở 60% và 80% giới hạn theo kỳ; dự báo tốc độ tăng; tắt endpoint không thiết yếu khi bị lạm dụng; không tự nâng gói hoặc bỏ trần chi phí. Mức cảnh báo là chính sách đề xuất, không phải tính năng đã cấu hình.

## 7. Đo hiệu năng và cổng chọn công nghệ

Prototype kỹ thuật cần thực hiện trước khi khóa stack:

1. Một trang sách công khai có HTML, ảnh, cache và một màn hình quản lý có auth.
2. Một use case mượn và một use case chuyển tiếp/hoàn tiền bằng transaction SQL.
3. Hai người cạnh tranh cùng bản sách; gửi trùng; rollback giữa chừng; mất response sau commit.
4. Kiểm tra endpoint Supabase trực tiếp; nội bộ username/mật khẩu do admin cấp tách khách Google trùng email liên hệ; chuyển cựu làm mất quyền ghi, quyền đọc tiền/PII nhạy cảm và quyền xuất file khi phiên đang mở; tài khoản khóa bị chặn. Thử cả file xuất đã tạo, private links và cache, không chỉ nút UI.
5. Đo từ mạng Việt Nam trên điện thoại/laptop, gồm cache nóng/lạnh, đăng nhập, SSR, query và giờ cao điểm. Bộ tải cơ sở gồm năm người ghi đồng thời và kịch bản dưới 100 lượt mượn/trả/buổi; thêm trường hợp cả năm cùng thao tác một bản hoặc cùng phiếu. Dataset thử có thể dùng 5.000 bản sách giả làm mốc kiểm tra, không diễn giải đây là số bản thực đã kiểm kê.
6. Ghi CPU Worker, wall time, p50/p95, lỗi, số query/transaction, kết nối, egress và cache hit; kiểm tra phiên bản runtime thực.
7. Thử import một mẫu Excel tổng hợp và xếp lịch có cả người chính/hỗ trợ, điều kiện đã đào tạo, khoảng chuẩn bị/thu dọn, lịch theo tuần và trường hợp thiếu người. Không thử xây bộ gom nhiều mẫu trường. Đo thời gian/CPU/bộ nhớ; chưa chốt khả năng xử lý trong giới hạn miễn phí chỉ từ việc API mượn–trả đạt. Xác định xử lý giới hạn hay tác vụ nền theo kết quả đo, không thêm dịch vụ nền/solver mới trước khi có nhu cầu và số liệu.
8. Thử một đơn Form từ lúc gửi thật tới lúc thấy trên web, bao gồm retry/đẩy trùng/mất response; xuất Excel/PDF có tiếng Việt và số liệu đúng. Các tích hợp và xuất file cũng cần phù hợp runtime/quota, không suy ra khả thi chỉ từ trang web cơ bản.

Mục tiêu đề xuất để thảo luận: LCP công khai ở phân vị 75 ≤ 2,5 giây; thao tác mượn/trả p95 ≤ 1,5 giây khi mạng ổn định; tìm sách p95 ≤ 700 ms. Đây là mục tiêu nghiệm thu, chưa phải kết quả hay cam kết SLA. Mức ghi đồng thời đã có cơ sở 3–5 người; tải khách công khai, số bản vật lý và dung lượng nội dung vẫn cần bổ sung. Không suy ra gói miễn phí đủ chỉ từ số lượt trực sách.

Edge gần người dùng không làm DB một vùng tự biến thành DB toàn cầu. Chọn vùng database phù hợp người dùng Việt Nam, giảm round trip bằng query/use case gọn và đo thực tế. Báo cáo lớn chạy theo kỳ/phân trang hoặc snapshot; không khóa quầy sách trong lúc tổng hợp năm.

Nếu prototype không đạt miễn phí: trước hết giảm CPU/query/ảnh và cache hợp lý; sau đó so lựa chọn framework/hosting hoặc đề xuất gói nhỏ với chi phí rõ. Không hạ kiểm tra quyền hay tách transaction để vừa quota.

## 8. Vận hành và đường nâng cấp

Môi trường dev dùng dữ liệu giả; staging tách dữ liệu; bản vận hành có secrets/quyền riêng. Migration có kế hoạch sao lưu và khôi phục; không đưa dữ liệu thật vào preview hoặc repository. CI chạy lint/typecheck, test nghiệp vụ, integration PostgreSQL, kiểm quyền, build và kiểm tra dependency.

Khởi đầu một DB và một ứng dụng. Khi có số liệu: tối ưu index/phân trang và cache công khai; tăng gói DB hoặc Worker đúng nút nghẽn; chuyển file/analytics nếu có lý do; cuối cùng mới cân nhắc tách dịch vụ. Không nâng theo số tài khoản đơn thuần.

Rời Supabase phải mang theo được dữ liệu PostgreSQL, file, định danh/quyền và phương án chuyển Auth. Managed Auth/Storage vẫn tạo phụ thuộc nhà cung cấp; không hứa đổi nhà cung cấp chỉ bằng sửa connection string. Khi bán bản riêng cần mẫu provisioning, cập nhật phiên bản, điều khoản sử dụng và trách nhiệm hỗ trợ; chưa xây các phần đó trong phạm vi ban đầu.

## 9. Đồng bộ Google Form tự động — đề xuất cần prototype

Hướng ưu tiên cho quy mô CLB: Apps Script gắn với Form, dùng installable form-submit trigger để gửi đơn qua HTTPS tới endpoint nhập đơn của ứng dụng. Google hỗ trợ trigger khi gửi Form; trigger chạy theo tài khoản người tạo và có quota. Vì vậy chủ sở hữu/ủy quyền nên là tài khoản CLB có bàn giao, không phụ thuộc tài khoản cá nhân sắp nghỉ. [Google: Installable Triggers](https://developers.google.com/apps-script/guides/triggers/installable), [quota](https://developers.google.com/apps-script/guides/services/quotas).

Thiết kế đề xuất của dự án:

- Mỗi phản hồi có khóa Form ID + response ID, giữ ánh xạ câu hỏi theo ID/phiên bản; không dựa duy nhất vào tên cột hay số điện thoại để chống trùng. [Google: FormResponse](https://developers.google.com/apps-script/reference/forms/form-response).
- Endpoint xác thực bằng chữ ký/secret riêng cho tích hợp, giới hạn thời gian/replay và kích thước; không mở quyền nhập đơn cho khách ẩn danh, không nhúng secret vào Form công khai.
- Chỉ xác nhận thành công sau khi lưu bền trong DB; retry cùng đơn không tạo ứng viên thứ hai. Có kiểm tra/đối soát nguồn và nút đồng bộ bù khi trigger bị lỗi/hết quota; không yêu cầu ứng viên gửi lại đơn để sửa lỗi tích hợp.
- Dữ liệu Form và dữ liệu chấm trên web tách nguồn: sync lại không xóa điểm, sửa điểm hoặc quyết định; thay câu hỏi/cập nhật đơn phải có lịch sử và cảnh báo ánh xạ lỗi.
- Dashboard nội bộ hiển thị trạng thái, lỗi, lần đối soát và thời điểm đơn đến. Ngưỡng trễ mục tiêu phải đo/chốt; không cam kết sự kiện tới tức thời tuyệt đối.

Phương án khác là Forms API watch + Cloud Pub/Sub; cần xét billing, cấu hình và gia hạn watch. Chưa ưu tiên thêm hạ tầng đó khi Apps Script đáp ứng được. [Google: push notifications](https://developers.google.com/workspace/forms/api/guides/push-notifications). Hiện chưa tạo trigger, Cloud project, secret hoặc kết nối tài khoản cho ứng dụng.

## 10. Facebook và xuất báo cáo

Đã chốt website tạo sẵn nội dung/link lịch để người phụ trách sao chép và đăng nhóm Facebook. Lưu phiên bản lịch/nội dung xuất và trạng thái người phụ trách xác nhận đã đăng; không gắn nhãn “đã gửi” khi chỉ mới sao chép. Không cần token, cookie, mật khẩu hoặc bot đăng nhập Facebook trong phạm vi hiện tại. Giai đoạn này chỉ thiết kế, chưa đăng bài nào.

Ghi nhận khảo sát cũ để rõ bằng chứng: công cụ web nhận HTTP 429 khi đọc [changelog Meta v19](https://developers.facebook.com/docs/graph-api/changelog/version19.0/) và [thông báo Meta liên quan](https://developers.facebook.com/blog/post/2024/01/23/introducing-facebook-graph-and-marketing-api-v19/) ngày 18/10/2026; chưa kết luận đường API tự đăng hiện tại. Do chủ sản phẩm đã chọn người phụ trách đăng, việc xác minh tự đăng không còn là điều kiện hoàn thành bản đầu.

Excel và PDF dùng cùng snapshot/bộ lọc/ngày nghiệp vụ và cùng nguồn tổng hợp. Prototype kiểm font tiếng Việt, phân trang, tổng tiền, quyền xuất, dung lượng và CPU/bộ nhớ; chọn thư viện/cách sinh file sau khi có mẫu, không thêm headless browser hay dịch vụ xuất file chỉ vì giả định cần. Báo cáo riêng tư không có URL công khai lâu dài; giữ thông tin người/kỳ tạo và hạn truy cập phù hợp.
