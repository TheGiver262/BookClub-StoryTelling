import test from 'node:test';
import assert from 'node:assert';
import { validateTestDatabaseUrl } from '../integration/db-harness.ts';

test('S02-01 Offline Regression: Throws when TEST_DATABASE_URL is missing or empty', () => {
  assert.throws(
    () => validateTestDatabaseUrl(''),
    /\[BLOCKED: DB_RUNTIME_MISSING\]/
  );
  assert.throws(
    () => validateTestDatabaseUrl(undefined),
    /\[BLOCKED: DB_RUNTIME_MISSING\]/
  );
});

test('S02-01 Offline Regression: Blocks query parameter host/port override attacks', () => {
  // Attack URL: attempts to fool WHATWG hostname parser while overriding driver host via ?host=...
  const attackUrl = 'postgresql://review:dummy@127.0.0.1:5432/ysbk_test_review?host=example.invalid';
  assert.throws(
    () => validateTestDatabaseUrl(attackUrl),
    /\[BLOCKED: QUERY_PARAMS_FORBIDDEN\]/
  );

  const portAttack = 'postgresql://review:dummy@127.0.0.1:5432/ysbk_test_review?port=6543';
  assert.throws(
    () => validateTestDatabaseUrl(portAttack),
    /\[BLOCKED: QUERY_PARAMS_FORBIDDEN\]/
  );

  const sslAttack = 'postgresql://review:dummy@127.0.0.1:5432/ysbk_test_review?sslmode=require';
  assert.throws(
    () => validateTestDatabaseUrl(sslAttack),
    /\[BLOCKED: QUERY_PARAMS_FORBIDDEN\]/
  );
});

test('S02-01 Offline Regression: Blocks non-local hosts and cloud endpoints', () => {
  const remoteHosts = [
    'postgresql://user:pass@db.example.com:5432/ysbk_test_stage02',
    'postgresql://user:pass@aws-rds.endpoint:5432/ysbk_test_stage02',
    'postgresql://user:pass@192.168.1.100:5432/ysbk_test_stage02',
    'postgresql://user:pass@supabase.co:5432/ysbk_test_stage02',
  ];

  for (const url of remoteHosts) {
    assert.throws(
      () => validateTestDatabaseUrl(url),
      /\[BLOCKED: UNSAFE_HOST\]/,
      `Should reject remote host: ${url}`
    );
  }
});

test('S02-01 Offline Regression: Blocks system databases and invalid test prefix', () => {
  const invalidDbs = [
    'postgresql://user:pass@127.0.0.1:5432/postgres',
    'postgresql://user:pass@127.0.0.1:5432/template0',
    'postgresql://user:pass@127.0.0.1:5432/template1',
    'postgresql://user:pass@127.0.0.1:5432/ysbk',
    'postgresql://user:pass@127.0.0.1:5432/ysbk_prod',
    'postgresql://user:pass@127.0.0.1:5432/my_custom_db',
  ];

  for (const url of invalidDbs) {
    assert.throws(
      () => validateTestDatabaseUrl(url),
      /\[BLOCKED: (UNSAFE_DATABASE_NAME|FORBIDDEN_DATABASE)\]/,
      `Should reject forbidden or non-test database: ${url}`
    );
  }
});

test('S02-01 Offline Regression: Accepts valid local URLs with IPv4, localhost, and IPv6 [::1]', () => {
  const valid1 = validateTestDatabaseUrl('postgresql://myuser:secret123@127.0.0.1:5432/ysbk_test_dev');
  assert.strictEqual(valid1.host, '127.0.0.1');
  assert.strictEqual(valid1.port, 5432);
  assert.strictEqual(valid1.database, 'ysbk_test_dev');
  assert.strictEqual(valid1.user, 'myuser');
  assert.strictEqual(valid1.password, 'secret123');
  assert.strictEqual(valid1.sanitizedUri, 'postgresql://myuser:***@127.0.0.1:5432/ysbk_test_dev');
  assert.ok(!valid1.sanitizedUri.includes('secret123'), 'Sanitized URI must mask password');

  const valid2 = validateTestDatabaseUrl('postgresql://localhost:5433/ysbk_test_custom_port');
  assert.strictEqual(valid2.host, 'localhost');
  assert.strictEqual(valid2.port, 5433);
  assert.strictEqual(valid2.database, 'ysbk_test_custom_port');

  const validIpv6 = validateTestDatabaseUrl('postgresql://user:pwd@[::1]:5432/ysbk_test_ipv6');
  assert.strictEqual(validIpv6.host, '::1');
  assert.strictEqual(validIpv6.port, 5432);
  assert.strictEqual(validIpv6.database, 'ysbk_test_ipv6');
});
