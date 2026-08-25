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
import { toWorkbenchNavigationTargetResult } from "../host/extension-navigation-target";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  toExtensionCommandResource,
  toWorkbenchResource,
} from "../host/workbench-extension-command";
import {
  panelMenuDeclarationOffsets,
  panelRendererId,
  registerWorkbenchExtensionPanel,
  toWorkbenchCompositionPanelContribution,
} from "./panel-contributions";

type DataTableViewRecord = WorkbenchExtensionMetadata["panels"][number];

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
  const originalRows = new WeakMap<DataTableRendererRow, Parameters<typeof toRow>[0]>();
  const slot = createExtensionSlot({
    id: record.id,
    kind: "dataTableRenderer",
    projectId: context.projectId,
    context: { dataTableRendererId: record.id },
  });
  const run = (commandId: string, params: Record<string, unknown>, resource?: ResourceRef, modeId?: string) =>
    executeWorkbenchExtensionCommand(context, commandId, {
      params: {
        renderer: {
          rendererId: record.id,
          projectId: context.projectId,
          ...(modeId ? { modeId } : {}),
          ...(resource ? { resource: toExtensionCommandResource(resource) } : {}),
          invocation: { placement: "visible" },
        },
        ...params,
      },
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
    executeQuery: async ({ resource, modeId }) => {
      const value = await run(record.queryHandlerId, {}, resource, modeId);
      if (!isQueryResult(value)) return { rows: [] };
      const rows = value.rows.map((row) => {
        const mapped = toRow(row);
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
        context.workbench.renderers.refreshDataTableRenderer(record.id);
      },
    })),
    onRowActivate: record.rowActivationHandlerId
      ? async (row) => {
          const result = await run(record.rowActivationHandlerId!, { row: originalRows.get(row) ?? row }, row.resource);
          const target = toWorkbenchNavigationTargetResult(result);
          if (target) await context.workbench.navigation.openTarget(target);
        }
      : undefined,
  });
};

const registerView = (
  context: WorkbenchExtensionCommandContext,
  panel: DataTableViewRecord,
  index: number,
  menuDeclarationOffset: number,
  resourcePanels: WorkbenchExtensionMetadata["resourcePanels"],
) => {
  const rendererId = panelRendererId(panel, "dataTable");
  if (!rendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: context.workbench,
    path: panel.path,
    contribution: toWorkbenchCompositionPanelContribution({
      panel,
      rendererId,
      declarationIndex: index,
      menuDeclarationOffset: menuDeclarationOffset,
      resourcePanels,
    }),
  });
};

export const registerWorkbenchExtensionDataTableRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionDataTableRendererRecord[],
  panels: DataTableViewRecord[],
  resourcePanels: WorkbenchExtensionMetadata["resourcePanels"] = [],
): Disposable => {
  const disposables: Disposable[] = records.map((record) => registerRenderer(context, record));
  const menuOffsets = panelMenuDeclarationOffsets(panels);
  panels.forEach((panel, index) => {
    const disposable = registerView(context, panel, index, menuOffsets[index]!, resourcePanels);
    if (disposable) disposables.push(disposable);
  });
  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
