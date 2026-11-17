import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { readStatusDefinitions } from "../data/definition-query";
import { linkedWorkspacePage } from "../data/linked-workspaces";
import { readTicketNavigation } from "../data/navigation-queries";
import { readReviewCounts } from "../data/review-query-counts";
import { readTicketLinkedResourcePage } from "../data/ticket-linked-resources";
import { plannerOwnerFor } from "../data/ticket-resource-hierarchy";
import { readTicketSessionPage } from "../data/ticket-session-page";
import type { Ticket } from "../data/types";

export const readTicketTreeData = async (
  ctx: Pick<ExtensionContextBase, "storage" | "sessions" | "workspaces" | "resources" | "projectId" | "extensionId">,
  ticket: Ticket,
) => {
  const workspaceData = (async () => {
    const [page, home] = await Promise.all([linkedWorkspacePage(ctx, [ticket]), ctx.workspaces.getDefault()]);
    const workspaces = [...new Map([...(home ? [home] : []), ...page.items].map((row) => [row.id, row])).values()];
    return {
      workspaces,
      linkedWorkspaces: page.items,
      workspaceCursor: page.nextCursor,
    };
  })();
  const [navigation, reviews, statuses, providers, sessions, linked, resourceLinks] = await Promise.all([
    readTicketNavigation(ctx, ticket),
    readReviewCounts(ctx.storage, [ticket.id]),
    readStatusDefinitions(ctx.storage),
    ctx.workspaces.listProviders(),
    readTicketSessionPage(ctx, ticket.id),
    workspaceData,
    readTicketLinkedResourcePage(ctx.resources, {
      type: "ticket",
      extensionId: plannerOwnerFor(ctx),
      projectId: ctx.projectId,
      id: ticket.id,
    }),
  ]);
  return {
    ...navigation,
    resourceLinks: resourceLinks.items,
    resourceCursor: resourceLinks.nextCursor,
    reviewCounts: reviews.get(ticket.id)!,
    statusesById: new Map(statuses.map((status) => [status.id, status])),
    providers,
    sessions: [],
    workspaceSessions: sessions.items,
    sessionCursor: sessions.nextCursor ?? undefined,
    ...linked,
  };
};
