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
  assert.equal(timelineAt(totalUnits(11), 11).index, 11);
});

test('làm tròn scrollY không khóa nút trái ở cuối trang đầu hoặc làm ẩn chữ', () => {
  for (const pixels of [620, 742, 950, 1100]) for (const delta of [-1, -.5, 0, .5, 1]) {
    const position = snapBookPosition(readingEnd(0) + delta / pixels, pixels, 10);
    assert.equal(timelineAt(position, 10).mode, 'read');
    assert.equal(arrowTarget(position, -1, 10), 0);
  }
});

test('opening and adjacent turns keep their existing reading rhythm',()=>{
  const cover=navigationSegments(0,readingEnd(0),10);
  assert.equal(cover[0].duration,1600);assert.equal(cover[1].duration,2000);
  const adjacent=navigationSegments(readingEnd(1),readingEnd(2),10);
  assert(Math.abs(adjacent.find(segment=>segment.kind==='turn').duration-1400)<1e-8);
  assert.equal(navigationAt(adjacent,100000),readingEnd(2));
});

test('distant navigation has enough time to see the pages after device feedback',()=>{
  const segments=navigationSegments(readingEnd(1),readingEnd(5),6);
  const duration=segments.slice(0,-1).reduce((sum,segment)=>sum+segment.duration,0);
  assert(duration>=1500&&duration<=1800,'four page turns should take about 1.6 seconds: '+duration);
});

test('far navigation visibly passes each turn in both directions with a bounded animation timeline',()=>{
  for(const count of [6,11,21])for(const [from,to] of [[readingEnd(1),readingEnd(count-1)],[readingEnd(count-1),readingEnd(1)],[0,readingEnd(count-1)],[readingEnd(count-1),0]]){
    const segments=navigationSegments(from,to,count),duration=segments.reduce((sum,segment)=>sum+segment.duration,0);
    const target=timelineAt(to,count),riffle=target.mode==='read'&&to>from?segments.slice(0,-1):segments;
    assert(riffle.reduce((sum,segment)=>sum+segment.duration,0)<=2400+1e-8,'page riffle stays within 2.4 seconds');
    assert(duration<=4800+1e-8,'arrival reveal has a separate reading budget');
    assert(segments.filter(segment=>segment.kind==='turn').every(segment=>segment.duration>=50),'each page curl needs visible frames');
    assert.equal(navigationAt(segments,0),from);assert.equal(navigationAt(segments,duration),to);
    let previous=from;
    for(let elapsed=0;elapsed<=riffle.reduce((sum,segment)=>sum+segment.duration,0);elapsed+=15){
      const position=navigationAt(riffle,elapsed),end=riffle.at(-1).to;
      assert(end>from?position>=previous&&position<=end:position<=previous&&position>=end);previous=position;
    }
    const turns=segments.filter(segment=>segment.kind==='turn');
    assert.equal(turns.length,Math.abs(timelineAt(to,count).index-timelineAt(from,count).index));
    for(const segment of turns)assert.equal(timelineAt((segment.from+segment.to)/2,count).mode,'turn');
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

test('far navigation keeps the target reading reveal at normal speed after the quick page riffle',()=>{
  const segments=navigationSegments(readingEnd(1),readingEnd(5),6);
  assert.equal(segments.at(-1).kind,'read');
  assert.equal(segments.at(-1).duration,2400,'final chapter keeps its normal content reveal duration');
  assert(segments.slice(0,-1).reduce((sum,segment)=>sum+segment.duration,0)<=2400);
  const reverse=navigationSegments(readingEnd(5),readingEnd(1),6);
  assert(reverse.every(segment=>segment.to<=segment.from));
  assert(reverse.filter(segment=>segment.kind==='read').every(segment=>segment.duration===0));
});

test('previous-page navigation goes straight back without a target reveal replay',()=>{
  const from=readingEnd(3),to=readingEnd(1),segments=navigationSegments(from,to,6);
  assert(segments.every(segment=>segment.to<=segment.from),'no forward-reading tail after a backward turn');
  assert(segments.filter(segment=>segment.kind==='read').every(segment=>segment.duration===0));
  assert.equal(segments.at(-1).to,to);assert.equal(navigationAt(segments,0),from);assert.equal(navigationAt(segments,100000),to);
});
