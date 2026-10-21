# YSBK — Bộ thiết kế giao diện hoàn chỉnh để triển khai

## Ghi chú bàn giao nối tiếp

**Chỉ dẫn trực tiếp mới nhất 21–22/10:** dùng bố cục Stitch này cho ứng dụng, giữ nguyên landing sách, bắt buộc tài khoản Google cho thao tác cá nhân; bỏ tab đặt riêng, đổi Tra cứu sách thành Tủ sách và đặt qua modal. Bổ sung bookmark ghim/xanh–đỏ (không gửi thông báo), thẻ review từng cuốn, CLB ghim trước, nhận xét chữ chờ ADMIN duyệt. [Thiết kế bổ sung](../../technical/reader-library-design-2026-10-21.md) thay các đoạn tài khoản tùy chọn/sáu tab phía dưới; các token và nghiệp vụ tiền/quyền không bị thay vẫn áp dụng.

Đặc tả này vẫn giữ hướng UI đã duyệt. Từ sau lúc xuất concept, workspace xuất hiện UI implementation (`src/styles/ui.css`, global import, theme/component) và ảnh QA. Hãy đối chiếu source/diff hiện có rồi hoàn thiện phần thiếu; không làm lại toàn bộ hoặc suy mọi module đã nghiệm thu. Xem [session handoff](../../SESSION-HANDOFF.md) và [trạng thái hiện hành](../../CURRENT-STATE.md).

Trang “Sách của tôi”, tài khoản bạn đọc tùy chọn, email khôi phục, đổi sách và thay hạn mức IP ở nghiên cứu 21/10 chưa được người dùng phê duyệt. Các ràng buộc nghiệp vụ hiện hành bên dưới vẫn áp dụng.

Ngày bàn giao: 21/10/2026. Phong cách chốt: **Thư viện ký ức — góc bo mềm**.

## 1. Đọc và xem theo thứ tự

1. Tài liệu này là đặc tả giao diện, phạm vi và tiêu chí nghiệm thu.
2. `index.html` là trình xem toàn bộ mẫu PC/mobile. Chạy server thư mục này ở cổng 4323 để xem.
3. `08-components.html` và `soft-ui.css` minh họa màu, hình dáng, typography, trạng thái.
4. Các HTML đánh số minh họa bố cục; `stitch-soft-source/` và `stitch-complete-source/` lưu nguồn Stitch.
5. `ANTIGRAVITY-PROMPT.md` là prompt triển khai. Kế hoạch: `docs/superpowers/plans/2026-10-21-ysbk-soft-ui.md` tính từ gốc repo.

Project nguồn: https://stitch.withgoogle.com/projects/18002116813589247564

**Thứ tự ưu tiên khi có mâu thuẫn:** nghiệp vụ/API hiện có và quyết định người dùng → tài liệu này → bản xem local đã biên tập → HTML nguồn Stitch. Những năm, địa điểm, tên người, số lượng, số tiền và nội dung sách trong concept là minh họa. Không đưa chúng vào dữ liệu thật. Không coi câu chữ Stitch tự thêm là yêu cầu sản phẩm.

Phạm vi lần này là thiết kế và bàn giao; chưa thay giao diện ứng dụng. HTML concept không phải component để sao chép nguyên trang vào Astro/React.

## 2. Nhận diện và nguyên tắc chung

- Tên: **Câu lạc bộ Yêu Sách Bách Khoa Hà Nội**. Slogan: **Mở sách, đọc tương lai**.
- Hướng cảm xúc: sách giấy, tạp chí sinh viên, ấm và hoài niệm vừa đủ; nhẹ, trẻ, dễ dùng.
- Giữ landing cuốn sách, ảnh CLB, minh họa bìa, logo, ngày thành lập 16/09/2013 và hiệu ứng hiện có đã được duyệt.
- Làm mềm phần UI quanh nội dung: thẻ, nút, bộ lọc, biểu mẫu, bảng, hộp thoại. Bìa sách thật vẫn gần vuông; không bo thành viên thuốc.
- Giảm khung lồng khung. Dùng khoảng trắng và đường phân cách thay cho một viền đậm bao quanh mọi dòng.
- Khu nội bộ dùng cùng nhận diện nhưng ưu tiên đọc nhanh, phân biệt chứng từ, tiền cọc, trạng thái và thao tác.

