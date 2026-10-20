import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';

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

// Helper to create test loan receipt and copies
async function setupTestReceiptAndCopies(pool: any) {
  const borrowerRes = await pool.query('SELECT id FROM borrowers LIMIT 1');
  let borrowerId: string;
  if (borrowerRes.rows.length === 0) {
    const newBorrower = await pool.query(
      `INSERT INTO borrowers (full_name, phone, student_id, school)
       VALUES ('Nguyễn Văn Test', '0901234567', '20230001', 'ĐHBK')
       RETURNING id`
    );
    borrowerId = newBorrower.rows[0].id;
  } else {
    borrowerId = borrowerRes.rows[0].id;
  }

  const memberRes = await pool.query('SELECT id FROM members LIMIT 1');
  const memberId = memberRes.rows[0].id;

  const receiptRes = await pool.query(
    `INSERT INTO loan_receipts (receipt_number, borrower_id, borrow_date, due_date, created_by)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + 14, $3)
     RETURNING id`,
    [`YSBK-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`, borrowerId, memberId]
  );
  const receiptId = receiptRes.rows[0].id;

  // Create 4 distinct copies for testing
  const editionRes = await pool.query('SELECT id FROM book_editions LIMIT 1');
  const editionId = editionRes.rows[0].id;

  const copyIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const copyRes = await pool.query(
      `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
       VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 75000)
       RETURNING id`,
      [editionId, `TEST-BC-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`]
    );
    copyIds.push(copyRes.rows[0].id);
  }

  return { receiptId, borrowerId, memberId, copyIds };
}

test('G-invariant 1: Inserting 3rd item is rejected; bulk INSERT of 3 items rolls back completely', async () => {
  const pool = harness.getPool();
  const { receiptId, copyIds } = await setupTestReceiptAndCopies(pool);

  // Insert 2 items successfully
  await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)`,
    [receiptId, copyIds[0]]
  );
  await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)`,
    [receiptId, copyIds[1]]
  );

  // Attempt to insert 3rd item - must be rejected by trigger
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
         VALUES ($1, $2, 100000)`,
        [receiptId, copyIds[2]]
      );
    },
    /Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách/,
    'Trigger must reject 3rd book on the same receipt'
  );

  const countAfterReject = await pool.query(
    'SELECT COUNT(*) as count FROM loan_items WHERE receipt_id = $1',
    [receiptId]
  );
  assert.strictEqual(Number(countAfterReject.rows[0].count), 2, 'Receipt must strictly retain exactly 2 items');

  // Test bulk INSERT of 3 items into a brand new empty receipt
  const { receiptId: emptyReceiptId, copyIds: freshCopyIds } = await setupTestReceiptAndCopies(pool);

  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
         VALUES 
           ($1, $2, 100000),
           ($1, $3, 100000),
           ($1, $4, 100000)`,
        [emptyReceiptId, freshCopyIds[0], freshCopyIds[1], freshCopyIds[2]]
      );
    },
    /Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách/,
    'Bulk insert of 3 items must be rejected entirely'
  );

  const bulkCheck = await pool.query(
    'SELECT COUNT(*) as count FROM loan_items WHERE receipt_id = $1',
    [emptyReceiptId]
  );
  assert.strictEqual(Number(bulkCheck.rows[0].count), 0, 'Bulk insert must rollback completely leaving 0 items');
});

