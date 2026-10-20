# Kế hoạch triển khai cổng công khai và đặt sách

> Dành cho agent thực thi: dùng quy trình `executing-plans`, làm tuần tự các bước có checkbox. Không dùng subagent. Tài liệu này được viết để lập kế hoạch; chưa cho biết tính năng đã được triển khai hoặc kiểm thử.

**Mục tiêu:** giữ các sửa lỗi hậu chặng 22, kiểm chứng và sửa phần còn tái hiện, sau đó triển khai đặt 1 quyển/đơn không đăng nhập theo [thiết kế đã chốt](../../technical/public-reservation-design.md).

**Kiến trúc:** tiếp tục Astro/React, Workers và PostgreSQL hiện có. Thêm nghiệp vụ giữ chỗ vào luồng catalog, ca trực và mượn/trả; PostgreSQL quyết định tồn và hạn mức qua các giao dịch cùng nguồn dữ liệu. Không dùng bộ đếm trong bộ nhớ hoặc cookie làm nguồn chuẩn.

**Stack:** TypeScript, React, Astro, Cloudflare Workers, PostgreSQL/`pg`, managed Auth, Node test runner và harness DB hiện có. Cloudflare Turnstile là lựa chọn CAPTCHA ưu tiên; không thêm OTP.

**Trạng thái ngày 20/10/2026:** chỉ lập tài liệu. Các command dưới đây là lệnh agent triển khai cần chạy; chưa được chạy lại trong lượt lập kế hoạch này.

## Ràng buộc chung

- 1 đơn đúng 1 bản sách; tối đa 3 suất đang giữ/đang mượn cho mỗi SĐT chuẩn hóa; 3 đơn tạo thành công/IP trong 24 giờ trượt.
- Trả từng quyển mở từng suất SĐT, không mở lượt IP. Hủy/hết hạn cũng không xóa lượt IP trong 24 giờ.
- Giữ đến giờ kết thúc ca đã chọn; đúng mốc hết hạn thì không được giao tiếp.
- Khách đặt không cần tài khoản, mật khẩu hoặc OTP; CAPTCHA phải xác minh tại server. SĐT chưa được coi là danh tính đã xác minh.
- Giữ quy tắc mượn/trả, cọc/phạt/quỹ và quyền hiện có. 3 suất tổng không đổi giới hạn 2 cuốn trên một phiếu; mỗi đơn online bàn giao bằng một phiếu 1 cuốn.
- Giữ theme/layout hiện có; chỉ bổ sung thành phần phục vụ luồng đã chốt. Không viết lại `InternalWorkspace.tsx` hoặc toàn bộ router.
- Không commit/push/deploy, tạo tài nguyên cloud, thay cấu hình toàn cục, gửi thông báo thật, dùng PII/tiền thật hoặc sửa DB không disposable.
- Không subagent. Không `git init` nếu thư mục hiện tại không có Git. Nếu có Git, ghi branch/HEAD/status trước làm; nếu không, lưu danh sách/hash tệp trong phạm vi để bảo toàn chỉnh sửa.
- Không nới guard DB, bỏ auth hoặc tắt ràng buộc để test xanh. Tiếp tục phần độc lập khi có gate môi trường bị chặn.
- Các trường hợp mất sách hoặc sửa SĐT mơ hồ giữ suất và từ chối tự động giải phóng; chỉ mở khi có bằng chứng kết thúc nghĩa vụ từ quy trình đã được xác định. Không tự đặt chính sách tiền hoặc miễn trách nhiệm mới.

## 1. Đầu vào và thứ tự ưu tiên

1. [public-reservation-design.md](../../technical/public-reservation-design.md): quyết định mới nhất cho cổng công khai và đặt sách.
2. [post22-repair-handoff.md](../../technical/post22-repair-handoff.md): claim sửa lỗi cũ, ID gốc và gate cần kiểm chứng lại.
3. Source, schema và regression hiện tại: căn cứ xác định việc đã sửa, còn tái hiện và caller thực tế.
4. [repair-post22-round2.md](../../prompts/antigravity-next/repair-post22-round2.md): mô tả lỗi gốc và giới hạn sửa, không phải lệnh làm lại mọi thay đổi.
5. [transactions-finance.md](../../technical/transactions-finance.md), [security-operations.md](../../technical/security-operations.md), [progress.md](../../technical/progress.md): giữ các hợp đồng ngoài phạm vi đặt chỗ.

Thiết kế mới thay yêu cầu đăng nhập cho thao tác đặt sách. Không tự gỡ auth của gửi review, xem dữ liệu riêng hoặc API nội bộ. Hướng dẫn deploy trong tài liệu cũ không cấp phép deploy ở lượt này.

Handoff hiện báo RF-01…RF-11 đã sửa mức source/unit, cùng số liệu check/build/unit/Python/lint của lượt trước. Đây là claim cần tái kiểm chứng, không phải baseline đã xác nhận bởi người lập kế hoạch. Một số file review hiện chỉ có nội dung rỗng; không dựng lại findings hoặc nói đã đọc bằng chứng độc lập từ file rỗng.

## 2. Bản đồ tệp dự kiến

Các đường dẫn trong bảng tính từ gốc dự án. Tệp mới là đề xuất trách nhiệm, không phải yêu cầu tạo lớp mới nếu đã có phần tương đương khi bắt đầu thực thi. Nếu đổi tên, cập nhật caller, test, lệnh và tài liệu trong cùng bước.

