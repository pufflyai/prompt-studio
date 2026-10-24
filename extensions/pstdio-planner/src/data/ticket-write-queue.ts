// Runtime reloads import new source snapshots while old handlers may still be running, so every
// snapshot shares one queue per ticket. One process runs Planner commands, as in write-guard.ts.
const queuesKey = Symbol.for("pstdio.pstdio-planner.ticket-write-queues");
const runtime = globalThis as typeof globalThis & { [queuesKey]?: Map<string, Promise<unknown>> };
runtime[queuesKey] ??= new Map();
const queues = runtime[queuesKey];

/** Runs writes to one ticket one after another, in call order. A failed write does not stop the next. */
export const queueTicketWrite = <T>(ticketId: string, write: () => Promise<T>) => {
  const result = (queues.get(ticketId) ?? Promise.resolve()).then(write);
  const tail = result.then(
    () => {},
    () => {},
  );
  queues.set(ticketId, tail);
  void tail.then(() => {
    if (queues.get(ticketId) === tail) queues.delete(ticketId);
  });
  return result;
};
