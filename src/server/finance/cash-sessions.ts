/**
 * YSBK Core Finance: Cash Sessions Management (Quản Lý Phiên Quầy Tiền Mặt Bàn Trực)
 * Quản lý mở/đóng ca quầy, đối soát hộp tiền tại bàn trực thuộc Quỹ Mượn–Trả (FUND_LOAN).
 * - Một hộp tiền chung duy nhất tại bàn trực: Mọi thành viên nhập bằng tài khoản riêng.
 * - Ràng buộc: Mỗi thời điểm chỉ có tối đa 1 ca đang mở (is_closed = FALSE).
 * - Bất biến đối soát: expected = opening + cash_in - cash_out.
 * - Ca đã đóng cấm nhận thêm tiền; chênh lệch thực tế bắt buộc giải trình, không sửa số liệu cũ.
 */

import {
  type CashSession,
  type CashSessionSummary,
  type Queryable,
  FUND_IDS,
  ACCOUNT_CODES,
  assertSafeVndAmount,
} from './types.ts';
import { recordAuditLog } from '../shared/audit.ts';

export class CashSessionError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus = 400) {
    super(message);
    this.name = 'CashSessionError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class SessionNotFoundError extends CashSessionError {
  constructor(message = 'Không tìm thấy phiên quầy tiền mặt.') {
    super(message, 'SESSION_NOT_FOUND', 404);
    this.name = 'SessionNotFoundError';
  }
}

export class ActiveSessionExistsError extends CashSessionError {
  constructor(message = 'Đang có phiên quầy tiền mặt đang mở. Bắt buộc đóng ca cũ trước khi mở ca mới.') {
    super(message, 'ACTIVE_SESSION_EXISTS', 409);
    this.name = 'ActiveSessionExistsError';
  }
}

export class SessionAlreadyClosedError extends CashSessionError {
  constructor(message = 'Phiên quầy tiền mặt đã đóng, không thể thao tác.') {
    super(message, 'SESSION_ALREADY_CLOSED', 409);
    this.name = 'SessionAlreadyClosedError';
  }
}

export class DiscrepancyReasonRequiredError extends CashSessionError {
  constructor(message = 'Số tiền thực tế khác với dự kiến/bàn giao. Bắt buộc phải có lý do giải trình.') {
    super(message, 'DISCREPANCY_REASON_REQUIRED', 400);
    this.name = 'DiscrepancyReasonRequiredError';
  }
}

export interface OpenCashSessionParams {
  sessionId: string;
  sessionDate: string;
  openedBy: string;
  openingCash: bigint | number | string;
  handedOverFromSessionId?: string | null;
  discrepancyReason?: string | null;
}

export interface CloseCashSessionParams {
  sessionId: string;
  closedBy: string;
  actualClosingCash: bigint | number | string;
  discrepancyReason?: string | null;
}

function mapSessionRow(row: any): CashSession {
  return {
    id: row.id,
    session_date: typeof row.session_date === 'string' ? row.session_date : row.session_date.toISOString().split('T')[0],
    opened_by: row.opened_by,
    opened_at: row.opened_at,
    opening_cash: BigInt(row.opening_cash),
    expected_closing_cash: BigInt(row.expected_closing_cash),
    actual_closing_cash: row.actual_closing_cash !== null && row.actual_closing_cash !== undefined ? BigInt(row.actual_closing_cash) : null,
    discrepancy: row.discrepancy !== null && row.discrepancy !== undefined ? BigInt(row.discrepancy) : null,
    discrepancy_reason: row.discrepancy_reason,
    is_closed: Boolean(row.is_closed),
    closed_at: row.closed_at,
    closed_by: row.closed_by,
    handed_over_from_session_id: row.handed_over_from_session_id,
  };
}

export function serializeCashSession(session: CashSession) {
  const openingCash = Number(session.opening_cash);
  const expectedClosingCash = Number(session.expected_closing_cash);
  const actualClosingCash = session.actual_closing_cash !== null ? Number(session.actual_closing_cash) : null;
  const discrepancy = session.discrepancy !== null ? Number(session.discrepancy) : null;

  return {
    ...session,
    id: session.id,
    sessionDate: session.session_date,
    session_date: session.session_date,
    openedBy: session.opened_by,
    opened_by: session.opened_by,
    openedAt: session.opened_at,
    opened_at: session.opened_at,
    openingCash,
    opening_cash: openingCash,
    expectedClosingCash,
    expected_closing_cash: expectedClosingCash,
    actualClosingCash,
    actual_closing_cash: actualClosingCash,
    discrepancy,
    discrepancyReason: session.discrepancy_reason,
    discrepancy_reason: session.discrepancy_reason,
    isClosed: session.is_closed,
    is_closed: session.is_closed,
    closedAt: session.closed_at,
    closed_at: session.closed_at,
    closedBy: session.closed_by,
    closed_by: session.closed_by,
    handedOverFromSessionId: session.handed_over_from_session_id,
    handed_over_from_session_id: session.handed_over_from_session_id,
  };
}

