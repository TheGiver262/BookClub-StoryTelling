import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {apiClient,type ReaderProfile} from '../lib/api-client';
import ReaderDialog from './ReaderDialog';

interface ReaderSession {
  reader:ReaderProfile|null;loading:boolean;error:string;
  refresh:()=>Promise<void>;update:(profile:ReaderProfile)=>void;logout:()=>Promise<void>;
  requireReader:(next?:string)=>boolean;requestSignIn:(next?:string)=>void;
}
const Context=createContext<ReaderSession|null>(null);
export function useReaderSession(){const value=useContext(Context);if(!value) throw Error('Reader session provider is missing');return value;}

export function ReaderSessionProvider({children}:{children:ReactNode}){
  const [reader,setReader]=useState<ReaderProfile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [googleEnabled,setGoogleEnabled]=useState(false),[next,setNext]=useState<string|null>(null);
  const active=useRef(false),version=useRef(0),hadSession=useRef(false);
  const refresh=useCallback(async()=>{
    const current=++version.current;
    try{const profile=await apiClient.getReaderProfile();if(active.current&&version.current===current){setReader(profile);hadSession.current=true;setError('');}}
    catch(e:any){if(active.current&&version.current===current){
      if(e.status===401){setReader(null);if(hadSession.current) setError('Phiên đã kết thúc hoặc tài khoản vừa đăng nhập ở trình duyệt khác.');hadSession.current=false;}
      else setError(e.message||'Không kiểm tra được tài khoản. Hãy thử lại.');
    }}finally{if(active.current&&version.current===current) setLoading(false);}
  },[]);
  useEffect(()=>{
    active.current=true;void refresh();
    void apiClient.getReaderAuthStatus().then(status=>{if(active.current) setGoogleEnabled(status.googleEnabled);}).catch(()=>{});
    const focus=()=>{if(document.visibilityState==='visible') void refresh();};
    const interval=window.setInterval(focus,30000);
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);window.addEventListener('ysbk:reader-session-ended',focus);
    return()=>{active.current=false;version.current++;window.clearInterval(interval);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);window.removeEventListener('ysbk:reader-session-ended',focus);};
  },[refresh]);
  const requestSignIn=(target='/sach/?tab=tra-don')=>setNext(target);
  const requireReader=(target?:string)=>{if(reader) return true;requestSignIn(target);return false;};
  const logout=async()=>{await apiClient.logoutReader();version.current++;setReader(null);hadSession.current=false;};
  return <Context.Provider value={{reader,loading,error,refresh,update:setReader,logout,requireReader,requestSignIn}}>
    {children}
    {next!==null&&<ReaderDialog title="Tài khoản bạn đọc" onClose={()=>setNext(null)}>
      <div className="reader-signin"><img src="/book/assets/club-logo-v8.svg" alt="CLB Yêu Sách" width="64" height="64"/>
        <h3>Một tài khoản, nhiều câu chuyện</h3><p>Đăng nhập Google để đặt sách, đánh dấu và chia sẻ cảm nhận. Lần đầu đăng nhập sẽ tạo tài khoản bạn đọc.</p>
        {loading?<p role="status">Đang kiểm tra tài khoản…</p>:googleEnabled?<a className="ui-btn ui-btn-primary" href={'/api/v1/readers/auth/google?next='+encodeURIComponent(next)}>Tiếp tục với Google</a>:<p role="status" className="reader-notice">Đăng nhập Google đang được CLB cấu hình. Bạn vẫn có thể xem Tủ sách và các bài review đã duyệt.</p>}
        <small>Ghi nhớ trên trình duyệt này tối đa 30 ngày. Đăng nhập mới sẽ kết thúc phiên cũ.</small>
      </div>
    </ReaderDialog>}
  </Context.Provider>;
}
