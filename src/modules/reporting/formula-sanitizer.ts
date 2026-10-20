/**
 * Formula Injection Sanitizer, CSV & Excel/Print Formatter - YSBK (R06, R13, Đợt F)
 * Ngăn chặn tấn công CSV Injection / Formula Injection trong Microsoft Excel, LibreOffice, Google Sheets.
 * Thêm tiền tố UTF-8 BOM (\uFEFF) giúp Excel hiển thị đúng dấu tiếng Việt.
 * Tạo tệp Excel XML (SpreadsheetML) mở trực tiếp trong Excel với định dạng số và tiếng Việt chuẩn.
 */

/**
 * Các ký tự mở đầu công thức nguy hiểm trong Excel và spreadsheet
 */
const DANGEROUS_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Thoát ký tự an toàn cho 1 ô (cell) trong file CSV:
 * 1. Chống Formula Injection: nếu cell bắt đầu bằng ký tự nguy hiểm, chèn thêm dấu nháy đơn `'` phía trước.
 * 2. Thoát dấu ngoặc kép `"` thành `""` và bọc trong cặp ngoặc kép `"` nếu có dấu phẩy, ngoặc kép hoặc xuống dòng.
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  let str = String(val);

  // Xử lý chống Formula Injection
  const trimmed = str.trimStart();
  if (trimmed.length > 0 && DANGEROUS_FORMULA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    str = "'" + str;
  }

  // Nếu chứa dấu phẩy, dấu ngoặc kép hoặc ký tự xuống dòng thì phải bọc ngoặc kép
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Tiền tố Byte Order Mark (BOM) UTF-8
 */
export const UTF8_BOM = '\uFEFF';

/**
 * Chuyển đổi mảng dữ liệu 2 chiều thành nội dung file CSV có BOM UTF-8
 */
export function buildCsvDocument(rows: (unknown[])[]): string {
  const content = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
  return UTF8_BOM + content;
}

/**
 * Thoát ký tự an toàn cho XML (SpreadsheetML)
 */
export function escapeXml(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Thoát ký tự an toàn cho HTML (chống XSS)
 */
export function escapeHtml(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Chuyển đổi mảng dữ liệu thành tệp Excel XML Spreadsheet 2003 (SpreadsheetML)
 * Excel mở tự nhiên không cảnh báo hỏng tệp, hỗ trợ Unicode tiếng Việt đầy đủ và gán đúng kiểu dữ liệu.
 */
export function buildExcelXmlDocument(sheetName: string, rows: (unknown[])[]): string {
  const safeSheet = escapeXml(sheetName.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'BaoCao');
  const xmlRows = rows.map((row) => {
    const cells = row.map((cell) => {
      if (cell === null || cell === undefined || cell === '') {
        return '<Cell><Data ss:Type="String"></Data></Cell>';
      }
      if (typeof cell === 'number' && !isNaN(cell)) {
        return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
      }
      let str = String(cell);
      const trimmed = str.trimStart();
      if (trimmed.length > 0 && DANGEROUS_FORMULA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
        str = "'" + str; // Chống Formula Injection
      }
      return `<Cell><Data ss:Type="String">${escapeXml(str)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('\r\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#000000"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${safeSheet}">
  <Table>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

/**
 * Tạo tài liệu HTML in ấn / xuất PDF độc lập, định dạng chuẩn A4 có bảo vệ XSS
 */
export function buildPrintableHtmlDocument(
  title: string,
  sections: { title: string; headers: string[]; rows: (unknown[])[] }[]
): string {
  const safeDocTitle = escapeHtml(title);
  const sectionsHtml = sections.map((sec) => `
    <div class="report-section">
      <h3>${escapeHtml(sec.title)}</h3>
      <table>
        <thead>
          <tr>
            ${sec.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${sec.rows.map((row) => `
            <tr>
              ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('\n');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${safeDocTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 11pt; line-height: 1.4; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 16pt; color: #0f172a; }
    .header .meta { font-size: 9pt; color: #64748b; margin-top: 4px; }
    .report-section { margin-bottom: 24px; }
    .report-section h3 { margin: 0 0 8px 0; font-size: 12pt; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: 600; color: #334155; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CLB YÊU SÁCH BÁCH KHOA (YSBK)</h1>
    <div class="meta">${safeDocTitle} — Xuất lúc: ${new Date().toLocaleString('vi-VN')}</div>
  </div>
  ${sectionsHtml}
</body>
</html>`;
}
