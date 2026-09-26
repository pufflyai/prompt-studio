import { subscribeCollections } from "@/lib/sync/collections";
import {
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "./workspace-diff-summary-data";

export const watchDashboardWorkspaceDiffSummaries = (workspaceIds: string[], listener: () => void) => {
  let cancelled = false;
  const unsubscribe = subscribeDashboardWorkspaceDiffSummaries(listener);
  const refresh = () => {
    void requestDashboardWorkspaceDiffSummaries(workspaceIds).then(() => {
      if (!cancelled) listener();
    });
  };
  const unsubscribeWorkspaces = subscribeCollections((change) => {
    if (!change || change.table === "workspaces") refresh();
  });
  refresh();

  return () => {
    cancelled = true;
    unsubscribe();
    unsubscribeWorkspaces();
  };
};
