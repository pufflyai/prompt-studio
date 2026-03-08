import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentModel } from "../types";

export const agentModelKeys = {
  byAgent: (agentId: string) => ["agents", agentId, "models"] as const,
};

interface UseAgentModelsOptions {
  enabled?: boolean;
}

export const useAgentModels = (agentId: string, options?: UseAgentModelsOptions) => {
  return useQuery({
    queryKey: agentModelKeys.byAgent(agentId),
    queryFn: () => apiRequest<AgentModel[]>(`/v1/agents/${agentId}/models`),
    enabled: options?.enabled ?? true,
  });
};
