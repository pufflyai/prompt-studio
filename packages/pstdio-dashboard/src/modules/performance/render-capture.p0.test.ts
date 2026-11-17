import { expect, test } from "bun:test";
import { createRenderSummary } from "./render-capture";

test("ranks repeated updates with no detected input changes by their render cost", () => {
  const capture = createRenderSummary();
  capture.record("Navigation", 5, "unchanged");
  capture.record("Navigation", 8, "unchanged");
  capture.record("Navigation", 14, "changed");
  capture.record("Navigation", null, "unknown");
  capture.record("Toolbar", 2, "unchanged");
  expect(capture.finish().components).toEqual([
    { name: "Navigation", renders: 4, unchanged: 2, unknown: 1, renderMs: 27, unchangedRenderMs: 13 },
    { name: "Toolbar", renders: 1, unchanged: 1, unknown: 0, renderMs: 2, unchangedRenderMs: 2 },
  ]);
});

test("bounds the summary and preserves unknown timings", () => {
  const capture = createRenderSummary();
  for (let i = 0; i < 260; i++) capture.record(`Component${i}`, null, "unknown");
  const summary = capture.finish();
  expect(summary.truncated).toBe(true);
  expect(summary.components).toHaveLength(20);
  expect(summary.components[0]).toMatchObject({ unchanged: 0, unknown: 1, renderMs: null });
});
