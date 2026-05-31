import type { RouteDeps } from "../deps";

/** @deprecated Legacy core ticket route dependencies. Ticket data is owned by the pstdio tickets extension. */
export type TicketsRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "agentConfigService"
  | "agentRegistry"
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
  | "syncService"
  | "templateService"
  | "ticketService"
  | "workspaceArtifactService"
  | "workspaceService"
  | "workspaceSessionService"
>;
