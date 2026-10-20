/**
-- =====================================================================
-- Consignment Settlement & Supplier Payments (Stage 18)
-- Quyết toán lô sách, tính toán doanh thu/giá vốn/lãi gộp, tách bạch hoàn cọc và trả tiền
-- Nghiệp vụ: FR-05, R04, R07 (sales), D44-D49, D56, T56, T58, T59, T60, T68, T69
-- =====================================================================
 */

import type { Queryable } from '../../server/finance/types.ts';
import { BadRequestError, NotFoundError, ConflictError } from '../../server/errors.ts';
import { recordJournalEntry } from '../../server/finance/ledger.ts';
import { ACCOUNT_CODES, FUND_IDS, assertSafeVndAmount } from '../../server/finance/types.ts';
import {
  claimIdempotency,
  completeIdempotency,
  computePayloadHash,
} from '../../server/shared/idempotency.ts';
import type {
  ConsignmentSettlement,
  SupplierPayment,
  CreateSettlementDto,
  RecordSupplierPaymentDto,
} from './sales-types.ts';

/**
 * 1. Xem trước tính toán quyết toán cho lô sách (Preview Calculation)
 * Khớp đúng T68, T69:
 * - Doanh thu = tổng số tiền bán các cuốn thuộc lô
 * - Nợ nhà sách = tổng (số lượng bán * giá nhập sau chiết khấu)
 * - Chênh lệch gộp = Doanh thu - Nợ nhà sách
 * - Nếu không cọc: depositRefundExpected = 0 (tuyệt đối không sinh 2.6tr giả định)
 * - Nếu có cọc: depositRefundExpected = depositAmount (hoàn riêng, trả riêng)
 */
export async function calculateLotSettlement(db: Queryable, lotId: string): Promise<{
  lotId: string;
  totalSoldBooks: number;
  totalReturnedBooks: number;
  totalRetainedBooks: number;
  totalAvailableBooks: number;
  initialQuantity: number;
  totalRevenue: number;
  payableToSupplier: number;
  grossProfit: number;
  depositPaid: number;
  depositRefundExpected: number;
}> {
  // Lấy thông tin lô
  const lotRes = await db.query(
    `SELECT id, deposit_amount, status FROM consignment_lots WHERE id = $1 LIMIT 1;`,
    [lotId]
  );
  if (lotRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy lô sách tương ứng.', 'LOT_NOT_FOUND');
  }
  const lot = lotRes.rows[0];

  // Lấy tổng hợp từ các dòng sách trong lô
  const itemsRes = await db.query(
    `SELECT id, import_price, initial_quantity, sold_quantity, returned_quantity,
            retained_quantity, available_quantity
     FROM consignment_lot_items
     WHERE lot_id = $1;`,
    [lotId]
  );

  let totalSoldBooks = 0;
  let totalReturnedBooks = 0;
  let totalRetainedBooks = 0;
  let totalAvailableBooks = 0;
  let initialQuantity = 0;
  let payableToSupplier = 0;

  for (const item of itemsRes.rows) {
    const sold = Number(item.sold_quantity);
    const ret = Number(item.returned_quantity);
    const retained = Number(item.retained_quantity);
    const avail = Number(item.available_quantity);
    const init = Number(item.initial_quantity);
    const importPrice = Number(item.import_price);

    totalSoldBooks += sold;
    totalReturnedBooks += ret;
    totalRetainedBooks += retained;
    totalAvailableBooks += avail;
    initialQuantity += init;

    // Tiền phải trả nhà sách cho các cuốn đã bán
    payableToSupplier += sold * importPrice;
  }

  // Doanh thu thực tế từ bảng book_sales cho các dòng sách thuộc lô này
  const salesRes = await db.query(
    `SELECT COALESCE(SUM(s.total_amount), 0) as total_revenue
     FROM book_sales s
     JOIN consignment_lot_items i ON s.lot_item_id = i.id
     WHERE i.lot_id = $1;`,
    [lotId]
  );

  const totalRevenue = Number(salesRes.rows[0].total_revenue);
  const grossProfit = totalRevenue - payableToSupplier;

  const depositPaid = Number(lot.deposit_amount);
  // Quy tắc T68/T69: Nếu không cọc (depositPaid = 0), kỳ vọng hoàn = 0.
  // Nếu có cọc (depositPaid > 0), kỳ vọng hoàn đúng số tiền đã cọc.
  const depositRefundExpected = depositPaid;

  return {
    lotId,
    totalSoldBooks,
    totalReturnedBooks,
    totalRetainedBooks,
    totalAvailableBooks,
    initialQuantity,
    totalRevenue,
    payableToSupplier,
    grossProfit,
    depositPaid,
    depositRefundExpected,
  };
}