### Màu cố định

| Token | Giá trị | Vai trò |
| --- | --- | --- |
| primary / primary-hover | `#365E4B` / `#294C3A` | CTA chính, điều hướng đang chọn |
| primary-pale | `#E8EDDF` | Nền chọn, thông tin tích cực |
| terracotta / hover / pale | `#9B4D36` / `#813C2A` / `#F7E7DB` | Cảnh báo và hành động hủy có nhãn |
| gold / pale | `#A87A4C` / `#F4EAD2` | Trang trí, nền lưu ý; không dùng vàng làm chữ nhỏ |
| logo-sage | `#819079` | Logo, chi tiết trang trí |
| page / paper | `#F8F5EC` / `#FFFDF5` | Nền trang / bề mặt nội dung |
| ink / muted | `#35483C` / `#64705C` | Chữ chính / chữ phụ |
| border | `#DCDED0` | Viền và đường phân cách |

Giữ các màu cảnh báo nghiệp vụ cần thiết đang có nếu thay màu làm mất nghĩa hoặc giảm tương phản; không tự đổi ngữ nghĩa lỗi/thành công để ép tất cả thành một màu. Trong theme hiện tại, có thể giữ các tên alias `brand-navy`, `brand-red`; không đổi tên hàng loạt chỉ để phù hợp tên màu mới.

### Typography, hình dáng và chiều sâu

| Hạng mục | Quy chuẩn |
| --- | --- |
| Tiêu đề | Newsreader 500–600; PC 40–56px, mobile 30–36px; heading trong form 22–28px |
| Nội dung | Be Vietnam Pro 16px, line-height 1.5–1.65 |
| Nhãn / metadata | 14px trở lên; không all-caps cả đoạn văn |
| Số tiền / mã | Be Vietnam Pro, `font-variant-numeric: tabular-nums`; mã dài được ngắt an toàn |
| Bìa và trang kết | Giữ Dancing Script hiện có có dấu Việt; không thay bằng font UI |
| Nút / input / select | Bo 14px, cao tối thiểu 44px PC và 48px mobile |
| Card / panel | Bo 22px; modal 24px; không bo từng ô bảng |
| Tab | Hai góc trên bo 15px; trạng thái chọn có nền/viền và chữ rõ |
| Chip / badge | Bo tròn; luôn có chữ, không chỉ chấm màu |
| Ảnh bìa sách | Bo 4px, `object-fit: contain`; không cắt mất tên sách |
| Khoảng cách | Bội số 4px; giữa trường 16–20px, nhóm 24–32px, padding card 20–24px; mobile 16–20px |
| Bóng card | `0 5px 18px rgba(53,72,60,.08)` |
| Bóng modal | `0 16px 48px rgba(53,72,60,.16)` |
| Tương tác | Hover 150–180ms, pressed dịch 1px; focus viền 3px có khoảng cách; tôn trọng reduced-motion |

Font trong concept đã được xem bằng trình duyệt, nhưng triển khai vẫn phải kiểm tra đủ dấu Việt, tải font lỗi/chậm và layout shift. Có fallback serif/sans rõ ràng. Không đưa CDN Tailwind của bản xuất Stitch vào ứng dụng.

## 3. Layout PC, tablet và điện thoại

