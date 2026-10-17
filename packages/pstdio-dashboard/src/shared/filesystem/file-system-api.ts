import { getApiClient } from "@/lib/api";

export type { DirectoryEntry } from "@pstdio/sdk/client";
export type DirectoryListResponse = Awaited<ReturnType<ReturnType<typeof getApiClient>["filesystem"]["list"]>>;
export const listDirectory = (path?: string) => getApiClient().filesystem.list(path?.trim() || undefined);
export const createDirectory = (parent_path: string, name: string) =>
  getApiClient().filesystem.createDirectory({ parent_path, name });
