/**
 * YSBK Circulation Module Service (Chặng 07: Nghiệp vụ Lập phiếu mượn & Nhận cọc)
 */

import type { Queryable, PaymentMethod } from '../finance/types.ts';
import { FUND_IDS, ACCOUNT_CODES } from '../finance/types.ts';
import { calculateDeposit } from '../catalog/rules.ts';
import { normalizePhone } from '../borrowers/rules.ts';
import { recordJournalEntry, assertLiabilityReconciliation } from '../finance/ledger.ts';
import { recordAuditLog } from '../shared/audit.ts';
import {
  CirculationError,
  CopyNotAvailableError,
  BorrowerNotEligibleError,
  LoanReceiptNotFoundError,
  LoanAlreadyReturnedError,
  ClosedSessionError,
  DepositAmountMismatchError,
  FineReasonRequiredError,
  MaxRenewalsExceededError,
  InvalidLoanStatusForRenewalError,
  AllocationCoverageError,
  type IssueLoanParams,
  type LoanReceiptDto,
  type LoanItemSnapshotDto,
  type LoanReceiptStatus,
  type SettleReturnParams,
  type SettleReturnResult,
  type RefundIntentSummaryDto,
  type ConfirmRefundParams,
  type ConfirmRefundResult,
  type RenewLoanParams,
  type RenewLoanResult,
  type LoanRenewalDto,
  type ConfirmNewDepositParams,
  type ConfirmNewDepositResult,
  type CollectPendingFineParams,
  type CollectPendingFineResult,
  type ReportBookLossParams,
  type ReportBookLossResult,
  type QuoteLoanActionParams,
  type QuoteLoanActionResult,
  type PendingRefundItemDto,
  type PendingDepositItemDto,
  type PendingFineItemDto,
} from './types.ts';

export {
  LoanReceiptNotFoundError,
  MaxRenewalsExceededError,
  InvalidLoanStatusForRenewalError,
  AllocationCoverageError,
  FineReasonRequiredError,
  NoValidDutyShiftFoundError,
} from './types.ts';
import {
  validateIssueLoanInput,
  validateSettleReturnInput,
  validateRenewLoanInput,
  validateConfirmNewDepositInput,
  validateCollectPendingFineInput,
  validateReportBookLossInput,
  getCurrentVietnamDate,
  normalizeDateToVietnamYmd,
  calculateEffectiveDueDate,
  getHolidayAdjustedDueDate,
  calculateOverdueDays,
  calculateSuggestedFine,
  evaluateFineAndRefund,
  generateReceiptNumber,
} from './rules.ts';

/**
 * Lập phiếu mượn sách và nhận cọc nguyên tử trong một Transaction duy nhất (Chặng 07)
 * Thứ tự khóa tài nguyên chống Deadlock:
 *   1. cash_sessions (FOR UPDATE)
 *   2. borrowers (FOR UPDATE)
 *   3. book_copies (FOR UPDATE theo thứ tự UUID tăng dần)
 *   4. loan_receipts -> loan_items -> deposit_allocations -> journal_entries -> audit
 */
