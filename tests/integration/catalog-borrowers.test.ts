import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import {
  createBookCopy,
  searchBooks,
} from '../../src/server/catalog/service.ts';
import {
  createBorrower,
} from '../../src/server/borrowers/service.ts';

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

test('G-catalog/PG 1: PostgreSQL unaccent Vietnamese search and non-cartesian author/category join', async () => {
  await harness.withClient(async (client: Client) => {
    // 1. Tạo title có 2 tác giả và 2 thể loại
    const titleRes = await client.query(
      `INSERT INTO book_titles (title, original_title, description)
       VALUES ('Giải Tích Nâng Cao', 'Advanced Calculus', 'Giáo trình toán chuyên sâu')
       RETURNING id`
    );
    const titleId = titleRes.rows[0].id;

    // Authors
    const a1 = await client.query(`INSERT INTO authors (name) VALUES ('Nguyễn Đình Trí') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    const a2 = await client.query(`INSERT INTO authors (name) VALUES ('Tạ Duy Phượng') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    await client.query(`INSERT INTO book_title_authors (title_id, author_id) VALUES ($1, $2), ($1, $3)`, [titleId, a1.rows[0].id, a2.rows[0].id]);

    // Categories
    const c1 = await client.query(`INSERT INTO categories (name) VALUES ('Toán học') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    const c2 = await client.query(`INSERT INTO categories (name) VALUES ('Giáo trình Bách Khoa') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    await client.query(`INSERT INTO book_title_categories (title_id, category_id) VALUES ($1, $2), ($1, $3)`, [titleId, c1.rows[0].id, c2.rows[0].id]);

    // 2. Tìm kiếm tiếng Việt không dấu "giai tich"
    const searchRes = await searchBooks(client, { query: 'giai tich' });
    const match = searchRes.items.find((b) => b.id === titleId);
    assert.ok(match, 'Tìm kiếm tiếng Việt không dấu phải khớp với tiêu đề có dấu');
    assert.strictEqual(match.authors.length, 2);
    assert.strictEqual(match.categories.length, 2);
    // Invariant: Join nhiều tác giả và thể loại không làm nhân đôi số dòng sách
    assert.strictEqual(searchRes.items.filter((b) => b.id === titleId).length, 1);
  });
});

test('G-catalog/PG 2: PostgreSQL physical copies with distinct prices, locations, and unique barcode', async () => {
  await harness.withClient(async (client: Client) => {
    const titleRes = await client.query(
      `INSERT INTO book_titles (title) VALUES ('Xác Suất Thống Kê') RETURNING id`
    );
    const titleId = titleRes.rows[0].id;

    const edRes = await client.query(
      `INSERT INTO book_editions (title_id, publisher, publish_year)
       VALUES ($1, 'NXB Bách Khoa', 2023) RETURNING id`,
      [titleId]
    );
    const editionId = edRes.rows[0].id;

    const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
    const adminId = memberRes.rows[0].id;

    // Bản 1: 74,000 VND -> cọc 50,000 VND tại KHO_THU_VIEN
    const copy1 = await createBookCopy(
      client,
      {
        editionId,
        barcode: 'YSBK-PG-XSTK-01',
        location: 'KHO_THU_VIEN',
        coverPrice: 74000,
      },
      adminId
    );
    assert.strictEqual(copy1.coverPrice, 74000);
    assert.strictEqual(copy1.calculatedDeposit, 50000);

    // Bản 2: 230,000 VND -> cọc 250,000 VND tại KHO_HOI_SINH_VIEN
    const copy2 = await createBookCopy(
      client,
      {
        editionId,
        barcode: 'YSBK-PG-XSTK-02',
        location: 'KHO_HOI_SINH_VIEN',
        coverPrice: 230000,
      },
      adminId
    );
    assert.strictEqual(copy2.coverPrice, 230000);
    assert.strictEqual(copy2.calculatedDeposit, 250000);

    // DB Constraint: Giá bìa âm bị CHECK (cover_price IS NULL OR cover_price >= 0) từ chối
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO book_copies (edition_id, barcode, cover_price)
           VALUES ($1, 'YSBK-PG-FAIL-PRICE', -100)`,
          [editionId]
        ),
      /check constraint/i
    );

    // DB Constraint: Trùng mã vạch barcode bị UNIQUE từ chối
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO book_copies (edition_id, barcode, cover_price)
           VALUES ($1, 'YSBK-PG-XSTK-01', 50000)`,
          [editionId]
        ),
      /duplicate key value violates unique constraint/i
    );
  });
});

test('G-borrower/PG 1: PostgreSQL community borrower without student_id or school (NULL allowed)', async () => {
  await harness.withClient(async (client: Client) => {
    const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
    const adminId = memberRes.rows[0].id;

    const b = await createBorrower(
      client,
      {
        fullName: 'Bác Lê Văn Dân',
        phone: '0977112233',
        studentId: null,
        school: null,
        notes: 'Cư dân phường Bách Khoa',
      },
      adminId
    );

    assert.ok(b.id);
    assert.strictEqual(b.fullName, 'Bác Lê Văn Dân');
    assert.strictEqual(b.studentId, null);
    assert.strictEqual(b.school, null);

    const queryRes = await client.query('SELECT student_id, school FROM borrowers WHERE id = $1', [b.id]);
    assert.strictEqual(queryRes.rows[0].student_id, null);
    assert.strictEqual(queryRes.rows[0].school, null);
  });
});

test('G-borrower/PG 2: PostgreSQL shared phone number across distinct borrowers (No UNIQUE constraint)', async () => {
  await harness.withClient(async (client: Client) => {
    const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
    const adminId = memberRes.rows[0].id;

    const b1 = await createBorrower(
      client,
      {
        fullName: 'Nguyễn Văn Anh',
        phone: '0988776655',
      },
      adminId
    );

    const b2 = await createBorrower(
      client,
      {
        fullName: 'Nguyễn Văn Em',
        phone: '0988776655', // Cùng số điện thoại
      },
      adminId
    );

    assert.notStrictEqual(b1.id, b2.id);
    const countRes = await client.query('SELECT COUNT(*) AS total FROM borrowers WHERE phone = $1', ['0988776655']);
    assert.strictEqual(Number(countRes.rows[0].total), 2);
  });
});
