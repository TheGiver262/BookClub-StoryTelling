# Prompt giao Antigravity: thiết kế hệ thống, diagram và backend YSBK

Mở workspace `F:\Codex Project\YSBK` trong Antigravity rồi sao chép phần dưới. Prompt này bổ sung phần thiết kế phần mềm/backend cho prompt nhận diện và UI trước đó. Lượt giao việc này cần bộ thiết kế kỹ thuật có thể triển khai và bằng chứng thử kỹ thuật ở local; chưa phải lệnh xây xong toàn sản phẩm hoặc triển khai production.

---

Bạn là Antigravity, chịu trách nhiệm thiết kế hệ thống và backend cho website quản lý CLB Yêu Sách Bách Khoa Hà Nội (YSBK). Hãy làm việc như kiến trúc sư đồng thời phải chịu trách nhiệm cho tính khả thi khi lập trình: quyết định có lý do, diagram phản ánh đúng thiết kế, schema/API nhất quán và luồng tiền/quyền kiểm chứng được.

## 1. Mục tiêu và phạm vi

Từ yêu cầu đã phỏng vấn, tạo bộ thiết kế phần mềm đủ chi tiết để người phát triển tiếp theo xây backend và nối với frontend mà không phải đoán quy tắc tiền, trạng thái hoặc quyền.

Phải làm đủ:

- Phạm vi hệ thống/use case, kiến trúc và phân chia module backend.
- Mô hình domain, trạng thái, dữ liệu PostgreSQL, migration SQL đề xuất và quy tắc toàn vẹn.
- API contract cho đủ chín nhóm chức năng; auth/authorization và DTO công khai/nội bộ/cựu.
- Giao dịch mượn–trả/cọc/phạt/quỹ/bán lô; khóa, idempotency và sửa sai.
- Đồng bộ Google Form, nhập lịch và tự đề xuất phân ca, báo cáo, audit/analytics.
- Bảo mật, threat model, chống lạm dụng, hạ tầng miễn phí, backup/restore và đường scale.
- Diagram có source sửa được, bản render đọc được, chú giải và mô tả.
- Kế hoạch triển khai backend theo các lát chức năng, kế hoạch test và các bài thử kỹ thuật local cần thiết.

Đây không phải nhiệm vụ làm lại landing page/UI. `design.md` nếu đã có là nguồn chuẩn giao diện; kiến trúc/backend nằm trong tài liệu kỹ thuật riêng và dẫn chiếu qua lại. Không nhét schema, secrets hoặc cấu hình hạ tầng vào bộ nhận diện.

Lượt này được tạo tài liệu, diagram, hợp đồng API, SQL và PoC kỹ thuật cô lập bằng dữ liệu giả ở local. Không tự tạo cloud project/tài khoản, mua gói, deploy, chạy migration trên DB thật, nhập PII thật, gửi thông báo hoặc commit/push. Không tự mở rộng thành triển khai toàn bộ nghiệp vụ production. Tuân thủ AGENTS.md; giữ sửa đổi người dùng; không dùng subagent khi chưa có cho phép của người dùng.

## 2. Đọc workspace và giữ nguồn chuẩn

Đầu tiên kiểm kê trạng thái hiện có: chỉ có tài liệu hay đã có frontend/backend, file nào do lượt trước tạo, câu hỏi nào đã trả lời. Đừng giả định prompt UI đã được thực hiện. Đọc:

1. `README.md`.
2. `docs/01-khao-sat-giai-phap.md`.
3. `docs/02-pham-vi-va-nghiep-vu.md`.
4. `docs/03-kien-truc-va-ha-tang.md`.
5. `docs/04-bao-mat-du-lieu-seo.md`.
6. `docs/05-roadmap-va-nghiem-thu.md`.
7. `docs/06-phong-van-va-quyet-dinh.md`.
8. `docs/07-doi-chieu-tai-lieu-clb.md`.
9. `docs/08-ma-tran-quyen-va-dang-nhap.md`.
10. `design.md` và frontend nếu đã tồn tại; prompt UI `docs/prompts/antigravity-design.md` để biết hợp đồng bàn giao trước.

Quyết định mới nhất đã xác nhận trong chat/sổ phỏng vấn ưu tiên hơn tài liệu cũ hoặc diễn giải của bạn. Không tự sửa quyết định đã chốt vì framework/provider thuận tiện hơn. Gặp mâu thuẫn thì ghi rõ nguồn và ảnh hưởng; chỉ hỏi điểm thật sự chặn quyết định tiền/quyền/dữ liệu, vẫn tiến hành phần độc lập. Không mở lại toàn bộ cuộc phỏng vấn.

Tham khảo WarePro ở `F:\Codex Project\ProductManagement_Antigravity` theo cách đọc: nguồn chuẩn, stock ledger, transaction, state machine, service authorization, audit và concurrency. Tìm đúng file/thành phần hiện có; không chỉnh project đó hoặc bê tầng WPF/MVVM sang web. Đọc source không có nghĩa đã chạy hoặc kiểm chứng runtime.

