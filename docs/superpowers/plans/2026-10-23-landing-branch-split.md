# Kế hoạch tách nhánh landing — 23/10/2026

> Thực hiện tuần tự trong chat hiện tại; người dùng không cho phép subagent. Commit chỉ trên hai nhánh đã yêu cầu. Không push, deploy hoặc đổi database.

**Mục tiêu:** lưu landing preview hiện tại thành nhánh độc lập, tạo nhánh sản phẩm thương mại từ đó và giữ main dành cho web-app.

**Kiến trúc:** reuse renderer/ảnh/CSS đã có, chỉ bỏ cây file và dependency web-app trong worktree riêng. Giữ cùng output bảo vệ preview và kiểm thử hồi quy. Không làm lại UI trong bước tách.

**Công nghệ:** Astro, Tailwind hiện có, vanilla JS, Node tests và pnpm lockfile; không thêm dependency.

- [x] Đọc handoff/current-state/landing/mobile, kiểm kê main và sao lưu 62 file dirty bằng SHA256.
- [x] Chạy baseline 26 test landing; build gốc 1 trang/78 file và giữ output đối chiếu.
- [x] Tạo worktree managed và nhánh codex/landing-preview từ HEAD đã xác minh.
- [x] Copy đúng file landing mới nhất; bỏ mã ứng dụng, dữ liệu/schema, backend và config khỏi nhánh phụ.
- [x] Rút dependency, lockfile/config/script; giữ renderer và CSS/ảnh đã duyệt.
- [x] Unit, build, artifact, check; so nguồn/tài nguyên và browser trước/sau.
- [ ] Review tree/diff, commit snapshot landing trên preview; không cập nhật ref main.
- [ ] Tạo codex/landing-template từ commit preview và lưu kế hoạch, quyết định, câu hỏi thương mại.
- [ ] Xác minh main HEAD và dữ liệu không thay, đối chiếu các file dirty với backup trước khi xử lý việc chuyển WIP.
