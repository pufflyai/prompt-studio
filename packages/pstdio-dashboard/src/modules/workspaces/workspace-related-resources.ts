import { workbenchPages } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getIndexedRows } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { createDashboardWorkspaces } from "@/shared/workspaces/dashboard-workspaces";

export const relatedWorkspaceResources = (ctx: WorkbenchModuleContext, source: ResourceRef) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || source.projectId !== projectId || source.extensionId !== "pstdio") return [];
  const workspaceIds = new Set<unknown>();
  if (source.type === "session")
    for (const row of getIndexedRows("workspace_sessions", "session_id", source.id)) workspaceIds.add(row.workspace_id);
  if (source.type === "terminal") workspaceIds.add(source.metadata?.workspaceId);
  return createDashboardWorkspaces(projectId)
    .filter((workspace) => workspaceIds.has(workspace.id))
    .map((workspace) => {
      const resource = canonicalDashboardResource(workspace.resource, projectId);
      return { resource, target: { kind: "page" as const, page: workbenchPages.workspace, resource } };
    });
};