Với hành vi SDK/Auth, runtime, pooling, quota, billing và điều khoản dịch vụ, kiểm tra tài liệu chính thức hiện tại, ghi URL/ngày/phiên bản. Nguồn khảo sát cũ là đầu vào, không phải bảo đảm tính năng vẫn như cũ. Không hứa miễn phí hoặc có tính năng bảo mật chỉ từ tên nhà cung cấp.

## 3. Ràng buộc sản phẩm và hướng kiến trúc

Một CLB duy nhất. Tương lai bán các bản triển khai riêng, chưa cần multi-tenant chung DB. Khoảng vài nghìn sách, dưới 5.000 theo ước lượng; hai kho; dưới 100 lượt mượn/trả một buổi; 3–5 người cùng nhập. Số đầu sách/bản vật lý và lượng khách công khai chưa được đo. Một người phát triển/bảo trì với AI code chính, mục tiêu khoảng một tháng và bản đưa vào dùng đầu đủ chín nhóm chức năng.

Ưu tiên đánh giá hướng đã đề xuất: TypeScript, Astro + React, API trên Cloudflare Workers, PostgreSQL trên Supabase và managed Auth. Đây là ứng viên, không bắt buộc chứng minh nó tốt bằng cách bỏ qua nhược điểm. Nếu Auth/runtime/quota không phù hợp, đề xuất thay đúng phần có vấn đề, có phương án migration và tác động chi phí. Không đổi stack chỉ vì thị hiếu hoặc benchmark không liên quan.

Hướng mặc định: một ứng dụng triển khai, chia module nghiệp vụ trong code, PostgreSQL là nguồn dữ liệu chuẩn. Browser gọi API; máy chủ xác thực/kiểm quyền/validate; use case thực hiện transaction SQL; commit nghiệp vụ cùng audit cần thiết; trả biên nhận. Không để React điều phối chuỗi REST request độc lập như thể đó là một transaction.

Không thêm microservices, Kubernetes, Kafka, Redis, search engine ngoài, event sourcing hoặc CQRS thành nhiều kho dữ liệu khi chưa có vấn đề cụ thể. Queue/outbox/checkpoint bền chỉ dùng ở chỗ tích hợp/tác vụ thực sự cần. Một interface nhỏ che được quy tắc phức tạp tốt hơn nhiều lớp chuyển tiếp không có hành vi.

## 4. Thiết kế domain và module backend

Lập danh sách module, trách nhiệm, dữ liệu sở hữu, interface/use case chính, dependency được phép và quy tắc gọi xuyên module. Dùng danh từ/thao tác nghiệp vụ nhất quán giữa tài liệu, diagram, API và SQL.

Tối thiểu bao phủ:

| Module | Trách nhiệm cần thiết kế |
|---|---|
| Identity/access | Khách, nội bộ, username, trạng thái thành viên/khóa, admin, kiểm quyền và thu hồi |
| Catalog/inventory | Đầu sách/ấn bản/bản sách, nhiều thể loại, tác giả/NXB, hai kho/vị trí bàn, lịch sử dịch chuyển/tình trạng |
| Circulation | Người mượn, phiếu tối đa hai cuốn, dòng mượn, trả/chuyển tiếp, hạn/gia hạn, phạt/mất/nhắc gọi |
| Finance | Hai quỹ, hộp tiền/phiên quầy, tiền mặt/ngân hàng, cọc, bút toán/chứng từ, đối soát/sửa sai |
| Members | Hồ sơ, ban/chức vụ/lịch sử, trường/năm/khóa, hội phí một lần, trạng thái cựu |
| Duty | Lịch bận/import, điều kiện trực chính, ca/vai trò, đề xuất/chỉnh tay/công bố/điểm danh |
| Recruitment | Đợt/Form/đơn/nguyện vọng, lịch phỏng vấn, rubric phiên bản, điểm riêng/chung/sửa, quyết định/công bố |
| Activities/events/sales | Kế hoạch/nhiệm vụ/ngân sách/người tham gia; lô sách mới, bán thu ngay, nợ/cọc/trả dư/quyết toán nhà sách |
| Content | Review, bình luận/đánh giá/cảm nhận, hàng chờ duyệt và phiên bản xuất bản |
| Reporting/audit | Báo cáo/dashboard, Excel/PDF, audit toàn hệ thống và analytics công khai được tách mục đích |

Số module code không bắt buộc trùng số FR; được gộp mục nhỏ nếu giảm phức tạp, nhưng phải truy vết đủ FR-01…09. Tránh vòng dependency giữa circulation và finance: chỉ rõ use case nào điều phối transaction và interface ghi sổ được gọi; đừng giải quyết bằng hai transaction rời rồi mong chúng luôn khớp.

Phân biệt bắt buộc: tài khoản ≠ thành viên ≠ người mượn; đầu sách ≠ bản sách; vị trí ≠ trạng thái mượn; phiếu mới ≠ sách đã trả vật lý; quỹ ≠ phương thức/nơi giữ tiền; tiền hiện có ≠ cọc phải hoàn ≠ doanh thu; cọc nhà sách ≠ cọc của bạn đọc. Không dùng một bảng/enum/field chung để xóa mất các khác biệt này.

## 5. Database, schema và toàn vẹn

