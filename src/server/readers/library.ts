import type {Queryable} from '../finance/types.ts';
import {BadRequestError,NotFoundError} from '../errors.ts';

export async function listBookmarks(db:Queryable,readerId:string){
  const result=await db.query<any>('SELECT title_id,created_at FROM reader_bookmarks WHERE reader_account_id=$1 ORDER BY created_at DESC,title_id',[readerId]);
  return result.rows.map(row=>({titleId:row.title_id,createdAt:row.created_at}));
}

export async function setBookmark(db:Queryable,readerId:string,titleId:string,bookmarked:boolean){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(titleId)) throw new BadRequestError('Mã sách không hợp lệ.','INVALID_TITLE_ID');
  if(bookmarked){
    const result=await db.query(`INSERT INTO reader_bookmarks(reader_account_id,title_id)
      SELECT $1,id FROM book_titles WHERE id=$2
      ON CONFLICT(reader_account_id,title_id) DO UPDATE SET title_id=EXCLUDED.title_id RETURNING title_id`,[readerId,titleId]);
    if(!result.rows.length) throw new NotFoundError('Không tìm thấy sách.','BOOK_NOT_FOUND');
  }else await db.query('DELETE FROM reader_bookmarks WHERE reader_account_id=$1 AND title_id=$2',[readerId,titleId]);
  return {titleId,bookmarked};
}
