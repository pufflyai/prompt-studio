import type { CommandContext } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";

export interface TicketIdentityMigration {
  tickets: { id: string; shorthand: string }[];
  complete: boolean;
}
export const identityMigrations = (ctx: Pick<CommandContext, "storage">) =>
  ctx.storage.collection<TicketIdentityMigration>("identity-migrations");
export const IDENTITY_MIGRATION = "ticket-identities-v1";

export const allocateTicketIdentity = async (ctx: CommandContext) => {
  const migrations = identityMigrations(ctx);
  let migration = await migrations.get(IDENTITY_MIGRATION);
  if (!migration && (await ticketsCollection(ctx.storage).list()).length === 0) {
    await migrations.createIfAbsent(IDENTITY_MIGRATION, { tickets: [], complete: true });
    migration = await migrations.get(IDENTITY_MIGRATION);
  }
  if (!migration?.complete)
    throw new Error("Run pst pstdio-planner migrate-ticket-identities before creating tickets in this project.");
  return ctx.resources.allocate({ kind: "ticket" });
};
