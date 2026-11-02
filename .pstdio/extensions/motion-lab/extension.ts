import { defineCommand, defineExtension, defineSkill, l10n, packageAsset, params } from "@pstdio/sdk/extensions";

// Existing project review records belong to this extension ID. Canvas reads them once through
// this command; the retired extension contributes no views, navigation, player or compiler.
export default defineExtension({
  skills: [
    defineSkill({
      id: "motion-lab",
      title: l10n("skills.canvas", "Review in UI Canvas"),
      source: packageAsset("./skills/motion-lab", import.meta.url),
    }),
  ],
  commands: [
    defineCommand({
      id: "review.export",
      title: "Read legacy motion review",
      params: { study: params.text({ required: true }) },
      run: (ctx, input) => ctx.storage.collection("reviews").get(input.study),
    }),
  ],
});
