import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageAssetDescriptor } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtension } from "./extension-runtime";

type WebviewContributionRecord = {
  entry: PackageAssetDescriptor;
  id: string;
};

type WebviewEntryClassification = { kind: "managed" } | { extension: string; kind: "unsupported" };

const managedExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isPackageAssetDescriptor = (value: unknown): value is PackageAssetDescriptor =>
  isRecord(value) &&
  value.kind === "package-asset" &&
  typeof value.path === "string" &&
  typeof value.baseUrl === "string";

export const classifyWebviewEntry = (asset: PackageAssetDescriptor): WebviewEntryClassification => {
  const extension = extname(asset.path).toLowerCase();
  if (managedExtensions.has(extension)) return { kind: "managed" };
  return { extension, kind: "unsupported" };
};

const contributionMaps = ["activityRenderers", "panels", "routes", "sessionAnchorRenderers", "settingsPanels"] as const;

const collectWebview = (webviews: WebviewContributionRecord[], id: string, contribution: Record<string, unknown>) => {
  if (!isRecord(contribution.webview) || !isPackageAssetDescriptor(contribution.webview.entry)) return;
  webviews.push({ id, entry: contribution.webview.entry });
};

export const collectExtensionWebviews = (loaded: Pick<LoadedExtension, "definition" | "metadata">) => {
  const webviews: WebviewContributionRecord[] = [];

  for (const mapKey of contributionMaps) {
    const contributions = loaded.definition[mapKey];
    if (!isRecord(contributions)) continue;

    for (const [key, contribution] of Object.entries(contributions)) {
      if (!isRecord(contribution)) continue;
      const contributionId = `${loaded.metadata.name}.${key}`;
      collectWebview(webviews, contributionId, contribution);
      if (mapKey !== "panels" || !isRecord(contribution.panelMenus)) continue;
      for (const [menuId, menu] of Object.entries(contribution.panelMenus)) {
        if (isRecord(menu)) collectWebview(webviews, `${contributionId}.${menuId}`, menu);
      }
    }
  }

  return webviews;
};

export const findExtensionWebview = (loaded: Pick<LoadedExtension, "definition" | "metadata">, webviewId: string) =>
  collectExtensionWebviews(loaded).find((webview) => webview.id === webviewId) ?? null;

export const resolvePackageAssetFile = (asset: PackageAssetDescriptor) =>
  fileURLToPath(new URL(asset.path, asset.baseUrl));

export const safeWebviewId = (webviewId: string) => webviewId.replace(/[^a-zA-Z0-9._-]/g, "_");

export const resolveManagedWebviewPaths = (input: {
  installName: string;
  webviewCacheRoot: string;
  webviewId: string;
}) => {
  const root = join(input.webviewCacheRoot, input.installName, safeWebviewId(input.webviewId));
  return {
    distDir: join(root, "dist"),
    root,
    shellDir: join(root, "source"),
    shellPath: join(root, "source", "index.html"),
  };
};

export type CollectedExtensionWebview = ReturnType<typeof collectExtensionWebviews>[number];
export type WebviewEntryKind = ReturnType<typeof classifyWebviewEntry>["kind"];
