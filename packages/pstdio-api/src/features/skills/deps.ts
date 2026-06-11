import type { RouteDeps } from "../deps";

export type SkillsRouteDeps = Pick<
  RouteDeps,
  "harnessRegistry" | "eventBus" | "fileService" | "projectService" | "repoService" | "skillService"
>;
