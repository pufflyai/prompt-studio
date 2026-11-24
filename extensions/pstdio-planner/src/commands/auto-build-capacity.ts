import type { CommandContext } from "@pstdio/sdk/extensions";

export class DeviceCapacityFullError extends Error {}

export async function hasDeviceWorkspaceCapacity(ctx: CommandContext, workspaceId?: string) {
  const device = await ctx.workspaces.getCapacity();
  if (device.limit === null || device.activeCount < device.limit) return true;
  if (!workspaceId) return false;
  // The host counts distinct local workspaces with running or waiting-for-input sessions.
  // A queued session does not hold a slot, and sharing a slot does not waive ownership checks.
  let cursor: string | undefined;
  do {
    const active = await ctx.sessions.query({
      workspaceId,
      status: ["in_progress", "awaiting_input"],
      includeArchived: true,
      limit: 100,
      cursor,
    });
    if (active.items.some((session) => !session.device)) return true;
    cursor = active.nextCursor ?? undefined;
  } while (cursor);
  return false;
}

export async function requireDeviceWorkspaceCapacity(ctx: CommandContext, workspaceId?: string) {
  if (!(await hasDeviceWorkspaceCapacity(ctx, workspaceId))) throw new DeviceCapacityFullError();
}
