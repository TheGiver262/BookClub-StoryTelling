import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/server/index.ts';
import { getDatabasePool, closeDatabasePool, checkDatabaseReadiness } from '../../src/server/db/client.ts';
import { apiClient } from '../../src/lib/api-client.ts';

test('Beta serves assets without opening a database and preserves API JSON errors', async () => {
  let assets = 0;
  const env = { NODE_ENV: 'production', ASSETS: { fetch: async () => { assets++; return new Response('<html>YSBK</html>', { headers: { 'Content-Type': 'text/html' } }); } } };
  const home = await worker.fetch(new Request('https://ysbk.test/'), env as any);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<html>/);
  const missing = await worker.fetch(new Request('https://ysbk.test/api/v1/missing'), env as any);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('Content-Type') || '', /json/);
  assert.equal(assets, 1);
});

test('Hyperdrive is used before local database URLs and uses a small request pool', async () => {
  const env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/wrong', HYPERDRIVE: { connectionString: 'postgresql://localhost/ysbk_test_hyperdrive' } };
  try {
    const pool = getDatabasePool(env as any);
    assert.equal(pool.options.connectionString, env.HYPERDRIVE.connectionString);
    assert.equal(pool.options.max, 2);
  } finally { await closeDatabasePool(env as any); }
});

test('Production fails closed without Hyperdrive even when a fallback URL exists', async () => {
  const env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/wrong' };
  try { assert.throws(() => getDatabasePool(env), /HYPERDRIVE/); }
  finally { await closeDatabasePool(env); }
  assert.equal((await checkDatabaseReadiness(env)).ok, false);
});

test('Incident reporting API rejects anonymous callers before any stock mutation', async () => {
  const response = await worker.fetch(new Request('https://ysbk.test/api/v1/reservations/00000000-0000-0000-0000-000000000001/issue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Missing copy' }),
  }), { NODE_ENV: 'production' });
  assert.equal(response.status, 401);
});

test('Availability adapter asks for fresh data and preserves paging parameters', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(init?.cache, 'no-store');
      assert.match(String(url), /page=2/);
      assert.match(String(url), /limit=24/);
      return Response.json({ data: [], meta: { page: 2, limit: 24, total: 2000 } });
    };
    assert.equal((await apiClient.listPublicReservationBooks({ page: 2, limit: 24 })).total, 2000);
  } finally { globalThis.fetch = saved; }
});

test('Visible availability refresh pauses hidden pages, avoids overlap, and cleans up', async () => {
  const { startAvailabilityRefresh, availabilityRefreshInterval } = await import('../../src/lib/availability-refresh.ts');
  assert.equal(availabilityRefreshInterval(new Date('2026-10-20T08:00:00Z')), 30000);
  assert.equal(availabilityRefreshInterval(new Date('2026-10-21T08:00:00Z')), 60000);
  const doc = Object.assign(new EventTarget(), { hidden: false });
  let tick: () => void = () => {};
  let cleared = false;
  const win = Object.assign(new EventTarget(), { setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: () => { cleared = true; } });
  let calls = 0;
  let finish: () => void = () => {};
  const stop = startAvailabilityRefresh(() => { calls++; return new Promise<void>(resolve => { finish = resolve; }); }, doc, win as any);
  tick(); tick();
  assert.equal(calls, 1);
  finish(); await Promise.resolve(); await Promise.resolve();
  doc.hidden = true; tick();
  assert.equal(calls, 1);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 2);
  finish(); await Promise.resolve(); await Promise.resolve();
  stop(); win.dispatchEvent(new Event('focus'));
  assert.equal(calls, 2);
  assert.equal(cleared, true);
});
