import type { RouteDeps } from "../deps";

export type TicketsRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "agentConfigService"
  | "agentRegistry"
  | "attemptStatusService"
  | "eventBus"
  | "fileService"
  | "pluginService"
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
