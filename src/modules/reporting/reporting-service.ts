/**
 * Reporting Service - YSBK (FR-05, R04, R06, R13)
 * Xử lý báo cáo tài chính sổ kép, phân tích lưu thông sách, xuất file CSV chống formula injection
 * và quản lý vé tải tệp (download tickets) với cơ chế kiểm tra thu hồi quyền tức thời.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Queryable } from '../../server/finance/types.ts';
import type { AuthenticatedActor } from '../../server/types.ts';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '../../server/errors.ts';
import { requireInternalMember } from '../../server/auth/policy.ts';
import { ACCOUNT_CODES } from '../../server/finance/types.ts';
import type {
  ReportPeriod,
  ReportFilter,
  BalanceSheetSnapshot,
  PeriodMovements,
  FinancialSummaryReport,
  FinancialDrilldownItem,
  FinancialDrilldownResult,
  CirculationSummaryReport,
  ExportDownloadTicket,
  ExportFormat,
} from './reporting-types.ts';
import {
  buildCsvDocument,
  buildExcelXmlDocument,
  buildPrintableHtmlDocument,
} from './formula-sanitizer.ts';

/**
 * Kho lưu trữ bộ nhớ an toàn cho vé tải file xuất báo cáo (Bounded Atomic Download Ticket Store)
 * Hạn dùng tối đa 5 phút. Tiêu hủy một lần duy nhất (Single-use atomic consume).
 * Tự động dọn dẹp các vé đã quá hạn để tránh tràn bộ nhớ (Bounded Memory Guard).
 */
export class BoundedAtomicTicketStore {
  private consumed = new Map<string, number>(); // ticketId -> expiresAt
  private tickets = new Map<string, ExportDownloadTicket>(); // ticketKey -> ticketObj
  private readonly maxEntries: number;
  private readonly storageDir?: string;

  constructor(maxEntries = 5000, storageDir?: string) {
    this.maxEntries = maxEntries;
    this.storageDir = storageDir;
    if (this.storageDir) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true });
      } catch {}
    }
  }

  private getDurableFilePath(ticketId: string): string | null {
    if (!this.storageDir) return null;
    const safeHash = crypto.createHash('sha256').update(ticketId).digest('hex');
    return path.join(this.storageDir, `${safeHash}.ticket`);
  }

  setTicket(key: string, ticket: ExportDownloadTicket): void {
    if (this.tickets.size >= this.maxEntries) {
      this.cleanup(Date.now());
    }
    this.tickets.set(key, ticket);
  }

  getTicket(key: string): ExportDownloadTicket | undefined {
    return this.tickets.get(key);
  }

  deleteTicket(key: string): void {
    this.tickets.delete(key);
  }

  /**
   * Tiêu thụ vé một lần duy nhất theo cách nguyên tử (Atomic Consume).
   * Trả về true nếu tiêu thụ thành công, false nếu vé đã bị tiêu thụ trước đó.
   * Khi cấu hình storageDir, sử dụng atomic open('wx') trên filesystem bền vững
   * để chống race condition xuyên nhiều Worker instances và sau khi khởi động lại (restart).
   */
  atomicConsume(ticketId: string, expiresAt: number): boolean {
    const now = Date.now();
    if (this.consumed.size >= this.maxEntries) {
      this.cleanup(now);
    }

    // 1. Kiểm tra in-memory cache trước
    if (this.consumed.has(ticketId)) {
      return false; // Vé đã được dùng trước đó trong memory
    }

    // 2. Nếu có storageDir bền vững, kiểm tra và tạo atomic marker
    const durablePath = this.getDurableFilePath(ticketId);
    if (durablePath) {
      try {
        // Cờ 'wx' tương đương O_CREAT | O_EXCL -> atomic cấp OS chống đa tiến trình / đa instance
        const fd = fs.openSync(durablePath, 'wx');
        const meta = JSON.stringify({ ticketId, expiresAt, consumedAt: now });
        fs.writeSync(fd, meta);
        fs.closeSync(fd);
      } catch (err: any) {
        if (err && (err.code === 'EEXIST' || err.code === 'EACCES')) {
          this.consumed.set(ticketId, expiresAt);
          return false; // Đã bị instance khác tiêu thụ trước
        }
      }
    }

    this.consumed.set(ticketId, expiresAt);
    return true; // Tiêu thụ thành công lần đầu tiên
  }

  /**
   * Tiêu thụ vé nguyên tử bền vững qua Cơ sở dữ liệu (PRF-10)
   * Sử dụng INSERT ... ON CONFLICT DO NOTHING trên PostgreSQL để đảm bảo
   * tính duy nhất tuyệt đối trên môi trường serverless không có disk / đa edge isolates.
   */
  async atomicConsumeAsync(ticketId: string, expiresAt: number, db?: Queryable): Promise<boolean> {
    const now = Date.now();
    if (this.consumed.size >= this.maxEntries) {
      this.cleanup(now);
    }

    if (this.consumed.has(ticketId)) {
      return false;
    }

    if (db && typeof db.query === 'function') {
      {
        const res = await db.query<any>(
          `INSERT INTO consumed_export_tickets (ticket_id, expires_at)
           VALUES ($1, $2)
           ON CONFLICT (ticket_id) DO NOTHING
           RETURNING ticket_id`,
          [ticketId, new Date(expiresAt).toISOString()]
        );
        if (!res.rows || res.rows.length === 0) {
          this.consumed.set(ticketId, expiresAt);
          return false; // Đã tồn tại trong DB, bị tiêu thụ trước
        }
        this.consumed.set(ticketId, expiresAt);
        return true;
      }
    }

    return this.atomicConsume(ticketId, expiresAt);
  }

  isConsumed(ticketId: string): boolean {
    if (this.consumed.has(ticketId)) return true;
    const durablePath = this.getDurableFilePath(ticketId);
    if (durablePath && fs.existsSync(durablePath)) return true;
    return false;
  }

  cleanup(now: number): void {
    for (const [id, exp] of this.consumed.entries()) {
      if (now > exp) {
        this.consumed.delete(id);
      }
    }
    for (const [k, t] of this.tickets.entries()) {
      if (now > t.expiresAt) {
        this.tickets.delete(k);
      }
    }
    if (this.storageDir && fs.existsSync(this.storageDir)) {
      try {
        const files = fs.readdirSync(this.storageDir);
        for (const file of files) {
          if (file.endsWith('.ticket')) {
            const p = path.join(this.storageDir, file);
            try {
              const stat = fs.statSync(p);
              // Xóa nếu file đã tạo quá 10 phút hoặc nội dung hết hạn
              if (now - stat.mtimeMs > 10 * 60 * 1000) {
                fs.unlinkSync(p);
              }
            } catch {}
          }
        }
      } catch {}
    }
  }

  clear(): void {
    this.consumed.clear();
    this.tickets.clear();
    if (this.storageDir && fs.existsSync(this.storageDir)) {
      try {
        const files = fs.readdirSync(this.storageDir);
        for (const file of files) {
          if (file.endsWith('.ticket')) {
            try {
              fs.unlinkSync(path.join(this.storageDir, file));
            } catch {}
          }
        }
      } catch {}
    }
  }
}

