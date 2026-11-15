import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerOwnerFor } from "./ticket-resource-hierarchy";

export const readTicketSessionPage = (
  ctx: Pick<ExtensionContextBase, "sessions" | "projectId" | "extensionId">,
  ticketId: string,
  cursor?: string,
) =>
  ctx.sessions.query({
    anchor: { type: "ticket", id: ticketId, projectId: ctx.projectId, extensionId: plannerOwnerFor(ctx) },
    includeWorkspaceAnchors: true,
    includeArchived: true,
    orderBy: "lastActivity",
    limit: 100,
    cursor,
  });