| Trách nhiệm | Tệp hiện có cần nối/sửa | Tệp mới dự kiến |
|---|---|---|
| Kiểm chứng lỗi cũ | `src/lib/api-client.ts`, `src/server/router.ts`, `src/modules/reporting/reporting-service.ts`, các service theo finding tái hiện | Thêm case vào suite cũ; không tạo module sửa lỗi song song |
| Schema và trạng thái | `docs/technical/schema/01_schema.sql`, `tests/integration/db-harness.ts` nếu thật sự cần | `docs/technical/schema/migrations/13_public_reservations.sql`, `src/server/reservations/types.ts` |
| Quy tắc/chuẩn hóa/IP | `src/server/borrowers/rules.ts`, `src/server/types.ts` | `src/server/reservations/rules.ts`, `tests/unit/reservation-rules.test.ts` |
| Tạo/giữ/giao/trả/hết hạn | `src/server/catalog/service.ts`, `src/server/circulation/service.ts`, `src/server/borrowers/service.ts`, `src/server/duty/roster-service.ts` | `src/server/reservations/service.ts`, `tests/unit/reservations.test.ts`, `tests/integration/reservations.test.ts` |
| CAPTCHA | `src/server/types.ts`, `.env.example` chỉ placeholder | `src/server/reservations/captcha.ts`, `tests/unit/reservation-captcha.test.ts` |
| API và wire DTO | `src/server/router.ts`, `src/lib/api-client.ts`, `docs/technical/openapi.yaml`, `package.json` scripts | `tests/unit/reservation-api.test.ts` |
| Landing và trang tra đơn | `src/components/PublicPortal.tsx`, `src/pages/index.astro`, `src/styles/global.css` chỉ nếu cần | `src/pages/dat-sach.astro`, `src/components/ReservationLookup.tsx` |
| Quầy/phiên nội bộ | `src/components/InternalWorkspace.tsx`, `src/pages/login.astro`, `src/pages/noi-bo.astro`, `src/server/auth/provider.ts`, `src/server/auth/tokens.ts`, `src/server/auth/policy.ts` | Bổ sung test phiên vào `tests/unit/auth-policy.test.ts` và wire suite mới |
| Tác vụ theo giờ | `src/server/index.ts`, `wrangler.json` chỉ cấu hình local/versioned cần thiết | `tests/unit/reservation-expiry.test.ts` |
| Nghiệm thu và handoff | `docs/technical/progress.md`, `docs/technical/post22-repair-handoff.md`, mục lục tài liệu | `docs/technical/public-reservation-handoff.md` để lưu trạng thái PR-0…PR-9 và bằng chứng 49 ca |

Nếu số migration 13 đã được agent khác dùng, lấy số tiếp theo sau khi đọc lại thư mục, không ghi đè. Tên migration và các lệnh tương ứng phải đổi nhất quán. Không để apply migration dựa vào thứ tự filesystem không xác định; harness hiện sắp xếp tên tệp.

## 3. Hợp đồng xuyên suốt cần chốt ở PR-1

Tên dưới đây là tên đề xuất cố định cho kế hoạch; chưa phải export hiện có.

| Hợp đồng | Đầu vào và đầu ra |
|---|---|
| `ReservationStatus` | `HELD`, `BORROWED`, `RETURNED`, `CANCELLED`, `EXPIRED`; overdue/lost/cọc vẫn do nghiệp vụ hiện có sở hữu. |
| `CreateReservationInput` | `titleId`, `scheduleId`, `fullName`, `phone`; thông tin bạn đọc tùy chọn theo quy tắc hiện có. Không nhận role, IP, status hoặc deadline từ khách. |
| `ReservationRequestContext` | IP tin cậy đã chuẩn hóa/khóa HMAC, khóa thao tác và CAPTCHA token; thời gian do server quyết định. Không đưa bí mật này vào audit hoặc DTO công khai. |
| `PublicReservationDto` | Mã đơn, tên sách, trạng thái, lịch/địa điểm nhận, hạn giữ, cọc dự kiến; chỉ thông tin cần thiết của đơn được cấp quyền. |
| `createReservation(db, input, context)` | Tạo một đơn và giữ một bản nguyên tử, hoặc trả kết quả cũ của cùng thao tác; trả DTO và token tra cứu riêng. Không tạo phiếu mượn. |
| `getReservationByToken(db, token)` | Chỉ đọc đơn được token cấp quyền, áp dụng hết hạn hiệu lực; không tìm mọi đơn bằng SĐT. |
| `cancelReservation(db, id, authorization)` | Hủy `HELD` bởi token đúng đơn hoặc actor nội bộ có quyền; lưu lý do và không xóa lịch sử IP. |
| `fulfillReservation(db, id, input, actor)` | Bàn giao qua cùng transaction của nghiệp vụ lập phiếu; trả đơn và phiếu 1 cuốn, không tự mở suất giữa hai trạng thái. |
| `expireReservations(db, now, limit)` | Hết hạn theo batch hữu hạn và có thể chạy lại; `now` chỉ do code server/tác vụ cung cấp, không nhận từ public body. |

