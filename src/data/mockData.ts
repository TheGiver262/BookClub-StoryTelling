// Mock Data & Business Logic Helpers for YSBK Prototype

export interface BookCopy {
  barcode: string;
  copyNumber: number;
  location: 'KHO_THU_VIEN' | 'KHO_HOI_SINH_VIEN' | 'BAN_TRUC_TAM';
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'MAINTENANCE';
  conditionNote?: string;
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  publishYear: number;
  categories: string[];
  coverPrice: number | null; // null represents "Chưa có giá"
  isbn?: string;
  coverImage?: string;
  description: string;
  copies: BookCopy[];
}

export interface Borrower {
  id: string;
  fullName: string;
  studentId: string;
  school: string;
  phone: string;
  email: string;
}

export interface LoanItem {
  barcode: string;
  bookTitle: string;
  depositSnapshot: number; // Snapshot tiền cọc từng cuốn tại thời điểm lập phiếu
  returnedAt?: string;
  isLost?: boolean;
}

export interface LoanReceipt {
  id: string;
  receiptNumber: string;
  borrower: Borrower;
  borrowDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  items: LoanItem[];
  renewCount: number; // tối đa 3 lần
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'PARTIAL_SETTLED' | 'LOST' | 'PENDING_DEPOSIT' | 'CANCELLED';
  precedingReceiptId?: string; // Nếu là phiếu chuyển tiếp
  notes?: string;
}

