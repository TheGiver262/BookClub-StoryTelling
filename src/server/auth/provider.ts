import type { Env, AuthenticatedActor, LoginInternalRequest, LoginGuestRequest } from '../types.ts';
import { UnauthorizedError, BadRequestError, ForbiddenError, ServiceUnavailableError } from '../errors.ts';
import { signSessionToken } from './tokens.ts';
import { getDatabasePool } from '../db/client.ts';

export async function checkAuthProviderReadiness(env?: Env): Promise<{ ok: boolean; message?: string }> {
  const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      message: 'Managed Auth Provider (SUPABASE_URL / SUPABASE_ANON_KEY) chưa được cấu hình.',
    };
  }

  try {
    const healthUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`;
    const res = await fetch(healthUrl, { method: 'GET', headers: { apikey: anonKey } });
    if (res.ok) {
      return { ok: true };
    }
    return { ok: false, message: `Managed Auth Provider trả về trạng thái HTTP ${res.status}.` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Không thể kết nối Managed Auth Provider.',
    };
  }
}

/**
 * Normalizes username according to ADR 001 rules:
 * - Validates string type
 * - Trims whitespace
 * - Converts to lowercase
 * - Validates format (alphanumeric, dots, underscores, length 3..50)
 */
export function normalizeUsername(rawUsername: unknown): string {
  if (typeof rawUsername !== 'string') {
    throw new BadRequestError('Username phải là chuỗi ký tự.', 'INVALID_USERNAME_TYPE');
  }
  const normalized = rawUsername.trim().toLowerCase();
  if (!/^[a-z0-9._]{3,50}$/.test(normalized)) {
    throw new BadRequestError(
      'Username chỉ được chứa ký tự chữ thường, số, dấu chấm và gạch dưới (độ dài 3-50 ký tự).',
      'INVALID_USERNAME_FORMAT'
    );
  }
  return normalized;
}

/**
 * Builds the synthetic internal email realm for Supabase Auth isolation.
 */
export function getInternalAuthEmail(normalizedUsername: string): string {
  return `${normalizedUsername}@internal.ysbk.edu.vn`;
}

export interface AuthTestInjection {
  userStore?: Record<string, any>;
  membersDb?: Record<string, any>;
  dbPool?: any;
}

export async function loginInternalMember(
  req: LoginInternalRequest,
  env?: Env,
  injected?: AuthTestInjection
): Promise<{ token: string; actor: AuthenticatedActor }> {
  if (!req || typeof req !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ.', 'INVALID_BODY');
  }
  if (typeof req.username !== 'string') {
    throw new BadRequestError('Tên đăng nhập phải là chuỗi ký tự.', 'INVALID_USERNAME_TYPE');
  }
  if (typeof req.password !== 'string') {
    throw new BadRequestError('Mật khẩu phải là chuỗi ký tự.', 'INVALID_PASSWORD_TYPE');
  }

  const normalizedUsername = normalizeUsername(req.username);

  if (!req.password || req.password.trim() === '') {
    throw new BadRequestError('Mật khẩu không được để trống.', 'PASSWORD_REQUIRED');
  }

  // 1. Check if test harness injected an isolated user store (only in test execution)
  if (injected?.userStore) {
    const testUser = injected.userStore[normalizedUsername];
    if (!testUser || testUser.passwordHash !== req.password) {
      throw new UnauthorizedError('Username hoặc mật khẩu không chính xác.', 'INVALID_CREDENTIALS');
    }
    if (!testUser.isActive) {
      throw new ForbiddenError('Tài khoản đã bị vô hiệu hóa.', 'ACCOUNT_DISABLED');
    }

    const isAlumni = Boolean(testUser.isAlumni);
    const isAdmin = isAlumni ? false : Boolean(testUser.isAdmin || testUser.role === 'ADMIN');
    const role = isAdmin ? 'ADMIN' : (isAlumni ? 'ALUMNI' : 'MEMBER');

    const actor: AuthenticatedActor = {
      userId: testUser.userId,
      memberId: testUser.memberId,
      username: testUser.username,
      role,
      team: testUser.team,
      isActive: testUser.isActive,
      isAlumni,
      tokenVersion: testUser.tokenVersion ?? 1,
    };

    const token = await signSessionToken(actor, env?.JWT_SECRET);
    return { token, actor };
  }

  // 2. Production Managed Auth route (when SUPABASE_URL is configured)
  const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey) {
    const internalEmail = getInternalAuthEmail(normalizedUsername);
    const authEndpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;

    let authRes: Response;
    try {
      authRes = await fetch(authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify({
          email: internalEmail,
          password: req.password,
        }),
      });
    } catch {
      throw new ServiceUnavailableError('Không thể kết nối Managed Auth Provider.', 'AUTH_PROVIDER_UNREACHABLE');
    }

    if (!authRes.ok) {
      throw new UnauthorizedError('Username hoặc mật khẩu không chính xác.', 'INVALID_CREDENTIALS');
    }

    const authData: any = await authRes.json();
    const providerSub = authData.user?.id;

    if (!providerSub) {
      throw new UnauthorizedError('Xác thực thất bại: không tìm thấy định danh provider.', 'PROVIDER_SUBJECT_MISSING');
    }

    // S03-02: Derive roles, permissions, and status STRICTLY from database mapping!
    // Never infer ADMIN or permissions from username containing 'admin'!
    let memberRow: any = null;

    if (injected?.membersDb) {
      // Test DB mapping injection
      const member = Object.values(injected.membersDb).find(
        (m: any) => m.username === normalizedUsername || m.provider_subject === providerSub
      );
      if (member) memberRow = member;
    } else {
      try {
        const pool = getDatabasePool(env);
        const queryRes = await pool.query(
          `SELECT m.id, m.full_name, m.team, m.is_admin, m.is_alumni, m.is_active, m.is_collaborator, m.token_version, ii.username
           FROM internal_identities ii
           JOIN members m ON ii.member_id = m.id
           WHERE ii.provider_subject = $1 AND ii.normalized_username = $2`,
          [providerSub, normalizedUsername]
        );
        if (queryRes.rows.length > 0) {
          memberRow = queryRes.rows[0];
        }
      } catch {
        throw new ServiceUnavailableError('Cơ sở dữ liệu xác thực quyền chưa sẵn sàng.', 'DATABASE_DISCONNECTED');
      }
    }

    if (!memberRow) {
      throw new UnauthorizedError(
        'Tài khoản chưa được phân quyền nội bộ hoặc chưa được cấp bởi Quản trị viên.',
        'MEMBER_NOT_PROVISIONED'
      );
    }

    if (!memberRow.is_active) {
      throw new ForbiddenError('Tài khoản đã bị khóa hoặc vô hiệu hóa bởi Quản trị viên.', 'ACCOUNT_DISABLED');
    }

    const isAlumni = Boolean(memberRow.is_alumni);
    const isAdmin = isAlumni ? false : Boolean(memberRow.is_admin);
    const role = isAdmin ? 'ADMIN' : (isAlumni ? 'ALUMNI' : 'MEMBER');

    const actor: AuthenticatedActor = {
      userId: providerSub,
      memberId: memberRow.id,
      username: memberRow.username || normalizedUsername,
      role,
      team: memberRow.team,
      isActive: Boolean(memberRow.is_active),
      isAlumni,
      isCollaborator: Boolean(memberRow.is_collaborator),
      tokenVersion: memberRow.token_version ?? 1,
    };

    const token = await signSessionToken(actor, env?.JWT_SECRET);
    return { token, actor };
  }

  // 3. Neither Provider nor test injection configured -> Fail-closed!
  throw new ServiceUnavailableError(
    'Dịch vụ xác thực Managed Auth chưa được cấu hình. Hệ thống từ chối đăng nhập (Fail-closed).',
    'AUTH_PROVIDER_UNCONFIGURED'
  );
}

export async function loginGuestUser(
  req: LoginGuestRequest,
  env?: Env,
  injected?: AuthTestInjection
): Promise<{ token: string; actor: AuthenticatedActor }> {
  if (!req || typeof req !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ.', 'INVALID_BODY');
  }
  if (req.email !== undefined && typeof req.email !== 'string') {
    throw new BadRequestError('Email phải là chuỗi ký tự.', 'INVALID_EMAIL_TYPE');
  }
  if (req.password !== undefined && typeof req.password !== 'string') {
    throw new BadRequestError('Mật khẩu phải là chuỗi ký tự.', 'INVALID_PASSWORD_TYPE');
  }
  if (!req.email && !req.token) {
    throw new BadRequestError('Email hoặc token xác thực Google là bắt buộc.', 'GUEST_CREDENTIALS_REQUIRED');
  }

  const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (injected?.userStore) {
    // Injected test guest verification
    const guestSub = `guest_${req.email?.replace(/[^a-zA-Z0-9]/g, '_') || 'test_oauth'}`;
    const actor: AuthenticatedActor = {
      userId: guestSub,
      email: req.email?.toLowerCase(),
      role: 'GUEST',
      isActive: true,
      isAlumni: false,
      tokenVersion: 1,
    };
    const token = await signSessionToken(actor, env?.JWT_SECRET);
    return { token, actor };
  }

  if (supabaseUrl && anonKey) {
    let verifiedSub: string | null = null;
    let verifiedEmail: string | null = null;

    if (req.email && req.password) {
      const authEndpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
      let res: Response;
      try {
        res = await fetch(authEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: anonKey },
          body: JSON.stringify({ email: req.email, password: req.password }),
        });
      } catch {
        throw new ServiceUnavailableError('Không thể kết nối Managed Auth Provider.', 'AUTH_PROVIDER_UNREACHABLE');
      }
      if (!res.ok) {
        throw new UnauthorizedError('Email hoặc mật khẩu khách không chính xác.', 'INVALID_GUEST_CREDENTIALS');
      }
      const data: any = await res.json();
      verifiedSub = data.user?.id;
      verifiedEmail = data.user?.email || req.email;
    } else if (req.token) {
      const userEndpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`;
      let res: Response;
      try {
        res = await fetch(userEndpoint, {
          method: 'GET',
          headers: { Authorization: `Bearer ${req.token}`, apikey: anonKey },
        });
      } catch {
        throw new ServiceUnavailableError('Không thể kết nối Managed Auth Provider.', 'AUTH_PROVIDER_UNREACHABLE');
      }
      if (!res.ok) {
        throw new UnauthorizedError('Google OAuth token không hợp lệ hoặc đã hết hạn.', 'INVALID_OAUTH_TOKEN');
      }
      const data: any = await res.json();
      verifiedSub = data.id;
      verifiedEmail = data.email;
    } else {
      throw new BadRequestError('Mật khẩu hoặc OAuth token là bắt buộc đối với tài khoản khách.', 'GUEST_PASSWORD_REQUIRED');
    }

    const actor: AuthenticatedActor = {
      userId: verifiedSub || `guest_${Date.now()}`,
      email: verifiedEmail?.toLowerCase(),
      role: 'GUEST',
      isActive: true,
      isAlumni: false,
      tokenVersion: 1,
    };

    const token = await signSessionToken(actor, env?.JWT_SECRET);
    return { token, actor };
  }

  // S03-03: Provider unconfigured -> Fail-closed!
  throw new ServiceUnavailableError(
    'Dịch vụ xác thực khách chưa được cấu hình. Hệ thống từ chối cấp phiên (Fail-closed).',
    'AUTH_PROVIDER_UNCONFIGURED'
  );
}
