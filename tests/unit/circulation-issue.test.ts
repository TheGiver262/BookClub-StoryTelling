import test from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import { issueLoanReceipt } from '../../src/server/circulation/service.ts';
import { calculateDueDate, getCurrentVietnamDate } from '../../src/server/circulation/rules.ts';
import { calculateDeposit } from '../../src/server/catalog/rules.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import type { AuthenticatedActor, Env } from '../../src/server/types.ts';

const TEST_SECRET = 'unit_test_jwt_secret_min_32_characters_long_12345';
const TEST_ENV: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: TEST_SECRET,
};

const createFixtures = (db: MockCashDbQueryable = new MockCashDbQueryable()) => ({
  membersDb: {
    '00000000-0000-0000-0000-000000000001': {
      id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Nguyễn Tiến Dũng',
      username: 'member.test',
      team: 'BAN_CHU_NHIEM',
      is_eligible_main_duty: true,
      has_paid_fee: true,
      is_alumni: false,
      is_admin: true,
      is_active: true,
      token_version: 1,
    },
    '00000000-0000-0000-0000-000000000002': {
      id: '00000000-0000-0000-0000-000000000002',
      full_name: 'Nguyễn Thị Ánh',
      username: 'thanhvien.chuan',
      team: 'HAU_CAN',
      is_eligible_main_duty: true,
      has_paid_fee: true,
      is_alumni: false,
      is_admin: false,
      is_active: true,
      token_version: 1,
    },
    '00000000-0000-0000-0000-000000000005': {
      id: '00000000-0000-0000-0000-000000000005',
      full_name: 'Trần Văn Thắng',
      username: 'cuu.thanhvien',
      team: 'HAU_CAN',
      is_eligible_main_duty: false,
      has_paid_fee: true,
      is_alumni: true,
      is_admin: false,
      is_active: true,
      token_version: 1,
    },
  },
  revokedTokenHashes: new Set<string>(),
  queryable: db,
});

function seedDbWithBaseData(db: MockCashDbQueryable) {
  // 1. Session đang mở
  db.cashSessions.push({
    id: 'CS-20261019-01',
    session_date: '2026-10-19',
    opened_by: '00000000-0000-0000-0000-000000000001',
    opened_at: new Date().toISOString(),
    opening_cash: '200000',
    expected_closing_cash: '200000',
    actual_closing_cash: null,
    discrepancy: null,
    discrepancy_reason: null,
    is_closed: false,
    closed_at: null,
    closed_by: null,
    handed_over_from_session_id: null,
  });

  // 2. Borrower hoạt động
  db.borrowers.push({
    id: 'bor-001',
    full_name: 'Nguyễn Văn An',
    phone: '0988776655',
    student_id: '20220001',
    school: 'ĐHBK Hà Nội',
    is_archived: false,
  });

  // 3. Title & Edition
  db.bookTitles.push({
    id: 'title-01',
    title: 'Giải Tích 1',
  });
  db.bookEditions.push({
    id: 'ed-01',
    title_id: 'title-01',
    publisher: 'NXB Bách Khoa',
  });

  // 4. Các bản sách mẫu với nhiều mốc giá bìa
  db.bookCopies.push(
    {
      id: 'copy-null-price',
      edition_id: 'ed-01',
      barcode: 'BK-NULL-01',
      location: 'KHO_THU_VIEN',
      status: 'AVAILABLE',
      cover_price: null,
    },
    {
      id: 'copy-zero-price',
      edition_id: 'ed-01',
      barcode: 'BK-ZERO-01',
      location: 'KHO_THU_VIEN',
      status: 'AVAILABLE',
      cover_price: '0',
    },
    {
      id: 'copy-74k',
      edition_id: 'ed-01',
      barcode: 'BK-74K-01',
      location: 'KHO_THU_VIEN',
      status: 'AVAILABLE',
      cover_price: '74000',
    },
    {
      id: 'copy-75k',
      edition_id: 'ed-01',
      barcode: 'BK-75K-01',
      location: 'KHO_THU_VIEN',
      status: 'AVAILABLE',
      cover_price: '75000',
    },
    {
      id: 'copy-230k',
      edition_id: 'ed-01',
      barcode: 'BK-230K-01',
      location: 'KHO_THU_VIEN',
      status: 'AVAILABLE',
      cover_price: '230000',
    }
  );
}

