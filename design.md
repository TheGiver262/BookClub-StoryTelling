# YSBK — Design System & Hướng Dẫn Thiết Kế UI v1.0

Tài liệu thiết kế giao diện chuẩn cho Website Quản Lý Câu Lạc Bộ Yêu Sách Bách Khoa Hà Nội (YSBK).  
Ngày lập: 18/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`.  
Tình trạng: **Design System & Prototype Specification (Nền tảng triển khai)**.

---

## 1. Mục Tiêu, Đối Tượng & Nguyên Tắc Thiết Kế

### 1.1 Mục tiêu
Xây dựng một hệ thống giao diện nhất quán, thân thiện và hiệu năng cao cho website YSBK. Hệ thống phục vụ hai nhóm không gian chức năng chính:
1. **Không gian Công khai (Public Portal):** Giúp sinh viên Bách Khoa và bạn đọc yêu sách dễ dàng tra cứu kho sách, đọc cảm nhận/bài viết, theo dõi sự kiện, lịch trực sách và kết quả tuyển sinh viên công khai.
2. **Không gian Quản trị Nội bộ (Internal Workspace):** Giúp thành viên CLB vận hành trơn tru quầy mượn–trả, kiểm soát cọc/phạt, quản lý kho, chấm tuyển thành viên, phân ca trực, quản trị quỹ/lô sách và xuất báo cáo đối soát.

### 1.2 Đối tượng người dùng & Đặc tính trải nghiệm
* **Bạn đọc / Khách vãng lai:** Thao tác trên điện thoại di động (giả định thiết kế ban đầu: ưu tiên tối ưu mobile cho lưu lượng công khai, chưa có số đo thực tế) và laptop. Ưu tiên tìm kiếm nhanh, bìa sách trực quan, nhịp điệu bài viết ấm áp, typography chuẩn phong cách xuất bản.
* **Người trực sách tại bàn:** Thao tác chủ yếu trên laptop hoặc điện thoại khi đứng quầy. Cần giao diện bảng và form mượn–trả mật độ cao, nhập số tiền tức thì, bàn phím số thuận tiện, tổng tiền nổi bật, phím tắt nhanh và không bị che khuất khi mở bàn phím ảo.
* **Cựu thành viên:** Trải nghiệm đọc tin tức và theo dõi hoạt động ấm cúng, tinh giản, bị chặn hoàn toàn các trường dữ liệu nhạy cảm (tài chính, số tài khoản, PII).
* **Quản trị viên / Ban điều hành:** Bảng điều khiển KPI rõ ràng (kế thừa triết lý trực quan từ WarePro: số tổng → chi tiết), quản trị tài khoản và truy vết nhật ký.

### 1.3 Nguyên tắc thiết kế cốt lõi
1. **Chân thực & Minh bạch (Honesty & Fidelity):** Phân biệt rành mạch giữa số liệu thực tế và số liệu ước tính; phân định rõ trạng thái tiền (chờ xác nhận app vs. đã xác nhận); không tự ý làm tròn tiền hay gộp các bút toán thu–hoàn.
2. **Biên tập & Ấm áp (Editorial Warmth):** Không gian công khai mang hơi thở tri thức, gợi cảm giác của thư viện Tạ Quang Bửu và không gian đọc sách sinh viên với font serif trang nhã kết hợp sans-serif hiện đại.
3. **Chính xác & Tối giản tại quầy (High-Density Utility):** Không gian nội bộ loại bỏ các hiệu ứng trang trí thừa, gradient phức tạp hay glassmorphism làm chậm mắt; tập trung vào bảng dữ liệu, nhãn số tiền thẳng cột và phản hồi tức thời.
4. **Không để người dùng phỏng đoán (Defensive Feedback):** Mỗi hành động tài chính đều hiển thị biên nhận, giải thích số tiền gợi ý vs. chốt, ghi chú lý do và xử lý rõ ràng trạng thái mất mạng hoặc chưa rõ kết quả lưu.

---

## 2. Bảng Nguồn Khảo Sát & Nhận Diện Thương Hiệu

### 2.1 Bảng nguồn khảo sát
| Nguồn | URL / Tài liệu | Ngày khảo sát | Điều quan sát được & Dữ liệu trích xuất | Độ tin cậy | Giới hạn & Quyết định áp dụng |
|---|---|---|---|---|---|
| **Trang chủ HUST & Thư viện** | `hust.edu.vn`, Thư viện Tạ Quang Bửu | 18/10/2026 | Xác nhận tên đầy đủ: *Câu lạc bộ Yêu sách Bách Khoa Hà Nội* (YSBK). Phối hợp thường niên với Thư viện TQB và HSV ĐHBK Hà Nội. | Rất cao (Nguồn ĐH chính thức) | Xác nhận vai trò tổ chức, không có bộ quy chuẩn màu số hóa riêng. |
| **Website Weebly CLB** | `clbyeusachbkhn.weebly.com` | 18/10/2026 | Slogan: *"Mở sách đọc tương lai!"*. Logo dạng bán nguyệt: nền đỏ, sao vàng, dải sách mở trắng–đỏ, thanh đế xanh navy. | Cao (Tài sản thực tế của CLB) | Asset được tạo năm 2015-2016, ảnh bitmap độ phân giải thấp (140x98px). Dùng làm căn cứ màu/biểu tượng gốc, không scale vỡ hạt. |
| **Fanpage CLB** | `facebook.com/CLBYeuSachBachKhoaHaNoi` | 18/10/2026 | Tên trang, định dạng avatar/cover. | Trung bình (Tạm thời bị chặn truy cập) | Không đoán mò asset Facebook, dùng asset Weebly đã được đối chiếu chéo với ảnh hoạt động CLB. |
| **WarePro (Tham chiếu nội bộ)** | `QuanLyHangHoa/MainWindow.xaml`, `DashboardView.xaml` | 18/10/2026 | Bố cục Sidebar 240px/68px, Tab phân vai (Kinh doanh/Vận hành), Metric cards (Icon nền màu nhạt + Text số to + nhãn phụ), DataGrid rõ ràng. | Rất cao (Codebase tham chiếu chuẩn) | Áp dụng triết lý bố cục số tổng → drill-down và sidebar có thể thu gọn vào giao diện web/mobile. |

### 2.2 Quy tắc sử dụng Logo & Asset YSBK
* **Tệp logo gốc:** Lưu tại `public/assets/logo-ysbk.png` (trích xuất trực tiếp từ nguồn Weebly chính thức của CLB).
* **Quy cách hiển thị:**
  * Đi kèm tên chữ đầy đủ: **CLB Yêu Sách Bách Khoa Hà Nội** hoặc tên viết tắt **YSBK**.
  * Khoảng thở tối thiểu (clear space): Tối thiểu bằng 50% chiều cao của logo xung quanh 4 phía.
  * Chiều cao tối thiểu: `32px` trên Mobile Navbar, `40px` trên Desktop Header, `48px` trên Dashboard Sidebar.
  * Không dùng AI vẽ lại hay thay thế bằng icon sách generic. Không kéo giãn méo tỷ lệ.

---

## 3. Hệ Thống Màu Sắc & Bảng Token (Color Tokens)

Màu sắc được chuẩn hóa theo hệ thống Design Tokens hai tầng: **Global Palette** và **Semantic Tokens**.  
*Mã màu trích xuất từ asset CLB:* Đỏ Bách Khoa (`#C62828` / `#DC2626`), Xanh Navy Bách Khoa (`#151879` / `#1E3A8A`), Vàng Sao (`#F59E0B`).

