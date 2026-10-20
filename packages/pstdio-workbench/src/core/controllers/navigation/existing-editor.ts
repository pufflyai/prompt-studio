import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { indexCurrentOwnedPlacements, renderDesiredPlacements } from "../../registries/layout/owned-placement-layout";
import { type PlacementDestination, placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";

type PageState = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

/** Placement ownership does not change the identity of the document being edited. */
export const findExistingEditor = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  before: PageState,
  prepared: PageState,
  destinations: readonly PlacementDestination[],
) => {
  if (!target.resource || before.activeModeId !== prepared.activeModeId) return undefined;
  const requested = prepared.reconciliation.activate.find(
    (entry) => target.kind !== "page" || entry.value.role === "location",
  );
  if (!requested?.value.viewId) return undefined;
  const resourceKey = core.pages.resourceReferenceKey(target.resource);
  const layout = getWorkbenchPanelLayout(core, before.activeModeId, before);
  const candidates = renderDesiredPlacements(
    { layout, placements: before.placements, destinations },
    indexCurrentOwnedPlacements(layout),
  );
  for (const candidate of candidates) {
    const value = candidate.placement;
    if (
      value.viewId !== requested.value.viewId ||
      !value.resource ||
      core.pages.resourceReferenceKey(value.resource) !== resourceKey
    )
      continue;
    // Reopening the routed Main document still applies sections, source positions and page parameters.
    if (
      target.kind === "page" &&
      candidate.region === "main" &&
      placementIdentityKey(candidate.identity) === placementIdentityKey(requested.identity)
    )
      return undefined;
    return candidate;
  }
  return undefined;
};
