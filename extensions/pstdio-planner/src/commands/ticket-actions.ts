import {
  type CommandContext,
  defineCommand,
  l10n,
  params,
  type ResourceAnchor,
  type TemplateParam,
} from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { renderOwnedTemplate } from "../data/template-store";
import { ticketResourceHierarchyMetadata } from "../data/ticket-resource-hierarchy";
import type { StoredTicket } from "../data/types";
import { notifyProposalRefined, resolveProposalRefinedNotification } from "../planner-notifications";
import { ticketMenuSlots } from "../resource-kinds";

export const ticketActionParams = {
  ticket: params.text({ label: "Ticket", resolvedFrom: "resource" }),
  rowId: params.text({ label: "Ticket row", resolvedFrom: "resource" }),
  agent: params.harness({ label: "Model" }),
};

const selectedTicketParams = {
  ticket: ticketActionParams.ticket,
  agent: ticketActionParams.agent,
};

export const workspaceModeParam = params.select({
  label: "Mode",
  required: false,
  defaultValue: "worktree",
  options: [
    { label: "Worktree", value: "worktree", icon: "GitFork" },
    { label: "Current branch", value: "current_branch", icon: "GitBranch" },
  ],
});

const nonEmptyText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const resolveTicket = (
  ctx: Pick<CommandContext, "attachment" | "resource">,
  commandParams: { ticket?: string; rowId?: string },
) => {
  const ticket = nonEmptyText(commandParams.ticket) ?? nonEmptyText(commandParams.rowId);
  if (ticket) return ticket;

  if (ctx.resource?.type === "ticket") return ctx.resource.id;
  if (ctx.attachment?.resource?.type === "ticket") return ctx.attachment.resource.id;

  throw new Error("Ticket is required.");
};

export const resolveTicketIdentity = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "storage">,
  ticketRef: string,
) => {
  const ticket = await findTicket(ctx.storage, ticketRef);
  const id = ticket?.id ?? ticketRef;
  const shorthand = nonEmptyText(ticket?.shorthand) ?? ticketRef;

  return { id, shorthand, ticket: ticket ?? { id, shorthand } };
};

const ticketHierarchyMetadata = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "storage">,
  ticket: StoredTicket | undefined,
) => {
  if (!ticket) return undefined;
  const tickets = await ticketsCollection(ctx.storage).list();
  const parentLookup = new Map(tickets.map((candidate) => [candidate.id, candidate]));
  return ticketResourceHierarchyMetadata(ticket, parentLookup);
};

const resolveTicketAnchor = async (
  ctx: Pick<CommandContext<{ ticket?: string; rowId?: string }>, "extensionId" | "projectId" | "storage">,
  ticketRef: string,
) => {
  const { id, shorthand, ticket } = await resolveTicketIdentity(ctx, ticketRef);
  const storedTicket = "title" in ticket ? ticket : undefined;
  const hierarchyMetadata = await ticketHierarchyMetadata(ctx, storedTicket);

  return {
    anchor: {
      type: "ticket",
      id,
      projectId: ctx.projectId,
      extensionId: ctx.extensionId,
      label: shorthand,
      role: "primary",
      metadata: hierarchyMetadata ?? { shorthand },
    } satisfies ResourceAnchor,
    shorthand,
    ticket,
  };
};

const ticketTemplateVars = (ticket: string, template: string | undefined) => ({
  ticket,
  ...(template ? { templateName: template } : {}),
});

export const harnessInput = (agent: { harnessId: string; model?: string } | undefined) =>
  agent ? { harness: agent } : {};

export const createAnchoredWorkspace = async (
  ctx: Pick<
    CommandContext<{
      ticket?: string;
      rowId?: string;
      repo?: { repoId: string; branch?: string };
      mode?: string;
    }>,
    "extensionId" | "projectId" | "resource" | "attachment" | "storage" | "workspaces"
  >,
  commandParams: {
    ticket?: string;
    rowId?: string;
    repo?: { repoId: string; branch?: string };
    mode?: string;
  },
  base?: string,
) => {
  const { mode, repo } = commandParams;
  const ticketRef = resolveTicket(ctx, commandParams);
  const { anchor, shorthand, ticket } = await resolveTicketAnchor(ctx, ticketRef);
  const attemptMode = mode === "current_branch" ? mode : "worktree";
  const workspace = await ctx.workspaces.create({
    project_id: ctx.projectId,
    shorthand_base: shorthand,
    anchors: [anchor],
    provider_id: attemptMode === "current_branch" ? "pstdio.root" : "pstdio.worktree",
    ...(repo ? { repo_id: repo.repoId } : {}),
    ...((base ?? repo?.branch) ? { base: base ?? repo?.branch } : {}),
  });

  return { anchor, mode: attemptMode, ticket, workspace };
};

