import { resolveByIdOrName } from "@pstdio/sdk/data";
import type { CommandContext } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import { IDENTITY_MIGRATION, identityMigrations, migrateTicketIdentities } from "./migrate-ticket-identities";

export const prepareTicketIdentities = async (
  ctx: CommandContext,
  input: { parent?: string; dependsOn?: string[] },
) => {
  const migrations = identityMigrations(ctx);
  const started = await migrations.get(IDENTITY_MIGRATION);
  const tickets = await ticketsCollection(ctx.storage).list();
  // A concurrent command can start migration while this request reads tickets.
  // Its journal keeps reference resolution stable across that boundary and retries.
  const migration = started ?? (await migrations.get(IDENTITY_MIGRATION));
  const originals = !started?.complete && migration ? migration.tickets : tickets;
  const existing = new Set(tickets.map((ticket) => ticket.id));
  const references = originals.filter((ticket) => existing.has(ticket.id));
  const resolve = (value: string) => resolveByIdOrName(references, value, (ticket) => ticket.shorthand, "ticket");
  const parentId = input.parent === undefined ? undefined : resolve(input.parent);
  const dependsOn = (input.dependsOn ?? []).map(resolve);
  await migrateTicketIdentities(ctx);
  return { parentId, dependsOn };
};
