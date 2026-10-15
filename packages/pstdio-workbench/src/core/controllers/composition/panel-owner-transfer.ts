import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { modeLayoutScope } from "../page-runtime/owner-layout-scope";

export const transferPanelOwner = (
  core: WorkbenchCore,
  placement: WorkbenchWidgetPlacement,
  destination: WorkbenchPanelRegion,
) => {
  const identity = placement.placementIdentity;
  // Restore can transfer a tab before the destination page is published.
  const state = getWorkbenchPageRegistryInternals(core.pages).getPublishingState();
  const pageDestination = destination === "main" || destination === "bottom" || destination === "aside";
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
    declarationScope:
      placement.declarationScope ??
      (identity?.kind === "mode"
        ? modeLayoutScope(state.projectId, identity.modeId)
        : core.layout.getPersistenceScope()),
    ownerResourceKey: pageDestination ? placement.ownerResourceKey : undefined,
  };
};
