import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import type { DataRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type { DataRendererContribution, DataRendererQueryState, Disposable, ResourceRef } from "../../core";
import { WorkbenchIcon } from "../../react";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  toWorkbenchResource,
} from "../host/workbench-extension-command";

type DataRendererAttributes = DataRendererContribution["attributes"];
type StaticDataRendererAttributes = Exclude<DataRendererAttributes, { getSnapshot(): unknown }>;
type DataRendererAttribute = StaticDataRendererAttributes[number];
type DataRendererRow = Awaited<ReturnType<DataRendererContribution["executeQuery"]>>[number];
type BoardColumnConfig = ReturnType<NonNullable<DataRendererContribution["getBoardColumnConfig"]>>;
type RowAction = NonNullable<WorkbenchExtensionDataRendererRecord["rowActions"]>[number];
type QueryResult = {
  attributes?: WorkbenchExtensionDataRendererRecord["attributes"];
  boardColumnConfigs?: ColumnConfigRecord;
  rows?: unknown[];
};
type ColumnConfigRecord = Record<string, WireBoardColumnConfig>;

interface MutableAttributeSource {
  source: DataRendererAttributes;
  set(attributes: WorkbenchExtensionDataRendererRecord["attributes"] | undefined): void;
}

const isQueryResult = (value: unknown): value is QueryResult =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const createMutableAttributeSource = (
  initial: WorkbenchExtensionDataRendererRecord["attributes"] | undefined,
): MutableAttributeSource => {
  let snapshot = toWorkbenchAttributes(initial);
  const listeners = new Set<() => void>();
  return {
    source: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    set(attributes) {
      snapshot = toWorkbenchAttributes(attributes);
      for (const listener of listeners) listener();
    },
  };
};

const toWorkbenchAttributes = (
  attributes: WorkbenchExtensionDataRendererRecord["attributes"] | undefined,
): DataRendererAttribute[] =>
  (attributes ?? []).map((attribute) => ({
    ...attribute,
    label: text(attribute.label, attribute.id),
    type:
      attribute.type.kind === "enum" || attribute.type.kind === "enum-multi"
        ? {
            ...attribute.type,
            options: attribute.type.options.map((option) => ({ ...option, label: text(option.label, option.value) })),
          }
        : attribute.type,
  }));

const toWorkbenchRow = (row: unknown): DataRendererRow => {
  const candidate = row as DataRendererRow & { resource?: { type?: string; id?: string } };
  const resource =
    candidate.resource && typeof candidate.resource === "object" && "type" in candidate.resource
      ? toWorkbenchResource(candidate.resource as Parameters<typeof toWorkbenchResource>[0])
      : candidate.resource;
  return { ...candidate, resource } as DataRendererRow;
};

const mergeParams = (...items: Array<Record<string, unknown> | undefined>) =>
  Object.assign({}, ...items.filter((item): item is Record<string, unknown> => Boolean(item)));

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const hasCommandParameters = (params: Record<string, unknown> | undefined) => Object.keys(params ?? {}).length > 0;

const createBoardActionIcon = (icon: string | undefined) => {
  const BoardActionIcon = (props: { size?: number | string }) =>
    createElement(WorkbenchIcon, { name: icon ?? "MoreHorizontal", ...props });
  return BoardActionIcon;
};

const toWorkbenchBoardColumnConfig = (config: WireBoardColumnConfig | undefined) =>
  ({
    color: config?.color,
    canDragIn: config?.canDragIn,
    canDragOut: config?.canDragOut,
    canCreate: config?.canCreate,
    actions: config?.actions?.map((action) => ({
      id: action.id,
      label: text(action.label, action.id),
      icon: createBoardActionIcon(action.icon),
    })),
  }) satisfies BoardColumnConfig;

const createRowActionIcon = (icon: string | undefined) =>
  icon ? createElement(WorkbenchIcon, { name: icon, size: 16 }) : undefined;

const createDataRendererSlot = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
) =>
  createExtensionSlot({
    id: record.id,
    kind: "dataRenderer",
    projectId: context.projectId,
    context: { dataRendererId: record.id },
  });

const executeDataRendererCommand = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  commandId: string,
  params: Record<string, unknown>,
  resource?: ResourceRef,
) =>
  executeWorkbenchExtensionCommand(context, commandId, {
    params,
    resource: resource ?? context.workbench.getPrimaryResource(),
    slot: createDataRendererSlot(context, record),
    metadata: { dataRendererId: record.id },
  });

const dataRendererRowActionCommandId = (record: WorkbenchExtensionDataRendererRecord, action: RowAction) =>
  `workbench.extension.dataRenderer.${record.id}.rowAction.${action.id}`;

