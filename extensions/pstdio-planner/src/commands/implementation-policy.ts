import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { savedTargetBranch } from "../data/implementation-targets";

export const implementationPolicyCommand = defineCommand({
  id: "implementation-policy",
  title: l10n("commands.implementationPolicy.title", "Read ticket implementation policy"),
  cli: { examples: ["pst pstdio-planner implementation-policy"] },
  async run(ctx, _commandParams) {
    const settings = await ctx.settings.all();
    return {
      adversarialReview: settings["implementation.adversarialReview"],
      openPr: settings["implementation.openPr"],
      defaultTargetBranch: savedTargetBranch(settings) || null,
    };
  },
});
