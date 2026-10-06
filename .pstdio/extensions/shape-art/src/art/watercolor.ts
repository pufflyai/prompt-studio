import type { Random } from "./random";
import type { Point } from "./shapes";

// A few sine waves with whole-number frequencies, so the wobble closes seamlessly around the outline.
const wobble = (random: Random, amplitude: number) => {
  const waves = Array.from({ length: 5 }, (_, octave) => ({
    frequency: random.int(2 + octave * 3, 4 + octave * 6),
    phase: random.range(0, Math.PI * 2),
    amplitude: (amplitude / (octave + 1)) * random.range(0.5, 1),
  }));
  return (t: number) =>
    waves.reduce((sum, wave) => sum + wave.amplitude * Math.sin(wave.frequency * Math.PI * 2 * t + wave.phase), 0);
};

const displace = (points: Point[], offset: (t: number) => number) =>
  points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
    const distance = offset(index / points.length);
    return {
      x: point.x + ((next.y - previous.y) / length) * distance,
      y: point.y - ((next.x - previous.x) / length) * distance,
    };
  });

/**
 * Returns a source of slightly different outlines, one per translucent pigment layer.
 * The base wobble gives the shape its hand-painted outline; per-layer wobble softens the edge.
 */
export const createWash = (contours: Point[][], size: number, bleed: number, random: Random) => {
  const base = contours.map((contour) => displace(contour, wobble(random, size * bleed * 0.05)));
  return () => base.map((contour) => displace(contour, wobble(random, size * bleed * 0.035)));
};
