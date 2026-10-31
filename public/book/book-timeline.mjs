// Một trục cuộn duy nhất: mở bìa → đọc → lật → đọc. Không tự chạy khi ngừng cuộn.
export const OPEN = 1.1;
export const READ = 1.25;
export const TURN = .85;
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const readingStart = index => OPEN + index * (READ + TURN);
export const readingEnd = index => readingStart(index) + READ;
export const totalUnits = count => readingEnd(count) + OPEN;

export function snapBookPosition(position, pixelsPerUnit, count) {
  // scrollY được browser làm tròn theo pixel; không để điểm dừng lọt sang lần lật kế tiếp.
  if(Math.abs(position-totalUnits(count))<=1/pixelsPerUnit+1e-9)return totalUnits(count);
  for (let i = 0; i <= count; i++) {
    for (const boundary of [readingStart(i), readingEnd(i)]) {
      if (Math.abs(position - boundary) <= 1 / pixelsPerUnit + 1e-9) return boundary;
    }
  }
  return position;
}

export function timelineAt(position, count) {
  const p = clamp(position, 0, totalUnits(count));
  if (p < OPEN) return { mode: 'cover', index: 0, open: p / OPEN, read: 0, turn: 0 };
  if (p > readingEnd(count) + 1e-9) return {mode:'closing',index:count,open:1,read:1,turn:0,close:p>=totalUnits(count)-1e-9?1:clamp((p-readingEnd(count))/OPEN)};
  const index = Math.min(count, Math.floor((p - OPEN + 1e-9) / (READ + TURN)));
  const local = p - readingStart(index);
  if (local <= READ + 1e-9 || index === count) {
    return { mode: 'read', index, open: 1, read: clamp(local / READ), turn: 0 };
  }
  return { mode: 'turn', index, open: 1, read: 1, turn: clamp((local - READ) / TURN) };
}

export function arrowTarget(position, direction, count) {
  const state = timelineAt(position, count);
  if (direction > 0) {
    if(state.index===count)return totalUnits(count);
    const next = state.mode === 'cover' ? 0 : Math.min(count, state.index + 1);
    return readingEnd(next);
  }
  if(state.mode==='closing')return readingEnd(count);
  if (state.mode === 'cover' || state.index === 0 && state.mode === 'read') return 0;
  return readingEnd(state.mode === 'turn' ? state.index : state.index - 1);
}

export function lineProgress(readProgress, index, count) {
  const step = .86 / count;
  return clamp((readProgress - .07 - index * step) / (step * .8));
}

// Chương liền kề giữ nhịp đọc; chọn xa lướt qua các trang, chậm hơn ở hai đầu.
export function navigationSegments(from, to, count) {
  from = clamp(from, 0, totalUnits(count));
  to = clamp(to, 0, totalUnits(count));
  const destination = to, target = timelineAt(to, count);
  const distant = Math.abs(target.index - timelineAt(from, count).index) > 1;
  // Forward jumps reveal on arrival; backward turns keep the target printed.
  const revealTarget = target.index > 0 && target.mode === 'read' && distant && to > from;
  if (revealTarget) to = readingStart(target.index);
  const boundaries = [0, ...Array.from({ length: count + 1 }, (_, i) => [readingStart(i), readingEnd(i)]).flat(),totalUnits(count)];
  const stops = [from, ...boundaries.filter(p => p > Math.min(from, to) && p < Math.max(from, to)), to];
  stops.sort((a, b) => to >= from ? a - b : b - a);
  const segments = stops.slice(1).map((end, i) => {
    const start = stops[i];
    const state = timelineAt((start + end) / 2, count);
    const kind = state.mode;
    const phaseLength = kind === 'cover' || kind === 'closing' ? OPEN : kind === 'turn' ? TURN : READ;
    const phaseDuration = kind === 'read' && start > end ? 0 : kind === 'cover' || kind === 'closing' ? 1600 : kind === 'turn' ? 1400 : state.index===count ? 900 : state.index === count - 1 ? 2400 : 2000;
    return { from: start, to: end, kind, duration: Math.abs(end - start) / phaseLength * phaseDuration };
  });
  if (distant) {
    const turns = segments.filter(segment => segment.kind === 'turn');
    const riffle=segments.filter(segment=>segment.kind!=='closing');
    for (const segment of riffle) {
      if (!segment.duration) continue;
      const fraction = Math.abs(segment.to - segment.from) / (segment.kind === 'cover' ? OPEN : segment.kind === 'turn' ? TURN : READ);
      const edge = segment === turns[0] || segment === turns.at(-1);
      segment.duration = fraction * (segment.kind === 'cover' ? 440 : segment.kind === 'turn' ? edge ? 460 : 280 : 24);
    }
    const scale = Math.min(1, 2400 / riffle.reduce((sum, segment) => sum + segment.duration, 0));
    for (const segment of riffle) segment.duration *= scale;
  }
  if (revealTarget && destination > to) {
    segments.push({from: to, to: destination, kind: 'read', duration: (destination - to) / READ * (target.index===count ? 900 : target.index === count - 1 ? 2400 : 2000)});
  }
  return segments;
}

export function navigationAt(segments, elapsed) {
  if(elapsed<=0)return segments[0]?.from??0;
  for (const segment of segments) {
    if (elapsed < segment.duration) {
      const t = clamp(elapsed / segment.duration);
      const eased = t * t * (3 - 2 * t);
      return segment.from + (segment.to - segment.from) * eased;
    }
    elapsed -= segment.duration;
  }
  return segments.at(-1)?.to ?? 0;
}

export function sloganProgress(read) {
  return [.02, .26, .52, .76].map(start => clamp((read - start) / .2));
}

// Index is zero-based, like chapter navigation.
export function roman(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 3999) throw new RangeError('Invalid chapter index');
  let value = index + 1, label = '';
  for (const [number, symbol] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
    while (value >= number) { label += symbol; value -= number; }
  }
  return label;
}