// Business Rules Functions:
export function calculateDeposit(coverPrice: number | null): number {
  if (coverPrice === null || coverPrice === undefined || coverPrice <= 0) {
    return 50000; // Mặc định 50.000 VND cho sách chưa biết giá
  }
  // Bội 50.000 gần nhất, mốc giữa làm tròn lên, tối thiểu 50.000, không trần 200.000
  return Math.max(50000, Math.floor((coverPrice + 25000) / 50000) * 50000);
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'b-01',
    title: 'Đắc Nhân Tâm',
    authors: ['Dale Carnegie'],
    publisher: 'NXB First News - Trí Việt',
    publishYear: 2021,
    categories: ['Kỹ năng sống', 'Tư duy'],
    coverPrice: 74000, // Test case 74k -> cọc 50k
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    description: 'Nghệ thuật thu phục lòng người, tạo dựng mối quan hệ tốt đẹp trong cuộc sống và công việc.',
    copies: [
      { barcode: 'BK-00101', copyNumber: 1, location: 'BAN_TRUC_TAM', status: 'AVAILABLE' },
      { barcode: 'BK-00102', copyNumber: 2, location: 'KHO_THU_VIEN', status: 'BORROWED' },
    ],
  },
  {
    id: 'b-02',
    title: 'Tuổi Trẻ Đáng Giá Bao Nhiêu?',
    authors: ['Rosie Nguyễn'],
    publisher: 'NXB Hội Nhà Văn',
    publishYear: 2020,
    categories: ['Kỹ năng sống', 'Phát triển bản thân'],
    coverPrice: 75000, // Test case 75k -> cọc 100k
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
    description: 'Cuốn sách chia sẻ về việc học tập, đi lại, đọc sách và khám phá bản thân thời thanh xuân.',
    copies: [
      { barcode: 'BK-00201', copyNumber: 1, location: 'BAN_TRUC_TAM', status: 'AVAILABLE' },
      { barcode: 'BK-00202', copyNumber: 2, location: 'KHO_HOI_SINH_VIEN', status: 'AVAILABLE' },
    ],
  },
  {
    id: 'b-03',
    title: 'Clean Code — Mã Sạch',
    authors: ['Robert C. Martin'],
    publisher: 'NXB Khoa Học & Kỹ Thuật',
    publishYear: 2019,
    categories: ['Công nghệ', 'Kỹ thuật'],
    coverPrice: 230000, // Test case 230k -> cọc 250k
    coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?w=400&q=80',
    description: 'Cẩm nang của kỹ sư phần mềm chuyên nghiệp về cấu trúc code, refactoring và kiểm thử.',
    copies: [
      { barcode: 'BK-00301', copyNumber: 1, location: 'KHO_THU_VIEN', status: 'BORROWED' },
    ],
  },
  {
    id: 'b-04',
    title: 'Tuyển Tập Văn Hóa Bách Khoa (Bản Sưu Tầm Cũ)',
    authors: ['CLB Yêu Sách Bách Khoa'],
    publisher: 'Nội bộ CLB',
    publishYear: 2015,
    categories: ['Văn hóa Bách Khoa', 'Sưu tầm'],
    coverPrice: null, // Test case Sách chưa có giá -> cọc mặc định 50k, hiển thị "Chưa có giá"
    coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
    description: 'Tập hợp các bài viết cảm nhận, thơ và ký ức của sinh viên ĐHBK Hà Nội qua các thế hệ.',
    copies: [
      { barcode: 'BK-00401', copyNumber: 1, location: 'BAN_TRUC_TAM', status: 'AVAILABLE' },
      { barcode: 'BK-00402', copyNumber: 2, location: 'KHO_THU_VIEN', status: 'AVAILABLE' },
    ],
  },
  {
    id: 'b-05',
    title: 'Sapiens — Lược Sử Loài Người',
    authors: ['Yuval Noah Harari'],
    publisher: 'NXB Tri Thức',
    publishYear: 2018,
    categories: ['Lịch sử', 'Khoa học'],
    coverPrice: 151000, // Test case 151k -> cọc 150k
    coverImage: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&q=80',
    description: 'Hành trình tiến hóa của loài người từ thời kỳ đồ đá cho đến thế kỷ 21.',
    copies: [
      { barcode: 'BK-00501', copyNumber: 1, location: 'BAN_TRUC_TAM', status: 'AVAILABLE' },
    ],
  },
  {
    id: 'b-06',
    title: 'Cây Cam Ngọt Của Tôi',
    authors: ['José Mauro de Vasconcelos'],
    publisher: 'NXB Hội Nhà Văn',
    publishYear: 2020,
    categories: ['Tiểu thuyết', 'Văn học nước ngoài'],
    coverPrice: 85000, // cọc 100k
    coverImage: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80',
    description: 'Câu chuyện cảm động về cậu bé Zezé và hành trình lớn lên trong nghèo khó nhưng giàu tình yêu.',
    copies: [
      { barcode: 'BK-00601', copyNumber: 1, location: 'BAN_TRUC_TAM', status: 'AVAILABLE' },
      { barcode: 'BK-00602', copyNumber: 2, location: 'KHO_HOI_SINH_VIEN', status: 'AVAILABLE' },
    ],
  },
];

export const INITIAL_BORROWERS: Borrower[] = [
  {
    id: 'bw-01',
    fullName: 'Trần Minh Quân',
    studentId: '20224567',
    school: 'ĐH Bách Khoa Hà Nội (Trường CNTT&TT)',
    phone: '0987654321',
    email: 'quan.tm224567@sis.hust.edu.vn',
  },
  {
    id: 'bw-02',
    fullName: 'Lê Thu Hương',
    studentId: '20231234',
    school: 'ĐH Bách Khoa Hà Nội (Trường Cơ khí)',
    phone: '0912345678',
    email: 'huong.lt231234@sis.hust.edu.vn',
  },
  {
    id: 'bw-03',
    fullName: 'Hoàng Quốc Việt',
    studentId: '20219876',
    school: 'ĐH Bách Khoa Hà Nội (Trường Điện - Điện tử)',
    phone: '0905123987',
    email: 'viet.hq219876@sis.hust.edu.vn',
  },
];

