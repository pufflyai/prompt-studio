import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentModel } from "../types";

export const useAgentModels = (agentId: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["agent-models", agentId],
    queryFn: () => apiRequest<AgentModel[]>(`/v1/agents/${agentId}/models`),
    enabled: options?.enabled ?? true,
  });
