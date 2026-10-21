import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// ─────────────────────────────────────────────────────────────────────────────
// UI-01 Regression: Review Pagination Retry & Book Isolation
// ─────────────────────────────────────────────────────────────────────────────

test('UI-01: tải lỗi trang 2 phải thử lại đúng trang 2, sau đó tải đủ 150 review không thiếu/trùng', async () => {
  const source = fs.readFileSync('src/components/PublicPortal.tsx', 'utf8');
  const ast = ts.createSourceFile('PublicPortal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  let effectText = '';
  let moreBookReviewsText = '';
  let loadMoreButtonText = '';

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
      const arrow = node.arguments[0];
      if (arrow?.getText(ast).includes('apiClient.getPublicReviews(id,1)')) {
        effectText = arrow.getText(ast);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name?.getText(ast) === 'moreBookReviews') {
      moreBookReviewsText = node.getText(ast);
    }
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onClick') {
      const expr = node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined;
      if (expr?.getText(ast).includes('moreBookReviews()')) {
        loadMoreButtonText = expr.getText(ast);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);

  assert.ok(effectText, 'Effect tải trang 1 ban đầu phải tồn tại');
  assert.ok(moreBookReviewsText, 'Hàm moreBookReviews xử lý tải trang tiếp/thử lại phải tồn tại');
  assert.ok(loadMoreButtonText, 'Nút Xem thêm đánh giá phải gắn hàm moreBookReviews');

  const requestedPages: { bookId: string; page: number }[] = [];
  let failPage2Once = true;

  const mockApiClient = {
    getPublicReviews: async (bookId: string, page = 1) => {
      requestedPages.push({ bookId, page });
      if (page === 2 && failPage2Once) {
        failPage2Once = false;
        throw new Error('Controlled transient network failure on page 2');
      }
      return Array.from({ length: 50 }, (_, i) => ({
        id: `rev-${bookId}-${(page - 1) * 50 + i + 1}`,
        bookId,
        readerName: `Reader ${(page - 1) * 50 + i + 1}`,
        rating: 5,
        content: `Review content ${(page - 1) * 50 + i + 1}`,
        version: 1,
        isClubReview: i === 0,
        createdAt: '2026-10-22T00:00:00Z',
      }));
    },
  };

  const context: Record<string, any> = {
    panel: 'reviews',
    focusedBook: { titleId: 'book-dac-nhan-tam', title: 'Đắc Nhân Tâm' },
    reviewSessionRef: { current: 0 },
    reviewPage: 1,
    bookReviews: [],
    reviewsLoading: false,
    reviewsMore: false,
    reviewsError: '',
  };

  context.focusedBookRef = { current: context.focusedBook };
  context.panelRef = { current: context.panel };

  for (const [setter, field] of Object.entries({
    setBookReviews: 'bookReviews',
    setReviewPage: 'reviewPage',
    setReviewsLoading: 'reviewsLoading',
    setReviewsMore: 'reviewsMore',
    setReviewsError: 'reviewsError',
  })) {
    context[setter] = (value: any) => {
      context[field] = typeof value === 'function' ? value(context[field]) : value;
    };
  }
  context.apiClient = mockApiClient;

  vm.createContext(context);

  const jsEffect = ts.transpileModule(`(${effectText})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const jsMoreReviews = ts.transpileModule(moreBookReviewsText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

  // 1. Initial load effect: loads page 1
  const runEffect = vm.runInContext(jsEffect, context);
  const cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(context.bookReviews.length, 50, 'Trang 1 phải nạp đủ 50 review');
  assert.equal(context.reviewPage, 1, 'Trang hiện tại là trang 1');
  assert.equal(context.reviewsMore, true, 'reviewsMore phải là true khi trang có 50 items');
  assert.equal(context.reviewsError, '', 'Không có lỗi ở trang 1');
  assert.deepEqual(requestedPages, [{ bookId: 'book-dac-nhan-tam', page: 1 }]);

  // 2. Click 1: attempts page 2 -> encounters network failure
  vm.runInContext(jsMoreReviews, context);
  await context.moreBookReviews();

  assert.equal(context.reviewPage, 1, 'Sau khi trang 2 lỗi, reviewPage PHẢI giữ nguyên 1, KHÔNG được nhảy lên 2');
  assert.equal(context.bookReviews.length, 50, 'Danh sách review giữ nguyên 50 bài của trang 1');
  assert.equal(context.reviewsMore, true, 'reviewsMore vẫn là true để người đọc có thể thử lại');
  assert.match(context.reviewsError, /transient network failure/, 'Thông báo lỗi phải hiển thị');
  assert.deepEqual(requestedPages, [
    { bookId: 'book-dac-nhan-tam', page: 1 },
    { bookId: 'book-dac-nhan-tam', page: 2 },
  ]);

  // 3. Click 2: retries page 2 -> succeeds
  await context.moreBookReviews();

  assert.equal(context.reviewPage, 2, 'Sau khi thử lại trang 2 thành công, reviewPage chốt bằng 2');
  assert.equal(context.bookReviews.length, 100, 'Đã tải thêm trang 2, tổng cộng 100 review');
  assert.equal(context.reviewsMore, true);
  assert.deepEqual(requestedPages, [
    { bookId: 'book-dac-nhan-tam', page: 1 },
    { bookId: 'book-dac-nhan-tam', page: 2 },
    { bookId: 'book-dac-nhan-tam', page: 2 }, // Thử lại đúng trang 2!
  ]);

  // Kiểm tra không sót review từ 51 đến 100
  assert.ok(context.bookReviews.some((r: any) => r.id === 'rev-book-dac-nhan-tam-51'), 'Review 51 phải có mặt');
  assert.ok(context.bookReviews.some((r: any) => r.id === 'rev-book-dac-nhan-tam-100'), 'Review 100 phải có mặt');

  // 4. Click 3: loads page 3 -> loads remaining 50 reviews
  await context.moreBookReviews();

  assert.equal(context.reviewPage, 3, 'reviewPage chốt bằng 3');
  assert.equal(context.bookReviews.length, 150, 'Đã tải đủ 150 review');
  assert.deepEqual(requestedPages, [
    { bookId: 'book-dac-nhan-tam', page: 1 },
    { bookId: 'book-dac-nhan-tam', page: 2 },
    { bookId: 'book-dac-nhan-tam', page: 2 },
    { bookId: 'book-dac-nhan-tam', page: 3 },
  ]);

  // Kiểm tra toàn bộ 150 review không thiếu bài nào và không bị trùng
  const idSet = new Set(context.bookReviews.map((r: any) => r.id));
  assert.equal(idSet.size, 150, 'Đúng 150 review độc nhất, không trùng lặp');
  for (let i = 1; i <= 150; i++) {
    assert.ok(idSet.has(`rev-book-dac-nhan-tam-${i}`), `Review ${i} phải có mặt`);
  }

  if (typeof cleanup === 'function') cleanup();
});

test('UI-01: đổi sách hoặc đóng modal trong khi request đang chờ không cập nhật nhầm', async () => {
  const source = fs.readFileSync('src/components/PublicPortal.tsx', 'utf8');
  const ast = ts.createSourceFile('PublicPortal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  let moreBookReviewsText = '';
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.getText(ast) === 'moreBookReviews') {
      moreBookReviewsText = node.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);

  let resolveBookARequest: (val: any) => void;
  const bookAPromise = new Promise(resolve => { resolveBookARequest = resolve; });

  const mockApiClient = {
    getPublicReviews: async (bookId: string) => {
      if (bookId === 'book-A') return bookAPromise;
      return [];
    },
  };

  const context: Record<string, any> = {
    panel: 'reviews',
    focusedBook: { titleId: 'book-A' },
    reviewSessionRef: { current: 0 },
    reviewPage: 1,
    bookReviews: [{ id: 'a-1' }],
    reviewsLoading: false,
    reviewsMore: true,
    reviewsError: '',
  };
  context.focusedBookRef = { current: context.focusedBook };
  context.panelRef = { current: context.panel };

  for (const [setter, field] of Object.entries({
    setBookReviews: 'bookReviews',
    setReviewPage: 'reviewPage',
    setReviewsLoading: 'reviewsLoading',
    setReviewsMore: 'reviewsMore',
    setReviewsError: 'reviewsError',
  })) {
    context[setter] = (value: any) => {
      context[field] = typeof value === 'function' ? value(context[field]) : value;
    };
  }
  context.apiClient = mockApiClient;

  vm.createContext(context);
  const jsMore = ts.transpileModule(moreBookReviewsText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(jsMore, context);

  // Bắt đầu request cho Book A
  const pending = context.moreBookReviews();

  // Đổi sang Book B và đóng panel trong lúc Book A đang chờ mạng
  context.focusedBook = { titleId: 'book-B' };
  context.focusedBookRef.current = context.focusedBook;
  context.panel = null;
  context.panelRef.current = null;

  // Book A trả về
  resolveBookARequest!([{ id: 'a-2' }, { id: 'a-3' }]);
  await pending;

  // Sách B hoặc modal đã đóng tuyệt đối không nhận kết quả của Book A
  assert.equal(context.bookReviews.length, 1, 'bookReviews không bị ô nhiễm bởi kết quả của request cũ');
  assert.equal(context.bookReviews[0].id, 'a-1');
});

test('UI-01: đóng rồi mở lại cùng sách A hoặc A→B→A loại bỏ triệt để request từ phiên cũ (generation guard)', async () => {
  const source = fs.readFileSync('src/components/PublicPortal.tsx', 'utf8');
  const ast = ts.createSourceFile('PublicPortal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  let effectText = '';
  let moreBookReviewsText = '';
  let openPanelText = '';
  let closePanelText = '';

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
      const arrow = node.arguments[0];
      if (arrow?.getText(ast).includes('apiClient.getPublicReviews(id,1)')) {
        effectText = arrow.getText(ast);
      }
    }
    if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.getText(ast);
      if (name === 'moreBookReviews') moreBookReviewsText = node.getText(ast);
      if (name === 'openPanel') openPanelText = node.getText(ast);
      if (name === 'closePanel') closePanelText = node.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);

  assert.ok(effectText && moreBookReviewsText && openPanelText && closePanelText, 'Cần trích xuất đủ effect và các handler');

  let resolveOldPage2: (val: any) => void;

  const context: Record<string, any> = {
    panel: null,
    focusedBook: null,
    reviewPage: 1,
    bookReviews: [],
    reviewsLoading: false,
    reviewsMore: false,
    reviewsError: '',
    reviewSessionRef: { current: 0 },
    requireReader: () => true,
    bookLookupRef: { current: 0 },
    setReviewSubmitted: () => {},
    setReviewContent: () => {},
    setReviewRating: () => {},
    window: {
      history: {
        pushState() {},
        replaceState() {},
      },
    },
    bookIntent: (target: string, id: string) => `/sach/?sach=${id}&panel=${target}`,
    activeTab: 'sach',
  };

  context.focusedBookRef = { current: context.focusedBook };
  context.panelRef = { current: context.panel };

  for (const [setter, field] of Object.entries({
    setBookReviews: 'bookReviews',
    setReviewPage: 'reviewPage',
    setReviewsLoading: 'reviewsLoading',
    setReviewsMore: 'reviewsMore',
    setReviewsError: 'reviewsError',
    setFocusedBook: 'focusedBook',
    setPanel: 'panel',
  })) {
    context[setter] = (value: any) => {
      context[field] = typeof value === 'function' ? value(context[field]) : value;
      if (field === 'focusedBook') context.focusedBookRef.current = context.focusedBook;
      if (field === 'panel') context.panelRef.current = context.panel;
    };
  }

  const jsEffect = ts.transpileModule(`(${effectText})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const jsMore = ts.transpileModule(moreBookReviewsText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const jsOpen = ts.transpileModule(openPanelText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const jsClose = ts.transpileModule(closePanelText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

  vm.createContext(context);
  const runEffect = vm.runInContext(jsEffect, context);
  vm.runInContext(jsMore, context);
  vm.runInContext(jsOpen, context);
  vm.runInContext(jsClose, context);

  // ── NHÁNH 1: Đang chờ trang 2 -> Đóng modal -> Mở lại A -> resolve request cũ SAU khi trang 1 mới hoàn tất ──
  const bookA = { titleId: 'book-A', title: 'Sách A' };

  // 1. Mở modal A phiên 1
  context.openPanel(bookA, 'reviews');
  context.apiClient = {
    getPublicReviews: async (_id: string, page = 1) => {
      if (page === 1) return Array.from({ length: 50 }, (_, i) => ({ id: `a-p1-${i + 1}` }));
      return new Promise(resolve => { resolveOldPage2 = resolve; });
    },
  };
  let cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.bookReviews.length, 50);
  assert.equal(context.reviewPage, 1);

  // 2. Tải thêm trang 2 (đang chờ)
  const pendingOldPage2 = context.moreBookReviews();
  assert.equal(context.reviewsLoading, true);

  // 3. Đóng modal A (khi trang 2 đang bay)
  cleanup();
  context.closePanel();
  assert.equal(context.panel, null);

  // 4. Mở lại modal A (phiên 2)
  context.openPanel(bookA, 'reviews');
  assert.equal(context.bookReviews.length, 0, 'bookReviews được reset cho phiên mới');
  let resolveFreshPage1: (val: any) => void;
  const freshPage1Promise = new Promise(resolve => { resolveFreshPage1 = resolve; });
  context.apiClient = {
    getPublicReviews: async (_id: string, page = 1) => {
      if (page === 1) return freshPage1Promise;
      return [];
    },
  };
  cleanup = runEffect();
  assert.equal(context.reviewsLoading, true, 'Phiên mới đang tải trang 1');

  // 5. Trang 1 phiên mới hoàn tất TRƯỚC
  resolveFreshPage1!([{ id: 'new-a-1' }, { id: 'new-a-2' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.bookReviews.length, 2, 'Phiên mới nhận đúng 2 bài trang 1 mới');
  assert.equal(context.reviewPage, 1);
  assert.equal(context.reviewsLoading, false, 'Loading tắt sau khi trang 1 mới xong');
  assert.equal(context.reviewsError, '');

  // 6. Request trang 2 cũ từ phiên 1 bây giờ mới trả về
  resolveOldPage2!([{ id: 'stale-p2-item' }]);
  await pendingOldPage2;

  // Khẳng định: Request cũ không được lọt vào phiên mới!
  assert.equal(context.bookReviews.some((r: any) => r.id === 'stale-p2-item'), false, 'Không nhận review từ phiên cũ');
  assert.equal(context.bookReviews.length, 2, 'Danh sách giữ nguyên');
  assert.equal(context.reviewPage, 1, 'Trang vẫn là trang 1 của phiên mới, không bị nhảy lên 2');
  assert.equal(context.reviewsLoading, false);
  assert.equal(context.reviewsError, '');
  cleanup();

  // ── NHÁNH 2: Đang chờ trang 2 -> Đóng -> Mở lại A -> resolve request cũ TRƯỚC khi trang 1 mới hoàn tất ──
  context.openPanel(bookA, 'reviews');
  context.apiClient = {
    getPublicReviews: async (_id: string, page = 1) => {
      if (page === 1) return [{ id: 'a2-p1-1' }];
      return new Promise(resolve => { resolveOldPage2 = resolve; });
    },
  };
  cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));

  // Kích hoạt request trang 2 cũ
  const pendingOldPage2_B = context.moreBookReviews();
  cleanup();
  context.closePanel();

  // Mở lại A phiên 3
  context.openPanel(bookA, 'reviews');
  let resolvePage1_Session3: (val: any) => void;
  const page1Promise_Session3 = new Promise(resolve => { resolvePage1_Session3 = resolve; });
  context.apiClient = {
    getPublicReviews: async () => page1Promise_Session3,
  };
  cleanup = runEffect();
  assert.equal(context.reviewsLoading, true, 'Phiên 3 đang loading');

  // Request cũ trả về TRƯỚC khi trang 1 phiên 3 xong:
  resolveOldPage2!([{ id: 'stale-early-item' }]);
  await pendingOldPage2_B;

  // Stale request bị từ chối: không ghi review, không tắt loading của phiên 3!
  assert.equal(context.bookReviews.length, 0, 'Stale request không ghi vào bookReviews rỗng của phiên 3');
  assert.equal(context.reviewsLoading, true, 'Stale request KHÔNG được tắt loading của phiên 3');

  // Bây giờ trang 1 phiên 3 mới xong:
  resolvePage1_Session3!([{ id: 'session3-item' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.bookReviews.length, 1);
  assert.equal(context.bookReviews[0].id, 'session3-item');
  assert.equal(context.reviewsLoading, false);
  cleanup();

  // ── NHÁNH 3: A → B → A (đổi sang sách B rồi quay lại A) ──
  const bookB = { titleId: 'book-B', title: 'Sách B' };
  context.openPanel(bookA, 'reviews');
  let resolveBookA_P2: (val: any) => void;
  context.apiClient = {
    getPublicReviews: async (id: string, page = 1) => {
      if (id === 'book-A' && page === 1) return [{ id: 'a-item-1' }];
      if (id === 'book-A' && page === 2) return new Promise(r => { resolveBookA_P2 = r; });
      if (id === 'book-B') return [{ id: 'b-item-1' }];
      return [];
    },
  };
  cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));

  // Bắt đầu trang 2 cho A
  const pendingA_P2 = context.moreBookReviews();
  cleanup();

  // Chuyển sang B
  context.openPanel(bookB, 'reviews');
  cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.focusedBook.titleId, 'book-B');
  assert.equal(context.bookReviews[0].id, 'b-item-1');
  cleanup();

  // Quay lại A
  context.openPanel(bookA, 'reviews');
  cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.focusedBook.titleId, 'book-A');
  assert.equal(context.bookReviews[0].id, 'a-item-1');

  // Bây giờ trang 2 cũ của A (từ lần mở đầu tiên) mới trả về
  resolveBookA_P2!([{ id: 'a-stale-p2' }]);
  await pendingA_P2;

  assert.equal(context.bookReviews.some((r: any) => r.id === 'a-stale-p2'), false, 'A→B→A: Request cũ của A không được lọt vào');
  assert.equal(context.bookReviews.length, 1);
  cleanup();

  // ── NHÁNH 4: Request cũ bị REJECT (lỗi mạng) không làm hỏng error/loading của phiên mới ──
  context.openPanel(bookA, 'reviews');
  let rejectOldPage2_Err: (err: any) => void;
  context.apiClient = {
    getPublicReviews: async (_id: string, page = 1) => {
      if (page === 1) return [{ id: 'a-p1-clean' }];
      return new Promise((_, reject) => { rejectOldPage2_Err = reject; });
    },
  };
  cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));
  const pendingOldErr = context.moreBookReviews();
  cleanup();

  // Đóng rồi mở lại A
  context.closePanel();
  context.openPanel(bookA, 'reviews');
  context.apiClient = {
    getPublicReviews: async () => [{ id: 'new-clean-item' }],
  };
  cleanup = runEffect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.bookReviews[0].id, 'new-clean-item');
  assert.equal(context.reviewsError, '', 'Phiên mới không có lỗi');
  assert.equal(context.reviewsLoading, false);

  // Request cũ reject lỗi mạng
  rejectOldPage2_Err!(new Error('Stale network failure from old session'));
  await pendingOldErr;

  // Khẳng định: lỗi cũ KHÔNG được hiển thị lên phiên mới, loading không bị gián đoạn
  assert.equal(context.reviewsError, '', 'Lỗi từ request cũ tuyệt đối không ghi đè vào phiên mới');
  assert.equal(context.reviewsLoading, false);
  assert.equal(context.bookReviews[0].id, 'new-clean-item');
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
// UI-02 Regression: PublishingManager Image Race & Context Isolation
// ─────────────────────────────────────────────────────────────────────────────

function createPublishingHarness() {
  const cells: any[] = [];
  const refs: any[] = [];
  let cursor = 0;
  let refCursor = 0;

  const hooks = {
    useState(initial: any) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
      return [cells[i], (v: any) => { cells[i] = typeof v === 'function' ? v(cells[i]) : v; }];
    },
    useRef(initial: any) {
      const i = refCursor++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
    },
    useEffect() {},
  };

  const jsx = (type: any, props: any) => ({ type, props });
  return { cells, refs, hooks, jsx, resetCursor: () => { cursor = 0; refCursor = 0; } };
}

