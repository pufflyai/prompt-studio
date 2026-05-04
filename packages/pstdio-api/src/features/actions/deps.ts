import type { RouteDeps } from "../deps";

export type ActionsRouteDeps = Pick<
  RouteDeps,
  "fileService" | "pluginService" | "sessionService" | "templateService" | "ticketService" | "workspaceService"
>;