export const INITIAL_LOANS: LoanReceipt[] = [
  {
    id: 'ln-01',
    receiptNumber: 'YSBK-PM-20261010-001',
    borrower: INITIAL_BORROWERS[0],
    borrowDate: '2026-10-05',
    dueDate: '2026-10-19', // Đúng 14 ngày
    items: [
      {
        barcode: 'BK-00102',
        bookTitle: 'Đắc Nhân Tâm',
        depositSnapshot: 50000,
      },
    ],
    renewCount: 0,
    status: 'ACTIVE',
  },
  {
    id: 'ln-02',
    receiptNumber: 'YSBK-PM-20260925-004',
    borrower: INITIAL_BORROWERS[1],
    borrowDate: '2026-09-25',
    dueDate: '2026-10-09', // Đã quá hạn 9 ngày (tính đến 18/10)
    items: [
      {
        barcode: 'BK-00301',
        bookTitle: 'Clean Code — Mã Sạch',
        depositSnapshot: 250000,
      },
    ],
    renewCount: 1,
    status: 'OVERDUE',
    notes: 'Đã gọi nhắc nhở lần 1 ngày 12/10, bạn hẹn thứ Ba tuần sau trả.',
  },
  {
    id: 'ln-03',
    receiptNumber: 'YSBK-PM-20261001-002',
    borrower: INITIAL_BORROWERS[2],
    borrowDate: '2026-10-01',
    dueDate: '2026-10-15', // Quá hạn 3 ngày tính đến 18/10
    items: [
      {
        barcode: 'BK-00101',
        bookTitle: 'Đắc Nhân Tâm',
        depositSnapshot: 50000,
      },
      {
        barcode: 'BK-00201',
        bookTitle: 'Tuổi Trẻ Đáng Giá Bao Nhiêu?',
        depositSnapshot: 100000,
      },
    ],
    renewCount: 0,
    status: 'OVERDUE',
    notes: 'Phiếu 2 cuốn cọc 150k. Quá hạn 3 ngày: phạt tính 3k cho cả phiếu (1k/ngày).',
  },
];

export interface CashSession {
  id: string;
  sessionDate: string;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  expectedClosingCash: number;
  actualClosingCash: number | null;
  discrepancy: number | null;
  discrepancyReason?: string;
  isClosed: boolean;
  closedAt?: string;
}

export const INITIAL_CASH_SESSION: CashSession = {
  id: 'cs-20261018',
  sessionDate: '2026-10-18',
  openedBy: 'Nguyễn Văn An (Trực chính)',
  openedAt: '13:50',
  openingCash: 350000, // Đếm đầu ca từ hộp tiền cất tủ
  expectedClosingCash: 550000, // + cọc mới nhận 250k - hoàn 50k
  actualClosingCash: null,
  discrepancy: null,
  isClosed: false,
};

export interface Member {
  id: string;
  fullName: string;
  username: string;
  gen: string;
  team: 'HẬU CẦN' | 'NỘI DUNG' | 'TRUYỀN THÔNG ĐỐI NGOẠI' | 'BAN CHỦ NHIỆM';
  roleTitle: string; // Trưởng ban, Phó ban, Thành viên, Chủ nhiệm CLB...
  schoolYear: string;
  phone: string;
  isEligibleMainDuty: boolean; // Đủ điều kiện trực chính (đã qua đào tạo)
  hasPaidFee: boolean; // Hội phí 100k đóng 1 lần duy nhất
  isAlumni: boolean; // Cựu thành viên
}

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'm-01',
    fullName: 'Đặng Quốc Dũng',
    username: 'dung.bcn',
    gen: 'Gen 8',
    team: 'BAN CHỦ NHIỆM',
    roleTitle: 'Chủ nhiệm CLB',
    schoolYear: 'K65 - Viện Cơ khí',
    phone: '0971112233',
    isEligibleMainDuty: true,
    hasPaidFee: true,
    isAlumni: false,
  },
  {
    id: 'm-02',
    fullName: 'Nguyễn Thị Ánh',
    username: 'anh.haucan',
    gen: 'Gen 8',
    team: 'HẬU CẦN',
    roleTitle: 'Trưởng ban Hậu cần (Ủy viên BCN)',
    schoolYear: 'K66 - Viện Kinh tế & Quản lý',
    phone: '0982223344',
    isEligibleMainDuty: true,
    hasPaidFee: true,
    isAlumni: false,
  },
  {
    id: 'm-03',
    fullName: 'Phạm Hoàng Nam',
    username: 'nam.noidung',
    gen: 'Gen 9',
    team: 'NỘI DUNG',
    roleTitle: 'Thành viên',
    schoolYear: 'K67 - Trường CNTT&TT',
    phone: '0963334455',
    isEligibleMainDuty: true,
    hasPaidFee: true,
    isAlumni: false,
  },
  {
    id: 'm-04',
    fullName: 'Vũ Minh Anh',
    username: 'minhanh.ttdn',
    gen: 'Gen 9',
    team: 'TRUYỀN THÔNG ĐỐI NGOẠI',
    roleTitle: 'Thành viên mới (Đang hỗ trợ)',
    schoolYear: 'K68 - Trường Ngoại ngữ',
    phone: '0944445566',
    isEligibleMainDuty: false, // Chưa đủ điều kiện trực chính, chỉ làm hỗ trợ
    hasPaidFee: true,
    isAlumni: false,
  },
  {
    id: 'm-05',
    fullName: 'Trần Đức Thắng',
    username: 'thang.cuu',
    gen: 'Gen 7',
    team: 'HẬU CẦN',
    roleTitle: 'Cựu Trưởng ban Hậu cần',
    schoolYear: 'K64 - Đã tốt nghiệp',
    phone: '0915556677',
    isEligibleMainDuty: false,
    hasPaidFee: true,
    isAlumni: true, // Cựu thành viên: chỉ xem hoạt động an toàn
  },
];

