process.env.RESERVATION_IP_SECRET = 'synthetic-reservation-unit-secret-2026';
import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReservationStatus, CreateReservationInput, PublicReservationDto } from '../../src/server/reservations/types.ts';

test('PR-1 Contract: ReservationStatus enum and DTO fields conform to design', () => {
  const validStatuses: ReservationStatus[] = ['HELD', 'BORROWED', 'RETURNED', 'CANCELLED', 'EXPIRED'];
  assert.equal(validStatuses.length, 5);

  const sampleInput: CreateReservationInput = {
    titleId: 'title-uuid-001',
    scheduleId: 'sched-uuid-001',
    fullName: 'Nguyen Van A',
    phone: '0912345678',
  };
  assert.ok(sampleInput.titleId);
  assert.ok(sampleInput.scheduleId);
  assert.ok(sampleInput.fullName);
  assert.ok(sampleInput.phone);

  const sampleDto: PublicReservationDto = {
    id: 'res-uuid-001',
    code: 'RSV-20261020-001',
    status: 'HELD',
    titleId: sampleInput.titleId,
    bookTitle: 'To Kill a Mockingbird',
    authorName: 'Harper Lee',
    scheduleId: sampleInput.scheduleId,
    shiftDate: '2026-10-20',
    shiftTime: '14:00 - 17:00',
    pickupLocation: 'Bàn trực sảnh B',
    expiresAt: '2026-10-20T17:00:00+07:00',
    estimatedDeposit: 50000,
    createdAt: '2026-10-20T14:05:00+07:00',
  };
  assert.equal(sampleDto.status, 'HELD');
  assert.equal(sampleDto.estimatedDeposit, 50000);
});

test('PR-1 Schema: Migration 13 exists and contains quota locks & active hold constraint', () => {
  const migrationPath = path.resolve('docs/technical/schema/migrations/13_public_reservations.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration 13_public_reservations.sql phải tồn tại');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS reservation_quota_locks'), 'Phải tạo bảng reservation_quota_locks');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS reservations'), 'Phải tạo bảng reservations');
  assert.ok(content.includes('idx_unique_active_reservation_copy'), 'Phải có chỉ mục duy nhất 1 active hold per copy');
  assert.ok(content.includes('WHERE status = \'HELD\''), 'Chỉ mục duy nhất phải có điều kiện status = HELD');
  assert.ok(content.includes('idx_reservations_phone_status'), 'Phải có chỉ mục SĐT');
  assert.ok(content.includes('idx_reservations_ip_created'), 'Phải có chỉ mục IP 24h trượt');
  assert.ok(content.includes('idx_reservations_token_hash'), 'Phải có chỉ mục băm token tra cứu');
});

