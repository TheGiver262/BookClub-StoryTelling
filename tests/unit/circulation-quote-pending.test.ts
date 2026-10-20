import test from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  issueLoanReceipt,
  settleReturnReceipt,
  quoteLoanAction,
  listPendingRefunds,
  cancelRefundIntent,
  listPendingDeposits,
  listPendingFines,
  collectPendingFine,
  addCalendarHoliday,
} from '../../src/server/circulation/service.ts';
import { openCashSession } from '../../src/server/finance/cash-sessions.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';

function seedBaseData(db: MockCashDbQueryable) {
  db.cashSessions = [];
  db.borrowers = [
    {
      id: 'bor-001',
      student_id: '20230001',
      full_name: 'Nguyễn Văn An',
      email: 'an.nv@sis.hust.edu.vn',
      phone: '0987654321',
      status: 'ACTIVE',
    },
  ];
  db.bookTitles = [
    { id: 'book-01', title: 'Số Đỏ', author_name: 'Vũ Trọng Phụng', cover_price: '100000' },
  ];
  db.bookEditions = [
    {
      id: 'ed-01',
      title_id: 'book-01',
      publisher: 'NXB Văn Học',
      publish_year: 2020,
    },
  ];
  db.bookCopies = [
    {
      id: 'copy-01',
      edition_id: 'ed-01',
      book_id: 'book-01',
      barcode: 'BK-SD-01',
      status: 'AVAILABLE',
      cover_price: '100000',
    },
    {
      id: 'copy-02',
      edition_id: 'ed-01',
      book_id: 'book-01',
      barcode: 'BK-SD-02',
      status: 'AVAILABLE',
      cover_price: '100000',
    },
  ];
}

test('S12-03: Quote loan action trích xuất hạn hiệu lực, lịch nghỉ lễ và phạt từ server', async () => {
  const db = new MockCashDbQueryable();
  seedBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  await openCashSession(db, {
    sessionId: 'CS-20261001-01',
    sessionDate: '2026-10-01',
    openingCash: 500000,
    openedBy: actorId,
  });

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-SD-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 100000,
    },
    actorId
  );

  // Thêm ngày nghỉ lễ đúng ngày đến hạn
  await addCalendarHoliday(
    db,
    {
      holidayDate: loan.dueDate,
      name: 'Ngày Nghỉ CLB Thử Nghiệm',
    },
    actorId
  );

  // Quote trả sách đúng ngày mượn (chưa quá hạn)
  const quoteEarly = await quoteLoanAction(db, {
    receiptId: loan.id,
    action: 'RETURN',
    targetDate: loan.borrowDate,
  });

  assert.equal(quoteEarly.receiptId, loan.id);
  assert.equal(quoteEarly.isOverdue, false);
  assert.equal(quoteEarly.overdueDays, 0);
  assert.equal(quoteEarly.suggestedFine, 0);
  assert.equal(quoteEarly.totalDeposit, 100000);
  assert.equal(quoteEarly.items.length, 1);
  assert.equal(quoteEarly.items[0].barcode, 'BK-SD-01');

  // Quote trả sách vào ngày tương lai (quá hạn)
  const quoteLate = await quoteLoanAction(db, {
    receiptId: loan.id,
    action: 'RETURN',
    targetDate: '2026-12-01',
  });

  assert.equal(quoteLate.isOverdue, true);
  assert.ok(quoteLate.overdueDays > 0);
  assert.equal(quoteLate.suggestedFine, quoteLate.overdueDays * 1000);
  assert.equal(quoteLate.effectiveDueDate, quoteLate.rawDueDate);

  // Quote gia hạn sách
  const quoteRenew = await quoteLoanAction(db, {
    receiptId: loan.id,
    action: 'RENEW',
    targetDate: loan.borrowDate,
  });
  assert.equal(quoteRenew.action, 'RENEW');
  assert.equal(quoteRenew.canRenew, true);
  assert.equal(quoteRenew.renewCount, 0);
});

