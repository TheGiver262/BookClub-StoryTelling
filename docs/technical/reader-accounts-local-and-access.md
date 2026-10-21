# Tài khoản bạn đọc: vận hành local và cổng nội bộ

## Quyết định và hành vi

Ngày 21/10/2026, chủ sản phẩm yêu cầu tài khoản bạn đọc trước khi đặt, chọn **chỉ Google** cho bản đầu và **subdomain riêng + Cloudflare Access** cho nội bộ. [Thiết kế](reader-accounts-design-2026-10-21.md) thay chính sách đặt không đăng nhập của tài liệu cũ; hạn mức IP/SĐT, cọc, nhận/giao/trả giữ nguyên.

- Chưa login: tra cứu sách và nội dung công khai; API tạo đơn trả 401 trước CAPTCHA/DB nghiệp vụ.
- Đăng nhập Google lần đầu: tạo `reader_accounts` riêng, bổ sung tên/SĐT rồi đặt. Không tự nhận lịch sử theo SĐT/email. Email đơn lấy từ Google đã xác minh.
- Phiên ứng dụng có token ngẫu nhiên 256 bit, cookie HttpOnly/SameSite=Lax, Secure + prefix `__Host-` trên HTTPS. DB chỉ lưu SHA-256 token; hạn tuyệt đối 30 ngày, không kéo dài âm thầm.
- Login mới cập nhật một hash hiện hành; mọi API reader kiểm tra DB, nên token cũ bị từ chối từ request tiếp theo. API ghi kiểm tra lại và khóa tài khoản trong transaction. UI kiểm tra lại khi focus/tab hiện và mỗi 30 giây khi tab hiện. Đây là giới hạn theo trình duyệt/profile, không nhận diện phần cứng hoặc chống sao chép cookie đã bị đánh cắp.
- Logout bằng token cũ chỉ xóa cookie cũ, không thu hồi phiên mới. Khóa tài khoản/hết hạn từ DB có hiệu lực với request mới.
- Sách của tôi hiển thị tối đa 100 đơn gần nhất; hủy chỉ đơn HELD thuộc tài khoản. Token của đơn mới vẫn cần đúng tài khoản; đơn khách cũ `reader_account_id IS NULL` giữ quyền token cũ. Không tự gán đơn cũ vào tài khoản.
- Luồng gửi cảm nhận hiện có nhận phiên reader như GUEST chỉ tại API gửi review; vẫn chờ kiểm duyệt. Không mở quyền nghiệp vụ nội bộ cho reader.

## Các API mới

| API | Mục đích |
|---|---|
| `GET /api/v1/readers/auth/status` | Chỉ trả cờ Google đã bật/có config, không trả key |
| `GET /api/v1/readers/auth/google` | Bắt đầu Google qua Supabase authorization code + PKCE; next chỉ nhận trang `/sach/` |
| `GET /api/v1/readers/auth/callback` | Kiểm tra state/cookie/verifier rồi đổi code phía server |
| `GET/PATCH /api/v1/readers/me` | Đọc/sửa tên và SĐT; không sửa email/role |
| `POST /api/v1/readers/logout` | Thu hồi đúng hash phiên đang gửi |
| `GET /api/v1/readers/reservations` | 100 đơn gần nhất của tài khoản |
| `POST /api/v1/readers/reservations/{id}/cancel` | Hủy đơn của tài khoản trong transaction |

`POST /api/v1/public/reservations` giữ URL để tương thích client, nhưng giờ bắt buộc cookie reader. Không tin `readerAccountId`, tên/SĐT/email từ body để xác định chủ đơn. Idempotency kiểm tra cả chủ tài khoản; key client gắn cả reader ID.

## Cấu hình Google thật còn thiếu

Hiện local dùng GoTrue Docker và **chưa bật Google**. App trả `READER_GOOGLE_UNCONFIGURED`, UI báo đang cấu hình; không có nút giả thành công, không seed reader vào database thao tác để vượt gate.

