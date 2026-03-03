import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentModel } from "../types";

interface UseAgentModelsOptions {
  enabled?: boolean;
}

export const useAgentModels = (agentId: string, options?: UseAgentModelsOptions) => {
  return useQuery({
    queryKey: ["agents", agentId, "models"],
    queryFn: () => apiRequest<AgentModel[]>(`/v1/agents/${agentId}/models`),
    enabled: options?.enabled ?? true,
  });
};
