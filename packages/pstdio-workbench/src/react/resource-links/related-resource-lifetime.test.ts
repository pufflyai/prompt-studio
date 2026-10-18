import { expect, spyOn, test } from "bun:test";
import type { WorkbenchLayout, WorkbenchModuleContext } from "../../core";
import { opening, ref, setup } from "./related-resource-openings.fixture";
import { registerRelatedResourcePreviews } from "./related-resource-previews";

const registerTray = (s: ReturnType<typeof setup>, region: "side" | "secondary" = "side") => {
  s.workbench.shellPlacements.registerPlacement({
    id: "manual",
    region,
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
};
const leavePage = (s: ReturnType<typeof setup>) =>
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });

test.each([
  "side",
  "secondary",
] as const)("dropping an automatic preview into %s pins it past source departure", async (region) => {
  const s = setup([opening("related")]);
  await s.controller.open(s.source);
  const tab = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.movePanel(tab.instanceId, region);
  expect(s.workbench.layout.getActivePanel(region)?.tabRetention).toBe("persistent");
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances(region).map((tab) => tab.resource?.id)).toContain("related");
  s.controller.dispose();
});

test("new related tabs keep the selected shell tab and global focus", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
  s.workbench.shell.setRegionOpen("side", true);
  s.workbench.layout.activateWidget(s.workbench.layout.listPanelInstances("main")[0]!.instanceId);
  const active = s.workbench.layout.getLayout().activeWidgetId;
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("kept");
  expect(s.workbench.layout.getLayout().activeWidgetId).toBe(active);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["related", "kept"]);
  s.controller.dispose();
});

test("an already open related target keeps the selected tab in its actual tray", async () => {
  const s = setup([opening("related")]);
  registerTray(s, "secondary");
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("document", "related"),
    open: "pin",
  });
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
  s.workbench.shell.setRegionOpen("secondary", true);
  s.workbench.layout.activateWidget(s.workbench.layout.listPanelInstances("main")[0]!.instanceId);
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("secondary")?.resource?.id).toBe("kept");
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("leaving the source page closes its sole automatic preview and each empty auxiliary panel", async () => {
  const s = setup([opening("related"), opening("terminal", "secondary")]);
  await s.controller.open(s.source);
  leavePage(s);
  for (const region of ["side", "secondary"] as const) {
    expect(s.workbench.layout.listPanelInstances(region)).toEqual([]);
    expect(s.workbench.layout.getLayout().regions[region].visible).toBe(false);
  }
  expect(s.workbench.sidePanel.getMode()).toBe("closed");
  s.controller.dispose();
});

test("selecting or hydrating a related preview does not leave the source page", async () => {
  const s = setup([opening("related")]);
  await s.controller.open(s.source);
  const panel = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.layout.activatePanel(panel.instanceId);
  s.workbench.pageLocations.replay({
    ...s.workbench.pages.store.getState().location!,
    resource: { ...s.source, label: "Updated" },
  });
  expect(s.workbench.layout.listPanelInstances("side")[0]?.instanceId).toBe(panel.instanceId);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("leaving the source page keeps an already open panel and its manual tabs", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
  s.workbench.shell.setRegionOpen("side", true);
  await s.controller.open(s.source);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["kept"]);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("kept");
  expect(s.workbench.layout.getLayout().regions.side.visible).toBe(true);
  s.controller.dispose();
});

test("leaving the source page retains a related preview the user pinned", async () => {
  const s = setup([opening("related")]);
  await s.controller.open(s.source);
  const panel = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.pinPlacement(panel.placementIdentity!, true);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")[0]?.tabRetention).toBe("persistent");
  s.controller.dispose();
});

