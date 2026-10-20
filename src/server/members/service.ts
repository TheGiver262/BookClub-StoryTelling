import type { Queryable } from '../finance/types.ts';
import { FUND_IDS, ACCOUNT_CODES } from '../finance/types.ts';
import { recordJournalEntry } from '../finance/ledger.ts';
import { recordAuditLog } from '../shared/audit.ts';
import { claimIdempotency, completeIdempotency, computePayloadHash } from '../shared/idempotency.ts';
import { NotFoundError, ConflictError } from '../errors.ts';
import { 
  type MemberAffiliation, type MembershipDuesReceipt, 
  type MemberHeadcountSummary, DEPARTMENTS 
} from './types.ts';
import { validateAddAffiliationInput, validateCollectDuesInput } from './rules.ts';

export async function getMemberAffiliations(
  db: Queryable,
  memberId: string
): Promise<MemberAffiliation[]> {
  const res = await db.query<any>(
    `SELECT id, member_id, department, role, term_year, start_date, end_date, is_current, notes, created_at
     FROM member_affiliations
     WHERE member_id = $1
     ORDER BY start_date DESC, created_at DESC`,
    [memberId]
  );

  return (res.rows || []).map((r: any) => ({
    id: r.id,
    memberId: r.member_id,
    department: r.department,
    role: r.role,
    termYear: r.term_year,
    startDate: typeof r.start_date === 'string' ? r.start_date : new Intl.DateTimeFormat('en-CA').format(new Date(r.start_date)),
    endDate: r.end_date ? (typeof r.end_date === 'string' ? r.end_date : new Intl.DateTimeFormat('en-CA').format(new Date(r.end_date))) : null,
    isCurrent: Boolean(r.is_current),
    notes: r.notes || null,
    createdAt: r.created_at,
  }));
}

