import { and, eq, gt, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId } from "pstdio-sync/records";
import { ensureFileDocument } from "../services/extension-storage/document-file-persistence";
import { documentFilesFor } from "../services/extension-storage/document-files";
import type { DbClient } from "./connection.pglite";
import { convertLegacyNumbers } from "./legacy-number-conversion";
import { prepareLegacyNumberInput } from "./legacy-number-input";
import { exportUnconvertedOwner } from "./legacy-owner-export";
import { finishConvertedLegacyOwners } from "./legacy-record-completion";
import { convertLegacyOwner } from "./legacy-record-conversion";
import { storage_ordered_owners } from "./legacy-records-schema";
import { documents as storage_documents } from "./schemas/documents";
import { owners } from "./schemas.pg";
import { retainUnadmittedOwner, unadmittedStorageOwners } from "./storage-admission";

export interface LegacyConversionFailure {
  owner: StorageOwner;
  error: unknown;
  backupPath?: string;
}
const emptyFailedOwner = (db: DbClient, owner: StorageOwner, id: number, legacy: boolean) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM storage_current_records WHERE owner_id=${id}`);
    await tx.delete(storage_documents).where(eq(storage_documents.owner_id, id));
    await tx.execute(sql`DELETE FROM storage_ordered_records WHERE owner_id=${id}`);
    await tx.execute(sql`DELETE FROM operations WHERE owner_id=${id}`);
    if (legacy) {
      await tx
        .delete(storage_ordered_owners)
        .where(
          and(
            eq(storage_ordered_owners.workbench_id, owner.workbenchId),
            eq(storage_ordered_owners.extension_id, owner.extensionId),
          ),
        );
      await tx.execute(
        sql`DELETE FROM storage_record_sync WHERE workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId}`,
      );
    }
    await tx.execute(sql`DELETE FROM file_projections WHERE owner_id=${id}`);
    if (owner.extensionId === coreOwnerId) {
      await tx.execute(sql`DELETE FROM resource_numbers WHERE project_id=${owner.workbenchId}`);
    }
    const [empty] = await tx
      .update(owners)
      .set({
        revision: sql`${owners.revision}+1`,
        live_count: 0,
        epoch: null,
        joined: false,
        after: 0,
        state_id: null,
        through: 0,
        pending_bytes: 0,
        state_bytes: 0,
        skipped: false,
        receipt_root: null,
      })
      .where(eq(owners.id, id))
      .returning({ revision: owners.revision });
    if (legacy)
      await tx
        .insert(storage_ordered_owners)
        .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId });
    if (owner.extensionId === coreOwnerId) {
      await ensureFileDocument(tx, documentFilesFor(tx), { owner, key: "records", kind: "local" });
      await tx.update(owners).set({ numbers_revision: empty!.revision }).where(eq(owners.id, id));
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
  const [{ present }] = (
    await db.execute<{ present: boolean }>(sql`
    SELECT to_regclass('public.storage_record_sync') IS NOT NULL AS present`)
  ).rows;
  if (present) await registerLegacyStreamOwners(db, options.signal);
  // The released join remains a Cloud-membership fact until ordered admission
  // supplies a remote epoch. Never revive a lost cursor on an admitted stream.
  if (present)
    await db.execute(sql`UPDATE owners o SET joined=true FROM storage_record_sync s
    WHERE o.project_id=s.workbench_id AND o.extension_id=s.extension_id AND s.joined
      AND (o.epoch IS NULL OR o.epoch='' OR o.epoch LIKE 'local:%') AND NOT o.joined`);
  let preserved = true;
  let after = 0;
  while (true) {
    options.signal?.throwIfAborted();
    const [row] = await db
      .select({ id: owners.id, workbenchId: owners.project_id, extensionId: owners.extension_id })
      .from(owners)
      .where(
        and(
          gt(owners.id, after),
          sql`((owners.extension_id='pstdio' AND EXISTS (SELECT 1 FROM documents n
            WHERE n.owner_id=owners.id AND n.key='resource-identities')) OR ${
              present
                ? sql`
            (EXISTS (SELECT 1 FROM documents d WHERE d.owner_id=owners.id AND d.key='records')
              OR EXISTS (SELECT 1 FROM storage_record_sync s WHERE s.workbench_id=owners.project_id AND s.extension_id=owners.extension_id))
            AND (NOT EXISTS (SELECT 1 FROM storage_ordered_owners p WHERE p.workbench_id=owners.project_id
              AND p.extension_id=owners.extension_id) OR EXISTS (SELECT 1 FROM documents c
                WHERE c.owner_id=owners.id AND c.key='["ordered-conversion"]'))`
                : sql`false`
            })`,
        ),
      )
      .orderBy(owners.id)
      .limit(1);
    if (!row) {
      if (present) {
        await finishConvertedLegacyOwners(db, options.signal);
        await removeConvertedLegacyDocuments(db, options.signal);
      }
      return preserved;
    }
    const owner = { workbenchId: row.workbenchId, extensionId: row.extensionId };
    try {
      if (present) await convertLegacyOwner(db, owner, options.signal);
      await convertLegacyNumbers(db, database, owner, options.signal);
    } catch (error) {
      options.signal?.throwIfAborted();
      if (!(await isolateFailedOwner(db, database, owner, row.id, error, failed, present))) {
        retainUnadmittedOwner(db, owner, error);
        preserved = false;
      }
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
  legacy: boolean,
) => {
  let backupPath: string | undefined;
  try {
    backupPath = await exportUnconvertedOwner(db, database, owner, id);
    if (
      owner.extensionId === coreOwnerId &&
      (
        await db
          .select({ id: storage_documents.key })
          .from(storage_documents)
          .where(and(eq(storage_documents.owner_id, id), eq(storage_documents.key, "resource-identities")))
      ).length
    )
      await (await prepareLegacyNumberInput(db, database, owner))();
    await emptyFailedOwner(db, owner, id, legacy);
  } catch (preservationError) {
    failed({
      owner,
      error: new AggregateError(
        [error, preservationError],
        "Legacy records retained because isolation did not complete",
      ),
      backupPath,
    });
    return false;
  }
  failed({ owner, error, backupPath });
  return true;
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

const removeConvertedLegacyDocuments = async (db: DbClient, signal?: AbortSignal) => {
  const blocked = JSON.stringify(unadmittedStorageOwners(db));
  while (true) {
    signal?.throwIfAborted();
    const { rows } = await db.execute(sql`WITH page AS (
      SELECT d.owner_id,d.key FROM documents d JOIN owners o ON o.id=d.owner_id
      WHERE starts_with(d.key, '["resource",')
        AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(${blocked}::jsonb) AS b("workbenchId" text,"extensionId" text)
          WHERE b."workbenchId"=o.project_id AND b."extensionId"=o.extension_id)
        AND EXISTS (SELECT 1 FROM storage_ordered_owners p WHERE p.workbench_id=o.project_id
          AND p.extension_id=o.extension_id)
        AND NOT EXISTS (SELECT 1 FROM documents c WHERE c.owner_id=d.owner_id
          AND c.key='["ordered-conversion"]')
      ORDER BY d.owner_id,d.key LIMIT 200
    ) DELETE FROM documents d USING page p
      WHERE d.owner_id=p.owner_id AND d.key=p.key RETURNING d.owner_id`);
    if (!rows.length) return;
  }
};
