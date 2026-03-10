import { apiRequest } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { useMutation } from "@/lib/use-mutation";
import type { CodingAgent } from "../agent-storage";
import type { AgentConfig } from "../types";

type AgentAvailability = {
  type: "INSTALLED" | "NOT_FOUND";
};

export const useAgentAvailability = (agent: CodingAgent) =>
  useFetch(() => apiRequest<AgentAvailability>(`/v1/agents/availability?agent=${encodeURIComponent(agent)}`), [agent]);

export const useRunAgentSetup = () =>
  useMutation((agent: CodingAgent) =>
    apiRequest<AgentConfig>("/v1/agents", {
      method: "POST",
      body: { agent_id: agent },
    }),
  );
