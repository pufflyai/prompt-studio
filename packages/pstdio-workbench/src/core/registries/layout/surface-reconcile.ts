import type { ResourceRef } from "../resources/resource-registry";
import { getActiveLocationPlacement, getActivePlacement } from "./layout-operations";
import type { WorkbenchLayout, WorkbenchRegion } from "./layout-types";
import { type AnchorId, getSurface, listAnchorRegions, resolveAnchorRegion } from "./surface-map";

// The resource an anchor currently hosts, read from its region's active placement. This
// is the primary-scoped signal the coordinator keys off — `getAnchorResource(layout,
// "primary")` is the main resource, free of the global active-resource pollution that
// any side-region activation otherwise introduces.
export const getAnchorResource = (layout: WorkbenchLayout, anchorId: AnchorId) => {
  const active = getActivePlacement(layout.regions[resolveAnchorRegion(anchorId)]);
  if (anchorId !== "primary") return active?.resource;
  const location = getActiveLocationPlacement(layout);
  if (location) return location.resource;
  // Low-level host panels can establish a primary without an explicit role.
  // An auxiliary panel moved into Main cannot become that primary.
  return active?.role === "sub-panel" ? undefined : active?.resource;
};

// What the coordinator should do with a secondary anchor when the primary resource
// changes. Projections re-render off their anchor (a render concern), so the reconciler
// only decides the lifecycle of the derived/detached anchor placements.
export type AnchorReconcileAction = { region: WorkbenchRegion; widgetId: string; action: "keep" | "clear" };

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
    for (const placement of layout.regions[region].widgets) {
      if (!placement.resource) continue;
      // A moved Location and its owned Sub Panels retain their owner lifecycle.
      // Sharing a region with derived content cannot change that ownership.
      const retained =
        placement.role === "location" || (placement.role === "sub-panel" && Boolean(placement.ownerResourceKey));
      const keep = retained || (surface.persistence !== "derived" && isInScope(placement.resource, primary));
      actions.push({ region, widgetId: placement.widgetId, action: keep ? "keep" : "clear" });
    }
  }

  return actions;
};
