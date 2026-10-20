import test from 'node:test';
import assert from 'node:assert';
import {
  calculateDeposit,
  validateBarcode,
} from '../../src/server/catalog/rules.ts';
import {
  getBookById,
  createBookCopy,
  updateBookCopy,
  archiveBookCopy,
  DuplicateBarcodeError,
} from '../../src/server/catalog/service.ts';
import { MockCashDbQueryable } from './mock-db-helper.ts';

test('G-catalog 1: Deposit calculation formula and edge cases', () => {
  // 1. Quyết định nghiệp vụ YSBK:
  // 74k -> 50k
  assert.strictEqual(calculateDeposit(74000), 50000n);
  assert.strictEqual(calculateDeposit(74000n), 50000n);

  // 75k -> 100k (mốc giữa làm tròn lên)
  assert.strictEqual(calculateDeposit(75000), 100000n);
  assert.strictEqual(calculateDeposit(75000n), 100000n);

  // 230k -> 250k
  assert.strictEqual(calculateDeposit(230000), 250000n);
  assert.strictEqual(calculateDeposit(230000n), 250000n);

  // 2. Chưa biết giá bìa (null hoặc undefined) -> cọc mặc định 50k
  assert.strictEqual(calculateDeposit(null), 50000n);
  assert.strictEqual(calculateDeposit(undefined), 50000n);

  // 3. Giá 0đ -> cọc tối thiểu 50k (không đánh đồng 0 với NULL)
  assert.strictEqual(calculateDeposit(0), 50000n);
  assert.strictEqual(calculateDeposit(0n), 50000n);

  // 4. Các mốc khác
  assert.strictEqual(calculateDeposit(25000), 50000n); // 25k -> 50k
  assert.strictEqual(calculateDeposit(125000), 150000n); // 125k -> 150k

  // 5. Giá âm bị từ chối
  assert.throws(() => calculateDeposit(-50000), /không được là số âm/);
  assert.throws(() => calculateDeposit(-1n), /không được là số âm/);

  // 6. Số lẻ VND bị từ chối
  assert.throws(() => calculateDeposit(74000.5), /không chấp nhận số lẻ thập phân/);

  // 7. NaN / Infinity bị từ chối
  assert.throws(() => calculateDeposit(NaN), /không hợp lệ/);
  assert.throws(() => calculateDeposit(Infinity), /không hợp lệ/);
});

test('G-catalog 2: Barcode validation rules', () => {
  assert.strictEqual(validateBarcode('YSBK-BK-001'), 'YSBK-BK-001');
  assert.strictEqual(validateBarcode('  BOOK.123_45  '), 'BOOK.123_45');

  // Rỗng hoặc sai độ dài
  assert.throws(() => validateBarcode(''), /không được để trống/);
  assert.throws(() => validateBarcode('AB'), /từ 3 đến 50 ký tự/);
  assert.throws(() => validateBarcode('A'.repeat(51)), /từ 3 đến 50 ký tự/);

  // Ký tự đặc biệt nguy hiểm
  assert.throws(() => validateBarcode('BAR<CODE>'), /chỉ được chứa chữ cái/);
  assert.throws(() => validateBarcode('BAR CODE'), /chỉ được chứa chữ cái/);
});

test('G-catalog 3: Two copies of the same edition with different prices and locations', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  // Seed Edition
  const editionId = 'ed-001';
  db.bookTitles.push({
    id: 'title-001',
    title: 'Giải Tích 1',
    original_title: 'Calculus I',
    description: 'Giáo trình Giải tích Bách Khoa',
  });
  db.bookEditions.push({
    id: editionId,
    title_id: 'title-001',
    publisher: 'NXB Bách Khoa Hà Nội',
    publish_year: 2022,
  });

  // Tạo Copy 1: Giá bìa 74,000 VND tại KHO_THU_VIEN
  const copy1 = await createBookCopy(
    db,
    {
      editionId,
      barcode: 'BK-CALC-01',
      location: 'KHO_THU_VIEN',
      coverPrice: 74000,
      conditionNote: 'Sách mới 95%',
    },
    actorId
  );

  // Tạo Copy 2: Giá bìa 230,000 VND tại KHO_HOI_SINH_VIEN (bản bìa cứng đặc biệt)
  const copy2 = await createBookCopy(
    db,
    {
      editionId,
      barcode: 'BK-CALC-02',
      location: 'KHO_HOI_SINH_VIEN',
      coverPrice: 230000,
      conditionNote: 'Bản bìa cứng có phụ lục',
    },
    actorId
  );

  assert.strictEqual(copy1.barcode, 'BK-CALC-01');
  assert.strictEqual(copy1.location, 'KHO_THU_VIEN');
  assert.strictEqual(copy1.coverPrice, 74000);
  assert.strictEqual(copy1.calculatedDeposit, 50000); // 74k -> 50k

  assert.strictEqual(copy2.barcode, 'BK-CALC-02');
  assert.strictEqual(copy2.location, 'KHO_HOI_SINH_VIEN');
  assert.strictEqual(copy2.coverPrice, 230000);
  assert.strictEqual(copy2.calculatedDeposit, 250000); // 230k -> 250k

  // Không cho phép trùng mã vạch
  await assert.rejects(
    () =>
      createBookCopy(
        db,
        {
          editionId,
          barcode: 'BK-CALC-01',
        },
        actorId
      ),
    (err: any) => err instanceof DuplicateBarcodeError
  );
});

