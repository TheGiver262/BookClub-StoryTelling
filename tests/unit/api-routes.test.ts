import test from 'node:test';
import assert from 'node:assert';
import { handleRequest, type TestFixtures } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';
import { MockCashDbQueryable } from './mock-db-helper.ts';

const TEST_SECRET = 'unit_test_jwt_secret_min_32_characters_long_12345';
const TEST_ENV = {
  JWT_SECRET: TEST_SECRET,
  NODE_ENV: 'test',
};

const createFixtures = (): TestFixtures => ({
  membersDb: {
    '00000000-0000-0000-0000-000000000001': {
      id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Đặng Quốc Dũng',
      username: 'dung.bcn',
      team: 'BAN_CHU_NHIEM',
      role_title: 'Chủ nhiệm CLB',
      school_year: 'K65 - Viện Cơ khí',
      phone: '0971112233',
      is_eligible_main_duty: true,
      has_paid_fee: true,
      is_alumni: false,
      is_admin: true,
      is_active: true,
      token_version: 1,
      created_at: '2026-10-18T00:00:00Z',
    },
    '00000000-0000-0000-0000-000000000002': {
      id: '00000000-0000-0000-0000-000000000002',
      full_name: 'Nguyễn Thị Ánh',
      username: 'anh.haucan',
      team: 'HAU_CAN',
      role_title: 'Trưởng ban Hậu cần',
      school_year: 'K66 - Viện KT&QL',
      phone: '0982223344',
      is_eligible_main_duty: true,
      has_paid_fee: true,
      is_alumni: false,
      is_admin: false,
      is_active: true,
      token_version: 1,
      created_at: '2026-10-18T00:00:00Z',
    },
    '00000000-0000-0000-0000-000000000005': {
      id: '00000000-0000-0000-0000-000000000005',
      full_name: 'Trần Đức Thắng',
      username: 'thang.cuu',
      team: 'HAU_CAN',
      role_title: 'Cựu Trưởng ban Hậu cần',
      school_year: 'K64 - Đã tốt nghiệp',
      phone: '0915556677',
      is_eligible_main_duty: false,
      has_paid_fee: true,
      is_alumni: true,
      is_admin: false,
      is_active: true,
      token_version: 1,
      created_at: '2026-10-18T00:00:00Z',
    },
  },
  userStore: {
    'dung.bcn': {
      userId: 'usr_dung_001',
      memberId: '00000000-0000-0000-0000-000000000001',
      username: 'dung.bcn',
      passwordHash: 'bcn@2026',
      isAdmin: true,
      isAlumni: false,
      team: 'BAN_CHU_NHIEM',
      isActive: true,
      tokenVersion: 1,
    },
    'anh.haucan': {
      userId: 'usr_anh_002',
      memberId: '00000000-0000-0000-0000-000000000002',
      username: 'anh.haucan',
      passwordHash: 'haucan@2026',
      isAdmin: false,
      isAlumni: false,
      team: 'HAU_CAN',
      isActive: true,
      tokenVersion: 1,
    },
    'thang.cuu': {
      userId: 'usr_thang_005',
      memberId: '00000000-0000-0000-0000-000000000005',
      username: 'thang.cuu',
      passwordHash: 'alumni@2026',
      isAdmin: false,
      isAlumni: true,
      team: 'HAU_CAN',
      isActive: true,
      tokenVersion: 1,
    },
  },
  activities: [
    {
      id: 'act_001',
      title: 'Hội Sách Bách Khoa Thu 2026',
      description: 'Chương trình giới thiệu sách và giao lưu tác giả tại Thư viện Tạ Quang Bửu.',
      activityDate: '2026-11-20',
      location: 'Sảnh C2 - ĐHBK Hà Nội',
      status: 'APPROVED_FOR_ALUMNI',
      internal_budget: 15000000,
      fund_id: 'FUND_OPERATION',
      organizer_notes: 'Cần phân công 10 bạn hỗ trợ dọn bàn',
    },
    {
      id: 'act_draft',
      title: 'Kế hoạch nháp tài chính',
      description: 'Dữ liệu nháp nội bộ',
      activityDate: '2026-12-01',
      location: 'Văn phòng CLB',
      status: 'PLANNED',
      internal_budget: 5000000,
      fund_id: 'FUND_OPERATION',
    },
  ],
  revokedTokenHashes: new Set<string>(),
  queryable: new MockCashDbQueryable(),
});

