/**
 * Borrower Business Rules & Input Validation - YSBK
 */

import { AppError } from '../errors.ts';
import type { CreateBorrowerParams, UpdateBorrowerParams } from './types.ts';

export class BorrowerError extends AppError {
  constructor(message: string, code = 'BORROWER_ERROR', httpStatus = 400) {
    super(message, httpStatus, code);
    this.name = 'BorrowerError';
  }

  get code(): string {
    return this.errorCode;
  }
}

/**
 * Chuẩn hóa số điện thoại di động Việt Nam:
 * - Loại bỏ khoảng trắng, dấu gạch ngang, dấu chấm, dấu ngoặc.
 * - Chuyển đổi đầu số quốc tế +84 / 84 thành 0.
 * - Kiểm tra định dạng 10 chữ số chuẩn nhà mạng Việt Nam (03x, 05x, 07x, 08x, 09x).
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new BorrowerError('Số điện thoại không được để trống.', 'INVALID_PHONE', 400);
  }

  // Loại bỏ các ký tự phân tách phổ biến
  let cleaned = rawPhone.replace(/[\s\-_.\(\)]/g, '');

  // Xử lý đầu số quốc tế +84 hoặc 84
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }

  // Định dạng chuẩn Việt Nam: 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09
  const vnPhoneRegex = /^0(3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  if (!vnPhoneRegex.test(cleaned)) {
    throw new BorrowerError(
      'Số điện thoại không đúng định dạng di động Việt Nam (yêu cầu 10 chữ số hợp lệ, ví dụ 0912345678).',
      'INVALID_PHONE_FORMAT',
      400
    );
  }

  return cleaned;
}

/**
 * Che dấu số điện thoại cho mục đích telemetry / audit log / error formatting
 * Tránh ghi toàn bộ PII vào log hệ thống.
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-3);
}

/**
 * Xác thực thông tin người mượn:
 * - Họ tên: bắt buộc, 2 - 150 ký tự.
 * - SĐT: bắt buộc, chuẩn hóa qua normalizePhone.
 * - MSSV, Trường: hoàn toàn tùy chọn (NULL đối với người dân ngoài trường Bách Khoa).
 * - Email: tùy chọn, kiểm tra định dạng nếu có.
 */
export function validateBorrowerInput(params: CreateBorrowerParams | UpdateBorrowerParams, isCreate = true): void {
  if (isCreate || params.fullName !== undefined) {
    const name = (params.fullName || '').trim();
    if (!name || name.length < 2 || name.length > 150) {
      throw new BorrowerError('Họ và tên người mượn phải từ 2 đến 150 ký tự.', 'INVALID_FULL_NAME', 400);
    }
  }

  if (isCreate || params.phone !== undefined) {
    normalizePhone(params.phone || '');
  }

  if (params.email) {
    const email = params.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BorrowerError('Địa chỉ email không đúng định dạng.', 'INVALID_EMAIL', 400);
    }
  }

  if (params.studentId !== undefined && params.studentId !== null) {
    const studentId = params.studentId.trim();
    if (studentId.length > 50) {
      throw new BorrowerError('Mã số sinh viên không được vượt quá 50 ký tự.', 'STUDENT_ID_TOO_LONG', 400);
    }
  }

  if (params.school !== undefined && params.school !== null) {
    const school = params.school.trim();
    if (school.length > 150) {
      throw new BorrowerError('Tên trường học / đơn vị không được vượt quá 150 ký tự.', 'SCHOOL_TOO_LONG', 400);
    }
  }
}
