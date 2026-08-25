import { defineMiddleware } from "@pstdio/sdk/extensions";
import { labAwakenCommand } from "../commands";

export const rejectSentientAwakeningMiddleware = defineMiddleware({
  get command() {
    return labAwakenCommand;
  },
  async handler(ctx, commandParams) {
    const title = String(commandParams.title ?? "");
    if (title.toLowerCase().includes("consciousness")) {
      return ctx.commands.reject({
        code: "sentience_rejected",
        reason: `"${title}" tried to gain consciousness — refusing on behalf of the species.`,
      });
    }
  },
});
