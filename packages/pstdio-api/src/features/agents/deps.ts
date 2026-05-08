import type { RouteDeps } from "../deps";

export type AgentsRouteDeps = Pick<
  RouteDeps,
  "agentConfigService" | "agentRegistry" | "eventBus" | "projectService" | "repoService" | "skillService"
>;
