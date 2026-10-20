# Logo phục hồi V6

Phương thức: imagegen tích hợp, chế độ chỉnh ảnh và `transparent_background: true`. Tham chiếu là ảnh bảng CLB người dùng gửi (`codex-clipboard-baacd971-f667-4b7f-8704-5ff5f4255e8f.jpg`). Chỉ phục hồi biểu tượng phía trên, không lấy cả chữ hoặc khung bảng.

Tệp: `assets/logo-restored-v6.png`. PNG có alpha thật. Đây là phục hồi từ ảnh chụp, chưa phải bản vector gốc của CLB; không cam kết từng đường cong trùng tuyệt đối bản thiết kế gốc. Giữ ảnh tham chiếu cũ để đối chiếu.

Trong mockup, dùng alpha của PNG làm CSS mask và tô đúng màu tham chiếu `#819079`; bỏ nền xanh nhạt, bo góc và bóng của khung logo cũ. Cách hiển thị này loại ảnh hưởng màu/bóng sáng từ ảnh chụp mà giữ hình và các khoảng rỗng của PNG. Các vùng trang sách và ngoài logo để lộ nền bìa.

## Prompt đầu ra được chọn

Logo được phục hồi theo prompt dưới đây, sau đó làm sạch thêm bằng cùng công cụ, giữ nền transparent:

```text
Clean up this EXISTING logo image. Keep every outline, curved book stripe, page cutout, straight baseline and proportion exactly unchanged. Replace all shaded green areas with a single completely FLAT, fully OPAQUE solid fill, exact HEX #819079. Remove all gradients, illumination, texture, colored specks and green fringe. Keep outside and all inner cutouts genuinely transparent. Do not trace or redesign new contours. Output a crisp clean transparent PNG logo, same composition and aspect ratio.
```

Prompt phục hồi ban đầu:

```text
Faithfully restore ONLY the green emblem at the top center of the attached sign photograph, not the surrounding sign or text. It is the existing Yêu Sách Bách Khoa logo, not a new design. Look at the original silhouette carefully: a broad near-semicircular arch whose entire bottom is one STRAIGHT HORIZONTAL baseline. INSIDE that silhouette are the curved negative-space book-page stripes and central V fold. Do NOT let the bottom outline follow a wave or book shape; finish with the straight flat baseline seen in the photograph. Match the original number of inner curved lines and their spacing, the off-center curved turned page at upper left, the central book fold, and the width/height proportions.
Make a crisp flat 2D logo restoration in ONE absolutely uniform solid sage green HEX #819079. No gradient at all, no shading, no texture, no grain, no lighting, no semiopaque colored haze, no green-fringe artifacts. Sharp clean curves with only normal edge antialiasing. All cutouts and the exterior are genuinely transparent alpha, not white, not a background rectangle. There must be no colored or translucent pixels scattered in the empty background. Center the emblem tightly with a modest equal transparent margin. Transparent PNG, wide landscape composition about 2:1. Remove all photograph background, lettering, gold bars, rectangular sign, plants, people. Do not add outlines, shadows or redesign the symbol.
```
