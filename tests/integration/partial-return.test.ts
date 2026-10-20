import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import { issueLoanReceipt, settleReturnReceipt } from '../../src/server/circulation/service.ts';
import { openCashSession } from '../../src/server/finance/cash-sessions.ts';
import { withTransaction } from '../../src/server/db/client.ts';
import { LoanAlreadyReturnedError } from '../../src/server/circulation/types.ts';

let harness: DbHarness;

before(async () => {
  harness = new DbHarness();
});

beforeEach(async () => {
  await harness.resetSchema();
  await harness.applyDDL();
  await harness.applySeed();
});

after(async () => {
  if (harness) {
    await harness.close();
  }
});

// Helper setup dữ liệu phiên làm việc, sách và bạn đọc
async function setupPartialTestData(client: Client) {
  const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
  const adminId = memberRes.rows[0].id;

  // Đóng mọi session đang mở trước khi mở session mới
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
  const borrowerRes = await client.query(
    `INSERT INTO borrowers (full_name, phone, student_id, school)
     VALUES ('Trần Thị Trả Một Phần', '0912345678', '20248888', 'ĐHBK Hà Nội')
     RETURNING id`
  );
  const borrowerId = borrowerRes.rows[0].id;

  // Tạo title & edition
  const titleRes = await client.query(
    `INSERT INTO book_titles (title) VALUES ('Lập Trình Hệ Thống Phân Tán') RETURNING id`
  );
  const titleId = titleRes.rows[0].id;

  const edRes = await client.query(
    `INSERT INTO book_editions (title_id, publisher, publish_year)
     VALUES ($1, 'NXB Bách Khoa', 2025) RETURNING id`,
    [titleId]
  );
  const editionId = edRes.rows[0].id;

  // Tạo copies với location chuẩn 'BAN_TRUC_TAM'
  const now = Date.now();
  const c1Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 50000)
     RETURNING id, barcode`,
    [editionId, `BC-PART-${now}-1`]
  );
  const c2Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 75000)
     RETURNING id, barcode`,
    [editionId, `BC-PART-${now}-2`]
  );

  // Mở ca quầy hôm nay
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const sessionId = `CS-PART-${now}`;
  await openCashSession(client, {
    sessionId,
    sessionDate: today,
    openedBy: adminId,
    openingCash: 1000000n,
    discrepancyReason: 'Synthetic integration fixture opening',
  });

  return {
    adminId,
    borrowerId,
    sessionId,
    today,
    c1: c1Res.rows[0],
    c2: c2Res.rows[0],
  };
}

test('G-partial-db 1: 2 books -> return 1, keep 1 in PostgreSQL (AVAILABLE vs BORROWED, hold uniqueness, no fake returned_at)', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupPartialTestData(client);

    // Mượn 2 cuốn: c1 (50k cọc) + c2 (100k cọc) -> tổng 150k
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode, data.c2.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 150000,
        },
        data.adminId
      );
    });

    // Trả 1 cuốn c1, giữ lại c2
    const settleResult = await withTransaction(client, async (tx) => {
      return await settleReturnReceipt(
        tx,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: [data.c1.barcode],
          refundMethod: 'CASH',
          paymentConfirmed: true,
        },
        data.adminId
      );
    });

    assert.strictEqual(settleResult.status, 'PARTIAL_SETTLED');
    assert.strictEqual(settleResult.depositRefunded, 50000);
    assert.strictEqual(settleResult.depositTransferred, 100000);
    assert.ok(settleResult.newReceiptId);

    // Kiểm tra trạng thái bản sách c1: AVAILABLE
    const copy1 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.c1.id]);
    assert.strictEqual(copy1.rows[0].status, 'AVAILABLE');

    // Kiểm tra trạng thái bản sách c2: GIỮ NGUYÊN BORROWED
    const copy2 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.c2.id]);
    assert.strictEqual(copy2.rows[0].status, 'BORROWED');

    // Kiểm tra dòng sách c2 cũ: carried_forward_at có giá trị, returned_at LÀ NULL
    const oldItem2 = await client.query(
      'SELECT returned_at, carried_forward_at, successor_item_id FROM loan_items WHERE receipt_id = $1 AND copy_id = $2',
      [loan.id, data.c2.id]
    );
    assert.strictEqual(oldItem2.rows[0].returned_at, null);
    assert.ok(oldItem2.rows[0].carried_forward_at);
    assert.ok(oldItem2.rows[0].successor_item_id);

    // Kiểm tra phiếu cũ: status PARTIAL_SETTLED
    const oldReceipt = await client.query('SELECT status FROM loan_receipts WHERE id = $1', [loan.id]);
    assert.strictEqual(oldReceipt.rows[0].status, 'PARTIAL_SETTLED');

    // Kiểm tra phiếu mới: ACTIVE, preceding_receipt_id = loan.id
    const newReceipt = await client.query('SELECT status, preceding_receipt_id, renew_count FROM loan_receipts WHERE id = $1', [
      settleResult.newReceiptId,
    ]);
    assert.strictEqual(newReceipt.rows[0].status, 'ACTIVE');
    assert.strictEqual(newReceipt.rows[0].preceding_receipt_id, loan.id);
    assert.strictEqual(newReceipt.rows[0].renew_count, 0);
  });
});

