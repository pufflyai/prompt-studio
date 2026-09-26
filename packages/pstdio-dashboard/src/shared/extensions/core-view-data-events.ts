import { viewDataEvents } from "@pstdio/sdk/extensions";
import { getCollection, getIndexedRows, type SyncedRow, subscribeCollections } from "@/lib/sync/collections";
import { type ExtensionRefreshEvent, publishExtensionEvent } from "./extension-webview-broadcast";

const projectOf = (row: SyncedRow | undefined) => (typeof row?.project_id === "string" ? row.project_id : undefined);

export const subscribeCoreViewDataEvents = (
  publish: (event: ExtensionRefreshEvent) => void = publishExtensionEvent,
) => {
  const pending = new Map<string, ExtensionRefreshEvent>();
  let scheduled = false;
  let disposed = false;
  const enqueue = (id: string, projectId: string | undefined) => {
    if (!projectId) return;
    pending.set(JSON.stringify([id, projectId]), { id, projectId });
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed) return;
      const events = [...pending.values()];
      pending.clear();
      for (const event of events) publish(event);
    });
  };
  const unsubscribe = subscribeCollections((change) => {
    if (!change) return;
    for (const { value, previousValue } of change.changes) {
      for (const row of [previousValue, value]) {
        if (!row) continue;
        switch (change.table) {
          case "sessions":
            enqueue(viewDataEvents.sessionsChanged.id, projectOf(row));
            break;
          case "workspace_sessions":
            enqueue(
              viewDataEvents.sessionsChanged.id,
              projectOf(getCollection("sessions").get(String(row.session_id))),
            );
            enqueue(
              viewDataEvents.sessionsChanged.id,
              projectOf(getCollection("workspaces").get(String(row.workspace_id))),
            );
            break;
          case "workspaces":
            enqueue(viewDataEvents.workspacesChanged.id, projectOf(row));
            break;
          case "project_repos":
            enqueue(viewDataEvents.repositoriesChanged.id, projectOf(row));
            break;
          case "repos":
            for (const link of getIndexedRows("project_repos", "repo_id", row.id)) {
              enqueue(viewDataEvents.repositoriesChanged.id, projectOf(link));
            }
            break;
        }
      }
    }
  });
  return () => {
    disposed = true;
    pending.clear();
    unsubscribe();
  };
};
