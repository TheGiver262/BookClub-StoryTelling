# Review tiếp nối Antigravity — 22/10/2026

## Phạm vi

Workspace `F:\Codex Project\YSBK`, HEAD `b9d568b4c4ba9c8d390fef3bb80f7abce52b8abb`. Review working tree tracked/untracked so với HEAD, ưu tiên findings 21/10 và các luồng UI–API liên quan: quản lý nội dung, vòng đời CTV, tài khoản bạn đọc, bookmark và review. Working tree trộn nhiều lượt Antigravity/Codex; không quy tác giả cho từng dòng chưa commit.

Đối chiếu quyết định trực tiếp mới nhất, `CURRENT-STATE.md`, `SESSION-HANDOFF.md`, thiết kế reader-library, public-portal-publishing và handoff Stitch. Những đoạn lịch sử về đặt không tài khoản/sáu tab/Browser Use bị tắt đã được thay thế. Browser Use hiện hoạt động.

Lượt này không sửa source ứng dụng, schema hoặc cấu hình. Chỉ thêm báo cáo, prompt và probe/log trong `.review-artifacts`. Không commit/push/deploy. Không subagent.

## Lỗi còn lại

### UI-01 — P2: tải lỗi một trang review khiến lần bấm tiếp theo bỏ qua trang đó

- **Vị trí:** `src/components/PublicPortal.tsx:98` và `:292`.
- **Tình huống:** sách có 150 review đã duyệt. Trang 1 tải thành công; trang 2 gặp lỗi mạng; người đọc bấm lại “Xem thêm đánh giá”.
- **Nguyên nhân:** nút tăng `reviewPage` trước khi request thành công. Nhánh catch chỉ ghi lỗi, không giữ lại trang cần thử lại. Sau lỗi trang 2, lần bấm sau tăng thành trang 3; `reviewsMore` vẫn true từ trang 1.
- **Hậu quả:** danh sách chứa review 1–50 và 101–150, bỏ sót 51–100. Điều này trái yêu cầu có thể tải tiếp để xem toàn bộ review của cuốn sách.
- **Bằng chứng:** `review-20261022-review-pagination.mjs/.json`. Probe lấy nguyên effect và onClick từ AST source hiện tại, cấp lỗi mạng có kiểm soát; xác nhận chuỗi request `[1,2,3]` và thiếu review 51–100. Đây là kiểm tra logic UI với API giả lập, không phải tái hiện 150 review trên browser hoặc dữ liệu thao tác.
- **Sửa nhỏ nhất:** chỉ chốt số trang sau request thành công hoặc giữ rõ trang thất bại để lần bấm kế tiếp thử lại chính trang đó. Có thể theo mẫu `morePublicReviews()` trong cùng component. Giữ merge chống trùng và thứ tự CLB do API trả về.
- **Regression:** trang 1 thành công, trang 2 lỗi một lần, bấm lại phải gọi trang 2; tải tiếp đủ 150 bài, không thiếu/trùng. Kiểm tra cả đổi sách/đóng modal khi request đang chờ.

### UI-02 — P2: ảnh đang xử lý có thể lọt sang form khác

- **Vị trí:** `src/components/PublishingManager.tsx:54–63`; các nút đổi đối tượng sách ở `:67`.
- **Tình huống:** chọn ảnh ở “Sách & ảnh bìa”, chuyển sang “Tuyển thành viên” trước khi `createImageBitmap` hoàn tất.
- **Nguyên nhân:** `image` dùng chung cho các form. Chuyển tab có xóa `image` nhưng không vô hiệu hóa kết quả `prepareImage` đang chờ; tab vẫn bấm được khi `busy`. Request cũ hoàn tất rồi gọi `setImage` vào form mới.
- **Hậu quả:** ảnh được chọn cho sách hiện trong form tuyển; nếu người dùng lưu form tuyển, payload có thể chứa nhầm ảnh đó. Đổi đối tượng sách hoặc chọn hai ảnh liên tiếp cũng cần được bảo vệ tại cùng chỗ.
- **Bằng chứng:** `review-20261022-image-race.mjs/.json`. Probe transpile nguyên component hiện tại, điều khiển thời điểm bitmap hoàn tất; xác nhận ảnh sách xuất hiện trong cây JSX của form tuyển. Không upload hoặc lưu ảnh vào database thao tác.
- **Sửa nhỏ nhất:** dùng `busy` để khóa nhất quán những điều khiển đổi ngữ cảnh/chọn ảnh, hoặc vô hiệu hóa kết quả tác vụ cũ theo ngữ cảnh/thế hệ. Tác vụ cũ cũng không được xóa trạng thái busy/lỗi của tác vụ mới.
- **Regression:** chuyển tab khi ảnh chưa xong; đổi sang sách mới; chọn hai ảnh hoàn tất ngược thứ tự. Chỉ ảnh thuộc đối tượng/lần chọn hiện hành được xuất hiện và đưa vào payload.

