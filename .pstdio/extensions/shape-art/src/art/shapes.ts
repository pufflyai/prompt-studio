export const shapeKinds = ["page", "command", "editor", "skill", "hook", "automation"] as const;
export type ShapeKind = (typeof shapeKinds)[number];

export interface Point {
  x: number;
  y: number;
}

// Mirrors the landing page illustration tokens so the art speaks the same visual language as the site.
export const shapeColors: Record<ShapeKind, string> = {
  page: "#29ABE2",
  command: "#FBB040",
  editor: "#29ABE2",
  skill: "#E6357F",
  hook: "#E6357F",
  automation: "#F7931E",
};

// Width relative to height, taken from the landing page shapes.
export const shapeAspect: Record<ShapeKind, number> = {
  page: 1,
  command: 88 / 24,
  editor: 1,
  skill: 2,
  hook: 1,
  automation: 1,
};

// The hook cross reads as an "x" in the illustrations.
export const shapeBaseRotation: Record<ShapeKind, number> = {
  page: 0,
  command: 0,
  editor: 0,
  skill: 0,
  hook: Math.PI / 4,
  automation: 0,
};

const roundedRect = (width: number, height: number, radius: number) => {
  const segments = 8;
  const right = width / 2 - radius;
  const bottom = height / 2 - radius;
  const corners = [
    [right, -bottom, -Math.PI / 2],
    [right, bottom, 0],
    [-right, bottom, Math.PI / 2],
    [-right, -bottom, Math.PI],
  ];
  return corners.flatMap(([centerX, centerY, start]) =>
    Array.from({ length: segments + 1 }, (_, index) => {
      const angle = start + (index / segments) * (Math.PI / 2);
      return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
    }),
  );
};

const halfDisc = () =>
  Array.from({ length: 33 }, (_, index) => {
    const angle = (index * Math.PI) / 32;
    return { x: -Math.cos(angle), y: 0.5 - Math.sin(angle) };
  });

const cross = () => {
  const arm = 3 / 26;
  return [
    [-arm, -0.5],
    [arm, -0.5],
    [arm, -arm],
    [0.5, -arm],
    [0.5, arm],
    [arm, arm],
    [arm, 0.5],
    [-arm, 0.5],
    [-arm, arm],
    [-0.5, arm],
    [-0.5, -arm],
    [-arm, -arm],
  ].map(([x, y]) => ({ x, y }));
};

const circle = () =>
  Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    return { x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) };
  });

/** Outlines one unit-height shape centered on the origin. Holes are extra contours (even-odd fill). */
export const shapeContours = (kind: ShapeKind): Point[][] => {
  if (kind === "command") return [roundedRect(88 / 24, 1, 0.5)];
  if (kind === "editor") return [roundedRect(1, 1, 8.5 / 26), roundedRect(16 / 26, 16 / 26, 3.5 / 26)];
  if (kind === "skill") return [halfDisc()];
  if (kind === "hook") return [cross()];
  if (kind === "automation") return [circle()];
  return [roundedRect(1, 1, 7.5 / 26)];
};

/** Places points evenly along a closed outline so deformation bleeds the same amount everywhere. */
export const resample = (points: Point[], spacing: number) => {
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  const count = Math.max(8, Math.round(perimeter / spacing));
  const step = perimeter / count;
  const result: Point[] = [];
  let edge = 0;
  let walked = 0;
  for (let index = 0; index < count; index++) {
    const target = index * step;
    while (walked + lengths[edge] < target) walked += lengths[edge++];
    const start = points[edge];
    const end = points[(edge + 1) % points.length];
    const t = lengths[edge] === 0 ? 0 : (target - walked) / lengths[edge];
    result.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return result;
};
