# Re-review UI-01 / UI-02 — 22/10/2026

Phạm vi: các sửa phân trang đánh giá và xử lý ảnh của Antigravity; bỏ qua chỉnh giao diện mới theo yêu cầu người dùng. Không sửa code nghiệp vụ trong lượt review. Workspace main, HEAD b9d568b4c4ba9c8d390fef3bb80f7abce52b8abb, nhiều thay đổi chưa commit.

## Kết quả

- UI-01: đã sửa đường chính. Trang chỉ tăng sau thành công, lỗi trang 2 thử lại trang 2; giữ danh sách, chống trùng. Đổi sang sách khác hoặc đóng và giữ modal đóng: guard hiện tại chặn kết quả cũ.
- UI-02: đã sửa trong phạm vi review. Task ID + context vô hiệu hóa kết quả ảnh cũ; disable control khi busy và xóa ảnh khi đổi đối tượng. Giữ nén ảnh/validation cũ.
- Bộ regression mới có đăng ký trong test:unit; chạy riêng 5/5 đạt. Lần đầu sandbox chặn spawn EPERM; chạy lại ngoài sandbox đạt.

## P2 — Request cũ vẫn được nhận khi mở lại cùng cuốn sách

Vị trí: src/components/PublicPortal.tsx, moreBookReviews(), dòng 157–169. Trigger: đang tải trang 2 của sách A; đóng modal, mở lại đánh giá sách A; trang 1 mới tải xong rồi trang 2 từ phiên modal cũ trả về. Guard chỉ so panel và titleId, nên hai giá trị đã trùng lại và request cũ vẫn ghi danh sách/trang/loading. Có thể hiện review cũ sau khi người đọc chủ động mở lại; tác vụ cũ cũng có thể tắt loading của tác vụ mới.

Probe trích trực tiếp effect và handler từ TSX hiện tại, điều khiển thứ tự promise: `.review-artifacts/review-20261022-reopen.mjs`; JSON tương ứng ghi staleAccepted=true, reviewPage=2, ids=[new-page1,stale-page2]. Đây là counterexample source với promise kiểm soát, không phải kiểm chứng mạng/browser.

Sửa nhỏ: thêm generation của lượt mở/tải review; đổi/đóng/mở modal đều invalidation. Mọi success/catch/finally chỉ được cập nhật khi generation còn khớp. Effect trang 1 và moreBookReviews phải cùng dùng generation, tránh tác vụ cũ tắt loading mới. Kiểm tra các đường openPanel, closePanel, switchTab, history/popstate, đổi focusedBook và chuyển sang viết review.

Regression: request trang 2 chờ; đóng/mở lại A; trả request cũ trước và sau trang 1 mới; assert danh sách/trang/error/loading của phiên mới không đổi. Thêm A→B→A và nhánh lỗi cũ. Giữ regression 150 bài / lỗi trang 2 hiện có.

## Giới hạn

Browser Use trong lượt này từ chối với Local browser use is disabled in Work settings; cả lời gọi tab và inventory đều bị chặn. Chưa nghiệm thu luồng UI thật hoặc căn nền bằng screenshot browser. Không dùng công cụ khác để đi vòng quyền này. Google/cloud chưa cấu hình vẫn là gate cũ. Không chạy lại PostgreSQL cho đợt sửa chỉ ở UI.

## Kiểm tra cuối và thử nền ngoài sách

- `pnpm check`: 180 file, 0 lỗi/cảnh báo/hint; `pnpm test:unit`: 376/376 đạt, không skip. Beta build demo=false/local=true: 6 trang đạt, output dist đang được runtime phục vụ.
- Theo yêu cầu riêng sau review: thêm `public/book/assets/meadow-sky-backdrop.png` (Imagegen từ ảnh mẫu, chỉ cảnh, 2.22 MB) và `src/styles/book-backdrop.css`, import trong `src/pages/index.astro`. CSS chỉ thay nền stage/pseudo và ẩn vòng bàn, có offset đường chân trời theo breakpoint; chưa có screenshot để hiệu chỉnh pixel. Asset là bản thử, chưa tối ưu ảnh cho production.
- HTTP local `/` và asset đều 200; stylesheet được HTML runtime trỏ tới có quy tắc nền mới. Đây là bằng chứng phục vụ artifact, không thay thế kiểm tra hình ảnh.
- Hash 5 file `BookLanding.astro`, `book-landing.css`, `book.mjs`, `book-content.mjs`, `cover-minimal-v4.png` trước/sau giống nhau. Không đổi bìa, nội dung, hình học hay mã hiệu ứng cuốn sách. Không commit/push/deploy, không đổi config/global/database.
- Prompt sửa finding còn lại: `docs/prompts/antigravity-next/2026-10-22-review-request-generation.md`.

## Lượt căn màu và đường chân trời tiếp theo

- Theo yêu cầu người dùng, thay cảnh trời xanh bằng `meadow-cover-matched.png`, vẽ từ chính `cover-minimal-v4.png`: trời vàng kem, cỏ xanh rêu/nét cọ và hoa nhỏ cùng phong cách bìa. CSS cân sáng/bão hòa nhẹ và giữ chữ điều hướng ngoài sách đọc được trên nền kem.
- Thay offset breakpoint ước lượng bằng `public/book/book-backdrop.mjs`: chiếu đường viền cỏ lấy mẫu từ hai ảnh qua tỉ lệ crop thực của bìa và nền; căn hai mép bằng dịch dọc/độ nghiêng riêng của lớp nền. ResizeObserver đọc kích thước DOM; phép đo dùng vị trí sách đóng, không chạy theo transform lật trang và không ghi style vào node sách.
- Thêm `tests/unit/book-backdrop.test.mjs` và đăng ký trong test:unit. 16/16 test liên quan nền/lật sách đạt, bao gồm 8 bộ kích thước PC/tablet/mobile, crop ảnh và DOM resize. Check 182 file không lỗi/cảnh báo/hint; beta build 6 trang đạt. Không lặp lại toàn bộ unit suite vì không đổi nghiệp vụ.
- Local HTTP 200 cho script và ảnh mới; HTML/CSS runtime trỏ đúng file. Hash 5 file sách trước/sau vẫn giống nhau. Chưa có screenshot trình duyệt: Browser Use vẫn báo disabled ở lượt này, nên sai khác thị giác nhỏ do nét cỏ/lấy mẫu vẫn cần quan sát trực tiếp; test tọa độ không chứng minh khớp từng pixel trên màn hình.
