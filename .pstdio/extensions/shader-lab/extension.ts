import { defineCommand, defineExtension, defineSkill, l10n, packageAsset, params } from "@pstdio/sdk/extensions";

// Keep access to existing comparison choices while Canvas adopts the same project files.
export default defineExtension({
  skills: [
    defineSkill({
      id: "shader-lab",
      title: l10n("skills.canvas", "Review in UI Canvas"),
      source: packageAsset("./skills/shader-lab", import.meta.url),
    }),
  ],
  commands: [
    defineCommand({
      id: "compare.export",
      title: "Read legacy shader comparison",
      params: { shader: params.text({ required: true }) },
      run: (ctx, input) => ctx.storage.collection("compare").get(input.shader),
    }),
  ],
});
