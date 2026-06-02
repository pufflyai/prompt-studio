import type { RouteDeps } from "../deps";

export type ExtensionsRouteDeps = Pick<
  RouteDeps,
  | "agentConfigService"
  | "agentRegistry"
  | "eventBus"
  | "extensionService"
  | "extensionSettingsService"
  | "sessionQueueEntriesService"
  | "settingsService"
  | "skillService"
  | "templateService"
  | "workspaceSessionService"
> & {
  activityEventsService: RouteDeps["activityEventsService"];
  extensionFilesService: RouteDeps["extensionFilesService"];
  extensionInstancesService: RouteDeps["extensionInstancesService"];
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