### 3.1 Bảng màu toàn cục (Global Palette)
```css
:root {
  /* Brand Heritage (Màu thương hiệu trích xuất từ logo/ấn phẩm CLB) */
  --color-brand-red: #C62828;        /* Đỏ truyền thống Bách Khoa */
  --color-brand-red-hover: #B71C1C;
  --color-brand-red-soft: #FFEBEE;
  
  --color-brand-navy: #151879;       /* Xanh tri thức / Thư viện */
  --color-brand-navy-hover: #0D105A;
  --color-brand-navy-soft: #E8EAF6;

  --color-brand-gold: #F59E0B;       /* Vàng sao Bách Khoa */
  --color-brand-gold-soft: #FEF3C7;

  /* Neutrals (Ấm áp, thân thiện cho đọc sách) */
  --color-slate-900: #0F172A;        /* Chữ chính */
  --color-slate-800: #1E293B;
  --color-slate-700: #334155;        /* Chữ phụ */
  --color-slate-500: #64748B;        /* Muted / Placeholder */
  --color-slate-400: #94A3B8;
  --color-slate-200: #E2E8F0;        /* Viền / Divider */
  --color-slate-100: #F1F5F9;        /* Nền thẻ / Sub-surface */
  --color-slate-50:  #F8FAFC;        /* Nền trang */
  --color-white:     #FFFFFF;

  /* Semantic Feedback */
  --color-emerald-700: #047857;      /* Thành công / Đã nhận tiền */
  --color-emerald-100: #D1FAE5;
  --color-amber-700:   #B45309;      /* Cảnh báo / Quá hạn / Chờ duyệt */
  --color-amber-100:   #FEF3C7;
  --color-rose-700:    #BE123C;      /* Nguy hiểm / Mất sách / Phạt */
  --color-rose-100:    #FFE4E6;
  --color-blue-700:    #1D4ED8;      /* Thông tin / Đang mượn */
  --color-blue-100:    #DBEAFE;
}
```

