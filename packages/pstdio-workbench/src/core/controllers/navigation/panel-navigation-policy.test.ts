import { expect, test } from "bun:test";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingPages } from "../../../examples/windowing/resources";
import { createWorkbench } from "../../workbench-core";

const setup = (fixedHidden: boolean, movedPreset = false) => {
  const core = createWorkbench({ initialSidePanelMode: fixedHidden ? "closed" : "attached" });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  for (const id of ["source", "destination"]) {
    core.modes.registerMode({
      id,
      panels: ["main", "side", "secondary"],
      regionSettings:
        id === "destination"
          ? { side: movedPreset ? { acceptsTabs: false } : { canOpen: false, canClose: false } }
          : {},
      activate() {},
    });
    core.pages.registerPage({
      id,
      ref: { kind: "page", extensionId: "test", id },
      path: id,
      modeId: id,
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      slots: [],
    });
  }
  const panel = { kind: "placement", extensionId: "test", id: "destination" } as const;
  core.modePlacements.registerPlacement({
    id: "destination",
    ref: panel,
    modeId: "destination",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: movedPreset ? "open" : "closed" },
  });
  core.pageLocations.setProject("project");
  core.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "test", id: "source" } });
  const target = {
    kind: "compound",
    targets: [
      { kind: "page", page: { kind: "page", extensionId: "test", id: "destination" } },
      { kind: "panel", panel },
    ],
  } as const;
  return { core, target };
};

test("compound navigation validates a fixed-visible destination instead of the source panel", async () => {
  const { core, target } = setup(false);
  expect(core.shell.getRegionState("side").open).toBe(false);
  await core.navigation.openTarget(target);
  expect(core.modes.getActiveModeId()).toBe("destination");
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  await core.dispose();
});

test("compound navigation rejects a fixed-hidden destination before leaving an open source panel", async () => {
  const { core, target } = setup(true);
  await core.shell.setRegionOpen("side", true);
  const before = core.layout.getLayout();
  await expect(core.navigation.openTarget(target)).rejects.toThrow("cannot open: side");
  expect(core.modes.getActiveModeId()).toBe("source");
  expect(core.layout.getLayout()).toBe(before);
  await core.dispose();
});

test("a compound target resolves the destination page instance rather than another resource's moved tab", async () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    regionSettings: { secondary: { canOpen: false, canClose: true } },
  });
  const core = fixture.workbench;
  const tab = core.layout.listPanelInstances("bottom")[0]!;
  core.movePanel(tab.instanceId, "secondary");
  core.shell.setRegionOpen("secondary", false);
  await core.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: windowingPages.workspace, resource: fixture.resources.workspaces[1] },
      { kind: "panel", panel: { kind: "page-slot", page: windowingPages.workspace, id: "terminal" } },
    ],
  });
  expect(core.getPrimaryResource()?.id).toBe(fixture.resources.workspaces[1]!.id);
  expect(core.layout.getLayout().regions.bottom.widgets.some((p) => p.contributionId === tab.panelId)).toBe(true);
  await fixture.dispose();
});

test("mode navigation keeps each mode's open intent and header choice", async () => {
  const { core } = setup(false);
  await core.shell.setRegionOpen("side", true);
  core.shell.setHeaderVisible("side", false);
  await core.navigation.openTarget({ kind: "page", page: { kind: "page", extensionId: "test", id: "destination" } });
  expect(core.layout.getLayout().regions.side.visibility).toBeUndefined();
  expect(core.layout.getLayout().regions.side.headerVisible).toBeUndefined();
  await core.navigation.openTarget({ kind: "page", page: { kind: "page", extensionId: "test", id: "source" } });
  expect(core.layout.getLayout().regions.side.visibility).toBe("open");
  expect(core.shell.getPanelPolicy("side").showHeader).toBe(false);
  await core.dispose();
});

test("compound navigation reuses a saved moved tab in the destination mode", async () => {
  const { core, target } = setup(false, true);
  await core.navigation.openTarget(target.targets[0]);
  const tab = core.layout.listPanelInstances("side")[0]!;
  core.movePanel(tab.instanceId, "secondary");
  await core.navigation.openTarget({ kind: "page", page: { kind: "page", extensionId: "test", id: "source" } });
  await core.navigation.openTarget(target);
  expect(core.modes.getActiveModeId()).toBe("destination");
  expect(core.layout.listPanelInstances("side")).toHaveLength(0);
  expect(core.layout.listPanelInstances("secondary")[0]?.instanceId).toBe(tab.instanceId);
  await core.dispose();
});
