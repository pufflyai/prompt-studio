// Route dependency arrows between the facing edges of their ticket cards.

export interface NodeBox {
  width: number;
  height: number;
  x: number;
  y: number;
}

// An upward edge shows work placed before its dependency.
export function edgePath(from: NodeBox, to: NodeBox) {
  const upward = from.y > to.y;
  const x1 = from.x + from.width / 2;
  const x2 = to.x + to.width / 2;
  const y1 = upward ? from.y : from.y + from.height;
  const y2 = upward ? to.y + to.height : to.y;
  const bend = Math.max(24, Math.abs(y2 - y1) / 2) * (upward ? -1 : 1);
  const tip = upward ? 6 : -6;
  return {
    upward,
    // The curve leaves and enters vertically, so the arrowhead lines up with its last segment.
    path: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
    head: `M ${x2 - 4} ${y2 + tip} L ${x2} ${y2} L ${x2 + 4} ${y2 + tip}`,
  };
}
