import { expect, test } from "bun:test";
import { createLocalStorageLayoutPersistence } from "../../../storage/local-storage-layout-persistence";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import { restoreModePanelLayout } from "./mode-panel-layout";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

// The v5 shape written by 0.48. Keep these IDs independent of today's region registry.
const oldRegions = [
  "nav",
  "activity",
  "sidenav",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "secondary-header",
  "secondary-left-menu",
  "secondary",
  "secondary-right-menu",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
  "overlay",
];

test.each(["page", "mode"] as const)("restores a v5 %s snapshot that predates bottom menus", (owner) => {
  const pageScope = "project/one/mode/project/page/extensions";
  const modeScope = 'workbench-mode:["one","project"]';
  const regions = Object.fromEntries(oldRegions.map((id) => [id, { id, visible: true, widgets: [] }]));
  const widget = { widgetId: "saved-tab", contributionId: "tool" };
  const layout = { regions: { ...regions, side: { ...regions.side, visible: false, widgets: [widget] } } };
  const scope = owner === "page" ? pageScope : modeScope;
  const values = new Map([[`upgrade:layout:${scope}`, JSON.stringify({ version: 5, layout })]]);
  const persistence = createLocalStorageLayoutPersistence({
    namespace: "upgrade",
    storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) },
    debounceMs: 0,
  });
  const cache = createWorkbenchLayoutCache({
    layoutPersistence: persistence,
    resolvePagePersistenceScope: () => ({ scope: pageScope }),
  });
  try {
    const defaults = createDefaultWorkbenchLayout();
    const mode = cache.readMode("one", "project");
    const page = cache.loadPageLayout({ projectId: "one", modeId: "project", pageId: "extensions" }, undefined);
    const restored = restoreModePanelLayout(defaults, mode, defaults, page);
    for (const id of ["main-bottom-menu", "secondary-bottom-menu", "side-bottom-menu"] as const) {
      expect(restored.regions[id].widgets).toEqual([]);
      expect(persistence.getLayout(scope)?.regions[id]).toEqual(defaults.regions[id]);
    }
    expect(persistence.getLayout(scope)?.regions.side).toEqual(layout.regions.side);
    if (owner === "mode") expect(restored.regions.side.widgets).toEqual([widget]);
  } finally {
    persistence.dispose?.();
  }
});
