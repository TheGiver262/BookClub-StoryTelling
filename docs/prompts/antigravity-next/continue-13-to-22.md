# Prompt tổng — Hoàn thiện carryover12, làm tuần tự chặng13–22

Bạn là Antigravity, tiếp tục phát triển tại `F:\Codex Project\YSBK`. Chủ sản phẩm đã yêu cầu **làm tất cả các chặng còn lại tuần tự đến hết**, sau review12. Hãy thực hiện công việc, kiểm thử và sửa lỗi phát sinh; không chỉ viết thêm kế hoạch hoặc đánh dấu checklist.

## 1. Đọc và quyền tiếp tục

Đọc AGENTS.md áp dụng, README.md, design.md, docs02/04/05/06/08, `docs/reviews/2026-10-19-stage12-followup.md`, review11/10 và code/tests/schema/OpenAPI/progress mới nhất. Đọc riêng từng prompt13–22 ngay trước chặng đó; dùng bảng mục5 dưới đây. Review là snapshot: xác minh lại code thay đổi mới, bảo toàn sửa đúng và dữ liệu/chỉnh sửa người dùng.

- Lượt này bao gồm sửa lỗi chặn còn lại của01–12 và triển khai13→22. Quy định cũ “dừng sau mỗi chặng, chờ người dùng giao tiếp” được thay bằng **checkpoint nội bộ rồi tự tiếp tục**. Không cần hỏi lại để chuyển13→14…→22. Giữ22 mã chặng, không renumber hoặc tự nhận chặng12 đã PASS.
- Chỉ dẫn file src/modules trong prompt cũ là dự kiến ban đầu. Code hiện ở src/server: reuse cấu trúc module/domain đang có, không tạo cây kiến trúc song song hoặc helper trùng. Giữ Astro/React/TypeScript + Workers/PostgreSQL/managed Auth theo các gate, không viết lại stack/UI kit chỉ để tránh lỗi.
- Không subagent, commit/push/deploy, cloud project mới, PII/tiền thật, import dữ liệu thật hoặc gửi email/Facebook/Zalo. Chỉ tạo code/config mẫu/scripts/runbook có thể review local. Đăng nội dung/tạo tài khoản/cấu hình provider/chuyển tiền thật vẫn cần quyền riêng khi đến bước đó.
- Ưu tiên giải pháp chuẩn đã có, dependency cài sẵn hoặc stdlib. Nếu thật sự cần thư viện XLSX/PDF/Excel thì chọn nhỏ/phù hợp runtime, ghi lý do/license và khóa version; không thêm framework/plugin cho vài dòng hoặc microservices/event bus/multi-tenant/SaaS billing.
- Một CLB trước; các bản bán riêng sau này không là yêu cầu làm multi-tenant hiện tại. Bản sản phẩm cần đủ9nhóm chức năng; không thay yêu cầu bằng landing page hoặc nhiều prototype không lưu DB.

## 2. Cách thực thi tự chủ, kiểm chứng và phục hồi ngữ cảnh

