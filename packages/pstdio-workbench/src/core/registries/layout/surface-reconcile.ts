import type { ResourceRef } from "../resources/resource-registry";
import { getActivePlacement } from "./layout-operations";
import type { WorkbenchArea, WorkbenchLayout } from "./layout-types";
import { type AnchorId, getSurface, listAnchorAreas, resolveAnchorArea } from "./surface-map";

// The resource an anchor currently hosts, read from its area's active placement. This
// is the primary-scoped signal the coordinator keys off — `getAnchorResource(layout,
// "primary")` is the main resource, free of the global active-resource pollution that
// any side-area activation otherwise introduces.
export const getAnchorResource = (layout: WorkbenchLayout, anchorId: AnchorId) =>
  getActivePlacement(layout.areas[resolveAnchorArea(anchorId)])?.resource;

// What the coordinator should do with a secondary anchor when the primary resource
// changes. Projections re-render off their anchor (a render concern), so the reconciler
// only decides the lifecycle of the derived/detached anchor placements.
export type AnchorReconcileAction = { area: WorkbenchArea; action: "keep" | "clear" };

export interface ReconcileAnchorsInput {
  layout: WorkbenchLayout;
  primary: ResourceRef | undefined;
  // Whether a detached anchor's current resource still belongs to the new primary's
  // scoped candidates. Backed by scoped resource providers once wired.
  isInScope: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
}

// On a primary change: derived anchors re-scope (clear, then repopulate from the new
// scope); detached anchors stay while their resource is still in scope, else disconnect
// (scope wins). The primary anchor is the subject and is never reconciled.
export const reconcileAnchors = ({ layout, primary, isInScope }: ReconcileAnchorsInput): AnchorReconcileAction[] => {
  const actions: AnchorReconcileAction[] = [];

  for (const area of listAnchorAreas()) {
    const surface = getSurface(area);
    if (surface.role !== "anchor" || surface.persistence === "primary") continue;

    // Only resource-bearing anchor placements are scoped content. A plain (resourceless)
    // widget parked in a side anchor is not a scoped resource and is left untouched.
    const placement = getActivePlacement(layout.areas[area]);
    if (!placement?.resource) continue;

    if (surface.persistence === "derived") {
      actions.push({ area, action: "clear" });
      continue;
    }

    actions.push({ area, action: isInScope(placement.resource, primary) ? "keep" : "clear" });
  }

  return actions;
};
