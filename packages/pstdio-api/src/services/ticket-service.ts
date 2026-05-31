import type { ExtensionTicket } from "@pstdio/sdk/extensions";
import type { createTicketsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type TicketServiceDeps = {
  ticketsDb: ReturnType<typeof createTicketsDBService>;
  eventBus: EventBus;
  onPostTicketDeletion?: (projectId: string, payload: ExtensionTicket) => void;
};

/** @deprecated Legacy core ticket service. Ticket data is owned by the pstdio tickets extension. */
export const createTicketService = (deps: TicketServiceDeps) => {
  const raw = deps.ticketsDb;

  // --- reads (pass-through) ---
  const get = raw.get;
  const getByShorthand = raw.getByShorthand;
  const list = raw.list;
  const getTagOptionAssignments = raw.getTagOptionAssignments;
  const listTagAssignments = raw.listTagAssignments;

  // --- mutations (orchestrated) ---
  const create = raw.create;

  const update = async (id: string, input: Record<string, unknown>) => {
    const updated = await raw.update(id, input as Parameters<typeof raw.update>[1]);
    if (!updated) return null;

    deps.eventBus.emit("tickets", "set", updated);
    return updated;
  };

  const softDelete = async (id: string, projectId: string) => {
    const deleted = await raw.softDelete(id);
    if (!deleted) return null;

    deps.eventBus.emit("tickets", "set", deleted);
    deps.onPostTicketDeletion?.(projectId, { id: deleted.id, shorthand: deleted.shorthand });
    return deleted;
  };

  const assignTagOptions = raw.assignTagOptions;

  return {
    get,
    getByShorthand,
    list,
    getTagOptionAssignments,
    listTagAssignments,
    create,
    update,
    softDelete,
    assignTagOptions,
  };
};