- PC từ 1024px: nội dung công khai tối đa 1280px, gutter 24–40px; khu nội bộ sidebar 240px, phần làm việc co giãn. Tên CLB được xuống hai dòng hợp lý.
- 768–1023px: sidebar thành drawer; form hai cột khi mỗi cột còn đủ khoảng 280px. Không cố giữ bố cục PC nếu bảng đã khó đọc.
- Dưới 768px: gutter 16px; form một cột; bottom navigation tối đa bốn điểm đến và menu “Thêm”; luôn truy cập được đủ module hiện có.
- Tủ sách: 4 cột PC, 3 tablet nếu vừa, 2 mobile; 320px vẫn đọc được tên và hành động. Lọc mobile mở sheet/drawer riêng, có Xóa lọc/Áp dụng.
- Bảng tác nghiệp: PC đủ cột và chữ; mobile đổi thành phiếu tóm tắt có hành động chính. Báo cáo cần đối chiếu nhiều cột được cuộn ngang **trong vùng có nhãn**, không làm toàn trang tràn ngang.
- Modal PC rộng theo nội dung, tối đa khoảng 760px cho form thường. Mobile dạng sheet hoặc trang gần toàn màn hình; có tiêu đề, nút đóng, nội dung cuộn và vùng hành động không che trường.
- Sticky CTA/bottom nav có khoảng bù bên dưới và safe-area. Khi bàn phím mở vẫn cuộn đến được trường lỗi và nút xác nhận.
- Cảnh báo/lịch hẹn ở quầy đặt dưới bảng hoặc drawer phụ; không chiếm một cột làm tên sách bị bẻ xuống từng từ.

## 4. Danh mục màn hình và mẫu áp dụng

Mỗi hàng dưới đây là phạm vi phải triển khai. Không được bỏ module chỉ vì không có một ảnh riêng cho mọi tab con. Mẫu PC/mobile dùng chung cấu trúc được mô tả tại cột cuối; không tự thêm chức năng để giống concept.

