import test from 'node:test';
import assert from 'node:assert';
import * as zlib from 'node:zlib';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  unpackXlsxZip,
  parseAvailabilityXlsxBuffer,
  normalizeDayOfWeek,
  normalizeTimeString,
  normalizeBusyType,
  type MemberLookup,
} from '../../src/server/duty/availability-parser.ts';
import {
  commitAvailabilityBatch,
  listAvailabilityBatches,
  getMemberBusyIntervals,
} from '../../src/server/duty/availability-service.ts';
import { DAYS_OF_WEEK, BUSY_TYPES } from '../../src/server/duty/availability-types.ts';

/**
 * Helper: Tạo một file ZIP chứa các tệp ảo (dùng để mô phỏng tệp .xlsx thật)
 */
function createMockZipBuffer(files: Array<{ name: string; content: string | Buffer; method?: number }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const rawData = typeof f.content === 'string' ? Buffer.from(f.content, 'utf8') : f.content;
    const nameBuf = Buffer.from(f.name, 'utf8');
    const crc = zlib.crc32(rawData);

    let compressedData = rawData;
    let method = f.method ?? 0; // 0 = STORED, 8 = DEFLATED
    if (method === 8) {
      compressedData = zlib.deflateRawSync(rawData);
    }

    // Local file header (30 bytes + name length + data length)
    const local = Buffer.alloc(30 + nameBuf.length + compressedData.length);
    local.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8); // compression method
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc-32
    local.writeUInt32LE(compressedData.length, 18); // compressed size
    local.writeUInt32LE(rawData.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // file name length
    local.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(local, 30);
    compressedData.copy(local, 30 + nameBuf.length);

    localHeaders.push(local);

    // Central directory header (46 bytes + name length)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(method, 10); // compression method
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16); // crc-32
    central.writeUInt32LE(compressedData.length, 20); // compressed size
    central.writeUInt32LE(rawData.length, 24); // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28); // file name length
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal file attributes
    central.writeUInt32LE(0, 38); // external file attributes
    central.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((s, b) => s + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk number with start of central dir
  eocd.writeUInt16LE(files.length, 8); // total entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12); // size of central dir
  eocd.writeUInt32LE(centralOffset, 16); // offset of start of central dir
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Helper: Tạo file XLSX hợp lệ theo cấu trúc chuẩn
 */
function createValidAvailabilityXlsxBuffer(): Buffer {
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="18" uniqueCount="18">
  <si><t>Mã SV</t></si>
  <si><t>Thứ</t></si>
  <si><t>Giờ Bắt Đầu</t></si>
  <si><t>Giờ Kết Thúc</t></si>
  <si><t>Loại Lịch</t></si>
  <si><t>Ghi Chú</t></si>
  <si><t>20230001</t></si>
  <si><t>Thứ Hai</t></si>
  <si><t>08:00</t></si>
  <si><t>11:30</t></si>
  <si><t>Học chính khóa</t></si>
  <si><t>Phòng D3-201</t></si>
  <si><t>20230002</t></si>
  <si><t>Thứ Ba</t></si>
  <si><t>14:00</t></si>
  <si><t>17:00</t></si>
  <si><t>Bận cố định</t></si>
  <si><t>Trực Lab</t></si>
</sst>`;

  // Sheet chứa header + 2 dòng dữ liệu hợp lệ
  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
      <c r="F1" t="s"><v>5</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>6</v></c>
      <c r="B2" t="s"><v>7</v></c>
      <c r="C2" t="s"><v>8</v></c>
      <c r="D2" t="s"><v>9</v></c>
      <c r="E2" t="s"><v>10</v></c>
      <c r="F2" t="s"><v>11</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>12</v></c>
      <c r="B3" t="s"><v>13</v></c>
      <c r="C3" t="s"><v>14</v></c>
      <c r="D3" t="s"><v>15</v></c>
      <c r="E3" t="s"><v>16</v></c>
      <c r="F3" t="s"><v>17</v></c>
    </row>
  </sheetData>
</worksheet>`;

  return createMockZipBuffer([
    { name: '[Content_Types].xml', content: '<Types></Types>', method: 8 },
    { name: 'xl/sharedStrings.xml', content: sharedStringsXml, method: 8 },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml, method: 8 },
  ]);
}

