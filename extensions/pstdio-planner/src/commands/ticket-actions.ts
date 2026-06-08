import { type CommandContext, defineCommand, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";

const ticketActionParams = {
  ticket: params.text({ label: "Ticket" }),
  rowId: params.text({ label: "Ticket row" }),
  agent: params.harness({ label: "Agent" }),
};

const selectedTicketParams = {
  ticket: ticketActionParams.ticket,
  agent: ticketActionParams.agent,
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

const resolveTicketAnchor = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "extensionId" | "projectId" | "storage">,
  ticketRef: string,
) => {
  const ticket = await findTicket(ctx.storage, ticketRef);
  const id = ticket?.id ?? ticketRef;
  const shorthand = ticket?.shorthand ?? ticketRef;

  return {
    anchor: {
      type: "ticket",
      id,
      projectId: ctx.projectId,
      extensionId: ctx.extensionId,
      label: shorthand,
      role: "primary",
      metadata: { shorthand },
    } satisfies ResourceAnchor,
    shorthand,
    ticket: ticket ?? { id, shorthand },
  };
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
    mode: params.text({ label: "Mode", required: false }),
    startSession: params.boolean({ label: "Start session", required: false }),
  },
  async run(ctx) {
    const { agent, mode, repo, startSession } = ctx.params;
    const ticketRef = resolveTicket(ctx);
    const { anchor, shorthand, ticket } = await resolveTicketAnchor(ctx, ticketRef);
    const attemptMode = mode === "current_branch" ? mode : "worktree";
    const workspace = await ctx.workspaces.create({
      project_id: ctx.projectId,
      shorthand_base: shorthand,
      anchors: [anchor],
      mode: attemptMode,
      ...(repo ? { repo_id: repo.repoId, base: repo.branch } : {}),
    });
    const session =
      startSession === false
        ? null
        : await ctx.sessions.create({
            title: `Implement ticket: ${shorthand}`,
            prompt: `Implement ticket: ${shorthand}`,
            workspaceId: workspace.id,
            anchors: [anchor],
            ...harnessInput(agent),
          });

    return {
      mode: attemptMode,
      ticket,
      workspace,
      session: session ? { ...session, workspace_id: workspace.id } : null,
    };
  },
});

export const refineTicketCommand = defineCommand({
  title: "Refine ticket",
  menus: [{ slot: "ticket.headerOverflow", label: "Refine ticket" }],
  params: {
    ...selectedTicketParams,
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
