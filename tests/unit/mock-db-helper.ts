/**
 * Shared Mock Database Queryable Helpers for Unit Tests
 * Không chứa block test() nào để tránh đăng ký lặp bài test trong test runner.
 */

import type { Queryable } from '../../src/server/finance/types.ts';

export class MockCashDbQueryable implements Queryable {
  public cashSessions: any[] = [];
  public journalEntries: any[] = [];
  public depositAllocations: any[] = [];
  public refundIntents: any[] = [];
  public borrowers: any[] = [];
  public bookTitles: any[] = [];
  public bookCopies: any[] = [];
  public authors: any[] = [];
  public categories: any[] = [];
  public bookEditions: any[] = [];
  public loanReceipts: any[] = [];
  public loanItems: any[] = [];
  public loanSettlements: any[] = [];
  public loanRenewals: any[] = [];
  public calendarHolidays: any[] = [];
  public systemAuditLogs: any[] = [];
  public idempotencyRecords: any[] = [];
  public members: any[] = [];
  public memberAffiliations: any[] = [];
  public membershipDuesReceipts: any[] = [];
  public dutyAvailabilityBatches: any[] = [];
  public memberBusyIntervals: any[] = [];
  public dutySchedules: any[] = [];
  public dutyScheduleAssignees: any[] = [];
  public recruitmentForms: any[] = [];
  public recruitmentFormQuestions: any[] = [];
  public recruitmentFormResponses: any[] = [];
  public recruitmentEvaluations: any[] = [];
  public recruitmentReconciliationCheckpoints: any[] = [];
  public recruitmentRubrics: any[] = [];
  public recruitmentRubricCriteria: any[] = [];
  public recruitmentEvaluationHistory: any[] = [];
  public recruitmentDecisions: any[] = [];
  public recruitmentPublicAnnouncements: any[] = [];
  public bookSuppliers: any[] = [];
  public consignmentLots: any[] = [];
  public consignmentLotItems: any[] = [];
  public bookSales: any[] = [];
  public consignmentReturns: any[] = [];
  public consignmentSettlements: any[] = [];
  public supplierPayments: any[] = [];
  public activities: any[] = [];
  public activityTasks: any[] = [];
  public activityTaskHistory: any[] = [];
  public activityParticipants: any[] = [];
  public activityBudgetItems: any[] = [];
  public activityExpenses: any[] = [];
  public bookReviews: any[] = [];
  public publicPosts: any[] = [];
  private snapshotState: string | null = null;

  public async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // Transaction Management
    if (cleanSql === 'BEGIN') {
      this.snapshotState = JSON.stringify({
        cashSessions: this.cashSessions,
        journalEntries: this.journalEntries,
        depositAllocations: this.depositAllocations,
        refundIntents: this.refundIntents,
        borrowers: this.borrowers,
        bookTitles: this.bookTitles,
        bookCopies: this.bookCopies,
        authors: this.authors,
        categories: this.categories,
        bookEditions: this.bookEditions,
        loanReceipts: this.loanReceipts,
        loanItems: this.loanItems,
        loanSettlements: this.loanSettlements,
        loanRenewals: this.loanRenewals,
        calendarHolidays: this.calendarHolidays,
        systemAuditLogs: this.systemAuditLogs,
        idempotencyRecords: this.idempotencyRecords,
        members: this.members,
        memberAffiliations: this.memberAffiliations,
        membershipDuesReceipts: this.membershipDuesReceipts,
        dutyAvailabilityBatches: this.dutyAvailabilityBatches,
        memberBusyIntervals: this.memberBusyIntervals,
        dutySchedules: this.dutySchedules,
        dutyScheduleAssignees: this.dutyScheduleAssignees,
        recruitmentForms: this.recruitmentForms,
        recruitmentFormQuestions: this.recruitmentFormQuestions,
        recruitmentFormResponses: this.recruitmentFormResponses,
        recruitmentEvaluations: this.recruitmentEvaluations,
        recruitmentReconciliationCheckpoints: this.recruitmentReconciliationCheckpoints,
        recruitmentRubrics: this.recruitmentRubrics,
        recruitmentRubricCriteria: this.recruitmentRubricCriteria,
        recruitmentEvaluationHistory: this.recruitmentEvaluationHistory,
        recruitmentDecisions: this.recruitmentDecisions,
        recruitmentPublicAnnouncements: this.recruitmentPublicAnnouncements,
        bookSuppliers: this.bookSuppliers,
        consignmentLots: this.consignmentLots,
        consignmentLotItems: this.consignmentLotItems,
        bookSales: this.bookSales,
        consignmentReturns: this.consignmentReturns,
        consignmentSettlements: this.consignmentSettlements,
        supplierPayments: this.supplierPayments,
        activities: this.activities,
        activityTasks: this.activityTasks,
        activityTaskHistory: this.activityTaskHistory,
        activityParticipants: this.activityParticipants,
        activityBudgetItems: this.activityBudgetItems,
        activityExpenses: this.activityExpenses,
        bookReviews: this.bookReviews,
        publicPosts: this.publicPosts,
      });
      return { rows: [], rowCount: 0 };
    }

    if (cleanSql === 'COMMIT') {
      this.snapshotState = null;
      return { rows: [], rowCount: 0 };
    }

    if (cleanSql === 'ROLLBACK') {
      if (this.snapshotState) {
        const snap = JSON.parse(this.snapshotState);
        this.cashSessions = snap.cashSessions;
        this.journalEntries = snap.journalEntries;
        this.depositAllocations = snap.depositAllocations;
        this.refundIntents = snap.refundIntents;
        this.borrowers = snap.borrowers;
        this.bookTitles = snap.bookTitles;
        this.bookCopies = snap.bookCopies;
        this.authors = snap.authors;
        this.categories = snap.categories;
        this.bookEditions = snap.bookEditions;
        this.loanReceipts = snap.loanReceipts;
        this.loanItems = snap.loanItems;
        this.loanSettlements = snap.loanSettlements || [];
        this.loanRenewals = snap.loanRenewals || [];
        this.calendarHolidays = snap.calendarHolidays || [];
        this.systemAuditLogs = snap.systemAuditLogs;
        this.idempotencyRecords = snap.idempotencyRecords;
        this.members = snap.members || [];
        this.memberAffiliations = snap.memberAffiliations || [];
        this.membershipDuesReceipts = snap.membershipDuesReceipts || [];
        this.dutyAvailabilityBatches = snap.dutyAvailabilityBatches || [];
        this.memberBusyIntervals = snap.memberBusyIntervals || [];
        this.dutySchedules = snap.dutySchedules || [];
        this.dutyScheduleAssignees = snap.dutyScheduleAssignees || [];
        this.recruitmentForms = snap.recruitmentForms || [];
        this.recruitmentFormQuestions = snap.recruitmentFormQuestions || [];
        this.recruitmentFormResponses = snap.recruitmentFormResponses || [];
        this.recruitmentEvaluations = snap.recruitmentEvaluations || [];
        this.recruitmentReconciliationCheckpoints = snap.recruitmentReconciliationCheckpoints || [];
        this.recruitmentRubrics = snap.recruitmentRubrics || [];
        this.recruitmentRubricCriteria = snap.recruitmentRubricCriteria || [];
        this.recruitmentEvaluationHistory = snap.recruitmentEvaluationHistory || [];
        this.recruitmentDecisions = snap.recruitmentDecisions || [];
        this.recruitmentPublicAnnouncements = snap.recruitmentPublicAnnouncements || [];
        this.bookSuppliers = snap.bookSuppliers || [];
        this.consignmentLots = snap.consignmentLots || [];
        this.consignmentLotItems = snap.consignmentLotItems || [];
        this.bookSales = snap.bookSales || [];
        this.consignmentReturns = snap.consignmentReturns || [];
        this.consignmentSettlements = snap.consignmentSettlements || [];
        this.supplierPayments = snap.supplierPayments || [];
        this.activities = snap.activities || [];
        this.activityTasks = snap.activityTasks || [];
        this.activityTaskHistory = snap.activityTaskHistory || [];
        this.activityParticipants = snap.activityParticipants || [];
        this.activityBudgetItems = snap.activityBudgetItems || [];
        this.activityExpenses = snap.activityExpenses || [];
        this.bookReviews = snap.bookReviews || [];
        this.publicPosts = snap.publicPosts || [];
        this.snapshotState = null;
      }
      return { rows: [], rowCount: 0 };
    }

    // 1. cash_sessions SELECT is_closed = FALSE (Active session check)
    if (cleanSql.includes('FROM cash_sessions') && cleanSql.includes('is_closed = FALSE')) {
      const active = this.cashSessions.find((s) => s.is_closed === false);
      return { rows: active ? [{ ...active } as unknown as T] : [], rowCount: active ? 1 : 0 };
    }

    // 2. cash_sessions SELECT last closed session for automatic handover
    if (cleanSql.includes('FROM cash_sessions') && cleanSql.includes('is_closed = TRUE') && cleanSql.includes('ORDER BY closed_at DESC')) {
      const closed = this.cashSessions
        .filter((s) => s.is_closed === true)
        .sort((a, b) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime());
      return { rows: closed.length > 0 ? [{ ...closed[0] } as unknown as T] : [], rowCount: closed.length > 0 ? 1 : 0 };
    }

    // 3. cash_sessions SELECT by ID (FOR UPDATE or normal)
    if (cleanSql.includes('FROM cash_sessions WHERE id = $1')) {
      const session = this.cashSessions.find((s) => s.id === params[0]);
      return { rows: session ? [{ ...session } as unknown as T] : [], rowCount: session ? 1 : 0 };
    }

    // 4. cash_sessions INSERT
    if (cleanSql.startsWith('INSERT INTO cash_sessions')) {
      const session = {
        id: params[0],
        session_date: params[1],
        opened_by: params[2],
        opened_at: new Date().toISOString(),
        opening_cash: params[3],
        expected_closing_cash: params[3],
        actual_closing_cash: null,
        discrepancy: null,
        discrepancy_reason: params[5] || null,
        is_closed: false,
        closed_at: null,
        closed_by: null,
        handed_over_from_session_id: params[4] || null,
      };
      this.cashSessions.push(session);
      return { rows: [{ ...session } as unknown as T], rowCount: 1 };
    }

    // 5. cash_sessions UPDATE (Close session)
    if (cleanSql.startsWith('UPDATE cash_sessions') && (cleanSql.includes('is_closed = TRUE') || cleanSql.includes('actual_closing_cash = $3'))) {
      const [id, expected, actual, disc, reason, closedBy] = params;
      const session = this.cashSessions.find((s) => s.id === id);
      if (session) {
        session.expected_closing_cash = expected;
        session.actual_closing_cash = actual;
        session.discrepancy = disc;
        session.discrepancy_reason = reason;
        session.is_closed = true;
        session.closed_at = new Date().toISOString();
        session.closed_by = closedBy;
        return { rows: [{ ...session } as unknown as T], rowCount: 1 };
      }
    }