Giao ERD và từ điển dữ liệu: tên bảng/trường, kiểu, ý nghĩa, nullable/default, PK/FK/unique/check, index, phân loại dữ liệu và chính sách lưu/xóa. Mỗi quan hệ nêu cardinality và hành vi khi ngừng sử dụng/xóa. Đầu ra SQL có thể kiểm trên PostgreSQL local sạch; không chỉ liệt kê tên bảng.

Các nhóm dữ liệu phải được mô hình hóa đầy đủ:

- Thư mục sách, tác giả/thể loại/ấn bản; bản mượn, vị trí/biến động, giá có thể chưa biết, trạng thái review.
- Người mượn, phiếu/dòng, kỳ hạn/renewal, liên kết chuyển tiếp và lịch sử giữ vật lý; quyết định phạt và các lần tất toán.
- Khoản nhận cọc/phân bổ/nghĩa vụ, chi hoàn/giữ cọc; phiên quầy/mở đóng/thực đếm/chênh lệch; quỹ, tài khoản tiền, journal/entries và liên kết nguồn nghiệp vụ.
- Tài khoản ứng dụng/ánh xạ managed identity, hồ sơ thành viên, quan hệ ban/chức vụ theo thời gian, đủ điều kiện trực chính và hội phí.
- Lịch bận theo phạm vi hiệu lực, đợt import, ca, phân công/vai trò, phiên bản lịch công bố, điểm danh.
- Đợt tuyển, ánh xạ nguồn Form/response/câu hỏi, hồ sơ/nguyện vọng, cuộc phỏng vấn/câu hỏi/trả lời/bài viết, rubric và điểm riêng/chung/lịch sử chỉnh, quyết định/phân ban/công bố.
- Nhà sách, lô/dòng nhận, giá/chiết khấu snapshot, lượng bán/trả/giữ, cọc nhà sách, phải trả và settlement.
- Hoạt động/sự kiện, người tham gia/nhiệm vụ/dự toán/chi liên kết finance; nội dung/review/kiểm duyệt; yêu cầu xuất báo cáo, audit và dữ liệu analytics tối thiểu.

Tiền dùng số nguyên VND, không float; nêu giới hạn và cách serialize sang JSON không mất chính xác. Ngày nghiệp vụ dùng `Asia/Ho_Chi_Minh`, timestamp kỹ thuật UTC; ngày đến hạn là ngày, không là số giờ tùy tiện. Lưu snapshot cọc/giá/chính sách cần thiết để sửa danh mục không thay chứng từ cũ.

Nêu cơ chế thực thi thật cho: tối đa hai dòng/phiếu dưới tải đồng thời; chỉ một khoản mượn đang hiệu lực trên một bản; tổng cọc hoàn/giữ/chuyển không vượt số đã nhận; không bán quá lượng khả dụng; journal cân và chỉ post một lần cho một nguồn nghiệp vụ; không đóng hai lần cùng phiên quầy. Phân biệt constraint ở DB và kiểm ở use case; không đề xuất CHECK tham chiếu tổng nhiều hàng nếu PostgreSQL không thực thi như mô tả.

Tài liệu phải giải thích index cho truy vấn thật: tìm sách/khả dụng, phiếu đến hạn/người mượn, quầy theo kỳ, cọc còn phải hoàn, danh sách tuyển/lọc điểm, lịch theo ngày và audit. Tìm kiếm tiếng Việt có dấu/không dấu cần nêu cách chuẩn hóa/index và đánh giá ở quy mô này trước thêm dịch vụ tìm kiếm.

Không đặt số điện thoại làm định danh duy nhất tuyệt đối hoặc tự hợp nhất người chỉ từ điện thoại/email. Import có nguồn/id/chính sách phát hiện trùng và bước đối chiếu. Bản ghi đã có chứng từ không hard delete phá FK/lịch sử; yêu cầu xóa/ẩn danh PII cần thiết kế theo chính sách lưu giữ sẽ chốt.

SQL draft phải ghi rõ baseline/version DB, extension nếu dùng, migration order, transaction áp dụng, dữ liệu seed giả và cách reset chỉ DB local dùng một lần. Schema không phải production-ready nếu chưa validate. Không bịa hash mật khẩu hoặc chèn user giả vào bảng managed Auth theo cách không được hỗ trợ.

## 6. Thiết kế tiền và transaction ở mức có thể code

Đây là phần ưu tiên cao nhất. Giao bảng chuyển trạng thái, pseudocode transaction và ví dụ trước/sau cho ít nhất: cho mượn, trả hết, trả một phần, gia hạn, mất sách, hoàn chậm, mở/đóng ca, bán/trả dư/quyết toán lô, đảo điều chỉnh.

Với mỗi use case ghi: precondition, quyền, dữ liệu cần đọc/khóa, thứ tự khóa thống nhất, isolation/conditional update, phép tính phía máy chủ, mutation/bút toán/audit cùng transaction, idempotency key, response/biên nhận, lỗi/rollback và xử lý mất response sau commit. Kiểm quyền thay đổi đồng thời phải có quy tắc rõ; không chỉ kiểm role một lần ở middleware rồi dùng dữ liệu quyền cũ vô thời hạn.

Các bất biến cần chứng minh:

