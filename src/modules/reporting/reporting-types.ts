/**
 * Reporting & Financial Analytics Types - YSBK (FR-05, R04, R06, R13)
 * Định nghĩa cấu trúc báo cáo tài chính, lưu thông sách, xuất file CSV/Excel và download ticket.
 */

import type { FundId } from '../../server/finance/types.ts';

export type ReportPeriod = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL' | 'CUSTOM';

export interface ReportFilter {
  period?: ReportPeriod;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  fundId?: FundId;
}

export interface BalanceSheetSnapshot {
  cashDrawerBalance: number;       // TIEN_MAT_HOP (Quỹ mượn + Quỹ hoạt động)
  bankMainBalance: number;         // TIEN_NGAN_HANG
  depositLiability: number;        // COC_PHAI_HOAN (Nghĩa vụ trả cọc bạn đọc)
  bookstoreReceivable: number;     // COC_DAT_NHA_SACH (Cọc đặt nhà sách phải thu)
  bookstorePayable: number;        // NO_PHAI_TRA_NHA_SACH (Nợ phải trả nhà sách)
}

export interface PeriodMovements {
  cashDrawerChange: number;
  bankMainChange: number;
  depositLiabilityChange: number;
  bookstoreReceivableChange: number;
  bookstorePayableChange: number;

  fineRevenue: number;
  membershipFeeRevenue: number;
  bookSalesRevenue: number;
  activityExpense: number;

  totalRevenue: number;
  netIncome: number;
}

export interface FinancialSummaryReport {
  filter: {
    period: ReportPeriod;
    startDate: string;
    endDate: string;
    fundId?: FundId;
  };
  // Tài sản & Nguồn vốn (Closing Balance)
  cashDrawerBalance: number;       // TIEN_MAT_HOP (Quỹ mượn + Quỹ hoạt động)
  bankMainBalance: number;         // TIEN_NGAN_HANG
  depositLiability: number;        // COC_PHAI_HOAN (Nghĩa vụ trả cọc bạn đọc)
  bookstoreReceivable: number;     // COC_DAT_NHA_SACH (Cọc đặt nhà sách phải thu)
  bookstorePayable: number;        // NO_PHAI_TRA_NHA_SACH (Nợ phải trả nhà sách)

  // Doanh thu & Thu nhập (Movements trong kỳ)
  fineRevenue: number;             // THU_PHAT
  membershipFeeRevenue: number;    // HOI_PHI
  bookSalesRevenue: number;        // DOANH_THU_BAN_SACH

  // Chi phí & Hoạt động (Movements trong kỳ)
  activityExpense: number;         // CHI_HOAT_DONG_SU_KIEN

  // Kết quả ròng (Movements trong kỳ)
  totalRevenue: number;            // fineRevenue + membershipFeeRevenue + bookSalesRevenue
  netIncome: number;               // totalRevenue - activityExpense

  // P22-10: Tách opening balance, movements trong kỳ và closing balance
  openingBalances: BalanceSheetSnapshot;
  movements: PeriodMovements;
  closingBalances: BalanceSheetSnapshot;

  // Metadata
  totalTransactions: number;
  generatedAt: string;
  generatedBy: string;
}

export interface FinancialDrilldownItem {
  id: string;
  entryCode: string;
  fundId: string;
  sourceType: string;
  sourceId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  createdBy: string;
  createdAt: string;
  notes: string | null;
}

export interface FinancialDrilldownResult {
  items: FinancialDrilldownItem[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface CirculationSummaryReport {
  filter: {
    startDate: string;
    endDate: string;
  };
  totalLoansIssued: number;
  totalLoansReturned: number;
  totalLoansRenewed: number;
  totalBooksLost: number;
  totalActiveLoans: number;
  totalOverdueLoans: number;
  generatedAt: string;
  generatedBy: string;
}

export type ExportFormat = 'CSV' | 'XLSX' | 'XML_EXCEL' | 'HTML' | 'JSON' | 'PDF';

export interface ExportDownloadTicket {
  ticket: string;
  actorId: string;
  actorRole: string;
  tokenVersion: number;
  reportType: 'FINANCIAL_SUMMARY' | 'FINANCIAL_DRILLDOWN' | 'CIRCULATION';
  format: ExportFormat;
  params: Record<string, any>;
  createdAt: number;
  expiresAt: number;
}
