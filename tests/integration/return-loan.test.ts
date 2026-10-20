import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import { issueLoanReceipt, settleReturnReceipt, confirmRefund } from '../../src/server/circulation/service.ts';
import { openCashSession, closeCashSession } from '../../src/server/finance/cash-sessions.ts';
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
async function setupReturnTestData(client: Client) {
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
     VALUES ('Hoàng Văn Trả', '0987654321', '20249999', 'ĐHBK Hà Nội')
     RETURNING id`
  );
  const borrowerId = borrowerRes.rows[0].id;

  // Tạo title & edition
  const titleRes = await client.query(
    `INSERT INTO book_titles (title) VALUES ('Kiến Trúc Microservices & Event-Driven') RETURNING id`
  );
  const titleId = titleRes.rows[0].id;

  const edRes = await client.query(
    `INSERT INTO book_editions (title_id, publisher, publish_year)
     VALUES ($1, 'NXB Bách Khoa', 2024) RETURNING id`,
    [titleId]
  );
  const editionId = edRes.rows[0].id;

  // Tạo copies với location thuộc enum chuẩn (BAN_TRUC_TAM)
  const now = Date.now();
  const c1Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 50000)
     RETURNING id, barcode`,
    [editionId, `BC-RET-${now}-1`]
  );
  const c2Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 75000)
     RETURNING id, barcode`,
    [editionId, `BC-RET-${now}-2`]
  );

  // Mở ca quầy hôm nay
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const sessionId = `CS-RET-${now}`;
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

test('G-return-db 1: Full return 2 books -> updates copies to AVAILABLE, loan RETURNED, and creates pending refund', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupReturnTestData(client);

    // Mượn 2 cuốn
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode, data.c2.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 150000, // 50k + 100k
        },
        data.adminId
      );
    });

    // Tất toán trả đủ 2 cuốn (On-time, fine = 0)
    const settleResult = await withTransaction(client, async (tx) => {
      return await settleReturnReceipt(
        tx,
        {
          receiptId: loan.id,
          returnedCopyIds: [data.c1.id, data.c2.id],
          refundMethod: 'CASH',
        },
        data.adminId
      );
    });

    assert.strictEqual(settleResult.status, 'RETURNED');
    assert.strictEqual(settleResult.returnedItemsCount, 2);
    assert.strictEqual(settleResult.refundIntents.length, 2);
    assert.strictEqual(settleResult.depositRefunded, 150000);
    assert.strictEqual(settleResult.depositForfeited, 0);

    // Kiểm tra trạng thái sách trong DB
    const copy1 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.c1.id]);
    assert.strictEqual(copy1.rows[0].status, 'AVAILABLE');

    const copy2 = await client.query('SELECT status FROM book_copies WHERE id = $1', [data.c2.id]);
    assert.strictEqual(copy2.rows[0].status, 'AVAILABLE');

    // Kiểm tra trạng thái phiếu
    const receiptCheck = await client.query('SELECT status FROM loan_receipts WHERE id = $1', [loan.id]);
    assert.strictEqual(receiptCheck.rows[0].status, 'RETURNED');
  });
});

test('G-return-db 2: Case P >= D -> Forfeit full deposit, no refund intent, no extra charge', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupReturnTestData(client);

    // Mượn 1 cuốn (50k cọc)
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 50000,
        },
        data.adminId
      );
    });

    // Trả sách với mức phạt quá hạn 80.000đ (P >= D=50.000đ)
    const settleResult = await withTransaction(client, async (tx) => {
      return await settleReturnReceipt(
        tx,
        {
          receiptId: loan.id,
          returnedCopyIds: [data.c1.id],
          refundMethod: 'CASH',
          fineAmount: 80000n,
          fineReason: 'Quá hạn 80 ngày theo biên bản',
        },
        data.adminId
      );
    });

    assert.strictEqual(settleResult.status, 'RETURNED');
    assert.strictEqual(settleResult.depositForfeited, 50000);
    assert.strictEqual(settleResult.depositRefunded, 0);
    assert.strictEqual(settleResult.directFineCollected, 0); // Không thu thêm 30k!
    assert.strictEqual(settleResult.refundIntents.length, 0); // Không tạo refund intent
  });
});

test('G-return-db 3: Pending refund confirmed in a later session records actual cash session correctly', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupReturnTestData(client);

    // Mượn sách
    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 50000,
        },
        data.adminId
      );
    });

    // Tất toán trả sách (fine = 0, tạo refund intent PENDING)
    const settleResult = await withTransaction(client, async (tx) => {
      return await settleReturnReceipt(
        tx,
        {
          receiptId: loan.id,
          returnedCopyIds: [data.c1.id],
          refundMethod: 'CASH',
        },
        data.adminId
      );
    });

    const intentId = settleResult.refundIntents[0].id;

    // Đóng ca 1
    await closeCashSession(client, {
      sessionId: data.sessionId,
      closedBy: data.adminId,
      actualClosingCash: 1050000n,
    });

    // Mở ca 2 vào buổi kế tiếp
    const session2Id = `CS-RET-LATER-${Date.now()}`;
    await openCashSession(client, {
      sessionId: session2Id,
      sessionDate: '2026-10-22',
      openedBy: data.adminId,
      openingCash: 1050000n,
    discrepancyReason: 'Synthetic integration fixture opening',
    });

    // Xác nhận hoàn cọc ở ca 2
    const confirmResult = await withTransaction(client, async (tx) => {
      return await confirmRefund(
        tx,
        {
          refundIntentId: intentId,
          paymentConfirmed: true,
        },
        data.adminId
      );
    });

    assert.strictEqual(confirmResult.status, 'CONFIRMED');
    assert.strictEqual(confirmResult.cashSessionId, session2Id);

    // Kiểm tra allocation status trong DB
    const allocCheck = await client.query('SELECT status FROM deposit_allocations WHERE receipt_id = $1', [loan.id]);
    assert.strictEqual(allocCheck.rows[0].status, 'REFUNDED');
  });
});

test('G-return-db 4: Double settle on already RETURNED receipt is rejected with 409 Conflict', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupReturnTestData(client);

    const loan = await withTransaction(client, async (tx) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.c1.barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
          confirmedAmount: 50000,
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
          returnedCopyIds: [data.c1.id],
          refundMethod: 'CASH',
        },
        data.adminId
      );
    });

    // Lần 2: Thất bại với LoanAlreadyReturnedError (409)
    await assert.rejects(
      async () => {
        await withTransaction(client, async (tx) => {
          return await settleReturnReceipt(
            tx,
            {
              receiptId: loan.id,
              returnedCopyIds: [data.c1.id],
              refundMethod: 'CASH',
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
