# Chặng 12 — Sửa carryover11 và nối quầy sách với API lõi

Bạn là Antigravity, làm trực tiếp tại `F:\Codex Project\YSBK`. Đọc AGENTS.md áp dụng, README, `docs/reviews/2026-10-19-stage11-followup.md`, review10 và bảng carryover; đọc code/tests/schema/migrations/OpenAPI/progress hiện tại. Review là snapshot: kiểm lại thay đổi mới, giữ sửa đúng, không hoàn nguyên chỉ để giống report.

Đọc docs02/05/06/08, design.md và prompt11. Chỉ làm12 theo các lát A→D dưới đây: sửa nền tiền/trạng thái, adapter/auth, giao diện quầy, nghiệm thu. Không subagent, commit/push/deploy, cloud project mới, DB/PII/tiền thật, gửi thông báo hoặc tự chạy13. Local steps thường lệ đã được giao; không hỏi lại từng lệnh.

## Phạm vi, trách nhiệm và tiêu chí hoàn tất

- Phụ thuộc03/05–11. Reuse src/server/circulation, finance, shared transaction/idempotency/audit và router. UI chính `src/components/InternalWorkspace.tsx`, `src/pages/login.astro`, `src/data/mockData.ts`; adapter/components quầy chỉ tách theo trách nhiệm cần thiết. Không tạo lớp src/modules song song, đổi stack/UI kit, redesign toàn website hoặc refactor mọi module.
- Giữ logo/theme/font/token, sidebar và nhận diện trong design.md/global.css. Đây là nối nghiệp vụ và sửa lỗi tương tác theo thiết kế đã có; không mở vòng xin duyệt thiết kế mới để trì hoãn lát đã chốt.
- Hoàn tất12 đòi quầy dùng được API/Auth/DB local thật và browser reload/race/recovery đúng. Fixture/mock có thể giúp hoàn thiện UI khi môi trường bị chặn, phải là chế độ explicit có nhãn, giữ gate live PARTIAL/BLOCKED; không tự fallback sang mock khi API lỗi.
- Books/hold/deposit/journal/audit/cache cùng transaction đúng client. PG disposable có guard target trước reset/migrate/seed; không dùng SQLite/regex/SQL doubles thay constraints/locks/migration/provider proof. Thiếu runtime thì tiếp tục phần độc lập, không xóa guard hoặc gọi dữ liệu demo là lưu bền.

## A. Sửa carryover11 trước khi bật mutation live

### A1. S11-01, S11-02 — correction theo nguồn và xác nhận tiền thực

- Route hiện nhận arbitrary journal ID rồi allowDirectSourceReversal=true cho mọi managed source. Đóng bypass này; correction phải theo source/type có handler phối hợp receipt/item/copy/allocation/refund/forfeit/fine/renewal collection. Nguồn chưa hỗ trợ trả conflict/unsupported rõ, không tự đảo sổ rồi báo xong.
- Reverse confirmed refund/forfeit hiện để allocation/intent/settlement cũ nguyên và liability lệch. Lock/version/dependency và điều chỉnh nguồn trong cùng TX; assert reconciliation tổng và nguồn/item. Reverse deposit không để receiptACTIVE/copyBORROWED nhưng cọcVOIDED vô điều kiện.
- Tách quyết định correction với thực thu/chi. Nếu có tiền phải source/amount/quote/method/session/strict confirmation riêng; chưa tiền thì pending, GET/retry/cancel có audit. Đảo journal không tự chuyển khoản, không thu lại tiền đã giao khách. Correction bookkeeping không có tiền phải giữ đúng cash/bank thực, không dùng journal tiền giả để cân sổ.
- BANK cũng có ca/nguồn hợp lệ, CASH đủ nguồn chuẩn dưới lock; ca đóng không nhận biến động mới, correction ca sau không rewrite snapshot cũ. Không chia nghiệp vụ thành admin-only trái quyền mọi thành viên; account/global audit vẫn admin.
- Test mọi managed source trước/sau nghiệp vụ phụ thuộc, thiếu/false/string confirmation, sai amount, tiền đã/ chưa thực, ca sau/đóng, hai actors, lost response/fault. Cùng nguồn chỉ một correction hợp lệ theo contract.