export function serializeCashSessionSummary(summary: CashSessionSummary) {
  return {
    session: serializeCashSession(summary.session),
    openingCash: Number(summary.session.opening_cash),
    cashIn: Number(summary.cashIn),
    cashOut: Number(summary.cashOut),
    expectedCash: Number(summary.expectedCash),
    actualCash: summary.actualCash !== null ? Number(summary.actualCash) : null,
    discrepancy: summary.discrepancy !== null ? Number(summary.discrepancy) : null,
    discrepancyReason: summary.discrepancyReason,
    bankIn: Number(summary.bankIn),
    bankOut: Number(summary.bankOut),
    depositLiabilitiesCreated: Number(summary.depositLiabilitiesCreated),
    depositLiabilitiesRefunded: Number(summary.depositLiabilitiesRefunded),
    depositLiabilitiesDelta: Number(summary.depositLiabilitiesDelta),
    depositLiabilitiesRemaining: Number(summary.depositLiabilitiesRemaining),
  };
}

/**
 * Khóa và kiểm tra trạng thái phiên quầy tiền mặt trước mọi chuyển động tiền (S05-01)
 * - Khóa hàng session bằng FOR UPDATE.
 * - Kiểm tra session tồn tại và đang mở (is_closed = FALSE).
 * - Kiểm tra phiên quầy chỉ dành cho FUND_LOAN.
 */
