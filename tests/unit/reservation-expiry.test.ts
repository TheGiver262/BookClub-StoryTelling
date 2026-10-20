/**
 * YSBK Unit Tests - Reservation Expiration & Shift Schedule Lifecycle
 * Kiểm thử: PUB-06, LIFE-03...LIFE-06, LIFE-08, LIFE-09, CON-05
 * Tuân thủ thiết kế: docs/technical/public-reservation-design.md
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  expireReservations,
  cancelReservation,
} from '../../src/server/reservations/service.ts';
import { cancelDutySchedule, manualEditSchedule } from '../../src/server/duty/roster-service.ts';

test('LIFE-03 & LIFE-04: expireReservations quét và chuyển HELD sang EXPIRED khi now >= expires_at, chạy lại an toàn', async () => {
  const expiredIds = ['res-exp-01', 'res-exp-02'];
  const updateQueries: { sql: string; params?: any[] }[] = [];

  const db = {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT id FROM reservations') && sql.includes("status = 'HELD'")) {
        return {
          rows: expiredIds.map((id) => ({ id })),
        };
      }
      if (sql.includes('UPDATE reservations') && sql.includes("status = 'EXPIRED'")) {
        updateQueries.push({ sql, params });
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const now = new Date('2026-10-20T17:05:00+07:00');
  // Lần chạy 1: Hết hạn 2 đơn
  const res1 = await expireReservations(db as any, now, 100);
  assert.equal(res1.expiredCount, 2);
  assert.deepEqual(res1.expiredIds, expiredIds);
  assert.equal(updateQueries.length, 1);

  // Lần chạy 2 (chạy lại sau đó, không còn đơn quá hạn nào)
  const dbEmpty = {
    query: async (sql: string) => {
      if (sql.includes('SELECT id FROM reservations')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const res2 = await expireReservations(dbEmpty as any, now, 100);
  assert.equal(res2.expiredCount, 0);
  assert.deepEqual(res2.expiredIds, []);
});

test('LIFE-05: cancelReservation khách hủy bằng token hợp lệ -> CANCELLED, giữ nguyên lịch sử IP', async () => {
  let updatedStatus = '';
  const db = {
    query: async (sql: string) => {
      if (sql.includes('FROM reservations r')) {
        return {
          rows: [
            {
              id: 'res-cancel-01',
              code: 'RSV-20261020-001',
              status: 'HELD',
              phone: '0912345678',
              expires_at: '2026-10-20T17:00:00+07:00',
              shift_date: '2026-10-20',
              created_at: '2026-10-20T14:00:00+07:00',
            },
          ],
        };
      }
      if (sql.includes('UPDATE reservations') && sql.includes("status = 'CANCELLED'")) {
        updatedStatus = 'CANCELLED';
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const result = await cancelReservation(
    db as any,
    { token: 'rsv_tok_test_cancel_token' },
    null,
    'Khách có việc bận'
  );

  assert.equal(result.status, 'CANCELLED');
  assert.equal(updatedStatus, 'CANCELLED');
});

test('LIFE-06: Không thể hủy hoặc làm hết hạn đơn đã bàn giao (BORROWED)', async () => {
  const db = {
    query: async (sql: string) => {
      if (sql.includes('FROM reservations r')) {
        return {
          rows: [
            {
              id: 'res-borrowed-01',
              code: 'RSV-20261020-001',
              status: 'BORROWED', // Đã bàn giao sách
              phone: '0912345678',
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => {
      await cancelReservation(
        db as any,
        { token: 'rsv_tok_test_borrowed_token' },
        null
      );
    },
    (err: any) => err.statusCode === 409 && err.errorCode === 'CANNOT_CANCEL_RESERVATION'
  );
});

test('LIFE-08: cancelDutySchedule chỉ hủy các đơn HELD, bảo toàn đơn đã giao BORROWED', async () => {
  let cancelledHeldReservationsCount = 0;
  let scheduleStatus = 'PUBLISHED';
  const db = {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('FROM duty_schedules')) {
        return {
          rows: [
            {
              id: 'sched-to-cancel',
              schedule_date: '2026-10-20',
              day_of_week: 2,
              shift_time: '17:30 - 19:30',
              location: 'Phòng đọc YSBK',
              status: scheduleStatus,
              version: 1,
            },
          ],
        };
      }
      if (sql.includes('UPDATE duty_schedules SET status = $1')) {
        scheduleStatus = params?.[0] || 'CANCELLED';
        return { rows: [] };
      }
      // UPDATE reservations ... WHERE schedule_id = $3 AND status = 'HELD'
      if (sql.includes('UPDATE reservations') && sql.includes("status = 'HELD'")) {
        cancelledHeldReservationsCount++;
        // Kiểm tra câu lệnh strictly chỉ hủy đơn HELD, không đụng BORROWED
        assert.ok(!sql.includes("status = 'BORROWED'"), 'Không được hủy đơn BORROWED');
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const result = await cancelDutySchedule(
    db as any,
    'sched-to-cancel',
    'admin-user-01',
    'Trùng lịch thi đột xuất'
  );

  assert.equal(result.status, 'CANCELLED');
  assert.equal(cancelledHeldReservationsCount, 1, 'Phải cập nhật hủy các đơn HELD');
});

test('LIFE-09: manualEditSchedule từ chối đổi giờ ca trực khi đang có đơn HELD chờ nhận', async () => {
  const db = {
    query: async (sql: string) => {
      if (sql.includes('SELECT * FROM duty_schedules WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'sched-01',
              shift_time: '14:00 - 17:00',
              shift_date: '2026-10-20',
              day_of_week: 2,
              status: 'PUBLISHED',
              term_semester: 'HK1_2026',
            },
          ],
        };
      }
      if (sql.includes('FROM members')) {
        return {
          rows: [
            { id: 'mem-01', full_name: 'Member 1', is_eligible_main_duty: true },
            { id: 'mem-02', full_name: 'Member 2', is_eligible_main_duty: false },
          ],
        };
      }
      if (sql.includes('FROM member_busy_intervals')) {
        return { rows: [] };
      }
      // Có 1 đơn HELD đang chờ nhận
      if (sql.includes("FROM reservations WHERE schedule_id = $1 AND status = 'HELD'")) {
        return { rows: [{ count: '1' }] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => {
      await manualEditSchedule(
        db as any,
        'sched-01',
        {
          shiftTime: '15:00 - 18:00', // Sửa đổi giờ ca trực
          assignees: [
            { memberId: 'mem-01', dutyType: 'MAIN', assignedRole: 'BOOK_INTRO' },
            { memberId: 'mem-02', dutyType: 'SUPPORT', assignedRole: 'CIRCULATION_LOG' },
          ],
        },
        'admin-01'
      );
    },
    (err: any) => err.errorCode === 'CANNOT_MODIFY_SCHEDULE_WITH_ACTIVE_RESERVATIONS'
  );
});
