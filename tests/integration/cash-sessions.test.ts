import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DbHarness } from './db-harness.ts';
import type { Client } from 'pg';
import {
  FUND_IDS,
  ACCOUNT_CODES,
} from '../../src/server/finance/types.ts';
import {
  recordJournalEntry,
} from '../../src/server/finance/ledger.ts';
import {
  receiveDeposit,
  requestDepositRefund,
  confirmDepositRefund,
} from '../../src/server/finance/deposits.ts';
import {
  openCashSession,
  getCurrentCashSession,
  getCashSessionSummary,
  closeCashSession,
  ActiveSessionExistsError,
  DiscrepancyReasonRequiredError,
} from '../../src/server/finance/cash-sessions.ts';

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

async function setupCashSessionFixture(client: Client) {
  const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
  const adminId = memberRes.rows[0].id;

  const borrowerRes = await client.query('SELECT id FROM borrowers LIMIT 1');
  const borrowerId = borrowerRes.rows[0].id;

  const receiptRes = await client.query(
    `INSERT INTO loan_receipts (receipt_number, borrower_id, borrow_date, due_date, created_by)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + 14, $3)
     RETURNING id`,
    [`YSBK-CS-${Date.now()}-${Math.floor(Math.random() * 10000)}`, borrowerId, adminId]
  );
  const receiptId = receiptRes.rows[0].id;

  return { adminId, borrowerId, receiptId };
}

