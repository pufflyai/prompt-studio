import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { createDatabaseLeases } from "../database-leases";

export const createAssetDatabase = (
  databaseUrl: string,
  cancelled: (key: string) => void,
  failed: (reason: unknown) => void,
) => {
  if (!databaseUrl) throw new Error("Relay assets require a PostgreSQL URL");
  // Cancellation must not queue behind connections held by streaming uploads.
  const control = new Pool({ connectionString: databaseUrl, max: 1 });
  const writers = new Pool({ connectionString: databaseUrl });
  const leases = createDatabaseLeases(databaseUrl, [control, writers]);
  const listener = new Client({ connectionString: databaseUrl });
  let listening: Promise<void> | undefined;
  let failure: Error | undefined;
  let closing = false;
  const fail = (error: Error) => {
    if (closing) return;
    failure ??= error;
    failed(failure);
  };
  control.on("error", fail);
  writers.on("error", fail);
  listener.on("error", fail);
  listener.on("end", () => fail(new Error("Asset cancellation listener disconnected")));
  listener.on("notification", (message) => {
    if (message.channel === "relay_asset_cancel" && message.payload) cancelled(message.payload);
  });
  return {
    run: <T>(action: (db: NodePgDatabase) => Promise<T>, signal: AbortSignal) =>
      leases.run(control, (client) => action(drizzle(client)), signal),
    async ready() {
      if (failure) throw failure;
      listening ??= listener.connect().then(async () => {
        await listener.query("LISTEN relay_asset_cancel");
      });
      await listening;
      if (failure) throw failure;
    },
    async lock<T>(key: string, signal: AbortSignal, action: (database: NodePgDatabase) => Promise<T>) {
      return leases.run(
        writers,
        async (client) => {
          await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [key]);
          try {
            signal.throwIfAborted();
            return await action(drizzle(client));
          } finally {
            if (!signal.aborted) await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]);
          }
        },
        signal,
      );
    },
    async close() {
      closing = true;
      const results = await Promise.allSettled([leases.close(), listener.end()]);
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Asset database shutdown failed");
    },
  };
};
