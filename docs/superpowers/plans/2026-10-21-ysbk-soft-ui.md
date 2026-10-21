# YSBK Soft UI Implementation Plan

## Trạng thái kế hoạch khi chuyển chat

Đã có thay đổi UI trong workspace sau khi lập kế hoạch: `src/styles/ui.css`, global import, theme/component và ảnh `docs/mockups/qa-evidence-2026-10-21/`. Chưa review đầy đủ hoặc xác nhận mọi checkbox bên dưới trong lượt handoff; không tự đánh dấu PASS hay làm lại từ đầu. Đọc [session handoff](../../SESSION-HANDOFF.md) và [trạng thái hiện hành](../../CURRENT-STATE.md).

Tiếp theo là thảo luận UX đặt/hủy ở chat mới. Tài khoản bạn đọc, “Sách của tôi”, đổi sách và thay IP chưa thuộc phạm vi triển khai đã duyệt. Các ràng buộc giữ chức năng/API/tiền/quyền của kế hoạch này vẫn có hiệu lực nếu tiếp tục UI theo chỉ dẫn mới.

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Không dùng subagent: người dùng chưa cho phép; các bước dưới đây làm tuần tự trong phiên Antigravity.

**Goal:** Triển khai giao diện mềm, hoài niệm đã duyệt cho toàn bộ màn hình công khai và nội bộ, giữ nguyên chức năng hiện có.

**Architecture:** Dùng token/class có phạm vi làm nền, sửa markup theo từng nhóm luồng trong các component hiện có. Giữ data fetching, handlers, hợp đồng API và các chặn quyền; không rewrite monolith hoặc backend để đổi theme.

**Tech Stack:** Astro, React, Tailwind hiện có, lucide-react; không thêm UI framework.

## Global Constraints

- Đặc tả: `docs/mockups/stitch-ui-2026-10-21/HANDOFF.md`.
- Giữ palette, tên CLB và slogan; nút/input 14px, card 22px, modal 24px, tab 15px, bìa 4px.
- Không sửa database, nghiệp vụ, quyền, tài chính, private token, Turnstile, idempotency.
- Không commit/push/deploy hoặc chạy destructive database commands trong phạm vi prompt này.
- Bảo toàn dirty work; không dùng subagent. Không coi output demo/Stitch là dữ liệu sản phẩm.

## Task 1 — Nền UI dùng chung và baseline

**Files:** `tailwind.config.mjs`, `src/styles/global.css`; đề xuất thêm `src/styles/ui.css`. Đọc `package.json`, `src/lib/api-client.ts` để giữ contract; không đổi API client chỉ vì đổi hình thức.

**Consumes:** palette/fonts và component states trong HANDOFF. **Produces:** class UI dùng được trong component hiện tại, không global override kiểu concept.

- [ ] Ghi branch/HEAD/status; chạy baseline check/unit, tách lỗi sẵn có khỏi lỗi mới. Lưu ảnh landing/public/quầy trước sửa.
- [ ] Định nghĩa token và class scoped, ví dụ:

```css
.ysbk-ui { --ui-control-radius:14px; --ui-card-radius:22px; --ui-modal-radius:24px; }
.ui-button { border-radius:var(--ui-control-radius); min-height:44px; }
.ui-card { border:1px solid #DCDED0; border-radius:var(--ui-card-radius); box-shadow:0 5px 18px rgba(53,72,60,.08); }
.ui-button:focus-visible { outline:3px solid #9B4D36; outline-offset:3px; }
@media(max-width:767px) { .ui-button { min-height:48px; } }
```

- [ ] Bổ sung đầy đủ trạng thái button/input/badge/table/dialog, typography và reduced-motion theo HANDOFF; import stylesheet qua cơ chế global hiện có.
- [ ] Kiểm tra mẫu button/field/card ở hai kích thước; focus nhìn được, disabled khác loading, ảnh bìa không bị bo 22px.

## Task 2 — Luồng bạn đọc và đăng nhập

**Files:** `PublicPortal.tsx`, `ReservationSection.tsx`, `src/pages/login.astro`, `src/pages/sach/[id].astro`, `src/pages/404.astro`, các page wrapper liên quan nếu cần class scope.

**Consumes:** UI primitives Task 1, props và handlers hiện có. **Produces:** public hub/detail/reservation/lookup/login đồng nhất, cùng contract cũ.

- [ ] Áp dụng mẫu 01–04, 07, 09–10 vào đúng vùng component; giữ sáu tab, phân trang 50, filter và state.
- [ ] Giữ toàn bộ trường và validation; `studentId`/`email` vẫn tùy chọn. Không chuyển lookup sang SĐT.
- [ ] Thử API chậm/lỗi/rỗng/hết bản/thiếu mô tả/thiếu ảnh; không dựng mock fallback. Giữ input khi submit lỗi.
- [ ] Thử Turnstile, tạo → copy mã → tra → hủy với dữ liệu QA; kiểm tra token hash và refresh tồn. Không đưa mã thật vào screenshot.
- [ ] Chạy check/unit và smoke local phù hợp; chụp desktop/mobile.

