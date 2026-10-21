import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/server/index.ts';

const env={NODE_ENV:'production',PUBLIC_ORIGIN:'https://books.example.test',INTERNAL_ORIGIN:'https://manage.example.test',CF_ACCESS_TEAM_DOMAIN:'ysbk-test.cloudflareaccess.com',CF_ACCESS_AUD:'test-app-audience',ASSETS:{fetch:async()=>new Response('assets')}};
test('public host không phục vụ form/login, trang hoặc API nội bộ; origin khác không bypass',async()=>{
  for(const path of ['/login','/login/','/%6cogin','/%2fnoi-bo/?mode=demo','/noi-bo/?mode=demo','/api/v1/auth/login-internal','/v1/auth/internal/login','/api/v1/members']) {
    const response=await worker.fetch(new Request(env.PUBLIC_ORIGIN+path),env);assert.equal(response.status,404,path);
  }
  assert.equal((await worker.fetch(new Request('https://unguarded.workers.dev/login'),env)).status,404);
});
test('internal host không tin header email, thiếu hoặc giả Access JWT đều bị chặn',async()=>{
  for(const headers of [{},{'Cf-Access-Authenticated-User-Email':'admin@example.test'},{'Cf-Access-Jwt-Assertion':'invalid'}]) {
    assert.equal((await worker.fetch(new Request(env.INTERNAL_ORIGIN+'/login',{headers:headers as Record<string,string>}),env)).status,403);
  }
});
test('production thiếu cấu hình cổng nội bộ phải fail closed',async()=>{
  assert.equal((await worker.fetch(new Request('https://example.test/login'),{NODE_ENV:'production',ASSETS:env.ASSETS})).status,503);
});
test('bypass local chỉ áp dụng development trên loopback',async()=>{
  assert.equal((await worker.fetch(new Request('http://localhost/login'),{NODE_ENV:'development',ASSETS:env.ASSETS})).status,200);
  assert.notEqual((await worker.fetch(new Request('https://public.example.test/login'),{NODE_ENV:'development',ASSETS:env.ASSETS})).status,200);
});

test('Access xác minh chữ ký RSA, issuer, audience và expiry trước khi phục vụ nội bộ',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256'};
  const original=globalThis.fetch;
  globalThis.fetch=async(input)=>{assert.equal(String(input),'https://ysbk-test.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
  const token=async(overrides:Record<string,unknown>={})=>{
    const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const body=encode({alg:'RS256',kid:'test-key'})+'.'+encode({iss:'https://ysbk-test.cloudflareaccess.com',aud:[env.CF_ACCESS_AUD],exp:Math.floor(Date.now()/1000)+60,type:'app',...overrides});
    return body+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(body))).toString('base64url');
  };
  const access=(value:string)=>worker.fetch(new Request(env.INTERNAL_ORIGIN+'/login',{headers:{'Cf-Access-Jwt-Assertion':value}}),env);
  try{
    const valid=await token();assert.equal((await access(valid)).status,200);
    const parts=valid.split('.');parts[2]=(parts[2][0]==='a'?'b':'a')+parts[2].slice(1);assert.equal((await access(parts.join('.'))).status,403);
    for(const overrides of [{iss:'https://evil.test'},{aud:['wrong']},{exp:0},{nbf:Math.floor(Date.now()/1000)+60},{type:'org'}]) assert.equal((await access(await token(overrides))).status,403);
  }finally{globalThis.fetch=original;}
});
