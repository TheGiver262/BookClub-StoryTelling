# Handoff — landing preview độc lập, 23/10/2026

Đọc [CURRENT-STATE](CURRENT-STATE.md), [verification](BRANCH-SPLIT-VERIFICATION.md) và [runbook](technical/landing-netlify-preview.md).

Nhánh này chỉ duy trì giao diện preview CLB đã duyệt. Nhánh main chứa ứng dụng đầy đủ; nhánh `codex/landing-template` chứa kế hoạch thương mại. Không merge toàn nhánh, không lấy tài liệu app đã bỏ làm hợp đồng cho landing. Shared CSS được giữ để giảm thay đổi hình ảnh khi tách; không kèm React, database hay route ứng dụng.

Nếu cập nhật preview: sửa ở nhánh này, chạy unit/build/artifact/check, kiểm tra browser rồi chỉ deploy output khi người dùng yêu cầu. Giữ site cũ, không tự kết nối Git CD. Không sao chép credential, dữ liệu local, Excel hay dump vào branch.

Prompt tiếp nối: “Tiếp tục codex/landing-preview. Đọc docs/SESSION-HANDOFF.md và CURRENT-STATE.md. Giữ hình ảnh/mobile đã duyệt. Chỉ sửa landing; không chạm main hay ứng dụng quản lý. Xác minh branch, runtime, kiểm thử và phạm vi deploy trước thao tác.”
