# Review chặng 12 — 19/10/2026

## Kết luận và phạm vi

**PARTIAL — UI đã gọi API nhưng chưa hoàn thành quầy live.** Có API client, login submit, chuyển LIVE/DEMO rõ và nhiều sửa nguồn loss/correction. Nhưng DTO/loader lệch server, FULL return gửi thiếu selector, các khoản pending không có thao tác hoàn tất trên quầy, retry sinh key mới, correction fine đọc cột không tồn tại. Không đóng carryover11 hoặc dùng làm bằng chứng browser/DB đã nghiệm thu.

Đối chiếu manifest11 và prompt12/review11/carryovers. Workspace không có `.git`; snapshot đầu review12 `.review-artifacts/stage12-review-manifest.json` gồm139 file. Tải dự kiến dưới5.000 sách, dưới100 lượt/buổi,3–5 người ghi. Không sửa implementation, commit/deploy/DB/PII thật; không Go thuộc phạm vi. Tool browser báo **Local browser use is disabled in Work settings**; không chạy browser/desktop/mobile và không dùng screenshot cũ thay bằng chứng hiện tại.

## Findings bắt buộc sửa

### S12-01 — P1: API client chỉ ép kiểu, DTO và catalog loader không khớp server

**Vị trí:** `src/lib/api-client.ts` CashSessionDto/LoanItemSnapshotDto/LoanReceiptDto/requestJson; `src/components/InternalWorkspace.tsx:138–184,1004,1627–1659`; `src/server/finance/cash-sessions.ts:94–117`; catalog/service182–191.

Server cash session trả snake_case (`expected_closing_cash`, `is_closed`), client/UI đọc camelCase. Receipt trả totalDeposit/isReturned/carriedForwardAt nhưng client khai totalDepositAmount/returnedAt, bỏ carried state; status client còn thiếu OVERDUE/LOST. Catalog search chỉ trả summary/count, loader chờ mỗi book có copies nên liveCopies trống dù có sách. Query chỉ trang đầu và adapter bỏ meta, UI chưa tìm/phân trang đủ dữ liệu.

**Bằng chứng:** API adapter→router thật trong process với SQL double: cash250k tồn tại ở expected_closing_cash, expectedClosingCash undefined; totalDeposit50k/totalDepositAmount undefined; item có isReturned, không returnedAt. Source catalog không có copies. Danh sách loans thực trả data array + meta, không báo lỗi sai “server trả object thay array”.

**Sửa:** một contract canonical hoặc mapping có kiểm rõ; adapter giữ meta/status/history cần thiết. Search/scan/fetch copy đúng endpoint, không load toàn bộ bản/PII để lọc client. **Test:** adapter→handler với DTO thực, ca mở/đóng, sách available/returned/lost/carry, pagination >20; UI có bản để mượn và cash đúng sau reload. Generic TypeScript cast không kiểm JSON runtime.

### S12-02 — P1: FULL return từ UI luôn thiếu selector bắt buộc

**Vị trí:** `InternalWorkspace.tsx:346–355`; apiClient.settleReturn; rules return selectors.

UI đã tính returnedBarcodes cho FULL nhưng payload chỉ gửi mảng khi PARTIAL; server đã chặn omitted selectors từ08. **Repro:** gọi adapter với đúng payload FULL của handler →400 MISSING_RETURNED_COPIES_SELECTOR. Không thể ghi nhận trả toàn bộ qua đường này.

**Sửa:** luôn gửi tập sách thực nhận rõ và khớp trạng thái hiện tại, loại lost/carry/đã trả; server giữ exact-set guard. **Test:** UI/adapter FULL1/2 cuốn, mấtA trảB, partial0/1/2, stale receipt, không nới validator để “tương thích UI”.

### S12-03 — P1: Quầy hardcode phạt/xác nhận, bỏ workflow thu–hoàn pending và cọc T73

**Vị trí:** `InternalWorkspace.tsx:340–355,1673–1730,1792–1818`; mọi apiClient callers trong component.

Phạt gợi ý/thực mặc định luôn3k; ngày client theo timezone trình duyệt; return gửi paymentConfirmed:true và finePaymentConfirmed:true khi có phạt, method fine cố địnhCASH, không có xác nhận thực thu riêng. Renew checkbox tiền phạt mặc địnhtrue. UI không gọi getLoanSettlement/confirmRefund/confirmNewDeposit/collectPendingFine/getSessionSummary dù adapter có: nhận sách tạo refund intent nhưng không có chỗ hoàn cọc; phiếu PENDING_DEPOSIT chỉ hiện nhãn không có nút thu mới100k. T73 không gửi confirmation/method cọc mới, không hiển thị trạng thái phải nhận/hoàn theo nguồn.

