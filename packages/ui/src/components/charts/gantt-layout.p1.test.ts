import { describe, expect, test } from "bun:test";
import { ganttLayout } from "./gantt-layout";

describe("Gantt schedule layout", () => {
  test("keeps duplicate task labels in distinct lanes and connects dependencies by ID", () => {
    const layout = ganttLayout([
      { id: "a", label: "Review", group: "Foundation", start: 0, end: 7 },
      { id: "b", label: "Review", group: "Preview", start: 7, end: 9, dependsOn: ["a"] },
    ]);
    expect(layout.rows.filter(({ kind }) => kind === "task").map(({ id }) => id)).toEqual(["a", "b"]);
    expect(new Set(layout.rows.map(({ lane }) => lane)).size).toBe(layout.rows.length);
    expect(layout.dependencies).toEqual([{ id: "a:b", from: 7, to: 7, fromLane: "task:a", toLane: "task:b" }]);
    expect(layout.rows.filter(({ kind }) => kind === "group").map(({ start, end }) => [start, end])).toEqual([
      [0, 7],
      [7, 9],
    ]);
  });

  test("keeps milestones and calculates duration-weighted group progress", () => {
    const layout = ganttLayout([
      { id: "a", label: "Build", group: "Launch", start: 0, end: 6, progress: 0.5 },
      { id: "b", label: "Review", group: "Launch", start: 6, end: 8, progress: 1 },
      { id: "c", label: "Release", group: "Launch", start: 8, end: 8, dependsOn: ["b"] },
    ]);
    expect(layout.rows.find(({ kind }) => kind === "group")?.progress).toBe(5 / 8);
    expect(layout.rows.find(({ id }) => id === "c")?.kind).toBe("milestone");
    expect(layout.dependencies.at(-1)?.toLane).toBe("task:c");
  });

  test("keeps application IDs separate from generated group lanes", () => {
    const layout = ganttLayout([{ id: "group:Release", label: "Prepare", group: "Release", start: 0, end: 2 }]);
    expect(layout.rows.map(({ lane }) => lane)).toEqual(["group:Release", "task:group:Release"]);
    expect(layout.rows[1].id).toBe("group:Release");
  });

  test("omits connectors to dependencies outside the displayed data and handles empty schedules", () => {
    expect(ganttLayout([{ id: "a", label: "Review", start: 0, end: 2, dependsOn: ["hidden"] }]).dependencies).toEqual(
      [],
    );
    expect(ganttLayout([])).toEqual({ rows: [], dependencies: [] });
  });
});
