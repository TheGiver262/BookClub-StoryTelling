# Prompt Antigravity — sửa hai lỗi review ngày 22/10/2026

Tiếp tục dự án tại `F:\Codex Project\YSBK`. Hãy sửa code và kiểm thử, không chỉ viết kế hoạch. Đọc AGENTS.md áp dụng, `docs/CURRENT-STATE.md`, `docs/SESSION-HANDOFF.md`, rồi `docs/reviews/2026-10-22-antigravity-followup.md`.

Workspace hiện có nhiều sửa đổi chưa commit của nhiều lượt. Giữ toàn bộ chỉnh sửa đang có; không reset/clean/stash, commit/push/deploy, sửa global config hoặc dùng subagent. Không sửa landing cuốn sách đã duyệt. Giữ thiết kế Stitch, nút bo cong, chính sách tài khoản Google bắt buộc và các guard quyền hiện tại. Google/cloud chưa có cấu hình: không thêm tài khoản giả hoặc bỏ auth để làm test xanh.

## 1. UI-01 — không bỏ qua trang review tải lỗi

Tại `src/components/PublicPortal.tsx:98` và `:292`, nút “Xem thêm đánh giá” tăng trang trước khi request thành công. Nếu trang 2 lỗi, lần bấm sau gọi trang 3 và bỏ mất 50 review.

Sửa để chỉ xác nhận trang đã tải sau thành công hoặc thử lại đúng trang lỗi. Tái sử dụng cách xử lý phù hợp đã có trong `morePublicReviews()`, không viết thêm framework. Giữ thứ tự CLB trước, append chống trùng, loading và lỗi rõ ràng. Request cũ không được cập nhật nhầm cuốn sách/modal mới.

Regression bắt buộc: 150 review, trang 2 lỗi lần đầu; lần bấm sau gọi lại trang 2, sau đó tải đủ 150 review, không thiếu/trùng. Kiểm tra đổi sách/đóng modal trong lúc tải.

## 2. UI-02 — không dùng nhầm ảnh giữa các form/đối tượng

Tại `src/components/PublishingManager.tsx:54–63`, chọn ảnh cho sách rồi chuyển sang tuyển thành viên khi ảnh còn xử lý sẽ đưa kết quả ảnh cũ sang form tuyển. `image` dùng chung và tab vẫn bấm được khi busy.

Sửa ở chỗ quản lý tác vụ/ngữ cảnh: khóa nhất quán control đổi tab/đổi đối tượng/chọn ảnh khi cần, hoặc vô hiệu hóa kết quả cũ theo ngữ cảnh/lần chọn. Tác vụ cũ không được ghi đè ảnh, lỗi hoặc busy của tác vụ mới. Giữ nguyên nén ảnh, giới hạn định dạng/kích thước và transaction server.

Regression bắt buộc: đổi tab trong lúc xử lý ảnh; chuyển sang thêm sách mới; chọn hai ảnh rồi hoàn tất ngược thứ tự. Chỉ ảnh thuộc đối tượng/lần chọn hiện tại xuất hiện và đi vào payload.

## 3. Kiểm chứng và bàn giao

- Đọc hai probe `.review-artifacts/review-20261022-review-pagination.mjs` và `review-20261022-image-race.mjs` cùng JSON để hiểu counterexample. Không sửa/xóa probe hoặc log lịch sử để biến lỗi thành PASS. Thêm regression trong suite phù hợp, thể hiện fail trước/pass sau; dùng công cụ có sẵn.
- Chạy check, unit và build. Nếu đổi contract/service, chạy thêm integration liên quan qua guard hiện có, chỉ trên `ysbk_test_*`; tuyệt đối không reset hoặc dùng `ysbk_local` làm database test. Không chạy migration lên dữ liệu thao tác trong đợt sửa UI này.
- Kiểm tra browser PC/mobile các đường vừa sửa, tối thiểu 320px, 390px và PC; giữ modal trong viewport và lưu ảnh bằng chứng không chứa token/PII. Không coi screenshot hoặc mock là chứng minh Google/cloud/concurrency thật.
- Giữ các sửa cũ đã đúng: badge không trùng, trạng thái phiếu mobile đầy đủ, demo guard, bookmark theo tài khoản, review chỉ chữ/PENDING và chỉ ADMIN duyệt.
- Báo cáo file thay đổi, nguyên nhân/sửa từng ID, lệnh và kết quả thật, ảnh, gate chưa kiểm tra. Cập nhật một handoff ngắn để Codex review lại. Không tự mở rộng tính năng hoặc đổi nghiệp vụ.
