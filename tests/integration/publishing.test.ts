import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {DbHarness} from './db-harness.ts';
import {withTransaction} from '../../src/server/db/client.ts';
import {saveBook,savePickup,saveRecruitment,closePickupDay} from '../../src/server/publishing/service.ts';
import {listPublicReservationBooks,createReservation,listPublicPickupSchedules} from '../../src/server/reservations/service.ts';
import {handleRequest} from '../../src/server/router.ts';
import {signSessionToken} from '../../src/server/auth/tokens.ts';
import {changeMembership} from '../../src/server/members/lifecycle.ts';
import {closeDatabasePool} from '../../src/server/db/client.ts';
import {convertPassedApplicantToMember} from '../../src/modules/recruitment/decisions.ts';
import {publishSchedule} from '../../src/server/duty/roster-service.ts';

const h=new DbHarness();let actor:any;let book:any;let shift:any;
const image='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
before(async()=>{await h.resetSchema();await h.applyDDL();await h.applySeed();await h.applyMigrations();const m=(await h.getPool().query('SELECT * FROM members WHERE is_admin LIMIT 1')).rows[0];actor={memberId:m.id,userId:m.id,role:'ADMIN',isAlumni:false,isActive:true,tokenVersion:m.token_version};});
after(async()=>{await h.close();});
test('PG: quản lý nhập đầu sách + mô tả + ảnh + hai bản trong một giao dịch; công khai đọc được',async()=>{
  book=await withTransaction(h.getPool(),db=>saveBook(db,actor,{title:'Câu chuyện trong sách',description:'Một hành trình khám phá và trưởng thành.',authors:'Tác giả A',categories:'Văn học',publisher:'NXB Trẻ',coverPrice:95000,barcodes:'PUB001\nPUB002',image}));
  const result=await listPublicReservationBooks(h.getPool(),{search:book.id,includeUnavailable:true});
  assert.equal(result.items.length,1);assert.equal(result.items[0].description,'Một hành trình khám phá và trưởng thành.');assert.equal(result.items[0].availableCopiesCount,2);
  const response=await handleRequest(new Request('http://local'+result.items[0].coverImageUrl),undefined,{queryable:h.getPool()});
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.equal((await response.arrayBuffer()).byteLength,12);
});
test('PG: lỗi mã bản trùng rollback cả sách lẫn ảnh; sửa nội dung không đổi tồn',async()=>{
  const before=(await h.getPool().query('SELECT COUNT(*) FROM public_media')).rows[0].count;
  await assert.rejects(()=>withTransaction(h.getPool(),db=>saveBook(db,actor,{title:'Không được tồn tại',publisher:'NXB',barcodes:'PUB001',image})));
  assert.equal((await h.getPool().query("SELECT COUNT(*) FROM book_titles WHERE title='Không được tồn tại'")).rows[0].count,'0');assert.equal((await h.getPool().query('SELECT COUNT(*) FROM public_media')).rows[0].count,before);
  await withTransaction(h.getPool(),db=>saveBook(db,actor,{...book,title:'Câu chuyện mới',publisher:'NXB Trẻ',description:'Tóm tắt đã cập nhật',authors:'Tác giả B',categories:'Tư duy',barcodes:''}));
  const row=(await listPublicReservationBooks(h.getPool(),{search:book.id,includeUnavailable:true})).items[0];
  assert.equal(row.availableCopiesCount,2);assert.equal(row.description,'Tóm tắt đã cập nhật');assert.equal(row.author,'Tác giả B');assert.equal(row.category,'Tư duy');
});
test('PG: buổi trực mở hiển thị công khai; hủy/đổi lịch khi đang có đơn phải bị chặn',async()=>{
  const input={date:'2030-01-01',start:'14:00',end:'17:00',location:'Bàn sách thử nghiệm',status:'PUBLISHED'};
  shift=await withTransaction(h.getPool(),db=>savePickup(db,actor,input));
  assert((await listPublicPickupSchedules(h.getPool())).some(s=>s.id===shift.id));
  process.env.RESERVATION_IP_SECRET='publishing_reservation_test_secret_2026';
  await withTransaction(h.getPool(),db=>createReservation(db,{titleId:book.id,scheduleId:shift.id,fullName:'Bạn đọc kiểm thử',phone:'0912345678'},{clientIp:'192.0.2.172',captchaToken:'test-token',now:new Date('2029-12-25T00:00:00Z')}));
  await assert.rejects(()=>withTransaction(h.getPool(),db=>savePickup(db,actor,{...shift,...input,status:'CANCELLED'})),/đang có bạn đọc/);
  await assert.rejects(()=>withTransaction(h.getPool(),db=>closePickupDay(db,input.date)),/đơn giữ sách/);
  await h.getPool().query("UPDATE reservations SET status='CANCELLED' WHERE schedule_id=$1",[shift.id]);
  await withTransaction(h.getPool(),db=>savePickup(db,actor,{...shift,...input,status:'CANCELLED'}));
  assert(!(await listPublicPickupSchedules(h.getPool())).some(s=>s.id===shift.id));
  await h.getPool().query("INSERT INTO calendar_holidays (holiday_date,name) VALUES ('2030-01-01','Nghỉ kiểm thử')");
  await assert.rejects(()=>withTransaction(h.getPool(),db=>publishSchedule(db,shift.id,actor.memberId)),/đánh dấu nghỉ/);
  await assert.rejects(()=>withTransaction(h.getPool(),db=>savePickup(db,actor,{...shift,...input,status:'PUBLISHED'})),/đánh dấu nghỉ/);
});
test('PG: tuyển thành viên nháp không lộ công khai; mở/đóng cập nhật được và kiểm tra API admin',async()=>{
  await withTransaction(h.getPool(),db=>saveRecruitment(db,actor,{title:'Gen mới',description:'Cùng viết tiếp câu chuyện',formUrl:'https://forms.gle/example',status:'DRAFT',image}));
  const publicRequest=()=>handleRequest(new Request('http://local/api/v1/public/recruitment-notice'),undefined,{queryable:h.getPool()});
  assert.equal((await(await publicRequest()).json() as any).data,null);
  await withTransaction(h.getPool(),db=>saveRecruitment(db,actor,{title:'Gen mới',description:'Đang nhận đơn',formUrl:'https://forms.gle/example',status:'OPEN'}));
  assert.equal((await(await publicRequest()).json() as any).data.status,'OPEN');
  const secret='publishing_integration_secret_32_characters';const token=await signSessionToken(actor,secret);
  const response=await handleRequest(new Request('http://local/api/v1/admin/publishing/recruitment',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({title:'Gen mới',description:'Hẹn đợt sau',status:'CLOSED'})}),{JWT_SECRET:secret,NODE_ENV:'test'},{queryable:h.getPool(),membersDb:{[actor.memberId]:{id:actor.memberId,username:'admin',is_active:true,is_alumni:false,is_admin:true,token_version:actor.tokenVersion}} as any});
  assert.equal(response.status,200);assert.equal((await(await publicRequest()).json() as any).data.status,'CLOSED');
});

