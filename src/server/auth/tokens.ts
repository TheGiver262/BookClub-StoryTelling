import type { AuthenticatedActor, ActorRole } from '../types.ts';
import { UnauthorizedError } from '../errors.ts';

export interface TokenClaims {
  sub: string;
  memberId?: string;
  username?: string;
  email?: string;
  role: ActorRole;
  team?: string;
  isAlumni: boolean;
  isActive: boolean;
  tokenVersion: number;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

const DEFAULT_ISSUER = 'https://api.ysbk.edu.vn';
const DEFAULT_AUDIENCE = 'ysbk-app';

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(
  actor: AuthenticatedActor,
  secret?: string,
  expiresInSeconds = 3600 * 24
): Promise<string> {
  if (!secret || typeof secret !== 'string' || secret.length < 32) {
    throw new UnauthorizedError('JWT_SECRET chưa được cấu hình hoặc không đủ an toàn (tối thiểu 32 ký tự).', 'AUTH_SECRET_MISSING');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims: TokenClaims = {
    sub: actor.userId,
    memberId: actor.memberId,
    username: actor.username,
    email: actor.email,
    role: actor.role,
    team: actor.team,
    isAlumni: actor.isAlumni,
    isActive: actor.isActive,
    tokenVersion: actor.tokenVersion,
    iss: DEFAULT_ISSUER,
    aud: DEFAULT_AUDIENCE,
    exp: now + expiresInSeconds,
    iat: now,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(claims)));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await getHmacKey(secret);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${dataToSign}.${sigB64}`;
}

export async function verifySessionToken(
  token: string,
  secret?: string,
  expectedIssuer = DEFAULT_ISSUER,
  expectedAudience = DEFAULT_AUDIENCE
): Promise<AuthenticatedActor> {
  if (!secret || typeof secret !== 'string' || secret.length < 32) {
    throw new UnauthorizedError('JWT_SECRET chưa được cấu hình hoặc không đủ an toàn (tối thiểu 32 ký tự).', 'AUTH_SECRET_MISSING');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedError('Token không đúng định dạng JWT.', 'INVALID_TOKEN_FORMAT');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  const enc = new TextEncoder();
  const dataToVerify = `${headerB64}.${payloadB64}`;

  const key = await getHmacKey(secret);
  const signatureBytes = base64UrlDecode(sigB64);

  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, enc.encode(dataToVerify));
  if (!isValid) {
    throw new UnauthorizedError('Chữ ký token không hợp lệ hoặc đã bị thay đổi.', 'INVALID_TOKEN_SIGNATURE');
  }

  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
  let claims: TokenClaims;
  try {
    claims = JSON.parse(payloadJson);
  } catch {
    throw new UnauthorizedError('Payload token không thể giải mã JSON.', 'MALFORMED_TOKEN_PAYLOAD');
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    throw new UnauthorizedError('Phiên đăng nhập đã hết hạn.', 'TOKEN_EXPIRED');
  }

  if (claims.iss !== expectedIssuer) {
    throw new UnauthorizedError(`Issuer không khớp (nhận được: ${claims.iss}).`, 'INVALID_TOKEN_ISSUER');
  }

  if (claims.aud !== expectedAudience) {
    throw new UnauthorizedError(`Audience không khớp (nhận được: ${claims.aud}).`, 'INVALID_TOKEN_AUDIENCE');
  }

  return {
    userId: claims.sub,
    memberId: claims.memberId,
    username: claims.username,
    email: claims.email,
    role: claims.role,
    team: claims.team,
    isActive: claims.isActive,
    isAlumni: claims.isAlumni,
    tokenVersion: claims.tokenVersion,
  };
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function extractSessionCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)ysbk_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}
