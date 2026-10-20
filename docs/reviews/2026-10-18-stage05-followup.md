# Review chặng 05 — 18/10/2026

## Kết luận và phạm vi

**PARTIAL — chưa nghiệm thu tiền, Auth tích hợp hoặc HTTP finance trên runtime thật.** Có implementation mở/đóng ca, snapshot tiền cuối buổi, refund intent, DB token revocation và constraint mới. Tuy nhiên các đường ghi tiền chưa cùng khóa/transaction với đóng ca; đảo cọc có thể chọn nhầm bút toán; logout nuốt lỗi DB; nội dung COMPLETED chưa duyệt vẫn lọt tới cựu thành viên. Không thể xác nhận “giải quyết triệt để S04-01..08”.

Đối chiếu prompt05, report04 và snapshot `.review-artifacts/stage04-review-manifest.json`; snapshot đầu review05 là `.review-artifacts/stage05-review-manifest.json` (67 file). Workspace không có Git metadata để lấy commit/diff. Review không sửa implementation; chỉ thêm bằng chứng local và tài liệu bàn giao. UI không đổi nên không lặp browser review cũ. Không có Go thuộc phạm vi.

## Findings cần sửa

### S05-01 — P1: Đóng ca không khóa được đường ghi tiền; ca đã đóng vẫn nhận journal

**Vị trí:** `src/server/router.ts:476–525`; `src/server/finance/cash-sessions.ts:218–301,315–370`; `src/server/finance/ledger.ts:73–129`; `docs/technical/schema/01_schema.sql` bảng cash_sessions/journal_entries.

Router truyền Pool trực tiếp vào helper nhiều câu SQL, không checkout client và BEGIN/COMMIT. SELECT FOR UPDATE của close vì thế kết thúc khóa ngay sau câu SELECT theo autocommit. Quan trọng hơn, recordJournalEntry/receive/confirm/reversal không khóa hoặc kiểm cùng session: ngay cả caller có transaction cũng chưa giải quyết được cạnh tranh. cash_session_id còn tùy chọn; FK không chặn journal vào ca đã đóng. Summary chỉ lọc session ID, không lọc quỹ, nên có thể cộng cả FUND_OPERATION vào hộp tiền mượn–trả.

**Tái hiện offline:** mở200k → đóng thực200k → nhận thêm cọc CASH50k vào ca đó vẫn được; snapshot lưu200k nhưng summary tính lại250k. Journal quỹ hoạt động gắn cùng session tiếp tục đẩy số hộp tiền lên350k. Ghi CASH không session cũng được. Đây là SQL double dùng logic thật, chưa là execution PostgreSQL; DDL hiện không có điều kiện trạng thái/quỹ tương ứng để bù.

**Sửa:** một transaction trên cùng client cho mỗi use case; thứ tự khóa chung, khóa session trước mọi chuyển động tiền thuộc hộp tiền rồi kiểm open/quỹ. Cấm bỏ session với CASH thuộc hộp tiền; quy định rõ journal BANK được gắn buổi để báo cáo nhưng không cộng hộp tiền. Các quỹ/hộp khác không được tự gắn vào hộp này. Giữ snapshot đóng bất biến; sửa sai bằng chứng từ ở ca hợp lệ, không backdate reversal về ca đã đóng. Không coi thêm BEGIN vào helper nhận Pool là đủ. Khi Auth/DB chưa nghiệm thu, giữ HTTP tiền chưa sẵn sàng thay vì công bố dùng tiền thật.

**Hồi quy:** hai connection thật, close tranh receive/refund/reversal; kết quả chỉ có một thứ tự hợp lệ, không có ghi sau close; lỗi giữa journal/allocation/snapshot/audit rollback tất cả; ca đóng đọc lại không đổi. Kiểm cả đường gọi trực tiếp helper và route, không chỉ kiểm tra is_closed trong test. Đường bị ảnh hưởng: nhận cọc, xác nhận hoàn, bút toán phạt, sửa sai và quỹ hoạt động.

### S05-02 — P1: Đảo allocation 100k có thể đảo journal 50k của cùng phiếu

**Vị trí:** `src/server/finance/deposits.ts:177–185,574–632`; `ledger.ts:157–224`.

receiveDeposit ghi source_id bằng receipt ID. reverseDepositAllocation tìm journal bằng receipt đó với LIMIT1, không liên kết allocation/item được chọn. Phiếu hai cuốn50k+100k có hai journal cùng source; đảo allocation100k có thể chọn journal50k. Allocation100k về0 nhưng ledger chỉ giảm50k. assertLiabilityReconciliation mới có không tự chạy trong use case để ngăn commit. Cờ allowDirectSourceReversal còn là cơ chế bypass có thể bị caller dùng sai; reversal giữ cash_session_id của journal gốc, liên quan S05-01.

