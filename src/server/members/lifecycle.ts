import type {Queryable} from '../finance/types.ts';
import type {AuthenticatedActor} from '../types.ts';
import {requireAdmin,toMemberDto} from '../auth/policy.ts';
import {BadRequestError,NotFoundError} from '../errors.ts';
import {recordAuditLog} from '../shared/audit.ts';

export async function changeMembership(db:Queryable,actor:AuthenticatedActor,id:string,input:any) {
  requireAdmin(actor);
  const action = input.action;
  if (!['PROMOTE','DELETE_COLLABORATOR','RETIRE','DEACTIVATE','SET_ROLE'].includes(action)) throw new BadRequestError('Thao tác nhân sự không hợp lệ.','INVALID_MEMBERSHIP_ACTION');
  if (id === actor.memberId || id === actor.userId) throw new BadRequestError('Không tự thay đổi tài khoản của chính mình tại đây.','SELF_MEMBERSHIP_CHANGE');
  const result=await db.query<any>("SELECT *, (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= probation_ends_on AS probation_complete FROM members WHERE id=$1 FOR UPDATE",[id]);
  if (!result.rows.length) throw new NotFoundError('Không tìm thấy tài khoản.','MEMBER_NOT_FOUND');
  const member=result.rows[0];
  if (member.collaborator_deleted_at) throw new BadRequestError('Tài khoản cộng tác viên đã được xóa.','COLLABORATOR_DELETED');
  let updated;
  if (action==='PROMOTE') {
    const evaluation=typeof input.evaluation==='string'?input.evaluation.trim():'';
    if (!member.is_collaborator || !member.is_active || !member.probation_complete) throw new BadRequestError('Cộng tác viên phải hoạt động đủ một tháng thử thách mới được xét thành viên.','PROBATION_NOT_COMPLETE');
    if (input.passed!==true || evaluation.length<5 || evaluation.length>2000) throw new BadRequestError('Cần xác nhận đánh giá đạt và ghi nhận xét từ 5 đến 2.000 ký tự.','EVALUATION_REQUIRED');
    updated=await db.query("UPDATE members SET is_collaborator=FALSE, role_title='Thành viên',probation_evaluation=$2,token_version=token_version+1 WHERE id=$1 RETURNING *",[id,evaluation]);
  } else if (action==='DELETE_COLLABORATOR') {
    if (!member.is_collaborator) throw new BadRequestError('Thành viên chính thức không được xóa tài khoản ở đây; hãy khóa truy cập để giữ lịch sử.','MEMBER_MUST_RETIRE');
    if (input.confirmUsername!==member.username) throw new BadRequestError('Nhập đúng tên đăng nhập để xác nhận xóa tài khoản.','DELETE_CONFIRMATION_REQUIRED');
    // Giữ khóa ngoại giao dịch; thu hồi toàn bộ phiên và quyền đăng nhập bằng trạng thái DB.
    updated=await db.query('UPDATE members SET is_active=FALSE,collaborator_deleted_at=NOW(),token_version=token_version+1 WHERE id=$1 RETURNING *',[id]);
  } else if(action==='SET_ROLE') {
    if(!['ADMIN','MANAGER','MEMBER','COLLABORATOR'].includes(input.role)||member.is_alumni||!member.is_active) throw new BadRequestError('Chỉ đổi vai trò cho tài khoản đang hoạt động.','INVALID_INTERNAL_ROLE');
    if(input.confirmUsername!==member.username) throw new BadRequestError('Nhập đúng tên đăng nhập để xác nhận đổi quyền.','ROLE_CONFIRMATION_REQUIRED');
    if(member.is_collaborator&&input.role!=='COLLABORATOR') throw new BadRequestError('Cần công nhận cộng tác viên qua bước đánh giá trước khi đổi quyền.','COLLABORATOR_STAGE_REQUIRED');
    updated=await db.query(`UPDATE members SET is_admin=$2,is_manager=$3,is_collaborator=$4,
      probation_started_on=CASE WHEN $4 THEN COALESCE(probation_started_on,CURRENT_DATE) ELSE probation_started_on END,
      probation_ends_on=CASE WHEN $4 THEN COALESCE(probation_ends_on,(CURRENT_DATE+INTERVAL '1 month')::date) ELSE probation_ends_on END,
      token_version=token_version+1 WHERE id=$1 RETURNING *`,[id,input.role==='ADMIN',input.role==='MANAGER',input.role==='COLLABORATOR']);
  } else {
    updated=await db.query('UPDATE members SET is_active=FALSE,is_admin=FALSE,is_manager=FALSE,token_version=token_version+1 WHERE id=$1 RETURNING *',[id]);
  }
  await recordAuditLog(db,{actorId:actor.memberId||actor.userId,action:'MEMBERSHIP_'+action,targetResource:'MEMBER',targetId:id,details:{previousStage:member.is_collaborator?'COLLABORATOR':'MEMBER'}});
  return toMemberDto(updated.rows[0]);
}
