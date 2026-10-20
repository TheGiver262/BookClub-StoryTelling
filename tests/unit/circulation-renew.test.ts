/**
 * YSBK Circulation Module Unit Tests - Chặng 10: Gia hạn (Renewal) & Lịch ngày đến hạn (Due Date Calendar)
 */

import test from 'node:test';
import assert from 'node:assert';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  issueLoanReceipt,
  settleReturnReceipt,
  renewLoanReceipt,
  getLoanRenewals,
  confirmNewDeposit,
  MaxRenewalsExceededError,
  InvalidLoanStatusForRenewalError,
  FineReasonRequiredError,
  NoValidDutyShiftFoundError,
} from '../../src/server/circulation/service.ts';
import {
  calculateDueDate,
  calculateEffectiveDueDate,
  getCurrentVietnamDate,
  normalizeDateToVietnamYmd,
} from '../../src/server/circulation/rules.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';

function createMockEnvironment(todayYmd = '2026-10-15') {
  const db = new MockCashDbQueryable();

  // Active Cash Session
  db.cashSessions.push({
    id: 'CS-SESSION-TEST-01',
    session_date: todayYmd,
    opened_by: 'mem-admin-01',
    opened_at: `${todayYmd}T08:00:00.000Z`,
    opening_cash: '500000',
    expected_closing_cash: '500000',
    actual_closing_cash: null,
    is_closed: false,
  });

  // Borrower
  db.borrowers.push({
    id: 'bor-01',
    full_name: 'Nguyễn Văn Đọc',
    phone: '0912345678',
    student_id: '20230001',
    school: 'ĐHBK Hà Nội',
    is_archived: false,
  });

  // Book Edition & Titles
  db.bookTitles.push({ id: 'bt-01', title: 'Hệ Điều Hành & Hệ Phân Tán' });
  db.bookEditions.push({ id: 'ed-01', title_id: 'bt-01', publisher: 'NXB Bách Khoa', publish_year: 2025 });

  // Book Copies
  db.bookCopies.push({
    id: 'cp-01',
    edition_id: 'ed-01',
    barcode: 'BC-RNW-01',
    location: 'BAN_TRUC_TAM',
    status: 'AVAILABLE',
    cover_price: 50000,
  });
  db.bookCopies.push({
    id: 'cp-02',
    edition_id: 'ed-01',
    barcode: 'BC-RNW-02',
    location: 'BAN_TRUC_TAM',
    status: 'AVAILABLE',
    cover_price: 100000,
  });

  return db;
}

function createTestInjection(db: MockCashDbQueryable) {
  return {
    queryable: db,
    membersDb: {
      'mem-01': {
        id: 'mem-01',
        username: 'member01',
        is_admin: false,
        is_alumni: false,
        is_active: true,
        token_version: 1,
      },
      'mem-admin-01': {
        id: 'mem-admin-01',
        username: 'admin01',
        is_admin: true,
        is_alumni: false,
        is_active: true,
        token_version: 1,
      },
      'mem-alumni-01': {
        id: 'mem-alumni-01',
        username: 'alumni01',
        is_admin: false,
        is_alumni: true,
        is_active: true,
        token_version: 1,
      },
    },
  };
}

// =========================================================================
// 1. GATE G-calendar: Ngày lịch VN, rollover tháng/năm/tháng 2, holiday shift
// =========================================================================

test('G-calendar 1: Vietnam UTC+7 date calculations and formatting', () => {
  const vnDate = getCurrentVietnamDate();
  assert.match(vnDate, /^\d{4}-\d{2}-\d{2}$/, 'Vietnam date must be YYYY-MM-DD');

  // Normalization
  assert.strictEqual(normalizeDateToVietnamYmd('2026-10-15'), '2026-10-15');
  assert.strictEqual(normalizeDateToVietnamYmd(new Date('2026-10-15T00:00:00.000Z')), '2026-10-15');
});

