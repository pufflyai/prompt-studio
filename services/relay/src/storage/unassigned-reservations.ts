import { eq, exists, or, sql } from "drizzle-orm";
import { reservationLock, reservationPrefix } from "../assets/object-reservations";
import { assetUploads } from "../assets/schema";
import type { connectRelay } from "./database";
import { syncObjectDeletions } from "./document-schema";
import type { PayloadObjects } from "./payloads";

/** A reservation can arrive after its initiating process has exited. Only unclaimed multipart
 * uploads are collected here. Both writers hold the same lock until their claim commits. */
export const cleanupUnassignedReservations = async (
  connection: ReturnType<typeof connectRelay>,
  payloads: PayloadObjects,
  signal?: AbortSignal,
) => {
  for await (const page of payloads.multipartPages(reservationPrefix, signal)) {
    const keys = new Set(page.flatMap(({ Key }) => (Key?.startsWith(reservationPrefix) ? [Key] : [])));
    for (const key of keys) {
      await connection.run(
        (db) =>
          db.transaction(async (tx) => {
            const lock = await tx.execute<{ acquired: boolean }>(
              sql`SELECT pg_try_advisory_xact_lock(${reservationLock(key)}) AS acquired`,
            );
            if (!lock.rows[0]!.acquired) return;
            const claim = await tx.execute<{ owned: boolean }>(
              sql`SELECT ${or(
                exists(
                  tx
                    .select({ key: syncObjectDeletions.objectKey })
                    .from(syncObjectDeletions)
                    .where(eq(syncObjectDeletions.objectKey, key)),
                ),
                exists(
                  tx.select({ key: assetUploads.objectKey }).from(assetUploads).where(eq(assetUploads.objectKey, key)),
                ),
              )} AS owned`,
            );
            if (!claim.rows[0]!.owned) await payloads.discard(key, null, signal);
          }),
        signal,
      );
    }
  }
};
