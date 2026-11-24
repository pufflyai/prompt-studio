import type { CommandContext } from "@pstdio/sdk/extensions";

const pending = new Map<string, Promise<void>>();

export async function dismissMachine(ctx: CommandContext, instanceId: string, machineId: string) {
  const key = `dismissed-machines:${instanceId}`;
  const owner = `${ctx.extensionId}:${ctx.projectId}:${instanceId}`;
  // Keep controller operations concurrent while serializing their shared saved list.
  const save = (pending.get(owner) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const dismissed = (await ctx.storage.get<string[]>(key)) ?? [];
      await ctx.storage.set(key, [...new Set([...dismissed, machineId])]);
    });
  pending.set(owner, save);
  try {
    await save;
  } finally {
    if (pending.get(owner) === save) pending.delete(owner);
  }
}
