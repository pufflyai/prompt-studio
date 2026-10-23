import { Box, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import {
  DataTable,
  type DataTableColumnRenderer,
  type DataTableColumnStat,
  type DataTableRowAction,
  DataTableSkeleton,
  type RowData,
  useDataTableViewStore,
} from "@pstdio/ui/data-table";
import { type ReactNode, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import type {
  DataTableRendererQueryResult,
  RegisteredDataTableRendererContribution,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import { getWorkbenchRenderers, rendererReadKey } from "../../../core";
import { acceptRendererPage } from "../../../core/registries/renderers/renderer-page";
import { runUserAction } from "../../../core/shared/run-user-action";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { useWorkbenchResourceActionResolver } from "../../menus/resource-actions";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { tablePageFields } from "../renderer-page-fields";
import { rendererQueryKey } from "../renderer-query-key";
import { RendererReadNotice } from "../renderer-read-notice";
import { usePageParams } from "../use-page-params";
import { useRendererPages } from "../use-renderer-pages";
import { useRendererRead } from "../use-renderer-read";
import { ViewToolbarActions } from "../view-toolbar-actions";
import {
  buildDataTableRendererData,
  resolveDataTableRendererColumns,
  resolveDataTableRendererQueryKey,
  resolveDataTableRendererResourceActions,
  resolveDataTableRendererSelectionActions,
  resolveDataTableRendererStorageKey,
} from "./data-table-view-model";
import { useTablePageColumns } from "./use-table-page-columns";

interface WorkbenchDataTableViewProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
  contribution: RegisteredDataTableRendererContribution;
  placement: WorkbenchPanelInstance;
}
const initialResult: DataTableRendererQueryResult = { rows: [] };
const noopSubscribe = () => () => {};

const DataTableViewFrame = (props: { children: ReactNode }) => (
  <Box position="relative" h="full" minH="0" minW="0" overflow="hidden">
    {/* The table owns scrolling, so its rows must not grow the outer region. */}
    <Stack position="absolute" inset="0" minH="0" minW="0" gap="0" bg="bg" overflow="hidden">
      {props.children}
    </Stack>
  </Box>
);

const requirePageStatistics = (
  result: DataTableRendererQueryResult,
  columns: RegisteredDataTableRendererContribution["columns"],
  hiddenColumns: string[],
) => {
  for (const column of result.columns ?? columns ?? []) {
    if (column.hidden || hiddenColumns.includes(column.id)) continue;
    if (column.stat && result.page?.statistics?.[column.id]?.type !== column.stat.type)
      throw new Error(`The page provider did not return the requested ${column.id} statistic`);
  }
};

const emptyTablePlaceholder = (
  result: DataTableRendererQueryResult,
  search: string,
  grouping: string,
  contribution: RegisteredDataTableRendererContribution,
) => {
  if (result.rows.length || result.page?.groups?.some((group) => group.field === grouping && group.count > 0) || search)
    return undefined;
  return (
    <EmptyState h="full" title={contribution.emptyTitle ?? "No rows"} description={contribution.emptyDescription} />
  );
};

export const WorkbenchDataTableView = (props: WorkbenchDataTableViewProps) => {
  const { workbench, contribution, placement } = props;
  const pageParams = usePageParams(workbench, placement);
  const resolveResourceActions = useWorkbenchResourceActionResolver(workbench);
  const contextValues = useWorkbenchStore(
    workbench.context.store,
    useShallow((state) => Object.fromEntries((contribution.contextKeys ?? []).map((key) => [key, state.values[key]]))),
  );
  const modeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const storageKey = resolveDataTableRendererStorageKey(contribution, placement, contextValues);
  const provider = contribution.viewsProvider;
  const viewsSource = useSyncExternalStore(
    provider?.subscribe ?? noopSubscribe,
    provider?.getSnapshot ?? (() => undefined),
    provider?.getSnapshot ?? (() => undefined),
  );
  const filter = useDataTableViewStore(storageKey, (state) => state.filter, contribution);
  const sorts = useDataTableViewStore(storageKey, (state) => state.sorts, contribution);
  const settings = useDataTableViewStore(storageKey, (state) => state.settings, contribution);
  const paged = contribution.queryMode === "paged";
  const queryKey = resolveDataTableRendererQueryKey(contribution, placement.resource, modeId, contextValues);
  const pageColumns = useTablePageColumns(queryKey, contribution.columns);
  const pages = useRendererPages<DataTableRendererQueryResult["rows"][number]>({
    identity: rendererQueryKey([storageKey, filter, sorts, settings, pageParams]),
    scope: JSON.stringify([storageKey, settings.grouping]),
    fields: tablePageFields(pageColumns.columns, settings),
    initialPageSize: contribution.initialPageSize,
  });
  const read = useRendererRead({
    workbench,
    ownerKey: rendererReadKey(placement),
    queryKey,
    // Paged providers also receive display fields and search before selecting a bounded page.
    refreshKey: rendererQueryKey([filter, sorts, pageParams, ...(paged ? [settings, pages.request, pages.key] : [])]),
    load: async (signal) => {
      const result = await contribution.executeQuery(
        {
          pageParams,
          resource: placement.resource,
          modeId,
          filter,
          sorts,
          settings,
          ...(paged && { page: pages.request }),
        },
        signal,
      );
      if (paged && settings.showStats) requirePageStatistics(result, contribution.columns, settings.hiddenColumns);
      return paged
        ? { ...result, ...pages.accept(acceptRendererPage(result, pages.request), signal) }
        : { ...result, position: undefined };
    },
    subscribe: (refresh) => {
      const invalidate = () => {
        if (!paged || !pages.reset()) refresh();
      };
      const subscription = contribution.subscribe?.(invalidate);
      const events = getWorkbenchRenderers(workbench).onDidRefreshDataTableRenderer((event) => {
        if (event.dataTableRendererId === contribution.id) invalidate();
      });
      return () => {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
        events.dispose();
      };
    },
  });
  const result = read.value ?? initialResult;
  const notice = read.error ? (
    <RendererReadNotice
      error={read.error}
      retry={() => {
        if (!paged || !pages.reset()) void read.retry();
      }}
    />
  ) : null;
  const columns = resolveDataTableRendererColumns(result, contribution.columns);
  pageColumns.accept(read.value, paged);
  const loading =
    (read.loading && !read.value) ||
    pageColumns.pending(read.value?.position?.fields, pages.request.fields, read.error);
  const model = buildDataTableRendererData(result.rows, columns);
  const labels = Object.fromEntries(
    columns.filter((column) => column.label).map((column) => [column.id, column.label!]),
  );
  const descriptions = Object.fromEntries(
    columns.filter((column) => column.description).map((column) => [column.id, column.description!]),
  );
  const icons = Object.fromEntries(
    columns.filter((column) => column.icon).map((column) => [column.id, column.icon as ReactNode]),
  );
  const stats = Object.fromEntries(
    columns.filter((column) => column.stat).map((column) => [column.id, column.stat as DataTableColumnStat]),
  );
  const renderers = Object.fromEntries(
    columns
      .filter((column) => column.renderer)
      .map((column) => [column.id, column.renderer as DataTableColumnRenderer]),
  );
  const rowActions: DataTableRowAction[] = (contribution.rowActions ?? []).map((action) => ({
    label: action.label,
    icon: action.icon as ReactNode,
    destructive: action.destructive,
    onSelect: (data) => {
      const row = model.rowByData.get(data);
      if (row) void runUserAction(workbench, action.label, () => action.run(row));
    },
  }));
  const selectionActions = resolveDataTableRendererSelectionActions(
    (contribution.selectionActions ?? []).map((action) => ({
      ...action,
      run: (rows) => runUserAction(workbench, action.label, () => action.run(rows)),
    })),
    model.rowByData,
  );
  const openRow = (data: RowData) => {
    const row = model.rowByData.get(data);
    if (!row) return;
    if (contribution.onRowActivate) void runUserAction(workbench, "Open row", () => contribution.onRowActivate!(row));
  };
  if (loading) {
    // The table chrome renders instantly: declared columns become real headers
    // and only the row values shimmer until the first query resolves.
    const skeletonColumns = (contribution.columns ?? [])
      .filter((column) => !column.hidden && !settings.hiddenColumns.includes(column.id))
      .map((column) => ({ id: column.id, label: column.label ?? column.id }));
    return (
      <DataTableViewFrame>
        <DataTableSkeleton columns={skeletonColumns.length > 0 ? skeletonColumns : undefined} />
      </DataTableViewFrame>
    );
  }
  if (!read.value && notice) return notice;
  if (provider && !viewsSource)
    return (
      <DataTableViewFrame>
        <DataTableSkeleton />
      </DataTableViewFrame>
    );

  return (
    <DataTableViewFrame>
      {notice}
      <DataTable
        page={pages.controls(result.page, read.loading, paged, read.value?.position)}
        itemLabel={
          contribution.resourceKind ? workbench.resources.getKind(contribution.resourceKind)?.label : undefined
        }
        toolbarActions={
          <ViewToolbarActions
            workbench={workbench}
            actions={contribution.toolbarActions}
            context={{ resource: placement.resource }}
            renderParamField={props.renderParamField}
          />
        }
        contentPlaceholder={emptyTablePlaceholder(result, pages.search, settings.grouping, contribution)}
        data={model.data}
        getRowId={(data) => model.rowByData.get(data)?.id ?? ""}
        toolbarStorageKey={storageKey}
        viewsSource={viewsSource}
        defaultSettings={contribution.defaultSettings}
        defaultFilter={contribution.defaultFilter}
        defaultSorts={contribution.defaultSorts}
        defaultViews={contribution.defaultViews}
        defaultActiveViewId={contribution.defaultActiveViewId}
        columnTypes={Object.fromEntries(columns.flatMap((column) => (column.type ? [[column.id, column.type]] : [])))}
        filterableColumns={columns.filter((column) => column.filterable !== false).map((column) => column.id)}
        groupableColumns={columns.filter((column) => column.groupable).map((column) => column.id)}
        compactHeaders={labels}
        columnDescriptions={descriptions}
        columnIcons={icons}
        hiddenColumns={columns.filter((column) => column.hidden).map((column) => column.id)}
        columnStats={stats}
        columnRenderers={renderers}
        initialPageSize={contribution.initialPageSize}
        pageSizeOptions={contribution.pageSizeOptions}
        selectionMode={contribution.selectionMode}
        selectionActions={selectionActions}
        rowActions={rowActions}
        getRowActions={(data) => resolveDataTableRendererResourceActions(data, model.rowByData, resolveResourceActions)}
        onRowClick={openRow}
        isRowInteractive={(data) => {
          const row = model.rowByData.get(data);
          return Boolean(row && contribution.onRowActivate);
        }}
        getCellContextMenuActions={(context) =>
          resolveDataTableRendererResourceActions(context.row, model.rowByData, resolveResourceActions)
        }
        fullWidth
      />
    </DataTableViewFrame>
  );
};
