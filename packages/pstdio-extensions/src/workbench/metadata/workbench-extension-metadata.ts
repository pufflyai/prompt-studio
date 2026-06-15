import type {
  ExtensionKeybindingRecord,
  ExtensionMenuContribution,
  ExtensionSettingDefinitionRecord,
  ExtensionTreeItemContribution,
  WorkbenchExtensionCommandPaletteResourceRecord,
  WorkbenchExtensionDataRendererRecord,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";
import type { PackageAssetDescriptor, WebviewContribution } from "@pstdio/sdk/extensions";
import { toCommandPaletteContributions } from "../../runtime/command-palette-contributions";
import type { ExtensionRuntime } from "../../types/runtime";
import { toWorkbenchExtensionModeRecords } from "./workbench-extension-mode-metadata";

type WorkbenchExtensionWebview = NonNullable<WorkbenchExtensionMetadata["views"][number]["webview"]>;

export interface ResolveWorkbenchExtensionWebviewInput {
  extensionId: string;
  extensionName: string;
  id: string;
  sourcePath: string;
  webview: WebviewContribution & { entry: PackageAssetDescriptor };
}

export type ResolveWorkbenchExtensionWebview = (
  input: ResolveWorkbenchExtensionWebviewInput,
) => WorkbenchExtensionWebview | null | undefined;

export interface CreateWorkbenchExtensionMetadataInput {
  runtime: ExtensionRuntime;
  resolveWebview?: ResolveWorkbenchExtensionWebview;
}

const refIdOf = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
};

const slotIdOf = (slot: unknown) => {
  if (typeof slot === "string") return slot;
  if (slot && typeof slot === "object" && "id" in slot && typeof (slot as { id: unknown }).id === "string") {
    return (slot as { id: string }).id;
  }
  return undefined;
};

const compact = <T>(items: Array<T | null>) => items.filter((item): item is T => item !== null);

const resolveContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

const resolveOptionalContributionId = (extensionName: string, localOrFullId: string | undefined) =>
  localOrFullId ? resolveContributionId(extensionName, localOrFullId) : undefined;

const includesWhenValue = (value: string | string[] | undefined, expected: string) =>
  Array.isArray(value) ? value.includes(expected) : value === expected;

const legacyMenuSlotId = (menu: ExtensionRuntime["commands"][number]["menus"][number]) => {
  const slotId = slotIdOf(menu.slot);
  if (slotId) return slotId;

  const when = menu.when as ExtensionMenuContribution["when"] | undefined;
  const resourceTypes = when?.resourceType ?? [];
  const header =
    menu.target === "workbench.nav.actions"
      ? "headerPrimary"
      : menu.target === "workbench.nav.overflow"
        ? "headerOverflow"
        : undefined;

  if (!header) return "unknown";
  if (resourceTypes.includes("workspace") || includesWhenValue(when?.mode, "workspace")) return `workspace.${header}`;
  if (resourceTypes.includes("session") || includesWhenValue(when?.mode, "sessions")) return `session.${header}`;
  return `project.${header}`;
};

const legacySettingsSlotId = (panel: ExtensionRuntime["settingsPanels"][number]["contribution"]) =>
  slotIdOf(panel.slot) ?? (panel.scope === "global" ? "global.settingsPanels" : "project.settingsPanels");

const legacyViewSlotId = (view: ExtensionRuntime["views"][number]["contribution"]) =>
  slotIdOf(view.slot) ?? view.target ?? "unknown";

const toExtensionRecord = (extension: ExtensionRuntime["extensions"][number]) => ({
  id: extension.id,
  name: extension.name,
  displayName: extension.displayName,
  version: extension.version,
  description: extension.description,
  sourcePath: extension.sourcePath,
});

