/**
 * YSBK XLSX / Zip Parser & Availability Template Processor (Chặng 14)
 * Thực thi an toàn: Giới hạn dung lượng, chống Zip Bomb, cấm Macro/Formula Injection.
 */

import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';
import { 
  DAYS_OF_WEEK, BUSY_TYPES, 
  type DayOfWeek, type BusyType, 
  type ParsedAvailabilityRow, type AvailabilityPreviewResult 
} from './availability-types.ts';
import { BadRequestError } from '../errors.ts';

// Giới hạn an toàn
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024; // 25 MB chống Zip Bomb
export const MAX_ROWS_LIMIT = 2500;

export interface MemberLookup {
  id: string;
  fullName: string;
  username: string;
  studentId?: string | null;
}

export const MAX_ZIP_ENTRIES = 200; // Giới hạn tối đa 200 entries cho 1 file XLSX hợp lệ

/**
 * Đọc giải nén cấu trúc file ZIP của XLSX an toàn bằng node:zlib
 * Bảo vệ chống Zip Bomb (P22-02):
 * - Không tin uncompressedSize trong header; áp dụng maxOutputLength ngay trong khi giải nén.
 * - Kiểm soát kích thước thực tế từng entry và tổng toàn bộ các entries (Max 25 MB).
 * - Kiểm tra cấu trúc ZIP, bounds và cấm macro/mã thực thi.
 */
export function unpackXlsxZip(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new BadRequestError(`File vượt quá dung lượng tối đa cho phép (${MAX_FILE_BYTES / 1024 / 1024} MB).`, 'FILE_TOO_LARGE');
  }

  // Kiểm tra chữ ký ZIP PK\x03\x04
  if (buffer.length < 30 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    throw new BadRequestError('File tải lên không phải là định dạng bảng tính XLSX hợp lệ (Thiếu chữ ký ZIP PK).', 'INVALID_XLSX_FORMAT');
  }

  const files = new Map<string, Buffer>();
  let offset = 0;
  let totalActualUncompressed = 0;

  while (offset <= buffer.length - 30) {
    // Kiểm tra signature local file header PK\x03\x04 (0x04034b50)
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      // Nếu gặp signature khác (e.g. Central Directory PK\x01\x02 hoặc End of Central Dir PK\x05\x06), kết thúc quét entries
      break;
    }

    if (files.size >= MAX_ZIP_ENTRIES) {
      throw new BadRequestError('Phát hiện rủi ro Zip Bomb: Số lượng tệp con trong ZIP vượt quá ngưỡng cho phép (Max 200 tệp).', 'ZIP_BOMB_DETECTED');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSizeHeader = buffer.readUInt32LE(offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > buffer.length) {
      throw new BadRequestError('Cấu trúc file ZIP bị cắt cụt (Tên tệp vượt quá kích thước buffer).', 'CORRUPTED_XLSX_STREAM');
    }
    const fileName = buffer.toString('utf8', fileNameStart, fileNameEnd);

    const dataStart = fileNameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataStart > buffer.length || dataEnd > buffer.length) {
      throw new BadRequestError('Cấu trúc file ZIP bị cắt cụt (Dữ liệu nén vượt quá kích thước buffer).', 'CORRUPTED_XLSX_STREAM');
    }

    // Bảo mật: Cấm hoàn toàn Macro/VBA project / executable binaries
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('vbaproject') || lowerName.endsWith('.bin') || lowerName.endsWith('.exe') || lowerName.endsWith('.dll')) {
      throw new BadRequestError('File chứa macro hoặc mã thực thi nhúng (VBA/bin). YSBK cấm import tệp này vì lý do bảo mật.', 'MACRO_NOT_ALLOWED');
    }

    // Kiểm tra nếu uncompressedSize khai trong header đã vượt quá 25MB
    if (uncompressedSizeHeader > MAX_UNCOMPRESSED_BYTES) {
      throw new BadRequestError('Phát hiện rủi ro Zip Bomb: Tệp con khai báo dung lượng giải nén vượt quá 25 MB.', 'ZIP_BOMB_DETECTED');
    }

    const remainingAllowed = MAX_UNCOMPRESSED_BYTES - totalActualUncompressed;
    if (remainingAllowed <= 0) {
      throw new BadRequestError('Phát hiện rủi ro Zip Bomb: Tổng dữ liệu giải nén vượt quá 25 MB.', 'ZIP_BOMB_DETECTED');
    }

    const compressedData = buffer.subarray(dataStart, dataEnd);
    let extractedBuffer: Buffer;

    if (compressionMethod === 0) {
      // STORED: không nén
      if (compressedSize > remainingAllowed) {
        throw new BadRequestError('Phát hiện rủi ro Zip Bomb: Dữ liệu tệp không nén vượt quá 25 MB.', 'ZIP_BOMB_DETECTED');
      }
      extractedBuffer = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      // DEFLATED: nén
      try {
        // Áp dụng maxOutputLength ngay trong quá trình giải nén để tránh cấp phát bộ nhớ trước
        extractedBuffer = zlib.inflateRawSync(compressedData, {
          maxOutputLength: remainingAllowed,
        });
      } catch (err: any) {
        if (err.code === 'ERR_BUFFER_TOO_LARGE' || err.message?.includes('too large') || err.message?.includes('output length')) {
          throw new BadRequestError('Phát hiện rủi ro Zip Bomb: Dữ liệu giải nén thực tế vượt quá 25 MB.', 'ZIP_BOMB_DETECTED');
        }
        throw new BadRequestError(`Lỗi giải nén tệp ${fileName}: ${err.message}`, 'CORRUPTED_XLSX_STREAM');
      }
    } else {
      extractedBuffer = Buffer.alloc(0);
    }

    const actualSize = extractedBuffer.length;
    if (totalActualUncompressed + actualSize > MAX_UNCOMPRESSED_BYTES) {
      throw new BadRequestError('Phát hiện rủi ro Zip Bomb: Tổng dữ liệu giải nén thực tế vượt quá 25 MB.', 'ZIP_BOMB_DETECTED');
    }

    totalActualUncompressed += actualSize;
    files.set(fileName, extractedBuffer);
    offset = dataEnd;
  }

  return files;
}