Người dùng đã xác nhận trong chat: **chưa có tên miền, Supabase project cloud hoặc Google OAuth client**. Chưa có dữ liệu cấu hình thật để tiếp tục bật tích hợp; không tự tạo/mua/deploy tài nguyên ngoài.

Để nghiệm thu provider thật, cần một Google OAuth client do CLB quản lý, cấu hình Google provider trong Supabase/GoTrue đang dùng, callback provider chính xác và redirect allowlist đến app. Với Supabase cloud:

1. Trong Google Cloud, cấu hình Web OAuth client và consent screen/test users phù hợp. Authorized redirect URI lấy chính xác từ trang Google provider của Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`). Không dùng callback app thay callback provider.
2. Trong Supabase Authentication → Google, đặt Client ID/Secret. Không đưa Client Secret vào source/frontend hoặc chat. Bật tạo tài khoản reader qua Google theo chính sách Auth; vẫn giữ nội bộ chỉ được cấp quyền bằng mapping DB. Không mở email/password reader ngoài phạm vi đã chọn.
3. Redirect allowlist của Supabase cho phép app public `/api/v1/readers/auth/callback` cùng query `state` biến đổi. Dùng pattern giới hạn đúng host/path theo tài liệu Supabase; không dùng wildcard mọi host. Xác minh bằng callback thật trước beta.
4. Worker dùng `SUPABASE_URL`, `SUPABASE_ANON_KEY` hiện có, thêm `READER_GOOGLE_ENABLED=true` sau khi provider sẵn sàng. Local runtime sinh `.local/ysbk/.dev.vars`; không tự trỏ biến Supabase sang project khác vì sẽ ảnh hưởng đăng nhập nội bộ. Google của Docker local cần cấu hình GoTrue tương ứng trong compose và callback gateway trước khi bật cờ.
5. Thử hai trình duyệt/profile thật: Google → tạo hồ sơ → đóng/mở trình duyệt giữ phiên → đăng nhập profile B → A nhận 401 → B vẫn hoạt động kể cả A logout.

Provider toggle single-session của Supabase không được dùng làm cơ chế thu hồi ứng dụng: tài liệu hiện tại xếp tính năng này ở Pro trở lên và hiệu lực kiểm tra theo lần refresh. App quản lý một phiên bằng DB để hoạt động với lựa chọn Free.

## Cấu hình nội bộ trước cloud

Tên miền dưới đây chỉ là ví dụ, chưa tạo DNS hoặc ứng dụng Access:

```json
{
  "PUBLIC_ORIGIN": "https://sach.<ten-mien-clb>",
  "INTERNAL_ORIGIN": "https://quanly.<ten-mien-clb>",
  "CF_ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com",
  "CF_ACCESS_AUD": "<Application Audience 64 hex>",
  "READER_GOOGLE_ENABLED": "true",
  "TURNSTILE_EXPECTED_HOSTNAME": "sach.<ten-mien-clb>",
  "NODE_ENV": "production"
}
```

1. Chọn hai origin HTTPS cùng tên miền CLB quản lý, thêm custom domains/routes vào Worker. Không có tên miền được cung cấp trong chat nên chưa thêm route giả vào config.
2. Tạo Access self-hosted app bảo vệ **toàn bộ** subdomain nội bộ, allowlist email cụ thể của CLB; không cho mọi Gmail/email sinh viên. Chính sách mặc định deny, không tạo bypass toàn host.
3. Lấy team domain và Application AUD đúng app đặt vào Worker vars. Ứng dụng xác minh RS256/JWKS, issuer/audience/expiry/nbf/type; không tin riêng header email. Sau Access, vẫn login tài khoản nội bộ được cấp; quyền MEMBER/ADMIN/cựu/CTV lấy từ DB như trước.
4. `assets.run_worker_first=true`, `workers_dev=false`, `preview_urls=false`. Public host trả 404 cho `/login`, `/noi-bo`, bundle nội bộ có tên tương ứng và API nội bộ. Host workers.dev/origin lạ không được vượt guard. Không triển khai lại static Pages public làm lộ các trang nội bộ ngoài Worker.
5. Turnstile hostname phải theo public origin. `pnpm run beta:check-config` giờ kiểm tra các điều kiện này và từ chối cấu hình chưa đủ. Loopback chỉ miễn Access ở `NODE_ENV=development`.
6. Nghiệm thu người ngoài không thấy form nội bộ; email ngoài allowlist bị Access chặn; email CLB qua Access nhưng không có mapping app vẫn bị từ chối; giả Access JWT, sai aud/issuer/hết hạn và direct origin đều bị chặn.

## Migration và local

Migration `21_reader_accounts.sql` chỉ tạo bảng/index và thêm FK nullable vào reservations; không đổi hay xóa đơn cũ. Local đã áp dụng sau backup `pg_dump -Fc`; `pg_restore --list` có members/reservations. Backup nằm trong `.local/ysbk/backups/`, không commit. Không coi kiểm tra listing là restore drill hoàn chỉnh. Đã bật RLS/role backend cho bảng reader và cập nhật schema fingerprint local sau xác minh đúng migration.

Worker vẫn ở `http://localhost:4321`; link nội bộ local chỉ dùng trực tiếp `/login` hoặc `/noi-bo`, không nằm trên landing. Đã xác minh PID/cây tiến trình trước restart; PID mới dùng đường dẫn config tuyệt đối. Không sửa script sở hữu PID để chấp nhận đường dẫn mơ hồ.

