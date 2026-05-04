import { spawnSync } from "node:child_process";
import { KNOWN_AGENTS } from "pstdio-api-contracts/known-agents";
import { listAgents } from "@/features/agents/api/list-agents";

const isBinaryInstalled = (binary: string) => {
  const result = spawnSync("which", [binary], { stdio: "ignore" });
  return result.status === 0;
};

export const command = "list";
export const describe = "List available coding agents";

export const handler = async () => {
  const configured = await listAgents();
  const configuredIds = new Set(configured.map((a) => a.agent_id));
  const defaultId = configured.find((a) => a.is_default)?.agent_id;

  const rows = KNOWN_AGENTS.map((agent) => ({
    Agent: agent.name,
    Configured: configuredIds.has(agent.id) ? "yes" : "no",
    Installed: isBinaryInstalled(agent.binary) ? "yes" : "no",
    Default: agent.id === defaultId ? "yes" : "",
  }));

  console.table(rows);
};
