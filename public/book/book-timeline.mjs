// Một trục cuộn duy nhất: mở bìa → đọc → lật → đọc. Không tự chạy khi ngừng cuộn.
export const OPEN = 1.1;
export const READ = 1.25;
export const TURN = .85;
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const readingStart = index => OPEN + index * (READ + TURN);
export const readingEnd = index => readingStart(index) + READ;
export const totalUnits = count => readingEnd(count - 1);

export function snapBookPosition(position, pixelsPerUnit, count) {
  // scrollY được browser làm tròn theo pixel; không để điểm dừng lọt sang lần lật kế tiếp.
  for (let i = 0; i < count; i++) {
    for (const boundary of [readingStart(i), readingEnd(i)]) {
      if (Math.abs(position - boundary) <= 1 / pixelsPerUnit + 1e-9) return boundary;
    }
  }
  return position;
}

export function timelineAt(position, count) {
  const p = clamp(position, 0, totalUnits(count));
  if (p < OPEN) return { mode: 'cover', index: 0, open: p / OPEN, read: 0, turn: 0 };
  const index = Math.min(count - 1, Math.floor((p - OPEN + 1e-9) / (READ + TURN)));
  const local = p - readingStart(index);
  if (local <= READ + 1e-9 || index === count - 1) {
    return { mode: 'read', index, open: 1, read: clamp(local / READ), turn: 0 };
  }
  return { mode: 'turn', index, open: 1, read: 1, turn: clamp((local - READ) / TURN) };
}

export function arrowTarget(position, direction, count) {
  const state = timelineAt(position, count);
  if (direction > 0) {
    const next = state.mode === 'cover' ? 0 : Math.min(count - 1, state.index + 1);
    return readingEnd(next);
  }
  if (state.mode === 'cover' || state.index === 0 && state.mode === 'read') return 0;
  return readingEnd(state.mode === 'turn' ? state.index : state.index - 1);
}

export function lineProgress(readProgress, index, count) {
  const step = .86 / count;
  return clamp((readProgress - .07 - index * step) / (step * .8));
}

// Mỗi bản lề/chiếc lá có nhịp riêng; chọn chương xa vẫn đi qua từng trang.
export function navigationSegments(from, to, count) {
  from = clamp(from, 0, totalUnits(count));
  to = clamp(to, 0, totalUnits(count));
  const boundaries = [0, ...Array.from({ length: count }, (_, i) => [readingStart(i), readingEnd(i)]).flat()];
  const stops = [from, ...boundaries.filter(p => p > Math.min(from, to) && p < Math.max(from, to)), to];
  stops.sort((a, b) => to >= from ? a - b : b - a);
  return stops.slice(1).map((end, i) => {
    const start = stops[i];
    const state = timelineAt((start + end) / 2, count);
    const kind = state.mode;
    const phaseLength = kind === 'cover' ? OPEN : kind === 'turn' ? TURN : READ;
    const phaseDuration = kind === 'cover' ? 1600 : kind === 'turn' ? 1400 : state.index === count - 1 ? 2400 : 700;
    return { from: start, to: end, kind, duration: Math.abs(end - start) / phaseLength * phaseDuration };
  });
}

export function navigationAt(segments, elapsed) {
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
