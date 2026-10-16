import type { RelatedResourceOpenings, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getIndexedRows } from "@/lib/sync/collections";
import { waitForInitialCollectionsSync } from "@/lib/sync/initial-collections-sync";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { workspaceTerminalResources } from "@/shared/terminal/workspace-terminal-resources";

export const workspaceRelatedOpenings = async (
  ctx: WorkbenchModuleContext,
  source: ResourceRef,
  signal: AbortSignal,
) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || source.projectId !== projectId || source.extensionId !== "pstdio" || source.type !== "workspace")
    return [];
  await waitForInitialCollectionsSync(signal);
  const sessions = new Set(
    getIndexedRows("workspace_sessions", "workspace_id", source.id).map((row) => row.session_id),
  );
  const latest = ctx.resources
    .listResources("")
    .find(
      (entry) =>
        entry.resource.extensionId === "pstdio" &&
        entry.resource.type === "session" &&
        entry.resource.projectId === projectId &&
        sessions.has(entry.resource.id),
    );
  const openings: RelatedResourceOpenings[number][] = workspaceTerminalResources(ctx, source).map(({ resource }) => ({
    resource,
    autoOpen: true,
    region: "secondary",
    open: "preview",
  }));
  if (latest) openings.push({ resource: latest.resource, autoOpen: true, region: "side", open: "preview" });
  return openings;
};
