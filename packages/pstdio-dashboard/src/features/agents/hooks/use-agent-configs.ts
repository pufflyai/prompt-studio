import { useMutation } from "@tanstack/react-query";
import { asSyncedRows, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import { apiRequest } from "@/lib/api";
import type { AgentConfig } from "../types";

const toAgentConfig = (row: SyncedRow): AgentConfig => ({
  id: row.id,
  agent_id: row.agent_id as string,
  is_default: row.is_default as boolean,
  config: row.config as string,
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
});

export const useAgentConfigs = () => {
  const { data: rawRows, isLoading } = useLiveQuery((q) =>
    q.from({ ac: getCollection("agent_configs") }).select(({ ac }) => ({ ...ac })),
  );
  const rows = asSyncedRows(rawRows);

  const data = rows?.map(toAgentConfig);

  return { data, isLoading };
};

export const useEnableAgent = () =>
  useMutation({
    mutationFn: ({ agentId, binary }: { agentId: string; binary?: string }) =>
      apiRequest<AgentConfig>("/v1/agents", {
        method: "POST",
        body: binary ? { agent_id: agentId, binary } : { agent_id: agentId },
      }),
  });

export const useDisableAgent = () =>
  useMutation({
    mutationFn: (agentId: string) => apiRequest<void>(`/v1/agents/${agentId}`, { method: "DELETE" }),
  });

export const useSetDefaultAgent = () =>
  useMutation({
    mutationFn: (agentId: string) =>
      apiRequest<AgentConfig>(`/v1/agents/${agentId}`, {
        method: "PATCH",
        body: { is_default: true },
      }),
  });