/**
 * Trích xuất shared strings từ xl/sharedStrings.xml
 */
export function extractSharedStrings(xmlBuffer: Buffer): string[] {
  const xml = xmlBuffer.toString('utf8');
  const strings: string[] = [];
  // Regex an toàn tìm các đoạn <si>...</si>
  const siRegex = /<si\b[^>]*>(.*?)<\/si>/gs;
  let match: RegExpExecArray | null;

  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1];
    // Tìm tất cả các thẻ <t> hoặc <t xml:space="...">...</t> bên trong <si>
    const tRegex = /<t\b[^>]*>(.*?)<\/t>/gs;
    let tMatch: RegExpExecArray | null;
    let combined = '';
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      combined += tMatch[1];
    }
    // Giải mã HTML/XML entities cơ bản
    combined = combined
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    strings.push(combined);
  }

  return strings;
}

/**
 * Phân tích sheet1.xml thành mảng 2 chiều các cell value
 */
export function extractSheetGrid(sheetXmlBuffer: Buffer, sharedStrings: string[]): string[][] {
  const xml = sheetXmlBuffer.toString('utf8');
  const grid: string[][] = [];

  const rowRegex = /<row\b[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[2];

    const rowCells: string[] = [];
    const cellRegex = /<c\b[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(.*?)<\/c>/gs;
    let cellMatch: RegExpExecArray | null;

    let colIndex = 0;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLetter = cellMatch[1];
      const cellType = cellMatch[2];
      const cellInner = cellMatch[3];

      // Tính chỉ số cột A=0, B=1, ...
      const targetColIndex = colLetterToNumber(colLetter);
      while (colIndex < targetColIndex) {
        rowCells.push('');
        colIndex++;
      }

      // Trích xuất value từ <v>...</v>
      const vMatch = /<v\b[^>]*>(.*?)<\/v>/s.exec(cellInner);
      let val = vMatch ? vMatch[1].trim() : '';

      if (cellType === 's') {
        const stringIndex = parseInt(val, 10);
        val = sharedStrings[stringIndex] || '';
      }

      // Formula injection safety: vô hiệu hóa formula prefix
      if (val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')) {
        val = val.substring(1).trim();
      }

      rowCells.push(val);
      colIndex++;
    }

    if (rowCells.some((c) => c.trim().length > 0)) {
      grid.push(rowCells);
    }

    if (grid.length >= MAX_ROWS_LIMIT) {
      break;
    }
  }

  return grid;
}

