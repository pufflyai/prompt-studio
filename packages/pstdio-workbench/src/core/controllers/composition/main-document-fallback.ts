import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { pageStateKey } from "../../registries/pages/page-state-key";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { pageStateFromLayout } from "../page-runtime/page-state-restoration";

/** Rebuild the source from its remaining tabs; a moved editor is not Main's location. */
export const reconcileMainAfterMove = (core: WorkbenchCore) => {
  const current = core.pages.store.getState();
  const page = current.activePageId ? current.pages[current.activePageId] : undefined;
  if (!page || !current.location) return;
  const layout = core.layout.getLayout();
  const main = layout.regions.main;
  const internals = getWorkbenchPageRegistryInternals(core.pages);
  const pageStates = {
    ...current.pageStates,
    [pageStateKey(page, current.location, internals.resources)]: pageStateFromLayout(page, layout),
  };
  const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
  const replace = (target: Parameters<typeof locations.resolve>[0]) => {
    const resolved = locations.resolve(target);
    return locations.commit(
      internals.prepare.location(
        {
          ...resolved,
          projectId: current.projectId!,
          resource: resolved.location.resource,
          pageStates,
          action: "moveMainDocument",
        },
        current,
      ),
      undefined,
      "replace",
    );
  };
  if (page.main.kind === "view" && page.resource) {
    const remaining = main.widgets.find((tab) => tab.widgetId === main.activeWidgetId && tab.role === "location");
    if (remaining?.resource) {
      const result = replace({ kind: "page", page: page.ref, resource: remaining.resource });
      if (!result.ok) throw new Error(result.diagnostic.message);
      return;
    }
    if (!main.widgets.some((tab) => tab.role === "location") && current.location.parent) {
      const result = replace({
        kind: "page",
        page: current.location.parent.page,
        resource: current.location.parent.resource,
      });
      if (!result.ok) throw new Error(result.diagnostic.message);
      return;
    }
  }
  internals.publish(
    internals.prepare.compose(current, { ...current, pageStates, action: "moveMainDocument" }),
    "moveMainDocument",
  );
};
