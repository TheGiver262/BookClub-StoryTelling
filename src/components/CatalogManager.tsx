import {useEffect,useRef,useState} from 'react';
import {apiClient,requestJson} from '../lib/api-client';
import {prepareImage} from './PublishingManager';
import type {CatalogDraft} from '../server/catalog/submissions';
import type {CatalogImportRow} from '../server/catalog/import';

interface Submission {id:string;status:string;version:number;payload:CatalogDraft;warnings:string[];moderation_note?:string;created_by:string;}
interface Preview {sheet:string;rows:CatalogImportRow[];}
const empty:CatalogDraft={title:'',authors:'',categories:'',publisher:'',description:'',copies:[]};
const labels:Record<string,string>={DRAFT:'Bản nháp',PENDING:'Chờ duyệt',REJECTED:'Cần chỉnh sửa',PUBLISHED:'Đã công khai'};
const fields=[['title','Tên sách'],['authors','Tác giả'],['categories','Thể loại'],['publisher','Nhà xuất bản']] as const;

export default function CatalogManager({canPublish,userId}:{canPublish:boolean;userId?:string}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<Preview|null>(null);
  const [items,setItems]=useState<Submission[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[status,setStatus]=useState(''),[search,setSearch]=useState('');
  const [selected,setSelected]=useState<Submission|null>(null),[draft,setDraft]=useState<CatalogDraft|null>(null),[note,setNote]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [existingQuery,setExistingQuery]=useState(''),[existing,setExisting]=useState<{id:string;title:string}[]>([]);
  const requestId=useRef(0),inFlight=useRef(false),editor=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(draft)editor.current?.scrollIntoView({block:'start'});},[selected?.id,!!draft]);
  async function load(){
    const id=++requestId.current;
    const result=await requestJson<{items:Submission[];total:number}>('/api/v1/catalog/submissions?'+new URLSearchParams({page:String(page),status,search}));
    if(id===requestId.current){setItems(result.items);setTotal(result.total);}
  }
  useEffect(()=>{const task=setTimeout(()=>void load().catch(e=>setError(e.message)),200);return()=>{clearTimeout(task);requestId.current++;};},[page,status,search]);
  async function run(action:()=>Promise<void>){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setMessage('');
    try{await action();}catch(e:any){setError(e.message||'Thao tác chưa hoàn tất. Nội dung đang nhập vẫn được giữ.');}finally{inFlight.current=false;setBusy(false);}
  }
  async function choose(file?:File){
    if(!file)return;
    await run(async()=>{setPreview(null);setFile(null);if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>5*1024*1024)throw Error('Chọn file .xlsx dưới 5 MB.');
      const form=new FormData();form.append('file',file);
      setPreview(await requestJson<Preview>('/api/v1/catalog/import/preview',{method:'POST',body:form}));setFile(file);
    });
  }
  function open(row:Submission){setSelected(row);setDraft(structuredClone(row.payload));setNote('');setError('');setMessage('');}
  async function action(action:string){
    await run(async()=>{
      let row=selected;
      if(!row){row=await requestJson<Submission>('/api/v1/catalog/submissions',{method:'POST',body:JSON.stringify(draft)});setSelected(row);}
      const result=await requestJson<Submission>('/api/v1/catalog/submissions/'+row.id,{method:'POST',body:JSON.stringify({action,version:row.version,payload:draft,note})});
      setSelected(result);setDraft(structuredClone(result.payload));await load();
      if(action==='APPROVE')window.dispatchEvent(new Event('ysbk:availability-changed'));
      setMessage(action==='APPROVE'?'Đã công khai sách và cập nhật kho.':action==='SUBMIT'?'Đã gửi Quản lý/ADMIN duyệt.':action==='REJECT'?'Đã trả lại để chỉnh sửa.':'Đã lưu thay đổi.');
    });
  }
  const editable=!!draft&&(!selected||['DRAFT','REJECTED'].includes(selected.status));
  const warningRows=preview?.rows.filter(row=>row.errors.length||row.warnings.length)||[];
  return <section className="space-y-5 min-w-0 break-words">
    <div className="ui-card p-5 space-y-3"><h2 className="font-serif text-2xl">Tủ sách: nhập liệu và duyệt nội dung</h2><p className="text-sm">Nhập sách thành bản nháp, bổ sung nội dung rồi gửi duyệt. Quản lý hoặc ADMIN công khai sách cho bạn đọc.</p>
      <div className="border-2 border-dashed border-[#8C9685] rounded-[18px] p-6 text-center space-y-3" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!busy)void choose(event.dataTransfer.files[0]);}}>
        <p>Kéo thả file Excel vào đây hoặc chọn từ máy</p><label className="block text-sm">File danh mục sách (.xlsx, tối đa 5 MB)<input disabled={busy} className="ui-input block w-full mt-2" type="file" accept=".xlsx" onChange={event=>void choose(event.target.files?.[0])}/></label>
      </div>
      {preview&&<div className="space-y-3"><p><strong className="break-all">{file?.name}</strong> · Sheet {preview.sheet} · {preview.rows.length} dòng · {preview.rows.filter(row=>!row.errors.length).length} dòng hợp lệ.</p>
        <p className="text-sm">Bản đang mượn/chưa rõ sẽ chờ đối chiếu kho. Không tự tạo phiếu mượn. Những dòng lỗi được bỏ qua; file gốc không thay đổi.</p>
        <details><summary className="cursor-pointer">Xem lỗi và cảnh báo ({warningRows.length} dòng)</summary><div className="max-h-64 overflow-auto"><table className="w-full text-sm text-left"><thead><tr><th>Dòng / mã</th><th>Sách</th><th>Cần kiểm tra</th></tr></thead><tbody>{warningRows.map(row=><tr key={row.rowNumber}><td className="p-2">{row.rowNumber} / {row.copy.barcode}</td><td>{row.title}</td><td className={row.errors.length?'text-red-800':''}>{[...row.errors,...row.warnings].join(' ')}</td></tr>)}</tbody></table></div></details>
        <button className="ui-btn ui-btn-primary" disabled={busy||!file||!preview.rows.some(row=>!row.errors.length)} onClick={()=>void run(async()=>{
          const form=new FormData();form.append('file',file!);form.append('confirm','true');
          const result=await requestJson<{imported:number;drafts:number;skipped:number}>('/api/v1/catalog/import/confirm',{method:'POST',body:form});
          setPreview(null);setFile(null);setPage(1);await load();setMessage(`Đã nhập ${result.imported} bản thành ${result.drafts} nháp; bỏ qua ${result.skipped} dòng lỗi.`);
        })}>Xác nhận nhập các dòng hợp lệ thành nháp</button>
      </div>}
    </div>
    {error&&<p role="alert" className="ui-card p-4 text-red-800">{error}</p>}{message&&<p role="status" className="ui-card p-4 text-[#365E4B]">{message}</p>}{busy&&<p role="status">Đang xử lý…</p>}
    <div className="ui-card p-5 space-y-3">
      <div className="flex gap-3 flex-wrap"><button disabled={busy} className="ui-btn ui-btn-primary" onClick={()=>{setSelected(null);setDraft(structuredClone(empty));setError('');}}>Thêm sách mới</button><button disabled={busy} className="ui-btn ui-btn-secondary" onClick={()=>void run(load)}>Tải lại</button></div>
      <form className="flex gap-2 flex-wrap" onSubmit={event=>{event.preventDefault();void run(async()=>{const result=await apiClient.listPublicReservationBooks({search:existingQuery,includeUnavailable:true,limit:20});setExisting(result.items.map(book=>({id:book.titleId,title:book.title})));});}}><label className="flex-1 text-sm">Sửa sách đã công khai<input className="ui-input block w-full mt-1" value={existingQuery} onChange={event=>setExistingQuery(event.target.value)} placeholder="Tìm sách để tạo bản sửa"/></label><button disabled={busy} className="ui-btn ui-btn-secondary">Tìm sách</button></form>
      <div className="flex flex-wrap gap-2">{existing.map(book=><button disabled={busy} key={book.id} className="ui-btn ui-btn-secondary" onClick={()=>void run(async()=>{open(await requestJson<Submission>('/api/v1/catalog/submissions',{method:'POST',body:JSON.stringify({titleId:book.id})}));await load();})}>{book.title}</button>)}</div>
      <div className="flex gap-3 flex-wrap"><label className="flex-1 text-sm">Tìm bản nháp<input className="ui-input w-full block mt-1" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></label><label className="text-sm">Trạng thái<select className="ui-input block mt-1" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">Tất cả</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
      {!items.length&&<p>Chưa có bản nháp trong danh sách này.</p>}
      <div className="grid md:grid-cols-2 gap-3">{items.map(row=><button disabled={busy} key={row.id} className="ui-card p-4 text-left" onClick={()=>open(row)}><strong>{row.payload.title}</strong><span className="block text-sm mt-1">{labels[row.status]} · {row.payload.copies.length} bản</span></button>)}</div>
      <div className="flex gap-3 items-center"><button disabled={busy||page<=1} className="ui-btn ui-btn-secondary" onClick={()=>setPage(value=>value-1)}>Trang trước</button><span>{page} / {Math.max(1,Math.ceil(total/30))} · {total} hồ sơ</span><button disabled={busy||page*30>=total} className="ui-btn ui-btn-secondary" onClick={()=>setPage(value=>value+1)}>Trang sau</button></div>
    </div>
    {draft&&<div ref={editor} className="ui-card p-5 space-y-4 scroll-mt-5"><h3 className="font-serif text-2xl">{selected?labels[selected.status]:'Sách mới'}: {draft.title||'Chưa có tên'}</h3>
      {selected?.moderation_note&&<p className="text-[#813C2A]">Ghi chú duyệt: {selected.moderation_note}</p>}
      {!!selected?.warnings.length&&<details><summary>Cảnh báo từ file nguồn</summary>{selected.warnings.map((warning,index)=><p key={index} className="text-sm">{warning}</p>)}</details>}
      <fieldset disabled={busy||!editable} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">{fields.map(([key,label])=><label key={key} className="text-sm">{label}<input className="ui-input block w-full mt-1" value={draft[key]} maxLength={key==='title'?255:500} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></label>)}</div>
        <label className="block text-sm">Tóm tắt / giới thiệu<textarea className="ui-input block w-full mt-1" rows={6} maxLength={6000} value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
        <div onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();const file=event.dataTransfer.files[0];if(file&&!busy&&editable)void run(async()=>setDraft({...draft,image:await prepareImage(file)}));}} className="border border-dashed rounded-[16px] p-4"><label className="block text-sm">Chọn hoặc kéo thả ảnh bìa<input type="file" accept="image/jpeg,image/png,image/webp" className="ui-input block w-full mt-2" onChange={event=>{const file=event.target.files?.[0];if(file)void run(async()=>setDraft({...draft,image:await prepareImage(file)}));}}/></label>{draft.image&&<img src={draft.image} alt="Ảnh bìa xem trước" className="max-h-48 mt-3 rounded-[12px]"/>}</div>
        <h4 className="font-semibold">Các bản sách và giá bìa</h4><p className="text-sm">Bỏ trống giá nếu chưa biết. Chỉ chuyển sang Sẵn sàng sau khi đối chiếu sách thực tế.</p>
        {draft.copies.map((copy,index)=><div key={index} className="grid sm:grid-cols-3 gap-3 border-b pb-3"><label className="text-sm">Mã bản {index+1}<input className="ui-input w-full block" value={copy.barcode} disabled={!!draft.id&&!!selected?.payload.copies.some(original=>original.barcode===copy.barcode)} onChange={event=>setDraft({...draft,copies:draft.copies.map((value,i)=>i===index?{...value,barcode:event.target.value}:value)})}/></label><label className="text-sm">Giá bìa (đồng)<input className="ui-input w-full block" type="number" min="0" value={copy.coverPrice??''} onChange={event=>setDraft({...draft,copies:draft.copies.map((value,i)=>i===index?{...value,coverPrice:event.target.value===''?null:Number(event.target.value)}:value)})}/></label><label className="text-sm">Tình trạng<select className="ui-input w-full block" value={copy.status} onChange={event=>setDraft({...draft,copies:draft.copies.map((value,i)=>i===index?{...value,status:event.target.value as 'AVAILABLE'|'MAINTENANCE'}:value)})}><option value="AVAILABLE">Sẵn sàng</option><option value="MAINTENANCE">Chờ đối chiếu / chưa cho đặt</option></select></label></div>)}
        <button type="button" className="ui-btn ui-btn-secondary" onClick={()=>setDraft({...draft,copies:[...draft.copies,{barcode:'',coverPrice:null,status:'MAINTENANCE'}]})}>Thêm bản sách</button>
      </fieldset>
      <div className="flex gap-3 flex-wrap">{editable&&<><button disabled={busy} className="ui-btn ui-btn-secondary" onClick={()=>void action('SAVE')}>Lưu nháp</button><button disabled={busy} className="ui-btn ui-btn-primary" onClick={()=>void action('SUBMIT')}>Lưu và gửi duyệt</button></>}
        {selected?.status==='PENDING'&&(canPublish||selected.created_by===userId)&&<button disabled={busy} className="ui-btn ui-btn-secondary" onClick={()=>void action('WITHDRAW')}>Rút về nháp để sửa</button>}
      </div>
      {canPublish&&selected?.status==='PENDING'&&<div className="border-t pt-4 space-y-3"><label className="block text-sm">Lý do yêu cầu chỉnh sửa<textarea className="ui-input w-full block mt-1" value={note} onChange={event=>setNote(event.target.value)}/></label><p className="text-sm">Công khai sẽ cập nhật tủ sách và tồn kho theo nội dung đã gửi ở trên.</p><div className="flex gap-3"><button disabled={busy} className="ui-btn ui-btn-primary" onClick={()=>void action('APPROVE')}>Duyệt và công khai</button><button disabled={busy||!note.trim()} className="ui-btn ui-btn-terracotta" onClick={()=>void action('REJECT')}>Yêu cầu chỉnh sửa</button></div></div>}
    </div>}
  </section>;
}
