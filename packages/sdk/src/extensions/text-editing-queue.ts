import type { createTextReplica } from "pstdio-sync/text";
import type { GuestHost } from "./guest-host";
import { decodeTextSnapshot, encodeTextBytes } from "./text-editing-codec";
/** Each fence covers the authored prefix captured by its caller, including submitted drafts. */
export const createTextEditingFences = (initialRevision: number) => {
  let authored = 0;
  let acknowledged = 0;
  let revision = initialRevision;
  const completed = new Map<number, number>();
  const waiters = new Set<{ prefix: number; resolve: (revision: number) => void; reject: (error: unknown) => void }>();
  const complete = (prefix: number, durableRevision: number) => {
    completed.set(prefix, durableRevision);
    while (completed.has(acknowledged + 1)) {
      acknowledged++;
      revision = Math.max(revision, completed.get(acknowledged)!);
      completed.delete(acknowledged);
    }
    for (const waiter of waiters)
      if (waiter.prefix <= acknowledged) {
        waiters.delete(waiter);
        waiter.resolve(revision);
      }
  };
  return {
    author: () => ++authored,
    prefix: () => authored,
    settled: (prefix: number) => prefix <= acknowledged,
    pending: () => acknowledged < authored,
    through(prefix: number) {
      if (prefix <= acknowledged) return Promise.resolve(revision);
      const result = Promise.withResolvers<number>();
      waiters.add({ prefix, ...result });
      return result.promise;
    },
    complete,
    cancel: (prefix: number) => complete(prefix, revision),
    fail(error: unknown) {
      for (const waiter of waiters) waiter.reject(error);
      waiters.clear();
    },
  };
};

export const submitTextBatch = async (input: {
  host: GuestHost;
  handle: string;
  replica: ReturnType<typeof createTextReplica>;
  fences: ReturnType<typeof createTextEditingFences>;
  tickets: number[];
  batch: { sequence: number; count: number; update: Uint8Array };
}) => {
  const { host, handle, replica, fences, tickets, batch } = input;
  const snapshot = await host.call("editing.text", {
    operation: "submit",
    handle,
    sequence: batch.sequence,
    update: encodeTextBytes(batch.update),
  });
  replica.acknowledge(batch.count, decodeTextSnapshot(snapshot));
  for (const ticket of tickets.splice(0, batch.count)) fences.complete(ticket, snapshot.revision);
  return snapshot;
};
