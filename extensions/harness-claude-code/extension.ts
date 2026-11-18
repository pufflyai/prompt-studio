import { defineExtension, defineHarness, defineHook, l10n, workspaceEvents } from "@pstdio/sdk/extensions";
import { createClaudeCodeHarness } from "./src/harness";
import { quotasCommand } from "./src/quotas";

export default defineExtension({
  settings: {
    properties: {
      restartAfterQuotaReset: {
        type: "boolean",
        scope: "device",
        default: false,
        title: l10n("quota.restart.title", "Restart after quota reset"),
        description: l10n(
          "quota.restart.description",
          "Resume conversations stopped by quota limits 15 seconds after the limits reset. Manual stops stay stopped.",
        ),
      },
    },
  },
  commands: [quotasCommand],
  harnesses: [defineHarness(createClaudeCodeHarness())],
  hooks: [
    // Materialize the project skill catalog into the workspace before sessions launch,
    // so Claude Code never reads a half-copied .claude/skills dir.
    defineHook({
      id: "provision",
      event: workspaceEvents.provision,
      async run(ctx, _payload) {
        const skills = (await ctx.skills?.list?.()) ?? [];
        const files = skills.flatMap((skill) =>
          skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
        );

        if (ctx.workspaceFiles) await ctx.workspaceFiles.syncDir(".claude/skills", files);
      },
    }),
  ],
});
