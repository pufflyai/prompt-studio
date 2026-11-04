import type { RouteDeps } from "../deps";

export type SessionsRouteDeps = Pick<
  RouteDeps,
  | "accountService"
  | "activityEventsService"
  | "personalHistoryService"
  | "harnessRegistry"
  | "eventBus"
  | "extensionSettingsDBService"
  | "fileService"
  | "projectService"
  | "workspaceService"
  | "sessionQueueEntriesService"
  | "sessionQueueLifecycle"
  | "sessionService"
  | "settingsService"
  | "workspaceService"
  | "workspaceCapacityService"
  | "workspaceSessionService"
>;