test('PG: CTV đủ tháng và đánh giá đạt mới thành thành viên; thành viên rời CLB phải thành cựu',async()=>{
  const pool=h.getPool();
  const ctv=(await pool.query("INSERT INTO members (full_name,username,gen,team,role_title,school_year,phone,is_collaborator,probation_started_on,probation_ends_on) VALUES ('CTV kiểm thử','ctv-trial','TEST','HAU_CAN','Cộng tác viên','TEST','0900000099',true,CURRENT_DATE,(CURRENT_DATE+INTERVAL '1 month')::date) RETURNING *")).rows[0];
  await assert.rejects(()=>withTransaction(pool,db=>changeMembership(db,actor,ctv.id,{action:'PROMOTE',passed:true,evaluation:'Đạt thử thách'})),/đủ một tháng/);
  await pool.query("UPDATE members SET probation_started_on=CURRENT_DATE-INTERVAL '2 months',probation_ends_on=(CURRENT_DATE-INTERVAL '2 months'+INTERVAL '1 month')::date WHERE id=$1",[ctv.id]);
  const secret='lifecycle_integration_secret_32_characters';
  const oldActor:any={...actor,memberId:ctv.id,userId:ctv.id,role:'MEMBER',tokenVersion:ctv.token_version};
  const token=await signSessionToken(oldActor,secret);
  const official=await withTransaction(pool,db=>changeMembership(db,actor,ctv.id,{action:'PROMOTE',passed:true,evaluation:'Chủ động tham gia, hoàn thành tốt thử thách.'}));
  assert.equal(official.isCollaborator,false);
  const env={JWT_SECRET:secret,DATABASE_URL:process.env.TEST_DATABASE_URL,NODE_ENV:'test'};
  try {const response=await handleRequest(new Request('http://local/api/v1/auth/me',{headers:{Authorization:'Bearer '+token}}),env);assert.equal(response.status,401);}
  finally{await closeDatabasePool(env);}
  await assert.rejects(()=>withTransaction(pool,db=>changeMembership(db,actor,ctv.id,{action:'DELETE_COLLABORATOR',confirmUsername:ctv.username})),/cựu thành viên/);
  const alumni=await withTransaction(pool,db=>changeMembership(db,actor,ctv.id,{action:'RETIRE'}));assert.equal(alumni.isAlumni,true);assert.equal(alumni.isAdmin,false);
});

