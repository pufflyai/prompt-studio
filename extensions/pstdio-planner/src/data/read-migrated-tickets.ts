import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "./migrate-storage";
import { migrateArrivingTicketOrder } from "./migrate-ticket-order";
import { withTicketIdentities } from "./ticket-identity";
import { ticketRecords } from "./ticket-records";
import { missingTicketPosition, ticketSelectionPage } from "./ticket-selection";

export const ensureTicketStorage = async (ctx: Pick<ExtensionContextBase, "storage" | "files">) => {
  await migratePlannerStorage(ctx);
  const missing = (
    await ticketSelectionPage(ctx.storage, { index: "ticket-missing-position", where: missingTicketPosition, limit: 1 })
  ).records[0];
  if (!missing) return;
  const row = await ticketRecords(ctx.storage).get(String(missing.fields.id));
  if (row) await migrateArrivingTicketOrder(ctx.storage, [row]);
};

export const readMigratedTickets = async (ctx: Pick<ExtensionContextBase, "storage" | "files" | "resources">) => {
  await migratePlannerStorage(ctx);
  const rows = await ticketRecords(ctx.storage).list();
  return withTicketIdentities(ctx, await migrateArrivingTicketOrder(ctx.storage, rows));
};