Lệnh kiểm chứng:

```powershell
pnpm run check
pnpm run test:unit
pnpm run local:test:db
pnpm run local:smoke
```

Smoke hiện ghi **PARTIAL** và exit 2 nếu chưa có `YSBK_READER_SESSION_COOKIE` của reader QA thật; vẫn kiểm tra Auth nội bộ/role/cookie/logout và chặn đặt chưa login. Không in giá trị cookie vào log/chat. Khi có phiên QA, script thử CAPTCHA provider/tạo/tra/hủy và chỉ dọn đúng đơn synthetic đã hủy của lần chạy; lượt IP thành công vẫn áp dụng như chính sách hiện có.

## Bằng chứng và gate mở

Review trước thay đổi: [Antigravity review](../reviews/2026-10-21-antigravity-review.md). Đã sửa F1 query mở demo khi cấu hình tắt. S1 badge trùng và F2 phiếu mobile mất trạng thái còn mở, ngoài phần tài khoản. Không gọi toàn UI là đã nghiệm thu.

Log mới nằm trong `.review-artifacts/readers-*.log`: unit/check/build/local-up, PostgreSQL và smoke. PostgreSQL 25/25 ở lần chạy ba file publishing/readers/reservation-flow, gồm 6 test reader dùng provider response có kiểm soát nhưng PostgreSQL thật. Test Access dùng chữ ký RSA/JWKS synthetic, không phải Cloudflare app thật.

Kiểm chứng cuối phần ứng dụng: 365/365 unit, Astro/TypeScript 172 files không lỗi/warning/hint; build 6 trang và `local:up` thành công. HTTP xác nhận landing/catalog không còn internal href, không còn mô tả đặt không tài khoản, API đặt trả 401 trước CAPTCHA, auth status báo Google chưa bật; bundle build tắt demo đã loại đường query `mode`. Bằng chứng HTTP/build không thay browser proof. `git diff --check` toàn dirty tree còn trailing whitespace từ UI trước lượt này; đối chiếu các file đã chụp baseline xác nhận phần bổ sung không có whitespace mới.

Chưa có Google OAuth thật, Cloudflare Access thật, test UI mới bằng browser hoặc thiết bị thật. Browser Use trả “Local browser use is disabled in Work settings” ở bước xác minh cuối; không chuyển công cụ để vượt thiết lập này. Chưa chạy full integration trong lượt này, chưa load test, chưa commit/push/deploy.

## Nguồn chính thức

- [Google OAuth Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions).
- [Cloudflare Access web apps](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).
- [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
