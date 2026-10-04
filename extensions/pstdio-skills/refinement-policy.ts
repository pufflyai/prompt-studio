import { defineCommand, l10n } from "@pstdio/sdk/extensions";

export const refinementPolicyCommand = defineCommand({
  id: "refinement-policy",
  title: l10n("commands.refinementPolicy.title", "Read ticket refinement policy"),
  cli: { examples: ["pst pstdio-skills refinement-policy"] },
  async run(ctx, _params) {
    const settings = await ctx.settings.all();
    return { generateArtifactPrototype: settings["refinement.generateArtifactPrototype"] };
  },
});