export async function addMemberAffiliation(
  db: Queryable,
  rawParams: any,
  actorId: string
): Promise<MemberAffiliation> {
  const params = validateAddAffiliationInput(rawParams);

  // Kiểm tra thành viên tồn tại
  const mRes = await db.query<any>(
    `SELECT id, full_name, is_active FROM members WHERE id = $1`,
    [params.memberId]
  );
  if (!mRes.rows || mRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy thành viên ID '${params.memberId}'.`, 'MEMBER_NOT_FOUND');
  }

  // Nếu chuyển chức vụ cùng ban (endPreviousForDept = true), kết thúc chức vụ cũ để lưu lịch sử
  if (params.endPreviousForDept) {
    await db.query(
      `UPDATE member_affiliations
       SET end_date = $1, is_current = FALSE
       WHERE member_id = $2 AND department = $3 AND is_current = TRUE`,
      [params.startDate, params.memberId, params.department]
    );
  }

  const insRes = await db.query<any>(
    `INSERT INTO member_affiliations (
       member_id, department, role, term_year, start_date, is_current, notes
     ) VALUES ($1, $2, $3, $4, $5, TRUE, $6)
     RETURNING id, member_id, department, role, term_year, start_date, end_date, is_current, notes, created_at`,
    [params.memberId, params.department, params.role, params.termYear, params.startDate, params.notes || null]
  );
  const row = insRes.rows[0];

  await recordAuditLog(db, {
    actorId,
    action: 'ADD_MEMBER_AFFILIATION',
    targetResource: 'MEMBER',
    targetId: params.memberId,
    details: {
      affiliationId: row.id,
      department: params.department,
      role: params.role,
      termYear: params.termYear,
    },
  });

  return {
    id: row.id,
    memberId: row.member_id,
    department: row.department,
    role: row.role,
    termYear: row.term_year,
    startDate: typeof row.start_date === 'string' ? row.start_date : new Intl.DateTimeFormat('en-CA').format(new Date(row.start_date)),
    endDate: row.end_date,
    isCurrent: Boolean(row.is_current),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function getMembersHeadcount(
  db: Queryable
): Promise<MemberHeadcountSummary> {
  // 1. Tổng số thành viên duy nhất đang hoạt động (không đếm trùng người)
  const totalActiveRes = await db.query<any>(
    `SELECT COUNT(DISTINCT id) as cnt FROM members WHERE is_active = TRUE AND is_alumni = FALSE`
  );
  const totalActive = Number(totalActiveRes.rows[0]?.cnt || 0);

  const totalAlumniRes = await db.query<any>(
    `SELECT COUNT(DISTINCT id) as cnt FROM members WHERE is_alumni = TRUE`
  );
  const totalAlumni = Number(totalAlumniRes.rows[0]?.cnt || 0);

  const totalMembersRes = await db.query<any>(
    `SELECT COUNT(DISTINCT id) as cnt FROM members`
  );
  const totalDistinct = Number(totalMembersRes.rows[0]?.cnt || 0);

  // 2. Thống kê theo từng ban (đếm distinct member_id theo ban)
  const deptRes = await db.query<any>(
    `SELECT department, COUNT(DISTINCT member_id) as cnt
     FROM member_affiliations
     WHERE is_current = TRUE
     GROUP BY department`
  );

  const deptCounts: Record<string, number> = {
    [DEPARTMENTS.HAU_CAN]: 0,
    [DEPARTMENTS.NOI_DUNG]: 0,
    [DEPARTMENTS.TTDN]: 0,
    [DEPARTMENTS.BCN]: 0,
  };

  for (const r of deptRes.rows || []) {
    if (deptCounts[r.department] !== undefined) {
      deptCounts[r.department] = Number(r.cnt || 0);
    }
  }

  // 3. Đếm số thành viên kiêm nhiệm nhiều ban đồng thời (COUNT(DISTINCT department) > 1)
  const multiRes = await db.query<any>(
    `SELECT member_id, COUNT(DISTINCT department) as dept_cnt
     FROM member_affiliations
     WHERE is_current = TRUE
     GROUP BY member_id
     HAVING COUNT(DISTINCT department) > 1`
  );
  const multiCount = (multiRes.rows || []).length;

  return {
    totalDistinctMembers: totalDistinct,
    totalActiveMembers: totalActive,
    totalAlumniMembers: totalAlumni,
    departments: {
      [DEPARTMENTS.HAU_CAN]: deptCounts[DEPARTMENTS.HAU_CAN],
      [DEPARTMENTS.NOI_DUNG]: deptCounts[DEPARTMENTS.NOI_DUNG],
      [DEPARTMENTS.TTDN]: deptCounts[DEPARTMENTS.TTDN],
      [DEPARTMENTS.BCN]: deptCounts[DEPARTMENTS.BCN],
    },
    multiDepartmentMemberCount: multiCount,
  };
}

export async function collectMembershipDues(
  db: Queryable,
  rawParams: any,
  actorId: string
): Promise<MembershipDuesReceipt> {
  const validated = validateCollectDuesInput(rawParams);

  // 0. Idempotency Check (Chống double-mutation và replay an toàn)
  let idempotencyPayloadHash: string | null = null;
  if (validated.idempotencyKey) {
    idempotencyPayloadHash = computePayloadHash({
      memberId: validated.memberId,
      amount: validated.validatedAmount.toString(),
      paymentMethod: validated.paymentMethod,
      termLabel: validated.termLabel,
    });
    const claim = await claimIdempotency(
      db,
      actorId,
      'COLLECT_MEMBERSHIP_DUES',
      validated.idempotencyKey,
      idempotencyPayloadHash
    );
    if (claim.action === 'RETURN_CACHED') {
      return claim.responseBody as MembershipDuesReceipt;
    }
  }

  // 1. Khóa và kiểm tra thông tin thành viên (FOR UPDATE)
  const mRes = await db.query<any>(
    `SELECT id, full_name, has_paid_fee, is_active, is_alumni
     FROM members
     WHERE id = $1
     FOR UPDATE`,
    [validated.memberId]
  );
  if (!mRes.rows || mRes.rows.length === 0) {
    throw new NotFoundError(`Không tìm thấy thành viên ID '${validated.memberId}'.`, 'MEMBER_NOT_FOUND');
  }
  const member = mRes.rows[0];

  // Invariant: Hội phí một lần duy nhất trong toàn bộ thời gian sinh hoạt CLB
  // Không được tự ý thu lại vào năm sau
  if (member.has_paid_fee) {
    throw new ConflictError(
      `Thành viên '${member.full_name}' đã hoàn thành hội phí một lần trước đó. Không được phép thu lại vào các năm sau.`,
      'DUPLICATE_MEMBERSHIP_FEE_COLLECTION'
    );
  }

  // Kiểm tra bảng biên nhận membership_dues_receipts
  const dRes = await db.query<any>(
    `SELECT id, receipt_number, amount, collected_at FROM membership_dues_receipts WHERE member_id = $1`,
    [validated.memberId]
  );
  if (dRes.rows && dRes.rows.length > 0) {
    throw new ConflictError(
      `Biên nhận hội phí '${dRes.rows[0].receipt_number}' đã tồn tại cho thành viên này.`,
      'DUPLICATE_MEMBERSHIP_FEE_COLLECTION'
    );
  }

  // 2. Theo dõi ca tiền mặt nếu có chỉ định (tùy chọn)
  // Lưu ý: Hội phí thuộc Quỹ Hoạt Động (FUND_OPERATION), không ép mở ca LOAN và không làm lệch két mượn-trả.
  let activeSessionId: string | null = null;
  if (validated.paymentMethod === 'CASH' && validated.cashSessionId) {
    const sRes = await db.query<any>(
      `SELECT id, is_closed FROM cash_sessions WHERE id = $1`,
      [validated.cashSessionId]
    );
    if (sRes.rows && sRes.rows.length > 0 && !sRes.rows[0].is_closed) {
      activeSessionId = sRes.rows[0].id;
    }
  }

  // 3. Sinh số biên nhận hội phí
  const todayVietnam = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const dateStr = todayVietnam.replace(/-/g, '');
  const rcpSeqRes = await db.query<any>(
    `SELECT COUNT(*) as cnt FROM membership_dues_receipts WHERE receipt_number LIKE $1`,
    [`DUE-${dateStr}-%`]
  );
  const seq = String(Number(rcpSeqRes.rows[0]?.cnt || 0) + 1).padStart(4, '0');
  const receiptNumber = `DUE-${dateStr}-${seq}`;

  // 4. Ghi sổ kép vào Sổ Cái (Quỹ Hoạt Động - OPERATION)
  // Lưu ý: Phiên quầy két bàn trực là của Quỹ Mượn-Trả (FUND_LOAN), nên không gắn cashSessionId vào bút toán Quỹ Hoạt Động.
  const debitAccount = validated.paymentMethod === 'BANK_TRANSFER' 
    ? ACCOUNT_CODES.BANK_MAIN 
    : ACCOUNT_CODES.CASH_DRAWER;
  const entryCode = `JE-DUES-${dateStr}-${seq}`;

  const je = await recordJournalEntry(db, {
    entryCode,
    fundId: FUND_IDS.OPERATION,
    sourceType: 'MEMBERSHIP_FEE',
    sourceId: validated.memberId,
    debitAccount,
    creditAccount: ACCOUNT_CODES.MEMBER_FEE,
    amount: validated.validatedAmount,
    cashSessionId: undefined,
    createdBy: actorId,
    notes: `Thu hội phí thành viên một lần: ${member.full_name} (${receiptNumber})`,
  });

  // 5. Ghi biên nhận thu hội phí (membership_dues_receipts)
  const insReceiptRes = await db.query<any>(
    `INSERT INTO membership_dues_receipts (
       receipt_number, member_id, amount, payment_method, payment_confirmed,
       cash_session_id, journal_entry_id, collected_by, term_label, notes
     ) VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9)
     RETURNING id, receipt_number, member_id, amount, payment_method, payment_confirmed,
               cash_session_id, journal_entry_id, collected_by, collected_at, term_label, notes`,
    [
      receiptNumber,
      validated.memberId,
      validated.validatedAmount.toString(),
      validated.paymentMethod,
      activeSessionId,
      je.id,
      actorId,
      validated.termLabel,
      validated.notes || null,
    ]
  );
  const receiptRow = insReceiptRes.rows[0];

  // 6. Cập nhật cờ has_paid_fee trên bảng members
  await db.query(
    `UPDATE members SET has_paid_fee = TRUE WHERE id = $1`,
    [validated.memberId]
  );

  // 7. Ghi nhật ký kiểm toán (P22-05: Tuyệt đối KHÔNG tăng expected_closing_cash của ca FUND_LOAN)

  // 8. Ghi nhật ký kiểm toán
  await recordAuditLog(db, {
    actorId,
    action: 'COLLECT_MEMBERSHIP_DUES',
    targetResource: 'MEMBERSHIP_DUES_RECEIPT',
    targetId: receiptRow.id,
    details: {
      receiptNumber,
      memberId: validated.memberId,
      memberName: member.full_name,
      amount: Number(validated.validatedAmount),
      paymentMethod: validated.paymentMethod,
      cashSessionId: activeSessionId,
      journalEntryId: je.id,
    },
  });

  const result: MembershipDuesReceipt = {
    id: receiptRow.id,
    receiptNumber: receiptRow.receipt_number,
    memberId: receiptRow.member_id,
    memberName: member.full_name,
    amount: Number(receiptRow.amount),
    paymentMethod: receiptRow.payment_method,
    paymentConfirmed: Boolean(receiptRow.payment_confirmed),
    cashSessionId: receiptRow.cash_session_id || null,
    journalEntryId: receiptRow.journal_entry_id || null,
    collectedBy: receiptRow.collected_by,
    collectedAt: receiptRow.collected_at,
    termLabel: receiptRow.term_label,
    notes: receiptRow.notes || null,
  };

  if (validated.idempotencyKey && idempotencyPayloadHash) {
    await completeIdempotency(
      db,
      actorId,
      'COLLECT_MEMBERSHIP_DUES',
      validated.idempotencyKey,
      200,
      result
    );
  }

  return result;
}

export async function getMemberDuesReceipt(
  db: Queryable,
  memberId: string
): Promise<MembershipDuesReceipt | null> {
  const res = await db.query<any>(
    `SELECT mdr.id, mdr.receipt_number, mdr.member_id, m.full_name as member_name,
            mdr.amount, mdr.payment_method, mdr.payment_confirmed,
            mdr.cash_session_id, mdr.journal_entry_id, mdr.collected_by,
            mdr.collected_at, mdr.term_label, mdr.notes
     FROM membership_dues_receipts mdr
     JOIN members m ON m.id = mdr.member_id
     WHERE mdr.member_id = $1`,
    [memberId]
  );

  if (!res.rows || res.rows.length === 0) {
    return null;
  }

  const r = res.rows[0];
  return {
    id: r.id,
    receiptNumber: r.receipt_number,
    memberId: r.member_id,
    memberName: r.member_name,
    amount: Number(r.amount),
    paymentMethod: r.payment_method,
    paymentConfirmed: Boolean(r.payment_confirmed),
    cashSessionId: r.cash_session_id,
    journalEntryId: r.journal_entry_id,
    collectedBy: r.collected_by,
    collectedAt: r.collected_at,
    termLabel: r.term_label,
    notes: r.notes,
  };
}
