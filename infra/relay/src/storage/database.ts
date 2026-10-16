import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";
import * as schema from "./schema";

export const connectRelay = (databaseUrl: string) => {
  if (!databaseUrl) throw new Error("Relay storage requires a PostgreSQL URL");
  const client = new Pool({ connectionString: databaseUrl });
  // Cancellation cannot queue behind the content queries it must interrupt.
  const control = new Pool({ connectionString: databaseUrl, max: 1 });
  const cancellations = new Set<Promise<void>>();
  const shutdown = new AbortController();
  let closing: Promise<void> | undefined;
  return {
    db: drizzle(client, { schema }),
    async run<T>(action: (database: RelayDatabase) => Promise<T>, requestSignal?: AbortSignal) {
      const signal = requestSignal ? AbortSignal.any([shutdown.signal, requestSignal]) : shutdown.signal;
      signal.throwIfAborted();
      let owned: PoolClient | undefined;
      let released = false;
      let backendId: number | undefined;
      let cancelling: Promise<void> | undefined;
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
      const acquiring = client.connect().then((connection) => {
        owned = connection;
        if (signal.aborted) {
          release(true);
          signal.throwIfAborted();
        }
        return connection;
      });
      try {
        const connection = await Promise.race([acquiring, interrupted.promise]);
        backendId = (await connection.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]!.pid;
        signal.throwIfAborted();
        return await action(drizzle(connection, { schema }));
      } finally {
        signal.removeEventListener("abort", abort);
        try {
          await cancelling;
        } finally {
          release(signal.aborted);
        }
      }
    },
    close() {
      closing ??= (async () => {
        shutdown.abort(new Error("Relay storage is closed"));
        const results = await Promise.allSettled([...cancellations, client.end()]);
        await control.end();
        if (results.some((result) => result.status === "rejected")) throw new Error("Relay storage shutdown failed");
      })();
      return closing;
    },
  };
};

export type RelayDatabase = NodePgDatabase<typeof schema>;
export type RelayTransaction = Parameters<Parameters<RelayDatabase["transaction"]>[0]>[0];

export const migrateRelayStorage = async (databaseUrl: string, migrationsFolder: string) => {
  const connection = connectRelay(databaseUrl);
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
};
