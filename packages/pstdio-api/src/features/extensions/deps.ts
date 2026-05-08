import type { RouteDeps } from "../deps";

export type ExtensionsRouteDeps = Pick<RouteDeps, "extensionService"> & {
  activityEventsService: RouteDeps["activityEventsService"];
  extensionStorageService: RouteDeps["extensionStorageService"];
  fileService: RouteDeps["fileService"];
  projectService: RouteDeps["projectService"];
  repoService: RouteDeps["repoService"];
  sessionService: RouteDeps["sessionService"];
  workspaceService: RouteDeps["workspaceService"];
  webviewCacheRoot?: string;
};
