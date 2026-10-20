# Review kết quả Antigravity — 18/10/2026

## Kết luận và phạm vi

Hiện có UI prototype Astro/React, bộ tài liệu kỹ thuật, SQL draft/OpenAPI, 10 nguồn diagram và PoC Python. Chưa có backend HTTP/managed Auth chạy thật trong `src/`; bản build chỉ có `/`, `/login`, `/noi-bo`. Đây là đầu vào phát triển có ích, chưa là thiết kế đã được kiểm chứng đầy đủ hoặc phần mềm dùng dữ liệu thật.

Review trạng thái file tại `F:\Codex Project\YSBK`, không có `.git` trong workspace nên không có commit/diff làm baseline. Đối chiếu với đặc tả 02/04/05/06/08 và prompt hệ thống/backend. Không sửa code/schema của Antigravity trong lượt review này. Build được ghi riêng ở `.review-artifacts/build`; tương tác UI chỉ dùng dữ liệu mock trong bộ nhớ.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả | Ý nghĩa/giới hạn |
|---|---|---|
| `pnpm exec astro build --outDir .review-artifacts/build` | Pass, 3 trang static | Không chứng minh API/Auth/DB hoặc Cloudflare runtime |
| `pnpm exec tsc --noEmit` | Fail TS5102, TS5090 | `baseUrl` không còn được chấp nhận bởi compiler đã cài, `paths` thiếu đường dẫn tương đối |
| `python -m unittest discover -s experiments -p 'test_*.py' -v` | 22 test pass | SQLite, mô phỏng/regex; không phải test PostgreSQL hoặc endpoint |
| Parse OpenAPI bằng PyYAML và kiểm tra cấu trúc có mục tiêu | 26 operations, 7 response thiếu `description`; không có event operation | Chưa chạy full OpenAPI validator; YAML parse được không có nghĩa OpenAPI hợp lệ |
| UI trên trình duyệt tại `127.0.0.1:4321/noi-bo` | Tái hiện phiếu chuyển tiếp rỗng | Chọn cả hai checkbox trong chế độ PARTIAL rồi xác nhận; phiếu mới ACTIVE, cọc 0, không có sách |
| Gọi scheduler với dữ liệu phản ví dụ | Chọn 2 chính bận đầu/cuối, chỉ 2 hỗ trợ, `warning=None` | Tái hiện trực tiếp trên hàm hiện có |
| PostgreSQL/Docker local | Blocked | Không có `psql` trên PATH; Docker engine pipe không chạy. Chưa apply SQL/seed, test concurrency DB hoặc restore |

Không có Go module trong phần được review; quy tắc chạy golangci-lint không áp dụng. Chưa kiểm thực tế mobile, cloud, ngân hàng, Google Form/Auth, load/penetration hoặc restore. Chưa gọi test Python là bằng chứng 5 người ghi DB đồng thời.

## Findings cần xử lý trước khi xây tiếp

### R01 — P1: DDL search không hợp lệ với PostgreSQL tiêu chuẩn

**Vị trí:** `docs/technical/schema/01_schema.sql:46–48`; `experiments/test_sql_schema_syntax.py:49–71`.

**Trigger/root cause:** apply DDL tạo generated `search_vector` dùng trực tiếp `unaccent(text)`. Generated expression chỉ được dùng hàm immutable, trong khi extension PostgreSQL 16 khai báo hàm này STABLE. Script regex hiện tại vẫn pass vì không thực thi DDL.

**Sửa nhỏ nhất:** chọn cơ chế cập nhật vector bằng trigger phù hợp hoặc thiết kế tìm kiếm khác thực sự hợp lệ; không gắn nhãn IMMUTABLE tùy tiện cho một hàm phụ thuộc dictionary. Apply toàn bộ schema/seed trên PostgreSQL local và kiểm insert/update tìm kiếm không dấu.

