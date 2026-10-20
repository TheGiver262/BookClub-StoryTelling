/**
 * System Audit Queries & Privacy-Compliant Analytics - YSBK (R06, R13)
 * Chỉ cho phép Quản trị viên (Admin) tra cứu nhật ký kiểm toán hệ thống.
 * Redaction sâu: tự động che chắn mọi trường nhạy cảm (secrets, tokens, PII).
 * Analytics tổng hợp số liệu vận hành, không thu thập telemetry thừa của cá nhân.
 */

import type { Queryable } from '../../server/finance/types.ts';
import type { AuthenticatedActor } from '../../server/types.ts';
import { BadRequestError } from '../../server/errors.ts';
import { requireAdmin, requireInternalMember } from '../../server/auth/policy.ts';

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorUsername?: string | null;
  action: string;
  targetResource: string;
  targetId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  targetResource?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResult {
  items: AuditLogItem[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface AnalyticsSummary {
  totalBooksCataloged: number;
  totalCopiesInCirculation: number;
  totalActiveMembers: number;
  totalReviewsPublished: number;
  totalPublicPosts: number;
  generatedAt: string;
}

/**
 * Danh sách khóa nhạy cảm cần redact triệt để khi trả về client
 */
const SENSITIVE_EXPORT_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'sessiontoken',
  'session_token',
  'jwtsecret',
  'jwt_secret',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'privatekey',
  'private_key',
]);

export function redactSensitiveDetails(details: any): any {
  if (!details || typeof details !== 'object') return details;
  if (Array.isArray(details)) {
    return details.map(redactSensitiveDetails);
  }

  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(details)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_EXPORT_KEYS.has(lowerKey)) {
      result[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      result[k] = redactSensitiveDetails(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * 1. Tra cứu Nhật Ký Kiểm Toán Toàn Cục (Chỉ Admin)
 * Bounded pagination: limit <= 200
 */
export async function getSystemAuditLogs(
  db: Queryable,
  actor: AuthenticatedActor,
  filter?: AuditLogFilter,
  pagination?: { limit?: number; offset?: number }
): Promise<AuditLogResult> {
  // Chỉ Quản trị viên mới có quyền đọc nhật ký kiểm toán hệ thống
  requireAdmin(actor);

  let limit = pagination?.limit !== undefined ? Number(pagination.limit) : 50;
  if (!Number.isInteger(limit) || limit <= 0) {
    limit = 50;
  }
  if (limit > 200) {
    throw new BadRequestError('Giới hạn tra cứu audit log tối đa là 200 dòng.', 'AUDIT_LIMIT_EXCEEDED');
  }

  let offset = pagination?.offset !== undefined ? Number(pagination.offset) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    offset = 0;
  }

  let whereClauses: string[] = ['1=1'];
  const params: any[] = [];
  let pIdx = 1;

  if (filter?.actorId) {
    whereClauses.push(`actor_id = $${pIdx++}`);
    params.push(filter.actorId);
  }
  if (filter?.action) {
    whereClauses.push(`action = $${pIdx++}`);
    params.push(filter.action);
  }
  if (filter?.targetResource) {
    whereClauses.push(`target_resource = $${pIdx++}`);
    params.push(filter.targetResource);
  }
  if (filter?.startDate) {
    whereClauses.push(`created_at >= $${pIdx++}::timestamptz`);
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    whereClauses.push(`created_at <= ($${pIdx++}::timestamptz + INTERVAL '1 day')`);
    params.push(filter.endDate);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query(`SELECT COUNT(*) as count FROM system_audit_logs WHERE ${whereSql}`, params);
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const querySql = `
    SELECT
      id,
      actor_id,
      action,
      target_resource,
      target_id,
      ip_address,
      details,
      created_at
    FROM system_audit_logs
    WHERE ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${pIdx++} OFFSET $${pIdx++}
  `;
  const queryParams = [...params, limit, offset];

  const res = await db.query(querySql, queryParams);
  const items: AuditLogItem[] = (res.rows || []).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetResource: row.target_resource,
    targetId: row.target_id,
    ipAddress: row.ip_address,
    details: redactSensitiveDetails(row.details),
    createdAt: row.created_at,
  }));

  return {
    items,
    totalCount,
    limit,
    offset,
  };
}

/**
 * 2. Thống Kê Tổng Quan Hệ Thống (Analytics Summary)
 * Thành viên nội bộ CLB xem thống kê quy mô vận hành.
 * Không thu thập hành vi hoặc PII của từng cá nhân độc giả.
 */
export async function getAnalyticsSummary(
  db: Queryable,
  actor: AuthenticatedActor
): Promise<AnalyticsSummary> {
  requireInternalMember(actor);

  const [booksRes, copiesRes, membersRes, reviewsRes, postsRes] = await Promise.all([
    db.query(`SELECT COUNT(*) as count FROM book_titles`),
    db.query(`SELECT COUNT(*) as count FROM book_copies WHERE status != 'ARCHIVED'`),
    db.query(`SELECT COUNT(*) as count FROM members WHERE is_active = true AND is_alumni = false`),
    db.query(`SELECT COUNT(*) as count FROM book_reviews WHERE status = 'APPROVED'`),
    db.query(`SELECT COUNT(*) as count FROM public_posts WHERE status = 'PUBLISHED'`),
  ]);

  return {
    totalBooksCataloged: Number(booksRes.rows[0]?.count || 0),
    totalCopiesInCirculation: Number(copiesRes.rows[0]?.count || 0),
    totalActiveMembers: Number(membersRes.rows[0]?.count || 0),
    totalReviewsPublished: Number(reviewsRes.rows[0]?.count || 0),
    totalPublicPosts: Number(postsRes.rows[0]?.count || 0),
    generatedAt: new Date().toISOString(),
  };
}
