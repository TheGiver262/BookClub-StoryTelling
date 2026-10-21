import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {DbHarness} from './db-harness.ts';
import {handleRequest} from '../../src/server/router.ts';

const h=new DbHarness();
const env={NODE_ENV:'test',SUPABASE_URL:'https://auth.example.invalid',SUPABASE_ANON_KEY:'test',READER_GOOGLE_ENABLED:'true'};
const origin='https://books.example.test';
const fixtures=(subject='google-reader-1')=>({queryable:h.getPool(),readerAuthFetch:async()=>Response.json({user:{id:subject,email:'reader@example.test',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'google'},user_metadata:{full_name:'Bạn đọc thử nghiệm'}}})});
const cookie=(r:Response)=>r.headers.get('set-cookie')!.split(';')[0];
before(async()=>{await h.resetSchema();await h.applyDDL();await h.applySeed();await h.applyMigrations();});
after(async()=>{await h.close();});
async function login(subject='google-reader-1'){
  const start=await handleRequest(new Request(origin+'/api/v1/readers/auth/google?next='+encodeURIComponent('/sach/?tab=tra-don')),env,fixtures() as any);
  assert.equal(start.status,302);
  const authorize=new URL(start.headers.get('location')!);
  assert.equal(authorize.searchParams.get('provider'),'google');
  assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
  const callback=new URL(authorize.searchParams.get('redirect_to')!);callback.searchParams.set('code','one-use-code');
  const response=await handleRequest(new Request(callback,{headers:{Cookie:cookie(start)}}),env,fixtures(subject) as any);
  assert.equal(response.status,303);
  const cookies=response.headers.getSetCookie();
  const session=cookies.find(v=>v.startsWith('__Host-ysbk_reader='))!.split(';')[0];
  assert(cookies.some(v=>v.includes('HttpOnly')&&v.includes('Secure')&&v.includes('Max-Age=2592000')));
  return session;
}
const me=(session:string)=>handleRequest(new Request(origin+'/api/v1/readers/me',{headers:{Cookie:session}}),env,fixtures() as any);

test('Google tạo hồ sơ riêng và chỉ lưu hash token phiên trong DB',async()=>{
  const session=await login();const response=await me(session);assert.equal(response.status,200);
  const data=(await response.json() as any).data;assert.equal(data.email,'reader@example.test');assert.equal(data.role,undefined);
  const row=(await h.getPool().query('SELECT * FROM reader_accounts')).rows[0];assert.equal(row.provider_subject,'google-reader-1');assert.notEqual(row.session_hash,session.split('=')[1]);
  assert.equal((await h.getPool().query("SELECT COUNT(*) FROM members WHERE username='reader@example.test'")).rows[0].count,'0');
});
test('đăng nhập mới thu hồi phiên cũ; logout từ phiên cũ không làm mất phiên mới',async()=>{
  const old=await login(),current=await login();assert.equal((await me(old)).status,401);assert.equal((await me(current)).status,200);
  await handleRequest(new Request(origin+'/api/v1/readers/logout',{method:'POST',headers:{Cookie:old,Origin:origin}}),env,fixtures() as any);
  assert.equal((await me(current)).status,200);
  await handleRequest(new Request(origin+'/api/v1/readers/logout',{method:'POST',headers:{Cookie:current,Origin:origin}}),env,fixtures() as any);
  assert.equal((await me(current)).status,401);
});
test('hết hạn hoặc bị khóa trong DB đều bị từ chối ngay',async()=>{
  let session=await login();await h.getPool().query("UPDATE reader_accounts SET session_expires_at=NOW()-INTERVAL '1 second'");assert.equal((await me(session)).status,401);
  session=await login();await h.getPool().query('UPDATE reader_accounts SET is_active=FALSE');assert.equal((await me(session)).status,401);
  await h.getPool().query('UPDATE reader_accounts SET is_active=TRUE');
});
test('đăng nhập đồng thời chỉ để lại một phiên; chặn CSRF sửa hồ sơ',async()=>{
  const sessions=await Promise.all([login(),login()]);const statuses=await Promise.all(sessions.map(async s=>(await me(s)).status));assert.deepEqual(statuses.sort(),[200,401]);
  const current=sessions[(await me(sessions[0])).status===200?0:1];
  const response=await handleRequest(new Request(origin+'/api/v1/readers/me',{method:'PATCH',headers:{Cookie:current,Origin:'https://evil.example.test','Content-Type':'application/json'},body:JSON.stringify({fullName:'Tên khác',phone:'0912345678'})}),env,fixtures() as any);
  assert.equal(response.status,403);
});
test('tài khoản bạn đọc không cấp quyền nội bộ',async()=>{
  const session=await login();
  const response=await handleRequest(new Request(origin+'/api/v1/members',{headers:{Cookie:session}}),env,fixtures() as any);assert.equal(response.status,401);
});

