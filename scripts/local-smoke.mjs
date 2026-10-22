import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { validateLocalSettings } from './local-runtime.mjs';

const base = 'http://localhost:4321';
const settings = JSON.parse(readFileSync(new URL('../.local/ysbk/settings.json', import.meta.url), 'utf8'));
validateLocalSettings(settings);
const accounts = JSON.parse(readFileSync(new URL('../.local/ysbk/accounts.json', import.meta.url), 'utf8'));
const checks = [];
const readerCookie=process.env.YSBK_READER_SESSION_COOKIE;
const ok = message => { checks.push(message); console.log(`PASS: ${message}`); };
const request = (path, options = {}) => fetch(base + path, { ...options, headers:{...(readerCookie?{Cookie:readerCookie}:{}),...options.headers},signal: AbortSignal.timeout(15000) });
const post = (body, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

assert.equal((await request('/')).status, 200);
assert.equal((await request('/health/ready')).status, 200);
ok('Web port 4321, PostgreSQL và Supabase Auth local sẵn sàng');
assert.equal((await request('/api/v1/reservations')).status, 401);
ok('Khách chưa đăng nhập bị chặn API nội bộ');
for (const account of accounts) {
  const login = await request('/api/v1/auth/login-internal', post({ username: account.username, password: account.password }));
  assert.equal(login.status, 200, `Login ${account.username} failed (${login.status})`);
  const rawCookie = login.headers.get('set-cookie') || '';
  assert.match(rawCookie, /HttpOnly/i);
  assert.match(rawCookie, /SameSite=Lax/i);
  const headers = { Cookie: rawCookie.split(';')[0] };
  const me = await request('/api/v1/auth/me', { headers });
  assert.equal(me.status, 200);
  const actor = (await me.json()).data;
  assert.equal(actor.role, account.isAdmin ? 'ADMIN' : 'MEMBER');
  assert.equal(actor.username, account.username);
  assert.equal((await request('/api/v1/reservations', { headers })).status, 200);
  assert.equal((await request('/api/v1/auth/logout', { method: 'POST', headers })).status, 200);
  assert.equal((await request('/api/v1/auth/me', { headers })).status, 401);
  ok(`Auth thật: ${account.username}, quyền ${actor.role}, cookie/session và logout`);
}
const books = await request('/api/v1/public/reservation-books?limit=24');
assert.equal(books.status, 200);
assert.equal(books.headers.get('cache-control'), 'no-store');
const catalog = await books.json();
assert.ok(catalog.data.length > 0, 'Cần ít nhất một sách khả dụng để kiểm tra đặt sách');
const schedules = (await (await request('/api/v1/public/pickup-schedules')).json()).data;
assert.ok(schedules.length > 0, 'Cần ca trực mở để kiểm tra đặt sách');
const anonymous = await fetch(base+'/api/v1/public/reservations',post({}));
assert.equal(anonymous.status,401);
assert.equal((await anonymous.json()).error.code,'READER_LOGIN_REQUIRED');
ok('Đặt sách bắt buộc đăng nhập bạn đọc trước CAPTCHA');
if(!readerCookie){
  const blocked=['Chưa có phiên Google thật: chưa kiểm chứng tạo/tra/hủy qua tài khoản.'];
  writeFileSync(new URL('../.local/ysbk/smoke-result.json', import.meta.url),JSON.stringify({timestamp:new Date().toISOString(),status:'PARTIAL',checks,blocked},null,2));
  console.log('PARTIAL: các kiểm tra cơ bản đạt; cần YSBK_READER_SESSION_COOKIE của tài khoản QA để thử đặt/tra/hủy.');
  process.exit(2);
}
const readerResponse=await request('/api/v1/readers/me');assert.equal(readerResponse.status,200);
const reader=(await readerResponse.json()).data;assert.ok(reader.phone&&reader.fullName);
const missingCaptcha = await request('/api/v1/public/reservations', post({}));
assert.equal(missingCaptcha.status, 400);
assert.equal((await missingCaptcha.json()).error.code, 'CAPTCHA_TOKEN_MISSING');
ok('Danh mục/lịch thật, no-store và từ chối đặt thiếu CAPTCHA');

const key = randomUUID();
const fullName = `LOCAL SMOKE ${key}`;
let reservationId;
let cancelled = false;
try {
  const created = await request('/api/v1/public/reservations', post({ titleId: catalog.data[0].titleId, scheduleId: schedules[0].id,
    fullName, phone: '0999999901', captchaToken: 'XXXX.DUMMY.TOKEN.XXXX' }, { 'Idempotency-Key': key }));
  assert.equal(created.status, 201, `Create reservation failed: ${created.status} ${await created.clone().text()}`);
  const result = await created.json();
  reservationId=result.reservation.id;
  assert.equal(result.lookupToken, undefined);
  const lookup = await request('/api/v1/readers/reservations');
  assert.equal(lookup.status, 200);
  const reservation = (await lookup.json()).data.find(order => order.id === reservationId);
  assert.equal(reservation.status, 'HELD');
  assert.ok(!('phone' in reservation));
  const cancel = await request(`/api/v1/readers/reservations/${reservationId}/cancel`, post({ reason: 'Hoàn tất smoke test local' }));
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).data.status, 'CANCELLED');
  cancelled = true;
  ok('Turnstile test qua provider thật; tạo, tra cứu và hủy giữ chỗ; DTO công khai không lộ SĐT');
} finally {
  if (reservationId && !cancelled) {
    const cancel = await request(`/api/v1/readers/reservations/${reservationId}/cancel`, post({ reason: 'Dọn smoke test local' }));
    cancelled = cancel.ok;
  }
  const client = new pg.Client({ host: '127.0.0.1', port: 55433, database: 'ysbk_local', user: 'postgres', password: settings.postgresPassword });
  try {
    await client.connect();
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'ysbk_local');
    // Only remove this script's cancelled synthetic hold; leave user orders and all financial records intact.
    await client.query(`DELETE FROM reservations WHERE idempotency_key = $1 AND id=$2 AND reader_account_id=$3
      AND status = 'CANCELLED' AND fulfilled_receipt_id IS NULL`, [key,reservationId,reader.id]);
  } finally { await client.end(); }
}
writeFileSync(new URL('../.local/ysbk/smoke-result.json', import.meta.url), JSON.stringify({ timestamp: new Date().toISOString(), checks }, null, 2));
console.log('Smoke test local đạt. Đơn tổng hợp đã dọn; dữ liệu bạn nhập được giữ nguyên.');
