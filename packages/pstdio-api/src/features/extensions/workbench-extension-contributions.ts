import type {
  ExtensionTreeItemContribution,
  WorkbenchExtensionCommandPaletteResourceRecord,
  WorkbenchExtensionControlsRendererRecord,
  WorkbenchExtensionDataTableRendererRecord,
  WorkbenchExtensionKanbanRendererRecord,
} from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";

const refIdOf = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
};

const compact = <T>(items: Array<T | null>) => items.filter((item): item is T => item !== null);

const toKanbanRendererCreateRow = (
  createRow: ExtensionRuntime["kanbanRenderers"][number]["contribution"]["createRow"],
): WorkbenchExtensionKanbanRendererRecord["createRow"] => {
  if (!createRow) return undefined;
  const commandId = refIdOf(createRow.command);
  if (!commandId) return undefined;
  const attachmentCommandId = createRow.attachments ? refIdOf(createRow.attachments.command) : undefined;
  return {
    commandId,
    title: createRow.title,
    submitLabel: createRow.submitLabel,
    columnParam: createRow.columnParam,
    params: createRow.params as NonNullable<WorkbenchExtensionKanbanRendererRecord["createRow"]>["params"],
    attributesParam: createRow.attributesParam,
    labels: createRow.labels,
    attachments:
      createRow.attachments && attachmentCommandId
        ? {
            commandId: attachmentCommandId,
            resourceParam: createRow.attachments.resourceParam,
            fileParam: createRow.attachments.fileParam,
          }
        : undefined,
  };
};

const toKanbanRendererRowActions = (
  rowActions: ExtensionRuntime["kanbanRenderers"][number]["contribution"]["rowActions"],
): WorkbenchExtensionKanbanRendererRecord["rowActions"] =>
  compact(
    (rowActions ?? []).map((action) => {
      const commandId = refIdOf(action.command);
      if (!commandId) return null;
      return {
        id: action.id,
        label: action.label,
        icon: action.icon,
        commandId,
        destructive: action.destructive,
      };
    }),
  );

export const toKanbanRendererRecord = (
  renderer: ExtensionRuntime["kanbanRenderers"][number],
): WorkbenchExtensionKanbanRendererRecord | null => {
  const handlers = renderer.contribution as {
    queryHandlerId?: string;
    attributeChangeHandlerId?: string;
    reorderHandlerId?: string;
    columnActionHandlerId?: string;
    rowActivationHandlerId?: string;
  };
  if (!handlers.queryHandlerId) return null;

  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    resourceKind: renderer.contribution.resourceKind,
    attributes: renderer.contribution.attributes,
    queryHandlerId: handlers.queryHandlerId,
    attributeChangeHandlerId: handlers.attributeChangeHandlerId,
    reorderHandlerId: handlers.reorderHandlerId,
    columnActionHandlerId: handlers.columnActionHandlerId,
    rowActivationHandlerId: handlers.rowActivationHandlerId,
    createRow: toKanbanRendererCreateRow(renderer.contribution.createRow),
    rowActions: toKanbanRendererRowActions(renderer.contribution.rowActions),
    defaultSettings: renderer.contribution.defaultSettings,
    defaultFilters: renderer.contribution.defaultFilters,
    emptyTitle: renderer.contribution.emptyTitle,
    emptyDescription: renderer.contribution.emptyDescription,
    hideToolbar: renderer.contribution.hideToolbar,
  };
};