test('G-issue-unit 1: Single book and two distinct books loan receipt creation', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // 1 bản sách (BK-74K-01 cọc 50k)
  const res1 = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-74K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );

  assert.strictEqual(res1.status, 'ACTIVE');
  assert.strictEqual(res1.items.length, 1);
  assert.strictEqual(res1.items[0].barcode, 'BK-74K-01');
  assert.strictEqual(res1.items[0].depositSnapshot, 50000);
  assert.strictEqual(res1.totalDeposit, 50000);
  assert.strictEqual(res1.paymentMethod, 'CASH');

  // Kiểm tra trạng thái copy chuyển thành BORROWED
  const c1 = db.bookCopies.find((c) => c.barcode === 'BK-74K-01');
  assert.strictEqual(c1?.status, 'BORROWED');

  // 2 bản sách khác nhau (BK-75K-01 cọc 100k + BK-230K-01 cọc 250k = 350k)
  const res2 = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-75K-01', 'BK-230K-01'],
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
    },
    actorId
  );

  assert.strictEqual(res2.items.length, 2);
  assert.strictEqual(res2.totalDeposit, 350000);
  assert.strictEqual(res2.paymentMethod, 'BANK_TRANSFER');
  assert.strictEqual(db.bookCopies.find((c) => c.barcode === 'BK-75K-01')?.status, 'BORROWED');
  assert.strictEqual(db.bookCopies.find((c) => c.barcode === 'BK-230K-01')?.status, 'BORROWED');
});

test('G-issue-unit 2: Validation rejects: 0 books, 3 books (>2), duplicate books in loan', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // 0 bản sách
  await assert.rejects(
    () =>
      issueLoanReceipt(
        db,
        {
          borrowerId: 'bor-001',
          barcodes: [],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
        },
        actorId
      ),
    /Phiếu mượn phải chứa ít nhất 1 bản sách/
  );

  // 3 bản sách (>2)
  await assert.rejects(
    () =>
      issueLoanReceipt(
        db,
        {
          borrowerId: 'bor-001',
          barcodes: ['BK-74K-01', 'BK-75K-01', 'BK-230K-01'],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
        },
        actorId
      ),
    /Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách/
  );

  // Trùng bản sách trong 1 phiếu
  await assert.rejects(
    () =>
      issueLoanReceipt(
        db,
        {
          borrowerId: 'bor-001',
          barcodes: ['BK-74K-01', 'BK-74K-01'],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
        },
        actorId
      ),
    /Không thể mượn cùng một mã vạch 2 lần trong một phiếu/
  );
});

test('G-issue-unit 3: Deposit calculation formula for copies: NULL, 0d, 20k, 51k, 74k, 75k, 151k, 230k', () => {
  // Công thức: max(50000, floor((price + 25000) / 50000) * 50000)
  assert.strictEqual(calculateDeposit(null), 50000n);
  assert.strictEqual(calculateDeposit(0n), 50000n);
  assert.strictEqual(calculateDeposit(20000n), 50000n);
  assert.strictEqual(calculateDeposit(51000n), 50000n);
  assert.strictEqual(calculateDeposit(74000n), 50000n);
  assert.strictEqual(calculateDeposit(75000n), 100000n);
  assert.strictEqual(calculateDeposit(151000n), 150000n);
  assert.strictEqual(calculateDeposit(230000n), 250000n);
});

test('G-issue-unit 4: Client tamper proof - server overrides client deposit/dueDate/renewCount', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Client cố tình truyền depositAmount: 1000, dueDate: 2099-01-01, renewCount: 99
  const res = await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-75K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      depositAmount: 1000,
      dueDate: '2099-01-01',
      renewCount: 99,
    } as any,
    actorId
  );

  // Server tính độc lập từ copy đã khóa: 75k -> 100k
  assert.strictEqual(res.totalDeposit, 100000);
  assert.strictEqual(res.items[0].depositSnapshot, 100000);
  assert.strictEqual(res.renewCount, 0);
  assert.notStrictEqual(res.dueDate, '2099-01-01');
});

