import test from 'node:test';
import assert from 'node:assert';
import {
  requireAuthenticated,
  requireInternalMember,
  requireAdmin,
  toAlumniActivityDto,
  toMemberDto,
} from '../../src/server/auth/policy.ts';
import { signSessionToken, verifySessionToken } from '../../src/server/auth/tokens.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

const MOCK_ADMIN: AuthenticatedActor = {
  userId: 'usr_admin',
  memberId: 'mem_001',
  username: 'dung.bcn',
  role: 'ADMIN',
  team: 'BAN_CHU_NHIEM',
  isActive: true,
  isAlumni: false,
  tokenVersion: 1,
};

const MOCK_MEMBER: AuthenticatedActor = {
  userId: 'usr_member',
  memberId: 'mem_002',
  username: 'anh.haucan',
  role: 'MEMBER',
  team: 'HAU_CAN',
  isActive: true,
  isAlumni: false,
  tokenVersion: 1,
};

const MOCK_ALUMNI: AuthenticatedActor = {
  userId: 'usr_alumni',
  memberId: 'mem_005',
  username: 'thang.cuu',
  role: 'ALUMNI',
  team: 'HAU_CAN',
  isActive: true,
  isAlumni: true,
  tokenVersion: 1,
};

const MOCK_GUEST: AuthenticatedActor = {
  userId: 'usr_guest',
  email: 'reader@gmail.com',
  role: 'GUEST',
  isActive: true,
  isAlumni: false,
  tokenVersion: 1,
};

const MOCK_DISABLED: AuthenticatedActor = {
  userId: 'usr_locked',
  memberId: 'mem_999',
  username: 'locked.user',
  role: 'MEMBER',
  isActive: false,
  isAlumni: false,
  tokenVersion: 1,
};

test('G-policy 1: Anonymous actor is rejected with 401 Unauthorized', () => {
  assert.throws(
    () => requireAuthenticated(null),
    /Yêu cầu đăng nhập để truy cập tài nguyên này/
  );
  assert.throws(
    () => requireInternalMember(null),
    /Yêu cầu đăng nhập để truy cập tài nguyên này/
  );
  assert.throws(
    () => requireAdmin(null),
    /Yêu cầu đăng nhập để truy cập tài nguyên này/
  );
});

test('G-policy 2: Disabled account is rejected with 403 Forbidden', () => {
  assert.throws(
    () => requireAuthenticated(MOCK_DISABLED),
    /Tài khoản đã bị khóa hoặc vô hiệu hóa/
  );
  assert.throws(
    () => requireInternalMember(MOCK_DISABLED),
    /Tài khoản đã bị khóa hoặc vô hiệu hóa/
  );
});

test('G-policy 3: Guest user is blocked from internal member and admin spaces', () => {
  // Guest passes basic authentication
  const auth = requireAuthenticated(MOCK_GUEST);
  assert.strictEqual(auth.role, 'GUEST');

  // Guest MUST BE BLOCKED from internal member resources with 403
  assert.throws(
    () => requireInternalMember(MOCK_GUEST),
    /Tài khoản khách không có quyền truy cập không gian nội bộ/
  );

  // Guest MUST BE BLOCKED from admin resources with 403
  assert.throws(
    () => requireAdmin(MOCK_GUEST),
    /Chỉ Quản trị viên \(Admin\) mới có quyền thực hiện thao tác này/
  );
});

test('G-policy 4: Regular member can access internal space but is blocked from admin operations', () => {
  const member = requireInternalMember(MOCK_MEMBER);
  assert.strictEqual(member.role, 'MEMBER');

  assert.throws(
    () => requireAdmin(MOCK_MEMBER),
    /Chỉ Quản trị viên \(Admin\) mới có quyền thực hiện thao tác này/
  );
});

test('G-policy 5: Admin can access both internal member and admin operations', () => {
  const memberPass = requireInternalMember(MOCK_ADMIN);
  assert.strictEqual(memberPass.role, 'ADMIN');

  const adminPass = requireAdmin(MOCK_ADMIN);
  assert.strictEqual(adminPass.role, 'ADMIN');
});

test('G-policy 6: Alumni member is blocked from operational desk & mutations', () => {
  assert.throws(
    () => requireInternalMember(MOCK_ALUMNI),
    /Cựu thành viên không có quyền thao tác nghiệp vụ quầy sách/
  );

  assert.throws(
    () => requireAdmin(MOCK_ALUMNI),
    /Cựu thành viên không có quyền Quản trị viên/
  );
});

