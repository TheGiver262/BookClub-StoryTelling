import { Buffer } from 'node:buffer';
import type { Queryable } from '../finance/types.ts';
import type { AuthenticatedActor } from '../types.ts';
import { requireAdmin } from '../auth/policy.ts';
import { BadRequestError, NotFoundError } from '../errors.ts';
import { createBookTitle, createBookEdition, createBookCopy } from '../catalog/service.ts';
import { recordAuditLog } from '../shared/audit.ts';

export function text(value: unknown, max: number, required = false): string {
  if (value != null && typeof value !== 'string') throw new BadRequestError('Thông tin phải là văn bản.', 'INVALID_TEXT');
  const result = (value as string || '').trim();
  if (result.length > max || required && !result) throw new BadRequestError('Vui lòng điền đủ thông tin, đúng độ dài cho phép.', 'INVALID_TEXT');
  return result;
}

export function date(value: unknown): string {
  const result = text(value, 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result + 'T00:00:00Z')) || new Date(result + 'T00:00:00Z').toISOString().slice(0,10) !== result)
    throw new BadRequestError('Ngày không hợp lệ.', 'INVALID_DATE');
  return result;
}

export function decodePublicImage(value: unknown) {
  if (typeof value !== 'string' || value.length > 246000) throw new BadRequestError('Ảnh quá lớn. Chọn ảnh khác để thử lại.', 'IMAGE_TOO_LARGE');
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new BadRequestError('Chỉ nhận ảnh PNG, JPEG hoặc WebP.', 'INVALID_IMAGE');
  const bytes = Buffer.from(match[2], 'base64');
  const signatures: Record<string, boolean> = {
    'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    'image/png': bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    'image/webp': bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP',
  };
  if (bytes.length < 12 || bytes.length > 184320 || !signatures[match[1]]) throw new BadRequestError('Nội dung ảnh không hợp lệ.', 'INVALID_IMAGE');
  return { mime: match[1], bytes };
}

export async function saveImage(db: Queryable, image: unknown) {
  if (!image) return null;
  const { mime, bytes } = decodePublicImage(image);
  // shortcut: ảnh nén lưu cùng PostgreSQL cho local/beta; chuyển object storage khi media đạt 100 MB.
  const result = await db.query<{id:string}>('INSERT INTO public_media (mime_type, content) VALUES ($1,$2) RETURNING id',[mime,bytes]);
  return '/api/v1/public/media/' + result.rows[0].id;
}