const toCommandRecord = (command: ExtensionRuntime["commands"][number]) => ({
  id: command.id,
  extensionId: command.extensionId,
  title: command.title,
  description: command.description,
  cliPath: command.cli?.pathKey,
  cliAliases: command.cli?.globalAliases?.map((alias) => alias.join(" ")),
  examples: command.cli?.examples,
  params: command.params as WorkbenchExtensionMetadata["commands"][number]["params"],
});

const toMenuContributions = (commands: ExtensionRuntime["commands"]): ExtensionMenuContribution[] =>
  commands.flatMap((command) =>
    command.menus.map((menu, index) => ({
      id: `${command.id}.menu.${index}`,
      extensionId: command.extensionId,
      commandId: resolveOptionalContributionId(command.name, refIdOf(menu.command)) ?? command.id,
      slotId: legacyMenuSlotId(menu),
      target: menu.target,
      label: menu.label ?? command.title,
      group: menu.group,
      placement: menu.placement,
      icon: menu.icon,
      presentation: menu.presentation,
      params: menu.params as Record<string, unknown> | undefined,
      when: menu.when as ExtensionMenuContribution["when"],
    })),
  );

const resolveWebview = (
  input: CreateWorkbenchExtensionMetadataInput,
  record: { extensionId: string; id: string; name: string; sourcePath: string },
  webview: WebviewContribution | undefined,
) => {
  if (!webview?.entry || !input.resolveWebview) return null;
  return (
    input.resolveWebview({
      extensionId: record.extensionId,
      extensionName: record.name,
      id: record.id,
      sourcePath: record.sourcePath,
      webview: webview as WebviewContribution & { entry: PackageAssetDescriptor },
    }) ?? null
  );
};

const toViewRecord = (
  input: CreateWorkbenchExtensionMetadataInput,
  view: ExtensionRuntime["views"][number],
): WorkbenchExtensionMetadata["views"][number] | null => {
  const treeRendererId =
    typeof view.contribution.treeRenderer === "string"
      ? resolveContributionId(view.name, view.contribution.treeRenderer)
      : undefined;
  const fileRendererId =
    typeof view.contribution.fileRenderer === "string"
      ? resolveContributionId(view.name, view.contribution.fileRenderer)
      : undefined;
  const webview = resolveWebview(input, view, view.contribution.webview) ?? undefined;
  if (!treeRendererId && !fileRendererId && !webview) return null;

  return {
    id: view.id,
    extensionId: view.extensionId,
    slotId: legacyViewSlotId(view.contribution),
    target: view.contribution.target,
    title: view.contribution.title,
    group: view.contribution.group,
    placement: view.contribution.placement,
    resourceKind: view.contribution.resourceKind,
    surface: view.contribution.surface,
    ...(webview ? { webview } : {}),
    ...(treeRendererId ? { treeRendererId } : {}),
    ...(fileRendererId ? { fileRendererId } : {}),
  };
};

const toRouteRecord = (
  input: CreateWorkbenchExtensionMetadataInput,
  route: ExtensionRuntime["routes"][number],
): WorkbenchExtensionMetadata["routes"][number] | null => {
  const webview = resolveWebview(input, route, route.contribution.webview);
  if (!webview) return null;
  return {
    id: route.id,
    extensionId: route.extensionId,
    path: route.contribution.path,
    label: route.contribution.label,
    webview,
  };
};

const toDataRendererCreateRow = (
  extensionName: string,
  createRow: ExtensionRuntime["dataRenderers"][number]["contribution"]["createRow"],
): WorkbenchExtensionDataRendererRecord["createRow"] => {
  const commandId = createRow ? resolveOptionalContributionId(extensionName, refIdOf(createRow.command)) : undefined;
  if (!createRow || !commandId) return undefined;
  return {
    commandId,
    title: createRow.title,
    submitLabel: createRow.submitLabel,
    columnParam: createRow.columnParam,
    params: createRow.params as NonNullable<WorkbenchExtensionDataRendererRecord["createRow"]>["params"],
  };
};

