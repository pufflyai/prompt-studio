import { defineView } from "@pstdio/sdk/extensions";
import { buildDigestMarkdown } from "../digest-markdown";
import { readSettings } from "../settings";
import { ideasOf, radarChanged, runsOf, threadsOf } from "../store";

export const digestView = defineView({
  id: "digest",
  title: "Digest",
  icon: "file-text",
  body: {
    kind: "file",
    refreshEvents: [radarChanged],
    async load(ctx, { renderer }) {
      const id = renderer.resource?.id;
      const run = id ? await runsOf(ctx).get(id) : null;
      if (!run) return { emptyState: { title: "Run not found", description: "Pick a run under Runs." } };
      const threads = await threadsOf(ctx).list();
      const ideas = (await ideasOf(ctx).list()).filter((idea) => idea.runId === run.id);
      const { budgets } = await readSettings(ctx.settings);
      return {
        fileName: "digest.md",
        mimeType: "text/markdown",
        content: buildDigestMarkdown(run, threads, ideas, budgets),
        editable: false,
      };
    },
  },
});
