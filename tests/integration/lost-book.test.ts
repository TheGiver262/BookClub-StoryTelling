import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import {
  issueLoanReceipt,
  reportBookLoss,
} from '../../src/server/circulation/service.ts';
import {
  createDocumentCorrection,
  recordJournalEntry,
} from '../../src/server/finance/ledger.ts';
import { openCashSession } from '../../src/server/finance/cash-sessions.ts';
import { withTransaction } from '../../src/server/db/client.ts';
import { FUND_IDS, ACCOUNT_CODES } from '../../src/server/finance/types.ts';
import { getCurrentVietnamDate } from '../../src/server/circulation/rules.ts';

let harness: DbHarness;

before(async () => {
  harness = new DbHarness();
});

beforeEach(async () => {
  await harness.resetSchema();
  await harness.applyDDL();
  await harness.applyMigrations();
  await harness.applySeed();
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

// Helper setup dữ liệu phiên làm việc, sách và bạn đọc
async function setupLostTestData(client: Client) {
  const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
  const adminId = memberRes.rows[0].id;

  // Đóng các session đang mở với snapshot actual_closing_cash hợp lệ
  await client.query(
    `UPDATE cash_sessions
     SET is_closed = true,
         closed_at = NOW(),
         actual_closing_cash = expected_closing_cash,
         discrepancy = 0,
         discrepancy_reason = 'Fixture clean close before test session'
     WHERE is_closed = false`
  );

  // Tạo bạn đọc
  const now = Date.now();
  const borrowerRes = await client.query(
    `INSERT INTO borrowers (full_name, phone, student_id, school)
     VALUES ($1, $2, $3, 'ĐHBK Hà Nội')
     RETURNING id`,
    [`Bạn Đọc Báo Mất ${now}`, `097${String(now).slice(-7)}`, `2024${String(now).slice(-4)}`]
  );
  const borrowerId = borrowerRes.rows[0].id;

  // Tạo title & edition
  const titleRes = await client.query(
    `INSERT INTO book_titles (title) VALUES ($1) RETURNING id`,
    [`Sách Báo Mất Thực Nghiệm ${now}`]
  );
  const titleId = titleRes.rows[0].id;

  const editionRes = await client.query(
    `INSERT INTO book_editions (title_id, publisher, publish_year)
     VALUES ($1, 'NXB Bách Khoa', 2025)
     RETURNING id`,
    [titleId]
  );
  const editionId = editionRes.rows[0].id;

  // Tạo 2 bản sách: cp1 (giá bìa 74k -> cọc 50k), cp2 (giá bìa 150k -> cọc 150k)
  const copyRes1 = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, cover_price, status, location)
     VALUES ($1, $2, 74000, 'AVAILABLE', 'BAN_TRUC_TAM')
     RETURNING id, barcode`,
    [editionId, `BC-LOST-PG1-${now}`]
  );
  const copy1 = copyRes1.rows[0];

  const copyRes2 = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, cover_price, status, location)
     VALUES ($1, $2, 150000, 'AVAILABLE', 'BAN_TRUC_TAM')
     RETURNING id, barcode`,
    [editionId, `BC-LOST-PG2-${now}`]
  );
  const copy2 = copyRes2.rows[0];

  // Mở ca trực tiền mặt
  const today = getCurrentVietnamDate();
  const sessionId = `CS-LOST-${now}`;
  await openCashSession(client, {
    sessionId,
    sessionDate: today,
    openedBy: adminId,
    openingCash: 500000n,
    discrepancyReason: 'Synthetic integration fixture opening',
  });

  return {
    adminId,
    borrowerId,
    copy1,
    copy2,
    sessionId,
  };
}