test('S12-03: Hàng chờ pending refunds và thao tác hủy ý định hoàn cọc', async () => {
  const db = new MockCashDbQueryable();
  seedBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  await openCashSession(db, {
    sessionId: 'CS-20261001-01',
    sessionDate: '2026-10-01',
    openingCash: 500000,
    openedBy: actorId,
  });

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-SD-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 100000,
    },
    actorId
  );

  // Trả sách tạo refund intent PENDING (chưa xác nhận chi tiền)
  const ret = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnType: 'FULL',
      returnedBarcodes: ['BK-SD-01'],
      refundMethod: 'CASH',
      paymentConfirmed: false,
    },
    actorId
  );

  assert.equal(ret.refundIntents.length, 1);
  const intentId = ret.refundIntents[0].id;

  // Lấy danh sách hàng chờ pending refunds
  const pendingList = await listPendingRefunds(db);
  assert.equal(pendingList.length, 1);
  assert.equal(pendingList[0].id, intentId);
  assert.equal(pendingList[0].borrowerName, 'Nguyễn Văn An');
  assert.equal(pendingList[0].amount, 100000);
  assert.equal(pendingList[0].status, 'PENDING');

  // Hủy ý định hoàn cọc
  const cancelRes = await cancelRefundIntent(db, intentId, actorId, 'Bạn đọc muốn giữ cọc');
  assert.equal(cancelRes.status, 'CANCELLED');

  // Hàng chờ pending refunds trở về 0
  const afterCancelList = await listPendingRefunds(db);
  assert.equal(afterCancelList.length, 0);

  // Cố hủy lại bị từ chối
  await assert.rejects(
    () => cancelRefundIntent(db, intentId, actorId),
    /Chỉ có thể hủy ý định hoàn cọc/
  );
});

test('S12-03: Hàng chờ pending deposits (T73) và pending fines', async () => {
  const db = new MockCashDbQueryable();
  seedBaseData(db);

  // Giả lập 1 phiếu PENDING_DEPOSIT
  db.loanReceipts.push({
    id: 'lr-pending-dep',
    receipt_number: 'YSBK-LN-20261020-0001',
    borrower_id: 'bor-001',
    borrow_date: '2026-10-20',
    due_date: '2026-11-03',
    status: 'PENDING_DEPOSIT',
    created_at: new Date().toISOString(),
  });
  db.depositAllocations.push({
    id: 'alloc-pending-dep',
    receipt_id: 'lr-pending-dep',
    item_id: 'li-pending-dep',
    original_amount: 50000,
    status: 'PENDING_COLLECTION',
    payment_method: 'CASH',
  });
  db.loanItems.push({
    id: 'li-pending-dep',
    receipt_id: 'lr-pending-dep',
    copy_id: 'copy-02',
    deposit_snapshot: 50000,
  });

  const pendingDeposits = await listPendingDeposits(db);
  assert.equal(pendingDeposits.length, 1);
  assert.equal(pendingDeposits[0].receiptId, 'lr-pending-dep');
  assert.equal(pendingDeposits[0].requiredDeposit, 50000);
  assert.equal(pendingDeposits[0].borrowerName, 'Nguyễn Văn An');

  // Giả lập 1 settlement có fine_status = 'PENDING'
  db.loanSettlements.push({
    id: 'stl-pending-fine',
    receipt_id: 'lr-pending-dep',
    fine_pending_amount: 15000,
    fine_reason: 'Nợ phạt quá hạn đợt 1',
    fine_status: 'PENDING',
    settled_at: new Date().toISOString(),
  });

  const pendingFines = await listPendingFines(db);
  assert.equal(pendingFines.length, 1);
  assert.equal(pendingFines[0].targetId, 'stl-pending-fine');
  assert.equal(pendingFines[0].sourceType, 'SETTLEMENT');
  assert.equal(pendingFines[0].settlementId, 'stl-pending-fine');
  assert.equal(pendingFines[0].pendingAmount, 15000);
});