- Cọc theo từng bản sách: `max(50000, floor((gia + 25000) / 50000) * 50000)` cho giá hợp lệ; không giá mặc định 50k và giữ giá chưa biết; không trần 200k. Cọc snapshot không bị đổi ngược khi giá đổi.
- Phiếu tối đa hai quyển; chưa có giới hạn tổng nhiều phiếu một người. Mượn cộng đúng 14 ngày: 1/10 → 15/10; trong hạn gia hạn cộng hạn cũ; quá hạn chốt phạt rồi tính từ ngày gia hạn; ba lượt cùng phiếu. Chỉ chuyển tiếp do trả một phần mới reset vòng theo quyết định đã chốt.
- Hạn hết ngày Việt Nam, trực thứ Ba/thứ Năm; ngày đến hạn trùng lịch nghỉ lễ/Tết dời đến buổi thực tế tiếp theo, không trừ lượt gia hạn. Ngoại lệ hủy đột xuất/lễ xen giữa khoảng đã quá hạn còn cần chốt, không tự viết chính sách phạt mới.
- Phạt 1k/ngày cho cả phiếu; mức gợi ý, mức chốt, lý do miễn/giảm và thực thu/tất toán là các thông tin khác. Không thu lại khoảng phạt đã chốt khi gia hạn sau quá hạn.
- Một cuốn cọc 50k, phạt 49k: hoàn 50k và thu 49k riêng; phạt từ 50k thì giữ cọc, không thu thêm. Mất sách giữ khoản cọc tương ứng, không dùng cùng khoản cọc để phạt/hoàn/mất hai lần.
- Phiếu hai cuốn cọc 150k, phạt 60k, trả hết: hoàn 150k và thu 60k riêng. Trả một cuốn và giữ một: tất toán phạt cũ; cọc còn nguyên cho cuốn giữ được chuyển liên kết, không nhập kho hoặc thu–hoàn giả. Ghi thời gian giữ vật lý xuyên phiếu.
- Cọc cũ 150k dùng hết làm phạt, trả cuốn cọc 50k/giữ cuốn cọc 100k: giữ 150k cũ, nhận mới 100k cọc; không hoàn 50k hoặc chuyển lại 100k đã dùng. Tiền thực tăng 100k, không tăng 250k. Chưa nhận cọc mới thì không ghi đã thu hoặc cho cuốn giữ thành sách sẵn có.
- Trả sách và hoàn tiền có thể khác thời điểm. Giữ nghĩa vụ chờ hoàn, nhận diện khoản chi và người xác nhận; không nhầm trả sách thành tiền đã giao. DB transaction không đảo được tiền đã giao tay/chuyển ngân hàng, nên phải có bước xác nhận thực tế, trạng thái và cách phục hồi thao tác dở dang.
- Hai quỹ tách riêng; một hộp tiền chung/buổi, người trực chính kiểm đầu/cuối, không đổi người giữ giữa buổi. Năm người nhập không tạo năm số dư đầu. Tiền cất tủ qua buổi sau không là chi/thu mới.
- Tiền mặt/ngân hàng độc lập, hoàn khác phương thức lúc nhận được phép. Kiểm giao dịch qua app ngân hàng do người dùng thực hiện; QR/loa/ảnh chụp không tự chứng minh thanh toán. Chưa có yêu cầu tự ra lệnh ngân hàng.
- Số thực đếm và số dự kiến được giữ nguyên để giải trình lệch, không tự sửa journal cho khớp hoặc bù quỹ hoạt động. Thu phạt/giữ cọc thuộc quỹ nào còn cần chốt; không âm thầm chuyển quỹ.
- Sách bán mới tách kho mượn; nhận trước không cọc/cọc nhỏ, chỉ CLB nợ nhà sách, khách trả ngay; không đặt trước hoặc đổi/hoàn cho khách.
- Lô 100 giá nhập 65k, bán 60/trả dư 40: phải trả 3,9 triệu, không nhận hoàn 2,6 triệu khi chưa cọc. Nếu cọc nhà sách 1 triệu thì nhận hoàn riêng 1 triệu, trả riêng 3,9 triệu, không ghi một khoản ròng 2,9 triệu. Nhận hoàn cọc không phải doanh thu; trả nợ không ghi giá vốn lần hai. Lượng giữ tiếp và nghĩa vụ thanh toán của nó phải theo thỏa thuận chưa chốt.

Thiết kế sổ kép nội bộ tối thiểu đủ giữ tiền/cọc/nợ/quỹ và truy nguồn; không phát triển hệ kế toán thuế/ERP tổng quát. Chứng từ đã post bất biến, sửa bằng đảo/điều chỉnh có liên kết/lý do/người làm. Snapshot/tổng hợp không là nguồn chuẩn có thể sửa riêng.

Idempotency cần có phạm vi, unique, hash payload, xử lý đang chạy/thành công/thất bại, quyền xem kết quả và thời gian lưu hợp lý. Cùng key khác payload phải lỗi; khác key cùng nguồn nghiệp vụ vẫn có ràng buộc ngăn ghi hai lần. Không hứa exactly-once trên mạng: dùng nhận lại/retry và ràng buộc bền để đạt một hiệu lực nghiệp vụ.