function findNode(node: any, predicate: (n: any) => boolean): any {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(v => findNode(v, predicate)).find(Boolean);
  if (predicate(node)) return node;
  return findNode(node.props?.children, predicate);
}

test('UI-02: đổi tab khi ảnh đang xử lý không làm lọt ảnh sách sang form tuyển thành viên', async () => {
  const harness = createPublishingHarness();
  const source = fs.readFileSync('src/components/PublishingManager.tsx', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;

  let resolveBitmap: (val: any) => void;
  const bitmapPromise = new Promise(resolve => { resolveBitmap = resolve; });
  const bookMarker = 'data:image/webp;base64,BOOK_COVER_IMAGE';

  const moduleObj = { exports: {} as any };
  vm.runInNewContext(code, {
    exports: moduleObj.exports,
    module: moduleObj,
    require: (name: string) => {
      if (name === 'react') return harness.hooks;
      if (name === 'react/jsx-runtime') return { jsx: harness.jsx, jsxs: harness.jsx };
      if (name === '../lib/api-client') return { apiClient: { getPublishingOverview: async () => ({ schedules: [] }), listEvents: async () => [] } };
      throw new Error(`Unexpected import ${name}`);
    },
    createImageBitmap: () => bitmapPromise,
    document: { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => bookMarker }) },
  });

  const render = () => { harness.resetCursor(); return moduleObj.exports.default(); };

  // 1. Ở tab Books, chọn file ảnh
  const before = render();
  const fileInput = findNode(before, n => n.type === 'input' && n.props.type === 'file');
  assert.ok(fileInput);
  fileInput.props.onChange({ target: { files: [{ type: 'image/png', size: 1000 }] } });

  // 2. Component đang bận (busy), tab Tuyển thành viên bị disabled trên UI
  const processing = render();
  const recruitmentTab = findNode(processing, n => n.type === 'button' && n.props.children === 'Tuyển thành viên');
  assert.ok(recruitmentTab);
  assert.equal(recruitmentTab.props.disabled, true, 'Tab Tuyển thành viên phải bị disabled khi busy');

  // 3. Người dùng chuyển sang tab Tuyển thành viên
  recruitmentTab.props.onClick();
  const switched = render();
  assert.equal(harness.cells[0], 'recruitment', 'Phải chuyển sang tab recruitment');
  assert.equal(findNode(switched, n => n.type === 'img' && n.props.src === bookMarker), undefined);

  // 4. Bitmap của sách giải phóng sau khi đã chuyển tab
  resolveBitmap!({ width: 100, height: 100, close() {} });
  await new Promise(resolve => setImmediate(resolve));

  // 5. Kết quả sau khi ảnh sách xử lý xong: ảnh sách TUYỆT ĐỐI KHÔNG xuất hiện ở tab Tuyển thành viên
  const after = render();
  const leakedImg = findNode(after, n => n.type === 'img' && n.props.src === bookMarker);
  assert.equal(leakedImg, undefined, 'Ảnh của sách không được xuất hiện trong form Tuyển thành viên');
});

