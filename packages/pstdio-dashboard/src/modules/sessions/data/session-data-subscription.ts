import { getIndexedRows, subscribeCollections } from "@/lib/sync/collections";
import {
  getDashboardWorkspaceDiffSummary,
  subscribeDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";

const coalescedListener = (listener: () => void) => {
  let scheduled = false;
  let disposed = false;
  return {
    notify() {
      if (scheduled || disposed) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (!disposed) listener();
      });
    },
    dispose() {
      disposed = true;
    },
  };
};

export const subscribeSessionData = (sessionId: string | undefined, listener: () => void) => {
  const notification = coalescedListener(listener);
  const workspaces = () =>
    getIndexedRows("workspace_sessions", "session_id", sessionId).map((row) => String(row.workspace_id));
  let workspaceIds = workspaces();
  const summaries = () => workspaceIds.map(getDashboardWorkspaceDiffSummary);
  let previousSummaries = summaries();
  const unsubscribe = subscribeCollections((change) => {
    if (!sessionId) return;
    if (!change) {
      workspaceIds = workspaces();
      notification.notify();
      return;
    }
    const relevant = change.changes.some(
      ({ key, value, previousValue }) =>
        (change.table === "sessions" && key === sessionId) ||
        (change.table === "workspaces" && workspaceIds.includes(key)) ||
        (change.table === "workspace_sessions" && [value, previousValue].some((row) => row?.session_id === sessionId)),
    );
    if (!relevant) return;
    workspaceIds = workspaces();
    notification.notify();
  });
  const unsubscribeDiff = subscribeDashboardWorkspaceDiffSummaries(() => {
    const next = summaries();
    if (next.length !== previousSummaries.length || next.some((value, index) => value !== previousSummaries[index])) {
      previousSummaries = next;
      notification.notify();
    }
  });
  return () => {
    notification.dispose();
    unsubscribe();
    unsubscribeDiff();
  };
};

export const subscribeSessionListData = (listener: () => void) => {
  const notification = coalescedListener(listener);
  const unsubscribe = subscribeCollections((change) => {
    if (!change || ["sessions", "workspaces", "workspace_sessions"].includes(change.table)) notification.notify();
  });
  return () => {
    notification.dispose();
    unsubscribe();
  };
};
