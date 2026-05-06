import type { RouteDeps } from "../deps";

export type ProjectsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "agentRegistry"
  | "eventBus"
  | "extensionService"
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
