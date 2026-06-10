import type { RouteDeps } from "../deps";

export type SkillsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "harnessRegistry"
  | "eventBus"
  | "fileService"
  | "projectService"
  | "repoService"
  | "skillService"
>;