export const defaultTicketStore = new BoundedAtomicTicketStore(
  5000,
  typeof process !== 'undefined' ? process.env.EXPORT_TICKET_STORAGE_DIR : undefined
);

/**
 * Chuẩn hóa khoảng thời gian (startDate, endDate) dựa trên period hoặc tham số tùy chọn
 */
export function resolveDateRange(filter?: ReportFilter): { startDate: string; endDate: string; period: ReportPeriod } {
  const period: ReportPeriod = filter?.period || (filter?.startDate ? 'CUSTOM' : 'MONTH');

  if (filter?.startDate && filter?.endDate) {
    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      period: 'CUSTOM',
    };
  }

  // Lấy ngày hiện tại theo múi giờ Việt Nam (UTC+7)
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const endStr = vnNow.toISOString().split('T')[0];
  let startDateObj = new Date(vnNow);

  switch (period) {
    case 'WEEK':
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 7);
      break;
    case 'MONTH':
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 30);
      break;
    case 'QUARTER':
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 90);
      break;
    case 'YEAR':
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 365);
      break;
    case 'ALL':
      return {
        startDate: '2020-01-01',
        endDate: endStr,
        period: 'ALL',
      };
    case 'CUSTOM':
    default:
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 30);
      break;
  }

  const startStr = startDateObj.toISOString().split('T')[0];
  return {
    startDate: filter?.startDate || startStr,
    endDate: filter?.endDate || endStr,
    period,
  };
}

export function getVietnamTimeBoundaries(startDate: string, endDate: string): {
  startCutoff: string;
  endCutoffExclusive: string;
} {
  const startCutoff = `${startDate}T00:00:00+07:00`;
  const parts = endDate.split('-').map(Number);
  const nextDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  const nextY = nextDay.getUTCFullYear();
  const nextM = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(nextDay.getUTCDate()).padStart(2, '0');
  const endCutoffExclusive = `${nextY}-${nextM}-${nextD}T00:00:00+07:00`;
  return { startCutoff, endCutoffExclusive };
}

function accumulateEntries(rows: any[]) {
  let cashDrawer = 0n;
  let bankMain = 0n;
  let depositLiability = 0n;
  let bookstoreReceivable = 0n;
  let bookstorePayable = 0n;
  let fineRevenue = 0n;
  let membershipFeeRevenue = 0n;
  let bookSalesRevenue = 0n;
  let activityExpense = 0n;

  for (const r of rows) {
    const amt = BigInt(r.amount);
    const debit = r.debit_account;
    const credit = r.credit_account;

    // TIEN_MAT_HOP: Debit tăng, Credit giảm
    if (debit === ACCOUNT_CODES.CASH_DRAWER) cashDrawer += amt;
    if (credit === ACCOUNT_CODES.CASH_DRAWER) cashDrawer -= amt;

    // TIEN_NGAN_HANG: Debit tăng, Credit giảm
    if (debit === ACCOUNT_CODES.BANK_MAIN) bankMain += amt;
    if (credit === ACCOUNT_CODES.BANK_MAIN) bankMain -= amt;

    // COC_PHAI_HOAN: Nghĩa vụ nợ -> Credit tăng, Debit giảm
    if (credit === ACCOUNT_CODES.DEPOSIT_LIABILITY) depositLiability += amt;
    if (debit === ACCOUNT_CODES.DEPOSIT_LIABILITY) depositLiability -= amt;

    // COC_DAT_NHA_SACH: Tài sản phải thu -> Debit tăng, Credit giảm
    if (debit === ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE) bookstoreReceivable += amt;
    if (credit === ACCOUNT_CODES.BOOKSTORE_DEPOSIT_RECEIVABLE) bookstoreReceivable -= amt;

    // NO_PHAI_TRA_NHA_SACH: Nghĩa vụ nợ -> Credit tăng, Debit giảm
    if (credit === ACCOUNT_CODES.BOOKSTORE_PAYABLE) bookstorePayable += amt;
    if (debit === ACCOUNT_CODES.BOOKSTORE_PAYABLE) bookstorePayable -= amt;

    // THU_PHAT: Doanh thu -> Credit tăng, Debit giảm
    if (credit === ACCOUNT_CODES.FINE_REVENUE) fineRevenue += amt;
    if (debit === ACCOUNT_CODES.FINE_REVENUE) fineRevenue -= amt;

    // HOI_PHI: Doanh thu -> Credit tăng, Debit giảm
    if (credit === ACCOUNT_CODES.MEMBER_FEE) membershipFeeRevenue += amt;
    if (debit === ACCOUNT_CODES.MEMBER_FEE) membershipFeeRevenue -= amt;

    // DOANH_THU_BAN_SACH: Doanh thu -> Credit tăng, Debit giảm
    if (credit === ACCOUNT_CODES.BOOK_SALES_REVENUE) bookSalesRevenue += amt;
    if (debit === ACCOUNT_CODES.BOOK_SALES_REVENUE) bookSalesRevenue -= amt;

    // CHI_HOAT_DONG_SU_KIEN: Chi phí -> Debit tăng, Credit giảm
    if (debit === ACCOUNT_CODES.ACTIVITY_EXPENSE) activityExpense += amt;
    if (credit === ACCOUNT_CODES.ACTIVITY_EXPENSE) activityExpense -= amt;
  }

  return {
    cashDrawer,
    bankMain,
    depositLiability,
    bookstoreReceivable,
    bookstorePayable,
    fineRevenue,
    membershipFeeRevenue,
    bookSalesRevenue,
    activityExpense,
  };
}

