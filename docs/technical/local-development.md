# Chạy và kiểm thử YSBK local

## Cập nhật tài khoản bạn đọc sau chat tiếp nối 21/10

Đã áp dụng migration 21 cộng thêm sau backup; runtime 4321 build lại đúng source. Đơn mới bắt buộc phiên bạn đọc Google, phiên mới thu hồi phiên cũ; chưa có Google OAuth client nên hiện đặt mới bị chặn, danh mục vẫn hoạt động. [Runbook và bằng chứng](reader-accounts-local-and-access.md) thay hướng dẫn đặt không login/smoke cũ phía dưới. `local:smoke` trả PARTIAL/exit 2 khi chưa có phiên QA Google thật. Chưa deploy; Browser Use bị tắt trong Work settings ở bước kiểm tra cuối.

## Snapshot runtime và handoff 21/10/2026

Lúc viết handoff: `http://localhost:4321/health/ready` HTTP 200, database/Auth provider connected; landing `http://localhost:4321/?public=1` HTTP 200; preview concept `http://127.0.0.1:4323/` HTTP 200. Đây là kiểm tra HTTP, chưa bảo đảm runtime đang phục vụ mọi source diff mới nhất.

Giữ Docker volume/tài khoản hiện có; không reset hoặc in `.local/ysbk/accounts.json`. Nếu cổng có tiến trình, kiểm tra PID/đường chạy trước khi dừng; ưu tiên script local có sẵn. 4322 là mockup lịch sử, không web chính. Browser Use cần kiểm tra lại quyền tại chat mới. [Session handoff](../SESSION-HANDOFF.md); chưa chạy lại suite nghiệp vụ trong lượt đồng bộ tài liệu.

Quyết định 20/10/2026: ưu tiên hoàn thiện và kiểm thử local. **Chưa triển khai beta**; chỉ chuyển sang beta sau khi các chức năng cần dùng được nghiệm thu, không còn lỗi chặn.

## Địa chỉ cố định

| Thành phần | Địa chỉ | Ghi chú |
| --- | --- | --- |
| Web + API | **http://localhost:4321** | Một Worker local phục vụ cả Astro và API cùng origin |
| PostgreSQL | `127.0.0.1:55433` | Database thao tác `ysbk_local`; database test riêng `ysbk_test_local` |
| Supabase Auth local | `http://127.0.0.1:55321/auth/v1` | GoTrue trong Docker, qua gateway Caddy |

Tất cả cổng chỉ bind `127.0.0.1`. Cổng Auth không dùng mặc định 54321 vì máy này có dải Windows excluded ports bao gồm cổng đó; không đổi cấu hình mạng hệ thống. Web không tự chuyển sang cổng khác nếu 4321 bị chiếm.

Compose project `ysbk-local` có ba container: `ysbk-local-db-1`, `ysbk-local-auth-1`, `ysbk-local-gateway-1`. Tái sử dụng image PostgreSQL/Caddy đã cài; image GoTrue được pin `v2.197.0`. Không dùng hoặc dừng container O_an_quan hay ứng dụng khác.

## Bật và tắt

Mở Docker Desktop trước. Từ thư mục dự án, với Node 24 và các package đã cài:

```powershell
pnpm run local:up
pnpm run local:status
```

Lần đầu, script tạo secrets ngẫu nhiên, database, schema/migrations, dữ liệu mẫu và tài khoản Auth local. Những lần sau dùng lại volume và tài khoản, không reset dữ liệu. Nó build frontend, khởi động web nền ở 4321, kiểm tra `/health/ready` rồi mới báo sẵn sàng. Không cần để cửa sổ terminal mở.

Sau khi sửa frontend, chạy lại `pnpm run local:up` và tải lại trang để lấy build mới. Backend được Wrangler theo dõi thay đổi. Nếu schema source thay đổi, script dừng để yêu cầu xem migration; không tự xóa/nạp lại dữ liệu đang có.

Dừng khi dùng xong:

```powershell
pnpm run local:stop
```