### 3.2 Semantic Tokens (Sử dụng trực tiếp trong UI)
| Token Semantic | Giá trị HEX | Vai trò / Ngữ cảnh sử dụng |
|---|---|---|
| `--color-primary` | `#151879` (Navy) | Nhận diện chính khu nội bộ, tiêu đề bảng, thanh điều hướng quầy. |
| `--color-primary-hover` | `#0D105A` | Trạng thái hover của nút Primary nội bộ. |
| `--color-accent` | `#C62828` (Red) | Nút hành động kêu gọi (CTA) nổi bật, logo badge, điểm nhấn sự kiện. |
| `--color-accent-soft` | `#FFEBEE` | Nền nhãn nổi bật, badge cảnh báo mức độ nhẹ. |
| `--color-bg-page` | `#F8FAFC` | Nền chung toàn trang (off-white giảm mỏi mắt). |
| `--color-bg-surface` | `#FFFFFF` | Nền thẻ, modal, dropdown, hàng bảng chẵn. |
| `--color-bg-subtle` | `#F1F5F9` | Nền header bảng, ô tìm kiếm, sidebar quầy sách. |
| `--color-text-main` | `#0F172A` | Màu chữ chính, tương phản 15.8:1 trên nền trắng (vượt WCAG AAA). |
| `--color-text-muted` | `#64748B` | Chữ phụ, ngày giờ, số trang, tương phản 4.6:1 trên trắng (đạt WCAG AA). |
| `--color-border` | `#E2E8F0` | Đường kẻ phân cách, viền input, viền bảng. |
| `--color-status-success` | `#047857` / `#D1FAE5` | Bản sách sẵn sàng, đã trả xong, đã đối soát khớp. |
| `--color-status-warning` | `#B45309` / `#FEF3C7` | Sách gần đến hạn (<= 2 ngày), đơn tuyển chờ chấm, tiền chờ xác nhận app. |
| `--color-status-danger` | `#BE123C` / `#FFE4E6` | Sách quá hạn, mất sách, lệch tiền quỹ, lỗi hệ thống. |
| `--color-status-info` | `#1D4ED8` / `#DBEAFE` | Bản sách đang mượn trong hạn, phiếu chuyển tiếp. |

---

## 4. Typography (Kiểu Chữ & Tỷ Lệ)