export interface DutyShift {
  id: string;
  dayOfWeek: string; // Thứ Ba / Thứ Năm
  date: string; // YYYY-MM-DD
  location: string;
  prepTime: string; // 13:45 - 14:00
  mainTime: string; // 14:00 - 17:00
  cleanupTime: string; // 17:00 - 17:15
  mainAssignees: string[]; // Tối thiểu 2 người đủ điều kiện
  supportAssignees: string[]; // 3-5 người hỗ trợ
  status: 'DRAFT_PROPOSED' | 'PUBLISHED' | 'COMPLETED';
}

export const INITIAL_DUTY_SHIFTS: DutyShift[] = [
  {
    id: 'shift-01',
    dayOfWeek: 'Thứ Ba',
    date: '2026-10-20',
    location: 'Bàn sách sảnh Thư viện Tạ Quang Bửu',
    prepTime: '13:45 - 14:00',
    mainTime: '14:00 - 17:00',
    cleanupTime: '17:00 - 17:15',
    mainAssignees: ['Đặng Quốc Dũng', 'Nguyễn Thị Ánh'],
    supportAssignees: ['Vũ Minh Anh', 'Phạm Hoàng Nam'],
    status: 'PUBLISHED',
  },
  {
    id: 'shift-02',
    dayOfWeek: 'Thứ Năm',
    date: '2026-10-22',
    location: 'Bàn sách sảnh Thư viện Tạ Quang Bửu',
    prepTime: '13:45 - 14:00',
    mainTime: '14:00 - 17:00',
    cleanupTime: '17:00 - 17:15',
    mainAssignees: ['Phạm Hoàng Nam', 'Nguyễn Thị Ánh'],
    supportAssignees: ['Vũ Minh Anh'],
    status: 'DRAFT_PROPOSED',
  },
];

export interface BookLot {
  id: string;
  lotName: string;
  supplier: string;
  receivedDate: string;
  bookTitle: string;
  coverPrice: number;
  discountRate: number; // 35%
  unitCost: number; // 65.000 VND
  sellingPrice: number; // 80.000 VND (sau chiết khấu người mua 20%)
  receivedQuantity: number; // 100
  soldQuantity: number; // 60
  returnedQuantity: number; // 40
  depositPaidToSupplier: number; // 1.000.000 VND (cọc nhà sách)
  depositRefundReceived: number; // 1.000.000 VND (nhận hoàn cọc riêng)
  settlementPaid: number; // 3.900.000 VND (thanh toán tiền 60 cuốn riêng)
  isSettled: boolean;
}

