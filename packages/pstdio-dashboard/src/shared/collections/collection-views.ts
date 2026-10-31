import type { BoardView } from "@pstdio/sdk/api";
import type { CollectionViewsProvider, CollectionViewsSource } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { type CollectionChange, getRuntimeCollections } from "@/lib/sync/collections";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";

interface CollectionViewsInput {
  projectId: string;
  extensionInstanceId: string | null | undefined;
  localId: string;
  record: {
    id: string;
    refreshEventIds?: string[];
    schemaRefreshEventIds?: string[];
  };
}

/** Native and extension collections share storage, sync, defaults, and mutation actions. */
export const createSharedCollectionViews = <
  TSettings extends NonNullable<import("@pstdio/sdk/api").BoardView["settings"]>,
>(
  input: CollectionViewsInput,
): CollectionViewsProvider<TSettings> => {
  const { projectId, extensionInstanceId: instanceId, localId, record } = input;
  const owner = getRuntimeCollections();
  const views = getApiClient(owner.connection).views;
  let cached: CollectionViewsSource<TSettings> | undefined;
  let version = -1;
  let pendingOrder: { ids: string[]; saved: boolean; snapshotDuringSave: boolean } | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    version = -1;
    for (const listener of listeners) listener();
  };
  const matches = (row: Record<string, unknown>) =>
    row.project_id === projectId && row.extension_instance_id === instanceId && row.board_id === localId;
  const getSyncedRows = () => owner.getIndexedRows("board_views", "project_id", projectId).filter(matches);
  const reconcilePendingOrder = (change: CollectionChange) => {
    if (change.table !== "board_views" || !pendingOrder) return;
    // A reconnect may replace a missed save with a newer server order.
    // Snapshots taken before the save finishes cannot supersede that move.
    if (change.type === "snapshot") {
      if (pendingOrder.saved) pendingOrder = undefined;
      else pendingOrder.snapshotDuringSave = true;
      return;
    }
    if (!pendingOrder.saved) return;
    const positions = new Map(pendingOrder.ids.map((id, index) => [id, index]));
    // Expected positions fill in this save. A changed, conflicting position
    // belongs to another order and supersedes it, including during a read.
    const superseded = change.changes.some(
      ({ value, previousValue }) =>
        value &&
        previousValue &&
        matches(value) &&
        Number(value.sort_order) !== Number(previousValue.sort_order) &&
        Number(value.sort_order) !== positions.get(value.id),
    );
    if (superseded) pendingOrder = undefined;
  };
  const actions: Omit<CollectionViewsSource<TSettings>, "views" | "defaultViewId"> = {
    // The views API returns the settings of the board or table it was asked about.
    onCreateView: async (body) =>
      (await views.create(projectId, record.id, body)) as BoardView & { settings: TSettings },
    onUpdateView: async (id, body) => {
      await views.update(projectId, id, body);
    },
    onDeleteView: async (id) => {
      await views.delete(projectId, id);
    },
    onSetDefaultView: async (viewId) => {
      await views.setDefault(projectId, record.id, viewId);
    },
    onReorderViews: async (viewIds) => {
      const order = { ids: [...viewIds], saved: false, snapshotDuringSave: false };
      pendingOrder = order;
      notify();
      try {
        await views.reorder(projectId, record.id, viewIds);
      } catch (error) {
        if (pendingOrder === order) {
          pendingOrder = undefined;
          notify();
        }
        throw error;
      }
      order.saved = true;
      if (order.snapshotDuringSave && pendingOrder === order) {
        // A snapshot may follow the server commit but precede its HTTP response.
        // Read after acknowledgement instead of guessing which order is newer.
        const current = await views.list(projectId, record.id).catch(() => undefined);
        if (current && pendingOrder === order) {
          order.ids = current.views.map((view) => view.id);
          notify();
        }
      }
    },
  };
  return {
    getSnapshot: () => {
      if (!owner.isInitialCollectionsSyncComplete()) return undefined;
      const current = owner.getCollectionsVersion();
      if (version === current && cached) return cached;
      const rows = getSyncedRows().sort(
        (a, b) =>
          Number(a.sort_order) - Number(b.sort_order) ||
          String(a.created_at).localeCompare(String(b.created_at)) ||
          a.id.localeCompare(b.id),
      );
      if (!rows.length) return undefined;
      // Keep the intended order over partial sync events until the stream catches up.
      // Read view content from sync throughout, so renames and edits remain current.
      if (pendingOrder) {
        const positions = new Map(pendingOrder.ids.map((id, index) => [id, index]));
        const membershipChanged = rows.length !== positions.size || rows.some((row) => !positions.has(row.id));
        const synced = rows.every((row) => Number(row.sort_order) === positions.get(row.id));
        // A new set of views supersedes this move. Matching ID order alone is not
        // enough to finish: old positions can still tie during a partial update.
        if (membershipChanged || synced) pendingOrder = undefined;
        else rows.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
      }
      const views = rows.map((row) => ({
        id: row.id,
        title: String(row.title),
        settings: row.settings as TSettings,
        filter: row.filter as BoardView["filter"],
        sorts: row.sorts as BoardView["sorts"],
        builtIn: false,
      }));
      const chosen = owner
        .getIndexedRows("board_default_views", "project_id", projectId)
        .find(matches)?.default_view_id;
      const defaultViewId = [chosen, views[0]?.id].find((id) => views.some((view) => view.id === id)) as string;
      version = current;
      cached = { views, defaultViewId, ...actions };
      return cached;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      const unsubscribe = owner.subscribeCollections((change) => {
        if (change) reconcilePendingOrder(change);
        if (!change || change.table === "board_views" || change.table === "board_default_views") listener();
      });
      const controller = new AbortController();
      // Reads also clean deleted field options; the normal sync stream publishes any cleanup.
      const refresh = () => {
        void views.list(projectId, record.id, { signal: controller.signal }).catch(() => undefined);
      };
      const stopEvents = subscribeToExtensionEventFeed((event) => {
        if (
          event.projectId === projectId &&
          (record.schemaRefreshEventIds ?? record.refreshEventIds)?.includes(event.id)
        )
          refresh();
      }, owner);
      const stopReset = subscribeToExtensionEventReset((reset) => {
        if (reset.projectId === undefined || reset.projectId === projectId) refresh();
      }, owner);
      refresh();
      return () => {
        listeners.delete(listener);
        stopEvents();
        stopReset();
        controller.abort();
        unsubscribe();
      };
    },
  };
};
