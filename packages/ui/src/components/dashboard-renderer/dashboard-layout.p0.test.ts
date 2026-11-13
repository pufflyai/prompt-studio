import { describe, expect, test } from "bun:test";
import { compactWidgets, dashboardColumns, moveWidget, projectWidgets, resizeWidget } from "./dashboard-layout";
import type { DashboardWidget } from "./dashboard-types";

const fixtures: DashboardWidget[] = [
  { id: "first", title: "First", kind: "metric", source: "users", layout: { x: 0, y: 0, w: 4, h: 3 } },
  { id: "second", title: "Second", kind: "metric", source: "users", layout: { x: 4, y: 0, w: 4, h: 3 } },
  { id: "chart", title: "Chart", kind: "line", source: "users", layout: { x: 0, y: 3, w: 6, h: 8 } },
];

const rowFixtures: DashboardWidget[] = [
  fixtures[0],
  fixtures[1],
  { ...fixtures[0], id: "third", layout: { x: 8, y: 0, w: 4, h: 3 } },
  { ...fixtures[2], id: "left-chart", layout: { x: 0, y: 3, w: 6, h: 8 } },
  { ...fixtures[2], id: "right-chart", layout: { x: 6, y: 3, w: 6, h: 8 } },
  { ...fixtures[2], id: "table", kind: "table", layout: { x: 0, y: 11, w: 12, h: 4 } },
];

const probe = (y: number, x = 2) => ({ position: { x, y }, gapRatio: 1 / 3 });

