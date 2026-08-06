import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
} from "@pstdio/workbench";
import { rememberDashboardSessionResource } from "@/modules/sessions/state/session-selection";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
  replaceWidgetId?: string;
  tabPosition?: WorkbenchTabPosition;
  tabRetention?: WorkbenchTabRetention;
}

// Sessions open as previews: the Side Panel keeps one peek slot that the next session takes
// over. Only an explicit "new tab" request (the tab tray's +) asks for a tab that stays.
const sessionOpenStrategy = (input: OpenSessionBubbleWidgetsInput) => {
  if (input.replaceWidgetId) {
    return { kind: "replace-panel" as const, instanceId: input.replaceWidgetId, retention: "preview" as const };
  }
  if (input.tabRetention === "persistent") return { kind: "persistent" as const, position: input.tabPosition };
  return { kind: "preview" as const, position: input.tabPosition };
};

export const openSessionBubbleWidgets = (
  ctx: Pick<WorkbenchModuleContext, "layout">,
  input: OpenSessionBubbleWidgetsInput = {},
) => {
  const bubble = ctx.layout.openPanel(dashboardWidgetIds.sessionBubble, {
    resource: input.resource,
    title: input.title ?? input.resource?.label,
    strategy: sessionOpenStrategy(input),
  });

  return { bubble };
};

export const selectSidenavSessionNode = (ctx: WorkbenchModuleContext, resource: ResourceRef | undefined) => {
  const nodeId = resource?.kind === "session" ? resource.uri : undefined;

  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nodeId);
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

  const existing = ctx.layout
    .listPanelInstances("side")
    .find(
      (instance) =>
        instance.panelId === dashboardWidgetIds.sessionBubble &&
        instance.resource?.kind === "session" &&
        instance.resource.id === input.resource.id,
    );
  const bubble = existing
    ? ctx.layout.activatePanel(existing.instanceId)
    : openSessionBubbleWidgets(ctx, {
        resource: input.resource,
        title: input.resource.label,
        replaceWidgetId: input.replaceWidgetId,
        tabPosition: input.tabPosition,
        tabRetention: input.tabRetention,
      }).bubble;

  selectSidenavSessionNode(ctx, input.resource);
  if (!input.preservePanelMode && ctx.sidePanel.getMode() === "closed") ctx.sidePanel.setMode("floating");

  return bubble;
};
