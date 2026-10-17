import { sql } from "drizzle-orm";
import { Client } from "pg";
import type { RelayTransaction } from "./database";

const channel = "relay_scope_changed";
export const notifyScope = (transaction: RelayTransaction, key: string) =>
  transaction.execute(sql`SELECT pg_notify(${channel}, ${key})`);

export const createRelayChanges = (databaseUrl: string) => {
  const listener = new Client({ connectionString: databaseUrl, application_name: "pstdio-relay-changes" });
  const subscriptions = new Map<string, Set<{ changed: () => void; failed: () => void }>>();
  let listening: Promise<void> | undefined;
  let failed = false;
  const fail = () => {
    failed = true;
    for (const entries of subscriptions.values()) for (const entry of [...entries]) entry.failed();
    subscriptions.clear();
  };
  listener.on("error", fail);
  listener.on("end", fail);
  listener.on("notification", (message) => {
    if (message.channel !== channel || !message.payload) return;
    for (const entry of subscriptions.get(message.payload) ?? []) entry.changed();
  });
  return {
    async watch(key: string, changed: () => void, onFailure: () => void) {
      if (failed) throw new Error("Relay change listener unavailable");
      listening ??= listener
        .connect()
        .then(async () => {
          // Autocommit makes LISTEN effective before any subscriber's initial state read.
          await listener.query("LISTEN relay_scope_changed");
        })
        .catch((error: unknown) => {
          fail();
          throw error;
        });
      await listening;
      if (failed) throw new Error("Relay change listener unavailable");
      const entries = subscriptions.get(key) ?? new Set();
      const entry = { changed, failed: onFailure };
      entries.add(entry);
      subscriptions.set(key, entries);
      return () => {
        entries.delete(entry);
        if (!entries.size) subscriptions.delete(key);
      };
    },
    async close() {
      fail();
      await listener.end();
    },
  };
};
