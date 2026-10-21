# Tài khoản bạn đọc và lối vào nội bộ

## Quyết định trực tiếp ngày 21/10/2026

- Muốn đặt sách phải có tài khoản bạn đọc. Bản đầu chỉ đăng nhập Google; lần đầu tự tạo hồ sơ bạn đọc, bổ sung họ tên/SĐT trước khi đặt.
- Nhớ phiên trên trình duyệt hiện tại. Đăng nhập mới cùng tài khoản thu hồi phiên cũ. Không gộp tài khoản bạn đọc với quyền nội bộ.
- Nội bộ dùng subdomain riêng và Cloudflare Access. Người ngoài trên landing không thấy link/form nội bộ; vẫn có tra cứu sách, đăng nhập bạn đọc và đặt/tra/hủy sách.
- Triển khai local và chuẩn bị cấu hình; không commit/push/deploy, không chỉnh tài khoản/hạ tầng cloud. Tên miền và Google OAuth client thật chưa được cung cấp.

## Cách triển khai

Tái sử dụng Supabase Auth để xác minh Google qua authorization code + PKCE. Backend giữ cookie PKCE ngắn hạn và kiểm tra state/redirect. Không đưa token Google/Supabase vào localStorage hoặc log. Hồ sơ `reader_accounts` riêng; chỉ liên kết đơn mới bằng khóa tài khoản đã xác thực. Không nhận lịch sử theo SĐT/email tự khai. Đơn khách cũ giữ quyền token bí mật cũ.

Phiên bạn đọc là token ngẫu nhiên 256 bit trong cookie HttpOnly, SameSite=Lax, Secure khi HTTPS. Database chỉ giữ hash và hạn phiên. Đề xuất mặc định 30 ngày tuyệt đối cho beta; đăng xuất/hết hạn/đăng nhập mới đều kết thúc phiên. Mỗi tài khoản có một hash hiện hành; login cập nhật nguyên tử. Mọi API bạn đọc đối chiếu hash, không chỉ tin chữ ký JWT hoặc chờ provider refresh. Trình duyệt cũ bị từ chối từ request tiếp theo; UI kiểm tra lại khi quay lại tab và định kỳ, xóa dữ liệu riêng khi mất phiên. Khác trình duyệt/profile được tính là phiên khác; không hứa nhận diện phần cứng.

API tạo đơn yêu cầu phiên trước CAPTCHA/idempotency/ghi dữ liệu; lấy chủ đơn từ server. Giữ một quyển/đơn, cọc, lịch nhận, CAPTCHA, quota IP/SĐT và các transaction hiện có. Trang sách của tôi liệt kê và hủy đơn thuộc tài khoản; không hủy sách đã nhận. Token đơn mới cũng không vượt được kiểm tra chủ tài khoản. Đăng xuất từ phiên cũ không được thu hồi phiên mới.

Subdomain quản lý có Cloudflare Access allowlist email cụ thể do CLB quản lý, không cho mọi tài khoản Gmail hoặc mọi email trường. Ứng dụng kiểm tra chữ ký/issuer/audience/expiry Access JWT, sau đó vẫn kiểm tra tài khoản nội bộ được cấp và quyền DB. Public host từ chối trang/login/API nội bộ; đường workers.dev/origin không được bỏ qua cổng. Local chỉ được miễn cổng Access khi development và loopback.

## Thứ tự và kiểm chứng

1. Lưu review; thêm test đỏ cho chặn đặt khách và OAuth state, phiên, quyền sở hữu.
2. Migration cộng thêm, module tài khoản/OAuth/phiên; kiểm tra PostgreSQL về login đồng thời, thu hồi và logout cũ.
3. Gắn quyền chủ đơn vào create/list/cancel; giữ test quota/idempotency/bàn giao/trả và token cũ.
4. UI Google, hồ sơ, sách của tôi; bỏ link nội bộ công khai, khóa demo khi tắt.
5. Host/Access guard và cấu hình Worker chạy trước assets; test bypass/giả header/JWT sai.
6. Check/unit/integration/build và browser local. Backup trước khi áp dụng migration vào database thao tác. OAuth Google và Cloudflare Access thật chỉ nghiệm thu sau khi có cấu hình/được phép triển khai.

## Nguồn đã đối chiếu

- [Google OAuth trên Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google): PKCE cần callback đổi code.
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): single session tích hợp thuộc Pro trở lên, kiểm tra lúc refresh; không đáp ứng thu hồi ngay chỉ bằng toggle Free.
- [Cloudflare Access web applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/): cổng xác thực trước ứng dụng. Các chi tiết triển khai ở trên là thiết kế của dự án.
