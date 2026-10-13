import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate, openFile } from "./placement-lifecycle-test-support";

test("whole-panel commands enforce topology and preserve tabs and sizes", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  const tabs = w.layout.getLayout().regions.main.widgets;
  w.layout.setRegionSize("secondary", 291);
  await w.commands.executeCommand("workbench.repositionPanel", { panel: "side", edge: "left" });
  await w.commands.executeCommand("workbench.repositionPanel", { panel: "sidenav", edge: "right" });
  await w.commands.executeCommand("workbench.repositionPanel", { panel: "secondary", edge: "top" });
  expect(w.getPanelEdge("side")).toBe("left");
  expect(w.getPanelEdge("sidenav")).toBe("right");
  expect(w.getPanelEdge("secondary")).toBe("top");
  expect(w.getPanelEdge("main")).toBe("bottom");
  expect(w.layout.getLayout().regions.main.widgets).toEqual(tabs);
  expect(w.layout.getLayout().regions.secondary.size).toBe(291);
  expect(() => w.repositionPanel("secondary", "left")).toThrow();
  expect(() => w.repositionPanel("aside", "top")).toThrow();
});

test("fixed panels reject whole-panel moves and authored mode defaults are validated", () => {
  const w = createWorkbench({ regionSettings: { side: { movable: false } } });
  expect(() => w.repositionPanel("side", "left")).toThrow();
  expect(() =>
    w.modes.registerMode({
      id: "bad",
      label: "Bad",
      activate: () => undefined,
      layout: { axis: "horizontal", children: ["side", "main"] } as never,
    }),
  ).toThrow();
});

test("mode placement follows the mode and page geometry follows the page type on reload", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  w.repositionPanel("aside", "left");
  w.repositionPanel("bottom", "top");
  w.repositionPanel("side", "left");
  w.setActionBarPosition("bottom");
  await w.navigation.openTarget(navigate("beta"));
  expect(w.getPanelEdge("aside")).toBe("left");
  expect(w.getPanelEdge("side")).toBe("left");
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.getPanelEdge("bottom")).toBe("top");
  expect(restored.getPanelEdge("side")).toBe("left");
  expect(restored.layout.getLayout().actionBarEdge).toBe("bottom");
});

test("authored mode geometry seeds a new owner and fixed panels reject stale saved moves", async () => {
  const w = createWorkbench();
  const layout = {
    axis: "horizontal",
    children: [
      { axis: "horizontal", children: ["side", { axis: "vertical", children: ["secondary", "main"] }] },
      "sidenav",
    ],
  } as const;
  w.modes.registerMode({ id: "custom", layout: layout as never, actionBarEdge: "top", activate() {} });
  w.modes.setActiveMode("custom");
  expect(w.getPanelEdge("side")).toBe("left");
  expect(w.getPanelEdge("secondary")).toBe("top");
  expect(w.layout.getLayout().actionBarEdge).toBe("top");
  const saved = new Map();
  const movable = harness(saved);
  await movable.navigation.openTarget(navigate("alpha"));
  movable.repositionPanel("side", "left");
  movable.repositionPanel("bottom", "top");
  const fixed = harness(saved, { regionSettings: { side: { movable: false } } });
  await fixed.navigation.openTarget(navigate("alpha"));
  expect(fixed.getPanelEdge("side")).toBe("right");
});

test("snapshot restoration rejects invalid topology and cannot bypass fixed geometry", () => {
  const w = createWorkbench({ regionSettings: { side: { movable: false } } });
  const current = w.layout.getLayout();
  w.layout.restoreLayout({ ...current, modeLayout: { axis: "horizontal", children: ["main", "side"] } as never });
  expect(w.getPanelEdge("side")).toBe("right");
  w.layout.restoreLayout({
    ...current,
    modeLayout: {
      axis: "horizontal",
      children: [
        "sidenav",
        { axis: "horizontal", children: ["side", { axis: "vertical", children: ["main", "secondary"] }] },
      ],
    },
  });
  expect(w.getPanelEdge("side")).toBe("right");
});

test("snapshot restoration keeps fixed page panels at authored edges", async () => {
  const w = harness();
  const page = { kind: "page", extensionId: "test", id: "fixed" } as const;
  w.pages.registerPage({
    id: "fixed",
    ref: page,
    modeId: "edit",
    path: "fixed",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
    regionSettings: { aside: { movable: false, edge: "left" }, bottom: { movable: false, edge: "top" } },
  });
  await w.navigation.openTarget({ kind: "page", page });
  w.layout.restoreLayout({
    ...w.layout.getLayout(),
    pageLayout: {
      axis: "horizontal",
      children: [{ axis: "vertical", children: ["main", "bottom"] }, "aside"],
    },
  });
  expect(w.getPanelEdge("aside")).toBe("left");
  expect(w.getPanelEdge("bottom")).toBe("top");
});
