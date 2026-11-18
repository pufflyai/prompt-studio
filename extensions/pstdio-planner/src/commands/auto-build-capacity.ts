import type { CommandContext } from "@pstdio/sdk/extensions";
import { readSessionHistory } from "../data/session-history";

export class DeviceCapacityFullError extends Error {}

export async function hasDeviceWorkspaceCapacity(ctx: CommandContext, workspaceId?: string) {
  const device = await ctx.workspaces.getCapacity();
  if (device.limit === null || device.activeCount < device.limit) return true;
  if (!workspaceId) return false;
  // The host counts distinct local workspaces with running or waiting-for-input sessions.
  // A queued session does not hold a slot, and sharing a slot does not waive ownership checks.
  const active = await readSessionHistory(ctx.sessions, {
    workspaceId,
    status: ["in_progress", "awaiting_input"],
    includeArchived: true,
  });
  // Device-tagged rows are synced personal history, not sessions executing on this host.
  return active.some((session) => !session.device);
}

export async function requireDeviceWorkspaceCapacity(ctx: CommandContext, workspaceId?: string) {
  if (!(await hasDeviceWorkspaceCapacity(ctx, workspaceId))) throw new DeviceCapacityFullError();
}
