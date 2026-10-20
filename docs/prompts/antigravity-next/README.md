# Kế hoạch tiếp tục YSBK sau review — 22 chặng

> Điểm vào mới nhất ngày 20/10/2026: dùng [prompt tiếp tục sửa lỗi và đặt sách công khai](./continue-repair-and-public-reservation.md), theo [kế hoạch PR-0…PR-9](../../superpowers/plans/2026-10-20-public-reservation.md) và [thiết kế đã chốt](../../technical/public-reservation-design.md). Bắt đầu bằng kiểm chứng sửa lỗi hậu chặng 22 hiện có; không làm lại phần đã sửa đúng. Các prompt 13–22 và repair bên dưới là lịch sử/phụ thuộc, không ghi đè quy tắc đặt sách mới. Chưa có thay đổi code trong lượt viết kế hoạch/prompt này.

> Theo yêu cầu mới sau review12, dùng prompt tổng để sửa carryover rồi tự làm tuần tự13–22. Mỗi chặng có checkpoint/test/review nội bộ, không cần người dùng giao lại; không subagent/commit/deploy. Giới hạn dữ liệu thật và các gate kiểm chứng vẫn giữ.

**Cập nhật sau chặng12:** [review mới nhất](../../reviews/2026-10-19-stage12-followup.md) giữ PARTIAL, ghi S12-01..10 và đối chiếu S11/older. Check/build,124 unit,22 Python pass; OpenAPI0 lỗi/22 cảnh báo;42 DB test dừng setup, Workers spawn EPERM, browser bị tắt. [Prompt tổng13–22](./continue-13-to-22.md) yêu cầu sửa DTO/FULL/pending/retry/DEMO/correction/source/coverage trước, rồi triển khai tất cả module còn lại theo thứ tự. Giữ22 chặng, không demo=live hoặc test=policy.

**Mục tiêu:** sửa các lỗi đã xác minh và phát triển đủ chín nhóm chức năng trên nền backend có giao dịch, quyền và bằng chứng thật.

**Kiến trúc:** giữ một ứng dụng/module nghiệp vụ, PostgreSQL là nguồn chuẩn; giao dịch sách/cọc/journal/audit chung transaction. UI dùng adapter theo API, không dùng state demo làm nguồn tiền.

**Stack:** Astro + React + TypeScript đang có; Workers/PostgreSQL/managed Auth còn phải chứng minh trên runtime phù hợp. Không đổi toàn bộ stack hoặc viết lại UI để tránh sửa lỗi.

## 1. Đọc và dùng bộ prompt

Đọc [review 13 findings](../../reviews/2026-10-18-antigravity-review.md) trước. R01–R05 chặn việc tin cậy lõi DB/tiền/Auth; R09/R11 đã có phản ví dụ chạy thật; R12 là lỗi typecheck đã chạy. Các findings thiết kế chưa được gọi là lỗ hổng production vì chưa có backend runtime.

Dán prompt tổng dưới đây cho Antigravity. Prompt này thay điểm dừng từng chặng cũ bằng checkpoint nội bộ và tiếp tục tuần tự13–22, sau khi sửa carryover12. Mỗi chặng vẫn có đầu ra/test cycle và gate thật; thiếu môi trường hoặc policy giữ PARTIAL/BLOCKED, tiếp tục phần độc lập, không đánh dấu hoàn thành toàn bộ bằng checklist.

```text
Thực hiện prompt tổng tại:
F:\Codex Project\YSBK\docs\prompts\antigravity-next\continue-13-to-22.md
Đọc review đầu vào:
F:\Codex Project\YSBK\docs\reviews\2026-10-19-stage12-followup.md

Sửa carryover12 rồi tự làm tuần tự13–22, giữ chỉnh sửa đã có.
Checkpoint/test/review sau từng chặng rồi tiếp tục, không chờ giao lại.
Gate thiếu bằng chứng giữ PARTIAL/BLOCKED; tiếp tục phần độc lập.
Không tự commit/push/deploy hoặc dùng DB/PII/tiền thật.
```

## 2. Ràng buộc chung