/**
 * 2. Lập chứng từ quyết toán chính thức cho lô sách
 * Bắt buộc kiểm tra Idempotency key, chống quyết toán trùng.
 */
export async function createSettlement(
  db: Queryable,
  dto: CreateSettlementDto,
  actorId: string
): Promise<ConsignmentSettlement> {
  if (!dto.lotId) {
    throw new BadRequestError('Mã lô sách là bắt buộc.', 'MISSING_LOT_ID');
  }

  // 1. Xử lý Idempotency qua helper chuẩn (kiểm actor, action, payload hash)
  let idempotencyClaimed = false;
  if (dto.idempotencyKey) {
    const payloadHash = computePayloadHash({
      lotId: dto.lotId,
      settlementDate: dto.settlementDate || null,
      notes: dto.notes?.trim() || null,
    });
    const claim = await claimIdempotency(db, actorId, 'CREATE_SETTLEMENT', dto.idempotencyKey, payloadHash);
    if (claim.action === 'RETURN_CACHED' && claim.responseBody) {
      return claim.responseBody as ConsignmentSettlement;
    }
    idempotencyClaimed = true;
  }

  // 2. Khóa aggregate lô trước kiểm quyết toán/tính số liệu (FOR UPDATE)
  const lotRes = await db.query(
    `SELECT id, batch_code, status, deposit_amount, deposit_refunded, deposit_status
     FROM consignment_lots
     WHERE id = $1
     FOR UPDATE;`,
    [dto.lotId]
  );
  if (lotRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy lô sách tương ứng.', 'LOT_NOT_FOUND');
  }
  const lot = lotRes.rows[0];
  if (lot.status === 'SETTLED') {
    throw new ConflictError('Lô sách này đã được lập quyết toán trước đó (trạng thái SETTLED).', 'LOT_ALREADY_SETTLED');
  }

  // 3. Kiểm tra tính duy nhất của quyết toán cho lô sách
  const lotExisting = await db.query(
    `SELECT id FROM consignment_settlements WHERE lot_id = $1 LIMIT 1;`,
    [dto.lotId]
  );
  if (lotExisting.rows.length > 0) {
    throw new ConflictError('Lô sách này đã được lập quyết toán trước đó.', 'LOT_ALREADY_SETTLED');
  }

  // 4. Tính toán số liệu dưới lock
  const calc = await calculateLotSettlement(db, dto.lotId);

  const settlementCode = `SETTLE-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const settlementDate = dto.settlementDate || new Date().toISOString().split('T')[0];

  const depositRefundStatus = calc.depositRefundExpected > 0 ? 'PENDING' : 'NONE';
  const paymentStatus = calc.payableToSupplier === 0 ? 'PAID' : 'UNPAID';

  const result = await db.query(
    `INSERT INTO consignment_settlements (
       settlement_code, lot_id, settlement_date, total_sold_books, total_returned_books,
       total_retained_books, total_revenue, payable_to_supplier, gross_profit, deposit_paid,
       deposit_refund_expected, paid_to_supplier, payment_status, deposit_refund_status,
       deposit_refund_received, idempotency_key, settled_by, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, 0, $14, $15, $16)
     RETURNING id, settlement_code, lot_id, settlement_date, total_sold_books, total_returned_books,
               total_retained_books, total_revenue, payable_to_supplier, gross_profit, deposit_paid,
               deposit_refund_expected, paid_to_supplier, payment_status, deposit_refund_status,
               deposit_refund_received, idempotency_key, settled_by, notes, created_at, updated_at;`,
    [
      settlementCode,
      dto.lotId,
      settlementDate,
      calc.totalSoldBooks,
      calc.totalReturnedBooks,
      calc.totalRetainedBooks,
      calc.totalRevenue,
      calc.payableToSupplier,
      calc.grossProfit,
      calc.depositPaid,
      calc.depositRefundExpected,
      paymentStatus,
      depositRefundStatus,
      dto.idempotencyKey || null,
      actorId,
      dto.notes?.trim() || null,
    ]
  );

  // Cập nhật trạng thái lô sang SETTLED
  await db.query(
    `UPDATE consignment_lots SET status = 'SETTLED', updated_at = NOW() WHERE id = $1;`,
    [dto.lotId]
  );

  const settlement = mapSettlementRow(result.rows[0]);

  // P22-04: Hạch toán nợ phải trả nhà sách vào Sổ Cái (Quỹ Hoạt Động - FUND_OPERATION)
  if (calc.payableToSupplier > 0) {
    const safePayable = assertSafeVndAmount(calc.payableToSupplier);
    const cleanCode = settlementCode.replace(/[^a-zA-Z0-9]/g, '');
    const entryCode = `JE-SETTLE-${cleanCode.slice(-25)}`;

    await recordJournalEntry(db, {
      entryCode,
      fundId: FUND_IDS.OPERATION,
      sourceType: 'CONSIGNMENT_SETTLEMENT',
      sourceId: settlement.id,
      debitAccount: ACCOUNT_CODES.ACTIVITY_EXPENSE,
      creditAccount: ACCOUNT_CODES.BOOKSTORE_PAYABLE,
      amount: safePayable,
      createdBy: actorId,
      notes: `Quyết toán lô sách ${dto.lotId}: Ghi nhận nợ phải trả nhà sách (${settlementCode})`,
    });
  }

  if (idempotencyClaimed && dto.idempotencyKey) {
    await completeIdempotency(db, actorId, 'CREATE_SETTLEMENT', dto.idempotencyKey, 201, settlement);
  }

  return settlement;
}

/**
 * 3. Ghi nhận giao dịch thanh toán tiền sách hoặc nhận hoàn cọc nhà sách
 * Tách biệt hoàn toàn hai nghiệp vụ (T60, T68, T69):
 * - PAY_SUPPLIER_PAYABLE: Trả nợ tiền sách cho nhà sách (tối đa bằng payableToSupplier)
 * - RECEIVE_DEPOSIT_REFUND: Nhận lại tiền cọc từ nhà sách (tối đa bằng depositRefundExpected)
 * Tuyệt đối không cấn trừ gộp thành khoản chi ròng.
 * Nhận lại cọc KHÔNG phải doanh thu.
 */
export async function recordSupplierPayment(
  db: Queryable,
  settlementId: string,
  dto: RecordSupplierPaymentDto,
  actorId: string
): Promise<{ payment: SupplierPayment; settlement: ConsignmentSettlement }> {
  if (!dto.paymentType) {
    throw new BadRequestError('Loại thanh toán không hợp lệ.', 'INVALID_PAYMENT_DATA');
  }

  // 1. Kiểm tra xác nhận thực chi/thực nhận (RF-02)
  if (dto.paymentConfirmed !== true) {
    throw new BadRequestError(
      'Giao dịch thanh toán nhà sách/nhận hoàn cọc yêu cầu xác nhận thực tế (paymentConfirmed: true).',
      'PAYMENT_UNCONFIRMED'
    );
  }

  // 2. Kiểm tra phương thức thanh toán hợp lệ (không tự suy đoán)
  if (!dto.paymentMethod || (dto.paymentMethod !== 'CASH' && dto.paymentMethod !== 'BANK_TRANSFER')) {
    throw new BadRequestError(
      'Phương thức thanh toán không hợp lệ (bắt buộc CASH hoặc BANK_TRANSFER).',
      'INVALID_PAYMENT_METHOD'
    );
  }

  // 3. Bắt buộc nhập mã chứng từ/tham chiếu thực tế (không tự sinh mã ảo UNC làm bằng chứng)
  const refDoc = dto.referenceDoc?.trim();
  if (!refDoc) {
    throw new BadRequestError(
      'Bắt buộc cung cấp mã chứng từ/tham chiếu thực tế (referenceDoc).',
      'MISSING_REFERENCE_DOC'
    );
  }

  const safeAmount = assertSafeVndAmount(dto.amount);
  const amountNum = Number(safeAmount);

  // Xử lý Idempotency
  let idempotencyClaimed = false;
  if (dto.idempotencyKey) {
    const payloadHash = computePayloadHash({
      settlementId,
      paymentType: dto.paymentType,
      amount: amountNum,
      paymentMethod: dto.paymentMethod,
      referenceDoc: refDoc,
      paymentConfirmed: true,
    });
    const claim = await claimIdempotency(db, actorId, 'SUPPLIER_PAYMENT', dto.idempotencyKey, payloadHash);
    if (claim.action === 'RETURN_CACHED' && claim.responseBody) {
      return claim.responseBody as { payment: SupplierPayment; settlement: ConsignmentSettlement };
    }
    idempotencyClaimed = true;
  }

  // Khóa bản ghi quyết toán để xử lý an toàn
  const settleRes = await db.query(
    `SELECT id, settlement_code, lot_id, settlement_date, total_sold_books, total_returned_books,
            total_retained_books, total_revenue, payable_to_supplier, gross_profit, deposit_paid,
            deposit_refund_expected, paid_to_supplier, payment_status, deposit_refund_status,
            deposit_refund_received, idempotency_key, settled_by, notes, created_at, updated_at
     FROM consignment_settlements
     WHERE id = $1
     FOR UPDATE;`,
    [settlementId]
  );

  if (settleRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy quyết toán tương ứng.', 'SETTLEMENT_NOT_FOUND');
  }

  const s = settleRes.rows[0];
  const payableToSupplier = Number(s.payable_to_supplier);
  const paidToSupplier = Number(s.paid_to_supplier);
  const depositRefundExpected = Number(s.deposit_refund_expected);
  const depositRefundReceived = Number(s.deposit_refund_received);

  const paymentCode = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  let newPaidToSupplier = paidToSupplier;
  let newPaymentStatus = s.payment_status;
  let newDepositRefundReceived = depositRefundReceived;
  let newDepositRefundStatus = s.deposit_refund_status;

  if (dto.paymentType === 'PAY_SUPPLIER_PAYABLE') {
    // Trả nợ tiền sách cho nhà sách
    if (paidToSupplier + amountNum > payableToSupplier) {
      throw new ConflictError(
        `Số tiền thanh toán (${amountNum}) vượt quá số nợ còn lại (${payableToSupplier - paidToSupplier}).`,
        'OVERPAYMENT_NOT_ALLOWED'
      );
    }
    newPaidToSupplier += amountNum;
    newPaymentStatus = newPaidToSupplier >= payableToSupplier ? 'PAID' : 'PARTIALLY_PAID';
  } else if (dto.paymentType === 'RECEIVE_DEPOSIT_REFUND') {
    // Nhận hoàn cọc từ nhà sách
    if (depositRefundExpected === 0) {
      throw new BadRequestError('Lô sách này không có khoản cọc nào cần hoàn lại.', 'NO_DEPOSIT_TO_REFUND');
    }
    if (depositRefundReceived + amountNum > depositRefundExpected) {
      throw new ConflictError(
        `Số tiền nhận hoàn (${amountNum}) vượt quá số cọc kỳ vọng (${depositRefundExpected - depositRefundReceived}).`,
        'EXCEED_DEPOSIT_REFUND'
      );
    }
    newDepositRefundReceived += amountNum;
    newDepositRefundStatus = newDepositRefundReceived >= depositRefundExpected ? 'RECEIVED' : 'PENDING';

    // Cập nhật lô consignment_lots: deposit_refunded
    await db.query(
      `UPDATE consignment_lots
       SET deposit_refunded = deposit_refunded + $1,
           deposit_status = CASE WHEN deposit_refunded + $1 >= deposit_amount THEN 'FULLY_REFUNDED' ELSE 'PARTIALLY_REFUNDED' END,
           updated_at = NOW()
       WHERE id = $2;`,
      [amountNum, s.lot_id]
    );
  } else {
    throw new BadRequestError(`Loại thanh toán '${dto.paymentType}' không được hỗ trợ.`, 'UNSUPPORTED_PAYMENT_TYPE');
  }

  // Ghi nhận dòng thanh toán
  const payRes = await db.query(
    `INSERT INTO supplier_payments (
       payment_code, settlement_id, payment_type, amount, payment_method,
       confirmed_at, confirmed_by, reference_doc, notes
     ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
     RETURNING id, payment_code, settlement_id, payment_type, amount, payment_method,
               confirmed_at, confirmed_by, reference_doc, notes, created_at;`,
    [
      paymentCode,
      settlementId,
      dto.paymentType,
      amountNum,
      dto.paymentMethod,
      actorId,
      dto.referenceDoc?.trim() || null,
      dto.notes?.trim() || null,
    ]
  );

  // Cập nhật trạng thái quyết toán
  const updatedSettleRes = await db.query(
    `UPDATE consignment_settlements
     SET paid_to_supplier = $1,
         payment_status = $2,
         deposit_refund_received = $3,
         deposit_refund_status = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING id, settlement_code, lot_id, settlement_date, total_sold_books, total_returned_books,
               total_retained_books, total_revenue, payable_to_supplier, gross_profit, deposit_paid,
               deposit_refund_expected, paid_to_supplier, payment_status, deposit_refund_status,
               deposit_refund_received, idempotency_key, settled_by, notes, created_at, updated_at;`,
    [newPaidToSupplier, newPaymentStatus, newDepositRefundReceived, newDepositRefundStatus, settlementId]
  );

  const payRow = payRes.rows[0];

  // P22-04: Hạch toán sổ kép Sổ Cái (Quỹ Hoạt Động - FUND_OPERATION)
  const cleanPayCode = paymentCode.replace(/[^a-zA-Z0-9]/g, '');
  if (dto.paymentType === 'PAY_SUPPLIER_PAYABLE') {
    // Trả nợ tiền sách: Nợ TK 331 (NO_PHAI_TRA_NHA_SACH) / Có TK 112 (TIEN_NGAN_HANG) hoặc 111 (TIEN_MAT_HOP)
    const entryCode = `JE-SUP-PAY-${cleanPayCode.slice(-25)}`;
    const creditAccount = dto.paymentMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;

    await recordJournalEntry(db, {
      entryCode,
      fundId: FUND_IDS.OPERATION,
      sourceType: 'SUPPLIER_PAYMENT',
      sourceId: payRow.id,
      debitAccount: ACCOUNT_CODES.BOOKSTORE_PAYABLE,
      creditAccount,
      amount: safeAmount,
      createdBy: actorId,
      notes: `Thanh toán nợ tiền sách cho nhà sách (${paymentCode})`,
    });
  } else if (dto.paymentType === 'RECEIVE_DEPOSIT_REFUND') {
    // Nhận hoàn cọc: Nợ TK 112 (TIEN_NGAN_HANG) hoặc 111 (TIEN_MAT_HOP) / Có TK 138 (COC_DAT_NHA_SACH)
    const entryCode = `JE-SUP-REF-${cleanPayCode.slice(-25)}`;
    const debitAccount = dto.paymentMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;

    await recordJournalEntry(db, {
      entryCode,
      fundId: FUND_IDS.OPERATION,
      sourceType: 'SUPPLIER_PAYMENT',
      sourceId: payRow.id,
      debitAccount,
      creditAccount: ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE,
      amount: safeAmount,
      createdBy: actorId,
      notes: `Nhận lại tiền cọc từ nhà sách (${paymentCode})`,
    });
  }

  const payment: SupplierPayment = {
    id: payRow.id,
    paymentCode: payRow.payment_code,
    settlementId: payRow.settlement_id,
    paymentType: payRow.payment_type,
    amount: Number(payRow.amount),
    paymentMethod: payRow.payment_method,
    confirmedAt: payRow.confirmed_at,
    confirmedBy: payRow.confirmed_by,
    referenceDoc: payRow.reference_doc,
    notes: payRow.notes,
    createdAt: payRow.created_at,
  };

  const finalSettlement = mapSettlementRow(updatedSettleRes.rows[0]);
  const resultObj = { payment, settlement: finalSettlement };

  if (idempotencyClaimed && dto.idempotencyKey) {
    await completeIdempotency(db, actorId, 'SUPPLIER_PAYMENT', dto.idempotencyKey, 200, resultObj);
  }

  return resultObj;
}

/**
 * 4. Lấy chi tiết quyết toán của lô sách kèm lịch sử thanh toán
 */
export async function getSettlementByLotId(
  db: Queryable,
  lotId: string
): Promise<{ settlement: ConsignmentSettlement | null; payments: SupplierPayment[] }> {
  const settleRes = await db.query(
    `SELECT id, settlement_code, lot_id, settlement_date, total_sold_books, total_returned_books,
            total_retained_books, total_revenue, payable_to_supplier, gross_profit, deposit_paid,
            deposit_refund_expected, paid_to_supplier, payment_status, deposit_refund_status,
            deposit_refund_received, idempotency_key, settled_by, notes, created_at, updated_at
     FROM consignment_settlements
     WHERE lot_id = $1
     LIMIT 1;`,
    [lotId]
  );

  if (settleRes.rows.length === 0) {
    return { settlement: null, payments: [] };
  }

  const settlement = mapSettlementRow(settleRes.rows[0]);

  const payRes = await db.query(
    `SELECT id, payment_code, settlement_id, payment_type, amount, payment_method,
            confirmed_at, confirmed_by, reference_doc, notes, created_at
     FROM supplier_payments
     WHERE settlement_id = $1
     ORDER BY confirmed_at ASC;`,
    [settlement.id]
  );

  const payments: SupplierPayment[] = payRes.rows.map((row: any) => ({
    id: row.id,
    paymentCode: row.payment_code,
    settlementId: row.settlement_id,
    paymentType: row.payment_type,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    referenceDoc: row.reference_doc,
    notes: row.notes,
    createdAt: row.created_at,
  }));

  return { settlement, payments };
}

function mapSettlementRow(row: any): ConsignmentSettlement {
  return {
    id: row.id,
    settlementCode: row.settlement_code,
    lotId: row.lot_id,
    settlementDate: row.settlement_date,
    totalSoldBooks: Number(row.total_sold_books),
    totalReturnedBooks: Number(row.total_returned_books),
    totalRetainedBooks: Number(row.total_retained_books),
    totalRevenue: Number(row.total_revenue),
    payableToSupplier: Number(row.payable_to_supplier),
    grossProfit: Number(row.gross_profit),
    depositPaid: Number(row.deposit_paid),
    depositRefundExpected: Number(row.deposit_refund_expected),
    paidToSupplier: Number(row.paid_to_supplier),
    paymentStatus: row.payment_status,
    depositRefundStatus: row.deposit_refund_status,
    depositRefundReceived: Number(row.deposit_refund_received),
    idempotencyKey: row.idempotency_key,
    settledBy: row.settled_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
