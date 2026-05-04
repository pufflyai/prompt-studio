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
  | "sessionService"
  | "statusService"
  | "syncService"
  | "templateService"
  | "ticketService"
  | "workspaceArtifactService"
  | "workspaceService"
  | "workspaceSessionService"
>;