export const toDataTableRendererRecord = (
  renderer: ExtensionRuntime["dataTableRenderers"][number],
): WorkbenchExtensionDataTableRendererRecord | null => {
  const handlers = renderer.contribution as { queryHandlerId?: string; rowActivationHandlerId?: string };
  if (!handlers.queryHandlerId) return null;
  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    resourceKind: renderer.contribution.resourceKind,
    columns: renderer.contribution.columns,
    queryHandlerId: handlers.queryHandlerId,
    selectionMode: renderer.contribution.selectionMode,
    selectionActions: compact(
      (renderer.contribution.selectionActions ?? []).map((action) => {
        const commandId = refIdOf(action.command);
        return commandId
          ? {
              id: action.id,
              label: action.label,
              icon: action.icon,
              destructive: action.destructive,
              commandId,
            }
          : null;
      }),
    ),
    rowActions: compact(
      (renderer.contribution.rowActions ?? []).map((action) => {
        const commandId = refIdOf(action.command);
        return commandId
          ? {
              id: action.id,
              label: action.label,
              icon: action.icon,
              destructive: action.destructive,
              commandId,
            }
          : null;
      }),
    ),
    rowActivationHandlerId: handlers.rowActivationHandlerId,
    initialPageSize: renderer.contribution.initialPageSize,
    pageSizeOptions: renderer.contribution.pageSizeOptions,
    emptyTitle: renderer.contribution.emptyTitle,
    emptyDescription: renderer.contribution.emptyDescription,
  };
};

export const toCommandPaletteResourceRecord = (
  provider: ExtensionRuntime["commandPaletteResources"][number],
): WorkbenchExtensionCommandPaletteResourceRecord | null => {
  const queryCommandId = refIdOf(provider.contribution.queryCommand);
  if (!queryCommandId) return null;
  const refreshEventIds = compact((provider.contribution.refreshEvents ?? []).map((event) => refIdOf(event) ?? null));
  return {
    id: provider.id,
    extensionId: provider.extensionId,
    title: provider.contribution.title,
    resourceKind: provider.contribution.resourceKind,
    queryCommandId: resolveExtensionContributionId(provider.name, queryCommandId),
    refreshEventIds: refreshEventIds.length > 0 ? refreshEventIds : undefined,
  };
};

const resolveExtensionContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

export const toControlsRendererRecord = (
  renderer: ExtensionRuntime["controlsRenderers"][number],
): WorkbenchExtensionControlsRendererRecord | null => {
  const handlers = renderer.contribution as {
    queryHandlerId?: string;
    valueChangeHandlerId?: string;
    applyHandlerId?: string;
    resetHandlerId?: string;
  };
  if (!handlers.queryHandlerId) return null;

  const refreshEventIds = compact((renderer.contribution.refreshEvents ?? []).map((event) => refIdOf(event) ?? null));

  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    queryHandlerId: handlers.queryHandlerId,
    valueChangeHandlerId: handlers.valueChangeHandlerId,
    applyHandlerId: handlers.applyHandlerId,
    resetHandlerId: handlers.resetHandlerId,
    refreshEventIds: refreshEventIds.length > 0 ? refreshEventIds : undefined,
    defaultValues: renderer.contribution.defaultValues,
    emptyTitle: renderer.contribution.emptyTitle,
    emptyDescription: renderer.contribution.emptyDescription,
  };
};

const toTreeItemAction = (item: ExtensionRuntime["treeItems"][number]): ExtensionTreeItemContribution["action"] => {
  const action = item.contribution.action;

  if (action.kind === "command") {
    return {
      kind: "command",
      commandId: refIdOf(action.command) ?? "unknown",
      args: action.params as Record<string, unknown> | undefined,
    };
  }
  if (action.kind === "panel") {
    return {
      kind: "panel",
      panelId: resolveExtensionContributionId(item.name, action.panel),
    };
  }
  return action;
};

export const toTreeItemRecord = (item: ExtensionRuntime["treeItems"][number]): ExtensionTreeItemContribution => ({
  id: item.id,
  extensionId: item.extensionId,
  target: item.contribution.target,
  label: item.contribution.label,
  group: item.contribution.group,
  placement: item.contribution.placement,
  icon: item.contribution.icon,
  action: toTreeItemAction(item),
  when: item.contribution.when as ExtensionTreeItemContribution["when"],
});