| Màn hình / mã hiện có | Mẫu thiết kế | PC và mobile / hành vi phải giữ |
| --- | --- | --- |
| `/` và phần sau sách | Cuốn sách đã duyệt + token mới | Giữ bìa phụ, 10 chương, timeline, đảo chiều, chỉ mục, slogan và ảnh; chỉ đổi chrome/nút/thẻ hướng dẫn; liên kết cuối sách mở cùng cổng bạn đọc |
| `/sach/` — tra cứu | 01 PC / 02 mobile | 50 đầu sách/trang; tìm/lọc/availability; xem cả sách hết bản; hết bản không đặt được |
| Chi tiết sách `/sach/[id]` và modal | 03 / 04 | Ảnh, tác giả, thể loại, tóm tắt từ DB, tiền cọc dự kiến, bản còn; không có mô tả thì nói đang bổ sung |
| Đặt giữ chỗ | 03 / 04 | Một cuốn/đơn, tên, SĐT, buổi nhận, xác nhận cọc và Turnstile; MSSV/email giữ tính tùy chọn hiện có |
| Đặt thành công / tra cứu đơn | 10 + phiếu của 04 | Lưu/copy mã riêng, link tra cứu; token ở hash; không tra bằng SĐT đơn thuần; hủy chỉ khi server cho phép |
| Lịch trực & sự kiện công khai | 07 / mẫu danh sách mobile 14 | Card lịch, trạng thái nghỉ/mở nhận, chi tiết sự kiện; không lộ nhiệm vụ/chi phí nội bộ |
| Góc review | 07 + mẫu detail 03 | Danh sách, chi tiết, biểu mẫu và trạng thái chờ duyệt có sẵn; không công khai bài chưa duyệt |
| Tuyển thành viên công khai | 07 + mẫu form/phiếu | Nháp/mở/đóng, link đăng ký đúng dữ liệu, kết quả đã duyệt; không dựng thêm vòng tuyển hoặc form tiếp nhận mới |
| `/login` | 09 | Tài khoản CLB cấp, password/show-password/loading/lỗi; mobile một cột; không signup/OTP/social login |
| `dashboard` | Shell 05, card 08, danh sách 14 | Tóm tắt từ dữ liệu hiện có; không tính KPI giả hay thêm biểu đồ chưa có nguồn |
| `quay-sach` | 05 PC / 06 mobile | Giữ/hẹn/bàn giao, mượn/trả một phần, gia hạn, mất/hỏng, xác nhận người nhận, mở/đóng ca và cảnh báo thiếu sách; giữ đầy đủ dialog hiện có |
| `kho-sach` | Bảng 05, thẻ 02, editor 11 | Danh sách đầu sách và bản vật lý; tìm mã; trạng thái bản; thêm/sửa có quyền; không đổi mã hoặc tồn khi chỉ sửa metadata |
| `ban-sach` | Bảng 05 + form/confirm 08 | Giữ nghiệp vụ bán/ký gửi hiện có; phân biệt với mượn miễn phí; không đưa giỏ mua hàng sang public |
| `thanh-vien` và vòng đời nhân sự | 12, mobile theo phiếu 06 | Hồ sơ/phí/năng lực và các action có sẵn; CTV một tháng, công nhận thủ công, thành viên rời thành cựu; quyền đúng actor |
| `truc-sach` | 14, PC bảng/lịch của 05 | Lịch bận/import/preview/xếp nháp/công bố theo chức năng sẵn có; không kéo-thả tự tạo thay đổi nghiệp vụ |
| `tuyen` | 12 + bảng 05, form 11 | Đợt, ứng viên, phỏng vấn, rubric, đánh giá, duyệt kết quả và tiếp nhận; giữ trạng thái hiện có |
| `su-kien` | 14 + editor 11 | Danh sách, nhiệm vụ, chi phí, người tham gia và công khai theo quyền; không trộn public/private |
| `kiem-duyet` | Hai cột detail 03, bảng 05 | Xem bài và metadata; duyệt/từ chối theo quyền; phân biệt nháp/chờ duyệt/đã duyệt |
| `tai-chinh` | 13, mobile theo phiếu 06 | Thu/chi/ca/cọc/phí hiện có; cọc giữ riêng khỏi thu nhập; không tự tính lại ledger ở frontend |
| `bao-cao` | 13 + bảng cuộn có nhãn | Bộ lọc kỳ, số liệu từ server, trạng thái đang xuất/lỗi/không có dữ liệu; giữ CSV/PDF/Excel theo chức năng thật |
| `admin` | 11 + 12 | Quản lý sách/ảnh, lịch-nghỉ, sự kiện, tuyển; vòng đời CTV; chức năng admin hệ thống và audit sẵn có không bị bỏ |
| `cuu` | Shell + danh sách đọc | Chỉ dữ liệu/hành động được API cấp cho cựu; không biến read-only thành nút giả bấm được |
| 404 / mất quyền / hết phiên | Form/panel 09 | CTA trở lại hoặc đăng nhập, không lộ chi tiết kỹ thuật/stack trace; không làm mất ý định người dùng khi session hết |

`/cong-dong` và các liên kết query/hash cũ tiếp tục hoạt động. `/` có session vẫn tự vào `/noi-bo`; `/?public=1` cho xem landing. `/sach/` không tự chuyển người đang xem sang nội bộ. Giữ named target `ysbk-public` khi đã dùng để tránh mở nhiều tab landing.

## 5. Bộ thành phần và trạng thái bắt buộc

