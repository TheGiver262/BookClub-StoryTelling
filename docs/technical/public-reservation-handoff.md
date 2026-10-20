# Bàn giao đặt sách công khai — 20/10/2026

Bản này thay thế các tuyên bố nghiệm thu trong snapshot Antigravity trước khi review. Thiết kế gốc: [public-reservation-design.md](public-reservation-design.md). Kế hoạch: [PR-0…PR-9](../superpowers/plans/2026-10-20-public-reservation.md). Chi tiết lỗi và bằng chứng: [review cuối](../reviews/2026-10-20-public-reservation-final-repair.md).

## Quy tắc đã triển khai

- Khách đặt một bản sách/đơn, không đăng nhập/OTP; CAPTCHA kiểm tra phía server.
- Mỗi IP tối đa 3 đơn tạo thành công trong 24 giờ trượt. Hủy, hết hạn hoặc trả sách không hoàn lượt IP.
- Mỗi SĐT tối đa 3 suất gồm HELD còn hiệu lực và bản sách chưa trả, kể cả mượn tại quầy. Trả một bản mở một suất SĐT.
- Đơn HELD giữ tới hết giờ phục vụ của ca đã chọn, theo UTC+7. Scheduler hết hạn theo lô; truy vấn tồn/hạn mức không chờ scheduler mới loại hold đã quá hạn.
- Bàn giao đúng ca, đúng tên/SĐT; dùng memberId nội bộ, xác nhận cọc boolean true; tạo phiếu một bản, journal/audit và cập nhật đơn trong một transaction. Retry cùng intent trả cùng phiếu.
- Tra cứu/hủy bằng token riêng từng đơn, không có tra lịch sử công khai theo SĐT. DTO công khai không có tên, SĐT, barcode nội bộ.
- Landing lấy dữ liệu API thật; đăng nhập dành cho tài khoản nội bộ. Phiên hợp lệ được kiểm tra bằng /me; quyền API vẫn kiểm tra trạng thái thành viên hiện hành.

## Kiểm tra đã chạy

| Cổng | Kết quả ngày 20/10/2026 |
|---|---|
| Node unit | 325/325, 16 suites, 0 fail/skip |
| PostgreSQL integration | 61/61, 0 fail/skip; PostgreSQL 16 riêng, không dùng DB thật |
| Astro/TypeScript | 0 errors, 0 warnings, 0 hints |
| Astro build | Thành công, 10 trang tĩnh |
| Python PoC | 23/23; bằng chứng simulation |
| OpenAPI | Hợp lệ, 0 errors; còn 39 warnings của tài liệu hiện hữu |
| Workers local | HTTP health/danh mục/ca trực chạy; socket PG tách từng request; anonymous staff bị chặn 401; cron chuyển HELD quá hạn thành EXPIRED trên PG thật |
| Readiness local | DB connected; Auth disconnected, HTTP 503 do chưa có cấu hình provider thật |
| Restore drill | Linux và PowerShell với psql thật, 65 bảng; fingerprint dữ liệu khớp ở 8 bảng lõi; chặn target có dữ liệu và URL không an toàn |

Các test mới quan trọng nằm ở `tests/integration/reservation-flow.test.ts`, `tests/integration/roster.test.ts`, `tests/unit/reservation-repair.test.ts`. Không suy ra đã nghiệm thu đủ 49 ca thiết kế từ tổng số test hoặc nhãn ID.

## Cấu hình và nâng cấp

1. Cài dependency theo `pnpm-lock.yaml`; xem `.env.example`. Astro dùng PUBLIC_TURNSTILE_SITE_KEY khi build. Workers local đọc `.dev.vars`, tệp này bị gitignore.
2. Cấu hình DATABASE_URL, Supabase Auth và JWT_SECRET; dùng RESERVATION_IP_SECRET riêng, ngẫu nhiên ít nhất 32 ký tự. Cấu hình TURNSTILE_SECRET_KEY và TURNSTILE_EXPECTED_HOSTNAME; action widget là `reservation`. Các key Turnstile trong tệp mẫu chỉ dành cho thử nghiệm.
3. Với DB mới, áp dụng baseline, seed thử nghiệm và chuỗi migrations theo môi trường. Với DB hiện hữu, backup và kiểm tra schema trước migration 14–15. Migration 15 không tự xóa bản ghi trùng hoặc sửa UUID legacy sai; gặp dữ liệu không hợp lệ phải xử lý có đối soát.
4. Không chạy seed mẫu hoặc harness reset trên DB thật. Harness chỉ cho phép host local và tên `ysbk_test_*`. Script restore mặc định đòi target disposable sạch.
5. Chạy backend `pnpm run server:dev` và frontend `pnpm run dev`; proxy frontend local mặc định trỏ backend :8787. Production cần routing /api riêng trước khi đưa vào dùng.
6. Duy trì cron hết hạn 10 phút/lần. Hạn mức và tồn vẫn loại hold quá hạn khi cron trễ; bảng quản lý sẽ đồng bộ trạng thái khi cron chạy.

## Cổng còn mở

PR-9 còn PARTIAL. Browser use bị tắt trong Work settings, nên chưa UAT giao diện/widget/mobile và session qua provider thật. Chưa nghiệm thu Supabase/Turnstile domain thật hoặc Workers cloud; chưa deploy hay chạy migration trên production.

Converter XLSX/PDF nhị phân hiện trả 501. Không thay thành công giả. Chính sách hoàn tất mất sách chưa được chốt; các bản chưa trả vẫn giữ suất. Không xoay RESERVATION_IP_SECRET khi chưa có phương án bảo toàn cửa sổ IP và token replay.

Người dùng đã cho phép commit/push source lên GitHub YSBK trong yêu cầu hiện tại. Quyền này không bao gồm production deploy, restore dữ liệu thật hoặc chuyển tiền. Không đưa secret, DB dump hay artifacts kiểm thử vào repo.