export async function issueLoanReceipt(
  db: Queryable,
  params: IssueLoanParams,
  actorId: string
): Promise<LoanReceiptDto> {
  const { normalizedBarcodes, normalizedCopyIds, paymentMethod, confirmedAmount } = validateIssueLoanInput(params);

  // 1. Khóa và kiểm tra Phiên quầy tiền mặt đang mở (Cash Session)
  let activeSessionId: string | null = null;
  if (params.sessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [params.sessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(`Không tìm thấy phiên quầy ID '${params.sessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
    if (sRes.rows[0].is_closed) {
      throw new CirculationError('Phiên quầy chỉ định đã đóng, không thể ghi nhận mượn sách.', 'SESSION_CLOSED', 409);
    }
    activeSessionId = sRes.rows[0].id;
  } else {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE is_closed = FALSE FOR UPDATE`
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(
        'Bàn trực chưa có phiên quầy tiền mặt đang mở. Bắt buộc mở ca trước khi lập phiếu cho mượn.',
        'NO_ACTIVE_CASH_SESSION',
        400
      );
    }
    activeSessionId = sRes.rows[0].id;
  }

  // 2. Khóa và kiểm tra Người mượn (Borrower)
  const bRes = await db.query<any>(
    `SELECT id, full_name, phone, is_archived FROM borrowers WHERE id = $1 FOR UPDATE`,
    [params.borrowerId]
  );
  if (!bRes.rows || bRes.rows.length === 0) {
    throw new BorrowerNotEligibleError(`Không tìm thấy hồ sơ người mượn ID '${params.borrowerId}'.`);
  }
  const borrower = bRes.rows[0];
  if (borrower.is_archived) {
    throw new BorrowerNotEligibleError('Hồ sơ người mượn đã bị lưu trữ, không thể lập phiếu mượn mới.');
  }

  // 2b. Khóa và kiểm tra hạn mức 3 suất theo SĐT người mượn (PRF-06)
  // Gồm: Các đơn online đang HELD + Tất cả sách đang mượn chưa trả qua tất cả hồ sơ cùng SĐT + số sách mượn mới
  let normalizedBorrowerPhone = borrower.phone;
  try {
    normalizedBorrowerPhone = normalizePhone(borrower.phone);
  } catch {}

  await db.query(
    `INSERT INTO reservation_quota_locks (lock_namespace) 
     VALUES ($1) 
     ON CONFLICT (lock_namespace) DO UPDATE SET locked_at = NOW()`,
    [`phone:${normalizedBorrowerPhone}`]
  );

  // Đếm đơn HELD (loại trừ chính đơn đặt đang được bàn giao nếu có reservationId)
  const heldQuery = params.reservationId
    ? `SELECT COUNT(*) AS count FROM reservations WHERE phone = $1 AND status = 'HELD' AND expires_at > NOW() AND id != $2`
    : `SELECT COUNT(*) AS count FROM reservations WHERE phone = $1 AND status = 'HELD' AND expires_at > NOW()`;
  const heldQueryParams = params.reservationId ? [normalizedBorrowerPhone, params.reservationId] : [normalizedBorrowerPhone];
  const activeHoldsRes = await db.query<{ count: string }>(heldQuery, heldQueryParams);
  const activeHoldsCount = Number(activeHoldsRes.rows[0]?.count || 0);

  // Đếm sách đang mượn chưa kết thúc nghĩa vụ
  const activeLoansRes = await db.query<{ unreturned_count: string }>(
    `SELECT COUNT(DISTINCT li.copy_id) AS unreturned_count
     FROM loan_items li
     JOIN loan_receipts lr ON li.receipt_id = lr.id
     JOIN borrowers b ON lr.borrower_id = b.id
     WHERE b.phone = $1 
       AND li.returned_at IS NULL 
       AND li.carried_forward_at IS NULL
`,
    [normalizedBorrowerPhone]
  );
  const activeLoansCount = Number(activeLoansRes.rows[0]?.unreturned_count || 0);

  const numNewCopies = (normalizedCopyIds && normalizedCopyIds.length) || (normalizedBarcodes && normalizedBarcodes.length) || 1;
  if (activeHoldsCount + activeLoansCount + numNewCopies > 3) {
    throw new CirculationError(
      `Số điện thoại ${normalizedBorrowerPhone} đã đạt hạn mức tối đa 3 suất (hiện đang giữ ${activeHoldsCount} cuốn, đang mượn ${activeLoansCount} cuốn chưa trả, muốn mượn thêm ${numNewCopies} cuốn).`,
      'PHONE_QUOTA_EXCEEDED',
      400
    );
  }

  // 3. Tìm và khóa các Bản sách (Book Copies) theo thứ tự ID cố định
  let copies: any[] = [];
  if (normalizedCopyIds && normalizedCopyIds.length > 0) {
    const sortedIds = [...normalizedCopyIds].sort();
    const cRes = await db.query<any>(
      `SELECT bc.id, bc.barcode, bc.location, bc.status, bc.cover_price,
              be.id AS edition_id, be.publisher, bt.id AS title_id, bt.title
       FROM book_copies bc
       JOIN book_editions be ON be.id = bc.edition_id
       JOIN book_titles bt ON bt.id = be.title_id
       WHERE bc.id = ANY($1)
       ORDER BY bc.id ASC
       FOR UPDATE`,
      [sortedIds]
    );
    copies = cRes.rows;
    if (copies.length !== sortedIds.length) {
      throw new CirculationError('Một hoặc nhiều bản sách chỉ định không tồn tại.', 'COPY_NOT_FOUND', 404);
    }
  } else if (normalizedBarcodes && normalizedBarcodes.length > 0) {
    // Tìm copy IDs trước để sort
    const idLookup = await db.query<any>(
      `SELECT id, barcode FROM book_copies WHERE barcode = ANY($1)`,
      [normalizedBarcodes]
    );
    if (!idLookup.rows || idLookup.rows.length !== normalizedBarcodes.length) {
      throw new CirculationError('Một hoặc nhiều mã vạch sách chỉ định không tồn tại.', 'COPY_NOT_FOUND', 404);
    }
    const sortedIds = idLookup.rows.map((r) => r.id).sort();

    const cRes = await db.query<any>(
      `SELECT bc.id, bc.barcode, bc.location, bc.status, bc.cover_price,
              be.id AS edition_id, be.publisher, bt.id AS title_id, bt.title
       FROM book_copies bc
       JOIN book_editions be ON be.id = bc.edition_id
       JOIN book_titles bt ON bt.id = be.title_id
       WHERE bc.id = ANY($1)
       ORDER BY bc.id ASC
       FOR UPDATE`,
      [sortedIds]
    );
    copies = cRes.rows;
  }

  // Kiểm tra tính khả dụng của từng bản sách
  for (const copy of copies) {
    if (copy.status !== 'AVAILABLE') {
      throw new CopyNotAvailableError(
        `Bản sách '${copy.barcode}' không ở trạng thái khả dụng (trạng thái hiện tại: ${copy.status}).`
      );
    }
  }

  // Phòng thủ chuyên sâu: Kiểm tra xem bản sách có đang nằm trong loan_items active nào không
  const activeCopyCheck = await db.query<any>(
    `SELECT copy_id FROM loan_items WHERE copy_id = ANY($1) AND returned_at IS NULL AND is_lost = FALSE AND carried_forward_at IS NULL`,
    [copies.map((c) => c.id)]
  );
  if (activeCopyCheck.rows && activeCopyCheck.rows.length > 0) {
    throw new CopyNotAvailableError('Bản sách này đang được mượn bởi phiếu khác chưa hoàn tất.');
  }

  // Phòng thủ: Chặn mượn thủ công bản sách đang được giữ chỗ (HELD) bởi đơn đặt trước
  const heldCopyCheck = await db.query<any>(
    `SELECT r.copy_id, r.code, r.id 
     FROM reservations r 
     WHERE r.copy_id = ANY($1) 
       AND r.status = 'HELD' 
       AND r.expires_at > NOW()`,
    [copies.map((c) => c.id)]
  );
  if (heldCopyCheck.rows && heldCopyCheck.rows.length > 0) {
    for (const held of heldCopyCheck.rows) {
      if (!params.reservationId || params.reservationId !== held.id) {
        throw new CopyNotAvailableError(
          `Bản sách đang được giữ chỗ cho đơn đặt trước mã '${held.code}', không thể cho mượn thủ công.`
        );
      }
    }
  }

  // 4. Tính toán tiền cọc từng cuốn theo công thức YSBK
  const itemSnapshots = copies.map((copy) => {
    const coverPriceBigInt = copy.cover_price !== null ? BigInt(copy.cover_price) : null;
    const depositAmount = calculateDeposit(coverPriceBigInt);
    return {
      copy,
      coverPrice: coverPriceBigInt !== null ? Number(coverPriceBigInt) : null,
      depositAmount,
    };
  });

  const totalDepositBigInt = itemSnapshots.reduce((acc, curr) => acc + curr.depositAmount, 0n);

  // S07-04: Ràng buộc confirmedAmount nếu client có gửi
  if (confirmedAmount !== undefined && confirmedAmount !== null) {
    if (confirmedAmount !== totalDepositBigInt) {
      throw new DepositAmountMismatchError(
        `Số tiền cọc xác nhận (${confirmedAmount.toString()}₫) không khớp với số tiền thực tế tính bởi hệ thống (${totalDepositBigInt.toString()}₫).`
      );
    }
  }

  // 5. Chuẩn bị ngày mượn và hạn mượn (áp dụng lịch trực & ngày nghỉ - S07-07)
  const holRes = await db.query<any>(`SELECT holiday_date FROM calendar_holidays`);
  const holidays = (holRes.rows || []).map((r: any) => normalizeDateToVietnamYmd(r.holiday_date));
  const borrowDate = getCurrentVietnamDate();
  const { originalDueDate, effectiveDueDate } = calculateEffectiveDueDate(borrowDate, 14, holidays);
  const receiptNumber = generateReceiptNumber(borrowDate);

  // 6. Ghi bản ghi phiếu mượn (loan_receipts)
  const insReceiptRes = await db.query<any>(
    `INSERT INTO loan_receipts (receipt_number, borrower_id, borrow_date, due_date, renew_count, status, created_by, notes)
     VALUES ($1, $2, $3, $4, 0, 'ACTIVE', $5, $6)
     RETURNING id, receipt_number, borrow_date, due_date, status, created_at`,
    [receiptNumber, borrower.id, borrowDate, effectiveDueDate, actorId, params.notes || null]
  );
  const receiptRow = insReceiptRes.rows[0];
  const receiptId = receiptRow.id;

  const resultItems: LoanItemSnapshotDto[] = [];

  // 7. Ghi từng dòng sách mượn (loan_items), đổi trạng thái sách, và tạo phân bổ cọc (deposit_allocations)
  for (let i = 0; i < itemSnapshots.length; i++) {
    const item = itemSnapshots[i];

    // Ghi loan_item
    const insItemRes = await db.query<any>(
      `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot, returned_at, is_lost)
       VALUES ($1, $2, $3, NULL, FALSE)
       RETURNING id, copy_id, deposit_snapshot, returned_at, is_lost`,
      [receiptId, item.copy.id, item.depositAmount.toString()]
    );
    const itemRow = insItemRes.rows[0];

    // Chuyển trạng thái bản sách sang BORROWED
    await db.query(
      `UPDATE book_copies SET status = 'BORROWED' WHERE id = $1`,
      [item.copy.id]
    );

    // Ghi deposit_allocations 1-1 với item
    const insAllocRes = await db.query<any>(
      `INSERT INTO deposit_allocations (
        receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method
      ) VALUES ($1, $2, $3, $4, $5, 'HELD', $6)
      RETURNING id`,
      [
        receiptId,
        itemRow.id,
        FUND_IDS.LOAN,
        item.depositAmount.toString(),
        item.depositAmount.toString(),
        paymentMethod,
      ]
    );
    const allocId = insAllocRes.rows[0].id;

    // Ghi sổ cái journal_entries gắn 1-1 với allocation.id (S05-02 & S06-02)
    const debitAccount = paymentMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;
    const entryCode = `JE-DEP-${receiptNumber}-${i + 1}`;

    await recordJournalEntry(db, {
      entryCode,
      fundId: FUND_IDS.LOAN,
      sourceType: 'LOAN_DEPOSIT',
      sourceId: allocId,
      debitAccount,
      creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      amount: item.depositAmount,
      cashSessionId: activeSessionId, // S07-05: Gắn session cho cả CASH và BANK để báo cáo buổi truy đủ
      createdBy: actorId,
      notes: `Nhận cọc sách '${item.copy.barcode}' phiếu ${receiptNumber}`,
    });

    resultItems.push({
      id: itemRow.id,
      copyId: item.copy.id,
      barcode: item.copy.barcode,
      title: item.copy.title,
      publisher: item.copy.publisher,
      coverPrice: item.coverPrice,
      depositSnapshot: Number(item.depositAmount),
      isReturned: false,
      isLost: false,
    });
  }

  // 8. Nếu nhận cọc tiền mặt (CASH), cập nhật expected_closing_cash của phiên quầy
  if (paymentMethod === 'CASH') {
    await db.query(
      `UPDATE cash_sessions
       SET expected_closing_cash = expected_closing_cash + $2
       WHERE id = $1`,
      [activeSessionId, totalDepositBigInt.toString()]
    );
  }

  // 9. Đối soát tính cân đối nghĩa vụ cọc ngay trong transaction
  await assertLiabilityReconciliation(db);

  // 10. Ghi nhật ký kiểm toán hệ thống (system_audit_logs)
  await recordAuditLog(db, {
    actorId,
    action: 'ISSUE_LOAN',
    targetResource: 'LOAN_RECEIPT',
    targetId: receiptId,
    details: {
      receiptNumber,
      borrowerId: borrower.id,
      borrowerName: borrower.full_name,
      copyCount: resultItems.length,
      barcodes: resultItems.map((it) => it.barcode),
      totalDeposit: Number(totalDepositBigInt),
      paymentMethod,
      cashSessionId: activeSessionId,
    },
  });

  return {
    id: receiptId,
    receiptNumber: receiptRow.receipt_number,
    borrowerId: borrower.id,
    borrowerName: borrower.full_name,
    borrowerPhone: borrower.phone,
    borrowDate: receiptRow.borrow_date,
    dueDate: receiptRow.due_date,
    originalDueDate,
    renewCount: 0,
    status: receiptRow.status as LoanReceiptStatus,
    items: resultItems,
    totalDeposit: Number(totalDepositBigInt),
    paymentMethod,
    confirmedBy: actorId,
    sessionId: activeSessionId,
    createdAt: receiptRow.created_at,
    notes: params.notes || null,
  };
}

/**
 * Tra cứu chi tiết phiếu mượn theo ID (Nội bộ: Member/Admin)
 */
export async function getLoanReceiptById(
  db: Queryable,
  receiptId: string
): Promise<LoanReceiptDto | null> {
  const rRes = await db.query<any>(
    `SELECT lr.id, lr.receipt_number, lr.borrow_date, lr.due_date, lr.renew_count, lr.status,
            lr.preceding_receipt_id, lr.created_by, lr.created_at, lr.notes,
            b.id AS borrower_id, b.full_name AS borrower_name, b.phone AS borrower_phone
      FROM loan_receipts lr
      JOIN borrowers b ON b.id = lr.borrower_id
      WHERE lr.id = $1`,
    [receiptId]
  );

  if (!rRes.rows || rRes.rows.length === 0) return null;
  const r = rRes.rows[0];

  // Lấy danh sách items kèm thông tin sách và lineage chuyển tiếp
  const itemRes = await db.query<any>(
    `SELECT li.id, li.copy_id, li.deposit_snapshot, li.returned_at, li.is_lost, li.lost_at, li.lost_reason,
            li.carried_forward_at, li.successor_item_id,
            bc.barcode, bc.cover_price, be.publisher, bt.title
      FROM loan_items li
      JOIN book_copies bc ON bc.id = li.copy_id
      JOIN book_editions be ON be.id = bc.edition_id
      JOIN book_titles bt ON bt.id = be.title_id
      WHERE li.receipt_id = $1
      ORDER BY li.id ASC`,
    [receiptId]
  );

  // Lấy phương thức thanh toán cọc từ deposit_allocations
  const allocRes = await db.query<any>(
    `SELECT payment_method, original_amount FROM deposit_allocations WHERE receipt_id = $1 LIMIT 1`,
    [receiptId]
  );
  const paymentMethod: PaymentMethod = allocRes.rows[0]?.payment_method || 'CASH';

  // S07-05 & S09-07: Tìm cash_session_id từ journal_entries gắn với deposit_allocations (hoặc truy qua allocation gốc nếu chuyển tiếp)
  const jeRes = await db.query<any>(
    `SELECT je.cash_session_id
      FROM deposit_allocations da
      LEFT JOIN deposit_allocations orig_da ON orig_da.id = da.transferred_from_allocation_id
      JOIN journal_entries je ON (je.source_type = 'LOAN_DEPOSIT' OR je.source_type = 'LOAN_DEPOSIT_REFUND')
        AND (je.source_id = da.id::text OR je.source_id = orig_da.id::text)
      WHERE da.receipt_id = $1 AND je.cash_session_id IS NOT NULL
      LIMIT 1`,
    [receiptId]
  );
  const sessionId = jeRes.rows && jeRes.rows.length > 0 ? jeRes.rows[0].cash_session_id : null;

  const items: LoanItemSnapshotDto[] = itemRes.rows.map((row) => ({
    id: row.id,
    copyId: row.copy_id,
    barcode: row.barcode,
    title: row.title,
    publisher: row.publisher,
    coverPrice: row.cover_price !== null ? Number(row.cover_price) : null,
    depositSnapshot: Number(row.deposit_snapshot),
    isReturned: Boolean(row.returned_at),
    isLost: Boolean(row.is_lost),
    lostAt: row.lost_at ? String(row.lost_at) : null,
    lostReason: row.lost_reason || null,
    carriedForwardAt: row.carried_forward_at ? String(row.carried_forward_at) : null,
    successorItemId: row.successor_item_id || null,
  }));

  const totalDeposit = items.reduce((acc, it) => acc + it.depositSnapshot, 0);

  // S08-05: Đọc settlement snapshot nếu phiếu đã tất toán
  const sRes = await db.query<any>(
    `SELECT id, fine_suggested, fine_final, fine_reason, settled_at, settled_by
     FROM loan_settlements
     WHERE receipt_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [receiptId]
  );
  const settlementRow = sRes.rows && sRes.rows.length > 0 ? sRes.rows[0] : null;

  return {
    id: r.id,
    receiptNumber: r.receipt_number,
    borrowerId: r.borrower_id,
    borrowerName: r.borrower_name,
    borrowerPhone: r.borrower_phone,
    borrowDate: normalizeDateToVietnamYmd(r.borrow_date),
    dueDate: normalizeDateToVietnamYmd(r.due_date),
    renewCount: Number(r.renew_count),
    status: r.status as LoanReceiptStatus,
    precedingReceiptId: r.preceding_receipt_id || null,
    items,
    totalDeposit,
    paymentMethod,
    confirmedBy: r.created_by,
    sessionId,
    fineSuggested: settlementRow ? Number(settlementRow.fine_suggested) : undefined,
    fineFinal: settlementRow ? Number(settlementRow.fine_final) : undefined,
    fineReason: settlementRow ? settlementRow.fine_reason : undefined,
    settledAt: settlementRow ? settlementRow.settled_at : undefined,
    settledBy: settlementRow ? settlementRow.settled_by : undefined,
    createdAt: r.created_at,
    notes: r.notes || null,
  };
}

/**
 * Danh sách phiếu mượn nội bộ (Nội bộ: Member/Admin)
 */
export async function listLoanReceipts(
  db: Queryable,
  params: { borrowerId?: string; status?: string; page?: number; limit?: number } = {}
): Promise<{ items: LoanReceiptDto[]; total: number; page: number; limit: number }> {
  let page = 1;
  if (params.page !== undefined && params.page !== null) {
    const p = Number(params.page);
    if (!Number.isFinite(p) || !Number.isInteger(p) || p < 1) {
      throw new CirculationError('Tham số page phải là số nguyên dương.', 'INVALID_PAGE', 400);
    }
    page = p;
  }

  let limit = 20;
  if (params.limit !== undefined && params.limit !== null) {
    const l = Number(params.limit);
    if (!Number.isFinite(l) || !Number.isInteger(l) || l < 1 || l > 100) {
      throw new CirculationError('Tham số limit phải là số nguyên từ 1 đến 100.', 'INVALID_LIMIT', 400);
    }
    limit = l;
  }
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (params.borrowerId) {
    conditions.push(`lr.borrower_id = $${paramIdx}`);
    queryParams.push(params.borrowerId);
    paramIdx++;
  }

  if (params.status) {
    conditions.push(`lr.status = $${paramIdx}`);
    queryParams.push(params.status);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const countRes = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM loan_receipts lr WHERE ${whereClause}`,
    queryParams
  );
  const total = Number(countRes.rows[0]?.total || 0);

  const selRes = await db.query<any>(
    `SELECT lr.id
     FROM loan_receipts lr
     WHERE ${whereClause}
     ORDER BY lr.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...queryParams, limit, offset]
  );

  const items: LoanReceiptDto[] = [];
  for (const row of selRes.rows) {
    const detail = await getLoanReceiptById(db, row.id);
    if (detail) items.push(detail);
  }

  return { items, total, page, limit };
}

/**
 * Tất toán trả toàn bộ sách (Chặng 08: Full Return, Fine Policy & Refund Intents)
 * Thứ tự khóa tài nguyên chống Deadlock:
 *   1. cash_sessions (FOR UPDATE)
 *   2. loan_receipts (FOR UPDATE)
 *   3. loan_items (FOR UPDATE)
 *   4. book_copies (FOR UPDATE theo thứ tự UUID tăng dần)
 *   5. deposit_allocations (FOR UPDATE theo thứ tự UUID tăng dần)
 */
export async function settleReturnReceipt(
  db: Queryable,
  params: SettleReturnParams,
  actorId: string
): Promise<SettleReturnResult> {
  const validated = validateSettleReturnInput(params);

  // 1. Khóa và kiểm tra Phiên quầy tiền mặt đang mở (Cash Session)
  let activeSessionId: string;
  if (validated.cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [validated.cashSessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(`Không tìm thấy phiên quầy ID '${validated.cashSessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
    if (sRes.rows[0].is_closed) {
      throw new ClosedSessionError('Phiên quầy chỉ định đã đóng, không thể tất toán trả sách.');
    }
    activeSessionId = sRes.rows[0].id;
  } else {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE is_closed = FALSE FOR UPDATE`
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new ClosedSessionError('Bàn trực chưa có phiên quầy tiền mặt đang mở. Bắt buộc mở ca trước khi tất toán trả sách.');
    }
    activeSessionId = sRes.rows[0].id;
  }

  // 2. Khóa và kiểm tra Phiếu mượn (Loan Receipt)
  const rRes = await db.query<any>(
    `SELECT id, receipt_number, borrower_id, borrow_date, due_date, status, renew_count, created_by, notes
     FROM loan_receipts WHERE id = $1 FOR UPDATE`,
    [validated.receiptId]
  );
  if (!rRes.rows || rRes.rows.length === 0) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${validated.receiptId}'.`);
  }
  const receipt = rRes.rows[0];
  if (receipt.status === 'RETURNED' || receipt.status === 'CANCELLED' || receipt.status === 'PARTIAL_SETTLED') {
    throw new LoanAlreadyReturnedError(
      `Phiếu mượn '${receipt.receipt_number}' đã ở trạng thái ${receipt.status}, không thể tất toán lại.`
    );
  }

  // 3. Khóa và kiểm tra các dòng sách (Loan Items)
  const itemRes = await db.query<any>(
    `SELECT li.id, li.copy_id, li.deposit_snapshot, li.returned_at, li.is_lost, li.carried_forward_at, li.successor_item_id,
            bc.barcode, bt.title
     FROM loan_items li
     JOIN book_copies bc ON bc.id = li.copy_id
     JOIN book_editions be ON be.id = bc.edition_id
     JOIN book_titles bt ON bt.id = be.title_id
     WHERE li.receipt_id = $1
     ORDER BY li.id ASC`,
    [receipt.id]
  );
  const loanItems = itemRes.rows;
  if (!loanItems || loanItems.length === 0) {
    throw new CirculationError('Phiếu mượn không chứa dòng sách nào.', 'EMPTY_LOAN_RECEIPT', 400);
  }

  // Lọc các bản sách chưa trả (chưa trả vật lý, chưa báo mất, chưa chuyển tiếp)
  const unreturnedItems = loanItems.filter((it: any) => !it.returned_at && !it.is_lost && !it.carried_forward_at);
  if (unreturnedItems.length === 0) {
    throw new LoanAlreadyReturnedError('Tất cả sách trong phiếu mượn đã được hoàn trả hoặc chuyển tiếp trước đó.');
  }

  // S08-02: Khớp danh sách sách trả với danh sách sách đang mượn
  let itemsToReturn: any[] = [];
  let itemsToKeep: any[] = [];

  if (validated.returnedBarcodes && validated.returnedBarcodes.length > 0) {
    const unreturnedBarcodeMap = new Map(unreturnedItems.map((it: any) => [it.barcode, it]));
    for (const b of validated.returnedBarcodes) {
      if (!unreturnedBarcodeMap.has(b)) {
        throw new CirculationError(
          `Mã vạch '${b}' không thuộc danh sách sách đang mượn của phiếu này hoặc đã được hoàn trả/chuyển tiếp.`,
          'COPY_NOT_IN_LOAN',
          400
        );
      }
    }
    const returnSet = new Set(validated.returnedBarcodes);
    itemsToReturn = validated.returnedBarcodes.map((b) => unreturnedBarcodeMap.get(b)!);
    itemsToKeep = unreturnedItems.filter((it: any) => !returnSet.has(it.barcode));
  } else if (validated.returnedCopyIds && validated.returnedCopyIds.length > 0) {
    const unreturnedCopyIdMap = new Map(unreturnedItems.map((it: any) => [it.copy_id, it]));
    for (const cid of validated.returnedCopyIds) {
      if (!unreturnedCopyIdMap.has(cid)) {
        throw new CirculationError(
          `Bản sách '${cid}' không thuộc danh sách sách đang mượn của phiếu này hoặc đã được hoàn trả/chuyển tiếp.`,
          'COPY_NOT_IN_LOAN',
          400
        );
      }
    }
    const returnSet = new Set(validated.returnedCopyIds);
    itemsToReturn = validated.returnedCopyIds.map((cid) => unreturnedCopyIdMap.get(cid)!);
    itemsToKeep = unreturnedItems.filter((it: any) => !returnSet.has(it.copy_id));
  }

  // Kiểm tra tính hợp lệ theo returnType (FULL vs PARTIAL)
  if (validated.returnType === 'FULL') {
    if (itemsToReturn.length !== unreturnedItems.length) {
      throw new CirculationError(
        'Tất toán toàn bộ (FULL) yêu cầu hoàn trả đầy đủ tất cả các sách đang mượn của phiếu. Chặng 08 chỉ hỗ trợ trả toàn bộ phiếu (Full Return); nếu muốn trả 1 cuốn và giữ 1 cuốn, vui lòng chọn returnType: "PARTIAL".',
        'FULL_RETURN_REQUIRES_ALL_COPIES',
        400
      );
    }
  } else if (validated.returnType === 'PARTIAL') {
    if (unreturnedItems.length !== 2) {
      throw new CirculationError(
        `Trả một phần (PARTIAL) chỉ áp dụng cho phiếu đang mượn đúng 2 cuốn sách (phiếu hiện tại có ${unreturnedItems.length} cuốn chưa trả).`,
        'INVALID_PARTIAL_RETURN_COUNT',
        400
      );
    }
    if (itemsToReturn.length !== 1 || itemsToKeep.length !== 1) {
      throw new CirculationError(
        'Trả một phần (PARTIAL) bắt buộc phải trả đúng 1 cuốn và giữ lại đúng 1 cuốn.',
        'INVALID_PARTIAL_RETURN_SELECTION',
        400
      );
    }
  }

  // 4. Khóa các bản sách (Book Copies) theo thứ tự ID ASC
  const sortedCopyIds = [...unreturnedItems.map((it: any) => it.copy_id)].sort();
  await db.query(
    `SELECT id FROM book_copies WHERE id = ANY($1) ORDER BY id ASC FOR UPDATE`,
    [sortedCopyIds]
  );

  // 5. Khóa các khoản phân bổ cọc (Deposit Allocations) của phiếu theo thứ tự ID ASC
  const allocRes = await db.query<any>(
    `SELECT id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method
     FROM deposit_allocations
     WHERE receipt_id = $1
     ORDER BY id ASC
     FOR UPDATE`,
    [receipt.id]
  );
  const allocations = allocRes.rows;
  const activeAllocations = allocations.filter(
    (a: any) => a.status === 'HELD' || a.status === 'PENDING_REFUND'
  );

  // Tổng tiền cọc có thể xử lý của phiếu (D)
  const totalDepositBigInt = activeAllocations.reduce(
    (sum: bigint, a: any) => sum + BigInt(a.remaining_amount),
    0n
  );

  // Đọc danh mục ngày nghỉ lễ/Tết (S07-07 / S08-08 / S10-03)
  const holRes = await db.query<any>('SELECT holiday_date FROM calendar_holidays');
  const holidays = (holRes.rows || []).map((r: any) => normalizeDateToVietnamYmd(r.holiday_date));

  // 6. Tính ngày trả, số ngày quá hạn, và phạt gợi ý theo ngày Việt Nam (S08-05: chuẩn hóa DATE, S10-03: áp dụng lịch nghỉ hiệu lực)
  const returnDate = getCurrentVietnamDate();
  const rawDueDate = normalizeDateToVietnamYmd(receipt.due_date);
  const { effectiveDueDate } = getHolidayAdjustedDueDate(rawDueDate, holidays);
  const overdueDays = calculateOverdueDays(effectiveDueDate, returnDate);
  const suggestedFineBigInt = calculateSuggestedFine(overdueDays);

  // 7. Đánh giá quyết định phạt và hoàn cọc
  const fineFinalBigInt = validated.fineAmount !== undefined && validated.fineAmount !== null
    ? validated.fineAmount
    : suggestedFineBigInt;

  const fineEval = evaluateFineAndRefund(
    totalDepositBigInt,
    fineFinalBigInt,
    suggestedFineBigInt,
    validated.fineReason
  );

  const returnTimestamp = new Date().toISOString();
  const settlementId = crypto.randomUUID();
  const refundMethod = validated.refundMethod;
  const finePaymentMethod = validated.finePaymentMethod;
  const refundIntents: RefundIntentSummaryDto[] = [];
  let depositRefundedBigInt = 0n;
  let depositForfeitedBigInt = 0n;
  let depositTransferredBigInt = 0n;
  let newDepositCollectedBigInt = 0n;
  let directFineCollectedBigInt = 0n;
  let newReceipt: any = null;

  // 8. Thực hiện tất toán theo returnType (FULL vs PARTIAL)
  if (validated.returnType === 'FULL') {
    // --- FULL RETURN ---
    if (fineEval.isForfeited) {
      // P >= D: Giữ toàn bộ D làm phạt
      depositForfeitedBigInt = fineEval.forfeitAmount;
      for (const alloc of activeAllocations) {
        await db.query(
          `UPDATE deposit_allocations
           SET status = 'FORFEITED', remaining_amount = 0, updated_at = NOW()
           WHERE id = $1`,
          [alloc.id]
        );
      }
      if (totalDepositBigInt > 0n) {
        await recordJournalEntry(db, {
          entryCode: `JE-FORFEIT-${receipt.receipt_number}`,
          fundId: FUND_IDS.LOAN,
          sourceType: 'LOAN_FINE_FORFEIT',
          sourceId: receipt.id,
          debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
          creditAccount: ACCOUNT_CODES.FINE_REVENUE,
          amount: totalDepositBigInt,
          cashSessionId: activeSessionId,
          createdBy: actorId,
          notes: `Tịch thu toàn bộ cọc ${totalDepositBigInt.toString()}₫ làm phạt cho phiếu ${receipt.receipt_number}`,
        });
      }
    } else {
      // P = 0 hoặc 0 < P < D: Hoàn đủ cọc D
      depositRefundedBigInt = fineEval.refundAmount;
      for (const alloc of activeAllocations) {
        const remaining = BigInt(alloc.remaining_amount);
        if (remaining > 0n) {
          const insIntent = await db.query<any>(
            `INSERT INTO refund_intents (
               allocation_id, amount, refund_method, status, requested_by
             ) VALUES ($1, $2, $3, 'PENDING', $4)
             RETURNING id, allocation_id, amount, refund_method, status`,
            [alloc.id, remaining.toString(), refundMethod, actorId]
          );
          const intentRow = insIntent.rows[0];

          await db.query(
            `UPDATE deposit_allocations
             SET status = 'PENDING_REFUND', refund_method = $2, updated_at = NOW()
             WHERE id = $1`,
            [alloc.id, refundMethod]
          );

          refundIntents.push({
            id: intentRow.id,
            allocationId: alloc.id,
            amount: Number(remaining),
            refundMethod,
            status: 'PENDING',
          });
        }
      }

      // S08-03: Thu phạt riêng biệt nếu tiền phạt đã được xác nhận thực nhận
      if (fineEval.directFineCollectAmount > 0n) {
        if (validated.finePaymentConfirmed) {
          directFineCollectedBigInt = fineEval.directFineCollectAmount;
          const debitAccount = finePaymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;

          await recordJournalEntry(db, {
            entryCode: `JE-FINE-${receipt.receipt_number}`,
            fundId: FUND_IDS.LOAN,
            sourceType: 'LOAN_FINE',
            sourceId: settlementId,
            debitAccount,
            creditAccount: ACCOUNT_CODES.FINE_REVENUE,
            amount: directFineCollectedBigInt,
            cashSessionId: activeSessionId,
            createdBy: actorId,
            notes: `Thu phạt quá hạn phiếu ${receipt.receipt_number}: ${directFineCollectedBigInt.toString()}₫`,
          });

          if (finePaymentMethod === 'CASH' && activeSessionId) {
            await db.query(
              `UPDATE cash_sessions
               SET expected_closing_cash = expected_closing_cash + $2
               WHERE id = $1`,
              [activeSessionId, directFineCollectedBigInt.toString()]
            );
          }
        } else {
          directFineCollectedBigInt = 0n; // Chờ thu phạt sau, không rollback nhận sách
        }
      }
    }

    // Cập nhật trạng thái toàn bộ bản sách sang AVAILABLE
    await db.query(
      `UPDATE book_copies SET status = 'AVAILABLE' WHERE id = ANY($1)`,
      [sortedCopyIds]
    );

    // S11-05: Cập nhật returned_at CHỈ cho các cuốn sách thực tế được trả vật lý (loại trừ sách đã báo mất)
    const returnedItemIds = itemsToReturn.map((it: any) => it.id);
    if (returnedItemIds.length > 0) {
      await db.query(
        `UPDATE loan_items SET returned_at = $2 WHERE id = ANY($1)`,
        [returnedItemIds, returnTimestamp]
      );
    }

    // Cập nhật phiếu sang RETURNED
    await db.query(
      `UPDATE loan_receipts SET status = 'RETURNED' WHERE id = $1`,
      [receipt.id]
    );

    // Cập nhật đơn đặt giữ chỗ liên quan sang RETURNED để mở lại suất SĐT
    await db.query(
      `UPDATE reservations 
       SET status = 'RETURNED', returned_at = $2, updated_at = $2 
       WHERE copy_id = ANY($1) AND status = 'BORROWED'`,
      [sortedCopyIds, returnTimestamp]
    );
  } else {
    // --- PARTIAL RETURN (Chặng 09) ---
    const returnedItem = itemsToReturn[0];
    const keptItem = itemsToKeep[0];

    // 1. Bản sách trả thành AVAILABLE; bản sách giữ lại GIỮ NGUYÊN BORROWED!
    await db.query(
      `UPDATE book_copies SET status = 'AVAILABLE' WHERE id = $1`,
      [returnedItem.copy_id]
    );

    // 2. Dòng sách trả ghi nhận returned_at thật
    await db.query(
      `UPDATE loan_items SET returned_at = $2 WHERE id = $1`,
      [returnedItem.id, returnTimestamp]
    );

    // Cập nhật đơn đặt giữ chỗ của bản sách thực tế được trả sang RETURNED
    await db.query(
      `UPDATE reservations 
       SET status = 'RETURNED', returned_at = $2, updated_at = $2 
       WHERE copy_id = $1 AND status = 'BORROWED'`,
      [returnedItem.copy_id, returnTimestamp]
    );

    // 3. Tạo phiếu mượn mới (preceding_receipt_id = old_receipt.id, renew_count = 0, hạn +14 ngày lịch VN)
    const { effectiveDueDate } = calculateEffectiveDueDate(returnDate, 14, holidays);
    const newReceiptNumber = generateReceiptNumber(returnDate);
    const insNewReceiptRes = await db.query<any>(
      `INSERT INTO loan_receipts (
         receipt_number, borrower_id, borrow_date, due_date, renew_count, status, preceding_receipt_id, created_by, notes
       ) VALUES ($1, $2, $3, $4, 0, 'ACTIVE', $5, $6, $7)
       RETURNING id, receipt_number, borrow_date, due_date, status`,
      [newReceiptNumber, receipt.borrower_id, returnDate, effectiveDueDate, receipt.id, actorId, validated.notes || null]
    );
    newReceipt = insNewReceiptRes.rows[0];

    // S09-01: Đóng logical hold cũ trên cuốn giữ lại TRƯỚC KHI tạo dòng mượn mới
    // để tránh vi phạm Partial Unique Index idx_unique_active_copy_loan trên PostgreSQL trong cùng transaction!
    await db.query(
      `UPDATE loan_items
       SET carried_forward_at = $2
       WHERE id = $1`,
      [keptItem.id, returnTimestamp]
    );

    // 4. Tạo dòng sách mới trên phiếu mới cho cuốn giữ lại
    const insNewItemRes = await db.query<any>(
      `INSERT INTO loan_items (
         receipt_id, copy_id, deposit_snapshot, returned_at, is_lost, carried_forward_at, successor_item_id
       ) VALUES ($1, $2, $3, NULL, FALSE, NULL, NULL)
       RETURNING id`,
      [newReceipt.id, keptItem.copy_id, keptItem.deposit_snapshot]
    );
    const newItem = insNewItemRes.rows[0];

    // 5. Cập nhật successor_item_id cho dòng sách cũ (KHÔNG fake returned_at!)
    await db.query(
      `UPDATE loan_items
       SET successor_item_id = $2
       WHERE id = $1`,
      [keptItem.id, newItem.id]
    );

    // 6. Xử lý phân bổ cọc & tiền cho PARTIAL
    const allocReturned = activeAllocations.find((a: any) => a.item_id === returnedItem.id);
    const allocKept = activeAllocations.find((a: any) => a.item_id === keptItem.id);

    // S09-04: Bắt buộc phải có đầy đủ phân bổ cọc cho từng cuốn
    if (!allocReturned || !allocKept) {
      throw new AllocationCoverageError(
        'Không tìm thấy bản ghi phân bổ cọc hợp lệ cho từng cuốn sách trong phiếu mượn (Allocation coverage missing).'
      );
    }

    if (fineEval.isForfeited) {
      // Trường hợp 3: P >= D (T73 ngoại lệ đã chốt)
      // Giữ toàn bộ D cũ làm phạt, không hoàn cọc cuốn trả, không chuyển cọc cũ.
      depositForfeitedBigInt = fineEval.forfeitAmount;

      for (const alloc of activeAllocations) {
        await db.query(
          `UPDATE deposit_allocations
           SET status = 'FORFEITED', remaining_amount = 0, updated_at = NOW()
           WHERE id = $1`,
          [alloc.id]
        );
      }

      if (totalDepositBigInt > 0n) {
        await recordJournalEntry(db, {
          entryCode: `JE-FORFEIT-${receipt.receipt_number}`,
          fundId: FUND_IDS.LOAN,
          sourceType: 'LOAN_FINE_FORFEIT',
          sourceId: receipt.id,
          debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
          creditAccount: ACCOUNT_CODES.FINE_REVENUE,
          amount: totalDepositBigInt,
          cashSessionId: activeSessionId,
          createdBy: actorId,
          notes: `Tịch thu toàn bộ cọc ${totalDepositBigInt.toString()}₫ làm phạt khi trả 1 phần phiếu ${receipt.receipt_number}`,
        });
      }

      // Cuốn giữ lại yêu cầu thu cọc mới D_new sau xác nhận tiền
      const newDepositAmount = BigInt(keptItem.deposit_snapshot);
      if (validated.newDepositConfirmed) {
        newDepositCollectedBigInt = newDepositAmount;
        const debitAccount = validated.newDepositPaymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;

        const newAllocRes = await db.query<any>(
          `INSERT INTO deposit_allocations (
             receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method
           ) VALUES ($1, $2, $3, $4, $5, 'HELD', $6)
           RETURNING id`,
          [
            newReceipt.id,
            newItem.id,
            FUND_IDS.LOAN,
            newDepositAmount.toString(),
            newDepositAmount.toString(),
            validated.newDepositPaymentMethod,
          ]
        );
        const newAllocId = newAllocRes.rows[0].id;

        await recordJournalEntry(db, {
          entryCode: `JE-DEP-${newReceipt.receipt_number}-1`,
          fundId: FUND_IDS.LOAN,
          sourceType: 'LOAN_DEPOSIT',
          sourceId: newAllocId,
          debitAccount,
          creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
          amount: newDepositAmount,
          cashSessionId: activeSessionId,
          createdBy: actorId,
          notes: `Thu cọc mới cho cuốn giữ lại phiếu ${newReceipt.receipt_number}`,
        });

        if (validated.newDepositPaymentMethod === 'CASH' && activeSessionId) {
          await db.query(
            `UPDATE cash_sessions
             SET expected_closing_cash = expected_closing_cash + $2
             WHERE id = $1`,
            [activeSessionId, newDepositAmount.toString()]
          );
        }
      } else {
        // Chưa nhận cọc mới: lưu allocation PENDING_COLLECTION, receipt PENDING_DEPOSIT
        newDepositCollectedBigInt = 0n;
        await db.query(
          `INSERT INTO deposit_allocations (
             receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method
           ) VALUES ($1, $2, $3, $4, 0, 'PENDING_COLLECTION', $5)`,
          [
            newReceipt.id,
            newItem.id,
            FUND_IDS.LOAN,
            newDepositAmount.toString(),
            validated.newDepositPaymentMethod,
          ]
        );
        await db.query(
          `UPDATE loan_receipts SET status = 'PENDING_DEPOSIT' WHERE id = $1`,
          [newReceipt.id]
        );
      }
    } else {
      // Trường hợp 1 (P = 0) hoặc 2 (0 < P < D):
      // Cọc cuốn trả: giải phóng thành refund_intents (PENDING)
      if (allocReturned) {
        const remainingReturned = BigInt(allocReturned.remaining_amount);
        depositRefundedBigInt = remainingReturned;

        if (remainingReturned > 0n) {
          const insIntent = await db.query<any>(
            `INSERT INTO refund_intents (
               allocation_id, amount, refund_method, status, requested_by
             ) VALUES ($1, $2, $3, 'PENDING', $4)
             RETURNING id, allocation_id, amount, refund_method, status`,
            [allocReturned.id, remainingReturned.toString(), refundMethod, actorId]
          );
          const intentRow = insIntent.rows[0];

          await db.query(
            `UPDATE deposit_allocations
             SET status = 'PENDING_REFUND', refund_method = $2, updated_at = NOW()
             WHERE id = $1`,
            [allocReturned.id, refundMethod]
          );

          refundIntents.push({
            id: intentRow.id,
            allocationId: allocReturned.id,
            amount: Number(remainingReturned),
            refundMethod,
            status: 'PENDING',
          });
        }
      }

      // Cọc cuốn giữ: Chuyển sang phiếu mới (CASH-NEUTRAL, status = 'TRANSFERRED')
      if (allocKept) {
        const remainingKept = BigInt(allocKept.remaining_amount);
        depositTransferredBigInt = remainingKept;

        await db.query(
          `UPDATE deposit_allocations
           SET status = 'TRANSFERRED', remaining_amount = 0, transferred_to_receipt_id = $2, updated_at = NOW()
           WHERE id = $1`,
          [allocKept.id, newReceipt.id]
        );

        await db.query(
          `INSERT INTO deposit_allocations (
             receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, transferred_from_allocation_id
           ) VALUES ($1, $2, $3, $4, $5, 'HELD', $6, $7)`,
          [
            newReceipt.id,
            newItem.id,
            FUND_IDS.LOAN,
            allocKept.original_amount.toString(),
            remainingKept.toString(),
            allocKept.payment_method,
            allocKept.id,
          ]
        );
      }

      // Nếu 0 < P < D: Thu phạt riêng biệt nếu có xác nhận
      if (fineEval.directFineCollectAmount > 0n) {
        if (validated.finePaymentConfirmed) {
          directFineCollectedBigInt = fineEval.directFineCollectAmount;
          const debitAccount = finePaymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;

          await recordJournalEntry(db, {
            entryCode: `JE-FINE-${receipt.receipt_number}`,
            fundId: FUND_IDS.LOAN,
            sourceType: 'LOAN_FINE',
            sourceId: settlementId,
            debitAccount,
            creditAccount: ACCOUNT_CODES.FINE_REVENUE,
            amount: directFineCollectedBigInt,
            cashSessionId: activeSessionId,
            createdBy: actorId,
            notes: `Thu phạt quá hạn phiếu ${receipt.receipt_number}: ${directFineCollectedBigInt.toString()}₫`,
          });

          if (validated.finePaymentMethod === 'CASH' && activeSessionId) {
            await db.query(
              `UPDATE cash_sessions
               SET expected_closing_cash = expected_closing_cash + $2
               WHERE id = $1`,
              [activeSessionId, directFineCollectedBigInt.toString()]
            );
          }
        } else {
          directFineCollectedBigInt = 0n;
        }
      }
    }

    // 7. Cập nhật phiếu mượn cũ sang PARTIAL_SETTLED
    await db.query(
      `UPDATE loan_receipts SET status = 'PARTIAL_SETTLED' WHERE id = $1`,
      [receipt.id]
    );
  }

  let fineStatus: 'COLLECTED' | 'PENDING' | 'WAIVED' = 'COLLECTED';
  let finePendingAmountBigInt = 0n;

  if (fineEval.fineFinal === 0n && suggestedFineBigInt > 0n) {
    fineStatus = 'WAIVED';
  } else if (fineEval.directFineCollectAmount > 0n) {
    if (directFineCollectedBigInt >= fineEval.directFineCollectAmount) {
      fineStatus = 'COLLECTED';
    } else {
      fineStatus = 'PENDING';
      finePendingAmountBigInt = fineEval.directFineCollectAmount - directFineCollectedBigInt;
    }
  }

  // 9. S08-05 & S12-06: Lưu quyết định quyết toán vào bảng loan_settlements (Settlement Read Model)
  await db.query(
    `INSERT INTO loan_settlements (
       id, receipt_id, settlement_type, return_date, overdue_days, fine_suggested, fine_final, fine_reason,
       fine_collected, fine_pending_amount, fine_status, fine_payment_method, total_deposit, deposit_refunded, deposit_forfeited,
       deposit_transferred, new_deposit_collected, successor_receipt_id, cash_session_id, settled_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      settlementId,
      receipt.id,
      validated.returnType,
      returnDate,
      overdueDays,
      suggestedFineBigInt.toString(),
      fineEval.fineFinal.toString(),
      fineEval.fineReason,
      directFineCollectedBigInt.toString(),
      finePendingAmountBigInt.toString(),
      fineStatus,
      validated.finePaymentMethod,
      totalDepositBigInt.toString(),
      depositRefundedBigInt.toString(),
      depositForfeitedBigInt.toString(),
      depositTransferredBigInt.toString(),
      newDepositCollectedBigInt.toString(),
      newReceipt ? newReceipt.id : null,
      activeSessionId,
      actorId,
    ]
  );

  // 10. Đối soát sổ cái nghĩa vụ cọc
  await assertLiabilityReconciliation(db);

  // 11. Ghi nhật ký kiểm toán hệ thống
  await recordAuditLog(db, {
    actorId,
    action: 'SETTLE_RETURN',
    targetResource: 'LOAN_RECEIPT',
    targetId: receipt.id,
    details: {
      receiptNumber: receipt.receipt_number,
      settlementType: validated.returnType,
      returnedItemsCount: itemsToReturn.length,
      overdueDays,
      suggestedFine: Number(suggestedFineBigInt),
      finalFine: Number(fineEval.fineFinal),
      fineReason: fineEval.fineReason,
      depositTotal: Number(totalDepositBigInt),
      depositRefunded: Number(depositRefundedBigInt),
      depositForfeited: Number(depositForfeitedBigInt),
      depositTransferred: Number(depositTransferredBigInt),
      newDepositCollected: Number(newDepositCollectedBigInt),
      directFineCollected: Number(directFineCollectedBigInt),
      finePending: Number(finePendingAmountBigInt),
      fineStatus,
      successorReceiptId: newReceipt ? newReceipt.id : null,
      refundIntentsCount: refundIntents.length,
      cashSessionId: activeSessionId,
    },
  });

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receipt_number,
    status: (validated.returnType === 'PARTIAL' ? 'PARTIAL_SETTLED' : 'RETURNED') as LoanReceiptStatus,
    returnDate,
    overdueDays,
    fineSuggested: Number(suggestedFineBigInt),
    fineFinal: Number(fineEval.fineFinal),
    fineReason: fineEval.fineReason,
    totalDeposit: Number(totalDepositBigInt),
    depositRefunded: Number(depositRefundedBigInt),
    depositForfeited: Number(depositForfeitedBigInt),
    directFineCollected: Number(directFineCollectedBigInt),
    finePending: Number(finePendingAmountBigInt),
    fineStatus,
    depositTransferred: Number(depositTransferredBigInt),
    newDepositCollected: Number(newDepositCollectedBigInt),
    newReceiptId: newReceipt?.id,
    newReceiptNumber: newReceipt?.receipt_number,
    successorReceiptId: newReceipt?.id,
    refundIntents,
    returnedItemsCount: itemsToReturn.length,
    message: validated.returnType === 'PARTIAL'
      ? 'Tất toán trả một phần và chuyển tiếp thành công.'
      : 'Tất toán trả toàn bộ sách thành công.',
  };
}

/**
 * Xác nhận hoàn trả tiền cọc cho bạn đọc (Chặng 08: Hoàn cọc thật & Ghi nhận ca chi thực)
 * Thứ tự khóa tài nguyên:
 *   1. cash_sessions (FOR UPDATE)
 *   2. refund_intents (FOR UPDATE)
 *   3. deposit_allocations (FOR UPDATE)
 */
export async function confirmRefund(
  db: Queryable,
  params: ConfirmRefundParams,
  actorId: string
): Promise<ConfirmRefundResult> {
  const { refundIntentId, paymentConfirmed } = params;
  if (!refundIntentId || typeof refundIntentId !== 'string' || refundIntentId.trim().length === 0) {
    throw new CirculationError('Mã ý định hoàn cọc (refundIntentId) không hợp lệ.', 'INVALID_INTENT_ID', 400);
  }
  if (paymentConfirmed !== true) {
    throw new CirculationError(
      'Bắt buộc xác nhận tiền thực đã được giao hoặc kiểm tra app ngân hàng trước khi xác nhận hoàn cọc (paymentConfirmed: true).',
      'PAYMENT_UNCONFIRMED',
      400
    );
  }

  // 1. Khóa và kiểm tra Phiên quầy tiền mặt đang mở (ca thực chi!)
  let activeSession: any;
  if (params.cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed, opening_cash, expected_closing_cash FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [params.cashSessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(`Không tìm thấy phiên quầy ID '${params.cashSessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
    if (sRes.rows[0].is_closed) {
      throw new ClosedSessionError('Phiên quầy chỉ định đã đóng, không thể xác nhận hoàn cọc.');
    }
    activeSession = sRes.rows[0];
  } else {
    const sRes = await db.query<any>(
      `SELECT id, is_closed, opening_cash, expected_closing_cash FROM cash_sessions WHERE is_closed = FALSE FOR UPDATE`
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new ClosedSessionError('Bàn trực chưa có phiên quầy tiền mặt đang mở. Bắt buộc mở ca trước khi xác nhận hoàn cọc.');
    }
    activeSession = sRes.rows[0];
  }

  // 2. Khóa và kiểm tra ý định hoàn cọc (refund_intents)
  const iRes = await db.query<any>(
    `SELECT id, allocation_id, amount, refund_method, status, requested_by, confirmed_by, confirmed_at, cash_session_id, journal_entry_id
     FROM refund_intents
     WHERE id = $1
     FOR UPDATE`,
    [refundIntentId]
  );
  if (!iRes.rows || iRes.rows.length === 0) {
    throw new CirculationError(`Không tìm thấy ý định hoàn cọc ID '${refundIntentId}'.`, 'REFUND_INTENT_NOT_FOUND', 404);
  }
  const intent = iRes.rows[0];
  if (intent.status === 'CONFIRMED') {
    throw new CirculationError('Ý định hoàn cọc này đã được xác nhận trước đó.', 'REFUND_ALREADY_CONFIRMED', 409);
  }
  if (intent.status === 'CANCELLED') {
    throw new CirculationError('Ý định hoàn cọc này đã bị hủy.', 'REFUND_INTENT_CANCELLED', 400);
  }

  // 3. Khóa và kiểm tra phân bổ cọc (deposit_allocations)
  const aRes = await db.query<any>(
    `SELECT id, receipt_id, item_id, fund_id, original_amount, remaining_amount, status, payment_method, refund_method
     FROM deposit_allocations
     WHERE id = $1
     FOR UPDATE`,
    [intent.allocation_id]
  );
  if (!aRes.rows || aRes.rows.length === 0) {
    throw new CirculationError('Không tìm thấy khoản phân bổ cọc liên kết.', 'ALLOCATION_NOT_FOUND', 404);
  }
  const allocation = aRes.rows[0];

  const refundAmountBigInt = BigInt(intent.amount);

  // 4. Nếu hoàn tiền mặt (CASH), kiểm tra hộp tiền có đủ tiền khả dụng không
  // S08-04: Nguồn số dư tiền mặt khả dụng duy nhất = opening_cash + cash_in - cash_out từ journal_entries
  if (intent.refund_method === 'CASH') {
    const sessionCash = BigInt(activeSession.expected_closing_cash);
    const cashInRes = await db.query<any>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM journal_entries
       WHERE cash_session_id = $1 AND fund_id = $2 AND debit_account = $3`,
      [activeSession.id, FUND_IDS.LOAN, ACCOUNT_CODES.CASH_DRAWER]
    );
    const cashIn = BigInt(cashInRes.rows[0]?.total || 0);

    const cashOutRes = await db.query<any>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM journal_entries
       WHERE cash_session_id = $1 AND fund_id = $2 AND credit_account = $3`,
      [activeSession.id, FUND_IDS.LOAN, ACCOUNT_CODES.CASH_DRAWER]
    );
    const cashOut = BigInt(cashOutRes.rows[0]?.total || 0);

    const openingCash = BigInt(activeSession.opening_cash);
    const journalCash = openingCash + cashIn - cashOut;

    // S08-04: Số dư khả dụng đảm bảo cả số dư thực tế ghi nhận của ca lẫn đối soát bút toán sổ cái
    const availableCash = sessionCash < journalCash ? sessionCash : journalCash;

    if (availableCash < refundAmountBigInt) {
      throw new CirculationError(
        `Phiên quầy hiện tại không đủ tiền mặt khả dụng (${availableCash.toString()}₫) để hoàn cọc (${refundAmountBigInt.toString()}₫). Vui lòng nạp thêm float hoặc giữ pending để chi sau.`,
        'INSUFFICIENT_CASH_DRAWER',
        400
      );
    }
  }

  // 5. Ghi bút toán sổ cái hoàn cọc (giảm nghĩa vụ cọc, giảm tài sản)
  // Nợ COC_PHAI_HOAN / Có TIEN_MAT_HOP hoặc TIEN_NGAN_HANG
  const creditAccount = intent.refund_method === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;
  const journalEntry = await recordJournalEntry(db, {
    entryCode: `JE-REFUND-${intent.id.substring(0, 8)}`,
    fundId: FUND_IDS.LOAN,
    sourceType: 'LOAN_DEPOSIT_REFUND',
    sourceId: intent.id,
    debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
    creditAccount,
    amount: refundAmountBigInt,
    cashSessionId: activeSession.id,
    createdBy: actorId,
    notes: `Hoàn cọc thực chi cho khoản phân bổ ${allocation.id}`,
  });

  const confirmedAt = new Date().toISOString();

  // 6. Cập nhật deposit_allocations
  const currentRemaining = BigInt(allocation.remaining_amount);
  const newRemaining = currentRemaining >= refundAmountBigInt ? currentRemaining - refundAmountBigInt : 0n;
  const newStatus = newRemaining === 0n ? 'REFUNDED' : allocation.status;

  await db.query(
    `UPDATE deposit_allocations
     SET status = $2, remaining_amount = $3, updated_at = NOW()
     WHERE id = $1`,
    [allocation.id, newStatus, newRemaining.toString()]
  );

  // 7. Cập nhật refund_intents sang CONFIRMED
  await db.query(
    `UPDATE refund_intents
     SET status = 'CONFIRMED', confirmed_by = $2, confirmed_at = $3,
         cash_session_id = $4, journal_entry_id = $5, updated_at = NOW()
     WHERE id = $1`,
    [intent.id, actorId, confirmedAt, activeSession.id, journalEntry.id]
  );

  // Nếu hoàn cọc bằng tiền mặt, cập nhật expected_closing_cash của phiên quầy
  if (intent.refund_method === 'CASH') {
    await db.query(
      `UPDATE cash_sessions
       SET expected_closing_cash = expected_closing_cash - $2
       WHERE id = $1`,
      [activeSession.id, refundAmountBigInt.toString()]
    );
  }

  // 8. Đối soát sổ cái nghĩa vụ cọc
  await assertLiabilityReconciliation(db);

  // 9. Ghi nhật ký kiểm toán hệ thống
  await recordAuditLog(db, {
    actorId,
    action: 'CONFIRM_REFUND',
    targetResource: 'REFUND_INTENT',
    targetId: intent.id,
    details: {
      allocationId: allocation.id,
      receiptId: allocation.receipt_id,
      amount: Number(refundAmountBigInt),
      refundMethod: intent.refund_method,
      cashSessionId: activeSession.id,
      journalEntryId: journalEntry.id,
    },
  });

  return {
    refundIntentId: intent.id,
    allocationId: allocation.id,
    amount: Number(refundAmountBigInt),
    refundMethod: intent.refund_method,
    status: 'CONFIRMED',
    confirmedBy: actorId,
    confirmedAt,
    cashSessionId: activeSession.id,
    journalEntryId: journalEntry.id,
    message: 'Xác nhận hoàn cọc thành công.',
  };
}