test('G-calendar 2: Calendar rollover across months, years, and February leap vs non-leap', () => {
  // Rollover across months (31-day month to next month)
  assert.strictEqual(calculateDueDate('2026-01-20', 14), '2026-02-03');
  assert.strictEqual(calculateDueDate('2026-03-25', 14), '2026-04-08');

  // Rollover across years
  assert.strictEqual(calculateDueDate('2025-12-25', 14), '2026-01-08');

  // February in non-leap year (2026: Feb has 28 days)
  assert.strictEqual(calculateDueDate('2026-02-20', 14), '2026-03-06');

  // February in leap year (2024: Feb has 29 days)
  assert.strictEqual(calculateDueDate('2024-02-20', 14), '2024-03-05');

  // Rejection of invalid calendar dates (e.g. 2026-02-30)
  assert.throws(
    () => calculateDueDate('2026-02-30', 14),
    /không hợp lệ/,
    'Invalid calendar date like 2026-02-30 must be strictly rejected'
  );
});

test('G-calendar 3: Holiday and duty shift adjustments (Tue/Thu schedule without consuming renew_count)', () => {
  const holidays = ['2026-04-30', '2026-05-01'];

  // 2026-04-16 + 14d = 2026-04-30 (Thursday, national holiday)
  // calculateEffectiveDueDate shifts past holiday, weekend, Monday to Tuesday 2026-05-05!
  const res = calculateEffectiveDueDate('2026-04-16', 14, holidays);
  assert.strictEqual(res.isHolidayAdjusted, true);
  assert.strictEqual(res.originalDueDate, '2026-04-30');
  assert.strictEqual(res.effectiveDueDate, '2026-05-05');
  assert.ok(res.adjustmentReason?.includes('2026-04-30'));

  // If due date lands on Friday (2026-10-02 + 14d = 2026-10-16), shifts to next Tuesday (2026-10-20)
  const resFri = calculateEffectiveDueDate('2026-10-02', 14, []);
  assert.strictEqual(resFri.originalDueDate, '2026-10-16');
  assert.strictEqual(resFri.effectiveDueDate, '2026-10-20');
});

test('G-calendar 4: Exhausting consecutive holiday bound (>60 days) safely throws NoValidDutyShiftFoundError', () => {
  // Create an extensive holiday array covering next 100 days
  const endlessHolidays: string[] = [];
  let cur = '2026-10-01';
  for (let i = 0; i < 100; i++) {
    endlessHolidays.push(cur);
    cur = calculateDueDate(cur, 1);
  }

  assert.throws(
    () => calculateEffectiveDueDate('2026-10-01', 14, endlessHolidays),
    (err: any) => err instanceof NoValidDutyShiftFoundError || err.code === 'NO_VALID_DUTY_SHIFT_FOUND',
    'Exhausting 60-day safety loop must fail closed with NO_VALID_DUTY_SHIFT_FOUND'
  );
});

// =========================================================================
// 2. GATE G-renew-in-time: In-time renewal (+14d from current due date, max 3 limit)
// =========================================================================

test('G-renew-in-time 1: In-time renewal bases +14d from current due date, not early request date', async () => {
  const db = createMockEnvironment();

  // 1. Issue loan: due date = today + 14d (or shifted)
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  assert.strictEqual(loan.renewCount, 0);
  const currentDueDate = loan.dueDate;

  // 2. Early renewal request on today (before due date):
  // Base date must be currentDueDate (+14d shifted to regular duty day)
  const expectedNewDueDate = calculateEffectiveDueDate(currentDueDate, 14, []).effectiveDueDate;

  const renew1 = await renewLoanReceipt(
    db,
    {
      receiptId: loan.id,
      notes: 'Gia hạn sớm lần 1',
    },
    'mem-admin-01'
  );

  assert.strictEqual(renew1.renewalSequence, 1);
  assert.strictEqual(renew1.renewCount, 1);
  assert.strictEqual(renew1.isOverdue, false);
  assert.strictEqual(renew1.overdueDays, 0);
  assert.strictEqual(renew1.fineFinal, 0);
  assert.strictEqual(renew1.previousDueDate, currentDueDate);
  assert.strictEqual(renew1.newDueDate, expectedNewDueDate);

  // Verify DB state: physical copy remains BORROWED, receipt ACTIVE, renew_count = 1
  const copy = db.bookCopies.find((c) => c.barcode === 'BC-RNW-01');
  assert.strictEqual(copy.status, 'BORROWED');
  const r = db.loanReceipts.find((lr) => lr.id === loan.id);
  assert.strictEqual(r.status, 'ACTIVE');
  assert.strictEqual(r.renew_count, 1);
  assert.strictEqual(r.due_date, expectedNewDueDate);
});

