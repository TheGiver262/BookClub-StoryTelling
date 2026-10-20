# YSBK — Website quản lý câu lạc bộ sách

Bộ tài liệu khám phá sản phẩm v0.11, ngày 18/10/2026, múi giờ `Asia/Ho_Chi_Minh`.

**Review Chặng 12, 19/10/2026: PARTIAL.** [Review độc lập](docs/reviews/2026-10-19-stage12-followup.md) ghi S12-01..10 và đối chiếu S11/các chặng trước. Có API client/login và các sửa loss/selector/confirmation, nhưng DTO/catalog loader lệch server, FULL return thiếu selector, quầy chưa hoàn tất pending tiền, retry key mới, DEMO còn gọi live mutations và correction fine sai cột. Check/build,124 unit và22 Python tests pass; OpenAPI0 lỗi/22 cảnh báo;42 DB tests dừng setup, Workers spawn EPERM, browser bị tắt trong Work settings. Chưa dùng tiền/PII thật.

## Đọc theo thứ tự

1. [Khảo sát giải pháp có sẵn](docs/01-khao-sat-giai-phap.md): những gì có thể dùng, học hỏi và cần kiểm chứng.
2. [Phạm vi và mô hình nghiệp vụ](docs/02-pham-vi-va-nghiep-vu.md): chín nhóm chức năng, nguồn dữ liệu chuẩn, tiền cọc và giao dịch.
3. [Kiến trúc và hạ tầng thử nghiệm](docs/03-kien-truc-va-ha-tang.md): các phương án, hướng ưu tiên, giới hạn miễn phí và cách đo.
4. [Bảo mật, dữ liệu cá nhân và SEO](docs/04-bao-mat-du-lieu-seo.md): ranh giới công khai/nội bộ, chống lạm dụng, sao lưu và phục hồi.
5. [Roadmap và nghiệm thu](docs/05-roadmap-va-nghiem-thu.md): từ phỏng vấn đến sản phẩm đủ chín nhóm chức năng.
6. [Phỏng vấn và quyết định còn mở](docs/06-phong-van-va-quyet-dinh.md): ba nhóm câu hỏi mở đầu và các vòng tiếp theo.
7. [Đối chiếu tài liệu CLB](docs/07-doi-chieu-tai-lieu-clb.md): nội dung tài liệu người dùng gửi và cách xử lý quy tắc cũ khác phỏng vấn.
8. [Ma trận quyền và đăng nhập](docs/08-ma-tran-quyen-va-dang-nhap.md): quyền đã chốt, phạm vi hoạt động dành cho cựu và bài thử Auth bắt buộc.
9. [Khảo sát nhận diện YSBK](docs/09-khao-sat-nhan-dien-ysbk.md): nguồn thương hiệu, điều đã xác minh và giới hạn về logo/màu hiện hành.

Giao việc thiết kế ban đầu: [prompt chi tiết cho Antigravity](docs/prompts/antigravity-design.md), theo thứ tự khảo sát nhận diện → tạo `design.md` → dựng và kiểm UI prototype. Các hiện vật đã có cần được sửa theo review, không khởi tạo lại chỉ vì prompt cũ.

Giao việc hệ thống/backend ban đầu: [prompt kiến trúc, diagram và backend cho Antigravity](docs/prompts/antigravity-system-backend.md), gồm domain, schema SQL, API, transaction tiền, Auth/quyền, bảo mật/vận hành, diagram và PoC local. Hiện đã có tài liệu/diagram/draft; các lỗi và mức kiểm chứng được ghi trong review.

Sau khi Antigravity tạo prototype và bộ kỹ thuật: [review ngày 18/10/2026](docs/reviews/2026-10-18-antigravity-review.md) ghi các kiểm tra thực và 13 findings; [22 prompt sửa/triển khai theo chặng](docs/prompts/antigravity-next/README.md) bắt đầu từ typecheck/DB/Auth rồi đến từng nghiệp vụ. Các prompt này chưa được thực hiện trong lượt review.

## Quy ước