test('G-runtime 1: GET /health returns 200 OK without sensitive system internals', async () => {
  const req = new Request('http://localhost:8787/health');
  const res = await handleRequest(req, TEST_ENV);

  assert.strictEqual(res.status, 200);
  const data: any = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.service, 'ysbk-backend');
  assert.strictEqual(data.version, '1.0.0');
  assert.ok(data.timestamp);
  assert.strictEqual(data.database, undefined);
  assert.strictEqual(data.secret, undefined);
});

test('G-runtime 2: GET /health/ready returns 503 Degraded when DB or Provider is not connected (Fail-closed)', async () => {
  const req = new Request('http://localhost:8787/health/ready');
  const res = await handleRequest(req, TEST_ENV);

  assert.strictEqual(res.status, 503);
  const data: any = await res.json();
  assert.strictEqual(data.status, 'degraded');
  assert.ok(data.dependencies.database.includes('disconnected'));
  assert.ok(data.dependencies.authProvider.includes('disconnected'));
});

test('S03-01: Server without provider config fails closed (503) on login instead of fallback demo', async () => {
  const req = new Request('http://localhost:8787/api/v1/auth/login-internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dung.bcn', password: 'bcn@2026' }),
  });
  // Call normal server entry without injected test stores
  const res = await handleRequest(req, { ...TEST_ENV, NODE_ENV: 'production' });
  assert.strictEqual(res.status, 503, 'Normal server must fail closed with 503 when Managed Auth is unconfigured');
});

test('S03-06: Malformed or wrong body types return 400 Bad Request', async () => {
  const fixtures = createFixtures();
  const req = new Request('http://localhost:8787/api/v1/auth/login-internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dung.bcn', password: 12345 }),
  });
  const res = await handleRequest(req, TEST_ENV, fixtures);
  assert.strictEqual(res.status, 400);
  const data: any = await res.json();
  assert.strictEqual(data.error.code, 'INVALID_PASSWORD_TYPE');
});

test('G-policy/HTTP 1: POST /api/v1/auth/login-internal verifies credentials and sets HttpOnly cookie', async () => {
  const fixtures = createFixtures();

  // 1. Invalid credentials -> 401
  const badReq = new Request('http://localhost:8787/api/v1/auth/login-internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dung.bcn', password: 'wrongpassword' }),
  });
  const badRes = await handleRequest(badReq, TEST_ENV, fixtures);
  assert.strictEqual(badRes.status, 401);

  // 2. Valid credentials -> 200 + token + HttpOnly cookie
  const goodReq = new Request('http://localhost:8787/api/v1/auth/login-internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dung.bcn', password: 'bcn@2026' }),
  });
  const goodRes = await handleRequest(goodReq, { ...TEST_ENV, NODE_ENV: 'production' }, fixtures);
  assert.strictEqual(goodRes.status, 200);

  const setCookie = goodRes.headers.get('Set-Cookie');
  assert.ok(setCookie, 'Must set cookie header');
  assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
  assert.ok(setCookie.includes('SameSite=Lax'), 'Cookie must have SameSite');
  assert.ok(setCookie.includes('Secure'), 'Production cookie must have Secure');

  const data: any = await goodRes.json();
  assert.ok(data.token);
  assert.strictEqual(data.actor.username, 'dung.bcn');
  assert.strictEqual(data.actor.role, 'ADMIN');
});