**Phản ví dụ SQL double:** chọn allocation100k; journal bị đảo50k; allocation còn tổng50k nhưng ledger liability100k. Double bổ sung hai dạng SQL đang dùng và mô hình hóa một kết quả LIMIT1 hợp lệ; chưa chứng minh thứ tự trả hàng trên PG, cũng không cần một thứ tự cụ thể để thấy truy vấn thiếu định danh.

**Sửa:** liên kết chính xác journal nhận với allocation/source line; đảo đúng chứng từ được chọn trong cùng transaction, có reason/actor/audit và đối soát nghĩa vụ. Không dùng FORFEITED để ngụ ý vừa void vừa tịch thu mà không phân biệt nghiệp vụ. Chặn helper đảo trực tiếp nguồn nếu chưa có use case phối hợp; không mở API tùy ý cho cờ bypass.

**Hồi quy:** hai cuốn50k/100k cùng phiếu; đảo cuốn100k thì journal và allocation cùng giảm100k, cuốn50k nguyên trạng; retry/concurrent đảo chỉ một hiệu lực; journal gốc thuộc ca đóng không được làm đổi snapshot cũ. Kiểm source nhận/hoàn/chuyển cọc liên quan.

### S05-03 — P1: Logout báo thành công khi lưu thu hồi token thất bại

**Vị trí:** `src/server/router.ts:251–305`.

Đã thay Map instance bằng revoked_tokens trong DB, nhưng catch quanh INSERT revoke/UPDATE token_version bỏ qua mọi lỗi rồi trả200 “Đăng xuất thành công”. Khi DB trở lại, token cũ chưa bị thu hồi tiếp tục được dùng. Hai thao tác DB cũng không chung transaction. resolveActor lỗi bị đổi thành null, nên không nên coi đường này là revocation đã xác minh.

**Tái hiện direct handler, giả lập pool.query lỗi:** logout200; phục hồi query, dùng lại token đó đọc route nội bộ200. Không dùng provider hoặc DB thật.

**Sửa:** xác minh token trước thao tác; phân biệt xóa cookie local với thu hồi server. Không trả thành công thu hồi nếu DB lỗi; trả lỗi sanitized có thể retry. Chốt revocation/token-version/audit cùng transaction phù hợp, expiry theo token và cơ chế dọn hết hạn. Không log raw token. Kiểm multi-instance bằng nơi lưu chung.

**Hồi quy:** DB lỗi tại từng bước, không báo thành công giả; retry sau phục hồi chặn token cũ; token đã revoke không dùng được ở instance khác; token sai không tạo row revocation tùy ý. Provider/password/status gates cũ vẫn cần chạy thật.

### S05-04 — P1: COMPLETED được coi như đã duyệt nội dung cho cựu thành viên

**Vị trí:** `src/server/router.ts:426–449`; alumni DTO trong auth/policy.

Filter thêm APPROVED_FOR_ALUMNI nhưng OR COMPLETED ở cả injected path lẫn SQL. “Đã hoàn thành” không chứng minh description đã duyệt. Description vẫn có thể chứa lịch nội bộ, thông tin liên lạc hoặc tài chính; whitelist tên field không làm sạch nội dung field.

**Tái hiện direct handler:** activity COMPLETED có description nội bộ chưa duyệt, alumni request200 và nhận nguyên description.

**Sửa:** duyệt bản nội dung an toàn riêng, độc lập trạng thái tiến độ; chỉ trả projection đã được duyệt, deny khi thiếu bằng chứng duyệt. Không tự coi COMPLETED là công khai. Giữ đường DB lỗi fail-closed mới có.

**Hồi quy:** COMPLETED chưa duyệt không xuất hiện; approved có description an toàn; sửa nội dung sau duyệt phải theo chính sách duyệt lại/version; alumni không nhận PII/quỹ/export qua list/direct-ID.

### S05-05 — P2: Có thể bỏ qua kiểm bàn giao và mở ca thứ hai trong cùng buổi

**Vị trí:** `cash-sessions.ts:122–205`; router open/today; unique index cash_sessions.

Chỉ cấm hai ca đang mở toàn hệ thống. Sau close, client đổi sessionId có thể mở lại cùng ngày; không có khóa duy nhất theo buổi. Kiểm opening so với actual ca trước chỉ chạy khi client tự gửi handedOverFromSessionId. Bỏ field này thì mất toàn bộ kiểm bàn giao/lý do. Endpoint /today trả ca đang mở bất kỳ ngày nào.

**Tái hiện offline:** ca trước đóng200k; mở lại cùng ngày900k, không prior ID, không reason: được nhận. Đây không phải kết luận rằng mọi thay đổi tiền đầu buổi là sai; vấn đề là phần mềm cho bỏ dấu vết bàn giao/giải trình đã yêu cầu.

