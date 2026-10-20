import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { pageResourceInstanceKey } from "../../registries/pages/page-resource-context";
import { createWorkbench } from "../../workbench-core";
import type { PersistedWorkbenchPageLocation } from "../page-location/page-location-types";

const restoreAuxiliaryIdentity = (snapshot: WorkbenchLayout, savedKey: string) => {
  let rewritten = 0;
  const saved = structuredClone(snapshot);
  const replacementIds = new Map<string, string>();
  for (const region of Object.values(saved.regions)) {
    for (const entry of region.widgets) {
      const identity = entry.placementIdentity;
      if (identity?.kind !== "page" || identity.pageId !== "note" || identity.slotId !== "editor") continue;
      const oldWidgetId = entry.widgetId;
      entry.widgetId = `workbench.page.${encodeURIComponent(JSON.stringify(["page", identity.pageId, identity.slotId, savedKey]))}`;
      replacementIds.set(oldWidgetId, entry.widgetId);
      entry.placementIdentity = { ...identity, instanceKey: savedKey };
      rewritten++;
    }
    if (region.activeWidgetId)
      region.activeWidgetId = replacementIds.get(region.activeWidgetId) ?? region.activeWidgetId;
    if (region.savedWidgetOrder)
      region.savedWidgetOrder = region.savedWidgetOrder.map((id) => replacementIds.get(id) ?? id);
  }
  if (saved.activeWidgetId) saved.activeWidgetId = replacementIds.get(saved.activeWidgetId) ?? saved.activeWidgetId;
  if (saved.activeLocationWidgetId)
    saved.activeLocationWidgetId = replacementIds.get(saved.activeLocationWidgetId) ?? saved.activeLocationWidgetId;
  return { layout: saved, rewritten };
};

for (const pinned of [true, false])
  test(`restored auxiliary editors keep their instance when reopened: ${pinned ? "pinned" : "preview"}`, async () => {
    const layouts = new Map<string | undefined, WorkbenchLayout>();
    const locations = new Map<string, PersistedWorkbenchPageLocation>();
    const page = (id: string) => ({ kind: "page" as const, extensionId: "review", id });
    const resource = { type: "note", id: "one", metadata: { document: "source.ts" } };
    const target = { kind: "page" as const, page: page("note"), resource, open: "pin" as const };
    const setup = () => {
      const w = createWorkbench({
        startPage: page("home"),
        layoutPersistence: {
          getLayout: (scope) => layouts.get(scope),
          setLayout: (value, scope) => {
            layouts.set(scope, value);
          },
        },
        pageLocationPersistence: {
          load: (id) => locations.get(id),
          save: (id, value) => {
            locations.set(id, value);
          },
        },
        resolvePagePersistenceScope: ({ projectId, resource }) => ({ scope: `${projectId}/${resource?.id ?? "home"}` }),
      });
      w.modes.registerMode({ id: "project", activate() {} });
      for (const id of ["home", "content", "editor"])
        w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
      w.pages.registerPage({
        id: "home",
        ref: page("home"),
        path: "home",
        modeId: "project",
        main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one" },
        slots: [],
      });
      w.pages.registerPage({
        id: "note",
        ref: page("note"),
        path: "note",
        modeId: "project",
        parentId: "home",
        resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
        document: { metadataKey: "document" },
        main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "many" },
        slots: [
          {
            id: "editor",
            region: "side",
            openOn: "page-resource",
            item: {
              kind: "binding",
              binding: {
                kinds: [{ kind: "resource-kind", id: "note" }],
                view: { kind: "view", id: "editor" },
                cardinality: "many",
              },
            },
          },
        ],
      });
      return w;
    };

    const original = setup();
    original.pageLocations.setProject("review");
    await original.navigation.openTarget(target);
    original.pinPlacement(original.layout.listPanelInstances("side")[0]!.placementIdentity!, pinned);
    const savedKey = pageResourceInstanceKey(
      original.pages.getPage("note")!,
      resource,
      getWorkbenchPageRegistryInternals(original.pages).resources,
    );

    // A restored placement keeps the identity assigned when it was created.
    // Resource, presentation, location and all scope records come from live persistence above.
    let rewritten = 0;
    for (const [scope, snapshot] of layouts) {
      const result = restoreAuxiliaryIdentity(snapshot, savedKey);
      layouts.set(scope, result.layout);
      rewritten += result.rewritten;
    }
    expect(rewritten).toBeGreaterThan(0);

    const restored = setup();
    expect(restored.pageLocations.boot("review").ok).toBe(true);
    const editors = () =>
      Object.values(restored.layout.getLayout().regions)
        .flatMap((r) => r.widgets)
        .filter((p) => p.viewId === "editor");
    expect(editors()).toHaveLength(1);
    expect(editors()[0]!.placementIdentity!.instanceKey).toBe(savedKey);
    const widgetId = editors()[0]!.widgetId;
    await restored.navigation.openTarget(target);
    expect(editors()).toHaveLength(1);
    expect(editors()[0]!.widgetId).toBe(widgetId);
  });
