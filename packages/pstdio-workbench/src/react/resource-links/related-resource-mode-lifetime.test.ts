import { expect, test } from "bun:test";
import { opening, ref, setup } from "./related-resource-openings.fixture";

const create = (otherHasPanels = false, scoped = true) => {
  const s = setup([opening("default")], {
    initialSidePanelMode: "closed",
    resolvePagePersistenceScope: scoped
      ? ({ currentScope, projectId, modeId, pageId, resource }) => ({
          scope: `${projectId}/${modeId}/${pageId}/${resource?.id ?? ""}`,
          carryRegions: currentScope?.startsWith(`${projectId}/${modeId}/`) ? ["side", "secondary"] : [],
        })
      : undefined,
  });
  s.workbench.modes.registerMode({
    id: "other",
    panels: otherHasPanels ? ["main", "side", "secondary"] : [],
    activate() {},
  });
  s.workbench.pages.registerPage({
    id: "other",
    ref: { kind: "page", extensionId: "example", id: "other" },
    modeId: "other",
    path: "other",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  const switchMode = () =>
    s.workbench.pageLocations.navigate({
      kind: "page",
      page: { kind: "page", extensionId: "example", id: "other" },
    });
  const leavePage = () =>
    s.workbench.pageLocations.navigate({
      kind: "page",
      page: { kind: "page", extensionId: "example", id: "home" },
    });
  return { ...s, switchMode, leavePage };
};

test("automatic previews and their revealed panels restore after a mode switch", async () => {
  const s = create();
  await s.controller.open(s.source);
  const before = structuredClone(s.workbench.layout.getLayout().regions.side);
  s.switchMode();
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.layout.getLayout().regions.side).toEqual(before);
  s.leavePage();
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});

test("restoring a mode keeps the user's unpinned choice instead of replaying automatic defaults", async () => {
  const s = create();
  await s.controller.open(s.source);
  const panel = s.workbench.layout.getActivePanel("side")!;
  s.workbench.shellPlacements.updatePlacement(panel.placementIdentity!, { resource: ref("document", "chosen") });
  s.switchMode();
  const consulted = Promise.withResolvers<void>();
  s.setResolver(async () => {
    consulted.resolve();
    return [opening("new-default")];
  });
  s.workbench.pageLocations.navigate(s.target(s.source));
  await consulted.promise;
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("chosen");
  s.leavePage();
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test.each([
  true,
  false,
])("returning to a mode preserves its preview when defaults change, scoped=%s", async (scoped) => {
  const s = create(false, scoped);
  await s.controller.open(s.source);
  s.switchMode();
  const consulted = Promise.withResolvers<void>();
  s.setResolver(async () => {
    consulted.resolve();
    return [opening("new-default")];
  });
  s.workbench.pageLocations.navigate(s.target(s.source));
  await consulted.promise;
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("default");
  s.controller.dispose();
});

test("entering an unvisited resource in a saved mode keeps its current preview", async () => {
  const s = create();
  await s.controller.open(s.source);
  s.switchMode();
  s.setResolver(async () => [opening("new-default")]);
  s.workbench.pageLocations.navigate(s.target(ref("document", "unvisited")));
  await Bun.sleep(0);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("default");
  s.controller.dispose();
});

test("one mode's automatic panel reveal cannot close another mode's restored panel", async () => {
  const s = create(true);
  s.switchMode();
  s.workbench.shellPlacements.registerPlacement({
    id: "manual",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
  s.workbench.shell.setRegionOpen("side", true);
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  s.switchMode();
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("kept");
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.controller.dispose();
});

test("a panel's temporary reveal survives a mode switch and ends on page leave", async () => {
  const s = create();
  await s.controller.open(s.source);
  const original = s.workbench.layout.getActivePanel("side")!;
  s.workbench.pinPlacement(original.placementIdentity!);
  s.leavePage();
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.switchMode();
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  s.leavePage();
  expect(s.workbench.layout.listPanelInstances("side")).toHaveLength(1);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});
