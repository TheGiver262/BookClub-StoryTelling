import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import pg from 'pg';
import { prepareBetaSql } from './prepare-beta-db.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(root, '.local/ysbk');
const settingsPath = resolve(local, 'settings.json');
const accountsPath = resolve(local, 'accounts.json');
const workerConfigPath = resolve(local, 'wrangler.json');
const workerPidPath = resolve(local, 'worker.pid');
const web = 'http://127.0.0.1:4321';
const auth = 'http://127.0.0.1:55321/auth/v1';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const secret = () => randomBytes(32).toString('hex');

export function validateLocalSettings(settings) {
  if (settings.databaseHost !== '127.0.0.1' || settings.databasePort !== 55433 || settings.databaseName !== 'ysbk_local'
    || settings.testDatabaseName !== 'ysbk_test_local' || settings.webPort !== 4321) throw new Error('Refusing non-local YSBK target or changed fixed ports.');
  for (const key of ['postgresPassword', 'authDatabasePassword', 'appDatabasePassword', 'authJwtSecret', 'appJwtSecret', 'ipSecret']) {
    if (!/^[a-f0-9]{48,128}$/.test(settings[key] || '')) throw new Error(`Invalid local secret: ${key}`);
  }
}

function settings(create = false) {
  if (!existsSync(settingsPath)) {
    if (!create) throw new Error('Local chưa được khởi tạo. Chạy pnpm run local:up.');
    mkdirSync(local, { recursive: true });
    writeJson(settingsPath, { databaseHost: '127.0.0.1', databasePort: 55433, databaseName: 'ysbk_local', testDatabaseName: 'ysbk_test_local', webPort: 4321,
      postgresPassword: secret(), authDatabasePassword: secret(), appDatabasePassword: secret(), authJwtSecret: secret(), appJwtSecret: secret(), ipSecret: secret() });
  }
  const value = readJson(settingsPath);
  validateLocalSettings(value);
  return value;
}

function databaseUrl(s, user = 'postgres', database = s.databaseName) {
  if (![s.databaseName, s.testDatabaseName].includes(database)) throw new Error('Unsafe local database');
  const password = user === 'ysbk_app' ? s.appDatabasePassword : s.postgresPassword;
  return `postgresql://${user}:${password}@127.0.0.1:55433/${database}`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, windowsHide: true, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}

function compose(args) {
  run('docker', ['compose', '--project-name', 'ysbk-local', '--file', resolve(root, 'compose.local.yml'), '--env-file', resolve(local, 'docker.env'), ...args]);
}

