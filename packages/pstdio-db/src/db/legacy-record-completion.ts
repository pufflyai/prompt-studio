import { sql } from "drizzle-orm";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { DbClient } from "./connection.pglite";
import { storageOwnerAdmissionPending } from "./storage-admission";

/** Completed inputs can leave even when another owner still needs its recovery input. */
export const finishConvertedLegacyOwners = async (db: DbClient, signal?: AbortSignal) => {
  let after = 0;
  while (true) {
    signal?.throwIfAborted();
    const { rows } = await db.execute<{ id: number; workbenchId: string; extensionId: string }>(sql`
      SELECT o.id,o.project_id AS "workbenchId",o.extension_id AS "extensionId" FROM owners o
      JOIN storage_ordered_owners p ON p.workbench_id=o.project_id AND p.extension_id=o.extension_id
      WHERE o.id>${after} AND NOT EXISTS (SELECT 1 FROM documents c
        WHERE c.owner_id=o.id AND c.key='["ordered-conversion"]') ORDER BY o.id LIMIT 200`);
    if (!rows.length) return;
    for (const owner of rows) {
      signal?.throwIfAborted();
      if (storageOwnerAdmissionPending(db, owner)) continue;
      await db.transaction(async (tx) => {
        // Keep the original marker until retirement in case startup stops before the rename.
        // Its canonical address prevents a second conversion after a healthy root is renamed.
        const canonical = canonicalExtensionId(owner.extensionId);
        if (canonical !== owner.extensionId)
          await tx.execute(sql`INSERT INTO storage_ordered_owners(workbench_id,extension_id)
            SELECT ${owner.workbenchId},${canonical} WHERE
              NOT EXISTS (SELECT 1 FROM owners t WHERE t.project_id=${owner.workbenchId} AND t.extension_id=${canonical})
              OR EXISTS (SELECT 1 FROM owners t JOIN storage_ordered_owners p
                ON p.workbench_id=t.project_id AND p.extension_id=t.extension_id
                WHERE t.project_id=${owner.workbenchId} AND t.extension_id=${canonical}
                  AND NOT EXISTS (SELECT 1 FROM documents c WHERE c.owner_id=t.id
                    AND c.key='["ordered-conversion"]')) ON CONFLICT DO NOTHING`);
      });
      while (true) {
        signal?.throwIfAborted();
        const { rows: removed } = await db.execute(sql`WITH page AS (
          SELECT sequence FROM storage_record_outbox
          WHERE workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId}
          ORDER BY sequence LIMIT 200
        ) DELETE FROM storage_record_outbox o USING page p WHERE o.sequence=p.sequence RETURNING o.sequence`);
        if (!removed.length) break;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      // The released foreign key cascades frames; remove its parent only after the bounded drain.
      await db.execute(sql`DELETE FROM storage_record_sync
        WHERE workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId}`);
    }
    after = rows.at(-1)!.id;
  }
};
