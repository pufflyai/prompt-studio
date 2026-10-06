import type { Random } from "./random";
import type { Point } from "./shapes";

interface Edge {
  top: number;
  bottom: number;
  x: number;
  slope: number;
}

const SUBSAMPLES = 4;

const polygonEdges = (contours: Point[][]) => {
  const edges: Edge[] = [];
  for (const contour of contours) {
    contour.forEach((a, index) => {
      const b = contour[(index + 1) % contour.length];
      if (a.y === b.y) return;
      const [upper, lower] = a.y < b.y ? [a, b] : [b, a];
      edges.push({ top: upper.y, bottom: lower.y, x: upper.x, slope: (lower.x - upper.x) / (lower.y - upper.y) });
    });
  }
  return edges.sort((a, b) => a.top - b.top);
};

/** Adds one sub-row span to the row coverage, with fractional coverage at both ends. */
const addSpan = (coverage: Float32Array, start: number, end: number) => {
  const startCell = Math.floor(start);
  const endCell = Math.floor(end);
  if (startCell === endCell) {
    coverage[startCell] += (end - start) / SUBSAMPLES;
    return;
  }
  coverage[startCell] += (startCell + 1 - start) / SUBSAMPLES;
  for (let cell = startCell + 1; cell < endCell; cell++) coverage[cell] += 1 / SUBSAMPLES;
  coverage[endCell] += (end - endCell) / SUBSAMPLES;
};

/**
 * Even-odd scanline fill with 4 sub-rows and exact horizontal coverage, for smooth edges.
 * Calls `plot` once per touched pixel with its coverage in 0..1.
 */
export const fillPolygon = (
  width: number,
  height: number,
  contours: Point[][],
  plot: (x: number, y: number, coverage: number) => void,
) => {
  const edges = polygonEdges(contours);
  if (edges.length === 0) return;
  const firstRow = Math.max(0, Math.floor(edges[0].top));
  const lastRow = Math.min(height - 1, Math.ceil(Math.max(...edges.map((edge) => edge.bottom))));
  const xs = edges.flatMap((edge) => [edge.x, edge.x + (edge.bottom - edge.top) * edge.slope]);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const right = Math.min(width - 1, Math.ceil(Math.max(...xs)));
  const coverage = new Float32Array(width + 1);
  let active: Edge[] = [];
  let pending = 0;

  for (let row = firstRow; row <= lastRow; row++) {
    for (let sub = 0; sub < SUBSAMPLES; sub++) {
      const y = row + (sub + 0.5) / SUBSAMPLES;
      while (pending < edges.length && edges[pending].top <= y) active.push(edges[pending++]);
      active = active.filter((edge) => edge.bottom > y);
      const crossings = active.map((edge) => edge.x + (y - edge.top) * edge.slope).sort((a, b) => a - b);
      for (let index = 0; index + 1 < crossings.length; index += 2) {
        const start = Math.max(0, crossings[index]);
        const end = Math.min(width, crossings[index + 1]);
        if (end > start) addSpan(coverage, start, end);
      }
    }
    for (let x = left; x <= right; x++) {
      if (coverage[x] > 0) plot(x, row, Math.min(1, coverage[x]));
      coverage[x] = 0;
    }
    coverage[width] = 0;
  }
};

export const TEXTURE_SIZE = 512;

/** Tileable fractal value noise in 0..1. Sample with `(x & 511) + (y & 511) * 512`. */
export const createTexture = (random: Random, cells: number) => {
  const texture = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave++) {
    const grid = cells << octave;
    const lattice = Array.from({ length: grid * grid }, () => random.next());
    const cellSize = TEXTURE_SIZE / grid;
    const at = (cx: number, cy: number) => lattice[(cx % grid) + (cy % grid) * grid];
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const gy = y / cellSize;
      const y0 = Math.floor(gy);
      const ty = smooth(gy - y0);
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const gx = x / cellSize;
        const x0 = Math.floor(gx);
        const tx = smooth(gx - x0);
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        texture[x + y * TEXTURE_SIZE] += (top + (bottom - top) * ty) * amplitude;
      }
    }
    total += amplitude;
    amplitude /= 2;
  }
  for (let index = 0; index < texture.length; index++) texture[index] /= total;
  return texture;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Per-pixel white noise in 0..1 that does not depend on render order. */
export const pixelNoise = (x: number, y: number, salt: number) => {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2147483647);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};

const blurLine = (
  source: Float32Array,
  target: Float32Array,
  start: number,
  stride: number,
  length: number,
  radius: number,
) => {
  let sum = 0;
  for (let index = -radius; index <= radius; index++) sum += source[start + clampIndex(index, length) * stride];
  for (let index = 0; index < length; index++) {
    target[start + index * stride] = sum / (radius * 2 + 1);
    sum += source[start + clampIndex(index + radius + 1, length) * stride];
    sum -= source[start + clampIndex(index - radius, length) * stride];
  }
};

const clampIndex = (index: number, length: number) => Math.min(length - 1, Math.max(0, index));

/** Two box-blur passes in each direction, close enough to a Gaussian for pigment pooling. */
export const blur = (values: Float32Array, width: number, height: number, radius: number) => {
  const scratch = new Float32Array(values.length);
  const result = Float32Array.from(values);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) blurLine(result, scratch, y * width, 1, width, radius);
    for (let x = 0; x < width; x++) blurLine(scratch, result, x, width, height, radius);
  }
  return result;
};
