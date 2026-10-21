# Prompt Antigravity — chặn kết quả review từ phiên modal cũ

Tiếp tục tại F:\Codex Project\YSBK. Đọc AGENTS.md, docs/SESSION-HANDOFF.md, docs/CURRENT-STATE.md và docs/reviews/2026-10-22-antigravity-ui-fixes-recheck.md.

Chỉ sửa finding P2 về request đánh giá khi đóng/mở lại cùng sách. Giữ mọi chỉnh giao diện đang làm, không reset/clean/stash, không commit/push/deploy, không dùng subagent. Không sửa landing cuốn sách, nền thử mới hoặc global config.

Trong src/components/PublicPortal.tsx, moreBookReviews chỉ so panelRef + focusedBookRef. Request trang 2 cũ có thể được nhận khi người đọc đã đóng rồi mở lại sách A; catch/finally cũ cũng có thể sửa error/loading của phiên mới. Probe tái hiện: node .review-artifacts/review-20261022-reopen.mjs; giữ bằng chứng lịch sử, không sửa probe để biến thành PASS.

Thêm generation/invalidation nhỏ cho phiên review, dùng chung effect trang 1 và tải thêm. Mọi success/catch/finally của request chỉ được cập nhật khi generation còn hiện hành. Bao phủ open/close modal, đổi sách, đổi tab và history/popstate. Giữ retry đúng trang lỗi, chống trùng và thứ tự CLB trước; không thêm framework/dependency hoặc đổi API.

Regression bằng TSX thật: giữ trang 2 chờ, đóng rồi mở lại A, resolve request cũ trước/sau trang 1 mới; danh sách/trang/loading/error phiên mới không bị request cũ tác động. Thêm A→B→A và reject request cũ. Giữ 5 test cũ và đăng ký test mới trong test:unit.

Chạy check, unit, beta build; kiểm tra browser nếu quyền đang hoạt động. Nếu bị chặn, báo đúng blocker, không coi mock/source test là nghiệm thu browser. Không chạy migration hoặc reset database thao tác. Báo file sửa, kết quả thực và giới hạn còn lại.
