import type { RouteDeps } from "../deps";

export type ExtensionsRouteDeps = Pick<RouteDeps, "extensionService"> & {
  webviewCacheRoot?: string;
};
