import { expect, test } from "bun:test";
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

test("new related tabs keep the selected shell tab and global focus", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
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

test("leaving the source page retains a related preview when another tab shares its panel", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
  await s.controller.open(s.source);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["related", "kept"]);
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

test("leaving the source page does not close a manually opened related preview", async () => {
  const s = setup([opening("related")]);
  registerTray(s);
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("document", "related"),
    open: "preview",
  });
  await s.controller.open(s.source);
  leavePage(s);
  expect(s.workbench.layout.listPanelInstances("side")[0]?.resource?.id).toBe("related");
  s.controller.dispose();
});

test("a manually reopened tab no longer belongs to the automatic page lifetime", async () => {
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
  expect(s.workbench.layout.listPanelInstances("side")[0]?.resource?.id).toBe("related");
  s.controller.dispose();
});

test("leaving a persisted resource page removes its sole automatic preview from that page's cache", async () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const s = setup([opening("related")], {
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => {
        layouts.set(scope, layout);
      },
    },
    resolvePagePersistenceScope: ({ resource }) => ({ scope: resource?.id ?? "home" }),
  });
  await s.controller.open(s.source);
  leavePage(s);
  expect(s.workbench.pages.store.getState().activePageId).toBe("home");
  await s.workbench.preferences.setValue("workbench.openRelatedResources", false, { scope: "user" });
  s.workbench.pageLocations.navigate(s.target(s.source));
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
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