/**
 * 1. Báo cáo Tổng Hợp Tài Chính (Financial Summary Report)
 * P22-10: Tách opening balance (trước startCutoff), movements trong kỳ (nửa mở [startCutoff, endCutoffExclusive)),
 * và closing balance (= opening + movements).
 */
export async function getFinancialSummaryReport(
  db: Queryable,
  actor: AuthenticatedActor,
  filter?: ReportFilter
): Promise<FinancialSummaryReport> {
  const member = requireInternalMember(actor);
  const { startDate, endDate, period } = resolveDateRange(filter);
  const { startCutoff, endCutoffExclusive } = getVietnamTimeBoundaries(startDate, endDate);

  // 1. Số dư đầu kỳ (Opening Balances): tất cả bút toán trước startCutoff
  let openSql = `
    SELECT
      fund_id,
      debit_account,
      credit_account,
      amount,
      created_at
    FROM journal_entries
    WHERE created_at < $1::timestamptz
  `;
  const openParams: any[] = [startCutoff];
  if (filter?.fundId) {
    openSql += ` AND fund_id = $2`;
    openParams.push(filter.fundId);
  }
  const openRes = await db.query(openSql, openParams);
  const openRows = openRes.rows || [];

  // 2. Biến động trong kỳ (Movements): khoảng nửa mở [startCutoff, endCutoffExclusive)
  let moveSql = `
    SELECT
      fund_id,
      debit_account,
      credit_account,
      amount,
      created_at
    FROM journal_entries
    WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
  `;
  const moveParams: any[] = [startCutoff, endCutoffExclusive];
  if (filter?.fundId) {
    moveSql += ` AND fund_id = $3`;
    moveParams.push(filter.fundId);
  }
  const moveRes = await db.query(moveSql, moveParams);
  const moveRows = moveRes.rows || [];

  const openAcc = accumulateEntries(openRows);
  const moveAcc = accumulateEntries(moveRows);

  const openingBalances: BalanceSheetSnapshot = {
    cashDrawerBalance: Number(openAcc.cashDrawer),
    bankMainBalance: Number(openAcc.bankMain),
    depositLiability: Number(openAcc.depositLiability),
    bookstoreReceivable: Number(openAcc.bookstoreReceivable),
    bookstorePayable: Number(openAcc.bookstorePayable),
  };

  const fineRev = Number(moveAcc.fineRevenue);
  const feeRev = Number(moveAcc.membershipFeeRevenue);
  const saleRev = Number(moveAcc.bookSalesRevenue);
  const actExp = Number(moveAcc.activityExpense);
  const totalRev = fineRev + feeRev + saleRev;
  const netInc = totalRev - actExp;

  const movements: PeriodMovements = {
    cashDrawerChange: Number(moveAcc.cashDrawer),
    bankMainChange: Number(moveAcc.bankMain),
    depositLiabilityChange: Number(moveAcc.depositLiability),
    bookstoreReceivableChange: Number(moveAcc.bookstoreReceivable),
    bookstorePayableChange: Number(moveAcc.bookstorePayable),

    fineRevenue: fineRev,
    membershipFeeRevenue: feeRev,
    bookSalesRevenue: saleRev,
    activityExpense: actExp,

    totalRevenue: totalRev,
    netIncome: netInc,
  };

  const closingBalances: BalanceSheetSnapshot = {
    cashDrawerBalance: openingBalances.cashDrawerBalance + movements.cashDrawerChange,
    bankMainBalance: openingBalances.bankMainBalance + movements.bankMainChange,
    depositLiability: openingBalances.depositLiability + movements.depositLiabilityChange,
    bookstoreReceivable: openingBalances.bookstoreReceivable + movements.bookstoreReceivableChange,
    bookstorePayable: openingBalances.bookstorePayable + movements.bookstorePayableChange,
  };

  return {
    filter: {
      period,
      startDate,
      endDate,
      fundId: filter?.fundId,
    },
    cashDrawerBalance: closingBalances.cashDrawerBalance,
    bankMainBalance: closingBalances.bankMainBalance,
    depositLiability: closingBalances.depositLiability,
    bookstoreReceivable: closingBalances.bookstoreReceivable,
    bookstorePayable: closingBalances.bookstorePayable,

    fineRevenue: movements.fineRevenue,
    membershipFeeRevenue: movements.membershipFeeRevenue,
    bookSalesRevenue: movements.bookSalesRevenue,
    activityExpense: movements.activityExpense,
    totalRevenue: movements.totalRevenue,
    netIncome: movements.netIncome,

    openingBalances,
    movements,
    closingBalances,

    totalTransactions: moveRows.length,
    generatedAt: new Date().toISOString(),
    generatedBy: member.username || member.userId,
  };
}