| Thành phần | Trạng thái / yêu cầu |
| --- | --- |
| Button | primary/secondary/text/destructive; default/hover/pressed/focus/disabled/loading; khóa gửi lặp, giữ nhãn có nghĩa |
| Trường nhập | label luôn hiện, optional đúng thực tế, helper, lỗi cạnh trường, loading/readonly; không đổi input editable thành disabled để trang trí |
| Search/filter | debounce hiện có, xóa tìm, áp dụng/xóa lọc, trang 1 khi đổi lọc; empty có CTA bỏ lọc |
| Card sách | có ảnh/thiếu ảnh, có mô tả/thiếu mô tả, còn/hết bản, đang tải; không hứa giữ được sách chỉ từ ảnh chụp tồn |
| Badge | Có sẵn / Đang mượn / Đang giữ / Cần kiểm tra / Đã đóng; có chữ và icon khi giúp đọc |
| Table/list | loading/empty/error/success, phân trang, hàng dài, mã dài; không gộp các ID vật lý khác nhau |
| Modal/sheet | focus vào trong, giữ Tab trong dialog, Escape nếu an toàn, trả focus về trigger; đóng không vô tình xác nhận |
| Notice/toast | lỗi ở gần thao tác, status có `aria-live`; cảnh báo nội bộ về bản sách cần gọi người đặt, không tự gửi thông báo ngoài |
| Confirm tài chính | người nhận, mã phiếu, số tiền, phương thức và tác động; không chỉ một nút “OK”; giữ quote/confirm/idempotency hiện có |
| Upload | chọn tệp, xem trước, đang nén/gửi, lỗi định dạng/kích thước, lưu thành công; giữ PNG/JPEG/WebP và giới hạn server hiện có |
| Editor nội dung | phân biệt nháp/công khai/nghỉ/mở/đóng **theo API từng loại**, không thêm cờ publish mới cho sách khi API không có |

Tất cả vùng tương tác dùng bàn phím được. Tiêu đề có thứ bậc; icon-only phải có tên truy cập. Không đặt chữ phụ bằng sage/vàng nhạt khi chưa đủ tương phản. Đo WCAG AA trong triển khai: 4.5:1 chữ thường, 3:1 chữ lớn và các dấu hiệu UI cần thiết. Concept chưa là chứng nhận truy cập.

## 6. Ràng buộc nghiệp vụ không được đổi khi làm UI

- Giữ nguyên route, request/response, kiểm quyền server, cookie/session và CSRF/idempotency nếu có; không sửa database/migration/RLS/provider.
- Đặt sách không login; CAPTCHA/Turnstile thật. Không thay widget bằng câu đố hoặc giả token trong sản phẩm.
- Một đơn một cuốn; giữ đến cuối **buổi trực được chọn**. Không thay thành 48 giờ/ca gần nhất. Hạn mức IP/SĐT vẫn ở server; không đưa chi tiết chống lạm dụng lên màn hình.
- Danh mục refresh theo module hiện có; đặt thành công phải invalidate/refresh tồn. Server mới quyết định có giữ được bản cuối. Hiển thị lỗi hết bản dễ hiểu, giữ thông tin form cần thiết khi retry.
- Mã tra cứu là bí mật. Không gắn token vào query, analytics, log hay ảnh bàn giao; không trả dữ liệu đơn chỉ từ SĐT.
- CTV có quyền nghiệp vụ tương đương thành viên theo API; một tháng thử thách không tự công nhận. Chỉ quản lý công nhận/xóa CTV/chuyển thành cựu. Xóa CTV giữ lịch sử; không đưa chức năng xóa này cho thành viên chính thức.
- Chỉ quản lý sửa nội dung công khai. Lịch có đơn bị chặn sửa/hủy theo server; UI giải thích cần xử lý đơn liên quan, không tự xóa đơn để lưu được lịch.
- Không thêm newsletter, email/SMS/Zalo, chat, OTP, tài khoản tự đăng ký, thanh toán online, AI viết tóm tắt hoặc tính năng ngoài phạm vi.
- Các luồng tài chính, cọc, hoàn cọc, ký gửi và báo cáo giữ nguyên cách tính từ server, không sửa logic khi “dọn UI”.

## 7. Tài sản và mã nguồn cần dùng

