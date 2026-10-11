import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { pausedChannelsOf } from "./channel-state";
import { type RadarSettings, readSettings, settingsSchema, writeSettings } from "./settings";
import { changed } from "./store";

const pending = new Map<string, Promise<unknown>>();
// Pause validation and channel changes share an owner, so removal cannot leave a late pause behind.
export const serializeSettings = async <T>(ctx: ExtensionContextBase, operation: () => Promise<T>) => {
  const next = (pending.get(ctx.projectId) ?? Promise.resolve()).catch(() => {}).then(operation);
  pending.set(ctx.projectId, next);
  try {
    return await next;
  } finally {
    if (pending.get(ctx.projectId) === next) pending.delete(ctx.projectId);
  }
};

export const changeSettings = (ctx: ExtensionContextBase, update: (settings: RadarSettings) => unknown) =>
  serializeSettings(ctx, async () => {
    const data = settingsSchema.parse(update(await readSettings(ctx.settings)));
    const paused = pausedChannelsOf(ctx);
    for (const channel of await paused.list()) {
      if (!data.channels.some((configured) => configured.id === channel.id)) await paused.delete(channel.id);
    }
    const saved = await writeSettings(ctx.settings, data);
    await changed(ctx);
    return saved;
  });