**Hậu quả:** phạt7ngày UI đưa3k, có thể bị thiếu reason400 hoặc ghi số khác gợi ý nếu có reason; tiền chưa thu vẫn bị xác nhận. Sách trả xong nhưng cọc chưa chi mà người trực không có luồng hoàn tất. **Sửa:** server quote/cutoff/date/VND, form confirmation mặc địnhfalse, method từng chiều riêng; UI pending queues/detail/finalize/cancel/readback đúng nghiệp vụ, P0/P60/T73. **Test:** full/partial, nghỉ lễ, waive reason, CASH/BANK khác method, pending→ca sau confirm, cọc150k dùng hết→nhận100k thật, không journal tiền giả.

### S12-04 — P1: Mỗi lần retry API sinh key mới, không tra kết quả chưa rõ

**Vị trí:** api-client generateIdempotencyKey và mọi mutation; UI handlers/error paths232–501.

Key được tạo bên trong mỗi lần gọi, caller không giữ/truyền lại action/key/expected version. Timeout sau commit rồi người trực bấm lại biến thành ý định khác. **Repro:** hai apiClient.renewLoan giống nhau sinh hai key và renew_count0→2 trên cùng phiếu trong double. Hai yêu cầu độc lập có thể hợp lệ, nhưng đây là khả năng khi retry cùng ý định vì adapter không có contract phân biệt.

**Sửa:** action/key/payload sống qua double-click/timeout/reload cần recovery; cached response/operation source đọc theo quyền, live role trước replay. Chỉ ý định thật mới tạo key mới, không auto-retry tiền bằng key mới. **Test:** mất response sau commit rồi retry cùng action không tăng count/thu thêm; khác body/path409, key khác cùng business source không tiêu hai lần; lỗi mạng không báo chắc đã thất bại.

### S12-05 — P1: DEMO vẫn gọi mutation live; lỗi auth/server còn giữ dữ liệu cũ

**Vị trí:** `InternalWorkspace.tsx:116–205,369–501,823–828` và chuyển workspaceMode.

Chỉ issue/return có branch DEMO. Open/close session, renew, loss, correction luôn apiClient. Nếu đã login/liveSession được giữ rồi chuyểnDEMO và bấm Đóng Ca Demo, handler vẫn gửi closeSession(liveSession.id) vào backend thật. Demo không là fixture adapter cách ly, không đủ banner để ngăn side effect. loadLiveData lỗi401 chỉ setAuthError, lỗi403/5xx chỉ setApiError; không clear actor/loans/session/PII hoặc bỏ response cũ sau đổi mode/role. getMe GUEST bị map ACTIVE_MEMBER nếu không alumni; server vẫn giữ quyền API, không gọi đây là bypass server Auth.

**Sửa:** một adapter/mode boundary cách ly mọi request; DEMO không credential/mutation live, reset state khi đổi mode. Fail closed trước internal render, actor allowlist MEMBER/ADMIN/ALUMNI riêng, clear sensitive caches on revoke/logout/401/403; abort/version stale loads. **Test:** fetch spy cho mọi demo action =0 backend mutations; live→demo→close, out-of-order loads/revoke/guest/5xx, không PII flash. Browser gate còn thiếu, case demo là source-traced path, chưa quan sát UI thật.

### S12-06 — P1: Correction LOAN_FINE truy cột không tồn tại và sai nơi lưu decision

**Vị trí:** `src/server/finance/ledger.ts:570–588`; receipt schema; fine source writers.

LOAN_FINE correction SELECT fine_collected_amount/fine_pending_amount/fine_status từ loan_receipts rồi UPDATE bảng này. Cả baseline/migration đều không có các cột đó; decision thật ở loan_settlements/loan_renewals. Source_id fine còn có khi là receipt ID, có khi là settlement/renewal ID; không được tự JOIN sai domain hoặc không tìm thấy rồi vẫn reverse.

**Bằng chứng:** DDL column adapter trả42703, rollback correction. SQL double không enforce column nên unit tránh lỗi; chỉ test unsupported refund không chứng minh fine correction. **Sửa:** source-specific correction/collection model liên kết decision thật và payment, hoặc reject nhánh chưa hỗ trợ; không thêm các cột giả lên receipt để né tìm nguồn. **Test:** thu ngay/thu pending nhiều đợt/renewal, paid/partial/reversed/ca sau, assert nguồn + journal + cash và fault/recovery thật.

### S12-07 — P1: Mã collection mới trùng giữa hai kỳ phạt trên cùng receipt

**Vị trí:** `circulation/service.ts:2135–2147`.