## 7. Auth, quyền và bảo mật backend

Thiết kế đủ mô hình danh tính và lifecycle, không dừng ở bảng role:

- Khách dùng Google hoặc email/password; nội bộ username riêng/password do admin cấp; không dùng Google khách để nhận quyền nội bộ.
- Thành viên hoạt động quản lý mọi nghiệp vụ, không tự chia quyền theo ban; chỉ admin quản lý tài khoản và nhật ký toàn hệ thống.
- Cựu còn đăng nhập nhưng chỉ xem hoạt động đã lọc trường; không PII nhạy cảm, hồ sơ tuyển/người mượn, tiền/số tài khoản, export hoặc mutation. Khóa tài khoản là trạng thái riêng. Xử lý đặc quyền admin cũ để không vượt chế độ cựu.
- Chuyển cựu/khóa có hiệu lực với request mới và phiên còn mở; nêu cách thu hồi/invalidate và xử lý giao dịch/tác vụ nền cạnh tranh. JWT role cũ hoặc ẩn menu không đủ.

Managed Auth ưu tiên, không tự lưu/kiểm thuật toán mật khẩu. Supabase Auth có vấn đề cần chứng minh: username không phải mặc nhiên native và cùng email có thể liên kết OAuth. Nêu phương án cụ thể, thử public signup/link/reset/change email/add password và gọi thẳng endpoint provider để chắc khách không quản trị credential nội bộ. Không dựa vào alias khó đoán, client flag/provider hoặc chỉ kiểm email/user ID. Nếu không chứng minh được, đề xuất thay Auth thích hợp, không đổi yêu cầu sang email hoặc giảm cách ly.

Nêu cấp tài khoản/chuẩn hóa username/unique, mật khẩu ban đầu/recovery/reset/đổi/khóa, MFA, session/cookie/CSRF/Origin, OAuth state/PKCE và quản trị secrets. Admin key chỉ phía máy chủ; giới hạn quyền/khu vực dùng. Không tự tạo project hoặc yêu cầu đưa secret vào chat để hoàn thiện tài liệu.

Hướng hiện tại browser không đọc trực tiếp bảng nghiệp vụ qua Supabase Data API. Nêu grants/DB role ít quyền và tắt API không dùng; nếu đề xuất mở bảng/RPC thì phải có lý do, grants/RLS và test direct access. SQL đặc quyền không tự được bảo vệ bởi RLS; Auth/Storage của nhà cung cấp không mặc nhiên nằm sau rule Cloudflare.

Lập threat model có asset/tác nhân/đường vào/trust boundary; mỗi nguy cơ nối với kiểm soát và test: chiếm tài khoản nội bộ, broken object/function authorization, lộ PII qua DTO/cache/file/export/log, SQL injection, XSS, CSRF, callback giả/replay, file/Excel độc hại, vét dữ liệu, DDoS/cạn quota và backup bị truy cập. Không liệt kê OWASP rồi bỏ trống áp dụng cụ thể.

Có validation giới hạn request/query/file/giải nén/dòng sheet, query tham số, sanitize nội dung, private file và download kiểm quyền hiện tại, xử lý CSV formula injection. Audit ghi đủ actor/action/target/time/request/result cần thiết, không raw token/password hoặc sao chép toàn bộ PII; analytics tổng hợp không đồng nhất audit. Nhật ký chỉ ở cùng DB không được gọi là chống sửa tuyệt đối trước người có quyền DB/hạ tầng.

Mọi thành viên có quyền rộng là quyết định sản phẩm; không tự thu hẹp. Giải thích rủi ro còn lại và kiểm soát tương ứng. Đề xuất retention/ẩn danh và recovery RPO/RTO có nhãn chưa chốt; nếu viện dẫn quy định pháp luật thì kiểm nguồn chính thức hiện hành, không bịa nghĩa vụ hoặc gọi bộ thiết kế là chứng nhận tuân thủ.

## 8. API contract và frontend integration

Giao OpenAPI theo phiên bản công cụ hỗ trợ, validate được; bao phủ đủ chín FR. Mỗi operation có operationId, route/method, quyền, request/query/body, response DTO, pagination/filter/sort, status/error, idempotency/concurrency và liên kết use case. Dữ liệu ví dụ là giả.

Không chỉ sinh CRUD cho mỗi bảng. Cần endpoint/use case có ý nghĩa như open/close cash session, issue loan, settle return/partial carry-forward, renew, record loss, confirm receipt/refund, reverse posted correction, propose/publish roster, ingest/reconcile Form, revise grade, publish result, approve content, return supplier lot và settle supplier payment. Có thể gộp/sắp tên khác nếu interface rõ và transaction đúng.

Phân tách DTO công khai/nội bộ/cựu; không tái dùng entity DB rồi xóa vài field tùy role ở client. Phải chỉ rõ field allowlist của hoạt động dành cho cựu, file đính kèm và nội dung tự do có thể chứa tiền/PII. Field công bố tuyển chưa chốt phải mặc định không đưa PII ra public.

