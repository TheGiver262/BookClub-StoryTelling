/**
-- =====================================================================
-- Sales Lot Inventory Management (Stage 18)
-- Quản lý lô sách mới ký gửi từ nhà sách, kiểm kê, bán sách và trả sách dư
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
  BookSupplier,
  ConsignmentLot,
  ConsignmentLotItem,
  BookSale,
  ConsignmentReturn,
  CreateSupplierDto,
  CreateLotDto,
  RecordSaleDto,
  ReturnBooksDto,
  RetainBooksDto,
} from './sales-types.ts';

/**
 * 1. Tạo mới nhà cung cấp / nhà sách ký gửi
 */
export async function createSupplier(db: Queryable, dto: CreateSupplierDto): Promise<BookSupplier> {
  if (!dto.code || !dto.name) {
    throw new BadRequestError('Mã và tên nhà sách là bắt buộc.', 'INVALID_SUPPLIER_DATA');
  }

  const existing = await db.query(
    `SELECT id FROM book_suppliers WHERE code = $1 LIMIT 1;`,
    [dto.code.trim().toUpperCase()]
  );
  if (existing.rows.length > 0) {
    throw new ConflictError(`Nhà sách có mã '${dto.code}' đã tồn tại.`, 'SUPPLIER_CODE_EXISTS');
  }

  const result = await db.query(
    `INSERT INTO book_suppliers (code, name, contact_person, phone, email, address, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     RETURNING id, code, name, contact_person, phone, email, address, notes, is_active, created_at;`,
    [
      dto.code.trim().toUpperCase(),
      dto.name.trim(),
      dto.contactPerson?.trim() || null,
      dto.phone?.trim() || null,
      dto.email?.trim() || null,
      dto.address?.trim() || null,
      dto.notes?.trim() || null,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * 2. Lấy danh sách nhà sách
 */
export async function getSuppliers(db: Queryable): Promise<BookSupplier[]> {
  const result = await db.query(
    `SELECT id, code, name, contact_person, phone, email, address, notes, is_active, created_at
     FROM book_suppliers
     ORDER BY created_at DESC;`
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

/**
 * 3. Tạo mới một lô sách ký gửi và danh sách đầu sách
 * Quản lý giá nhập, giá bán, số lượng và tiền cọc CLB chi trả (nếu có)
 */
export async function createLot(db: Queryable, dto: CreateLotDto, actorId: string): Promise<ConsignmentLot> {
  if (!dto.batchCode || !dto.supplierId || !dto.campaignName || !dto.receivedDate) {
    throw new BadRequestError('Thiếu thông tin bắt buộc của lô sách ký gửi.', 'MISSING_LOT_FIELDS');
  }

  if (!dto.items || dto.items.length === 0) {
    throw new BadRequestError('Lô sách phải có ít nhất một dòng sách.', 'EMPTY_LOT_ITEMS');
  }

  // Kiểm tra nhà sách
  const supRes = await db.query(
    `SELECT id, name, is_active FROM book_suppliers WHERE id = $1 LIMIT 1;`,
    [dto.supplierId]
  );
  if (supRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy nhà sách tương ứng.', 'SUPPLIER_NOT_FOUND');
  }
  if (!supRes.rows[0].is_active) {
    throw new BadRequestError('Nhà sách đang tạm ngưng hoạt động.', 'SUPPLIER_INACTIVE');
  }

  // Kiểm tra trùng mã lô
  const lotCheck = await db.query(
    `SELECT id FROM consignment_lots WHERE batch_code = $1 LIMIT 1;`,
    [dto.batchCode.trim().toUpperCase()]
  );
  if (lotCheck.rows.length > 0) {
    throw new ConflictError(`Mã lô '${dto.batchCode}' đã tồn tại.`, 'LOT_CODE_EXISTS');
  }

  const depositAmount = Math.max(0, dto.depositAmount ?? 0);
  const isDepositConfirmed = depositAmount > 0 && dto.depositPaymentConfirmed === true;

  if (dto.depositPaymentConfirmed === true && depositAmount > 0) {
    if (!dto.depositPaymentMethod || (dto.depositPaymentMethod !== 'CASH' && dto.depositPaymentMethod !== 'BANK_TRANSFER')) {
      throw new BadRequestError(
        'Phương thức thanh toán cọc không hợp lệ khi xác nhận thanh toán (bắt buộc CASH hoặc BANK_TRANSFER).',
        'INVALID_PAYMENT_METHOD'
      );
    }
  }

  const depositStatus = isDepositConfirmed ? 'PAID' : 'NONE';

  // 1. Tạo Consignment Lot
  const lotRes = await db.query(
    `INSERT INTO consignment_lots (
       batch_code, supplier_id, campaign_name, received_date, target_settlement_date,
       deposit_amount, deposit_refunded, deposit_status, status, created_by, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'ACTIVE', $8, $9)
     RETURNING id, batch_code, supplier_id, campaign_name, received_date, target_settlement_date,
               deposit_amount, deposit_refunded, deposit_status, status, created_by, notes, created_at, updated_at;`,
    [
      dto.batchCode.trim().toUpperCase(),
      dto.supplierId,
      dto.campaignName.trim(),
      dto.receivedDate,
      dto.targetSettlementDate || null,
      depositAmount,
      depositStatus,
      actorId,
      dto.notes?.trim() || null,
    ]
  );

  const lotRow = lotRes.rows[0];
  const lotId = lotRow.id;

  // Hạch toán cọc đặt nhà sách vào Quỹ Hoạt Động CHỈ KHI có xác nhận thanh toán thực chi (RF-02)
  if (isDepositConfirmed) {
    const safeDeposit = assertSafeVndAmount(depositAmount);
    const debitAccount = ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE;
    const creditAccount = dto.depositPaymentMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;
    const cleanBatchCode = dto.batchCode.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, '');
    const entryCode = `JE-LOT-DEP-${cleanBatchCode.slice(-20)}`;

    await recordJournalEntry(db, {
      entryCode,
      fundId: FUND_IDS.OPERATION,
      sourceType: 'CONSIGNMENT_LOT',
      sourceId: lotId,
      debitAccount,
      creditAccount,
      amount: safeDeposit,
      createdBy: actorId,
      notes: `Đặt cọc lô sách ký gửi ${dto.batchCode}`,
    });
  }

  // 2. Thêm các dòng sách
  const createdItems: ConsignmentLotItem[] = [];

  for (const itemDto of dto.items) {
    if (!itemDto.bookTitle || itemDto.coverPrice < 0 || itemDto.initialQuantity <= 0) {
      throw new BadRequestError('Thông tin dòng sách không hợp lệ.', 'INVALID_LOT_ITEM');
    }

    const discount = Math.max(0, Math.min(100, itemDto.importDiscountPercent ?? 0));
    const importPrice =
      itemDto.importPrice !== undefined
        ? Math.max(0, itemDto.importPrice)
        : Math.round(itemDto.coverPrice * (1 - discount / 100));
    const retailPrice = Math.max(0, itemDto.retailPrice);

    const itemRes = await db.query(
      `INSERT INTO consignment_lot_items (
         lot_id, title_id, book_title, isbn, cover_price, import_discount_percent,
         import_price, retail_price, initial_quantity, sold_quantity, returned_quantity,
         retained_quantity, available_quantity
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, 0, $9)
       RETURNING id, lot_id, title_id, book_title, isbn, cover_price, import_discount_percent,
                 import_price, retail_price, initial_quantity, sold_quantity, returned_quantity,
                 retained_quantity, available_quantity, created_at, updated_at;`,
      [
        lotId,
        itemDto.titleId || null,
        itemDto.bookTitle.trim(),
        itemDto.isbn?.trim() || null,
        itemDto.coverPrice,
        discount,
        importPrice,
        retailPrice,
        itemDto.initialQuantity,
      ]
    );

    const itemRow = itemRes.rows[0];
    createdItems.push({
      id: itemRow.id,
      lotId: itemRow.lot_id,
      titleId: itemRow.title_id,
      bookTitle: itemRow.book_title,
      isbn: itemRow.isbn,
      coverPrice: Number(itemRow.cover_price),
      importDiscountPercent: Number(itemRow.import_discount_percent),
      importPrice: Number(itemRow.import_price),
      retailPrice: Number(itemRow.retail_price),
      initialQuantity: itemRow.initial_quantity,
      soldQuantity: itemRow.sold_quantity,
      returnedQuantity: itemRow.returned_quantity,
      retainedQuantity: itemRow.retained_quantity,
      availableQuantity: itemRow.available_quantity,
      createdAt: itemRow.created_at,
      updatedAt: itemRow.updated_at,
    });
  }

  return {
    id: lotRow.id,
    batchCode: lotRow.batch_code,
    supplierId: lotRow.supplier_id,
    supplierName: supRes.rows[0].name,
    campaignName: lotRow.campaign_name,
    receivedDate: lotRow.received_date,
    targetSettlementDate: lotRow.target_settlement_date,
    depositAmount: Number(lotRow.deposit_amount),
    depositRefunded: Number(lotRow.deposit_refunded),
    depositStatus: lotRow.deposit_status,
    status: lotRow.status,
    createdBy: lotRow.created_by,
    notes: lotRow.notes,
    createdAt: lotRow.created_at,
    updatedAt: lotRow.updated_at,
    items: createdItems,
  };
}

/**
 * 4. Lấy chi tiết lô sách và các đầu sách thuộc lô
 */
export async function getLotDetails(db: Queryable, lotId: string): Promise<ConsignmentLot> {
  const lotRes = await db.query(
    `SELECT l.id, l.batch_code, l.supplier_id, s.name as supplier_name, l.campaign_name,
            l.received_date, l.target_settlement_date, l.deposit_amount, l.deposit_refunded,
            l.deposit_status, l.status, l.created_by, l.notes, l.created_at, l.updated_at
     FROM consignment_lots l
     JOIN book_suppliers s ON l.supplier_id = s.id
     WHERE l.id = $1
     LIMIT 1;`,
    [lotId]
  );

  if (lotRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy lô sách tương ứng.', 'LOT_NOT_FOUND');
  }

  const lotRow = lotRes.rows[0];

  const itemsRes = await db.query(
    `SELECT id, lot_id, title_id, book_title, isbn, cover_price, import_discount_percent,
            import_price, retail_price, initial_quantity, sold_quantity, returned_quantity,
            retained_quantity, available_quantity, created_at, updated_at
     FROM consignment_lot_items
     WHERE lot_id = $1
     ORDER BY created_at ASC;`,
    [lotId]
  );

  const items: ConsignmentLotItem[] = itemsRes.rows.map((row: any) => ({
    id: row.id,
    lotId: row.lot_id,
    titleId: row.title_id,
    bookTitle: row.book_title,
    isbn: row.isbn,
    coverPrice: Number(row.cover_price),
    importDiscountPercent: Number(row.import_discount_percent),
    importPrice: Number(row.import_price),
    retailPrice: Number(row.retail_price),
    initialQuantity: row.initial_quantity,
    soldQuantity: row.sold_quantity,
    returnedQuantity: row.returned_quantity,
    retainedQuantity: row.retained_quantity,
    availableQuantity: row.available_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    id: lotRow.id,
    batchCode: lotRow.batch_code,
    supplierId: lotRow.supplier_id,
    supplierName: lotRow.supplier_name,
    campaignName: lotRow.campaign_name,
    receivedDate: lotRow.received_date,
    targetSettlementDate: lotRow.target_settlement_date,
    depositAmount: Number(lotRow.deposit_amount),
    depositRefunded: Number(lotRow.deposit_refunded),
    depositStatus: lotRow.deposit_status,
    status: lotRow.status,
    createdBy: lotRow.created_by,
    notes: lotRow.notes,
    createdAt: lotRow.created_at,
    updatedAt: lotRow.updated_at,
    items,
  };
}

/**
 * 5. Danh sách các lô sách
 */
export async function listLots(db: Queryable, supplierId?: string): Promise<ConsignmentLot[]> {
  let query = `
    SELECT l.id, l.batch_code, l.supplier_id, s.name as supplier_name, l.campaign_name,
           l.received_date, l.target_settlement_date, l.deposit_amount, l.deposit_refunded,
           l.deposit_status, l.status, l.created_by, l.notes, l.created_at, l.updated_at
    FROM consignment_lots l
    JOIN book_suppliers s ON l.supplier_id = s.id
  `;
  const params: any[] = [];
  if (supplierId) {
    query += ` WHERE l.supplier_id = $1`;
    params.push(supplierId);
  }
  query += ` ORDER BY l.received_date DESC, l.created_at DESC;`;

  const result = await db.query(query, params);

  return result.rows.map((row: any) => ({
    id: row.id,
    batchCode: row.batch_code,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    campaignName: row.campaign_name,
    receivedDate: row.received_date,
    targetSettlementDate: row.target_settlement_date,
    depositAmount: Number(row.deposit_amount),
    depositRefunded: Number(row.deposit_refunded),
    depositStatus: row.deposit_status,
    status: row.status,
    createdBy: row.created_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * 6. Bán sách tại quầy (Record Book Sale)
 * Chặn tồn âm, chặn bán quá tồn, tính đúng đơn giá, ghi nhận tiền bán vào ca và quỹ vận hành.
 * Tuyệt đối không trừ vào bản sách cho mượn (book_copies).
 */
export async function recordBookSale(
  db: Queryable,
  dto: RecordSaleDto,
  actorId: string
): Promise<{ sale: BookSale; updatedItem: ConsignmentLotItem }> {
  if (!dto.lotItemId) {
    throw new BadRequestError('Dữ liệu bán sách không hợp lệ: thiếu ID dòng sách.', 'INVALID_SALE_DATA');
  }

  // 1. Kiểm tra điều kiện thực thu (P22-04: Không cho khách mua nợ, không tự coi PAID chỉ vì gọi API)
  if (dto.paymentConfirmed !== true) {
    throw new BadRequestError(
      'Giao dịch bán sách yêu cầu xác nhận đã thu tiền thực tế (không cho khách mua nợ).',
      'PAYMENT_CONFIRMATION_REQUIRED'
    );
  }

  // 1b. Kiểm tra phương thức thanh toán hợp lệ
  if (!dto.paymentMethod || (dto.paymentMethod !== 'CASH' && dto.paymentMethod !== 'BANK_TRANSFER')) {
    throw new BadRequestError(
      'Phương thức thanh toán không hợp lệ (bắt buộc CASH hoặc BANK_TRANSFER).',
      'INVALID_PAYMENT_METHOD'
    );
  }

  // 2. Kiểm tra số lượng hợp lệ (nguyên dương, an toàn)
  if (!Number.isInteger(dto.quantity) || dto.quantity <= 0 || !Number.isSafeInteger(dto.quantity)) {
    throw new BadRequestError('Số lượng bán phải là số nguyên dương hợp lệ.', 'INVALID_SALE_QUANTITY');
  }

  // 3. Xử lý Idempotency nếu có key
  let idempotencyClaimed = false;
  if (dto.idempotencyKey) {
    const payloadHash = computePayloadHash({
      lotItemId: dto.lotItemId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      paymentMethod: dto.paymentMethod,
      customerName: dto.customerName?.trim() || null,
      saleDiscountPercent: dto.saleDiscountPercent ?? 0,
    });
    const claim = await claimIdempotency(db, actorId, 'SELL_BOOK', dto.idempotencyKey, payloadHash);
    if (claim.action === 'RETURN_CACHED' && claim.responseBody) {
      return claim.responseBody as { sale: BookSale; updatedItem: ConsignmentLotItem };
    }
    idempotencyClaimed = true;
  }

  // 4. Nếu thanh toán tiền mặt và có cashSessionId, xác nhận ca còn mở
  if (dto.paymentMethod === 'CASH' && dto.cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1`,
      [dto.cashSessionId]
    );
    if (!sRes.rows || sRes.rows.length === 0 || sRes.rows[0].is_closed) {
      throw new BadRequestError('Phiên quầy tiền mặt chỉ định không tồn tại hoặc đã đóng.', 'SESSION_CLOSED');
    }
  }

  // 5. Đọc ID lô và khóa bảng consignment_lots TRƯỚC (thứ tự khóa nhất quán: Lot -> Items)
  const itemCheck = await db.query(
    `SELECT lot_id FROM consignment_lot_items WHERE id = $1;`,
    [dto.lotItemId]
  );
  if (itemCheck.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy đầu sách trong lô.', 'LOT_ITEM_NOT_FOUND');
  }
  const lotId = itemCheck.rows[0].lot_id;

  const lotRes = await db.query(
    `SELECT id, status FROM consignment_lots WHERE id = $1 FOR UPDATE;`,
    [lotId]
  );
  if (lotRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy lô sách tương ứng.', 'LOT_NOT_FOUND');
  }
  if (lotRes.rows[0].status === 'SETTLED') {
    throw new BadRequestError('Lô sách đã quyết toán đóng, không thể bán thêm.', 'LOT_ALREADY_SETTLED');
  }

  // Khóa dòng sách
  const itemRes = await db.query(
    `SELECT id, lot_id, book_title, retail_price, initial_quantity,
            sold_quantity, returned_quantity, retained_quantity, available_quantity
     FROM consignment_lot_items
     WHERE id = $1
     FOR UPDATE;`,
    [dto.lotItemId]
  );
  const item = itemRes.rows[0];

  // Kiểm tra tồn khả dụng
  if (item.available_quantity < dto.quantity) {
    throw new ConflictError(
      `Không đủ số lượng khả dụng để bán (yêu cầu: ${dto.quantity}, khả dụng: ${item.available_quantity}).`,
      'INSUFFICIENT_STOCK'
    );
  }

  // 6. Tính giá bán thực tế và kiểm tra giới hạn tiền an toàn VND
  const rawUnitPrice = dto.unitPrice !== undefined ? dto.unitPrice : Number(item.retail_price);
  const safeUnitPrice = assertSafeVndAmount(rawUnitPrice, { allowZero: true });
  const discountPercent = Math.max(0, Math.min(100, dto.saleDiscountPercent ?? 0));
  const effectiveUnitPrice = Math.round(Number(safeUnitPrice) * (1 - discountPercent / 100));
  const totalAmountNum = effectiveUnitPrice * dto.quantity;
  const safeTotalAmount = assertSafeVndAmount(totalAmountNum);

  const saleCode = `SALE-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // 7. Ghi nhận giao dịch bán
  const saleRes = await db.query(
    `INSERT INTO book_sales (
       sale_code, lot_item_id, cash_session_id, customer_name, customer_phone,
       quantity, unit_price, sale_discount_percent, total_amount, payment_method,
       payment_status, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PAID', $11)
     RETURNING id, sale_code, lot_item_id, cash_session_id, customer_name, customer_phone,
               quantity, unit_price, sale_discount_percent, total_amount, payment_method,
               payment_status, created_by, created_at;`,
    [
      saleCode,
      dto.lotItemId,
      dto.cashSessionId || null,
      dto.customerName?.trim() || null,
      dto.customerPhone?.trim() || null,
      dto.quantity,
      effectiveUnitPrice,
      discountPercent,
      Number(safeTotalAmount),
      dto.paymentMethod,
      actorId,
    ]
  );

  // 8. Cập nhật tồn kho dòng sách: giảm available, tăng sold
  const updateRes = await db.query(
    `UPDATE consignment_lot_items
     SET available_quantity = available_quantity - $1,
         sold_quantity = sold_quantity + $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, lot_id, title_id, book_title, isbn, cover_price, import_discount_percent,
               import_price, retail_price, initial_quantity, sold_quantity, returned_quantity,
               retained_quantity, available_quantity, created_at, updated_at;`,
    [dto.quantity, dto.lotItemId]
  );

  const updatedItemRow = updateRes.rows[0];
  const saleRow = saleRes.rows[0];

  // 9. Hạch toán sổ kép vào Sổ Cái (Quỹ Hoạt Động - FUND_OPERATION) (P22-04)
  // Tuyệt đối KHÔNG cộng vào két mượn-trả (FUND_LOAN)
  const debitAccount = dto.paymentMethod === 'BANK_TRANSFER' ? ACCOUNT_CODES.BANK_MAIN : ACCOUNT_CODES.CASH_DRAWER;
  const cleanCode = saleRow.sale_code.replace(/[^a-zA-Z0-9]/g, '');
  const entryCode = `JE-SALE-${cleanCode.slice(-25)}`;

  await recordJournalEntry(db, {
    entryCode,
    fundId: FUND_IDS.OPERATION,
    sourceType: 'BOOK_SALE',
    sourceId: saleRow.id,
    debitAccount,
    creditAccount: ACCOUNT_CODES.BOOK_SALES_REVENUE,
    amount: safeTotalAmount,
    createdBy: actorId,
    notes: `Bán lẻ ${dto.quantity} cuốn '${item.book_title}' (${saleRow.sale_code})`,
  });

  const sale: BookSale = {
    id: saleRow.id,
    saleCode: saleRow.sale_code,
    lotItemId: saleRow.lot_item_id,
    cashSessionId: saleRow.cash_session_id,
    customerName: saleRow.customer_name,
    customerPhone: saleRow.customer_phone,
    quantity: saleRow.quantity,
    unitPrice: Number(saleRow.unit_price),
    saleDiscountPercent: Number(saleRow.sale_discount_percent),
    totalAmount: Number(saleRow.total_amount),
    paymentMethod: saleRow.payment_method,
    paymentStatus: saleRow.payment_status,
    createdBy: saleRow.created_by,
    createdAt: saleRow.created_at,
    bookTitle: item.book_title,
  };

  const updatedItem: ConsignmentLotItem = {
    id: updatedItemRow.id,
    lotId: updatedItemRow.lot_id,
    titleId: updatedItemRow.title_id,
    bookTitle: updatedItemRow.book_title,
    isbn: updatedItemRow.isbn,
    coverPrice: Number(updatedItemRow.cover_price),
    importDiscountPercent: Number(updatedItemRow.import_discount_percent),
    importPrice: Number(updatedItemRow.import_price),
    retailPrice: Number(updatedItemRow.retail_price),
    initialQuantity: updatedItemRow.initial_quantity,
    soldQuantity: updatedItemRow.sold_quantity,
    returnedQuantity: updatedItemRow.returned_quantity,
    retainedQuantity: updatedItemRow.retained_quantity,
    availableQuantity: updatedItemRow.available_quantity,
    createdAt: updatedItemRow.created_at,
    updatedAt: updatedItemRow.updated_at,
  };

  const responseResult = { sale, updatedItem };

  if (idempotencyClaimed && dto.idempotencyKey) {
    await completeIdempotency(db, actorId, 'SELL_BOOK', dto.idempotencyKey, 200, responseResult);
  }

  return responseResult;
}

/**
 * 7. Trả sách dư vật lý về nhà sách (Physical Returns)
 * Giảm available_quantity, tăng returned_quantity.
 * Ghi nhận chứng từ consignment_returns.
 * QUY TẮC CỐT LÕI (T56, T59): Trả vật lý KHÔNG tự động xác nhận tiền hoàn ngân hàng.
 */
export async function returnUnsoldBooks(
  db: Queryable,
  lotId: string,
  dto: ReturnBooksDto,
  actorId: string
): Promise<{ returnReceipt: ConsignmentReturn; updatedItem: ConsignmentLotItem }> {
  if (!dto.lotItemId || dto.returnedQuantity <= 0) {
    throw new BadRequestError('Dữ liệu trả sách không hợp lệ.', 'INVALID_RETURN_DATA');
  }

  // 1. Khóa bảng consignment_lots TRƯỚC (thứ tự khóa nhất quán: Lot -> Items)
  const lotRes = await db.query(
    `SELECT id, status FROM consignment_lots WHERE id = $1 FOR UPDATE;`,
    [lotId]
  );
  if (lotRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy lô sách tương ứng.', 'LOT_NOT_FOUND');
  }
  if (lotRes.rows[0].status === 'SETTLED') {
    throw new BadRequestError('Lô sách đã quyết toán đóng, không thể trả sách.', 'LOT_ALREADY_SETTLED');
  }

  // 2. Đọc và khóa dòng sách
  const itemRes = await db.query(
    `SELECT id, lot_id, available_quantity, returned_quantity
     FROM consignment_lot_items
     WHERE id = $1 AND lot_id = $2
     FOR UPDATE;`,
    [dto.lotItemId, lotId]
  );

  if (itemRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy dòng sách trong lô chỉ định.', 'LOT_ITEM_NOT_FOUND');
  }

  const item = itemRes.rows[0];

  if (item.available_quantity < dto.returnedQuantity) {
    throw new ConflictError(
      `Không thể trả vượt quá số lượng còn khả dụng (yêu cầu: ${dto.returnedQuantity}, khả dụng: ${item.available_quantity}).`,
      'EXCEED_AVAILABLE_RETURN'
    );
  }

  const returnCode = `RET-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // 2. Ghi nhận chứng từ trả sách vật lý
  const retRes = await db.query(
    `INSERT INTO consignment_returns (
       return_code, lot_id, lot_item_id, returned_quantity, return_date,
       recipient_name, proof_notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, return_code, lot_id, lot_item_id, returned_quantity, return_date,
               recipient_name, proof_notes, created_by, created_at;`,
    [
      returnCode,
      lotId,
      dto.lotItemId,
      dto.returnedQuantity,
      dto.returnDate,
      dto.recipientName?.trim() || null,
      dto.proofNotes?.trim() || null,
      actorId,
    ]
  );

  // 3. Cập nhật tồn kho dòng sách: giảm available, tăng returned
  const updateRes = await db.query(
    `UPDATE consignment_lot_items
     SET available_quantity = available_quantity - $1,
         returned_quantity = returned_quantity + $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, lot_id, title_id, book_title, isbn, cover_price, import_discount_percent,
               import_price, retail_price, initial_quantity, sold_quantity, returned_quantity,
               retained_quantity, available_quantity, created_at, updated_at;`,
    [dto.returnedQuantity, dto.lotItemId]
  );

  const updatedItemRow = updateRes.rows[0];
  const retRow = retRes.rows[0];

  return {
    returnReceipt: {
      id: retRow.id,
      returnCode: retRow.return_code,
      lotId: retRow.lot_id,
      lotItemId: retRow.lot_item_id,
      returnedQuantity: retRow.returned_quantity,
      returnDate: retRow.return_date,
      recipientName: retRow.recipient_name,
      proofNotes: retRow.proof_notes,
      createdBy: retRow.created_by,
      createdAt: retRow.created_at,
    },
    updatedItem: {
      id: updatedItemRow.id,
      lotId: updatedItemRow.lot_id,
      titleId: updatedItemRow.title_id,
      bookTitle: updatedItemRow.book_title,
      isbn: updatedItemRow.isbn,
      coverPrice: Number(updatedItemRow.cover_price),
      importDiscountPercent: Number(updatedItemRow.import_discount_percent),
      importPrice: Number(updatedItemRow.import_price),
      retailPrice: Number(updatedItemRow.retail_price),
      initialQuantity: updatedItemRow.initial_quantity,
      soldQuantity: updatedItemRow.sold_quantity,
      returnedQuantity: updatedItemRow.returned_quantity,
      retainedQuantity: updatedItemRow.retained_quantity,
      availableQuantity: updatedItemRow.available_quantity,
      createdAt: updatedItemRow.created_at,
      updatedAt: updatedItemRow.updated_at,
    },
  };
}

/**
 * 8. Giữ lại sách để tiếp tục bán đợt sau (Retain Books)
 * Giảm available_quantity, tăng retained_quantity.
 */
export async function retainBooksForNextPeriod(
  db: Queryable,
  lotId: string,
  dto: RetainBooksDto,
  _actorId: string
): Promise<ConsignmentLotItem> {
  if (!dto.lotItemId || dto.retainedQuantity <= 0) {
    throw new BadRequestError('Dữ liệu giữ sách không hợp lệ.', 'INVALID_RETAIN_DATA');
  }

  // 1. Khóa bảng consignment_lots TRƯỚC (thứ tự khóa nhất quán: Lot -> Items)
  const lotRes = await db.query(
    `SELECT id, status FROM consignment_lots WHERE id = $1 FOR UPDATE;`,
    [lotId]
  );
  if (lotRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy lô sách tương ứng.', 'LOT_NOT_FOUND');
  }
  if (lotRes.rows[0].status === 'SETTLED') {
    throw new BadRequestError('Lô sách đã quyết toán đóng, không thể giữ sách cho đợt sau.', 'LOT_ALREADY_SETTLED');
  }

  const itemRes = await db.query(
    `SELECT id, available_quantity, retained_quantity
     FROM consignment_lot_items
     WHERE id = $1 AND lot_id = $2
     FOR UPDATE;`,
    [dto.lotItemId, lotId]
  );

  if (itemRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy dòng sách trong lô chỉ định.', 'LOT_ITEM_NOT_FOUND');
  }

  const item = itemRes.rows[0];

  if (item.available_quantity < dto.retainedQuantity) {
    throw new ConflictError(
      `Không thể giữ lại vượt quá số lượng còn khả dụng (yêu cầu: ${dto.retainedQuantity}, khả dụng: ${item.available_quantity}).`,
      'EXCEED_AVAILABLE_RETAIN'
    );
  }

  const updateRes = await db.query(
    `UPDATE consignment_lot_items
     SET available_quantity = available_quantity - $1,
         retained_quantity = retained_quantity + $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, lot_id, title_id, book_title, isbn, cover_price, import_discount_percent,
               import_price, retail_price, initial_quantity, sold_quantity, returned_quantity,
               retained_quantity, available_quantity, created_at, updated_at;`,
    [dto.retainedQuantity, dto.lotItemId]
  );

  const r = updateRes.rows[0];
  return {
    id: r.id,
    lotId: r.lot_id,
    titleId: r.title_id,
    bookTitle: r.book_title,
    isbn: r.isbn,
    coverPrice: Number(r.cover_price),
    importDiscountPercent: Number(r.import_discount_percent),
    importPrice: Number(r.import_price),
    retailPrice: Number(r.retail_price),
    initialQuantity: r.initial_quantity,
    soldQuantity: r.sold_quantity,
    returnedQuantity: r.returned_quantity,
    retainedQuantity: r.retained_quantity,
    availableQuantity: r.available_quantity,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
