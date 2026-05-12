import { apiRequest } from "@/lib/api";
import type { ApiFileDiff } from "./api-types";

export type DiffMode = "current" | "fork_point";

export const ATTEMPT_DIFF_MODE = "fork_point" satisfies DiffMode;

export type ApiTicketAttemptDiff = {
  workspace_id: string;
  base_ref: string;
  head_ref: string;
  files: ApiFileDiff[];
  totals: {
    additions: number;
    deletions: number;
    file_count: number;
  };
};

export const getWorkspaceDiffFiles = async (workspaceId: string, mode?: DiffMode) => {
  const params = mode ? `?mode=${mode}` : "";
  return apiRequest<ApiTicketAttemptDiff>(`/v1/workspaces/${workspaceId}/diff${params}`);
};
