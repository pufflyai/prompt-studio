import { resourceKey, workbenchPanels } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext, WorkbenchTabRetention } from "@pstdio/workbench";
import { rememberDashboardSessionResource } from "@/modules/sessions/state/session-selection";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
  tabRetention?: WorkbenchTabRetention;
}
export const openSessionBubbleWidgets = (
  ctx: Pick<WorkbenchModuleContext, "navigation">,
  input: OpenSessionBubbleWidgetsInput = {},
) => {
  if (!input.resource) return undefined;
  return ctx.navigation.openTarget({
    kind: "panel",
    panel: workbenchPanels.projectSession,
    resource: input.resource,
    open: input.tabRetention === "persistent" ? "pin" : "preview",
  });
};
export const selectSidenavSessionNode = (ctx: WorkbenchModuleContext, resource: ResourceRef | undefined) => {
  const nodeId = resource?.type === "session" ? resourceKey(resource) : undefined;
  if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav)) {
    ctx.treeViews.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nodeId);
  }
};
interface OpenDashboardSessionPanelInput extends OpenSessionBubbleWidgetsInput {
  resource: ResourceRef;
  preservePanelMode?: boolean;
}
// The single path every session open goes through: remember the selection, place the tab,
// mirror it into the sidenav, and reveal the Side Panel unless the caller keeps it as-is.
export const openDashboardSessionPanel = (ctx: WorkbenchModuleContext, input: OpenDashboardSessionPanelInput) => {
  rememberDashboardSessionResource(ctx, input.resource);
  const previousPanelMode = ctx.sidePanel.getMode();
  const bubble = openSessionBubbleWidgets(ctx, {
    resource: input.resource,
    title: input.resource.label,
    tabRetention: input.tabRetention,
  });
  selectSidenavSessionNode(ctx, input.resource);
  if (input.preservePanelMode && ctx.sidePanel.getMode() !== previousPanelMode) {
    ctx.sidePanel.setMode(previousPanelMode);
  }
  return bubble;
};
