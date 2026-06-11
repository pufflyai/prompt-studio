import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CodingAgent } from "@/shared/agent-storage";

type AgentAvailability = {
  type: "INSTALLED" | "NOT_FOUND";
};

export const useAgentAvailability = (agent: CodingAgent) =>
  useQuery({
    queryKey: ["agent-availability", agent],
    queryFn: () => apiRequest<AgentAvailability>(`/v1/agents/availability?agent=${encodeURIComponent(agent)}`),
  });
