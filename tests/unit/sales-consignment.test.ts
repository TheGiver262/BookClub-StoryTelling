/**
-- =====================================================================
-- Unit Tests: Stage 18 - Lô Sách Mới, Bán / Trả Dư và Quyết Toán Nhà Sách
-- Nghiệp vụ: FR-05, R04, R07 (sales), D44-D49, D56, T56, T58, T59, T60, T68, T69
-- Gates:
--   1. Bảo toàn lượng lô sách: 100 = 60 bán + 40 trả, khả dụng = 0, khớp đúng invariant
--   2. Chặn bán quá tồn / âm tồn (ConflictError 409)
--   3. Trả hàng vật lý không tự động xác nhận hoàn tiền ngân hàng
--   4. Gate T68: Lô 100 cuốn giá nhập 65k không cọc; bán 60/trả 40 -> trả 3.9tr, KHÔNG hoàn 2.6tr
--   5. Gate T69: Lô có cọc 1tr -> nhận hoàn 1tr riêng, trả 3.9tr riêng; không gộp 2.9tr; lãi gộp 900k
--   6. Idempotency & chống thanh toán trùng / trả vượt quá nợ nhà sách (T60)
--   7. Cọc nhà sách tách biệt hoàn toàn cọc bạn đọc (T58)
-- =====================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  createSupplier,
  getSuppliers,
  createLot,
  getLotDetails,
  recordBookSale,
  returnUnsoldBooks,
  retainBooksForNextPeriod,
} from '../../src/modules/sales/lot-inventory.ts';
import {
  calculateLotSettlement,
  createSettlement,
  recordSupplierPayment,
  getSettlementByLotId,
} from '../../src/modules/sales/settlement.ts';
import { ConflictError, BadRequestError } from '../../src/server/errors.ts';
import { ACCOUNT_CODES, FUND_IDS } from '../../src/server/finance/types.ts';

describe('Stage 18: Lô Sách Mới, Bán / Trả Dư và Quyết Toán Nhà Sách', () => {
  const actorId = '00000000-0000-0000-0000-000000000001';

  it('Gate 1 & Gate 2: Tạo lô 100 cuốn, bán 60 cuốn, kiểm tra invariant và chặn bán quá tồn', async () => {
    const db = new MockCashDbQueryable();

    // 1. Tạo nhà sách
    const supplier = await createSupplier(db, {
      code: 'NHA_NAM',
      name: 'Nhà sách Nhã Nam',
      contactPerson: 'Nguyễn Văn A',
      phone: '0901234567',
    });
    assert.equal(supplier.code, 'NHA_NAM');

    const allSups = await getSuppliers(db);
    assert.equal(allSups.length, 1);
    assert.equal(allSups[0].code, 'NHA_NAM');

    // 2. Tạo lô sách: 100 cuốn "Tuổi trẻ đáng giá bao nhiêu", giá bìa 80k, chiết khấu 18.75% -> giá nhập 65k
    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-2026-001',
        supplierId: supplier.id,
        campaignName: 'Hội sách Mùa Thu 2026',
        receivedDate: '2026-10-15',
        depositAmount: 0, // Không cọc
        items: [
          {
            bookTitle: 'Tuổi trẻ đáng giá bao nhiêu',
            isbn: '978-604-1-12345-6',
            coverPrice: 80_000,
            importDiscountPercent: 18.75,
            importPrice: 65_000, // Giá nhập sau chiết khấu
            retailPrice: 80_000, // Giá bán tại quầy
            initialQuantity: 100,
          },
        ],
      },
      actorId
    );

    assert.equal(lot.batchCode, 'LOT-2026-001');
    assert.equal(lot.depositAmount, 0);
    assert.equal(lot.depositStatus, 'NONE');
    assert.equal(lot.items?.length, 1);
    const item = lot.items![0];
    assert.equal(item.initialQuantity, 100);
    assert.equal(item.availableQuantity, 100);
    assert.equal(item.soldQuantity, 0);

    // 3. Bán 60 cuốn (thanh toán tiền mặt hoặc chuyển khoản)
    const { sale, updatedItem } = await recordBookSale(
      db,
      {
        lotItemId: item.id,
        quantity: 60,
        paymentMethod: 'CASH',
        customerName: 'Bạn đọc Nguyễn B',
        paymentConfirmed: true,
      },
      actorId
    );

    assert.equal(sale.quantity, 60);
    assert.equal(sale.totalAmount, 60 * 80_000); // 4,800,000 VND
    assert.equal(updatedItem.soldQuantity, 60);
    assert.equal(updatedItem.availableQuantity, 40);

    // Kiểm tra Invariant: initial = sold + returned + retained + available
    assert.equal(
      updatedItem.initialQuantity,
      updatedItem.soldQuantity + updatedItem.returnedQuantity + updatedItem.retainedQuantity + updatedItem.availableQuantity
    );

    // 4. Chặn bán quá tồn: cố bán 41 cuốn khi chỉ còn 40 cuốn
    await assert.rejects(
      async () => {
        await recordBookSale(
          db,
          {
            lotItemId: item.id,
            quantity: 41,
            paymentMethod: 'BANK_TRANSFER',
            paymentConfirmed: true,
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof ConflictError);
        assert.equal(err.errorCode, 'INSUFFICIENT_STOCK');
        return true;
      }
    );

    // Đảm bảo số lượng không bị thay đổi sau khi bị từ chối
    const details = await getLotDetails(db, lot.id);
    assert.equal(details.items![0].availableQuantity, 40);
  });

  it('Gate 3: Trả 40 cuốn dư về nhà sách (T56, T59) - Không tự động xác nhận hoàn tiền ngân hàng', async () => {
    const db = new MockCashDbQueryable();

    const supplier = await createSupplier(db, {
      code: 'KIM_DONG',
      name: 'NXB Kim Đồng',
    });

    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-KIMDONG-01',
        supplierId: supplier.id,
        campaignName: 'Tháng Thanh Niên',
        receivedDate: '2026-10-10',
        depositAmount: 0,
        items: [
          {
            bookTitle: 'Dế Mèn Phiêu Lưu Ký',
            coverPrice: 50_000,
            importDiscountPercent: 20,
            importPrice: 40_000,
            retailPrice: 50_000,
            initialQuantity: 100,
          },
        ],
      },
      actorId
    );

    const itemId = lot.items![0].id;

    // Bán 60 cuốn
    await recordBookSale(
      db,
      {
        lotItemId: itemId,
        quantity: 60,
        paymentMethod: 'CASH',
        paymentConfirmed: true,
      },
      actorId
    );

    // Trả 40 cuốn dư vật lý về nhà sách
    const { returnReceipt, updatedItem } = await returnUnsoldBooks(
      db,
      lot.id,
      {
        lotItemId: itemId,
        returnedQuantity: 40,
        returnDate: '2026-10-18',
        recipientName: 'Đại diện NXB Kim Đồng',
        proofNotes: 'Biên bản bàn giao số 102/BBBG',
      },
      actorId
    );

    assert.equal(returnReceipt.returnedQuantity, 40);
    assert.equal(returnReceipt.recipientName, 'Đại diện NXB Kim Đồng');
    assert.equal(updatedItem.returnedQuantity, 40);
    assert.equal(updatedItem.availableQuantity, 0); // Đã hết khả dụng

    // Kiểm tra Invariant: 100 = 60 + 40 + 0 + 0
    assert.equal(
      updatedItem.initialQuantity,
      updatedItem.soldQuantity + updatedItem.returnedQuantity + updatedItem.retainedQuantity + updatedItem.availableQuantity
    );

    // Ràng buộc T56/T59: Trả hàng vật lý chỉ ghi nhận số lượng trả, KHÔNG tự động sinh bút toán hoàn tiền
    const returnJournals = db.journalEntries.filter((j: any) => j.source_type === 'CONSIGNMENT_RETURN');
    assert.equal(returnJournals.length, 0);
  });

  it('Gate 4 (Gate T68): Lô 100 cuốn giá nhập 65k, không cọc; bán 60/trả 40 -> trả 3.9tr, KHÔNG hoàn 2.6tr', async () => {
    const db = new MockCashDbQueryable();

    const supplier = await createSupplier(db, {
      code: 'FAHASA',
      name: 'Nhà sách Fahasa',
    });

    // Lô 100 cuốn giá nhập 65k, giá bán 80k, không cọc (depositAmount = 0)
    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-T68-01',
        supplierId: supplier.id,
        campaignName: 'Bán sách Ký gửi T68',
        receivedDate: '2026-10-01',
        depositAmount: 0, // Không cọc
        items: [
          {
            bookTitle: 'Sách T68',
            coverPrice: 80_000,
            importDiscountPercent: 18.75,
            importPrice: 65_000,
            retailPrice: 80_000,
            initialQuantity: 100,
          },
        ],
      },
      actorId
    );

    const itemId = lot.items![0].id;

    // Bán 60 cuốn
    await recordBookSale(
      db,
      {
        lotItemId: itemId,
        quantity: 60,
        paymentMethod: 'CASH',
        paymentConfirmed: true,
      },
      actorId
    );

    // Trả 40 cuốn
    await returnUnsoldBooks(
      db,
      lot.id,
      {
        lotItemId: itemId,
        returnedQuantity: 40,
        returnDate: '2026-10-18',
      },
      actorId
    );

    // Tính toán quyết toán (Preview Calculation)
    const calc = await calculateLotSettlement(db, lot.id);

    assert.equal(calc.totalSoldBooks, 60);
    assert.equal(calc.totalReturnedBooks, 40);
    assert.equal(calc.totalRevenue, 60 * 80_000); // 4,800,000 VND
    assert.equal(calc.payableToSupplier, 60 * 65_000); // 3,900,000 VND (3.9 triệu)
    assert.equal(calc.grossProfit, 4_800_000 - 3_900_000); // 900,000 VND

    // QUY TẮC CỐT LÕI T68: Không cọc thì KHÔNG có khoản hoàn 2.6 triệu (40 cuốn * 65k)
    assert.equal(calc.depositPaid, 0);
    assert.equal(calc.depositRefundExpected, 0); // Đúng 0đ, không sinh hoàn 2.6tr giả định!

    // Lập chứng từ quyết toán
    const settlement = await createSettlement(
      db,
      {
        lotId: lot.id,
        notes: 'Quyết toán lô T68 theo đúng số lượng bán 60 trả 40',
        idempotencyKey: 'IDEMP-SETTLE-T68',
      },
      actorId
    );

    assert.equal(settlement.totalRevenue, 4_800_000);
    assert.equal(settlement.payableToSupplier, 3_900_000);
    assert.equal(settlement.depositRefundExpected, 0);
    assert.equal(settlement.paymentStatus, 'UNPAID');

    // Thanh toán 3.9 triệu cho nhà sách
    const { payment, settlement: updatedSettle } = await recordSupplierPayment(
      db,
      settlement.id,
      {
        paymentType: 'PAY_SUPPLIER_PAYABLE',
        amount: 3_900_000,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        referenceDoc: 'UNC-3900K-01',
      },
      actorId
    );

    assert.equal(payment.amount, 3_900_000);
    assert.equal(updatedSettle.paidToSupplier, 3_900_000);
    assert.equal(updatedSettle.paymentStatus, 'PAID');

    // Thử nhận hoàn cọc trên lô không có cọc: Phải bị từ chối
    await assert.rejects(
      async () => {
        await recordSupplierPayment(
          db,
          settlement.id,
          {
            paymentType: 'RECEIVE_DEPOSIT_REFUND',
            amount: 2_600_000,
            paymentMethod: 'BANK_TRANSFER',
            paymentConfirmed: true,
            referenceDoc: 'UNC-REF-01',
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof BadRequestError);
        assert.equal(err.errorCode, 'NO_DEPOSIT_TO_REFUND');
        return true;
      }
    );
  });

  it('Gate 5 (Gate T69): Lô có cọc 1 triệu; nhận hoàn cọc 1tr riêng, trả 3.9tr riêng; không gộp 2.9tr; lãi gộp 900k', async () => {
    const db = new MockCashDbQueryable();

    const supplier = await createSupplier(db, {
      code: 'TRI_THUC',
      name: 'NXB Tri Thức',
    });

    // Lô 100 cuốn giá nhập 65k, bán 80k; CÓ CỌC TRƯỚC 1.000.000 VND
    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-T69-01',
        supplierId: supplier.id,
        campaignName: 'Ký gửi có cọc T69',
        receivedDate: '2026-10-01',
        depositAmount: 1_000_000,
        depositPaymentConfirmed: true,
        depositPaymentMethod: 'BANK_TRANSFER', // Cọc trước 1 triệu
        items: [
          {
            bookTitle: 'Sách Tri Thức T69',
            coverPrice: 80_000,
            importDiscountPercent: 18.75,
            importPrice: 65_000,
            retailPrice: 80_000,
            initialQuantity: 100,
          },
        ],
      },
      actorId
    );

    assert.equal(lot.depositAmount, 1_000_000);
    assert.equal(lot.depositStatus, 'PAID');

    const itemId = lot.items![0].id;

    // Bán 60 cuốn
    await recordBookSale(
      db,
      {
        lotItemId: itemId,
        quantity: 60,
        paymentMethod: 'CASH',
        paymentConfirmed: true,
      },
      actorId
    );

    // Trả 40 cuốn
    await returnUnsoldBooks(
      db,
      lot.id,
      {
        lotItemId: itemId,
        returnedQuantity: 40,
        returnDate: '2026-10-18',
      },
      actorId
    );

    // Lập quyết toán
    const settlement = await createSettlement(
      db,
      {
        lotId: lot.id,
        idempotencyKey: 'IDEMP-SETTLE-T69',
      },
      actorId
    );

    assert.equal(settlement.totalRevenue, 4_800_000); // Doanh thu bán sách: 4.8tr
    assert.equal(settlement.payableToSupplier, 3_900_000); // Tiền nợ sách: 3.9tr
    assert.equal(settlement.grossProfit, 900_000); // Lãi gộp: 900k
    assert.equal(settlement.depositPaid, 1_000_000); // Đã cọc: 1tr
    assert.equal(settlement.depositRefundExpected, 1_000_000); // Kỳ vọng hoàn cọc: 1tr
    assert.equal(settlement.depositRefundStatus, 'PENDING');

    // QUY TẮC CỐT LÕI T69:
    // 1) Nhà sách hoàn cọc riêng 1 triệu
    const refundRes = await recordSupplierPayment(
      db,
      settlement.id,
      {
        paymentType: 'RECEIVE_DEPOSIT_REFUND',
        amount: 1_000_000,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        referenceDoc: 'NGANHANG-HOANCOC-1TR',
        notes: 'Nhà sách hoàn lại tiền cọc ban đầu',
      },
      actorId
    );

    assert.equal(refundRes.payment.amount, 1_000_000);
    assert.equal(refundRes.settlement.depositRefundReceived, 1_000_000);
    assert.equal(refundRes.settlement.depositRefundStatus, 'RECEIVED');
    // Tuyệt đối không thay đổi số nợ sách phải thanh toán (vẫn nguyên 3.9 triệu)
    assert.equal(refundRes.settlement.paidToSupplier, 0);

    // 2) CLB thanh toán riêng 3.9 triệu cho nhà sách
    const payRes = await recordSupplierPayment(
      db,
      settlement.id,
      {
        paymentType: 'PAY_SUPPLIER_PAYABLE',
        amount: 3_900_000,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        referenceDoc: 'UNC-THANHTOAN-3TR9',
        notes: 'CLB thanh toán 60 cuốn sách đã bán',
      },
      actorId
    );

    assert.equal(payRes.payment.amount, 3_900_000);
    assert.equal(payRes.settlement.paidToSupplier, 3_900_000);
    assert.equal(payRes.settlement.paymentStatus, 'PAID');

    // Không gộp một khoản chi ròng 2.9 triệu thay thế
    const history = await getSettlementByLotId(db, lot.id);
    assert.equal(history.payments.length, 2);
    assert.equal(history.payments[0].paymentType, 'RECEIVE_DEPOSIT_REFUND');
    assert.equal(history.payments[0].amount, 1_000_000);
    assert.equal(history.payments[1].paymentType, 'PAY_SUPPLIER_PAYABLE');
    assert.equal(history.payments[1].amount, 3_900_000);
  });

  it('Gate 6: Idempotency chống quyết toán trùng & chặn thanh toán vượt nợ (T60)', async () => {
    const db = new MockCashDbQueryable();

    const supplier = await createSupplier(db, {
      code: 'TRE',
      name: 'NXB Trẻ',
    });

    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-TRE-01',
        supplierId: supplier.id,
        campaignName: 'Hội sách Mùa Hè',
        receivedDate: '2026-06-01',
        depositAmount: 500_000,
        items: [
          {
            bookTitle: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
            coverPrice: 100_000,
            importDiscountPercent: 30,
            importPrice: 70_000,
            retailPrice: 100_000,
            initialQuantity: 50,
          },
        ],
      },
      actorId
    );

    // Bán 10 cuốn -> nợ 700k
    await recordBookSale(
      db,
      {
        lotItemId: lot.items![0].id,
        quantity: 10,
        paymentMethod: 'CASH',
        paymentConfirmed: true,
      },
      actorId
    );

    // Lập quyết toán lần 1
    const settle1 = await createSettlement(
      db,
      {
        lotId: lot.id,
        idempotencyKey: 'IDEMP-SETTLE-UNIQUE',
      },
      actorId
    );

    // Lập quyết toán lần 2 với cùng key: Trả về kết quả cũ an toàn (Idempotent)
    const settle2 = await createSettlement(
      db,
      {
        lotId: lot.id,
        idempotencyKey: 'IDEMP-SETTLE-UNIQUE',
      },
      actorId
    );

    assert.equal(settle1.id, settle2.id);
    assert.equal(db.consignmentSettlements.length, 1);

    // Chặn trả vượt quá số nợ (Nợ 700k mà thanh toán 800k)
    await assert.rejects(
      async () => {
        await recordSupplierPayment(
          db,
          settle1.id,
          {
            paymentType: 'PAY_SUPPLIER_PAYABLE',
            amount: 800_000,
            paymentMethod: 'BANK_TRANSFER',
            paymentConfirmed: true,
            referenceDoc: 'UNC-OVERPAY-01',
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof ConflictError);
        assert.equal(err.errorCode, 'OVERPAYMENT_NOT_ALLOWED');
        return true;
      }
    );

    // Chặn nhận hoàn cọc vượt quá số cọc (Cọc 500k mà nhận 600k)
    await assert.rejects(
      async () => {
        await recordSupplierPayment(
          db,
          settle1.id,
          {
            paymentType: 'RECEIVE_DEPOSIT_REFUND',
            amount: 600_000,
            paymentMethod: 'BANK_TRANSFER',
            paymentConfirmed: true,
            referenceDoc: 'UNC-EXCEED-01',
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof ConflictError);
        assert.equal(err.errorCode, 'EXCEED_DEPOSIT_REFUND');
        return true;
      }
    );
  });

  it('Gate 7: Giữ lại sách bán tiếp đợt sau và cọc nhà sách tách biệt cọc bạn đọc (T58)', async () => {
    const db = new MockCashDbQueryable();

    const supplier = await createSupplier(db, {
      code: 'PHU_NU',
      name: 'NXB Phụ Nữ',
    });

    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-PHUNU-01',
        supplierId: supplier.id,
        campaignName: 'Ngày Phụ Nữ 20/10',
        receivedDate: '2026-10-15',
        depositAmount: 200_000,
        items: [
          {
            bookTitle: 'Cổ tích màu hồng',
            coverPrice: 60_000,
            importDiscountPercent: 25,
            importPrice: 45_000,
            retailPrice: 60_000,
            initialQuantity: 20,
          },
        ],
      },
      actorId
    );

    const itemId = lot.items![0].id;

    // Bán 5 cuốn, giữ lại 10 cuốn bán đợt sau, trả 5 cuốn
    await recordBookSale(db, { lotItemId: itemId, quantity: 5, paymentMethod: 'CASH', paymentConfirmed: true }, actorId);
    await retainBooksForNextPeriod(db, lot.id, { lotItemId: itemId, retainedQuantity: 10 }, actorId);
    await returnUnsoldBooks(db, lot.id, { lotItemId: itemId, returnedQuantity: 5, returnDate: '2026-10-19' }, actorId);

    const details = await getLotDetails(db, lot.id);
    const item = details.items![0];

    assert.equal(item.soldQuantity, 5);
    assert.equal(item.retainedQuantity, 10);
    assert.equal(item.returnedQuantity, 5);
    assert.equal(item.availableQuantity, 0);
    // Invariant: 20 = 5 + 5 + 10 + 0
    assert.equal(item.initialQuantity, item.soldQuantity + item.returnedQuantity + item.retainedQuantity + item.availableQuantity);

    // Cọc bạn đọc giả định trong hệ thống
    db.depositAllocations.push({
      id: 'dep-reader-01',
      reader_name: 'Bạn đọc K68',
      amount: 50_000,
      status: 'HELD',
    });

    // Quyết toán lô
    const settlement = await createSettlement(db, { lotId: lot.id }, actorId);

    // Nhận hoàn cọc nhà sách 200k
    await recordSupplierPayment(
      db,
      settlement.id,
      {
        paymentType: 'RECEIVE_DEPOSIT_REFUND',
        amount: 200_000,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        referenceDoc: 'UNC-REFUND-200K',
      },
      actorId
    );

    // Ràng buộc T58: Cọc nhà sách được hoàn 200k không hề làm giảm hoặc thay đổi cọc bạn đọc (50k)
    assert.equal(db.depositAllocations.length, 1);
    assert.equal(db.depositAllocations[0].amount, 50_000);
    assert.equal(db.depositAllocations[0].status, 'HELD');
  });

  it('Regression P22-04 (Mandatory 2): Nhận 100 cuốn, nhập 65k, bán 60 giá 80k, trả 40: thu 4,8tr; nợ 3,9tr; lãi gộp 900k; tồn/lô và ledger khớp; cọc 1tr hoàn riêng và thanh toán 3,9tr riêng', async () => {
    const db = new MockCashDbQueryable();

    // 1. Tạo nhà sách
    const supplier = await createSupplier(db, {
      code: 'TRE_PUB',
      name: 'NXB Trẻ',
    });

    // 2. Nhận 100 cuốn, nhập 65k (cover 80k, discount 18.75%), bán 80k, cọc 1,000,000đ
    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-P22-04-REG',
        supplierId: supplier.id,
        campaignName: 'Chiến dịch Thu 2026',
        receivedDate: '2026-10-15',
        depositAmount: 1_000_000,
        depositPaymentConfirmed: true,
        depositPaymentMethod: 'BANK_TRANSFER',
        items: [
          {
            bookTitle: 'Cánh đồng bất tận',
            coverPrice: 80_000,
            importDiscountPercent: 18.75,
            importPrice: 65_000,
            retailPrice: 80_000,
            initialQuantity: 100,
          },
        ],
      },
      actorId
    );

    const itemId = lot.items![0].id;

    // Kiểm tra bút toán đặt cọc nhà sách: Nợ COC_DAT_NHA_SACH 1tr / Có TIEN_NGAN_HANG 1tr
    const depJournals = db.journalEntries.filter((j: any) => j.source_type === 'CONSIGNMENT_LOT');
    assert.equal(depJournals.length, 1);
    assert.equal(depJournals[0].fund_id, FUND_IDS.OPERATION);
    assert.equal(depJournals[0].debit_account, ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE);
    assert.equal(depJournals[0].credit_account, ACCOUNT_CODES.BANK_MAIN);
    assert.equal(Number(depJournals[0].amount), 1_000_000);

    // 3. Bán 60 cuốn giá 80k -> Thu 4,800,000đ
    const { sale, updatedItem: itemAfterSale } = await recordBookSale(
      db,
      {
        lotItemId: itemId,
        quantity: 60,
        paymentMethod: 'CASH',
        customerName: 'Người mua A',
        paymentConfirmed: true,
      },
      actorId
    );

    assert.equal(sale.totalAmount, 4_800_000);
    assert.equal(itemAfterSale.soldQuantity, 60);
    assert.equal(itemAfterSale.availableQuantity, 40);

    // Kiểm tra bút toán bán sách: Nợ TIEN_MAT_HOP 4.8tr / Có DOANH_THU_BAN_SACH 4.8tr (FUND_OPERATION)
    const saleJournals = db.journalEntries.filter((j: any) => j.source_type === 'BOOK_SALE');
    assert.equal(saleJournals.length, 1);
    assert.equal(saleJournals[0].fund_id, FUND_IDS.OPERATION);
    assert.equal(saleJournals[0].debit_account, ACCOUNT_CODES.CASH_DRAWER);
    assert.equal(saleJournals[0].credit_account, ACCOUNT_CODES.BOOK_SALES_REVENUE);
    assert.equal(Number(saleJournals[0].amount), 4_800_000);

    // 4. Trả 40 cuốn dư vật lý về nhà sách
    const { returnReceipt, updatedItem: itemAfterReturn } = await returnUnsoldBooks(
      db,
      lot.id,
      {
        lotItemId: itemId,
        returnedQuantity: 40,
        returnDate: '2026-10-18',
        recipientName: 'Anh NV Giao Hàng',
      },
      actorId
    );

    assert.equal(returnReceipt.returnedQuantity, 40);
    assert.equal(itemAfterReturn.returnedQuantity, 40);
    assert.equal(itemAfterReturn.availableQuantity, 0);

    // Invariant kho: 100 ban đầu = 60 bán + 40 trả + 0 giữ lại + 0 khả dụng
    assert.equal(
      itemAfterReturn.initialQuantity,
      itemAfterReturn.soldQuantity + itemAfterReturn.returnedQuantity + itemAfterReturn.retainedQuantity + itemAfterReturn.availableQuantity
    );

    // 5. Lập quyết toán chính thức:
    // Thu: 4.8tr, Nợ nhà sách: 60 * 65k = 3.9tr, Lãi gộp: 900k, Cọc kỳ vọng hoàn: 1tr
    const settlement = await createSettlement(
      db,
      {
        lotId: lot.id,
        idempotencyKey: 'IDEMP-SETTLE-P22-04',
      },
      actorId
    );

    assert.equal(settlement.totalSoldBooks, 60);
    assert.equal(settlement.totalReturnedBooks, 40);
    assert.equal(settlement.totalRevenue, 4_800_000);
    assert.equal(settlement.payableToSupplier, 3_900_000);
    assert.equal(settlement.grossProfit, 900_000);
    assert.equal(settlement.depositPaid, 1_000_000);
    assert.equal(settlement.depositRefundExpected, 1_000_000);

    // Kiểm tra bút toán quyết toán nợ nhà sách: Nợ CHI_HOAT_DONG_SU_KIEN 3.9tr / Có NO_PHAI_TRA_NHA_SACH 3.9tr
    const settleJournals = db.journalEntries.filter((j: any) => j.source_type === 'CONSIGNMENT_SETTLEMENT');
    assert.equal(settleJournals.length, 1);
    assert.equal(settleJournals[0].fund_id, FUND_IDS.OPERATION);
    assert.equal(settleJournals[0].debit_account, ACCOUNT_CODES.ACTIVITY_EXPENSE);
    assert.equal(settleJournals[0].credit_account, ACCOUNT_CODES.BOOKSTORE_PAYABLE);
    assert.equal(Number(settleJournals[0].amount), 3_900_000);

    // 6. Nhận hoàn cọc 1tr riêng biệt (RECEIVE_DEPOSIT_REFUND)
    const refundResult = await recordSupplierPayment(
      db,
      settlement.id,
      {
        paymentType: 'RECEIVE_DEPOSIT_REFUND',
        amount: 1_000_000,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        referenceDoc: 'UNC-REFUND-1M',
      },
      actorId
    );

    assert.equal(refundResult.settlement.depositRefundReceived, 1_000_000);
    assert.equal(refundResult.settlement.depositRefundStatus, 'RECEIVED');

    // Bút toán hoàn cọc: Nợ TIEN_NGAN_HANG 1tr / Có COC_DAT_NHA_SACH 1tr (KHÔNG phải doanh thu)
    const refundJournals = db.journalEntries.filter(
      (j: any) => j.source_type === 'SUPPLIER_PAYMENT' && j.credit_account === ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE
    );
    assert.equal(refundJournals.length, 1);
    assert.equal(refundJournals[0].debit_account, ACCOUNT_CODES.BANK_MAIN);
    assert.equal(Number(refundJournals[0].amount), 1_000_000);

    // 7. Thanh toán nợ tiền sách 3.9tr riêng biệt (PAY_SUPPLIER_PAYABLE)
    const paymentResult = await recordSupplierPayment(
      db,
      settlement.id,
      {
        paymentType: 'PAY_SUPPLIER_PAYABLE',
        amount: 3_900_000,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        referenceDoc: 'UNC-PAY-3M9',
      },
      actorId
    );

    assert.equal(paymentResult.settlement.paidToSupplier, 3_900_000);
    assert.equal(paymentResult.settlement.paymentStatus, 'PAID');

    // Bút toán trả nợ nhà sách: Nợ NO_PHAI_TRA_NHA_SACH 3.9tr / Có TIEN_NGAN_HANG 3.9tr
    const payJournals = db.journalEntries.filter(
      (j: any) => j.source_type === 'SUPPLIER_PAYMENT' && j.debit_account === ACCOUNT_CODES.BOOKSTORE_PAYABLE
    );
    assert.equal(payJournals.length, 1);
    assert.equal(payJournals[0].credit_account, ACCOUNT_CODES.BANK_MAIN);
    assert.equal(Number(payJournals[0].amount), 3_900_000);

    // 8. Đối soát tổng thể: Cọc đã tất toán (còn lại 0), Nợ đã trả hết (còn lại 0)
    // Tổng số bút toán trong Quỹ Hoạt Động = 5 (Deposit 1tr, Sale 4.8tr, Settle 3.9tr, Ref 1tr, Pay 3.9tr)
    const allOpJournals = db.journalEntries.filter((j: any) => j.fund_id === FUND_IDS.OPERATION);
    assert.equal(allOpJournals.length, 5);

    // Không có bất kỳ bút toán nào lẫn sang FUND_LOAN
    const loanJournals = db.journalEntries.filter((j: any) => j.fund_id === FUND_IDS.LOAN);
    assert.equal(loanJournals.length, 0);
  });

  it('Regression P22-04 (Mandatory 3): Bắt buộc paymentConfirmed, chặn mua nợ, số âm, thập phân, ca đóng, idempotency replay', async () => {
    const db = new MockCashDbQueryable();

    const supplier = await createSupplier(db, { code: 'NXB_KIMDONG_TEST', name: 'NXB Kim Đồng' });
    const lot = await createLot(
      db,
      {
        batchCode: 'LOT-VALIDATE-01',
        supplierId: supplier.id,
        campaignName: 'Test Invariants',
        receivedDate: '2026-10-15',
        depositAmount: 0,
        items: [
          {
            bookTitle: 'Dế Mèn Phiêu Lưu Ký',
            coverPrice: 50_000,
            importDiscountPercent: 20,
            importPrice: 40_000,
            retailPrice: 50_000,
            initialQuantity: 10,
          },
        ],
      },
      actorId
    );

    const itemId = lot.items![0].id;

    // 1. Chặn thiếu confirmation (không cho khách mua nợ)
    await assert.rejects(
      async () => {
        await recordBookSale(
          db,
          {
            lotItemId: itemId,
            quantity: 1,
            paymentMethod: 'CASH',
            paymentConfirmed: false,
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof BadRequestError);
        assert.equal(err.errorCode, 'PAYMENT_CONFIRMATION_REQUIRED');
        return true;
      }
    );

    // 2. Chặn số lượng âm / thập phân / 0
    await assert.rejects(
      async () => {
        await recordBookSale(
          db,
          {
            lotItemId: itemId,
            quantity: -3,
            paymentMethod: 'CASH',
            paymentConfirmed: true,
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof BadRequestError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await recordBookSale(
          db,
          {
            lotItemId: itemId,
            quantity: 2.5,
            paymentMethod: 'CASH',
            paymentConfirmed: true,
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof BadRequestError);
        return true;
      }
    );

    // 3. Chặn ca tiền mặt đã đóng
    db.cashSessions.push({
      id: 'sess-closed-01',
      session_date: '2026-10-19',
      opened_by: actorId,
      opened_at: '2026-10-19T08:00:00.000Z',
      opening_cash: '100000',
      expected_closing_cash: '100000',
      actual_closing_cash: '100000',
      is_closed: true,
    });

    await assert.rejects(
      async () => {
        await recordBookSale(
          db,
          {
            lotItemId: itemId,
            quantity: 1,
            paymentMethod: 'CASH',
            paymentConfirmed: true,
            cashSessionId: 'sess-closed-01',
          },
          actorId
        );
      },
      (err: any) => {
        assert(err instanceof BadRequestError);
        assert.equal(err.errorCode, 'SESSION_CLOSED');
        return true;
      }
    );

    // 4. Bán thành công với Idempotency Key
    const res1 = await recordBookSale(
      db,
      {
        lotItemId: itemId,
        quantity: 2,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        idempotencyKey: 'IDEMP-SALE-TEST-KEY',
      },
      actorId
    );

    assert.equal(res1.sale.quantity, 2);
    assert.equal(res1.updatedItem.soldQuantity, 2);
    assert.equal(res1.updatedItem.availableQuantity, 8);
    assert.equal(db.journalEntries.length, 1);

    // Replay với cùng Idempotency Key -> trả về kết quả cũ, KHÔNG trừ tồn lần 2 và KHÔNG tạo thêm bút toán
    const res2 = await recordBookSale(
      db,
      {
        lotItemId: itemId,
        quantity: 2,
        paymentMethod: 'BANK_TRANSFER',
        paymentConfirmed: true,
        idempotencyKey: 'IDEMP-SALE-TEST-KEY',
      },
      actorId
    );

    assert.equal(res2.sale.id, res1.sale.id);
    assert.equal(res2.updatedItem.availableQuantity, 8); // Tồn kho vẫn là 8, không bị trừ thành 6!
    assert.equal(db.journalEntries.length, 1); // Vẫn chỉ 1 bút toán duy nhất!
  });
});