export async function saveBook(db: Queryable, actor: AuthenticatedActor, input: any) {
  requireAdmin(actor);
  const actorId = actor.memberId || actor.userId;
  const title = text(input.title,255,true), description = text(input.description,6000);
  const authors = text(input.authors,1000).split(',').map(v=>v.trim()).filter(Boolean);
  const categories = text(input.categories,500).split(',').map(v=>v.trim()).filter(Boolean);
  const publisher = text(input.publisher,255,true);
  const price = input.coverPrice === '' || input.coverPrice == null ? null : Number(input.coverPrice);
  if (price !== null && (!Number.isSafeInteger(price) || price < 0 || price > 100000000)) throw new BadRequestError('Giá bìa không hợp lệ.', 'INVALID_PRICE');
  const barcodes = text(input.barcodes,4000).split(/[\n,]+/).map(v=>v.trim()).filter(Boolean);
  if (barcodes.length > 100 || new Set(barcodes).size !== barcodes.length) throw new BadRequestError('Mã bản sách phải khác nhau, tối đa 100 bản mỗi lần.', 'INVALID_BARCODES');
  let id = text(input.id,50);
  if (id) {
    const found = await db.query('SELECT id FROM book_titles WHERE id=$1 FOR UPDATE',[id]);
    if (!found.rows.length) throw new NotFoundError('Không tìm thấy đầu sách.', 'BOOK_NOT_FOUND');
    await db.query('UPDATE book_titles SET title=$2, description=$3 WHERE id=$1',[id,title,description]);
    for (const [table,join,field,values] of [['authors','book_title_authors','author_id',authors],['categories','book_title_categories','category_id',categories]] as const) {
      await db.query(`DELETE FROM ${join} WHERE title_id=$1`,[id]);
      for (const name of values) {
        const row = await db.query<{id:string}>(`INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[name]);
        await db.query(`INSERT INTO ${join} (title_id,${field}) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[id,row.rows[0].id]);
      }
    }
  } else id = (await createBookTitle(db,{title,description,authors,categories},actorId)).id;
  const cover = await saveImage(db,input.image);
  let editionId = text(input.editionId,50);
  if (editionId) {
    const updated = await db.query('UPDATE book_editions SET publisher=$3, cover_image_url=COALESCE($4,cover_image_url) WHERE id=$1 AND title_id=$2 RETURNING id',[editionId,id,publisher,cover]);
    if (!updated.rows.length) throw new BadRequestError('Ấn bản không thuộc đầu sách này.', 'INVALID_EDITION');
  } else editionId = (await createBookEdition(db,{titleId:id,publisher,coverImageUrl:cover},actorId)).id;
  for (const barcode of barcodes) await createBookCopy(db,{editionId,barcode,coverPrice:price,location:'KHO_THU_VIEN'},actorId);
  await recordAuditLog(db,{actorId,action:'SAVE_PUBLIC_BOOK',targetResource:'BOOK_TITLE',targetId:id,details:{copiesAdded:barcodes.length}});
  return {id,editionId,copiesAdded:barcodes.length};
}

export async function savePickup(db: Queryable, actor: AuthenticatedActor, input: any) {
  requireAdmin(actor);
  const day = date(input.date), location = text(input.location,200,true);
  const start = text(input.start,5,true), end = text(input.end,5,true);
  if (![start,end].every(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || start >= end) throw new BadRequestError('Giờ kết thúc phải sau giờ bắt đầu.', 'INVALID_TIME');
  const weekday = new Date(day+'T12:00:00Z').getUTCDay();
  if (weekday !== 2 && weekday !== 4) throw new BadRequestError('Buổi trực sách phải là thứ Ba hoặc thứ Năm.', 'INVALID_DUTY_DAY');
  const status = input.status;
  if (!['DRAFT','PUBLISHED','CANCELLED'].includes(status)) throw new BadRequestError('Trạng thái ca không hợp lệ.', 'INVALID_STATUS');
  const time = `${start} - ${end}`;
  let id = text(input.id,50);
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['public-pickup:'+day]);
  if (status === 'PUBLISHED' && (await db.query('SELECT 1 FROM calendar_holidays WHERE holiday_date=$1',[day])).rows.length)
    throw new BadRequestError('Ngày này đã được đánh dấu nghỉ. Hãy chọn ngày khác.', 'DUTY_ON_HOLIDAY');
  if (id) {
    const found = await db.query<any>('SELECT * FROM duty_schedules WHERE id=$1 FOR UPDATE',[id]);
    if (!found.rows.length) throw new NotFoundError('Không tìm thấy buổi trực.', 'SCHEDULE_NOT_FOUND');
    const old = found.rows[0];
    if (status !== 'CANCELLED' && (await db.query("SELECT id FROM duty_schedules WHERE schedule_date=$1 AND id<>$2 AND status<>'CANCELLED'",[day,id])).rows.length)
      throw new BadRequestError('Ngày này đã có buổi trực khác.', 'DUPLICATE_SCHEDULE');
    if (old.schedule_date !== day || old.shift_time !== time || old.location !== location || status !== 'PUBLISHED') {
      const held = await db.query<{count:string}>("SELECT COUNT(*) AS count FROM reservations WHERE schedule_id=$1 AND status='HELD'",[id]);
      if (Number(held.rows[0].count)) throw new BadRequestError('Buổi trực đang có bạn đọc giữ sách. Hãy liên hệ và xử lý các đơn trước khi đổi lịch hoặc nghỉ.', 'SCHEDULE_HAS_RESERVATIONS');
    }
    await db.query('UPDATE duty_schedules SET schedule_date=$2, day_of_week=$3, shift_time=$4, location=$5, status=$6::varchar, version=version+1, published_version=CASE WHEN $6::varchar=\'PUBLISHED\' THEN version+1 ELSE NULL END, updated_at=NOW() WHERE id=$1',[id,day,weekday===2?'THU_BA':'THU_NAM',time,location,status]);
  } else {
    const exists = await db.query("SELECT id FROM duty_schedules WHERE schedule_date=$1 AND status <> 'CANCELLED'",[day]);
    if (exists.rows.length) throw new BadRequestError('Ngày này đã có buổi trực. Hãy sửa buổi hiện có.', 'DUPLICATE_SCHEDULE');
    id = crypto.randomUUID();
    await db.query('INSERT INTO duty_schedules (id,term_semester,schedule_date,day_of_week,shift_time,location,status,published_version,published_by,published_at) VALUES ($1,$2,$3,$4,$5,$6,$7::varchar,CASE WHEN $7::varchar=\'PUBLISHED\' THEN 1 ELSE NULL END,$8,NOW())',[id,day.slice(0,4),day,weekday===2?'THU_BA':'THU_NAM',time,location,status,actor.memberId||actor.userId]);
  }
  await recordAuditLog(db,{actorId:actor.memberId||actor.userId,action:'SAVE_PUBLIC_PICKUP',targetResource:'DUTY_SCHEDULE',targetId:id,details:{status}});
  return {id};
}

