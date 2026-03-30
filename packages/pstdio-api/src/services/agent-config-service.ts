import type { createAgentConfigsDBService } from "pstdio-db";

export type AgentConfigServiceDeps = {
  agentConfigsDBService: ReturnType<typeof createAgentConfigsDBService>;
};

export const createAgentConfigService = (deps: AgentConfigServiceDeps) => ({
  ...deps.agentConfigsDBService,
});
