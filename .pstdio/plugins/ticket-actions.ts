import { createAttempt, createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    // ──────────────────────────────────────────────────────────
    // Creates a new attempt and starts a session so implementation
    // can begin in one click.
    // ──────────────────────────────────────────────────────────
    {
      key: "run-attempt",
      label: "Run attempt",
      targetType: "ticket",
      placement: "primary",
      params: [
        { key: "agent", label: "Agent", type: "agent" },
        { key: "repo", label: "Repository", type: "repo" },
      ],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const repo = ctx.params.repo as { repo: string; branch: string } | undefined;

        await createAttempt(ctx, {
          ticketId: ctx.target.shorthand,
          agent: agent?.agent,
          model: agent?.model,
          repo_id: repo?.repo,
          branch: repo?.branch,
          prompt: `Implement ticket: ${ctx.target.shorthand}`,
        });
      },
    },
    // ──────────────────────────────────────────────────────────
    // Opens a refinement session for the selected ticket to clarify
    // scope, acceptance criteria, and implementation details.
    // ──────────────────────────────────────────────────────────
    {
      key: "refine-ticket",
      label: "Refine ticket",
      targetType: "ticket",
      placement: "overflow",
      params: [
        { key: "agent", label: "Agent", type: "agent" },
        { key: "template", label: "Template", type: "template-select", templateType: "ticket", required: false },
        { key: "context", label: "Additional context", type: "longtext", required: false },
      ],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const template = ctx.params.template as string | undefined;
        const context = ctx.params.context as string | undefined;

        const parts = [`Refine ticket: ${ctx.target.shorthand}`];
        if (template) parts.push(`Use template: ${template}`);
        if (context) parts.push(`Additional context:\n${context}`);

        await createSession(ctx, {
          title: `Refine ticket: ${ctx.target.shorthand}`,
          agent: agent?.agent,
          model: agent?.model,
          prompt: parts.join("\n\n"),
        });
      },
    },
    // ──────────────────────────────────────────────────────────
    // Break the selected ticket into smaller,
    // implementation-ready sub-tickets.
    // ──────────────────────────────────────────────────────────
    {
      key: "break-into-sub-tickets",
      label: "Break into sub-tickets",
      targetType: "ticket",
      placement: "overflow",
      params: [
        { key: "agent", label: "Agent", type: "agent" },
        { key: "template", label: "Template", type: "template-select", templateType: "ticket", required: false },
      ],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const template = ctx.params.template as string | undefined;

        const parts = [`Breakdown ticket: ${ctx.target.shorthand} into sub-tickets`];
        if (template) parts.push(`Use template: ${template}`);

        await createSession(ctx, {
          title: `Break into sub-tickets: ${ctx.target.shorthand}`,
          agent: agent?.agent,
          model: agent?.model,
          prompt: parts.join("\n\n"),
        });
      },
    },
  ],
});
