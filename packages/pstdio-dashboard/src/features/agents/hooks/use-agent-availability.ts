import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CodingAgent } from "../agent-storage";
import type { AgentConfig } from "../types";

type AgentAvailability = {
  type: "INSTALLED" | "NOT_FOUND";
};

export const useAgentAvailability = (agent: CodingAgent) =>
  useQuery({
    queryKey: ["agent-availability", agent],
    queryFn: () => apiRequest<AgentAvailability>(`/v1/agents/availability?agent=${encodeURIComponent(agent)}`),
  });

export const useRunAgentSetup = () =>
  useMutation({
    mutationFn: (agent: CodingAgent) =>
      apiRequest<AgentConfig>("/v1/agents", {
        method: "POST",
        body: { agent_id: agent },
      }),
  });
