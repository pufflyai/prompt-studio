import type { DataTableRendererSettings } from "@pstdio/sdk/extensions";
import { dataTableBuiltInViews, type WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type {
  CollectionViewsProvider,
  DataTableRendererColumn,
  DataTableRendererQueryResult,
  DataTableRendererRow,
  Disposable,
  ResourceRef,
} from "../../core";
import { WorkbenchIcon } from "../../react";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { createExtensionSlot, executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";
import { mapViewToolbarActions } from "./view-toolbar-actions";

const localize = (value: unknown, fallback = "") => text(value as Parameters<typeof text>[0], fallback);

export interface WorkbenchExtensionDataTableRendererAdapter {
  resolveRowResource?: (
    record: WorkbenchExtensionDataTableRendererRecord,
    row: { id: string; values: Record<string, unknown>; resource?: ResourceRef },
  ) => ResourceRef | undefined;
  /** Shared saved views for the table, such as the dashboard's project views. */
  createViewsProvider?: (
    record: WorkbenchExtensionDataTableRendererRecord,
  ) => CollectionViewsProvider<DataTableRendererSettings>;
}
type WireColumn = NonNullable<WorkbenchExtensionDataTableRendererRecord["columns"]>[number];
const toColumn = (column: WireColumn): DataTableRendererColumn => ({
  ...column,
  label: localize(column.label, column.id),
  description: column.description ? localize(column.description) : undefined,
  icon: column.icon ? createElement(WorkbenchIcon, { name: column.icon, size: 14 }) : undefined,
});
const isQueryResult = (
  value: unknown,
): value is {
  rows: Array<{
    id: string;
    values: Record<string, unknown>;
    resource?: ResourceRef;
  }>;
  columns?: WorkbenchExtensionDataTableRendererRecord["columns"];
} =>
  Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray(
        (
          value as {
            rows?: unknown;
          }
        ).rows,
      ),
  );
const toRow = (row: { id: string; values: Record<string, unknown>; resource?: ResourceRef }): DataTableRendererRow => ({
  id: row.id,
  values: row.values,
  resource: row.resource ? row.resource : undefined,
});
const registerRenderer = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataTableRendererRecord,
  adapter: WorkbenchExtensionDataTableRendererAdapter,
) => {
  const builtIns = dataTableBuiltInViews(record);
  const originalRows = new WeakMap<DataTableRendererRow, Parameters<typeof toRow>[0]>();
  const slot = createExtensionSlot({
    id: record.id,
    kind: "dataTableRenderer",
    projectId: context.projectId,
    context: { dataTableRendererId: record.id },
  });
  const run = (
    commandId: string,
    params: Record<string, unknown>,
    resource?: ResourceRef,
    modeId?: string,
    signal?: AbortSignal,
  ) =>
    executeWorkbenchExtensionCommand(context, commandId, {
      params: {
        renderer: {
          rendererId: record.id,
          projectId: context.projectId,
          ...(modeId ? { modeId } : {}),
          ...(resource ? { resource: resource } : {}),
          invocation: { placement: "visible" },
        },
        ...params,
      },
      resource,
      signal,
      slot,
      metadata: { dataTableRendererId: record.id },
    });
  return context.workbench.views.registerView({
    id: record.id,
    title: localize(record.title, record.id),
    icon: record.icon,
    body: {
      kind: "dataTable",
      resourceKind: record.resourceKind,
      toolbarActions: mapViewToolbarActions(record),
      columns: record.columns?.map(toColumn),
      initialPageSize: record.initialPageSize,
      pageSizeOptions: record.pageSizeOptions,
      defaultSettings: builtIns.settings,
      defaultFilter: record.defaultFilter,
      defaultSorts: record.defaultSorts,
      defaultViews: builtIns.views.map((view) => ({ ...view, title: localize(view.title, view.id) })),
      defaultActiveViewId: record.defaultActiveViewId,
      viewsProvider: adapter.createViewsProvider?.(record),
      selectionMode: record.selectionMode,
      selectionActions: record.selectionActions?.map((action) => ({
        id: action.id,
        label: localize(action.label, action.id),
        icon: action.icon ? createElement(WorkbenchIcon, { name: action.icon, size: 16 }) : undefined,
        destructive: action.destructive,
        run: (rows) => run(action.commandId, { rowIds: rows.map((row) => row.id) }).then(() => undefined),
      })),
      emptyTitle: record.emptyTitle ? localize(record.emptyTitle) : undefined,
      emptyDescription: record.emptyDescription ? localize(record.emptyDescription) : undefined,
      executeQuery: async ({ resource, modeId, filter, sorts, settings }, signal) => {
        const value = await run(record.queryHandlerId, { filter, sorts, settings }, resource, modeId, signal);
        if (!isQueryResult(value)) return { rows: [] };
        const rows = value.rows.map((row) => {
          const mapped = toRow(row);
          if (adapter.resolveRowResource) mapped.resource = adapter.resolveRowResource(record, row);
          originalRows.set(mapped, row);
          return mapped;
        });
        return {
          rows,
          columns: value.columns?.map(toColumn),
        } satisfies DataTableRendererQueryResult;
      },
      rowActions: record.rowActions?.map((action) => ({
        id: action.id,
        label: localize(action.label, action.id),
        icon: action.icon ? createElement(WorkbenchIcon, { name: action.icon, size: 16 }) : undefined,
        destructive: action.destructive,
        run: async (row) => {
          await run(action.commandId, { rowId: row.id }, row.resource);
          context.workbench.views.refreshView(record.id);
        },
      })),
      onRowActivate: record.rowActivationHandlerId
        ? async (row) => {
            await run(record.rowActivationHandlerId!, { row: originalRows.get(row) ?? row }, row.resource);
          }
        : undefined,
    },
  });
};
export const registerWorkbenchExtensionDataTableRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionDataTableRendererRecord[],
  adapter: WorkbenchExtensionDataTableRendererAdapter = {},
): Disposable => {
  const disposables: Disposable[] = records.map((record) => registerRenderer(context, record, adapter));
  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
