import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import {
  issueLoanReceipt,
  renewLoanReceipt,
} from '../../src/server/circulation/service.ts';
import { openCashSession } from '../../src/server/finance/cash-sessions.ts';
import { withTransaction } from '../../src/server/db/client.ts';
import { MaxRenewalsExceededError } from '../../src/server/circulation/types.ts';
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

// Helper setup dữ liệu phiên làm việc, sách và bạn đọc (S09-09: clean snapshot close)
async function setupRenewTestData(client: Client) {
  const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
  const adminId = memberRes.rows[0].id;

  // S09-09: Đóng các session đang mở với snapshot actual_closing_cash hợp lệ
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
    [`Bạn Đọc Gia Hạn ${now}`, `098${String(now).slice(-7)}`, `2024${String(now).slice(-4)}`]
  );
  const borrowerId = borrowerRes.rows[0].id;

  // Tạo title & edition
  const titleRes = await client.query(
    `INSERT INTO book_titles (title) VALUES ($1) RETURNING id`,
    [`Sách Gia Hạn Thực Nghiệm ${now}`]
  );
  const titleId = titleRes.rows[0].id;

  const edRes = await client.query(
    `INSERT INTO book_editions (title_id, publisher, publish_year)
     VALUES ($1, 'NXB Bách Khoa', 2026) RETURNING id`,
    [titleId]
  );
  const editionId = edRes.rows[0].id;

  // Tạo copies với location thuộc enum chuẩn (BAN_TRUC_TAM)
  const c1Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 50000)
     RETURNING id, barcode`,
    [editionId, `BC-RNW-${now}-1`]
  );
  const c2Res = await client.query(
    `INSERT INTO book_copies (edition_id, barcode, location, status, cover_price)
     VALUES ($1, $2, 'BAN_TRUC_TAM', 'AVAILABLE', 100000)
     RETURNING id, barcode`,
    [editionId, `BC-RNW-${now}-2`]
  );

  // Mở ca quầy hôm nay
  const today = getCurrentVietnamDate();
  const sessionId = `CS-RNW-${now}`;
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

test('G-renew-db 1: In-time renewal in PostgreSQL (+14d from due date, max 3 limit, 4th rejected with 409)', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupRenewTestData(client);

    // Mượn 1 cuốn
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

    assert.strictEqual(loan.renewCount, 0);

    // Gia hạn lần 1
    const rnw1 = await withTransaction(client, async (tx) => {
      return await renewLoanReceipt(tx, { receiptId: loan.id }, data.adminId);
    });
    assert.strictEqual(rnw1.renewCount, 1);
    assert.strictEqual(rnw1.renewalSequence, 1);

    // Gia hạn lần 2
    const rnw2 = await withTransaction(client, async (tx) => {
      return await renewLoanReceipt(tx, { receiptId: loan.id }, data.adminId);
    });
    assert.strictEqual(rnw2.renewCount, 2);

    // Gia hạn lần 3
    const rnw3 = await withTransaction(client, async (tx) => {
      return await renewLoanReceipt(tx, { receiptId: loan.id }, data.adminId);
    });
    assert.strictEqual(rnw3.renewCount, 3);

    // Gia hạn lần 4 -> Phải bị từ chối 409 MaxRenewalsExceededError
    await assert.rejects(
      async () => {
        await withTransaction(client, async (tx) => {
          return await renewLoanReceipt(tx, { receiptId: loan.id }, data.adminId);
        });
      },
      (err: any) => {
        assert.ok(err instanceof MaxRenewalsExceededError || err.code === 'MAX_RENEWALS_EXCEEDED');
        assert.strictEqual(err.httpStatus, 409);
        return true;
      }
    );

    // Kiểm tra bảng loan_renewals trong PostgreSQL
    const renewalsRes = await client.query(
      `SELECT renewal_sequence, previous_due_date, new_due_date FROM loan_renewals WHERE receipt_id = $1 ORDER BY renewal_sequence ASC`,
      [loan.id]
    );
    assert.strictEqual(renewalsRes.rows.length, 3);
  });
});

test('G-renew-db 2: Overdue renewal in PostgreSQL (+14d from today, fine decision recorded, cash drawer updated)', async () => {
  await harness.withClient(async (client: Client) => {
    const data = await setupRenewTestData(client);

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

    // Cố ý chỉnh due_date về 5 ngày trước
    await client.query(
      `UPDATE loan_receipts SET due_date = CURRENT_DATE - INTERVAL '5 days', status = 'OVERDUE' WHERE id = $1`,
      [loan.id]
    );

    const drawerBeforeRes = await client.query(`SELECT expected_closing_cash FROM cash_sessions WHERE id = $1`, [data.sessionId]);
    const drawerBefore = BigInt(drawerBeforeRes.rows[0].expected_closing_cash);

    // Gia hạn quá hạn có xác nhận thu phạt tiền mặt
    const rnw = await withTransaction(client, async (tx) => {
      return await renewLoanReceipt(
        tx,
        {
          receiptId: loan.id,
          finePaymentMethod: 'CASH',
          finePaymentConfirmed: true,
          notes: 'Gia hạn quá hạn 5 ngày trên PG',
        },
        data.adminId
      );
    });

    assert.strictEqual(rnw.isOverdue, true);
    assert.strictEqual(rnw.overdueDays, 5);
    assert.strictEqual(rnw.fineFinal, 5000);
    assert.strictEqual(rnw.fineCollected, true);

    // Hộp tiền mặt tăng 5.000₫
    const drawerAfterRes = await client.query(`SELECT expected_closing_cash FROM cash_sessions WHERE id = $1`, [data.sessionId]);
    const drawerAfter = BigInt(drawerAfterRes.rows[0].expected_closing_cash);
    assert.strictEqual(drawerAfter, drawerBefore + 5000n);

    // Kiểm tra bút toán sổ cái trên PostgreSQL
    const jeRes = await client.query(
      `SELECT entry_code, amount, debit_account, credit_account FROM journal_entries WHERE source_id IN (SELECT id::text FROM loan_renewals WHERE receipt_id = $1) AND source_type = 'LOAN_FINE'`,
      [loan.id]
    );
    assert.strictEqual(jeRes.rows.length, 1);
    assert.strictEqual(BigInt(jeRes.rows[0].amount), 5000n);
  });
});
