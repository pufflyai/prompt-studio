import { defineExtension, workspaceEvents } from "@pstdio/sdk/extensions";
import { createClaudeCodeHarness } from "./src/harness";

export default defineExtension({
  harnesses: {
    claudeCode: createClaudeCodeHarness(),
  },
  hooks: {
    // Materialize the project skill catalog into the workspace before sessions launch,
    // so Claude Code never reads a half-copied .claude/skills dir.
    provision: {
      event: workspaceEvents.provision,
      async handler(ctx) {
        const skills = (await ctx.skills?.list?.()) ?? [];
        const files = skills.flatMap((skill) =>
          skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
        );

        if (ctx.workspaceFiles) await ctx.workspaceFiles.syncDir(".claude/skills", files);
      },
    },
  },
});
