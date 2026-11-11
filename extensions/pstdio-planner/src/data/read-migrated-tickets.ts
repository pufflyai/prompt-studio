import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "./migrate-storage";
import { migrateArrivingTicketOrder } from "./migrate-ticket-order";
import { migratePullRequestLinks } from "./pull-request-resources";
import { withTicketIdentities } from "./ticket-identity";
import { ticketRecords } from "./ticket-records";

export const readMigratedTickets = async (
  ctx: Pick<ExtensionContextBase, "storage" | "files" | "resources" | "commands" | "extensionId" | "projectId">,
) => {
  await migratePlannerStorage(ctx);
  const rows = await ticketRecords(ctx.storage).list();
  const tickets = await withTicketIdentities(ctx, await migrateArrivingTicketOrder(ctx.storage, rows));
  if (
    !tickets.some((ticket) =>
      ticket.reviewLinks?.some((link) => link.provider === "github" && link.kind === "pull_request"),
    )
  )
    return tickets;
  for (const ticket of tickets) await migratePullRequestLinks(ctx, ticket);
  return withTicketIdentities(ctx, await ticketRecords(ctx.storage).list());
};