function jwt(s, role) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role, iss: 'supabase-local', aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const signature = createHmac('sha256', s.authJwtSecret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

function configure(s) {
  writeFileSync(resolve(local, 'docker.env'), `POSTGRES_PASSWORD=${s.postgresPassword}\nAUTH_DB_PASSWORD=${s.authDatabasePassword}\nAUTH_JWT_SECRET=${s.authJwtSecret}\n`, { mode: 0o600 });
  writeFileSync(resolve(local, 'init.sql'), `CREATE ROLE ysbk_auth_admin LOGIN PASSWORD '${s.authDatabasePassword}';
CREATE DATABASE ysbk_auth OWNER ysbk_auth_admin;
ALTER ROLE ysbk_auth_admin SET search_path = auth, public;
CREATE DATABASE ysbk_test_local;
\\connect ysbk_auth
CREATE SCHEMA auth AUTHORIZATION ysbk_auth_admin;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`, { mode: 0o600 });
  const config = readJson(resolve(root, 'wrangler.local.json'));
  config.main = resolve(root, config.main);
  config.assets.directory = resolve(root, config.assets.directory);
  writeJson(workerConfigPath, config);
  const env = { DATABASE_URL: databaseUrl(s, 'ysbk_app'), SUPABASE_URL: 'http://127.0.0.1:55321', SUPABASE_ANON_KEY: jwt(s, 'anon'),
    JWT_SECRET: s.appJwtSecret, RESERVATION_IP_SECRET: s.ipSecret, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', TURNSTILE_EXPECTED_HOSTNAME: 'localhost' };
  writeFileSync(resolve(local, '.dev.vars'), Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
}

async function prepareDatabase(s) {
  const pool = new pg.Pool({ connectionString: databaseUrl(s), max: 1 });
  try {
    if ((await pool.query('SELECT current_database() AS name')).rows[0].name !== 'ysbk_local') throw new Error('Local database identity mismatch');
    const { schema, access } = prepareBetaSql();
    const hash = createHash('sha256').update(schema).digest('hex');
    const exists = (await pool.query("SELECT to_regclass('public.book_titles') AS relation")).rows[0].relation;
    if (!exists) {
      console.log('Khởi tạo schema và dữ liệu local lần đầu...');
      await pool.query(schema);
      await pool.query(readFileSync(resolve(root, 'docker/local/seed.sql'), 'utf8'));
      s.schemaHash = hash;
      writeJson(settingsPath, s);
    } else if (s.schemaHash !== hash) {
      throw new Error('Schema local có sẵn nhưng khác phiên bản. Không reset tự động; cần kiểm tra migration trước.');
    }
    await pool.query(access);
    const sql = (await pool.query("SELECT format('ALTER ROLE ysbk_app WITH LOGIN PASSWORD %L', $1::text) AS sql", [s.appDatabasePassword])).rows[0].sql;
    await pool.query(sql);
    if (!existsSync(accountsPath)) writeJson(accountsPath, [
      { username: 'admin', password: randomBytes(14).toString('base64url') + '!Aa9', fullName: 'Quản trị local', isAdmin: true },
      { username: 'thanhvien', password: randomBytes(14).toString('base64url') + '!Aa9', fullName: 'Thành viên local', isAdmin: false },
    ]);
    const accounts = readJson(accountsPath);
    const headers = { Authorization: `Bearer ${jwt(s, 'service_role')}`, 'Content-Type': 'application/json' };
    const usersResponse = await fetch(`${auth}/admin/users?page=1&per_page=50`, { headers, signal: AbortSignal.timeout(15000) });
    if (!usersResponse.ok) throw new Error(`Local Auth admin list failed: ${usersResponse.status}`);
    const users = (await usersResponse.json()).users;
    for (const account of accounts) {
      const email = `${account.username}@internal.ysbk.edu.vn`;
      let user = users.find(user => user.email === email);
      if (!user) {
        const response = await fetch(`${auth}/admin/users`, { method: 'POST', headers, body: JSON.stringify({ email, password: account.password, email_confirm: true }), signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Create local Auth user failed: ${response.status}`);
        user = await response.json();
      }
      let member = (await pool.query('SELECT id FROM members WHERE username = $1', [account.username])).rows[0];
      if (!member) member = (await pool.query(`INSERT INTO members (full_name, username, gen, team, role_title, school_year, phone, is_admin, is_active, is_eligible_main_duty)
        VALUES ($1,$2,'LOCAL','BAN_CHU_NHIEM','Kiểm thử','LOCAL',$3,$4,true,true) RETURNING id`, [account.fullName, account.username, account.isAdmin ? '0900000001' : '0900000002', account.isAdmin])).rows[0];
      const identity = (await pool.query('SELECT provider_subject FROM internal_identities WHERE member_id = $1', [member.id])).rows[0];
      if (identity && identity.provider_subject !== user.id) throw new Error('Local identity mapping changed; refusing to overwrite.');
      if (!identity) await pool.query('INSERT INTO internal_identities (member_id, username, normalized_username, provider_subject) VALUES ($1,$2,$2,$3)', [member.id, account.username, user.id]);
    }
  } finally { await pool.end(); }
}

function ownedWorker() {
  if (!existsSync(workerPidPath)) return null;
  const pid = Number(readFileSync(workerPidPath, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Invalid local worker PID');
  try { process.kill(pid, 0); } catch { return null; }
  let command;
  if (process.platform === 'win32') {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('Cannot verify local worker process');
    command = result.stdout;
  } else command = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
  if (!command.toLowerCase().includes(workerConfigPath.toLowerCase()) || !command.includes('wrangler')) throw new Error('PID belongs to another process; will not stop or reuse it.');
  return pid;
}

async function waitReady(path, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    try { const response = await fetch(`${web}${path}`, { signal: AbortSignal.timeout(2000) }); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Local web chưa sẵn sàng: ${path}. Xem .local/ysbk/worker.log`);
}

async function up() {
  const s = settings(true);
  configure(s);
  compose(['up', '-d', '--wait', '--wait-timeout', '120']);
  await prepareDatabase(s);
  console.log('Build giao diện local với Turnstile test key...');
  run(process.execPath, [resolve(root, 'node_modules/astro/bin/astro.mjs'), 'build', '--mode', 'beta'], { env: { ...process.env,
    PUBLIC_ENV: 'staging', PUBLIC_DEMO_CONTENT: 'false', PUBLIC_LOCAL_TESTING: 'true', PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' } });
  if (!ownedWorker()) {
    await new Promise((done, reject) => { const server = net.createServer(); server.once('error', () => reject(new Error('Port 4321 đang được sử dụng; không tự chuyển cổng.'))); server.listen(4321, '127.0.0.1', () => server.close(done)); });
    const log = openSync(resolve(local, 'worker.log'), 'a');
    const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', workerConfigPath, '--local', '--show-interactive-dev-session=false'],
      { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
    writeFileSync(workerPidPath, String(child.pid));
    closeSync(log);
    child.unref();
  }
  await waitReady('/health/ready');
  console.log(`Local chạy tại http://localhost:4321\nTài khoản: ${accountsPath}\nDữ liệu được giữ trong Docker volume; local:test dùng database khác.`);
}

async function stop() {
  settings();
  const pid = ownedWorker();
  if (pid) {
    if (process.platform === 'win32') run('taskkill', ['/PID', String(pid), '/T', '/F']);
    else process.kill(-pid, 'SIGTERM');
  }
  if (existsSync(workerPidPath)) unlinkSync(workerPidPath);
  compose(['stop']);
  console.log('Đã dừng local; giữ container và volume dữ liệu.');
}

async function main() {
  const command = process.argv[2] || 'up';
  if (command === 'up') return up();
  if (command === 'stop') return stop();
  if (command === 'status') {
    settings(); compose(['ps']);
    console.log(ownedWorker() ? 'Web process: running (port 4321)' : 'Web process: stopped');
    return;
  }
  if (command === 'expire') {
    settings();
    const response = await fetch(`${web}/cdn-cgi/local/explorer/api/local/scheduled?worker=ysbk-local`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cron: '*/10 * * * *' }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || (await response.json()).result?.outcome !== 'ok') throw new Error('Local scheduled handler failed.');
    console.log('Đã chạy handler hết hạn local theo thời gian hiện tại.');
    return;
  }
  if (command === 'test-db') {
    const s = settings();
    const pkg = readJson(resolve(root, 'package.json'));
    const testUrl = databaseUrl(s, 'postgres', s.testDatabaseName);
    run(process.execPath, pkg.scripts['test:db'].split(' ').slice(1), { env: { ...process.env, TEST_DATABASE_URL: testUrl, DATABASE_URL: testUrl } });
    return;
  }
  throw new Error('Dùng up, stop, status, expire hoặc test-db. Không có lệnh reset/xóa volume tự động.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