function colLetterToNumber(letter: string): number {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num - 1;
}

/**
 * Chuẩn hóa Thứ trong tuần
 */
export function normalizeDayOfWeek(raw: string): DayOfWeek | null {
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '')
    .replace(/-/g, '');

  if (s.includes('hai') || s === 'thu2' || s === 't2' || s === '2' || s.includes('monday') || s === 'mon') {
    return DAYS_OF_WEEK.THU_HAI;
  }
  if (s.includes('ba') || s === 'thu3' || s === 't3' || s === '3' || s.includes('tuesday') || s === 'tue') {
    return DAYS_OF_WEEK.THU_BA;
  }
  if (s.includes('tu') || s === 'thu4' || s === 't4' || s === '4' || s.includes('wednesday') || s === 'wed') {
    return DAYS_OF_WEEK.THU_TU;
  }
  if (s.includes('nam') || s === 'thu5' || s === 't5' || s === '5' || s.includes('thursday') || s === 'thu') {
    return DAYS_OF_WEEK.THU_NAM;
  }
  if (s.includes('sau') || s === 'thu6' || s === 't6' || s === '6' || s.includes('friday') || s === 'fri') {
    return DAYS_OF_WEEK.THU_SAU;
  }
  if (s.includes('bay') || s === 'thu7' || s === 't7' || s === '7' || s.includes('saturday') || s === 'sat') {
    return DAYS_OF_WEEK.THU_BAY;
  }
  if (s.includes('chunhat') || s === 'cn' || s === 'sunday' || s === 'sun' || s === '8') {
    return DAYS_OF_WEEK.CHU_NHAT;
  }
  return null;
}

/**
 * Chuẩn hóa giờ HH:mm
 */
