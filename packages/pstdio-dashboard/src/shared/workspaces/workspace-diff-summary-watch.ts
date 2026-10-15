import { getRuntimeCollections } from "@/lib/sync/collections";
import {
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "./workspace-diff-summary-data";

export const watchDashboardWorkspaceDiffSummaries = (workspaceIds: string[], listener: () => void) => {
  const owner = getRuntimeCollections();
  let cancelled = false;
  const unsubscribe = subscribeDashboardWorkspaceDiffSummaries(listener, owner);
  const refresh = () => {
    void requestDashboardWorkspaceDiffSummaries(workspaceIds, undefined, owner).then(() => {
      if (!cancelled) listener();
    });
  };
  const unsubscribeWorkspaces = owner.subscribeCollections((change) => {
    if (!change || change.table === "workspaces") refresh();
  });
  refresh();

  return () => {
    cancelled = true;
    unsubscribe();
    unsubscribeWorkspaces();
  };
};
