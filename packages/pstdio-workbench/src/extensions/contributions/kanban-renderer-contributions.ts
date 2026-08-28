import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { KanbanRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import { renderBadgeListDisplay } from "@pstdio/ui/kanban-renderer";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type {
  AttributeDescriptor,
  Disposable,
  KanbanRendererContribution,
  KanbanRendererCreateSubmission,
  KanbanRendererQueryState,
  ResourceRef,
} from "../../core";
import { WorkbenchIcon } from "../../react";
import { toWorkbenchNavigationTargetResult } from "../host/extension-navigation-target";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { toWorkbenchResource } from "../host/workbench-extension-command";
import {
  createMutableAttributeSource,
  defaultResolveRowActionResource,
  defaultResolveRowResource,
  executeKanbanRendererCommand,
  isQueryResult,
  type KanbanRendererRow,
  type Localizer,
  mergeParams,
  type ResolveStatusOptions,
  type RowAction,
  registerRowActionCommands,
  runDefaultRowAction,
  toCreateFields,
  toWorkbenchRow,
} from "./kanban-renderer-contribution-helpers";
import {
  panelMenuDeclarationOffsets,
  panelRendererId,
  registerWorkbenchExtensionPanel,
  resolveWorkbenchExtensionViewInput,
  toWorkbenchCompositionPanelContribution,
  type WorkbenchExtensionViewInputResolver,
} from "./panel-contributions";

type BoardColumnConfig = ReturnType<NonNullable<KanbanRendererContribution["getBoardColumnConfig"]>>;
type ColumnConfigRecord = Record<string, WireBoardColumnConfig>;

export interface WorkbenchExtensionKanbanRendererAdapter {
  /** Add host navigation state changes that must run before a panel view opens. */
  resolveViewInput?: WorkbenchExtensionViewInputResolver;
  /** Override label resolution. Defaults to workbench's `text(value, fallback)`. */
  resolveLabel?: Localizer;
  /** Post-process an attribute descriptor (after localization). Defaults to identity. */
  decorateAttribute?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    attribute: AttributeDescriptor,
  ) => AttributeDescriptor;
  /**
   * Translate a row's transport-shaped resource (`{ type, id }`) into a workbench
   * `ResourceRef`. Defaults to the workbench `pstdio://extension-resource/...`
   * scheme — dashboard supplies its own. Returns `undefined` for rows that do not
   * carry an explicit resource.
   */
  resolveRowResource?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    row: KanbanRendererRow,
  ) => ResourceRef | undefined;
  /**
   * Synthesize a `ResourceRef` for row-action execution context when the row does
   * not carry an explicit resource. Defaults to a `pstdio://extension-resource/`
   * fallback built from `record.resourceKind` and `row.id`.
   */
  resolveRowActionResource?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    row: KanbanRendererRow,
  ) => ResourceRef | undefined;
  /**
   * Override the row-action runner. `runDefault` performs the workbench's standard
   * flow (look up the row-action command, request params if needed, execute it).
   */
  executeRowAction?: (input: {
    record: WorkbenchExtensionKanbanRendererRecord;
    action: RowAction;
    row: KanbanRendererRow;
    resource: ResourceRef | undefined;
    runDefault: () => Promise<void>;
  }) => void | Promise<void>;
  /**
   * Override the row click handler. When unset the panel layer falls back to
   * opening the row's resource via `ctx.resources.openResource` — set this to
   * intercept the click (e.g. swallow rejections when no presenter exists yet).
   */
  onRowClick?: (input: {
    record: WorkbenchExtensionKanbanRendererRecord;
    row: KanbanRendererRow;
    resource: ResourceRef | undefined;
  }) => void;
  /** Translate extension navigation resource targets into host resources. */
  resolveNavigationResource?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    resource: NonNullable<CommandExecuteRequest["resource"]>,
  ) => ResourceRef;
  /** Called after a successful renderer-owned create form submission. */
  onAfterCreate?: (input: {
    record: WorkbenchExtensionKanbanRendererRecord;
    created: unknown;
    submission: KanbanRendererCreateSubmission;
  }) => void | Promise<void>;
  /**
   * Called after any mutation (attribute change, reorder, column action, default
   * create) resolves successfully. Hosts that drive refresh via the outer command
   * pipeline (testbench / workbench) leave this unset; dashboard supplies
   * `ctx.renderers.refreshKanbanRenderer(id)`.
   */
  onAfterMutation?: (record: WorkbenchExtensionKanbanRendererRecord) => void;
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

const statusSetId = (record: WorkbenchExtensionKanbanRendererRecord, ref: Parameters<ResolveStatusOptions>[0]) =>
  `${ref.extensionId ?? record.extensionId}.status.${ref.id}`;

const createStatusOptionsResolver = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
): ResolveStatusOptions => {
  const sources = new Map<string, ReturnType<ResolveStatusOptions>>();
  return (ref) => {
    const id = statusSetId(record, ref);
    const existing = sources.get(id);
    if (existing) return existing;

    const source = {
      getSnapshot: () =>
        (context.workbench.statuses.getStatuses(id) ?? []).map((status) => ({
          value: status.id,
          label: status.label,
          color: status.color,
          icon: status.icon,
        })),
      subscribe: (listener: () => void) =>
        context.workbench.statuses.store.subscribeSelector((state) => state.values[id], listener),
    };
    sources.set(id, source);
    void context.workbench.statuses.load(id).catch(() => undefined);
    return source;
  };
};

