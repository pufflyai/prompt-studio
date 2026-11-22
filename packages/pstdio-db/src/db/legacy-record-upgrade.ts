import { and, eq, gt, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId } from "pstdio-sync/records";
import { ensureOrderedOwner } from "../services/extension-storage/ordered-conversion";
import type { DbClient } from "./connection.pglite";
import { exportUnconvertedOwner } from "./legacy-owner-export";
import { owners, storage_documents, storage_ordered_owners, storage_resource_projections } from "./schemas.pg";

export interface LegacyConversionFailure {
  owner: StorageOwner;
  error: unknown;
  backupPath?: string;
}
const emptyFailedOwner = (db: DbClient, owner: StorageOwner, id: number) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM storage_current_records WHERE owner_id=${id}`);
    await tx.delete(storage_documents).where(eq(storage_documents.owner_id, id));
    await tx.delete(storage_ordered_owners).where(eq(storage_ordered_owners.owner_id, id));
    await tx.execute(
      sql`DELETE FROM storage_record_sync WHERE workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId}`,
    );
    await tx.execute(sql`DELETE FROM native_document_sources WHERE owner_id=${id}`);
    await tx.execute(sql`DELETE FROM native_document_file_projections WHERE owner_id=${id}`);
    if (owner.extensionId === coreOwnerId)
      await tx.execute(sql`DELETE FROM storage_ordered_resource_numbers WHERE workbench_id=${owner.workbenchId}`);
    const [empty] = await tx
      .update(owners)
      .set({ revision: sql`${owners.revision}+1`, live_count: 0 })
      .where(eq(owners.id, id))
      .returning({ revision: owners.revision });
    await tx.insert(storage_ordered_owners).values({ owner_id: id });
    if (owner.extensionId === coreOwnerId) {
      await tx
        .insert(storage_documents)
        .values({ owner_id: id, document_id: "records", state: new Uint8Array([0, 0]) });
      await tx.insert(storage_resource_projections).values({
        workbench_id: owner.workbenchId,
        owner_id: id,
        document_id: "records",
        revision: empty!.revision,
      });
    }
  });

/** Convert before admission; clear a failed owner only after preserving its recovery input. */
export const upgradeLegacyRecords = async (
  db: DbClient,
  database: string,
  options: {
    signal?: AbortSignal;
    failed?: (failure: LegacyConversionFailure) => void;
  } = {},
) => {
  const failed =
    options.failed ??
    ((failure: LegacyConversionFailure) =>
      console.error("Legacy storage conversion failed", {
        owner: failure.owner,
        backupPath: failure.backupPath,
        error: String(failure.error),
      }));
  await registerLegacyStreamOwners(db, options.signal);
  let after = 0;
  while (true) {
    options.signal?.throwIfAborted();
    const [row] = await db
      .select({ id: owners.id, workbenchId: owners.project_id, extensionId: owners.extension_id })
      .from(owners)
      .where(
        and(
          gt(owners.id, after),
          sql`(EXISTS (SELECT 1 FROM storage_documents d WHERE d.owner_id=${owners.id} AND d.document_id='records')
            OR EXISTS (SELECT 1 FROM storage_record_sync s WHERE s.workbench_id=${owners.project_id} AND s.extension_id=${owners.extension_id}))`,
        ),
      )
      .orderBy(owners.id)
      .limit(1);
    if (!row) return;
    const owner = { workbenchId: row.workbenchId, extensionId: row.extensionId };
    try {
      await ensureOrderedOwner(db, owner, options.signal);
    } catch (error) {
      options.signal?.throwIfAborted();
      await isolateFailedOwner(db, database, owner, row.id, error, failed);
    }
    after = row.id;
  }
};

const isolateFailedOwner = async (
  db: DbClient,
  database: string,
  owner: StorageOwner,
  id: number,
  error: unknown,
  failed: (failure: LegacyConversionFailure) => void,
) => {
  let backupPath: string | undefined;
  try {
    backupPath = await exportUnconvertedOwner(db, database, owner, id);
    await emptyFailedOwner(db, owner, id);
  } catch (preservationError) {
    failed({
      owner,
      error: new AggregateError(
        [error, preservationError],
        "Legacy records retained because isolation did not complete",
      ),
      backupPath,
    });
    return;
  }
  failed({ owner, error, backupPath });
};

const registerLegacyStreamOwners = async (db: DbClient, signal?: AbortSignal) => {
  let after: { project: string; extension: string } | undefined;
  while (true) {
    signal?.throwIfAborted();
    const boundary = after ? sql`AND (s.workbench_id,s.extension_id)>(${after.project},${after.extension})` : sql``;
    const { rows } = await db.execute<{ project: string; extension: string }>(sql`
      SELECT s.workbench_id AS project,s.extension_id AS extension FROM storage_record_sync s
      WHERE NOT EXISTS (SELECT 1 FROM owners o WHERE o.project_id=s.workbench_id AND o.extension_id=s.extension_id)
        ${boundary} ORDER BY s.workbench_id,s.extension_id LIMIT 200`);
    if (!rows.length) return;
    await db
      .insert(owners)
      .values(rows.map((row) => ({ project_id: row.project, extension_id: row.extension })))
      .onConflictDoNothing();
    after = rows.at(-1)!;
  }
};
