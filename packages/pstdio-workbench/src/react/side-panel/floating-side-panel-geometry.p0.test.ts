import { expect, test } from "bun:test";
import { fitFloatingPanel, resizeFloatingPanel } from "./floating-side-panel-geometry";

const viewport = { width: 1280, height: 800 };
const frame = { x: 400, y: 200, width: 480, height: 400 };

test("free movement keeps the entire panel inside the viewport", () => {
  expect(fitFloatingPanel({ ...frame, x: -100, y: 1200 }, viewport)).toEqual({
    x: 12,
    y: 388,
    width: 480,
    height: 400,
  });
});

test("resizing a top left corner keeps the opposite corner fixed", () => {
  expect(resizeFloatingPanel(frame, { x: -80, y: -40 }, viewport)).toEqual({
    x: 320,
    y: 160,
    width: 560,
    height: 440,
  });
});

test("top left resizing stops at the minimum size without moving the opposite edge", () => {
  expect(resizeFloatingPanel(frame, { x: 1000, y: 0 }, viewport)).toEqual({
    x: 560,
    y: 200,
    width: 320,
    height: 400,
  });
  expect(resizeFloatingPanel(frame, { x: 0, y: 1000 }, viewport)).toEqual({
    x: 400,
    y: 408,
    width: 480,
    height: 192,
  });
});

test("resizing stops at the viewport boundary", () => {
  expect(resizeFloatingPanel(frame, { x: -2000, y: -2000 }, viewport)).toEqual({
    x: 12,
    y: 12,
    width: 868,
    height: 588,
  });
});

test("a smaller viewport fits the panel without overwriting its saved frame", () => {
  const saved = { x: 700, y: 300, width: 480, height: 400 };
  expect(fitFloatingPanel(saved, { width: 300, height: 180 })).toEqual({
    x: 12,
    y: 12,
    width: 276,
    height: 156,
  });
  expect(fitFloatingPanel(saved, viewport)).toEqual(saved);
});