Giao diện TypeScript cụ thể dùng `Queryable`, actor và transaction hiện có; khóa context test/đồng hồ test phải tách khỏi dữ liệu request production. Không tạo pool hoặc transaction con trong helper được gọi bởi giao dịch bàn giao/trả.

Hợp đồng HTTP dự kiến:

| Method/path | Quyền | Kết quả |
|---|---|---|
| `GET /api/v1/public/reservation-books` | Anonymous | Danh mục phân trang và tồn có thể đặt, chỉ public fields; không trả barcode/nội bộ. |
| `GET /api/v1/public/pickup-schedules` | Anonymous | Ngày, giờ kết thúc và địa điểm của ca đã công bố còn nhận đặt. |
| `POST /api/v1/public/reservations` | Anonymous + CAPTCHA | Tạo hoặc replay cùng đơn; có khóa thao tác khó đoán phía client, không coi SĐT là auth. |
| `GET /api/v1/public/reservation` | Bearer token riêng của đơn | Đọc một đơn. Token không đặt trong query URL, không được dùng như token thành viên. |
| `POST /api/v1/public/reservation/cancel` | Bearer token riêng của đơn | Hủy đúng đơn chờ nhận. |
| `GET /api/v1/reservations` | Actor nội bộ có quyền | Lọc theo ca/trạng thái, tìm tên/SĐT, có phân trang. |
| `POST /api/v1/reservations/:id/fulfill` | Actor có quyền giao sách | Giao đúng đơn qua quy trình cọc/phiếu hiện có. |
| `POST /api/v1/reservations/:id/cancel` | Actor có quyền | Hủy trước nhận và lưu lý do. |

Token tra cứu có namespace và bộ xác minh riêng; không được resolve thành `AuthenticatedActor`. Đường dẫn khách lưu có thể đặt token trong fragment của `/dat-sach`; giao diện gửi token vào header khi gọi API, không ghi log, không gửi referrer hoặc tài nguyên bên thứ ba trên trang tra đơn.

Chuẩn lỗi: input sai 400; chưa có quyền/không hợp lệ 401 hoặc 403 theo policy hiện có; không tìm được tài nguyên được phép xem 404; hết sách/xung đột trạng thái hoặc payload khác cùng khóa 409; hết hạn mức 429 kèm thời điểm IP được thử lại khi xác định được; CAPTCHA/provider hoặc DB không sẵn sàng trả lỗi minh bạch, không giả thành công. Phản hồi anonymous không kèm danh tính/lịch sử hoặc tổng số sách của SĐT tùy ý.

## 4. Các bước thực hiện

### PR-0. Xác minh sửa lỗi cũ và baseline

**Tệp:** đọc `docs/technical/post22-repair-handoff.md`, `docs/prompts/antigravity-next/repair-post22-round2.md` và source/test đã dẫn; chỉ sửa caller/service thực sự còn lỗi. Đầu ra là bảng RF/P22/S12 được đối chiếu và baseline mới có bằng chứng.

- [ ] Ghi cwd/branch/HEAD/status hoặc hash nếu không có Git; đọc lại tệp trước sửa và bảo toàn công việc hiện có.
- [ ] Chạy regression nhóm cũ bằng lệnh bên dưới. Nếu tái hiện lỗi, thêm case đúng lớp bị lỗi, quan sát FAIL rồi sửa gốc và chạy lại nhóm liên quan.
- [ ] Kiểm riêng RF-04: reload/lost response, đổi actor/entity/payload, storage lỗi; RF-05: dữ liệu ngoài 100 bản; RF-06: stale response sau đổi mode/logout. Không xóa sửa đúng đã có như `sessionStorage` chỉ vì mô tả review cũ.
- [ ] Kiểm riêng RF-11 qua hai instance/store và sau restart. Source hiện có `BoundedAtomicTicketStore` với `Map` cục bộ; sự nguyên tử trong một instance không chứng minh vé dùng một lần xuyên Worker. Nếu tái hiện, sửa bằng lưu trữ bền có atomic consume phù hợp stack hiện có, giữ định dạng xuất trung thực. Không bắt làm converter XLSX/PDF để bắt đầu đặt sách.
- [ ] Chạy baseline check/build/unit/Python/lint sau sửa. Ghi rõ lỗi có sẵn, lỗi mới và gate không chạy được; giữ mức độ finding gốc, không đổi `FIXED_SOURCE/UNIT` thành nghiệm thu runtime.

Lệnh regression cũ, chạy từ gốc dự án:

```powershell
rtk proxy node --experimental-strip-types --test tests/unit/circulation-quote-pending.test.ts tests/unit/settlement-identity-confirmation.test.ts tests/unit/action-pagination-demo-boundary.test.ts tests/unit/public-export-restore-reports.test.ts tests/unit/auth-policy.test.ts tests/unit/circulation-issue.test.ts tests/unit/circulation-return.test.ts tests/unit/circulation-partial.test.ts
```

Kết quả mong đợi: các test thực sự được chạy, không fail. Test thiếu runtime vẫn là BLOCKED ở lớp tương ứng. Không chép lại con số 265 test của handoff làm kết quả mới.

**Điều kiện đi tiếp:** không còn lỗi source tái hiện chặn giao dịch/quyền/tồn liên quan đặt sách. Phần UI/contract độc lập vẫn tiếp tục khi chỉ thiếu môi trường. Các sửa cũ ngoài đường phụ thuộc ghi riêng và thực hiện trong phạm vi hậu chặng 22, không mở thêm module sản phẩm.

