# Trạng thái và quyết định hiện hành YSBK

Cập nhật bàn giao: 21/10/2026. Đây là trang điều phối tài liệu, không thay hợp đồng API hoặc tự phê duyệt tính năng. [Session handoff](SESSION-HANDOFF.md) chứa tóm tắt hội thoại và lời mở đầu chat tiếp theo.

## Quyết định UI mới nhất trong chat tiếp nối 21–22/10

Giữ nguyên landing cuốn sách; áp dụng bố cục Stitch/góc bo mềm cho phần ứng dụng. `/sach/` đổi Tra cứu sách thành **Tủ sách**, bỏ tab Đặt giữ chỗ; đặt qua modal theo sách. Đánh dấu theo tài khoản, ghim trước phân trang của Tất cả. **Không thông báo/email/push** theo câu trả lời mới nhất: bookmark xanh rêu khi còn bản, đỏ đất nung khi hết. Chi tiết có tóm tắt và nút mở thẻ review của riêng cuốn; review CLB ghim trước, bạn đọc chỉ gửi chữ chờ ADMIN duyệt. Xem/tìm sách và bài đã duyệt vẫn công khai; đặt/hủy/đánh dấu/gửi cảm nhận yêu cầu tài khoản. Hủy đơn khách cũ cũng yêu cầu đăng nhập, đồng thời vẫn cần token bí mật.

Đã thêm migration 22, service/API bookmark, cá nhân hóa thứ tự catalog và dấu CLB do server quyết định. Đã backup rồi áp dụng cộng thêm vào local. Các mục sáu-tab cũ bên dưới là lịch sử đã được thay ở phần điều hướng. [Thiết kế và giới hạn](technical/reader-library-design-2026-10-21.md). Browser tool hiện trả lỗi `Local browser use is disabled in Work settings`; người dùng xác nhận không chủ động tắt. Không coi đây là quyết định tắt của người dùng, và chưa có kiểm chứng trực quan UI mới.

## Quyết định mới nhất: tài khoản bạn đọc bắt buộc

Trong chat tiếp nối 21/10, chủ sản phẩm thay chính sách đặt khách: phải có tài khoản bạn đọc, bản đầu chỉ Google; nhớ phiên tối đa 30 ngày, đăng nhập mới thu hồi phiên cũ. Đã chọn subdomain nội bộ riêng + Cloudflare Access, không hiện link/form nội bộ trên public host. [Thiết kế và phạm vi](technical/reader-accounts-design-2026-10-21.md), [vận hành và bằng chứng](technical/reader-accounts-local-and-access.md).

Đã có migration 21, module phiên/OAuth PKCE, quyền chủ đơn, UI Sách của tôi và host/Access guard. Local đã áp dụng migration cộng thêm sau backup, không reset dữ liệu. Google provider thật và subdomain/Access cloud chưa cấu hình, chưa deploy. Vì bắt buộc đăng nhập, local hiện chỉ tra cứu được sách; tạo đơn mới bị chặn cho tới khi Google sẵn sàng.

## Thứ tự áp dụng

1. Quyết định trực tiếp mới nhất của chủ sản phẩm; đề xuất chưa được trả lời không phải quyết định.
2. Thiết kế nghiệp vụ hiện hành và tài liệu chuyên đề bên dưới.
3. Mã nguồn hiện có là bằng chứng implementation, không tự thay yêu cầu sản phẩm.
4. Kế hoạch/prompt/concept dùng hướng dẫn; review và log cũ chỉ chứng minh lần chạy được ghi. Nguồn HTML thô Stitch có thể sinh sai chính sách.

## Các chuyên đề hiện hành