1. Đầu lượt kiểm inventory files/runtime và đọc trạng thái hiện tại, tìm phần đã có để sửa/reuse. Chưa có Git thì dùng manifest/hash để biết file đổi; không tự git init/commit hoặc giả diff commit.
2. Đầu tiên xử lý mục3 (carryover12). Sau đó làm đúng thứ tự13→22. Mỗi chặng có source/schema/forward migration/API/typed DTO/UI tương ứng, tests hồi quy và docs đúng phần đổi. Không làm hết backend rồi để UI các module vẫn là mock, không thêm modal success thay file/chứng từ thật.
3. Trước chuyển chặng: tự review connected callers/permissions/transactions/contracts và chạy kiểm tra phù hợp; sửa lỗi do thay đổi gây ra. Ghi findings/gates có bằng chứng. Không broad chạy lặp chỉ để tăng số test hoặc xem một static build là API pass.
4. Nếu có lỗi code/tiền/quyền/PII chặn dependency, sửa trước khi caller dùng live. Có thể tiếp tục phần độc lập dựa trên contract rõ ở cùng chặng, nhưng không tiếp nhận dependency sai thành PASS hoặc giấu bằng fallback mock.
5. Thiếu PostgreSQL/provider/browser/secret/policy: chẩn đoán môi trường và thử cách local an toàn trong quyền đã có, không vô hiệu hóa sandbox/Work settings/auth/DB guards để đạt xanh. Hoàn thiện code/tests/fixture độc lập, giữ gate PARTIAL/BLOCKED; chuyển tiếp phần không phụ thuộc proof đó. Đến22 tổng hợp/retry gate sau khi đã sửa nền. Không dừng toàn bộ chỉ vì thiếu một credential, cũng không tự công bố toàn sản phẩm hoàn tất.
6. Câu hỏi policy thực sự chặn tiền/quyền/dữ liệu thì gom ngắn, nêu case cụ thể/các lựa chọn, tiếp tục phần độc lập khi chờ. Không hỏi lại các quyết định đã chốt (14ngày,2cuốn/phiếu,capcọc,quyền thành viên…). Nhánh chưa chốt mặc định chưa hoạt động, có UI/DTO lỗi rõ; không chọn policy mới bằng test.
7. Duy trì `docs/technical/progress.md` và một trạng thái tiếp tục gọn trong cùng file hoặc `docs/technical/remaining-stages-handoff.md`: current stage/subtask, files đã đổi, findings mở/đóng, lệnh/result/log, blocker, bước tiếp chính xác. Cập nhật sau checkpoint và trước hết context. Lượt tiếp theo đọc lại và tiếp tục từ chỗ dở, không chạy lại từ13/viết lại code đã xong.
8. Trạng thái từng chặng phân biệt implementation với proof: NOT_STARTED/IN_PROGRESS/PASS/PARTIAL/BLOCKED. “Code xong nhưng PG chưa chạy” là PARTIAL, gate PG BLOCKED; vẫn có thể tiến phần độc lập của chặng sau. Không gọi tổng thể PASS nếu còn finding chặn hoặc external gates chưa đạt.
9. Cập nhật ngắn bằng tiếng Việt khi có phát hiện/quyết định/checkpoint và trong chờ lâu; không narrate từng lệnh. Sau checkpoint tự tiếp tục, không gửi lời kết “bạn muốn làm chặng sau không?”. Dừng cuối22 hoặc khi không còn phần được phép thực hiện có ích; bàn giao trạng thái thật.

## 3. Cổng đầu vào bắt buộc — Sửa review12/carryover cũ

Đọc từng S12-01..10 trong review12 và bảng S11/older. Viết regression gây lỗi trước sửa logic khi là tiền/branch/state/security. Đây là đầu vào13–22, không tạo “chặng23”.

### S12-01, S12-02 — contract/UI phải gọi được backend

- CashSession snake_case hiện bị cast thành camelCase, receipt totalDeposit/isReturned/carried fields bị DTO client đổi tên không mapping; status thiếuOVERDUE/LOST. Thống nhất schema hoặc mapping có kiểm, type-only shared contracts khi phù hợp, không castany che JSON sai.
- Catalog search chỉ summary/count, loader chờ copies nên quầy không có bản để chọn. Scan/search copy đúng endpoint; giữ pagination/meta/filter và đủ dữ liệu, không tải toàn bộ sách/PII vào client. Không nhầm data array+meta của router với object pagination.
- FULL return phải gửi đúng selector các sách thực nhận; UI hiện chỉ gửi khiPARTIAL nên400. Giữ exact-set guards, lost/carry không trả vật lý giả. Test adapter→handler actual DTO và browser workflow/reload.

### S12-03, S12-04 — tiền, pending và recovery

- Bỏ default3k/giờ máy làm quyết định phạt; lấy quote/cutoff/date serverVN. Thu phạt/hoàn cọc/cọc mới có method/amount/quote/source/confirmation riêng mặc địnhfalse, không hardcoded true hoặc CASH. Nhận sách độc lập với thực thu/chi.
- Có UI/read API cho settlement/refund pending/new-deposit pending/fine collection/summary/history, finalization/cancel có audit. T73 giữ150k rồi nhận100k mới thật; transfer cọc cash-neutral không journal thu giả, chưa nhận khôngHELD giả.
- Action/key/payload/version giữ qua retry/timeout/reload; API client nhận lại key đã cấp cho cùng ý định thay tự sinh mới mỗi gọi. Mất response sau commit tra nguồn/kết quả theo quyền rồi retry cùng key; không bảo khách chuyển lại tiền. Hai ý định thật khác nhau vẫn serialize đúng.

