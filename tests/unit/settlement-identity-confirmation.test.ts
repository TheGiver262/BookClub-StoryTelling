/**
 * =====================================================================
 * Nhóm II Regressions: RF-02, RF-03, RF-07, RF-08
 * - RF-02: Xác nhận tiền thực tế (Sell, Create Lot Deposit, Supplier Payment)
 * - RF-03: Quyết toán một lần, Idempotency hash, Snapshot khóa lô nhất quán
 * - RF-07: Chống xung đột danh tính khi chuyển ứng viên (Username collision, no fake data)
 * - RF-08: Đảo phạt legacy theo sequence chính xác, fail-closed AMBIGUOUS_FINE_SOURCE
 * =====================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  createSupplier,
  createLot,
  recordBookSale,
  returnUnsoldBooks,
  retainBooksForNextPeriod,
} from '../../src/modules/sales/lot-inventory.ts';
import {
  createSettlement,
  recordSupplierPayment,
} from '../../src/modules/sales/settlement.ts';
import {
  convertPassedApplicantToMember,
} from '../../src/modules/recruitment/decisions.ts';
import { createDocumentCorrection } from '../../src/server/finance/ledger.ts';
import { BadRequestError, ConflictError } from '../../src/server/errors.ts';
import { ACCOUNT_CODES, FUND_IDS } from '../../src/server/finance/types.ts';

const ACTOR_ID = '00000000-0000-0000-0000-000000000001';

// ─────────────────────────────────────────────────────────────────────────────
// 1. RF-02: Xác nhận tiền thực tế xuyên suốt
// ─────────────────────────────────────────────────────────────────────────────
test('RF-02a: recordBookSale từ chối khi paymentConfirmed không phải boolean true (null, false, 0, string true)', async () => {
  const db = new MockCashDbQueryable();
  const sup = await createSupplier(db, { code: 'NXB_KIM_DONG', name: 'NXB Kim Đồng' });
  const lot = await createLot(
    db,
    {
      batchCode: 'LOT-CONFIRM-01',
      supplierId: sup.id,
      campaignName: 'Hội sách 2026',
      receivedDate: '2026-10-15',
      depositAmount: 0,
      items: [
        {
          bookTitle: 'Dế Mèn Phiêu Lưu Ký',
          coverPrice: 50_000,
          importDiscountPercent: 20,
          retailPrice: 50_000,
          initialQuantity: 10,
        },
      ],
    },
    ACTOR_ID
  );
  const itemId = lot.items![0].id;

  // 1. Omitted / false
  await assert.rejects(
    async () => {
      await recordBookSale(db, {
        lotItemId: itemId,
        quantity: 1,
        paymentMethod: 'CASH',
        paymentConfirmed: false,
      }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'PAYMENT_CONFIRMATION_REQUIRED');
      return true;
    }
  );

  // 2. String 'true' (không phải boolean)
  await assert.rejects(
    async () => {
      await recordBookSale(db, {
        lotItemId: itemId,
        quantity: 1,
        paymentMethod: 'CASH',
        paymentConfirmed: 'true' as any,
      }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'PAYMENT_CONFIRMATION_REQUIRED');
      return true;
    }
  );

  // 3. Invalid paymentMethod
  await assert.rejects(
    async () => {
      await recordBookSale(db, {
        lotItemId: itemId,
        quantity: 1,
        paymentMethod: 'DEBT' as any,
        paymentConfirmed: true,
      }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'INVALID_PAYMENT_METHOD');
      return true;
    }
  );
});

test('RF-02b: createLot có depositAmount > 0 nhưng không xác nhận (unconfirmed) để deposit_status = NONE và không ghi journal chi', async () => {
  const db = new MockCashDbQueryable();
  const sup = await createSupplier(db, { code: 'NXB_TRE', name: 'NXB Trẻ' });

  // Tạo lô có dự kiến cọc 1 triệu nhưng CHƯA thực chi
  const lot = await createLot(
    db,
    {
      batchCode: 'LOT-UNCONFIRMED-DEP',
      supplierId: sup.id,
      campaignName: 'Thu 2026',
      receivedDate: '2026-10-15',
      depositAmount: 1_000_000,
      depositPaymentConfirmed: false, // Chưa chi tiền
      items: [
        {
          bookTitle: 'Đất Rừng Phương Nam',
          coverPrice: 80_000,
          importDiscountPercent: 20,
          retailPrice: 80_000,
          initialQuantity: 50,
        },
      ],
    },
    ACTOR_ID
  );

  assert.equal(lot.depositAmount, 1_000_000);
  assert.equal(lot.depositStatus, 'NONE', 'Chưa xác nhận chi thì deposit_status phải là NONE');

  // Kiểm tra không có bút toán chi tiền cọc nào được ghi nhận
  const journals = db.journalEntries.filter((j: any) => j.source_type === 'CONSIGNMENT_LOT');
  assert.equal(journals.length, 0, 'Tuyệt đối không ghi nhận journal chi tiền khi chưa xác nhận thực chi');
});

test('RF-02c: createLot có depositPaymentConfirmed = true yêu cầu method hợp lệ và ghi journal vào Quỹ Vận Hành', async () => {
  const db = new MockCashDbQueryable();
  const sup = await createSupplier(db, { code: 'NHA_NAM', name: 'Nhã Nam' });

  // Thiếu method khi xác nhận chi -> Bị từ chối
  await assert.rejects(
    async () => {
      await createLot(
        db,
        {
          batchCode: 'LOT-ERR-METHOD',
          supplierId: sup.id,
          campaignName: 'Thu 2026',
          receivedDate: '2026-10-15',
          depositAmount: 500_000,
          depositPaymentConfirmed: true,
          // depositPaymentMethod bị bỏ trống
          items: [
            {
              bookTitle: 'Hoàng Tử Bé',
              coverPrice: 60_000,
              importDiscountPercent: 20,
              retailPrice: 60_000,
              initialQuantity: 20,
            },
          ],
        },
        ACTOR_ID
      );
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'INVALID_PAYMENT_METHOD');
      return true;
    }
  );

  // Xác nhận chi hợp lệ qua BANK
  const lot = await createLot(
    db,
    {
      batchCode: 'LOT-CONFIRMED-DEP',
      supplierId: sup.id,
      campaignName: 'Thu 2026',
      receivedDate: '2026-10-15',
      depositAmount: 500_000,
      depositPaymentConfirmed: true,
      depositPaymentMethod: 'BANK_TRANSFER',
      items: [
        {
          bookTitle: 'Hoàng Tử Bé',
          coverPrice: 60_000,
          importDiscountPercent: 20,
          retailPrice: 60_000,
          initialQuantity: 20,
        },
      ],
    },
    ACTOR_ID
  );

  assert.equal(lot.depositStatus, 'PAID');
  const journals = db.journalEntries.filter((j: any) => j.source_type === 'CONSIGNMENT_LOT');
  assert.equal(journals.length, 1);
  assert.equal(journals[0].fund_id, FUND_IDS.OPERATION);
  assert.equal(journals[0].debit_account, ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE);
  assert.equal(journals[0].credit_account, ACCOUNT_CODES.BANK_MAIN);
  assert.equal(Number(journals[0].amount), 500_000);
});

test('RF-02d: recordSupplierPayment bắt buộc paymentConfirmed = true và referenceDoc thực tế', async () => {
  const db = new MockCashDbQueryable();
  const sup = await createSupplier(db, { code: 'SUP_PAY', name: 'Đối tác thanh toán' });
  const lot = await createLot(
    db,
    {
      batchCode: 'LOT-PAY-TEST',
      supplierId: sup.id,
      campaignName: 'Test 2026',
      receivedDate: '2026-10-15',
      depositAmount: 0,
      items: [
        {
          bookTitle: 'Sách Test',
          coverPrice: 100_000,
          importDiscountPercent: 20,
          retailPrice: 100_000,
          initialQuantity: 10,
        },
      ],
    },
    ACTOR_ID
  );

  // Bán 10 cuốn thu 1,000,000 (nợ nhà sách 800,000)
  await recordBookSale(db, {
    lotItemId: lot.items![0].id,
    quantity: 10,
    paymentMethod: 'BANK_TRANSFER',
    paymentConfirmed: true,
  }, ACTOR_ID);

  const settle = await createSettlement(db, { lotId: lot.id }, ACTOR_ID);
  assert.equal(settle.payableToSupplier, 800_000);

  // 1. Bị từ chối nếu thiếu paymentConfirmed hoặc false
  await assert.rejects(
    async () => {
      await recordSupplierPayment(
        db,
        settle.id,
        {
          paymentType: 'PAY_SUPPLIER_PAYABLE',
          amount: 800_000,
          paymentMethod: 'BANK_TRANSFER',
          paymentConfirmed: false,
          referenceDoc: 'UNC-REAL-01',
        },
        ACTOR_ID
      );
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'PAYMENT_UNCONFIRMED');
      return true;
    }
  );

  // 2. Bị từ chối nếu thiếu referenceDoc
  await assert.rejects(
    async () => {
      await recordSupplierPayment(
        db,
        settle.id,
        {
          paymentType: 'PAY_SUPPLIER_PAYABLE',
          amount: 800_000,
          paymentMethod: 'BANK_TRANSFER',
          paymentConfirmed: true,
          referenceDoc: '   ',
        },
        ACTOR_ID
      );
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'MISSING_REFERENCE_DOC');
      return true;
    }
  );

  // 3. Thành công khi đầy đủ xác nhận thực tế và mã chứng từ
  const res = await recordSupplierPayment(
    db,
    settle.id,
    {
      paymentType: 'PAY_SUPPLIER_PAYABLE',
      amount: 800_000,
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
      referenceDoc: 'FT24090123456789',
      notes: 'Thanh toán tiền sách qua ngân hàng',
    },
    ACTOR_ID
  );

  assert.equal(res.settlement.paidToSupplier, 800_000);
  assert.equal(res.settlement.paymentStatus, 'PAID');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. RF-03: Quyết toán một lần & Khóa aggregate lô nhất quán
// ─────────────────────────────────────────────────────────────────────────────
test('RF-03a: createSettlement với idempotency key bị tái sử dụng cho lô khác trả về 409 ConflictError', async () => {
  const db = new MockCashDbQueryable();
  const sup = await createSupplier(db, { code: 'SUP_IDEMP', name: 'Đối tác Idempotency' });

  const lotA = await createLot(db, {
    batchCode: 'LOT-IDEMP-A',
    supplierId: sup.id,
    campaignName: 'Test A',
    receivedDate: '2026-10-15',
    depositAmount: 0,
    items: [{ bookTitle: 'Sách A', coverPrice: 50_000, importDiscountPercent: 20, retailPrice: 50_000, initialQuantity: 10 }],
  }, ACTOR_ID);

  const lotB = await createLot(db, {
    batchCode: 'LOT-IDEMP-B',
    supplierId: sup.id,
    campaignName: 'Test B',
    receivedDate: '2026-10-15',
    depositAmount: 0,
    items: [{ bookTitle: 'Sách B', coverPrice: 50_000, importDiscountPercent: 20, retailPrice: 50_000, initialQuantity: 10 }],
  }, ACTOR_ID);

  const sharedKey = 'IDEMP-SETTLE-KEY-001';

  // Lần 1: Quyết toán lô A với key này
  const settleA = await createSettlement(db, { lotId: lotA.id, idempotencyKey: sharedKey }, ACTOR_ID);
  assert.equal(settleA.lotId, lotA.id);

  // Lần 2: Dùng CÙNG key cho lô B -> Bắt buộc 409 (không được trả nhầm chứng từ lô A)
  await assert.rejects(
    async () => {
      await createSettlement(db, { lotId: lotB.id, idempotencyKey: sharedKey }, ACTOR_ID);
    },
    (err: any) => {
      assert(err.httpStatus === 409 || err.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH' || err instanceof ConflictError);
      return true;
    }
  );
});

test('RF-03b: Sau khi quyết toán (SETTLED), các thao tác bán, trả sách, giữ sách bị chặn triệt để', async () => {
  const db = new MockCashDbQueryable();
  const sup = await createSupplier(db, { code: 'SUP_LOCK', name: 'Đối tác Khóa Lô' });

  const lot = await createLot(db, {
    batchCode: 'LOT-LOCK-01',
    supplierId: sup.id,
    campaignName: 'Khóa lô 2026',
    receivedDate: '2026-10-15',
    depositAmount: 0,
    items: [
      {
        bookTitle: 'Sách Khóa',
        coverPrice: 100_000,
        importDiscountPercent: 20,
        retailPrice: 100_000,
        initialQuantity: 10,
      },
    ],
  }, ACTOR_ID);
  const itemId = lot.items![0].id;

  // Bán 5 cuốn
  await recordBookSale(db, {
    lotItemId: itemId,
    quantity: 5,
    paymentMethod: 'CASH',
    paymentConfirmed: true,
  }, ACTOR_ID);

  // Quyết toán lô
  const settle = await createSettlement(db, { lotId: lot.id }, ACTOR_ID);
  assert.ok(settle.id);

  // 1. Thử quyết toán lần 2 -> Bị từ chối
  await assert.rejects(
    async () => {
      await createSettlement(db, { lotId: lot.id }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof ConflictError);
      assert.equal(err.errorCode, 'LOT_ALREADY_SETTLED');
      return true;
    }
  );

  // 2. Thử bán thêm sách sau khi đã quyết toán -> Bị từ chối
  await assert.rejects(
    async () => {
      await recordBookSale(db, {
        lotItemId: itemId,
        quantity: 1,
        paymentMethod: 'CASH',
        paymentConfirmed: true,
      }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'LOT_ALREADY_SETTLED');
      return true;
    }
  );

  // 3. Thử trả sách sau khi đã quyết toán -> Bị từ chối
  await assert.rejects(
    async () => {
      await returnUnsoldBooks(db, lot.id, {
        lotItemId: itemId,
        returnedQuantity: 1,
        returnDate: '2026-10-20',
      }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'LOT_ALREADY_SETTLED');
      return true;
    }
  );

  // 4. Thử giữ sách đợt sau khi đã quyết toán -> Bị từ chối
  await assert.rejects(
    async () => {
      await retainBooksForNextPeriod(db, lot.id, {
        lotItemId: itemId,
        retainedQuantity: 1,
      }, ACTOR_ID);
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'LOT_ALREADY_SETTLED');
      return true;
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RF-07: Chuyển ứng viên & Bảo vệ xung đột danh tính
// ─────────────────────────────────────────────────────────────────────────────
test('RF-07a: Username trùng với thành viên khác (khác danh tính) ném ConflictError USERNAME_COLLISION, không gán bừa', async () => {
  const db = new MockCashDbQueryable();

  // Đã có 1 thành viên tồn tại với username 'existinguser'
  db.members.push({
    id: '00000000-0000-0000-0000-999999999999',
    full_name: 'Nguyễn Văn Cũ',
    username: 'existinguser',
    phone: '0901112222',
    school_year: 'K65',
    gen: 'Gen 7',
    team: 'HAU_CAN',
    role_title: 'Cựu thành viên',
    is_eligible_main_duty: true,
    has_paid_fee: true,
    is_alumni: true,
    is_admin: false,
    is_active: true,
    token_version: 1,
    created_at: new Date().toISOString(),
  });

  // Ứng viên mới có tên khác, số điện thoại khác nhưng sinh ra username trùng 'existinguser'
  db.recruitmentFormResponses.push({
    id: 'RESP_COLLISION_01',
    applicant_name: 'Trần Thị Mới',
    applicant_student_id: 'existinguser', // Trùng username
    applicant_phone: '0988889999', // Khác số điện thoại!
    school_year: 'K69',
    campaign_gen: 'Gen 11',
  });

  db.recruitmentDecisions.push({
    id: 'DEC_COL_01',
    response_id: 'RESP_COLLISION_01',
    decision: 'PASSED',
    assigned_department: 'BAN_NOI_DUNG',
    committee_notes: 'Trúng tuyển',
    decided_by: 'admin-01',
    decided_at: new Date().toISOString(),
    is_converted_to_member: false,
  });

  await assert.rejects(
    async () => {
      await convertPassedApplicantToMember(db, 'RESP_COLLISION_01', 'admin-01');
    },
    (err: any) => {
      assert(err instanceof ConflictError);
      assert.equal(err.errorCode, 'USERNAME_COLLISION');
      return true;
    }
  );

  // Xác nhận thành viên cũ không bị sửa đổi và quyết định chưa bị đánh dấu converted
  const member = db.members.find((m) => m.id === '00000000-0000-0000-0000-999999999999');
  assert.equal(member.full_name, 'Nguyễn Văn Cũ');
  const dec = db.recruitmentDecisions.find((d) => d.id === 'DEC_COL_01');
  assert.equal(dec.is_converted_to_member, false);
});

test('RF-07b: Ứng viên thiếu số điện thoại bắt buộc từ chối MISSING_APPLICANT_PHONE, không bịa 0900000000', async () => {
  const db = new MockCashDbQueryable();

  db.recruitmentFormResponses.push({
    id: 'RESP_NO_PHONE',
    applicant_name: 'Phạm Minh Không Số',
    applicant_student_id: '20249999',
    applicant_phone: '', // Thiếu số điện thoại!
    school_year: 'K69',
    campaign_gen: 'Gen 11',
  });

  db.recruitmentDecisions.push({
    id: 'DEC_NO_PHONE',
    response_id: 'RESP_NO_PHONE',
    decision: 'PASSED',
    assigned_department: 'BAN_HAU_CAN',
    decided_by: 'admin-01',
    decided_at: new Date().toISOString(),
    is_converted_to_member: false,
  });

  await assert.rejects(
    async () => {
      await convertPassedApplicantToMember(db, 'RESP_NO_PHONE', 'admin-01');
    },
    (err: any) => {
      assert(err instanceof BadRequestError);
      assert.equal(err.errorCode, 'MISSING_APPLICANT_PHONE');
      return true;
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. RF-08: Đảo phạt legacy theo sequence chính xác & fail-closed khi mơ hồ
// ─────────────────────────────────────────────────────────────────────────────
test('RF-08a: Hai lần gia hạn trên cùng receipt, đảo JE-RN-RCP-1 chỉ đảo lần 1, giữ nguyên lần 2', async () => {
  const db = new MockCashDbQueryable();
  const receiptId = 'RCP-LEGACY-MULTI';

  db.cashSessions.push({
    id: 'CS-SESSION-TEST-01',
    session_date: '2026-10-20',
    shift_name: 'CA_SANG',
    opening_cash: '500000',
    expected_closing_cash: '500000',
    is_closed: false,
    opened_by: ACTOR_ID,
  });

  // Lần gia hạn 1: sequence 1, phạt thu 1,000
  const rnw1 = {
    id: 'rnw-uuid-001',
    receipt_id: receiptId,
    renewal_sequence: 1,
    fine_collected: '1000',
    fine_pending_amount: '0',
    fine_status: 'PAID',
  };
  // Lần gia hạn 2: sequence 2, phạt thu 3,000
  const rnw2 = {
    id: 'rnw-uuid-002',
    receipt_id: receiptId,
    renewal_sequence: 2,
    fine_collected: '3000',
    fine_pending_amount: '0',
    fine_status: 'PAID',
  };
  db.loanRenewals.push(rnw1, rnw2);

  // Bút toán lịch sử lần 1: source_id = receiptId, entry_code = JE-RN-RCP-1
  const je1 = {
    id: 'je-rn-001',
    entry_code: 'JE-RN-RCP-1',
    fund_id: FUND_IDS.LOAN,
    source_type: 'LOAN_FINE',
    source_id: receiptId, // Legacy source_id là receipt_id
    debit_account: ACCOUNT_CODES.CASH_DRAWER,
    credit_account: ACCOUNT_CODES.FINE_REVENUE,
    amount: '1000',
    reversal_of_entry_id: null,
    cash_session_id: 'CS-SESSION-TEST-01',
    created_by: ACTOR_ID,
    created_at: new Date().toISOString(),
  };
  db.journalEntries.push(je1);

  // Đảo bút toán lần 1
  const rev = await createDocumentCorrection(
    db,
    { originalEntryId: 'je-rn-001', reason: 'Sai sót tiền phạt lần 1', paymentConfirmed: true, cashSessionId: 'CS-SESSION-TEST-01' },
    ACTOR_ID
  );
  assert.ok(rev.reversalEntryId);

  // Kiểm tra: Lần 1 phải bị đảo (collected = 0, pending = 1000)
  assert.equal(rnw1.fine_collected, '0');
  assert.equal(rnw1.fine_pending_amount, '1000');
  assert.equal(rnw1.fine_status, 'PENDING');

  // Kiểm tra: Lần 2 TUYỆT ĐỐI KHÔNG BỊ CHẠM VÀO (vẫn nguyên 3,000)
  assert.equal(rnw2.fine_collected, '3000');
  assert.equal(rnw2.fine_pending_amount, '0');
  assert.equal(rnw2.fine_status, 'PAID');
});

test('RF-08b: Reversal vượt quá số tiền đã thu ném FINE_REVERSAL_EXCEEDS_COLLECTED (không clamp về 0)', async () => {
  const db = new MockCashDbQueryable();
  const receiptId = 'RCP-OVER-REV';

  db.cashSessions.push({
    id: 'CS-SESSION-TEST-01',
    session_date: '2026-10-20',
    shift_name: 'CA_SANG',
    opening_cash: '500000',
    expected_closing_cash: '500000',
    is_closed: false,
    opened_by: ACTOR_ID,
  });

  const rnw = {
    id: 'rnw-over-01',
    receipt_id: receiptId,
    renewal_sequence: 1,
    fine_collected: '500', // Chỉ mới thu 500
    fine_pending_amount: '0',
    fine_status: 'PARTIAL',
  };
  db.loanRenewals.push(rnw);

  // Bút toán đảo yêu cầu đảo 1,000 trong khi chỉ thu 500
  const je = {
    id: 'je-over-001',
    entry_code: 'JE-RN-RCP-1',
    fund_id: FUND_IDS.LOAN,
    source_type: 'LOAN_FINE',
    source_id: receiptId,
    debit_account: ACCOUNT_CODES.CASH_DRAWER,
    credit_account: ACCOUNT_CODES.FINE_REVENUE,
    amount: '1000', // Lớn hơn 500
    reversal_of_entry_id: null,
    cash_session_id: 'CS-SESSION-TEST-01',
    created_by: ACTOR_ID,
    created_at: new Date().toISOString(),
  };
  db.journalEntries.push(je);

  await assert.rejects(
    async () => {
      await createDocumentCorrection(
        db,
        { originalEntryId: 'je-over-001', reason: 'Đảo phạt vượt quá', paymentConfirmed: true, cashSessionId: 'CS-SESSION-TEST-01' },
        ACTOR_ID
      );
    },
    (err: any) => {
      assert.equal(err.code, 'FINE_REVERSAL_EXCEEDS_COLLECTED');
      return true;
    }
  );
  // Không bị clamp về 0
  assert.equal(rnw.fine_collected, '500');
});

test('RF-08c: Receipt có nhiều lần gia hạn nhưng entry_code không có sequence ném AMBIGUOUS_FINE_SOURCE', async () => {
  const db = new MockCashDbQueryable();
  const receiptId = 'RCP-AMBIGUOUS';

  db.cashSessions.push({
    id: 'CS-SESSION-TEST-01',
    session_date: '2026-10-20',
    shift_name: 'CA_SANG',
    opening_cash: '500000',
    expected_closing_cash: '500000',
    is_closed: false,
    opened_by: ACTOR_ID,
  });

  db.loanRenewals.push(
    { id: 'rnw-a', receipt_id: receiptId, renewal_sequence: 1, fine_collected: '1000', fine_pending_amount: '0', fine_status: 'PAID' },
    { id: 'rnw-b', receipt_id: receiptId, renewal_sequence: 2, fine_collected: '2000', fine_pending_amount: '0', fine_status: 'PAID' }
  );

  // Mã bút toán không có sequence phân biệt (ví dụ JE-RN-OLD)
  const je = {
    id: 'je-ambig-001',
    entry_code: 'JE-RN-LEGACY-NO-SEQ',
    fund_id: FUND_IDS.LOAN,
    source_type: 'LOAN_FINE',
    source_id: receiptId,
    debit_account: ACCOUNT_CODES.CASH_DRAWER,
    credit_account: ACCOUNT_CODES.FINE_REVENUE,
    amount: '1000',
    reversal_of_entry_id: null,
    cash_session_id: 'CS-SESSION-TEST-01',
    created_by: ACTOR_ID,
    created_at: new Date().toISOString(),
  };
  db.journalEntries.push(je);

  await assert.rejects(
    async () => {
      await createDocumentCorrection(
        db,
        { originalEntryId: 'je-ambig-001', reason: 'Đảo không rõ nguồn', paymentConfirmed: true, cashSessionId: 'CS-SESSION-TEST-01' },
        ACTOR_ID
      );
    },
    (err: any) => {
      assert.equal(err.code, 'AMBIGUOUS_FINE_SOURCE');
      return true;
    }
  );
});
