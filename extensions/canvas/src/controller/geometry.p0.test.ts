import { describe, expect, test } from "bun:test";
import { boundedCamera, fitCamera, screenToCanvas, zoomAt } from "./geometry";

describe("canvas camera", () => {
  test("keeps the point under the pointer fixed while zooming both ways", () => {
    const camera = { x: 105, y: -92, zoom: 0.75 };
    const anchor = { x: 420, y: 290 };
    const point = screenToCanvas(camera, anchor);
    for (const zoom of [0.1, 0.25, 1, 2, 4]) {
      const next = zoomAt(camera, anchor, zoom);
      expect(screenToCanvas(next, anchor).x).toBeCloseTo(point.x);
      expect(screenToCanvas(next, anchor).y).toBeCloseTo(point.y);
    }
  });
  test("fits measured titles and previews without moving their positions", () => {
    const camera = fitCamera({ x: -100, y: -80, width: 1200, height: 760 }, { width: 800, height: 600 });
    expect(camera.zoom).toBeGreaterThan(0);
    expect(camera.x + -100 * camera.zoom).toBeGreaterThanOrEqual(24);
    expect(camera.y + -80 * camera.zoom).toBeGreaterThanOrEqual(24);
    expect(camera.x + 1100 * camera.zoom).toBeLessThanOrEqual(776);
    expect(camera.y + 680 * camera.zoom).toBeLessThanOrEqual(576);
  });
  test("rejects non-finite camera values and bounds navigation", () => {
    expect(boundedCamera({ x: Infinity, y: NaN, zoom: -3 })).toEqual({ x: 0, y: 0, zoom: 0.000001 });
    expect(boundedCamera({ x: 1e12, y: -1e12, zoom: 1e9 })).toEqual({ x: 1000000, y: -1000000, zoom: 4 });
  });
});

test("reveals an offscreen focused control without changing zoom", async () => {
  const { revealCamera } = await import("./geometry");
  const camera = { x: -600, y: -500, zoom: 4 };
  const viewport = { width: 1176, height: 905 };
  const bounds = { x: -132, y: -259.5, width: 112, height: 112 };
  const next = revealCamera(camera, bounds, viewport);
  expect(next.zoom).toBe(4);
  expect(bounds.x + next.x - camera.x).toBeGreaterThanOrEqual(16);
  expect(bounds.y + next.y - camera.y).toBeGreaterThanOrEqual(16);
  const visible = revealCamera(camera, { x: 32, y: 32, width: 112, height: 112 }, viewport);
  expect(visible).toEqual(camera);
});

test("fits the full supported position range", () => {
  const bounds = { x: -100000, y: 0, width: 200360, height: 436 };
  const camera = fitCamera(bounds, { width: 1176, height: 905 });
  expect(camera.x + bounds.x * camera.zoom).toBeGreaterThanOrEqual(24);
  expect(camera.x + (bounds.x + bounds.width) * camera.zoom).toBeLessThanOrEqual(1152);
});

test("reveals controls at the position limit at maximum zoom", async () => {
  const { revealCamera } = await import("./geometry");
  const camera = { x: 0, y: 0, zoom: 4 };
  const bounds = { x: 400000, y: 0, width: 112, height: 112 };
  const next = revealCamera(camera, bounds, { width: 1176, height: 905 });
  expect(bounds.x + bounds.width + next.x).toBeLessThanOrEqual(1160);
});
