import { defineCommand, params } from "@pstdio/sdk/extensions";

export const awakenCommand = defineCommand({
  id: "awaken",
  title: "Awaken",
  description: "Internal target used to demo middleware rejection.",
  params: { title: params.text() },
  async run(ctx, commandParams) {
    const { title = "anonymous" } = commandParams;
    await ctx.notify.toast({
      type: "info",
      title: "Awakened",
      message: `${title} is now awake.`,
    });
    return { awakened: true };
  },
});
