import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelInstance } from "../layout/layout-types";
import { placementIdentityKey } from "../layout/placement-reconciliation";

export const rendererReadKey = (placement: WorkbenchPanelInstance, lane = "view") =>
  JSON.stringify([
    lane,
    placement.placementIdentity ? placementIdentityKey(placement.placementIdentity) : placement.instanceId,
    resourceKey(placement.resource) ?? null,
  ]);