test('G-policy/HTTP 2: Protected /api/v1/members enforces role barriers (401 unauthenticated, 403 guest, 200 member)', async () => {
  const fixtures = createFixtures();

  // 1. No token -> 401
  const noAuthReq = new Request('http://localhost:8787/api/v1/members');
  const noAuthRes = await handleRequest(noAuthReq, TEST_ENV, fixtures);
  assert.strictEqual(noAuthRes.status, 401);

  // 2. Guest token -> 403
  const guestActor: AuthenticatedActor = {
    userId: 'usr_guest',
    role: 'GUEST',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const guestToken = await signSessionToken(guestActor, TEST_SECRET);
  const guestReq = new Request('http://localhost:8787/api/v1/members', {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  const guestRes = await handleRequest(guestReq, TEST_ENV, fixtures);
  assert.strictEqual(guestRes.status, 403);

  // 3. Member token -> 200
  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'anh.haucan',
    role: 'MEMBER',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);
  const memberReq = new Request('http://localhost:8787/api/v1/members', {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const memberRes = await handleRequest(memberReq, TEST_ENV, fixtures);
  assert.strictEqual(memberRes.status, 200);

  const memberData: any = await memberRes.json();
  assert.ok(Array.isArray(memberData.data));
  assert.ok(memberData.total >= 2);
});

test('S03-05: Conflicting { isAlumni: true, isAdmin: true } payload is rejected with 400 Bad Request', async () => {
  const fixtures = createFixtures();
  const adminActor: AuthenticatedActor = {
    userId: 'usr_admin',
    memberId: '00000000-0000-0000-0000-000000000001',
    username: 'dung.bcn',
    role: 'ADMIN',
    team: 'BAN_CHU_NHIEM',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const adminToken = await signSessionToken(adminActor, TEST_SECRET);

  const patchReq = new Request(
    'http://localhost:8787/api/v1/members/00000000-0000-0000-0000-000000000002/status',
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isAlumni: true, isAdmin: true }),
    }
  );
  const res = await handleRequest(patchReq, TEST_ENV, fixtures);
  assert.strictEqual(res.status, 400);
  const data: any = await res.json();
  assert.strictEqual(data.error.code, 'RETIRED_ROLE_REMOVED');
});

test('G-policy/HTTP 3: Member cannot modify member status, only Admin can PATCH /status and revokes sessions', async () => {
  const fixtures = createFixtures();
  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'anh.haucan',
    role: 'MEMBER',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);

  // 1. Member attempts to PATCH status -> 403
  const patchByMember = new Request(
    'http://localhost:8787/api/v1/members/00000000-0000-0000-0000-000000000002/status',
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: false }),
    }
  );
  const memberPatchRes = await handleRequest(patchByMember, TEST_ENV, fixtures);
  assert.strictEqual(memberPatchRes.status, 403);

  // 2. Admin attempts to PATCH status -> 200
  const adminActor: AuthenticatedActor = {
    userId: 'usr_admin',
    memberId: '00000000-0000-0000-0000-000000000001',
    username: 'dung.bcn',
    role: 'ADMIN',
    team: 'BAN_CHU_NHIEM',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const adminToken = await signSessionToken(adminActor, TEST_SECRET);

  const patchByAdmin = new Request(
    'http://localhost:8787/api/v1/members/00000000-0000-0000-0000-000000000002/status',
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: false }),
    }
  );
  const adminPatchRes = await handleRequest(patchByAdmin, TEST_ENV, fixtures);
  assert.strictEqual(adminPatchRes.status, 200);

  // 3. Old session of member with tokenVersion 1 is now REVOKED because token_version was incremented to 2!
  const revokedReq = new Request('http://localhost:8787/api/v1/members', {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const revokedRes = await handleRequest(revokedReq, TEST_ENV, fixtures);
  assert.strictEqual(revokedRes.status, 401, 'Old member token must be rejected after status revocation');
});