test('đơn mới thuộc tài khoản server; người khác không đọc/hủy/replay được kể cả có token đơn',async()=>{
  const session=await login(),db=h.getPool();
  const profileResponse=await handleRequest(new Request(origin+'/api/v1/readers/me',{method:'PATCH',headers:{Cookie:session,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({fullName:'Chủ đơn hợp lệ',phone:'0912345678'})}),env,fixtures() as any);
  assert.equal(profileResponse.status,200);
  const title=(await db.query("INSERT INTO book_titles(title) VALUES ('Reader test book') RETURNING id")).rows[0].id;
  const edition=(await db.query("INSERT INTO book_editions(title_id,publisher) VALUES ($1,'Test') RETURNING id",[title])).rows[0].id;
  await db.query("INSERT INTO book_copies(edition_id,barcode,cover_price,location) VALUES ($1,'READER_TEST_1',50000,'BAN_TRUC_TAM')",[edition]);
  const shift=(await db.query("INSERT INTO duty_schedules(id,term_semester,schedule_date,day_of_week,shift_time,status) VALUES (gen_random_uuid(),'2030.1','2030-01-01','THU_BA','00:00 - 23:59','PUBLISHED') RETURNING id")).rows[0].id;
  const body={titleId:title,scheduleId:shift,fullName:'Tên giả mạo',phone:'0999999999',captchaToken:'test'};
  const reserve=(cookie:string)=>handleRequest(new Request(origin+'/api/v1/public/reservations',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','Idempotency-Key':'reader-owned-intent'},body:JSON.stringify(body)}),{...env,RESERVATION_IP_SECRET:'reader_test_ip_secret_32_characters',TURNSTILE_SECRET_KEY:'test'},{...fixtures(),now:new Date('2029-12-31T00:00:00Z'),clientIp:'192.0.2.201',turnstileFetch:async()=>Response.json({success:true,action:'reservation'})} as any);
  const created=await reserve(session);assert.equal(created.status,201,await created.clone().text());
  const result=await created.json() as any;
  const row=(await db.query('SELECT full_name,phone,reader_account_id FROM reservations WHERE id=$1',[result.reservation.id])).rows[0];assert.equal(row.full_name,'Chủ đơn hợp lệ');assert.equal(row.phone,'0912345678');assert(row.reader_account_id);
  const list=(cookie:string)=>handleRequest(new Request(origin+'/api/v1/readers/reservations',{headers:{Cookie:cookie}}),env,fixtures() as any);
  assert.equal((await (await list(session)).json() as any).data.length,1);
  const other=await login('google-reader-2');
  assert.equal((await (await list(other)).json() as any).data.length,0);
  const denied=await handleRequest(new Request(origin+'/api/v1/readers/reservations/'+result.reservation.id+'/cancel',{method:'POST',headers:{Cookie:other,Origin:origin,'Content-Type':'application/json'},body:'{}'}),env,fixtures() as any);assert.equal(denied.status,404);
  for(const method of ['GET','POST']) {
    const response=await handleRequest(new Request(origin+'/api/v1/public/reservation'+(method==='POST'?'/cancel':''),{method,headers:{Cookie:other,Origin:origin,Authorization:'Bearer '+result.lookupToken,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})}),env,fixtures() as any);assert.equal(response.status,404);
  }
  const replay=await reserve(session);assert.equal(replay.status,200);
  await db.query("UPDATE reader_accounts SET full_name='Chủ khác',phone='0912345678' WHERE provider_subject='google-reader-2'");
  const wrongReplay=await reserve(other);assert.equal(wrongReplay.status,409);
  const cancelled=await handleRequest(new Request(origin+'/api/v1/readers/reservations/'+result.reservation.id+'/cancel',{method:'POST',headers:{Cookie:session,Origin:origin,'Content-Type':'application/json'},body:'{}'}),env,fixtures() as any);assert.equal(cancelled.status,200);
});
