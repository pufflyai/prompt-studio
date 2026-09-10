import { type PlacementIdentity, resourceKey, workbenchPanels } from "@pstdio/sdk/extensions";
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
  replaceDraft?: PlacementIdentity;
}
const replaceDraftPanel = (ctx: WorkbenchModuleContext, input: OpenDashboardSessionPanelInput) => {
  const identity = input.replaceDraft;
  if (identity?.kind !== "mode") return undefined;
  const placements = ctx.layout.getLayout().regions.side.widgets;
  const destination = placements.find(
    (placement) =>
      placement.viewId === dashboardWidgetIds.sessionBubble &&
      placement.resource?.type === "session" &&
      placement.resource.id === input.resource.id,
  );
  if (destination) return ctx.layout.activatePanel(destination.widgetId);
  const origin = placements.find(
    (placement) =>
      placement.placementIdentity?.kind === "mode" &&
      placement.placementIdentity.placementId === identity.placementId &&
      placement.placementIdentity.instanceKey === identity.instanceKey &&
      placement.resource?.type === "session-draft",
  );
  if (!origin) return undefined;
  ctx.modePlacements.updatePlacement(identity, { resource: input.resource, title: input.resource.label });
  return ctx.layout.activatePanel(origin.widgetId);
};
// The single path every session open goes through: remember the selection, place the tab,
// mirror it into the sidenav, and reveal the Side Panel unless the caller keeps it as-is.
export const openDashboardSessionPanel = (ctx: WorkbenchModuleContext, input: OpenDashboardSessionPanelInput) => {
  rememberDashboardSessionResource(ctx, input.resource);
  const previousPanelMode = ctx.sidePanel.getMode();
  const bubble =
    replaceDraftPanel(ctx, input) ??
    openSessionBubbleWidgets(ctx, {
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
