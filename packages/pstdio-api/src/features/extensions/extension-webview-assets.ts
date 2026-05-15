import { existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { loadExtensionSource } from "./extension-runtime";
import { classifyWebviewEntry, findExtensionWebview, resolveManagedWebviewPaths } from "./extension-webviews";
import { resolvePstdioHome } from "./install-extension-source";

type InstalledSourceLookup = {
  getInstalledSource: (
    installName: string,
  ) => Promise<{ install_name: string; source_path: string; last_error_json?: unknown } | null>;
};

export type WebviewBuildError = {
  message: string;
  webviewId: string;
};

export const findWebviewBuildError = async (
  deps: { extensionService: InstalledSourceLookup },
  input: { installName: string; webviewId: string },
): Promise<WebviewBuildError | null> => {
  const source = await deps.extensionService.getInstalledSource(input.installName);
  if (!source?.last_error_json || typeof source.last_error_json !== "object") return null;

  const record = source.last_error_json as Record<string, unknown>;
  if (record.code !== "extension_webview_build_failed") return null;
  if (record.webviewId !== input.webviewId) return null;

  const message =
    typeof record.message === "string" && record.message.length > 0
      ? record.message
      : "Extension webview build failed.";
  return { message, webviewId: input.webviewId };
};

export const renderWebviewBuildErrorModule = (error: WebviewBuildError) =>
  `throw new Error(${JSON.stringify(`Extension webview build failed: ${error.message}`)});\n`;

export type ExtensionWebviewAssetDeps = {
  extensionService: InstalledSourceLookup;
  webviewCacheRoot?: string;
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "application/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "application/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const resolveMimeType = (filePath: string) => MIME_TYPES[extname(filePath)] ?? "application/octet-stream";

const safeResolve = (root: string, requestedPath: string) => {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, requestedPath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${sep}`)) return null;
  return resolvedPath;
};

const defaultWebviewCacheRoot = () => join(resolvePstdioHome({ env: process.env }), "cache", "extension-webviews");

export const resolveWebviewAssetFile = async (
  deps: ExtensionWebviewAssetDeps,
  input: { assetPath?: string; installName: string; webviewId: string },
) => {
  const source = await deps.extensionService.getInstalledSource(input.installName);
  if (!source) return null;

  const loaded = await loadExtensionSource(source.source_path);
  const webview = findExtensionWebview(loaded, input.webviewId);
  if (!webview) return null;

  const classification = classifyWebviewEntry(webview.entry);
  if (classification.kind === "unsupported") return null;

  const requested = input.assetPath?.replace(/^\/+/, "") ?? "";
  const root = resolveManagedWebviewPaths({
    installName: source.install_name,
    webviewCacheRoot: deps.webviewCacheRoot ?? defaultWebviewCacheRoot(),
    webviewId: input.webviewId,
  }).distDir;
  const defaultPath = "module.js";
  const filePath = safeResolve(root, requested || defaultPath);
  if (!filePath || !existsSync(filePath)) return null;

  const stat = statSync(filePath);
  if (!stat.isFile()) return null;

  return {
    filePath,
    mimeType: resolveMimeType(filePath),
  };
};
