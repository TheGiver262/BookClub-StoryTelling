import * as crypto from 'node:crypto';
import type { Env, AuthenticatedActor, MemberDto } from './types.ts';
import {
  formatErrorResponse,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  UnauthorizedError,
  ServiceUnavailableError,
} from './errors.ts';
import { extractBearerToken, extractSessionCookie, verifySessionToken } from './auth/tokens.ts';
import {
  requireInternalMember,
  requireAdmin,
  requireAuthenticated,
  toAlumniActivityDto,
  toMemberDto,
} from './auth/policy.ts';
import { loginInternalMember, loginGuestUser, type AuthTestInjection } from './auth/provider.ts';
import { checkDatabaseReadiness, getDatabasePool, withTransaction } from './db/client.ts';
import { checkAuthProviderReadiness } from './auth/provider.ts';
import {
  openCashSession,
  getCashSessionSummary,
  closeCashSession,
  serializeCashSession,
  serializeCashSessionSummary,
} from './finance/cash-sessions.ts';
import type { Queryable } from './finance/types.ts';
import {
  computePayloadHash,
  claimIdempotency,
  completeIdempotency,
} from './shared/idempotency.ts';
import {
  searchBooks,
  getBookById,
  getBookCopyByBarcode,
  createBookTitle,
  createBookEdition,
  createBookCopy,
  updateBookCopy,
  archiveBookCopy,
  listBookCopies,
  BookNotFoundError,
  CopyNotFoundError,
} from './catalog/service.ts';
import {
  issueLoanReceipt,
  getLoanReceiptById,
  listLoanReceipts,
  settleReturnReceipt,
  confirmRefund,
  getLoanSettlementDetail,
  renewLoanReceipt,
  getLoanRenewals,
  confirmNewDeposit,
  collectPendingFine,
  listCalendarHolidays,
  addCalendarHoliday,
  reportBookLoss,
  quoteLoanAction,
  listPendingRefunds,
  cancelRefundIntent,
  listPendingDeposits,
  listPendingFines,
  LoanReceiptNotFoundError,
} from './circulation/service.ts';
import { createDocumentCorrection } from './finance/ledger.ts';
import {
  searchBorrowers,
  getBorrowerById,
  createBorrower,
  updateBorrower,
  archiveBorrower,
  BorrowerNotFoundError,
} from './borrowers/service.ts';
import {
  getMemberAffiliations,
  addMemberAffiliation,
  getMembersHeadcount,
  collectMembershipDues,
  getMemberDuesReceipt,
} from './members/service.ts';
import {
  previewAvailabilityFile,
  commitAvailabilityBatch,
  listAvailabilityBatches,
  getMemberBusyIntervals,
} from './duty/availability-service.ts';
import {
  generateDraftSchedules,
  manualEditSchedule,
  publishSchedule,
  updateAttendance,
  getScheduleById,
  listSchedules,
} from './duty/roster-service.ts';
import {
  ingestFormResponse,
  verifyWebhookSecurity,
} from '../modules/recruitment/ingest-form.ts';
import {
  reconcileFormResponses,
  listRecruitmentResponses,
  getPublicRecruitmentSummary,
} from '../modules/recruitment/form-reconciliation.ts';
import {
  createRubric,
  getRubricById,
  submitEvaluation,
  editEvaluation,
  getEvaluationsByResponseId,
  getEvaluationHistory,
} from '../modules/recruitment/evaluation.ts';
import {
  finalizeDecision,
  convertPassedApplicantToMember,
  approvePublicAnnouncement,
  getPublicApprovedResults,
} from '../modules/recruitment/decisions.ts';
import {
  createSupplier,
  getSuppliers,
  createLot,
  getLotDetails,
  listLots,
  recordBookSale,
  returnUnsoldBooks,
  retainBooksForNextPeriod,
} from '../modules/sales/lot-inventory.ts';
import {
  calculateLotSettlement,
  createSettlement,
  recordSupplierPayment,
  getSettlementByLotId,
} from '../modules/sales/settlement.ts';
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  createTask,
  updateTask,
  getTaskHistory,
  addParticipant,
  updateParticipant,
  createBudgetItem,
  recordExpense,
} from '../modules/events/service.ts';
import {
  submitBookReview,
  editBookReview,
  moderateBookReview,
  getPublicReviews,
  getReviewsForModeration,
  createPublicPost,
  publishPublicPost,
  getPublicPosts,
  getPublicPostBySlug,
} from '../modules/content/service.ts';
import {
  getFinancialSummaryReport,
  getFinancialDrilldown,
  getCirculationSummaryReport,
  renderFinancialSummaryCsv,
  renderCirculationSummaryCsv,
  renderFinancialSummaryExcel,
  renderCirculationSummaryExcel,
  renderFinancialSummaryHtml,
  createExportTicket,
  validateAndConsumeExportTicketAsync,
} from '../modules/reporting/reporting-service.ts';
import type { ReportPeriod } from '../modules/reporting/reporting-types.ts';
import {
  getSystemAuditLogs,
  getAnalyticsSummary,
} from '../modules/audit/queries.ts';
import {
  createReservation,
  getReservationByToken,
  cancelReservation,
  fulfillReservation,
  listPublicReservationBooks,
  listPublicPickupSchedules,
  listStaffReservations,
  reportReservationIssue,
} from './reservations/service.ts';
import { verifyTurnstileToken } from './reservations/captcha.ts';

export interface TestFixtures extends AuthTestInjection {
  activities?: any[];
  revokedTokenHashes?: Set<string>;
  queryable?: Queryable;
  cashSessionsDb?: Record<string, any>;
  clientIp?: string;
  now?: Date;
  turnstileFetch?: typeof fetch;
}

function getDb(injected?: TestFixtures, env?: Env): Queryable {
  if (injected?.queryable) return injected.queryable;
  try {
    return getDatabasePool(env);
  } catch {
    throw new ServiceUnavailableError('Cơ sở dữ liệu chưa sẵn sàng.', 'DATABASE_DISCONNECTED');
  }
}

function resolveClientIp(request: Request, injected?: TestFixtures, env?: Env): string {
  if (injected?.clientIp) return injected.clientIp;
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  if (env?.NODE_ENV === 'production') throw new BadRequestError('Thiếu địa chỉ IP từ proxy tin cậy.', 'CLIENT_IP_UNAVAILABLE');
  return '127.0.0.1';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * S10-05: Parse và kiểm tra JSON object boundary nghiêm ngặt tại tầng HTTP
 * Trả 400 nếu cú pháp JSON hỏng hoặc body không phải JSON object (null, array, string, v.v.)
 */
export async function parseJsonObject(request: Request, requestId: string): Promise<Record<string, any>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new BadRequestError('Không thể đọc dữ liệu body yêu cầu.', 'INVALID_REQUEST_BODY', requestId);
  }
  if (!text || text.trim().length === 0) {
    return {};
  }
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BadRequestError('Dữ liệu JSON trong yêu cầu không hợp lệ (Malformed JSON).', 'MALFORMED_JSON', requestId);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('Body của yêu cầu bắt buộc phải là một đối tượng JSON (JSON object).', 'INVALID_JSON_BODY', requestId);
  }
  return body;
}

export async function resolveActorFromRequest(
  request: Request,
  env?: Env,
  injected?: TestFixtures
): Promise<AuthenticatedActor | null> {
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');

  const token = extractBearerToken(authHeader) || extractSessionCookie(cookieHeader);
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  // S04-04: Check revoked token via persistent hash check (fixture store or database)
  if (injected?.revokedTokenHashes?.has(tokenHash)) {
    return null;
  }

  if (!injected && env) {
    try {
      const pool = getDatabasePool(env);
      const revokedCheck = await pool.query(
        'SELECT 1 FROM revoked_tokens WHERE token_hash = $1',
        [tokenHash]
      );
      if (revokedCheck.rows.length > 0) {
        return null;
      }
    } catch {
      // If DB is unreachable, fail closed
      throw new ServiceUnavailableError('Cơ sở dữ liệu xác thực chưa sẵn sàng.', 'DATABASE_DISCONNECTED');
    }
  }

  const claims = await verifySessionToken(token, env?.JWT_SECRET);

  // Guest users don't have member records in database
  if (claims.role === 'GUEST') {
    return claims;
  }

  // S03-02 & S03-04: Resolve live member status and verify token_version from database or test injection
  let liveMember: any = null;

  if (injected?.membersDb && claims.memberId) {
    liveMember = injected.membersDb[claims.memberId];
  } else if (claims.memberId) {
    try {
      const pool = getDatabasePool(env);
      const res = await pool.query(
        'SELECT id, username, is_active, is_alumni, is_admin, token_version FROM members WHERE id = $1',
        [claims.memberId]
      );
      if (res.rows.length > 0) {
        liveMember = res.rows[0];
      }
    } catch {
      throw new ServiceUnavailableError('Cơ sở dữ liệu xác thực quyền chưa sẵn sàng.', 'DATABASE_DISCONNECTED');
    }
  }

  if (!liveMember) {
    return null;
  }

  // Reject disabled accounts
  if (!liveMember.is_active) {
    return null;
  }

  // Reject outdated tokens if token_version was incremented
  if (claims.tokenVersion && liveMember.token_version > claims.tokenVersion) {
    return null;
  }

  // Return authoritative actor state from database
  return {
    userId: claims.userId || (claims as any).sub || liveMember.id,
    memberId: liveMember.id,
    username: liveMember.username,
    role: liveMember.is_admin ? 'ADMIN' : 'MEMBER',
    isAlumni: Boolean(liveMember.is_alumni),
    isActive: Boolean(liveMember.is_active),
    tokenVersion: liveMember.token_version,
  };
}

