# Review và sửa lỗi đặt sách công khai — 20/10/2026

Phạm vi: đối chiếu implementation Antigravity với `docs/technical/public-reservation-design.md`, kế hoạch PR-0…PR-9 và các sửa lỗi hậu Chặng 22. Người dùng đã cho phép sửa, commit và push lên GitHub YSBK; chưa cho phép triển khai production. Review và sửa trực tiếp, không dùng subagent.

## Kết quả review và xử lý

| Nhóm | Lỗi xác định | Sửa và bằng chứng |
|---|---|---|
| Schema | Migration tham chiếu thành viên bằng VARCHAR trong khi PK là UUID; baseline lịch trực thiếu ràng buộc/default; thiếu bảng tiêu thụ vé export | Sửa baseline/migration 06–07, thêm migration 15. Chuỗi migrations chạy trên PostgreSQL 16; 61 integration tests qua. Migration không tự xóa dữ liệu lỗi để vượt cổng. |
| Hạn mức | IPv6 tương đương có thể ra khóa khác; fallback secret công khai; nghĩa vụ mất sách có thể bị bỏ khỏi số đang mượn | Chuẩn hóa IP bằng parser chuẩn, bắt buộc secret đủ dài; đếm mọi loan item chưa trả và chưa chuyển tiếp. SĐT chia sẻ khóa giữa đặt công khai và mượn tại quầy. |
| Tranh tồn | Giữ chỗ quá hạn còn chiếm unique index; hai người tranh quyển cuối có thể nhận lỗi SQL | Giải phóng hold hết hạn trong transaction trước khi chọn; chọn bản bằng `FOR UPDATE … SKIP LOCKED`. Có regression PostgreSQL tranh quyển cuối. |
| Replay | Payload thiếu trường tùy chọn; cùng key ở nhiều IP có thể tranh tạo đơn; reload mất key | Hash payload đầy đủ; khóa intent riêng và unique index; token replay khớp hash đã lưu; frontend lưu key và hash trong sessionStorage, không lưu PII. Có test hai kết nối cùng intent. |
| Bàn giao | Dùng provider userId thay memberId cho FK; thiếu chống lặp tại router; adapter gửi khác tên header | Dùng memberId; claim/complete idempotency cùng transaction; đồng bộ `X-Idempotency-Key` ở adapter/router/OpenAPI. Regression qua router thật, JWT có provider subject khác member UUID, retry trả cùng phiếu; đổi payload trả 409. |
| Tiền/quầy | Cần giữ thứ tự khóa và kiểm tra đúng người, đúng thời điểm | Khóa phiên tiền trước; đối chiếu tên + SĐT của borrower; giữ liên kết reservation khi gọi nghiệp vụ mượn hiện hữu; kiểm tra hết hạn sau khi chờ khóa. Nhận, trả và mở lại suất SĐT đã chạy trên PG. |
| Tính toàn vẹn | Có thể chuyển kho/đổi giá/archive bản đang hứa giữ; đổi SĐT khi còn sách chưa trả; đổi giờ/địa điểm ca trong lúc tạo đơn | Khóa copy/borrower/schedule và chặn các thay đổi tương ứng. Đã tái hiện chuyển kho và bổ sung regression. |
| CAPTCHA | Chấp nhận response thiếu action/hostname hoặc success không phải boolean; timeout chưa bao phủ đọc response body | Kiểm tra chặt response, action `reservation`, cấu hình hostname; dọn timeout trong finally. Bỏ site key giả trên frontend; thiếu cấu hình không cho đặt mới. Production yêu cầu hostname. |
| Public/UI | Landing dùng dữ liệu mẫu; staff DTO thiếu tên/SĐT/barcode; tab tra cứu mở nhầm form; widget cleanup giữ ID cũ; form không tải sách được chọn ngoài trang đầu | Nối dữ liệu công khai thật, trạng thái lỗi/rỗng rõ; tách DTO staff; sửa mode, cleanup widget và truy vấn sách theo ID. Trang login chỉ còn tài khoản nội bộ, bỏ UI đăng nhập khách giả. |
| Phiên/dữ liệu | Phản hồi reservation cũ có thể về sau khi đổi phiên/mode | Xóa dữ liệu staff và dialog khi clear; kiểm tra version trước khi áp phản hồi và lỗi của bàn giao/hủy. Redirect landing dùng `/me`; vẫn phải qua quyền API hiện hành. |
| Workers | Pool PostgreSQL toàn cục giữ socket của request trước, làm request danh mục tiếp theo bị runtime hủy | Pool theo scope từng request/scheduled event, đóng trong finally. Đã tái hiện trên `wrangler dev --local`; các lượt readiness/danh mục liên tiếp sau sửa không còn treo. |
| Export cũ | Có hàm consume DB nhưng router vẫn dùng RAM; người không có quyền có thể đốt vé; RAM fallback bỏ qua khóa ký mới | Router dùng consume DB nguyên tử sau kiểm tra quyền; DB lỗi không fallback RAM. Bỏ fallback khi chữ ký vé sai. Hai store và hai kết nối PG chỉ tiêu thụ được một lần; có test đổi signing key. |
| Lịch trực | ID phân công ghép schedule + UUID thành viên dài hơn VARCHAR(50) | Sinh ID ngắn bằng randomUUID, giữ unique(schedule, member). Có regression manual assignment dùng thành viên UUID thật. |
| Restore cũ | Guard chỉ tìm chuỗi test/localhost trong URL; không chặn target có dữ liệu; query cột ledger không tồn tại, PowerShell có thể vẫn báo thành công | Kiểm tra host + tên DB disposable + cấm query override; preflight target sạch; kiểm tra đúng amount/debit_account/credit_account và fail-closed. Hai script restore đã chạy bằng psql thật trên DB tạm. |

