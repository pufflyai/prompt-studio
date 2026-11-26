import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { createOrderedJournal } from "../services/extension-storage/ordered-journal";
import { projectWithOrderedNumberPolicy } from "../services/extension-storage/ordered-number-overlay";
import { projectPendingOrderedRecords } from "../services/extension-storage/ordered-rebase";
import { orderedRecordMetadata } from "../services/extension-storage/ordered-record-row";
import type { OrderedTransaction } from "../services/extension-storage/ordered-sql";
import type { DbClient } from "./connection.pglite";
import { releasedJournalDocument } from "./local-upgrade-documents";
import { resetReleasedRevisions } from "./local-upgrade-revisions";
import { stageLocalTransfers } from "./local-upgrade-transfers";

const emptyMetadata = {
  order: [],
  stamps: [],
  body: { keys: ["value", "asset", "shared", "nativeSources"], extra: {}, nativeLifetimes: {} },
};

/** Freeze the locally visible edit before retiring its old delivery queue and confirmed base. */
async function settleVisibleEdits(tx: OrderedTransaction) {
  const { rows: groups } = await tx.execute<{
    id: number;
    project_id: string;
    extension_id: string;
  }>(sql`SELECT id,project_id,extension_id FROM owners
    WHERE EXISTS (SELECT 1 FROM operations WHERE owner_id=owners.id AND envelope IS NOT NULL AND settled_epoch IS NULL)`);
  for (const group of groups) {
    const owner = { workbenchId: group.project_id, extensionId: group.extension_id };
    const journal = createOrderedJournal(tx, owner);
    const { rows: ids } = await tx.execute<{ id: string }>(sql`SELECT DISTINCT r.record_id AS id FROM operations op
      CROSS JOIN LATERAL unnest(op.touches) t(id) JOIN records r ON r.record_id=t.id AND r.owner_id=${group.id}
      WHERE op.owner_id=${group.id} AND op.envelope IS NOT NULL AND op.settled_epoch IS NULL
        AND r.revision IS NOT NULL AND NOT r.deleted`);
    for (let offset = 0; offset < ids.length; offset += 100) {
      const keys = ids.slice(offset, offset + 100).map((r) => r.id);
      const { views } = await projectWithOrderedNumberPolicy(journal, tx, owner, keys, (changed, blocked) =>
        projectPendingOrderedRecords(journal, tx, owner, changed, blocked, true),
      );
      const data = keys.flatMap((id) => {
        const visible = views.get(id);
        return visible && !visible.deleted ? [{ id, meta: orderedRecordMetadata({ ...visible, stamps: {} }) }] : [];
      });
      if (data.length)
        await tx.execute(sql`UPDATE records r SET meta=v.meta,base=NULL FROM
        jsonb_to_recordset(${JSON.stringify(data)}::jsonb) v(id text,meta jsonb)
        WHERE r.owner_id=${group.id} AND r.record_id=v.id AND NOT r.deleted`);
    }
  }
}

/** The 0.48 cutoff affects only old installations that crossed the schema change.
 * Saved recovery points and file contents have their own storage outside the operation journal. */
export async function finishLocalUpgrade(db: DbClient, engine: PGlite, storageRoot: string) {
  const {
    rows: [state],
  } = await engine.query<{ pending: boolean }>(
    "SELECT to_regnamespace('pstdio_local_upgrade_049') IS NOT NULL AS pending",
  );
  if (!state?.pending) return;
  await stageLocalTransfers(engine, storageRoot);
  await db.transaction(async (tx) => {
    await settleVisibleEdits(tx);
    await resetReleasedRevisions(tx);
    await tx.execute(sql`DELETE FROM records WHERE deleted`);
    await tx.execute(sql`TRUNCATE operations`);
    await tx.execute(sql`DELETE FROM documents WHERE ${sql.raw(releasedJournalDocument("key"))}`);
    // Keep the order visible in a log (accepted entries, then local appends) when retiring delivery positions.
    await tx.execute(sql`WITH ordered AS (
      SELECT l.stream_id,l.entry_id,row_number() OVER(PARTITION BY l.stream_id ORDER BY
        l.relay_sequence NULLS LAST,l.relay_index NULLS LAST,l.local_sequence,l.entry_id) AS position
      FROM log_entries l WHERE EXISTS (SELECT 1 FROM log_entries a WHERE a.stream_id=l.stream_id AND a.relay_sequence IS NOT NULL)
    ) UPDATE log_entries l SET local_sequence=o.position,local=true,relay_sequence=NULL,relay_index=NULL,envelope=NULL
      FROM ordered o WHERE (l.stream_id,l.entry_id)=(o.stream_id,o.entry_id)`);
    await tx.execute(sql`UPDATE log_entries SET envelope=NULL,local=true WHERE envelope IS NOT NULL OR NOT local`);
    await tx.execute(sql`UPDATE log_streams SET head=0,complete_through=0,state_id=NULL,through=0
      WHERE head<>0 OR complete_through<>0 OR state_id IS NOT NULL OR through<>0`);
    await tx.execute(sql`TRUNCATE history_sources`);
    await tx.execute(sql`UPDATE history_rows SET pending_id=NULL WHERE pending_id IS NOT NULL`);
    await tx.execute(
      sql`UPDATE owners SET epoch=NULL, joined=false,"after"=0,state_id=NULL,through=0,pending_bytes=0,state_bytes=0,skipped=false,receipt_root=NULL,history_cursor=NULL`,
    );
    await tx.execute(sql`DELETE FROM asset_transfers t WHERE cancelled_at IS NOT NULL OR NOT EXISTS(
        SELECT 1 FROM pg_temp.local_upgrade_transfers s JOIN owners o USING(project_id,extension_id)
        WHERE o.id=t.owner_id AND s.operation_id=t.operation_id)`);
    await tx.execute(sql`UPDATE records SET base=NULL,meta=COALESCE(meta,${JSON.stringify(emptyMetadata)}::jsonb)
      WHERE base IS NOT NULL OR meta IS NULL`);
    await tx.execute(sql`UPDATE records SET meta=jsonb_set(meta,'{stamps}','[]') WHERE meta->'stamps' <> '[]'::jsonb`);
    await tx.execute(sql`DROP SCHEMA pstdio_local_upgrade_049`);
  });
}
