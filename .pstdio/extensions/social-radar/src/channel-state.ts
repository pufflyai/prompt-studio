import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { Run } from "./schemas";

// Presence means paused. Deleting the record resumes the channel without rewriting its settings.
export const pausedChannelsOf = (ctx: ExtensionContextBase) =>
  ctx.storage.collection<{ id: string }>("paused-channels");
export const pausedChannelIds = async (ctx: ExtensionContextBase) =>
  new Set((await pausedChannelsOf(ctx).list()).map((channel) => channel.id));
// Runs come newest first. The newest finished run that tried the channel decides, so a run that reads it clears the mark.
export const needsLogin = (runs: Run[], channelId: string) => {
  const skip = (run: Run) => run.skippedSites?.find((item) => item.site === channelId);
  const tried = runs.find((run) => run.status === "done" && (run.searches?.[channelId] || skip(run)));
  return tried ? Boolean(skip(tried)?.needsLogin) : false;
};
