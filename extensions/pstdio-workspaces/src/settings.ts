import { defineCommand, params } from "@pstdio/sdk/extensions";
import { changed } from "./events";

export const setLimit = defineCommand({
  id: "set-limit",
  title: "Set this device's workspace limit",
  cli: true,
  mutating: true,
  params: { limit: params.number(), unlimited: params.boolean() },
  async run(ctx, args) {
    const limit = args.unlimited ? null : args.limit;
    if (limit !== null && (!Number.isInteger(limit) || !limit || limit < 1))
      throw new Error("Enter a positive whole-number limit, or choose unlimited.");
    const result = await ctx.workspaces.updateCapacity({ limit: limit! });
    await ctx.events.emit(changed, {});
    return result;
  },
});