rcpShort chỉ thuộc receipt; seq COUNT theo targetId nhưng code `JE-FN-${rcpShort}-COLLECT-${seq}` bỏ target. Hai nguồn fine trên cùng phiếu đều lần1 sinh cùng code. Ví dụ legacy pending renewal rồi settlement khi trả: thu renewal thành công, thu settlement bị23505. Sửa chiều dài11 là đúng, nhưng chưa bảo toàn identity nguồn.

**Bằng chứng:** fixture hai decision theo lịch sử hợp lệ, unique adapter →source thứ hai lỗi23505, settlement còn5k. **Sửa:** ID/code bounded theo collection/source event có business uniqueness, không truncate nguồn tạo collision hoặc random để né dedupe. **Test:** hai nguồn cùng phiếu/cùngseq, nhiều đợt, reverse/retry/concurrent collectors, PG unique và mã chiều dài thật.

### S12-08 — P1: Loss coverage chỉ reject khi không có allocation nào, vẫn bỏ sót một phần

**Vị trí:** `circulation/service.ts:2415–2435`.

Đã sửa case mất một cuốn giữ cả cọc chung150k: giữ sửa. Nhưng chỉ kiểm ambiguous khi forfeitAllocations.length===0; nếu A có mapping50k còn B receipt-level100k và yêu cầu mấtA+B, code có một allocation nên không reject. Cả hai copy/receiptLOST nhưng chỉ forfeit50k, cònHELD100k mắc trên receipt terminal. Coverage phải theo từng item/source, không “có ít nhất một row”.

**Repro:** double case trên→bothLOST/receiptLOST/forfeit50k/HELD100k. **Sửa:** validate toàn bộ coverage/state/amount trước inventory mutation; ambiguous/missing reject hoặc migrate có căn cứ, pending chưa nhận không giả forfeit. **Test:** mixed mapped+NULL, missing/multiple/partial source, pending refund cancel/race, từng item + global liability, terminal không còn khoản chờ không có recovery.

### S12-09 — P2: Lock order vẫn chưa thống nhất, các contract cũ khác chưa đóng

**Vị trí:** renew service1546–1552 rồi1657resolveSession; return session→receipt; correction ledger417–438,503–505,537–556.

Renew vẫn receipt→session nên chờ vòng với return session→receipt như11; correction chỉ session-first khi caller gửi session, tự resolve vẫn sau journal và allocation→receipt. Comment không thay order thực. Chưa PG overlap nên đây là code-inferred deadlock schedule, không claim đã quan sát40P01 hoặc mất atomicity.

Price/policy/date snapshots/amount quote/safe-boundaries, canonical cash min(field,journal), lineage nhiều cấp/business action, fund/mixed-loss policies và provider/app-role còn mở. LostAt/Reason đã thêm và P>=D renewal đã chặn: không báo lỗi đó còn nguyên. **Sửa/test:** một lock order đủ callers, recheck version, PG barriers/observer/deadline; snapshot/source/validation theo review11, không rename finding thành việc khác rồi đóng. Các phần ngoài lát được ghi gate, không kéo toàn bộ module tương lai vào carryover.

### S12-10 — P2: Gate browser/session recovery/carryover PASS vượt bằng chứng

**Vị trí:** progress37–39/README; tests/unit/stage12-desk.test.ts; integration fixtures; UI modals.

6 test mới là backend double, không adapter-to-handler/React/browser tests; test length chỉ một nguồn. PG42 test chưa qua setup, fixture bàn giao/ngày và upgrade cũ chưa thay. G-auth-browser/G-responsive/G-session-recovery PASS không có runtime proof phù hợp trong lượt review. Modal thiếu dialog semantics/focus trap/Escape/scroll bound; cần browser a11y/mobile thật, chưa được nghiệm thu chỉ từ class responsive. Một số LIVE module vẫn render INITIAL_* và export preview giả; phải nhãn/disabled cho đến module sở hữu.

**Sửa:** proof levels riêng source/unit/adapter/direct-handler/PG/app-role/Workers/provider/browser/files; fixtures hợp contract, tests bắt các lỗi S12. Không thay test09/10/11 đã mất gate bằng test mới thuận lợi. Current browser bị Work settings tắt; source-only không chốt layout/mobile. Diagram/render/OpenAPI chưa đồng bộ các body/DTO12 (OpenAPI không đổi trong implementation12), lint pass không là parity.

## Đối chiếu S11 và các chặng trước