### A2. S11-03 — mã journal có bound và business identity

- Mã collect48 > VARCHAR40, mã reverse loss41 >40, loss lần2 cùng receipt trùng code. Sửa generator/ID/source event tối thiểu cho collection/loss/correction; không truncate tạo collision, không chỉ random code rồi mất chống thu trùng. Nếu đổi schema phải forward migration/fresh/upgrade/types/contracts thống nhất.
- Dùng receipt chuẩn và UUID nguồn thật trong PG tests:5k→2k→3k, nhiều kỳ phạt, mấtA rồi mấtB theo policy được mở, reverse mã dài tối đa, retry/key khác của cùng action. Giữ unique/immutable journal; không nới mock hoặc bỏ constraint để pass.

### A3. S11-04, S11-05, S11-06 — loss mapping và nhận sách vật lý

- Loss query đang nhận cả item_idNULL rồi giữ cả150k cho mấtA cọc50k, B còn giữ mất cọc. Bắt coverage/state/remaining/source mapping từng item; ambiguous receipt-level/missing/multiple phải reject trước mutation hoặc backfill có căn cứ, không đoán theo amount.
- Chỉ forfeit cọc bản mất thực đã nhận. PENDING_COLLECTION chưa có tiền; REFUNDED/TRANSFERRED/VOIDED/FORFEITED không tiêu lại; PENDING_REFUND chưa chi cần cancel/transition source/intent cùng lock/audit, không để intent vẫn chi sau forfeit. Zero cash delta của loss phải giữ.
- FULL trảB sau mấtA hiện UPDATE returned_at cảA. Update đúng tập item đã nhận vật lý; LOST/CARRIED_FORWARD không fake returned_at. Receipt terminal/history/read DTO phải biểu đạt đúng tổ hợp, không giả sách đã tìm lại hoặc hoàn cọc.
- Selector loss dùng exact set một loại IDs hoặc barcode: reject mixed/unknown/duplicate/empty/invalid type/UUID, không OR rồi bỏ selector lạ. Reuse logic selector trả sách nếu phù hợp, tránh thêm một parser lệch khác.
- Test mấtA/trảB, trảA/mấtB nếu policy cho phép, pending refund-vs-loss, đã carry/mất/trả, legacyNULL và nguồn thiếu, GET/reload/history. Không tự mở mixed-loss/lost-found/damaged policy còn chưa chốt.

### A4. S11-07, S11-08 — lock order và policy gate

- Renew khóa receipt→session nhưng return session→receipt, tạo chu trình chờ. Loss/correction cũng lệch order. Chốt một thứ tự session/receipt/item/copy/allocation/intent/journal theo toàn bộ callers; đọc sơ bộ/recheck version sau lock nếu cần, không giữ lock khi gọi ngân hàng/provider.
- Two-connection PG có barriers/observer/blocking assertions/deadline/cleanup cho return-vs-renew/loss/refund/collection/correction/close. Retry40P01/serialization phải có bound và chắc rollback, giữ action/key, không replay thu tiền ngoài đời. Unit Promise.all hoặc sleep không thay PG proof.
- Guard policy renew phải chặn cảP=D vàP>D khi tiếp tục giữ sách chưa chốt; hiệnP=D vẫn thu riêng và giữ cọc. Gate fine pending/old fine pending, mixed loss và quỹ thụ hưởng còn mở phải explicit, không hardcode FUND_LOAN thành được phê duyệt. Reuse forfeitDeposit policy guard khi đúng use case.
- Giữ nhánh đã rõ chạy độc lập: trong hạn, miễn có lý do, thu phạt dưới cọc đã xác nhận. Không tự ápT73 partial sang renew, tự thu cọc mới, tăng lượt/hạn ở nhánh policy blocked hoặc dùng test thay quyết định chủ sản phẩm.