**Sửa:** định danh buổi do server kiểm, unique theo buổi; liên kết ca trước theo nguồn chuẩn, không tin client bỏ field. Buổi đầu nhập opening thực tế; về sau chênh với tiền bàn giao phải có giải trình, không tạo thu ảo. Với /today lọc ngày địa phương hoặc đổi contract tên endpoint rõ ràng. Ghi người trực chính xác nhận; không tự giới hạn toàn bộ quyền quản lý của thành viên ngoài quyết định đã chốt.

**Hồi quy:** hai ID/key cùng buổi; reopen sau close; thiếu prior link/chênh opening; ca qua ngày, Asia/Ho_Chi_Minh; trường hợp đầu tiên chưa có predecessor. Nhánh override hợp lệ phải có audit, không bỏ uniqueness âm thầm.

### S05-06 — P2: “Nghĩa vụ cọc còn lại” đang là chênh lệch của riêng ca

**Vị trí:** `cash-sessions.ts:273–302`.

depositLiabilitiesRemaining = cọc phát sinh trong ca − cọc giải phóng trong ca. Ca hôm nay hoàn cọc của tuần trước thì số này âm dù nghĩa vụ thực còn dương. **Phản ví dụ offline:** nhận150k ca trước, hoàn50k ca sau: trường remaining trả−50k nhưng allocation thực còn100k. Ngoài ra debit liability có thể là forfeiture/reversal, không chỉ “refund”.

**Sửa:** tách rõ số dư đầu kỳ, tăng/giảm, số dư cuối kỳ hoặc đổi tên thành delta và cung cấp số dư đúng được yêu cầu. Tính từ cùng mốc/snapshot nhất quán, không dùng chuỗi aggregate rời dưới tải rồi gọi đó là một thời điểm. Tổng bigint khi serialize phải có giới hạn an toàn hoặc dạng chuỗi theo contract.

**Hồi quy:** ca không nhận cọc mới nhưng hoàn cọc cũ; chuyển phiếu cash-neutral; forfeiture/reversal; tiền BANK/CASH tách; tổng nghĩa vụ khớp allocation và ledger tại cùng cutoff.

### S05-07 — P2: Test đóng ca và fixture không kiểm được hành vi đã tuyên bố

**Vị trí:** `tests/integration/cash-sessions.test.ts:29–35,63–110,245–289`; `docs/technical/schema/02_seed.sql:107–108`; `tests/unit/api-routes.test.ts:6`.

Seed tạo sẵn CS-20261018 đang mở, setup không đóng/xóa ca đó. Test đầu kỳ vọng một trong năm open thành công nhưng cả năm đều thấy ca đang mở; đây là lỗi fixture suy ra từ code, chưa execution PG. Test “ca đóng cấm tiền” tự SELECT is_closed rồi tự throw SessionAlreadyClosedError trong test, không gọi đường ghi tiền thật; không phát hiện S05-01.

api-routes.test import class từ cash-sessions.test, đồng thời đăng ký lại sáu test trong process khác của runner mặc định. Con số48 không là48 ca độc lập. Chạy chung process thu43 pass, gồm42 test khai báo và một wrapper file không có test. Đây là vấn đề chứng cứ, không có nghĩa test pass bị giả tạo.

**Sửa:** fixture trung lập/riêng từng test; đưa SQL double sang helper không đăng ký test. Test gọi public use case thật, bỏ assert tự tạo lỗi. Bổ sung close-versus-write, refund đúng ca chi, idempotency overlap có observer assertion/deadline/cleanup trên hai connection. Test idempotency đã bỏ lịch chờ cũ nhưng vòng quan sát lock chưa assert đã thấy blocking, chưa đủ bằng chứng overlap.

### S05-08 — P2: Hợp đồng HTTP và nhãn nghiệm thu vượt bằng chứng

**Vị trí:** `docs/technical/openapi.yaml:376–426`; router finance; README/progress chặng05.

OpenAPI thiếu open và summary; close không yêu cầu sessionId dù route yêu cầu. Shape response cũng chưa mô tả envelope/summary thực. Money routes chưa dùng shared idempotency, retry close trả409 thay vì replay kết quả của cùng ý định; X-Idempotency-Key không có hiệu lực tại đây. Chưa thấy Cache-Control:no-store cho response tiền, validation body/path/date/size/Origin đầy đủ hoặc thao tác xác nhận trực chính theo yêu cầu. Đây là các mục phải hoàn thiện trong cùng HTTP gate, không là bằng chứng production bị khai thác.

Progress vẫn gọi cả tám carryover fixed, gộp direct-handler unit thành G-http/runtime PASS, ghi file auth/store.ts không tồn tại và “100% ACID” khi DB chưa chạy. Lint OpenAPI pass chỉ kiểm cấu trúc, không kiểm parity source.

