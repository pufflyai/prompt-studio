import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationPersistence } from "../page-location/page-location-memory";

const page = { kind: "page" as const, extensionId: "test", id: "composer" };
const fixture = (
  saved = new Map<string | undefined, WorkbenchLayout>(),
  locations = createMemoryWorkbenchPageLocationPersistence(),
) => {
  const w = createWorkbench({
    startPage: page,
    pageLocationPersistence: locations,
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
    },
    resolvePagePersistenceScope: ({ projectId, modeId, pageId }) => ({ scope: `${projectId}/${modeId}/${pageId}` }),
  });
  w.modes.registerMode({ id: "alpha", panels: ["main", "side", "secondary"], activate() {} });
  w.views.registerView({ id: "document", title: "Composer", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "composer",
    ref: page,
    path: "composer",
    modeId: "alpha",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one", closable: true },
    slots: [],
  });
  return { w, saved, locations, navigate: () => w.pageLocations.navigate({ kind: "page", page }) };
};

for (const region of ["main", "side", "secondary"] as const) {
  test(`reload retains an open static Main in ${region} and preserves its later closure`, () => {
    const original = fixture();
    original.w.pageLocations.setProject("project");
    original.navigate();
    const composer = original.w.layout.getActivePanel("main")!;
    if (region !== "main") original.w.movePanel(composer.instanceId, region);
    original.w.pageLocations.dispose();
    const restored = fixture(original.saved, original.locations);
    expect(restored.w.pageLocations.boot("project").ok).toBe(true);
    expect(restored.w.layout.getActivePanel(region)?.instanceId).toBe(composer.instanceId);
    restored.w.closePlacement(composer.placementIdentity!);
    restored.w.pageLocations.dispose();
    const closed = fixture(original.saved, original.locations);
    expect(closed.w.pageLocations.boot("project").ok).toBe(true);
    expect(
      Object.values(closed.w.layout.getLayout().regions)
        .flatMap((item) => item.widgets)
        .some((item) => item.widgetId === composer.instanceId),
    ).toBe(false);
    closed.navigate();
    expect(closed.w.layout.getActivePanel("main")?.instanceId).toBe(composer.instanceId);
  });
}
