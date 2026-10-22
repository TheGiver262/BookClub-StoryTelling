import {useEffect,useState} from 'react';
import {useReaderSession} from './ReaderSession';
import {apiClient} from '../lib/api-client';
import type {PublicReservationDto} from '../server/reservations/types';
import ReservationSection from './ReservationSection';
import {formatVND} from '../data/mockData';

export default function ReaderWorkspace({initialMode='create',initialBookId}:{initialMode?:'create'|'lookup';initialBookId?:string}){
  const {reader,loading,error:sessionError,refresh,update,logout:signOut,requestSignIn}=useReaderSession();
  const [orders,setOrders]=useState<PublicReservationDto[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [fullName,setFullName]=useState(''),[phone,setPhone]=useState(''),[editing,setEditing]=useState(false),[cancelId,setCancelId]=useState('');
  useEffect(()=>{
    let active=true;
    setOrders([]);setEditing(false);setCancelId('');
    setFullName(reader?.fullName||'');setPhone(reader?.phone||'');
    if(reader&&initialMode==='lookup') void apiClient.listReaderReservations().then(list=>{if(active) setOrders(list);}).catch(e=>{if(active){setError(e.message);if(e.status===401) void refresh();}});
    return()=>{active=false;};
  },[reader?.id,initialMode]);
  async function save(event:React.SubmitEvent){
    event.preventDefault();setBusy(true);setError('');
    try{const profile=await apiClient.updateReaderProfile({fullName,phone});update(profile);setEditing(false);}
    catch(e:any){setError(e.message);if(e.status===401) void refresh();}finally{setBusy(false);}
  }
  async function logout(){
    setBusy(true);setError('');
    try{await signOut();setOrders([]);}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function cancel(){
    setBusy(true);setError('');
    try{await apiClient.cancelReaderReservation(cancelId);setCancelId('');window.dispatchEvent(new Event('ysbk:availability-changed'));setOrders(await apiClient.listReaderReservations());await refresh();}
    catch(e:any){setError(e.message);if(e.status===401) void refresh();}finally{setBusy(false);}
  }
  const labels:Record<string,string>={HELD:'Đang giữ chỗ',BORROWED:'Đã nhận sách',RETURNED:'Đã trả',CANCELLED:'Đã hủy',EXPIRED:'Hết hạn'};
  if(initialMode==='create'&&reader) return <ReservationSection key={reader.id} compact initialBookId={initialBookId} reader={reader}/>;
  return <section className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
    {(error||sessionError)&&<p role="alert" className="p-4 rounded-control bg-rose-50 text-rose-800">{error||sessionError}</p>}
    {loading?<p role="status">Đang kiểm tra phiên bạn đọc…</p>:!reader?<div className="ui-card p-6 space-y-4">
      <h2 className="font-serif text-2xl">Đăng nhập bạn đọc</h2>
      <p>Đăng nhập Google để tạo tài khoản, đặt sách và quản lý các đơn của bạn.</p>
      <button className="ui-btn ui-btn-primary" onClick={()=>requestSignIn()}>Đăng nhập</button>
      <p className="text-sm">Phiên được ghi nhớ trên trình duyệt này tối đa 30 ngày. Đăng nhập mới sẽ kết thúc phiên cũ.</p>
    </div>:<>
      <div className="ui-card p-5 flex flex-wrap items-center gap-3 justify-between">
        <div><h2 className="font-serif text-2xl">Tài khoản bạn đọc</h2><p className="break-all">{reader.email}</p></div>
        <div className="flex gap-2 flex-wrap"><button className="ui-btn ui-btn-secondary" onClick={()=>{setFullName(reader.fullName);setPhone(reader.phone||'');setEditing(!editing);}}>Sửa thông tin</button><button disabled={busy} className="ui-btn ui-btn-ghost" onClick={()=>void logout()}>Đăng xuất</button></div>
      </div>
      {(!reader.phone||editing)&&<form className="ui-card p-5 space-y-4" onSubmit={save}>
        <h3 className="font-serif text-xl">Thông tin nhận sách</h3>
        <label className="block">Họ và tên<input className="ui-input block w-full mt-1" required minLength={2} maxLength={255} autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)}/></label>
        <label className="block">Số điện thoại<input className="ui-input block w-full mt-1" required type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
        <button disabled={busy} className="ui-btn ui-btn-primary">{busy?'Đang lưu…':'Lưu thông tin'}</button>
      </form>}

      {initialMode==='lookup'&&<div className="space-y-4">
        <h3 className="font-serif text-2xl">Sách của tôi</h3><p className="text-sm">Hiển thị tối đa 100 đơn gần nhất của tài khoản này.</p>
        {!orders.length&&<p>Chưa có đơn đặt sách trong tài khoản.</p>}
        {orders.map(order=><article key={order.id} className="ui-card p-5 space-y-2">
          <h4 className="font-serif text-xl">{order.bookTitle}</h4><p>{order.code} · {order.status==='HELD'&&new Date(order.expiresAt).getTime()<=Date.now()?'Hết hạn':labels[order.status]}</p>
          <p>Nhận ngày {order.shiftDate}, {order.shiftTime} · {order.pickupLocation}</p><p>Cọc dự kiến: {formatVND(order.estimatedDeposit)}</p>
          {order.status==='HELD'&&new Date(order.expiresAt).getTime()>Date.now()&&(cancelId===order.id?<div className="flex flex-wrap gap-2"><span>Xác nhận hủy đơn này?</span><button disabled={busy} className="ui-btn ui-btn-terracotta" onClick={()=>void cancel()}>Xác nhận hủy</button><button disabled={busy} className="ui-btn ui-btn-ghost" onClick={()=>setCancelId('')}>Quay lại</button></div>:<button className="ui-btn ui-btn-secondary" onClick={()=>setCancelId(order.id)}>Hủy giữ chỗ</button>)}
        </article>)}
      </div>}
    </>}
  </section>;
}
