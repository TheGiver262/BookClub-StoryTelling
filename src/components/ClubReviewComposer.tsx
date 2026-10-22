import {useEffect,useState} from 'react';
import {apiClient} from '../lib/api-client';
import type {PublicReservationBookDto} from '../server/reservations/types';

export default function ClubReviewComposer({onSubmitted}:{onSubmitted:()=>void}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[books,setBooks]=useState<PublicReservationBookDto[]>([]);
  const [bookId,setBookId]=useState(''),[content,setContent]=useState(''),[rating,setRating]=useState(5),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    if(!open) return;
    let active=true;const timeout=window.setTimeout(()=>{void apiClient.listPublicReservationBooks({search,includeUnavailable:true,limit:50}).then(result=>{if(active) setBooks(result.items);}).catch(error=>{if(active){setBooks([]);setMessage(error.message);}});},200);
    return()=>{active=false;window.clearTimeout(timeout);};
  },[open,search]);
  async function submit(event:React.SubmitEvent){
    event.preventDefault();setBusy(true);setMessage('');
    try{await apiClient.submitBookReview({bookId,authorName:'CLB Yêu Sách Bách Khoa Hà Nội',rating,content});setContent('');setMessage('Review CLB đang chờ Quản lý/ADMIN duyệt. Sau duyệt bài sẽ ghim trước review bạn đọc.');onSubmitted();}
    catch(error:any){setMessage(error.message);}finally{setBusy(false);}
  }
  return <details className="ui-card p-5" onToggle={event=>setOpen(event.currentTarget.open)}><summary className="cursor-pointer font-serif text-xl">Viết review CLB</summary>
    {open&&<form onSubmit={submit} className="space-y-4 mt-4">
      <p className="text-sm">Chỉ chữ; bài gửi chờ Quản lý/ADMIN duyệt rồi mới hiển thị công khai.</p>
      <label className="block text-sm">Tìm sách<input className="ui-input w-full block mt-1" value={search} onChange={event=>{setSearch(event.target.value);setBookId('');}}/></label>
      <label className="block text-sm">Cuốn sách<select className="ui-input w-full block mt-1" required value={bookId} onChange={event=>setBookId(event.target.value)}><option value="">Chọn sách</option>{books.map(book=><option key={book.titleId} value={book.titleId}>{book.title} — {book.author}</option>)}</select></label>
      <label className="block text-sm">Số sao<select className="ui-input block mt-1" value={rating} onChange={event=>setRating(Number(event.target.value))}>{[5,4,3,2,1].map(value=><option key={value} value={value}>{value} sao</option>)}</select></label>
      <label className="block text-sm">Nội dung<textarea className="ui-input w-full block mt-1" required minLength={10} maxLength={3000} rows={6} value={content} onChange={event=>setContent(event.target.value)}/></label>
      {message&&<p role="status" className="text-sm">{message}</p>}<button className="ui-btn ui-btn-primary" disabled={busy}>{busy?'Đang gửi…':'Gửi review chờ duyệt'}</button>
    </form>}
  </details>;
}