test('S03-04: Logout invalidates token and subsequent /auth/me returns 401', async () => {
  const fixtures = createFixtures();
  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'anh.haucan',
    role: 'MEMBER',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const token = await signSessionToken(memberActor, TEST_SECRET);

  // 1. Verify token works
  const beforeLogoutReq = new Request('http://localhost:8787/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const beforeRes = await handleRequest(beforeLogoutReq, TEST_ENV, fixtures);
  assert.strictEqual(beforeRes.status, 200);

  // 2. Call logout
  const logoutReq = new Request('http://localhost:8787/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const logoutRes = await handleRequest(logoutReq, TEST_ENV, fixtures);
  assert.strictEqual(logoutRes.status, 200);

  // 3. Call /auth/me with same token -> must be rejected 401
  const afterLogoutReq = new Request('http://localhost:8787/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterRes = await handleRequest(afterLogoutReq, TEST_ENV, fixtures);
  assert.strictEqual(afterRes.status, 401, 'Token must be revoked after logout');
});

test('G-policy/HTTP 4: retired accounts have no internal activity access', async () => {
 const fixtures=createFixtures();
 const actor:AuthenticatedActor={userId:'usr_alumni',memberId:'00000000-0000-0000-0000-000000000005',username:'thang.cuu',role:'ALUMNI',team:'HAU_CAN',isActive:true,isAlumni:true,tokenVersion:1};
 const token=await signSessionToken(actor,TEST_SECRET);
 for(const path of ['/api/v1/alumni/activities','/api/v1/members']){
  const response=await handleRequest(new Request('http://localhost:8787'+path,{headers:{Authorization:'Bearer '+token}}),TEST_ENV,fixtures);
  assert.equal(response.status,403);assert.equal((await response.json() as any).error.code,'ACCOUNT_DISABLED');
 }
});

test('G-policy/HTTP 5: retired accounts have no internal activity access', async () => {
 const fixtures=createFixtures();
 const actor:AuthenticatedActor={userId:'usr_alumni',memberId:'00000000-0000-0000-0000-000000000005',username:'thang.cuu',role:'ALUMNI',team:'HAU_CAN',isActive:true,isAlumni:true,tokenVersion:1};
 const token=await signSessionToken(actor,TEST_SECRET);
 for(const path of ['/api/v1/alumni/activities','/api/v1/members']){
  const response=await handleRequest(new Request('http://localhost:8787'+path,{headers:{Authorization:'Bearer '+token}}),TEST_ENV,fixtures);
  assert.equal(response.status,403);assert.equal((await response.json() as any).error.code,'ACCOUNT_DISABLED');
 }
});

test('G-policy/HTTP 6: Finance Cash Session RBAC - Guests and Alumni are forbidden from cash desk endpoints', async () => {
  const fixtures = createFixtures();
  const guestActor: AuthenticatedActor = {
    userId: 'usr_guest',
    role: 'GUEST',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const guestToken = await signSessionToken(guestActor, TEST_SECRET);

  const alumniActor: AuthenticatedActor = {
    userId: 'usr_alumni',
    memberId: '00000000-0000-0000-0000-000000000005',
    username: 'thang.cuu',
    role: 'ALUMNI',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };
  const alumniToken = await signSessionToken(alumniActor, TEST_SECRET);

  // 1. Guest cố gọi /finance/cash-session/today -> 403
  const guestReq = new Request('http://localhost:8787/api/v1/finance/cash-session/today', {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  const guestRes = await handleRequest(guestReq, TEST_ENV, fixtures);
  assert.strictEqual(guestRes.status, 403);

  // 2. Alumni cố gọi /finance/cash-session/open -> 403
  const alumniReq = new Request('http://localhost:8787/api/v1/finance/cash-session/open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${alumniToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionDate: '2026-10-18', openingCash: 200000 }),
  });
  const alumniRes = await handleRequest(alumniReq, TEST_ENV, fixtures);
  assert.strictEqual(alumniRes.status, 403);
});

test('G-policy/HTTP 7: Finance Cash Session full HTTP lifecycle - Open, today, summary, close with discrepancy', async () => {
  const fixtures = createFixtures();
  const mockDb = new MockCashDbQueryable();
  fixtures.queryable = mockDb;

  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'anh.haucan',
    role: 'MEMBER',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);

  // 1. Khi chưa có ca nào mở: GET /today -> 404 NO_ACTIVE_SESSION
  const todayEmptyReq = new Request('http://localhost:8787/api/v1/finance/cash-session/today', {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const todayEmptyRes = await handleRequest(todayEmptyReq, TEST_ENV, fixtures);
  assert.strictEqual(todayEmptyRes.status, 404);
  const emptyBody: any = await todayEmptyRes.json();
  assert.strictEqual(emptyBody.error.code, 'NO_ACTIVE_SESSION');

  // 2. Mở ca: POST /open với 200k -> 201 Created
  const openReq = new Request('http://localhost:8787/api/v1/finance/cash-session/open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: 'CS-20261018-01',
      sessionDate: '2026-10-18',
      openingCash: 200000,
    }),
  });
  const openRes = await handleRequest(openReq, TEST_ENV, fixtures);
  assert.strictEqual(openRes.status, 201);
  const openData: any = await openRes.json();
  assert.strictEqual(openData.data.id, 'CS-20261018-01');
  assert.strictEqual(openData.data.opening_cash, 200000);
  assert.strictEqual(openData.data.is_closed, false);

  // 3. Kiểm tra GET /today -> 200 OK với ca vừa mở
  const todayReq = new Request('http://localhost:8787/api/v1/finance/cash-session/today', {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const todayRes = await handleRequest(todayReq, TEST_ENV, fixtures);
  assert.strictEqual(todayRes.status, 200);
  const todayData: any = await todayRes.json();
  assert.strictEqual(todayData.data.id, 'CS-20261018-01');

  // 4. Lấy tóm tắt ca: GET /:id/summary -> 200 OK
  const summaryReq = new Request('http://localhost:8787/api/v1/finance/cash-session/CS-20261018-01/summary', {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const summaryRes = await handleRequest(summaryReq, TEST_ENV, fixtures);
  assert.strictEqual(summaryRes.status, 200);
  const summaryData: any = await summaryRes.json();
  assert.strictEqual(summaryData.data.openingCash, 200000);
  assert.strictEqual(summaryData.data.expectedCash, 200000);

  // 5. Đóng ca: Thực đếm 195k (lệch -5k) mà không có lý do -> 400
  const closeFailReq = new Request('http://localhost:8787/api/v1/finance/cash-session/close', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: 'CS-20261018-01',
      actualClosingCash: 195000,
      discrepancyReason: '',
    }),
  });
  const closeFailRes = await handleRequest(closeFailReq, TEST_ENV, fixtures);
  assert.strictEqual(closeFailRes.status, 400);
  const closeFailBody: any = await closeFailRes.json();
  assert.strictEqual(closeFailBody.error.code, 'DISCREPANCY_REASON_REQUIRED');

  // 6. Đóng ca với lý do giải trình hợp lệ -> 200 OK
  const closeSuccessReq = new Request('http://localhost:8787/api/v1/finance/cash-session/close', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: 'CS-20261018-01',
      actualClosingCash: 195000,
      discrepancyReason: 'Thối nhầm tiền lẻ cho bạn đọc',
    }),
  });
  const closeSuccessRes = await handleRequest(closeSuccessReq, TEST_ENV, fixtures);
  assert.strictEqual(closeSuccessRes.status, 200);
  const closeData: any = await closeSuccessRes.json();
  assert.strictEqual(closeData.data.session.is_closed, true);
  assert.strictEqual(closeData.data.actualCash, 195000);
  assert.strictEqual(closeData.data.discrepancy, -5000);
  assert.strictEqual(closeData.data.discrepancyReason, 'Thối nhầm tiền lẻ cho bạn đọc');
});

test('G-policy/HTTP 8: Catalog endpoints - Public search & detail; Internal copy CRUD & RBAC', async () => {
  const fixtures = createFixtures();
  const db = fixtures.queryable as MockCashDbQueryable;

  // Seed Catalog Data
  db.bookTitles.push({
    id: 'title-http-01',
    title: 'Kỹ Thuật Lập Trình',
    original_title: 'Programming Techniques',
    description: 'Giáo trình CNTT',
    authors: ['TS. Đặng Văn Đức'],
    categories: ['Công nghệ thông tin'],
  });
  db.bookEditions.push({
    id: 'ed-http-01',
    title_id: 'title-http-01',
    publisher: 'NXB Bách Khoa',
    publish_year: 2023,
    isbn: '978-604-0-99999-9',
  });

  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'anh.haucan',
    role: 'MEMBER',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);

  const guestActor: AuthenticatedActor = {
    userId: 'usr_guest',
    username: 'khach.vanglai',
    role: 'GUEST',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const guestToken = await signSessionToken(guestActor, TEST_SECRET);

  // 1. Public Search: Ai cũng xem được (kể cả không có token)
  const searchReq = new Request('http://localhost:8787/api/v1/books?query=K%E1%BB%B9%20Thu%E1%BA%ADt');
  const searchRes = await handleRequest(searchReq, TEST_ENV, fixtures);
  assert.strictEqual(searchRes.status, 200);
  const searchData: any = await searchRes.json();
  assert.strictEqual(searchData.data.length, 1);
  assert.strictEqual(searchData.data[0].title, 'Kỹ Thuật Lập Trình');

  // 2. Public Detail: Xem chi tiết sách
  const detailReq = new Request('http://localhost:8787/api/v1/books/title-http-01');
  const detailRes = await handleRequest(detailReq, TEST_ENV, fixtures);
  assert.strictEqual(detailRes.status, 200);
  const detailData: any = await detailRes.json();
  assert.strictEqual(detailData.data.title, 'Kỹ Thuật Lập Trình');
  assert.strictEqual(detailData.data.editions.length, 1);

  // 3. Khách thử tạo bản sách vật lý -> Bị từ chối 403 Forbidden
  const guestCreateReq = new Request('http://localhost:8787/api/v1/books/copies', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${guestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      editionId: 'ed-http-01',
      barcode: 'YSBK-HTTP-001',
      coverPrice: 75000,
    }),
  });
  const guestCreateRes = await handleRequest(guestCreateReq, TEST_ENV, fixtures);
  assert.strictEqual(guestCreateRes.status, 403);

  assert.equal((await handleRequest(new Request('http://localhost:8787/api/v1/books/copies',{method:'POST',headers:{Authorization:`Bearer ${memberToken}`,'Content-Type':'application/json'},body:JSON.stringify({editionId:'ed-http-01',barcode:'FORBIDDEN-COPY'})}),TEST_ENV,fixtures)).status,403);

  // 4. Chỉ quản lý được nhập bản sách; nghiệp vụ cập nhật vị trí vẫn dành cho thành viên
  const catalogAdminToken = await signSessionToken({...memberActor,memberId:'00000000-0000-0000-0000-000000000001',role:'ADMIN'}, TEST_SECRET);
  const memberCreateReq = new Request('http://localhost:8787/api/v1/books/copies', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${catalogAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      editionId: 'ed-http-01',
      barcode: 'YSBK-HTTP-001',
      location: 'KHO_THU_VIEN',
      coverPrice: 75000,
    }),
  });
  const memberCreateRes = await handleRequest(memberCreateReq, TEST_ENV, fixtures);
  assert.strictEqual(memberCreateRes.status, 201);
  const copyData: any = await memberCreateRes.json();
  assert.strictEqual(copyData.data.barcode, 'YSBK-HTTP-001');
  assert.strictEqual(copyData.data.calculatedDeposit, 100000); // 75k -> 100k
});