export const createWorkspaceCommand = defineCommand({
  id: "create-workspace",
  title: "Create workspace",
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.createWorkspace", "Create workspace"),
      icon: "git-branch",
      placement: "first",
    },
  ],
  params: {
    ticket: ticketActionParams.ticket,
    rowId: ticketActionParams.rowId,
    repo: params.repo({ label: "Workspace" }),
    mode: workspaceModeParam,
  },
  async run(ctx, commandParams) {
    const { mode, ticket, workspace } = await createAnchoredWorkspace(ctx, commandParams);

    return {
      mode,
      ticket,
      workspace,
      session: null,
    };
  },
});

export const refineTicketCommand = defineCommand({
  id: "refine-ticket",
  title: "Refine ticket",
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.refineTicket", "Refine ticket"),
      icon: "sparkles",
    },
  ],
  params: {
    ...selectedTicketParams,
    template: {
      type: "template",
      templateType: "ticket",
      label: "Ticket template",
      required: false,
    } as TemplateParam<false>,
    context: params.longText({ label: "Additional context", required: false }),
  },
  async run(ctx, commandParams) {
    const { agent, context, template } = commandParams;
    const ticketRef = resolveTicket(ctx, commandParams);
    const { anchor, shorthand } = await resolveTicketAnchor(ctx, ticketRef);
    const variables = {
      ...ticketTemplateVars(shorthand, template),
      ...(context ? { additionalContext: context } : {}),
    };
    const session = await ctx.sessions.create({
      title: `Refine ticket: ${shorthand}`,
      anchors: [anchor],
      ...harnessInput(agent),
      prompt: await renderOwnedTemplate(ctx, "refine-ticket", variables),
    });

    return session;
  },
});

export const proposalRefinedCommand = defineCommand({
  id: "proposal-refined",
  title: "Mark proposal refined",
  cli: {
    globalAliases: [["tickets", "proposal-refined"]],
    examples: ["pstdio tickets proposal-refined --id PS-1"],
  },
  params: {
    id: params.text({ label: "Ticket", required: true }),
  },
  async run(ctx, commandParams) {
    const ticket = await findTicket(ctx.storage, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);
    await notifyProposalRefined(ctx, ticket);
    return { ticket, notified: true };
  },
});

export const approveProposalCommand = defineCommand({
  id: "approve-proposal",
  title: "Approve proposal",
  params: {
    ticket: selectedTicketParams.ticket,
  },
  async run(ctx, commandParams) {
    const ticketRef = resolveTicket(ctx, commandParams);
    const ticket = await findTicket(ctx.storage, ticketRef);
    if (!ticket) throw new Error(`Unknown ticket "${ticketRef}"`);
    await resolveProposalRefinedNotification(ctx, ticket);
    return { ticket, approved: true };
  },
});

export const breakIntoSubTicketsCommand = defineCommand({
  id: "break-into-sub-tickets",
  title: "Break into sub-tickets",
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.breakIntoSubTickets", "Break into sub-tickets"),
      icon: "list-tree",
    },
  ],
  params: {
    ...ticketActionParams,
    template: {
      type: "template",
      templateType: "ticket",
      label: "Ticket template",
      required: false,
    } as TemplateParam<false>,
  },
  async run(ctx, commandParams) {
    const { agent, template } = commandParams;
    const ticketRef = resolveTicket(ctx, commandParams);
    const { anchor, shorthand } = await resolveTicketAnchor(ctx, ticketRef);

    return ctx.sessions.create({
      title: `Break into sub-tickets: ${shorthand}`,
      anchors: [anchor],
      ...harnessInput(agent),
      prompt: await renderOwnedTemplate(ctx, "create-sub-tickets", ticketTemplateVars(shorthand, template)),
    });
  },
});
