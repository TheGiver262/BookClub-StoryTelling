# BookClub-StoryTelling — Landing Page Sách Lật Nghệ Thuật (Artistic Flipbook)

Trang giới thiệu trực tuyến được thiết kế theo phong cách cuốn sách lật nghệ thuật 3D tương tác của **CLB Yêu Sách Bách Khoa (YSBK)** — Đại học Bách khoa Hà Nội.

🌐 **Trải nghiệm trực tiếp:** [https://thegiver262.github.io/BookClub-StoryTelling/](https://thegiver262.github.io/BookClub-StoryTelling/)

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

## 🚀 Hướng dẫn Triển khai & Chạy trang web (Quick Start & Deployment)

Dự án này là trang web tĩnh thuần túy (**Zero-Backend Static Site**), do đó bạn có thể đưa lên mạng hoàn toàn **miễn phí** thông qua **GitHub Pages** mà không cần thuê hosting hay máy chủ riêng. Dưới đây là 2 hướng dẫn dành cho bạn:

---

### Cách 1: Đưa lên GitHub Pages (`.github.io`) trong 3 phút (Dành cho sinh viên)

> [!TIP]
> Bạn **không cần cài đặt bất kỳ phần mềm nào trên máy tính** cho cách này! Mọi thao tác build và deploy đều do GitHub Actions tự động thực hiện trên đám mây.

#### 📌 Bước 1: Fork dự án về tài khoản GitHub của bạn
1. Đăng nhập vào tài khoản GitHub của bạn.
2. Truy cập vào repository: [https://github.com/TheGiver262/BookClub-StoryTelling](https://github.com/TheGiver262/BookClub-StoryTelling).
3. Nhìn lên góc trên bên phải màn hình và nhấn vào nút **Fork**.
4. Bạn có thể giữ nguyên tên repository là `BookClub-StoryTelling` hoặc đổi tên theo ý muốn (ví dụ: `my-bookclub`, `clb-sach`). Nhấn **Create fork**.

#### 📌 Bước 2: Bật tính năng GitHub Pages với GitHub Actions
1. Tại repository bạn vừa Fork về, nhấn vào tab **Settings** (biểu tượng bánh răng ở thanh menu trên cùng).
2. Ở cột menu bên trái, tìm và chọn mục **Pages** (trong nhóm *Code and automation*).
3. Tại phần **Build and deployment**:
   * Tại mục **Source**, nhấn vào menu thả xuống và chọn: **GitHub Actions** (thay vì *Deploy from a branch* mặc định).

#### 📌 Bước 3: Cho phép GitHub Actions chạy tự động (Enable Workflows)
1. Chuyển sang tab **Actions** trên thanh menu của repository.
2. Nếu màn hình hiển thị thông báo *"Workflows aren’t being run on this forked repository"*, bạn chỉ cần nhấn vào nút màu xanh: **"I understand my workflows, go ahead and enable them"**.
3. Ở danh sách workflow bên trái, chọn **Deploy to GitHub Pages**:
   * Nhấn vào nút **Run workflow** (ở bên phải) -> chọn nhánh `main` -> nhấn **Run workflow** màu xanh để kích hoạt lần build đầu tiên.
   * *(Từ những lần sau, mỗi khi bạn chỉnh sửa hoặc commit code lên nhánh `main`, GitHub sẽ tự động build và deploy lại trong khoảng 1–2 phút).*

#### 📌 Bước 4: Thưởng thức website của bạn
1. Sau khi workflow chạy thành công (hiện dấu tích xanh ✔️), quay lại tab **Settings** -> **Pages**.
2. Bạn sẽ thấy đường dẫn trang web chính thức của bạn có dạng:
   $$\text{https://<tên-tài-khoản-github>.github.io/<tên-repository>/}$$
   *(Ví dụ: `https://nguyenvana.github.io/BookClub-StoryTelling/`)*
3. Nhấp vào liên kết để trải nghiệm trang web sách lật 3D sống động!

---

### Cách 2: Chạy thử và Phát triển trên máy tính với VS Code (Local Development)

Dành cho các bạn sinh viên muốn mở mã nguồn trong **Visual Studio Code (VS Code)**, chỉnh sửa nội dung, thay ảnh thành viên và cá nhân hóa cuốn sách cho CLB/Tổ chức của mình.

---

#### 💻 Bước 1: Chuẩn bị môi trường & Công cụ theo Hệ điều hành

Dự án yêu cầu **Git**, **Node.js (v20+ hoặc v22 LTS, khuyến nghị Node 22/24)** và **pnpm (v11.21.0)**. Dưới đây là hướng dẫn cài đặt chi tiết:

<details open>
<summary><b>🪟 Dành cho người dùng Windows (Lưu ý đặc biệt quan trọng về PowerShell & đuôi <code>.cmd</code>)</b></summary>

> [!IMPORTANT]
> **Quy tắc vàng trên Windows**: Luôn dùng **`npm.cmd`** và **`pnpm.cmd`** thay vì chỉ gõ `npm` hay `pnpm`.
> 
> * **Vì sao?** Trên Windows, khi bạn gõ `pnpm` trong PowerShell, PowerShell sẽ ưu tiên gọi script `pnpm.ps1`. Do mặc định Windows chặn chạy file script (`ExecutionPolicy = Restricted`), hệ thống sẽ quăng lỗi: *"...cannot be loaded because running scripts is disabled on this system"* hoặc *PSSecurityException*.
> * **Giải pháp triệt để**: Thêm đuôi **`.cmd`** (ví dụ: `pnpm.cmd run dev`). Lệnh này sẽ chạy file Batch trực tiếp của Windows, **hoàn toàn không bị PowerShell chặn**, không cần quyền Administrator và không cần đổi chính sách bảo mật máy tính!

1. **Cài đặt Node.js & Git**:
   * Tải bản **Node.js LTS** tại [nodejs.org](https://nodejs.org/) (chọn Windows Installer `.msi`) và cài đặt bình thường.
   * Tải **Git** tại [git-scm.com](https://git-scm.com/) và nhấn Next hoàn tất cài đặt.
   * *(Hoặc mở PowerShell gõ: `winget install OpenJS.NodeJS.LTS Git.Git`)*.

2. **Cài đặt `pnpm` chuẩn phiên bản**:
   Đóng và mở lại cửa sổ Terminal / PowerShell mới để nhận lệnh Node vừa cài, sau đó chạy:
   ```powershell
   node --version
   npm.cmd install --global pnpm@11.21.0
   pnpm.cmd --version
   ```
   *(Kết quả `pnpm.cmd --version` phải trả về phiên bản `11.21.0` hoặc mới hơn).*

3. **Nếu báo lỗi "pnpm.cmd is not recognized" sau khi cài**:
   Thư mục lưu lệnh global của npm chưa nằm trong biến môi trường `PATH` của bạn. Bạn kiểm tra bằng lệnh:
   ```powershell
   npm.cmd config get prefix
   ```
   *(Thông thường là `C:\Users\<Tên-Bạn>\AppData\Roaming\npm`). Bạn chỉ cần đóng và mở lại VS Code / Terminal, hoặc thêm đường dẫn trên vào biến Environment Variables `PATH` của Windows.*
</details>

<details open>
<summary><b>🍎 Dành cho người dùng macOS</b></summary>

> [!NOTE]
> Trên macOS và Linux, **tuyệt đối KHÔNG dùng đuôi `.cmd`** (đuôi này chỉ dành riêng cho Windows). Sử dụng `npm` và `pnpm` bình thường.

1. **Cài đặt công cụ**:
   * **Nếu máy có Homebrew** (khuyên dùng): Mở Terminal và chạy:
     ```bash
     brew install git node pnpm
     ```
   * **Nếu chưa có Homebrew**: Tải file cài đặt `.pkg` của **Node.js LTS** tại [nodejs.org](https://nodejs.org/) để cài đặt, sau đó mở Terminal chạy:
     ```bash
     npm install --global --prefix "$HOME/.local" pnpm@11.21.0
     export PATH="$HOME/.local/bin:$PATH"
     pnpm --version
     ```
2. Để lệnh `pnpm` luôn có hiệu lực ở các terminal sau, bạn thêm dòng `export PATH="$HOME/.local/bin:$PATH"` vào tệp `~/.zshrc` (trên macOS zsh).
</details>

<details open>
<summary><b>🐧 Dành cho người dùng Linux (Ubuntu / Debian / Fedora)</b></summary>

Mở Terminal và thực thi chuỗi lệnh sau:
```bash
# 1. Cập nhật hệ thống & cài đặt Git, cURL
sudo apt update && sudo apt install -y git curl

# 2. Cài đặt Node.js v22 LTS qua NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Cài đặt pnpm độc lập (không cần sudo)
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc
pnpm --version
```
</details>

---

#### 💻 Bước 2: Tải mã nguồn về máy & Mở bằng VS Code

1. **Tải repository về máy tính**:
   Mở Terminal / PowerShell và chạy:
   ```bash
   # Thay <tên-tài-khoản> bằng username GitHub của bạn
   git clone https://github.com/<tên-tài-khoản>/BookClub-StoryTelling.git
   
   cd BookClub-StoryTelling
   ```

2. **Mở dự án trong VS Code**:
   * Gõ lệnh: `code .` ngay tại thư mục vừa clone, hoặc:
   * Mở VS Code -> chọn menu **File** -> **Open Folder...** -> chọn thư mục `BookClub-StoryTelling`.

3. **Mở Terminal tích hợp trong VS Code**:
   * **Trên Windows / Linux**: Bấm tổ hợp phím **`Ctrl + ``** (phím dấu huyền cạnh số 1).
   * **Trên macOS**: Bấm tổ hợp phím **`Cmd + ``**.
   * Hoặc nhìn lên menu trên cùng chọn **Terminal** -> **New Terminal**.

4. **Tiện ích mở rộng (VS Code Extensions) khuyên dùng cho sinh viên**:
   * Vào tab Extensions (`Ctrl + Shift + X` trên Win/Linux hoặc `Cmd + Shift + X` trên Mac) và tìm cài:
     * **Astro** (tác giả *Astro*): Hỗ trợ gợi ý code và định dạng tệp Astro.
     * **Tailwind CSS IntelliSense**: Tự động gợi ý class styling.

---

#### 💻 Bước 3: Cài đặt thư viện & Khởi chạy máy chủ phát triển (Dev Server)

Ngay tại cửa sổ **Terminal bên trong VS Code**, bạn gõ lệnh tương ứng với hệ điều hành của mình:

* **Trên Windows (PowerShell / Command Prompt)**:
  ```powershell
  pnpm.cmd install --frozen-lockfile
  pnpm.cmd run dev
  ```
* **Trên macOS / Linux**:
  ```bash
  pnpm install --frozen-lockfile
  pnpm run dev
  ```

Sau khi lệnh chạy, màn hình terminal sẽ hiển thị:
```text
  🚀  astro  v7.4.x started in ...ms
  ┃ Local    http://localhost:4321/
```
* Bấm giữ phím `Ctrl` (hoặc `Cmd` trên Mac) và nhấp chuột vào link `http://localhost:4321/` để mở trình duyệt.
* Bạn sẽ thấy cuốn sách 3D xuất hiện trực tiếp ngay trên máy của mình! Terminal sẽ giữ kết nối phục vụ dev server, bạn để cửa sổ này chạy và không tắt.

---

#### 💻 Bước 4: Tự do tùy biến câu chuyện cho CLB/Tổ chức của bạn

VS Code hỗ trợ tự động làm mới trang web (**Hot Reload**) ngay khi bạn nhấn `Ctrl + S` / `Cmd + S`:

* **Chỉnh sửa nội dung câu chuyện (Chương, Tiêu đề, Lời tựa)**:
  * Trong cây thư mục bên trái của VS Code, mở tệp: [`content/ysbk-story.json`](content/ysbk-story.json).
  * Bạn có thể đổi tên CLB (`brand.name`), khẩu hiệu (`brand.tagline`), ngày thành lập, tiêu đề 10 chương sách và các đoạn văn bản.
* **Thay đổi hình ảnh hoạt động của CLB**:
  * Đặt ảnh mới của bạn vào thư mục [`public/book/assets/`](public/book/assets/) (khuyến khích định dạng `.webp`, `.png` hoặc `.jpg`).
  * Khai báo đúng tên file ảnh trong `content/ysbk-story.json`.  
    *(Lưu ý: Hệ thống phân biệt chữ hoa và chữ thường, ví dụ `photo.jpg` khác `Photo.JPG`).*
* **Thay nhạc nền**:
  * Đặt file nhạc của bạn vào `public/book/assets/` và cập nhật trường `music.file` trong file cấu hình.

---

#### 💻 Bước 5: Kiểm tra và Đóng gói sản phẩm (Build & Test)

Dừng dev server bằng cách bấm **`Ctrl + C`** trong Terminal. Sau đó chạy chuỗi lệnh kiểm tra và đóng gói:

* **Trên Windows**:
  ```powershell
  # 1. Chạy bài kiểm thử logic lật sách và âm thanh
  pnpm.cmd run test:unit

  # 2. Đóng gói sản phẩm tĩnh hoàn chỉnh (Static Build)
  pnpm.cmd run build

  # 3. Chạy thử nghiệm bản build trước khi phát hành
  pnpm.cmd run preview
  ```
* **Trên macOS / Linux**:
  ```bash
  pnpm run test:unit
  pnpm run build
  pnpm run preview
  ```
Mở `http://localhost:4321/` (hoặc URL hiển thị trên terminal) để xem trước bản build production cuối cùng.

---

#### 📱 Mẹo hay: Xem thử website trên điện thoại thật qua Wi-Fi
Kết nối máy tính và điện thoại của bạn vào cùng một mạng Wi-Fi, sau đó chạy lệnh:
* **Trên Windows**: `pnpm.cmd run preview --host 0.0.0.0 --port 4322`
* **Trên macOS/Linux**: `pnpm run preview --host 0.0.0.0 --port 4322`

Màn hình terminal sẽ in ra địa chỉ mạng nội bộ (Network URL), ví dụ `http://192.168.1.15:4322/`. Mở trình duyệt trên điện thoại và truy cập địa chỉ này để trải nghiệm cảm giác vuốt lật trang sách trực tiếp trên màn hình cảm ứng!

---

#### 💻 Bước 6: Lưu và Đẩy thay đổi lên GitHub

Khi đã hoàn thiện nội dung, bạn chạy các lệnh sau trong Terminal của VS Code để đưa lên GitHub:

```bash
# 1. Đưa tất cả các tệp vừa sửa vào vùng chuẩn bị
git add .

# 2. Đặt thông điệp mô tả thay đổi
git commit -m "feat: cap nhat cau chuyen va hinh anh clb cua toi"

# 3. Đẩy code lên nhánh main trên GitHub
git push origin main
```

Sau khi lệnh hoàn tất, hệ thống **GitHub Actions** sẽ tự động chạy quy trình build và website trên GitHub Pages của bạn sẽ được làm mới chỉ sau 1–2 phút!

---

#### 📋 Bảng tra cứu lệnh nhanh giữa các Hệ điều hành

| Thao tác | Windows (PowerShell / VS Code) | macOS (Terminal / VS Code) | Linux (bash / VS Code) |
|---|---|---|---|
| **Cài đặt thư viện** | `pnpm.cmd install --frozen-lockfile` | `pnpm install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| **Chạy dev server** | `pnpm.cmd run dev` | `pnpm run dev` | `pnpm run dev` |
| **Kiểm tra unit test** | `pnpm.cmd run test:unit` | `pnpm run test:unit` | `pnpm run test:unit` |
| **Đóng gói sản phẩm** | `pnpm.cmd run build` | `pnpm run build` | `pnpm run build` |
| **Xem trước bản build** | `pnpm.cmd run preview` | `pnpm run preview` | `pnpm run preview` |
| **Dừng server đang chạy** | `Ctrl + C` (nhập `Y` nếu hỏi) | `Ctrl + C` | `Ctrl + C` |
| **Dừng server khi bị kẹt cổng** | `pnpm.cmd exec astro preview stop` | `pnpm exec astro preview stop` | `pnpm exec astro preview stop` |

---

### ❓ Các câu hỏi thường gặp & Khắc phục sự cố (Troubleshooting)

> [!NOTE]
> **1. Trên Windows báo lỗi: *"File ... pnpm.ps1 cannot be loaded because running scripts is disabled on this system"* hoặc *PSSecurityException*?**
> * **Nguyên nhân**: Do PowerShell ưu tiên gọi file script `.ps1` và kích hoạt cơ chế bảo mật hạn chế script của Windows.
> * **Cách khắc phục nhanh nhất (Khuyên dùng)**: Thay vì gõ `pnpm`, bạn chỉ cần gõ **`pnpm.cmd`** (tương tự với `npm.cmd`). Lệnh này chạy trực tiếp và bỏ qua hoàn toàn cơ chế chặn script của PowerShell mà không cần quyền Administrator.
> * **Cách khắc phục toàn hệ thống (Tùy chọn)**: Nếu muốn gõ ngắn gọn `pnpm`, mở PowerShell bằng quyền Admin và chạy:
>   ```powershell
>   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
>   ```
>   Gõ `Y` rồi nhấn `Enter`.

> [!NOTE]
> **2. Bị lỗi "Another astro preview server is already running" hoặc cổng 4321/4322 bị chiếm?**
> * **Cách xử lý**:
>   * Bấm `Ctrl + C` tại cửa sổ terminal đang chạy trước đó để tắt server.
>   * Nếu terminal trước đó đã bị đóng mà tiến trình vẫn chạy ngầm:
>     * Trên Windows: `pnpm.cmd exec astro preview stop`
>     * Trên macOS/Linux: `pnpm exec astro preview stop`
>   * Hoặc chỉ định một cổng khác khi chạy: `pnpm.cmd run dev --port 4325`.

> [!NOTE]
> **3. Website mở lên bị trắng trang hoặc không tải được hình ảnh/font chữ (Lỗi 404 assets trên GitHub Pages)?**
> * **Nguyên nhân**: Do cấu hình đường dẫn gốc (`BASE_PATH`) chưa khớp với tên repository của bạn trên GitHub.
> * **Cách xử lý**: Dự án đã được thiết lập tự động nhận diện tên repository của bạn qua `BASE_PATH: "/${{ github.event.repository.name || 'BookClub-StoryTelling' }}/"`. Nếu bạn đổi tên repository hoặc deploy ở tên miền riêng (Custom Domain), hãy kiểm tra biến `BASE_PATH` trong tệp `.github/workflows/deploy.yml` cho khớp với đường dẫn URL của bạn.

> [!NOTE]
> **4. Nhạc nền không tự động phát khi vừa mở trang web?**
> * **Nguyên nhân**: Đây là chính sách bảo vệ trải nghiệm người dùng (Autoplay Policy) của tất cả trình duyệt hiện đại (Chrome, Edge, Safari, Firefox). Nhạc sẽ bắt đầu phát một cách mượt mà ngay sau tương tác đầu tiên của bạn (click chuột, lật trang hoặc cuộn chuột). Bạn cũng có thể bấm nút **Bật nhạc ♫** ở góc dưới bên phải màn hình bất kỳ lúc nào.

## 📁 Cấu trúc dự án (Project Structure)

```text
BookClub-StoryTelling/
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