### S12-05 — LIVE/DEMO và Auth boundary

- DEMO không gọi bất kỳ mutation live nào, đặc biệt close-session khi liveSession cũ còn giữ. Mode/adapter reset state và request cancellation rõ, không chỉ banner.
- Login/me/logout đúng cookieHttpOnly, không localStorage token/password. Chỉ MEMBER/ADMIN vào nghiệp vụ; ALUMNI safe activity; guest/disabled/revoked chặn.401/403 xóa state/cache PII,5xx fail closed, không render workspace như đã xác thực hoặc response cũ overwrite role mới.
- Không CORS wildcard+credentials, không Origin/CSRF/body/rate bypass vì dev proxy. Không client service-role key hoặc test actor lọt production. Các module chưa nối phải nhãn/disabled, không lẫn INITIAL_* vào live totals.

### S12-06, S12-07 — correction source và identity journal

- LOAN_FINE correction đang đọc fine_collected_amount/fine_pending_amount/fine_status từ loan_receipts không có cột; decision ở loan_settlements/loan_renewals, source_id có loại khác nhau. Sửa theo nguồn thật hoặc reject nhánh chưa hỗ trợ, không thêm cột giả ở receipt rồi giữ hai sổ trạng thái.
- Collectioncode bỏ targetId, seq COUNT theo target nên hai source trên một receipt trùng COLLECT-1. Dùng bounded source/event identity và business dedupe đúng, giữ unique/immutable; không truncate/random code chỉ để né collision.
- Giữ các fix unsupported managed sources và strict confirmation đã thêm. Correction tiền cần pending/confirm/method/amount thật và kiểm dependency; journal đảo không tự chuyển tiền hoặc đổi sách đã lưu hành. Test direct/late/partial fine, refund/forfeit/carry guards, hai source/receipt, reversed/lost response/fault/ca sau.

### S12-08, S12-09, S12-10 — source coverage, lock, evidence

- Loss validate coverage/state/remaining cho mọi selected item trước mutation; không chỉ forfeitAllocations.length>0. Mixed mappedA50k+NULLB100k không được cả2LOST mà cònHELD100k mắc terminal. Legacy ambiguous reject/migrate có căn cứ; pending/refunded/transferred không tiêu lại, pending refund cancel cùng nguồn.
- Renew vẫn receipt→session, return session→receipt; correction implicit session sau journal và allocation→receipt. Thống nhất order ở code thật cho mọi caller, recheck state/version, PG barriers/observer/deadline/cleanup; bounded retry chỉ khi biết rollback, không giữ lock lúc gọi provider.
- Snapshot giá nullable/căn cứ cọc/policy/hạn gốc-hiệu lực/version, amount quote/safe integer/UUID/bounds, source cash chuẩn hoặc invariant materialized đúng1lần, lineage nhiều cấp và action uniqueness còn phải đóng. Không gọi min(field,journal) là một nguồn hoặc fieldDTOoptional là snapshot đã lưu.
- Policy quỹ thụ hưởng/mixed-loss/lost-found/damaged/renew với fine pending chưa đủ thì gate riêng;P>=D renewal đã chặn thì giữ. Không dùng fixture/test làm quyết định vận hành.
- Fixtures bàn giao seed350k/open500k hoặc1triệu cần reason ở open, không mở lại cùng ngày trái guard; fresh+upgrade08/09/10/11/12 có dữ liệu, unpaid/paid/forfeited/waived/ambiguous. PG/runtime không được đóng bằng mock/regex/build.
- Kiểm browser desktop/mobile/a11y, labels/errors/focus trap/Escape/scroll bounds; không dựa class responsive để PASS. OpenAPI/source/render contracts phải khớp; không tự tắt Work settings để chạy browser.

## 4. Quy tắc sản phẩm bất biến áp dụng mọi chặng

