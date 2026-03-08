import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentInfo } from "../types";

export const agentKeys = {
  list: () => ["agents", "info"] as const,
};

export const useAgents = () => {
  return useQuery({
    queryKey: agentKeys.list(),
    queryFn: () => apiRequest<AgentInfo[]>("/v1/agents/info"),
  });
};
