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

  // Áp dụng migration 08 cho recruitment
  const migrationPath = path.resolve('docs/technical/schema/migrations/08_stage16_recruitment_sync.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await harness.getPool().query(migrationSql);
  }
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-recruitment-schema: Tables recruitment_forms, recruitment_form_responses, recruitment_evaluations created with constraints', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại các bảng
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'recruitment_forms',
       'recruitment_form_questions',
       'recruitment_form_responses',
       'recruitment_evaluations',
       'recruitment_reconciliation_checkpoints'
     )`
  );
  assert.strictEqual(tableRes.rows.length, 5, 'Cả 5 bảng recruitment phải tồn tại');

  // 2. Thêm form mẫu
  const formId = `FORM_TEST_${Date.now()}`;
  await pool.query(
    `INSERT INTO recruitment_forms (id, title, term_semester, is_active, version)
     VALUES ($1, 'Đơn Tuyển Test', '2026.1', true, 1)`,
    [formId]
  );

  // 3. Thêm response mẫu
  const respId = `RESP_TEST_${Date.now()}`;
  const responseId = `GOOGLE_RESP_${Date.now()}`;
  await pool.query(
    `INSERT INTO recruitment_form_responses (
       id, form_id, response_id, submission_timestamp, applicant_name, applicant_email, aspiration_1, raw_answers
     ) VALUES ($1, $2, $3, NOW(), 'Ứng Viên Test', 'test@example.com', 'BAN_HAU_CAN', '{}')`,
    [respId, formId, responseId]
  );

  // 4. Kiểm tra ràng buộc UNIQUE (form_id, response_id)
  await assert.rejects(
    pool.query(
      `INSERT INTO recruitment_form_responses (
         id, form_id, response_id, submission_timestamp, applicant_name, applicant_email, aspiration_1, raw_answers
       ) VALUES ($1, $2, $3, NOW(), 'Ứng Viên Trùng', 'duplicate@example.com', 'BAN_NOI_DUNG', '{}')`,
      [`DUP_${Date.now()}`, formId, responseId] // cùng response_id
    ),
    /unique/i
  );
});