const statusColorConfig = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
  attributes: WorkbenchExtensionKanbanRendererRecord["attributes"],
  groupingAttributeId: string | undefined,
  groupKey: string,
): WireBoardColumnConfig | undefined => {
  const attribute = attributes?.find((candidate) => candidate.id === groupingAttributeId);
  if (attribute?.type.kind !== "status") return undefined;
  const id = statusSetId(record, attribute.type.statuses);
  const status = context.workbench.statuses.getStatuses(id)?.find((candidate) => candidate.id === groupKey);
  return status ? { color: status.color } : undefined;
};

const initialColumnGrouping = (record: WorkbenchExtensionKanbanRendererRecord) => {
  if (record.defaultSettings?.columnGrouping) return record.defaultSettings.columnGrouping;
  const statusAttributes = record.attributes?.filter((attribute) => attribute.type.kind === "status") ?? [];
  return statusAttributes.length === 1 ? statusAttributes[0]?.id : undefined;
};

const createRowActionIcon = (icon: string | undefined) =>
  icon ? createElement(WorkbenchIcon, { name: icon, size: 16 }) : undefined;

const toCreateRowConfig = (record: WorkbenchExtensionKanbanRendererRecord, localize: Localizer) => {
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
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
  adapter: WorkbenchExtensionKanbanRendererAdapter,
  resolveRowResource: (
    record: WorkbenchExtensionKanbanRendererRecord,
    row: KanbanRendererRow,
  ) => ResourceRef | undefined,
  toActivatedRow: (row: KanbanRendererRow) => KanbanRendererRow,
) => {
  if (record.rowActivationHandlerId) {
    return async (row: KanbanRendererRow) => {
      const resource = resolveRowResource(record, row);
      const result = await executeKanbanRendererCommand(
        context,
        record,
        record.rowActivationHandlerId!,
        { row: toActivatedRow(row) },
        resource,
      );
      const target = toWorkbenchNavigationTargetResult(result, {
        extensionId: record.extensionId,
        resourceOf: adapter.resolveNavigationResource
          ? (resource) => adapter.resolveNavigationResource!(record, resource)
          : undefined,
      });
      if (target) await context.workbench.navigation.openTarget(target);
    };
  }
  if (!adapter.onRowClick) return undefined;
  return (row: KanbanRendererRow) => adapter.onRowClick?.({ record, row, resource: resolveRowResource(record, row) });
};

