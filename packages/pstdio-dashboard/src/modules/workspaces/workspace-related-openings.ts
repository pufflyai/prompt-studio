import type { RelatedResourceOpenings, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getCollection, getIndexedRows } from "@/lib/sync/collections";
import { waitForInitialCollectionsSync } from "@/lib/sync/initial-collections-sync";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardSessions } from "../sessions/data/dashboard-sessions";

export const workspaceRelatedOpenings = async (
  ctx: WorkbenchModuleContext,
  source: ResourceRef,
  signal: AbortSignal,
) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || source.projectId !== projectId || source.extensionId !== "pstdio" || source.type !== "workspace")
    return [];
  await waitForInitialCollectionsSync(signal);
  const workspace = getCollection("workspaces").state.get(source.id);
  if (!source.device && workspace?.is_default) return [];
  const sessions = new Set(
    getIndexedRows("workspace_sessions", "workspace_id", source.id).map((row) => row.session_id),
  );
  // Workspace membership is core data; it must not depend on the Sessions search provider being installed.
  const latest = createDashboardSessions(projectId).find((session) => sessions.has(session.id));
  return (
    latest ? [{ resource: latest.resource, autoOpen: true, region: "side", open: "preview" }] : []
  ) satisfies RelatedResourceOpenings;
};
