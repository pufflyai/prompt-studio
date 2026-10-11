import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

// Presence means paused. Deleting the record resumes the channel without rewriting its settings.
export const pausedChannelsOf = (ctx: ExtensionContextBase) =>
  ctx.storage.collection<{ id: string }>("paused-channels");
export const pausedChannelIds = async (ctx: ExtensionContextBase) =>
  new Set((await pausedChannelsOf(ctx).list()).map((channel) => channel.id));
