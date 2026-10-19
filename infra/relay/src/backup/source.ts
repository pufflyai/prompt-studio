import { eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { contentSnapshot } from "pstdio-sync-contracts";
import { createDatabaseLeases } from "../database-leases";
import { captureSnapshot } from "../storage/captures";
import * as schema from "../storage/schema";
import { readSnapshot } from "../storage/snapshots";

export const createBackupSource = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const leases = createDatabaseLeases(databaseUrl, [pool]);
  const shutdown = new AbortController();
  pool.on("error", (error) => console.error("Backup database idle connection failed", error.message));
  return {
    async run<T>(
      action: (
        source: {
          capture(id: string): Promise<
            {
              capture: Awaited<ReturnType<typeof captureSnapshot>>;
              coverage: (typeof schema.relayAcknowledgements.$inferSelect)["ack"][];
            }[]
          >;
          release(ids: string[]): Promise<void>;
        },
        signal: AbortSignal,
      ) => Promise<T>,
      requestSignal: AbortSignal,
    ) {
      const controller = new AbortController();
      const signal = AbortSignal.any([shutdown.signal, controller.signal, requestSignal]);
      return leases.run(
        pool,
        async (client) => {
          const failed = (error?: Error) => controller.abort(error ?? new Error("Backup database lease disconnected"));
          client.on("error", failed);
          client.on("end", failed);
          let locked = false;
          try {
            const acquired = await client.query<{ locked: boolean }>(
              "SELECT pg_try_advisory_lock(hashtextextended('pstdio-relay-backups',0)) AS locked",
            );
            if (!acquired.rows[0]?.locked) return null;
            locked = true;
            const db = drizzle(client, { schema });
            const boundary = async <U>(body: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<U>) =>
              db.transaction(async (tx) => {
                // Every publisher/restore/deleter locks relay_scopes before changing its references.
                await tx.execute(sql.raw("LOCK TABLE relay_scopes IN EXCLUSIVE MODE"));
                return body(tx);
              });
            // A session lease proves no old backup process still owns these pins.
            await boundary(async (tx) => {
              await tx.delete(schema.relayCaptures).where(like(schema.relayCaptures.id, "backup:%"));
            });
            return await action(
              {
                capture: (id) =>
                  boundary(async (tx) => {
                    const scopes = await tx.select().from(schema.relayScopes);
                    const captured = [];
                    for (const owner of scopes) {
                      const snapshot = contentSnapshot(await readSnapshot(tx, owner.id));
                      const capture = await captureSnapshot(tx, owner.id, snapshot, `backup:${id}:${owner.id}`);
                      const rows = await tx
                        .select()
                        .from(schema.relayAcknowledgements)
                        .where(eq(schema.relayAcknowledgements.ownerId, owner.id));
                      captured.push({ capture, coverage: rows.map((row) => row.ack) });
                    }
                    return captured;
                  }),
                release: (ids) =>
                  boundary(async (tx) => {
                    if (ids.length) await tx.delete(schema.relayCaptures).where(inArray(schema.relayCaptures.id, ids));
                  }),
              },
              signal,
            );
          } finally {
            try {
              if (locked && !signal.aborted)
                await client.query("SELECT pg_advisory_unlock(hashtextextended('pstdio-relay-backups',0))");
            } finally {
              client.off("error", failed);
              client.off("end", failed);
            }
          }
        },
        signal,
      );
    },
    async close() {
      shutdown.abort(new Error("Backup source closed"));
      await leases.close();
    },
  };
};
