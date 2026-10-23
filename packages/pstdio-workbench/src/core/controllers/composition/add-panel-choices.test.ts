import { expect, test } from "bun:test";
import type { PlacementItem } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { createOwnedAddablePanels } from "./owned-addable-panels";

const page = { kind: "page" as const, extensionId: "test", id: "tools" };
const fixture = (owner: "shell" | "mode" | "page", item: PlacementItem) => {
  const w = createWorkbench();
  w.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
  w.modes.registerMode({ id: "project", activate() {} });
  const placement = { id: "tool", region: "side" as const, item };
  if (owner === "shell") w.shellPlacements.registerPlacement(placement);
  if (owner === "mode")
    w.modePlacements.registerPlacement({
      ...placement,
      ref: { kind: "placement", extensionId: "test", id: "tool" },
      modeId: "project",
    });
  w.pages.registerPage({
    id: page.id,
    ref: page,
    path: "tools",
    modeId: "project",
    main: { kind: "panels" },
    slots: owner === "page" ? [placement] : [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page });
  const choices = () =>
    createOwnedAddablePanels(w, {
      layout: w.layout.getLayout(),
      modeId: "project",
      region: "main",
      resource: { type: "tool", id: "one" },
    });
  return { w, choices };
};

test.each(["shell", "mode", "page"] as const)("%s resource bindings require an explicit add action", (owner) => {
  const { choices } = fixture(owner, {
    kind: "binding",
    binding: {
      kinds: [{ kind: "resource-kind", id: "tool" }],
      view: { kind: "view", id: "tool" },
      cardinality: "many",
    },
  });
  expect(choices()).toEqual([]);
});

test.each([
  "shell",
  "mode",
  "page",
] as const)("an open %s singleton is absent from other panels' choices", async (owner) => {
  const { w, choices } = fixture(owner, { kind: "view", view: { kind: "view", id: "tool" }, presence: "closed" });
  await choices()[0]!.open!();
  const tab = w.layout.getActivePanel("main")!;
  w.movePanel(tab.instanceId, "side");
  expect(choices()).toEqual([]);
  w.closePlacement(tab.placementIdentity!);
  expect(choices()).toHaveLength(1);
});

test("page slots enforce their declared panel destinations", () => {
  const { w } = fixture("page", { kind: "view", view: { kind: "view", id: "tool" }, presence: "closed" });
  w.pages.registerPage({
    id: "library",
    ref: { ...page, id: "library" },
    path: "library",
    modeId: "project",
    main: { kind: "panels", landing: "library" },
    slots: [
      {
        id: "library",
        region: "main",
        movableTo: ["main"],
        item: { kind: "view", view: { kind: "view", id: "tool" }, presence: "open" },
      },
    ],
  });
  w.pageLocations.navigate({ kind: "page", page: { ...page, id: "library" } });
  const tab = w.layout.getActivePanel("main")!;
  expect(w.getPanelDestinations(tab.instanceId)).toEqual(["main"]);
  expect(() => w.movePanel(tab.instanceId, "side")).toThrow("Panel cannot move");
  expect(() => w.pages.openSlot({ pageId: "library", slotId: "library", region: "side" })).toThrow();
  const layout = w.layout.getLayout();
  const savedTab = layout.regions.main.widgets[0]!;
  w.layout.restoreLayout({
    ...layout,
    regions: {
      ...layout.regions,
      main: { ...layout.regions.main, widgets: [], activeWidgetId: undefined },
      side: { ...layout.regions.side, widgets: [savedTab], activeWidgetId: savedTab.widgetId },
    },
  });
  w.pageLocations.navigate({ kind: "page", page });
  w.pageLocations.navigate({ kind: "page", page: { ...page, id: "library" } });
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(tab.instanceId);
});
