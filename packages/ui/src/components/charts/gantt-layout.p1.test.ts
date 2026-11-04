import { describe, expect, test } from "bun:test";
import { ganttLayout } from "./gantt-layout";

describe("Gantt ticket schedule", () => {
  test("renders one row per ticket in supplied order, including interleaved groups and duplicate labels", () => {
    const layout = ganttLayout([
      { id: "a", label: "Review", group: "Foundation", start: 0, end: 7 },
      { id: "b", label: "Review", group: "Preview", start: 7, end: 9, dependsOn: ["a"] },
      { id: "c", label: "Release", group: "Foundation", start: 9, end: 9 },
    ]);
    expect(layout.rows.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(new Set(layout.rows.map(({ lane }) => lane)).size).toBe(3);
    expect(layout.dependencies).toEqual([{ id: "a:b", from: 7, to: 7, fromLane: "task:a", toLane: "task:b" }]);
    expect(layout.rows[2].kind).toBe("milestone");
  });

  test("preserves ticket progress and IDs without manufacturing group rows", () => {
    const layout = ganttLayout([
      { id: "group:Release", label: "Prepare", group: "Release", start: 0, end: 2, progress: 0.5 },
    ]);
    expect(layout.rows).toHaveLength(1);
    expect(layout.rows[0]).toMatchObject({ id: "group:Release", lane: "task:group:Release", progress: 0.5 });
  });

  test("omits connectors to hidden dependencies and handles empty schedules", () => {
    expect(ganttLayout([{ id: "a", label: "Review", start: 0, end: 2, dependsOn: ["hidden"] }]).dependencies).toEqual(
      [],
    );
    expect(ganttLayout([])).toEqual({ rows: [], dependencies: [] });
  });
});
