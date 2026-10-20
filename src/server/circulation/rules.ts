/**
 * YSBK Circulation Module Rules (Chặng 07: Quy tắc nghiệp vụ mượn sách)
 */

import * as crypto from 'node:crypto';
import type { PaymentMethod } from '../finance/types.ts';
import {
  CirculationError,
  DuplicateCopyInLoanError,
  MaxCopiesExceededError,
  PaymentUnconfirmedError,
  FineReasonRequiredError,
  NoValidDutyShiftFoundError,
  type IssueLoanParams,
} from './types.ts';

/**
 * Chuẩn hóa phương thức thanh toán sang enum chuẩn CASH | BANK_TRANSFER
 */
export function normalizePaymentMethod(method: string): PaymentMethod {
  if (!method || typeof method !== 'string') {
    throw new CirculationError('Phương thức thanh toán không hợp lệ.', 'INVALID_PAYMENT_METHOD', 400);
  }
  const upper = method.trim().toUpperCase();
  if (upper === 'CASH' || upper === 'TIEN_MAT') {
    return 'CASH';
  }
  if (upper === 'BANK_TRANSFER' || upper === 'CHUYEN_KHOAN') {
    return 'BANK_TRANSFER';
  }
  throw new CirculationError(
    `Phương thức thanh toán '${method}' không được hỗ trợ. Chỉ chấp nhận CASH hoặc BANK_TRANSFER.`,
    'UNSUPPORTED_PAYMENT_METHOD',
    400
  );
}

/**
 * Lấy ngày hiện tại theo múi giờ chuẩn Việt Nam Asia/Ho_Chi_Minh (UTC+7)
 */
export function getCurrentVietnamDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Chuẩn hóa giá trị ngày bất kỳ (Date object, PG driver output, chuỗi ISO) thành YYYY-MM-DD
 * theo múi giờ chuẩn Việt Nam Asia/Ho_Chi_Minh (UTC+7).
 */
export function normalizeDateToVietnamYmd(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }
    return trimmed;
  }
  return String(val);
}

/**
 * Tính hạn mượn gốc: Cộng đúng 14 ngày lịch kể từ ngày mượn.
 * Ví dụ: mượn 2026-10-01 -> hạn 2026-10-15 (hết ngày).
 */
export function calculateDueDate(borrowDateStr: string, addDays = 14): string {
  const parts = borrowDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new CirculationError('Định dạng ngày mượn không hợp lệ (cần YYYY-MM-DD).', 'INVALID_BORROW_DATE', 400);
  }
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new CirculationError(`Ngày không hợp lệ trong lịch: ${borrowDateStr}`, 'INVALID_BORROW_DATE', 400);
  }
  // Dùng UTC Date để tránh nhảy múi giờ hay DST
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new CirculationError(`Ngày không hợp lệ trong lịch: ${borrowDateStr}`, 'INVALID_BORROW_DATE', 400);
  }
  d.setUTCDate(d.getUTCDate() + addDays);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

/**
 * Sinh mã số phiếu mượn duy nhất theo chuẩn YSBK:
 * YSBK-LN-YYYYMMDD-XXXX (4 ký tự ngẫu nhiên hex)
 */
export function generateReceiptNumber(dateStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `YSBK-LN-${cleanDate}-${suffix}`;
}

/**
 * Lịch trực định kỳ của YSBK: Thứ Ba và Thứ Năm hàng tuần (buổi trực bàn sách)
 */
export function isRegularDutyDay(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dayOfWeek = d.getUTCDay(); // 0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7
  return dayOfWeek === 2 || dayOfWeek === 4;
}

/**
 * Tính hạn mượn hiệu lực (S07-07):
 * Hạn gốc = ngày mượn + 14 ngày lịch (Asia/Ho_Chi_Minh).
 * Nếu ngày đến hạn rơi vào ngày không trực (không phải T3/T5) hoặc ngày nghỉ lễ/Tết đã cấu hình,
 * hạn hiệu lực được tịnh tiến tới buổi trực hợp lệ gần nhất tiếp theo.
 */