Lệnh dừng đúng tiến trình web đã ghi nhận và ba container của project; giữ nguyên container/volume `ysbk-local_postgres_data`. Không có lệnh reset/xóa volume tự động. Không dùng `docker compose down -v` với dữ liệu muốn giữ. Sau khi khởi động lại máy, chạy `local:up` để bật web.

## Tài khoản và dữ liệu mẫu

- Username **`admin`**: quản trị; **`thanhvien`**: thành viên.
- Mật khẩu sinh ngẫu nhiên nằm trong **`.local/ysbk/accounts.json`**. Không dùng mật khẩu này cho beta.
- `.local/ysbk/settings.json`, `docker.env` và `.dev.vars` chứa cấu hình/secrets local; toàn bộ `.local/` bị Git ignore. Không đưa các file đó lên repo hoặc gửi cho người khác.
- Có **4 đầu sách, 12 bản khả dụng**, tác giả/thể loại, các mốc giá cọc và hai quỹ sạch. Không có phiếu mượn/giao dịch tiền giả từ seed cũ.
- Lịch mẫu thứ Ba/thứ Năm trong 28 ngày từ lần khởi tạo đầu, khung **00:00–23:59**, ghi rõ “Bàn trực kiểm thử local”. Ngoài ngày/giờ nhận đã chọn, luồng giao vẫn phải bị chặn theo nghiệp vụ; không giả thời gian máy chủ. Khi lịch mẫu đã cũ, tạo lịch mới bằng chức năng quản lý trực.
- Chưa seed hoạt động/tuyển thành viên/đánh giá giả. Các danh sách đó ban đầu có thể trống.

Đăng nhập dùng Supabase Auth **thật trong Docker**, xác nhận password qua GoTrue; session/quyền ứng dụng vẫn dùng backend và PostgreSQL như luồng beta. Không cần tài khoản Supabase cloud, service key cloud hay cấu hình Cloudflare dashboard để chạy local. Stack không dựng Studio/Storage/Realtime vì hiện app chưa cần các dịch vụ đó. [Nguồn cấu hình Auth chính thức](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml).

## CAPTCHA local

Frontend/server dùng **test keys chính thức của Turnstile**. Vẫn gọi `siteverify`; không trả thành công giả tại backend. Vì vậy máy cần internet để tải widget và gọi Cloudflare. Không cần widget/site key thật.

