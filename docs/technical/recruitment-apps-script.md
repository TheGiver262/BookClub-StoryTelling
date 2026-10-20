# Hướng Dẫn Cấu Hình Google Apps Script Webhook (Chặng 16)

Tài liệu hướng dẫn kết nối Google Form tuyển thành viên của CLB Sách Bách Khoa (YSBK) sang hệ thống web nội bộ thông qua Webhook tự động với chữ ký số HMAC-SHA256.

---

## 1. Nguyên Lý Hoạt Động & Bảo Mật

1. Khi ứng viên điền và nộp đơn trên Google Form, hàm trigger `onFormSubmit` trong Google Apps Script sẽ được kích hoạt tự động.
2. Apps Script trích xuất `responseId` (khóa nguồn duy nhất), thời gian nộp đơn và toàn bộ câu trả lời.
3. Tạo chuỗi ký `timestamp + '.' + JSON.stringify(payload)` và băm bằng thuật toán **HMAC-SHA256** với Secret chia sẻ (`RECRUITMENT_WEBHOOK_SECRET`).
4. Gửi HTTP POST request tới endpoint `POST /api/v1/recruitment/webhook/google-form` kèm:
   - Header `X-Timestamp`: Epoch milliseconds hiện tại (chống Replay Attack trong khoảng 5 phút).
   - Header `X-YSBK-Signature`: Chữ ký hex HMAC-SHA256.
   - Header `X-Webhook-Secret`: Secret token chia sẻ.
5. Máy chủ YSBK kiểm tra:
   - Độ lệch thời gian $\le 300.000$ ms (5 phút).
   - So khớp chữ ký số an toàn bằng `crypto.timingSafeEqual` (chống timing attack).
   - Kiểm tra kích thước payload $\le 2$ MB (chống DoS).
   - Commit bền vào cơ sở dữ liệu trước khi trả về HTTP 200/201 (Durable Ingest).
   - Nếu xảy ra lỗi mạng rớt gói, cơ chế **Reconciliation Checkpoint** của YSBK sẽ quét và đối soát bù các đơn bị thiếu mà không làm mất điểm hay ghi chú phỏng vấn đã chấm trên web.

---

## 2. Các Bước Cài Đặt Trong Google Form

1. Mở biểu mẫu Google Form hoặc trang tính Google Sheets chứa kết quả phản hồi.
2. Trên thanh công cụ, chọn **Tiện ích mở rộng** (Extensions) $\rightarrow$ **Apps Script**.
3. Xóa nội dung mặc định và dán toàn bộ mã nguồn từ [`src/modules/recruitment/apps-script/Code.gs`](../../src/modules/recruitment/apps-script/Code.gs).
4. Điều chỉnh 2 cấu hình chính:
   ```javascript
   var YSBK_WEBHOOK_URL = 'https://<domain-ysbk>/api/v1/recruitment/webhook/google-form';
   var YSBK_WEBHOOK_SECRET = '<secret-trung-voi-file-.env>';
   var FORM_ID = 'FORM_GEN_10_2026';
   ```
5. Nhấn **Lưu** (Ctrl + S).
6. Ở thanh điều hướng bên trái, chọn biểu tượng đồng hồ (**Kích hoạt / Triggers**) $\rightarrow$ Nhấn **Thêm trình kích hoạt** (Add Trigger):
   - Chọn hàm sẽ chạy: `onFormSubmit`
   - Chọn bản triển khai sẽ chạy: `Head`
   - Chọn nguồn sự kiện: `Từ biểu mẫu` (From form) hoặc `Từ bảng tính` (From spreadsheet)
   - Chọn loại sự kiện: `Khi gửi biểu mẫu` (On form submit)
   - Thông báo lỗi: `Ngay lập tức`
7. Nhấn **Lưu** và cấp quyền (Grant Access) cho Apps Script.

---

## 3. Quy Trình Đối Soát Bù Đơn Thiếu (Reconciliation)

Trường hợp Google Apps Script bị nghẽn mạng hoặc vượt hạn mức UrlFetchApp (Google Quota):
- Quản trị viên chỉ cần vào màn hình Quản lý Tuyển Dụng YSBK, nhấn nút **"Đối Soát Bù Đơn (Reconcile)"**.
- Hệ thống sẽ so khớp danh sách `response_id` giữa Google Sheets và CSDL YSBK, tự động nạp bù các đơn chưa có.
- Tuyệt đối không ghi đè hoặc xóa bỏ điểm số, ghi chú, quyết định tuyển dụng đã chấm trên website.
