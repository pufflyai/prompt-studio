import type { RouteDeps } from "../deps";

export type SessionsRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "agentConfigService"
  | "agentRegistry"
  | "eventBus"
  | "fileService"
  | "projectService"
  | "repoService"
  | "sessionService"
  | "templateService"
  | "workspaceService"
  | "workspaceSessionService"
>;
