import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CodingAgent } from "../agent-storage";

type AgentAvailability = {
  type: "INSTALLED" | "NOT_FOUND";
};

type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
};

export const useAgentAvailability = (agent: CodingAgent) => {
  return useQuery({
    queryKey: ["agents", "availability", agent],
    queryFn: () => apiRequest<AgentAvailability>(`/v1/agents/availability?agent=${encodeURIComponent(agent)}`),
  });
};

export const useRunAgentSetup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agent: CodingAgent) =>
      apiRequest<AgentConfig>("/v1/agents", {
        method: "POST",
        body: { agent_id: agent },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
};