/**
 * Tra cứu chi tiết quyết toán mượn trả & hoàn cọc của phiếu (Nội bộ: Member/Admin)
 */
export async function getLoanSettlementDetail(
  db: Queryable,
  receiptId: string
): Promise<any> {
  const receipt = await getLoanReceiptById(db, receiptId);
  if (!receipt) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${receiptId}'.`);
  }

  // Lấy danh sách refund_intents liên kết
  const intentsRes = await db.query<any>(
    `SELECT ri.id, ri.allocation_id, ri.amount, ri.refund_method, ri.status,
            ri.cash_session_id, ri.confirmed_at, ri.confirmed_by
     FROM refund_intents ri
     JOIN deposit_allocations da ON da.id = ri.allocation_id
     WHERE da.receipt_id = $1
     ORDER BY ri.created_at ASC`,
    [receiptId]
  );
  const mappedIntents = (intentsRes.rows || []).map((row: any) => ({
    id: row.id,
    allocationId: row.allocation_id,
    amount: Number(row.amount),
    refundMethod: row.refund_method,
    status: row.status,
    cashSessionId: row.cash_session_id || null,
    confirmedAt: row.confirmed_at || null,
  }));

  // S08-05: Kiểm tra xem phiếu đã có bản ghi settlement chốt chưa
  const sRes = await db.query<any>(
    `SELECT id, settlement_type, return_date, overdue_days, fine_suggested, fine_final, fine_reason,
            fine_collected, fine_pending_amount, fine_status, fine_payment_method, total_deposit, deposit_refunded, deposit_forfeited,
            deposit_transferred, new_deposit_collected, successor_receipt_id, cash_session_id, settled_by, settled_at
     FROM loan_settlements
     WHERE receipt_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [receiptId]
  );

  if (sRes.rows && sRes.rows.length > 0) {
    const s = sRes.rows[0];
    return {
      receipt,
      settlementId: s.id,
      settlementType: s.settlement_type,
      returnDate: normalizeDateToVietnamYmd(s.return_date),
      overdueDays: Number(s.overdue_days),
      suggestedFine: Number(s.fine_suggested),
      fineSuggested: Number(s.fine_suggested),
      fineFinal: Number(s.fine_final),
      fineReason: s.fine_reason || null,
      fineCollected: Number(s.fine_collected),
      finePendingAmount: Number(s.fine_pending_amount || 0),
      fineStatus: s.fine_status || 'COLLECTED',
      finePaymentMethod: s.fine_payment_method || null,
      totalDeposit: Number(s.total_deposit),
      depositRefunded: Number(s.deposit_refunded),
      depositForfeited: Number(s.deposit_forfeited),
      depositTransferred: Number(s.deposit_transferred),
      newDepositCollected: Number(s.new_deposit_collected),
      successorReceiptId: s.successor_receipt_id || null,
      settledAt: s.settled_at,
      settledBy: s.settled_by,
      refundIntents: mappedIntents,
    };
  }

  // Nếu chưa tất toán: Tính toán gợi ý theo hạn mượn và ngày hôm nay
  const rawDueDate = normalizeDateToVietnamYmd(receipt.dueDate);
  const returnDate = getCurrentVietnamDate();
  const overdueDays = calculateOverdueDays(rawDueDate, returnDate);
  const suggestedFine = calculateSuggestedFine(overdueDays);

  return {
    receipt,
    overdueDays,
    suggestedFine: Number(suggestedFine),
    fineSuggested: Number(suggestedFine),
    fineFinal: null,
    refundIntents: mappedIntents,
  };
}

/**
 * Gia hạn phiếu mượn sách (Chặng 10: Renewal & Due Date Calendar)
 * Thứ tự khóa tài nguyên chống deadlock:
 *   1. cash_sessions (FOR UPDATE) nếu có thu tiền phạt bằng tiền mặt (CASH)
 *   2. loan_receipts (FOR UPDATE)
 *   3. deposit_allocations (FOR UPDATE)
 */
/**
 * Helper dùng chung để khóa và giải quyết phiên quầy cho giao dịch tài chính (S10-04)
 */
async function resolveAndLockSession(
  db: Queryable,
  paymentMethod: PaymentMethod,
  cashSessionId?: string,
  isPaymentRequired = true
): Promise<string | null> {
  if (!isPaymentRequired) {
    return null;
  }
  if (cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [cashSessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(`Không tìm thấy phiên quầy ID '${cashSessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
    if (sRes.rows[0].is_closed) {
      throw new ClosedSessionError('Phiên quầy chỉ định đã đóng, không thể ghi nhận giao dịch tài chính.');
    }
    return sRes.rows[0].id;
  }

  // Không chỉ định session cụ thể: Tìm phiên đang mở
  const sRes = await db.query<any>(
    `SELECT id, is_closed FROM cash_sessions WHERE is_closed = FALSE FOR UPDATE LIMIT 1`
  );
  if (sRes.rows && sRes.rows.length > 0) {
    return sRes.rows[0].id;
  }

  // Không có ca đang mở
  if (paymentMethod === 'CASH') {
    throw new ClosedSessionError('Bàn trực chưa có phiên quầy tiền mặt đang mở để ghi nhận thu tiền.');
  } else {
    // S10-04: Thu tiền BANK cũng phải thuộc phiên quầy/nguồn hợp lệ
    throw new ClosedSessionError('Bàn trực chưa có phiên quầy đang mở để ghi nhận giao dịch chuyển khoản.');
  }
}

