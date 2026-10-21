import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DbHarness} from './db-harness.ts';
import {handleRequest} from '../../src/server/router.ts';
import {submitBookReview,moderateBookReview,getPublicReviews} from '../../src/modules/content/service.ts';

const h=new DbHarness(),origin='http://localhost',env={NODE_ENV:'test'};
let readerId:string,bookId:string,session:string;
before(async()=>{
  await h.resetSchema();await h.applyDDL();await h.applySeed();await h.applyMigrations();
  session='ysbk_reader='+ 'b'.repeat(43);
  readerId=(await h.getPool().query("INSERT INTO reader_accounts(provider_subject,email,full_name,session_hash,session_expires_at) VALUES('library-reader','reader@example.test','Bạn đọc', $1,NOW()+INTERVAL '1 day') RETURNING id",[createHash('sha256').update('b'.repeat(43)).digest('hex')])).rows[0].id;
  bookId=(await h.getPool().query("INSERT INTO book_titles(title) VALUES ('ZZ sách ghim') RETURNING id")).rows[0].id;
});
after(async()=>{await h.close();});
const call=(path:string,method='GET',body?:unknown,cookie=session)=>handleRequest(new Request(origin+'/api/v1/'+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{queryable:h.getPool()});

test('bookmark yêu cầu phiên, idempotent, không nhận owner từ client và không lộ sang tài khoản khác',async()=>{
  assert.equal((await call('readers/bookmarks/'+bookId,'PUT',undefined,'')).status,401);
  for(let i=0;i<2;i++) assert.equal((await call('readers/bookmarks/'+bookId,'PUT')).status,200);
  const bookmarks=(await(await call('readers/bookmarks')).json() as any).data;
  assert.equal(bookmarks.length,1);assert.equal(bookmarks[0].titleId,bookId);
  assert.equal((await h.getPool().query('SELECT count(*) FROM reader_bookmarks WHERE reader_account_id=$1',[readerId])).rows[0].count,'1');
  const anonymous=(await(await call('public/reservation-books?includeUnavailable=true&limit=1','GET',undefined,'')).json() as any).data;
  assert.notEqual(anonymous[0].titleId,bookId);assert.equal(anonymous[0].isBookmarked,false);
  const otherToken='c'.repeat(43);
  await h.getPool().query("INSERT INTO reader_accounts(provider_subject,email,session_hash,session_expires_at) VALUES('other-reader','other@example.test',$1,NOW()+INTERVAL '1 day')",[createHash('sha256').update(otherToken).digest('hex')]);
  assert.deepEqual((await(await call('readers/bookmarks','GET',undefined,'ysbk_reader='+otherToken)).json() as any).data,[]);
  const csrf=await handleRequest(new Request(origin+'/api/v1/readers/bookmarks/'+bookId,{method:'DELETE',headers:{Cookie:session,Origin:'https://evil.example.test'}}),env,{queryable:h.getPool()});assert.equal(csrf.status,403);
});

test('ghim trước phân trang, tính lại tồn khả dụng và bỏ ghim không xóa sách',async()=>{
  const response=await call('public/reservation-books?includeUnavailable=true&limit=1&page=1');
  assert.equal(response.status,200);
  const json=await response.json() as any;assert.equal(json.data[0].titleId,bookId);assert.equal(json.data[0].isBookmarked,true);assert.equal(json.data[0].availableCopiesCount,0);
  const edition=(await h.getPool().query("INSERT INTO book_editions(title_id,publisher) VALUES($1,'Test') RETURNING id",[bookId])).rows[0].id;
  await h.getPool().query("INSERT INTO book_copies(edition_id,barcode,cover_price,location) VALUES($1,'LIBRARY_BOOKMARK',50000,'BAN_TRUC_TAM')",[edition]);
  const available=await(await call('public/reservation-books?includeUnavailable=true&limit=1')).json() as any;
  assert.equal(available.data[0].availableCopiesCount,1);
  assert.equal((await call('readers/bookmarks/'+bookId,'DELETE')).status,200);
  assert.deepEqual((await(await call('readers/bookmarks')).json() as any).data,[]);
  assert.equal((await h.getPool().query('SELECT id FROM book_titles WHERE id=$1',[bookId])).rowCount,1);
});

test('review bạn đọc buộc PENDING và tên từ hồ sơ; chỉ chữ; public ghim CLB và không lộ pending/PII',async()=>{
  const body={bookId,authorName:'CLB giả mạo',authorEmail:'spoof@example.test',rating:4,content:'Một cuốn sách có nhiều điều đáng suy ngẫm.'};
  assert.equal((await call('content/reviews','POST',body,'')).status,401);
  const created=await call('content/reviews','POST',body);assert.equal(created.status,201,await created.clone().text());
  const row=(await h.getPool().query('SELECT * FROM book_reviews WHERE book_id=$1',[bookId])).rows[0];
  assert.equal(row.author_name,'Bạn đọc');assert.equal(row.status,'PENDING');assert.equal(row.is_club_review,false);
  assert.equal((await call('content/reviews','POST',{...body,images:['https://example.test/a.png']})).status,400);
  const publicList=()=>call('public/reviews?bookId='+bookId);
  assert.deepEqual((await(await publicList()).json() as any).data,[]);
  await h.getPool().query("UPDATE book_reviews SET status='APPROVED' WHERE id=$1",[row.id]);
  await h.getPool().query("INSERT INTO book_reviews(book_id,author_name,rating,content,status,is_club_review,created_at) VALUES($1,'Ban nội dung',5,'Bài review của câu lạc bộ.','APPROVED',TRUE,NOW()-INTERVAL '1 year')",[bookId]);
  const list=(await(await publicList()).json() as any).data;assert.equal(list.length,2);assert.equal(list[0].isClubReview,true);assert.equal(list[1].isClubReview,false);
  assert.equal(list[0].authorEmail,undefined);assert.equal(list[1].authorId,undefined);
  assert.equal((await call('content/reviews','POST',{...body,isClubReview:true})).status,400);
  assert.equal((await call('content/reviews','POST',{...body,content:'Ảnh bìa ![bìa](https://example.test/a.png)'})).status,400);
  await h.getPool().query("INSERT INTO book_reviews(book_id,author_name,rating,content,status) SELECT $1,'Bạn đọc '||i,4,'Nhận xét đã duyệt số '||i,'APPROVED' FROM generate_series(1,51) i",[bookId]);
  const first=(await(await call('public/reviews?bookId='+bookId+'&page=1')).json() as any).data;
  const second=(await(await call('public/reviews?bookId='+bookId+'&page=2')).json() as any).data;
  assert.equal(first.length,50);assert.equal(second.length,3);assert.equal(new Set([...first,...second].map(row=>row.id)).size,53);
  assert.equal(first[0].isClubReview,true);assert.equal((await call('public/reviews?page=0')).status,400);
});

test('review CLB do actor server quyết định; MEMBER không duyệt, ADMIN duyệt rồi mới ghim công khai',async()=>{
  const db=h.getPool(),member=(await db.query('SELECT id,token_version FROM members WHERE is_admin=TRUE LIMIT 1')).rows[0];
  const admin={memberId:member.id,userId:member.id,role:'ADMIN' as const,isAlumni:false,isActive:true,tokenVersion:member.token_version};
  const review=await submitBookReview(db,admin,{bookId,authorName:'Ban nội dung CLB',rating:5,content:'Bài viết của câu lạc bộ, vẫn cần duyệt trước khi công bố.'});
  assert.equal(review.status,'PENDING');assert.equal((await db.query('SELECT is_club_review FROM book_reviews WHERE id=$1',[review.id])).rows[0].is_club_review,true);
  await assert.rejects(()=>moderateBookReview(db,{...admin,role:'MEMBER'},review.id,{decision:'APPROVED'}),(error:any)=>error.errorCode==='ADMIN_REQUIRED');
  assert(!(await getPublicReviews(db,bookId)).some(row=>row.id===review.id));
  await moderateBookReview(db,admin,review.id,{decision:'APPROVED'});
  const visible=await getPublicReviews(db,bookId);assert.equal(visible[0].id,review.id);assert.equal(visible[0].isClubReview,true);
});