| Finding11 | Tại12 |
|---|---|
| S11-01 correction domain | Unsupported refund/forfeit/carry đã reject, active deposit có guard; fine branch mới lỗi S12-06; OVERDUE/dependency/pending correction chưa đủ |
| S11-02 confirmation | CASH/BANK strict true đã thêm; expectedAmount optional, chưa pending/quote/source UI đầy đủ; không lặp omitted flag200 cũ |
| S11-03 journal codes | Đã bound/mở cột64 và loss sequence; giữ sửa length/repeated-loss. Collection nhiều source còn S12-07 |
| S11-04 loss allocation | Mất một cuốn receipt-level ambiguous đã reject, cancel pending refund đã thêm; partial coverage còn S12-08 |
| S11-05 physical return | UPDATE đúng item IDs đã sửa, lost item giữ returned_atNULL; adapter/UI sai field còn S12-01 |
| S11-06 selector | Duplicate/mixed/unknown đã sửa source/tests, giữ; UUID/type/length boundaries chưa đủ |
| S11-07 locks | Loss explicit session trước receipt, correction explicit session trước journal; renew/implicit paths còn S12-09, PG proof BLOCKED |
| S11-08 policy | Renewal P>=D đã chặn; fund thụ hưởng/mixed-loss/old pending fine policy còn, test không là phê duyệt |
| S11-09 snapshots/action/cash | LostAt/Reason đã đọc; còn price/policy/calendar snapshots, amount/quote, business retry và min/lineage |
| S11-10 evidence/UI | Có LIVE/DEMO/login/handlers/radio PARTIAL; R09 lỗi chọn0/2 cải thiện bằng radio/backend guards. R10 money/pending/cash/refresh/retry và live isolation chưa đóng |

| Nguồn cũ | Gate hiện tại |
|---|---|
|02 | Max2/active uniqueness/fresh+upgrade/constraints/concurrency PG chưa nghiệm thu |
|03 | Managed provider/token lifecycle/revoke/multi-instance/app-role/Origin/CSRF/body-size/rate chưa proof; cookie request không là Auth browser pass |
|04–05 | Ledger source/reconciliation/cash/collection/correction/idempotency/close races và handover fixture còn như findings |
|06–07 | Catalog summary không là copy lookup; associations/date nhập/review/metadata ngoài lát chưa đủ; price0/TX/audit/BANK source giữ sửa, issue amount/snapshots chưa đóng |
|08–10 | Strict refund/selectors/settlement DATE/carry order/calendar active giữ sửa; pending recovery/amount/history/PG còn; không fake returned cho carry/lost |
|R09/R10 | Backend guards và radio tránh partial rỗng tốt hơn; live FULL/fine/pending/DTO vẫn chặn quầy, không đóng bằng screenshot demo |

## Kiểm tra mới

| Check | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;61 files;0 errors/0 warnings/7 hints;tsc pass | Không SQL/JSON runtime |
| Static build stage12-build | Exit0;3 pages,3.43s | Có3 Vite optimizeDeps warnings; không Workers/API/Browser proof |
|14 unit files, isolation none | Exit0;124 pass,0 fail,678.49ms | SQL doubles; wrapper file không khai báo test |
| Python unittest | Exit0;22 pass,0.023s | PoC/regex |
| Redocly2.64.1 | Exit0;0 errors/22 warnings | Chưa semantic parity |
|10 PG files, isolation none/concurrency1 | Exit1;42 before-hook DB_RUNTIME_MISSING,0 pass |0 assertion nghiệp vụ PG |
| Docker/PATH/env | Docker pipe missing; psql/postgres không PATH;TEST_DATABASE_URL absent | Không cloud/DB thật |
| Wrangler local8796 | Exit1 spawn EPERM | Chưa HTTP Workers |
| Astro dev | Có ready4321 rồi log Failed to create the dev server app: module is not defined | Chưa chẩn đoán nguyên nhân; không nhận dev runtime sẵn sàng |
| Browser CUA | BLOCKED: Local browser use is disabled in Work settings | Không tương tác/screenshot desktop/mobile mới |
| Counterexamples12 | Exit0 | In-process adapter→router + SQL double/DDL adapters;0 network/real DB write |

Script/JSON `.review-artifacts/stage12-counterexamples.mjs` và `.json`. Fetch bridge thêm actor giả và gọi handler trong process: không chứng minh cookie/login/provider/HTTP/browser. DDL adapter mô hình hóa cột/UNIQUE hiện có, không PG execution. Không dùng browser khác/puppeteer để lách Work settings.

## Bàn giao tiếp tục

Theo yêu cầu mới, [prompt tổng điều phối](../prompts/antigravity-next/continue-13-to-22.md) sửa S12/carryover trước, rồi tự làm tuần tự13→22. Không phải bắt đầu13 trên nền đang được coi đã PASS. Các điểm dừng một-chặng trong prompt cũ được thay bằng checkpoint nội bộ; không cần người dùng giao lại từng chặng. Hạ tầng/policy/UAT ngoài phạm vi giữ gate và tiếp tục phần độc lập, không tự deploy/PII/tiền thật hoặc nhận toàn sản phẩm đã nghiệm thu.
