import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/api-client';

async function prepareImage(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12*1024*1024) throw new Error('Chọn ảnh PNG, JPEG hoặc WebP dưới 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1,1000/bitmap.width,1400/bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const quality of [.82,.68,.5,.35]) {
      const image = canvas.toDataURL('image/webp',quality);
      if (image.length <= 245700) return image;
    }
    throw new Error('Ảnh còn quá lớn. Hãy chọn ảnh nhỏ hơn.');
  } finally { bitmap.close(); }
}

const emptyBook = {id:'',editionId:'',title:'',authors:'',categories:'',description:'',publisher:'',coverPrice:'',barcodes:''};
const emptyShift = {id:'',date:'',start:'14:00',end:'17:00',location:'Sảnh Thư viện Tạ Quang Bửu',status:'DRAFT'};
const emptyEvent = {id:'',title:'',description:'',eventDate:'',location:'',isApprovedForPublic:false};
const inputClass = 'w-full mt-1.5 rounded-[14px] border border-[#DCDED0] bg-white p-3 text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary';

function Field({label,name,value,onChange,type='text',required=false}: {label:string;name:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean}) {
  return <label className="block text-sm font-medium text-[#35483C]">{label}<input className={inputClass} name={name} value={value} onChange={e=>onChange(e.target.value)} type={type} required={required}/></label>;
}

