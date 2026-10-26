import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { listTicketReviewRequests } from "../data/review-request-storage";
import { readSessionHistory } from "../data/session-history";
import type { Ticket } from "../data/types";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";

export const readTicketTreeData = async (
  ctx: Pick<ExtensionContextBase, "storage" | "sessions" | "workspaces" | "resources">,
  ticket: Ticket,
) => {
  const workspaceData = ctx.workspaces.list().then(async (workspaces) => {
    const linkedWorkspaces = workspaces.filter((workspace) => isWorkspaceLinkedToTicket(workspace, ticket));
    const histories = await Promise.all(
      linkedWorkspaces.map((workspace) => readSessionHistory(ctx.sessions, { workspaceId: workspace.id })),
    );
    return { workspaces, linkedWorkspaces, workspaceSessions: histories.flat() };
  });
  const [tickets, reviewRequests, statuses, providers, sessions, linked] = await Promise.all([
    ticketsCollection(ctx).list(),
    listTicketReviewRequests(ctx.storage, ticket.id),
    statusesCollection(ctx.storage).list(),
    ctx.workspaces.listProviders(),
    readSessionHistory(ctx.sessions, { anchor: { type: "ticket", id: ticket.id } }),
    workspaceData,
  ]);
  return {
    tickets,
    reviewRequests,
    statusesById: new Map(statuses.map((status) => [status.id, status])),
    providers,
    sessions,
    ...linked,
  };
};
