import { defineCommand } from "@pstdio/sdk/extensions";

export const automationPolicyCommand = defineCommand({
  id: "automation-policy",
  title: "Read planner automation policy",
  async run(ctx, _commandParams) {
    const maxInProgress = await ctx.settings.get("automation.maxInProgress");
    return { maxInProgress: typeof maxInProgress === "number" && maxInProgress >= 0 ? maxInProgress : 2 };
  },
});
