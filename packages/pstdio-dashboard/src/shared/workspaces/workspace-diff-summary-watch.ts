import { getRuntimeCollections } from "@/lib/sync/collections";
import { getDashboardWorkspaceDiffQuery } from "./workspace-diff-summary-data";

export const watchDashboardWorkspaceDiffSummaries = (workspaceIds: string[], listener: () => void) => {
  const owner = getRuntimeCollections();
  const stops = [...new Set(workspaceIds)].map((id) => {
    const query = getDashboardWorkspaceDiffQuery(id, owner);
    return query.subscribe(listener);
  });
  return () => {
    for (const stop of stops) stop();
  };
};
