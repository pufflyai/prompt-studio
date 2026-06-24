import type { RouteDeps } from "../deps";

export type WorkspacesRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "eventBus"
  | "extensionFilesService"
  | "extensionInstancesService"
  | "extensionService"
  | "extensionSettingsService"
  | "extensionStorageService"
  | "fileService"
  | "harnessRegistry"
  | "notificationService"
  | "projectService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "skillService"
  | "settingsService"
  | "templateService"
  | "workspaceService"
  | "workspaceSessionService"
>;
