import { statfs } from "node:fs/promises";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AssetStore, StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { projects, recovery_point_owners, recovery_points } from "../../db/schemas.pg";
import type { createDocumentStorageDBService } from "./document-storage";
import {
  dataOwners,
  decodeRecovery,
  encodeRecovery,
  type RecoveryMetadata,
  type RecoveryOwnerContent,
  readProjectRecords,
  textFileIds,
} from "./recovery-content";
import { type RecoveryRecord, recoveryEdits } from "./recovery-edits";
import { dueRecoveryHours, planRecoverySlots, type RecoveryHours } from "./recovery-slots";

/** The selected recovery point or extension is not available. */
export class RecoveryPointError extends Error {}

type Reader = Pick<DbClient, "select">;
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Documents = ReturnType<typeof createDocumentStorageDBService>;
// Keeps each restore commit to a bounded number of record documents.
const groupSize = 100;

const isDiskFull = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  return code === "ENOSPC" || code === "53100" || ("cause" in error && isDiskFull(error.cause));
};

export const createRecoveryPoints = (
  db: DbClient,
  documents: Documents,
  options: { freeBytes?: () => Promise<number> } = {},
) => {
  const freeBytes =
    options.freeBytes ??
    (async () => {
      const disk = await statfs(process.cwd());
      return disk.bavail * disk.bsize;
    });
  const savedPoints = async (connection: Reader, projectId: string) =>
    (
      await connection
        .select()
        .from(recovery_points)
        .where(eq(recovery_points.workbench_id, projectId))
        .orderBy(asc(recovery_points.hours))
    ).map((point) => ({ hours: point.hours as RecoveryHours, capturedAt: point.captured_at }));

  // Text documents and data migration markers live in documents, so they are read before the records transaction.
  const readMetadata = async (projectId: string) => {
    const metadata = new Map<string, { bytes: Uint8Array; hasText: boolean }>();
    for (const extensionId of await dataOwners(db, projectId)) {
      const owner = { workbenchId: projectId, extensionId };
      await documents.upgrade(owner);
      const texts: Record<string, string> = {};
      for (const fileId of await textFileIds(db, owner))
        texts[fileId] = await documents.openTextDocument({ owner, fileId }).read();
      const dataVersions = await documents.transaction(owner, async ({ document }) =>
        [...document.getMap("data-migrations").keys()].sort(),
      );
      const hasText = Object.values(texts).some((text) => text.length > 0);
      metadata.set(extensionId, { bytes: encodeRecovery({ texts, dataVersions }), hasText });
    }
    return metadata;
  };

  const writeSlots = async (
    tx: Transaction,
    projectId: string,
    plan: { write: RecoveryHours[]; drop: RecoveryHours[] },
    capturedAt: string,
    content: RecoveryOwnerContent[],
  ) => {
    const replaced = [...plan.drop, ...plan.write];
    if (replaced.length)
      await tx
        .delete(recovery_points)
        .where(and(eq(recovery_points.workbench_id, projectId), inArray(recovery_points.hours, replaced)));
    for (const hours of plan.write) {
      await tx.insert(recovery_points).values({ workbench_id: projectId, hours, captured_at: capturedAt });
      if (content.length)
        await tx.insert(recovery_point_owners).values(
          content.map(({ extensionId, revision, records, metadata }) => ({
            workbench_id: projectId,
            hours,
            extension_id: extensionId,
            revision,
            records,
            metadata,
          })),
        );
    }
  };

  const capture = async (projectId: string, now = new Date()) => {
    if (!dueRecoveryHours(await savedPoints(db, projectId), now).length) return;
    const metadata = await readMetadata(projectId);
    const write = (room?: number) =>
      db.transaction(async (tx) => {
        const content = await readProjectRecords(tx, projectId, metadata);
        if (!content.some((owner) => owner.hasData)) return;
        const size = content.reduce((total, owner) => total + owner.records.byteLength + owner.metadata.byteLength, 0);
        const fits = room ?? Math.floor((await freeBytes()) / size);
        const plan = planRecoverySlots({ existing: await savedPoints(tx, projectId), now, room: fits });
        await writeSlots(tx, projectId, plan, now.toISOString(), content);
      });
    try {
      await write();
    } catch (error) {
      if (!isDiskFull(error)) throw error;
      // The failed write rolled back. Drop the hour and day points first, then keep the 12-hour point if it fits.
      await write(0);
      await write(1);
    }
  };

  // Keeps the state a restore replaces, so the restore itself can be undone without a fourth point.
  const keepCurrent = async (projectId: string, hours: RecoveryHours) => {
    const metadata = await readMetadata(projectId);
    await db.transaction(async (tx) => {
      const content = await readProjectRecords(tx, projectId, metadata);
      await writeSlots(tx, projectId, { write: [hours], drop: [] }, new Date().toISOString(), content);
    });
  };

  const restoreRecords = async (
    owner: StorageOwner,
    saved: RecoveryRecord[],
    assets: AssetStore | undefined,
    restoreId: string,
  ) => {
    const { records } = documents.open({ owner, assets });
    const restored = new Set<string>();
    // A revived record needs a second pass to restore the shared value its document kept.
    for (let pass = 0; pass < 2; pass++) {
      const { edits, revived } = recoveryEdits(await records.list(), saved);
      for (let index = 0; index < edits.length; index += groupSize)
        await records.commit({
          operationId: `recovery:${restoreId}:${owner.extensionId}:${pass}:${index}`,
          edits: edits.slice(index, index + groupSize),
        });
      for (const edit of edits) restored.add(edit.recordId);
      if (!revived) break;
    }
    return restored.size;
  };

  const restoreTexts = async (owner: StorageOwner, texts: Record<string, string>) => {
    let changed = false;
    for (const fileId of new Set([...Object.keys(texts), ...(await textFileIds(db, owner))])) {
      const text = documents.openTextDocument({ owner, fileId });
      const target = texts[fileId] ?? "";
      if ((await text.read()) === target) continue;
      await text.save(target);
      changed = true;
    }
    return changed;
  };

  // Restored records may predate a data migration. Restoring its markers lets the migration run again.
  const restoreDataVersions = (owner: StorageOwner, saved: string[]) =>
    documents.transaction(owner, async ({ document }) => {
      const markers = document.getMap("data-migrations");
      const versions = new Set(saved);
      const stale = [...markers.keys()].filter((key) => !versions.has(key));
      const missing = saved.filter((key) => !markers.has(key));
      document.transact(() => {
        for (const key of stale) markers.delete(key);
        for (const key of missing) markers.set(key, true);
      });
      return stale.length + missing.length > 0;
    });

  return {
    capture,
    /** Projects that already have recovery points keep rotating them, even offline. */
    async projects() {
      const rows = await db
        .selectDistinct({ id: recovery_points.workbench_id })
        .from(recovery_points)
        .innerJoin(projects, eq(projects.id, recovery_points.workbench_id))
        .where(isNull(projects.deleted_at));
      return rows.map((row) => row.id);
    },
    async list(projectId: string) {
      const owners = await db
        .select({ hours: recovery_point_owners.hours, id: recovery_point_owners.extension_id })
        .from(recovery_point_owners)
        .where(eq(recovery_point_owners.workbench_id, projectId));
      const current = await dataOwners(db, projectId);
      return (await savedPoints(db, projectId)).map((point) => ({
        ...point,
        extensions: [
          ...new Set([...owners.filter((owner) => owner.hours === point.hours).map((owner) => owner.id), ...current]),
        ].sort(),
      }));
    },
    /** Writes the difference to the selected point as normal record commits, so it syncs like any edit. */
    async restore(
      projectId: string,
      input: { hours: number; capturedAt: string; extensionId?: string },
      assets?: (owner: StorageOwner) => AssetStore,
    ) {
      const points = await savedPoints(db, projectId);
      if (!points.some((point) => point.hours === input.hours && point.capturedAt === input.capturedAt))
        throw new RecoveryPointError("This recovery point changed or is no longer available. Refresh the list.");
      const rows = await db
        .select()
        .from(recovery_point_owners)
        .where(and(eq(recovery_point_owners.workbench_id, projectId), eq(recovery_point_owners.hours, input.hours)));
      const known = new Set([...rows.map((row) => row.extension_id), ...(await dataOwners(db, projectId))]);
      if (input.extensionId && !known.has(input.extensionId))
        throw new RecoveryPointError("This extension has no data in the project or the recovery point.");
      const scope = input.extensionId ? [input.extensionId] : [...known].sort();
      const saved = new Map(
        rows
          .filter((row) => scope.includes(row.extension_id))
          .map((row) => [
            row.extension_id,
            {
              records: decodeRecovery<RecoveryRecord[]>(row.records),
              metadata: decodeRecovery<RecoveryMetadata>(row.metadata),
            },
          ]),
      );
      await keepCurrent(projectId, points.some((point) => point.hours === 1) ? 1 : 12);
      const restoreId = crypto.randomUUID();
      const extensions: string[] = [];
      let records = 0;
      for (const extensionId of scope) {
        const owner = { workbenchId: projectId, extensionId };
        const content = saved.get(extensionId);
        const count = await restoreRecords(owner, content?.records ?? [], assets?.(owner), restoreId);
        const texts = await restoreTexts(owner, content?.metadata.texts ?? {});
        const versions = await restoreDataVersions(owner, content?.metadata.dataVersions ?? []);
        if (count || texts || versions) extensions.push(extensionId);
        records += count;
      }
      return { extensions, records };
    },
  };
};
