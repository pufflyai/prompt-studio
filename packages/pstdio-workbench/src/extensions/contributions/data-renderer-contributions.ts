import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import type { DataRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type {
  AttributeDescriptor,
  DataRendererContribution,
  DataRendererQueryState,
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

type DataRendererRow = Awaited<ReturnType<DataRendererContribution["executeQuery"]>>[number];
type BoardColumnConfig = ReturnType<NonNullable<DataRendererContribution["getBoardColumnConfig"]>>;
type RowAction = NonNullable<WorkbenchExtensionDataRendererRecord["rowActions"]>[number];
type ColumnConfigRecord = Record<string, WireBoardColumnConfig>;
type QueryResult = {
  attributes?: WorkbenchExtensionDataRendererRecord["attributes"];
  boardColumnConfigs?: ColumnConfigRecord;
  rows?: unknown[];
};
type Localizer = (value: unknown, fallback?: string) => string;

export interface WorkbenchExtensionDataRendererAdapter {
  /** Override label resolution. Defaults to workbench's `text(value, fallback)`. */
  resolveLabel?: Localizer;
  /** Post-process an attribute descriptor (after localization). Defaults to identity. */
  decorateAttribute?: (
    record: WorkbenchExtensionDataRendererRecord,
    attribute: AttributeDescriptor,
  ) => AttributeDescriptor;
  /**
   * Translate a row's transport-shaped resource (`{ type, id }`) into a workbench
   * `ResourceRef`. Defaults to the workbench `pstdio://extension-resource/...`
   * scheme — dashboard supplies its own. Returns `undefined` for rows that do not
   * carry an explicit resource.
   */
  resolveRowResource?: (record: WorkbenchExtensionDataRendererRecord, row: DataRendererRow) => ResourceRef | undefined;
  /**
   * Synthesize a `ResourceRef` for row-action execution context when the row does
   * not carry an explicit resource. Defaults to a `pstdio://extension-resource/`
   * fallback built from `record.resourceKind` and `row.id`.
   */
  resolveRowActionResource?: (
    record: WorkbenchExtensionDataRendererRecord,
    row: DataRendererRow,
  ) => ResourceRef | undefined;
  /**
   * Override the row-action runner. `runDefault` performs the workbench's standard
   * flow (look up the row-action command, request params if needed, execute it).
   */
  executeRowAction?: (input: {
    record: WorkbenchExtensionDataRendererRecord;
    action: RowAction;
    row: DataRendererRow;
    resource: ResourceRef | undefined;
    runDefault: () => Promise<void>;
  }) => void | Promise<void>;
  /**
   * Override the row click handler. When unset the view layer falls back to
   * opening the row's resource via `ctx.resources.openResource` — set this to
   * intercept the click (e.g. swallow rejections when no opener exists yet).
   */
  onRowClick?: (input: {
    record: WorkbenchExtensionDataRendererRecord;
    row: DataRendererRow;
    resource: ResourceRef | undefined;
  }) => void;
  /**
   * Override the inline-create handler. `executeDefault` runs the record's create
   * command with the column param. When omitted, the default executes and any
   * configured `onAfterCreate` runs with the returned value.
   */
  onCreateRow?: (input: {
    record: WorkbenchExtensionDataRendererRecord;
    columnId: string;
    executeDefault: () => Promise<unknown>;
  }) => void;
  /** Called after a successful default create (when `onCreateRow` is not provided). */
  onAfterCreate?: (input: { record: WorkbenchExtensionDataRendererRecord; created: unknown }) => void;
  /**
   * Called after any mutation (attribute change, reorder, column action, default
   * create) resolves successfully. Hosts that drive refresh via the outer command
   * pipeline (testbench / workbench) leave this unset; dashboard supplies
   * `ctx.renderers.refreshDataRenderer(id)`.
   */
  onAfterMutation?: (record: WorkbenchExtensionDataRendererRecord) => void;
}

interface MutableAttributeSource {
  source: DataRendererContribution["attributes"];
  set(attributes: WorkbenchExtensionDataRendererRecord["attributes"] | undefined): void;
}

const isQueryResult = (value: unknown): value is QueryResult =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const localizeAttributes = (
  record: WorkbenchExtensionDataRendererRecord,
  attributes: WorkbenchExtensionDataRendererRecord["attributes"] | undefined,
  localize: Localizer,
  decorate: (record: WorkbenchExtensionDataRendererRecord, attribute: AttributeDescriptor) => AttributeDescriptor,
): AttributeDescriptor[] =>
  (attributes ?? []).map((attribute) => {
    const base: AttributeDescriptor = {
      ...attribute,
      label: localize(attribute.label, attribute.id),
      type:
        attribute.type.kind === "enum" || attribute.type.kind === "enum-multi"
          ? {
              ...attribute.type,
              options: Array.isArray(attribute.type.options)
                ? attribute.type.options.map((option) => ({ ...option, label: localize(option.label, option.value) }))
                : attribute.type.options,
            }
          : attribute.type,
    };
    return decorate(record, base);
  });

const createMutableAttributeSource = (
  record: WorkbenchExtensionDataRendererRecord,
  initial: WorkbenchExtensionDataRendererRecord["attributes"] | undefined,
  localize: Localizer,
  decorate: (record: WorkbenchExtensionDataRendererRecord, attribute: AttributeDescriptor) => AttributeDescriptor,
): MutableAttributeSource => {
  let snapshot = localizeAttributes(record, initial, localize, decorate);
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
      snapshot = localizeAttributes(record, attributes, localize, decorate);
      for (const listener of listeners) listener();
    },
  };
};

