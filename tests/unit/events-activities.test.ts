/**
 * Bộ kiểm thử đơn vị: Chặng 19 - Hoạt Động, Sự Kiện và Nhiệm Vụ Liên Kết Quỹ (FR-06)
 *
 * Kiểm tra toàn diện 6 gates bắt buộc:
 * 1. G-expense-ledger-link: Chi thực tế liên kết journal_entries (FUND_OPERATION) đếm đúng một lần duy nhất.
 * 2. G-guest-flexibility: Khách ngoài không cần MSSV, không bị ép thành member (R07 compliance).
 * 3. G-alumni-privacy: Cựu thành viên (ALUMNI) chỉ nhận Allowlist DTO, lọc sạch 100% tài chính và PII.
 * 4. G-dynamic-role-revocation: Chuyển vai trò sang ALUMNI hoặc khóa tài khoản chặn ngay lập tức request mới.
 * 5. G-task-audit: Sửa nhiệm vụ bắt buộc nhập lý do, ghi nhật ký kiểm toán activity_task_history.
 * 6. G-budget-vs-actual: Dự toán tách biệt với chi thực tế, phân biệt rõ totalBudget vs totalExpense.
 */

import { test, describe, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  createActivity,
  getActivities,
  getActivityById,
  createTask,
  updateTask,
  getTaskHistory,
  addParticipant,
  createBudgetItem,
  recordExpense,
} from '../../src/modules/events/service.ts';
import { FUND_IDS, ACCOUNT_CODES } from '../../src/server/finance/types.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

