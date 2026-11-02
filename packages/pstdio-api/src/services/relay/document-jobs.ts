import type { createDocumentSync } from "pstdio-sync/relay";

type Sync = ReturnType<typeof createDocumentSync>;
export class RelayDocumentRetiredError extends Error {}
interface Entry {
  initialized: Promise<Sync>;
  dirty: boolean;
  running?: Promise<true>;
}

/** Discovery and exact hints share one worker for each mutable replica. */
export const createRelayDocumentJobs = (input: {
  signal: AbortSignal;
  create: (name: string) => Promise<{ documentId: string; sync: Sync }>;
}) => {
  const entries = new Map<string, Entry>();
  const names = new Map<string, string>();
  let closed = false;
  const register = (name: string) => {
    let entry = entries.get(name);
    if (entry) return entry;
    entry = {
      dirty: false,
      initialized: Promise.resolve().then(async () => {
        const { documentId, sync } = await input.create(name);
        if (!closed) names.set(documentId, name);
        return sync;
      }),
    };
    entries.set(name, entry);
    return entry;
  };
  const statuses = (names = [...entries.keys()]) =>
    Promise.all(
      names.map(async (name) => {
        const entry = entries.get(name);
        if (!entry) return;
        const sync = await entry.initialized;
        const status = await sync.status();
        return { ...status, pending: status.pending || entry.dirty || !!entry.running };
      }),
    );
  return {
    statuses,
    names: () => [...entries.keys()],
    nameFor: (documentId: string) => names.get(documentId),
    has: (name: string) => entries.has(name),
    synchronize(name: string) {
      if (closed) return Promise.reject(new Error("Document synchronization is closed"));
      const entry = register(name);
      entry.dirty = true;
      if (entry.running) return entry.running;
      const work = Promise.resolve().then(async () => {
        try {
          const sync = await entry.initialized;
          while (entry.dirty && !input.signal.aborted) {
            entry.dirty = false;
            await sync.synchronize();
          }
          input.signal.throwIfAborted();
          return true as const;
        } catch (error) {
          if (error === input.signal.reason && error instanceof RelayDocumentRetiredError) return true as const;
          entry.dirty = true;
          throw error;
        } finally {
          entry.running = undefined;
        }
      });
      entry.running = work;
      return work;
    },
    async status() {
      const current = await statuses();
      return {
        downloaded: current.length > 0 && current.every((status) => status?.downloaded),
        pending: current.some((status) => status?.pending),
        needsAttention: current.some((status) => status?.needsAttention),
      };
    },
    async close() {
      closed = true;
      names.clear();
      await Promise.allSettled([...entries.values()].map((entry) => entry.running));
      await Promise.all(
        [...entries.values()].map(async (entry) => {
          const sync = await entry.initialized.catch(() => undefined);
          sync?.close();
        }),
      );
      entries.clear();
    },
  };
};
