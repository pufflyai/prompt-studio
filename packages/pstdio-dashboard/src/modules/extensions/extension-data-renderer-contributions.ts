import type { CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  DataRendererBoardColumnConfig as WireBoardColumnConfig,
  DataRendererQueryResult as WireQueryResult,
} from "@pstdio/sdk/extensions";
import type { AttributesSource, BoardColumnConfig, DataRendererRow, ResourceContextAction } from "@pstdio/ui";
import { type AttributeDescriptor, isEnumOptionsSource } from "@pstdio/ui";
import type { DataRendererContribution, DataRendererQueryState, ResourceRef } from "pstdio-workbench/core";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { createWorkspaceBadgeRenderer } from "./extension-workspace-badge-renderer";

export type ExtensionDataRendererRecord = NonNullable<WorkbenchExtensionMetadata["dataRenderers"]>[number];

// Extension commands run over REST; the structured value lands in outcome.value.
export const unwrapCommandOutcome = (response: CommandExecuteResponse) => {
  const { outcome } = response;
  if (!outcome.ok) {
    throw new Error(outcome.reason ?? outcome.error?.message ?? `Extension command "${response.commandId}" failed`);
  }
  return outcome.value;
};

export type ExecuteExtensionDataRendererCommand = (commandId: string, body: { params?: unknown }) => Promise<unknown>;

interface BuildExtensionDataRendererInput {
  record: ExtensionDataRendererRecord;
  executeCommand: ExecuteExtensionDataRendererCommand;
  onRowClick?: (row: DataRendererRow) => void;
  // Called with the created row's command result so the host can open it.
  onAfterCreate?: (created: unknown) => void;
  // Overrides the default inline-create command (e.g. to open a create modal). When
  // provided, the board create button calls this instead of executing createRow.command.
  onCreateRow?: (columnId: string) => void;
  openResource?: (resource: ResourceRef) => void;
  projectId?: string;
}

// The wire board-column config carries string icons; the board needs none for the
// drag/create rules, so we forward only those until column actions land (icons are
// component-shaped host-side and wired with the column-action command).
const toBoardColumnConfig = (config: WireBoardColumnConfig | undefined): BoardColumnConfig => ({
  color: config?.color,
  canDragIn: config?.canDragIn,
  canDragOut: config?.canDragOut,
  canCreate: config?.canCreate,
});

const addHostAttributeRenderer = (
  attribute: AttributeDescriptor,
  input: Pick<BuildExtensionDataRendererInput, "openResource" | "projectId">,
): AttributeDescriptor => {
  if (attribute.display?.kind !== "workspace-badge" || !input.openResource || !input.projectId) return attribute;
  return {
    ...attribute,
    render: createWorkspaceBadgeRenderer({
      itemsAttributeId: attribute.display.itemsAttributeId,
      openResource: input.openResource,
      projectId: input.projectId,
    }),
  };
};

const localizeAttribute = (
  attribute: AttributeDescriptor,
  extensionId: string,
  input: Pick<BuildExtensionDataRendererInput, "openResource" | "projectId">,
): AttributeDescriptor => {
  if (attribute.type.kind !== "enum" && attribute.type.kind !== "enum-multi") {
    return addHostAttributeRenderer(
      { ...attribute, label: resolveLocalizableString(attribute.label, extensionId) },
      input,
    );
  }

  return addHostAttributeRenderer(
    {
      ...attribute,
      label: resolveLocalizableString(attribute.label, extensionId),
      type: {
        ...attribute.type,
        options: isEnumOptionsSource(attribute.type.options)
          ? attribute.type.options
          : attribute.type.options.map((option) => ({
              ...option,
              label: resolveLocalizableString(option.label, extensionId),
            })),
      },
    },
    input,
  );
};

const localizeAttributes = (
  attributes: AttributeDescriptor[],
  extensionId: string,
  input: Pick<BuildExtensionDataRendererInput, "openResource" | "projectId">,
) => attributes.map((attribute) => localizeAttribute(attribute, extensionId, input));

