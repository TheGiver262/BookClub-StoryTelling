# YSBK — Thiết Kế Giao Dịch Tài Chính, Bút Toán & Khóa Đồng Thời (transactions-finance.md)

## Ranh giới cập nhật UI/giữ chỗ 21/10/2026

[Trạng thái hiện hành](../CURRENT-STATE.md) bổ sung giữ chỗ một quyển/đơn và CTV/publishing; không thay nghiệp vụ cọc/phạt/chuyển tiếp/hai quỹ đã chốt ở đây. Đổi UI không đổi quote/confirm/idempotency, không tự tính lại số tiền client hoặc biến cọc thành thu nhập. Đổi sách trong đơn chờ nhận còn là [đề xuất](public-reservation-ux-research-2026-10-21.md); chưa sửa transaction hoặc bút toán theo ý đó.

Tài liệu thiết kế chi tiết các use case giao dịch lõi, pseudocode, bút toán kép, thuật toán tính tiền và cơ chế khóa dòng ACID.  
Ngày lập: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.

---

## 1. Nguyên Tắc Thiết Kế Kế Toán & Sổ Kép Nội Bộ

1. **Bất biến của chứng từ đã ghi sổ (Immutability of Posted Entries):**
   * Mọi bản ghi trong `journal_entries` một khi đã commit là **bất biến**, được bảo vệ bằng trigger DB `trg_prevent_journal_mutation` cấm tuyệt đối câu lệnh `UPDATE` hoặc `DELETE`.
   * Khi phát hiện sai sót nghiệp vụ, bắt buộc thực hiện một bút toán **Đảo điều chỉnh (Reversal / Adjustment Entry)** có liên kết `reversal_of_entry_id`, đổi chéo Nợ <-> Có, nêu rõ lý do và người chịu trách nhiệm. Không được phép đảo một bút toán đã bị đảo hoặc đảo chính một bút toán đảo.
2. **Nguyên tắc số nguyên VND (Integer Money) & Bounds:**
   * Tất cả giá trị tiền tệ lưu trữ dưới dạng số nguyên `BIGINT` (đơn vị: đồng Việt Nam), chặn số âm, phân số (float), NaN, Infinity và vượt quá giới hạn an toàn 1.000 tỷ VND (`MAX_SAFE_VND = 1_000_000_000_000n`).
3. **Phân biệt hai sổ quỹ độc lập (`FUND_LOAN` & `FUND_OPERATION`):**
   * **Quỹ 1: Quỹ Mượn – Trả (`FUND_LOAN`):** Quản lý tiền cọc của bạn đọc (`COC_PHAI_HOAN` - Nợ phải trả), tiền phạt quá hạn (`THU_PHAT` - Doanh thu phạt) và số dư tiền mặt/ngân hàng tại bàn trực.
   * **Quỹ 2: Quỹ Hoạt Động CLB (`FUND_OPERATION`):** Quản lý hội phí thành viên (`HOI_PHI`), tiền tài trợ sự kiện, hoạt động bán sách mới theo lô (`COC_DAT_NHA_SACH` - Tài sản cọc phải thu, `NO_PHAI_TRA_NHA_SACH`, `DOANH_THU_BAN_SACH`).
   * *Hai quỹ hoàn toàn độc lập, tuyệt đối không bù trừ (netting) số dư giữa hai quỹ.*
4. **Vòng đời phân bổ cọc (`deposit_allocations`):**
   * Trạng thái: `HELD` -> `PENDING_REFUND` -> `REFUNDED` / `FORFEITED` / `TRANSFERRED`.
   * `PENDING_REFUND`: Tiền cọc đang trong hàng chờ hoàn, nghĩa vụ `remaining_amount` vẫn giữ nguyên và chưa ghi giảm tiền trên sổ cái cho đến khi tiền thực tế được chi trả.
   * Nhận tiền qua Ngân hàng có thể hoàn bằng Tiền mặt (hoặc ngược lại); hệ thống ghi đúng cặp tài khoản Nợ/Có mà không sửa đổi chứng từ nhận ban đầu.
   * Chuyển liên kết cọc (`transferDepositAllocation`): Chỉ chuyển phiếu thụ hưởng nghĩa vụ, không tạo dòng tiền mặt/ngân hàng giả.
