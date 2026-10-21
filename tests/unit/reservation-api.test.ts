process.env.RESERVATION_IP_SECRET = 'synthetic-reservation-unit-secret-2026';
/**
 * YSBK Unit Tests - Reservation HTTP APIs & Adapter-to-Router Flow
 * Kiểm thử: PUB-02...PUB-05, PUB-07, PUB-08, SEC-01...SEC-06
 * Tuân thủ thiết kế: docs/technical/public-reservation-design.md
 */

import test from 'node:test';
import assert from 'node:assert';
import { handleRequest } from '../../src/server/router.ts';
import {readerHeaders,withReaderSession} from '../helpers/reader-session.ts';

function createMockRouterDb() {
  return withReaderSession({
    query: async (sql: string, params?: any[]) => {
      // Khóa quota
      if (sql.includes('INSERT INTO reservation_quota_locks')) {
        return { rows: [] };
      }
      // Đếm IP 24h
      if (sql.includes('ip_hash = $1')) {
        return { rows: [] };
      }
      // Đếm SĐT
      if (sql.includes("phone = $1 AND status = 'HELD'")) {
        return { rows: [{ count: '0' }] };
      }
      if (sql.includes('unreturned_count')) {
        return { rows: [{ unreturned_count: '0' }] };
      }
      // Ca trực
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
      // Bản sách trống
      if (sql.includes('book_copies bc') && sql.includes('FOR UPDATE OF bc')) {
        return {
          rows: [
            {
              id: 'copy-01',
              barcode: 'BC-00100',
              cover_price: 150000,
              title_id: 'title-01',
              title: 'Lập trình TypeScript',
              author: 'Anders Hejlsberg',
              deposit_amount: 150000,
            },
          ],
        };
      }
      // Chèn đơn
      if (sql.includes('INSERT INTO reservations')) {
        return { rows: [{ id: 'res-api-001' }] };
      }
      // Tra cứu theo token
      if (sql.includes('WHERE r.token_hash = $1')) {
        return {
          rows: [
            {
              id: 'res-api-001',
              code: 'RSV-20261020-001',
              status: 'HELD',
              title_id: 'title-01',
              book_title: 'Lập trình TypeScript',
              author_name: 'Anders Hejlsberg',
              schedule_id: 'sched-01',
              shift_date: '2026-10-20',
              shift_time: '14:00 - 17:00',
              pickup_location: 'Bàn trực sảnh B',
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              estimated_deposit: 150000,
              created_at: '2026-10-20T14:00:00+07:00',
            },
          ],
        };
      }
      // Hủy đơn
      if (sql.includes('UPDATE reservations') && sql.includes("status = 'CANCELLED'")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });
}

test('PUB-02: POST /api/v1/public/reservations thiếu trường bắt buộc -> 400 Bad Request', async () => {
  const db = createMockRouterDb();
  const req = new Request('http://localhost:8787/api/v1/public/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',...readerHeaders },
    body: JSON.stringify({
      titleId: '', // thiếu
      scheduleId: 'sched-01',
      fullName: '',
      phone: 'invalid-phone',
      captchaToken: 'valid-test-token',
    }),
  });

  const res = await handleRequest(
    req,
    { TURNSTILE_SECRET_KEY: 'test-secret' } as any,
    { queryable: db as any, turnstileFetch: (async () => new Response(JSON.stringify({ success: true, action: 'reservation' }))) as any }
  );

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
});

test('SEC-01: POST /api/v1/public/reservations với CAPTCHA không hợp lệ -> 400 CAPTCHA_INVALID', async () => {
  const db = createMockRouterDb();
  const req = new Request('http://localhost:8787/api/v1/public/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',...readerHeaders },
    body: JSON.stringify({
      titleId: 'title-01',
      scheduleId: 'sched-01',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      captchaToken: 'invalid-captcha-token',
    }),
  });

  const res = await handleRequest(
    req,
    { TURNSTILE_SECRET_KEY: 'test-secret' } as any,
    {
      queryable: db as any,
      turnstileFetch: (async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }))) as any,
    }
  );

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, 'CAPTCHA_INVALID');
});