const toDataRendererRecord = (
  renderer: ExtensionRuntime["dataRenderers"][number],
): WorkbenchExtensionDataRendererRecord | null => {
  const queryCommandId = resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.queryCommand));
  if (!queryCommandId) return null;
  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    resourceKind: renderer.contribution.resourceKind,
    attributes: renderer.contribution.attributes,
    queryCommandId,
    updateAttributeCommandId: resolveOptionalContributionId(
      renderer.name,
      refIdOf(renderer.contribution.updateAttributeCommand),
    ),
    reorderCommandId: resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.reorderCommand)),
    columnActionCommandId: resolveOptionalContributionId(
      renderer.name,
      refIdOf(renderer.contribution.columnActionCommand),
    ),
    createRow: toDataRendererCreateRow(renderer.name, renderer.contribution.createRow),
    rowActions: compact(
      (renderer.contribution.rowActions ?? []).map((action) => {
        const commandId = resolveOptionalContributionId(renderer.name, refIdOf(action.command));
        if (!commandId) return null;
        return { id: action.id, label: action.label, icon: action.icon, commandId, destructive: action.destructive };
      }),
    ),
    defaultSettings: renderer.contribution.defaultSettings,
    defaultFilters: renderer.contribution.defaultFilters,
    emptyTitle: renderer.contribution.emptyTitle,
    emptyDescription: renderer.contribution.emptyDescription,
    hideToolbar: renderer.contribution.hideToolbar,
    savedViews: renderer.contribution.savedViews,
  };
};

const toCommandPaletteResourceRecord = (
  provider: ExtensionRuntime["commandPaletteResources"][number],
): WorkbenchExtensionCommandPaletteResourceRecord | null => {
  const queryCommandId = resolveOptionalContributionId(provider.name, refIdOf(provider.contribution.queryCommand));
  if (!queryCommandId) return null;
  const refreshEventIds = compact((provider.contribution.refreshEvents ?? []).map((event) => refIdOf(event) ?? null));
  return {
    id: provider.id,
    extensionId: provider.extensionId,
    title: provider.contribution.title,
    resourceKind: provider.contribution.resourceKind,
    queryCommandId,
    refreshEventIds: refreshEventIds.length > 0 ? refreshEventIds : undefined,
  };
};

const toTreeRendererRecord = (
  renderer: ExtensionRuntime["treeRenderers"][number],
): NonNullable<WorkbenchExtensionMetadata["treeRenderers"]>[number] | null => {
  const bodyCommandId = resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.bodyCommand));
  if (!bodyCommandId) return null;
  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    icon: renderer.contribution.icon,
    bodyCommandId,
    childrenCommandId: resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.childrenCommand)),
    footerCommandId: resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.footerCommand)),
    defaultExpandedSectionIds: renderer.contribution.defaultExpandedSectionIds,
    defaultExpandedNodeIds: renderer.contribution.defaultExpandedNodeIds,
  };
};

const toFileRendererRecord = (
  renderer: ExtensionRuntime["fileRenderers"][number],
): NonNullable<WorkbenchExtensionMetadata["fileRenderers"]>[number] | null => {
  const loadCommandId = resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.loadCommand));
  if (!loadCommandId) return null;
  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    icon: renderer.contribution.icon,
    resourceKind: renderer.contribution.resourceKind,
    loadCommandId,
    saveCommandId: resolveOptionalContributionId(renderer.name, refIdOf(renderer.contribution.saveCommand)),
  };
};

const toTreeItemRecord = (item: ExtensionRuntime["treeItems"][number]): ExtensionTreeItemContribution => {
  const action = item.contribution.action;
  return {
    id: item.id,
    extensionId: item.extensionId,
    target: item.contribution.target,
    label: item.contribution.label,
    group: item.contribution.group,
    placement: item.contribution.placement,
    icon: item.contribution.icon,
    action:
      action.kind === "command"
        ? {
            kind: "command",
            commandId: resolveOptionalContributionId(item.name, refIdOf(action.command)) ?? "unknown",
            args: action.params as Record<string, unknown> | undefined,
          }
        : action.kind === "dataRenderer"
          ? { kind: "dataRenderer", dataRendererId: resolveContributionId(item.name, action.dataRenderer) }
          : action,
    when: item.contribution.when as ExtensionTreeItemContribution["when"],
  };
};

