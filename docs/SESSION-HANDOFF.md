# YSBK — Session handoff ngày 22/10/2026

**Cập nhật ưu tiên — 22/10/2026, nhập sách/duyệt/vai trò:** đọc [CURRENT-STATE](CURRENT-STATE.md) và [hướng dẫn mới](technical/catalog-import-and-moderation.md) trước các mục lịch sử bên dưới. Đã thêm CatalogManager, parser XLSX, migration 23/24, hàng chờ duyệt có version/transaction; Quản lý và ADMIN duyệt/công khai. Cựu bị khóa/thu hồi phiên, giữ lịch sử; không còn role/UI hoạt động. Đặt 1–3 bản tùy tồn/quota, mỗi bản một mã; bỏ UI token bí mật và sửa idempotency để đặt cùng đầu sách lần sau tạo đơn mới.

Đã backup rồi nhập file Excel người dùng: 794 bản → 743 nhóm; batch gốc còn 733 nhóm/777 bản nháp, 10 nhóm/17 bản công khai. Có 10 review CLB APPROVED, catalog public 14 đầu gồm 4 đầu local cũ. Browser đã xác nhận review, upload/chặn nhập trùng, tạo bản sửa Nhà giả kim → lưu → gửi duyệt → công khai; API giữ nội dung cũ trước duyệt, trả nội dung mới sau duyệt. Bản sửa này thêm một hồ sơ PUBLISHED ngoài batch, không nhân bản sách/copy.

Kiểm chứng: 399 unit; 40 PostgreSQL liên quan đã đạt (gồm hồi quy sửa metadata khi có đơn giữ chỗ, vẫn chặn thay giá); check 193 files không lỗi/cảnh báo, có 1 hint isLink không dùng trong book.mjs do thay đổi landing đồng thời; beta build 6 trang. Chưa browser kéo thả ảnh/đặt số lượng bằng Google thật; không reset DB chính, không commit/push/deploy. Giữ toàn bộ thay đổi landing/âm thanh đồng thời của người dùng/Antigravity; không đưa chúng vào phạm vi thay đổi nhập sách.


**Google local — cập nhật mới nhất:** đã chuyển OAuth credential vào `.local/ysbk/google-oauth-client.json` và bật Google trong Auth Docker local. Quyết định trực tiếp: không bao giờ commit/push credential hoặc bản sao; Git bỏ qua `.local/`, `client_secret*.json`, `google-oauth-client*.json`. Không ghi secret vào source, frontend hoặc handoff. HTTP đã xác nhận enabled, chuyển hướng đến Google và callback local đúng; chưa đăng nhập Google thật/hai trình duyệt, chưa cấu hình cloud. Xem [hướng dẫn](technical/reader-accounts-local-and-access.md).

**Scrollbar — cập nhật sau phản hồi vẫn còn dải trắng:** landing hiện ẩn hẳn scrollbar native bằng scrollbar-width:none và WebKit display:none/width:0, chỉ trên html.book-landing-page; vẫn dùng window scrolling, không đặt overflow:hidden hay đổi scroll container. Giữ wheel/touch/phím và nút lật sách. Đã bỏ cách tô ảnh vào root gutter cùng các biến/observer phụ vì không giải quyết được phản hồi thực tế. Nền ngoài vẫn giữ offset 18px. 17 test landing đạt, beta build 6 trang và CSS runtime xác nhận rule ẩn; Browser Use vẫn disabled, chưa có screenshot. Cập nhật này thay thế cách tô gutter được mô tả ở đoạn ngay dưới.