- Giữ mọi quyết định đã xác nhận trong docs02/06/08; chỉ hỏi policy mới khi thật sự chặn tiền/quyền/dữ liệu, tiếp tục phần độc lập.
- Một người với AI hỗ trợ, mục tiêu khoảng một tháng;22 chặng là phân rã công việc, không là bằng chứng mỗi chặng xong trong một ngày hoặc mốc30 ngày chắc chắn đạt.
- Không gọi SQLite/regex/mutex trong tiến trình là test PostgreSQL concurrent. API/Auth/mock/runtime/cloud phải ghi trạng thái riêng.
- Local DB phải dùng một lần và có guard; không chạy migration/seed/reset trên DB thật. Không tự tạo cloud project, nhập PII, gửi thông báo, commit/push/deploy.
- Bảo toàn design.md/theme và phần không thuộc scope. Source đang thay đổi thì đọc lại; report review là snapshot, không hoàn nguyên chỉnh sửa mới để giống ảnh cũ.
- Không thêm microservices, event bus hoặc nhiều UI kit. Mỗi chặng cập nhật OpenAPI/schema/diagram phần nó thay đổi, không tạo đợt viết lại cả bộ tài liệu sau mọi task.
- Trạng thái gate: NOT_STARTED, IN_PROGRESS, PASS, PARTIAL, BLOCKED. PASS chỉ khi có lệnh/môi trường/kết quả thực, không dùng “đã đọc code” thay runtime.

## 3. Danh sách prompt và thứ tự phụ thuộc

| Chặng | Đầu ra riêng | Phụ thuộc | Finding/nhu cầu |
|---|---|---|---|
| [01](./01-baseline-typecheck.md) | Sửa typecheck và trạng thái bằng chứng | Không có | R08, R12, R13 (nhãn dữ kiện) |
| [02](./02-postgres-schema.md) | PostgreSQL local, migration và invariant tối đa hai sách | 01 | R01, R03, R08 |
| [03](./03-runtime-auth.md) | Runtime backend và managed Auth cách ly nội bộ/khách | 01, 02 | R05, phần security của R06 |
| [04](./04-ledger-idempotency.md) | Sổ tiền tối thiểu và idempotency dùng chung | 02; policy actor từ 03 cho HTTP | R04 |
| [05](./05-cash-sessions.md) | Mở/đóng ca và đối soát hộp tiền | 03, 04 | R04, phần quầy của R10 |
| [06](./06-catalog-borrowers.md) | Catalog, bản sách, vị trí và người mượn cộng đồng | 02, 03 | R07 (borrower), tiền đề sửa R10 |
| [07](./07-issue-loan.md) | Cho mượn và nhận cọc bằng transaction thật | 03–06 | R03, R04, phần issue của R10 |
| [08](./08-full-return.md) | Trả toàn bộ, phạt và hoàn cọc chờ xác nhận | 07 | R04, R10 |
| [09](./09-partial-return.md) | Trả một phần và chuyển tiếp không mất lịch sử/cọc | 08 | R02, R09, R10 |
| [10](./10-renewal-calendar.md) | Gia hạn và lịch ngày đến hạn | 08, 09 (helpers lưu thông dùng chung) | S09-01..09; phần date/fine của R10 |
| [11](./11-lost-book.md) | Sửa carryover10, báo mất và sửa sai chứng từ | 04, 05, 07–10 | S10-01..09; R04 và phần mất/đảo trong R06 |
| [12](./12-desk-ui-integration.md) | Sửa carryover11, quầy nối API/Auth/DB và kiểm browser | 03, 05–11 | S11-01..10; R09, R10 |
| [13](./13-members-dues.md) | Thành viên, nhiều quan hệ ban và hội phí một lần | 03, 04 | R07 (members), R05 revoke |
| [14](./14-availability-import.md) | Import Excel lịch bận theo mẫu thống nhất | 02, 03, 13 | R07 (availability), R08 (parser thật) |
| [15](./15-roster-scheduler.md) | Sửa solver lịch, chỉnh tay và công bố có phiên bản | 13, 14 | R11 |
| [16](./16-recruitment-sync.md) | Tiếp nhận và đối soát Google Form | 03, 02 | R06 (webhook), R07 (Form model) |
| [17](./17-recruitment-evaluation.md) | Rubric phiên bản, phỏng vấn và tổng kết tuyển | 13, 16 | R07 (rubric), R13 (public fields) |
| [18](./18-sales-lots.md) | Lô sách mới, bán/trả dư và quyết toán nhà sách | 03, 04, 05 | R07 (sales), R04 |
| [19](./19-events-activities.md) | Hoạt động, sự kiện và nhiệm vụ liên kết quỹ | 03, 04, 13 | R06 (event API), R07 (participants) |
| [20](./20-public-content-seo.md) | Nội dung công khai, kiểm duyệt và URL sách/review | 03, 06, 19 cho activity | R10 (review success giả), R13 (public PII) |
| [21](./21-reports-audit.md) | Dashboard, Excel/PDF và nhật ký đúng quyền | 05, 07–20 theo dữ liệu báo cáo | R06 (coverage), R04/R13 (số liệu) |
| [22](./22-runtime-ops-uat.md) | Runtime triển khai, backup/restore và nghiệm thu toàn bộ | 01–21 | R08, R13; mọi finding còn mở |

