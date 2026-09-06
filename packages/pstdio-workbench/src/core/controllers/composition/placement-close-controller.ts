import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchCore } from "../../workbench-core-types";

export const createPlacementCloseController = (resolveCore: () => WorkbenchCore) => (identity: PlacementIdentity) => {
  const core = resolveCore();
  const key = placementIdentityKey(identity);
  const placement = Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((item) => item.placementIdentity && placementIdentityKey(item.placementIdentity) === key);
  if (!placement) throw new Error(`Placement is not open: ${key}`);
  if (!placement.closable) throw new Error(`Placement is fixed and cannot close: ${key}`);
  if (identity.kind === "page") {
    const result = core.pageLocations.closePlacement(identity);
    if (!result.ok) throw new Error(result.diagnostic.message);
    return;
  }
  if (identity.kind === "mode") core.modePlacements.closePlacement(identity);
  else core.shellPlacements.closePlacement(identity);
};
