import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { LayoutModel } from "../../registries/layout/layout-model-types";
import { buildUpdatedPlacement } from "../../registries/layout/layout-operations";
import type { OpenWidgetInput } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { OwnedPlacementUpdateInput } from "../../registries/placements/owned-placement-preparation";
import type { createWorkbenchLayoutCache } from "../page-runtime/workbench-layout-cache";

export const createTransferredPlacementUpdater =
  (layout: LayoutModel, cache: ReturnType<typeof createWorkbenchLayoutCache>) =>
  (identity: PlacementIdentity, update: OwnedPlacementUpdateInput) => {
    const key = placementIdentityKey(identity);
    const placements = Object.values(layout.getLayout().regions).flatMap((region) => region.widgets);
    if (placements.some((p) => p.placementIdentity && placementIdentityKey(p.placementIdentity) === key)) return false;
    const transferred = placements.find(
      (p) => p.declarationIdentity && placementIdentityKey(p.declarationIdentity) === key,
    );
    const changes: OpenWidgetInput = {
      resource: update.resource,
      title: update.title,
      ...(update.open
        ? { pinned: update.open === "pin", tabRetention: update.open === "pin" ? "persistent" : "preview" }
        : {}),
    };
    if (transferred) {
      layout.updateWidgetPlacement(transferred.widgetId, changes);
      return true;
    }
    return cache.updateTransferredPlacement(identity, (placement) => {
      const widget = layout.getWidget(placement.contributionId);
      return widget ? buildUpdatedPlacement(placement, widget, changes) : placement;
    });
  };
