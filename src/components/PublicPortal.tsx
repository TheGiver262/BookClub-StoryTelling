import {useEffect,useRef,useState} from 'react';
import {BookOpen,Bookmark,Search,Calendar,MapPin,MessageSquare,AlertCircle,ArrowRight,Star} from 'lucide-react';
import {apiClient,type PublicApprovedResultDto,type SafePublicActivityDto,type SafePublicReviewDto} from '../lib/api-client';
import type {PublicReservationBookDto} from '../server/reservations/types';
import {formatVND} from '../data/mockData';
import {startAvailabilityRefresh} from '../lib/availability-refresh';
import {bookIntent,readerLocation,type ReaderTab,type BookPanel} from '../lib/reader-library-navigation';
import {ReaderSessionProvider,useReaderSession} from './ReaderSession';
import ReaderDialog from './ReaderDialog';
import ReaderWorkspace from './ReaderWorkspace';
import '../styles/reader-library.css';

const BOOKS_PER_PAGE=50;
const tabs:{id:ReaderTab;label:string}[]=[{id:'sach',label:'Tủ sách'},{id:'tra-don',label:'Sách của tôi'},{id:'hoat-dong',label:'Lịch trực & sự kiện'},{id:'review',label:'Góc review'},{id:'tuyen',label:'Tuyển thành viên'}];
function ReviewCard({review}:{review:SafePublicReviewDto}){
  return <article className={'reader-review ui-card '+(review.isClubReview?'reader-review-club':'')}>
    <header><strong>{review.readerName}</strong>{review.isClubReview&&<span className="reader-chip"><Bookmark size={14} aria-hidden="true"/>Review CLB · Ghim</span>}<span aria-label={`${review.rating} trên 5 sao`}><Star size={15} aria-hidden="true"/>{review.rating}/5</span></header>
    <p>{review.content}</p><small>{new Date(review.createdAt).toLocaleDateString('vi-VN')} · Đã duyệt</small>
  </article>;
}
export default function PublicPortal(){return <ReaderSessionProvider><LibraryPortal/></ReaderSessionProvider>;}
function LibraryPortal(){
  const {reader,loading:sessionLoading,error:sessionError,requireReader,requestSignIn,refresh:refreshSession}=useReaderSession();
  const [activeTab,setActiveTab]=useState<ReaderTab>('sach');
  const [searchQuery,setSearchQuery]=useState(''),[selectedCategory,setSelectedCategory]=useState(''),[onlyAvailable,setOnlyAvailable]=useState(false),[bookPage,setBookPage]=useState(1);
  const [books,setBooks]=useState<PublicReservationBookDto[]>([]),[bookTotal,setBookTotal]=useState(0),[categories,setCategories]=useState<string[]>([]),[booksLoading,setBooksLoading]=useState(true),[bookError,setBookError]=useState('');
  const [bookmarks,setBookmarks]=useState<Set<string>>(new Set()),[bookmarkBusy,setBookmarkBusy]=useState(''),[revision,setRevision]=useState(0);
  const [focusedBook,setFocusedBook]=useState<PublicReservationBookDto|null>(null),[panel,setPanel]=useState<Exclude<BookPanel,'bookmark'>|null>(null);
  const [bookReviews,setBookReviews]=useState<SafePublicReviewDto[]>([]),[reviewPage,setReviewPage]=useState(1),[reviewsLoading,setReviewsLoading]=useState(false),[reviewsMore,setReviewsMore]=useState(false),[reviewsError,setReviewsError]=useState('');
  const [reviewRating,setReviewRating]=useState(5),[reviewContent,setReviewContent]=useState(''),[reviewSubmitting,setReviewSubmitting]=useState(false),[reviewSubmitted,setReviewSubmitted]=useState(false);
  const [publicSchedules,setPublicSchedules]=useState<any[]>([]),[publicHolidays,setPublicHolidays]=useState<Awaited<ReturnType<typeof apiClient.getCalendarHolidays>>>([]);
  const [publicActivities,setPublicActivities]=useState<SafePublicActivityDto[]>([]),[publicReviews,setPublicReviews]=useState<SafePublicReviewDto[]>([]),[publicResults,setPublicResults]=useState<PublicApprovedResultDto[]>([]);
  const [recruitmentNotice,setRecruitmentNotice]=useState<any>(null),[publicError,setPublicError]=useState(''),[candidateQuery,setCandidateQuery]=useState('');
  const [publicReviewPage,setPublicReviewPage]=useState(1),[publicReviewMore,setPublicReviewMore]=useState(false);
  const [publicReviewBusy,setPublicReviewBusy]=useState(false);
  const locationInitialized=useRef(false);
  const focusedBookRef=useRef(focusedBook);focusedBookRef.current=focusedBook;
  const panelRef=useRef(panel);panelRef.current=panel;
  const reviewSessionRef=useRef(0);
  const bookLookupRef=useRef(0);
  const filteredCandidates=publicResults.filter(c=>c.candidateCode.toLowerCase().includes(candidateQuery.toLowerCase()));

  useEffect(()=>{
    let active=true;setBookmarks(new Set());
    if(reader) void apiClient.listReaderBookmarks().then(rows=>{if(active) setBookmarks(new Set(rows.map(row=>row.titleId)));}).catch(e=>{if(active) setBookError(e.message);});
    return()=>{active=false;};
  },[reader?.id]);
  useEffect(()=>{
    if(activeTab!=='sach') return;
    let active=true,busy=false;
    const refresh=async()=>{if(busy) return;busy=true;try{
      const result=await apiClient.listPublicReservationBooks({search:searchQuery,category:selectedCategory||undefined,page:bookPage,limit:BOOKS_PER_PAGE,includeUnavailable:true,onlyAvailable});
      if(!active) return;setBooks(result.items);setBookTotal(result.total);setCategories(result.categories||[]);setBookError('');
      if(bookPage>Math.max(1,Math.ceil(result.total/BOOKS_PER_PAGE))) setBookPage(1);
    }catch(e:any){if(active){setBooks([]);setBookError(e.message||'Không tải được Tủ sách.');}}
    finally{busy=false;if(active) setBooksLoading(false);}};
    setBooksLoading(true);const timeout=window.setTimeout(()=>void refresh(),200),stop=startAvailabilityRefresh(refresh);
    return()=>{active=false;window.clearTimeout(timeout);stop();};
  },[activeTab,searchQuery,selectedCategory,onlyAvailable,bookPage,reader?.id,revision]);
  useEffect(()=>{
    let active=true;
    void Promise.allSettled([apiClient.listPublicPickupSchedules(),apiClient.listPublicActivities(),apiClient.getPublicReviews(),apiClient.getPublicApprovedResults(),apiClient.getPublicRecruitmentNotice(),apiClient.getCalendarHolidays()]).then(results=>{
      if(!active) return;
      if(results[0].status==='fulfilled') setPublicSchedules(results[0].value);
      if(results[1].status==='fulfilled') setPublicActivities(results[1].value);
      if(results[2].status==='fulfilled'){setPublicReviews(results[2].value);setPublicReviewMore(results[2].value.length===50);}
      if(results[3].status==='fulfilled') setPublicResults(results[3].value);
      if(results[4].status==='fulfilled') setRecruitmentNotice(results[4].value);
      if(results[5].status==='fulfilled') setPublicHolidays(results[5].value);
      if(results.some(result=>result.status==='rejected')) setPublicError('Một số nội dung chưa tải được. Vui lòng thử tải lại.');
    });return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(sessionLoading) return;
    let active=true;
    const sync=async()=>{
      const lookup=++bookLookupRef.current;
      reviewSessionRef.current++;
      const location=readerLocation(new URL(window.location.href));setActiveTab(location.tab);setPanel(null);
      if(!location.bookId||location.tab!=='sach') return;
      try{
        const result=await apiClient.listPublicReservationBooks({search:location.bookId,includeUnavailable:true,limit:1});
        const book=result.items.find(book=>book.titleId===location.bookId);if(!active||lookup!==bookLookupRef.current) return;
        if(book) openPanel(book,location.panel,false);else setBookError('Không tìm thấy cuốn sách từ liên kết.');
      }catch(e:any){if(active&&lookup===bookLookupRef.current) setBookError(e.message);}
    };
    // Chỉ khôi phục ý định URL khi vào trang, tránh mở lại dialog phía dưới lúc phiên vừa hết.
    if(!locationInitialized.current) void sync().then(()=>{if(active) locationInitialized.current=true;});
    window.addEventListener('popstate',sync);
    return()=>{active=false;bookLookupRef.current++;window.removeEventListener('popstate',sync);};
  },[sessionLoading,reader?.id]);
  useEffect(()=>{
    if(!reader&&(panel==='reserve'||panel==='write')) setPanel(null);
  },[reader?.id,panel]);
  useEffect(()=>{
    if(!focusedBook||!panel) return;
    let active=true;const id=focusedBook.titleId;
    const stop=startAvailabilityRefresh(async()=>{try{const result=await apiClient.listPublicReservationBooks({search:id,includeUnavailable:true,limit:1});const book=result.items.find(book=>book.titleId===id);if(active&&book) setFocusedBook(book);}catch{/* Existing stock remains indicative; reservation always rechecks on server. */}});
    return()=>{active=false;stop();};
  },[focusedBook?.titleId,!!panel]);
  useEffect(()=>{
    if(panel!=='reviews'||!focusedBook) return;
    const session=++reviewSessionRef.current;
    let active=true;setReviewsLoading(true);setReviewsError('');
    const id=focusedBook.titleId;
    void apiClient.getPublicReviews(id,1).then(rows=>{
      if(active&&reviewSessionRef.current===session&&panelRef.current==='reviews'&&focusedBookRef.current?.titleId===id){
        setBookReviews(rows);
        setReviewPage(1);
        setReviewsMore(rows.length===50);
      }
    }).catch(e=>{
      if(active&&reviewSessionRef.current===session&&panelRef.current==='reviews'&&focusedBookRef.current?.titleId===id) setReviewsError(e.message);
    }).finally(()=>{
      if(active&&reviewSessionRef.current===session&&panelRef.current==='reviews'&&focusedBookRef.current?.titleId===id) setReviewsLoading(false);
    });
    return()=>{active=false;reviewSessionRef.current++;};
  },[panel,focusedBook?.titleId]);
  function switchTab(tab:ReaderTab){
    bookLookupRef.current++;
    if(tab==='tra-don'&&!requireReader('/sach/?tab=tra-don')) return;
    reviewSessionRef.current++;
    setActiveTab(tab);setPanel(null);window.history.pushState(null,'','/sach/?tab='+tab);
  }
  function openPanel(book:PublicReservationBookDto,target:BookPanel,history=true){
    bookLookupRef.current++;
    reviewSessionRef.current++;
    setFocusedBook(book);setReviewSubmitted(false);setReviewsError('');
    if((target==='reserve'||target==='write'||target==='bookmark')&&!requireReader(bookIntent(target,book.titleId))){setPanel(null);return;}
    if(target==='bookmark'){
      void toggleBookmark(book,true);window.history.replaceState(null,'',bookIntent('detail',book.titleId));return;
    }
    if(target==='reviews'){setReviewPage(1);setBookReviews([]);}
    if(target==='write'){setReviewContent('');setReviewRating(5);}
    setPanel(target);if(history) window.history.pushState(null,'',bookIntent(target,book.titleId));
  }
  function closePanel(){
    bookLookupRef.current++;
    reviewSessionRef.current++;
    setPanel(null);window.history.replaceState(null,'','/sach/?tab='+activeTab);
  }
  async function toggleBookmark(book:PublicReservationBookDto,force?:boolean){
    if(!requireReader(bookIntent('bookmark',book.titleId))) return;
    setBookmarkBusy(book.titleId);setBookError('');
    try{
      const result=await apiClient.setReaderBookmark(book.titleId,force??!bookmarks.has(book.titleId));
      setBookmarks(previous=>{const copy=new Set(previous);if(result.bookmarked) copy.add(book.titleId);else copy.delete(book.titleId);return copy;});if(!selectedCategory) setBookPage(1);setRevision(value=>value+1);
    }catch(e:any){setBookError(e.message);if(e.status===401){void refreshSession();requestSignIn(bookIntent('bookmark',book.titleId));}}
    finally{setBookmarkBusy('');}
  }
  async function openReviewBook(id:string){
    const lookup=++bookLookupRef.current;
    try{
      const result=await apiClient.listPublicReservationBooks({search:id,includeUnavailable:true,limit:1});
      if(lookup!==bookLookupRef.current) return;
      const book=result.items.find(book=>book.titleId===id);
      if(book) openPanel(book,'reviews');else setPublicError('Không tìm thấy sách.');
    }catch(e:any){if(lookup===bookLookupRef.current) setPublicError(e.message);}
  }
  async function submitReview(event:React.SubmitEvent){
    event.preventDefault();if(!focusedBook||!reader||!requireReader(bookIntent('write',focusedBook.titleId))) return;
    setReviewSubmitting(true);setReviewsError('');
    try{await apiClient.submitBookReview({bookId:focusedBook.titleId,authorName:reader.fullName,rating:reviewRating,content:reviewContent});setReviewSubmitted(true);}
    catch(e:any){setReviewsError(e.message);if(e.status===401){setPanel(null);void refreshSession();requestSignIn(bookIntent('write',focusedBook.titleId));}}
    finally{setReviewSubmitting(false);}
  }
  async function morePublicReviews(){
    if(publicReviewBusy) return;setPublicReviewBusy(true);
    try{const rows=await apiClient.getPublicReviews(undefined,publicReviewPage+1);setPublicReviews(previous=>[...previous,...rows.filter(row=>!previous.some(old=>old.id===row.id))]);setPublicReviewPage(value=>value+1);setPublicReviewMore(rows.length===50);}catch(e:any){setPublicError(e.message);}finally{setPublicReviewBusy(false);}
  }
  async function moreBookReviews(){
    if(!focusedBook||reviewsLoading||panel!=='reviews') return;
    const session=reviewSessionRef.current;
    const id=focusedBook.titleId;
    const targetPage=bookReviews.length===0?1:reviewPage+1;
    setReviewsLoading(true);setReviewsError('');
    try{
      const rows=await apiClient.getPublicReviews(id,targetPage);
      if(reviewSessionRef.current===session&&panelRef.current==='reviews'&&focusedBookRef.current?.titleId===id){
        setBookReviews(previous=>targetPage===1?rows:[...previous,...rows.filter(row=>!previous.some(old=>old.id===row.id))]);
        setReviewPage(targetPage);
        setReviewsMore(rows.length===50);
      }
    }catch(e:any){
      if(reviewSessionRef.current===session&&panelRef.current==='reviews'&&focusedBookRef.current?.titleId===id) setReviewsError(e.message);
    }finally{
      if(reviewSessionRef.current===session&&panelRef.current==='reviews'&&focusedBookRef.current?.titleId===id) setReviewsLoading(false);
    }
  }
  const actions=(book:PublicReservationBookDto)=><div className="reader-book-actions">
    <button className="ui-btn ui-btn-primary" disabled={sessionLoading||book.availableCopiesCount===0} onClick={()=>openPanel(book,'reserve')}><BookOpen size={16} aria-hidden="true"/>{book.availableCopiesCount>0?'Đặt giữ chỗ':'Chưa có bản để đặt'}</button>
    <button className="ui-btn ui-btn-secondary" aria-pressed={!!reader&&bookmarks.has(book.titleId)} disabled={sessionLoading||!!bookmarkBusy} onClick={()=>void toggleBookmark(book)}><Bookmark size={16} aria-hidden="true" fill={reader&&bookmarks.has(book.titleId)?'currentColor':'none'}/>{bookmarkBusy===book.titleId?'Đang lưu…':reader&&bookmarks.has(book.titleId)?'Bỏ đánh dấu':'Đánh dấu sách'}</button>
  </div>;
  return <div className="reader-portal">
    <header className="reader-header"><a className="reader-brand" href="/"><img src="/book/assets/club-logo-v8.svg" alt="" width="52" height="52"/><span>Câu lạc bộ Yêu Sách<br/>Bách Khoa Hà Nội<small>Mở sách, đọc tương lai</small></span></a>
      <button className="ui-btn ui-btn-primary reader-account-button" disabled={sessionLoading} onClick={()=>reader?switchTab('tra-don'):requestSignIn()}>{reader?'Tài khoản bạn đọc':'Đăng nhập'}</button>
    </header>
    <nav className="reader-tabs" aria-label="Cổng bạn đọc">{tabs.map(tab=><button key={tab.id} disabled={tab.id==='tra-don'&&sessionLoading} aria-current={activeTab===tab.id?'page':undefined} onClick={()=>switchTab(tab.id)}>{tab.label}</button>)}</nav>
    <main className="reader-main">
      {(publicError||sessionError)&&<p role="alert" className="reader-notice">{publicError||sessionError}</p>}
      {bookError&&<p role="alert" className="reader-notice">{bookError} <button className="ui-btn ui-btn-ghost" onClick={()=>setRevision(value=>value+1)}>Thử lại</button></p>}
      {activeTab==='sach'&&<>
        <section className="reader-intro"><div><span className="reader-eyebrow">Tủ sách CLB · Phòng đọc mở</span><h1>Bạn muốn mang câu chuyện nào về nhà?</h1><p>Một cuốn sách hay, một người bạn mới. Tìm câu chuyện tiếp theo của bạn tại đây.</p></div><aside className="ui-card"><BookOpen size={28} aria-hidden="true"/><div><strong>Mượn sách miễn phí</strong><p>Tủ sách chung được sinh viên Bách Khoa gìn giữ. Đăng nhập để đặt trước và nhận sách tại buổi trực.</p><a href="/sach/?tab=hoat-dong" onClick={event=>{event.preventDefault();switchTab('hoat-dong');}}>Xem lịch trực <ArrowRight size={16} aria-hidden="true"/></a></div></aside></section>
        <div className="reader-catalog-layout"><aside className="reader-category ui-card"><span className="reader-eyebrow">Mục lục kệ sách</span><h2>Phân loại tủ sách</h2><button aria-pressed={!selectedCategory} onClick={()=>{setSelectedCategory('');setBookPage(1);}}>Tất cả</button>{categories.map(category=><button key={category} aria-pressed={selectedCategory===category} onClick={()=>{setSelectedCategory(category);setBookPage(1);}}>{category}</button>)}<p>Sách bạn đánh dấu luôn ở đầu mục Tất cả.</p></aside>
          <section className="reader-catalog" aria-label="Danh mục sách"><div className="reader-search ui-card"><label><Search size={20} aria-hidden="true"/><input aria-label="Tìm sách, tác giả" placeholder="Nhập tên sách hoặc tác giả…" value={searchQuery} onChange={event=>{setSearchQuery(event.target.value);setBookPage(1);}}/></label><div className="reader-filter-row"><label className="reader-mobile-category">Thể loại<select className="ui-input" value={selectedCategory} onChange={event=>{setSelectedCategory(event.target.value);setBookPage(1);}}><option value="">Tất cả</option>{categories.map(category=><option key={category}>{category}</option>)}</select></label><label><input type="checkbox" checked={onlyAvailable} onChange={event=>{setOnlyAvailable(event.target.checked);setBookPage(1);}}/>Chỉ sách còn có thể đặt</label><span>{bookTotal} đầu sách</span></div></div>
            {booksLoading&&<p role="status" className="reader-loading">Đang cập nhật Tủ sách…</p>}
            <div className="reader-book-grid" aria-busy={booksLoading}>{books.map(book=><article key={book.titleId} className="reader-book ui-card">
              <button className="reader-book-cover" aria-label={'Xem tóm tắt '+book.title} onClick={()=>openPanel(book,'detail')}><img src={book.coverImageUrl||'/book/assets/club-logo-v8.svg'} alt={book.title} loading="lazy" decoding="async"/>{reader&&bookmarks.has(book.titleId)&&<span className={'reader-bookmark '+(book.availableCopiesCount>0?'is-available':'is-unavailable')} role="img" aria-label={'Đã đánh dấu · '+(book.availableCopiesCount>0?'Còn bản để đặt':'Hết bản để đặt')}><Bookmark fill="currentColor" strokeWidth={1.3} size={32}/></span>}</button>
              <div className="reader-book-body"><span className="reader-book-category">{book.category||'Tủ sách CLB'}</span><h3><button onClick={()=>openPanel(book,'detail')}>{book.title}</button></h3><p>{book.author||'Đang bổ sung tác giả'}</p><span className={'reader-stock '+(book.availableCopiesCount>0?'is-available':'is-unavailable')}>{book.availableCopiesCount>0?`Còn ${book.availableCopiesCount} bản`:'Hết bản để đặt'}</span><div className="reader-deposit"><span>Cọc dự kiến</span><strong>{formatVND(book.standardDeposit)}</strong></div>{actions(book)}</div>
            </article>)}</div>
            {!booksLoading&&!books.length&&<div className="reader-empty ui-card"><BookOpen size={36}/><h2>{bookError?'Tủ sách chưa tải được':'Chưa tìm thấy cuốn sách phù hợp'}</h2><p>Thử một từ khóa khác hoặc bỏ bộ lọc.</p></div>}
            <div className="reader-pagination"><button className="ui-btn ui-btn-secondary" disabled={bookPage===1||booksLoading} onClick={()=>setBookPage(value=>value-1)}>Trang trước</button><span>Trang {bookPage}/{Math.max(1,Math.ceil(bookTotal/BOOKS_PER_PAGE))}</span><button className="ui-btn ui-btn-secondary" disabled={bookPage*BOOKS_PER_PAGE>=bookTotal||booksLoading} onClick={()=>setBookPage(value=>value+1)}>Trang sau</button></div>
          </section></div>
      </>}
      {activeTab==='tra-don'&&<ReaderWorkspace initialMode="lookup"/>}
        {/* TAB 2: LỊCH TRỰC BÀN & SỰ KIỆN */}
        {activeTab === 'hoat-dong' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-[0_5px_18px_rgba(53,72,60,0.08)]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#DCDED0]">
                <div>
                  <h2 className="text-xl font-serif font-bold text-[#365E4B]">Lịch Trực Bàn Sách Định Kỳ</h2>
                  <p className="text-xs text-[#64705C] mt-0.5">Thời gian đón bạn đọc: Thứ Ba và Thứ Năm, từ 14:00 đến 17:00</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8EDDF] text-[#365E4B] border border-[#365E4B]/30">
                  Đang hoạt động
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicSchedules.map((shift) => (
                  <div key={shift.id} className="p-4 rounded-[14px] bg-[#F8F3E7] border border-[#DCDED0] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-[#365E4B] mb-2">
                        <span className="flex items-center gap-1.5 font-bold">
                          <Calendar className="w-4 h-4 text-[#9B4D36]" />
                          {shift.date}
                        </span>
                        <span className="bg-[#E8EDDF] text-[#365E4B] px-2.5 py-0.5 rounded-full text-[11px] font-mono">
                          {shift.timeRange}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-[#35483C] mt-2">
                        <MapPin className="w-3.5 h-3.5 text-[#64705C] mt-0.5 shrink-0" />
                        <span>{shift.location}</span>
                      </div>
                      <div className="mt-3 text-xs text-[#64705C]">
                        <span className="font-medium text-[#35483C]">Nhiệm vụ bàn sách:</span> Tiếp nhận mượn–trả, tư vấn đầu sách hay, hoàn tiền cọc trực tiếp.
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {publicHolidays.length>0 && <div className="mt-4 rounded-[14px] bg-[#F4EAD2]/80 border border-[#A87A4C]/30 p-4 text-sm text-[#35483C]"><h3 className="font-serif font-bold text-[#A87A4C] mb-2">Lịch nghỉ</h3>{publicHolidays.map(day=><p key={day.holidayDate} className="text-xs">{day.holidayDate} · {day.name}</p>)}</div>}

              <div className="mt-4 p-3.5 bg-[#F4EAD2]/60 rounded-[14px] border border-[#A87A4C]/30 text-xs text-[#35483C] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#A87A4C] mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-[#A87A4C]">Lưu ý về ngày nghỉ lễ/Tết:</span> Nếu ngày đến hạn mượn rơi vào lịch nghỉ lễ/Tết của trường, hạn mượn sẽ được tự động dời tới buổi trực thực tế gần nhất tiếp theo mà không tính phạt bạn đọc.
                </div>
              </div>
            </div>

            {/* Upcoming Club Events */}
            <div className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-[0_5px_18px_rgba(53,72,60,0.08)]">
              <h2 className="text-xl font-serif font-bold text-[#35483C] mb-4">Sự Kiện & Hoạt Động Lan Tỏa</h2>
              <div className="space-y-4">
                {publicActivities.length === 0 && <p className="text-sm text-[#64705C]">Chưa có hoạt động được công bố.</p>}
                {publicActivities.map(activity => <article key={activity.id} className="p-4 rounded-[14px] border border-[#DCDED0] bg-[#F8F3E7]">
                  <h3 className="font-serif font-bold text-[#35483C] text-base">{activity.title}</h3><p className="text-xs text-[#64705C] mt-0.5">{activity.eventDate} · {activity.location}</p>
              <p className="text-sm text-[#35483C] mt-2 whitespace-pre-line leading-relaxed">{activity.description}</p>
                </article>)}
              </div>
            </div>
          </div>
        )}

      {activeTab==='review'&&<section className="reader-community"><div className="reader-section-heading"><div><span className="reader-eyebrow">Những trang sách còn ở lại</span><h1>Góc review</h1><p>Cảm nhận đã được duyệt. Các bài viết của CLB được ghim lên đầu.</p></div><button className="ui-btn ui-btn-secondary" onClick={()=>switchTab('sach')}>Chọn sách để viết nhận xét</button></div>{publicReviews.length===0&&<p className="reader-empty ui-card">Chưa có review được công bố.</p>}{publicReviews.map(review=><div key={review.id}><button className="reader-review-book-link" onClick={()=>void openReviewBook(review.bookId)}>Xem cuốn sách & các đánh giá <ArrowRight size={16}/></button><ReviewCard review={review}/></div>)}{publicReviewMore&&<button className="ui-btn ui-btn-secondary" disabled={publicReviewBusy} onClick={()=>void morePublicReviews()}>Xem thêm review</button>}</section>}
        {/* TAB 4: KẾT QUẢ TUYỂN GEN */}
        {activeTab === 'tuyen' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {recruitmentNotice && <article className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-[0_5px_18px_rgba(53,72,60,0.08)] space-y-4">
              {recruitmentNotice.image && <img src={recruitmentNotice.image} alt={recruitmentNotice.title} className="w-full max-h-96 object-contain rounded-[14px]"/>}
              <h2 className="font-serif text-2xl font-bold text-[#365E4B]">{recruitmentNotice.title}</h2>
              <p className="text-sm text-[#35483C] whitespace-pre-line leading-relaxed">{recruitmentNotice.description}</p>
              {recruitmentNotice.status==='OPEN' && recruitmentNotice.formUrl ? <a href={recruitmentNotice.formUrl} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-primary rounded-[14px] inline-flex text-white px-5 py-2.5 text-xs font-semibold">Đăng ký tham gia</a> : <p className="text-sm text-[#64705C]">Đợt tuyển đã đóng đơn.</p>}
            </article>}
            <div className="bg-[#FFFDF5] p-6 rounded-[22px] border border-[#DCDED0] shadow-[0_5px_18px_rgba(53,72,60,0.08)]">
              <h2 className="text-xl font-serif font-bold text-[#365E4B] mb-1">Tra Cứu Kết Quả Tuyển Thành Viên</h2>
              <p className="text-xs text-[#64705C] mb-6">
                Chỉ hiển thị các trường thông tin đã được Ban Chủ Nhiệm phê duyệt công khai. Dữ liệu điểm số và thông tin liên hệ được bảo mật nội bộ.
              </p>

              <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#64705C]" />
                <input 
                  type="text" 
                  value={candidateQuery}
                  onChange={(e) => setCandidateQuery(e.target.value)}
                  placeholder="Nhập mã hồ sơ tuyển thành viên..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#F8F3E7] rounded-[14px] border border-[#DCDED0] text-[#35483C] focus:outline-none focus:border-[#365E4B] min-h-[44px]"
                />
              </div>

              <div className="overflow-x-auto rounded-[14px] border border-[#DCDED0]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F3E7] border-b border-[#DCDED0] text-[#64705C] font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Mã hồ sơ</th>
                      <th className="py-2.5 px-3">Ban trúng tuyển</th>
                      <th className="py-2.5 px-3">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCDED0]">
                    {filteredCandidates.map((c) => (
                      <tr key={c.candidateCode} className="hover:bg-[#F8F3E7]/80">
                        <td className="py-3 px-3 font-mono font-medium text-[#35483C]">{c.candidateCode}</td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDDF] text-[#365E4B]">
                            {c.passedDepartment}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8EDDF] text-[#365E4B]">
                            Trúng tuyển
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

    </main>
    <footer className="reader-footer"><span>Câu lạc bộ Yêu Sách Bách Khoa Hà Nội</span><a href="/">Về cuốn sách của chúng mình <ArrowRight size={16}/></a></footer>
    {focusedBook&&panel&&<ReaderDialog title={panel==='reserve'?'Đặt giữ chỗ':panel==='reviews'?'Đánh giá sách':panel==='write'?'Viết nhận xét':'Một cuốn sách, một thế giới'} onClose={closePanel}>
      {panel==='detail'?<><div className="reader-book-detail"><img src={focusedBook.coverImageUrl||'/book/assets/club-logo-v8.svg'} alt={focusedBook.title}/><div><span className="reader-eyebrow">{focusedBook.category||'Tủ sách CLB'}</span><h3>{focusedBook.title}</h3><p>{focusedBook.author||'Đang bổ sung tác giả'}</p><span className="reader-chip">{focusedBook.availableCopiesCount>0?`Còn ${focusedBook.availableCopiesCount} bản`:'Hết bản để đặt'}</span><p>Cọc dự kiến: <strong>{formatVND(focusedBook.standardDeposit)}</strong></p></div></div><div className="reader-summary"><h3>Tóm tắt cuốn sách</h3><p>{focusedBook.description||'CLB đang bổ sung phần tóm tắt cho cuốn sách này.'}</p></div>{actions(focusedBook)}<button className="ui-btn ui-btn-secondary reader-wide" onClick={()=>openPanel(focusedBook,'reviews')}><MessageSquare size={17}/>Đánh giá sách</button></>:
      panel==='reserve'?<><p className="reader-eyebrow">Cuốn sách bạn chọn</p><h3 className="reader-modal-book-title">{focusedBook.title}</h3><ReaderWorkspace initialMode="create" initialBookId={focusedBook.titleId}/></>:
      panel==='reviews'?<><div className="reader-book-review-heading"><img src={focusedBook.coverImageUrl||'/book/assets/club-logo-v8.svg'} alt=""/><div><h3>{focusedBook.title}</h3><p>{focusedBook.author}</p><button className="ui-btn ui-btn-primary" disabled={sessionLoading} onClick={()=>openPanel(focusedBook,'write')}>Viết nhận xét</button></div></div><p className="reader-review-rule">Review CLB ghim trước · Chỉ hiển thị nội dung đã duyệt.</p>{bookReviews.map(review=><ReviewCard key={review.id} review={review}/>)}{!reviewsLoading&&!reviewsError&&!bookReviews.length&&<p className="reader-empty">Chưa có review cho cuốn sách này. Hãy chia sẻ cảm nhận đầu tiên.</p>}{reviewsError&&<p role="alert" className="reader-notice">{reviewsError}</p>}{reviewsLoading?<p role="status">Đang tải review…</p>:(reviewsMore || (!bookReviews.length && reviewsError))&&<button className="ui-btn ui-btn-secondary" onClick={()=>void moreBookReviews()}>{!bookReviews.length && reviewsError ? 'Thử lại tải đánh giá' : 'Xem thêm đánh giá'}</button>}</>:
      <><h3 className="reader-modal-book-title">{focusedBook.title}</h3>{reviewSubmitted?<div role="status" className="reader-empty"><BookOpen size={36}/><h3>Cảm ơn bạn đã chia sẻ</h3><p>Nhận xét đang chờ quản trị viên duyệt và chưa xuất hiện công khai.</p><button className="ui-btn ui-btn-secondary" onClick={()=>openPanel(focusedBook,'reviews')}>Về đánh giá cuốn sách</button></div>:<form className="reader-review-form" onSubmit={submitReview}><p>Viết dưới tên <strong>{reader?.fullName}</strong>. Chỉ chữ, không ảnh hay tệp đính kèm; nhận xét sẽ chờ duyệt.</p><label>Đánh giá của bạn<select className="ui-input" value={reviewRating} onChange={event=>setReviewRating(Number(event.target.value))}>{[5,4,3,2,1].map(rating=><option key={rating} value={rating}>{rating} sao</option>)}</select></label><label>Cảm nhận về cuốn sách<textarea className="ui-input" required minLength={10} maxLength={3000} rows={7} value={reviewContent} onChange={event=>setReviewContent(event.target.value)} placeholder="Điều gì ở cuốn sách khiến bạn nhớ mãi?"/></label><small>{reviewContent.length}/3000 ký tự</small>{reviewsError&&<p role="alert" className="reader-notice">{reviewsError}</p>}<button disabled={reviewSubmitting} className="ui-btn ui-btn-primary">{reviewSubmitting?'Đang gửi…':'Gửi nhận xét chờ duyệt'}</button></form>}</>}
    </ReaderDialog>}
  </div>;
}