| Nơi | Trách nhiệm khi triển khai |
| --- | --- |
| `tailwind.config.mjs`, `src/styles/global.css` | Màu, font, token dùng chung; giữ alias và semantic state |
| `src/styles/ui.css` (đề xuất) | Class UI có tên rõ: nút, input, card, badge, table, modal, responsive; import qua global |
| `src/components/BookLanding.astro`, `src/styles/book-landing.css` | Chỉ chrome/hướng dẫn/liên kết; giữ timeline, ID, SVG, hình học, điều khiển sách |
| `src/components/PublicPortal.tsx` | Một hub sáu tab, catalog/detail/review/lịch/tuyển; giữ fetch/filter/navigation |
| `src/components/ReservationSection.tsx` | Form, kết quả, tra cứu và hủy; giữ CAPTCHA, private token, intent và xử lý lỗi |
| `src/pages/login.astro`, `src/pages/404.astro`, `src/pages/sach/[id].astro` | Đồng bộ các trang riêng; giữ script và điều hướng |
| `src/components/InternalWorkspace.tsx` | Shell, mọi module, bảng và dialog; chỉnh từng vùng, không viết lại toàn bộ state/handler |
| `src/components/PublishingManager.tsx`, `src/components/MembershipManager.tsx` | Form quản lý dễ dùng, quyền và trạng thái đúng, responsive |
| `public/book/assets/club-logo-v8.svg` | Logo thật; không thay bằng chữ Y/YSBK từ Stitch |
| `public/book/assets/`, `docs/mockups/open-book/` | Ảnh và minh họa được duyệt, hồ sơ nguồn; không lấy ảnh người AI trong mẫu |

`soft-ui.css` hiện dùng selector rộng và `!important` để diễn thử nhiều bản xuất khác nhau. **Không import file này vào ứng dụng.** Chuyển các token đã chốt thành class có phạm vi; không bo tròn mọi div/input/bảng bằng override toàn cục. Không thêm thư viện UI chỉ để làm nút, thẻ và ô nhập; dùng stack hiện có Astro/React/Tailwind/lucide-react.

## 8. Nghiệm thu và bàn giao lại

1. Mỗi module trong bảng phạm vi có screenshot PC và mobile, hoặc ghi rõ khu vực bị chặn và lý do. Bộ ảnh không chứa dữ liệu cá nhân, tài khoản, cookie, mã tra cứu hoặc token thật.
2. Xem ở 1440×1000, 768×1024, 390×844 và 320×740. Không tràn trang; modal không che CTA; tên sách/tên người/mã dài đọc được.
3. Đủ trạng thái loading/empty/error/permission/disabled, không giữ mock data làm fallback cho API lỗi.
4. Kiểm tra book navigation, sáu tab public, 50 sách/trang, lọc rồi phân trang, summary, hết bản, Turnstile, đặt → copy mã → tra → hủy, bàn giao → trả; giữ private code an toàn.
5. Kiểm tra admin/thành viên/CTV/cựu: nút đúng quyền; API vẫn chặn gọi trực tiếp. Màn hình admin upload/sửa sách/lịch/nghỉ/sự kiện/tuyển và vòng đời CTV hoạt động như trước.
6. Chạy `pnpm run check`, `pnpm run test:unit`, `pnpm run build`. Không ghi lại số test lịch sử như một kết quả mới.
7. Chạy `pnpm run local:smoke` khi runtime đủ; dữ liệu smoke được dọn theo script. Nếu thay request/handler/validation mới, chạy thêm integration liên quan bằng cơ chế test DB hiện có, tuyệt đối không test DB trên `ysbk_local`.
8. Báo cáo file thay đổi, lệnh và kết quả thực tế, ảnh đối chiếu, điều chưa kiểm thử. Không tự commit/push/deploy, reset database hoặc dùng tool gửi thông báo ra ngoài.

Hoàn thành phần UI khi tất cả màn hình hiện có đã theo cùng hệ thống, thao tác cũ còn chạy, và có bằng chứng runtime. Build xanh hoặc ảnh tĩnh riêng lẻ không chứng minh đầy đủ chức năng.
