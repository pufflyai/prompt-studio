export const floatingBubblePositions = {
  "top-left": { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  "top-right": { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  right: { x: 1, y: 0.5 },
  "bottom-left": { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  "bottom-right": { x: 1, y: 1 },
} as const;

export interface FloatingBubblePosition {
  x: number;
  y: number;
}

const readPosition = (value: unknown) => {
  if (!value || typeof value !== "object") return;
  const { x, y } = value as FloatingBubblePosition;
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
};

export const floatingBubbleAnchor = (position: FloatingBubblePosition) =>
  (Object.keys(floatingBubblePositions) as (keyof typeof floatingBubblePositions)[]).find((name) => {
    const anchor = floatingBubblePositions[name];
    return anchor.x === position.x && anchor.y === position.y;
  });

export const requireFloatingBubblePosition = (value: unknown) => {
  const position = readPosition(value);
  if (!position || !floatingBubbleAnchor(position))
    throw new Error("Expected one of the eight floating bubble anchors");
  return position;
};

export const normalizeFloatingBubblePosition = (value: unknown) => {
  const position = readPosition(value);
  if (!position) return floatingBubblePositions["bottom-right"];
  const clamped = { x: Math.max(0, Math.min(1, position.x)), y: Math.max(0, Math.min(1, position.y)) };
  return Object.values(floatingBubblePositions).reduce<FloatingBubblePosition>((nearest, anchor) => {
    const distance = (point: FloatingBubblePosition) => (point.x - clamped.x) ** 2 + (point.y - clamped.y) ** 2;
    return distance(anchor) < distance(nearest) ? anchor : nearest;
  }, floatingBubblePositions["bottom-right"]);
};

export const nextFloatingBubblePosition = (position: FloatingBubblePosition, key: string) => {
  if (key === "Home") return floatingBubblePositions["bottom-right"];
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!direction) return;
  const horizontal = direction[0] !== 0;
  const axis = horizontal ? "x" : "y";
  const cross = horizontal ? "y" : "x";
  const sign = horizontal ? direction[0]! : direction[1]!;
  return (
    Object.values(floatingBubblePositions)
      .filter((anchor) => (anchor[axis] - position[axis]) * sign > 0)
      .sort(
        (a, b) =>
          Math.abs(a[cross] - position[cross]) - Math.abs(b[cross] - position[cross]) ||
          Math.abs(a[axis] - position[axis]) - Math.abs(b[axis] - position[axis]),
      )[0] ?? position
  );
};
