/**
 * Catalog Business Rules & Constraints - YSBK
 */

import { AppError } from '../errors.ts';
import type { CopyStatus } from './types.ts';

export class CatalogError extends AppError {
  constructor(message: string, code = 'CATALOG_ERROR', httpStatus = 400) {
    super(message, httpStatus, code);
    this.name = 'CatalogError';
  }
}

/**
 * Tính số tiền cọc chuẩn dựa trên giá bìa cuốn sách (Quyết định nghiệp vụ YSBK):
 * - Nếu chưa biết giá bìa (null hoặc undefined): Cọc mặc định 50,000 VND.
 * - Giá bìa không được âm và không được là số lẻ/phân số VND.
 * - Giá bìa = 0: Cọc tối thiểu 50,000 VND (không đánh đồng 0 với null).
 * - Cọc là bội số 50,000 VND gần nhất; điểm giữa (ví dụ 75,000) làm tròn LÊN.
 * - Mức cọc tối thiểu cho mọi cuốn sách là 50,000 VND.
 *
 * Bằng chứng mẫu:
 * 74,000 VND -> 50,000 VND
 * 75,000 VND -> 100,000 VND
 * 230,000 VND -> 250,000 VND
 * null -> 50,000 VND
 */
export function calculateDeposit(coverPrice: bigint | number | null | undefined): bigint {
  if (coverPrice === null || coverPrice === undefined) {
    return 50_000n;
  }

  if (typeof coverPrice === 'number') {
    if (Number.isNaN(coverPrice) || !Number.isFinite(coverPrice)) {
      throw new CatalogError('Giá bìa không hợp lệ (NaN hoặc Infinity).', 'INVALID_COVER_PRICE', 400);
    }
    if (coverPrice < 0) {
      throw new CatalogError('Giá bìa không được là số âm.', 'NEGATIVE_COVER_PRICE', 400);
    }
    if (coverPrice % 1 !== 0) {
      throw new CatalogError('Giá bìa VND không chấp nhận số lẻ thập phân.', 'FRACTIONAL_VND_PRICE', 400);
    }
    coverPrice = BigInt(coverPrice);
  } else if (typeof coverPrice === 'bigint') {
    if (coverPrice < 0n) {
      throw new CatalogError('Giá bìa không được là số âm.', 'NEGATIVE_COVER_PRICE', 400);
    }
  } else {
    throw new CatalogError('Kiểu dữ liệu giá bìa không hợp lệ.', 'INVALID_COVER_PRICE_TYPE', 400);
  }

  const step = 50_000n;
  const halfStep = 25_000n;

  // Công thức làm tròn bội 50k, mốc giữa làm tròn lên: (price + 25_000n) / 50_000n * 50_000n
  const rounded = ((coverPrice + halfStep) / step) * step;

  // Cọc tối thiểu 50,000 VND
  return rounded < 50_000n ? 50_000n : rounded;
}

/**
 * Xác thực mã vạch / barcode của bản sách vật lý
 */
export function validateBarcode(barcode: string): string {
  if (!barcode || typeof barcode !== 'string') {
    throw new CatalogError('Mã vạch (barcode) không được để trống.', 'INVALID_BARCODE', 400);
  }
  const trimmed = barcode.trim();
  if (trimmed.length < 3 || trimmed.length > 50) {
    throw new CatalogError('Mã vạch phải có độ dài từ 3 đến 50 ký tự.', 'INVALID_BARCODE_LENGTH', 400);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new CatalogError('Mã vạch chỉ được chứa chữ cái, chữ số, dấu gạch nối, gạch dưới hoặc dấu chấm.', 'INVALID_BARCODE_FORMAT', 400);
  }
  return trimmed;
}

/**
 * Kiểm soát cập nhật metadata bản sách:
 * - Bất biến: API metadata tuyệt đối KHÔNG cho phép tự ý đổi `status`
 *   (AVAILABLE, BORROWED, LOST,...) để tránh vượt mặt giao dịch mượn/trả (Circulation Transaction).
 * - Bản sách đã `ARCHIVED` không được phép chỉnh sửa.
 */
export function assertCanUpdateCopy(currentStatus: CopyStatus, patch: { status?: any; [key: string]: any }): void {
  if (currentStatus === 'ARCHIVED') {
    throw new CatalogError('Bản sách đã lưu trữ (ARCHIVED) không được phép chỉnh sửa thông tin.', 'COPY_ALREADY_ARCHIVED', 400);
  }

  if (patch.status !== undefined) {
    throw new CatalogError(
      'Không được phép thay đổi trạng thái mượn trả qua API chỉnh sửa thông tin sách. Mọi biến động trạng thái phải qua quy trình nghiệp vụ lưu thông.',
      'STATUS_TRANSITION_FORBIDDEN',
      400
    );
  }
}
