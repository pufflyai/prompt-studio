import type { HarnessRegistryService } from "./harness-registry-service";

// Skills install into per-agent directories (KNOWN_AGENTS, reconciled via the harness
// local id); the target set is simply every installed harness.
export const listSkillAgentIds = async (harnessRegistry: HarnessRegistryService) =>
  (await harnessRegistry.list()).map((harness) => harness.id);
