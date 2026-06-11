import { PstdioApiError } from "@pstdio/sdk/client";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentModel } from "./agent-types";

export const useAgentModels = (agentId: string, options?: { enabled?: boolean; projectId?: string }) =>
  useQuery({
    queryKey: ["agent-models", agentId, options?.projectId ?? "all"],
    queryFn: () =>
      apiRequest<AgentModel[]>(
        options?.projectId
          ? `/v1/agents/${agentId}/models?project=${encodeURIComponent(options.projectId)}`
          : `/v1/agents/${agentId}/models`,
      ),
    enabled: options?.enabled ?? true,
    // A 404 means the harness does not resolve (extension disabled/uninstalled) — retrying cannot help.
    retry: (failureCount, error) => !(error instanceof PstdioApiError && error.status === 404) && failureCount < 3,
  });
