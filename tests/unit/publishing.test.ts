import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePublicImage, date, saveBook, savePickup, saveRecruitment } from '../../src/server/publishing/service.ts';
import { handleRequest } from '../../src/server/router.ts';
import { signSessionToken } from '../../src/server/auth/tokens.ts';
import {changeMembership} from '../../src/server/members/lifecycle.ts';
import {requireInternalMember} from '../../src/server/auth/policy.ts';

test('ảnh công khai: từ chối SVG, HTML giả ảnh, ảnh quá lớn; nhận chữ ký WebP',()=>{
  assert.throws(()=>decodePublicImage('data:image/svg+xml;base64,PHN2Zy8+'));
  assert.throws(()=>decodePublicImage('data:image/png;base64,'+Buffer.from('<script>bad</script>').toString('base64')));
  assert.throws(()=>decodePublicImage('x'.repeat(246001)));
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  assert.equal(decodePublicImage('data:image/png;base64,'+png.toString('base64')).mime,'image/png');
  assert.throws(()=>date('2026-02-31'));
  assert.equal(date('2026-10-22'),'2026-10-22');
});

test('thành viên/cộng tác viên và cựu thành viên không được cập nhật nội dung',async()=>{
  const db:any={query:()=>{throw Error('Không được chạm database');}};
  for(const actor of [{role:'MEMBER',isActive:true,isAlumni:false},{role:'MEMBER',isActive:true,isAlumni:true},{role:'ADMIN',isActive:false,isAlumni:false}]) {
    for(const save of [saveBook,savePickup,saveRecruitment]) await assert.rejects(()=>save(db,actor as any,{}));
  }
});

test('mọi đường ghi nội dung đều chặn tài khoản thành viên ở HTTP',async()=>{
  const secret='publishing_test_secret_32_characters_2026';
  const id='00000000-0000-0000-0000-000000000001';
  const actor:any={userId:id,memberId:id,username:'member',role:'MEMBER',isActive:true,isAlumni:false,tokenVersion:1};
  const token=await signSessionToken(actor,secret);
  const membersDb:any={[id]:{id,username:'member',is_active:true,is_alumni:false,is_admin:false,token_version:1}};
  for(const [method,path] of [['POST','/api/v1/admin/publishing/books'],['POST','/api/v1/admin/publishing/schedules'],['POST','/api/v1/admin/publishing/recruitment'],['POST','/api/v1/books/titles'],['POST','/api/v1/books/copies'],['POST','/api/v1/events'],['PATCH','/api/v1/events/abc'],['POST','/api/v1/duty/schedules/generate'],['POST','/api/v1/moderation/posts']]) {
    const response=await handleRequest(new Request('http://local'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'}),{JWT_SECRET:secret,NODE_ENV:'test'},{membersDb});
    assert.equal(response.status,403,path);
  }
});

test('cộng tác viên có quyền thành viên; chỉ quản lý quyết định vòng đời và phải đủ tháng/đạt đánh giá',async()=>{
  const collaborator:any={userId:'ctv',role:'MEMBER',isActive:true,isAlumni:false,isCollaborator:true};
  assert.equal(requireInternalMember(collaborator),collaborator);
  const admin:any={userId:'admin',memberId:'admin',role:'ADMIN',isActive:true,isAlumni:false};
  const mock=(row:any):any=>({query:async()=>({rows:[row]})});
  await assert.rejects(()=>changeMembership(mock({}),collaborator,'ctv',{action:'DELETE_COLLABORATOR'}));
  await assert.rejects(()=>changeMembership(mock({is_collaborator:true,is_active:true,probation_complete:false}),admin,'ctv',{action:'PROMOTE',passed:true,evaluation:'Đánh giá đạt'}),/đủ một tháng/);
  await assert.rejects(()=>changeMembership(mock({is_collaborator:true,is_active:true,probation_complete:true}),admin,'ctv',{action:'PROMOTE',passed:false,evaluation:'Đánh giá đạt'}),/xác nhận/);
  await assert.rejects(()=>changeMembership(mock({is_collaborator:false}),admin,'member',{action:'DELETE_COLLABORATOR'}),/cựu thành viên/);
});
