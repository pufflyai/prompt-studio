import type {
  ExtensionTreeItemContribution,
  WorkbenchExtensionCommandPaletteResourceRecord,
  WorkbenchExtensionControlsRendererRecord,
  WorkbenchExtensionDataRendererRecord,
  WorkbenchExtensionDataTableRendererRecord,
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

const toDataRendererCreateRow = (
  createRow: ExtensionRuntime["dataRenderers"][number]["contribution"]["createRow"],
): WorkbenchExtensionDataRendererRecord["createRow"] => {
  if (!createRow) return undefined;
  const commandId = refIdOf(createRow.command);
  if (!commandId) return undefined;
  const attachmentCommandId = createRow.attachments ? refIdOf(createRow.attachments.command) : undefined;
  return {
    commandId,
    title: createRow.title,
    submitLabel: createRow.submitLabel,
    columnParam: createRow.columnParam,
    params: createRow.params as NonNullable<WorkbenchExtensionDataRendererRecord["createRow"]>["params"],
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

const toDataRendererRowActions = (
  rowActions: ExtensionRuntime["dataRenderers"][number]["contribution"]["rowActions"],
): WorkbenchExtensionDataRendererRecord["rowActions"] =>
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

export const toDataRendererRecord = (
  renderer: ExtensionRuntime["dataRenderers"][number],
): WorkbenchExtensionDataRendererRecord | null => {
  const queryCommandId = refIdOf(renderer.contribution.queryCommand);
  if (!queryCommandId) return null;

  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    resourceKind: renderer.contribution.resourceKind,
    attributes: renderer.contribution.attributes,
    queryCommandId,
    updateAttributeCommandId: refIdOf(renderer.contribution.updateAttributeCommand),
    reorderCommandId: refIdOf(renderer.contribution.reorderCommand),
    columnActionCommandId: refIdOf(renderer.contribution.columnActionCommand),
    createRow: toDataRendererCreateRow(renderer.contribution.createRow),
    rowActions: toDataRendererRowActions(renderer.contribution.rowActions),
    defaultSettings: renderer.contribution.defaultSettings,
    defaultFilters: renderer.contribution.defaultFilters,
    emptyTitle: renderer.contribution.emptyTitle,
    emptyDescription: renderer.contribution.emptyDescription,
    hideToolbar: renderer.contribution.hideToolbar,
    savedViews: renderer.contribution.savedViews,
  };
};

export const toDataTableRendererRecord = (
  renderer: ExtensionRuntime["dataTableRenderers"][number],
): WorkbenchExtensionDataTableRendererRecord | null => {
  const queryCommandId = refIdOf(renderer.contribution.queryCommand);
  if (!queryCommandId) return null;
  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    resourceKind: renderer.contribution.resourceKind,
    columns: renderer.contribution.columns,
    queryCommandId,
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
  const queryCommandId = refIdOf(renderer.contribution.queryCommand);
  if (!queryCommandId) return null;

  const resolveCommand = (value: unknown) => {
    const id = refIdOf(value);
    return id ? resolveExtensionContributionId(renderer.name, id) : undefined;
  };
  const refreshEventIds = compact((renderer.contribution.refreshEvents ?? []).map((event) => refIdOf(event) ?? null));

  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    queryCommandId: resolveExtensionContributionId(renderer.name, queryCommandId),
    updateValueCommandId: resolveCommand(renderer.contribution.updateValueCommand),
    applyCommandId: resolveCommand(renderer.contribution.applyCommand),
    resetCommandId: resolveCommand(renderer.contribution.resetCommand),
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
  if (action.kind === "dataRenderer") {
    return {
      kind: "dataRenderer",
      dataRendererId: resolveExtensionContributionId(item.name, action.dataRenderer),
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
