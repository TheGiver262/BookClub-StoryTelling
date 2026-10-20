/**
-- =====================================================================
-- SERVICE: HOẠT ĐỘNG, SỰ KIỆN VÀ NHIỆM VỤ LIÊN KẾT QUỸ (CHẶNG 19 - FR-06)
-- =====================================================================
-- Tuân thủ:
-- - R06: Đầy đủ Event/Activity APIs, Audit log sửa nhiệm vụ
-- - R07: Khách tham gia không ép thành member, không bắt buộc MSSV/trường
-- - Sổ kép: Chi thực tế liên kết journal_entries (FUND_OPERATION) đếm đúng một lần
-- - Allowlist DTO: Cựu thành viên (ALUMNI) & Public được lọc sạch trường nhạy cảm
*/

import type { Queryable } from '../../server/finance/types.ts';
import { FUND_IDS, ACCOUNT_CODES } from '../../server/finance/types.ts';
import { recordJournalEntry } from '../../server/finance/ledger.ts';
import type { AuthenticatedActor } from '../../server/types.ts';
import { requireInternalMember } from '../../server/auth/policy.ts';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../server/errors.ts';
import type {
  Activity,
  ActivityTask,
  ActivityTaskHistory,
  ActivityParticipant,
  ActivityBudgetItem,
  ActivityExpense,
  ActivityDetailDto,
  SafeAlumniActivityDto,
  SafePublicActivityDto,
  CreateActivityRequest,
  UpdateActivityRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  AddParticipantRequest,
  UpdateParticipantRequest,
  CreateBudgetItemRequest,
  RecordExpenseRequest,
  ActivityType,
  ActivityStatus,
  TaskPriority,
  TaskStatus,
  ParticipantType,
  ParticipantRole,
  ParticipantStatus,
  BudgetCategory,
  EventPaymentMethod,
} from './event-types.ts';

// ---------------------------------------------------------------------
// ALLOWLIST MAPPERS (CỰU THÀNH VIÊN VÀ PUBLIC)
// ---------------------------------------------------------------------

export function toSafeAlumniActivityDto(raw: any): SafeAlumniActivityDto {
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: String(raw.description || ''),
    activityDate: String(raw.event_date || raw.eventDate || raw.activity_date || raw.activityDate || ''),
    location: String(raw.location || ''),
    status: (raw.status || 'PLANNING') as ActivityStatus,
  };
}

export function toSafePublicActivityDto(raw: any): SafePublicActivityDto {
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: String(raw.description || ''),
    eventType: (raw.event_type || raw.eventType || 'OTHER') as ActivityType,
    eventDate: String(raw.event_date || raw.eventDate || ''),
    startTime: raw.start_time || raw.startTime || null,
    endTime: raw.end_time || raw.endTime || null,
    location: raw.location ? String(raw.location) : null,
  };
}

// ---------------------------------------------------------------------
// DYNAMIC ROLE CHECK HELPER
// ---------------------------------------------------------------------

/**
 * Kiểm tra trạng thái tài khoản trực tiếp từ DB để đảm bảo không bị dùng token cũ sau khi bị hạ quyền / chuyển cựu / khóa
 */
export async function assertActiveInternalActor(
  db: Queryable,
  actor?: AuthenticatedActor | null
): Promise<AuthenticatedActor> {
  const current = requireInternalMember(actor);

  // Kiểm tra live từ DB
  const memberId = current.memberId || current.userId;
  const res = await db.query(
    'SELECT is_active, is_alumni, is_admin FROM members WHERE id = $1',
    [memberId]
  );

  if (res.rowCount === 0) {
    throw new ForbiddenError('Không tìm thấy thông tin thành viên.', 'MEMBER_NOT_FOUND');
  }

  const live = res.rows[0];
  if (!live.is_active) {
    throw new ForbiddenError('Tài khoản đã bị khóa hoặc vô hiệu hóa.', 'ACCOUNT_DISABLED');
  }
  if (live.is_alumni) {
    throw new ForbiddenError(
      'Cựu thành viên không có quyền thao tác nghiệp vụ sự kiện nội bộ.',
      'ALUMNI_MUTATION_FORBIDDEN'
    );
  }

  return current;
}

