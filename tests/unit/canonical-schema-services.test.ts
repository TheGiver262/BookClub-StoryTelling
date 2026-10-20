import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import { getMemberCandidates, getScheduleById } from '../../src/server/duty/roster-service.ts';
import { convertPassedApplicantToMember } from '../../src/modules/recruitment/decisions.ts';
import { getCirculationSummaryReport } from '../../src/modules/reporting/reporting-service.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

describe('Đợt C — Schema Canonical & Services Verification (P22-06, P22-07, P22-08, P22-09)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. P22-06: Migration 12 book_reviews Upgrade & Compatibility
  // ───────────────────────────────────────────────────────────────────────────
  describe('P22-06: Migration 12 book_reviews Upgrade & Backfill Safety', () => {
    it('migration 12 chứa logic nâng cấp/rename cột từ baseline 01_schema.sql', () => {
      const migPath = path.resolve('docs/technical/schema/migrations/12_stage20_public_content_seo.sql');
      assert.ok(fs.existsSync(migPath), 'Tệp migration 12 phải tồn tại');
      const content = fs.readFileSync(migPath, 'utf8');

      // Phải có DO $$ BEGIN block để kiểm tra và upgrade bảng cũ
      assert.ok(content.includes('ALTER TABLE book_reviews RENAME COLUMN title_id TO book_id'), 'Phải đổi title_id -> book_id');
      assert.ok(content.includes('ALTER TABLE book_reviews RENAME COLUMN reader_name TO author_name'), 'Phải đổi reader_name -> author_name');
      assert.ok(content.includes('ALTER TABLE book_reviews RENAME COLUMN moderation_reason TO moderation_note'), 'Phải đổi moderation_reason -> moderation_note');
      assert.ok(content.includes('ADD COLUMN author_id UUID NULL'), 'Phải thêm author_id');
      assert.ok(content.includes('ADD COLUMN version INT NOT NULL DEFAULT 1'), 'Phải thêm version');
      assert.ok(content.includes('ADD COLUMN pending_content TEXT NULL'), 'Phải thêm pending_content');
      assert.ok(content.includes('idx_book_reviews_book_status ON book_reviews(book_id, status)'), 'Index phải trỏ vào book_id');
    });

    it('migration 09 chứa converted_member_id kiểu UUID trỏ vào members(id)', () => {
      const mig09Path = path.resolve('docs/technical/schema/migrations/09_stage17_evaluation_decisions.sql');
      assert.ok(fs.existsSync(mig09Path), 'Tệp migration 09 phải tồn tại');
      const content = fs.readFileSync(mig09Path, 'utf8');
      assert.ok(content.includes('converted_member_id UUID REFERENCES members(id)'), 'converted_member_id phải là kiểu UUID');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. P22-07: Roster Service & Members Canonical Columns
  // ───────────────────────────────────────────────────────────────────────────
  describe('P22-07: Roster Duty Service bám sát schema members', () => {
    it('getMemberCandidates không truy vấn student_id hoặc status, dùng is_active và is_eligible_main_duty', async () => {
      const capturedQueries: string[] = [];
      const db = new MockCashDbQueryable();
      const originalQuery = db.query.bind(db);
      db.query = async (sql: string, params?: any[]) => {
        capturedQueries.push(sql);
        return originalQuery(sql, params);
      };

      db.members.push({
        id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Trần Văn Mới',
        username: 'moi.tv',
        is_active: true,
        is_alumni: false,
        is_eligible_main_duty: false, // Người mới chưa qua đào tạo
      });

      const candidates = await getMemberCandidates(db);
      assert.equal(candidates.length, 1);
      const cand = candidates[0];
      assert.equal(cand.fullName, 'Trần Văn Mới');
      assert.equal(cand.isActive, true);
      assert.equal(cand.isEligibleMain, false, 'Người mới chưa đào tạo mặc định KHÔNG đủ điều kiện trực chính');
      assert.equal(cand.studentId, null, 'studentId trả về null an toàn khi schema không có cột student_id');

      // Kiểm tra SQL truy vấn không chứa m.student_id hoặc m.status
      const selectQuery = capturedQueries.find((q) => q.includes('FROM members m'));
      assert.ok(selectQuery, 'Phải có query SELECT FROM members');
      assert.ok(!selectQuery.includes('m.student_id'), 'Tuyệt đối không query m.student_id');
      assert.ok(!selectQuery.includes('m.status'), 'Tuyệt đối không query m.status');
      assert.ok(selectQuery.includes('m.is_eligible_main_duty'), 'Phải query is_eligible_main_duty');
      assert.ok(selectQuery.includes('m.is_active'), 'Phải query is_active');
    });

    it('getScheduleById không query m.student_id từ members', async () => {
      const capturedQueries: string[] = [];
      const db = new MockCashDbQueryable();
      const originalQuery = db.query.bind(db);
      db.query = async (sql: string, params?: any[]) => {
        capturedQueries.push(sql);
        return originalQuery(sql, params);
      };

      db.dutySchedules.push({
        id: 'sched-99',
        term_semester: '2026.1',
        schedule_date: '2026-10-20',
        day_of_week: 'THU_BA',
        shift_time: '14:00 - 17:00',
        location: 'Sảnh Tạ Quang Bửu',
        status: 'PUBLISHED',
        version: 1,
        created_at: new Date().toISOString(),
      });

      const schedule = await getScheduleById(db, 'sched-99');
      assert.ok(schedule);
      const assigneeQuery = capturedQueries.find((q) => q.includes('FROM duty_schedule_assignees dsa'));
      assert.ok(assigneeQuery);
      assert.ok(!assigneeQuery.includes('m.student_id'), 'Query assignee không được SELECT m.student_id');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. P22-08: Candidate to Member Conversion
  // ───────────────────────────────────────────────────────────────────────────
  describe('P22-08: Chuyển ứng viên trúng tuyển sang thành viên CLB canonical', () => {
    it('sinh UUID hợp lệ v4, nạp đầy đủ gen/school_year/phone, map đúng enum team', async () => {
      const capturedQueries: { sql: string; params?: any[] }[] = [];
      const db = new MockCashDbQueryable();
      const originalQuery = db.query.bind(db);
      db.query = async (sql: string, params?: any[]) => {
        capturedQueries.push({ sql, params });
        return originalQuery(sql, params);
      };

      // Giả lập đơn trúng tuyển
      db.recruitmentFormResponses.push({
        id: 'RESP_K68_001',
        applicant_name: 'Nguyễn Văn Đạt',
        applicant_student_id: '20231234',
        applicant_phone: '0987654321',
        school_year: 'K68 - Điện Tử',
        campaign_gen: 'Gen 10',
      });

      db.recruitmentDecisions.push({
        id: 'DEC_001',
        response_id: 'RESP_K68_001',
        decision: 'PASSED',
        assigned_department: 'BAN_TTDN',
        committee_notes: 'Đỗ TTDN',
        decided_by: 'admin-01',
        decided_at: new Date().toISOString(),
        is_converted_to_member: false,
      });

      const res = await convertPassedApplicantToMember(db, 'RESP_K68_001', 'admin-01');
      assert.equal(res.isAlreadyConverted, false);
      assert.ok(res.member.id);

      // 1. Phải là UUID chuẩn (36 ký tự hex nối bằng gạch nối)
      assert.match(
        res.member.id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'Member ID phải là UUID chuẩn, không được dùng mem-gen10-...'
      );

      // 2. Map đúng canonical enum team
      assert.equal(res.member.team, 'TRUYEN_THONG_DOI_NGOAI', 'BAN_TTDN phải map thành TRUYEN_THONG_DOI_NGOAI');

      // 3. Đầy đủ các trường bắt buộc
      assert.equal(res.member.fullName, 'Nguyễn Văn Đạt');
      assert.equal(res.member.phone, '0987654321');
      assert.equal(res.member.schoolYear, 'K68');
      assert.equal(res.member.isEligibleMainDuty, false, 'Người mới chưa qua đào tạo không được trực chính');
      assert.equal(res.member.hasPaidFee, false, 'Chưa thu hội phí');
      assert.equal(res.member.isActive, true);

      // 4. Kiểm tra câu lệnh INSERT INTO members chứa gen và không chứa updated_at
      const insertMem = capturedQueries.find((q) => q.sql.includes('INSERT INTO members'));
      assert.ok(insertMem, 'Phải có query INSERT INTO members');
      assert.ok(insertMem.sql.includes('gen,'), 'Cột gen phải có trong câu INSERT');
      assert.ok(!insertMem.sql.includes('updated_at'), 'Không được insert cột updated_at không tồn tại');

      // 5. Kiểm tra member_affiliations có id là UUID và role là THANH_VIEN
      const insertAff = capturedQueries.find((q) => q.sql.includes('INSERT INTO member_affiliations'));
      assert.ok(insertAff, 'Phải có query INSERT INTO member_affiliations');
      assert.match(
        insertAff.params?.[0],
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'Affiliation ID phải là UUID'
      );
      assert.ok(insertAff.sql.includes("'THANH_VIEN'"), 'Role trong member_affiliations phải là THANH_VIEN');
    });

    it('retry không tạo hai member (Idempotency) và trả về cùng memberId', async () => {
      const db = new MockCashDbQueryable();
      db.recruitmentFormResponses.push({
        id: 'RESP_K68_002',
        applicant_name: 'Lê Thu Trang',
        applicant_phone: '0912345678',
      });
      db.recruitmentDecisions.push({
        id: 'DEC_002',
        response_id: 'RESP_K68_002',
        decision: 'PASSED',
        assigned_department: 'HAU_CAN',
        decided_by: 'admin-01',
        is_converted_to_member: false,
      });

      const first = await convertPassedApplicantToMember(db, 'RESP_K68_002', 'admin-01');
      const second = await convertPassedApplicantToMember(db, 'RESP_K68_002', 'admin-01');

      assert.equal(first.isAlreadyConverted, false);
      assert.equal(second.isAlreadyConverted, true);
      assert.equal(first.member.id, second.member.id);
      assert.equal(db.members.length, 1, 'Chỉ duy nhất 1 bản ghi member được tạo');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. P22-09: Circulation Reporting Canonical Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('P22-09: Báo cáo lưu thông sách chuẩn schema PostgreSQL', () => {
    it('truy vấn đúng created_at, settlement_type IN (FULL, PARTIAL), và loan_items active invariant', async () => {
      const capturedQueries: string[] = [];
      const db = new MockCashDbQueryable();
      const originalQuery = db.query.bind(db);
      db.query = async (sql: string, params?: any[]) => {
        capturedQueries.push(sql);
        return originalQuery(sql, params);
      };

      const mockActor: AuthenticatedActor = {
        userId: 'admin-01',
        memberId: 'mem-admin',
        username: 'admin.user',
        role: 'MEMBER',
        isActive: true,
        isAlumni: false,
        tokenVersion: 1,
      };

      db.loanReceipts.push({
        id: 'rcp-01',
        created_at: new Date().toISOString(),
        due_date: '2026-10-15', // Đã quá hạn
      });
      db.loanSettlements.push({
        id: 'set-01',
        settlement_type: 'FULL',
        settled_at: new Date().toISOString(),
      });
      db.loanItems.push({
        id: 'item-01',
        receipt_id: 'rcp-01',
        returned_at: null,
        is_lost: false,
        carried_forward_at: null,
      });

      const report = await getCirculationSummaryReport(db, mockActor, {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      assert.equal(report.totalLoansIssued, 1);
      assert.equal(report.totalLoansReturned, 1);
      assert.equal(report.totalActiveLoans, 1);
      assert.equal(report.totalOverdueLoans, 1);

      // Kiểm tra SQL queries
      const issueQuery = capturedQueries.find((q) => q.includes('FROM loan_receipts WHERE'));
      assert.ok(issueQuery);
      assert.ok(!issueQuery.includes('issued_at'), 'Tuyệt đối không query issued_at');
      assert.ok(issueQuery.includes('created_at'), 'Phải query created_at');

      const returnQuery = capturedQueries.find((q) => q.includes('FROM loan_settlements WHERE') && q.includes('settlement_type'));
      assert.ok(returnQuery);
      assert.ok(returnQuery.includes("settlement_type IN ('FULL', 'PARTIAL')"), 'Phải dùng FULL hoặc PARTIAL');
      assert.ok(!returnQuery.includes("settlement_type = 'RETURN'"), 'Không được dùng RETURN không có trong enum');

      const activeQuery = capturedQueries.find((q) => q.includes('FROM loan_items WHERE returned_at IS NULL'));
      assert.ok(activeQuery);
      assert.ok(!activeQuery.includes('return_status'), 'Không query return_status trên loan_items');
      assert.ok(activeQuery.includes('is_lost = FALSE AND carried_forward_at IS NULL'), 'Phải dùng active copy invariant');
    });
  });
});