export function calculateEffectiveDueDate(
  borrowDateStr: string,
  addDays = 14,
  holidays: string[] = []
): {
  originalDueDate: string;
  effectiveDueDate: string;
  adjustmentReason?: string;
  isHolidayAdjusted: boolean;
} {
  const originalDueDate = calculateDueDate(borrowDateStr, addDays);
  let current = originalDueDate;
  const holidaySet = new Set(holidays);

  let adjusted = false;
  let reason: string | undefined = undefined;

  let safety = 0;
  while (safety < 60) {
    safety++;
    const isHoliday = holidaySet.has(current);
    const isDuty = isRegularDutyDay(current);

    if (isDuty && !isHoliday) {
      break;
    }

    if (safety >= 60) {
      throw new NoValidDutyShiftFoundError();
    }

    adjusted = true;
    if (isHoliday) {
      reason = reason ? `${reason}; Nghỉ lễ/Tết ${current}` : `Nghỉ lễ/Tết ngày ${current}`;
    } else if (!isDuty) {
      if (!reason) reason = 'Dời tới buổi trực gần nhất (Thứ Ba / Thứ Năm)';
    }

    current = calculateDueDate(current, 1);
  }

  return {
    originalDueDate,
    effectiveDueDate: current,
    adjustmentReason: adjusted ? reason : undefined,
    isHolidayAdjusted: adjusted,
  };
}

/**
 * Lấy hạn hiệu lực điều chỉnh theo lịch nghỉ lễ CLB cho một phiếu mượn hiện hữu.
 * S10-03: Nếu hạn hiện tại (currentDueDate) rơi vào ngày nghỉ lễ đã cấu hình,
 * dời tới buổi trực hợp lệ (T3/T5) không nghỉ tiếp theo.
 * Nếu không rơi vào ngày nghỉ lễ, giữ nguyên currentDueDate (không loại mọi ngày không trực khỏi phạt: T3 đến hạn -> T5 trả vẫn phạt 2 ngày).
 */
export function getHolidayAdjustedDueDate(
  currentDueDate: string,
  holidays: string[] = []
): {
  effectiveDueDate: string;
  isHolidayAdjusted: boolean;
  adjustmentReason?: string;
} {
  const normDue = normalizeDateToVietnamYmd(currentDueDate);
  const holidaySet = new Set(holidays);
  if (!holidaySet.has(normDue)) {
    return {
      effectiveDueDate: normDue,
      isHolidayAdjusted: false,
    };
  }

  let current = normDue;
  let safety = 0;
  let reason = `Nghỉ lễ/Tết ngày ${normDue}`;

  while (safety < 60) {
    safety++;
    current = calculateDueDate(current, 1);
    const isHoliday = holidaySet.has(current);
    const isDuty = isRegularDutyDay(current);

    if (isDuty && !isHoliday) {
      break;
    }

    if (safety >= 60) {
      throw new NoValidDutyShiftFoundError();
    }

    if (isHoliday) {
      reason += `; Nghỉ lễ/Tết ${current}`;
    }
  }

  return {
    effectiveDueDate: current,
    isHolidayAdjusted: true,
    adjustmentReason: reason,
  };
}

/**
 * Tính số ngày quá hạn theo múi giờ Việt Nam
 */
