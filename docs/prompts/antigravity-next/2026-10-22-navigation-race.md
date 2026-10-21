# Prompt Antigravity — chặn lookup cũ mở nhầm modal

Review tiếp dự án F:\Codex Project\YSBK. Đọc AGENTS.md, docs/SESSION-HANDOFF.md, docs/CURRENT-STATE.md và docs/reviews/2026-10-22-antigravity-generation-followup.md. Hãy sửa và kiểm thử, không chỉ lập kế hoạch.

Giữ mọi thay đổi chưa commit, đặc biệt landing mà người dùng vừa chốt. Không reset/clean/stash, commit/push/deploy, sửa global config, dùng subagent hoặc chạy migration/reset database. Chỉ sửa luồng lookup mở modal và test liên quan; không mở rộng giao diện/nghiệp vụ.

1. P2: trong src/components/PublicPortal.tsx, sync() của popstate và openReviewBook() await listPublicReservationBooks rồi gọi openPanel mà không xác nhận ý định còn hiện hành. Review generation hiện tại chỉ bảo vệ request review sau khi modal mở. Lookup cũ trả về muộn vẫn mở modal sai sách hoặc mở lại sau khi người đọc chuyển tab/đóng cửa sổ.

   Tái hiện bằng `node --experimental-strip-types .review-artifacts/review-20261022-navigation-race.mjs`. Giữ probe/JSON lịch sử, không sửa để giả PASS. Thêm lifecycle/generation nhỏ cho các lookup mở modal, kiểm tra sau await trước mọi cập nhật success/error. Ý định mới (popstate, mở/đóng modal, đổi tab) phải vô hiệu hóa lookup cũ. Tránh để cleanup effect review vô tình hủy lookup mới hợp lệ; không thêm dependency/framework.

   Regression với handlers/effect thật: Back A → Forward B, trả B trước A; lookup A chờ rồi mở B và đóng B; Góc review mở sách A rồi chuyển Lịch trực. Thử resolve/reject cũ ở nhiều thứ tự. Assert URL, activeTab, focusedBook/panel, errors/loading đúng ý định mới nhất; request cũ không ghi state hay mở modal. Giữ 6 test generation/retry/ảnh trước đó.

2. P3: bỏ hai fallback ghi globalThis.reviewSessionRef ở effect trang 1 và moreBookReviews; component thật luôn có useRef. Bổ sung reviewSessionRef vào harness cũ còn thiếu, không giữ nhánh production riêng để mock chạy xanh.

Chạy check, toàn unit và beta build. Chỉ cần PostgreSQL nếu sửa contract/service; không dùng DB thao tác để test. Browser PC/mobile nếu quyền hoạt động; nếu vẫn disabled, ghi đúng blocker và tách source/probe khỏi browser proof. Báo file sửa, lệnh/kết quả thật và cập nhật handoff ngắn; không sửa log lịch sử.