5. **Hợp nhất Idempotency toàn hệ thống (`idempotency_records`):**
   * Khóa định danh nguyên tử: `(actor_id, operation, idempotency_key)`.
   * Kiểm soát tính toàn vẹn qua mã băm SHA-256 canonical JSON của request payload. Cùng key khác payload bị từ chối 409 Conflict.
   * Concurrency locking tại PostgreSQL với trạng thái `PROCESSING` -> `COMPLETED` / `FAILED`, chống nhân đôi giao dịch.

---

## 2. Thiết Kế Chi Tiết Từng Giao Dịch Lõi

---

### 2.1 Use Case 1: Cho Mượn Sách Tại Quầy (Issue Loan Receipt)

#### A. Preconditions & Validations
* Thành viên thao tác có quyền hoạt động (`ACTIVE_MEMBER` hoặc `ADMIN`).
* Phiên quầy tiền mặt hôm nay đang ở trạng thái `is_closed = FALSE`.
* Số lượng sách mượn: Tối thiểu 1 cuốn, tối đa 2 cuốn (`items.length BETWEEN 1 AND 2`).
* Các bản sách đều đang ở trạng thái `status = 'AVAILABLE'`.

#### B. Thuật toán tính cọc và hạn mượn (Phía Server)
```typescript
function calculateDeposit(coverPrice: number | null): number {
  if (coverPrice === null || coverPrice <= 0) {
    return 50000; // Mặc định 50k cho sách chưa rõ giá
  }
  // Mức gần nhất theo bội 50k, mốc giữa làm tròn lên, tối thiểu 50k, không trần 200k
  return Math.max(50000, Math.floor((coverPrice + 25000) / 50000) * 50000);
}

// Hạn mượn chuẩn đúng 14 ngày lịch Việt Nam
const borrowDate = getCurrentVietnamDate(); // vd: 2026-10-01
const dueDate = addCalendarDays(borrowDate, 14); // vd: 2026-10-15
```

#### C. SQL Pseudocode Transaction
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 1. Khóa các bản sách vật lý cần mượn để chống tranh chấp đồng thời
SELECT id, barcode, status 
FROM book_copies 
WHERE id IN ($copy1_id, $copy2_id) 
FOR UPDATE;

-- Kiểm tra nếu có cuốn không khả dụng -> Rollback ngay
-- IF any copy.status != 'AVAILABLE' THEN RAISE EXCEPTION 'Bản sách không sẵn sàng';

-- 2. Cập nhật trạng thái bản sách sang đang mượn
UPDATE book_copies 
SET status = 'BORROWED', location = 'BAN_TRUC_TAM'
WHERE id IN ($copy1_id, $copy2_id);

-- 3. Tạo phiếu mượn
INSERT INTO loan_receipts (
  id, receipt_number, borrower_id, borrow_date, due_date, renew_count, status, created_by
) VALUES (
  $receipt_id, $receipt_number, $borrower_id, $borrowDate, $dueDate, 0, 'ACTIVE', $current_user_id
);

-- 4. Tạo các dòng mượn kèm snapshot tiền cọc
INSERT INTO loan_items (id, receipt_id, copy_id, deposit_snapshot)
VALUES 
  ($item1_id, $receipt_id, $copy1_id, $deposit1),
  ($item2_id, $receipt_id, $copy2_id, $deposit2); -- (nếu có cuốn 2)

-- 5. Ghi bút toán kế toán Nợ/Có vào Quỹ Mượn–Trả
-- Nợ: Hộp tiền mặt (hoặc Tài khoản ngân hàng CLB)
-- Có: Nghĩa vụ cọc phải hoàn lại bạn đọc
INSERT INTO journal_entries (
  id, entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, created_by
) VALUES (
  gen_random_uuid(), $entry_code, 'FUND_LOAN', 'LOAN_DEPOSIT', $receipt_id,
  CASE WHEN $payment_method = 'TIEN_MAT' THEN 'TIEN_MAT_HOP' ELSE 'TIEN_NGAN_HANG' END,
  'COC_PHAI_HOAN',
  ($deposit1 + COALESCE($deposit2, 0)),
  $current_user_id
);