### A5. S11-09, S11-10 và carryover cũ — read contract và bằng chứng

- Amount/quote/source riêng cho khoản tiền mới, server tính cọc, strict confirmation, safe integer VND/bounds/UUID/type; issue confirmedAmount optional và confirm-deposit thiếu amount cần sửa. Không suy xác nhận phạt từ flag chung của tiền khác.
- Persist price nullable/căn cứ cọc/policy/hạn gốc-hiệu lực/version cần đối soát, phân biệt historical/current metadata. GET thêm lost_at/reason và correction/collection/pending state cần cho UI; không field DTO optional rỗng hoặc cache response thay read model.
- Source cash chuẩn hoặc invariant materialized atomic đúng1lần, không min(field,journal) im lặng; actual count khác expected. Lineage nhiều cấp/ca nhận–chuyển–hoàn và shared transfer phải truy nguồn thực, không journal giả.
- targetId/source collection rõ và action ID/expected version ổn định; không optional fallback PENDING mới nhất khiến retry đổi khoản thu. actionId chỉ audit chưa chống business duplicate. HTTP key/payload/path/actor và live role kiểm trước replay; hai ý định thật khác nhau vẫn được phép theo giới hạn nghiệp vụ.
- Fix fixture open500k/1triệu sau seed350k thiếu discrepancyReason, mở lại cùng ngày, unit settlement_typeRETURN sai CHECK. Giữ guard buổi/bàn giao; fresh+upgrade08/09/10 có dữ liệu, unpaid/paid/forfeited/waived/ambiguous, không current baseline+all migrations rồi gọi upgrade proven.
- Giữ các sửa thật của11: bỏ updated_at, parse JSON mới, resolve BANK session, holiday active update/audit; hoàn thiện version/base/calendar concurrency phần còn thiếu. Không lặp finding đã sửa thành chưa sửa.
- Auth03/provider/app-role/body/Origin/CSRF/rate và catalog06 metadata/date nhập/review ngoài lát12 vẫn ghi đúng gate. Chỉ sửa phần cần cho quầy/trust boundary, không triển khai toàn module khác. Diagram source/render phải đồng bộ phần đã làm.

## B. Adapter quầy, đăng nhập và nguồn dữ liệu

- Login nội bộ tên đăng nhập+mật khẩu gọi `/api/v1/auth/login-internal`; lấy actor từ `/api/v1/auth/me`, logout endpoint hiện có. Không điều hướng vào quầy coi là login xong, không dùng role switch/client flag/URL làm quyền, không gán guest Google thành internal member.
- Tái dùng cookie HttpOnly hiện có, credential flow và env cùng origin/dev proxy đúng runtime. Không lưu password/session token/PII vào localStorage hoặc bundle secret/service-role key; không thêm bearer từ ô role selector. Origin/CSRF/CORS theo topology thật: exact allowed origin, credentials chặt, không wildcard/bypass vì lỗi kết nối.
- Chưa rõ actor thì loading, không render chớp dữ liệu nội bộ. 401 hết phiên xử lý đăng nhập lại;403/revoked/alumni xóa dữ liệu nhạy cảm/cache và chặn mutation. Alumni chỉ route hoạt động safe, không tải PII/quỹ rồi che CSS, không export.
- Một adapter typed nhỏ cho endpoints đang có: catalog copies/borrowers/loans/detail/settlement/renewals, session today/summary/open/close, issue/settle/refund/renew/confirm-deposit/collect-fine/loss/correction/calendar. Không viết repository framework hoặc API giả khi server handler đã có.
- Map DTO server sang view model có kiểm date/VND/status, giữ source IDs bên trong để thao tác đúng. Không cho display name/barcode demo thay ID thật. Search/pagination bounded, không tải toàn bộ PII/sách để UI tự lọc, không invent measured performance.
- Live adapter không import INITIAL_* làm fallback. Fixture adapter chỉ chạy explicit test/demo có banner rõ, không gọi mutation backend/credential thật; lỗi live vẫn là lỗi live. Các module13–22 chưa nối giữ prototype nhãn rõ hoặc disabled, không mở rộng12.

