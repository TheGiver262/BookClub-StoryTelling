import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';

let harness: DbHarness;

before(async () => {
  harness = new DbHarness();
  await harness.resetSchema();
  await harness.applyDDL();
  await harness.applySeed();
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-reports-schema: Tables journal_entries and system_audit_logs queryable for financial reports', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại các bảng báo cáo và nhật ký kiểm toán
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'journal_entries',
       'system_audit_logs'
     )`
  );
  assert.strictEqual(tableRes.rows.length, 2, 'Cả 2 bảng journal_entries và system_audit_logs phải tồn tại');

  // 2. Thử nghiệm truy vấn tổng hợp báo cáo tài chính
  const sumRes = await pool.query(
    `SELECT fund_id, debit_account, credit_account, amount, created_at
     FROM journal_entries
     WHERE created_at >= NOW() - INTERVAL '30 days'`
  );
  assert.ok(Array.isArray(sumRes.rows));

  // 3. Thử nghiệm thêm và truy vấn system_audit_logs
  const auditRes = await pool.query(
    `INSERT INTO system_audit_logs (action, target_resource, target_id, details)
     VALUES ('TEST_ACTION', 'REPORT', 'test-01', '{"notes": "Test audit log"}'::jsonb)
     RETURNING id, action, details`
  );
  assert.strictEqual(auditRes.rows[0].action, 'TEST_ACTION');
  assert.strictEqual(auditRes.rows[0].details.notes, 'Test audit log');
});
