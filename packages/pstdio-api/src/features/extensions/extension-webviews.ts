import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";
import type { LoadedExtension } from "./extension-runtime";

type WebviewContributionRecord = {
  entry: PackageAssetDescriptor;
  id: string;
};

type WebviewEntryClassification = { kind: "managed" } | { kind: "static" } | { extension: string; kind: "unsupported" };

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
  if (extension === ".html") return { kind: "static" };
  if (managedExtensions.has(extension)) return { kind: "managed" };
  return { extension, kind: "unsupported" };
};

const contributionMaps = ["activityRenderers", "routes", "sessionAnchorRenderers", "settingsPanels", "views"] as const;

export const collectExtensionWebviews = (loaded: Pick<LoadedExtension, "definition" | "metadata">) => {
  const webviews: WebviewContributionRecord[] = [];

  for (const mapKey of contributionMaps) {
    const contributions = loaded.definition[mapKey];
    if (!isRecord(contributions)) continue;

    for (const [key, contribution] of Object.entries(contributions)) {
      if (!isRecord(contribution) || !isRecord(contribution.webview)) continue;
      if (!isPackageAssetDescriptor(contribution.webview.entry)) continue;
      webviews.push({
        id: `${loaded.metadata.namespace}.${key}`,
        entry: contribution.webview.entry,
      });
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