const notify = (listeners: Set<() => void>) => {
  for (const listener of listeners) listener();
};

// Maps an extension's declarative data-renderer metadata onto a workbench data
// renderer: the query and every mutation route through the injected REST executor,
// and a post-mutation notify re-runs the query (there is no live sync).
export const buildExtensionDataRendererContribution = ({
  record,
  executeCommand,
  onRowClick,
  onAfterCreate,
  onCreateRow,
  openResource,
  projectId,
}: BuildExtensionDataRendererInput) => {
  const renderInput = { openResource, projectId };
  let attributesSnapshot = localizeAttributes(
    (record.attributes ?? []) as AttributeDescriptor[],
    record.extensionId,
    renderInput,
  );
  let boardColumnConfigs: WireQueryResult["boardColumnConfigs"] = {};
  const attributeListeners = new Set<() => void>();
  const refreshListeners = new Set<() => void>();

  const refresh = () => notify(refreshListeners);

  const runMutation = async (commandId: string, params: Record<string, unknown>) => {
    await executeCommand(commandId, { params });
    refresh();
  };

  const attributes: AttributesSource = {
    subscribe: (listener) => {
      attributeListeners.add(listener);
      return () => attributeListeners.delete(listener);
    },
    getSnapshot: () => attributesSnapshot,
  };

  const executeQuery = async (state: DataRendererQueryState) => {
    const result = (await executeCommand(record.queryCommandId, { params: state })) as WireQueryResult | undefined;
    if (result?.attributes) {
      attributesSnapshot = localizeAttributes(
        result.attributes as AttributeDescriptor[],
        record.extensionId,
        renderInput,
      );
      notify(attributeListeners);
    }
    if (result?.boardColumnConfigs) boardColumnConfigs = result.boardColumnConfigs;
    return (result?.rows ?? []) as DataRendererRow[];
  };

  const contribution: DataRendererContribution = {
    id: record.id,
    title: resolveLocalizableString(record.title, record.extensionId),
    resourceKind: record.resourceKind,
    attributes,
    getBoardColumnConfig: (groupKey) => toBoardColumnConfig(boardColumnConfigs?.[groupKey]),
    hideToolbar: record.hideToolbar,
    emptyTitle: record.emptyTitle ? resolveLocalizableString(record.emptyTitle, record.extensionId) : undefined,
    emptyDescription: record.emptyDescription
      ? resolveLocalizableString(record.emptyDescription, record.extensionId)
      : undefined,
    defaultSettings: record.defaultSettings,
    defaultFilters: record.defaultFilters,
    executeQuery,
    subscribe: (listener) => {
      refreshListeners.add(listener);
      return () => refreshListeners.delete(listener);
    },
    onRowClick,
    onAttributeChange: record.updateAttributeCommandId
      ? async (rowId, attributeId, value) =>
          runMutation(record.updateAttributeCommandId as string, { rowId, attributeId, value })
      : undefined,
    onReorder: record.reorderCommandId
      ? async (rowId, beforeRowId) => runMutation(record.reorderCommandId as string, { rowId, beforeRowId })
      : undefined,
    onColumnAction: record.columnActionCommandId
      ? (columnId, actionId) => runMutation(record.columnActionCommandId as string, { columnId, actionId })
      : undefined,
    getRowContextMenuActions: record.rowActions?.length
      ? (row): ResourceContextAction[] =>
          (record.rowActions ?? []).map((action) => ({
            key: action.id,
            label: resolveLocalizableString(action.label, record.extensionId),
            onClick: () => void runMutation(action.commandId, { rowId: row.id }),
          }))
      : undefined,
    onCreateRow: onCreateRow
      ? onCreateRow
      : record.createRow
        ? async (columnId) => {
            const { commandId, columnParam } = record.createRow as { commandId: string; columnParam?: string };
            const created = await executeCommand(commandId, { params: { [columnParam ?? "columnId"]: columnId } });
            refresh();
            onAfterCreate?.(created);
          }
        : undefined,
  };

  return { contribution, refresh };
};
