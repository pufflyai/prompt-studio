import type { RouteDeps } from "../deps";

export type AgentsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "harnessRegistry"
  | "eventBus"
  | "extensionService"
  | "installedExtensionSourcesService"
  | "projectService"
  | "repoService"
  | "skillService"
>;
