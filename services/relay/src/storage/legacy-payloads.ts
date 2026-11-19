import { eq, sql } from "drizzle-orm";
import type { connectRelay } from "./database";
import { payloadMaintenance } from "./document-schema";
import type { PayloadObjects } from "./payloads";

const sweep = "legacy-documents";

/** Old payload keys hashed the project and document together. A key without any row cannot be
 * attributed to one project. Inspect the old namespace once and reclaim only unreferenced keys.
 * All upgraded writers use a different namespace and register before sending bytes. */
export const sweepUntrackedLegacyPayloads = (
  connection: ReturnType<typeof connectRelay>,
  payloads: PayloadObjects,
  signal: AbortSignal,
) =>
  connection.run(
    (db) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('relay-sweep-legacy-documents', 0))`);
        const [complete] = await tx.select().from(payloadMaintenance).where(eq(payloadMaintenance.key, sweep));
        if (complete) return;
        for await (const objectKeys of payloads.keys("documents/", signal)) {
          if (!objectKeys.length) continue;
          const rows = await tx.execute<{ objectKey: string }>(sql`
        SELECT source."objectKey" FROM unnest(${sql.param(objectKeys)}::text[]) AS source("objectKey")
        WHERE NOT EXISTS (SELECT 1 FROM relay_sync_updates u WHERE u."objectKey" = source."objectKey")
          AND NOT EXISTS (SELECT 1 FROM relay_sync_states s WHERE s."objectKey" = source."objectKey")`);
          for (const { objectKey } of rows.rows) {
            await payloads.remove(objectKey, signal);
            await payloads.verifyRemoved(objectKey, signal);
          }
        }
        await tx.insert(payloadMaintenance).values({ key: sweep, completedAt: sql`clock_timestamp()` });
      }),
    signal,
  );
