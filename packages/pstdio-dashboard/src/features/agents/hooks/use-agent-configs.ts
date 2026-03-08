import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentConfig } from "../types";

const agentConfigKeys = {
  all: ["agents", "configs"] as const,
};

export const useAgentConfigs = () => {
  return useQuery({
    queryKey: agentConfigKeys.all,
    queryFn: () => apiRequest<AgentConfig[]>("/v1/agents"),
  });
};

export const useEnableAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) =>
      apiRequest<AgentConfig>("/v1/agents", {
        method: "POST",
        body: { agent_id: agentId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
};

export const useDisableAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => apiRequest<void>(`/v1/agents/${agentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
};

export const useSetDefaultAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) =>
      apiRequest<AgentConfig>(`/v1/agents/${agentId}`, {
        method: "PATCH",
        body: { is_default: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
};
