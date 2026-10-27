import { expect, test } from "bun:test";
import { catalogCanvases } from "./definitions";

test("related Auto Build scenarios share one canvas without losing source items", () => {
  const groups = catalogCanvases.filter((canvas) =>
    canvas.items.some(
      (item) => item.preview?.kind === "story" && /auto-build-(button|form)\.stories/.test(item.preview.source),
    ),
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].items.filter((item) => item.preview?.kind === "story")).toHaveLength(26);
  expect(new Set(groups[0].items.map((item) => item.id)).size).toBe(groups[0].items.length);
});

test("folder picker states remain together on one canvas", () => {
  const groups = catalogCanvases.filter((canvas) =>
    canvas.items.some(
      (item) => item.preview?.kind === "story" && item.preview.source.endsWith("folder-picker-dialog.stories.tsx"),
    ),
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].items.length).toBeGreaterThan(10);
  expect(new Set(groups[0].items.map((item) => `${item.position.x},${item.position.y}`)).size).toBe(
    groups[0].items.length,
  );
});
