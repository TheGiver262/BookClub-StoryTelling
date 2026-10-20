/**
 * YSBK System Audit Logging Module (S06-03)
 * Ghi nhật ký kiểm toán hệ thống (system_audit_logs) trong cùng transaction với mutation.
 * Lưu trữ actor, action, resource, ID và chi tiết thay đổi đã được làm sạch (sanitized).
 * Tuyệt đối không lưu raw password, token, hoặc PII nhạy cảm vào details.
 */

import type { Queryable } from '../finance/types.ts';

export interface AuditLogParams {
  actorId?: string | null;
  action: string;
  targetResource: string;
  targetId?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Danh sách các trường nhạy cảm cần loại bỏ khỏi details khi ghi log
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'sessionToken',
  'jwtSecret',
  'secret',
  'apiKey',
  'authorization',
]);

export function sanitizeAuditDetails(details?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!details || typeof details !== 'object') return null;

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(details)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeAuditDetails(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export async function recordAuditLog(
  db: Queryable,
  params: AuditLogParams
): Promise<void> {
  const sanitizedDetails = sanitizeAuditDetails(params.details);
  await db.query(
    `INSERT INTO system_audit_logs (actor_id, action, target_resource, target_id, ip_address, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.actorId || null,
      params.action,
      params.targetResource,
      params.targetId || null,
      params.ipAddress || null,
      sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
    ]
  );
}
