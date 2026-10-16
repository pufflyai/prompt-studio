import { expect, test } from "bun:test";
import type { RelatedResourceOpenings } from "@pstdio/sdk/extensions";
import { opening, ref, setup } from "./related-resource-openings.fixture";

test("opens only explicitly opted-in resources in their requested trays without changing route or focus", async () => {
  const s = setup([
    opening("side"),
    opening("bottom", "secondary"),
    { ...opening("manual"), autoOpen: false },
    { resource: ref("document", "omitted"), region: "main" },
  ]);
  const location = s.workbench.pages.store.getState().location;
  const active = s.workbench.layout.getLayout().activeWidgetId;
  await s.controller.open(s.source);
  expect(s.resolved).toEqual(["side", "bottom"]);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["side"]);
  expect(s.workbench.layout.listPanelInstances("secondary").map((p) => p.resource?.id)).toEqual(["bottom"]);
  expect(s.workbench.pages.store.getState().location).toEqual(location);
  expect(s.workbench.layout.getLayout().activeWidgetId).toBe(active);
  expect(s.reads()).toBe(1);
  s.controller.dispose();
});

test("kinds without an owner command do not infer automatic openings from links or other providers", async () => {
  const s = setup();
  s.owner.dispose();
  s.workbench.resources.registerProvider({
    id: "foreign",
    kind: "document",
    list: () => [],
    related: () => [{ resource: ref("document", "implicit"), target: s.target(ref("document", "implicit")) }],
  });
  await s.controller.open(s.source);
  expect(s.resolved).toEqual([]);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("an owner cannot provide automatic-opening policy for another owner's kind", async () => {
  const s = setup([opening("related")]);
  await s.controller.open({ ...s.source, extensionId: "other" });
  expect(s.reads()).toBe(0);
  expect(s.resolved).toEqual([]);
  s.controller.dispose();
});

test("requested pin intent works and existing pinned or moved targets keep their state", async () => {
  const s = setup([{ ...opening("kept", "secondary"), open: "pin" }]);
  await s.controller.open(s.source);
  const panel = s.workbench.layout.listPanelInstances("secondary")[0]!;
  expect(panel.tabRetention).toBe("persistent");
  s.workbench.movePanel(panel.instanceId, "side");
  s.setResolver(async () => [opening("kept", "secondary")]);
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("secondary")).toEqual([]);
  expect(s.workbench.layout.listPanelInstances("side")[0]?.tabRetention).toBe("persistent");
  s.controller.dispose();
});

test("multiple previews replace in result order and leave one leftmost preview per tray", async () => {
  const s = setup([{ ...opening("pinned"), open: "pin" }, opening("first"), opening("last")]);
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["last", "pinned"]);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.tabRetention)).toEqual(["preview", "persistent"]);
  s.controller.dispose();
});

test("an owner can request Main without navigating away from the source", async () => {
  const s = setup([opening("main", "main")]);
  const location = s.workbench.pages.store.getState().location;
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("main").some((p) => p.resource?.id === "main")).toBe(true);
  expect(s.workbench.pages.store.getState().location).toEqual(location);
  s.controller.dispose();
});

