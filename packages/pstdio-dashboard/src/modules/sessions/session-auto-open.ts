import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { openDashboardSessionPanel } from "./bubble/session-bubble";
import { createDashboardSessions } from "./data/dashboard-sessions";

// Sessions are sorted by last activity, so the first match is the conversation the user
// was most recently having in this workspace. Anchors describe relationships, not navigation intent.
const findLatestSessionForResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (resource.type !== "workspace") return;
  return createDashboardSessions(getDashboardSelectedProjectId(ctx)).find(
    (session) => session.workspaceId === resource.id,
  );
};
// Workspace previews preserve panel presentation and return activation to Main.
export const openResourceSessionPreview = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const session = findLatestSessionForResource(ctx, resource);
  if (!session) return;
  const mainPanelId = ctx.layout.getActivePanel("main")?.instanceId;
  openDashboardSessionPanel(ctx, {
    resource: session.resource,
    preservePanelMode: true,
  });
  if (mainPanelId) ctx.layout.activatePanel(mainPanelId);
};