Mặc định đi theo thứ tự để giảm đổi ngữ cảnh. Khi03 bị chặn vì provider/cloud credential, vẫn có thể hoàn thiện04/DB tests hoặc domain độc lập bằng test actor đáng tin ở môi trường test; không mở API tiền thật bằng Auth giả và không đổi gate03 thành PASS. Những chặng phụ thuộc Auth chỉ được nhận là đã kiểm phần local/domain cho đến khi có bằng chứng Auth cần thiết.

Nếu22 phát hiện backend/platform không phù hợp, sửa đúng nút nghẽn có số đo; không lùi thành chỉ có frontend hoặc bỏ một module đã yêu cầu.

## 4. Đầu vào/đầu ra giữa các chặng

- 02 giao migration và test harness DB; các chặng sau dùng cùng PostgreSQL/seed giả/guard, không tự tạo schema SQLite thay thế.
- 03 giao actor/policy/session contract và runtime entry; endpoint về sau dùng nguồn quyền này, không tự nhận role từ body/header tùy ý.
- 04 giao finance/idempotency interface nhận cùng transaction của caller.05/07–11/13/18/19 cùng dùng, không giữ sổ tiền thứ hai.
- 06 giao ID bản/người mượn và DTO catalog.07–11 giao biên nhận/trạng thái để12 nối UI, không suy kết quả từ việc bấm nút.
- 14 giao lịch bận typed/versioned;15 dùng cùng dữ liệu và validator cho đề xuất/chỉnh tay/công bố.
- 16 giao response nguồn/version;17 thêm evaluation tách biệt, sync không xóa điểm.
- Các module giao nguồn chứng từ cho21;22 đóng bằng chứng runtime/restore và UAT, không dựng lại số liệu từ bảng mock.

Các tên hàm cụ thể phải được chặng sở hữu chốt trong code/API thực rồi ghi progress để caller sau dùng đúng. Tên file trong prompt là nơi trách nhiệm dự kiến, không phải lệnh tạo lớp mới trùng với code người dùng đã có.

## 5. Mẫu bàn giao bắt buộc

```text
Chặng: NN — tên
Trạng thái: PASS / PARTIAL / BLOCKED
Mục tiêu và phạm vi đã làm:
Finding đóng: Rxx + bằng chứng; finding còn mở:
Tệp thay đổi và hợp đồng thay đổi:
Kiểm tra: lệnh, môi trường, exit/result thực
Bằng chứng UI/DB/provider/runtime tương ứng:
Giả định/policy chưa chốt hoặc blocker:
Đầu vào đã sẵn cho chặng tiếp theo:
```

Dùng một file docs/technical/progress.md do chặng01 tạo để tránh trạng thái rải rác. Không ghi mật khẩu, token, connection string hoặc hồ sơ người thật vào bàn giao. Reviewer xem follow-up diff và findings còn mở trước, chỉ lặp review toàn bộ khi thay đổi đủ lớn.

## 6. Gate phát hành

Không phát hành khi còn lỗi tiền/quyền/PII chặn, chỉ pass build, hoặc mới có tài liệu/ảnh. Đủ FR01–09, test PostgreSQL/API/Auth, UI thiết bị, số liệu báo cáo khớp, file đúng quyền và restore có bằng chứng. Buổi trực thực/UAT và triển khai production có phê chuẩn theo phạm vi riêng; roadmap không tự cho phép các thao tác đó.