test('G-policy/HTTP 9: Borrower endpoints - RBAC matrix and community non-student support', async () => {
  const fixtures = createFixtures();

  const memberActor: AuthenticatedActor = {
    userId: 'usr_member',
    memberId: '00000000-0000-0000-0000-000000000002',
    username: 'anh.haucan',
    role: 'MEMBER',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const memberToken = await signSessionToken(memberActor, TEST_SECRET);

  const guestActor: AuthenticatedActor = {
    userId: 'usr_guest',
    username: 'khach.vanglai',
    role: 'GUEST',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };
  const guestToken = await signSessionToken(guestActor, TEST_SECRET);

  const alumniActor: AuthenticatedActor = {
    userId: 'usr_alumni',
    memberId: '00000000-0000-0000-0000-000000000005',
    username: 'thang.cuu',
    role: 'ALUMNI',
    team: 'HAU_CAN',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };
  const alumniToken = await signSessionToken(alumniActor, TEST_SECRET);

  // 1. Guest và Alumni bị chặn truy cập danh sách Borrower -> 403 Forbidden
  const guestReq = new Request('http://localhost:8787/api/v1/borrowers', {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  assert.strictEqual((await handleRequest(guestReq, TEST_ENV, fixtures)).status, 403);

  const alumniReq = new Request('http://localhost:8787/api/v1/borrowers', {
    headers: { Authorization: `Bearer ${alumniToken}` },
  });
  assert.strictEqual((await handleRequest(alumniReq, TEST_ENV, fixtures)).status, 403);

  // 2. Member tạo hồ sơ người mượn là Người dân (không ép MSSV hay trường)
  const createReq = new Request('http://localhost:8787/api/v1/borrowers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${memberToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fullName: 'Cô Nguyễn Thị Hoa',
      phone: '0912 345 678', // Chuẩn hóa SĐT
      studentId: null,
      school: null,
      notes: 'Độc giả phường Bách Khoa',
    }),
  });
  const createRes = await handleRequest(createReq, TEST_ENV, fixtures);
  assert.strictEqual(createRes.status, 201);
  const createdBody: any = await createRes.json();
  assert.strictEqual(createdBody.data.fullName, 'Cô Nguyễn Thị Hoa');
  assert.strictEqual(createdBody.data.phone, '0912345678');
  assert.strictEqual(createdBody.data.studentId, null);
  assert.strictEqual(createdBody.data.school, null);

  // 3. Member tra cứu theo ID
  const getReq = new Request(`http://localhost:8787/api/v1/borrowers/${createdBody.data.id}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const getRes = await handleRequest(getReq, TEST_ENV, fixtures);
  assert.strictEqual(getRes.status, 200);
  const getBody: any = await getRes.json();
  assert.strictEqual(getBody.data.fullName, 'Cô Nguyễn Thị Hoa');
});