test('G-issue-unit 5: Due date is calculated exactly +14 calendar days in Vietnam timezone', () => {
  const vnDate = getCurrentVietnamDate();
  const dueDate = calculateDueDate(vnDate, 14);

  const start = new Date(`${vnDate}T00:00:00+07:00`);
  const end = new Date(`${dueDate}T00:00:00+07:00`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  assert.strictEqual(diffDays, 14);
  assert.strictEqual(calculateDueDate('2026-10-01', 14), '2026-10-15');
});

test('G-issue-unit 6: Unconfirmed payment rejected with PaymentUnconfirmedError', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // paymentConfirmed = false
  await assert.rejects(
    () =>
      issueLoanReceipt(
        db,
        {
          borrowerId: 'bor-001',
          barcodes: ['BK-74K-01'],
          paymentMethod: 'CASH',
          paymentConfirmed: false,
        },
        actorId
      ),
    /Thành viên phải xác nhận đã nhận/
  );

  // paymentConfirmed missing / undefined
  await assert.rejects(
    () =>
      issueLoanReceipt(
        db,
        {
          borrowerId: 'bor-001',
          barcodes: ['BK-74K-01'],
          paymentMethod: 'CASH',
        } as any,
        actorId
      ),
    /Thành viên phải xác nhận đã nhận/
  );
});

test('G-cash-bank 1: CASH increases expected cash float, BANK_TRANSFER leaves expected cash untouched', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  const sessionBefore = db.cashSessions[0];
  assert.strictEqual(sessionBefore.expected_closing_cash, '200000');

  // 1. Nhận cọc CASH 50k
  await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-74K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );
  assert.strictEqual(db.cashSessions[0].expected_closing_cash, '250000');

  // 2. Nhận cọc BANK_TRANSFER 100k
  await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-75K-01'],
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
    },
    actorId
  );
  // expected cash của hộp tiền mặt không đổi, vẫn là 250k
  assert.strictEqual(db.cashSessions[0].expected_closing_cash, '250000');
});

test('G-cash-bank 2: Closed cash session strictly rejects issuing loan', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Đóng ca hiện tại
  db.cashSessions[0].is_closed = true;

  await assert.rejects(
    () =>
      issueLoanReceipt(
        db,
        {
          borrowerId: 'bor-001',
          sessionId: 'CS-20261019-01',
          barcodes: ['BK-74K-01'],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
        },
        actorId
      ),
    /Phiên quầy chỉ định đã đóng/
  );
});

test('G-cash-bank 3: Liability reconciliation balance maintained for all allocations', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Lập phiếu mượn 2 cuốn: CASH 50k + BANK 100k
  await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-74K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    },
    actorId
  );
  await issueLoanReceipt(
    db,
    {
      borrowerId: 'bor-001',
      barcodes: ['BK-75K-01'],
      paymentMethod: 'BANK_TRANSFER',
      paymentConfirmed: true,
    },
    actorId
  );

  const totalAlloc = db.depositAllocations.reduce((sum, a) => sum + BigInt(a.remaining_amount), 0n);
  const totalLiabilityCredit = db.journalEntries
    .filter((e) => e.credit_account === 'COC_PHAI_HOAN')
    .reduce((sum, e) => sum + BigInt(e.amount), 0n);

  assert.strictEqual(totalAlloc, 150000n);
  assert.strictEqual(totalLiabilityCredit, 150000n);
  assert.strictEqual(totalAlloc, totalLiabilityCredit);
});

