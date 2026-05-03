import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import type { Context } from "hono";
import { type RuntimeRouteRecord, resolvePackageAssetPath } from "pstdio-extensions";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const resolveMimeType = (filePath: string) => MIME_TYPES[extname(filePath)] ?? "application/octet-stream";

const isInside = (root: string, candidate: string) => {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const resolveRouteAssetPath = (route: RuntimeRouteRecord, requestedPath: string | undefined) => {
  const entryPath = resolvePackageAssetPath(route.contribution.webview.entry, { sourcePath: route.sourcePath });
  const assetRoot = dirname(entryPath);
  const assetPath = requestedPath && requestedPath.length > 0 ? requestedPath : basename(entryPath);
  const candidate = resolve(assetRoot, ...assetPath.split(/[\\/]/u).filter(Boolean));

  if (!isInside(assetRoot, candidate)) return null;
  return candidate;
};

const getRequestedAssetPath = (c: Context<AppBindings>) => {
  const marker = "/assets/";
  const markerIndex = c.req.path.indexOf(marker);
  if (markerIndex < 0) return c.req.param("*");

  try {
    return decodeURIComponent(c.req.path.slice(markerIndex + marker.length));
  } catch {
    return c.req.path.slice(markerIndex + marker.length);
  }
};

const serveFile = async (filePath: string) => {
  const stats = await stat(filePath);
  if (!stats.isFile()) return null;

  const bytes = await readFile(filePath);
  return new Response(bytes, {
    headers: {
      "cache-control": "no-cache",
      "content-type": resolveMimeType(filePath),
    },
  });
};

export const serveExtensionRouteAssetHandler = (deps: RouteDeps) => async (c: Context<AppBindings>) => {
  const routeId = c.req.param("routeId");
  const requestedPath = getRequestedAssetPath(c);
  const checkResult = await deps.extensionService.check();
  const route = checkResult.runtime.routes.find((candidate) => candidate.id === routeId);

  if (!route) {
    return c.json({ error: "Extension route not found" }, 404);
  }

  const assetPath = resolveRouteAssetPath(route, requestedPath);
  if (!assetPath) {
    return c.json({ error: "Extension route asset not found" }, 404);
  }

  try {
    const response = await serveFile(assetPath);
    return response ?? c.json({ error: "Extension route asset not found" }, 404);
  } catch {
    return c.json({ error: "Extension route asset not found" }, 404);
  }
};