- **Đã yêu cầu:** lấy trực tiếp từ mô tả của chủ sản phẩm.
- **Đề xuất:** phương án để thảo luận, chưa mặc định áp dụng.
- **Cần xác nhận:** thiếu thông tin có thể làm thay đổi tiền, quyền, dữ liệu hoặc phạm vi.
- **Đã khảo sát:** đã đọc nguồn được dẫn; không có nghĩa đã chạy thử hoặc kiểm toán mã nguồn.

## Quyết định đã xác nhận trong phỏng vấn

- Phục vụ duy nhất CLB Sách Bách Khoa. Tương lai có thể bán các bản triển khai riêng cho CLB khác.
- Bản đưa vào dùng đầu tiên phải có đủ cả chín nhóm chức năng. Các giai đoạn roadmap là giai đoạn xây/kiểm thử, không phải phát hành thiếu module.
- Dùng cả điện thoại và laptop, mạng hiện ổn định.
- Miễn phí phần mềm cho CLB Sách Bách Khoa; CLB tự trả chi phí database/server phát sinh. Chưa có mức ngân sách được xác nhận.
- Tối đa hai quyển mỗi phiếu. Cọc từng quyển theo mức 50k gần nhất, mốc giữa làm tròn lên, tối thiểu 50k; giá 230k cọc 250k.
- Sách không có giá mặc định cọc 50k; giữ giá sách là chưa biết, không bắt buộc ước lượng và không ghi giá bìa giả 50k.
- Mất sách mất cọc. Phạt dưới cọc thì hoàn cọc và thu phạt riêng; từ mức cọc trở lên thì giữ cọc, không thu thêm. Đã xác nhận phiếu hai cuốn cọc 150k, phạt 60k thì hoàn 150k và thu 60k.
- Trả một phần lập phiếu mới cho sách còn giữ, bắt đầu lại 14 ngày và ba lần gia hạn; cần giữ liên kết lịch sử và chuyển cọc không tạo thu–hoàn giả.
- Phạt 1k/ngày trên cả phiếu: hai quyển cùng quá hạn ba ngày chỉ phạt 3k. Có thể giảm/miễn về 0 với lý do; tiền cọc và tiền thực thu–hoàn phải chính xác.
- Hạn mượn 14 ngày, đến hết ngày; trực thứ Ba và thứ Năm. Nếu ngày trực đến hạn rơi vào lịch nghỉ lễ/Tết thì dời tới buổi trực thực tế gần nhất tiếp theo, không tính phạt do phần dời đó.
- Cộng đúng 14 ngày lịch: mượn 1/10 → hạn 15/10. Gia hạn khi chưa quá hạn cộng từ hạn hiện tại, ví dụ tới 29/10; quá hạn thì chốt phạt rồi tính 14 ngày từ ngày gia hạn, vẫn trong giới hạn ba lần của phiếu.
- Nếu phạt dùng hết 150k cọc của phiếu cũ, trả cuốn cọc 50k và giữ cuốn cọc 100k: giữ 150k phạt, nhận mới 100k cọc cho phiếu mới; không chuyển tiếp khoản cọc đã dùng hết hoặc ghi thu tiền cũ lần nữa.
- Khi trả một cuốn và lập phiếu chuyển tiếp cho cuốn còn giữ, quyết toán ngay tiền phạt của phiếu cũ; phiếu mới không mang khoản phạt đó sang để thu lần nữa.
- Quy mô ước lượng vài nghìn sách, dưới 5.000; hai kho tại thư viện trường và văn phòng Hội Sinh viên; dưới 100 lượt mượn/trả mỗi buổi; tối đa 3–5 người cùng ghi. Dữ liệu cũ là sổ giấy và Excel.
- Bốn ban: Hậu cần, Nội dung, Truyền thông đối ngoại và Ban chủ nhiệm. Ban chủ nhiệm gồm chủ nhiệm, phó chủ nhiệm và trưởng/phó các ban chức năng.
- Mọi thành viên quản lý các mục nghiệp vụ; admin quản lý thêm tài khoản và nhật ký toàn hệ thống. Không chia quyền nghiệp vụ theo ban.
- Nhận cọc, hoàn cọc và thu phạt bằng tiền mặt hoặc chuyển khoản qua tài khoản riêng của CLB; được hoàn khác phương thức lúc nhận cọc. Thành viên phải kiểm tra tiền vào/ra trên app ngân hàng trước khi xác nhận; QR/loa ở bàn là phương tiện hỗ trợ có thể dùng, chưa yêu cầu website đồng bộ ngân hàng.
- Tiền mượn–trả tách riêng với quỹ hoạt động khác, theo dõi riêng cả hai. Tiền mặt mượn–trả cuối buổi để trong tủ sách khóa lại cho buổi sau.
- Mỗi buổi bàn sách dùng chung một hộp tiền; người trực chính kiểm và xác nhận đầu/cuối buổi, không đổi người giữ tiền giữa buổi. Người nhập giao dịch vẫn dùng tài khoản riêng.
- Buổi trực thứ Ba/thứ Năm từ 14:00–17:00 tại một địa điểm, nhiều bàn ghép; hai người chính phải cùng ở đủ ba giờ. Cả người chính và 3–5 hỗ trợ phải tham gia ít nhất 15 phút chuẩn bị/thu dọn đầu–cuối; tạm quy đổi 13:45–14:00 và 17:00–17:15. Người mới làm hỗ trợ để được đào tạo trước khi đủ điều kiện trực chính.
- Hậu cần tổng hợp lịch các trường thành một mẫu Excel đơn giản, đầy đủ rồi đưa lên web; website không làm khâu tổng hợp hoặc đọc từng mẫu trường. Có tự đề xuất và phân/chỉnh tay; lịch chốt xem trên web và soạn nội dung/link đăng Facebook; hợp đồng cột khóa khi có mẫu tổng hợp.
- Tuyển thành viên giữ Google Form, cho ứng viên chọn nhiều ban rồi sắp xếp ban phù hợp sau. Người được phân phỏng vấn chính tham gia chấm; bộ tiêu chí đã có và thay đổi theo từng năm, cần giữ phiên bản theo đợt tuyển.
- Đơn Form mới phải tự xuất hiện trên web, không chờ nhập file thủ công. Người phỏng vấn chấm riêng trước, hội đồng tổng kết sau; bài viết được chấm riêng/chung, điểm được sửa và phải giữ lịch sử.
- Hội phí hoạt động khoảng 100k/thành viên, đóng một lần duy nhất; ghi số tiền thực thu, không tự thu lại hằng năm.
- Khách xem web không cần tài khoản; muốn đánh giá/nhận xét/cảm nhận sách phải đăng ký miễn phí, nội dung chờ quản lý duyệt trước khi công khai.
- Sách cũ cho mượn không bán. Sách mới bán theo lô, nhận trước, không cọc hoặc cọc nhỏ, cuối đợt trả dư và thanh toán; có thể giữ lại bán tiếp. Chỉ CLB nợ nhà sách, khách phải trả ngay; không đặt trước và không đổi/hoàn cho khách đã mua. Lô 100 cuốn giá nhập 65k, bán 60/trả 40 thì trả nhà sách 3,9 triệu; không cọc thì không có khoản nhận hoàn 2,6 triệu. Nếu cọc 1 triệu, nhà sách hoàn riêng 1 triệu rồi CLB thanh toán riêng 3,9 triệu.
- Lịch trực xem trên web; website soạn sẵn nội dung/link để người phụ trách đăng nhóm Facebook, không cần tự đăng. Báo cáo có cả Excel và PDF.
- Khách đăng nhập Google hoặc email/mật khẩu. Thành viên/cựu thành viên dùng tên đăng nhập riêng + mật khẩu được quản lý cấp; không dùng đăng nhập Google để nhận quyền nội bộ. Cần chứng minh phương án Auth đáp ứng định danh này trước khi khóa stack.
- Có trạng thái cựu thành viên cho người ra CLB/tốt nghiệp: vẫn đăng nhập tài khoản nội bộ, chỉ xem hoạt động CLB; không xem thông tin cá nhân nhạy cảm, tài chính/số tài khoản, không xuất Excel/PDF và không thêm/sửa/xóa. Tách khỏi tài khoản bị khóa.
- Chủ sản phẩm đứng tên hạ tầng, giữ backup và nhận cảnh báo; không tự chuyển các quyền nhà cung cấp này cho ban chủ nhiệm khi đổi khóa.
- Đã đọc cấu trúc và một số vùng đầu của bảng tham chiếu “KẾ HOẠCH TUYỂN GEN 9”; dùng học cách chia công việc/ca phỏng vấn, không dùng mốc năm 2021 làm lịch triển khai hiện tại.

