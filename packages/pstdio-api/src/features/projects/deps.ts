import type { RouteDeps } from "../deps";

export type ProjectsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "agentRegistry"
  | "eventBus"
  | "fileService"
  | "filesRoot"
  | "pluginService"
  | "projectService"
  | "repoService"
  | "skillService"
  | "statusService"
  | "syncService"
  | "tagService"
  | "templateService"
  | "workspaceService"
>;