test('RF-01: Adapter -> Router dispatch GET /loans/:id/quote không bị nuốt bởi detail handler và trả 200', async () => {
  const db = new MockCashDbQueryable();
  seedBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  await openCashSession(db, {
    sessionId: 'CS-20261001-01',
    sessionDate: '2026-10-01',
    openingCash: 500000,
    openedBy: actorId,
  });

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-SD-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 100000,
    },
    actorId
  );

  const env = { JWT_SECRET: 'test-secret-key-32-chars-long-ysbk!' } as any;
  const injection = {
    queryable: db,
    db,
    membersDb: {
      'mem-001': {
        id: 'mem-001',
        full_name: 'Nguyễn Văn Member',
        username: 'member.test',
        is_active: true,
        is_alumni: false,
        is_admin: false,
        token_version: 1,
      },
    },
  } as any;

  const memberToken = await signSessionToken(
    {
      userId: 'usr-member',
      memberId: 'mem-001',
      role: 'MEMBER',
      isAlumni: false,
      isActive: true,
      tokenVersion: 1,
    },
    env.JWT_SECRET
  );

  // 1. GET /api/v1/circulation/loans/:id/quote -> Phải trả 200, KHÔNG ĐƯỢC 404 (Không bị detail route nuốt)
  const quoteReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/quote?action=RETURN`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${memberToken}`,
    },
  });
  const quoteRes = await handleRequest(quoteReq, env, injection);
  assert.strictEqual(quoteRes.status, 200, 'Route quote phải trả HTTP 200');
  const quoteJson = (await quoteRes.json()) as any;
  assert.strictEqual(quoteJson.data.receiptId, loan.id);
  assert.strictEqual(quoteJson.data.action, 'RETURN');
  assert.strictEqual(typeof quoteJson.data.projectedDueDate, 'string');
  assert.strictEqual(typeof quoteJson.data.effectiveFine, 'number');

  // 2. GET /api/v1/circulation/loans/:id -> Detail route vẫn hoạt động bình thường
  const detailReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${memberToken}`,
    },
  });
  const detailRes = await handleRequest(detailReq, env, injection);
  assert.strictEqual(detailRes.status, 200, 'Route detail phải trả HTTP 200');
  const detailJson = (await detailRes.json()) as any;
  assert.strictEqual(detailJson.data.id, loan.id);

  // 3. GET /api/v1/circulation/loans/:id/renewals -> Subresource renewals vẫn 200
  const renewalsReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renewals`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${memberToken}`,
    },
  });
  const renewalsRes = await handleRequest(renewalsReq, env, injection);
  assert.strictEqual(renewalsRes.status, 200, 'Route renewals phải trả HTTP 200');
});

test('RF-01: Canonical schema - không query bảng books hay readers, join bc->be->bt chuẩn xác', async () => {
  const executedSqls: string[] = [];
  const db = new MockCashDbQueryable();
  seedBaseData(db);

  // Bọc query để kiểm tra canonical schema
  const originalQuery = db.query.bind(db);
  db.query = async (sql: string, params: any[] = []): Promise<any> => {
    executedSqls.push(sql);
    // Schema guard: Báo lỗi nếu truy vấn bảng không tồn tại
    if (/\bFROM\s+books\b|\bJOIN\s+books\b/i.test(sql)) {
      const err = new Error('Relation "books" does not exist (canonical schema uses book_titles, book_editions, book_copies)');
      (err as any).code = '42P01';
      throw err;
    }
    if (/\bFROM\s+readers\b|\bJOIN\s+readers\b/i.test(sql)) {
      const err = new Error('Relation "readers" does not exist (canonical schema uses borrowers)');
      (err as any).code = '42P01';
      throw err;
    }
    if (/\bbook_copies\.book_id\b/i.test(sql)) {
      const err = new Error('Column book_copies.book_id does not exist (canonical schema uses edition_id -> title_id)');
      (err as any).code = '42703';
      throw err;
    }
    return originalQuery(sql, params);
  };

  const actorId = '00000000-0000-0000-0000-000000000001';
  await openCashSession(db, {
    sessionId: 'CS-20261001-01',
    sessionDate: '2026-10-01',
    openingCash: 500000,
    openedBy: actorId,
  });

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-SD-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 100000,
    },
    actorId
  );

  // 1. quoteLoanAction chạy trơn tru qua schema guard
  const quote = await quoteLoanAction(db, { receiptId: loan.id, action: 'RETURN' });
  assert.equal(quote.receiptId, loan.id);
  assert.equal(quote.items.length, 1);
  assert.equal(quote.items[0].title, 'Số Đỏ');

  // 2. listPendingRefunds chạy trơn tru qua schema guard
  const refunds = await listPendingRefunds(db);
  assert.ok(Array.isArray(refunds));

  // 3. listPendingDeposits chạy trơn tru qua schema guard
  const deposits = await listPendingDeposits(db);
  assert.ok(Array.isArray(deposits));

  // 4. listPendingFines chạy trơn tru qua schema guard
  const fines = await listPendingFines(db);
  assert.ok(Array.isArray(fines));

  // Xác nhận đã có câu SQL được ghi nhận và không câu nào vi phạm
  assert.ok(executedSqls.length > 5);
  for (const sql of executedSqls) {
    assert.strictEqual(/\bFROM\s+books\b|\bJOIN\s+books\b/i.test(sql), false, `SQL vi phạm: ${sql}`);
    assert.strictEqual(/\bFROM\s+readers\b|\bJOIN\s+readers\b/i.test(sql), false, `SQL vi phạm: ${sql}`);
    assert.strictEqual(/\bbook_copies\.book_id\b/i.test(sql), false, `SQL vi phạm: ${sql}`);
  }
});

test('RF-01: Cùng receipt có nhiều nguồn phạt (settlement + renewal), chọn dòng A chỉ thu A', async () => {
  const db = new MockCashDbQueryable();
  seedBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  await openCashSession(db, {
    sessionId: 'CS-20261001-01',
    sessionDate: '2026-10-01',
    openingCash: 500000,
    openedBy: actorId,
  });

  const receiptId = 'lr-multi-fine';
  db.loanReceipts.push({
    id: receiptId,
    receipt_number: 'YSBK-LN-20261020-9999',
    borrower_id: 'bor-001',
    borrow_date: '2026-10-01',
    due_date: '2026-10-15',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Nguồn 1: Renewal phạt chờ thu (3.000₫)
  const renewalFineId = 'rn-fine-001';
  db.loanRenewals.push({
    id: renewalFineId,
    receipt_id: receiptId,
    renewal_sequence: 1,
    fine_final: 3000,
    fine_collected: 0,
    fine_pending_amount: 3000,
    fine_status: 'PENDING',
    renewed_at: '2026-10-16T10:00:00Z',
  });

  // Nguồn 2: Settlement phạt chờ thu (5.000₫)
  const settlementFineId = 'stl-fine-002';
  db.loanSettlements.push({
    id: settlementFineId,
    receipt_id: receiptId,
    fine_final: 5000,
    fine_collected: 0,
    fine_pending_amount: 5000,
    fine_status: 'PENDING',
    settled_at: '2026-10-20T10:00:00Z',
  });

  // Kiểm tra danh sách hàng chờ trả đủ cả 2 nguồn với targetId rõ ràng
  const pendingFines = await listPendingFines(db);
  assert.equal(pendingFines.length, 2);

  const renewalItem = pendingFines.find((f) => f.targetId === renewalFineId);
  const settlementItem = pendingFines.find((f) => f.targetId === settlementFineId);

  assert.ok(renewalItem, 'Phải có dòng phạt từ renewal');
  assert.ok(settlementItem, 'Phải có dòng phạt từ settlement');
  assert.equal(renewalItem.sourceType, 'RENEWAL');
  assert.equal(settlementItem.sourceType, 'SETTLEMENT');
  assert.equal(renewalItem.pendingAmount, 3000);
  assert.equal(settlementItem.pendingAmount, 5000);

  // Thu tiền đúng dòng renewal bằng targetId
  const collectResult = await collectPendingFine(
    db,
    {
      receiptId,
      targetId: renewalFineId,
      amount: 3000,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      cashSessionId: 'CS-20261001-01',
    },
    actorId
  );
  assert.equal(collectResult.fineCollected, 3000);

  // Kiểm tra lại: dòng renewal đã thu xong, dòng settlement vẫn còn PENDING nguyên vẹn 5.000₫
  const remainingFines = await listPendingFines(db);
  assert.equal(remainingFines.length, 1);
  assert.equal(remainingFines[0].targetId, settlementFineId);
  assert.equal(remainingFines[0].pendingAmount, 5000);
});

test('RF-01: Quote policy - cap cọc, canRenew false khi phạt >= cọc, projectedDueDate chuẩn', async () => {
  const db = new MockCashDbQueryable();
  seedBaseData(db);

  const receiptId = 'lr-quote-policy';
  db.loanReceipts.push({
    id: receiptId,
    receipt_number: 'YSBK-LN-20261020-8888',
    borrower_id: 'bor-001',
    borrow_date: '2026-09-01',
    due_date: '2026-09-15', // Quá hạn nhiều ngày
    renew_count: 1,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Cọc chỉ có 50.000₫
  db.depositAllocations.push({
    id: 'alloc-quote-cap',
    receipt_id: receiptId,
    remaining_amount: 50000,
    status: 'HELD',
    payment_method: 'CASH',
  });
  db.loanItems.push({
    id: 'li-quote-cap',
    receipt_id: receiptId,
    copy_id: 'copy-01',
    deposit_snapshot: 50000,
  });

  // Đánh giá tại ngày 2026-12-01 (quá hạn ~77 ngày, phạt 77.000₫ > cọc 50.000₫)
  const quote = await quoteLoanAction(db, {
    receiptId,
    action: 'RENEW',
    targetDate: '2026-12-01',
  });

  assert.equal(quote.isOverdue, true);
  assert.ok(quote.suggestedFine > 50000, 'Phạt gợi ý phải vượt quá 50.000₫');
  assert.equal(quote.totalDeposit, 50000);
  assert.equal(quote.effectiveFine, 50000, 'Mức phạt hiệu lực phải được cap bằng tổng tiền cọc');
  assert.equal(quote.canRenew, false, 'canRenew phải là false vì phạt gợi ý >= tiền cọc');
  assert.equal(typeof quote.projectedDueDate, 'string');
  assert.ok(quote.projectedDueDate > '2026-12-01', 'projectedDueDate phải được tính từ targetDate khi quá hạn');
});
