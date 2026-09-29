import { existsSync, readdirSync } from "node:fs";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import type { PackageAssetDescriptor } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionRuntime } from "pstdio-extensions";
import { createWorkbenchExtensionMetadata, type ResolveWorkbenchExtensionWebview } from "pstdio-extensions/workbench";
import type { ExtensionWebviewUrlIssuer } from "./extension-webview-access";
import { classifyWebviewEntry, resolveManagedWebviewPaths } from "./extension-webviews";

type ExtensionIdMap = Map<string, string>;
type InstallNameMap = Map<string, string>;
type AssetRevisionMap = Map<string, string | null | undefined>;
type ExtensionWebviewRecord = Extract<
  WorkbenchExtensionMetadata["views"][number]["body"],
  { kind: "webview" }
>["webview"];

const listDistCssFiles = (installedExtensionId: string, webviewId: string, webviewCacheRoot: string) => {
  const { distDir } = resolveManagedWebviewPaths({ installedExtensionId, webviewCacheRoot, webviewId });
  if (!existsSync(distDir)) return [] as string[];
  return readdirSync(distDir).filter((file) => file.endsWith(".css"));
};

interface WebviewAssets {
  urlIssuer: ExtensionWebviewUrlIssuer;
  installedExtensionIdsByExtensionId?: ExtensionIdMap;
  assetRevisionsByExtensionId?: AssetRevisionMap;
  webviewCacheRoot: string;
}

const createResolveWebview = (assets: WebviewAssets): ResolveWorkbenchExtensionWebview => {
  return ({ extensionId, id, webview }) => {
    const classification = classifyWebviewEntry(webview.entry as PackageAssetDescriptor);
    if (classification.kind !== "managed") return null;

    // Assets are built and served per installed source. An extension that is not installed
    // yet (a marketplace preview) still lists its views, but has nothing to serve.
    const installedExtensionId = assets.installedExtensionIdsByExtensionId?.get(extensionId);
    if (!installedExtensionId) return { ...webview, runtimeUrl: "", moduleUrl: "" } as ExtensionWebviewRecord;

    const assetRevision = assets.assetRevisionsByExtensionId?.get(extensionId);
    const cssFiles = listDistCssFiles(installedExtensionId, id, assets.webviewCacheRoot);
    const scope = { installedExtensionId, webviewId: id };
    return {
      ...webview,
      runtimeUrl: assets.urlIssuer.runtimeUrl(scope),
      moduleUrl: assets.urlIssuer.assetUrl(scope, "module.js", assetRevision),
      styles: cssFiles.map((file) => assets.urlIssuer.assetUrl(scope, file, assetRevision)),
    } as ExtensionWebviewRecord;
  };
};

export interface BuildWorkbenchExtensionMetadataInput {
  runtime: ExtensionRuntime;
  webviewUrlIssuer: ExtensionWebviewUrlIssuer;
  extensionInstanceIdsByExtensionId?: ExtensionIdMap;
  /** Maps an extensionId to its installed source row; webview asset URLs and build caches belong to that row. */
  installedExtensionIdsByExtensionId?: ExtensionIdMap;
  installNamesByExtensionId: InstallNameMap;
  /** Maps an extensionId to the most recent completed webview build revision for asset cache busting. */
  assetRevisionsByExtensionId?: AssetRevisionMap;
  /** Root cache directory the build manager writes built webview assets into. */
  webviewCacheRoot: string;
}

export const buildWorkbenchExtensionMetadata = (
  input: BuildWorkbenchExtensionMetadataInput,
): WorkbenchExtensionMetadata => {
  const metadata = createWorkbenchExtensionMetadata({
    runtime: input.runtime,
    resolveWebview: createResolveWebview({
      assetRevisionsByExtensionId: input.assetRevisionsByExtensionId,
      installedExtensionIdsByExtensionId: input.installedExtensionIdsByExtensionId,
      urlIssuer: input.webviewUrlIssuer,
      webviewCacheRoot: input.webviewCacheRoot,
    }),
  });

  return {
    ...metadata,
    extensions: metadata.extensions.map((extension) => ({
      ...extension,
      extensionInstanceId: input.extensionInstanceIdsByExtensionId?.get(extension.id),
      installedExtensionId: input.installedExtensionIdsByExtensionId?.get(extension.id),
      installName: input.installNamesByExtensionId.get(extension.id),
    })),
  };
};
