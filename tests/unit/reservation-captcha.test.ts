/**
 * YSBK Unit Tests - Server-Side CAPTCHA Verification (SEC-01, SEC-02)
 * Tuân thủ thiết kế: docs/technical/public-reservation-design.md
 * PRF-01: Kiểm tra triệt để không có bypass, fail-closed an toàn, kiểm tra hostname, timeout, duplicate token.
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  verifyTurnstileToken,
} from '../../src/server/reservations/captcha.ts';

test('SEC-01: Thiếu token CAPTCHA bị từ chối ngay lập tức (400 CAPTCHA_TOKEN_MISSING)', async () => {
  await assert.rejects(
    async () => {
      await verifyTurnstileToken('', '127.0.0.1', 'secret-key');
    },
    (err: any) => err.statusCode === 400 && err.errorCode === 'CAPTCHA_TOKEN_MISSING'
  );

  await assert.rejects(
    async () => {
      await verifyTurnstileToken('   ', '127.0.0.1', 'secret-key');
    },
    (err: any) => err.statusCode === 400 && err.errorCode === 'CAPTCHA_TOKEN_MISSING'
  );
});

test('SEC-01: Thiếu secret key máy chủ thì fail-closed (503 CAPTCHA_CONFIG_MISSING)', async () => {
  const oldKey = process.env.TURNSTILE_SECRET_KEY;
  try {
    delete process.env.TURNSTILE_SECRET_KEY;
    await assert.rejects(
      async () => {
        await verifyTurnstileToken('some-token', '127.0.0.1', undefined);
      },
      (err: any) => err.statusCode === 503 && err.errorCode === 'CAPTCHA_CONFIG_MISSING'
    );
  } finally {
    if (oldKey) process.env.TURNSTILE_SECRET_KEY = oldKey;
  }
});

test('SEC-01: Test fail token (2x000...) gọi provider và nhận success: false (không bypass)', async () => {
  let providerCalls = 0;
  const mockFetch = async () => {
    providerCalls++;
    return new Response(
      JSON.stringify({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
      { status: 200 }
    );
  };

  const result = await verifyTurnstileToken(
    '2x0000000000000000000000000000000AA',
    '127.0.0.1',
    'any-secret',
    mockFetch as any
  );
  assert.equal(providerCalls, 1, 'Provider bắt buộc phải được gọi, không bypass');
  assert.equal(result.success, false);
  assert.ok(result.errorCodes?.includes('invalid-input-response'));
});

test('SEC-01: Test pass token (1x000...) gọi provider và nhận success: true (không bypass)', async () => {
  let providerCalls = 0;
  const mockFetch = async () => {
    providerCalls++;
    return new Response(
      JSON.stringify({
        success: true,
        challenge_ts: new Date().toISOString(),
      }),
      { status: 200 }
    );
  };

  const result = await verifyTurnstileToken(
    '1x0000000000000000000000000000000AA',
    '127.0.0.1',
    'any-secret',
    mockFetch as any
  );
  assert.equal(providerCalls, 1, 'Provider bắt buộc phải được gọi, không bypass');
  assert.equal(result.success, true);
});

test('SEC-01: Token hết hạn hoặc dùng lại (timeout-or-duplicate) trả về success: false', async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        'error-codes': ['timeout-or-duplicate'],
      }),
      { status: 200 }
    );

  const result = await verifyTurnstileToken(
    'expired-or-used-token',
    '127.0.0.1',
    'secret-key',
    mockFetch as any
  );
  assert.equal(result.success, false);
  assert.ok(result.errorCodes?.includes('timeout-or-duplicate'));
});

test('SEC-01: Kiểm tra ràng buộc hostname/action bảo vệ chống giả mạo', async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        hostname: 'malicious-site.com',
        action: 'wrong-action',
      }),
      { status: 200 }
    );

  const result = await verifyTurnstileToken(
    'valid-token',
    '127.0.0.1',
    'secret-key',
    mockFetch as any,
    { expectedHostname: 'ysbk.edu.vn', expectedAction: 'reservation' }
  );
  assert.equal(result.success, false);
  assert.ok(result.errorCodes?.includes('invalid-hostname'));
});

test('SEC-02: Nhà cung cấp CAPTCHA trả lỗi HTTP 500 ném 503 CAPTCHA_PROVIDER_HTTP_ERROR', async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });

  await assert.rejects(
    async () => {
      await verifyTurnstileToken(
        'user-token-xyz',
        '127.0.0.1',
        'secret-key',
        mockFetch as any
      );
    },
    (err: any) => err.statusCode === 503 && err.errorCode === 'CAPTCHA_PROVIDER_HTTP_ERROR'
  );
});

test('SEC-02: Lỗi mạng hoặc kết nối timeout ném 503 Fail-Closed', async () => {
  const mockFetch = async () => {
    throw new Error('Connection refused (ETIMEDOUT)');
  };

  await assert.rejects(
    async () => {
      await verifyTurnstileToken(
        'user-token-xyz',
        '127.0.0.1',
        'secret-key',
        mockFetch as any
      );
    },
    (err: any) => err.statusCode === 503 && err.errorCode === 'CAPTCHA_NETWORK_ERROR'
  );
});

test('SEC-01: Xác thực thành công từ API Cloudflare trả về đúng kết quả', async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        challenge_ts: '2026-10-20T14:00:00Z',
        hostname: 'ysbk.edu.vn',
        action: 'reservation',
      }),
      { status: 200 }
    );

  const result = await verifyTurnstileToken(
    'valid-real-token',
    '127.0.0.1',
    'secret-key',
    mockFetch as any
  );
  assert.equal(result.success, true);
  assert.equal(result.hostname, 'ysbk.edu.vn');
});
