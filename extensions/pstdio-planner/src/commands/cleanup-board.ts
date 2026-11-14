import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { renderOwnedTemplate } from "../data/template-store";
import { harnessInput, openActionSession } from "./ticket-actions";

export const cleanupBoardCommand = defineCommand({
  id: "cleanup-board",
  title: l10n("commands.cleanupBoard.title", "Cleanup board"),
  cli: true,
  params: {
    agent: params.harness({ label: l10n("commands.cleanupBoard.model", "Model") }),
  },
  async run(ctx, { agent }) {
    const session = await ctx.sessions.create({
      title: "Cleanup board",
      ...harnessInput(agent),
      prompt: await renderOwnedTemplate(ctx, "cleanup-board", {}),
    });
    openActionSession(ctx, session);
    return session;
  },
});