/**
 * 2. Drill-down Bút Toán Sổ Cái (Financial Drilldown)
 * Bounded load: giới hạn limit tối đa 500 dòng để bảo vệ hiệu năng CPU & RAM.
 */
export async function getFinancialDrilldown(
  db: Queryable,
  actor: AuthenticatedActor,
  filter?: ReportFilter,
  pagination?: { limit?: number; offset?: number }
): Promise<FinancialDrilldownResult> {
  requireInternalMember(actor);
  const { startDate, endDate } = resolveDateRange(filter);
  const { startCutoff, endCutoffExclusive } = getVietnamTimeBoundaries(startDate, endDate);

  let limit = pagination?.limit !== undefined ? Number(pagination.limit) : 50;
  if (!Number.isInteger(limit) || limit <= 0) {
    limit = 50;
  }
  if (limit > 500) {
    throw new BadRequestError('Giới hạn phân trang tối đa là 500 dòng.', 'PAGINATION_LIMIT_EXCEEDED');
  }

  let offset = pagination?.offset !== undefined ? Number(pagination.offset) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    offset = 0;
  }

  let countSql = `
    SELECT COUNT(*) as count
    FROM journal_entries
    WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
  `;
  const countParams: any[] = [startCutoff, endCutoffExclusive];
  if (filter?.fundId) {
    countSql += ` AND fund_id = $3`;
    countParams.push(filter.fundId);
  }
  const countRes = await db.query(countSql, countParams);
  const totalCount = Number(countRes.rows[0]?.count || 0);

  let querySql = `
    SELECT
      id,
      entry_code,
      fund_id,
      source_type,
      source_id,
      debit_account,
      credit_account,
      amount,
      created_by,
      created_at,
      notes
    FROM journal_entries
    WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
  `;
  const queryParams: any[] = [startCutoff, endCutoffExclusive];
  let pIdx = 3;
  if (filter?.fundId) {
    querySql += ` AND fund_id = $${pIdx++}`;
    queryParams.push(filter.fundId);
  }
  querySql += ` ORDER BY created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
  queryParams.push(limit, offset);

  const res = await db.query(querySql, queryParams);
  const items: FinancialDrilldownItem[] = (res.rows || []).map((r) => ({
    id: r.id,
    entryCode: r.entry_code,
    fundId: r.fund_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    debitAccount: r.debit_account,
    creditAccount: r.credit_account,
    amount: Number(r.amount),
    createdBy: r.created_by,
    createdAt: r.created_at,
    notes: r.notes ?? null,
  }));

  return {
    items,
    totalCount,
    limit,
    offset,
  };
}

/**
 * 3. Báo cáo Tổng Hợp Lưu Thông Sách (Circulation Summary Report)
 */
export async function getCirculationSummaryReport(
  db: Queryable,
  actor: AuthenticatedActor,
  filter?: ReportFilter
): Promise<CirculationSummaryReport> {
  const member = requireInternalMember(actor);
  const { startDate, endDate } = resolveDateRange(filter);
  const { startCutoff, endCutoffExclusive } = getVietnamTimeBoundaries(startDate, endDate);

  // Số phiếu mượn trong kỳ (đếm theo created_at của loan_receipts theo cutoff VN nửa mở)
  const issueRes = await db.query(
    `SELECT COUNT(*) as count FROM loan_receipts WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
    [startCutoff, endCutoffExclusive]
  );
  const totalIssued = Number(issueRes.rows[0]?.count || 0);

  // Số lượt trả sách trong kỳ (settlement_type FULL hoặc PARTIAL theo cutoff VN)
  const returnRes = await db.query(
    `SELECT COUNT(*) as count FROM loan_settlements WHERE settlement_type IN ('FULL', 'PARTIAL') AND settled_at >= $1::timestamptz AND settled_at < $2::timestamptz`,
    [startCutoff, endCutoffExclusive]
  );
  const totalReturned = Number(returnRes.rows[0]?.count || 0);

  // Số lượt gia hạn trong kỳ (loan_renewals theo cutoff VN)
  const renewRes = await db.query(
    `SELECT COUNT(*) as count FROM loan_renewals WHERE renewed_at >= $1::timestamptz AND renewed_at < $2::timestamptz`,
    [startCutoff, endCutoffExclusive]
  );
  const totalRenewed = Number(renewRes.rows[0]?.count || 0);

  // Số SÁCH báo mất trong kỳ (đếm số bản sách loan_items thực sự bị mất, KHÔNG đếm số receipt/settlement)
  const lostRes = await db.query(
    `SELECT COUNT(DISTINCT li.id) as count
     FROM loan_items li
     WHERE li.is_lost = TRUE
       AND (
         (li.lost_at IS NOT NULL AND li.lost_at >= $1::timestamptz AND li.lost_at < $2::timestamptz)
         OR (li.lost_at IS NULL AND EXISTS (
           SELECT 1 FROM loan_settlements ls 
           WHERE ls.receipt_id = li.receipt_id 
             AND ls.settlement_type = 'LOST' 
             AND ls.settled_at >= $1::timestamptz 
             AND ls.settled_at < $2::timestamptz
         ))
       )`,
    [startCutoff, endCutoffExclusive]
  );
  const totalLost = Number(lostRes.rows[0]?.count || 0);

  // Đang mượn hiện tại (loan_items chưa trả, chưa mất, chưa carried forward)
  const activeRes = await db.query(
    `SELECT COUNT(*) as count FROM loan_items WHERE returned_at IS NULL AND is_lost = FALSE AND carried_forward_at IS NULL`
  );
  const totalActiveLoans = Number(activeRes.rows[0]?.count || 0);

  // Quá hạn hiện tại (theo ngày hiện tại Việt Nam UTC+7, không phụ thuộc múi giờ DB server)
  const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const overdueRes = await db.query(
    `SELECT COUNT(*) as count FROM loan_items li JOIN loan_receipts lr ON lr.id = li.receipt_id WHERE li.returned_at IS NULL AND li.is_lost = FALSE AND li.carried_forward_at IS NULL AND lr.due_date < $1`,
    [vnToday]
  );
  const totalOverdueLoans = Number(overdueRes.rows[0]?.count || 0);

  return {
    filter: {
      startDate,
      endDate,
    },
    totalLoansIssued: totalIssued,
    totalLoansReturned: totalReturned,
    totalLoansRenewed: totalRenewed,
    totalBooksLost: totalLost,
    totalActiveLoans,
    totalOverdueLoans,
    generatedAt: new Date().toISOString(),
    generatedBy: member.username || member.userId,
  };
}

