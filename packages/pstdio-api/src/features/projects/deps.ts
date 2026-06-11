import type { RouteDeps } from "../deps";

export type ProjectsRouteDeps = Pick<
  RouteDeps,
  | "harnessRegistry"
  | "eventBus"
  | "extensionService"
  | "fileService"
  | "filesRoot"
  | "installedExtensionSourcesService"
  | "projectService"
  | "repoService"
  | "skillService"
  | "syncService"
  | "templateService"
  | "workspaceService"
>;
