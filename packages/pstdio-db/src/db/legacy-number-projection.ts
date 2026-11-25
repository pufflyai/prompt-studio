import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { createOrderedJournal } from "../services/extension-storage/ordered-journal";
import { markOrderedNumberProjectionCurrent } from "../services/extension-storage/ordered-number-projection";
import { rebaseOrderedProjection } from "../services/extension-storage/ordered-rebase";
import { storageOwnerKey } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { records as current, resource_numbers as numbers } from "./schemas.pg";

/** Rebuild the optimistic facets from current records, never from a stale released SQL projection. */
export const rebuildLegacyNumberProjection = async (db: DbClient, owner: StorageOwner, signal?: AbortSignal) => {
  const ownerId = storageOwnerKey(owner);
  while (true) {
    signal?.throwIfAborted();
    const { rows } = await db.execute<{ id: string }>(sql`SELECT DISTINCT resource_id AS id FROM resource_numbers n
      WHERE project_id=${owner.workbenchId} AND (current OR alias)
        AND NOT EXISTS(SELECT 1 FROM records r WHERE r.owner_id=${ownerId} AND r.record_id=n.resource_id)
      ORDER BY resource_id LIMIT 100`);
    if (!rows.length) break;
    await db.transaction(async (tx) => {
      const scope = and(
        eq(numbers.project_id, owner.workbenchId),
        inArray(
          numbers.resource_id,
          rows.map((row) => row.id),
        ),
      );
      await tx.update(numbers).set({ current: false, alias: false }).where(scope);
      await tx.delete(numbers).where(and(scope, eq(numbers.canonical, false)));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  let after: string | undefined;
  while (true) {
    signal?.throwIfAborted();
    const ids = await db
      .select({ id: current.record_id })
      .from(current)
      .where(and(eq(current.owner_id, ownerId), after === undefined ? undefined : gt(current.record_id, after)))
      .orderBy(current.record_id)
      .limit(100);
    if (!ids.length) break;
    await db.transaction(async (tx) => {
      await rebaseOrderedProjection(
        createOrderedJournal(tx, owner),
        tx,
        owner,
        ids.map((row) => row.id),
      );
    });
    after = ids.at(-1)!.id;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await db.transaction((tx) => markOrderedNumberProjectionCurrent(tx, owner));
};