Thiết kế truy vấn tìm kiếm/phân trang bounded, tránh N+1 và trả toàn bộ hồ sơ; lỗi có mã ổn định, message Việt hóa và request ID, không stacktrace/SQL/PII. Liệt kê quy ước lỗi xác thực/quyền, dữ liệu sai, xung đột bản sách/phiếu và lỗi đã commit nhưng response mất. Xử lý session/token bằng cơ chế đã chọn, không gán role mô phỏng của UI vào API thật.

Nếu frontend đã có mock adapter, lập bảng ánh xạ mock → endpoint/DTO/state thực; nêu chỗ UI cần sửa khi có pending/validation/409 hoặc quyền. Không phá token/style/layout đã duyệt. Nếu chưa có frontend, giao hợp đồng tích hợp và ví dụ request/response, không tạo lại UI trong lượt này.

## 9. Đồng bộ, xếp lịch, báo cáo và tác vụ nền

Google Form: vẫn nhận đơn ở Form, tự xuất hiện trên web; đề xuất Apps Script installable trigger nếu phù hợp. Thiết kế Form ID + response ID, ánh xạ câu hỏi version, xác thực chữ ký/secret, timestamp/replay, dedup, commit bền trước ACK, retry có backoff và đối soát bù/checkpoint. Không ghi đè điểm/ghi chú/quyết định khi sync lại. Chỉ rõ owner trigger, quota/lỗi và trạng thái lần sync cuối; không cam kết độ trễ bằng 0. API nguồn không có transaction chung với PostgreSQL.

Lịch: chỉ nhận một mẫu Excel tổng hợp do hậu cần chuẩn bị; không OCR hoặc gom mẫu từng trường. Hợp đồng import, preview lỗi/dedup/version, phạm vi tuần/ngày rõ; dòng parse lỗi không thành “rảnh”. Đề xuất thuật toán đơn giản khả thi cho quy mô CLB, hard constraints tách fairness mềm, nêu pseudocode/độ phức tạp/giới hạn và tình huống thiếu người. Không hứa tìm tối ưu toàn cục khi chưa chứng minh.

Hai người chính cùng đủ 14–17, đã đủ điều kiện; hỗ trợ rảnh hai khoảng đầu/cuối và có thể bận giữa. Mốc chuẩn bị/thu dọn đang có phần tạm phải ghi rõ. Chỉnh tay vẫn kiểm điều kiện; lịch nháp/công bố version, tạo lại đề xuất không ghi đè sửa tay hoặc lịch đã công bố âm thầm. Cựu không được xếp mới. Facebook chỉ soạn nội dung/link cho người phụ trách đăng.

Tuyển: rubric theo đợt/version; điểm riêng/chung và lịch sử sửa không bị mất; công thức/trọng số lấy từ mẫu, không tự chọn trung bình. Hội phí khoảng 100k một lần, actual receipt có chứng từ, không sinh hằng năm.

Báo cáo: tuần/tháng/quý/năm, dashboard và báo cáo riêng; cùng nguồn/snapshot/bộ lọc cho HTML/Excel/PDF; khớp chứng từ, giá trị tiền và quyền. Tải lớn có giới hạn/time budget/concurrency, nêu cách xử lý async nếu cần và thử trong quota runtime. Không mặc định thêm headless browser, hàng đợi ngoài hoặc cron service khi chưa có nhu cầu. File private có TTL và download authorization; cựu không tạo/tải export.

## 10. Bộ diagram bắt buộc

Vẽ diagram thực, không chỉ ghi “sẽ vẽ”. Chọn Mermaid source hoặc draw.io nguồn sửa được phù hợp công cụ; thống nhất tên với schema/API. Source lưu ở `docs/technical/diagrams/`, render SVG/PNG và có mục lục kèm mô tả. Không bắt buộc làm cùng một sơ đồ bằng hai công cụ. Nếu không render được, vẫn giao source, lệnh và blocker, không gọi đã kiểm hình.

| Nhóm | Diagram phải trả lời |
|---|---|
| 1. System context/use cases | Khách, thành viên hoạt động, cựu, admin, Google Form/Auth/ngân hàng thủ công; ai dùng chức năng nào, đâu là ngoài hệ thống |
| 2. C4 container và backend modules | Browser/SSR/API/DB/Auth/Storage/trigger ở đâu, luồng gọi và quyền truy cập; module/interface/dependency; container không mặc định là Docker |
| 3. ERD | Tổng quan đủ domain, có bản phóng phần mượn–trả/cọc/journal và lô bán/tuyển nếu tổng quan quá dày; PK/FK/cardinality khớp SQL |
| 4. State machines | Bản sách, phiếu/dòng/chuyển tiếp, nghĩa vụ cọc/chi hoàn, phiên quầy; thành viên so với khóa tài khoản; tuyển/đánh giá/công bố. Không gộp trạng thái vật lý/tiền vào một enum mơ hồ |
| 5. Sequence giao dịch lõi | Cho mượn; trả/chuyển tiếp hai nhánh cọc còn/cọc hết; gia hạn quá hạn; có transaction/lock/commit/audit, retry/xung đột/mất response và bước người xác nhận tiền |
| 6. Sequence danh tính/quyền | Nội bộ username với managed Auth, khách Google cùng email liên hệ, đổi cựu/khóa khi phiên cũ còn mở; API/file/tác vụ nền bị kiểm ở đâu |
| 7. Sequence tích hợp/quyết toán | Form submit → callback → DB → web, retry/đối soát; lô bán/trả dư, hoàn cọc riêng và thanh toán riêng |
| 8. DFD/security | Dữ liệu public/PII/tiền/secrets đi qua trust boundary nào, endpoint nhà cung cấp trực tiếp, storage/export/log và kiểm soát tại chỗ |
| 9. Deployment/operations | Local/staging/production, app/DB/provider region, pooling/cache, đường backup/restore/cảnh báo; nền miễn phí và chỗ có thể cần nâng |

