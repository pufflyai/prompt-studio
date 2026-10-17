import {
  type CollectionChange,
  getRuntimeCollections,
  type RuntimeCollections,
  type SyncedRow,
} from "@/lib/sync/collections";
import { subscribeDashboardWorkspaceDiffSummaries } from "@/shared/workspaces/workspace-diff-summary-data";

const ownsChange = (table: CollectionChange["table"], row: SyncedRow, projectId: string, owner: RuntimeCollections) => {
  if (table === "workspace_sessions") {
    return (
      owner.getCollection("workspaces").get(String(row.workspace_id))?.project_id === projectId ||
      owner.getCollection("sessions").get(String(row.session_id))?.project_id === projectId
    );
  }
  return row.project_id === projectId;
};

export const subscribeWorkspaceDataChanges = (getProjectId: () => string | undefined, listener: () => void) => {
  const owner = getRuntimeCollections();
  const unsubscribeData = owner.subscribeCollections((change) => {
    if (!change) {
      listener();
      return;
    }
    if (!["workspaces", "sessions", "workspace_sessions"].includes(change.table)) return;
    const projectId = getProjectId();
    if (
      !projectId ||
      change.changes.some(({ value, previousValue }) =>
        [value, previousValue].some((row) => row && ownsChange(change.table, row, projectId, owner)),
      )
    )
      listener();
  });
  const unsubscribeDiff = subscribeDashboardWorkspaceDiffSummaries((workspaceId) => {
    const projectId = getProjectId();
    if (!projectId || owner.getCollection("workspaces").get(workspaceId)?.project_id === projectId) listener();
  }, owner);
  return () => {
    unsubscribeData();
    unsubscribeDiff();
  };
};
