# Review bản sửa generation của Antigravity — 22/10/2026

Antigravity đã thêm reviewSessionRef để loại kết quả đánh giá từ phiên modal cũ. Các đường success/catch/finally của trang 1 và tải thêm cùng kiểm tra generation; handler mở/đóng, đổi tab và popstate có invalidation. Bộ test bổ sung đóng/mở lại A, A→B→A và lỗi cũ trả về sau phiên mới.

Phạm vi: follow-up thay đổi chưa commit trên main, HEAD b9d568b4c4ba9c8d390fef3bb80f7abce52b8abb; ưu tiên finding chưa giải quyết và callers liên quan, không lặp toàn bộ audit. PublicPortal.tsx và ui-review-fixes.test.ts đổi hash so snapshot recheck trước. PublishingManager.tsx không đổi so recheck đó. InternalWorkspace, ReaderSession, publishing service và member lifecycle không đổi so snapshot review gốc ngày 22/10. ReservationSection có sửa đổi UI sau snapshot gốc, không quy toàn bộ diff với HEAD là thay đổi mới. Giao diện landing chủ sản phẩm vừa chốt được giữ nguyên. Giả định nhiều bạn đọc truy cập độc lập; finding chính xảy ra ngay trong một trình duyệt khi các request trả về khác thứ tự.

## 1. Cần sửa — P2: tra cứu trước modal vẫn nhận kết quả điều hướng cũ

Vị trí: `src/components/PublicPortal.tsx:75–83` và `:147–148`.

`sync()` tăng reviewSessionRef trước khi await listPublicReservationBooks, nhưng sau await chỉ kiểm tra biến active của cả vòng đời effect. Hai popstate cùng effect đều có active=true. `openReviewBook()` cũng không kiểm tra ý định hiện hành sau await. Sau đó openPanel() lại tăng generation, khiến lookup cũ được coi là một phiên modal mới hợp lệ. Guard tải review không chặn được lỗi xảy ra trước bước đó.

Đã tái hiện bằng controlled promise trích effect và handlers TSX thật, dùng readerLocation/bookIntent thật:

- Back sang A, Forward sang B; lookup B xong trước, A xong sau: URL sach=B nhưng modal focusedBook=A.
- Lookup URL A đang chờ; mở chi tiết B rồi đóng B; A trả về và tự mở lại modal review, dù URL không còn sách.
- Trong Góc review bấm xem sách A, chuyển sang Lịch trực trước khi lookup xong: activeTab=hoat-dong nhưng request cũ mở modal A và ghi URL tab=sach.

Probe: `.review-artifacts/review-20261022-navigation-race.mjs`, kết quả cùng tên `.json`. Đây là bằng chứng source với thứ tự request kiểm soát, chưa phải browser/network thật.

Sửa nhỏ: vô hiệu hóa các lookup mở modal theo ý định điều hướng; sau await phải xác nhận request vẫn là request hiện hành trước khi gọi openPanel hoặc ghi lỗi. Bao phủ cả sync/popstate và openReviewBook; việc mở/đóng modal, đổi tab hoặc URL mới phải vô hiệu hóa lookup cũ. Không tái sử dụng mù counter review hiện tại: cleanup của effect review cũng tăng counter, có thể vô tình hủy chính lookup hợp lệ. Một ref/cơ chế hủy nhỏ theo lifecycle điều hướng là đủ, không thêm framework/dependency.

Regression: ba ca trên, resolve/reject request cũ trước/sau request mới. Assert đồng thời URL, activeTab, focusedBook/panel, error và loading. Giữ các regression generation/retry/ảnh đã có.

Nếu bỏ qua: người đọc có thể nhìn nhầm cuốn sách hoặc bị mở lại cửa sổ sau khi đã chuyển tác vụ. Chưa có bằng chứng vượt quyền hay sửa dữ liệu server từ lỗi này.

## 2. Nên dọn — P3: fallback globalThis chỉ để phục vụ mock thiếu ref

Vị trí: `src/components/PublicPortal.tsx:101` và `:163`; hai test đầu trong `tests/unit/ui-review-fixes.test.ts` không khai báo reviewSessionRef trong context.

Trong component thật reviewSessionRef đã được useRef khởi tạo tại dòng 39, nên nhánh typeof undefined và ghi globalThis.reviewSessionRef không cần tồn tại. Những test context thiếu ref đi qua nhánh thay thế thay vì cùng hợp đồng hook như component thật. Đây là mã thừa cho test, không phải lỗi bảo mật đã chứng minh.

Sửa: dùng reviewSessionRef trực tiếp trong production và thêm ref vào các harness còn thiếu. Giữ test dùng cùng vòng đời/ref như component. Không đổi probe lịch sử để làm bằng chứng cũ thành PASS.

## Kiểm chứng

- 6/6 test ui-review-fixes đạt.
- Toàn suite unit: 380/380 đạt, 0 fail/skip. Log `.review-artifacts/review-20261022-generation-unit.log`.
- `pnpm check`: 182 file; 0 errors, warnings, hints; tsc kết thúc exit 0.
- Beta build demo=false/local=true: 6 trang, exit 0; output riêng `.review-artifacts/review-20261022-generation-dist`, không ghi đè dist đang phục vụ giao diện đã chốt.
- Snapshot source/test và manifest ở `.review-artifacts/review-20261022-generation-*`. Không sửa source ứng dụng trong lượt review.
- Browser inventory vẫn báo Local browser use is disabled in Work settings. Không có kiểm chứng UI trực tiếp trong lượt này. Không lặp PostgreSQL vì các service backend liên quan không đổi theo snapshot; Google OAuth thật, Cloudflare Access, tải thực tế và toàn bộ nghiệp vụ tiền/quầy chưa được nghiệm thu bởi lượt review này.

Kết luận: sửa finding 1 trước khi chốt; dọn finding 2 cùng lượt. Generation guard mới đã xử lý finding đóng/mở lại request review cũ trong phạm vi bộ regression hiện tại.

Prompt: `docs/prompts/antigravity-next/2026-10-22-navigation-race.md`.

## Bổ sung sau khi chủ sản phẩm yêu cầu sửa

Codex đã sửa cả P2 và P3 trong source. `bookLookupRef` tách khỏi reviewSessionRef, được tăng ở mỗi lookup/ý định điều hướng và cleanup; success/error chỉ cập nhật nếu lookup còn hiện hành. Không còn fallback globalThis. Giao diện JSX của PublicPortal giống snapshot trước sửa; không sửa file landing, bảo toàn CSS thanh cuộn đang có thay đổi ngoài lượt sửa này.

Thêm 7 test trong `tests/unit/reader-navigation-race.test.ts`: hai thứ tự Back/Forward, mở/đóng sách khác, đổi tab, kết quả/lỗi của hai lookup cộng đồng ở cả hai thứ tự, tab yêu cầu đăng nhập, cleanup review độc lập, lỗi hiện hành và unmount. Trước sửa 6/7 test đỏ đúng counterexample, sau sửa 13/13 test mới+cũ liên quan xanh. Harness cũ đã thêm ref, suite mới đăng ký trong test:unit.

Kiểm chứng cuối: unit 387/387 đạt, không skip; check 183 file, 0 lỗi/cảnh báo/hint; beta build 6 trang đạt. Bundle PublicPortal được phục vụ bởi `/sach/` khớp output build, không còn global review fallback. Log `.review-artifacts/navigation-fix-unit.log`, manifest `.review-artifacts/navigation-fix-manifest.json`. Không chạy lại DB; Browser Use vẫn disabled, chưa có browser proof cho các thao tác race. Không sửa probe/JSON lịch sử thành PASS.
