import type { ExtensionRouteRecord } from "pstdio-api-contracts";

const trimRoutePath = (path: string) => path.replace(/^\/+|\/+$/gu, "");

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const basename = (path: string) => path.split(/[\\/]/u).filter(Boolean).at(-1) ?? "";

export const getExtensionRouteByPath = (routes: ExtensionRouteRecord[] | undefined, path: string | undefined) => {
  const normalizedPath = trimRoutePath(path ?? "");
  return (routes ?? []).find((route) => trimRoutePath(route.path) === normalizedPath);
};

export const buildExtensionRouteAssetUrl = (
  route: ExtensionRouteRecord,
  assetPath = basename(route.webview.entry.path),
) => `/v1/extensions/routes/${encodeURIComponent(route.id)}/assets/${encodePath(assetPath)}`;
