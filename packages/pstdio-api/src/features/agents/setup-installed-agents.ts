import type { RouteDeps } from "../deps";

export const setupInstalledAgents = async (
  deps: Pick<RouteDeps, "agentConfigService" | "agentRegistry" | "eventBus">,
  defaultAgentId?: string,
) => {
  const installedAgents = deps.agentRegistry.list().filter((agent) => agent.checkAvailability().type === "INSTALLED");
  if (installedAgents.length === 0) return [];

  for (const agent of installedAgents) {
    await deps.agentConfigService.upsert(agent.id);
  }

  if (defaultAgentId && installedAgents.some((agent) => agent.id === defaultAgentId)) {
    await deps.agentConfigService.update(defaultAgentId, { is_default: true });
  }

  const updated = await deps.agentConfigService.list();
  for (const config of updated) {
    deps.eventBus.emit("agent_configs", "set", config);
  }

  return updated;
};
