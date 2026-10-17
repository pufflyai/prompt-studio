import { Pool, type PoolClient } from "pg";

export const createDatabaseLeases = (databaseUrl: string, pools: Pool[]) => {
  // Interruption must not queue behind the queries it needs to cancel.
  const control = new Pool({ connectionString: databaseUrl, max: 1 });
  const cancellations = new Set<Promise<void>>();
  const shutdown = new AbortController();
  let closing: Promise<void> | undefined;
  return {
    async run<T>(pool: Pool, action: (client: PoolClient) => Promise<T>, requestSignal?: AbortSignal) {
      const signal = requestSignal ? AbortSignal.any([shutdown.signal, requestSignal]) : shutdown.signal;
      signal.throwIfAborted();
      let owned: PoolClient | undefined;
      let released = false;
      let backendId: number | undefined;
      let cancelling: Promise<void> | undefined;
      let completed = false;
      const release = (destroy = false) => {
        if (!owned || released) return;
        released = true;
        owned.release(destroy);
      };
      const interrupted = Promise.withResolvers<never>();
      const abort = () => {
        if (backendId === undefined) release(true);
        else {
          const cancellation = control
            .query("SELECT pg_cancel_backend($1)", [backendId])
            .then(() => {})
            .finally(() => release(true));
          cancelling = cancellation;
          cancellations.add(cancellation);
          void cancellation.then(
            () => cancellations.delete(cancellation),
            () => cancellations.delete(cancellation),
          );
        }
        interrupted.reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      const acquiring = pool.connect().then((client) => {
        owned = client;
        if (signal.aborted) {
          release(true);
          signal.throwIfAborted();
        }
        return client;
      });
      try {
        const client = await Promise.race([acquiring, interrupted.promise]);
        backendId = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]!.pid;
        signal.throwIfAborted();
        const result = await action(client);
        completed = true;
        return result;
      } finally {
        signal.removeEventListener("abort", abort);
        try {
          await cancelling;
        } finally {
          release(signal.aborted || !completed);
        }
      }
    },
    close() {
      closing ??= (async () => {
        shutdown.abort(new Error("Relay database is closed"));
        const results = await Promise.allSettled([...cancellations, ...pools.map((pool) => pool.end())]);
        await control.end();
        if (results.some((result) => result.status === "rejected")) throw new Error("Relay database shutdown failed");
      })();
      return closing;
    },
  };
};
