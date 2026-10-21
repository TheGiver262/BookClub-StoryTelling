import {randomBytes,createHash} from 'node:crypto';
import type {Queryable} from '../finance/types.ts';
import type {Env} from '../types.ts';
import {withTransaction} from '../db/client.ts';
import {BadRequestError,ForbiddenError,UnauthorizedError,ServiceUnavailableError} from '../errors.ts';
import {normalizePhone} from '../borrowers/rules.ts';

export interface ReaderProfile { id:string; email:string; fullName:string; phone:string|null; }
const SESSION_SECONDS=30*24*60*60;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
const secure=(request:Request)=>new URL(request.url).protocol==='https:';
function cookieName(request:Request,flow=false){return (secure(request)?'__Host-':'')+'ysbk_reader'+(flow?'_oauth':'');}
export function readerCookie(request:Request,value:string,maxAge=SESSION_SECONDS,flow=false){
  return `${cookieName(request,flow)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(request)?'; Secure':''}`;
}
function cookie(request:Request,flow=false){
  const name=cookieName(request,flow)+'=';
  return (request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name))?.slice(name.length)||'';
}
function profile(row:any):ReaderProfile{return {id:row.id,email:row.email,fullName:row.full_name,phone:row.phone};}
export function assertReaderOrigin(request:Request){
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) throw new ForbiddenError('Nguồn yêu cầu không hợp lệ.','INVALID_ORIGIN');
}
export async function resolveReader(request:Request,db:()=>Queryable,required=true,lock=false):Promise<ReaderProfile|null>{
  const token=cookie(request);
  if(/^[A-Za-z0-9_-]{43}$/.test(token)){
    const result=await db().query<any>('SELECT id,email,full_name,phone FROM reader_accounts WHERE session_hash=$1 AND session_expires_at>clock_timestamp() AND is_active=TRUE'+(lock?' FOR SHARE':''),[hash(token)]);
    if(result.rows.length) return profile(result.rows[0]);
  }
  if(required) throw new UnauthorizedError('Vui lòng đăng nhập tài khoản bạn đọc để tiếp tục.','READER_LOGIN_REQUIRED');
  return null;
}
function provider(env?:Env){
  if(env?.READER_GOOGLE_ENABLED!=='true'||!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY) throw new ServiceUnavailableError('Đăng nhập Google chưa được cấu hình. Vui lòng liên hệ CLB.','READER_GOOGLE_UNCONFIGURED');
  return {url:env.SUPABASE_URL.replace(/\/$/,''),key:env.SUPABASE_ANON_KEY};
}
function safeNext(value:string|null){return value && /^\/sach\/(?:\?|$)/.test(value)&&value.length<=1000?value:'/sach/?tab=tra-don';}
export async function handleReaderRequest(request:Request,env:Env|undefined,db:()=>Queryable,providerFetch:typeof fetch=fetch):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname;
  const json=(data:unknown)=>Response.json({data},{headers:{'Cache-Control':'no-store'}});
  if(request.method==='GET'&&path==='/api/v1/readers/auth/status') return json({googleEnabled:env?.READER_GOOGLE_ENABLED==='true'&&Boolean(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY)});
  if(request.method==='GET'&&path==='/api/v1/readers/auth/google'){
    const auth=provider(env),state=random(),verifier=random();
    const callback=new URL('/api/v1/readers/auth/callback',url.origin);callback.searchParams.set('state',state);
    const target=new URL(auth.url+'/auth/v1/authorize');
    target.searchParams.set('provider','google');target.searchParams.set('redirect_to',callback.href);
    target.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));
    target.searchParams.set('code_challenge_method','s256');
    const flow=Buffer.from(JSON.stringify({state,verifier,next:safeNext(url.searchParams.get('next')),expires:Date.now()+600000})).toString('base64url');
    return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':readerCookie(request,flow,600,true),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(request.method==='GET'&&path==='/api/v1/readers/auth/callback'){
    let flow:any;
    try {const raw=cookie(request,true);if(raw.length>3000) throw Error();flow=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));}catch{}
    const code=url.searchParams.get('code'),state=url.searchParams.get('state');
    if(!flow||!state||flow.state!==state||flow.expires<Date.now()||!/^[A-Za-z0-9_-]{43}$/.test(flow.verifier)||!code||code.length>2048) throw new BadRequestError('Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Hãy thử lại.','INVALID_OAUTH_STATE');
    const auth=provider(env);
    let response:Response;
    try {response=await providerFetch(auth.url+'/auth/v1/token?grant_type=pkce',{method:'POST',headers:{'Content-Type':'application/json',apikey:auth.key},body:JSON.stringify({auth_code:code,code_verifier:flow.verifier}),signal:AbortSignal.timeout(10000)});}
    catch {throw new ServiceUnavailableError('Không kết nối được dịch vụ đăng nhập Google.','AUTH_PROVIDER_UNREACHABLE');}
    const result:any=await response.json().catch(()=>null),user=result?.user;
    if(!response.ok||!user?.id||typeof user.email!=='string'||!user.email_confirmed_at||!(user.app_metadata?.provider==='google'||user.identities?.some((identity:any)=>identity.provider==='google'))||user.email.toLowerCase().endsWith('@internal.ysbk.edu.vn')) throw new UnauthorizedError('Không xác minh được tài khoản Google.','INVALID_GOOGLE_IDENTITY');
    const token=random();
    const name=typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name.trim().slice(0,255):'';
    await withTransaction(db(),async (tx:Queryable)=>{
      const saved=await tx.query<any>(`INSERT INTO reader_accounts(provider_subject,email,full_name,session_hash,session_expires_at)
        VALUES($1,$2,$3,$4,clock_timestamp()+INTERVAL '30 days')
        ON CONFLICT(provider_subject) DO UPDATE SET email=EXCLUDED.email,session_hash=EXCLUDED.session_hash,session_expires_at=EXCLUDED.session_expires_at,updated_at=NOW()
        WHERE reader_accounts.is_active=TRUE RETURNING id`,[user.id,user.email.toLowerCase(),name,hash(token)]);
      if(!saved.rows.length) throw new ForbiddenError('Tài khoản bạn đọc đã bị khóa.','READER_DISABLED');
    });
    const headers=new Headers({'Location':safeNext(flow.next),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    headers.append('Set-Cookie',readerCookie(request,token));headers.append('Set-Cookie',readerCookie(request,'',0,true));
    return new Response(null,{status:303,headers});
  }
  if(request.method==='POST'&&path==='/api/v1/readers/logout'){
    assertReaderOrigin(request);
    const token=cookie(request);
    if(token) await db().query('UPDATE reader_accounts SET session_hash=NULL,session_expires_at=NULL WHERE session_hash=$1',[hash(token)]);
    return Response.json({data:null},{headers:{'Set-Cookie':readerCookie(request,'',0),'Cache-Control':'no-store'}});
  }
  if(path==='/api/v1/readers/me'&&(request.method==='GET'||request.method==='PATCH')){
    const reader=(await resolveReader(request,db))!;
    if(request.method==='GET') return json(reader);
    assertReaderOrigin(request);
    const input:any=await request.json().catch(()=>null);
    if(!input||typeof input.fullName!=='string'||input.fullName.trim().length<2||input.fullName.trim().length>255||typeof input.phone!=='string') throw new BadRequestError('Điền họ tên và số điện thoại hợp lệ.','INVALID_READER_PROFILE');
    const updated=await db().query<any>('UPDATE reader_accounts SET full_name=$2,phone=$3,updated_at=NOW() WHERE id=$1 AND session_hash=$4 AND session_expires_at>clock_timestamp() AND is_active=TRUE RETURNING id,email,full_name,phone',[reader.id,input.fullName.trim(),normalizePhone(input.phone),hash(cookie(request))]);
    if(!updated.rows.length) throw new UnauthorizedError('Phiên bạn đọc đã kết thúc.','READER_LOGIN_REQUIRED');
    return json(profile(updated.rows[0]));
  }
  return null;
}
