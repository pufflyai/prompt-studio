import type { RouteDeps } from "../deps";

export type AgentsRouteDeps = Pick<
  RouteDeps,
  | "harnessRegistry"
  | "eventBus"
  | "extensionService"
  | "installedExtensionSourcesService"
  | "projectService"
  | "repoService"
  | "skillService"
>;