test('PG-loss 1: Report book loss on single book loan - marks copy LOST, forfeits deposit, receipt becomes LOST', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupLostTestData(client);

    // Mượn 1 cuốn (cọc 50k)
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.copy1.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 50000,
        },
        data.adminId
      );
    });

    // Báo mất cuốn sách
    const lossResult = await withTransaction(client, async (tx) => {
      return await reportBookLoss(
        tx,
        {
          receiptId: loan.id,
          barcodes: [data.copy1.barcode],
          reason: 'Làm mất sách trên giảng đường',
          cashSessionId: data.sessionId,
        },
        data.adminId
      );
    });

    assert.strictEqual(lossResult.forfeitedDeposit, 50000);
    assert.strictEqual(lossResult.receiptStatus, 'LOST');
    assert.strictEqual(lossResult.settlementType, 'LOST');

    // Kiểm tra DB: book_copies status = 'LOST'
    const copyCheck = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.copy1.id]);
    assert.strictEqual(copyCheck.rows[0].status, 'LOST');

    // Kiểm tra DB: loan_items is_lost = true, returned_at IS NULL
    const itemCheck = await client.query('SELECT is_lost, returned_at, lost_reason FROM loan_items WHERE receipt_id = $1', [loan.id]);
    assert.strictEqual(itemCheck.rows[0].is_lost, true);
    assert.strictEqual(itemCheck.rows[0].returned_at, null);
    assert.strictEqual(itemCheck.rows[0].lost_reason, 'Làm mất sách trên giảng đường');

    // Kiểm tra DB: deposit_allocations status = 'FORFEITED', remaining_amount = 0
    const allocCheck = await client.query('SELECT status, remaining_amount FROM deposit_allocations WHERE receipt_id = $1', [loan.id]);
    assert.strictEqual(allocCheck.rows[0].status, 'FORFEITED');
    assert.strictEqual(Number(allocCheck.rows[0].remaining_amount), 0);

    // Kiểm tra DB: loan_settlements record
    const settleCheck = await client.query('SELECT settlement_type, deposit_forfeited FROM loan_settlements WHERE receipt_id = $1', [loan.id]);
    assert.strictEqual(settleCheck.rows[0].settlement_type, 'LOST');
    assert.strictEqual(Number(settleCheck.rows[0].deposit_forfeited), 50000);
  });
});

test('PG-loss 2: Partial loss on 2-book loan - 1 copy LOST, 1 copy BORROWED, receipt remains ACTIVE', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupLostTestData(client);

    // Mượn 2 cuốn: 50k + 150k = 200k cọc
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.copy1.barcode, data.copy2.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 200000,
        },
        data.adminId
      );
    });

    // Báo mất chỉ cuốn copy1
    const lossResult = await withTransaction(client, async (tx) => {
      return await reportBookLoss(
        tx,
        {
          receiptId: loan.id,
          barcodes: [data.copy1.barcode],
          reason: 'Làm mất cuốn 1',
          cashSessionId: data.sessionId,
        },
        data.adminId
      );
    });

    assert.strictEqual(lossResult.forfeitedDeposit, 50000);
    assert.strictEqual(lossResult.receiptStatus, 'ACTIVE');
    assert.strictEqual(lossResult.settlementType, null);

    // Kiểm tra DB: copy1 LOST, copy2 BORROWED
    const cp1 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.copy1.id]);
    const cp2 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.copy2.id]);
    assert.strictEqual(cp1.rows[0].status, 'LOST');
    assert.strictEqual(cp2.rows[0].status, 'BORROWED');
  });
});

test('PG-correction 1: Document reversal creates reversal journal entry and prevents double reversal', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupLostTestData(client);

    // Ghi một bút toán thu tiền phạt 15.000₫
    const origEntry = await withTransaction(client, async (tx) => {
      return await recordJournalEntry(tx, {
        entryCode: `JE-FINE-REV-${Date.now()}`,
        fundId: FUND_IDS.LOAN,
        sourceType: 'MANUAL_ADJUSTMENT',
        sourceId: data.adminId,
        debitAccount: ACCOUNT_CODES.CASH_DRAWER,
        creditAccount: ACCOUNT_CODES.FINE_REVENUE,
        amount: 15000n,
        cashSessionId: data.sessionId,
        createdBy: data.adminId,
        notes: 'Ghi nhầm bút toán thu phạt',
      });
    });

    // Thực hiện đảo bút toán
    const correctionResult = await withTransaction(client, async (tx) => {
      return await createDocumentCorrection(
        tx,
        {
          originalEntryId: origEntry.id,
          reason: 'Đảo bút toán thu phạt nhầm',
          paymentConfirmed: true,
          cashSessionId: data.sessionId,
        },
        data.adminId
      );
    });

    assert.strictEqual(correctionResult.originalEntryId, origEntry.id);
    assert.strictEqual(correctionResult.amount, 15000);

    // Đảo lần 2 phải bị chặn với ENTRY_ALREADY_REVERSED
    await assert.rejects(
      async () => {
        await withTransaction(client, async (tx) => {
          await createDocumentCorrection(
            tx,
            {
              originalEntryId: origEntry.id,
              reason: 'Cố tình đảo lần 2',
              paymentConfirmed: true,
              cashSessionId: data.sessionId,
            },
            data.adminId
          );
        });
      },
      (err: any) => err.code === 'ENTRY_ALREADY_REVERSED' || err.statusCode === 409
    );
  });
});
