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
  context: Record<string, string | undefined> = {},
) => {
  const path = `/v1/extensions/routes/${encodeURIComponent(route.id)}/assets/${encodePath(assetPath)}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(context)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
};
