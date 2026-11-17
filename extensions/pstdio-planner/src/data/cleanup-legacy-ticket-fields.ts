import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketRecords } from "./ticket-records";
import { ticketRecordPages } from "./ticket-selection";
import type { Ticket } from "./types";

// Ticket reads return stored records as they are, so a leftover `parallelizable`
// value would still reach agents as if it were a rule. Blockers in depends_on
// replaced it.
export const cleanupLegacyTicketFields = async (storage: ExtensionStorageApi) => {
  const tickets = ticketRecords(storage);
  for await (const page of ticketRecordPages(storage, {
    any: [
      { field: "parallelizable", op: "exists" },
      { field: "parallelizableText", op: "exists" },
    ],
  }))
    for (const listed of page) {
      if (!("parallelizable" in listed)) continue;
      // Re-read right before writing: the list can be older than an edit made since.
      const current = (await tickets.get(listed.id)) as (Ticket & { parallelizable?: unknown }) | null;
      if (!current || !("parallelizable" in current)) continue;
      const { parallelizable: _removed, ...ticket } = current;
      await tickets.put(ticket.id, ticket);
    }
};
