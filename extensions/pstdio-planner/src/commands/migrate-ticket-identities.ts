import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { migrateTicketIdentities } from "../data/migrate-ticket-identities";

export const migrateTicketIdentitiesCommand = defineCommand({
  id: "migrate-ticket-identities",
  title: l10n("commands.migrateTicketIdentities", "Migrate ticket identities"),
  mutating: true,
  cli: true,
  params: {},
  run: migrateTicketIdentities,
});
