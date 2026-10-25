import { type PlacementIdentity, workbenchPages } from "@pstdio/sdk/extensions";
import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchPanelRegion,
  WorkbenchTabRetention,
} from "@pstdio/workbench";
import { sessionPanelRef } from "./session-panel-placements";

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  tabRetention?: WorkbenchTabRetention;
  region?: WorkbenchPanelRegion;
}
export const openSessionBubbleWidgets = (
  ctx: Pick<WorkbenchModuleContext, "navigation" | "modes">,
  input: OpenSessionBubbleWidgetsInput = {},
) => {
  if (!input.resource) return undefined;
  return ctx.navigation.openTarget({
    kind: "panel",
    panel: sessionPanelRef(ctx.modes.getActiveModeId() ?? "project"),
    resource: input.resource,
    open: input.tabRetention === "persistent" ? "pin" : "preview",
    region: input.region,
  });
};
interface OpenDashboardSessionPanelInput extends OpenSessionBubbleWidgetsInput {
  resource: ResourceRef;
  replacePanel?: PlacementIdentity;
  from?: ResourceRef;
}
export const openDashboardSessionPanel = (ctx: WorkbenchModuleContext, input: OpenDashboardSessionPanelInput) => {
  const bubble = input.replacePanel
    ? ctx.navigation.openTarget(
        {
          kind: "viewer",
          operation: "switch",
          from: input.from,
          resource: input.resource,
          ...(input.replacePanel.kind === "page" ? { page: workbenchPages.session } : {}),
        },
        { viewer: input.replacePanel, projectId: input.from?.projectId },
      )
    : openSessionBubbleWidgets(ctx, {
        resource: input.resource,
        tabRetention: input.tabRetention,
        region: input.region,
      });
  return bubble;
};
