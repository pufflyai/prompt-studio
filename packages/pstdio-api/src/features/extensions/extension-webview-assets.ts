import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { loadExtensionSource } from "./extension-runtime";
import {
  classifyWebviewEntry,
  findExtensionWebview,
  resolveManagedWebviewPaths,
  resolvePackageAssetFile,
} from "./extension-webviews";
import { resolvePstdioHome } from "./install-extension-source";

type InstalledSourceLookup = {
  getInstalledSource: (installName: string) => Promise<{ install_name: string; source_path: string } | null>;
};

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
  const root =
    classification.kind === "managed"
      ? resolveManagedWebviewPaths({
          installName: source.install_name,
          webviewCacheRoot: deps.webviewCacheRoot ?? defaultWebviewCacheRoot(),
          webviewId: input.webviewId,
        }).distDir
      : dirname(resolvePackageAssetFile(webview.entry));
  const defaultPath =
    classification.kind === "managed" ? "index.html" : basename(resolvePackageAssetFile(webview.entry));
  const filePath = safeResolve(root, requested || defaultPath || "index.html");
  if (!filePath || !existsSync(filePath)) return null;

  const stat = statSync(filePath);
  if (!stat.isFile()) return null;

  return {
    filePath,
    mimeType: resolveMimeType(filePath),
  };
};