/**
 * Gia hạn thời gian mượn sách (Chặng 10: Loan Renewal)
 * Tối đa 3 lần gia hạn trên mỗi phiếu mượn (renew_count <= 3).
 * Áp dụng quy tắc cộng dồn ngày gia hạn và xử lý phạt nếu quá hạn.
 */
export async function renewLoanReceipt(
  db: Queryable,
  params: RenewLoanParams,
  actorId: string
): Promise<RenewLoanResult> {
  const validated = validateRenewLoanInput(params);

  // S12-09: Tuân thủ thứ tự khóa chuẩn toàn hệ thống: Session -> Receipt -> Items -> Allocations -> Journal
  let activeSessionId: string | null = null;
  if (validated.cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [validated.cashSessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(`Không tìm thấy phiên quầy ID '${validated.cashSessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
    if (sRes.rows[0].is_closed) {
      throw new ClosedSessionError('Phiên quầy chỉ định đã đóng, không thể ghi nhận giao dịch tài chính.');
    }
    activeSessionId = sRes.rows[0].id;
  } else {
    const todayVietnam = getCurrentVietnamDate();
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE session_date = $1 AND is_closed = FALSE LIMIT 1 FOR UPDATE`,
      [todayVietnam]
    );
    if (sRes.rows && sRes.rows.length > 0) {
      activeSessionId = sRes.rows[0].id;
    }
  }

  // 1. Khóa và kiểm tra Phiếu mượn (loan_receipts)
  const rRes = await db.query<any>(
    `SELECT id, receipt_number, borrower_id, borrow_date, due_date, renew_count, status, preceding_receipt_id
     FROM loan_receipts
     WHERE id = $1
     FOR UPDATE`,
    [validated.receiptId]
  );
  if (!rRes.rows || rRes.rows.length === 0) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${validated.receiptId}'.`);
  }
  const receipt = rRes.rows[0];

  // Kiểm tra trạng thái phiếu
  if (receipt.status === 'RETURNED' || receipt.status === 'PARTIAL_SETTLED' || receipt.status === 'CANCELLED' || receipt.status === 'LOST') {
    throw new InvalidLoanStatusForRenewalError(
      `Phiếu mượn đã ở trạng thái kết thúc (${receipt.status}), không thể gia hạn.`
    );
  }
  if (receipt.status === 'PENDING_DEPOSIT') {
    throw new InvalidLoanStatusForRenewalError(
      'Phiếu mượn đang chờ nộp cọc bổ sung (PENDING_DEPOSIT), bắt buộc hoàn tất nộp cọc trước khi gia hạn.'
    );
  }
  if (receipt.status !== 'ACTIVE' && receipt.status !== 'OVERDUE') {
    throw new InvalidLoanStatusForRenewalError(
      `Không thể gia hạn phiếu mượn có trạng thái '${receipt.status}'.`
    );
  }

  // Kiểm tra giới hạn số lần gia hạn (tối đa 3 lần)
  const currentRenewCount = Number(receipt.renew_count || 0);
  if (currentRenewCount >= 3) {
    throw new MaxRenewalsExceededError(
      'Phiếu mượn đã đạt giới hạn gia hạn tối đa (3 lần). Bắt buộc trả sách tại quầy.'
    );
  }

  // Lấy danh sách ngày nghỉ / lễ từ calendar_holidays trước để tính effectiveDueDate
  const holidayRes = await db.query<any>(`SELECT holiday_date FROM calendar_holidays`);
  const holidays = (holidayRes.rows || []).map((h: any) => normalizeDateToVietnamYmd(h.holiday_date));

  // 2. Tính toán ngày gia hạn và kiểm tra quá hạn
  const todayVietnam = getCurrentVietnamDate();
  const currentDueDate = normalizeDateToVietnamYmd(receipt.due_date);

  // S10-03: Áp dụng lịch nghỉ vào currentDueDate trước khi tính overdue
  const { effectiveDueDate: effectiveCurrentDueDate } = getHolidayAdjustedDueDate(currentDueDate, holidays);
  const overdueDays = calculateOverdueDays(effectiveCurrentDueDate, todayVietnam);
  const isOverdue = overdueDays > 0;

  // Lấy allocations để kiểm tra tiền cọc (S10-06)
  const allocRes = await db.query<any>(
    `SELECT id, remaining_amount, status FROM deposit_allocations WHERE receipt_id = $1`,
    [receipt.id]
  );
  const totalDepositBigInt = (allocRes.rows || [])
    .filter((a: any) => a.status === 'HELD' || a.status === 'PENDING_REFUND')
    .reduce((sum: bigint, a: any) => sum + BigInt(a.remaining_amount), 0n);

  // Quy tắc tính hạn mới:
  // - Trong hạn: cộng 14 ngày từ effectiveCurrentDueDate (không tính từ ngày gửi sớm)
  // - Quá hạn: cộng 14 ngày từ todayVietnam
  const baseDate = isOverdue ? todayVietnam : effectiveCurrentDueDate;
  const calendarRes = calculateEffectiveDueDate(baseDate, 14, holidays);
  const originalNewDueDate = calendarRes.originalDueDate;
  const newDueDate = calendarRes.effectiveDueDate;
  const adjustmentReason = calendarRes.adjustmentReason || null;
  const renewalId = crypto.randomUUID();

  // 3. Đánh giá phạt nếu quá hạn
  let suggestedFineBigInt = 0n;
  let fineFinalBigInt = 0n;
  let fineReason: string | null = null;
  let fineCollectedBigInt = 0n;
  let finePendingAmountBigInt = 0n;
  let fineStatus: 'COLLECTED' | 'PENDING' | 'WAIVED' = 'COLLECTED';

  if (isOverdue) {
    suggestedFineBigInt = calculateSuggestedFine(overdueDays);
    fineFinalBigInt = validated.fineAmount !== undefined ? validated.fineAmount : suggestedFineBigInt;
    fineReason = validated.fineReason || null;

    if (fineFinalBigInt !== suggestedFineBigInt) {
      if (!fineReason || fineReason.length === 0) {
        throw new FineReasonRequiredError('Bắt buộc cung cấp lý do điều chỉnh khi mức phạt khác mức phạt gợi ý.');
      }
    }

    // S10-06 & S11-08: Chặn phạt vượt hoặc bằng cọc P >= D khi tiếp tục giữ sách chưa chốt policy
    if (fineFinalBigInt >= totalDepositBigInt) {
      throw new CirculationError(
        `Mức phạt gia hạn (${fineFinalBigInt.toString()}₫) không được bằng hoặc vượt quá số tiền cọc hiện có (${totalDepositBigInt.toString()}₫). Nhánh phạt bằng hoặc vượt cọc khi tiếp tục giữ sách chưa có policy được phê duyệt.`,
        'FINE_EXCEEDS_DEPOSIT_CAP',
        400
      );
    }

    if (fineFinalBigInt === 0n && suggestedFineBigInt > 0n) {
      fineStatus = 'WAIVED';
    } else if (fineFinalBigInt > 0n) {
      // S10-06: Không tự mở nhánh gia hạn nợ phạt (pending fine) khi chưa chốt policy
      if (!validated.finePaymentConfirmed) {
        throw new CirculationError(
          'Gia hạn khi chưa thanh toán tiền phạt (pending fine) hiện chưa được phê duyệt policy.',
          'RENEWAL_PENDING_FINE_NOT_ALLOWED',
          400
        );
      }

      // S12-09: Phiên quầy đã được khóa an toàn ở đầu transaction theo lock hierarchy
      if (validated.finePaymentMethod === 'CASH' && !activeSessionId) {
        throw new CirculationError(
          'Bàn trực chưa có phiên quầy tiền mặt đang mở để thu tiền phạt gia hạn.',
          'NO_ACTIVE_CASH_SESSION',
          400
        );
      }

      fineCollectedBigInt = fineFinalBigInt;
      fineStatus = 'COLLECTED';
      const debitAccount = validated.finePaymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;

      const rcpShort = (receipt.receipt_number || receipt.id).replace(/^RCP-/i, '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);
      const entryCode = `JE-RN-${rcpShort}-${currentRenewCount + 1}`;

      await recordJournalEntry(db, {
        entryCode,
        fundId: FUND_IDS.LOAN,
        sourceType: 'LOAN_FINE',
        sourceId: renewalId,
        debitAccount,
        creditAccount: ACCOUNT_CODES.FINE_REVENUE,
        amount: fineCollectedBigInt,
        cashSessionId: activeSessionId,
        createdBy: actorId,
        notes: `Thu phạt quá hạn khi gia hạn lần ${currentRenewCount + 1} phiếu ${receipt.receipt_number}: ${fineCollectedBigInt.toString()}₫`,
      });

      if (validated.finePaymentMethod === 'CASH' && activeSessionId) {
        await db.query(
          `UPDATE cash_sessions
           SET expected_closing_cash = expected_closing_cash + $2
           WHERE id = $1`,
          [activeSessionId, fineCollectedBigInt.toString()]
        );
      }
    }
  }

  const newRenewCount = currentRenewCount + 1;
  const renewalSequence = newRenewCount;

  // 4. S10-01: Cập nhật loan_receipts (không có cột updated_at)
  await db.query(
    `UPDATE loan_receipts
     SET due_date = $2, renew_count = $3, status = 'ACTIVE'
     WHERE id = $1`,
    [receipt.id, newDueDate, newRenewCount]
  );

  // 5. S12-06: Ghi nhận vào bảng loan_renewals với explicit UUID
  const renewedAt = new Date().toISOString();
  await db.query(
    `INSERT INTO loan_renewals (
       id, receipt_id, renewal_sequence, renewed_at, renewed_by, previous_due_date, new_due_date,
       original_new_due_date, adjustment_reason, is_overdue, overdue_days, fine_suggested,
       fine_final, fine_reason, fine_collected, fine_pending_amount, fine_status, fine_payment_method,
       cash_session_id, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      renewalId,
      receipt.id,
      renewalSequence,
      renewedAt,
      actorId,
      currentDueDate,
      newDueDate,
      originalNewDueDate,
      adjustmentReason,
      isOverdue,
      overdueDays,
      suggestedFineBigInt.toString(),
      fineFinalBigInt.toString(),
      fineReason,
      fineCollectedBigInt.toString(),
      finePendingAmountBigInt.toString(),
      fineStatus,
      isOverdue ? validated.finePaymentMethod : null,
      activeSessionId,
      validated.notes || null,
    ]
  );

  // 7. Ghi nhật ký kiểm toán hệ thống
  await recordAuditLog(db, {
    actorId,
    action: 'RENEW_LOAN',
    targetResource: 'LOAN_RECEIPT',
    targetId: receipt.id,
    details: {
      receiptNumber: receipt.receipt_number,
      renewalSequence,
      previousDueDate: currentDueDate,
      newDueDate,
      originalNewDueDate,
      adjustmentReason,
      isOverdue,
      overdueDays,
      fineSuggested: Number(suggestedFineBigInt),
      fineFinal: Number(fineFinalBigInt),
      fineStatus,
      fineCollected: Number(fineCollectedBigInt),
      finePending: Number(finePendingAmountBigInt),
      renewCount: newRenewCount,
      cashSessionId: activeSessionId,
    },
  });

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receipt_number,
    renewalSequence,
    previousDueDate: currentDueDate,
    newDueDate,
    originalNewDueDate,
    adjustmentReason: adjustmentReason || undefined,
    renewCount: newRenewCount,
    isOverdue,
    overdueDays,
    fineSuggested: Number(suggestedFineBigInt),
    fineFinal: Number(fineFinalBigInt),
    fineCollected: fineCollectedBigInt > 0n,
    finePending: finePendingAmountBigInt > 0n,
    fineStatus,
    renewedAt,
    renewedBy: actorId,
    message: `Gia hạn phiếu mượn thành công (lần ${newRenewCount}/3). Hạn trả mới: ${newDueDate}.`,
  };
}

/**
 * Lấy danh sách lịch sử gia hạn của phiếu mượn
 */
export async function getLoanRenewals(
  db: Queryable,
  receiptId: string
): Promise<LoanRenewalDto[]> {
  const receipt = await getLoanReceiptById(db, receiptId);
  if (!receipt) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${receiptId}'.`);
  }

  const res = await db.query<any>(
    `SELECT id, receipt_id, renewal_sequence, renewed_at, renewed_by, previous_due_date,
            new_due_date, original_new_due_date, adjustment_reason, is_overdue, overdue_days,
            fine_suggested, fine_final, fine_reason, fine_collected, fine_pending_amount,
            fine_status, fine_payment_method, cash_session_id, notes
     FROM loan_renewals
     WHERE receipt_id = $1
     ORDER BY renewal_sequence ASC`,
    [receiptId]
  );

  return (res.rows || []).map((r: any) => ({
    id: r.id,
    receiptId: r.receipt_id,
    renewalSequence: Number(r.renewal_sequence),
    renewedAt: r.renewed_at,
    renewedBy: r.renewed_by,
    previousDueDate: normalizeDateToVietnamYmd(r.previous_due_date),
    newDueDate: normalizeDateToVietnamYmd(r.new_due_date),
    originalNewDueDate: normalizeDateToVietnamYmd(r.original_new_due_date),
    adjustmentReason: r.adjustment_reason || null,
    isOverdue: Boolean(r.is_overdue),
    overdueDays: Number(r.overdue_days),
    fineSuggested: Number(r.fine_suggested),
    fineFinal: Number(r.fine_final),
    fineReason: r.fine_reason || null,
    fineCollected: Number(r.fine_collected),
    finePendingAmount: Number(r.fine_pending_amount || 0),
    fineStatus: r.fine_status || 'COLLECTED',
    finePaymentMethod: r.fine_payment_method || null,
    cashSessionId: r.cash_session_id || null,
    notes: r.notes || null,
  }));
}

