import { defineCommand, l10n, params, sessionBrowser } from "@pstdio/sdk/extensions";
import { rememberReviewerSession } from "./store";

const reviewPrompt = (limit: number, focus: string) =>
  [
    "Use the `analyze-agent-sessions` skill.",
    "",
    `1. Run \`pst pstdio.dev insights scan\` to pick up new sessions.`,
    focus === "failed"
      ? `2. Classify up to ${limit} sessions from \`pst pstdio.dev insights list --needs-review --outcome failed --limit ${limit}\`, then \`--outcome partial\` if any are left.`
      : `2. Classify up to ${limit} sessions from \`pst pstdio.dev insights list --needs-review --limit ${limit}\`.`,
    "3. Spot-check five heuristic successes from `pst pstdio.dev insights list --outcome success --source heuristic --limit 20`.",
    "4. Run `pst pstdio.dev insights report --agent-only` and follow the skill's synthesis steps to draft skill and documentation proposals.",
    "",
    "Do not edit AGENTS.md, CLAUDE.md, skills or docs in the repository. Write proposals only, then summarize them for me.",
  ].join("\n");

export const startReview = defineCommand({
  id: "insights.review",
  mutating: true,
  title: l10n("insights.commands.review", "Review sessions with an agent"),
  description:
    "Start an agent session that classifies sessions needing review and drafts skill and documentation proposals from the failures.",
  cli: { examples: ["pst pstdio.dev insights review --limit 30"] },
  palette: [{ label: l10n("insights.commands.review", "Review sessions with an agent") }],
  params: {
    limit: params.number({ label: "Sessions to classify", defaultValue: 30 }),
    focus: params.select({
      label: "Focus",
      options: [
        { value: "flagged", label: "Every flagged session" },
        { value: "failed", label: "Failures first" },
      ],
      defaultValue: "flagged",
    }),
    harness: params.harness({ label: "Model" }),
  },
  async run(ctx, input) {
    const session = await ctx.sessions.create({
      title: "Session insights review",
      prompt: reviewPrompt(Math.max(1, input.limit ?? 30), input.focus ?? "flagged"),
      ...(input.harness ? { harness: input.harness } : {}),
    });
    await rememberReviewerSession(ctx, session.id);
    ctx.navigation.open({
      kind: "page",
      page: sessionBrowser.pages.session,
      resource: {
        type: "session",
        id: session.id,
        extensionId: "pstdio",
        projectId: ctx.projectId,
        label: session.title,
      },
    });
    return { sessionId: session.id };
  },
});