Các fixture integration cũ cũng được sửa: tách dữ liệu giữa các test, cung cấp phiên tiền và xác nhận thanh toán đúng hợp đồng, dùng đúng copy price/source UUID, giữ responseId cố định khi thử trùng. Không bỏ guard DB hay nới xác nhận nghiệp vụ để làm xanh test.

## Bằng chứng kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `pnpm run test:unit` | 325/325, 16 suites, không skip |
| `pnpm run test:db` | 61/61, không skip; PostgreSQL 16 container riêng, localhost:55439, DB `ysbk_test_review` |
| `pnpm run check` | Astro + TypeScript: 0 errors, 0 warnings, 0 hints |
| `pnpm run build` | Thành công, 10 trang tĩnh |
| Python PoC | 23/23; đây là simulation, không thay bằng chứng PG |
| Redocly OpenAPI | Hợp lệ, 0 errors, 39 warnings có sẵn |
| Workers local HTTP | `/health` 200; danh mục/ca trực 200 qua nhiều request; staff anonymous 401. Cron local chuyển HELD quá hạn thành EXPIRED trên PG thật. Readiness báo DB connected, Auth disconnected (503) đúng cấu hình thiếu provider |
| Backup/restore | `backup.sh`, `restore.sh`, `restore.ps1` dùng native PostgreSQL clients trong container; PowerShell forward CLI sang container. Hai target sạch có 65 bảng, khớp fingerprint dữ liệu 8 bảng lõi. Cả hai chặn target có dữ liệu và 6 ca URL không an toàn |

Node test runner và esbuild bị sandbox Windows chặn spawn ở lượt đầu; đã chạy lại với quyền tạo tiến trình con và ghi nhận kết quả thực. Không sửa dependency/config để che lỗi môi trường.

## Đối chiếu kế hoạch và cổng còn mở

- PR-0…PR-8 có source, hợp đồng, migration và kiểm tra tự động; các regression PG mới tập trung vào hạn mức, replay, tranh copy, nhận–trả, bảo vệ copy và export.
- PR-9 **PARTIAL**: không coi 49 nhãn test reservation là 49 ca thiết kế đã nghiệm thu đầy đủ. Các test có tên giống ID cũ phải đối chiếu nội dung; kết quả Node/PG không chứng minh tương tác trình duyệt hay provider thật.
- Browser E2E **BLOCKED**: Work settings tắt browser use. Không dùng công cụ khác để vượt cài đặt này. Cần UAT form, widget CAPTCHA, phiên thành viên, mobile và các thao tác quầy trên trình duyệt được cấp quyền.
- Supabase Auth, Turnstile với domain/key thật, Workers cloud, routing frontend → backend production: **chưa nghiệm thu**. Chưa deploy, chưa chạy migration/restore trên DB thật, chưa tác động tiền thật.
- Converter XLSX/PDF nhị phân vẫn trả 501 như hợp đồng hiện tại. CSV/XML Excel/HTML là các định dạng đã có; không gọi chúng là XLSX/PDF thật.
- Không có OTP theo quyết định sản phẩm: CAPTCHA không chứng minh người đặt sở hữu SĐT. Các nghĩa vụ mất sách chưa có chính sách hoàn tất cụ thể tiếp tục giữ suất; không giả `returned_at` để mở hạn mức.
- Giữ `RESERVATION_IP_SECRET` ổn định. Chưa có cơ chế chuyển khóa HMAC nhiều phiên bản; đổi khóa ngay có thể làm sai cửa sổ IP và không khôi phục token replay cũ. Không thực hiện xoay khóa trong đợt này.

## Phát hành source

Repo remote ban đầu chỉ có README. Lịch sử remote được giữ làm gốc; commit nhập source hiện có và các sửa lỗi đã kiểm tra. `.env`, `.dev.vars`, backup, node_modules, build, screenshot và review artifacts không đưa vào Git. SHA commit và kết quả push được xác nhận từ Git ở cuối tác vụ.

`git diff --cached --check` trên lần nhập toàn dự án còn báo khoảng trắng cuối dòng/dòng trống EOF từ source và tài liệu sẵn có. Không format hàng loạt nội dung ngoài sửa lỗi; đây không phải kết quả kiểm tra sạch whitespace. Đã quét chữ ký credential và ký tự thay thế UTF-8 trước commit.
