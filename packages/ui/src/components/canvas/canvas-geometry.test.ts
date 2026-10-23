import { expect, test } from "bun:test";
import { zoomCanvas } from "./canvas-geometry";

test("canvas zoom preserves the world point beneath the pointer in both directions", () => {
  const camera = { x: 100, y: -50, zoom: 0.5 };
  const anchor = { x: 300, y: 200 };
  const limits = { minZoom: 0.1, maxZoom: 4 };
  const next = zoomCanvas(camera, { factor: 2, anchor }, limits);
  expect((anchor.x - next.x) / next.zoom).toBe((anchor.x - camera.x) / camera.zoom);
  expect((anchor.y - next.y) / next.zoom).toBe((anchor.y - camera.y) / camera.zoom);
  expect(zoomCanvas(next, { factor: 0.5, anchor }, limits)).toEqual(camera);
});

test("canvas pinch can move its anchor without changing scale", () => {
  const camera = { x: -200, y: -100, zoom: 1 };
  expect(zoomCanvas(camera, { factor: 1, anchor: { x: 100, y: 100 }, targetAnchor: { x: 140, y: 120 } })).toEqual({
    x: -160,
    y: -80,
    zoom: 1,
  });
});

test("canvas zoom respects the caller's scale limits and rejects invalid factors", () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  const anchor = { x: 100, y: 50 };
  expect(zoomCanvas(camera, { factor: 100, anchor }).zoom).toBe(1);
  expect(zoomCanvas(camera, { factor: 0.001, anchor }).zoom).toBe(0.25);
  for (const factor of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    expect(zoomCanvas(camera, { factor, anchor })).toEqual(camera);
  }
});
