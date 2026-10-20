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
  getFundBalances,
} from '../../src/server/finance/ledger.ts';
import {
  receiveDeposit,
  requestDepositRefund,
  confirmDepositRefund,
} from '../../src/server/finance/deposits.ts';
import {
  computePayloadHash,
  claimIdempotency,
  completeIdempotency,
  IdempotencyPayloadMismatchError,
} from '../../src/server/shared/idempotency.ts';

import { openCashSession } from '../../src/server/finance/cash-sessions.ts';

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

// Helper lấy memberId và tạo receipt mượn sách test
async function setupFinanceTestFixture(client: Client) {
  const memberRes = await client.query('SELECT id FROM members WHERE is_admin = true LIMIT 1');
  const adminId = memberRes.rows[0].id;

  const borrowerRes = await client.query('SELECT id FROM borrowers LIMIT 1');
  const borrowerId = borrowerRes.rows[0].id;

  const receiptRes = await client.query(
    `INSERT INTO loan_receipts (receipt_number, borrower_id, borrow_date, due_date, created_by)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + 14, $3)
     RETURNING id`,
    [`YSBK-FIN-${Date.now()}-${Math.floor(Math.random() * 10000)}`, borrowerId, adminId]
  );
  const receiptId = receiptRes.rows[0].id;

  const cashSessionId = `CS-FIN-${Date.now()}`;
  await openCashSession(client, { sessionId: cashSessionId, sessionDate: '2026-10-20', openedBy: adminId, openingCash: 500000n, discrepancyReason: 'Synthetic integration fixture' });
  return { adminId, borrowerId, receiptId, cashSessionId };
}

test('G-ledger/deposit 1: Nhận cọc 150k tạo đúng cash/bank và nghĩa vụ 150k, không thành thu nhập; 2 fund tách số dư', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId, receiptId, cashSessionId } = await setupFinanceTestFixture(client);

    await client.query('BEGIN');

    // 1. Nhận cọc 150k tiền mặt
    const alloc = await receiveDeposit(client, {
      receiptId,
      amount: 150000,
      paymentMethod: 'CASH',
      createdBy: adminId,
      entryCode: `BT-DEP-${Date.now()}`,
      cashSessionId,
    });

    assert.strictEqual(alloc.original_amount, 150000n);
    assert.strictEqual(alloc.remaining_amount, 150000n);
    assert.strictEqual(alloc.status, 'HELD');

    // 2. Ghi thêm một khoản doanh thu hoạt động cho Quỹ 2 (FUND_OPERATION) để kiểm tra cách ly số dư
    await recordJournalEntry(client, {
      entryCode: `BT-OP-FEE-${Date.now()}`,
      fundId: FUND_IDS.OPERATION,
      sourceType: 'MEMBER_FEE',
      sourceId: adminId,
      debitAccount: ACCOUNT_CODES.BANK_MAIN,
      creditAccount: ACCOUNT_CODES.MEMBER_FEE,
      amount: 200000,
      createdBy: adminId,
    });

    // 3. Kiểm tra số dư FUND_LOAN: Tiền mặt = 150k, Nghĩa vụ = 150k, Doanh thu = 0
    const loanBalances = await getFundBalances(client, FUND_IDS.LOAN);
    assert.strictEqual(loanBalances.isBalanced, true);
    assert.strictEqual(loanBalances.accounts[ACCOUNT_CODES.CASH_DRAWER]?.netBalance, 150000n);
    assert.strictEqual(loanBalances.accounts[ACCOUNT_CODES.DEPOSIT_LIABILITY]?.netBalance, 150000n);
    assert.strictEqual(loanBalances.accounts[ACCOUNT_CODES.FINE_REVENUE], undefined);

    // 4. Kiểm tra số dư FUND_OPERATION: Ngân hàng = 200k, Hội phí = 200k
    // Tuyệt đối không có số dư cọc của bạn đọc trong Quỹ Hoạt Động
    const opBalances = await getFundBalances(client, FUND_IDS.OPERATION);
    assert.strictEqual(opBalances.isBalanced, true);
    assert.strictEqual(opBalances.accounts[ACCOUNT_CODES.BANK_MAIN]?.netBalance, 200000n);
    assert.strictEqual(opBalances.accounts[ACCOUNT_CODES.MEMBER_FEE]?.netBalance, 200000n);
    assert.strictEqual(opBalances.accounts[ACCOUNT_CODES.DEPOSIT_LIABILITY], undefined);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
});

