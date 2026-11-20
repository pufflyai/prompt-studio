import { expect, test } from "bun:test";
import { defaultValues, findShader } from "./definitions";
import { motions, retime } from "./motion";

const box = { width: 400, height: 200 };
const values = (shader: string) => defaultValues(findShader(shader));
const motion = (shader: string, name: string, time: number) =>
  motions(shader, values(shader), box, time).find((item) => item.name === name)!;

test("zero drift and speed keep a static phase without infinite duration", () => {
  for (const shader of ["section-hatch", "ruler-ticks", "plotter-crosshair"]) {
    const config = { ...values(shader), noiseDrift: 0, lineDrift: 0, speed: 0 };
    for (const item of motions(shader, config, box, 3)) {
      expect(item.durationSeconds).toBe(0);
      expect(Number.isFinite(item.delaySeconds)).toBe(true);
    }
  }
});

test("changed duration preserves phase, including the return leg of alternate motion", () => {
  const previous = motion("ruler-ticks", "ticks", 0);
  const next = { ...previous, durationSeconds: 10 };
  const time = previous.durationSeconds * 0.4;
  expect(retime(previous, next, time).delaySeconds).toBeCloseTo(-4);
  const x = motion("plotter-crosshair", "crosshair-x", 0);
  expect(retime(x, { ...x, durationSeconds: 20 }, x.durationSeconds).delaySeconds).toBeCloseTo(-30);
});

test("mounting a stopped axis keeps its starting phase regardless of clock time", () => {
  const config = { ...values("plotter-crosshair"), speed: 0, noiseDrift: 0 };
  const initial = motions("plotter-crosshair", config, box, 0);
  const later = motions("plotter-crosshair", config, box, 3.17);
  expect(later.map((item) => item.delaySeconds)).toEqual(initial.map((item) => item.delaySeconds));
});
