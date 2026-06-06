import { existsSync, readdirSync } from "node:fs";
import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";
import type {
  ExtensionMenuContribution,
  ExtensionModeRecord,
  ExtensionRecord,
  ExtensionSettingDefinitionRecord,
  ExtensionTreeItemContribution,
  WorkbenchExtensionDataRendererRecord,
  WorkbenchExtensionMetadata,
  WorkbenchExtensionRouteRecord,
  WorkbenchExtensionSettingsPanelRecord,
  WorkbenchExtensionTreeRendererRecord,
  WorkbenchExtensionViewRecord,
} from "pstdio-api-contracts";
import { type ExtensionRuntime, toCommandPaletteContributions } from "pstdio-extensions";
import { toCommandRecord } from "./extension-command-runtime";
import { normalizeModeLayout, reservedDashboardModeIds, resolveModeId } from "./extension-mode-layout";
import { EXTENSION_RUNTIME_PATH } from "./extension-runtime-routes";
import { classifyWebviewEntry, resolveManagedWebviewPaths } from "./extension-webviews";

type InstallNameMap = Map<string, string>;
type ExtensionIdMap = Map<string, string>;
type ExtensionWebviewRecord = WorkbenchExtensionRouteRecord["webview"];

const RUNTIME_URL = `/v1${EXTENSION_RUNTIME_PATH}`;

const buildAssetUrl = (installName: string, webviewId: string, file: string) =>
  `/v1/extensions/installed/${encodeURIComponent(installName)}/webviews/${encodeURIComponent(webviewId)}/${file}`;

const listDistCssFiles = (installName: string, webviewId: string, webviewCacheRoot: string) => {
  const { distDir } = resolveManagedWebviewPaths({ installName, webviewCacheRoot, webviewId });
  if (!existsSync(distDir)) return [] as string[];
  return readdirSync(distDir).filter((file) => file.endsWith(".css"));
};

interface WebviewAssets {
  extensionInstanceIdByExtensionId?: ExtensionIdMap;
  installedExtensionIdByExtensionId?: ExtensionIdMap;
  installNameByExtensionId: InstallNameMap;
  webviewCacheRoot: string;
}

const enrichWebview = <TWebview extends { entry: PackageAssetDescriptor }>(
  webview: TWebview,
  assets: WebviewAssets,
  extensionId: string,
  webviewId: string,
): ExtensionWebviewRecord | null => {
  const installName = assets.installNameByExtensionId.get(extensionId);
  if (!installName) return null;

  const classification = classifyWebviewEntry(webview.entry);
  if (classification.kind !== "managed") return null;

  const cssFiles = listDistCssFiles(installName, webviewId, assets.webviewCacheRoot);
  return {
    ...webview,
    runtimeUrl: RUNTIME_URL,
    moduleUrl: buildAssetUrl(installName, webviewId, "module.js"),
    styles: cssFiles.map((file) => buildAssetUrl(installName, webviewId, file)),
  };
};

const slotIdOf = (slot: unknown) => {
  if (typeof slot === "string") return slot;
  if (slot && typeof slot === "object" && "id" in slot && typeof (slot as { id: unknown }).id === "string") {
    return (slot as { id: string }).id;
  }
  return undefined;
};

const refIdOf = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
};

const compact = <T>(items: Array<T | null>) => items.filter((item): item is T => item !== null);

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
  if (resourceTypes.includes("ticket")) return `ticket.${header}`;
  if (resourceTypes.includes("session") || includesWhenValue(when?.mode, "sessions")) return `session.${header}`;
  return `project.${header}`;
};

const legacySettingsSlotId = (panel: ExtensionRuntime["settingsPanels"][number]["contribution"]) => {
  const slotId = slotIdOf(panel.slot);
  if (slotId) return slotId;
  return panel.scope === "global" ? "global.settingsPanels" : "project.settingsPanels";
};

const legacyViewSlotId = (view: ExtensionRuntime["views"][number]["contribution"]) =>
  slotIdOf(view.slot) ?? view.target ?? "unknown";

const toExtensionRecord = (extension: ExtensionRuntime["extensions"][number]): ExtensionRecord => ({
  id: extension.id,
  name: extension.name,
  displayName: extension.displayName,
  version: extension.version,
  description: extension.description,
  sourcePath: extension.sourcePath,
});