test("leaving the source page closes a manually opened related preview", async () => {
  const s = setup([opening("related")]);
  leavePage(s);
  registerTray(s);
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("document", "related"),
    open: "preview",
  });
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test.each([
  "shell",
  "mode",
] as const)("replacing an automatic %s preview still closes it on page leave", async (kind) => {
  const s = setup([opening("related")]);
  const binding = {
    view: { kind: "view", id: "document" },
    kinds: [{ kind: "resource-kind", id: "document" }],
    cardinality: "many",
  } as const;
  const panel = { kind: "placement", extensionId: "example", id: "native" } as const;
  if (kind === "shell") registerTray(s);
  else
    s.workbench.modePlacements.registerPlacement({
      id: "native",
      ref: panel,
      modeId: "project",
      region: "side",
      item: { kind: "binding", binding },
    });
  s.service.resolve = async (resources) =>
    resources.map((resource) => ({
      resource,
      target:
        kind === "shell"
          ? { kind: "panel", panel: { kind: "shell-placement", id: "manual" }, resource }
          : { kind: "panel", panel, resource },
    }));
  await s.controller.open(s.source);
  const before = s.workbench.layout.listPanelInstances("side")[0]!;
  const identity = before.placementIdentity!;
  const update = { resource: ref("document", "manual-replacement"), title: "Manual replacement" };
  if (identity.kind === "shell") s.workbench.shellPlacements.updatePlacement(identity, update);
  else s.workbench.modePlacements.updatePlacement(identity, update);
  expect(s.workbench.layout.listPanelInstances("side")[0]?.instanceId).toBe(before.instanceId);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("refreshing an automatic target's metadata keeps its page lifetime", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.service.resolve = async (resources) =>
    resources.map((resource) => ({
      resource,
      target: { kind: "panel", panel: { kind: "shell-placement", id: "manual" }, resource },
    }));
  await s.controller.open(s.source);
  const before = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.shellPlacements.updatePlacement(before.placementIdentity!, {
    resource: { ...before.resource!, label: "Refreshed label" },
    title: "Refreshed title",
  });
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("a manually reopened preview closes on page leave", async () => {
  const s = setup([opening("related")]);
  await s.controller.open(s.source);
  const panel = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.closePlacement(panel.placementIdentity!);
  const identity = panel.placementIdentity;
  if (identity?.kind !== "shell") throw new Error("Expected a shell placement");
  s.workbench.shellPlacements.openPlacement({
    placementId: identity.placementId,
    resource: panel.resource,
    open: "preview",
  });
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("leaving a persisted resource page removes every automatic preview from that page's cache", async () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const s = setup([opening("related"), opening("bottom", "secondary")], {
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => {
        layouts.set(scope, layout);
      },
    },
    resolvePagePersistenceScope: ({ resource }) => ({ scope: resource?.id ?? "home" }),
  });
  await s.controller.open(s.source);
  const errors = spyOn(console, "error");
  try {
    leavePage(s);
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
  expect(s.workbench.pages.store.getState().activePageId).toBe("home");
  await s.workbench.preferences.setValue("workbench.openRelatedResources", false, { scope: "user" });
  s.workbench.pageLocations.navigate(s.target(s.source));
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  expect(s.workbench.layout.listPanelInstances("secondary")).toEqual([]);
  s.controller.dispose();
});

test.each([
  "side",
  "secondary",
] as const)("page cleanup keeps manual %s tabs carried to the next page", async (region) => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const s = setup([opening("automatic", region)], {
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
    },
    resolvePagePersistenceScope: ({ resource, pageId }) => ({
      scope: resource?.id ?? pageId,
      carryRegions: ["side", "secondary"],
    }),
  });
  registerTray(s, region);
  await s.controller.open(s.source);
  const manual = s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("document", "manual"),
    open: "pin",
  });
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances(region).map((panel) => panel.resource?.id)).toEqual(["manual"]);
  expect(s.workbench.shell.getRegionState(region).open).toBe(true);
  s.workbench.closePlacement(manual);
  expect(s.workbench.shell.getRegionState(region).open).toBe(false);
  s.controller.dispose();
});

test("restored native tabs keep their automatic source after the opening controller restarts", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.service.resolve = async (resources) =>
    resources.map((resource) => ({
      resource,
      target: { kind: "panel", panel: { kind: "shell-placement", id: "manual" }, resource },
    }));
  await s.controller.open(s.source);
  const snapshot = s.workbench.host.getSnapshot();
  s.controller.dispose();
  s.workbench.host.restoreSnapshot(snapshot);
  const controller = registerRelatedResourcePreviews(s.workbench as WorkbenchModuleContext, {
    canonicalize: (resource) => resource,
    createService: () => s.service,
  });
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  expect(s.workbench.sidePanel.getMode()).toBe("closed");
  controller.dispose();
});