### PR-1. Chốt contract, schema và nâng cấp dữ liệu an toàn

**Tệp:** `src/server/reservations/types.ts`, migration 13, `docs/technical/schema/01_schema.sql`, `docs/technical/openapi.yaml`, `tests/integration/reservations.test.ts`, `tests/unit/reservations.test.ts`, `package.json`.

- [ ] Viết kiểm thử schema/constraint trước: đơn chỉ gắn một copy, một active hold/copy, liên kết dòng phiếu không trùng, ca và copy tồn tại, token digest/key thao tác duy nhất theo scope xác định.
- [ ] Tạo bảng đơn đặt với SĐT chuẩn hóa, khóa IP và `created_at` không bị sửa/xóa khi kết thúc đơn; snapshot lịch nhận, `expires_at`, mã đơn, token digest, liên kết dòng phiếu và audit kết thúc.
- [ ] Thêm hàng khóa hạn mức theo namespace IP/SĐT hoặc cơ chế khóa transaction tương đương. Phải khóa được cả khóa mới chưa có dữ liệu và tất cả đường ghi liên quan; không chỉ `COUNT` rồi `INSERT`.
- [ ] Xác định cách giữ khóa SĐT cho các khoản mượn hiện có và phiếu chuyển tiếp, tránh đếm đôi. Preflight dữ liệu SĐT sai, trùng hồ sơ, quá 3 suất; không sửa danh tính hoặc xóa lịch sử tự động.
- [ ] Thêm migration tiến tới, bảo toàn dữ liệu cũ, dùng harness disposable để kiểm fresh schema và đường nâng cấp từ baseline. Không chạy trên DB thật.
- [ ] Đăng ký các suite mới vào `test:unit` và `test:db`; xác nhận test mới thực sự được khám phá. Cập nhật DTO/API contract cùng bước.

**Kiểm thử:** schema mới; áp baseline + migrations; có dữ liệu borrower/loan trước nâng cấp; preflight trùng/mơ hồ fail-closed; rollback migration khi constraint không đạt; DB guard từ chối target không disposable. Chưa chạy được PostgreSQL thì schema gate BLOCKED, không thay bằng regex.

**Bàn giao:** tên cột/constraint/export chính thức và thứ tự khóa sau khi đối chiếu thứ tự `cash_sessions`/receipt/items/copies hiện có. Các bước sau dùng đúng contract, không tự đổi riêng.

### PR-2. Tồn giữ chỗ và hạn mức nguyên tử

**Tệp:** `src/server/reservations/rules.ts`, `src/server/reservations/service.ts`, `src/server/catalog/service.ts`, `src/server/borrowers/service.ts`, `src/server/circulation/service.ts`, `tests/unit/reservation-rules.test.ts`, `tests/unit/reservations.test.ts`, `tests/integration/reservations.test.ts`.

- [ ] Thêm các case LIM-01…LIM-13 và CON-01…CON-04/CON-07/CON-08 trước sửa. Dùng thời gian cố định cho ranh giới 24 giờ.
- [ ] Tái sử dụng `normalizePhone`; kiểm input đúng 1 bản. Tồn khả dụng loại hold còn hiệu lực và loan chưa trả, không coi mọi copy đang `AVAILABLE` là đặt được.
- [ ] Trong một transaction, khóa các namespace quota và tài nguyên theo thứ tự đã chốt, đọc lại ca/tồn và đếm IP `created_at > now - 24h`; commit tối đa một đơn và một hold. Thời điểm `now` được lấy một lần sau khi đã có các khóa quyết định để không dùng thời gian cũ khi chờ khóa qua giờ hết ca.
- [ ] Cộng suất SĐT xuyên ca/IP/hồ sơ trùng số; giữ suất của sách chưa trả và chỉ đếm một lần dòng carry-forward. Không cho đổi SĐT hoặc mượn thủ công đi vòng guard.
- [ ] Giữ khóa IP ổn định qua cửa sổ 24 giờ khi xoay secret; chọn HMAC có version và quy trình so sánh dữ liệu đang hiệu lực. Không chỉ hash chuỗi IP thô hoặc cộng riêng theo cặp IP/SĐT.
- [ ] Chạy PG với hai kết nối độc lập và barrier để tranh cùng copy, cùng suất SĐT, cùng lượt IP và khóa mới. Assert số đơn/hold/loan thực sau commit, không chứng minh bằng mutex hay mock.

Ví dụ dữ liệu kiểm thử ranh giới bắt buộc: tạo lúc `2026-10-20T02:00:00Z`, `03:00:00Z`, `04:00:00Z`; xét lúc `2026-10-21T01:59:59.999Z` vẫn chặn, lúc `02:00:00Z` mở đúng 1 lượt. Trả lúc `2026-10-20T08:00:00Z` chỉ mở suất SĐT.

**Bàn giao:** `createReservation` và public availability dùng cùng nguồn tồn/quota; giao dịch lỗi không để lại đơn, hold hoặc lượt IP.

### PR-3. API anonymous, CAPTCHA, token riêng và retry

**Tệp:** `src/server/reservations/captcha.ts`, `src/server/reservations/service.ts`, `src/server/types.ts`, `src/server/router.ts`, `src/lib/api-client.ts`, `.env.example`, `tests/unit/reservation-captcha.test.ts`, `tests/unit/reservation-api.test.ts`.

