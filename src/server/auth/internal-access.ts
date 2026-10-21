import type {Env} from '../types.ts';

let cached:{issuer:string;expires:number;keys:JsonWebKey[]}|undefined;
const deny=(status:number)=>Response.json({error:{code:status===503?'ACCESS_CONFIG_MISSING':'ACCESS_DENIED',message:status===503?'Cổng truy cập chưa được cấu hình.':'Không tìm thấy hoặc không có quyền truy cập.'}},{status,headers:{'Cache-Control':'no-store'}});
function isPublicApi(path:string,method:string){
  if(path.startsWith('/api/v1/readers/')) return true;
  if(path.startsWith('/api/v1/public/')) return true;
  if(method==='GET'&&(/^\/api\/v1\/books(?:\/[^/]+)?$/.test(path)||path==='/api/v1/circulation/calendar/holidays'||path==='/api/v1/recruitment/announcements/public-results'||path==='/api/v1/recruitment/responses/public-summary')) return true;
  return method==='POST'&&(path==='/api/v1/content/reviews'||path==='/api/v1/reviews'||path==='/api/v1/recruitment/webhook/google-form');
}
async function verifyAccess(token:string,env:Env){
  try {
    if(token.length>16000) return false;
    const parts=token.split('.');if(parts.length!==3) return false;
    const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    const issuer='https://'+env.CF_ACCESS_TEAM_DOMAIN,now=Math.floor(Date.now()/1000);
    if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(env.CF_ACCESS_AUD)||typeof claims.exp!=='number'||claims.exp<=now||typeof claims.nbf==='number'&&claims.nbf>now||claims.type!=='app') return false;
    if(!cached||cached.issuer!==issuer||cached.expires<Date.now()||!cached.keys.some(key=>(key as JsonWebKey&{kid:string}).kid===header.kid)){
      const response=await fetch(issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000)});
      if(!response.ok) return false;
      const body:any=await response.json();if(!Array.isArray(body.keys)) return false;
      cached={issuer,expires:Date.now()+300000,keys:body.keys};
    }
    const jwk=cached.keys.find(key=>(key as JsonWebKey&{kid:string}).kid===header.kid);
    if(!jwk||jwk.kty!=='RSA') return false;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  } catch {return false;}
}
export async function enforceInternalAccess(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url);
  let path:string;
  try {path=decodeURIComponent(url.pathname).replace(/\/+/g,'/');}catch{return deny(404);}
  if(env.NODE_ENV==='development'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return null;
  if(!env.PUBLIC_ORIGIN||!env.INTERNAL_ORIGIN||env.PUBLIC_ORIGIN===env.INTERNAL_ORIGIN||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(env.CF_ACCESS_TEAM_DOMAIN||'')||!env.CF_ACCESS_AUD) return deny(503);
  if(url.origin===env.INTERNAL_ORIGIN){
    const token=request.headers.get('Cf-Access-Jwt-Assertion');
    return token&&await verifyAccess(token,env)?null:deny(403);
  }
  if(url.origin!==env.PUBLIC_ORIGIN) return deny(404);
  if(/^\/(login|noi-bo)(\/|$)/.test(path)||/^\/_astro\/(InternalWorkspace|MembershipManager|PublishingManager)[.]/.test(path)) return deny(404);
  if(path.startsWith('/v1/')||path==='/api'||path.startsWith('/api/')) return isPublicApi(path,request.method)?null:deny(404);
  return null;
}