const isWorkbenchResource = (resource: unknown): resource is ResourceRef =>
  Boolean(resource && typeof resource === "object" && typeof (resource as { kind?: unknown }).kind === "string");

const isExtensionResource = (resource: unknown): resource is Parameters<typeof toWorkbenchResource>[0] =>
  Boolean(
    resource &&
      typeof resource === "object" &&
      typeof (resource as { type?: unknown }).type === "string" &&
      typeof (resource as { id?: unknown }).id === "string",
  );

const rowResourceUri = (kind: string, id: string) =>
  `pstdio://extension-resource/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;

const defaultResolveRowResource = (_: WorkbenchExtensionDataRendererRecord, row: DataRendererRow) => {
  const { resource } = row;
  if (isWorkbenchResource(resource)) return resource;
  if (isExtensionResource(resource)) return toWorkbenchResource(resource);
  return undefined;
};

const defaultResolveRowActionResource = (record: WorkbenchExtensionDataRendererRecord, row: DataRendererRow) => {
  const fromRow = defaultResolveRowResource(record, row);
  if (fromRow) return fromRow;
  if (!record.resourceKind) return undefined;
  return {
    kind: record.resourceKind,
    uri: rowResourceUri(record.resourceKind, row.id),
    id: row.id,
    label: row.title,
  };
};

const toWorkbenchRow = (row: unknown, resolveResource: (row: DataRendererRow) => ResourceRef | undefined) => {
  const candidate = row as DataRendererRow;
  const resource = resolveResource(candidate);
  return resource === undefined ? candidate : ({ ...candidate, resource } as DataRendererRow);
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

const toWorkbenchBoardColumnConfig = (config: WireBoardColumnConfig | undefined, localize: Localizer) =>
  ({
    color: config?.color,
    canDragIn: config?.canDragIn,
    canDragOut: config?.canDragOut,
    canCreate: config?.canCreate,
    actions: config?.actions?.map((action) => ({
      id: action.id,
      label: localize(action.label, action.id),
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

const registerRowActionCommands = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  localize: Localizer,
) =>
  (record.rowActions ?? []).map((action) => {
    const target = context.workbench.commands.getCommand(action.commandId)?.command;
    return context.workbench.commands.registerCommand(
      {
        id: dataRendererRowActionCommandId(record, action),
        label: localize(action.label, action.id),
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

const runDefaultRowAction = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  action: RowAction,
  row: DataRendererRow,
  resource: ResourceRef | undefined,
  localize: Localizer,
) => {
  const commandId = dataRendererRowActionCommandId(record, action);
  const command = context.workbench.commands.getCommand(commandId);
  const args = { rowId: row.id };
  const executionContext = resource ? { resource } : undefined;
  const label = localize(action.label, action.id);

  if (command && hasCommandParameters(command.command.params)) {
    context.workbench.commandPalette.requestParams({ record: command, label, args, context: executionContext });
    return Promise.resolve();
  }

  if (command)
    return context.workbench.commands.executeCommand(command.command.id, args, executionContext).then(() => undefined);

  return executeDataRendererCommand(context, record, action.commandId, args, resource).then(() => undefined);
};

export const registerWorkbenchExtensionDataRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: readonly WorkbenchExtensionDataRendererRecord[],
  adapter: WorkbenchExtensionDataRendererAdapter = {},
) => {
  const disposables: Disposable[] = [];
  const localize: Localizer =
    adapter.resolveLabel ?? ((value, fallback) => text(value as Parameters<typeof text>[0], fallback));
  const decorate = adapter.decorateAttribute ?? ((_, attribute) => attribute);
  const resolveRowResource = adapter.resolveRowResource ?? defaultResolveRowResource;
  const resolveRowActionResource = adapter.resolveRowActionResource ?? defaultResolveRowActionResource;
  const afterMutation = adapter.onAfterMutation ?? (() => {});

  const runMutation = (
    record: WorkbenchExtensionDataRendererRecord,
    commandId: string,
    params: Record<string, unknown>,
  ) =>
    executeDataRendererCommand(context, record, commandId, params).then((result) => {
      afterMutation(record);
      return result;
    });

  for (const record of records) {
    const attributes = createMutableAttributeSource(record, record.attributes, localize, decorate);
    let columnConfigs: ColumnConfigRecord | undefined;
    const rowResource = (row: DataRendererRow) => resolveRowResource(record, row);

    disposables.push(...registerRowActionCommands(context, record, localize));
    disposables.push(
      context.workbench.renderers.registerDataRenderer({
        id: record.id,
        title: localize(record.title, record.id),
        resourceKind: record.resourceKind,
        attributes: attributes.source,
        defaultSettings: record.defaultSettings,
        defaultFilters: record.defaultFilters,
        emptyTitle: localize(record.emptyTitle, ""),
        emptyDescription: localize(record.emptyDescription, ""),
        hideToolbar: record.hideToolbar,
        getBoardColumnConfig: (groupKey) => toWorkbenchBoardColumnConfig(columnConfigs?.[groupKey], localize),
        onRowClick: adapter.onRowClick
          ? (row) => adapter.onRowClick!({ record, row, resource: resolveRowResource(record, row) })
          : undefined,
        executeQuery: async (state: DataRendererQueryState) => {
          const value = await executeDataRendererCommand(context, record, record.queryCommandId, {
            settings: state.settings,
            filters: state.filters,
          });
          if (Array.isArray(value)) return value.map((row) => toWorkbenchRow(row, rowResource));
          if (!isQueryResult(value)) return [];
          attributes.set(value.attributes);
          columnConfigs = value.boardColumnConfigs;
          return (value.rows ?? []).map((row) => toWorkbenchRow(row, rowResource));
        },
        onAttributeChange: record.updateAttributeCommandId
          ? (rowId, attributeId, value) =>
              runMutation(record, record.updateAttributeCommandId!, {
                rowId,
                attributeId,
                value,
              }).then(() => undefined)
          : undefined,
        onReorder: record.reorderCommandId
          ? (rowId, beforeRowId) =>
              runMutation(record, record.reorderCommandId!, { rowId, beforeRowId }).then(() => undefined)
          : undefined,
        onCreateRow: record.createRow
          ? (columnId) => {
              const params = record.createRow?.columnParam ? { [record.createRow.columnParam]: columnId } : {};
              const executeDefault = () =>
                runMutation(record, record.createRow!.commandId, params).then((created) => {
                  adapter.onAfterCreate?.({ record, created });
                  return created;
                });
              if (adapter.onCreateRow) adapter.onCreateRow({ record, columnId, executeDefault });
              else void executeDefault();
            }
          : undefined,
        onColumnAction: record.columnActionCommandId
          ? async (columnId, actionId) => {
              await runMutation(record, record.columnActionCommandId!, { columnId, actionId });
            }
          : undefined,
        getRowContextMenuActions: record.rowActions?.length
          ? (row) =>
              record.rowActions!.map((action) => {
                const resource = resolveRowActionResource(record, row);
                const runDefault = () => runDefaultRowAction(context, record, action, row, resource, localize);
                return {
                  key: action.id,
                  label: localize(action.label, action.id),
                  icon: createRowActionIcon(action.icon),
                  onClick: () =>
                    adapter.executeRowAction
                      ? adapter.executeRowAction({ record, action, row, resource, runDefault })
                      : runDefault(),
                };
              })
          : undefined,
      }),
    );

    disposables.push(
      context.workbench.layout.registerWidget({
        id: record.id,
        title: localize(record.title, record.id),
        region: "main",
        panelAddable: true,
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