- [ ] Thêm case PUB-02…PUB-05/PUB-07/PUB-08 và SEC-01…SEC-06 qua adapter → router → service. Không chỉ gọi trực tiếp hàm nghiệp vụ để kết luận route đúng.
- [ ] Xác định IP bằng hạ tầng tin cậy và normalize IPv4/IPv6. Local test có fixture riêng bị khóa vào test; production không nhận test actor/IP/clock từ body.
- [ ] Dùng Turnstile Siteverify phía server, có timeout hữu hạn, kiểm hostname/action theo cấu hình; thiếu secret hoặc provider lỗi phải từ chối. Chỉ thêm placeholder cấu hình trong `.env.example`; không lấy/tạo secret cloud thật.
- [ ] Scope khóa thao tác anonymous bằng token/yêu cầu khó đoán của client và canonical payload, không tái dùng một actor anonymous chung thiếu phân tách. Không dùng registry 32-bit phía client làm bảo đảm bảo mật phía server.
- [ ] Replay một đơn đã commit kiểm đúng khóa/payload, không tạo đơn mới và không đòi xác minh lại CAPTCHA đã tiêu thụ. Hai request đầu tiên cùng key phải hội tụ về một kết quả; một request sai payload nhận 409.
- [ ] Chốt khả năng trả lại token tra đơn khi replay mà không lưu token thô trong audit/cache idempotency chung: có thể suy token từ nonce đơn + secret có version, lưu digest để xác minh; test replay và xoay key. Không cache phản hồi chứa bí mật vào bảng/log không có bảo vệ tương ứng.
- [ ] Tách token đơn khỏi JWT thành viên; API tra/hủy đúng đơn dùng header. Ràng buộc origin/CSRF cho thao tác nội bộ dùng cookie theo cơ chế hiện có, không biến public endpoint thành đường lấy quyền.

**Kiểm thử provider:** fixture fetch kiểm success/invalid/timeout/replay/wrong hostname/action ở unit; browser dùng test key chính thức nếu được cấu hình. Không dùng kết quả mocked Siteverify gọi là đã kiểm provider thật. Thiếu quyền mạng/key giữ provider gate BLOCKED, phần code an toàn vẫn hoàn thành.

### PR-4. Bàn giao và trả sách qua nghiệp vụ hiện có

**Tệp:** `src/server/reservations/service.ts`, `src/server/circulation/service.ts`, `src/server/borrowers/service.ts`, `src/server/shared/idempotency.ts` chỉ khi cần mở rộng scope đã phân tích, `src/server/router.ts`, `tests/unit/reservations.test.ts`, `tests/integration/reservations.test.ts`, các suite circulation hiện có.

- [ ] Viết LIFE-01/LIFE-02/LIFE-07/LIFE-10/LIFE-11, CON-05/CON-06 và regression LIM-06/LIM-07/LIM-13 trước thay đổi luồng.
- [ ] Giao đúng đơn còn hạn/ca/copy, chọn hồ sơ theo đối chiếu; lập phiếu 1 cuốn qua service hiện có và cùng transaction/audit/idempotency. Guard suất hiểu bàn giao là chuyển nghĩa vụ, không thêm nghĩa vụ thứ tư.
- [ ] Không mở cọc/phiếu nếu chưa xác nhận điều kiện hiện tại; lỗi journal hoặc thu cọc rollback cả bàn giao. Giữ payment confirmation và quỹ LOAN/OPERATION đã sửa.
- [ ] Đường trả chính xác bản sách cập nhật liên kết đơn/suất trong cùng giao dịch thành công. Quá trình chờ hoàn cọc không ngăn ghi nhận đã trả; cũng không tự xác nhận tiền đã hoàn.
- [ ] Đường mượn thủ công, sửa tình trạng copy và sửa liên hệ borrower dùng cùng guard. Không cho lấy bản giữ cho đơn khác; thay SĐT có nghĩa vụ đang mở phải kiểm tác động hoặc từ chối có lý do/audit.
- [ ] Gia hạn/carry-forward giữ liên kết nghĩa vụ đúng bản, không nhả hoặc cộng đôi suất. Lost chưa có tiêu chí kết thúc rõ thì giữ suất và báo cần xử lý nội bộ, không đặt policy tiền mới.

**Bàn giao:** nhận rồi trả từng quyển có bằng chứng DB, đúng 1 lần; toàn bộ regression quote/FULL/PARTIAL/renew/lost/refund/action-key cũ vẫn giữ.

### PR-5. Hết hạn và ca trực thay đổi

**Tệp:** `src/server/reservations/service.ts`, `src/server/duty/roster-service.ts`, `src/server/index.ts`, `wrangler.json`, `tests/unit/reservation-expiry.test.ts`, `tests/integration/reservations.test.ts`.