/**
 * Xác nhận thu cọc mới cho phiếu chuyển tiếp (T73 Finalize)
 */
export async function confirmNewDeposit(
  db: Queryable,
  params: ConfirmNewDepositParams,
  actorId: string
): Promise<ConfirmNewDepositResult> {
  const validated = validateConfirmNewDepositInput(params);

  // 1. Khóa và resolve phiên quầy cho cả CASH và BANK (S10-04)
  const activeSessionId = await resolveAndLockSession(
    db,
    validated.paymentMethod,
    validated.cashSessionId,
    true
  );

  // 2. Khóa loan_receipts
  const rRes = await db.query<any>(
    `SELECT id, receipt_number, borrower_id, status FROM loan_receipts WHERE id = $1 FOR UPDATE`,
    [validated.receiptId]
  );
  if (!rRes.rows || rRes.rows.length === 0) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${validated.receiptId}'.`);
  }
  const receipt = rRes.rows[0];
  if (receipt.status !== 'PENDING_DEPOSIT') {
    throw new CirculationError(
      `Phiếu mượn '${receipt.receipt_number}' không ở trạng thái chờ nộp cọc (status: ${receipt.status}).`,
      'INVALID_LOAN_STATUS',
      409
    );
  }

  // 3. Khóa các deposit_allocations ở trạng thái PENDING_COLLECTION
  const aRes = await db.query<any>(
    `SELECT id, receipt_id, original_amount, remaining_amount, status
     FROM deposit_allocations
     WHERE receipt_id = $1 AND status = 'PENDING_COLLECTION'
     FOR UPDATE`,
    [receipt.id]
  );
  if (!aRes.rows || aRes.rows.length === 0) {
    throw new CirculationError(
      'Không tìm thấy khoản phân bổ cọc nào đang chờ thu cho phiếu mượn này.',
      'NO_PENDING_ALLOCATIONS',
      404
    );
  }

  let totalCollected = 0n;
  let lastJournalId = '';
  for (const alloc of aRes.rows) {
    const amount = BigInt(alloc.original_amount);
    totalCollected += amount;

    await db.query(
      `UPDATE deposit_allocations
       SET status = 'HELD', remaining_amount = original_amount, payment_method = $2, updated_at = NOW()
       WHERE id = $1`,
      [alloc.id, validated.paymentMethod]
    );

    const debitAccount = validated.paymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;
    const je = await recordJournalEntry(db, {
      entryCode: `JE-DEP-${receipt.receipt_number}-CONFIRM`,
      fundId: FUND_IDS.LOAN,
      sourceType: 'LOAN_DEPOSIT',
      sourceId: alloc.id,
      debitAccount,
      creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      amount,
      cashSessionId: activeSessionId,
      createdBy: actorId,
      notes: `Xác nhận thu cọc mới phiếu ${receipt.receipt_number}: ${amount.toString()}₫`,
    });
    lastJournalId = je.id;
  }

  if (validated.paymentMethod === 'CASH' && activeSessionId) {
    await db.query(
      `UPDATE cash_sessions
       SET expected_closing_cash = expected_closing_cash + $2
       WHERE id = $1`,
      [activeSessionId, totalCollected.toString()]
    );
  }

  // 4. S10-01: Cập nhật phiếu mượn sang ACTIVE (không có cột updated_at)
  await db.query(
    `UPDATE loan_receipts SET status = 'ACTIVE' WHERE id = $1`,
    [receipt.id]
  );

  // 5. Đối soát sổ cái nghĩa vụ cọc
  await assertLiabilityReconciliation(db);

  // 6. Audit log
  await recordAuditLog(db, {
    actorId,
    action: 'CONFIRM_NEW_DEPOSIT',
    targetResource: 'LOAN_RECEIPT',
    targetId: receipt.id,
    details: {
      receiptNumber: receipt.receipt_number,
      depositAmount: Number(totalCollected),
      paymentMethod: validated.paymentMethod,
      cashSessionId: activeSessionId,
    },
  });

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receipt_number,
    status: 'ACTIVE',
    depositAmount: Number(totalCollected),
    paymentMethod: validated.paymentMethod,
    cashSessionId: activeSessionId,
    journalEntryId: lastJournalId,
    message: 'Xác nhận nộp cọc mới thành công. Phiếu mượn đã chuyển sang trạng thái hoạt động (ACTIVE).',
  };
}

