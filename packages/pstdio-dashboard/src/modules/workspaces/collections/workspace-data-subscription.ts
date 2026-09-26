import { type CollectionChange, getCollection, getIndexedRows, type SyncedRow } from "@/lib/sync/collections";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { subscribeDashboardWorkspaceDiffSummaries } from "@/shared/workspaces/workspace-diff-summary-data";

const ownsChange = (table: CollectionChange["table"], row: SyncedRow, projectId: string) => {
  if (table === "workspace_sessions") {
    return (
      getCollection("workspaces").get(String(row.workspace_id))?.project_id === projectId ||
      getCollection("sessions").get(String(row.session_id))?.project_id === projectId
    );
  }
  if (table === "repos")
    return getIndexedRows("project_repos", "repo_id", row.id).some((link) => link.project_id === projectId);
  return row.project_id === projectId;
};

export const subscribeWorkspaceDataChanges = (getProjectId: () => string | undefined, listener: () => void) => {
  const unsubscribeData = subscribeDashboardData((change) => {
    if (!change) {
      listener();
      return;
    }
    if (!["workspaces", "sessions", "workspace_sessions", "repos", "project_repos"].includes(change.table)) return;
    const projectId = getProjectId();
    if (
      !projectId ||
      change.changes.some(({ value, previousValue }) =>
        [value, previousValue].some((row) => row && ownsChange(change.table, row, projectId)),
      )
    )
      listener();
  });
  const unsubscribeDiff = subscribeDashboardWorkspaceDiffSummaries((workspaceId) => {
    const projectId = getProjectId();
    if (!projectId || getCollection("workspaces").get(workspaceId)?.project_id === projectId) listener();
  });
  return () => {
    unsubscribeData();
    unsubscribeDiff();
  };
};
