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

interface PendingViewEvent {
  id: string;
  projectId: string;
  scope: Partial<ExtensionRefreshEvent>;
  resourceIds?: Set<string>;
  changedFields?: Set<string>;
  membership?: boolean;
  changes: Map<string, { resourceId: string; changedFields: Set<string>; membership?: boolean }>;
}

const mergeViewChange = (batch: PendingViewEvent, scope: Partial<ExtensionRefreshEvent>) => {
  batch.scope = scope;
  batch.membership ||= scope.membership;
  if (scope.resourceIds) {
    batch.resourceIds ??= new Set();
    for (const id of scope.resourceIds) batch.resourceIds.add(id);
  }
  if (scope.changedFields) {
    batch.changedFields ??= new Set();
    for (const field of scope.changedFields) batch.changedFields.add(field);
  }
  for (const change of scope.changes ?? []) {
    let prior = batch.changes.get(change.resourceId);
    if (!prior) {
      prior = { resourceId: change.resourceId, changedFields: new Set() };
      batch.changes.set(change.resourceId, prior);
    }
    for (const field of change.changedFields) prior.changedFields.add(field);
    prior.membership ||= change.membership;
  }
};

export const subscribeCoreViewDataEvents = (publish?: (event: ExtensionRefreshEvent) => void) => {
  const owner = getRuntimeCollections();
  const publishOwned = publish ?? ((event: ExtensionRefreshEvent) => publishExtensionEvent(event, owner));
  const pending = new Map<string, PendingViewEvent>();
  let scheduled = false;
  let disposed = false;
  const enqueue = (id: string, projectId: string | undefined, scope: Partial<ExtensionRefreshEvent> = {}) => {
    if (!projectId) return;
    const key = JSON.stringify([id, projectId]);
    let batch = pending.get(key);
    if (!batch) {
      batch = { id, projectId, scope, changes: new Map() };
      pending.set(key, batch);
    }
    mergeViewChange(batch, scope);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed || owner.isDisposed()) return;
      const events = [...pending.values()];
      pending.clear();
      for (const batch of events)
        publishOwned({
          ...batch.scope,
          id: batch.id,
          projectId: batch.projectId,
          ...(batch.resourceIds && { resourceIds: [...batch.resourceIds] }),
          ...(batch.changedFields && { changedFields: [...batch.changedFields] }),
          ...(batch.membership && { membership: true }),
          ...(batch.changes.size && {
            changes: [...batch.changes.values()].map((change) => ({
              ...change,
              changedFields: [...change.changedFields],
            })),
          }),
        });
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