test('PUB-04 & SEC-03: POST /api/v1/public/reservations thành công tạo đơn (201) và cấp token riêng', async () => {
  const db = createMockRouterDb();
  const req = new Request('http://localhost:8787/api/v1/public/reservations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': '203.0.113.195',
      ...readerHeaders,
    },
    body: JSON.stringify({
      titleId: 'title-01',
      scheduleId: 'sched-01',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      captchaToken: '1x0000000000000000000000000000000AA',
    }),
  });

  const res = await handleRequest(
    req,
    { TURNSTILE_SECRET_KEY: 'test-secret' } as any,
    {
      queryable: db as any,
      now: new Date('2026-10-20T14:30:00+07:00'),
      turnstileFetch: (async () => new Response(JSON.stringify({ success: true, action: 'reservation', challenge_ts: '2026-10-20T14:30:00Z' }))) as any,
    }
  );

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.reservation);
  assert.equal(data.reservation.status, 'HELD');
  assert.ok(data.lookupToken.startsWith('rsv_tok_'));
});

test('SEC-03 & SEC-04: GET /api/v1/public/reservation tra cứu bằng Bearer token trả đúng đơn (200)', async () => {
  const db = createMockRouterDb();
  const req = new Request('http://localhost:8787/api/v1/public/reservation', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer rsv_tok_valid_test_lookup_token_12345',
    },
  });

  const res = await handleRequest(req, {} as any, { queryable: db as any });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.data.id, 'res-api-001');
  assert.equal(data.data.code, 'RSV-20261020-001');
});

test('SEC-03: GET /api/v1/public/reservation thiếu token trả 401 LOOKUP_TOKEN_MISSING', async () => {
  const db = createMockRouterDb();
  const req = new Request('http://localhost:8787/api/v1/public/reservation', {
    method: 'GET',
  });

  const res = await handleRequest(req, {} as any, { queryable: db as any });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'LOOKUP_TOKEN_MISSING');
});

test('PUB-07: POST /api/v1/public/reservation/cancel bạn đọc đã đăng nhập hủy đơn cũ bằng Bearer token', async () => {
  const db = withReaderSession(createMockRouterDb());
  const req = new Request('http://localhost:8787/api/v1/public/reservation/cancel', {
    method: 'POST',
    headers: {
      ...readerHeaders,
      'Content-Type': 'application/json',
      Authorization: 'Bearer rsv_tok_valid_test_lookup_token_12345',
    },
    body: JSON.stringify({ reason: 'Bận đột xuất không đến được' }),
  });

  const res = await handleRequest(req, {} as any, { queryable: db as any });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.data.status, 'CANCELLED');
});

test('hủy đơn bằng mã bí mật vẫn yêu cầu đăng nhập trước khi đọc/ghi đơn',async()=>{
  const statements:string[]=[];
  const response=await handleRequest(new Request('http://localhost:8787/api/v1/public/reservation/cancel',{method:'POST',headers:{Authorization:'Bearer secret-token','Content-Type':'application/json'},body:'{}'}),{}, {queryable:{query:async(sql:string)=>{statements.push(sql);return {rows:[],rowCount:0};}} as any});
  assert.equal(response.status,401);assert.deepEqual(statements,['BEGIN','ROLLBACK']);
});

test('SEC-07: GET /api/v1/reservations yêu cầu quyền thành viên trực (chặn anonymous/guest)', async () => {
  const db = createMockRouterDb();
  // Request không có auth token
  const req = new Request('http://localhost:8787/api/v1/reservations', {
    method: 'GET',
  });

  const res = await handleRequest(req, {} as any, { queryable: db as any });
  assert.equal(res.status, 401);
});
