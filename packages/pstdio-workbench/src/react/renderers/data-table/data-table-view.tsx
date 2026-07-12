import { Box, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import {
  DataTable,
  type DataTableColumnRenderer,
  type DataTableColumnStat,
  type DataTableRowAction,
  type RowData,
} from "@pstdio/ui/data-table";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type {
  DataTableRendererQueryResult,
  RegisteredDataTableRendererContribution,
  WorkbenchCore,
  WorkbenchWidgetPlacement,
} from "../../../core";
import {
  buildDataTableRendererData,
  resolveDataTableRendererColumns,
  resolveDataTableRendererStorageKey,
} from "./data-table-view-model";

interface WorkbenchDataTableViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredDataTableRendererContribution;
  placement: WorkbenchWidgetPlacement;
}

const initialResult: DataTableRendererQueryResult = { rows: [] };

export const WorkbenchDataTableView = (props: WorkbenchDataTableViewProps) => {
  const { workbench, contribution, placement } = props;
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(true);
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
  }, [contribution, placement.resource, workbench]);

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
  const openRow = (data: RowData) => {
    const row = model.rowByData.get(data);
    if (!row) return;
    if (contribution.onRowClick) return contribution.onRowClick(row);
    if (row.resource) void workbench.resources.openResource(row.resource, { replaceActive: true });
  };

  if (loading) {
    return (
      <Box p="md">
        <Text textStyle="label/S/regular" color="fg.muted">
          Loading…
        </Text>
      </Box>
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
        rowActions={rowActions}
        onRowClick={openRow}
        isRowInteractive={(data) => {
          const row = model.rowByData.get(data);
          return Boolean(row && (row.resource || contribution.onRowClick));
        }}
        fullWidth
      />
    </Stack>
  );
};