const rowResourceUri = (kind: string, id: string) =>
  `pstdio://extension-resource/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;

const isWorkbenchResource = (resource: unknown): resource is ResourceRef =>
  Boolean(resource && typeof resource === "object" && typeof (resource as { kind?: unknown }).kind === "string");

const isExtensionResource = (resource: unknown): resource is Parameters<typeof toWorkbenchResource>[0] =>
  Boolean(
    resource &&
      typeof resource === "object" &&
      typeof (resource as { type?: unknown }).type === "string" &&
      typeof (resource as { id?: unknown }).id === "string",
  );

const toRowResource = (record: WorkbenchExtensionDataRendererRecord, row: DataRendererRow): ResourceRef | undefined => {
  const { resource } = row;
  if (isWorkbenchResource(resource)) return resource;
  if (isExtensionResource(resource)) return toWorkbenchResource(resource);
  if (!record.resourceKind) return undefined;

  return {
    kind: record.resourceKind,
    uri: rowResourceUri(record.resourceKind, row.id),
    id: row.id,
    label: row.title,
  };
};

const registerRowActionCommands = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
) =>
  (record.rowActions ?? []).map((action) => {
    const target = context.workbench.commands.getCommand(action.commandId)?.command;
    return context.workbench.commands.registerCommand(
      {
        id: dataRendererRowActionCommandId(record, action),
        label: text(action.label, action.id),
        icon: action.icon,
        params: target?.params,
      },
      {
        execute: (args, executionContext) =>
          executeDataRendererCommand(
            context,
            record,
            action.commandId,
            mergeParams(asParams(args)),
            executionContext?.resource,
          ),
      },
    );
  });

const runRowAction = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  action: RowAction,
  row: DataRendererRow,
) => {
  const commandId = dataRendererRowActionCommandId(record, action);
  const command = context.workbench.commands.getCommand(commandId);
  const args = { rowId: row.id };
  const resource = toRowResource(record, row);
  const executionContext = resource ? { resource } : undefined;
  const label = text(action.label, action.id);

  if (command && hasCommandParameters(command.command.params)) {
    context.workbench.commandPalette.requestParams({ record: command, label, args, context: executionContext });
    return;
  }

  if (command)
    return context.workbench.commands.executeCommand(command.command.id, args, executionContext).then(() => undefined);

  return executeDataRendererCommand(context, record, action.commandId, args, resource).then(() => undefined);
};

export const registerWorkbenchExtensionDataRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: readonly WorkbenchExtensionDataRendererRecord[],
) => {
  const disposables: Disposable[] = [];

  for (const record of records) {
    const attributes = createMutableAttributeSource(record.attributes);
    let columnConfigs: ColumnConfigRecord | undefined;

    disposables.push(...registerRowActionCommands(context, record));
    disposables.push(
      context.workbench.renderers.registerDataRenderer({
        id: record.id,
        title: text(record.title, record.id),
        resourceKind: record.resourceKind,
        attributes: attributes.source,
        defaultSettings: record.defaultSettings,
        defaultFilters: record.defaultFilters,
        emptyTitle: text(record.emptyTitle, ""),
        emptyDescription: text(record.emptyDescription, ""),
        hideToolbar: record.hideToolbar,
        getBoardColumnConfig: (groupKey) => toWorkbenchBoardColumnConfig(columnConfigs?.[groupKey]),
        executeQuery: async (state: DataRendererQueryState) => {
          const value = await executeDataRendererCommand(context, record, record.queryCommandId, {
            settings: state.settings,
            filters: state.filters,
          });
          if (Array.isArray(value)) return value.map(toWorkbenchRow);
          if (!isQueryResult(value)) return [];
          attributes.set(value.attributes);
          columnConfigs = value.boardColumnConfigs;
          return (value.rows ?? []).map(toWorkbenchRow);
        },
        onAttributeChange: record.updateAttributeCommandId
          ? (rowId, attributeId, value) => {
              void executeDataRendererCommand(context, record, record.updateAttributeCommandId!, {
                rowId,
                attributeId,
                value,
              });
            }
          : undefined,
        onReorder: record.reorderCommandId
          ? (rowId, beforeRowId) => {
              void executeDataRendererCommand(context, record, record.reorderCommandId!, { rowId, beforeRowId });
            }
          : undefined,
        onCreateRow: record.createRow
          ? (columnId) => {
              const params = record.createRow?.columnParam ? { [record.createRow.columnParam]: columnId } : {};
              void executeDataRendererCommand(context, record, record.createRow!.commandId, params);
            }
          : undefined,
        onColumnAction: record.columnActionCommandId
          ? async (columnId, actionId) => {
              await executeDataRendererCommand(context, record, record.columnActionCommandId!, { columnId, actionId });
            }
          : undefined,
        getRowContextMenuActions: record.rowActions?.length
          ? (row) =>
              record.rowActions!.map((action) => ({
                key: action.id,
                label: text(action.label, action.id),
                icon: createRowActionIcon(action.icon),
                onClick: () => runRowAction(context, record, action, row),
              }))
          : undefined,
      }),
    );

    disposables.push(
      context.workbench.layout.registerWidget({
        id: record.id,
        title: text(record.title, record.id),
        area: "main",
        rendererId: record.id,
        singleton: true,
        resourceKinds: record.resourceKind ? [record.resourceKind] : undefined,
      }),
    );
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
