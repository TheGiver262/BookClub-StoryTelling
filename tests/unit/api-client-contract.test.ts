import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  apiClient, 
  unwrapData, 
  generateIdempotencyKey,
  ApiClientError 
} from '../../src/lib/api-client.ts';

describe('Đợt B — API Contract, Envelope Unwrap & Live/Demo Boundary', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. P22-03: Envelope & unwrapData Unit Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('P22-03: Canonical Envelope and unwrapData Helper', () => {
    it('bóc đúng dữ liệu khi payload bọc trong { data: ... }', () => {
      const input = { data: { id: 'sched-123', termSemester: '2026.1' } };
      const unwrapped = unwrapData<any>(input);
      assert.equal(unwrapped.id, 'sched-123');
      assert.equal(unwrapped.termSemester, '2026.1');
    });

    it('giữ nguyên dữ liệu nếu payload đã được unwrap hoặc không có wrapper data', () => {
      const plain = { id: 'evt-456', title: 'Hội sách Mùa Thu' };
      const unwrapped = unwrapData<any>(plain);
      assert.equal(unwrapped.id, 'evt-456');
      assert.equal(unwrapped.title, 'Hội sách Mùa Thu');
    });

    it('xử lý an toàn với null, undefined, primitive', () => {
      assert.equal(unwrapData(null), null);
      assert.equal(unwrapData(undefined), undefined);
      assert.equal(unwrapData('string-val'), 'string-val');
      assert.equal(unwrapData(12345), 12345);
    });

    it('giữ nguyên mảng khi payload là { data: [...] }', () => {
      const input = { data: [{ id: '1' }, { id: '2' }] };
      const unwrapped = unwrapData<any[]>(input);
      assert.ok(Array.isArray(unwrapped));
      assert.equal(unwrapped.length, 2);
      assert.equal(unwrapped[0].id, '1');
    });

    it('bảo toàn multi-part response khi payload có cả { data: { sale, updatedItem }, sale, updatedItem }', () => {
      const mockSale = { id: 'sale-001', quantity: 5, totalAmount: 400000 };
      const mockItem = { id: 'item-001', availableQuantity: 95 };
      const multiPart = {
        data: { sale: mockSale, updatedItem: mockItem },
        sale: mockSale,
        updatedItem: mockItem,
      };

      const unwrapped = unwrapData<any>(multiPart);
      assert.ok(unwrapped.sale, 'Phải có thuộc tính sale');
      assert.ok(unwrapped.updatedItem, 'Phải có thuộc tính updatedItem');
      assert.equal(unwrapped.sale.id, 'sale-001');
      assert.equal(unwrapped.sale.quantity, 5);
      assert.equal(unwrapped.updatedItem.availableQuantity, 95);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. P22-03: Adapter Method Calling & Anti-Undefined Contract
  // ───────────────────────────────────────────────────────────────────────────
  describe('P22-03: Caller Methods Contract (Duty, Recruitment, Sales, Events)', () => {
    it('apiClient.getDutyScheduleById không trả về undefined khi backend bọc { data: schedule }', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (_url: any) => {
          return new Response(JSON.stringify({
            data: {
              id: 'sched-999',
              termSemester: '2026.1',
              status: 'DRAFT',
              shiftDate: '2026-10-25',
              assignees: [],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        const result = await apiClient.getDutyScheduleById('sched-999');
        assert.ok(result, 'Kết quả không được null/undefined');
        assert.equal(result.id, 'sched-999', 'id phải lấy được, không được undefined');
        assert.equal(result.status, 'DRAFT');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('apiClient.listDutySchedules trả về mảng đầy đủ, không trả undefined', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify({
            data: [
              { id: 'sched-1', termSemester: '2026.1', status: 'PUBLISHED' },
              { id: 'sched-2', termSemester: '2026.1', status: 'DRAFT' },
            ],
            total: 2,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        const schedules = await apiClient.getDutySchedules('2026.1');
        assert.ok(Array.isArray(schedules), 'Phải là mảng');
        assert.equal(schedules.length, 2);
        assert.equal(schedules[0].id, 'sched-1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('apiClient.sellBook trả về đồng thời sale và updatedItem mà không nuốt sibling', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify({
            data: {
              sale: {
                id: 'sale-101',
                saleCode: 'BS-2026-001',
                quantity: 3,
                unitPrice: 80000,
                totalAmount: 240000,
                paymentMethod: 'CASH',
                paymentStatus: 'PAID',
              },
              updatedItem: {
                id: 'lot-item-55',
                bookTitle: 'Đắc Nhân Tâm',
                availableQuantity: 57,
              },
            },
            sale: {
              id: 'sale-101',
              saleCode: 'BS-2026-001',
              quantity: 3,
              unitPrice: 80000,
              totalAmount: 240000,
              paymentMethod: 'CASH',
              paymentStatus: 'PAID',
            },
            updatedItem: {
              id: 'lot-item-55',
              bookTitle: 'Đắc Nhân Tâm',
              availableQuantity: 57,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        const res = await apiClient.sellBook('lot-123', {
          lotItemId: 'lot-item-55',
          quantity: 3,
          paymentMethod: 'CASH',
        });

        assert.ok(res.sale, 'res.sale phải tồn tại');
        assert.equal(res.sale.quantity, 3);
        assert.equal(res.sale.totalAmount, 240000);
        assert.ok(res.updatedItem, 'res.updatedItem phải tồn tại không bị nuốt');
        assert.equal(res.updatedItem.availableQuantity, 57);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('apiClient.returnBooks trả về đồng thời returnReceipt và updatedItem', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify({
            data: {
              returnReceipt: {
                id: 'ret-001',
                returnCode: 'RET-2026-001',
                returnedQuantity: 10,
              },
              updatedItem: {
                id: 'lot-item-55',
                availableQuantity: 47,
                returnedQuantity: 10,
              },
            },
            returnReceipt: {
              id: 'ret-001',
              returnCode: 'RET-2026-001',
              returnedQuantity: 10,
            },
            updatedItem: {
              id: 'lot-item-55',
              availableQuantity: 47,
              returnedQuantity: 10,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        const res = await apiClient.returnBooks('lot-123', {
          lotItemId: 'lot-item-55',
          returnedQuantity: 10,
          returnDate: '2026-10-20',
        });

        assert.ok(res.returnReceipt, 'res.returnReceipt phải tồn tại');
        assert.equal(res.returnReceipt.returnedQuantity, 10);
        assert.ok(res.updatedItem, 'res.updatedItem phải tồn tại');
        assert.equal(res.updatedItem.availableQuantity, 47);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('lỗi HTTP từ server ném ApiClientError với đúng status và message, không fallback dữ liệu giả', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify({
            error: {
              code: 'LOT_ITEM_INSUFFICIENT_STOCK',
              message: 'Số lượng tồn không đủ để bán.',
            }
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        await assert.rejects(
          async () => {
            await apiClient.sellBook('lot-1', {
              lotItemId: 'item-1',
              quantity: 999,
              paymentMethod: 'CASH',
            });
          },
          (err: any) => {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.code, 'LOT_ITEM_INSUFFICIENT_STOCK');
            assert.equal(err.status, 400);
            assert.equal(err.message, 'Số lượng tồn không đủ để bán.');
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. S12-01: Book Copy Catalog Loader
  // ───────────────────────────────────────────────────────────────────────────
  describe('S12-01: Catalog Copy Loader & Unborrowed Books', () => {
    it('apiClient.listBookCopies trả về bản sao sách thật và bao gồm sách chưa từng mượn (AVAILABLE)', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url: any) => {
          assert.ok(String(url).includes('/api/v1/catalog/books/copies'));
          return new Response(JSON.stringify({
            data: [
              {
                id: 'copy-new-001',
                barcode: 'YSBK-NEW-001',
                title: 'Sách mới chưa từng mượn',
                status: 'AVAILABLE',
                location: 'KHO_THU_VIEN',
                coverPrice: 120000,
                calculatedDeposit: 120000,
              },
              {
                id: 'copy-borrowed-002',
                barcode: 'YSBK-OLD-002',
                title: 'Sách đang cho mượn',
                status: 'BORROWED',
                location: 'BAN_TRUC_TAM',
                coverPrice: 85000,
              },
            ],
            total: 2,
            page: 1,
            limit: 50,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        const copies = await apiClient.listBookCopies();
        assert.ok(Array.isArray(copies));
        assert.equal(copies.length, 2);
        assert.equal(copies[0].status, 'AVAILABLE');
        assert.equal(copies[0].title, 'Sách mới chưa từng mượn');
        assert.equal(copies[1].status, 'BORROWED');
        assert.equal(copies.meta?.total, 2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. S12-04: Idempotency Key Stability Across Retries
  // ───────────────────────────────────────────────────────────────────────────
  describe('S12-04: Idempotency Key Stability Across Retries', () => {
    it('cùng ý định retry gửi đúng cùng một idempotency key, không sinh key mới', async () => {
      const originalFetch = globalThis.fetch;
      const capturedKeys: string[] = [];

      try {
        globalThis.fetch = async (_url: any, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          const key = headers.get('X-Idempotency-Key');
          if (key) capturedKeys.push(key);
          return new Response(JSON.stringify({
            data: { id: 'ln-100', renewCount: 1 }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        // Giả lập retry với cùng 1 key do form/modal lưu giữ
        const stableKey = generateIdempotencyKey('RENEW');

        // Lần gọi 1
        await apiClient.renewLoan('ln-100', { idempotencyKey: stableKey });

        // Lần gọi 2 (retry do lag mạng hoặc double-click)
        await apiClient.renewLoan('ln-100', { idempotencyKey: stableKey });

        assert.equal(capturedKeys.length, 2);
        assert.equal(capturedKeys[0], capturedKeys[1], 'Key lần 1 và lần 2 phải giống hệt nhau để server dedupe');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. S12-05: DEMO Boundary & Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('S12-05: DEMO Boundary and State Isolation', () => {
    it('generateIdempotencyKey tạo tiền tố chuẩn xác', () => {
      const issueKey = generateIdempotencyKey('ISSUE');
      assert.ok(issueKey.startsWith('ISSUE-'));
      const renewKey = generateIdempotencyKey('RENEW');
      assert.ok(renewKey.startsWith('RENEW-'));
    });
  });
});
