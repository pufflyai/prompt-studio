import type { WorkbenchRegion } from "../layout/layout-types";
import type { WorkbenchPlacementPresentation } from "../views/view-placement";
import type { WorkbenchViewRegistry } from "../views/view-registry";
import {
  placementItemViewId,
  validateOwnedPlacementItem,
  type WorkbenchOwnedPlacementItem,
} from "./owned-placement-lifecycle";

export interface WorkbenchShellPlacementContribution extends WorkbenchPlacementPresentation {
  readonly id: string;
  readonly item: WorkbenchOwnedPlacementItem;
  readonly region: WorkbenchRegion;
  readonly order?: number;
}

export const validateShellPlacement = (
  placement: WorkbenchShellPlacementContribution,
  placements: ReadonlyMap<string, WorkbenchShellPlacementContribution>,
  views: WorkbenchViewRegistry,
) => {
  if (placements.has(placement.id)) throw new Error(`Shell placement already registered: ${placement.id}`);
  if (!views.getView(placementItemViewId(placement.item)))
    throw new Error(`Workbench shell placement view is not registered: ${placementItemViewId(placement.item)}`);
  validateOwnedPlacementItem("Shell placement", placement.id, placement.item);
};