const toSettingsPanelRecord = (
  input: CreateWorkbenchExtensionMetadataInput,
  panel: ExtensionRuntime["settingsPanels"][number],
): WorkbenchExtensionMetadata["settingsPanels"][number] | null => {
  const webview = resolveWebview(input, panel, panel.contribution.webview);
  if (!webview) return null;
  return {
    id: panel.id,
    extensionId: panel.extensionId,
    slotId: legacySettingsSlotId(panel.contribution),
    target: panel.contribution.target,
    scope: panel.contribution.scope,
    title: panel.contribution.title,
    webview,
  };
};

export const toKeybindingRecord = (binding: ExtensionRuntime["keybindings"][number]): ExtensionKeybindingRecord => {
  const overrides: ExtensionKeybindingRecord["platformOverrides"] = {};
  if (binding.contribution.mac) overrides.mac = binding.contribution.mac;
  if (binding.contribution.linux) overrides.linux = binding.contribution.linux;
  if (binding.contribution.win) overrides.win = binding.contribution.win;
  const hasOverrides = Object.keys(overrides).length > 0;

  return {
    id: binding.id,
    extensionId: binding.extensionId,
    commandId: binding.commandId,
    key: binding.contribution.key,
    canonicalChord: binding.canonicalChord,
    parsed: binding.parsed,
    platformOverrides: hasOverrides ? overrides : undefined,
    when: binding.when as ExtensionKeybindingRecord["when"],
    args: binding.contribution.args as Record<string, unknown> | undefined,
  };
};

const toSettingDefinitionRecord = (
  setting: ExtensionRuntime["settings"][number],
): ExtensionSettingDefinitionRecord => ({
  key: setting.key,
  extensionId: setting.extensionId,
  type: setting.contribution.type,
  scope: setting.contribution.scope,
  default: setting.contribution.default,
  enum: setting.contribution.enum,
  title: setting.contribution.title,
  description: setting.contribution.description,
});

export const createWorkbenchExtensionMetadata = (
  input: CreateWorkbenchExtensionMetadataInput,
): WorkbenchExtensionMetadata => {
  const modes = toWorkbenchExtensionModeRecords(input.runtime);
  return {
    extensions: input.runtime.extensions.map(toExtensionRecord),
    commands: input.runtime.commands.map(toCommandRecord),
    menuContributions: toMenuContributions(input.runtime.commands),
    commandPaletteContributions: toCommandPaletteContributions(input.runtime.commands),
    modes: modes.modes,
    views: compact(input.runtime.views.map((view) => toViewRecord(input, view))),
    routes: compact(input.runtime.routes.map((route) => toRouteRecord(input, route))),
    navigation: [],
    treeItems: input.runtime.treeItems.map(toTreeItemRecord),
    settingsPanels: compact(input.runtime.settingsPanels.map((panel) => toSettingsPanelRecord(input, panel))),
    dataRenderers: compact(input.runtime.dataRenderers.map(toDataRendererRecord)),
    commandPaletteResources: compact(input.runtime.commandPaletteResources.map(toCommandPaletteResourceRecord)),
    treeRenderers: compact(input.runtime.treeRenderers.map(toTreeRendererRecord)),
    fileRenderers: compact(input.runtime.fileRenderers.map(toFileRendererRecord)),
    keybindings: input.runtime.keybindings.map(toKeybindingRecord),
    settingsDefinitions: input.runtime.settings.map(toSettingDefinitionRecord),
    diagnostics: modes.diagnostics,
  };
};
