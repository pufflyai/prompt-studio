import type { DeviceCommand } from "pstdio-api-contracts";
import { sessionCreateResponseSchema } from "pstdio-api-contracts";
import type { ExtensionSessionsApi } from "pstdio-api-contracts/extension-kernel";
import type { z } from "zod";
import { readDeviceCommandResult, remoteCreationDevice } from "../../account/device-command-response";
import { toExtensionSession } from "../../sessions/extension-session";
import type { ExtensionsRouteDeps } from "../deps";
import { createSessionAccess, type SessionApiScope } from "./session-access";

/** Personal history supplies ownership; only the existing account relay sends execution commands. */
export const createRemoteSessionAccess = (deps: ExtensionsRouteDeps, input: SessionApiScope) => {
  const access = createSessionAccess(deps, input);
  return async <T>(id: string, command: DeviceCommand, schema: z.ZodType<T>): Promise<{ value: T } | undefined> => {
    input.signal?.throwIfAborted();
    if (await access.read(() => access.getProjectSession(id))) return undefined;
    // Never resolve an arbitrary remote ID outside the invoking project.
    const session = await access.read(() => deps.personalHistoryService.getSession(id, input.projectId));
    if (!session) throw new Error(`Session not found: ${id}`);
    const result = await readDeviceCommandResult(
      deps.accountService,
      input.projectId,
      session.device.id,
      command,
      input.signal ?? new AbortController().signal,
    );
    input.signal?.throwIfAborted();
    if (result.status < 200 || result.status >= 300) {
      const error = result.body && typeof result.body === "object" && "error" in result.body ? result.body.error : null;
      throw new Error(typeof error === "string" ? error : "The session's device is unavailable.");
    }
    return { value: schema.parse(result.body) };
  };
};

export const createRemoteSession = async (
  deps: ExtensionsRouteDeps,
  input: SessionApiScope,
  sessionInput: Parameters<ExtensionSessionsApi["create"]>[0],
) => {
  const device = await remoteCreationDevice(deps.accountService, sessionInput.deviceId);
  if (device) {
    const result = await readDeviceCommandResult(
      deps.accountService,
      input.projectId,
      device.id,
      {
        type: "session.create",
        input: {
          projectId: input.projectId,
          title: sessionInput.title,
          prompt: sessionInput.prompt,
          operation: sessionInput.operation,
          agent: sessionInput.harness?.harnessId,
          model: sessionInput.harness?.model,
          params: sessionInput.harness?.params,
          workspaceId: sessionInput.workspaceId,
          originalSessionId: sessionInput.originalSessionId,
          anchors: sessionInput.anchors,
          attachments: sessionInput.attachments?.map(({ file_id }) => ({ fileId: file_id })),
        },
      },
      input.signal ?? new AbortController().signal,
    );
    if (result.status !== 201) {
      const error = result.body && typeof result.body === "object" && "error" in result.body ? result.body.error : null;
      throw new Error(typeof error === "string" ? error : "The session could not be created on the selected device.");
    }
    const session = sessionCreateResponseSchema.parse(result.body);
    return {
      ...toExtensionSession(
        {
          ...session,
          usage_json: session.usage_json ?? null,
          ...(device.identity ? { device: device.identity } : {}),
        },
        session.workspaceId,
      ),
      type: "session" as const,
      operationResult: session.operationResult,
    };
  }
};
