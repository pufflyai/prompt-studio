import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const SETTINGS_PREFIX = "agent-settings:";

const readSettings = (agentId: string): Record<string, unknown> => {
  const raw = localStorage.getItem(`${SETTINGS_PREFIX}${agentId}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeSettings = (agentId: string, settings: Record<string, unknown>) => {
  localStorage.setItem(`${SETTINGS_PREFIX}${agentId}`, JSON.stringify(settings));
};

export const useAgentSettings = (agentId: string) => {
  return useQuery({
    queryKey: ["agents", agentId, "settings"],
    queryFn: () => readSettings(agentId),
  });
};

export const useUpdateAgentSettings = (agentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      writeSettings(agentId, settings);
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "settings"] });
    },
  });
};
