import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";

export const transferPanelOwner = (
  core: WorkbenchCore,
  placement: WorkbenchWidgetPlacement,
  destination: WorkbenchPanelRegion,
) => {
  const identity = placement.placementIdentity;
  const state = core.pages.store.getState();
  const pageDestination = destination === "main" || destination === "bottom";
  if (pageDestination && !state.activePageId) return placement;
  if (!pageDestination && !state.activeModeId) return placement;
  if (pageDestination && identity?.kind === "page" && identity.pageId === state.activePageId) return placement;
  if (!pageDestination && identity?.kind === "mode" && identity.modeId === state.activeModeId) return placement;
  const owner: PlacementIdentity = pageDestination
    ? {
        kind: "page",
        pageId: state.activePageId!,
        slotId: placement.contributionId,
        instanceKey: placement.widgetId,
      }
    : {
        kind: "mode",
        modeId: state.activeModeId!,
        placementId: placement.contributionId,
        instanceKey: placement.widgetId,
      };
  return {
    ...placement,
    placementIdentity: owner,
    declarationIdentity: placement.declarationIdentity ?? identity,
    ownerResourceKey: pageDestination ? placement.ownerResourceKey : undefined,
  };
};