export async function handleRequest(
  request: Request,
  env?: Env,
  injected?: TestFixtures
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const requestId = request.headers.get('X-Request-Id') || crypto.randomUUID();
  const isProduction = env?.NODE_ENV === 'production';

  try {
    // 1. Health Liveness: 200 OK (Clean, no internal database URLs or secrets)
    if (method === 'GET' && path === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'ysbk-backend',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 2. Health Readiness: 200 OK if both DB & Auth Provider connected, otherwise 503 Fail-closed
    if (method === 'GET' && path === '/health/ready') {
      const dbReady = await checkDatabaseReadiness(env);
      const authReady = await checkAuthProviderReadiness(env);

      const isReady = Boolean(dbReady?.ok && authReady?.ok);
      const status = isReady ? 200 : 503;

      return new Response(
        JSON.stringify({
          status: isReady ? 'ready' : 'degraded',
          database: dbReady?.ok ? 'connected' : 'disconnected',
          authProvider: authReady?.ok ? 'connected' : 'disconnected',
          dependencies: {
            database: dbReady?.ok ? 'connected' : 'disconnected',
            authProvider: authReady?.ok ? 'connected' : 'disconnected',
          },
        }),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 3. Auth: Login Internal Member (Synthetic Internal Realm)
    if (method === 'POST' && (path === '/api/v1/auth/login-internal' || path === '/v1/auth/internal/login')) {
      const body = (await request.json().catch(() => ({}))) as any;
      const authResult = await loginInternalMember(body, env, injected);

      const cookieSecure = isProduction ? '; Secure' : '';
      const cookieHeader = `ysbk_session=${authResult.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${cookieSecure}`;

      return new Response(
        JSON.stringify({
          data: authResult.actor,
          actor: authResult.actor,
          token: authResult.token,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Set-Cookie': cookieHeader,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 4. Auth: Login Guest User (Managed Auth)
    if (method === 'POST' && (path === '/api/v1/auth/login-guest' || path === '/v1/auth/guest/login')) {
      const body = (await request.json().catch(() => ({}))) as any;
      const authResult = await loginGuestUser(body, env, injected);

      const cookieSecure = isProduction ? '; Secure' : '';
      const cookieHeader = `ysbk_session=${authResult.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${cookieSecure}`;

      return new Response(JSON.stringify({ data: authResult.actor, actor: authResult.actor, token: authResult.token }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Set-Cookie': cookieHeader,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 5. Auth Me: Check current session
    if (method === 'GET' && path === '/api/v1/auth/me') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const authenticatedActor = requireAuthenticated(actor);

      return new Response(JSON.stringify({ data: authenticatedActor }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 6. Logout: S04-04 Persistent revocation via token hash & token_version
    if (method === 'POST' && path === '/api/v1/auth/logout') {
      const authHeader = request.headers.get('Authorization');
      const cookieHeader = request.headers.get('Cookie');
      const token = extractBearerToken(authHeader) || extractSessionCookie(cookieHeader);

      if (token) {
        const tokenHash = hashToken(token);

        if (injected?.revokedTokenHashes) {
          injected.revokedTokenHashes.add(tokenHash);
        }

        // Also increment member token_version if internal member
        const actor = await resolveActorFromRequest(request, env, injected).catch(() => null);
        if (actor?.memberId && injected?.membersDb?.[actor.memberId]) {
          injected.membersDb[actor.memberId].token_version = (injected.membersDb[actor.memberId].token_version || 1) + 1;
        }

        if (!injected && env) {
          try {
            const pool = getDatabasePool(env);
            const expDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await pool.query(
              `INSERT INTO revoked_tokens (token_hash, expires_at)
               VALUES ($1, $2)
               ON CONFLICT (token_hash) DO NOTHING`,
              [tokenHash, expDate]
            );

            if (actor?.memberId) {
              await pool.query(
                `UPDATE members SET token_version = token_version + 1 WHERE id = $1`,
                [actor.memberId]
              );
            }
          } catch {
            // S05-03: Không nuốt lỗi DB khi thu hồi phiên server-side
            throw new ServiceUnavailableError(
              'Không thể thu hồi phiên đăng nhập trên máy chủ, vui lòng thử lại.',
              'LOGOUT_REVOCATION_FAILED',
              requestId
            );
          }
        }
      }

      const cookieSecure = isProduction ? '; Secure' : '';
      return new Response(JSON.stringify({ message: 'Đăng xuất thành công.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
          'Set-Cookie': `ysbk_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${cookieSecure}`,
        },
      });
    }

    // 7. Protected Internal: List Members (Requires Active Member or Admin)
    if (method === 'GET' && path === '/api/v1/members') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      let membersList: MemberDto[] = [];

      if (injected?.membersDb) {
        membersList = Object.values(injected.membersDb).map((m: any) => toMemberDto(m));
      } else {
        const pool = getDatabasePool(env);
        const res = await pool.query(
          `SELECT id, full_name, username, team, role_title, school_year, phone,
                  is_eligible_main_duty, has_paid_fee, is_alumni, is_admin, is_active, created_at
           FROM members
           ORDER BY created_at ASC`
        );
        membersList = res.rows.map(toMemberDto);
      }

      return new Response(JSON.stringify({ data: membersList, total: membersList.length }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 7b. Members: Headcount Summary (Chặng 13: Distinct headcount by department)
    if (method === 'GET' && path === '/api/v1/members/headcount') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const summary = await getMembersHeadcount(db);

      return new Response(JSON.stringify({ data: summary }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 7c. Members: Get Member Affiliations History (Chặng 13)
    if (
      method === 'GET' &&
      path.startsWith('/api/v1/members/') &&
      path.endsWith('/affiliations')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const memberId = path.replace('/api/v1/members/', '').replace('/affiliations', '');
      const db = getDb(injected, env);
      const affiliations = await getMemberAffiliations(db, memberId);

      return new Response(JSON.stringify({ data: affiliations }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 7d. Members: Add Affiliation / Role Assignment (Chặng 13: Admin only)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/members/') &&
      path.endsWith('/affiliations')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const admin = requireAdmin(actor);
      const actorId = admin.memberId || admin.userId;

      const memberId = path.replace('/api/v1/members/', '').replace('/affiliations', '');
      const body = await parseJsonObject(request, requestId);
      const db = getDb(injected, env);

      const affiliation = await withTransaction(db, async (tx) => {
        return await addMemberAffiliation(tx, { ...body, memberId }, actorId);
      });

      return new Response(JSON.stringify({ data: affiliation, message: 'Phân công ban và chức vụ thành công.' }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 7e. Members: Get Member Dues Receipt (Chặng 13)
    if (
      method === 'GET' &&
      path.startsWith('/api/v1/members/') &&
      path.endsWith('/dues')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const memberId = path.replace('/api/v1/members/', '').replace('/dues', '');
      const db = getDb(injected, env);
      const receipt = await getMemberDuesReceipt(db, memberId);

      return new Response(JSON.stringify({ data: receipt }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 7f. Members: Collect One-time Membership Dues (Chặng 13: Idempotency supported)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/members/') &&
      path.endsWith('/dues/collect')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const memberId = path.replace('/api/v1/members/', '').replace('/dues/collect', '');
      const body = await parseJsonObject(request, requestId);
      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      const payloadHash = idempotencyKey ? computePayloadHash({ ...body, memberId }) : '';

      const db = getDb(injected, env);

      const result = await withTransaction(db, async (tx) => {
        if (idempotencyKey) {
          const claim = await claimIdempotency(tx, actorId, 'MEMBERSHIP_DUES_COLLECT', idempotencyKey, payloadHash);
          if (claim.action === 'RETURN_CACHED') {
            return { status: claim.responseCode || 200, payload: claim.responseBody };
          }
        }

        const duesReceipt = await collectMembershipDues(tx, { ...body, memberId }, actorId);
        const responsePayload = { data: duesReceipt, message: 'Thu hội phí thành viên một lần thành công.' };

        if (idempotencyKey) {
          await completeIdempotency(tx, actorId, 'MEMBERSHIP_DUES_COLLECT', idempotencyKey, 201, responsePayload);
        }

        return { status: 201, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 8. Admin Only: Update Member Status (S04-07: Invariant alumni/admin in DB and handler)
    if (method === 'PATCH' && path.startsWith('/api/v1/members/') && path.endsWith('/status')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireAdmin(actor);

      const memberId = path.replace('/api/v1/members/', '').replace('/status', '');
      const body = (await request.json().catch(() => ({}))) as any;

      if (!body || typeof body !== 'object') {
        throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ.', 'INVALID_BODY', requestId);
      }

      // S03-05: Conflicting alumni + admin payload must be rejected
      if (body.isAlumni === true && body.isAdmin === true) {
        throw new BadRequestError('Thành viên không thể đồng thời là Cựu thành viên và Quản trị viên.', 'ALUMNI_CANNOT_BE_ADMIN', requestId);
      }

      let updatedMember: any = null;

      if (injected?.membersDb) {
        const member = injected.membersDb[memberId];
        if (!member) {
          throw new NotFoundError('Không tìm thấy thành viên.', 'MEMBER_NOT_FOUND', requestId);
        }

        let targetAlumni: boolean;
        let targetAdmin: boolean;

        if (typeof body.isAlumni === 'boolean' && typeof body.isAdmin === 'boolean') {
          targetAlumni = body.isAlumni;
          targetAdmin = body.isAdmin;
        } else if (typeof body.isAlumni === 'boolean') {
          targetAlumni = body.isAlumni;
          // S04-07 & S05-04: Khi chuyển sang Alumni mà không chỉ định isAdmin, tự động hạ quyền admin
          targetAdmin = body.isAlumni ? false : member.is_admin;
        } else if (typeof body.isAdmin === 'boolean') {
          targetAdmin = body.isAdmin;
          targetAlumni = member.is_alumni;
        } else {
          targetAlumni = member.is_alumni;
          targetAdmin = member.is_admin;
        }

        // S04-07: Chặn nếu cùng lúc là Alumni và Admin
        if (targetAlumni && targetAdmin) {
          throw new BadRequestError('Cựu thành viên không thể nhận quyền Quản trị viên.', 'ALUMNI_CANNOT_BE_ADMIN', requestId);
        }

        if (typeof body.isActive === 'boolean') member.is_active = body.isActive;
        member.is_alumni = targetAlumni;
        member.is_admin = targetAdmin;

        member.token_version = (member.token_version || 1) + 1;
        updatedMember = member;
      } else {
        const pool = getDatabasePool(env);

        // S04-07: Check current member status first
        const curRes = await pool.query('SELECT is_alumni, is_admin FROM members WHERE id = $1', [memberId]);
        if (curRes.rows.length === 0) {
          throw new NotFoundError('Không tìm thấy thành viên.', 'MEMBER_NOT_FOUND', requestId);
        }
        const cur = curRes.rows[0];

        let targetAlumni: boolean;
        let targetAdmin: boolean;

        if (typeof body.isAlumni === 'boolean' && typeof body.isAdmin === 'boolean') {
          targetAlumni = body.isAlumni;
          targetAdmin = body.isAdmin;
        } else if (typeof body.isAlumni === 'boolean') {
          targetAlumni = body.isAlumni;
          targetAdmin = body.isAlumni ? false : cur.is_admin;
        } else if (typeof body.isAdmin === 'boolean') {
          targetAdmin = body.isAdmin;
          targetAlumni = cur.is_alumni;
        } else {
          targetAlumni = cur.is_alumni;
          targetAdmin = cur.is_admin;
        }

        if (targetAlumni && targetAdmin) {
          throw new BadRequestError('Cựu thành viên không thể nhận quyền Quản trị viên.', 'ALUMNI_CANNOT_BE_ADMIN', requestId);
        }

        const res = await pool.query(
          `UPDATE members
           SET is_active = COALESCE($1, is_active),
               is_alumni = $2,
               is_admin = $3,
               token_version = token_version + 1
           WHERE id = $4
           RETURNING id, full_name, username, team, role_title, school_year, phone,
                     is_eligible_main_duty, has_paid_fee, is_alumni, is_admin, is_active, token_version, created_at`,
          [
            typeof body.isActive === 'boolean' ? body.isActive : null,
            targetAlumni,
            targetAdmin,
            memberId,
          ]
        );
        updatedMember = res.rows[0];
      }

      return new Response(JSON.stringify({ data: toMemberDto(updatedMember), message: 'Cập nhật trạng thái thành công.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    // 9. Alumni / Member: View activities (S05-04: Only approved activities, never assume COMPLETED is safe)
    if (method === 'GET' && path === '/api/v1/alumni/activities') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const authenticatedActor = requireAuthenticated(actor);

      // Guests are blocked
      if (authenticatedActor.role === 'GUEST') {
        throw new ForbiddenError('Tài khoản khách không có quyền xem hoạt động nội bộ.', 'GUEST_FORBIDDEN', requestId);
      }

      let rawActivities: any[] = [];
      if (injected?.activities) {
        // S05-04: Filter only approved activities
        rawActivities = injected.activities.filter(
          (a) => a.status === 'APPROVED_FOR_ALUMNI'
        );
      } else {
        const pool = getDatabasePool(env);
        // S05-04: Query only approved activities, DO NOT swallow errors
        const res = await pool.query(
          `SELECT id, title, description, event_date AS activity_date, location, status
           FROM activities
           WHERE status = 'APPROVED_FOR_ALUMNI'
           ORDER BY event_date ASC`
        );
        rawActivities = res.rows;
      }

      const safeActivities = rawActivities.map(toAlumniActivityDto);
      return new Response(JSON.stringify({ data: safeActivities, total: safeActivities.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    // 10. Finance: Cash Session - Get Today's Session
    if (method === 'GET' && path === '/api/v1/finance/cash-session/today') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db: Queryable = injected?.queryable || getDatabasePool(env);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

      // S05-05: Lọc phiên đang mở của chính ngày hôm nay theo giờ địa phương
      const res = await db.query<any>(
        `SELECT id, session_date, opened_by, opened_at, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, discrepancy_reason, is_closed, closed_at, closed_by, handed_over_from_session_id
         FROM cash_sessions
         WHERE session_date = $1 AND is_closed = FALSE
         LIMIT 1`,
        [today]
      );

      const currentSession = res.rows && res.rows.length > 0 ? res.rows[0] : null;
      if (!currentSession) {
        throw new NotFoundError(`Chưa có phiên quầy tiền mặt nào đang mở hôm nay (${today}).`, 'NO_ACTIVE_SESSION', requestId);
      }

      return new Response(JSON.stringify({ data: serializeCashSession(currentSession) }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 11. Finance: Cash Session - Open Session (S05-08: Hỗ trợ Idempotency và Cache-Control)
    if (method === 'POST' && path === '/api/v1/finance/cash-session/open') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);

      const body = (await request.json().catch(() => ({}))) as any;
      if (!body.sessionDate || body.openingCash === undefined) {
        throw new BadRequestError('Thiếu ngày phiên hoặc số tiền đầu ca.', 'MISSING_OPEN_PARAMS', requestId);
      }

      const sessionId = body.sessionId || `CS-${body.sessionDate.replace(/-/g, '')}-01`;
      const db: Queryable = injected?.queryable || getDatabasePool(env);
      const actorId = member.memberId || member.userId;
      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      const payloadHash = idempotencyKey ? computePayloadHash(body) : '';

      const result = await withTransaction(db, async (tx) => {
        if (idempotencyKey) {
          const claim = await claimIdempotency(tx, actorId, 'CASH_SESSION_OPEN', idempotencyKey, payloadHash);
          if (claim.action === 'RETURN_CACHED') {
            return { status: claim.responseCode || 200, payload: claim.responseBody };
          }
        }

        const session = await openCashSession(tx, {
          sessionId,
          sessionDate: body.sessionDate,
          openedBy: actorId,
          openingCash: body.openingCash,
          handedOverFromSessionId: body.handedOverFromSessionId,
          discrepancyReason: body.discrepancyReason,
        });

        const responsePayload = { data: serializeCashSession(session), message: 'Mở ca quầy tiền mặt thành công.' };
        if (idempotencyKey) {
          await completeIdempotency(tx, actorId, 'CASH_SESSION_OPEN', idempotencyKey, 201, responsePayload);
        }

        return { status: 201, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 12. Finance: Cash Session - Close Session (S05-08: Hỗ trợ Idempotency và Cache-Control)
    if (method === 'POST' && path === '/api/v1/finance/cash-session/close') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);

      const body = (await request.json().catch(() => ({}))) as any;
      if (!body.sessionId || body.actualClosingCash === undefined) {
        throw new BadRequestError('Thiếu ID phiên quầy hoặc số tiền thực đếm cuối ca.', 'MISSING_CLOSE_PARAMS', requestId);
      }

      const db: Queryable = injected?.queryable || getDatabasePool(env);
      const actorId = member.memberId || member.userId;
      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      const payloadHash = idempotencyKey ? computePayloadHash(body) : '';

      const result = await withTransaction(db, async (tx) => {
        if (idempotencyKey) {
          const claim = await claimIdempotency(tx, actorId, 'CASH_SESSION_CLOSE', idempotencyKey, payloadHash);
          if (claim.action === 'RETURN_CACHED') {
            return { status: claim.responseCode || 200, payload: claim.responseBody };
          }
        }

        const summary = await closeCashSession(tx, {
          sessionId: body.sessionId,
          closedBy: actorId,
          actualClosingCash: body.actualClosingCash,
          discrepancyReason: body.discrepancyReason,
        });

        const responsePayload = { data: serializeCashSessionSummary(summary), message: 'Đóng ca quầy thành công.' };
        if (idempotencyKey) {
          await completeIdempotency(tx, actorId, 'CASH_SESSION_CLOSE', idempotencyKey, 200, responsePayload);
        }

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 13. Finance: Cash Session - Summary & Reconciliation
    if (method === 'GET' && path.startsWith('/api/v1/finance/cash-session/') && path.endsWith('/summary')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const sessionId = path.replace('/api/v1/finance/cash-session/', '').replace('/summary', '');
      const db: Queryable = injected?.queryable || getDatabasePool(env);
      const summary = await getCashSessionSummary(db, sessionId);

      return new Response(JSON.stringify({ data: serializeCashSessionSummary(summary) }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 14. Catalog: Public Search Books
    if (method === 'GET' && (path === '/api/v1/books' || path === '/api/v1/catalog/books')) {
      const db = getDb(injected, env);
      const query = url.searchParams.get('query') || undefined;
      const author = url.searchParams.get('author') || undefined;
      const category = url.searchParams.get('category') || undefined;
      const page = Number(url.searchParams.get('page')) || 1;
      const limit = Number(url.searchParams.get('limit')) || 20;
      const sortBy = url.searchParams.get('sortBy') as any;
      const sortOrder = url.searchParams.get('sortOrder') as any;

      const result = await searchBooks(db, { query, author, category, page, limit, sortBy, sortOrder });

      return new Response(
        JSON.stringify({
          data: result.items,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          },
        }
      );
    }

    // 15. Catalog: Public Book Detail by ID
    if (
      method === 'GET' &&
      ((path.startsWith('/api/v1/books/') && !path.startsWith('/api/v1/books/copies')) ||
        (path.startsWith('/api/v1/catalog/books/') && !path.startsWith('/api/v1/catalog/books/copies')))
    ) {
      const db = getDb(injected, env);
      const bookId = path.startsWith('/api/v1/catalog/books/')
        ? path.replace('/api/v1/catalog/books/', '')
        : path.replace('/api/v1/books/', '');
      const book = await getBookById(db, bookId);

      if (!book) {
        throw new BookNotFoundError(`Không tìm thấy đầu sách ID '${bookId}'.`);
      }

      return new Response(JSON.stringify({ data: book }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      });
    }

    // 15b. Catalog: Internal List Book Copies (có phân trang & lọc status/search)
    if (
      method === 'GET' &&
      (path === '/api/v1/books/copies' || path === '/api/v1/catalog/books/copies')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const status = url.searchParams.get('status') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const page = Number(url.searchParams.get('page')) || 1;
      const limit = Number(url.searchParams.get('limit')) || 50;

      const result = await listBookCopies(db, { status, search, page, limit });

      return new Response(
        JSON.stringify({
          data: result.items,
          items: result.items,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
          total: result.total,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 16. Catalog: Internal Get Book Copy by Barcode
    if (
      method === 'GET' &&
      (path.startsWith('/api/v1/books/copies/') || path.startsWith('/api/v1/catalog/books/copies/'))
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      let barcode = path.startsWith('/api/v1/catalog/books/copies/')
        ? path.replace('/api/v1/catalog/books/copies/', '')
        : path.replace('/api/v1/books/copies/', '');
      if (barcode.startsWith('barcode/')) {
        barcode = barcode.replace('barcode/', '');
      }
      const copy = await getBookCopyByBarcode(db, barcode);

      if (!copy) {
        throw new CopyNotFoundError(`Không tìm thấy bản sách với mã vạch '${barcode}'.`);
      }

      return new Response(JSON.stringify({ data: copy }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 17. Catalog: Internal Create Book Copy
    if (method === 'POST' && (path === '/api/v1/books/copies' || path === '/api/v1/catalog/books/copies')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;
      const copy = await withTransaction(db, (tx) => createBookCopy(tx, body, actorId));

      return new Response(JSON.stringify({ data: copy, message: 'Thêm bản sách thành công.' }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 18. Catalog: Internal Update Book Copy Metadata
    if (
      method === 'PATCH' &&
      ((path.startsWith('/api/v1/books/copies/') && !path.endsWith('/archive')) ||
        (path.startsWith('/api/v1/catalog/books/copies/') && !path.endsWith('/archive')))
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const copyId = path.startsWith('/api/v1/catalog/books/copies/')
        ? path.replace('/api/v1/catalog/books/copies/', '')
        : path.replace('/api/v1/books/copies/', '');
      const body = (await request.json().catch(() => ({}))) as any;
      const copy = await withTransaction(db, async (tx) => {
        return await updateBookCopy(tx, copyId, body, actorId);
      });

      return new Response(JSON.stringify({ data: copy, message: 'Cập nhật bản sách thành công.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 19. Catalog: Internal Archive Book Copy
    if (
      method === 'POST' &&
      ((path.startsWith('/api/v1/books/copies/') && path.endsWith('/archive')) ||
        (path.startsWith('/api/v1/catalog/books/copies/') && path.endsWith('/archive')))
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const copyId = path.startsWith('/api/v1/catalog/books/copies/')
        ? path.replace('/api/v1/catalog/books/copies/', '').replace('/archive', '')
        : path.replace('/api/v1/books/copies/', '').replace('/archive', '');
      const copy = await withTransaction(db, async (tx) => {
        return await archiveBookCopy(tx, copyId, actorId);
      });

      return new Response(JSON.stringify({ data: copy, message: 'Lưu trữ bản sách thành công.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 20. Borrowers: Search & List (Internal only: Member/Admin)
    if (method === 'GET' && path === '/api/v1/borrowers') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const query = url.searchParams.get('query') || undefined;
      const includeArchived = url.searchParams.get('includeArchived') === 'true';
      const page = Number(url.searchParams.get('page')) || 1;
      const limit = Number(url.searchParams.get('limit')) || 20;

      const result = await searchBorrowers(db, { query, includeArchived, page, limit });

      return new Response(
        JSON.stringify({
          data: result.items,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 21. Borrowers: Get Detail by ID (Internal only)
    if (method === 'GET' && path.startsWith('/api/v1/borrowers/') && !path.endsWith('/archive')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const borrowerId = path.replace('/api/v1/borrowers/', '');
      const borrower = await getBorrowerById(db, borrowerId);

      if (!borrower) {
        throw new BorrowerNotFoundError(`Không tìm thấy hồ sơ người mượn ID '${borrowerId}'.`);
      }

      return new Response(JSON.stringify({ data: borrower }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 22. Borrowers: Create Borrower (Internal only)
    if (method === 'POST' && path === '/api/v1/borrowers') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;
      const borrower = await withTransaction(db, (tx) => createBorrower(tx, body, actorId));

      return new Response(JSON.stringify({ data: borrower, message: 'Tạo hồ sơ người mượn thành công.' }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 23. Borrowers: Update Borrower (Internal only)
    if (method === 'PATCH' && path.startsWith('/api/v1/borrowers/') && !path.endsWith('/archive')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const borrowerId = path.replace('/api/v1/borrowers/', '');
      const body = (await request.json().catch(() => ({}))) as any;
      const borrower = await withTransaction(db, async (tx) => {
        return await updateBorrower(tx, borrowerId, body, actorId);
      });

      return new Response(JSON.stringify({ data: borrower, message: 'Cập nhật hồ sơ người mượn thành công.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 24. Borrowers: Archive Borrower (Internal only)
    if (method === 'POST' && path.startsWith('/api/v1/borrowers/') && path.endsWith('/archive')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const borrowerId = path.replace('/api/v1/borrowers/', '').replace('/archive', '');
      const borrower = await withTransaction(db, async (tx) => {
        return await archiveBorrower(tx, borrowerId, actorId);
      });

      return new Response(JSON.stringify({ data: borrower, message: 'Lưu trữ hồ sơ người mượn thành công.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 25. Catalog: Create Book Title (Internal only: Member/Admin)
    if (method === 'POST' && (path === '/api/v1/books/titles' || path === '/api/v1/catalog/books/titles')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;
      const title = await withTransaction(db, async (tx) => {
        return await createBookTitle(tx, body, actorId);
      });

      return new Response(JSON.stringify({ data: title, message: 'Tạo đầu sách thành công.' }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 26. Catalog: Create Book Edition (Internal only: Member/Admin)
    if (
      method === 'POST' &&
      ((path.startsWith('/api/v1/books/') && path.endsWith('/editions')) ||
        (path.startsWith('/api/v1/catalog/books/') && path.endsWith('/editions')))
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const titleId = path.startsWith('/api/v1/catalog/books/')
        ? path.replace('/api/v1/catalog/books/', '').replace('/editions', '')
        : path.replace('/api/v1/books/', '').replace('/editions', '');
      const body = (await request.json().catch(() => ({}))) as any;
      body.titleId = titleId;

      const edition = await withTransaction(db, async (tx) => {
        return await createBookEdition(tx, body, actorId);
      });

      return new Response(JSON.stringify({ data: edition, message: 'Tạo ấn bản sách thành công.' }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 27. Circulation: Issue Loan Receipt (Internal only: Member/Admin, S06-01 & Chặng 07)
    if (method === 'POST' && path === '/api/v1/circulation/loans') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError('Bắt buộc cung cấp header X-Idempotency-Key khi lập phiếu cho mượn.', 'MISSING_IDEMPOTENCY_KEY', requestId);
      }

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;
      const payloadHash = computePayloadHash(body);

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'CIRCULATION_ISSUE_LOAN', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const receipt = await issueLoanReceipt(tx, { ...body, reservationId: undefined }, actorId);
        const responsePayload = { data: receipt, message: 'Lập phiếu mượn sách thành công.' };

        await completeIdempotency(tx, actorId, 'CIRCULATION_ISSUE_LOAN', idempotencyKey, 201, responsePayload);

        return { status: 201, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 28. Circulation: Get Loan Detail by ID (Internal only: Member/Admin)
    const loanDetailMatch = method === 'GET' && path.match(/^\/api\/v1\/circulation\/loans\/([a-zA-Z0-9_\-]+)$/);
    if (loanDetailMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const loanId = loanDetailMatch[1];
      const receipt = await getLoanReceiptById(db, loanId);

      if (!receipt) {
        throw new LoanReceiptNotFoundError(`Không tìm thấy phiếu mượn ID '${loanId}'.`);
      }

      return new Response(JSON.stringify({ data: receipt }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 29. Circulation: List Loans (Internal only: Member/Admin)
    if (method === 'GET' && path === '/api/v1/circulation/loans') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const borrowerId = url.searchParams.get('borrowerId') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;

      const result = await listLoanReceipts(db, { borrowerId, status, page, limit });

      return new Response(
        JSON.stringify({
          data: result.items,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 30. Circulation: Settle Return (Chặng 08: Full Return, Fine Policy & Refund Intents)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/settle-return')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/settle-return', '');

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi thực hiện tất toán trả sách.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;
      const payloadHash = computePayloadHash({ ...body, receiptId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'CIRCULATION_SETTLE_RETURN', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const settleResult = await settleReturnReceipt(tx, { ...body, receiptId }, actorId);
        const responsePayload = { data: settleResult, message: 'Tất toán trả sách thành công.' };

        await completeIdempotency(tx, actorId, 'CIRCULATION_SETTLE_RETURN', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 31. Circulation: Get Loan Settlement Details (Chặng 08)
    if (
      method === 'GET' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/settlement')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/settlement', '');

      const detail = await getLoanSettlementDetail(db, receiptId);

      return new Response(JSON.stringify({ data: detail }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 31b. Circulation: Quote Loan Action (S12-03: Trích xuất hạn hiệu lực, lịch nghỉ và mức phạt đề xuất từ server)
    const loanQuoteMatch = method === 'GET' && path.match(/^\/api\/v1\/circulation\/loans\/([a-zA-Z0-9_\-]+)\/quote$/);
    if (loanQuoteMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const receiptId = loanQuoteMatch[1];

      const actionParam = (url.searchParams.get('action') || 'RETURN').toUpperCase() as 'RETURN' | 'RENEW';
      const targetDate = url.searchParams.get('targetDate') || undefined;

      const quote = await quoteLoanAction(db, { receiptId, action: actionParam, targetDate });

      return new Response(JSON.stringify({ data: quote }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 31c. Circulation: List Pending Refund Intents (S12-03)
    if (method === 'GET' && path === '/api/v1/circulation/pending-refunds') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const pendingRefunds = await listPendingRefunds(db);

      return new Response(JSON.stringify({ data: pendingRefunds }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 31d. Circulation: List Pending Carried-Forward Deposits (T73 Pending Deposit)
    if (method === 'GET' && path === '/api/v1/circulation/pending-deposits') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const pendingDeposits = await listPendingDeposits(db);

      return new Response(JSON.stringify({ data: pendingDeposits }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 31e. Circulation: List Pending Fines (S12-03)
    if (method === 'GET' && path === '/api/v1/circulation/pending-fines') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const pendingFines = await listPendingFines(db);

      return new Response(JSON.stringify({ data: pendingFines }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 31f. Finance: Cancel Refund Intent (S12-03)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/finance/refunds/') &&
      path.endsWith('/cancel')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const intentId = path
        .replace('/api/v1/finance/refunds/', '')
        .replace('/cancel', '');

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;

      const result = await withTransaction(db, async (tx) => {
        return await cancelRefundIntent(tx, intentId, actorId, body.reason);
      });

      return new Response(JSON.stringify({ data: result, message: 'Hủy ý định hoàn cọc thành công.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 32. Finance: Confirm Refund Intent (Chặng 08)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/finance/refunds/') &&
      path.endsWith('/confirm')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const intentId = path
        .replace('/api/v1/finance/refunds/', '')
        .replace('/confirm', '');

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi xác nhận hoàn cọc.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = (await request.json().catch(() => ({}))) as any;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ.', 'INVALID_REQUEST_BODY', requestId);
      }
      if (body.paymentConfirmed !== true) {
        throw new BadRequestError(
          'Bắt buộc xác nhận tiền thực đã được giao hoặc kiểm tra app ngân hàng (paymentConfirmed: true).',
          'PAYMENT_UNCONFIRMED',
          requestId
        );
      }

      const payloadHash = computePayloadHash({ ...body, intentId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'FINANCE_REFUND_CONFIRM', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const confirmResult = await confirmRefund(tx, { ...body, refundIntentId: intentId }, actorId);
        const responsePayload = { data: confirmResult, message: 'Xác nhận hoàn cọc thành công.' };

        await completeIdempotency(tx, actorId, 'FINANCE_REFUND_CONFIRM', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 33. Circulation: Renew Loan (Chặng 10: Renewal)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/renew')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/renew', '');

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi thực hiện gia hạn phiếu mượn.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const payloadHash = computePayloadHash({ ...body, receiptId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'CIRCULATION_RENEW_LOAN', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const renewResult = await renewLoanReceipt(tx, { ...body, receiptId }, actorId);
        const responsePayload = { data: renewResult, message: renewResult.message };

        await completeIdempotency(tx, actorId, 'CIRCULATION_RENEW_LOAN', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 34. Circulation: Get Loan Renewal History (Chặng 10)
    if (
      method === 'GET' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/renewals')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/renewals', '');

      const renewals = await getLoanRenewals(db, receiptId);

      return new Response(JSON.stringify({ data: renewals }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 35. Circulation: Confirm New Deposit for carried-forward receipt (T73 Finalize)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/confirm-deposit')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/confirm-deposit', '');

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi xác nhận nộp cọc mới.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const payloadHash = computePayloadHash({ ...body, receiptId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'CIRCULATION_CONFIRM_DEPOSIT', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const confirmResult = await confirmNewDeposit(tx, { ...body, receiptId } as any, actorId);
        const responsePayload = { data: confirmResult, message: confirmResult.message };

        await completeIdempotency(tx, actorId, 'CIRCULATION_CONFIRM_DEPOSIT', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 36. Circulation: Collect Pending Fine (Chặng 10: Late fine collection)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/settlement/collect-fine')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/settlement/collect-fine', '');

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi thu phạt chờ thu.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const payloadHash = computePayloadHash({ ...body, receiptId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'CIRCULATION_COLLECT_FINE', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const collectResult = await collectPendingFine(tx, { ...body, receiptId } as any, actorId);
        const responsePayload = { data: collectResult, message: collectResult.message };

        await completeIdempotency(tx, actorId, 'CIRCULATION_COLLECT_FINE', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 37. Circulation: Calendar Holidays list (Public safe & Internal)
    if (method === 'GET' && path === '/api/v1/circulation/calendar/holidays') {
      const db = getDb(injected, env);
      const holidays = await listCalendarHolidays(db);

      return new Response(JSON.stringify({ data: holidays }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 38. Circulation: Calendar Holidays Add/Update (Internal Member/Admin)
    if (method === 'POST' && path === '/api/v1/circulation/calendar/holidays') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const holiday = await withTransaction(db, async (tx) => {
        return await addCalendarHoliday(tx, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: holiday, message: 'Cập nhật ngày nghỉ lễ thành công.' }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 39. Circulation: Report Book Loss (Chặng 11: Lost Book & Deposit Forfeiture)
    if (
      method === 'POST' &&
      path.startsWith('/api/v1/circulation/loans/') &&
      path.endsWith('/lost')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const receiptId = path
        .replace('/api/v1/circulation/loans/', '')
        .replace('/lost', '');

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi báo mất sách.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const payloadHash = computePayloadHash({ ...body, receiptId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'CIRCULATION_REPORT_BOOK_LOSS', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const lossResult = await reportBookLoss(tx, { ...body, receiptId } as any, actorId);
        const responsePayload = { data: lossResult, message: lossResult.message };

        await completeIdempotency(tx, actorId, 'CIRCULATION_REPORT_BOOK_LOSS', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 40. Finance: Double-Entry Ledger Document Correction / Reversal (Chặng 11)
    if (method === 'POST' && path === '/api/v1/finance/ledger/corrections') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new BadRequestError(
          'Bắt buộc cung cấp header X-Idempotency-Key khi thực hiện sửa sai chứng từ.',
          'MISSING_IDEMPOTENCY_KEY',
          requestId
        );
      }

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const payloadHash = computePayloadHash(body);

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'FINANCE_LEDGER_CORRECTION', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') {
          return { status: claim.responseCode || 200, payload: claim.responseBody };
        }

        const correctionResult = await createDocumentCorrection(tx, body as any, actorId);
        const responsePayload = { data: correctionResult, message: correctionResult.message };

        await completeIdempotency(tx, actorId, 'FINANCE_LEDGER_CORRECTION', idempotencyKey, 200, responsePayload);

        return { status: 200, payload: responsePayload };
      });

      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 41. Duty Availability: Preview XLSX Import (Chặng 14)
    if (method === 'POST' && path === '/api/v1/duty/availability/preview') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      if (!body.fileBase64 || typeof body.fileBase64 !== 'string') {
        throw new BadRequestError('Bắt buộc cung cấp dữ liệu tệp bảng tính mã hóa base64 (fileBase64).', 'MISSING_FILE_DATA', requestId);
      }

      const fileBuffer = Buffer.from(body.fileBase64, 'base64');
      const fileName = body.fileName || 'availability.xlsx';

      const previewResult = await previewAvailabilityFile(db, fileBuffer, fileName, {
        termSemester: body.termSemester,
        effectiveStartDate: body.effectiveStartDate,
        effectiveEndDate: body.effectiveEndDate,
      });

      return new Response(JSON.stringify({ data: previewResult }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 42. Duty Availability: Commit Import Batch with Versioning (Chặng 14)
    if (method === 'POST' && path === '/api/v1/duty/availability/commit') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const idempotencyKey = request.headers.get('X-Idempotency-Key') || undefined;
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const commitResult = await withTransaction(db, async (tx) => {
        return await commitAvailabilityBatch(
          tx,
          {
            ...body,
            idempotencyKey,
          } as any,
          actorId
        );
      });

      return new Response(
        JSON.stringify({
          data: commitResult.batch,
          intervalsCount: commitResult.intervalsCount,
          message: `Lưu đợt lịch bận thành công (${commitResult.intervalsCount} khoảng giờ).`,
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 43. Duty Availability: List Availability Batches (Chặng 14)
    if (method === 'GET' && path === '/api/v1/duty/availability/batches') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const url = new URL(request.url);
      const termSemester = url.searchParams.get('termSemester') || undefined;

      const batches = await listAvailabilityBatches(db, termSemester);

      return new Response(JSON.stringify({ data: batches, total: batches.length }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 44. Duty Availability: Get Member Busy Intervals (Chặng 14)
    if (
      method === 'GET' &&
      path.startsWith('/api/v1/duty/availability/members/')
    ) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const memberId = path.replace('/api/v1/duty/availability/members/', '');
      const db = getDb(injected, env);

      const intervals = await getMemberBusyIntervals(db, memberId);

      return new Response(JSON.stringify({ data: intervals, total: intervals.length }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 45. Duty Roster: Generate Draft Schedules (Chặng 15)
    if (method === 'POST' && path === '/api/v1/duty/schedules/generate') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const genResult = await withTransaction(db, async (tx) => {
        return await generateDraftSchedules(tx, body as any, actorId);
      });

      return new Response(JSON.stringify(genResult), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 46. Duty Roster: List Schedules (Chặng 15)
    if (method === 'GET' && path === '/api/v1/duty/schedules') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const url = new URL(request.url);
      const termSemester = url.searchParams.get('termSemester') || undefined;
      const status = url.searchParams.get('status') || undefined;

      const schedules = await listSchedules(db, termSemester, status);

      return new Response(JSON.stringify({ data: schedules, total: schedules.length }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 47. Duty Roster: Get Schedule by ID (Chặng 15)
    if (method === 'GET' && path.startsWith('/api/v1/duty/schedules/') && !path.includes('/publish') && !path.includes('/attendance') && !path.includes('/manual-edit')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const scheduleId = path.replace('/api/v1/duty/schedules/', '');
      const db = getDb(injected, env);

      const schedule = await getScheduleById(db, scheduleId);
      if (!schedule) {
        throw new NotFoundError(`Không tìm thấy ca trực với mã ${scheduleId}`, 'SCHEDULE_NOT_FOUND', requestId);
      }

      return new Response(JSON.stringify({ data: schedule }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 48. Duty Roster: Manual Edit Schedule (Chặng 15)
    if (method === 'PUT' && path.endsWith('/manual-edit') && path.startsWith('/api/v1/duty/schedules/')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const scheduleId = path.replace('/api/v1/duty/schedules/', '').replace('/manual-edit', '');
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const updated = await withTransaction(db, async (tx) => {
        return await manualEditSchedule(tx, scheduleId, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: updated }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 49. Duty Roster: Publish Schedule (Chặng 15)
    if (method === 'POST' && path.endsWith('/publish') && path.startsWith('/api/v1/duty/schedules/')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const scheduleId = path.replace('/api/v1/duty/schedules/', '').replace('/publish', '');
      const db = getDb(injected, env);

      const published = await withTransaction(db, async (tx) => {
        return await publishSchedule(tx, scheduleId, actorId);
      });

      return new Response(JSON.stringify({ data: published }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 50. Duty Roster: Update Attendance (Chặng 15)
    if (method === 'POST' && path.endsWith('/attendance') && path.startsWith('/api/v1/duty/schedules/')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const scheduleId = path.replace('/api/v1/duty/schedules/', '').replace('/attendance', '');
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const assignee = await withTransaction(db, async (tx) => {
        return await updateAttendance(tx, scheduleId, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: assignee }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // MODULE: TUYỂN THÀNH VIÊN - FORM WEBHOOK & RECONCILIATION (CHẶNG 16)
    // ═══════════════════════════════════════════════════════════════

    // 51. Recruitment: Webhook Tiếp Nhận Đơn Google Form (Chặng 16)
    if (method === 'POST' && path === '/api/v1/recruitment/webhook/google-form') {
      const db = getDb(injected, env);
      let rawBody: string;
      try {
        rawBody = await request.text();
      } catch {
        throw new BadRequestError('Không thể đọc dữ liệu webhook.', 'INVALID_REQUEST_BODY', requestId);
      }

      const signatureHeader = request.headers.get('x-ysbk-signature');
      const secretHeader = request.headers.get('x-webhook-secret');
      const timestampHeader = request.headers.get('x-timestamp');

      // Xác thực bảo mật: HMAC-SHA256 hoặc Shared Secret + Chống Replay (5 phút) + Max 2MB
      verifyWebhookSecurity({
        rawBody,
        signatureHeader,
        secretHeader,
        timestampHeader,
        configuredSecret: env?.RECRUITMENT_WEBHOOK_SECRET,
      });

      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new BadRequestError('Dữ liệu webhook không phải JSON hợp lệ.', 'INVALID_JSON_PAYLOAD', requestId);
      }

      const result = await withTransaction(db, async (tx) => {
        return await ingestFormResponse(tx, payload);
      });

      const httpStatus = result.isDuplicate ? 200 : 201;
      return new Response(JSON.stringify({ data: result.response, isDuplicate: result.isDuplicate, isUpdated: result.isUpdated }), {
        status: httpStatus,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 52. Recruitment: Danh sách hồ sơ tuyển sinh nội bộ (Chỉ Thành Viên/Admin, Chặn Guest/Cựu)
    if (method === 'GET' && path === '/api/v1/recruitment/responses') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const url = new URL(request.url);
      const formId = url.searchParams.get('formId') || undefined;
      const aspiration = url.searchParams.get('aspiration') || undefined;
      const search = url.searchParams.get('search') || undefined;

      const responses = await listRecruitmentResponses(db, { formId, aspiration, search });

      return new Response(JSON.stringify({ data: responses }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 53. Recruitment: Chạy đối soát bù đơn thiếu (Reconcile Checkpoint)
    if (method === 'POST' && path === '/api/v1/recruitment/reconcile') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      if (!body.formId || !Array.isArray(body.observedPayloads)) {
        throw new BadRequestError('Thiếu formId hoặc danh sách observedPayloads để đối soát.', 'INVALID_RECONCILE_PAYLOAD', requestId);
      }

      const result = await withTransaction(db, async (tx) => {
        return await reconcileFormResponses(tx, body.formId, body.observedPayloads, actorId);
      });

      return new Response(JSON.stringify({ data: result }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 54. Recruitment: Thống kê số lượng ứng viên công khai (Đã Mask/Strip PII)
    if (method === 'GET' && path === '/api/v1/recruitment/responses/public-summary') {
      const db = getDb(injected, env);
      const url = new URL(request.url);
      const formId = url.searchParams.get('formId') || undefined;

      const summary = await getPublicRecruitmentSummary(db, formId);

      return new Response(JSON.stringify({ data: summary }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // MODULE: TUYỂN THÀNH VIÊN - EVALUATION & DECISIONS (CHẶNG 17)
    // ═══════════════════════════════════════════════════════════════

    // 55. Recruitment: Tạo Rubric theo Version & Tiêu chí (R07)
    if (method === 'POST' && path === '/api/v1/recruitment/rubrics') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const rubric = await withTransaction(db, async (tx) => {
        return await createRubric(tx, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: rubric }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 56. Recruitment: Lấy chi tiết Rubric theo ID (Chặn Guest & Alumni 403)
    if (method === 'GET' && path.startsWith('/api/v1/recruitment/rubrics/')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const rubricId = path.replace('/api/v1/recruitment/rubrics/', '');
      const db = getDb(injected, env);

      const rubric = await getRubricById(db, rubricId);

      return new Response(JSON.stringify({ data: rubric }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 57. Recruitment: Chấm điểm / Đánh giá phỏng vấn độc lập (Chặn Guest & Alumni 403)
    if (method === 'POST' && path === '/api/v1/recruitment/evaluations') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const evalResult = await withTransaction(db, async (tx) => {
        return await submitEvaluation(tx, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: evalResult }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 58. Recruitment: Chỉnh sửa điểm đánh giá có lý do & phiên bản (Chặn Guest & Alumni 403)
    if (method === 'PUT' && path.startsWith('/api/v1/recruitment/evaluations/')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const evalId = path.replace('/api/v1/recruitment/evaluations/', '');
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const result = await withTransaction(db, async (tx) => {
        return await editEvaluation(tx, { ...body, evaluationId: evalId } as any, actorId);
      });

      return new Response(
        JSON.stringify({
          data: { evaluation: result.evaluation, history: result.history },
          evaluation: result.evaluation,
          history: result.history,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 59. Recruitment: Lấy danh sách điểm & đánh giá của ứng viên (Chặn Guest & Alumni 403)
    if (method === 'GET' && path.startsWith('/api/v1/recruitment/responses/') && path.endsWith('/evaluations')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const responseId = path.replace('/api/v1/recruitment/responses/', '').replace('/evaluations', '');
      const db = getDb(injected, env);

      const evals = await getEvaluationsByResponseId(db, responseId);

      return new Response(JSON.stringify({ data: evals }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 60. Recruitment: Lấy lịch sử sửa điểm của đánh giá (Chặn Guest & Alumni 403)
    if (method === 'GET' && path.startsWith('/api/v1/recruitment/evaluations/') && path.endsWith('/history')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const evalId = path.replace('/api/v1/recruitment/evaluations/', '').replace('/history', '');
      const db = getDb(injected, env);

      const history = await getEvaluationHistory(db, evalId);

      return new Response(JSON.stringify({ data: history }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 61. Recruitment: Tổng kết Hội đồng & Quyết định tuyển dụng
    if (method === 'POST' && path === '/api/v1/recruitment/decisions') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const decision = await withTransaction(db, async (tx) => {
        return await finalizeDecision(tx, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: decision }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 62. Recruitment: Chuyển ứng viên trúng tuyển sang thành viên CLB (Chỉ Admin, Idempotent)
    const convertMemberMatch = path.match(/^\/api\/v1\/recruitment\/decisions\/([a-zA-Z0-9_\-]+)\/convert-member$/);
    if (method === 'POST' && convertMemberMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const admin = requireAdmin(actor);
      const actorId = admin.memberId || admin.userId;

      const responseId = convertMemberMatch[1];
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId).catch(() => ({}));

      const result = await withTransaction(db, async (tx) => {
        return await convertPassedApplicantToMember(tx, responseId, actorId, body as any);
      });

      return new Response(
        JSON.stringify({
          data: {
            member: result.member,
            decision: result.decision,
            isAlreadyConverted: result.isAlreadyConverted,
          },
          member: result.member,
          decision: result.decision,
          isAlreadyConverted: result.isAlreadyConverted,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 63. Recruitment: Phê duyệt công bố kết quả tuyển sinh ra công chúng (Chỉ Admin)
    if (method === 'POST' && path === '/api/v1/recruitment/announcements/approve') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const admin = requireAdmin(actor);
      const actorId = admin.memberId || admin.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const ann = await withTransaction(db, async (tx) => {
        return await approvePublicAnnouncement(tx, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: ann }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 64. Recruitment: Danh sách kết quả tuyển sinh công khai (R13, Public safe, Không lộ PII)
    if (method === 'GET' && path === '/api/v1/recruitment/announcements/public-results') {
      const db = getDb(injected, env);
      const url = new URL(request.url);
      const campaignId = url.searchParams.get('campaignId') || 'CAMPAIGN_GEN_10';

      const results = await getPublicApprovedResults(db, campaignId);

      return new Response(JSON.stringify({ data: results }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 65. Sales: Tạo mới nhà sách / nhà cung cấp ký gửi (Thành viên CLB)
    if (method === 'POST' && path === '/api/v1/sales/suppliers') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const supplier = await withTransaction(db, async (tx) => {
        return await createSupplier(tx, body as any);
      });

      return new Response(JSON.stringify({ data: supplier }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 66. Sales: Lấy danh sách nhà sách
    if (method === 'GET' && path === '/api/v1/sales/suppliers') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const suppliers = await getSuppliers(db);

      return new Response(JSON.stringify({ data: suppliers }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 67. Sales: Tạo lô sách ký gửi mới
    if (method === 'POST' && path === '/api/v1/sales/lots') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const lot = await withTransaction(db, async (tx) => {
        return await createLot(tx, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: lot }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 68. Sales: Danh sách các lô sách
    if (method === 'GET' && path === '/api/v1/sales/lots') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const db = getDb(injected, env);
      const url = new URL(request.url);
      const supplierId = url.searchParams.get('supplierId') || undefined;

      const lots = await listLots(db, supplierId);

      return new Response(JSON.stringify({ data: lots }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 69. Sales: Chi tiết một lô sách
    const salesLotDetailMatch = path.match(/^\/api\/v1\/sales\/lots\/([a-zA-Z0-9_\-]+)$/);
    if (method === 'GET' && salesLotDetailMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const lotId = salesLotDetailMatch[1];
      const db = getDb(injected, env);

      const lot = await getLotDetails(db, lotId);

      return new Response(JSON.stringify({ data: lot }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 70. Sales: Bán sách tại quầy (Record Book Sale)
    const salesLotSellMatch = path.match(/^\/api\/v1\/sales\/lots\/([a-zA-Z0-9_\-]+)\/sell$/);
    if (method === 'POST' && salesLotSellMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const idempotencyKey = request.headers.get('x-idempotency-key') || body.idempotencyKey || undefined;

      const result = await withTransaction(db, async (tx) => {
        return await recordBookSale(tx, { ...body, idempotencyKey } as any, actorId);
      });

      return new Response(
        JSON.stringify({
          data: { sale: result.sale, updatedItem: result.updatedItem },
          sale: result.sale,
          updatedItem: result.updatedItem,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 71. Sales: Trả sách dư vật lý về nhà sách (Physical Returns)
    const salesLotReturnMatch = path.match(/^\/api\/v1\/sales\/lots\/([a-zA-Z0-9_\-]+)\/return-books$/);
    if (method === 'POST' && salesLotReturnMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const lotId = salesLotReturnMatch[1];
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const result = await withTransaction(db, async (tx) => {
        return await returnUnsoldBooks(tx, lotId, body as any, actorId);
      });

      return new Response(
        JSON.stringify({
          data: { returnReceipt: result.returnReceipt, updatedItem: result.updatedItem },
          returnReceipt: result.returnReceipt,
          updatedItem: result.updatedItem,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 72. Sales: Giữ lại sách để bán tiếp đợt sau (Retain Books)
    const salesLotRetainMatch = path.match(/^\/api\/v1\/sales\/lots\/([a-zA-Z0-9_\-]+)\/retain-books$/);
    if (method === 'POST' && salesLotRetainMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const lotId = salesLotRetainMatch[1];
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const updatedItem = await withTransaction(db, async (tx) => {
        return await retainBooksForNextPeriod(tx, lotId, body as any, actorId);
      });

      return new Response(JSON.stringify({ data: updatedItem }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 73. Sales: Xem chi tiết hoặc tính toán trước quyết toán lô sách
    const salesLotSettlementMatch = path.match(/^\/api\/v1\/sales\/lots\/([a-zA-Z0-9_\-]+)\/settlement$/);
    if (method === 'GET' && salesLotSettlementMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);

      const lotId = salesLotSettlementMatch[1];
      const db = getDb(injected, env);

      const existing = await getSettlementByLotId(db, lotId);
      if (existing.settlement) {
        return new Response(
          JSON.stringify({
            data: { settlement: existing.settlement, payments: existing.payments },
            settlement: existing.settlement,
            payments: existing.payments,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Request-Id': requestId,
              'Cache-Control': 'no-store',
            },
          }
        );
      }

      // Chưa có quyết toán chính thức: tính toán trước preview
      const preview = await calculateLotSettlement(db, lotId);
      return new Response(
        JSON.stringify({
          data: { preview },
          preview,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 74. Sales: Lập chứng từ quyết toán chính thức cho lô sách (Idempotent)
    const salesLotSettlementsPostMatch = path.match(/^\/api\/v1\/sales\/lots\/([a-zA-Z0-9_\-]+)\/settlements$/);
    if (method === 'POST' && salesLotSettlementsPostMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const lotId = salesLotSettlementsPostMatch[1];
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const idempotencyKey = request.headers.get('x-idempotency-key') || body.idempotencyKey || undefined;

      const settlement = await withTransaction(db, async (tx) => {
        return await createSettlement(tx, { ...body, lotId, idempotencyKey } as any, actorId);
      });

      return new Response(JSON.stringify({ data: settlement }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 75. Sales: Ghi nhận thanh toán tiền sách hoặc nhận hoàn cọc nhà sách
    const salesSettlementPaymentsMatch = path.match(/^\/api\/v1\/sales\/settlements\/([a-zA-Z0-9_\-]+)\/payments$/);
    if (method === 'POST' && salesSettlementPaymentsMatch) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const actorId = member.memberId || member.userId;

      const settlementId = salesSettlementPaymentsMatch[1];
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const idempotencyKey = request.headers.get('x-idempotency-key') || body.idempotencyKey || undefined;

      const result = await withTransaction(db, async (tx) => {
        return await recordSupplierPayment(tx, settlementId, { ...body, idempotencyKey } as any, actorId);
      });

      return new Response(
        JSON.stringify({
          data: { payment: result.payment, settlement: result.settlement },
          payment: result.payment,
          settlement: result.settlement,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 76. Events: Lấy danh sách hoạt động / sự kiện (Phân quyền Allowlist: Member full, Alumni allowlist, Guest public)
    if (method === 'GET' && path === '/api/v1/events') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const db = getDb(injected, env);
      const data = await getActivities(db, actor);
      return new Response(JSON.stringify({ data, total: (data as any[]).length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 77. Events: Tạo mới hoạt động / sự kiện (Chỉ Thành viên hoạt động / Admin)
    if (method === 'POST' && path === '/api/v1/events') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const activity = await createActivity(db, member, body as any);
      return new Response(JSON.stringify({ data: activity }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 78. Events: Danh sách hoạt động công khai cho khách ngoài / vãng lai
    if (method === 'GET' && path === '/api/v1/public/activities') {
      const db = getDb(injected, env);
      const data = await getActivities(db, null);
      return new Response(JSON.stringify({ data, total: (data as any[]).length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 79. Events: Lấy chi tiết hoạt động (MEMBER full, ALUMNI allowlist, GUEST public)
    const eventDetailMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && eventDetailMatch) {
      const eventId = eventDetailMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const db = getDb(injected, env);
      const detail = await getActivityById(db, eventId, actor);
      return new Response(JSON.stringify({ data: detail }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 80. Events: Cập nhật thông tin / trạng thái / duyệt công khai hoạt động
    if (method === 'PATCH' && eventDetailMatch) {
      const eventId = eventDetailMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const updated = await updateActivity(db, eventId, member, body as any);
      return new Response(JSON.stringify({ data: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 81. Events: Thêm nhiệm vụ vào hoạt động
    const taskCreateMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/tasks$/);
    if (method === 'POST' && taskCreateMatch) {
      const eventId = taskCreateMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const task = await createTask(db, eventId, member, body as any);
      return new Response(JSON.stringify({ data: task }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 82. Events: Cập nhật nhiệm vụ (Có audit log bắt buộc lý do)
    const taskUpdateMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/tasks\/([a-zA-Z0-9_-]+)$/);
    if (method === 'PATCH' && taskUpdateMatch) {
      const taskId = taskUpdateMatch[2];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const updated = await updateTask(db, taskId, member, body as any);
      return new Response(JSON.stringify({ data: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 83. Events: Lấy lịch sử audit log của nhiệm vụ
    const taskHistoryMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/tasks\/([a-zA-Z0-9_-]+)\/history$/);
    if (method === 'GET' && taskHistoryMatch) {
      const taskId = taskHistoryMatch[2];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const history = await getTaskHistory(db, taskId, member);
      return new Response(JSON.stringify({ data: history, total: history.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 84. Events: Thêm người tham gia (Thành viên hoặc Khách ngoài R07)
    const participantCreateMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/participants$/);
    if (method === 'POST' && participantCreateMatch) {
      const eventId = participantCreateMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const participant = await addParticipant(db, eventId, member, body as any);
      return new Response(JSON.stringify({ data: participant }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 85. Events: Cập nhật người tham gia (Điểm danh, vai trò, trạng thái)
    const participantUpdateMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/participants\/([a-zA-Z0-9_-]+)$/);
    if (method === 'PATCH' && participantUpdateMatch) {
      const participantId = participantUpdateMatch[2];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const updated = await updateParticipant(db, participantId, member, body as any);
      return new Response(JSON.stringify({ data: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 86. Events: Thêm khoản dự toán kế hoạch (Budget Item)
    const budgetCreateMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/budget-items$/);
    if (method === 'POST' && budgetCreateMatch) {
      const eventId = budgetCreateMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const budgetItem = await createBudgetItem(db, eventId, member, body as any);
      return new Response(JSON.stringify({ data: budgetItem }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 87. Events: Ghi nhận chi phí thực tế liên kết Sổ quỹ kép journal_entries (FUND_OPERATION)
    const expenseCreateMatch = path.match(/^\/api\/v1\/events\/([a-zA-Z0-9_-]+)\/expenses$/);
    if (method === 'POST' && expenseCreateMatch) {
      const eventId = expenseCreateMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);

      const expense = await withTransaction(db, async (tx) => {
        return await recordExpense(tx, eventId, member, body as any);
      });

      return new Response(JSON.stringify({ data: expense }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 88. Content: Public Reviews (Approved only)
    if (method === 'GET' && (path === '/api/v1/public/reviews' || path === '/api/v1/reviews')) {
      const bookId = url.searchParams.get('bookId') || undefined;
      const db = getDb(injected, env);
      const reviews = await getPublicReviews(db, bookId);
      return new Response(JSON.stringify({ data: reviews, total: reviews.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'public, max-age=60' },
      });
    }

    // 89. Content: Public Reviews for specific book
    const bookReviewsMatch = path.match(/^\/api\/v1\/(public\/)?books\/([a-zA-Z0-9_-]+)\/reviews$/);
    if (method === 'GET' && bookReviewsMatch) {
      const bookId = bookReviewsMatch[2];
      const db = getDb(injected, env);
      const reviews = await getPublicReviews(db, bookId);
      return new Response(JSON.stringify({ data: reviews, total: reviews.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'public, max-age=60' },
      });
    }

    // 90. Content: Submit Book Review (Guest có phiên hợp lệ hoặc Member)
    if (method === 'POST' && (path === '/api/v1/content/reviews' || path === '/api/v1/reviews')) {
      const actor = await resolveActorFromRequest(request, env, injected);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const review = await submitBookReview(db, actor, body as any);
      return new Response(JSON.stringify({ data: review, message: 'Đánh giá đã được gửi và đang chờ kiểm duyệt.' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 91. Content: Edit Book Review (Tạo pending version mới nếu đã duyệt)
    const reviewEditMatch = path.match(/^\/api\/v1\/(content\/)?reviews\/([a-zA-Z0-9_-]+)$/);
    if (method === 'PUT' && reviewEditMatch) {
      const reviewId = reviewEditMatch[2];
      const actor = await resolveActorFromRequest(request, env, injected);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const updated = await editBookReview(db, actor, reviewId, body as any);
      return new Response(JSON.stringify({ data: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 92. Content: Moderation - Get Reviews (Member nội bộ)
    if (method === 'GET' && path === '/api/v1/moderation/reviews') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const status = url.searchParams.get('status') || undefined;
      const bookId = url.searchParams.get('bookId') || undefined;
      const db = getDb(injected, env);
      const reviews = await getReviewsForModeration(db, member, { status, bookId });
      return new Response(JSON.stringify({ data: reviews, total: reviews.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 93. Content: Moderation - Approve / Reject Review (Member nội bộ)
    const reviewModerateMatch = path.match(/^\/api\/v1\/moderation\/reviews\/([a-zA-Z0-9_-]+)\/decision$/);
    if (method === 'POST' && reviewModerateMatch) {
      const reviewId = reviewModerateMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const review = await moderateBookReview(db, member, reviewId, body as any);
      return new Response(JSON.stringify({ data: review }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 94. Content: Public Posts (Published only)
    if (method === 'GET' && (path === '/api/v1/public/posts' || path === '/api/v1/posts')) {
      const category = url.searchParams.get('category') || undefined;
      const db = getDb(injected, env);
      const posts = await getPublicPosts(db, category);
      return new Response(JSON.stringify({ data: posts, total: posts.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'public, max-age=120' },
      });
    }

    // 95. Content: Public Post Detail by Slug
    const postSlugMatch = path.match(/^\/api\/v1\/(public\/)?posts\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && postSlugMatch) {
      const slug = postSlugMatch[2];
      const db = getDb(injected, env);
      const post = await getPublicPostBySlug(db, slug);
      return new Response(JSON.stringify({ data: post }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'public, max-age=120' },
      });
    }

    // 96. Content: Create Public Post (Member nội bộ)
    if (method === 'POST' && path === '/api/v1/moderation/posts') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const body = await parseJsonObject(request, requestId);
      const post = await createPublicPost(db, member, body as any);
      return new Response(JSON.stringify({ data: post }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 97. Content: Publish Public Post (Member nội bộ)
    const postPublishMatch = path.match(/^\/api\/v1\/moderation\/posts\/([a-zA-Z0-9_-]+)\/publish$/);
    if (method === 'POST' && postPublishMatch) {
      const postId = postPublishMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const post = await publishPublicPost(db, member, postId);
      return new Response(JSON.stringify({ data: post }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 98. Reports: Financial Summary Report (Member nội bộ)
    if (method === 'GET' && path === '/api/v1/reports/financial/summary') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const period = (url.searchParams.get('period') as ReportPeriod) || undefined;
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const fundId = (url.searchParams.get('fundId') as any) || undefined;
      const report = await getFinancialSummaryReport(db, member, { period, startDate, endDate, fundId });
      return new Response(JSON.stringify({ data: report }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 99. Reports: Financial Drilldown (Member nội bộ)
    if (method === 'GET' && path === '/api/v1/reports/financial/drilldown') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const period = (url.searchParams.get('period') as ReportPeriod) || undefined;
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const fundId = (url.searchParams.get('fundId') as any) || undefined;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;
      const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined;
      const result = await getFinancialDrilldown(db, member, { period, startDate, endDate, fundId }, { limit, offset });
      return new Response(JSON.stringify({ data: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 100. Reports: Circulation Summary Report (Member nội bộ)
    if (method === 'GET' && path === '/api/v1/reports/circulation/summary') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const report = await getCirculationSummaryReport(db, member, { startDate, endDate });
      return new Response(JSON.stringify({ data: report }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 101. Reports: Create Export Download Ticket (Member nội bộ)
    if (method === 'POST' && path === '/api/v1/reports/export/ticket') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const body = (await parseJsonObject(request, requestId)) as any;
      const reportType = body?.reportType || 'FINANCIAL_SUMMARY';
      const format = body?.format || 'CSV';
      const ticket = createExportTicket(member, reportType, body?.params || {}, format, env?.JWT_SECRET);
      return new Response(JSON.stringify({ data: ticket }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 102. Reports: Download Export File (Kiểm tra vé tải và quyền sống của actor)
    const downloadMatch = path.match(/^\/api\/v1\/reports\/download\/([a-zA-Z0-9_.-]+)$/);
    if (method === 'GET' && downloadMatch) {
      const ticketStr = downloadMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const ticket = await validateAndConsumeExportTicketAsync(ticketStr, member, env?.JWT_SECRET, db);

      let fileContent = '';
      let filename = 'bao-cao.csv';
      let contentType = 'text/csv; charset=utf-8';

      if (ticket.format === 'XLSX') {
        return new Response(JSON.stringify({
          error: {
            code: 'NATIVE_XLSX_ENGINE_NOT_AVAILABLE',
            message: 'Định dạng XLSX nguyên bản chưa có engine chuyển đổi nhị phân trên môi trường này. Vui lòng chọn định dạng Excel XML (.xls) hoặc CSV chuẩn UTF-8.',
          }
        }), {
          status: 501,
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
        });
      }

      if (ticket.format === 'PDF') {
        return new Response(JSON.stringify({
          error: {
            code: 'NATIVE_PDF_ENGINE_NOT_AVAILABLE',
            message: 'Định dạng PDF nguyên bản yêu cầu headless browser renderer. Vui lòng chọn định dạng Bản in HTML (.html) hoặc CSV chuẩn UTF-8.',
          }
        }), {
          status: 501,
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
        });
      }

      const isExcel = ticket.format === 'XML_EXCEL';
      const isHtml = ticket.format === 'HTML';

      if (ticket.reportType === 'FINANCIAL_SUMMARY') {
        const report = await getFinancialSummaryReport(db, member, ticket.params);
        const drilldown = await getFinancialDrilldown(db, member, ticket.params, { limit: 500 });
        if (isExcel) {
          fileContent = renderFinancialSummaryExcel(report, drilldown.items);
          filename = `bao-cao-tai-chinh-${report.filter.startDate}-${report.filter.endDate}.xls`;
          contentType = 'application/vnd.ms-excel; charset=utf-8';
        } else if (isHtml) {
          fileContent = renderFinancialSummaryHtml(report, drilldown.items);
          filename = `bao-cao-tai-chinh-${report.filter.startDate}-${report.filter.endDate}.html`;
          contentType = 'text/html; charset=utf-8';
        } else {
          fileContent = renderFinancialSummaryCsv(report, drilldown.items);
          filename = `bao-cao-tai-chinh-${report.filter.startDate}-${report.filter.endDate}.csv`;
          contentType = 'text/csv; charset=utf-8';
        }
      } else if (ticket.reportType === 'CIRCULATION') {
        const report = await getCirculationSummaryReport(db, member, ticket.params);
        if (isExcel) {
          fileContent = renderCirculationSummaryExcel(report);
          filename = `bao-cao-luu-thong-${report.filter.startDate}-${report.filter.endDate}.xls`;
          contentType = 'application/vnd.ms-excel; charset=utf-8';
        } else {
          fileContent = renderCirculationSummaryCsv(report);
          filename = `bao-cao-luu-thong-${report.filter.startDate}-${report.filter.endDate}.csv`;
          contentType = 'text/csv; charset=utf-8';
        }
      } else {
        const drilldown = await getFinancialDrilldown(db, member, ticket.params, { limit: 500 });
        const report = await getFinancialSummaryReport(db, member, ticket.params);
        if (isExcel) {
          fileContent = renderFinancialSummaryExcel(report, drilldown.items);
          filename = `drilldown-so-cai.xls`;
          contentType = 'application/vnd.ms-excel; charset=utf-8';
        } else {
          fileContent = renderFinancialSummaryCsv(report, drilldown.items);
          filename = `drilldown-so-cai.csv`;
          contentType = 'text/csv; charset=utf-8';
        }
      }

      return new Response(fileContent, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store, private',
        },
      });
    }

    // 103. Audit: Get System Audit Logs (Chỉ Admin)
    if (method === 'GET' && path === '/api/v1/audit/logs') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const admin = requireAdmin(actor);
      const db = getDb(injected, env);
      const actorId = url.searchParams.get('actorId') || undefined;
      const action = url.searchParams.get('action') || undefined;
      const targetResource = url.searchParams.get('targetResource') || undefined;
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;
      const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined;
      const result = await getSystemAuditLogs(
        db,
        admin,
        { actorId, action, targetResource, startDate, endDate },
        { limit, offset }
      );
      return new Response(JSON.stringify({ data: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 104. Audit: Get Analytics Summary (Member nội bộ)
    if (method === 'GET' && path === '/api/v1/audit/analytics') {
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const db = getDb(injected, env);
      const summary = await getAnalyticsSummary(db, member);
      return new Response(JSON.stringify({ data: summary }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 105. Public: List Reservation Books (Công khai)
    if (method === 'GET' && path === '/api/v1/public/reservation-books') {
      const db = getDb(injected, env);
      const search = url.searchParams.get('search') || undefined;
      const page = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 20);
      const result = await listPublicReservationBooks(db, { search, category: url.searchParams.get('category') || undefined, page, limit,
        includeUnavailable: url.searchParams.get('includeUnavailable') === 'true', onlyAvailable: url.searchParams.get('onlyAvailable') === 'true' });
      return new Response(JSON.stringify({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit, categories: result.categories } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 106. Public: List Pickup Schedules (Công khai)
    if (method === 'GET' && path === '/api/v1/public/pickup-schedules') {
      const db = getDb(injected, env);
      const schedules = await listPublicPickupSchedules(db);
      return new Response(JSON.stringify({ data: schedules, meta: { total: schedules.length } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 107. Public: Create Reservation (1 cuốn / đơn, không đăng nhập, CAPTCHA, Transaction) (PRF-01, PRF-04, PRF-09)
    if (method === 'POST' && path === '/api/v1/public/reservations') {
      const clientIp = resolveClientIp(request, injected, env);
      const idempotencyKey = request.headers.get('idempotency-key') || undefined;
      const body = (await parseJsonObject(request, requestId)) as any;
      const captchaToken = body?.captchaToken;
      const db = getDb(injected, env);

      // PRF-09: Replay check trước khi verify CAPTCHA nếu có idempotencyKey
      // Nếu đã có đơn commit với idempotencyKey này, replay hợp lệ không tiêu thụ token CAPTCHA lần hai
      let isExistingReplay = false;
      if (idempotencyKey) {
        const checkExisting = await db.query<any>(
          `SELECT id FROM reservations WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        if (checkExisting.rows && checkExisting.rows.length > 0) {
          isExistingReplay = true;
        }
      }

      if (!isExistingReplay) {
        if (env?.NODE_ENV === 'production' && !env.TURNSTILE_EXPECTED_HOSTNAME) {
          throw new ServiceUnavailableError('Chưa cấu hình hostname xác thực CAPTCHA.', 'CAPTCHA_CONFIG_MISSING');
        }
        // 1. Xác thực CAPTCHA server-side fail-closed
        const captchaResult = await verifyTurnstileToken(
          captchaToken,
          clientIp,
          env?.TURNSTILE_SECRET_KEY,
          injected?.turnstileFetch,
          { expectedHostname: env?.TURNSTILE_EXPECTED_HOSTNAME, expectedAction: 'reservation',
            allowTestKeys: env?.NODE_ENV === 'development' && env.LOCAL_TESTING === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname) }
        );
        if (!captchaResult.success) {
          throw new BadRequestError('Xác minh CAPTCHA không hợp lệ hoặc đã hết hạn.', 'CAPTCHA_INVALID');
        }
      }

      // 2. Tạo đơn giữ chỗ trong transaction (PRF-04)
      const result = await withTransaction(db, async (tx) => {
        return await createReservation(
          tx,
          {
            titleId: body?.titleId,
            scheduleId: body?.scheduleId,
            fullName: body?.fullName,
            phone: body?.phone,
            studentId: body?.studentId,
            university: body?.university,
            email: body?.email,
          },
          {
            clientIp,
            idempotencyKey,
            captchaToken: captchaToken || 'replay-verified',
            now: injected?.now,
            secret: env?.RESERVATION_IP_SECRET || env?.JWT_SECRET,
          }
        );
      });

      const status = result.isReplay ? 200 : 201;
      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 108. Public: Get Reservation by Lookup Token
    if (method === 'GET' && path === '/api/v1/public/reservation') {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        throw new UnauthorizedError('Thiếu mã tra cứu đơn đặt trong Authorization header.', 'LOOKUP_TOKEN_MISSING');
      }
      const db = getDb(injected, env);
      const reservation = await getReservationByToken(db, token);
      return new Response(JSON.stringify({ data: reservation }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 109. Public: Cancel Reservation by Lookup Token (Transaction) (PRF-04)
    if (method === 'POST' && path === '/api/v1/public/reservation/cancel') {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        throw new UnauthorizedError('Thiếu mã tra cứu đơn đặt trong Authorization header.', 'LOOKUP_TOKEN_MISSING');
      }
      const body = (await parseJsonObject(request, requestId)) as any;
      const db = getDb(injected, env);
      const reservation = await withTransaction(db, async (tx) => {
        return await cancelReservation(tx, { token }, null, body?.reason);
      });
      return new Response(JSON.stringify({ data: reservation }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 110. Staff: List Reservations (Member nội bộ)
    if (method === 'GET' && path === '/api/v1/reservations') {
      const actor = await resolveActorFromRequest(request, env, injected);
      requireInternalMember(actor);
      const db = getDb(injected, env);
      const scheduleId = url.searchParams.get('scheduleId') || undefined;
      const status = (url.searchParams.get('status') as any) || undefined;
      const search = url.searchParams.get('search') || undefined;
      const page = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 50);
      const result = await listStaffReservations(db, { scheduleId, status, search, page, limit });
      return new Response(JSON.stringify({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit, attentionCount: result.attentionCount } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    // 111. Staff: Fulfill Reservation (Member nội bộ, Transaction, Strict Deposit Guard) (PRF-04, PRF-05, PRF-08)
    const fulfillMatch = path.match(/^\/api\/v1\/reservations\/([a-zA-Z0-9_-]+)\/fulfill$/);
    if (method === 'POST' && fulfillMatch) {
      const reservationId = fulfillMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const body = (await parseJsonObject(request, requestId)) as any;
      const db = getDb(injected, env);

      // PRF-08: Kiểm tra boolean depositPaymentConfirmed nghiêm ngặt, không dùng Boolean(...)
      const depositPaymentConfirmed = body?.depositPaymentConfirmed === true;
      const idempotencyKey = request.headers.get('X-Idempotency-Key');
      if (!idempotencyKey?.trim()) throw new BadRequestError('Bắt buộc cung cấp X-Idempotency-Key khi bàn giao.', 'MISSING_IDEMPOTENCY_KEY');
      const actorId = member.memberId || member.userId;
      const payloadHash = computePayloadHash({ ...body, reservationId });

      const result = await withTransaction(db, async (tx) => {
        const claim = await claimIdempotency(tx, actorId, 'RESERVATION_FULFILL', idempotencyKey, payloadHash);
        if (claim.action === 'RETURN_CACHED') return claim.responseBody;
        const fulfilled = await fulfillReservation(
          tx,
          reservationId,
          {
            borrowerId: body?.borrowerId,
            paymentMethod: body?.paymentMethod || 'CASH',
            depositPaymentConfirmed,
            notes: body?.notes,
          },
          member,
          injected?.now
        );
        const payload = { data: fulfilled.reservation, loanReceipt: fulfilled.loanReceipt };
        await completeIdempotency(tx, actorId, 'RESERVATION_FULFILL', idempotencyKey, 200, payload);
        return payload;
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    const issueMatch = path.match(/^\/api\/v1\/reservations\/([a-zA-Z0-9_-]+)\/issue$/);
    if (method === 'POST' && issueMatch) {
      const member = requireInternalMember(await resolveActorFromRequest(request, env, injected));
      const body = await parseJsonObject(request, requestId);
      await withTransaction(getDb(injected, env), tx => reportReservationIssue(tx, issueMatch[1], member, body.reason));
      return Response.json({ data: { id: issueMatch[1], reported: true } }, { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
    }

    // 112. Staff: Cancel Reservation (Member nội bộ, Transaction) (PRF-04)
    const cancelMatch = path.match(/^\/api\/v1\/reservations\/([a-zA-Z0-9_-]+)\/cancel$/);
    if (method === 'POST' && cancelMatch) {
      const reservationId = cancelMatch[1];
      const actor = await resolveActorFromRequest(request, env, injected);
      const member = requireInternalMember(actor);
      const body = (await parseJsonObject(request, requestId)) as any;
      const db = getDb(injected, env);
      const reservation = await withTransaction(db, async (tx) => {
        return await cancelReservation(tx, { id: reservationId }, member, body?.reason);
      });
      return new Response(JSON.stringify({ data: reservation }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      });
    }

    throw new NotFoundError(`Endpoint '${method} ${path}' không tồn tại.`, 'ENDPOINT_NOT_FOUND', requestId);
  } catch (err) {
    return formatErrorResponse(err, requestId);
  }
}
