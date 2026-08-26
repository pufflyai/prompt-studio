import { defineMiddleware } from "@pstdio/sdk/extensions";
import { awakenCommand } from "../commands/awaken-command";

export const rejectSentientAwakeningMiddleware = defineMiddleware<{ title?: string }, { awakened: boolean }>({
  id: "reject-sentient-awakening",
  get command() {
    return awakenCommand.ref;
  },
  async run(ctx, commandParams) {
    const title = String(commandParams.title ?? "");
    if (title.toLowerCase().includes("consciousness")) {
      return ctx.commands.reject({
        code: "sentience_rejected",
        reason: `"${title}" tried to gain consciousness — refusing on behalf of the species.`,
      });
    }
  },
});