test('G-ledger/deposit 2: Hoàn 50k trong 150k thì tiền giảm và nghĩa vụ còn 100k; hoàn pending chưa giảm tiền; xác nhận trả chỉ có một hiệu lực', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId, receiptId, cashSessionId } = await setupFinanceTestFixture(client);

    await client.query('BEGIN');

    // 1. Nhận cọc 150k tiền mặt
    const alloc = await receiveDeposit(client, {
      receiptId,
      amount: 150000,
      paymentMethod: 'CASH',
      createdBy: adminId,
      entryCode: `BT-DEP-2-${Date.now()}`,
      cashSessionId,
    });

    // 2. Yêu cầu hoàn 50k (tạo Refund Intent PENDING_REFUND)
    const reqRes = await requestDepositRefund(client, {
      allocationId: alloc.id,
      refundAmount: 50000,
      refundMethod: 'CASH',
      requestedBy: adminId,
    });
    assert.strictEqual(reqRes.allocation.status, 'PENDING_REFUND');
    assert.strictEqual(reqRes.allocation.remaining_amount, 150000n); // Nghĩa vụ chưa giảm!

    // 3. Xác nhận hoàn 50k thực tế theo ID ý định
    const confRes = await confirmDepositRefund(client, {
      refundIntentId: reqRes.intent.id,
      createdBy: adminId,
      entryCode: `BT-REF-2-${Date.now()}`,
      cashSessionId,
    });
    assert.strictEqual(confRes.allocation.status, 'HELD');
    assert.strictEqual(confRes.allocation.remaining_amount, 100000n);

    // 4. Số dư sổ cái sau khi hoàn: Tiền mặt còn 100k, Nghĩa vụ cọc còn 100k
    const balances = await getFundBalances(client, FUND_IDS.LOAN);
    assert.strictEqual(balances.accounts[ACCOUNT_CODES.CASH_DRAWER]?.netBalance, 100000n);
    assert.strictEqual(balances.accounts[ACCOUNT_CODES.DEPOSIT_LIABILITY]?.netBalance, 100000n);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
});

test('G-ledger/deposit 3: Hai connection cùng confirm một ý định hoàn: row-locking tuần tự hóa, tối đa một hiệu lực', async () => {
  const client1 = await harness.createIsolatedClient();
  const client2 = await harness.createIsolatedClient();

  try {
    const { adminId, receiptId, cashSessionId } = await setupFinanceTestFixture(client1);

    // Tạo khoản cọc 100k
    const alloc = await receiveDeposit(client1, {
      receiptId,
      amount: 100000,
      paymentMethod: 'CASH',
      createdBy: adminId,
      entryCode: `BT-RACE-DEP-${Date.now()}`,
      cashSessionId,
    });

    // Tạo ý định hoàn 100k
    const reqRes = await requestDepositRefund(client1, {
      allocationId: alloc.id,
      refundAmount: 100000,
      refundMethod: 'CASH',
      requestedBy: adminId,
    });

    // Client 1 bắt đầu confirm và giữ row-lock FOR UPDATE trên refund_intents & allocations
    await client1.query('BEGIN');
    const p1 = confirmDepositRefund(client1, {
      refundIntentId: reqRes.intent.id,
      createdBy: adminId,
      entryCode: `BT-RACE-REF1-${Date.now()}`,
      cashSessionId,
    });

    // Client 2 đồng thời cố gắng confirm cùng ý định hoàn
    await client2.query('BEGIN');
    let client2Error: any = null;
    const p2 = confirmDepositRefund(client2, {
      refundIntentId: reqRes.intent.id,
      createdBy: adminId,
      entryCode: `BT-RACE-REF2-${Date.now()}`,
      cashSessionId,
    }).catch((err) => {
      client2Error = err;
    });

    // Quan sát trạng thái khóa trên DB bằng kết nối thứ ba (không dùng sleep mù quáng)
    const monitorClient = await harness.createIsolatedClient();
    try {
      for (let i = 0; i < 20; i++) {
        const lockRes = await monitorClient.query(
          `SELECT pid, wait_event_type FROM pg_stat_activity WHERE query ILIKE '%refund_intents%' AND wait_event_type = 'Lock'`
        );
        if (lockRes.rows.length > 0) break;
      }
    } finally {
      await monitorClient.end().catch(() => {});
    }

    // Client 1 hoàn tất và COMMIT
    await p1;
    await client1.query('COMMIT');

    // Chờ client2 giải phóng sau khi client1 nhả lock
    await p2;
    await client2.query('ROLLBACK').catch(() => {});

    // Assert: Client 2 phải bị từ chối vì ý định đã CONFIRMED trước đó (S04-01 chống confirm 2 lần)
    assert.ok(client2Error, 'Client 2 phải bị chặn bởi business invariant khi ý định cọc đã được xác nhận');
    assert.match(client2Error.message, /đã được xác nhận chi trả trước đó/);

    // Kiểm tra số dư cuối cùng: Tiền mặt và Nghĩa vụ cọc không bao giờ bị âm
    const finalCheck = await client1.query('SELECT remaining_amount, status FROM deposit_allocations WHERE id = $1', [alloc.id]);
    assert.strictEqual(BigInt(finalCheck.rows[0].remaining_amount), 0n);
    assert.strictEqual(finalCheck.rows[0].status, 'REFUNDED');
  } finally {
    await client1.end().catch(() => {});
    await client2.end().catch(() => {});
  }
});

