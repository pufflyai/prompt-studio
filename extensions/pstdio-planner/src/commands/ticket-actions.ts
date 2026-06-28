import { type CommandContext, defineCommand, l10n, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { moveTicketToInProgress } from "../data/move-to-in-progress";
import { findTicket } from "../data/resolve";
import { buildTicketBreadcrumbItems } from "../data/ticket-breadcrumb";
import type { StoredTicket } from "../data/types";
import { notifyProposalRefined, resolveProposalRefinedNotification } from "../planner-notifications";

const ticketActionParams = {
  ticket: params.text({ label: "Ticket" }),
  rowId: params.text({ label: "Ticket row" }),
  agent: params.harness({ label: "Model" }),
};

const selectedTicketParams = {
  ticket: ticketActionParams.ticket,
  agent: ticketActionParams.agent,
};

const workspaceModeParam = params.select({
  label: "Mode",
  required: false,
  defaultValue: "worktree",
  options: [
    { label: "Worktree", value: "worktree" },
    { label: "Current branch", value: "current_branch" },
  ],
});

const nonEmptyText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const resolveTicket = (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "attachment" | "params" | "resource">,
) => {
  const ticket = nonEmptyText(ctx.params.ticket) ?? nonEmptyText(ctx.params.rowId);
  if (ticket) return ticket;

  if (ctx.resource?.type === "ticket") return ctx.resource.id;
  if (ctx.attachment?.resource?.type === "ticket") return ctx.attachment.resource.id;

  throw new Error("Ticket is required.");
};

const resolveTicketIdentity = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "storage">,
  ticketRef: string,
) => {
  const ticket = await findTicket(ctx.storage, ticketRef);
  const id = ticket?.id ?? ticketRef;
  const shorthand = nonEmptyText(ticket?.shorthand) ?? ticketRef;

  return { id, shorthand, ticket: ticket ?? { id, shorthand } };
};

const ticketBreadcrumbItems = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "storage">,
  ticket: StoredTicket | undefined,
) => {
  if (!ticket) return undefined;
  const tickets = await ticketsCollection(ctx.storage).list();
  const parentLookup = new Map(tickets.map((candidate) => [candidate.id, candidate]));
  return buildTicketBreadcrumbItems(ticket, parentLookup);
};

const resolveTicketAnchor = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "extensionId" | "projectId" | "storage">,
  ticketRef: string,
) => {
  const { id, shorthand, ticket } = await resolveTicketIdentity(ctx, ticketRef);
  const storedTicket = "title" in ticket ? ticket : undefined;
  const ticketBreadcrumb = await ticketBreadcrumbItems(ctx, storedTicket);

  return {
    anchor: {
      type: "ticket",
      id,
      projectId: ctx.projectId,
      extensionId: ctx.extensionId,
      label: shorthand,
      role: "primary",
      metadata: { shorthand, ...(ticketBreadcrumb ? { ticketBreadcrumb } : {}) },
    } satisfies ResourceAnchor,
    shorthand,
    ticket,
  };
};

const ticketTemplateVars = (ticket: string, template: string | undefined) => ({
  ticket,
  ...(template ? { templateName: template } : {}),
});

const harnessInput = (agent: { harnessId: string; model?: string } | undefined) => (agent ? { harness: agent } : {});

const createAnchoredWorkspace = async (
  ctx: Pick<
    CommandContext<{
      ticket?: string;
      rowId?: string;
      repo?: { repoId: string; branch?: string };
      mode?: string;
    }>,
    "extensionId" | "params" | "projectId" | "resource" | "attachment" | "storage" | "workspaces"
  >,
) => {
  const { mode, repo } = ctx.params;
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

  return { anchor, mode: attemptMode, ticket, workspace };
};

