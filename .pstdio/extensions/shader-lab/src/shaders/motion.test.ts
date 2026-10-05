import { expect, test } from "bun:test";
import { defaultValues, findShader } from "./definitions";
import { motions, retime } from "./motion";

const box = { width: 400, height: 200 };
const values = (shader: string) => defaultValues(findShader(shader));
const motion = (shader: string, name: string, time = 3) =>
  motions(shader, values(shader), box, time).find((item) => item.name === name)!;

test("noise and its counter move one tile in opposite directions at the same phase", () => {
  const noise = motion("section-hatch", "noise");
  const counter = motion("section-hatch", "noise-counter");
  expect(noise.distance).toEqual({ x: -800, y: 0 });
  expect(counter.distance).toEqual({ x: 800, y: 0 });
  expect(noise.durationSeconds).toBe(160);
  expect(counter.durationSeconds).toBe(noise.durationSeconds);
  expect(noise.delaySeconds).toBe(-3);
  expect(counter.delaySeconds).toBe(-3);
});

test("hatch moves one spacing along the rotated axis", () => {
  const hatch = motion("section-hatch", "hatch");
  expect(hatch.distance.x).toBeCloseTo(8 * Math.cos(Math.PI / 4));
  expect(hatch.distance.y).toBeCloseTo(8 * Math.sin(Math.PI / 4));
  expect(hatch.durationSeconds).toBeCloseTo(8 / 3);
  expect(hatch.delaySeconds).toBe(-3);
});

test("ruler moves one major period in whole pixel steps", () => {
  const ticks = motion("ruler-ticks", "ticks");
  expect(ticks.distance).toEqual({ x: -20, y: 0 });
  expect(ticks.durationSeconds).toBeCloseTo(20 / 12);
  expect(ticks.timing).toBe("steps(20)");
  expect(ticks.delaySeconds).toBe(-3);
});

test("grid band and counter sweep the width plus one band every cycle", () => {
  const band = motion("dots-to-grid", "band");
  const counter = motion("dots-to-grid", "band-counter");
  expect(band.distance).toEqual({ x: 560, y: 0 });
  expect(counter.distance).toEqual({ x: -560, y: 0 });
  expect(band.durationSeconds).toBe(4.5);
  expect(counter.durationSeconds).toBe(4.5);
  expect(band.delaySeconds).toBe(-3);
});

test("crosshair axes have independent alternating half cycles and starting phases", () => {
  const x = motion("plotter-crosshair", "crosshair-x", 0);
  const y = motion("plotter-crosshair", "crosshair-y", 0);
  expect(x.distance).toEqual({ x: 320, y: 0 });
  expect(y.distance).toEqual({ x: 0, y: 120 });
  expect(x.durationSeconds).toBeCloseTo(Math.PI / 0.7);
  expect(y.durationSeconds).toBeCloseTo(Math.PI / 1.1);
  expect(x.delaySeconds).toBeCloseTo(-x.durationSeconds / 2);
  expect(y.delaySeconds).toBeCloseTo(-(Math.PI / 2 + 1) / 1.1);
  expect(x.direction).toBe("alternate");
  expect(x.timing).toBe("ease-in-out");
});

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

test("noise counters share pixel steps and hatch steps along its rotated axis", () => {
  const parts = motions("section-hatch", values("section-hatch"), box, 0);
  expect(parts.find((item) => item.name === "noise")?.timing).toBe("steps(800)");
  expect(parts.find((item) => item.name === "noise-counter")?.timing).toBe("steps(800)");
  expect(parts.find((item) => item.name === "hatch")?.timing).toBe("steps(8)");
});
