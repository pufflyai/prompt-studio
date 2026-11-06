import { expect, test } from "bun:test";
import { milestoneLabelLayout } from "./gantt-milestones";

test("coincident milestone labels preserve both names at one reference line", () => {
  const layout = milestoneLabelLayout(
    [
      { id: "a", label: "Build", value: 7 },
      { id: "b", label: "Review", value: 7 },
    ],
    [0, 10],
    500,
    (value) => `${value}h`,
  );
  expect(layout.labels).toHaveLength(1);
  expect(layout.labels[0].label).toBe("Build, Review · 7h");
});
test("nearby milestone names occupy separate levels and expand the header", () => {
  const layout = milestoneLabelLayout(
    [1, 2, 3, 4].map((value) => ({ id: String(value), value, label: "Milestone" })),
    [0, 10],
    100,
    String,
  );
  expect(new Set(layout.labels.map(({ dy }) => dy)).size).toBe(4);
  expect(layout.top).toBeGreaterThan(56);
});

test("uses measured glyph widths when custom fonts or wide names need more space", () => {
  const markers = [7, 9].map((value) => ({ id: String(value), value, label: "发布" }));
  const layout = milestoneLabelLayout(markers, [0, 10], 600, String, () => 200);
  expect(new Set(layout.labels.map(({ dy }) => dy)).size).toBe(2);
});
