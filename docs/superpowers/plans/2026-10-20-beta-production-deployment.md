# YSBK — Kế hoạch beta và triển khai thật

> **Ưu tiên mới:** Hoàn thiện/test local trước; không triển khai beta cho đến khi local đủ chức năng và không còn lỗi chặn. Môi trường và checklist hiện hành: [local-development.md](../../technical/local-development.md).

> **Cập nhật quyết định 20/10/2026:** Người dùng đã cho phép chuẩn bị code/config beta, chọn **Free trước**; sách vài nghìn cuốn, quầy tập trung thứ Ba/thứ Năm. Sự cố bản đã giữ: cảnh báo nội bộ và xử lý thủ công, chưa email/SMS. Chat mới tính chi phí, chưa triển khai. Các giả định hoạt động đều mỗi ngày và đề xuất Paid phía dưới là phương án dự phòng cũ, không phải cấu hình đã chọn. Hướng dẫn hiện hành: [beta-deployment-guide.md](../../technical/beta-deployment-guide.md); bằng chứng: [beta-verification.md](../../technical/beta-verification.md). Các checkbox cũ chưa tự động chứng nhận đã đạt cloud acceptance.

> **For agentic workers:** Use `executing-plans` to implement this plan task-by-task in the current agent. Không dùng subagent khi chưa có yêu cầu trực tiếp của người dùng. Các mục chưa đánh dấu là công việc dự kiến, chưa triển khai.

**Goal:** Đưa YSBK lên URL miễn phí bắt đầu bằng `yeusachbackkhoa`, phục vụ thử nghiệm 30 thành viên và 100 bạn đọc, rồi đo tải trước khi tăng tài nguyên.

**Architecture:** Một Cloudflare Worker phục vụ frontend Astro tĩnh và API cùng origin; PostgreSQL/Auth trên Supabase; Hyperdrive làm pool kết nối, tắt SQL cache; Turnstile kiểm tra đặt sách. Không cần VPS hay đổi database engine.

**Tech Stack:** Astro/React, Workers Static Assets, node-postgres, Hyperdrive, Supabase PostgreSQL/Auth, Turnstile. Giá/tài liệu được kiểm tra ngày 20/10/2026, USD, chưa thuế và phần vượt mức.

## 1. Phạm vi và trạng thái

- Source tham chiếu: commit `a019bb9ce9ba87082757bfc80cdf4522db5dc822`, repo `TheGiver262/YSBK`.
- Đợt sửa trước có 325 unit, 61 integration PostgreSQL disposable, 23 Python tests; check/build và Workers local đã có bằng chứng trong `docs/technical/public-reservation-handoff.md`. Đây không phải chứng nhận cloud production.
- Yêu cầu hiện tại là kế hoạch/hướng dẫn; chỉ thêm tài liệu. Không tạo tài khoản, đăng ký gói trả tiền, nạp dữ liệu thật hoặc deploy trong lượt lập kế hoạch.
- Giữ nguyên 1 bản/đơn, 3 suất/SĐT và 3 đơn/IP/24 giờ trượt; CAPTCHA không xác minh chủ SĐT. Trả sách chỉ mở suất SĐT, không hoàn lượt IP.
- Người dùng chọn tên miền nhà cung cấp, không mua domain. Tiền tố ghi đúng yêu cầu: `yeusachbackkhoa`.
- Không chạy harness reset, seed demo hoặc restore vào project có dữ liệu thật.
- Chỉ 1–2 người vận hành cần quyền tài khoản hạ tầng. 30 thành viên là tài khoản trong ứng dụng, không phải 30 ghế quản trị Supabase/Cloudflare trả phí.

## 2. Tính tải ban đầu

Chưa có số liệu đo. Tạm tính 30 thành viên và 100 bạn đọc **mỗi ngày** để có biên dự phòng; người dùng chưa xác nhận tần suất. 130 tài khoản/người dùng không đồng nghĩa có 130 request hay 130 kết nối DB đồng thời.

| Thành phần | Giả định | Kết quả |
|---|---|---|
| Nội bộ | 30 người × 2 phiên/ngày × 60 API/phiên | 3.600 API/ngày |
| Công khai | 100 người × 2 lượt/ngày × 12 API/lượt | 2.400 API/ngày |
| Cron | 1 lần/10 phút | 144 lần/ngày |
| Readiness monitor | 1 lần/5 phút | 288 lần/ngày |
| Tổng động | 6.000 + 144 + 288 | 6.432/ngày; 192.960/tháng 30 ngày |
| Ngân sách ước tính | Làm tròn tổng động | 200.000 request/tháng |
| Truy vấn DB | Trung bình giả định 5 statement/request + 30% dự phòng | Khoảng 40.000 statement/ngày; phải đo lại vì mutation có nhiều SQL |
| Người đọc Auth | 100 bạn đọc không đăng nhập | Không tạo thêm 100 tài khoản Auth |
| Đặt trước | 100 SĐT, mỗi SĐT tối đa 3 suất | Có thể phát sinh tối đa 300 suất cùng lúc nếu đủ sách/IP; không phải dự báo 300 đơn/ngày |