- [ ] Viết PUB-06, LIFE-03…LIFE-06/LIFE-08/LIFE-09 và CON-05 với đồng hồ cố định.
- [ ] Hết hạn `HELD` khi `now >= expires_at`, batch hữu hạn, chạy lại không nhả lặp; không đụng `BORROWED`.
- [ ] Nối scheduled handler của Worker để gọi cùng service, có giới hạn batch/time và tiếp tục batch sau. Chỉ sửa cấu hình trong repo, không tạo cron cloud hoặc deploy.
- [ ] Đọc tồn/kiểm quota/giao sách đều xử lý hạn hiệu lực ngay cả khi scheduled task chạy muộn; giữ đúng lượt IP lịch sử.
- [ ] Hủy ca chỉ hủy đơn chưa nhận. Sửa ca có đơn không âm thầm đổi hạn/địa điểm: bản đầu từ chối sửa ảnh hưởng hoặc dùng thao tác hủy đơn rõ ràng trước sửa. Không gửi SMS/email thật.
- [ ] Tranh giao-hết hạn-hủy qua hai transaction: một kết quả thắng, không rollback nhầm sách đã giao.

**Bàn giao:** không phụ thuộc thao tác đóng két hoặc giờ thu dọn để hết hạn; có bằng chứng local handler và DB, scheduled cloud vẫn là gate riêng.

### PR-6. Landing, form đặt và tra đơn

**Tệp:** `src/components/PublicPortal.tsx`, `src/pages/index.astro`, `src/pages/dat-sach.astro`, `src/components/ReservationLookup.tsx`, `src/lib/api-client.ts`, `src/styles/global.css` nếu cần, `tests/unit/reservation-api.test.ts`.

- [ ] Thay nguồn mock cho phần danh mục/tồn/lịch/hoạt động được luồng này dùng bằng public DTO thật; giữ kiểm duyệt và phân trang. Lỗi tải không biến thành mock hoặc thông báo hết sách giả.
- [ ] Bổ sung form 1 quyển, chọn ca và thông tin bắt buộc, CAPTCHA, màn hình xác nhận lịch/địa điểm/cọc, loading/error/retry. Đổi nội dung tạo ý định mới; retry mạng lỗi dùng khóa cũ kể cả reload.
- [ ] Không lưu họ tên/SĐT hoặc secret trong action registry dùng chung. Chỉ lưu khóa cần cho recovery trong phạm vi thiết bị; server vẫn là nguồn quota.
- [ ] Trang tra đơn dùng token riêng, nút hủy chỉ cho đơn chờ nhận; không có tra lịch sử công khai bằng SĐT. Không ghi token vào analytics/referrer hoặc URL query gửi server.
- [ ] Kiểm keyboard, label/focus, thông báo lỗi, CAPTCHA hết hạn, bấm nhiều lần và khôi phục sau mất mạng. Giữ theme/design đã có.

**Browser:** chạy PUB-01…PUB-08, SEC-03…SEC-05 và kịch bản LIM-08/LIM-10 ở desktop 1366×768, mobile 390×844; thử tải lại, token sai/thiếu, lỗi API thật. Ghi viewport, URL local, API/DB tương ứng và kết quả; ảnh không thay bằng chứng mutation.

### PR-7. Quầy chờ nhận và phiên nội bộ

**Tệp:** `src/components/InternalWorkspace.tsx`, `src/pages/login.astro`, `src/pages/noi-bo.astro`, `src/pages/index.astro`, `src/lib/api-client.ts`, `src/server/auth/provider.ts`, `src/server/auth/tokens.ts`, `src/server/auth/policy.ts`, `src/server/router.ts`, `tests/unit/auth-policy.test.ts`, `tests/unit/reservation-api.test.ts`.

- [ ] Thêm danh sách đơn chờ nhận theo ca, tìm tên/SĐT/mã, phân trang và trạng thái lỗi riêng. Hành động giao/hủy dùng API, xác nhận cọc hiện có và action key đúng ý định.
- [ ] Bổ sung guard DEMO cho mọi mutation mới; bỏ response cũ sau logout/đổi actor/mode và dọn dữ liệu đơn. Không cho nút DEMO ghi DB.
- [ ] Thẻ đăng nhập trên landing dành cho thành viên; guest login của chức năng khác không cấp quyền nội bộ. Không tự gỡ các API review hiện vẫn cần guest session.
- [ ] Kiểm phiên qua `/api/v1/auth/me` trước điều hướng. Phiên hợp lệ vào thẳng `/noi-bo`; link chủ động xem công khai cần tránh vòng redirect. Guest/anonymous không được coi là thành viên.
- [ ] Giữ tuổi thọ token hiện có nếu không có quyết định mới; để cookie lưu bền tối đa bằng hạn token nếu cần nhớ qua lần mở trình duyệt. Không thêm refresh vô hạn hoặc kéo dài JWT mặc định. Kiểm expire/revoke/tokenVersion/khóa tài khoản trên server.
- [ ] Chạy SEC-07…SEC-09, LIFE-01/LIFE-02/LIFE-07 và regression RF-04/05/06 trên browser/API; kiểm quyền admin/member/alumni/guest thực tế, không nhận role từ client.

**Bàn giao:** khách không cần login để đặt; chỉ actor đúng quyền thao tác quầy; phiên nhớ đúng giới hạn, logout không để dữ liệu riêng quay lại bởi request cũ.

### PR-8. Kiểm thử tích hợp, runtime và đối soát 49 ca

**Tệp:** các suite mới/cũ, `package.json`, `docs/technical/openapi.yaml`, `docs/technical/public-reservation-handoff.md`; không thay source chỉ để ẩn lỗi môi trường.

