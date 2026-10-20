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

  // Áp dụng migration 12 cho content & reviews
  const mig12Path = path.resolve('docs/technical/schema/migrations/12_stage20_public_content_seo.sql');
  if (fs.existsSync(mig12Path)) {
    const mig12Sql = fs.readFileSync(mig12Path, 'utf8');
    await harness.getPool().query(mig12Sql);
  }
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-content-schema: Tables book_reviews and public_posts created with constraints', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại các bảng Chặng 20
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'book_reviews',
       'public_posts'
     )`
  );
  assert.strictEqual(tableRes.rows.length, 2, 'Cả 2 bảng book_reviews và public_posts Chặng 20 phải tồn tại');

  // 2. Thử nghiệm thêm review sách
  const bookRes = await pool.query(`SELECT id FROM book_titles LIMIT 1`);
  const bookId = bookRes.rows[0].id;

  const revRes = await pool.query(
    `INSERT INTO book_reviews (book_id, author_name, rating, content, status)
     VALUES ($1, 'Bạn Đọc Thử Nghiệm', 5, 'Cuốn sách này rất tuyệt vời!', 'PENDING')
     RETURNING id, status, version`,
    [bookId]
  );
  assert.strictEqual(revRes.rows[0].status, 'PENDING');
  assert.strictEqual(revRes.rows[0].version, 1);
});
