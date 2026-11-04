import type { RouteConfig } from "@hono/zod-openapi";
import type { DeviceCommand } from "pstdio-api-contracts";
import { deviceCommandResponse } from "../account/device-command-response";
import type { SessionsRouteDeps } from "./deps";

export const remoteSessionAction = async <R extends RouteConfig>(
  route: R,
  deps: SessionsRouteDeps,
  id: string,
  command: DeviceCommand,
  signal: AbortSignal,
) => {
  const session = await deps.personalHistoryService.getSession(id);
  if (!session?.project_id) return undefined;
  return deviceCommandResponse(
    route,
    deps.accountService,
    session.project_id,
    session.device.id,
    command,
    signal,
    session.device,
  );
};

export const remoteSessionCancellation = <R extends RouteConfig>(
  route: R,
  deps: SessionsRouteDeps,
  id: string,
  status: string,
  signal: AbortSignal,
) =>
  status === "cancelled" ? remoteSessionAction(route, deps, id, { type: "session.interrupt", id }, signal) : undefined;
