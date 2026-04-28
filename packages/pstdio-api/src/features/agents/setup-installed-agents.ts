import type { RouteDeps } from "../deps";
import { toAgentId } from "../harnesses/harness-ids";

export const setupInstalledAgents = async (
  deps: Pick<RouteDeps, "agentConfigService" | "harnessProviderService" | "eventBus">,
  defaultAgentId?: string,
) => {
  const providers = await deps.harnessProviderService.list();
  const availability = await Promise.all(
    providers.map(async (provider) => ({
      provider,
      availability: await deps.harnessProviderService.detect(provider),
    })),
  );
  const installedAgentIds = availability
    .filter((entry) => entry.availability.type === "INSTALLED")
    .map((entry) => toAgentId(entry.provider.provider.id));

  if (installedAgentIds.length === 0) return [];

  for (const agentId of installedAgentIds) {
    await deps.agentConfigService.upsert(agentId);
  }

  if (defaultAgentId && installedAgentIds.includes(defaultAgentId)) {
    await deps.agentConfigService.update(defaultAgentId, { is_default: true });
  }

  const updated = await deps.agentConfigService.list();
  for (const config of updated) {
    deps.eventBus.emit("agent_configs", "set", config);
  }

  return updated;
};
