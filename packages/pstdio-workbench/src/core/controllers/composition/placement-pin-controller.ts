import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchCore } from "../../workbench-core-types";

export const createPlacementPinController =
  (resolveCore: () => WorkbenchCore) =>
  (identity: PlacementIdentity, pinned = true) => {
    const core = resolveCore();
    const key = placementIdentityKey(identity);
    const placement = Object.values(core.layout.getLayout().regions)
      .flatMap((region) => region.widgets)
      .find((item) => item.placementIdentity && placementIdentityKey(item.placementIdentity) === key);
    if (!placement) throw new Error(`Placement is not open: ${key}`);
    const open = pinned ? "pin" : "preview";
    if (!placement.tabRetention || (placement.tabRetention === "persistent") === pinned) return;
    if (identity.kind === "page") core.pages.pinPlacement(identity, open);
    else if (identity.kind === "mode") core.modePlacements.updatePlacement(identity, { open });
    else core.shellPlacements.updatePlacement(identity, { open });
  };