test('G-money-recovery 1: Atomic rollback leaves zero leftover mutation on error', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);

  // Đặt sách thành BORROWED trước để gây lỗi CopyNotAvailableError
  db.bookCopies.find((c) => c.barcode === 'BK-74K-01')!.status = 'BORROWED';

  const memberActor: AuthenticatedActor = {
    userId: 'usr_mem',
    memberId: '00000000-0000-0000-0000-000000000001',
    username: 'member.test',
    email: 'member@ysbk.vn',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const token = await signSessionToken(memberActor, TEST_SECRET);

  const req = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'key-fail-001',
    },
    body: JSON.stringify({
      borrowerId: 'bor-001',
      barcodes: ['BK-74K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    }),
  });

  const res = await handleRequest(req, TEST_ENV, createFixtures(db));
  assert.strictEqual(res.status, 409);

  // Khẳng định Rollback: Không có loan_receipts, deposit_allocations, journal_entries hay idempotency record nào bị rò rỉ
  assert.strictEqual(db.loanReceipts.length, 0);
  assert.strictEqual(db.loanItems.length, 0);
  assert.strictEqual(db.depositAllocations.length, 0);
  assert.strictEqual(db.journalEntries.length, 0);
  assert.strictEqual(db.idempotencyRecords.length, 0);
});

test('G-money-recovery 2: Idempotency replay returns identical receipt; mismatch payload returns 409', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);

  const memberActor: AuthenticatedActor = {
    userId: 'usr_mem',
    memberId: '00000000-0000-0000-0000-000000000001',
    username: 'member.test',
    email: 'member@ysbk.vn',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const token = await signSessionToken(memberActor, TEST_SECRET);
  const idempotencyKey = 'idemp-circulation-001';

  const payload = {
    borrowerId: 'bor-001',
    barcodes: ['BK-74K-01'],
    paymentMethod: 'CASH',
    paymentConfirmed: true,
  };

  const fixtures = createFixtures(db);

  // Lần 1: Tạo phiếu mượn thành công (201)
  const req1 = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const res1 = await handleRequest(req1, TEST_ENV, fixtures);
  assert.strictEqual(res1.status, 201);
  const body1 = (await res1.json()) as any;
  const receiptId = body1.data.id;
  const receiptNum = body1.data.receiptNumber;

  // Lần 2: Replay cùng key và cùng payload -> Trả về kết quả cached giống hệt
  const req2 = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const res2 = await handleRequest(req2, TEST_ENV, fixtures);
  assert.strictEqual(res2.status, 201);
  const body2 = (await res2.json()) as any;
  assert.strictEqual(body2.data.id, receiptId);
  assert.strictEqual(body2.data.receiptNumber, receiptNum);

  // Lần 3: Cùng key nhưng payload khác -> Bị từ chối 409
  const req3 = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...payload, barcodes: ['BK-75K-01'] }),
  });

  const res3 = await handleRequest(req3, TEST_ENV, fixtures);
  assert.strictEqual(res3.status, 409);
});

