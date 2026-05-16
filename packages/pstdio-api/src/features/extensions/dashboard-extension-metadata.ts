import { existsSync, readdirSync } from "node:fs";
import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";
import type {
  DashboardExtensionMetadata,
  DashboardExtensionRouteRecord,
  DashboardExtensionSettingsPanelRecord,
  DashboardExtensionViewRecord,
  ExtensionMenuContribution,
  ExtensionNavigationRecord,
  ExtensionRecord,
} from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";
import { toCommandRecord } from "./extension-command-runtime";
import { EXTENSION_RUNTIME_PATH } from "./extension-runtime-routes";
import { classifyWebviewEntry, resolveManagedWebviewPaths } from "./extension-webviews";

type InstallNameMap = Map<string, string>;
type ExtensionWebviewRecord = DashboardExtensionRouteRecord["webview"];

const RUNTIME_URL = `/v1${EXTENSION_RUNTIME_PATH}`;

const buildAssetUrl = (installName: string, webviewId: string, file: string) =>
  `/v1/extensions/installed/${encodeURIComponent(installName)}/webviews/${encodeURIComponent(webviewId)}/${file}`;

const listDistCssFiles = (installName: string, webviewId: string, webviewCacheRoot: string) => {
  const { distDir } = resolveManagedWebviewPaths({ installName, webviewCacheRoot, webviewId });
  if (!existsSync(distDir)) return [] as string[];
  return readdirSync(distDir).filter((file) => file.endsWith(".css"));
};

interface WebviewAssets {
  installNameByExtensionId: InstallNameMap;
  webviewCacheRoot: string;
}

const enrichWebview = <TWebview extends { entry: PackageAssetDescriptor; title?: string }>(
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
  return "unknown";
};

const refIdOf = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
};

const compact = <T>(items: Array<T | null>) => items.filter((item): item is T => item !== null);

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
        slotId: slotIdOf(menu.slot),
        label: menu.label ?? command.title,
        group: menu.group,
        placement: menu.placement,
        icon: menu.icon,
        presentation: menu.presentation,
        params: menu.params as Record<string, unknown> | undefined,
      });
    });
  }
  return contributions;
};

const toViewRecord = (
  view: ExtensionRuntime["views"][number],
  assets: WebviewAssets,
): DashboardExtensionViewRecord | null => {
  const webview = enrichWebview(view.contribution.webview, assets, view.extensionId, view.id);
  if (!webview) return null;

  return {
    id: view.id,
    extensionId: view.extensionId,
    slotId: slotIdOf(view.contribution.slot),
    title: view.contribution.title,
    group: view.contribution.group,
    placement: view.contribution.placement,
    webview,
  };
};

const toRouteRecord = (
  route: ExtensionRuntime["routes"][number],
  assets: WebviewAssets,
): DashboardExtensionRouteRecord | null => {
  const webview = enrichWebview(route.contribution.webview, assets, route.extensionId, route.id);
  if (!webview) return null;

  return {
    id: route.id,
    extensionId: route.extensionId,
    path: route.contribution.path,
    label: route.contribution.label,
    webview,
  };
};

const toNavigationRecord = (navigation: ExtensionRuntime["navigation"][number]): ExtensionNavigationRecord => ({
  id: navigation.id,
  extensionId: navigation.extensionId,
  slotId: slotIdOf(navigation.contribution.slot),
  label: navigation.contribution.label,
  group: navigation.contribution.group,
  placement: navigation.contribution.placement,
  route: navigation.contribution.route,
  href: navigation.contribution.href,
  commandId: refIdOf(navigation.contribution.command),
  params: navigation.contribution.params as Record<string, unknown> | undefined,
  icon: navigation.contribution.icon,
});

const toSettingsPanelRecord = (
  panel: ExtensionRuntime["settingsPanels"][number],
  assets: WebviewAssets,
): DashboardExtensionSettingsPanelRecord | null => {
  const webview = enrichWebview(panel.contribution.webview, assets, panel.extensionId, panel.id);
  if (!webview) return null;

  return {
    id: panel.id,
    extensionId: panel.extensionId,
    slotId: slotIdOf(panel.contribution.slot),
    title: panel.contribution.title,
    webview,
  };
};

export interface BuildDashboardExtensionMetadataInput {
  runtime: ExtensionRuntime;
  /** Maps an extensionId to the install folder name on disk (used to mint webview asset URLs). */
  installNamesByExtensionId: InstallNameMap;
  /** Root cache directory the build manager writes built webview assets into. */
  webviewCacheRoot: string;
}

export const buildDashboardExtensionMetadata = (
  input: BuildDashboardExtensionMetadataInput,
): DashboardExtensionMetadata => {
  const { runtime, installNamesByExtensionId, webviewCacheRoot } = input;
  const assets: WebviewAssets = { installNameByExtensionId: installNamesByExtensionId, webviewCacheRoot };

  return {
    extensions: runtime.extensions.map(toExtensionRecord),
    commands: runtime.commands.map(toCommandRecord),
    menuContributions: toMenuContributions(runtime.commands),
    views: compact(runtime.views.map((view) => toViewRecord(view, assets))),
    routes: compact(runtime.routes.map((route) => toRouteRecord(route, assets))),
    navigation: runtime.navigation.map(toNavigationRecord),
    settingsPanels: compact(runtime.settingsPanels.map((panel) => toSettingsPanelRecord(panel, assets))),
    diagnostics: runtime.diagnostics,
  };
};