/**
 * 4. Render Báo Cáo Tài Chính Ra CSV (UTF-8 tiếng Việt chuẩn, chống Formula Injection)
 */
export function renderFinancialSummaryCsv(
  report: FinancialSummaryReport,
  drilldownItems?: FinancialDrilldownItem[]
): string {
  const rows: (unknown[])[] = [
    ['BÁO CÁO TỔNG HỢP TÀI CHÍNH - CLB YÊU SÁCH BÁCH KHOA (YSBK)'],
    ['Kỳ báo cáo:', report.filter.period, 'Từ ngày:', report.filter.startDate, 'Đến ngày:', report.filter.endDate],
    ['Thời điểm xuất:', report.generatedAt, 'Người xuất:', report.generatedBy],
    ['Quỹ lọc:', report.filter.fundId || 'Tất cả 2 quỹ'],
    [],
    ['I. CHỈ TIÊU TÀI SẢN VÀ NGHĨA VỤ NỢ', 'SỐ TIỀN (VND)'],
    ['Tiền mặt trong hộp quỹ (TIEN_MAT_HOP)', report.cashDrawerBalance],
    ['Tiền trong tài khoản ngân hàng (TIEN_NGAN_HANG)', report.bankMainBalance],
    ['Tiền cọc bạn đọc đang giữ phải hoàn (COC_PHAI_HOAN)', report.depositLiability],
    ['Tiền cọc đặt nhà sách phải thu (COC_DAT_NHA_SACH)', report.bookstoreReceivable],
    ['Nợ phải trả nhà sách (NO_PHAI_TRA_NHA_SACH)', report.bookstorePayable],
    [],
    ['II. DOANH THU VÀ THU NHẬP', 'SỐ TIỀN (VND)'],
    ['Doanh thu bán sách (DOANH_THU_BAN_SACH)', report.bookSalesRevenue],
    ['Tiền phạt trễ hạn/vi phạm thu được (THU_PHAT)', report.fineRevenue],
    ['Hội phí thành viên CLB (HOI_PHI)', report.membershipFeeRevenue],
    ['TỔNG DOANH THU & THU NHẬP', report.totalRevenue],
    [],
    ['III. CHI PHÍ VÀ KẾT QUẢ HOẠT ĐỘNG', 'SỐ TIỀN (VND)'],
    ['Chi phí hoạt động & sự kiện (CHI_HOAT_DONG_SU_KIEN)', report.activityExpense],
    ['KẾT QUẢ RÒNG (LÃI / LỖ HOẠT ĐỘNG)', report.netIncome],
    ['Tổng số bút toán phát sinh trong kỳ', report.totalTransactions],
  ];

  if (drilldownItems && drilldownItems.length > 0) {
    rows.push([]);
    rows.push(['IV. DANH SÁCH BÚT TOÁN SỔ KÉP PHÁT SINH TRONG KỲ (DRILL-DOWN)']);
    rows.push([
      'Mã Bút Toán',
      'Quỹ',
      'Nghiệp Vụ',
      'Mã Nguồn',
      'Tài Khoản Nợ',
      'Tài Khoản Có',
      'Số Tiền (VND)',
      'Người Tạo',
      'Thời Gian',
      'Ghi Chú',
    ]);

    for (const item of drilldownItems) {
      rows.push([
        item.entryCode,
        item.fundId,
        item.sourceType,
        item.sourceId,
        item.debitAccount,
        item.creditAccount,
        item.amount,
        item.createdBy,
        item.createdAt,
        item.notes || '',
      ]);
    }
  }

  return buildCsvDocument(rows);
}

/**
 * 5. Render Báo Cáo Lưu Thông Sách Ra CSV
 */
