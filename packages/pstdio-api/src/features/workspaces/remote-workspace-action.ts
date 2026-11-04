import type { RouteConfig } from "@hono/zod-openapi";
import type { DeviceCommand } from "pstdio-api-contracts";
import { deviceCommandResponse } from "../account/device-command-response";
import type { WorkspacesRouteDeps } from "./deps";

export const remoteWorkspaceAction = async <R extends RouteConfig>(
  route: R,
  deps: WorkspacesRouteDeps,
  id: string,
  command: DeviceCommand,
  signal: AbortSignal,
) => {
  if (await deps.workspaceService.get(id)) return undefined;
  const workspace = await deps.personalHistoryService.getWorkspace(id);
  if (!workspace) return undefined;
  return deviceCommandResponse(route, deps.accountService, workspace.project_id, workspace.device.id, command, signal);
};