Provider test trả metadata `result_with_testing_key` và không có hostname/action thật. Chỉ chấp nhận trường hợp này khi đồng thời: `NODE_ENV=development`, `LOCAL_TESTING=true`, request hostname là localhost/127.0.0.1, đúng test secret và provider xác nhận metadata. Production hoặc hostname public không được bật ngoại lệ. Giao diện form có nhãn local; đây chưa phải bằng chứng chống bot trên cloud. [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Chạy kiểm thử

```powershell
pnpm run check
pnpm run test:unit
pnpm run local:test:db
pnpm run local:smoke
```

- `local:test:db` chỉ dùng **`ysbk_test_local`**. Harness reset schema trong database này, không được chạy bằng URI `ysbk_local` hoặc Supabase. Script gán cả DATABASE_URL/TEST_DATABASE_URL sang database test để chặn rơi về database thao tác.
- `local:smoke` kiểm tra HTTP, Auth/password/role/cookie/logout thực, no-store, từ chối thiếu CAPTCHA và đặt → tra → hủy bằng test widget provider. Nó tạo một đơn synthetic có ID riêng rồi chỉ xóa đúng đơn đã hủy đó, không sửa đơn người dùng hay chứng từ tiền. Cần ít nhất một sách/lịch khả dụng.
- Test DB trên volume bền vững có thể chậm hơn database disposable tmpfs dùng trong đợt trước; không lấy thời gian cả suite làm latency mỗi request.

Log web: **`.local/ysbk/worker.log`**. Kết quả smoke: `.local/ysbk/smoke-result.json`. Khi báo lỗi, cung cấp thao tác, trang, thời điểm và thông báo; không gửi nguyên settings/.dev.vars/accounts.

Để gọi thử handler hết hạn trong local: `pnpm run local:expire`. Lệnh dùng Dev Explorer của Wrangler, chỉ xử lý đơn đã hết hạn theo thời gian hiện tại. Không coi cấu hình cron trong `wrangler dev` là bằng chứng scheduler cloud tự chạy đều; khi test local hãy gọi lệnh này để kiểm tra trạng thái lưu DB. Tồn khả dụng và quota vẫn loại đơn hết hạn ngay theo điều kiện thời gian, không phải chờ cron.

## Kiểm thử giao diện cần duy trì

1. Không đăng nhập, vào `/noi-bo`: sau 401 phải hiện yêu cầu xác thực và link login; không được kẹt ở “Đang xác thực”. Nhánh dọn phiên phải kết thúc loading dù đã hủy phiên bản request cũ.
2. Login admin, tải lại trang nội bộ: session còn hiệu lực; vào hàng chờ đọc được API thật. Logout rồi truy cập nội bộ lại phải bị chặn. Lặp với member và kiểm tra mục chỉ dành admin.
3. Lọc thể loại và tìm `Dac Nhan Tam` không dấu: chỉ ra đúng sách. Lúc đang fetch phải hiện trạng thái tải; không báo “không có sách” trước khi nhận kết quả. Giá bìa 74.000/75.000/230.000 và cọc 50.000/100.000/250.000 phải đúng, giá NULL giữ cọc mặc định.
4. Chọn sách, lịch, nhập tên/SĐT, đồng ý cọc, đợi CAPTCHA test xác nhận; tạo đơn thành công, xem bằng token, hủy qua modal. Tồn phải cập nhật lại. Không đưa token/SĐT vào nội dung công khai.
5. Tạo đủ ba đơn trong cùng IP: đơn thứ tư bị chặn. Trả sách chỉ mở suất SĐT; IP chưa qua 24 giờ vẫn chặn. Các thao tác tạo đơn bằng tay vẫn tính quota local; không có nút bỏ qua/reset quota.
6. Báo mất/hỏng trên một bản giữ: hiện cảnh báo nội bộ, đơn chưa tự hủy; giao bị chặn. Hủy sau khi liên hệ không đưa bản hỏng về AVAILABLE.

Trước beta phải kiểm tra tiếp giao/thu cọc, trả/hoàn cọc, hết hạn cuối buổi, sửa sai chứng từ, quyền từng vai trò, tuyển thành viên, sự kiện, báo cáo, import sách và backup/restore. Không suy rằng mọi chức năng đã hoàn thiện chỉ vì local server chạy hoặc các API test đạt. Chưa thêm chat, chưa phát email/SMS.

## Kết quả thực hiện trong lượt này

- Stack đã chạy tại 4321; readiness database/Auth trả 200.
- Tắt/mở lại đã giữ nguyên ID edition, member và mapping Auth; không tạo lại dữ liệu.
- Browser đã thử lọc/tìm không dấu, chặn nội bộ khi chưa login, login admin, reload giữ session, hàng chờ và logout; đặt/tra/hủy một đơn synthetic qua form với widget thật dùng test key.
- Đã sửa lỗi loading nội bộ bị kẹt sau 401, giá bìa không được chuyển từ API và thông báo hết sách xuất hiện sớm khi đang tải. Các sửa này được đối chiếu lại trên browser; giá bìa có regression PostgreSQL.
- Đã sửa SELECT danh tính đang bỏ sót username, có regression smoke với Auth/PostgreSQL thật cho admin và member.
- **336/336 unit**, **64/64 PostgreSQL**, không skip; Astro/TypeScript 0 lỗi/warning/hint; build 4 trang đạt. Suite PG trên volume bền vững mất khoảng 10 phút trong lượt này. HTTP smoke và scheduled handler local đạt; fingerprint dữ liệu không đổi qua restart.
- Log kiểm chứng local nằm trong `.local/ysbk/verification/`. Chưa nghiệm thu toàn bộ module và **chưa triển khai cloud**.
