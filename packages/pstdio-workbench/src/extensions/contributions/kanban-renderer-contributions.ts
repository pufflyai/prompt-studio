import type {
  KanbanRendererBoardColumnConfig as WireBoardColumnConfig,
  KanbanRendererRow as WireRow,
} from "@pstdio/sdk/extensions";
import { renderBadgeListDisplay } from "@pstdio/ui/kanban-renderer";
import { kanbanBuiltInViews, type WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type { Disposable, KanbanRendererCreateSubmission, KanbanRendererQueryState, ResourceRef } from "../../core";
import { WorkbenchIcon } from "../../react";
import type { ReactAttributeDescriptor as AttributeDescriptor } from "../../react/renderers/kanban/kanban-presentation";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { collectionBadgeTarget } from "./collection-badge-navigation";
import type { WorkbenchExtensionKanbanRendererAdapter } from "./kanban-renderer-adapter";
import { toWorkbenchBoardColumnConfig } from "./kanban-renderer-board-config";
import {
  createMutableAttributeSource,
  defaultResolveRowActionResource,
  defaultResolveRowResource,
  executeKanbanRendererCommand,
  isQueryResult,
  type KanbanRendererRow,
  type Localizer,
  mergeParams,
  registerRowActionCommands,
  runDefaultRowAction,
  toCreateFields,
  toWorkbenchRow,
} from "./kanban-renderer-contribution-helpers";
import { mapViewToolbarActions } from "./view-toolbar-actions";

type ColumnConfigRecord = Record<string, WireBoardColumnConfig>;

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
      submitWithoutOpening: localize(undefined, "Create without opening"),
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
      await executeKanbanRendererCommand(
        context,
        record,
        record.rowActivationHandlerId!,
        { row: toActivatedRow(row) },
        resource,
      );
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
  activateCreatedRow: ((row: KanbanRendererRow) => Promise<void> | void) | undefined,
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
    if (submission.openCreatedRow === false || !activateCreatedRow || typeof created !== "object" || created === null)
      return;
    const row = created as Partial<KanbanRendererRow>;
    if (typeof row.id !== "string" || typeof row.title !== "string") return;
    await activateCreatedRow({ ...row, id: row.id, title: row.title, attributes: row.attributes ?? {} });
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
              renderBadgeListDisplay(attribute, value, row, undefined, (id) => {
                if (attribute.display?.kind !== "badge-list") return;
                const target = collectionBadgeTarget(
                  row,
                  attribute.display.itemsAttributeId,
                  id,
                  record.extensionId,
                  context.projectId,
                );
                return target
                  ? () => {
                      void context.workbench.navigation.openTarget(target);
                    }
                  : undefined;
              }),
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
      reportUnknownDisplay,
    );
    let wireAttributes = record.attributes;
    const builtIns = kanbanBuiltInViews(record);
    const originalRows = new WeakMap<KanbanRendererRow, KanbanRendererRow>();
    let columnConfigs: ColumnConfigRecord | undefined;
    let latestQueryId = 0;
    let rowCache = new Map<string, { signature: string; row: KanbanRendererRow }>();
    const rowResource = (row: KanbanRendererRow) => resolveRowResource(record, row);
    const toActivatedRow = (row: KanbanRendererRow) => originalRows.get(row) ?? row;
    const onRowActivate = toRowClick(context, record, adapter, resolveRowResource, toActivatedRow);

    disposables.push(...registerRowActionCommands(context, record, localize));
    disposables.push(
      context.workbench.views.registerView({
        id: record.id,
        title: localize(record.title, record.id),
        icon: record.icon,
        instancePolicy: record.instancePolicy,
        body: {
          kind: "kanban",
          resourceKind: record.resourceKind,
          toolbarActions: mapViewToolbarActions(record),
          listRowActions: () =>
            (record.rowActions ?? []).map((action) => ({
              commandId: action.commandId,
              label: localize(action.label, action.id),
            })),
          storageScope: context.projectId,
          attributes: attributes.source,
          defaultSettings: builtIns.settings,
          defaultFilter: record.defaultFilter,
          defaultSorts: record.defaultSorts,
          viewsProvider: adapter.createViewsProvider?.(record),
          defaultViews: builtIns.views.map((view) => ({ ...view, title: localize(view.title, view.id) })),
          defaultActiveViewId: record.defaultActiveViewId,
          emptyTitle: localize(record.emptyTitle, ""),
          emptyDescription: localize(record.emptyDescription, ""),
          hideToolbar: record.hideToolbar,
          createRow: toCreateRowConfig(record, localize),
          getBoardColumnConfig: (groupKey) => toWorkbenchBoardColumnConfig(columnConfigs?.[groupKey], localize),
          onRowActivate,
          executeQuery: async (state: KanbanRendererQueryState, signal) => {
            latestQueryId += 1;
            const queryId = latestQueryId;
            const value = await executeKanbanRendererCommand(
              context,
              record,
              record.queryHandlerId,
              {
                settings: state.settings,
                filter: state.filter,
                sorts: state.sorts,
              },
              undefined,
              signal,
              state.pageParams,
            );
            const mapRows = (rows: unknown[]) => {
              const nextCache = new Map<string, { signature: string; row: KanbanRendererRow }>();
              const result = rows.map((row) => {
                const candidate = row as KanbanRendererRow;
                const signature = JSON.stringify(row);
                const cached = rowCache.get(candidate.id);
                const target = (row as WireRow).target;
                const mapped =
                  cached?.signature === signature
                    ? cached.row
                    : {
                        ...toWorkbenchRow(row, rowResource),
                        ...(target
                          ? {
                              target: toWorkbenchNavigationTarget(target, {
                                extensionId: record.extensionId,
                                projectId: context.projectId,
                              }),
                            }
                          : {}),
                      };
                originalRows.set(mapped, candidate);
                nextCache.set(mapped.id, { signature, row: mapped });
                return mapped;
              });
              if (queryId === latestQueryId) rowCache = nextCache;
              return result;
            };
            if (queryId !== latestQueryId) {
              if (Array.isArray(value)) return mapRows(value);
              return isQueryResult(value) ? mapRows(value.rows ?? []) : [];
            }

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
          onMove: record.moveHandlerId
            ? (move) => runMutation(record, record.moveHandlerId!, { ...move }).then(() => undefined)
            : undefined,
          onCreateRow: toCreateRowHandler(
            record,
            adapter,
            runMutation,
            record.rowActivationHandlerId ? onRowActivate : undefined,
          ),
          onColumnAction: record.columnActionHandlerId
            ? async (columnId, actionId) => {
                await runMutation(record, record.columnActionHandlerId!, { columnId, actionId });
              }
            : undefined,
          getRowContextMenuActions: toRowContextMenuActions(
            context,
            record,
            adapter,
            localize,
            resolveRowActionResource,
          ),
        },
      }),
    );
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
