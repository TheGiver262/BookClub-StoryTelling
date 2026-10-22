import test from 'node:test';
import assert from 'node:assert/strict';
import {requireAuthenticated,requireInternalMember,requireAdmin,requireContentManager} from '../../src/server/auth/policy.ts';
import {handleRequest} from '../../src/server/router.ts';
import {signSessionToken} from '../../src/server/auth/tokens.ts';

const actor=(role:string,extra={})=>({userId:'test-member',memberId:'test-member',role,isActive:true,isAlumni:false,tokenVersion:1,...extra} as any);
test('managers and admins publish; members and collaborators only prepare content',()=>{
  for(const role of ['ADMIN','MANAGER']) assert.equal(requireContentManager(actor(role)).role,role);
  for(const role of ['MEMBER','COLLABORATOR']) {
    assert.equal(requireInternalMember(actor(role)).role,role);
    assert.throws(()=>requireContentManager(actor(role)));
  }
  assert.throws(()=>requireAdmin(actor('MANAGER')));
});
test('retired identities cannot authenticate, even with an old active/admin token',()=>{
  for(const retired of [actor('ALUMNI'),actor('ADMIN',{isAlumni:true}),actor('MEMBER',{isAlumni:true})]) assert.throws(()=>requireAuthenticated(retired));
});
test('HTTP resolves manager from live DB flags; publishing does not grant account administration',async()=>{
 const secret='internal_role_test_secret_32_characters',id='00000000-0000-0000-0000-000000000001';
 const token=await signSessionToken({...actor('MEMBER'),memberId:id},secret);
 const fixtures:any={revokedTokenHashes:new Set(),membersDb:{[id]:{id,is_active:true,is_alumni:false,is_manager:true,token_version:1}},queryable:{query:async()=>({rows:[],rowCount:0})}};
 const call=(path:string,body:any)=>handleRequest(new Request('http://localhost'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}),{NODE_ENV:'test',JWT_SECRET:secret},fixtures);
 assert.equal((await call('/api/v1/moderation/posts',{})).status,400);
 assert.equal((await call('/api/v1/moderation/posts/missing/publish',{})).status,404);
 assert.equal((await call('/api/v1/members/00000000-0000-0000-0000-000000000002/membership',{action:'DEACTIVATE'})).status,403);
});
