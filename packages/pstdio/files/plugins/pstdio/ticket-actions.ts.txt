import { createAttempt, createSession, definePlugin, renderPrompt } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-attempt",
      label: "Run attempt",
      targetType: "ticket",
      placement: "primary",
      async trigger(ctx) {
        await createAttempt(ctx, {
          ticketId: ctx.target.shorthand,
          prompt: renderPrompt(ctx.prompts["implement-ticket"], { ticket_id: ctx.target.shorthand }),
        });
      },
    },
    {
      key: "refine-ticket",
      label: "Refine ticket",
      targetType: "ticket",
      placement: "overflow",
      async trigger(ctx) {
        await createSession(ctx, {
          title: `Refine ticket: ${ctx.target.shorthand}`,
          prompt: renderPrompt(ctx.prompts["refine-ticket"], { ticket_id: ctx.target.shorthand }),
        });
      },
    },
    {
      key: "break-into-sub-tickets",
      label: "Break into sub-tickets",
      targetType: "ticket",
      placement: "overflow",
      async trigger(ctx) {
        await createSession(ctx, {
          title: `Break into sub-tickets: ${ctx.target.shorthand}`,
          prompt: renderPrompt(ctx.prompts["create-sub-tickets"], { ticket_id: ctx.target.shorthand }),
        });
      },
    },
  ],
});
