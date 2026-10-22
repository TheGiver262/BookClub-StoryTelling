# Runbook landing Netlify độc lập

Ngày tách: 23/10/2026. Site hiện hành: https://ysbk-preview.netlify.app/; team `thegiver262`; site ID `6ac634bc-d124-4de5-b7ba-ddbcc758e0e5`. Deploy được ghi trong handoff nguồn: `6ada2e83943262d0fb4099ed`. Lượt tách nhánh không deploy.

1. Xác nhận đang ở `codex/landing-preview` và không có thay đổi ngoài phạm vi.
2. Chạy `pnpm run test:unit`, `pnpm run build`, `pnpm run test:landing`, `pnpm run check`.
3. Kiểm tra bìa, 10 chương, trang cuối, guide, các link disabled, nhạc opt-in, reduced motion, desktop và mobile xoay. Không ghi nhận test chạy cũ thành kết quả mới.
4. Chỉ khi được yêu cầu triển khai: upload `dist-landing` đã qua gate tới site nêu trên. Không upload repository hoặc kết nối Git CD mặc định.
5. Kiểm tra root 200, route app/API/file riêng tư 404, tài nguyên đúng hash và header bảo vệ. CSP giữ connect-src none, form-action none, font-src self và frame-ancestors none. Preview tiếp tục noindex/nofollow.

`astro.config.mjs` và lệnh build đều chỉ chọn entry landing. `LandingLink.astro` loại href/target ứng dụng trong HTML. Không có backend/function/DB trong nhánh này. Không nới CSP để kết nối ứng dụng. Nhánh thương mại dùng chính sách riêng đã được phê duyệt, không triển khai lên site CLB.

Build gốc trước tách có cảnh báo asset URL vì public assets được copy sau Astro; gate kiểm tra output cuối. Không suy ra file thiếu từ warning đó, và không bỏ gate. Kiểm tra máy thật/Safari vẫn cần bổ sung riêng.
