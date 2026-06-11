import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentModel } from "../types";

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
  });
