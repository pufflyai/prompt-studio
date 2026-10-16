import { resourceKey, workbenchPanels } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { createDashboardSessions } from "./data/dashboard-sessions";

export const relatedSessionResources = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || resource.projectId !== projectId) return [];
  return createDashboardSessions(projectId)
    .filter((session) => {
      if (resource.extensionId === "pstdio" && resource.type === "workspace")
        return session.workspaceId === resource.id;
      if (resource.extensionId === "pstdio" && resource.type === "terminal")
        return session.workspaceId === resource.metadata?.workspaceId;
      return session.anchors.some(
        ({ type, id, extensionId, projectId: anchorProject }) =>
          resourceKey(canonicalDashboardResource({ type, id, extensionId, projectId: anchorProject }, projectId)) ===
          resourceKey(resource),
      );
    })
    .map(({ resource }) => ({
      resource,
      target: { kind: "panel" as const, panel: workbenchPanels.projectSession, resource, open: "preview" as const },
    }));
};