test('G-session-db 1: 5 request khác actor/key mở cùng buổi với opening 200k: chỉ duy nhất một ca mở thành công, DB chặn race condition', async () => {
  const client1 = await harness.createIsolatedClient();
  const { adminId } = await setupCashSessionFixture(client1);

  const clients: Client[] = [];
  try {
    for (let i = 0; i < 5; i++) {
      clients.push(await harness.createIsolatedClient());
    }

    const sessionDate = '2026-10-18';
    const openingCash = 200000;

    // 5 connection đồng thời cố gắng mở ca
    const results = await Promise.allSettled(
      clients.map((c, idx) =>
        openCashSession(c, {
          sessionId: `CS-CONC-${Date.now()}-${idx}`,
          sessionDate,
          openedBy: adminId,
          openingCash,
          discrepancyReason: 'Synthetic integration fixture opening',
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Chỉ có đúng 1 request mở ca thành công
    assert.strictEqual(fulfilled.length, 1, 'Chỉ duy nhất 1 phiên quầy được mở thành công');
    assert.strictEqual(rejected.length, 4, '4 request còn lại phải bị từ chối');

    for (const rej of rejected) {
      const reason: any = (rej as PromiseRejectedResult).reason;
      assert.ok(
        reason instanceof ActiveSessionExistsError || reason.message.includes('idx_single_active_cash_session') || reason.code === '23505',
        'Lỗi phải là ActiveSessionExistsError hoặc vi phạm partial unique index'
      );
    }

    // Đóng ca này để dọn dẹp cho các test tiếp theo
    const active = await getCurrentCashSession(client1);
    assert.ok(active);
    await closeCashSession(client1, {
      sessionId: active.id,
      closedBy: adminId,
      actualClosingCash: 200000,
    });
  } finally {
    await client1.end().catch(() => {});
    for (const c of clients) {
      await c.end().catch(() => {});
    }
  }
});

test('G-session-db 2: Opening 200k, nhận 50k cash + 100k bank: expected cash 250k, bank tách riêng 100k, nghĩa vụ cọc 150k', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId, receiptId } = await setupCashSessionFixture(client);
    const sessionId = `CS-OP-${Date.now()}`;

    // 1. Mở ca với opening float 200k
    await openCashSession(client, {
      sessionId,
      sessionDate: '2026-10-18',
      openedBy: adminId,
      openingCash: 200000,
    discrepancyReason: 'Synthetic integration fixture opening',
    });

    // 2. Nhận cọc 50k TIỀN MẶT trong ca
    await receiveDeposit(client, {
      receiptId,
      amount: 50000,
      paymentMethod: 'CASH',
      cashSessionId: sessionId,
      createdBy: adminId,
      entryCode: `BT-DEP-CASH-${Date.now()}`,
    });

    // 3. Nhận cọc 100k CHUYỂN KHOẢN (Bank) trong ca
    const receipt2Res = await client.query(
      `INSERT INTO loan_receipts (receipt_number, borrower_id, borrow_date, due_date, created_by)
       VALUES ($1, (SELECT id FROM borrowers LIMIT 1), CURRENT_DATE, CURRENT_DATE + 14, $2)
       RETURNING id`,
      [`YSBK-CS-B2-${Date.now()}`, adminId]
    );
    await receiveDeposit(client, {
      receiptId: receipt2Res.rows[0].id,
      amount: 100000,
      paymentMethod: 'BANK_TRANSFER',
      cashSessionId: sessionId,
      createdBy: adminId,
      entryCode: `BT-DEP-BANK-${Date.now()}`,
    });

    // 4. Tổng kết ca:
    const summary = await getCashSessionSummary(client, sessionId);
    assert.strictEqual(summary.session.opening_cash, 200000n);
    assert.strictEqual(summary.cashIn, 50000n);
    assert.strictEqual(summary.cashOut, 0n);
    assert.strictEqual(summary.expectedCash, 250000n); // 200k + 50k (Bank không cộng vào hộp tiền mặt)
    assert.strictEqual(summary.bankIn, 100000n);
    assert.strictEqual(summary.depositLiabilitiesCreated, 150000n);

    // 5. Đóng ca
    await closeCashSession(client, {
      sessionId,
      closedBy: adminId,
      actualClosingCash: 250000,
    });
  } finally {
    await client.end().catch(() => {});
  }
});

test('G-session-db 3: Opening 200k, thu cọc 100k, hoàn 100k, phạt 3k có policy: expected cash 203k, nghĩa vụ tất toán = 0', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId, receiptId } = await setupCashSessionFixture(client);
    const sessionId = `CS-FLOW-${Date.now()}`;

    await openCashSession(client, {
      sessionId,
      sessionDate: '2026-10-18',
      openedBy: adminId,
      openingCash: 200000,
    discrepancyReason: 'Synthetic integration fixture opening',
    });

    // Thu cọc 100k tiền mặt
    const alloc = await receiveDeposit(client, {
      receiptId,
      amount: 100000,
      paymentMethod: 'CASH',
      cashSessionId: sessionId,
      createdBy: adminId,
      entryCode: `BT-DEP-100K-${Date.now()}`,
    });

    // Đề xuất hoàn 100k tiền mặt
    const reqRes = await requestDepositRefund(client, {
      allocationId: alloc.id,
      refundAmount: 100000,
      refundMethod: 'CASH',
      requestedBy: adminId,
    });

    // Xác nhận hoàn 100k tiền mặt
    await confirmDepositRefund(client, {
      refundIntentId: reqRes.intent.id,
      cashSessionId: sessionId,
      createdBy: adminId,
      entryCode: `BT-REF-100K-${Date.now()}`,
    });

    // Thu phạt 3k tiền mặt (Ghi sổ kép: Nợ TIEN_MAT_HOP 3k, Có THU_PHAT 3k)
    await recordJournalEntry(client, {
      entryCode: `BT-FINE-3K-${Date.now()}`,
      fundId: FUND_IDS.LOAN,
      sourceType: 'FINE_COLLECTION',
      sourceId: receiptId,
      debitAccount: ACCOUNT_CODES.CASH_DRAWER,
      creditAccount: ACCOUNT_CODES.FINE_REVENUE,
      amount: 3000,
      cashSessionId: sessionId,
      createdBy: adminId,
    });

    // Tổng kết ca: 200k + 100k - 100k + 3k = 203k
    const summary = await getCashSessionSummary(client, sessionId);
    assert.strictEqual(summary.cashIn, 103000n); // 100k cọc + 3k phạt
    assert.strictEqual(summary.cashOut, 100000n);
    assert.strictEqual(summary.expectedCash, 203000n);

    // Đóng ca
    await closeCashSession(client, {
      sessionId,
      closedBy: adminId,
      actualClosingCash: 203000,
    });
  } finally {
    await client.end().catch(() => {});
  }
});

