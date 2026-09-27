import type { RouteDeps } from "../deps";

export type SessionsRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
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
  | "workspaceSessionService"
>;
