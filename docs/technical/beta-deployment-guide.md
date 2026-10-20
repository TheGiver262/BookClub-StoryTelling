# Triển khai beta YSBK: Supabase Free + Cloudflare Free

> **Tạm hoãn triển khai theo quyết định 20/10/2026.** Hiện ưu tiên [test local](local-development.md). Chỉ thực hiện phần triển khai thật sau khi local đủ chức năng và được nghiệm thu; không dùng hướng dẫn này làm bằng chứng đã được phép deploy ngay.

Ngày đối chiếu tài liệu: 20/10/2026. Đây là hướng dẫn triển khai; các thao tác dashboard bên dưới chưa được thực hiện trên tài khoản thật.

## 1. Cấu hình đã chốt

- Một Worker `yeusachbackkhoa-beta` phục vụ cả Astro và API. URL: `https://yeusachbackkhoa-beta.<workers-subdomain>.workers.dev`. Không mua tên miền.
- Supabase Free cung cấp PostgreSQL và Auth. Hyperdrive Free giữ pool kết nối; **tắt query caching** cho toàn bộ binding này.
- Turnstile Managed; xác thực token ở server, kiểm tra đúng hostname và action `reservation`. Chưa OTP.
- Mỗi đơn giữ một bản sách vật lý. IP tối đa ba đơn thành công trong 24 giờ trượt; SĐT tối đa ba suất đang giữ/đang mượn. Trả một cuốn mở một suất SĐT, không hoàn lượt IP.
- Chỉ lịch trực thứ Ba/thứ Năm đã mở mới cho chọn. Giữ đến hết buổi đã chọn. Đến lấy: thành viên đối chiếu tên/SĐT, xác nhận thu cọc rồi giao. Hết hạn: không còn chiếm tồn khả dụng; cron cập nhật trạng thái mỗi 10 phút, mỗi đợt tối đa 100 đơn.
- Bản đã giữ bị mất/hỏng/đang có khoản mượn chưa trả: cảnh báo tại **Quầy sách → Đơn giữ chỗ**, ưu tiên đầu danh sách, hiện tên/SĐT cho thành viên. Gọi thủ công rồi chọn hủy nếu cần. Không tự hủy, không gửi email/SMS. Cảnh báo được tính từ dữ liệu hiện tại; không có hộp thư/push chạy nền.
- Chưa thêm chat. Phần 9 tính riêng khả năng dùng Free.

## 2. Tải và ngân sách ban đầu

Giả định để lập ngân sách: 100 bạn đọc/ngày, mỗi người xem danh mục 10 phút; 30 tài khoản thành viên, khoảng 5 người cùng mở hàng chờ trong hai giờ ngày trực; 8–9 ngày trực/tháng. Đây là mô hình, không phải benchmark 130 người đồng thời.

| Nguồn request ngày trực | Cách tính tham khảo |
| --- | --- |
| Tự làm mới danh mục | 100 × 10 phút × 2 lần/phút = 2.000 request; mỗi lần hiện tại có 2 truy vấn SQL |
| Form đặt, nếu cả 100 người mở 3 phút | 100 × 3 × 2 × 2 endpoint = 1.200 request; khoảng 1.800 truy vấn SQL |
| Hàng chờ nội bộ | 5 × 120 phút × 2 = 1.200 request; cộng kiểm tra session/quyền vào số SQL thực tế |
| Giao dịch quầy | Dự phòng 300 thao tác/ngày; một thao tác có thể sinh nhiều SQL, kể cả BEGIN/COMMIT, audit, idempotency |

Các trang chỉ tự làm mới khi đang mở tab tương ứng và trình duyệt hiển thị. Thứ Ba/thứ Năm: 30 giây; ngày khác: 60 giây. Trở lại tab/focus sẽ tải lại. Chỉ tải 24 đầu sách/trang, không kéo vài nghìn cuốn về trình duyệt. Form tìm theo tên/tác giả, tối đa 24 kết quả mỗi truy vấn.

Với mô hình trên, Free là điểm bắt đầu hợp lý; cần đo SQL/ngày và CPU/request trước khi xác nhận đủ tải. Workers Free có 100.000 request động/ngày và CPU 10 ms/lần gọi; request static assets có cơ chế tính riêng. Hyperdrive Free có **100.000 database statements/ngày**, reset 00:00 UTC; vượt hạn mức có thể gây lỗi. HTTP request và SQL statement là hai đại lượng khác nhau. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).