test("a later source discards stale owner results", async () => {
  const s = setup();
  let finish!: (value: RelatedResourceOpenings) => void;
  s.setResolver(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = s.controller.open(s.source);
  const finishOld = finish;
  await s.workbench.navigation.openTarget(s.target(ref("document", "next")));
  finishOld([opening("late")]);
  await pending;
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("project changes and owner removal discard pending results", async () => {
  for (const invalidate of ["project", "owner"] as const) {
    const s = setup();
    let finish!: (value: RelatedResourceOpenings) => void;
    s.setResolver(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = s.controller.open(s.source);
    if (invalidate === "project") s.workbench.pageLocations.setProject("next");
    else s.owner.dispose();
    finish([opening("late")]);
    await pending;
    expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
    s.controller.dispose();
  }
});

test("global disablement cancels pending results even across re-enablement", async () => {
  const s = setup();
  expect(s.workbench.preferences.getValue("workbench.openRelatedResources")).toBe(true);
  let finish!: (value: RelatedResourceOpenings) => void;
  s.setResolver(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = s.controller.open(s.source);
  await s.workbench.preferences.setValue("workbench.openRelatedResources", false, { scope: "user" });
  await s.controller.open(s.source);
  await s.workbench.preferences.setValue("workbench.openRelatedResources", true, { scope: "user" });
  finish([opening("late")]);
  await pending;
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  expect(s.reads()).toBe(1);
  s.controller.dispose();
});

test("automatic targets do not recurse and metadata refresh does not reopen closed targets", async () => {
  const s = setup([opening("related")]);
  await s.controller.open(s.source);
  expect(s.reads()).toBe(1);
  const panel = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.closePlacement(panel.placementIdentity!);
  s.workbench.pageLocations.replay({
    ...s.workbench.pages.store.getState().location!,
    resource: { ...s.source, label: "Hydrated" },
  });
  await Promise.resolve();
  expect(s.reads()).toBe(1);
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("related openings never evict their initiating preview", async () => {
  const s = setup([opening("related")]);
  s.workbench.shellPlacements.registerPlacement({
    id: "source",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  s.workbench.shellPlacements.openPlacement({ placementId: "source", resource: s.source, open: "preview" });
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["source"]);
  s.controller.dispose();
});

test("opens a related resource behind the selected mode tab while retaining source focus", async () => {
  const s = setup([opening("new")]);
  const panel = { kind: "placement", extensionId: "example", id: "documents" } as const;
  s.workbench.modePlacements.registerPlacement({
    id: "documents",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  s.workbench.modePlacements.openPlacement({ panel, resource: ref("document", "old"), open: "pin" });
  const active = s.workbench.layout.getLayout().activeWidgetId;
  s.service.resolve = async (resources) =>
    resources.map((resource) => ({
      resource,
      target: { kind: "panel", panel, resource },
    }));
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("old");
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["new", "old"]);
  expect(s.workbench.layout.getLayout().activeWidgetId).toBe(active);
  s.controller.dispose();
});

test("closing a related tab does not reopen it when focus falls back to its source", async () => {
  const s = setup([opening("related")]);
  s.workbench.shellPlacements.registerPlacement({
    id: "source",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  s.workbench.shellPlacements.openPlacement({ placementId: "source", resource: s.source, open: "pin" });
  await s.controller.open(s.source);
  const related = s.workbench.layout.listPanelInstances("side").find((p) => p.resource?.id === "related")!;
  s.workbench.layout.activatePanel(related.instanceId);
  await s.controller.open(related.resource!);
  const reads = s.reads();
  s.workbench.closePlacement(related.placementIdentity!);
  await Promise.resolve();
  await Promise.resolve();
  expect(s.reads()).toBe(reads);
  expect(s.workbench.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["source"]);
  s.controller.dispose();
});

test("restoring a snapshot keeps its closed related tabs closed", async () => {
  const s = setup([opening("related")]);
  s.workbench.shellPlacements.registerPlacement({
    id: "source",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  s.workbench.shellPlacements.openPlacement({ placementId: "source", resource: s.source, open: "pin" });
  await s.controller.open(s.source);
  const related = s.workbench.layout.listPanelInstances("side").find((p) => p.resource?.id === "related")!;
  s.workbench.closePlacement(related.placementIdentity!);
  const snapshot = s.workbench.host.getSnapshot();
  const other = ref("document", "other");
  s.workbench.shellPlacements.openPlacement({ placementId: "source", resource: other, open: "pin" });
  await s.controller.open(other);
  const reads = s.reads();
  s.workbench.host.restoreSnapshot(snapshot);
  await Promise.resolve();
  await Promise.resolve();
  expect(s.reads()).toBe(reads);
  expect(s.workbench.layout.listPanelInstances("side").some((p) => p.resource?.id === "related")).toBe(false);
  s.controller.dispose();
});

test("direct page navigation opens related resources but restoring cancels pending results", async () => {
  const s = setup([opening("related")]);
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.reads()).toBe(1);
  let finish!: (value: RelatedResourceOpenings) => void;
  s.setResolver(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const snapshot = s.workbench.host.getSnapshot();
  const pending = s.controller.open(s.source);
  s.workbench.host.restoreSnapshot(snapshot);
  finish([opening("late")]);
  await pending;
  expect(s.workbench.layout.listPanelInstances("side").some((p) => p.resource?.id === "late")).toBe(false);
  s.controller.dispose();
});

test("navigation dispatch evaluates the source owner once per explicit opening", async () => {
  const s = setup([opening("related")]);
  await s.workbench.navigation.openTarget(s.target(s.source));
  await Promise.resolve();
  await Promise.resolve();
  expect(s.reads()).toBe(1);
  s.controller.dispose();
});

test("a new URL opens related resources but reloading its saved location keeps closed tabs closed", async () => {
  const s = setup([opening("related")]);
  s.forgetSavedLocation();
  s.workbench.pageLocations.clearProject();
  s.workbench.pageLocations.boot("project");
  await Promise.resolve();
  await Promise.resolve();
  expect(s.reads()).toBe(1);
  const preview = s.workbench.layout.listPanelInstances("side")[0]!;
  s.workbench.closePlacement(preview.placementIdentity!);
  s.workbench.pageLocations.boot("project");
  await Promise.resolve();
  expect(s.reads()).toBe(1);
  s.controller.dispose();
});

test("automatic openings reveal their trays while retaining source focus", async () => {
  const s = setup([opening("side"), opening("bottom", "secondary")]);
  s.workbench.layout.setRegionVisible("side", false);
  s.workbench.layout.setRegionVisible("secondary", false);
  const active = s.workbench.layout.getLayout().activeWidgetId;
  await s.controller.open(s.source);
  expect(s.workbench.layout.getLayout().regions.side.visible).toBe(true);
  expect(s.workbench.sidePanel.getMode()).toBe("attached");
  expect(s.workbench.layout.getLayout().regions.secondary.visible).toBe(true);
  expect(s.workbench.layout.getLayout().activeWidgetId).toBe(active);
  s.controller.dispose();
});
