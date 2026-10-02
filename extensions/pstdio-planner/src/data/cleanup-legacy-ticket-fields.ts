import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import type { StoredTicket } from "./types";

// Ticket reads return stored records as they are, so a leftover `parallelizable`
// value would still reach agents as if it were a rule. Blockers in depends_on
// replaced it.
export const cleanupLegacyTicketFields = async (storage: ExtensionStorageApi) => {
  const tickets = ticketsCollection(storage);
  for (const listed of await tickets.list()) {
    if (!("parallelizable" in listed)) continue;
    // Re-read right before writing: the list can be older than an edit made since.
    const current = (await tickets.get(listed.id)) as (StoredTicket & { parallelizable?: unknown }) | null;
    if (!current || !("parallelizable" in current)) continue;
    const { parallelizable: _removed, ...ticket } = current;
    await tickets.put(ticket.id, ticket);
  }
};