describe("dashboard grid editing", () => {
  test("dragging onto a horizontal neighbor swaps places without pushing it into another row", () => {
    const result = moveWidget(fixtures, "first", { x: 4, y: 0, w: 4, h: 3 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(fixtures[1].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(fixtures[0].layout);
    expect(result.find(({ id }) => id === "chart")?.layout).toEqual(fixtures[2].layout);
    expect(moveWidget(fixtures, "first", { x: 4, y: 0, w: 4, h: 3 }, 12)).toEqual(result);
    expect(fixtures[0].layout).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  test("overlapping a neighbor swaps it even before the dragged center reaches it", () => {
    const result = moveWidget(fixtures, "first", { x: 1, y: 0, w: 4, h: 3 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(fixtures[1].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(fixtures[0].layout);
  });

  test("vertical neighbors exchange their positions", () => {
    const vertical = [fixtures[0], { ...fixtures[1], layout: { x: 0, y: 3, w: 4, h: 3 } }];
    const result = moveWidget(vertical, "first", { x: 0, y: 4, w: 4, h: 3 }, 12, "vertical", probe(5.8));
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(vertical[0].layout);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(vertical[1].layout);
    const taller = [vertical[0], { ...vertical[1], layout: { ...vertical[1].layout, h: 8 } }];
    const resized = moveWidget(taller, "first", { x: 0, y: 9, w: 4, h: 3 }, 12, "vertical", probe(10.8));
    expect(resized.find(({ id }) => id === "second")?.layout).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(resized.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 8, w: 4, h: 3 });
  });

  test("horizontal swaps preserve different widget sizes and the occupied row", () => {
    const sized = [
      { ...fixtures[0], layout: { x: 0, y: 0, w: 3, h: 3 } },
      { ...fixtures[1], layout: { x: 3, y: 0, w: 6, h: 3 } },
      { ...fixtures[0], id: "third", layout: { x: 9, y: 0, w: 3, h: 3 } },
    ];
    const result = moveWidget(sized, "first", { x: 3, y: 0, w: 3, h: 3 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 6, y: 0, w: 3, h: 3 });
    expect(result.find(({ id }) => id === "second")?.layout).toEqual({ x: 0, y: 0, w: 6, h: 3 });
    expect(result.find(({ id }) => id === "third")?.layout).toEqual(sized[2].layout);
  });

  test("phone row gaps insert only the dragged widget into reading order", () => {
    const metrics = [fixtures[0], fixtures[1], { ...fixtures[0], id: "third", layout: { x: 8, y: 0, w: 4, h: 3 } }];
    const result = moveWidget(metrics, "first", { x: 0, y: 4, w: 1, h: 3 }, 1, "free", probe(5.8, 0.5));
    expect(projectWidgets(result, 1).map(({ id }) => id)).toEqual(["second", "first", "third"]);
  });

  test("a widget can rejoin the empty slot in an earlier row and compact the space it leaves", () => {
    const separated = rowFixtures.map((widget) => {
      if (widget.id === "first") return { ...widget, layout: { ...widget.layout, y: 3 } };
      if (widget.id.endsWith("chart") || widget.id === "table")
        return { ...widget, layout: { ...widget.layout, y: widget.layout.y + 3 } };
      return widget;
    });
    const result = moveWidget(separated, "first", { x: 0, y: 1, w: 4, h: 3 }, 12, "vertical", probe(1.5));
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 0, w: 4, h: 3 });
    expect(result.find(({ id }) => id === "left-chart")?.layout.y).toBe(3);
    expect(result.find(({ id }) => id === "table")?.layout.y).toBe(11);
  });

  test("a vertical drag can join a vacant slot between widgets without swapping them", () => {
    const spaced = [
      fixtures[0],
      { ...fixtures[1], layout: { x: 8, y: 0, w: 4, h: 3 } },
      { ...fixtures[0], id: "moved", layout: { x: 0, y: 3, w: 4, h: 3 } },
    ];
    const result = moveWidget(spaced, "moved", { x: 3, y: 1, w: 4, h: 3 }, 12, "vertical", probe(1.5, 6));
    expect(result.find(({ id }) => id === "moved")?.layout).toEqual({ x: 4, y: 0, w: 4, h: 3 });
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(spaced[0].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(spaced[1].layout);
  });

  test("a widget wider than the vacant row slot cannot join it", () => {
    const spaced = [
      fixtures[0],
      { ...fixtures[1], layout: { x: 8, y: 0, w: 4, h: 3 } },
      { ...fixtures[2], layout: { x: 0, y: 3, w: 6, h: 8 } },
    ];
    expect(moveWidget(spaced, "chart", { x: 4, y: 1, w: 6, h: 8 }, 12, "vertical", probe(1.5, 6))).toEqual(spaced);
  });

  test("occupied content below a tall row does not target a vacancy above the pointer", () => {
    const staggered = [
      { ...fixtures[0], layout: { x: 0, y: 0, w: 4, h: 8 } },
      fixtures[1],
      { ...fixtures[2], layout: { x: 6, y: 3, w: 6, h: 8 } },
      { ...fixtures[0], id: "moved", layout: { x: 0, y: 11, w: 4, h: 3 } },
    ];
    expect(moveWidget(staggered, "moved", { x: 8, y: 4, w: 4, h: 3 }, 12, "vertical", probe(5, 10))).toEqual(staggered);
  });

  test("tablet rejoining fits saved row capacity even when responsive packing moved its columns", () => {
    const separated = [
      fixtures[1],
      { ...fixtures[0], id: "third", layout: { x: 8, y: 0, w: 4, h: 3 } },
      { ...fixtures[2], id: "left-chart", layout: { x: 0, y: 3, w: 6, h: 8 } },
      { ...fixtures[2], id: "right-chart", layout: { x: 6, y: 3, w: 6, h: 8 } },
      { ...fixtures[0], layout: { x: 0, y: 11, w: 4, h: 8 } },
    ];
    const result = moveWidget(separated, "first", { x: 4, y: 1, w: 2, h: 8 }, 6, "free", probe(1.5, 5));
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(
      projectWidgets(result, 6)
        .filter(({ layout }) => layout.y === 0)
        .map(({ id }) => id),
    ).toEqual(["first", "second", "third"]);
  });

  test("a vacancy in a staggered layout joins the nearest row under the pointer", () => {
    const staggered = [
      { ...fixtures[0], layout: { x: 0, y: 0, w: 4, h: 8 } },
      fixtures[1],
      { ...fixtures[2], layout: { x: 4, y: 3, w: 3, h: 8 } },
      { ...fixtures[0], id: "moved", layout: { x: 0, y: 11, w: 4, h: 3 } },
    ];
    const result = moveWidget(staggered, "moved", { x: 8, y: 4, w: 4, h: 3 }, 12, "free", probe(5, 10));
    expect(result.find(({ id }) => id === "moved")?.layout).toEqual({ x: 8, y: 3, w: 4, h: 3 });
  });

  test("free placement can rejoin a row while retaining deliberate vertical gaps elsewhere", () => {
    const spaced = [
      fixtures[0],
      { ...fixtures[1], layout: { x: 8, y: 0, w: 4, h: 3 } },
      { ...fixtures[2], layout: { x: 0, y: 9, w: 6, h: 8 } },
      { ...fixtures[0], id: "moved", layout: { x: 0, y: 3, w: 4, h: 3 } },
    ];
    const result = moveWidget(spaced, "moved", { x: 3, y: 1, w: 4, h: 3 }, 12, "free", probe(1.5, 6));
    expect(result.find(({ id }) => id === "moved")?.layout).toEqual({ x: 4, y: 0, w: 4, h: 3 });
    expect(result.find(({ id }) => id === "chart")?.layout.y).toBe(9);
  });

  test("horizontal swaps honor Compact up while Free placement retains vertical spacing", () => {
    const spaced = [
      fixtures[0],
      { ...fixtures[1], layout: { x: 4, y: 5, w: 4, h: 3 } },
      { ...fixtures[1], id: "third", layout: { x: 8, y: 5, w: 4, h: 3 } },
    ];
    const compacted = moveWidget(spaced, "second", { x: 8, y: 5, w: 4, h: 3 }, 12);
    expect(compacted.map(({ layout }) => layout.y)).toEqual([0, 0, 0]);
    const free = moveWidget(spaced, "second", { x: 8, y: 5, w: 4, h: 3 }, 12, "free");
    expect(free.find(({ id }) => id === "second")?.layout.y).toBe(5);
  });

  test("Compact up fills the hole above after row insertion while Free placement keeps the new row", () => {
    const candidate = { x: 0, y: 10, w: 4, h: 3 };
    const compacted = moveWidget(rowFixtures, "first", candidate, 12, "vertical", probe(10.8));
    expect(compacted).toEqual(rowFixtures);
    const free = moveWidget(rowFixtures, "first", candidate, 12, "free", probe(10.8));
    expect(free.find(({ id }) => id === "first")?.layout.y).toBe(11);
    expect(free.find(({ id }) => id === "table")?.layout.y).toBe(14);
  });
});

describe("dashboard row insertion", () => {
  test("a vertical drop inserts only the dragged widget after the destination row", () => {
    const result = moveWidget(rowFixtures, "first", { x: 8, y: 10, w: 4, h: 3 }, 12, "free", probe(10.7));
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 11, w: 4, h: 3 });
    for (const id of ["second", "third", "left-chart", "right-chart"]) {
      expect(result.find((widget) => widget.id === id)?.layout).toEqual(
        rowFixtures.find((widget) => widget.id === id)?.layout,
      );
    }
    expect(result.find(({ id }) => id === "table")?.layout.y).toBe(14);
  });

  test("an upward drop inserts one widget before the target row and retains its former row-mates", () => {
    const result = moveWidget(rowFixtures, "right-chart", { x: 6, y: 0, w: 6, h: 8 }, 12, "free", probe(0));
    expect(result.find(({ id }) => id === "right-chart")?.layout).toEqual({ x: 6, y: 0, w: 6, h: 8 });
    expect(result.filter(({ kind }) => kind === "metric").map(({ layout }) => layout.y)).toEqual([8, 8, 8]);
    expect(result.find(({ id }) => id === "left-chart")?.layout).toEqual({ x: 0, y: 11, w: 6, h: 8 });
    expect(result.find(({ id }) => id === "table")?.layout.y).toBe(19);
  });

  test("a nonadjacent downward drop leaves the intervening and source rows together", () => {
    const result = moveWidget(rowFixtures, "first", { x: 0, y: 14, w: 4, h: 3 }, 12, "free", probe(14.8));
    expect(result.map(({ id }) => id)).toEqual(["second", "third", "left-chart", "right-chart", "table", "first"]);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 15, w: 4, h: 3 });
    for (const widget of rowFixtures.filter(({ id }) => id !== "first")) {
      expect(result.find(({ id }) => id === widget.id)?.layout).toEqual(widget.layout);
    }
    expect(rowFixtures[0].layout).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  test("a phone drop across logical rows moves only the dragged widget", () => {
    const result = moveWidget(rowFixtures, "first", { x: 0, y: 23, w: 1, h: 3 }, 1, "free", probe(24.8, 0.5));
    expect(projectWidgets(result, 1).map(({ id }) => id)).toEqual([
      "second",
      "third",
      "left-chart",
      "right-chart",
      "first",
      "table",
    ]);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 11, w: 4, h: 3 });
  });

  test("row insertion preserves deliberate vertical gaps in free and horizontal modes", () => {
    const positions = new Map([
      [0, 2],
      [3, 7],
      [11, 17],
    ]);
    const spaced = rowFixtures.map((widget) => ({
      ...widget,
      layout: { ...widget.layout, y: positions.get(widget.layout.y) ?? 0 },
    }));
    for (const mode of ["free", "horizontal"] as const) {
      const result = moveWidget(spaced, "first", { x: 0, y: 13, w: 4, h: 3 }, 12, mode, probe(16.8));
      expect(result.find(({ id }) => id === "second")?.layout.y).toBe(2);
      expect(result.find(({ id }) => id === "left-chart")?.layout.y).toBe(7);
      expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 17, w: 4, h: 3 });
      expect(result.find(({ id }) => id === "table")?.layout.y).toBe(20);
    }
  });

  test("horizontal swaps keep differently sized widgets and their row at the same vertical positions", () => {
    const uneven = rowFixtures.map((widget) =>
      widget.id === "first" ? { ...widget, layout: { ...widget.layout, h: 2 } } : widget,
    );
    const result = moveWidget(uneven, "first", { x: 8, y: 0, w: 4, h: 2 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 8, y: 0, w: 4, h: 2 });
    for (const widget of uneven) {
      expect(result.find(({ id }) => id === widget.id)?.layout.y).toBe(widget.layout.y);
    }
  });

  test("free placement keeps empty-space positions without moving other widgets", () => {
    const result = moveWidget(fixtures, "first", { x: 8, y: 15, w: 4, h: 3 }, 12, "free");
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 8, y: 15, w: 4, h: 3 });
    expect(result.find(({ id }) => id === "chart")?.layout).toEqual(fixtures[2].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(fixtures[1].layout);
    expect(fixtures[0].layout).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });
});