export async function closePickupDay(db: Queryable, day: string) {
  const validDay = date(day);
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['public-pickup:'+validDay]);
  const schedules = await db.query<{id:string}>('SELECT id FROM duty_schedules WHERE schedule_date=$1 ORDER BY id FOR UPDATE',[validDay]);
  for (const {id} of schedules.rows) {
    const held = await db.query<{count:string}>("SELECT COUNT(*) AS count FROM reservations WHERE schedule_id=$1 AND status='HELD'",[id]);
    if (Number(held.rows[0].count)) throw new BadRequestError('Ngày này có đơn giữ sách. Hãy liên hệ bạn đọc và xử lý đơn trước khi nghỉ.', 'SCHEDULE_HAS_RESERVATIONS');
  }
  await db.query("UPDATE duty_schedules SET status='CANCELLED',version=version+1,updated_at=NOW() WHERE schedule_date=$1 AND status<>'CANCELLED'",[validDay]);
}

export async function saveRecruitment(db: Queryable, actor: AuthenticatedActor, input: any) {
  requireAdmin(actor);
  const title = text(input.title,255,true), description = text(input.description,6000), formUrl = text(input.formUrl,1000);
  if (formUrl && !/^https:\/\//.test(formUrl)) throw new BadRequestError('Liên kết đăng ký phải bắt đầu bằng https://.', 'INVALID_URL');
  const status = input.status;
  if (!['DRAFT','OPEN','CLOSED'].includes(status)) throw new BadRequestError('Trạng thái tuyển không hợp lệ.', 'INVALID_STATUS');
  const previous = (await db.query<any>("SELECT value FROM club_public_settings WHERE key='recruitment' FOR UPDATE")).rows[0]?.value;
  const image = await saveImage(db,input.image) || previous?.image || null;
  const value = {title,description,formUrl,status,image};
  await db.query("INSERT INTO club_public_settings (key,value) VALUES ('recruitment',$1) ON CONFLICT (key) DO UPDATE SET value=$1,updated_at=NOW()",[JSON.stringify(value)]);
  await recordAuditLog(db,{actorId:actor.memberId||actor.userId,action:'SAVE_RECRUITMENT_NOTICE',targetResource:'PUBLIC_CONTENT',targetId:'recruitment',details:{status}});
  return value;
}