export async function assertAndLockActiveCashSession(
  db: Queryable,
  sessionId: string,
  fundId?: string
): Promise<CashSession> {
  if (fundId && fundId !== FUND_IDS.LOAN) {
    throw new CashSessionError(
      'Phiên quầy tiền mặt bàn trực chỉ dành riêng cho Quỹ Mượn–Trả (FUND_LOAN).',
      'INVALID_FUND_CASH_SESSION',
      400
    );
  }

  const res = await db.query<any>(
    `SELECT id, session_date, opened_by, opened_at, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, discrepancy_reason, is_closed, closed_at, closed_by, handed_over_from_session_id
     FROM cash_sessions
     WHERE id = $1
     FOR UPDATE`,
    [sessionId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new SessionNotFoundError(`Không tìm thấy phiên quầy ID '${sessionId}'.`);
  }

  const session = mapSessionRow(row);
  if (session.is_closed) {
    throw new SessionAlreadyClosedError(`Phiên quầy '${sessionId}' đã đóng, không thể tiếp nhận thêm giao dịch.`);
  }

  return session;
}

/**
 * 1. Mở phiên quầy tiền mặt mới
 * - Kiểm tra không có ca nào đang mở (khóa dòng kiểm tra nguyên tử).
 * - Nếu có ca trước bàn giao: So khớp openingCash với actual_closing_cash của ca trước.
 * - Lần đầu mở ca xác lập opening float KHÔNG ghi nhận thành doanh thu hay thu cọc.
 */
export async function openCashSession(
  db: Queryable,
  params: OpenCashSessionParams
): Promise<CashSession> {
  const {
    sessionId,
    sessionDate,
    openedBy,
    openingCash,
    handedOverFromSessionId = null,
    discrepancyReason = null,
  } = params;

  if (!sessionId || !sessionDate || !openedBy) {
    throw new CashSessionError('Thiếu thông số bắt buộc để mở ca quầy tiền mặt.', 'MISSING_SESSION_PARAMS');
  }

  const safeOpening = assertSafeVndAmount(openingCash, { allowZero: true });

  // 1. Kiểm tra xem có ca nào đang mở không (FOR UPDATE)
  const activeCheck = await db.query<any>(
    `SELECT id, session_date FROM cash_sessions WHERE is_closed = FALSE FOR UPDATE`
  );

  if (activeCheck.rows && activeCheck.rows.length > 0) {
    const act = activeCheck.rows[0];
    throw new ActiveSessionExistsError(
      `Phiên quầy '${act.id}' (ngày ${act.session_date}) vẫn đang mở. Bắt buộc đóng ca cũ trước khi mở ca mới.`
    );
  }

  // S05-05: Kiểm tra xem ID ca này đã từng tồn tại chưa (ngăn reopen cùng session sau khi close)
  const idCheck = await db.query<any>(
    `SELECT id, is_closed FROM cash_sessions WHERE id = $1`,
    [sessionId]
  );
  if (idCheck.rows && idCheck.rows.length > 0) {
    throw new CashSessionError(
      `Phiên quầy với ID '${sessionId}' đã tồn tại trong hệ thống. Không thể mở lại cùng một ID phiên đã đóng.`,
      'SESSION_ID_EXISTS',
      409
    );
  }

  // S06-08: Kiểm tra xem đã có ca nào mở hoặc đóng trong cùng ngày/buổi chưa (Mỗi buổi chỉ 1 phiên)
  const dateCheck = await db.query<any>(
    `SELECT id, is_closed FROM cash_sessions WHERE session_date = $1`,
    [sessionDate]
  );
  if (dateCheck.rows && dateCheck.rows.length > 0) {
    throw new CashSessionError(
      `Đã có phiên quầy '${dateCheck.rows[0].id}' được ghi nhận cho buổi ngày ${sessionDate}. Mỗi buổi chỉ có duy nhất một phiên quầy.`,
      'SESSION_DATE_ALREADY_EXISTS',
      409
    );
  }

  // S05-05: Tự động tìm ca đóng gần nhất để đối soát bàn giao tiền mặt
  let effectiveHandoverFrom = handedOverFromSessionId;
  const lastClosedRes = await db.query<any>(
    `SELECT id, actual_closing_cash, is_closed FROM cash_sessions WHERE is_closed = TRUE ORDER BY closed_at DESC, id DESC LIMIT 1`
  );

  if (lastClosedRes.rows && lastClosedRes.rows.length > 0) {
    const lastClosed = lastClosedRes.rows[0];
    const prevActual = BigInt(lastClosed.actual_closing_cash ?? 0);

    // S06-08: Nếu client cung cấp handedOverFromSessionId khác với ca đóng gần nhất chuẩn, từ chối
    if (handedOverFromSessionId && handedOverFromSessionId !== lastClosed.id) {
      throw new CashSessionError(
        `Phiên bàn giao '${handedOverFromSessionId}' không khớp với phiên đóng gần nhất '${lastClosed.id}'.`,
        'INVALID_HANDOVER_PREDECESSOR',
        400
      );
    }

    // Nếu client không chỉ định handedOverFromSessionId, tự động gán từ phiên đóng gần nhất
    if (!effectiveHandoverFrom) {
      effectiveHandoverFrom = lastClosed.id;
    }

    if (safeOpening !== prevActual && (!discrepancyReason || discrepancyReason.trim() === '')) {
      throw new DiscrepancyReasonRequiredError(
        `Số tiền thực nhận đầu ca (${safeOpening.toString()} ₫) khác số tiền cuối ca trước bàn giao (${prevActual.toString()} ₫). Bắt buộc phải có lý do giải trình.`
      );
    }
  } else if (handedOverFromSessionId) {
    // Nếu client chỉ định mà không có ca đóng nào
    throw new CashSessionError(`Không tìm thấy phiên quầy bàn giao ID '${handedOverFromSessionId}'.`, 'PREVIOUS_SESSION_NOT_FOUND', 404);
  }

  // 3. Chèn bản ghi phiên quầy mới
  const insertRes = await db.query<any>(
    `INSERT INTO cash_sessions (
      id, session_date, opened_by, opening_cash, expected_closing_cash, is_closed, handed_over_from_session_id, discrepancy_reason
    ) VALUES ($1, $2, $3, $4, $4, FALSE, $5, $6)
    RETURNING id, session_date, opened_by, opened_at, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, discrepancy_reason, is_closed, closed_at, closed_by, handed_over_from_session_id`,
    [
      sessionId,
      sessionDate,
      openedBy,
      safeOpening.toString(),
      effectiveHandoverFrom,
      discrepancyReason,
    ]
  );

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId: openedBy,
    action: 'OPEN_CASH_SESSION',
    targetResource: 'CASH_SESSION',
    targetId: sessionId,
    details: {
      sessionDate,
      openingCash: Number(safeOpening),
      handedOverFromSessionId: effectiveHandoverFrom,
      discrepancyReason,
    },
  });

  return mapSessionRow(insertRes.rows[0]);
}

/**
 * 2. Lấy thông tin phiên quầy đang mở (Active Session)
 */
