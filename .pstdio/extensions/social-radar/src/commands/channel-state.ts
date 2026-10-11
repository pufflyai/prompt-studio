import { defineCommand, params } from "@pstdio/sdk/extensions";
import { pausedChannelIds, pausedChannelsOf } from "../channel-state";
import { readSettings } from "../settings";
import { serializeSettings } from "../settings-lifecycle";
import { changed } from "../store";

export const getChannelState = defineCommand({
  id: "get-channel-state",
  title: "Read channel pause state",
  cli: true,
  run: async (ctx) => ({ pausedChannelIds: [...(await pausedChannelIds(ctx))] }),
});
export const setChannelPaused = defineCommand({
  id: "set-channel-paused",
  title: "Pause or resume a channel",
  cli: true,
  params: { id: params.text({ required: true }), paused: params.boolean({ required: true }) },
  run: (ctx, { id, paused }) =>
    serializeSettings(ctx, async () => {
      const settings = await readSettings(ctx.settings);
      if (!settings.channels.some((channel) => channel.id === id)) throw new Error(`${id} is not a channel.`);
      const channels = pausedChannelsOf(ctx);
      if (paused) await channels.put(id, { id });
      else await channels.delete(id);
      await changed(ctx, id);
      return { id, paused };
    }),
});
