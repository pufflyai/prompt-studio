import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

export const isSingleViewContinuation = (state: State, widget: WorkbenchWidgetPlacement) => {
  const identity = widget.placementIdentity;
  if (identity?.kind !== "page" || identity.slotId !== "$main") return false;
  const page = state.pages[state.activePageId ?? ""];
  const origin = state.pages[identity.pageId];
  if (
    page?.main.kind !== "view" ||
    origin?.main.kind !== "view" ||
    page.main.cardinality !== "one" ||
    origin.main.cardinality !== "one" ||
    page.document ||
    origin.document ||
    origin.modeId !== state.activeModeId
  )
    return false;
  return (
    page.id === origin.id ||
    ((page.parentId === origin.id || origin.parentId === page.id) &&
      page.main.view.id === origin.main.view.id &&
      page.main.view.extensionId === origin.main.view.extensionId)
  );
};

export const isSinglePageMain = (state: State, widget: WorkbenchWidgetPlacement) => {
  const identity = widget.placementIdentity;
  const page = state.pages[state.activePageId ?? ""];
  return (
    page?.main.kind === "view" &&
    page.main.cardinality === "one" &&
    !page.document &&
    identity?.kind === "page" &&
    identity.pageId === page.id &&
    identity.slotId === "$main"
  );
};

// A one-resource page changes conversation in its chosen region. The resource still owns
// its navigation identity; only the slot's current destination follows the replacement.
// Declared documents keep separate layouts, so opening one does not replace another.
export const singleViewDestinations = (state: State, previous: State, layout: WorkbenchLayout) => {
  const explicit = state.reconciliation.destinations ?? [];
  if (state.projectId !== previous.projectId || state.activeModeId !== previous.activeModeId) return explicit;
  const regions = Object.values(layout.regions);
  const destination =
    regions.find((region) => region.widgets.some((widget) => isSinglePageMain(state, widget))) ??
    regions.find((region) => region.widgets.some((widget) => isSingleViewContinuation(state, widget)));
  if (!destination) return explicit;
  return [
    ...explicit,
    ...state.reconciliation.activate
      .filter(
        (entry) =>
          isSinglePageMain(state, { ...entry.value, placementIdentity: entry.identity }) &&
          !explicit.some((target) => placementIdentityKey(target.identity) === placementIdentityKey(entry.identity)),
      )
      .map((entry) => ({ identity: entry.identity, region: destination.id })),
  ];
};
