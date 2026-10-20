import test, { before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DbHarness } from './db-harness.ts';

let harness: DbHarness;

before(async () => {
  harness = new DbHarness();
  await harness.resetSchema();
  await harness.applyDDL();
  await harness.applySeed();

  // Áp dụng migration 08 & 09 cho recruitment
  const mig08Path = path.resolve('docs/technical/schema/migrations/08_stage16_recruitment_sync.sql');
  if (fs.existsSync(mig08Path)) {
    const mig08Sql = fs.readFileSync(mig08Path, 'utf8');
    await harness.getPool().query(mig08Sql);
  }

  const mig09Path = path.resolve('docs/technical/schema/migrations/09_stage17_evaluation_decisions.sql');
  if (fs.existsSync(mig09Path)) {
    const mig09Sql = fs.readFileSync(mig09Path, 'utf8');
    await harness.getPool().query(mig09Sql);
  }
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-evaluation-schema: Tables recruitment_rubrics, criteria, history, decisions created with constraints', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại các bảng Chặng 17
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'recruitment_rubrics',
       'recruitment_rubric_criteria',
       'recruitment_interviews',
       'recruitment_evaluation_history',
       'recruitment_decisions',
       'recruitment_public_announcements'
     )`
  );
  assert.strictEqual(tableRes.rows.length, 6, 'Cả 6 bảng tuyển dụng Chặng 17 phải tồn tại');

  // 2. Thêm rubric mẫu
  const rubricId = `RUBRIC_TEST_${Date.now()}`;
  await pool.query(
    `INSERT INTO recruitment_rubrics (id, campaign_id, version, title, formula_type)
     VALUES ($1, 'CAMPAIGN_TEST', 1, 'Rubric Test V1', 'WEIGHTED_SUM')`,
    [rubricId]
  );

  // 3. Thử insert trùng (campaign_id, version) -> phải vi phạm UNIQUE
  await assert.rejects(
    pool.query(
      `INSERT INTO recruitment_rubrics (id, campaign_id, version, title, formula_type)
       VALUES ($1, 'CAMPAIGN_TEST', 1, 'Rubric Duplicate', 'WEIGHTED_SUM')`,
      [`RUB_DUP_${Date.now()}`]
    ),
    /unique/i
  );
});
