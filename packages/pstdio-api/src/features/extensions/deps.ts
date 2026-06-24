import type { RouteDeps } from "../deps";

export type ExtensionsRouteDeps = Pick<
  RouteDeps,
  | "harnessRegistry"
  | "eventBus"
  | "extensionService"
  | "extensionSettingsService"
  | "notificationService"
  | "sessionQueueEntriesService"
  | "settingsService"
  | "skillService"
  | "templateService"
  | "workspaceSessionService"
> & {
  activityEventsService: RouteDeps["activityEventsService"];
  extensionFilesService: RouteDeps["extensionFilesService"];
  extensionInstancesService: RouteDeps["extensionInstancesService"];
  extensionStorageService: RouteDeps["extensionStorageService"];
  fileService: RouteDeps["fileService"];
  projectService: RouteDeps["projectService"];
  repoService: RouteDeps["repoService"];
  sessionService: RouteDeps["sessionService"];
  workspaceService: RouteDeps["workspaceService"];
  webviewCacheRoot?: string;
};