const toMenuContributions = (commands: ExtensionRuntime["commands"]): ExtensionMenuContribution[] => {
  const contributions: ExtensionMenuContribution[] = [];
  for (const command of commands) {
    command.menus.forEach((menu, index) => {
      contributions.push({
        id: `${command.id}.menu.${index}`,
        extensionId: command.extensionId,
        commandId: refIdOf(menu.command) ?? command.id,
        slotId: legacyMenuSlotId(menu),
        target: menu.target,
        label: menu.label ?? command.title,
        group: menu.group,
        placement: menu.placement,
        icon: menu.icon,
        presentation: menu.presentation,
        params: menu.params as Record<string, unknown> | undefined,
        when: menu.when as ExtensionMenuContribution["when"],
      });
    });
  }
  return contributions;
};

const toViewRecord = (
  view: ExtensionRuntime["views"][number],
  assets: WebviewAssets,
): WorkbenchExtensionViewRecord | null => {
  const treeRendererId =
    typeof view.contribution.treeRenderer === "string"
      ? resolveExtensionContributionId(view.name, view.contribution.treeRenderer)
      : undefined;
  const webview = view.contribution.webview
    ? (enrichWebview(view.contribution.webview, assets, view.extensionId, view.id) ?? undefined)
    : undefined;
  if (!treeRendererId && !webview) return null;

  return {
    id: view.id,
    extensionId: view.extensionId,
    extensionInstanceId: assets.extensionInstanceIdByExtensionId?.get(view.extensionId),
    installedExtensionId: assets.installedExtensionIdByExtensionId?.get(view.extensionId),
    installName: assets.installNameByExtensionId.get(view.extensionId),
    slotId: legacyViewSlotId(view.contribution),
    target: view.contribution.target,
    title: view.contribution.title,
    group: view.contribution.group,
    placement: view.contribution.placement,
    resourceKind: view.contribution.resourceKind,
    surface: view.contribution.surface,
    ...(webview ? { webview } : {}),
    ...(treeRendererId ? { treeRendererId } : {}),
  };
};

const toRouteRecord = (
  route: ExtensionRuntime["routes"][number],
  assets: WebviewAssets,
): WorkbenchExtensionRouteRecord | null => {
  const webview = enrichWebview(route.contribution.webview, assets, route.extensionId, route.id);
  if (!webview) return null;

  return {
    id: route.id,
    extensionId: route.extensionId,
    extensionInstanceId: assets.extensionInstanceIdByExtensionId?.get(route.extensionId),
    installedExtensionId: assets.installedExtensionIdByExtensionId?.get(route.extensionId),
    installName: assets.installNameByExtensionId.get(route.extensionId),
    path: route.contribution.path,
    label: route.contribution.label,
    webview,
  };
};