describe("dashboard sizing and compaction", () => {
  test("resizing spans grid columns and rows without overlapping the neighboring widget", () => {
    const result = resizeWidget(fixtures, "first", { w: 7, h: 5 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 0, w: 7, h: 5 });
    expect(result.find(({ id }) => id === "second")?.layout.y).toBe(5);
    expect(result.find(({ id }) => id === "chart")?.layout.y).toBe(8);
  });

  test("size and movement stay inside the grid and keep usable minimum dimensions", () => {
    const resized = resizeWidget(fixtures, "first", { w: 40, h: -2 }, 12);
    expect(resized.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 0, w: 12, h: 3 });
    const moved = moveWidget(fixtures, "second", { x: 40, y: -2, w: 4, h: 3 }, 12);
    expect(moved.find(({ id }) => id === "second")?.layout).toEqual({ x: 8, y: 0, w: 4, h: 3 });
  });

  test("narrow layouts stack cards without changing their saved desktop placement", () => {
    expect(dashboardColumns(380)).toBe(1);
    expect(dashboardColumns(760)).toBe(6);
    expect(dashboardColumns(1140)).toBe(12);
    const phone = projectWidgets(fixtures, 1);
    expect(phone.map(({ layout }) => layout)).toEqual([
      { x: 0, y: 0, w: 1, h: 3 },
      { x: 0, y: 3, w: 1, h: 3 },
      { x: 0, y: 6, w: 1, h: 8 },
    ]);
    expect(projectWidgets(fixtures, 12)).toEqual(fixtures);
  });

  test("phone resizing preserves desktop width and changes height", () => {
    const resized = resizeWidget(fixtures, "first", { w: 1, h: 6 }, 1);
    expect(resized.find(({ id }) => id === "first")?.layout.w).toBe(4);
    expect(projectWidgets(resized, 1).find(({ id }) => id === "first")?.layout.h).toBe(6);
  });

  test("the left resize handle keeps the opposite edge fixed and only changes width", () => {
    const resized = resizeWidget(fixtures, "second", { w: 6, h: 20 }, 12, "free", "w");
    expect(resized.find(({ id }) => id === "second")?.layout).toEqual({ x: 2, y: 0, w: 6, h: 3 });
    const bounded = resizeWidget(fixtures, "second", { w: 30, h: 3 }, 12, "free", "w");
    expect(bounded.find(({ id }) => id === "second")?.layout).toEqual({ x: 0, y: 0, w: 8, h: 3 });
  });

  test("right resizing stays anchored and inside the grid", () => {
    const resized = resizeWidget(fixtures, "second", { w: 12, h: 20 }, 12, "free", "e");
    expect(resized.find(({ id }) => id === "second")?.layout).toEqual({ x: 4, y: 0, w: 8, h: 3 });
  });

  test("bottom resizing preserves width while the bottom-left corner changes both dimensions", () => {
    const bottom = resizeWidget(fixtures, "second", { w: 12, h: 5 }, 12, "free", "s");
    expect(bottom.find(({ id }) => id === "second")?.layout).toEqual({ x: 4, y: 0, w: 4, h: 5 });
    const corner = resizeWidget(fixtures, "second", { w: 3, h: 5 }, 12, "free", "sw");
    expect(corner.find(({ id }) => id === "second")?.layout).toEqual({ x: 5, y: 0, w: 3, h: 5 });
  });

  test("picking up a widget on a phone keeps its position until it moves", () => {
    const origin = projectWidgets(fixtures, 1)[0].layout;
    expect(moveWidget(fixtures, "first", origin, 1)).toEqual(fixtures);
  });

  test("vertical movement away from a row gap leaves the layout unchanged", () => {
    expect(moveWidget(rowFixtures, "first", { x: 0, y: 4, w: 4, h: 3 }, 12, "vertical", probe(5))).toEqual(rowFixtures);
    expect(moveWidget(rowFixtures, "first", { x: 0, y: 20, w: 4, h: 3 }, 12, "vertical", probe(21))).toEqual(
      rowFixtures,
    );
  });

  test("a row target activates close to a gap before the pointer reaches it", () => {
    const far = moveWidget(rowFixtures, "first", { x: 0, y: 2, w: 4, h: 3 }, 12, "free", probe(2.4));
    const near = moveWidget(rowFixtures, "first", { x: 0, y: 2, w: 4, h: 3 }, 12, "free", probe(2.6));
    expect(far).toEqual(rowFixtures);
    expect(near.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 3, w: 4, h: 3 });
    expect(near.find(({ id }) => id === "second")?.layout.y).toBe(0);
    expect(near.find(({ id }) => id === "left-chart")?.layout.y).toBe(6);
  });

  test("staggered widgets do not create a row target through occupied content", () => {
    const staggered = rowFixtures.map((widget) => {
      if (widget.id === "first") return { ...widget, layout: { ...widget.layout, h: 5 } };
      if (widget.id === "left-chart") return { ...widget, layout: { ...widget.layout, y: 5 } };
      if (widget.id === "table") return { ...widget, layout: { ...widget.layout, y: 13 } };
      return widget;
    });
    expect(moveWidget(staggered, "second", { x: 4, y: 3, w: 4, h: 3 }, 12, "vertical", probe(2.8))).toEqual(staggered);
  });

  test("the gap above its own row can separate the first widget from its row-mates", () => {
    const result = moveWidget(rowFixtures, "left-chart", { x: 0, y: 2, w: 6, h: 8 }, 12, "free", probe(2.8));
    expect(result.find(({ id }) => id === "left-chart")?.layout).toEqual({ x: 0, y: 3, w: 6, h: 8 });
    expect(result.find(({ id }) => id === "right-chart")?.layout).toEqual({ x: 6, y: 11, w: 6, h: 8 });
    expect(result.filter(({ kind }) => kind === "metric").map(({ layout }) => layout.y)).toEqual([0, 0, 0]);
  });

  test("vertical compaction closes holes left by removing a card", () => {
    const lower = { ...fixtures[0], id: "lower", layout: { x: 0, y: 12, w: 4, h: 3 } };
    expect(compactWidgets([lower])[0].layout.y).toBe(0);
    expect(compactWidgets([fixtures[0], lower])[1].layout.y).toBe(3);
  });

  test("horizontal mode closes gaps to the left while free mode preserves placement", () => {
    const spaced = [
      { ...fixtures[0], layout: { x: 4, y: 6, w: 3, h: 3 } },
      { ...fixtures[1], layout: { x: 8, y: 6, w: 3, h: 3 } },
    ];
    expect(compactWidgets(spaced, "horizontal").map(({ layout }) => [layout.x, layout.y])).toEqual([
      [0, 6],
      [3, 6],
    ]);
    expect(compactWidgets(spaced, "free")).toEqual(spaced);
    expect(spaced[0].layout).toEqual({ x: 4, y: 6, w: 3, h: 3 });
  });
});