-- 6. Ghi Audit Log và Idempotency
INSERT INTO idempotency_records (idempotency_key, payload_hash, response_body)
VALUES ($idempotency_key, $hash, $response_json);

COMMIT;
```

---

### 2.2 Use Case 2: Trả Toàn Bộ Sách & Tất Toán (Full Return Settlement)

#### A. Quy tắc phạt và trần phạt
* Phạt tính `1.000 ₫/ngày` trên cả phiếu cho tất cả các cuốn trong phiếu (không nhân theo số lượng cuốn).
* Trần phạt tối đa: Bằng tổng tiền cọc của phiếu (`total_deposit`).
* **Trường hợp Phạt < Cọc (Ví dụ: Cọc 150k, Phạt 60k):**
  - Thực hiện 2 hành vi độc lập: **Hoàn 150k cọc** và **Thu riêng 60k phạt**.
  - Phần mềm ghi nhận 2 bút toán riêng biệt, không gộp thành hoàn ròng 90k.
* **Trường hợp Phạt >= Cọc (Ví dụ: Cọc 50k, Phạt tính ra 60k):**
  - Giữ lại toàn bộ 50k cọc để cấn trừ phạt; **không thu thêm tiền của bạn đọc**.

#### B. Bút toán kế toán khi trả hết
1. Bút toán hoàn trả cọc (Giải phóng nghĩa vụ):
   - **Nợ:** `COC_PHAI_HOAN`: `150.000 ₫`
   - **Có:** `TIEN_MAT_HOP` (hoặc chuyển khoản): `150.000 ₫`
2. Bút toán thu tiền phạt (Ghi nhận thu nhập Quỹ Mượn-Trả):
   - **Nợ:** `TIEN_MAT_HOP`: `60.000 ₫`
   - **Có:** `THU_PHAT`: `60.000 ₫`

---

### 2.3 Use Case 3: Trả Một Phần & Lập Phiếu Chuyển Tiếp (Partial Return & Carry-forward)

Đây là nghiệp vụ đặc thù đã được chủ sản phẩm xác nhận chi tiết:

#### A. Kịch bản chuẩn (Cọc còn nguyên vẹn)
* **Bối cảnh:** Phiếu có 2 cuốn: Cuốn A (cọc 50k) và Cuốn B (cọc 100k). Tổng cọc 150k. Quá hạn phạt 60k. Bạn đọc mang trả Cuốn A và xin giữ tiếp Cuốn B.
* **Xử lý:**
  1. Tất toán dứt điểm tiền phạt 60k của phiếu cũ ngay tại thời điểm trả.
  2. Hoàn trả khoản cọc 50k của Cuốn A đã trả thực tế.
  3. Khoản cọc 100k của Cuốn B được **chuyển liên kết** sang phiếu mới (`preceding_receipt_id`), không phát sinh dòng tiền thu/hoàn giả 100k.
  4. Phiếu mới được cấp hạn chuẩn mới 14 ngày và reset số lần gia hạn về 0.

#### B. Kịch bản ngoại lệ: Tiền phạt đã dùng hết cọc cũ
* **Bối cảnh:** Phiếu cũ cọc 150k, quá hạn phạt chạm trần 150k. Bạn đọc trả Cuốn A (cọc 50k) và muốn giữ Cuốn B (cọc 100k).
* **Xử lý theo quyết định đã chốt:**
  1. Giữ toàn bộ 150k cọc cũ để quyết toán dứt điểm khoản phạt 150k:
     - Bút toán: Nợ `COC_PHAI_HOAN` 150k / Có `THU_PHAT` 150k.
  2. Vì cọc cũ đã dùng hết sạch, **không được chuyển tiếp cọc cũ** cho Cuốn B.
  3. Để mượn tiếp Cuốn B, người trực **phải thu mới 100.000 ₫ tiền cọc** cho phiếu chuyển tiếp.
  4. Tiền mặt thực tế tại quầy tăng thêm đúng 100.000 ₫ (không tăng 250k).
  5. Nếu bạn đọc chưa nộp 100k cọc mới, hệ thống giữ phiếu ở trạng thái chờ thanh toán, không cho phép Cuốn B thành sách đang mượn hợp lệ.

---

### 2.4 Use Case 4: Gia Hạn Mượn Sách (Loan Renewal)

1. **Gia hạn khi chưa quá hạn (kể cả đúng ngày đến hạn):**
   * Hạn mới = Hạn hiện tại + 14 ngày lịch.
   * Số lần gia hạn tăng lên 1 (`renew_count = renew_count + 1`).
2. **Gia hạn khi đã quá hạn:**
   * Bước 1: Quyết toán và thu tiền phạt của khoảng ngày quá hạn cũ trước.
   * Bước 2: Hạn mới = Ngày thực hiện gia hạn + 14 ngày.
   * Số lần gia hạn tăng lên 1 (vẫn trong hạn mức tối đa 3 lần của phiếu hiện tại).

---

### 2.5 Use Case 5: Bán Sách Mới Theo Lô & Quyết Toán Nhà Sách

* **Đặc tả ví dụ đã xác nhận:** Nhận lô 100 cuốn từ Nhà sách Nhã Nam, giá bìa 100k, chiết khấu 35% (giá nhập 65k). Cọc nhà sách 1.000.000 ₫. Bán được 60 cuốn với giá 80k (thu tiền ngay 4.800.000 ₫). Trả lại 40 cuốn dư về nhà sách.
* **Quy tắc quyết toán:**
  * Bút toán 1: **Nhận hoàn cọc nhà sách:**
    - Nợ: `TIEN_NGAN_HANG`: `1.000.000 ₫`
    - Có: `COC_DAT_NHA_SACH`: `1.000.000 ₫`
  * Bút toán 2: **Thanh toán tiền 60 cuốn sách đã bán:**
    - Nợ: `NO_PHAI_TRA_NHA_SACH`: `3.900.000 ₫` (60 cuốn × 65k)
    - Có: `TIEN_NGAN_HANG`: `3.900.000 ₫`
  * *Tuyệt đối không gộp thành 1 khoản chuyển khoản ròng 2.900.000 ₫.*

---

## 3. Quản Lý Phiên Quầy Tiền & Đối Soát Đầu/Cuối Buổi

1. **Một hộp tiền chung duy nhất:** Cả 3-5 thành viên ghi giao dịch dùng chung một phiên quầy (`cash_sessions`), không tạo số dư đầu ca riêng rẽ cho từng người.
2. **Ràng buộc duy nhất phiên mở (Single Active Session Constraint):**
   * Sử dụng Partial Unique Index trên PostgreSQL:
     ```sql
     CREATE UNIQUE INDEX idx_single_active_cash_session ON cash_sessions (is_closed) WHERE is_closed = FALSE;
     ```
   * Chặn race condition ở cấp database khi nhiều thành viên cùng bấm mở ca đồng thời.
3. **Quy trình Mở Ca & Xác Lập Opening Float:**
   * Lần đầu tiên xác lập quỹ tiền mặt mở quầy: Nhập `openingCash`, lưu `actual_opening_cash`, **tuyệt đối không ghi nhận thành doanh thu hay thu cọc mới**.
   * Các buổi trực tiếp theo (Bàn giao ca): Nhập `handedOverFromSessionId` trỏ về ca trước đó. Nếu số tiền thực tế đếm được khác với số tiền đóng ca trước (`actual_closing_cash`), **bắt buộc phải nhập lý do giải trình** (`discrepancy_reason`), ném lỗi `DISCREPANCY_REASON_REQUIRED` nếu để trống.
   * Số tiền bàn giao mang tính chất luân chuyển vật lý giữa các buổi trực, không tạo thêm bất kỳ bút toán sổ cái nào.
4. **Liên kết giao dịch phát sinh với phiên quầy (`journal_entries.cash_session_id`):**
   * Mỗi bút toán thu/chi tiền mặt xác nhận của `FUND_LOAN` đều được gắn `cash_session_id`.
   * Tiền mặt thực thu trong ca: Các bút toán Nợ `TIEN_MAT_HOP` có `cash_session_id`.
   * Tiền mặt thực chi trong ca: Các bút toán Có `TIEN_MAT_HOP` có `cash_session_id`.
   * Tiền ngân hàng phát sinh trong ca: Các bút toán Nợ/Có `TIEN_NGAN_HANG` có `cash_session_id` để báo cáo thống kê riêng (`bankIn`, `bankOut`), **tuyệt đối không cộng gộp vào hộp tiền mặt quầy**.
5. **Công thức kiểm kê cuối buổi:**
   $$\text{expectedClosingCash} = \text{openingCash} + \text{cashIn} - \text{cashOut}$$
6. **Quy trình Đóng Ca & Xử Lý Chênh Lệch Thực Đếm:**
   * Bước 1: Khóa dòng `cash_sessions` (`FOR UPDATE`).
   * Bước 2: Chốt snapshot `expected_closing_cash` tại thời điểm đóng.
   * Bước 3: Lưu `actual_closing_cash` do người trực thực tế đếm được.
   * Bước 4: Tính toán chênh lệch:
     $$\text{discrepancy} = \text{actualClosingCash} - \text{expectedClosingCash}$$
   * Bước 5: Nếu $\text{discrepancy} \neq 0$, bắt buộc phải có `discrepancyReason`. Hệ thống **tuyệt đối không tự ý sửa số liệu journal**, không tạo bút toán khống thu nhập/chi phí và không lấy quỹ khác bù vào để ép khớp số.
   * Bước 6: Cập nhật `is_closed = TRUE`, `closed_at = NOW()`, `closed_by`.
   * Ca đã đóng **cấm tuyệt đối nhận thêm tiền mặt mới** (`SessionAlreadyClosedError`). Mọi request retry hoặc backdated đều bị chặn.
7. **Thứ tự khóa giao dịch phòng chống Deadlock (Deadlock-Free Locking Order):**
   $$\text{cash\_sessions} \longrightarrow \text{deposit\_allocations} \longrightarrow \text{refund\_intents} \longrightarrow \text{journal\_entries} \longrightarrow \text{idempotency\_records}$$
   * Khi đóng ca cạnh tranh với giao dịch thu/chi: Nếu thu/chi commit trước thì ghi nhận vào snapshot của ca; nếu đóng ca commit trước thì giao dịch mới bị chặn và được thực hiện ở ca tiếp theo.
8. **Xử lý hoàn cọc chờ qua nhiều ca (Cross-Session Refund):**
   * Yêu cầu hoàn cọc (`requestDepositRefund`) tạo `refund_intents` ở trạng thái `PENDING` tại Ca A.
   * Thực chi tiền mặt (`confirmDepositRefund`) diễn ra tại Ca B: Ghi nhận giảm tiền mặt (`cashOut`) thuộc Ca B, liên kết đúng intent gốc, giải phóng nghĩa vụ cọc chính xác một lần duy nhất.
9. **Báo cáo đối soát cọc bắt buộc tại quầy:**
   * Cọc đầu ca còn phải hoàn: $C_{\text{đầu}}$
   * Cọc mới thu trong ca: $+ C_{\text{thu}}$
   * Cọc đã hoàn trả trong ca: $- C_{\text{hoàn}}$
   * Cọc chuyển tiếp liên kết: $\pm C_{\text{chuyển}}$ (không làm đổi tổng nghĩa vụ)
   * Cọc đã xử lý mất sách / phạt cấn trừ: $- C_{\text{xử lý}}$
   * Cọc cuối ca còn phải hoàn: $C_{\text{cuối}} = C_{\text{đầu}} + C_{\text{thu}} - C_{\text{hoàn}} - C_{\text{xử lý}}$
   * **Bất biến đối soát:** $C_{\text{cuối}}$ phải khớp chính xác với số dư tài khoản `COC_PHAI_HOAN` trên sổ cái (`assertLiabilityReconciliation`).
