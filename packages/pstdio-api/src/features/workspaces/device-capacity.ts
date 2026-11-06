import { deviceCommandResultSchema, workspaceCapacitySchema } from "pstdio-api-contracts";
import { z } from "zod";
import type { WorkspacesRouteDeps } from "./deps";

const inputSchema = z.strictObject({ deviceId: z.string().min(1).optional() });

/** A read over the existing authenticated project-device channel; limits are never written remotely. */
export const readDeviceWorkspaceCapacity = async (
  deps: WorkspacesRouteDeps,
  context: { projectId: string; signal?: AbortSignal },
  input?: { deviceId?: string },
) => {
  const { deviceId } = inputSchema.parse(input ?? {});
  context.signal?.throwIfAborted();
  const local = await deps.workspaceCapacityService.get();
  if (!deviceId || deviceId === local.deviceId) return local;
  if (!(await deps.projectService.get(context.projectId))) throw new Error("Project not found.");
  const signal = context.signal ?? new AbortController().signal;
  const result = deviceCommandResultSchema.parse(
    await deps.accountService.sendDeviceCommand(context.projectId, deviceId, { type: "workspace.capacity" }, signal),
  );
  signal.throwIfAborted();
  if (result.status !== 200) throw new Error("Device capacity is unavailable.");
  const capacity = workspaceCapacitySchema.parse(result.body);
  if (capacity.deviceId !== deviceId) throw new Error("Device capacity does not match the requested device.");
  return capacity;
};