/**
 * Thu tiền phạt chờ thu phát sinh từ quyết toán trả sách hoặc gia hạn trễ hạn
 */
export async function collectPendingFine(
  db: Queryable,
  params: CollectPendingFineParams,
  actorId: string
): Promise<CollectPendingFineResult> {
  const validated = validateCollectPendingFineInput(params);

  // 1. S10-04: Khóa và resolve session cho cả CASH và BANK
  const activeSessionId = await resolveAndLockSession(
    db,
    validated.paymentMethod,
    validated.cashSessionId,
    true
  );

  // 2. Kiểm tra phiếu mượn
  const rRes = await db.query<any>(
    `SELECT id, receipt_number FROM loan_receipts WHERE id = $1`,
    [validated.receiptId]
  );
  if (!rRes.rows || rRes.rows.length === 0) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${validated.receiptId}'.`);
  }
  const receipt = rRes.rows[0];

  // 3. S10-02: Tìm khoản phạt pending: nếu có targetId thì tìm theo targetId, nếu không thì tìm trong settlements rồi renewals
  let targetId = '';
  let fineToCollect = 0n;
  let newPending = 0n;
  let newStatus: 'COLLECTED' | 'PENDING' = 'COLLECTED';
  let newCollected = 0n;

  if (validated.targetId) {
    const sCheck = await db.query<any>(
      `SELECT id, fine_pending_amount, fine_collected
       FROM loan_settlements
       WHERE id = $1 AND receipt_id = $2 FOR UPDATE`,
      [validated.targetId, receipt.id]
    );
    if (sCheck.rows && sCheck.rows.length > 0) {
      const s = sCheck.rows[0];
      targetId = s.id;
      const pendingAmount = BigInt(s.fine_pending_amount);
      if (pendingAmount === 0n) {
        throw new CirculationError('Khoản phạt chỉ định đã được thu hết (fine_pending_amount = 0).', 'FINE_ALREADY_COLLECTED', 400);
      }
      fineToCollect = validated.amount !== undefined ? validated.amount : pendingAmount;
      if (fineToCollect > pendingAmount) {
        throw new CirculationError(
          `Số tiền phạt thu (${fineToCollect.toString()}₫) vượt quá số phạt chờ thu (${pendingAmount.toString()}₫).`,
          'AMOUNT_EXCEEDS_PENDING',
          400
        );
      }
      newCollected = BigInt(s.fine_collected) + fineToCollect;
      newPending = pendingAmount - fineToCollect;
      newStatus = newPending === 0n ? 'COLLECTED' : 'PENDING';
      await db.query(
        `UPDATE loan_settlements SET fine_collected = $2, fine_pending_amount = $3, fine_status = $4 WHERE id = $1`,
        [s.id, newCollected.toString(), newPending.toString(), newStatus]
      );
    } else {
      const rCheck = await db.query<any>(
        `SELECT id, fine_pending_amount, fine_collected
         FROM loan_renewals
         WHERE id = $1 AND receipt_id = $2 FOR UPDATE`,
        [validated.targetId, receipt.id]
      );
      if (!rCheck.rows || rCheck.rows.length === 0) {
        throw new CirculationError(`Không tìm thấy khoản phạt ID '${validated.targetId}' trên phiếu mượn này.`, 'TARGET_FINE_NOT_FOUND', 404);
      }
      const rnw = rCheck.rows[0];
      targetId = rnw.id;
      const pendingAmount = BigInt(rnw.fine_pending_amount);
      if (pendingAmount === 0n) {
        throw new CirculationError('Khoản phạt chỉ định đã được thu hết (fine_pending_amount = 0).', 'FINE_ALREADY_COLLECTED', 400);
      }
      fineToCollect = validated.amount !== undefined ? validated.amount : pendingAmount;
      if (fineToCollect > pendingAmount) {
        throw new CirculationError(
          `Số tiền phạt thu (${fineToCollect.toString()}₫) vượt quá số phạt chờ thu (${pendingAmount.toString()}₫).`,
          'AMOUNT_EXCEEDS_PENDING',
          400
        );
      }
      newCollected = BigInt(rnw.fine_collected) + fineToCollect;
      newPending = pendingAmount - fineToCollect;
      newStatus = newPending === 0n ? 'COLLECTED' : 'PENDING';
      await db.query(
        `UPDATE loan_renewals SET fine_collected = $2, fine_pending_amount = $3, fine_status = $4 WHERE id = $1`,
        [rnw.id, newCollected.toString(), newPending.toString(), newStatus]
      );
    }
  } else {
    // Tìm PENDING mới nhất trong loan_settlements
    const sRes = await db.query<any>(
      `SELECT id, fine_pending_amount, fine_collected
       FROM loan_settlements
       WHERE receipt_id = $1 AND fine_status = 'PENDING'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [receipt.id]
    );

    if (sRes.rows && sRes.rows.length > 0) {
      const s = sRes.rows[0];
      targetId = s.id;
      const pendingAmount = BigInt(s.fine_pending_amount);
      fineToCollect = validated.amount !== undefined ? validated.amount : pendingAmount;

      if (fineToCollect > pendingAmount) {
        throw new CirculationError(
          `Số tiền phạt thu (${fineToCollect.toString()}₫) vượt quá số phạt chờ thu (${pendingAmount.toString()}₫).`,
          'AMOUNT_EXCEEDS_PENDING',
          400
        );
      }

      newCollected = BigInt(s.fine_collected) + fineToCollect;
      newPending = pendingAmount - fineToCollect;
      newStatus = newPending === 0n ? 'COLLECTED' : 'PENDING';

      await db.query(
        `UPDATE loan_settlements
         SET fine_collected = $2, fine_pending_amount = $3, fine_status = $4
         WHERE id = $1`,
        [s.id, newCollected.toString(), newPending.toString(), newStatus]
      );
    } else {
      // Tìm trong loan_renewals
      const rnwRes = await db.query<any>(
        `SELECT id, fine_pending_amount, fine_collected
         FROM loan_renewals
         WHERE receipt_id = $1 AND fine_status = 'PENDING'
         ORDER BY renewal_sequence DESC
         LIMIT 1
         FOR UPDATE`,
        [receipt.id]
      );

      if (!rnwRes.rows || rnwRes.rows.length === 0) {
        throw new CirculationError(
          'Không tìm thấy khoản phạt nào đang chờ thu cho phiếu mượn này.',
          'NO_PENDING_FINE_FOUND',
          404
        );
      }

      const rnw = rnwRes.rows[0];
      targetId = rnw.id;
      const pendingAmount = BigInt(rnw.fine_pending_amount);
      fineToCollect = validated.amount !== undefined ? validated.amount : pendingAmount;

      if (fineToCollect > pendingAmount) {
        throw new CirculationError(
          `Số tiền phạt thu (${fineToCollect.toString()}₫) vượt quá số phạt chờ thu (${pendingAmount.toString()}₫).`,
          'AMOUNT_EXCEEDS_PENDING',
          400
        );
      }

      newCollected = BigInt(rnw.fine_collected) + fineToCollect;
      newPending = pendingAmount - fineToCollect;
      newStatus = newPending === 0n ? 'COLLECTED' : 'PENDING';

      await db.query(
        `UPDATE loan_renewals
         SET fine_collected = $2, fine_pending_amount = $3, fine_status = $4
         WHERE id = $1`,
        [rnw.id, newCollected.toString(), newPending.toString(), newStatus]
      );
    }
  }

  // S10-02: Phân biệt entryCode cho từng đợt thu bằng sequence
  const prevEntries = await db.query<any>(
    `SELECT COUNT(*) as cnt FROM journal_entries WHERE source_id = $1`,
    [targetId]
  );
  const seq = Number(prevEntries.rows[0]?.cnt || 0) + 1;
  const rcpShort = (receipt.receipt_number || receipt.id).replace(/^RCP-/i, '').replace(/[^a-zA-Z0-9]/g, '').slice(-8);
  const targetShort = targetId.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
  const entryCode = `JE-FN-${rcpShort}-${targetShort}-COLLECT-${seq}`;

  const debitAccount = validated.paymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;
  const je = await recordJournalEntry(db, {
    entryCode,
    fundId: FUND_IDS.LOAN,
    sourceType: 'LOAN_FINE',
    sourceId: targetId,
    debitAccount,
    creditAccount: ACCOUNT_CODES.FINE_REVENUE,
    amount: fineToCollect,
    cashSessionId: activeSessionId,
    createdBy: actorId,
    notes: `Thu phạt chờ thu đợt ${seq} cho phiếu ${receipt.receipt_number}: ${fineToCollect.toString()}₫`,
  });

  if (validated.paymentMethod === 'CASH' && activeSessionId) {
    await db.query(
      `UPDATE cash_sessions
       SET expected_closing_cash = expected_closing_cash + $2
       WHERE id = $1`,
      [activeSessionId, fineToCollect.toString()]
    );
  }

  // 4. Audit log
  await recordAuditLog(db, {
    actorId,
    action: 'COLLECT_PENDING_FINE',
    targetResource: 'LOAN_RECEIPT',
    targetId: receipt.id,
    details: {
      receiptNumber: receipt.receipt_number,
      targetId,
      fineCollected: Number(fineToCollect),
      finePendingAmount: Number(newPending),
      paymentMethod: validated.paymentMethod,
      cashSessionId: activeSessionId,
      journalEntryId: je.id,
    },
  });

  return {
    receiptId: receipt.id,
    settlementId: targetId,
    fineCollected: Number(fineToCollect),
    finePendingAmount: Number(newPending),
    paymentMethod: validated.paymentMethod,
    fineStatus: newStatus,
    cashSessionId: activeSessionId,
    journalEntryId: je.id,
    message: newPending === 0n ? 'Thu hết tiền phạt chờ thu thành công.' : `Thu phạt một đợt thành công. Còn lại ${Number(newPending)}₫.`,
  };
}

/**
 * Danh sách các ngày nghỉ lễ / lịch đóng cửa CLB
 */
export async function listCalendarHolidays(
  db: Queryable
): Promise<Array<{ holidayDate: string; name: string; description: string | null; createdAt: string }>> {
  const res = await db.query<any>(
    `SELECT holiday_date, name, description, created_at FROM calendar_holidays ORDER BY holiday_date ASC`
  );
  return (res.rows || []).map((row: any) => ({
    holidayDate: normalizeDateToVietnamYmd(row.holiday_date),
    name: row.name,
    description: row.description || null,
    createdAt: row.created_at,
  }));
}

/**
 * Thêm hoặc cập nhật ngày nghỉ lễ CLB (Member/Admin)
 * S10-03: Áp dụng lịch nghỉ mới cho các phiếu đang mượn (ACTIVE/OVERDUE), không phạt vào ngày CLB nghỉ.
 */
export async function addCalendarHoliday(
  db: Queryable,
  params: { holidayDate: string; name: string; description?: string },
  actorId: string
): Promise<{ holidayDate: string; name: string; description: string | null; shiftedLoansCount?: number }> {
  if (!params || typeof params !== 'object') {
    throw new CirculationError('Dữ liệu ngày nghỉ không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }
  const dateStr = normalizeDateToVietnamYmd(params.holidayDate);
  const name = params.name ? String(params.name).trim() : '';
  if (!name || name.length === 0) {
    throw new CirculationError('Tên ngày nghỉ không được để trống.', 'MISSING_HOLIDAY_NAME', 400);
  }
  const desc = params.description ? String(params.description).trim() : null;

  await db.query(
    `INSERT INTO calendar_holidays (holiday_date, name, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (holiday_date) DO UPDATE SET name = $2, description = $3`,
    [dateStr, name, desc]
  );

  await recordAuditLog(db, {
    actorId,
    action: 'ADD_CALENDAR_HOLIDAY',
    targetResource: 'CALENDAR_HOLIDAY',
    targetId: dateStr,
    details: { holidayDate: dateStr, name, description: desc },
  });

  // S10-03: Áp dụng lịch nghỉ mới cho các phiếu đang mượn (ACTIVE hoặc OVERDUE)
  const holidayRes = await db.query<any>(`SELECT holiday_date FROM calendar_holidays`);
  const holidays = (holidayRes.rows || []).map((h: any) => normalizeDateToVietnamYmd(h.holiday_date));

  const activeLoansRes = await db.query<any>(
    `SELECT id, receipt_number, borrow_date, due_date, renew_count, status
     FROM loan_receipts
     WHERE status IN ('ACTIVE', 'OVERDUE')
     FOR UPDATE`
  );

  let shiftedLoansCount = 0;
  for (const loan of activeLoansRes.rows || []) {
    const rawDue = normalizeDateToVietnamYmd(loan.due_date);
    // Tính hạn hiệu lực bắt đầu từ hạn hiện tại qua danh sách holidays
    const { effectiveDueDate, isHolidayAdjusted, adjustmentReason } = getHolidayAdjustedDueDate(rawDue, holidays);
    if (isHolidayAdjusted && effectiveDueDate !== rawDue) {
      await db.query(
        `UPDATE loan_receipts SET due_date = $2 WHERE id = $1`,
        [loan.id, effectiveDueDate]
      );
      await recordAuditLog(db, {
        actorId,
        action: 'SHIFT_LOAN_DUE_DATE',
        targetResource: 'LOAN_RECEIPT',
        targetId: loan.id,
        details: {
          receiptNumber: loan.receipt_number,
          oldDueDate: rawDue,
          newDueDate: effectiveDueDate,
          holidayDate: dateStr,
          reason: adjustmentReason,
        },
      });
      shiftedLoansCount++;
    }
  }

  return { holidayDate: dateStr, name, description: desc, shiftedLoansCount };
}

/**
 * Báo mất sách và tịch thu cọc (Chặng 11: Lost Book)
 * Quy tắc: Sách giá bao nhiêu thì cọc bao nhiêu chỉ giữ đúng cọc bấy nhiêu (ví dụ sách 74k cọc 50k chỉ giữ 50k, zero cash delta).
 */
export async function reportBookLoss(
  db: Queryable,
  params: ReportBookLossParams,
  actorId: string
): Promise<ReportBookLossResult> {
  const validated = validateReportBookLossInput(params);

  // S11-07: Thứ tự khóa chuẩn toàn hệ thống: Session -> Receipt -> Items -> Allocations
  if (validated.cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1 FOR UPDATE`,
      [validated.cashSessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0) {
      throw new CirculationError(`Không tìm thấy phiên quầy ID '${validated.cashSessionId}'.`, 'SESSION_NOT_FOUND', 404);
    }
  }

  // 1. Khóa và kiểm tra Phiếu mượn (loan_receipts)
  const rRes = await db.query<any>(
    `SELECT id, receipt_number, borrower_id, borrow_date, due_date, status
     FROM loan_receipts
     WHERE id = $1
     FOR UPDATE`,
    [validated.receiptId]
  );
  if (!rRes.rows || rRes.rows.length === 0) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${validated.receiptId}'.`);
  }
  const receipt = rRes.rows[0];

  if (receipt.status === 'RETURNED' || receipt.status === 'LOST' || receipt.status === 'CANCELLED') {
    throw new CirculationError(
      `Phiếu mượn đã ở trạng thái kết thúc (${receipt.status}), không thể báo mất sách.`,
      'RECEIPT_ALREADY_TERMINAL',
      409
    );
  }

  // 2. Khóa và lấy danh sách dòng sách (loan_items) của phiếu
  const itemsRes = await db.query<any>(
    `SELECT li.id, li.copy_id, li.deposit_snapshot, li.returned_at, li.is_lost, li.carried_forward_at,
            bc.barcode, bc.status as copy_status, bc.cover_price
     FROM loan_items li
     JOIN book_copies bc ON bc.id = li.copy_id
     WHERE li.receipt_id = $1
     FOR UPDATE`,
    [receipt.id]
  );
  const allItems = itemsRes.rows || [];
  if (allItems.length === 0) {
    throw new CirculationError('Phiếu mượn không có sách nào.', 'EMPTY_LOAN_RECEIPT', 400);
  }

  // S11-06: Xác thực danh sách selector - mọi selector yêu cầu phải thuộc đúng phiếu mượn
  if (validated.copyIds) {
    const validCopyIds = new Set(allItems.map((it: any) => it.copy_id));
    for (const cid of validated.copyIds) {
      if (!validCopyIds.has(cid)) {
        throw new CirculationError(`Bản sách ID '${cid}' không thuộc phiếu mượn này.`, 'UNKNOWN_COPY_SELECTOR', 400);
      }
    }
  }
  if (validated.barcodes) {
    const validBarcodes = new Set(allItems.map((it: any) => it.barcode));
    for (const b of validated.barcodes) {
      if (!validBarcodes.has(b)) {
        throw new CirculationError(`Mã vạch '${b}' không thuộc phiếu mượn này.`, 'UNKNOWN_COPY_SELECTOR', 400);
      }
    }
  }

  // 3. Xác định các cuốn sách cần báo mất
  const itemsToLose: any[] = [];
  for (const item of allItems) {
    const matchById = validated.copyIds && validated.copyIds.includes(item.copy_id);
    const matchByBarcode = validated.barcodes && validated.barcodes.includes(item.barcode);
    if (matchById || matchByBarcode) {
      if (item.returned_at !== null) {
        throw new CirculationError(
          `Bản sách '${item.barcode}' đã được trả vào lúc ${item.returned_at}, không thể báo mất.`,
          'COPY_ALREADY_RETURNED',
          409
        );
      }
      if (item.is_lost) {
        throw new CirculationError(
          `Bản sách '${item.barcode}' đã được báo mất trước đó.`,
          'COPY_ALREADY_LOST',
          409
        );
      }
      if (item.carried_forward_at !== null) {
        throw new CirculationError(
          `Bản sách '${item.barcode}' đã được chuyển tiếp sang phiếu khác, không thể báo mất trên phiếu cũ.`,
          'COPY_ALREADY_CARRIED_FORWARD',
          409
        );
      }
      itemsToLose.push(item);
    }
  }

  if (itemsToLose.length === 0) {
    throw new CirculationError(
      'Không tìm thấy bản sách nào cần báo mất hợp lệ trên phiếu mượn này.',
      'NO_ELIGIBLE_COPIES_TO_LOSE',
      400
    );
  }

  // 4. S11-04: Khóa và phân bổ đúng cọc của các cuốn báo mất
  const lostCopyIds = itemsToLose.map((it) => it.copy_id);
  const lostItemIds = itemsToLose.map((it) => it.id);
  const allocRes = await db.query<any>(
    `SELECT id, item_id, original_amount, remaining_amount, status
     FROM deposit_allocations
     WHERE receipt_id = $1
     FOR UPDATE`,
    [receipt.id]
  );
  const allAllocations = allocRes.rows || [];

  const forfeitAllocations = allAllocations.filter((a: any) => {
    if (a.item_id) {
      return lostItemIds.includes(a.item_id) && (a.status === 'HELD' || a.status === 'PENDING_REFUND');
    }
    // Receipt-level allocation: chỉ dùng khi phiếu chỉ có đúng 1 cuốn sách duy nhất
    if (allItems.length === 1) {
      return a.status === 'HELD' || a.status === 'PENDING_REFUND';
    }
    return false;
  });

  // S12-08: Kiểm tra coverage chặt chẽ cho TỪNG cuốn sách báo mất trước khi ghi nhận
  for (const lostId of lostItemIds) {
    const hasItemAlloc = allAllocations.some(
      (a: any) => a.item_id === lostId && (a.status === 'HELD' || a.status === 'PENDING_REFUND')
    );
    if (!hasItemAlloc) {
      const hasReceiptAlloc =
        allItems.length === 1 &&
        allAllocations.some((a: any) => !a.item_id && (a.status === 'HELD' || a.status === 'PENDING_REFUND'));
      if (!hasReceiptAlloc) {
        const hasAmbiguous = allAllocations.some((a: any) => !a.item_id && allItems.length > 1);
        if (hasAmbiguous) {
          throw new CirculationError(
            'Phân bổ cọc cấp phiếu mượn không thể xác định cụ thể cho từng cuốn sách bị mất (ambiguous allocation).',
            'AMBIGUOUS_DEPOSIT_ALLOCATION',
            409
          );
        }
        throw new CirculationError(
          `Không tìm thấy khoản cọc tương ứng cho cuốn sách ID '${lostId}' để tịch thu.`,
          'MISSING_DEPOSIT_ALLOCATION',
          400
        );
      }
    }
  }

  // Cancel any PENDING_REFUND on forfeit allocations
  for (const fa of forfeitAllocations) {
    if (fa.status === 'PENDING_REFUND') {
      await db.query(
        `UPDATE refund_intents SET status = 'CANCELLED', updated_at = NOW() WHERE allocation_id = $1 AND status = 'PENDING'`,
        [fa.id]
      );
    }
  }

  // Tính tổng cọc bị tịch thu (chỉ giữ đúng tiền cọc của cuốn mất đã nhận, zero cash delta!)
  let totalForfeitDeposit = 0n;
  for (const alloc of forfeitAllocations) {
    totalForfeitDeposit += BigInt(alloc.remaining_amount);
  }

  // 5. Cập nhật book_copies sang LOST
  await db.query(
    `UPDATE book_copies
     SET status = 'LOST'
     WHERE id = ANY($1)`,
    [lostCopyIds]
  );

  // 6. Cập nhật loan_items: is_lost = TRUE, lost_at = NOW(), lost_reason = reason, returned_at vẫn NULL
  await db.query(
    `UPDATE loan_items
     SET is_lost = TRUE, lost_at = NOW(), lost_reason = $2
     WHERE id = ANY($1)`,
    [lostItemIds, validated.reason]
  );

  // 7. Cập nhật deposit_allocations tương ứng sang FORFEITED, remaining_amount = 0
  const forfeitAllocIds = forfeitAllocations.map((a: any) => a.id);
  if (forfeitAllocIds.length > 0) {
    await db.query(
      `UPDATE deposit_allocations
       SET status = 'FORFEITED', remaining_amount = 0, updated_at = NOW()
       WHERE id = ANY($1)`,
      [forfeitAllocIds]
    );
  }

  // 8. S11-03: Ghi bút toán tịch thu cọc với entryCode có bound <= 32 ký tự
  let journalEntryId: string | null = null;
  if (totalForfeitDeposit > 0n) {
    const prevLossEntries = await db.query<any>(
      `SELECT COUNT(*) as cnt FROM journal_entries WHERE source_id = $1 AND source_type = 'LOAN_FINE_FORFEIT'`,
      [receipt.id]
    );
    const lossSeq = Number(prevLossEntries.rows[0]?.cnt || 0) + 1;
    const rcpShort = (receipt.receipt_number || receipt.id).replace(/^RCP-/i, '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);
    const entryCode = `JE-LF-${rcpShort}-${lossSeq}`;

    const je = await recordJournalEntry(db, {
      entryCode,
      fundId: FUND_IDS.LOAN,
      sourceType: 'LOAN_FINE_FORFEIT',
      sourceId: receipt.id,
      debitAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      creditAccount: ACCOUNT_CODES.FINE_REVENUE,
      amount: totalForfeitDeposit,
      cashSessionId: validated.cashSessionId || null,
      createdBy: actorId,
      notes: `Tịch thu cọc ${totalForfeitDeposit.toString()}₫ do báo mất ${itemsToLose.length} cuốn sách phiếu ${receipt.receipt_number}: ${validated.reason}`,
    });
    journalEntryId = je.id;
  }

  // 9. Kiểm tra xem phiếu còn cuốn nào đang được giữ mượn (chưa return, chưa lost, chưa carry)
  const remainingActiveItems = allItems.filter(
    (it: any) =>
      !lostCopyIds.includes(it.copy_id) &&
      it.returned_at === null &&
      !it.is_lost &&
      it.carried_forward_at === null
  );

  let newReceiptStatus: LoanReceiptStatus = receipt.status;
  let settlementType: 'LOST' | null = null;
  const todayVietnam = getCurrentVietnamDate();

  if (remainingActiveItems.length === 0) {
    // Toàn bộ sách trên phiếu đã được xử lý (trả hoặc mất) -> Tất toán phiếu mượn vì mất
    newReceiptStatus = 'LOST';
    settlementType = 'LOST';

    await db.query(
      `UPDATE loan_receipts SET status = 'LOST' WHERE id = $1`,
      [receipt.id]
    );

    // Ghi nhận quyết toán vào loan_settlements
    await db.query(
      `INSERT INTO loan_settlements (
         receipt_id, settlement_type, return_date, overdue_days,
         fine_suggested, fine_final, fine_reason, fine_collected, fine_pending_amount, fine_status,
         total_deposit, deposit_refunded, deposit_forfeited, deposit_transferred, new_deposit_collected,
         settled_by
       ) VALUES ($1, $2, $3, 0, 0, 0, $4, 0, 0, 'COLLECTED', $5, 0, $6, 0, 0, $7)`,
      [
        receipt.id,
        'LOST',
        todayVietnam,
        validated.reason,
        totalForfeitDeposit.toString(),
        totalForfeitDeposit.toString(),
        actorId,
      ]
    );
  }

  // 10. Audit log
  await recordAuditLog(db, {
    actorId,
    action: 'REPORT_BOOK_LOSS',
    targetResource: 'LOAN_RECEIPT',
    targetId: receipt.id,
    details: {
      receiptNumber: receipt.receipt_number,
      lostCopyIds,
      forfeitedDeposit: Number(totalForfeitDeposit),
      reason: validated.reason,
      newReceiptStatus,
      journalEntryId,
    },
  });

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receipt_number,
    lostCopyIds,
    forfeitedDeposit: Number(totalForfeitDeposit),
    receiptStatus: newReceiptStatus,
    settlementType,
    journalEntryId,
    message: `Báo mất ${itemsToLose.length} cuốn sách thành công. Đã tịch thu ${Number(totalForfeitDeposit)}₫ tiền cọc.`,
  };
}

