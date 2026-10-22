import {createHash} from 'node:crypto';
import type {Queryable} from '../finance/types.ts';
import type {AuthenticatedActor} from '../types.ts';
import {requireInternalMember,requireContentManager} from '../auth/policy.ts';
import {BadRequestError,ConflictError,NotFoundError} from '../errors.ts';
import {recordAuditLog} from '../shared/audit.ts';
import {text,decodePublicImage,saveBook} from '../publishing/service.ts';
import {createBookCopy,updateBookCopy} from './service.ts';
import {parseCatalogWorkbook,normalizedCatalogText,type DraftCopy} from './import.ts';

export interface CatalogDraft {id?:string;editionId?:string;title:string;authors:string;categories:string;publisher:string;description:string;image?:string;copies:DraftCopy[];}
const memberId=(actor:AuthenticatedActor)=>requireInternalMember(actor).memberId||actor.userId;
export function validateCatalogDraft(input:any):CatalogDraft {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestError('Nội dung sách không hợp lệ.','INVALID_DRAFT');
  const result:CatalogDraft={title:text(input.title,255,true),authors:text(input.authors,1000),categories:text(input.categories,500),publisher:text(input.publisher,255),description:text(input.description,6000),copies:[]};
  if(input.id)result.id=text(input.id,50);if(input.editionId)result.editionId=text(input.editionId,50);
  if(input.image){decodePublicImage(input.image);result.image=input.image;}
  if(!Array.isArray(input.copies)||input.copies.length>100)throw new BadRequestError('Mỗi đầu sách tối đa 100 bản trong một lần sửa.','INVALID_DRAFT_COPIES');
  const seen=new Set<string>();
  for(const copy of input.copies){
    const barcode=text(copy?.barcode,50,true);
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(barcode)||seen.has(barcode))throw new BadRequestError('Mã sách trống, sai định dạng hoặc bị trùng.','INVALID_BARCODES');seen.add(barcode);
    const price=copy.coverPrice===''||copy.coverPrice==null?null:copy.coverPrice;
    if(price!==null&&(typeof price!=='number'||!Number.isSafeInteger(price)||price<0||price>100000000))throw new BadRequestError('Giá bìa không hợp lệ.','INVALID_PRICE');
    if(!['AVAILABLE','MAINTENANCE'].includes(copy.status))throw new BadRequestError('Chỉ chọn Sẵn sàng hoặc Chờ đối chiếu kho.','INVALID_DRAFT_STATUS');
    result.copies.push({barcode,coverPrice:price,status:copy.status,note:text(copy.note,1000)});
  }
  return result;
}
export async function previewCatalogImport(db:Queryable,actor:AuthenticatedActor,buffer:Buffer){
  memberId(actor);
  const preview=parseCatalogWorkbook(buffer),codes=preview.rows.map(row=>row.copy.barcode);
  const existing=await db.query<{barcode:string}>(`SELECT barcode FROM book_copies WHERE barcode=ANY($1::text[])
    UNION SELECT copy->>'barcode' AS barcode FROM catalog_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'copies') copy WHERE s.status<>'PUBLISHED' AND copy->>'barcode'=ANY($1::text[])`,[codes]);
  const duplicate=new Set(existing.rows.map(row=>row.barcode));
  for(const row of preview.rows)if(duplicate.has(row.copy.barcode))row.errors.push('Mã sách đã có trong kho hoặc bản nháp.');
  return {...preview,fileHash:createHash('sha256').update(buffer).digest('hex')};
}
export async function importCatalog(db:Queryable,actor:AuthenticatedActor,buffer:Buffer,fileName:string){
  const id=memberId(actor),hash=createHash('sha256').update(buffer).digest('hex');
  const batch=await db.query<{id:string}>('INSERT INTO catalog_import_batches(file_hash,file_name,imported_by,row_count) VALUES($1,$2,$3,0) ON CONFLICT(file_hash) DO NOTHING RETURNING id',[hash,text(fileName,255,true),id]);
  if(!batch.rows.length)throw new ConflictError('File này đã được nhập. Mở các bản nháp đã có để chỉnh sửa.','IMPORT_ALREADY_EXISTS');
  const preview=await previewCatalogImport(db,actor,buffer),valid=preview.rows.filter(row=>!row.errors.length);
  if(!valid.length)throw new BadRequestError('Không có dòng hợp lệ để nhập.','IMPORT_NO_VALID_ROWS');
  const groups=new Map<string,typeof valid>();
  for(const row of valid){const key=normalizedCatalogText(row.title)+'|'+normalizedCatalogText(row.authors);const group=groups.get(key)||[];group.push(row);groups.set(key,group);}
  for(const rows of groups.values()){
    const first=rows[0],payload=validateCatalogDraft({...first,copies:rows.map(row=>row.copy)});
    await db.query('INSERT INTO catalog_submissions(batch_id,payload,warnings,created_by,updated_by) VALUES($1,$2,$3,$4,$4)',[batch.rows[0].id,JSON.stringify(payload),JSON.stringify([...new Set(rows.flatMap(row=>row.warnings))]),id]);
  }
  await db.query('UPDATE catalog_import_batches SET row_count=$2 WHERE id=$1',[batch.rows[0].id,valid.length]);
  await recordAuditLog(db,{actorId:id,action:'IMPORT_CATALOG_DRAFTS',targetResource:'CATALOG_BATCH',targetId:batch.rows[0].id,details:{imported:valid.length,skipped:preview.rows.length-valid.length}});
  return {batchId:batch.rows[0].id,imported:valid.length,drafts:groups.size,skipped:preview.rows.length-valid.length};
}
export async function createCatalogSubmission(db:Queryable,actor:AuthenticatedActor,input:any){
  const id=memberId(actor);let payload:CatalogDraft,baseVersion:number|null=null;
  if(input?.titleId){
    const title=(await db.query<any>('SELECT * FROM book_titles WHERE id=$1 FOR SHARE',[input.titleId])).rows[0];if(!title)throw new NotFoundError('Không tìm thấy sách.','BOOK_NOT_FOUND');
    const edition=(await db.query<any>('SELECT id,publisher FROM book_editions WHERE title_id=$1 ORDER BY id LIMIT 1',[title.id])).rows[0];
    const names=await db.query<any>(`SELECT 'author' AS kind,a.name FROM authors a JOIN book_title_authors j ON j.author_id=a.id WHERE j.title_id=$1 UNION ALL SELECT 'category',c.name FROM categories c JOIN book_title_categories j ON j.category_id=c.id WHERE j.title_id=$1`,[title.id]);
    const copies=edition?(await db.query<any>('SELECT barcode,cover_price,status,condition_note FROM book_copies WHERE edition_id=$1 ORDER BY barcode',[edition.id])).rows:[];
    payload=validateCatalogDraft({id:title.id,editionId:edition?.id,title:title.title,description:title.description||'',publisher:edition?.publisher||'',authors:names.rows.filter(row=>row.kind==='author').map(row=>row.name).join(', '),categories:names.rows.filter(row=>row.kind==='category').map(row=>row.name).join(', '),copies:copies.map(copy=>({barcode:copy.barcode,coverPrice:copy.cover_price===null?null:Number(copy.cover_price),status:copy.status==='AVAILABLE'?'AVAILABLE':'MAINTENANCE',note:copy.condition_note||''}))});baseVersion=title.content_version;
  }else payload=validateCatalogDraft(input);
  return (await db.query('INSERT INTO catalog_submissions(title_id,base_version,payload,created_by,updated_by) VALUES($1,$2,$3,$4,$4) RETURNING *',[payload.id||null,baseVersion,JSON.stringify(payload),id])).rows[0];
}
export async function updateCatalogSubmission(db:Queryable,actor:AuthenticatedActor,id:string,input:any){
  const user=memberId(actor),draft=(await db.query<any>('SELECT * FROM catalog_submissions WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!draft)throw new NotFoundError('Không tìm thấy bản nháp.','DRAFT_NOT_FOUND');
  if(draft.version!==input.version)throw new ConflictError('Nội dung đã thay đổi. Tải lại trước khi lưu.','DRAFT_VERSION_CONFLICT');
  const manager=['ADMIN','MANAGER'].includes(actor.role),action=input.action||'SAVE';
  if(action==='WITHDRAW'){
    if(!manager&&draft.created_by!==user)throw new BadRequestError('Bạn chỉ được rút bản nháp của mình.','DRAFT_OWNER_REQUIRED');
    if(draft.status!=='PENDING')throw new ConflictError('Nội dung không đang chờ duyệt.','DRAFT_NOT_PENDING');
    return (await db.query("UPDATE catalog_submissions SET status='DRAFT',version=version+1,updated_at=NOW(),updated_by=$2 WHERE id=$1 RETURNING *",[id,user])).rows[0];
  }
  if(action==='APPROVE'||action==='REJECT'){
    requireContentManager(actor);if(draft.status!=='PENDING')throw new ConflictError('Chỉ duyệt nội dung đang chờ.','DRAFT_NOT_PENDING');
    if(action==='REJECT')return (await db.query("UPDATE catalog_submissions SET status='REJECTED',moderation_note=$2,moderated_by=$3,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *",[id,text(input.note,2000,true),user])).rows[0];
    const payload=validateCatalogDraft(draft.payload);
    if(draft.title_id){const title=(await db.query<any>('SELECT content_version FROM book_titles WHERE id=$1 FOR UPDATE',[draft.title_id])).rows[0];if(title?.content_version!==draft.base_version)throw new ConflictError('Sách đã được cập nhật từ bản nháp khác. Hãy tạo bản sửa mới.','CATALOG_VERSION_CONFLICT');}
    const saved=await saveBook(db,actor,{...payload,publisher:payload.publisher||'Chưa cập nhật',coverPrice:'',barcodes:''});
    for(const copy of payload.copies){
      // Lock barcode even when absent, to serialize two moderators publishing duplicate imports.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[copy.barcode]);
      const existing=(await db.query<any>('SELECT bc.*,be.title_id FROM book_copies bc JOIN book_editions be ON be.id=bc.edition_id WHERE barcode=$1 FOR UPDATE OF bc',[copy.barcode])).rows[0];
      if(existing){
        if(existing.title_id!==saved.id)throw new ConflictError('Mã '+copy.barcode+' đã thuộc đầu sách khác.','DUPLICATE_BARCODE');
        const statusChanged=['AVAILABLE','MAINTENANCE'].includes(existing.status)&&existing.status!==copy.status;
        if(statusChanged){const held=await db.query("SELECT id FROM reservations WHERE copy_id=$1 AND status='HELD' AND expires_at>NOW()",[existing.id]);if(held.rows.length)throw new ConflictError('Bản sách đang được giữ chỗ; không thể đổi tình trạng.','COPY_RESERVED');}
        const priceChanged=(existing.cover_price===null?null:Number(existing.cover_price))!==copy.coverPrice;
        const noteChanged=(existing.condition_note||'')!==(copy.note||'');
        if(priceChanged||noteChanged)await updateBookCopy(db,existing.id,{...(priceChanged?{coverPrice:copy.coverPrice}:{}),...(noteChanged?{conditionNote:copy.note||''}:{})},user);
        if(statusChanged)await db.query('UPDATE book_copies SET status=$2 WHERE id=$1',[existing.id,copy.status]);
      }else {
        const created=await createBookCopy(db,{editionId:saved.editionId,barcode:copy.barcode,coverPrice:copy.coverPrice,conditionNote:copy.note,location:'KHO_THU_VIEN'},user);
        if(copy.status!=='AVAILABLE')await db.query('UPDATE book_copies SET status=$2 WHERE id=$1',[created.id,copy.status]);
      }
    }
    await recordAuditLog(db,{actorId:user,action:'PUBLISH_CATALOG_SUBMISSION',targetResource:'CATALOG_SUBMISSION',targetId:id,details:{titleId:saved.id}});
    return (await db.query("UPDATE catalog_submissions SET title_id=$2,status='PUBLISHED',moderated_by=$3,moderation_note=NULL,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *",[id,saved.id,user])).rows[0];
  }
  if(!['DRAFT','REJECTED'].includes(draft.status))throw new ConflictError('Rút bản chờ duyệt về nháp trước khi sửa. Sách đã công khai cần tạo bản sửa mới.','DRAFT_NOT_EDITABLE');
  if(!['SAVE','SUBMIT'].includes(action))throw new BadRequestError('Thao tác không hợp lệ.','INVALID_DRAFT_ACTION');
  const payload=validateCatalogDraft(input.payload??draft.payload);
  // Identity comes from the locked row; callers cannot redirect an edit to another book/edition.
  payload.id=draft.payload.id;payload.editionId=draft.payload.editionId;
  if(action==='SUBMIT'&&!payload.copies.length)throw new BadRequestError('Thêm ít nhất một bản sách trước khi gửi duyệt.','DRAFT_COPY_REQUIRED');
  await recordAuditLog(db,{actorId:user,action:'CATALOG_'+action,targetResource:'CATALOG_SUBMISSION',targetId:id,details:{version:draft.version}});
  return (await db.query('UPDATE catalog_submissions SET payload=$2,status=$3,updated_by=$4,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *',[id,JSON.stringify(payload),action==='SUBMIT'?'PENDING':'DRAFT',user])).rows[0];
}