test('G-renew-in-time 2: Maximum 3 renewals enforced - 4th renewal rejected with 409 MaxRenewalsExceededError', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  // 1st renewal
  const rnw1 = await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
  assert.strictEqual(rnw1.renewCount, 1);
  const expectedDue1 = calculateEffectiveDueDate(loan.dueDate, 14, []).effectiveDueDate;
  assert.strictEqual(rnw1.newDueDate, expectedDue1);

  // 2nd renewal
  const rnw2 = await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
  assert.strictEqual(rnw2.renewCount, 2);
  const expectedDue2 = calculateEffectiveDueDate(expectedDue1, 14, []).effectiveDueDate;
  assert.strictEqual(rnw2.newDueDate, expectedDue2);

  // 3rd renewal
  const rnw3 = await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
  assert.strictEqual(rnw3.renewCount, 3);
  const expectedDue3 = calculateEffectiveDueDate(expectedDue2, 14, []).effectiveDueDate;
  assert.strictEqual(rnw3.newDueDate, expectedDue3);

  // 4th renewal: MUST be rejected with MaxRenewalsExceededError (409)
  await assert.rejects(
    async () => {
      await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
    },
    (err: any) => {
      assert.ok(err instanceof MaxRenewalsExceededError || err.code === 'MAX_RENEWALS_EXCEEDED');
      assert.strictEqual(err.httpStatus, 409);
      return true;
    }
  );

  // History query should return exactly 3 records in order
  const history = await getLoanRenewals(db, loan.id);
  assert.strictEqual(history.length, 3);
  assert.strictEqual(history[0].renewalSequence, 1);
  assert.strictEqual(history[1].renewalSequence, 2);
  assert.strictEqual(history[2].renewalSequence, 3);
});

test('G-renew-in-time 3: Rejects renewal on terminal receipts (RETURNED, PARTIAL_SETTLED, PENDING_DEPOSIT)', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const r = db.loanReceipts.find((lr) => lr.id === loan.id);

  // 1. RETURNED status
  r.status = 'RETURNED';
  await assert.rejects(
    async () => {
      await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
    },
    (err: any) => err.code === 'INVALID_LOAN_STATUS_FOR_RENEWAL' || err instanceof InvalidLoanStatusForRenewalError
  );

  // 2. PARTIAL_SETTLED status
  r.status = 'PARTIAL_SETTLED';
  await assert.rejects(
    async () => {
      await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
    },
    (err: any) => err.code === 'INVALID_LOAN_STATUS_FOR_RENEWAL' || err instanceof InvalidLoanStatusForRenewalError
  );

  // 3. PENDING_DEPOSIT status
  r.status = 'PENDING_DEPOSIT';
  await assert.rejects(
    async () => {
      await renewLoanReceipt(db, { receiptId: loan.id }, 'mem-admin-01');
    },
    (err: any) => err.code === 'INVALID_LOAN_STATUS_FOR_RENEWAL' || err instanceof InvalidLoanStatusForRenewalError
  );
});

// =========================================================================
// 3. GATE G-renew-overdue: Overdue renewal (+14d from today, fine decision & collection)
// =========================================================================

