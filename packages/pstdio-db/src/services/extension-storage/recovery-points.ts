import { statfs } from "node:fs/promises";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AssetStore, StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { projects, recovery_point_owners, recovery_points } from "../../db/schemas.pg";
import type { createDocumentStorageDBService } from "./document-storage";
import {
  dataOwners,
  decodeRecovery,
  type RecoveryMetadata,
  type RecoveryOwnerContent,
  readProjectContent,
} from "./recovery-content";
import type { RecoveryRecord } from "./recovery-edits";
import { createOwnerRestore, type SavedOwner } from "./recovery-restore";
import { dueRecoveryHours, planRecoverySlots, type RecoveryHours } from "./recovery-slots";

/** The selected recovery point, extension or its files are not available. */
export class RecoveryPointError extends Error {}

type Reader = Pick<DbClient, "select">;
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Documents = ReturnType<typeof createDocumentStorageDBService>;

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
  const owners = createOwnerRestore(db, documents);
  // Capture, restore and data deletion of one project run one at a time, so a point never holds a
  // half-done restore and a restore never writes back data that was deleted while it ran.
  const running = new Map<string, Promise<unknown>>();
  const exclusive = <T>(projectId: string, run: () => Promise<T>) => {
    const next = (running.get(projectId) ?? Promise.resolve()).catch(() => {}).then(run);
    running.set(projectId, next);
    void next
      .finally(() => {
        if (running.get(projectId) === next) running.delete(projectId);
      })
      .catch(() => {});
    return next;
  };
  const savedPoints = async (connection: Reader, projectId: string) =>
    (
      await connection
        .select()
        .from(recovery_points)
        .where(eq(recovery_points.workbench_id, projectId))
        .orderBy(asc(recovery_points.hours))
    ).map((point) => ({ hours: point.hours as RecoveryHours, capturedAt: point.captured_at }));

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

  const capture = async (projectId: string, now: Date) => {
    if (!dueRecoveryHours(await savedPoints(db, projectId), now).length) return;
    const write = (room?: number) =>
      db.transaction(async (tx) => {
        const content = await readProjectContent(tx, projectId);
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
    try {
      await db.transaction(async (tx) => {
        const content = await readProjectContent(tx, projectId);
        await writeSlots(tx, projectId, { write: [hours], drop: [] }, new Date().toISOString(), content);
      });
    } catch (error) {
      if (isDiskFull(error)) throw new RecoveryPointError("Not enough disk space to keep the current state first.");
      throw error;
    }
  };

  const readPoint = async (projectId: string, input: { hours: number; capturedAt: string; extensionId?: string }) => {
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
    const saved = new Map<string, SavedOwner>();
    for (const row of rows)
      if (scope.includes(row.extension_id))
        saved.set(row.extension_id, {
          records: await decodeRecovery<RecoveryRecord[]>(row.records),
          metadata: await decodeRecovery<RecoveryMetadata>(row.metadata),
        });
    return { points, scope, saved };
  };

  const restore = async (
    projectId: string,
    input: { hours: number; capturedAt: string; extensionId?: string },
    assets?: (owner: StorageOwner) => AssetStore,
  ) => {
    const { points, scope, saved } = await readPoint(projectId, input);
    const owner = (extensionId: string) => ({ workbenchId: projectId, extensionId });
    // A missing file would stop the restore halfway, so every file is checked before anything changes.
    for (const [extensionId, content] of saved)
      if (!(await owners.hasFiles(content, assets?.(owner(extensionId)))))
        throw new RecoveryPointError("Some files in this recovery point are no longer on this device.");
    const changing: string[] = [];
    for (const extensionId of scope)
      if (await owners.differs(owner(extensionId), saved.get(extensionId))) changing.push(extensionId);
    if (!changing.length) return { extensions: [], records: 0 };
    await keepCurrent(projectId, points.some((point) => point.hours === 1) ? 1 : 12);
    const extensions: string[] = [];
    let records = 0;
    for (const extensionId of changing) {
      const result = await owners.restore(owner(extensionId), saved.get(extensionId), assets?.(owner(extensionId)));
      if (result.changed) extensions.push(extensionId);
      records += result.records;
    }
    return { extensions, records };
  };

  return {
    capture: (projectId: string, now = new Date()) => exclusive(projectId, () => capture(projectId, now)),
    /** Runs work that must not interleave with a capture or restore of the project, such as deleting an extension's data. */
    exclusive,
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
      const saved = await db
        .select({ hours: recovery_point_owners.hours, id: recovery_point_owners.extension_id })
        .from(recovery_point_owners)
        .where(eq(recovery_point_owners.workbench_id, projectId));
      const current = await dataOwners(db, projectId);
      return (await savedPoints(db, projectId)).map((point) => ({
        ...point,
        extensions: [
          ...new Set([...saved.filter((owner) => owner.hours === point.hours).map((owner) => owner.id), ...current]),
        ].sort(),
      }));
    },
    /** Writes the difference to the selected point as normal record commits, so it syncs like any edit. */
    restore: (
      projectId: string,
      input: { hours: number; capturedAt: string; extensionId?: string },
      assets?: (owner: StorageOwner) => AssetStore,
    ) => exclusive(projectId, () => restore(projectId, input, assets)),
  };
};
