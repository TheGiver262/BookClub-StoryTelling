import pg from 'pg';
import type { Pool, Client } from 'pg';
const { Pool: PgPool, Client: PgClient } = pg;
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ValidatedTestDbConfig {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  sanitizedUri: string;
}

/**
 * Validates TEST_DATABASE_URL with fail-closed safety guards (S02-01 fix):
 * - Must be present and non-empty
 * - Rejects any query parameters (?host=..., ?port=..., ?sslmode=...) to prevent driver parameter pollution
 * - Rejects any URL fragments/hash
 * - Host must strictly be local (localhost, 127.0.0.1, ::1, or test-postgres)
 * - Normalizes IPv6 bracketed host syntax ([::1] -> ::1)
 * - Validates port (1..65535)
 * - Database name must strictly follow disposable test naming convention: must start with 'ysbk_test_'
 * - Explicitly rejects default/system databases (postgres, template0, template1, ysbk, ysbk_prod, etc.)
 * - Returns discrete validated parameters for driver instantiation (never passes raw unverified URI to driver)
 * - Redacts passwords in all sanitized outputs
 */
export function validateTestDatabaseUrl(rawUrl?: string): ValidatedTestDbConfig {
  const urlString = rawUrl || process.env.TEST_DATABASE_URL;

  if (!urlString || urlString.trim() === '') {
    throw new Error(
      '[BLOCKED: DB_RUNTIME_MISSING] Biến môi trường TEST_DATABASE_URL chưa được thiết lập.\n' +
      'Để chạy integration test với PostgreSQL local, hãy khởi động PostgreSQL và đặt biến môi trường:\n' +
      '  $env:TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/ysbk_test_stage02"\n' +
      '  pnpm run test:db'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('[BLOCKED: INVALID_URL] TEST_DATABASE_URL không đúng định dạng URI.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`[BLOCKED: INVALID_PROTOCOL] Giao thức phải là postgresql: hoặc postgres: (nhận được: ${parsed.protocol})`);
  }

  // S02-01: Disallow query parameters to prevent driver override bypass (e.g. ?host=example.invalid)
  if (parsed.search && parsed.search !== '') {
    throw new Error(
      '[BLOCKED: QUERY_PARAMS_FORBIDDEN] TEST_DATABASE_URL không được chứa query parameters (?host, ?port, v.v.). ' +
      'Tất cả thông số phải nằm ở authority và pathname của URL.'
    );
  }

  // Disallow URL hash
  if (parsed.hash && parsed.hash !== '') {
    throw new Error('[BLOCKED: HASH_FORBIDDEN] TEST_DATABASE_URL không được chứa hash/fragment.');
  }

  // S02-01: Normalize IPv6 bracketed notation e.g. [::1] -> ::1
  const cleanHost = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', 'test-postgres']);
  if (!allowedHosts.has(cleanHost)) {
    throw new Error(
      `[BLOCKED: UNSAFE_HOST] Chỉ cho phép kết nối tới host local/disposable (${Array.from(allowedHosts).join(', ')}). ` +
      `Host nhận được: ${cleanHost}. Tuyệt đối không kết nối database cloud hoặc remote.`
    );
  }

  // Validate port
  const effectivePort = parsed.port ? parseInt(parsed.port, 10) : 5432;
  if (isNaN(effectivePort) || effectivePort <= 0 || effectivePort > 65535) {
    throw new Error(`[BLOCKED: INVALID_PORT] Port '${parsed.port}' không hợp lệ (phải trong khoảng 1..65535).`);
  }

  // S02-01: Database name validation with strict prefix 'ysbk_test_'
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
  if (!dbName || !dbName.startsWith('ysbk_test_')) {
    throw new Error(
      `[BLOCKED: UNSAFE_DATABASE_NAME] Tên database phải bắt đầu bằng 'ysbk_test_' (ví dụ: ysbk_test_stage02). ` +
      `Tên nhận được: '${dbName}'. Tuyệt đối không thao tác trên database mặc định hoặc database người dùng.`
    );
  }

  const forbiddenNames = new Set(['postgres', 'template0', 'template1', 'ysbk', 'ysbk_prod', 'ysbk_production']);
  if (forbiddenNames.has(dbName.toLowerCase())) {
    throw new Error(`[BLOCKED: FORBIDDEN_DATABASE] Database '${dbName}' thuộc danh sách cấm reset.`);
  }

  const user = parsed.username ? decodeURIComponent(parsed.username) : undefined;
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  const sanitizedUri = `postgresql://${user ? user + ':***@' : ''}${cleanHost}:${effectivePort}/${dbName}`;

  return {
    host: cleanHost,
    port: effectivePort,
    database: dbName,
    user,
    password,
    sanitizedUri,
  };
}

export class DbHarness {
  private config: ValidatedTestDbConfig;
  private pool: Pool | null = null;
  private projectRoot: string;

  constructor(customUrl?: string) {
    this.config = validateTestDatabaseUrl(customUrl);
    this.projectRoot = path.resolve(process.cwd());
  }

  public getConfig(): ValidatedTestDbConfig {
    return this.config;
  }

  public getPool(): Pool {
    if (!this.pool) {
      // S02-01: Always pass validated discrete parameters, never raw unverified connectionString
      this.pool = new PgPool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: 10,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000,
      });
    }
    return this.pool;
  }

  public async createIsolatedClient(): Promise<Client> {
    // S02-01: Always pass validated discrete parameters to isolated client
    const client = new PgClient({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    return client;
  }

  public async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = await this.createIsolatedClient();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  public async resetSchema(): Promise<void> {
    const pool = this.getPool();

    // S02-01: Cross-verify current_database() on the live server before executing DROP SCHEMA
    const dbCheck = await pool.query('SELECT current_database() AS cur_db');
    const actualDb = dbCheck.rows[0]?.cur_db;
    if (!actualDb || !actualDb.startsWith('ysbk_test_') || actualDb !== this.config.database) {
      throw new Error(
        `[BLOCKED: SAFETY_ABORT] Tên database thực tế '${actualDb}' không khớp với database test được phép '${this.config.database}'. ` +
        'Hủy bỏ reset schema để bảo vệ dữ liệu.'
      );
    }

    // Drop all objects in public schema safely
    await pool.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO CURRENT_USER;
      GRANT ALL ON SCHEMA public TO public;
    `);
  }

  public async applyDDL(): Promise<void> {
    const schemaFile = path.join(this.projectRoot, 'docs', 'technical', 'schema', '01_schema.sql');
    if (!fs.existsSync(schemaFile)) {
      throw new Error(`Không tìm thấy file DDL: ${schemaFile}`);
    }
    const ddlContent = fs.readFileSync(schemaFile, 'utf8');
    const pool = this.getPool();
    await pool.query(ddlContent);
  }

  public async applySeed(): Promise<void> {
    const seedFile = path.join(this.projectRoot, 'docs', 'technical', 'schema', '02_seed.sql');
    if (!fs.existsSync(seedFile)) {
      throw new Error(`Không tìm thấy file Seed: ${seedFile}`);
    }
    const seedContent = fs.readFileSync(seedFile, 'utf8');
    const pool = this.getPool();
    await pool.query(seedContent);
  }

  public async applyMigrations(): Promise<void> {
    const migrationsDir = path.join(this.projectRoot, 'docs', 'technical', 'schema', 'migrations');
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const pool = this.getPool();
    for (const f of files) {
      const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      await pool.query(content);
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
