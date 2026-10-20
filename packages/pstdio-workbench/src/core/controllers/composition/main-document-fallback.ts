import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { pinPagePlacement } from "../../registries/pages/page-placement-pin";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { normalizeWorkbenchPageLocation } from "../page-location/page-location-normalization";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";

export const prepareMainDocumentFallback = (
  core: WorkbenchCore,
  moved: WorkbenchWidgetPlacement,
  destination: string,
) => {
  const state = core.pages.store.getState();
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const identity = moved.placementIdentity;
  if (
    destination === "main" ||
    !state.location?.parent ||
    !page?.resource ||
    page.main.kind !== "view" ||
    identity?.kind !== "page" ||
    identity.pageId !== page.id ||
    identity.slotId !== "$main"
  )
    return undefined;
  const main = core.layout.getLayout().regions.main.widgets;
  if (
    !main.includes(moved) ||
    main.some(
      (tab) =>
        tab.widgetId !== moved.widgetId &&
        tab.placementIdentity?.kind === "page" &&
        tab.placementIdentity.pageId === page.id &&
        tab.placementIdentity.slotId === "$main",
    )
  )
    return undefined;
  const internals = getWorkbenchPageRegistryInternals(core.pages);
  const parent = normalizeWorkbenchPageLocation({
    location: state.location.parent,
    pages: core.pages.listPages(),
    resources: internals.resources,
  });
  const retained = moved.tabRetention === "preview" ? pinPagePlacement(state, identity, internals.resources) : state;
  const next = internals.prepare.location(
    {
      pageId: parent.pageId,
      projectId: state.projectId!,
      location: parent.location,
      resource: parent.location.resource,
      pageStates: retained.pageStates,
      action: "moveFinalDocumentToCollection",
    },
    state,
  );
  // The publisher writes history before invoking the move, preserving its atomic commit boundary.
  return (move: () => void) => getPageLocationPreparation(core.pageLocations).commit(next, move, "replace");
};
