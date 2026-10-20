# Review chặng 01 — 18/10/2026

## Kết luận và phạm vi

**Đạt các gate kỹ thuật; PARTIAL về tài liệu và truy vết.** Có thể chuyển sang chặng 02 với phần sửa tài liệu ngắn ở đầu prompt. Không cần làm lại baseline hoặc viết lại giao diện.

Đối chiếu `01-baseline-typecheck.md`, đặc tả nghiệp vụ và snapshot review trước. Workspace không có `.git`; dùng hash trong `.review-artifacts/review-source-manifest.json` làm mốc đối chiếu, giữ nguyên manifest đó. Các file đã thay so với mốc gồm package/tsconfig, hai file UI, technical README, architecture, security-operations, implementation-plan và OpenAPI; có thêm progress. Logic giao dịch UI và SQL của các lỗi cũ chưa được sửa. Lượt review này chỉ viết báo cáo, prompt tiếp theo và cập nhật chỉ dẫn README; không sửa implementation.

## Findings còn cần sửa trong phạm vi chặng 01

### S01-01 — P2: Tiến độ đổi nhầm kế hoạch 22 chặng thành 6 chặng

**Vị trí:** `docs/technical/progress.md:11–16`, `:68–75`; đối chiếu `docs/prompts/antigravity-next/README.md`.

Khi giao “chặng 04” theo progress, Antigravity sẽ làm cả chuyển phiếu, trong khi prompt 04 chỉ làm ledger/idempotency. Progress còn đưa UI vào 05 và scheduler vào 06; kế hoạch gốc đặt chúng ở 12 và 15. Nguyên nhân là trộn sáu lát kiến trúc với 22 chặng giao việc.

**Sửa:** dùng lại đủ 22 mã/tên/link trong index; sáu slice có thể giữ như góc nhìn kiến trúc riêng. R02 → 09; R04 → 04/05 và các caller; R09/R10 → 09/12 cùng các lát nghiệp vụ liên quan; R07 → 06/13/14/16/17/18; R11 → 15. Giữ trạng thái 01 PARTIAL đến khi sửa các findings tài liệu này. Kiểm tra toàn bộ liên kết và mapping sau sửa; không đổi các prompt khác để khớp bảng sáu chặng.

### S01-02 — P2: Bảng truy vết vẫn có API không tồn tại và gán sai test nghiệp vụ

**Vị trí:** `docs/technical/README.md:19`, `:34–42`; `docs/technical/progress.md:39`.

Đã bỏ T75, nhưng còn sáu tên không xuất hiện trong 26 operations của OpenAPI: `issueLoanReceipt`, `settleLoanReturn`, `renewLoan`, `recordLoanLoss`, `getAlumniActivities`, `auditScoreHistory`. Các tên hiện có tương ứng là `createLoanReceipt`, `settleReturnReceipt`, `renewLoanReceipt`, `listAlumniActivities`; hai tên còn lại phải ghi chưa có hợp đồng hoặc trỏ đúng operation thực nếu đã bổ sung. Không tự tạo endpoint chỉ để bảng xanh.

Các test ID có tồn tại nhưng sai ý nghĩa: trực sách trỏ T21/T22/T25; tuyển thành viên trỏ T31/T33/T35, vốn thuộc mạng/nội dung/phạt/đối soát/hoàn chuyển khoản/QR. Các kịch bản trực sách thực nằm ở T36–42/T45; tuyển ở T43–44/T46–47/T53. Cần đối chiếu từng hàng với toàn bộ T01–T74, không chỉ sửa các ví dụ này. Mô tả OpenAPI “đầy đủ cho 9 nhóm” cũng vượt hiện trạng: chưa có operations sự kiện.

**Ảnh hưởng:** người thực hiện/tester có thể tin nhầm hợp đồng và độ phủ đã đủ, bỏ sót nghiệp vụ. **Kiểm tra lại:** mọi operation ghi là đã có phải tồn tại; mọi test phải đúng ngữ nghĩa và mức bằng chứng; phần dự kiến được gắn nhãn riêng.

### S01-03 — P2: Phạm vi bằng chứng vẫn được diễn đạt quá mức

**Vị trí:** `docs/technical/README.md:20`, `:26`; `docs/technical/progress.md`, phần mô tả các suite.