- [ ] Chạy toàn bộ suite mới và regression cũ sau khi tích hợp PR-1…PR-7. Kiểm migration baseline và upgrade, invariant tồn/quota, accounting/audit/idempotency dưới rollback.
- [ ] Chạy đủ 49 ca ở lớp cần thiết theo ma trận mục 5. Ghi case-ID → test hoặc bước browser → kết quả → bằng chứng; test plan không tự trở thành PASS.
- [ ] Kiểm Worker local fetch + scheduled với DB disposable, nhiều request/instance. Nếu Workers không chạy, ghi lỗi ngắn chính xác và giữ gate BLOCKED; không đổi sandbox/global config hoặc dùng Node handler gọi đó là Workers.
- [ ] Kiểm provider/auth bằng cấu hình test được phép. Không mở cloud resource hoặc gửi thông báo/PII thật để vượt gate.
- [ ] Đối soát đơn active, copy khả dụng, nghĩa vụ chưa trả và lượt IP sau kịch bản đặt-nhận-trả-hết hạn. Khởi động lại runtime không được reset quota.
- [ ] Chạy full check/build/unit/DB/Python/OpenAPI một lượt cuối; chỉ lặp phần cần thiết nếu có thay đổi hoặc failure mới. Ghi lỗi/warnings và ảnh hưởng; không tự tắt lint/ràng buộc để qua.

**Điều kiện nghiệm thu local:** source/unit/contract và browser local đạt; DB concurrency đạt trên PostgreSQL disposable; Worker/provider/session đạt ở môi trường test tương ứng. Thiếu gate nào giữ tổng thể PARTIAL/BLOCKED, không gọi là sẵn sàng production.

### PR-9. Bàn giao, sửa phần theo kiểm thử và tiếp tục phần còn mở

**Tệp:** `docs/technical/public-reservation-handoff.md`, `docs/technical/post22-repair-handoff.md`, `docs/technical/progress.md`, tài liệu contract/schema đã thay.

- [ ] Sửa lỗi do lượt triển khai gây ra, chạy regression trực tiếp và cập nhật ca liên quan; không dừng ở việc liệt kê lỗi tự tạo.
- [ ] Ghi từng PR-0…PR-9, ID RF/P22/S12 được xác minh lại hoặc còn tái hiện, test/command/result mới; chỉ sửa phần trạng thái có bằng chứng, không viết lại lịch sử review.
- [ ] Ghi các tệp thay đổi, hợp đồng DB/API, phần migration chưa apply, 49 ca và gate source/DB/Workers/browser/provider/restore/converter riêng.
- [ ] Tiếp tục các sửa lỗi cũ còn làm local được trong phạm vi hậu chặng 22. Thiếu DB/provider/converter không cho phép bỏ kiểm tra phần độc lập hoặc tuyên bố hoàn tất toàn bộ.
- [ ] Kết thúc bằng handoff cụ thể và bước tiếp còn phụ thuộc người dùng/hạ tầng; không commit/push/deploy hoặc gửi kết quả tới dịch vụ ngoài.

## 5. Ma trận kiểm thử và lệnh chạy

### 5.1. Truy vết 49 ca thiết kế

Mỗi ID có ít nhất một nơi chịu trách nhiệm chính; những case đi qua nhiều lớp phải có thêm bằng chứng tích hợp/browser tương ứng.

| Case | Bước chính | Bộ kiểm và bằng chứng |
|---|---|---|
| PUB-01 | PR-6 | Browser anonymous từ landing đến form; không auth/OTP. |
| PUB-02, PUB-03 | PR-2/PR-3 | `reservation-rules.test.ts`, `reservation-api.test.ts`; từ chối ở server. |
| PUB-04, PUB-05, PUB-07, PUB-08 | PR-2/PR-3/PR-6 | Adapter→router, DB và browser retry; chỉ một đơn/hold. |
| PUB-06 | PR-5 | `reservation-expiry.test.ts`, PG và public API ca trực. |
| LIM-01, LIM-02, LIM-03, LIM-04, LIM-05, LIM-06, LIM-07, LIM-08, LIM-09, LIM-10, LIM-11, LIM-12, LIM-13 | PR-2/PR-4 | Unit clock/normalization; PG aggregate/rollback/carry; browser đặt lại sau trả. |
| LIFE-01, LIFE-02, LIFE-07, LIFE-10, LIFE-11 | PR-4 | `reservations.test.ts`, PG giao/trả/cọc, browser quầy. |
| LIFE-03, LIFE-04, LIFE-05, LIFE-06, LIFE-08, LIFE-09 | PR-5 | Clock boundary, scheduled handler, PG state và đổi ca. |
| CON-01, CON-02, CON-03, CON-04, CON-07, CON-08 | PR-2/PR-8 | PG nhiều connection/instance; kiểm các hàng DB sau race/restart. |
| CON-05, CON-06 | PR-4/PR-5 | PG giao-hủy-hết hạn và thao tác thủ công tranh bản. |
| SEC-01, SEC-02 | PR-3 | `reservation-captcha.test.ts`, adapter→router; provider test riêng. |
| SEC-03, SEC-04, SEC-05, SEC-06 | PR-3/PR-6 | Token scope, PII/log/cache, browser; ghi nhận rủi ro chưa OTP. |
| SEC-07, SEC-08, SEC-09 | PR-7 | Auth route/service và browser có phiên/hết phiên/khóa/đổi role. |