## C. Giao diện quầy theo response server

### C1. Mở/đóng ca và đối soát

- Tải current session/summary, actual opening nhập bởi trực chính, nguồn bàn giao/lý do lệch; server quyết định được mở buổi hay chưa. Một hộp tiền chung, tài khoản nhập riêng. Không đặt sẵn tiền demo làm tiền thực.
- Summary phân CASH/BANK và cọc phải hoàn/phạt/thực thu/chi. Tiền cọc khác doanh thu, transfer cash-neutral khác thu mới. Close nhập actual cash/reason, hiển thị expected/actual/discrepancy và chứng từ pending; response server mới là đóng thành công, không chỉ set isClosed.
- Session đã đóng chặn thao tác cần ca; lỗi stale/close race refresh và giữ input để đối soát. Không lặng lẽ đổi sang buổi khác, bù quỹ hoặc sửa snapshot cũ.

### C2. Mượn, trả và chuyển tiếp

- Tìm/tạo borrower đúng API, chọn tối đa2 bản AVAILABLE không trùng, server quote/cọc tối thiểu50k theo từng bản, sách không giá50k; server amount đối chiếu sau thay giá. Submit có method/xác nhận tiền đúng nguồn, ca/actor/ID thật.
- FULL chọn đúng các bản hiện còn giữ; PARTIAL chỉ đúng1trong2. Case0/2 reject cảUI vàserver, không tạo phiếu rỗng/reset hạn khi không nhận sách. Lost/carry items hiển thị lịch sử riêng, không tick nhận vật lý nữa.
- Fine1k/ngày cảphiếu, ngày Việt Nam/hết ngày/+14/lịch nghỉ lấy server, không hardcode ngày hoặc luôn3k. Giảm/miễn cần reason; nhập số phạt thực được xử lý và error hiển thị đúng field.
- Tách nhận sách, quyết định phạt, refund intent và chi cọc. Method hoàn khác lúc nhận được, method/confirmation thu phạt riêng. Status pending không hiển thị “đã hoàn/đã thu”; xác nhận tiền phải sau kiểm app/giao tiền thực.
- PartialP0/P60,D150: nhậnA, chuyểnB/cọc100k không journal tiền giả, refundA50k chờ/confirm. T73P>=D: giữ150k, cọc mớiB100k theo workflow đã chốt; chưa nhận100k thì pending/copy vẫnBORROWED, không giả có đủ cọc. Không lấy tiền chuyển tiếp cũ làm thu mới.

### C3. Gia hạn, mất và sửa sai

- Renew hiển thị current due/count, dự kiến server và lịch sử; sớm cộng hạn cũ14, overdue chốt phạt rồi từ today14, max3. Không fake return/new receipt để gia hạn. Policy branch blocked phải báo rõ và giữ nguyên tiền/lượt/hạn.
- Loss chọn đúng bản đang giữ, reason, số cọc dự kiến theo source, xác nhận thao tác riêng. Mất74k/cọc50k chỉ giữ50k, zero cash delta. Không nhận “tiền cọc mới” hay fake returned/lost-found. Reload nhận đúng lost_at/reason/hold/settlement.
- Correction thao tác từ chứng từ nguồn cụ thể được hỗ trợ, hiển thị tác động dự kiến và reason; không mở ô nhập arbitrary journal để bypass domain. Tiền cần thực thu/hoàn có pending/confirm riêng theoA1; nguồn phụ thuộc conflict phải tra cứu, không nút bỏ qua guard.

### C4. Loading, lỗi, retry và tương tác

