import type { AuthenticatedActor, AlumniActivityDto, MemberDto } from '../types.ts';
import { UnauthorizedError, ForbiddenError } from '../errors.ts';

/**
 * Validates that an actor is authenticated.
 */
export function requireAuthenticated(actor?: AuthenticatedActor | null): AuthenticatedActor {
  if (!actor || actor.role === 'ANONYMOUS') {
    throw new UnauthorizedError('Yêu cầu đăng nhập để truy cập tài nguyên này.', 'UNAUTHENTICATED');
  }
  if (!actor.isActive) {
    throw new ForbiddenError('Tài khoản đã bị khóa hoặc vô hiệu hóa bởi Quản trị viên.', 'ACCOUNT_DISABLED');
  }
  return actor;
}

/**
 * Validates that an actor is an active internal club member (or Admin).
 * Rejects:
 * - Anonymous (401)
 * - Guest users (403)
 * - Alumni members (403 - alumni are blocked from operational desk & mutations)
 * - Disabled accounts (403)
 */
export function requireInternalMember(actor?: AuthenticatedActor | null): AuthenticatedActor {
  const current = requireAuthenticated(actor);

  if (current.role === 'GUEST') {
    throw new ForbiddenError('Tài khoản khách không có quyền truy cập không gian nội bộ.', 'GUEST_ACCESS_DENIED');
  }

  if (current.isAlumni || current.role === 'ALUMNI') {
    throw new ForbiddenError(
      'Cựu thành viên không có quyền thao tác nghiệp vụ quầy sách hoặc quản trị nội bộ.',
      'ALUMNI_MUTATION_FORBIDDEN'
    );
  }

  if (current.role !== 'MEMBER' && current.role !== 'ADMIN') {
    throw new ForbiddenError('Yêu cầu quyền thành viên nội bộ CLB.', 'MEMBER_ROLE_REQUIRED');
  }

  return current;
}

/**
 * Validates that an actor is an Administrator.
 * Rejects members, alumni, and guests.
 */
export function requireAdmin(actor?: AuthenticatedActor | null): AuthenticatedActor {
  const current = requireAuthenticated(actor);

  if (current.isAlumni || current.role === 'ALUMNI') {
    throw new ForbiddenError('Cựu thành viên không có quyền Quản trị viên.', 'ALUMNI_CANNOT_BE_ADMIN');
  }

  if (current.role !== 'ADMIN') {
    throw new ForbiddenError('Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.', 'ADMIN_REQUIRED');
  }

  return current;
}

/**
 * Strict Field Allowlist for Alumni Activities (ADR 001 & FR-02/FR-09).
 * Strips all internal funds, budget numbers, and personal participant information.
 */
export function toAlumniActivityDto(rawActivity: Record<string, any>): AlumniActivityDto {
  return {
    id: String(rawActivity.id || ''),
    title: String(rawActivity.title || ''),
    description: String(rawActivity.description || ''),
    activityDate: String(rawActivity.activity_date || rawActivity.activityDate || ''),
    location: String(rawActivity.location || ''),
  };
}

/**
 * Sanitizes member records for internal listings.
 * Ensures internal credentials, provider subjects, and token versions are never leaked.
 */
export function toMemberDto(rawMember: Record<string, any>): MemberDto {
  const isAlumni = Boolean(rawMember.is_alumni ?? rawMember.isAlumni);
  const isAdmin = isAlumni ? false : Boolean(rawMember.is_admin ?? rawMember.isAdmin);

  return {
    id: String(rawMember.id),
    isCollaborator: Boolean(rawMember.is_collaborator ?? rawMember.isCollaborator),
    probationStartedOn: rawMember.probation_started_on ?? rawMember.probationStartedOn ?? null,
    probationEndsOn: rawMember.probation_ends_on ?? rawMember.probationEndsOn ?? null,
    collaboratorDeletedAt: rawMember.collaborator_deleted_at ?? rawMember.collaboratorDeletedAt ?? null,
    fullName: String(rawMember.full_name || rawMember.fullName),
    username: String(rawMember.username),
    team: String(rawMember.team),
    roleTitle: String(rawMember.role_title || rawMember.roleTitle),
    schoolYear: String(rawMember.school_year || rawMember.schoolYear),
    phone: rawMember.phone ? String(rawMember.phone) : undefined,
    isEligibleMainDuty: Boolean(rawMember.is_eligible_main_duty ?? rawMember.isEligibleMainDuty),
    hasPaidFee: Boolean(rawMember.has_paid_fee ?? rawMember.hasPaidFee),
    isAlumni,
    isAdmin,
    isActive: Boolean(rawMember.is_active ?? rawMember.isActive),
    createdAt: String(rawMember.created_at || rawMember.createdAt || new Date().toISOString()),
  };
}
