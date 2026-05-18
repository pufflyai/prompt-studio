import type { RouteDeps } from "../deps";

export type WorkspacesRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "attemptStatusService"
  | "eventBus"
  | "extensionService"
  | "extensionStorageService"
  | "fileService"
  | "pluginService"
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