export const createWorkspaceCommand = defineCommand({
  title: "Create workspace",
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("dataRenderers.tickets.rowActions.createWorkspace", "Create workspace"),
      icon: "git-branch",
      placement: "first",
    },
  ],
  params: {
    ticket: ticketActionParams.ticket,
    rowId: ticketActionParams.rowId,
    repo: params.repo({ label: "Repository" }),
    mode: workspaceModeParam,
  },
  async run(ctx) {
    const { mode, ticket, workspace } = await createAnchoredWorkspace(ctx);

    return {
      mode,
      ticket,
      workspace,
      session: null,
    };
  },
});

export const runAttemptCommand = defineCommand({
  title: "Run attempt",
  menus: [
    {
      slot: "ticket.headerPrimary",
      label: l10n("dataRenderers.tickets.rowActions.runAttempt", "Run attempt"),
      icon: "play",
    },
    {
      slot: "ticket.headerOverflow",
      label: l10n("dataRenderers.tickets.rowActions.runAttempt", "Run attempt"),
      icon: "play",
    },
  ],
  params: {
    ...ticketActionParams,
    repo: params.repo({ label: "Repository" }),
    mode: workspaceModeParam,
  },
  async run(ctx) {
    const { agent } = ctx.params;
    const { anchor, mode, ticket, workspace } = await createAnchoredWorkspace(ctx);
    const session = await ctx.sessions.create({
      title: `Implement ticket: ${anchor.label}`,
      prompt: `Implement ticket: ${anchor.label}`,
      workspaceId: workspace.id,
      anchors: [anchor],
      ...harnessInput(agent),
    });
    await moveTicketToInProgress(ctx.storage, ticket.id);

    return {
      mode,
      ticket,
      workspace,
      session: { ...session, workspace_id: workspace.id },
    };
  },
});

export const refineTicketCommand = defineCommand({
  title: "Refine ticket",
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("dataRenderers.tickets.rowActions.refineTicket", "Refine ticket"),
      icon: "sparkles",
    },
  ],
  params: {
    ...selectedTicketParams,
    template: params.template({ label: "Template", type: "ticket", required: false }),
    context: params.longText({ label: "Additional context", required: false }),
  },
  async run(ctx) {
    const { agent, context, template } = ctx.params;
    const ticketRef = resolveTicket(ctx);
    const { shorthand } = await resolveTicketIdentity(ctx, ticketRef);
    const session = await ctx.sessions.create({
      title: `Refine ticket: ${shorthand}`,
      ...harnessInput(agent),
      template: "refine-ticket",
      vars: {
        ...ticketTemplateVars(shorthand, template),
        ...(context ? { additionalContext: context } : {}),
      },
    });

    return session;
  },
});

export const proposalRefinedCommand = defineCommand({
  title: "Mark proposal refined",
  cli: {
    globalAliases: [["tickets", "proposal-refined"]],
    examples: ["pstdio tickets proposal-refined --id PS-1"],
  },
  params: {
    id: params.text({ label: "Ticket", required: true }),
  },
  async run(ctx) {
    const ticket = await findTicket(ctx.storage, ctx.params.id);
    if (!ticket) throw new Error(`Unknown ticket "${ctx.params.id}"`);
    await notifyProposalRefined(ctx, ticket);
    return { ticket, notified: true };
  },
});

export const approveProposalCommand = defineCommand({
  title: "Approve proposal",
  params: {
    ticket: selectedTicketParams.ticket,
  },
  async run(ctx) {
    const ticketRef = resolveTicket(ctx);
    const ticket = await findTicket(ctx.storage, ticketRef);
    if (!ticket) throw new Error(`Unknown ticket "${ticketRef}"`);
    await resolveProposalRefinedNotification(ctx, ticket);
    return { ticket, approved: true };
  },
});

export const breakIntoSubTicketsCommand = defineCommand({
  title: "Break into sub-tickets",
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("dataRenderers.tickets.rowActions.breakIntoSubTickets", "Break into sub-tickets"),
      icon: "list-tree",
    },
  ],
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