test('PG: chỉ quản lý xóa CTV, thu hồi phiên và giữ hồ sơ/audit; không khôi phục qua PATCH trạng thái',async()=>{
  const pool=h.getPool();const ctv=(await pool.query("INSERT INTO members (full_name,username,gen,team,role_title,school_year,phone,is_collaborator,probation_started_on,probation_ends_on) VALUES ('CTV xóa thử','ctv-delete','TEST','HAU_CAN','Cộng tác viên','TEST','0900000099',true,CURRENT_DATE,(CURRENT_DATE+INTERVAL '1 month')::date) RETURNING *")).rows[0];
  await assert.rejects(()=>withTransaction(pool,db=>changeMembership(db,actor,ctv.id,{action:'DELETE_COLLABORATOR',confirmUsername:'sai'})),/đúng tên/);
  const result=await withTransaction(pool,db=>changeMembership(db,actor,ctv.id,{action:'DELETE_COLLABORATOR',confirmUsername:ctv.username}));assert.equal(result.isActive,false);assert(result.collaboratorDeletedAt);
  const preserved=(await pool.query('SELECT token_version FROM members WHERE id=$1',[ctv.id])).rows[0];assert(preserved.token_version>ctv.token_version);
  const secret='delete_ctv_test_secret_32_characters';const token=await signSessionToken(actor,secret);
  const env={JWT_SECRET:secret,DATABASE_URL:process.env.TEST_DATABASE_URL,NODE_ENV:'test'};
  try{const response=await handleRequest(new Request('http://local/api/v1/members/'+ctv.id+'/status',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"isActive":true}'}),env);assert.equal(response.status,400);}
  finally{await closeDatabasePool(env);}
});

test('PG: ứng viên trúng tuyển được tiếp nhận thành CTV một tháng, gọi lại không tạo hồ sơ trùng',async()=>{
  const db=h.getPool();
  await db.query("INSERT INTO recruitment_forms (id,title,term_semester) VALUES ('FORM_QA_CTV','Tuyển Gen 13','2026.1')");
  await db.query("INSERT INTO recruitment_form_responses (id,form_id,response_id,submission_timestamp,applicant_name,applicant_student_id,applicant_email,applicant_phone,aspiration_1,raw_answers) VALUES ('RESP_QA_CTV','FORM_QA_CTV','QA1',NOW(),'Ứng viên QA','20260099','qa@example.invalid','0900000088','BAN_HAU_CAN','{}')");
  await db.query("INSERT INTO recruitment_decisions (id,response_id,decision,assigned_department,decided_by) VALUES ('DEC_QA_CTV','RESP_QA_CTV','PASSED','BAN_HAU_CAN',$1)",[actor.memberId]);
  const result=await withTransaction(db,tx=>convertPassedApplicantToMember(tx,'RESP_QA_CTV',actor.memberId,{schoolYear:'K71',gen:'Gen 13'}));
  assert.equal(result.member.isCollaborator,true);assert.equal(result.member.roleTitle,'Cộng tác viên');
  const row=(await db.query("SELECT probation_ends_on=(probation_started_on+INTERVAL '1 month')::date AS valid FROM members WHERE id=$1",[result.member.id])).rows[0];assert(row.valid);
  const repeat=await withTransaction(db,tx=>convertPassedApplicantToMember(tx,'RESP_QA_CTV',actor.memberId));assert.equal(repeat.member.id,result.member.id);assert(repeat.isAlreadyConverted);
});
