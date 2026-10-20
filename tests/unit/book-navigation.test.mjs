import test from 'node:test';
import assert from 'node:assert/strict';
import { OPEN, READ, TURN, readingEnd, totalUnits, arrowTarget, timelineAt, navigationSegments, navigationAt, sloganProgress, snapBookPosition } from '../../public/book/book-timeline.mjs';

test('nút trái từ bìa phụ về bìa cứng; từ giới thiệu về bìa phụ ở mọi tiến độ đọc', () => {
  for (const progress of [0, .1, .5, .99, 1]) {
    assert.equal(arrowTarget(OPEN + progress * READ, -1, 11), 0);
    assert.equal(arrowTarget(OPEN + READ + TURN + progress * READ, -1, 11), readingEnd(0));
  }
  assert.equal(arrowTarget(0, 1, 11), readingEnd(0));
  assert.equal(arrowTarget(readingEnd(0), 1, 11), readingEnd(1));
  assert.equal(timelineAt(totalUnits(11), 11).index, 10);
});

test('làm tròn scrollY không khóa nút trái ở cuối trang đầu hoặc làm ẩn chữ', () => {
  for (const pixels of [620, 742, 950, 1100]) for (const delta of [-1, -.5, 0, .5, 1]) {
    const position = snapBookPosition(readingEnd(0) + delta / pixels, pixels, 10);
    assert.equal(timelineAt(position, 10).mode, 'read');
    assert.equal(arrowTarget(position, -1, 10), 0);
  }
});

test('nút điều hướng có nhịp bìa và giấy riêng, đi qua đủ các trang và dừng chính xác', () => {
  const target = readingEnd(4);
  const segments = navigationSegments(0, target, 10);
  assert.equal(segments[0].duration, 1600);
  assert.equal(segments.filter(s => s.kind === 'turn').length, 4);
  assert(segments.filter(s => s.kind === 'turn').every(s => s.duration >= 1399));
  const duration = segments.reduce((sum, s) => sum + s.duration, 0);
  assert.equal(navigationAt(segments, 0), 0);
  assert.equal(navigationAt(segments, duration), target);
  const reverse = navigationSegments(readingEnd(0), 0, 10);
  assert.equal(navigationAt(reverse, 100000), 0);
  let previous = 0;
  for (let t = 0; t <= duration; t += 25) {
    const position = navigationAt(segments, t);
    assert(position >= previous && position <= target);
    previous = position;
  }
});

test('chọn đích giữa lần lật và đảo chiều không nhảy hoặc tích lũy sai tiến độ', () => {
  const from = readingEnd(2) + TURN * .55;
  for (const to of [0, readingEnd(1), readingEnd(3), totalUnits(10)]) {
    const segments = navigationSegments(from, to, 10);
    assert.equal(navigationAt(segments, 0), from);
    assert.equal(navigationAt(segments, 100000), to);
  }
  assert.equal(timelineAt(totalUnits(10) + 10, 10).read, 1);
});

test('trang kết: chữ trái → ảnh trái → chữ phải → ảnh phải, không hiện ảnh trước chữ', () => {
  assert.deepEqual(sloganProgress(0), [0, 0, 0, 0]);
  assert.deepEqual(sloganProgress(1), [1, 1, 1, 1]);
  for (let t = 0; t <= 1; t += .01) {
    const p = sloganProgress(t);
    for (let i = 1; i < p.length; i++) if (p[i] > 0) assert.equal(p[i - 1], 1);
  }
  assert(sloganProgress(.3)[1] > 0);
  assert.equal(sloganProgress(.3)[2], 0);
  assert.equal(sloganProgress(.65)[3], 0);
});