test('G-partial-db 2: Case P >= D (T73) in PostgreSQL -> Forfeit old deposit, require new deposit', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupPartialTestData(client);

    // Mượn 2 cuốn: 50k + 100k = 150k
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode, data.c2.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 150000,
        },
        data.adminId
      );
    });

    // Quá hạn phạt 150k >= D = 150k. Chưa thu cọc mới (newDepositConfirmed = false)
    const settleResult = await withTransaction(client, async (tx) => {
      return await settleReturnReceipt(
        tx,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: [data.c1.barcode],
          fineAmount: 150000n,
          fineReason: 'Quá hạn 150 ngày giữ toàn bộ cọc cũ làm phạt',
          newDepositPaymentMethod: 'CASH',
          newDepositConfirmed: false,
          paymentConfirmed: true,
        },
        data.adminId
      );
    });

    assert.strictEqual(settleResult.depositForfeited, 150000);
    assert.strictEqual(settleResult.depositRefunded, 0);
    assert.strictEqual(settleResult.newDepositCollected, 0);

    // Phiếu mới: PENDING_DEPOSIT
    const newReceipt = await client.query('SELECT status FROM loan_receipts WHERE id = $1', [settleResult.newReceiptId]);
    assert.strictEqual(newReceipt.rows[0].status, 'PENDING_DEPOSIT');

    // Cuốn giữ lại: BORROWED (tuyệt đối không AVAILABLE)
    const copy2 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.c2.id]);
    assert.strictEqual(copy2.rows[0].status, 'BORROWED');
  });
});

test('G-partial-db 3: Double settle on already PARTIAL_SETTLED receipt is rejected with 409 Conflict', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupPartialTestData(client);

    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode, data.c2.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 150000,
        },
        data.adminId
      );
    });

    // Lần 1: Thành công
    await withTransaction(client, async (tx) => {
      return await settleReturnReceipt(
        tx,
        {
          receiptId: loan.id,
          returnType: 'PARTIAL',
          returnedCopyBarcodes: [data.c1.barcode],
          paymentConfirmed: true,
        },
        data.adminId
      );
    });

    // Lần 2: Thất bại với 409 Conflict
    await assert.rejects(
      async () => {
        await withTransaction(client, async (tx) => {
          return await settleReturnReceipt(
            tx,
            {
              receiptId: loan.id,
              returnType: 'PARTIAL',
              returnedCopyBarcodes: [data.c1.barcode],
              paymentConfirmed: true,
            },
            data.adminId
          );
        });
      },
      (err: any) => {
        return err instanceof LoanAlreadyReturnedError || err.code === 'LOAN_ALREADY_RETURNED';
      }
    );
  });
});
