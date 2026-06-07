import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import { findTicket, resolveStatusId } from "./resolve";

// Conventional names for the in-progress board column, tried in order.
const IN_PROGRESS_NAMES = ["In Progress", "wip"];

// Moves a ticket into the project's in-progress column. Best-effort and
// idempotent: a missing ticket or absent in-progress column is a no-op, and a
// ticket already in progress is left untouched (so it emits no redundant change).
export const moveTicketToInProgress = async (storage: ExtensionStorageApi, ticketRef: string) => {
  const ticket = await findTicket(storage, ticketRef);
  if (!ticket) return;

  for (const name of IN_PROGRESS_NAMES) {
    try {
      const statusId = await resolveStatusId(storage, name);
      if (ticket.statusId === statusId) return;
      await ticketsCollection(storage).put(ticket.id, { ...ticket, statusId, updatedAt: new Date().toISOString() });
      return;
    } catch {
      // Try the next conventional name; the project may not have this column.
    }
  }
};
