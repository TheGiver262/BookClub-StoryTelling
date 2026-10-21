import {useEffect,useState} from 'react';
import {apiClient,type MemberDto} from '../lib/api-client';

export default function MembershipManager() {
  const [members,setMembers]=useState<MemberDto[]>([]),[selected,setSelected]=useState<MemberDto|null>(null);
  const [query,setQuery]=useState(''),[evaluation,setEvaluation]=useState(''),[passed,setPassed]=useState(false),[confirm,setConfirm]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function load(){setMembers(await apiClient.getMembers());}
  useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  async function act(action:string){
    if (!selected || busy) return;
    setBusy(true);setError('');setMessage('');
    try {await apiClient.changeMembership(selected.id,{action,evaluation,passed,confirmUsername:confirm});await load();setSelected(null);setMessage(action==='PROMOTE'?'Đã công nhận thành viên chính thức.':action==='RETIRE'?'Đã chuyển thành cựu thành viên.':'Đã xóa tài khoản cộng tác viên và thu hồi các phiên đăng nhập.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="bg-[#FFFDF5] border border-[#DCDED0] rounded-[22px] p-6 sm:p-8 shadow-soft-card space-y-5">
    <div>
      <h2 className="font-serif text-2xl font-bold text-[#35483C]">Cộng tác viên & vòng đời thành viên</h2>
      <p className="text-sm text-[#64705C] mt-1">Ứng viên trúng tuyển bắt đầu là cộng tác viên. Sau một tháng thử thách và đánh giá đạt, quản lý công nhận thành viên chính thức.</p>
    </div>
    {error&&<p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-[12px] p-3">{error}</p>}
    {message&&<p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-[12px] p-3">{message}</p>}
    <input aria-label="Tìm thành viên hoặc cộng tác viên" className="w-full bg-white border border-[#DCDED0] p-3 rounded-[14px] text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary" placeholder="Tìm theo tên hoặc tài khoản" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="grid sm:grid-cols-2 gap-3">{members.filter(m=>!m.collaboratorDeletedAt && (m.fullName+' '+m.username).toLowerCase().includes(query.toLowerCase())).map(m=><button type="button" key={m.id} onClick={()=>{setSelected(m);setPassed(false);setEvaluation('');setConfirm('');setError('');}} className="bg-white border border-[#DCDED0] rounded-[14px] p-4 text-left text-sm hover:border-ysbk-primary hover:bg-[#E8EDDF]/20 transition shadow-xs"><strong>{m.fullName}</strong><span className="block text-[#64705C] text-xs mt-1">{m.username} · {m.isCollaborator?'Cộng tác viên':m.isAlumni?'Cựu thành viên':m.isAdmin?'Quản lý':'Thành viên'}{!m.isActive?' · Đã khóa':''}</span></button>)}</div>
    {selected&&<div className="border border-[#DCDED0] rounded-[18px] p-5 sm:p-6 space-y-4 bg-white shadow-xs">
      <h3 className="font-serif text-lg font-bold text-[#35483C]">{selected.fullName} — <span className="font-mono text-sm text-[#64705C]">{selected.username}</span></h3>
      {selected.isCollaborator?<>
        <p className="text-sm text-[#64705C]">Thử thách: <strong className="text-[#35483C]">{selected.probationStartedOn}</strong> → <strong className="text-[#35483C]">{selected.probationEndsOn}</strong></p>
        <label className="block text-sm font-medium text-[#35483C]">Nhận xét đánh giá<textarea className="block w-full bg-[#FFFDF5] border border-[#DCDED0] rounded-[14px] p-3 mt-1.5 text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary" rows={3} maxLength={2000} value={evaluation} onChange={e=>setEvaluation(e.target.value)}/></label>
        <label className="flex gap-2.5 items-center text-sm text-[#35483C]"><input type="checkbox" className="rounded accent-[#365E4B] w-4 h-4" checked={passed} onChange={e=>setPassed(e.target.checked)}/>Đánh giá đạt sau thời gian thử thách</label>
        <button disabled={busy||!passed||evaluation.trim().length<5||!selected.isActive||!selected.probationEndsOn||selected.probationEndsOn>today} onClick={()=>void act('PROMOTE')} className="bg-ysbk-primary hover:bg-[#294C3A] text-white px-5 py-2.5 rounded-[14px] text-sm font-semibold shadow-soft-btn disabled:opacity-40 transition">Công nhận thành viên chính thức</button>
        <div className="border-t border-[#DCDED0] pt-4 space-y-3"><p className="text-sm text-[#64705C]">Xóa tài khoản sẽ chặn đăng nhập. Lịch sử mượn sách và giao dịch được giữ lại.</p><label className="block text-sm font-medium text-[#35483C]">Nhập tên tài khoản để xác nhận xóa<input className="block w-full bg-[#FFFDF5] border border-[#DCDED0] rounded-[14px] p-3 mt-1.5 text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button disabled={busy||confirm!==selected.username} onClick={()=>void act('DELETE_COLLABORATOR')} className="border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 px-5 py-2.5 rounded-[14px] text-sm font-semibold disabled:opacity-40 transition">Xóa tài khoản cộng tác viên</button></div>
      </>:selected.isAlumni?<p className="text-sm text-[#64705C]">Hồ sơ cựu thành viên được giữ để kết nối và tra cứu lịch sử.</p>:<><p className="text-sm text-[#64705C]">Thành viên chính thức rời CLB được chuyển thành cựu thành viên, giữ lịch sử hoạt động.</p><button disabled={busy} onClick={()=>void act('RETIRE')} className="border border-[#DCDED0] bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] px-5 py-2.5 rounded-[14px] text-sm font-semibold transition">Chuyển thành cựu thành viên</button></>}
    </div>}
  </section>;
}