### 5.2. Lệnh có thể chạy theo bước

Chạy từ `F:\Codex Project\YSBK`. Dùng RTK khi giữ nguyên exit code/bằng chứng; nếu wrapper làm mất lỗi cần thiết, chạy lại native và dùng output thô làm căn cứ.

Sau khi PR-1…PR-5 đã tạo và đăng ký các file test tương ứng:

```powershell
rtk proxy node --experimental-strip-types --test tests/unit/reservation-rules.test.ts tests/unit/reservations.test.ts tests/unit/reservation-captcha.test.ts tests/unit/reservation-api.test.ts tests/unit/reservation-expiry.test.ts
```

Ở bước trước đó, chỉ gọi các file đã tạo; thiếu file là lỗi thiết lập suite, không phải test đã bỏ qua hợp lệ. Mong đợi: case đúng được chạy và pass; giai đoạn viết regression trước sửa phải thấy case FAIL đúng nguyên nhân, không chỉ lỗi import.

Trước mọi integration test có reset schema, chạy guard hiện có; không in URL có password:

```powershell
rtk proxy node --experimental-strip-types --input-type=module -e "import { validateTestDatabaseUrl } from './tests/integration/db-harness.ts'; validateTestDatabaseUrl(); console.log('Disposable DB target guard PASS');"
```

Chỉ tiếp tục nếu guard PASS và đã kiểm tra đó là DB test được phép. Không tự đặt `DATABASE_URL` vào cloud, không sửa guard để chấp nhận target khác. Harness chỉ cho host local/test và database `ysbk_test_*`; không có `TEST_DATABASE_URL` giữ gate `DB_RUNTIME_MISSING`.

```powershell
rtk proxy node --experimental-strip-types --test --test-concurrency=1 tests/integration/reservations.test.ts
```

`--test-concurrency=1` ngăn các suite reset schema giẫm nhau; bên trong case concurrency vẫn phải mở ít nhất hai connection và phối hợp race thực. Không bọc toàn bộ request trong một transaction test rồi rollback để giả chạy concurrent.

Bộ kiểm cuối và baseline:

```powershell
rtk pnpm run check
rtk pnpm run build
rtk pnpm run test:unit
rtk pnpm run test:db
rtk proxy python -m unittest discover -s experiments -p 'test_*.py' -q
rtk pnpm --package=@redocly/cli dlx redocly lint docs/technical/openapi.yaml
```

Mong đợi: check/build/unit/Python exit 0; OpenAPI không lỗi và warnings có giải thích; `test:db` chỉ PASS khi thật sự chạy trên PostgreSQL disposable. Chạy guard một lần nữa nếu đổi target giữa các lệnh. Lỗi baseline không liên quan ghi riêng, không sửa lan scope chỉ để tổng số xanh.

Runtime local, chỉ dùng dữ liệu tổng hợp và cấu hình test đã được kiểm tra an toàn:

```powershell
rtk pnpm run server:dev
rtk pnpm run dev
```

Hai tiến trình chạy ở hai terminal. Xác minh PID/command/cwd/port trước thao tác; không chiếm hoặc dừng server khác. Tên script không chứng minh đã chạy: phải ghi URL/port thực, cách frontend gọi API và health/readiness. Không coi `/health` 200 là DB/Auth/provider đã sẵn; dùng thêm readiness và thao tác thực.

Gọi scheduled handler bằng cơ chế test local của Wrangler phiên bản đang cài sau khi đọc `wrangler dev --help`; không ghi lệnh cron cloud hoặc deploy vào luồng này. Browser dùng công cụ được môi trường cho phép, không bypass cài đặt browser bị tắt.

### 5.3. Dạng kết quả cần ghi

| Phạm vi | Bằng chứng chấp nhận | Không đủ để kết luận |
|---|---|---|
| Source/unit | Lệnh, phiên bản source, case chạy thật, exit/result | Checkbox hoặc số test của lượt trước |
| DB/schema/concurrency | PG disposable, migration path, nhiều connection, assert dữ liệu | Regex SQL, mock hoặc SQLite/mutex |
| Worker | Local Worker fetch/scheduled và log lỗi/thành công | Chỉ gọi `handleRequest` từ Node |
| CAPTCHA/Auth | Test provider và phiên theo đúng môi trường/cấu hình | Fake fetch hoặc actor fixture |
| UI | Browser thực trên URL local, thao tác và kết quả API/DB | Chỉ build hoặc ảnh tĩnh |
| Restore/export cũ | Gate riêng theo handoff và phạm vi được phép | Kéo trạng thái PASS từ feature đặt sách |

## 6. Điểm dừng và quyền thực thi

Kế hoạch này không yêu cầu thêm approval cho thao tác local thường lệ trong phạm vi đã được giao cho agent triển khai. Nếu thiếu credential, quyền môi trường hoặc chính sách tiền/danh tính thực sự chặn một nhánh, ghi blocker và tiếp tục phần độc lập; không tự quyết chính sách mới hoặc vượt sandbox.

Ở lượt lập kế hoạch hiện tại chỉ tạo tài liệu và prompt. Prompt đi kèm là chỉ dẫn cho Antigravity khi người dùng chuyển giao; không đồng nghĩa đã gửi prompt, khởi chạy agent hoặc cho phép production.
