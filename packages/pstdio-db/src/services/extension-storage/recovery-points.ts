import { statfs } from "node:fs/promises";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { AssetStore, StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { projects, recovery_point_owners, recovery_points, owners as storageOwners } from "../../db/schemas.pg";
import { assertStorageProjectAdmitted } from "../../db/storage-admission";
import type { createDocumentStorageDBService } from "./document-storage";
import {
  dataOwners,
  decodeRecovery,
  type RecoveryMetadata,
  type RecoveryOwnerContent,
  readProjectContent,
} from "./recovery-content";
import type { RecoveryRecord } from "./recovery-edits";
import { pruneRecoveryProject } from "./recovery-file-retention";
import { type RecoveryBytes, recoveryFilesFor } from "./recovery-files";
import { createOwnerRestore, type SavedOwner } from "./recovery-restore";
import { dueRecoveryHours, planRecoverySlots, type RecoveryHours } from "./recovery-slots";
import { ensureStorageOwner } from "./storage-owner-key";

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
  const files = recoveryFilesFor(db);
  // Capture, restore and data deletion of one project run one at a time, so a point never holds a
  // half-done restore and a restore never writes back data that was deleted while it ran.
  const running = new Map<string, Promise<unknown>>();
  const exclusive = <T>(projectId: string, run: () => Promise<T>) => {
    const next = (running.get(projectId) ?? Promise.resolve())
      .catch(() => {})
      .then(() => {
        assertStorageProjectAdmitted(db, projectId);
        return run();
      });
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
        .where(eq(recovery_points.project_id, projectId))
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
        .where(and(eq(recovery_points.project_id, projectId), inArray(recovery_points.hours, replaced)));
    const ownerIds = new Map<string, number>();
    for (const { extensionId } of content)
      ownerIds.set(extensionId, await ensureStorageOwner(tx, { workbenchId: projectId, extensionId }));
    for (const hours of plan.write) {
      await tx.insert(recovery_points).values({ project_id: projectId, hours, captured_at: capturedAt });
      for (const owner of content) {
        // No referenced path is overwritten: rollback leaves the previous hash readable.
        const reference = await files.put(projectId, hours, owner.file);
        await tx.insert(recovery_point_owners).values({
          project_id: projectId,
          hours,
          owner_id: ownerIds.get(owner.extensionId)!,
          revision: owner.revision,
          ...reference,
        });
      }
    }
  };

  const capture = async (projectId: string, now: Date) => {
    if (!dueRecoveryHours(await savedPoints(db, projectId), now).length) return;
    const write = (room?: number) =>
      db.transaction(async (tx) => {
        const content = await readProjectContent(tx, projectId, files);
        if (!content.some((owner) => owner.hasData)) return;
        const filesByHash = new Map(content.map((owner) => [owner.file.sha256, owner.file.bytes]));
        const size = [...filesByHash.values()].reduce((total, bytes) => total + bytes, 0);
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
      await pruneRecoveryProject(db, projectId);
      await write(1);
    }
    await pruneRecoveryProject(db, projectId);
  };

  // Keeps the state a restore replaces, so the restore itself can be undone without a fourth point.
  const keepCurrent = async (projectId: string, hours: RecoveryHours) => {
    try {
      await db.transaction(async (tx) => {
        const content = await readProjectContent(tx, projectId, files);
        await writeSlots(tx, projectId, { write: [hours], drop: [] }, new Date().toISOString(), content);
      });
      await pruneRecoveryProject(db, projectId);
    } catch (error) {
      if (isDiskFull(error)) throw new RecoveryPointError("Not enough disk space to keep the current state first.");
      throw error;
    }
  };

  const readPoint = async (projectId: string, input: { hours: number; capturedAt: string; extensionId?: string }) => {
    input = { ...input, extensionId: input.extensionId && canonicalExtensionId(input.extensionId) };
    const points = await savedPoints(db, projectId);
    if (!points.some((point) => point.hours === input.hours && point.capturedAt === input.capturedAt))
      throw new RecoveryPointError("This recovery point changed or is no longer available. Refresh the list.");
    // Keep referenced bytes alive through their read; another instance may replace the slot.
    const rows = await db.transaction(async (tx) => {
      const committed = await savedPoints(tx, projectId);
      if (!committed.some((point) => point.hours === input.hours && point.capturedAt === input.capturedAt))
        throw new RecoveryPointError("This recovery point changed or is no longer available. Refresh the list.");
      const references = await tx
        .select({
          extension_id: storageOwners.extension_id,
          sha256: recovery_point_owners.sha256,
          bytes: recovery_point_owners.bytes,
        })
        .from(recovery_point_owners)
        .innerJoin(storageOwners, eq(storageOwners.id, recovery_point_owners.owner_id))
        .where(and(eq(recovery_point_owners.project_id, projectId), eq(recovery_point_owners.hours, input.hours)));
      const saved = [];
      for (const row of references) {
        const selected = !input.extensionId || canonicalExtensionId(row.extension_id) === input.extensionId;
        let content: RecoveryBytes | undefined;
        if (selected) {
          try {
            content = await files.read(projectId, input.hours, row);
          } catch (error) {
            throw new RecoveryPointError("Some recovery files are unavailable or damaged.", { cause: error });
          }
        }
        saved.push({ extension_id: row.extension_id, content });
      }
      return saved;
    });
    const known = new Set([
      ...rows.map((row) => canonicalExtensionId(row.extension_id)),
      ...(await dataOwners(db, projectId)).map(canonicalExtensionId),
    ]);
    if (input.extensionId && !known.has(input.extensionId))
      throw new RecoveryPointError("This extension has no data in the project or the recovery point.");
    const scope = input.extensionId ? [input.extensionId] : [...known].sort();
    const saved = new Map<string, SavedOwner>();
    for (const row of rows) {
      const extensionId = canonicalExtensionId(row.extension_id);
      if (saved.has(extensionId))
        throw new RecoveryPointError(`Conflicting recovery owners: ${extensionId}. Original evidence was retained.`);
      if (scope.includes(extensionId) && row.content)
        saved.set(extensionId, {
          records: await decodeRecovery<RecoveryRecord[]>(row.content.records),
          metadata: await decodeRecovery<RecoveryMetadata>(row.content.metadata),
        });
    }
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
        .selectDistinct({ id: recovery_points.project_id })
        .from(recovery_points)
        .innerJoin(projects, eq(projects.id, recovery_points.project_id))
        .where(isNull(projects.deleted_at));
      return rows.map((row) => row.id);
    },
    async list(projectId: string) {
      assertStorageProjectAdmitted(db, projectId);
      const saved = await db
        .select({ hours: recovery_point_owners.hours, id: storageOwners.extension_id })
        .from(recovery_point_owners)
        .innerJoin(storageOwners, eq(storageOwners.id, recovery_point_owners.owner_id))
        .where(eq(recovery_point_owners.project_id, projectId));
      const current = await dataOwners(db, projectId);
      return (await savedPoints(db, projectId)).map((point) => ({
        ...point,
        extensions: [
          ...new Set([
            ...saved.filter((owner) => owner.hours === point.hours).map((owner) => canonicalExtensionId(owner.id)),
            ...current.map(canonicalExtensionId),
          ]),
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