## Findings cũ

| Finding 21/10 | Kết quả đối chiếu hiện tại |
|---|---|
| S1: case badge HELD/BORROWED trùng | Đã sửa trong source; switch hiện chỉ có một nhánh cho từng trạng thái canonical |
| F1: query mở demo khi cấu hình tắt | Initializer/effect/nút đổi chế độ đã có guard `demoAllowed`; không còn là finding mở trong phần source đã rà |
| F2: phiếu mobile thiếu trạng thái | Source mobile đã có PARTIAL_SETTLED, PENDING_DEPOSIT, isLost và returnedAt tại khoảng 3600–3620; chưa dựng các phiếu này trên browser local để nghiệm thu từng trạng thái |

## Kiểm chứng thực tế

- `pnpm run check`: 179 file, 0 error/warning/hint. Log `review-20261022-check.log`.
- Unit: 371/371 đạt, không skip. Lần đầu sandbox chặn Node spawn EPERM; chạy lại ngoài sandbox đạt. Log `review-20261022-unit.log`.
- PostgreSQL: 17/17 đạt từ `publishing.test.ts`, `readers.test.ts`, `reader-library.test.ts`. Chỉ dùng database disposable `127.0.0.1:55433/ysbk_test_local` qua guard và runner có sẵn; không reset `ysbk_local`. Log `review-20261022-pg.log`.
- Build beta/demo=false: 6 trang đạt. Output riêng `.review-artifacts/review-20261022-dist`, không thay thư mục dist đang phục vụ web. Log `review-20261022-build.log`.
- Hai controlled probe bên trên đều tái hiện được lỗi. Probe ghi lịch sử lỗi; không sửa chúng để giả thành kết quả đạt.
- Browser Brave: danh mục 4 sách thật local, modal tóm tắt có ba nút; đặt khi chưa có reader mở modal tài khoản. 320×740: modal nằm trong viewport, Tủ sách và màn quản trị nội dung không tràn ngang toàn trang. Có kiểm tra PC ở kích thước browser thường. Chưa chạy đủ mọi breakpoint/module trong handoff Stitch.
- Đăng nhập tài khoản admin kiểm thử local để chỉ xem màn quản trị, không submit form nghiệp vụ; kết thúc đã xác nhận `/api/v1/auth/me` trả `UNAUTHENTICATED`. Đã reset viewport và đóng tab kiểm thử tạo thêm.
- Ảnh: `review-20261022-mobile-summary.jpg`, `review-20261022-mobile-signin.jpg`, `review-20261022-internal-mobile.jpg` trong `.review-artifacts`.

## Kết luận

Cần sửa UI-01 và UI-02 trước nghiệm thu phần này. Không phát hiện P1 trong phạm vi đã kiểm tra. Bộ test đạt không bao phủ hai tình huống lỗi vừa tái hiện. Chưa nghiệm thu toàn bộ nghiệp vụ tiền/quầy, mọi màn hình responsive, OAuth Google thật, Cloudflare Access, cloud, thiết bị thật hoặc tải thực tế. Google/cloud chưa được cấu hình là gate đã biết, không phải finding mới của Antigravity.

Prompt thực hiện: `docs/prompts/antigravity-next/2026-10-22-ui-review-fixes.md`.
