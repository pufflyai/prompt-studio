import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchCore } from "../../workbench-core-types";

export const createPlacementPinController = (resolveCore: () => WorkbenchCore) => (identity: PlacementIdentity) => {
  const core = resolveCore();
  const key = placementIdentityKey(identity);
  const placement = Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((item) => item.placementIdentity && placementIdentityKey(item.placementIdentity) === key);
  if (!placement) throw new Error(`Placement is not open: ${key}`);
  if (placement.tabRetention !== "preview") return;
  if (identity.kind === "page") core.pages.pinPlacement(identity);
  else if (identity.kind === "mode") core.modePlacements.updatePlacement(identity, { open: "pin" });
  else core.shellPlacements.updatePlacement(identity, { open: "pin" });
};
