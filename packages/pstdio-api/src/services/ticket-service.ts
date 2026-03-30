import type { createTicketsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

type HookPayload = Record<string, unknown>;

export type TicketServiceDeps = {
  ticketsDb: ReturnType<typeof createTicketsDBService>;
  eventBus: EventBus;
  onPreTicketDeletion?: (projectId: string, payload: HookPayload) => Promise<{ rejected: boolean; error: string }>;
  onPostTicketDeletion?: (projectId: string, payload: HookPayload) => void;
};

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

  const softDelete = async (id: string, projectId: string, payload: HookPayload) => {
    if (deps.onPreTicketDeletion) {
      const preHook = await deps.onPreTicketDeletion(projectId, payload);
      if (preHook.rejected) return { rejected: true as const, error: preHook.error };
    }

    const deleted = await raw.softDelete(id);
    if (!deleted) return { rejected: false as const, result: null };

    deps.eventBus.emit("tickets", "set", deleted);
    deps.onPostTicketDeletion?.(projectId, { id: deleted.id, shorthand: deleted.shorthand });
    return { rejected: false as const, result: deleted };
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