export async function getCurrentCashSession(db: Queryable): Promise<CashSession | null> {
  const res = await db.query<any>(
    `SELECT id, session_date, opened_by, opened_at, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, discrepancy_reason, is_closed, closed_at, closed_by, handed_over_from_session_id
     FROM cash_sessions
     WHERE is_closed = FALSE
     LIMIT 1`
  );

  if (!res.rows || res.rows.length === 0) {
    return null;
  }

  return mapSessionRow(res.rows[0]);
}

/**
 * 3. Lấy báo cáo tổng kết và đối soát dòng tiền của phiên quầy
 * - Tiền mặt thực tế thu/chi trong ca từ các journal entries liên kết với cash_session_id và fund_id = 'FUND_LOAN'.
 * - Luồng tiền ngân hàng và nghĩa vụ cọc được báo cáo riêng biệt.
 * - S05-01 & S05-06: Lọc chặt chẽ theo FUND_LOAN, tách delta của ca và tổng nghĩa vụ cọc toàn quỹ.
 */
export async function getCashSessionSummary(
  db: Queryable,
  sessionId: string
): Promise<CashSessionSummary> {
  // 1. Đọc phiên quầy
  const sessionRes = await db.query<any>(
    `SELECT id, session_date, opened_by, opened_at, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, discrepancy_reason, is_closed, closed_at, closed_by, handed_over_from_session_id
     FROM cash_sessions
     WHERE id = $1`,
    [sessionId]
  );

  const sessionRow = sessionRes.rows[0];
  if (!sessionRow) {
    throw new SessionNotFoundError(`Không tìm thấy phiên quầy ID '${sessionId}'.`);
  }

  const session = mapSessionRow(sessionRow);

  // 2. Tổng tiền mặt thu vào (Cash In): Debit TIEN_MAT_HOP trong ca thuộc FUND_LOAN
  const cashInRes = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM journal_entries
     WHERE cash_session_id = $1 AND fund_id = $2 AND debit_account = $3`,
    [sessionId, FUND_IDS.LOAN, ACCOUNT_CODES.CASH_DRAWER]
  );
  const cashIn = BigInt(cashInRes.rows[0]?.total || 0);

  // 3. Tổng tiền mặt chi ra (Cash Out): Credit TIEN_MAT_HOP trong ca thuộc FUND_LOAN
  const cashOutRes = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM journal_entries
     WHERE cash_session_id = $1 AND fund_id = $2 AND credit_account = $3`,
    [sessionId, FUND_IDS.LOAN, ACCOUNT_CODES.CASH_DRAWER]
  );
  const cashOut = BigInt(cashOutRes.rows[0]?.total || 0);

  // 4. Tiền mặt dự kiến = Opening + Cash In - Cash Out
  const expectedCash = session.opening_cash + cashIn - cashOut;

  // 5. Thống kê tiền ngân hàng phát sinh trong ca (báo cáo riêng, không cộng vào hộp tiền mặt)
  const bankInRes = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM journal_entries
     WHERE cash_session_id = $1 AND fund_id = $2 AND debit_account = $3`,
    [sessionId, FUND_IDS.LOAN, ACCOUNT_CODES.BANK_MAIN]
  );
  const bankIn = BigInt(bankInRes.rows[0]?.total || 0);

  const bankOutRes = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM journal_entries
     WHERE cash_session_id = $1 AND fund_id = $2 AND credit_account = $3`,
    [sessionId, FUND_IDS.LOAN, ACCOUNT_CODES.BANK_MAIN]
  );
  const bankOut = BigInt(bankOutRes.rows[0]?.total || 0);

  // 6. Nghĩa vụ cọc phát sinh và hoàn trong ca thuộc FUND_LOAN
  const depCreatedRes = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM journal_entries
     WHERE cash_session_id = $1 AND fund_id = $2 AND credit_account = $3`,
    [sessionId, FUND_IDS.LOAN, ACCOUNT_CODES.DEPOSIT_LIABILITY]
  );
  const depositLiabilitiesCreated = BigInt(depCreatedRes.rows[0]?.total || 0);

  const depRefundedRes = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM journal_entries
     WHERE cash_session_id = $1 AND fund_id = $2 AND debit_account = $3`,
    [sessionId, FUND_IDS.LOAN, ACCOUNT_CODES.DEPOSIT_LIABILITY]
  );
  const depositLiabilitiesRefunded = BigInt(depRefundedRes.rows[0]?.total || 0);

  // S05-06: Tách bạch giữa delta của ca và tổng nghĩa vụ cọc toàn Quỹ Mượn-Trả
  const depRemainingRes = await db.query<any>(
    `SELECT COALESCE(SUM(remaining_amount), 0) AS total_remaining
     FROM deposit_allocations
     WHERE fund_id = $1 AND status IN ('HELD', 'PENDING_REFUND')`,
    [FUND_IDS.LOAN]
  );
  const totalDepositLiability = BigInt(depRemainingRes.rows[0]?.total_remaining || 0);

  return {
    session,
    cashIn,
    cashOut,
    expectedCash,
    actualCash: session.actual_closing_cash,
    discrepancy: session.discrepancy,
    discrepancyReason: session.discrepancy_reason,
    bankIn,
    bankOut,
    depositLiabilitiesCreated,
    depositLiabilitiesRefunded,
    depositLiabilitiesDelta: depositLiabilitiesCreated - depositLiabilitiesRefunded,
    depositLiabilitiesRemaining: totalDepositLiability,
  };
}

