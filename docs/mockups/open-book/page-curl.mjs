// Gấp từ góc phải dưới: vùng giấy, mặt sau phản chiếu và dải cong cùng một tiến độ cuộn.
const clamp = value => Math.max(0, Math.min(1, value));
const dot = (a, b) => a.x * b.x + a.y * b.y;
function clip(points, normal, offset, sign) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = (dot(a, normal) - offset) * sign;
    const db = (dot(b, normal) - offset) * sign;
    if (da >= -1e-7) result.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}
export function reflect(point, matrix) {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}
export function curlAt(progress, width, height) {
  if (!(width > 0 && height > 0)) throw new RangeError('Page dimensions must be positive');
  const t = clamp(progress);
  const rectangle = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  if (t === 0) return { front: rectangle, fold: [], back: [], matrix: [1, 0, 0, 1, 0, 0], crease: [], radius: 0, tip: { x: width, y: height } };
  const corner = { x: width, y: height };
  const tip = { x: width * (1 - 2 * t), y: height * (1 - .48 * Math.sin(Math.PI * t)) };
  const length = Math.hypot(corner.x - tip.x, corner.y - tip.y);
  const normal = { x: (corner.x - tip.x) / length, y: (corner.y - tip.y) / length };
  const middle = { x: (corner.x + tip.x) / 2, y: (corner.y + tip.y) / 2 };
  const offset = dot(normal, middle);
  const { x: nx, y: ny } = normal;
  const matrix = [1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, 2 * nx * offset, 2 * ny * offset];
  const front = clip(rectangle, normal, offset, -1);
  const fold = clip(rectangle, normal, offset, 1);
  const crease = front.filter(p => Math.abs(dot(p, normal) - offset) < 1e-5);
  return { front, fold, back: fold.map(p => reflect(p, matrix)), matrix, crease, normal, radius: Math.min(width, height) * .14 * Math.sin(Math.PI * t), tip };
}
export const polygon = points => points.length > 2 ? `polygon(${points.map(p => `${p.x.toFixed(3)}px ${p.y.toFixed(3)}px`).join(',')})` : 'polygon(0 0,0 0,0 0)';
