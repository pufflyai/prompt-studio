import { expect, test } from "bun:test";
import { geometry, trackAt } from "./timeline-geometry";

test("keeps full-height cards and later milestones from overlapping", () => {
  const layout = {
    trackLanes: [1, 1],
    bands: [
      { sectionId: "first", startRow: 0, rowCount: 2, collapsed: false },
      { sectionId: "second", startRow: 2, rowCount: 1, collapsed: false },
    ],
    nodes: [
      { id: "long-title", track: 0, lane: 0, row: 0 },
      { id: "parallel", track: 1, lane: 0, row: 0 },
      { id: "dependent", track: 0, lane: 0, row: 1 },
      { id: "later", track: 0, lane: 0, row: 2 },
    ],
  };
  const box = geometry(
    layout,
    new Map([
      ["long-title", 180],
      ["parallel", 100],
      ["dependent", 80],
      ["later", 110],
    ]),
  );
  const long = box.positions.get("long-title")!;
  const parallel = box.positions.get("parallel")!;
  const dependent = box.positions.get("dependent")!;
  const later = box.positions.get("later")!;
  expect(long.height).toBe(180);
  expect(parallel.y).toBe(long.y);
  expect(dependent.y).toBeGreaterThan(long.y + long.height);
  expect(box.bands[1]!.top).toBeGreaterThan(dependent.y + dependent.height);
  expect(box.bands[1]!.top + box.bands[1]!.height).toBeGreaterThan(later.y + later.height);
});

test("drops between tracks and past the final track choose the nearest track", () => {
  const boxes = [
    { x: 88, width: 240 },
    { x: 384, width: 240 },
    { x: 680, width: 240 },
  ];
  const tracks = [
    { id: "first", label: "First" },
    { id: "second", label: "Second" },
    { id: "third", label: "Third" },
  ];
  expect(trackAt(boxes, tracks, 376)).toBe("second");
  expect(trackAt(boxes, tracks, 990)).toBe("third");
  expect(trackAt(boxes, tracks, 80)).toBe("first");
  expect(trackAt(boxes, tracks, 60)).toBeUndefined();
  expect(trackAt([], [], 376)).toBeUndefined();
});
