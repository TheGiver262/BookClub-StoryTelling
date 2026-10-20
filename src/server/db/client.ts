import pg from 'pg';
import type { Pool } from 'pg';
const { Pool: PgPool } = pg;
import type { Env } from '../types.ts';

// Chuẩn hóa pg DATE parser (OID 1082) trả về chuỗi 'YYYY-MM-DD' nguyên bản
// Ngăn ngừa chuyển đổi sang JS Date làm lệch ngày múi giờ UTC+7
pg.types.setTypeParser(1082, (val: string) => val);

let poolInstance: Pool | null = null;
const requestPools = new WeakMap<Env, Pool>();

function databaseUrl(env?: Env): string | undefined {
  if (env?.NODE_ENV === 'production' && !env.HYPERDRIVE?.connectionString) {
    throw new Error('HYPERDRIVE is required in production.');
  }
  return env?.HYPERDRIVE?.connectionString || env?.DATABASE_URL || process.env.DATABASE_URL;
}

export function getDatabasePool(env?: Env): Pool {
  const existing = env ? requestPools.get(env) : poolInstance;
  if (existing) return existing;

  const dbUrl = databaseUrl(env);
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const pool = new PgPool({
    connectionString: dbUrl,
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 3000,
  });

  if (env) requestPools.set(env, pool);
  else poolInstance = pool;
  return pool;
}

export async function closeDatabasePool(env: Env): Promise<void> {
  const pool = requestPools.get(env);
  requestPools.delete(env);
  if (pool) await pool.end();
}

export async function checkDatabaseReadiness(env?: Env): Promise<{ ok: boolean; message?: string }> {
  try {
    const dbUrl = databaseUrl(env);
    if (!dbUrl) {
      return { ok: false, message: 'DATABASE_URL chưa được cấu hình.' };
    }

    const pool = getDatabasePool(env);
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Không thể kết nối cơ sở dữ liệu PostgreSQL.',
    };
  }
}

function isPgPool(db: any): boolean {
  return (
    db &&
    typeof db.connect === 'function' &&
    (typeof db.totalCount === 'number' ||
      typeof db.idleCount === 'number' ||
      (typeof db.options === 'object' && typeof db.options?.max === 'number'))
  );
}

/**
 * S07-02: Quản lý Transaction an toàn theo hợp đồng sở hữu rõ ràng:
 * - Nếu nhận pg.Pool: Checkout đúng 1 client, BEGIN/COMMIT hoặc ROLLBACK/release.
 * - Nếu nhận Client/PoolClient đã trong transaction: Tái sử dụng, không reconnect/release/COMMIT hộ outer transaction.
 * - Nếu nhận Client chưa trong transaction: Tự quản lý BEGIN/COMMIT/ROLLBACK trên client đó mà không release client ngoài.
 * - Fail rõ ràng nếu db không hợp lệ.
 */
export async function withTransaction<T>(
  db: any,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  if (!db || (typeof db.query !== 'function' && typeof db.connect !== 'function')) {
    throw new TypeError('Tham số db không hợp lệ: Cần pg.Pool, pg.Client hoặc Queryable.');
  }

  // 1. Nhánh pg.Pool: Tự checkout và quản lý vòng đời client
  if (isPgPool(db)) {
    const client = await db.connect();
    (client as any).__in_tx = true;
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Bỏ qua lỗi rollback nếu kết nối đã ngắt
      }
      throw err;
    } finally {
      (client as any).__in_tx = false;
      client.release();
    }
  }

  // 2. Nhánh Client/Queryable
  if (typeof db.query === 'function') {
    // Nếu client này đã nằm trong outer transaction: Tái sử dụng nguyên trạng
    if ((db as any).__in_tx === true) {
      return await callback(db);
    }

    // Client độc lập chưa có transaction: Quản lý BEGIN / COMMIT / ROLLBACK nội bộ
    (db as any).__in_tx = true;
    try {
      await db.query('BEGIN');
      const result = await callback(db);
      await db.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await db.query('ROLLBACK');
      } catch {
        // Bỏ qua lỗi rollback nếu kết nối đã ngắt
      }
      throw err;
    } finally {
      (db as any).__in_tx = false;
    }
  }

  throw new TypeError('Không thể khởi tạo transaction từ đối tượng db được cung cấp.');
}
