import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { DbHarness, validateTestDatabaseUrl } from './db-harness.ts';

let harness: DbHarness | null = null;
let dbAvailable = false;

before(async () => {
  try {
    validateTestDatabaseUrl();
    harness = new DbHarness();
    await harness.resetSchema();
    await harness.applyDDL();
    await harness.applySeed();
    await harness.applyMigrations();
    dbAvailable = true;
  } catch (err: any) {
    if (err?.message?.includes('DB_RUNTIME_MISSING')) {
      dbAvailable = false;
      return;
    }
    throw err;
  }
});

after(async () => {
  if (harness) {
    await harness.close();
    harness = null;
  }
});

test('PR-1 Schema: validateTestDatabaseUrl fails closed when TEST_DATABASE_URL is missing', () => {
  const oldUrl = process.env.TEST_DATABASE_URL;
  try {
    delete process.env.TEST_DATABASE_URL;
    assert.throws(
      () => validateTestDatabaseUrl(),
      /\[BLOCKED: DB_RUNTIME_MISSING\]/
    );
  } finally {
    if (oldUrl) process.env.TEST_DATABASE_URL = oldUrl;
  }
});

test('PR-1 Schema: Reservations tables and unique active hold constraint', async (t) => {
  if (!dbAvailable || !harness) {
    t.skip('Skipped: PostgreSQL live daemon unavailable ([BLOCKED: DB_RUNTIME_MISSING])');
    return;
  }

  const pool = harness.getPool();

  // 1. Kiểm tra sự tồn tại của 2 bảng mới
  const tablesRes = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('reservations', 'reservation_quota_locks')"
  );
  const foundTables = tablesRes.rows.map((r: any) => r.table_name);
  assert.ok(foundTables.includes('reservations'), 'Bảng reservations phải tồn tại');
  assert.ok(foundTables.includes('reservation_quota_locks'), 'Bảng reservation_quota_locks phải tồn tại');

  // 2. Kiểm tra chỉ mục unique active hold (idx_unique_active_reservation_copy)
  const indexRes = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'reservations' AND indexname = 'idx_unique_active_reservation_copy'"
  );
  assert.equal(indexRes.rows.length, 1, 'Chỉ mục idx_unique_active_reservation_copy phải tồn tại');

  // 3. Kiểm tra ràng buộc duy nhất: Một bản sách chỉ được HELD tối đa 1 đơn
  const copyRes = await pool.query("SELECT id FROM book_copies WHERE status = 'AVAILABLE' LIMIT 1");
  const titleRes = await pool.query("SELECT id FROM book_titles LIMIT 1");
  const schedRes = await pool.query("SELECT id FROM duty_schedules LIMIT 1");

  if (copyRes.rows.length > 0 && titleRes.rows.length > 0 && schedRes.rows.length > 0) {
    const copyId = copyRes.rows[0].id;
    const titleId = titleRes.rows[0].id;
    const schedId = schedRes.rows[0].id;

    // Insert đơn 1: HELD -> Thành công
    await pool.query(
      `INSERT INTO reservations (
        code, title_id, copy_id, schedule_id, full_name, phone, ip_hash, token_hash,
        status, shift_date, shift_time, pickup_location, expires_at
      ) VALUES (
        'RSV-TEST-001', $1, $2, $3, 'Nguyen Van A', '0912345678', 'hash_ip_1', 'hash_tok_1',
        'HELD', CURRENT_DATE, '14:00 - 17:00', 'Bàn trực sảnh B', NOW() + INTERVAL '3 hours'
      )`,
      [titleId, copyId, schedId]
    );

    // Insert đơn 2: HELD trên CÙNG copy_id -> Phải ném lỗi vi phạm unique index!
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO reservations (
            code, title_id, copy_id, schedule_id, full_name, phone, ip_hash, token_hash,
            status, shift_date, shift_time, pickup_location, expires_at
          ) VALUES (
            'RSV-TEST-002', $1, $2, $3, 'Tran Thi B', '0987654321', 'hash_ip_2', 'hash_tok_2',
            'HELD', CURRENT_DATE, '14:00 - 17:00', 'Bàn trực sảnh B', NOW() + INTERVAL '3 hours'
          )`,
          [titleId, copyId, schedId]
        );
      },
      (err: any) => err.code === '23505' // PostgreSQL unique violation code
    );
  }
});
