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
    queryFn: async () => {
      const harnesses = await apiRequest<Array<{ id: string; availability: AgentAvailability }>>("/v1/harnesses/info");
      return (
        harnesses.find((harness) => harness.id === agent || harness.id.endsWith(`.${agent}`))?.availability ?? {
          type: "NOT_FOUND",
        }
      );
    },
  });

export const useRunAgentSetup = () =>
  useMutation({
    mutationFn: (agent: CodingAgent) =>
      apiRequest<AgentConfig>("/v1/harnesses", {
        method: "POST",
        body: { harness_id: agent },
      }),
  });

export const useSetupAvailableAgents = () =>
  useMutation({
    mutationFn: (defaultAgentId: string) =>
      apiRequest<AgentConfig[]>("/v1/harnesses/setup-available", {
        method: "POST",
        body: { default_harness_id: defaultAgentId },
      }),
  });
