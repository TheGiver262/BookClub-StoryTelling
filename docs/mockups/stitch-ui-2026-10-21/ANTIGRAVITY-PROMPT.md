# Prompt giao Antigravity triển khai giao diện YSBK

## Ghi chú trước khi dùng lại prompt

Prompt được lập trước các thay đổi UI mới đang có trong workspace. Đọc `docs/SESSION-HANDOFF.md` và `docs/CURRENT-STATE.md`, kiểm tra `src/styles/ui.css`, global import, component/theme và ảnh QA rồi chỉ tiếp tục phần thiếu. Không ghi đè hoặc làm lại toàn bộ.

Người dùng hiện chuyển chat để thảo luận UX đặt/hủy, chưa giao code tài khoản bạn đọc/đổi sách/thay IP. Prompt này không tự cấp quyền thực hiện các đề xuất đó, commit/push/deploy hoặc dùng subagent.

Sao chép phần dưới vào Antigravity đang mở repo `F:\Codex Project\YSBK`.

---

Hãy triển khai phần giao diện cho website Câu lạc bộ Yêu Sách Bách Khoa Hà Nội theo thiết kế “Thư viện ký ức — góc bo mềm” đã duyệt. Chỉ làm local; chưa commit, push hoặc deploy.

Đọc trước:
1. `docs/mockups/stitch-ui-2026-10-21/HANDOFF.md` — đặc tả và bảng bao phủ toàn bộ màn hình.
2. `docs/superpowers/plans/2026-10-21-ysbk-soft-ui.md` — trình tự triển khai.
3. Mở `docs/mockups/stitch-ui-2026-10-21/index.html` qua HTTP local để xem đủ mẫu. `08-components.html` và `soft-ui.css` minh họa hình dáng; nguồn Stitch trong hai thư mục `stitch-soft-source` và `stitch-complete-source`.
4. `docs/technical/public-portal-publishing.md`, `docs/technical/book-landing-local.md` và source hiện tại để hiểu nghiệp vụ.

Thiết kế chốt:
- Giữ bảng màu trong HANDOFF; không đổi sang palette khác. Tên CLB đầy đủ có “Hà Nội”, slogan đúng dấu phẩy “Mở sách, đọc tương lai”.
- Nút/input bo 14px, card 22px, modal 24px, tab bo hai góc trên 15px, badge tròn. Bóng tản nhẹ; giảm khung lồng khung. Bìa sách bo 4px.
- Newsreader cho tiêu đề; Be Vietnam Pro cho UI/nội dung; giữ Dancing Script ở bìa và trang kết. Đủ dấu Việt, có fallback.
- PC rộng rãi, sidebar nội bộ 240px; mobile một cột, bộ lọc riêng, bảng tác nghiệp thành phiếu, CTA/bottom nav không che nội dung. Bảng quầy phải đủ chỗ cho tên sách; ghi chú đặt dưới bảng hoặc drawer.
- Giữ landing cuốn sách đã duyệt: bìa, bìa phụ, ảnh, 10 chương, animation, điều khiển và phần sau sách. Chỉ đồng bộ chrome/nút/thẻ liên quan.

Phải áp dụng cho **toàn bộ** phần công khai và các module nội bộ trong bảng màn hình của HANDOFF, gồm kho sách, bán/ký gửi, nhân sự, lịch trực, tuyển thành viên, sự kiện, kiểm duyệt, tài chính, báo cáo và admin; không chỉ sửa tủ sách hoặc dashboard.

Giữ nguyên chức năng và bảo mật:
- Không viết lại backend, schema/migration, API contract, quyền hoặc cách tính tiền. Không reset Docker volume/database, không chạy migration ngoài phạm vi UI.
- Giữ session/redirect, một hub công khai sáu tab và liên kết query/hash cũ, named target `ysbk-public`.
- Giữ validation, optional fields, Turnstile, chống gửi lặp/idempotency, thông báo hết bản và refresh tồn. Một đơn một cuốn, giữ đến hết buổi trực đã chọn; hạn mức không được đổi hoặc đưa chi tiết IP ra UI.
- Tra cứu đơn dùng mã riêng; token ở hash, không query/log/analytics. Không chuyển thành tra cứu bằng SĐT.
- CTV thử thách một tháng, quản lý đánh giá/công nhận; chỉ quản lý xóa CTV, thành viên rời chuyển cựu; giữ lịch sử. Không thêm cấp mật khẩu hay tự đăng ký.
- Sách/lịch/nghỉ/sự kiện/tuyển chỉ quản lý sửa; giữ các chặn server. Không tự hủy đơn để sửa lịch.
- Cọc khác thu nhập, các xác nhận tiền và người nhận phải còn đủ dữ liệu; không tự tính lại ledger ở client.
- Không thêm newsletter, SMS/email/Zalo, chat, OTP, SSO, mua hàng hoặc thanh toán online theo những chi tiết mà HTML Stitch có thể tự sinh.

Cách làm:
1. Ghi lại branch/HEAD/status; bảo toàn toàn bộ thay đổi đang có. Không dùng subagent nếu tôi chưa cho phép trong yêu cầu trực tiếp.
2. Tạo token/class UI dùng chung theo stack hiện có. **Không import `soft-ui.css` hoặc copy nguyên HTML Stitch vào app**: selector rộng/`!important` chỉ dành cho bản concept.
3. Làm một luồng public và quầy mượn–trả xuyên suốt PC/mobile, kiểm tra, rồi áp dụng cùng mẫu sang các module còn lại. Chỉnh từng vùng `InternalWorkspace.tsx`; không thay cả file làm mất handler/dialog.
4. Giữ logo SVG và ảnh được duyệt; bỏ placeholder chữ Y/YSBK, mock số liệu, năm/địa điểm/giờ tự sinh từ concept. Không bịa tóm tắt sách.
5. Kiểm tra chức năng, responsive, bàn phím/focus, dấu Việt, tương phản và trạng thái rỗng/lỗi/tải; xử lý mọi lỗi do thay đổi gây ra.
6. Chạy `pnpm run check`, `pnpm run test:unit`, `pnpm run build`; chạy smoke local khi runtime sẵn sàng. Nếu đổi hành vi/request thì bổ sung regression/integration đúng test DB; không tuyên bố integration đạt từ unit/build.
7. Chụp bằng chứng ở PC 1440×1000, tablet 768×1024, mobile 390×844 và 320×740; dùng dữ liệu QA, che token/thông tin riêng. Dọn dữ liệu thử bằng cơ chế hiện có, giữ audit.

Kết thúc bằng báo cáo: module đã cập nhật theo bảng HANDOFF, file thay đổi, kiểm thử thực chạy và kết quả, screenshot, phần chưa kiểm chứng. Giữ web local cổng 4321 để tôi xem. Chưa commit/push/deploy.
