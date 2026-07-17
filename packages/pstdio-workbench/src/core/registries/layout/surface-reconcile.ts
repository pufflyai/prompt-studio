import type { ResourceRef } from "../resources/resource-registry";
import { listAnchorAreas, resolveAnchorArea } from "./frame-queries";
import type { AnchorId, Frame } from "./frame-types";
import { getActivePlacement } from "./layout-operations";
import type { WorkbenchArea, WorkbenchLayout } from "./layout-types";

// The resource an anchor currently hosts, read from its area's active placement. This
// is the primary-scoped signal the coordinator keys off — the frame identifies which
// slot currently hosts primary, free of the global active-resource pollution that any
// side-area activation otherwise introduces.
export const getAnchorResource = <TSlot extends WorkbenchArea>(
  frame: Frame<TSlot>,
  layout: WorkbenchLayout,
  anchorId: AnchorId,
) => {
  const area = resolveAnchorArea(frame, anchorId);
  if (!area) return undefined;
  return getActivePlacement(layout.areas[area])?.resource;
};

// What the coordinator should do with a secondary anchor when the primary resource
// changes. Projections re-render off their anchor (a render concern), so the reconciler
// only decides the lifecycle of the derived/detached anchor placements.
export type AnchorReconcileAction = { area: WorkbenchArea; action: "keep" | "clear" };

export interface ReconcileAnchorsInput<TSlot extends WorkbenchArea = WorkbenchArea> {
  frame: Frame<TSlot>;
  layout: WorkbenchLayout;
  primary: ResourceRef | undefined;
  // Whether a detached anchor's current resource still belongs to the new primary's
  // scoped candidates. Backed by scoped resource providers once wired.
  isInScope: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
}

// On a primary change: derived anchors re-scope (clear, then repopulate from the new
// scope); detached anchors stay while their resource is still in scope, else disconnect
// (scope wins). The primary anchor is the subject and is never reconciled.
export const reconcileAnchors = <TSlot extends WorkbenchArea>({
  frame,
  layout,
  primary,
  isInScope,
}: ReconcileAnchorsInput<TSlot>) => {
  const actions: AnchorReconcileAction[] = [];

  for (const area of listAnchorAreas(frame)) {
    if (area === frame.primary) continue;
    const binding = frame.secondary?.slot === area ? frame.secondary : frame.attached;
    if (!binding) continue;

    // Only resource-bearing anchor placements are scoped content. A plain (resourceless)
    // widget parked in a side anchor is not a scoped resource and is left untouched.
    const placement = getActivePlacement(layout.areas[area]);
    if (!placement?.resource) continue;

    if (binding.persistence === "derived") {
      actions.push({ area, action: "clear" });
      continue;
    }

    actions.push({ area, action: isInScope(placement.resource, primary) ? "keep" : "clear" });
  }

  return actions;
};
