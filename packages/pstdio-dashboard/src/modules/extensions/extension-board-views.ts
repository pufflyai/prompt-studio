import type { BoardView, BoardViews } from "@pstdio/sdk/api";
import type { DataTableRendererSettings, Localizable } from "@pstdio/sdk/extensions";
import type { CollectionViewsProvider, CollectionViewsSource, KanbanRendererSettings } from "@pstdio/workbench";
import type {
  WorkbenchExtensionDataTableRendererAdapter,
  WorkbenchExtensionKanbanRendererAdapter,
} from "@pstdio/workbench/extensions";
import { dataTableBuiltInViews, kanbanBuiltInViews } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import {
  getCollectionsVersion,
  getIndexedRows,
  isInitialCollectionsSyncComplete,
  subscribeCollections,
} from "@/lib/sync/collections";
import {
  type ResolvedWorkbenchExtensionMetadata,
  resolveLocalizableString,
} from "@/shared/extensions/extension-localization";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";

type BoardRecord = Parameters<NonNullable<WorkbenchExtensionKanbanRendererAdapter["createViewsProvider"]>>[0];
type TableRecord = Parameters<NonNullable<WorkbenchExtensionDataTableRendererAdapter["createViewsProvider"]>>[0];

interface SharedViewsInput<TSettings> {
  projectId: string;
  record: {
    id: string;
    extensionId: string;
    defaultActiveViewId?: string;
    defaultViews?: { id: string; isDefault?: boolean }[];
    refreshEventIds?: string[];
  };
  metadata: ResolvedWorkbenchExtensionMetadata;
  builtIns: (Omit<CollectionViewsSource<TSettings>["views"][number], "title"> & { title: Localizable<string> })[];
}

/** Saved views for one board or table: its built-in views, then the project's shared views from sync. */
const createSharedViews = <TSettings>(input: SharedViewsInput<TSettings>): CollectionViewsProvider<TSettings> => {
  const { projectId, record, metadata } = input;
  const instanceId = metadata.extensions.find((extension) => extension.id === record.extensionId)?.extensionInstanceId;
  const localId = metadata.views.find((view) => view.id === record.id)?.localId;
  const path = `/v1/projects/${encodeURIComponent(projectId)}/boards/${encodeURIComponent(record.id)}/views`;
  const viewPath = (id: string) =>
    `/v1/projects/${encodeURIComponent(projectId)}/board-views/${encodeURIComponent(id)}`;
  const builtIns = input.builtIns.map((view) => ({
    ...view,
    title: resolveLocalizableString(view.title, record.extensionId),
  }));
  let cached: CollectionViewsSource<TSettings> | undefined;
  let version = -1;
  const matches = (row: Record<string, unknown>) =>
    row.extension_instance_id === instanceId && row.board_id === localId;
  const actions: Omit<CollectionViewsSource<TSettings>, "views" | "defaultViewId"> = {
    // The views API returns the settings of the board or table it was asked about.
    onCreateView: async (body) =>
      (await apiRequest<BoardView>(path, { method: "POST", body })) as BoardView & { settings: TSettings },
    onUpdateView: async (id, body) => {
      await apiRequest(viewPath(id), { method: "PATCH", body });
    },
    onDeleteView: async (id) => {
      await apiRequest(viewPath(id), { method: "DELETE" });
    },
    onSetDefaultView: async (viewId) => {
      await apiRequest(`${path}/default`, { method: "PUT", body: { viewId } });
    },
  };
  return {
    getSnapshot: () => {
      if (!isInitialCollectionsSyncComplete()) return undefined;
      const current = getCollectionsVersion();
      if (version === current && cached) return cached;
      const rows = getIndexedRows("board_views", "project_id", projectId)
        .filter(matches)
        .sort(
          (a, b) =>
            Number(a.sort_order) - Number(b.sort_order) ||
            String(a.created_at).localeCompare(String(b.created_at)) ||
            a.id.localeCompare(b.id),
        );
      const saved = rows.map((row) => ({
        id: row.id,
        title: String(row.title),
        settings: row.settings as TSettings,
        filter: row.filter as BoardView["filter"],
        sorts: row.sorts as BoardView["sorts"],
        builtIn: false,
      }));
      const views = [...builtIns, ...saved];
      const chosen = getIndexedRows("board_default_views", "project_id", projectId).find(matches)?.default_view_id;
      const defaultViewId = [
        chosen,
        record.defaultActiveViewId,
        record.defaultViews?.find((view) => view.isDefault)?.id,
        views[0]?.id,
      ].find((id) => views.some((view) => view.id === id)) as string;
      version = current;
      cached = { views, defaultViewId, ...actions };
      return cached;
    },
    subscribe: (listener) => {
      const unsubscribe = subscribeCollections((change) => {
        if (!change || change.table === "board_views" || change.table === "board_default_views") listener();
      });
      const controller = new AbortController();
      // Reads also clean deleted field options; the normal sync stream publishes any cleanup.
      const refresh = () => {
        void apiRequest<BoardViews>(path, { signal: controller.signal }).catch(() => undefined);
      };
      const stopEvents = subscribeToExtensionEventFeed((event) => {
        if (event.projectId === projectId && record.refreshEventIds?.includes(event.id)) refresh();
      });
      const stopReset = subscribeToExtensionEventReset(refresh);
      refresh();
      return () => {
        stopEvents();
        stopReset();
        controller.abort();
        unsubscribe();
      };
    },
  };
};

export const createSharedBoardViews = (
  projectId: string,
  record: BoardRecord,
  metadata: ResolvedWorkbenchExtensionMetadata,
) =>
  createSharedViews<KanbanRendererSettings>({
    projectId,
    record,
    metadata,
    builtIns: kanbanBuiltInViews(record).views,
  });

export const createSharedTableViews = (
  projectId: string,
  record: TableRecord,
  metadata: ResolvedWorkbenchExtensionMetadata,
) =>
  createSharedViews<DataTableRendererSettings>({
    projectId,
    record,
    metadata,
    builtIns: dataTableBuiltInViews(record).views,
  });