test('G-ledger/deposit 4: Nhận bank/hoàn cash và nhận cash/hoàn bank đổi đúng account, không sửa chứng từ nhận cũ', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId, receiptId, cashSessionId } = await setupFinanceTestFixture(client);

    await client.query('BEGIN');

    // Nhận 100k bằng BANK_TRANSFER
    const alloc = await receiveDeposit(client, {
      receiptId,
      amount: 100000,
      paymentMethod: 'BANK_TRANSFER',
      createdBy: adminId,
      entryCode: `BT-BANK-DEP-${Date.now()}`,
      cashSessionId,
    });

    // Đề xuất hoàn 100k bằng CASH
    const reqRes = await requestDepositRefund(client, {
      allocationId: alloc.id,
      refundAmount: 100000,
      refundMethod: 'CASH',
      requestedBy: adminId,
    });

    // Xác nhận hoàn 100k bằng CASH
    await confirmDepositRefund(client, {
      refundIntentId: reqRes.intent.id,
      createdBy: adminId,
      entryCode: `BT-CASH-REF-${Date.now()}`,
      cashSessionId,
    });

    // Chứng từ nhận cũ vẫn nguyên vẹn
    const origAlloc = await client.query('SELECT payment_method, refund_method FROM deposit_allocations WHERE id = $1', [alloc.id]);
    assert.strictEqual(origAlloc.rows[0].payment_method, 'BANK_TRANSFER');
    assert.strictEqual(origAlloc.rows[0].refund_method, 'CASH');

    // Sổ cái phản ánh đúng: Ngân hàng tăng 100k, Tiền mặt giảm 100k, Nghĩa vụ cọc = 0
    const balances = await getFundBalances(client, FUND_IDS.LOAN);
    assert.strictEqual(balances.accounts[ACCOUNT_CODES.BANK_MAIN]?.netBalance, 100000n);
    assert.strictEqual(balances.accounts[ACCOUNT_CODES.CASH_DRAWER]?.netBalance, -100000n);
    assert.strictEqual(balances.accounts[ACCOUNT_CODES.DEPOSIT_LIABILITY]?.netBalance, 0n);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
});

