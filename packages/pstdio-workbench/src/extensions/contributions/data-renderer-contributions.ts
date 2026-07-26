import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import type { DataRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type {
  AttributeDescriptor,
  DataRendererContribution,
  DataRendererCreateSubmission,
  DataRendererQueryState,
  Disposable,
  ResourceRef,
} from "../../core";
import { WorkbenchIcon } from "../../react";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createMutableAttributeSource,
  type DataRendererRow,
  defaultResolveRowActionResource,
  defaultResolveRowResource,
  executeDataRendererCommand,
  isQueryResult,
  type Localizer,
  mergeParams,
  type RowAction,
  registerRowActionCommands,
  runDefaultRowAction,
  toCreateFields,
  toWorkbenchRow,
} from "./data-renderer-contribution-helpers";

type BoardColumnConfig = ReturnType<NonNullable<DataRendererContribution["getBoardColumnConfig"]>>;
type ColumnConfigRecord = Record<string, WireBoardColumnConfig>;

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
  /** Called after a successful renderer-owned create form submission. */
  onAfterCreate?: (input: {
    record: WorkbenchExtensionDataRendererRecord;
    created: unknown;
    submission: DataRendererCreateSubmission;
  }) => void | Promise<void>;
  /**
   * Called after any mutation (attribute change, reorder, column action, default
   * create) resolves successfully. Hosts that drive refresh via the outer command
   * pipeline (testbench / workbench) leave this unset; dashboard supplies
   * `ctx.renderers.refreshDataRenderer(id)`.
   */
  onAfterMutation?: (record: WorkbenchExtensionDataRendererRecord) => void;
}

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

const toCreateRowConfig = (record: WorkbenchExtensionDataRendererRecord, localize: Localizer) => {
  if (!record.createRow) return undefined;
  return {
    title: localize(record.createRow.title, "Create row"),
    submitLabel: localize(record.createRow.submitLabel, "Create"),
    fields: toCreateFields(record, localize),
    labels: {
      cancel: localize(record.createRow.labels?.cancel, "Cancel"),
      properties: localize(record.createRow.labels?.properties, "Properties"),
      submitError: localize(record.createRow.labels?.submitError, "Could not create resource."),
      removeFile: localize(record.createRow.labels?.removeFile, "Remove file"),
    },
  };
};

const toRowClick = (
  record: WorkbenchExtensionDataRendererRecord,
  adapter: WorkbenchExtensionDataRendererAdapter,
  resolveRowResource: (record: WorkbenchExtensionDataRendererRecord, row: DataRendererRow) => ResourceRef | undefined,
) => {
  if (!adapter.onRowClick) return undefined;
  return (row: DataRendererRow) => adapter.onRowClick?.({ record, row, resource: resolveRowResource(record, row) });
};

const toCreateRowHandler = (
  record: WorkbenchExtensionDataRendererRecord,
  adapter: WorkbenchExtensionDataRendererAdapter,
  runMutation: (
    record: WorkbenchExtensionDataRendererRecord,
    commandId: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>,
) => {
  const contribution = record.createRow;
  if (!contribution) return undefined;
  return async (submission: DataRendererCreateSubmission) => {
    const params = mergeParams(
      submission.values,
      contribution.columnParam ? { [contribution.columnParam]: submission.columnId } : undefined,
      contribution.attributesParam ? { [contribution.attributesParam]: submission.attributeValues } : undefined,
    );
    const created = await runMutation(record, contribution.commandId, params);
    await adapter.onAfterCreate?.({ record, created, submission });
  };
};

const toRowContextMenuActions = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionDataRendererRecord,
  adapter: WorkbenchExtensionDataRendererAdapter,
  localize: Localizer,
  resolveRowActionResource: (
    record: WorkbenchExtensionDataRendererRecord,
    row: DataRendererRow,
  ) => ResourceRef | undefined,
) => {
  const actions = record.rowActions;
  if (!actions?.length) return undefined;
  return (row: DataRendererRow) =>
    actions.map((action) => {
      const resource = resolveRowActionResource(record, row);
      const runDefault = () => runDefaultRowAction(context, record, action, row, resource, localize);
      return {
        key: action.id,
        label: localize(action.label, action.id),
        commandId: action.commandId,
        icon: createRowActionIcon(action.icon),
        onClick: () =>
          adapter.executeRowAction
            ? adapter.executeRowAction({ record, action, row, resource, runDefault })
            : runDefault(),
      };
    });
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
        createRow: toCreateRowConfig(record, localize),
        getBoardColumnConfig: (groupKey) => toWorkbenchBoardColumnConfig(columnConfigs?.[groupKey], localize),
        onRowClick: toRowClick(record, adapter, resolveRowResource),
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
        onCreateRow: toCreateRowHandler(record, adapter, runMutation),
        onColumnAction: record.columnActionCommandId
          ? async (columnId, actionId) => {
              await runMutation(record, record.columnActionCommandId!, { columnId, actionId });
            }
          : undefined,
        getRowContextMenuActions: toRowContextMenuActions(context, record, adapter, localize, resolveRowActionResource),
      }),
    );

    disposables.push(
      context.workbench.layout.registerLocation({
        id: record.id,
        title: localize(record.title, record.id),
        region: "main",
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