test('G-renew-overdue 1: Overdue renewal bases +14d from today, closes fine decision, records cash fine', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  // Set due date to 10 days ago (overdue)
  const r = db.loanReceipts.find((lr) => lr.id === loan.id);
  const today = getCurrentVietnamDate();
  const pToday = today.split('-').map(Number);
  const tenDaysAgoUtc = new Date(Date.UTC(pToday[0], pToday[1] - 1, pToday[2] - 10));
  const pastDueDate = tenDaysAgoUtc.toISOString().split('T')[0];

  r.due_date = pastDueDate;
  r.status = 'OVERDUE';

  const initialDrawer = BigInt(db.cashSessions[0].expected_closing_cash);

  // Overdue renewal with finePaymentConfirmed = true
  const rnw = await renewLoanReceipt(
    db,
    {
      receiptId: loan.id,
      finePaymentMethod: 'CASH',
      finePaymentConfirmed: true,
      notes: 'Gia hạn quá hạn 10 ngày',
    },
    'mem-admin-01'
  );

  assert.strictEqual(rnw.isOverdue, true);
  assert.strictEqual(rnw.overdueDays, 10);
  assert.strictEqual(rnw.fineSuggested, 10000);
  assert.strictEqual(rnw.fineFinal, 10000);
  assert.strictEqual(rnw.fineCollected, true);
  assert.strictEqual(rnw.finePending, false);
  assert.strictEqual(rnw.fineStatus, 'COLLECTED');

  // New due date should be calculated from today (+14d shifted to regular duty day)
  const expectedEffective = calculateEffectiveDueDate(today, 14, []).effectiveDueDate;
  assert.strictEqual(rnw.newDueDate, expectedEffective);

  // Cash drawer increased by 10.000₫
  const finalDrawer = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.strictEqual(finalDrawer, initialDrawer + 10000n);

  // Journal entry recorded
  const renewal = db.loanRenewals.find((r) => r.receipt_id === loan.id);
  const fineJe = db.journalEntries.find(
    (je) => je.source_type === 'LOAN_FINE' && (je.source_id === renewal?.id || je.source_id === loan.id)
  );
  assert.ok(fineJe);
  assert.strictEqual(BigInt(fineJe.amount), 10000n);
});

test('G-renew-overdue 2: S10-06 Policy Gate: Overdue renewal with pending fine is rejected with RENEWAL_PENDING_FINE_NOT_ALLOWED', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const r = db.loanReceipts.find((lr) => lr.id === loan.id);
  const today = getCurrentVietnamDate();
  const pToday = today.split('-').map(Number);
  const fiveDaysAgoUtc = new Date(Date.UTC(pToday[0], pToday[1] - 1, pToday[2] - 5));
  r.due_date = fiveDaysAgoUtc.toISOString().split('T')[0];
  r.status = 'OVERDUE';

  // Fine payment NOT confirmed -> Policy gate S10-06 blocks renewal with RENEWAL_PENDING_FINE_NOT_ALLOWED
  await assert.rejects(
    async () => {
      await renewLoanReceipt(
        db,
        {
          receiptId: loan.id,
          finePaymentMethod: 'CASH',
          finePaymentConfirmed: false,
        },
        'mem-admin-01'
      );
    },
    (err: any) => err.code === 'RENEWAL_PENDING_FINE_NOT_ALLOWED' || err.statusCode === 400
  );
});

test('G-renew-overdue 3: Waived fine requires fineReason; missing reason throws FineReasonRequiredError', async () => {
  const db = createMockEnvironment();

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const r = db.loanReceipts.find((lr) => lr.id === loan.id);
  const today = getCurrentVietnamDate();
  const pToday = today.split('-').map(Number);
  const threeDaysAgoUtc = new Date(Date.UTC(pToday[0], pToday[1] - 1, pToday[2] - 3));
  r.due_date = threeDaysAgoUtc.toISOString().split('T')[0];
  r.status = 'OVERDUE';

  // Waive fine (fineAmount: 0) without reason -> throws FineReasonRequiredError
  await assert.rejects(
    async () => {
      await renewLoanReceipt(
        db,
        {
          receiptId: loan.id,
          fineAmount: 0,
        },
        'mem-admin-01'
      );
    },
    (err: any) => err instanceof FineReasonRequiredError || err.code === 'FINE_REASON_REQUIRED'
  );

  // Waive fine with explicit reason -> success with fineStatus: 'WAIVED'
  const rnw = await renewLoanReceipt(
    db,
    {
      receiptId: loan.id,
      fineAmount: 0,
      fineReason: 'Miễn phạt do bạn đọc bị ốm nằm viện có giấy tờ',
    },
    'mem-admin-01'
  );

  assert.strictEqual(rnw.fineFinal, 0);
  assert.strictEqual(rnw.fineStatus, 'WAIVED');
});