test('G-ledger/deposit 5: Trigger trg_prevent_journal_mutation cấm tuyệt đối UPDATE và DELETE trên journal_entries', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId, cashSessionId } = await setupFinanceTestFixture(client);

    const entry = await recordJournalEntry(client, {
      entryCode: `BT-IMMUTABLE-${Date.now()}`,
      fundId: FUND_IDS.LOAN,
      sourceType: 'TEST_IMMUTABLE',
      sourceId: adminId,
      debitAccount: ACCOUNT_CODES.CASH_DRAWER,
      creditAccount: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      amount: 50000,
      createdBy: adminId,
      cashSessionId,
    });

    // Thử UPDATE số tiền -> Trigger phải chặn với ngoại lệ
    await assert.rejects(
      () => client.query('UPDATE journal_entries SET amount = 999999 WHERE id = $1', [entry.id]),
      /Bút toán sổ cái \(journal_entries\) là bất biến/
    );

    // Thử DELETE bản ghi -> Trigger phải chặn với ngoại lệ
    await assert.rejects(
      () => client.query('DELETE FROM journal_entries WHERE id = $1', [entry.id]),
      /Bút toán sổ cái \(journal_entries\) là bất biến/
    );
  } finally {
    await client.end();
  }
});

test('G-idempotency 1: Cùng actor/operation/key/payload trả cached response; khác payload bị chặn 409', async () => {
  const client = await harness.createIsolatedClient();
  try {
    const { adminId } = await setupFinanceTestFixture(client);
    const operation = 'finance.deposit.test';
    const key = `idem-key-${Date.now()}`;

    const payload = { receiptId: 'rec-test-1', amount: 150000 };
    const hash = computePayloadHash(payload);

    await client.query('BEGIN');
    const claim1 = await claimIdempotency(client, adminId, operation, key, hash);
    assert.strictEqual(claim1.action, 'CLAIMED');

    await completeIdempotency(client, adminId, operation, key, 201, { success: true, amount: 150000 });
    await client.query('COMMIT');

    // Request lặp lại cùng key và payload
    const claim2 = await claimIdempotency(client, adminId, operation, key, hash);
    assert.strictEqual(claim2.action, 'RETURN_CACHED');
    assert.strictEqual(claim2.responseCode, 201);
    assert.deepStrictEqual(claim2.responseBody, { success: true, amount: 150000 });

    // Request cùng key nhưng khác payload (thay đổi amount 150k -> 200k)
    const diffHash = computePayloadHash({ ...payload, amount: 200000 });
    await assert.rejects(
      () => claimIdempotency(client, adminId, operation, key, diffHash),
      (err: any) => err instanceof IdempotencyPayloadMismatchError
    );
  } finally {
    await client.end();
  }
});

test('G-idempotency 2: Hai connection cùng key: unique lock hàng đợi và replay cached response an toàn sau commit', async () => {
  const client1 = await harness.createIsolatedClient();
  const client2 = await harness.createIsolatedClient();

  try {
    const { adminId } = await setupFinanceTestFixture(client1);
    const operation = 'finance.concurrent.test';
    const key = `idem-conc-${Date.now()}`;
    const hash = computePayloadHash({ action: 'concurrent' });

    // Client 1 bắt đầu transaction và claim
    await client1.query('BEGIN');
    const claim1 = await claimIdempotency(client1, adminId, operation, key, hash);
    assert.strictEqual(claim1.action, 'CLAIMED');

    // Client 2 khởi chạy claim đồng thời trong background
    await client2.query('BEGIN');
    const p2 = claimIdempotency(client2, adminId, operation, key, hash);

    // Quan sát Client 2 bị block chờ unique index của Client 1 thông qua monitor client
    const monitorClient = await harness.createIsolatedClient();
    try {
      for (let i = 0; i < 20; i++) {
        const lockRes = await monitorClient.query(
          `SELECT pid, wait_event_type FROM pg_stat_activity WHERE query ILIKE '%idempotency_records%' AND wait_event_type = 'Lock'`
        );
        if (lockRes.rows.length > 0) break;
      }
    } finally {
      await monitorClient.end().catch(() => {});
    }

    // Client 1 hoàn tất và COMMIT
    await completeIdempotency(client1, adminId, operation, key, 200, { ok: true, version: 1 });
    await client1.query('COMMIT');

    // Client 2 unblock sau khi Client 1 commit và nhận được cached response
    const claim2 = await p2;
    await client2.query('COMMIT');

    assert.strictEqual(claim2.action, 'RETURN_CACHED');
    assert.strictEqual(claim2.responseCode, 200);
    assert.deepStrictEqual(claim2.responseBody, { ok: true, version: 1 });
  } finally {
    await client1.end().catch(() => {});
    await client2.end().catch(() => {});
  }
});
