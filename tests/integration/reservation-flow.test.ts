import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DbHarness } from './db-harness.ts';
import { withTransaction } from '../../src/server/db/client.ts';
import { createReservation, fulfillReservation, listPublicReservationBooks, getReservationByToken, listStaffReservations, reportReservationIssue, cancelReservation } from '../../src/server/reservations/service.ts';
import { settleReturnReceipt } from '../../src/server/circulation/service.ts';
import { openCashSession } from '../../src/server/finance/cash-sessions.ts';
import { updateBorrower } from '../../src/server/borrowers/service.ts';
import { updateBookCopy, archiveBookCopy } from '../../src/server/catalog/service.ts';
import { BoundedAtomicTicketStore } from '../../src/modules/reporting/reporting-service.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import { prepareBetaSql } from '../../scripts/prepare-beta-db.mjs';

const harness = new DbHarness();
process.env.RESERVATION_IP_SECRET = 'synthetic-reservation-test-secret-2026';
let fixture: { titleId: string; scheduleId: string; actor: any; copyId: string };
before(async () => { await harness.resetSchema(); await harness.applyDDL(); await harness.applySeed(); await harness.applyMigrations(); });
after(async () => { await harness.close(); });
beforeEach(async () => {
  const pool = harness.getPool();
  await pool.query("UPDATE reservations SET status = 'CANCELLED' WHERE status = 'HELD'");
  const actorId = (await pool.query('SELECT id FROM members WHERE is_admin LIMIT 1')).rows[0].id;
  const titleId = (await pool.query('INSERT INTO book_titles (title) VALUES ($1) RETURNING id', ['Synthetic ' + randomUUID()])).rows[0].id;
  const editionId = (await pool.query("INSERT INTO book_editions (title_id, publisher) VALUES ($1, 'Synthetic') RETURNING id", [titleId])).rows[0].id;
  const copies = await pool.query("INSERT INTO book_copies (edition_id, barcode, cover_price, location) SELECT $1, gen_random_uuid()::text, 230000, 'BAN_TRUC_TAM' FROM generate_series(1,6) RETURNING id", [editionId]);
  const scheduleId = randomUUID();
  await pool.query("INSERT INTO duty_schedules (id, term_semester, schedule_date, day_of_week, shift_time, status) VALUES ($1, '2026.1', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'THU_BA', '00:00 - 23:59', 'PUBLISHED')", [scheduleId]);
  fixture = { titleId, scheduleId, copyId: copies.rows[0].id, actor: { userId: actorId, memberId: actorId, role: 'ADMIN', isActive: true, isAlumni: false, tokenVersion: 1 } };
});

function reserve(phone: string, ip = '192.0.2.1', key = randomUUID()) {
  return withTransaction(harness.getPool(), tx => createReservation(tx,
    { titleId: fixture.titleId, scheduleId: fixture.scheduleId, fullName: 'Synthetic Reader', phone },
    { clientIp: ip, idempotencyKey: key, captchaToken: 'verified-by-test' }));
}

test('PG: one idempotent intent survives concurrent requests and restores the same token', async () => {
  const key = randomUUID();
  const results = await Promise.all([reserve('0911000001', '192.0.2.11', key), reserve('0911000001', '192.0.2.12', key)]);
  assert.equal(results[0].reservation.id, results[1].reservation.id);
  assert.equal(results[0].lookupToken, results[1].lookupToken);
  assert.equal((await getReservationByToken(harness.getPool(), results[1].lookupToken)).id, results[0].reservation.id);
});

test('PG: two independent connections cannot take a fourth phone slot', async () => {
  await reserve('0911000002', '192.0.2.21'); await reserve('0911000002', '192.0.2.22');
  const result = await Promise.allSettled([reserve('0911000002', '192.0.2.23'), reserve('0911000002', '192.0.2.24')]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await harness.getPool().query("SELECT count(*) FROM reservations WHERE phone = '0911000002' AND status = 'HELD'")).rows[0].count, '3');
});