| Chuyên đề | Tài liệu chính | Trạng thái |
|---|---|---|
| Đặt sách khách, hạn mức, hết hạn, bảo mật | [Thiết kế](technical/public-reservation-design.md), [bàn giao](technical/public-reservation-handoff.md) | Có implementation local; chưa beta cloud |
| Cổng chung, xuất bản, CTV | [Public portal/publishing](technical/public-portal-publishing.md) | Đã có source và bằng chứng local theo tài liệu chuyên đề |
| Landing cuốn sách | [Landing local](technical/book-landing-local.md) | Tích hợp local; bìa phụ/ảnh/nội dung theo phản hồi mới |
| UI mềm PC/mobile | [Đặc tả](mockups/stitch-ui-2026-10-21/HANDOFF.md), [kế hoạch](superpowers/plans/2026-10-21-ysbk-soft-ui.md) | 14 mẫu; workspace đã có thay đổi UI sau concept, chưa review đầy đủ trong lượt bàn giao |
| Đặt/hủy, tài khoản bắt buộc | [Thiết kế tài khoản](technical/reader-accounts-design-2026-10-21.md) | Đã chọn Google-only, có source/local DB; chưa OAuth cloud thật |
| Runtime local | [Hướng dẫn](technical/local-development.md) | 4321; lần bàn giao readiness 200 DB/Auth connected |
| Beta | [Deploy guide](technical/beta-deployment-guide.md), [bằng chứng](technical/beta-verification.md) | Supabase + Cloudflare Free đã chọn; local trước, chưa deploy |

## Điều đã chốt và chưa thay đổi

- Một quyển/đơn giữ chỗ, phải đăng nhập tài khoản bạn đọc Google, CAPTCHA, nhận đúng ca; hết hạn cuối ca đã chọn. Chưa OTP SĐT.
- Ba đơn tạo thành công/IP/24 giờ trượt; hủy/hết hạn/trả không hoàn lượt IP. Ba suất giữ/mượn chưa trả/SĐT; trả một mở một suất.
- Đơn mới thuộc tài khoản đã xác thực; cả token đơn mới cũng không vượt quyền chủ đơn. Đơn khách cũ giữ quyền bằng token bí mật, không tự nhập lịch sử vào tài khoản theo SĐT/email. Chỉ hủy khi chờ nhận.
- Cổng `/sach/` đủ sáu mục, 50 sách/trang; `/cong-dong` giữ liên kết cũ qua redirect; session nội bộ không tự đẩy người đang xem tủ sách đi.
- Chỉ ADMIN xuất bản sách/ảnh/lịch/nghỉ/sự kiện/tuyển. CTV một tháng lịch, quyền MEMBER, quản lý đánh giá và công nhận; xóa CTV mềm/giữ lịch sử; thành viên rời chuyển cựu.
- Tên đầy đủ và slogan có dấu phẩy; màu đã chốt; phong cách UI mềm/vintage, landing sách giữ thiết kế đã duyệt.
- Tài khoản bạn đọc không được ánh xạ thành MEMBER/ADMIN; Google chỉ tạo hồ sơ reader. Quyền nội bộ vẫn lấy từ tài khoản CLB được cấp và DB.

## Đề xuất chưa được duyệt

Email/liên kết khôi phục riêng, đổi sách nguyên tử và thay chính sách IP vẫn chưa được duyệt. Sách của tôi/tài khoản Google/phiên một trình duyệt đã được chọn ở trên. Rủi ro Wi-Fi dùng chung IP cần đo; SĐT tự khai chưa được OTP xác minh.

## Cách đọc các tài liệu lịch sử

Tài liệu khám phá 18/10, review theo chặng, prompt Antigravity cũ, ảnh QA và các snapshot verification vẫn giữ để truy vết. Chúng không chứng minh trạng thái hiện tại chỉ vì có chữ PASS, “chưa có DB” hoặc “chưa tích hợp”. Tài liệu đang dùng được bổ sung mục cập nhật; các điều không bị thay thế như cọc/phạt/quỹ tiếp tục có hiệu lực theo quyết định đã chốt.

## Phạm vi đợt đồng bộ tài liệu

Đồng bộ README, chín tài liệu sản phẩm, các tài liệu kỹ thuật/vận hành đang dùng, kế hoạch/prompt UI và index prompt. Không sửa lại kết quả review lịch sử, migration SQL, OpenAPI, source code, ảnh gốc hoặc bản xuất thô Stitch để giả vờ tính năng mới đã được duyệt. Gói ZIP UI được cập nhật các tài liệu bàn giao liên quan; dùng file trong workspace làm nguồn mới nhất.
