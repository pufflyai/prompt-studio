import type { RouteDeps } from "../deps";

export type TicketsRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "agentConfigService"
  | "agentRegistry"
  | "attemptStatusService"
  | "eventBus"
  | "extensionService"
  | "extensionStorageService"
  | "fileService"
  | "projectService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "settingsService"
  | "statusService"
  | "syncService"
  | "templateService"
  | "ticketService"
  | "workspaceArtifactService"
  | "workspaceService"
  | "workspaceSessionService"
>;
