import type { RouteDeps } from "../deps";

export type SessionsRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "harnessRegistry"
  | "eventBus"
  | "fileService"
  | "projectService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "settingsService"
  | "templateService"
  | "workspaceService"
  | "workspaceSessionService"
>;
