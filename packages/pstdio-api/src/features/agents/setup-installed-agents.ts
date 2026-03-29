import type { RouteDeps } from "../deps";

export const setupInstalledAgents = async (
  deps: Pick<RouteDeps, "agentConfigsService" | "agentRegistry" | "eventBus">,
  defaultAgentId?: string,
) => {
  const installedAgents = deps.agentRegistry.list().filter((agent) => agent.checkAvailability().type === "INSTALLED");
  if (installedAgents.length === 0) return [];

  for (const agent of installedAgents) {
    await deps.agentConfigsService.upsert(agent.id);
  }

  if (defaultAgentId && installedAgents.some((agent) => agent.id === defaultAgentId)) {
    await deps.agentConfigsService.update(defaultAgentId, { is_default: true });
  }

  const updated = await deps.agentConfigsService.list();
  for (const config of updated) {
    deps.eventBus.emit("agent_configs", "set", config);
  }

  return updated;
};