/**
 * Helper: Tạo file XLSX chứa cả dòng hợp lệ và dòng lỗi (fail-safe test)
 */
function createMixedAvailabilityXlsxBuffer(): Buffer {
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="18" uniqueCount="18">
  <si><t>Mã SV</t></si>
  <si><t>Thứ</t></si>
  <si><t>Giờ Bắt Đầu</t></si>
  <si><t>Giờ Kết Thúc</t></si>
  <si><t>Loại Lịch</t></si>
  <si><t>20230001</t></si>
  <si><t>Thứ Tư</t></si>
  <si><t>07:00</t></si>
  <si><t>09:30</t></si>
  <si><t>Học chính khóa</t></si>
  <si><t>99999999</t></si> <!-- Mã SV không tồn tại -->
  <si><t>Thứ Năm</t></si>
  <si><t>17:00</t></si> <!-- Lỗi giờ: 17:00 đến 14:00 (end <= start) -->
  <si><t>14:00</t></si>
  <si><t>Thứ Mơ Hồ</t></si> <!-- Lỗi thứ không xác định -->
</sst>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
    </row>
    <!-- Dòng 2: Hợp lệ -->
    <row r="2">
      <c r="A2" t="s"><v>5</v></c>
      <c r="B2" t="s"><v>6</v></c>
      <c r="C2" t="s"><v>7</v></c>
      <c r="D2" t="s"><v>8</v></c>
      <c r="E2" t="s"><v>9</v></c>
    </row>
    <!-- Dòng 3: Lỗi UNKNOWN_MEMBER -->
    <row r="3">
      <c r="A3" t="s"><v>10</v></c>
      <c r="B3" t="s"><v>11</v></c>
      <c r="C3" t="s"><v>7</v></c>
      <c r="D3" t="s"><v>8</v></c>
      <c r="E3" t="s"><v>9</v></c>
    </row>
    <!-- Dòng 4: Lỗi INVALID_TIME_RANGE (17:00 -> 14:00) -->
    <row r="4">
      <c r="A4" t="s"><v>5</v></c>
      <c r="B4" t="s"><v>11</v></c>
      <c r="C4" t="s"><v>12</v></c>
      <c r="D4" t="s"><v>13</v></c>
      <c r="E4" t="s"><v>9</v></c>
    </row>
    <!-- Dòng 5: Lỗi INVALID_DAY_OF_WEEK -->
    <row r="5">
      <c r="A5" t="s"><v>5</v></c>
      <c r="B5" t="s"><v>14</v></c>
      <c r="C5" t="s"><v>7</v></c>
      <c r="D5" t="s"><v>8</v></c>
      <c r="E5" t="s"><v>9</v></c>
    </row>
  </sheetData>
</worksheet>`;

  return createMockZipBuffer([
    { name: '[Content_Types].xml', content: '<Types></Types>', method: 8 },
    { name: 'xl/sharedStrings.xml', content: sharedStringsXml, method: 8 },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml, method: 8 },
  ]);
}

function createMockEnvironment() {
  const db = new MockCashDbQueryable();
  // Đưa vào 2 thành viên thử nghiệm
  db.members.push({
    id: 'mem-01',
    username: 'nguyenvana',
    full_name: 'Nguyễn Văn A',
    student_id: '20230001',
    is_active: true,
  });
  db.members.push({
    id: 'mem-02',
    username: 'tranthib',
    full_name: 'Trần Thị B',
    student_id: '20230002',
    is_active: true,
  });
  return db;
}

test('Chặng 14: Chuẩn hóa ngày, giờ và loại bận an toàn', () => {
  assert.strictEqual(normalizeDayOfWeek('Thứ 2'), DAYS_OF_WEEK.THU_HAI);
  assert.strictEqual(normalizeDayOfWeek('t3'), DAYS_OF_WEEK.THU_BA);
  assert.strictEqual(normalizeDayOfWeek('Thứ Tư'), DAYS_OF_WEEK.THU_TU);
  assert.strictEqual(normalizeDayOfWeek('Thursday'), DAYS_OF_WEEK.THU_NAM);
  assert.strictEqual(normalizeDayOfWeek('CN'), DAYS_OF_WEEK.CHU_NHAT);
  assert.strictEqual(normalizeDayOfWeek('Không hợp lệ'), null);

  assert.strictEqual(normalizeTimeString('08:00'), '08:00');
  assert.strictEqual(normalizeTimeString('14h30'), '14:30');
  assert.strictEqual(normalizeTimeString('9'), '09:00');
  assert.strictEqual(normalizeTimeString('25:00'), null);
  assert.strictEqual(normalizeTimeString('abc'), null);

  assert.strictEqual(normalizeBusyType('Thi cuối kỳ'), BUSY_TYPES.THI);
  assert.strictEqual(normalizeBusyType('Lịch trực cố định'), BUSY_TYPES.BAN_CO_DINH);
  assert.strictEqual(normalizeBusyType('Việc gia đình'), BUSY_TYPES.CONG_VIEC_KHAC);
  assert.strictEqual(normalizeBusyType(''), BUSY_TYPES.HOC_CHINH_KHOA);
});

test('Chặng 14: Parse file XLSX thật hợp lệ trích xuất đúng dòng và danh tính', () => {
  const xlsxBuffer = createValidAvailabilityXlsxBuffer();
  const members: MemberLookup[] = [
    { id: 'mem-01', fullName: 'Nguyễn Văn A', username: 'nguyenvana', studentId: '20230001' },
    { id: 'mem-02', fullName: 'Trần Thị B', username: 'tranthib', studentId: '20230002' },
  ];

  const preview = parseAvailabilityXlsxBuffer(xlsxBuffer, members, 'lich_ban_k68.xlsx');
  assert.strictEqual(preview.totalRows, 2);
  assert.strictEqual(preview.validCount, 2);
  assert.strictEqual(preview.errorCount, 0);
  assert.strictEqual(preview.isReadyToCommit, true);

  const row1 = preview.rows[0];
  assert.strictEqual(row1.resolvedMemberId, 'mem-01');
  assert.strictEqual(row1.normalizedDayOfWeek, DAYS_OF_WEEK.THU_HAI);
  assert.strictEqual(row1.normalizedStartTime, '08:00');
  assert.strictEqual(row1.normalizedEndTime, '11:30');
  assert.strictEqual(row1.isValid, true);

  const row2 = preview.rows[1];
  assert.strictEqual(row2.resolvedMemberId, 'mem-02');
  assert.strictEqual(row2.normalizedDayOfWeek, DAYS_OF_WEEK.THU_BA);
  assert.strictEqual(row2.normalizedStartTime, '14:00');
  assert.strictEqual(row2.normalizedEndTime, '17:00');
  assert.strictEqual(row2.normalizedBusyType, BUSY_TYPES.BAN_CO_DINH);
});

test('Chặng 14: Phòng thủ bảo mật - Từ chối tệp không phải ZIP hoặc chứa Macro/VBA', () => {
  // 1. Tệp không có header PK\x03\x04
  const fakeBuffer = Buffer.from('NOT A ZIP FILE', 'utf8');
  assert.throws(
    () => unpackXlsxZip(fakeBuffer),
    (err: any) => {
      assert.strictEqual(err.errorCode || err.code, 'INVALID_XLSX_FORMAT');
      return true;
    }
  );

  // 2. Tệp chứa Macro (vbaProject.bin)
  const macroBuffer = createMockZipBuffer([
    { name: '[Content_Types].xml', content: '<Types></Types>' },
    { name: 'xl/vbaProject.bin', content: 'DANGEROUS MACRO BINARY' },
  ]);
  assert.throws(
    () => unpackXlsxZip(macroBuffer),
    (err: any) => {
      assert.strictEqual(err.errorCode || err.code, 'MACRO_NOT_ALLOWED');
      return true;
    }
  );
});

test('Chặng 14: Preview phát hiện chính xác các dòng lỗi (Fail-Safe: Dòng lỗi không thành rảnh)', () => {
  const xlsxBuffer = createMixedAvailabilityXlsxBuffer();
  const members: MemberLookup[] = [
    { id: 'mem-01', fullName: 'Nguyễn Văn A', username: 'nguyenvana', studentId: '20230001' },
  ];

  const preview = parseAvailabilityXlsxBuffer(xlsxBuffer, members, 'mixed.xlsx');
  assert.strictEqual(preview.totalRows, 4);
  assert.strictEqual(preview.validCount, 1);
  assert.strictEqual(preview.errorCount, 3);

  // Dòng 1: Hợp lệ
  assert.strictEqual(preview.rows[0].isValid, true);

  // Dòng 2: Mã SV không tồn tại -> UNKNOWN_MEMBER
  assert.strictEqual(preview.rows[1].isValid, false);
  assert.strictEqual(preview.rows[1].errorCode, 'UNKNOWN_MEMBER');

  // Dòng 3: Giờ kết thúc <= giờ bắt đầu -> INVALID_TIME_RANGE
  assert.strictEqual(preview.rows[2].isValid, false);
  assert.strictEqual(preview.rows[2].errorCode, 'INVALID_TIME_RANGE');

  // Dòng 4: Thứ không nhận diện được -> INVALID_DAY_OF_WEEK
  assert.strictEqual(preview.rows[3].isValid, false);
  assert.strictEqual(preview.rows[3].errorCode, 'INVALID_DAY_OF_WEEK');
});

test('Chặng 14: Commit đợt import tạo version mới và lưu các khoảng giờ bận có kiểu', async () => {
  const db = createMockEnvironment();

  const res = await commitAvailabilityBatch(
    db,
    {
      batchName: 'Lịch bận kỳ 2025.1 Đợt 1',
      fileName: 'lich_ban_k2025.xlsx',
      fileHash: 'sha256-hash-01',
      fileSizeBytes: 15420,
      termSemester: '2025.1',
      effectiveStartDate: '2025-09-01',
      effectiveEndDate: '2026-01-15',
      validRows: [
        {
          memberId: 'mem-01',
          dayOfWeek: DAYS_OF_WEEK.THU_HAI,
          startTime: '08:00',
          endTime: '11:30',
          busyType: BUSY_TYPES.HOC_CHINH_KHOA,
          notes: 'Kíp 1',
        },
        {
          memberId: 'mem-02',
          dayOfWeek: DAYS_OF_WEEK.THU_BA,
          startTime: '14:00',
          endTime: '17:00',
          busyType: BUSY_TYPES.BAN_CO_DINH,
          notes: 'Trực phòng thí nghiệm',
        },
      ],
    },
    'mem-admin-01'
  );

  assert.strictEqual(res.batch.version, 1);
  assert.strictEqual(res.batch.status, 'COMMITTED');
  assert.strictEqual(res.intervalsCount, 2);

  // Tra cứu khoảng giờ bận của mem-01
  const intervalsMem1 = await getMemberBusyIntervals(db, 'mem-01');
  assert.strictEqual(intervalsMem1.length, 1);
  assert.strictEqual(intervalsMem1[0].dayOfWeek, DAYS_OF_WEEK.THU_HAI);
  assert.strictEqual(intervalsMem1[0].startTime, '08:00');
  assert.strictEqual(intervalsMem1[0].endTime, '11:30');
  assert.strictEqual(intervalsMem1[0].isActive, true);
});

test('Chặng 14: Re-import cùng kỳ học tăng version, superseded batch cũ và không duplicate intervals', async () => {
  const db = createMockEnvironment();

  // Đợt 1: Version 1
  await commitAvailabilityBatch(
    db,
    {
      batchName: 'Đợt 1',
      fileName: 'v1.xlsx',
      fileHash: 'hash-v1',
      fileSizeBytes: 10000,
      termSemester: '2025.1',
      effectiveStartDate: '2025-09-01',
      effectiveEndDate: '2026-01-15',
      validRows: [
        {
          memberId: 'mem-01',
          dayOfWeek: DAYS_OF_WEEK.THU_HAI,
          startTime: '08:00',
          endTime: '11:30',
          busyType: BUSY_TYPES.HOC_CHINH_KHOA,
        },
      ],
    },
    'mem-admin-01'
  );

  // Đợt 2: Version 2 cho cùng kỳ 2025.1
  const res2 = await commitAvailabilityBatch(
    db,
    {
      batchName: 'Đợt 2 (Cập nhật lịch bận tuần 3)',
      fileName: 'v2.xlsx',
      fileHash: 'hash-v2',
      fileSizeBytes: 12000,
      termSemester: '2025.1',
      effectiveStartDate: '2025-09-01',
      effectiveEndDate: '2026-01-15',
      validRows: [
        {
          memberId: 'mem-01',
          dayOfWeek: DAYS_OF_WEEK.THU_BA,
          startTime: '13:00',
          endTime: '15:30',
          busyType: BUSY_TYPES.HOC_CHINH_KHOA,
        },
      ],
    },
    'mem-admin-01'
  );

  assert.strictEqual(res2.batch.version, 2);

  // Batch cũ phải chuyển status = SUPERSEDED
  const batches = await listAvailabilityBatches(db, '2025.1');
  assert.strictEqual(batches.length, 2);
  const oldBatch = batches.find((b) => b.version === 1);
  assert.strictEqual(oldBatch?.status, 'SUPERSEDED');

  // Lịch bận đang hoạt động của mem-01 CHỈ CÒN 1 interval mới (không bị nhân đôi 2 intervals)
  const activeIntervals = await getMemberBusyIntervals(db, 'mem-01');
  assert.strictEqual(activeIntervals.length, 1);
  assert.strictEqual(activeIntervals[0].dayOfWeek, DAYS_OF_WEEK.THU_BA);
  assert.strictEqual(activeIntervals[0].startTime, '13:00');
});

test('Chặng 14: Tái phát idempotency trên commitAvailabilityBatch bảo toàn kết quả ban đầu', async () => {
  const db = createMockEnvironment();
  const idempotencyKey = 'idem-commit-avail-01';

  const params = {
    batchName: 'Lịch bận HK1',
    fileName: 'hk1.xlsx',
    fileHash: 'hash-hk1',
    fileSizeBytes: 8000,
    termSemester: '2025.1',
    effectiveStartDate: '2025-09-01',
    effectiveEndDate: '2026-01-15',
    validRows: [
      {
        memberId: 'mem-02',
        dayOfWeek: DAYS_OF_WEEK.THU_SAU,
        startTime: '09:00',
        endTime: '11:00',
        busyType: BUSY_TYPES.HOC_CHINH_KHOA,
      },
    ],
    idempotencyKey,
  };

  const res1 = await commitAvailabilityBatch(db, params, 'mem-admin-01');
  const batchCountBefore = db.dutyAvailabilityBatches.length;
  const intervalCountBefore = db.memberBusyIntervals.length;

  // Gọi lại cùng key
  const res2 = await commitAvailabilityBatch(db, params, 'mem-admin-01');

  assert.strictEqual(res2.batch.id, res1.batch.id);
  assert.strictEqual(db.dutyAvailabilityBatches.length, batchCountBefore);
  assert.strictEqual(db.memberBusyIntervals.length, intervalCountBefore);
});

test('P22-02 Regression: Chặn triệt để Zip Bomb với header giả mạo (claimed 1 byte, actual > 25MB)', () => {
  // Tạo payload nén 26 MiB zero-bytes (nén lại chỉ vài chục KB)
  const actualPayload = Buffer.alloc(26 * 1024 * 1024);
  const compressed = zlib.deflateRawSync(actualPayload);
  const filename = Buffer.from('xl/worksheets/sheet1.xml');

  // Header gian lận: ghi uncompressedSize = 1 byte (thay vì 26 MiB)
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8); // DEFLATED
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(1, 22); // Gian lận: khai 1 byte
  header.writeUInt16LE(filename.length, 26);
  header.writeUInt16LE(0, 28);

  const zip = Buffer.concat([header, filename, compressed]);

  // Phải ném lỗi ZIP_BOMB_DETECTED ngay khi phát hiện output thực tế vượt quá 25 MB
  assert.throws(
    () => {
      unpackXlsxZip(zip);
    },
    (err: any) => err.errorCode === 'ZIP_BOMB_DETECTED'
  );
});

test('P22-02 Regression: Chặn nhiều entries cộng dồn vượt tổng 25 MiB', () => {
  // 3 entries, mỗi entry 10 MiB -> tổng 30 MiB
  const partPayload = Buffer.alloc(10 * 1024 * 1024);
  const compressedPart = zlib.deflateRawSync(partPayload);

  const makeEntry = (nameStr: string) => {
    const fn = Buffer.from(nameStr);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0, 6);
    h.writeUInt16LE(8, 8);
    h.writeUInt32LE(compressedPart.length, 18);
    h.writeUInt32LE(partPayload.length, 22);
    h.writeUInt16LE(fn.length, 26);
    h.writeUInt16LE(0, 28);
    return Buffer.concat([h, fn, compressedPart]);
  };

  const multiZip = Buffer.concat([
    makeEntry('xl/worksheets/sheet1.xml'),
    makeEntry('xl/worksheets/sheet2.xml'),
    makeEntry('xl/worksheets/sheet3.xml'),
  ]);

  assert.throws(
    () => {
      unpackXlsxZip(multiZip);
    },
    (err: any) => err.errorCode === 'ZIP_BOMB_DETECTED'
  );
});

test('P22-02 Regression: Cấm hoàn toàn Macro/VBA binaries và tệp cắt cụt', () => {
  // 1. Tệp chứa vbaProject.bin
  const vbaZip = createMockZipBuffer([
    { name: 'xl/vbaProject.bin', content: 'vba-code', method: 0 },
    { name: 'xl/worksheets/sheet1.xml', content: '<worksheet/>', method: 0 },
  ]);
  assert.throws(
    () => unpackXlsxZip(vbaZip),
    (err: any) => err.errorCode === 'MACRO_NOT_ALLOWED'
  );

  // 2. Tệp ZIP bị cắt cụt (truncated)
  const validZip = createMockZipBuffer([{ name: 'test.xml', content: 'test', method: 0 }]);
  const truncatedZip = validZip.subarray(0, 35); // Cắt giữa chừng
  assert.throws(
    () => unpackXlsxZip(truncatedZip),
    (err: any) => err.errorCode === 'CORRUPTED_XLSX_STREAM'
  );

  // 3. File không phải ZIP
  const notZip = Buffer.from('NOT_A_ZIP_HEADER_DATA');
  assert.throws(
    () => unpackXlsxZip(notZip),
    (err: any) => err.errorCode === 'INVALID_XLSX_FORMAT'
  );
});