Mục tiêu đã chốt: khoảng một tháng cho MVP đủ chín nhóm, chủ sản phẩm tự phát triển/bảo trì với AI code chính. [Roadmap D1–D30](docs/05-roadmap-va-nghiem-thu.md) có các cổng D3/D10/D17/D24/D30, không bảo đảm tiến độ bằng giả định tăng tốc AI. Hướng kỹ thuật ưu tiên là Astro + React, Workers, PostgreSQL trên Supabase; Auth và runtime phải qua bài thử trước khóa lựa chọn cuối.

Mốc hiện tại (20/10/2026): Đã review và sửa luồng đặt sách công khai cùng các lỗi nối tiếp của quầy, migration, export và Workers local. Kết quả xác minh: 325 unit tests, 61 integration tests trên PostgreSQL disposable và 23 Python tests qua; check không có lỗi/cảnh báo/hint; build 10 trang tĩnh thành công. Xem [bàn giao mới](docs/technical/public-reservation-handoff.md) và [báo cáo review](docs/reviews/2026-10-20-public-reservation-final-repair.md).

Cổng còn mở: UAT trình duyệt bị chặn bởi Work settings; Auth/Turnstile với cấu hình thật, Workers cloud và routing production chưa nghiệm thu. Chưa deploy hay thay đổi dữ liệu thật. XLSX/PDF nhị phân vẫn trả 501 theo hợp đồng hiện tại.
---