// ---------------------------------------------------------------------
// 1. TẠO VÀ LẤY HOẠT ĐỘNG / SỰ KIỆN
// ---------------------------------------------------------------------

export async function createActivity(
  db: Queryable,
  actor: AuthenticatedActor,
  req: CreateActivityRequest
): Promise<Activity> {
  await assertActiveInternalActor(db, actor);

  if (!req.title || !req.title.trim()) {
    throw new BadRequestError('Tiêu đề hoạt động/sự kiện không được để trống.', 'TITLE_REQUIRED');
  }
  if (!req.eventDate) {
    throw new BadRequestError('Ngày diễn ra sự kiện không được để trống.', 'EVENT_DATE_REQUIRED');
  }

  const id = crypto.randomUUID();
  const eventType = req.eventType || 'WORKSHOP';
  const budget = req.budget ? Math.max(0, req.budget) : 0;
  const memberId = actor.memberId || actor.userId;
  const now = new Date().toISOString();

  const insertSql = `
    INSERT INTO activities (
      id, title, description, event_type, event_date, start_time, end_time,
      location, budget, created_by, status, is_approved_for_public, is_approved_for_alumni,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id, title, description, event_type, event_date, start_time, end_time,
              location, budget, created_by, status, is_approved_for_public, is_approved_for_alumni,
              created_at, updated_at
  `;

  const res = await db.query(insertSql, [
    id,
    req.title.trim(),
    req.description || '',
    eventType,
    req.eventDate,
    req.startTime || null,
    req.endTime || null,
    req.location || null,
    budget,
    memberId,
    'PLANNING',
    Boolean(req.isApprovedForPublic),
    Boolean(req.isApprovedForAlumni),
    now,
    now,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type as ActivityType,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    budget: Number(row.budget),
    status: row.status as ActivityStatus,
    isApprovedForPublic: Boolean(row.is_approved_for_public),
    isApprovedForAlumni: Boolean(row.is_approved_for_alumni),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getActivities(
  db: Queryable,
  actor?: AuthenticatedActor | null
): Promise<Activity[] | SafeAlumniActivityDto[] | SafePublicActivityDto[]> {
  // 1. Nếu là Alumni: chỉ trả danh sách đã duyệt cho Alumni, qua Allowlist DTO
  if (actor && (actor.role === 'ALUMNI' || actor.isAlumni)) {
    const res = await db.query(
      `SELECT id, title, description, event_date, location, status
       FROM activities
       WHERE is_approved_for_alumni = TRUE
       ORDER BY event_date DESC, created_at DESC`
    );
    return res.rows.map(toSafeAlumniActivityDto);
  }

  // 2. Nếu là Guest hoặc Chưa đăng nhập: chỉ trả danh sách công khai đã duyệt
  if (!actor || actor.role === 'GUEST' || actor.role === 'ANONYMOUS') {
    const res = await db.query(
      `SELECT id, title, description, event_type, event_date, start_time, end_time, location
       FROM activities
       WHERE is_approved_for_public = TRUE
       ORDER BY event_date DESC, created_at DESC`
    );
    return res.rows.map(toSafePublicActivityDto);
  }

  // 3. Thành viên hoạt động hoặc Admin: trả đầy đủ danh sách nghiệp vụ
  const res = await db.query(
    `SELECT id, title, description, event_type, event_date, start_time, end_time,
            location, budget, created_by, status, is_approved_for_public, is_approved_for_alumni,
            created_at, updated_at
     FROM activities
     ORDER BY event_date DESC, created_at DESC`
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type as ActivityType,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    budget: Number(row.budget),
    status: row.status as ActivityStatus,
    isApprovedForPublic: Boolean(row.is_approved_for_public),
    isApprovedForAlumni: Boolean(row.is_approved_for_alumni),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getActivityById(
  db: Queryable,
  activityId: string,
  actor?: AuthenticatedActor | null
): Promise<ActivityDetailDto | SafeAlumniActivityDto | SafePublicActivityDto> {
  const res = await db.query(
    `SELECT id, title, description, event_type, event_date, start_time, end_time,
            location, budget, created_by, status, is_approved_for_public, is_approved_for_alumni,
            created_at, updated_at
     FROM activities
     WHERE id = $1`,
    [activityId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy hoạt động/sự kiện yêu cầu.', 'ACTIVITY_NOT_FOUND');
  }

  const row = res.rows[0];

  // 1. Phân quyền cho Alumni: kiểm tra allowlist và trả DTO an toàn
  if (actor && (actor.role === 'ALUMNI' || actor.isAlumni)) {
    if (!row.is_approved_for_alumni) {
      throw new ForbiddenError(
        'Sự kiện này chưa được phê duyệt hiển thị cho Cựu thành viên.',
        'ACTIVITY_NOT_APPROVED_FOR_ALUMNI'
      );
    }
    return toSafeAlumniActivityDto(row);
  }

  // 2. Phân quyền cho Khách / Vãng lai: kiểm tra công khai
  if (!actor || actor.role === 'GUEST' || actor.role === 'ANONYMOUS') {
    if (!row.is_approved_for_public) {
      throw new ForbiddenError(
        'Sự kiện này chưa được phê duyệt công khai.',
        'ACTIVITY_NOT_APPROVED_FOR_PUBLIC'
      );
    }
    return toSafePublicActivityDto(row);
  }

  // 3. Thành viên hoạt động / Admin: Tải đầy đủ chi tiết nghiệp vụ
  const activity: Activity = {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type as ActivityType,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    budget: Number(row.budget),
    status: row.status as ActivityStatus,
    isApprovedForPublic: Boolean(row.is_approved_for_public),
    isApprovedForAlumni: Boolean(row.is_approved_for_alumni),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Tải nhiệm vụ
  const tasksRes = await db.query(
    `SELECT t.id, t.activity_id, t.title, t.description, t.assignee_member_id,
            m.full_name AS assignee_name, t.due_date, t.priority, t.status,
            t.created_by, t.created_at, t.updated_at
     FROM activity_tasks t
     LEFT JOIN members m ON m.id = t.assignee_member_id
     WHERE t.activity_id = $1
     ORDER BY t.created_at ASC`,
    [activityId]
  );
  const tasks: ActivityTask[] = tasksRes.rows.map((t: any) => ({
    id: t.id,
    activityId: t.activity_id,
    title: t.title,
    description: t.description,
    assigneeMemberId: t.assignee_member_id,
    assigneeName: t.assignee_name || null,
    dueDate: t.due_date,
    priority: t.priority as TaskPriority,
    status: t.status as TaskStatus,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  // Tải người tham gia
  const partRes = await db.query(
    `SELECT p.id, p.activity_id, p.participant_type, p.member_id,
            m.full_name AS member_name, p.guest_name, p.guest_email, p.guest_phone,
            p.role, p.status, p.check_in_time, p.created_at
     FROM activity_participants p
     LEFT JOIN members m ON m.id = p.member_id
     WHERE p.activity_id = $1
     ORDER BY p.created_at ASC`,
    [activityId]
  );
  const participants: ActivityParticipant[] = partRes.rows.map((p: any) => ({
    id: p.id,
    activityId: p.activity_id,
    participantType: p.participant_type as ParticipantType,
    memberId: p.member_id,
    memberName: p.member_name || null,
    guestName: p.guest_name,
    guestEmail: p.guest_email,
    guestPhone: p.guest_phone,
    role: p.role as ParticipantRole,
    status: p.status as ParticipantStatus,
    checkInTime: p.check_in_time,
    createdAt: p.created_at,
  }));

  // Tải dự toán
  const budgetRes = await db.query(
    `SELECT id, activity_id, category, description, estimated_amount, created_at
     FROM activity_budget_items
     WHERE activity_id = $1
     ORDER BY created_at ASC`,
    [activityId]
  );
  const budgetItems: ActivityBudgetItem[] = budgetRes.rows.map((b: any) => ({
    id: b.id,
    activityId: b.activity_id,
    category: b.category as BudgetCategory,
    description: b.description,
    estimatedAmount: Number(b.estimated_amount),
    createdAt: b.created_at,
  }));

  // Tải chi phí thực tế
  const expRes = await db.query(
    `SELECT e.id, e.activity_id, e.budget_item_id, e.description, e.actual_amount,
            e.expense_date, e.payer_member_id, m.full_name AS payer_name,
            e.payment_method, e.receipt_ref, e.journal_entry_id, e.created_by, e.created_at
     FROM activity_expenses e
     LEFT JOIN members m ON m.id = e.payer_member_id
     WHERE e.activity_id = $1
     ORDER BY e.expense_date ASC, e.created_at ASC`,
    [activityId]
  );
  const expenses: ActivityExpense[] = expRes.rows.map((e: any) => ({
    id: e.id,
    activityId: e.activity_id,
    budgetItemId: e.budget_item_id,
    description: e.description,
    actualAmount: Number(e.actual_amount),
    expenseDate: e.expense_date,
    payerMemberId: e.payer_member_id,
    payerName: e.payer_name || null,
    paymentMethod: e.payment_method as EventPaymentMethod,
    receiptRef: e.receipt_ref,
    journalEntryId: e.journal_entry_id,
    createdBy: e.created_by,
    createdAt: e.created_at,
  }));

  // Tổng hợp tài chính: Budget vs Chi phí thực tế
  const totalBudget = budgetItems.reduce((acc, curr) => acc + curr.estimatedAmount, 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + curr.actualAmount, 0);
  const budgetVariance = totalBudget - totalExpense;

  return {
    activity,
    tasks,
    participants,
    budgetItems,
    expenses,
    financialSummary: {
      totalBudget,
      totalExpense,
      budgetVariance,
    },
  };
}

export async function updateActivity(
  db: Queryable,
  activityId: string,
  actor: AuthenticatedActor,
  req: UpdateActivityRequest
): Promise<Activity> {
  await assertActiveInternalActor(db, actor);

  const existingRes = await db.query('SELECT * FROM activities WHERE id = $1', [activityId]);
  if (existingRes.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy hoạt động cần cập nhật.', 'ACTIVITY_NOT_FOUND');
  }

  const existing = existingRes.rows[0];
  const title = req.title !== undefined ? req.title.trim() : existing.title;
  const description = req.description !== undefined ? req.description : existing.description;
  const eventType = req.eventType !== undefined ? req.eventType : existing.event_type;
  const eventDate = req.eventDate !== undefined ? req.eventDate : existing.event_date;
  const startTime = req.startTime !== undefined ? req.startTime : existing.start_time;
  const endTime = req.endTime !== undefined ? req.endTime : existing.end_time;
  const location = req.location !== undefined ? req.location : existing.location;
  const budget = req.budget !== undefined ? Math.max(0, req.budget) : Number(existing.budget);
  const status = req.status !== undefined ? req.status : existing.status;
  const isApprovedForPublic =
    req.isApprovedForPublic !== undefined ? Boolean(req.isApprovedForPublic) : Boolean(existing.is_approved_for_public);
  const isApprovedForAlumni =
    req.isApprovedForAlumni !== undefined ? Boolean(req.isApprovedForAlumni) : Boolean(existing.is_approved_for_alumni);
  const now = new Date().toISOString();

  const updateSql = `
    UPDATE activities
    SET title = $1, description = $2, event_type = $3, event_date = $4,
        start_time = $5, end_time = $6, location = $7, budget = $8,
        status = $9, is_approved_for_public = $10, is_approved_for_alumni = $11,
        updated_at = $12
    WHERE id = $13
    RETURNING id, title, description, event_type, event_date, start_time, end_time,
              location, budget, created_by, status, is_approved_for_public, is_approved_for_alumni,
              created_at, updated_at
  `;

  const res = await db.query(updateSql, [
    title,
    description,
    eventType,
    eventDate,
    startTime,
    endTime,
    location,
    budget,
    status,
    isApprovedForPublic,
    isApprovedForAlumni,
    now,
    activityId,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type as ActivityType,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    budget: Number(row.budget),
    status: row.status as ActivityStatus,
    isApprovedForPublic: Boolean(row.is_approved_for_public),
    isApprovedForAlumni: Boolean(row.is_approved_for_alumni),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------
// 2. NHIỆM VỤ VÀ NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL)
// ---------------------------------------------------------------------

export async function createTask(
  db: Queryable,
  activityId: string,
  actor: AuthenticatedActor,
  req: CreateTaskRequest
): Promise<ActivityTask> {
  await assertActiveInternalActor(db, actor);

  if (!req.title || !req.title.trim()) {
    throw new BadRequestError('Tiêu đề nhiệm vụ không được để trống.', 'TASK_TITLE_REQUIRED');
  }

  const actCheck = await db.query('SELECT id FROM activities WHERE id = $1', [activityId]);
  if (actCheck.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy hoạt động để gán nhiệm vụ.', 'ACTIVITY_NOT_FOUND');
  }

  const id = crypto.randomUUID();
  const priority = req.priority || 'MEDIUM';
  const memberId = actor.memberId || actor.userId;
  const now = new Date().toISOString();

  const insertSql = `
    INSERT INTO activity_tasks (
      id, activity_id, title, description, assignee_member_id, due_date,
      priority, status, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, activity_id, title, description, assignee_member_id, due_date,
              priority, status, created_by, created_at, updated_at
  `;

  const res = await db.query(insertSql, [
    id,
    activityId,
    req.title.trim(),
    req.description || null,
    req.assigneeMemberId || null,
    req.dueDate || null,
    priority,
    'TODO',
    memberId,
    now,
    now,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    activityId: row.activity_id,
    title: row.title,
    description: row.description,
    assigneeMemberId: row.assignee_member_id,
    dueDate: row.due_date,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateTask(
  db: Queryable,
  taskId: string,
  actor: AuthenticatedActor,
  req: UpdateTaskRequest
): Promise<ActivityTask> {
  await assertActiveInternalActor(db, actor);

  // Gate bắt buộc: Sửa nhiệm vụ phải có lý do để lưu audit log
  if (!req.reason || !req.reason.trim()) {
    throw new BadRequestError(
      'Bắt buộc cung cấp lý do khi chỉnh sửa nhiệm vụ để lưu nhật ký kiểm toán.',
      'REASON_REQUIRED'
    );
  }

  const existingRes = await db.query('SELECT * FROM activity_tasks WHERE id = $1', [taskId]);
  if (existingRes.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy nhiệm vụ cần sửa.', 'TASK_NOT_FOUND');
  }

  const current = existingRes.rows[0];
  const memberId = actor.memberId || actor.userId;
  const now = new Date().toISOString();

  // Theo dõi các trường thay đổi để ghi vào activity_task_history
  const changes: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];

  if (req.title !== undefined && req.title.trim() !== current.title) {
    changes.push({ fieldName: 'title', oldValue: current.title, newValue: req.title.trim() });
  }
  if (req.description !== undefined && req.description !== current.description) {
    changes.push({ fieldName: 'description', oldValue: current.description, newValue: req.description || null });
  }
  if (req.assigneeMemberId !== undefined && req.assigneeMemberId !== current.assignee_member_id) {
    changes.push({
      fieldName: 'assignee_member_id',
      oldValue: current.assignee_member_id,
      newValue: req.assigneeMemberId || null,
    });
  }
  if (req.dueDate !== undefined && req.dueDate !== current.due_date) {
    changes.push({ fieldName: 'due_date', oldValue: current.due_date, newValue: req.dueDate || null });
  }
  if (req.priority !== undefined && req.priority !== current.priority) {
    changes.push({ fieldName: 'priority', oldValue: current.priority, newValue: req.priority });
  }
  if (req.status !== undefined && req.status !== current.status) {
    changes.push({ fieldName: 'status', oldValue: current.status, newValue: req.status });
  }

  // Ghi audit log cho từng thay đổi
  for (const c of changes) {
    await db.query(
      `INSERT INTO activity_task_history (id, task_id, changed_by, field_name, old_value, new_value, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [crypto.randomUUID(), taskId, memberId, c.fieldName, c.oldValue, c.newValue, req.reason.trim(), now]
    );
  }

  // Cập nhật bản ghi task
  const newTitle = req.title !== undefined ? req.title.trim() : current.title;
  const newDesc = req.description !== undefined ? req.description : current.description;
  const newAssignee = req.assigneeMemberId !== undefined ? req.assigneeMemberId : current.assignee_member_id;
  const newDue = req.dueDate !== undefined ? req.dueDate : current.due_date;
  const newPriority = req.priority !== undefined ? req.priority : current.priority;
  const newStatus = req.status !== undefined ? req.status : current.status;

  const updateSql = `
    UPDATE activity_tasks
    SET title = $1, description = $2, assignee_member_id = $3,
        due_date = $4, priority = $5, status = $6, updated_at = $7
    WHERE id = $8
    RETURNING id, activity_id, title, description, assignee_member_id, due_date,
              priority, status, created_by, created_at, updated_at
  `;

  const res = await db.query(updateSql, [
    newTitle,
    newDesc,
    newAssignee,
    newDue,
    newPriority,
    newStatus,
    now,
    taskId,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    activityId: row.activity_id,
    title: row.title,
    description: row.description,
    assigneeMemberId: row.assignee_member_id,
    dueDate: row.due_date,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTaskHistory(
  db: Queryable,
  taskId: string,
  actor: AuthenticatedActor
): Promise<ActivityTaskHistory[]> {
  await assertActiveInternalActor(db, actor);

  const res = await db.query(
    `SELECT h.id, h.task_id, h.changed_by, m.full_name AS changed_by_name,
            h.field_name, h.old_value, h.new_value, h.reason, h.created_at
     FROM activity_task_history h
     LEFT JOIN members m ON m.id = h.changed_by
     WHERE h.task_id = $1
     ORDER BY h.created_at DESC`,
    [taskId]
  );

  return res.rows.map((h: any) => ({
    id: h.id,
    taskId: h.task_id,
    changedBy: h.changed_by,
    changedByName: h.changed_by_name || null,
    fieldName: h.field_name,
    oldValue: h.old_value,
    newValue: h.new_value,
    reason: h.reason,
    createdAt: h.created_at,
  }));
}

// ---------------------------------------------------------------------
// 3. NGƯỜI THAM GIA (THÀNH VIÊN HOẶC KHÁCH - R07 COMPLIANT)
// ---------------------------------------------------------------------

export async function addParticipant(
  db: Queryable,
  activityId: string,
  actor: AuthenticatedActor,
  req: AddParticipantRequest
): Promise<ActivityParticipant> {
  await assertActiveInternalActor(db, actor);

  const actCheck = await db.query('SELECT id FROM activities WHERE id = $1', [activityId]);
  if (actCheck.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy sự kiện để thêm người tham gia.', 'ACTIVITY_NOT_FOUND');
  }

  // R07 Compliance: Thành viên hoặc khách; khách không cần MSSV, không ép thành member
  if (req.participantType === 'MEMBER') {
    if (!req.memberId) {
      throw new BadRequestError('Thiếu ID thành viên (memberId) cho người tham gia loại MEMBER.', 'MEMBER_ID_REQUIRED');
    }
    const memCheck = await db.query('SELECT id FROM members WHERE id = $1', [req.memberId]);
    if (memCheck.rowCount === 0) {
      throw new NotFoundError('Thành viên không tồn tại trong hệ thống.', 'MEMBER_NOT_FOUND');
    }
  } else if (req.participantType === 'GUEST') {
    if (!req.guestName || !req.guestName.trim()) {
      throw new BadRequestError('Bắt buộc nhập họ và tên khách tham gia (guestName).', 'GUEST_NAME_REQUIRED');
    }
    // Không yêu cầu mã sinh viên hay trường lớp
  } else {
    throw new BadRequestError('Loại người tham gia không hợp lệ (phải là MEMBER hoặc GUEST).', 'INVALID_PARTICIPANT_TYPE');
  }

  const id = crypto.randomUUID();
  const role = req.role || 'ATTENDEE';
  const now = new Date().toISOString();

  const insertSql = `
    INSERT INTO activity_participants (
      id, activity_id, participant_type, member_id, guest_name, guest_email,
      guest_phone, role, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, activity_id, participant_type, member_id, guest_name, guest_email,
              guest_phone, role, status, check_in_time, created_at
  `;

  const res = await db.query(insertSql, [
    id,
    activityId,
    req.participantType,
    req.participantType === 'MEMBER' ? req.memberId : null,
    req.participantType === 'GUEST' ? req.guestName?.trim() : null,
    req.participantType === 'GUEST' ? req.guestEmail?.trim() || null : null,
    req.participantType === 'GUEST' ? req.guestPhone?.trim() || null : null,
    role,
    'REGISTERED',
    now,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    activityId: row.activity_id,
    participantType: row.participant_type as ParticipantType,
    memberId: row.member_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    role: row.role as ParticipantRole,
    status: row.status as ParticipantStatus,
    checkInTime: row.check_in_time,
    createdAt: row.created_at,
  };
}

export async function updateParticipant(
  db: Queryable,
  participantId: string,
  actor: AuthenticatedActor,
  req: UpdateParticipantRequest
): Promise<ActivityParticipant> {
  await assertActiveInternalActor(db, actor);

  const existingRes = await db.query('SELECT * FROM activity_participants WHERE id = $1', [participantId]);
  if (existingRes.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy người tham gia.', 'PARTICIPANT_NOT_FOUND');
  }

  const current = existingRes.rows[0];
  const role = req.role !== undefined ? req.role : current.role;
  const status = req.status !== undefined ? req.status : current.status;
  const checkInTime =
    req.checkInTime !== undefined ? req.checkInTime : status === 'ATTENDED' ? new Date().toISOString() : current.check_in_time;

  const updateSql = `
    UPDATE activity_participants
    SET role = $1, status = $2, check_in_time = $3
    WHERE id = $4
    RETURNING id, activity_id, participant_type, member_id, guest_name, guest_email,
              guest_phone, role, status, check_in_time, created_at
  `;

  const res = await db.query(updateSql, [role, status, checkInTime, participantId]);
  const row = res.rows[0];
  return {
    id: row.id,
    activityId: row.activity_id,
    participantType: row.participant_type as ParticipantType,
    memberId: row.member_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    role: row.role as ParticipantRole,
    status: row.status as ParticipantStatus,
    checkInTime: row.check_in_time,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------
// 4. DỰ TOÁN KẾ HOẠCH (BUDGETS) VÀ CHI PHÍ THỰC TẾ (EXPENSES - SINGLE COUNT)
// ---------------------------------------------------------------------

export async function createBudgetItem(
  db: Queryable,
  activityId: string,
  actor: AuthenticatedActor,
  req: CreateBudgetItemRequest
): Promise<ActivityBudgetItem> {
  await assertActiveInternalActor(db, actor);

  if (!req.description || !req.description.trim()) {
    throw new BadRequestError('Mô tả khoản dự toán không được để trống.', 'DESCRIPTION_REQUIRED');
  }
  if (req.estimatedAmount < 0) {
    throw new BadRequestError('Số tiền dự toán không được âm.', 'INVALID_BUDGET_AMOUNT');
  }

  const actCheck = await db.query('SELECT id FROM activities WHERE id = $1', [activityId]);
  if (actCheck.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy hoạt động để lập dự toán.', 'ACTIVITY_NOT_FOUND');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const insertSql = `
    INSERT INTO activity_budget_items (id, activity_id, category, description, estimated_amount, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, activity_id, category, description, estimated_amount, created_at
  `;

  const res = await db.query(insertSql, [
    id,
    activityId,
    req.category,
    req.description.trim(),
    req.estimatedAmount,
    now,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    activityId: row.activity_id,
    category: row.category as BudgetCategory,
    description: row.description,
    estimatedAmount: Number(row.estimated_amount),
    createdAt: row.created_at,
  };
}

export async function recordExpense(
  db: Queryable,
  activityId: string,
  actor: AuthenticatedActor,
  req: RecordExpenseRequest
): Promise<ActivityExpense> {
  await assertActiveInternalActor(db, actor);

  if (req.actualAmount <= 0) {
    throw new BadRequestError('Số tiền chi thực tế phải lớn hơn 0.', 'INVALID_EXPENSE_AMOUNT');
  }
  if (!req.description || !req.description.trim()) {
    throw new BadRequestError('Mô tả khoản chi không được để trống.', 'DESCRIPTION_REQUIRED');
  }
  if (!req.expenseDate) {
    throw new BadRequestError('Ngày chi phí không được để trống.', 'EXPENSE_DATE_REQUIRED');
  }

  const actCheck = await db.query('SELECT id, title FROM activities WHERE id = $1', [activityId]);
  if (actCheck.rowCount === 0) {
    throw new NotFoundError('Không tìm thấy sự kiện để ghi nhận chi phí.', 'ACTIVITY_NOT_FOUND');
  }
  const activity = actCheck.rows[0];

  // Kiểm tra người chi tiền là thành viên
  const payerCheck = await db.query('SELECT id FROM members WHERE id = $1', [req.payerMemberId]);
  if (payerCheck.rowCount === 0) {
    throw new NotFoundError('Thành viên chi tiền không tồn tại.', 'PAYER_NOT_FOUND');
  }

  const expenseId = crypto.randomUUID();
  const memberId = actor.memberId || actor.userId;
  const now = new Date().toISOString();

  // Bút toán sổ kép: Liên kết trực tiếp vào Quỹ Hoạt Động (FUND_OPERATION)
  // Debit: Chi phí hoạt động sự kiện (ACCOUNT_CODES.ACTIVITY_EXPENSE)
  // Credit: Nguồn tiền xuất chi (TIEN_MAT_HOP hoặc TIEN_NGAN_HANG)
  const creditAccount =
    req.paymentMethod === 'CASH' ? ACCOUNT_CODES.CASH_DRAWER : ACCOUNT_CODES.BANK_MAIN;

  const entryCode = `EXP-EVT-${activityId.substring(0, 8)}-${Date.now()}`;
  const journal = await recordJournalEntry(db, {
    entryCode,
    fundId: FUND_IDS.OPERATION,
    sourceType: 'ACTIVITY_EXPENSE',
    sourceId: expenseId,
    debitAccount: ACCOUNT_CODES.ACTIVITY_EXPENSE,
    creditAccount,
    amount: BigInt(req.actualAmount),
    createdBy: memberId,
    notes: `Chi phí sự kiện [${activity.title}]: ${req.description.trim()}`,
  });

  const insertSql = `
    INSERT INTO activity_expenses (
      id, activity_id, budget_item_id, description, actual_amount,
      expense_date, payer_member_id, payment_method, receipt_ref,
      journal_entry_id, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, activity_id, budget_item_id, description, actual_amount,
              expense_date, payer_member_id, payment_method, receipt_ref,
              journal_entry_id, created_by, created_at
  `;

  const res = await db.query(insertSql, [
    expenseId,
    activityId,
    req.budgetItemId || null,
    req.description.trim(),
    req.actualAmount,
    req.expenseDate,
    req.payerMemberId,
    req.paymentMethod,
    req.receiptRef || null,
    journal.id,
    memberId,
    now,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    activityId: row.activity_id,
    budgetItemId: row.budget_item_id,
    description: row.description,
    actualAmount: Number(row.actual_amount),
    expenseDate: row.expense_date,
    payerMemberId: row.payer_member_id,
    paymentMethod: row.payment_method as EventPaymentMethod,
    receiptRef: row.receipt_ref,
    journalEntryId: row.journal_entry_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
