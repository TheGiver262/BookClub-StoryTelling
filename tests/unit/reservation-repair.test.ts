import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIpAddress, hashIpAddress, deriveReservationLookupToken } from '../../src/server/reservations/rules.ts';
import { verifyTurnstileToken } from '../../src/server/reservations/captcha.ts';
import { BoundedAtomicTicketStore, createExportTicket, validateAndConsumeExportTicket } from '../../src/modules/reporting/reporting-service.ts';
import { getReservationIntent, clearReservationIntent } from '../../src/lib/reservation-intent.ts';
import { resolveShiftEndTime } from '../../src/server/reservations/service.ts';
import { getDatabasePool, closeDatabasePool } from '../../src/server/db/client.ts';
import { apiClient } from '../../src/lib/api-client.ts';

test('The staff handoff adapter sends the router idempotency header', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('X-Idempotency-Key'), 'synthetic-handoff-intent');
      return Response.json({ data: { id: 'synthetic-order' }, loanReceipt: { id: 'synthetic-receipt' } });
    };
    await apiClient.fulfillStaffReservation('synthetic-order', { paymentMethod: 'CASH', depositPaymentConfirmed: true }, 'synthetic-handoff-intent');
  } finally { globalThis.fetch = saved; }
});

test('Workers requests do not reuse PostgreSQL sockets from another request', async () => {
  const first = { DATABASE_URL: 'postgresql://localhost/ysbk_test_scope' };
  const second = { ...first };
  try {
    assert.equal(getDatabasePool(first), getDatabasePool(first));
    assert.notEqual(getDatabasePool(first), getDatabasePool(second));
  } finally { await closeDatabasePool(first); await closeDatabasePool(second); }
});

test('Malformed shifts fail closed instead of inventing a pickup deadline', () => {
  assert.throws(() => resolveShiftEndTime('2026-10-20', 'invalid'), /ca trực/);
  assert.throws(() => resolveShiftEndTime('2026-10-20', '14:00 - 27:00'), /ca trực/);
  assert.throws(() => resolveShiftEndTime('2026-02-30', '14:00 - 17:00'), /ca trực/);
  assert.equal(resolveShiftEndTime('2026-10-20', '14:00 - 17:00 (thu dọn 17:15)').toISOString(), '2026-10-20T10:00:00.000Z');
});

test('Equivalent IPv6 addresses share one reservation quota', () => {
  assert.equal(normalizeIpAddress('2001:db8::1'), normalizeIpAddress('2001:0db8:0:0:0:0:0:1'));
  assert.equal(normalizeIpAddress('::ffff:c000:201'), '192.0.2.1');
  assert.throws(() => normalizeIpAddress('forged-client-ip'));
});

test('Reservation secrets are required instead of using a public fallback', () => {
  const saved = { ip: process.env.RESERVATION_IP_SECRET, jwt: process.env.JWT_SECRET };
  delete process.env.RESERVATION_IP_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.throws(() => hashIpAddress('192.0.2.1'), /SECRET/);
    assert.throws(() => deriveReservationLookupToken('review-key', '0912345678'), /SECRET/);
  } finally {
    if (saved.ip !== undefined) process.env.RESERVATION_IP_SECRET = saved.ip;
    if (saved.jwt !== undefined) process.env.JWT_SECRET = saved.jwt;
  }
});

test('CAPTCHA rejects missing hostname/action and non-boolean success', async () => {
  for (const result of [{ success: true }, { success: 'false', hostname: 'ysbk.test', action: 'reservation' }]) {
    const verified = await verifyTurnstileToken('synthetic-token', '192.0.2.1', 'synthetic-secret',
      async () => Response.json(result), { expectedHostname: 'ysbk.test', expectedAction: 'reservation' });
    assert.equal(verified.success, false);
  }
});

test('Distributed ticket consume fails closed when database fails', async () => {
  const store = new BoundedAtomicTicketStore();
  await assert.rejects(() => store.atomicConsumeAsync('synthetic-ticket', Date.now() + 300000,
    { query: async () => { throw new Error('database unavailable'); } }));
});

test('An in-memory export ticket cannot bypass a changed signing key', () => {
  const actor = { userId: 'synthetic-member', role: 'MEMBER' as const, isActive: true, isAlumni: false, tokenVersion: 1 };
  const ticket = createExportTicket(actor, 'CIRCULATION', {}, 'CSV', 'synthetic-old-key-for-export-testing');
  assert.throws(() => validateAndConsumeExportTicket(ticket.ticket, actor, 'synthetic-new-key-for-export-testing'));
});

test('Reservation intent survives reload without persisting personal information', async () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key),
  } });
  try {
    const payload = { fullName: 'Synthetic Person', phone: '0912345678', scheduleId: 'schedule-one' };
    const first = await getReservationIntent(payload);
    assert.match(first, /^res-req-[a-f0-9-]{36}$/);
    assert.equal(await getReservationIntent({ ...payload }), first);
    assert.ok(!JSON.stringify([...memory.values()]).includes(payload.phone));
    assert.notEqual(await getReservationIntent({ ...payload, scheduleId: 'schedule-two' }), first);
    clearReservationIntent();
    assert.equal(memory.size, 0);
  } finally { delete (globalThis as any).sessionStorage; }
});
