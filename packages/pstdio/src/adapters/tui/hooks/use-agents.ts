import { spawnSync } from "node:child_process";
import { KNOWN_AGENTS, type KnownAgent } from "pstdio-agents";
import { useState } from "react";
import { listAgents } from "@/features/agents/api/list-agents";
import { removeAgent } from "@/features/agents/api/remove-agent";
import { setupAgent } from "@/features/agents/api/setup-agent";
import { updateAgent } from "@/features/agents/api/update-agent";
import { API_URL } from "@/features/api-url";

export type AgentRow = {
  agentId: string;
  name: string;
  configured: boolean;
  installed: boolean;
  isDefault: boolean;
};

type ConfiguredAgent = { agent_id: string; is_default: boolean };

export const buildAgentRows = (
  knownAgents: KnownAgent[],
  configured: ConfiguredAgent[],
  checkInstalled: (binary: string) => boolean,
): AgentRow[] => {
  const configuredIds = new Set(configured.map((a) => a.agent_id));
  const defaultId = configured.find((a) => a.is_default)?.agent_id;

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
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [error, setError] = useState("");

  const loadAgents = async () => {
    try {
      const configured = await listAgents(API_URL);
      const rows = buildAgentRows(KNOWN_AGENTS, configured, isBinaryInstalled);
      setAgents(rows);
      setError("");
    } catch {
      setError("Failed to load agents");
    }
  };

  const setup = async (agentId: string) => {
    try {
      await setupAgent(API_URL, agentId);
      await loadAgents();
    } catch {
      setError("Failed to setup agent");
    }
  };

  const remove = async (agentId: string) => {
    try {
      await removeAgent(API_URL, agentId);
      await loadAgents();
    } catch {
      setError("Failed to remove agent");
    }
  };

  const setDefault = async (agentId: string) => {
    try {
      await updateAgent(API_URL, agentId, { is_default: true });
      await loadAgents();
    } catch {
      setError("Failed to set default agent");
    }
  };

  return { agents, error, loadAgents, setup, remove, setDefault };
}
