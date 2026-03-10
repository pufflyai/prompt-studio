import { apiRequest } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import type { AgentModel } from "../types";

export const useAgentModels = (agentId: string, options?: { enabled?: boolean }) =>
  useFetch(() => apiRequest<AgentModel[]>(`/v1/agents/${agentId}/models`), [agentId], {
    enabled: options?.enabled ?? true,
  });
