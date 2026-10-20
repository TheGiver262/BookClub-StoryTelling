import { useState, useEffect } from 'react';
import { 
  BookOpen, Search, Filter, Calendar, MapPin, Star,
  ArrowRight, MessageSquare, CheckCircle,
  X, AlertCircle
} from 'lucide-react';
import { formatVND, type Book } from '../data/mockData';
import { apiClient, type PublicApprovedResultDto, type SafePublicActivityDto, type SafePublicReviewDto } from '../lib/api-client';
import ReservationSection from './ReservationSection';

export default function PublicPortal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TẤT CẢ');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<'sach' | 'hoat-dong' | 'review' | 'tuyen' | 'dat-sach' | 'tra-don'>('sach');
  const [reservationBookId, setReservationBookId] = useState<string>('');
  const [publicBooks, setPublicBooks] = useState<Book[]>([]);
  const [bookAvailability, setBookAvailability] = useState<Record<string, number>>({});
  const [bookDeposits, setBookDeposits] = useState<Record<string, number>>({});
  const [publicSchedules, setPublicSchedules] = useState<any[]>([]);
  const [publicActivities, setPublicActivities] = useState<SafePublicActivityDto[]>([]);
  const [publicReviews, setPublicReviews] = useState<SafePublicReviewDto[]>([]);
  const [publicResults, setPublicResults] = useState<PublicApprovedResultDto[]>([]);
  const [publicError, setPublicError] = useState('');
  useEffect(() => {
    let active = true;
    const task = window.setTimeout(() => {
      apiClient.listPublicReservationBooks({ search: searchQuery, limit: 100 }).then(result => {
        if (!active) return;
        setPublicBooks(result.items.map(b => ({ id: b.titleId, title: b.title, authors: [b.author], categories: [b.category], coverImage: b.coverImageUrl,
          publisher: '', publishYear: 0, description: '', coverPrice: null, copies: [] })));
        setBookAvailability(Object.fromEntries(result.items.map(b => [b.titleId, b.availableCopiesCount])));
        setBookDeposits(Object.fromEntries(result.items.map(b => [b.titleId, b.standardDeposit])));
      }).catch(() => { if (active) { setPublicBooks([]); setPublicError('Không tải được danh mục sách. Vui lòng tải lại trang.'); } });
    }, 200);
    return () => { active = false; window.clearTimeout(task); };
  }, [searchQuery]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const results = await Promise.allSettled([apiClient.listPublicPickupSchedules(), apiClient.listPublicActivities(), apiClient.getPublicReviews(), apiClient.getPublicApprovedResults()]);
      if (!active) return;
      if (results[0].status === 'fulfilled') setPublicSchedules(results[0].value);
      if (results[1].status === 'fulfilled') setPublicActivities(results[1].value);
      if (results[2].status === 'fulfilled') setPublicReviews(results[2].value);
      if (results[3].status === 'fulfilled') setPublicResults(results[3].value);
      if (results.some(r => r.status === 'rejected')) setPublicError('Một số nội dung chưa tải được. Vui lòng tải lại trang để thử lại.');
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('public') === '1') return;
    let active = true;
    apiClient.getMe().then(actor => {
      if (active && actor.isActive && (actor.role === 'MEMBER' || actor.role === 'ADMIN') && !actor.isAlumni) window.location.replace('/noi-bo');
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  
  // Real Review submission states (Fixed R10)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewBookId, setReviewBookId] = useState<string>('');
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewErrorMessage, setReviewErrorMessage] = useState('');
  const [reviewSuccessDetail, setReviewSuccessDetail] = useState<{ id: string; message: string } | null>(null);

  // Candidate lookup
  const [candidateQuery, setCandidateQuery] = useState('');

  // Deep linking and URL preservation on mount & refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'sach' || tabParam === 'hoat-dong' || tabParam === 'review' || tabParam === 'tuyen' || tabParam === 'dat-sach' || tabParam === 'tra-don') {
        setActiveTab(tabParam);
      }
      const bookId = params.get('sach');
      if (bookId) {
        setReservationBookId(bookId);
        const found = publicBooks.find(b => b.id === bookId);
        if (found) {
          setSelectedBook(found);
          setReviewBookId(found.id);
        }
      }
      if (window.location.hash.startsWith('#token=')) {
        setActiveTab('tra-don');
      }
    }
  }, []);

  const switchTab = (tab: 'sach' | 'hoat-dong' | 'review' | 'tuyen' | 'dat-sach' | 'tra-don') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState(null, '', url.toString());
    }
  };

  const openBookModal = (book: Book) => {
    setSelectedBook(book);
    setReviewBookId(book.id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('sach', book.id);
      window.history.pushState(null, '', url.toString());
    }
  };

  const closeBookModal = () => {
    setSelectedBook(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('sach');
      window.history.pushState(null, '', url.toString());
    }
  };

  const handleReviewSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setReviewErrorMessage('');
    setReviewSubmitting(true);
    try {
      const res = await apiClient.submitBookReview({
        bookId: reviewBookId,
        authorName: reviewName,
        rating: reviewRating,
        content: reviewContent,
      });
      setReviewSuccessDetail({
        id: res.data.id,
        message: res.message || 'Đánh giá đã được gửi và đang chờ Ban Quản Trị duyệt.',
      });
      setReviewSubmitted(true);
    } catch (err: any) {
      if (err.message && err.message.includes('đăng nhập')) {
        setReviewErrorMessage('Bạn cần có tài khoản/phiên đăng nhập để gửi cảm nhận sách. Vui lòng bấm "Không Gian Nội Bộ" hoặc đăng nhập tài khoản.');
      } else {
        setReviewErrorMessage(err.message || 'Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại.');
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const categories = ['TẤT CẢ', 'Kỹ năng sống', 'Tư duy', 'Công nghệ', 'Văn hóa Bách Khoa', 'Lịch sử', 'Tiểu thuyết'];

  const filteredBooks = publicBooks.filter((b) => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'TẤT CẢ' || b.categories.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const filteredCandidates = publicResults.filter(c => c.candidateCode.toLowerCase().includes(candidateQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/logo-ysbk.png" 
              alt="Logo CLB Yêu Sách Bách Khoa Hà Nội" 
              className="h-10 w-auto object-contain"
            />
            <div>
              <div className="font-bold text-base sm:text-lg text-brand-navy leading-tight">
                CLB Yêu Sách Bách Khoa
              </div>
              <div className="text-xs text-brand-red font-medium tracking-wide">
                Mở sách đọc tương lai!
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
            <button 
              onClick={() => switchTab('sach')}
              className={`hover:text-brand-navy transition ${activeTab === 'sach' ? 'text-brand-navy font-bold border-b-2 border-brand-navy py-5' : ''}`}
            >
              Tra Cứu Sách
            </button>
            <button 
              onClick={() => switchTab('dat-sach')}
              className={`hover:text-brand-navy transition flex items-center gap-1.5 ${activeTab === 'dat-sach' ? 'text-brand-navy font-bold border-b-2 border-brand-navy py-5' : ''}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Đặt Giữ Chỗ
            </button>
            <button 
              onClick={() => switchTab('tra-don')}
              className={`hover:text-brand-navy transition ${activeTab === 'tra-don' ? 'text-brand-navy font-bold border-b-2 border-brand-navy py-5' : ''}`}
            >
              Tra Cứu Đơn
            </button>
            <button 
              onClick={() => switchTab('hoat-dong')}
              className={`hover:text-brand-navy transition ${activeTab === 'hoat-dong' ? 'text-brand-navy font-bold border-b-2 border-brand-navy py-5' : ''}`}
            >
              Lịch Trực & Sự Kiện
            </button>
            <button 
              onClick={() => switchTab('review')}
              className={`hover:text-brand-navy transition ${activeTab === 'review' ? 'text-brand-navy font-bold border-b-2 border-brand-navy py-5' : ''}`}
            >
              Góc Review
            </button>
            <button 
              onClick={() => switchTab('tuyen')}
              className={`hover:text-brand-navy transition ${activeTab === 'tuyen' ? 'text-brand-navy font-bold border-b-2 border-brand-navy py-5' : ''}`}
            >
              Kết Quả Tuyển Gen
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <a 
              href="/noi-bo" 
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md bg-brand-navy text-white hover:bg-brand-navy-hover transition shadow-sm"
            >
              <span>Không Gian Nội Bộ</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto border-t border-slate-100 px-4 py-2 gap-2 text-xs font-semibold bg-white">
          <button 
            onClick={() => switchTab('sach')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${activeTab === 'sach' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Tra Cứu Sách
          </button>
          <button 
            onClick={() => switchTab('dat-sach')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${activeTab === 'dat-sach' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Đặt Giữ Chỗ
          </button>
          <button 
            onClick={() => switchTab('tra-don')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${activeTab === 'tra-don' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Tra Cứu Đơn
          </button>
          <button 
            onClick={() => switchTab('hoat-dong')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${activeTab === 'hoat-dong' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Lịch Trực Bàn
          </button>
          <button 
            onClick={() => switchTab('review')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${activeTab === 'review' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Góc Review
          </button>
          <button 
            onClick={() => switchTab('tuyen')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${activeTab === 'tuyen' ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Kết Quả Tuyển
          </button>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="bg-gradient-to-b from-brand-navy-soft to-slate-50 border-b border-slate-200/60 pt-10 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-red-soft text-brand-red mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Văn hóa đọc sinh viên Bách Khoa
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
            Mở sách đọc tương lai!
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Hệ thống tra cứu sách, lịch trực và quản lý mượn–trả của CLB Yêu Sách Bách Khoa Hà Nội tại Thư viện Tạ Quang Bửu & Văn phòng Hội Sinh viên.
          </p>

          {/* Quick Search Bar */}
          <div className="mt-8 max-w-2xl mx-auto relative shadow-md rounded-lg">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'sach') setActiveTab('sach');
              }}
              placeholder="Tìm theo tên sách, tác giả (ví dụ: Đắc Nhân Tâm, Clean Code...)"
              className="w-full pl-11 pr-4 py-3.5 bg-white rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-brand-navy"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {publicError && <p role="alert" className="mb-4 text-sm text-rose-700">{publicError}</p>}
        
        {/* TAB 1: TRA CỨU SÁCH */}
        {activeTab === 'sach' && (
          <div>
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 pl-1">
                <Filter className="w-3.5 h-3.5" />
                Thể loại:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                    selectedCategory === cat 
                      ? 'bg-brand-navy text-white shadow-sm' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Book Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredBooks.map((book) => {
                const availableCopies = bookAvailability[book.id] || 0;
                const depositAmount = bookDeposits[book.id] || 50000;

                return (
                  <div 
                    key={book.id}
                    onClick={() => openBookModal(book)}
                    className="bg-white rounded-xl border border-slate-200 hover:border-brand-navy/40 hover:shadow-lg transition cursor-pointer flex flex-col overflow-hidden group"
                  >
                    <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                      <img 
                        src={book.coverImage} 
                        alt={book.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        {availableCopies > 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Còn {availableCopies} bản
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                            Đang mượn hết
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {book.categories.map((c, i) => (
                            <span key={i} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-serif font-bold text-slate-900 text-base line-clamp-2 group-hover:text-brand-navy transition">
                          {book.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {book.authors.join(', ')} · {book.publishYear}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400">Tiền cọc quy định</div>
                          <div className="font-bold text-brand-navy tnum">
                            {formatVND(depositAmount)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Giá bìa</div>
                          <div className="font-medium text-slate-700 tnum">
                            {book.coverPrice ? formatVND(book.coverPrice) : 'Chưa có giá'}
                          </div>
                        </div>
                      </div>

                      {availableCopies > 0 && (
                        <div className="mt-3 pt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReservationBookId(book.id);
                              switchTab('dat-sach');
                            }}
                            className="w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Đặt Giữ Chỗ Bản Này
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-semibold text-slate-700">Không tìm thấy sách phù hợp</h4>
                <p className="text-sm text-slate-400 mt-1">Thử tìm kiếm với từ khóa khác hoặc bỏ chọn bộ lọc thể loại.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LỊCH TRỰC BÀN & SỰ KIỆN */}
        {activeTab === 'hoat-dong' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-brand-navy">Lịch Trực Bàn Sách Định Kỳ</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Thời gian đón bạn đọc: Thứ Ba và Thứ Năm, từ 14:00 đến 17:00</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Đang hoạt động
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicSchedules.map((shift) => (
                  <div key={shift.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-brand-navy mb-2">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-brand-red" />
                          {shift.date}
                        </span>
                        <span className="bg-brand-navy/10 px-2 py-0.5 rounded text-[11px]">
                          {shift.timeRange}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-slate-600 mt-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span>{shift.location}</span>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Nhiệm vụ bàn sách:</span> Tiếp nhận mượn–trả, tư vấn đầu sách hay, hoàn tiền cọc trực tiếp.
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-brand-gold-soft/50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Lưu ý về ngày nghỉ lễ/Tết:</span> Nếu ngày đến hạn mượn rơi vào lịch nghỉ lễ/Tết của trường, hạn mượn sẽ được tự động dời tới buổi trực thực tế gần nhất tiếp theo mà không tính phạt bạn đọc.
                </div>
              </div>
            </div>

            {/* Upcoming Club Events */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Sự Kiện & Hoạt Động Lan Tỏa</h2>
              <div className="space-y-4">
                {publicActivities.length === 0 && <p className="text-sm text-slate-500">Chưa có hoạt động được công bố.</p>}
                {publicActivities.map(activity => <article key={activity.id} className="p-4 rounded-lg border border-slate-200">
                  <h3 className="font-bold">{activity.title}</h3><p className="text-xs text-slate-500">{activity.eventDate} · {activity.location}</p>
                  <p className="text-sm mt-2">{activity.description}</p>
                </article>)}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GÓC REVIEW & CẢM NHẬN */}
        {activeTab === 'review' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Cảm Nhận Từ Bạn Đọc</h2>
                <p className="text-xs text-slate-500">Các bài review đã được Ban Biên Tập duyệt và công khai</p>
              </div>
              <button 
                onClick={() => setShowReviewModal(true)}
                className="px-3.5 py-2 text-xs font-semibold rounded-md bg-brand-navy text-white hover:bg-brand-navy-hover transition shadow-sm flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Gửi Cảm Nhận Sách
              </button>
            </div>

            <div className="space-y-4">
              {publicReviews.map((rev) => (
                <div key={rev.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{rev.readerName}</span>
                      <span>·</span>
                      <span className="font-serif italic text-brand-navy">{publicBooks.find(b => b.id === rev.bookId)?.title || 'Cảm nhận sách'}</span>
                    </div>
                    <div className="flex items-center text-amber-500">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-serif">
                    "{rev.content}"
                  </p>
                  <div className="mt-3 text-[11px] text-slate-400">
                    Đăng ngày: {new Date(rev.createdAt).toLocaleDateString('vi-VN')} · Đã duyệt bởi Ban Nội Dung CLB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: KẾT QUẢ TUYỂN GEN */}
        {activeTab === 'tuyen' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-brand-navy mb-1">Tra Cứu Kết Quả Tuyển Thành Viên </h2>
              <p className="text-xs text-slate-500 mb-6">
                Chỉ hiển thị các trường thông tin đã được Ban Chủ Nhiệm phê duyệt công khai. Dữ liệu điểm số và thông tin liên hệ được bảo mật nội bộ.
              </p>

              <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text" 
                  value={candidateQuery}
                  onChange={(e) => setCandidateQuery(e.target.value)}
                  placeholder="Nhập mã hồ sơ tuyển thành viên..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Mã hồ sơ</th>
                      <th className="py-2.5 px-3">Ban trúng tuyển</th>
                      <th className="py-2.5 px-3">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((c) => (
                      <tr key={c.candidateCode} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">{c.candidateCode}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-navy-soft text-brand-navy">
                            {c.passedDepartment}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
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

        {/* TAB 5 & 6: ĐẶT GIỮ CHỖ SÁCH VÀ TRA CỨU ĐƠN (PR-6) */}
        {(activeTab === 'dat-sach' || activeTab === 'tra-don') && (
          <ReservationSection
            initialMode={activeTab === 'tra-don' ? 'lookup' : 'create'}
            initialBookId={reservationBookId}
            onNavigateToTab={(tab) => switchTab(tab as any)}
          />
        )}
      </main>

      {/* Book Detail Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="relative p-6 sm:p-8">
              <button 
                onClick={closeBookModal}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-48 aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden shrink-0 shadow">
                  <img 
                    src={selectedBook.coverImage} 
                    alt={selectedBook.title} 
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedBook.categories.map((c, i) => (
                      <span key={i} className="text-xs font-semibold bg-brand-navy-soft text-brand-navy px-2 py-0.5 rounded-full">
                        {c}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900 leading-tight">
                    {selectedBook.title}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Tác giả: <span className="font-semibold text-slate-800">{selectedBook.authors.join(', ')}</span>
                  </p>
                  {selectedBook.publisher && <p className="text-xs text-slate-500">
                    Nhà xuất bản: {selectedBook.publisher} ({selectedBook.publishYear})
                  </p>}

                  <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400">Giá bìa:</div>
                      <div className="font-bold text-slate-800 tnum">
                        {selectedBook.coverPrice ? formatVND(selectedBook.coverPrice) : 'Chưa có giá'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Tiền cọc quy định:</div>
                      <div className="font-bold text-brand-navy tnum">
                        {formatVND(bookDeposits[selectedBook.id] || 50000)}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-slate-600 leading-relaxed">
                    {selectedBook.description}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-sm text-slate-600">Còn {bookAvailability[selectedBook.id] || 0} bản có thể đặt. Chọn buổi trực ở bước xác nhận.</p>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setReservationBookId(selectedBook.id);
                      closeBookModal();
                      switchTab('dat-sach');
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Đặt Mượn Giữ Chỗ
                  </button>
                  <button 
                    onClick={closeBookModal}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Submission Modal (Fixed R10: Real API submission with moderation pending state) */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-brand-navy">Gửi Đánh Giá / Cảm Nhận Sách</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewSubmitted ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800">Cảm nhận đã được tiếp nhận thành công!</h4>
                <div className="my-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg inline-block text-xs font-mono text-slate-600">
                  Mã ghi nhận: #{reviewSuccessDetail?.id}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  {reviewSuccessDetail?.message || 'Đánh giá đã được lưu vào hàng đợi và sẽ xuất hiện công khai sau khi Ban Quản Trị Nội Dung CLB phê duyệt.'}
                </p>
                <button 
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewSubmitted(false);
                    setReviewContent('');
                    setReviewSuccessDetail(null);
                  }} 
                  className="mt-6 px-4 py-2 text-xs font-semibold bg-brand-navy text-white rounded-lg hover:bg-brand-navy-hover transition"
                >
                  Hoàn tất
                </button>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4 text-xs">
                {reviewErrorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Lưu ý xác thực:</div>
                      <div>{reviewErrorMessage}</div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cuốn sách bạn muốn đánh giá:</label>
                  <select
                    value={reviewBookId}
                    onChange={(e) => setReviewBookId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-navy focus:outline-none bg-white text-xs"
                  >
                    {publicBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} — {b.authors.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ tên bạn đọc:</label>
                  <input 
                    type="text" 
                    required 
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A (K68)..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mức độ đánh giá:</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setReviewRating(s)}
                        className={`p-1 text-amber-500 ${reviewRating >= s ? 'fill-current' : 'opacity-40'}`}
                      >
                        <Star className={`w-5 h-5 ${reviewRating >= s ? 'fill-amber-400' : ''}`} />
                      </button>
                    ))}
                    <span className="text-xs text-slate-500 ml-2">({reviewRating}/5 sao)</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nội dung cảm nhận:</label>
                  <textarea 
                    rows={4}
                    required
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    placeholder="Chia sẻ những góc nhìn tâm đắc hoặc bài học bạn rút ra từ cuốn sách (tối thiểu 10 ký tự)..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                  <span className="font-semibold">Chính sách kiểm duyệt:</span> Bạn đọc cần có phiên đăng nhập hợp lệ để gửi cảm nhận. Mọi nội dung sẽ được kiểm duyệt trước khi công khai nhằm đảm bảo văn hóa đọc văn minh.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    disabled={reviewSubmitting}
                    className="px-4 py-2 rounded-md bg-brand-navy text-white font-semibold hover:bg-brand-navy-hover transition disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Đang gửi kiểm duyệt...' : 'Gửi duyệt cảm nhận'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-10 px-4 sm:px-6 lg:px-8 mt-16 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/assets/logo-ysbk.png" alt="Logo YSBK" className="h-8 w-auto brightness-200" />
              <span className="font-bold text-white text-sm">CLB Yêu Sách Bách Khoa Hà Nội</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Môi trường cho sinh viên hoàn thiện bản thân thông qua sách và các hoạt động văn hóa đọc. Thành lập và hoạt động phi lợi nhuận tại Đại học Bách Khoa Hà Nội.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Địa Điểm & Thời Gian</h4>
            <ul className="space-y-1.5 text-slate-400">
              <li>· Sảnh Thư viện Tạ Quang Bửu, ĐHBK Hà Nội</li>
              <li>· Văn phòng Hội Sinh viên ĐHBK Hà Nội</li>
              <li>· Trực bàn sách: Thứ Ba & Thứ Năm (14:00 – 17:00)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Thông Tin Liên Hệ</h4>
            <p className="text-slate-400 leading-relaxed">
              Email: clbyeusachbachkhoahanoi@gmail.com<br />
              Fanpage: fb.com/CLBYeuSachBachKhoaHaNoi<br />
              Hệ thống thử nghiệm phiên bản v0.11 (Mô phỏng UI Prototype).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