Kịch bản tải beta: 130 phiên đang mở; steady 20 API/s; burst 65–70 API/s trong 10 giây khi mọi người tải khoảng 5 API đầu trang. Đây là mục tiêu thử, không phải năng lực đã chứng minh.

Ước lượng dung lượng để lập ngân sách:

- 3.900 người-ngày/tháng × 1–3 MB tài nguyên tĩnh lần tải đầu: 3,9–11,7 GB/tháng, phân phối từ Cloudflare, không bắt Supabase phục vụ toàn bộ JS/ảnh.
- 200.000 API × 10–30 KB response: 2–6 GB payload/tháng trước khác biệt nén/cache/protocol; database egress thực tế không bằng HTTP payload, cần lấy dashboard để tính lại.
- Dành biên 100–300 MB database cho beta text/catalog/audit; không coi đây là dự báo chính xác. Catalog, số bản sách, ứng viên, lịch sử tài chính và JSON audit quyết định phần lớn dung lượng. Đo `pg_database_size` trước nhập và sau tuần đầu; không lưu ảnh/base64 trong bảng SQL.
- Chưa bật realtime/polling dày. Nếu 30 người poll mỗi 5 giây trong 8 giờ thì riêng polling đã là 172.800 API/ngày, vượt xa mô hình trên.

**Tình huống cần chấp nhận khi beta:** 100 bạn đọc cùng Wi-Fi trường có thể chung 1 IP public, do đó chỉ tạo được 3 đơn/24h theo quy tắc đã chốt. Không tự nới hạn mức; đo tỷ lệ 429 và phản hồi thực tế để chủ sản phẩm quyết định sau.

## 3. Lựa chọn hạ tầng và chi phí

| Phương án | Chi phí nền dự kiến/tháng | Quyết định |
|---|---:|---|
| Beta tiết kiệm: Supabase Free + Workers Free + Turnstile Free | $0 | Dùng dữ liệu thử và đo CPU trước. Free Worker giới hạn CPU 10 ms/lần gọi; nhiều request rẻ không đồng nghĩa logic nặng chạy được. |
| Beta đề xuất: Supabase Free + Workers Paid + Turnstile Free | Khoảng $5 | Có thêm biên CPU, vẫn cần backup độc lập và chấp nhận giới hạn Supabase Free. |
| Vận hành có dữ liệu/cọc thật: Supabase Pro một Micro + Workers Paid + Turnstile Free | Khoảng $30 | Đề xuất trước khi lấy hệ thống làm sổ chính thức. Nâng vì vận hành/backup, không vì 130 người dùng là quá lớn. |
| Giữ thêm staging Micro trong cùng tổ chức Supabase Pro | Khoảng $40 tổng với Workers | Thêm khoảng $10 compute cho project thứ hai; không mặc định staging trả phí là miễn phí. |

Các con số chưa gồm SMTP nếu triển khai email, lưu file vượt hạn mức, xuất PDF dịch vụ ngoài hoặc nâng compute. Domain nhà cung cấp $0. Chưa mua addon PITR, IPv4, dashboard seat hay R2 khi chưa có nhu cầu cụ thể.

