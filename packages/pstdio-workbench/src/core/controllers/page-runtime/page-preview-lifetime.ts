import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { editPagePlacementStates } from "../../registries/pages/page-placement-state";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { pageContextChanged } from "./page-main-tabs";
import { removeTrayPreviews } from "./tray-preview-retention";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

export const departingPagePreviews = (next: State, previous: State, layout: WorkbenchLayout) => {
  if (
    !previous.activePageId ||
    previous.projectId !== next.projectId ||
    previous.activeModeId !== next.activeModeId ||
    !pageContextChanged(next, previous)
  )
    return [];
  // Back and Forward can select a cached preview as the destination.
  const activated = new Set(next.reconciliation.activate.map((placement) => placementIdentityKey(placement.identity)));
  return Object.values(layout.regions).flatMap((region) =>
    region.widgets.filter(
      (widget) =>
        widget.tabRetention === "preview" &&
        (!widget.placementIdentity || !activated.has(placementIdentityKey(widget.placementIdentity))),
    ),
  );
};

export const closeDepartingPagePreviews = (state: State, previous: State, layout: WorkbenchLayout) => {
  const previews = departingPagePreviews(state, previous, layout);
  const removed = new Set(
    previews.flatMap((widget) => {
      if (!widget.placementIdentity) return [];
      const key = placementIdentityKey(widget.placementIdentity);
      const incoming = state.placements.find((entry) => placementIdentityKey(entry.identity) === key);
      return incoming &&
        (incoming.value.tabRetention ?? widget.tabRetention) === "preview" &&
        resourceKey(incoming.value.resource) === resourceKey(widget.resource)
        ? [key]
        : [];
    }),
  );
  const next = removeTrayPreviews(state, previous, removed);
  let pageStates = next.pageStates;
  for (const widget of previews) {
    const identity = widget.placementIdentity;
    if (identity?.kind !== "page") continue;
    pageStates = editPagePlacementStates(pageStates, identity, { kind: "close" });
  }
  return previews.length ? { ...next, pageStates } : next;
};