export function renderCirculationSummaryCsv(report: CirculationSummaryReport): string {
  const rows: (unknown[])[] = [
    ['BÁO CÁO TỔNG HỢP LƯU THÔNG SÁCH - CLB YÊU SÁCH BÁCH KHOA (YSBK)'],
    ['Từ ngày:', report.filter.startDate, 'Đến ngày:', report.filter.endDate],
    ['Thời điểm xuất:', report.generatedAt, 'Người xuất:', report.generatedBy],
    [],
    ['CHỈ SỐ LƯU THÔNG SÁCH', 'SỐ LƯỢNG'],
    ['Số lượt mượn sách phát hành trong kỳ', report.totalLoansIssued],
    ['Số lượt trả sách giải quyết trong kỳ', report.totalLoansReturned],
    ['Số lượt gia hạn sách trong kỳ', report.totalLoansRenewed],
    ['Số sách báo mất trong kỳ', report.totalBooksLost],
    ['Tổng số sách đang được mượn thời điểm hiện tại', report.totalActiveLoans],
    ['Tổng số sách đang quá hạn thời điểm hiện tại', report.totalOverdueLoans],
  ];

  return buildCsvDocument(rows);
}

/**
 * 5b. Render Báo Cáo Tài Chính Ra Excel XML (SpreadsheetML)
 */
export function renderFinancialSummaryExcel(
  report: FinancialSummaryReport,
  drilldownItems?: FinancialDrilldownItem[]
): string {
  const rows: (unknown[])[] = [
    ['BÁO CÁO TỔNG HỢP TÀI CHÍNH - CLB YÊU SÁCH BÁCH KHOA (YSBK)'],
    ['Kỳ báo cáo:', report.filter.period, 'Từ ngày:', report.filter.startDate, 'Đến ngày:', report.filter.endDate],
    ['Thời điểm xuất:', report.generatedAt, 'Người xuất:', report.generatedBy],
    ['Quỹ lọc:', report.filter.fundId || 'Tất cả 2 quỹ'],
    [],
    ['I. CHỈ TIÊU TÀI SẢN VÀ NGHĨA VỤ NỢ', 'SỐ TIỀN (VND)'],
    ['Tiền mặt trong hộp quỹ (TIEN_MAT_HOP)', report.cashDrawerBalance],
    ['Tiền trong tài khoản ngân hàng (TIEN_NGAN_HANG)', report.bankMainBalance],
    ['Tiền cọc bạn đọc đang giữ phải hoàn (COC_PHAI_HOAN)', report.depositLiability],
    ['Tiền cọc đặt nhà sách phải thu (COC_DAT_NHA_SACH)', report.bookstoreReceivable],
    ['Nợ phải trả nhà sách (NO_PHAI_TRA_NHA_SACH)', report.bookstorePayable],
    [],
    ['II. DOANH THU VÀ THU NHẬP', 'SỐ TIỀN (VND)'],
    ['Doanh thu bán sách (DOANH_THU_BAN_SACH)', report.bookSalesRevenue],
    ['Tiền phạt trễ hạn/vi phạm thu được (THU_PHAT)', report.fineRevenue],
    ['Hội phí thành viên CLB (HOI_PHI)', report.membershipFeeRevenue],
    ['TỔNG DOANH THU & THU NHẬP', report.totalRevenue],
    [],
    ['III. CHI PHÍ VÀ KẾT QUẢ HOẠT ĐỘNG', 'SỐ TIỀN (VND)'],
    ['Chi phí hoạt động & sự kiện (CHI_HOAT_DONG_SU_KIEN)', report.activityExpense],
    ['KẾT QUẢ RÒNG (LÃI / LỖ HOẠT ĐỘNG)', report.netIncome],
    ['Tổng số bút toán phát sinh trong kỳ', report.totalTransactions],
  ];

  if (drilldownItems && drilldownItems.length > 0) {
    rows.push([]);
    rows.push(['IV. DANH SÁCH BÚT TOÁN SỔ KÉP PHÁT SINH TRONG KỲ (DRILL-DOWN)']);
    rows.push([
      'Mã Bút Toán',
      'Quỹ',
      'Nghiệp Vụ',
      'Mã Nguồn',
      'Tài Khoản Nợ',
      'Tài Khoản Có',
      'Số Tiền (VND)',
      'Người Tạo',
      'Thời Gian',
      'Ghi Chú',
    ]);

    for (const item of drilldownItems) {
      rows.push([
        item.entryCode,
        item.fundId,
        item.sourceType,
        item.sourceId,
        item.debitAccount,
        item.creditAccount,
        item.amount,
        item.createdBy,
        item.createdAt,
        item.notes || '',
      ]);
    }
  }

  return buildExcelXmlDocument('BaoCaoTaiChinh', rows);
}

/**
 * 5c. Render Báo Cáo Lưu Thông Sách Ra Excel XML
 */
export function renderCirculationSummaryExcel(report: CirculationSummaryReport): string {
  const rows: (unknown[])[] = [
    ['BÁO CÁO TỔNG HỢP LƯU THÔNG SÁCH - CLB YÊU SÁCH BÁCH KHOA (YSBK)'],
    ['Từ ngày:', report.filter.startDate, 'Đến ngày:', report.filter.endDate],
    ['Thời điểm xuất:', report.generatedAt, 'Người xuất:', report.generatedBy],
    [],
    ['CHỈ SỐ LƯU THÔNG SÁCH', 'SỐ LƯỢNG'],
    ['Số lượt mượn sách phát hành trong kỳ', report.totalLoansIssued],
    ['Số lượt trả sách giải quyết trong kỳ', report.totalLoansReturned],
    ['Số lượt gia hạn sách trong kỳ', report.totalLoansRenewed],
    ['Số sách báo mất trong kỳ', report.totalBooksLost],
    ['Tổng số sách đang được mượn thời điểm hiện tại', report.totalActiveLoans],
    ['Tổng số sách đang quá hạn thời điểm hiện tại', report.totalOverdueLoans],
  ];

  return buildExcelXmlDocument('LuuThongSach', rows);
}

