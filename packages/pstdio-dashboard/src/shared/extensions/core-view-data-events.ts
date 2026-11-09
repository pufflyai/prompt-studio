import { viewDataEvents } from "@pstdio/sdk/extensions";
import { getRuntimeCollections, type SyncedRow } from "@/lib/sync/collections";
import { type ExtensionRefreshEvent, publishExtensionEvent } from "./extension-webview-broadcast";
import { subscribeToResourceAnchorChanges } from "./resource-anchor-feed";

const projectOf = (row: SyncedRow | undefined) => (typeof row?.project_id === "string" ? row.project_id : undefined);

const changedScope = (key: string, value: SyncedRow | undefined, previousValue: SyncedRow | undefined) => {
  const changedFields = [...new Set([...Object.keys(previousValue ?? {}), ...Object.keys(value ?? {})])].filter(
    (field) => !Object.is(previousValue?.[field], value?.[field]),
  );
  const membership = !value || !previousValue || projectOf(value) !== projectOf(previousValue);
  return { resourceIds: [key], changedFields, membership, changes: [{ resourceId: key, changedFields, membership }] };
};

export const subscribeCoreViewDataEvents = (publish?: (event: ExtensionRefreshEvent) => void) => {
  const owner = getRuntimeCollections();
  const publishOwned = publish ?? ((event: ExtensionRefreshEvent) => publishExtensionEvent(event, owner));
  const pending = new Map<string, ExtensionRefreshEvent>();
  let scheduled = false;
  let disposed = false;
  const enqueue = (id: string, projectId: string | undefined, scope: Partial<ExtensionRefreshEvent> = {}) => {
    if (!projectId) return;
    const key = JSON.stringify([id, projectId]);
    const previous = pending.get(key);
    const changes = new Map((previous?.changes ?? []).map((change) => [change.resourceId, change]));
    for (const change of scope.changes ?? []) {
      const prior = changes.get(change.resourceId);
      changes.set(change.resourceId, {
        ...change,
        changedFields: [...new Set([...(prior?.changedFields ?? []), ...change.changedFields])],
        membership: prior?.membership || change.membership,
      });
    }
    pending.set(key, {
      ...scope,
      id,
      projectId,
      ...(changes.size && { changes: [...changes.values()] }),
      ...(scope.resourceIds && { resourceIds: [...new Set([...(previous?.resourceIds ?? []), ...scope.resourceIds])] }),
      ...(scope.changedFields && {
        changedFields: [...new Set([...(previous?.changedFields ?? []), ...scope.changedFields])],
      }),
      ...((previous?.membership || scope.membership) && { membership: true }),
    });
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed || owner.isDisposed()) return;
      const events = [...pending.values()];
      pending.clear();
      for (const event of events) publishOwned(event);
    });
  };
  const unsubscribeAnchors = subscribeToResourceAnchorChanges(
    (event) => enqueue(viewDataEvents.resourceAnchorsChanged.id, event.projectId),
    owner,
  );
  const unsubscribe = owner.subscribeCollections((change) => {
    if (!change) return;
    for (const { key, value, previousValue } of change.changes) {
      const scope = changedScope(key, value, previousValue);
      for (const row of [previousValue, value]) {
        if (!row) continue;
        switch (change.table) {
          case "projects":
            enqueue(viewDataEvents.projectsChanged.id, typeof row.id === "string" ? row.id : undefined, scope);
            break;
          case "board_views":
          case "board_default_views":
            enqueue(viewDataEvents.boardViewsChanged.id, projectOf(row), scope);
            break;
          case "sessions":
            enqueue(viewDataEvents.sessionsChanged.id, projectOf(row), scope);
            break;
          case "workspace_sessions":
            enqueue(
              viewDataEvents.sessionsChanged.id,
              projectOf(owner.getCollection("sessions").get(String(row.session_id))),
              {
                ...scope,
                resourceIds: [String(row.session_id)],
                changes: scope.changes.map((change) => ({ ...change, resourceId: String(row.session_id) })),
              },
            );
            enqueue(
              viewDataEvents.sessionsChanged.id,
              projectOf(owner.getCollection("workspaces").get(String(row.workspace_id))),
              {
                ...scope,
                resourceIds: [String(row.session_id)],
                changes: scope.changes.map((change) => ({ ...change, resourceId: String(row.session_id) })),
              },
            );
            break;
          case "workspaces":
            enqueue(viewDataEvents.workspacesChanged.id, projectOf(row), scope);
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