describe('Chặng 19: Hoạt Động, Sự Kiện và Nhiệm Vụ Liên Kết Quỹ', () => {
  let db: MockCashDbQueryable;

  const internalActor: AuthenticatedActor = {
    userId: '11111111-1111-4111-8111-111111111111',
    memberId: '11111111-1111-4111-8111-111111111111',
    username: 'truong_bcn',
    role: 'MEMBER',
    team: 'BAN_CHU_NHIEM',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  const alumniActor: AuthenticatedActor = {
    userId: '22222222-2222-4222-8222-222222222222',
    memberId: '22222222-2222-4222-8222-222222222222',
    username: 'cuu_thanh_vien',
    role: 'ALUMNI',
    team: 'HET_NHIEM_KY',
    isActive: true,
    isAlumni: true,
    tokenVersion: 1,
  };

  const guestActor: AuthenticatedActor = {
    userId: '33333333-3333-4333-8333-333333333333',
    username: 'khach_vang_lai',
    role: 'GUEST',
    isActive: true,
    isAlumni: false,
    tokenVersion: 1,
  };

  beforeEach(() => {
    db = new MockCashDbQueryable();

    // Khởi tạo thành viên hợp lệ
    db.members = [
      {
        id: internalActor.memberId,
        username: internalActor.username,
        full_name: 'Nguyễn Văn Chủ Nhiệm',
        team: 'BAN_CHU_NHIEM',
        is_active: true,
        is_alumni: false,
        is_admin: false,
      },
      {
        id: alumniActor.memberId,
        username: alumniActor.username,
        full_name: 'Trần Cựu Thành Viên',
        team: 'HET_NHIEM_KY',
        is_active: true,
        is_alumni: true,
        is_admin: false,
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        username: 'thanh_vien_thu_quy',
        full_name: 'Lê Thủ Quỹ',
        team: 'HAU_CAN',
        is_active: true,
        is_alumni: false,
        is_admin: false,
      },
    ];
  });

  // -------------------------------------------------------------------
  // GATE 1: G-expense-ledger-link (Chi phí đếm một lần liên kết Quỹ Hoạt Động)
  // -------------------------------------------------------------------
  test('G-expense-ledger-link: Chi thực tế sự kiện chỉ đếm một lần trong sổ quỹ FUND_OPERATION', async () => {
    // 1. Tạo sự kiện
    const event = await createActivity(db, internalActor, {
      title: 'Hội Sách Khai Giảng 2026',
      eventDate: '2026-11-01',
      budget: 1500000,
    });

    // 2. Lập dự toán 1 triệu
    const budgetItem = await createBudgetItem(db, event.id, internalActor, {
      category: 'REFRESHMENTS',
      description: 'Tiệc trà đón tiếp đại biểu',
      estimatedAmount: 1000000,
    });

    // 3. Ghi nhận chi phí thực tế 850.000đ bằng tiền mặt
    const expense = await recordExpense(db, event.id, internalActor, {
      budgetItemId: budgetItem.id,
      description: 'Hóa đơn bánh ngọt và nước hoa quả',
      actualAmount: 850000,
      expenseDate: '2026-11-01',
      payerMemberId: '44444444-4444-4444-8444-444444444444',
      paymentMethod: 'CASH',
      receiptRef: 'HD-8901',
    });

    assert.ok(expense.id, 'Chi phí phải có ID');
    assert.strictEqual(expense.actualAmount, 850000);
    assert.ok(expense.journalEntryId, 'Bắt buộc liên kết bút toán sổ cái');

    // 4. Kiểm tra trong journal_entries
    const je = db.journalEntries.find((j) => j.id === expense.journalEntryId);
    assert.ok(je, 'Phải tìm thấy bút toán tương ứng trong sổ cái');
    assert.strictEqual(je.fund_id, FUND_IDS.OPERATION, 'Phải ghi vào Quỹ Hoạt Động FUND_OPERATION');
    assert.strictEqual(je.debit_account, ACCOUNT_CODES.ACTIVITY_EXPENSE, 'Nợ tài khoản Chi hoạt động sự kiện');
    assert.strictEqual(je.credit_account, ACCOUNT_CODES.CASH_DRAWER, 'Có tài khoản Tiền mặt hộp quỹ');
    assert.strictEqual(BigInt(je.amount), 850000n, 'Số tiền ghi sổ kép phải khớp');

    // 5. Đảm bảo đúng 1 bút toán sổ kép được ghi nhận cho khoản chi này (Không nhân đôi)
    const matchingEntries = db.journalEntries.filter(
      (j) => j.source_type === 'ACTIVITY_EXPENSE' && j.source_id === expense.id
    );
    assert.strictEqual(matchingEntries.length, 1, 'Chỉ có duy nhất 1 bút toán sổ kép cho khoản chi này');

    // 6. Xem chi tiết sự kiện
    const detail = (await getActivityById(db, event.id, internalActor)) as any;
    assert.strictEqual(detail.financialSummary.totalBudget, 1000000);
    assert.strictEqual(detail.financialSummary.totalExpense, 850000);
    assert.strictEqual(detail.financialSummary.budgetVariance, 150000);
  });

  // -------------------------------------------------------------------
  // GATE 2: G-guest-flexibility (Khách ngoài không cần MSSV, không ép thành member)
  // -------------------------------------------------------------------
  test('G-guest-flexibility: Khách tham gia không cần MSSV và không bị ép thành member (R07)', async () => {
    const event = await createActivity(db, internalActor, {
      title: 'Tọa Đàm Văn Hóa Đọc Mở Rộng',
      eventDate: '2026-11-15',
    });

    // Thêm khách vãng lai
    const guestParticipant = await addParticipant(db, event.id, internalActor, {
      participantType: 'GUEST',
      guestName: 'Nguyễn Thị Khách Vãng Lai',
      guestEmail: 'khach.ngoai@gmail.com',
      role: 'ATTENDEE',
    });

    assert.ok(guestParticipant.id);
    assert.strictEqual(guestParticipant.participantType, 'GUEST');
    assert.strictEqual(guestParticipant.guestName, 'Nguyễn Thị Khách Vãng Lai');
    assert.strictEqual(guestParticipant.memberId, null, 'Khách ngoài không có memberId');

    // Kiểm tra không bị chèn vào bảng members
    const fakeMember = db.members.find((m) => m.full_name === 'Nguyễn Thị Khách Vãng Lai');
    assert.strictEqual(fakeMember, undefined, 'Khách ngoài tuyệt đối không bị chèn vào members');

    // Khách ngoài thiếu tên phải bị từ chối 400
    await assert.rejects(
      async () => {
        await addParticipant(db, event.id, internalActor, {
          participantType: 'GUEST',
          guestName: '',
        });
      },
      { name: 'BadRequestError' },
      'Thiếu tên khách phải bị chặn'
    );

    // Khách vãng lai truy vấn danh sách sự kiện công khai qua allowlist
    const publicList = (await getActivities(db, guestActor)) as any[];
    assert.ok(Array.isArray(publicList));
  });

  // -------------------------------------------------------------------
  // GATE 3: G-alumni-privacy (Cựu thành viên nhận Allowlist DTO, lọc sạch tài chính/PII)
  // -------------------------------------------------------------------
  test('G-alumni-privacy: Cựu thành viên chỉ nhận Allowlist DTO, bị ẩn toàn bộ tài chính và thông tin nhạy cảm', async () => {
    // 1. Tạo sự kiện đã duyệt cho Alumni
    const approvedEvent = await createActivity(db, internalActor, {
      title: 'Kỷ Niệm 10 Năm Thành Lập CLB Sách YSBK',
      description: 'Gặp gỡ các thế hệ thành viên CLB',
      eventDate: '2026-12-20',
      location: 'Hội trường C2',
      budget: 10000000,
      isApprovedForAlumni: true,
      isApprovedForPublic: false,
    });

    // Thêm dự toán & chi phí nhạy cảm
    await createBudgetItem(db, approvedEvent.id, internalActor, {
      category: 'VENUE',
      description: 'Thuê hội trường và âm thanh',
      estimatedAmount: 5000000,
    });

    // Thêm khách với thông tin liên hệ riêng
    await addParticipant(db, approvedEvent.id, internalActor, {
      participantType: 'GUEST',
      guestName: 'Khách VIP',
      guestPhone: '0912345678',
      guestEmail: 'vip@private.com',
    });

    // 2. Tạo sự kiện chưa duyệt cho Alumni
    const unapprovedEvent = await createActivity(db, internalActor, {
      title: 'Họp Kiểm Điểm Nội Bộ Ban Chủ Nhiệm',
      eventDate: '2026-12-25',
      isApprovedForAlumni: false,
    });

    // 3. Alumni lấy danh sách sự kiện
    const alumniList = (await getActivities(db, alumniActor)) as any[];
    assert.strictEqual(alumniList.length, 1, 'Chỉ thấy 1 sự kiện đã được duyệt cho Alumni');
    assert.strictEqual(alumniList[0].id, approvedEvent.id);

    // Kiểm tra cấu trúc Allowlist DTO: Không có budget, tasks, participants, expenses
    const item = alumniList[0];
    assert.strictEqual(item.title, 'Kỷ Niệm 10 Năm Thành Lập CLB Sách YSBK');
    assert.strictEqual(item.budget, undefined, 'DTO của Alumni tuyệt đối không chứa trường budget');
    assert.strictEqual(item.tasks, undefined, 'DTO của Alumni tuyệt đối không chứa tasks');
    assert.strictEqual(item.participants, undefined, 'DTO của Alumni tuyệt đối không chứa participants');
    assert.strictEqual(item.expenses, undefined, 'DTO của Alumni tuyệt đối không chứa expenses');

    // 4. Alumni truy cập trực tiếp sự kiện chưa duyệt -> Phải bị từ chối 403
    await assert.rejects(
      async () => {
        await getActivityById(db, unapprovedEvent.id, alumniActor);
      },
      { name: 'ForbiddenError' },
      'Alumni truy cập sự kiện chưa duyệt phải bị 403'
    );
  });

  // -------------------------------------------------------------------
  // GATE 4: G-dynamic-role-revocation (Chuyển vai trò chặn ngay mutation mới)
  // -------------------------------------------------------------------
  test('G-dynamic-role-revocation: Chuyển vai trò sang ALUMNI hoặc khóa tài khoản chặn ngay lập tức request sửa đổi', async () => {
    const event = await createActivity(db, internalActor, {
      title: 'Workshop Kỹ Năng Đọc Nhanh',
      eventDate: '2026-11-20',
    });

    // Cố tình dùng tài khoản Alumni để tạo nhiệm vụ -> Bị chặn ngay
    await assert.rejects(
      async () => {
        await createTask(db, event.id, alumniActor, {
          title: 'Chuẩn bị tài liệu workshop',
        });
      },
      { name: 'ForbiddenError' },
      'Alumni không có quyền tạo nhiệm vụ'
    );

    // Giả lập admin khóa tài khoản của internalActor trong DB
    const mem = db.members.find((m) => m.id === internalActor.memberId);
    mem.is_active = false;

    // Thành viên dù còn token cũ nhưng DB đã khóa -> Bị chặn ngay lập tức
    await assert.rejects(
      async () => {
        await createTask(db, event.id, internalActor, {
          title: 'Nhiệm vụ bị chặn do tài khoản bị khóa',
        });
      },
      { name: 'ForbiddenError' },
      'Tài khoản bị khóa phải bị chặn ngay lập tức'
    );
  });

  // -------------------------------------------------------------------
  // GATE 5: G-task-audit (Sửa nhiệm vụ có audit log bắt buộc lý do)
  // -------------------------------------------------------------------
  test('G-task-audit: Sửa nhiệm vụ bắt buộc nhập lý do và ghi nhận audit log lịch sử thay đổi', async () => {
    const event = await createActivity(db, internalActor, {
      title: 'Talkshow Tác Giả & Tác Phẩm',
      eventDate: '2026-11-25',
    });

    const task = await createTask(db, event.id, internalActor, {
      title: 'Liên hệ diễn giả',
      description: 'Mời nhà văn tham gia tọa đàm',
      priority: 'HIGH',
    });

    // Sửa nhiệm vụ nhưng không cung cấp lý do -> Bị từ chối 400
    await assert.rejects(
      async () => {
        await updateTask(db, task.id, internalActor, {
          status: 'DONE',
          reason: '',
        });
      },
      { name: 'BadRequestError' },
      'Bắt buộc cung cấp lý do khi sửa nhiệm vụ'
    );

    // Sửa nhiệm vụ hợp lệ kèm lý do
    const updated = await updateTask(db, task.id, internalActor, {
      status: 'DONE',
      priority: 'URGENT',
      reason: 'Diễn giả đã xác nhận nhận lời mời tham gia qua email',
    });

    assert.strictEqual(updated.status, 'DONE');
    assert.strictEqual(updated.priority, 'URGENT');

    // Kiểm tra lịch sử audit log
    const history = await getTaskHistory(db, task.id, internalActor);
    assert.strictEqual(history.length, 2, 'Ghi nhận 2 trường thay đổi: status và priority');

    const statusChange = history.find((h) => h.fieldName === 'status');
    assert.ok(statusChange);
    assert.strictEqual(statusChange.oldValue, 'TODO');
    assert.strictEqual(statusChange.newValue, 'DONE');
    assert.strictEqual(statusChange.reason, 'Diễn giả đã xác nhận nhận lời mời tham gia qua email');
    assert.strictEqual(statusChange.changedBy, internalActor.memberId);
  });

  // -------------------------------------------------------------------
  // GATE 6: G-budget-vs-actual (Dự toán tách biệt chi phí thực tế)
  // -------------------------------------------------------------------
  test('G-budget-vs-actual: Dự toán ước tính tách biệt hoàn toàn với chi thực tế', async () => {
    const event = await createActivity(db, internalActor, {
      title: 'Sinh Hoạt CLB Tháng 12',
      eventDate: '2026-12-05',
    });

    // Thêm 2 khoản dự toán: 300k và 500k -> Tổng dự toán = 800k
    await createBudgetItem(db, event.id, internalActor, {
      category: 'PRINTING',
      description: 'In tài liệu sinh hoạt',
      estimatedAmount: 300000,
    });
    await createBudgetItem(db, event.id, internalActor, {
      category: 'REFRESHMENTS',
      description: 'Bánh ngọt',
      estimatedAmount: 500000,
    });

    // Chi thực tế chỉ mới chi 250k
    const payerId = internalActor.memberId || internalActor.userId;
    await recordExpense(db, event.id, internalActor, {
      description: 'In ấn thực tế tại tiệm photo',
      actualAmount: 250000,
      expenseDate: '2026-12-04',
      payerMemberId: payerId,
      paymentMethod: 'CASH',
    });

    const detail = (await getActivityById(db, event.id, internalActor)) as any;
    assert.strictEqual(detail.budgetItems.length, 2);
    assert.strictEqual(detail.expenses.length, 1);
    assert.strictEqual(detail.financialSummary.totalBudget, 800000);
    assert.strictEqual(detail.financialSummary.totalExpense, 250000);
    assert.strictEqual(detail.financialSummary.budgetVariance, 550000);
  });
});
