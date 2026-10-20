/**
 * YSBK Shared Idempotency Module
 * Hợp nhất cơ chế Idempotency: (actor_id + operation + idempotency_key + canonical_payload_hash)
 * Đảm bảo tính nhất quán giao dịch, chống replay, và xử lý concurrency an toàn trên PostgreSQL.
 */

import * as crypto from 'node:crypto';
import type { Queryable } from '../finance/types.ts';

export class IdempotencyError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus = 409) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class IdempotencyPayloadMismatchError extends IdempotencyError {
  constructor(message = 'Idempotency key reused with different payload') {
    super(message, 'IDEMPOTENCY_PAYLOAD_MISMATCH', 409);
    this.name = 'IdempotencyPayloadMismatchError';
  }
}

export class IdempotencyConcurrentError extends IdempotencyError {
  constructor(message = 'Concurrent request in progress with same idempotency key') {
    super(message, 'IDEMPOTENCY_CONCURRENT_REQUEST', 409);
    this.name = 'IdempotencyConcurrentError';
  }
}

/**
 * Chuẩn hóa payload JSON đệ quy (sort keys) để tính hash SHA-256 ổn định.
 */
export function canonicalizeJson(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val === 'bigint') {
    return val.toString();
  }
  if (typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalizeJson(item)).join(',') + ']';
  }

  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const propertyValue = obj[key];
    if (propertyValue !== undefined && typeof propertyValue !== 'function') {
      entries.push(`${JSON.stringify(key)}:${canonicalizeJson(propertyValue)}`);
    }
  }

  return '{' + entries.join(',') + '}';
}

/**
 * Tính mã băm SHA-256 64 ký tự hex từ canonical payload JSON.
 */
export function computePayloadHash(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export interface ClaimResult {
  action: 'CLAIMED' | 'RETURN_CACHED';
  responseCode?: number;
  responseBody?: unknown;
}

/**
 * Đăng ký / Giành quyền xử lý Idempotency key trong cùng transaction DB của caller.
 * - Nếu key chưa tồn tại: Chèn bản ghi PROCESSING -> Trả về CLAIMED.
 * - Nếu key đã COMPLETED và cùng payload hash: Trả về RETURN_CACHED cùng cached response.
 * - Nếu key đã tồn tại nhưng khác payload hash: Ném lỗi 409 Payload Mismatch.
 * - Nếu key đang PROCESSING: Ném lỗi 409 Concurrent Request.
 * - Nếu key trước đó bị FAILED: Cho phép phục hồi và claim lại.
 */
export async function claimIdempotency(
  db: Queryable,
  actorId: string,
  operation: string,
  idempotencyKey: string,
  payloadHash: string
): Promise<ClaimResult> {
  if (!actorId || !operation || !idempotencyKey || !payloadHash) {
    throw new IdempotencyError('Thiếu thông số bắt buộc cho idempotency', 'INVALID_IDEMPOTENCY_PARAMS', 400);
  }

  if (idempotencyKey.length > 128) {
    throw new IdempotencyError('Idempotency key không được vượt quá 128 ký tự', 'IDEMPOTENCY_KEY_TOO_LONG', 400);
  }

  if (operation.length > 64) {
    throw new IdempotencyError('Tên operation không được vượt quá 64 ký tự', 'OPERATION_NAME_TOO_LONG', 400);
  }

  // Cố gắng INSERT bản ghi PROCESSING nguyên tử
  const insertRes = await db.query(
    `INSERT INTO idempotency_records (actor_id, operation, idempotency_key, payload_hash, status)
     VALUES ($1, $2, $3, $4, 'PROCESSING')
     ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING
     RETURNING id, status, payload_hash, response_code, response_body`,
    [actorId, operation, idempotencyKey, payloadHash]
  );

  if (insertRes.rows && insertRes.rows.length > 0) {
    return { action: 'CLAIMED' };
  }

  // Đã có xung đột khoá, đọc bản ghi hiện tại với khoá dòng FOR UPDATE
  const selectRes = await db.query<{
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
    payload_hash: string;
    response_code: number | null;
    response_body: unknown;
  }>(
    `SELECT status, payload_hash, response_code, response_body
     FROM idempotency_records
     WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
     FOR UPDATE`,
    [actorId, operation, idempotencyKey]
  );

  const existing = selectRes.rows[0];
  if (!existing) {
    // Trường hợp biên: vừa bị xoá giữa 2 câu lệnh, thử lại INSERT
    await db.query(
      `INSERT INTO idempotency_records (actor_id, operation, idempotency_key, payload_hash, status)
       VALUES ($1, $2, $3, $4, 'PROCESSING')`,
      [actorId, operation, idempotencyKey, payloadHash]
    );
    return { action: 'CLAIMED' };
  }

  if (existing.payload_hash !== payloadHash) {
    throw new IdempotencyPayloadMismatchError(
      `Idempotency key '${idempotencyKey}' đã được sử dụng trước đó với payload khác.`
    );
  }

  if (existing.status === 'COMPLETED') {
    return {
      action: 'RETURN_CACHED',
      responseCode: existing.response_code ?? 200,
      responseBody: existing.response_body,
    };
  }

  if (existing.status === 'PROCESSING') {
    throw new IdempotencyConcurrentError(
      `Yêu cầu đồng thời với cùng Idempotency key '${idempotencyKey}' đang được xử lý.`
    );
  }

  if (existing.status === 'FAILED') {
    // Bản ghi trước đó bị thất bại / rollback, cho phép chuyển lại sang PROCESSING
    await db.query(
      `UPDATE idempotency_records
       SET status = 'PROCESSING', updated_at = NOW()
       WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`,
      [actorId, operation, idempotencyKey]
    );
    return { action: 'CLAIMED' };
  }

  throw new IdempotencyError('Trạng thái idempotency không xác định', 'UNKNOWN_IDEMPOTENCY_STATUS', 500);
}

/**
 * Đánh dấu hoàn tất xử lý và lưu kết quả phản hồi có cấu trúc.
 */
export async function completeIdempotency(
  db: Queryable,
  actorId: string,
  operation: string,
  idempotencyKey: string,
  responseCode: number,
  responseBody: unknown
): Promise<void> {
  await db.query(
    `UPDATE idempotency_records
     SET status = 'COMPLETED',
         response_code = $4,
         response_body = $5,
         updated_at = NOW()
     WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`,
    [actorId, operation, idempotencyKey, responseCode, JSON.stringify(responseBody)]
  );
}

/**
 * Đánh dấu thất bại để giải phóng khóa PROCESSING khi transaction nghiệp vụ gặp lỗi.
 */
export async function failIdempotency(
  db: Queryable,
  actorId: string,
  operation: string,
  idempotencyKey: string
): Promise<void> {
  await db.query(
    `UPDATE idempotency_records
     SET status = 'FAILED',
         updated_at = NOW()
     WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3 AND status = 'PROCESSING'`,
    [actorId, operation, idempotencyKey]
  );
}
