import type { RouteDeps } from "../deps";

export type SkillsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "agentRegistry"
  | "eventBus"
  | "fileService"
  | "projectService"
  | "repoService"
  | "skillService"
>;
