import { expect, test } from "bun:test";
import { geometry } from "./graph-geometry";

test("keeps full-height cards and later milestones from overlapping", () => {
  const layout = {
    trackLanes: [1, 1],
    bands: [
      { deadlineId: "first", startRow: 0, rowCount: 2, collapsed: false },
      { deadlineId: "second", startRow: 2, rowCount: 1, collapsed: false },
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