test('G-catalog 4: Updating copy metadata blocks changing loan status', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  db.bookTitles.push({ id: 'title-001', title: 'Vật Lý Đại Cương 1' });
  db.bookEditions.push({ id: 'ed-001', title_id: 'title-001', publisher: 'NXB Bách Khoa' });
  db.bookCopies.push({
    id: 'copy-001',
    edition_id: 'ed-001',
    barcode: 'BK-PHYS-01',
    location: 'KHO_THU_VIEN',
    status: 'AVAILABLE',
    cover_price: '80000',
    condition_note: 'Bình thường',
    created_at: new Date().toISOString(),
  });

  // Bất biến: Chặn tuyệt đối việc truyền `status` qua API cập nhật metadata
  await assert.rejects(
    () =>
      updateBookCopy(
        db,
        'copy-001',
        {
          status: 'BORROWED', // Cố tình vượt mặt lưu thông
        } as any,
        actorId
      ),
    /Không được phép thay đổi trạng thái mượn trả qua API chỉnh sửa thông tin sách/
  );

  // Cập nhật vị trí và ghi chú tình trạng hợp lệ
  const updated = await updateBookCopy(
    db,
    'copy-001',
    {
      location: 'BAN_TRUC_TAM',
      conditionNote: 'Chuyển ra bàn trực phục vụ ca mượn',
    },
    actorId
  );

  assert.strictEqual(updated.location, 'BAN_TRUC_TAM');
  assert.strictEqual(updated.conditionNote, 'Chuyển ra bàn trực phục vụ ca mượn');
  assert.strictEqual(updated.status, 'AVAILABLE'); // Trạng thái mượn trả không bị tác động
});

test('G-catalog 5: Archiving copy preserves record and blocks archiving borrowed copies', async () => {
  const db = new MockCashDbQueryable();
  const actorId = '00000000-0000-0000-0000-000000000001';

  db.bookTitles.push({ id: 'title-001', title: 'Hóa Học Đại Cương' });
  db.bookEditions.push({ id: 'ed-001', title_id: 'title-001', publisher: 'NXB Bách Khoa' });

  // Cuốn 1: Đang được mượn
  db.bookCopies.push({
    id: 'copy-borrowed',
    edition_id: 'ed-001',
    barcode: 'BK-CHEM-01',
    location: 'KHO_THU_VIEN',
    status: 'BORROWED',
    cover_price: '60000',
    created_at: new Date().toISOString(),
  });

  // Cuốn 2: Đang sẵn sàng (hỏng rách cần lưu trữ kho cũ)
  db.bookCopies.push({
    id: 'copy-available',
    edition_id: 'ed-001',
    barcode: 'BK-CHEM-02',
    location: 'KHO_THU_VIEN',
    status: 'AVAILABLE',
    cover_price: '60000',
    created_at: new Date().toISOString(),
  });

  // 1. Thử lưu trữ cuốn đang mượn -> Bị từ chối
  await assert.rejects(
    () => archiveBookCopy(db, 'copy-borrowed', actorId),
    /Không thể lưu trữ \(archive\) bản sách đang được mượn/
  );

  // 2. Lưu trữ cuốn khả dụng -> Thành công
  const archived = await archiveBookCopy(db, 'copy-available', actorId);
  assert.strictEqual(archived.status, 'ARCHIVED');

  // 3. Thử chỉnh sửa cuốn đã lưu trữ -> Bị từ chối
  await assert.rejects(
    () =>
      updateBookCopy(
        db,
        'copy-available',
        {
          conditionNote: 'Thử sửa sau khi archive',
        },
        actorId
      ),
    /Bản sách đã lưu trữ \(ARCHIVED\) không được phép chỉnh sửa thông tin/
  );
});

test('G-catalog 6: Public Book DTO never leaks internal barcode or borrower info', async () => {
  const db = new MockCashDbQueryable();

  db.bookTitles.push({
    id: 'title-public-01',
    title: 'Lập Trình Hướng Đối Tượng với C++',
    original_title: 'Object-Oriented Programming with C++',
    description: 'Giáo trình CNTT',
    authors: ['Nguyễn Văn A', 'Trần Thị B'],
    categories: ['Công nghệ thông tin', 'Giáo trình đại học'],
  });

  db.bookEditions.push({
    id: 'ed-pub-01',
    title_id: 'title-public-01',
    publisher: 'NXB Giáo Dục',
    publish_year: 2021,
    isbn: '978-604-0-12345-6',
  });

  db.bookCopies.push({
    id: 'copy-internal-01',
    edition_id: 'ed-pub-01',
    barcode: 'INTERNAL-BARCODE-SECRET-999',
    location: 'KHO_THU_VIEN',
    status: 'AVAILABLE',
    cover_price: '110000', // Cọc 100k
    condition_note: 'Ghi chú nội bộ: Rách nhẹ trang 15, độc giả không được biết',
  });

  const detail = await getBookById(db, 'title-public-01');
  assert.ok(detail);

  // Kiểm tra Public DTO chỉ chứa thông tin công khai
  assert.strictEqual(detail.title, 'Lập Trình Hướng Đối Tượng với C++');
  assert.strictEqual(detail.authors.length, 2);
  assert.strictEqual(detail.categories.length, 2);
  assert.strictEqual(detail.editions.length, 1);
  assert.strictEqual(detail.editions[0].standardDeposit, 100000); // 110k -> cọc 100k

  // Không rò rỉ mã vạch cá nhân hoặc ghi chú nội bộ vào public DTO
  const detailJson = JSON.stringify(detail);
  assert.strictEqual(detailJson.includes('INTERNAL-BARCODE-SECRET-999'), false);
  assert.strictEqual(detailJson.includes('Rách nhẹ trang 15'), false);
  assert.strictEqual(detailJson.includes('borrower'), false);
});
