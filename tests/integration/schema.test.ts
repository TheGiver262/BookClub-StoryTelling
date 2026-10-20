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

test('G-schema: Full DDL and Seed data apply cleanly without unaccent generated column error (R01)', async () => {
  const pool = harness.getPool();

  // 1. Verify extensions
  const extRes = await pool.query(
    "SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm')"
  );
  const extensions = extRes.rows.map((r: { extname: string }) => r.extname);
  assert.ok(extensions.includes('unaccent'), 'Extension unaccent must be installed');
  assert.ok(extensions.includes('pg_trgm'), 'Extension pg_trgm must be installed');

  // 2. Verify tables count (at least 24 tables)
  const tablesRes = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  const tables = tablesRes.rows.map((r: { table_name: string }) => r.table_name);
  assert.ok(tables.includes('book_titles'), 'Table book_titles must exist');
  assert.ok(tables.includes('loan_receipts'), 'Table loan_receipts must exist');
  assert.ok(tables.includes('loan_items'), 'Table loan_items must exist');
  assert.ok(tables.includes('funds'), 'Table funds must exist');
  assert.ok(tables.includes('journal_entries'), 'Table journal_entries must exist');
  assert.ok(tables.length >= 24, `Expected at least 24 tables, found ${tables.length}`);

  // 3. Verify seed data
  const seedBooks = await pool.query('SELECT COUNT(*) as count FROM book_titles');
  assert.ok(Number(seedBooks.rows[0].count) >= 2, 'Seed books must be present');
});

test('G-schema/search: Trigger-based search_vector handles INSERT, UPDATE, NULL description, and accented/unaccented queries', async () => {
  const pool = harness.getPool();

  // Test 1: INSERT book with accented title and description
  const insertRes = await pool.query(
    `INSERT INTO book_titles (title, description)
     VALUES ($1, $2)
     RETURNING id, title, description, search_vector`,
    ['Lập Trình Hướng Đối Tượng Nâng Cao', 'Giáo trình Bách Khoa về thiết kế mẫu và kiến trúc phần mềm']
  );
  const insertedBook = insertRes.rows[0];
  assert.ok(insertedBook.search_vector, 'search_vector must be populated upon INSERT');

  // Test 2: Search with accented query
  const searchAccented = await pool.query(
    `SELECT id, title FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1))`,
    ['Lập & Trình']
  );
  assert.ok(
    searchAccented.rows.some((r: { id: string }) => r.id === insertedBook.id),
    'Accented query must match book title'
  );

  // Test 3: Search with unaccented query
  const searchUnaccented = await pool.query(
    `SELECT id, title FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1))`,
    ['lap & trinh']
  );
  assert.ok(
    searchUnaccented.rows.some((r: { id: string }) => r.id === insertedBook.id),
    'Unaccented query must match book title'
  );

  // Test 4: Search query targeting description
  const searchDesc = await pool.query(
    `SELECT id, title FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1))`,
    ['giao & trinh']
  );
  assert.ok(
    searchDesc.rows.some((r: { id: string }) => r.id === insertedBook.id),
    'Query matching description keywords must match'
  );

  // Test 5: INSERT with NULL description must not fail and populate vector with title
  const nullDescRes = await pool.query(
    `INSERT INTO book_titles (title, description)
     VALUES ($1, NULL)
     RETURNING id, title, description, search_vector`,
    ['Sổ Tay Sinh Viên Đại Học Bách Khoa']
  );
  const nullDescBook = nullDescRes.rows[0];
  assert.ok(nullDescBook.search_vector, 'search_vector must be populated even when description is NULL');

  const searchNullDesc = await pool.query(
    `SELECT id, title FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1))`,
    ['sinh & vien']
  );
  assert.ok(
    searchNullDesc.rows.some((r: { id: string }) => r.id === nullDescBook.id),
    'Book with NULL description must match title query'
  );

  // Test 6: UPDATE title must re-calculate search_vector
  await pool.query(
    `UPDATE book_titles 
     SET title = $1 
     WHERE id = $2`,
    ['Kỹ Năng Đọc Sách Nhanh Siêu Tốc', nullDescBook.id]
  );

  const searchUpdated = await pool.query(
    `SELECT id, title FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1))`,
    ['sieu & toc']
  );
  assert.ok(
    searchUpdated.rows.some((r: { id: string }) => r.id === nullDescBook.id),
    'search_vector must reflect updated title'
  );

  // Test 7: Verify GIN index exists
  const indexRes = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes 
     WHERE tablename = 'book_titles' AND indexname = 'idx_book_titles_search_vector'`
  );
  assert.strictEqual(indexRes.rows.length, 1, 'GIN index idx_book_titles_search_vector must exist');
  assert.ok(indexRes.rows[0].indexdef.includes('USING gin (search_vector)'), 'Index must use GIN on search_vector');
});

test('G-schema/search regression: UPDATE description updates vector, NULL description retains title vector (S02-04)', async () => {
  const pool = harness.getPool();

  // Create book with initial title and description
  const res = await pool.query(
    `INSERT INTO book_titles (title, description)
     VALUES ($1, $2)
     RETURNING id`,
    ['Kinh Tế Học Hài Hước', 'Khảo sát kinh tế cổ điển ban đầu']
  );
  const bookId = res.rows[0].id;

  // 1. UPDATE description only
  await pool.query(
    `UPDATE book_titles 
     SET description = $1
     WHERE id = $2`,
    ['Một góc nhìn mới lạ và đột phá về hành vi con người', bookId]
  );

  // New description keywords must match
  const matchNew = await pool.query(
    `SELECT id FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1)) AND id = $2`,
    ['dot & pha', bookId]
  );
  assert.strictEqual(matchNew.rows.length, 1, 'New description keywords must match search');

  // Old description keywords must NOT match
  const matchOld = await pool.query(
    `SELECT id FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1)) AND id = $2`,
    ['co & dien', bookId]
  );
  assert.strictEqual(matchOld.rows.length, 0, 'Old description keywords must no longer match');

  // 2. Set description to NULL
  await pool.query(
    `UPDATE book_titles 
     SET description = NULL 
     WHERE id = $1`,
    [bookId]
  );

  // Title keywords must still match
  const matchTitle = await pool.query(
    `SELECT id FROM book_titles 
     WHERE search_vector @@ to_tsquery('simple', unaccent($1)) AND id = $2`,
    ['hai & huoc', bookId]
  );
  assert.strictEqual(matchTitle.rows.length, 1, 'Title keywords must still match when description is updated to NULL');
});

