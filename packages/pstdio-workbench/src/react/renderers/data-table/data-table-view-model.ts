import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceContextAction } from "@pstdio/ui";
import type { DataTableSelectionAction, RowData } from "@pstdio/ui/data-table";
import type { ReactNode } from "react";
import type {
  DataTableRendererColumn,
  DataTableRendererContribution,
  DataTableRendererQueryResult,
  DataTableRendererRow,
  DataTableRendererSelectionAction,
  WorkbenchPanelInstance,
} from "../../../core";
import { rendererQueryKey } from "../renderer-query-key";
export const resolveDataTableRendererQueryKey = (
  contribution: Pick<DataTableRendererContribution, "id" | "contextKeys">,
  resource: WorkbenchPanelInstance["resource"],
  modeId: string | undefined,
  contextValues: Record<string, unknown>,
) =>
  rendererQueryKey([
    contribution.id,
    resourceKey(resource),
    modeId,
    contribution.contextKeys?.map((key) => contextValues[key] ?? null),
  ]);

export const resolveDataTableRendererColumns = (
  result: DataTableRendererQueryResult,
  contributionColumns?: DataTableRendererColumn[],
) => {
  if (result.columns) return result.columns;
  if (contributionColumns) return contributionColumns;
  const firstRow = result.rows[0];
  return firstRow ? Object.keys(firstRow.values).map((id): DataTableRendererColumn => ({ id })) : [];
};
const rendererRow = Symbol("renderer row");
type RowByData = Pick<WeakMap<RowData, DataTableRendererRow>, "get">;
const rowByData: RowByData = {
  get: (data) => (data as RowData & { [rendererRow]?: DataTableRendererRow })[rendererRow],
};

export const buildDataTableRendererData = (rows: DataTableRendererRow[], columns: DataTableRendererColumn[]) => {
  const data = rows.map((row) => {
    const values = Object.fromEntries(columns.map((column) => [column.id, row.values[column.id]]));
    // The adapter row owns its identity even when selection outlives the displayed page.
    // Metadata stays out of columns, spread copies, and serialized values.
    Object.defineProperty(values, rendererRow, { value: row });
    return values;
  });
  return { data, rowByData };
};
export const resolveDataTableRendererSelectionActions = (
  actions: DataTableRendererSelectionAction[],
  rowByData: RowByData,
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
export const resolveDataTableRendererResourceActions = (
  data: RowData,
  rowByData: RowByData,
  resolveResourceActions: (resource: NonNullable<DataTableRendererRow["resource"]>) => ResourceContextAction[],
) => {
  const resource = rowByData.get(data)?.resource;
  if (!resource) return [];
  return resolveResourceActions(resource)
    .filter((action) => !action.isDisabled)
    .map((action) => ({
      label: action.label,
      icon: action.icon,
      onSelect: (_context?: unknown) => void action.onClick?.(),
    }));
};
export const resolveDataTableRendererStorageKey = (
  contribution: Pick<DataTableRendererContribution, "id" | "contextKeys">,
  placement: WorkbenchPanelInstance,
  contextValues: Record<string, unknown>,
) => {
  const identity = resourceKey(placement.resource) ?? placement.resource?.id ?? "unscoped";
  const scope = contribution.contextKeys?.map((key) => contextValues[key] ?? null);
  const key = `pstdio:workbench:dataTableRenderer:${contribution.id}:${placement.instanceId}:${identity}`;
  return scope?.length ? `${key}:${rendererQueryKey(scope)}` : key;
};