/**
 * Trích xuất báo giá phạt, hạn hiệu lực và nghĩa vụ cọc từ server (S12-03)
 * Phục vụ quầy kiểm tra chính xác hạn theo lịch nghỉ CLB trước khi trả hoặc gia hạn.
 */
export async function quoteLoanAction(
  db: Queryable,
  params: QuoteLoanActionParams
): Promise<QuoteLoanActionResult> {
  const { receiptId, action } = params;
  if (!receiptId) {
    throw new CirculationError('Mã phiếu mượn (receiptId) không hợp lệ.', 'INVALID_RECEIPT_ID', 400);
  }

  const rRes = await db.query<any>(
    `SELECT id, receipt_number, borrower_id, borrow_date, due_date, renew_count, status
     FROM loan_receipts
     WHERE id = $1`,
    [receiptId]
  );
  if (!rRes.rows || rRes.rows.length === 0) {
    throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${receiptId}'.`);
  }
  const receipt = rRes.rows[0];

  const holRes = await db.query<any>(`SELECT holiday_date FROM calendar_holidays`);
  const holidays = (holRes.rows || []).map((r: any) => normalizeDateToVietnamYmd(r.holiday_date));

  const targetDate = params.targetDate ? normalizeDateToVietnamYmd(params.targetDate) : getCurrentVietnamDate();
  const rawDueDate = normalizeDateToVietnamYmd(receipt.due_date);
  const { effectiveDueDate } = getHolidayAdjustedDueDate(rawDueDate, holidays);

  const overdueDays = calculateOverdueDays(effectiveDueDate, targetDate);
  const suggestedFineBigInt = calculateSuggestedFine(overdueDays);

  // Active items and deposit allocations
  const itRes = await db.query<any>(
    `SELECT li.id, li.copy_id, li.deposit_snapshot, li.returned_at, li.is_lost,
            bc.barcode, bt.title
     FROM loan_items li
     JOIN book_copies bc ON bc.id = li.copy_id
     JOIN book_editions be ON be.id = bc.edition_id
     JOIN book_titles bt ON bt.id = be.title_id
     WHERE li.receipt_id = $1
     ORDER BY li.id ASC`,
    [receiptId]
  );
  const items = (itRes.rows || []).map((r: any) => ({
    barcode: r.barcode,
    title: r.title,
    depositSnapshot: Number(r.deposit_snapshot || 0),
    returnedAt: r.returned_at || null,
    isLost: Boolean(r.is_lost),
  }));

  const allocRes = await db.query<any>(
    `SELECT remaining_amount, status
     FROM deposit_allocations
     WHERE receipt_id = $1`,
    [receiptId]
  );
  const totalDeposit = (allocRes.rows || [])
    .filter((a: any) => a.status === 'HELD' || a.status === 'PENDING_REFUND')
    .reduce((sum: number, a: any) => sum + Number(a.remaining_amount || 0), 0);

  const suggestedFine = Number(suggestedFineBigInt);
  const effectiveFine = Math.min(suggestedFine, totalDeposit);

  // Projected due date if renewed: 14 calendar days from base date with holidays
  const baseDate = overdueDays > 0 ? targetDate : effectiveDueDate;
  const projectedCalendar = calculateEffectiveDueDate(baseDate, 14, holidays);
  const projectedDueDate = projectedCalendar.effectiveDueDate;

  const renewCount = Number(receipt.renew_count || 0);
  const isEligibleStatus = receipt.status === 'ACTIVE' || receipt.status === 'OVERDUE';
  const fineWithinDepositCap = !overdueDays || suggestedFine < totalDeposit;
  const canRenew = renewCount < 3 && isEligibleStatus && fineWithinDepositCap;

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receipt_number,
    action,
    borrowDate: normalizeDateToVietnamYmd(receipt.borrow_date),
    rawDueDate,
    effectiveDueDate,
    targetDate,
    projectedDueDate,
    isOverdue: overdueDays > 0,
    overdueDays,
    suggestedFine,
    effectiveFine,
    totalDeposit,
    canRenew,
    renewCount,
    items,
  };
}

