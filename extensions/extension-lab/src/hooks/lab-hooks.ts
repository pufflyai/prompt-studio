import { commandEvent, defineHook } from "@pstdio/sdk/extensions";
import { labAwakenCommand } from "../commands";

export const notifySentienceRejectedHook = defineHook({
  get event() {
    return commandEvent(labAwakenCommand, "rejected");
  },
  async handler(ctx, event) {
    await ctx.notify.toast({
      type: "info",
      title: "Lab observed rejection",
      message: event.reason,
    });
  },
});
