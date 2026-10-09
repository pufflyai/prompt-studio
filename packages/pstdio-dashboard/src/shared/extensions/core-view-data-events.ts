import { viewDataEvents } from "@pstdio/sdk/extensions";
import { getCollection, type SyncedRow, subscribeCollections } from "@/lib/sync/collections";
import { type ExtensionRefreshEvent, publishExtensionEvent } from "./extension-webview-broadcast";
import { subscribeToResourceAnchorChanges } from "./resource-anchor-feed";

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
  const unsubscribeAnchors = subscribeToResourceAnchorChanges((event) =>
    enqueue(viewDataEvents.resourceAnchorsChanged.id, event.projectId),
  );
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
        }
      }
    }
  });
  return () => {
    disposed = true;
    pending.clear();
    unsubscribe();
    unsubscribeAnchors();
  };
};
