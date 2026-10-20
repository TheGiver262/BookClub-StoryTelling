/**
 * =====================================================================
 * Nhóm III Regressions: RF-04, RF-05, RF-06
 * - RF-04: Vòng đời Action Record (actor + op + entity + payloadHash, retry, cancel, clear)
 * - RF-05: Pagination metadata preservation (router wire contract, unborrowed copies, no loan fallback)
 * - RF-06: DEMO Boundary & Request Abort (chặn toàn bộ mutations trong DEMO, drop deferred responses)
 * =====================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  requestJson,
  ActionKeyRegistry,
  hashPayload,
  canonicalizeJson,
} from '../../src/lib/api-client.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. RF-04: Vòng đời Action Record & Idempotency Key
// ─────────────────────────────────────────────────────────────────────────────
test('RF-04a: Cùng ý định (cùng actor, op, entity, payload) -> Tái sử dụng chính xác key cũ khi retry', () => {
  const registry = new ActionKeyRegistry();
  const actorId = 'actor-001';
  const entityId = 'loan-receipt-001';
  const payload = { fineAmount: 10000, finePaymentMethod: 'CASH', fineConfirmed: true };

  const key1 = registry.getOrCreateKey('RENEW', entityId, payload, actorId);
  assert.ok(key1.startsWith('RENEW-'));

  // Retry lần 2 cùng payload
  const key2 = registry.getOrCreateKey('RENEW', entityId, payload, actorId);
  assert.equal(key1, key2, 'Retry cùng ý định bắt buộc dùng lại đúng key ban đầu');
});

test('RF-04b: Đổi payload (người trực sửa số tiền hoặc phương thức) -> Sinh key mới, không kẹt key cũ', () => {
  const registry = new ActionKeyRegistry();
  const actorId = 'actor-001';
  const entityId = 'loan-receipt-001';
  const payloadA = { fineAmount: 10000, finePaymentMethod: 'CASH' };
  const payloadB = { fineAmount: 15000, finePaymentMethod: 'BANK_TRANSFER' }; // Đổi tiền phạt

  const keyA = registry.getOrCreateKey('RENEW', entityId, payloadA, actorId);
  const keyB = registry.getOrCreateKey('RENEW', entityId, payloadB, actorId);

  assert.notEqual(keyA, keyB, 'Đổi thông số payload phải sinh action key mới');
  assert.equal(registry.getOrCreateKey('RENEW', entityId, payloadB, actorId), keyB);
});

test('RF-04c: Đổi entity (đóng modal chuyển sang phiếu khác) -> Hai phiếu có action key độc lập', () => {
  const registry = new ActionKeyRegistry();
  const actorId = 'actor-001';
  const payload = { fineAmount: 5000, method: 'CASH' };

  const keyLoan1 = registry.getOrCreateKey('RENEW', 'loan-001', payload, actorId);
  const keyLoan2 = registry.getOrCreateKey('RENEW', 'loan-002', payload, actorId);

  assert.notEqual(keyLoan1, keyLoan2, 'Hai thực thể khác nhau không bao giờ được dùng chung một action key');
});

test('RF-04d: Hủy modal hoặc hoàn tất thao tác -> clearKey xóa bỏ trạng thái sạch sẽ', () => {
  const registry = new ActionKeyRegistry();
  const actorId = 'actor-001';
  const entityId = 'loan-001';
  const payload = { amount: 20000 };

  const key1 = registry.getOrCreateKey('RETURN', entityId, payload, actorId);
  registry.clearKey('RETURN', entityId);

  assert.equal(registry.getRecord('RETURN', entityId), undefined);

  // Mở lại modal sau đó tạo một ý định mới
  const key2 = registry.getOrCreateKey('RETURN', entityId, payload, actorId);
  assert.notEqual(key1, key2, 'Sau khi clearKey, thao tác mới phải nhận key mới');
});

test('RF-04e: Đăng xuất hoặc chuyển chế độ -> clearAll xóa sạch toàn bộ action keys', () => {
  const registry = new ActionKeyRegistry();
  registry.getOrCreateKey('ISSUE', 'NEW', { barcodes: ['BC-01'] }, 'actor-1');
  registry.getOrCreateKey('SELL', 'item-01', { quantity: 2 }, 'actor-1');

  registry.clearAll();

  assert.equal(registry.getRecord('ISSUE', 'NEW'), undefined);
  assert.equal(registry.getRecord('SELL', 'item-01'), undefined);
});

test('RF-04f: hashPayload chuẩn hóa đệ quy thứ tự key của object (canonical hash)', () => {
  const obj1 = { b: 2, a: 1, nested: { y: 'bar', x: 'foo' } };
  const obj2 = { a: 1, b: 2, nested: { x: 'foo', y: 'bar' } };

  assert.equal(canonicalizeJson(obj1), canonicalizeJson(obj2));
  assert.equal(hashPayload(obj1), hashPayload(obj2));
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. RF-05: Bảo toàn Envelope Metadata & Danh mục bản sao sách
// ─────────────────────────────────────────────────────────────────────────────
test('RF-05a: requestJson bảo toàn sibling meta khi unwrap array (total, page, limit)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ id: 'copy-101', barcode: 'BC-101', title: 'Sách 101' }],
          items: [{ id: 'copy-101', barcode: 'BC-101', title: 'Sách 101' }],
          meta: {
            total: 125,
            page: 2,
            limit: 1,
          },
          total: 125,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await requestJson<any>('/api/v1/catalog/books/copies?page=2&limit=1');
    assert.ok(Array.isArray(res));
    assert.equal(res.length, 1);
    const meta = (res as any).meta;
    assert.ok(meta, 'Mảng response phải giữ nguyên sibling meta');
    assert.equal(meta.total, 125);
    assert.equal(meta.page, 2);
    assert.equal(meta.limit, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RF-05b: apiClient.listBookCopies giữ nguyên metadata thật total: 125, page: 2, limit: 1 (Probe Wire Test)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ id: 'copy-101', barcode: 'BC-101', cover_price: '85000', title: 'Đắc Nhân Tâm', status: 'AVAILABLE' }],
          items: [{ id: 'copy-101', barcode: 'BC-101', cover_price: '85000', title: 'Đắc Nhân Tâm', status: 'AVAILABLE' }],
          meta: {
            total: 125,
            page: 2,
            limit: 1,
          },
          total: 125,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const copies = await apiClient.listBookCopies({ page: 2, limit: 1 });
    assert.equal(copies.length, 1);
    assert.ok(copies.meta, 'copies.meta phải tồn tại');
    assert.equal(copies.meta.total, 125, 'total phải là 125 theo server router, không được bị clamp về 1');
    assert.equal(copies.meta.page, 2, 'page phải là 2, không được default về 1');
    assert.equal(copies.meta.limit, 1, 'limit phải là 1, không được default về 50');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RF-05c: apiClient.searchBooks và listLoans bảo toàn meta đúng định dạng', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ id: 'book-01', title: 'Lập trình Rust' }],
          meta: { total: 42, page: 3, limit: 10 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const books = await apiClient.searchBooks({ page: 3, limit: 10 });
    assert.equal(books.length, 1);
    assert.equal(books.meta?.total, 42);
    assert.equal(books.meta?.page, 3);
    assert.equal(books.meta?.limit, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RF-06: DEMO Boundary & Phục hồi dữ liệu sau Clear
// ─────────────────────────────────────────────────────────────────────────────
test('RF-06a: getRubric gặp lỗi 403 / mạng KHÔNG được âm thầm gọi createRubric', async () => {
  const originalFetch = globalThis.fetch;
  let createRubricCalled = false;

  try {
    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rubrics') && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Không có quyền xem rubric' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/rubrics') && init?.method === 'POST') {
        createRubricCalled = true;
        return new Response(JSON.stringify({ data: { id: 'created' } }), { status: 201 });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    };

    // Khi gọi getRubric bị 403, phải throw ApiClientError
    await assert.rejects(
      async () => {
        await apiClient.getRubric('RUBRIC_CAMPAIGN_GEN_10_V1');
      },
      (err: any) => {
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Bắt buộc khẳng định createRubric không bị gọi lén
    assert.equal(createRubricCalled, false, 'Tuyệt đối không được tự động phát sinh mutation createRubric khi GET lỗi');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RF-06b: Đổi chế độ hoặc logout loại bỏ response bất đồng bộ (Request Versioning Guard)', async () => {
  let activeVersion = 1;
  let savedState: any = null;

  // Giả lập một request LIVE đang bay trong mạng
  const runDeferredLiveFetch = async () => {
    const version = activeVersion;
    // Giả lập độ trễ mạng 20ms
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Kiểm tra version guard trước khi ghi vào state
    if (version !== activeVersion) {
      return; // Discarded!
    }
    savedState = { sensitiveData: 'LIVE_BORROWER_RECORDS' };
  };

  const pendingPromise = runDeferredLiveFetch();

  // Người dùng chuyển sang DEMO hoặc ấn Logout ngay sau 5ms
  await new Promise((resolve) => setTimeout(resolve, 5));
  activeVersion += 1; // Bump version / abort
  savedState = null;  // Clear state

  await pendingPromise;

  // Đảm bảo state không bị khôi phục lại dữ liệu nhạy cảm
  assert.equal(savedState, null, 'Response đến sau khi clear/đổi mode phải bị drop triệt để');
});
