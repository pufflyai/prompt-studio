import type { AgentId, AgentRegistry, AgentService, AvailabilityInfo } from "../types";

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
