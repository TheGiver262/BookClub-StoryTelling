import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import { issueLoanReceipt } from '../../src/server/circulation/service.ts';
import { archiveBorrower } from '../../src/server/borrowers/service.ts';
import { claimIdempotency, completeIdempotency, computePayloadHash } from '../../src/server/shared/idempotency.ts';
import {
  openCashSession,
  closeCashSession,
  SessionAlreadyClosedError,
} from '../../src/server/finance/cash-sessions.ts';
import { withTransaction } from '../../src/server/db/client.ts';
import { CopyNotAvailableError } from '../../src/server/circulation/types.ts';
import { BorrowerError } from '../../src/server/borrowers/service.ts';

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
async function setupTestData(client: Client) {
  const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
  const adminId = memberRes.rows[0].id;

  // Đóng mọi phiên quầy đang mở để tránh vi phạm idx_single_active_cash_session
  await client.query(
    `UPDATE cash_sessions
     SET is_closed = true,
         closed_at = NOW(),
         actual_closing_cash = expected_closing_cash,
         discrepancy = 0,
         discrepancy_reason = 'Fixture clean close before test session'
     WHERE is_closed = false`
  );

  // Tạo borrower
  const borrowerRes = await client.query(
    `INSERT INTO borrowers (full_name, phone, student_id, school)
     VALUES ('Trần Thị Lan', '0912345678', '20240001', 'Đại học Bách Khoa')
     RETURNING id`
  );
  const borrowerId = borrowerRes.rows[0].id;

  // Tạo title & edition
  const titleRes = await client.query(
    `INSERT INTO book_titles (title) VALUES ('Lập Trình Phân Tán') RETURNING id`
  );
  const titleId = titleRes.rows[0].id;

  const edRes = await client.query(
    `INSERT INTO book_editions (title_id, publisher, publish_year)
     VALUES ($1, 'NXB Khoa Học Kỹ Thuật', 2024) RETURNING id`,
    [titleId]
  );
  const editionId = edRes.rows[0].id;

  // Tạo 3 copies khả dụng
  const now = Date.now();
  const c1Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 75000)
     RETURNING id, barcode`,
    [editionId, `BC-INT-${now}-1`]
  );
  const c2Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 150000)
     RETURNING id, barcode`,
    [editionId, `BC-INT-${now}-2`]
  );
  const c3Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 50000)
     RETURNING id, barcode`,
    [editionId, `BC-INT-${now}-3`]
  );

  // Tạo ca quầy hôm nay
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const sessionId = `CS-INT-${now}`;
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
    sessionId,
    today,
    copies: [c1Res.rows[0], c2Res.rows[0], c3Res.rows[0]],
  };
}

test('G-issue-db 1: Concurrency - 2 concurrent connections attempt to borrow same copy', async () => {
  await harness.withClient(async (setupClient: Client) => {
    const data = await setupTestData(setupClient);
    const barcode = data.copies[0].barcode;

    // Sử dụng 2 client độc lập mô phỏng 2 kết nối đồng thời
    let successCount = 0;
    let conflictCount = 0;

    const runBorrow = async () => {
      return harness.withClient(async (client: Client) => {
        try {
          await withTransaction(client, async (tx: any) => {
            return await issueLoanReceipt(
              tx,
              {
                borrowerId: data.borrowerId,
                barcodes: [barcode],
                paymentMethod: 'CASH',
                paymentConfirmed: true,
              },
              data.adminId
            );
          });
          successCount++;
        } catch (err: any) {
          if (err instanceof CopyNotAvailableError || err.code === 'COPY_NOT_AVAILABLE') {
            conflictCount++;
          } else {
            throw err;
          }
        }
      });
    };

    await Promise.all([runBorrow(), runBorrow()]);

    assert.strictEqual(successCount, 1, 'Chỉ 1 giao dịch được mượn thành công cuốn sách');
    assert.strictEqual(conflictCount, 1, 'Giao dịch thứ 2 phải nhận lỗi xung đột CopyNotAvailableError');

    // Kiểm tra trạng thái trong DB: status = BORROWED
    const copyCheck = await setupClient.query('SELECT status FROM book_copies WHERE barcode = $1', [barcode]);
    assert.strictEqual(copyCheck.rows[0].status, 'BORROWED');
  });
});

test('G-issue-db 2: Deadlock Avoidance - Ordered locking prevents deadlock on reverse copy order', async () => {
  await harness.withClient(async (setupClient: Client) => {
    const data = await setupTestData(setupClient);
    const b1 = data.copies[0].barcode;
    const b2 = data.copies[1].barcode;

    let t1Done = false;
    let t2Done = false;

    const p1 = harness.withClient(async (client1: Client) => {
      try {
        await withTransaction(client1, async (tx: any) => {
          await issueLoanReceipt(
            tx,
            {
              borrowerId: data.borrowerId,
              barcodes: [b1, b2],
              paymentMethod: 'CASH',
              paymentConfirmed: true,
            },
            data.adminId
          );
        });
        t1Done = true;
      } catch (err: any) {
        assert.notStrictEqual(err.code, '40P01', 'Không được xảy ra PostgreSQL deadlock (40P01)');
      }
    });

    const p2 = harness.withClient(async (client2: Client) => {
      try {
        await withTransaction(client2, async (tx: any) => {
          await issueLoanReceipt(
            tx,
            {
              borrowerId: data.borrowerId,
              barcodes: [b2, b1],
              paymentMethod: 'CASH',
              paymentConfirmed: true,
            },
            data.adminId
          );
        });
        t2Done = true;
      } catch (err: any) {
        assert.notStrictEqual(err.code, '40P01', 'Không được xảy ra PostgreSQL deadlock (40P01)');
      }
    });

    await Promise.all([p1, p2]);
    assert.ok(t1Done || t2Done, 'Ít nhất 1 transaction hoàn thành an toàn không deadlock');
  });
});

test('G-issue-db 3: Issuing loan on closed cash session is rejected with 409', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupTestData(client);

    // Đóng phiên quầy
    await closeCashSession(client, {
      sessionId: data.sessionId,
      closedBy: data.adminId,
      actualClosingCash: 500000n,
    });

    // Cố gắng lập phiếu mượn tiền mặt trên ca đã đóng
    await assert.rejects(
      () =>
        withTransaction(client, async (tx: any) => {
          return await issueLoanReceipt(
            tx,
            {
              borrowerId: data.borrowerId,
              barcodes: [data.copies[2].barcode],
              paymentMethod: 'CASH',
              sessionId: data.sessionId,
              paymentConfirmed: true,
            },
            data.adminId
          );
        }),
      (err: any) => {
        return err instanceof SessionAlreadyClosedError || err.code === 'SESSION_CLOSED';
      }
    );
  });
});

test('G-issue-db 4: Race condition between archive borrower and active loan receipt', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupTestData(client);

    // 1. Tạo phiếu mượn hợp lệ
    const receipt = await withTransaction(client, async (tx: any) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.copies[0].barcode],
          paymentMethod: 'CASH',
          paymentConfirmed: true,
        },
        data.adminId
      );
    });

    assert.ok(receipt.id);

    // 2. Thử lưu trữ (archive) bạn đọc này -> Phải bị từ chối 409 vì đang có sách mượn
    await assert.rejects(
      () => archiveBorrower(client, data.borrowerId, data.adminId),
      (err: any) => {
        return err instanceof BorrowerError && (err.code === 'BORROWER_HAS_ACTIVE_LOANS' || err.message.includes('đang mượn'));
      }
    );
  });
});

test('G-issue-db 5: Idempotency concurrency and replay on live PostgreSQL', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupTestData(client);
    const key = `idemp-pg-${Date.now()}`;
    const payload = { borrowerId: data.borrowerId, barcodes: [data.copies[1].barcode], paymentConfirmed: true };
    const hash = computePayloadHash(payload);

    // Lần 1: Claim và Complete
    const claim1 = await claimIdempotency(client, data.adminId, 'CIRCULATION_ISSUE_LOAN', key, hash);
    assert.strictEqual(claim1.action, 'CLAIMED');

    const receipt = await withTransaction(client, async (tx: any) => {
      return await issueLoanReceipt(
        tx,
        {
          borrowerId: data.borrowerId,
          barcodes: [data.copies[1].barcode],
          paymentMethod: 'BANK_TRANSFER',
          paymentConfirmed: true,
        },
        data.adminId
      );
    });

    await completeIdempotency(client, data.adminId, 'CIRCULATION_ISSUE_LOAN', key, 201, { data: receipt });

    // Lần 2: Replay cùng key và payload
    const claim2 = await claimIdempotency(client, data.adminId, 'CIRCULATION_ISSUE_LOAN', key, hash);
    assert.strictEqual(claim2.action, 'RETURN_CACHED');
    assert.strictEqual(claim2.responseCode, 201);
    const cachedData = (claim2.responseBody as any).data;
    assert.strictEqual(cachedData.id, receipt.id);
  });
});

test('G-issue-db 6: Atomic rollback leaves zero leftover records on invalid copy', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupTestData(client);
    const validBarcode = data.copies[2].barcode;
    const invalidBarcode = 'NON_EXISTENT_BARCODE_XYZ';

    // Đếm số dòng trước khi thử
    const countReceiptsBefore = await client.query('SELECT COUNT(*) AS total FROM loan_receipts');
    const countItemsBefore = await client.query('SELECT COUNT(*) AS total FROM loan_items');
    const countAllocBefore = await client.query('SELECT COUNT(*) AS total FROM deposit_allocations');
    const countJournalsBefore = await client.query('SELECT COUNT(*) AS total FROM journal_entries');

    await assert.rejects(
      () =>
        withTransaction(client, async (tx: any) => {
          return await issueLoanReceipt(
            tx,
            {
              borrowerId: data.borrowerId,
              barcodes: [validBarcode, invalidBarcode],
              paymentMethod: 'CASH',
              paymentConfirmed: true,
            },
            data.adminId
          );
        }),
      (err: any) => {
        return err.code === 'COPY_NOT_FOUND' || err.message.includes('NON_EXISTENT_BARCODE_XYZ');
      }
    );

    // Kiểm tra số dòng sau rollback: Hoàn toàn không đổi (zero leftover mutations)
    const countReceiptsAfter = await client.query('SELECT COUNT(*) AS total FROM loan_receipts');
    const countItemsAfter = await client.query('SELECT COUNT(*) AS total FROM loan_items');
    const countAllocAfter = await client.query('SELECT COUNT(*) AS total FROM deposit_allocations');
    const countJournalsAfter = await client.query('SELECT COUNT(*) AS total FROM journal_entries');

    assert.strictEqual(countReceiptsAfter.rows[0].total, countReceiptsBefore.rows[0].total);
    assert.strictEqual(countItemsAfter.rows[0].total, countItemsBefore.rows[0].total);
    assert.strictEqual(countAllocAfter.rows[0].total, countAllocBefore.rows[0].total);
    assert.strictEqual(countJournalsAfter.rows[0].total, countJournalsBefore.rows[0].total);

    // Cuốn sách valid vẫn giữ nguyên status = AVAILABLE
    const copyCheck = await client.query('SELECT status FROM book_copies WHERE barcode = $1', [validBarcode]);
    assert.strictEqual(copyCheck.rows[0].status, 'AVAILABLE');
  });
});