- Một CLB; active members quản nghiệp vụ, admin thêm accounts/global audit. Cựu chỉ xem hoạt động safe, không PII/quỹ/tài khoản/ExcelPDF/mutation; disabled khác alumni. Internal username+password được cấp, khách Google hoặc email/password không tự có quyền nội bộ kể cả trùng email.
- Loan tối đa2quyển/phiếu; cọc từngquyển mốc50k gần nhất, midpoint lên, min50k:74k→50k,75k→100k,230k→250k; không giá mặc định50k, giá thật vẫnnullable/0 đúng. Tiền VND nguyên an toàn, server tính, client chỉ đối chiếu.
-14ngày lịch Việt Nam/hết ngày:01/10→15/10. Trong hạn gia hạn từ hạn hiện tại, tối đa3lần; overdue chốt phạt rồi ngày gia hạn+14. Partial trả1giữ1 mới receipt/reset14ngày/3lần và chốt phạt cũ; giữ liên kết/không fake returned_at.
- Phạt1k/ngày cảphiếu, có miễn/giảm có lý do. P<D hoànD/thuP riêng;P>=D giữD/không thu thêm khi tất toán. Không suy nhánh gia hạn chưa chốt. Holiday trùng buổi đến hạn dời buổi thực tiếp, không phạt vì phần dời; T3→T5 vẫn2k. Lịch trực mặc địnhT3/T5,14–17h.
- CASH/BANK đều truy nguồn/buổi, hoàn khác method được. Tiền thực phải xác nhận từ app/giao nhận, pending không giả có tiền. Cọc mượn–trả tách quỹ hoạt động, một hộp chung, trực chính đếm đầu/cuối, tài khoản người nhập riêng. Actual/expected/obligation/revenue khác nhau.
- Mất sách chỉ giữ cọc bản mất đã nhận, zerocashdelta; book copyLOST/loanitemis_lost khác returned/carry. Tìm lại/hỏng/sửa quyết định sau thu tiền cần policy; không auto hoàn/thu cọc mới.
- Member fee khoảng100k thực thu một lần duy nhất, không tự thu hằng năm. Ban gồm Hậu cần/Nội dung/TTĐN/BCN; một người có quan hệ ban/chức vụ theo thời gian, headcount không trùng.
- Bán lô sách mới riêng, sách mượn cũ không bán. Khách trả ngay/không nợ/đặt trước/đổi trả; CLB có thể nợ nhà sách.100cuốn nhập65k, bán60/trả40→nợ3,9triệu; không cọc không có hoàn2,6triệu. Cọc1triệu nhà sách hoàn riêng, thanh toán3,9triệu riêng, xác nhận từng chiều.
- Giữ GoogleForm, đơn tự sync; nhiều nguyện vọng; rubric theo năm/campaign, điểm riêng/chung/sửa có lịch sử; hội đồng tổng kết sau. Public result chỉ trường đã được chấp thuận, không tự xuất candidate raw. Reviews khách có auth, chờ duyệt; sửa bản đã duyệt không lọt public trước.
- Sắp ca theo file XLSX tổng hợp một mẫu, không parse từng trường. Hai main đủ đào tạo và rảnh cả ca/chuẩn bị/dọn,3–5helpers đầu/cuối. Giữ13:45–14:00/17:00–17:15 ở mức giả định theo docs đến khi có quyết định khác, không ép helper rảnh giữa buổi. Facebook chỉ soạn bài/link để người phụ trách đăng, không tự gửi.

## 5. Thứ tự chặng13–22 và điều kiện chuyển

Đọc prompt gốc tương ứng, thực hiện source+DB/API+UI+test ở từng chặng; các đường dẫn src/modules đổi sang cấu trúc server hiện có khi chưa có module. Quy tắc dừng từng chặng cũ được override bởi mục1–2, các giới hạn side effect vẫn giữ.

