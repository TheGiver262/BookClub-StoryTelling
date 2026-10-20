import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { betaConfigurationErrors } from '../../scripts/check-beta-config.mjs';
import { prepareBetaSql } from '../../scripts/prepare-beta-db.mjs';

test('Beta deploy guard rejects placeholders, test CAPTCHA keys and mismatched hostnames', () => {
  const config = JSON.parse(readFileSync('wrangler.beta.json', 'utf8'));
  assert.ok(betaConfigurationErrors(config, { PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }).length >= 2);
  config.hyperdrive[0].id = '1234567890abcdef1234567890abcdef';
  config.vars.TURNSTILE_EXPECTED_HOSTNAME = 'yeusachbackkhoa-beta.club.workers.dev';
  assert.deepEqual(betaConfigurationErrors(config, { PUBLIC_TURNSTILE_SITE_KEY: '0x4REAL_SITE_KEY' }), []);
  config.vars.TURNSTILE_EXPECTED_HOSTNAME = 'https://wrong.example/';
  assert.ok(betaConfigurationErrors(config, { PUBLIC_TURNSTILE_SITE_KEY: '0x4REAL_SITE_KEY' }).length);
});

test('Beta bootstrap contains every migration, no demo data and server-only grants', () => {
  const { schema, access, tables } = prepareBetaSql();
  assert.match(schema, /15_reservation_integrity.sql/);
  assert.match(schema, /YSBK_BOOTSTRAP_REQUIRES_EMPTY_DATABASE/);
  assert.doesNotMatch(schema, /prov_sub_dung|Đắc Nhân Tâm|SEED MEMBERS/);
  assert.match(schema, /FUND_LOAN/);
  assert.ok(tables.includes('reservations'));
  assert.ok(tables.includes('consumed_export_tickets'));
  assert.match(access, /NOBYPASSRLS/);
  assert.match(access, /ENABLE ROW LEVEL SECURITY/);
  assert.match(access, /TO ysbk_app/);
  assert.doesNotMatch(access, /TO (?:anon|authenticated|PUBLIC)\s+USING/);
});