// =========================================================================
// 4. GATE G-money-recovery: T73 Confirm New Deposit & Late Fine Collection
// =========================================================================

test('G-money-recovery 1: T73 confirmNewDeposit finalizes pending deposit and activates receipt', async () => {
  const db = createMockEnvironment();

  // 1. Create a loan receipt with 2 books
  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01', 'BC-RNW-02'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 150000,
    },
    'mem-admin-01'
  );

  // 2. Perform partial return where fine >= deposit (forfeit all deposit), but newDepositConfirmed = false
  const settleRes = await settleReturnReceipt(
    db,
    {
      receiptId: loan.id,
      returnedBarcodes: ['BC-RNW-01'],
      returnType: 'PARTIAL',
      fineAmount: 150000,
      fineReason: 'Sách hỏng nặng tịch thu toàn bộ cọc',
      newDepositConfirmed: false,
    },
    'mem-admin-01'
  );

  assert.strictEqual(settleRes.status, 'PARTIAL_SETTLED');
  assert.ok(settleRes.newReceiptId);

  // New receipt is in PENDING_DEPOSIT status
  const newReceipt = db.loanReceipts.find((lr) => lr.id === settleRes.newReceiptId);
  assert.strictEqual(newReceipt.status, 'PENDING_DEPOSIT');

  const pendingAlloc = db.depositAllocations.find((a) => a.receipt_id === newReceipt.id);
  assert.strictEqual(pendingAlloc.status, 'PENDING_COLLECTION');

  const drawerBefore = BigInt(db.cashSessions[0].expected_closing_cash);

  // 3. Confirm new deposit in a subsequent turn/session
  const confirmRes = await confirmNewDeposit(
    db,
    {
      receiptId: newReceipt.id,
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    'mem-admin-01'
  );

  assert.strictEqual(confirmRes.status, 'ACTIVE');
  assert.strictEqual(confirmRes.depositAmount, 100000);
  assert.strictEqual(newReceipt.status, 'ACTIVE');
  assert.strictEqual(pendingAlloc.status, 'HELD');

  // Drawer increased by 100k
  const drawerAfter = BigInt(db.cashSessions[0].expected_closing_cash);
  assert.strictEqual(drawerAfter, drawerBefore + 100000n);
});

// =========================================================================
// 5. GATE G-auth-contract: HTTP API, RBAC barriers & Idempotency Replay
// =========================================================================

