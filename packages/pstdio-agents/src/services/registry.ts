import { createClaudeCodeAgent } from "../providers/claude-code";
import { createFakeAgent } from "../providers/fake";
import { createOpencodeAgent } from "../providers/opencode";
import type { AgentId, AgentRegistry, AgentService, AvailabilityInfo } from "../types";

const agentFactories: Record<AgentId, () => AgentService> = {
  "claude-code": createClaudeCodeAgent,
  opencode: createOpencodeAgent,
  fake: createFakeAgent,
};

const parseAgentIds = (value: string | undefined) =>
  value
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

export const resolveDefaultAgents = (agents?: AgentService[]) => {
  if (agents) return agents;

  const configuredAgentIds = parseAgentIds(process.env.PSTDIO_AGENTS);
  if (configuredAgentIds.length === 0) {
    return [createClaudeCodeAgent(), createOpencodeAgent()];
  }

  const ids = [...new Set(configuredAgentIds)];
  return ids.map((id) => {
    const factory = agentFactories[id as AgentId];
    if (!factory) throw new Error(`Unsupported agent in PSTDIO_AGENTS: ${id}`);
    return factory();
  });
};

export const createAgentRegistry = (agents: AgentService[]): AgentRegistry => {
  const map = new Map(agents.map((agent) => [agent.id, agent]));

  const get = (id: AgentId) => map.get(id) ?? null;
  const list = () => [...map.values()];
  const checkAll = () =>
    Object.fromEntries(list().map((agent) => [agent.id, agent.checkAvailability()])) as Partial<
      Record<AgentId, AvailabilityInfo>
    >;

  return { get, list, checkAll };
};