**Cập nhật mới nhất — landing F5 / scrollbar / chân trời (22/10/2026):**
- `index.astro` chạy inline head để đặt history.scrollRestoration=manual và scroll top trước body. Bỏ body no-js và quy tắc ẩn scroll-track trong CSS thường; chỉ ẩn khi JavaScript bị tắt bằng style is:inline nằm trong noscript (không để Astro hoist ra stylesheet). Bìa tĩnh/độ dài track có ngay trước khi module tải; hướng dẫn vẫn sau toàn bộ track và stage giữ sticky.
- Thanh cuộn giữ track transparent, bỏ viền sáng của thumb; root được vẽ cùng ảnh và projection với stage để gutter không lộ màu nền đặc. Một lớp màu hướng dẫn bắt đầu sau chiều cao track thực, cập nhật qua ResizeObserver. Đây là nền cho scrollbar native, không thêm scrollbar giả hoặc dùng overflow:overlay. Cơ sở: [CSS Overflow 3, scrollbars and layout](https://www.w3.org/TR/css-overflow-3/#scrollbars).
- Theo yêu cầu hạ nền ngoài thêm 18px bằng --backdrop-trim, áp dụng chung cảnh và phần gutter. Không đổi ảnh bìa, nội dung hay markup BookLanding. Chưa thêm animation phần hướng dẫn vì lượt này sửa ba lỗi cụ thể.
- Regression startup/gutter từng fail trước sửa, sau sửa 17 test landing liên quan đạt; toàn unit 388/388, beta build 6 trang. HTML/CSS/script local đã xác nhận chính sách head, noscript còn có điều kiện, không ẩn track trong stylesheet thường và có offset 18px. Browser Use vẫn disabled: chưa có cold-reload/PC/mobile screenshot, chưa chốt khớp từng pixel bằng mắt. Log .review-artifacts/landing-startup-fix-unit.log, manifest cùng prefix. Không commit/push/deploy hay thay DB.

**Cập nhật mới nhất — Codex sửa lookup mở modal (22/10/2026):**
- Đã xử lý P2/P3 trong `docs/reviews/2026-10-22-antigravity-generation-followup.md`. `PublicPortal.tsx` dùng `bookLookupRef` riêng để chỉ lookup hiện hành được mở modal/ghi lỗi; Back/Forward, mở/đóng modal, đổi tab (kể cả tab yêu cầu đăng nhập) và cleanup đều vô hiệu hóa lookup cũ. Counter review độc lập để cleanup review không hủy lookup hợp lệ.
- Đã bỏ fallback `globalThis.reviewSessionRef`; harness cũ được cấp ref đúng. Thêm `tests/unit/reader-navigation-race.test.ts`, đăng ký trong `test:unit`.
- TDD: trước sửa 6/7 test mới thất bại đúng lỗi; sau sửa 13/13 test mới+cũ liên quan đạt. Toàn unit 387/387 đạt, check 183 file không lỗi/cảnh báo/hint, beta build 6 trang đạt; local `/sach/` phục vụ bundle khớp build mới.
- Không sửa JSX của PublicPortal hoặc các file landing trong lượt này; giữ chỉnh sửa thanh cuộn có sẵn/đồng thời trong workspace. Không commit/push/deploy hoặc thay DB. Browser Use vẫn trả disabled; source/promise tests và kiểm tra bundle chưa thay thế browser proof. Không chạy lại PostgreSQL vì không đổi service/API/schema.

## 1. Bắt đầu chat mới từ đây

**Cập nhật lượt sửa UI-01 & UI-02 (22/10/2026):**
- **UI-01**: Sửa phân trang tải review trong `src/components/PublicPortal.tsx`. Tách hàm `moreBookReviews()` theo mẫu `morePublicReviews()`, chỉ chốt `reviewPage` khi request thành công. Khi trang 2 lỗi mạng, lần bấm sau thử lại đúng trang 2 thay vì nhảy cóc lên trang 3, bảo toàn review 51..100. Dùng `panelRef` và `focusedBookRef` để hủy an toàn nếu người dùng đóng modal hoặc đổi sang sách khác trong lúc request đang bay.
- **UI-02**: Sửa race condition tải ảnh trong `src/components/PublishingManager.tsx`. Bổ sung generation counter `imageTaskIdRef` và context tracking `contextRef` (`books:id` vs `recruitment`). Khi chuyển tab hoặc đổi sách/thêm sách mới, task ID tăng để vô hiệu hóa ngay kết quả xử lý ảnh cũ; các nút điều hướng và chọn ảnh được disable khi busy; ảnh xử lý chậm/ngược thứ tự không ghi đè ảnh mới hay xóa nhầm cờ busy/lỗi.
- **Kiểm chứng**:
  - `pnpm run check`: 179 files, 0 errors, 0 warnings, 0 hints.
  - `pnpm run test:unit`: 376/376 tests pass (bao gồm 5 test hồi quy mới trong `tests/unit/ui-review-fixes.test.ts`).
  - Integration DB: 17/17 tests pass trên database `ysbk_test_local` (chạy tuần tự `--test-concurrency=1`).
  - `pnpm run build`: 12 trang sinh tĩnh thành công (4.75s).
- **Quy tắc tuân thủ**: Không commit, push, deploy; không dùng subagent; không reset database; bảo toàn dirty working tree.

**Lịch sử trước đó (21–22/10):** Tủ sách theo Stitch, bỏ tab đặt riêng, đặt bằng modal, bookmark theo tài khoản/ghim đầu Tất cả trước phân trang; người dùng bỏ thông báo và chọn dấu xanh rêu/đỏ đất nung theo tồn. Thẻ review riêng theo sách, chỉ chữ, PENDING cho tới ADMIN duyệt; review CLB ghim trước. Giữ hash landing/cuốn sách. Migration 22 đã áp dụng local sau backup; xem [thiết kế](technical/reader-library-design-2026-10-21.md). Các quyết định/UI sáu tab ở đoạn cũ không còn là luồng mới. Google/cloud vẫn chưa cấu hình. Browser tool báo disabled dù người dùng xác nhận không tắt; phải ghi đúng lỗi công cụ, không coi là người dùng từ chối nghiệm thu.

**Cập nhật chat tiếp nối 21/10:** đã review Antigravity rồi triển khai tài khoản bạn đọc bắt buộc, Google-only, phiên một trình duyệt tối đa 30 ngày; chọn subdomain nội bộ riêng + Cloudflare Access. Đọc [vận hành và bằng chứng mới](technical/reader-accounts-local-and-access.md) và [thiết kế](technical/reader-accounts-design-2026-10-21.md) trước các phần lịch sử bên dưới. Không còn áp dụng đề xuất tài khoản tùy chọn/khách đặt không login cho đơn mới. Đổi sách và thay hạn mức IP vẫn chưa duyệt.

Review gốc: [2026-10-21-antigravity-review.md](reviews/2026-10-21-antigravity-review.md). Đã xử lý đường demo khi tắt cấu hình trong phạm vi khóa lối vào; còn findings badge trùng và phiếu mobile thiếu trạng thái. Không tự coi toàn UI đã nghiệm thu.

Local DB đã backup rồi áp dụng migration 21 cộng thêm. Worker 4321 đã được khôi phục bằng Start-Process Hidden với đường dẫn config tuyệt đối sau khi xác minh PID/cây tiến trình cũ. Browser Use bị tắt trong Work settings ở bước xác minh cuối; chưa có browser proof cho UI mới. Chưa cấu hình Google OAuth thật/Cloudflare Access/tên miền hoặc deploy. Không có tài khoản reader giả trong DB thao tác.

Các mục 2–7 phía dưới lưu lịch sử bàn giao trước chat tiếp nối; nếu mâu thuẫn, dùng CURRENT-STATE và tài liệu mới.

Đọc tiếp theo thứ tự:

1. [Quyết định hiện hành](CURRENT-STATE.md): phân biệt đã chốt, đã có trong source và đề xuất.
2. [Nghiên cứu UX đặt sách](technical/public-reservation-ux-research-2026-10-21.md): Koha, LibCal, Acuity; nguồn chính thức và giới hạn suy luận.
3. [Thiết kế đặt sách](technical/public-reservation-design.md), [bàn giao triển khai](technical/public-reservation-handoff.md).
4. [Cổng công khai, quản lý nội dung, CTV](technical/public-portal-publishing.md).
5. [Bộ thiết kế Stitch](mockups/stitch-ui-2026-10-21/HANDOFF.md), [kế hoạch UI](superpowers/plans/2026-10-21-ysbk-soft-ui.md).

## 2. Repo, nhánh và phạm vi công việc

- Workspace: `F:\Codex Project\YSBK`.
- Kiểm tra ngay khi viết handoff: nhánh `main`, HEAD `b9d568b4c4ba9c8d390fef3bb80f7abce52b8abb`; chỉ một worktree tại workspace trên.
- Có nhiều thay đổi tracked và untracked của các đợt trước/Antigravity. Không reset, clean, stash, ghi đè hoặc gom commit toàn bộ.
- Lượt bàn giao này chỉ cập nhật tài liệu và gói tài liệu; không sửa source, schema, cấu hình hoặc dữ liệu. Không commit, push hay deploy.
- HEAD và working tree không đồng nghĩa với trạng thái GitHub. Chưa fetch/đối chiếu remote trong lượt này.
- Không dùng subagent nếu người dùng chưa cho phép trực tiếp trong yêu cầu hiện tại. Giao tiếp tiếng Việt; Caveman full/Ponytail; dùng RTK khi giữ đủ bằng chứng. Không ghi mật khẩu, cookie, token, chuỗi kết nối thật vào handoff.

## 3. Tóm tắt tiến trình hội thoại

1. Tách phần công khai và nội bộ: người ngoài xem landing, hoạt động, sách và đặt trước; thành viên đăng nhập bằng tài khoản được cấp, có session để vào nội bộ trực tiếp.
2. Chốt đặt giữ chỗ không đăng nhập, mỗi đơn một quyển, CAPTCHA/Turnstile, hạn nhận cuối buổi trực, hạn mức IP và SĐT riêng biệt. Review/sửa implementation đã có qua nhiều vòng; không dùng số liệu cũ để khẳng định mọi chức năng hiện tại đã nghiệm thu.
3. Chọn Supabase + Cloudflare gói miễn phí cho beta. Sau đó ưu tiên hoàn chỉnh local bằng Docker trước, beta cloud để sau. Quy mô dự kiến vài nghìn sách, khoảng 30 người nội bộ và 100 bạn đọc; tải mượn/trả chủ yếu thứ Ba/thứ Năm, cần đo thực tế.
4. Landing được phát triển từ mockup thành cuốn sách có bìa cứng, bìa phụ và 10 chương; ảnh thật, nội dung CLB, hiệu ứng cuộn/lật có điều khiển. Đã tích hợp local.
5. Gộp cổng công khai thành `/sach/` đủ sáu tab; bổ sung tóm tắt sách, upload/quản lý nội dung và vòng đời CTV một tháng, chỉ quản lý công nhận/xóa CTV. Thành viên rời CLB chuyển cựu.
6. Dùng Google Stitch tạo concept vintage mềm cho PC/mobile, giữ bảng màu. Đã xuất 14 mẫu, đặc tả, prompt Antigravity, kế hoạch và ZIP. Workspace hiện còn có UI implementation và ảnh QA xuất hiện sau mốc xuất concept; chưa review toàn bộ diff mới trong lượt này.
7. Người dùng hỏi khách hủy/đặt nhầm và tài khoản bạn đọc. Đối chiếu source thấy hủy bằng token riêng đã có, chỉ khi `HELD`; chưa tìm thấy luồng đổi sách nguyên tử trong phần đã đọc.
8. Theo yêu cầu tra cứu mạng, đã nghiên cứu tài liệu chính thức: Koha quản lý sách qua tài khoản; LibCal dùng liên kết hủy trong email; Acuity cho đặt khách kèm tài khoản tùy chọn. Đề xuất trang “Sách của tôi”, tài khoản tùy chọn, đổi sách và xem lại IP; **chưa có quyết định triển khai**.

## 4. Các quyết định sản phẩm đang có hiệu lực

### Công khai, giữ chỗ và hạn mức

- Khách đặt không cần đăng nhập; chưa OTP; CAPTCHA/Turnstile kiểm tra server.
- Mỗi đơn đúng một bản sách vật lý, gắn một buổi trực. Đây là giữ chỗ, chưa phải giao sách.
- Giữ tới hết buổi trực đã chọn; không đến thì hết hạn, mở lại khả dụng. Nhận tại bàn sau kiểm tra họ tên/SĐT và xác nhận nghiệp vụ.
- IP tối đa ba đơn tạo thành công trong 24 giờ trượt, cộng mọi SĐT cùng IP. Hủy/hết hạn/trả không hoàn lượt IP trong cửa sổ đó.
- SĐT tối đa ba suất gồm giữ còn hiệu lực và đã nhận chưa trả, cộng các IP/kênh. Trả một quyển mở một suất SĐT nhưng vẫn phải còn lượt IP để tạo mới.
- Tự xem/hủy đơn bằng quyền từ liên kết/token bí mật; không dùng SĐT hoặc mã đơn công khai để cấp quyền. Không lộ token trong log/query/analytics.
- Danh mục 50 đầu sách/trang, lọc/tìm kiếm, hiện cả sách hết bản nhưng không cho giữ. Refresh hiện có 30 giây thứ Ba/Năm, 60 giây ngày khác, khi quay lại và sau thay đổi; server quyết định tồn khi đặt.
- Bản đã giữ không thể giao: cảnh báo nội bộ kèm thông tin cần liên hệ, thành viên gọi và xử lý thủ công. Chưa tự gửi email/SMS hoặc tự hủy vì sự cố.
- Không đưa thuật ngữ IP/hạn mức kỹ thuật ra mô tả công khai. Vẫn cần thông báo lỗi dễ hiểu và đường liên hệ; backend giữ guard.

### Nội dung và nhân sự

- `/sach/` là một cổng chung: Tra cứu sách, Đặt giữ chỗ, Tra cứu đơn, Lịch trực & sự kiện, Góc review, Tuyển thành viên.
- Chỉ `ADMIN` quản lý xuất bản sách/ảnh/tóm tắt, lịch trực/nghỉ, sự kiện công khai và thông tin tuyển. Không mở quyền upload nội dung cho toàn bộ thành viên/CTV.
- CTV thử thách một tháng lịch, quyền nghiệp vụ như `MEMBER` với cờ nhân sự riêng. Không tự công nhận sau hết tháng: quản lý phải đánh giá đạt.
- Chỉ quản lý xóa CTV, xóa mềm/thu hồi phiên/giữ lịch sử. Thành viên chính thức rời CLB chuyển `ALUMNI`; quyền cựu chỉ hoạt động an toàn, không PII/tài chính/xuất dữ liệu.
- Quy tắc tài chính và chứng từ đã chốt tiếp tục áp dụng; đặt trước một quyển/đơn không thay giới hạn tối đa hai quyển/phiếu mượn tại quầy.

### Nhận diện và giao diện

- Tên: **Câu lạc bộ Yêu Sách Bách Khoa Hà Nội**. Slogan: **Mở sách, đọc tương lai**. Thành lập **16/09/2013**.
- Bìa cứng có độ dày/nhô; bìa phụ trái trắng, phải cùng thiết kế nhưng nhạt trên giấy; bỏ dòng địa danh/ngày dưới cả hai bìa, tách hai logo HUST/Hội Sinh viên.
- Nội dung: giới thiệu → con người → hoạt động tổng quan → từng hoạt động → slogan/tranh kết. Ảnh người dùng đã gửi; bỏ tặng giáo trình, thay giao lưu CLB bằng Ngày Sách Việt Nam. Không lấy ảnh bất kỳ gán sai sự kiện.
- Chốt màu xanh rêu, đất nung, giấy kem; logo SVG gốc nét/transparent. Stitch “Thư viện ký ức — góc bo mềm”: control 14px, card 22px, modal 24px, bóng nhẹ, không quá vuông.
- Newsreader cho heading/Be Vietnam Pro cho UI; Dancing Script trên bìa/kết giữ dấu Việt. Typography thực tế trong source cần đối chiếu khi review implementation.
- Áp dụng nhận diện cả công khai và nội bộ, PC/mobile. Không thay landing cuốn sách đã duyệt bằng landing mẫu Stitch.

## 5. Trạng thái hiện vật và kiểm chứng

| Hạng mục | Bằng chứng hiện có | Giới hạn |
|---|---|---|
| Local runtime | Lượt handoff: `/health/ready` HTTP 200, database/Auth provider connected; landing 4321 HTTP 200 | Không phải toàn bộ UAT nghiệp vụ hoặc kiểm tra source đang chạy khớp diff |
| Concept | Preview `http://127.0.0.1:4323/` HTTP 200; 14 mẫu và manifest | HTML mẫu không chứng minh chức năng thật |
| Giữ chỗ/landing/publishing/CTV | Tài liệu đợt trước ghi 353 unit, check 0/0/0, 7 test PG nội dung/CTV và 12 test hồi quy giữ chỗ; các log được dẫn trong tài liệu | Số liệu theo từng lần chạy, chưa chạy lại suite trong lượt handoff |
| UI sau bộ concept | Có `src/styles/ui.css`, được import từ `global.css`; thay đổi theme/component và thư mục `docs/mockups/qa-evidence-2026-10-21/` | Chỉ xác nhận hiện vật/source; chưa đọc hết diff, chưa xác nhận mọi ảnh gắn đúng SHA hoặc đủ nghiệm thu |
| Browser | Trước đây có bằng chứng local; lần công cụ gần nhất bị Work settings chặn, mở panel trả queued | Phải thử lại ở chat mới, không mặc định quyền vẫn bị chặn hoặc đã mở |
| Cloud beta | Có cấu hình và hướng dẫn | Chưa deploy/nghiệm thu provider thật, Turnstile thật, tải đồng thời hay thiết bị thật |

Không nâng các kết quả unit/source thành chứng minh DB/cloud/concurrency. Báo cáo cũ 18–20/10 và progress theo chặng được giữ làm lịch sử, không là trạng thái hiện tại của mọi gate.

## 6. Vấn đề mở cho chat sau

**Nên bắt đầu bằng trải nghiệm tìm lại đơn, chưa bằng chọn nhà cung cấp tài khoản.**

1. “Sách của tôi” dành cho khách trên cùng trình duyệt có đủ hay cần tài khoản bạn đọc tùy chọn ngay beta?
2. Nếu vẫn không email/SMS/OTP, có chấp nhận hỗ trợ thủ công khi mất liên kết/quên mật khẩu không? Không hứa đồng bộ hoặc khôi phục tự động khi chưa có kênh chứng minh quyền.
3. Có thêm “Đổi sách” khi chờ nhận không? Đề xuất giữ bản mới/nhả bản cũ nguyên tử, thất bại giữ đơn cũ, không reset thời hạn hoặc lượt IP, có audit/chống đổi liên tục.
4. Có xem lại ba đơn/IP/24 giờ vì nhiều bạn đọc dùng chung mạng không? Đây mới là đề xuất; chưa chọn ngưỡng mới hoặc sửa guard.
5. Nếu mở tài khoản, chốt cách gắn đơn khách vào tài khoản bằng bằng chứng hợp lệ; không nhận toàn bộ lịch sử chỉ dựa trên SĐT tự khai. Tách tuyệt đối khỏi tài khoản/quyền nội bộ.

## 7. Mẫu lời mở đầu chat mới

> Tiếp tục dự án YSBK tại `F:\Codex Project\YSBK`. Đọc `docs/SESSION-HANDOFF.md`, `docs/CURRENT-STATE.md` và tài liệu nghiên cứu UX đặt sách được dẫn. Trước mắt chỉ thảo luận/chốt lại cách khách đặt, tìm lại, đổi và hủy sách, cùng việc có tài khoản bạn đọc tùy chọn hay không. Các đề xuất ở cuối chat trước chưa được duyệt triển khai; giữ nguyên hạn mức đã chốt cho đến khi tôi quyết định. Giữ mọi thay đổi đang có trên main, không tự commit/push/deploy hoặc dùng subagent. Nếu cần bàn tới UI, kiểm tra implementation/ảnh QA đang có trước, không làm lại từ bộ concept cũ.