Supabase Free có 500 MB database và hạn mức truyền dữ liệu riêng. Vài nghìn bản sách dạng văn bản phù hợp để thử nghiệm, nhưng phải đo cả indexes, audit, journal và lịch sử giao dịch. Không lưu ảnh/base64 trong cột database; beta dùng URL ảnh. Free có thể pause khi ít hoạt động và không cung cấp mức bảo đảm vận hành như gói trả phí. [Supabase pricing](https://supabase.com/pricing).

Mục tiêu chi phí hạ tầng ban đầu: **0 USD/tháng khi trong hạn mức Free**. Không tự nâng gói; xem số liệu ít nhất hai buổi trực rồi quyết định.

## 3. Supabase Dashboard: project, database và quyền

1. Đăng nhập Supabase, mở đúng project beta; nếu chưa có, tạo project Free riêng, ưu tiên Singapore. Ghi tên project/ref để tránh chọn nhầm. Nếu project đang có dữ liệu YSBK, **không chạy bootstrap**; cần lập migration/backup riêng.
2. Vào **Integrations → Data API** hoặc tìm “Data API”, tắt **Enable Data API**. App dùng SQL từ Worker và Auth API; không dùng REST/GraphQL database công khai. Không tắt Auth. [Hướng dẫn bảo vệ Data API](https://supabase.com/docs/guides/api/securing-your-api).
3. Trong thư mục dự án chạy `pnpm run beta:prepare-db`. Lệnh này chỉ tạo hai file local, không kết nối database.
4. Mở **SQL Editor**, xem kỹ và chạy `.review-artifacts/beta-db/01-schema.sql` trên project beta sạch. File gộp schema + migrations theo thứ tự và hai quỹ; không dùng `02_seed.sql`. Nếu báo `YSBK_BOOTSTRAP_REQUIRES_EMPTY_DATABASE`, dừng, không bỏ guard để chạy tiếp. Lỗi giữa chừng có thể để lại một phần schema; kiểm tra trước khi thử lại.
5. Chạy `.review-artifacts/beta-db/02-access.sql`. Nó tạo `ysbk_app` không có quyền quản trị, bật RLS cho bảng ứng dụng và chỉ cấp policy cho role server này. `anon`/`authenticated` không được truy cập bảng ứng dụng. Không cấp `postgres` hay BYPASSRLS cho role này.
6. Đặt mật khẩu ngẫu nhiên riêng cho role và bật đăng nhập trong SQL Editor:

   ```sql
   ALTER ROLE ysbk_app WITH LOGIN PASSWORD '<MAT_KHAU_DB_NGAU_NHIEN>';
   ```

   Thay placeholder ngay trong dashboard riêng. Không đưa mật khẩu vào chat, Git hoặc ảnh chụp; lưu bằng trình quản lý mật khẩu. Có thể dùng `psql` với `\password ysbk_app` nếu muốn tránh gõ mật khẩu trong câu SQL.
7. Mở **Connect → Direct connection**, lấy host `db.<project-ref>.supabase.co`, port `5432`, database `postgres`. Hyperdrive dùng tài khoản **ysbk_app** và mật khẩu vừa đặt; không dùng URI Supavisor transaction/session pooler. [Kết nối Hyperdrive với Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/).
8. Trong **Project Settings → API Keys**, lấy Project URL và **publishable key**; code giữ tên biến `SUPABASE_ANON_KEY` nhưng chấp nhận publishable key qua header `apikey`. Legacy anon key cũng dùng được. Không cần `service_role`/secret admin key cho luồng này.

Khi có migration tạo bảng mới, rà quyền/RLS rồi chạy lại bộ access đã sinh từ source cập nhật, hoặc migration quyền tương ứng. Không chạy lại file schema bootstrap trên dữ liệu đang dùng.

## 4. Supabase Auth: admin đầu tiên và tài khoản thành viên

1. **Authentication → Providers → Email**: bật đăng nhập email/password. Trong cấu hình đăng ký, tắt người dùng tự đăng ký tài khoản mới; beta chỉ có thành viên được CLB cấp tài khoản.
2. **Authentication → Users → Add user → Create new user**: email `admin@internal.ysbk.edu.vn`, mật khẩu mạnh, bật **Auto Confirm**. Đây là email định danh nội bộ, không phải hộp thư gửi email; không dùng invitation email.
3. Copy UUID của Auth user vừa tạo. Mở `scripts/beta-admin.sql.example`, điền UUID, tên và SĐT thật vào ba giá trị `NULL`, chạy trong SQL Editor. Template kiểm tra email đã xác nhận và chỉ dùng cho admin đầu tiên. Chưa điền đủ sẽ từ chối chạy.
4. Khi web lên, đăng nhập bằng username **`admin`**, không gõ cả email. Auth xác nhận mật khẩu; ứng dụng dùng `members` và `internal_identities` để kiểm tra vai trò/trạng thái. JWT secret của ứng dụng là bí mật riêng, không lấy Supabase JWT signing secret thay vào.
5. Với thành viên tiếp theo: tạo hồ sơ thành viên trong web; tạo Auth user `<username-chữ-thường>@internal.ysbk.edu.vn` với Auto Confirm trên dashboard; gắn UUID Auth vào `internal_identities.provider_subject` của đúng hồ sơ, username và normalized_username trùng username chữ thường. Kiểm tra mapping trước khi giao tài khoản. Việc tạo hồ sơ chưa tự bảo đảm đã có Auth user.
6. Chưa cấu hình SMTP/forgot-password trong beta; admin đổi mật khẩu trên dashboard khi cần. Không bật CAPTCHA của Supabase Auth nếu chưa bổ sung luồng captchaToken cho đăng nhập; Turnstile hiện bảo vệ đặt sách.

## 5. Cloudflare Dashboard: Worker và Hyperdrive

1. **Workers & Pages → Create application → Worker**, tạo Worker Hello World tên `yeusachbackkhoa-beta`. Chọn Workers Free. Ghi hostname thật ở **Settings → Domains & Routes**, ví dụ `yeusachbackkhoa-beta.ten-clb.workers.dev`. Chưa mở cho bạn đọc ở bước này.
2. **Storage & Databases → Hyperdrive → Create configuration**, tên `ysbk-beta-db`, nhập Direct connection của Supabase với user `ysbk_app`. Chọn kết nối mã hóa/TLS, giữ xác minh chứng chỉ của nhà cung cấp; không tắt TLS để chữa lỗi kết nối.
3. **Tắt Query caching**. Nếu dashboard không có công tắc, dùng sau khi đăng nhập CLI:

   ```powershell
   pnpm exec wrangler hyperdrive update <HYPERDRIVE_ID> --caching-disabled
   ```

   Xác nhận trạng thái cache disabled trên cấu hình Hyperdrive. Không chỉ đặt TTL ngắn: auth, quyền và giao dịch cần đọc mới. [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).
4. Copy ID Hyperdrive thay chuỗi 32 số `0` trong `wrangler.beta.json`. Binding giữ tên `HYPERDRIVE`.
5. Thêm vào `vars` trong cùng file: `"TURNSTILE_EXPECTED_HOSTNAME": "<hostname-thật-không-có-https>"`. Giữ `NODE_ENV=production`.
6. **Worker → Settings → Variables and Secrets → Add → Secret**: thêm từng tên sau. Để cả URL/key public ở loại Secret giúp Wrangler không xóa chúng khi đồng bộ vars từ file.

   | Tên | Giá trị |
   | --- | --- |
   | `SUPABASE_URL` | Project URL `https://<ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | Publishable key hoặc anon key của cùng project |
   | `JWT_SECRET` | Ít nhất 32 ký tự ngẫu nhiên, riêng cho phiên ứng dụng |
   | `RESERVATION_IP_SECRET` | Ít nhất 32 ký tự ngẫu nhiên khác JWT secret |
   | `TURNSTILE_SECRET_KEY` | Secret của widget sẽ tạo ở phần 6 |

   Không thêm `DATABASE_URL` production; code yêu cầu Hyperdrive. Không thêm `SUPABASE_SERVICE_ROLE_KEY`. Không đổi IP secret tùy tiện vì sẽ đổi định danh hạn mức IP; đổi JWT secret sẽ làm phiên hiện có hết hiệu lực.

## 6. Cloudflare Turnstile

1. **Turnstile → Add widget**, tên `YSBK Beta`, loại **Managed**.
2. Hostnames: thêm đúng hostname Worker phần 5. Không gõ scheme/path, không thêm wildcard rộng. Local dùng widget test riêng.
3. Copy **site key** vào `.env.beta.local`, tạo từ `.env.beta.local.example`:

   ```dotenv
   PUBLIC_TURNSTILE_SITE_KEY=<SITE_KEY_THAT>
   ```

4. Copy **secret key** vào Worker secret `TURNSTILE_SECRET_KEY`. Không đưa secret vào biến `PUBLIC_*`.
5. `TURNSTILE_EXPECTED_HOSTNAME` phải trùng hostname widget. Client gửi action `reservation`; server kiểm tra action này. Đổi domain phải cập nhật cả ba: widget hostname, Worker expected hostname, build site key nếu đổi widget.
6. Không dùng test key `1x000...` cho bản public. Thiếu key/token hoặc provider lỗi thì đặt sách bị chặn. [Turnstile widget management](https://developers.cloudflare.com/turnstile/get-started/widget-management/).

## 7. Build và deploy beta

Cài Node 24 và pnpm theo `package.json`. Chạy từ thư mục dự án:

```powershell
pnpm install --frozen-lockfile
pnpm run check
pnpm run test:unit
pnpm run beta:check-config
pnpm run beta:dry-run
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Kiểm tra `whoami` đúng Cloudflare account, Hyperdrive đúng Supabase project, secrets đủ và cache OFF. `beta:check-config` chỉ kiểm tra file công khai; nó không chứng minh secrets hay tài khoản cloud đã đúng. `beta:dry-run` chỉ build/đóng gói, không triển khai.

Khi đã sẵn sàng thực hiện triển khai thật:

```powershell
pnpm run beta:deploy
```

Lệnh này kiểm tra cấu hình, build mode beta rồi deploy. Frontend và API cùng origin, không cần CORS giữa hai domain. Không dùng `astro preview` làm server production. Không chạy `test:db`, seed hoặc restore bằng URI Supabase: harness test chỉ dành localhost/database disposable `ysbk_test_*`.

Mode beta không dựng các trang sách mẫu hoặc đóng băng tồn kho lúc build. Landing đọc API hiện tại. URL chi tiết `/sach/:id` dùng resolver 404 hiện có; nội dung có thể tải bằng JS nhưng HTTP vẫn là 404, nên beta chưa tối ưu SEO cho từng sách.

Sau deploy vào **Worker → Settings → Triggers → Cron** kiểm tra `*/10 * * * *`; xem **Deployments** để ghi version/time. Secret dashboard được giữ; các `vars` được quản lý bằng file. Tránh chỉnh một giá trị ở hai nơi rồi ghi đè nhau.

## 8. Nạp dữ liệu, kiểm thử cloud và vận hành

1. Import một lô nhỏ sách thật trước; kiểm tra barcode, edition/title, vị trí kho, giá cọc và trạng thái. Nhập tiếp theo lô, đối chiếu tổng. Không import seed demo. Chưa có quy trình import hàng nghìn cuốn được xác nhận trong lần chuẩn bị này: cần kiểm tra template/luồng import hiện có trước khi nạp toàn bộ.
2. Tạo đúng lịch trực thứ Ba/thứ Năm, giờ kết thúc và địa điểm, mở cho đặt. Nếu không có lịch mở, landing phải báo chưa có ca; không dựng lịch giả.
3. Mở URL HTTPS bằng cửa sổ riêng tư: landing hoạt động, vào nội bộ yêu cầu login. Đăng nhập, tải lại/đóng mở trang để kiểm tra session và logout. Thử quyền member/admin, vô hiệu thành viên phải chặn API.
4. `GET /health` phải 200; `GET /health/ready` phải 200 với DB/Auth thật. Health không thay thế thử đặt sách/CAPTCHA.
5. Dùng dữ liệu beta riêng: token CAPTCHA thật tạo được đơn, lưu token tra cứu; token thiếu/sai/đã dùng bị chặn. Kiểm tra hostname/action sai ở môi trường test riêng, không đổi widget đang dùng để thử phá.
6. Hai người đặt bản cuối cùng đồng thời: chỉ một thành công, người còn lại được báo hết. Tồn landing giảm khi poll hoặc focus. Giao trực tiếp tại quầy cũng không được lấy bản đã giữ.
7. Thử ba đơn/IP/24 giờ; trả một cuốn mở suất SĐT nhưng IP đủ ba vẫn chặn. SĐT khác cùng Wi-Fi vẫn chung hạn mức IP; giải thích điều này với nhóm beta.
8. Giữ chỗ → giao + xác nhận cọc → trả; kiểm tra audit/quỹ và suất SĐT. Ca hết hạn không đến: cuốn được đặt lại ngay theo điều kiện hết hạn, trạng thái EXPIRED được cron ghi sau đó.
9. Với một đơn beta đang giữ, thành viên chọn **Báo sự cố**, nhập lý do mất/hỏng. Bản sách chuyển MAINTENANCE, ghi audit; hàng chờ phải hiện cảnh báo tên/SĐT và khóa giao. Đơn vẫn HELD cho đến khi gọi và hủy thủ công hoặc hết hạn. Hủy không tự đưa bản hỏng về AVAILABLE; chỉ trả bản vào tồn sau khi kiểm tra/sửa xong qua luồng kho. Hai báo cáo trùng không tạo audit lặp. Luồng sửa kho bình thường vẫn chặn thay đổi bản đang giữ để tránh thao tác nhầm.
10. Trước buổi trực tạo backup DB và kiểm tra restore ở database riêng theo tài liệu backup hiện có; bảo vệ file vì có SĐT và dữ liệu tài chính. Kiểm chứng backup/restore Supabase thật là gate trước khi dùng dữ liệu quan trọng; không dựa vào kết quả restore local.

Hiện UI kho chưa có thao tác phục hồi MAINTENANCE → AVAILABLE. Sau khi kiểm tra vật lý và hủy/hết hạn đơn, quản trị viên xử lý phục hồi có đối soát/audit trong database; không đổi trạng thái hàng loạt. Muốn làm thao tác phục hồi ngay trên web cần một thay đổi riêng có guard khoản mượn và giữ chỗ. Beta hiện bảo đảm sách báo hỏng tiếp tục bị loại khỏi danh sách đặt.

Theo dõi sau mỗi buổi trực: Workers request/CPU/error/p95 latency, Hyperdrive SQL/day và connections/errors, Supabase database size/egress/slow queries, tỷ lệ hết sách khi xác nhận và số cảnh báo không thể giao. Đặt ngưỡng rà soát nội bộ 60–70% quota/ngày hoặc lỗi CPU 1102, pool timeout, DB tăng nhanh; đây chưa phải cảnh báo tự động đã cài. Nếu vượt, giảm poll hoặc nâng đúng thành phần sau khi đo. Kiểm tra project còn hoạt động trước buổi trực khi dùng Free.

Rollback code bằng Cloudflare Deployments về version trước; không tự đảo schema hoặc restore DB cũ vì có thể làm mất giao dịch mới. Nếu phát hiện sai tồn/quỹ, dừng nhận đơn theo quy trình vận hành, lưu bằng chứng và sửa dữ liệu có kiểm soát.

## 9. Chat thành viên có tốn thêm không?

Có thể vẫn **0 USD** ở mức dùng nhỏ nếu nằm trong quota chung. Supabase Free hiện có 200 kết nối Realtime đồng thời, 2 triệu message/tháng và 100 message/giây. Một người mở nhiều tab có thể dùng nhiều connection; message được tính cả phát/nhận theo cơ chế sản phẩm, không chỉ số tin người dùng gõ. [Pricing](https://supabase.com/pricing), [Realtime limits](https://supabase.com/docs/guides/realtime/limits), [Message usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages).

Ví dụ giả định: 30 người × 20 tin/ngày × 30 ngày = 18.000 tin gốc/tháng. Nếu mọi tin tới cả 30 người, khoảng 540.000 lượt giao, cộng lượt gửi, presence/reconnect và các nguồn Realtime khác. Một đợt nhiều tin tới cả nhóm có thể chạm giới hạn theo giây dù tổng tháng thấp. Nếu mỗi bản ghi khoảng 1 KB thì riêng nội dung 18 MB/tháng trước indexes/overhead; nên chốt lưu 30–90 ngày, text trước, chưa file đính kèm.

Đây là tính toán khả năng, chưa có chat trong code. Muốn làm tiếp cần private channels, phân quyền membership và logout/revoke đúng; phiên JWT riêng của YSBK không tự trở thành phiên Supabase Realtime. Không mở policy anon hoặc đưa service key ra frontend để nối nhanh.

## 10. Bằng chứng và phần còn chờ

Xem `beta-verification.md` cho kết quả local. Các bước còn chờ thực hiện thật: target project/account, secrets/site key, SQL trên Supabase, kết nối TLS Hyperdrive và cache OFF, Auth/Turnstile/cron cloud, import/đối soát sách, backup/restore và beta trên trình duyệt. Chỉ mở cho người dùng sau khi các gate cloud ở phần 8 đã được kiểm tra.
