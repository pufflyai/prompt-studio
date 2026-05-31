import type { RouteDeps } from "../deps";

export type WorkspacesRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "attemptStatusService"
  | "eventBus"
  | "extensionService"
  | "extensionSettingsService"
  | "extensionStorageService"
  | "fileService"
  | "projectService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "settingsService"
  | "statusService"
  | "templateService"
  | "ticketService"
  | "workspaceService"
  | "workspaceSessionService"
>;