| Chặng/prompt | Công việc bắt buộc và test quyết định |
|---|---|
|13 `13-members-dues.md` | Affiliations/chức vụ có thời gian, trường/năm/khóa riêng, active/alumni/disabled rõ; onboarding/admin accounts đúng03. Fee receipt thực thu một lần qua finance, retry/key khác không thu lại. UI member/history/dues chạy API; test đổi vai trò/revoke tức thời, hai ban một người, năm sau không tự thu phí. |
|14 `14-availability-import.md` | XLSX parser thật theo mẫu tổng hợp: preview/error trước commit, dates/tuần/interval/version/batch/source và import lại không trùng. Thiếu/lỗi không thành rảnh. Limit compressed+expanded bytes/sheets/rows/CPU, không execute formula/macro/external links; file private. Thiếu mẫu thì mẫu đề xuất có nhãn và config mapping tối thiểu, không viết bộ gom lịch trường. |
|15 `15-roster-scheduler.md` | Auto+manual chung validator: main đủ đào tạo/rảnh ca và đầucuối; helpers không cần rảnh giữa; dưới3helper cảnh báo, chưa rõ lịch không tự available. Fairness mềm sau constraints. Draft/version/publish/attendance/roles, regenerate giữ sửa tay và không tăng counter như đã trực. Test phảnví dụR11, conflict, cựu/người mới, publish race; soạn Facebook text/link không gửi. |
|16 `16-recruitment-sync.md` | GoogleForm ingress/reconcile với FormID+ResponseID, question/source schema versions, multi-choice ban. HMAC/secret/time/replay/bounds, commit trướcACK, retry/backoff/checkpoint/monitor. Duplicate/lostresponse vẫn1hồsơ, sync không ghi đè điểm/notes; fixture signed callback và Apps Script source/runbook, trigger thật giữ gate khi chưa cấp quyền. |
|17 `17-recruitment-evaluation.md` | Campaign rubric version/criteria/weights, interviewer assignment/questions/answers/written work; personal/shared grading giữ nguồn, edits before/after/actor/time/reason/version, conflict không mất điểm. Hội đồng chốt/phânban/convertmember đúng1lần, giữ tuyển sinh source. Thiếu rubric/công thức dùng cấu hình có nhãn, không tự trung bình cộng; publication allowlist gate, guest/alumni không xem private score/PII. |
|18 `18-sales-lots.md` | Suppliers/lots/lines/snapshots/stockmovements/payables/deposit actual, sales percopy/line chặn âm/twoactors oversell. Customer trả đủ, supplier return physical khác money refund, retained stock không tự giải nghĩa vụ chưa chốt. Test100=60+40/3,9triệu/cọc1triệu hoàn riêng/chênh lệch gộp900k trước chi phí, payment retry/correction/source reconciliation. UI lô/bán/trả/quyết toán thật, không sửa tự do tổng. |
|19 `19-events-activities.md` | Plans/tasks/assignee/deadline/location/guest+member attendance; budget khác chi thực, chứng từ finance chung một lần. Public/alumni allowlist kể cả free text/files, không gửi entity đầy đủ rồi giấu cột. UI event/task/expense và test expense nhìn ởevent/finance/report vẫn một lần, guest không ép thànhmember. Không thêm tickets/customer registration/2người duyệt chi ngoài scope. |
|20 `20-public-content-seo.md` | PublicPortal và Astro book/review URLs dữ liệu thật, title/meta/canonical/sitemap/robots/share/back/refresh/HTML SEO. Guest auth Google/email và review submit pending thật, member moderation; sửa bài approved tạo pending version, sanitize/XSS/link/rate/spam controls. Không public borrower/admin notes/unapproved recruitment result. Staging noindex không thay auth; chưaverified official logo/media thì ghi nguồn/giới hạn, giữ design.md. |
|21 `21-reports-audit.md` | Dashboard và weekly/monthly/quarterly/yearly cùng snapshot/filter/source; cash/bank/cọc/nợ/revenue riêng, drilldown source, member/event metrics thật. XLSX/PDF thật unicode/formula injection/layout/pagination, bounded jobs/CPU/memory/concurrency theo số đo. Fileprivate/currentrole download kể cả link/job sau revoke; alumni khôngexport. Global audit chỉadmin, redact secrets, analytics aggregate privacy. Render/đọc file và đối soát mọi tổng với ledger, không modal success giả. |
|22 `22-runtime-ops-uat.md` | Tích hợp toàn9FR; PG application role/constraints/TX/races/grants, Workers/TLS/pool/Auth/Storage/HTTP/browser thật; backup+restore disposable data/files/Auth/permissions và reconciliation, đo RPO/RTO chờ chủ sở hữu chốt mục tiêu. Đo5.000bản giả/5người, latency/error/query/CPU/memory/p95 có môi trường/thời gian/data. Official free-tier limits/pricing/quotas cập nhật có link+ngày/công thức/cảnh báo; không claimedge10ms/2connections vô căn cứ. Runbook/readiness/rollback/security/diagrams+traceability và UAT scenarios đủ9FR; không deploy hoặc dùng PII/thực hiện2–4buổi thật chưa được phép. |