## Hướng dẫn phát triển & Kiểm thử Local

### 1. Biến môi trường mẫu
Xem file `.env.example` tại thư mục gốc. Hệ thống không chứa bất kỳ secret hay credential thật nào:
```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/ysbk_local
SUPABASE_URL=https://example-project.supabase.co
SUPABASE_ANON_KEY=placeholder-anon-key
JWT_SECRET=ysbk_dev_jwt_secret_min_32_chars_placeholder_key!
```

### 2. Các lệnh kiểm thử & khởi chạy local (Sử dụng RTK Wrapper)
```powershell
# Chạy unit tests offline (DB guard, Auth policy, HTTP router, Secrets, Finance Ledger, Cash Sessions, Catalog, Borrowers, Issue, Return, Partial Return, Renewal & Calendar, Lost Book & Corrections, Desk UI Integration, Members & Dues, Availability Import, Roster Solver, Recruitment Webhook & Eval, Sales & Consignment Lots, Events, Public Content SEO, Reports & Audit, Backup & Restore, Circulation Quotes & Pending Queues)
rtk pnpm run test:unit

# Kiểm tra kiểu dữ liệu tĩnh (Astro check & tsc --noEmit)
rtk pnpm run check

# Build ứng dụng frontend Astro (10 static routes: /404.html, /sach/b-01..b-06, /login, /noi-bo, /)
rtk pnpm run build

# Chạy suite kiểm thử 23 bài Python cho nghiệp vụ & parser
python -m unittest discover -s experiments -p "test_*.py" -q

# Kiểm tra hợp đồng API OpenAPI (Redocly 2.64.1: 0 errors)
rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml

# Khởi chạy backend Cloudflare Workers local (Wrangler dev)
rtk pnpm run server:dev

# Kiểm thử tích hợp PostgreSQL (Fail-closed an toàn [BLOCKED: DB_RUNTIME_MISSING] nếu chưa có DB)
rtk pnpm run test:db
```

### 3. Cổng kiểm tra hiện tại

- Source/unit, PostgreSQL disposable, Workers local và restore drill đã có bằng chứng trong báo cáo ngày 20/10/2026.
- Browser UAT, provider thật và production deployment chưa qua nghiệm thu. Không dùng kết quả build hoặc simulation để đóng các cổng này.
- Chạy integration tests chỉ với TEST_DATABASE_URL trỏ database local có tên `ysbk_test_*`; không dùng URL production.
