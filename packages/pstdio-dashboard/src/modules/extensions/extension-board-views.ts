import type { BoardView, BoardViews } from "@pstdio/sdk/api";
import { DEFAULT_KANBAN_RENDERER_SETTINGS } from "@pstdio/ui/kanban-renderer";
import type { KanbanRendererViewsProvider, KanbanRendererViewsSource } from "@pstdio/workbench";
import type { WorkbenchExtensionKanbanRendererAdapter } from "@pstdio/workbench/extensions";
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

type BoardRecord = Parameters<NonNullable<WorkbenchExtensionKanbanRendererAdapter["createViewsProvider"]>>[0];
export const createSharedBoardViews = (
  projectId: string,
  record: BoardRecord,
  metadata: ResolvedWorkbenchExtensionMetadata,
): KanbanRendererViewsProvider => {
  const instanceId = metadata.extensions.find((extension) => extension.id === record.extensionId)?.extensionInstanceId;
  const localId = metadata.views.find((view) => view.id === record.id)?.localId;
  const path = `/v1/projects/${encodeURIComponent(projectId)}/boards/${encodeURIComponent(record.id)}/views`;
  const viewPath = (id: string) =>
    `/v1/projects/${encodeURIComponent(projectId)}/board-views/${encodeURIComponent(id)}`;
  const statusFields = record.attributes?.filter((field) => field.type.kind === "status") ?? [];
  const settings = {
    ...DEFAULT_KANBAN_RENDERER_SETTINGS,
    ...(statusFields.length === 1 ? { columnGrouping: statusFields[0].id } : {}),
    ...record.defaultSettings,
  };
  const builtIns = (
    record.defaultViews?.length
      ? record.defaultViews
      : [{ id: "default", title: "All", settings, filters: record.defaultFilters ?? {} }]
  ).map((view) => ({ ...view, title: resolveLocalizableString(view.title, record.extensionId), builtIn: true }));
  let cached: KanbanRendererViewsSource | undefined;
  let version = -1;
  const matches = (row: Record<string, unknown>) =>
    row.extension_instance_id === instanceId && row.board_id === localId;
  const actions = {
    onCreateView: async (input: Parameters<KanbanRendererViewsSource["onCreateView"]>[0]) => {
      return await apiRequest<BoardView>(path, { method: "POST", body: input });
    },
    onUpdateView: async (id: string, input: Parameters<KanbanRendererViewsSource["onUpdateView"]>[1]) => {
      await apiRequest(viewPath(id), { method: "PATCH", body: input });
    },
    onDeleteView: async (id: string) => {
      await apiRequest(viewPath(id), { method: "DELETE" });
    },
    onSetDefaultView: async (viewId: string | null) => {
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
        settings: row.settings as KanbanRendererViewsSource["views"][number]["settings"],
        filters: row.filters as Record<string, string[]>,
        builtIn: false,
      }));
      const views = [...builtIns, ...saved];
      const chosen = getIndexedRows("board_default_views", "project_id", projectId).find(matches)?.default_view_id;
      const defaultViewId = [chosen, record.defaultActiveViewId, views[0].id].find((id) =>
        views.some((view) => view.id === id),
      ) as string;
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
      void apiRequest<BoardViews>(path, { signal: controller.signal }).catch(() => undefined);
      return () => {
        controller.abort();
        unsubscribe();
      };
    },
  };
};
