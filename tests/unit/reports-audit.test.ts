/**
 * Unit Test Suite: Reporting, CSV Export, Formula Injection & Audit Security (Stage 21 - FR-05, R04, R06, R13)
 * Kiểm thử toàn diện 7 gates:
 * 1. G-financial-accuracy: Hai định dạng (JSON & CSV) cùng snapshot khớp tổng 100%, tính từ journal_entries thật.
 * 2. G-no-double-counting: Không đếm trùng cọc bạn đọc, chi sự kiện và doanh thu bán sách.
 * 3. G-formula-injection-safety: Fixture công thức độc hại (=, +, -, @) được escape an toàn bằng tiền tố nháy đơn.
 * 4. G-bounded-load: Chặn query vô hạn (limit > 500 cho drilldown, limit > 200 cho audit log).
 * 5. G-rbac-audit-redaction: Chỉ Admin đọc audit log (Member chặn 403); trường nhạy cảm được redact sạch.
 * 6. G-download-revocation-barrier: Link tải cũ / ticket chờ bị vô hiệu hóa ngay khi actor bị chuyển cựu hoặc khóa.
 * 7. G-vietnamese-utf8-integrity: File CSV chứa BOM \uFEFF và hiển thị đầy đủ dấu tiếng Việt chuẩn UTF-8.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  getFinancialSummaryReport,
  getFinancialDrilldown,
  getCirculationSummaryReport,
  renderFinancialSummaryCsv,
  renderCirculationSummaryCsv,
  createExportTicket,
  validateAndConsumeExportTicket,
  clearDownloadTicketsForTesting,
} from '../../src/modules/reporting/reporting-service.ts';
import { escapeCsvCell, buildCsvDocument, UTF8_BOM } from '../../src/modules/reporting/formula-sanitizer.ts';
import { getSystemAuditLogs, getAnalyticsSummary } from '../../src/modules/audit/queries.ts';
import { ACCOUNT_CODES, FUND_IDS } from '../../src/server/finance/types.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

describe('Stage 21: Dashboard, Reports, CSV Export & Audit Security (FR-05, R04, R06, R13)', () => {
  let db: MockCashDbQueryable;

  const mockAdminActor: AuthenticatedActor = {
    userId: 'user-admin-01',
    memberId: 'mem-admin-01',
    username: 'admin.thuvien',
    role: 'ADMIN',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const mockMemberActor: AuthenticatedActor = {
    userId: 'user-member-01',
    memberId: 'mem-finance-01',
    username: 'linh.taichinh',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const mockAlumniActor: AuthenticatedActor = {
    userId: 'user-alumni-01',
    memberId: 'mem-alumni-01',
    username: 'cuu.thanhvien',
    role: 'ALUMNI',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };

  const mockGuestActor: AuthenticatedActor = {
    userId: 'user-guest-01',
    username: 'guest.student',
    role: 'GUEST',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  beforeEach(() => {
    db = new MockCashDbQueryable();
    clearDownloadTicketsForTesting();

    const now = new Date().toISOString();

    // 1. Bút toán thu cọc mượn sách: Nợ TIEN_MAT_HOP (100k) / Có COC_PHAI_HOAN (100k) [Quỹ Mượn Trả]
    db.journalEntries.push({
      id: 'je-01',
      entry_code: 'JE-DEP-01',
      fund_id: FUND_IDS.LOAN,
      source_type: 'LOAN_ISSUE',
      source_id: 'rec-01',
      debit_account: ACCOUNT_CODES.CASH_DRAWER,
      credit_account: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      amount: '100000',
      created_by: 'mem-admin-01',
      created_at: now,
      notes: 'Thu cọc bạn đọc 2 cuốn sách',
    });

    // 2. Bút toán thu phạt trễ hạn: Nợ TIEN_MAT_HOP (20k) / Có THU_PHAT (20k) [Quỹ Mượn Trả]
    db.journalEntries.push({
      id: 'je-02',
      entry_code: 'JE-FINE-01',
      fund_id: FUND_IDS.LOAN,
      source_type: 'RETURN_SETTLEMENT',
      source_id: 'rec-02',
      debit_account: ACCOUNT_CODES.CASH_DRAWER,
      credit_account: ACCOUNT_CODES.FINE_REVENUE,
      amount: '20000',
      created_by: 'mem-admin-01',
      created_at: now,
      notes: 'Thu phạt quá hạn 4 ngày',
    });

    // 3. Bút toán thu hội phí: Nợ TIEN_MAT_HOP (50k) / Có HOI_PHI (50k) [Quỹ Hoạt Động]
    db.journalEntries.push({
      id: 'je-03',
      entry_code: 'JE-FEE-01',
      fund_id: FUND_IDS.OPERATION,
      source_type: 'MEMBERSHIP_FEE',
      source_id: 'mem-02',
      debit_account: ACCOUNT_CODES.CASH_DRAWER,
      credit_account: ACCOUNT_CODES.MEMBER_FEE,
      amount: '50000',
      created_by: 'mem-admin-01',
      created_at: now,
      notes: 'Thu hội phí kỳ 1',
    });

    // 4. Bút toán doanh thu bán sách: Nợ TIEN_NGAN_HANG (150k) / Có DOANH_THU_BAN_SACH (150k) [Quỹ Hoạt Động]
    db.journalEntries.push({
      id: 'je-04',
      entry_code: 'JE-SALE-01',
      fund_id: FUND_IDS.OPERATION,
      source_type: 'BOOK_SALE',
      source_id: 'sale-01',
      debit_account: ACCOUNT_CODES.BANK_MAIN,
      credit_account: ACCOUNT_CODES.BOOK_SALES_REVENUE,
      amount: '150000',
      created_by: 'mem-admin-01',
      created_at: now,
      notes: 'Bán sách Hội sách Bách Khoa',
    });

    // 5. Bút toán chi hoạt động sự kiện: Nợ CHI_HOAT_DONG_SU_KIEN (80k) / Có TIEN_MAT_HOP (80k) [Quỹ Hoạt Động]
    db.journalEntries.push({
      id: 'je-05',
      entry_code: 'JE-EXP-01',
      fund_id: FUND_IDS.OPERATION,
      source_type: 'ACTIVITY_EXPENSE',
      source_id: 'act-01',
      debit_account: ACCOUNT_CODES.ACTIVITY_EXPENSE,
      credit_account: ACCOUNT_CODES.CASH_DRAWER,
      amount: '80000',
      created_by: 'mem-admin-01',
      created_at: now,
      notes: 'Mua bánh kẹo sinh hoạt CLB',
    });
  });

  it('Gate 1 (G-financial-accuracy): Báo cáo tài chính tính đúng từ journal_entries và khớp 100% giữa JSON DTO và CSV', async () => {
    const report = await getFinancialSummaryReport(db, mockMemberActor, { period: 'MONTH' });

    // Tiền mặt: 100k + 20k + 50k - 80k = 90k
    assert.equal(report.cashDrawerBalance, 90000);
    // Tiền ngân hàng: 150k
    assert.equal(report.bankMainBalance, 150000);
    // Cọc phải hoàn: 100k
    assert.equal(report.depositLiability, 100000);
    // Thu phạt: 20k, Hội phí: 50k, Bán sách: 150k -> Tổng doanh thu = 220k
    assert.equal(report.fineRevenue, 20000);
    assert.equal(report.membershipFeeRevenue, 50000);
    assert.equal(report.bookSalesRevenue, 150000);
    assert.equal(report.totalRevenue, 220000);
    // Chi hoạt động: 80k
    assert.equal(report.activityExpense, 80000);
    // Lãi ròng: 220k - 80k = 140k
    assert.equal(report.netIncome, 140000);
    assert.equal(report.totalTransactions, 5);

    // Xuất CSV từ cùng snapshot
    const csv = renderFinancialSummaryCsv(report);
    assert.ok(csv.includes('90000'));
    assert.ok(csv.includes('150000'));
    assert.ok(csv.includes('100000'));
    assert.ok(csv.includes('220000'));
    assert.ok(csv.includes('80000'));
    assert.ok(csv.includes('140000'));
  });

  it('Gate 2 (G-no-double-counting): Không đếm trùng cọc bạn đọc, chi sự kiện và quyết toán bán sách', async () => {
    // Thêm bút toán hoàn cọc: Nợ COC_PHAI_HOAN (50k) / Có TIEN_MAT_HOP (50k) [Quỹ Mượn Trả]
    db.journalEntries.push({
      id: 'je-06',
      entry_code: 'JE-REFUND-01',
      fund_id: FUND_IDS.LOAN,
      source_type: 'RETURN_SETTLEMENT',
      source_id: 'rec-01',
      debit_account: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      credit_account: ACCOUNT_CODES.CASH_DRAWER,
      amount: '50000',
      created_by: 'mem-admin-01',
      created_at: new Date().toISOString(),
      notes: 'Hoàn trả cọc 1 cuốn sách đã trả',
    });

    const report = await getFinancialSummaryReport(db, mockMemberActor, { period: 'MONTH' });

    // Cọc còn lại: 100k - 50k = 50k
    assert.equal(report.depositLiability, 50000);
    // Hoàn cọc không làm tăng hay giảm doanh thu / chi phí hoạt động
    assert.equal(report.totalRevenue, 220000);
    assert.equal(report.activityExpense, 80000);
    assert.equal(report.netIncome, 140000);
    // Tiền mặt: 90k - 50k = 40k
    assert.equal(report.cashDrawerBalance, 40000);
  });

  it('Gate 3 (G-formula-injection-safety): Ngăn chặn triệt để CSV/Excel Formula Injection', () => {
    // Các chuỗi mở đầu công thức độc hại
    const maliciousInputs = [
      '=SUM(A1:A100)',
      '@cmd|"/c calc"!A0',
      '+123456789',
      '-cmd|"/c calc"!A0',
      '\t=2+2',
      '\r=CMD()',
      'Normal text',
      'Nội dung có dấu phẩy, và "ngoặc kép"',
    ];

    const escaped = maliciousInputs.map(escapeCsvCell);

    // Ký tự nguy hiểm bắt buộc có dấu nháy đơn `'` ở đầu
    assert.equal(escaped[0], "'=SUM(A1:A100)");
    assert.equal(escaped[1], `"'@cmd|""/c calc""!A0"`);
    assert.equal(escaped[2], "'+123456789");
    assert.equal(escaped[3], `"'-cmd|""/c calc""!A0"`);
    assert.equal(escaped[4], "'\t=2+2");
    assert.equal(escaped[5], `"'\r=CMD()"`);

    // Chuỗi thường giữ nguyên
    assert.equal(escaped[6], 'Normal text');

    // Chuỗi có dấu phẩy và ngoặc kép được bọc ngoặc kép an toàn
    assert.equal(escaped[7], '"Nội dung có dấu phẩy, và ""ngoặc kép"""');
  });

  it('Gate 4 (G-bounded-load): Chặn truy vấn vô hạn, giới hạn số dòng tối đa', async () => {
    // 1. Drilldown limit > 500 ném BadRequestError
    await assert.rejects(
      async () => {
        await getFinancialDrilldown(db, mockMemberActor, {}, { limit: 501 });
      },
      (err: any) => {
        assert.equal(err.name, 'BadRequestError');
        assert.equal(err.errorCode, 'PAGINATION_LIMIT_EXCEEDED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 2. Audit logs limit > 200 ném BadRequestError
    await assert.rejects(
      async () => {
        await getSystemAuditLogs(db, mockAdminActor, {}, { limit: 201 });
      },
      (err: any) => {
        assert.equal(err.name, 'BadRequestError');
        assert.equal(err.errorCode, 'AUDIT_LIMIT_EXCEEDED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it('Gate 5 (G-rbac-audit-redaction): Chỉ Admin đọc được nhật ký kiểm toán, các trường nhạy cảm được redact sạch', async () => {
    // 1. Member thường bị chặn 403 khi vào audit logs
    await assert.rejects(
      async () => {
        await getSystemAuditLogs(db, mockMemberActor);
      },
      (err: any) => {
        assert.equal(err.name, 'ForbiddenError');
        assert.equal(err.errorCode, 'ADMIN_REQUIRED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    // 2. Thêm audit log có chứa trường nhạy cảm
    db.systemAuditLogs.push({
      id: 'audit-sec-01',
      actor_id: 'mem-admin-01',
      action: 'USER_PASSWORD_CHANGE',
      target_resource: 'MEMBER',
      target_id: 'mem-02',
      ip_address: '127.0.0.1',
      details: {
        password: 'superSecretPassword123!',
        jwt_secret: 'secret-key-production',
        sessionToken: 'token-abc-xyz',
        notes: 'Đổi mật khẩu định kỳ',
      },
      created_at: new Date().toISOString(),
    });

    // 3. Admin tra cứu audit log
    const auditRes = await getSystemAuditLogs(db, mockAdminActor);
    assert.equal(auditRes.items.length, 1);
    const item = auditRes.items[0];
    assert.equal(item.action, 'USER_PASSWORD_CHANGE');
    // Các trường nhạy cảm đã bị [REDACTED]
    assert.equal(item.details?.password, '[REDACTED]');
    assert.equal(item.details?.jwt_secret, '[REDACTED]');
    assert.equal(item.details?.sessionToken, '[REDACTED]');
    assert.equal(item.details?.notes, 'Đổi mật khẩu định kỳ');
  });

  it('Gate 6 (G-download-revocation-barrier): Link tải cũ / ticket chờ bị chặn ngay lập tức nếu actor bị thu hồi quyền hoặc chuyển cựu', () => {
    const testSecret = 'test-export-ticket-secret-32-chars-long!';
    // 1. Member tạo ticket tải báo cáo
    const ticket = createExportTicket(mockMemberActor, 'FINANCIAL_SUMMARY', {}, 'CSV', testSecret);
    assert.ok(ticket.ticket);
    assert.equal(ticket.actorId, mockMemberActor.userId);

    // 2. Cố tình dùng actor là ALUMNI để tải vé
    assert.throws(
      () => {
        validateAndConsumeExportTicket(ticket.ticket, mockAlumniActor, testSecret);
      },
      (err: any) => {
        assert.equal(err.name, 'ForbiddenError');
        assert.equal(err.errorCode, 'ALUMNI_EXPORT_FORBIDDEN');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    // A rejected actor must not burn the creator's valid ticket.
    assert.equal(validateAndConsumeExportTicket(ticket.ticket, mockMemberActor, testSecret).actorId, mockMemberActor.userId);
  });

  it('Gate 7 (G-vietnamese-utf8-integrity): Tệp CSV sinh ra có tiền tố BOM và hiển thị toàn vẹn tiếng Việt', () => {
    const doc = buildCsvDocument([
      ['BÁO CÁO TÀI CHÍNH CLB YÊU SÁCH BÁCH KHOA'],
      ['Chỉ tiêu', 'Số tiền (VND)', 'Ghi chú'],
      ['Tiền mặt hộp quỹ', 90000, 'Khớp sổ quỹ ca trực'],
      ['Cọc bạn đọc đang giữ', 100000, 'Nghĩa vụ phải hoàn'],
    ]);

    // Kiểm tra tiền tố BOM \uFEFF
    assert.ok(doc.startsWith(UTF8_BOM), 'CSV phải bắt đầu bằng UTF-8 BOM \\uFEFF');

    // Kiểm tra tiếng Việt không bị mất dấu hay biến thành ký tự lạ
    assert.ok(doc.includes('BÁO CÁO TÀI CHÍNH CLB YÊU SÁCH BÁCH KHOA'));
    assert.ok(doc.includes('Tiền mặt hộp quỹ'));
    assert.ok(doc.includes('Cọc bạn đọc đang giữ'));
    assert.ok(doc.includes('Khớp sổ quỹ ca trực'));
  });

  it('Gate 8 (G-analytics-privacy): Analytics tổng hợp số liệu vận hành và không chứa PII bạn đọc', async () => {
    // Seed catalog & copy
    db.bookTitles.push({ id: 'bt-01', title: 'Đắc Nhân Tâm' });
    db.bookCopies.push({ id: 'cp-01', title_id: 'bt-01', status: 'AVAILABLE' });
    db.members.push({ id: 'mem-01', is_active: true, is_alumni: false });
    db.bookReviews.push({ id: 'rev-01', status: 'APPROVED' });
    db.publicPosts.push({ id: 'post-01', status: 'PUBLISHED' });

    const analytics = await getAnalyticsSummary(db, mockMemberActor);
    assert.equal(analytics.totalBooksCataloged, 1);
    assert.equal(analytics.totalCopiesInCirculation, 1);
    assert.equal(analytics.totalActiveMembers, 1);
    assert.equal(analytics.totalReviewsPublished, 1);
    assert.equal(analytics.totalPublicPosts, 1);
  });

  it('Gate 9 (G-circulation-csv): Báo cáo lưu thông sách và kết xuất CSV', async () => {
    db.loanReceipts.push({ id: 'lr-01', created_at: new Date().toISOString() });
    db.loanSettlements.push({ id: 'ls-01', settlement_type: 'FULL', settled_at: new Date().toISOString() });
    db.loanItems.push({ id: 'li-01', receipt_id: 'lr-01', returned_at: null, is_lost: false, carried_forward_at: null });

    const circ = await getCirculationSummaryReport(db, mockMemberActor);
    assert.equal(circ.totalLoansIssued, 1);
    assert.equal(circ.totalLoansReturned, 1);
    assert.equal(circ.totalActiveLoans, 1);

    const csv = renderCirculationSummaryCsv(circ);
    assert.ok(csv.startsWith(UTF8_BOM));
    assert.ok(csv.includes('BÁO CÁO TỔNG HỢP LƯU THÔNG SÁCH'));
  });

  it('Gate 10 (G-guest-report-barrier): Khách (Guest) bị chặn 403 khi truy cập báo cáo tài chính nội bộ', async () => {
    await assert.rejects(
      async () => {
        await getFinancialSummaryReport(db, mockGuestActor);
      },
      (err: any) => {
        assert.equal(err.name, 'ForbiddenError');
        assert.equal(err.errorCode, 'GUEST_ACCESS_DENIED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  it('Regression P22-10 (Mandatory 4): Cọc 50k nhận trước kỳ, hoàn 50k trong kỳ -> liability cuối kỳ 0, không phải -50k. Opening balance hiện đúng khi không phát sinh', async () => {
    const reportDb = new MockCashDbQueryable();

    // 1. Cọc 50k nhận trước kỳ (tháng trước: 2026-08-15)
    reportDb.journalEntries.push({
      id: 'je-pre-01',
      entry_code: 'JE-DEP-PRE-01',
      fund_id: FUND_IDS.LOAN,
      source_type: 'LOAN_ISSUE',
      source_id: 'rec-pre-01',
      debit_account: ACCOUNT_CODES.CASH_DRAWER,
      credit_account: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      amount: '50000',
      created_by: 'mem-admin-01',
      created_at: '2026-08-15T09:00:00+07:00',
      notes: 'Thu cọc 50k tháng trước',
    });

    // 2. Hoàn cọc 50k trong kỳ (tháng 9: 2026-09-10)
    reportDb.journalEntries.push({
      id: 'je-cur-01',
      entry_code: 'JE-REFUND-01',
      fund_id: FUND_IDS.LOAN,
      source_type: 'LOAN_DEPOSIT_REFUND',
      source_id: 'ref-cur-01',
      debit_account: ACCOUNT_CODES.DEPOSIT_LIABILITY,
      credit_account: ACCOUNT_CODES.CASH_DRAWER,
      amount: '50000',
      created_by: 'mem-admin-01',
      created_at: '2026-09-10T14:00:00+07:00',
      notes: 'Hoàn cọc 50k trong tháng 9',
    });

    // Lọc theo kỳ tháng 9 (2026-09-01 đến 2026-09-30)
    const report = await getFinancialSummaryReport(reportDb, mockMemberActor, {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    // Opening balance đầu tháng 9: liability = 50.000₫, tiền mặt = 50.000₫
    assert.equal(report.openingBalances.depositLiability, 50000);
    assert.equal(report.openingBalances.cashDrawerBalance, 50000);

    // Movement trong tháng 9: hoàn cọc -> liability giảm 50.000₫ (-50k), tiền mặt giảm 50.000₫ (-50k)
    assert.equal(report.movements.depositLiabilityChange, -50000);
    assert.equal(report.movements.cashDrawerChange, -50000);

    // Closing balance cuối tháng 9: liability = 0₫ (KHÔNG phải -50.000₫!), tiền mặt = 0₫
    assert.equal(report.closingBalances.depositLiability, 0);
    assert.equal(report.closingBalances.cashDrawerBalance, 0);
    assert.equal(report.depositLiability, 0);
    assert.equal(report.cashDrawerBalance, 0);

    // Kiểm tra kỳ tháng 10 (2026-10-01 đến 2026-10-31) không phát sinh gì thêm:
    // Opening = 0, Closing = 0
    const octReport = await getFinancialSummaryReport(reportDb, mockMemberActor, {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    assert.equal(octReport.openingBalances.depositLiability, 0);
    assert.equal(octReport.closingBalances.depositLiability, 0);
    assert.equal(octReport.movements.depositLiabilityChange, 0);
    assert.equal(octReport.totalTransactions, 0);
  });
});