export const INITIAL_BOOK_LOTS: BookLot[] = [
  {
    id: 'lot-01',
    lotName: 'Đợt Bán Sách Chào Tân Sinh Viên K69',
    supplier: 'Nhà Sách Nhã Nam',
    receivedDate: '2026-10-01',
    bookTitle: 'Combo Kỹ Năng Sống & Phương Pháp Học Đại Học',
    coverPrice: 100000,
    discountRate: 0.35,
    unitCost: 65000,
    sellingPrice: 80000,
    receivedQuantity: 100,
    soldQuantity: 60,
    returnedQuantity: 40,
    depositPaidToSupplier: 1000000,
    depositRefundReceived: 1000000, // Hoàn cọc riêng 1 triệu
    settlementPaid: 3900000, // Thanh toán riêng 3.9 triệu
    isSettled: true,
  },
];

export interface RecruitmentCandidate {
  id: string;
  fullName: string;
  studentId: string;
  aspirations: string[]; // Nhiều nguyện vọng ban
  interviewTimeSlot: string;
  individualScores: { [interviewer: string]: number }; // Chấm riêng
  councilScore: number | null; // Tổng kết hội đồng
  assignedTeam: string | null;
  status: 'SUBMITTED' | 'INTERVIEWED' | 'ACCEPTED' | 'REJECTED';
  scoreHistory: { date: string; changedBy: string; oldScore: number; newScore: number; reason: string }[];
}

export const INITIAL_CANDIDATES: RecruitmentCandidate[] = [
  {
    id: 'cand-01',
    fullName: 'Hoàng Bảo Ngọc',
    studentId: '20241122',
    aspirations: ['Nội dung', 'Truyền thông đối ngoại'],
    interviewTimeSlot: 'Ca 1: 08:30 - 09:15, Chủ Nhật 25/10',
    individualScores: { 'Phạm Hoàng Nam': 8.5, 'Đặng Quốc Dũng': 8.0 },
    councilScore: 8.25,
    assignedTeam: 'Nội dung',
    status: 'ACCEPTED',
    scoreHistory: [
      {
        date: '2026-10-18 10:30',
        changedBy: 'Đặng Quốc Dũng',
        oldScore: 7.5,
        newScore: 8.0,
        reason: 'Xem lại bài viết thử thách bổ sung chất lượng tốt',
      },
    ],
  },
  {
    id: 'cand-02',
    fullName: 'Vũ Đức Trọng',
    studentId: '20245566',
    aspirations: ['Hậu cần'],
    interviewTimeSlot: 'Ca 2: 09:30 - 10:15, Chủ Nhật 25/10',
    individualScores: { 'Nguyễn Thị Ánh': 7.5 },
    councilScore: null,
    assignedTeam: null,
    status: 'SUBMITTED',
    scoreHistory: [],
  },
];

export interface ReviewItem {
  id: string;
  bookTitle: string;
  readerName: string;
  rating: number; // 1 - 5 sao
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  moderatedBy?: string;
  moderationReason?: string;
}

export const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-01',
    bookTitle: 'Đắc Nhân Tâm',
    readerName: 'Nguyễn Văn Minh (Khách K68)',
    rating: 5,
    content: 'Một cuốn sách kinh điển giúp mình thay đổi góc nhìn khi giao tiếp với thầy cô và bạn bè trong trường Bách Khoa.',
    status: 'APPROVED',
    submittedAt: '2026-10-16 14:20',
    moderatedBy: 'Phạm Hoàng Nam',
  },
  {
    id: 'rev-02',
    bookTitle: 'Tuổi Trẻ Đáng Giá Bao Nhiêu?',
    readerName: 'Trần Thị Mai (K69)',
    rating: 4,
    content: 'Sách rất phù hợp cho các bạn tân sinh viên đang hoang mang chưa biết bắt đầu từ đâu.',
    status: 'PENDING',
    submittedAt: '2026-10-18 09:15',
  },
];