test('G-invariant 2: Concurrent inserts by two independent connections serialize on parent row lock (R03)', async () => {
  const pool = harness.getPool();
  const { receiptId, copyIds } = await setupTestReceiptAndCopies(pool);

  // Setup: Receipt already has 1 item
  await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)`,
    [receiptId, copyIds[0]]
  );

  // Now two separate clients concurrently attempt to add copyIds[1] and copyIds[2]
  const client1: Client = await harness.createIsolatedClient();
  const client2: Client = await harness.createIsolatedClient();

  // Set statement & lock timeouts (S02-03)
  await client1.query('SET statement_timeout = 5000; SET lock_timeout = 5000;');
  await client2.query('SET statement_timeout = 5000; SET lock_timeout = 5000;');

  const pid1Res = await client1.query('SELECT pg_backend_pid() AS pid');
  const pid1 = pid1Res.rows[0].pid;
  const pid2Res = await client2.query('SELECT pg_backend_pid() AS pid');
  const pid2 = pid2Res.rows[0].pid;

  let client1Committed = false;
  let client2Error: any = null;
  let client2Promise: Promise<void> | null = null;

  try {
    // 1. Client 1 begins transaction and inserts copyIds[1]
    await client1.query('BEGIN');
    await client1.query(
      `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
       VALUES ($1, $2, 100000)`,
      [receiptId, copyIds[1]]
    );
    // At this moment, Client 1 is guaranteed to hold parent row lock on receiptId FOR UPDATE

    // 2. NOW launch Client 2 in the background, which attempts to insert into the same receipt
    client2Promise = (async () => {
      try {
        await client2.query('BEGIN');
        await client2.query(
          `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
           VALUES ($1, $2, 100000)`,
          [receiptId, copyIds[2]]
        );
        await client2.query('COMMIT');
      } catch (err) {
        client2Error = err;
        try {
          await client2.query('ROLLBACK');
        } catch {}
      }
    })();

    // S02-03: Verify using pg_blocking_pids that Client 2 is actively blocked by Client 1
    let isBlocked = false;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const blockRes = await pool.query(
        'SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS is_blocked',
        [pid1, pid2]
      );
      if (blockRes.rows[0]?.is_blocked) {
        isBlocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.strictEqual(isBlocked, true, 'Client 2 must be actively blocked by Client 1 parent row lock in PostgreSQL');

    // Client 1 now commits
    await client1.query('COMMIT');
    client1Committed = true;

    // Wait for Client 2 to complete
    await client2Promise;

    // Assertions: Client 1 committed, Client 2 must have failed due to max 2 items invariant trigger
    assert.strictEqual(client1Committed, true, 'Client 1 must have committed successfully');
    assert.ok(client2Error, 'Client 2 must encounter an error after unblocking');
    assert.match(
      client2Error.message,
      /Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách/,
      'Client 2 error must be the max 2 books invariant error'
    );

    // Final database state check: Receipt has exactly 2 items, never 3
    const finalCount = await pool.query(
      'SELECT COUNT(*) as count FROM loan_items WHERE receipt_id = $1',
      [receiptId]
    );
    assert.strictEqual(Number(finalCount.rows[0].count), 2, 'Final receipt item count must strictly be 2');
  } finally {
    try {
      if (!client1Committed) {
        await client1.query('ROLLBACK');
      }
    } catch {}
    try {
      await client2Promise;
    } catch {}
    try {
      await client1.end();
    } catch {}
    try {
      await client2.end();
    } catch {}
  }
});

test('G-invariant 3: UPDATE moving an item into a 2-book receipt is rejected and rolls back cleanly', async () => {
  const pool = harness.getPool();
  const { receiptId: receiptA, copyIds: copyIdsA } = await setupTestReceiptAndCopies(pool);
  const { receiptId: receiptB, copyIds: copyIdsB } = await setupTestReceiptAndCopies(pool);

  // Receipt A has 1 item
  const itemARes = await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)
     RETURNING id`,
    [receiptA, copyIdsA[0]]
  );
  const itemIdA = itemARes.rows[0].id;

  // Receipt B has 2 items (full)
  await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000), ($1, $3, 100000)`,
    [receiptB, copyIdsB[0], copyIdsB[1]]
  );

  // Attempt to move item from Receipt A to Receipt B via UPDATE
  await assert.rejects(
    async () => {
      await pool.query(
        `UPDATE loan_items SET receipt_id = $1 WHERE id = $2`,
        [receiptB, itemIdA]
      );
    },
    /Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách/,
    'Moving item into full receipt must be rejected'
  );

  // Verify both receipts retain their original correct items
  const countA = await pool.query('SELECT COUNT(*) as count FROM loan_items WHERE receipt_id = $1', [receiptA]);
  const countB = await pool.query('SELECT COUNT(*) as count FROM loan_items WHERE receipt_id = $1', [receiptB]);

  assert.strictEqual(Number(countA.rows[0].count), 1, 'Receipt A must still have 1 item');
  assert.strictEqual(Number(countB.rows[0].count), 2, 'Receipt B must still have 2 items');
});

test('G-invariant 4: Normal UPDATE (returned_at, is_lost) on an item in a 2-item receipt is NOT blocked', async () => {
  const pool = harness.getPool();
  const { receiptId, copyIds } = await setupTestReceiptAndCopies(pool);

  // Receipt has 2 items
  const item1 = await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)
     RETURNING id`,
    [receiptId, copyIds[0]]
  );
  const item2 = await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)
     RETURNING id`,
    [receiptId, copyIds[1]]
  );

  // Regular UPDATE on returned_at must succeed without error
  await pool.query(
    `UPDATE loan_items SET returned_at = NOW() WHERE id = $1`,
    [item1.rows[0].id]
  );

  // Regular UPDATE on is_lost must succeed without error
  await pool.query(
    `UPDATE loan_items SET is_lost = TRUE WHERE id = $1`,
    [item2.rows[0].id]
  );

  const updatedItem1 = await pool.query('SELECT returned_at FROM loan_items WHERE id = $1', [item1.rows[0].id]);
  const updatedItem2 = await pool.query('SELECT is_lost FROM loan_items WHERE id = $1', [item2.rows[0].id]);

  assert.ok(updatedItem1.rows[0].returned_at, 'returned_at must be updated');
  assert.strictEqual(updatedItem2.rows[0].is_lost, true, 'is_lost must be updated');
});

test('G-invariant 5: Two receipts attempting to borrow the same active copy are blocked by partial unique index', async () => {
  const pool = harness.getPool();
  const { receiptId: receipt1, copyIds } = await setupTestReceiptAndCopies(pool);
  const { receiptId: receipt2 } = await setupTestReceiptAndCopies(pool);

  const sharedCopyId = copyIds[0];

  // Receipt 1 borrows sharedCopyId
  await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)`,
    [receipt1, sharedCopyId]
  );

  // Receipt 2 attempts to borrow same sharedCopyId while active (returned_at IS NULL and is_lost = FALSE)
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
         VALUES ($1, $2, 100000)`,
        [receipt2, sharedCopyId]
      );
    },
    /idx_unique_active_copy_loan|duplicate key value violates unique constraint/,
    'Partial unique index must reject borrowing the same active copy in another receipt'
  );

  // After Receipt 1 returns the copy (returned_at IS NOT NULL), Receipt 2 can now borrow it
  await pool.query(
    `UPDATE loan_items SET returned_at = NOW() WHERE receipt_id = $1 AND copy_id = $2`,
    [receipt1, sharedCopyId]
  );

  await pool.query(
    `INSERT INTO loan_items (receipt_id, copy_id, deposit_snapshot)
     VALUES ($1, $2, 100000)`,
    [receipt2, sharedCopyId]
  );

  const receipt2Items = await pool.query(
    'SELECT COUNT(*) as count FROM loan_items WHERE receipt_id = $1 AND copy_id = $2',
    [receipt2, sharedCopyId]
  );
  assert.strictEqual(Number(receipt2Items.rows[0].count), 1, 'Copy can be borrowed again once returned');
});
