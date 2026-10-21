import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../../src/server/router.ts';
import {cancelReservation} from '../../src/server/reservations/service.ts';
import {readerHeaders,withReaderSession} from '../helpers/reader-session.ts';

test('đặt sách yêu cầu phiên bạn đọc trước CAPTCHA và database',async()=>{
  const response=await handleRequest(new Request('http://localhost/api/v1/public/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{NODE_ENV:'test'},{queryable:{query:async()=>{throw Error('Không được đọc DB');}} as any});
  assert.equal(response.status,401);
  assert.equal((await response.json() as any).error.code,'READER_LOGIN_REQUIRED');
});

test('OAuth callback thiếu state cookie không được gọi provider hoặc database',async()=>{
  const response=await handleRequest(new Request('http://localhost/api/v1/readers/auth/callback?code=invalid&state=invalid'),{NODE_ENV:'test',SUPABASE_URL:'https://auth.example.invalid',SUPABASE_ANON_KEY:'test'});
  assert.equal(response.status,400);
  assert.equal((await response.json() as any).error.code,'INVALID_OAUTH_STATE');
});

test('bắt đầu đăng nhập Google phải fail closed khi chưa cấu hình',async()=>{
  const response=await handleRequest(new Request('http://localhost/api/v1/readers/auth/google'),{NODE_ENV:'test'});
  assert.equal(response.status,503);
});

test('UI được biết Google chưa cấu hình mà không lộ khóa provider',async()=>{
  const response=await handleRequest(new Request('http://localhost/api/v1/readers/auth/status'),{NODE_ENV:'test'});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{data:{googleEnabled:false}});
});

test('token đơn khách cũ vẫn hủy được khi người giữ token đã đăng nhập tài khoản mới',async()=>{
  const db:any={query:async(sql:string)=>({rows:sql.includes('SELECT r.*')?[{id:'legacy-order',code:'OLD',status:'HELD',reader_account_id:null,created_at:new Date(),expires_at:new Date(Date.now()+60000)}]:[]})};
  const result=await cancelReservation(db,{token:'old-secret-lookup-token',readerAccountId:'new-reader'},null);
  assert.equal(result.status,'CANCELLED');
});

test('phiên bạn đọc Google dùng được luồng gửi cảm nhận công khai hiện có, không cấp role nội bộ',async()=>{
  const id='00000000-0000-0000-0000-000000000777';
  const db=withReaderSession({query:async(sql:string,values?:any[])=>{
    if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)) return {rows:[],rowCount:0};
    if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK') return {rows:[]};
    if(sql.includes('SELECT id, title FROM book_titles')) return {rows:[{id:'book'}]};
    if(sql.includes('INSERT INTO book_reviews')){assert.equal(values?.[1],id);return {rows:[{id:'review',author_id:id,status:'PENDING'}]};}
    throw Error('Unexpected SQL');
  }});
  const response=await handleRequest(new Request('http://localhost/api/v1/content/reviews',{method:'POST',headers:{...readerHeaders,'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({bookId:'book',authorName:'Bạn đọc',rating:5,content:'Cảm nhận sách để kiểm tra phiên bạn đọc.'})}),{NODE_ENV:'test'},{queryable:db as any});
  assert.equal(response.status,201);
});

test('OAuth PKCE callback kiểm tra verifier/challenge và từ chối provider sai hoặc lỗi',async()=>{
  const env={NODE_ENV:'test',READER_GOOGLE_ENABLED:'true',SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'test'};
  const origin='https://books.example.test';
  for(const user of [{id:'email-user',email:'a@example.test',email_confirmed_at:'now',app_metadata:{provider:'email'}},{id:'google-user',email:'a@example.test',app_metadata:{provider:'google'}}]){
    const start=await handleRequest(new Request(origin+'/api/v1/readers/auth/google?next=https://evil.test'),env);
    const target=new URL(start.headers.get('location')!),callback=new URL(target.searchParams.get('redirect_to')!);callback.searchParams.set('code','test-code');
    let called=false;
    const response=await handleRequest(new Request(callback,{headers:{Cookie:start.headers.get('set-cookie')!.split(';')[0]}}),env,{readerAuthFetch:async(_url,options)=>{
      called=true;assert.equal(String(_url),'https://auth.example.test/auth/v1/token?grant_type=pkce');
      const body=JSON.parse(options!.body as string);assert.equal(body.auth_code,'test-code');
      const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),target.searchParams.get('code_challenge'));
      return Response.json({user});
    },queryable:{query:async()=>{throw Error('Invalid identity must not reach DB');}} as any});
    assert(called);assert.equal(response.status,401);assert.equal((await response.json() as any).error.code,'INVALID_GOOGLE_IDENTITY');
  }
});
