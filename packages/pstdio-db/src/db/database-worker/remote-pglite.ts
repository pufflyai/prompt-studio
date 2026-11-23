import { type DatabaseWorkerMessage, type DatabaseWorkerRequest, deserializeDatabaseError } from "./protocol";

type Request = DatabaseWorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;
type QueryOptions = { rowMode?: "array" | "object"; parsers?: Record<number, unknown> };

/**
 * The API thread's view of the database worker. It offers the part of PGlite that Drizzle and the
 * maintenance jobs use: query, exec and transaction. Parsers cannot cross threads; Drizzle's leave
 * date and interval types unparsed, so only their type ids are sent and the worker does the same.
 */
export const createRemotePglite = (worker: Worker) => {
  const pending = new Map<number, ReturnType<typeof Promise.withResolvers<unknown>>>();
  let next = 0;
  let failure: Error | undefined;

  const call = (request: Request): Promise<unknown> => {
    if (failure) return Promise.reject(failure);
    const id = next++;
    try {
      worker.postMessage({ ...request, id } as DatabaseWorkerRequest);
    } catch (error) {
      // A value that cannot be cloned fails only its own call; nothing is left pending.
      return Promise.reject(error);
    }
    const reply = Promise.withResolvers<unknown>();
    pending.set(id, reply);
    return reply.promise;
  };

  const receive = (message: DatabaseWorkerMessage) => {
    if (message.type !== "reply") return false;
    const reply = pending.get(message.id);
    pending.delete(message.id);
    if (message.ok) reply?.resolve(message.value);
    else reply?.reject(deserializeDatabaseError(message.error));
    return true;
  };

  /** Settles every waiting caller once; later calls fail at once. */
  const fail = (error: Error) => {
    failure ??= error;
    for (const reply of pending.values()) reply.reject(failure);
    pending.clear();
  };

  const remoteOptions = (options?: QueryOptions) => ({
    ...(options?.rowMode ? { rowMode: options.rowMode } : {}),
    ...(options?.parsers ? { rawTypes: Object.keys(options.parsers).map(Number) } : {}),
  });

  const executor = (txId?: number) => ({
    query: <T>(sql: string, params?: unknown[], options?: QueryOptions) =>
      call({ type: "query", sql, params, options: remoteOptions(options), txId }) as Promise<T>,
    exec: <T>(sql: string) => call({ type: "exec", sql, txId }) as Promise<T>,
  });

  const pglite = {
    ...executor(),
    waitReady: Promise.resolve(),
    async transaction<T>(run: (tx: ReturnType<typeof executor>) => Promise<T>) {
      const txId = (await call({ type: "begin" })) as number;
      let result: T;
      try {
        result = await run(executor(txId));
      } catch (error) {
        await call({ type: "end", txId, commit: false }).catch(() => {});
        throw error;
      }
      await call({ type: "end", txId, commit: true });
      return result;
    },
  };

  return { pglite, call, receive, fail, busy: () => pending.size > 0 };
};
