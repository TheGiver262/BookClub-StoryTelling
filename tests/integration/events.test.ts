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

  // Áp dụng migration 11 cho events & activities
  const mig11Path = path.resolve('docs/technical/schema/migrations/11_stage19_events_activities.sql');
  if (fs.existsSync(mig11Path)) {
    const mig11Sql = fs.readFileSync(mig11Path, 'utf8');
    await harness.getPool().query(mig11Sql);
  }
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-events-schema: Tables activities, activity_tasks, task_history, participants, budget_items, expenses created with constraints', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại các bảng Chặng 19
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'activities',
       'activity_tasks',
       'activity_task_history',
       'activity_participants',
       'activity_budget_items',
       'activity_expenses'
     )`
  );
  assert.strictEqual(tableRes.rows.length, 6, 'Cả 6 bảng hoạt động, sự kiện và nhiệm vụ Chặng 19 phải tồn tại');

  // 2. Thử nghiệm thêm người tham gia loại GUEST không cần MSSV (R07)
  const actRes = await pool.query(
    `INSERT INTO activities (title, event_date, created_by)
     VALUES ('Hội Thảo Đọc Sách', '2026-11-20', '00000000-0000-0000-0000-000000000001')
     RETURNING id`
  );
  const actId = actRes.rows[0].id;

  const partRes = await pool.query(
    `INSERT INTO activity_participants (activity_id, participant_type, guest_name, role)
     VALUES ($1, 'GUEST', 'Khách Ngoài Test', 'ATTENDEE')
     RETURNING id, participant_type, guest_name`,
    [actId]
  );
  assert.strictEqual(partRes.rows[0].guest_name, 'Khách Ngoài Test');
  assert.strictEqual(partRes.rows[0].participant_type, 'GUEST');

  // 3. Vi phạm ràng buộc chk_participant_identity: GUEST nhưng không có guest_name
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO activity_participants (activity_id, participant_type, guest_name)
         VALUES ($1, 'GUEST', NULL)`,
        [actId]
      );
    },
    /chk_participant_identity/
  );
});