/**
 * 4. Đóng phiên quầy tiền mặt cuối buổi (Close Cash Session)
 * - Khóa dòng session FOR UPDATE tuần tự hóa mọi giao dịch.
 * - Chốt snapshot expectedClosingCash = opening + cash_in - cash_out.
 * - Lưu actualClosingCash thực tế đếm được.
 * - Nếu chênh lệch != 0: Bắt buộc giải trình discrepancy_reason.
 * - Cập nhật is_closed = TRUE. Phiên đã đóng tuyệt đối không nhận thêm giao dịch.
 */
export async function closeCashSession(
  db: Queryable,
  params: CloseCashSessionParams
): Promise<CashSessionSummary> {
  const { sessionId, closedBy, actualClosingCash, discrepancyReason = null } = params;

  if (!sessionId || !closedBy) {
    throw new CashSessionError('Thiếu thông số bắt buộc để đóng ca quầy.', 'MISSING_CLOSE_PARAMS');
  }

  // 1. Khóa dòng session FOR UPDATE để ngăn ngừa race condition
  const sessionSel = await db.query<any>(
    `SELECT id, session_date, opened_by, opened_at, opening_cash, expected_closing_cash, actual_closing_cash, discrepancy, discrepancy_reason, is_closed, closed_at, closed_by, handed_over_from_session_id
     FROM cash_sessions
     WHERE id = $1
     FOR UPDATE`,
    [sessionId]
  );

  const sessionRow = sessionSel.rows[0];
  if (!sessionRow) {
    throw new CashSessionError(`Không tìm thấy phiên quầy ID '${sessionId}'.`, 'SESSION_NOT_FOUND', 404);
  }

  if (Boolean(sessionRow.is_closed)) {
    throw new SessionAlreadyClosedError(`Phiên quầy '${sessionId}' đã được đóng trước đó.`);
  }

  const safeActual = assertSafeVndAmount(actualClosingCash, { allowZero: true });

  // 2. Tính toán tổng tiền mặt thực thu/chi đã commit trong ca
  const summary = await getCashSessionSummary(db, sessionId);
  const expectedClosing = summary.expectedCash;
  const discrepancy = safeActual - expectedClosing;

  // 3. Bắt buộc có lý do giải trình nếu có chênh lệch
  if (discrepancy !== 0n && (!discrepancyReason || discrepancyReason.trim() === '')) {
    throw new DiscrepancyReasonRequiredError(
      `Tiền mặt thực tế đếm cuối ca (${safeActual.toString()} ₫) lệch so với dự kiến sổ sách (${expectedClosing.toString()} ₫). Bắt buộc phải nhập lý do giải trình chênh lệch.`
    );
  }

  // 4. Cập nhật đóng ca
  await db.query<any>(
    `UPDATE cash_sessions
     SET expected_closing_cash = $2,
         actual_closing_cash = $3,
         discrepancy = $4,
         discrepancy_reason = $5,
         is_closed = TRUE,
         closed_at = NOW(),
         closed_by = $6
     WHERE id = $1`,
    [
      sessionId,
      expectedClosing.toString(),
      safeActual.toString(),
      discrepancy.toString(),
      discrepancyReason,
      closedBy,
    ]
  );

  const finalSummary = await getCashSessionSummary(db, sessionId);

  // S06-03: Ghi system_audit_logs ngay tại mutation
  await recordAuditLog(db, {
    actorId: closedBy,
    action: 'CLOSE_CASH_SESSION',
    targetResource: 'CASH_SESSION',
    targetId: sessionId,
    details: {
      actualClosingCash: Number(safeActual),
      expectedClosingCash: Number(expectedClosing),
      discrepancy: Number(discrepancy),
      discrepancyReason,
    },
  });

  return finalSummary;
}