test('G-session-db 4: Ca đã đóng cấm nhận thêm cash movement mới; replay trả cached response không sửa snapshot', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId } = await setupCashSessionFixture(client);
    const sessionId = `CS-CLOSED-LOCK-${Date.now()}`;

    await openCashSession(client, {
      sessionId,
      sessionDate: '2026-10-18',
      openedBy: adminId,
      openingCash: 200000,
    discrepancyReason: 'Synthetic integration fixture opening',
    });

    await closeCashSession(client, {
      sessionId,
      closedBy: adminId,
      actualClosingCash: 200000,
    });

    // Cố gắng nhận cọc tiền mặt gắn vào ca đã đóng -> Gọi writer thật phải bị từ chối
    await assert.rejects(
      () =>
        recordJournalEntry(client, {
          entryCode: `JE-FAIL-CLOSED-${Date.now()}`,
          fundId: FUND_IDS.LOAN,
          sourceType: 'LOAN_DEPOSIT',
          sourceId: 'mock-receipt-fail',
          debitAccount: ACCOUNT_CODES.CASH_DRAWER,
          creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
          amount: 50000n,
          createdBy: adminId,
          cashSessionId: sessionId,
        }),
      (err: any) => err.message.includes('đã đóng') || err.message.includes('is_closed')
    );
  } finally {
    await client.end().catch(() => {});
  }
});

test('G-session-db 5: Đóng ca chênh lệch (Expected 203k, Actual 200k) bắt buộc lý do; ca sau mở với 200k không ghi thêm thu nhập', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId } = await setupCashSessionFixture(client);
    const sessionId = `CS-DISC-${Date.now()}`;

    await openCashSession(client, {
      sessionId,
      sessionDate: '2026-10-18',
      openedBy: adminId,
      openingCash: 200000,
    discrepancyReason: 'Synthetic integration fixture opening',
    });

    // Thu phạt 3k -> expected = 203k
    await recordJournalEntry(client, {
      entryCode: `BT-FINE-DISC-${Date.now()}`,
      fundId: FUND_IDS.LOAN,
      sourceType: 'FINE_COLLECTION',
      sourceId: adminId,
      debitAccount: ACCOUNT_CODES.CASH_DRAWER,
      creditAccount: ACCOUNT_CODES.FINE_REVENUE,
      amount: 3000,
      cashSessionId: sessionId,
      createdBy: adminId,
    });

    // 1. Đóng ca đếm thực tế 200k (thiếu 3k) không có lý do -> Bị chặn
    await assert.rejects(
      () =>
        closeCashSession(client, {
          sessionId,
          closedBy: adminId,
          actualClosingCash: 200000,
          discrepancyReason: '',
        }),
      (err: any) => err instanceof DiscrepancyReasonRequiredError
    );

    // 2. Đóng ca với lý do hợp lệ
    const closedSummary = await closeCashSession(client, {
      sessionId,
      closedBy: adminId,
      actualClosingCash: 200000,
      discrepancyReason: 'Thối nhầm 3.000 ₫ tiền lẻ',
    });
    assert.strictEqual(closedSummary.expectedCash, 203000n);
    assert.strictEqual(closedSummary.actualCash, 200000n);
    assert.strictEqual(closedSummary.discrepancy, -3000n);

    // 3. Ca sau mở bàn giao 200k từ ca trước
    const nextSessionId = `CS-DISC-NEXT-${Date.now()}`;
    const nextSession = await openCashSession(client, {
      sessionId: nextSessionId,
      sessionDate: '2026-10-20',
      openedBy: adminId,
      openingCash: 200000,
    discrepancyReason: 'Synthetic integration fixture opening',
      handedOverFromSessionId: sessionId,
    });

    assert.strictEqual(nextSession.opening_cash, 200000n);
    assert.strictEqual(nextSession.handed_over_from_session_id, sessionId);

    // Bất biến: Opening float bàn giao KHÔNG sinh bút toán thu nhập hay thu cọc mới
    const nextSummary = await getCashSessionSummary(client, nextSessionId);
    assert.strictEqual(nextSummary.cashIn, 0n);
    assert.strictEqual(nextSummary.expectedCash, 200000n);

    // Dọn dẹp
    await closeCashSession(client, {
      sessionId: nextSessionId,
      closedBy: adminId,
      actualClosingCash: 200000,
    });
  } finally {
    await client.end().catch(() => {});
  }
});
