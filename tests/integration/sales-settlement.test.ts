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

  // Áp dụng migration 10 cho sales & consignment
  const mig10Path = path.resolve('docs/technical/schema/migrations/10_stage18_book_sales_consignment.sql');
  if (fs.existsSync(mig10Path)) {
    const mig10Sql = fs.readFileSync(mig10Path, 'utf8');
    await harness.getPool().query(mig10Sql);
  }
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

test('G-sales-schema: Tables book_suppliers, consignment_lots, items, sales, returns, settlements, payments created with constraints', async () => {
  const pool = harness.getPool();

  // 1. Kiểm tra tồn tại các bảng Chặng 18
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'book_suppliers',
       'consignment_lots',
       'consignment_lot_items',
       'book_sales',
       'consignment_returns',
       'consignment_settlements',
       'supplier_payments'
     )`
  );
  assert.strictEqual(tableRes.rows.length, 7, 'Cả 7 bảng bán sách & ký gửi Chặng 18 phải tồn tại');

  // 2. Thêm nhà sách mẫu
  const supRes = await pool.query(
    `INSERT INTO book_suppliers (code, name)
     VALUES ('SUP_TEST_01', 'Nhà sách Test')
     RETURNING id`
  );
  const supId = supRes.rows[0].id;

  // 3. Thử insert trùng code -> phải vi phạm UNIQUE
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO book_suppliers (code, name) VALUES ('SUP_TEST_01', 'Nhà sách Trùng')`
      );
    },
    (err: any) => {
      assert(err.message.includes('unique') || err.message.includes('duplicate'));
      return true;
    }
  );

  // 4. Thêm lô sách mẫu
  const memberRes = await pool.query(`SELECT id FROM members LIMIT 1;`);
  const memberId = memberRes.rows[0].id;

  const lotRes = await pool.query(
    `INSERT INTO consignment_lots (batch_code, supplier_id, campaign_name, received_date, deposit_amount, created_by)
     VALUES ('LOT_TEST_01', $1, 'Chiến dịch Test', '2026-10-19', 1000000, $2)
     RETURNING id`,
    [supId, memberId]
  );
  const lotId = lotRes.rows[0].id;

  // 5. Thêm dòng sách với ràng buộc bảo toàn số lượng
  const itemRes = await pool.query(
    `INSERT INTO consignment_lot_items (
       lot_id, book_title, cover_price, import_discount_percent, import_price,
       retail_price, initial_quantity, sold_quantity, returned_quantity, retained_quantity, available_quantity
     ) VALUES ($1, 'Sách Test Invariant', 80000, 18.75, 65000, 80000, 100, 0, 0, 0, 100)
     RETURNING id`,
    [lotId]
  );
  const itemId = itemRes.rows[0].id;

  // 6. Thử vi phạm ràng buộc bảo toàn số lượng (initial != sold + returned + retained + available)
  await assert.rejects(
    async () => {
      await pool.query(
        `UPDATE consignment_lot_items
         SET available_quantity = 50
         WHERE id = $1`,
        [itemId]
      );
    },
    (err: any) => {
      assert(err.message.includes('chk_lot_item_quantity_conservation') || err.message.includes('check'));
      return true;
    }
  );
});