test('G-auth-contract 1: HTTP API role barriers for /api/v1/circulation/loans/:id/renew', async () => {
  const db = createMockEnvironment();
  const injection = createTestInjection(db);

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const env = { JWT_SECRET: 'test-secret-key-32-chars-long-ysbk!' } as any;

  // 1. Anonymous -> 401
  const anonReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'IDEM-ANON' },
    body: JSON.stringify({}),
  });
  const anonRes = await handleRequest(anonReq, env, injection);
  assert.strictEqual(anonRes.status, 401);

  // 2. Guest user -> 403
  const guestToken = await signSessionToken(
    { userId: 'usr-guest', role: 'GUEST', isAlumni: false, isActive: true, tokenVersion: 1 },
    env.JWT_SECRET
  );
  const guestReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`,
      'X-Idempotency-Key': 'IDEM-GUEST',
    },
    body: JSON.stringify({}),
  });
  const guestRes = await handleRequest(guestReq, env, injection);
  assert.strictEqual(guestRes.status, 403);

  // 3. Alumni member -> 403
  const alumniToken = await signSessionToken(
    { userId: 'usr-alumni', memberId: 'mem-alumni-01', role: 'MEMBER', isAlumni: true, isActive: true, tokenVersion: 1 },
    env.JWT_SECRET
  );
  const alumniReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${alumniToken}`,
      'X-Idempotency-Key': 'IDEM-ALUMNI',
    },
    body: JSON.stringify({}),
  });
  const alumniRes = await handleRequest(alumniReq, env, injection);
  assert.strictEqual(alumniRes.status, 403);

  // 4. Internal member -> 200 OK + Cache-Control: no-store
  const memberToken = await signSessionToken(
    { userId: 'usr-mem', memberId: 'mem-01', role: 'MEMBER', isAlumni: false, isActive: true, tokenVersion: 1 },
    env.JWT_SECRET
  );
  const memberReq = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`,
      'X-Idempotency-Key': 'IDEM-MEM-01',
    },
    body: JSON.stringify({ notes: 'HTTP renew test' }),
  });
  const memberRes = await handleRequest(memberReq, env, injection);
  assert.strictEqual(memberRes.status, 200);
  assert.strictEqual(memberRes.headers.get('Cache-Control'), 'no-store');

  const json = await memberRes.json();
  assert.strictEqual(json.data.renewCount, 1);
});

test('G-auth-contract 2: Idempotency replay on renewal returns cached response without duplicate increment', async () => {
  const db = createMockEnvironment();
  const injection = createTestInjection(db);

  const loan = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-01',
      barcodes: ['BC-RNW-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 50000,
    },
    'mem-admin-01'
  );

  const env = { JWT_SECRET: 'test-secret-key-32-chars-long-ysbk!' } as any;
  const token = await signSessionToken(
    { userId: 'usr-admin', memberId: 'mem-admin-01', role: 'ADMIN', isAlumni: false, isActive: true, tokenVersion: 1 },
    env.JWT_SECRET
  );

  const key = 'IDEM-RENEW-REPLAY-99';
  const payload = { notes: 'Replay renewal test' };

  // First request
  const req1 = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
  });
  const res1 = await handleRequest(req1, env, injection);
  assert.strictEqual(res1.status, 200);
  const json1 = await res1.json();
  assert.strictEqual(json1.data.renewCount, 1);

  // Exact replay with same key and payload
  const req2 = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
  });
  const res2 = await handleRequest(req2, env, injection);
  assert.strictEqual(res2.status, 200);
  const json2 = await res2.json();
  assert.strictEqual(json2.data.renewCount, 1);
  assert.strictEqual(json2.data.newDueDate, json1.data.newDueDate);

  // Tampered payload with same key -> 409 Conflict
  const reqTamper = new Request(`http://localhost/api/v1/circulation/loans/${loan.id}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': key,
    },
    body: JSON.stringify({ notes: 'Tampered notes' }),
  });
  const resTamper = await handleRequest(reqTamper, env, injection);
  assert.strictEqual(resTamper.status, 409);
});

test('G-auth-contract 3: Calendar holiday endpoints (GET list and POST add/update)', async () => {
  const db = createMockEnvironment();
  const injection = createTestInjection(db);
  const env = { JWT_SECRET: 'test-secret-key-32-chars-long-ysbk!' } as any;
  const token = await signSessionToken(
    { userId: 'usr-admin', memberId: 'mem-admin-01', role: 'ADMIN', isAlumni: false, isActive: true, tokenVersion: 1 },
    env.JWT_SECRET
  );

  // Add a holiday
  const postReq = new Request('http://localhost/api/v1/circulation/calendar/holidays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      holidayDate: '2026-04-30',
      name: 'Ngày Giải phóng miền Nam',
      description: 'Nghỉ lễ 30/4',
    }),
  });
  const postRes = await handleRequest(postReq, env, injection);
  assert.strictEqual(postRes.status, 201);

  // List holidays (public / member)
  const getReq = new Request('http://localhost/api/v1/circulation/calendar/holidays', {
    method: 'GET',
  });
  const getRes = await handleRequest(getReq, env, injection);
  assert.strictEqual(getRes.status, 200);
  const getJson = await getRes.json();
  assert.strictEqual(getJson.data.length, 1);
  assert.strictEqual(getJson.data[0].holidayDate, '2026-04-30');
  assert.strictEqual(getJson.data[0].name, 'Ngày Giải phóng miền Nam');
});