Nhóm có thể có vài hình nhỏ; không tạo sơ đồ khổng lồ khó đọc hoặc một class diagram cho mọi bảng không có ý nghĩa. Mỗi hình có mục đích/phạm vi, legend, nguồn chuẩn liên quan và nhãn “đề xuất/đã thử” phù hợp. Sequence cần có nhánh lỗi và transaction boundary, không chỉ happy path. Không vẽ ngân hàng như API web điều khiển hoàn tiền khi hiện chỉ xác nhận thủ công.

Tự render/quan sát hình: không cắt chữ, mũi tên chồng không hiểu, chữ quá nhỏ, sai cardinality hoặc dependency vòng chưa giải thích. Tách trang nếu cần; màu theo `design.md` nếu có nhưng ưu tiên tương phản và ký hiệu kỹ thuật. Diagram không được chứa secrets hoặc dữ liệu thật.

## 11. Hạ tầng, hiệu năng và vận hành

Lập bảng lựa chọn và chi phí: dịch vụ/gói/điều kiện/quota hiện hành, nguồn/ngày, phần sử dụng dự kiến, cách đo/cảnh báo, lúc nâng và ước chi phí theo dữ liệu đã có. Nếu chưa biết số request/dung lượng/chi phí thì ghi unknown và công thức, không dựng số người dùng để kết luận free đủ. SMTP/backup ngoài hệ thống có thể là chi phí riêng; không bỏ quên để hứa 0 đồng.

Nêu kết nối PostgreSQL từ Worker, driver/TLS/pool/timeout, giới hạn prepared statements/session state của mode được chọn; credentials ít quyền, migration role riêng. Cache chỉ public; private cache cần kiểm chứng, không share theo URL cho các role. Edge không tự giảm mọi round trip tới DB vùng xa. Khả năng Excel/solver/PDF phải đo CPU/bộ nhớ riêng, không suy từ API mượn trả.

Phân biệt mục tiêu và số đã đo. Kế hoạch đo gồm dataset giả quy mô khoảng 5.000 bản, năm người ghi đồng thời, cạnh tranh cùng bản/phiếu, search/report, p50/p95/CPU/egress/connection/error; không coi 5.000 là số đã kiểm kê hoặc tỷ lệ traffic công khai đã biết. Không load test production hoặc endpoint người khác.

Backup: schema/data/files/Auth/quyền và cấu hình/secrets khôi phục theo cơ chế phù hợp, mã hóa/giới hạn truy cập, bản ngoài tài khoản vận hành, retention và restore drill vào môi trường sạch. Không gọi pg_dump riêng là đã backup cả file và managed Auth hoàn chỉnh. Chủ sản phẩm đứng tên hạ tầng/backup/cảnh báo, không tự chuyển theo ban chủ nhiệm. Đề xuất RPO/RTO có lý do, ghi chờ xác nhận và phương án khi gói miễn phí không đạt.

Thiết kế triển khai/rollback/migration tương thích, health/readiness, log/metric/alert và phản ứng khi lộ secret/lệch tiền/cạn quota. Chống DDoS cần cả cache/giới hạn endpoint/query/concurrency và provider endpoints; Cloudflare không phải bảo đảm không bị tấn công. Không tự nâng gói hoặc vô hiệu hóa kiểm soát để giữ miễn phí.

## 12. Chứng minh kỹ thuật ở local

Trước khi chốt quyết định khó đổi, làm bài thử nhỏ ở môi trường dùng một lần nếu công cụ local đáp ứng; không xây toàn bộ sản phẩm để thử stack:

1. SQL schema/migration lên PostgreSQL thật sạch, seed giả; kiểm khóa/FK/check/unique và truy vấn chính.
2. Một luồng cho mượn và một luồng trả/chuyển tiếp có journal/audit/idempotency: hai client tranh cùng bản; retry; lỗi trước commit; mất response sau commit; cọc hết phải thu mới. Kiểm bằng SQL trước/sau, không chỉ HTTP 200 hoặc mock repository.
3. Skeleton adapter/runtime gọi use case SQL bằng tài khoản ít quyền; đo phần đã chạy, xác minh không đưa secret vào browser.
4. Thử auth/role/identity linking bằng cơ chế provider được hỗ trợ ở local nếu có. Nếu cần cấu hình cloud/credentials chưa được cấp, giao spike tái hiện chính xác và đánh dấu chưa xác minh; không dùng mock Auth làm bằng chứng Supabase đã cách ly danh tính.
5. Smoke parser Excel/đề xuất lịch và một mẫu Excel/PDF tiếng Việt khi runtime có thể là nút nghẽn; giới hạn file/đầu vào và lưu số đo thật.

