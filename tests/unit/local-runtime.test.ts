import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { verifyTurnstileToken } from '../../src/server/reservations/captcha.ts';
import { validateLocalSettings, readLocalGoogleClient } from '../../scripts/local-runtime.mjs';
import { handleRequest } from '../../src/server/router.ts';
import {readerHeaders,withReaderSession} from '../helpers/reader-session.ts';

const testSecret = '1x0000000000000000000000000000000AA';
const testProvider = async () => Response.json({ success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } });

test('Local Google setup is optional and accepts only a web client with the local Auth callback', () => {
  const directory=mkdtempSync(join(tmpdir(),'ysbk-google-'));
  const file=join(directory,'client.json');
  const web={client_id:'123-localtest.apps.googleusercontent.com',client_secret:'local-test-secret-000000',redirect_uris:['http://127.0.0.1:55321/auth/v1/callback']};
  try {
    assert.equal(readLocalGoogleClient(file),null);
    writeFileSync(file,JSON.stringify({web}));
    assert.deepEqual(readLocalGoogleClient(file),{clientId:web.client_id,clientSecret:web.client_secret});
    for(const invalid of [{installed:web},{web:{...web,redirect_uris:['https://other.example/callback']}},{web:{...web,client_secret:'secret\nINJECTED=true'}}]) {
      writeFileSync(file,JSON.stringify(invalid));
      assert.throws(()=>readLocalGoogleClient(file),error=>error instanceof Error && error.message==='Invalid local Google OAuth client configuration.');
    }
    writeFileSync(file,'{"client_secret":"do-not-echo-this"');
    assert.throws(()=>readLocalGoogleClient(file),error=>error instanceof Error && error.message==='Invalid local Google OAuth client configuration.');
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('Official Turnstile test responses need explicit local permission and the test key', async () => {
  const options = { expectedHostname: 'localhost', expectedAction: 'reservation' };
  assert.equal((await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', undefined, testSecret, testProvider, options)).success, false);
  assert.equal((await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', undefined, testSecret, testProvider, { ...options, allowTestKeys: true })).success, true);
  assert.equal((await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', undefined, 'real-secret', testProvider, { ...options, allowTestKeys: true })).success, false);
});

test('Local runtime refuses foreign targets and keeps persistent and disposable databases separate', () => {
  const settings = { databaseHost: '127.0.0.1', databasePort: 55433, databaseName: 'ysbk_local', testDatabaseName: 'ysbk_test_local', webPort: 4321,
    postgresPassword: 'a'.repeat(48), authDatabasePassword: 'b'.repeat(48), appDatabasePassword: 'c'.repeat(48), authJwtSecret: 'd'.repeat(64), appJwtSecret: 'e'.repeat(64), ipSecret: 'f'.repeat(64) };
  assert.doesNotThrow(() => validateLocalSettings(settings));
  assert.throws(() => validateLocalSettings({ ...settings, databaseHost: 'project.supabase.co' }), /local/);
  assert.throws(() => validateLocalSettings({ ...settings, testDatabaseName: 'ysbk_local' }), /local/);
  assert.throws(() => validateLocalSettings({ ...settings, postgresPassword: '' }), /secret/i);
});

test('Production and public hosts cannot opt into local CAPTCHA test responses', async () => {
  for (const [mode, host] of [['production', 'localhost'], ['development', 'public.example']]) {
    const response = await handleRequest(new Request(`http://${host}/api/v1/public/reservations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10',...readerHeaders },
      body: JSON.stringify({ captchaToken: 'XXXX.DUMMY.TOKEN.XXXX' }),
    }), { NODE_ENV: mode, LOCAL_TESTING: 'true', TURNSTILE_SECRET_KEY: testSecret, TURNSTILE_EXPECTED_HOSTNAME: 'localhost' }, {
      queryable: withReaderSession({ query: async () => { throw new Error('Should fail CAPTCHA before reservation SQL'); } }), turnstileFetch: testProvider,
    } as any);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'CAPTCHA_INVALID');
  }
});
