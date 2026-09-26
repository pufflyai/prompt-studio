import type { RequestFn } from "./request";

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
}
export const createFilesystemClient = (request: RequestFn) => ({
  list: (path?: string) =>
    request<{ currentPath: string; entries: DirectoryEntry[] }>(
      `/v1/filesystem/list${path ? `?path=${encodeURIComponent(path)}` : ""}`,
    ),
  createDirectory: (input: { parent_path: string; name: string }) =>
    request<{ path: string }>("/v1/filesystem/directories", { method: "POST", body: input }),
});
export type FilesystemClient = ReturnType<typeof createFilesystemClient>;
