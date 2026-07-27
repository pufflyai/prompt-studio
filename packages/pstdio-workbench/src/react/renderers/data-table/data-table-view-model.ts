import type {
  DataTableRendererColumn,
  DataTableRendererQueryResult,
  DataTableRendererRow,
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

export const resolveDataTableRendererStorageKey = (rendererId: string, placement: WorkbenchPanelInstance) => {
  const resourceKey = placement.resource?.uri ?? placement.resource?.id ?? "unscoped";
  return `pstdio:workbench:dataTableRenderer:${rendererId}:${placement.instanceId}:${resourceKey}`;
};
