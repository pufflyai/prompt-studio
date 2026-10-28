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
  let listener: { client: Client; ready: Promise<void> } | undefined;
  const retiring = new Set<Promise<void>>();
  let closing = false;
  const retire = (client: Client) => {
    // The failed connection is already unusable. Its close must drain without blocking a new listener.
    const ended = client.end().catch(() => {});
    retiring.add(ended);
    void ended.then(() => retiring.delete(ended));
  };
  const fail = (error: Error, expected = listener) => {
    if (closing || (expected && listener !== expected)) return;
    const previous = listener;
    listener = undefined;
    failed(error);
    if (previous) retire(previous.client);
  };
  control.on("error", (error) => fail(error));
  writers.on("error", (error) => fail(error));
  const subscribe = () => {
    const client = new Client({ connectionString: databaseUrl });
    const next = { client, ready: Promise.resolve() };
    listener = next;
    client.on("error", (error) => fail(error, next));
    client.on("end", () => fail(new Error("Asset cancellation listener disconnected"), next));
    client.on("notification", (message) => {
      if (listener === next && message.channel === "relay_asset_cancel" && message.payload) cancelled(message.payload);
    });
    next.ready = client
      .connect()
      .then(async () => {
        await client.query("LISTEN relay_asset_cancel");
      })
      .catch((error) => {
        fail(error, next);
        throw error;
      });
    return next;
  };
  return {
    run: <T>(action: (db: NodePgDatabase) => Promise<T>, signal: AbortSignal) =>
      leases.run(control, (client) => action(drizzle(client)), signal),
    async ready() {
      if (closing) throw new Error("Asset database is closed");
      const current = listener ?? subscribe();
      await current.ready;
      if (listener !== current) throw new Error("Asset cancellation listener disconnected");
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
      const current = listener;
      listener = undefined;
      const results = await Promise.allSettled([leases.close(), current?.client.end(), ...retiring]);
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Asset database shutdown failed");
    },
  };
};
