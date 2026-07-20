import type { ResourceRef } from "../resources/resource-registry";
import { getActivePlacement } from "./layout-operations";
import type { WorkbenchLayout, WorkbenchRegion } from "./layout-types";
import { type AnchorId, getSurface, listAnchorRegions, resolveAnchorRegion } from "./surface-map";

// The resource an anchor currently hosts, read from its region's active placement. This
// is the primary-scoped signal the coordinator keys off — `getAnchorResource(layout,
// "primary")` is the main resource, free of the global active-resource pollution that
// any side-region activation otherwise introduces.
export const getAnchorResource = (layout: WorkbenchLayout, anchorId: AnchorId) =>
  getActivePlacement(layout.regions[resolveAnchorRegion(anchorId)])?.resource;

// What the coordinator should do with a secondary anchor when the primary resource
// changes. Projections re-render off their anchor (a render concern), so the reconciler
// only decides the lifecycle of the derived/detached anchor placements.
export type AnchorReconcileAction = { region: WorkbenchRegion; action: "keep" | "clear" };

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

  for (const region of listAnchorRegions()) {
    const surface = getSurface(region);
    if (surface.role !== "anchor" || surface.persistence === "primary") continue;

    // Only resource-bearing anchor placements are scoped content. A plain (resourceless)
    // widget parked in a side anchor is not a scoped resource and is left untouched.
    const placement = getActivePlacement(layout.regions[region]);
    if (!placement?.resource) continue;

    if (surface.persistence === "derived") {
      actions.push({ region, action: "clear" });
      continue;
    }

    actions.push({ region, action: isInScope(placement.resource, primary) ? "keep" : "clear" });
  }

  return actions;
};
