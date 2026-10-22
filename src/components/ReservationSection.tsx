import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, CheckCircle2, AlertCircle,
  XCircle, RefreshCw, AlertTriangle, Minus, Plus, ShieldCheck
} from 'lucide-react';
import { apiClient,type ReaderProfile } from '../lib/api-client';
import { startAvailabilityRefresh } from '../lib/availability-refresh';
import { getReservationIntent, clearReservationIntent } from '../lib/reservation-intent';
import type { PublicReservationBookDto, PublicPickupScheduleDto, PublicReservationDto } from '../server/reservations/types';
import { formatVND } from '../data/mockData';

interface ReservationSectionProps {
  compact?:boolean;
  reader?: ReaderProfile;
  initialBookId?: string;
}

export default function ReservationSection({ initialBookId,reader,compact=false }: ReservationSectionProps) {

  // Form State
  const [books, setBooks] = useState<PublicReservationBookDto[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const metadataRequestRef = useRef(0);
  const [schedules, setSchedules] = useState<PublicPickupScheduleDto[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const [selectedBookId, setSelectedBookId] = useState<string>(initialBookId || '');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [fullName, setFullName] = useState(reader?.fullName||'');
  const [phone, setPhone] = useState(reader?.phone||'');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState(reader?.email||'');
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Turnstile CAPTCHA State (PRF-01, PRF-07)
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaWidgetId, setCaptchaWidgetId] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] = useState<'idle' | 'loading' | 'ready' | 'verified' | 'error' | 'unavailable'>('idle');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  // Idempotency Action Key (PRF-09)

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdReservation, setCreatedReservation] = useState<{
    code: string;
    reservation: PublicReservationDto;
    reservations: PublicReservationDto[];
  } | null>(null);

  // Sinh actionKey mới khi thay đổi thông tin đặt sách cốt lõi (PRF-09)
  const renewActionKey = () => {
    clearReservationIntent();
  };

  // Load books & schedules on mount (PRF-07: không giả dữ liệu)
  useEffect(() => {
    if (createdReservation) return;
    setIsLoadingMetadata(true);
    const task = window.setTimeout(() => void loadMetadata(), 250);
    const stop = startAvailabilityRefresh(() => loadMetadata(true));
    return () => { window.clearTimeout(task); stop(); metadataRequestRef.current++; };
  }, [initialBookId, bookSearch, createdReservation]);

  // Update selected book if prop changes
  useEffect(() => {
    if (initialBookId) {
      setSelectedBookId(initialBookId);
    }
  }, [initialBookId]);

  // Load and initialize Cloudflare Turnstile widget (PRF-01, PRF-07)
  useEffect(() => {
    if (createdReservation) return;

    let isMounted = true;
    let renderedWidgetId: string | null = null;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let pollTimeoutId: ReturnType<typeof setTimeout> | undefined;
    setCaptchaToken('');
    setCaptchaStatus('loading');

    const initTurnstile = () => {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      if (!win) return;

      const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
      if (!siteKey) { setCaptchaStatus('unavailable'); return; }

      if (win.turnstile && turnstileContainerRef.current) {
        try {
          if (renderedWidgetId) {
            win.turnstile.remove(renderedWidgetId);
          }
          const widgetId = win.turnstile.render(turnstileContainerRef.current, {
            sitekey: siteKey,
            action: 'reservation',
            theme: 'light',
            callback: (token: string) => {
              if (isMounted) {
                setCaptchaToken(token);
                setCaptchaStatus('verified');
              }
            },
            'error-callback': () => {
              if (isMounted) {
                setCaptchaToken('');
                setCaptchaStatus('error');
              }
            },
            'expired-callback': () => {
              if (isMounted) {
                setCaptchaToken('');
                setCaptchaStatus('ready');
              }
            },
          });
          renderedWidgetId = widgetId;
          if (isMounted) {
            setCaptchaWidgetId(widgetId);
            setCaptchaStatus('ready');
          }
        } catch {
          if (isMounted) setCaptchaStatus('error');
        }
      } else {
        // Tự động nhúng script Turnstile nếu chưa có
        const existingScript = document.getElementById('cf-turnstile-script');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'cf-turnstile-script';
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            if (isMounted) initTurnstile();
          };
          script.onerror = () => {
            if (isMounted) setCaptchaStatus('unavailable');
          };
          document.head.appendChild(script);
        } else {
          // Chờ script tải xong
          pollId = setInterval(() => {
            if ((window as any).turnstile) {
              clearInterval(pollId);
              if (isMounted) initTurnstile();
            }
          }, 200);
          pollTimeoutId = setTimeout(() => {
            clearInterval(pollId);
            if (isMounted && !(window as any).turnstile) setCaptchaStatus('unavailable');
          }, 5000);
        }
      }
    };

    initTurnstile();

    return () => {
      isMounted = false;
      clearInterval(pollId);
      clearTimeout(pollTimeoutId);
      const win = window as any;
      if (win.turnstile && renderedWidgetId) win.turnstile.remove(renderedWidgetId);
    };
  }, [createdReservation]);

  const resetCaptchaWidget = () => {
    setCaptchaToken('');
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win && win.turnstile && captchaWidgetId) {
      try {
        win.turnstile.reset(captchaWidgetId);
        setCaptchaStatus('ready');
      } catch {}
    }
  };

  const loadMetadata = async (background = false) => {
    const requestId = ++metadataRequestRef.current;
    if (!background) setIsLoadingMetadata(true);
    try {
      const [booksRes, schedulesRes] = await Promise.all([
        apiClient.listPublicReservationBooks({ search: bookSearch || initialBookId || undefined, limit: 24 }),
        apiClient.listPublicPickupSchedules(),
      ]);
      if (requestId !== metadataRequestRef.current) return;
      setMetadataError(null);

      const availableBooks: PublicReservationBookDto[] = Array.isArray(booksRes?.items)
        ? booksRes.items.filter((b) => b.availableCopiesCount > 0)
        : [];
      setBooks(availableBooks);

      const availableSchedules: PublicPickupScheduleDto[] = Array.isArray(schedulesRes)
        ? schedulesRes.filter((s) => s.isAvailableForReservation)
        : [];
      setSchedules(availableSchedules);

      setSelectedScheduleId(current => current || availableSchedules[0]?.id || '');
      setSelectedBookId(current => current || availableBooks[0]?.titleId || '');
    } catch (err: any) {
      if (requestId !== metadataRequestRef.current) return;
      setMetadataError(err?.message || 'Không thể tải dữ liệu ca trực hoặc danh mục sách từ máy chủ.');
      setBooks([]);
      setSchedules([]);
    } finally {
      if (requestId === metadataRequestRef.current) setIsLoadingMetadata(false);
    }
  };

  const selectedBook = books.find(b => b.titleId === selectedBookId);
  const maxQuantity = Math.min(3, selectedBook?.availableCopiesCount || 0);
  useEffect(() => { setQuantity(current => Math.max(1, Math.min(current, maxQuantity))); }, [selectedBookId, maxQuantity]);
  const estimatedDeposit = (selectedBook ? selectedBook.standardDeposit : 50000) * quantity;

  const handleSubmitReservation = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    setSubmitError(null);

    if (!selectedBookId || !selectedBook) {
      setSubmitError('Vui lòng chọn sách cần giữ chỗ.');
      return;
    }
    if (!schedules.some(schedule => schedule.id === selectedScheduleId)) {
      setSubmitError('Vui lòng chọn ca trực còn nhận đặt sách để đến lấy.');
      return;
    }
    if (!fullName.trim()) {
      setSubmitError('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (!phone.trim()) {
      setSubmitError('Vui lòng nhập số điện thoại để nhận thông báo.');
      return;
    }
    if (!depositConfirmed) {
      setSubmitError('Vui lòng xác nhận đồng ý nộp tiền cọc khi đến nhận sách tại bàn trực.');
      return;
    }
    if (!captchaToken) {
      setSubmitError('Vui lòng hoàn thành xác minh bảo mật CAPTCHA bên dưới.');
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = {
          titleId: selectedBookId,
          quantity,
          scheduleId: selectedScheduleId,
          fullName: fullName.trim(),
          phone: phone.trim(),
          studentId: studentId.trim() || undefined,
          email: email.trim() || undefined,
      };
      const key = await getReservationIntent({...payload,readerAccountId:reader?.id});
      await apiClient.updateReaderProfile({fullName:payload.fullName,phone:payload.phone});
      const res = await apiClient.createPublicReservation({ ...payload, captchaToken }, key);
      clearReservationIntent(key);
      window.dispatchEvent(new Event('ysbk:availability-changed'));

      setCreatedReservation({
        code: res.reservation.code,
        reservation: res.reservation,
        reservations: res.reservations,
      });
    } catch (err: any) {
      if(err.status===401) window.dispatchEvent(new Event('ysbk:reader-session-ended'));
      const msg = ['IP_QUOTA_EXCEEDED','PHONE_QUOTA_EXCEEDED'].includes(err.code)
        ? 'Số lượng chọn vượt hạn mức còn lại. Mỗi SĐT có tối đa 3 suất giữ/mượn chưa trả; mỗi IP tạo tối đa 3 đơn trong 24 giờ. Chưa tạo đơn nào trong lần này.'
        : err.code === 'BOOK_NOT_AVAILABLE' ? 'Không còn đủ số lượng sách bạn chọn. Chưa tạo đơn nào trong lần này; hãy giảm số lượng hoặc chọn sách khác.'
        : err.message || 'Đã có lỗi xảy ra khi tạo đơn đặt giữ chỗ. Vui lòng thử lại.';
      setSubmitError(msg);
      // Reset CAPTCHA để khách có thể thử lại an toàn
      resetCaptchaWidget();
      void loadMetadata(true);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HELD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EDDF] text-[#294C3A] border border-[#365E4B]/20">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <Clock className="w-3.5 h-3.5 text-[#365E4B]" />
            Đang giữ chỗ
          </span>
        );
      case 'BORROWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EDDF] text-[#294C3A] border border-[#365E4B]/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#365E4B]" />
            Đã nhận sách
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F8F3E7] text-[#64705C] border border-[#DCDED0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#365E4B]" />
            Đã trả sách
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F8F3E7] text-[#64705C] border border-[#DCDED0]">
            <Clock className="w-3.5 h-3.5 text-[#64705C]" />
            Hết hạn giữ chỗ
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F7E7DB] text-[#813C2A] border border-[#9B4D36]/20">
            <XCircle className="w-3.5 h-3.5 text-[#9B4D36]" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F8F3E7] text-[#35483C] border border-[#DCDED0]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className={compact?'reader-reservation':'max-w-4xl mx-auto px-4 sm:px-6 py-8'}>
      {/* SUBTAB 1: CREATE RESERVATION */}
      {reader && (
        <div>
          {createdReservation ? (
            /* SUCCESS CONFIRMATION CARD */
            <div className="bg-[#FFFDF5] border border-emerald-500/50 rounded-[22px] p-6 sm:p-8 shadow-soft-card">
              <div className="flex items-center gap-3 text-emerald-700 mb-4">
                <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#35483C]">
                  Đặt Giữ Chỗ Thành Công!
                </h3>
              </div>

              <p className="text-[#64705C] mb-6 text-sm sm:text-base leading-relaxed">
                  Đã giữ {createdReservation.reservations.length} bản sách cho bạn. Vui lòng đến bàn trực đúng ca đã chọn và chuẩn bị tiền đặt cọc để nhận sách.
              </p>

              <div className="bg-white border border-[#DCDED0] rounded-[18px] p-5 mb-6 space-y-3 shadow-xs">
                <div className="flex justify-between items-center pb-3 border-b border-[#DCDED0]">
                  <span className="text-xs sm:text-sm text-[#64705C]">Mã đơn nhận sách ({createdReservation.reservations.length} bản):</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {createdReservation.reservations.map(order=><span key={order.id} className="font-mono font-bold text-base sm:text-lg text-ysbk-primary">{order.code}</span>)}
                    {getStatusBadge(createdReservation.reservation.status)}
                  </div>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[#DCDED0]">
                  <span className="text-xs sm:text-sm text-[#64705C]">Tựa sách:</span>
                  <span className="font-semibold text-[#35483C] text-sm sm:text-base text-right">
                    {createdReservation.reservation.bookTitle}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[#DCDED0]">
                  <span className="text-xs sm:text-sm text-[#64705C]">Ca trực hẹn nhận:</span>
                  <span className="font-medium text-[#35483C] text-sm text-right">
                    {createdReservation.reservation.shiftDate} ({createdReservation.reservation.shiftTime})
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[#DCDED0]">
                  <span className="text-xs sm:text-sm text-[#64705C]">Địa điểm bàn trực:</span>
                  <span className="font-medium text-[#35483C] text-sm text-right">
                    {createdReservation.reservation.pickupLocation}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[#DCDED0]">
                  <span className="text-xs sm:text-sm text-[#64705C]">Hạn nhận sách:</span>
                  <span className="font-semibold text-rose-600 text-sm text-right">
                    {new Date(createdReservation.reservation.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                    {new Date(createdReservation.reservation.expiresAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-[#64705C]">Tiền cọc cần chuẩn bị:</span>
                  <span className="font-bold text-emerald-700 text-base">
                    {formatVND(createdReservation.reservations.reduce((total,order)=>total+order.estimatedDeposit,0))}
                  </span>
                </div>
              </div>

              <p className="text-sm text-[#365E4B] mb-5">Đơn đã được lưu vào tài khoản. Bạn có thể xem và hủy giữ chỗ trong Sách của tôi.</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a href="/sach/?tab=tra-don" className="ui-btn ui-btn-primary justify-center">Xem Sách của tôi</a>
                <button
                  onClick={() => {
                    if(compact){window.location.assign('/sach/');return;}
                    setCreatedReservation(null);
                    renewActionKey();
                    setDepositConfirmed(false);
                    setQuantity(1);
                    resetCaptchaWidget();
                  }}
                  className="w-full sm:w-auto py-3 px-6 bg-[#E8EDDF] hover:bg-[#DCDED0] text-[#35483C] font-semibold rounded-[14px] text-sm transition text-center"
                >
                  {compact?'Về Tủ sách':'Đặt thêm sách'}
                </button>
              </div>
            </div>
          ) : (
            /* BOOKING FORM */
            <div className="bg-[#FFFDF5] border border-[#DCDED0] rounded-[22px] p-6 sm:p-8 shadow-soft-card">
              <div className="mb-6">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#35483C]">
                  Thông tin nhận sách
                </h2>
                <p className="text-xs sm:text-sm text-[#64705C] mt-1">
                  Đơn được lưu vào tài khoản bạn đọc. Chọn ca trực nhận sách; sách được giữ đến hết ca đã chọn.
                </p>
                {import.meta.env.PUBLIC_LOCAL_TESTING === 'true' && <p className="mt-2 text-xs text-[#813C2A]">Bản local dùng CAPTCHA test của Cloudflare; chưa kiểm tra khả năng chống bot thật.</p>}
              </div>

              {metadataError && (
                <div className="mb-6 p-4 bg-[#F7E7DB]/50 border border-[#9B4D36]/30 rounded-[14px] flex items-start justify-between gap-3 text-[#813C2A] text-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#9B4D36]" />
                    <div>{metadataError}</div>
                  </div>
                  <button
                    onClick={() => void loadMetadata()}
                    className="px-3 py-1.5 bg-[#F7E7DB] hover:bg-[#E8D0C0] text-[#813C2A] rounded-[10px] text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Thử lại
                  </button>
                </div>
              )}

              {submitError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-[14px] flex items-start gap-3 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                  <div>{submitError}</div>
                </div>
              )}

              <form onSubmit={handleSubmitReservation} className="space-y-6">
                {/* 1. CHỌN SÁCH */}
                <div>
                  <label className="block text-sm font-semibold text-[#35483C] mb-2">
                    1. Chọn cuốn sách muốn mượn <span className="text-rose-500">*</span>
                  </label>
                  {!compact&&<input aria-label="Tìm sách để đặt" value={bookSearch}
                    onChange={e => { setBookSearch(e.target.value); setSelectedBookId(''); setBooks([]); }}
                    placeholder="Tìm theo tên sách hoặc tác giả"
                    className="w-full px-4 py-3 mb-2 bg-white border border-[#DCDED0] rounded-[14px] text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary" />}
                  {isLoadingMetadata ? (
                    <div className="text-sm text-[#64705C] py-2 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-ysbk-primary" />
                      Đang tải danh mục sách khả dụng...
                    </div>
                  ) : books.length === 0 ? (
                    <div className="p-4 bg-[#F8F3E7] border border-[#DCDED0] rounded-[14px] text-[#64705C] text-sm">
                      Hiện chưa có sách nào sẵn sàng để đặt giữ chỗ trực tuyến. Vui lòng quay lại sau hoặc liên hệ thành viên tại bàn trực.
                    </div>
                  ) : (
                    <select
                      aria-label="Sách giữ chỗ"
                      disabled={compact}
                      value={selectedBookId}
                      onChange={(e) => {
                        setSelectedBookId(e.target.value);
                      }}
                      className="w-full px-4 py-3 bg-white border border-[#DCDED0] rounded-[14px] text-sm font-medium text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary"
                      required
                    >
                      <option value="">-- Chọn một cuốn sách có sẵn --</option>
                      {books.map((b) => (
                        <option key={b.titleId} value={b.titleId}>
                          {b.title} — {b.author} ({b.availableCopiesCount} bản sẵn sàng)
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedBook && (
                    <div className="mt-2 text-xs text-[#64705C] bg-[#F8F3E7] p-3 rounded-[12px] border border-[#DCDED0] flex justify-between items-center">
                      <span>Thể loại: <strong>{selectedBook.category}</strong></span>
                      <span className="text-emerald-700 font-semibold">
                        Tiền cọc quy định: {formatVND(selectedBook.standardDeposit)}
                      </span>
                    </div>
                  )}
                  {selectedBook && selectedBook.availableCopiesCount > 1 && <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span id="reservation-quantity-label" className="text-sm font-semibold text-[#35483C]">Số lượng đặt trước</span>
                      <div role="group" aria-labelledby="reservation-quantity-label" className="flex items-center gap-3">
                        <button type="button" aria-label="Giảm số lượng" className="ui-btn ui-btn-secondary" disabled={isSubmitting||quantity<=1} onClick={()=>{setQuantity(value=>Math.max(1,value-1));setDepositConfirmed(false);}}><Minus size={16}/></button>
                        <output aria-live="polite" className="min-w-6 text-center font-bold">{quantity}</output>
                        <button type="button" aria-label="Tăng số lượng" className="ui-btn ui-btn-secondary" disabled={isSubmitting||quantity>=maxQuantity} onClick={()=>{setQuantity(value=>Math.min(maxQuantity,value+1));setDepositConfirmed(false);}}><Plus size={16}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-[#64705C]">Còn {selectedBook.availableCopiesCount} bản. Tối đa 3 suất giữ/mượn chưa trả theo SĐT và 3 đơn/IP trong 24 giờ. Mỗi bản có một mã đơn riêng.</p>
                  </div>}
                </div>

                {/* 2. CHỌN CA TRỰC */}
                <div>
                  <label className="block text-sm font-semibold text-[#35483C] mb-2">
                    2. Chọn ca trực bạn sẽ đến nhận sách <span className="text-rose-500">*</span>
                  </label>
                  {isLoadingMetadata ? (
                    <div className="text-sm text-[#64705C] py-2 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-ysbk-primary" />
                      Đang tải lịch trực...
                    </div>
                  ) : schedules.length === 0 ? (
                    <div className="p-4 bg-[#F8F3E7] border border-[#DCDED0] rounded-[14px] text-[#64705C] text-sm">
                      Hiện chưa có ca trực nào đang mở để hẹn nhận sách. Vui lòng theo dõi thông báo ca trực mới của CLB.
                    </div>
                  ) : (
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => {
                        setSelectedScheduleId(e.target.value);
                      }}
                      className="w-full px-4 py-3 bg-white border border-[#DCDED0] rounded-[14px] text-sm font-medium text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary"
                      required
                    >
                      <option value="">-- Chọn ca trực phù hợp --</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id}>
                          Ngày {s.date} ({s.timeRange}) — {s.location}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1.5 text-xs text-[#64705C] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#64705C]" />
                    Sách sẽ được giữ đến thời điểm kết thúc ca trực này.
                  </p>
                </div>

                {/* 3. THÔNG TIN BẠN ĐỌC */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#35483C] mb-1.5">
                      Họ và tên <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                      }}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-4 py-2.5 bg-white border border-[#DCDED0] rounded-[14px] text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#35483C] mb-1.5">
                      Số điện thoại <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                      }}
                      placeholder="0912345678"
                      className="w-full px-4 py-2.5 bg-white border border-[#DCDED0] rounded-[14px] text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#35483C] mb-1.5">
                      Mã số sinh viên (MSSV)
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="2022xxxx (không bắt buộc)"
                      className="w-full px-4 py-2.5 bg-white border border-[#DCDED0] rounded-[14px] text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#35483C] mb-1.5">
                      {reader?'Email Google':'Email'}
                    </label>
                    <input
                      type="email"
                      readOnly={Boolean(reader)}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@sis.hust.edu.vn (không bắt buộc)"
                      className="w-full px-4 py-2.5 bg-white border border-[#DCDED0] rounded-[14px] text-sm text-[#35483C] focus:outline-none focus:ring-2 focus:ring-ysbk-primary"
                    />
                  </div>
                </div>

                {/* 4. CAM KẾT ĐẶT CỌC */}
                <div className="bg-[#E8EDDF]/50 border border-[#365E4B]/20 rounded-[14px] p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={depositConfirmed}
                      onChange={(e) => setDepositConfirmed(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-ysbk-primary focus:ring-ysbk-primary accent-[#365E4B]"
                    />
                    <div className="text-xs sm:text-sm text-[#35483C] leading-relaxed">
                      Tôi xác nhận sẽ chuẩn bị khoản tiền cọc <strong>{formatVND(estimatedDeposit)}</strong> và cam kết có mặt tại bàn trực để nhận sách trước giờ kết thúc ca. Tôi hiểu tiền cọc sẽ được hoàn trả đầy đủ khi tôi trả lại sách nguyên vẹn cho CLB.
                    </div>
                  </label>
                </div>

                {/* 5. CLOUDFLARE TURNSTILE CAPTCHA THỰC TẾ (PRF-01, PRF-07) */}
                <div>
                  <label className="block text-sm font-semibold text-[#35483C] mb-2">
                    Xác minh bảo mật <span className="text-rose-500">*</span>
                  </label>
                  <div className="p-3 bg-white border border-[#DCDED0] rounded-[14px] flex flex-col items-center justify-center min-h-[70px]">
                    <div ref={turnstileContainerRef} id="turnstile-widget" />
                    {captchaStatus === 'loading' && (
                      <div className="text-xs text-[#64705C] flex items-center gap-2 py-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-ysbk-primary" />
                        Đang kết nối dịch vụ bảo mật Cloudflare Turnstile...
                      </div>
                    )}
                    {captchaStatus === 'verified' && (
                      <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 mt-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Xác minh bảo mật thành công.
                      </div>
                    )}
                    {captchaStatus === 'error' && (
                      <div className="text-xs text-rose-600 flex items-center gap-1.5 mt-2">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        Xác minh không thành công. Vui lòng bấm vào ô xác minh để thử lại.
                      </div>
                    )}
                    {captchaStatus === 'unavailable' && (
                      <div className="text-xs text-[#813C2A] flex items-center gap-1.5 mt-2">
                        <AlertTriangle className="w-4 h-4 text-[#9B4D36]" />
                        Không thể kết nối đến máy chủ bảo mật CAPTCHA. Vui lòng kiểm tra lại kết nối mạng.
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={isSubmitting || !captchaToken || books.length === 0 || schedules.length === 0}
                  className="w-full py-3.5 px-6 bg-ysbk-primary hover:bg-[#294C3A] text-white font-bold rounded-[14px] text-base shadow-soft-btn transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Đang xử lý đơn giữ chỗ...
                    </>
                  ) : (
                    'Xác Nhận Đặt Giữ Chỗ 01 Cuốn'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