test('UI-02: chuyển sang thêm sách mới khi ảnh đang xử lý không gán nhầm ảnh vào sách mới', async () => {
  const harness = createPublishingHarness();
  const source = fs.readFileSync('src/components/PublishingManager.tsx', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;

  let resolveBitmap: (val: any) => void;
  const bitmapPromise = new Promise(resolve => { resolveBitmap = resolve; });
  const bookAMarker = 'data:image/webp;base64,BOOK_A_IMAGE';

  const moduleObj = { exports: {} as any };
  vm.runInNewContext(code, {
    exports: moduleObj.exports,
    module: moduleObj,
    require: (name: string) => {
      if (name === 'react') return harness.hooks;
      if (name === 'react/jsx-runtime') return { jsx: harness.jsx, jsxs: harness.jsx };
      if (name === '../lib/api-client') return { apiClient: {} };
      throw new Error(`Unexpected import ${name}`);
    },
    createImageBitmap: () => bitmapPromise,
    document: { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => bookAMarker }) },
  });

  const render = () => { harness.resetCursor(); return moduleObj.exports.default(); };

  render();
  // Giả lập đang chỉnh sửa Book A
  harness.cells[1] = { ...harness.cells[1], id: 'book-A-id', title: 'Sách Cũ A' };
  render();

  // Chọn ảnh cho Book A
  const fileInput = findNode(render(), n => n.type === 'input' && n.props.type === 'file');
  fileInput.props.onChange({ target: { files: [{ type: 'image/png', size: 1000 }] } });
  render();

  // Nhấn '+ Thêm đầu sách mới'
  const newBookBtn = findNode(render(), n => n.type === 'button' && n.props.children === '+ Thêm đầu sách mới');
  newBookBtn.props.onClick();
  render();
  assert.equal(harness.cells[1].id, '', 'Form đã chuyển sang thêm sách mới');

  // Bitmap của Book A giải phóng
  resolveBitmap!({ width: 100, height: 100, close() {} });
  await new Promise(resolve => setImmediate(resolve));

  // Kiểm tra ảnh của Book A không lọt vào form sách mới
  const after = render();
  const leakedImg = findNode(after, n => n.type === 'img' && n.props.src === bookAMarker);
  assert.equal(leakedImg, undefined, 'Ảnh của Book A không được xuất hiện trong form thêm sách mới');
});

