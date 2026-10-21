# Tủ sách theo Stitch và thao tác theo sách

## Quyết định trực tiếp của người dùng

Giữ nguyên landing cuốn sách. Thay phần còn lại theo Stitch project 18002116813589247564 và HANDOFF góc bo mềm: control 14px, card 22px, modal 24px, Newsreader/Be Vietnam Pro, xanh rêu/đất nung/giấy kem. Không dùng lại bố cục hero gradient cũ cho tủ sách.

- Đổi Tra cứu sách thành Tủ sách; bỏ tab Đặt giữ chỗ. Nút đặt nằm trên card và chi tiết sách, mở form trong modal cho đúng cuốn. Khách chưa có phiên thấy modal đăng ký/đăng nhập Google; giữ ý định qua callback.
- Xem/tìm sách, tóm tắt và các bài đã duyệt vẫn công khai. Đặt/hủy, đánh dấu và gửi nhận xét yêu cầu tài khoản; API kiểm tra độc lập UI. Quyền token đơn khách cũ vẫn theo quyết định trước, UI đặt trong khu tài khoản.
- Bookmark lưu theo tài khoản và đồng bộ sau đăng nhập mới. Người dùng đã bỏ yêu cầu thông báo: không email, push hay notification. Trên card gắn bookmark có nhãn; xanh rêu nếu tồn khả dụng >0, đỏ đất nung khi =0, không chỉ truyền nghĩa bằng màu. Nút đánh dấu ngay dưới đặt. Bookmark xếp đầu Tất cả trước LIMIT/OFFSET; vẫn tôn trọng tìm kiếm/lọc.
- Chi tiết sách có tóm tắt từ DB và ba nút đặt/đánh dấu/đánh giá. Đánh giá mở thẻ riêng của cuốn đó; tải tiếp các trang để đọc toàn bộ review đã duyệt. Review CLB đứng trước bạn đọc, rồi mới nhất. Dấu CLB do server xác định từ actor nội bộ, không nhận từ client.
- Bạn đọc được viết cảm nhận bất kỳ sách nào, không tuyên bố đã xác minh từng người đã mượn. Nội dung chỉ chữ, không nhận ảnh/attachment hoặc render HTML. Mặc định PENDING, chỉ ADMIN duyệt; không lộ PII hay nội dung chưa duyệt.

## Thực hiện và nghiệm thu

1. Thêm migration bookmark và dấu CLB; kiểm thử quyền sở hữu, idempotency, phân trang/ghim và pending/ADMIN/PII trên DB test.
2. Dùng lại service tồn khả dụng, đặt sách, CAPTCHA, quota và phiên reader. Không thay cọc/tài chính/hạn mức.
3. Một context phiên bạn đọc cho portal/modal/tài khoản; dialog có Escape, giữ focus, trả focus, cuộn mobile. Bố cục catalog theo mẫu 01/02; form 03/04; review theo mẫu 07. Đồng bộ control các vùng nội bộ hiện có, không viết lại nghiệp vụ.
4. Check/unit/build + integration liên quan; migration local cộng thêm chỉ sau backup và xác minh đích. Giữ dirty baseline và hash landing; không commit/push/deploy hoặc dựng tài khoản Google giả trong DB thao tác.

Browser tool trả `Local browser use is disabled in Work settings`; người dùng xác nhận không chủ động tắt. Automatic approval review từ chối lần kiểm tra đầu, lần kiểm tra lại thực tế trả lỗi trên và danh sách browser rỗng. Chưa xác định được nguyên nhân lệch trạng thái app/công cụ. Không dùng trình duyệt khác để vượt chặn. Tách HTTP/test/build khỏi nghiệm thu trực quan.

## Bàn giao implementation local ngày 22/10

- `PublicPortal.tsx` dùng bố cục kệ sách Stitch: cột phân loại PC, bộ lọc mobile, 4/3/2 cột và năm mục điều hướng, không còn tab đặt riêng. CSS có phạm vi trong `reader-library.css`, không import CSS demo/CDN Tailwind từ Stitch.
- `ReaderSession.tsx` quản lý một nguồn phiên chung cho portal/tài khoản/modal; `ReaderDialog.tsx` dùng native dialog. `ReaderWorkspace` giữ hồ sơ/Sách của tôi; `ReservationSection` tái sử dụng transaction/intent/CAPTCHA, khóa đúng cuốn trong modal. Luồng mã cũ không mở lại tab đặt.
- `reader_bookmarks` và `readers/library.ts` lưu theo reader, PUT idempotent/DELETE; router recheck session có khóa trong transaction. Catalog xếp bookmark trước LIMIT/OFFSET khi ở Tất cả, vẫn giữ lọc/tìm kiếm.
- Review thêm dấu `is_club_review` do actor nội bộ xác định; dữ liệu cũ chỉ backfill khi author thuộc members. Reader không tự gắn dấu CLB hay giả tên/email. Nội dung ảnh/attachment bị từ chối, PENDING không xuất hiện trên API public. Các trang 50 review xếp CLB trước; UI tải thêm để đọc hết. `ClubReviewComposer` cho nội bộ gửi bài chờ duyệt; quyết định review chỉ ADMIN, không đổi quyền bài tin tức khác.
- Nội bộ giữ shell 240px và các module nghiệp vụ, đồng bộ nút/input 14px, chữ UI nhỏ tối thiểu 14px. Mobile chuyển sidebar thành drawer, tự đóng khi chọn module/Escape và trả focus về nút menu. Đây là implementation chưa có nghiệm thu bàn phím/thiết bị bằng browser.

Đã backup local trước migration 22: `.local/ysbk/backups/before-library-2026-10-21T17-04-17-470Z.dump`, SHA256 `3bf4cf0e00761f6c05849f94e888c509152dbb789e8e627f1b43a15d193e3de7`. Đã kiểm tra listing bằng pg_restore, chưa restore drill. Chỉ thêm bảng/cột/index và backfill dấu CLB; không reset dữ liệu. RLS/GRANT/policy của bảng bookmark đã áp dụng cho backend role.

Bằng chứng `.review-artifacts/library-*`: 371/371 unit; check 179 files, không lỗi/warning/hint; build 6 trang, local:up thành công. Bộ hồi quy 4 file PostgreSQL đạt 28/28; sau bổ sung ca CLB/ADMIN, riêng reader-library đạt 4/4. Có kiểm tra reader một phiên, publishing, giữ chỗ, quota, tồn, ghim xuyên trang và 53 review qua hai trang. Provider OAuth trong test reader là response có kiểm soát, không Google thật.

HTTP xác nhận shelf/catalog/ready 200, CSS mới được phục vụ, bookmark anonymous 401, Google explicit unconfigured và trang review sai 400. Hash `BookLanding.astro`, `book-landing.css`, `pages/index.astro` khớp baseline trước lượt này. HTTP/nguồn không chứng minh không tràn 320px hoặc modal/focus thực tế. Tài nguyên Google/domain/Access vẫn chưa có; không seed bạn đọc giả vào DB thao tác, chưa deploy/commit/push. Browser/Google thật/Access thật vẫn là gate mở.