### 4.1 Cặp Font Chữ
1. **Primary Font (UI & Quản trị):** `Be Vietnam Pro` (Google Fonts, Giấy phép OFL).
   - Thiết kế tối ưu riêng cho tiếng Việt: dấu thanh rõ ràng, không bị lệch hoặc cắt dấu ngã, hỏi, nặng ở mọi size.
   - Hỗ trợ số thẳng cột (tabular numerals: `font-feature-settings: "tnum" 1`) giúp hiển thị tiền tệ thẳng hàng tuyệt đối trong các bảng tài chính.
   - Weights sử dụng: `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold).
2. **Editorial Serif Font (Tiêu đề công khai & Bài Review):** `Lora` (Google Fonts, Giấy phép OFL).
   - Phong cách sách văn học kinh điển, ấm áp, mang đậm chất biên tập tri thức.
   - Dùng cho Tiêu đề trang công khai (H1/H2), trích dẫn review, khẩu hiệu.

### 4.2 Thang kích thước chữ (Type Scale)
| Token | Font & Size | Line Height | Weight | Ứng dụng |
|---|---|---|---|---|
| `text-display` | Lora 36px (2.25rem) | 1.25 | Bold 700 | Tiêu đề Hero trang chủ công khai |
| `text-h1` | Lora 28px (1.75rem) | 1.3 | SemiBold 600 | Tiêu đề trang danh mục, chi tiết sách |
| `text-h2` | Be Vietnam Pro 20px (1.25rem) | 1.4 | SemiBold 600 | Tiêu đề module quầy sách, tên bảng lớn |
| `text-h3` | Be Vietnam Pro 16px (1.0rem) | 1.4 | SemiBold 600 | Tiêu đề section thẻ, tiêu đề modal |
| `text-body` | Be Vietnam Pro 14px (0.875rem)| 1.5 | Regular 400 | Chữ văn bản, nội dung bảng dữ liệu |
| `text-small` | Be Vietnam Pro 12px (0.75rem) | 1.4 | Medium 500 | Nhãn phụ, badge trạng thái, ghi chú |
| `text-stat` | Be Vietnam Pro 24px (1.5rem) | 1.2 | Bold 700 (tnum)| Số tiền KPI, tổng tiền quầy mượn |

### 4.3 Định dạng Chuỗi Nghiệp Vụ Bắt Buộc
* **Tiền tệ:** Luôn có dấu chấm phân cách hàng nghìn và ký hiệu `₫` phía sau (vd: `150.000 ₫`, `50.000 ₫`). Số tiền âm hoặc hoàn tiền phải có nhãn rõ ràng: `Hoàn cọc: 100.000 ₫`, `Thu phạt: 60.000 ₫`.
* **Ngày tháng:** Định dạng `DD/MM/YYYY` theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), ví dụ `18/10/2026`. Hạn mượn ghi rõ: `Hạn: 15/10/2026 (Hết ngày)`.

---

## 5. Spacing, Grid, Radius & Elevation

### 5.1 Thang khoảng cách (Spacing Scale)
Dựa trên hệ thống 4px chuẩn:
`space-1: 4px`, `space-2: 8px`, `space-3: 12px`, `space-4: 16px`, `space-5: 20px`, `space-6: 24px`, `space-8: 32px`, `space-10: 40px`, `space-12: 48px`.

### 5.2 Breakpoints & Layout Container
* **Mobile (xs/sm):** `320px` - `639px` (Kiểm tra kỹ tại mốc chuẩn `390px` iPhone/Android).
* **Tablet (md):** `640px` - `1023px` (Kiểm tra tại `768px`).
* **Desktop (lg/xl):** `1024px` trở lên (Kiểm tra tại `1440px`).
* **Container Max-Width:** Công khai `1200px` (căn giữa); Nội bộ dạng Fluid Full-Width với padding `24px` hai bên để tối đa diện tích bảng dữ liệu.

### 5.3 Radius & Shadow
* **Radius:** `rounded-sm: 4px` (Badge, Input nhỏ), `rounded-md: 8px` (Button, Input chuẩn, Card con), `rounded-lg: 12px` (Card lớn, Dialog), `rounded-full: 9999px` (Pill tag).
* **Shadow:** 
  * `shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)` (Thẻ con, nút nhấn).
  * `shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)` (Dropdown menu, quầy tiền cố định).
  * `shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)` (Modal Dialog, Drawer chi tiết).

---

## 6. Kiến Trúc Bố Cục (Layout Architecture)

### 6.1 Layout Công Khai (Public Layout)
* **Header:** Thanh điều hướng trên cùng, logo YSBK + Slogan thu gọn, Menu (Trang chủ, Danh mục sách, Bài viết & Review, Sự kiện, Lịch trực bàn sách, Kết quả tuyển), Nút Đăng nhập/Tài khoản.
* **Content:** Trình bày theo nhịp điệu phong phú: Banner tìm kiếm nổi bật, danh sách sách mới/mượn nhiều, thẻ review có hình ảnh bìa và trích dẫn, widget lịch trực sắp tới tại bàn.
* **Footer:** Thông tin CLB Yêu Sách Bách Khoa, địa chỉ kho Thư viện TQB & HSV, link Fanpage/Tiktok, ghi chú bản quyền và tuyên bố phi thương mại.

### 6.2 Layout Nội Bộ (Internal Workspace Layout)
Kế thừa cấu trúc công thái học của WarePro:
* **Sidebar (Cột trái):** Chiều rộng mặc định `240px`, có nút thu gọn thành `68px` (chỉ hiển thị icon). Chia các nhóm nghiệp vụ rõ ràng bằng tiêu đề mục (Category Headers):
  1. TỔNG QUAN (Dashboard)
  2. BÀN SÁCH & MƯỢN TRẢ (Quầy trực, Phiên tiền, Danh sách nhắc trả)
  3. KHO SÁCH (Danh mục ấn bản, Bản sách vật lý, Lô sách bán mới)
  4. NHÂN SỰ & CA TRỰC (Hồ sơ thành viên, Xếp lịch trực, Điểm danh)
  5. ĐỢT TUYỂN (Hồ sơ ứng viên, Phỏng vấn & Rubric, Chấm điểm & Kết quả)
  6. QUỸ & HOẠT ĐỘNG (Sổ quỹ 2 nguồn, Bán sách đợt, Sự kiện & Dự toán)
  7. BÁO CÁO & HỆ THỐNG (Báo cáo tuần/tháng/quý, Kiểm duyệt nội dung, Quản trị tài khoản, Audit log)
* **Top Header:** Hiển thị vị trí trực/ca hiện tại, trạng thái phiên tiền (Mở/Đóng), tìm kiếm nhanh toàn hệ thống, Role Switcher (công cụ mô phỏng vai trò demo), thông tin phiên đăng nhập.
* **Workspace Body:** Vùng làm việc chính với Tab phân vai hoặc Breadcrumb, các thẻ KPI đầu trang và bảng dữ liệu thao tác cao.

---

## 7. Thư Viện Thành Phần Giao Diện (UI Components)

Mọi component đều có đủ các trạng thái tương tác: `Default`, `Hover`, `Focus-visible`, `Active/Pressed`, `Disabled`, `Loading`, `Error`.

1. **Button:**
   - `Primary (Navy/Accent)`: Nút hành động chính (`Xác nhận cho mượn`, `Mở ca`).
   - `Secondary (Outline Slate)`: Nút thao tác phụ (`In phiếu`, `Xuất Excel mô phỏng`, `Hủy`).
   - `Danger (Rose)`: Nút hành động rủi ro (`Báo mất sách`, `Khóa tài khoản`).
   - `Ghost`: Nút trong thanh công cụ, icon action trong bảng.
2. **Form Controls:**
   - Input/Select/Search: Có viền rõ nét `border-slate-300`, focus ring `ring-2 ring-brand-navy`.
   - Error state: Viền đỏ `border-rose-500`, thông báo lỗi kèm icon cảnh báo ngay dưới trường.
   - Money Input: Căn lề phải, tự động định dạng dấu phân cách, hiển thị kèm tiền tố/hậu tố `₫`.
3. **Badge & Status Pill:**
   - Có cả biểu tượng + chữ + màu nền nhạt, không dùng màu đơn thuần để truyền tải trạng thái.
4. **Data Table:**
   - Header cố định, màu nền `bg-slate-50`.
   - Hàng bảng có hover `hover:bg-slate-50/80`.
   - Trên di động: Tự động chuyển đổi thành dạng danh sách thẻ (Card view) hoặc có thanh cuộn ngang mượt mà có chỉ báo bóng (scroll shadow).
5. **Metric Card (KPI):**
   - Icon vuông góc bo tròn với màu nền pastel tương ứng.
   - Số liệu to đậm rõ ràng (24px tabular).
   - Nhãn phụ giải thích bên dưới (vd: *"So với buổi trực trước: +12 lượt"*).
6. **Notification Toast & Banner:**
   - Toast góc phải trên, tự đóng sau 4s hoặc có nút đóng tay.
   - Banner cảnh báo mất kết nối / chưa rõ trạng thái lưu: Vàng nổi bật đầu trang, hướng dẫn rõ ràng: *"Vui lòng không bấm gửi lại tiền khi chưa kiểm tra sao kê app ngân hàng"*.

---

## 8. Sitemap Chi Tiết Theo 9 Nhóm Chức Năng (FR-01 → FR-09)

| Khu vực | Route / Tên màn hình | Nội dung & Thao tác nghiệp vụ chính | Ma trận quyền truy cập |
|---|---|---|---|
| **Công khai** | `/` (Trang chủ) | Tìm kiếm sách, giới thiệu CLB, lịch trực bàn sách tuần này, hoạt động nổi bật. | Tất cả (Ẩn danh, Khách, Cựu, Thành viên) |
| **Công khai** | `/sach` (Tra cứu sách) | Danh mục sách, bộ lọc thể loại/tác giả/tình trạng khả dụng, phân trang. | Tất cả |
| **Công khai** | `/sach/:id` (Chi tiết sách) | Thông tin ấn bản, số bản sẵn sàng tại bàn/kho, danh sách review đã duyệt, form gửi review. | Form review yêu cầu Khách có tài khoản |
| **Công khai** | `/bai-viet` (Review & Cảm nhận) | Danh sách bài viết lan tỏa văn hóa đọc, chuyên mục cảm nhận của bạn đọc. | Tất cả |
| **Công khai** | `/lich-hoat-dong` (Lịch trực & Sự kiện)| Buổi trực thứ 3, thứ 5 đã công bố, sự kiện ngày hội sách, workshop. | Tất cả |
| **Công khai** | `/tuyen-thanh-vien/ket-qua` | Kết quả tuyển thành viên các Gen (chỉ hiện Họ tên, Mã ứng viên, Ban trúng tuyển đã duyệt). | Công khai các trường an toàn |
| **Đăng nhập** | `/login` (Đăng nhập) | Tab 1: Khách (Google / Email+Pass). Tab 2: Thành viên/Cựu (Username nội bộ + Mật khẩu). | Khách / Thành viên |
| **Quầy sách** | `/noi-bo/quay-sach` | **Mở/Đóng ca trực**, đếm tiền mặt, tìm bạn đọc & bản sách, **Lập phiếu mượn (max 2 cuốn)**, tính cọc tự động, **Trả sách toàn bộ / một phần (phiếu chuyển tiếp)**, Gia hạn, Báo mất, Danh sách gọi nhắc trả. | Thành viên hoạt động, Admin |
| **Kho sách** | `/noi-bo/kho-sach` | Quản lý danh mục ấn bản, vị trí bản sách (Kho Thư viện TQB / Kho HSV / Bàn trực tạm), form nhập sách mới, preview import Excel. | Thành viên hoạt động, Admin |
| **Thành viên** | `/noi-bo/thanh-vien` | Danh sách thành viên, Ban/Chức vụ theo thời gian, Khóa/Trường, trạng thái Đủ điều kiện trực chính, đóng Hội phí một lần, chuyển cựu. | Thành viên hoạt động, Admin |
| **Trực sách** | `/noi-bo/truc-sach` | Tải lên Excel tổng hợp lịch học, xem trước lỗi/trùng, **Gợi ý phân ca tự động** (2 chính + 3-5 hỗ trợ), chỉnh tay, công bố & sao chép mẫu đăng Facebook, điểm danh ca. | Thành viên hoạt động, Admin |
| **Tuyển dụng** | `/noi-bo/tuyen-thanh-vien` | Quản lý đợt tuyển (Gen), mô phỏng đồng bộ đơn Google Form tức thì, danh sách nguyện vọng, **Chấm điểm phỏng vấn riêng**, **Tổng kết hội đồng**, lưu lịch sử sửa điểm, công bố kết quả. | Thành viên hoạt động, Admin |
| **Quỹ & Bán** | `/noi-bo/tai-chinh` | **2 Sổ quỹ tách biệt** (Quỹ mượn–trả & Quỹ hoạt động), ghi nhận tiền mặt/ngân hàng, đối soát hộp tiền buổi trực; **Quản lý lô sách bán mới** (nhận lô, cọc nhà sách, chiết khấu, bán thu tiền ngay, trả hàng dư, quyết toán riêng). | Thành viên hoạt động, Admin |
| **Sự kiện** | `/noi-bo/su-kien` | Kế hoạch ngày hội sách, danh sách phân công nhiệm vụ, dự toán & chi phí thực tế liên kết sổ quỹ. | Thành viên hoạt động, Admin |
| **Nội dung** | `/noi-bo/kiem-duyet` | Hàng chờ duyệt đánh giá/bình luận/cảm nhận của bạn đọc, xem trước, nút Phê duyệt / Từ chối kèm lý do. | Thành viên hoạt động, Admin |
| **Báo cáo** | `/noi-bo/bao-cao` | Báo cáo tuần/tháng/kỳ học, biểu đồ tỷ lệ mượn/trả, tồn cọc, đối soát tiền, mô phỏng xuất Excel/PDF. | Thành viên hoạt động, Admin |
| **Cựu TV** | `/noi-bo/cuu-thanh-vien` | **Màn hình hoạt động dành riêng cho Cựu thành viên:** Xem tin tức hoạt động, sự kiện, lịch trực đã công bố. **Tuyệt đối ẩn:** Sổ quỹ, số tiền cọc/phạt, số tài khoản, PII bạn đọc/ứng viên, nút xuất file, chức năng chỉnh sửa. | Cựu thành viên |
| **Admin** | `/noi-bo/admin` | Quản lý tài khoản (cấp username, reset pass, khóa tài khoản, phân quyền), tra cứu Audit Logs toàn hệ thống. | Chỉ Quản trị viên (Admin) |

---

## 9. Quy Tắc Thể Hiện Nghiệp Vụ Trên UI (Business UI Rules)

1. **Công thức tiền cọc tự động:**
   * Cọc theo từng quyển: `max(50000, floor((gia + 25000) / 50000) * 50000)`.
   * Ví dụ: Sách `20k` → cọc `50k`; `74k` → cọc `50k`; `75k` → cọc `100k`; `230k` → cọc `250k`. Không áp trần 200k.
   * Sách không có giá bìa: Hiển thị giá *"Chưa có giá"*, tự động tính cọc `50.000 ₫` với nhãn ghi chú: *(Áp dụng mức cọc mặc định cho sách chưa có giá)*. Tuyệt đối không tự điền giá giả 50k vào trường giá bìa.
2. **Quy tắc tính hạn & Gia hạn:**
   * Hạn mượn chuẩn: Đúng 14 ngày lịch (Mượn 1/10 → Hạn 15/10).
   * Lịch nghỉ lễ/Tết: Nếu ngày đến hạn trùng lịch nghỉ, hệ thống tự động dời hạn đến buổi trực thực tế tiếp theo mà không trừ số lần gia hạn.
   * Gia hạn trong hạn: Cộng tiếp 14 ngày vào hạn cũ (vd: Hạn 15/10 gia hạn thành 29/10).
   * Gia hạn khi đã quá hạn: Quyết toán chốt phạt cũ, sau đó tính 14 ngày mới kể từ ngày gia hạn (tối đa 3 lần gia hạn trên cùng 1 phiếu).
3. **Tiền phạt & Tất toán:**
   * Phạt chuẩn: `1.000 ₫/ngày` trên toàn bộ phiếu (không nhân theo số lượng sách).
   * UI hiển thị 3 dòng minh bạch: Mức hệ thống tính toán → Mức đề xuất chốt → Ô nhập lý do nếu giảm/miễn về 0.
   * Trần phạt: So sánh với **tổng tiền cọc của phiếu**. Nếu phạt < cọc (vd: cọc 150k, phạt 60k), khi trả đủ sách sẽ hiển thị 2 dòng riêng biệt: `Hoàn cọc: 150.000 ₫` và `Thu phạt: 60.000 ₫`. Nếu phạt >= cọc: Giữ toàn bộ cọc, không thu thêm.
4. **Trả một phần (Phiếu chuyển tiếp):**
   * Khách trả 1 cuốn, giữ 1 cuốn: Quyết toán tiền phạt của phiếu cũ ngay tại thời điểm trả. Cuốn còn giữ được tạo thành một **Phiếu mượn chuyển tiếp**, reset lại 14 ngày mượn và 3 lần gia hạn. Khoản cọc tương ứng được chuyển liên kết, không tạo giao dịch thu/hoàn tiền giả.
   * Nếu tiền phạt phiếu cũ đã dùng hết toàn bộ cọc (150k) mà khách muốn giữ tiếp cuốn cọc 100k: Giữ 150k cọc cũ làm phạt, yêu cầu thu mới 100k cọc cho phiếu chuyển tiếp. UI hiển thị rõ: *"Thu cọc mới: 100.000 ₫"*.
5. **Đối soát phiên quầy & 2 Quỹ riêng biệt:**
   * Quỹ mượn–trả và Quỹ hoạt động hiển thị ở 2 tab độc lập, có số dư riêng.
   * Cuối buổi trực: Form kiểm tiền hiển thị 3 cột: `Số tiền theo sổ sách` | `Số tiền thực đếm` | `Chênh lệch`. Bắt buộc nhập lý do nếu có chênh lệch, không tự ý sửa số sổ sách cho khớp.
   * Chuyển khoản: Luôn hiển thị badge `Chờ xác nhận app ngân hàng` cho đến khi người trực tích chọn `Đã kiểm tra tiền vào/ra trên app`.
6. **Bán sách mới theo lô:**
   * Tách biệt với kho sách mượn.
   * Khi thanh toán nhà sách: Tách bạch giao dịch `Nhận hoàn cọc nhà sách: 1.000.000 ₫` và `Thanh toán tiền sách: 3.900.000 ₫`, không gộp thành 1 khoản chi ròng 2.900.000 ₫. Khách mua sách thanh toán ngay, không bán nợ, không đổi trả.

---

## 10. Tiếp Cận (Accessibility), Responsive & Tương Phản

* **Tiêu chuẩn tương phản WCAG 2.2 AA:**
  * Chữ thông thường: Độ tương phản tối thiểu `4.5:1` đối với màu nền.
  * Chữ lớn (>=18pt hoặc >=14pt bold): Độ tương phản tối thiểu `3.0:1`.
  * Các trạng thái tương tác và nút bấm: Màu border/focus ring đạt tối thiểu `3.0:1` so với nền.
* **Hỗ trợ bàn phím:**
  * Toàn bộ các form quầy mượn–trả, tìm kiếm và nút thao tác có thể điều hướng bằng phím `Tab`.
  * Phím tắt quầy: `F2` (Tìm sách nhanh), `F4` (Tìm bạn đọc), `Enter` (Xác nhận dòng), `Esc` (Đóng popup).
  * Vùng focus nhìn thấy rõ ràng: `outline: 2px solid var(--color-brand-navy); outline-offset: 2px;`.
* **Mobile Responsiveness:**
  * Đảm bảo diện tích chạm ngón tay tối thiểu `44x44px` cho tất cả các nút bấm và icon tương tác trên màn hình di động.
  * Form quầy sách trên điện thoại bố trí các nút CTA (`Xác nhận`, `Hủy`) cố định ở thanh đáy (sticky bottom bar) để thuận tiện thao tác bằng một tay, có khoảng đệm chống che khuất nội dung.

---

## 11. Bảng Ánh Xạ Tokens Sang Tailwind & CSS Variables

| Design Token | CSS Variable | Tailwind Utility Class | Component Áp Dụng |
|---|---|---|---|
| Brand Primary | `--color-brand-navy` | `bg-brand-navy`, `text-brand-navy` | Sidebar, Topbar, Header bảng, Nút Primary |
| Brand Accent | `--color-brand-red` | `bg-brand-red`, `text-brand-red` | Logo accent, Badge khẩn cấp, CTA mua/mượn |
| Brand Gold | `--color-brand-gold` | `bg-brand-gold`, `text-brand-gold` | Icon sao, Đánh giá rating, Cảnh báo nhẹ |
| Page Background | `--color-bg-page` | `bg-slate-50` | Nền toàn bộ trang web |
| Surface | `--color-bg-surface` | `bg-white` | Thẻ Card, Modal, Dropdown, Table rows |
| Border | `--color-border` | `border-slate-200` | Khung viền Input, Divider, Table border |
| Text Primary | `--color-text-main` | `text-slate-900` | Tiêu đề, chữ chính trong bảng, giá tiền |
| Text Muted | `--color-text-muted` | `text-slate-500` | Nhãn phụ, thời gian, placeholder, mã bản sách |
| Status Success | `--color-status-success` | `bg-emerald-50 text-emerald-700` | Badge `Sẵn sàng`, `Đã trả`, `Khớp sổ` |
| Status Danger | `--color-status-danger` | `bg-rose-50 text-rose-700` | Badge `Quá hạn`, `Mất sách`, `Lệch tiền` |
| Status Warning | `--color-status-warning` | `bg-amber-50 text-amber-700` | Badge `Gần hạn`, `Chờ duyệt`, `Chờ xác nhận app` |
| Status Info | `--color-status-info` | `bg-blue-50 text-blue-700` | Badge `Đang mượn`, `Chuyển tiếp` |

---

## 12. Checklist Nghiệm Thu UI Prototype & Điểm Chưa Xác Thực

### 12.1 Danh sách kiểm tra nghiệm thu
- [x] Có đầy đủ 9 nhóm chức năng (FR-01 → FR-09) trong prototype.
- [x] Không gian công khai và không gian nội bộ dùng chung bộ nhận diện nhưng khác biệt rõ ràng về mật độ thông tin.
- [x] Công thức tính tiền cọc tự động kiểm thử chính xác mọi mốc giá (20k, 74k, 75k, 230k, sách không giá).
- [x] Luồng trả một phần hiển thị đúng phiếu chuyển tiếp, chuyển liên kết cọc và quyết toán phạt cũ.
- [x] Phiên quầy có đầy đủ form mở/đóng ca, đếm tiền mặt, đối soát chênh lệch và tách bạch 2 sổ quỹ.
- [x] Màn hình Cựu thành viên bị khóa hoàn toàn các trường nhạy cảm, không có nút xuất file và không có chức năng ghi.
- [x] Giao diện hiển thị tốt trên cả 3 viewport kiểm tra: `390px` (Mobile), `768px` (Tablet) và `1440px` (Desktop).
- [x] Dữ liệu mẫu (Mock data) đồng bộ, nhất quán và chỉ dùng dữ liệu giả định.

### 12.2 Các điểm còn tạm & Cần xác thực thêm với CLB
1. **Asset Logo Vector:** Hiện dùng file bitmap PNG trích xuất từ Weebly (`public/assets/logo-ysbk.png`). Cần xin file thiết kế gốc (AI/SVG) từ Ban Truyền thông YSBK để đạt độ sắc nét vô hạn trên màn hình Retina.
2. **Quy chuẩn Font chữ chính thức:** CLB chưa có Brand Guideline bằng văn bản; `Be Vietnam Pro` và `Lora` là đề xuất kỹ thuật tối ưu nhất hiện tại.
3. **Giờ thu dọn ca trực:** Mốc `13:45-14:00` (chuẩn bị) và `17:00-17:15` (thu dọn) là quy ước tạm dựa trên phát biểu "15 phút đầu/cuối". Cần xác nhận lại xem 15 phút thu dọn nằm trong ca (16:45-17:00) hay sau ca.
4. **Mẫu Excel tổng hợp lịch học:** Cần Quản lý Hậu cần bàn giao mẫu file chuẩn để khóa định dạng parser.
