// Isometric projection: world x/y lie on the floor, z points up. Every face is an affine
// image of a rectangle, so plain 2D CSS matrices draw it; no WebGL or 3D transforms.
export const COS = Math.cos(Math.PI / 6);
export const SIN = 0.5;

export interface Origin {
  ox: number;
  oy: number;
}

export interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export const project = (o: Origin, x: number, y: number, z: number) =>
  [o.ox + (x - y) * COS, o.oy + (x + y) * SIN - z] as const;

export const unproject = (o: Origin, sx: number, sy: number, z: number) => {
  const a = (sx - o.ox) / COS;
  const b = (sy - o.oy + z) / SIN;
  return [(a + b) / 2, (b - a) / 2] as const;
};

export const topMatrix = (o: Origin, x: number, y: number, z: number) => {
  const [ex, ey] = project(o, x, y, z);
  return `matrix(${COS},${SIN},${-COS},${SIN},${ex},${ey})`;
};

const depthKey = (e: Extent) => (e.x0 + e.x1 + e.y0 + e.y1) / 2 + (e.z0 + e.z1) * 0.5;

// Boxes that do not intersect always have an axis-aligned plane between them; the box on
// the viewer's side of that plane paints later.
const paintsBefore = (a: Extent, b: Extent) => {
  const e = 0.01;
  if (a.x1 <= b.x0 + e) return true;
  if (b.x1 <= a.x0 + e) return false;
  if (a.y1 <= b.y0 + e) return true;
  if (b.y1 <= a.y0 + e) return false;
  if (a.z1 <= b.z0 + e) return true;
  if (b.z1 <= a.z0 + e) return false;
  return depthKey(a) <= depthKey(b);
};

const screenBounds = (o: Origin, e: Extent) => [
  o.ox + (e.x0 - e.y1) * COS,
  o.ox + (e.x1 - e.y0) * COS,
  o.oy + (e.x0 + e.y0) * SIN - e.z1,
  o.oy + (e.x1 + e.y1) * SIN - e.z0,
];

const overlaps = (a: number[], b: number[]) => !(a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]);

/** Links each pair of boxes that overlap on screen, from the one painted first to the other. */
const paintEdges = (o: Origin, extents: Extent[]) => {
  const bounds = extents.map((e) => screenBounds(o, e));
  const after = extents.map(() => [] as number[]);
  const pending = extents.map(() => 0);
  for (let i = 0; i < extents.length; i++) {
    for (let j = i + 1; j < extents.length; j++) {
      if (!overlaps(bounds[i], bounds[j])) continue;
      const [first, second] = paintsBefore(extents[i], extents[j]) ? [i, j] : [j, i];
      after[first].push(second);
      pending[second]++;
    }
  }
  return { after, pending };
};

/** Returns box indices in paint order: overlapping boxes are ordered topologically, ties by depth. */
export const paintOrder = (o: Origin, extents: Extent[]) => {
  const { after, pending } = paintEdges(o, extents);
  const keys = extents.map(depthKey);
  const left = new Set(extents.map((_, i) => i));
  const order: number[] = [];
  const shallowest = (candidates: number[]) => candidates.reduce((best, i) => (keys[i] < keys[best] ? i : best));
  while (left.size) {
    const ready = [...left].filter((i) => pending[i] === 0);
    // A cycle only happens with intersecting boxes; fall back to depth.
    const next = shallowest(ready.length ? ready : [...left]);
    left.delete(next);
    order.push(next);
    for (const j of after[next]) pending[j]--;
  }
  return order;
};