README đã bổ sung cảnh báo tốt, nhưng vẫn nói các PoC kiểm chứng “cú pháp YAML/DDL” và logic phân ca. `test_sql_schema_syntax.py` chỉ kiểm chuỗi/regex, không parse/execute PostgreSQL; DDL generated `unaccent` vẫn là R01 chưa sửa. Scheduler vẫn có phản ví dụ R11. `threading.Lock` trong test concurrency tuần tự hóa trước khi ghi SQLite, không kiểm invariant PostgreSQL khi hai transaction tranh chấp. Test parser hiện xử lý chuỗi/dictionary, chưa đọc file Excel thật. “Chưa apply PostgreSQL production” cũng chưa rõ là local chưa apply.

**Sửa:** bảng bằng chứng phân biệt static/regex, mô phỏng SQLite/Python, validator OpenAPI, PostgreSQL integration, HTTP/Auth và UI. Ghi rõ PostgreSQL local chưa chạy; 22 test pass chỉ chứng minh các trường hợp được kiểm, không đóng R01/R03/R11 hay xác nhận parser Excel thực. Giữ phản ví dụ và giới hạn của review trước để người làm sau không bỏ gate.

### S01-04 — P2: Một số giả định traffic/capacity còn được viết như dữ kiện

**Vị trí:** `design.md:17`; `docs/technical/security-operations.md:97–101`.

RPO/RTO và trường công bố tuyển đã được gắn nhãn đề xuất. Tuy nhiên “>70% lưu lượng công khai” chưa có số đo; bảng quota vẫn kết luận “Đủ cho quy mô CLB/Đủ trong giai đoạn đầu” dựa trên ước lượng request/dung lượng. Tên tài liệu nhà cung cấp chưa là nguồn trực tiếp có ngày kiểm tra.

**Sửa:** ghi đây là giả định để thử nghiệm, chưa kết luận capacity; quota có URL chính thức/ngày xác minh, phân biệt giới hạn gói và ước lượng workload. Chỉ sửa nhãn dữ kiện trong design, giữ palette/logo/font/layout. Không phải yêu cầu load test toàn hệ thống tại chặng 02.

## Kiểm tra chạy lại trong lượt review

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit 0; Astro 11 file, 0 lỗi, 0 warning, 16 hint; tsc pass | Không bỏ strict/exclude để né lỗi; hint chưa phải lỗi chức năng |
| `rtk pnpm exec astro build --outDir .review-artifacts/stage01-build` | Exit 0; 3 trang static | Không chứng minh backend hoặc deploy |
| `python -m unittest discover -s experiments -p 'test_*.py' -q` | Exit 0; 22 test pass | SQLite/Python/regex; giới hạn như S01-03 |
| `pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml` | Redocly 2.64.1; exit 0; 0 lỗi, 24 cảnh báo | Chưa chứng minh endpoint được implement |
| Đối chiếu operation IDs/response descriptions bằng PyYAML | 26 operations; không còn response thiếu description; 6 tên truy vết không khớp | Kiểm tra cấu trúc và tham chiếu, không phải gọi API |
| `docker info --format '{{.ServerVersion}}'` và kiểm PATH | Docker daemon pipe không tồn tại; không có `psql` trên PATH | PostgreSQL migration/seed/concurrency chưa chạy |

24 cảnh báo Redocly gồm thiếu license, server localhost và 22 operations thiếu mô tả response 4xx. Không cần bịa license/server production để xóa warning; bổ sung error contracts ở lát sở hữu. Nên ghi version/lệnh validator cố định để tái chạy được.

## Trạng thái findings cũ và bàn giao

| Finding cũ | Sau chặng 01 |
|---|---|
| R12 typecheck | Đã sửa; reviewer chạy lại pass |
| R06 OpenAPI | Đã sửa 7 description và validation cấu trúc; coverage/security còn mở |
| R08 bằng chứng | Sửa một phần; còn S01-02/S01-03 |
| R13 giả định/policy | Sửa một phần; còn S01-04; không tự công bố PII |
| R01/R03 PostgreSQL | Còn mở; ưu tiên chặng 02, cần DB thật |
| R02/R04/R05/R07/R09/R10/R11 | Còn mở; theo đúng 22 chặng, không coi là regression mới của chặng 01 |

Source changes UI chỉ là type annotation và thuộc tính HTML; không có thay đổi logic nên không chạy lại toàn bộ browser review cũ. Chưa kiểm mobile, cloud runtime, Google Form/Auth, ngân hàng, load/penetration hoặc restore. Chưa có Go module thuộc phạm vi review.

**Prompt tiếp theo:** [Chặng 02 đã bổ sung carryover từ review](../prompts/antigravity-next/02-postgres-schema.md). Dừng sau DB/schema và bàn giao; không tự mở rộng sang Auth, sổ tiền hay các chặng sau.
