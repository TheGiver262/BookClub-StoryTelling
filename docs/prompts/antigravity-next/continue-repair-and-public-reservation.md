# Antigravity - Tiếp tục sửa lỗi hậu chặng 22 và triển khai đặt sách công khai

## Cảnh báo tiếp tục theo trạng thái 21/10/2026

Prompt bên dưới thuộc đợt giữ chỗ trước. Đọc [session handoff](../../SESSION-HANDOFF.md) và [trạng thái hiện hành](../../CURRENT-STATE.md) trước khi thực thi; không làm lại chức năng đã có hoặc coi các đề xuất UX chưa chốt là yêu cầu mới. Kế hoạch UI mới ở `docs/superpowers/plans/2026-10-21-ysbk-soft-ui.md`; giữ mọi thay đổi của người dùng/Antigravity và chưa commit/push/deploy.

Làm việc tại `F:\Codex Project\YSBK`. Người dùng yêu cầu lượt tiếp theo vừa giữ/sửa phần còn lỗi của implementation cũ, vừa cập nhật và thực hiện kế hoạch đặt sách mới. Hãy sửa implementation, caller, schema/migration và tests theo các bước dưới đây; không chỉ trả về kế hoạch khác. Làm tuần tự, có checkpoint rồi tự tiếp tục phần được phép, không chờ giao lại từng bước.

## 1. Đọc trước và xác định hiện trạng

Đọc AGENTS.md áp dụng, rồi lần lượt:

1. `docs/technical/public-reservation-design.md` - thiết kế mới đã chốt.
2. `docs/superpowers/plans/2026-10-20-public-reservation.md` - kế hoạch PR-0…PR-9, file map, hợp đồng, lệnh và 49 ca cần kiểm.
3. `docs/technical/post22-repair-handoff.md` - trạng thái sửa RF-01…RF-11, liên kết P22/S12 và gate chưa đóng.
4. `docs/prompts/antigravity-next/repair-post22-round2.md` - trigger/root cause/regression cũ; chỉ dùng phần còn phù hợp, không làm lại phần đã sửa đúng.
5. `docs/technical/transactions-finance.md`, `docs/technical/security-operations.md`, schema, OpenAPI và source/tests liên quan. `docs/technical/progress.md` có thể chứa claim cũ; xác minh bằng hiện trạng.

Kiểm file review/artifact trước khi dùng. File rỗng không phải báo cáo đã xác minh; không tự tạo nội dung hoặc nói đã đọc findings từ file đó. Nguồn ưu tiên cho quy tắc đặt sách là thiết kế mới; source và test mới quyết định bug còn tái hiện hay đã sửa.

Ghi cwd, branch/HEAD/status nếu có Git, nếu không thì hash/danh sách tệp liên quan; không `git init`. Đọc lại trước sửa vì source có thể vừa được cập nhật. Bảo toàn chỉnh sửa người dùng và sửa đúng của lượt trước. Không chỉnh review/probe cũ để xanh, không thay test thật bằng assertion tìm chuỗi source.

## 2. Quy tắc sản phẩm đã chốt, không hỏi lại

- Khách vào landing xem giới thiệu CLB, hoạt động đã công bố, lịch trực và đặt sách. Không cần login/tài khoản/mật khẩu/OTP.
- Điền đầy đủ trường bắt buộc theo thiết kế, vượt CAPTCHA xác minh tại server. Ưu tiên Cloudflare Turnstile; chưa dùng OTP hoặc tự thêm SMS/email.
- Một đơn đúng 1 bản sách. Giữ đến hết buổi trực đã chọn; chưa nhận thì hết hạn, sách và suất SĐT được mở lại.
- Mỗi SĐT chuẩn hóa tối đa 3 sách đang giữ hoặc đã nhận nhưng chưa trả, cộng qua IP/ca/hồ sơ cùng số. Không tách hạn mức bằng đổi trình duyệt hoặc viết `+84` thay `0`.
- Mỗi IP tối đa 3 đơn tạo thành công trong 24 giờ trượt, cộng các SĐT; không reset lúc 0 giờ, không đếm riêng cặp IP/SĐT.
- Trả 1 quyển mở 1 suất SĐT. Hủy/hết hạn cũng mở suất SĐT nhưng không xóa lượt IP còn trong 24 giờ. IP đủ 3 lượt vẫn chặn dù vừa trả sách.
- Đặt chỗ chưa lập phiếu hoặc thu cọc. Thành viên trực đối chiếu tên/SĐT, xác nhận giao và cọc theo quy trình hiện có; ngày mượn bắt đầu khi giao. Nhận sách không mở suất.
- Khách không tự xác nhận trả. Trả sách vật lý được ghi nhận thành công mới mở suất; chờ hoàn cọc không đồng nghĩa sách chưa trả hoặc tiền đã hoàn.
- Đơn có các trạng thái đề xuất `HELD`, `BORROWED`, `RETURNED`, `CANCELLED`, `EXPIRED`; không fake `returned_at` cho carry-forward/lost.
- Tài khoản thành viên có phiên hợp lệ vào thẳng khu nội bộ. Chỉ mở chức năng đúng role; guest/cựu TV không tự nhận quyền giao/trả. Không tăng vô hạn tuổi thọ JWT.
- CAPTCHA không chứng minh sở hữu SĐT. Chấp nhận rủi ro chưa OTP, bảo vệ tra cứu bằng token riêng từng đơn, không công khai lịch sử bằng SĐT.

