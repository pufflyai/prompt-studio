import { Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import {
  DataTable,
  type DataTableColumnRenderer,
  type DataTableColumnStat,
  type DataTableRowAction,
  DataTableSkeleton,
  type RowData,
} from "@pstdio/ui/data-table";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type {
  DataTableRendererQueryResult,
  RegisteredDataTableRendererContribution,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import {
  buildDataTableRendererData,
  resolveDataTableRendererColumns,
  resolveDataTableRendererSelectionActions,
  resolveDataTableRendererStorageKey,
} from "./data-table-view-model";

interface WorkbenchDataTableViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredDataTableRendererContribution;
  placement: WorkbenchPanelInstance;
}

const initialResult: DataTableRendererQueryResult = { rows: [] };

// Tabs unmount when they deactivate, so without a cache every revisit flashes a
// loading state. The last result renders instantly while the fresh query runs.
const lastResults = new Map<string, DataTableRendererQueryResult>();

const resultCacheKey = (contributionId: string, placement: WorkbenchPanelInstance) =>
  `${contributionId} ${placement.resource?.uri ?? ""}`;

export const WorkbenchDataTableView = (props: WorkbenchDataTableViewProps) => {
  const { workbench, contribution, placement } = props;
  const cacheKey = resultCacheKey(contribution.id, placement);
  const [result, setResult] = useState(() => lastResults.get(cacheKey) ?? initialResult);
  const [loading, setLoading] = useState(() => !lastResults.has(cacheKey));
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const runQuery = () => {
      requestRef.current += 1;
      const requestId = requestRef.current;
      Promise.resolve(
        contribution.executeQuery({ resource: placement.resource, modeId: workbench.modes.getActiveModeId() }),
      ).then((next) => {
        if (cancelled || requestRef.current !== requestId) return;
        lastResults.set(cacheKey, next);
        setResult(next);
        setLoading(false);
      });
    };
    runQuery();
    const subscription = contribution.subscribe?.(runQuery);
    const refreshSubscription = workbench.renderers.onDidRefreshDataTableRenderer((event) => {
      if (event.dataTableRendererId === contribution.id) runQuery();
    });
    return () => {
      cancelled = true;
      if (typeof subscription === "function") subscription();
      else subscription?.dispose();
      refreshSubscription.dispose();
    };
  }, [cacheKey, contribution, placement.resource, workbench]);

  const columns = resolveDataTableRendererColumns(result, contribution.columns);
  const model = useMemo(() => buildDataTableRendererData(result.rows, columns), [columns, result.rows]);
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

  if (result.rows.length === 0) {
    return (
      <EmptyState h="full" title={contribution.emptyTitle ?? "No rows"} description={contribution.emptyDescription} />
    );
  }

  return (
    <Stack h="full" minH="0" minW="0" gap="0" bg="bg" overflow="hidden">
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
        onRowClick={openRow}
        isRowInteractive={(data) => {
          const row = model.rowByData.get(data);
          return Boolean(row && contribution.onRowActivate);
        }}
        fullWidth
      />
    </Stack>
  );
};
