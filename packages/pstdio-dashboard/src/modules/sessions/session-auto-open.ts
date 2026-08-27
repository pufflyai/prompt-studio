import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openDashboardSessionPanel } from "./bubble/session-bubble";
import { createDashboardSessions, type DashboardSession } from "./data/dashboard-sessions";

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const belongsToResource = (session: DashboardSession, resource: ResourceRef) => {
  if (resource.kind === "workspace") {
    return session.workspaceId === (resource.id ?? metadataString(resource, "workspaceId"));
  }
  return session.anchors.some((anchor) => anchor.type === resource.kind && anchor.id === resource.id);
};

// Sessions are sorted by last activity, so the first match is the conversation the user
// was most recently having about this workspace or anchored resource.
export const findLatestSessionForResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) =>
  createDashboardSessions(getDashboardSelectedProjectId(ctx)).find((session) => belongsToResource(session, resource));

// Opening a workspace or an anchored resource brings its conversation along in the Side Panel. It is a
// preview, it leaves the Side Panel presentation alone, and it hands activation straight back
// to the resource the user actually navigated to.
export const openResourceSessionPreview = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (!ctx.layout.getPanel(dashboardWidgetIds.sessionBubble)) return;

  const session = findLatestSessionForResource(ctx, resource);
  if (!session) return;

  const activeWidgetId = ctx.layout.getLayout().activeWidgetId;
  openDashboardSessionPanel(ctx, {
    resource: session.resource,
    tabPosition: "start",
    preservePanelMode: true,
  });
  if (activeWidgetId) ctx.layout.activateWidget(activeWidgetId);
};