/**
 * 5d. Render Báo Cáo Tài Chính Ra HTML In Ấn / Xuất PDF
 */
export function renderFinancialSummaryHtml(
  report: FinancialSummaryReport,
  drilldownItems?: FinancialDrilldownItem[]
): string {
  const sections = [
    {
      title: 'I. Chỉ Tiêu Tài Sản và Nghĩa Vụ Nợ',
      headers: ['Chỉ tiêu', 'Số tiền (VND)'],
      rows: [
        ['Tiền mặt trong hộp quỹ (TIEN_MAT_HOP)', report.cashDrawerBalance.toLocaleString('vi-VN') + ' ₫'],
        ['Tiền trong tài khoản ngân hàng (TIEN_NGAN_HANG)', report.bankMainBalance.toLocaleString('vi-VN') + ' ₫'],
        ['Tiền cọc bạn đọc đang giữ phải hoàn (COC_PHAI_HOAN)', report.depositLiability.toLocaleString('vi-VN') + ' ₫'],
        ['Tiền cọc đặt nhà sách phải thu (COC_DAT_NHA_SACH)', report.bookstoreReceivable.toLocaleString('vi-VN') + ' ₫'],
        ['Nợ phải trả nhà sách (NO_PHAI_TRA_NHA_SACH)', report.bookstorePayable.toLocaleString('vi-VN') + ' ₫'],
      ],
    },
    {
      title: 'II. Doanh Thu và Chi Phí Hoạt Động',
      headers: ['Khoản mục', 'Số tiền (VND)'],
      rows: [
        ['Doanh thu bán sách', report.bookSalesRevenue.toLocaleString('vi-VN') + ' ₫'],
        ['Tiền phạt trễ hạn / vi phạm', report.fineRevenue.toLocaleString('vi-VN') + ' ₫'],
        ['Hội phí thành viên', report.membershipFeeRevenue.toLocaleString('vi-VN') + ' ₫'],
        ['Tổng doanh thu & thu nhập', report.totalRevenue.toLocaleString('vi-VN') + ' ₫'],
        ['Chi phí hoạt động & sự kiện', report.activityExpense.toLocaleString('vi-VN') + ' ₫'],
        ['Kết quả ròng trong kỳ', report.netIncome.toLocaleString('vi-VN') + ' ₫'],
      ],
    },
  ];

  if (drilldownItems && drilldownItems.length > 0) {
    sections.push({
      title: 'III. Chi Tiết Bút Toán Phát Sinh (Drill-down)',
      headers: ['Mã bút toán', 'Quỹ', 'Nghiệp vụ', 'Nợ / Có', 'Số tiền', 'Thời gian'],
      rows: drilldownItems.map((it) => [
        it.entryCode,
        it.fundId,
        it.sourceType,
        `${it.debitAccount} / ${it.creditAccount}`,
        it.amount.toLocaleString('vi-VN') + ' ₫',
        it.createdAt.slice(0, 19).replace('T', ' '),
      ]),
    });
  }

  return buildPrintableHtmlDocument(
    `Báo Cáo Tài Chính (${report.filter.startDate} đến ${report.filter.endDate})`,
    sections
  );
}

/**
 * 6. Tạo Vé Tải Báo Cáo Ngắn Hạn (Create Export Ticket)
 * TTL: 5 phút. Hỗ trợ mã hóa HMAC cho multi-worker instances.
 * Bắt buộc cấu hình secret (không dùng fallback hardcode trong source - RF-11).
 */
export function createExportTicket(
  actor: AuthenticatedActor,
  reportType: 'FINANCIAL_SUMMARY' | 'FINANCIAL_DRILLDOWN' | 'CIRCULATION',
  params: Record<string, any> = {},
  format: ExportFormat = 'CSV',
  secret?: string
): ExportDownloadTicket {
  requireInternalMember(actor);

  const rawId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000;

  const signingKey = secret || (typeof process !== 'undefined' ? (process.env.JWT_SECRET || process.env.EXPORT_TICKET_SECRET) : undefined);
  if (!signingKey) {
    throw new Error('EXPORT_TICKET_SECRET hoặc JWT_SECRET chưa được cấu hình. Từ chối tạo vé tải.');
  }

  const payloadStr = JSON.stringify({
    id: rawId,
    actorId: actor.userId,
    actorRole: actor.role,
    tokenVersion: actor.tokenVersion,
    reportType,
    format,
    params,
    createdAt: now,
    expiresAt,
  });
  const b64Payload = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', signingKey).update(b64Payload).digest('base64url');
  const ticketStr = `tkt.${b64Payload}.${hmac}`;

  const ticketObj: ExportDownloadTicket = {
    ticket: ticketStr,
    actorId: actor.userId,
    actorRole: actor.role,
    tokenVersion: actor.tokenVersion,
    reportType,
    format,
    params,
    createdAt: now,
    expiresAt,
  };

  defaultTicketStore.setTicket(ticketStr, ticketObj);
  defaultTicketStore.setTicket(rawId, ticketObj);
  return ticketObj;
}

/**
 * 7. Kiểm Tra & Thu Hồi Vé Tải Nguyên Tử (Validate & Atomic Consume Ticket)
 * R04, R06, R13, RF-11:
 * - Atomic single-use consume (chống race condition giữa 2 request đồng thời).
 * - Kiểm tra actor, role, tokenVersion sống thực tế khi tải.
 * - Chặn cựu thành viên (ALUMNI), tài khoản vô hiệu hóa, khách vãng lai.
 */