Giữ giới hạn 2 cuốn/phiếu và quy tắc cọc/phạt/hoàn/chuyển tiếp hiện có. Tối đa 3 suất/SĐT không có nghĩa sửa phiếu thành 3 cuốn. Bản đầu mỗi đơn khi nhận tạo phiếu 1 cuốn, không gộp phiếu hoặc thêm chính sách tiền ngoài yêu cầu.

## 3. Thực thi theo thứ tự

### A. Kiểm chứng và sửa tiếp lỗi cũ - PR-0

Handoff mới báo RF-01…RF-11 đã sửa ở mức source/unit, không mặc định chúng vẫn OPEN và cũng không mặc định đã nghiệm thu runtime. Chạy regression trong plan, đối chiếu claim với code; chỉ sửa gốc phần còn tái hiện, thêm test trước sửa.

Ưu tiên các đường liên quan feature mới: route exact match, envelope/metadata, schema thật, payment confirmation, idempotency/refresh recovery, phân trang hơn 100 copies, DEMO/stale response, public DB lỗi không fallback mock.

Kiểm riêng RF-11: `BoundedAtomicTicketStore` hiện dùng `Map` cục bộ. Chứng minh single-use qua hai store/instance và sau restart trước khi đóng phần đa Worker; nếu tái hiện, sửa bằng atomic storage bền phù hợp stack, không dùng mutex trong tiến trình làm bằng chứng phân tán. Giữ CSV/XML_EXCEL/HTML trung thực; converter XLSX/PDF thật còn thiếu thì giữ gate riêng, không giả tên đuôi hoặc làm lệch phạm vi đặt sách.

Giữ ID/mức độ P22/S12/RF gốc. Cập nhật handoff bằng command/case/result mới; không chép số test cũ hoặc đổi nhãn để đóng finding.

### B. Contract/schema và lõi đặt chỗ - PR-1…PR-3

- Chốt và ghi interface/DTO/schema/route theo plan. Tận dụng helpers có sẵn; không tạo service/pool/auth/idempotency song song để tránh sửa caller.
- Migration tiến tới, có preflight dữ liệu cũ, chỉ apply qua harness disposable. Không ghi đè số migration nếu đã được dùng.
- Tồn giữ chỗ và hai quota phải nguyên tử qua nhiều request/instance. Khóa cả namespace quota mới chưa có hàng, đọc lại điều kiện sau lock; không `COUNT` rồi `INSERT` thiếu bảo vệ.
- Dùng cùng chuẩn SĐT, khóa IP lấy từ nguồn tin cậy và HMAC có version; không bộ đếm RAM/cookie hoặc IP client khai báo.
- Nối anonymous routes, adapter→router tests, CAPTCHA server-side fail-closed; đúng khóa/payload replay trả cùng đơn mà không tiêu thụ token CAPTCHA lần hai. Token tra đơn không được thành actor nội bộ hoặc lộ trong log/cache.
- Chạy unit và PG concurrent đúng lớp theo plan. Thiếu PG/provider giữ gate BLOCKED, tiếp tục code/test độc lập; không gọi mock là PG/provider thật.

### C. Giao/trả, hết hạn và quầy - PR-4…PR-5

- Bàn giao đơn sang dòng phiếu mượn trong cùng transaction, không mở tạm suất hoặc double-count. Dùng lại xác nhận cọc/journal/audit/idempotency và thứ tự khóa hiện có đã đối chiếu.
- Trả đúng bản mở đúng suất sau commit. Mượn thủ công, đổi tình trạng copy, thay SĐT borrower, gia hạn và chuyển tiếp không được đi vòng guard.
- Lost/mơ hồ chưa có bằng chứng chấm dứt nghĩa vụ thì giữ suất, báo cần xử lý nội bộ; không tự đặt mức phạt hoặc chính sách xóa nghĩa vụ.
- Hết hạn theo `expires_at`, batch hữu hạn, chạy lại an toàn; đường đọc tồn/giao/đặt vẫn đúng khi scheduled task trễ. Không dùng thời điểm đóng két để hết hạn.
- Hủy/sửa ca không âm thầm thay lịch khách. Không gửi thông báo thật hoặc tạo cron cloud; chỉ code/config local trong repo và bằng chứng handler test.