const toCreateRowHandler = (
  record: WorkbenchExtensionKanbanRendererRecord,
  adapter: WorkbenchExtensionKanbanRendererAdapter,
  runMutation: (
    record: WorkbenchExtensionKanbanRendererRecord,
    commandId: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>,
) => {
  const contribution = record.createRow;
  if (!contribution) return undefined;
  return async (submission: KanbanRendererCreateSubmission) => {
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
  record: WorkbenchExtensionKanbanRendererRecord,
  adapter: WorkbenchExtensionKanbanRendererAdapter,
  localize: Localizer,
  resolveRowActionResource: (
    record: WorkbenchExtensionKanbanRendererRecord,
    row: KanbanRendererRow,
  ) => ResourceRef | undefined,
) => {
  const actions = record.rowActions;
  if (!actions?.length) return undefined;
  return (row: KanbanRendererRow) =>
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

export const registerWorkbenchExtensionKanbanRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: readonly WorkbenchExtensionKanbanRendererRecord[],
  adapter: WorkbenchExtensionKanbanRendererAdapter = {},
  panels: WorkbenchExtensionMetadata["panels"] = [],
  resourcePanels: WorkbenchExtensionMetadata["resourcePanels"] = [],
) => {
  const disposables: Disposable[] = [];
  const localize: Localizer =
    adapter.resolveLabel ?? ((value, fallback) => text(value as Parameters<typeof text>[0], fallback));
  const decorate = (record: WorkbenchExtensionKanbanRendererRecord, attribute: AttributeDescriptor) => {
    const withBuiltInDisplay =
      attribute.display?.kind === "badge-list"
        ? {
            ...attribute,
            render: (value: unknown, row: KanbanRendererRow) =>
              renderBadgeListDisplay(
                attribute,
                value,
                row,
                (resource) =>
                  void context.workbench.resources.openResource(toWorkbenchResource(resource), { replaceActive: true }),
              ),
          }
        : attribute;
    return adapter.decorateAttribute?.(record, withBuiltInDisplay) ?? withBuiltInDisplay;
  };
  const resolveRowResource = adapter.resolveRowResource ?? defaultResolveRowResource;
  const resolveRowActionResource = adapter.resolveRowActionResource ?? defaultResolveRowActionResource;
  const afterMutation = adapter.onAfterMutation ?? (() => {});

  const runMutation = (
    record: WorkbenchExtensionKanbanRendererRecord,
    commandId: string,
    params: Record<string, unknown>,
  ) =>
    executeKanbanRendererCommand(context, record, commandId, params).then((result) => {
      afterMutation(record);
      return result;
    });

  for (const record of records) {
    const resolveStatusOptions = createStatusOptionsResolver(context, record);
    const reportUnknownDisplay = (attributeId: string, kind: string) =>
      context.workbench.notifications.show({
        id: `workbench.extension.${record.extensionId}.kanban.${record.id}.display.${attributeId}`,
        level: "error",
        title: "Extension display is not available",
        message: `Attribute "${attributeId}" in renderer "${record.id}" uses unknown display kind "${kind}".`,
      });
    const attributes = createMutableAttributeSource(
      record,
      record.attributes,
      localize,
      decorate,
      resolveStatusOptions,
      reportUnknownDisplay,
    );
    let wireAttributes = record.attributes;
    let columnGrouping = initialColumnGrouping(record);
    const originalRows = new WeakMap<KanbanRendererRow, KanbanRendererRow>();
    let columnConfigs: ColumnConfigRecord | undefined;
    let latestQueryId = 0;
    const rowResource = (row: KanbanRendererRow) => resolveRowResource(record, row);
    const toActivatedRow = (row: KanbanRendererRow) => originalRows.get(row) ?? row;

    disposables.push(...registerRowActionCommands(context, record, localize));
    disposables.push(
      context.workbench.renderers.registerKanbanRenderer({
        id: record.id,
        title: localize(record.title, record.id),
        resourceKind: record.resourceKind,
        storageScope: context.projectId,
        attributes: attributes.source,
        defaultSettings: record.defaultSettings,
        defaultFilters: record.defaultFilters,
        defaultViews: record.defaultViews?.map((view) => ({
          ...view,
          title: localize(view.title, view.id),
        })),
        defaultActiveViewId: record.defaultActiveViewId,
        emptyTitle: localize(record.emptyTitle, ""),
        emptyDescription: localize(record.emptyDescription, ""),
        hideToolbar: record.hideToolbar,
        createRow: toCreateRowConfig(record, localize),
        getBoardColumnConfig: (groupKey) =>
          toWorkbenchBoardColumnConfig(
            columnConfigs?.[groupKey] ?? statusColorConfig(context, record, wireAttributes, columnGrouping, groupKey),
            localize,
          ),
        onRowActivate: toRowClick(context, record, adapter, resolveRowResource, toActivatedRow),
        executeQuery: async (state: KanbanRendererQueryState) => {
          latestQueryId += 1;
          const queryId = latestQueryId;
          const value = await executeKanbanRendererCommand(context, record, record.queryHandlerId, {
            settings: state.settings,
            filters: state.filters,
          });
          const mapRows = (rows: unknown[]) =>
            rows.map((row) => {
              const mapped = toWorkbenchRow(row, rowResource);
              originalRows.set(mapped, row as KanbanRendererRow);
              return mapped;
            });
          if (queryId !== latestQueryId) {
            if (Array.isArray(value)) return mapRows(value);
            return isQueryResult(value) ? mapRows(value.rows ?? []) : [];
          }

          columnGrouping = state.settings.columnGrouping;
          if (Array.isArray(value)) return mapRows(value);
          if (!isQueryResult(value)) return [];
          const nextAttributes = value.attributes ?? wireAttributes;
          wireAttributes = nextAttributes;
          attributes.set(nextAttributes);
          columnConfigs = value.boardColumnConfigs;
          return mapRows(value.rows ?? []);
        },
        onAttributeChange: record.attributeChangeHandlerId
          ? (rowId, attributeId, value) =>
              runMutation(record, record.attributeChangeHandlerId!, {
                rowId,
                attributeId,
                value,
              }).then(() => undefined)
          : undefined,
        onReorder: record.reorderHandlerId
          ? (rowId, beforeRowId) =>
              runMutation(record, record.reorderHandlerId!, { rowId, beforeRowId }).then(() => undefined)
          : undefined,
        onCreateRow: toCreateRowHandler(record, adapter, runMutation),
        onColumnAction: record.columnActionHandlerId
          ? async (columnId, actionId) => {
              await runMutation(record, record.columnActionHandlerId!, { columnId, actionId });
            }
          : undefined,
        getRowContextMenuActions: toRowContextMenuActions(context, record, adapter, localize, resolveRowActionResource),
      }),
    );
  }

  const menuOffsets = panelMenuDeclarationOffsets(panels);
  panels.forEach((panel, index) => {
    const rendererId = panelRendererId(panel, "kanban");
    if (!rendererId) return;
    disposables.push(
      registerWorkbenchExtensionPanel({
        workbench: context.workbench,
        path: panel.path,
        aliases: panel.aliases,
        resolveInput: resolveWorkbenchExtensionViewInput(adapter.resolveViewInput, panel),
        contribution: toWorkbenchCompositionPanelContribution({
          panel,
          rendererId,
          declarationIndex: index,
          menuDeclarationOffset: menuOffsets[index]!,
          resourcePanels,
        }),
      }),
    );
  });

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
