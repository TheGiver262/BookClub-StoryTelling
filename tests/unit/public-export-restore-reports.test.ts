/**
 * =====================================================================
 * Nhóm IV Regressions: RF-09, RF-10, RF-11, P22-09, P22-10, S12-10
 * - RF-09: Public catalog schema (author_name, moderated_at), deposit rounding 50k policy
 * - RF-10: Restore scripts fail-closed verification, disposable target guard, semantic check
 * - RF-11: Export formats honesty, atomic single-use ticket consume, no hardcoded default secret
 * - P22-09 & P22-10: Circulation report Vietnam cutoff, book count in lost items
 * =====================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateDeposit as calculateDepositMock } from '../../src/data/mockData.ts';
import { calculateDeposit as calculateDepositServer } from '../../src/server/catalog/rules.ts';
import {
  createExportTicket,
  validateAndConsumeExportTicket,
  clearDownloadTicketsForTesting,
  BoundedAtomicTicketStore,
  getCirculationSummaryReport,
} from '../../src/modules/reporting/reporting-service.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';
import type { Queryable } from '../../src/server/finance/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. RF-09: Public Schema Canonical & Deposit Policy 50k
// ─────────────────────────────────────────────────────────────────────────────
test('RF-09a: Quy tắc tiền cọc 50k đồng nhất giữa client mock và server rule', () => {
  const testCases = [
    { price: 74000, expected: 50000n },
    { price: 75000, expected: 100000n },
    { price: 230000, expected: 250000n },
    { price: 49000, expected: 50000n },
    { price: 0, expected: 50000n },
    { price: null, expected: 50000n },
  ];

  for (const tc of testCases) {
    const serverDeposit = calculateDepositServer(tc.price);
    const mockDeposit = calculateDepositMock(tc.price);
    assert.equal(serverDeposit, tc.expected, `Server deposit cho giá ${tc.price} phải là ${tc.expected}`);
    assert.equal(BigInt(mockDeposit), tc.expected, `Mock deposit cho giá ${tc.price} phải khớp server deposit ${tc.expected}`);
  }
});

test('RF-09b: Trang 404 và sach/[id] không chứa công thức cọc 50% cũ và dùng schema canonical', () => {
  const page404Path = path.resolve('src/pages/404.astro');
  const page404Content = fs.readFileSync(page404Path, 'utf8');
  assert.ok(!page404Content.includes('* 0.5'), '404.astro không được tính cọc bằng công thức 50% (* 0.5)');
  assert.ok(page404Content.includes('50000'), '404.astro phải sử dụng mốc cọc 50.000 VND');

  const pageDetailPath = path.resolve('src/pages/sach/[id].astro');
  const pageDetailContent = fs.readFileSync(pageDetailPath, 'utf8');
  assert.ok(pageDetailContent.includes('author_name'), 'sach/[id].astro phải truy vấn cột canonical author_name');
  assert.ok(pageDetailContent.includes('moderated_at'), 'sach/[id].astro phải truy vấn cột canonical moderated_at');
  assert.ok(pageDetailContent.includes('Không thể tải catalog sách thật từ DATABASE_URL'), 'Lỗi DB khi có dbUrl phải throw error, không silently fallback sang mock');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. RF-10: Restore Scripts Fail-Closed, Disposable Guard & Semantic Checks
// ─────────────────────────────────────────────────────────────────────────────
test('RF-10a: restore.ps1 và restore.sh có disposable target guard và fail-closed khi parse lỗi', () => {
  const ps1Path = path.resolve('scripts/restore.ps1');
  const ps1Content = fs.readFileSync(ps1Path, 'utf8');
  assert.ok(ps1Content.includes('ALLOW_PRODUCTION_RESTORE'), 'restore.ps1 phải có guard bảo vệ target DB');
  assert.ok(ps1Content.includes('Không thể parse số lượng bảng sau khôi phục'), 'restore.ps1 phải ném lỗi khi parse table count thất bại');
  assert.ok(ps1Content.includes('exit 1'), 'restore.ps1 phải exit 1 khi parse lỗi');
  assert.ok(ps1Content.includes('journal_entries'), 'restore.ps1 phải đối soát bảng cốt lõi và số dư sổ cái');

  const shPath = path.resolve('scripts/restore.sh');
  const shContent = fs.readFileSync(shPath, 'utf8');
  assert.ok(shContent.includes('ALLOW_PRODUCTION_RESTORE'), 'restore.sh phải có guard bảo vệ target DB');
  assert.ok(shContent.includes('Failed to parse table count'), 'restore.sh phải fail-closed khi parse table count lỗi');
  assert.ok(shContent.includes('exit 1'), 'restore.sh phải exit 1');
  assert.ok(shContent.includes('journal_entries'), 'restore.sh phải đối soát sổ cái sau restore');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RF-11: Atomic Single-Use Ticket, No Default Secret, Format Honesty
// ─────────────────────────────────────────────────────────────────────────────
test('RF-11a: createExportTicket bắt buộc secret cấu hình (không có hardcoded default secret trong source)', () => {
  const actor: AuthenticatedActor = {
    userId: 'mem-exp-01',
    username: 'thukho.truc',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const oldJwt = process.env.JWT_SECRET;
  const oldExp = process.env.EXPORT_TICKET_SECRET;
  try {
    delete process.env.JWT_SECRET;
    delete process.env.EXPORT_TICKET_SECRET;

    assert.throws(
      () => createExportTicket(actor, 'FINANCIAL_SUMMARY', {}, 'CSV'),
      /chưa được cấu hình/
    );
  } finally {
    if (oldJwt) process.env.JWT_SECRET = oldJwt;
    if (oldExp) process.env.EXPORT_TICKET_SECRET = oldExp;
  }
});

test('RF-11b: BoundedAtomicTicketStore tiêu thụ vé nguyên tử (Atomic Single-Use) giữa 2 callers đồng thời', () => {
  const store = new BoundedAtomicTicketStore(100);
  const ticketId = 'ticket-uuid-001';
  const expiresAt = Date.now() + 60000;

  // Caller 1: Tiêu thụ thành công
  const firstConsume = store.atomicConsume(ticketId, expiresAt);
  assert.equal(firstConsume, true, 'Lần tiêu thụ đầu tiên phải thành công');

  // Caller 2 (chạy đua hoặc dùng lại link): Phải bị từ chối ngay lập tức
  const secondConsume = store.atomicConsume(ticketId, expiresAt);
  assert.equal(secondConsume, false, 'Lần tiêu thụ thứ hai cùng ticketId phải bị từ chối (Single-Use)');
});

test('RF-11b2: BoundedAtomicTicketStore bảo đảm single-use qua hai instances và sau restart bằng durable storage', () => {
  const tmpDir = path.resolve('.review-artifacts/test-tickets-' + Date.now());
  try {
    const storeInstance1 = new BoundedAtomicTicketStore(100, tmpDir);
    const storeInstance2 = new BoundedAtomicTicketStore(100, tmpDir);
    const ticketId = 'cross-instance-ticket-' + Date.now();
    const expiresAt = Date.now() + 60000;

    // Instance 1 tiêu thụ thành công
    const firstConsume = storeInstance1.atomicConsume(ticketId, expiresAt);
    assert.equal(firstConsume, true, 'Instance 1 tiêu thụ lần đầu phải thành công');

    // Instance 2 (Worker khác) cố tiêu thụ cùng vé -> Phải bị từ chối
    const secondConsume = storeInstance2.atomicConsume(ticketId, expiresAt);
    assert.equal(secondConsume, false, 'Instance 2 cố tiêu thụ cùng vé phải bị từ chối (Atomic Single-Use qua nhiều Worker instances)');

    // Mô phỏng khởi động lại ứng dụng (Restart process): Tạo storeInstance3 trên cùng storageDir
    const storeInstance3AfterRestart = new BoundedAtomicTicketStore(100, tmpDir);
    const consumeAfterRestart = storeInstance3AfterRestart.atomicConsume(ticketId, expiresAt);
    assert.equal(consumeAfterRestart, false, 'Store sau khi restart vẫn từ chối vé đã tiêu thụ (Bền vững sau restart)');
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }
});

test('RF-11c: validateAndConsumeExportTicket xác thực actorId và tokenVersion sống khi tải', () => {
  clearDownloadTicketsForTesting();
  const testSecret = 'secret-for-export-ticket-testing-32chars';

  const creatorActor: AuthenticatedActor = {
    userId: 'mem-exp-creator',
    username: 'creator.member',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 2,
  };

  const ticketObj = createExportTicket(creatorActor, 'FINANCIAL_SUMMARY', {}, 'CSV', testSecret);

  // Case 1: Đúng actor và đúng tokenVersion -> Thành công
  const consumed = validateAndConsumeExportTicket(ticketObj.ticket, creatorActor, testSecret);
  assert.equal(consumed.actorId, creatorActor.userId);

  // Case 2: Tái sử dụng ticket đã tiêu thụ -> 404 TICKET_NOT_FOUND
  assert.throws(
    () => validateAndConsumeExportTicket(ticketObj.ticket, creatorActor, testSecret),
    (err: any) => err.code === 'TICKET_NOT_FOUND' || /hết hạn sử dụng|đã được sử dụng/.test(err.message)
  );

  // Case 3: Người khác (không phải creator, không phải ADMIN) cố tải -> 403 EXPORT_ACTOR_MISMATCH
  const anotherTicket = createExportTicket(creatorActor, 'FINANCIAL_SUMMARY', {}, 'CSV', testSecret);
  const attackerActor: AuthenticatedActor = {
    userId: 'mem-exp-other',
    username: 'other.member',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  assert.throws(
    () => validateAndConsumeExportTicket(anotherTicket.ticket, attackerActor, testSecret),
    (err: any) => err.errorCode === 'EXPORT_ACTOR_MISMATCH' || /chỉ dành cho người tạo/.test(err.message)
  );

  // Case 4: Creator nhưng tokenVersion đã bị đổi (bị revoke session / đổi mật khẩu) -> 401 TOKEN_VERSION_MISMATCH
  const revokedActor: AuthenticatedActor = {
    ...creatorActor,
    tokenVersion: 3, // Khác với version 2 lúc tạo ticket
  };
  const ticketForRevoke = createExportTicket(creatorActor, 'FINANCIAL_SUMMARY', {}, 'CSV', testSecret);
  assert.throws(
    () => validateAndConsumeExportTicket(ticketForRevoke.ticket, revokedActor, testSecret),
    (err: any) => err.errorCode === 'TOKEN_VERSION_MISMATCH' || /Phiên đăng nhập đã thay đổi/.test(err.message)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. P22-09 & P22-10: Circulation Report VN Cutoff & Book Count Invariant
// ─────────────────────────────────────────────────────────────────────────────
test('RF-11d: Báo cáo lưu thông đếm đúng số bản sách bị mất (không đếm số receipt), dùng cutoff VN', async () => {
  const executedQueries: Array<{ sql: string; params: any[] }> = [];

  const mockDb: Queryable = {
    async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
      executedQueries.push({ sql, params });

      // Mock return values
      if (sql.includes('FROM loan_receipts')) {
        return { rows: [{ count: '10' }] as any, rowCount: 1 };
      }
      if (sql.includes('FROM loan_settlements') && sql.includes('settlement_type IN')) {
        return { rows: [{ count: '8' }] as any, rowCount: 1 };
      }
      if (sql.includes('FROM loan_renewals')) {
        return { rows: [{ count: '5' }] as any, rowCount: 1 };
      }
      if (sql.includes('COUNT(DISTINCT li.id)') && sql.includes('li.is_lost = TRUE')) {
        // Trả về 3 cuốn sách bị mất (dù có thể thuộc về 1 phiếu mượn duy nhất)
        return { rows: [{ count: '3' }] as any, rowCount: 1 };
      }
      if (sql.includes('FROM loan_items') && sql.includes('returned_at IS NULL')) {
        return { rows: [{ count: '12' }] as any, rowCount: 1 };
      }
      return { rows: [{ count: '0' }] as any, rowCount: 1 };
    },
  };

  const actor: AuthenticatedActor = {
    userId: 'mem-rep-01',
    username: 'thukho.baocao',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const report = await getCirculationSummaryReport(mockDb, actor, {
    startDate: '2026-10-01',
    endDate: '2026-10-15',
  });

  assert.equal(report.totalLoansIssued, 10);
  assert.equal(report.totalLoansReturned, 8);
  assert.equal(report.totalLoansRenewed, 5);
  assert.equal(report.totalBooksLost, 3, 'totalBooksLost phải là 3 bản sách thực tế');

  // Kiểm tra câu query lost items: Phải query li.is_lost và COUNT(DISTINCT li.id), không đếm loan_settlements
  const lostQuery = executedQueries.find((q) => q.sql.includes('li.is_lost = TRUE'));
  assert.ok(lostQuery, 'Báo cáo lưu thông phải query loan_items li.is_lost = TRUE');
  assert.ok(lostQuery.sql.includes('COUNT(DISTINCT li.id)'), 'Phải đếm số bản sách li.id');

  // Kiểm tra cutoff time parameters: Phải có +07:00 (múi giờ Việt Nam)
  assert.ok(
    lostQuery.params[0].includes('+07:00'),
    'Cutoff thời gian bắt đầu phải dùng múi giờ Việt Nam +07:00'
  );
  assert.ok(
    lostQuery.params[1].includes('+07:00'),
    'Cutoff thời gian kết thúc phải dùng múi giờ Việt Nam +07:00'
  );
});
