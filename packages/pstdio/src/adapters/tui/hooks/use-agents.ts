import { spawnSync } from "node:child_process";
import { useLiveQuery } from "@tanstack/react-db";
import { KNOWN_AGENTS, type KnownAgent } from "pstdio-agents";
import { useState } from "react";

import { removeAgent } from "@/features/agents/api/remove-agent";
import { setupAgent } from "@/features/agents/api/setup-agent";
import { updateAgent } from "@/features/agents/api/update-agent";
import { API_URL } from "@/features/api-url";
import { getCollection, type SyncedRow } from "@/features/sync/collections";

export type AgentRow = {
  agentId: string;
  name: string;
  configured: boolean;
  installed: boolean;
  isDefault: boolean;
};

export const buildAgentRows = (
  knownAgents: KnownAgent[],
  configured: SyncedRow[],
  checkInstalled: (binary: string) => boolean,
): AgentRow[] => {
  const configuredIds = new Set(configured.map((a) => a.agent_id as string));
  const defaultId = configured.find((a) => a.is_default)?.agent_id as string | undefined;

  return knownAgents.map((agent) => ({
    agentId: agent.id,
    name: agent.name,
    configured: configuredIds.has(agent.id),
    installed: checkInstalled(agent.binary),
    isDefault: agent.id === defaultId,
  }));
};

const isBinaryInstalled = (binary: string) => {
  const result = spawnSync("which", [binary], { stdio: "ignore" });
  return result.status === 0;
};

export function useAgents() {
  const [error, setError] = useState("");

  const { data: rawConfigs } = useLiveQuery(() => getCollection("agent_configs"));

  const agents = buildAgentRows(KNOWN_AGENTS, rawConfigs ?? [], isBinaryInstalled);

  const setup = async (agentId: string) => {
    try {
      await setupAgent(API_URL, agentId);
    } catch {
      setError("Failed to setup agent");
    }
  };

  const remove = async (agentId: string) => {
    try {
      await removeAgent(API_URL, agentId);
    } catch {
      setError("Failed to remove agent");
    }
  };

  const setDefault = async (agentId: string) => {
    try {
      await updateAgent(API_URL, agentId, { is_default: true });
    } catch {
      setError("Failed to set default agent");
    }
  };

  return { agents, error, loadAgents: () => {}, setup, remove, setDefault };
}
