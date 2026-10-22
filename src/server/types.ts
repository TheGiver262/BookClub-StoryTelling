// ALUMNI is accepted only when decoding historical tokens, never as an active role.
export type ActorRole = 'ADMIN' | 'MANAGER' | 'MEMBER' | 'COLLABORATOR' | 'ALUMNI' | 'GUEST' | 'ANONYMOUS';

export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  JWT_SECRET?: string;
  RECRUITMENT_WEBHOOK_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESERVATION_IP_SECRET?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  NODE_ENV?: string;
  LOCAL_TESTING?: string;
  READER_GOOGLE_ENABLED?: string;
  PUBLIC_ORIGIN?: string;
  INTERNAL_ORIGIN?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export interface AuthenticatedActor {
  isCollaborator?: boolean;
  userId: string;
  memberId?: string;
  username?: string;
  email?: string;
  role: ActorRole;
  team?: string;
  isActive: boolean;
  isAlumni: boolean;
  tokenVersion: number;
}

export interface AlumniActivityDto {
  id: string;
  title: string;
  description: string;
  activityDate: string;
  location: string;
}

export interface MemberDto {
  isManager?: boolean;
  isCollaborator?: boolean;
  probationStartedOn?: string | null;
  probationEndsOn?: string | null;
  collaboratorDeletedAt?: string | null;
  id: string;
  fullName: string;
  username: string;
  team: string;
  roleTitle: string;
  schoolYear: string;
  phone?: string;
  isEligibleMainDuty: boolean;
  hasPaidFee: boolean;
  isAlumni: boolean;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LoginInternalRequest {
  username: string;
  password: string;
}

export interface LoginGuestRequest {
  email?: string;
  password?: string;
  provider?: 'google';
  token?: string;
}

export interface UpdateMemberStatusRequest {
  isActive?: boolean;
  isAlumni?: boolean;
  isAdmin?: boolean;
  team?: string;
  reason?: string;
}