## 6. Kiểm chứng xuyên chặng và bảo mật

- Tiền/source mutations claim+locks+version+rules+state+allocations+journal+audit+cached response cùng TX. Journal posted immutable, managed corrections source-specific, no fake cash. Test successful source, negative boundary, retry/lostresponse, fault sau từng phần quan trọng và PG hai connections đúng overlap, không chỉ count test.
- Fresh và từng upgrade legacy có dữ liệu giả; columns/FK/enums/index/constraints và migration ordering/rerun/rollback-safe. Không reset DB thật để né migration hoặc PG app-role grants. Fixtures đúng business constraints, clockVN ổn định, không đổi policy/guard chỉ để test pass.
- Protected reads/writes/replay/download check live actor, no-store, public DTO allowlist; SQL params/field whitelists/body/upload/page bounds, secrets redaction, XSS/CSRF/Origin/abuse limits theo topology. Đừng đưa PII vào public HTML/analytics/log/backup URL; nhiệm vụ admin không lan sang nghiệp vụ mọi member.
- Frontend dùng response server/refetch có version/cancellation, không optimistic financial success, no demo fallback/live side effects, no client role authority. Test actual adapter DTO và malformed payload, browser keyboard/mobile/loading/errors/network/401/403/409/timeout/recovery/reload.
- Check/build/OpenAPI lint+semantic parity sau chặng liên quan; dùng tests focused rồi broaden khi shared contract đổi/failure/rủi ro mới. Python model chỉ thêm khi model đổi, không lặp đo PoC làm PG proof. Go nếu xuất hiện phải golangci-lint đúng module theo AGENTS.
- External facts về platform/library/limits phải kiểm official docs hiện tại khi dùng; ghi citation/date và phân biệt đo thực/đề xuất. Không tự tạo dependency/hạ tầng trả phí; giữ hướng free-tier ban đầu và ngưỡng scale theo số liệu thật.
- Browser bị tắt/worker spawnEPERM/DB runtime thiếu thì ghi blocker chính xác và lệnh tái chạy, không lách bằng tool khác/cấp quyền yếu. Chỉ kết quả tại đúng runtime mới đóng gate. Screenshot demo, buildstatic, source và mock không chứng minh end-to-end.

## 7. Đầu ra cuối lượt

1. Hoàn thiện code/migrations/config mẫu/API/UI/files/tests trong scope; docs/progress/README/traceability và diagrams source+render đúng những gì đã làm. Không ghi toànmodule done nếu mới có entities/placeholder/page.
2. Bảng13–22 và carryover01–12: implementation state, evidence gates, findings đóng/mở, policy/provider/credential/UAT blockers. Mỗi PASS trỏ lệnh/môi trường/result/log/date, không “triệt để” từ source review.
3. Danh sách files đổi/entrypoints/local commands, account-fixture khôngsecret, endpoints có handler, migration upgrade order/backup-restore/runbook và sampledata/scenarios. Báo thiếu phần nào và ảnh hưởng người vận hành, không giấu trong comment.
4. Test report tổng với checks/unit/PG/direct-handler/Workers/provider/browser/exportrender/security/restore/load/UAT tách; totals đúng thực. Mục tiêu đủ9FR không tự là proof performance/security hay go-live.
5. Phần chờ người dùng/external chỉ nêu việc thật sự cần: policy inputs chưa chốt, cấu hình provider/quyền phù hợp, bật browser nếu muốn kiểm trong môi trường đó, deployment/PII/UAT thật. Không xin lại quyền viết local hoặc hỏi chuyển chặng.
6. Kết thúc sau khi đã đi qua toàn bộ13–22 và hoàn thành mọi phần khả thi được phép. Nếu chưa đủ ngữ cảnh/thời gian, lưu checkpoint còn dở và tiếp tục theo cơ chế nền tảng cho phép; không đổi PARTIAL thànhPASS để kết thúc. Không tự tạo automation/thread mới, commit/push/deploy hoặc chuyển tiền thật.
