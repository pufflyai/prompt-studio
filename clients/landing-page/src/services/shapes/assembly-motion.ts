export interface Point {
  x: number;
  y: number;
}
export const MOTION_DURATION_SCALE = 1.3;

export const travel = (from: Point, to: Point, progress: number, bend: number) => {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const arc = Math.sin(Math.PI * ease) * bend;
  return {
    x: from.x + (to.x - from.x) * ease - ((to.y - from.y) / distance) * arc,
    y: from.y + (to.y - from.y) * ease + ((to.x - from.x) / distance) * arc,
  };
};