test('G-catalog 1: Title and Edition HTTP API creation with price 0d vs NULL', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);

  const memberActor: AuthenticatedActor = {
    userId: 'usr_mem',
    memberId: '00000000-0000-0000-0000-000000000001',
    username: 'cataloger',
    email: 'cat@ysbk.vn',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const token = await signSessionToken(memberActor, TEST_SECRET);
  const fixtures = createFixtures(db);

  // 1. Tạo Title mới
  const titleReq = new Request('http://localhost/api/v1/books/titles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Vật Lý Đại Cương 1',
      originalTitle: 'General Physics I',
      authors: ['Nguyễn Thành Kim'],
      categories: ['Giáo Trình Cơ Bản'],
    }),
  });

  const titleRes = await handleRequest(titleReq, TEST_ENV, fixtures);
  assert.strictEqual(titleRes.status, 201);
  const titleData = (await titleRes.json()) as any;
  assert.strictEqual(titleData.data.title, 'Vật Lý Đại Cương 1');
  const titleId = titleData.data.id;

  // 2. Tạo Edition mới
  const edReq = new Request(`http://localhost/api/v1/books/${titleId}/editions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publisher: 'NXB Giáo Dục',
      publishYear: 2023,
      isbn: '978-604-0-12345-6',
    }),
  });

  const edRes = await handleRequest(edReq, TEST_ENV, fixtures);
  assert.strictEqual(edRes.status, 201);
  const edData = (await edRes.json()) as any;
  assert.strictEqual(edData.data.publisher, 'NXB Giáo Dục');
  assert.strictEqual(edData.data.isbn, '978-604-0-12345-6');
});

test('G-http-auth 1: Role barriers and Cache-Control: no-store for circulation endpoints', async () => {
  const db = new MockCashDbQueryable();
  seedDbWithBaseData(db);

  const guestActor: AuthenticatedActor = {
    userId: 'usr_guest',
    username: 'khach.thamquan',
    email: 'khach@gmail.com',
    role: 'GUEST',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const alumniActor: AuthenticatedActor = {
    userId: 'usr_alumni',
    memberId: '00000000-0000-0000-0000-000000000005',
    username: 'cuu.thanhvien',
    email: 'alumni@gmail.com',
    role: 'MEMBER',
    isAlumni: true,
    isActive: true,
    tokenVersion: 1,
  };
  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'thanhvien.chuan',
    email: 'member@ysbk.vn',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const guestToken = await signSessionToken(guestActor, TEST_SECRET);
  const alumniToken = await signSessionToken(alumniActor, TEST_SECRET);
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);
  const fixtures = createFixtures(db);

  // 1. Anonymous truy cập POST /api/v1/circulation/loans -> 401
  const anonReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'k-anon' },
    body: JSON.stringify({ borrowerId: 'bor-001', barcodes: ['BK-74K-01'], paymentConfirmed: true }),
  });
  const anonRes = await handleRequest(anonReq, TEST_ENV, fixtures);
  assert.strictEqual(anonRes.status, 401);

  // 2. Guest truy cập POST /api/v1/circulation/loans -> 403
  const guestReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${guestToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'k-guest',
    },
    body: JSON.stringify({ borrowerId: 'bor-001', barcodes: ['BK-74K-01'], paymentConfirmed: true }),
  });
  const guestRes = await handleRequest(guestReq, TEST_ENV, fixtures);
  assert.strictEqual(guestRes.status, 403);

  // 3. Alumni truy cập GET /api/v1/circulation/loans -> 403
  const alumniReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'GET',
    headers: { Authorization: `Bearer ${alumniToken}` },
  });
  const alumniRes = await handleRequest(alumniReq, TEST_ENV, fixtures);
  assert.strictEqual(alumniRes.status, 403);

  // 4. Member thiếu X-Idempotency-Key -> 400
  const noKeyReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ borrowerId: 'bor-001', barcodes: ['BK-74K-01'], paymentConfirmed: true }),
  });
  const noKeyRes = await handleRequest(noKeyReq, TEST_ENV, fixtures);
  assert.strictEqual(noKeyRes.status, 400);

  // 5. Member thành công -> 201 và có Cache-Control: no-store
  const memberReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'k-member-success',
    },
    body: JSON.stringify({
      borrowerId: 'bor-001',
      barcodes: ['BK-74K-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
    }),
  });
  const memberRes = await handleRequest(memberReq, TEST_ENV, fixtures);
  assert.strictEqual(memberRes.status, 201);
  assert.strictEqual(memberRes.headers.get('Cache-Control'), 'no-store');
  const createdBody = (await memberRes.json()) as any;
  const loanId = createdBody.data.id;

  // 6. Member GET detail theo ID -> 200 và có Cache-Control: no-store
  const detailReq = new Request(`http://localhost/api/v1/circulation/loans/${loanId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const detailRes = await handleRequest(detailReq, TEST_ENV, fixtures);
  assert.strictEqual(detailRes.status, 200);
  assert.strictEqual(detailRes.headers.get('Cache-Control'), 'no-store');
  const detailBody = (await detailRes.json()) as any;
  assert.strictEqual(detailBody.data.id, loanId);

  // 7. Member GET list -> 200 và có Cache-Control: no-store
  const listReq = new Request('http://localhost/api/v1/circulation/loans', {
    method: 'GET',
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const listRes = await handleRequest(listReq, TEST_ENV, fixtures);
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.headers.get('Cache-Control'), 'no-store');
  const listBody = (await listRes.json()) as any;
  assert.strictEqual(listBody.data.length, 1);
});