**Regression/ảnh hưởng:** migration từ DB sạch phải pass; đổi tiêu đề cập nhật kết quả search; kiểm cả index và catalog query. Nguồn: [PostgreSQL 16 generated columns](https://www.postgresql.org/docs/16/ddl-generated-columns.html), [khai báo unaccent trong source PostgreSQL 16](https://github.com/postgres/postgres/blob/REL_16_STABLE/contrib/unaccent/unaccent--1.1.sql).

### R02 — P1: Chuyển phiếu giữ lại sách xung đột unique active copy

**Vị trí:** `schema/01_schema.sql:152–162`; `diagrams/06_sequence_loan_and_return.mmd:38–42`; `experiments/test_loan_transactions.py:179–203`.

**Trigger/root cause:** phiếu A có cuốn X thực trả và Y tiếp tục giữ. Luồng chỉ set `returned_at` của X, rồi insert dòng Y vào phiếu B. Dòng Y ở A vẫn thỏa partial unique index, nên insert Y mới bị chặn. Chỉ đổi trạng thái phiếu A không ảnh hưởng predicate của index. PoC SQLite không có unique index đó nên không bắt lỗi.

**Sửa:** biểu diễn kết thúc dòng do chuyển tiếp riêng với trả vật lý, liên kết dòng trước/sau và dùng predicate active phù hợp; cập nhật trong một transaction, không giả `returned_at` vật lý cho Y. Cọc chuyển liên kết giữ đúng nguồn.

**Regression/ảnh hưởng:** PostgreSQL nhận đúng một dòng active cho Y, X available, Y borrowed liên tục; retry và lỗi giữa chừng không mất/nhân cọc. Sửa đồng bộ ERD/state/sequence/API/PoC, không chỉ xóa unique index.

### R03 — P1: Trigger tối đa hai dòng không chống được concurrent insert/update

**Vị trí:** `schema/01_schema.sql:165–178`.

**Trigger/root cause:** phiếu đang có một dòng; hai transaction đồng thời insert hai bản khác nhau đều có thể đọc COUNT=1 và cùng qua kiểm tra. Trigger cũng chỉ chạy BEFORE INSERT, nên UPDATE chuyển dòng từ phiếu khác có thể vượt giới hạn. Khóa các bản sách khác nhau không khóa chung một phiếu.

**Sửa:** serialize thay đổi tập dòng bằng khóa parent receipt và kiểm cả insert/update hoặc một thiết kế slot/ràng buộc thực sự tương đương; nêu lock order chung.

**Regression/ảnh hưởng:** hai connection PostgreSQL độc lập tranh thêm vào cùng phiếu; transaction cuối bị từ chối, phiếu không vượt hai. Kiểm reassign line, bulk insert và chuyển phiếu. Đây là lỗi suy ra từ thiết kế SQL, chưa được chạy trên DB local trong lượt này.

### R04 — P1: Schema sổ tiền chưa đủ để thực thi nghĩa vụ cọc và đối soát phiên quầy

**Vị trí:** `schema/01_schema.sql:187–215`, `337–354`; `transactions-finance.md:90–104`.

**Trigger/root cause:** journal chỉ có nguồn tổng quát và chuỗi debit/credit; thiếu liên kết phiên quầy, khoản nhận/phân bổ cọc, nghĩa vụ/chờ hoàn, xác nhận thực thu/chi. `source_id` UUID còn không tương thích trực tiếp với ID cash session VARCHAR. Hai lệnh khác `entry_code` có thể cùng chi cho một nguồn mà không có invariant chống hoàn trùng; hai bảng idempotency dùng hai scope khác nhau. Quy tắc bất biến journal chỉ được viết trong prose, chưa có DB grants/guard hoặc use case chạy thật chứng minh.

**Sửa:** hoàn thiện model finance tối thiểu và ownership nguồn, một cơ chế idempotency nhất quán, khóa nghĩa vụ khi hoàn/giữ/chuyển, journal bất biến với runtime role. Tách quỹ, nơi giữ tiền, cọc còn phải hoàn và tiền thực tế. Chưa cần ERP tổng quát.

**Regression/ảnh hưởng:** hai người hoàn một cọc chỉ có một hiệu lực; trả sách trước/hoàn tiền sau; thu ngân hàng/hoàn cash; cuối ca khớp journal theo đúng phiên; cash session đóng không nhận ghi mới trái quy trình. Chưa có backend tiền thật nên đây là blocker thiết kế, không phải tuyên bố đã có vụ thất thoát.

### R05 — P1: Thiết kế Auth còn thiếu đường xác thực và thu hồi có thể triển khai

**Vị trí:** `security-operations.md:33–42`, `72–76`; `implementation-plan.md:43`; `diagrams/07_sequence_auth_and_roles.mmd:18–29`.

**Trigger/root cause:** tài liệu dùng `auth_users_mapping` nhưng DDL chưa tạo; diagram chuyển từ SELECT mapping sang phát JWT mà không thể hiện provider kiểm mật khẩu. Plan còn giao tự hash mật khẩu, ngược managed Auth đã chốt. Chưa có cách tạo/prove `identity_type` và cách ngăn Google/link/reset/change email chạm credential nội bộ. Prose nói kiểm token version trên request ghi, trong khi GET tài chính/file cũng cần thu hồi.

**Sửa:** chọn một identity flow cụ thể, provision/verify bằng provider được hỗ trợ; role/status/token phải từ nguồn đáng tin. Bỏ tự hash trong app; schema mapping và lifecycle khớp. Kiểm quyền hiện tại trên read/write/download/jobs, không chỉ middleware token cũ.

**Regression/ảnh hưởng:** Google cùng email liên hệ không vào nội bộ; thêm/reset password hoặc direct provider API không chiếm credential; chuyển cựu/khóa chặn GET/POST/export/phiên cũ. UI role switch hiện được ghi mô phỏng, không coi nó là Auth thật hoặc một exploit production.

### R06 — P2: OpenAPI chưa hợp lệ và chưa bao phủ đủ hợp đồng đã giao

**Vị trí:** `openapi.yaml:319–332`, `470–483`, `524–550`, `665–716`; `technical/README.md:15`, `29–37`.

**Trigger/root cause:** 7 Response Object thiếu `description` bắt buộc. Không có endpoint sự kiện, mở ca, import lịch, cấp/quản trị tài khoản hoặc nhiều thao tác được traceability ghi là có. GET duty không có security, webhook cũng chưa mô tả chữ ký/replay; BearerAuth chung chưa diễn tả permission. README còn trỏ T75 không tồn tại trong bộ nghiệm thu T01–T74 và các bảng/operation chưa có.

**Sửa:** validate OpenAPI thật; bổ sung hợp đồng theo từng module, security/permission, bounded filters, errors/idempotency; đối chiếu operationId và test ID thực. Webhook không dùng login khách nhưng cần cơ chế xác thực riêng. Tách public roster nếu CLB quyết định công khai, không vô tình công khai roster nghiệp vụ.

**Regression/ảnh hưởng:** validator không lỗi, mọi reference resolve; traceability dẫn đúng operation/table/test; test API trái quyền/giả webhook khi có runtime. Hiện là lỗi hợp đồng, chưa có endpoint để kết luận đang rò dữ liệu. Nguồn: [OpenAPI 3.1 Response Object](https://spec.openapis.org/oas/v3.1.0#response-object).

### R07 — P2: Một số model không biểu diễn được nghiệp vụ đã xác nhận

**Vị trí:** `schema/01_schema.sql:100–128`, `219–237`, `268–299`, `315–334`; bảng module trong `architecture.md`.

**Trigger/root cause:** `members.team` chỉ một enum và không có lịch sử ban/chức vụ, nên trưởng Hậu cần đồng thời thuộc Ban chủ nhiệm bị mất một quan hệ. `borrowers.student_id`/`school` NOT NULL loại người dân không phải sinh viên. Lô bán chỉ một tên sách và các tổng có thể sửa, thiếu dòng/lịch sử hàng/tiền; chưa có rubric criterion/version, lịch bận/import version và khách tham gia sự kiện. Nhiều bảng được architecture nêu không tồn tại trong DDL.

**Sửa:** bổ sung theo từng lát, glossary/ERD/DDL đồng bộ, số tổng suy ra từ nguồn giao dịch; mã SV/trường không bắt buộc cho người mượn cộng đồng. Không tự thu thêm PII để lấp trường NOT NULL.

**Regression/ảnh hưởng:** một người hai quan hệ ban vẫn tính một thành viên; người dân mượn chỉ họ tên/điện thoại; rubric năm sau không đổi điểm cũ; lô nhiều đầu sách truy từng biến động; khách sự kiện không bị ép thành thành viên.

### R08 — P2: Bằng chứng PoC và trạng thái hoàn thành đang được diễn đạt quá mức

**Vị trí:** `technical/README.md:21`; `experiments/test_concurrency_idempotency.py:146–148`; `test_sql_schema_syntax.py:49–71`.

**Trigger/root cause:** concurrency test dùng mutex Python quanh một SQLite connection; SQL test tìm chuỗi bằng regex. Chúng có thể pass khi DDL PostgreSQL không chạy và chuyển phiếu vi phạm unique. Parser chỉ phân loại một số chuỗi trong dictionary, chưa đọc file Excel thật. Nhãn “Đã kiểm chứng” không ghi rõ các giới hạn này.

**Sửa:** giữ test minh họa nếu hữu ích nhưng ghi đúng cấp bằng chứng; thêm integration test dùng chính migration/SQL/use case với hai connection PostgreSQL thật. Khẳng định provider/runtime chỉ sau bài thử tương ứng.

**Regression/ảnh hưởng:** test fail khi bỏ lock/ràng buộc hoặc làm sai transition; CI không lấy SQLite/regex thay gate DB. Cập nhật README/traceability/gates để không phát hành từ bằng chứng sai cấp.

### R09 — P2: UI PARTIAL tạo được phiếu rỗng hoặc gia hạn không trả cuốn nào

**Vị trí:** `InternalWorkspace.tsx:73–96`, `1490–1505`, `1559–1565`.

**Repro:** mở phiếu hai cuốn, chế độ PARTIAL, chọn cả hai checkbox rồi xác nhận. Runtime tạo phiếu ACTIVE mới không sách/cọc 0. Nếu bỏ cả hai checkbox, logic tạo phiếu mới cho cả hai và reset hạn/lượt dù không trả cuốn nào.

**Sửa:** PARTIAL phải trả đúng một cuốn thuộc phiếu hai cuốn, còn đúng một; trả đủ chuyển FULL, không trả thì dùng renewal đúng quy tắc. Validate ở domain/use case và API, UI chỉ phản hồi sớm.

**Regression/ảnh hưởng:** cases 0/1/2 sách được chọn, barcode lạ/trùng; chỉ case đúng tạo chuyển tiếp. [Ảnh runtime](../../.review-artifacts/partial-return-empty-loan.png). Đây là lỗi prototype thật, chưa phải dữ liệu lưu PostgreSQL.

### R10 — P2: Demo giao dịch thay phiếu nhưng không thay tồn/tiền và bỏ qua phạt nhập

**Vị trí:** `InternalWorkspace.tsx:54–55`, `73–96`, `1274–1300`, `1516–1548`, `1633–1635`.

**Trigger/root cause:** issue/return chỉ `setLoans`; không cập nhật book copy/journal/cash. `actualFineCollected` và `waiveFineReason` không được handler sử dụng, phạt gợi ý luôn 3k, ngày mới hard-code. Modal hoàn toàn bộ cọc ngay cả khi phạt đã dùng hết; close chỉ gạt `isClosed`. Cùng bản đang available vẫn có thể được lập thêm phiếu trong demo.

**Sửa:** trước khi nối API, có adapter trạng thái mock nhất quán và nhãn mô phỏng rõ; sau đó thay bằng response từ backend transaction chung. Tính dự kiến đúng ngày/trần; không báo thu/hoàn/đóng ca thành công khi mới đổi UI state. Không tự biến demo thành nguồn tiền thật.

**Regression/ảnh hưởng:** mượn rồi trả cập nhật đồng bộ danh sách/tồn/cọc/cash; cọc cạn thu mới100k; giảm phạt có lý do; phiên đóng chặn ghi; refresh/pending/retry không giả báo lưu bền. Guest review hiện cũng chỉ bật success state, chưa xác thực/tạo hàng chờ, cần xử lý khi làm module content.

### R11 — P2: Scheduler bỏ qua khoảng bắt buộc của người chính và thiếu hỗ trợ

**Vị trí:** `experiments/test_scheduler_fairness.py:59–61`, `68`, `79–94`.

**Repro đã chạy:** hai main có `free_full_14_17=True`, `free_opening_and_closing=False`; chỉ hai helper rảnh. Kết quả chọn cả hai main, có hai helper, `warning=None`.

**Sửa:** main phải thỏa cả khoảng giữa và đầu/cuối; cảnh báo riêng số main/support thiếu; dùng khoảng giờ và hiệu lực của mẫu tổng hợp, không gắn label sai 14–14:30/16:30–17 trong comment thành quy tắc. Mốc thu dọn đang tạm chưa được tự đóng dấu xác nhận.

**Regression/ảnh hưởng:** hai phản ví dụ trên, người mới/cựu/trùng lịch, thiếu dữ liệu và import lại; auto/manual đều dùng cùng validation. Test fairness không thay ràng buộc cứng.

### R12 — P2: Typecheck hiện không qua

**Vị trí:** `tsconfig.json:6–9`; `package.json` scripts/check.

**Repro:** `pnpm exec tsc --noEmit` trả TS5102 (`baseUrl` removed), TS5090 (`paths` không tương đối). Build Astro vẫn pass vì không thay thế typecheck.

**Sửa:** cấu hình alias phù hợp compiler đã cài, thêm/chốt lệnh typecheck bao gồm Astro; chạy và sửa chẩn đoán thực phát sinh. Không hạ mức strict hoặc bỏ file để có màu xanh.

**Regression/ảnh hưởng:** typecheck và build cùng exit 0, alias resolver/runtime vẫn đúng. Chưa chạy tiếp sau khi sửa vì lượt review không thay config.

### R13 — P2: Thiết kế tự chốt dữ liệu công khai và giới hạn hạ tầng chưa có căn cứ

**Vị trí:** `security-operations.md:85`, `99–100`, `104–111`; `architecture.md` bảng công nghệ; `design.md:16`.

**Trigger/root cause:** tự chọn công khai MSSV/họ tên/ban khi các trường chưa được người dùng chốt; gán traffic mobile >70%, DB đủ 2–3 năm và latency edge <10ms mà chưa đo. Giới hạn Supabase “2 kết nối trực tiếp” sai so với tài liệu compute hiện hành; RPO/RTO và quỹ nhận phạt đang được diễn đạt như chính sách chốt.

**Sửa:** tách dữ kiện/ước lượng/đề xuất; public chỉ field đã duyệt, không mặc định MSSV. Dẫn nguồn quota theo ngày và chọn pool theo mode/provider thực tế. RPO/RTO/quỹ nhận phạt cần nhãn đề xuất, không tự áp policy bằng seed hoặc pseudocode.

**Regression/ảnh hưởng:** kiểm DTO public không có field chưa được phép; fixture quota/estimate có nguồn/công thức; kế hoạch Auth/report/backup vẫn đáp ứng runtime. [Supabase compute](https://supabase.com/docs/guides/platform/compute-and-disk) hiện nêu Nano free tối đa 60 DB connections/200 pooler clients, không phải 2; đó cũng không phải số kết nối ứng dụng được phép dùng hết. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) phân biệt CPU với thời gian mạng và nêu Free10ms; không suy thành latency end-to-end hoặc tác vụ nền vượt giới hạn được miễn.

## Phần làm tốt và nên giữ

- Tách đầu sách/bản sách, dùng VND nguyên và phân biệt cọc bạn đọc/cọc nhà sách trong prose.
- UI có nhận diện/token, đủ vùng điều hướng chính và nhãn mô phỏng role; không nên viết lại toàn bộ.
- Partial unique index là hướng bảo vệ cần giữ, sửa transition tương thích thay vì bỏ nó.
- Có nguồn Mermaid và render; tiếp tục cập nhật theo schema/API sau sửa, không cần đổi công cụ vẽ.
- Hướng một ứng dụng/module nghiệp vụ và transaction chung phù hợp quy mô đang biết; chưa có lý do thêm microservices.

## Thứ tự xử lý

R12/R08 (baseline trung thực) → R01/R03 (DB chạy và invariant) → R05/R06 (identity/contract theo lát) → R04/R02 (sổ tiền/chuyển phiếu) → R09/R10 (UI đúng luồng) → R07/R11 và các module còn lại → R13/diagram/restore/UAT trước dùng thật. Một số sửa doc có thể làm cùng chặng code sở hữu vấn đề; không mở đợt viết lại tài liệu toàn dự án trước mọi lần implement.

Các prompt nhỏ nằm ở [kế hoạch tiếp tục cho Antigravity](../prompts/antigravity-next/README.md). Mỗi chặng có scope, file sở hữu, bước sửa, gate và bàn giao; không tự đánh dấu đã sửa findings khi mới viết prompt.