test('PG: IP quota remains shared across different phone numbers', async () => {
  await reserve('0911000003', '192.0.2.31'); await reserve('0911000004', '192.0.2.31');
  const result = await Promise.allSettled([reserve('0911000005', '192.0.2.31'), reserve('0911000006', '192.0.2.31')]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
});

test('PG: competing readers for the last copy receive a domain conflict, not a SQL error', async () => {
  const pool = harness.getPool();
  await pool.query('DELETE FROM book_copies WHERE edition_id IN (SELECT id FROM book_editions WHERE title_id = $1) AND id <> $2', [fixture.titleId, fixture.copyId]);
  const results = await Promise.allSettled([reserve('0911000012', '192.0.2.81'), reserve('0911000013', '192.0.2.82')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.errorCode, 'BOOK_NOT_AVAILABLE');
});

test('PG: an expired hold is immediately replaceable before the scheduler runs', async () => {
  const first = await reserve('0911000007', '192.0.2.41');
  await harness.getPool().query("UPDATE reservations SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [first.reservation.id]);
  const replacement = await reserve('0911000008', '192.0.2.42');
  assert.equal(replacement.reservation.status, 'HELD');
  assert.equal((await harness.getPool().query('SELECT status FROM reservations WHERE id = $1', [first.reservation.id])).rows[0].status, 'EXPIRED');
});

test('PG: public deposit matches the actual copy policy for prices above 100k', async () => {
  const books = await listPublicReservationBooks(harness.getPool(), { search: (await harness.getPool().query('SELECT title FROM book_titles WHERE id = $1', [fixture.titleId])).rows[0].title });
  assert.equal(books.items.find(b => b.titleId === fixture.titleId)?.standardDeposit, 250000);
  assert.equal(books.items.find(b => b.titleId === fixture.titleId)?.coverPrice, 230000);
  assert.equal((await reserve('0911000009', '192.0.2.51')).reservation.estimatedDeposit, 250000);
});

test('PG: held copies disappear from public availability and incidents alert staff without auto-cancelling', async () => {
  const pool = harness.getPool();
  const held = await reserve('0911000021', '192.0.2.101');
  const inventory = await listPublicReservationBooks(pool, { search: fixture.titleId });
  assert.equal(inventory.items[0].availableCopiesCount, 5);
  const copyId = (await pool.query('SELECT copy_id FROM reservations WHERE id = $1', [held.reservation.id])).rows[0].copy_id;
  await assert.rejects(() => withTransaction(pool, tx => reportReservationIssue(tx, held.reservation.id, { ...fixture.actor, role: 'GUEST' }, 'Sách bị hỏng')), /thành viên/);
  await assert.rejects(() => withTransaction(pool, tx => reportReservationIssue(tx, held.reservation.id, fixture.actor, '')), /lý do/);
  await assert.rejects(() => withTransaction(pool, tx => reportReservationIssue(tx, 'invalid-id', fixture.actor, 'Sách hỏng')), /định danh/);
  await pool.query(prepareBetaSql().access);
  const secret = 'synthetic-beta-incident-session-secret-2026';
  const token = await signSessionToken(fixture.actor, secret);
  await harness.withClient(async client => {
    await client.query('SET ROLE ysbk_app');
    const [, response] = await Promise.all([
      withTransaction(pool, tx => reportReservationIssue(tx, held.reservation.id, fixture.actor, 'Không tìm thấy sách tại kho')),
      handleRequest(new Request(`http://localhost/api/v1/reservations/${held.reservation.id}/issue`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Không tìm thấy sách tại kho' }),
      }), { JWT_SECRET: secret }, { queryable: client, membersDb: { [fixture.actor.memberId]: { id: fixture.actor.memberId, is_admin: true, is_active: true, is_alumni: false, token_version: 1 } } }),
    ]);
    assert.equal(response.status, 200, await response.clone().text());
  });
  assert.equal(Number((await pool.query("SELECT count(*) FROM system_audit_logs WHERE action = 'RESERVATION_FULFILLMENT_ISSUE' AND target_id = $1", [copyId])).rows[0].count), 1);
  const staff = await listStaffReservations(pool, { scheduleId: fixture.scheduleId, status: 'HELD' });
  assert.equal(staff.attentionCount, 1);
  assert.equal(staff.items[0].fulfillmentIssue, 'COPY_UNAVAILABLE');
  assert.equal(staff.items[0].status, 'HELD');
  assert.equal(staff.items[0].phone, '0911000021');
  assert.ok(!('phone' in await getReservationByToken(pool, held.lookupToken)));
  await assert.rejects(() => withTransaction(pool, async tx => {
    await openCashSession(tx, { sessionId: 'CS-' + randomUUID().slice(0, 20), sessionDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }), openedBy: fixture.actor.userId, openingCash: 0n, discrepancyReason: 'Synthetic incident test' });
    return fulfillReservation(tx, held.reservation.id, { paymentMethod: 'CASH', depositPaymentConfirmed: true }, fixture.actor);
  }), /không.*khả dụng|không.*sẵn sàng/i);
  await withTransaction(pool, tx => cancelReservation(tx, { id: held.reservation.id }, fixture.actor, 'Đã gọi xác nhận hủy'));
  assert.equal((await pool.query('SELECT status FROM book_copies WHERE id = $1', [copyId])).rows[0].status, 'MAINTENANCE');
  await assert.rejects(() => withTransaction(pool, tx => reportReservationIssue(tx, held.reservation.id, fixture.actor, 'Sự cố sau hủy')), /giữ chỗ/);
});