### D. Landing, tra đơn và phiên nội bộ - PR-6…PR-7

- Nối dữ liệu public thật cho sách khả dụng, ca và hoạt động đã công bố; lỗi tải hiện lỗi/retry, không đổi sang mock.
- Form đúng 1 quyển/đơn, CAPTCHA, xác nhận giờ/địa điểm/cọc, retry/reload recovery. Token từng đơn bảo vệ trang tra/hủy; không tra mọi đơn bằng SĐT.
- Giữ theme hiện có, keyboard/focus/label và mobile; không viết lại toàn app hoặc thêm UI kit.
- Quầy có danh sách chờ nhận theo ca, tìm tên/SĐT/mã, phân trang, giao/hủy có quyền. DEMO và request cũ sau logout/đổi actor không ghi hoặc phục hồi dữ liệu nhạy cảm.
- Phiên hợp lệ vào thẳng nội bộ, có lối xem landing không tạo redirect loop. Guest login phục vụ chức năng khác không mở nội bộ; không tự gỡ auth gửi review.

### E. Kiểm thử cuối, sửa failure và bàn giao - PR-8…PR-9

Thực hiện đủ bảng 49 ca PUB/LIM/LIFE/CON/SEC trong thiết kế và ma trận plan. Mỗi ca ghi test hoặc thao tác browser, môi trường và kết quả. Sửa mọi failure do lượt thay đổi gây ra, chạy regression liên quan rồi mới kết luận.

Chạy bộ check/build/unit/Python/OpenAPI và DB theo lệnh trong plan. Trước test có reset schema phải chạy `validateTestDatabaseUrl`; DB chỉ local/test, tên `ysbk_test_*`, dữ liệu tổng hợp. Concurrency mở ít nhất hai connection độc lập; không dùng SQLite/mutex hoặc mock SQL thay PG.

Browser phải kiểm URL thực và mutation API/DB: desktop 1366×768, mobile 390×844; luồng đặt-nhận-trả-đặt lại, đủ quota IP dù vừa trả, hết ca, reload, token sai, session hết hạn, phân quyền. Browser bị tắt thì ghi gate BLOCKED, không bypass cấu hình.

Workers/provider/restore/converter là các gate riêng. Local Node handler không thay Workers, ảnh không thay UI flow, unit không thay DB, build không chứng minh đã deploy. Không đợi thêm chỉ dẫn để sửa lỗi local còn thuộc scope hoặc làm phần độc lập.

## 4. Quyền và giới hạn bắt buộc

Không subagent, git init/commit/push/deploy, tạo cloud resource, sửa global config/security settings, đọc/in secret thật, gửi email/SMS/thông báo, dùng PII/tiền thật hoặc kết nối DB sản xuất. Không bypass sandbox, DB guard, auth/constraints, browser settings hoặc automatic approval rejection.

Có thể sửa local source/test/docs/config trong scope, chạy local server và DB disposable với guard. Không dừng hoặc ghi đè server/DB đang có mà chưa xác minh quyền sở hữu. Không mở rộng sang production chỉ vì tài liệu cũ có lệnh deploy.

Khi một gate môi trường chặn, ghi BLOCKED với lỗi ngắn và bước cần thiết, tiếp tục các phần không phụ thuộc. Chỉ hỏi khi thiếu thông tin/chính sách thực sự chặn tiền/quyền/dữ liệu, không hỏi lại những quyết định mục 2.

## 5. Handoff sau mỗi checkpoint và cuối lượt

Tạo/cập nhật `docs/technical/public-reservation-handoff.md` cho PR-0…PR-9; cập nhật phần tương ứng ở `docs/technical/post22-repair-handoff.md` và `docs/technical/progress.md`. Không viết lại lịch sử hoặc nâng trạng thái cổng chưa chạy.

Mỗi checkpoint cần có:

- Mục tiêu, trạng thái PASS/PARTIAL/BLOCKED theo đúng phạm vi bằng chứng.
- Tệp và hợp đồng đã thay; source revision/hash, môi trường, command, exit/result thực.
- Finding RF/P22/S12 giữ được sửa đúng, còn tái hiện hoặc đã sửa lại; trigger, root cause, fix và regression.
- Case PUB/LIM/LIFE/CON/SEC đã chạy; phần source/DB/Worker/browser/provider/restore/converter còn mở.
- Việc kế tiếp cụ thể; tiếp tục phần độc lập trong lượt thực thi, không dừng sớm vì đã viết checklist.

Kết quả cuối phải nói rõ đã làm gì, đã kiểm được gì, gate nào chưa đủ bằng chứng và bước tiếp. Không tuyên bố hoàn tất production hoặc cả 22 chặng chỉ vì unit/build xanh.
