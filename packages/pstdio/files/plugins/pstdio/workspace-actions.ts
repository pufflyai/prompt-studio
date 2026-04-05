import { createSession, definePlugin, renderPrompt } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      async trigger(ctx) {
        const ticketId = ctx.target.ticket_shorthand || null;

        await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          prompt: renderPrompt(ctx.prompts["code-review"], ticketId ? { ticket: ticketId } : {}),
        });
      },
    },
  ],
});