    // 5b. cash_sessions UPDATE expected_closing_cash
    if (cleanSql.startsWith('UPDATE cash_sessions') && cleanSql.includes('expected_closing_cash = expected_closing_cash + $2')) {
      const [sessionId, amount] = params;
      const s = this.cashSessions.find((cs) => cs.id === sessionId);
      if (s) {
        s.expected_closing_cash = (BigInt(s.expected_closing_cash || 0) + BigInt(amount)).toString();
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    // 6. journal_entries INSERT
    if (cleanSql.startsWith('INSERT INTO journal_entries')) {
      const entry = {
        id: `mock-entry-${this.journalEntries.length + 1}`,
        entry_code: params[0],
        fund_id: params[1],
        source_type: params[2],
        source_id: params[3],
        debit_account: params[4],
        credit_account: params[5],
        amount: params[6],
        reversal_of_entry_id: params[7],
        cash_session_id: params[8] || null,
        notes: params[9] || null,
        created_by: params[10],
        created_at: new Date().toISOString(),
      };
      this.journalEntries.push(entry);
      return { rows: [entry as unknown as T], rowCount: 1 };
    }

    // 7. journal_entries SELECT COALESCE(SUM(amount), 0)
    if (cleanSql.includes('SELECT COALESCE(SUM(amount), 0) AS total FROM journal_entries WHERE cash_session_id = $1')) {
      const sessionId = params[0];
      const fundId = cleanSql.includes('fund_id = $2') ? params[1] : null;
      const account = cleanSql.includes('fund_id = $2') ? params[2] : params[1];

      let total = 0n;
      for (const e of this.journalEntries) {
        if (e.cash_session_id === sessionId) {
          if (fundId && e.fund_id !== fundId) continue;
          if (cleanSql.includes('debit_account') && e.debit_account === account) {
            total += BigInt(e.amount);
          } else if (cleanSql.includes('credit_account') && e.credit_account === account) {
            total += BigInt(e.amount);
          }
        }
      }
      return { rows: [{ total: total.toString() } as unknown as T], rowCount: 1 };
    }

    // 8. journal_entries find single original entry by source_id
    if (cleanSql.includes('FROM journal_entries WHERE source_type =') && cleanSql.includes('source_id = $1')) {
      const entry = this.journalEntries.find((e) => e.source_id === params[0]);
      return { rows: entry ? [{ ...entry } as unknown as T] : [], rowCount: entry ? 1 : 0 };
    }

    // 9. journal_entries SELECT by id
    if (cleanSql.includes('FROM journal_entries WHERE id = $1')) {
      const entry = this.journalEntries.find((e) => e.id === params[0]);
      return { rows: entry ? [{ ...entry } as unknown as T] : [], rowCount: entry ? 1 : 0 };
    }

    // 9b. journal_entries SELECT by reversal_of_entry_id
    if (cleanSql.includes('FROM journal_entries WHERE reversal_of_entry_id = $1')) {
      const revs = this.journalEntries.filter((e) => e.reversal_of_entry_id === params[0]);
      return { rows: revs as unknown as T[], rowCount: revs.length };
    }

    // 9c. journal_entries COUNT by source_id
    if (cleanSql.includes('SELECT COUNT(*) as cnt FROM journal_entries WHERE source_id = $1')) {
      const cnt = this.journalEntries.filter((e) => e.source_id === params[0]).length;
      return { rows: [{ cnt }] as unknown as T[], rowCount: 1 };
    }

    // 10. deposit_allocations existing check (S04-01)
    if (cleanSql.startsWith('SELECT id FROM deposit_allocations WHERE receipt_id = $1')) {
      const [receiptId, itemId] = params;
      const exists = this.depositAllocations.find(
        (a) =>
          a.receipt_id === receiptId &&
          (itemId === null ? a.item_id === null : a.item_id === itemId) &&
          (a.status === 'HELD' || a.status === 'PENDING_REFUND')
      );
      return { rows: exists ? [{ id: exists.id } as unknown as T] : [], rowCount: exists ? 1 : 0 };
    }

    // 11. deposit_allocations INSERT
    if (cleanSql.startsWith('INSERT INTO deposit_allocations')) {
      const isPendingCollection = cleanSql.includes("'PENDING_COLLECTION'");
      const is5Param = params.length === 5;
      const alloc = {
        id: `mock-alloc-${this.depositAllocations.length + 1}`,
        receipt_id: params[0],
        item_id: params[1],
        fund_id: params[2],
        original_amount: params[3],
        remaining_amount: isPendingCollection ? '0' : (is5Param ? params[3] : params[4]),
        status: isPendingCollection ? 'PENDING_COLLECTION' : 'HELD',
        payment_method: is5Param ? params[4] : params[5],
        refund_method: null,
        transferred_to_receipt_id: null,
        transferred_from_allocation_id: params.length >= 7 ? params[6] : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.depositAllocations.push(alloc);
      return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
    }

    // 12. deposit_allocations SELECT by ID
    if (cleanSql.includes('FROM deposit_allocations WHERE id = $1')) {
      const alloc = this.depositAllocations.find((a) => a.id === params[0]);
      return { rows: alloc ? [{ ...alloc } as unknown as T] : [], rowCount: alloc ? 1 : 0 };
    }

    // 13. deposit_allocations UPDATE
    if (cleanSql.startsWith('UPDATE deposit_allocations')) {
      if (cleanSql.includes("status = 'FORFEITED'") && cleanSql.includes('WHERE id = ANY($1)')) {
        const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
        let count = 0;
        for (const a of this.depositAllocations) {
          if (ids.includes(a.id)) {
            a.status = 'FORFEITED';
            a.remaining_amount = '0';
            a.updated_at = new Date().toISOString();
            count++;
          }
        }
        return { rows: [], rowCount: count };
      }

      if (cleanSql.includes("status = 'FORFEITED'") && cleanSql.includes('WHERE receipt_id = $1')) {
        const receiptId = params[0];
        let count = 0;
        for (const a of this.depositAllocations) {
          if (a.receipt_id === receiptId) {
            a.status = 'FORFEITED';
            a.remaining_amount = '0';
            a.updated_at = new Date().toISOString();
            count++;
          }
        }
        return { rows: [], rowCount: count };
      }

      const alloc = this.depositAllocations.find((a) => a.id === params[0]);
      if (alloc) {
        if (cleanSql.includes("status = 'PENDING_REFUND'")) {
          alloc.status = 'PENDING_REFUND';
          alloc.refund_method = params[1] || null;
        }
        if (cleanSql.includes("status = 'FORFEITED'")) {
          alloc.status = 'FORFEITED';
          alloc.remaining_amount = '0';
        }
        if (cleanSql.includes("status = 'TRANSFERRED'")) {
          alloc.status = 'TRANSFERRED';
          alloc.remaining_amount = '0';
          alloc.transferred_to_receipt_id = params[1] || null;
        }
        if (cleanSql.includes("status = 'VOIDED'")) {
          alloc.status = 'VOIDED';
          alloc.remaining_amount = '0';
        }
        if (cleanSql.includes("status = 'REFUNDED'")) {
          alloc.status = 'REFUNDED';
          alloc.remaining_amount = '0';
        }
        if (cleanSql.includes("status = 'HELD'") && cleanSql.includes('remaining_amount = original_amount')) {
          alloc.status = 'HELD';
          alloc.remaining_amount = alloc.original_amount;
          alloc.payment_method = params[1] || alloc.payment_method;
        }
        if (cleanSql.includes('status = $2, remaining_amount = $3')) {
          alloc.status = params[1];
          alloc.remaining_amount = params[2].toString();
        }
        if (cleanSql.includes('remaining_amount = $2') && cleanSql.includes('status = $3')) {
          alloc.remaining_amount = params[1].toString();
          alloc.status = params[2];
          alloc.refund_method = params[3];
        }
        alloc.updated_at = new Date().toISOString();
        return { rows: [{ ...alloc } as unknown as T], rowCount: 1 };
      }
    }

    // 14. deposit_allocations SUM remaining_amount
    if (cleanSql.includes('SELECT COALESCE(SUM(remaining_amount), 0) AS total_remaining FROM deposit_allocations')) {
      let total = 0n;
      for (const a of this.depositAllocations) {
        if (a.status === 'HELD' || a.status === 'PENDING_REFUND') {
          total += BigInt(a.remaining_amount);
        }
      }
      return { rows: [{ total_remaining: total.toString() } as unknown as T], rowCount: 1 };
    }

    // 15. refund_intents INSERT
    if (cleanSql.startsWith('INSERT INTO refund_intents')) {
      const intent = {
        id: `mock-intent-${this.refundIntents.length + 1}`,
        allocation_id: params[0],
        amount: params[1],
        refund_method: params[2],
        status: 'PENDING',
        requested_by: params[3],
        confirmed_by: null,
        confirmed_at: null,
        cash_session_id: null,
        journal_entry_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.refundIntents.push(intent);
      return { rows: [{ ...intent } as unknown as T], rowCount: 1 };
    }

    // 16. refund_intents SELECT by ID
    if (cleanSql.includes('FROM refund_intents WHERE id = $1')) {
      const intent = this.refundIntents.find((i) => i.id === params[0]);
      return { rows: intent ? [{ ...intent } as unknown as T] : [], rowCount: intent ? 1 : 0 };
    }

    // 17. refund_intents UPDATE (Confirm or Cancel)
    if (cleanSql.startsWith('UPDATE refund_intents')) {
      const intent = this.refundIntents.find((i) => i.id === params[0]);
      if (intent) {
        if (cleanSql.includes("status = 'CANCELLED'")) {
          intent.status = 'CANCELLED';
        } else {
          intent.status = 'CONFIRMED';
          intent.confirmed_by = params[1];
          intent.cash_session_id = params[2];
          intent.journal_entry_id = params[3];
          intent.confirmed_at = new Date().toISOString();
        }
        intent.updated_at = new Date().toISOString();
        return { rows: [{ ...intent } as unknown as T], rowCount: 1 };
      }
    }

    // 18. Reconciliation: journal_entries COC_PHAI_HOAN balance
    if (cleanSql.includes('SELECT COALESCE(SUM(CASE WHEN credit_account = $2') && cleanSql.includes('FROM journal_entries WHERE fund_id = $1')) {
      let totalCredit = 0n;
      let totalDebit = 0n;
      for (const e of this.journalEntries) {
        if (e.fund_id === params[0]) {
          if (e.credit_account === params[1]) totalCredit += BigInt(e.amount);
          if (e.debit_account === params[1]) totalDebit += BigInt(e.amount);
        }
      }
      return {
        rows: [{ total_credit: totalCredit.toString(), total_debit: totalDebit.toString() } as unknown as T],
        rowCount: 1,
      };
    }

    // 19. book_titles search COUNT
    if (cleanSql.startsWith('SELECT COUNT(*) AS total FROM book_titles bt')) {
      return { rows: [{ total: this.bookTitles.length.toString() } as unknown as T], rowCount: 1 };
    }

    // 20. book_titles search SELECT
    if (cleanSql.startsWith('SELECT bt.id, bt.title, bt.original_title, bt.description') && cleanSql.includes('FROM book_titles bt')) {
      const rows = this.bookTitles.map((bt) => {
        const editions = this.bookEditions.filter((e) => e.title_id === bt.id);
        const copies = this.bookCopies.filter((c) => editions.some((e) => e.id === c.edition_id));
        const avail = copies.filter((c) => c.status === 'AVAILABLE').length;
        const totalCopies = copies.filter((c) => c.status !== 'ARCHIVED').length;
        return {
          id: bt.id,
          title: bt.title,
          original_title: bt.original_title || null,
          description: bt.description || null,
          authors: bt.authors || [],
          categories: bt.categories || [],
          available_copies_count: avail,
          total_copies_count: totalCopies,
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 21. book_titles SELECT by ID
    if (cleanSql.includes('FROM book_titles') && (cleanSql.includes('bt.id = $1') || cleanSql.includes('WHERE id = $1'))) {
      const bt = this.bookTitles.find((t) => t.id === params[0]);
      if (!bt) return { rows: [], rowCount: 0 };
      const editions = this.bookEditions.filter((e) => e.title_id === bt.id);
      const copies = this.bookCopies.filter((c) => editions.some((e) => e.id === c.edition_id));
      const avail = copies.filter((c) => c.status === 'AVAILABLE').length;
      const totalCopies = copies.filter((c) => c.status !== 'ARCHIVED').length;
      return {
        rows: [
          {
            id: bt.id,
            title: bt.title,
            original_title: bt.original_title || null,
            description: bt.description || null,
            authors: bt.authors || [],
            categories: bt.categories || [],
            available_copies_count: avail,
            total_copies_count: totalCopies,
          } as unknown as T,
        ],
        rowCount: 1,
      };
    }

    // 22. book_editions SELECT by title_id
    if (cleanSql.includes('FROM book_editions be WHERE be.title_id = $1')) {
      const editions = this.bookEditions.filter((e) => e.title_id === params[0]);
      const rows = editions.map((e) => {
        const copies = this.bookCopies.filter((c) => c.edition_id === e.id);
        const avail = copies.filter((c) => c.status === 'AVAILABLE').length;
        const totalCopies = copies.filter((c) => c.status !== 'ARCHIVED').length;
        const samplePrice = copies.find((c) => c.cover_price !== null)?.cover_price || null;
        return {
          id: e.id,
          publisher: e.publisher,
          publish_year: e.publish_year,
          isbn: e.isbn || null,
          cover_image_url: e.cover_image_url || null,
          available_copies_count: avail,
          total_copies_count: totalCopies,
          sample_cover_price: samplePrice,
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 23. book_editions SELECT by ID (edition check)
    if (cleanSql.startsWith('SELECT id, title_id, publisher FROM book_editions WHERE id = $1')) {
      const ed = this.bookEditions.find((e) => e.id === params[0]);
      return { rows: ed ? [{ ...ed } as unknown as T] : [], rowCount: ed ? 1 : 0 };
    }

    // 24. book_copies SELECT by barcode
    if (cleanSql.includes('FROM book_copies bc') && cleanSql.includes('WHERE bc.barcode = $1')) {
      const copy = this.bookCopies.find((c) => c.barcode === params[0]);
      if (!copy) return { rows: [], rowCount: 0 };
      const ed = this.bookEditions.find((e) => e.id === copy.edition_id);
      const bt = ed ? this.bookTitles.find((t) => t.id === ed.title_id) : null;
      return {
        rows: [
          {
            ...copy,
            title_id: ed?.title_id || null,
            publisher: ed?.publisher || '',
            title_name: bt?.title || '',
          } as unknown as T,
        ],
        rowCount: 1,
      };
    }

    // 25. book_copies barcode duplicate check
    if (cleanSql.startsWith('SELECT id FROM book_copies WHERE barcode = $1')) {
      const copy = this.bookCopies.find((c) => c.barcode === params[0]);
      return { rows: copy ? [{ id: copy.id } as unknown as T] : [], rowCount: copy ? 1 : 0 };
    }

    // 26. book_copies INSERT
    if (cleanSql.startsWith('INSERT INTO book_copies')) {
      const copy = {
        id: `mock-copy-${this.bookCopies.length + 1}`,
        edition_id: params[0],
        barcode: params[1],
        location: params[2],
        status: params[3],
        cover_price: params[4],
        condition_note: params[5],
        created_at: new Date().toISOString(),
      };
      this.bookCopies.push(copy);
      return { rows: [{ ...copy } as unknown as T], rowCount: 1 };
    }

    // 27. book_copies SELECT by ID (FOR UPDATE)
    if (cleanSql.includes('FROM book_copies bc') && cleanSql.includes('WHERE bc.id = $1')) {
      const copy = this.bookCopies.find((c) => c.id === params[0]);
      if (!copy) return { rows: [], rowCount: 0 };
      const ed = this.bookEditions.find((e) => e.id === copy.edition_id);
      const bt = ed ? this.bookTitles.find((t) => t.id === ed.title_id) : null;
      return {
        rows: [
          {
            ...copy,
            title_id: ed?.title_id || null,
            publisher: ed?.publisher || '',
            title_name: bt?.title || '',
          } as unknown as T,
        ],
        rowCount: 1,
      };
    }

    // 28. book_copies UPDATE metadata
    if (cleanSql.startsWith('UPDATE book_copies SET location = $2')) {
      const copy = this.bookCopies.find((c) => c.id === params[0]);
      if (copy) {
        copy.location = params[1];
        copy.cover_price = params[2];
        copy.condition_note = params[3];
        return { rows: [{ ...copy } as unknown as T], rowCount: 1 };
      }
    }

    // 29. book_copies UPDATE status ARCHIVED
    if (cleanSql.startsWith("UPDATE book_copies SET status = 'ARCHIVED' WHERE id = $1")) {
      const copy = this.bookCopies.find((c) => c.id === params[0]);
      if (copy) {
        copy.status = 'ARCHIVED';
        return { rows: [{ ...copy } as unknown as T], rowCount: 1 };
      }
    }

    // 30. borrowers search COUNT
    if (cleanSql.startsWith('SELECT COUNT(*) AS total FROM borrowers b')) {
      const filtered = this.borrowers.filter((b) => {
        if (!cleanSql.includes('is_archived = FALSE') || !b.is_archived) return true;
        return false;
      });
      return { rows: [{ total: filtered.length.toString() } as unknown as T], rowCount: 1 };
    }

    // 31. borrowers search SELECT
    if (cleanSql.startsWith('SELECT b.id, b.full_name, b.student_id, b.school, b.phone, b.email, b.notes, b.is_archived, b.created_at FROM borrowers b')) {
      const q = params[0] ? params[0].toLowerCase() : '';
      const filtered = this.borrowers.filter((b) => {
        if (cleanSql.includes('b.is_archived = FALSE') && b.is_archived) return false;
        if (q) {
          return (
            b.phone.includes(q) ||
            (b.student_id && b.student_id.toLowerCase().includes(q)) ||
            b.full_name.toLowerCase().includes(q)
          );
        }
        return true;
      });
      return { rows: filtered as unknown as T[], rowCount: filtered.length };
    }

    // 32. borrowers SELECT by ID (FOR UPDATE or normal)
    if (cleanSql.includes('FROM borrowers') && cleanSql.includes('WHERE id = $1')) {
      const b = this.borrowers.find((item) => item.id === params[0]);
      return { rows: b ? [{ ...b } as unknown as T] : [], rowCount: b ? 1 : 0 };
    }

    // 33. borrowers INSERT
    if (cleanSql.startsWith('INSERT INTO borrowers')) {
      const borrower = {
        id: `mock-borrower-${this.borrowers.length + 1}`,
        full_name: params[0],
        student_id: params[1],
        school: params[2],
        phone: params[3],
        email: params[4],
        notes: params[5],
        is_archived: false,
        created_at: new Date().toISOString(),
      };
      this.borrowers.push(borrower);
      return { rows: [{ ...borrower } as unknown as T], rowCount: 1 };
    }

    // 34. borrowers UPDATE
    if (cleanSql.startsWith('UPDATE borrowers SET full_name = $2')) {
      const b = this.borrowers.find((item) => item.id === params[0]);
      if (b) {
        b.full_name = params[1];
        b.student_id = params[2];
        b.school = params[3];
        b.phone = params[4];
        b.email = params[5];
        b.notes = params[6];
        return { rows: [{ ...b } as unknown as T], rowCount: 1 };
      }
    }

    // 35. loan_receipts active check
    if (cleanSql.includes('FROM loan_receipts') && (cleanSql.includes('borrower_id = $1') || cleanSql.includes('lr.borrower_id = $1'))) {
      const activeLoan = this.loanReceipts.find(
        (l) =>
          l.borrower_id === params[0] &&
          (l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIAL_SETTLED')
      );
      return { rows: activeLoan ? [{ id: activeLoan.id, status: activeLoan.status } as unknown as T] : [], rowCount: activeLoan ? 1 : 0 };
    }

    // 36. borrowers ARCHIVE
    if (cleanSql.startsWith('UPDATE borrowers SET is_archived = TRUE WHERE id = $1')) {
      const b = this.borrowers.find((item) => item.id === params[0]);
      if (b) {
        b.is_archived = true;
        return { rows: [{ ...b } as unknown as T], rowCount: 1 };
      }
    }

    // 37. book_copies SELECT by ANY(ids)
    if (cleanSql.includes('FROM book_copies bc') && cleanSql.includes('WHERE bc.id = ANY($1)')) {
      const ids: string[] = params[0] || [];
      const copies = this.bookCopies
        .filter((c) => ids.includes(c.id))
        .sort((a, b) => a.id.localeCompare(b.id));
      const rows = copies.map((c) => {
        const ed = this.bookEditions.find((e) => e.id === c.edition_id);
        const bt = ed ? this.bookTitles.find((t) => t.id === ed.title_id) : null;
        return {
          id: c.id,
          barcode: c.barcode,
          location: c.location,
          status: c.status,
          cover_price: c.cover_price !== null && c.cover_price !== undefined ? c.cover_price : null,
          edition_id: c.edition_id,
          publisher: ed?.publisher || '',
          title_id: ed?.title_id || '',
          title: bt?.title || '',
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 38. book_copies SELECT id, barcode WHERE barcode = ANY($1)
    if (cleanSql.includes('SELECT id, barcode FROM book_copies WHERE barcode = ANY($1)')) {
      const barcodes: string[] = params[0] || [];
      const matches = this.bookCopies
        .filter((c) => barcodes.includes(c.barcode))
        .map((c) => ({ id: c.id, barcode: c.barcode }));
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // 39. book_copies UPDATE status = 'BORROWED' or 'AVAILABLE'
    if (cleanSql.startsWith("UPDATE book_copies SET status = 'BORROWED' WHERE id = $1")) {
      const copy = this.bookCopies.find((c) => c.id === params[0]);
      if (copy) {
        copy.status = 'BORROWED';
      }
      return { rows: [], rowCount: copy ? 1 : 0 };
    }

    if (cleanSql.includes("UPDATE book_copies SET status = 'AVAILABLE'")) {
      const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
      let updated = 0;
      for (const copy of this.bookCopies) {
        if (ids.includes(copy.id)) {
          copy.status = 'AVAILABLE';
          updated++;
        }
      }
      return { rows: [], rowCount: updated };
    }

    if (cleanSql.includes("UPDATE book_copies") && cleanSql.includes("status = 'LOST'")) {
      const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
      let updated = 0;
      for (const copy of this.bookCopies) {
        if (ids.includes(copy.id)) {
          copy.status = 'LOST';
          updated++;
        }
      }
      return { rows: [], rowCount: updated };
    }

    // 40. cash_sessions UPDATE expected_closing_cash
    if (cleanSql.includes('UPDATE cash_sessions') && cleanSql.includes('expected_closing_cash = expected_closing_cash + $2')) {
      const [sessionId, amount] = params;
      const s = this.cashSessions.find((cs) => cs.id === sessionId);
      if (s) {
        s.expected_closing_cash = (BigInt(s.expected_closing_cash || 0) + BigInt(amount)).toString();
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    if (cleanSql.includes('UPDATE cash_sessions') && cleanSql.includes('expected_closing_cash = expected_closing_cash - $2')) {
      const [sessionId, amount] = params;
      const s = this.cashSessions.find((cs) => cs.id === sessionId);
      if (s) {
        s.expected_closing_cash = (BigInt(s.expected_closing_cash || 0) - BigInt(amount)).toString();
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    // 41. loan_items unreturned check
    if (cleanSql.includes('FROM loan_items WHERE copy_id = ANY($1)') && cleanSql.includes('returned_at IS NULL')) {
      const ids: string[] = params[0] || [];
      const activeItems = this.loanItems.filter(
        (li) => ids.includes(li.copy_id) && !li.returned_at && !li.is_lost && !li.carried_forward_at
      );
      return { rows: activeItems.map((li) => ({ copy_id: li.copy_id })) as unknown as T[], rowCount: activeItems.length };
    }

    // 42. loan_items INSERT
    if (cleanSql.startsWith('INSERT INTO loan_items')) {
      const activeExisting = this.loanItems.find(
        (li) => li.copy_id === params[1] && !li.returned_at && !li.is_lost && !li.carried_forward_at
      );
      if (activeExisting) {
        const err: any = new Error(
          `duplicate key value violates unique constraint "idx_unique_active_copy_loan" (Key (copy_id)=(${params[1]}) already exists)`
        );
        err.code = '23505';
        throw err;
      }

      const item = {
        id: `mock-item-${this.loanItems.length + 1}`,
        receipt_id: params[0],
        copy_id: params[1],
        deposit_snapshot: params[2],
        returned_at: null,
        is_lost: false,
        carried_forward_at: null,
        successor_item_id: null,
      };
      this.loanItems.push(item);
      return { rows: [{ ...item } as unknown as T], rowCount: 1 };
    }

    // 43. loan_items SELECT for receipt
    if (cleanSql.includes('FROM loan_items li') && cleanSql.includes('WHERE li.receipt_id = $1')) {
      const items = this.loanItems.filter((li) => li.receipt_id === params[0]);
      const rows = items.map((li) => {
        const copy = this.bookCopies.find((c) => c.id === li.copy_id);
        const ed = copy ? this.bookEditions.find((e) => e.id === copy.edition_id) : null;
        const bt = ed ? this.bookTitles.find((t) => t.id === ed.title_id) : null;
        return {
          id: li.id,
          copy_id: li.copy_id,
          deposit_snapshot: li.deposit_snapshot,
          returned_at: li.returned_at,
          is_lost: li.is_lost,
          carried_forward_at: li.carried_forward_at || null,
          successor_item_id: li.successor_item_id || null,
          barcode: copy?.barcode || '',
          cover_price: copy?.cover_price !== null && copy?.cover_price !== undefined ? copy.cover_price : null,
          publisher: ed?.publisher || '',
          title: bt?.title || '',
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 44. loan_receipts INSERT
    if (cleanSql.startsWith('INSERT INTO loan_receipts')) {
      const hasPreceding = cleanSql.includes('preceding_receipt_id');
      const receipt = {
        id: `mock-receipt-${this.loanReceipts.length + 1}`,
        receipt_number: params[0],
        borrower_id: params[1],
        borrow_date: params[2],
        due_date: params[3],
        renew_count: 0,
        status: cleanSql.includes("'PENDING_DEPOSIT'") ? 'PENDING_DEPOSIT' : 'ACTIVE',
        preceding_receipt_id: hasPreceding ? params[4] : null,
        created_by: hasPreceding ? params[5] : params[4],
        notes: (hasPreceding ? params[6] : params[5]) || null,
        created_at: new Date().toISOString(),
      };
      this.loanReceipts.push(receipt);
      return { rows: [{ ...receipt } as unknown as T], rowCount: 1 };
    }

    // loan_items UPDATE carried_forward_at
    if (cleanSql.includes('UPDATE loan_items SET carried_forward_at =')) {
      const itemId = params[0];
      const timestamp = params[1] || new Date().toISOString();
      const successorId = params[2] || null;
      const item = this.loanItems.find((li) => li.id === itemId);
      if (item) {
        item.carried_forward_at = timestamp;
        if (successorId) {
          item.successor_item_id = successorId;
        }
      }
      return { rows: [], rowCount: item ? 1 : 0 };
    }

    // loan_items UPDATE successor_item_id
    if (cleanSql.includes('UPDATE loan_items SET successor_item_id =')) {
      const itemId = params[0];
      const successorId = params[1] || null;
      const item = this.loanItems.find((li) => li.id === itemId);
      if (item) {
        item.successor_item_id = successorId;
      }
      return { rows: [], rowCount: item ? 1 : 0 };
    }

    // loan_items UPDATE returned_at
    if (cleanSql.includes('UPDATE loan_items SET returned_at =')) {
      if (cleanSql.includes('WHERE id = ANY($1)')) {
        const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
        const timestamp = params[1] || new Date().toISOString();
        let count = 0;
        for (const item of this.loanItems) {
          if (ids.includes(item.id)) {
            item.returned_at = timestamp;
            count++;
          }
        }
        return { rows: [], rowCount: count };
      }

      const targetId = params[0];
      const timestamp = params[1] || new Date().toISOString();
      let count = 0;
      if (cleanSql.includes('WHERE id = $1')) {
        const item = this.loanItems.find((li) => li.id === targetId);
        if (item) {
          item.returned_at = timestamp;
          count++;
        }
      } else {
        for (const item of this.loanItems) {
          if (item.receipt_id === targetId && !item.returned_at && !item.carried_forward_at) {
            item.returned_at = timestamp;
            count++;
          }
        }
      }
      return { rows: [], rowCount: count };
    }

    // loan_items UPDATE is_lost (Lost Book - Chặng 11)
    if (cleanSql.includes('UPDATE loan_items') && cleanSql.includes('is_lost = TRUE')) {
      const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
      const reason = params[1] || 'LOST';
      let count = 0;
      for (const item of this.loanItems) {
        if (ids.includes(item.id)) {
          item.is_lost = true;
          item.lost_at = new Date().toISOString();
          item.lost_reason = reason;
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    // loan_receipts UPDATE due_date & renew_count
    if (cleanSql.includes('UPDATE loan_receipts') && cleanSql.includes('due_date = $2, renew_count = $3')) {
      const [receiptId, newDueDate, newRenewCount] = params;
      const r = this.loanReceipts.find((lr) => lr.id === receiptId);
      if (r) {
        r.due_date = newDueDate;
        r.renew_count = newRenewCount;
        r.status = 'ACTIVE';
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // loan_receipts UPDATE due_date only (S10-03: Calendar Holiday Shift)
    if (cleanSql.includes('UPDATE loan_receipts') && cleanSql.includes('SET due_date = $2 WHERE id = $1')) {
      const [receiptId, newDueDate] = params;
      const r = this.loanReceipts.find((lr) => lr.id === receiptId);
      if (r) {
        r.due_date = newDueDate;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // loan_receipts UPDATE status
    if (cleanSql.includes('UPDATE loan_receipts SET status =') && cleanSql.includes('WHERE id = $1')) {
      const r = this.loanReceipts.find((lr) => lr.id === params[0]);
      if (r) {
        if (cleanSql.includes("'RETURNED'")) {
          r.status = 'RETURNED';
        } else if (cleanSql.includes("'PARTIAL_SETTLED'")) {
          r.status = 'PARTIAL_SETTLED';
        } else if (cleanSql.includes("'PENDING_DEPOSIT'")) {
          r.status = 'PENDING_DEPOSIT';
        } else if (cleanSql.includes("'ACTIVE'")) {
          r.status = 'ACTIVE';
        } else if (cleanSql.includes("'LOST'")) {
          r.status = 'LOST';
        } else {
          r.status = params[1] || r.status;
        }
      }
      return { rows: [], rowCount: r ? 1 : 0 };
    }

    // loan_settlements INSERT
    if (cleanSql.startsWith('INSERT INTO loan_settlements')) {
      let settlement: any;
      const hasExplicitId = cleanSql.includes('(id,') || cleanSql.includes('( id,');
      const offset = hasExplicitId ? 1 : 0;
      const idVal = hasExplicitId ? params[0] : `mock-settlement-${this.loanSettlements.length + 1}`;
      if (cleanSql.includes('fine_pending_amount')) {
        settlement = {
          id: idVal,
          receipt_id: params[offset + 0],
          settlement_type: params[offset + 1],
          return_date: params[offset + 2],
          overdue_days: params[offset + 3],
          fine_suggested: params[offset + 4],
          fine_final: params[offset + 5],
          fine_reason: params[offset + 6] || null,
          fine_collected: params[offset + 7],
          fine_pending_amount: params[offset + 8] || '0',
          fine_status: params[offset + 9] || 'COLLECTED',
          fine_payment_method: params[offset + 10] || null,
          total_deposit: params[offset + 11],
          deposit_refunded: params[offset + 12],
          deposit_forfeited: params[offset + 13],
          deposit_transferred: params[offset + 14] || '0',
          new_deposit_collected: params[offset + 15] || '0',
          successor_receipt_id: params[offset + 16] || null,
          cash_session_id: params[offset + 17] || null,
          settled_by: params[offset + 18],
          settled_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      } else {
        settlement = {
          id: idVal,
          receipt_id: params[offset + 0],
          settlement_type: params[offset + 1],
          return_date: params[offset + 2],
          overdue_days: params[offset + 3],
          fine_suggested: params[offset + 4],
          fine_final: params[offset + 5],
          fine_reason: params[offset + 6] || null,
          fine_collected: params[offset + 7],
          fine_pending_amount: '0',
          fine_status: 'COLLECTED',
          fine_payment_method: params[offset + 8] || null,
          total_deposit: params[offset + 9],
          deposit_refunded: params[offset + 10],
          deposit_forfeited: params[offset + 11],
          deposit_transferred: params[offset + 12] || '0',
          new_deposit_collected: params[offset + 13] || '0',
          successor_receipt_id: params[offset + 14] || null,
          cash_session_id: params[offset + 15] || null,
          settled_by: params[offset + 16],
          settled_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      }
      this.loanSettlements.push(settlement);
      return { rows: [{ ...settlement } as unknown as T], rowCount: 1 };
    }

    // loan_settlements SELECT (by id and receipt_id)
    if (cleanSql.includes('FROM loan_settlements') && cleanSql.includes('WHERE id = $1 AND receipt_id = $2')) {
      const s = this.loanSettlements.find((ls) => ls.id === params[0] && ls.receipt_id === params[1]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // loan_settlements SELECT (by id directly)
    if (cleanSql.includes('FROM loan_settlements') && cleanSql.includes('WHERE id = $1')) {
      const s = this.loanSettlements.find((ls) => ls.id === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // loan_settlements SELECT (by receipt_id, pending fine check, or detail)
    if (cleanSql.includes('FROM loan_settlements') && cleanSql.includes("fine_status = 'PENDING'") && cleanSql.includes('receipt_id = $1')) {
      const s = this.loanSettlements.find((ls) => ls.receipt_id === params[0] && ls.fine_status === 'PENDING');
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    if (cleanSql.includes('FROM loan_settlements') && cleanSql.includes('WHERE receipt_id = $1')) {
      const s = this.loanSettlements.find((ls) => ls.receipt_id === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // loan_settlements UPDATE fine_collected
    if (cleanSql.startsWith('UPDATE loan_settlements SET fine_collected =')) {
      const id = params[0];
      const newCollected = params[1];
      const newPending = params[2];
      const newStatus = cleanSql.includes("fine_status = 'PENDING'") ? 'PENDING' : (params[3] || 'PENDING');
      const s = this.loanSettlements.find((ls) => ls.id === id);
      if (s) {
        s.fine_collected = newCollected;
        s.fine_pending_amount = newPending;
        s.fine_status = newStatus;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // loan_renewals INSERT
    if (cleanSql.startsWith('INSERT INTO loan_renewals')) {
      const hasExplicitId = cleanSql.includes('(id,') || cleanSql.includes('( id,');
      const offset = hasExplicitId ? 1 : 0;
      const idVal = hasExplicitId ? params[0] : `mock-rnw-${this.loanRenewals.length + 1}`;
      const receiptId = params[offset + 0];
      const seq = params[offset + 1];
      const existing = this.loanRenewals.find((r) => r.receipt_id === receiptId && Number(r.renewal_sequence) === Number(seq));
      if (existing) {
        const err: any = new Error(`duplicate key value violates unique constraint "uq_receipt_renewal_sequence"`);
        err.code = '23505';
        throw err;
      }
      const rnw = {
        id: idVal,
        receipt_id: params[offset + 0],
        renewal_sequence: params[offset + 1],
        renewed_at: params[offset + 2],
        renewed_by: params[offset + 3],
        previous_due_date: params[offset + 4],
        new_due_date: params[offset + 5],
        original_new_due_date: params[offset + 6],
        adjustment_reason: params[offset + 7] || null,
        is_overdue: params[offset + 8],
        overdue_days: params[offset + 9],
        fine_suggested: params[offset + 10],
        fine_final: params[offset + 11],
        fine_reason: params[offset + 12] || null,
        fine_collected: params[offset + 13],
        fine_pending_amount: params[offset + 14],
        fine_status: params[offset + 15],
        fine_payment_method: params[offset + 16] || null,
        cash_session_id: params[offset + 17] || null,
        notes: params[offset + 18] || null,
        created_at: new Date().toISOString(),
      };
      this.loanRenewals.push(rnw);
      return { rows: [{ ...rnw } as unknown as T], rowCount: 1 };
    }

    // loan_renewals SELECT (by id and receipt_id)
    if (cleanSql.includes('FROM loan_renewals') && cleanSql.includes('WHERE id = $1 AND receipt_id = $2')) {
      const r = this.loanRenewals.find((rn) => rn.id === params[0] && rn.receipt_id === params[1]);
      return { rows: r ? [{ ...r } as unknown as T] : [], rowCount: r ? 1 : 0 };
    }

    // loan_renewals SELECT (by id directly)
    if (cleanSql.includes('FROM loan_renewals') && cleanSql.includes('WHERE id = $1')) {
      const r = this.loanRenewals.find((rn) => rn.id === params[0]);
      return { rows: r ? [{ ...r } as unknown as T] : [], rowCount: r ? 1 : 0 };
    }

    // loan_renewals SELECT pending fine
    if (cleanSql.includes('FROM loan_renewals') && cleanSql.includes("fine_status = 'PENDING'") && cleanSql.includes('receipt_id = $1')) {
      const r = this.loanRenewals
        .filter((rn) => rn.receipt_id === params[0] && rn.fine_status === 'PENDING')
        .sort((a, b) => Number(b.renewal_sequence) - Number(a.renewal_sequence));
      return { rows: r.length > 0 ? [{ ...r[0] } as unknown as T] : [], rowCount: r.length > 0 ? 1 : 0 };
    }

    // loan_renewals SELECT history
    if (cleanSql.includes('FROM loan_renewals WHERE receipt_id = $1') || (cleanSql.includes('FROM loan_renewals') && cleanSql.includes('WHERE receipt_id = $1'))) {
      const list = this.loanRenewals
        .filter((r) => r.receipt_id === params[0])
        .sort((a, b) => Number(a.renewal_sequence) - Number(b.renewal_sequence));
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // loan_renewals UPDATE fine_collected
    if (cleanSql.startsWith('UPDATE loan_renewals SET fine_collected =')) {
      const id = params[0];
      const newCollected = params[1];
      const newPending = params[2];
      const newStatus = cleanSql.includes("fine_status = 'PENDING'") ? 'PENDING' : (params[3] || 'PENDING');
      const r = this.loanRenewals.find((rn) => rn.id === id);
      if (r) {
        r.fine_collected = newCollected;
        r.fine_pending_amount = newPending;
        r.fine_status = newStatus;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // calendar_holidays INSERT
    if (cleanSql.startsWith('INSERT INTO calendar_holidays')) {
      const [holidayDate, name, description] = params;
      let h = this.calendarHolidays.find((x) => x.holiday_date === holidayDate);
      if (h) {
        h.name = name;
        h.description = description || null;
      } else {
        h = {
          holiday_date: holidayDate,
          name,
          description: description || null,
          created_at: new Date().toISOString(),
        };
        this.calendarHolidays.push(h);
      }
      return { rows: [{ ...h } as unknown as T], rowCount: 1 };
    }

    // calendar_holidays SELECT
    if (cleanSql.includes('FROM calendar_holidays')) {
      return { rows: this.calendarHolidays as unknown as T[], rowCount: this.calendarHolidays.length };
    }

    // loan_receipts SELECT by ID (simple / FOR UPDATE)
    if (cleanSql.includes('FROM loan_receipts') && cleanSql.includes('WHERE id = $1') && !cleanSql.includes('JOIN borrowers')) {
      const r = this.loanReceipts.find((lr) => lr.id === params[0]);
      return { rows: r ? [{ ...r } as unknown as T] : [], rowCount: r ? 1 : 0 };
    }

    // loan_receipts SELECT active/overdue for calendar shift
    if (cleanSql.includes('FROM loan_receipts') && cleanSql.includes("status IN ('ACTIVE', 'OVERDUE')")) {
      const active = this.loanReceipts.filter((lr) => lr.status === 'ACTIVE' || lr.status === 'OVERDUE');
      return { rows: active.map((r) => ({ ...r })) as unknown as T[], rowCount: active.length };
    }

    // 45. loan_receipts SELECT by ID (detail)
    if (cleanSql.includes('FROM loan_receipts lr JOIN borrowers b ON b.id = lr.borrower_id WHERE lr.id = $1')) {
      const r = this.loanReceipts.find((lr) => lr.id === params[0]);
      if (!r) return { rows: [], rowCount: 0 };
      const b = this.borrowers.find((bw) => bw.id === r.borrower_id);
      return {
        rows: [
          {
            id: r.id,
            receipt_number: r.receipt_number,
            borrow_date: r.borrow_date,
            due_date: r.due_date,
            renew_count: r.renew_count || 0,
            status: r.status,
            created_by: r.created_by,
            created_at: r.created_at,
            notes: r.notes || null,
            borrower_id: b?.id || r.borrower_id,
            borrower_name: b?.full_name || '',
            borrower_phone: b?.phone || '',
          } as unknown as T,
        ],
        rowCount: 1,
      };
    }

    // 46. loan_receipts COUNT
    if (cleanSql.startsWith('SELECT COUNT(*) AS total FROM loan_receipts lr')) {
      let filtered = this.loanReceipts;
      if (cleanSql.includes('lr.borrower_id = $1')) {
        filtered = filtered.filter((l) => l.borrower_id === params[0]);
      }
      return { rows: [{ total: filtered.length.toString() } as unknown as T], rowCount: 1 };
    }

    // 47. loan_receipts SELECT IDs list
    if (cleanSql.startsWith('SELECT lr.id FROM loan_receipts lr')) {
      let filtered = this.loanReceipts;
      if (cleanSql.includes('lr.borrower_id = $1')) {
        filtered = filtered.filter((l) => l.borrower_id === params[0]);
      }
      return { rows: filtered.map((l) => ({ id: l.id })) as unknown as T[], rowCount: filtered.length };
    }

    // 48. deposit_allocations SELECT by receipt_id
    if (cleanSql.includes('FROM deposit_allocations') && cleanSql.includes('WHERE receipt_id = $1')) {
      let allocs = this.depositAllocations.filter((da) => da.receipt_id === params[0]);
      if (cleanSql.includes('item_id = ANY($2)') && params[1]) {
        const itemIds = Array.isArray(params[1]) ? params[1] : [params[1]];
        allocs = allocs.filter((da) => da.item_id === null || itemIds.includes(da.item_id));
      }
      return {
        rows: allocs.map((alloc) => ({
          id: alloc.id,
          receipt_id: alloc.receipt_id,
          item_id: alloc.item_id,
          fund_id: alloc.fund_id,
          original_amount: alloc.original_amount,
          remaining_amount: alloc.remaining_amount,
          status: alloc.status,
          payment_method: alloc.payment_method,
          refund_method: alloc.refund_method,
        })) as unknown as T[],
        rowCount: allocs.length,
      };
    }

    // deposit_allocations JOIN journal_entries for cash_session_id
    if (cleanSql.includes('FROM deposit_allocations da') && cleanSql.includes('JOIN journal_entries je')) {
      const receiptId = params[0];
      const allocIds = this.depositAllocations.filter((a) => a.receipt_id === receiptId).map((a) => a.id);
      const je = this.journalEntries.find(
        (e) => (e.source_type === 'LOAN_DEPOSIT' || e.source_type === 'LOAN_DEPOSIT_REFUND') && allocIds.includes(e.source_id) && e.cash_session_id
      );
      return { rows: je ? [{ cash_session_id: je.cash_session_id } as unknown as T] : [], rowCount: je ? 1 : 0 };
    }

    // refund_intents ri JOIN deposit_allocations da JOIN loan_receipts lr (listPendingRefunds)
    if (cleanSql.includes('FROM refund_intents ri') && cleanSql.includes('JOIN deposit_allocations da') && cleanSql.includes('JOIN loan_receipts lr')) {
      const pendingIntents = this.refundIntents.filter((i) => i.status === 'PENDING');
      const rows = pendingIntents.map((intent) => {
        const alloc = this.depositAllocations.find((a) => a.id === intent.allocation_id);
        const receipt = alloc ? this.loanReceipts.find((r) => r.id === alloc.receipt_id) : null;
        const reader = receipt ? this.borrowers.find((b) => b.id === receipt.borrower_id) : null;
        return {
          id: intent.id,
          allocation_id: intent.allocation_id,
          amount: intent.amount,
          refund_method: intent.refund_method,
          status: intent.status,
          created_at: intent.created_at || new Date().toISOString(),
          requested_by: intent.requested_by,
          receipt_id: receipt?.id || '',
          receipt_number: receipt?.receipt_number || '',
          borrower_name: reader?.full_name || 'Bạn đọc',
          borrower_student_id: reader?.student_id || '',
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // refund_intents ri JOIN deposit_allocations da
    if (cleanSql.includes('FROM refund_intents ri') && cleanSql.includes('JOIN deposit_allocations da')) {
      const receiptId = params[0];
      const allocIds = this.depositAllocations.filter((a) => a.receipt_id === receiptId).map((a) => a.id);
      const intents = this.refundIntents.filter((i) => allocIds.includes(i.allocation_id));
      return { rows: intents as unknown as T[], rowCount: intents.length };
    }

    // loan_receipts lr ... WHERE lr.status = 'PENDING_DEPOSIT' (listPendingDeposits)
    if (cleanSql.includes('FROM loan_receipts lr') && cleanSql.includes("WHERE lr.status = 'PENDING_DEPOSIT'")) {
      const receipts = this.loanReceipts.filter((r) => r.status === 'PENDING_DEPOSIT');
      const rows = receipts.map((r) => {
        const reader = this.borrowers.find((b) => b.id === r.borrower_id);
        const alloc = this.depositAllocations.find((a) => a.receipt_id === r.id && a.status === 'PENDING_COLLECTION');
        const item = this.loanItems.find((li) => li.receipt_id === r.id);
        const copy = item ? this.bookCopies.find((c) => c.id === item.copy_id) : null;
        let titleName = '';
        if (copy) {
          const ed = copy.edition_id ? this.bookEditions.find((e) => e.id === copy.edition_id) : null;
          const bt = ed ? this.bookTitles.find((t) => t.id === ed.title_id) : null;
          titleName = bt?.title || this.bookTitles.find((t) => t.id === copy.book_id)?.title || '';
        }
        return {
          id: r.id,
          receipt_number: r.receipt_number,
          borrow_date: r.borrow_date,
          due_date: r.due_date,
          created_at: r.created_at || new Date().toISOString(),
          borrower_name: reader?.full_name || 'Bạn đọc',
          borrower_student_id: reader?.student_id || '',
          allocation_id: alloc?.id || '',
          original_amount: alloc?.original_amount || 0,
          payment_method: alloc?.payment_method || 'CASH',
          barcode: copy?.barcode || '',
          title: titleName,
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // loan_settlements ls ... WHERE ls.fine_status = 'PENDING' (listPendingFines)
    if (cleanSql.includes('FROM loan_settlements ls') && (cleanSql.includes('UNION ALL') || cleanSql.includes("ls.fine_status = 'PENDING'"))) {
      const settlements = this.loanSettlements.filter((s) => s.fine_status === 'PENDING');
      const sRows = settlements.map((s) => {
        const receipt = this.loanReceipts.find((r) => r.id === s.receipt_id);
        const reader = receipt ? this.borrowers.find((b) => b.id === receipt.borrower_id) : null;
        return {
          target_id: s.id,
          settlement_id: s.id,
          source_type: 'SETTLEMENT',
          receipt_id: s.receipt_id,
          fine_pending_amount: s.fine_pending_amount || 0,
          fine_reason: s.fine_reason || null,
          settled_at: s.settled_at || new Date().toISOString(),
          created_at: s.settled_at || new Date().toISOString(),
          receipt_number: receipt?.receipt_number || '',
          borrower_name: reader?.full_name || 'Bạn đọc',
          borrower_student_id: reader?.student_id || '',
        };
      });
      const renewals = this.loanRenewals.filter((r) => r.fine_status === 'PENDING');
      const rRows = renewals.map((rn) => {
        const receipt = this.loanReceipts.find((r) => r.id === rn.receipt_id);
        const reader = receipt ? this.borrowers.find((b) => b.id === receipt.borrower_id) : null;
        return {
          target_id: rn.id,
          settlement_id: rn.id,
          source_type: 'RENEWAL',
          receipt_id: rn.receipt_id,
          fine_pending_amount: rn.fine_pending_amount || 0,
          fine_reason: rn.fine_reason || null,
          settled_at: rn.renewed_at || new Date().toISOString(),
          created_at: rn.renewed_at || new Date().toISOString(),
          receipt_number: receipt?.receipt_number || '',
          borrower_name: reader?.full_name || 'Bạn đọc',
          borrower_student_id: reader?.student_id || '',
        };
      });
      const rows = [...sRows, ...rRows];
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 49. system_audit_logs INSERT
    if (cleanSql.startsWith('INSERT INTO system_audit_logs')) {
      const log = {
        id: `audit-${this.systemAuditLogs.length + 1}`,
        actor_id: params[0],
        action: params[1],
        target_resource: params[2],
        target_id: params[3],
        details: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
        created_at: new Date().toISOString(),
      };
      this.systemAuditLogs.push(log);
      return { rows: [{ ...log } as unknown as T], rowCount: 1 };
    }

    // 50. idempotency_records SELECT (by composite key or single key)
    if (cleanSql.includes('FROM idempotency_records WHERE')) {
      let rec: any = null;
      if (cleanSql.includes('actor_id = $1 AND operation = $2 AND idempotency_key = $3')) {
        rec = this.idempotencyRecords.find(
          (r) => r.actor_id === params[0] && r.operation === params[1] && r.idempotency_key === params[2]
        );
      } else if (cleanSql.includes('idempotency_key = $1')) {
        rec = this.idempotencyRecords.find((r) => r.idempotency_key === params[0]);
      }
      return { rows: rec ? [{ ...rec } as unknown as T] : [], rowCount: rec ? 1 : 0 };
    }

    // 51. idempotency_records INSERT
    if (cleanSql.startsWith('INSERT INTO idempotency_records')) {
      // Xác định thứ tự cột từ câu lệnh
      let actorId = params[0];
      let operation = params[1];
      let idempotencyKey = params[2];
      let payloadHash = params[3];

      if (cleanSql.includes('(idempotency_key,')) {
        idempotencyKey = params[0];
        actorId = params[1];
        operation = params[2];
        payloadHash = params[3];
      }

      const existing = this.idempotencyRecords.find(
        (r) => r.actor_id === actorId && r.operation === operation && r.idempotency_key === idempotencyKey
      );

      if (existing) {
        if (cleanSql.includes('DO NOTHING')) {
          return { rows: [], rowCount: 0 };
        }
      }

      const rec = {
        id: `idemp-${this.idempotencyRecords.length + 1}`,
        idempotency_key: idempotencyKey,
        actor_id: actorId,
        operation: operation,
        payload_hash: payloadHash,
        status: 'PROCESSING',
        response_code: null,
        response_body: null,
        expires_at: params[4] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.idempotencyRecords.push(rec);
      return { rows: [{ ...rec } as unknown as T], rowCount: 1 };
    }

    // 52. idempotency_records UPDATE
    if (cleanSql.startsWith('UPDATE idempotency_records SET status =')) {
      let rec: any = null;
      if (cleanSql.includes('actor_id = $1 AND operation = $2 AND idempotency_key = $3')) {
        rec = this.idempotencyRecords.find(
          (r) => r.actor_id === params[0] && r.operation === params[1] && r.idempotency_key === params[2]
        );
        if (rec) {
          if (cleanSql.includes("status = 'COMPLETED'")) {
            rec.status = 'COMPLETED';
            rec.response_code = params[3];
            rec.response_body = typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4];
          } else if (cleanSql.includes("status = 'FAILED'")) {
            rec.status = 'FAILED';
          } else if (cleanSql.includes("status = 'PROCESSING'")) {
            rec.status = 'PROCESSING';
          }
          rec.updated_at = new Date().toISOString();
          return { rows: [{ ...rec } as unknown as T], rowCount: 1 };
        }
      } else {
        rec = this.idempotencyRecords.find((r) => r.idempotency_key === params[0]);
        if (rec) {
          rec.status = 'COMPLETED';
          rec.response_code = params[1];
          rec.response_body = typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2];
          rec.updated_at = new Date().toISOString();
          return { rows: [{ ...rec } as unknown as T], rowCount: 1 };
        }
      }
    }

    // 53. idempotency_records DELETE
    if (cleanSql.startsWith('DELETE FROM idempotency_records')) {
      if (cleanSql.includes('actor_id = $1 AND operation = $2 AND idempotency_key = $3')) {
        this.idempotencyRecords = this.idempotencyRecords.filter(
          (r) => !(r.actor_id === params[0] && r.operation === params[1] && r.idempotency_key === params[2])
        );
      } else {
        this.idempotencyRecords = this.idempotencyRecords.filter((r) => r.idempotency_key !== params[0]);
      }
      return { rows: [], rowCount: 1 };
    }

    // 54. authors INSERT
    if (cleanSql.startsWith('INSERT INTO authors')) {
      let a = this.authors.find((x) => x.name.toLowerCase() === params[0].toLowerCase());
      if (!a) {
        a = { id: `auth-${this.authors.length + 1}`, name: params[0] };
        this.authors.push(a);
      }
      return { rows: [{ ...a } as unknown as T], rowCount: 1 };
    }

    // 55. categories INSERT
    if (cleanSql.startsWith('INSERT INTO categories')) {
      let c = this.categories.find((x) => x.name.toLowerCase() === params[0].toLowerCase());
      if (!c) {
        c = { id: `cat-${this.categories.length + 1}`, name: params[0] };
        this.categories.push(c);
      }
      return { rows: [{ ...c } as unknown as T], rowCount: 1 };
    }

    // 56. book_title_authors / book_title_categories INSERT
    if (cleanSql.startsWith('INSERT INTO book_title_authors') || cleanSql.startsWith('INSERT INTO book_title_categories')) {
      return { rows: [], rowCount: 1 };
    }

    // 57. book_titles INSERT
    if (cleanSql.startsWith('INSERT INTO book_titles')) {
      const title = {
        id: `mock-title-${this.bookTitles.length + 1}`,
        title: params[0],
        original_title: params[1],
        description: params[2],
        authors: [],
        categories: [],
        created_at: new Date().toISOString(),
      };
      this.bookTitles.push(title);
      return { rows: [{ ...title } as unknown as T], rowCount: 1 };
    }

    // 58. book_editions INSERT
    if (cleanSql.startsWith('INSERT INTO book_editions')) {
      const ed = {
        id: `mock-ed-${this.bookEditions.length + 1}`,
        title_id: params[0],
        publisher: params[1],
        publish_year: params[2],
        isbn: params[3],
        cover_image_url: params[4],
        created_at: new Date().toISOString(),
      };
      this.bookEditions.push(ed);
      return { rows: [{ ...ed } as unknown as T], rowCount: 1 };
    }

    // 59. members SELECT by id
    if (cleanSql.includes('FROM members WHERE id = $1')) {
      const m = this.members.find((x) => x.id === params[0]);
      return { rows: m ? [{ ...m } as unknown as T] : [], rowCount: m ? 1 : 0 };
    }

    // 60. members UPDATE has_paid_fee
    if (cleanSql.startsWith('UPDATE members SET has_paid_fee = TRUE WHERE id = $1')) {
      const m = this.members.find((x) => x.id === params[0]);
      if (m) {
        m.has_paid_fee = true;
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    // 61. members headcount counts
    if (cleanSql.includes('SELECT COUNT(DISTINCT id) as cnt FROM members WHERE is_active = TRUE AND is_alumni = FALSE')) {
      const cnt = this.members.filter((m) => m.is_active && !m.is_alumni).length;
      return { rows: [{ cnt }] as unknown as T[], rowCount: 1 };
    }
    if (cleanSql.includes('SELECT COUNT(DISTINCT id) as cnt FROM members WHERE is_alumni = TRUE')) {
      const cnt = this.members.filter((m) => m.is_alumni).length;
      return { rows: [{ cnt }] as unknown as T[], rowCount: 1 };
    }
    if (cleanSql.includes('SELECT COUNT(DISTINCT id) as cnt FROM members')) {
      const cnt = this.members.length;
      return { rows: [{ cnt }] as unknown as T[], rowCount: 1 };
    }

    // 62. member_affiliations SELECT by member_id
    if (cleanSql.includes('FROM member_affiliations WHERE member_id = $1')) {
      const affs = this.memberAffiliations.filter((a) => a.member_id === params[0]);
      return { rows: affs.map((a) => ({ ...a })) as unknown as T[], rowCount: affs.length };
    }

    // 63. member_affiliations UPDATE end_date / is_current
    if (cleanSql.startsWith('UPDATE member_affiliations SET end_date = $1, is_current = FALSE')) {
      const [endDate, memberId, dept] = params;
      let count = 0;
      for (const a of this.memberAffiliations) {
        if (a.member_id === memberId && a.department === dept && a.is_current) {
          a.end_date = endDate;
          a.is_current = false;
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    // 64. member_affiliations INSERT
    if (cleanSql.startsWith('INSERT INTO member_affiliations')) {
      const aff = {
        id: `aff-${this.memberAffiliations.length + 1}`,
        member_id: params[0],
        department: params[1],
        role: params[2],
        term_year: params[3],
        start_date: params[4],
        end_date: null,
        is_current: true,
        notes: params[5] || null,
        created_at: new Date().toISOString(),
      };
      this.memberAffiliations.push(aff);
      return { rows: [{ ...aff } as unknown as T], rowCount: 1 };
    }

    // 65. member_affiliations GROUP BY department
    if (cleanSql.includes('FROM member_affiliations WHERE is_current = TRUE GROUP BY department')) {
      const deptMap: Record<string, Set<string>> = {};
      for (const a of this.memberAffiliations) {
        if (a.is_current) {
          if (!deptMap[a.department]) deptMap[a.department] = new Set();
          deptMap[a.department].add(a.member_id);
        }
      }
      const rows = Object.entries(deptMap).map(([department, set]) => ({
        department,
        cnt: set.size,
      }));
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 66. member_affiliations HAVING COUNT(DISTINCT department) > 1
    if (cleanSql.includes('FROM member_affiliations WHERE is_current = TRUE GROUP BY member_id HAVING COUNT(DISTINCT department) > 1')) {
      const memberDepts: Record<string, Set<string>> = {};
      for (const a of this.memberAffiliations) {
        if (a.is_current) {
          if (!memberDepts[a.member_id]) memberDepts[a.member_id] = new Set();
          memberDepts[a.member_id].add(a.department);
        }
      }
      const rows = Object.entries(memberDepts)
        .filter(([_, depts]) => depts.size > 1)
        .map(([member_id, depts]) => ({ member_id, dept_cnt: depts.size }));
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 67. membership_dues_receipts SELECT
    if (cleanSql.includes('FROM membership_dues_receipts WHERE member_id = $1')) {
      const r = this.membershipDuesReceipts.find((x) => x.member_id === params[0]);
      return { rows: r ? [{ ...r } as unknown as T] : [], rowCount: r ? 1 : 0 };
    }
    if (cleanSql.includes('FROM membership_dues_receipts mdr JOIN members m ON m.id = mdr.member_id WHERE mdr.member_id = $1')) {
      const r = this.membershipDuesReceipts.find((x) => x.member_id === params[0]);
      if (r) {
        const m = this.members.find((x) => x.id === r.member_id);
        return {
          rows: [{ ...r, member_name: m?.full_name || '' } as unknown as T],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // 68. membership_dues_receipts SELECT COUNT(*) by LIKE
    if (cleanSql.includes('FROM membership_dues_receipts WHERE receipt_number LIKE $1')) {
      const prefix = String(params[0]).replace('%', '');
      const cnt = this.membershipDuesReceipts.filter((x) => x.receipt_number.startsWith(prefix)).length;
      return { rows: [{ cnt }] as unknown as T[], rowCount: 1 };
    }

    // 69. membership_dues_receipts INSERT
    if (cleanSql.startsWith('INSERT INTO membership_dues_receipts')) {
      const receipt = {
        id: `due-rcp-${this.membershipDuesReceipts.length + 1}`,
        receipt_number: params[0],
        member_id: params[1],
        amount: params[2],
        payment_method: params[3],
        payment_confirmed: true,
        cash_session_id: params[4] || null,
        journal_entry_id: params[5] || null,
        collected_by: params[6],
        collected_at: new Date().toISOString(),
        term_label: params[7],
        notes: params[8] || null,
        created_at: new Date().toISOString(),
      };
      this.membershipDuesReceipts.push(receipt);
      return { rows: [{ ...receipt } as unknown as T], rowCount: 1 };
    }

    // 70. duty_availability_batches MAX version
    if (cleanSql.includes('SELECT COALESCE(MAX(version), 0) AS max_ver FROM duty_availability_batches WHERE term_semester = $1')) {
      const sem = params[0];
      const matched = this.dutyAvailabilityBatches.filter((b) => b.term_semester === sem);
      const max_ver = matched.length > 0 ? Math.max(...matched.map((b) => Number(b.version || 0))) : 0;
      return { rows: [{ max_ver }] as unknown as T[], rowCount: 1 };
    }

    // 71. duty_availability_batches UPDATE status SUPERSEDED
    if (cleanSql.startsWith('UPDATE duty_availability_batches SET status =') && cleanSql.includes("status = 'COMMITTED'")) {
      const sem = params[0];
      for (const b of this.dutyAvailabilityBatches) {
        if (b.term_semester === sem && b.status === 'COMMITTED') {
          b.status = 'SUPERSEDED';
        }
      }
      return { rows: [], rowCount: 1 };
    }

    // 72. member_busy_intervals UPDATE is_active = FALSE by superseded batches
    if (cleanSql.startsWith('UPDATE member_busy_intervals SET is_active = FALSE')) {
      const sem = params[0];
      const supersededBatchIds = this.dutyAvailabilityBatches
        .filter((b) => b.term_semester === sem && b.status === 'SUPERSEDED')
        .map((b) => b.id);
      for (const it of this.memberBusyIntervals) {
        if (supersededBatchIds.includes(it.batch_id)) {
          it.is_active = false;
        }
      }
      return { rows: [], rowCount: 1 };
    }

    // 73. duty_availability_batches INSERT
    if (cleanSql.startsWith('INSERT INTO duty_availability_batches')) {
      const batch = {
        id: params[0],
        batch_name: params[1],
        file_name: params[2],
        file_hash: params[3],
        file_size_bytes: params[4],
        term_semester: params[5],
        version: params[6],
        status: 'COMMITTED',
        total_rows: params[7],
        valid_rows: params[8],
        error_rows: params[9],
        imported_by: params[10],
        created_at: new Date().toISOString(),
      };
      this.dutyAvailabilityBatches.push(batch);
      return { rows: [{ ...batch } as unknown as T], rowCount: 1 };
    }

    // 74. member_busy_intervals INSERT
    if (cleanSql.startsWith('INSERT INTO member_busy_intervals')) {
      const interval = {
        id: params[0],
        batch_id: params[1],
        member_id: params[2],
        day_of_week: params[3],
        start_time: params[4],
        end_time: params[5],
        busy_type: params[6],
        effective_start_date: params[7],
        effective_end_date: params[8],
        notes: params[9] || null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      this.memberBusyIntervals.push(interval);
      return { rows: [{ ...interval } as unknown as T], rowCount: 1 };
    }

    // 75. duty_availability_batches SELECT list
    if (cleanSql.includes('FROM duty_availability_batches')) {
      let list = [...this.dutyAvailabilityBatches];
      if (cleanSql.includes('WHERE term_semester = $1')) {
        list = list.filter((b) => b.term_semester === params[0]);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // 76. member_busy_intervals SELECT for member
    if (cleanSql.includes('FROM member_busy_intervals mbi') && cleanSql.includes('WHERE mbi.member_id = $1')) {
      const mId = params[0];
      const member = this.members.find((m) => m.id === mId);
      const list = this.memberBusyIntervals
        .filter((it) => it.member_id === mId && (!cleanSql.includes('mbi.is_active = TRUE') || it.is_active))
        .map((it) => ({
          ...it,
          member_name: member?.full_name || '',
        }));
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // 77. members & published duty counts (getMemberCandidates)
    if (cleanSql.includes('FROM members m') && cleanSql.includes('duty_schedule_assignees dsa')) {
      const rows = this.members.map((m) => {
        const publishedAssignees = this.dutyScheduleAssignees.filter((a) => {
          const sched = this.dutySchedules.find((s) => s.id === a.schedule_id);
          return a.member_id === m.id && sched?.status === 'PUBLISHED';
        });
        const mainCount = publishedAssignees.filter((a) => a.duty_type === 'MAIN').length;
        const supportCount = publishedAssignees.filter((a) => a.duty_type === 'SUPPORT').length;
        const isActive = m.is_active !== undefined 
          ? Boolean(m.is_active) 
          : (m.status ? (m.status === 'ACTIVE' || m.status === 'HOAT_DONG') : true);
        const isEligibleMain = m.is_eligible_main_duty !== undefined 
          ? Boolean(m.is_eligible_main_duty) 
          : (m.is_eligible_main !== undefined ? Boolean(m.is_eligible_main) : false);
        return {
          id: m.id,
          full_name: m.full_name,
          username: m.username,
          is_active: isActive,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          is_alumni: Boolean(m.is_alumni),
          is_eligible_main: isEligibleMain,
          is_eligible_main_duty: isEligibleMain,
          main_count: mainCount,
          support_count: supportCount,
        };
      });
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // 78. member_busy_intervals with batch term_semester
    if (cleanSql.includes('FROM member_busy_intervals mbi') && cleanSql.includes('JOIN duty_availability_batches dab')) {
      const term = params[0];
      const dayOfWeek = params[1];
      let list = this.memberBusyIntervals.filter((it) => {
        const batch = this.dutyAvailabilityBatches.find((b) => b.id === it.batch_id);
        return (!batch || batch.term_semester === term) && it.is_active;
      });
      if (dayOfWeek) {
        list = list.filter((it) => it.day_of_week === dayOfWeek);
      }
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // 79. calendar_holidays query
    if (cleanSql.includes('FROM calendar_holidays')) {
      return { rows: this.calendarHolidays as unknown as T[], rowCount: this.calendarHolidays.length };
    }

    // 80. duty_schedules SELECT for date
    if (cleanSql.includes('FROM duty_schedules') && cleanSql.includes('WHERE schedule_date = $1')) {
      const found = this.dutySchedules.filter((s) => {
        const dStr = typeof s.schedule_date === 'string' ? s.schedule_date.substring(0, 10) : new Date(s.schedule_date).toISOString().substring(0, 10);
        return dStr === params[0];
      });
      return { rows: found as unknown as T[], rowCount: found.length };
    }

    // 81. duty_schedules INSERT ON CONFLICT
    if (cleanSql.startsWith('INSERT INTO duty_schedules')) {
      const id = params[0];
      const term_semester = params[1];
      const schedule_date = params[2];
      const day_of_week = params[3];
      const shift_time = params[4];
      const location = params[5];
      const status = params[6];
      const version = params[7];
      const warning_main = params[8];
      const warning_support = params[9];
      const facebook_post_content = params[10];

      const existingIdx = this.dutySchedules.findIndex((s) => {
        const dStr = typeof s.schedule_date === 'string' ? s.schedule_date.substring(0, 10) : new Date(s.schedule_date).toISOString().substring(0, 10);
        return dStr === schedule_date;
      });

      const rec = {
        id,
        term_semester,
        schedule_date,
        day_of_week,
        shift_time,
        location,
        status,
        version,
        published_version: null,
        published_at: null,
        published_by: null,
        warning_main,
        warning_support,
        is_manually_edited: false,
        facebook_post_content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.dutySchedules[existingIdx] = { ...this.dutySchedules[existingIdx], ...rec, id: this.dutySchedules[existingIdx].id };
      } else {
        this.dutySchedules.push(rec);
      }
      return { rows: [rec as unknown as T], rowCount: 1 };
    }

    // 82. duty_schedule_assignees DELETE for schedule
    if (cleanSql.startsWith('DELETE FROM duty_schedule_assignees WHERE schedule_id = $1')) {
      const initialLen = this.dutyScheduleAssignees.length;
      this.dutyScheduleAssignees = this.dutyScheduleAssignees.filter((a) => a.schedule_id !== params[0]);
      return { rows: [], rowCount: initialLen - this.dutyScheduleAssignees.length };
    }

    // 83. duty_schedule_assignees INSERT
    if (cleanSql.startsWith('INSERT INTO duty_schedule_assignees')) {
      const rec = {
        id: params[0],
        schedule_id: params[1],
        member_id: params[2],
        duty_type: params[3],
        assigned_role: params[4],
        attendance_status: params[5] || 'SCHEDULED',
        notes: params[6] || null,
        created_at: new Date().toISOString(),
      };
      this.dutyScheduleAssignees.push(rec);
      return { rows: [rec as unknown as T], rowCount: 1 };
    }

    // 84. duty_schedules SELECT by ID
    if (cleanSql.includes('FROM duty_schedules') && cleanSql.includes('WHERE id = $1')) {
      const s = this.dutySchedules.find((x) => x.id === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // 85. duty_schedule_assignees SELECT by schedule_id with member info
    if (cleanSql.includes('FROM duty_schedule_assignees dsa') && cleanSql.includes('JOIN members m')) {
      const list = this.dutyScheduleAssignees
        .filter((a) => a.schedule_id === params[0])
        .map((a) => {
          const m = this.members.find((mem) => mem.id === a.member_id);
          return {
            ...a,
            member_name: m?.full_name || '',
            member_student_id: m?.student_id || null,
          };
        });
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // 86. duty_schedules UPDATE
    if (cleanSql.startsWith('UPDATE duty_schedules')) {
      const id = params[params.length - 1];
      const s = this.dutySchedules.find((x) => x.id === id);
      if (s) {
        if (cleanSql.includes('SET version = $1')) {
          s.version = params[0];
          s.shift_time = params[1];
          s.location = params[2];
          s.warning_main = params[3];
          s.warning_support = params[4];
          s.is_manually_edited = true;
          s.facebook_post_content = params[5];
          s.updated_at = new Date().toISOString();
        } else if (cleanSql.includes("SET status = 'PUBLISHED'")) {
          s.status = 'PUBLISHED';
          s.published_version = s.version;
          s.published_at = new Date().toISOString();
          s.published_by = params[0];
          s.updated_at = new Date().toISOString();
        }
        return { rows: [{ ...s } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 87. duty_schedule_assignees UPDATE attendance
    if (cleanSql.startsWith('UPDATE duty_schedule_assignees')) {
      const att = params[0];
      const notes = params[1];
      const schedId = params[2];
      const memId = params[3];
      const a = this.dutyScheduleAssignees.find((x) => x.schedule_id === schedId && x.member_id === memId);
      if (a) {
        a.attendance_status = att;
        if (notes !== undefined && notes !== null) a.notes = notes;
        return { rows: [{ ...a } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 88. duty_schedules SELECT list
    if (cleanSql.startsWith('SELECT id FROM duty_schedules WHERE 1=1')) {
      let list = [...this.dutySchedules];
      if (cleanSql.includes('AND term_semester = $1')) {
        list = list.filter((s) => s.term_semester === params[0]);
      }
      if (cleanSql.includes('AND status = $2')) {
        list = list.filter((s) => s.status === params[1]);
      } else if (cleanSql.includes('AND status = $1')) {
        list = list.filter((s) => s.status === params[0]);
      }
      return { rows: list.map((s) => ({ id: s.id })) as unknown as T[], rowCount: list.length };
    }

    // 89. recruitment_forms SELECT by ID
    if (cleanSql.includes('FROM recruitment_forms WHERE id = $1')) {
      const f = this.recruitmentForms.find((x) => x.id === params[0]);
      return { rows: f ? [{ ...f } as unknown as T] : [], rowCount: f ? 1 : 0 };
    }

    // 90. recruitment_forms INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_forms')) {
      const rec = {
        id: params[0],
        title: params[1],
        term_semester: '2026.1',
        is_active: true,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.recruitmentForms.push(rec);
      return { rows: [{ ...rec } as unknown as T], rowCount: 1 };
    }

    // 91. recruitment_form_responses SELECT by (form_id, response_id) or single ID
    if (cleanSql.includes('FROM recruitment_form_responses WHERE form_id = $1 AND response_id = $2')) {
      const resp = this.recruitmentFormResponses.find(
        (x) => x.form_id === params[0] && x.response_id === params[1]
      );
      return { rows: resp ? [{ ...resp } as unknown as T] : [], rowCount: resp ? 1 : 0 };
    }

    if (cleanSql.includes('FROM recruitment_form_responses') && (cleanSql.includes('WHERE id = $1') || cleanSql.includes('WHERE r.id = $1'))) {
      const resp = this.recruitmentFormResponses.find((x) => x.id === params[0]);
      if (!resp) return { rows: [], rowCount: 0 };
      const form = resp.form_id ? this.recruitmentForms.find((f) => f.id === resp.form_id) : undefined;
      return {
        rows: [{
          ...resp,
          form_title: form?.title,
          term_semester: form?.term_semester,
        } as unknown as T],
        rowCount: 1,
      };
    }

    if (cleanSql.includes('SELECT response_id FROM recruitment_form_responses WHERE form_id = $1')) {
      const list = this.recruitmentFormResponses
        .filter((x) => x.form_id === params[0])
        .map((x) => ({ response_id: x.response_id }));
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // 92. recruitment_form_responses INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_form_responses')) {
      const rec = {
        id: params[0],
        form_id: params[1],
        response_id: params[2],
        submission_timestamp: params[3],
        applicant_name: params[4],
        applicant_student_id: params[5] || null,
        applicant_email: params[6],
        applicant_phone: params[7] || null,
        aspiration_1: params[8],
        aspiration_2: params[9] || null,
        why_join: params[10] || null,
        essay_content: params[11] || null,
        cv_link: params[12] || null,
        raw_answers: params[13] || '{}',
        sync_status: 'SYNCED',
        last_observed_at: new Date().toISOString(),
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.recruitmentFormResponses.push(rec);
      return { rows: [{ ...rec } as unknown as T], rowCount: 1 };
    }

    // 93. recruitment_form_responses UPDATE
    if (cleanSql.startsWith('UPDATE recruitment_form_responses')) {
      if (cleanSql.includes('SET last_observed_at = NOW() WHERE id = $1')) {
        const id = params[0];
        const r = this.recruitmentFormResponses.find((x) => x.id === id);
        if (r) {
          r.last_observed_at = new Date().toISOString();
          return { rows: [{ ...r } as unknown as T], rowCount: 1 };
        }
      } else if (cleanSql.includes('SET applicant_name = $1')) {
        const id = params[11];
        const r = this.recruitmentFormResponses.find((x) => x.id === id);
        if (r) {
          r.applicant_name = params[0];
          r.applicant_student_id = params[1];
          r.applicant_email = params[2];
          r.applicant_phone = params[3];
          r.aspiration_1 = params[4];
          r.aspiration_2 = params[5];
          r.why_join = params[6];
          r.essay_content = params[7];
          r.cv_link = params[8];
          r.raw_answers = params[9];
          r.version = params[10];
          r.last_observed_at = new Date().toISOString();
          r.updated_at = new Date().toISOString();
          return { rows: [{ ...r } as unknown as T], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // 94. recruitment_reconciliation_checkpoints INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_reconciliation_checkpoints')) {
      const chk = {
        id: params[0],
        form_id: params[1],
        last_synced_at: new Date().toISOString(),
        total_responses_observed: params[2],
        missing_responses_count: params[3],
        status: params[4],
        details: params[5],
        created_at: new Date().toISOString(),
      };
      this.recruitmentReconciliationCheckpoints.push(chk);
      return { rows: [{ ...chk } as unknown as T], rowCount: 1 };
    }

    // 95. recruitment_form_responses SELECT list (Search & Filters)
    if (cleanSql.startsWith('SELECT * FROM recruitment_form_responses WHERE 1=1')) {
      let list = [...this.recruitmentFormResponses];
      // Tùy theo filter nếu có
      return { rows: list as unknown as T[], rowCount: list.length };
    }

    // 96. recruitment_evaluations SELECT by response_id
    if (cleanSql.includes('FROM recruitment_evaluations WHERE response_id = $1')) {
      const evals = this.recruitmentEvaluations.filter((x) => x.response_id === params[0]);
      return { rows: evals as unknown as T[], rowCount: evals.length };
    }

    // 97. recruitment_rubrics SELECT MAX(version)
    if (cleanSql.includes('SELECT MAX(version) as max_ver FROM recruitment_rubrics WHERE campaign_id = $1')) {
      const filtered = this.recruitmentRubrics.filter((r) => r.campaign_id === params[0]);
      const max_ver = filtered.length > 0 ? Math.max(...filtered.map((r) => Number(r.version || 1))) : null;
      return { rows: [{ max_ver }] as unknown as T[], rowCount: 1 };
    }

    // 98. recruitment_rubrics INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_rubrics')) {
      const rubric = {
        id: params[0],
        campaign_id: params[1],
        version: params[2],
        title: params[3],
        formula_type: params[4],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.recruitmentRubrics.push(rubric);
      return { rows: [{ ...rubric } as unknown as T], rowCount: 1 };
    }

    // 99. recruitment_rubric_criteria INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_rubric_criteria')) {
      const crit = {
        id: params[0],
        rubric_id: params[1],
        code: params[2],
        name: params[3],
        description: params[4],
        section: params[5],
        min_score: params[6],
        max_score: params[7],
        weight: params[8],
        sort_order: params[9],
        created_at: new Date().toISOString(),
      };
      this.recruitmentRubricCriteria.push(crit);
      return { rows: [{ ...crit } as unknown as T], rowCount: 1 };
    }

    // 100. recruitment_rubrics SELECT by id
    if (cleanSql.includes('FROM recruitment_rubrics WHERE id = $1')) {
      const r = this.recruitmentRubrics.find((x) => x.id === params[0]);
      return { rows: r ? [{ ...r } as unknown as T] : [], rowCount: r ? 1 : 0 };
    }

    // 101. recruitment_rubric_criteria SELECT by rubric_id
    if (cleanSql.includes('FROM recruitment_rubric_criteria WHERE rubric_id = $1')) {
      const crits = this.recruitmentRubricCriteria
        .filter((c) => c.rubric_id === params[0])
        .sort((a, b) => a.sort_order - b.sort_order);
      return { rows: crits as unknown as T[], rowCount: crits.length };
    }

    // 102. recruitment_evaluations INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_evaluations')) {
      const ev = {
        id: params[0],
        response_id: params[1],
        evaluator_id: params[2],
        rubric_id: params[3],
        evaluation_type: params[4],
        raw_scores: params[5],
        total_score: params[6],
        formula_status: params[7],
        interview_notes: params[8],
        status: params[9],
        decision: params[10],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.recruitmentEvaluations.push(ev);
      return { rows: [{ ...ev } as unknown as T], rowCount: 1 };
    }

    // 103. recruitment_evaluations SELECT by id
    if (cleanSql.includes('FROM recruitment_evaluations WHERE id = $1')) {
      const ev = this.recruitmentEvaluations.find((x) => x.id === params[0]);
      return { rows: ev ? [{ ...ev } as unknown as T] : [], rowCount: ev ? 1 : 0 };
    }

    // 104. recruitment_evaluation_history INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_evaluation_history')) {
      const h = {
        id: params[0],
        evaluation_id: params[1],
        modified_by: params[2],
        modified_at: new Date().toISOString(),
        reason: params[3],
        previous_state: params[4],
        new_state: params[5],
        previous_version: params[6],
        new_version: params[7],
        created_at: new Date().toISOString(),
      };
      this.recruitmentEvaluationHistory.push(h);
      return { rows: [{ ...h } as unknown as T], rowCount: 1 };
    }

    // 105. recruitment_evaluations UPDATE (editEvaluation)
    if (cleanSql.startsWith('UPDATE recruitment_evaluations SET raw_scores = $1')) {
      const id = params[6];
      const ev = this.recruitmentEvaluations.find((x) => x.id === id);
      if (ev) {
        ev.raw_scores = params[0];
        ev.total_score = params[1];
        ev.formula_status = params[2];
        ev.interview_notes = params[3];
        ev.decision = params[4];
        ev.version = params[5];
        ev.updated_at = new Date().toISOString();
        return { rows: [{ ...ev } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 106. recruitment_evaluation_history SELECT by evaluation_id
    if (cleanSql.includes('FROM recruitment_evaluation_history WHERE evaluation_id = $1')) {
      const hist = this.recruitmentEvaluationHistory
        .filter((x) => x.evaluation_id === params[0])
        .sort((a, b) => a.previous_version - b.previous_version);
      return { rows: hist as unknown as T[], rowCount: hist.length };
    }

    // 107. recruitment_decisions SELECT by response_id
    if (cleanSql.includes('FROM recruitment_decisions WHERE response_id = $1')) {
      const dec = this.recruitmentDecisions.find((x) => x.response_id === params[0]);
      return { rows: dec ? [{ ...dec } as unknown as T] : [], rowCount: dec ? 1 : 0 };
    }

    // 108. recruitment_decisions INSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_decisions')) {
      const dec = {
        id: params[0],
        response_id: params[1],
        decision: params[2],
        assigned_department: params[3],
        committee_notes: params[4],
        decided_by: params[5],
        decided_at: new Date().toISOString(),
        is_converted_to_member: false,
        converted_member_id: null,
        converted_at: null,
      };
      this.recruitmentDecisions.push(dec);
      return { rows: [{ ...dec } as unknown as T], rowCount: 1 };
    }

    // 109. recruitment_decisions UPDATE decision
    if (cleanSql.startsWith('UPDATE recruitment_decisions SET decision = $1')) {
      const respId = params[4];
      const dec = this.recruitmentDecisions.find((x) => x.response_id === respId);
      if (dec) {
        dec.decision = params[0];
        dec.assigned_department = params[1];
        dec.committee_notes = params[2];
        dec.decided_by = params[3];
        dec.decided_at = new Date().toISOString();
        return { rows: [{ ...dec } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 110. recruitment_decisions UPDATE is_converted_to_member
    if (cleanSql.startsWith('UPDATE recruitment_decisions SET is_converted_to_member = TRUE')) {
      const decId = params[1];
      const dec = this.recruitmentDecisions.find((x) => x.id === decId);
      if (dec) {
        dec.is_converted_to_member = true;
        dec.converted_member_id = params[0];
        dec.converted_at = new Date().toISOString();
        return { rows: [{ ...dec } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 111. members SELECT by id OR username
    if (cleanSql.includes('FROM members WHERE id = $1 OR username = $2')) {
      const m = this.members.find((x) => x.id === params[0] || x.username === params[1]);
      return { rows: m ? [{ ...m } as unknown as T] : [], rowCount: m ? 1 : 0 };
    }
    if (cleanSql.includes('FROM members WHERE username = $1')) {
      const m = this.members.find((x) => x.username === params[0]);
      return { rows: m ? [{ ...m } as unknown as T] : [], rowCount: m ? 1 : 0 };
    }

    // 112. members INSERT
    if (cleanSql.startsWith('INSERT INTO members')) {
      let id = params[0];
      let fullName = params[1];
      let username = params[2];
      let gen = 'Gen 10';
      let team = 'HAU_CAN';
      let roleTitle = 'Thành viên';
      let schoolYear = 'K68';
      let phone = '0900000000';

      if (cleanSql.includes('gen,')) {
        gen = params[3];
        team = params[4];
        roleTitle = params[5];
        schoolYear = params[6];
        phone = params[7];
      } else {
        team = params[3];
        roleTitle = params[4];
        schoolYear = params[5];
        phone = params[6];
      }

      const mem = {
        id,
        full_name: fullName,
        username,
        gen,
        team,
        role_title: roleTitle,
        school_year: schoolYear,
        phone,
        is_eligible_main_duty: false,
        has_paid_fee: false,
        is_alumni: false,
        is_admin: false,
        is_active: true,
        token_version: 1,
        created_at: new Date().toISOString(),
      };
      this.members.push(mem);
      return { rows: [{ ...mem } as unknown as T], rowCount: 1 };
    }

    // 113. recruitment_public_announcements INSERT / UPSERT
    if (cleanSql.startsWith('INSERT INTO recruitment_public_announcements')) {
      const existing = this.recruitmentPublicAnnouncements.find(
        (x) => x.campaign_id === params[1] && x.candidate_code === params[3]
      );
      if (existing) {
        existing.passed_department = params[4];
        existing.is_approved_for_public = true;
        existing.approved_by = params[5];
        existing.approved_at = new Date().toISOString();
        return { rows: [{ ...existing } as unknown as T], rowCount: 1 };
      }
      const pub = {
        id: params[0],
        campaign_id: params[1],
        response_id: params[2],
        candidate_code: params[3],
        passed_department: params[4],
        is_approved_for_public: true,
        approved_by: params[5],
        approved_at: new Date().toISOString(),
      };
      this.recruitmentPublicAnnouncements.push(pub);
      return { rows: [{ ...pub } as unknown as T], rowCount: 1 };
    }

    // 114. recruitment_public_announcements SELECT public approved
    if (cleanSql.includes('FROM recruitment_public_announcements WHERE campaign_id = $1 AND is_approved_for_public = TRUE')) {
      const pubs = this.recruitmentPublicAnnouncements.filter(
        (x) => x.campaign_id === params[0] && x.is_approved_for_public === true
      );
      return { rows: pubs as unknown as T[], rowCount: pubs.length };
    }

    // 115. book_suppliers SELECT by code
    if (cleanSql.includes('FROM book_suppliers WHERE code = $1')) {
      const s = this.bookSuppliers.find((x) => x.code === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // 116. book_suppliers INSERT
    if (cleanSql.startsWith('INSERT INTO book_suppliers')) {
      const sup = {
        id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: params[0],
        name: params[1],
        contact_person: params[2],
        phone: params[3],
        email: params[4],
        address: params[5],
        notes: params[6],
        is_active: true,
        created_at: new Date().toISOString(),
      };
      this.bookSuppliers.push(sup);
      return { rows: [{ ...sup } as unknown as T], rowCount: 1 };
    }

    // 117. book_suppliers SELECT all
    if (cleanSql.includes('FROM book_suppliers') && !cleanSql.includes('WHERE')) {
      return { rows: [...this.bookSuppliers] as unknown as T[], rowCount: this.bookSuppliers.length };
    }

    // 118. book_suppliers SELECT by id
    if (cleanSql.includes('FROM book_suppliers WHERE id = $1')) {
      const s = this.bookSuppliers.find((x) => x.id === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // 119. consignment_lots SELECT by batch_code
    if (cleanSql.includes('FROM consignment_lots WHERE batch_code = $1')) {
      const lot = this.consignmentLots.find((x) => x.batch_code === params[0]);
      return { rows: lot ? [{ ...lot } as unknown as T] : [], rowCount: lot ? 1 : 0 };
    }

    // 120. consignment_lots INSERT
    if (cleanSql.startsWith('INSERT INTO consignment_lots')) {
      const lot = {
        id: `lot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        batch_code: params[0],
        supplier_id: params[1],
        campaign_name: params[2],
        received_date: params[3],
        target_settlement_date: params[4],
        deposit_amount: params[5],
        deposit_refunded: 0,
        deposit_status: params[6],
        status: 'ACTIVE',
        created_by: params[7],
        notes: params[8],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.consignmentLots.push(lot);
      return { rows: [{ ...lot } as unknown as T], rowCount: 1 };
    }

    // 121. consignment_lot_items INSERT
    if (cleanSql.startsWith('INSERT INTO consignment_lot_items')) {
      const item = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        lot_id: params[0],
        title_id: params[1],
        book_title: params[2],
        isbn: params[3],
        cover_price: params[4],
        import_discount_percent: params[5],
        import_price: params[6],
        retail_price: params[7],
        initial_quantity: params[8],
        sold_quantity: 0,
        returned_quantity: 0,
        retained_quantity: 0,
        available_quantity: params[8],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.consignmentLotItems.push(item);
      return { rows: [{ ...item } as unknown as T], rowCount: 1 };
    }

    // 122. consignment_lots JOIN book_suppliers SELECT
    if (cleanSql.includes('FROM consignment_lots l') && cleanSql.includes('JOIN book_suppliers s ON l.supplier_id = s.id')) {
      if (cleanSql.includes('WHERE l.id = $1')) {
        const lot = this.consignmentLots.find((x) => x.id === params[0]);
        if (!lot) return { rows: [], rowCount: 0 };
        const sup = this.bookSuppliers.find((x) => x.id === lot.supplier_id);
        return {
          rows: [{ ...lot, supplier_name: sup?.name || 'Nhà sách đối tác' } as unknown as T],
          rowCount: 1,
        };
      }
      if (cleanSql.includes('WHERE l.supplier_id = $1')) {
        const lots = this.consignmentLots.filter((x) => x.supplier_id === params[0]);
        const sup = this.bookSuppliers.find((x) => x.id === params[0]);
        const res = lots.map((l) => ({ ...l, supplier_name: sup?.name || 'Nhà sách' }));
        return { rows: res as unknown as T[], rowCount: res.length };
      }
      const res = this.consignmentLots.map((l) => {
        const sup = this.bookSuppliers.find((x) => x.id === l.supplier_id);
        return { ...l, supplier_name: sup?.name || 'Nhà sách' };
      });
      return { rows: res as unknown as T[], rowCount: res.length };
    }

    // 123. consignment_lot_items SELECT WHERE lot_id = $1
    if (cleanSql.includes('FROM consignment_lot_items') && cleanSql.includes('WHERE lot_id = $1')) {
      const items = this.consignmentLotItems.filter((x) => x.lot_id === params[0]);
      return { rows: items as unknown as T[], rowCount: items.length };
    }

    // 123b. consignment_lot_items SELECT WHERE id = $1
    if (cleanSql.includes('FROM consignment_lot_items') && cleanSql.includes('WHERE id = $1')) {
      const item = this.consignmentLotItems.find((x) => x.id === params[0]);
      if (!item) return { rows: [], rowCount: 0 };
      const lot = this.consignmentLots.find((x) => x.id === item.lot_id);
      return {
        rows: [{ ...item, lot_status: lot?.status || 'ACTIVE' } as unknown as T],
        rowCount: 1,
      };
    }

    // 124. consignment_lot_items JOIN consignment_lots SELECT FOR UPDATE
    if (cleanSql.includes('FROM consignment_lot_items i') && cleanSql.includes('JOIN consignment_lots l') && cleanSql.includes('WHERE i.id = $1')) {
      const item = this.consignmentLotItems.find((x) => x.id === params[0]);
      if (!item) return { rows: [], rowCount: 0 };
      const lot = this.consignmentLots.find((x) => x.id === item.lot_id);
      return {
        rows: [{ ...item, lot_status: lot?.status || 'ACTIVE' } as unknown as T],
        rowCount: 1,
      };
    }

    // 125. book_sales INSERT
    if (cleanSql.startsWith('INSERT INTO book_sales')) {
      const sale = {
        id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sale_code: params[0],
        lot_item_id: params[1],
        cash_session_id: params[2],
        customer_name: params[3],
        customer_phone: params[4],
        quantity: params[5],
        unit_price: params[6],
        sale_discount_percent: params[7],
        total_amount: params[8],
        payment_method: params[9],
        payment_status: 'PAID',
        created_by: params[10],
        created_at: new Date().toISOString(),
      };
      this.bookSales.push(sale);
      return { rows: [{ ...sale } as unknown as T], rowCount: 1 };
    }

    // 126. consignment_lot_items UPDATE sale quantity
    if (cleanSql.startsWith('UPDATE consignment_lot_items SET available_quantity = available_quantity - $1, sold_quantity = sold_quantity + $1')) {
      const item = this.consignmentLotItems.find((x) => x.id === params[1]);
      if (item) {
        item.available_quantity -= params[0];
        item.sold_quantity += params[0];
        item.updated_at = new Date().toISOString();
        return { rows: [{ ...item } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 127. cash_sessions UPDATE expected_closing_cash for sale
    if (cleanSql.startsWith('UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + $1 WHERE id = $2 AND is_closed = FALSE')) {
      const session = this.cashSessions.find((x) => x.id === params[1] && x.is_closed === false);
      if (session) {
        session.expected_closing_cash = Number(session.expected_closing_cash) + Number(params[0]);
        return { rows: [{ ...session } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 128. consignment_lot_items SELECT for return
    if (cleanSql.includes('FROM consignment_lot_items WHERE id = $1 AND lot_id = $2 FOR UPDATE')) {
      const item = this.consignmentLotItems.find((x) => x.id === params[0] && x.lot_id === params[1]);
      return { rows: item ? [{ ...item } as unknown as T] : [], rowCount: item ? 1 : 0 };
    }

    // 129. consignment_returns INSERT
    if (cleanSql.startsWith('INSERT INTO consignment_returns')) {
      const ret = {
        id: `ret-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        return_code: params[0],
        lot_id: params[1],
        lot_item_id: params[2],
        returned_quantity: params[3],
        return_date: params[4],
        recipient_name: params[5],
        proof_notes: params[6],
        created_by: params[7],
        created_at: new Date().toISOString(),
      };
      this.consignmentReturns.push(ret);
      return { rows: [{ ...ret } as unknown as T], rowCount: 1 };
    }

    // 130. consignment_lot_items UPDATE returned quantity
    if (cleanSql.startsWith('UPDATE consignment_lot_items SET available_quantity = available_quantity - $1, returned_quantity = returned_quantity + $1')) {
      const item = this.consignmentLotItems.find((x) => x.id === params[1]);
      if (item) {
        item.available_quantity -= params[0];
        item.returned_quantity += params[0];
        item.updated_at = new Date().toISOString();
        return { rows: [{ ...item } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 131. consignment_lot_items UPDATE retained quantity
    if (cleanSql.startsWith('UPDATE consignment_lot_items SET available_quantity = available_quantity - $1, retained_quantity = retained_quantity + $1')) {
      const item = this.consignmentLotItems.find((x) => x.id === params[1]);
      if (item) {
        item.available_quantity -= params[0];
        item.retained_quantity += params[0];
        item.updated_at = new Date().toISOString();
        return { rows: [{ ...item } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 132. consignment_lots SELECT deposit_amount, status WHERE id = $1
    if (cleanSql.includes('FROM consignment_lots WHERE id = $1')) {
      const lot = this.consignmentLots.find((x) => x.id === params[0]);
      return { rows: lot ? [{ ...lot } as unknown as T] : [], rowCount: lot ? 1 : 0 };
    }

    // 133. book_sales SUM total_amount for lot
    if (cleanSql.includes('FROM book_sales s JOIN consignment_lot_items i ON s.lot_item_id = i.id WHERE i.lot_id = $1')) {
      const itemsOfLot = new Set(this.consignmentLotItems.filter((x) => x.lot_id === params[0]).map((x) => x.id));
      const totalRev = this.bookSales
        .filter((s) => itemsOfLot.has(s.lot_item_id))
        .reduce((sum, s) => sum + Number(s.total_amount), 0);
      return { rows: [{ total_revenue: totalRev } as unknown as T], rowCount: 1 };
    }

    // 134. consignment_settlements SELECT by idempotency_key
    if (cleanSql.includes('FROM consignment_settlements WHERE idempotency_key = $1')) {
      const s = this.consignmentSettlements.find((x) => x.idempotency_key === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // 135. consignment_settlements SELECT by lot_id
    if (cleanSql.includes('FROM consignment_settlements WHERE lot_id = $1')) {
      const s = this.consignmentSettlements.find((x) => x.lot_id === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // 136. consignment_settlements INSERT
    if (cleanSql.startsWith('INSERT INTO consignment_settlements')) {
      const settle = {
        id: `settle-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        settlement_code: params[0],
        lot_id: params[1],
        settlement_date: params[2],
        total_sold_books: params[3],
        total_returned_books: params[4],
        total_retained_books: params[5],
        total_revenue: params[6],
        payable_to_supplier: params[7],
        gross_profit: params[8],
        deposit_paid: params[9],
        deposit_refund_expected: params[10],
        paid_to_supplier: 0,
        payment_status: params[11],
        deposit_refund_status: params[12],
        deposit_refund_received: 0,
        idempotency_key: params[13],
        settled_by: params[14],
        notes: params[15],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.consignmentSettlements.push(settle);
      return { rows: [{ ...settle } as unknown as T], rowCount: 1 };
    }

    // 137. consignment_lots UPDATE status = 'SETTLED'
    if (cleanSql.startsWith("UPDATE consignment_lots SET status = 'SETTLED'")) {
      const lot = this.consignmentLots.find((x) => x.id === params[0]);
      if (lot) {
        lot.status = 'SETTLED';
        lot.updated_at = new Date().toISOString();
        return { rows: [{ ...lot } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 138. consignment_settlements SELECT by id FOR UPDATE
    if (cleanSql.includes('FROM consignment_settlements WHERE id = $1 FOR UPDATE')) {
      const s = this.consignmentSettlements.find((x) => x.id === params[0]);
      return { rows: s ? [{ ...s } as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    // 139. supplier_payments INSERT
    if (cleanSql.startsWith('INSERT INTO supplier_payments')) {
      const pay = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        payment_code: params[0],
        settlement_id: params[1],
        payment_type: params[2],
        amount: params[3],
        payment_method: params[4],
        confirmed_at: new Date().toISOString(),
        confirmed_by: params[5],
        reference_doc: params[6],
        notes: params[7],
        created_at: new Date().toISOString(),
      };
      this.supplierPayments.push(pay);
      return { rows: [{ ...pay } as unknown as T], rowCount: 1 };
    }

    // 140. consignment_lots UPDATE deposit_refunded
    if (cleanSql.startsWith('UPDATE consignment_lots SET deposit_refunded = deposit_refunded + $1')) {
      const lot = this.consignmentLots.find((x) => x.id === params[1]);
      if (lot) {
        lot.deposit_refunded = Number(lot.deposit_refunded) + Number(params[0]);
        lot.deposit_status = lot.deposit_refunded >= lot.deposit_amount ? 'FULLY_REFUNDED' : 'PARTIALLY_REFUNDED';
        lot.updated_at = new Date().toISOString();
        return { rows: [{ ...lot } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 141. consignment_settlements UPDATE after payment
    if (cleanSql.startsWith('UPDATE consignment_settlements SET paid_to_supplier = $1, payment_status = $2, deposit_refund_received = $3, deposit_refund_status = $4')) {
      const s = this.consignmentSettlements.find((x) => x.id === params[4]);
      if (s) {
        s.paid_to_supplier = params[0];
        s.payment_status = params[1];
        s.deposit_refund_received = params[2];
        s.deposit_refund_status = params[3];
        s.updated_at = new Date().toISOString();
        return { rows: [{ ...s } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 142. supplier_payments SELECT by settlement_id
    if (cleanSql.includes('FROM supplier_payments WHERE settlement_id = $1')) {
      const pays = this.supplierPayments.filter((x) => x.settlement_id === params[0]);
      return { rows: pays as unknown as T[], rowCount: pays.length };
    }

    // 143. activities INSERT
    if (cleanSql.startsWith('INSERT INTO activities')) {
      const act = {
        id: params[0],
        title: params[1],
        description: params[2],
        event_type: params[3],
        event_date: params[4],
        start_time: params[5],
        end_time: params[6],
        location: params[7],
        budget: params[8],
        created_by: params[9],
        status: params[10],
        is_approved_for_public: params[11],
        is_approved_for_alumni: params[12],
        created_at: params[13],
        updated_at: params[14],
      };
      this.activities.push(act);
      return { rows: [{ ...act } as unknown as T], rowCount: 1 };
    }

    // 144. activities SELECT by id
    if (cleanSql.includes('FROM activities WHERE id = $1')) {
      const act = this.activities.find((x) => x.id === params[0]);
      return { rows: act ? [{ ...act } as unknown as T] : [], rowCount: act ? 1 : 0 };
    }

    // 145. activities SELECT approved for alumni
    if (cleanSql.includes('FROM activities') && cleanSql.includes('is_approved_for_alumni = TRUE')) {
      const acts = this.activities.filter((x) => x.is_approved_for_alumni === true);
      return { rows: acts.map((a) => ({ ...a })) as unknown as T[], rowCount: acts.length };
    }

    // 146. activities SELECT approved for public
    if (cleanSql.includes('FROM activities') && cleanSql.includes('is_approved_for_public = TRUE')) {
      const acts = this.activities.filter((x) => x.is_approved_for_public === true);
      return { rows: acts.map((a) => ({ ...a })) as unknown as T[], rowCount: acts.length };
    }

    // 147. activities SELECT all
    if (cleanSql.includes('FROM activities') && cleanSql.includes('ORDER BY event_date DESC')) {
      return { rows: this.activities.map((a) => ({ ...a })) as unknown as T[], rowCount: this.activities.length };
    }

    // 148. activities UPDATE
    if (cleanSql.startsWith('UPDATE activities SET')) {
      const act = this.activities.find((x) => x.id === params[12]);
      if (act) {
        act.title = params[0];
        act.description = params[1];
        act.event_type = params[2];
        act.event_date = params[3];
        act.start_time = params[4];
        act.end_time = params[5];
        act.location = params[6];
        act.budget = params[7];
        act.status = params[8];
        act.is_approved_for_public = params[9];
        act.is_approved_for_alumni = params[10];
        act.updated_at = params[11];
        return { rows: [{ ...act } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 149. activity_tasks INSERT
    if (cleanSql.startsWith('INSERT INTO activity_tasks')) {
      const tsk = {
        id: params[0],
        activity_id: params[1],
        title: params[2],
        description: params[3],
        assignee_member_id: params[4],
        due_date: params[5],
        priority: params[6],
        status: params[7],
        created_by: params[8],
        created_at: params[9],
        updated_at: params[10],
      };
      this.activityTasks.push(tsk);
      return { rows: [{ ...tsk } as unknown as T], rowCount: 1 };
    }

    // 150. activity_tasks SELECT by id
    if (cleanSql.includes('FROM activity_tasks WHERE id = $1')) {
      const tsk = this.activityTasks.find((x) => x.id === params[0]);
      return { rows: tsk ? [{ ...tsk } as unknown as T] : [], rowCount: tsk ? 1 : 0 };
    }

    // 151. activity_tasks SELECT by activity_id
    if (cleanSql.includes('FROM activity_tasks') && cleanSql.includes('activity_id = $1')) {
      const tsks = this.activityTasks.filter((x) => x.activity_id === params[0]);
      return { rows: tsks.map((t) => ({ ...t })) as unknown as T[], rowCount: tsks.length };
    }

    // 152. activity_tasks UPDATE
    if (cleanSql.startsWith('UPDATE activity_tasks SET')) {
      const tsk = this.activityTasks.find((x) => x.id === params[7]);
      if (tsk) {
        tsk.title = params[0];
        tsk.description = params[1];
        tsk.assignee_member_id = params[2];
        tsk.due_date = params[3];
        tsk.priority = params[4];
        tsk.status = params[5];
        tsk.updated_at = params[6];
        return { rows: [{ ...tsk } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 153. activity_task_history INSERT
    if (cleanSql.startsWith('INSERT INTO activity_task_history')) {
      const h = {
        id: params[0],
        task_id: params[1],
        changed_by: params[2],
        field_name: params[3],
        old_value: params[4],
        new_value: params[5],
        reason: params[6],
        created_at: params[7],
      };
      this.activityTaskHistory.push(h);
      return { rows: [{ ...h } as unknown as T], rowCount: 1 };
    }

    // 154. activity_task_history SELECT by task_id
    if (cleanSql.includes('FROM activity_task_history') && cleanSql.includes('task_id = $1')) {
      const hist = this.activityTaskHistory.filter((x) => x.task_id === params[0]);
      return { rows: hist.map((h) => ({ ...h })) as unknown as T[], rowCount: hist.length };
    }

    // 155. activity_participants INSERT
    if (cleanSql.startsWith('INSERT INTO activity_participants')) {
      const p = {
        id: params[0],
        activity_id: params[1],
        participant_type: params[2],
        member_id: params[3],
        guest_name: params[4],
        guest_email: params[5],
        guest_phone: params[6],
        role: params[7],
        status: params[8],
        check_in_time: null,
        created_at: params[9],
      };
      this.activityParticipants.push(p);
      return { rows: [{ ...p } as unknown as T], rowCount: 1 };
    }

    // 156. activity_participants SELECT by id
    if (cleanSql.includes('FROM activity_participants WHERE id = $1')) {
      const p = this.activityParticipants.find((x) => x.id === params[0]);
      return { rows: p ? [{ ...p } as unknown as T] : [], rowCount: p ? 1 : 0 };
    }

    // 157. activity_participants SELECT by activity_id
    if (cleanSql.includes('FROM activity_participants') && cleanSql.includes('activity_id = $1')) {
      const parts = this.activityParticipants.filter((x) => x.activity_id === params[0]);
      return { rows: parts.map((p) => ({ ...p })) as unknown as T[], rowCount: parts.length };
    }

    // 158. activity_participants UPDATE
    if (cleanSql.startsWith('UPDATE activity_participants SET')) {
      const p = this.activityParticipants.find((x) => x.id === params[3]);
      if (p) {
        p.role = params[0];
        p.status = params[1];
        p.check_in_time = params[2];
        return { rows: [{ ...p } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 159. activity_budget_items INSERT
    if (cleanSql.startsWith('INSERT INTO activity_budget_items')) {
      const b = {
        id: params[0],
        activity_id: params[1],
        category: params[2],
        description: params[3],
        estimated_amount: params[4],
        created_at: params[5],
      };
      this.activityBudgetItems.push(b);
      return { rows: [{ ...b } as unknown as T], rowCount: 1 };
    }

    // 160. activity_budget_items SELECT by activity_id
    if (cleanSql.includes('FROM activity_budget_items') && cleanSql.includes('activity_id = $1')) {
      const items = this.activityBudgetItems.filter((x) => x.activity_id === params[0]);
      return { rows: items.map((b) => ({ ...b })) as unknown as T[], rowCount: items.length };
    }

    // 161. activity_expenses INSERT
    if (cleanSql.startsWith('INSERT INTO activity_expenses')) {
      const e = {
        id: params[0],
        activity_id: params[1],
        budget_item_id: params[2],
        description: params[3],
        actual_amount: params[4],
        expense_date: params[5],
        payer_member_id: params[6],
        payment_method: params[7],
        receipt_ref: params[8],
        journal_entry_id: params[9],
        created_by: params[10],
        created_at: params[11],
      };
      this.activityExpenses.push(e);
      return { rows: [{ ...e } as unknown as T], rowCount: 1 };
    }

    // 162. activity_expenses SELECT by activity_id
    if (cleanSql.includes('FROM activity_expenses') && cleanSql.includes('activity_id = $1')) {
      const exps = this.activityExpenses.filter((x) => x.activity_id === params[0]);
      return { rows: exps.map((e) => ({ ...e })) as unknown as T[], rowCount: exps.length };
    }

    // 163. book_reviews INSERT
    if (cleanSql.startsWith('INSERT INTO book_reviews')) {
      const rev = {
        id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        book_id: params[0],
        author_id: params[1],
        author_name: params[2],
        author_email: params[3],
        is_club_review: !!params[6],
        rating: params[4],
        content: params[5],
        status: 'PENDING',
        moderated_by: null,
        moderated_at: null,
        moderation_note: null,
        version: 1,
        pending_content: null,
        pending_rating: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.bookReviews.push(rev);
      return { rows: [{ ...rev } as unknown as T], rowCount: 1 };
    }

    // 164. book_reviews SELECT by ID
    if (cleanSql.includes('FROM book_reviews WHERE id = $1')) {
      const rev = this.bookReviews.find((r) => r.id === params[0]);
      return { rows: rev ? [{ ...rev } as unknown as T] : [], rowCount: rev ? 1 : 0 };
    }

    // 165. book_reviews UPDATE (version edit)
    if (cleanSql.includes('UPDATE book_reviews') && cleanSql.includes('version = version + 1')) {
      const rev = this.bookReviews.find((r) => r.id === params[2]);
      if (rev) {
        rev.version = (rev.version || 1) + 1;
        rev.pending_content = params[0];
        rev.pending_rating = params[1];
        rev.status = 'PENDING';
        rev.updated_at = new Date().toISOString();
        return { rows: [{ ...rev } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 166. book_reviews UPDATE (normal edit before approval)
    if (cleanSql.includes('UPDATE book_reviews') && cleanSql.includes('status = \'PENDING\'') && !cleanSql.includes('version = version + 1')) {
      const rev = this.bookReviews.find((r) => r.id === params[2]);
      if (rev) {
        rev.content = params[0];
        rev.rating = params[1];
        rev.status = 'PENDING';
        rev.pending_content = null;
        rev.pending_rating = null;
        rev.updated_at = new Date().toISOString();
        return { rows: [{ ...rev } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 167. book_reviews UPDATE (moderate APPROVED)
    if (cleanSql.includes('UPDATE book_reviews') && cleanSql.includes('status = \'APPROVED\'')) {
      const rev = this.bookReviews.find((r) => r.id === params[4]);
      if (rev) {
        rev.content = params[0];
        rev.rating = params[1];
        rev.status = 'APPROVED';
        rev.pending_content = null;
        rev.pending_rating = null;
        rev.moderated_by = params[2];
        rev.moderation_note = params[3];
        rev.moderated_at = new Date().toISOString();
        rev.updated_at = new Date().toISOString();
        return { rows: [{ ...rev } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 168. book_reviews UPDATE (moderate REJECTED)
    if (cleanSql.includes('UPDATE book_reviews') && cleanSql.includes('status = \'REJECTED\'')) {
      const rev = this.bookReviews.find((r) => r.id === params[2]);
      if (rev) {
        rev.status = 'REJECTED';
        rev.moderated_by = params[0];
        rev.moderation_note = params[1];
        rev.moderated_at = new Date().toISOString();
        rev.updated_at = new Date().toISOString();
        return { rows: [{ ...rev } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 169. book_reviews SELECT public (status = 'APPROVED')
    if (cleanSql.includes('FROM book_reviews') && cleanSql.includes("status = 'APPROVED'")) {
      let filtered = this.bookReviews.filter((r) => r.status === 'APPROVED');
      if (cleanSql.startsWith('SELECT COUNT(*)')) {
        return { rows: [{ count: filtered.length }] as unknown as T[], rowCount: 1 };
      }
      if (cleanSql.includes('book_id = $1') && params[0]) {
        filtered = filtered.filter((r) => r.book_id === params[0]);
      }
      return { rows: filtered.map((r) => ({ ...r })) as unknown as T[], rowCount: filtered.length };
    }

    // 170. book_reviews SELECT for moderation (SELECT * FROM book_reviews WHERE 1=1)
    if (cleanSql.includes('FROM book_reviews WHERE 1=1')) {
      let list = [...this.bookReviews];
      if (cleanSql.includes('status = $') && params.length > 0) {
        list = list.filter((r) => r.status === params[0]);
      }
      return { rows: list.map((r) => ({ ...r })) as unknown as T[], rowCount: list.length };
    }

    // 171. public_posts check slug
    if (cleanSql.includes('FROM public_posts WHERE slug = $1')) {
      const post = this.publicPosts.find((p) => p.slug === params[0]);
      if (cleanSql.includes("status = 'PUBLISHED'") && post && post.status !== 'PUBLISHED') {
        return { rows: [], rowCount: 0 };
      }
      return { rows: post ? [{ ...post } as unknown as T] : [], rowCount: post ? 1 : 0 };
    }

    // 172. public_posts INSERT
    if (cleanSql.startsWith('INSERT INTO public_posts')) {
      const p = {
        id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: params[0],
        slug: params[1],
        summary: params[2],
        content: params[3],
        category: params[4],
        cover_image_url: params[5],
        author_id: params[6],
        author_display_name: params[7],
        status: 'DRAFT',
        meta_description: params[8],
        view_count: 0,
        moderated_by: null,
        moderated_at: null,
        published_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.publicPosts.push(p);
      return { rows: [{ ...p } as unknown as T], rowCount: 1 };
    }

    // 173. public_posts SELECT by ID
    if (cleanSql.includes('FROM public_posts WHERE id = $1')) {
      const p = this.publicPosts.find((x) => x.id === params[0]);
      return { rows: p ? [{ ...p } as unknown as T] : [], rowCount: p ? 1 : 0 };
    }

    // 174. public_posts UPDATE publish
    if (cleanSql.includes('UPDATE public_posts') && cleanSql.includes('status = \'PUBLISHED\'')) {
      const p = this.publicPosts.find((x) => x.id === params[1]);
      if (p) {
        p.status = 'PUBLISHED';
        p.moderated_by = params[0];
        p.moderated_at = new Date().toISOString();
        p.published_at = new Date().toISOString();
        p.updated_at = new Date().toISOString();
        return { rows: [{ ...p } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 175. public_posts SELECT public
    if (cleanSql.includes('FROM public_posts WHERE status = \'PUBLISHED\'')) {
      let posts = this.publicPosts.filter((x) => x.status === 'PUBLISHED');
      if (cleanSql.startsWith('SELECT COUNT(*)')) {
        return { rows: [{ count: posts.length }] as unknown as T[], rowCount: 1 };
      }
      if (cleanSql.includes('category = $1') && params[0]) {
        posts = posts.filter((x) => x.category === params[0]);
      }
      return { rows: posts.map((x) => ({ ...x })) as unknown as T[], rowCount: posts.length };
    }

    // 175b. Reports: Financial Summary Opening Balances from journal_entries
    if (cleanSql.includes('SELECT fund_id, debit_account, credit_account, amount, created_at FROM journal_entries WHERE created_at < $1')) {
      const cutoff = new Date(params[0]).getTime();
      let entries = this.journalEntries.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t < cutoff;
      });
      if (params.length > 1 && params[1]) {
        entries = entries.filter((e) => e.fund_id === params[1]);
      }
      return {
        rows: entries.map((e) => ({
          fund_id: e.fund_id,
          debit_account: e.debit_account,
          credit_account: e.credit_account,
          amount: e.amount,
          created_at: e.created_at,
        })) as unknown as T[],
        rowCount: entries.length,
      };
    }

    // 176. Reports: Financial Summary Movements from journal_entries
    if (cleanSql.includes('SELECT fund_id, debit_account, credit_account, amount, created_at FROM journal_entries WHERE created_at >=')) {
      const start = new Date(params[0]).getTime();
      const end = cleanSql.includes('AND created_at < $2')
        ? new Date(params[1]).getTime()
        : new Date(params[1]).getTime() + 86400000;
      let entries = this.journalEntries.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= start && t < end;
      });
      if (params.length > 2 && params[2]) {
        entries = entries.filter((e) => e.fund_id === params[2]);
      }
      return {
        rows: entries.map((e) => ({
          fund_id: e.fund_id,
          debit_account: e.debit_account,
          credit_account: e.credit_account,
          amount: e.amount,
          created_at: e.created_at,
        })) as unknown as T[],
        rowCount: entries.length,
      };
    }

    // 177. Reports: Financial Drilldown COUNT
    if (cleanSql.includes('SELECT COUNT(*) as count FROM journal_entries WHERE created_at >=')) {
      const start = new Date(params[0]).getTime();
      const end = cleanSql.includes('AND created_at < $2')
        ? new Date(params[1]).getTime()
        : new Date(params[1]).getTime() + 86400000;
      let entries = this.journalEntries.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= start && t < end;
      });
      if (params.length > 2 && params[2]) {
        entries = entries.filter((e) => e.fund_id === params[2]);
      }
      return { rows: [{ count: entries.length }] as unknown as T[], rowCount: 1 };
    }

    // 178. Reports: Financial Drilldown ITEMS
    if (cleanSql.includes('SELECT id, entry_code, fund_id, source_type, source_id, debit_account, credit_account, amount, created_by, created_at, notes FROM journal_entries WHERE created_at >=')) {
      const start = new Date(params[0]).getTime();
      const end = cleanSql.includes('AND created_at < $2')
        ? new Date(params[1]).getTime()
        : new Date(params[1]).getTime() + 86400000;
      let entries = this.journalEntries.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= start && t < end;
      });
      let pOffset = 2;
      if (cleanSql.includes('AND fund_id = $3')) {
        entries = entries.filter((e) => e.fund_id === params[2]);
        pOffset = 3;
      }
      const limit = Number(params[pOffset]) || 50;
      const offset = Number(params[pOffset + 1]) || 0;
      const slice = entries.slice(offset, offset + limit);
      return {
        rows: slice.map((e) => ({
          id: e.id,
          entry_code: e.entry_code,
          fund_id: e.fund_id,
          source_type: e.source_type,
          source_id: e.source_id,
          debit_account: e.debit_account,
          credit_account: e.credit_account,
          amount: e.amount,
          created_by: e.created_by,
          created_at: e.created_at,
          notes: e.notes || null,
        })) as unknown as T[],
        rowCount: slice.length,
      };
    }

    // 179. Reports: Circulation summary counts
    // 179. Reports: Circulation summary counts
    if (cleanSql.includes('SELECT COUNT(*) as count FROM loan_receipts WHERE') && (cleanSql.includes('created_at >=') || cleanSql.includes('issued_at >='))) {
      const start = new Date(params[0]).getTime();
      const end = new Date(params[1]).getTime() + 86400000;
      const cnt = this.loanReceipts.filter((lr) => {
        const t = new Date(lr.created_at || lr.issued_at).getTime();
        return t >= start && t <= end;
      }).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    if (cleanSql.includes('SELECT COUNT(*) as count FROM loan_settlements WHERE') && (cleanSql.includes("settlement_type IN ('FULL', 'PARTIAL')") || cleanSql.includes("settlement_type = 'RETURN'"))) {
      const start = new Date(params[0]).getTime();
      const end = new Date(params[1]).getTime() + 86400000;
      const cnt = this.loanSettlements.filter((ls) => {
        const t = new Date(ls.settled_at || ls.created_at).getTime();
        const type = ls.settlement_type || ls.settlementType;
        return (type === 'FULL' || type === 'PARTIAL' || type === 'RETURN') && t >= start && t <= end;
      }).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    if (cleanSql.includes('SELECT COUNT(*) as count FROM loan_renewals WHERE renewed_at >=')) {
      const start = new Date(params[0]).getTime();
      const end = new Date(params[1]).getTime() + 86400000;
      const cnt = this.loanRenewals.filter((r) => {
        const t = new Date(r.renewed_at || r.created_at).getTime();
        return t >= start && t <= end;
      }).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    if (cleanSql.includes('SELECT COUNT(*) as count FROM loan_settlements WHERE settlement_type = \'LOST\'')) {
      const start = new Date(params[0]).getTime();
      const end = new Date(params[1]).getTime() + 86400000;
      const cnt = this.loanSettlements.filter((ls) => {
        const t = new Date(ls.settled_at || ls.created_at).getTime();
        const type = ls.settlement_type || ls.settlementType;
        return type === 'LOST' && t >= start && t <= end;
      }).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    if (cleanSql.includes('FROM loan_items li JOIN loan_receipts lr ON lr.id = li.receipt_id') || cleanSql.includes("due_date < NOW()")) {
      const now = Date.now();
      const cnt = this.loanItems.filter((i) => {
        const isNotReturned = !i.returned_at && !i.is_lost && !i.carried_forward_at;
        const receipt = this.loanReceipts.find((r) => r.id === i.receipt_id);
        const dueDate = receipt?.due_date || i.due_date;
        return (i.return_status === 'ISSUED' || isNotReturned) && dueDate && new Date(dueDate).getTime() < now;
      }).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    if (cleanSql.includes('FROM loan_items WHERE returned_at IS NULL AND is_lost = FALSE AND carried_forward_at IS NULL') || cleanSql.includes("FROM loan_items WHERE return_status = 'ISSUED'")) {
      const cnt = this.loanItems.filter((i) => {
        if (i.returned_at || i.is_lost || i.carried_forward_at) return false;
        if (i.return_status && i.return_status !== 'ISSUED') return false;
        return true;
      }).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    // 180. Audit: System Audit Logs COUNT
    if (cleanSql.includes('SELECT COUNT(*) as count FROM system_audit_logs')) {
      return { rows: [{ count: this.systemAuditLogs.length }] as unknown as T[], rowCount: 1 };
    }

    // 181. Audit: System Audit Logs LIST
    if (cleanSql.includes('SELECT id, actor_id, action, target_resource, target_id, ip_address, details, created_at FROM system_audit_logs')) {
      const list = [...this.systemAuditLogs];
      return { rows: list.map((l) => ({ ...l })) as unknown as T[], rowCount: list.length };
    }

    // 182. Analytics Counts
    if (cleanSql.includes('SELECT COUNT(*) as count FROM book_titles')) {
      return { rows: [{ count: this.bookTitles.length }] as unknown as T[], rowCount: 1 };
    }
    if (cleanSql.includes('SELECT COUNT(*) as count FROM book_copies WHERE status != \'ARCHIVED\'')) {
      const cnt = this.bookCopies.filter((c) => c.status !== 'ARCHIVED').length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }
    if (cleanSql.includes('SELECT COUNT(*) as count FROM members WHERE is_active = true AND is_alumni = false')) {
      const cnt = this.members.filter((m) => m.is_active && !m.is_alumni).length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }
    if (cleanSql.includes('SELECT COUNT(*) as count FROM book_reviews WHERE status = \'APPROVED\'')) {
      const cnt = this.bookReviews.filter((r) => r.status === 'APPROVED').length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }
    if (cleanSql.includes('SELECT COUNT(*) as count FROM public_posts WHERE status = \'PUBLISHED\'')) {
      const cnt = this.publicPosts.filter((p) => p.status === 'PUBLISHED').length;
      return { rows: [{ count: cnt }] as unknown as T[], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}