export function calculateOverdueDays(dueDateVal: unknown, returnDateVal: unknown): number {
  const dueDateStr = normalizeDateToVietnamYmd(dueDateVal);
  const returnDateStr = normalizeDateToVietnamYmd(returnDateVal);
  const pDue = dueDateStr.split('-').map(Number);
  const pRet = returnDateStr.split('-').map(Number);
  if (pDue.length !== 3 || pDue.some(isNaN) || pRet.length !== 3 || pRet.some(isNaN)) {
    return 0;
  }
  const dDue = Date.UTC(pDue[0], pDue[1] - 1, pDue[2]);
  const dRet = Date.UTC(pRet[0], pRet[1] - 1, pRet[2]);
  const diffMs = dRet - dDue;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Tính mức phạt gợi ý: 1.000₫ / ngày quá hạn trên toàn bộ phiếu
 */
export function calculateSuggestedFine(overdueDays: number): bigint {
  if (overdueDays <= 0) return 0n;
  return BigInt(overdueDays) * 1000n;
}

export interface FineEvaluationResult {
  overdueDays: number;
  fineSuggested: bigint;
  fineFinal: bigint;
  fineReason: string | null;
  totalDeposit: bigint;
  isForfeited: boolean;
  forfeitAmount: bigint;
  refundAmount: bigint;
  directFineCollectAmount: bigint;
}

/**
 * Đánh giá phạt và hoàn cọc theo nguyên tắc Chặng 08:
 * - D = Tổng cọc còn lại của phiếu.
 * - P = Mức phạt đã chốt sau điều chỉnh.
 * - Nếu P === 0: Hoàn đủ D, không thu phạt.
 * - Nếu 0 < P < D: Hoàn đủ D, và thu phạt P riêng biệt!
 * - Nếu P >= D: Giữ toàn bộ D làm phạt, không hoàn cọc, không thu thêm P - D.
 */
export function evaluateFineAndRefund(
  totalDeposit: bigint,
  fineFinal: bigint,
  fineSuggested: bigint,
  fineReason?: string | null
): FineEvaluationResult {
  if (fineFinal < 0n) {
    throw new CirculationError('Mức phạt chốt không được là số âm.', 'INVALID_FINE_AMOUNT', 400);
  }

  const cleanReason = fineReason ? fineReason.trim() : null;
  if (fineFinal !== fineSuggested) {
    if (!cleanReason || cleanReason.length === 0) {
      throw new FineReasonRequiredError();
    }
  }

  if (fineFinal >= totalDeposit) {
    // Trường hợp C: Phạt >= Cọc -> Giữ toàn bộ cọc làm phạt (forfeit)
    return {
      overdueDays: Number(fineSuggested / 1000n),
      fineSuggested,
      fineFinal,
      fineReason: cleanReason,
      totalDeposit,
      isForfeited: true,
      forfeitAmount: totalDeposit,
      refundAmount: 0n,
      directFineCollectAmount: 0n,
    };
  }

  if (fineFinal > 0n) {
    // Trường hợp B: 0 < P < D -> Hoàn đủ D và thu P riêng biệt
    return {
      overdueDays: Number(fineSuggested / 1000n),
      fineSuggested,
      fineFinal,
      fineReason: cleanReason,
      totalDeposit,
      isForfeited: false,
      forfeitAmount: 0n,
      refundAmount: totalDeposit,
      directFineCollectAmount: fineFinal,
    };
  }

  // Trường hợp A: P === 0 -> Hoàn đủ D, thu phạt = 0
  return {
    overdueDays: 0,
    fineSuggested,
    fineFinal: 0n,
    fineReason: cleanReason,
    totalDeposit,
    isForfeited: false,
    forfeitAmount: 0n,
    refundAmount: totalDeposit,
    directFineCollectAmount: 0n,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu yêu cầu lập phiếu mượn (S07-03 & S07-04)
 */
export function validateIssueLoanInput(params: IssueLoanParams): {
  normalizedBarcodes?: string[];
  normalizedCopyIds?: string[];
  paymentMethod: PaymentMethod;
  confirmedAmount?: bigint;
} {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new CirculationError('Dữ liệu yêu cầu lập phiếu mượn không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }

  if (!params.borrowerId || typeof params.borrowerId !== 'string' || params.borrowerId.trim().length === 0) {
    throw new CirculationError('Thiếu ID người mượn (borrowerId).', 'MISSING_BORROWER_ID', 400);
  }

  const paymentMethod = normalizePaymentMethod(params.paymentMethod);

  // Bắt buộc xác nhận tiền thực nhận (hỗ trợ cả paymentConfirmed và alias bankConfirmedByMember)
  const isConfirmed = params.paymentConfirmed === true || (params as any).bankConfirmedByMember === true;
  if (!isConfirmed) {
    throw new PaymentUnconfirmedError(
      'Thành viên phải xác nhận đã nhận đủ tiền mặt hoặc đã kiểm tra app ngân hàng trước khi lập phiếu.'
    );
  }

  // S07-03: Chống mixed selector và alias conflict
  const hasCopyBarcodes = params.copyBarcodes !== undefined;
  const hasBarcodesAlias = (params as any).barcodes !== undefined;
  const hasCopyIds = params.copyIds !== undefined;

  if (hasCopyBarcodes && hasBarcodesAlias) {
    const cb = params.copyBarcodes!;
    const b = (params as any).barcodes;
    if (JSON.stringify(cb) !== JSON.stringify(b)) {
      throw new CirculationError('Xung đột giữa copyBarcodes và barcodes alias.', 'ALIAS_CONFLICT', 400);
    }
  }

  if ((hasCopyBarcodes || hasBarcodesAlias) && hasCopyIds) {
    throw new CirculationError(
      'Không được truyền đồng thời cả selector barcodes và copyIds trong cùng một yêu cầu.',
      'MIXED_COPY_SELECTORS',
      400
    );
  }

  // Thu thập danh sách bản sách và kiểm tra từng phần tử (chống silent dropping)
  const rawList = hasCopyIds
    ? params.copyIds
    : params.copyBarcodes || (params as any).barcodes;

  if (!rawList || !Array.isArray(rawList)) {
    throw new CirculationError('Danh sách sách mượn phải là một mảng chuỗi ký tự.', 'INVALID_COPIES_LIST', 400);
  }

  if (rawList.length === 0) {
    throw new CirculationError('Phiếu mượn phải chứa ít nhất 1 bản sách.', 'EMPTY_COPIES_IN_LOAN', 400);
  }

  if (rawList.length > 2) {
    throw new MaxCopiesExceededError('Mỗi phiếu mượn chỉ được chứa tối đa 2 cuốn sách.');
  }

  const cleanedList: string[] = [];
  for (let idx = 0; idx < rawList.length; idx++) {
    const item = rawList[idx];
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new CirculationError(
        `Phần tử thứ ${idx + 1} trong danh sách sách mượn không hợp lệ (phải là chuỗi ký tự không rỗng).`,
        'INVALID_COPY_ELEMENT',
        400
      );
    }
    cleanedList.push(item.trim());
  }

  // Kiểm tra trùng lặp bản sách
  if (cleanedList.length === 2 && cleanedList[0] === cleanedList[1]) {
    throw new DuplicateCopyInLoanError(
      hasCopyIds
        ? 'Không thể mượn cùng một bản sách 2 lần trong một phiếu.'
        : 'Không thể mượn cùng một mã vạch 2 lần trong một phiếu.'
    );
  }

  // S07-04: Xử lý confirmedAmount nếu có gửi
  let confirmedAmount: bigint | undefined = undefined;
  if (params.confirmedAmount !== undefined && params.confirmedAmount !== null) {
    if (typeof params.confirmedAmount !== 'number' || !Number.isInteger(params.confirmedAmount) || params.confirmedAmount < 0) {
      throw new CirculationError('Số tiền cọc xác nhận (confirmedAmount) phải là số nguyên không âm.', 'INVALID_CONFIRMED_AMOUNT', 400);
    }
    confirmedAmount = BigInt(params.confirmedAmount);
  }

  return {
    normalizedBarcodes: !hasCopyIds ? cleanedList : undefined,
    normalizedCopyIds: hasCopyIds ? cleanedList : undefined,
    paymentMethod,
    confirmedAmount,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu yêu cầu tất toán trả sách (Chặng 08: Full Return & Chặng 09: Partial Return)
 */
export function validateSettleReturnInput(params: any): {
  receiptId: string;
  returnedBarcodes?: string[];
  returnedCopyIds?: string[];
  returnType: 'FULL' | 'PARTIAL';
  refundMethod: PaymentMethod;
  finePaymentMethod: PaymentMethod;
  finePaymentConfirmed: boolean;
  newDepositConfirmed: boolean;
  newDepositPaymentMethod: PaymentMethod;
  cashSessionId?: string;
  fineAmount?: bigint;
  fineReason?: string;
  notes?: string;
  paymentConfirmed: boolean;
} {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new CirculationError('Dữ liệu yêu cầu tất toán trả sách không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }

  const receiptId = params.receiptId || params.id;
  if (!receiptId || typeof receiptId !== 'string' || receiptId.trim().length === 0) {
    throw new CirculationError('Thiếu ID phiếu mượn (receiptId).', 'MISSING_RECEIPT_ID', 400);
  }

  const returnType: 'FULL' | 'PARTIAL' = params.returnType === 'PARTIAL' ? 'PARTIAL' : 'FULL';

  // S08-02: Kiểm tra alias conflict cho barcodes
  const barcodeAliases = [
    { name: 'returnedCopyBarcodes', val: params.returnedCopyBarcodes },
    { name: 'returnedBarcodes', val: params.returnedBarcodes },
    { name: 'copyBarcodes', val: params.copyBarcodes },
    { name: 'barcodes', val: params.barcodes },
  ].filter((a) => a.val !== undefined);

  if (barcodeAliases.length > 1) {
    const firstStr = JSON.stringify(barcodeAliases[0].val);
    for (let i = 1; i < barcodeAliases.length; i++) {
      if (JSON.stringify(barcodeAliases[i].val) !== firstStr) {
        throw new CirculationError(
          `Xung đột giữa ${barcodeAliases[0].name} và ${barcodeAliases[i].name}.`,
          'ALIAS_CONFLICT',
          400
        );
      }
    }
  }

  // Kiểm tra alias conflict cho copyIds
  const copyIdAliases = [
    { name: 'returnedCopyIds', val: params.returnedCopyIds },
    { name: 'copyIds', val: params.copyIds },
  ].filter((a) => a.val !== undefined);

  if (copyIdAliases.length > 1) {
    const firstStr = JSON.stringify(copyIdAliases[0].val);
    for (let i = 1; i < copyIdAliases.length; i++) {
      if (JSON.stringify(copyIdAliases[i].val) !== firstStr) {
        throw new CirculationError(
          `Xung đột giữa ${copyIdAliases[0].name} và ${copyIdAliases[i].name}.`,
          'ALIAS_CONFLICT',
          400
        );
      }
    }
  }

  const hasBarcodeSelector = barcodeAliases.length > 0;
  const hasCopyIdSelector = copyIdAliases.length > 0;

  if (hasBarcodeSelector && hasCopyIdSelector) {
    throw new CirculationError(
      'Không được truyền đồng thời cả selector barcodes và copyIds trong cùng một yêu cầu.',
      'MIXED_COPY_SELECTORS',
      400
    );
  }

  if (!hasBarcodeSelector && !hasCopyIdSelector) {
    throw new CirculationError(
      'Bắt buộc cung cấp danh sách sách trả (returnedCopyBarcodes hoặc returnedCopyIds).',
      'MISSING_RETURNED_COPIES_SELECTOR',
      400
    );
  }

  let returnedBarcodes: string[] | undefined = undefined;
  if (hasBarcodeSelector) {
    const rawList = barcodeAliases[0].val;
    if (!Array.isArray(rawList)) {
      throw new CirculationError('Danh sách mã vạch sách trả phải là một mảng chuỗi ký tự.', 'INVALID_RETURNED_BARCODES', 400);
    }
    if (rawList.length === 0) {
      throw new CirculationError('Danh sách mã vạch sách trả không được để rỗng.', 'EMPTY_RETURNED_COPIES_LIST', 400);
    }
    returnedBarcodes = [];
    for (let idx = 0; idx < rawList.length; idx++) {
      const b = rawList[idx];
      if (typeof b !== 'string' || b.trim().length === 0) {
        throw new CirculationError(
          `Mã vạch thứ ${idx + 1} trong danh sách sách trả không hợp lệ.`,
          'INVALID_RETURNED_BARCODE_ELEMENT',
          400
        );
      }
      returnedBarcodes.push(b.trim());
    }

    if (new Set(returnedBarcodes).size !== returnedBarcodes.length) {
      throw new CirculationError('Danh sách mã vạch sách trả chứa phần tử trùng lặp.', 'DUPLICATE_COPY_IN_RETURN', 400);
    }
  }

  let returnedCopyIds: string[] | undefined = undefined;
  if (hasCopyIdSelector) {
    const rawCopyList = copyIdAliases[0].val;
    if (!Array.isArray(rawCopyList)) {
      throw new CirculationError('Danh sách ID bản sách trả phải là một mảng chuỗi ký tự.', 'INVALID_RETURNED_COPY_IDS', 400);
    }
    if (rawCopyList.length === 0) {
      throw new CirculationError('Danh sách ID bản sách trả không được để rỗng.', 'EMPTY_RETURNED_COPIES_LIST', 400);
    }
    returnedCopyIds = [];
    for (let idx = 0; idx < rawCopyList.length; idx++) {
      const cid = rawCopyList[idx];
      if (typeof cid !== 'string' || cid.trim().length === 0) {
        throw new CirculationError(
          `ID bản sách thứ ${idx + 1} trong danh sách sách trả không hợp lệ.`,
          'INVALID_RETURNED_COPY_ID_ELEMENT',
          400
        );
      }
      returnedCopyIds.push(cid.trim());
    }

    if (new Set(returnedCopyIds).size !== returnedCopyIds.length) {
      throw new CirculationError('Danh sách ID bản sách trả chứa phần tử trùng lặp.', 'DUPLICATE_COPY_IN_RETURN', 400);
    }
  }

  const refundMethod = params.refundMethod ? normalizePaymentMethod(params.refundMethod) : 'CASH';
  const finePaymentMethod = params.finePaymentMethod
    ? normalizePaymentMethod(params.finePaymentMethod)
    : refundMethod;

  const cashSessionId = params.cashSessionId ? String(params.cashSessionId).trim() : undefined;

  let fineAmount: bigint | undefined = undefined;
  if (params.fineAmount !== undefined && params.fineAmount !== null) {
    const num = Number(params.fineAmount);
    if (isNaN(num) || !Number.isInteger(num) || num < 0) {
      throw new CirculationError('Mức phạt chốt (fineAmount) phải là số nguyên không âm.', 'INVALID_FINE_AMOUNT', 400);
    }
    fineAmount = BigInt(num);
  }

  const isConfirmed = params.paymentConfirmed === true || (params as any).bankConfirmedByMember === true;
  const finePaymentConfirmed = params.finePaymentConfirmed !== undefined
    ? params.finePaymentConfirmed === true
    : isConfirmed;
  const newDepositConfirmed = params.newDepositConfirmed === true;
  const newDepositPaymentMethod = params.newDepositPaymentMethod
    ? normalizePaymentMethod(params.newDepositPaymentMethod)
    : 'CASH';

  return {
    receiptId: receiptId.trim(),
    returnedBarcodes,
    returnedCopyIds,
    returnType,
    refundMethod,
    finePaymentMethod,
    finePaymentConfirmed,
    newDepositConfirmed,
    newDepositPaymentMethod,
    cashSessionId,
    fineAmount,
    fineReason: params.fineReason ? String(params.fineReason).trim() : undefined,
    notes: params.notes ? String(params.notes).trim() : undefined,
    paymentConfirmed: isConfirmed,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu yêu cầu gia hạn phiếu mượn (Chặng 10: Renewal)
 */
export function validateRenewLoanInput(params: any): {
  receiptId: string;
  cashSessionId?: string;
  fineAmount?: bigint;
  fineReason?: string;
  finePaymentMethod: PaymentMethod;
  finePaymentConfirmed: boolean;
  notes?: string;
} {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new CirculationError('Dữ liệu yêu cầu gia hạn không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }

  const receiptId = params.receiptId || params.id;
  if (!receiptId || typeof receiptId !== 'string' || receiptId.trim().length === 0) {
    throw new CirculationError('Thiếu ID phiếu mượn (receiptId).', 'MISSING_RECEIPT_ID', 400);
  }

  let fineAmount: bigint | undefined = undefined;
  if (params.fineAmount !== undefined && params.fineAmount !== null) {
    const num = Number(params.fineAmount);
    if (isNaN(num) || !Number.isInteger(num) || num < 0) {
      throw new CirculationError('Mức phạt chốt (fineAmount) phải là số nguyên không âm.', 'INVALID_FINE_AMOUNT', 400);
    }
    fineAmount = BigInt(num);
  }

  const finePaymentMethod: PaymentMethod = params.finePaymentMethod
    ? normalizePaymentMethod(params.finePaymentMethod)
    : 'CASH';

  const finePaymentConfirmed = params.finePaymentConfirmed === true;
  const cashSessionId = params.cashSessionId ? String(params.cashSessionId).trim() : undefined;

  return {
    receiptId: receiptId.trim(),
    cashSessionId,
    fineAmount,
    fineReason: params.fineReason ? String(params.fineReason).trim() : undefined,
    finePaymentMethod,
    finePaymentConfirmed,
    notes: params.notes ? String(params.notes).trim() : undefined,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu xác nhận nộp cọc mới (T73 Finalize)
 */
export function validateConfirmNewDepositInput(params: any): {
  receiptId: string;
  cashSessionId?: string;
  paymentMethod: PaymentMethod;
  paymentConfirmed: boolean;
  notes?: string;
} {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new CirculationError('Dữ liệu yêu cầu thu cọc mới không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }
  const receiptId = params.receiptId || params.id;
  if (!receiptId || typeof receiptId !== 'string' || receiptId.trim().length === 0) {
    throw new CirculationError('Thiếu ID phiếu mượn (receiptId).', 'MISSING_RECEIPT_ID', 400);
  }
  if (params.paymentConfirmed !== true) {
    throw new PaymentUnconfirmedError('Bắt buộc xác nhận tiền cọc mới thực tế đã nhận (paymentConfirmed: true).');
  }
  const paymentMethod = params.paymentMethod ? normalizePaymentMethod(params.paymentMethod) : 'CASH';
  const cashSessionId = params.cashSessionId ? String(params.cashSessionId).trim() : undefined;

  return {
    receiptId: receiptId.trim(),
    cashSessionId,
    paymentMethod,
    paymentConfirmed: true,
    notes: params.notes ? String(params.notes).trim() : undefined,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu thu tiền phạt chờ thu (Pending Fine Collection)
 */
export function validateCollectPendingFineInput(params: any): {
  receiptId: string;
  targetId?: string;
  sourceId?: string;
  cashSessionId?: string;
  paymentMethod: PaymentMethod;
  paymentConfirmed: boolean;
  amount?: bigint;
  notes?: string;
} {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new CirculationError('Dữ liệu yêu cầu thu phạt chờ thu không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }
  const receiptId = params.receiptId || params.id;
  if (!receiptId || typeof receiptId !== 'string' || receiptId.trim().length === 0) {
    throw new CirculationError('Thiếu ID phiếu mượn (receiptId).', 'MISSING_RECEIPT_ID', 400);
  }
  if (params.paymentConfirmed !== true) {
    throw new PaymentUnconfirmedError('Bắt buộc xác nhận tiền phạt thực tế đã thu (paymentConfirmed: true).');
  }
  let amount: bigint | undefined = undefined;
  if (params.amount !== undefined && params.amount !== null) {
    const num = Number(params.amount);
    if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
      throw new CirculationError('Số tiền phạt thu phải là số nguyên dương.', 'INVALID_FINE_AMOUNT', 400);
    }
    amount = BigInt(num);
  }
  const paymentMethod = params.paymentMethod ? normalizePaymentMethod(params.paymentMethod) : 'CASH';
  const cashSessionId = params.cashSessionId ? String(params.cashSessionId).trim() : undefined;
  const targetId = params.targetId ? String(params.targetId).trim() : (params.sourceId ? String(params.sourceId).trim() : undefined);

  return {
    receiptId: receiptId.trim(),
    targetId,
    sourceId: targetId,
    cashSessionId,
    paymentMethod,
    paymentConfirmed: true,
    amount,
    notes: params.notes ? String(params.notes).trim() : undefined,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu yêu cầu báo mất sách (Lost Book - Chặng 11)
 */
export function validateReportBookLossInput(params: any): {
  receiptId: string;
  copyIds?: string[];
  barcodes?: string[];
  reason: string;
  cashSessionId?: string;
  notes?: string;
} {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new CirculationError('Dữ liệu yêu cầu báo mất sách không hợp lệ.', 'INVALID_REQUEST_BODY', 400);
  }

  const receiptId = params.receiptId || params.id;
  if (!receiptId || typeof receiptId !== 'string' || receiptId.trim().length === 0) {
    throw new CirculationError('Thiếu ID phiếu mượn (receiptId).', 'MISSING_RECEIPT_ID', 400);
  }

  const reason = params.reason ? String(params.reason).trim() : '';
  if (!reason || reason.length < 5) {
    throw new CirculationError('Bắt buộc cung cấp lý do báo mất sách (ít nhất 5 ký tự).', 'MISSING_LOSS_REASON', 400);
  }

  const hasCopyIds = params.copyIds !== undefined && params.copyIds !== null;
  const hasBarcodes = params.barcodes !== undefined && params.barcodes !== null;

  // S11-06: Chặn alias conflict: chỉ được dùng một loại selector (hoặc copyIds, hoặc barcodes)
  if (hasCopyIds && hasBarcodes) {
    throw new CirculationError(
      'Xung đột tham số chọn sách: Chỉ được truyền một trong hai kiểu nhận diện (copyIds hoặc barcodes), không được truyền cả hai đồng thời.',
      'SELECTOR_ALIAS_CONFLICT',
      400
    );
  }

  if (!hasCopyIds && !hasBarcodes) {
    throw new CirculationError('Bắt buộc cung cấp copyIds hoặc barcodes của sách báo mất.', 'MISSING_LOST_COPIES_SELECTOR', 400);
  }

  let copyIds: string[] | undefined = undefined;
  if (hasCopyIds) {
    if (!Array.isArray(params.copyIds) || params.copyIds.length === 0) {
      throw new CirculationError('Danh sách copyIds phải là một mảng không rỗng.', 'INVALID_COPY_IDS', 400);
    }
    const set = new Set<string>();
    copyIds = [];
    for (const raw of params.copyIds) {
      if (typeof raw !== 'string' || raw.trim().length === 0) {
        throw new CirculationError('ID bản sách báo mất không hợp lệ.', 'INVALID_COPY_ID', 400);
      }
      const trimmed = raw.trim();
      if (set.has(trimmed)) {
        throw new CirculationError(`Phát hiện bản sách '${trimmed}' bị lặp lại trong danh sách báo mất.`, 'DUPLICATE_COPY_ID', 400);
      }
      set.add(trimmed);
      copyIds.push(trimmed);
    }
  }

  let barcodes: string[] | undefined = undefined;
  if (hasBarcodes) {
    if (!Array.isArray(params.barcodes) || params.barcodes.length === 0) {
      throw new CirculationError('Danh sách barcodes phải là một mảng không rỗng.', 'INVALID_BARCODES', 400);
    }
    const set = new Set<string>();
    barcodes = [];
    for (const raw of params.barcodes) {
      if (typeof raw !== 'string' || raw.trim().length === 0) {
        throw new CirculationError('Mã vạch bản sách báo mất không hợp lệ.', 'INVALID_BARCODE', 400);
      }
      const trimmed = raw.trim();
      if (set.has(trimmed)) {
        throw new CirculationError(`Phát hiện mã vạch '${trimmed}' bị lặp lại trong danh sách báo mất.`, 'DUPLICATE_BARCODE', 400);
      }
      set.add(trimmed);
      barcodes.push(trimmed);
    }
  }

  const cashSessionId = params.cashSessionId ? String(params.cashSessionId).trim() : undefined;
  const notes = params.notes ? String(params.notes).trim() : undefined;

  return {
    receiptId: receiptId.trim(),
    copyIds,
    barcodes,
    reason,
    cashSessionId,
    notes,
  };
}
