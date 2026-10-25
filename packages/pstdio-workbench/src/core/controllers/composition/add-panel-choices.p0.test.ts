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

test.each(["page", "mode"] as const)("%s Add regions do not restrict where an open tab can move", async (owner) => {
  const { w } = fixture("page", { kind: "view", view: { kind: "view", id: "tool" }, presence: "closed" });
  const placement = {
    id: "library",
    region: "main",
    addableIn: ["main"],
    item: { kind: "view", view: { kind: "view", id: "tool" }, presence: "closed" },
  } as const;
  if (owner === "mode")
    w.modePlacements.registerPlacement({
      ...placement,
      ref: { kind: "placement", extensionId: "test", id: "library" },
      modeId: "project",
    });
  w.pages.registerPage({
    id: "library",
    ref: { ...page, id: "library" },
    path: "library",
    modeId: "project",
    main: { kind: "panels" },
    slots: owner === "page" ? [placement] : [],
  });
  w.pageLocations.navigate({ kind: "page", page: { ...page, id: "library" } });
  const choices = (region: "main" | "side" | "secondary") => w.composition.panelsFor(region).addable;
  expect(choices("main")).toHaveLength(1);
  expect(choices("side")).toEqual([]);
  expect(choices("secondary")).toEqual([]);
  await choices("main")[0]!.open!();
  const tab = w.layout.getActivePanel("main")!;
  expect(w.getPanelDestinations(tab.instanceId)).toHaveLength(3);
  for (const region of ["side", "secondary"] as const) {
    w.movePanel(tab.instanceId, region);
    expect(w.layout.getActivePanel(region)?.instanceId).toBe(tab.instanceId);
    expect(choices("main")).toEqual([]);
  }
  w.closePlacement(tab.placementIdentity!);
  expect(choices("main")).toHaveLength(1);
  expect(choices("side")).toEqual([]);
  expect(choices("secondary")).toEqual([]);
});
