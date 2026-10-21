/**
 * Unit Test Suite: Content Policy, Moderation, Book Reviews & SEO Security (Stage 20 - FR-08)
 * Kiểm thử toàn diện các gates:
 * 1. Anon submit bị chặn 401 (G-guest-session-barrier)
 * 2. Guest có phiên hợp lệ submit thành công PENDING, lưu DB thật (G-guest-flexibility, Fix R10)
 * 3. Bài pending không xuất hiện trên public API (G-pending-isolation)
 * 4. ADMIN duyệt APPROVED thì bài xuất hiện trên public API (G-moderation-approval)
 * 5. Sửa bài đã duyệt tạo version pending mới, không làm leak bản sửa trước khi duyệt (G-version-isolation)
 * 6. XSS sanitization tước bỏ script độc hại (G-xss-sanitize)
 * 7. Public DTO không rò rỉ PII người mượn hoặc email/ghi chú riêng (G-public-privacy, Fix R13)
 * 8. Khách không thể thực hiện kiểm duyệt dù trùng email (G-rbac-barrier)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockCashDbQueryable } from './mock-db-helper.ts';
import {
  submitBookReview,
  editBookReview,
  moderateBookReview,
  getPublicReviews,
  getReviewsForModeration,
  createPublicPost,
  publishPublicPost,
  getPublicPosts,
  getPublicPostBySlug,
} from '../../src/modules/content/service.ts';
import { sanitizeContent, generateSlug } from '../../src/modules/content/sanitizer.ts';
import type { AuthenticatedActor } from '../../src/server/types.ts';

describe('Stage 20: Content, Book Reviews, Moderation & SEO Security (FR-08)', () => {
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
    memberId: 'mem-content-01',
    username: 'nam.noidung',
    role: 'MEMBER',
    isActive: true,
    isAlumni: false,
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

  const mockAnonymousActor: AuthenticatedActor = {
    userId: '',
    username: '',
    role: 'ANONYMOUS',
    isActive: true,
    isAlumni: false,
    tokenVersion: 0,
  };

  beforeEach(() => {
    db = new MockCashDbQueryable();

    // Seed book title
    db.bookTitles.push({
      id: 'book-dac-nhan-tam',
      title: 'Đắc Nhân Tâm',
      original_title: 'How to Win Friends and Influence People',
      description: 'Cuốn sách nghệ thuật giao tiếp và đối nhân xử thế kinh điển.',
      created_at: new Date().toISOString(),
    });
  });
  it('Chỉ ADMIN được kiểm duyệt review, MEMBER không được vượt qua quyền này',async()=>{
    await assert.rejects(()=>moderateBookReview(db,mockMemberActor,'review',{decision:'APPROVED'}),(error:any)=>error.errorCode==='ADMIN_REQUIRED');
  });

  it('Gate 1 (G-guest-session-barrier): Người dùng ẩn danh (Anon) gửi review bị chặn 401 Unauthorized', async () => {
    await assert.rejects(
      async () => {
        await submitBookReview(db, mockAnonymousActor, {
          bookId: 'book-dac-nhan-tam',
          authorName: 'Khách Ẩn Danh',
          rating: 5,
          content: 'Sách rất hay và truyền cảm hứng sâu sắc.',
        });
      },
      (err: any) => {
        assert.equal(err.name, 'UnauthorizedError');
        assert.equal(err.errorCode, 'UNAUTHENTICATED');
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  it('Gate 2 (Fix R10): Guest có phiên hợp lệ gửi review thành công, lưu bản ghi thật với status PENDING và version 1', async () => {
    const review = await submitBookReview(db, mockGuestActor, {
      bookId: 'book-dac-nhan-tam',
      authorName: 'Trần Văn Tân (Sinh viên K69)',
      authorEmail: 'tan.tv24@sis.hust.edu.vn',
      rating: 5,
      content: 'Cuốn sách này giúp mình tự tin hơn nhiều khi tham gia các hoạt động CLB.',
    });

    assert.ok(review.id);
    assert.equal(review.status, 'PENDING');
    assert.equal(review.version, 1);
    assert.equal(review.authorName, 'Trần Văn Tân (Sinh viên K69)');
    assert.equal(review.rating, 5);

    // Kiểm tra bản ghi đã tồn tại trong DB/mock
    const saved = db.bookReviews.find((r) => r.id === review.id);
    assert.ok(saved);
    assert.equal(saved.status, 'PENDING');
  });

  it('Gate 3 (G-pending-isolation): Đánh giá ở trạng thái PENDING tuyệt đối không xuất hiện trên Public API', async () => {
    // Guest submit review
    const review = await submitBookReview(db, mockGuestActor, {
      bookId: 'book-dac-nhan-tam',
      authorName: 'Nguyễn Thị Hoa',
      rating: 4,
      content: 'Nội dung rất ý nghĩa, các bạn tân sinh viên nên đọc sớm.',
    });
    assert.ok(review.id);

    // Public API query
    const publicReviews = await getPublicReviews(db, 'book-dac-nhan-tam');
    assert.equal(publicReviews.length, 0, 'Public API không được trả về bài đánh giá đang PENDING');
  });

  it('Gate 4 (G-moderation-approval): Quản trị viên duyệt APPROVED thì đánh giá xuất hiện công khai', async () => {
    const review = await submitBookReview(db, mockGuestActor, {
      bookId: 'book-dac-nhan-tam',
      authorName: 'Lê Minh Khôi',
      rating: 5,
      content: 'Một trong những cuốn sách làm thay đổi thói quen lắng nghe của mình.',
    });

    // ADMIN duyệt APPROVED
    const moderated = await moderateBookReview(db, mockAdminActor, review.id, {
      decision: 'APPROVED',
      moderationNote: 'Nội dung tích cực, phù hợp thuần phong mỹ tục.',
    });

    assert.equal(moderated.status, 'APPROVED');
    assert.equal(moderated.moderatedBy, mockAdminActor.memberId || mockAdminActor.userId);
    assert.ok(moderated.moderatedAt);

    // Public API query
    const publicReviews = await getPublicReviews(db, 'book-dac-nhan-tam');
    assert.equal(publicReviews.length, 1);
    assert.equal(publicReviews[0].id, review.id);
    assert.equal(publicReviews[0].readerName, 'Lê Minh Khôi');
    assert.equal(publicReviews[0].rating, 5);
  });

  it('Gate 5 (G-version-isolation): Sửa bài đã duyệt tạo version 2 PENDING, không làm lộ trước bản sửa cho đến khi duyệt lại', async () => {
    // 1. Submit & Approve review
    const review = await submitBookReview(db, mockGuestActor, {
      bookId: 'book-dac-nhan-tam',
      authorName: 'Nguyễn Văn Minh',
      rating: 4,
      content: 'Bản nhận xét ban đầu rất hay.',
    });

    await moderateBookReview(db, mockAdminActor, review.id, { decision: 'APPROVED' });

    // Public đang thấy bản gốc v1
    let publicReviews = await getPublicReviews(db, 'book-dac-nhan-tam');
    assert.equal(publicReviews.length, 1);
    assert.equal(publicReviews[0].content, 'Bản nhận xét ban đầu rất hay.');

    // 2. Tác giả sửa bài
    const edited = await editBookReview(db, mockGuestActor, review.id, {
      rating: 5,
      content: 'Bản nhận xét đã được cập nhật thêm góc nhìn thực tế tại Bách Khoa.',
    });

    assert.equal(edited.version, 2);
    assert.equal(edited.status, 'PENDING');
    assert.equal(edited.pendingContent, 'Bản nhận xét đã được cập nhật thêm góc nhìn thực tế tại Bách Khoa.');
    assert.equal(edited.content, 'Bản nhận xét ban đầu rất hay.'); // Content cũ vẫn giữ nguyên

    // 3. Khi bài đã chuyển PENDING, cổng công khai không lộ bản sửa v2
    publicReviews = await getPublicReviews(db, 'book-dac-nhan-tam');
    assert.equal(publicReviews.length, 0, 'Bài chuyển PENDING phải tạm ẩn khỏi public để chờ duyệt lại');

    // 4. Member duyệt lại bài v2
    const reApproved = await moderateBookReview(db, mockAdminActor, review.id, { decision: 'APPROVED' });
    assert.equal(reApproved.status, 'APPROVED');
    assert.equal(reApproved.content, 'Bản nhận xét đã được cập nhật thêm góc nhìn thực tế tại Bách Khoa.');
    assert.equal(reApproved.pendingContent, null);

    // Giờ public API đã thấy nội dung mới v2
    publicReviews = await getPublicReviews(db, 'book-dac-nhan-tam');
    assert.equal(publicReviews.length, 1);
    assert.equal(publicReviews[0].content, 'Bản nhận xét đã được cập nhật thêm góc nhìn thực tế tại Bách Khoa.');
    assert.equal(publicReviews[0].version, 2);
  });

  it('Gate 6 (G-xss-sanitize): Loại bỏ hoàn toàn mã độc <script>, <iframe> và thuộc tính onload/onerror', () => {
    const malicious = '<script>alert("hacked")</script>Sách rất hay!<iframe src="http://evil.com"></iframe><img src="x" onerror="stealCookies()">';
    const clean = sanitizeContent(malicious);

    assert.ok(!clean.includes('<script>'), 'Không được chứa thẻ script');
    assert.ok(!clean.includes('alert('), 'Không được chứa hàm alert');
    assert.ok(!clean.includes('<iframe'), 'Không được chứa iframe');
    assert.ok(!clean.includes('onerror='), 'Không được chứa thuộc tính sự kiện độc hại');
    assert.ok(clean.includes('Sách rất hay!'), 'Phải bảo toàn nội dung văn bản chân chính');
  });

  it('Gate 7 (G-public-privacy - R13): DTO công khai SafePublicReviewDto không rò rỉ email hoặc ghi chú kiểm duyệt', async () => {
    const review = await submitBookReview(db, mockGuestActor, {
      bookId: 'book-dac-nhan-tam',
      authorName: 'Độc Giả Bí Mật',
      authorEmail: 'private.email@hust.edu.vn',
      rating: 5,
      content: 'Sách rất đáng đọc trong những năm tháng đại học.',
    });

    await moderateBookReview(db, mockAdminActor, review.id, {
      decision: 'APPROVED',
      moderationNote: 'Lưu ý kiểm tra thông tin sinh viên nội bộ: SV có lịch sử mượn tốt.',
    });

    const publicList = await getPublicReviews(db, 'book-dac-nhan-tam');
    assert.equal(publicList.length, 1);
    const pubRev = publicList[0] as any;

    assert.equal(pubRev.authorEmail, undefined, 'Public DTO không được chứa authorEmail');
    assert.equal(pubRev.moderationNote, undefined, 'Public DTO không được chứa moderationNote');
    assert.equal(pubRev.moderatedBy, undefined, 'Public DTO không được chứa ID người duyệt');
  });

  it('Gate 8 (G-rbac-barrier): Tài khoản khách (Guest) bị chặn 403 khi cố duyệt bài hoặc tạo bài viết công khai', async () => {
    // 1. Guest cố duyệt review
    await assert.rejects(
      async () => {
        await moderateBookReview(db, mockGuestActor, 'rev-fake-id', { decision: 'APPROVED' });
      },
      (err: any) => {
        assert.equal(err.name, 'ForbiddenError');
        assert.equal(err.errorCode, 'ADMIN_REQUIRED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    // 2. Guest cố tạo bài viết tin tức
    await assert.rejects(
      async () => {
        await createPublicPost(db, mockGuestActor, {
          title: 'Bài Viết Giả Mạo Từ Khách',
          slug: 'bai-viet-gia-mao',
          summary: 'Tóm tắt bài viết',
          content: 'Nội dung bài viết',
          category: 'NEWS',
        });
      },
      (err: any) => {
        assert.equal(err.name, 'ForbiddenError');
        assert.equal(err.errorCode, 'GUEST_ACCESS_DENIED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  it('Gate 9 (G-public-posts-lifecycle): Quy trình tạo, xuất bản bài viết và slug URL', async () => {
    // Member tạo DRAFT
    const autoSlug = generateSlug('Giới Thiệu Tủ Sách Khởi Nghiệp 2026!');
    const post = await createPublicPost(db, mockMemberActor, {
      title: 'Giới Thiệu Tủ Sách Khởi Nghiệp 2026!',
      slug: autoSlug,
      summary: 'Tổng hợp các đầu sách khởi nghiệp tiêu biểu.',
      content: '<p>Nội dung chi tiết giới thiệu tủ sách khởi nghiệp mới về kho.</p>',
      category: 'GUIDE',
    });
    assert.equal(post.status, 'DRAFT');

    // Chưa xuất bản thì public không thấy
    const initialList = await getPublicPosts(db);
    assert.equal(initialList.length, 0);

    // Xuất bản bài viết
    const published = await publishPublicPost(db, mockAdminActor, post.id);
    assert.equal(published.status, 'PUBLISHED');

    // Lấy bài viết công khai theo slug
    const publicPost = await getPublicPostBySlug(db, post.slug);
    assert.ok(publicPost);
    assert.equal(publicPost?.title, post.title);

    // Danh sách bài viết công khai
    const list = await getPublicPosts(db);
    assert.equal(list.length, 1);
  });

  it('Gate 10 (G-moderation-queue): Ban kiểm duyệt xem danh sách đánh giá chờ xử lý', async () => {
    const queue = await getReviewsForModeration(db, mockMemberActor, { status: 'PENDING' });
    assert.ok(Array.isArray(queue));
  });
});
