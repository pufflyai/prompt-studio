import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";

const ticketActionParams = {
  ticket: params.text({ label: "Ticket" }),
  rowId: params.text({ label: "Ticket row" }),
  agent: params.harness({ label: "Agent" }),
};

const resolveTicket = (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "attachment" | "params" | "resource">,
) => {
  const ticket = ctx.params.ticket ?? ctx.params.rowId;
  if (ticket) return ticket;

  if (ctx.resource?.type === "ticket") return ctx.resource.id;
  if (ctx.attachment?.resource?.type === "ticket") return ctx.attachment.resource.id;

  throw new Error("Ticket is required.");
};

const ticketTemplateVars = (ticket: string, template: string | undefined) => ({
  ticket,
  ...(template ? { templateName: template } : {}),
});

const harnessInput = (agent: { harnessId: string; model?: string } | undefined) => (agent ? { harness: agent } : {});

export const runAttemptCommand = defineCommand({
  title: "Run attempt",
  menus: [{ slot: "ticket.headerPrimary", label: "Run attempt" }],
  params: {
    ...ticketActionParams,
    repo: params.repo({ label: "Repository" }),
  },
  async run(ctx) {
    const { agent, repo } = ctx.params;
    const ticket = resolveTicket(ctx);

    return ctx.tickets.createAttempt({
      ticket,
      ...(agent ? { agent: agent.harnessId, model: agent.model } : {}),
      ...(repo ? { repoId: repo.repoId, branch: repo.branch } : {}),
      prompt: `Implement ticket: ${ticket}`,
    });
  },
});

export const refineTicketCommand = defineCommand({
  title: "Refine ticket",
  menus: [{ slot: "ticket.headerOverflow", label: "Refine ticket" }],
  params: {
    ...ticketActionParams,
    template: params.template({ label: "Template", type: "ticket", required: false }),
    context: params.longText({ label: "Additional context", required: false }),
  },
  async run(ctx) {
    const { agent, context, template } = ctx.params;
    const ticket = resolveTicket(ctx);

    return ctx.sessions.create({
      title: `Refine ticket: ${ticket}`,
      ...harnessInput(agent),
      template: "refine-ticket",
      vars: {
        ...ticketTemplateVars(ticket, template),
        ...(context ? { additionalContext: context } : {}),
      },
    });
  },
});

export const breakIntoSubTicketsCommand = defineCommand({
  title: "Break into sub-tickets",
  menus: [{ slot: "ticket.headerOverflow", label: "Break into sub-tickets" }],
  params: {
    ...ticketActionParams,
    template: params.template({ label: "Template", type: "ticket", required: false }),
  },
  async run(ctx) {
    const { agent, template } = ctx.params;
    const ticket = resolveTicket(ctx);

    return ctx.sessions.create({
      title: `Break into sub-tickets: ${ticket}`,
      ...harnessInput(agent),
      template: "create-sub-tickets",
      vars: ticketTemplateVars(ticket, template),
    });
  },
});