[Supabase](https://supabase.com/pricing): Free có 500 MB DB; Pro từ $25/tháng, một Micro trong compute credit, DB 8 GB và backup ngày giữ 7 ngày. [Free có thể bị pause vì ít hoạt động](https://supabase.com/docs/guides/platform/free-project-pausing); đó là rủi ro vận hành, không phải thiếu MAU.

[Workers](https://developers.cloudflare.com/workers/platform/pricing/): Free 100.000 request/ngày; Paid từ $5/tháng gồm 10 triệu request và 30 triệu CPU-ms. Giả định 200.000 request × 30 ms CPU = 6 triệu CPU-ms, trong allowance; 30 ms là giả định cần đo. [Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) có request tài nguyên tĩnh miễn phí khi được phục vụ theo asset routing.

[Hyperdrive](https://developers.cloudflare.com/hyperdrive/platform/pricing/) gồm trong Workers: Free 100.000 statement/ngày, Paid không có quota statement tương ứng; database Supabase vẫn có giới hạn riêng. [Turnstile Free](https://developers.cloudflare.com/turnstile/plans/) đủ cho nhu cầu này.

### Các lựa chọn thay thế

| Lựa chọn | Được gì | Đổi lại / khi nên chọn |
|---|---|---|
| Vercel + Supabase | Preview/Git deploy thuận tiện, URL kiểu `yeusachbackkhoa.vercel.app` nếu khả dụng | Cần adapter backend, cron và IP trust mới. Supabase vẫn trả riêng. [Pro $20/tháng](https://vercel.com/pricing); [Hobby dành cho cá nhân phi thương mại](https://vercel.com/docs/plans/hobby), không mặc định hoạt động CLB đủ điều kiện. |
| Netlify + Supabase | Hosting, Functions và dịch vụ data tích hợp; URL kiểu `yeusachbackkhoa.netlify.app` nếu khả dụng | Cần chuyển runtime/chức năng lịch; xác thực hiện tại vẫn gắn Supabase. [Free 300 credits, Personal $9, Pro $20](https://www.netlify.com/pricing/); [hết credit Free có thể pause project](https://www.netlify.com/pricing/personal-vs-free/). Không chọn chỉ vì thấy $0. |
| Neon + Workers | PostgreSQL và Managed Better Auth; đáng xem nếu ưu tiên DB theo mức dùng | [Free hiện 1 GB/project, 100 CU-hour; Launch theo mức dùng](https://neon.com/pricing). PostgreSQL dễ chuyển hơn Auth: code hiện gọi Supabase nên phải viết/test lại provider và mapping. Nếu DB chạy 0,25 CU cả tháng 720h thì cần 180 CU-hour, vượt Free; monitor/cron ảnh hưởng thời gian ngủ. |
| VPS tự quản | Toàn quyền Node/Postgres/runtime | Người vận hành phải lo patch, backup, chứng chỉ và phục hồi. Chưa có lợi rõ cho lượng người này, không tận dụng VPS dự án khác khi chưa được phép. |

Chọn Supabase + Workers cho beta vì ít thay đổi nhất. Không chuyển sang D1/SQLite: ứng dụng đang dựa PostgreSQL transaction, row lock, trigger và index. Không chuyển frontend sang Next.js chỉ để dùng Vercel.

## 4. URL, môi trường và phân công

| Môi trường | Worker | URL dự kiến | Dữ liệu |
|---|---|---|---|
| Beta | `yeusachbackkhoa-beta` | `https://yeusachbackkhoa-beta.<account>.workers.dev` | Supabase project beta, tài khoản/dữ liệu thử |
| Chính | `yeusachbackkhoa` | `https://yeusachbackkhoa.<account>.workers.dev` | Supabase project chính riêng, secret riêng |

`<account>` là subdomain Cloudflare chọn khi tạo tài khoản; chưa xác nhận tên nào còn trống. [workers.dev có dạng này](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/). Nhà cung cấp khuyên custom domain cho hệ thống business-critical; URL miễn phí phù hợp lựa chọn beta hiện tại, không có lời hứa SLA từ kế hoạch này.

Bạn thực hiện: tạo tài khoản sở hữu, bật MFA hạ tầng, chọn gói, tạo project/widget, lưu credential vào nơi bí mật, xác nhận dữ liệu đầu vào. Người triển khai chuẩn bị config/source/migrations/checks; bước deploy và nhập dữ liệu thật chỉ thực hiện khi được yêu cầu riêng. Không gửi password, connection URL hay secret trong chat.

## 5. Supabase — hướng dẫn cấu hình

### 5.1 Project và database

- [ ] Tạo organization dưới tài khoản chủ sản phẩm; MFA và thông tin phục hồi do chủ sản phẩm giữ.
- [ ] Tạo project `ysbk-beta`, chọn [Singapore](https://supabase.com/docs/guides/platform/regions) nếu có; đặt mật khẩu DB ngẫu nhiên và lưu password manager. Khi vận hành thật tạo `ysbk-production` riêng; kiểm tra giá trước khi giữ đồng thời hai project trả phí.
- [ ] Tại **Connect**, lấy endpoint **Direct connection**, DB name/port/host. Dùng cho Hyperdrive; không chọn Supavisor transaction URL làm origin của Hyperdrive. Máy quản trị không có IPv6 có thể dùng session pooler cho migration/backup nếu tương thích, không mua IPv4 addon chỉ vì máy local thiếu IPv6.
- [ ] Trước khi tạo bảng YSBK, vào **Integrations → Data API**, tắt **Enable Data API**. App truy vấn SQL qua Worker, không dùng Supabase REST cho dữ liệu. Auth vẫn là dịch vụ đăng nhập riêng. Xác minh request REST trực tiếp không đọc được members/reservations/journal, kể cả khi có publishable key. [Tài liệu cấu hình](https://supabase.com/docs/guides/api/securing-your-api).
- [ ] Dùng SQL Editor với vai trò migration để áp dụng baseline `docs/technical/schema/01_schema.sql`, sau đó các migration 02…15 theo thứ tự, trên **beta mới trước**. Chạy lỗi thì dừng, không bỏ qua lỗi FK/search_path. Supabase có schema `extensions`; kiểm tra `unaccent`/`pg_trgm` và trigger search thực sự chạy trong môi trường đó.
- [ ] Chuẩn bị script bootstrap chỉ có hai quỹ `FUND_LOAN`, `FUND_OPERATION`, một admin thật và mapping Auth; không chạy `02_seed.sql` vì có người dùng, provider subject và nghiệp vụ giả.
- [ ] Tạo DB role riêng `ysbk_app`, không dùng `postgres` để chạy app. Cấp DML/sequence/function đúng các bảng YSBK, quyền schema cần cho extensions; không cấp CREATE/DROP/TRUNCATE hoặc role quản trị. Không thay grant toàn project làm hỏng Supabase Auth. Chạy thử mutation/trigger bằng chính role đó trước khi nối Worker. [Lưu ý quyền kế thừa PUBLIC](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c).
- [ ] Giữ migration account tách app role. Không bật RLS hàng loạt rồi giả định role SQL mới vẫn ghi được; nếu bật RLS phải thiết kế/test policy cho đúng đường truy cập. Trước beta bắt buộc chứng minh không truy cập thẳng bảng qua Data API và role app không DDL được.

### 5.2 Auth username/mật khẩu

- [ ] **Authentication → Providers/Sign In**: bật email/password; **Allow new users to sign up = OFF**. Tắt anonymous và provider Google nếu không dùng. Khách đặt sách không cần Supabase anonymous sign-in. [General configuration](https://supabase.com/docs/guides/auth/general-configuration).
- [ ] Site URL đặt đúng origin beta; Redirect URLs chỉ thêm origin beta/chính cần thiết, không wildcard mọi domain. Login hiện tại dùng password qua backend, không phải OAuth redirect flow.
- [ ] **Settings → API Keys**: dùng key `sb_publishable_…`. Source hiện đọc biến tên `SUPABASE_ANON_KEY` và gửi nó ở header `apikey`; có thể giữ tên biến để giảm sửa nhưng giá trị là publishable key mới. Cần smoke test `/auth/v1/health` và password sign-in với key mới. Không lấy Supabase JWT signing secret làm `JWT_SECRET` của YSBK. [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- [ ] **Authentication → Users → Add user/Create user**: tạo admin đầu tiên với email nội bộ đúng code, ví dụ username `admin.ysbk` tương ứng `admin.ysbk@internal.ysbk.edu.vn`. Đặt mật khẩu riêng, đánh dấu email đã xác nhận. Domain này chỉ là định danh nội bộ trong code, không cần mua domain/gửi email xác nhận đến địa chỉ đó.
- [ ] Chép Auth user UUID vào `internal_identities.provider_subject`; tạo dòng `members` với dữ liệu admin đúng thực tế và mapping cùng `member_id`. Đủ `full_name`, `username`, `gen`, `team`, `role_title`, `school_year`, `phone`. Role dựa `members`, không dựa email hoặc tên có chữ admin. [Admin tạo user xác nhận sẵn](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
- [ ] Tạo thêm một MEMBER thường, một ALUMNI, một user bị khóa để UAT; sau đó tạo 30 người theo danh sách đã đối soát. Tài khoản Auth tạo thành công mà mapping lỗi phải khóa/đối soát, không tự gán cho người khác.
- [ ] Quy trình đổi/reset password do admin xác minh danh tính trong beta; tăng `members.token_version` khi cần thu hồi phiên YSBK. Reset trong Supabase đơn lẻ không chứng minh cookie YSBK 24h đã bị thu hồi. Chưa bật email self-service với domain nội bộ giả; nếu cần sau này phải thêm email thật + SMTP + luồng reset được test.
- [ ] Không bật CAPTCHA cho **Supabase Auth** chỉ vì đã có Turnstile đặt sách: đây là hai luồng khác nhau; login hiện chưa gửi captcha token cho Supabase. Giữ rate limit Auth, thử 30 người login/retry cùng mạng và theo dõi 429. [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## 6. Cloudflare và Turnstile — hướng dẫn cấu hình

### 6.1 Account, Hyperdrive và pool

- [ ] Tạo Cloudflare account, bật MFA; vào **Workers & Pages** chọn account subdomain và ghi lại URL ở mục 4. Không cần thêm DNS zone khi dùng workers.dev.
- [ ] Bắt đầu Workers Free nếu thử giới hạn; phương án đề xuất beta là Workers Paid $5 sau khi chủ sản phẩm chọn gói. Cloudflare website Pro và Workers Paid là hai sản phẩm khác nhau; không cần mua website Pro cho kế hoạch này.
- [ ] **Hyperdrive → Create configuration**: tên `ysbk-beta-db`, origin là Direct endpoint Supabase với role `ysbk_app`, TLS bật. Tạo một binding `HYPERDRIVE` cho Worker beta; production có config riêng.
- [ ] Tắt query cache ngay trong cấu hình Hyperdrive. Cache mặc định không tự vô hiệu khi ghi; tồn, khóa phiên, quyền và hạn mức phải đọc mới. [Hướng dẫn Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/), [query cache](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).
- [ ] Có thể dùng lệnh sau sau khi đã có config ID (không có credential trên command line):

```powershell
pnpm exec wrangler hyperdrive update <CONFIG_ID_BETA> --caching-disabled
```

- [ ] Bắt đầu origin pool mục tiêu khoảng 10 kết nối nếu tier hỗ trợ chỉnh, chừa connection cho Auth/migration. Đây không phải hard cap toàn cầu; theo dõi kết nối thực tế. Mỗi request Worker chỉ cần pool local 1–2 client cho code tuần tự, không nhân 10 client × 130 người. [Pool tuning](https://developers.cloudflare.com/hyperdrive/configuration/tune-connection-pool/).

### 6.2 Turnstile

- [ ] **Turnstile → Add widget**: tạo `YSBK Beta`, chế độ **Managed**, hostname đầy đủ beta, không có `https://` hoặc path. Tạo widget production riêng; không dùng localhost hay key test cho bản công khai.
- [ ] Site key đưa vào **Build variables** của frontend: `PUBLIC_TURNSTILE_SITE_KEY`. Secret key đưa vào **Worker runtime Secret**: `TURNSTILE_SECRET_KEY`. Site key có thể công khai; secret không được đưa vào biến `PUBLIC_*`.
- [ ] Runtime text variable `TURNSTILE_EXPECTED_HOSTNAME` = đúng hostname browser đang mở; code kiểm tra action `reservation` như widget hiện có. Pre-clearance để mặc định/tắt khi chưa có yêu cầu riêng.
- [ ] Thử bằng trình duyệt thật: token đúng được tạo đơn; thiếu/sai/hết hạn token bị chặn; lỗi provider không tạo đơn; retry intent đã commit không trừ lượt lần hai. [Bắt đầu](https://developers.cloudflare.com/turnstile/get-started/), [server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

### 6.3 Bảng cấu hình runtime/build

| Tên | Vị trí | Giá trị/ghi chú |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | Build variable | Site key của widget đúng môi trường; đổi phải rebuild |
| `NODE_ENV` | Runtime text | `production`, kể cả beta cloud, để cookie có Secure |
| `TURNSTILE_EXPECTED_HOSTNAME` | Runtime text | Hostname exact, không protocol/path |
| `SUPABASE_URL` | Runtime text hoặc Secret | URL project đúng môi trường |
| `SUPABASE_ANON_KEY` | Runtime Secret theo convention dự án | Giá trị publishable key mới; tên biến hiện hữu |
| `JWT_SECRET` | Runtime Secret | Khóa YSBK riêng ngẫu nhiên ít nhất 32 ký tự |
| `RESERVATION_IP_SECRET` | Runtime Secret | Khóa riêng khác JWT, ổn định; không tự rotate khi còn cửa sổ IP/intent |
| `TURNSTILE_SECRET_KEY` | Runtime Secret | Secret key widget đúng môi trường |
| `RECRUITMENT_WEBHOOK_SECRET` | Runtime Secret nếu dùng webhook | Cùng secret ở nguồn Google Form/Apps Script; chưa cấu hình thì không mở luồng webhook |
| `HYPERDRIVE` | Runtime binding | ID config Hyperdrive đúng DB, caching disabled |
| `DATABASE_URL` | Local hoặc fallback quản trị theo mục đích | Không cần trong frontend cloud build; runtime production ưu tiên bắt buộc Hyperdrive sau task kỹ thuật |
| `SUPABASE_SERVICE_ROLE_KEY` | Không đưa vào Worker khi chưa cần | Source login hiện không dùng; công cụ provisioning đặc quyền giữ riêng |

Runtime Secret: **Worker → Settings → Variables and Secrets → Add → Secret**. Build variable nằm trong **Builds/Settings → Build variables**, không phải cùng nơi với runtime. [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## 7. Các bước kỹ thuật phải hoàn thành trước lần deploy đầu

### Task 1 — Phục vụ frontend và API cùng Worker

**Files:** tạo `wrangler.beta.jsonc`, `wrangler.production.jsonc`; sửa `src/server/index.ts`, `src/server/types.ts`; regression `tests/unit/deployment-routing.test.ts` và script kiểm thử HTTP mới.

- [ ] Kiểm thử trước: `/` trả HTML, `/login/` và `/noi-bo/` tải được; `/api/v1/auth/me` không bị trả HTML 200; API thiếu trả JSON 404; trang thiếu trả 404; assets không kết nối DB.
- [ ] Cấu hình sau chỉ là mẫu cho file beta mới, không thay `wrangler.json` local trong lượt lập kế hoạch:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "yeusachbackkhoa-beta",
  "main": "src/server/index.ts",
  "compatibility_date": "2026-10-20",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page",
    "run_worker_first": ["/api/*", "/health", "/health/*"]
  },
  "vars": { "NODE_ENV": "production" },
  "triggers": { "crons": ["*/10 * * * *"] },
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<CONFIG_ID_BETA>" }]
}
```

- [ ] Thêm `ASSETS: { fetch(request: Request): Promise<Response> }` vào Env và nhánh đầu `fetch` trước khi mở DB:

```ts
const path = new URL(request.url).pathname;
if (!path.startsWith('/api/') && path !== '/health' && !path.startsWith('/health/')) {
  return env.ASSETS.fetch(request);
}
```

- [ ] Tăng compatibility_date phải chạy lại Workers tests, không coi đổi ngày chỉ là sửa nhãn. Routing theo [SSG assets](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) và [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
- [ ] Xử lý các trang mẫu `/sach/b-01…`: `getStaticPaths` hiện vẫn có demo fallback. Production build chỉ xuất dữ liệu công khai thật hoặc tạm không tạo các route demo; không đưa credential DB vào frontend build chỉ để che lỗi. Landing hiện có modal/API nên beta có thể không có SEO route sách riêng. Kiểm tra `src/pages/404.astro` không biến đường dẫn sách sai thành thông tin mẫu tưởng là thật.
- [ ] Xác nhận UI LIVE là mode dùng thật; DEMO phải có nhãn và không lẫn với đơn/tài chính thật. Trang static shell `/noi-bo` không chứa PII; quyền dựa API, không chỉ dựa redirect.

### Task 2 — Hyperdrive và quyền DB

**Files:** `src/server/db/client.ts`, `src/server/types.ts`; tests ở `tests/unit/reservation-repair.test.ts`, `tests/integration/reservation-flow.test.ts`; script SQL bootstrap và grants mới trong `docs/technical/schema/`.

- [ ] Thêm `HYPERDRIVE?: { connectionString: string }`; ở cả `getDatabasePool` và readiness dùng binding trước URL local:

```ts
const dbUrl = env?.HYPERDRIVE?.connectionString || env?.DATABASE_URL || process.env.DATABASE_URL;
```

- [ ] Production thiếu binding phải báo cấu hình lỗi; không âm thầm dùng DB local hoặc project khác. Giữ scope kết nối từng request/cron và đóng trong finally; local pool max 2 là điểm khởi đầu cần đo.
- [ ] Unit test binding được chọn, thiếu config fail-closed, isolation giữa request; chạy PG disposable regression và cloud beta smoke. Không truyền Supabase cloud URL vào `TEST_DATABASE_URL` vì harness là công cụ reset local.
- [ ] Test kết nối bằng app role: đọc danh mục, create/cancel/fulfill/return, ledger/audit, hết hạn, xuất báo cáo; thử CREATE/TRUNCATE bị từ chối. Kiểm tra lỗi TLS/extension thực trên project beta; không dùng `rejectUnauthorized:false` làm giải pháp.

### Task 3 — Bootstrap admin và cấu hình an toàn

**Files:** script bootstrap tối thiểu mới; tài liệu provisioning trong `docs/technical/`; fixtures auth regression hiện có. Không chỉnh seed demo thành seed production.

- [ ] Tạo hai quỹ, admin và mapping đúng UUID. Kiểm tra trước/sau bằng SELECT `members` JOIN `internal_identities`; không log password.
- [ ] Login với publishable key và tài khoản thật; cookie Secure/HttpOnly/SameSite=Lax; refresh trang đi thẳng nội bộ; logout hết quyền; MEMBER không thành ADMIN; ALUMNI/disabled/thu hồi bị chặn.
- [ ] Thử `/rest/v1/members`, `/rest/v1/reservations` và RPC trực tiếp bằng publishable key: không đọc/ghi được dữ liệu YSBK. Không test quyền chỉ bằng cách giấu key trên frontend.
- [ ] Kiểm tra login rate limit/429; giữ mã lỗi provider có ý nghĩa thay vì mọi lỗi provider đều báo sai mật khẩu. Kiểm tra giới hạn body/upload/import và audit dữ liệu thực; các kiểm thử này là cổng cloud, không có kết luận từ unit cũ.

### Task 4 — Build/Git và deploy beta

**Files:** config beta/chính ở Task 1, `.env.example` cập nhật tên/ý nghĩa biến, checklist deploy; nếu dùng CI thì thêm workflow checks có scope riêng.

- [ ] Dùng Node `24.14.0`, pnpm `11.28.6` đang kiểm tra được ở local làm baseline; `pnpm install --frozen-lockfile`. Kiểm tra khả năng chọn đúng runtime trên build image trước khi pin.
- [ ] Cloudflare **Workers & Pages → Create → Import repository**, chọn `TheGiver262/YSBK`; chỉ cấp GitHub App quyền repo cần thiết. Deploy beta từ nhánh đã review, không cho preview PR nhận secret production.
- [ ] Build command: `pnpm run build`. Deploy command beta: `pnpm exec wrangler deploy --config wrangler.beta.jsonc`. Lệnh chính tương ứng config production. Đây là lệnh cho bước triển khai sau; chưa chạy ở lượt lập kế hoạch.
- [ ] Chỉ build variable site key; runtime secret/binding đặt đúng Worker trước khi mở form. Không đặt DATABASE_URL, TEST_DATABASE_URL, service secret vào build frontend. Nếu cần dùng thư viện trong build thì phải kiểm tra `pg`/tooling vẫn được cài theo lockfile, không prune devDependencies sớm.
- [ ] Chạy checks, build và `wrangler deploy --dry-run --config wrangler.beta.jsonc`; kiểm tra bundle không có key/PII, route demo đã xử lý, cùng artifact chứa assets + API.
- [ ] Deploy beta, ghi SHA Git, Worker version, project ref, Hyperdrive ID và hostname; không ghi password/token. Kiểm tra cron bật đúng `*/10 * * * *`.

### Task 5 — UAT cloud và đo tải

**Files:** checklist `docs/technical/beta-acceptance.md` mới; script tải có guard chỉ hostname beta và dữ liệu synthetic; không dùng harness reset cloud.

- [ ] Health `/health` 200 và `/health/ready` 200 với cả DB/Auth. Kiểm tra browser Network để chắc request /api cùng origin và cookie không bị CORS/SameSite chặn.
- [ ] Đặt 1 sách với Turnstile thật; đặt đủ 3 suất rồi bị chặn; dùng IP khác vẫn chặn SĐT; SĐT khác cùng IP vẫn chặn IP. Test retry sau timeout trả cùng đơn/token, đổi payload cùng key trả 409.
- [ ] Đến ca: đọc tên/SĐT, xác nhận cọc rồi nhận một bản; retry không thêm phiếu/journal. Trả một bản mở đúng một suất SĐT; IP đủ 3 trong 24h vẫn bị chặn. Không dùng tiền thật trong beta synthetic.
- [ ] Hết giờ nhận: tồn/quota có hiệu lực ngay, cron cập nhật trạng thái sau; kiểm tra ít nhất một lần cron thực trên cloud, không chỉ gọi thủ công local.
- [ ] Chạy tranh copy/cuối suất, rollback và race cancellation/handoff trên beta qua backend. Load test tự động không giả token vượt Turnstile: đo API đọc và service path bằng môi trường thử riêng; CAPTCHA thật chạy UAT với người. Không thêm production bypass để làm bài đo.
- [ ] Test Android/iPhone, desktop, mạng Wi-Fi CLB và 4G; mất mạng sau submit, refresh/retry, token lookup URL, tab create/lookup, khóa account giữa request. Browser hiện bị tắt trong Work settings; phải mở quyền hoặc người dùng thực hiện UAT, không báo PASS từ source.
- [ ] Recruitment: webhook signature sai bị chặn, responseId gửi lặp không nhân ứng viên; event: tạo/đăng ký/đổi trạng thái và kiểm tra role. Nếu chưa tích hợp Form/Apps Script thật thì giữ riêng cổng này, không gọi toàn bộ nhóm tuyển dụng đã nghiệm thu.
- [ ] Bắt đầu 5 thành viên + 10 bạn đọc trong một buổi, sau đó 30 + 100 trong 7–14 ngày. Tăng đến 130 phiên và steady/burst ở mục 2 trên beta với dữ liệu đủ sách, không chạy vào production.

### Task 6 — Chuyển vận hành và phục hồi

**Files:** `docs/technical/production-runbook.md` mới; cấu hình project/secret chính; script import dữ liệu kiểm tra trước; không chỉnh tiền/lịch sử để khớp số giả.

- [ ] Chọn Pro khi dùng làm sổ chính thức; lập DB mới riêng, lặp schema/hardening/grants/bootstrap đã qua beta. Nhập danh mục, barcode, 30 thành viên và nghĩa vụ mượn/cọc tồn bằng quy trình đối soát có chủ sở hữu; không chỉ nhập số dư tổng mà mất chi tiết người/bản sách.
- [ ] Backup trước nhập/nâng cấp, kiểm tra checksum và restore drill trên project sạch thử nghiệm; PG local đã qua không chứng minh restore Supabase schema/role/Auth giống hệt. Backup DB không bao gồm nội dung file ngoài DB; nếu thêm ảnh/file phải backup riêng.
- [ ] Đặt RPO mục tiêu 24h, RTO mục tiêu 4h; đây là mục tiêu, chưa phải SLA. [Pro backup ngày và hướng dẫn Free xuất backup](https://supabase.com/docs/guides/platform/backups). Duy trì bản mã hóa ngoài nhà cung cấp, giữ 7 bản ngày + 4 bản tuần, kiểm tra restore định kỳ theo lịch người vận hành; chưa tự tạo automation trong lượt này.
- [ ] Chỉ promote sau khi chủ sản phẩm xác nhận UAT, đối soát và thời điểm chuyển. URL chính dùng widget/key/hostname production; không copy database beta có giao dịch thử vào sổ thật.
- [ ] Ghi version trước/sau; nếu lỗi UI/API thì rollback Worker version tương thích schema. Không tự restore DB production vì rollback code: chặn mutation ở tầng server trước, backup, xác định giao dịch mới phát sinh và đối soát rồi mới quyết định phục hồi.
- [ ] Chưa có maintenance switch server: nếu cần trong runbook phải chuẩn bị/test nó trước mở dùng thật; không chỉ ẩn nút frontend rồi coi ghi đã dừng.

## 8. Đo beta và điều kiện nâng cấp

| Chỉ số | Cách đo | Ngưỡng hành động ban đầu |
|---|---|---|
| API theo endpoint, CPU, 5xx | Workers metrics, request ID, timing không PII | 5xx >1% trong 5 phút điều tra; lỗi tiền/tồn dù 1 lần thì dừng luồng liên quan |
| Độ trễ tại Việt Nam | Browser timing và log duration | Mục tiêu p95 đọc <800 ms, ghi <1.500 ms; login <2 giây; đây là mục tiêu cần đo |
| Quota/cloud spend | Dashboard nhà cung cấp | Cảnh báo 60% và 80%; Workers CPU sát 10 ms thì chuyển Paid trước khi mở rộng Free |
| DB size/CPU/connections | Supabase metrics, pg_database_size, pool metrics | Free DB 300 MB xem lại dự báo, 400 MB chuẩn bị nâng; CPU/kết nối dùng >70% kéo dài 15 phút điều tra query/pool trước nâng máy |
| SQL latency/lock wait | DB/Hyperdrive metrics, timing transaction | Timeout/deadlock >0 cần phân tích; không tự retry mutation không có idempotency |
| 429 | Tách IP quota, phone quota, Auth throttle, provider limit | 429 nghiệp vụ là kết quả đúng; đo tỷ lệ chung mạng, không cộng vào server 5xx |
| CAPTCHA | Turnstile analytics và lỗi provider | Theo dõi thất bại theo hostname/action, không log token |
| Hết hạn | Cron success, số HELD quá expires_at | Không có cron thành công >20 phút thì cảnh báo; xác nhận tồn vẫn không bị chặn bởi cron trễ |
| Backup | Tuổi bản cuối và thử restore | Bản backup >24h hoặc restore lỗi thì xử lý trước buổi trực tiếp theo |

Không log full name/SĐT/token/cookie/body form/password. Không xóa journal/audit để giảm size; thống kê trước khi đặt retention cho technical logs hoặc marker hết hạn. Tổng hợp sau ngày 3, ngày 7 và hết beta: request/ngày, concurrency peak, CPU-ms, DB growth, egress, p95, lỗi nghiệp vụ, chi phí thực.

Chỉ thêm cache công khai, tăng pool/compute hoặc đổi nhà cung cấp sau số đo. Chưa cần Redis, queue nghiệp vụ, realtime, Kubernetes, SMS/OTP hay converter PDF chỉ để đưa bản beta hiện tại lên mạng.

## 9. Việc bạn có thể làm trước ngay bây giờ

1. Tạo Cloudflare account + Supabase project beta, giữ quyền sở hữu và MFA.
2. Ghi tên account subdomain dự kiến; xác định URL beta đầy đủ bắt đầu `yeusachbackkhoa`.
3. Tạo Turnstile widget Managed cho đúng URL đó; lưu site key và secret vào đúng nơi, không gửi secret trong chat.
4. Tắt Data API và self-signup; chưa nạp seed demo, chưa nhập giao dịch/cọc thật.
5. Chuẩn bị danh sách 30 thành viên và catalog/barcode, phân người admin/quầy, tách dữ liệu dùng thử khỏi số liệu thật.
6. Người triển khai thực hiện Task 1–4 rồi cùng bạn UAT Task 5. Chưa thể chỉ bấm Import GitHub và coi cả frontend/API/Auth đã chạy đúng.
