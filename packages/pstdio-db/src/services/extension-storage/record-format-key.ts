import type { StorageIndexField } from "pstdio-sync-contracts";

export const formatCachePrefix = "@pstdio/query-format/";
export const formatCacheFields = new WeakMap<StorageIndexField, string>();
export const formatCacheSource = (name: string) => {
  if (!name.startsWith(formatCachePrefix)) return undefined;
  return JSON.parse(name.slice(formatCachePrefix.length)) as [string, string, string];
};
