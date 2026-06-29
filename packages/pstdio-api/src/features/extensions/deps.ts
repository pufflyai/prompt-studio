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
  /**
   * Long-lived PTY supervisor. Provided by the app so command/event runners
   * forward the same `ExtensionTerminalApi` instance to every invocation
   * without per-call startup cost. Optional to keep narrow test harnesses
   * green; production wiring always sets it.
   */
  terminalSupervisor?: RouteDeps["terminalSupervisor"];
  webviewCacheRoot?: string;
};
