# Khảo sát nhận diện YSBK — đầu vào thiết kế

Ngày khảo sát: 18/10/2026. Phạm vi: nguồn công khai và quan sát website; không đăng nhập Facebook, không thu dữ liệu cá nhân hoặc tải bộ ảnh thành viên. Chưa xác nhận logo hiện hành, mã màu thương hiệu hoặc font chính thức. Đây không phải brand guideline đã duyệt.

## 1. Nguồn và mức bằng chứng

| Nguồn | Đã biết | Giới hạn sử dụng |
|---|---|---|
| [Tài liệu CLB sinh viên trên tên miền HUST](https://hust.edu.vn/uploads/sys/quality-assurance/2019/04/ee-2-1-1-student-guide-book.399978.17764.pdf) | Có dòng CLB Yêu sách Bách Khoa, dẫn `fb.com/CLBYeuSachBachKhoaHaNoi` trong kết quả đọc/tìm kiếm | Tài liệu lịch sử, không chứng minh fanpage hoặc nhận diện mới nhất không thay đổi |
| [Fanpage được nguồn HUST dẫn](https://www.facebook.com/CLBYeuSachBachKhoaHaNoi/) | Đã tìm đúng địa chỉ cần đối chiếu | Công cụ đọc trả trang “You're Temporarily Blocked”; chưa xem được avatar, cover hoặc bộ bài đăng hiện hành. Không suy màu/logo từ kết quả này |
| [Website Weebly mang tên CLB](https://clbyeusachbkhn.weebly.com/) | Đọc phần giới thiệu, sứ mệnh, tính tự nguyện và khẩu hiệu “Mở sách đọc tương lai”; đã quan sát trang trong trình duyệt | Có nội dung tuyển Gen 3; chưa xác nhận website còn được quản lý chính thức hoặc ngày cập nhật. Hình sách/cảnh quan trong trang không phải bằng chứng palette thương hiệu |
| [HUST: hoạt động văn hóa đọc ngày 10/4/2026](https://hust.edu.vn/vi/news/hop-tac-doi-ngoai-truyen-thong/hun-duc-pham-chat-nguoi-bach-khoa-tu-van-hoa-doc-655865.html) | Bài trường đề cập phần hoạt cảnh do CLB Yêu sách Bách khoa thực hiện | Dùng xác nhận bối cảnh cộng đồng sách; màu sự kiện do nhiều đơn vị tổ chức không tự thành màu CLB |

Kết luận: đã xác định nguồn phù hợp để tiếp tục khảo sát; chưa đủ bằng chứng chốt màu chính hoặc asset logo. Không lấy logo/màu HUST thay YSBK, không nhầm YSBK với mã sân bay hoặc tổ chức khác. Không đưa các số liệu/lịch địa điểm trong nguồn cũ vào UI như thông tin hiện tại nếu khác đặc tả dự án.

## 2. Hướng thẩm mỹ đề xuất, không phải nhận diện chính thức

Tinh thần: cộng đồng sinh viên yêu sách, gần gũi và có chất biên tập; phần nghiệp vụ sáng rõ, đọc số tiền nhanh, ít thao tác. Khu công khai và khu quản trị dùng chung nhận diện nhưng khác mật độ nội dung. Màu chính phải được rút từ asset CLB có nguồn; màu nền/trạng thái/tương tác có thể được thiết kế bổ sung và phải phân biệt nguồn gốc.

Ứng viên font: Be Vietnam Pro cho menu, form, bảng và số liệu; Lora cho tiêu đề lớn hoặc bài review. Metadata chính thức của [Be Vietnam Pro](https://github.com/google/fonts/blob/main/ofl/bevietnampro/METADATA.pb) và [Lora](https://github.com/google/fonts/blob/main/ofl/lora/METADATA.pb) đều liệt kê subset Vietnamese. Đó là bằng chứng hỗ trợ ngôn ngữ, chưa phải kiểm tra hình thức hoặc tốc độ tải trên bản web thực. Cần xem font/giấy phép cụ thể, tải đủ glyph tiếng Việt và thử dấu, độ đậm, số tiền trước chọn.

Chuẩn tham chiếu: [WCAG 2.2 — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), chữ thường tối thiểu 4,5:1 và chữ lớn đủ điều kiện 3:1. Việc chọn màu theo logo không miễn yêu cầu tương phản của chữ trong UI.

## 3. Công việc tiếp theo cho Antigravity

1. Đọc đặc tả và khảo sát lại nguồn CLB hiện hành; ghi URL/ngày/asset và mức tin cậy. Nếu nguồn không truy cập được, nêu giới hạn, không vượt chặn hoặc tự nhận đã xem.
2. Xác minh logo/avatar và một nhóm ấn phẩm có chủ đích, phân biệt màu nhận diện bền vững với màu từng chiến dịch. Lấy màu từ file thực nếu có; mã HEX lấy mẫu phải ghi là màu đo từ asset, không tự xưng quy chuẩn chính thức.
3. Tạo `design.md` tại gốc dự án, thống nhất token/layout/typography/component và quy tắc nghiệp vụ ảnh hưởng UI. Không tạo nhiều bộ guideline mâu thuẫn.
4. Dựng UI prototype theo tài liệu, dữ liệu giả, đủ khu công khai/nội bộ/cựu/admin và luồng trọng yếu; không tích hợp production hoặc xem mock role là bảo mật thật.

Prompt giao việc đầy đủ nằm tại [Antigravity — nhận diện và UI](prompts/antigravity-design.md). Chưa gửi prompt sang Antigravity hoặc tạo giao diện trong đợt viết prompt này.
