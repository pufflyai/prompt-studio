import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "./migrate-storage";
import { migrateArrivingTicketOrder } from "./migrate-ticket-order";
import { withTicketIdentities } from "./ticket-identity";
import { ticketRecords } from "./ticket-records";

export const readMigratedTickets = async (ctx: Pick<ExtensionContextBase, "storage" | "files" | "resources">) => {
  await migratePlannerStorage(ctx);
  const rows = await ticketRecords(ctx.storage).list();
  return withTicketIdentities(ctx, await migrateArrivingTicketOrder(ctx.storage, rows));
};
