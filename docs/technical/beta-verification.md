# Bằng chứng chuẩn bị beta — 20/10/2026

> Đây là snapshot đợt chuẩn bị beta trước khi chuyển ưu tiên sang local. Kiểm tra browser và stack local mới hơn được ghi trong [local-development.md](local-development.md); beta tiếp tục tạm hoãn.

Phạm vi: chuẩn bị code/config và hướng dẫn cho Supabase Free + Workers/Hyperdrive Free + Turnstile. Chưa triển khai cloud, chưa ghi Supabase thật, chưa nâng gói, chưa commit/push các thay đổi beta.

## Source và thay đổi

- Branch: `feat/beta-deployment`; nền `a019bb9ce9ba87082757bfc80cdf4522db5dc822`.
- `wrangler.beta.json`: một Worker + static assets, API/health đi qua Worker trước, Hyperdrive binding, cron 10 phút. Compatibility date `2026-10-19` phù hợp workerd cài sẵn; ngày `2026-10-20` đã thử nhưng runtime từ chối vì chưa hỗ trợ.
- Production bắt buộc Hyperdrive, pool trong mỗi request tối đa hai connection; không tự rơi về DATABASE_URL. Local development cũ vẫn giữ đường kết nối riêng.
- `build:beta` không truy vấn DB để dựng trang sách tĩnh và không xuất các trang sách demo. `.env.beta` tắt nút vào Demo, gắn staging/noindex theo cơ chế hiện có.
- Danh mục public phân trang 24, tìm kiếm/lọc thể loại ở server. Form đặt có tìm sách thay danh sách cố định 100 cuốn. Poll khi tab hiển thị: thứ Ba/thứ Năm 30 giây, ngày khác 60 giây; focus/visibility tải lại, cleanup khi rời tab. API tồn kho/lịch trả `no-store`.
- Hàng chờ nội bộ phân trang 50, tự làm mới; tính `fulfillmentIssue` và `meta.attentionCount` trong bộ lọc, ưu tiên bản không thể giao. Không thêm bảng thông báo hay email/SMS.
- `POST /api/v1/reservations/:id/issue`: member/admin đang hoạt động, ID hợp lệ và lý do bắt buộc; transaction khóa đơn/bản, kiểm tra HELD còn hiệu lực, đưa AVAILABLE sang MAINTENANCE và ghi audit. Không sửa khoản mượn đang mở, không tự hủy. Gửi lặp cho bản đã MAINTENANCE không tạo audit lặp. Nút báo sự cố dùng hộp thoại nhập lý do chuẩn của trình duyệt.
- SQL generator chỉ tạo file local: schema + toàn bộ migrations + hai quỹ, không seed demo; file access bật RLS, hạn chế grants, role server không có quyền quản trị. Template bootstrap admin không chứa mật khẩu và từ chối chạy khi chưa điền UUID/tên/SĐT.
- Deploy preflight chặn Hyperdrive ID giả, site key thiếu/test và expected hostname sai. Việc kiểm tra này không truy cập provider hay xác nhận secrets.

## Kiểm thử đã chạy

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| `pnpm run test:unit` | **333/333 đạt**, không skip. Bao gồm assets/API boundary, Hyperdrive bắt buộc/ưu tiên, pool nhỏ, poll visibility/overlap/cleanup, no-store và anonymous report 401 |
| `pnpm run test:db` | **64/64 đạt**, không skip; PostgreSQL 16 disposable tại localhost, harness chặn cloud/default database |
| Regression đặt sách sau sửa cuối | **11/11 đạt**; hết hạn, khóa bản cuối, hạn mức, giao/trả, cảnh báo và báo sự cố. Endpoint báo sự cố chạy với JWT test + fixture danh tính, dưới `ysbk_app`/RLS, đồng thời một transaction khác; một audit, đơn giữ HELD; giao sách hỏng bị chặn; hủy không trả sách hỏng về AVAILABLE |
| Bootstrap/RLS | **1/1 đạt**: áp dụng bộ SQL trên schema sạch; chỉ có hai quỹ, không có thành viên mẫu; RLS toàn bộ bảng ứng dụng; app đọc/ghi được, không CREATE/TRUNCATE; anon không đọc đơn, không execute hàm trigger kể cả khi trước đó có grant trực tiếp; chạy lại schema bootstrap bị chặn |
| Danh mục lớn | Fixture **3.000 đầu sách/3.000 bản**, dưới role app: trang 1 và trang 125 đều 24 bản ghi, không trùng; tìm `Beta Book 2999` ra đúng một đầu sách. Đây là kiểm tra chức năng, chưa phải benchmark tải cloud |
| `pnpm run check` | Astro + TypeScript: **0 lỗi, 0 warning, 0 hint** |
| `pnpm run beta:dry-run` | Build **4 trang**, Wrangler bundle/assets/Hyperdrive binding hợp lệ, không upload. ID binding vẫn là placeholder có chủ ý |
| OpenAPI | YAML parse được; endpoint báo sự cố và tham số category đã có trong contract |
| Preflight chưa cấu hình cloud | Trả exit 1 đúng thiết kế: yêu cầu ID Hyperdrive thật, Turnstile site key thật và expected hostname |

