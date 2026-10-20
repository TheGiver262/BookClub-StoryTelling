import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import { manualEditSchedule } from '../../src/server/duty/roster-service.ts';
import { withTransaction } from '../../src/server/db/client.ts';

let harness: DbHarness;

before(async () => {
  harness = new DbHarness();
  await harness.resetSchema();
  await harness.applyDDL();
  await harness.applySeed();

  await harness.applyMigrations();
});

test('PG-roster: manual assignment supports real UUID member identifiers', async () => {
  const pool = harness.getPool();
  const member = (await pool.query('SELECT id FROM members WHERE is_active AND NOT is_alumni LIMIT 1')).rows[0].id;
  const scheduleId = 'sched-real-member-regression';
  await pool.query("INSERT INTO duty_schedules (id, term_semester, schedule_date, day_of_week) VALUES ($1, '2026.1', '2026-10-20', 'THU_BA')", [scheduleId]);
  const schedule = await withTransaction(pool, tx => manualEditSchedule(tx, scheduleId, {
    assignees: [{ memberId: member, dutyType: 'SUPPORT', assignedRole: 'LOGISTICS_SETUP' }],
  }, member));
  assert.equal(schedule.assignees.length, 1);
  assert.equal(schedule.assignees[0].memberId, member);
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-roster-schema: Tables duty_schedules and duty_schedule_assignees created with valid constraints', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại bảng
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN ('duty_schedules', 'duty_schedule_assignees')`
  );
  assert.strictEqual(tableRes.rows.length, 2, 'Cả 2 bảng duty_schedules và duty_schedule_assignees phải tồn tại');

  // 2. Lấy 1 member hợp lệ từ seed
  const memberRes = await pool.query(`SELECT id FROM members LIMIT 1`);
  assert.ok(memberRes.rows.length > 0, 'Phải có member mẫu trong seed');
  const memberId = memberRes.rows[0].id;

  // 3. Thêm 1 ca trực mẫu hợp lệ
  const schedId = `sched-test-${Date.now()}`;
  await pool.query(
    `INSERT INTO duty_schedules (id, term_semester, schedule_date, day_of_week, status, version)
     VALUES ($1, '2026.1', '2026-10-20', 'THU_BA', 'DRAFT', 1)`,
    [schedId]
  );

  // 4. Thêm phân công hợp lệ
  await pool.query(
    `INSERT INTO duty_schedule_assignees (id, schedule_id, member_id, duty_type, assigned_role)
     VALUES ($1, $2, $3, 'MAIN', 'CASH_DRAWER')`,
    [`dsa-${Date.now()}`, schedId, memberId]
  );

  // 5. Kiểm tra ràng buộc check day_of_week (từ chối ngày không phải THU_BA / THU_NAM)
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO duty_schedules (id, term_semester, schedule_date, day_of_week, status, version)
         VALUES ($1, '2026.1', '2026-10-21', 'THU_TU', 'DRAFT', 1)`,
        [`sched-invalid-day-${Date.now()}`]
      );
    },
    /check constraint/i,
    'Phải từ chối day_of_week không thuộc THU_BA hoặc THU_NAM'
  );

  // 6. Kiểm tra ràng buộc duy nhất (schedule_id, member_id)
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO duty_schedule_assignees (id, schedule_id, member_id, duty_type, assigned_role)
         VALUES ($1, $2, $3, 'SUPPORT', 'LOGISTICS_SETUP')`,
        [`dsa-dup-${Date.now()}`, schedId, memberId]
      );
    },
    /unique/i,
    'Phải từ chối xếp 1 thành viên 2 lần trong cùng 1 ca trực'
  );
});