**Sửa/hồi quy:** đồng bộ routes/schema/status/envelope, áp idempotency tại biên use case trong transaction cùng side effect/result/audit, replay kiểm actor và payload; bounds/cache/Origin theo threat model Auth hiện tại. Test request mất response rồi retry không mở/đóng/ghi hai lần; cùng key khác payload conflict, actor khác không xem cached result. Ghi riêng unit, PG, handler, Workers HTTP, provider và application-role grants; không đóng gate bằng số lượng test.

## Đối chiếu tám lỗi chặng04

| Finding04 | Tiến triển05 | Kết luận review |
|---|---|---|
| S04-01 trùng nhận/hoàn | Có refund_intents, confirm theo intent, unique allocation đang active | Đã cải thiện source; DB/retry terminal source chưa được kiểm; chưa đóng toàn bộ |
| S04-02 đảo journal | Chặn đảo trực tiếp source, lưu reason, có reconciliation helper | Còn S05-02; helper reconciliation chưa bảo đảm transaction rollback |
| S04-03 test concurrency | Client2 chạy background, client1 được commit | Hết lịch chờ cũ trong source; observer/deadline và execution PG còn thiếu, S05-07 |
| S04-04 logout instance | Có bảng revoked_tokens và DB lookup | Còn failure path S05-03; chưa có multi-instance/provider proof |
| S04-05 nội dung alumni | Lọc status và không còn fallback thành công khi DB lỗi | Còn COMPLETED bypass S05-04 |
| S04-06 forfeit | Bắt buộc policy/reason, chặn trạng thái pending/terminal | Cải thiện đúng hướng; policy phân quỹ thực và DB/audit chưa nghiệm thu. Policy trong test không là quyết định mới của CLB |
| S04-07 alumni/admin | Thêm CHECK DB, kiểm trạng thái hiện tại | Chưa chạy PG; PATCH admin với chỉ isAlumni:true bị chặn trước nhánh tự bỏ admin. Chốt contract chuyển trạng thái, test atomic token invalidation/audit |
| S04-08 bằng chứng | Có ghi DB BLOCKED | Vẫn overclaim carryover/runtime/contract, S05-07/08 |

Các gate03 về managed Auth, Origin/body limits/rate-limit, quyền DB và runtime Workers chưa tự hoàn tất vì05 thêm unit test. R01/R03/R04/R05 và các phần circulation/UI khác tiếp tục theo index22chặng; không mở rộng review này thành review lại toàn repo.

## Kiểm tra thực hiện

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `rtk pnpm run check` | Exit0;35 file;0 error,0 warning,16 hint;tsc pass | Không kiểm money/SQL |
| Astro build vào `.review-artifacts/stage05-build` | Exit0;3 trang static | Không là Workers/backend HTTP |
| Sáu file Node unit, `--test-isolation=none` | Exit0;43 pass,0 fail |42 declarations + wrapper; SQL double/direct handler; không PG |
| Python unittest discover | Exit0;22 pass | PoC/regex, không thay DB |
| Redocly2.64.1 lint | Exit0;0 error,24 warning | Chưa khớp implementation ở S05-08 |
| Bốn file DB test, concurrency1, isolation none | Exit1;20 test bị before-hook DB_RUNTIME_MISSING |0 assertion PG được nghiệm thu; TEST_DATABASE_URL không có |
| Docker/PATH | Docker daemon pipe unavailable; psql/postgres không trên PATH | Không tự tạo cloud DB hoặc chạy trên dữ liệu thật |
| `node --experimental-strip-types .review-artifacts/stage05-counterexamples.mjs` | Exit0; tám phản ví dụ được ghi JSON | SQL double/direct handler;0 external request,0 real DB write |

Chi tiết phản ví dụ: `.review-artifacts/stage05-counterexamples.json`. Không dùng mock làm bằng chứng MVCC/locks/grants. Không lặp Workers launcher bị chặn ở các lượt trước khi chưa có runtime mới; giữ gate này chưa xác minh, không suy ra trạng thái live từ source/build. Không kiểm lại browser vì không có thay đổi UI trong phạm vi.

## Bàn giao

Prompt tiếp theo: [06-catalog-borrowers.md](../prompts/antigravity-next/06-catalog-borrowers.md). Sửa carryover tiền/quyền và chứng cứ trước, sau đó catalog/borrower trong cùng chặng06. Catalog domain có thể làm độc lập khi runtime thiếu; HTTP tiền không được công bố sẵn sàng trong lúc các gate chặn còn mở. Giữ22 mã chặng, không nhảy sang07 hoặc viết lại giao diện.

**Chưa kiểm:** PostgreSQL thực, provider, Workers HTTP, application-role grants, mobile, ngân hàng, load/penetration, backup/restore. Chưa đủ để dùng tiền hoặc dữ liệu cá nhân thật.
