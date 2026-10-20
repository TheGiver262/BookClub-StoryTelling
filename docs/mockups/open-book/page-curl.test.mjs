import test from 'node:test';
import assert from 'node:assert/strict';
import { curlAt, reflect } from './page-curl.mjs';
const area = points => Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - p.y * q.x; }, 0) / 2);
test('bắt đầu nguyên trang; nếp gấp xuất phát từ góc dưới phải', () => {
  const start = curlAt(0, 500, 600);
  assert.equal(area(start.front), 300000); assert.equal(start.back.length, 0);
  const early = curlAt(.01, 500, 600);
  assert(area(early.fold) > 0 && area(early.fold) < 1000);
  assert(early.fold.some(p => p.x === 500 && p.y === 600));
  assert(early.crease.every(p => p.x > 450 && p.y > 550));
});
test('mặt trước và phần cuộn chia kín tờ giấy, phản chiếu không lật sai mặt', () => {
  for (const [width, height] of [[500, 600], [180, 570], [700, 400]]) {
    for (let i = 1; i <= 100; i++) {
      const state = curlAt(i / 100, width, height);
      assert(Math.abs(area(state.front) + area(state.fold) - width * height) < .001);
      const backCorner = reflect({ x: width, y: height }, state.matrix);
      assert(Math.hypot(backCorner.x - state.tip.x, backCorner.y - state.tip.y) < .001);
      assert(Math.abs(area(state.back) - area(state.fold)) < .001);
      assert(state.matrix.every(Number.isFinite));
    }
  }
});
test('lật xong sang trái, dừng/cuộn ngược khôi phục đúng hình học', () => {
  const end = curlAt(1, 500, 600);
  assert(area(end.front) < .001);
  assert(end.back.every(p => p.x <= .001 && p.x >= -500.001));
  assert(Math.abs(end.radius) < 1e-10);
  const mid = curlAt(.45, 500, 600);
  curlAt(.8, 500, 600);
  assert.deepEqual(curlAt(.45, 500, 600), mid);
  assert(mid.radius > 0 && mid.crease.length >= 2);
});