test('PG: public catalogue pagination and category filtering cover titles beyond the first page', async () => {
  const pool = harness.getPool();
  const category = (await pool.query("INSERT INTO categories (name) VALUES ('Synthetic paging category') RETURNING id")).rows[0].id;
  await pool.query('INSERT INTO book_title_categories (title_id, category_id) VALUES ($1, $2)', [fixture.titleId, category]);
  const found = await listPublicReservationBooks(pool, { category: 'Synthetic paging category', page: 1, limit: 1 });
  assert.equal(found.total, 1);
  assert.equal(found.items[0].titleId, fixture.titleId);
});

test('PG: maintenance and archive cannot invalidate a promised book', async () => {
  const order = await reserve('0911000011', '192.0.2.71');
  const copyId = (await harness.getPool().query('SELECT copy_id FROM reservations WHERE id = $1', [order.reservation.id])).rows[0].copy_id;
  await assert.rejects(() => withTransaction(harness.getPool(), tx => updateBookCopy(tx, copyId, { location: 'KHO_HOI_SINH_VIEN' }, fixture.actor.memberId)), /giữ chỗ/);
  await assert.rejects(() => withTransaction(harness.getPool(), tx => archiveBookCopy(tx, copyId, fixture.actor.memberId)), /giữ chỗ/);
});

test('PG: full catalogue includes unavailable/no-copy titles, 50 per page and real categories without reserving them', async () => {
  const pool = harness.getPool();
  const category = 'Catalogue all ' + randomUUID();
  const categoryId = (await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category])).rows[0].id;
  const titles = await pool.query(`INSERT INTO book_titles (title)
    SELECT 'Catalogue ' || lpad(n::text, 3, '0') FROM generate_series(1, 51) AS n RETURNING id`);
  for (const row of titles.rows) await pool.query('INSERT INTO book_title_categories (title_id, category_id) VALUES ($1, $2)', [row.id, categoryId]);
  await pool.query('INSERT INTO book_title_categories (title_id, category_id) VALUES ($1, $2)', [fixture.titleId, categoryId]);
  const first = await listPublicReservationBooks(pool, { category, includeUnavailable: true, limit: 50 });
  const second = await listPublicReservationBooks(pool, { category, includeUnavailable: true, limit: 50, page: 2 });
  assert.equal(first.items.length, 50);
  assert.equal(first.total, 52);
  assert.equal(second.items.length, 2);
  assert.equal(new Set([...first.items, ...second.items].map(b => b.titleId)).size, 52);
  assert(first.categories?.includes(category));
  assert(first.items.every(b => b.availableCopiesCount === 0));
  const available = await listPublicReservationBooks(pool, { category, includeUnavailable: true, onlyAvailable: true });
  assert.equal(available.total, 1);
  assert.equal(available.items[0].titleId, fixture.titleId);
  assert.equal(available.items[0].availableCopiesCount, 6);
  const held = await reserve('0911000088', '192.0.2.188');
  const reduced = await listPublicReservationBooks(pool, { category, includeUnavailable: true, onlyAvailable: true });
  assert.equal(reduced.items[0].availableCopiesCount, 5);
  await withTransaction(pool, tx => cancelReservation(tx, { id: held.reservation.id }, fixture.actor));
  await pool.query("UPDATE book_copies SET status = 'MAINTENANCE' WHERE id IN (SELECT bc.id FROM book_copies bc JOIN book_editions be ON be.id = bc.edition_id WHERE be.title_id = $1)", [fixture.titleId]);
  assert.equal((await listPublicReservationBooks(pool, { category })).total, 0);
  const all = await listPublicReservationBooks(pool, { category, includeUnavailable: true });
  assert.equal(all.total, 52);
  assert(all.items.every(b => b.availableCopiesCount === 0));
});

