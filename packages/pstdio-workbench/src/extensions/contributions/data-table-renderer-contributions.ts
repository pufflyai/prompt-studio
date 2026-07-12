import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type {
  DataTableRendererColumn,
  DataTableRendererQueryResult,
  DataTableRendererRow,
  Disposable,
  ResourceRef,
} from "../../core";
import { WorkbenchIcon } from "../../react";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  toWorkbenchResource,
} from "../host/workbench-extension-command";
import { resolveWorkbenchViewArea } from "../shared/workbench-targets";

type DataTableViewRecord = WorkbenchExtensionMetadata["views"][number];

const localize = (value: unknown, fallback = "") => text(value as Parameters<typeof text>[0], fallback);

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
  rows: Array<{ id: string; values: Record<string, unknown>; resource?: Parameters<typeof toWorkbenchResource>[0] }>;
  columns?: WorkbenchExtensionDataTableRendererRecord["columns"];
} => Boolean(value && typeof value === "object" && Array.isArray((value as { rows?: unknown }).rows));

const toRow = (row: {
  id: string;
  values: Record<string, unknown>;
  resource?: Parameters<typeof toWorkbenchResource>[0];
}): DataTableRendererRow => ({
  id: row.id,
  values: row.values,
  resource: row.resource ? toWorkbenchResource(row.resource) : undefined,
});

const registerRenderer = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataTableRendererRecord,
) => {
  const slot = createExtensionSlot({
    id: record.id,
    kind: "dataTableRenderer",
    projectId: context.projectId,
    context: { dataTableRendererId: record.id },
  });
  const run = (commandId: string, params: Record<string, unknown>, resource?: ResourceRef) =>
    executeWorkbenchExtensionCommand(context, commandId, {
      params,
      resource,
      slot,
      metadata: { dataTableRendererId: record.id },
    });

  return context.workbench.renderers.registerDataTableRenderer({
    id: record.id,
    title: localize(record.title, record.id),
    resourceKind: record.resourceKind,
    columns: record.columns?.map(toColumn),
    initialPageSize: record.initialPageSize,
    pageSizeOptions: record.pageSizeOptions,
    emptyTitle: record.emptyTitle ? localize(record.emptyTitle) : undefined,
    emptyDescription: record.emptyDescription ? localize(record.emptyDescription) : undefined,
    executeQuery: async ({ resource, modeId }) => {
      const value = await run(
        record.queryCommandId,
        {
          rendererId: record.id,
          projectId: context.projectId,
          modeId,
          resource: resource
            ? {
                type: resource.kind,
                id: resource.id ?? resource.uri,
                label: resource.label,
                metadata: resource.metadata,
              }
            : undefined,
        },
        resource,
      );
      if (!isQueryResult(value)) return { rows: [] };
      return {
        rows: value.rows.map(toRow),
        columns: value.columns?.map(toColumn),
      } satisfies DataTableRendererQueryResult;
    },
    rowActions: record.rowActions?.map((action) => ({
      id: action.id,
      label: localize(action.label, action.id),
      icon: action.icon ? createElement(WorkbenchIcon, { name: action.icon, size: 16 }) : undefined,
      destructive: action.destructive,
      run: (row) => run(action.commandId, { rowId: row.id }, row.resource).then(() => undefined),
    })),
  });
};

const registerView = (context: WorkbenchExtensionCommandContext, view: DataTableViewRecord) => {
  if (!view.dataTableRendererId) return undefined;
  return context.workbench.layout.registerWidget({
    id: view.id,
    title: text(view.title, view.id),
    area: view.surface === "modal" ? "overlay" : resolveWorkbenchViewArea(view.target),
    rendererId: view.dataTableRendererId,
    singleton: true,
    resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
  });
};

export const registerWorkbenchExtensionDataTableRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionDataTableRendererRecord[],
  views: DataTableViewRecord[],
): Disposable => {
  const disposables: Disposable[] = records.map((record) => registerRenderer(context, record));
  for (const view of views) {
    const disposable = registerView(context, view);
    if (disposable) disposables.push(disposable);
  }
  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
