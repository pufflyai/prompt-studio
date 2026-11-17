import type { BoardView } from "@pstdio/sdk/api";
import type { CollectionViewsProvider, CollectionViewsSource } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import {
  type CollectionChange,
  getRuntimeCollections,
  type RuntimeCollections,
  type SyncedRow,
} from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";

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
const createCollectionViewsOwner = <TSettings extends NonNullable<import("@pstdio/sdk/api").BoardView["settings"]>>(
  input: CollectionViewsInput,
  owner: RuntimeCollections,
) => {
  const { projectId, extensionInstanceId: instanceId, localId, record } = input;
  const views = getRuntimeApiClient(owner).views;
  let cached: CollectionViewsSource<TSettings> | undefined;
  let sourceRows: readonly SyncedRow[] | undefined;
  let defaultRow: SyncedRow | undefined;
  let stopRows: (() => void) | undefined;
  let stopQuery: (() => void) | undefined;
  const refreshEventIds = new Set<string>();
  let pendingOrder: { ids: string[]; saved: boolean; snapshotDuringSave: boolean } | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    sourceRows = undefined;
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
      observeRows();
      notify();
      try {
        await views.reorder(projectId, record.id, viewIds);
      } catch (error) {
        if (pendingOrder === order) {
          pendingOrder = undefined;
          notify();
          releaseRows();
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
  const query = () =>
    getDashboardScopedQueries(owner)
      .forScope({ projectId })
      .query({
        id: "collection-views.cleanup",
        resourceKey: record.id,
        dependsOn: [...refreshEventIds],
        read: async (signal) => {
          // Sync owns the rows. This request only cleans obsolete schema/filter options.
          await views.list(projectId, record.id, { signal });
          return null;
        },
      });
  const releaseRows = () => {
    if (listeners.size || pendingOrder) return;
    stopRows?.();
    stopRows = undefined;
  };
  const observeRows = () => {
    if (stopRows) return;
    stopRows = owner.subscribeCollections((change) => {
      if (
        change &&
        (!["board_views", "board_default_views"].includes(change.table) ||
          !change.changes.some(
            ({ value, previousValue }) => (value && matches(value)) || (previousValue && matches(previousValue)),
          ))
      )
        return;
      const previous = cached;
      if (change) reconcilePendingOrder(change);
      sourceRows = undefined;
      if (!change || provider.getSnapshot() !== previous) for (const notify of listeners) notify();
      releaseRows();
    });
  };
  const provider: CollectionViewsProvider<TSettings> = {
    getSnapshot: () => {
      if (!owner.isInitialCollectionsSyncComplete()) return undefined;
      const selected = getSyncedRows();
      const chosenRow = owner.getIndexedRows("board_default_views", "project_id", projectId).find(matches);
      if (
        sourceRows &&
        selected.length === sourceRows.length &&
        selected.every((row, index) => row === sourceRows![index]) &&
        chosenRow === defaultRow
      )
        return cached;
      sourceRows = selected;
      defaultRow = chosenRow;
      const rows = [...selected].sort(
        (a, b) =>
          Number(a.sort_order) - Number(b.sort_order) ||
          String(a.created_at).localeCompare(String(b.created_at)) ||
          a.id.localeCompare(b.id),
      );
      if (!rows.length) {
        pendingOrder = undefined;
        cached = undefined;
        return cached;
      }
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
      const chosen = chosenRow?.default_view_id;
      const defaultViewId = [chosen, views[0]?.id].find((id) => views.some((view) => view.id === id)) as string;
      cached = { views, defaultViewId, ...actions };
      return cached;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      observeRows();
      if (!stopQuery) stopQuery = query().subscribe(() => {});
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stopQuery?.();
          stopQuery = undefined;
          // The ordered-write journal must still see shared snapshots until it reconciles.
          releaseRows();
        }
      };
    },
  };
  return {
    provider,
    retained: () => listeners.size > 0 || Boolean(pendingOrder),
    watch(record: CollectionViewsInput["record"]) {
      for (const id of record.schemaRefreshEventIds ?? record.refreshEventIds ?? []) refreshEventIds.add(id);
      query();
    },
    dispose() {
      stopRows?.();
      stopQuery?.();
      listeners.clear();
    },
  };
};

const owners = createRuntimeState(
  () => new Map<string, ReturnType<typeof createCollectionViewsOwner>>(),
  (cache) => {
    for (const entry of cache.values()) entry.dispose();
    cache.clear();
  },
);

/** One board owner keeps sync authority and optimistic ordering across duplicate views and remounts. */
export const createSharedCollectionViews = <TSettings extends NonNullable<BoardView["settings"]>>(
  input: CollectionViewsInput,
): CollectionViewsProvider<TSettings> => {
  const owner = getRuntimeCollections();
  const cache = owners(owner);
  const key = JSON.stringify([input.projectId, input.extensionInstanceId ?? null, input.localId, input.record.id]);
  let entry = cache.get(key);
  if (!entry) entry = createCollectionViewsOwner(input, owner);
  cache.delete(key);
  cache.set(key, entry);
  entry.watch(input.record);
  const inactive = [...cache].filter(([id, value]) => id !== key && !value.retained());
  for (const [id, value] of inactive.slice(0, Math.max(0, cache.size - 128))) {
    value.dispose();
    cache.delete(id);
  }
  // The board's declared renderer determines its settings shape at this API boundary.
  return entry.provider as unknown as CollectionViewsProvider<TSettings>;
};