function validateExportTicket(
  ticketStr: string,
  currentActor?: AuthenticatedActor | null,
  secret?: string
): ExportDownloadTicket {
  let ticket: ExportDownloadTicket | undefined;

  if (ticketStr && ticketStr.startsWith('tkt.')) {
    const parts = ticketStr.split('.');
    if (parts.length === 3) {
      const [, b64Payload, sig] = parts;
      const signingKey = secret || (typeof process !== 'undefined' ? (process.env.JWT_SECRET || process.env.EXPORT_TICKET_SECRET) : undefined);
      if (!signingKey) {
        throw new UnauthorizedError('EXPORT_TICKET_SECRET hoặc JWT_SECRET chưa được cấu hình.', 'AUTH_CONFIG_MISSING');
      }
      const expectedSig = crypto.createHmac('sha256', signingKey).update(b64Payload).digest('base64url');
      if (Buffer.byteLength(sig) === Buffer.byteLength(expectedSig) && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        try {
          const parsed = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
          ticket = {
            ticket: ticketStr,
            actorId: parsed.actorId,
            actorRole: parsed.actorRole,
            tokenVersion: parsed.tokenVersion,
            reportType: parsed.reportType,
            format: parsed.format || 'CSV',
            params: parsed.params || {},
            createdAt: parsed.createdAt,
            expiresAt: parsed.expiresAt,
          };
        } catch {}
      }
    }
  }

  if (!ticket && !ticketStr.startsWith('tkt.')) {
    ticket = defaultTicketStore.getTicket(ticketStr);
  }

  if (!ticket) {
    throw new NotFoundError('Vé tải tệp không tồn tại hoặc đã hết hạn sử dụng.', 'TICKET_NOT_FOUND');
  }

  // Kiểm tra thời hạn vé
  if (Date.now() > ticket.expiresAt) {
    throw new BadRequestError('Vé tải tệp đã quá hạn sử dụng (hạn tối đa 5 phút).', 'TICKET_EXPIRED');
  }

  // Kiểm tra quyền của actor đang truy cập link tải
  if (!currentActor) {
    throw new UnauthorizedError('Yêu cầu đăng nhập để tải tệp báo cáo.', 'UNAUTHENTICATED');
  }

  // 1. Kiểm tra trạng thái kích hoạt tài khoản
  if (!currentActor.isActive) {
    throw new ForbiddenError('Tài khoản đã bị vô hiệu hóa, không thể tải tệp.', 'ACCOUNT_DISABLED');
  }

  // 2. Chặn cựu thành viên và khách vãng lai
  if (currentActor.isAlumni || currentActor.role === 'ALUMNI') {
    throw new ForbiddenError('Cựu thành viên không có quyền tải tệp báo cáo tài chính nội bộ.', 'ALUMNI_EXPORT_FORBIDDEN');
  }

  if (currentActor.role === 'GUEST') {
    throw new ForbiddenError('Tài khoản khách không có quyền tải báo cáo nội bộ.', 'GUEST_ACCESS_DENIED');
  }

  // 3. Kiểm tra tính toàn vẹn danh tính (nếu vé gắn actorId cụ thể)
  if (ticket.actorId && currentActor.userId && ticket.actorId !== currentActor.userId && currentActor.role !== 'ADMIN') {
    throw new ForbiddenError('Vé tải tệp chỉ dành cho người tạo hoặc Quản trị viên.', 'EXPORT_ACTOR_MISMATCH');
  }

  // 4. Kiểm tra tokenVersion: Chặn nếu phiên đăng nhập đã bị thu hồi / đổi mật khẩu kể từ khi tạo vé
  if (ticket.tokenVersion !== undefined && currentActor.tokenVersion !== undefined) {
    if (currentActor.tokenVersion !== ticket.tokenVersion) {
      throw new UnauthorizedError('Phiên đăng nhập đã thay đổi kể từ khi tạo vé. Vui lòng tạo vé tải mới.', 'TOKEN_VERSION_MISMATCH');
    }
  }

  return ticket;
}

export function validateAndConsumeExportTicket(ticketStr: string, actor?: AuthenticatedActor | null, secret?: string): ExportDownloadTicket {
  const ticket = validateExportTicket(ticketStr, actor, secret);
  const id = ticketStr.startsWith('tkt.') ? JSON.parse(Buffer.from(ticketStr.split('.')[1], 'base64url').toString()).id : ticketStr;
  if (!defaultTicketStore.atomicConsume(id, ticket.expiresAt)) throw new NotFoundError('Vé đã được sử dụng.', 'TICKET_NOT_FOUND');
  return ticket;
}

export async function validateAndConsumeExportTicketAsync(ticketStr: string, actor: AuthenticatedActor, secret: string | undefined, db: Queryable): Promise<ExportDownloadTicket> {
  const ticket = validateExportTicket(ticketStr, actor, secret);
  const id = ticketStr.startsWith('tkt.') ? JSON.parse(Buffer.from(ticketStr.split('.')[1], 'base64url').toString()).id : ticketStr;
  if (!await defaultTicketStore.atomicConsumeAsync(id, ticket.expiresAt, db)) throw new NotFoundError('Vé đã được sử dụng.', 'TICKET_NOT_FOUND');
  return ticket;
}

/**
 * Xóa toàn bộ ticket trong kho (dùng cho test suite)
 */
export function clearDownloadTicketsForTesting(): void {
  defaultTicketStore.clear();
}
