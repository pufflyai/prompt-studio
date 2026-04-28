import { createRequest } from "@pstdio/sdk/client";
import { useQuery } from "@tanstack/react-query";
import type { WorkspaceDiffMode, WorkspaceDiffResponse } from "pstdio-api-contracts";
import { resolveApiBaseUrl } from "./client-base-url";

export const WORKSPACE_CHANGES_DIFF_MODE = "fork_point" satisfies WorkspaceDiffMode;

export const useWorkspaceDiff = (workspaceId: string | null | undefined) =>
  useQuery({
    queryKey: ["workspace-changes-diff", workspaceId, WORKSPACE_CHANGES_DIFF_MODE],
    queryFn: () => {
      const request = createRequest({ baseUrl: resolveApiBaseUrl() });
      return request<WorkspaceDiffResponse>(`/v1/workspaces/${workspaceId}/diff?mode=${WORKSPACE_CHANGES_DIFF_MODE}`);
    },
    enabled: Boolean(workspaceId),
  });
