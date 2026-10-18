import type { WorkspaceDiffFile, WorkspaceDiffFiles, WorkspaceDiffSummary } from "pstdio-api-contracts";
import { PstdioApiError, type RequestFn } from "./request";

export const createWorkspaceDiffClient = (request: RequestFn) => {
  const read = async <T>(path: string, signal?: AbortSignal) => {
    try {
      return await request<T>(path, { signal });
    } catch (error) {
      if (error instanceof PstdioApiError && error.status === 404) return null;
      throw error;
    }
  };
  const path = (id: string, endpoint: string, mode: "current" | "fork_point", file?: string) => {
    const query = new URLSearchParams({ mode });
    if (file !== undefined) query.set("path", file);
    return `/v1/workspaces/${encodeURIComponent(id)}/${endpoint}?${query}`;
  };
  return {
    diffFiles: (id: string, mode: "current" | "fork_point", signal?: AbortSignal) =>
      read<WorkspaceDiffFiles>(path(id, "diff-files", mode), signal),
    diffFile: (id: string, mode: "current" | "fork_point", file: string, signal?: AbortSignal) =>
      read<WorkspaceDiffFile>(path(id, "diff-file", mode, file), signal),
    diffSummary: (id: string, mode: "current" | "fork_point", signal?: AbortSignal) =>
      read<WorkspaceDiffSummary>(path(id, "diff-summary", mode), signal),
  };
};
