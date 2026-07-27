import { existsSync, readdirSync } from "node:fs";
import type { WorkbenchExtensionMetadata, WorkbenchExtensionRouteRecord } from "pstdio-api-contracts";
import type { PackageAssetDescriptor } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionRuntime } from "pstdio-extensions";
import { createWorkbenchExtensionMetadata, type ResolveWorkbenchExtensionWebview } from "pstdio-extensions/workbench";
import { EXTENSION_RUNTIME_PATH } from "./extension-runtime-routes";
import { classifyWebviewEntry, resolveManagedWebviewPaths } from "./extension-webviews";

type ExtensionIdMap = Map<string, string>;
type InstallNameMap = Map<string, string>;
type AssetRevisionMap = Map<string, string | null | undefined>;
type ExtensionWebviewRecord = WorkbenchExtensionRouteRecord["webview"];

const RUNTIME_URL = `/v1${EXTENSION_RUNTIME_PATH}`;

const buildAssetUrl = (installName: string, webviewId: string, file: string, sourceHash?: string | null) => {
  const path = `/v1/extensions/installed/${encodeURIComponent(installName)}/webviews/${encodeURIComponent(webviewId)}/${file}`;
  if (!sourceHash) return path;
  return `${path}?h=${encodeURIComponent(sourceHash)}`;
};

const listDistCssFiles = (installName: string, webviewId: string, webviewCacheRoot: string) => {
  const { distDir } = resolveManagedWebviewPaths({ installName, webviewCacheRoot, webviewId });
  if (!existsSync(distDir)) return [] as string[];
  return readdirSync(distDir).filter((file) => file.endsWith(".css"));
};

interface WebviewAssets {
  installNamesByExtensionId: InstallNameMap;
  assetRevisionsByExtensionId?: AssetRevisionMap;
  webviewCacheRoot: string;
}

const createResolveWebview = (assets: WebviewAssets): ResolveWorkbenchExtensionWebview => {
  return ({ extensionId, id, webview }) => {
    const installName = assets.installNamesByExtensionId.get(extensionId);
    if (!installName) return null;

    const classification = classifyWebviewEntry(webview.entry as PackageAssetDescriptor);
    if (classification.kind !== "managed") return null;

    const assetRevision = assets.assetRevisionsByExtensionId?.get(extensionId);
    const cssFiles = listDistCssFiles(installName, id, assets.webviewCacheRoot);
    return {
      ...webview,
      runtimeUrl: RUNTIME_URL,
      moduleUrl: buildAssetUrl(installName, id, "module.js", assetRevision),
      styles: cssFiles.map((file) => buildAssetUrl(installName, id, file, assetRevision)),
    } as ExtensionWebviewRecord;
  };
};

export interface BuildWorkbenchExtensionMetadataInput {
  runtime: ExtensionRuntime;
  extensionInstanceIdsByExtensionId?: ExtensionIdMap;
  installedExtensionIdsByExtensionId?: ExtensionIdMap;
  /** Maps an extensionId to the install folder name on disk (used to mint webview asset URLs). */
  installNamesByExtensionId: InstallNameMap;
  /** Maps an extensionId to the most recent completed webview build revision for asset cache busting. */
  assetRevisionsByExtensionId?: AssetRevisionMap;
  /** Root cache directory the build manager writes built webview assets into. */
  webviewCacheRoot: string;
}

const enrichInstallMetadata = <TRecord extends { extensionId: string }>(
  record: TRecord,
  input: BuildWorkbenchExtensionMetadataInput,
) => ({
  ...record,
  extensionInstanceId: input.extensionInstanceIdsByExtensionId?.get(record.extensionId),
  installedExtensionId: input.installedExtensionIdsByExtensionId?.get(record.extensionId),
  installName: input.installNamesByExtensionId.get(record.extensionId),
});

export const buildWorkbenchExtensionMetadata = (
  input: BuildWorkbenchExtensionMetadataInput,
): WorkbenchExtensionMetadata => {
  const metadata = createWorkbenchExtensionMetadata({
    runtime: input.runtime,
    resolveWebview: createResolveWebview({
      assetRevisionsByExtensionId: input.assetRevisionsByExtensionId,
      installNamesByExtensionId: input.installNamesByExtensionId,
      webviewCacheRoot: input.webviewCacheRoot,
    }),
  });

  return {
    ...metadata,
    keybindings: metadata.keybindings,
    kanbanRenderers: (metadata.kanbanRenderers ?? []).map((renderer) => enrichInstallMetadata(renderer, input)),
    views: metadata.views.map((view) => enrichInstallMetadata(view, input)),
    routes: metadata.routes.map((route) => enrichInstallMetadata(route, input)),
    settingsPanels: metadata.settingsPanels.map((panel) => enrichInstallMetadata(panel, input)),
  };
};