test('G-policy 6b: Conflicting actor with isAlumni: true and role: ADMIN is strictly rejected by requireAdmin', () => {
  const conflictingActor: AuthenticatedActor = {
    userId: 'usr_conflicting',
    username: 'bad.actor',
    role: 'ADMIN',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };

  assert.throws(
    () => requireAdmin(conflictingActor),
    /Cựu thành viên không có quyền Quản trị viên/
  );
});

test('G-policy 7: Alumni activity DTO strips all financial numbers, budgets, and sensitive notes', () => {
  const sensitiveActivity = {
    id: 'act_101',
    title: 'Hội Thảo Đọc Sách K69',
    description: 'Chia sẻ kỹ năng và sách hay',
    activityDate: '2026-11-25',
    location: 'Hội trường C2',
    internal_budget: 25000000,
    fund_id: 'FUND_OPERATION',
    bank_account: '9876543210 - VCB',
    organizer_notes: 'Bí mật nội bộ BCN',
    attendee_student_ids: ['20230001', '20230002'],
  };

  const safeDto = toAlumniActivityDto(sensitiveActivity);

  assert.strictEqual(safeDto.id, 'act_101');
  assert.strictEqual(safeDto.title, 'Hội Thảo Đọc Sách K69');
  assert.strictEqual(safeDto.description, 'Chia sẻ kỹ năng và sách hay');
  assert.strictEqual(safeDto.activityDate, '2026-11-25');
  assert.strictEqual(safeDto.location, 'Hội trường C2');

  // Verify stripped properties
  assert.strictEqual((safeDto as any).internal_budget, undefined);
  assert.strictEqual((safeDto as any).fund_id, undefined);
  assert.strictEqual((safeDto as any).bank_account, undefined);
  assert.strictEqual((safeDto as any).organizer_notes, undefined);
  assert.strictEqual((safeDto as any).attendee_student_ids, undefined);
});

test('G-policy 7b: toMemberDto sanitizes internal member record and never exposes credentials or token version', () => {
  const rawRecord = {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Dương Admin',
    username: 'dung.bcn',
    team: 'BAN_CHU_NHIEM',
    role_title: 'Chủ nhiệm',
    school_year: 'K66',
    phone: '0901234567',
    is_eligible_main_duty: true,
    has_paid_fee: true,
    is_alumni: false,
    is_admin: true,
    is_active: true,
    token_version: 5, // Sensitive internal version
    password_hash: '$2b$12$fakehashnotforleakage', // Sensitive
    provider_subject: 'sb_auth_uuid_secret', // Sensitive
  };

  const dto = toMemberDto(rawRecord);
  assert.strictEqual(dto.id, '00000000-0000-0000-0000-000000000001');
  assert.strictEqual(dto.fullName, 'Dương Admin');
  assert.strictEqual(dto.username, 'dung.bcn');
  assert.strictEqual(dto.isAdmin, true);
  assert.strictEqual((dto as any).token_version, undefined);
  assert.strictEqual((dto as any).password_hash, undefined);
  assert.strictEqual((dto as any).provider_subject, undefined);
});

test('G-policy 8: Token signing & verification detects invalid signature, tampered payloads, and expiration', async () => {
  const secret = 'my_test_jwt_secret_32_characters_long_min!';
  const token = await signSessionToken(MOCK_MEMBER, secret, 3600);

  // Valid token verifies cleanly
  const verified = await verifySessionToken(token, secret);
  assert.strictEqual(verified.username, 'anh.haucan');
  assert.strictEqual(verified.role, 'MEMBER');

  // Tampered payload is rejected
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), role: 'ADMIN' })
  ).toString('base64url');
  const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  await assert.rejects(
    async () => verifySessionToken(forgedToken, secret),
    /Chữ ký token không hợp lệ hoặc đã bị thay đổi/,
    'Tampered token must fail signature check'
  );

  // Expired token is rejected
  const expiredToken = await signSessionToken(MOCK_MEMBER, secret, -10);
  await assert.rejects(
    async () => verifySessionToken(expiredToken, secret),
    /Phiên đăng nhập đã hết hạn/,
    'Expired token must fail'
  );

  // Wrong secret is rejected
  await assert.rejects(
    async () => verifySessionToken(token, 'different_secret_key_32_chars_min!!'),
    /Chữ ký token không hợp lệ hoặc đã bị thay đổi/,
    'Wrong secret must fail'
  );
});
