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

const collectWebview = (webviews: WebviewContributionRecord[], id: string, body: Record<string, unknown>) => {
  if (body.kind !== "webview" || !isPackageAssetDescriptor(body.entry)) return;
  webviews.push({ id, entry: body.entry });
};

export const collectExtensionWebviews = (loaded: Pick<LoadedExtension, "definition" | "metadata">) => {
  const webviews: WebviewContributionRecord[] = [];

  const views = loaded.definition.views;
  if (!Array.isArray(views)) return webviews;
  for (const view of views) {
    if (!isRecord(view) || typeof view.id !== "string" || !isRecord(view.body)) continue;
    collectWebview(webviews, `${loaded.metadata.id}.view.${view.id}`, view.body);
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
