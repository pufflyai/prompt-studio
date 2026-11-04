import type { RouteConfig } from "@hono/zod-openapi";
import type { CreateSessionInput } from "pstdio-api-contracts";
import { deviceCommandResponse, remoteCreationDevice } from "../account/device-command-response";
import type { SessionsRouteDeps } from "./deps";

export const remoteSessionCreation = async <R extends RouteConfig>(
  route: R,
  account: SessionsRouteDeps["accountService"],
  input: CreateSessionInput,
  signal: AbortSignal,
) => {
  const device = await remoteCreationDevice(account, input.device_id);
  if (!device) return undefined;
  const { project_id, device_id: _target, workspace_id, original_session_id, attachments, ...rest } = input;
  return deviceCommandResponse(
    route,
    account,
    project_id,
    device.id,
    {
      type: "session.create",
      input: {
        ...rest,
        projectId: project_id,
        workspaceId: workspace_id,
        originalSessionId: original_session_id,
        attachments: attachments?.map(({ file_id }) => ({ fileId: file_id })),
      },
    },
    signal,
    device.identity,
  );
};