export function normalizeTimeString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Nếu là số thập phân thời gian của Excel (0.0 đến 1.0)
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0 && num < 1 && !trimmed.includes(':')) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // Định dạng HH:mm hoặc H:m hoặc HH:mm:ss
  const match = /^(\d{1,2})[:hH](\d{1,2})(?::\d{1,2})?$/.exec(trimmed);
  if (match) {
    const hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }

  // Số nguyên giờ (ví dụ 8 -> 08:00, 14 -> 14:00)
  if (/^\d{1,2}$/.test(trimmed)) {
    const hours = parseInt(trimmed, 10);
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, '0')}:00`;
    }
  }

  return null;
}

/**
 * Chuẩn hóa loại bận
 */
export function normalizeBusyType(raw?: string): BusyType {
  if (!raw) return BUSY_TYPES.HOC_CHINH_KHOA;
  const s = raw.toLowerCase();
  if (s.includes('thi') || s.includes('kiem tra') || s.includes('kiểm tra')) {
    return BUSY_TYPES.THI;
  }
  if (s.includes('co dinh') || s.includes('cố định') || s.includes('lich rieng') || s.includes('lịch riêng')) {
    return BUSY_TYPES.BAN_CO_DINH;
  }
  if (s.includes('viec') || s.includes('việc') || s.includes('ngoai') || s.includes('khac') || s.includes('khác')) {
    return BUSY_TYPES.CONG_VIEC_KHAC;
  }
  return BUSY_TYPES.HOC_CHINH_KHOA;
}

/**
 * Tìm thành viên khớp theo MSSV, Username hoặc Tên
 */
export function resolveMember(identifier: string, members: MemberLookup[]): MemberLookup | null {
  const q = identifier.trim().toLowerCase();
  if (!q) return null;

  // 1. Khớp MSSV chính xác
  const byStudentId = members.find((m) => m.studentId && m.studentId.trim().toLowerCase() === q);
  if (byStudentId) return byStudentId;

  // 2. Khớp Username chính xác
  const cleanUsername = q.startsWith('@') ? q.slice(1) : q;
  const byUsername = members.find((m) => m.username.trim().toLowerCase() === cleanUsername);
  if (byUsername) return byUsername;

  // 3. Khớp Họ và tên
  const byName = members.find((m) => m.fullName.trim().toLowerCase() === q);
  if (byName) return byName;

  return null;
}

/**
 * Xử lý dữ liệu bảng (từ grid) và trả về kết quả Preview
 */
export function parseAvailabilityGrid(
  grid: string[][],
  members: MemberLookup[],
  metadata: {
    fileName: string;
    fileSizeBytes: number;
    fileHash: string;
    termSemester?: string;
    effectiveStartDate?: string;
    effectiveEndDate?: string;
  }
): AvailabilityPreviewResult {
  if (grid.length === 0) {
    throw new BadRequestError('Bảng tính không có dữ liệu.', 'EMPTY_SPREADSHEET');
  }

  // Tìm hàng header
  let headerRowIndex = -1;
  let colIdxMember = -1;
  let colIdxDay = -1;
  let colIdxStart = -1;
  let colIdxEnd = -1;
  let colIdxType = -1;
  let colIdxNotes = -1;

  for (let r = 0; r < Math.min(grid.length, 5); r++) {
    const row = grid[r].map((c) => c.toLowerCase().trim());
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell.includes('mssv') || cell.includes('mã sv') || cell.includes('thành viên') || cell.includes('họ tên') || cell.includes('username')) {
        colIdxMember = c;
      } else if (cell.includes('thứ') || cell.includes('ngày') || cell.includes('day')) {
        colIdxDay = c;
      } else if (cell.includes('bắt đầu') || cell.includes('từ') || cell.includes('start')) {
        colIdxStart = c;
      } else if (cell.includes('kết thúc') || cell.includes('đến') || cell.includes('end')) {
        colIdxEnd = c;
      } else if (cell.includes('loại') || cell.includes('lý do') || cell.includes('type')) {
        colIdxType = c;
      } else if (cell.includes('ghi chú') || cell.includes('note')) {
        colIdxNotes = c;
      }
    }
    if (colIdxMember !== -1 && colIdxDay !== -1 && colIdxStart !== -1 && colIdxEnd !== -1) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback mặc định nếu không có header rõ ràng: Col 0: Member, Col 1: Day, Col 2: Start, Col 3: End, Col 4: Type, Col 5: Notes
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colIdxMember = 0;
    colIdxDay = 1;
    colIdxStart = 2;
    colIdxEnd = 3;
    colIdxType = 4;
    colIdxNotes = 5;
  }

  const parsedRows: ParsedAvailabilityRow[] = [];
  let unrecognizedCount = 0;

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const row = grid[r];
    const rawMember = row[colIdxMember] || '';
    const rawDay = row[colIdxDay] || '';
    const rawStart = row[colIdxStart] || '';
    const rawEnd = row[colIdxEnd] || '';
    const rawType = colIdxType !== -1 ? row[colIdxType] || '' : '';
    const rawNotes = colIdxNotes !== -1 ? row[colIdxNotes] || '' : '';

    if (!rawMember.trim() && !rawDay.trim() && !rawStart.trim()) {
      continue; // Bỏ qua dòng trống
    }

    const rowNumber = r + 1;
    let isValid = true;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    // 1. Nhận diện thành viên
    const resolvedMember = resolveMember(rawMember, members);
    if (!resolvedMember) {
      isValid = false;
      errorCode = 'UNKNOWN_MEMBER';
      errorMessage = `Không tìm thấy thành viên tương ứng với '${rawMember}' trong danh bạ CLB.`;
      unrecognizedCount++;
    }

    // 2. Chuẩn hóa thứ trong tuần
    const normDay = normalizeDayOfWeek(rawDay);
    if (!normDay) {
      isValid = false;
      errorCode = errorCode || 'INVALID_DAY_OF_WEEK';
      errorMessage = errorMessage || `Thứ trong tuần '${rawDay}' không nhận diện được (Cần: Thứ 2 .. Chủ nhật).`;
    }

    // 3. Chuẩn hóa giờ bắt đầu & kết thúc
    const normStart = normalizeTimeString(rawStart);
    const normEnd = normalizeTimeString(rawEnd);

    if (!normStart || !normEnd) {
      isValid = false;
      errorCode = errorCode || 'INVALID_TIME_FORMAT';
      errorMessage = errorMessage || `Khung giờ '${rawStart} - ${rawEnd}' sai định dạng (Cần dạng HH:mm).`;
    } else if (normStart >= normEnd) {
      isValid = false;
      errorCode = errorCode || 'INVALID_TIME_RANGE';
      errorMessage = errorMessage || `Giờ kết thúc (${normEnd}) phải lớn hơn giờ bắt đầu (${normStart}).`;
    }

    const normType = normalizeBusyType(rawType);

    parsedRows.push({
      rowNumber,
      rawMemberIdentifier: rawMember,
      rawDayOfWeek: rawDay,
      rawStartTime: rawStart,
      rawEndTime: rawEnd,
      rawBusyType: rawType || undefined,
      rawNotes: rawNotes || undefined,
      resolvedMemberId: resolvedMember?.id,
      resolvedMemberName: resolvedMember?.fullName,
      normalizedDayOfWeek: normDay || undefined,
      normalizedStartTime: normStart || undefined,
      normalizedEndTime: normEnd || undefined,
      normalizedBusyType: normType,
      isValid,
      errorCode,
      errorMessage,
    });
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  // Mặc định kết thúc sau 4 tháng (1 kỳ học)
  const defaultEndDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    fileName: metadata.fileName,
    fileSizeBytes: metadata.fileSizeBytes,
    fileHash: metadata.fileHash,
    termSemester: metadata.termSemester || '2025.1',
    effectiveStartDate: metadata.effectiveStartDate || todayStr,
    effectiveEndDate: metadata.effectiveEndDate || defaultEndDate,
    totalRows: parsedRows.length,
    validCount,
    errorCount,
    rows: parsedRows,
    isReadyToCommit: validCount > 0,
    unrecognizedMembersCount: unrecognizedCount,
  };
}

/**
 * Hàm phân tích file buffer XLSX đầy đủ
 */
export function parseAvailabilityXlsxBuffer(
  buffer: Buffer,
  members: MemberLookup[],
  fileName = 'availability.xlsx',
  extraOptions?: { termSemester?: string; effectiveStartDate?: string; effectiveEndDate?: string }
): AvailabilityPreviewResult {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const files = unpackXlsxZip(buffer);

  // 1. Đọc shared strings nếu có
  const sharedXml = files.get('xl/sharedStrings.xml');
  const sharedStrings = sharedXml ? extractSharedStrings(sharedXml) : [];

  // 2. Tìm sheet1.xml
  const sheetXml = files.get('xl/worksheets/sheet1.xml') || Array.from(files.entries()).find(([k]) => k.startsWith('xl/worksheets/sheet'))?.[1];

  if (!sheetXml) {
    throw new BadRequestError('Không tìm thấy bảng tính dữ liệu trong tệp XLSX (Thiếu sheet1.xml).', 'MISSING_WORKSHEET');
  }

  const grid = extractSheetGrid(sheetXml, sharedStrings);

  return parseAvailabilityGrid(grid, members, {
    fileName,
    fileSizeBytes: buffer.length,
    fileHash,
    termSemester: extraOptions?.termSemester,
    effectiveStartDate: extraOptions?.effectiveStartDate,
    effectiveEndDate: extraOptions?.effectiveEndDate,
  });
}