Các ca mới đã được chạy ở trạng thái thất bại trước khi bổ sung implementation. PostgreSQL cũng đã phát hiện lỗi kiểu tham số `concat_ws`; đã sửa cast text và chạy lại đạt. Fixture ca tiền mặt của regression được rollback cùng transaction để không ảnh hưởng bài kiểm thử sau.

## Workers local: HTTP và cron

Chạy `wrangler dev --config wrangler.beta.json --local --test-scheduled`, dùng biến `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` trỏ **role app của database disposable**. Không dùng `--remote`.

- `/`: 200 HTML qua static assets.
- `/api/v1/public/reservation-books?page=125&limit=24`: 200 JSON, 24/3.000, `Cache-Control: no-store` từ PostgreSQL thực.
- API không tồn tại: JSON 404, không rơi vào HTML assets.
- Hàng chờ và POST báo sự cố không có phiên: 401.
- `/health`: 200. `/health/ready`: 503 khi chưa có Managed Auth config, đúng cơ chế từ chối khi thiếu cấu hình. Không coi đây là readiness cloud đạt.
- `/sach/b-01`: 404, không có trang chi tiết demo trong build beta.
- Local scheduled handler qua Explorer API với cron `*/10 * * * *`: 200, `outcome: ok`, truy vấn bằng role app thành công.

Hyperdrive local nối trực tiếp DB, không mô phỏng được pooling/cache/TLS của provider. Không dùng kết quả này làm chứng nhận Cloudflare Free chịu được 130 người đồng thời.

## Gate còn mở trước khi mời người dùng

1. Xác định đúng Supabase project và Cloudflare account/hostname; cấu hình secrets, site key và Hyperdrive thật, xác nhận query cache OFF và TLS.
2. Apply/kiểm tra trên Supabase sạch bằng người vận hành; tạo Auth user, mapping admin và tài khoản thành viên. Test Auth thật, đổi mật khẩu/vô hiệu thành viên/logout.
3. Deploy beta, kiểm tra Turnstile thật, anti-replay, hostname/action, IP từ Cloudflare, cookie HTTPS và cron cloud.
4. Test giao diện trên trình duyệt thật. Công cụ browser hiện bị tắt trong Work settings; chưa kiểm chứng click, hộp thoại, layout, focus hay widget Turnstile bằng browser trong lượt này.
5. Import và đối soát một lô sách thật trước toàn bộ danh mục; kiểm tra quy trình import hàng nghìn cuốn, lịch trực và tồn kho vật lý.
6. Backup/restore dữ liệu Supabase ở môi trường tách biệt; chưa có bằng chứng backup cloud.
7. Đo request/SQL theo ngày trực, CPU/p95, DB size/egress, lỗi pool và số cảnh báo qua ít nhất hai buổi beta. Chat chưa triển khai; chỉ có dự toán trong hướng dẫn.

Chưa có thao tác phục hồi sách MAINTENANCE trong UI; quản trị viên cần quy trình phục hồi có kiểm tra/audit. Chi tiết tên miền sách dùng resolver 404 hiện có nên chưa tối ưu SEO. Các giới hạn này không làm sách hỏng trở lại tồn có thể đặt.