test('UI-02: chọn hai ảnh hoàn tất ngược thứ tự chỉ nhận ảnh của lần chọn mới nhất', async () => {
  const harness = createPublishingHarness();
  const source = fs.readFileSync('src/components/PublishingManager.tsx', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;

  let resolveBitmap1: (val: any) => void;
  let resolveBitmap2: (val: any) => void;
  const bitmap1 = new Promise(resolve => { resolveBitmap1 = resolve; });
  const bitmap2 = new Promise(resolve => { resolveBitmap2 = resolve; });

  const marker1 = 'data:image/webp;base64,IMAGE_1_SLOW';
  const marker2 = 'data:image/webp;base64,IMAGE_2_FAST';
  let currentFileIdx = 0;

  const moduleObj = { exports: {} as any };
  vm.runInNewContext(code, {
    exports: moduleObj.exports,
    module: moduleObj,
    require: (name: string) => {
      if (name === 'react') return harness.hooks;
      if (name === 'react/jsx-runtime') return { jsx: harness.jsx, jsxs: harness.jsx };
      if (name === '../lib/api-client') return { apiClient: {} };
      throw new Error(`Unexpected import ${name}`);
    },
    createImageBitmap: () => (currentFileIdx === 1 ? bitmap1 : bitmap2),
    document: {
      createElement: () => ({
        getContext: () => ({ drawImage() {} }),
        toDataURL: () => (currentFileIdx === 1 ? marker1 : marker2),
      }),
    },
  });

  const render = () => { harness.resetCursor(); return moduleObj.exports.default(); };

  render();

  // 1. Chọn ảnh 1 (chậm)
  currentFileIdx = 1;
  const fileInput = findNode(render(), n => n.type === 'input' && n.props.type === 'file');
  fileInput.props.onChange({ target: { files: [{ type: 'image/png', size: 1000 }] } });
  render();
  assert.equal(harness.cells[10], true, 'busy phải là true khi xử lý ảnh 1');

  // 2. Chọn ảnh 2 (nhanh) ngay sau đó
  currentFileIdx = 2;
  fileInput.props.onChange({ target: { files: [{ type: 'image/jpeg', size: 2000 }] } });
  render();
  assert.equal(harness.cells[10], true, 'busy vẫn là true khi xử lý ảnh 2');

  // 3. Ảnh 2 hoàn tất trước
  resolveBitmap2!({ width: 100, height: 100, close() {} });
  await new Promise(resolve => setImmediate(resolve));

  const mid = render();
  const img2 = findNode(mid, n => n.type === 'img' && n.props.src === marker2);
  assert.ok(img2, 'Ảnh 2 phải được hiển thị');
  assert.equal(harness.cells[10], false, 'busy phải là false sau khi ảnh 2 xong');

  // 4. Ảnh 1 hoàn tất muộn hơn
  resolveBitmap1!({ width: 200, height: 200, close() {} });
  await new Promise(resolve => setImmediate(resolve));

  const finalTree = render();
  const imgFinal = findNode(finalTree, n => n.type === 'img' && n.props.src === marker2);
  assert.ok(imgFinal, 'Ảnh 2 vẫn phải được hiển thị, không bị ảnh 1 ghi đè');
  const img1 = findNode(finalTree, n => n.type === 'img' && n.props.src === marker1);
  assert.equal(img1, undefined, 'Ảnh 1 hoàn tất muộn không được hiển thị');
  assert.equal(harness.cells[10], false, 'busy phải giữ nguyên false');
});
