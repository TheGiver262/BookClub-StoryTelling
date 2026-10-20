// Một trục cuộn duy nhất: mở bìa → đọc → lật → đọc. Không tự chạy khi ngừng cuộn.
export const OPEN = 1.1;
export const READ = 1.25;
export const TURN = .85;
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const readingStart = index => OPEN + index * (READ + TURN);
export const readingEnd = index => readingStart(index) + READ;
export const totalUnits = count => readingEnd(count - 1);

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