/**
 * Lấy danh sách ý định hoàn cọc đang chờ xử lý (Chặng 12: Quầy phục vụ)
 */
export async function listPendingRefunds(db: Queryable): Promise<PendingRefundItemDto[]> {
  const res = await db.query<any>(
    `SELECT ri.id, ri.allocation_id, ri.amount, ri.refund_method, ri.status, ri.created_at, ri.requested_by,
            lr.id AS receipt_id, lr.receipt_number,
            b.full_name AS borrower_name, b.student_id AS borrower_student_id
     FROM refund_intents ri
     JOIN deposit_allocations da ON da.id = ri.allocation_id
     JOIN loan_receipts lr ON lr.id = da.receipt_id
     LEFT JOIN borrowers b ON b.id = lr.borrower_id
     WHERE ri.status = 'PENDING'
     ORDER BY ri.created_at DESC`
  );
  return (res.rows || []).map((row: any) => ({
    id: row.id,
    allocationId: row.allocation_id,
    receiptId: row.receipt_id,
    receiptNumber: row.receipt_number,
    borrowerName: row.borrower_name || 'Bạn đọc',
    borrowerStudentId: row.borrower_student_id || '',
    amount: Number(row.amount),
    refundMethod: row.refund_method,
    status: row.status,
    createdAt: row.created_at,
    requestedBy: row.requested_by,
  }));
}

/**
 * Hủy ý định hoàn cọc khi chưa thực chi (Chặng 12: Điều chỉnh nghiệp vụ)
 */
export async function cancelRefundIntent(
  db: Queryable,
  intentId: string,
  actorId: string,
  reason?: string
): Promise<{ id: string; status: 'CANCELLED'; message: string }> {
  const iRes = await db.query<any>(
    `SELECT id, allocation_id, status FROM refund_intents WHERE id = $1 FOR UPDATE`,
    [intentId]
  );
  if (!iRes.rows || iRes.rows.length === 0) {
    throw new CirculationError(`Không tìm thấy ý định hoàn cọc ID '${intentId}'.`, 'REFUND_INTENT_NOT_FOUND', 404);
  }
  const intent = iRes.rows[0];
  if (intent.status !== 'PENDING') {
    throw new CirculationError(
      `Chỉ có thể hủy ý định hoàn cọc ở trạng thái PENDING (hiện tại: ${intent.status}).`,
      'INVALID_REFUND_STATUS',
      400
    );
  }

  await db.query(
    `UPDATE refund_intents SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
    [intentId]
  );

  await db.query(
    `UPDATE deposit_allocations SET status = 'HELD', updated_at = NOW() WHERE id = $1`,
    [intent.allocation_id]
  );

  await recordAuditLog(db, {
    actorId,
    action: 'CANCEL_REFUND_INTENT',
    targetResource: 'REFUND_INTENT',
    targetId: intentId,
    details: { reason: reason || 'Hủy bởi người trực bàn' },
  });

  return {
    id: intentId,
    status: 'CANCELLED',
    message: 'Hủy ý định hoàn cọc thành công.',
  };
}

/**
 * Lấy danh sách phiếu mượn đang chờ thu cọc mới (T73 Pending Deposit)
 */
export async function listPendingDeposits(db: Queryable): Promise<PendingDepositItemDto[]> {
  const res = await db.query<any>(
    `SELECT lr.id, lr.receipt_number, lr.borrow_date, lr.due_date, lr.created_at,
            b.full_name AS borrower_name, b.student_id AS borrower_student_id,
            da.id AS allocation_id, da.original_amount, da.payment_method,
            bc.barcode, bt.title
     FROM loan_receipts lr
     LEFT JOIN borrowers b ON b.id = lr.borrower_id
     JOIN deposit_allocations da ON da.receipt_id = lr.id AND da.status = 'PENDING_COLLECTION'
     JOIN loan_items li ON li.receipt_id = lr.id AND li.returned_at IS NULL AND li.is_lost = FALSE AND (da.item_id IS NULL OR da.item_id = li.id)
     JOIN book_copies bc ON bc.id = li.copy_id
     JOIN book_editions be ON be.id = bc.edition_id
     JOIN book_titles bt ON bt.id = be.title_id
     WHERE lr.status = 'PENDING_DEPOSIT'
     ORDER BY lr.created_at DESC`
  );
  return (res.rows || []).map((row: any) => ({
    receiptId: row.id,
    receiptNumber: row.receipt_number,
    borrowerName: row.borrower_name || 'Bạn đọc',
    borrowerStudentId: row.borrower_student_id || '',
    requiredDeposit: Number(row.original_amount),
    paymentMethod: row.payment_method,
    barcode: row.barcode,
    title: row.title,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    createdAt: row.created_at,
  }));
}

/**
 * Lấy danh sách khoản phạt quá hạn đang chờ thu (Bao gồm cả settlement và renewal)
 */
export async function listPendingFines(db: Queryable): Promise<PendingFineItemDto[]> {
  const res = await db.query<any>(
    `SELECT ls.id AS target_id,
            ls.id AS settlement_id,
            'SETTLEMENT' AS source_type,
            ls.receipt_id,
            lr.receipt_number,
            b.full_name AS borrower_name,
            b.student_id AS borrower_student_id,
            ls.fine_pending_amount,
            ls.fine_reason,
            ls.settled_at AS created_at
     FROM loan_settlements ls
     JOIN loan_receipts lr ON lr.id = ls.receipt_id
     LEFT JOIN borrowers b ON b.id = lr.borrower_id
     WHERE ls.fine_status = 'PENDING'

     UNION ALL

     SELECT rn.id AS target_id,
            rn.id AS settlement_id,
            'RENEWAL' AS source_type,
            rn.receipt_id,
            lr.receipt_number,
            b.full_name AS borrower_name,
            b.student_id AS borrower_student_id,
            rn.fine_pending_amount,
            rn.fine_reason,
            rn.renewed_at AS created_at
     FROM loan_renewals rn
     JOIN loan_receipts lr ON lr.id = rn.receipt_id
     LEFT JOIN borrowers b ON b.id = lr.borrower_id
     WHERE rn.fine_status = 'PENDING'

     ORDER BY created_at DESC`
  );
  return (res.rows || []).map((row: any) => ({
    targetId: row.target_id,
    settlementId: row.target_id,
    sourceType: row.source_type as 'SETTLEMENT' | 'RENEWAL',
    receiptId: row.receipt_id,
    receiptNumber: row.receipt_number,
    borrowerName: row.borrower_name || 'Bạn đọc',
    borrowerStudentId: row.borrower_student_id || '',
    pendingAmount: Number(row.fine_pending_amount),
    fineReason: row.fine_reason,
    settledAt: row.created_at,
  }));
}