const toDataRendererCreateRow = (
  createRow: ExtensionRuntime["dataRenderers"][number]["contribution"]["createRow"],
): WorkbenchExtensionDataRendererRecord["createRow"] => {
  if (!createRow) return undefined;
  const commandId = refIdOf(createRow.command);
  if (!commandId) return undefined;
  return {
    commandId,
    title: createRow.title,
    submitLabel: createRow.submitLabel,
    columnParam: createRow.columnParam,
    params: createRow.params as NonNullable<WorkbenchExtensionDataRendererRecord["createRow"]>["params"],
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

const toDataRendererRecord = (
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

const toTreeRendererRecord = (
  renderer: ExtensionRuntime["treeRenderers"][number],
): WorkbenchExtensionTreeRendererRecord | null => {
  const bodyCommandId = refIdOf(renderer.contribution.bodyCommand);
  if (!bodyCommandId) return null;

  return {
    id: renderer.id,
    extensionId: renderer.extensionId,
    title: renderer.contribution.title,
    icon: renderer.contribution.icon,
    bodyCommandId,
    childrenCommandId: refIdOf(renderer.contribution.childrenCommand),
    footerCommandId: refIdOf(renderer.contribution.footerCommand),
    defaultExpandedSectionIds: renderer.contribution.defaultExpandedSectionIds,
    defaultExpandedNodeIds: renderer.contribution.defaultExpandedNodeIds,
  };
};

const resolveExtensionContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

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

const toTreeItemRecord = (item: ExtensionRuntime["treeItems"][number]): ExtensionTreeItemContribution => ({
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

const viewIdsByExtensionId = (views: ExtensionRuntime["views"]) => {
  const byExtension = new Map<string, Map<string, string>>();
  for (const view of views) {
    const extensionViews = byExtension.get(view.extensionId) ?? new Map<string, string>();
    extensionViews.set(view.localId, view.id);
    byExtension.set(view.extensionId, extensionViews);
  }
  return byExtension;
};

const toModeRecords = (runtime: ExtensionRuntime) => {
  const modes: ExtensionModeRecord[] = [];
  const diagnostics: WorkbenchExtensionMetadata["diagnostics"] = [...runtime.diagnostics];
  const modeIds = new Set(reservedDashboardModeIds);
  const viewIds = viewIdsByExtensionId(runtime.views);

  for (const mode of runtime.modes) {
    const modeId = resolveModeId({
      extensionName: mode.name,
      localId: mode.localId,
      id: mode.contribution.id,
    });

    if (modeIds.has(modeId)) {
      diagnostics.push({
        code: "extension_mode_duplicate",
        extensionId: mode.extensionId,
        message: `Extension "${mode.extensionId}" declares duplicate workbench mode "${modeId}"`,
        metadata: { modeId },
        severity: "error",
        sourcePath: mode.sourcePath,
      });
      continue;
    }

    const normalized = normalizeModeLayout({
      extensionId: mode.extensionId,
      extensionName: mode.name,
      layout: mode.contribution.layout,
      modeId,
      sourcePath: mode.sourcePath,
      viewIdsByLocalId: viewIds.get(mode.extensionId) ?? new Map<string, string>(),
    });
    if (normalized.diagnostic) {
      diagnostics.push(normalized.diagnostic);
      continue;
    }

    modeIds.add(modeId);
    modes.push({
      id: mode.id,
      extensionId: mode.extensionId,
      modeId,
      label: mode.contribution.label,
      icon: mode.contribution.icon,
      layout: normalized.layout,
    });
  }

  return { modes, diagnostics };
};

const toSettingsPanelRecord = (
  panel: ExtensionRuntime["settingsPanels"][number],
  assets: WebviewAssets,
): WorkbenchExtensionSettingsPanelRecord | null => {
  const webview = enrichWebview(panel.contribution.webview, assets, panel.extensionId, panel.id);
  if (!webview) return null;

  return {
    id: panel.id,
    extensionId: panel.extensionId,
    extensionInstanceId: assets.extensionInstanceIdByExtensionId?.get(panel.extensionId),
    installedExtensionId: assets.installedExtensionIdByExtensionId?.get(panel.extensionId),
    installName: assets.installNameByExtensionId.get(panel.extensionId),
    slotId: legacySettingsSlotId(panel.contribution),
    target: panel.contribution.target,
    scope: panel.contribution.scope,
    title: panel.contribution.title,
    webview,
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

export interface BuildWorkbenchExtensionMetadataInput {
  runtime: ExtensionRuntime;
  extensionInstanceIdsByExtensionId?: ExtensionIdMap;
  installedExtensionIdsByExtensionId?: ExtensionIdMap;
  /** Maps an extensionId to the install folder name on disk (used to mint webview asset URLs). */
  installNamesByExtensionId: InstallNameMap;
  /** Root cache directory the build manager writes built webview assets into. */
  webviewCacheRoot: string;
}

export const buildWorkbenchExtensionMetadata = (
  input: BuildWorkbenchExtensionMetadataInput,
): WorkbenchExtensionMetadata => {
  const { runtime, installNamesByExtensionId, webviewCacheRoot } = input;
  const assets: WebviewAssets = {
    extensionInstanceIdByExtensionId: input.extensionInstanceIdsByExtensionId,
    installedExtensionIdByExtensionId: input.installedExtensionIdsByExtensionId,
    installNameByExtensionId: installNamesByExtensionId,
    webviewCacheRoot,
  };
  const modes = toModeRecords(runtime);

  return {
    extensions: runtime.extensions.map(toExtensionRecord),
    commands: runtime.commands.map(toCommandRecord),
    menuContributions: toMenuContributions(runtime.commands),
    commandPaletteContributions: toCommandPaletteContributions(runtime.commands),
    modes: modes.modes,
    views: compact(runtime.views.map((view) => toViewRecord(view, assets))),
    routes: compact(runtime.routes.map((route) => toRouteRecord(route, assets))),
    navigation: [],
    treeItems: runtime.treeItems.map(toTreeItemRecord),
    settingsPanels: compact(runtime.settingsPanels.map((panel) => toSettingsPanelRecord(panel, assets))),
    dataRenderers: compact(runtime.dataRenderers.map(toDataRendererRecord)),
    treeRenderers: compact(runtime.treeRenderers.map(toTreeRendererRecord)),
    settingsDefinitions: runtime.settings.map(toSettingDefinitionRecord),
    diagnostics: modes.diagnostics,
  };
};
