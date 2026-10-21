# Review Antigravity — 21/10/2026

## Phạm vi và bằng chứng

Workspace `F:\Codex Project\YSBK`, nhánh `main`, HEAD `b9d568b4c4ba9c8d390fef3bb80f7abce52b8abb`. Review working tree tracked/untracked so với HEAD; không thể quy mọi dòng chưa commit cho một tác giả. Đọc SESSION-HANDOFF, CURRENT-STATE, đặc tả UI mềm và public-portal-publishing. Hai lượt Standards/Spec thực hiện tuần tự, không subagent. Yêu cầu tài khoản bạn đọc mới được ghi riêng, không hồi tố thành lỗi của implementation cũ.

Kiểm chứng trước thay đổi tài khoản:

- `pnpm run check`: 165 files, 0 lỗi/warning/hint.
- `pnpm run test:unit`: 353/353. Sandbox ban đầu chặn Node spawn EPERM; chạy lại ngoài sandbox đạt. Log `.review-artifacts/review-20261021-unit.log`.
- Hai file integration `publishing.test.ts`, `reservation-flow.test.ts`: 19/19 PostgreSQL, không skip. Chỉ dùng database disposable `127.0.0.1:55433/ysbk_test_local`, qua guard hiện có. Log `.review-artifacts/review-20261021-pg.log`.
- Build beta với biến môi trường local, `PUBLIC_DEMO_CONTENT=false`: 6 trang, đạt. Không deploy. Log `.review-artifacts/review-20261021-build.log`.
- Browser local: đọc danh mục thật; phát hiện bundle cũ hơn source, build lại rồi tái hiện đường demo dưới đây. Chưa kiểm tra hết module/mobile bằng browser.

## Standards

### S1 — P3: nhánh switch trùng, theme mới không được chạy

`src/components/ReservationSection.tsx:380-397` thêm lại `HELD`/`BORROWED` sau các case đã return ở 359/366. JavaScript luôn chạy nhánh đầu, nên hai nhánh mới không có tác dụng. Đây là duplicated code/dead code theo baseline review; TypeScript check hiện không phát hiện.

Sửa vào case gốc, xóa case trùng và trạng thái `PENDING` không thuộc ReservationStatus nếu không có nguồn hợp lệ. Regression: render badge cho từng trạng thái canonical, xác nhận mỗi trạng thái có một nhãn. Ảnh hưởng liền kề: xác nhận đơn và tra/hủy đơn dùng cùng badge.

## Spec

### F1 — P2: query mở lại fixture demo khi build đã tắt demo

`src/components/InternalWorkspace.tsx:58-64`, `:493-495`: initializer và effect nhận `?mode=demo` vô điều kiện. Chúng bỏ qua `PUBLIC_DEMO_CONTENT=false`; effect chế độ DEMO bỏ bước xác thực. Đặc tả yêu cầu ranh giới demo và quyền hiện có được giữ.

Tái hiện browser sau build local tắt demo: chưa đăng nhập, mở `http://127.0.0.1:4321/noi-bo/?mode=demo`, thấy sidebar nghiệp vụ, phiếu và số liệu fixture. Chưa thấy đường này cấp quyền đọc database thật; không mô tả thành lộ dữ liệu thật.

Sửa cả hai lối đọc query và lối chuyển chế độ, chỉ cho demo khi cấu hình cho phép. Regression: build tắt demo, cả URL thường/query đều yêu cầu xác thực; build demo cho phép phải tiếp tục tách khỏi API thật. Phần này phải được xử lý khi khóa lối vào nội bộ.

### F2 — P2: phiếu mobile mất trạng thái cần cho nghiệp vụ

`src/components/InternalWorkspace.tsx:3562-3582`: bản mobile mới chỉ có badge ACTIVE/RETURNED, bỏ PENDING_DEPOSIT/PARTIAL_SETTLED; từng sách cũng mất dấu isLost/returnedAt mà bảng PC ở 3435-3436 vẫn có. Với phiếu chuyển tiếp hoặc có sách đã mất/trả, điện thoại hiển thị tên/cọc mà không phân biệt nghĩa vụ còn lại. Đặc tả UI yêu cầu phiếu mobile giữ ID, trạng thái, tiền và hành động; không thay nghĩa nghiệp vụ.

Sửa bản mobile để giữ đủ trạng thái phiếu và từng bản sách. Regression: cùng fixture gồm ACTIVE, PENDING_DEPOSIT, PARTIAL_SETTLED, lost/returned item ở PC/mobile phải cho cùng thông tin nghiệp vụ. Bằng chứng hiện tại là đối chiếu source/diff; chưa tái hiện những trạng thái này trên điện thoại thật.

## Giới hạn

Chưa chạy toàn bộ integration, toàn bộ browser UAT, cloud/Google OAuth thật, tải hoặc thiết bị thật. UI còn nhiều chữ 10–12px và control chưa đạt kích thước đặc tả; cần vòng nghiệm thu responsive riêng, không suy PASS từ build/unit. Không tự sửa các vấn đề UI ngoài phạm vi tài khoản/lối vào nội bộ.

Standards: 1 finding, mức cao nhất P3. Spec: 2 findings, mức cao nhất P2. Kết quả: cần sửa trước nghiệm thu UI.

## Theo dõi sau triển khai tài khoản trong cùng chat

F1 đã được sửa tại hai lối đọc query và hai nút chuyển chế độ: demo chỉ bật khi `PUBLIC_DEMO_CONTENT=true`. Build local với demo=false đã loại đường query khỏi bundle; HTTP xác minh đúng bundle được runtime 4321 phục vụ. Browser cuối bị tắt trong Work settings nên chưa có ảnh/browser proof sau sửa. S1 và F2 vẫn mở, không gộp vào phần tài khoản. Bằng chứng tài khoản mới và các gate provider/cloud nằm trong [runbook](../technical/reader-accounts-local-and-access.md).
