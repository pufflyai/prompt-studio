import { Stack } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import { EmptyState } from "@pstdio/ui";
import {
  DataTable,
  type DataTableColumnRenderer,
  type DataTableColumnStat,
  type DataTableRowAction,
  DataTableSkeleton,
  type RowData,
} from "@pstdio/ui/data-table";
import type { ReactNode } from "react";
import type {
  DataTableRendererQueryResult,
  RegisteredDataTableRendererContribution,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import { getWorkbenchRenderers, rendererReadKey } from "../../../core";
import { useWorkbenchResourceActionResolver } from "../../menus/resource-actions";
import { RendererReadNotice } from "../renderer-read-notice";
import { useRendererRead } from "../use-renderer-read";
import {
  buildDataTableRendererData,
  resolveDataTableRendererColumns,
  resolveDataTableRendererResourceActions,
  resolveDataTableRendererSelectionActions,
  resolveDataTableRendererStorageKey,
} from "./data-table-view-model";

interface WorkbenchDataTableViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredDataTableRendererContribution;
  placement: WorkbenchPanelInstance;
}
const initialResult: DataTableRendererQueryResult = { rows: [] };
export const WorkbenchDataTableView = (props: WorkbenchDataTableViewProps) => {
  const { workbench, contribution, placement } = props;
  const resolveResourceActions = useWorkbenchResourceActionResolver(workbench);
  const read = useRendererRead({
    workbench,
    ownerKey: rendererReadKey(placement),
    queryKey: JSON.stringify([contribution.id, resourceKey(placement.resource), workbench.modes.getActiveModeId()]),

    load: (signal) =>
      contribution.executeQuery({ resource: placement.resource, modeId: workbench.modes.getActiveModeId() }, signal),
    subscribe: (refresh) => {
      const subscription = contribution.subscribe?.(refresh);
      const events = getWorkbenchRenderers(workbench).onDidRefreshDataTableRenderer((event) => {
        if (event.dataTableRendererId === contribution.id) refresh();
      });
      return () => {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
        events.dispose();
      };
    },
  });
  const result = read.value ?? initialResult;
  const loading = read.loading && !read.value;
  const columns = resolveDataTableRendererColumns(result, contribution.columns);
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
      if (row) void action.run(row);
    },
  }));
  const selectionActions = resolveDataTableRendererSelectionActions(
    contribution.selectionActions ?? [],
    model.rowByData,
  );
  const openRow = (data: RowData) => {
    const row = model.rowByData.get(data);
    if (!row) return;
    if (contribution.onRowActivate) void Promise.resolve(contribution.onRowActivate(row)).catch(() => undefined);
  };
  if (loading) {
    // The table chrome renders instantly: declared columns become real headers
    // and only the row values shimmer until the first query resolves.
    const skeletonColumns = (contribution.columns ?? [])
      .filter((column) => !column.hidden)
      .map((column) => ({ id: column.id, label: column.label ?? column.id }));
    return (
      <Stack h="full" minH="0" minW="0" gap="0" bg="bg" overflow="hidden">
        <DataTableSkeleton columns={skeletonColumns.length > 0 ? skeletonColumns : undefined} />
      </Stack>
    );
  }
  if (!read.value && read.error) return <RendererReadNotice error={read.error} retry={read.retry} />;
  if (result.rows.length === 0) {
    return (
      <Stack h="full" gap="0">
        {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
        <EmptyState h="full" title={contribution.emptyTitle ?? "No rows"} description={contribution.emptyDescription} />
      </Stack>
    );
  }
  return (
    <Stack h="full" minH="0" minW="0" gap="0" bg="bg" overflow="hidden">
      {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
      <DataTable
        data={model.data}
        getRowId={(data) => model.rowByData.get(data)?.id ?? ""}
        toolbarStorageKey={resolveDataTableRendererStorageKey(contribution.id, placement)}
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
    </Stack>
  );
};