test('PG: handoff, return, quota and borrower identity stay consistent', async () => {
  const pool = harness.getPool();
  const phone = '0911000010';
  const orders = [await reserve(phone, '192.0.2.61'), await reserve(phone, '192.0.2.62'), await reserve(phone, '192.0.2.63')];
  await pool.query('UPDATE cash_sessions SET is_closed = TRUE, actual_closing_cash = expected_closing_cash WHERE is_closed = FALSE');
  await withTransaction(pool, tx => openCashSession(tx, { sessionId: 'CS-' + randomUUID().slice(0, 20), sessionDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }), openedBy: fixture.actor.userId, openingCash: 0n, discrepancyReason: 'Synthetic isolated fixture' }));
  const mismatch = (await pool.query("INSERT INTO borrowers (full_name, phone) VALUES ('Other person', '0911000099') RETURNING id")).rows[0].id;
  await assert.rejects(() => withTransaction(pool, tx => fulfillReservation(tx, orders[0].reservation.id, { borrowerId: mismatch, paymentMethod: 'CASH', depositPaymentConfirmed: true }, fixture.actor)), /BORROWER|khớp|khác|đối chiếu/i);
  const secret = 'synthetic-managed-session-secret-review-2026';
  const actor = { ...fixture.actor, userId: randomUUID() };
  const token = await signSessionToken(actor, secret);
  const key = randomUUID();
  const body = { paymentMethod: 'CASH', depositPaymentConfirmed: true };
  const requestHandoff = (payload = body) => handleRequest(new Request(`http://localhost/api/v1/reservations/${orders[0].reservation.id}/fulfill`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key }, body: JSON.stringify(payload),
  }), { JWT_SECRET: secret }, { queryable: pool, membersDb: { [actor.memberId]: { id: actor.memberId, is_admin: true, is_active: true, is_alumni: false, token_version: 1 } } });
  const response = await requestHandoff();
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const payload = await response.json();
  const result = { reservation: payload.data, loanReceipt: payload.loanReceipt };
  const retry = await requestHandoff();
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).loanReceipt.id, result.loanReceipt.id);
  assert.equal((await requestHandoff({ ...body, paymentMethod: 'BANK_TRANSFER' })).status, 409);
  await assert.rejects(() => withTransaction(pool, tx => updateBorrower(tx, result.loanReceipt.borrowerId, { phone: '0911000098' }, fixture.actor.userId)), /PHONE|nghĩa vụ|mượn|đổi/i);
  await assert.rejects(() => reserve(phone, '192.0.2.64'), /hạn mức/);
  await withTransaction(pool, tx => settleReturnReceipt(tx, { receiptId: result.loanReceipt.id, returnedCopyIds: [result.loanReceipt.items[0].copyId], refundMethod: 'CASH' }, fixture.actor.userId));
  assert.equal((await reserve(phone, '192.0.2.65')).reservation.status, 'HELD');
  assert.equal((await pool.query('SELECT status FROM reservations WHERE id = $1', [orders[0].reservation.id])).rows[0].status, 'RETURNED');
});

test('PG: export tickets remain single-use across independent stores and connections', async () => {
  const pool = harness.getPool();
  const first = await pool.connect();
  const second = await pool.connect();
  const id = randomUUID();
  const expiry = Date.now() + 60000;
  try {
    const consumed = await Promise.all([
      new BoundedAtomicTicketStore(10).atomicConsumeAsync(id, expiry, first),
      new BoundedAtomicTicketStore(10).atomicConsumeAsync(id, expiry, second),
    ]);
    assert.equal(consumed.filter(Boolean).length, 1);
    assert.equal(await new BoundedAtomicTicketStore(10).atomicConsumeAsync(id, expiry, first), false);
  } finally { first.release(); second.release(); }
});