## Task 3 — Landing và điều hướng ngoài cuốn sách

**Files:** `BookLanding.astro`, `src/styles/book-landing.css`, `src/pages/index.astro` nếu cần wrapper.

**Consumes:** asset/timeline/handlers hiện có, UI primitives. **Produces:** chrome và phần sau sách theo nhận diện; cuốn sách giữ hành vi đã duyệt.

- [ ] Chỉ đổi nút, caption/chrome, hướng dẫn mượn và liên kết cuối sách; tránh style scope làm bo/cắt canvas, SVG hoặc trang sách.
- [ ] Chạy test `book-navigation`, `book-landing`, `page-curl` trong suite hiện có.
- [ ] Browser: mở bìa → bìa phụ → giới thiệu → chương xa → đảo ngược; cuộn từ trang cuối sang hướng dẫn và mở đủ tab công khai. Kiểm tra reduced-motion.

## Task 4 — Shell nội bộ, quầy, kho và các dialog

**Files:** `InternalWorkspace.tsx`; stylesheet Task 1. Không thay các service/DTO để làm layout.

**Consumes:** actor/role và dữ liệu hiện có. **Produces:** sidebar/drawer/bottom navigation, bảng PC và phiếu mobile, dialog truy cập được.

- [ ] Lần lượt sửa shell rồi `quay-sach`, `kho-sach`, `ban-sach`; dùng mẫu 05/06/08. Kiểm tra không làm mất tab con/dialog và handler.
- [ ] Đảm bảo table đủ cột tên sách; ghi chú/cảnh báo nằm dưới hoặc drawer. Mobile chuyển phiếu có ID, trạng thái, tiền và action.
- [ ] Đi qua giữ chỗ/bàn giao/nhận trả/hoàn cọc/return một phần/gia hạn/mất-hỏng, quote/confirm và mở/đóng ca theo chức năng thật. Không tự sửa số tiền để ảnh đẹp.
- [ ] Kiểm tra modal bằng Tab/Shift+Tab/Escape/đóng/trả focus; nút loading khóa double submit. Thêm regression test chỉ khi có logic tương tác mới, không viết test chỉ so chuỗi CSS.
- [ ] Chạy unit/check và integration liên quan nếu đổi hành vi; integration chỉ qua test DB guard hiện có.

## Task 5 — Nhân sự, lịch, tuyển, sự kiện, kiểm duyệt, tài chính và admin

**Files:** các vùng `thanh-vien`, `truc-sach`, `tuyen`, `su-kien`, `kiem-duyet`, `tai-chinh`, `bao-cao`, `admin`, `cuu`, `dashboard` trong `InternalWorkspace.tsx`; `PublishingManager.tsx`, `MembershipManager.tsx`.

**Consumes:** shell/primitives và quyền server. **Produces:** tất cả hàng của bảng màn hình HANDOFF có implementation.

- [ ] Nhân sự theo mẫu 12; lịch/công việc theo 14; tài chính/báo cáo theo 13; form admin theo 11. Giữ đủ action có sẵn cho từng actor.
- [ ] Upload/sửa sách: summary/cover/barcode; sửa metadata không đổi bản đang mượn/giữ. Lịch có đơn phải bị chặn đúng thông báo hiện có.
- [ ] Kiểm tra nháp/mở/đóng tuyển; CTV chưa đủ tháng/đủ tháng nhưng chưa đạt/đủ tháng và đạt; chuyển cựu khác xóa CTV.
- [ ] Tài chính phân biệt cọc/quỹ/doanh thu, trạng thái ca, ngày/kỳ, bản báo cáo rỗng và export lỗi. Không cộng tiền từ hàng đang phân trang để giả tổng server.
- [ ] So từng module trong HANDOFF với giao diện; ghi tên màn hình và screenshot tương ứng, không bỏ phần ít dùng/cựu thành viên.

## Task 6 — Nghiệm thu toàn bộ

- [ ] `pnpm run check`: không lỗi Astro/TypeScript.
- [ ] `pnpm run test:unit`: tất cả test hiện tại đạt; ghi tổng thực tế.
- [ ] `pnpm run build`: thành công; không dùng build làm bằng chứng API.
- [ ] `pnpm run local:smoke`: đạt khi runtime sẵn sàng; nếu không chạy được ghi đúng blocker. Không reset DB để làm test xanh.
- [ ] Kiểm tra 1440×1000, 768×1024, 390×844, 320×740, tên dài, font tải chậm, bàn phím và giảm chuyển động. Đo tương phản các cặp chữ/nền thực tế.
- [ ] Đối chiếu đủ bảng màn hình HANDOFF; báo file, ảnh, test và phần chưa kiểm chứng. Giữ web cổng 4321 cho người dùng; chờ chỉ dẫn riêng về commit/push/deploy.
