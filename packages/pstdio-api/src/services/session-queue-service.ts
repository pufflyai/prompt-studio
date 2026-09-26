import type { createSessionQueueEntriesDBService } from "pstdio-db";

type Queue = ReturnType<typeof createSessionQueueEntriesDBService>;

/** All API queue mutations publish the owning session after their transaction commits. */
export const createSessionQueueService = (raw: Queue, touch: (sessionId: string) => Promise<unknown>): Queue => {
  const pending = new Map<string, Promise<void>>();
  const notify = (sessionId: string) => {
    const existing = pending.get(sessionId);
    if (existing) return existing;
    const next = Promise.resolve().then(async () => {
      pending.delete(sessionId);
      await touch(sessionId);
    });
    pending.set(sessionId, next);
    return next;
  };
  const notifyRow = async <T extends { session_id: string } | null | undefined>(result: T) => {
    if (result) await notify(result.session_id);
    return result;
  };
  return {
    ...raw,
    create: async (...args) => notifyRow(await raw.create(...args)),
    createDispatchStarted: async (...args) => notifyRow(await raw.createDispatchStarted(...args)),
    updatePending: async (...args) => notifyRow(await raw.updatePending(...args)),
    markDispatchStarted: async (...args) => notifyRow(await raw.markDispatchStarted(...args)),
    swapPending: async (...args) => {
      const first = await raw.get(args[0]);
      const second = await raw.get(args[2]);
      const swapped = await raw.swapPending(...args);
      if (swapped)
        await Promise.all(
          [...new Set([first?.session_id, second?.session_id])].map((id) => (id ? notify(id) : undefined)),
        );
      return swapped;
    },
    remove: async (position) => {
      const entry = await raw.get(position);
      await raw.remove(position);
      if (entry) await notify(entry.session_id);
    },
    removePending: async (position) => {
      const entry = await raw.get(position);
      const removed = await raw.removePending(position);
      if (removed && entry) await notify(entry.session_id);
      return removed;
    },
    removeBySession: async (sessionId) => {
      await raw.removeBySession(sessionId);
      await notify(sessionId);
    },
  };
};