Code PoC đặt tách ở `experiments/` hoặc vị trí hiện có phù hợp, không trộn vào frontend production. Chỉ cần phần đủ chứng minh rủi ro; dependency tối thiểu và hướng dẫn tái chạy. Không sửa máy/global config hoặc phá DB đang có để có môi trường thử. Nếu không có DB/runtime, giao source/script/dataset và blocker; vẫn hoàn thiện thiết kế, tuyệt đối không ghi test pass khi chưa chạy.

Đánh dấu từng hiện vật: thiết kế, prototype đã chạy, dự kiến đưa production. Chỉ phần nào đã kiểm chứng mới được gọi verified, không gộp build/diagram/SQL parse thành kiểm toán bảo mật hay backend hoàn tất.

## 13. Cấu trúc đầu ra

Tận dụng tài liệu có sẵn, không ghi đè mất quyết định. Gợi ý nhóm đầu ra tối thiểu, được gộp tài liệu gần nhau nếu vẫn rõ và dễ tra:

```text
docs/technical/
  README.md                      # mục lục, trạng thái, quyết định, truy vết
  architecture.md                # module/interface, stack, lựa chọn và trade-off
  domain-data.md                 # thuật ngữ, entity/state, từ điển/constraints/index
  transactions-finance.md        # luồng, bút toán, khóa/idempotency, số mẫu
  security-operations.md         # danh tính/quyền/threat model, deploy/backup/quota
  implementation-plan.md         # lát chức năng, dependency, test và mốc D1–D30
  openapi.yaml                   # hợp đồng toàn bộ API
  schema/                        # SQL draft/migrations/seed giả, hướng dẫn validate
  diagrams/                      # source, render, mục lục/mô tả
experiments/                      # chỉ các PoC cần thiết đã mô tả, nếu làm
```

ADR chỉ cho quyết định có trade-off quan trọng/khó đảo và dễ bị hiểu sai: stack/runtime, isolation Auth, API/DB access, sổ tiền hoặc tác vụ nặng nếu cần. Không tạo ADR cho mọi thư viện hoặc dựng cả hệ tài liệu theo template trống. Thuật ngữ dùng một glossary chuẩn, dẫn lại thay vì định nghĩa khác nhau trong nhiều file.

Trong mục lục có bảng truy vết: FR/use case → module → bảng dữ liệu → operationId → transaction/state → diagram → ca nghiệm thu trong `docs/05-roadmap-va-nghiem-thu.md` → tình trạng kiểm. Dùng ID thực đang có, bổ sung ID mới khi cần; không gắn tất cả test vào mọi chức năng để tạo vẻ bao phủ.

Lập kế hoạch implement backend theo lát chạy được: nền Auth/quyền/audit và DB → catalog/mượn/cọc/quầy → members/duty → recruitment → quỹ/lô/sự kiện/content → reporting/tích hợp/vận hành. Nêu file/module/interface/endpoint/migration và test đầu ra cho từng lát; vẫn đủ cả chín nhóm trước phát hành. Cập nhật mốc tháng theo khối lượng phát hiện, không giả định AI rút mọi công việc về một ngày.

## 14. Tự kiểm và bàn giao

Trước kết thúc:

- Rà schema ↔ ERD ↔ OpenAPI ↔ sequence/state ↔ quyền, sửa mọi tên/trường/cardinality/trạng thái lệch.
- Validate OpenAPI bằng công cụ phù hợp đã có; render các diagram, kiểm hình thực; chạy SQL/PoC/test nào thực hiện được và ghi lệnh/môi trường/kết quả. Không gọi validate một file là mọi API đã được kiểm thử.
- Rà cả luồng lỗi, concurrent/retry, pending money, đổi cựu/khóa, file/cache/provider endpoint và sync lại sau đã chấm điểm.
- Kiểm ví dụ tiền/hạn trong đặc tả bằng bảng trước/sau hoặc test nhỏ, phân biệt cọc/tồn/nợ/doanh thu, không chỉ tổng cash.
- Dùng dữ liệu giả; không lộ secret/PII ở tài liệu, sơ đồ, seed, log hoặc screenshot. Không thực hiện side effect ngoài phạm vi local đã giao.
- Ghi bảng quyết định còn mở, mức ảnh hưởng và bước nào bị chặn; giải pháp mặc định chỉ là đề xuất, không biến thành quy tắc đã được CLB đồng ý.

Bàn giao bằng tiếng Việt: kết luận kiến trúc, tài liệu/sơ đồ/schema/API đã tạo, điều đã thử thực sự, phần chưa xác minh, rủi ro có ảnh hưởng và việc backend tiếp theo có thể bắt đầu. Link trực tiếp tới file/diagram chính; nếu render/check không chạy được nêu blocker cụ thể. Không kết luận “backend sẵn sàng production” từ bộ thiết kế/PoC.

Bắt đầu ngay bằng đọc tài liệu và hiện trạng workspace, thiết kế domain/giao dịch/quyền, rồi hoàn thành bộ diagram, schema/API và bằng chứng kỹ thuật theo phạm vi trên. Không chỉ trả một kế hoạch để người dùng tự làm.
