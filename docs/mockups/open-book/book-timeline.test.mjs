import test from 'node:test';
import assert from 'node:assert/strict';
import { OPEN, READ, TURN, readingStart, readingEnd, totalUnits, timelineAt, arrowTarget, lineProgress } from './book-timeline.mjs';

const count = 6;
test('bắt đầu đóng bìa, mở bìa một phần và đọc chỉ sau khi mở xong', () => {
  assert.equal(timelineAt(0, count).open, 0);
  assert.equal(timelineAt(OPEN / 2, count).open, .5);
  assert.equal(timelineAt(OPEN / 2, count).read, 0);
  assert.equal(timelineAt(OPEN, count).mode, 'read');
  assert.equal(timelineAt(OPEN, count).read, 0);
});
test('mọi trang hiện hết chữ trước khi lật; có thể dừng ở giữa lần lật', () => {
  for (let index = 0; index < count; index++) {
    const start = readingStart(index);
    const read = timelineAt(start + READ * .8, count);
    assert.equal(read.index, index);
    assert.equal(read.mode, 'read');
    assert.equal(read.turn, 0);
    assert(lineProgress(1, 5, 6) === 1);
    if (index < count - 1) {
      const mid = timelineAt(readingEnd(index) + TURN / 2, count);
      assert.equal(mid.mode, 'turn');
      assert.equal(mid.read, 1);
      assert(Math.abs(mid.turn - .5) < 1e-10);
      assert.deepEqual(timelineAt(readingEnd(index) + TURN / 2, count), mid);
      const next = timelineAt(readingStart(index + 1) + .001, count);
      assert.equal(next.mode, 'read');
      assert.equal(next.index, index + 1);
    }
  }
});
test('cuộn ngược đi qua đúng các trạng thái cũ, cuộn nhanh không tích lũy sai trang', () => {
  const positions = [0, .7, 1.5, 2.8, 4.6, 6.3, 9.1, totalUnits(count)];
  const forward = positions.map(p => timelineAt(p, count));
  const backward = positions.toReversed().map(p => timelineAt(p, count)).toReversed();
  assert.deepEqual(backward, forward);
  assert.equal(timelineAt(-100, count).open, 0);
  assert.equal(timelineAt(10000, count).index, count - 1);
  assert.equal(timelineAt(10000, count).read, 1);
});
test('nút trái/phải mở, lật, quay lại và đóng bìa; giới hạn ở trang cuối', () => {
  assert.equal(arrowTarget(0, 1, count), readingEnd(0));
  assert.equal(arrowTarget(readingEnd(0), 1, count), readingEnd(1));
  assert.equal(arrowTarget(readingEnd(1), -1, count), readingEnd(0));
  assert.equal(arrowTarget(readingEnd(0), -1, count), 0);
  assert.equal(arrowTarget(readingEnd(2) + TURN / 2, -1, count), readingEnd(2));
  assert.equal(arrowTarget(totalUnits(count), 1, count), totalUnits(count));
});
test('chữ hiện dần theo thứ tự và chỉ hoàn tất sau phần đọc', () => {
  for (let i = 0; i < 6; i++) {
    assert.equal(lineProgress(0, i, 6), 0);
    assert.equal(lineProgress(1, i, 6), 1);
    assert(lineProgress(.5, i, 6) >= lineProgress(.4, i, 6));
  }
  assert(lineProgress(.2, 0, 6) > lineProgress(.2, 1, 6));
});
test('biên chính xác giữa các giai đoạn không lệch trang vì số thực', () => {
  for (let index = 0; index < count; index++) {
    const start = timelineAt(readingStart(index), count);
    assert.equal(start.mode, 'read');
    assert.equal(start.index, index);
    assert.equal(start.read, 0);
    const end = timelineAt(readingEnd(index), count);
    assert.equal(end.mode, 'read');
    assert.equal(end.index, index);
    assert(Math.abs(end.read - 1) < 1e-10);
  }
});