export default function PublishingManager() {
  const [section,setSection] = useState('books');
  const [book,setBook] = useState(emptyBook);
  const [shift,setShift] = useState(emptyShift);
  const [event,setEvent] = useState(emptyEvent);
  const [recruit,setRecruit] = useState({title:'',description:'',formUrl:'',status:'DRAFT'});
  const [schedules,setSchedules] = useState<any[]>([]), [events,setEvents] = useState<any[]>([]);
  const [query,setQuery] = useState(''), [books,setBooks] = useState<any[]>([]);
  const [image,setImage] = useState(''), [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [error,setError] = useState('');
  const [holiday,setHoliday] = useState({holidayDate:'',name:''});
  const imageTaskIdRef = useRef(0);
  const currentContext = section === 'books' ? `books:${book.id || 'new'}` : section;
  const contextRef = useRef(currentContext);
  contextRef.current = currentContext;
  async function load() {
    const [overview,eventList] = await Promise.all([apiClient.getPublishingOverview(),apiClient.listEvents()]);
    setSchedules(overview.schedules); setEvents(eventList);
    if (overview.recruitment) setRecruit(overview.recruitment);
  }
  useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
  async function run(action:()=>Promise<unknown>,success:string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); setImage(''); await load(); }
    catch(e) { setError(e instanceof Error ? e.message : 'Không lưu được. Hãy thử lại.'); }
    finally { setBusy(false); }
  }
  async function chooseImage(file?:File) {
    if (busy) return;
    const taskId = ++imageTaskIdRef.current;
    const taskContext = currentContext;
    setImage('');
    if (!file) return;
    setBusy(true); setError('');
    try {
      const prepared = await prepareImage(file);
      if (taskId === imageTaskIdRef.current && contextRef.current === taskContext) {
        setImage(prepared);
      }
    } catch(e) {
      if (taskId === imageTaskIdRef.current && contextRef.current === taskContext) {
        setError((e as Error).message);
      }
    } finally {
      if (taskId === imageTaskIdRef.current) {
        setBusy(false);
      }
    }
  }
  const imageField = <label className="block text-sm font-medium text-[#35483C]">Ảnh minh họa <input key={section+book.id} disabled={busy} className={inputClass} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void chooseImage(e.target.files?.[0])}/>{image && <img src={image} className="mt-3 max-h-40 rounded-[14px] border border-[#DCDED0] object-contain" alt="Xem trước ảnh sẽ lưu"/>}<span className="text-xs text-[#64705C] mt-1 block">Ảnh được thu nhỏ tự động trước khi lưu.</span></label>;
  const saveButton = <button disabled={busy} className="rounded-[14px] bg-ysbk-primary hover:bg-[#294C3A] px-5 py-2.5 text-sm font-semibold text-white shadow-soft-btn transition disabled:opacity-50">{busy?'Đang xử lý…':'Lưu thay đổi'}</button>;
  return <section className="rounded-[22px] border border-[#DCDED0] bg-[#FFFDF5] p-6 sm:p-8 space-y-5 shadow-soft-card">
    <div><h2 className="font-serif text-2xl font-bold text-[#35483C]">Quản lý nội dung công khai</h2><p className="mt-1 text-sm text-[#64705C]">Cập nhật tủ sách, lịch hẹn và thông tin CLB tại đây.</p></div>
    <nav aria-label="Quản lý nội dung" className="flex gap-2 flex-wrap">{[['books','Sách & ảnh bìa'],['schedules','Lịch trực / nghỉ'],['events','Sự kiện'],['recruitment','Tuyển thành viên']].map(([key,label])=><button type="button" key={key} disabled={busy} onClick={()=>{imageTaskIdRef.current++; setBusy(false); setSection(key);setImage('');setError('');setMessage('');}} className={'rounded-[12px] px-4 py-2 text-sm font-medium transition disabled:opacity-50 '+(section===key?'bg-ysbk-primary text-white shadow-xs':'bg-[#E8EDDF] text-[#35483C] hover:bg-[#DCDED0]')}>{label}</button>)}</nav>
    {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-[12px] p-3">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-[12px] p-3">{message}</p>}
    {section==='books' && <>
      <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>setBooks((await apiClient.listPublicReservationBooks({search:query,includeUnavailable:true,limit:50})).items),'Đã tải danh sách. Chọn sách để sửa hoặc thêm sách mới.');}}><input aria-label="Tìm sách để sửa" className={inputClass} placeholder="Tìm sách đã có để chỉnh sửa" value={query} onChange={e=>setQuery(e.target.value)}/><button className="px-5 border border-[#DCDED0] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] font-semibold rounded-[14px] text-sm transition" disabled={busy}>Tìm</button></form>
      <div className="flex gap-2 flex-wrap items-center"><button type="button" disabled={busy} className="text-sm font-semibold text-ysbk-primary hover:underline disabled:opacity-50" onClick={()=>{imageTaskIdRef.current++; setBusy(false); setBook({...emptyBook});setImage('');}}>+ Thêm đầu sách mới</button>{books.map(b=><button type="button" disabled={busy} className="rounded-[10px] border border-[#DCDED0] bg-white hover:bg-[#E8EDDF]/40 px-3 py-1.5 text-xs text-[#35483C] transition disabled:opacity-50" key={b.titleId} onClick={()=>{imageTaskIdRef.current++; setBusy(false); setImage(''); void run(async()=>{const d=await apiClient.getPublicBook(b.titleId);setBook({...emptyBook,id:d.id,title:d.title,description:d.description||'',authors:d.authors.join(', '),categories:d.categories.join(', '),editionId:d.editions[0]?.id||'',publisher:d.editions[0]?.publisher||''});},'Đã mở thông tin sách.');}}>{b.title}</button>)}</div>
      <form className="space-y-4 border-t border-[#DCDED0] pt-4" onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await apiClient.savePublishing('books',{...book,image});setBook({...book,id:saved.id,editionId:saved.editionId,barcodes:''});},'Đã lưu sách. Bạn đọc có thể xem mô tả và đặt các bản còn trong kho.');}}>
        <h3 className="font-serif text-lg font-bold text-[#35483C]">{book.id?'Chỉnh sửa đầu sách':'Thêm đầu sách'}</h3>
        <div className="grid md:grid-cols-2 gap-4">{[['title','Tên sách'],['authors','Tác giả (ngăn cách bằng dấu phẩy)'],['categories','Thể loại (ngăn cách bằng dấu phẩy)'],['publisher','Nhà xuất bản']].map(([key,label])=><Field key={key} name={key} label={label} value={book[key as keyof typeof book]} required={key==='title'||key==='publisher'} onChange={v=>setBook({...book,[key]:v})}/>)}</div>
        <label className="block text-sm font-medium text-[#35483C]">Giới thiệu / tóm tắt sách<textarea className={inputClass} rows={6} maxLength={6000} value={book.description} onChange={e=>setBook({...book,description:e.target.value})}/></label>
        {imageField}<Field name="coverPrice" label="Giá bìa cho các bản thêm mới (đồng)" type="number" value={book.coverPrice} onChange={v=>setBook({...book,coverPrice:v})}/>
        <label className="block text-sm font-medium text-[#35483C]">Mã các bản sách thêm vào kho (mỗi dòng một mã)<textarea className={inputClass} rows={3} value={book.barcodes} onChange={e=>setBook({...book,barcodes:e.target.value})}/><span className="text-xs text-[#64705C] mt-1 block">Bỏ trống nếu chỉ cập nhật nội dung. Các bản đang mượn hoặc giữ chỗ vẫn được giữ nguyên.</span></label>{saveButton}
      </form>
    </>}
    {section==='schedules' && <>
      <label className="block text-sm font-medium text-[#35483C]">Chọn buổi để sửa<select className={inputClass} value={shift.id} onChange={e=>{const s=schedules.find(s=>s.id===e.target.value);setShift(s?{id:s.id,date:s.schedule_date,start:s.shift_time.slice(0,5),end:s.shift_time.match(/-\s*(\d{2}:\d{2})/)?.[1]||'17:00',location:s.location,status:s.status}:{...emptyShift});}}><option value="">+ Buổi trực mới</option>{schedules.map(s=><option key={s.id} value={s.id}>{s.schedule_date} · {s.shift_time} · {s.status}</option>)}</select></label>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void run(async()=>{const s=await apiClient.savePublishing('schedules',shift);setShift({...shift,id:s.id});},'Đã cập nhật buổi trực.');}}>
        <div className="grid sm:grid-cols-3 gap-4">{[['date','Ngày','date'],['start','Từ','time'],['end','Đến','time']].map(([key,label,type])=><Field key={key} name={key} label={label} type={type} required value={shift[key as keyof typeof shift]} onChange={v=>setShift({...shift,[key]:v})}/>)}</div>
        <Field name="location" label="Địa điểm" required value={shift.location} onChange={v=>setShift({...shift,location:v})}/>
        <label className="block text-sm font-medium text-[#35483C]">Trạng thái<select className={inputClass} value={shift.status} onChange={e=>setShift({...shift,status:e.target.value})}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Mở nhận đặt sách</option><option value="CANCELLED">Nghỉ / hủy buổi trực</option></select></label>{saveButton}
      </form>
      <form className="border-t border-[#DCDED0] pt-4 space-y-3" onSubmit={e=>{e.preventDefault();void run(()=>apiClient.addCalendarHoliday(holiday),'Đã cập nhật ngày nghỉ và tính lại hạn trả liên quan.');}}><h3 className="font-serif text-lg font-bold text-[#35483C]">Ngày nghỉ lễ / nghỉ CLB</h3><p className="text-sm text-[#64705C]">Nếu buổi trực có đơn giữ chỗ, cần liên hệ bạn đọc và xử lý đơn trước.</p><Field name="holidayDate" label="Ngày nghỉ" type="date" required value={holiday.holidayDate} onChange={v=>setHoliday({...holiday,holidayDate:v})}/><Field name="name" label="Lý do nghỉ" required value={holiday.name} onChange={v=>setHoliday({...holiday,name:v})}/>{saveButton}</form>
    </>}
    {section==='events' && <>
      <label className="block text-sm font-medium text-[#35483C]">Chọn sự kiện<select className={inputClass} value={event.id} onChange={e=>{const a=events.find(a=>a.id===e.target.value);setEvent(a?{id:a.id,title:a.title,description:a.description||'',eventDate:a.eventDate?.slice(0,10)||'',location:a.location||'',isApprovedForPublic:a.isApprovedForPublic}:{...emptyEvent});}}><option value="">+ Thêm sự kiện</option>{events.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=event.id?await apiClient.updateEvent(event.id,event):await apiClient.createEvent(event);setEvent({...event,id:saved.id});},'Đã lưu sự kiện.');}}>
        <Field name="title" label="Tên sự kiện" required value={event.title} onChange={v=>setEvent({...event,title:v})}/><Field name="eventDate" label="Ngày diễn ra" type="date" required value={event.eventDate} onChange={v=>setEvent({...event,eventDate:v})}/><Field name="location" label="Địa điểm" value={event.location} onChange={v=>setEvent({...event,location:v})}/><label className="block text-sm font-medium text-[#35483C]">Giới thiệu<textarea className={inputClass} rows={5} value={event.description} onChange={e=>setEvent({...event,description:e.target.value})}/></label><label className="flex gap-2.5 items-center text-sm text-[#35483C]"><input type="checkbox" className="rounded accent-[#365E4B] w-4 h-4" checked={event.isApprovedForPublic} onChange={e=>setEvent({...event,isApprovedForPublic:e.target.checked})}/>Hiển thị cho bạn đọc</label>{saveButton}
      </form>
    </>}
    {section==='recruitment' && <form className="space-y-4" onSubmit={e=>{e.preventDefault();void run(()=>apiClient.savePublishing('recruitment',{...recruit,image}),'Đã cập nhật thông tin tuyển thành viên.');}}><Field name="title" label="Tên đợt tuyển" required value={recruit.title} onChange={v=>setRecruit({...recruit,title:v})}/><label className="block text-sm font-medium text-[#35483C]">Giới thiệu / hướng dẫn ứng tuyển<textarea className={inputClass} rows={5} value={recruit.description} onChange={e=>setRecruit({...recruit,description:e.target.value})}/></label><Field name="formUrl" label="Liên kết đăng ký (Google Form hoặc https://…)" type="url" value={recruit.formUrl} onChange={v=>setRecruit({...recruit,formUrl:v})}/>{imageField}<label className="block text-sm font-medium text-[#35483C]">Trạng thái<select className={inputClass} value={recruit.status} onChange={e=>setRecruit({...recruit,status:e.target.value})}><option value="DRAFT">Bản nháp</option><option value="OPEN">Đang nhận đơn</option><option value="CLOSED">Đã đóng đơn</option></select></label>{saveButton}</form>}
  </section>;
}
