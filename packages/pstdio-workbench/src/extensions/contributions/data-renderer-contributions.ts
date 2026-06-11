import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { DataRendererContribution, DataRendererQueryState, Disposable } from "../../core";
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
type QueryResult = {
  attributes?: WorkbenchExtensionDataRendererRecord["attributes"];
  boardColumnConfigs?: ColumnConfigRecord;
  rows?: unknown[];
};
type ColumnConfigRecord = Record<string, ReturnType<NonNullable<DataRendererContribution["getBoardColumnConfig"]>>>;

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
) =>
  executeWorkbenchExtensionCommand(context, commandId, {
    params,
    resource: context.workbench.getPrimaryResource(),
    slot: createDataRendererSlot(context, record),
    metadata: { dataRendererId: record.id },
  });

export const registerWorkbenchExtensionDataRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: readonly WorkbenchExtensionDataRendererRecord[],
) => {
  const disposables: Disposable[] = [];

  for (const record of records) {
    const attributes = createMutableAttributeSource(record.attributes);
    let columnConfigs: ColumnConfigRecord | undefined;

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
        getBoardColumnConfig: (groupKey) => columnConfigs?.[groupKey] ?? {},
        executeQuery: async (state: DataRendererQueryState) => {
          const value = await executeDataRendererCommand(context, record, record.queryCommandId, {
            settings: state.settings,
            filters: state.filters,
          });
          if (Array.isArray(value)) return value.map(toWorkbenchRow);
          if (!isQueryResult(value)) return [];
          attributes.set(value.attributes);
          columnConfigs = value.boardColumnConfigs as ColumnConfigRecord | undefined;
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
                onClick: async () => {
                  await executeDataRendererCommand(context, record, action.commandId, mergeParams({ rowId: row.id }));
                },
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
