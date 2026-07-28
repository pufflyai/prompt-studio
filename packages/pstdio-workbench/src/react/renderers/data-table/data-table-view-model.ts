import type { DataTableSelectionAction, RowData } from "@pstdio/ui/data-table";
import type { ReactNode } from "react";
import type {
  DataTableRendererColumn,
  DataTableRendererQueryResult,
  DataTableRendererRow,
  DataTableRendererSelectionAction,
  WorkbenchPanelInstance,
} from "../../../core";

export const resolveDataTableRendererColumns = (
  result: DataTableRendererQueryResult,
  contributionColumns?: DataTableRendererColumn[],
) => {
  if (result.columns) return result.columns;
  if (contributionColumns) return contributionColumns;
  const firstRow = result.rows[0];
  return firstRow ? Object.keys(firstRow.values).map((id): DataTableRendererColumn => ({ id })) : [];
};

export const buildDataTableRendererData = (rows: DataTableRendererRow[], columns: DataTableRendererColumn[]) => {
  const rowByData = new WeakMap<Record<string, unknown>, DataTableRendererRow>();
  const data = rows.map((row) => {
    const values = Object.fromEntries(columns.map((column) => [column.id, row.values[column.id]]));
    rowByData.set(values, row);
    return values;
  });
  return { data, rowByData };
};

export const resolveDataTableRendererSelectionActions = (
  actions: DataTableRendererSelectionAction[],
  rowByData: WeakMap<RowData, DataTableRendererRow>,
): DataTableSelectionAction[] =>
  actions.map((action) => ({
    label: action.label,
    icon: action.icon as ReactNode,
    destructive: action.destructive,
    onSelect: (data) => {
      const rows = data.flatMap((row) => {
        const rendererRow = rowByData.get(row);
        return rendererRow ? [rendererRow] : [];
      });
      void action.run(rows);
    },
  }));

export const resolveDataTableRendererStorageKey = (rendererId: string, placement: WorkbenchPanelInstance) => {
  const resourceKey = placement.resource?.uri ?? placement.resource?.id ?? "unscoped";
  return `pstdio:workbench:dataTableRenderer:${rendererId}:${placement.instanceId}:${resourceKey}`;
};
