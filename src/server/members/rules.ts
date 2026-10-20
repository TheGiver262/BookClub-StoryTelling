import { 
  DEPARTMENTS, DEPARTMENT_ROLES, 
  type AddAffiliationParams, type CollectDuesParams, 
  type Department, type DepartmentRole 
} from './types.ts';
import { assertSafeVndAmount } from '../finance/types.ts';
import { BadRequestError } from '../errors.ts';

export function validateAddAffiliationInput(params: any): AddAffiliationParams {
  if (!params || typeof params !== 'object') {
    throw new BadRequestError('Dữ liệu phân ban không hợp lệ.', 'INVALID_AFFILIATION_PAYLOAD');
  }

  const memberId = typeof params.memberId === 'string' ? params.memberId.trim() : '';
  if (!memberId) {
    throw new BadRequestError('Bắt buộc cung cấp memberId hợp lệ.', 'MISSING_MEMBER_ID');
  }

  const validDepts = Object.values(DEPARTMENTS);
  if (!validDepts.includes(params.department as Department)) {
    throw new BadRequestError(
      `Ban không hợp lệ. Phải là một trong: ${validDepts.join(', ')}.`,
      'INVALID_DEPARTMENT'
    );
  }

  const validRoles = Object.values(DEPARTMENT_ROLES);
  if (!validRoles.includes(params.role as DepartmentRole)) {
    throw new BadRequestError(
      `Chức vụ không hợp lệ. Phải là một trong: ${validRoles.join(', ')}.`,
      'INVALID_DEPARTMENT_ROLE'
    );
  }

  const termYear = typeof params.termYear === 'string' && params.termYear.trim() 
    ? params.termYear.trim() 
    : '2025-2026';

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const startDate = typeof params.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate.trim())
    ? params.startDate.trim()
    : todayStr;

  return {
    memberId,
    department: params.department as Department,
    role: params.role as DepartmentRole,
    termYear,
    startDate,
    notes: params.notes ? String(params.notes).trim() : undefined,
    endPreviousForDept: params.endPreviousForDept === true,
  };
}

export function validateCollectDuesInput(params: any): CollectDuesParams & { validatedAmount: bigint } {
  if (!params || typeof params !== 'object') {
    throw new BadRequestError('Dữ liệu thu hội phí không hợp lệ.', 'INVALID_DUES_PAYLOAD');
  }

  const memberId = typeof params.memberId === 'string' ? params.memberId.trim() : '';
  if (!memberId) {
    throw new BadRequestError('Bắt buộc cung cấp memberId hợp lệ.', 'MISSING_MEMBER_ID');
  }

  const rawAmount = params.amount !== undefined ? params.amount : 100000;
  const validatedAmount = assertSafeVndAmount(rawAmount, { allowZero: false });

  if (params.paymentMethod !== 'CASH' && params.paymentMethod !== 'BANK_TRANSFER') {
    throw new BadRequestError('Phương thức thu hội phí phải là CASH hoặc BANK_TRANSFER.', 'INVALID_PAYMENT_METHOD');
  }

  if (params.paymentConfirmed !== true) {
    throw new BadRequestError(
      'Bắt buộc xác nhận đã thực nhận đủ tiền hội phí thực tế (paymentConfirmed: true).',
      'PAYMENT_CONFIRMATION_REQUIRED'
    );
  }

  const termLabel = typeof params.termLabel === 'string' && params.termLabel.trim()
    ? params.termLabel.trim()
    : 'Hội phí thành viên một lần (Kỳ tuyển K69)';

  return {
    memberId,
    amount: Number(validatedAmount),
    validatedAmount,
    paymentMethod: params.paymentMethod,
    paymentConfirmed: true,
    cashSessionId: params.cashSessionId ? String(params.cashSessionId).trim() : null,
    termLabel,
    notes: params.notes ? String(params.notes).trim() : undefined,
    idempotencyKey: params.idempotencyKey ? String(params.idempotencyKey).trim() : undefined,
  };
}
