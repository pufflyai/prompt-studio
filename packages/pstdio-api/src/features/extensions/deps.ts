import type { RouteDeps } from "../deps";

export type ExtensionsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "agentRegistry"
  | "eventBus"
  | "extensionService"
  | "sessionQueueEntriesService"
  | "settingsService"
  | "skillService"
  | "templateService"
  | "workspaceSessionService"
> & {
  activityEventsService: RouteDeps["activityEventsService"];
  attemptStatusService: RouteDeps["attemptStatusService"];
  extensionStorageService: RouteDeps["extensionStorageService"];
  fileService: RouteDeps["fileService"];
  projectService: RouteDeps["projectService"];
  repoService: RouteDeps["repoService"];
  sessionService: RouteDeps["sessionService"];
  statusService: RouteDeps["statusService"];
  ticketService: RouteDeps["ticketService"];
  workspaceService: RouteDeps["workspaceService"];
  webviewCacheRoot?: string;
};
