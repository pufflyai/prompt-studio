import { defineExtension } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./src/harness";

export default defineExtension({
  harnesses: {
    opencode: createOpencodeHarness(),
  },
  hooks: {
    provision: {
      eventId: "workspace.provision",
      async handler(ctx) {
        const skills = (await ctx.skills?.list?.()) ?? [];
        const files = skills.flatMap((skill) =>
          skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
        );

        if (ctx.workspaceFiles) await ctx.workspaceFiles.syncDir(".agents/skills", files);
      },
    },
  },
});