- Sau mutation dùng response/refetch cập nhật loan/copy/borrower eligibility/allocations/collections/session summary/history cùng contract. Không setLoans rồi suy tồn/tiền đã lưu. Không optimistic success cho tiền; stale GET không đè kết quả mới, hủy/bỏ response search cũ khi context đổi.
- Một business action giữ ID/key/payload xuyên double-click/timeout/retry; đổi ý định thật mới tạo action khác. Disabled button chỉ bổ sung, server là lớp chống trùng. Timeout/disconnect sau submit = chưa rõ kết quả: tra source/biên nhận/operation status rồi retry cùng key, không báo thất bại chắc chắn hoặc bảo khách chuyển lại.
- Nếu chưa có API đọc trạng thái action đủ để recovery thì bổ sung endpoint/read contract tối thiểu, auth/owner/no-store đúng; không public idempotency cache/PII theo key tùy ý.
-400 field validation,401/403,409state/version/dependency/idempotency,closed/insufficient cash,5xx/network có hướng xử lý và giữ form khi phù hợp. Không swallow error hoặc alert thành công giả. Không log phone/password/token/request body nhạy cảm ra console.
- Desktop/mobile, VND rõ dấu và nhãn chiều tiền, accessible labels, error text, keyboard/focus trap/restore/Escape/modal scroll/touch targets, loading feedback. Không thêm UI kit hoặc test chỉ snapshot từngclass.
- Export/report thật thuộc21; nút chưa triển khai phải rõ trạng thái, không success toast/file giả. GoogleForm/Facebook/bán sách lịch trực ngoài quầy giữ đúng phạm vi.

## D. Nghiệm thu và bàn giao

| Gate | Bằng chứng cần có |
|---|---|
| G-carryover11 | TừngS11-01..10/S10/older carryover, source/test/lệnh/môi trường/kết quả; policy/runtime ngoài lát giữ PARTIAL/BLOCKED |
| G-domain-db | PG fresh+upgrade, journal length/unique, source correction/reconciliation, exact loss mapping/return after loss, lock/race/fault/recovery |
| G-auth-browser | Login→me→reload→logout, active/admin/alumni/guest/disabled/revoked; không role switch quyền thật/PII flash/client secret |
| G-desk-issue | Browser chọn bản→server issue→reload loan/copy/liability/cash; double-click và hai người cùng bản chỉ một hiệu lực |
| G-desk-return | FULL/PARTIAL0/1/2, P0/P60/T73, refund khác method, phạt riêng/pending/confirm; lost/carry không nhận vật lý giả |
| G-desk-renew-loss-correction | max3/lần4, holiday active deadline, policy blocked, loss50k, correction source/pending/confirm/dependency, refresh/history đúng |
| G-session-recovery | Actual/expected/close, BANK/CASH, close race, timeout sau commit/readback/retry cùngaction/key, không thêm thu/chi |
| G-responsive-a11y | Browser desktop1440×900 và mobile390×844, keyboard/modal/focus/scroll/error/loading; screenshot đúng trạng thái thực |
| G-runtime | Static UI, fixture adapter, direct-handler, PG/app-role, Workers HTTP, provider và browser→API→DB tách; không dùng một gate thay gate khác |

- Chạy check/build/OpenAPI lint+semantic parity và regression backend liên quan shared helpers. Browser phải thực hiện workflow và kiểm request/response/DB đọc lại; reload vẫn có dữ liệu nguồn, không local demo. API interception/fixture/browser mock ghi rõ là mock, không nghiệm thu live.
- PG/provider/Workers vẫn blocked thì hoàn thiện fixture adapter/UI/source/tests độc lập và ghi lệnh chạy lại. Không đổi stack, tạo cloud, nhập secret/PII hoặc thêm auth bypass để đạt ảnh xanh.
- Bàn giao files/code/migration/fixtures/API, test command/exit/environment, screenshots desktop/mobile, request/response/SQL giả trước-sau, findings đóng/còn và gate policy/runtime. Diagram source+render phần đổi phải khớp; giữ review11 nguyên snapshot.
- Giữ22 chặng. Hoàn tất từng látA/B/C/D có tóm tắt ngắn rồi tiếp tục trong phạm vi12; không tự tạo task mới. Dừng12, không triển khai thành viên/hội phí13, report21, commit/push/deploy hoặc tiền thật.
