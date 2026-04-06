import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    // ──────────────────────────────────────────────────────────
    // Creates a manual code-review session
    // scoped to the selected workspace.
    // ──────────────────────────────────────────────────────────
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      params: [{ key: "agent", label: "Agent", type: "agent" }],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const ticketId = ctx.target.ticket_shorthand as string;

        await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          agent: agent?.agent,
          model: agent?.model,
          template: "code-review",
          vars: { ticket: ticketId },
        });
      },
    },
  ],
});