test('PR-1 Schema: 01_schema.sql contains public reservation tables', () => {
  const schemaPath = path.resolve('docs/technical/schema/01_schema.sql');
  const content = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(content.includes('reservation_quota_locks'), '01_schema.sql phải chứa reservation_quota_locks');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS reservations'), '01_schema.sql phải chứa bảng reservations');
  assert.ok(content.includes('idx_unique_active_reservation_copy'), '01_schema.sql phải chứa idx_unique_active_reservation_copy');
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-2: Tồn Giữ Chỗ & Hạn Mức Nguyên Tử (createReservation, Quotas, Idempotency)
// ─────────────────────────────────────────────────────────────────────────────
import {
  createReservation,
} from '../../src/server/reservations/service.ts';

function createMockDb(customHandlers: Record<string, (sql: string, params?: any[]) => any> = {}) {
  const queries: { sql: string; params?: any[] }[] = [];

  const db = {
    queries,
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });

      for (const [pattern, handler] of Object.entries(customHandlers)) {
        if (sql.includes(pattern)) {
          return handler(sql, params);
        }
      }

      // Default mock responses
      if (sql.includes('INSERT INTO reservation_quota_locks')) {
        return { rows: [] };
      }
      if (sql.includes('ip_hash = $1')) {
        return { rows: [] }; // IP quota: 0 used
      }
      if (sql.includes('phone = $1 AND status = \'HELD\'')) {
        return { rows: [{ count: '0' }] }; // Phone holds: 0
      }
      if (sql.includes('unreturned_count')) {
        return { rows: [{ unreturned_count: '0' }] }; // Active loans: 0
      }
      if (sql.includes('duty_schedules')) {
        return {
          rows: [
            {
              id: params?.[0] || 'sched-01',
              shift_date: '2026-10-20',
              time_range: '14:00 - 17:00',
              end_time: '17:00:00',
              location: 'Bàn trực sảnh B',
              is_published: true,
              status: 'PUBLISHED',
            },
          ],
        };
      }
      if (sql.includes('book_copies bc') && sql.includes('FOR UPDATE OF bc')) {
        return {
          rows: [
            {
              id: 'copy-01',
              barcode: 'BC-00100',
              cover_price: 120000,
              title_id: 'title-01',
              title: 'Lập trình TypeScript',
              author: 'Anders Hejlsberg',
              deposit_amount: 100000,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO reservations')) {
        return { rows: [{ id: 'res-new-001' }] };
      }

      return { rows: [] };
    },
  };

  return db;
}

test('PR-2 Service: createReservation thành công tạo đơn, tính cọc 50k và trả token bí mật', async () => {
  const db = createMockDb();
  const result = await createReservation(
    db as any,
    {
      titleId: 'title-01',
      scheduleId: 'sched-01',
      fullName: 'Tran Van B',
      phone: '0987654321',
    },
    {
      clientIp: '192.168.1.10',
      captchaToken: 'valid-captcha-token',
      now: new Date('2026-10-20T14:30:00+07:00'),
    }
  );

  assert.equal(result.isReplay, false);
  assert.ok(result.reservation.id);
  assert.ok(result.reservation.code.startsWith('RSV-'));
  assert.equal(result.reservation.status, 'HELD');
  assert.equal(result.reservation.estimatedDeposit, 100000); // 120k -> bội 50k gần nhất là 100k
  assert.ok(result.lookupToken.startsWith('rsv_tok_'));
});

test('PR-2 Service: Replay cùng idempotency key và cùng payload trả lại đơn cũ (isReplay: true)', async () => {
  const mockExisting = {
    id: 'res-exist-001',
    code: 'RSV-20261020-ABCD',
    title_id: 'title-01',
    schedule_id: 'sched-01',
    full_name: 'Tran Van B',
    phone: '0987654321',
    status: 'HELD',
    book_title: 'Lập trình TypeScript',
    author_name: 'Anders Hejlsberg',
    copy_barcode: 'BC-00100',
    shift_date: '2026-10-20',
    shift_time: '14:00 - 17:00',
    pickup_location: 'Bàn trực sảnh B',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    estimated_deposit: 100000,
    created_at: '2026-10-20T14:15:00+07:00',
  };

  const db = createMockDb({
    'WHERE r.idempotency_key = $1': () => ({
      rows: [mockExisting],
    }),
  });

  const result = await createReservation(
    db as any,
    {
      titleId: 'title-01',
      scheduleId: 'sched-01',
      fullName: 'Tran Van B',
      phone: '0987654321',
    },
    {
      clientIp: '192.168.1.10',
      idempotencyKey: 'idemp-key-001',
      captchaToken: 'valid-captcha-token',
      now: new Date('2026-10-20T14:30:00+07:00'),
    }
  );

  assert.equal(result.isReplay, true);
  assert.equal(result.reservation.id, 'res-exist-001');
  assert.equal(result.reservation.code, 'RSV-20261020-ABCD');
});

test('PR-2 Service: Replay cùng idempotency key nhưng khác payload ném 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
  const mockExisting = {
    id: 'res-exist-001',
    code: 'RSV-20261020-ABCD',
    title_id: 'title-01',
    phone: '0987654321',
    status: 'HELD',
  };

  const db = createMockDb({
    'WHERE r.idempotency_key = $1': () => ({
      rows: [mockExisting],
    }),
  });

  await assert.rejects(
    async () => {
      await createReservation(
        db as any,
        {
          titleId: 'title-DIFFERENT', // Đổi sang sách khác
          scheduleId: 'sched-01',
          fullName: 'Tran Van B',
          phone: '0987654321',
        },
        {
          clientIp: '192.168.1.10',
          idempotencyKey: 'idemp-key-001',
          captchaToken: 'valid-captcha-token',
          now: new Date('2026-10-20T14:30:00+07:00'),
        }
      );
    },
    (err: any) => err.errorCode === 'IDEMPOTENCY_PAYLOAD_MISMATCH' || err.statusCode === 409
  );
});

test('PR-2 Service: Vượt quá hạn mức IP 3 đơn/24h ném 429 IP_QUOTA_EXCEEDED', async () => {
  const db = createMockDb({
    'ip_hash = $1': () => ({
      rows: [
        { created_at: '2026-10-20T10:00:00Z' },
        { created_at: '2026-10-20T11:00:00Z' },
        { created_at: '2026-10-20T12:00:00Z' },
      ],
    }),
  });

  await assert.rejects(
    async () => {
      await createReservation(
        db as any,
        {
          titleId: 'title-01',
          scheduleId: 'sched-01',
          fullName: 'Khach M',
          phone: '0911223344',
        },
        {
          clientIp: '192.168.1.50',
          captchaToken: 'valid-captcha-token',
          now: new Date('2026-10-20T14:00:00Z'),
        }
      );
    },
    (err: any) => err.statusCode === 429 && err.errorCode === 'IP_QUOTA_EXCEEDED'
  );
});

test('PR-2 Service: Vượt quá hạn mức SĐT 3 suất ném 429 PHONE_QUOTA_EXCEEDED', async () => {
  const db = createMockDb({
    'phone = $1 AND status = \'HELD\'': () => ({
      rows: [{ count: '2' }], // Đang HELD 2 cuốn
    }),
    'unreturned_count': () => ({
      rows: [{ unreturned_count: '1' }], // Đang mượn 1 cuốn chưa trả -> Tổng 3 suất!
    }),
  });

  await assert.rejects(
    async () => {
      await createReservation(
        db as any,
        {
          titleId: 'title-01',
          scheduleId: 'sched-01',
          fullName: 'Khach N',
          phone: '0911223344',
        },
        {
          clientIp: '10.0.0.1', // IP mới hoàn toàn
          captchaToken: 'valid-captcha-token',
          now: new Date('2026-10-20T14:00:00Z'),
        }
      );
    },
    (err: any) => err.statusCode === 429 && err.errorCode === 'PHONE_QUOTA_EXCEEDED'
  );
});

test('PR-2 Service: Sách hết bản khả dụng ném 409 BOOK_NOT_AVAILABLE', async () => {
  const db = createMockDb({
    'book_copies bc': () => ({
      rows: [], // Không còn bản nào trống
    }),
  });

  await assert.rejects(
    async () => {
      await createReservation(
        db as any,
        {
          titleId: 'title-01',
          scheduleId: 'sched-01',
          fullName: 'Khach P',
          phone: '0933445566',
        },
        {
          clientIp: '10.0.0.2',
          captchaToken: 'valid-captcha-token',
          now: new Date('2026-10-20T14:00:00+07:00'),
        }
      );
    },
    (err: any) => err.statusCode === 409 && err.errorCode === 'BOOK_NOT_AVAILABLE'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-4: Bàn Giao, Thu Cọc & Mở Suất Khi Trả (fulfillReservation, CON-06, LIFE)
// ─────────────────────────────────────────────────────────────────────────────
import { fulfillReservation } from '../../src/server/reservations/service.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

test('LIFE-01: fulfillReservation thành công giao sách, chuyển HELD sang BORROWED và liên kết phiếu mượn', async () => {
  const memberActor: AuthenticatedActor = {
    userId: 'mem-staff-01',
    username: 'thukho.truc',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const db = {
    queries: [] as any[],
    query: async (sql: string, params?: any[]) => {
      db.queries.push({ sql, params });

      // 1. Khóa đơn đặt FOR UPDATE
      if (sql.includes('FROM reservations r') && sql.includes('FOR UPDATE OF r')) {
        return {
          rows: [
            {
              id: 'res-fulfill-01',
              code: 'RSV-20261020-001',
              status: 'HELD',
              copy_id: 'copy-uuid-01',
              title_id: 'title-uuid-01',
              phone: '0912345678',
              full_name: 'Nguyen Van A',
              shift_date: '2026-10-20',
              shift_time: '14:00 - 17:00',
              pickup_location: 'Bàn trực sảnh B',
              expires_at: '2026-10-20T17:00:00+07:00',
              estimated_deposit: 100000,
              created_at: '2026-10-20T14:00:00+07:00',
            },
          ],
        };
      }
      // 2. Tìm borrower
      if (sql.includes('FROM borrowers')) {
        return {
          rows: [
            {
              id: 'borrower-01',
              full_name: 'Nguyen Van A',
              phone: '0912345678',
              is_archived: false,
            },
          ],
        };
      }
      // 3. Issue loan receipt: cash session check
      if (sql.includes('FROM cash_sessions')) {
        return {
          rows: [
            {
              id: 'session-today-01',
              session_date: '2026-10-20',
              opened_by: 'mem-staff-01',
              opened_at: new Date().toISOString(),
              opening_cash: 500000,
              expected_closing_cash: 500000,
              actual_closing_cash: null,
              discrepancy: null,
              discrepancy_reason: null,
              is_closed: false,
              closed_at: null,
              closed_by: null,
              handed_over_from_session_id: null,
            },
          ],
        };
      }
      if (sql.includes('SELECT bc.id, bc.barcode') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'copy-uuid-01',
              barcode: 'BC-FULFILL-01',
              status: 'AVAILABLE',
              cover_price: 120000,
              edition_id: 'ed-01',
              title_id: 'title-uuid-01',
              title: 'Sách Đặt Chỗ',
            },
          ],
        };
      }
      if (sql.includes('SELECT copy_id FROM loan_items WHERE copy_id = ANY($1)')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT r.copy_id, r.code, r.id FROM reservations r')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO loans')) {
        return { rows: [{ id: 'loan-new-01' }] };
      }
      if (sql.includes('INSERT INTO loan_receipts')) {
        return {
          rows: [
            {
              id: 'receipt-new-01',
              receipt_number: 'RCP-20261020-001',
              loan_id: 'loan-new-01',
              borrower_id: 'borrower-01',
              borrower_name: 'Nguyen Van A',
              borrower_phone: '0912345678',
              total_deposit: 100000,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO loan_items')) {
        return { rows: [{ id: 'item-new-01' }] };
      }
      if (sql.includes('UPDATE book_copies SET status = \'BORROWED\'')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO deposit_allocations')) {
        return { rows: [{ id: 'alloc-01' }] };
      }
      if (sql.includes('INSERT INTO journal_entries')) {
        return {
          rows: [
            {
              id: 'je-01',
              entry_code: 'JE-DEP-001',
              fund_id: 'fund-loan-01',
              source_type: 'DEPOSIT_ALLOCATION',
              source_id: 'alloc-01',
              debit_account: '1111',
              credit_account: '3388',
              amount: '100000',
              reversal_of_entry_id: null,
              cash_session_id: 'session-today-01',
              notes: null,
              created_by: 'mem-staff-01',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (sql.includes('UPDATE cash_sessions')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO system_audit_logs')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE reservations') && sql.includes("status = 'BORROWED'")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  const result = await fulfillReservation(
    db as any,
    'res-fulfill-01',
    {
      paymentMethod: 'CASH',
      depositPaymentConfirmed: true,
      notes: 'Bàn giao đúng người đúng số điện thoại',
    },
    memberActor,
    new Date('2026-10-20T14:30:00+07:00')
  );

  assert.equal(result.reservation.status, 'BORROWED');
  assert.ok(result.loanReceipt);
});

test('CON-06: Chặn mượn thủ công bản sách đang được giữ chỗ (HELD) bởi đơn đặt trước', async () => {
  const { issueLoanReceipt } = await import('../../src/server/circulation/service.ts');

  const db = {
    query: async (sql: string, _params?: any[]) => {
      if (sql.includes('FROM cash_sessions WHERE is_closed = FALSE')) {
        return { rows: [{ id: 'session-01', is_closed: false }] };
      }
      if (sql.includes('FROM borrowers WHERE id = $1')) {
        return { rows: [{ id: 'borrower-01', is_archived: false }] };
      }
      if (sql.includes('SELECT bc.id, bc.barcode') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'copy-held-01',
              barcode: 'BC-HELD-99',
              status: 'AVAILABLE',
              cover_price: 100000,
              edition_id: 'ed-01',
              title_id: 'title-01',
              title: 'Sách Đã Có Người Đặt',
            },
          ],
        };
      }
      if (sql.includes('SELECT copy_id FROM loan_items WHERE copy_id = ANY($1)')) {
        return { rows: [] };
      }
      // Kiểm tra giữ chỗ phát hiện bản sách đang HELD
      if (sql.includes('FROM reservations r')) {
        return {
          rows: [
            {
              copy_id: 'copy-held-01',
              code: 'RSV-20261020-HELD99',
              id: 'res-held-01',
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => {
      await issueLoanReceipt(
        db as any,
        {
          borrowerId: 'borrower-01',
          copyIds: ['copy-held-01'],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 100000,
        },
        'staff-01'
      );
    },
    (err: any) => err.errorCode === 'COPY_NOT_AVAILABLE' && /đang được giữ chỗ cho đơn đặt trước/.test(err.message)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PRF-08: Ràng buộc xác nhận tiền cọc nghiêm ngặt (Strict Boolean Check)
// ─────────────────────────────────────────────────────────────────────────────
test('PRF-08: fulfillReservation từ chối mọi giá trị depositPaymentConfirmed không phải true boolean nguyên thủy', async () => {
  const memberActor: AuthenticatedActor = {
    userId: 'mem-staff-01',
    username: 'thukho.truc',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const db = {
    query: async () => ({ rows: [] }),
  };

  const invalidValues = [
    false,
    'false',
    'true',
    0,
    1,
    null,
    undefined,
    '',
    {},
    [],
  ];

  for (const val of invalidValues) {
    await assert.rejects(
      async () => {
        await fulfillReservation(
          db as any,
          'res-fulfill-01',
          {
            paymentMethod: 'CASH',
            depositPaymentConfirmed: val as any,
          },
          memberActor
        );
      },
      (err: any) => {
        return err.errorCode === 'DEPOSIT_CONFIRMATION_REQUIRED' && err.statusCode === 400;
      },
      `Giá trị '${String(val)}' phải bị từ chối bởi DEPOSIT_CONFIRMATION_REQUIRED`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRF-05: Bàn giao thành công với reservationId bypass guard CON-06 cho chính đơn đó
// ─────────────────────────────────────────────────────────────────────────────
test('PRF-05: issueLoanReceipt chấp nhận cho mượn bản sách đang HELD khi truyền đúng reservationId khớp với đơn', async () => {
  const { issueLoanReceipt } = await import('../../src/server/circulation/service.ts');

  const db = {
    query: async (sql: string, _params?: any[]) => {
      if (sql.includes('FROM cash_sessions')) {
        return {
          rows: [
            {
              id: 'session-01',
              session_date: '2026-10-20',
              opened_by: 'mem-staff-01',
              opened_at: new Date().toISOString(),
              opening_cash: 500000,
              expected_closing_cash: 500000,
              actual_closing_cash: null,
              discrepancy: null,
              discrepancy_reason: null,
              is_closed: false,
              closed_at: null,
              closed_by: null,
              handed_over_from_session_id: null,
            },
          ],
        };
      }
      if (sql.includes('FROM borrowers WHERE id = $1')) {
        return { rows: [{ id: 'borrower-01', phone: '0912345678', is_archived: false }] };
      }
      if (sql.includes('SELECT bc.id, bc.barcode') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'copy-held-01',
              barcode: 'BC-HELD-99',
              status: 'AVAILABLE',
              cover_price: 100000,
              edition_id: 'ed-01',
              title_id: 'title-01',
              title: 'Sách Đã Có Người Đặt',
            },
          ],
        };
      }
      if (sql.includes('SELECT copy_id FROM loan_items WHERE copy_id = ANY($1)')) {
        return { rows: [] };
      }
      if (sql.includes('FROM reservations r WHERE r.copy_id = ANY($1)')) {
        return {
          rows: [
            {
              copy_id: 'copy-held-01',
              code: 'RSV-20261020-HELD99',
              id: 'res-valid-id-01',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO loan_receipts')) {
        return {
          rows: [
            {
              id: 'rcp-new-01',
              receipt_number: 'RCP-20261020-001',
              borrow_date: '2026-10-20',
              due_date: '2026-11-03',
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO loan_items')) {
        return { rows: [{ id: 'item-new-01' }] };
      }
      if (sql.includes('INSERT INTO deposit_allocations')) {
        return { rows: [{ id: 'alloc-01' }] };
      }
      if (sql.includes('INSERT INTO journal_entries')) {
        return {
          rows: [
            {
              id: 'je-01',
              entry_code: 'JE-DEP-01',
              fund_id: 'fund-loan-01',
              source_type: 'LOAN_DEPOSIT',
              source_id: 'alloc-01',
              debit_account: '1111',
              credit_account: '3388',
              amount: '100000',
              created_by: 'staff-01',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const receipt = await issueLoanReceipt(
    db as any,
    {
      borrowerId: 'borrower-01',
      copyIds: ['copy-held-01'],
      paymentMethod: 'CASH',
      paymentConfirmed: true,
      confirmedAmount: 100000,
      reservationId: 'res-valid-id-01', // Truyền đúng reservationId
    },
    'staff-01'
  );

  assert.ok(receipt);
  assert.equal(receipt.id, 'rcp-new-01');
});

// ─────────────────────────────────────────────────────────────────────────────
// PRF-06: Hạn mức SĐT đầy đủ các nghĩa vụ chưa kết thúc và mượn thủ công cùng khóa
// ─────────────────────────────────────────────────────────────────────────────
test('PRF-06: Mượn thủ công tại quầy bị chặn khi SĐT đã đủ 3 suất (HELD + mượn chưa trả)', async () => {
  const { issueLoanReceipt } = await import('../../src/server/circulation/service.ts');

  const db = {
    query: async (sql: string) => {
      if (sql.includes('FROM cash_sessions WHERE is_closed = FALSE')) {
        return { rows: [{ id: 'session-01', is_closed: false }] };
      }
      if (sql.includes('FROM borrowers WHERE id = $1')) {
        return { rows: [{ id: 'borrower-01', phone: '0912345678', is_archived: false }] };
      }
      if (sql.includes('SELECT COUNT(*) AS count FROM reservations WHERE phone = $1')) {
        return { rows: [{ count: '2' }] }; // Đang có 2 đơn HELD
      }
      if (sql.includes('unreturned_count')) {
        return { rows: [{ unreturned_count: '1' }] }; // Đang mượn 1 cuốn chưa trả -> Tổng 3 suất!
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => {
      await issueLoanReceipt(
        db as any,
        {
          borrowerId: 'borrower-01',
          copyIds: ['copy-any-01'],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
        },
        'staff-01'
      );
    },
    (err: any) => err.errorCode === 'PHONE_QUOTA_EXCEEDED'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PRF-09: Replay idempotency khôi phục lookupToken hợp lệ và phát hiện payload mismatch
// ─────────────────────────────────────────────────────────────────────────────
test('PRF-09: Replay đơn đã commit khôi phục đúng lookupToken và chặn đổi họ tên/ca trực', async () => {
  const mockExisting = {
    id: 'res-exist-99',
    code: 'RSV-20261020-REPLAY',
    title_id: 'title-01',
    schedule_id: 'sched-01',
    full_name: 'Tran Van B',
    phone: '0987654321',
    status: 'HELD',
    book_title: 'Lập trình TypeScript',
    shift_date: '2026-10-20',
    shift_time: '14:00 - 17:00',
    pickup_location: 'Bàn trực sảnh B',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    estimated_deposit: 100000,
    created_at: '2026-10-20T14:15:00+07:00',
  };

  const db = createMockDb({
    'WHERE r.idempotency_key = $1': () => ({
      rows: [mockExisting],
    }),
  });

  // Replay đúng toàn bộ payload -> khôi phục lookupToken
  const resultSuccess = await createReservation(
    db as any,
    {
      titleId: 'title-01',
      scheduleId: 'sched-01',
      fullName: 'Tran Van B',
      phone: '0987654321',
    },
    {
      clientIp: '192.168.1.10',
      idempotencyKey: 'idemp-key-repeat',
      captchaToken: 'any-token',
    }
  );

  assert.equal(resultSuccess.isReplay, true);
  assert.ok(resultSuccess.lookupToken.startsWith('rsv_tok_'), 'Replay phải trả lại lookupToken hợp lệ');

  // Đổi fullName với cùng idempotencyKey -> phải ném Conflict
  await assert.rejects(
    async () => {
      await createReservation(
        db as any,
        {
          titleId: 'title-01',
          scheduleId: 'sched-01',
          fullName: 'Nguyen Van Khac', // Đổi tên
          phone: '0987654321',
        },
        {
          clientIp: '192.168.1.10',
          idempotencyKey: 'idemp-key-repeat',
          captchaToken: 'any-token',
        }
      );
    },
    (err: any) => err.errorCode === 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PRF-10: BoundedAtomicTicketStore atomicConsumeAsync với CSDL Queryable
// ─────────────────────────────────────────────────────────────────────────────
test('PRF-10: BoundedAtomicTicketStore.atomicConsumeAsync tiêu thụ vé nguyên tử qua CSDL bền vững', async () => {
  const { BoundedAtomicTicketStore } = await import('../../src/modules/reporting/reporting-service.ts');
  const store = new BoundedAtomicTicketStore(100);

  const existingLocks = new Set<string>();
  const mockDb = {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO consumed_export_tickets')) {
        const ns = params?.[0];
        if (existingLocks.has(ns)) {
          return { rows: [] }; // Đã tồn tại -> conflict
        }
        existingLocks.add(ns);
        return { rows: [{ lock_namespace: ns }] }; // Insert thành công
      }
      return { rows: [] };
    },
  };

  const ticketId = 'tkt-atomic-db-test-01';
  const expiresAt = Date.now() + 300000;

  // Lần đầu tiên: tiêu thụ thành công
  const consumedFirst = await store.atomicConsumeAsync(ticketId, expiresAt, mockDb as any);
  assert.equal(consumedFirst, true, 'Lần đầu tiêu thụ qua CSDL phải trả true');

  // Lần thứ hai cùng ticketId: bị từ chối
  const consumedSecond = await store.atomicConsumeAsync(ticketId, expiresAt, mockDb as any);
  assert.equal(consumedSecond, false, 'Lần thứ hai cùng ticketId phải trả false');
});

// ─────────────────────────────────────────────────────────────────────────────
// S1 & F2 UI Regression Tests: Canonical Badges and Mobile Loan Card Integrity
// ─────────────────────────────────────────────────────────────────────────────
test('S1 UI Regression: getStatusBadge in ReservationSection has exactly one case per canonical status and no dead code', () => {
  const filePath = path.resolve('src/components/ReservationSection.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Verify getStatusBadge existence
  const badgeFnMatch = fileContent.match(/const getStatusBadge = \(([^)]+)\) => \{([\s\S]*?)\n  \};/);
  assert.ok(badgeFnMatch, 'getStatusBadge phải được định nghĩa');
  const badgeFnBody = badgeFnMatch[2];

  // Canonical statuses
  const canonicalStatuses = ['HELD', 'BORROWED', 'RETURNED', 'EXPIRED', 'CANCELLED'];
  for (const status of canonicalStatuses) {
    const caseRegex = new RegExp(`case\\s+['"]${status}['"]\\s*:`, 'g');
    const matches = badgeFnBody.match(caseRegex);
    assert.equal(matches?.length, 1, `Trạng thái ${status} phải xuất hiện đúng 1 lần trong getStatusBadge, không được trùng lặp`);
  }

  // Ensure non-canonical PENDING is not present
  assert.equal(badgeFnBody.includes("'PENDING'"), false, 'Trạng thái PENDING không thuộc ReservationStatus và không được có trong switch');

  // Verify consistent badge usage in confirmation card and lookup card
  const getStatusBadgeCalls = fileContent.match(/getStatusBadge\(/g);
  assert.ok(getStatusBadgeCalls && getStatusBadgeCalls.length >= 2, 'getStatusBadge phải được gọi ở cả thẻ xác nhận đặt đơn và thẻ tra cứu đơn');
});

test('F2 UI Regression: Mobile ticket cards in InternalWorkspace retain all loan statuses, item flags, and parent loan indicator', () => {
  const filePath = path.resolve('src/components/InternalWorkspace.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Extract mobile tickets view block
  const mobileBlockMatch = fileContent.match(/{\/\* Mobile Ticket Cards View \*\/}([\s\S]*?){\/\* Mobile Actions 1-Touch \*\/}/);
  assert.ok(mobileBlockMatch, 'Khối Mobile Ticket Cards View phải tồn tại trong InternalWorkspace');
  const mobileBlock = mobileBlockMatch[1];

  // All 5 loan statuses must be handled on mobile
  assert.ok(mobileBlock.includes("loan.status === 'ACTIVE'"), 'Mobile phải xử lý trạng thái ACTIVE');
  assert.ok(mobileBlock.includes("loan.status === 'RETURNED'"), 'Mobile phải xử lý trạng thái RETURNED');
  assert.ok(mobileBlock.includes("loan.status === 'PARTIAL_SETTLED'"), 'Mobile phải xử lý trạng thái PARTIAL_SETTLED');
  assert.ok(mobileBlock.includes("loan.status === 'PENDING_DEPOSIT'"), 'Mobile phải xử lý trạng thái PENDING_DEPOSIT');

  // Item status flags must be preserved on mobile
  assert.ok(mobileBlock.includes('it.isLost'), 'Mobile phải hiển thị nhãn sách đã mất (it.isLost)');
  assert.ok(mobileBlock.includes('it.returnedAt'), 'Mobile phải hiển thị nhãn sách đã trả (it.returnedAt)');

  // Transitional parent loan indicator must be preserved on mobile
  assert.ok(mobileBlock.includes('loan.parentLoanId'), 'Mobile phải hiển thị dấu hiệu phiếu chuyển tiếp (loan.parentLoanId)');
});
