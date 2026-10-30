# YSBK — Landing Page Sách Lật Nghệ Thuật (Artistic Flipbook)

Trang giới thiệu trực tuyến được thiết kế theo phong cách cuốn sách lật nghệ thuật 3D tương tác của **CLB Yêu Sách Bách Khoa (YSBK)** — Đại học Bách khoa Hà Nội.

🌐 **Trải nghiệm trực tiếp:** [https://thegiver262.github.io/ysbk-landing/](https://thegiver262.github.io/ysbk-landing/)

---

## 🌟 Điểm nổi bật (Highlights)

### 1. Trải nghiệm Sách lật 3D Trực quan (Interactive Flipbook)
- **Hiệu ứng lật trang sống động**: Tái hiện cảm giác cầm một cuốn sách thật với hiệu ứng mở bìa cứng, lật từng trang giấy, bóng đổ bề mặt và nếp gấp trang tự nhiên theo thời gian thực.
- **Điều hướng đa phương thức**: 
  - Click hoặc vuốt trực tiếp trên các góc trang sách.
  - Phím mũi tên (`Left` / `Right`) trên bàn phím.
  - Thanh nút điều hướng trực quan cùng tiến độ đọc hiển thị theo từng chương.
- **Nội dung 10 chương kỷ niệm**: Gồm 20 trang giới thiệu trọn vẹn lịch sử hình thành, các sự kiện tiêu biểu, đội ngũ thành viên và các hoạt động cộng đồng nổi bật của CLB.

### 2. Âm thanh nền nhẹ nhàng & Hoài niệm (Atmospheric Audio)
- Tích hợp bản nhạc nền êm dịu đồng hành cùng từng trang sách lật.
- Tuân thủ nghiêm ngặt chính sách Web Audio/Autoplay của các trình duyệt hiện đại (phát nhạc sau tương tác đầu tiên của người xem).
- Nút bật/tắt (mute/unmute) âm thanh trực quan ở góc màn hình.

### 3. Tối ưu hóa hiệu năng & Dung lượng cao cấp (Performance & Bandwidth)
- **100% tài nguyên ảnh chuẩn WebP**: Nén và chuyển đổi toàn bộ hình ảnh sang định dạng WebP thế hệ mới, giúp giảm hơn **77.6%** dung lượng tải trang mà vẫn giữ trọn vẹn chất lượng thị giác.
- **Content-addressed Caching (SHA-256)**: Mọi tài nguyên media, font chữ và stylesheet được gắn mã băm nội dung để tận dụng bộ nhớ đệm trình duyệt lâu dài (`immutable cache`).
- **Font chữ tự host (Self-hosted Fonts)**: Toàn bộ phông chữ mỹ thuật (Lora, Newsreader, Be Vietnam Pro, Dancing Script) được lưu trữ trực tiếp, hỗ trợ hoàn hảo bộ ký tự tiếng Việt có dấu mà không phụ thuộc vào máy chủ thứ ba.

### 4. Tương thích đa thiết bị (Responsive Design)
- Tự động nhận diện và thích ứng thông minh trên mọi kích thước màn hình từ Desktop, Laptop, Tablet cho đến điện thoại di động (iOS & Android).
- Bố cục canvas thông minh trên thiết bị di động giúp người dùng có góc nhìn trang sách rộng rãi, không bị che khuất nội dung.

### 5. An toàn & Độc lập hoàn toàn (Zero-Backend Static Architecture)
- Kiến trúc tĩnh hoàn toàn (Static Site), không yêu cầu database hay backend API.
- Thiết lập Content Security Policy (CSP) chặt chẽ, tối đa hóa bảo mật và tốc độ tải trang tức thì.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Framework**: [Astro](https://astro.build/) — Nền tảng xây dựng website tĩnh hiện đại, siêu nhẹ và tối ưu SEO.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) kết hợp Custom CSS Variables & 3D Transforms.
- **Core Engine**: HTML5 Canvas, Vanilla JavaScript ES Modules, Web Audio API.
- **Package Manager**: [pnpm](https://pnpm.io/) (v11+).
- **Deployment**: Tự động hóa qua **GitHub Actions** lên **GitHub Pages**.

---

## 🚀 Hướng dẫn phát triển & Chạy cục bộ (Local Development)

### Yêu cầu môi trường
- **Node.js**: v22 trở lên.
- **pnpm**: v11.21.0 hoặc mới hơn.

### Các bước cài đặt

1. **Clone repository về máy**:
   ```bash
   git clone https://github.com/TheGiver262/ysbk-landing.git
   cd ysbk-landing
   ```

2. **Cài đặt các gói phụ thuộc**:
   ```bash
   pnpm install
   ```

3. **Chạy máy chủ phát triển (Development Server)**:
   ```bash
   pnpm run dev
   ```
   Mở trình duyệt tại: `http://localhost:4321`

4. **Chạy kiểm thử (Unit & Integration Tests)**:
   ```bash
   # Chạy toàn bộ test unit logic lật sách và âm thanh
   pnpm run test:unit

   # Chạy toàn bộ quy trình kiểm thử và security gate
   pnpm run test
   ```

5. **Build đóng gói sản phẩm tĩnh**:
   ```bash
   pnpm run build
   ```
   Thư mục xuất bản sau khi build: `dist-landing/`

---

## 📁 Cấu trúc dự án (Project Structure)

```text
ysbk-landing/
├── .github/workflows/         # Kịch bản CI/CD GitHub Actions deploy tự động lên Pages
├── landing/                   # Thư mục gốc Astro pages
├── public/
│   └── book/
│       ├── assets/            # Hình ảnh WebP, font chữ WOFF2/TTF, file âm thanh MP3
│       ├── book.mjs           # Engine xử lý hiệu ứng lật trang 3D và rendering
│       ├── book-content.mjs   # Nội dung văn bản và hình ảnh của 10 chương sách
│       ├── book-music.mjs     # Quản lý phát nhạc nền và xử lý tương tác người dùng
│       └── book-backdrop.mjs  # Xử lý hình nền cảnh quan chân trời thích ứng
├── scripts/
│   └── build-landing.mjs      # Script build tĩnh, gắn mã băm tài nguyên và security gate
├── src/
│   ├── components/            # Astro components
│   ├── pages/                 # Entry point index.astro
│   └── styles/                # CSS styling cho sách và responsive layout
└── tests/
    ├── integration/           # Kiểm thử tích hợp output sau khi build
    └── unit/                  # Kiểm thử đơn vị cho logic toán học, lật trang và âm thanh
```

---

## 📖 Về CLB Yêu Sách Bách Khoa (YSBK)

**CLB Yêu Sách Bách Khoa (YSBK)** được thành lập vào ngày **10/10/2012** tại Trường Đại học Bách khoa Hà Nội. Trải qua hơn một thập kỷ hoạt động, YSBK luôn là ngôi nhà chung cho những người yêu thích tri thức, nơi lan tỏa văn hóa đọc đến sinh viên Bách khoa nói riêng và cộng đồng người trẻ nói chung thông qua:
- Tủ sách mượn miễn phí dành cho sinh viên.
- Các buổi chia sẻ sách định kỳ, giao lưu tác giả và diễn giả.
- Gian hàng Ngày hội Sách Việt Nam thường niên.
- Các hoạt động ngoại khóa, dã ngoại và gắn kết cộng đồng ý nghĩa.

---

## 📄 Bản quyền (License)

Mã nguồn được phân phối phục vụ mục đích học tập và giới thiệu hoạt động câu lạc bộ. Toàn bộ hình ảnh hoạt động, tư liệu lịch sử và logo thuộc quyền sở hữu của **CLB Yêu Sách Bách Khoa**.
